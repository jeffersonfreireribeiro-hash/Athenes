// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Diff de texto/HTML por tokens (Myers) e versões do documento com/sem sugestões.
 *
 * Modelo de dados das sugestões (ver `athenes_colaboracao.js`):
 *  - A sugestão vive INLINE no HTML do bloco (`bloco.texto`) como `<ins>`/`<del class="ath-sug-mark">`
 *    com `data-sugestao-id`; o registro (autor, data, tipo, textos) fica em `documento.sugestoes`.
 *  - O texto base nunca é destruído: rejeitar todas as sugestões restaura o original; aceitar todas gera a proposta.
 *
 * Sem DOM e sem dependências de runtime: roda no navegador e no Node (testes).
 */

import { repaginarDocumento } from './athenes_documento.js';

// ───────────────────────────── Sugestões embutidas no HTML ─────────────────────────────

const RE_INS = /<ins\b[^>]*\bath-sug-mark\b[^>]*>([\s\S]*?)<\/ins>/gi;
const RE_DEL = /<del\b[^>]*\bath-sug-mark\b[^>]*>([\s\S]*?)<\/del>/gi;
const RE_GHOST = /<span\b[^>]*\bath-ghost-text\b[^>]*>([\s\S]*?)<\/span>/gi;

export function temMarcasSugestao(html) {
  return typeof html === 'string' && (html.includes('ath-sug-mark') || html.includes('ath-ghost-text'));
}

/**
 * Resolve TODAS as marcas de sugestão do HTML.
 *  - 'aceitar'  → versão proposta: mantém o texto inserido e descarta o excluído.
 *  - 'rejeitar' → versão original: descarta o texto inserido e restaura o excluído.
 */
export function resolverSugestoesEmHtml(html, acao = 'aceitar') {
  if (!temMarcasSugestao(html)) return html;
  const aceitar = acao === 'aceitar';
  return String(html)
    .replace(RE_GHOST, '').replace(RE_INS, aceitar ? '$1' : '')
    .replace(RE_DEL, aceitar ? '' : '$1');
}

// ───────────────────────────── Tokens ─────────────────────────────

/** Tokens: tags HTML (atômicas), espaços e palavras. */
export function tokenizarHtml(html) {
  const re = /<[^>]+>|\s+|[^\s<]+/g;
  const out = [];
  let m;
  const s = String(html ?? '');
  while ((m = re.exec(s)) !== null) {
    const v = m[0];
    out.push({ v, tag: v[0] === '<' && v.length > 1, esp: !(v[0] === '<' && v.length > 1) && /^\s+$/.test(v) });
  }
  return out;
}

// ───────────────────────────── Myers ─────────────────────────────

const LIMITE_D = 2500; // acima disso o trecho central é marcado inteiro (evita memória O(D²) explosiva)

/**
 * Caminho mínimo de edição (Myers O(ND)) entre inteiros `a` e `b`.
 * Retorna `{ delA, insB }` (Uint8Array de flags) ou `null` se D excedeu o limite.
 */
function myers(a, b) {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, LIMITE_D);
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  let achou = -1;

  for (let d = 0; d <= max && achou < 0; d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { achou = d; break; }
    }
  }
  if (achou < 0) return null;

  const delA = new Uint8Array(n);
  const insB = new Uint8Array(m);
  let x = n;
  let y = m;
  for (let d = achou; d > 0; d--) {
    const snap = trace[d];
    const get = (kk) => snap[kk + d + 1];
    const k = x - y;
    const prevK = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
    const prevX = get(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { x--; y--; }
    if (x === prevX) insB[prevY] = 1; else delA[prevX] = 1;
    x = prevX;
    y = prevY;
  }
  return { delA, insB };
}

/**
 * Diff de duas sequências de strings. Antes do Myers, descarta prefixo e sufixo comuns
 * (o caso típico de revisão: poucas palavras alteradas em um texto longo).
 * @returns {{delA:Uint8Array, insB:Uint8Array}}
 */
export function diffSequencias(a, b) {
  const n = a.length;
  const m = b.length;
  const delA = new Uint8Array(n);
  const insB = new Uint8Array(m);

  let ini = 0;
  while (ini < n && ini < m && a[ini] === b[ini]) ini++;
  let fimA = n;
  let fimB = m;
  while (fimA > ini && fimB > ini && a[fimA - 1] === b[fimB - 1]) { fimA--; fimB--; }

  if (fimA === ini) { insB.fill(1, ini, fimB); return { delA, insB }; }
  if (fimB === ini) { delA.fill(1, ini, fimA); return { delA, insB }; }

  // internar strings → inteiros (comparação O(1) no núcleo do Myers)
  const mapa = new Map();
  const id = (s) => { let i = mapa.get(s); if (i === undefined) { i = mapa.size; mapa.set(s, i); } return i; };
  const ia = new Int32Array(fimA - ini);
  const ib = new Int32Array(fimB - ini);
  for (let i = ini; i < fimA; i++) ia[i - ini] = id(a[i]);
  for (let j = ini; j < fimB; j++) ib[j - ini] = id(b[j]);

  const r = myers(ia, ib);
  if (!r) {
    delA.fill(1, ini, fimA);
    insB.fill(1, ini, fimB);
    return { delA, insB };
  }
  for (let i = 0; i < r.delA.length; i++) if (r.delA[i]) delA[ini + i] = 1;
  for (let j = 0; j < r.insB.length; j++) if (r.insB[j]) insB[ini + j] = 1;
  return { delA, insB };
}

// ───────────────────────────── Diff de HTML ─────────────────────────────

/**
 * Reescreve os tokens envolvendo as corridas alteradas em `<span class="classe">`.
 * Tags nunca ficam dentro do span (fecha antes de emitir a tag), então o HTML continua bem aninhado.
 */
function renderizarMarcado(tokens, flags, classe) {
  let html = '';
  let aberto = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.tag) {
      if (aberto) { html += '</span>'; aberto = false; }
      html += t.v;
      continue;
    }
    if (flags[i]) {
      if (!aberto) { html += `<span class="${classe}">`; aberto = true; }
      html += t.v;
    } else {
      // espaço entre duas palavras alteradas faz parte da corrida (evita "picotar" o realce)
      if (aberto && t.esp && flags[i + 1] === 1 && !tokens[i + 1]?.tag) { html += t.v; continue; }
      if (aberto) { html += '</span>'; aberto = false; }
      html += t.v;
    }
  }
  if (aberto) html += '</span>';
  return html;
}

const conta = (tokens, flags) => {
  let n = 0;
  for (let i = 0; i < tokens.length; i++) if (flags[i] && !tokens[i].tag && !tokens[i].esp) n++;
  return n;
};

/**
 * Compara dois HTMLs: devolve cada um com as alterações realçadas.
 * Remoções aparecem em `original` (`ath-diff-del`), adições em `proposta` (`ath-diff-add`).
 */
export function compararHtml(original, proposta) {
  const a = tokenizarHtml(original);
  const b = tokenizarHtml(proposta);
  const { delA, insB } = diffSequencias(a.map(t => t.v), b.map(t => t.v));
  const remocoes = conta(a, delA);
  const adicoes = conta(b, insB);
  return {
    original: renderizarMarcado(a, delA, 'ath-diff-del'),
    proposta: renderizarMarcado(b, insB, 'ath-diff-add'),
    remocoes,
    adicoes,
    mudou: remocoes + adicoes > 0
  };
}

// ───────────────────────────── Versões do documento ─────────────────────────────

function blocoTemMarcas(b) {
  return b && typeof b.texto === 'string' && temMarcasSugestao(b.texto);
}

function algumBlocoTemMarcas(doc) {
  return (doc?.secoes || []).some(s => (s.blocos || []).some(blocoTemMarcas));
}

/** Clone raso: só os blocos com marcas são copiados (imagens grandes e demais blocos são compartilhados). */
function clonarComTextos(doc, mapear) {
  const clone = {
    ...doc,
    secoes: (doc.secoes || []).map(s => ({
      ...s,
      blocos: (s.blocos || []).map(b => (blocoTemMarcas(b) ? { ...b, texto: mapear(b) } : b))
    }))
  };
  delete clone.paginas;
  repaginarDocumento(clone);
  return clone;
}

/**
 * Documento com TODAS as sugestões resolvidas (sem tocar no original). Sem sugestões pendentes,
 * devolve o próprio documento: custo zero no caso comum. Usado pela leitura fiel e pelas exportações.
 */
export function documentoComSugestoesResolvidas(doc, acao = 'aceitar') {
  if (!algumBlocoTemMarcas(doc)) return doc;
  return clonarComTextos(doc, b => resolverSugestoesEmHtml(b.texto, acao));
}

/** As duas versões comparáveis: original (tudo rejeitado) e proposta (tudo aceito). */
export function versoesDoDocumento(doc) {
  if (!algumBlocoTemMarcas(doc)) return { original: doc, proposta: doc, alterados: false };
  return {
    original: clonarComTextos(doc, b => resolverSugestoesEmHtml(b.texto, 'rejeitar')),
    proposta: clonarComTextos(doc, b => resolverSugestoesEmHtml(b.texto, 'aceitar')),
    alterados: true
  };
}

/**
 * Compara original × proposta por bloco (os blocos têm o mesmo id nas duas versões; só o texto muda)
 * e devolve as duas versões já com as alterações realçadas, mais as estatísticas.
 * Só os blocos que realmente diferem passam pelo diff.
 */
export function compararDocumento(doc) {
  const { original, proposta, alterados } = versoesDoDocumento(doc);
  const stats = { adicoes: 0, remocoes: 0, blocosAlterados: 0, idsAlterados: [] };
  if (!alterados) return { original, proposta, stats };

  const orig = original;
  const prop = proposta;
  orig.secoes.forEach((sec, si) => {
    (sec.blocos || []).forEach((bo, bi) => {
      const bp = prop.secoes[si]?.blocos?.[bi];
      if (!bp || bo === bp || typeof bo.texto !== 'string' || bo.texto === bp.texto) return;
      const r = compararHtml(bo.texto, bp.texto);
      if (!r.mudou) return;
      bo.texto = r.original;
      bp.texto = r.proposta;
      stats.adicoes += r.adicoes;
      stats.remocoes += r.remocoes;
      stats.blocosAlterados++;
      stats.idsAlterados.push(bo.id);
    });
  });
  // As folhas guardam referências aos blocos: reconstrói após substituir os textos realçados
  delete orig.paginas;
  delete prop.paginas;
  repaginarDocumento(orig);
  repaginarDocumento(prop);
  return { original: orig, proposta: prop, stats };
}

/** CSS do realce de diff (remoção = vermelho/tachado na original; adição = verde na proposta). */
export const CSS_DIFF = `
.ath-diff-del{background:#FEE2E2;color:#991B1B;text-decoration:line-through;text-decoration-color:#DC2626;border-radius:3px;box-shadow:0 0 0 1px #FCA5A5}
.ath-diff-add{background:#DCFCE7;color:#166534;border-radius:3px;box-shadow:0 0 0 1px #86EFAC}
`;
