// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Utilitários de Segurança, Escape HTML (Prevenção de XSS) e Preservação de Seleção DOM.
 * Atende às recomendações de auditoria (Findings 1, 2 e 3):
 * - escapeHtml / escapeAttr para interpolação segura em template literals;
 * - sanitizarHtmlEditorial para blindar arquivos .athenes/.json importados de terceiros;
 * - gerenciador de Range de seleção restrito ao bloco pai ativo.
 */

/**
 * Escapa caracteres especiais HTML em textos puros e atributos.
 * @param {unknown} valor
 * @returns {string}
 */
export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitiza HTML editorial rico (parágrafos, títulos, listas e sugestões),
 * removendo tags executáveis (<script>, <iframe>, <object>, <embed>, <style>, <svg onload>)
 * e atributos de eventos inline (on*=) ou protocolos perigosos (javascript:, data:text/html).
 * Funciona tanto em Node.js (testes) quanto no navegador.
 * @param {unknown} htmlBruto
 * @returns {string}
 */
export function sanitizarHtmlEditorial(htmlBruto) {
  if (htmlBruto === null || htmlBruto === undefined) return '';
  let limpo = String(htmlBruto);

  // 1. Remove tags perigosas e seu conteúdo
  limpo = limpo.replace(/<\s*(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  limpo = limpo.replace(/<\s*(script|iframe|object|embed|applet|meta|link|input|button|textarea)[^>]*\/?\s*>/gi, '');

  // 2. Remove atributos de eventos inline (onerror=, onclick=, onload=, onmouseover=, etc.)
  limpo = limpo.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3. Neutraliza URLs com javascript: ou vbscript: ou data:text/html em href/src
  limpo = limpo.replace(/(href|src|xlink:href)\s*=\s*(['"]?)\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^'">\s]*/gi, '$1=$2#bloqueado');

  return limpo;
}

/**
 * Sanitiza recursivamente os campos de um documento `.athenes` importado.
 * @param {object} doc
 * @returns {object}
 */
export function sanitizarDocumentoImportado(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (typeof doc.titulo === 'string') doc.titulo = escapeHtml(doc.titulo);
  if (typeof doc.subtitulo === 'string') doc.subtitulo = escapeHtml(doc.subtitulo);

  for (const sec of doc.secoes || []) {
    if (typeof sec.nome === 'string') sec.nome = escapeHtml(sec.nome);
    for (const b of sec.blocos || []) {
      if (typeof b.texto === 'string') b.texto = sanitizarHtmlEditorial(b.texto);
      if (typeof b.titulo === 'string') b.titulo = sanitizarHtmlEditorial(b.titulo);
      if (typeof b.legenda === 'string') b.legenda = sanitizarHtmlEditorial(b.legenda);
      if (typeof b.legenda_geral === 'string') b.legenda_geral = sanitizarHtmlEditorial(b.legenda_geral);
      if (typeof b.fonte === 'string') b.fonte = sanitizarHtmlEditorial(b.fonte);
    }
  }
  return doc;
}

/**
 * Gerenciador de Seleção (Range) vinculado ao bloco ativo para evitar perda de foco
 * ao clicar nos controles da barra lateral direita e impedir seleção cruzando múltiplos blocos.
 */
let _ultimaSelecaoBloco = {
  blocoId: null,
  range: null,
  texto: ''
};

export function registrarListenerSelecaoSegura() {
  if (typeof document === 'undefined' || document._athSelectionGuardAtivo) return;
  document._athSelectionGuardAtivo = true;

  document.addEventListener('selectionchange', () => {
    try {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const startEl = range.startContainer?.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
      const endEl = range.endContainer?.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;
      if (!startEl || !endEl) return;

      const blocoStart = startEl.closest?.('.ath-bloco-folha[data-bloco-id]');
      const blocoEnd = endEl.closest?.('.ath-bloco-folha[data-bloco-id]');

      // Garante que o início e o fim da seleção pertençam estritamente ao mesmo bloco
      if (blocoStart && blocoEnd && blocoStart.dataset.blocoId === blocoEnd.dataset.blocoId) {
        _ultimaSelecaoBloco = {
          blocoId: blocoStart.dataset.blocoId,
          range: range.cloneRange(),
          texto: range.toString()
        };
      }
    } catch (_) {}
  });
}

/**
 * Restaura a seleção salva para o bloco especificado se a seleção atual tiver sido perdida
 * ao clicar em um botão do painel de propriedades.
 * @param {string} blocoId
 * @returns {{ ok: boolean, range: Range|null, texto: string }}
 */
export function obterOuRestaurarSelecaoDoBloco(blocoId) {
  if (typeof window === 'undefined' || !window.getSelection) {
    return { ok: false, range: null, texto: '' };
  }

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const r = sel.getRangeAt(0);
    const sEl = r.startContainer?.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
    const eEl = r.endContainer?.nodeType === 3 ? r.endContainer.parentElement : r.endContainer;
    const bS = sEl?.closest?.('.ath-bloco-folha[data-bloco-id]');
    const bE = eEl?.closest?.('.ath-bloco-folha[data-bloco-id]');
    if (bS && bE && bS.dataset.blocoId === blocoId && bE.dataset.blocoId === blocoId) {
      return { ok: true, range: r, texto: r.toString() };
    }
  }

  if (_ultimaSelecaoBloco.blocoId === blocoId && _ultimaSelecaoBloco.range && _ultimaSelecaoBloco.texto.trim()) {
    try {
      sel.removeAllRanges();
      sel.addRange(_ultimaSelecaoBloco.range);
      return {
        ok: true,
        range: _ultimaSelecaoBloco.range,
        texto: _ultimaSelecaoBloco.texto
      };
    } catch (_) {}
  }

  return { ok: false, range: null, texto: '' };
}
