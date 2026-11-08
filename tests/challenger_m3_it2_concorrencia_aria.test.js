// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file Suíte de Estresse Adversarial Empírico — M3 Iteração 2.
 * Concorrência de Eventos (Blur/Click), Idempotência Estrita, Resiliência de Clipboard e WAI-ARIA Focus Trap.
 *
 * Agente: m3_it2_challenger_2 (critic, specialist)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderizarLivro3D,
  abrirLivro3D,
  fecharLivro3D,
  tratarTecladoLivro3D,
  renderizarFolhaInterna,
  copiarTextoParaClipboard
} from '../src/ui/athenes_estudo_artigos_estante.js';

import {
  criarBookReferenceItem
} from '../src/core/athenes_referencias.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock DOM Completo e Fiel para Testes Adversariais em Node.js
// ─────────────────────────────────────────────────────────────────────────────

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
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._textContent = '';
    this._value = '';
    this.selected = false;
  }

  get id() {
    return this.attributes.get('id') || '';
  }
  set id(v) {
    this.setAttribute('id', v);
  }

  get className() {
    return this.classList.toString();
  }
  set className(v) {
    this.classList = new MockClassList(v);
  }

  get textContent() {
    return this._textContent;
  }
  set textContent(v) {
    this._textContent = String(v ?? '');
  }

  get value() {
    return this._value !== undefined ? this._value : this._textContent;
  }
  set value(v) {
    this._value = String(v ?? '');
    this._textContent = this._value;
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
    let defaultPrevented = false;
    let propagationStopped = false;
    const eventObj = {
      target: this,
      currentTarget: this,
      type: t,
      preventDefault: () => { defaultPrevented = true; },
      stopPropagation: () => { propagationStopped = true; },
      get defaultPrevented() { return defaultPrevented; },
      get propagationStopped() { return propagationStopped; },
      ...ev
    };
    for (const fn of arr) {
      fn.call(this, eventObj);
    }
    return !defaultPrevented;
  }

  focus() {
    if (globalThis.document) {
      globalThis.document.activeElement = this;
    }
  }

  select() {
    this.selected = true;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    if (!sel) return [];

    // Suporte a seletores múltiplos separados por vírgula
    if (sel.includes(',')) {
      const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
      const seen = new Set();
      const results = [];
      for (const p of parts) {
        for (const el of this.querySelectorAll(p)) {
          if (!seen.has(el)) {
            seen.add(el);
            results.push(el);
          }
        }
      }
      return results;
    }

    // Suporte a seletores descendentes
    const tokens = sel.trim().split(/\s+/);
    if (tokens.length > 1) {
      const first = tokens[0];
      const rest = tokens.slice(1).join(' ');
      const parents = this.querySelectorAll(first);
      const out = [];
      for (const p of parents) {
        out.push(...p.querySelectorAll(rest));
      }
      return out;
    }

    let cleanSel = tokens[0];
    let notFilter = null;
    const notMatch = cleanSel.match(/:not\((.*?)\)/);
    if (notMatch) {
      notFilter = notMatch[1];
      cleanSel = cleanSel.replace(notMatch[0], '');
    }

    const results = [];
    const check = (el) => {
      let matches = true;
      if (cleanSel) {
        if (cleanSel.startsWith('#')) {
          matches = el.getAttribute('id') === cleanSel.slice(1);
        } else if (cleanSel.includes('.')) {
          const [tag, ...classes] = cleanSel.split('.');
          if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) {
            matches = false;
          } else {
            matches = classes.every(c => el.classList && (el.classList.contains(c) || el.classList.has?.(c)));
          }
        } else if (cleanSel.startsWith('[') && cleanSel.endsWith(']')) {
          const attr = cleanSel.slice(1, -1);
          matches = el.hasAttribute(attr);
        } else {
          matches = el.tagName.toLowerCase() === cleanSel.toLowerCase();
        }
      }

      if (matches && notFilter) {
        if (notFilter.startsWith('[') && notFilter.endsWith(']')) {
          const inner = notFilter.slice(1, -1);
          if (inner.includes('=')) {
            const [attr, val] = inner.split('=');
            const cleanVal = val.replace(/['"]/g, '');
            if (el.getAttribute(attr) === cleanVal) matches = false;
          } else {
            if (el.hasAttribute(inner)) matches = false;
          }
        }
      }

      if (matches) results.push(el);
      for (const ch of el.children) check(ch);
    };

    for (const ch of this.children) check(ch);
    return results;
  }

  closest(sel) {
    let cur = this;
    while (cur) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        if (cur.classList && (cur.classList.contains(cls) || cur.classList.has?.(cls))) {
          return cur;
        }
      } else if (sel.startsWith('#')) {
        if (cur.getAttribute('id') === sel.slice(1)) return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }
}

// Configuração Global de Mock
const mockBody = new MockDOMElement('body');
globalThis.document = {
  body: mockBody,
  createElement: (tag) => new MockDOMElement(tag),
  getElementById: (id) => null,
  execCommand: (cmd) => true,
  activeElement: null
};

// Clipboard padrão
const _defaultClipboard = {
  writeText: async () => Promise.resolve()
};
Object.defineProperty(globalThis, 'navigator', {
  value: {
    clipboard: _defaultClipboard
  },
  configurable: true,
  writable: true
});

// ─────────────────────────────────────────────────────────────────────────────
// SUÍTE 1: Concorrência e Deduplicação no Salvamento de Anotações (Blur vs Click)
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial 1: Concorrência Extrema Blur/Click no Salvamento de Anotações', () => {
  beforeEach(() => {
    globalThis.document.body.children = [];
    globalThis.document.activeElement = null;
  });

  it('1.1: Disparo concorrente imediato blur seguido de click: exatamente 1 chamada a onSalvarNota e 1 item em pinnedNotes', () => {
    const ref = criarBookReferenceItem({ id: 'ref_concorrencia_1', pinnedNotes: [] });
    const logChamadas = [];

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (nota) => {
        logChamadas.push(nota);
      }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    textarea.value = 'Nota concorrente imediata';

    // Simula evento síncrono imediato de blur (perda de foco) seguido de click
    textarea.dispatchEvent({ type: 'blur' });
    btnSalvar.dispatchEvent({ type: 'click' });

    assert.equal(logChamadas.length, 1, 'onSalvarNota deve ser acionado estritamente 1 vez');
    assert.equal(logChamadas[0], 'Nota concorrente imediata');
    assert.equal(ref.pinnedNotes.length, 1, 'pinnedNotes deve ter exatamente 1 item');
    assert.equal(ref.pinnedNotes[0], 'Nota concorrente imediata');
    assert.equal(ref.fichamento.resumoPessoal, 'Nota concorrente imediata');
  });

  it('1.2: Metralhadora de cliques (50 cliques consecutivos no botão de salvar) após digitar texto', () => {
    const ref = criarBookReferenceItem({ id: 'ref_cliques_50', pinnedNotes: [] });
    let totalExecucoes = 0;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { totalExecucoes++; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    textarea.value = 'Texto salvo uma única vez';

    for (let i = 0; i < 50; i++) {
      btnSalvar.dispatchEvent({ type: 'click' });
    }

    assert.equal(totalExecucoes, 1, 'Mesmo com 50 cliques, onSalvarNota deve rodar apenas 1 vez');
    assert.equal(ref.pinnedNotes.length, 1, 'pinnedNotes deve conter apenas 1 nota');
    assert.equal(ref.pinnedNotes[0], 'Texto salvo uma única vez');
  });

  it('1.3: Mousedown no botão de salvar anotação previne perda de foco no navegador (preventDefault)', () => {
    const ref = criarBookReferenceItem({ id: 'ref_mousedown_check' });
    const folha = renderizarFolhaInterna(ref);
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    let preventDefaultChamado = false;
    btnSalvar.dispatchEvent({
      type: 'mousedown',
      preventDefault: () => { preventDefaultChamado = true; }
    });

    assert.equal(preventDefaultChamado, true, 'btnSalvarNota mousedown deve chamar preventDefault() para evitar desfoque indevido');
  });

  it('1.4: Sequência alternada de edições distintas com blur e click intercalados', () => {
    const ref = criarBookReferenceItem({ id: 'ref_intercalado', pinnedNotes: [] });
    const historico = [];

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (n) => historico.push(n)
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    // Edição 1
    textarea.value = 'Primeira Nota';
    textarea.dispatchEvent({ type: 'blur' });
    btnSalvar.dispatchEvent({ type: 'click' });

    // Edição 2
    textarea.value = 'Segunda Nota';
    btnSalvar.dispatchEvent({ type: 'click' });
    textarea.dispatchEvent({ type: 'blur' });

    // Edição 3
    textarea.value = 'Terceira Nota';
    textarea.dispatchEvent({ type: 'blur' });

    assert.deepEqual(historico, ['Primeira Nota', 'Segunda Nota', 'Terceira Nota'], 'Deve registrar cada nova edição exatamente uma vez');
    assert.deepEqual(ref.pinnedNotes, ['Primeira Nota', 'Segunda Nota', 'Terceira Nota']);
    assert.equal(ref.fichamento.resumoPessoal, 'Terceira Nota');
  });

  it('1.5: Rejeição absoluta de entradas vazias em rajada de blur e click', () => {
    const ref = criarBookReferenceItem({ id: 'ref_vazio_rajada', pinnedNotes: [] });
    let chamou = false;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { chamou = true; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    const entradasFalsas = ['', '   ', '\n\n', '\t \t \r\n'];
    for (const ent of entradasFalsas) {
      textarea.value = ent;
      textarea.dispatchEvent({ type: 'blur' });
      btnSalvar.dispatchEvent({ type: 'click' });
    }

    assert.equal(chamou, false, 'Nenhuma entrada vazia deve acionar onSalvarNota');
    assert.equal(ref.pinnedNotes.length, 0, 'pinnedNotes deve continuar vazio');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUÍTE 2: Idempotência Estrita no Salvamento de Anotações
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial 2: Idempotência Estrita e Detecção de Redundância', () => {
  it('2.1: Desfocagem sem alteração em livro com nota existente preserva integridade sem duplicar', () => {
    const ref = criarBookReferenceItem({
      id: 'ref_pre_existente',
      pinnedNotes: ['Nota Prévia Salva']
    });
    let disparou = false;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { disparou = true; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    assert.equal(textarea.value, 'Nota Prévia Salva');

    // Desfoca sem tocar no texto
    textarea.dispatchEvent({ type: 'blur' });

    assert.equal(disparou, false, 'Blur sem alteração não deve disparar callback');
    assert.equal(ref.pinnedNotes.length, 1, 'pinnedNotes deve continuar com 1 item');
    assert.equal(ref.pinnedNotes[0], 'Nota Prévia Salva');
  });

  it('2.2: Adição de espaços/tabs ao redor de texto já salvo é saneada pelo trim e não gera duplicação', () => {
    const ref = criarBookReferenceItem({
      id: 'ref_whitespace_trim',
      pinnedNotes: ['Fórmula de Haversine']
    });
    let disparou = false;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { disparou = true; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    // Usuário adiciona espaços ao redor do mesmo texto
    textarea.value = '   Fórmula de Haversine \t\n  ';
    textarea.dispatchEvent({ type: 'blur' });
    btnSalvar.dispatchEvent({ type: 'click' });

    assert.equal(disparou, false, 'Texto identico após trim não deve disparar novo salvamento');
    assert.equal(ref.pinnedNotes.length, 1);
  });

  it('2.3: Re-salvamento de texto idêntico após edição intermediária é permitido e preserva ordem', () => {
    const ref = criarBookReferenceItem({ id: 'ref_ciclo_notas', pinnedNotes: [] });
    const notasRecebidas = [];

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (n) => notasRecebidas.push(n)
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    // Salva "Versão A"
    textarea.value = 'Versão A';
    btnSalvar.dispatchEvent({ type: 'click' });

    // Salva "Versão B"
    textarea.value = 'Versão B';
    btnSalvar.dispatchEvent({ type: 'click' });

    // Volta a salvar "Versão A"
    textarea.value = 'Versão A';
    btnSalvar.dispatchEvent({ type: 'click' });

    assert.deepEqual(notasRecebidas, ['Versão A', 'Versão B', 'Versão A']);
    assert.deepEqual(ref.pinnedNotes, ['Versão A', 'Versão B', 'Versão A']);
  });

  it('2.4: Renderizar folha sem fornecer callback onSalvarNota executa sem falhas', () => {
    const ref = criarBookReferenceItem({ id: 'ref_sem_callback', pinnedNotes: [] });
    const folha = renderizarFolhaInterna(ref);

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    textarea.value = 'Sem callback configurado';
    assert.doesNotThrow(() => {
      textarea.dispatchEvent({ type: 'blur' });
      btnSalvar.dispatchEvent({ type: 'click' });
    });

    assert.equal(ref.pinnedNotes.length, 1);
    assert.equal(ref.pinnedNotes[0], 'Sem callback configurado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUÍTE 3: Resiliência da Clipboard API e Fallback com execCommand
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial 3: Resiliência da Clipboard API e Fallback com execCommand', () => {
  beforeEach(() => {
    globalThis.document.body.children = [];
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: _defaultClipboard
      },
      configurable: true,
      writable: true
    });
  });

  it('3.1: Fallback é acionado quando navigator.clipboard.writeText rejeita com NotAllowedError', async () => {
    let fallbackExecutado = false;
    let fallbackComando = null;

    globalThis.document.execCommand = (cmd) => {
      fallbackExecutado = true;
      fallbackComando = cmd;
      return true;
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => {
            const err = new Error('NotAllowedError: Read/write permission denied.');
            err.name = 'NotAllowedError';
            throw err;
          }
        }
      },
      configurable: true,
      writable: true
    });

    const sucesso = await copiarTextoParaClipboard('(ALMEIDA, 2026)');
    assert.equal(sucesso, true, 'copiarTextoParaClipboard deve retornar true via fallback');
    assert.equal(fallbackExecutado, true, 'document.execCommand deve ter sido acionado');
    assert.equal(fallbackComando, 'copy');
  });

  it('3.2: Fallback é acionado quando navigator.clipboard.writeText rejeita com SecurityError', async () => {
    let fallbackExecutado = false;

    globalThis.document.execCommand = () => {
      fallbackExecutado = true;
      return true;
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => {
            const err = new Error('SecurityError: The operation is insecure.');
            err.name = 'SecurityError';
            throw err;
          }
        }
      },
      configurable: true,
      writable: true
    });

    const sucesso = await copiarTextoParaClipboard('(SANTOS, 2025)');
    assert.equal(sucesso, true);
    assert.equal(fallbackExecutado, true);
  });

  it('3.3: Suporte a ambiente legado onde navigator.clipboard é completamente indefinido', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true
    });

    let taCriada = null;
    let removeuTa = false;

    const origCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'textarea') taCriada = el;
      return el;
    };

    const origRemoveChild = globalThis.document.body.removeChild;
    globalThis.document.body.removeChild = (child) => {
      removeuTa = true;
      return origRemoveChild.call(globalThis.document.body, child);
    };

    globalThis.document.execCommand = () => true;

    const sucesso = await copiarTextoParaClipboard('(LEGADO, 1999)');
    assert.equal(sucesso, true);
    assert.ok(taCriada, 'Deve criar textarea para execCommand');
    assert.equal(taCriada.value, '(LEGADO, 1999)');
    assert.equal(taCriada.getAttribute('readonly'), '');
    assert.equal(taCriada.selected, true, 'Deve invocar textarea.select()');
    assert.equal(removeuTa, true, 'Deve remover textarea temporário do body');

    // Restaura document
    globalThis.document.createElement = origCreateElement;
    globalThis.document.body.removeChild = origRemoveChild;
  });

  it('3.4: Resiliência absoluta: se até o execCommand lançar erro, retorna false sem lançar exceção', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => { throw new Error('Falha total'); }
        }
      },
      configurable: true,
      writable: true
    });

    globalThis.document.execCommand = () => {
      throw new Error('execCommand totalmente desabilitado');
    };

    const sucesso = await copiarTextoParaClipboard('(FALHA, 2000)');
    assert.equal(sucesso, false, 'Deve retornar false de forma limpa');
  });

  it('3.5: Feedback visual "Copiado! ✓" é ativado no botão e reverte após 2000ms', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => Promise.resolve()
        }
      },
      configurable: true,
      writable: true
    });

    const ref = criarBookReferenceItem({ id: 'ref_btn_feedback', formattedCitationKey: '(TESTE, 2026)' });
    const folha = renderizarFolhaInterna(ref);
    const btnCopiar = folha.querySelector('.ath-btn-copiar-citacao');

    assert.equal(btnCopiar.textContent, 'Copiar Citação Formatada');
    assert.equal(btnCopiar.classList.contains('copiado'), false);

    btnCopiar.dispatchEvent({ type: 'click' });

    assert.equal(btnCopiar.textContent, 'Copiado! ✓');
    assert.equal(btnCopiar.classList.contains('copiado'), true);
    assert.equal(btnCopiar.getAttribute('aria-label'), 'Citação formatada copiada para a área de transferência');

    // Aguarda o timeout de 2000ms
    await new Promise(r => setTimeout(r, 2050));

    assert.equal(btnCopiar.textContent, 'Copiar Citação Formatada');
    assert.equal(btnCopiar.classList.contains('copiado'), false);
    assert.equal(btnCopiar.getAttribute('aria-label'), 'Copiar citação formatada');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUÍTE 4: WAI-ARIA 1.2 Dinâmico e Ciclo de Focus Trap (Tab / Shift+Tab)
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial 4: WAI-ARIA 1.2 Dinâmico e Ciclo de Focus Trap (Tab / Shift+Tab)', () => {
  beforeEach(() => {
    globalThis.document.body.children = [];
    globalThis.document.activeElement = null;
  });

  it('4.1: Chaveamento dinâmico role="button" <-> role="region" e tabindex 0 <-> -1 (WAI-ARIA 1.2)', () => {
    const ref = criarBookReferenceItem({ id: 'ref_aria_chav' });
    const livroEl = renderizarLivro3D(ref);

    // Estado inicial: Fechado
    assert.equal(livroEl.getAttribute('role'), 'button');
    assert.equal(livroEl.getAttribute('tabindex'), '0');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'false');
    assert.equal(livroEl.getAttribute('aria-haspopup'), 'dialog');

    // Abertura: comuta para container de diálogo neutro
    abrirLivro3D(livroEl, ref);
    assert.equal(livroEl.getAttribute('role'), 'region', 'Não pode aninhar dialog em button');
    assert.equal(livroEl.getAttribute('tabindex'), '-1', 'Container neutro tem tabindex -1');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'true');

    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    assert.ok(folha);
    assert.equal(folha.getAttribute('role'), 'dialog');
    assert.equal(folha.getAttribute('aria-modal'), 'true');
    assert.equal(folha.getAttribute('aria-hidden'), 'false');

    // Fechamento: restaura papel de botão de disparo
    fecharLivro3D(livroEl);
    assert.equal(livroEl.getAttribute('role'), 'button');
    assert.equal(livroEl.getAttribute('tabindex'), '0');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'false');
    assert.equal(folha.getAttribute('aria-hidden'), 'true');
    assert.equal(folha.style.display, 'none');
  });

  it('4.2: Foco inicial acessível vai diretamente para o título da folha (h2.ath-folha-titulo)', async () => {
    const ref = criarBookReferenceItem({ id: 'ref_foco_titulo', titulo: 'Geodésia Aplicada' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);

    await new Promise(r => setTimeout(r, 60));

    const titulo = livroEl.querySelector('.ath-folha-titulo');
    assert.ok(titulo);
    assert.equal(titulo.getAttribute('tabindex'), '-1');
    assert.equal(globalThis.document.activeElement, titulo, 'activeElement deve ser o título da folha');
  });

  it('4.3: Focus Trap no Tab: ao tabular para frente a partir do último elemento, foca o primeiro', () => {
    const ref = criarBookReferenceItem({ id: 'ref_focus_trap_tab' });
    const folha = renderizarFolhaInterna(ref, {
      onEditarMeta: () => {},
      onMoverPasta: () => {},
      onMudarCor: () => {}
    });

    const focaveis = folha.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    assert.ok(focaveis.length >= 4, `Folha deve conter múltiplos controles focáveis (encontrados: ${focaveis.length})`);

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    // Coloca foco no último elemento focável
    globalThis.document.activeElement = ultimo;

    let preventDefaultChamado = false;
    folha.dispatchEvent({
      type: 'keydown',
      key: 'Tab',
      keyCode: 9,
      shiftKey: false,
      preventDefault: () => { preventDefaultChamado = true; }
    });

    assert.equal(preventDefaultChamado, true, 'Tab no último elemento deve acionar preventDefault');
    assert.equal(globalThis.document.activeElement, primeiro, 'Foco deve ciclar para o primeiro elemento');
  });

  it('4.4: Focus Trap no Shift+Tab: ao tabular para trás a partir do primeiro elemento, foca o último', () => {
    const ref = criarBookReferenceItem({ id: 'ref_focus_trap_shifttab' });
    const folha = renderizarFolhaInterna(ref, {
      onEditarMeta: () => {},
      onMoverPasta: () => {},
      onMudarCor: () => {}
    });

    const focaveis = folha.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    assert.ok(focaveis.length >= 4, `Folha deve conter múltiplos controles focáveis (encontrados: ${focaveis.length})`);

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    // Coloca foco no primeiro elemento focável
    globalThis.document.activeElement = primeiro;

    let preventDefaultChamado = false;
    folha.dispatchEvent({
      type: 'keydown',
      key: 'Tab',
      keyCode: 9,
      shiftKey: true,
      preventDefault: () => { preventDefaultChamado = true; }
    });

    assert.equal(preventDefaultChamado, true, 'Shift+Tab no primeiro elemento deve acionar preventDefault');
    assert.equal(globalThis.document.activeElement, ultimo, 'Foco deve ciclar para o último elemento');
  });

  it('4.5: Escape fecha o livro e restaura o foco no disparador original anterior', () => {
    const ref = criarBookReferenceItem({ id: 'ref_esc_restaura_foco' });
    const livroEl = renderizarLivro3D(ref);

    const botaoDisparador = new MockDOMElement('button');
    globalThis.document.activeElement = botaoDisparador;

    // Abre o livro
    abrirLivro3D(livroEl, ref);
    assert.equal(livroEl._focoAnterior, botaoDisparador);

    // Pressiona Escape na folha
    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    folha.dispatchEvent({
      type: 'keydown',
      key: 'Escape',
      keyCode: 27
    });

    assert.equal(livroEl.classList.contains('aberto'), false, 'Livro deve ser fechado');
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)');
    assert.equal(globalThis.document.activeElement, botaoDisparador, 'Foco deve ter sido restaurado para o disparador original');
  });
});
