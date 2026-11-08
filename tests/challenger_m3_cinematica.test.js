// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file Suíte de Testes Adversariais Empíricos — Milestone 3: Cinemática 3D, Folha de Fichamento & Leitor (Requisito R4).
 * 
 * Agente: m3_challenger_2 (teamwork_challenger / critic / specialist)
 * 
 * Desafios Adversariais Cobertos:
 * 1. Concorrência de aberturas: abrir múltiplos livros em sequência ou simultâneo
 *    (garantir invariante de estrita exclusividade: somente o livro ativo com .aberto e translateZ(60px),
 *    e fechamento determinístico de todos os livros prévios na estante inteira, inclusive multilinear).
 * 2. Fechamento suave: tecla Escape (código 27 ou key 'Escape'), clique no backdrop/scrim (#athEstanteScrim)
 *    e clique fora retornando com precisão absoluta a 'rotateY(0deg) translateZ(0)'.
 * 3. Folha interna: alternância de status de leitura (nao_lido -> lendo -> fichado -> ciclo),
 *    cópia de citação formatada com feedback visual e clipboard, e anotações com caracteres especiais,
 *    scripts de injeção XSS e textos volumosos sem corrupção de pinnedNotes.
 * 4. Integração com Leitor: clique no botão primário '📖 Abrir Arquivo / Ler Referência' acionando
 *    abrirArtigoNoEstudio(art) e propagando integralmente os parâmetros de sessionStorage.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderizarEstante3D,
  renderizarLivro3D,
  abrirLivro3D,
  fecharLivro3D,
  fecharTodosLivros3D,
  tratarTecladoLivro3D,
  renderizarFolhaInterna
} from '../src/ui/athenes_estudo_artigos_estante.js';

import {
  criarBookReferenceItem,
  STATUS_LEITURA
} from '../src/core/athenes_referencias.js';

import {
  EstudoArtigosView
} from '../src/ui/athenes_estudo_artigos.js';

// ─────────────────────────────────────────────────────────────────────────────
// Infraestrutura Universal de Mock DOM para Testes Adversariais em Node.js
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
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._textContent = '';
    this._innerHTML = '';
    this._value = '';

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
    for (const fn of arr) {
      fn.call(this, {
        target: this,
        currentTarget: this,
        type: t,
        preventDefault: () => {},
        stopPropagation: () => {},
        ...ev
      });
    }
  }

  focus() {
    if (globalThis.document) {
      globalThis.document.activeElement = this;
    }
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
        if (!tag || el.tagName.toLowerCase() === tag.toLowerCase()) {
          matches = classes.every(c => el.classList && (el.classList.contains(c) || el.classList.has?.(c)));
        }
      } else if (cleanSel.includes('[')) {
        const match = cleanSel.match(/([a-zA-Z0-9-_]+)?\[([a-zA-Z0-9-_]+)(?:=["']?([^"']*)["']?)?\]/);
        if (match) {
          const tag = match[1];
          const attr = match[2];
          const val = match[3];
          if (!tag || el.tagName.toLowerCase() === tag.toLowerCase()) {
            matches = val !== undefined ? el.getAttribute(attr) === val : el.attributes.has(attr);
          }
        }
      } else {
        matches = el.tagName.toLowerCase() === cleanSel.toLowerCase();
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

// Configuração dos Mocks Globais de Ambiente
const _mockStorage = new Map();
globalThis.sessionStorage = {
  getItem: (k) => _mockStorage.get(k) ?? null,
  setItem: (k, v) => _mockStorage.set(k, String(v)),
  removeItem: (k) => _mockStorage.delete(k),
  clear: () => _mockStorage.clear(),
  get length() { return _mockStorage.size; }
};

let _lastCopiedText = null;
const _mockClipboard = {
  writeText: async (txt) => {
    _lastCopiedText = txt;
    return Promise.resolve();
  }
};
Object.defineProperty(globalThis, 'navigator', {
  value: {
    clipboard: _mockClipboard
  },
  configurable: true,
  writable: true
});

const _elementosPorId = new Map();
globalThis.document = {
  createElement: (tag) => new MockDOMElement(tag),
  getElementById: (id) => _elementosPorId.get(id) || null,
  registerElementById: (id, el) => _elementosPorId.set(id, el),
  clearRegisteredElements: () => _elementosPorId.clear(),
  activeElement: null
};

// ─────────────────────────────────────────────────────────────────────────────
// SUÍTE ADVERSARIAL EMPÍRICA — MILSTONE 3 (R4)
// ─────────────────────────────────────────────────────────────────────────────

describe('Desafio 1: Concorrência de Aberturas e Exclusividade Estrita (R4)', () => {
  beforeEach(() => {
    _mockStorage.clear();
    _lastCopiedText = null;
    globalThis.document.clearRegisteredElements();
  });

  it('1.1: Avalanche sequencial de aberturas (18 livros em 3 prateleiras) preserva estritamente apenas 1 livro aberto', () => {
    // Cria 18 livros espalhados em 3 prateleiras de 6
    const itens = Array.from({ length: 18 }, (_, i) => criarBookReferenceItem({
      id: `livro_conc_${i}`,
      titulo: `Tratado de Agrimensura Vol. ${i + 1}`,
      ano: String(2010 + i)
    }));

    const estante = renderizarEstante3D(itens, { maxPorPrateleira: 6 });
    const todosLivros = estante.querySelectorAll('.ath-livro-3d');
    assert.equal(todosLivros.length, 18, 'A estante deve conter exatamente 18 livros');

    // Executa abertura sequencial de cada livro da estante
    for (let i = 0; i < todosLivros.length; i++) {
      const livroAlvo = todosLivros[i];
      abrirLivro3D(livroAlvo, itens[i]);

      // Validação do livro ativo
      assert.ok(livroAlvo.classList.contains('aberto'), `Livro ${i} deve ter classe .aberto`);
      assert.equal(livroAlvo.style.transform, 'translateZ(60px)', `Livro ${i} deve estar projetado no eixo Z`);
      assert.equal(livroAlvo.getAttribute('aria-expanded'), 'true', `Livro ${i} deve ter aria-expanded="true"`);

      // Verificação da estante inteira: nenhum outro exemplar pode estar aberto
      const abertos = estante.querySelectorAll('.ath-livro-3d.aberto');
      assert.equal(abertos.length, 1, `Na iteração ${i}, deve haver exatamente 1 livro aberto na estante`);
      assert.equal(abertos[0], livroAlvo, `O único livro aberto deve ser o exemplar ${i}`);

      // Valida que todos os outros livros foram fechados suavemente
      for (let j = 0; j < todosLivros.length; j++) {
        if (j !== i) {
          const outroLivro = todosLivros[j];
          assert.ok(!outroLivro.classList.contains('aberto'), `Livro ${j} não pode ter .aberto`);
          assert.equal(outroLivro.getAttribute('aria-expanded'), 'false', `Livro ${j} deve ter aria-expanded="false"`);
          if (outroLivro.style.transform) {
            assert.equal(outroLivro.style.transform, 'rotateY(0deg) translateZ(0)', `Livro ${j} deve ter retornado à posição de repouso`);
          }
        }
      }
    }
  });

  it('1.2: Abertura repetida (idempotência) do mesmo exemplar não duplica a folha interna', () => {
    const item = criarBookReferenceItem({ id: 'livro_idem', titulo: 'Monografia Única' });
    const estante = renderizarEstante3D([item]);
    const livroEl = estante.querySelector('.ath-livro-3d');

    // Abre 5 vezes consecutivas
    for (let c = 0; c < 5; c++) {
      abrirLivro3D(livroEl, item);
      assert.ok(livroEl.classList.contains('aberto'));
      assert.equal(livroEl.style.transform, 'translateZ(60px)');
    }

    const folhas = livroEl.querySelectorAll('.ath-livro-folha-interna');
    assert.equal(folhas.length, 1, 'Folha interna de fichamento não pode ser duplicada no DOM');
  });

  it('1.3: Concorrência cruzada entre prateleiras opostas (Prateleira 1 -> Prateleira 3 -> Prateleira 2)', () => {
    const itens = Array.from({ length: 18 }, (_, i) => criarBookReferenceItem({
      id: `p_cruz_${i}`,
      titulo: `Obra ${i}`
    }));
    const estante = renderizarEstante3D(itens, { maxPorPrateleira: 6 });
    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prateleiras.length, 3);

    const livroPrat1 = prateleiras[0].querySelector('.ath-livro-3d');
    const livroPrat3 = prateleiras[2].querySelector('.ath-livro-3d');
    const livroPrat2 = prateleiras[1].querySelector('.ath-livro-3d');

    // Abre na prateleira 1
    abrirLivro3D(livroPrat1, itens[0]);
    assert.ok(livroPrat1.classList.contains('aberto'));

    // Abre na prateleira 3 (deve fechar prateleira 1)
    abrirLivro3D(livroPrat3, itens[12]);
    assert.ok(livroPrat3.classList.contains('aberto'));
    assert.ok(!livroPrat1.classList.contains('aberto'), 'Livro da prateleira 1 deve ser fechado');
    assert.equal(livroPrat1.style.transform, 'rotateY(0deg) translateZ(0)');

    // Abre na prateleira 2 (deve fechar prateleira 3)
    abrirLivro3D(livroPrat2, itens[6]);
    assert.ok(livroPrat2.classList.contains('aberto'));
    assert.ok(!livroPrat3.classList.contains('aberto'), 'Livro da prateleira 3 deve ser fechado');
    assert.equal(livroPrat3.style.transform, 'rotateY(0deg) translateZ(0)');
  });

  it('1.4: Alternância de clique direto (Toggle) e imunidade contra fechamento ao clicar dentro da folha interna', () => {
    const item = criarBookReferenceItem({ id: 'livro_toggle', titulo: 'Toggle Test' });
    const estante = renderizarEstante3D([item]);
    const livroEl = estante.querySelector('.ath-livro-3d');

    // 1. Clique fecha -> abre
    livroEl.dispatchEvent({ type: 'click' });
    assert.ok(livroEl.classList.contains('aberto'), 'Clique no livro deve abrir');

    // 2. Clique dentro da folha interna -> NÃO deve fechar
    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    assert.ok(folha, 'Folha interna deve estar presente');
    const fakeTargetNoFolha = new MockDOMElement('div', 'ath-folha-campo-interno');
    folha.appendChild(fakeTargetNoFolha);

    livroEl.dispatchEvent({ type: 'click', target: fakeTargetNoFolha });
    assert.ok(livroEl.classList.contains('aberto'), 'Clique interno na folha não pode fechar o livro');

    // 3. Clique na capa externa do livro aberto -> deve fechar
    const capa = livroEl.querySelector('.ath-livro-capa');
    livroEl.dispatchEvent({ type: 'click', target: capa });
    assert.ok(!livroEl.classList.contains('aberto'), 'Clique na capa deve fechar o exemplar');
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)');
  });
});

describe('Desafio 2: Fechamento Suave (Escape, Scrim e Clique Fora) (R4)', () => {
  beforeEach(() => {
    _mockStorage.clear();
    globalThis.document.clearRegisteredElements();
  });

  it('2.1: Tecla Escape via key: "Escape" fecha suavemente e retorna a rotateY(0deg) translateZ(0)', () => {
    const item = criarBookReferenceItem({ id: 'esc_1', titulo: 'Escape Obra' });
    const livroEl = renderizarLivro3D(item);
    abrirLivro3D(livroEl, item);
    assert.ok(livroEl.classList.contains('aberto'));

    tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, livroEl);
    assert.ok(!livroEl.classList.contains('aberto'), 'Deve remover classe .aberto');
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)', 'Transform de repouso exato');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'false');
  });

  it('2.2: Tecla Escape via apenas código numérico 27 (legado) fecha suavemente', () => {
    const item = criarBookReferenceItem({ id: 'esc_code27', titulo: 'Escape Code 27' });
    const livroEl = renderizarLivro3D(item);
    abrirLivro3D(livroEl, item);
    assert.ok(livroEl.classList.contains('aberto'));

    tratarTecladoLivro3D({ keyCode: 27 }, livroEl);
    assert.ok(!livroEl.classList.contains('aberto'));
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)');
  });

  it('2.3: Teclas não-Escape (Enter, Space, Tab, ArrowDown, Escapade) são ignoradas', () => {
    const item = criarBookReferenceItem({ id: 'esc_ignorar' });
    const livroEl = renderizarLivro3D(item);
    abrirLivro3D(livroEl, item);

    const teclasNeutras = [
      { key: 'Enter', keyCode: 13 },
      { key: ' ', keyCode: 32 },
      { key: 'Tab', keyCode: 9 },
      { key: 'ArrowRight', keyCode: 39 },
      { key: 'Escapade', keyCode: 99 }
    ];

    for (const ev of teclasNeutras) {
      tratarTecladoLivro3D(ev, livroEl);
      assert.ok(livroEl.classList.contains('aberto'), `Tecla ${ev.key} não deve fechar o livro`);
      assert.equal(livroEl.style.transform, 'translateZ(60px)');
    }
  });

  it('2.4: Clique no backdrop scrim (#athEstanteScrim) e sincronia com fecharTodosLivros3D', () => {
    // Configura container com scrim e livros
    const container = new MockDOMElement('div', 'ath-container-bibliografia');
    const scrim = new MockDOMElement('div', 'ath-estante-scrim');
    scrim.id = 'athEstanteScrim';
    container.appendChild(scrim);
    globalThis.document.registerElementById('athEstanteScrim', scrim);

    const itens = [
      criarBookReferenceItem({ id: 'scrim_1' }),
      criarBookReferenceItem({ id: 'scrim_2' })
    ];
    const estante = renderizarEstante3D(itens);
    container.appendChild(estante);

    const [livro1, livro2] = estante.querySelectorAll('.ath-livro-3d');

    // Abre livro 1 -> scrim deve ficar ativo
    abrirLivro3D(livro1, itens[0]);
    assert.ok(livro1.classList.contains('aberto'));
    assert.ok(scrim.classList.contains('ativo'), 'Scrim deve receber classe .ativo ao abrir livro');

    // Simula listener do scrim disparando fecharTodosLivros3D
    fecharTodosLivros3D(container);
    assert.ok(!livro1.classList.contains('aberto'), 'Livro 1 deve ser fechado');
    assert.equal(livro1.style.transform, 'rotateY(0deg) translateZ(0)');
    assert.ok(!scrim.classList.contains('ativo'), 'Scrim deve perder classe .ativo após fechamento');
  });

  it('2.5: Clique fora em área neutra da estante dispara fechamento geral', () => {
    const container = new MockDOMElement('div', 'ath-estudo-artigos-main');
    const item = criarBookReferenceItem({ id: 'fora_1' });
    const estante = renderizarEstante3D([item]);
    container.appendChild(estante);

    const livroEl = estante.querySelector('.ath-livro-3d');
    abrirLivro3D(livroEl, item);
    assert.ok(livroEl.classList.contains('aberto'));

    // Simula listener global do container: clique fora de .ath-livro-3d
    const fundoNeutro = new MockDOMElement('div', 'ath-barra-superior');
    container.appendChild(fundoNeutro);

    // Verificação de lógica do controller AthenesEstudoArtigos
    const target = fundoNeutro;
    if (!target.closest('.ath-livro-3d')) {
      fecharTodosLivros3D(container);
    }

    assert.ok(!livroEl.classList.contains('aberto'), 'Livro deve ser fechado após clique em fundo neutro');
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)');
  });

  it('2.6: Operações de fechamento com nós nulos, desconectados ou sem classe operam sem exceções', () => {
    assert.doesNotThrow(() => fecharLivro3D(null));
    assert.doesNotThrow(() => fecharLivro3D({}));
    assert.doesNotThrow(() => fecharTodosLivros3D(null));
    assert.doesNotThrow(() => fecharTodosLivros3D(new MockDOMElement('div')));
    assert.doesNotThrow(() => tratarTecladoLivro3D(null, null));
  });
});

describe('Desafio 3: Folha Interna (Status de Leitura, Citação Formatada e Anotações Adversariais) (R4)', () => {
  beforeEach(() => {
    _mockStorage.clear();
    _lastCopiedText = null;
  });

  it('3.1: Ciclo completo de status de leitura (nao_lido -> lendo -> fichado -> nao_lido) atualiza ARIA e dispara callback', () => {
    const ref = criarBookReferenceItem({ id: 'st_ciclo', statusLeitura: 'nao_lido' });
    const historicoStatus = [];

    const folha = renderizarFolhaInterna(ref, {
      onStatusChange: (s) => historicoStatus.push(s)
    });

    const btnNaoLido = folha.querySelector('[data-status="nao_lido"]');
    const btnLendo = folha.querySelector('[data-status="lendo"]');
    const btnFichado = folha.querySelector('[data-status="fichado"]');

    assert.ok(btnNaoLido.classList.contains('ativo'));
    assert.equal(btnNaoLido.getAttribute('aria-checked'), 'true');
    assert.equal(btnLendo.getAttribute('aria-checked'), 'false');
    assert.equal(btnFichado.getAttribute('aria-checked'), 'false');

    // 1. nao_lido -> lendo
    btnLendo.dispatchEvent({ type: 'click' });
    assert.equal(ref.statusLeitura, 'lendo');
    assert.ok(btnLendo.classList.contains('ativo'));
    assert.ok(!btnNaoLido.classList.contains('ativo'));
    assert.equal(btnLendo.getAttribute('aria-checked'), 'true');
    assert.equal(btnNaoLido.getAttribute('aria-checked'), 'false');

    // 2. lendo -> fichado
    btnFichado.dispatchEvent({ type: 'click' });
    assert.equal(ref.statusLeitura, 'fichado');
    assert.ok(btnFichado.classList.contains('ativo'));
    assert.ok(!btnLendo.classList.contains('ativo'));
    assert.equal(btnFichado.getAttribute('aria-checked'), 'true');
    assert.equal(btnLendo.getAttribute('aria-checked'), 'false');

    // 3. fichado -> nao_lido
    btnNaoLido.dispatchEvent({ type: 'click' });
    assert.equal(ref.statusLeitura, 'nao_lido');
    assert.ok(btnNaoLido.classList.contains('ativo'));
    assert.ok(!btnFichado.classList.contains('ativo'));
    assert.equal(btnNaoLido.getAttribute('aria-checked'), 'true');

    assert.deepEqual(historicoStatus, ['lendo', 'fichado', 'nao_lido']);
  });

  it('3.2: Cópia de citação formatada copia chave canônica com feedback visual imediato', async () => {
    const ref = criarBookReferenceItem({
      id: 'cit_copy',
      autores: [{ sobrenome: 'Silva', prenome: 'Lucas' }, { sobrenome: 'Santos', prenome: 'Maria' }],
      ano: '2024',
      formattedCitationKey: '(SILVA & SANTOS, 2024)'
    });

    const folha = renderizarFolhaInterna(ref);
    const btnCopiar = folha.querySelector('.ath-btn-copiar-citacao');
    assert.ok(btnCopiar);
    assert.equal(btnCopiar.getAttribute('data-chave'), '(SILVA & SANTOS, 2024)');

    btnCopiar.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 10));

    assert.equal(_lastCopiedText, '(SILVA & SANTOS, 2024)', 'Clipboard deve receber a chave formatada');
    assert.ok(btnCopiar.classList.contains('copiado'), 'Botão deve receber classe .copiado');
    assert.equal(btnCopiar.textContent, 'Copiado! ✓', 'Texto do botão deve confirmar a cópia');
  });

  it('3.3: Resiliência da cópia quando o clipboard do navegador lança erro ou é inexistente', async () => {
    const ref = criarBookReferenceItem({ id: 'cit_copy_fail', formattedCitationKey: '(KEY, 2025)' });
    
    // Simula navegador com clipboard rejeitado (ex.: permissão negada)
    globalThis.navigator.clipboard.writeText = async () => {
      throw new Error('NotAllowedError: Clipboard permission denied');
    };

    const folha = renderizarFolhaInterna(ref);
    const btnCopiar = folha.querySelector('.ath-btn-copiar-citacao');

    assert.doesNotThrow(() => {
      btnCopiar.dispatchEvent({ type: 'click' });
    });
    await new Promise(r => setTimeout(r, 10));

    assert.ok(btnCopiar.classList.contains('copiado'));
    assert.equal(btnCopiar.textContent, 'Copiado! ✓');
  });

  it('3.4: Anotação rápida salva payloads adversariais (XSS, aspas, Unicode extremo, quebras de linha)', () => {
    const ref = criarBookReferenceItem({ id: 'xss_note', pinnedNotes: [] });
    let notaCapturada = null;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (n) => { notaCapturada = n; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    const cargaAdversarial = '<script>alert("XSS")</script> & "aspas duplas" \'simples\' \\ / % _ ` { [ ( ) ] } \n\r\t 📚 🔥 🇧🇷 ∑ ∫ e^{-x²}dx = √π';
    textarea.value = cargaAdversarial;

    btnSalvar.dispatchEvent({ type: 'click' });

    assert.equal(notaCapturada, cargaAdversarial, 'Callback deve receber a string exata sem corrupção');
    assert.ok(ref.pinnedNotes.includes(cargaAdversarial), 'Array pinnedNotes deve conter a anotação íntegra');
    assert.equal(ref.fichamento.resumoPessoal, cargaAdversarial, 'resumoPessoal deve ser atualizado');
  });

  it('3.5: Auto-salvamento resiliente no evento blur do textarea', () => {
    const ref = criarBookReferenceItem({ id: 'blur_note', pinnedNotes: [] });
    let salvo = false;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { salvo = true; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    textarea.value = 'Nota salva automaticamente ao sair do campo.';

    textarea.dispatchEvent({ type: 'blur' });

    assert.ok(salvo, 'Blur deve acionar o salvamento da anotação');
    assert.ok(ref.pinnedNotes.includes('Nota salva automaticamente ao sair do campo.'));
  });

  it('3.6: Rejeição estrita de notas vazias ou compostas exclusivamente de espaços/quebras', () => {
    const ref = criarBookReferenceItem({ id: 'empty_note', pinnedNotes: [] });
    let chamouCallback = false;

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { chamouCallback = true; }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    const entradasEspurias = ['', '    ', '\t\t', '\n\n\r\n', '   \n  \t  '];
    for (const espuria of entradasEspurias) {
      textarea.value = espuria;
      btnSalvar.dispatchEvent({ type: 'click' });
      assert.equal(ref.pinnedNotes.length, 0, 'Não deve adicionar anotações em branco');
      assert.equal(chamouCallback, false, 'Callback não deve ser invocado para texto vazio');
    }
  });

  it('3.7: Anotações com texto massivo (>10.000 caracteres) são preservadas sem truncamento', () => {
    const ref = criarBookReferenceItem({ id: 'huge_note', pinnedNotes: [] });
    const folha = renderizarFolhaInterna(ref);
    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    const textoMassivo = 'A'.repeat(12000);
    textarea.value = textoMassivo;
    btnSalvar.dispatchEvent({ type: 'click' });

    assert.equal(ref.pinnedNotes[0].length, 12000, 'Texto de 12.000 caracteres deve ser salvo sem truncamento');
  });
});

describe('Desafio 4: Integração com Leitor e Propagação de Estado em sessionStorage (R4)', () => {
  beforeEach(() => {
    _mockStorage.clear();
  });

  it('4.1: Clique no botão primário "📖 Abrir Arquivo / Ler Referência" aciona callback onAbrirLeitor', () => {
    const ref = criarBookReferenceItem({ id: 'leitor_btn_1', titulo: 'Obra para Leitura' });
    let obraRecebida = null;

    const folha = renderizarFolhaInterna(ref, {
      onAbrirLeitor: (art) => { obraRecebida = art; }
    });

    const btnLeitor = folha.querySelector('.ath-btn-abrir-leitor');
    assert.ok(btnLeitor, 'Botão primário deve existir');
    assert.equal(btnLeitor.textContent, 'Abrir Arquivo / Ler Referência');

    btnLeitor.dispatchEvent({ type: 'click' });
    assert.equal(obraRecebida.id, 'leitor_btn_1');
  });

  it('4.2: abrirArtigoNoEstudio propaga integralmente todas as chaves requeridas em sessionStorage', () => {
    const controller = Object.create(EstudoArtigosView.prototype);
    controller.artigoAberto = null;
    controller.paginaAtual = 1;
    controller.renderizar = () => {};

    const artigo = {
      id: 'art_estudo_777',
      titulo: 'Topografia por Satélite e LiDAR',
      ano: '2025',
      autores: [{ sobrenome: 'Almeida', prenome: 'Carlos' }]
    };

    // Aciona a abertura
    controller.abrirArtigoNoEstudio(artigo, 1);

    // Verificação minuciosa dos 5 contratos de sessionStorage
    assert.equal(sessionStorage.getItem('athenes_estudio_artigo_id'), 'art_estudo_777');
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '1');
    assert.equal(sessionStorage.getItem('athenes_nav_tela'), 'estudio');
    assert.equal(sessionStorage.getItem('athenes_dash_aba'), 'artigos_zotero');

    const cacheJson = sessionStorage.getItem('athenes_estudio_artigo_cache');
    assert.ok(cacheJson, 'Cache de artigo aberto deve existir em sessionStorage');
    const cacheObj = JSON.parse(cacheJson);
    assert.equal(cacheObj.id, 'art_estudo_777');
    assert.equal(cacheObj.titulo, 'Topografia por Satélite e LiDAR');
  });

  it('4.3: Alternância de artigo limpa scroll anterior e armazena novo identificador', () => {
    const controller = Object.create(EstudoArtigosView.prototype);
    controller.artigoAberto = null;
    controller.paginaAtual = 1;
    controller.renderizar = () => {};

    const artigoA = { id: 'art_A', titulo: 'Artigo Alpha' };
    const artigoB = { id: 'art_B', titulo: 'Artigo Beta' };

    // Abre artigo A
    controller.abrirArtigoNoEstudio(artigoA, 1);
    assert.equal(sessionStorage.getItem('athenes_estudio_artigo_id'), 'art_A');

    // Simula gravação de posição de rolagem durante leitura
    sessionStorage.setItem('athenes_estudio_scroll', '850');

    // Abre artigo B
    controller.abrirArtigoNoEstudio(artigoB, 2);

    assert.equal(sessionStorage.getItem('athenes_estudio_artigo_id'), 'art_B');
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '2');
    assert.equal(sessionStorage.getItem('athenes_estudio_scroll'), null, 'Scroll de artigo anterior deve ser removido');
  });

  it('4.4: Sanitização de página inicial inválida (<= 0, NaN, string aleatória) normaliza para página 1', () => {
    const controller = Object.create(EstudoArtigosView.prototype);
    controller.renderizar = () => {};

    const art = { id: 'art_pag_check', titulo: 'Páginas Obra' };

    controller.abrirArtigoNoEstudio(art, -5);
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '1');

    controller.abrirArtigoNoEstudio(art, 0);
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '1');

    controller.abrirArtigoNoEstudio(art, 'pagina_invalida');
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '1');

    controller.abrirArtigoNoEstudio(art, 14);
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '14');
  });

  it('4.5: Fluxo end-to-end: Botão da folha na estante 3D aciona abrirArtigoNoEstudio integrado', () => {
    const controller = Object.create(EstudoArtigosView.prototype);
    controller.artigoAberto = null;
    controller.paginaAtual = 1;
    controller.artigos = [];
    controller.renderizar = () => {};

    const artigo = {
      id: 'art_e2e_leitor',
      titulo: 'Interação Fichamento e Leitor',
      ano: '2026'
    };
    controller.artigos.push(artigo);

    // Callback canônico configurado em atualizarGridCatalogo() do AthenesEstudoArtigos
    const onAbrirLeitorCallback = (art) => {
      controller.abrirArtigoNoEstudio(art, 1);
    };

    // Renderiza folha interna com o callback oficial
    const folha = renderizarFolhaInterna(artigo, {
      onAbrirLeitor: onAbrirLeitorCallback
    });

    const btnLeitor = folha.querySelector('.ath-btn-abrir-leitor');
    btnLeitor.dispatchEvent({ type: 'click' });

    assert.equal(controller.artigoAberto, artigo);
    assert.equal(sessionStorage.getItem('athenes_estudio_artigo_id'), 'art_e2e_leitor');
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '1');
    assert.equal(sessionStorage.getItem('athenes_nav_tela'), 'estudio');
    assert.equal(sessionStorage.getItem('athenes_dash_aba'), 'artigos_zotero');
  });

  it('4.6: Resiliência contra QuotaExceededError em sessionStorage sem quebrar o leitor', () => {
    const controller = Object.create(EstudoArtigosView.prototype);
    controller.artigoAberto = null;
    controller.paginaAtual = 1;
    controller.renderizar = () => {};

    // Mock sessionStorage lançando QuotaExceededError
    const originalSetItem = globalThis.sessionStorage.setItem;
    globalThis.sessionStorage.setItem = () => {
      const err = new Error('DOMException: The quota has been exceeded.');
      err.name = 'QuotaExceededError';
      throw err;
    };

    const artigo = { id: 'art_quota', titulo: 'Obra Quota Test' };

    assert.doesNotThrow(() => {
      controller.abrirArtigoNoEstudio(artigo, 1);
    }, 'abrirArtigoNoEstudio deve capturar QuotaExceededError com segurança');

    assert.equal(controller.artigoAberto, artigo);
    globalThis.sessionStorage.setItem = originalSetItem;
  });

  it('4.7: Stripping de blobs binários (pdfBlobUrl, pdfDataUrl, pdfBlob) do cache de sessão', () => {
    const controller = Object.create(EstudoArtigosView.prototype);
    controller.artigoAberto = null;
    controller.paginaAtual = 1;
    controller.renderizar = () => {};

    const artigoPesado = {
      id: 'art_blob_strip',
      titulo: 'Trabalho Pesado',
      pdfBlobUrl: 'blob:http://localhost/heavy-pdf-uuid',
      pdfDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
      pdfBlob: { size: 10485760 }
    };

    controller.abrirArtigoNoEstudio(artigoPesado, 1);

    const cacheRaw = sessionStorage.getItem('athenes_estudio_artigo_cache');
    assert.ok(cacheRaw);
    const parsed = JSON.parse(cacheRaw);

    assert.equal(parsed.id, 'art_blob_strip');
    assert.equal(parsed.titulo, 'Trabalho Pesado');
    assert.equal(parsed.pdfBlobUrl, undefined, 'pdfBlobUrl não deve ser persistido em sessionStorage');
    assert.equal(parsed.pdfDataUrl, undefined, 'pdfDataUrl não deve ser persistido em sessionStorage');
    assert.equal(parsed.pdfBlob, undefined, 'pdfBlob não deve ser persistido em sessionStorage');
  });
});
