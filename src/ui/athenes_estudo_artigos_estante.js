// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Módulo de Estante 3D, Livros Esquemáticos e Folha de Fichamento (R3/R4).
 * 
 * Re-exporta e integra funções de pastas, breadcrumbs, seleção e movimentação
 * do Milestone 2 (M2) e implementa a estante com prateleiras em perspectiva 3D,
 * livros esquemáticos com lombada e miolo, cinemática de abertura com rotateY/translateZ,
 * folha interna de fichamento e Citation Tracker.
 *
 * Módulo puro: Vanilla ES Modules sem dependências externas de runtime.
 */

import {
  renderizarPastasCronos,
  renderizarFaixaDePastas,
  renderizarBreadcrumb,
  selecionarPasta,
  restaurarPastaAtiva,
  coletarPastasBibliografia,
  CORES_PASTAS_CRONOS,
  STORAGE_KEY_BIB_PASTA_ATIVA
} from './athenes_estudo_artigos_pastas.js';

import {
  normalizarHexCor,
  calcularLuminanciaRelativa,
  calcularRazaoContraste,
  obterCorTextoAcessivel,
  calcularCoresPasta,
  calcularContadoresPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas,
  RAIZ_BIBLIOGRAFIA
} from '../core/athenes_referencias.js';

import { artigoTemPdf } from './athenes_estudo_artigos_dados.js';

export {
  renderizarPastasCronos,
  renderizarFaixaDePastas,
  renderizarBreadcrumb,
  selecionarPasta,
  restaurarPastaAtiva,
  coletarPastasBibliografia,
  CORES_PASTAS_CRONOS,
  STORAGE_KEY_BIB_PASTA_ATIVA,
  normalizarHexCor,
  calcularLuminanciaRelativa,
  calcularRazaoContraste,
  obterCorTextoAcessivel,
  calcularCoresPasta,
  calcularContadoresPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas,
  RAIZ_BIBLIOGRAFIA
};

// ─────────────────────────────────────────────────────────────────────────────
// Suporte universal e determinístico para criação de elementos (Browser & Mock)
// ─────────────────────────────────────────────────────────────────────────────

class SimpleMockClassList {
  constructor(classes = '') {
    this._set = new Set(String(classes || '').split(/\s+/).filter(Boolean));
  }
  add(...tokens) {
    for (const t of tokens) if (t) this._set.add(String(t));
  }
  remove(...tokens) {
    for (const t of tokens) if (t) this._set.delete(String(t));
  }
  toggle(token, force) {
    if (force !== undefined) {
      if (force) this._set.add(token);
      else this._set.delete(token);
      return Boolean(force);
    }
    if (this._set.has(token)) {
      this._set.delete(token);
      return false;
    }
    this._set.add(token);
    return true;
  }
  contains(token) {
    return this._set.has(token);
  }
  has(token) {
    return this._set.has(token);
  }
  toString() {
    return Array.from(this._set).join(' ');
  }
  [Symbol.iterator]() {
    return this._set.values();
  }
}

class SimpleMockElement {
  constructor(tag = 'div', classes = '') {
    this.tagName = String(tag || 'div').toUpperCase();
    this.classList = new SimpleMockClassList(classes);
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._textContent = '';
  }
  get className() {
    return this.classList.toString();
  }
  set className(v) {
    this.classList = new SimpleMockClassList(v);
  }
  get textContent() {
    return this._textContent;
  }
  set textContent(v) {
    this._textContent = String(v ?? '');
  }
  setAttribute(k, v) {
    this.attributes.set(String(k), String(v));
  }
  getAttribute(k) {
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }
  removeAttribute(k) {
    this.attributes.delete(k);
  }
  appendChild(child) {
    if (child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  }
  dispatchEvent(ev) {
    const t = ev?.type || 'click';
    const arr = this.listeners.get(t) || [];
    for (const fn of arr) fn.call(this, ev);
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  querySelectorAll(sel) {
    if (!sel) return [];
    const parts = sel.trim().split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const rest = parts.slice(1).join(' ');
      const parents = this.querySelectorAll(first);
      const out = [];
      for (const p of parents) {
        out.push(...p.querySelectorAll(rest));
      }
      return out;
    }
    const cleanSel = parts[0];
    const results = [];
    const check = (el) => {
      let matches = false;
      if (cleanSel.startsWith('#')) {
        matches = el.getAttribute('id') === cleanSel.slice(1);
      } else if (cleanSel.includes('.')) {
        const [tag, ...classes] = cleanSel.split('.');
        if (!tag || el.tagName?.toLowerCase() === tag.toLowerCase()) {
          matches = classes.every(c => el.classList && (el.classList.contains?.(c) || el.classList.has?.(c)));
        }
      } else if (cleanSel.includes('[')) {
        const match = cleanSel.match(/([a-zA-Z0-9-_]+)?\[([a-zA-Z0-9-_]+)(?:=["']?([^"']*)["']?)?\]/);
        if (match) {
          const tag = match[1];
          const attr = match[2];
          const val = match[3];
          if (!tag || el.tagName?.toLowerCase() === tag.toLowerCase()) {
            matches = val !== undefined ? el.getAttribute(attr) === val : (el.attributes && el.attributes.has(attr));
          }
        }
      } else {
        matches = el.tagName?.toLowerCase() === cleanSel.toLowerCase();
      }
      if (matches) results.push(el);
      for (const ch of el.children || []) check(ch);
    };
    for (const ch of this.children || []) check(ch);
    return results;
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (sel.startsWith('.') && cur.classList && (cur.classList.contains?.(sel.slice(1)) || cur.classList.has?.(sel.slice(1)))) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }
}

function criarElemento(tag = 'div', classes = '') {
  let el;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    el = document.createElement(tag);
  } else {
    el = new SimpleMockElement(tag);
  }
  if (classes) {
    if (el.classList && typeof el.classList.add === 'function') {
      const tokens = String(classes).split(/\s+/).filter(Boolean);
      for (const t of tokens) el.classList.add(t);
    } else {
      el.className = classes;
    }
  }
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Movimentação de Referências entre Pastas (M2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move uma obra para outra pasta, alterando pastaId no livro alvo e retornando status estruturado.
 * Compatível com chamadas diretas de testes E2E e fluxos da estante.
 * 
 * @param {string} livroId
 * @param {string} pastaDestinoId
 * @param {Array<object>} [livros=[]]
 * @param {Array<object>} [pastas=[]]
 * @returns {{ sucesso: boolean, motivo?: string, semMudanca?: boolean, livro?: object, pastaDestinoId?: string, erro?: string }}
 */
export function moverLivroParaPasta(livroId, pastaDestinoId, livros = [], pastas = []) {
  const listaLivros = Array.isArray(livros) ? livros : [];
  const livro = listaLivros.find(l => l && (String(l.id) === String(livroId) || String(l.chaveZotero) === String(livroId)));
  if (!livro) {
    return { sucesso: false, motivo: 'livro_nao_encontrado', erro: 'Livro não encontrado' };
  }

  const pDestino = String(pastaDestinoId || '').trim();
  if (pDestino !== 'todas' && Array.isArray(pastas) && pastas.length > 0 && !pastas.some(p => p && p.id === pDestino)) {
    return { sucesso: false, motivo: 'pasta_destino_inexistente', erro: 'Pasta destino inexistente' };
  }

  if (livro.pastaId === pDestino) {
    return { sucesso: true, semMudanca: true, livro, mensagem: 'O livro já está nesta pasta.' };
  }

  livro.pastaId = pDestino;
  livro.pastasIds = [pDestino];
  livro.atualizadoEm = new Date().toISOString();
  return { sucesso: true, livro, pastaDestinoId: pDestino };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Estante com Prateleiras Horizontais em CSS 3D (R3 / F5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza a estante completa com perspectiva tridimensional e prateleiras horizontais chanfradas.
 *
 * @param {Array<object>} [livros=[]] - Lista de itens BookReferenceItem
 * @param {object} [opcoes={}] - Configurações { maxPorPrateleira, callbacks }
 * @returns {HTMLElement} Elemento .ath-estante-3d
 */
export function renderizarEstante3D(livros = [], { maxPorPrateleira = 6, callbacks = {} } = {}) {
  const estanteEl = criarElemento('div', 'ath-estante-3d ath-estante-container');
  if (!estanteEl.style) estanteEl.style = {};
  estanteEl.style.perspective = '1000px';

  const listaLivros = Array.isArray(livros) ? livros : [];

  // Estado Vazio: Prateleira com card explicativo e base chanfrada
  if (listaLivros.length === 0) {
    const prateleiraVazia = criarElemento('div', 'ath-estante-prateleira');
    const vazioCard = criarElemento('div', 'ath-estante-vazia-card');
    vazioCard.textContent = 'Nenhuma obra cadastrada nesta estante.';
    prateleiraVazia.appendChild(vazioCard);

    const base = criarElemento('div', 'ath-prateleira-base');
    const sup = criarElemento('div', 'ath-prateleira-superficie');
    const chanfro = criarElemento('div', 'ath-prateleira-chanfro');
    base.appendChild(sup);
    base.appendChild(chanfro);
    prateleiraVazia.appendChild(base);

    const sombra = criarElemento('div', 'ath-prateleira-sombra ath-prateleira-sombra-inferior');
    prateleiraVazia.appendChild(sombra);

    estanteEl.appendChild(prateleiraVazia);
    return estanteEl;
  }

  // Distribuição em Prateleiras Horizontais (lotes de maxPorPrateleira)
  const limite = (!maxPorPrateleira || maxPorPrateleira <= 0) ? 6 : Math.max(1, Math.floor(maxPorPrateleira));
  const totalPrateleiras = Math.ceil(listaLivros.length / limite);

  for (let i = 0; i < totalPrateleiras; i++) {
    const prateleira = criarElemento('div', 'ath-estante-prateleira');
    const livrosLinha = criarElemento('div', 'ath-prateleira-livros');
    const lote = listaLivros.slice(i * limite, (i + 1) * limite);

    for (const item of lote) {
      const livroEl = renderizarLivro3D(item, { callbacks });
      livrosLinha.appendChild(livroEl);
    }
    prateleira.appendChild(livrosLinha);

    const base = criarElemento('div', 'ath-prateleira-base');
    const sup = criarElemento('div', 'ath-prateleira-superficie');
    const chanfro = criarElemento('div', 'ath-prateleira-chanfro');
    base.appendChild(sup);
    base.appendChild(chanfro);
    prateleira.appendChild(base);

    const sombra = criarElemento('div', 'ath-prateleira-sombra ath-prateleira-sombra-inferior');
    prateleira.appendChild(sombra);

    estanteEl.appendChild(prateleira);
  }

  return estanteEl;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Livro Esquemático em CSS 3D com Perspectiva e Capa (R3 / F6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza um exemplar de livro em 3D com 5 faces anatômicas: lombada, miolo, capas e badges.
 *
 * @param {object} ref - BookReferenceItem
 * @param {object} [opcoes={}] - { callbacks }
 * @returns {HTMLElement} Elemento .ath-livro-3d
 */
export function renderizarLivro3D(ref = {}, { callbacks = {} } = {}) {
  const livroEl = criarElemento('div', 'ath-livro-3d ath-livro-3d-wrap');
  if (!livroEl.style) livroEl.style = {};
  livroEl.setAttribute('data-livro-id', ref?.id || '');
  livroEl.setAttribute('role', 'button');
  livroEl.setAttribute('tabindex', '0');
  livroEl.setAttribute('aria-haspopup', 'dialog');
  livroEl.setAttribute('aria-expanded', 'false');
  livroEl.setAttribute('aria-label', `Livro: ${ref?.titulo || 'Sem Título'}`);
  livroEl.style.transformStyle = 'preserve-3d';

  const corLivro = ref?.corCapa || '#314F79';

  // 1. Lombada Lateral Esquerda
  const lombada = criarElemento('div', 'ath-livro-lombada');
  if (!lombada.style) lombada.style = {};
  lombada.style.backgroundColor = corLivro;
  const lombadaTexto = criarElemento('span', 'ath-livro-lombada-texto');
  const primeiroAutor = Array.isArray(ref?.autores) && ref.autores.length > 0
    ? (ref.autores[0]?.sobrenome || ref.autores[0]?.prenome || '')
    : '';
  lombadaTexto.textContent = primeiroAutor ? `${primeiroAutor} · ${ref?.ano || ''}`.trim() : (ref?.titulo || 'Athenes');
  lombada.appendChild(lombadaTexto);
  livroEl.appendChild(lombada);

  // 2. Bloco de Páginas (lateral direita e borda inferior)
  const paginas = criarElemento('div', 'ath-livro-paginas ath-livro-paginas-dir');
  livroEl.appendChild(paginas);

  const paginasBaixo = criarElemento('div', 'ath-livro-paginas-baixo');
  livroEl.appendChild(paginasBaixo);

  // 3. Capa Traseira
  const capaTras = criarElemento('div', 'ath-livro-capa-tras');
  if (!capaTras.style) capaTras.style = {};
  capaTras.style.backgroundColor = corLivro;
  livroEl.appendChild(capaTras);

  // 4. Sombra Basal de Contato na Prateleira
  const sombraBase = criarElemento('div', 'ath-livro-sombra-base');
  livroEl.appendChild(sombraBase);

  // 5. Capa Frontal Interativa
  const capa = criarElemento('div', 'ath-livro-capa ath-livro-capa-frente');
  if (!capa.style) capa.style = {};
  capa.style.backgroundColor = corLivro;
  capa.style.color = obterCorTextoAcessivel(corLivro);

  // Face interna da capa (verso visível quando aberto a -140deg)
  const capaVerso = criarElemento('div', 'ath-livro-capa-verso ath-livro-capa-interna');
  if (!capaVerso.style) capaVerso.style = {};
  capaVerso.style.backgroundColor = corLivro;
  capa.appendChild(capaVerso);

  const vinco = criarElemento('div', 'ath-livro-capa-vinco-esq');
  capa.appendChild(vinco);

  const headerCapa = criarElemento('div', 'ath-livro-capa-header');

  const badge = criarElemento('div', 'ath-livro-badge-tipo');
  badge.textContent = `${ref?.ano || 's.d.'} · ${ref?.tipo || 'artigo'}`;
  headerCapa.appendChild(badge);

  const citacoes = criarElemento('div', 'ath-livro-citacoes ath-livro-badge-citacoes');
  const totalCit = Math.max(0, Number(ref?.totalCitationsCount) || 0);
  citacoes.textContent = totalCit >= 1000 ? `❝ ${Math.floor(totalCit / 1000)}k` : `❝ ${totalCit}`;
  headerCapa.appendChild(citacoes);
  capa.appendChild(headerCapa);

  const titulo = criarElemento('h3', 'ath-livro-titulo');
  titulo.textContent = ref?.titulo || 'Sem Título';
  titulo.setAttribute('title', ref?.titulo || 'Sem Título');
  capa.appendChild(titulo);

  const autores = criarElemento('p', 'ath-livro-autores');
  if (Array.isArray(ref?.autores) && ref.autores.length > 0) {
    autores.textContent = ref.autores.map(a => a?.sobrenome || a?.prenome || (typeof a === 'string' ? a : '')).filter(Boolean).join(', ') || 'Autor não informado';
  } else {
    autores.textContent = 'Autor não informado';
  }
  capa.appendChild(autores);

  const footerCapa = criarElemento('div', 'ath-livro-capa-footer');
  if (ref?.pdfUrl || ref?.pdfCaminho || (typeof artigoTemPdf === 'function' && artigoTemPdf(ref))) {
    const pdfPill = criarElemento('span', 'ath-livro-pdf-pill');
    pdfPill.textContent = 'PDF';
    footerCapa.appendChild(pdfPill);
  }
  capa.appendChild(footerCapa);
  livroEl.appendChild(capa);

  // Microinterações de Clique e Acessibilidade por Teclado
  livroEl.addEventListener('click', (ev) => {
    if (ev?.target && typeof ev.target.closest === 'function' && ev.target.closest('.ath-livro-folha-interna')) {
      return;
    }
    const isAberto = livroEl.classList && (livroEl.classList.contains?.('aberto') || livroEl.classList.has?.('aberto'));
    if (isAberto) {
      fecharLivro3D(livroEl);
    } else {
      abrirLivro3D(livroEl, ref, { callbacks });
    }
  });

  livroEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      const isAberto = livroEl.classList && (livroEl.classList.contains?.('aberto') || livroEl.classList.has?.('aberto'));
      if (!isAberto) {
        if (ev.preventDefault) ev.preventDefault();
        abrirLivro3D(livroEl, ref, { callbacks });
      }
    }
  });

  return livroEl;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cinemática de Abertura e Fechamento 3D (R4 / F7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre o livro na prateleira com elevação no eixo Z e rotação da capa frontal.
 * Fecha automaticamente qualquer outro exemplar aberto na estante.
 *
 * @param {HTMLElement} livroEl - Elemento .ath-livro-3d
 * @param {object} ref - BookReferenceItem
 * @param {object} [opcoes={}] - { callbacks }
 */
export function abrirLivro3D(livroEl, ref, { callbacks = {} } = {}) {
  if (!livroEl) return;

  // Fecha qualquer outro livro aberto na mesma estante
  let container = null;
  if (typeof livroEl.closest === 'function') {
    container = livroEl.closest('.ath-estante-3d') || livroEl.closest('.ath-estante-container') || livroEl.parentNode;
  }
  if (!container && typeof document !== 'undefined') container = document;

  if (container && typeof container.querySelectorAll === 'function') {
    const abertos = container.querySelectorAll('.ath-livro-3d.aberto');
    if (abertos && abertos.length > 0) {
      for (const outro of abertos) {
        if (outro !== livroEl) fecharLivro3D(outro);
      }
    } else {
      const todos = container.querySelectorAll('.ath-livro-3d');
      for (const outro of todos) {
        if (outro !== livroEl && outro.classList && (outro.classList.contains('aberto') || outro.classList.has?.('aberto'))) {
          fecharLivro3D(outro);
        }
      }
    }
  }

  if (livroEl.classList) livroEl.classList.add('aberto');
  if (!livroEl.style) livroEl.style = {};
  livroEl.style.transform = 'translateZ(60px)';
  if (typeof livroEl.setAttribute === 'function') {
    livroEl.setAttribute('aria-expanded', 'true');
    // Transiciona o container de button para region/container neutro para evitar role="dialog" dentro de role="button"
    livroEl.setAttribute('role', 'region');
    livroEl.setAttribute('tabindex', '-1');
  }

  // Backdrop / Scrim de Foco
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const scrim = document.getElementById('athEstanteScrim');
    if (scrim?.classList) scrim.classList.add('ativo');
  }

  // Instancia ou exibe a folha interna sem duplicar nós no DOM
  let folha = (typeof livroEl.querySelector === 'function') ? livroEl.querySelector('.ath-livro-folha-interna') : null;
  if (!folha) {
    folha = renderizarFolhaInterna(ref, callbacks);
    livroEl.appendChild(folha);
  } else {
    if (folha.style) folha.style.display = 'flex';
  }
  if (folha && typeof folha.setAttribute === 'function') {
    folha.setAttribute('aria-hidden', 'false');
  }

  // Foco acessível no cabeçalho ou primeiro controle
  livroEl._focoAnterior = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
  const tituloFolha = (folha && typeof folha.querySelector === 'function') ? folha.querySelector('.ath-folha-titulo') : null;
  if (tituloFolha && typeof tituloFolha.setAttribute === 'function') {
    tituloFolha.setAttribute('tabindex', '-1');
  }
  const alvoFoco = tituloFolha || (folha && typeof folha.querySelector === 'function' ? folha.querySelector('.ath-status-btn.ativo, .ath-status-btn, .ath-btn-abrir-leitor') : null) || folha;

  if (alvoFoco && typeof alvoFoco.focus === 'function') {
    setTimeout(() => {
      try { alvoFoco.focus(); } catch (_) {}
    }, 50);
  }
}

/**
 * Fecha suavemente o livro aberto, revertendo o transform para a inclinação de repouso.
 *
 * @param {HTMLElement} livroEl - Elemento .ath-livro-3d
 */
export function fecharLivro3D(livroEl) {
  if (!livroEl) return;

  if (livroEl.classList) livroEl.classList.remove('aberto');
  if (!livroEl.style) livroEl.style = {};
  livroEl.style.transform = 'rotateY(-18deg) rotateX(4deg)';
  if (typeof livroEl.setAttribute === 'function') {
    livroEl.setAttribute('aria-expanded', 'false');
    // Restaura o papel canônico de botão de disparo no exemplar fechado
    livroEl.setAttribute('role', 'button');
    livroEl.setAttribute('tabindex', '0');
  }

  // Oculta estritamente a folha interna para não vazar sobre os livros vizinhos
  const folha = (typeof livroEl.querySelector === 'function') ? livroEl.querySelector('.ath-livro-folha-interna') : null;
  if (folha) {
    if (folha.style) folha.style.display = 'none';
    if (typeof folha.setAttribute === 'function') folha.setAttribute('aria-hidden', 'true');
  }

  // Desativa scrim se não houver mais livros abertos
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const scrim = document.getElementById('athEstanteScrim');
    if (scrim?.classList) scrim.classList.remove('ativo');
  }

  // Restaura foco para o disparador original
  if (livroEl._focoAnterior && typeof livroEl._focoAnterior.focus === 'function') {
    try { livroEl._focoAnterior.focus(); } catch (_) {}
    delete livroEl._focoAnterior;
  } else if (typeof livroEl.focus === 'function') {
    try { livroEl.focus(); } catch (_) {}
  }
}

/**
 * Fecha todos os livros que estejam abertos no container fornecido.
 *
 * @param {HTMLElement|Document} container
 */
export function fecharTodosLivros3D(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  const abertos = container.querySelectorAll('.ath-livro-3d.aberto');
  for (const el of abertos) {
    fecharLivro3D(el);
  }
}

/**
 * Trata eventos de teclado, fechando o livro aberto exclusivamente ao detectar Escape
 * e contendo a navegação Tab no ciclo da folha.
 *
 * @param {KeyboardEvent} evento
 * @param {HTMLElement} livroAbertoEl
 */
export function tratarTecladoLivro3D(evento, livroAbertoEl) {
  if (!evento || !livroAbertoEl) return;
  const key = evento.key;
  const code = evento.keyCode;
  if (key === 'Escape' || code === 27) {
    fecharLivro3D(livroAbertoEl);
    return;
  }
  if (key === 'Tab' || code === 9) {
    const folha = (typeof livroAbertoEl.querySelector === 'function')
      ? livroAbertoEl.querySelector('.ath-livro-folha-interna')
      : null;
    if (folha && typeof folha.querySelectorAll === 'function') {
      const seletores = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focaveis = Array.from(folha.querySelectorAll(seletores)).filter(el => el && el.style?.display !== 'none');
      if (focaveis.length > 0) {
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const ativo = (typeof document !== 'undefined') ? document.activeElement : null;
        if (evento.shiftKey) {
          if (ativo === primeiro || ativo === folha) {
            if (typeof evento.preventDefault === 'function') evento.preventDefault();
            try { ultimo.focus(); } catch (_) {}
          }
        } else {
          if (ativo === ultimo) {
            if (typeof evento.preventDefault === 'function') evento.preventDefault();
            try { primeiro.focus(); } catch (_) {}
          }
        }
      }
    }
  }
}

/**
 * Copia texto para a área de transferência com suporte assíncrono à Clipboard API
 * e fallback clássico via document.execCommand('copy') em caso de rejeição ou indisponibilidade.
 *
 * @param {string} texto - Texto a ser copiado
 * @returns {Promise<boolean>} Retorna true se a cópia foi realizada com sucesso
 */
export async function copiarTextoParaClipboard(texto) {
  const str = String(texto ?? '');
  if (!str) return false;

  // Tentativa 1: Clipboard API moderna (requer contexto seguro e permissão concedida)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch (_) {
      // Rejeição da Promise tratada com segurança
    }
  }

  // Tentativa 2: Fallback clássico via document.execCommand('copy')
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const ta = document.createElement('textarea');
      ta.value = str;
      if (typeof ta.setAttribute === 'function') ta.setAttribute('readonly', '');
      if (ta.style) {
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
      }
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(ta);
      }
      if (typeof ta.select === 'function') {
        ta.select();
      }
      let copiou = false;
      if (typeof document.execCommand === 'function') {
        copiou = Boolean(document.execCommand('copy'));
      }
      if (ta.parentNode && typeof ta.parentNode.removeChild === 'function') {
        ta.parentNode.removeChild(ta);
      }
      return copiou;
    } catch (_) {
      return false;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Folha Interna de Fichamento e Citation Tracker (R4 / F8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza o DOM da Folha Interna de Fichamento com todas as seções e microinterações.
 *
 * @param {object} ref - BookReferenceItem
 * @param {object} [opcoes={}] - { onAbrirLeitor, onStatusChange, onSalvarNota, onEditarMeta, onMoverPasta, onMudarCor }
 * @returns {HTMLElement} Elemento .ath-livro-folha-interna
 */
export function renderizarFolhaInterna(ref = {}, {
  onAbrirLeitor = null,
  onStatusChange = null,
  onSalvarNota = null,
  onEditarMeta = null,
  onMoverPasta = null,
  onMudarCor = null,
  onEditarMetadados = null,
  onAlterarCorCapa = null
} = {}) {
  const fnEditarMeta = onEditarMetadados || onEditarMeta;
  const fnMudarCor = onAlterarCorCapa || onMudarCor;

  const folha = criarElemento('div', 'ath-livro-folha-interna');
  folha.setAttribute('role', 'dialog');
  folha.setAttribute('aria-modal', 'true');
  folha.setAttribute('aria-label', `Ficha rápida de ${ref?.titulo || 'referência'}`);

  // Normalização de dados seguros
  const tituloStr = String(ref?.titulo || 'Sem Título').trim() || 'Sem Título';
  const autoresFmt = Array.isArray(ref?.autores) && ref.autores.length > 0
    ? ref.autores.map(a => a?.sobrenome || a?.prenome || (typeof a === 'string' ? a : '')).filter(Boolean).join(', ')
    : 'Autor';
  const anoFmt = String(ref?.ano || 's.d.').trim() || 's.d.';
  const totalCitacoes = Math.max(0, Number(ref?.totalCitationsCount) || 0);
  const totalGrifos = Math.max(0, Number(ref?.highlightsCount) || 0);
  const chaveCitacao = ref?.formattedCitationKey || `(${autoresFmt.split(',')[0].trim().toUpperCase()}, ${anoFmt})`;

  // 1. Cabeçalho Editorial
  const cabecalho = criarElemento('div', 'ath-folha-cabecalho ath-folha-header');

  const topRow = criarElemento('div', 'ath-folha-top-row');
  const badgeTipo = criarElemento('span', 'ath-folha-tipo-badge');
  badgeTipo.textContent = (ref?.tipo || 'artigo').replace(/_/g, ' ').toUpperCase();
  topRow.appendChild(badgeTipo);

  // Seletor de Status de Leitura (Toggle)
  const statusBox = criarElemento('div', 'ath-status-toggle ath-folha-status-selector');
  statusBox.setAttribute('role', 'radiogroup');
  statusBox.setAttribute('aria-label', 'Status de Leitura');

  const opcoesStatus = [
    { id: 'nao_lido', label: '⚪ Não lido' },
    { id: 'lendo', label: '🟡 Lendo' },
    { id: 'fichado', label: '🟢 Fichado' }
  ];

  for (const st of opcoesStatus) {
    const isAtivo = ref?.statusLeitura === st.id;
    const btnSt = criarElemento('button', `ath-status-btn ath-status-opt ${isAtivo ? 'ativo' : ''}`);
    btnSt.setAttribute('type', 'button');
    btnSt.setAttribute('data-status', st.id);
    btnSt.setAttribute('role', 'radio');
    btnSt.setAttribute('aria-checked', String(isAtivo));
    btnSt.textContent = st.label;

    btnSt.addEventListener('click', (ev) => {
      if (ev?.stopPropagation) ev.stopPropagation();
      if (ref) ref.statusLeitura = st.id;
      const todos = statusBox.querySelectorAll('.ath-status-btn');
      for (const b of todos) {
        const ativo = b.getAttribute('data-status') === st.id;
        if (b.classList) {
          if (ativo) b.classList.add('ativo');
          else b.classList.remove('ativo');
        }
        if (typeof b.setAttribute === 'function') b.setAttribute('aria-checked', String(ativo));
      }
      if (typeof onStatusChange === 'function') {
        onStatusChange(st.id);
      }
    });

    statusBox.appendChild(btnSt);
  }
  topRow.appendChild(statusBox);
  cabecalho.appendChild(topRow);

  const h2 = criarElemento('h2', 'ath-folha-titulo');
  h2.textContent = tituloStr;
  if (typeof h2.setAttribute === 'function') h2.setAttribute('tabindex', '-1');
  cabecalho.appendChild(h2);

  const meta = criarElemento('p', 'ath-folha-meta ath-folha-autores-completos');
  meta.textContent = `${autoresFmt} (${anoFmt})`;
  if (ref?.publicacao) {
    meta.textContent += ` · ${ref.publicacao}`;
  }
  cabecalho.appendChild(meta);
  folha.appendChild(cabecalho);

  // 2. Citation Tracker
  const tracker = criarElemento('div', 'ath-citation-tracker ath-folha-citation-tracker');
  const trackerHead = criarElemento('div', 'ath-citation-head');

  const total = criarElemento('span', 'ath-citacoes-total ath-citation-metric-num');
  total.textContent = `Citações no projeto: ${totalCitacoes}`;
  trackerHead.appendChild(total);

  const btnCopiar = criarElemento('button', 'ath-btn ath-btn-copiar-citacao ath-btn-copiar-chave');
  btnCopiar.setAttribute('type', 'button');
  btnCopiar.setAttribute('data-chave', chaveCitacao);
  btnCopiar.textContent = 'Copiar Citação Formatada';

  btnCopiar.addEventListener('click', (ev) => {
    if (ev?.stopPropagation) ev.stopPropagation();
    copiarTextoParaClipboard(chaveCitacao);
    if (btnCopiar.classList) btnCopiar.classList.add('copiado');
    btnCopiar.textContent = 'Copiado! ✓';
    if (typeof btnCopiar.setAttribute === 'function') {
      btnCopiar.setAttribute('aria-label', 'Citação formatada copiada para a área de transferência');
    }
    setTimeout(() => {
      if (btnCopiar.classList) btnCopiar.classList.remove('copiado');
      btnCopiar.textContent = 'Copiar Citação Formatada';
      if (typeof btnCopiar.setAttribute === 'function') {
        btnCopiar.setAttribute('aria-label', 'Copiar citação formatada');
      }
    }, 2000);
  });
  trackerHead.appendChild(btnCopiar);
  tracker.appendChild(trackerHead);

  if (Array.isArray(ref?.citedInSections) && ref.citedInSections.length > 0) {
    const secoesLista = criarElemento('div', 'ath-citation-secoes-lista');
    for (const sec of ref.citedInSections) {
      const secBadge = criarElemento('span', 'ath-citation-secao-badge');
      secBadge.textContent = `${sec.secaoTitulo || 'Seção'} (${sec.docTitulo || 'Doc'})`;
      secoesLista.appendChild(secBadge);
    }
    tracker.appendChild(secoesLista);
  }
  folha.appendChild(tracker);

  // 3. Preview de Fichamento & Anotação Rápida
  const preview = criarElemento('div', 'ath-fichamento-preview ath-folha-fichamento');
  const fichHead = criarElemento('div', 'ath-folha-subtit');
  const subTitSpan = criarElemento('span');
  subTitSpan.textContent = 'Notas & Destaques';
  fichHead.appendChild(subTitSpan);

  const grifos = criarElemento('p', 'ath-grifos-contador ath-folha-grifos-badge');
  grifos.textContent = `Grifos no PDF: ${totalGrifos}`;
  fichHead.appendChild(grifos);
  preview.appendChild(fichHead);

  const fich = ref?.fichamento || {};
  const trecho = (Array.isArray(fich.citacoesMarcadas) && fich.citacoesMarcadas[0]?.texto) || ref?.quickSummary || '';
  if (trecho) {
    const pDestaque = criarElemento('p', 'ath-folha-trecho-destaque');
    pDestaque.textContent = `“${trecho}”`;
    preview.appendChild(pDestaque);
  }

  const inputNota = criarElemento('textarea', 'ath-anotacao-rapida-input ath-folha-textarea');
  inputNota.setAttribute('placeholder', 'Digite uma nota para este artigo (salva automaticamente)...');
  const ultimasNotas = Array.isArray(ref?.pinnedNotes) && ref.pinnedNotes.length > 0 ? ref.pinnedNotes[ref.pinnedNotes.length - 1] : '';
  const textoInicial = (typeof ultimasNotas === 'string' ? ultimasNotas : (fich.resumoPessoal || '')).trim();
  inputNota.value = typeof ultimasNotas === 'string' ? ultimasNotas : (fich.resumoPessoal || '');
  inputNota.textContent = inputNota.value;
  preview.appendChild(inputNota);

  const btnSalvarNota = criarElemento('button', 'ath-btn ath-btn-sm ath-btn-salvar-anotacao');
  btnSalvarNota.setAttribute('type', 'button');
  btnSalvarNota.textContent = 'Salvar Anotação';

  // Guarda de estado para deduplicação e idempotência estrita
  let ultimaNotaSalva = textoInicial;

  const executarSalvarNota = () => {
    const txt = (inputNota.value || inputNota.textContent || '').trim();

    // 1. Rejeição de strings vazias ou compostas exclusivamente por espaços
    if (!txt) return;

    // 2. Guarda de idempotência: se o texto não foi alterado em relação à última nota salva, ignora
    if (txt === ultimaNotaSalva) return;

    // 3. Atualiza tracking antes de persistir
    ultimaNotaSalva = txt;

    // 4. Guarda estrutural em pinnedNotes: evita duplicata consecutiva no array
    if (!Array.isArray(ref.pinnedNotes)) ref.pinnedNotes = [];
    if (ref.pinnedNotes.length === 0 || ref.pinnedNotes[ref.pinnedNotes.length - 1] !== txt) {
      ref.pinnedNotes.push(txt);
    }

    // 5. Atualiza o fichamento pessoal
    if (!ref.fichamento || typeof ref.fichamento !== 'object') ref.fichamento = {};
    ref.fichamento.resumoPessoal = txt;

    // 6. Notifica o callback externo apenas quando há conteúdo novo
    if (typeof onSalvarNota === 'function') {
      onSalvarNota(txt);
    }
  };

  // Previne perda de foco prematura no mousedown do botão em navegadores
  btnSalvarNota.addEventListener('mousedown', (ev) => {
    if (ev?.preventDefault) ev.preventDefault();
  });

  btnSalvarNota.addEventListener('click', (ev) => {
    if (ev?.stopPropagation) ev.stopPropagation();
    executarSalvarNota();
  });
  preview.appendChild(btnSalvarNota);

  // Salva também ao sair do campo (blur)
  inputNota.addEventListener('blur', () => {
    executarSalvarNota();
  });

  folha.appendChild(preview);

  // 4. Ações da Folha
  const acoes = criarElemento('div', 'ath-folha-acoes');

  // Botão Primário: Estúdio de Leitura
  const btnAbrir = criarElemento('button', 'ath-btn ath-btn-primary ath-btn-abrir-leitor');
  btnAbrir.setAttribute('type', 'button');
  btnAbrir.textContent = '📖 Abrir Arquivo / Ler Referência';
  btnAbrir.addEventListener('click', (ev) => {
    if (ev?.stopPropagation) ev.stopPropagation();
    if (typeof onAbrirLeitor === 'function') {
      onAbrirLeitor(ref);
    }
  });
  acoes.appendChild(btnAbrir);

  // Botões Secundários
  const secBox = criarElemento('div', 'ath-folha-acoes-secundarias');

  if (fnEditarMeta) {
    const btnEditMeta = criarElemento('button', 'ath-btn ath-btn-sm ath-btn-soft');
    btnEditMeta.setAttribute('type', 'button');
    btnEditMeta.textContent = '✏️ Metadados';
    btnEditMeta.setAttribute('title', 'Editar metadados da obra');
    btnEditMeta.addEventListener('click', (ev) => {
      if (ev?.stopPropagation) ev.stopPropagation();
      fnEditarMeta(ref);
    });
    secBox.appendChild(btnEditMeta);
  }

  if (onMoverPasta) {
    const btnMover = criarElemento('button', 'ath-btn ath-btn-sm ath-btn-soft');
    btnMover.setAttribute('type', 'button');
    btnMover.textContent = '📁 Mover';
    btnMover.setAttribute('title', 'Mover para outra pasta');
    btnMover.addEventListener('click', (ev) => {
      if (ev?.stopPropagation) ev.stopPropagation();
      onMoverPasta(ref);
    });
    secBox.appendChild(btnMover);
  }

  if (fnMudarCor) {
    const btnCor = criarElemento('button', 'ath-btn ath-btn-sm ath-btn-soft');
    btnCor.setAttribute('type', 'button');
    btnCor.textContent = '🎨 Cor';
    btnCor.setAttribute('title', 'Alterar cor da capa');
    btnCor.addEventListener('click', (ev) => {
      if (ev?.stopPropagation) ev.stopPropagation();
      fnMudarCor(ref);
    });
    secBox.appendChild(btnCor);
  }

  if (secBox.children && secBox.children.length > 0) {
    acoes.appendChild(secBox);
  }

  // Gerenciamento de teclado dentro da folha modal (Escape para fechar e Focus Trap no Tab)
  folha.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' || ev.keyCode === 27) {
      if (ev.stopPropagation) ev.stopPropagation();
      let pai = folha.parentNode;
      while (pai && pai.classList && !pai.classList.contains('ath-livro-3d')) {
        pai = pai.parentNode;
      }
      if (pai) fecharLivro3D(pai);
      return;
    }
    if (ev.key === 'Tab' || ev.keyCode === 9) {
      const seletores = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focaveis = typeof folha.querySelectorAll === 'function'
        ? Array.from(folha.querySelectorAll(seletores)).filter(el => el && el.style?.display !== 'none')
        : [];
      if (focaveis.length > 0) {
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const ativo = (typeof document !== 'undefined') ? document.activeElement : null;
        if (ev.shiftKey) {
          if (ativo === primeiro || ativo === folha || ativo === h2) {
            if (ev.preventDefault) ev.preventDefault();
            try { ultimo.focus(); } catch (_) {}
          }
        } else {
          if (ativo === ultimo) {
            if (ev.preventDefault) ev.preventDefault();
            try { primeiro.focus(); } catch (_) {}
          }
        }
      }
    }
  });

  folha.appendChild(acoes);
  return folha;
}
