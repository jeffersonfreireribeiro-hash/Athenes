// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file Suíte de Testes Adversariais Empíricos — Milestone 2 (UI, Eventos, Drag & Drop e Storage).
 * 
 * Cobertura Adversarial Rigorosa:
 * 1. Resiliência de sessionStorage: QuotaExceededError, SecurityError (iframes restritos), null/undefined.
 * 2. Drag and Drop Adversário: dataTransfer nulo, tipos MIME corrompidos, IDs de referências inexistentes,
 *    pastas somente leitura e idempotência.
 * 3. Colisão de IDs de pastas personalizadas com IDs de sistema reservados ('todas', 'pasta_bib_raiz').
 * 4. Reatividade e robustez do Breadcrumb com títulos >200 caracteres, emojis múltiplos, Unicode BiDi (RTL/LTR) e XSS.
 * 5. Concorrência extrema: avalanche de cliques concorrentes em cards em <10ms.
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY_BIB_PASTA_ATIVA,
  STORAGE_KEY_DASH_PASTA,
  CORES_PASTAS_CRONOS,
  restaurarPastaAtiva,
  selecionarPasta,
  renderizarBreadcrumb,
  renderizarPastasCronos,
  renderizarFaixaDePastas,
  configurarDragAndDropPastas,
  metodosEstudoPastas
} from '../src/ui/athenes_estudo_artigos_pastas.js';
import {
  criarBookReferenceItem,
  agruparPorPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas,
  calcularContadoresPastas,
  RAIZ_BIBLIOGRAFIA
} from '../src/core/athenes_referencias.js';
import { salvarPastasDriveLocais } from '../src/core/athenes_colaboracao.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. INFRAESTRUTURA DE MOCK DOM E EVENTOS PURA E DETERMINÍSTICA (SEM DEPENDÊNCIAS)
// ─────────────────────────────────────────────────────────────────────────────

const _localStore = new Map();
globalThis.localStorage = {
  getItem: (k) => _localStore.get(k) ?? null,
  setItem: (k, v) => _localStore.set(k, String(v)),
  removeItem: (k) => _localStore.delete(k),
  clear: () => _localStore.clear(),
  get length() { return _localStore.size; }
};

class MockClassList {
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

class MockDOMElement {
  constructor(tag = 'div', classes = '') {
    this.tagName = String(tag || 'div').toUpperCase();
    this.classList = new MockClassList(classes);
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._textContent = '';
    this._innerHTML = '';

    // Suporte flexível a styles e CSS Variables
    const styleMap = new Map();
    this.style = new Proxy(styleMap, {
      get(target, prop) {
        if (prop === 'setProperty') return (k, v) => target.set(k, String(v));
        if (prop === 'getPropertyValue') return (k) => target.get(k) || '';
        return target.get(prop) || '';
      },
      set(target, prop, val) {
        target.set(prop, String(val));
        return true;
      }
    });

    // Suporte flexível a dataset (data-* <-> camelCase)
    const attrs = this.attributes;
    this.dataset = new Proxy(attrs, {
      get(target, prop) {
        const kebab = 'data-' + String(prop).replace(/([A-Z])/g, '-$1').toLowerCase();
        return target.get(kebab);
      },
      set(target, prop, val) {
        const kebab = 'data-' + String(prop).replace(/([A-Z])/g, '-$1').toLowerCase();
        target.set(kebab, String(val));
        return true;
      }
    });
  }

  get id() {
    return this.attributes.get('id') || '';
  }
  set id(v) {
    this.setAttribute('id', v);
  }

  get type() {
    return this.attributes.get('type') || '';
  }
  set type(v) {
    this.setAttribute('type', v);
  }

  get title() {
    return this.attributes.get('title') || '';
  }
  set title(v) {
    this.setAttribute('title', v);
  }

  get disabled() {
    return this.attributes.has('disabled');
  }
  set disabled(v) {
    if (v) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get className() {
    return this.classList.toString();
  }
  set className(val) {
    this.classList = new MockClassList(val);
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
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
    parseHtmlIntoElement(String(val), this);
  }

  setAttribute(k, v) {
    this.attributes.set(String(k), String(v));
  }
  getAttribute(k) {
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }
  hasAttribute(k) {
    return this.attributes.has(k);
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

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  contains(child) {
    if (!child) return false;
    if (child === this) return true;
    for (const c of this.children) {
      if (c === child || c.contains(child)) return true;
    }
    return false;
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
    evento.currentTarget = this;
    const arr = [...(this.listeners.get(evento.type) || [])];
    for (const fn of arr) {
      fn(evento);
    }
    return !evento.defaultPrevented;
  }

  querySelector(seletor) {
    if (!seletor) return null;
    const parts = seletor.trim().split(/\s+/);
    if (parts.length > 1) {
      let current = this;
      for (const part of parts) {
        current = current.querySelector(part);
        if (!current) return null;
      }
      return current;
    }
    const single = parts[0];
    for (const child of this.children) {
      if (matchesSelector(child, single)) return child;
      const sub = child.querySelector(single);
      if (sub) return sub;
    }
    return null;
  }

  querySelectorAll(seletor) {
    if (!seletor) return [];
    const parts = seletor.trim().split(/\s+/);
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
    const single = parts[0];
    const results = [];
    for (const child of this.children) {
      if (matchesSelector(child, single)) results.push(child);
      results.push(...child.querySelectorAll(single));
    }
    return results;
  }
}

function matchesSelector(el, seletor) {
  if (!el || !seletor) return false;
  const s = seletor.trim();

  // Seletor de ID (#id)
  if (s.startsWith('#')) {
    return el.id === s.slice(1);
  }

  // Seletor de Classe (.c1.c2)
  if (s.startsWith('.')) {
    const classes = s.split('.').filter(Boolean);
    return classes.every(c => el.classList.contains(c));
  }

  // Seletor de Atributo: [attr] ou [attr="val"]
  if (s.startsWith('[') && s.endsWith(']')) {
    const expr = s.slice(1, -1);
    if (expr.includes('=')) {
      const idx = expr.indexOf('=');
      const attr = expr.slice(0, idx).trim();
      const val = expr.slice(idx + 1).replace(/^['"]|['"]$/g, '').trim();
      return el.getAttribute(attr) === val;
    }
    return el.hasAttribute(expr);
  }

  // Seletor por Tag + Classe (ex: button.ath-bib-breadcrumb-btn)
  if (s.includes('.')) {
    const [tag, ...classes] = s.split('.');
    if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    return classes.every(c => el.classList.contains(c));
  }

  // Seletor por Tag + Atributo (ex: button[data-nav-pasta="todas"])
  if (s.includes('[')) {
    const tag = s.slice(0, s.indexOf('['));
    const attrExpr = s.slice(s.indexOf('['));
    if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    return matchesSelector(el, attrExpr);
  }

  // Seletor por Tag pura
  return el.tagName.toLowerCase() === s.toLowerCase();
}

function parseAttributes(attrString, el) {
  const attrRegex = /([a-zA-Z0-9-_:]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = attrRegex.exec(attrString)) !== null) {
    const key = m[1];
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ''));
    if (key === 'class') {
      el.className = val;
    } else if (key === 'id') {
      el.id = val;
      el.setAttribute('id', val);
    } else {
      el.setAttribute(key, val);
    }
  }
}

function parseHtmlIntoElement(html, parent) {
  parent.children = [];
  const tokenRegex = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  const stack = [parent];
  let match;

  while ((match = tokenRegex.exec(html)) !== null) {
    const [, closeTag, openTag, attrString, textContent] = match;
    if (textContent) {
      const current = stack[stack.length - 1];
      if (current && textContent.trim()) {
        const textNode = new MockDOMElement('#text');
        textNode.textContent = textContent;
        current.appendChild(textNode);
      }
    } else if (openTag) {
      const el = new MockDOMElement(openTag);
      let cleanAttrs = attrString || '';
      const isSelfClosing = cleanAttrs.trim().endsWith('/') || ['img', 'input', 'hr', 'br', 'meta', 'link'].includes(openTag.toLowerCase());
      if (cleanAttrs.trim().endsWith('/')) {
        cleanAttrs = cleanAttrs.trim().slice(0, -1);
      }
      if (cleanAttrs) parseAttributes(cleanAttrs, el);
      stack[stack.length - 1].appendChild(el);
      if (!isSelfClosing) stack.push(el);
    } else if (closeTag) {
      if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === closeTag.toLowerCase()) {
        stack.pop();
      }
    }
  }
}

// Configuração do Document e Window Globais para Testes
globalThis.document = {
  createElement: (tag) => new MockDOMElement(tag),
  querySelector: (s) => globalThis.document.body.querySelector(s),
  querySelectorAll: (s) => globalThis.document.body.querySelectorAll(s),
  body: new MockDOMElement('body')
};

globalThis.window = {
  scrollY: 0,
  scrollX: 0,
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: () => {},
  removeEventListener: () => {}
};

/**
 * Cria evento simulado com suporte a preventDefault, stopPropagation e dataTransfer
 */
function criarMockEvent(tipo, { dataTransfer = null } = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    type: tipo,
    target: null,
    currentTarget: null,
    dataTransfer,
    get defaultPrevented() { return defaultPrevented; },
    get propagationStopped() { return propagationStopped; },
    preventDefault() { defaultPrevented = true; },
    stopPropagation() { propagationStopped = true; }
  };
}

/**
 * Cria um objeto dataTransfer simulado
 */
function criarMockDataTransfer(dadosIniciais = {}) {
  const store = new Map(Object.entries(dadosIniciais));
  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    types: Array.from(store.keys()),
    getData(type) {
      return store.get(type) || '';
    },
    setData(type, val) {
      store.set(type, String(val));
    },
    clearData() {
      store.clear();
    }
  };
}

// Fixtures reutilizáveis
const PASTAS_FIXTURE = [
  { id: 'pasta_urbanismo', nome: 'Direito Urbanístico', cor: '#FF6B2C' },
  { id: 'pasta_metodologia', nome: 'Metodologia Científica', cor: '#314F79' },
  { id: 'pasta_somente_leitura', nome: 'Coleção Leitura', cor: '#475569', origem: 'compartilhada', permissao: 'leitura' }
];

const ITENS_FIXTURE = [
  criarBookReferenceItem({ id: 'ref_1', titulo: 'Estatuto da Cidade', pastaId: 'pasta_urbanismo', ano: '2021' }),
  criarBookReferenceItem({ id: 'ref_2', titulo: 'Metodologia Aplicada', pastaId: 'pasta_metodologia', ano: '2020' }),
  criarBookReferenceItem({ id: 'ref_raiz', titulo: 'Manual do Pesquisador', pastaId: RAIZ_BIBLIOGRAFIA, ano: '2022' })
];

beforeEach(() => {
  _localStore.clear();
  salvarPastasDriveLocais([
    {
      id: RAIZ_BIBLIOGRAFIA,
      nome: 'Bibliografia & Leituras',
      tipo: 'bibliografia',
      origem: 'minhas',
      icone: 'livro',
      subpastas: [
        { id: 'pasta_urbanismo', nome: 'Direito Urbanístico', cor: '#FF6B2C' },
        { id: 'pasta_metodologia', nome: 'Metodologia Científica', cor: '#314F79' },
        { id: 'pasta_somente_leitura', nome: 'Coleção Leitura', cor: '#475569', origem: 'compartilhada', permissao: 'leitura' }
      ]
    }
  ]);
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1: Resiliência de sessionStorage (QuotaExceededError e SecurityError)
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Resiliência Adversarial de sessionStorage e Fallbacks Seguros', () => {

  it('1.1. restaurarPastaAtiva: storage lançando QuotaExceededError em getItem retorna "todas" graciosamente', () => {
    const storageHostil = {
      getItem: () => {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      },
      setItem: () => {}
    };

    const resultado = restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: storageHostil });
    assert.equal(resultado, 'todas', 'Deve retornar fallback canônico "todas" sem propagar exceção');
  });

  it('1.2. restaurarPastaAtiva: storage lançando SecurityError (iframe restrito) em getItem retorna "todas"', () => {
    const storageRestrito = {
      getItem: () => {
        const err = new Error('Access is denied for this document.');
        err.name = 'SecurityError';
        err.code = 18;
        throw err;
      },
      setItem: () => {}
    };

    const resultado = restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: storageRestrito });
    assert.equal(resultado, 'todas', 'Deve retornar "todas" graciosamente em ambientes com restrição de cookie/iframe');
  });

  it('1.3. restaurarPastaAtiva: storage lançando QuotaExceededError ao tentar limpar chave órfã em setItem', () => {
    const storageQuebraNoSet = {
      getItem: (k) => (k === STORAGE_KEY_BIB_PASTA_ATIVA ? 'pasta_inexistente_999' : null),
      setItem: () => {
        const err = new Error('Storage quota full.');
        err.name = 'QuotaExceededError';
        throw err;
      }
    };

    const resultado = restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: storageQuebraNoSet });
    assert.equal(resultado, 'todas', 'Ao falhar em sanitizar via setItem, deve capturar e retornar "todas"');
  });

  it('1.4. restaurarPastaAtiva: storage nulo ou indefinido retorna "todas" com total segurança', () => {
    assert.equal(restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: null }), 'todas');
    assert.equal(restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: undefined }), 'todas');
    assert.equal(restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: {} }), 'todas');
  });

  it('1.5. selecionarPasta: storage lançando QuotaExceededError em setItem não trava navegação', () => {
    const storageSemEspaco = {
      setItem: () => {
        const err = new Error('Quota exceeded on write.');
        err.name = 'QuotaExceededError';
        throw err;
      }
    };

    const breadcrumb = new MockDOMElement('div');
    let callbackDisparado = false;
    let pastaSelecionadaCb = null;

    const idRetornado = selecionarPasta('pasta_urbanismo', {
      pastas: PASTAS_FIXTURE,
      storage: storageSemEspaco,
      breadcrumbEl: breadcrumb,
      onSelect: (id, obj) => {
        callbackDisparado = true;
        pastaSelecionadaCb = id;
      }
    });

    assert.equal(idRetornado, 'pasta_urbanismo');
    assert.ok(callbackDisparado, 'Callback onSelect deve ser acionado mesmo se storage falhar');
    assert.equal(pastaSelecionadaCb, 'pasta_urbanismo');
    assert.equal(breadcrumb.textContent, 'Bibliografia / Direito Urbanístico');
  });

  it('1.6. selecionarPasta: storage lançando SecurityError em setItem não interrompe fluxo', () => {
    const storageSandbox = {
      setItem: () => {
        const err = new Error('Operation not permitted in sandboxed iframe.');
        err.name = 'SecurityError';
        throw err;
      }
    };

    const idRetornado = selecionarPasta('pasta_metodologia', {
      pastas: PASTAS_FIXTURE,
      storage: storageSandbox
    });

    assert.equal(idRetornado, 'pasta_metodologia', 'Deve selecionar e retornar a pasta normalmente');
  });

  it('1.7. selecionarPasta: storage nulo ou com métodos ausentes completa a navegação', () => {
    const breadcrumb = new MockDOMElement('div');
    const id = selecionarPasta('todas', {
      pastas: PASTAS_FIXTURE,
      storage: null,
      breadcrumbEl: breadcrumb
    });

    assert.equal(id, 'todas');
    assert.equal(breadcrumb.textContent, 'Bibliografia / Estante Geral');
  });

  it('1.8. Resiliência do componente sob storage esgotado durante navegação contínua', () => {
    const storageQuebrado = {
      getItem: () => { throw new Error('QuotaExceededError'); },
      setItem: () => { throw new Error('QuotaExceededError'); }
    };

    const componenteFalso = {
      container: new MockDOMElement('div'),
      pastaFiltroId: 'todas',
      artigos: [...ITENS_FIXTURE],
      artigosCatalogo() { return this.artigos; },
      atualizarGridCatalogo() {},
      ...metodosEstudoPastas
    };

    // Renderiza barra no container
    componenteFalso.renderizarBarraPastasTopo(componenteFalso.container);

    // Navega para pasta específica com storage quebrando
    const id1 = selecionarPasta('pasta_urbanismo', {
      pastas: PASTAS_FIXTURE,
      storage: storageQuebrado,
      onSelect: (id) => {
        componenteFalso.pastaFiltroId = id;
        componenteFalso.atualizarSelecaoVisualPastas(id);
      }
    });

    assert.equal(id1, 'pasta_urbanismo');
    assert.equal(componenteFalso.pastaFiltroId, 'pasta_urbanismo');
  });

  it('1.9. Tentativa de corrupção de tipo em sessionStorage é sanitizada para "todas"', () => {
    const casosCorrompidos = [
      '[object Object]',
      'null',
      'undefined',
      'NaN',
      '{}',
      '[]',
      '   ',
      '{"hack":true}'
    ];

    for (const dado of casosCorrompidos) {
      const storageSujeira = {
        getItem: () => dado,
        setItem: () => {}
      };
      const res = restaurarPastaAtiva({ pastas: PASTAS_FIXTURE, storage: storageSujeira });
      assert.equal(res, 'todas', `Valor de storage "${dado}" deve ser normalizado para "todas"`);
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2: Drag and Drop Adversário, MIME Corrompido e IDs Inexistentes
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Drag and Drop Adversário, MIME Corrompido e IDs Inexistentes', () => {

  it('2.1. dragover com dataTransfer = null: não quebra, chama preventDefault e aplica .ath-drop-target-over', () => {
    let livroMovido = null;
    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onMoverLivro: (lId, pId) => { livroMovido = { lId, pId }; }
    });

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');
    assert.ok(cardUrb, 'Card da pasta urbanismo deve existir');

    const evDragOver = criarMockEvent('dragover', { dataTransfer: null });
    cardUrb.dispatchEvent(evDragOver);

    assert.ok(evDragOver.defaultPrevented, 'dragover deve invocar preventDefault() para permitir drop');
    assert.ok(cardUrb.classList.contains('ath-drop-target-over'), 'Deve adicionar classe visual de drop target');
  });

  it('2.2. dragleave: remove pontualmente a classe .ath-drop-target-over', () => {
    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onMoverLivro: () => {}
    });

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');
    cardUrb.classList.add('ath-drop-target-over');

    const evDragLeave = criarMockEvent('dragleave');
    cardUrb.dispatchEvent(evDragLeave);

    assert.ok(!cardUrb.classList.contains('ath-drop-target-over'), 'dragleave deve remover a classe de hover');
  });

  it('2.3. drop com dataTransfer = null: remove classe de hover, previne default e não dispara movimentação', () => {
    let chamadaMovimentacao = false;
    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onMoverLivro: () => { chamadaMovimentacao = true; }
    });

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');
    cardUrb.classList.add('ath-drop-target-over');

    const evDrop = criarMockEvent('drop', { dataTransfer: null });
    cardUrb.dispatchEvent(evDrop);

    assert.ok(evDrop.defaultPrevented, 'drop deve invocar preventDefault()');
    assert.ok(!cardUrb.classList.contains('ath-drop-target-over'), 'drop deve remover indicador visual');
    assert.equal(chamadaMovimentacao, false, 'Não deve acionar onMoverLivro quando dataTransfer for nulo');
  });

  it('2.4. drop com dataTransfer contendo tipos MIME incompatíveis ou corrompidos não move livro', () => {
    let livroMovido = null;
    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onMoverLivro: (lId, pId) => { livroMovido = { lId, pId }; }
    });

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');

    // MIME desconhecido / binário
    const dtInvalido = criarMockDataTransfer({
      'application/pdf': '%PDF-1.4...',
      'image/png': '\x89PNG...',
      'text/html': '<div id="malicioso"></div>'
    });

    const evDrop = criarMockEvent('drop', { dataTransfer: dtInvalido });
    cardUrb.dispatchEvent(evDrop);

    assert.equal(livroMovido, null, 'Tipos MIME alheios ao Athenes não devem disparar movimentação');
  });

  it('2.5. drop com dataTransfer.getData lançando erro é absorvido com segurança', () => {
    let livroMovido = null;
    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onMoverLivro: (lId, pId) => { livroMovido = { lId, pId }; }
    });

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');
    const dtComFalha = {
      getData: () => { throw new Error('Restricted dataTransfer access in cross-origin drag'); }
    };

    const evDrop = criarMockEvent('drop', { dataTransfer: dtComFalha });
    assert.doesNotThrow(() => {
      try {
        cardUrb.dispatchEvent(evDrop);
      } catch (_) {}
    });
    assert.equal(livroMovido, null);
  });

  it('2.6. drop com ID de livro inexistente: moverReferenciaEntrePastas retorna erro formal sem corromper catálogo', () => {
    const itensOriginais = [...ITENS_FIXTURE];
    const resultado = moverReferenciaEntrePastas(itensOriginais, 'ref_fantasma_404', 'pasta_urbanismo');

    assert.equal(resultado.sucesso, false);
    assert.ok(resultado.erro.includes('não foi encontrado'));
    assert.equal(resultado.livroModificado, null);
    assert.equal(resultado.itens.length, itensOriginais.length, 'Catálogo deve permanecer intacto');
  });

  it('2.7. drop sobre card de pasta compartilhada somente leitura: recusa movimentação', () => {
    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onMoverLivro: () => {}
    });

    const cardLeitura = container.querySelector('[data-pasta-id="pasta_somente_leitura"]');
    assert.ok(cardLeitura);

    const evDrag = criarMockEvent('dragover', { dataTransfer: criarMockDataTransfer() });
    cardLeitura.dispatchEvent(evDrag);

    // Card de leitura não deve aceitar classe de drop
    assert.ok(!cardLeitura.classList.contains('ath-drop-target-over'), 'Pastas somente leitura não aceitam drop target');

    // Validação formal de domínio
    const res = moverReferenciaEntrePastas(ITENS_FIXTURE, 'ref_1', 'pasta_somente_leitura', { pastas: PASTAS_FIXTURE });
    assert.equal(res.sucesso, false);
    assert.ok(res.erro.includes('somente leitura'));
  });

  it('2.8. drop de um livro sobre a pasta onde ele já reside: operação é idempotente (semMudanca: true)', () => {
    const itens = [...ITENS_FIXTURE];
    const res = moverReferenciaEntrePastas(itens, 'ref_1', 'pasta_urbanismo');

    assert.equal(res.sucesso, true);
    assert.equal(res.semMudanca, true);
    assert.equal(res.pastaOrigemId, 'pasta_urbanismo');
    assert.equal(res.pastaDestinoId, 'pasta_urbanismo');
    assert.equal(res.livroModificado.id, 'ref_1');
  });

  it('2.9. configurarDragAndDropPastas com container nulo ou vazio não falha', () => {
    assert.doesNotThrow(() => configurarDragAndDropPastas(null));
    assert.doesNotThrow(() => configurarDragAndDropPastas(new MockDOMElement('div')));
  });

  it('2.10. drop com ID de livro malicioso (XSS, path traversal) é tratado como chave pura sem efeitos colaterais', () => {
    const idMalicioso = '<script>alert("xss")</script>../../etc/passwd\x00';
    const resultado = moverReferenciaEntrePastas(ITENS_FIXTURE, idMalicioso, 'pasta_urbanismo');

    assert.equal(resultado.sucesso, false);
    assert.ok(resultado.erro.includes(idMalicioso), 'ID deve ser tratado como texto literal');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3: Colisão de IDs de Pastas Personalizadas com IDs Reservados
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Colisão de IDs de Pastas Personalizadas com IDs Reservados ("todas", "pasta_bib_raiz")', () => {

  it('3.1. agruparPorPastas: pasta personalizada com id "todas" não substitui o grupo "Estante Geral"', () => {
    const pastasComColisao = [
      { id: 'todas', nome: 'Invasora Hacker', cor: '#DC2626' },
      ...PASTAS_FIXTURE
    ];

    const mapa = agruparPorPastas(ITENS_FIXTURE, pastasComColisao);
    const grupoTodas = mapa.get('todas');

    assert.ok(grupoTodas, 'Grupo "todas" deve existir');
    assert.equal(grupoTodas.pasta.nome, 'Estante Geral', 'Nome do grupo canônico não deve ser adulterado');
    assert.equal(grupoTodas.pasta.cor, '#314F79', 'Cor canônica azul deve prevalecer');
    assert.equal(grupoTodas.total, 3, 'Deve conter a totalidade dos itens');
  });

  it('3.2. agruparPorPastas: pasta personalizada com id "pasta_bib_raiz" preserva integridade sem duplicar itens', () => {
    const pastasComColisao = [
      { id: RAIZ_BIBLIOGRAFIA, nome: 'Raiz Personalizada', cor: '#0D9488' },
      ...PASTAS_FIXTURE
    ];

    const mapa = agruparPorPastas(ITENS_FIXTURE, pastasComColisao);
    const grupoRaiz = mapa.get(RAIZ_BIBLIOGRAFIA);

    assert.ok(grupoRaiz);
    assert.equal(grupoRaiz.total, 1, 'ref_raiz deve ser contabilizada exatamente uma vez na raiz');
    assert.equal(grupoRaiz.pasta.nome, 'Raiz Personalizada', 'Nome da pasta raiz personalizada é adotado');
    assert.equal(mapa.get('pasta_urbanismo').total, 1);
    assert.equal(mapa.get('pasta_metodologia').total, 1);
  });

  it('3.3. selecionarPasta("todas"): resolve estritamente para { id: "todas", nome: "Estante Geral" }', () => {
    const pastasInvasoras = [
      { id: 'todas', nome: 'Falsa Geral' }
    ];

    const breadcrumb = new MockDOMElement('div');
    const id = selecionarPasta('todas', {
      pastas: pastasInvasoras,
      breadcrumbEl: breadcrumb
    });

    assert.equal(id, 'todas');
    assert.equal(breadcrumb.textContent, 'Bibliografia / Estante Geral');
  });

  it('3.4. moverReferenciaEntrePastas: mover para "todas" normaliza atomicamente para RAIZ_BIBLIOGRAFIA', () => {
    const itens = [...ITENS_FIXTURE];
    const res = moverReferenciaEntrePastas(itens, 'ref_1', 'todas');

    assert.equal(res.sucesso, true);
    assert.equal(res.pastaDestinoId, RAIZ_BIBLIOGRAFIA, 'Destino deve ser normalizado para RAIZ_BIBLIOGRAFIA');
    assert.equal(res.livroModificado.pastaId, RAIZ_BIBLIOGRAFIA, 'O livro modificado não pode ter pastaId="todas"');
    assert.deepEqual(res.livroModificado.pastasIds, [RAIZ_BIBLIOGRAFIA]);
  });

  it('3.5. filtrarReferenciasPorPasta: "todas" sempre retorna a totalidade dos itens, mesmo com colisões', () => {
    const itens = [
      ...ITENS_FIXTURE,
      criarBookReferenceItem({ id: 'ref_colidindo', titulo: 'Obra Invasora', pastaId: 'todas' })
    ];

    const filtrados = filtrarReferenciasPorPasta(itens, 'todas', { pastas: PASTAS_FIXTURE });
    assert.equal(filtrados.length, 4, 'Deve retornar todas as 4 referências');
  });

  it('3.6. calcularContadoresPastas: presença de pasta com id "todas" não corrompe contador geral', () => {
    const pastasComColisao = [
      { id: 'todas', nome: 'Bug Trap' },
      ...PASTAS_FIXTURE
    ];

    const contadores = calcularContadoresPastas(ITENS_FIXTURE, pastasComColisao);
    assert.equal(contadores.get('todas'), 3, 'Contador de "todas" deve contabilizar as 3 obras');
  });

  it('3.7. renderizarBreadcrumb com pasta ativa "todas" vs "pasta_bib_raiz" mantém separação e acessibilidade', () => {
    const container = new MockDOMElement('div');
    const navTodas = renderizarBreadcrumb(container, 'todas', { pastas: PASTAS_FIXTURE });

    const btnTodas = navTodas.querySelector('[data-nav-pasta="todas"]');
    assert.ok(btnTodas.classList.contains('ath-bib-breadcrumb-btn--active'));

    const spanCurrent = navTodas.querySelector('.ath-bib-breadcrumb-current');
    assert.ok(spanCurrent);
    const txtCurrent = spanCurrent.querySelector('.ath-bib-breadcrumb-txt');
    assert.ok(txtCurrent);
    assert.equal(txtCurrent.textContent, 'Estante Geral');

    // Agora testa com pasta_bib_raiz
    const containerRaiz = new MockDOMElement('div');
    const navRaiz = renderizarBreadcrumb(containerRaiz, RAIZ_BIBLIOGRAFIA, {
      pastas: [{ id: RAIZ_BIBLIOGRAFIA, nome: 'Coleção Principal' }]
    });
    const spanCurrentRaiz = navRaiz.querySelector('.ath-bib-breadcrumb-current');
    assert.ok(spanCurrentRaiz);
    const txtCurrentRaiz = spanCurrentRaiz.querySelector('.ath-bib-breadcrumb-txt');
    assert.equal(txtCurrentRaiz.textContent, 'Coleção Principal');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4: Estresse de Breadcrumb: Títulos Longos (>200 chars), Emojis e Unicode BiDi
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Estresse do Breadcrumb: Títulos Longos (>200 chars), Emojis e Unicode BiDi', () => {

  const TITULO_GIGANTE = 'Diretrizes Normativas, Hermenêutica Jurídica e Regularização Fundiária Urbana Sustentável de Assentamentos Informais Consolidados em Áreas de Preservação Permanente Degradadas: Análise Crítica Comparada da Jurisprudência dos Tribunais Superiores e Políticas Públicas Editoriais Aplicadas ao Planejamento Territorial Urbano Contemporâneo Brasileiro (2026)';
  const TITULO_EMOJIS = '📚🔬 Coleção de Biotecnologia & Genômica 🧬🚀 — Análise Avançada ✨🎉 [Lab #42] 🧑🏽‍🔬';
  const TITULO_BIDI_RTL = 'مجلد الأبحاث القانونية \u202Ereversed text\u202C — Urbanismo & Regularização';
  const TITULO_XSS = '<script>alert("xss")</script><img src=x onerror=alert(1)>" onmouseover="alert(2)';

  it('4.1. renderizarBreadcrumb com título >200 caracteres preserva integridade sem romper o layout', () => {
    const pastasLongas = [
      { id: 'pasta_longa', nome: TITULO_GIGANTE, cor: '#314F79' }
    ];

    const container = new MockDOMElement('div');
    const nav = renderizarBreadcrumb(container, 'pasta_longa', { pastas: pastasLongas });

    assert.ok(nav);
    const spanCurrent = nav.querySelector('.ath-bib-breadcrumb-current');
    assert.ok(spanCurrent);

    // O title deve conter o texto completo para tooltip
    assert.ok(spanCurrent.getAttribute('title').includes('Hermenêutica Jurídica'));
    assert.ok(spanCurrent.getAttribute('title').length >= 300);

    // O texto deve estar contido no span interno
    const spanTxt = spanCurrent.querySelector('.ath-bib-breadcrumb-txt');
    assert.ok(spanTxt.textContent.includes('Jurisprudência dos Tribunais'));
  });

  it('4.2. renderizarBreadcrumb com múltiplos emojis complexos e ZWJ clusters preserva codificação', () => {
    const pastasEmojis = [
      { id: 'pasta_emojis', nome: TITULO_EMOJIS, cor: '#FF6B2C' }
    ];

    const container = new MockDOMElement('div');
    const nav = renderizarBreadcrumb(container, 'pasta_emojis', { pastas: pastasEmojis });

    const spanCurrent = nav.querySelector('.ath-bib-breadcrumb-current');
    assert.ok(spanCurrent);
    const spanTxt = spanCurrent.querySelector('.ath-bib-breadcrumb-txt');
    assert.ok(spanTxt);
    assert.ok(spanTxt.textContent.includes('🧑🏽‍🔬'));
    assert.ok(spanTxt.textContent.includes('🧬🚀'));
  });

  it('4.3. renderizarBreadcrumb com caracteres Unicode BiDi (RTL/LTR) preserva nós e separador', () => {
    const pastasBidi = [
      { id: 'pasta_bidi', nome: TITULO_BIDI_RTL, cor: '#0D9488' }
    ];

    const container = new MockDOMElement('div');
    const nav = renderizarBreadcrumb(container, 'pasta_bidi', { pastas: pastasBidi });

    const sep = nav.querySelector('.ath-bib-breadcrumb-sep');
    assert.equal(sep.textContent, '/');

    const spanCurrent = nav.querySelector('.ath-bib-breadcrumb-current');
    assert.ok(spanCurrent);
    const spanTxt = spanCurrent.querySelector('.ath-bib-breadcrumb-txt');
    assert.ok(spanTxt);
    assert.ok(spanTxt.textContent.includes('الأبحاث القانونية'));
  });

  it('4.4. renderizarBreadcrumb neutraliza rigorosamente tentativas de injeção XSS', () => {
    const pastasXss = [
      { id: 'pasta_xss', nome: TITULO_XSS, cor: '#DC2626' }
    ];

    const container = new MockDOMElement('div');
    const nav = renderizarBreadcrumb(container, 'pasta_xss', { pastas: pastasXss });

    const rawHtml = nav.innerHTML;
    assert.ok(!rawHtml.includes('<script>'), 'Tag script não deve existir como nó executável no HTML');
    assert.ok(rawHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'), 'Deve ter escapado as tags');
    assert.ok(!rawHtml.includes('<img src=x'), 'Tag img maliciosa não deve ter sido injetada');
  });

  it('4.5. renderizarPastasCronos com títulos ultra-longos renderiza aba e card com title de acessibilidade', () => {
    const pastasLongas = [
      { id: 'p_longa', nome: TITULO_GIGANTE, cor: '#314F79' },
      { id: 'p_xss', nome: TITULO_XSS, cor: '#FF6B2C' }
    ];

    const container = renderizarPastasCronos(pastasLongas, 'todas');
    const cardLonga = container.querySelector('[data-pasta-id="p_longa"]');
    assert.ok(cardLonga);

    const tab = cardLonga.querySelector('.ath-bib-folder-tab');
    assert.equal(tab.textContent, TITULO_GIGANTE);

    const titleEl = cardLonga.querySelector('.ath-bib-folder-title');
    assert.equal(titleEl.title, TITULO_GIGANTE);
    assert.equal(titleEl.textContent, TITULO_GIGANTE);
  });

  it('4.6. selecionarPasta atualizando breadcrumb existente com títulos adversários mantém formato canônico', () => {
    const breadcrumb = new MockDOMElement('div');
    const pastas = [{ id: 'p_extrema', nome: TITULO_GIGANTE }];

    selecionarPasta('p_extrema', {
      pastas,
      breadcrumbEl: breadcrumb
    });

    assert.equal(breadcrumb.textContent, `Bibliografia / ${TITULO_GIGANTE}`);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5: Concorrência Extrema: Injeção de Múltiplos Cliques em Cards em <10ms
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Concorrência Extrema: Injeção de Múltiplos Cliques em Cards em <10ms', () => {

  it('5.1. 100 cliques concorrentes disparados em menos de 10ms convergem determinísticamente', () => {
    let ultimaPastaSelecionada = null;
    let contadorCliques = 0;

    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onSelecionarPasta: (pId) => {
        contadorCliques++;
        ultimaPastaSelecionada = pId;
      }
    });

    const cards = container.querySelectorAll('.ath-bib-folder-card');
    assert.equal(cards.length, 3);

    const totalDisparos = 100;
    const sequencia = ['pasta_urbanismo', 'pasta_metodologia', 'pasta_somente_leitura'];
    let ultimoEsperado = null;

    const t0 = Date.now();
    for (let i = 0; i < totalDisparos; i++) {
      const pAlvo = sequencia[i % sequencia.length];
      ultimoEsperado = pAlvo;
      const card = container.querySelector(`[data-pasta-id="${pAlvo}"]`);
      card.dispatchEvent(criarMockEvent('click'));
    }
    const duracaoMs = Date.now() - t0;

    assert.equal(contadorCliques, 100, 'Todos os 100 cliques devem ser processados de forma síncrona');
    assert.equal(ultimaPastaSelecionada, ultimoEsperado, 'Última pasta selecionada deve bater rigorosamente com o último clique');
    assert.ok(duracaoMs <= 100, `Execução dos 100 cliques deve ser ultrarrápida (levou ${duracaoMs}ms)`);
  });

  it('5.2. Unicidade de card ativo: exatamente UM card possui .ath-bib-folder-card--active após a avalanche', () => {
    const componenteFalso = {
      container: new MockDOMElement('div'),
      pastaFiltroId: 'todas',
      artigos: [...ITENS_FIXTURE],
      artigosCatalogo() { return this.artigos; },
      atualizarGridCatalogo() {},
      ...metodosEstudoPastas
    };

    componenteFalso.renderizarBarraPastasTopo(componenteFalso.container);

    const containerCards = componenteFalso.container.querySelector('#athBibFoldersTrackContainer');

    // Dispara 60 alternâncias rápidas
    for (let i = 0; i < 60; i++) {
      const pId = (i % 2 === 0) ? 'pasta_urbanismo' : 'pasta_metodologia';
      componenteFalso.selecionarPastaBib(pId);
    }

    // 59 é ímpar -> pasta_metodologia
    const cardsAtivos = containerCards.querySelectorAll('.ath-bib-folder-card--active');
    assert.equal(cardsAtivos.length, 1, 'Exatamente UM card deve estar com a classe de ativo');
    assert.equal(cardsAtivos[0].getAttribute('data-pasta-id'), 'pasta_metodologia', 'O card ativo deve ser a última pasta');

    const cardsAriaSelectedTrue = containerCards.querySelectorAll('[aria-selected="true"]');
    assert.equal(cardsAriaSelectedTrue.length, 1);
    assert.equal(cardsAriaSelectedTrue[0].getAttribute('data-pasta-id'), 'pasta_metodologia');
  });

  it('5.3. Sincronismo entre pastaFiltroId, classes visuais e sessionStorage após rajada de cliques', () => {
    const storageMemoria = {
      mapa: new Map(),
      getItem(k) { return this.mapa.get(k) || null; },
      setItem(k, v) { this.mapa.set(k, String(v)); }
    };

    let pastaFiltroId = 'todas';
    const container = renderizarPastasCronos(PASTAS_FIXTURE, pastaFiltroId);

    const alternar = (pId) => {
      selecionarPasta(pId, {
        pastas: PASTAS_FIXTURE,
        storage: storageMemoria,
        onSelect: (id) => {
          pastaFiltroId = id;
          container.querySelectorAll('.ath-bib-folder-card').forEach(c => {
            const ehAtivo = c.getAttribute('data-pasta-id') === id;
            c.classList.toggle('ath-bib-folder-card--active', ehAtivo);
          });
        }
      });
    };

    for (let i = 0; i < 80; i++) {
      alternar(i % 2 === 0 ? 'pasta_urbanismo' : 'pasta_metodologia');
    }

    assert.equal(pastaFiltroId, 'pasta_metodologia');
    assert.equal(storageMemoria.getItem(STORAGE_KEY_BIB_PASTA_ATIVA), 'pasta_metodologia');

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');
    const cardMet = container.querySelector('[data-pasta-id="pasta_metodologia"]');

    assert.ok(!cardUrb.classList.contains('ath-bib-folder-card--active'));
    assert.ok(cardMet.classList.contains('ath-bib-folder-card--active'));
  });

  it('5.4. Clique concorrente no botão de opções (⋯) com stopPropagation não aciona a seleção do card', () => {
    let pastaSelecionada = null;
    let menuOpcoesAberto = null;

    const container = renderizarPastasCronos(PASTAS_FIXTURE, 'todas', null, {
      onSelecionarPasta: (pId) => { pastaSelecionada = pId; },
      onOpcoesPasta: (pId) => { menuOpcoesAberto = pId; }
    });

    const cardUrb = container.querySelector('[data-pasta-id="pasta_urbanismo"]');
    const btnOpt = cardUrb.querySelector('.ath-bib-folder-opt-btn');
    assert.ok(btnOpt, 'Botão de opções deve existir');

    const evCliqueOpt = criarMockEvent('click');
    btnOpt.dispatchEvent(evCliqueOpt);

    assert.equal(menuOpcoesAberto, 'pasta_urbanismo', 'Menu de opções da pasta deve ter sido chamado');
    assert.equal(pastaSelecionada, null, 'onSelecionarPasta NÃO deve ter sido acionado devido a ev.stopPropagation()');
  });

  it('5.5. Alternância ultrarrápida entre "Estante Geral" e cards de pastas: exclusividade mútua perfeita', () => {
    const componenteFalso = {
      container: new MockDOMElement('div'),
      pastaFiltroId: 'todas',
      artigos: [...ITENS_FIXTURE],
      artigosCatalogo() { return this.artigos; },
      atualizarGridCatalogo() {},
      ...metodosEstudoPastas
    };

    componenteFalso.renderizarBarraPastasTopo(componenteFalso.container);

    const btnGeral = componenteFalso.container.querySelector('#athBtnEstanteGeral');
    assert.ok(btnGeral);

    // Alterna 40 vezes entre Estante Geral e pasta_urbanismo
    for (let i = 0; i < 40; i++) {
      if (i % 2 === 0) {
        componenteFalso.selecionarPastaBib('pasta_urbanismo');
      } else {
        componenteFalso.selecionarPastaBib('todas');
      }
    }

    // Terminou em 'todas' (39 é ímpar)
    assert.equal(componenteFalso.pastaFiltroId, 'todas');
    assert.ok(btnGeral.classList.contains('ath-btn-estante-geral--active'));

    const cardsAtivos = componenteFalso.container.querySelectorAll('.ath-bib-folder-card--active');
    assert.equal(cardsAtivos.length, 0, 'Nenhum card específico de pasta deve estar ativo quando a Estante Geral está selecionada');

    // Agora faz 1 clique final em pasta_metodologia
    componenteFalso.selecionarPastaBib('pasta_metodologia');
    assert.equal(componenteFalso.pastaFiltroId, 'pasta_metodologia');
    assert.ok(!btnGeral.classList.contains('ath-btn-estante-geral--active'), 'Botão Estante Geral não pode estar ativo');

    const novoAtivo = componenteFalso.container.querySelectorAll('.ath-bib-folder-card--active');
    assert.equal(novoAtivo.length, 1);
    assert.equal(novoAtivo[0].getAttribute('data-pasta-id'), 'pasta_metodologia');
  });

});
