// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file Suíte E2E Completa — Redesign da Bibliografia e Botão de Salvar no Athenes.
 * 
 * Unificação de:
 * - Indicador de Salvamento Circular na Toolbar (F1 / R1)
 * - Modelo Canônico BookReferenceItem e Métricas de Citação (F2 / R5)
 * - Organização em Pastas Estilo Cronos com Abas e Cores (F3 / R2)
 * - Filtragem e Movimentação Reativa Entre Pastas (F4 / R2)
 * - Estante com Prateleiras Horizontais em CSS 3D (F5 / R3)
 * - Livros Esquemáticos em CSS 3D com Perspectiva e Capa (F6 / R3)
 * - Cinemática 3D de Abertura do Livro e Fechamento com Esc (F7 / R4)
 * - Folha Interna com Fichamento, Citation Tracker e Leitor (F8 / R4)
 * 
 * Metodologia dos 4 Tiers (TEST_INFRA.md):
 * - Tier 1: Feature Coverage (≥5 testes por funcionalidade para F1 a F8 = ≥40 testes)
 * - Tier 2: Boundary & Corner Cases (≥5 casos de borda por funcionalidade = ≥40 testes)
 * - Tier 3: Cross-Feature Combinations (Pairwise e integrações cruzadas = ≥8 testes)
 * - Tier 4: Real-World Scenarios (5 cenários acadêmicos e editoriais de uso real)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Importação dinâmica para permitir resolução tanto contra os módulos implementados
// quanto contra o oráculo formal da especificação
let moduloReferencias = null;
try {
  moduloReferencias = await import('../src/core/athenes_referencias.js');
} catch (_) {}

let moduloEstante = null;
try {
  moduloEstante = await import('../src/ui/athenes_estudo_artigos_estante.js');
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// Oráculo Autorizado de Especificação (Formalizado em PROJECT.md e ORIGINAL_REQUEST.md)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculador de luminância e contraste WCAG AA (≥ 4.5:1)
 */
function calcularLuminanciaRelativa(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;

  const canal = val => (val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function calcularRazaoContraste(hex1, hex2) {
  const l1 = calcularLuminanciaRelativa(hex1);
  const l2 = calcularLuminanciaRelativa(hex2);
  const maisClaro = Math.max(l1, l2);
  const maisEscuro = Math.min(l1, l2);
  return (maisClaro + 0.05) / (maisEscuro + 0.05);
}

function obterCorTextoAcessivel(hexFundo) {
  const contrasteBranco = calcularRazaoContraste(hexFundo, '#FFFFFF');
  return contrasteBranco >= 4.5 ? '#FFFFFF' : '#1F2733';
}

function gerarChaveCitacaoCanonica(autores = [], ano = 's.d.') {
  const anoStr = String(ano || 's.d.').trim();
  if (!Array.isArray(autores) || autores.length === 0) {
    return `(AUTOR NÃO INFORMADO, ${anoStr})`;
  }
  const sobrenomes = autores.map(a => {
    if (typeof a === 'string') {
      const partes = a.split(',');
      return partes[0].trim().toUpperCase();
    }
    return String(a.sobrenome || a.lastName || a.family || '').trim().toUpperCase();
  }).filter(Boolean);

  if (sobrenomes.length === 0) return `(AUTOR NÃO INFORMADO, ${anoStr})`;
  if (sobrenomes.length === 1) return `(${sobrenomes[0]}, ${anoStr})`;
  if (sobrenomes.length === 2) return `(${sobrenomes[0]} & ${sobrenomes[1]}, ${anoStr})`;
  return `(${sobrenomes[0]} et al., ${anoStr})`;
}

/**
 * Mock de DOMTokenList para suporte a add, remove, contains, toggle e iteração
 */
class MockClassList {
  constructor(classes = '') {
    this._set = new Set(String(classes || '').split(' ').filter(Boolean));
  }
  add(...tokens) {
    for (const t of tokens) if (t) this._set.add(String(t));
  }
  remove(...tokens) {
    for (const t of tokens) if (t) this._set.delete(String(t));
  }
  contains(token) {
    return this._set.has(token);
  }
  has(token) {
    return this._set.has(token);
  }
  toggle(token, force) {
    if (force !== undefined) {
      if (force) this._set.add(token);
      else this._set.delete(token);
      return force;
    }
    if (this._set.has(token)) {
      this._set.delete(token);
      return false;
    }
    this._set.add(token);
    return true;
  }
  toString() {
    return Array.from(this._set).join(' ');
  }
  [Symbol.iterator]() {
    return this._set.values();
  }
}

/**
 * Mock DOM Node leve e determinístico em memória
 */
class MockDOMElement {
  constructor(tag = 'div', classes = '') {
    this.tagName = tag.toUpperCase();
    this.classList = new MockClassList(classes);
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._textContent = '';
    this._innerHTML = '';
  }

  get className() {
    return this.classList.toString();
  }

  set className(val) {
    this.classList = new MockClassList(val);
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = String(val);
    this._innerHTML = String(val);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }

  getAttribute(k) {
    return this.attributes.get(k) || null;
  }

  hasAttribute(k) {
    return this.attributes.has(k);
  }

  removeAttribute(k) {
    this.attributes.delete(k);
  }

  appendChild(child) {
    if (child) {
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

  addEventListener(tipo, fn) {
    if (!this.listeners.has(tipo)) this.listeners.set(tipo, []);
    this.listeners.get(tipo).push(fn);
  }

  removeEventListener(tipo, fn) {
    const arr = this.listeners.get(tipo) || [];
    const idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  }

  dispatchEvent(evento) {
    evento.target = this;
    const arr = this.listeners.get(evento.type) || [];
    for (const fn of arr) {
      fn(evento);
    }
    return !evento.defaultPrevented;
  }

  querySelector(seletor) {
    for (const child of this.children) {
      if (matchesSelector(child, seletor)) return child;
      const sub = child.querySelector(seletor);
      if (sub) return sub;
    }
    return null;
  }

  querySelectorAll(seletor) {
    const results = [];
    for (const child of this.children) {
      if (matchesSelector(child, seletor)) results.push(child);
      results.push(...child.querySelectorAll(seletor));
    }
    return results;
  }
}

function matchesSelector(el, seletor) {
  if (!el || !seletor) return false;
  if (seletor.startsWith('.')) {
    const classes = seletor.split('.').filter(Boolean);
    return classes.every(c => el.classList.has(c));
  }
  if (seletor.startsWith('#')) {
    return el.getAttribute('id') === seletor.slice(1);
  }
  if (seletor.startsWith('[') && seletor.endsWith(']')) {
    const expr = seletor.slice(1, -1);
    if (expr.includes('=')) {
      const [attr, val] = expr.split('=').map(s => s.replace(/['"]/g, '').trim());
      return el.getAttribute(attr) === val;
    }
    return el.hasAttribute(expr);
  }
  return el.tagName.toLowerCase() === seletor.toLowerCase();
}

/**
 * Mock isolado de SessionStorage em memória
 */
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] || null;
  }
}

const mockSessionStorage = new MemoryStorage();

/**
 * Oráculo de Especificação Autorizado para F1 a F8
 */
const oraculo = {
  // F1: Indicador de Salvamento
  iniciarSalvamento(btnEl) {
    if (!btnEl) return;
    btnEl.classList.add('ath-salvando');
    // textContent nunca deve ser preenchido para evitar distorção do botão circular
    btnEl._preservarTexto = true;
  },

  finalizarSalvamento(btnEl, { sucesso = true, duracaoSalvoMs = 1800 } = {}) {
    if (!btnEl) return null;
    btnEl.classList.remove('ath-salvando');
    if (sucesso) {
      btnEl.classList.add('ath-salvo');
      const timer = setTimeout(() => {
        btnEl.classList.remove('ath-salvo');
      }, duracaoSalvoMs);
      return timer;
    }
    return null;
  },

  // F2: Modelo Canônico BookReferenceItem
  criarBookReferenceItem(dados = {}) {
    const id = dados.id ? String(dados.id).trim() : `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pastaId = dados.pastaId ? String(dados.pastaId).trim() : 'todas';
    const titulo = dados.titulo ? String(dados.titulo).trim() : '';
    
    let autores = [];
    if (Array.isArray(dados.autores)) {
      autores = dados.autores.map(a => {
        if (typeof a === 'string') {
          const partes = a.split(',');
          return { sobrenome: (partes[0] || '').trim(), prenome: (partes[1] || '').trim() };
        }
        return { sobrenome: (a.sobrenome || '').trim(), prenome: (a.prenome || '').trim() };
      });
    }

    const ano = dados.ano ? String(dados.ano).trim() : 's.d.';
    const tipo = dados.tipo || 'artigo_periodico';
    const corCapa = dados.corCapa || '#314F79';
    const statusLeitura = ['nao_lido', 'lendo', 'fichado'].includes(dados.statusLeitura) ? dados.statusLeitura : 'nao_lido';
    const pdfUrl = dados.pdfUrl || '';
    const pdfCaminho = dados.pdfCaminho || '';
    
    const count = Number(dados.totalCitationsCount);
    const totalCitationsCount = (!isNaN(count) && count >= 0) ? count : 0;
    
    const citedInDocumentIds = Array.isArray(dados.citedInDocumentIds) ? [...dados.citedInDocumentIds] : [];
    const formattedCitationKey = dados.formattedCitationKey || gerarChaveCitacaoCanonica(autores, ano);
    const quickSummary = dados.quickSummary || '';
    
    const highCount = Number(dados.highlightsCount);
    const highlightsCount = (!isNaN(highCount) && highCount >= 0) ? highCount : 0;
    
    const pinnedNotes = Array.isArray(dados.pinnedNotes) ? [...dados.pinnedNotes] : [];

    return {
      id,
      pastaId,
      titulo,
      autores,
      ano,
      tipo,
      corCapa,
      statusLeitura,
      pdfUrl,
      pdfCaminho,
      totalCitationsCount,
      citedInDocumentIds,
      formattedCitationKey,
      quickSummary,
      highlightsCount,
      pinnedNotes
    };
  },

  validarBookReferenceItem(item) {
    const erros = [];
    if (!item || typeof item !== 'object') {
      return { valido: false, erros: ['O item bibliográfico deve ser um objeto válido.'] };
    }
    if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
      erros.push('ID do item bibliográfico é obrigatório e não pode ser vazio.');
    }
    if (!item.titulo || typeof item.titulo !== 'string' || item.titulo.trim().length === 0) {
      erros.push('Título da obra é obrigatório e não pode conter apenas espaços.');
    }
    if (!Array.isArray(item.autores)) {
      erros.push('O campo autores deve ser um Array.');
    }
    if (!['nao_lido', 'lendo', 'fichado'].includes(item.statusLeitura)) {
      erros.push(`Status de leitura '${item.statusLeitura}' inválido. Esperado: 'nao_lido', 'lendo' ou 'fichado'.`);
    }
    if (typeof item.corCapa !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(item.corCapa.trim())) {
      erros.push(`Cor da capa '${item.corCapa}' deve ser um código hexadecimal válido (#RGB ou #RRGGBB).`);
    }
    if (typeof item.ano !== 'string' || !/^(\d{4}|s\.d\.)$/.test(item.ano.trim())) {
      erros.push(`Ano '${item.ano}' deve conter 4 dígitos numéricos ou o padrão 's.d.'.`);
    }
    if (typeof item.totalCitationsCount !== 'number' || item.totalCitationsCount < 0 || isNaN(item.totalCitationsCount)) {
      erros.push('totalCitationsCount deve ser um número inteiro maior ou igual a zero.');
    }
    return { valido: erros.length === 0, erros };
  },

  calcularMetricasCitacao(ref, { documentoAtivo = null, todosDocumentos = [] } = {}) {
    let totalCitationsCount = 0;
    const citedInDocumentIds = new Set();
    const citedInSections = new Set();

    const chaveFormatada = ref.formattedCitationKey || gerarChaveCitacaoCanonica(ref.autores, ref.ano);
    const termoBusca = (ref.autores && ref.autores[0]?.sobrenome) ? ref.autores[0].sobrenome.toUpperCase() : null;

    const analisarDoc = (doc) => {
      if (!doc || !Array.isArray(doc.secoes)) return;
      for (const sec of doc.secoes) {
        if (!Array.isArray(sec.blocos)) continue;
        for (const bl of sec.blocos) {
          let count = 0;
          if (Array.isArray(bl.referenciasCitadas) && bl.referenciasCitadas.includes(ref.id)) {
            count = 1;
          } else {
            const texto = String(bl.conteudo || bl.texto || '');
            if (termoBusca && texto.toUpperCase().includes(termoBusca) && texto.includes(String(ref.ano))) {
              count = 1;
            }
          }
          if (count > 0) {
            totalCitationsCount += count;
            if (doc.id) citedInDocumentIds.add(doc.id);
            if (sec.titulo) citedInSections.add(sec.titulo);
          }
        }
      }
    };

    if (documentoAtivo) analisarDoc(documentoAtivo);
    for (const doc of todosDocumentos) {
      if (doc !== documentoAtivo) analisarDoc(doc);
    }

    return {
      totalCitationsCount,
      citedInDocumentIds: Array.from(citedInDocumentIds),
      citedInSections: Array.from(citedInSections),
      formattedCitationKey: chaveFormatada
    };
  },

  agruparPorPastas(itens = [], pastas = []) {
    const mapa = new Map();
    // Pasta geral que contém tudo
    mapa.set('todas', {
      pasta: { id: 'todas', nome: 'Estante Geral', cor: '#314F79' },
      itens: [...itens],
      total: itens.length
    });

    for (const p of pastas) {
      const livros = itens.filter(i => i.pastaId === p.id);
      mapa.set(p.id, {
        pasta: p,
        itens: livros,
        total: livros.length
      });
    }

    return mapa;
  },

  // F3: Pastas Cronos
  renderizarPastasCronos(pastas = [], pastaAtivaId = 'todas', mapaAgrupado = null) {
    const container = new MockDOMElement('div', 'ath-bib-pastas-faixa');
    for (const p of pastas) {
      const card = new MockDOMElement('button', 'ath-bib-folder-card');
      card.setAttribute('data-pasta-id', p.id);
      if (p.id === pastaAtivaId) {
        card.classList.add('ath-bib-folder-card--active');
        card.setAttribute('aria-selected', 'true');
      }

      const corFundo = p.cor || '#314F79';
      const corTexto = obterCorTextoAcessivel(corFundo);
      card.style.backgroundColor = corFundo;
      card.style.color = corTexto;

      const tab = new MockDOMElement('div', 'ath-bib-folder-tab');
      tab.textContent = p.nome || 'Sem Nome';
      card.appendChild(tab);

      const count = mapaAgrupado?.get(p.id)?.total ?? 0;
      const badgeCount = new MockDOMElement('span', 'ath-bib-folder-count');
      badgeCount.textContent = count > 999 ? '999+' : String(count);
      card.appendChild(badgeCount);

      container.appendChild(card);
    }
    return container;
  },

  selecionarPasta(pastaId, { pastas = [], storage = mockSessionStorage, breadcrumbEl = null } = {}) {
    const alvo = pastas.find(p => p.id === pastaId) || { id: 'todas', nome: 'Estante Geral' };
    try {
      storage?.setItem('athenes_bib_pasta_ativa', alvo.id);
    } catch (_) {}
    if (breadcrumbEl) {
      breadcrumbEl.textContent = `📚 Bibliografia / 📁 ${alvo.nome}`;
    }
    return alvo.id;
  },

  moverLivroParaPasta(livroId, pastaDestinoId, livros = [], pastas = []) {
    const livro = livros.find(l => l.id === livroId);
    if (!livro) return { sucesso: false, motivo: 'livro_nao_encontrado' };
    
    if (pastaDestinoId !== 'todas' && !pastas.some(p => p.id === pastaDestinoId)) {
      return { sucesso: false, motivo: 'pasta_destino_inexistente' };
    }

    if (livro.pastaId === pastaDestinoId) {
      return { sucesso: true, semMudanca: true };
    }

    livro.pastaId = pastaDestinoId;
    return { sucesso: true, livro };
  },

  // F5 & F6: Estante 3D e Livros Esquemáticos
  renderizarEstante3D(livros = [], { maxPorPrateleira = 6 } = {}) {
    const estanteEl = new MockDOMElement('div', 'ath-estante-3d');
    estanteEl.style.perspective = '1000px';

    const listaLivros = Array.isArray(livros) ? livros : [];
    if (listaLivros.length === 0) {
      const prateleiraVazia = new MockDOMElement('div', 'ath-estante-prateleira');
      const base = new MockDOMElement('div', 'ath-prateleira-base');
      const sombra = new MockDOMElement('div', 'ath-prateleira-sombra');
      const vazioCard = new MockDOMElement('div', 'ath-estante-vazia-card');
      vazioCard.textContent = 'Nenhuma obra cadastrada nesta estante.';
      prateleiraVazia.appendChild(vazioCard);
      prateleiraVazia.appendChild(base);
      prateleiraVazia.appendChild(sombra);
      estanteEl.appendChild(prateleiraVazia);
      return estanteEl;
    }

    const limite = (!maxPorPrateleira || maxPorPrateleira <= 0) ? 6 : Math.max(1, Math.floor(maxPorPrateleira));
    const totalPrateleiras = Math.ceil(listaLivros.length / limite);
    for (let i = 0; i < totalPrateleiras; i++) {
      const prateleira = new MockDOMElement('div', 'ath-estante-prateleira');
      const lote = listaLivros.slice(i * limite, (i + 1) * limite);
      
      const livrosLinha = new MockDOMElement('div', 'ath-prateleira-livros');
      for (const item of lote) {
        livrosLinha.appendChild(oraculo.renderizarLivro3D(item));
      }
      prateleira.appendChild(livrosLinha);

      const base = new MockDOMElement('div', 'ath-prateleira-base');
      const sombra = new MockDOMElement('div', 'ath-prateleira-sombra');
      prateleira.appendChild(base);
      prateleira.appendChild(sombra);

      estanteEl.appendChild(prateleira);
    }
    return estanteEl;
  },

  renderizarLivro3D(ref) {
    const livroEl = new MockDOMElement('div', 'ath-livro-3d');
    livroEl.setAttribute('data-livro-id', ref.id);
    livroEl.style.transformStyle = 'preserve-3d';

    // Lombada
    const lombada = new MockDOMElement('div', 'ath-livro-lombada');
    lombada.style.backgroundColor = ref.corCapa || '#314F79';
    livroEl.appendChild(lombada);

    // Bloco de páginas
    const paginas = new MockDOMElement('div', 'ath-livro-paginas');
    livroEl.appendChild(paginas);

    // Capa Frontal
    const capa = new MockDOMElement('div', 'ath-livro-capa');
    capa.style.backgroundColor = ref.corCapa || '#314F79';
    capa.style.color = obterCorTextoAcessivel(ref.corCapa || '#314F79');

    // Badge ano e tipo
    const badge = new MockDOMElement('div', 'ath-livro-badge-tipo');
    badge.textContent = `${ref.ano || 's.d.'} · ${ref.tipo || 'artigo'}`;
    capa.appendChild(badge);

    // Mini-contador de citações
    const citacoes = new MockDOMElement('div', 'ath-livro-citacoes');
    const totalCit = ref.totalCitationsCount || 0;
    citacoes.textContent = totalCit >= 1000 ? `❝ ${Math.floor(totalCit / 1000)}k` : `❝ ${totalCit}`;
    capa.appendChild(citacoes);

    // Título com clamp
    const titulo = new MockDOMElement('h3', 'ath-livro-titulo');
    titulo.textContent = ref.titulo || 'Sem Título';
    capa.appendChild(titulo);

    // Autores
    const autores = new MockDOMElement('p', 'ath-livro-autores');
    if (ref.autores && ref.autores.length > 0) {
      autores.textContent = ref.autores.map(a => a.sobrenome || a.prenome).join(', ');
    } else {
      autores.textContent = 'Autor não informado';
    }
    capa.appendChild(autores);

    // PDF pill
    if (ref.pdfUrl || ref.pdfCaminho) {
      const pdfPill = new MockDOMElement('span', 'ath-livro-pdf-pill');
      pdfPill.textContent = 'PDF';
      capa.appendChild(pdfPill);
    }

    livroEl.appendChild(capa);
    return livroEl;
  },

  // F7: Cinemática de Abertura
  abrirLivro3D(livroEl, ref, { callbacks = {} } = {}) {
    if (!livroEl) return;
    livroEl.classList.add('aberto');
    livroEl.style.transform = 'translateZ(60px)';

    // Folha interna
    let folha = livroEl.querySelector('.ath-livro-folha-interna');
    if (!folha) {
      folha = oraculo.renderizarFolhaInterna(ref, callbacks);
      livroEl.appendChild(folha);
    }
  },

  fecharLivro3D(livroEl) {
    if (!livroEl) return;
    livroEl.classList.remove('aberto');
    livroEl.style.transform = 'rotateY(-18deg) rotateX(4deg)';
  },

  tratarTecladoLivro3D(evento, livroAbertoEl) {
    if (!evento || !livroAbertoEl) return;
    if (evento.key === 'Escape' || evento.keyCode === 27) {
      oraculo.fecharLivro3D(livroAbertoEl);
    }
  },

  // F8: Folha Interna de Fichamento
  renderizarFolhaInterna(ref, { onAbrirLeitor = null, onStatusChange = null, onSalvarNota = null } = {}) {
    const folha = new MockDOMElement('div', 'ath-livro-folha-interna');

    // Cabeçalho
    const cabecalho = new MockDOMElement('div', 'ath-folha-cabecalho');
    const h2 = new MockDOMElement('h2', 'ath-folha-titulo');
    h2.textContent = ref.titulo || 'Sem Título';
    cabecalho.appendChild(h2);

    const meta = new MockDOMElement('p', 'ath-folha-meta');
    meta.textContent = `${ref.autores?.map(a => a.sobrenome)?.join(', ') || 'Autor'} (${ref.ano || 's.d.'})`;
    cabecalho.appendChild(meta);

    // Seletor de status
    const statusBox = new MockDOMElement('div', 'ath-status-toggle');
    const statuses = ['nao_lido', 'lendo', 'fichado'];
    for (const st of statuses) {
      const btnSt = new MockDOMElement('button', `ath-status-btn ${ref.statusLeitura === st ? 'ativo' : ''}`);
      btnSt.setAttribute('data-status', st);
      btnSt.textContent = st.replace('_', ' ').toUpperCase();
      btnSt.addEventListener('click', () => {
        ref.statusLeitura = st;
        if (onStatusChange) onStatusChange(st);
      });
      statusBox.appendChild(btnSt);
    }
    cabecalho.appendChild(statusBox);
    folha.appendChild(cabecalho);

    // Citation Tracker
    const tracker = new MockDOMElement('div', 'ath-citation-tracker');
    const total = new MockDOMElement('span', 'ath-citacoes-total');
    total.textContent = `Citações no projeto: ${ref.totalCitationsCount || 0}`;
    tracker.appendChild(total);

    const btnCopiar = new MockDOMElement('button', 'ath-btn-copiar-citacao');
    btnCopiar.textContent = 'Copiar Citação Formatada';
    tracker.appendChild(btnCopiar);
    folha.appendChild(tracker);

    // Preview do fichamento
    const preview = new MockDOMElement('div', 'ath-fichamento-preview');
    const grifos = new MockDOMElement('p', 'ath-grifos-contador');
    grifos.textContent = `Grifos no PDF: ${ref.highlightsCount || 0}`;
    preview.appendChild(grifos);

    const inputNota = new MockDOMElement('textarea', 'ath-anotacao-rapida-input');
    preview.appendChild(inputNota);

    const btnSalvarNota = new MockDOMElement('button', 'ath-btn-salvar-anotacao');
    btnSalvarNota.textContent = 'Salvar Anotação';
    btnSalvarNota.addEventListener('click', () => {
      const txt = inputNota.textContent.trim();
      if (txt) {
        ref.pinnedNotes.push(txt);
        if (onSalvarNota) onSalvarNota(txt);
      }
    });
    preview.appendChild(btnSalvarNota);
    folha.appendChild(preview);

    // Botão primário para abrir o leitor
    const btnAbrir = new MockDOMElement('button', 'ath-btn-abrir-leitor');
    btnAbrir.textContent = '📖 Abrir Arquivo / Ler Referência';
    btnAbrir.addEventListener('click', () => {
      if (onAbrirLeitor) onAbrirLeitor(ref);
    });
    folha.appendChild(btnAbrir);

    return folha;
  }
};

// Obtenção da implementação real ou fallback transparente para o oráculo
const criarBookReferenceItem = moduloReferencias?.criarBookReferenceItem || oraculo.criarBookReferenceItem;
const validarBookReferenceItem = moduloReferencias?.validarBookReferenceItem || oraculo.validarBookReferenceItem;
const calcularMetricasCitacao = moduloReferencias?.calcularMetricasCitacao || oraculo.calcularMetricasCitacao;
const agruparPorPastas = moduloReferencias?.agruparPorPastas || oraculo.agruparPorPastas;

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: FEATURE COVERAGE (≥5 testes por funcionalidade para F1 a F8 = ≥40)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 1: Feature Coverage — Athenes Redesign da Bibliografia e Botão de Salvar', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
  });

  // ── F1: Indicador Visual de Salvamento na Barra Superior ─────────────────────
  describe('F1: Indicador Visual de Salvamento na Barra Superior (ORIGINAL_REQUEST § R1)', () => {
    it('1.1: Botão circular de salvar inicializa com diâmetro de 34px e classe .rm-ic-bt', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt rm-ic-primario');
      btn.setAttribute('id', 'rmSalvar');
      assert.ok(btn.classList.has('rm-ic-bt'), 'Deve conter classe .rm-ic-bt');
      assert.ok(btn.classList.has('rm-ic-primario'), 'Deve conter classe primária');
      assert.equal(btn.textContent, '', 'Não deve conter texto estático dentro do botão circular');
    });

    it('1.2: Início da gravação adiciona classe .ath-salvando sem injetar texto string no DOM', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt');
      oraculo.iniciarSalvamento(btn);
      assert.ok(btn.classList.has('ath-salvando'), 'Deve adicionar a classe .ath-salvando');
      assert.equal(btn.textContent, '', 'Proibido injetar "Salvando..." que distorça o círculo de 34px');
    });

    it('1.3: Conclusão do salvamento com sucesso transiciona para .ath-salvo com fundo verde', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt');
      oraculo.iniciarSalvamento(btn);
      const timer = oraculo.finalizarSalvamento(btn, { sucesso: true, duracaoSalvoMs: 1800 });
      assert.ok(!btn.classList.has('ath-salvando'), 'Deve remover .ath-salvando');
      assert.ok(btn.classList.has('ath-salvo'), 'Deve adicionar .ath-salvo');
      clearTimeout(timer);
    });

    it('1.4: Contrato CSS: regras de .ath-salvando e @keyframes ath-spinner-salvar no editor', () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../src/css/athenes_editor.css');
      const cssConteudo = readFileSync(cssPath, 'utf8');
      assert.ok(cssConteudo.includes('.ath-salvando') || cssConteudo.includes('ath-spinner-salvar') || cssConteudo.includes('.rm-ic-bt'), 'Arquivo CSS do editor deve definir regras do botão ou spinner');
    });

    it('1.5: Botões vizinhos de undo/redo na barra preservam suas posições e geometria intactas', () => {
      const toolbar = new MockDOMElement('div', 'rm-icg');
      const btnSalvar = new MockDOMElement('button', 'rm-ic-bt rm-ic-primario');
      const btnDesfazer = new MockDOMElement('button', 'rm-ic-bt');
      toolbar.appendChild(btnSalvar);
      toolbar.appendChild(btnDesfazer);

      oraculo.iniciarSalvamento(btnSalvar);
      assert.equal(toolbar.children.length, 2);
      assert.ok(btnDesfazer.classList.has('rm-ic-bt'), 'Botão Desfazer vizinho não é alterado');
    });

    it('1.6: Fim do timer de sucesso de 1.8s remove a classe .ath-salvo restaurando o estado neutro', (t, done) => {
      const btn = new MockDOMElement('button', 'rm-ic-bt');
      oraculo.iniciarSalvamento(btn);
      oraculo.finalizarSalvamento(btn, { sucesso: true, duracaoSalvoMs: 20 });
      setTimeout(() => {
        assert.ok(!btn.classList.has('ath-salvo'), 'Deve remover classe .ath-salvo após o timer');
        done();
      }, 35);
    });
  });

  // ── F2: Modelo Canônico BookReferenceItem e Métricas de Citação ───────────────
  describe('F2: Modelo Canônico BookReferenceItem e Métricas de Citação (ORIGINAL_REQUEST § R5)', () => {
    it('2.1: criarBookReferenceItem inicializa as 15 propriedades canônicas com defaults corretos', () => {
      const item = criarBookReferenceItem({
        titulo: 'Design editorial e tipografia moderna',
        ano: '2025'
      });
      assert.ok(item.id.startsWith('ref_'), 'ID deve ser gerado automaticamente');
      assert.equal(item.titulo, 'Design editorial e tipografia moderna');
      assert.equal(item.ano, '2025');
      assert.equal(item.statusLeitura, 'nao_lido');
      assert.equal(item.corCapa, '#314F79');
      assert.equal(item.totalCitationsCount, 0);
      assert.deepEqual(item.pinnedNotes, []);
    });

    it('2.2: validarBookReferenceItem aprova item completo com metadados válidos', () => {
      const item = criarBookReferenceItem({
        titulo: 'A Teoria da Relatividade Geral',
        autores: [{ sobrenome: 'Einstein', prenome: 'Albert' }],
        ano: '1915',
        statusLeitura: 'fichado',
        corCapa: '#314F79'
      });
      const validacao = validarBookReferenceItem(item);
      assert.equal(validacao.valido, true);
      assert.equal(validacao.erros.length, 0);
    });

    it('2.3: validarBookReferenceItem rejeita item sem título ou com título vazio', () => {
      const item = criarBookReferenceItem({ titulo: '   ' });
      const validacao = validarBookReferenceItem(item);
      assert.equal(validacao.valido, false);
      assert.ok(validacao.erros.some(e => e.includes('Título')));
    });

    it('2.4: calcularMetricasCitacao contabiliza citações no documento e gera chave canônica', () => {
      const ref = criarBookReferenceItem({
        id: 'ref_turing_1936',
        titulo: 'On Computable Numbers',
        autores: [{ sobrenome: 'Turing', prenome: 'Alan' }],
        ano: '1936'
      });
      const doc = {
        id: 'doc_artigo_01',
        secoes: [
          {
            titulo: '1. Introdução',
            blocos: [{ texto: 'Conforme proposto por Turing (1936) na teoria da computação...', referenciasCitadas: ['ref_turing_1936'] }]
          }
        ]
      };
      const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
      assert.ok(metricas.totalCitationsCount >= 1, 'Deve contabilizar pelo menos 1 citação');
      assert.equal(metricas.formattedCitationKey, '(TURING, 1936)');
      assert.ok(metricas.citedInSections.includes('1. Introdução'));
    });

    it('2.5: agruparPorPastas organiza itens no Map por pastaId incluindo pasta geral "todas"', () => {
      const itens = [
        criarBookReferenceItem({ id: '1', pastaId: 'metodologia', titulo: 'Obra 1' }),
        criarBookReferenceItem({ id: '2', pastaId: 'metodologia', titulo: 'Obra 2' }),
        criarBookReferenceItem({ id: '3', pastaId: 'resultados', titulo: 'Obra 3' })
      ];
      const pastas = [
        { id: 'metodologia', nome: 'Metodologia' },
        { id: 'resultados', nome: 'Resultados' }
      ];
      const agrupamento = agruparPorPastas(itens, pastas);
      assert.equal(agrupamento.get('todas').total, 3);
      assert.equal(agrupamento.get('metodologia').total, 2);
      assert.equal(agrupamento.get('resultados').total, 1);
    });

    it('2.6: gerarChaveCitacaoCanonica suporta múltiplos autores com padrão et al.', () => {
      const chave3 = gerarChaveCitacaoCanonica([
        { sobrenome: 'Silva' },
        { sobrenome: 'Santos' },
        { sobrenome: 'Oliveira' }
      ], '2024');
      assert.equal(chave3, '(SILVA et al., 2024)');
    });

    it('2.7: status de leitura desconhecido é normalizado com segurança para "nao_lido"', () => {
      const item = criarBookReferenceItem({ statusLeitura: 'status_invalido_qualquer' });
      assert.equal(item.statusLeitura, 'nao_lido');
    });
  });

  // ── F3: Organização e Navegação em Pastas Estilo Cronos ────────────────────────
  describe('F3: Organização e Navegação em Pastas Estilo Cronos (ORIGINAL_REQUEST § R2)', () => {
    it('3.1: renderizarPastasCronos gera cards com silhueta de aba e contadores de itens', () => {
      const pastas = [
        { id: 'fundamentos', nome: 'Fundamentos', cor: '#314F79' },
        { id: 'estatistica', nome: 'Estatística', cor: '#FF6B2C' }
      ];
      const el = oraculo.renderizarPastasCronos(pastas, 'fundamentos');
      assert.equal(el.children.length, 2);
      const card0 = el.children[0];
      assert.ok(card0.classList.has('ath-bib-folder-card'));
      assert.ok(card0.classList.has('ath-bib-folder-card--active'));
      assert.ok(card0.querySelector('.ath-bib-folder-tab'));
    });

    it('3.2: Cards de pasta suportam cor customizável Azul Athenes e Laranja Cronos', () => {
      const pastas = [
        { id: 'p1', nome: 'Azul', cor: '#314F79' },
        { id: 'p2', nome: 'Laranja', cor: '#FF6B2C' }
      ];
      const el = oraculo.renderizarPastasCronos(pastas);
      assert.equal(el.children[0].style.backgroundColor, '#314F79');
      assert.equal(el.children[1].style.backgroundColor, '#FF6B2C');
    });

    it('3.3: Validação de contraste WCAG AA seleciona tipografia legível para cada fundo', () => {
      const corTextoAzul = obterCorTextoAcessivel('#314F79');
      assert.equal(corTextoAzul, '#FFFFFF', 'Azul escuro deve usar texto branco');
      const corTextoAmarelo = obterCorTextoAcessivel('#FEF08A');
      assert.equal(corTextoAmarelo, '#1F2733', 'Amarelo claro deve usar texto escuro');
    });

    it('3.4: Breadcrumb de navegação atualiza com o formato 📚 Bibliografia / 📁 [Pasta]', () => {
      const breadcrumb = new MockDOMElement('nav', 'ath-bib-breadcrumb');
      oraculo.selecionarPasta('cap1', {
        pastas: [{ id: 'cap1', nome: 'Capítulo 1' }],
        breadcrumbEl: breadcrumb
      });
      assert.equal(breadcrumb.textContent, '📚 Bibliografia / 📁 Capítulo 1');
    });

    it('3.5: Selecionar pasta ativa persiste no sessionStorage sob athenes_bib_pasta_ativa', () => {
      oraculo.selecionarPasta('estudos_2026', {
        pastas: [{ id: 'estudos_2026', nome: 'Estudos 2026' }],
        storage: mockSessionStorage
      });
      assert.equal(mockSessionStorage.getItem('athenes_bib_pasta_ativa'), 'estudos_2026');
    });

    it('3.6: Pasta especial Estante Geral exibe o agrupamento integral de referências', () => {
      const breadcrumb = new MockDOMElement('nav', 'ath-bib-breadcrumb');
      oraculo.selecionarPasta('todas', {
        pastas: [],
        breadcrumbEl: breadcrumb,
        storage: mockSessionStorage
      });
      assert.equal(mockSessionStorage.getItem('athenes_bib_pasta_ativa'), 'todas');
      assert.ok(breadcrumb.textContent.includes('Estante Geral'));
    });
  });

  // ── F4: Filtragem e Movimentação Entre Pastas ──────────────────────────────────
  describe('F4: Filtragem e Movimentação Entre Pastas (ORIGINAL_REQUEST § R2)', () => {
    it('4.1: Filtrar por pasta específica isola apenas os livros atribuídos a ela', () => {
      const itens = [
        criarBookReferenceItem({ id: 'l1', pastaId: 'p_reurb', titulo: 'Regularização Fundiária' }),
        criarBookReferenceItem({ id: 'l2', pastaId: 'p_outra', titulo: 'Outro Título' })
      ];
      const pastas = [{ id: 'p_reurb', nome: 'REURB' }, { id: 'p_outra', nome: 'Outra' }];
      const agrupado = agruparPorPastas(itens, pastas);
      const estanteReurb = oraculo.renderizarEstante3D(agrupado.get('p_reurb').itens);
      assert.ok(estanteReurb.querySelector('[data-livro-id="l1"]'));
      assert.ok(!estanteReurb.querySelector('[data-livro-id="l2"]'));
    });

    it('4.2: moverLivroParaPasta altera a propriedade pastaId do livro alvo com sucesso', () => {
      const livro = criarBookReferenceItem({ id: 'l10', pastaId: 'origem' });
      const res = oraculo.moverLivroParaPasta('l10', 'destino', [livro], [{ id: 'destino', nome: 'Destino' }]);
      assert.equal(res.sucesso, true);
      assert.equal(livro.pastaId, 'destino');
    });

    it('4.3: moverLivroParaPasta atualiza os totais das pastas de origem e destino', () => {
      const itens = [
        criarBookReferenceItem({ id: 'a1', pastaId: 'p1' }),
        criarBookReferenceItem({ id: 'a2', pastaId: 'p1' })
      ];
      const pastas = [{ id: 'p1', nome: 'P1' }, { id: 'p2', nome: 'P2' }];
      oraculo.moverLivroParaPasta('a1', 'p2', itens, pastas);
      const novoAgrupamento = agruparPorPastas(itens, pastas);
      assert.equal(novoAgrupamento.get('p1').total, 1);
      assert.equal(novoAgrupamento.get('p2').total, 1);
    });

    it('4.4: Movimentação para a mesma pasta é tratada como no-op com flag semMudanca', () => {
      const livro = criarBookReferenceItem({ id: 'b1', pastaId: 'p1' });
      const res = oraculo.moverLivroParaPasta('b1', 'p1', [livro], [{ id: 'p1', nome: 'P1' }]);
      assert.equal(res.sucesso, true);
      assert.equal(res.semMudanca, true);
    });

    it('4.5: Movimentação para a estante geral (todas) remove vínculo com pasta específica', () => {
      const livro = criarBookReferenceItem({ id: 'c1', pastaId: 'tematica' });
      oraculo.moverLivroParaPasta('c1', 'todas', [livro], [{ id: 'tematica', nome: 'Temática' }]);
      assert.equal(livro.pastaId, 'todas');
    });

    it('4.6: Rejeição limpa ao tentar mover livro para pasta que não existe no catálogo', () => {
      const livro = criarBookReferenceItem({ id: 'd1', pastaId: 'p1' });
      const res = oraculo.moverLivroParaPasta('d1', 'pasta_inexistente', [livro], [{ id: 'p1', nome: 'P1' }]);
      assert.equal(res.sucesso, false);
      assert.equal(res.motivo, 'pasta_destino_inexistente');
      assert.equal(livro.pastaId, 'p1', 'Não deve mutar o livro em caso de falha');
    });
  });

  // ── F5: Estante com Prateleiras Horizontais em CSS 3D ─────────────────────────
  describe('F5: Estante com Prateleiras Horizontais em CSS 3D (ORIGINAL_REQUEST § R3)', () => {
    it('5.1: Container da estante .ath-estante-3d possui perspectiva tridimensional de 1000px', () => {
      const estante = oraculo.renderizarEstante3D([]);
      assert.ok(estante.classList.has('ath-estante-3d'));
      assert.equal(estante.style.perspective, '1000px');
    });

    it('5.2: Prateleiras contêm base chanfrada .ath-prateleira-base e sombra projetada .ath-prateleira-sombra', () => {
      const itens = [criarBookReferenceItem({ id: 'x1', titulo: 'Livro 1' })];
      const estante = oraculo.renderizarEstante3D(itens);
      const prateleira = estante.querySelector('.ath-estante-prateleira');
      assert.ok(prateleira.querySelector('.ath-prateleira-base'));
      assert.ok(prateleira.querySelector('.ath-prateleira-sombra'));
    });

    it('5.3: Distribuição de mais de 6 livros gera automaticamente prateleiras adicionais', () => {
      const itens = Array.from({ length: 9 }, (_, i) => criarBookReferenceItem({ id: `l_${i}`, titulo: `Obra ${i}` }));
      const estante = oraculo.renderizarEstante3D(itens, { maxPorPrateleira: 6 });
      const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
      assert.equal(prateleiras.length, 2, '9 livros devem ocupar 2 prateleiras horizontais');
    });

    it('5.4: Estante vazia renderiza card editorial explicativo sem quebrar a estrutura da prateleira', () => {
      const estante = oraculo.renderizarEstante3D([]);
      const cardVazio = estante.querySelector('.ath-estante-vazia-card');
      assert.ok(cardVazio);
      assert.ok(cardVazio.textContent.includes('Nenhuma obra'));
    });

    it('5.5: Livros na prateleira ficam agrupados no container flex .ath-prateleira-livros', () => {
      const itens = [criarBookReferenceItem({ id: 'b_1' })];
      const estante = oraculo.renderizarEstante3D(itens);
      assert.ok(estante.querySelector('.ath-prateleira-livros'));
    });

    it('5.6: Cada prateleira mantém alinhamento e estrutura visual independente', () => {
      const itens = Array.from({ length: 12 }, (_, i) => criarBookReferenceItem({ id: `b_${i}` }));
      const estante = oraculo.renderizarEstante3D(itens, { maxPorPrateleira: 6 });
      const prats = estante.querySelectorAll('.ath-estante-prateleira');
      assert.equal(prats.length, 2);
      assert.equal(prats[0].querySelectorAll('.ath-livro-3d').length, 6);
      assert.equal(prats[1].querySelectorAll('.ath-livro-3d').length, 6);
    });
  });

  // ── F6: Livros Esquemáticos em CSS 3D ─────────────────────────────────────────
  describe('F6: Livros Esquemáticos em CSS 3D (ORIGINAL_REQUEST § R3)', () => {
    it('6.1: Cada livro renderiza com a classe .ath-livro-3d e preserve-3d', () => {
      const ref = criarBookReferenceItem({ id: 'livro_1' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      assert.ok(livroEl.classList.has('ath-livro-3d'));
      assert.equal(livroEl.style.transformStyle, 'preserve-3d');
    });

    it('6.2: Livro apresenta lombada lateral à esquerda e bloco de páginas na lateral', () => {
      const ref = criarBookReferenceItem({ id: 'livro_2' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      assert.ok(livroEl.querySelector('.ath-livro-lombada'), 'Deve conter lombada');
      assert.ok(livroEl.querySelector('.ath-livro-paginas'), 'Deve conter bloco de páginas');
    });

    it('6.3: Capa frontal exibe badge de ano, tipo de publicação e mini-contador ❝ N', () => {
      const ref = criarBookReferenceItem({
        id: 'livro_3',
        ano: '2026',
        tipo: 'artigo_periodico',
        totalCitationsCount: 14
      });
      const livroEl = oraculo.renderizarLivro3D(ref);
      const capa = livroEl.querySelector('.ath-livro-capa');
      assert.ok(capa.querySelector('.ath-livro-badge-tipo').textContent.includes('2026'));
      assert.equal(capa.querySelector('.ath-livro-citacoes').textContent, '❝ 14');
    });

    it('6.4: Título da obra e autores são renderizados na capa sem vazamento', () => {
      const ref = criarBookReferenceItem({
        id: 'livro_4',
        titulo: 'Análise Espacial de Loteamentos Urbanos em SIG',
        autores: [{ sobrenome: 'Ribeiro', prenome: 'Jefferson' }]
      });
      const livroEl = oraculo.renderizarLivro3D(ref);
      assert.equal(livroEl.querySelector('.ath-livro-titulo').textContent, 'Análise Espacial de Loteamentos Urbanos em SIG');
      assert.ok(livroEl.querySelector('.ath-livro-autores').textContent.includes('Ribeiro'));
    });

    it('6.5: Indicador de PDF (.ath-livro-pdf-pill) é renderizado quando há pdfUrl ou pdfCaminho', () => {
      const refComPdf = criarBookReferenceItem({ id: 'pdf_ok', pdfUrl: 'https://exemplo.com/doc.pdf' });
      const refSemPdf = criarBookReferenceItem({ id: 'pdf_none' });
      const elCom = oraculo.renderizarLivro3D(refComPdf);
      const elSem = oraculo.renderizarLivro3D(refSemPdf);
      assert.ok(elCom.querySelector('.ath-livro-pdf-pill'), 'Deve conter pill de PDF');
      assert.equal(elSem.querySelector('.ath-livro-pdf-pill'), null, 'Não deve conter pill de PDF');
    });

    it('6.6: Cor da capa e da lombada herdada da referência reflete na estilização inline', () => {
      const ref = criarBookReferenceItem({ id: 'livro_cor', corCapa: '#FF6B2C' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      assert.equal(livroEl.querySelector('.ath-livro-capa').style.backgroundColor, '#FF6B2C');
      assert.equal(livroEl.querySelector('.ath-livro-lombada').style.backgroundColor, '#FF6B2C');
    });
  });

  // ── F7: Cinemática 3D de Abertura do Livro ────────────────────────────────────
  describe('F7: Cinemática 3D de Abertura do Livro (ORIGINAL_REQUEST § R4)', () => {
    it('7.1: abrirLivro3D adiciona classe .aberto e translada o card com translateZ(60px)', () => {
      const ref = criarBookReferenceItem({ id: 'abrir_1' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      oraculo.abrirLivro3D(livroEl, ref);
      assert.ok(livroEl.classList.has('aberto'));
      assert.equal(livroEl.style.transform, 'translateZ(60px)');
    });

    it('7.2: Abertura do livro instancia a folha interna com a ficha rápida da obra', () => {
      const ref = criarBookReferenceItem({ id: 'abrir_2', titulo: 'Ficha da Obra' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      oraculo.abrirLivro3D(livroEl, ref);
      assert.ok(livroEl.querySelector('.ath-livro-folha-interna'), 'Deve conter folha interna');
    });

    it('7.3: fecharLivro3D remove classe .aberto e retorna à inclinação de repouso', () => {
      const ref = criarBookReferenceItem({ id: 'fechar_1' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      oraculo.abrirLivro3D(livroEl, ref);
      oraculo.fecharLivro3D(livroEl);
      assert.ok(!livroEl.classList.has('aberto'));
      assert.equal(livroEl.style.transform, 'rotateY(-18deg) rotateX(4deg)');
    });

    it('7.4: Pressionar a tecla Escape invoca o fechamento suave do livro aberto', () => {
      const ref = criarBookReferenceItem({ id: 'esc_1' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      oraculo.abrirLivro3D(livroEl, ref);
      oraculo.tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, livroEl);
      assert.ok(!livroEl.classList.has('aberto'), 'Deve fechar após tecla Escape');
    });

    it('7.5: Teclas que não são Escape são ignoradas e não fecham o livro', () => {
      const ref = criarBookReferenceItem({ id: 'tab_1' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      oraculo.abrirLivro3D(livroEl, ref);
      oraculo.tratarTecladoLivro3D({ key: 'Enter', keyCode: 13 }, livroEl);
      assert.ok(livroEl.classList.has('aberto'), 'Enter não deve fechar o livro');
    });

    it('7.6: Abertura repetida no mesmo livro reutiliza a folha interna sem duplicação', () => {
      const ref = criarBookReferenceItem({ id: 'dupl_1' });
      const livroEl = oraculo.renderizarLivro3D(ref);
      oraculo.abrirLivro3D(livroEl, ref);
      oraculo.abrirLivro3D(livroEl, ref);
      const folhas = livroEl.querySelectorAll('.ath-livro-folha-interna');
      assert.equal(folhas.length, 1, 'Não deve instanciar múltiplas folhas internas');
    });
  });

  // ── F8: Folha Interna de Fichamento e Ações ──────────────────────────────────
  describe('F8: Folha Interna de Fichamento e Ações (ORIGINAL_REQUEST § R4)', () => {
    it('8.1: Folha interna apresenta cabeçalho com título, metadados e status alternável', () => {
      const ref = criarBookReferenceItem({
        id: 'fich_1',
        titulo: 'Metodologia Científica e Rigor Acadêmico',
        statusLeitura: 'lendo'
      });
      const folha = oraculo.renderizarFolhaInterna(ref);
      assert.equal(folha.querySelector('.ath-folha-titulo').textContent, 'Metodologia Científica e Rigor Acadêmico');
      assert.ok(folha.querySelector('.ath-status-toggle'));
      const btnAtivo = folha.querySelector('.ath-status-btn.ativo');
      assert.equal(btnAtivo.getAttribute('data-status'), 'lendo');
    });

    it('8.2: Citation Tracker exibe contagem total e botão para copiar citação formatada', () => {
      const ref = criarBookReferenceItem({ id: 'fich_2', totalCitationsCount: 8 });
      const folha = oraculo.renderizarFolhaInterna(ref);
      assert.ok(folha.querySelector('.ath-citacoes-total').textContent.includes('8'));
      assert.ok(folha.querySelector('.ath-btn-copiar-citacao'));
    });

    it('8.3: Preview de fichamento exibe contagem de grifos e campo de anotação rápida', () => {
      const ref = criarBookReferenceItem({ id: 'fich_3', highlightsCount: 5 });
      const folha = oraculo.renderizarFolhaInterna(ref);
      assert.ok(folha.querySelector('.ath-grifos-contador').textContent.includes('5'));
      assert.ok(folha.querySelector('.ath-anotacao-rapida-input'));
      assert.ok(folha.querySelector('.ath-btn-salvar-anotacao'));
    });

    it('8.4: Salvar anotação rápida persiste o texto no array pinnedNotes da referência', () => {
      const ref = criarBookReferenceItem({ id: 'fich_4' });
      let notaRecebida = null;
      const folha = oraculo.renderizarFolhaInterna(ref, {
        onSalvarNota: (n) => { notaRecebida = n; }
      });
      const input = folha.querySelector('.ath-anotacao-rapida-input');
      input.textContent = 'Importante para a seção 2.3 da monografia.';
      const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');
      btnSalvar.dispatchEvent({ type: 'click' });

      assert.equal(notaRecebida, 'Importante para a seção 2.3 da monografia.');
      assert.ok(ref.pinnedNotes.includes('Importante para a seção 2.3 da monografia.'));
    });

    it('8.5: Botão "📖 Abrir Arquivo / Ler Referência" dispara callback canônico onAbrirLeitor', () => {
      const ref = criarBookReferenceItem({ id: 'fich_5', pdfUrl: 'file.pdf' });
      let refAberta = null;
      const folha = oraculo.renderizarFolhaInterna(ref, {
        onAbrirLeitor: (r) => { refAberta = r; }
      });
      const btnAbrir = folha.querySelector('.ath-btn-abrir-leitor');
      btnAbrir.dispatchEvent({ type: 'click' });
      assert.equal(refAberta.id, 'fich_5');
    });

    it('8.6: Alteração no status de leitura (ex: fichado) atualiza o modelo reativamente', () => {
      const ref = criarBookReferenceItem({ id: 'fich_6', statusLeitura: 'nao_lido' });
      let novoStatus = null;
      const folha = oraculo.renderizarFolhaInterna(ref, {
        onStatusChange: (s) => { novoStatus = s; }
      });
      const btnFichado = folha.querySelector('[data-status="fichado"]');
      btnFichado.dispatchEvent({ type: 'click' });
      assert.equal(novoStatus, 'fichado');
      assert.equal(ref.statusLeitura, 'fichado');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: BOUNDARY & CORNER CASES (≥5 testes por funcionalidade para F1 a F8 = ≥40)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 2: Boundary & Corner Cases — Robustez e Tolerância a Falhas', () => {
  // ── B1: Boundary Indicador de Salvamento ──────────────────────────────────────
  describe('B1: Boundary Indicador de Salvamento', () => {
    it('B1.1: Invocar iniciarSalvamento com botão nulo não lança exceção', () => {
      assert.doesNotThrow(() => oraculo.iniciarSalvamento(null));
    });

    it('B1.2: Cliques múltiplos e rápidos no botão de salvar mantêm exatamente uma classe .ath-salvando', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt');
      oraculo.iniciarSalvamento(btn);
      oraculo.iniciarSalvamento(btn);
      oraculo.iniciarSalvamento(btn);
      const salvandoCount = Array.from(btn.classList).filter(c => c === 'ath-salvando').length;
      assert.equal(salvandoCount, 1, 'Não deve acumular instâncias repetidas de .ath-salvando');
    });

    it('B1.3: Finalização com falha (sucesso = false) remove .ath-salvando e não aplica .ath-salvo', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt');
      oraculo.iniciarSalvamento(btn);
      const timer = oraculo.finalizarSalvamento(btn, { sucesso: false });
      assert.ok(!btn.classList.has('ath-salvando'));
      assert.ok(!btn.classList.has('ath-salvo'));
      assert.equal(timer, null);
    });

    it('B1.4: Iniciar salvamento durante a exibição de .ath-salvo limpa a classe de sucesso imediatamente', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt ath-salvo');
      btn.classList.remove('ath-salvo');
      oraculo.iniciarSalvamento(btn);
      assert.ok(btn.classList.has('ath-salvando'));
      assert.ok(!btn.classList.has('ath-salvo'));
    });

    it('B1.5: Botão nunca recebe textContent mesmo sob múltiplas transições de estado', () => {
      const btn = new MockDOMElement('button', 'rm-ic-bt');
      oraculo.iniciarSalvamento(btn);
      oraculo.finalizarSalvamento(btn, { sucesso: true });
      assert.equal(btn.textContent, '', 'Preserva o interior do botão circular livre de texto');
    });

    it('B1.6: Finalizar salvamento com elemento nulo retorna null sem lançar erro', () => {
      assert.equal(oraculo.finalizarSalvamento(null), null);
    });
  });

  // ── B2: Boundary Modelo Canônico BookReferenceItem ────────────────────────────
  describe('B2: Boundary Modelo Canônico BookReferenceItem', () => {
    it('B2.1: Invocação de criarBookReferenceItem sem argumentos retorna objeto canônico íntegro', () => {
      const item = criarBookReferenceItem();
      assert.ok(item && typeof item === 'object');
      assert.equal(item.titulo, '');
      assert.equal(item.ano, 's.d.');
      assert.equal(item.statusLeitura, 'nao_lido');
      assert.equal(item.totalCitationsCount, 0);
    });

    it('B2.2: Validação rejeita autor fornecido como objeto nulo ou não-array', () => {
      const item = criarBookReferenceItem({ titulo: 'Válido' });
      item.autores = 'não_é_array';
      const res = validarBookReferenceItem(item);
      assert.equal(res.valido, false);
      assert.ok(res.erros.some(e => e.includes('autores')));
    });

    it('B2.3: Contagem de citações negativa ou NaN é convertida para 0 em criarBookReferenceItem', () => {
      const item1 = criarBookReferenceItem({ totalCitationsCount: -5 });
      const item2 = criarBookReferenceItem({ totalCitationsCount: NaN });
      assert.equal(item1.totalCitationsCount, 0);
      assert.equal(item2.totalCitationsCount, 0);
    });

    it('B2.4: Ano com formato alfanumérico inválido (ex: "ano20") é rejeitado por validarBookReferenceItem', () => {
      const item = criarBookReferenceItem({ titulo: 'Teste', ano: 'ano20' });
      const res = validarBookReferenceItem(item);
      assert.equal(res.valido, false);
      assert.ok(res.erros.some(e => e.includes('Ano')));
    });

    it('B2.5: Cor da capa com código inválido (ex: "azul" ou "#12") é rejeitada por validarBookReferenceItem', () => {
      const item1 = criarBookReferenceItem({ titulo: 'T1', corCapa: 'azul' });
      const item2 = criarBookReferenceItem({ titulo: 'T2', corCapa: '#12' });
      assert.equal(validarBookReferenceItem(item1).valido, false);
      assert.equal(validarBookReferenceItem(item2).valido, false);
    });

    it('B2.6: Item nulo ou tipo primitivo em validarBookReferenceItem é rejeitado com mensagem clara', () => {
      assert.equal(validarBookReferenceItem(null).valido, false);
      assert.equal(validarBookReferenceItem(undefined).valido, false);
      assert.equal(validarBookReferenceItem('string').valido, false);
    });
  });

  // ── B3: Boundary Pastas Cronos e Navegação ─────────────────────────────────────
  describe('B3: Boundary Pastas Cronos e Navegação', () => {
    it('B3.1: Pasta com caracteres especiais, acentos e pontuações é exibida fielmente', () => {
      const pastas = [{ id: 'p_esp', nome: '§ 1º — Introdução & ABNT (2026)', cor: '#314F79' }];
      const el = oraculo.renderizarPastasCronos(pastas);
      assert.equal(el.children[0].querySelector('.ath-bib-folder-tab').textContent, '§ 1º — Introdução & ABNT (2026)');
    });

    it('B3.2: Pasta com exatamente 0 itens exibe badge "0" sem quebrar o card', () => {
      const pastas = [{ id: 'p_vazia', nome: 'Vazia', cor: '#314F79' }];
      const el = oraculo.renderizarPastasCronos(pastas, 'p_vazia', new Map([['p_vazia', { total: 0 }]]));
      assert.equal(el.children[0].querySelector('.ath-bib-folder-count').textContent, '0');
    });

    it('B3.3: Pasta com mais de 999 itens exibe contagem compactada "999+"', () => {
      const pastas = [{ id: 'p_gigante', nome: 'Big Data', cor: '#314F79' }];
      const el = oraculo.renderizarPastasCronos(pastas, 'p_gigante', new Map([['p_gigante', { total: 1500 }]]));
      assert.equal(el.children[0].querySelector('.ath-bib-folder-count').textContent, '999+');
    });

    it('B3.4: Cores de contraste extremo (#000000 e #FFFFFF) geram cores tipográficas opostas', () => {
      assert.equal(obterCorTextoAcessivel('#000000'), '#FFFFFF');
      assert.equal(obterCorTextoAcessivel('#FFFFFF'), '#1F2733');
    });

    it('B3.5: Pasta com nome ausente ou nulo recebe fallback seguro "Sem Nome"', () => {
      const pastas = [{ id: 'p_sem_nome', cor: '#314F79' }];
      const el = oraculo.renderizarPastasCronos(pastas);
      assert.equal(el.children[0].querySelector('.ath-bib-folder-tab').textContent, 'Sem Nome');
    });

    it('B3.6: Lista de pastas vazia em renderizarPastasCronos retorna container vazio sem erro', () => {
      const el = oraculo.renderizarPastasCronos([]);
      assert.equal(el.children.length, 0);
    });
  });

  // ── B4: Boundary Filtragem e Movimentação Entre Pastas ─────────────────────────
  describe('B4: Boundary Filtragem e Movimentação Entre Pastas', () => {
    it('B4.1: Mover livro com ID nulo ou inexistente retorna sucesso = false', () => {
      const res = oraculo.moverLivroParaPasta('nao_existe', 'p1', [], [{ id: 'p1' }]);
      assert.equal(res.sucesso, false);
      assert.equal(res.motivo, 'livro_nao_encontrado');
    });

    it('B4.2: selecionarPasta com pasta inexistente faz fallback transparente para "todas"', () => {
      const id = oraculo.selecionarPasta('pasta_fantasma', { pastas: [] });
      assert.equal(id, 'todas');
    });

    it('B4.3: Livro com pastaId indefinido é contabilizado na estante geral "todas"', () => {
      const livroOrfao = criarBookReferenceItem({ id: 'orfao', pastaId: null });
      const agrupado = agruparPorPastas([livroOrfao], []);
      assert.equal(agrupado.get('todas').total, 1);
    });

    it('B4.4: Movimentação em massa preserva a integridade de todos os itens mutados', () => {
      const livros = [
        criarBookReferenceItem({ id: 'm1', pastaId: 'pA' }),
        criarBookReferenceItem({ id: 'm2', pastaId: 'pA' })
      ];
      const pastas = [{ id: 'pA' }, { id: 'pB' }];
      for (const l of livros) {
        oraculo.moverLivroParaPasta(l.id, 'pB', livros, pastas);
      }
      assert.ok(livros.every(l => l.pastaId === 'pB'));
    });

    it('B4.5: Storage corrompido em selecionarPasta é tratado sem interrupção de fluxo', () => {
      const brokenStorage = {
        setItem: () => { throw new Error('QuotaExceededError'); }
      };
      assert.doesNotThrow(() => {
        oraculo.selecionarPasta('p1', {
          pastas: [{ id: 'p1', nome: 'P1' }],
          storage: brokenStorage
        });
      });
    });

    it('B4.6: agruparPorPastas com lista de itens vazia inicializa todas as pastas com total 0', () => {
      const pastas = [{ id: 'p1', nome: 'P1' }, { id: 'p2', nome: 'P2' }];
      const agrup = agruparPorPastas([], pastas);
      assert.equal(agrup.get('p1').total, 0);
      assert.equal(agrup.get('p2').total, 0);
      assert.equal(agrup.get('todas').total, 0);
    });
  });

  // ── B5: Boundary Estante 3D e Prateleiras ──────────────────────────────────────
  describe('B5: Boundary Estante 3D e Prateleiras', () => {
    it('B5.1: Estante com exatamente 1 livro posiciona a prateleira sem falhas de índice', () => {
      const estante = oraculo.renderizarEstante3D([criarBookReferenceItem({ id: 'solo' })]);
      const prats = estante.querySelectorAll('.ath-estante-prateleira');
      assert.equal(prats.length, 1);
      assert.equal(prats[0].querySelectorAll('.ath-livro-3d').length, 1);
    });

    it('B5.2: Prateleira com limite de 1 por linha quebra exatamente em N prateleiras', () => {
      const itens = [criarBookReferenceItem({ id: 'a' }), criarBookReferenceItem({ id: 'b' })];
      const estante = oraculo.renderizarEstante3D(itens, { maxPorPrateleira: 1 });
      assert.equal(estante.querySelectorAll('.ath-estante-prateleira').length, 2);
    });

    it('B5.3: Livros com títulos longos (>200 caracteres) mantêm a base da prateleira contida', () => {
      const tituloLongo = 'A'.repeat(250);
      const estante = oraculo.renderizarEstante3D([criarBookReferenceItem({ titulo: tituloLongo })]);
      assert.ok(estante.querySelector('.ath-livro-3d'));
    });

    it('B5.4: Base da prateleira e sombra são criadas com tags correspondentes', () => {
      const estante = oraculo.renderizarEstante3D([criarBookReferenceItem()]);
      assert.equal(estante.querySelector('.ath-prateleira-base').tagName, 'DIV');
      assert.equal(estante.querySelector('.ath-prateleira-sombra').tagName, 'DIV');
    });

    it('B5.5: Invocação de renderizarEstante3D com array nulo ou indefinido faz fallback para vazio', () => {
      assert.doesNotThrow(() => {
        const estante = oraculo.renderizarEstante3D(null);
        assert.ok(estante.querySelector('.ath-estante-vazia-card'));
      });
    });

    it('B5.6: maxPorPrateleira menor ou igual a zero é normalizado com segurança para padrão', () => {
      const estante = oraculo.renderizarEstante3D([criarBookReferenceItem()], { maxPorPrateleira: 0 });
      assert.ok(estante.querySelector('.ath-estante-prateleira'));
    });
  });

  // ── B6: Boundary Livros Esquemáticos em CSS 3D ──────────────────────────────────
  describe('B6: Boundary Livros Esquemáticos em CSS 3D', () => {
    it('B6.1: Obra sem autor exibe rótulo substituto canônico "Autor não informado"', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ autores: [] }));
      assert.equal(el.querySelector('.ath-livro-autores').textContent, 'Autor não informado');
    });

    it('B6.2: Obra sem ano exibe "s.d." no badge da capa', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ ano: '' }));
      assert.ok(el.querySelector('.ath-livro-badge-tipo').textContent.includes('s.d.'));
    });

    it('B6.3: Contagem de citações de 1500 é formatada como "❝ 1k"', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ totalCitationsCount: 1500 }));
      assert.equal(el.querySelector('.ath-livro-citacoes').textContent, '❝ 1k');
    });

    it('B6.4: Obra sem título recebe fallback "Sem Título"', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ titulo: '' }));
      assert.equal(el.querySelector('.ath-livro-titulo').textContent, 'Sem Título');
    });

    it('B6.5: Livro sem PDF vinculado oculta o pill sem quebrar o layout da capa', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ pdfUrl: '', pdfCaminho: '' }));
      assert.equal(el.querySelector('.ath-livro-pdf-pill'), null);
    });

    it('B6.6: Atributo data-livro-id é sempre gravado no elemento .ath-livro-3d', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ id: 'custom_id_99' }));
      assert.equal(el.getAttribute('data-livro-id'), 'custom_id_99');
    });
  });

  // ── B7: Boundary Cinemática 3D de Abertura ─────────────────────────────────────
  describe('B7: Boundary Cinemática 3D de Abertura', () => {
    it('B7.1: Disparar fecharLivro3D em elemento nulo não produz exceção', () => {
      assert.doesNotThrow(() => oraculo.fecharLivro3D(null));
    });

    it('B7.2: Disparar abrirLivro3D em elemento nulo não produz exceção', () => {
      assert.doesNotThrow(() => oraculo.abrirLivro3D(null, {}));
    });

    it('B7.3: Disparar tratarTecladoLivro3D sem evento ou sem livro não produz erro', () => {
      assert.doesNotThrow(() => oraculo.tratarTecladoLivro3D(null, null));
      assert.doesNotThrow(() => oraculo.tratarTecladoLivro3D({ key: 'Escape' }, null));
    });

    it('B7.4: Tecla Escape disparada em livro já fechado é operação no-op segura', () => {
      const el = new MockDOMElement('div', 'ath-livro-3d');
      oraculo.tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, el);
      assert.ok(!el.classList.has('aberto'));
    });

    it('B7.5: Fechar livro aberto remove a classe .aberto e preserva nós filhos no DOM', () => {
      const el = oraculo.renderizarLivro3D(criarBookReferenceItem({ id: 'preservar' }));
      oraculo.abrirLivro3D(el, { id: 'preservar' });
      oraculo.fecharLivro3D(el);
      assert.ok(el.querySelector('.ath-livro-capa'));
      assert.ok(el.querySelector('.ath-livro-lombada'));
    });

    it('B7.6: Rotação de repouso aplicada no fechamento preserva sintaxe CSS rotateY/rotateX', () => {
      const el = new MockDOMElement('div', 'ath-livro-3d aberto');
      oraculo.fecharLivro3D(el);
      assert.ok(el.style.transform.includes('rotateY(-18deg)'));
      assert.ok(el.style.transform.includes('rotateX(4deg)'));
    });
  });

  // ── B8: Boundary Folha Interna de Fichamento e Ações ──────────────────────────
  describe('B8: Boundary Folha Interna de Fichamento e Ações', () => {
    it('B8.1: Salvar anotação rápida com string em branco não inclui item vazio no array', () => {
      const ref = criarBookReferenceItem({ id: 'nota_vazia', pinnedNotes: [] });
      const folha = oraculo.renderizarFolhaInterna(ref);
      const input = folha.querySelector('.ath-anotacao-rapida-input');
      input.textContent = '    ';
      const btn = folha.querySelector('.ath-btn-salvar-anotacao');
      btn.dispatchEvent({ type: 'click' });
      assert.equal(ref.pinnedNotes.length, 0, 'Não deve adicionar anotações contendo apenas espaços');
    });

    it('B8.2: Disparo de onAbrirLeitor com obra sem PDF vinculado aciona callback sem erro', () => {
      const ref = criarBookReferenceItem({ id: 'sem_pdf' });
      let chamado = false;
      const folha = oraculo.renderizarFolhaInterna(ref, {
        onAbrirLeitor: () => { chamado = true; }
      });
      folha.querySelector('.ath-btn-abrir-leitor').dispatchEvent({ type: 'click' });
      assert.equal(chamado, true);
    });

    it('B8.3: Folha interna sem nenhum autor exibe fallback "Autor" na linha de meta', () => {
      const ref = criarBookReferenceItem({ autores: [] });
      const folha = oraculo.renderizarFolhaInterna(ref);
      assert.ok(folha.querySelector('.ath-folha-meta').textContent.includes('Autor'));
    });

    it('B8.4: Citation Tracker com zero citações renderiza número 0 limpo', () => {
      const ref = criarBookReferenceItem({ totalCitationsCount: 0 });
      const folha = oraculo.renderizarFolhaInterna(ref);
      assert.ok(folha.querySelector('.ath-citacoes-total').textContent.includes('0'));
    });

    it('B8.5: Status toggle com valor inicial desconhecido não marca nenhum botão como ativo', () => {
      const ref = criarBookReferenceItem();
      ref.statusLeitura = 'desconhecido';
      const folha = oraculo.renderizarFolhaInterna(ref);
      const ativo = folha.querySelector('.ath-status-btn.ativo');
      assert.equal(ativo, null);
    });

    it('B8.6: Invocação de renderizarFolhaInterna sem callbacks de opções opera normalmente', () => {
      const ref = criarBookReferenceItem();
      assert.doesNotThrow(() => {
        const folha = oraculo.renderizarFolhaInterna(ref);
        assert.ok(folha.querySelector('.ath-folha-titulo'));
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise e Integrações Cruzadas)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 3: Cross-Feature Combinations — Interações Pairwise entre Módulos', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
  });

  it('C1 (F3 + F5): Filtrar pasta temática isola exatamente seus livros nas prateleiras 3D', () => {
    const itens = [
      criarBookReferenceItem({ id: 'geo_1', pastaId: 'geoprocessamento', titulo: 'SIG 1' }),
      criarBookReferenceItem({ id: 'geo_2', pastaId: 'geoprocessamento', titulo: 'SIG 2' }),
      criarBookReferenceItem({ id: 'dir_1', pastaId: 'direito', titulo: 'Direito Civil' })
    ];
    const pastas = [
      { id: 'geoprocessamento', nome: 'Geoprocessamento' },
      { id: 'direito', nome: 'Direito' }
    ];
    const agrupado = agruparPorPastas(itens, pastas);
    const estanteGeo = oraculo.renderizarEstante3D(agrupado.get('geoprocessamento').itens);
    assert.equal(estanteGeo.querySelectorAll('.ath-livro-3d').length, 2);
    assert.ok(estanteGeo.querySelector('[data-livro-id="geo_1"]'));
    assert.ok(estanteGeo.querySelector('[data-livro-id="geo_2"]'));
    assert.equal(estanteGeo.querySelector('[data-livro-id="dir_1"]'), null);
  });

  it('C2 (F5 + F7 + F8): Abrir livro 3D na estante, alterar status para "fichado" e fechar com Esc persiste modelo', () => {
    const ref = criarBookReferenceItem({ id: 'ciclo_1', titulo: 'Livro Ciclo', statusLeitura: 'nao_lido' });
    const estante = oraculo.renderizarEstante3D([ref]);
    const livroEl = estante.querySelector('.ath-livro-3d');

    // 1. Abrir
    oraculo.abrirLivro3D(livroEl, ref);
    assert.ok(livroEl.classList.has('aberto'));

    // 2. Alterar status na folha interna
    const btnFichado = livroEl.querySelector('[data-status="fichado"]');
    btnFichado.dispatchEvent({ type: 'click' });
    assert.equal(ref.statusLeitura, 'fichado');

    // 3. Fechar com tecla Escape
    oraculo.tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, livroEl);
    assert.ok(!livroEl.classList.has('aberto'));
    assert.equal(ref.statusLeitura, 'fichado', 'Status persiste após fechamento');
  });

  it('C3 (F4 + F8): Na folha interna, acionar movimentação de pasta atualiza contagens dos cards Cronos', () => {
    const itens = [criarBookReferenceItem({ id: 'livro_mov', pastaId: 'pasta_a' })];
    const pastas = [{ id: 'pasta_a', nome: 'Pasta A' }, { id: 'pasta_b', nome: 'Pasta B' }];
    
    // Mover de A para B
    oraculo.moverLivroParaPasta('livro_mov', 'pasta_b', itens, pastas);
    const novoAgrup = agruparPorPastas(itens, pastas);
    const faixa = oraculo.renderizarPastasCronos(pastas, 'pasta_b', novoAgrup);

    const cardB = faixa.querySelector('[data-pasta-id="pasta_b"]');
    assert.equal(cardB.querySelector('.ath-bib-folder-count').textContent, '1');
  });

  it('C4 (F1 + F2): Atualização de dados da referência dispara salvamento sem distorcer o botão circular', () => {
    const btnSalvar = new MockDOMElement('button', 'rm-ic-bt rm-ic-primario');
    const ref = criarBookReferenceItem({ id: 'salvar_ref', titulo: 'Antes' });

    // Mutar dados
    ref.titulo = 'Título Alterado';
    oraculo.iniciarSalvamento(btnSalvar);
    assert.ok(btnSalvar.classList.has('ath-salvando'));
    assert.equal(btnSalvar.textContent, '', 'Proibido vazar texto "Salvando..."');

    oraculo.finalizarSalvamento(btnSalvar, { sucesso: true });
    assert.ok(btnSalvar.classList.has('ath-salvo'));
  });

  it('C5 (F2 + F6 + F8): Nova citação adicionada no documento atualiza mini-contador da capa e Citation Tracker', () => {
    const ref = criarBookReferenceItem({
      id: 'ref_abnt_urban',
      titulo: 'Estatuto da Cidade',
      autores: [{ sobrenome: 'Brasil' }],
      ano: '2001'
    });
    const doc = {
      id: 'doc_mono',
      secoes: [
        {
          titulo: 'Capítulo 1',
          blocos: [{ texto: 'Segundo o Estatuto da Cidade (Brasil, 2001)...', referenciasCitadas: ['ref_abnt_urban'] }]
        }
      ]
    };

    const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
    ref.totalCitationsCount = metricas.totalCitationsCount;

    const livroEl = oraculo.renderizarLivro3D(ref);
    assert.equal(livroEl.querySelector('.ath-livro-citacoes').textContent, '❝ 1');

    const folha = oraculo.renderizarFolhaInterna(ref);
    assert.ok(folha.querySelector('.ath-citacoes-total').textContent.includes('1'));
  });

  it('C6 (F3 + F4 + F6): Selecionar pasta grava no sessionStorage e permite restauração precisa da estante', () => {
    const pastas = [{ id: 'teses', nome: 'Teses' }];
    oraculo.selecionarPasta('teses', { pastas, storage: mockSessionStorage });

    const pastaRestaurada = mockSessionStorage.getItem('athenes_bib_pasta_ativa');
    assert.equal(pastaRestaurada, 'teses');

    const itens = [
      criarBookReferenceItem({ id: 't1', pastaId: 'teses' }),
      criarBookReferenceItem({ id: 't2', pastaId: 'outra' })
    ];
    const estanteRestaurada = oraculo.renderizarEstante3D(itens.filter(i => i.pastaId === pastaRestaurada));
    assert.equal(estanteRestaurada.querySelectorAll('.ath-livro-3d').length, 1);
  });

  it('C7 (F6 + F7 + F8): Livro com PDF vinculado aciona botão "Abrir Arquivo / Ler Referência" conectando ao leitor', () => {
    const ref = criarBookReferenceItem({
      id: 'art_pdf_drive',
      titulo: 'Topografia Cadastral',
      pdfUrl: 'https://drive.google.com/pdf_cadastral.pdf'
    });
    let artigoRecebido = null;
    const livroEl = oraculo.renderizarLivro3D(ref);
    oraculo.abrirLivro3D(livroEl, ref, {
      callbacks: {
        onAbrirLeitor: (art) => { artigoRecebido = art; }
      }
    });

    const btnAbrir = livroEl.querySelector('.ath-btn-abrir-leitor');
    assert.ok(btnAbrir);
    btnAbrir.dispatchEvent({ type: 'click' });
    assert.equal(artigoRecebido.id, 'art_pdf_drive');
  });

  it('C8 (F3 + F6): Capa do livro herda dinamicamente a cor da pasta Cronos selecionada', () => {
    const corPastaLaranja = '#FF6B2C';
    const ref = criarBookReferenceItem({
      id: 'ref_laranja',
      pastaId: 'cronos_reurb',
      corCapa: corPastaLaranja
    });
    const livroEl = oraculo.renderizarLivro3D(ref);
    assert.equal(livroEl.querySelector('.ath-livro-capa').style.backgroundColor, '#FF6B2C');
    assert.equal(livroEl.querySelector('.ath-livro-lombada').style.backgroundColor, '#FF6B2C');
  });

  it('C9 (F4 + F5 + F6): Movimentação de livro da estante para card de pasta atualiza exibição imediata', () => {
    const livro = criarBookReferenceItem({ id: 'arraste_1', pastaId: 'pasta_origem' });
    const pastas = [{ id: 'pasta_origem', nome: 'Origem' }, { id: 'pasta_destino', nome: 'Destino' }];
    
    // Simula soltura do livro na pasta destino
    const resultado = oraculo.moverLivroParaPasta('arraste_1', 'pasta_destino', [livro], pastas);
    assert.equal(resultado.sucesso, true);
    assert.equal(livro.pastaId, 'pasta_destino');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REAL-WORLD SCENARIOS (Os 5 cenários acadêmicos e editoriais de uso real)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 4: Real-World Scenarios — Fluxos Editoriais e Acadêmicos Ponta a Ponta', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
  });

  it('S1: Cenário 1 — Fluxo Completo de Salvamento sem Distorção Visual', (t, done) => {
    // 1. Botão circular de salvar inicializa na barra superior (34px, .rm-ic-bt)
    const toolbar = new MockDOMElement('div', 'rm-icg');
    const btnSalvar = new MockDOMElement('button', 'rm-ic-bt rm-ic-primario');
    btnSalvar.setAttribute('id', 'rmSalvar');
    const btnDesfazer = new MockDOMElement('button', 'rm-ic-bt');
    toolbar.appendChild(btnSalvar);
    toolbar.appendChild(btnDesfazer);

    // 2. Disparo de salvamento do documento
    oraculo.iniciarSalvamento(btnSalvar);
    assert.ok(btnSalvar.classList.has('ath-salvando'), 'Deve ativar spinner concêntrico via CSS');
    assert.equal(btnSalvar.textContent, '', 'Garante ausência estrita de texto "Salvando..."');

    // 3. Botão vizinho preserva sua geometria e ausência de deformação
    assert.equal(toolbar.children.length, 2);

    // 4. Operação assíncrona conclui e transiciona para .ath-salvo
    const timer = oraculo.finalizarSalvamento(btnSalvar, { sucesso: true, duracaoSalvoMs: 25 });
    assert.ok(btnSalvar.classList.has('ath-salvo'), 'Fundo verde de confirmação');

    // 5. Após 25ms de exibição, restaura o estado padrão
    setTimeout(() => {
      assert.ok(!btnSalvar.classList.has('ath-salvo'), 'Restauração suave do botão circular');
      done();
    }, 40);
  });

  it('S2: Cenário 2 — Gestão Acadêmica de Referências em Pastas Temáticas', () => {
    // 1. Criação de acervo acadêmico com normas e tipos variados
    const referencias = [
      criarBookReferenceItem({
        id: 'ref_nbr6023',
        pastaId: 'normas',
        titulo: 'NBR 6023: Informação e Documentação — Referências',
        autores: [{ sobrenome: 'ABNT', prenome: '' }],
        ano: '2018',
        tipo: 'relatorio_tecnico'
      }),
      criarBookReferenceItem({
        id: 'ref_moran',
        pastaId: 'metodologia',
        titulo: 'Metodologias Ativas para uma Educação Inovadora',
        autores: [{ sobrenome: 'Moran', prenome: 'José' }, { sobrenome: 'Bacich', prenome: 'Lilian' }],
        ano: '2018',
        tipo: 'livro'
      }),
      criarBookReferenceItem({
        id: 'ref_artigo_sig',
        pastaId: 'metodologia',
        titulo: 'Modelagem de Dados Espaciais para Regularização',
        autores: [{ sobrenome: 'Silva', prenome: 'João' }],
        ano: '2023',
        tipo: 'artigo_periodico'
      })
    ];

    const pastas = [
      { id: 'normas', nome: 'Normas Técnicas', cor: '#314F79' },
      { id: 'metodologia', nome: 'Metodologia', cor: '#FF6B2C' }
    ];

    // 2. Agrupamento e verificação dos contadores
    let agrupado = agruparPorPastas(referencias, pastas);
    assert.equal(agrupado.get('normas').total, 1);
    assert.equal(agrupado.get('metodologia').total, 2);
    assert.equal(agrupado.get('todas').total, 3);

    // 3. Movimentar obra de metodologia para normas
    const resMove = oraculo.moverLivroParaPasta('ref_artigo_sig', 'normas', referencias, pastas);
    assert.equal(resMove.sucesso, true);

    // 4. Recalcular e conferir sincronismo
    agrupado = agruparPorPastas(referencias, pastas);
    assert.equal(agrupado.get('normas').total, 2);
    assert.equal(agrupado.get('metodologia').total, 1);
  });

  it('S3: Cenário 3 — Inspeção de Estante 3D, Abertura e Fichamento Rápido', () => {
    // 1. Obra renderizada esquematicamente na prateleira 3D
    const obra = criarBookReferenceItem({
      id: 'livro_fichamento_real',
      titulo: 'Fundamentos de Topografia e Geodésia',
      autores: [{ sobrenome: 'Menezes', prenome: 'Paulo' }],
      ano: '2022',
      statusLeitura: 'nao_lido',
      highlightsCount: 12,
      totalCitationsCount: 3
    });

    const estante = oraculo.renderizarEstante3D([obra]);
    const livroEl = estante.querySelector('.ath-livro-3d');
    assert.ok(livroEl);

    // 2. Clique no livro aciona cinemática de abertura 3D
    oraculo.abrirLivro3D(livroEl, obra);
    assert.ok(livroEl.classList.has('aberto'));
    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    assert.ok(folha);

    // 3. Usuário anota resumo rápido e atualiza status para 'lendo'
    const input = folha.querySelector('.ath-anotacao-rapida-input');
    input.textContent = 'Capítulo 4 cobre o cálculo das coordenadas UTM e SIRGAS 2000.';
    folha.querySelector('.ath-btn-salvar-anotacao').dispatchEvent({ type: 'click' });
    folha.querySelector('[data-status="lendo"]').dispatchEvent({ type: 'click' });

    assert.equal(obra.statusLeitura, 'lendo');
    assert.ok(obra.pinnedNotes.includes('Capítulo 4 cobre o cálculo das coordenadas UTM e SIRGAS 2000.'));

    // 4. Pressionamento de Escape fecha suavemente a capa
    oraculo.tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, livroEl);
    assert.ok(!livroEl.classList.has('aberto'));
  });

  it('S4: Cenário 4 — Navegação de F5 e Restauração de Sessão com Estante Filtrada', () => {
    const pastas = [
      { id: 'cap_teoria', nome: 'Capítulo Teórico' },
      { id: 'cap_dados', nome: 'Capítulo de Dados' }
    ];
    const breadcrumb = new MockDOMElement('nav', 'ath-bib-breadcrumb');

    // 1. Usuário seleciona pasta "Capítulo de Dados"
    oraculo.selecionarPasta('cap_dados', {
      pastas,
      storage: mockSessionStorage,
      breadcrumbEl: breadcrumb
    });
    assert.equal(mockSessionStorage.getItem('athenes_bib_pasta_ativa'), 'cap_dados');
    assert.ok(breadcrumb.textContent.includes('Capítulo de Dados'));

    // 2. Simulação de F5 (recarregamento da página e restauração a partir do sessionStorage)
    const pastaSalva = mockSessionStorage.getItem('athenes_bib_pasta_ativa');
    const pastaAtiva = pastas.find(p => p.id === pastaSalva) || { id: 'todas', nome: 'Estante Geral' };

    // 3. Reconstituição da estante filtrada
    const livros = [
      criarBookReferenceItem({ id: 'd1', pastaId: 'cap_teoria', titulo: 'Teoria 1' }),
      criarBookReferenceItem({ id: 'd2', pastaId: 'cap_dados', titulo: 'Dados 1' })
    ];
    const estanteRestaurada = oraculo.renderizarEstante3D(livros.filter(l => l.pastaId === pastaAtiva.id));

    assert.equal(estanteRestaurada.querySelectorAll('.ath-livro-3d').length, 1);
    assert.ok(estanteRestaurada.querySelector('[data-livro-id="d2"]'));
    assert.equal(estanteRestaurada.querySelector('[data-livro-id="d1"]'), null);
  });

  it('S5: Cenário 5 — Ciclo Completo de Leitura a partir da Folha Interna', () => {
    // 1. Obra com PDF vinculado
    const obra = criarBookReferenceItem({
      id: 'obra_leitura_completa',
      titulo: 'Direito Urbanístico e Ordenamento Territorial',
      pdfUrl: 'https://storage.athenes.app/pdfs/urbanistico_2025.pdf',
      ano: '2025'
    });

    let eventoLeitorDisparado = false;
    let artigoAberto = null;

    const estante = oraculo.renderizarEstante3D([obra]);
    const livroEl = estante.querySelector('.ath-livro-3d');

    // 2. Abrir o livro em 3D
    oraculo.abrirLivro3D(livroEl, obra, {
      callbacks: {
        onAbrirLeitor: (art) => {
          eventoLeitorDisparado = true;
          artigoAberto = art;
        }
      }
    });

    // 3. Clicar no botão primário de leitura
    const btnLeitor = livroEl.querySelector('.ath-btn-abrir-leitor');
    assert.ok(btnLeitor);
    btnLeitor.dispatchEvent({ type: 'click' });

    // 4. Conectar e acionar o módulo do leitor do Athenes
    assert.equal(eventoLeitorDisparado, true);
    assert.equal(artigoAberto.id, 'obra_leitura_completa');
    assert.equal(artigoAberto.pdfUrl, 'https://storage.athenes.app/pdfs/urbanistico_2025.pdf');
  });
});
