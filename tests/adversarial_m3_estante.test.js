// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file tests/adversarial_m3_estante.test.js
 * Athenes — Suíte de Verificação Adversarial Empírica do Milestone 3.
 * Estante 3D, Livros Esquemáticos em CSS 3D e Folha de Fichamento (Requisito R3 / R4).
 *
 * Casos de estresse adversarial e bordas obrigatórios:
 * 1. Agrupamento e quebra de prateleiras com volumes extremos (0 livros, 1 livro, 7 livros, 50 livros, 300 livros).
 * 2. Títulos de livros extremos (título com 1000 caracteres, título vazio, caracteres especiais, tags HTML neutralizadas).
 * 3. Variações anatômicas de livros (livros sem autor, sem ano, sem tipo, sem PDF, capa personalizada com cores hex arbitrárias).
 * 4. Verificação de perspectiva e classes canônicas (`perspective: 1000px`, `preserve-3d`, `rotateY(0deg) translateZ(0)`).
 * 5. Estado de estante vazia (`.ath-estante-vazia-card`) com mensagem textual e acessibilidade.
 * 6. Cinemática de abertura 3D, exclusividade estrita, acessibilidade por teclado (Escape) e Scrim.
 * 7. Folha interna de fichamento, Citation Tracker, contadores de citação e callbacks de interação.
 * 8. Auditoria estática do arquivo CSS `src/css/athenes_estante_3d.css`.
 *
 * Execução com: `node --test tests/adversarial_m3_estante.test.js`
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  renderizarEstante3D,
  renderizarLivro3D,
  abrirLivro3D,
  fecharLivro3D,
  fecharTodosLivros3D,
  tratarTecladoLivro3D,
  renderizarFolhaInterna,
  moverLivroParaPasta
} from '../src/ui/athenes_estudo_artigos_estante.js';

import {
  obterCorTextoAcessivel,
  calcularRazaoContraste
} from '../src/core/athenes_referencias.js';

// ─────────────────────────────────────────────────────────────────────────────
// Infraestrutura de Mock DOM de Alta Fidelidade para Testes Headless Node.js
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
    this._value = undefined;
    this._innerHTML = '';
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
    this._innerHTML = this._textContent;
  }

  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(v) {
    this._innerHTML = String(v ?? '');
    this._textContent = this._innerHTML.replace(/<[^>]*>/g, '');
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
    for (const fn of arr) fn.call(this, ev);
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
      if (sel.startsWith('.') && cur.classList && (cur.classList.contains(sel.slice(1)) || cur.classList.has?.(sel.slice(1)))) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }
}

// Configuração do Mock DOM global determinístico
const mockScrim = new MockDOMElement('div', 'ath-estante-scrim');
mockScrim.setAttribute('id', 'athEstanteScrim');

globalThis.document = {
  createElement: (tag) => new MockDOMElement(tag),
  getElementById: (id) => (id === 'athEstanteScrim' ? mockScrim : null),
  activeElement: null
};

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 1: Agrupamento e Quebra de Prateleiras com Volumes Extremos (R3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 1: Agrupamento e Quebra de Prateleiras com Volumes Extremos', () => {
  beforeEach(() => {
    mockScrim.classList.remove('ativo');
  });

  it('1.1. Volume zero (0 livros): Renderiza estante vazia com 1 prateleira, card explicativo e base chanfrada', () => {
    const estante = renderizarEstante3D([]);
    assert.ok(estante, 'Estante deve ser criada');
    assert.ok(estante.classList.contains('ath-estante-3d'), 'Container deve possuir classe .ath-estante-3d');
    assert.equal(estante.style.perspective, undefined, 'Estante fechada não deve criar uma camada 3D global');

    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prateleiras.length, 1, 'Deve existir exatamente 1 prateleira de estado vazio');

    const vazioCard = estante.querySelector('.ath-estante-vazia-card');
    assert.ok(vazioCard, 'Deve conter o card de estante vazia');
    assert.equal(vazioCard.textContent, 'Nenhuma obra cadastrada nesta estante.');

    // Base chanfrada deve estar presente para compor a estética da estante mesmo vazia
    assert.ok(estante.querySelector('.ath-prateleira-base'), 'Base chanfrada deve estar presente');
    assert.ok(estante.querySelector('.ath-prateleira-superficie'), 'Superfície chanfrada deve estar presente');
    assert.ok(estante.querySelector('.ath-prateleira-chanfro'), 'Chanfro deve estar presente');
    assert.ok(estante.querySelector('.ath-prateleira-sombra'), 'Sombra da prateleira deve estar presente');

    // Não deve haver nenhum elemento de livro
    const livros = estante.querySelectorAll('.ath-livro-3d');
    assert.equal(livros.length, 0, 'Não deve conter nenhum livro na estante vazia');
  });

  it('1.2. Volume unitário (1 livro): Renderiza exatamente 1 prateleira com 1 livro alinhado', () => {
    const umLivro = [{ id: 'ref-single', titulo: 'Monografia Individual', ano: '2026', tipo: 'livro' }];
    const estante = renderizarEstante3D(umLivro);

    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prateleiras.length, 1, 'Deve conter exatamente 1 prateleira');

    const livros = estante.querySelectorAll('.ath-livro-3d');
    assert.equal(livros.length, 1, 'Deve conter exatamente 1 livro');
    assert.equal(livros[0].getAttribute('data-livro-id'), 'ref-single');
    assert.ok(!estante.querySelector('.ath-estante-vazia-card'), 'Não deve conter card de estado vazio');
  });

  it('1.3. Volume 7 livros com limite padrão (6 por prateleira): Quebra em 2 prateleiras (6 e 1)', () => {
    const seteLivros = Array.from({ length: 7 }, (_, i) => ({
      id: `ref-7-${i + 1}`,
      titulo: `Obra ${i + 1}`,
      ano: '2024'
    }));

    const estante = renderizarEstante3D(seteLivros, { maxPorPrateleira: 6 });
    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prateleiras.length, 2, '7 livros com limite 6 devem gerar exatamente 2 prateleiras');

    const prateleira1Livros = prateleiras[0].querySelectorAll('.ath-livro-3d');
    const prateleira2Livros = prateleiras[1].querySelectorAll('.ath-livro-3d');
    assert.equal(prateleira1Livros.length, 6, 'Prateleira 1 deve conter exatamente 6 livros');
    assert.equal(prateleira2Livros.length, 1, 'Prateleira 2 deve conter o livro restante (1)');

    // Ordem estrita conservada
    assert.equal(prateleira1Livros[0].getAttribute('data-livro-id'), 'ref-7-1');
    assert.equal(prateleira2Livros[0].getAttribute('data-livro-id'), 'ref-7-7');
  });

  it('1.4. Volume 7 livros com limite customizado e entradas anômalas de limite', () => {
    const seteLivros = Array.from({ length: 7 }, (_, i) => ({ id: `ref-${i}`, titulo: `Obra ${i}` }));

    // Limite = 7: cabe em 1 prateleira
    const estante1 = renderizarEstante3D(seteLivros, { maxPorPrateleira: 7 });
    assert.equal(estante1.querySelectorAll('.ath-estante-prateleira').length, 1);

    // Limite = 4: gera 2 prateleiras (4 e 3)
    const estante2 = renderizarEstante3D(seteLivros, { maxPorPrateleira: 4 });
    const pE2 = estante2.querySelectorAll('.ath-estante-prateleira');
    assert.equal(pE2.length, 2);
    assert.equal(pE2[0].querySelectorAll('.ath-livro-3d').length, 4);
    assert.equal(pE2[1].querySelectorAll('.ath-livro-3d').length, 3);

    // Limite inválido (0, negativo, null): fallback seguro para 6
    const estanteFallback = renderizarEstante3D(seteLivros, { maxPorPrateleira: 0 });
    assert.equal(estanteFallback.querySelectorAll('.ath-estante-prateleira').length, 2);
  });

  it('1.5. Volume moderado (50 livros): Quebra em 9 prateleiras com conservação estrita de nós', () => {
    const cinquentaLivros = Array.from({ length: 50 }, (_, i) => ({
      id: `ref-50-${i}`,
      titulo: `Publicação Acadêmica N° ${i + 1}`,
      ano: `${2000 + (i % 25)}`,
      totalCitationsCount: i * 3
    }));

    const estante = renderizarEstante3D(cinquentaLivros, { maxPorPrateleira: 6 });
    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    // Math.ceil(50 / 6) = 9 prateleiras (8 cheias de 6, última com 2)
    assert.equal(prateleiras.length, 9, '50 livros com max 6 devem gerar 9 prateleiras');

    let totalLivrosContados = 0;
    for (let i = 0; i < prateleiras.length; i++) {
      const pLivros = prateleiras[i].querySelectorAll('.ath-livro-3d');
      if (i < 8) {
        assert.equal(pLivros.length, 6, `Prateleira ${i} deve ter 6 livros`);
      } else {
        assert.equal(pLivros.length, 2, 'Prateleira final 8 deve ter 2 livros');
      }
      totalLivrosContados += pLivros.length;
    }
    assert.equal(totalLivrosContados, 50, 'Total de livros deve ser exatamente 50 (conservação estrita)');
  });

  it('1.6. Volume extremo (300 livros): Performance O(N) linear (< 100ms) e conservação de 50 prateleiras', () => {
    const trezentosLivros = Array.from({ length: 300 }, (_, i) => ({
      id: `ref-300-${i}`,
      titulo: `Trabalho de Pesquisa Extrema ${i}`,
      ano: '2025',
      autores: [{ sobrenome: `Autor${i}`, prenome: 'Pesquisador' }],
      tipo: i % 2 === 0 ? 'artigo' : 'tese'
    }));

    const tInicio = performance.now();
    const estante = renderizarEstante3D(trezentosLivros, { maxPorPrateleira: 6 });
    const duracaoMs = performance.now() - tInicio;

    assert.ok(duracaoMs < 100, `Renderização de 300 livros deve ser ultra-rápida (< 100ms). Levou: ${duracaoMs.toFixed(2)}ms`);

    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prateleiras.length, 50, '300 livros com 6 por prateleira geram exatamente 50 prateleiras');

    const todosLivros = estante.querySelectorAll('.ath-livro-3d');
    assert.equal(todosLivros.length, 300, 'Exatamente 300 livros gerados sem duplicações');

    // Integridade do primeiro e último livro
    assert.equal(todosLivros[0].getAttribute('data-livro-id'), 'ref-300-0');
    assert.equal(todosLivros[299].getAttribute('data-livro-id'), 'ref-300-299');
  });

  it('1.7. Entradas anômalas e corrompidas de lista: null, undefined, tipos primitivos não quebram', () => {
    assert.doesNotThrow(() => renderizarEstante3D(null), 'null não deve lançar erro');
    assert.doesNotThrow(() => renderizarEstante3D(undefined), 'undefined não deve lançar erro');
    assert.doesNotThrow(() => renderizarEstante3D('string-invalida'), 'string não deve lançar erro');
    assert.doesNotThrow(() => renderizarEstante3D(12345), 'número não deve lançar erro');

    const estanteNull = renderizarEstante3D(null);
    assert.ok(estanteNull.querySelector('.ath-estante-vazia-card'), 'Entrada nula deve renderizar estante vazia');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 2: Títulos Extremos, Caracteres Especiais e Sanitização XSS (R3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 2: Títulos Extremos, Caracteres Especiais e Sanitização XSS', () => {
  it('2.1. Título gigante (1000 caracteres): Truncamento no card e integridade no tooltip (title)', () => {
    const titulo1000 = 'A'.repeat(1000);
    const ref = {
      id: 'ref-long-title',
      titulo: titulo1000,
      ano: '2026',
      autores: [{ sobrenome: 'Santos' }]
    };

    const livroEl = renderizarLivro3D(ref);
    const tituloEl = livroEl.querySelector('.ath-livro-titulo');
    assert.ok(tituloEl, 'Elemento de título deve existir');
    assert.equal(tituloEl.textContent, titulo1000, 'textContent deve conter os 1000 caracteres');
    assert.equal(tituloEl.getAttribute('title'), titulo1000, 'Atributo title deve conter os 1000 caracteres para tooltip');

    // Lombada exibe autor por padrão
    const lombadaTexto = livroEl.querySelector('.ath-livro-lombada-texto');
    assert.equal(lombadaTexto.textContent, 'Santos · 2026');
  });

  it('2.2. Título gigante em livro sem autor: Lombada recebe título longo sem quebrar', () => {
    const titulo800 = 'X'.repeat(800);
    const ref = {
      id: 'ref-no-author-long',
      titulo: titulo800,
      ano: '2025',
      autores: []
    };

    const livroEl = renderizarLivro3D(ref);
    const lombadaTexto = livroEl.querySelector('.ath-livro-lombada-texto');
    assert.equal(lombadaTexto.textContent, titulo800);
  });

  it('2.3. Título vazio, nulo ou undefined: Fallback gracioso para "Sem Título"', () => {
    const casosVazios = ['', null, undefined];

    for (const valor of casosVazios) {
      const ref = { id: 'ref-empty', titulo: valor, ano: '2024' };
      const livroEl = renderizarLivro3D(ref);

      const tituloEl = livroEl.querySelector('.ath-livro-titulo');
      assert.equal(tituloEl.textContent, 'Sem Título', `Título '${valor}' deve virar 'Sem Título'`);
      assert.equal(livroEl.getAttribute('aria-label'), 'Livro: Sem Título');

      // Folha interna também normaliza para Sem Título
      const folha = renderizarFolhaInterna(ref);
      const folhaTitulo = folha.querySelector('.ath-folha-titulo');
      assert.equal(folhaTitulo.textContent, 'Sem Título');
    }

    // Título com apenas espaços em branco: folha interna normaliza com trim()
    const refEspacos = { id: 'ref-spaces', titulo: '   ', ano: '2024' };
    const folhaEspacos = renderizarFolhaInterna(refEspacos);
    assert.equal(folhaEspacos.querySelector('.ath-folha-titulo').textContent, 'Sem Título');
  });

  it('2.4. Neutralização de vetores XSS e injeção de HTML no título e autores', () => {
    const xssPayload = '<script>alert("XSS")</script><img src="x" onerror="window.pwned=1">';
    const ref = {
      id: 'ref-xss',
      titulo: xssPayload,
      ano: '2026',
      autores: [{ sobrenome: '<b onmouseover="alert(1)">Hacker</b>' }]
    };

    const livroEl = renderizarLivro3D(ref);
    const tituloEl = livroEl.querySelector('.ath-livro-titulo');
    assert.equal(tituloEl.textContent, xssPayload, 'Payload deve permanecer como texto plano');

    // Não deve criar tags script ou img dentro de h3
    const scriptsCriados = tituloEl.querySelectorAll('script');
    const imgsCriadas = tituloEl.querySelectorAll('img');
    assert.equal(scriptsCriados.length, 0, 'Tags <script> não podem ser criadas como nós DOM');
    assert.equal(imgsCriadas.length, 0, 'Tags <img> não podem ser criadas como nós DOM');

    // Autores no card
    const autoresEl = livroEl.querySelector('.ath-livro-autores');
    assert.equal(autoresEl.textContent, '<b onmouseover="alert(1)">Hacker</b>');
    assert.equal(autoresEl.querySelectorAll('b').length, 0, 'Tags <b> em autor não são nós filhos');
  });

  it('2.5. Caracteres Unicode complexos, emojis, símbolos matemáticos e tipografia avançada', () => {
    const tituloComplexo = '📚 "Étude sur l\'espace de Hilbert: ∫ f(x) dx ⇋ ∑ λᵢ |ψᵢ⟩ ⟨ψᵢ| — Teoria & Aplicações"';
    const ref = {
      id: 'ref-unicode',
      titulo: tituloComplexo,
      ano: '2026',
      autores: [{ sobrenome: 'Schrödinger' }, { sobrenome: 'Gödel' }]
    };

    const livroEl = renderizarLivro3D(ref);
    const tituloEl = livroEl.querySelector('.ath-livro-titulo');
    assert.equal(tituloEl.textContent, tituloComplexo, 'Unicode e símbolos matemáticos devem ser preservados');

    const autoresEl = livroEl.querySelector('.ath-livro-autores');
    assert.equal(autoresEl.textContent, 'Schrödinger, Gödel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 3: Variações Anatômicas e Cores Hex Arbitrárias (R3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 3: Variações Anatômicas e Cores Hex Arbitrárias', () => {
  it('3.1. Livro sem autor: Capa exibe "Autor não informado" e lombada exibe título da obra', () => {
    const ref = {
      id: 'ref-anonimo',
      titulo: 'Tratado Anônimo de Filosofia',
      ano: '1985',
      autores: []
    };

    const livroEl = renderizarLivro3D(ref);
    const autoresEl = livroEl.querySelector('.ath-livro-autores');
    assert.equal(autoresEl.textContent, 'Autor não informado');

    const lombadaTexto = livroEl.querySelector('.ath-livro-lombada-texto');
    assert.equal(lombadaTexto.textContent, 'Tratado Anônimo de Filosofia');
  });

  it('3.2. Livro com autores heterogêneos (strings puras, sem sobrenome, campos vazios)', () => {
    const ref = {
      id: 'ref-heterog',
      titulo: 'Manual de Redação',
      ano: '2023',
      autores: [
        'Organização Mundial da Saúde',
        { prenome: 'Aristóteles' },
        { sobrenome: 'Platão', prenome: '' }
      ]
    };

    const livroEl = renderizarLivro3D(ref);
    const autoresEl = livroEl.querySelector('.ath-livro-autores');
    assert.equal(autoresEl.textContent, 'Organização Mundial da Saúde, Aristóteles, Platão');
  });

  it('3.3. Livro sem ano e sem tipo: Normaliza para "s.d." e "artigo"', () => {
    const ref = {
      id: 'ref-sem-ano',
      titulo: 'Documento Não Datado',
      ano: null,
      tipo: null
    };

    const livroEl = renderizarLivro3D(ref);
    const badge = livroEl.querySelector('.ath-livro-badge-tipo');
    assert.equal(badge.textContent, 's.d. · artigo');

    // Folha interna
    const folha = renderizarFolhaInterna(ref);
    const folhaBadge = folha.querySelector('.ath-folha-tipo-badge');
    assert.equal(folhaBadge.textContent, 'ARTIGO');
    const folhaMeta = folha.querySelector('.ath-folha-meta');
    assert.ok(folhaMeta.textContent.includes('(s.d.)'));
  });

  it('3.4. Indicador de PDF/anexo: Aparece com pdfUrl e não aparece quando ausente', () => {
    const comPdf = { id: 'com-pdf', titulo: 'Com PDF', pdfUrl: 'https://exemplo.org/doc.pdf' };
    const semPdf = { id: 'sem-pdf', titulo: 'Sem PDF' };

    const elComPdf = renderizarLivro3D(comPdf);
    const pillComPdf = elComPdf.querySelector('.ath-livro-pdf-pill');
    assert.ok(pillComPdf, 'Deve conter a pill de PDF');
    assert.equal(pillComPdf.textContent, 'PDF');

    const elSemPdf = renderizarLivro3D(semPdf);
    const pillSemPdf = elSemPdf.querySelector('.ath-livro-pdf-pill');
    assert.equal(pillSemPdf, null, 'Não deve conter pill de PDF');
  });

  it('3.5. Capa personalizada com cores hex arbitrárias e contraste acessível WCAG', () => {
    const coresTeste = [
      { hex: '#314F79', nome: 'Azul Athenes' },
      { hex: '#FF6B2C', nome: 'Laranja Glaux' },
      { hex: '#10B981', nome: 'Esmeralda' },
      { hex: '#FFFFFF', nome: 'Branco Puro' },
      { hex: '#000000', nome: 'Preto Puro' },
      { hex: '#FACC15', nome: 'Amarelo Ouro' }
    ];

    for (const { hex, nome } of coresTeste) {
      const ref = { id: `cor-${hex}`, titulo: `Obra ${nome}`, corCapa: hex };
      const livroEl = renderizarLivro3D(ref);

      const lombada = livroEl.querySelector('.ath-livro-lombada');
      assert.equal(lombada.style.backgroundColor, hex, `Lombada deve ter cor ${hex}`);

      const capaTras = livroEl.querySelector('.ath-livro-capa-tras');
      assert.equal(capaTras.style.backgroundColor, hex, `Capa traseira deve ter cor ${hex}`);

      const capaFrente = livroEl.querySelector('.ath-livro-capa');
      assert.equal(capaFrente.style.backgroundColor, hex, `Capa frontal deve ter cor ${hex}`);

      // Contraste de texto acessível (#FFFFFF ou #1F2733 de acordo com obterCorTextoAcessivel)
      const corTexto = capaFrente.style.color;
      assert.ok(corTexto === '#FFFFFF' || corTexto === '#1F2733', `Cor do texto deve ser acessível: ${corTexto}`);

      const razao = calcularRazaoContraste(corTexto, hex);
      assert.ok(razao >= 3.0, `Razão de contraste para ${hex} deve atender padrão aceitável (≥ 3.0:1). Razão: ${razao}`);
    }
  });

  it('3.6. Cor de capa ausente: Fallback seguro para o azul padrão #314F79', () => {
    const ref = { id: 'ref-sem-cor', titulo: 'Sem Cor Definida' };
    const livroEl = renderizarLivro3D(ref);

    const capaFrente = livroEl.querySelector('.ath-livro-capa');
    assert.equal(capaFrente.style.backgroundColor, '#314F79', 'Fallback deve ser #314F79');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 4: Perspectiva 3D, Classes Canônicas e Auditoria CSS (R3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 4: Perspectiva 3D, Classes Canônicas e Auditoria CSS', () => {
  it('4.1. Verificação de perspectiva e classes no DOM gerado', () => {
    const ref = { id: 'ref-dom-3d', titulo: 'Geometria Espacial' };
    const estante = renderizarEstante3D([ref]);

    // Container
    assert.equal(estante.style.perspective, undefined, 'Perspectiva fica restrita ao livro');

    // Livro 3D
    const livroEl = estante.querySelector('.ath-livro-3d');
    assert.ok(livroEl, 'Elemento de livro deve existir');
    assert.equal(livroEl.style.transformStyle, undefined, 'Livro fechado deve permanecer plano');

    // Anatomia de faces 3D
    assert.ok(livroEl.querySelector('.ath-livro-lombada'), 'Deve conter lombada');
    assert.ok(livroEl.querySelector('.ath-livro-paginas-dir'), 'Deve conter páginas laterais');
    assert.ok(livroEl.querySelector('.ath-livro-paginas-baixo'), 'Deve conter páginas inferiores');
    assert.ok(livroEl.querySelector('.ath-livro-capa-tras'), 'Deve conter capa traseira');
    assert.ok(livroEl.querySelector('.ath-livro-sombra-base'), 'Deve conter sombra basal');
    assert.ok(livroEl.querySelector('.ath-livro-capa-frente'), 'Deve conter capa frontal');
  });

  it('4.2. Cinemática de inclinação: fechado reverte para rotateY(0deg) translateZ(0)', () => {
    const ref = { id: 'ref-cinem', titulo: 'Dinâmica 3D' };
    const livroEl = renderizarLivro3D(ref);

    // Abre
    abrirLivro3D(livroEl, ref);
    assert.ok(livroEl.classList.contains('aberto'), 'Livro aberto tem classe aberto');
    assert.equal(livroEl.style.transform, 'translateZ(60px)', 'Livro aberto tem translateZ(60px)');

    // Fecha
    fecharLivro3D(livroEl);
    assert.ok(!livroEl.classList.contains('aberto'), 'Livro fechado remove classe aberto');
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)', 'Livro fechado reverte para inclinação canônica');
  });

  it('4.3. Auditoria Estática Rigorosa do arquivo CSS src/css/athenes_estante_3d.css', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const cssPath = join(__dirname, '..', 'src', 'css', 'athenes_estante_3d.css');
    const cssContent = readFileSync(cssPath, 'utf8');

    // 1. Perspectiva da estante
    assert.ok(cssContent.includes('perspective: 1000px'), 'CSS deve declarar perspective: 1000px');

    // 2. Livros fechados planos; profundidade apenas ao abrir
    assert.ok(cssContent.includes('transform-style: flat'), 'CSS deve manter a estante fechada plana');
    assert.ok(cssContent.includes('transform-style: preserve-3d'), 'CSS deve declarar transform-style: preserve-3d');

    // 3. Rotação canônica de repouso dos livros
    assert.ok(cssContent.includes('rotateY(0deg) translateZ(0)'), 'CSS deve declarar rotateY(0deg) translateZ(0)');

    // 4. Rotação canônica de abertura da capa (-140deg)
    assert.ok(cssContent.includes('rotateY(-160deg)'), 'CSS deve declarar rotateY(-160deg)');

    // 5. Elevação em Z para o livro aberto
    assert.ok(cssContent.includes('translateZ(60px)'), 'CSS deve declarar translateZ(60px)');

    // 6. Lombada com escrita vertical e rotação 90deg
    assert.ok(cssContent.includes('writing-mode: vertical-rl'), 'CSS deve declarar writing-mode: vertical-rl');
    assert.ok(cssContent.includes('rotateY(-90deg)'), 'CSS deve declarar rotateY(-90deg) na lombada');

    // 7. Base chanfrada da prateleira e sombra inferior
    assert.ok(cssContent.includes('.ath-prateleira-base'), 'CSS deve conter .ath-prateleira-base');
    assert.ok(cssContent.includes('.ath-prateleira-superficie'), 'CSS deve conter .ath-prateleira-superficie');
    assert.ok(cssContent.includes('.ath-prateleira-chanfro'), 'CSS deve conter .ath-prateleira-chanfro');
    assert.ok(cssContent.includes('.ath-prateleira-sombra'), 'CSS deve conter .ath-prateleira-sombra');

    // 8. Estado vazio e card explicativo
    assert.ok(cssContent.includes('.ath-estante-vazia-card'), 'CSS deve conter .ath-estante-vazia-card');

    // 9. Folha interna
    assert.ok(cssContent.includes('.ath-livro-folha-interna'), 'CSS deve conter .ath-livro-folha-interna');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 5: Estado de Estante Vazia e Acessibilidade WAI-ARIA (R3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 5: Estado de Estante Vazia e Acessibilidade WAI-ARIA', () => {
  it('5.1. Estado de estante vazia exibe texto explicativo e preserva base chanfrada', () => {
    const estanteVazia = renderizarEstante3D([]);
    const cardVazio = estanteVazia.querySelector('.ath-estante-vazia-card');

    assert.ok(cardVazio, 'Card de estante vazia deve ser renderizado');
    assert.equal(cardVazio.textContent, 'Nenhuma obra cadastrada nesta estante.');

    // Acessibilidade semântica
    const prateleira = estanteVazia.querySelector('.ath-estante-prateleira');
    assert.ok(prateleira, 'Prateleira física existe mesmo quando vazia');
    assert.ok(prateleira.querySelector('.ath-prateleira-base'), 'Base chanfrada existe');
  });

  it('5.2. Acessibilidade WAI-ARIA e semântica no exemplar do livro', () => {
    const ref = { id: 'ref-aria', titulo: 'Princípios de Acessibilidade' };
    const livroEl = renderizarLivro3D(ref);

    assert.equal(livroEl.getAttribute('role'), 'button', 'Livro deve ter role="button"');
    assert.equal(livroEl.getAttribute('tabindex'), '0', 'Livro deve ter tabindex="0"');
    assert.equal(livroEl.getAttribute('aria-haspopup'), 'dialog', 'Livro deve declarar aria-haspopup="dialog"');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'false', 'Livro fechado deve ter aria-expanded="false"');
    assert.equal(livroEl.getAttribute('aria-label'), 'Livro: Princípios de Acessibilidade');

    // Ao abrir, atualiza aria-expanded
    abrirLivro3D(livroEl, ref);
    assert.equal(livroEl.getAttribute('aria-expanded'), 'true', 'Livro aberto deve ter aria-expanded="true"');
  });

  it('5.3. Acessibilidade WAI-ARIA na Folha Interna de Fichamento', () => {
    const ref = { id: 'ref-folha-aria', titulo: 'Auditoria de Fichamento' };
    const folha = renderizarFolhaInterna(ref);

    assert.equal(folha.getAttribute('role'), 'dialog', 'Folha deve ter role="dialog"');
    assert.equal(folha.getAttribute('aria-modal'), 'true', 'Folha deve ter aria-modal="true"');
    assert.ok(folha.getAttribute('aria-label').includes('Auditoria de Fichamento'), 'Folha deve ter aria-label');

    // Seletor de status
    const statusGroup = folha.querySelector('.ath-status-toggle');
    assert.equal(statusGroup.getAttribute('role'), 'radiogroup', 'Status deve ter role="radiogroup"');

    const statusBtns = statusGroup.querySelectorAll('.ath-status-btn');
    assert.equal(statusBtns.length, 3, 'Deve ter 3 opções de status');
    for (const btn of statusBtns) {
      assert.equal(btn.getAttribute('role'), 'radio', 'Opção deve ter role="radio"');
      assert.ok(btn.hasAttribute('aria-checked'), 'Opção deve ter aria-checked');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 6: Cinemática de Abertura, Exclusividade, Teclado e Scrim (R4)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 6: Cinemática de Abertura, Exclusividade, Teclado e Scrim', () => {
  beforeEach(() => {
    mockScrim.classList.remove('ativo');
  });

  it('6.1. Exclusividade estrita na estante: abrir livro B fecha automaticamente livro A', () => {
    const livros = [
      { id: 'livro-a', titulo: 'Livro Alfa' },
      { id: 'livro-b', titulo: 'Livro Beta' }
    ];
    const estante = renderizarEstante3D(livros);
    const [livroA, livroB] = estante.querySelectorAll('.ath-livro-3d');

    // 1. Abre Livro A
    abrirLivro3D(livroA, livros[0]);
    assert.ok(livroA.classList.contains('aberto'), 'Livro A deve estar aberto');
    assert.ok(!livroB.classList.contains('aberto'), 'Livro B deve estar fechado');

    // 2. Abre Livro B (deve fechar Livro A)
    abrirLivro3D(livroB, livros[1]);
    assert.ok(!livroA.classList.contains('aberto'), 'Livro A deve ter sido fechado');
    assert.equal(livroA.style.transform, 'rotateY(0deg) translateZ(0)', 'Livro A deve retornar ao repouso');
    assert.ok(livroB.classList.contains('aberto'), 'Livro B deve estar aberto');
  });

  it('6.2. Idempotência de abertura e fechamento sem corromper DOM nem duplicar folha', () => {
    const ref = { id: 'ref-idemp', titulo: 'Idempotência' };
    const livroEl = renderizarLivro3D(ref);

    // Abre 3 vezes consecutivas
    abrirLivro3D(livroEl, ref);
    abrirLivro3D(livroEl, ref);
    abrirLivro3D(livroEl, ref);

    const folhas = livroEl.querySelectorAll('.ath-livro-folha-interna');
    assert.equal(folhas.length, 1, 'Não deve duplicar a folha interna no DOM');

    // Fecha 3 vezes consecutivas
    fecharLivro3D(livroEl);
    fecharLivro3D(livroEl);
    fecharLivro3D(livroEl);

    assert.ok(!livroEl.classList.contains('aberto'), 'Deve estar fechado');
    assert.equal(livroEl.style.transform, 'rotateY(0deg) translateZ(0)');
  });

  it('6.3. Fechar todos os livros simultaneamente com fecharTodosLivros3D', () => {
    const livros = [
      { id: 'l1', titulo: 'Obra 1' },
      { id: 'l2', titulo: 'Obra 2' },
      { id: 'l3', titulo: 'Obra 3' }
    ];
    const estante = renderizarEstante3D(livros);
    const els = estante.querySelectorAll('.ath-livro-3d');

    // Força classe aberto nos 3
    for (const el of els) {
      el.classList.add('aberto');
    }

    fecharTodosLivros3D(estante);

    for (const el of els) {
      assert.ok(!el.classList.contains('aberto'), 'Todos os livros devem ser fechados');
      assert.equal(el.style.transform, 'rotateY(0deg) translateZ(0)');
    }
  });

  it('6.4. Acessibilidade por Teclado: Escape fecha o livro e outras teclas não interferem', () => {
    const ref = { id: 'ref-teclado', titulo: 'Teclado Acessível' };
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    assert.ok(livroEl.classList.contains('aberto'));

    // Teclas ignoradas
    tratarTecladoLivro3D({ key: 'Tab' }, livroEl);
    assert.ok(livroEl.classList.contains('aberto'), 'Tab não fecha o livro');

    tratarTecladoLivro3D({ key: 'Enter' }, livroEl);
    assert.ok(livroEl.classList.contains('aberto'), 'Enter não fecha o livro via tratarTeclado');

    // Escape fecha
    tratarTecladoLivro3D({ key: 'Escape' }, livroEl);
    assert.ok(!livroEl.classList.contains('aberto'), 'Escape deve fechar o livro');

    // keyCode 27 também fecha
    abrirLivro3D(livroEl, ref);
    tratarTecladoLivro3D({ keyCode: 27 }, livroEl);
    assert.ok(!livroEl.classList.contains('aberto'), 'keyCode 27 (Escape) deve fechar o livro');
  });

  it('6.5. Controle do Scrim backdrop (#athEstanteScrim)', () => {
    const ref = { id: 'ref-scrim', titulo: 'Foco e Scrim' };
    const livroEl = renderizarLivro3D(ref);

    assert.ok(!mockScrim.classList.contains('ativo'), 'Scrim começa inativo');

    abrirLivro3D(livroEl, ref);
    assert.ok(mockScrim.classList.contains('ativo'), 'Scrim fica ativo ao abrir livro');

    fecharLivro3D(livroEl);
    assert.ok(!mockScrim.classList.contains('ativo'), 'Scrim fica inativo ao fechar livro');
  });

  it('6.6. Clique dentro da folha interna não propaga fechamento para o livro', () => {
    const ref = { id: 'ref-folha-click', titulo: 'Não Fechar no Fichamento' };
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);

    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    assert.ok(folha, 'Folha interna deve existir');

    // Simula evento de clique originado dentro da folha
    const evCliqueFolha = {
      target: folha,
      stopPropagation: () => {}
    };

    livroEl.dispatchEvent(evCliqueFolha);
    assert.ok(livroEl.classList.contains('aberto'), 'Clique dentro da folha não deve fechar o livro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 7: Folha Interna, Citation Tracker e Interações (R4)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cenário 7: Folha Interna, Citation Tracker e Interações', () => {
  it('7.1. Citation Tracker: Contagem de citações, formato resumido e seções detalhadas', () => {
    const ref = {
      id: 'ref-cit',
      titulo: 'Trabalho Muito Citado',
      ano: '2022',
      totalCitationsCount: 1450,
      citedInSections: [
        { secaoTitulo: 'Introdução', docTitulo: 'Artigo Principal' },
        { secaoTitulo: 'Metodologia', docTitulo: 'Artigo Principal' }
      ]
    };

    // Capa do livro exibe formato '1k'
    const livroEl = renderizarLivro3D(ref);
    const citacoesCapa = livroEl.querySelector('.ath-livro-citacoes');
    assert.equal(citacoesCapa.textContent, '❝ 1k', '1450 citações vira ❝ 1k na capa');

    // Folha interna exibe contagem completa e seções
    const folha = renderizarFolhaInterna(ref);
    const citTotal = folha.querySelector('.ath-citacoes-total');
    assert.equal(citTotal.textContent, 'Citações no projeto: 1450');

    const secoes = folha.querySelectorAll('.ath-citation-secao-badge');
    assert.equal(secoes.length, 2, 'Deve renderizar 2 seções citadas');
    assert.equal(secoes[0].textContent, 'Introdução (Artigo Principal)');
    assert.equal(secoes[1].textContent, 'Metodologia (Artigo Principal)');
  });

  it('7.2. Citation Tracker: Contagem zero e negativa normaliza seguramente para 0', () => {
    const refNegativo = {
      id: 'ref-neg',
      titulo: 'Contagem Anômala',
      totalCitationsCount: -99
    };

    const livroEl = renderizarLivro3D(refNegativo);
    const citacoesCapa = livroEl.querySelector('.ath-livro-citacoes');
    assert.equal(citacoesCapa.textContent, '❝ 0');

    const folha = renderizarFolhaInterna(refNegativo);
    const citTotal = folha.querySelector('.ath-citacoes-total');
    assert.equal(citTotal.textContent, 'Citações no projeto: 0');
  });

  it('7.3. Copiar chave de citação formatada: data-chave e feedback visual de copiado', () => {
    const ref = {
      id: 'ref-key',
      titulo: 'Teoria da Informação',
      ano: '1948',
      autores: [{ sobrenome: 'Shannon', prenome: 'Claude' }],
      formattedCitationKey: '(SHANNON, 1948)'
    };

    const folha = renderizarFolhaInterna(ref);
    const btnCopiar = folha.querySelector('.ath-btn-copiar-citacao');
    assert.ok(btnCopiar, 'Botão de copiar citação deve existir');
    assert.equal(btnCopiar.getAttribute('data-chave'), '(SHANNON, 1948)');

    // Dispara clique
    btnCopiar.dispatchEvent({ type: 'click' });
    assert.ok(btnCopiar.classList.contains('copiado'), 'Deve receber classe .copiado');
    assert.equal(btnCopiar.textContent, 'Copiado! ✓');
  });

  it('7.4. Alternância do Status de Leitura (Toggle): Atualiza ref e dispara callback', () => {
    const ref = { id: 'ref-st', titulo: 'Obra Status', statusLeitura: 'nao_lido' };
    let statusAlteradoPara = null;

    const folha = renderizarFolhaInterna(ref, {
      onStatusChange: (novoStatus) => {
        statusAlteradoPara = novoStatus;
      }
    });

    const btnLendo = folha.querySelector('button[data-status="lendo"]');
    assert.ok(btnLendo, 'Botão "Lendo" deve existir');

    btnLendo.dispatchEvent({ type: 'click' });
    assert.equal(ref.statusLeitura, 'lendo', 'ref.statusLeitura deve ser atualizado para lendo');
    assert.equal(statusAlteradoPara, 'lendo', 'Callback onStatusChange deve receber "lendo"');
    assert.equal(btnLendo.getAttribute('aria-checked'), 'true');
  });

  it('7.5. Anotação Rápida e Fichamento: Persistência de notas via blur e botão Salvar', () => {
    const ref = {
      id: 'ref-nota',
      titulo: 'Anotações da Pesquisa',
      pinnedNotes: ['Nota anterior']
    };

    let notaSalva = null;
    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (txt) => {
        notaSalva = txt;
      }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    assert.ok(textarea, 'Campo de anotação rápida deve existir');
    assert.equal(textarea.value, 'Nota anterior', 'Deve exibir a última nota');

    // Altera valor e dispara blur
    textarea.value = 'Nova anotação crítica sobre o método.';
    textarea.dispatchEvent({ type: 'blur' });

    assert.equal(notaSalva, 'Nova anotação crítica sobre o método.', 'Callback onSalvarNota deve ser chamado');
    assert.ok(ref.pinnedNotes.includes('Nova anotação crítica sobre o método.'));
  });

  it('7.6. Botões de Ação da Folha: Botão Primário "Abrir Leitor" e Ações Secundárias', () => {
    const ref = { id: 'ref-acoes', titulo: 'Artigo Completo' };
    let leitorAberto = false;
    let editMetaChamado = false;
    let moverPastaChamado = false;
    let mudarCorChamado = false;

    const folha = renderizarFolhaInterna(ref, {
      onAbrirLeitor: (art) => { leitorAberto = true; },
      onEditarMetadados: (art) => { editMetaChamado = true; },
      onMoverPasta: (art) => { moverPastaChamado = true; },
      onAlterarCorCapa: (art) => { mudarCorChamado = true; }
    });

    // 1. Abrir leitor primário
    const btnAbrir = folha.querySelector('.ath-btn-abrir-leitor');
    assert.ok(btnAbrir, 'Botão abrir leitor deve existir');
    btnAbrir.dispatchEvent({ type: 'click' });
    assert.ok(leitorAberto, 'onAbrirLeitor deve ter sido acionado');

    // 2. Ações secundárias
    const secBox = folha.querySelector('.ath-folha-acoes-secundarias');
    assert.ok(secBox, 'Box de ações secundárias deve existir');

    const botoesSec = secBox.querySelectorAll('button');
    assert.equal(botoesSec.length, 2, 'Deve conter 2 botões secundários');

    const btnEdit = botoesSec.find(b => b.getAttribute('title') === 'Editar metadados da obra');
    assert.ok(btnEdit, 'Botão Editar metadados deve existir');
    btnEdit.dispatchEvent({ type: 'click' });
    assert.ok(editMetaChamado, 'onEditarMetadados acionado');

    const btnMover = botoesSec.find(b => b.getAttribute('title') === 'Mover para outra pasta');
    assert.ok(btnMover, 'Botão Mover para outra pasta deve existir');
    btnMover.dispatchEvent({ type: 'click' });
    assert.ok(moverPastaChamado, 'onMoverPasta acionado');

    const btnCor = folha.querySelectorAll('.ath-folha-cor-amostra')[1];
    assert.ok(btnCor, 'A escolha de cor deve ficar no topo da ficha');
    btnCor.dispatchEvent({ type: 'click' });
    assert.ok(mudarCorChamado, 'onAlterarCorCapa acionado');
  });
});
