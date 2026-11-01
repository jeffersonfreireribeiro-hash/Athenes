// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';

function editar(arq, fn) {
  const bruto = fs.readFileSync(arq, 'utf8');
  const crlf = bruto.includes('\r\n');
  const t = bruto.replace(/\r\n/g, '\n');
  let novo = fn(t);
  if (novo === t) throw new Error('Nada alterado em ' + arq);
  if (crlf) novo = novo.replace(/\n/g, '\r\n');
  fs.writeFileSync(arq, novo, 'utf8');
}
function trocar(t, de, para) {
  if (!t.includes(de)) throw new Error('Trecho não encontrado: ' + de.slice(0, 70));
  return t.replace(de, () => para);
}
function fatiar(t, ini, fim, novo) {
  const i = t.indexOf(ini);
  const f = fim === null ? t.length : t.indexOf(fim, i + 1);
  if (i < 0 || f < 0) throw new Error('Marcadores não encontrados: ' + ini);
  return t.slice(0, i) + novo + t.slice(f);
}

/* ---------------------------------- núcleo ---------------------------------- */
editar('src/core/athenes_documento.js', t => {
  t = trocar(t, "export const MODOS_APLICACAO_MESTRA",
`/** Família "Figura": cada subtipo tem rótulo, numeração e lista próprios (ex.: Gráfico 1, Figura 1). */
export const ROTULOS_FIGURA = Object.freeze({
  figura: 'Figura',
  grafico: 'Gráfico',
  fotografia: 'Fotografia',
  diagrama: 'Diagrama',
  fluxograma: 'Fluxograma'
});

export function rotuloDaFigura(bloco) {
  return ROTULOS_FIGURA[bloco?.subtipo] || ROTULOS_FIGURA.figura;
}

export const MODOS_APLICACAO_MESTRA`);

  t = trocar(t, "      b.tipo = 'figura';\n      b.titulo = dados.titulo || 'Figura 1 — Descrição detalhada da ilustração';",
    "      b.tipo = 'figura';\n      b.subtipo = ROTULOS_FIGURA[dados.subtipo] ? dados.subtipo : 'figura';\n      b.titulo = dados.titulo || `${ROTULOS_FIGURA[b.subtipo]} 1 — Descrição detalhada da ilustração`;");

  t = fatiar(t, 'export function recalcularNumeracaoAutomatica', '/**\n * Localiza o número da página', `export function recalcularNumeracaoAutomatica(doc) {
  const vazio = { figuras: 0, mapas: 0, tabelas: 0, quadros: 0, formulas: 0, porSubtipo: {} };
  if (!doc || !Array.isArray(doc.secoes)) return vazio;

  const cont = { mapa: 0, tabela: 0, quadro: 0, formula: 0 };
  const porSubtipo = {};
  const nomes = Object.values(ROTULOS_FIGURA).join('|');
  const prefixoFigura = new RegExp('^(' + nomes + ')\\\\s+\\\\d+\\\\s*[-—]', 'i');
  const renumerar = (texto, rotulo, n, regex) =>
    texto && regex.test(texto) ? texto.replace(regex, rotulo + ' ' + n + ' —') : texto;

  for (const sec of doc.secoes) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'figura' || b.tipo === 'imagem') {
        const sub = b.tipo === 'imagem' ? 'figura' : (ROTULOS_FIGURA[b.subtipo] ? b.subtipo : 'figura');
        porSubtipo[sub] = (porSubtipo[sub] || 0) + 1;
        b.numero_sequencial = porSubtipo[sub];
        const rotulo = ROTULOS_FIGURA[sub];
        b.titulo = renumerar(b.titulo, rotulo, b.numero_sequencial, prefixoFigura);
        b.legenda = renumerar(b.legenda, rotulo, b.numero_sequencial, prefixoFigura);
      } else if (b.tipo === 'mapa') {
        b.numero_sequencial = ++cont.mapa;
        b.titulo = renumerar(b.titulo, 'Mapa', cont.mapa, /^Mapa\\s+\\d+\\s*[-—]/i);
      } else if (b.tipo === 'tabela') {
        b.numero_sequencial = ++cont.tabela;
        b.titulo = renumerar(b.titulo, 'Tabela', cont.tabela, /^Tabela\\s+\\d+\\s*[-—]/i);
      } else if (b.tipo === 'quadro') {
        b.numero_sequencial = ++cont.quadro;
        b.titulo = renumerar(b.titulo, 'Quadro', cont.quadro, /^Quadro\\s+\\d+\\s*[-—]/i);
      } else if (b.tipo === 'formula') {
        b.numero_sequencial = ++cont.formula;
        b.numero_equacao = '(' + cont.formula + ')';
        b.numero = b.numero_equacao;
      }
    }
  }

  return {
    figuras: porSubtipo.figura || 0,
    mapas: cont.mapa,
    tabelas: cont.tabela,
    quadros: cont.quadro,
    formulas: cont.formula,
    porSubtipo
  };
}

`);

  t = fatiar(t, 'export function gerarListaFiguras', 'export function gerarListaMapas', `/** Lista de ilustrações de um subtipo da família Figura (figura, grafico, fotografia, diagrama, fluxograma). */
export function gerarListaIlustracoes(doc, subtipo = 'figura') {
  recalcularNumeracaoAutomatica(doc);
  const rotulo = ROTULOS_FIGURA[subtipo] || ROTULOS_FIGURA.figura;
  const prefixo = new RegExp('^' + rotulo + '\\\\s+\\\\d+\\\\s*[-—]\\\\s*', 'i');
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      const sub = b.tipo === 'imagem' ? 'figura' : (b.tipo === 'figura' ? (ROTULOS_FIGURA[b.subtipo] ? b.subtipo : 'figura') : null);
      if (sub !== subtipo) continue;
      lista.push({
        id: b.id,
        tipo: subtipo,
        numero: b.numero_sequencial || 1,
        rotulo: rotulo + ' ' + (b.numero_sequencial || 1),
        titulo: (b.titulo || b.legenda || rotulo).replace(prefixo, ''),
        pagina: encontrarPaginaDoBloco(doc, b.id)
      });
    }
  }
  return lista;
}

export function gerarListaFiguras(doc) { return gerarListaIlustracoes(doc, 'figura'); }
export function gerarListaGraficos(doc) { return gerarListaIlustracoes(doc, 'grafico'); }

`);

  t = fatiar(t, 'export function resolverReferenciasCruzadas', '/* =========================================================================\n   Linhas e grupos', `export function resolverReferenciasCruzadas(texto, doc) {
  if (!texto || typeof texto !== 'string') return texto || '';
  recalcularNumeracaoAutomatica(doc);

  const mapaBlocos = new Map();
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) mapaBlocos.set(b.id, b);
  }

  const tipos = 'figura|grafico|fotografia|diagrama|fluxograma|mapa|tabela|quadro|formula|equacao';
  const regex = new RegExp('\\\\[ref:(' + tipos + '):([a-zA-Z0-9_-]+)\\\\]', 'gi');
  return texto.replace(regex, (match, tipo, id) => {
    const b = mapaBlocos.get(id);
    if (!b) return match;
    const num = b.numero_sequencial || 1;
    switch (b.tipo) {
      case 'figura': return rotuloDaFigura(b) + ' ' + num;
      case 'imagem': return 'Figura ' + num;
      case 'mapa': return 'Mapa ' + num;
      case 'tabela': return 'Tabela ' + num;
      case 'quadro': return 'Quadro ' + num;
      case 'formula': return 'Equação (' + num + ')';
      default: return match;
    }
  });
}

`);
  return t;
});

/* ---------------------------------- ícones ---------------------------------- */
editar('src/ui/athenes_icones.js', t => trocar(t, "  divisor:",
`  grafico: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  fotografia: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  diagrama: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5H5v5M12 11.5h7v5"/>',
  fluxograma: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  divisor:`));

/* ---------------------------------- editor ---------------------------------- */
editar('src/ui/athenes_editor.js', t => {
  t = trocar(t, "  gerarId,\n", "  gerarId,\n  ROTULOS_FIGURA,\n  rotuloDaFigura,\n");

  // barra: Campos some; Figura e Quadro viram grupos com menu
  t = fatiar(t, '            <button type="button" class="rm-ic-bt" id="rmAddCampos"', '            <button type="button" class="rm-ic-bt" id="rmAddTabela"',
`            <div class="rm-grupo-bt" data-grupo="figura">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddFigura" data-tip="Figura" title="Figura, gráfico, fotografia, diagrama…" aria-haspopup="menu" aria-expanded="false">\${svgIcone('imagem', 16)}</button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
`);
  t = fatiar(t, '            <button type="button" class="rm-ic-bt" id="rmAddQuadro"', '            <button type="button" class="rm-ic-bt" id="rmAddMapa"',
`            <div class="rm-grupo-bt" data-grupo="quadro">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddQuadro" data-tip="Quadro" title="Quadro ou campos (rótulo e valor)" aria-haspopup="menu" aria-expanded="false">\${svgIcone('quadro', 16)}</button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
`);
  t = trocar(t, "    root.querySelector('#rmAddCampos').addEventListener('click', () => adicionar('campos', {}));\n", "");
  t = trocar(t, "    root.querySelector('#rmAddFigura').addEventListener('click', () => adicionar('figura', { titulo: 'Figura — Descrição da imagem' }));\n",
    "    this.ligarMenusDeBlocos(root, adicionar);\n");
  t = trocar(t, "    root.querySelector('#rmAddQuadro').addEventListener('click', () => adicionar('quadro', { titulo: 'Quadro — Dados conceituais' }));\n", "");

  // rótulos por subtipo
  t = trocar(t, "const ALINHAMENTO_CSS =",
`const MENUS_BLOCO = {
  figura: [
    { tipo: 'figura', subtipo: 'figura', icone: 'imagem', rotulo: 'Figura', desc: 'Imagem, esquema ou ilustração numerada' },
    { tipo: 'figura', subtipo: 'grafico', icone: 'grafico', rotulo: 'Gráfico', desc: 'Barras, linhas, dispersão — numeração própria' },
    { tipo: 'figura', subtipo: 'fotografia', icone: 'fotografia', rotulo: 'Fotografia', desc: 'Registro fotográfico, com fonte e crédito' },
    { tipo: 'figura', subtipo: 'diagrama', icone: 'diagrama', rotulo: 'Diagrama', desc: 'Relações e estruturas entre elementos' },
    { tipo: 'figura', subtipo: 'fluxograma', icone: 'fluxograma', rotulo: 'Fluxograma', desc: 'Etapas e decisões de um processo' }
  ],
  quadro: [
    { tipo: 'quadro', icone: 'quadro', rotulo: 'Quadro', desc: 'Texto organizado em caixa fechada, numerado' },
    { tipo: 'campos', icone: 'campos', rotulo: 'Campos (rótulo e valor)', desc: 'Pares de rótulo e valor em colunas' }
  ]
};

function rotuloDoBloco(b) {
  if (b.tipo === 'figura') return ROTULOS_FIGURA[b.subtipo] || 'Figura';
  return TIPO_ROTULO[b.tipo] || b.tipo;
}

const ALINHAMENTO_CSS =`);
  t = trocar(t, "<strong>${TIPO_ROTULO[b.tipo] || b.tipo}</strong>", "<strong>${rotuloDoBloco(b)}</strong>");

  // textos da folha
  t = trocar(t, "tit.innerHTML = b.titulo || `Figura ${b.numero_sequencial || 1} — Descrição da Ilustração`;",
    "tit.innerHTML = b.titulo || `${rotuloDaFigura(b)} ${b.numero_sequencial || 1} — Descrição da Ilustração`;");
  t = trocar(t, "<span class=\"ath-fig-sublegenda\">Figura ${b.numero_sequencial || 1}${String.fromCharCode(97 + idx)}",
    "<span class=\"ath-fig-sublegenda\">${rotuloDaFigura(b)} ${b.numero_sequencial || 1}${String.fromCharCode(97 + idx)}");

  // métodos dos menus
  t = trocar(t, "  /* ======================================================================\n     Estilos de texto",
`  /* Menus da barra de blocos (Figura: gráfico, fotografia…; Quadro: campos…) */
  ligarMenusDeBlocos(root, adicionar) {
    const fecharTodos = () => {
      document.querySelectorAll('.rm-menu-bloco:not([hidden])').forEach(m => {
        m.hidden = true;
        m.parentElement.querySelector('.rm-ic-bt')?.setAttribute('aria-expanded', 'false');
      });
    };
    if (!this._menusRegistrados) {
      this._menusRegistrados = true;
      document.addEventListener('click', fecharTodos);
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharTodos(); });
    }

    root.querySelectorAll('.rm-grupo-bt').forEach(grupo => {
      const itens = MENUS_BLOCO[grupo.dataset.grupo] || [];
      const botao = grupo.querySelector('.rm-ic-bt');
      const menu = grupo.querySelector('.rm-menu-bloco');
      menu.innerHTML = itens.map((it, i) => \`
        <button type="button" class="rm-menu-item" role="menuitem" data-i="\${i}">
          <span class="rm-menu-icone">\${svgIcone(it.icone, 16)}</span>
          <span class="rm-menu-texto"><strong>\${it.rotulo}</strong><small>\${it.desc}</small></span>
        </button>\`).join('');

      botao.addEventListener('click', ev => {
        ev.stopPropagation();
        const abrir = menu.hidden;
        fecharTodos();
        menu.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
      });
      menu.querySelectorAll('.rm-menu-item').forEach(el => el.addEventListener('click', ev => {
        ev.stopPropagation();
        const it = itens[Number(el.dataset.i)];
        fecharTodos();
        const dados = it.tipo === 'figura'
          ? { subtipo: it.subtipo, titulo: \`\${it.rotulo} — Descrição\` }
          : (it.tipo === 'quadro' ? { titulo: 'Quadro — Dados conceituais' } : {});
        adicionar(it.tipo, dados);
      }));
    });
  }

  /* ======================================================================
     Estilos de texto`);
  return t;
});

/* ---------------------------------- inspetor ---------------------------------- */
editar('src/ui/athenes_painel_propriedades.js', t => {
  t = trocar(t, "calcularLinhas, linhaDoBloco,", "ROTULOS_FIGURA, calcularLinhas, linhaDoBloco,");
  t = trocar(t, "      figura: 'Figura / Ilustração',", "      figura: `${ROTULOS_FIGURA[b.subtipo] || 'Figura'} (ilustração)`,");
  return t;
});

/* ---------------------------------- css ---------------------------------- */
editar('src/css/athenes_editor.css', t => t + `

/* Botões da barra com menu (Figura ▾, Quadro ▾) */
.rm-grupo-bt { position: relative; flex: none; }
.rm-ic-bt.tem-menu::before { content: ''; position: absolute; right: 6px; bottom: 7px; border: 3px solid transparent; border-top: 4px solid currentColor; border-bottom: 0; opacity: .7; }
.rm-menu-bloco { position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-30%); min-width: 270px; padding: 8px; display: flex; flex-direction: column; gap: 2px; background: #fff; border: 1px solid #E6E9EF; border-radius: 18px; box-shadow: 0 16px 36px -10px rgba(31, 39, 51, .28); z-index: 80; }
.rm-menu-bloco[hidden] { display: none; }
.rm-menu-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 10px; border: 0; border-radius: 12px; background: transparent; text-align: left; cursor: pointer; font-family: var(--glx-font); transition: background .12s; }
.rm-menu-item:hover, .rm-menu-item:focus-visible { background: #FFF1EB; outline: none; }
.rm-menu-icone { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #F4F5F8; color: #64748B; }
.rm-menu-item:hover .rm-menu-icone { background: #FF6B2C; color: #fff; }
.rm-menu-texto { display: flex; flex-direction: column; min-width: 0; }
.rm-menu-texto strong { font-size: 13px; font-weight: 800; color: #1F2733; }
.rm-menu-texto small { font-size: 11px; color: #6B7585; }
`);
console.log('ok');
