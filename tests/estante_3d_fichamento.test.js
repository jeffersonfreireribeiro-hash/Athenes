// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file Suíte de Testes Unitários de M3 — Estante 3D, Livros Esquemáticos e Folha de Fichamento.
 * Requisitos R3 e R4 (Milestone 3).
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

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
  criarBookReferenceItem,
  STATUS_LEITURA
} from '../src/core/athenes_referencias.js';

// ─────────────────────────────────────────────────────────────────────────────
// Infraestrutura Determinística de Mock DOM em Memória
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
    if (globalThis.document) globalThis.document.activeElement = this;
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

// Configuração do Mock DOM global
globalThis.document = {
  createElement: (tag) => new MockDOMElement(tag),
  getElementById: (id) => null,
  activeElement: null
};

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1: Prateleiras e Estrutura Horizontal da Estante 3D (renderizarEstante3D)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 1: Prateleiras e Estrutura Horizontal da Estante 3D (R3 / F5)', () => {
  it('1.1: Container da estante .ath-estante-3d possui perspectiva tridimensional de 1000px', () => {
    const estante = renderizarEstante3D([]);
    assert.ok(estante.classList.contains('ath-estante-3d'), 'Deve ter classe .ath-estante-3d');
    assert.equal(estante.style.perspective, '1000px', 'Perspectiva 3D deve ser 1000px');
  });

  it('1.2: Prateleiras contêm base chanfrada .ath-prateleira-base e sombra projetada .ath-prateleira-sombra', () => {
    const itens = [criarBookReferenceItem({ id: 'item_1', titulo: 'Obra 1' })];
    const estante = renderizarEstante3D(itens);
    const prateleira = estante.querySelector('.ath-estante-prateleira');
    assert.ok(prateleira, 'Deve renderizar prateleira');
    assert.ok(prateleira.querySelector('.ath-prateleira-base'), 'Deve conter base');
    assert.ok(prateleira.querySelector('.ath-prateleira-superficie'), 'Deve conter superfície chanfrada');
    assert.ok(prateleira.querySelector('.ath-prateleira-chanfro'), 'Deve conter chanfro biselado');
    assert.ok(prateleira.querySelector('.ath-prateleira-sombra'), 'Deve conter sombra projetada');
  });

  it('1.3: Distribuição com mais de 6 livros gera automaticamente prateleiras adicionais', () => {
    const itens = Array.from({ length: 13 }, (_, i) => criarBookReferenceItem({ id: `item_${i}`, titulo: `Obra ${i}` }));
    const estante = renderizarEstante3D(itens, { maxPorPrateleira: 6 });
    const prateleiras = estante.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prateleiras.length, 3, '13 livros devem ocupar 3 prateleiras (6 + 6 + 1)');
  });

  it('1.4: Estante vazia renderiza card editorial explicativo sem quebrar a estrutura da prateleira', () => {
    const estante = renderizarEstante3D([]);
    const cardVazio = estante.querySelector('.ath-estante-vazia-card');
    assert.ok(cardVazio, 'Card de estante vazia deve estar presente');
    assert.ok(cardVazio.textContent.includes('Nenhuma obra'), 'Texto deve indicar ausência de obras');
    assert.ok(estante.querySelector('.ath-prateleira-base'), 'Base deve existir mesmo vazia');
    assert.ok(estante.querySelector('.ath-prateleira-sombra'), 'Sombra deve existir mesmo vazia');
  });

  it('1.5: Livros na prateleira ficam agrupados no container flex .ath-prateleira-livros', () => {
    const itens = [criarBookReferenceItem({ id: 'b_1' }), criarBookReferenceItem({ id: 'b_2' })];
    const estante = renderizarEstante3D(itens);
    const areaLivros = estante.querySelector('.ath-prateleira-livros');
    assert.ok(areaLivros, 'Container .ath-prateleira-livros deve existir');
    assert.equal(areaLivros.querySelectorAll('.ath-livro-3d').length, 2);
  });

  it('1.6: Invocação de renderizarEstante3D com array nulo ou maxPorPrateleira <= 0 opera com segurança', () => {
    const estanteNula = renderizarEstante3D(null);
    assert.ok(estanteNula.querySelector('.ath-estante-vazia-card'));

    const itens = Array.from({ length: 8 }, (_, i) => criarBookReferenceItem({ id: `i_${i}` }));
    const estanteInvalida = renderizarEstante3D(itens, { maxPorPrateleira: -3 });
    const prats = estanteInvalida.querySelectorAll('.ath-estante-prateleira');
    assert.equal(prats.length, 2, 'Fallback deve assumir 6 por prateleira');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2: Anatomia Esquematizada e Atributos Visuais dos Livros 3D (renderizarLivro3D)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 2: Anatomia Esquematizada e Atributos Visuais dos Livros 3D (R3 / F6)', () => {
  it('2.1: Cada livro renderiza com a classe .ath-livro-3d e preserve-3d', () => {
    const ref = criarBookReferenceItem({ id: 'livro_1', titulo: 'Geodésia' });
    const livroEl = renderizarLivro3D(ref);
    assert.ok(livroEl.classList.contains('ath-livro-3d'), 'Deve ter classe .ath-livro-3d');
    assert.equal(livroEl.style.transformStyle, 'preserve-3d');
    assert.equal(livroEl.getAttribute('data-livro-id'), 'livro_1');
  });

  it('2.2: Livro apresenta lombada lateral à esquerda com cor e texto vertical', () => {
    const ref = criarBookReferenceItem({
      id: 'livro_2',
      titulo: 'Topografia e Agrimensura',
      corCapa: '#FF6B2C',
      autores: [{ sobrenome: 'Silva', prenome: 'Ana' }],
      ano: '2024'
    });
    const livroEl = renderizarLivro3D(ref);
    const lombada = livroEl.querySelector('.ath-livro-lombada');
    assert.ok(lombada, 'Deve conter .ath-livro-lombada');
    assert.equal(lombada.style.backgroundColor, '#FF6B2C');
    assert.ok(lombada.querySelector('.ath-livro-lombada-texto'));
  });

  it('2.3: Livro contém miolo de páginas simulado e capa traseira', () => {
    const ref = criarBookReferenceItem({ id: 'livro_3' });
    const livroEl = renderizarLivro3D(ref);
    assert.ok(livroEl.querySelector('.ath-livro-paginas'), 'Deve conter páginas laterais');
    assert.ok(livroEl.querySelector('.ath-livro-paginas-baixo'), 'Deve conter páginas inferiores');
    assert.ok(livroEl.querySelector('.ath-livro-capa-tras'), 'Deve conter capa traseira');
    assert.ok(livroEl.querySelector('.ath-livro-sombra-base'), 'Deve conter sombra de contato');
  });

  it('2.4: Capa frontal exibe badge de ano, tipo de documento e mini-contador de citações', () => {
    const ref = criarBookReferenceItem({
      id: 'livro_4',
      ano: '2023',
      tipo: 'artigo',
      totalCitationsCount: 14
    });
    const livroEl = renderizarLivro3D(ref);
    const capa = livroEl.querySelector('.ath-livro-capa');
    assert.ok(capa, 'Deve conter capa frontal');

    const badge = capa.querySelector('.ath-livro-badge-tipo');
    assert.ok(badge);
    assert.equal(badge.textContent, '2023 · artigo');

    const citacoes = capa.querySelector('.ath-livro-citacoes');
    assert.ok(citacoes);
    assert.equal(citacoes.textContent, '❝ 14');
  });

  it('2.5: Mini-contador de citações formata valores >= 1000 com sufixo "k"', () => {
    const ref = criarBookReferenceItem({ id: 'cit_1k', totalCitationsCount: 1250 });
    const livroEl = renderizarLivro3D(ref);
    const citacoes = livroEl.querySelector('.ath-livro-citacoes');
    assert.equal(citacoes.textContent, '❝ 1k');
  });

  it('2.6: Título da obra e autores são renderizados na capa com fallbacks seguros', () => {
    const refSemAutor = criarBookReferenceItem({ id: 'sem_autor', titulo: 'Monografia sem Autor', autores: [] });
    const livroSemAutor = renderizarLivro3D(refSemAutor);
    assert.equal(livroSemAutor.querySelector('.ath-livro-autores').textContent, 'Autor não informado');

    const refSemTitulo = criarBookReferenceItem({ id: 'sem_tit', titulo: '' });
    const livroSemTit = renderizarLivro3D(refSemTitulo);
    assert.equal(livroSemTit.querySelector('.ath-livro-titulo').textContent, 'Sem Título');
  });

  it('2.7: Indicador de PDF (.ath-livro-pdf-pill) é renderizado exclusivamente quando há PDF vinculado', () => {
    const refComPdf = criarBookReferenceItem({ id: 'com_pdf', pdfUrl: 'https://exemplo.com/doc.pdf' });
    const livroComPdf = renderizarLivro3D(refComPdf);
    assert.ok(livroComPdf.querySelector('.ath-livro-pdf-pill'), 'Deve exibir pill de PDF');

    const refSemPdf = criarBookReferenceItem({ id: 'sem_pdf', pdfUrl: '', pdfCaminho: '' });
    const livroSemPdf = renderizarLivro3D(refSemPdf);
    assert.equal(livroSemPdf.querySelector('.ath-livro-pdf-pill'), null, 'Não deve exibir pill');
  });

  it('2.8: Acessibilidade ARIA é configurada no livro como disparador de diálogo', () => {
    const ref = criarBookReferenceItem({ id: 'aria_1', titulo: 'Livro ARIA' });
    const livroEl = renderizarLivro3D(ref);
    assert.equal(livroEl.getAttribute('role'), 'button');
    assert.equal(livroEl.getAttribute('tabindex'), '0');
    assert.equal(livroEl.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'false');
  });

  it('2.9: Livro possui face interna (.ath-livro-capa-verso) para suporte a rotação 3D de -140°', () => {
    const ref = criarBookReferenceItem({ id: 'verso_1' });
    const livroEl = renderizarLivro3D(ref);
    assert.ok(livroEl.querySelector('.ath-livro-capa-verso'), 'Deve conter face interna (.ath-livro-capa-verso)');
  });

  it('2.10: Livro aberto comuta role="button" para "region" com tabindex="-1" e restaura ao fechar (WAI-ARIA 1.2)', () => {
    const ref = criarBookReferenceItem({ id: 'aria_dinamico' });
    const livroEl = renderizarLivro3D(ref);
    assert.equal(livroEl.getAttribute('role'), 'button');
    assert.equal(livroEl.getAttribute('tabindex'), '0');

    abrirLivro3D(livroEl, ref);
    assert.equal(livroEl.getAttribute('role'), 'region', 'Livro aberto deve ter role="region" para não aninhar dialog em button');
    assert.equal(livroEl.getAttribute('tabindex'), '-1', 'Livro aberto comuta tabindex para -1');

    fecharLivro3D(livroEl);
    assert.equal(livroEl.getAttribute('role'), 'button', 'Livro fechado deve restaurar role="button"');
    assert.equal(livroEl.getAttribute('tabindex'), '0', 'Livro fechado deve restaurar tabindex="0"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3: Cinemática 3D de Abertura, Fechamento e Teclado (R4 / F7)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 3: Cinemática 3D de Abertura, Fechamento e Teclado (R4 / F7)', () => {
  it('3.1: abrirLivro3D adiciona classe .aberto, translada com translateZ(60px) e atualiza ARIA', () => {
    const ref = criarBookReferenceItem({ id: 'cin_1' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    assert.ok(livroEl.classList.contains('aberto'), 'Deve conter classe .aberto');
    assert.equal(livroEl.style.transform, 'translateZ(60px)');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'true');
  });

  it('3.2: Abertura do livro instancia a folha interna com a ficha rápida da obra', () => {
    const ref = criarBookReferenceItem({ id: 'cin_2', titulo: 'Ficha da Obra Teste' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    assert.ok(livroEl.querySelector('.ath-livro-folha-interna'), 'Deve conter folha interna');
  });

  it('3.3: fecharLivro3D remove classe .aberto e restaura inclinação de repouso', () => {
    const ref = criarBookReferenceItem({ id: 'cin_3' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    fecharLivro3D(livroEl);
    assert.ok(!livroEl.classList.contains('aberto'), 'Não deve conter .aberto');
    assert.equal(livroEl.style.transform, 'rotateY(-18deg) rotateX(4deg)');
    assert.equal(livroEl.getAttribute('aria-expanded'), 'false');
  });

  it('3.4: Pressionar a tecla Escape fecha suavemente o livro aberto', () => {
    const ref = criarBookReferenceItem({ id: 'cin_4' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, livroEl);
    assert.ok(!livroEl.classList.contains('aberto'), 'Escape deve fechar o livro');
  });

  it('3.5: Teclas que não são Escape são ignoradas e não fecham o livro', () => {
    const ref = criarBookReferenceItem({ id: 'cin_5' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    tratarTecladoLivro3D({ key: 'Enter', keyCode: 13 }, livroEl);
    tratarTecladoLivro3D({ key: 'Tab', keyCode: 9 }, livroEl);
    assert.ok(livroEl.classList.contains('aberto'), 'Livro deve permanecer aberto');
  });

  it('3.6: Abertura repetida no mesmo livro reutiliza a folha interna sem duplicação', () => {
    const ref = criarBookReferenceItem({ id: 'cin_6' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    abrirLivro3D(livroEl, ref);
    const folhas = livroEl.querySelectorAll('.ath-livro-folha-interna');
    assert.equal(folhas.length, 1, 'Não deve duplicar folha interna');
  });

  it('3.7: Abrir um novo livro fecha automaticamente o livro previamente aberto na estante', () => {
    const itens = [criarBookReferenceItem({ id: 'liv_a' }), criarBookReferenceItem({ id: 'liv_b' })];
    const estante = renderizarEstante3D(itens);
    const [livroA, livroB] = estante.querySelectorAll('.ath-livro-3d');

    abrirLivro3D(livroA, itens[0]);
    assert.ok(livroA.classList.contains('aberto'), 'Livro A aberto');

    abrirLivro3D(livroB, itens[1]);
    assert.ok(livroB.classList.contains('aberto'), 'Livro B aberto');
    assert.ok(!livroA.classList.contains('aberto'), 'Livro A deve ter sido fechado automaticamente');
  });

  it('3.8: Disparos de fechar/abrir/teclado com entradas nulas não geram exceções', () => {
    assert.doesNotThrow(() => fecharLivro3D(null));
    assert.doesNotThrow(() => abrirLivro3D(null, {}));
    assert.doesNotThrow(() => fecharTodosLivros3D(null));
    assert.doesNotThrow(() => tratarTecladoLivro3D(null, null));
  });

  it('3.9: fecharLivro3D oculta estritamente a folha interna com display="none" e aria-hidden="true"', () => {
    const ref = criarBookReferenceItem({ id: 'oculta_folha_1' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    assert.ok(folha, 'Folha interna deve ser instanciada');
    assert.equal(folha.getAttribute('aria-hidden'), 'false');

    fecharLivro3D(livroEl);
    assert.equal(folha.style.display, 'none', 'Folha deve ter display="none" ao fechar');
    assert.equal(folha.getAttribute('aria-hidden'), 'true', 'Folha deve ter aria-hidden="true" ao fechar');
  });

  it('3.10: Reabertura do livro restaura display="flex" e aria-hidden="false" na folha interna', () => {
    const ref = criarBookReferenceItem({ id: 'reabre_folha_1' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    fecharLivro3D(livroEl);
    abrirLivro3D(livroEl, ref);
    const folha = livroEl.querySelector('.ath-livro-folha-interna');
    assert.equal(folha.style.display, 'flex');
    assert.equal(folha.getAttribute('aria-hidden'), 'false');
  });

  it('3.11: abrirLivro3D direciona foco acessível inicial para o título da folha (.ath-folha-titulo)', async () => {
    const ref = criarBookReferenceItem({ id: 'foco_titulo_1', titulo: 'Obra com Foco' });
    const livroEl = renderizarLivro3D(ref);
    abrirLivro3D(livroEl, ref);
    await new Promise(r => setTimeout(r, 60));
    const titulo = livroEl.querySelector('.ath-folha-titulo');
    assert.equal(titulo.getAttribute('tabindex'), '-1', 'Título deve ter tabindex="-1" para foco programático');
    assert.equal(globalThis.document.activeElement, titulo, 'Foco ativo deve ser o título da folha');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4: Folha Interna, Cabeçalho e Citation Tracker (R4 / F8)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 4: Folha Interna, Cabeçalho e Citation Tracker (R4 / F8)', () => {
  it('4.1: Folha interna apresenta cabeçalho com título, metadados e status alternável', () => {
    const ref = criarBookReferenceItem({
      id: 'folha_1',
      titulo: 'Trabalho de Conclusão de Curso em Geoinformática',
      statusLeitura: 'lendo'
    });
    const folha = renderizarFolhaInterna(ref);
    assert.equal(folha.querySelector('.ath-folha-titulo').textContent, 'Trabalho de Conclusão de Curso em Geoinformática');
    assert.ok(folha.querySelector('.ath-status-toggle'));
    const btnAtivo = folha.querySelector('.ath-status-btn.ativo');
    assert.equal(btnAtivo.getAttribute('data-status'), 'lendo');
  });

  it('4.2: Folha interna sem autores exibe fallback seguro "Autor" na linha de meta', () => {
    const ref = criarBookReferenceItem({ id: 'folha_2', autores: [] });
    const folha = renderizarFolhaInterna(ref);
    assert.ok(folha.querySelector('.ath-folha-meta').textContent.includes('Autor'));
  });

  it('4.3: Citation Tracker exibe contagem total de citações no projeto', () => {
    const ref = criarBookReferenceItem({ id: 'folha_3', totalCitationsCount: 15 });
    const folha = renderizarFolhaInterna(ref);
    assert.ok(folha.querySelector('.ath-citacoes-total').textContent.includes('15'));
  });

  it('4.4: Citation Tracker com zero citações renderiza número 0 limpo', () => {
    const ref = criarBookReferenceItem({ id: 'folha_4', totalCitationsCount: 0 });
    const folha = renderizarFolhaInterna(ref);
    assert.ok(folha.querySelector('.ath-citacoes-total').textContent.includes('0'));
  });

  it('4.5: Badges de seções onde a obra é citada são listadas no Citation Tracker', () => {
    const ref = {
      ...criarBookReferenceItem({ id: 'folha_5', totalCitationsCount: 2 }),
      citedInSections: [
        { secaoTitulo: 'Introdução', docTitulo: 'Artigo Final' },
        { secaoTitulo: 'Metodologia', docTitulo: 'Artigo Final' }
      ]
    };
    const folha = renderizarFolhaInterna(ref);
    const badges = folha.querySelectorAll('.ath-citation-secao-badge');
    assert.equal(badges.length, 2);
    assert.ok(badges[0].textContent.includes('Introdução'));
  });

  it('4.6: Botão de cópia de citação rápida possui chave formatada', () => {
    const ref = criarBookReferenceItem({
      id: 'folha_6',
      autores: [{ sobrenome: 'Silva', prenome: 'Lucas' }],
      ano: '2024'
    });
    const folha = renderizarFolhaInterna(ref);
    const btnCopiar = folha.querySelector('.ath-btn-copiar-citacao');
    assert.ok(btnCopiar);
    assert.ok(btnCopiar.textContent.includes('Copiar Citação'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5: Fichamento, Status de Leitura e Persistência de Anotações
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 5: Fichamento, Status de Leitura e Persistência de Anotações (R4 / F8)', () => {
  it('5.1: Seletor de status de leitura possui opções nao_lido, lendo e fichado', () => {
    const ref = criarBookReferenceItem();
    const folha = renderizarFolhaInterna(ref);
    const botoes = folha.querySelectorAll('.ath-status-btn');
    assert.equal(botoes.length, 3);
  });

  it('5.2: Clique no status de leitura atualiza o modelo e dispara callback onStatusChange', () => {
    const ref = criarBookReferenceItem({ id: 'st_1', statusLeitura: 'nao_lido' });
    let statusRecebido = null;
    const folha = renderizarFolhaInterna(ref, {
      onStatusChange: (s) => { statusRecebido = s; }
    });
    const btnFichado = folha.querySelector('[data-status="fichado"]');
    btnFichado.dispatchEvent({ type: 'click' });
    assert.equal(statusRecebido, 'fichado');
    assert.equal(ref.statusLeitura, 'fichado');
  });

  it('5.3: Status de leitura inicial desconhecido não ativa nenhum botão', () => {
    const ref = criarBookReferenceItem();
    ref.statusLeitura = 'desconhecido';
    const folha = renderizarFolhaInterna(ref);
    assert.equal(folha.querySelector('.ath-status-btn.ativo'), null);
  });

  it('5.4: Contador de grifos exibe quantidade de marcações da obra', () => {
    const ref = criarBookReferenceItem({ id: 'grif_1', highlightsCount: 7 });
    const folha = renderizarFolhaInterna(ref);
    assert.ok(folha.querySelector('.ath-grifos-contador').textContent.includes('7'));
  });

  it('5.5: Salvar anotação rápida inclui texto em pinnedNotes e dispara onSalvarNota', () => {
    const ref = criarBookReferenceItem({ id: 'nota_1', pinnedNotes: [] });
    let notaRecebida = null;
    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (n) => { notaRecebida = n; }
    });
    const input = folha.querySelector('.ath-anotacao-rapida-input');
    input.value = 'Excelente metodologia de calibração.';
    const btn = folha.querySelector('.ath-btn-salvar-anotacao');
    btn.dispatchEvent({ type: 'click' });

    assert.equal(notaRecebida, 'Excelente metodologia de calibração.');
    assert.ok(ref.pinnedNotes.includes('Excelente metodologia de calibração.'));
  });

  it('5.6: Rejeição de anotação contendo apenas espaços sem corromper pinnedNotes', () => {
    const ref = criarBookReferenceItem({ id: 'nota_2', pinnedNotes: [] });
    const folha = renderizarFolhaInterna(ref);
    const input = folha.querySelector('.ath-anotacao-rapida-input');
    input.value = '     ';
    const btn = folha.querySelector('.ath-btn-salvar-anotacao');
    btn.dispatchEvent({ type: 'click' });
    assert.equal(ref.pinnedNotes.length, 0);
  });

  it('5.7: Idempotência estrita: sequência rápida de blur seguido de click não duplica notas nem chamadas de onSalvarNota', () => {
    const ref = criarBookReferenceItem({ id: 'nota_dedup_1', pinnedNotes: [] });
    let chamadasSalvar = 0;
    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { chamadasSalvar++; }
    });
    const input = folha.querySelector('.ath-anotacao-rapida-input');
    const btn = folha.querySelector('.ath-btn-salvar-anotacao');

    input.value = 'Anotação com salvamento concorrente blur + click';

    // Simula a sequência exata de eventos de navegadores reais:
    input.dispatchEvent({ type: 'blur' });
    btn.dispatchEvent({ type: 'click' });

    assert.equal(chamadasSalvar, 1, 'Callback onSalvarNota deve ser acionado exatamente 1 vez');
    assert.equal(ref.pinnedNotes.length, 1, 'pinnedNotes deve conter exatamente 1 item');
    assert.equal(ref.pinnedNotes[0], 'Anotação com salvamento concorrente blur + click');
  });

  it('5.8: Desfocagem (blur) sem alteração de texto preserva pinnedNotes sem duplicação', () => {
    const ref = criarBookReferenceItem({ id: 'nota_existente_1', pinnedNotes: ['Nota já existente'] });
    let chamouCallback = false;
    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: () => { chamouCallback = true; }
    });
    const input = folha.querySelector('.ath-anotacao-rapida-input');

    // Foco e desfoco sem alterar o valor
    input.dispatchEvent({ type: 'blur' });

    assert.equal(chamouCallback, false, 'Callback não deve ser disparado se o conteúdo não mudou');
    assert.equal(ref.pinnedNotes.length, 1, 'pinnedNotes deve permanecer com apenas 1 nota');
    assert.equal(ref.pinnedNotes[0], 'Nota já existente');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 6: Ações da Folha, Leitor e Movimentação entre Pastas
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 6: Ações da Folha, Leitor e Movimentação entre Pastas (R4)', () => {
  it('6.1: Botão primário exibe texto "📖 Abrir Arquivo / Ler Referência"', () => {
    const ref = criarBookReferenceItem({ id: 'acao_1' });
    const folha = renderizarFolhaInterna(ref);
    const btn = folha.querySelector('.ath-btn-abrir-leitor');
    assert.ok(btn);
    assert.ok(btn.textContent.includes('📖 Abrir Arquivo / Ler Referência'));
  });

  it('6.2: Clique no botão primário dispara callback canônico onAbrirLeitor', () => {
    const ref = criarBookReferenceItem({ id: 'acao_2', pdfUrl: 'estudo.pdf' });
    let refRecebida = null;
    const folha = renderizarFolhaInterna(ref, {
      onAbrirLeitor: (r) => { refRecebida = r; }
    });
    folha.querySelector('.ath-btn-abrir-leitor').dispatchEvent({ type: 'click' });
    assert.equal(refRecebida.id, 'acao_2');
  });

  it('6.3: Obra sem PDF vinculado dispara onAbrirLeitor sem erros', () => {
    const ref = criarBookReferenceItem({ id: 'acao_3', pdfUrl: '', pdfCaminho: '' });
    let chamado = false;
    const folha = renderizarFolhaInterna(ref, {
      onAbrirLeitor: () => { chamado = true; }
    });
    folha.querySelector('.ath-btn-abrir-leitor').dispatchEvent({ type: 'click' });
    assert.equal(chamado, true);
  });

  it('6.4: Botões secundários acionam callbacks de metadados, mover pasta e cor', () => {
    const ref = criarBookReferenceItem({ id: 'sec_1' });
    let metaChamado = false;
    let moverChamado = false;
    let corChamado = false;

    const folha = renderizarFolhaInterna(ref, {
      onEditarMeta: () => { metaChamado = true; },
      onMoverPasta: () => { moverChamado = true; },
      onMudarCor: () => { corChamado = true; }
    });

    const botoesSec = folha.querySelectorAll('.ath-folha-acoes-secundarias button');
    assert.equal(botoesSec.length, 3);

    botoesSec[0].dispatchEvent({ type: 'click' });
    botoesSec[1].dispatchEvent({ type: 'click' });
    botoesSec[2].dispatchEvent({ type: 'click' });

    assert.equal(metaChamado, true);
    assert.equal(moverChamado, true);
    assert.equal(corChamado, true);
  });

  it('6.5: moverLivroParaPasta atualiza pastaId e rejeita pasta inexistente', () => {
    const ref = criarBookReferenceItem({ id: 'mov_1', pastaId: 'origem' });
    const pastas = [{ id: 'origem', nome: 'Origem' }, { id: 'destino', nome: 'Destino' }];

    const resOk = moverLivroParaPasta('mov_1', 'destino', [ref], pastas);
    assert.equal(resOk.sucesso, true);
    assert.equal(ref.pastaId, 'destino');

    const resInvalido = moverLivroParaPasta('mov_1', 'pasta_inexistente', [ref], pastas);
    assert.equal(resInvalido.sucesso, false);
    assert.equal(resInvalido.motivo, 'pasta_destino_inexistente');
  });

  it('6.6: renderizarFolhaInterna sem callbacks de opções opera normalmente', () => {
    const ref = criarBookReferenceItem();
    assert.doesNotThrow(() => {
      const folha = renderizarFolhaInterna(ref);
      assert.ok(folha.querySelector('.ath-folha-titulo'));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 7: CSS e Acessibilidade de Movimento (WCAG 2.3.3 / Iteração 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 7: CSS e Acessibilidade de Movimento (WCAG 2.3.3 / Iteração 2)', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cssPath = join(__dirname, '..', 'src', 'css', 'athenes_estante_3d.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  it('7.1: Folha fechada possui regra CSS de ocultação estrita com !important (.ath-livro-3d:not(.aberto) .ath-livro-folha-interna)', () => {
    assert.ok(
      cssContent.includes('.ath-livro-3d:not(.aberto) .ath-livro-folha-interna'),
      'CSS deve conter seletor de ocultação para folha de livro fechado'
    );
    assert.ok(
      cssContent.includes('display: none !important;'),
      'Ocultação deve utilizar display: none !important;'
    );
  });

  it('7.2: CSS define bloco @media (prefers-reduced-motion: reduce) com transição de 0.01ms !important', () => {
    assert.ok(
      cssContent.includes('@media (prefers-reduced-motion: reduce)'),
      'CSS deve declarar media query prefers-reduced-motion: reduce'
    );
    assert.ok(
      cssContent.includes('transition-duration: 0.01ms !important;'),
      'Deve declarar transition-duration: 0.01ms !important para anular cinemática'
    );
  });

  it('7.3: Regra de :hover na prateleira possui !important para prevalecer sobre transform inline', () => {
    assert.ok(
      cssContent.includes(':not(.aberto):hover'),
      'Deve conter seletor de hover para livros não abertos'
    );
    assert.ok(
      cssContent.includes('translateZ(16px) !important;'),
      'Hover 3D deve usar !important para sobrepor inline style'
    );
  });

  it('7.4: Verso da capa frontal possui rotateY(180deg) e backface-visibility: hidden no CSS', () => {
    assert.ok(
      cssContent.includes('.ath-livro-capa-verso'),
      'CSS deve conter classe .ath-livro-capa-verso'
    );
    assert.ok(
      cssContent.includes('rotateY(180deg)'),
      'Verso deve ser rotacionado 180deg no CSS'
    );
  });
});
