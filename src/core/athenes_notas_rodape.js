// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Notas de rodapé (footnotes): modelo, marcadores, medição e divisão de notas longas.
 *
 * Modelo (serializável):
 *  - `documento.notasRodape[]`: `{ id, html, criadoEm }`  — o conteúdo (footnoteContent), com formatação básica e links.
 *  - No texto do bloco (HTML), o marcador (footnoteRef):
 *      `<sup class="ath-nota-ref" data-nota="ID" contenteditable="false">1</sup>`
 *    O texto visível do marcador é CALCULADO a cada paginação/exportação (renumeração automática em cascata);
 *    o valor armazenado é só um espaço reservado.
 *  - `documento.notas_config`: estilo do marcador, reinício, separador e tipografia das notas.
 *  - Por página (calculado): `pagina.notas[]` (segmentos) e `pagina.rotulosNotas` (id → marcador).
 *
 * Sem DOM e sem dependências de runtime: roda no navegador e no Node.
 */

import { tokenizarHtml } from './athenes_diff.js';

export const SIMBOLOS_NOTA = Object.freeze(['*', '†', '‡', '§', '‖', '¶']);

/** Como o marcador aparece, no texto e no rodapé: 1 | [1] | (1) | 1) | 1. */
export const FORMATOS_MARCADOR_NOTA = Object.freeze([
  { id: 'simples', rotulo: 'Só o número', exemplo: '1' },
  { id: 'colchetes', rotulo: 'Entre colchetes', exemplo: '[1]' },
  { id: 'parenteses', rotulo: 'Entre parênteses', exemplo: '(1)' },
  { id: 'parentese_direito', rotulo: 'Com parêntese', exemplo: '1)' },
  { id: 'ponto', rotulo: 'Com ponto', exemplo: '1.' }
]);

export const NOTAS_CONFIG_PADRAO = Object.freeze({
  marcador: 'numerico',          // 'numerico' | 'alfabetico' | 'simbolos'
  formato: 'simples',            // ver FORMATOS_MARCADOR_NOTA
  marcador_texto: Object.freeze({ fonte: '', cor: '', negrito: true }),   // marcador dentro do texto ('' = herda do texto)
  marcador_nota: Object.freeze({ fonte: '', cor: '', negrito: true }),    // marcador no rodapé ('' = herda da nota)
  reiniciar: 'documento',        // 'documento' | 'secao' | 'pagina'
  separador: Object.freeze({ comprimento_pct: 33, espessura_pt: 0.75, cor: '#64748B' }),
  fonte: 'nunito',
  tamanho_pt: 10,
  entrelinha: 1.15,
  cor: '#334155'
});

const NUM = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

/** Estilo de um marcador (fonte, cor, negrito, sobrescrito). Entre colchetes/parênteses o padrão é na linha do texto, não sobrescrito. */
function marcadorEstilo(m, padrao, formatado) {
  const x = m && typeof m === 'object' ? m : {};
  return {
    fonte: typeof x.fonte === 'string' && /^[\w-]{0,32}$/.test(x.fonte) ? x.fonte : padrao.fonte,
    cor: /^#[0-9a-f]{3,8}$/i.test(x.cor || '') ? x.cor : padrao.cor,
    negrito: typeof x.negrito === 'boolean' ? x.negrito : padrao.negrito,
    sobrescrito: typeof x.sobrescrito === 'boolean' ? x.sobrescrito : !formatado
  };
}

/** Configuração efetiva das notas (sem mutar o documento). */
export function obterConfigNotas(doc) {
  const c = doc?.notas_config && typeof doc.notas_config === 'object' ? doc.notas_config : {};
  const s = c.separador && typeof c.separador === 'object' ? c.separador : {};
  const d = NOTAS_CONFIG_PADRAO;
  return {
    marcador: ['numerico', 'alfabetico', 'simbolos'].includes(c.marcador) ? c.marcador : d.marcador,
    reiniciar: ['documento', 'secao', 'pagina'].includes(c.reiniciar) ? c.reiniciar : d.reiniciar,
    formato: FORMATOS_MARCADOR_NOTA.some(f => f.id === c.formato) ? c.formato : d.formato,
    marcador_texto: marcadorEstilo(c.marcador_texto, d.marcador_texto, FORMATOS_MARCADOR_NOTA.some(f => f.id === c.formato) && c.formato !== 'simples'),
    marcador_nota: marcadorEstilo(c.marcador_nota, d.marcador_nota, FORMATOS_MARCADOR_NOTA.some(f => f.id === c.formato) && c.formato !== 'simples'),
    separador: {
      comprimento_pct: NUM(s.comprimento_pct, 5, 100, d.separador.comprimento_pct),
      espessura_pt: NUM(s.espessura_pt, 0.25, 4, d.separador.espessura_pt),
      cor: /^#[0-9a-f]{3,8}$/i.test(s.cor || '') ? s.cor : d.separador.cor
    },
    fonte: typeof c.fonte === 'string' && /^[\w-]{1,32}$/.test(c.fonte) ? c.fonte : d.fonte,
    tamanho_pt: NUM(c.tamanho_pt, 6, 16, d.tamanho_pt),
    entrelinha: NUM(c.entrelinha, 1, 2, d.entrelinha),
    cor: /^#[0-9a-f]{3,8}$/i.test(c.cor || '') ? c.cor : d.cor
  };
}

/** Texto do marcador: 1, 2, 3 | a, b … z, aa | *, †, ‡, §, ‖, ¶, **, †† … (índice 1-based). */
export function textoMarcadorNota(indice, estilo = 'numerico', formato = 'simples') {
  const base = textoBaseMarcador(indice, estilo);
  switch (formato) {
    case 'colchetes': return `[${base}]`;
    case 'parenteses': return `(${base})`;
    case 'parentese_direito': return `${base})`;
    case 'ponto': return `${base}.`;
    default: return base;
  }
}

function textoBaseMarcador(indice, estilo) {
  const n = Math.max(1, parseInt(indice, 10) || 1);
  if (estilo === 'alfabetico') {
    let k = n; let s = '';
    while (k > 0) { k--; s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); }
    return s;
  }
  if (estilo === 'simbolos') {
    const base = SIMBOLOS_NOTA[(n - 1) % SIMBOLOS_NOTA.length];
    return base.repeat(Math.floor((n - 1) / SIMBOLOS_NOTA.length) + 1);
  }
  return String(n);
}

// ───────────────────────────── Registro e marcadores ─────────────────────────────

export function garantirNotas(doc) {
  if (!Array.isArray(doc.notasRodape)) doc.notasRodape = [];
  return doc.notasRodape;
}

export function criarNotaRodape(doc, html = '') {
  const lista = garantirNotas(doc);
  const nota = { id: 'nt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), html: String(html), criadoEm: new Date().toISOString() };
  lista.push(nota);
  return nota;
}

export const obterNota = (doc, id) => (doc?.notasRodape || []).find(n => n.id === id) || null;

/** HTML do marcador inline (footnoteRef). */
export function htmlMarcadorNota(id) {
  return `<sup class="ath-nota-ref" data-nota="${String(id).replace(/[^\w-]/g, '')}" contenteditable="false">*</sup>`;
}

const RE_ID = /<sup\b[^>]*\bath-nota-ref\b[^>]*\bdata-nota="([\w-]+)"[^>]*>|<sup\b[^>]*\bdata-nota="([\w-]+)"[^>]*\bath-nota-ref\b[^>]*>/gi;

/** Ids das notas referenciadas em um HTML, na ordem de aparição. */
export function extrairIdsNotas(html) {
  if (typeof html !== 'string' || !html.includes('ath-nota-ref')) return [];
  const ids = [];
  let m;
  RE_ID.lastIndex = 0;
  while ((m = RE_ID.exec(html)) !== null) ids.push(m[1] || m[2]);
  return ids;
}

/** Ids referenciados por um bloco (texto de parágrafo/título/citação…). */
export const idsNotasDoBloco = (b) => (b && typeof b.texto === 'string' ? extrairIdsNotas(b.texto) : []);

/** Troca o texto visível de cada marcador pelo rótulo calculado (id → rótulo). */
export function aplicarRotulosNotasHtml(html, rotulos) {
  if (typeof html !== 'string' || !html.includes('ath-nota-ref')) return html;
  return html.replace(/(<sup\b[^>]*\bath-nota-ref\b[^>]*>)([\s\S]*?)(<\/sup>)/gi, (m, abre, _meio, fecha) => {
    const id = /data-nota="([\w-]+)"/.exec(abre)?.[1];
    return rotulos && id in rotulos ? `${abre}${rotulos[id]}${fecha}` : m;
  });
}

/** Remove notas sem marcador no texto (limpeza explícita; a paginação já ignora as órfãs). */
export function podarNotasOrfas(doc) {
  const usados = new Set();
  for (const s of doc.secoes || []) for (const b of s.blocos || []) idsNotasDoBloco(b).forEach(i => usados.add(i));
  const antes = (doc.notasRodape || []).length;
  doc.notasRodape = (doc.notasRodape || []).filter(n => usados.has(n.id));
  return antes - doc.notasRodape.length;
}

// ───────────────────────────── Medição ─────────────────────────────

export const PT_POR_MM = 2.83465;

const textoPuro = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, 'x');

/** Linhas ocupadas por `html` com `cpl` caracteres por linha (o prefixo do marcador conta). */
export function linhasDaNota(html, cpl, prefixo = 3) {
  return Math.max(1, Math.ceil((textoPuro(html).length + prefixo) / Math.max(10, cpl)));
}

export function caracteresPorLinha(larguraPt, tamanhoPt) {
  return Math.max(10, Math.floor(larguraPt / (tamanhoPt * 0.5)));
}

/** Altura (pt) de um segmento de nota: linhas × entrelinha + respiro entre notas. */
export function alturaSegmentoPt(html, cfg, larguraPt) {
  const linhaPt = cfg.tamanho_pt * cfg.entrelinha;
  return linhasDaNota(html, caracteresPorLinha(larguraPt, cfg.tamanho_pt)) * linhaPt + 2;
}

/** Altura do traço separador + respiros (aparece uma vez por página que tem notas). */
export function alturaSeparadorPt(cfg) {
  return cfg.separador.espessura_pt + 8;
}

// ───────────────────────────── Divisão de notas longas ─────────────────────────────

const VOID = new Set(['br', 'hr', 'img', 'wbr']);

/**
 * Divide um HTML em dois, no limite de palavra mais próximo de `n` caracteres de texto, fechando as tags
 * abertas no trecho inicial e reabrindo-as no final (o resultado continua bem formado).
 * @returns {[string,string]} [início, restante]; restante vazio se `n` cobre todo o texto
 */
export function dividirHtmlPorCaracteres(html, n) {
  const tokens = tokenizarHtml(html);
  let usados = 0;
  let corte = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.tag) continue;
    if (usados + t.v.length > n && !t.esp) { corte = i; break; }
    usados += t.v.length;
  }
  if (corte >= tokens.length) return [html, ''];
  if (corte === 0) return ['', html];

  const pilha = [];
  for (let i = 0; i < corte; i++) {
    const t = tokens[i];
    if (!t.tag) continue;
    const nome = /^<\/?\s*([a-z0-9]+)/i.exec(t.v)?.[1]?.toLowerCase();
    if (!nome || VOID.has(nome) || t.v.endsWith('/>')) continue;
    if (t.v[1] === '/') { const k = pilha.map(p => p.nome).lastIndexOf(nome); if (k >= 0) pilha.splice(k, 1); }
    else pilha.push({ nome, abre: t.v });
  }
  const inicio = tokens.slice(0, corte).map(t => t.v).join('').replace(/\s+$/, '') + [...pilha].reverse().map(p => `</${p.nome}>`).join('');
  const resto = pilha.map(p => p.abre).join('') + tokens.slice(corte).map(t => t.v).join('').replace(/^\s+/, '');
  return [inicio, resto];
}

/**
 * Ajusta as notas de uma página ao espaço disponível. As que não cabem continuam no topo da página seguinte
 * (a nota é dividida entre as páginas quando há ao menos 2 linhas em cada lado).
 * @param {{id:string, html:string, continuaDaAnterior?:boolean}[]} segmentos
 * @param {number} espacoPt  altura disponível para as notas (inclui o separador)
 * @returns {{visiveis:object[], resto:object[]}}
 */
export function ajustarNotasAoEspaco(segmentos, espacoPt, cfg, larguraPt) {
  if (!segmentos.length) return { visiveis: [], resto: [] };
  const linhaPt = cfg.tamanho_pt * cfg.entrelinha;
  const cpl = caracteresPorLinha(larguraPt, cfg.tamanho_pt);
  let restante = espacoPt - alturaSeparadorPt(cfg);
  const visiveis = [];
  const resto = [];

  for (let i = 0; i < segmentos.length; i++) {
    const seg = segmentos[i];
    const h = alturaSegmentoPt(seg.html, cfg, larguraPt);
    if (h <= restante || (visiveis.length === 0 && restante < linhaPt * 2 && false)) {
      visiveis.push(seg);
      restante -= h;
      continue;
    }
    const linhasTotais = linhasDaNota(seg.html, cpl);
    const linhasCabem = Math.floor((restante - 2) / linhaPt);
    // divide só se ficam ≥2 linhas aqui e ≥2 na próxima (evita linha órfã/viúva)
    if (linhasCabem >= 2 && linhasTotais - linhasCabem >= 2) {
      const [ini, fim] = dividirHtmlPorCaracteres(seg.html, Math.max(1, linhasCabem * cpl - 3));
      if (ini && fim) {
        visiveis.push({ ...seg, html: ini, continua: true });
        resto.push({ id: seg.id, html: fim, continuaDaAnterior: true }, ...segmentos.slice(i + 1));
        return { visiveis, resto };
      }
    }
    resto.push(...segmentos.slice(i));
    return { visiveis, resto };
  }
  return { visiveis, resto };
}

// ───────────────────────────── Rótulos ─────────────────────────────

/**
 * Atribui o marcador de cada nota (`pagina.rotulosNotas`) conforme `notas_config`:
 * numeração contínua no documento, reiniciada por seção ou por página.
 */
export function rotularNotas(doc, paginas) {
  const cfg = obterConfigNotas(doc);
  let contador = 0;
  let secaoAnterior = null;
  for (const pag of paginas) {
    if (cfg.reiniciar === 'pagina' || (cfg.reiniciar === 'secao' && pag.secaoId !== secaoAnterior)) contador = 0;
    secaoAnterior = pag.secaoId;
    const rotulos = {};
    for (const seg of pag.notas || []) {
      if (seg.continuaDaAnterior || seg.id in rotulos) continue;
      contador++;
      rotulos[seg.id] = textoMarcadorNota(contador, cfg.marcador, cfg.formato);
    }
    pag.rotulosNotas = rotulos;
  }
  return paginas;
}

/** Mapa id → rótulo de todo o documento (para exportações lineares como DOCX). */
export function mapaRotulosDocumento(paginas) {
  const mapa = {};
  for (const pag of paginas) Object.assign(mapa, pag.rotulosNotas || {});
  return mapa;
}

// ───────────────────────────── Conteúdo seguro e remoção ─────────────────────────────

const TAGS_PERMITIDAS = new Set(['b', 'strong', 'i', 'em', 'u', 'sub', 'sup', 'br', 'a']);
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Conteúdo de nota: só formatação básica (negrito, itálico, sublinhado, sub/sobrescrito, quebra) e links
 * http(s)/mailto. Demais tags são descartadas (o texto interno permanece) e atributos são removidos.
 */
export function sanitizarHtmlNota(html) {
  const saida = [];
  const anchorsDescartados = [];
  for (const t of tokenizarHtml(String(html ?? ''))) {
    if (!t.tag) { saida.push(t.v); continue; }
    const m = /^<\s*(\/?)\s*([a-z0-9]+)/i.exec(t.v);
    const nome = m?.[2]?.toLowerCase();
    if (!m || !TAGS_PERMITIDAS.has(nome)) continue;
    if (m[1]) {
      if (nome === 'a' && anchorsDescartados.pop()) continue;
      saida.push(`</${nome}>`);
      continue;
    }
    if (nome === 'a') {
      const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(t.v);
      const url = (href?.[1] ?? href?.[2] ?? '').trim();
      if (/^(https?:\/\/|mailto:)/i.test(url)) { anchorsDescartados.push(false); saida.push(`<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">`); }
      else anchorsDescartados.push(true);
      continue;
    }
    saida.push(nome === 'br' ? '<br>' : `<${nome}>`);
  }
  return saida.join('');
}

/** Exclui a nota e todos os marcadores que a referenciam; devolve quantos marcadores foram removidos. */
export function removerNota(doc, id) {
  let removidos = 0;
  const re = new RegExp(String.raw`<sup\b[^>]*\bath-nota-ref\b[^>]*data-nota="${String(id).replace(/[^\w-]/g, '')}"[^>]*>[\s\S]*?<\/sup>`, 'gi');
  for (const s of doc.secoes || []) {
    for (const b of s.blocos || []) {
      if (typeof b.texto === 'string' && b.texto.includes(id)) {
        b.texto = b.texto.replace(re, () => { removidos++; return ''; });
      }
    }
  }
  doc.notasRodape = (doc.notasRodape || []).filter(n => n.id !== id);
  return removidos;
}

/**
 * CSS dos marcadores das notas: o do texto (`sup.ath-nota-ref`) e o do rodapé (`.ath-nota-num`), com fonte, cor, negrito e
 * sobrescrito vindos de `notas_config`. `escopo` (ex.: '#rmPrevPalco ') aumenta a especificidade no editor.
 */
export function cssMarcadoresNota(cfg, escopo = '', familiaDe = () => '') {
  const regra = (seletor, m, base) => {
    const p = [];
    if (m.fonte) { const f = familiaDe(m.fonte); if (f) p.push(`font-family:${f}`); }
    if (m.cor) p.push(`color:${m.cor}`);
    p.push(`font-weight:${m.negrito ? 700 : 400}`);
    if (!m.sobrescrito) p.push(...base.linha);
    else p.push(...base.sobre);
    return `${escopo}${seletor}{${p.join(';')}}`;
  };
  return [
    regra('sup.ath-nota-ref', cfg.marcador_texto, { linha: ['vertical-align:baseline', 'font-size:1em', 'line-height:inherit'], sobre: ['vertical-align:super', 'font-size:.75em', 'line-height:0'] }),
    regra('.ath-nota-num', cfg.marcador_nota, { linha: ['font-size:1em', 'position:static', 'top:0', 'vertical-align:baseline', 'min-width:0'], sobre: ['font-size:.75em', 'position:relative', 'top:-.35em', 'vertical-align:super'] })
  ].join('\n');
}
