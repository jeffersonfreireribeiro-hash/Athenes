// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Renderização HTML (unidades em mm) dos elementos livres de folhas mestras. Um único
 * renderizador serve o editor de mestras, o editor de páginas e a exportação PDF, garantindo que o
 * que se vê ao arrastar é o que sai no papel. Módulo puro (gera strings).
 */

import {
  elementosEfetivosDaPagina, resolverVariaveisTexto, espelharElemento, normalizarElemento, TIPOS_LIVRES
} from './athenes_mestra_canvas.js';

/** Tipos desenhados por este módulo (os demais legados seguem nos renderizadores originais). */
export function renderizadoPeloCanvas(el) {
  return TIPOS_LIVRES.includes(el.tipo) || el.tipo === 'foto_capa' || (el.tipo === 'caixa_grade' && el.posicionamento_modo === 'coordenadas');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function caixaCss(el, { larguraMm, alturaMm, margens }) {
  let x = el.x_mm; let y = el.y_mm; let w = el.largura_mm; let h = el.altura_mm;
  if (el.sangria) { x = 0; y = 0; w = larguraMm; h = alturaMm; }
  else if (el.tipo === 'foto_capa' && el.respeitar_recuo) { x = margens.l + (el.x_mm || 0); w = larguraMm - margens.l - margens.r; }
  const rot = el.rotacao_graus ? `transform:rotate(${el.rotacao_graus}deg);transform-origin:50% 50%;` : '';
  return `position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;box-sizing:border-box;${rot}`;
}

/** HTML de um elemento já resolvido (override/espelhamento aplicados). */
export function elementoMestraHtml(el, geo, ctx = {}, { editor = false } = {}) {
  const base = caixaCss(el, geo);
  const z = `z-index:${el.camada === 'fundo' ? 0 : 4};`;
  const dado = editor ? ` data-elem-id="${esc(el.id)}"` : '';
  const op = el.opacidade !== undefined ? `opacity:${el.opacidade};` : '';
  if (el.tipo === 'forma') {
    const borda = el.forma === 'linha' ? '' : `border:${el.borda_mm ?? 0.3}mm solid ${el.borda_cor || '#314F79'};`;
    const raio = el.forma === 'elipse' ? 'border-radius:50%;' : (el.raio_mm ? `border-radius:${el.raio_mm}mm;` : '');
    if (el.forma === 'linha') {
      return `<div${dado} style="${base}${z}${op}height:${el.altura_mm}mm;"><div style="position:absolute;left:0;right:0;top:50%;border-top:${el.borda_mm ?? 0.3}mm solid ${el.borda_cor || '#314F79'};"></div></div>`;
    }
    return `<div${dado} style="${base}${z}${op}${borda}${raio}background:${el.fundo || 'transparent'};"></div>`;
  }
  if (el.tipo === 'texto') {
    const texto = esc(resolverVariaveisTexto(el.texto, ctx)).replace(/\n/g, '<br>');
    const just = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'justify' }[el.alinhamento] || 'left';
    const fonte = el.fonte ? `font-family:${el.fonte};` : '';
    return `<div${dado} style="${base}${z}${op}overflow:hidden;font-size:${el.tamanho_pt || 10}pt;line-height:1.25;color:${el.cor || '#314F79'};font-weight:${el.negrito ? 800 : 400};text-align:${just};${fonte}">${texto}</div>`;
  }
  if (el.tipo === 'quadro_texto') {
    // moldura-guia: só aparece no editor de mestras; no papel é apenas a região de fluxo do corpo
    if (!editor) return '';
    return `<div${dado} style="${base}z-index:3;border:0.3mm dashed #314F79;background:rgba(49,79,121,0.04);color:#314F79;font:700 8pt sans-serif;padding:1.5mm;pointer-events:auto;">¶ ${esc(el.titulo || 'Quadro de texto principal')}${el.colunas > 1 ? ` · ${el.colunas} colunas` : ''}</div>`;
  }
  if (el.tipo === 'foto_capa') {
    const interno = el.url
      ? `<img src="${esc(el.url)}" style="width:100%;height:100%;object-fit:${el.ajuste || 'cover'};display:block;opacity:${el.opacidade ?? 1};">`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#EEF4FA,#D5E3F0);display:flex;align-items:center;justify-content:center;color:#314F79;font:700 9pt sans-serif;">Foto de capa</div>`;
    return `<div${dado} style="${base}${z}overflow:hidden;">${interno}</div>`;
  }
  // caixa_grade em coordenadas
  const cor = el.cor || '#314F79';
  return `<div${dado} style="${base}${z}border:0.26mm solid ${cor};background:${el.fundo || 'rgba(49,79,121,0.05)'};border-radius:1mm;">${editor ? `<span style="font:700 7.5pt sans-serif;color:${cor};padding:1mm;display:block;">${esc(el.titulo || 'Moldura')}</span>` : ''}</div>`;
}

/**
 * Todos os elementos livres/coordenados de uma mestra para uma página (herança + overrides + espelho).
 * `pagina` pode ser null no editor de mestras. Retorna HTML (concatenado, na ordem de empilhamento).
 */
export function elementosMestraHtml(mestra, pagina, geo, ctx = {}, opcoes = {}) {
  const numero = pagina?.numero ?? ctx.pagina ?? 1;
  const verso = !!mestra?.espelhada && numero % 2 === 0;
  return elementosEfetivosDaPagina(mestra, pagina)
    .filter(renderizadoPeloCanvas)
    .filter(e => e.visivel !== false)
    .map(e => {
      const n = normalizarElemento({ ...e });
      return elementoMestraHtml(verso ? espelharElemento(n, geo.larguraMm) : n, geo, ctx, opcoes);
    }).join('\n');
}

/** Contexto de variáveis de uma página (mesmos nomes de {documento.*}, {secao}, {pagina}, {total}). */
export function contextoVariaveisPagina(doc, pag, total) {
  const sec = (doc.secoes || []).find(s => s.id === pag?.secaoId);
  return {
    pagina: pag?.numeroExibido ?? pag?.numero ?? 1, total: total ?? (doc.paginas || []).length, secao: sec?.nome || '',
    documento: {
      titulo: doc.titulo, subtitulo: doc.subtitulo, autor_principal: doc.metadados?.autores?.[0]?.nome,
      instituicao: doc.metadados?.instituicao, ano: doc.metadados?.ano || String(new Date().getFullYear())
    }
  };
}
