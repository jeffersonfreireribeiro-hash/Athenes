// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Figuras por código: orquestra SVG, HTML+CSS, Mermaid e gráficos JSON.
 *
 * Módulo puro (sem DOM). O editor, a prévia do modal, o PDF e o DOCX usam os MESMOS renderizadores, então
 * o que se vê no canvas é o que sai na exportação. Tudo é sanitizado (ver athenes_marcacao_segura.js).
 *
 *   renderizarItemVetorial(item, {tema, uid})  → SVG sanitizado (svg_code, mermaid_code, chart_json)
 *   renderizarItemHtml(item, {uid})            → { html, css, escopo } sanitizados e escopados (html_code)
 *   validarCodigoFigura(sourceType, codigo)    → { ok, erros:[{linha,mensagem}], avisos }
 *   formatarCodigoFigura(sourceType, codigo)   → código indentado
 */

import { sanitizarSvg, sanitizarHtml, formatarMarcacao } from './athenes_marcacao_segura.js';
import { renderizarMermaid, validarMermaid, formatarMermaid, EXEMPLOS_MERMAID } from './athenes_mermaid.js';
import { renderizarGraficoJson, validarGraficoJson, formatarGraficoJson, criarTemaVisual, EXEMPLOS_GRAFICO } from './athenes_grafico_json.js';
import { fonteDoItem, obterConfigFigura, FUNDOS_CODIGO_CSS } from './athenes_figura_layout.js';
import { FONTES_SISTEMA } from './athenes_estilos.js';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Prefixo de ids/escopo CSS único por item (evita colisão entre figuras e vazamento de estilo). */
export function uidDoItem(bloco, idx = 0) {
  const base = String(bloco?.id || 'fig').replace(/[^\w-]/g, '');
  return `f${base}_${idx}`;
}
export const escopoCssDoItem = (uid) => `[data-ath-esc="${uid}"]`;

/**
 * Tema visual herdado do documento: tipografia do estilo de corpo, cor primária e paleta da figura.
 * @param {{estilos?:object[], cor_primaria?:string}} doc
 * @param {object} bloco  usa `codigo_paleta`
 */
export function temaVisualDoDocumento(doc, bloco) {
  const cfg = obterConfigFigura(bloco || {});
  const corpo = (doc?.estilos || []).find(e => e.id === 'corpo') || (doc?.estilos || [])[0];
  const familia = FONTES_SISTEMA[corpo?.fonte]?.familia || 'Arial, Helvetica, sans-serif';
  const prim = [doc?.cor_primaria, doc?.tema?.cor_primaria].find(c => HEX.test(c || '')) || '#314F79';
  const texto = HEX.test(corpo?.cor || '') && corpo.cor.toLowerCase() !== '#000000' ? corpo.cor : '#1F2733';
  return criarTemaVisual({ fonte: familia, corPrimaria: prim, corTexto: texto, paleta: cfg.codigo_paleta });
}

const cacheGeracao = new Map();
function comCache(chave, fn) {
  if (cacheGeracao.has(chave)) return cacheGeracao.get(chave);
  const r = fn();
  if (cacheGeracao.size > 150) cacheGeracao.clear();
  cacheGeracao.set(chave, r);
  return r;
}

/**
 * Converte um item vetorial em SVG sanitizado.
 * @returns {{ok:boolean, svg:string, largura:number, altura:number, erros:object[], avisos:string[], fonte:string}}
 */
export function renderizarItemVetorial(item, { tema, uid = 'f0_0' } = {}) {
  const { sourceType, content } = fonteDoItem(item);
  const t = tema || criarTemaVisual();
  const prefixoId = `${uid}-`;
  let bruto;
  if (sourceType === 'svg_code') {
    return { ...sanitizarSvg(content, { prefixoId, escopoCss: escopoCssDoItem(uid) }), fonte: sourceType };
  } else if (sourceType === 'mermaid_code') {
    bruto = comCache(`m|${t.fonte}|${t.cor}|${t.nome_paleta}|${content}`, () => renderizarMermaid(content, t));
  } else if (sourceType === 'chart_json') {
    bruto = comCache(`c|${t.fonte}|${t.cor}|${t.nome_paleta}|${content}`, () => renderizarGraficoJson(content, t));
  } else {
    return { ok: false, svg: '', largura: 0, altura: 0, erros: [{ linha: 1, mensagem: 'Fonte não é vetorial.' }], avisos: [], fonte: sourceType };
  }
  if (!bruto.ok) return { ok: false, svg: '', largura: 0, altura: 0, erros: bruto.erros, avisos: bruto.avisos || [], fonte: sourceType };
  const san = sanitizarSvg(bruto.svg, { prefixoId, escopoCss: escopoCssDoItem(uid) });
  return { ok: san.ok, svg: san.svg, largura: san.largura, altura: san.altura, erros: san.erros, avisos: [...(bruto.avisos || []), ...san.avisos], fonte: sourceType };
}

/** HTML+CSS do item, sanitizados e com CSS escopado a `[data-ath-esc=uid]`. */
export function renderizarItemHtml(item, { uid = 'f0_0' } = {}) {
  const { content } = fonteDoItem(item);
  const escopo = escopoCssDoItem(uid);
  const r = sanitizarHtml(content, { escopoCss: escopo, prefixoId: `${uid}-` });
  return { ...r, escopo, uid };
}

/** Valida o código (sintaxe + schema) para o editor: linhas com erro e avisos. */
export function validarCodigoFigura(sourceType, codigo) {
  const src = String(codigo ?? '');
  if (sourceType === 'svg_code') { const r = sanitizarSvg(src); return { ok: r.ok, erros: r.erros, avisos: r.avisos }; }
  if (sourceType === 'html_code') { const r = sanitizarHtml(src); return { ok: r.ok, erros: r.erros, avisos: r.avisos }; }
  if (sourceType === 'mermaid_code') return validarMermaid(src);
  if (sourceType === 'chart_json') { const r = validarGraficoJson(src); return { ok: r.ok, erros: r.erros, avisos: r.avisos }; }
  return { ok: true, erros: [], avisos: [] };
}

export function formatarCodigoFigura(sourceType, codigo) {
  if (sourceType === 'svg_code') return formatarMarcacao(codigo, 'svg');
  if (sourceType === 'html_code') return formatarMarcacao(codigo, 'html');
  if (sourceType === 'mermaid_code') return formatarMermaid(codigo);
  if (sourceType === 'chart_json') return formatarGraficoJson(codigo);
  return String(codigo ?? '');
}

const SVG_EXEMPLO = `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#DCE8F5"/>
      <stop offset="1" stop-color="#314F79"/>
    </linearGradient>
    <marker id="seta" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0 0 L8 4 L0 8 Z" fill="#314F79"/>
    </marker>
  </defs>
  <rect x="10" y="40" width="110" height="80" rx="8" fill="url(#grad)" stroke="#314F79" stroke-width="2"/>
  <circle cx="250" cy="80" r="42" fill="#FFF8DC" stroke="#C9A227" stroke-width="2"/>
  <line x1="120" y1="80" x2="205" y2="80" stroke="#314F79" stroke-width="2" marker-end="url(#seta)"/>
  <text x="65" y="85" text-anchor="middle" font-size="14" fill="#1F2733">Entrada</text>
  <text x="250" y="85" text-anchor="middle" font-size="14" fill="#1F2733">Saída</text>
</svg>`;

const HTML_EXEMPLO = `<style>
  .quadro { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
  .celula { border: 1px solid #314F79; border-radius: 6px; padding: 10px; background: #F8FAFC; }
  .celula h4 { margin: 0 0 4px; color: #314F79; font-size: 14px; }
  .destaque { grid-column: 1 / -1; background: #DCE8F5; }
</style>
<div class="quadro">
  <div class="celula"><h4>Problema</h4>Descreva o problema investigado.</div>
  <div class="celula"><h4>Hipótese</h4>Resposta provisória a ser testada.</div>
  <div class="celula destaque"><h4>Método</h4>Procedimentos, amostra e instrumentos.</div>
</div>`;

/** Código inicial por fonte (modelo editável). */
export function exemploDeCodigo(sourceType) {
  if (sourceType === 'svg_code') return SVG_EXEMPLO;
  if (sourceType === 'html_code') return HTML_EXEMPLO;
  if (sourceType === 'mermaid_code') return EXEMPLOS_MERMAID.flowchart;
  if (sourceType === 'chart_json') return JSON.stringify(EXEMPLOS_GRAFICO.barras, null, 2);
  return '';
}

/** SVG com width/height explícitos (rasterização e uso fora do documento). */
export function svgComDimensoes(svg, largura, altura) {
  return String(svg).replace(/^<svg /, `<svg width="${Math.round(largura)}" height="${Math.round(altura)}" `);
}

/** data URL (UTF-8, vetorial) para <img>, DOCX e downloads. */
export function svgParaDataUrl(svg, largura, altura) {
  const doc = svgComDimensoes(svg, largura, altura);
  const b64 = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(doc)))
    : Buffer.from(doc, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

/** Texto alternativo curto para acessibilidade/DOCX. */
export function textoAlternativoItem(bloco, item) {
  const { sourceType } = fonteDoItem(item);
  const nome = { svg_code: 'Ilustração vetorial', html_code: 'Quadro', mermaid_code: 'Diagrama', chart_json: 'Gráfico', image_url: 'Imagem' }[sourceType];
  return `${nome}${bloco?.titulo ? ': ' + String(bloco.titulo).replace(/<[^>]+>/g, '') : ''}`.slice(0, 250);
}

export { FUNDOS_CODIGO_CSS };

/**
 * Descrição unificada de um item por código para qualquer destino (editor, PDF, DOCX).
 * `tipo`: 'svg' (vetorial pronto) | 'html' | 'erro'.
 */
export function resolverItemCodigo(bloco, item, idx, doc) {
  const { sourceType } = fonteDoItem(item);
  const uid = uidDoItem(bloco, idx);
  if (sourceType === 'html_code') {
    const h = renderizarItemHtml(item, { uid });
    return h.ok ? { tipo: 'html', ...h } : { tipo: 'erro', erros: h.erros, avisos: h.avisos };
  }
  const v = renderizarItemVetorial(item, { tema: temaVisualDoDocumento(doc, bloco), uid });
  return v.ok ? { tipo: 'svg', ...v, uid } : { tipo: 'erro', erros: v.erros, avisos: v.avisos };
}

/** Estilo do contêiner do item por código (proporção/altura do bloco); SVG preenche o contêiner sem cortar. */
export function estiloContainerCodigo(cfg, tipo = 'svg') {
  const comRazao = cfg.proporcao_imagem !== 'livre';
  const comAltura = cfg.altura_modo !== 'auto';
  const css = ['display:block', 'width:100%', 'box-sizing:border-box'];
  if (comRazao) css.push(`aspect-ratio:${cfg.proporcao_imagem}`);
  if (comAltura) css.push(`height:${cfg.altura_modo}`);
  if (tipo === 'html') css.push('overflow:hidden', 'font-size:13px', 'line-height:1.4', 'color:#1F2733');
  else css.push('line-height:0');
  return { css: css.join(';'), preenche: comRazao || comAltura };
}

/**
 * HTML do item por código para PDF/prévia estática. SVG: contêiner + <svg> vetorial; HTML: CSS escopado por atributo.
 * @returns {{ok:boolean, html:string, erros:object[], avisos:string[], tipo:string}}
 */
export function marcacaoItemCodigo(bloco, itemRaw, idx, doc, { alturaMax = '170mm' } = {}) {
  const cfg = obterConfigFigura(bloco);
  const r = resolverItemCodigo(bloco, itemRaw, idx, doc);
  if (r.tipo === 'erro') return { ok: false, html: '', erros: r.erros || [], avisos: r.avisos || [], tipo: 'erro' };
  const alt = String(textoAlternativoItem(bloco, itemRaw)).replace(/"/g, '&quot;');
  if (r.tipo === 'svg') {
    const { css, preenche } = estiloContainerCodigo(cfg, 'svg');
    const svg = injetarNaRaizSvg(r.svg, `display:block;width:100%;height:${preenche ? '100%' : 'auto'};max-height:${alturaMax}`, `role="img" aria-label="${alt}"`);
    return { ok: true, html: `<div data-ath-esc="${r.uid}" class="ath-fig-codigo" style="${css}">${svg}</div>`, erros: [], avisos: r.avisos, tipo: 'svg' };
  }
  const { css } = estiloContainerCodigo(cfg, 'html');
  const estilo = r.css ? `<style>${r.css.replace(/<\/style/gi, '<\/style')}</style>` : '';
  return { ok: true, html: `<div data-ath-esc="${r.uid}" class="ath-fig-codigo ath-fig-html" role="img" aria-label="${alt}" style="${css}">${estilo}${r.html}</div>`, erros: [], avisos: r.avisos, tipo: 'html' };
}

/** Acrescenta `style` (mesclado ao style da raiz, se houver) e atributos extras ao <svg> raiz. */
export function injetarNaRaizSvg(svg, estilo, extras = '') {
  return String(svg).replace(/^<svg([^>]*)>/, (m, attrs) => {
    let mesclado = estilo;
    const sem = attrs.replace(/\sstyle="([^"]*)"/, (mm, v) => { mesclado = `${v.replace(/;?\s*$/, '')};${estilo}`; return ''; });
    // atributos extras só entram se a raiz ainda não os tem (evita duplicar role/aria-label)
    const novos = extras.split(/\s+(?=[\w:-]+=)/).filter(a => a && !new RegExp('\\s' + a.split('=')[0] + '=').test(sem)).join(' ');
    return `<svg${sem} style="${mesclado}"${novos ? ' ' + novos : ''}>`;
  });
}
