// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Visões somente leitura: Leitura Fiel (réplica da exportação) e Comparar lado a lado.
 *
 * Leitura fiel: o canvas é o PRÓPRIO HTML gerado para exportação (`gerarDocumentoHtmlPdf`) dentro de um
 * iframe `sandbox="allow-same-origin"` (sem scripts). Não existe `contenteditable`, input, arrasto, guia ou
 * seletor de bloco no documento: só rolagem e seleção de texto para cópia.
 *
 * Comparar: dois iframes (original × proposta) com diff por token; a rolagem é ancorada pelo bloco
 * (`data-id`) para manter parágrafos equivalentes alinhados mesmo quando as alturas diferem.
 */

import { gerarDocumentoHtmlPdf } from '../core/athenes_export_pdf.js';
import { compararDocumento, CSS_DIFF } from '../core/athenes_diff.js';
import { calcularNovoZoom } from './athenes_zoom_canvas.js';

const CSS_SOMENTE_LEITURA = `
html { scrollbar-gutter: stable; }
body { padding: 10px 0 36px; cursor: default; -webkit-user-select: text; user-select: text; caret-color: transparent; }
img { -webkit-user-drag: none; user-drag: none; }
a { pointer-events: none; }
`;

const el = (tag, classe, texto) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto !== undefined) n.textContent = texto;
  return n;
};

function criarIframe(html, titulo) {
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-same-origin'); // sem scripts: o conteúdo do documento não executa nada
  f.setAttribute('title', titulo);
  f.srcdoc = html;
  return f;
}

const contarPaginas = (html) => (html.match(/class="ath-pagina"/g) || []).length;

/** Zoom com Ctrl/Cmd + roda dentro do iframe (zoom CSS no body). `aoZoom(z)` recebe o novo fator. */
function ligarZoomNoIframe(ifr, obter, aoZoom) {
  const d = ifr.contentDocument;
  d.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    aoZoom(calcularNovoZoom(obter(), e.deltaY, e.deltaMode));
  }, { passive: false });
}

// ───────────────────────────── Leitura fiel ─────────────────────────────

/**
 * @param {HTMLElement} host
 * @param {object} doc
 * @returns {{destruir:()=>void}}
 */
export function montarLeituraFiel(host, doc) {
  host.innerHTML = '';
  const raiz = el('div', 'ath-rev ath-rev-leitura');

  const html = gerarDocumentoHtmlPdf(doc, { cssExtra: CSS_SOMENTE_LEITURA });
  const barra = el('div', 'ath-rev-barra');
  const titulo = el('strong', '', 'Leitura fiel');
  const sub = el('span', 'ath-rev-sub', `Réplica exata da exportação · ${contarPaginas(html)} página(s) · somente leitura`);
  const espaco = el('span', 'ath-rev-espaco');
  const zoomRot = el('button', 'ath-rev-zoom', '100%');
  zoomRot.type = 'button';
  zoomRot.title = 'Ctrl + roda do mouse para zoom · clique para 100%';
  const imprimir = el('button', 'ath-rev-btn', 'Imprimir / Salvar PDF');
  imprimir.type = 'button';
  barra.append(titulo, sub, espaco, zoomRot, imprimir);

  const ifr = criarIframe(html, 'Leitura fiel do documento');
  raiz.append(barra, ifr);
  host.appendChild(raiz);

  let zoom = 1;
  const aplicarZoom = (z) => {
    zoom = z;
    if (ifr.contentDocument?.body) ifr.contentDocument.body.style.zoom = String(z);
    zoomRot.textContent = `${Math.round(z * 100)}%`;
  };
  ifr.addEventListener('load', () => ligarZoomNoIframe(ifr, () => zoom, aplicarZoom));
  zoomRot.addEventListener('click', () => aplicarZoom(1));
  imprimir.addEventListener('click', () => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (_) {} });

  return { destruir() { host.innerHTML = ''; } };
}

// ───────────────────────────── Comparar lado a lado ─────────────────────────────

/** Índice dos blocos de um iframe (posição absoluta no documento) para ancorar a rolagem. */
function indexarBlocos(ifr) {
  const d = ifr.contentDocument;
  const sc = d.scrollingElement;
  const itens = [...d.querySelectorAll('[data-id]')].map(n => {
    const r = n.getBoundingClientRect();
    return { id: n.dataset.id, top: r.top + sc.scrollTop, h: Math.max(1, r.height) };
  });
  itens.sort((a, b) => a.top - b.top);
  const porId = new Map(itens.map(i => [i.id, i]));
  return { itens, porId };
}

/** Último item cujo topo está acima (ou na) posição `y` — busca binária. */
function blocoNoTopo(itens, y) {
  let lo = 0;
  let hi = itens.length - 1;
  let achou = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (itens[mid].top <= y + 1) { achou = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return achou;
}

/**
 * @param {HTMLElement} host
 * @param {object} doc
 * @returns {{destruir:()=>void}}
 */
export function montarComparacao(host, doc) {
  host.innerHTML = '';
  const { original, proposta, stats } = compararDocumento(doc);
  const extra = CSS_SOMENTE_LEITURA + CSS_DIFF;
  const htmlO = gerarDocumentoHtmlPdf(original, { cssExtra: extra, sugestoes: 'manter' });
  const htmlP = gerarDocumentoHtmlPdf(proposta, { cssExtra: extra, sugestoes: 'manter' });

  const raiz = el('div', 'ath-rev ath-rev-comparar');

  // Barra superior fixa com a legenda de status
  const barra = el('div', 'ath-rev-barra');
  const legenda = el('div', 'ath-rev-legenda');
  const chip = (cls, txt) => { const c = el('span', 'ath-rev-chip ' + cls); c.append(el('i'), document.createTextNode(txt)); return c; };
  legenda.append(
    chip('del', 'Texto removido / Versão original'),
    chip('add', 'Texto adicionado / Versão sugerida'),
    chip('igual', 'Texto inalterado')
  );
  const resumo = el('span', 'ath-rev-sub',
    stats.blocosAlterados
      ? `${stats.adicoes} adição(ões) · ${stats.remocoes} remoção(ões) · ${stats.blocosAlterados} bloco(s) alterado(s)`
      : 'Sem sugestões pendentes: as duas versões são idênticas. Use o modo Sugestão para propor alterações.');
  const espaco = el('span', 'ath-rev-espaco');
  const nav = el('div', 'ath-rev-nav');
  const ant = el('button', 'ath-rev-btn', '↑ Anterior');
  const prox = el('button', 'ath-rev-btn', 'Próxima ↓');
  const pos = el('span', 'ath-rev-sub', '');
  ant.type = prox.type = 'button';
  ant.disabled = prox.disabled = !stats.blocosAlterados;
  nav.append(ant, pos, prox);
  const zoomRot = el('button', 'ath-rev-zoom', '100%');
  zoomRot.type = 'button';
  zoomRot.title = 'Ctrl + roda do mouse para zoom · clique para 100%';
  barra.append(legenda, resumo, espaco, nav, zoomRot);

  // Painéis
  const paineis = el('div', 'ath-rev-paineis');
  const quadro = (rotulo, classe, html, titulo) => {
    const q = el('div', 'ath-rev-quadro ' + classe);
    q.appendChild(el('div', 'ath-rev-quadro-topo', rotulo));
    const f = criarIframe(html, titulo);
    q.appendChild(f);
    paineis.appendChild(q);
    return f;
  };
  const ifrO = quadro('Original (base)', 'esq', htmlO, 'Versão original');
  const ifrP = quadro('Com sugestões (proposta)', 'dir', htmlP, 'Versão com sugestões');
  raiz.append(barra, paineis);
  host.appendChild(raiz);

  // — rolagem sincronizada, ancorada por bloco —
  let idxO = null;
  let idxP = null;
  let origem = null;
  let tLiberar = null;
  let zoom = 1;
  let atual = -1;

  const sincronizar = (src, dst, idxSrc, idxDst) => {
    const sSc = src.contentDocument.scrollingElement;
    const dSc = dst.contentDocument.scrollingElement;
    const y = sSc.scrollTop;
    const i = blocoNoTopo(idxSrc.itens, y);
    const it = i >= 0 ? idxSrc.itens[i] : null;
    const par = it ? idxDst.porId.get(it.id) : null;
    if (it && par) {
      const frac = Math.min(1, Math.max(0, (y - it.top) / it.h));
      dSc.scrollTop = par.top + frac * par.h;
    } else {
      // sem bloco equivalente: proporcional ao comprimento total
      const maxS = Math.max(1, sSc.scrollHeight - sSc.clientHeight);
      dSc.scrollTop = (y / maxS) * Math.max(0, dSc.scrollHeight - dSc.clientHeight);
    }
  };

  const aoRolar = (src, dst, qual) => () => {
    if (!idxO || !idxP) return;
    if (origem && origem !== src) return; // evento provocado pelo próprio espelhamento
    origem = src;
    sincronizar(src, dst, qual === 'O' ? idxO : idxP, qual === 'O' ? idxP : idxO);
    clearTimeout(tLiberar);
    tLiberar = setTimeout(() => { origem = null; }, 90);
  };

  const aplicarZoom = (z) => {
    zoom = z;
    [ifrO, ifrP].forEach(f => { if (f.contentDocument?.body) f.contentDocument.body.style.zoom = String(z); });
    zoomRot.textContent = `${Math.round(z * 100)}%`;
    idxO = indexarBlocos(ifrO);
    idxP = indexarBlocos(ifrP);
  };

  let carregados = 0;
  const aoCarregar = () => {
    if (++carregados < 2) return;
    idxO = indexarBlocos(ifrO);
    idxP = indexarBlocos(ifrP);
    ifrO.contentDocument.addEventListener('scroll', aoRolar(ifrO, ifrP, 'O'), { passive: true });
    ifrP.contentDocument.addEventListener('scroll', aoRolar(ifrP, ifrO, 'P'), { passive: true });
    ligarZoomNoIframe(ifrO, () => zoom, aplicarZoom);
    ligarZoomNoIframe(ifrP, () => zoom, aplicarZoom);
  };
  ifrO.addEventListener('load', aoCarregar);
  ifrP.addEventListener('load', aoCarregar);
  zoomRot.addEventListener('click', () => aplicarZoom(1));

  // — navegação entre alterações —
  const ir = (n) => {
    if (!stats.idsAlterados.length || !idxO) return;
    atual = (n + stats.idsAlterados.length) % stats.idsAlterados.length;
    const alvo = idxO.porId.get(stats.idsAlterados[atual]);
    if (!alvo) return;
    pos.textContent = `${atual + 1} de ${stats.idsAlterados.length}`;
    ifrO.contentDocument.scrollingElement.scrollTo({ top: Math.max(0, alvo.top - 80), behavior: 'smooth' });
  };
  prox.addEventListener('click', () => ir(atual + 1));
  ant.addEventListener('click', () => ir(atual < 0 ? 0 : atual - 1));

  return {
    destruir() {
      clearTimeout(tLiberar);
      host.innerHTML = '';
    }
  };
}
