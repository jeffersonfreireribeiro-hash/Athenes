// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';

function editar(arq, fn) {
  const bruto = fs.readFileSync(arq, 'utf8');
  const crlf = bruto.includes('\r\n');
  let t = bruto.replace(/\r\n/g, '\n');
  const novo = fn(t);
  if (novo === t) throw new Error('Nada alterado em ' + arq);
  t = novo;
  if (crlf) t = t.replace(/\n/g, '\r\n');
  fs.writeFileSync(arq, t, 'utf8');
}

editar('src/core/athenes_documento.js', t => {
  // 1) remover bloco: dissolver grupos de um só membro
  t = t.replace("  sec.blocos.splice(idx, 1);\n  repaginarDocumento(doc);\n  return true;",
    "  const removido = sec.blocos.splice(idx, 1)[0];\n  reequilibrarGrupo(sec, removido?.grupo);\n  normalizarGrupos(sec);\n  repaginarDocumento(doc);\n  return true;");

  // 2) repaginação: linha de blocos agrupados é uma unidade
  t = t.replace("        const altPt = estimarAlturaBlocoPt(b);\n",
`        // Blocos da mesma linha (grupo) ficam juntos: só o primeiro decide a quebra
        const anterior = bIdx > 0 ? blocosDaSecao[bIdx - 1] : null;
        if (b.grupo && anterior && anterior.grupo === b.grupo && blocosPagAtual[blocosPagAtual.length - 1] === anterior) {
          blocosPagAtual.push(b);
          continue;
        }
        const altPt = alturaDaLinha(blocosDaSecao, bIdx);
`);

  t += `

/* =========================================================================
   Linhas e grupos de blocos (mesma mecânica do Clux.js / Glaux GIS)
   Um grupo é uma sequência de blocos vizinhos com o mesmo \`grupo\`; eles
   dividem as 12 colunas da folha lado a lado.
   ========================================================================= */

export const LIMITE_BLOCOS_POR_LINHA = 4;

export function calcularLinhas(blocos) {
  const linhas = [];
  for (const b of blocos || []) {
    const ultima = linhas[linhas.length - 1];
    if (b.grupo && ultima && ultima[0].grupo === b.grupo) ultima.push(b);
    else linhas.push([b]);
  }
  return linhas;
}

function alturaDaLinha(blocos, inicio) {
  const primeiro = blocos[inicio];
  let altura = estimarAlturaBlocoPt(primeiro);
  if (!primeiro.grupo) return altura;
  for (let i = inicio + 1; i < blocos.length && blocos[i].grupo === primeiro.grupo; i++) {
    altura = Math.max(altura, estimarAlturaBlocoPt(blocos[i]));
  }
  return altura;
}

/** Divide as 12 colunas igualmente entre os blocos da linha. */
export function igualarLinha(linha) {
  const n = linha.length;
  if (n === 0) return;
  const base = Math.floor(12 / n);
  let resto = 12 - base * n;
  let col = 1;
  for (const b of linha) {
    const span = base + (resto-- > 0 ? 1 : 0);
    b.col = col;
    b.span = span;
    col += span;
  }
}

function reequilibrarGrupo(sec, grupoId) {
  if (!grupoId) return;
  const membros = sec.blocos.filter(b => b.grupo === grupoId);
  if (membros.length > 1) igualarLinha(membros);
}

/** Dissolve linhas de um só bloco (volta para a largura toda). */
export function normalizarGrupos(sec) {
  for (const linha of calcularLinhas(sec.blocos)) {
    if (linha.length === 1 && linha[0].grupo) {
      linha[0].grupo = null;
      linha[0].col = 1;
      linha[0].span = 12;
    }
  }
}

function localizarBloco(doc, blocoId) {
  for (const sec of doc.secoes || []) {
    const idx = (sec.blocos || []).findIndex(b => b.id === blocoId);
    if (idx >= 0) return { sec, idx, bloco: sec.blocos[idx] };
  }
  return null;
}

export function linhaDoBloco(doc, blocoId) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return { numero: 1, total: 1, quantidade: 1 };
  const linhas = calcularLinhas(loc.sec.blocos);
  const i = linhas.findIndex(l => l.some(b => b.id === blocoId));
  return { numero: i + 1, total: linhas.length, quantidade: linhas[i].length };
}

/**
 * Move um bloco para junto de outro.
 * zona: 'antes' | 'depois' (em linha própria) | 'grupo' (passa a dividir a linha do alvo).
 * \`aDireita\` indica de que lado do alvo o bloco entra quando agrupa.
 */
export function colocarBloco(doc, blocoId, alvoId, zona = 'depois', aDireita = true) {
  if (blocoId === alvoId) return false;
  const origem = localizarBloco(doc, blocoId);
  const alvoLoc = localizarBloco(doc, alvoId);
  if (!origem || !alvoLoc) return false;

  const bloco = origem.bloco;
  const grupoAntigo = bloco.grupo;
  origem.sec.blocos.splice(origem.idx, 1);
  bloco.grupo = null;
  bloco.col = 1;
  bloco.span = 12;
  reequilibrarGrupo(origem.sec, grupoAntigo);

  const sec = alvoLoc.sec;
  const alvo = sec.blocos.find(b => b.id === alvoId);
  const linhas = calcularLinhas(sec.blocos);
  const linha = linhas.find(l => l.includes(alvo));
  const primeiroIdx = sec.blocos.indexOf(linha[0]);
  const ultimoIdx = sec.blocos.indexOf(linha[linha.length - 1]);

  if (zona === 'grupo' && linha.length >= LIMITE_BLOCOS_POR_LINHA) zona = 'depois';

  if (zona === 'antes') {
    sec.blocos.splice(primeiroIdx, 0, bloco);
  } else if (zona === 'depois') {
    sec.blocos.splice(ultimoIdx + 1, 0, bloco);
  } else {
    const gid = alvo.grupo || gerarId('grp');
    alvo.grupo = gid;
    bloco.grupo = gid;
    const idxAlvo = sec.blocos.indexOf(alvo);
    sec.blocos.splice(aDireita ? idxAlvo + 1 : idxAlvo, 0, bloco);
    igualarLinha(sec.blocos.filter(b => b.grupo === gid));
  }

  normalizarGrupos(origem.sec);
  normalizarGrupos(sec);
  repaginarDocumento(doc);
  return true;
}

/** Sobe (-1) ou desce (+1) o bloco uma linha, saindo do grupo se estiver em um. */
export function moverBlocoPorLinha(doc, blocoId, direcao) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return false;
  const linhas = calcularLinhas(loc.sec.blocos);
  const i = linhas.findIndex(l => l.some(b => b.id === blocoId));
  const proxima = linhas[i + direcao];
  if (!proxima) {
    // já está na ponta: se dividia a linha, apenas sai dela
    if (linhas[i].length > 1) {
      const ref = linhas[i].find(b => b.id !== blocoId);
      return colocarBloco(doc, blocoId, ref.id, direcao < 0 ? 'antes' : 'depois');
    }
    return false;
  }
  const ancora = direcao < 0 ? proxima[0] : proxima[proxima.length - 1];
  return colocarBloco(doc, blocoId, ancora.id, direcao < 0 ? 'antes' : 'depois');
}

/** Coloca o bloco na linha de número \`numero\` (1..n) ou numa linha nova ao final (numero = n + 1). */
export function moverParaLinha(doc, blocoId, numero) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return false;
  const linhas = calcularLinhas(loc.sec.blocos);
  const atual = linhas.findIndex(l => l.some(b => b.id === blocoId));
  if (numero === atual + 1) return false;
  if (numero > linhas.length) {
    if (linhas[atual].length === 1) return false;
    const ultima = linhas[linhas.length - 1];
    return colocarBloco(doc, blocoId, ultima[ultima.length - 1].id, 'depois');
  }
  const alvoLinha = linhas[numero - 1];
  return colocarBloco(doc, blocoId, alvoLinha[alvoLinha.length - 1].id, 'grupo', true);
}

/** Duplica o bloco logo abaixo da sua linha, em linha própria. */
export function duplicarBlocoNaSecao(doc, blocoId) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return null;
  const clone = JSON.parse(JSON.stringify(loc.bloco));
  clone.id = gerarId('bloco');
  clone.grupo = null;
  clone.col = 1;
  clone.span = 12;
  const linha = calcularLinhas(loc.sec.blocos).find(l => l.some(b => b.id === blocoId));
  const ultimoIdx = loc.sec.blocos.indexOf(linha[linha.length - 1]);
  loc.sec.blocos.splice(ultimoIdx + 1, 0, clone);
  repaginarDocumento(doc);
  return clone;
}
`;
  return t;
});
console.log('core ok');
