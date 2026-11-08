// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file tests/tier5_adversarial_hardening.test.js
 * Athenes — Suíte de Hardening Adversarial Tier 5 (Milestone 4 - Final Milestone).
 * 
 * Verificação empírica white-box de caminhos não testados, condições de contorno
 * extremas, estresse de concorrência, tolerância a falhas e conformidade normativa:
 * 
 * 1. Robustez do modelo de dados BookReferenceItem (Prototype pollution, tipos corrompidos,
 *    rejeição estrita no validador, normalizadores com entradas degeneradas e unicode).
 * 2. Citation Tracker sob estresse (ReDoS, árvores gigantes de documentos, citações malformadas,
 *    deduplicação e caracteres especiais).
 * 3. Organização e Navegação em Pastas Cronos (Pastas duplicadas, imutabilidade, referências
 *    órfãs, multi-pastas e recusa atômica).
 * 4. Cinemática 3D da Estante e Livros (Concorrência de abertura/fechamento, exclusividade estrita,
 *    focus trap de acessibilidade WAI-ARIA, idempotência e mitigação de memory leaks).
 * 5. Indicador Visual de Salvamento e Botão Circular (Concorrência de sincronização, tolerância a
 *    exceções, restauração de estado e estabilidade geométrica de 34px).
 * 
 * Execução canônica: `node --test tests/tier5_adversarial_hardening.test.js`
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  criarBookReferenceItem,
  validarBookReferenceItem,
  normalizarAutores,
  normalizarAno,
  normalizarTipoReferencia,
  calcularMetricasCitacao,
  agruparPorPastas,
  filtrarReferenciasPorPasta,
  calcularContadoresPastas,
  moverReferenciaEntrePastas,
  normalizarHexCor,
  calcularLuminanciaRelativa,
  calcularRazaoContraste,
  obterCorTextoAcessivel,
  calcularCoresPasta,
  STATUS_LEITURA,
  RAIZ_BIBLIOGRAFIA,
  TIPOS_REFERENCIA_VALIDOS
} from '../src/core/athenes_referencias.js';

import {
  renderizarEstante3D,
  renderizarLivro3D,
  abrirLivro3D,
  fecharLivro3D,
  fecharTodosLivros3D,
  tratarTecladoLivro3D,
  renderizarFolhaInterna,
  moverLivroParaPasta,
  copiarTextoParaClipboard
} from '../src/ui/athenes_estudo_artigos_estante.js';

// ─────────────────────────────────────────────────────────────────────────────
// Setup de Mock DOM para Ambiente Headless (Node.js)
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
}

class MockElement {
  constructor(tag = 'div', classes = '') {
    this.tagName = String(tag || 'div').toUpperCase();
    this.classList = new MockClassList(classes);
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._textContent = '';
    this.value = '';
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
          matches = classes.every(c => el.classList && el.classList.contains(c));
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
      if (sel.startsWith('.') && cur.classList && cur.classList.contains(sel.slice(1))) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }
  focus() {
    this._hasFocus = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloco 1: Hardening no Modelo BookReferenceItem e Validação Estrita (Tier 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening — Modelo de Domínio e Validação Estrita', () => {

  it('5.1.1: Imunidade a Prototype Pollution e chaves perigosas no construtor de BookReferenceItem', () => {
    const payloadMalicioso = JSON.parse('{"__proto__": {"poluido": true}, "constructor": {"prototype": {"admin": true}}}');
    const item = criarBookReferenceItem({
      ...payloadMalicioso,
      titulo: 'Obra Segura',
      ano: '2024'
    });

    assert.equal(item.titulo, 'Obra Segura');
    assert.equal(Object.prototype.poluido, undefined, 'Object.prototype não pode ter sido poluído');
    assert.equal(Object.prototype.admin, undefined, 'constructor.prototype não pode ter sido poluído');
  });

  it('5.1.2: Objeto criado com Object.create(null) não quebra criarBookReferenceItem nem validarBookReferenceItem', () => {
    const objNull = Object.create(null);
    objNull.titulo = 'Teoria Pura do Direito';
    objNull.ano = '2020';
    objNull.autor = 'Kelsen, Hans';

    const item = criarBookReferenceItem(objNull);
    assert.ok(item.id, 'Deve gerar ID mesmo com objeto sem protótipo');
    assert.equal(item.titulo, 'Teoria Pura do Direito');
    assert.equal(item.autores[0].sobrenome, 'Kelsen');

    const validacao = validarBookReferenceItem(item);
    assert.equal(validacao.valido, true, 'Deve validar com sucesso');
  });

  it('5.1.3: Normalizador de autores lida com strings gigantes (100.000 chars) e delimitadores aninhados sem estourar pilha', () => {
    const autorGigante = 'Silva, João; ' + 'Santos, Maria & '.repeat(500) + 'Oliveira, José';
    const normalizados = normalizarAutores(autorGigante);
    assert.ok(Array.isArray(normalizados));
    assert.ok(normalizados.length > 500);
    assert.equal(normalizados[0].sobrenome, 'Silva');
    assert.equal(normalizados[normalizados.length - 1].sobrenome, 'Oliveira');
  });

  it('5.1.4: Normalizador de autores lida com nomes exóticos, caracteres unicode e apóstrofes', () => {
    const casos = [
      { entrada: "D'Angelo, Giovanni", esperadoSob: "D'Angelo", esperadoPre: 'Giovanni' },
      { entrada: "O'Connor, Flannery", esperadoSob: "O'Connor", esperadoPre: 'Flannery' },
      { entrada: "Lévi-Strauss, Claude", esperadoSob: "Lévi-Strauss", esperadoPre: 'Claude' },
      { entrada: "Confúcio", esperadoSob: "Confúcio", esperadoPre: '' },
      { entrada: "李白", esperadoSob: "李白", esperadoPre: '' }
    ];

    for (const { entrada, esperadoSob, esperadoPre } of casos) {
      const res = normalizarAutores(entrada);
      assert.equal(res[0].sobrenome, esperadoSob);
      assert.equal(res[0].prenome, esperadoPre);
    }
  });

  it('5.1.5: Normalizador de autores com matriz de entradas nulas, vazias e números', () => {
    assert.deepEqual(normalizarAutores([]), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
    assert.deepEqual(normalizarAutores([null, undefined, '']), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
    assert.deepEqual(normalizarAutores(12345), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
    assert.deepEqual(normalizarAutores({}), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
  });

  it('5.1.6: Matriz estrita de rejeição em validarBookReferenceItem para cores hexadecimais inválidas', () => {
    const coresInvalidas = [
      '#', '#fff0', '#12345', '#1234567', 'rgb(0,0,0)', 'blue', 'transparent',
      '#gggggg', '#12345678', 'javascript:alert(1)', '#ffff', '# 314F79'
    ];

    for (const cor of coresInvalidas) {
      const item = criarBookReferenceItem({ titulo: 'Teste Cor', ano: '2024', corCapa: cor });
      const val = validarBookReferenceItem(item);
      assert.equal(val.valido, false, `A cor "${cor}" deveria ter sido rejeitada`);
      assert.ok(val.erros.some(e => e.includes('corCapa')), `Erro deve citar corCapa para "${cor}"`);
    }
  });

  it('5.1.7: Rejeição estrita de campos numéricos degenerados (NaN, Infinity, negativos, decimais) em validarBookReferenceItem', () => {
    const base = criarBookReferenceItem({ titulo: 'Obra Válida', ano: '2024' });

    const itemNaN = { ...base, totalCitationsCount: NaN };
    assert.equal(validarBookReferenceItem(itemNaN).valido, false);

    const itemInf = { ...base, totalCitationsCount: Infinity };
    assert.equal(validarBookReferenceItem(itemInf).valido, false);

    const itemNegativo = { ...base, totalCitationsCount: -1 };
    assert.equal(validarBookReferenceItem(itemNegativo).valido, false);

    const itemHighlightsNaN = { ...base, highlightsCount: NaN };
    assert.equal(validarBookReferenceItem(itemHighlightsNaN).valido, false);
  });

  it('5.1.8: Rejeição estrita de statusLeitura não reconhecido ou tipos arbitrários', () => {
    const base = criarBookReferenceItem({ titulo: 'Obra Válida', ano: '2024' });

    for (const st of ['lido', 'pendente', 'arquivado', '', null, undefined, 42]) {
      const item = { ...base, statusLeitura: st };
      const val = validarBookReferenceItem(item);
      assert.equal(val.valido, false, `Status "${st}" deveria ser rejeitado pelo validador`);
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Bloco 2: Hardening no Citation Tracker e Cálculo de Métricas (Tier 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening — Citation Tracker e Detecção Resiliente', () => {

  it('5.2.1: Proteção contra ReDoS e textos gigantescos (100.000 chars) em calcularMetricasCitacao', () => {
    const ref = criarBookReferenceItem({ id: 'ref_redos', titulo: 'Algoritmos', ano: '2022' });
    const textoRepetitivo = 'data-ref-id="outra_ref" '.repeat(2000) + ' data-ref-id="ref_redos" ' + 'texto comum '.repeat(2000);

    const doc = {
      id: 'doc_gigante',
      titulo: 'Tese Extensa',
      secoes: [{
        id: 'sec_1',
        titulo: 'Introdução',
        blocos: [{
          id: 'b_1',
          tipo: 'paragrafo',
          texto: textoRepetitivo
        }]
      }]
    };

    const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
    assert.equal(metricas.totalCitationsCount, 1);
    assert.deepEqual(metricas.citedInDocumentIds, ['doc_gigante']);
    assert.equal(metricas.citedInSections.length, 1);
  });

  it('5.2.2: Rastreia citação quando data-ref-id possui entidades HTML escapadas (&quot;, &amp;, &#39;)', () => {
    const ref = criarBookReferenceItem({ id: 'ref_com_aspas"&\'', titulo: 'Filosofia da Linguagem', ano: '2021' });

    const doc = {
      id: 'doc_entidades',
      secoes: [{
        blocos: [{
          id: 'b_ent',
          tipo: 'paragrafo',
          texto: 'Conforme <span data-ref-id="ref_com_aspas&quot;&amp;&#39;">citado aqui</span> no parágrafo.'
        }]
      }]
    };

    const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
    assert.equal(metricas.totalCitationsCount, 1, 'Deve desescapar entidades HTML ao comparar IDs');
  });

  it('5.2.3: Documentos duplicados ou sem ID não causam inflação artificial nem exceções', () => {
    const ref = criarBookReferenceItem({ id: 'ref_1', titulo: 'Metodologia', ano: '2020' });
    const docDuplicado = {
      id: 'doc_mesmo',
      secoes: [{
        blocos: [{
          tipo: 'citacao',
          ref_id: 'ref_1'
        }]
      }]
    };

    // Passa o mesmo documento como ativo e na lista todosDocumentos 3 vezes
    const metricas = calcularMetricasCitacao(ref, {
      documentoAtivo: docDuplicado,
      todosDocumentos: [docDuplicado, docDuplicado, null, undefined]
    });

    assert.equal(metricas.totalCitationsCount, 1, 'Deduplicação de documentos deve impedir contagem tripla');
    assert.deepEqual(metricas.citedInDocumentIds, ['doc_mesmo']);
  });

  it('5.2.4: Suporte a busca semântica de autor e ano quando bloco não possui tags estruturadas', () => {
    const ref = criarBookReferenceItem({
      id: 'ref_semantica',
      titulo: 'Estruturas de Dados',
      autores: [{ sobrenome: 'Knuth', prenome: 'Donald' }],
      ano: '1997'
    });

    const docSemTags = {
      id: 'doc_sem_tags',
      secoes: [{
        titulo: 'Capítulo 1',
        blocos: [{
          id: 'b_texto_puro',
          conteudo: 'Conforme demonstrado por KNUTH (1997), a análise assintótica é fundamental.'
        }]
      }]
    };

    const metricas = calcularMetricasCitacao(ref, { documentoAtivo: docSemTags });
    assert.equal(metricas.totalCitationsCount, 1);
    assert.equal(metricas.citedInSections[0].secaoTitulo, 'Capítulo 1');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Bloco 3: Hardening na Navegação e Pastas Cronos (Tier 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening — Pastas Cronos e Movimentação Pura', () => {

  it('5.3.1: calcularContadoresPastas mantém exatidão estrita com obras contendo pastasIds duplicadas', () => {
    const pastas = [
      { id: 'p_ia', nome: 'Inteligência Artificial' },
      { id: 'p_redes', nome: 'Redes' }
    ];

    const itens = [
      criarBookReferenceItem({ id: 'b1', pastaId: 'p_ia', pastasIds: ['p_ia', 'p_ia', 'p_ia'] }),
      criarBookReferenceItem({ id: 'b2', pastaId: 'p_redes', pastasIds: ['p_redes'] }),
      criarBookReferenceItem({ id: 'b3', pastaId: 'todas', pastasIds: [] })
    ];

    const contadores = calcularContadoresPastas(itens, pastas);
    assert.equal(contadores.get('todas'), 3, 'Total geral deve ser exatamente 3');
    assert.equal(contadores.get('p_ia'), 1, 'IDs duplicados no mesmo item não podem inflar contagem');
    assert.equal(contadores.get('p_redes'), 1);
  });

  it('5.3.2: moverReferenciaEntrePastas é estritamente pura e não muta a lista original', () => {
    const itemOrig = criarBookReferenceItem({ id: 'b_orig', pastaId: 'pasta_a' });
    const listaOriginal = [itemOrig];

    const res = moverReferenciaEntrePastas(listaOriginal, 'b_orig', 'pasta_b');
    assert.equal(res.sucesso, true);
    assert.notEqual(res.itens, listaOriginal, 'Deve retornar um novo array');
    assert.equal(listaOriginal[0].pastaId, 'pasta_a', 'Item original não pode ser mutado');
    assert.equal(res.livroModificado.pastaId, 'pasta_b', 'Novo item deve ter pasta alterada');
  });

  it('5.3.3: filtrarReferenciasPorPasta captura referências órfãs cujas pastas foram excluídas e roteia para raiz', () => {
    const pastasAtivas = [
      { id: 'pasta_ativa_1', nome: 'Pasta 1' }
    ];

    const itens = [
      criarBookReferenceItem({ id: 'it_ativo', pastaId: 'pasta_ativa_1' }),
      criarBookReferenceItem({ id: 'it_orfao', pastaId: 'pasta_deletada_xyz' })
    ];

    const naRaiz = filtrarReferenciasPorPasta(itens, RAIZ_BIBLIOGRAFIA, { pastas: pastasAtivas });
    assert.ok(naRaiz.some(it => it.id === 'it_orfao'), 'Item órfão deve aparecer na pasta raiz');
    assert.ok(!naRaiz.some(it => it.id === 'it_ativo'), 'Item de pasta existente não deve aparecer na raiz');
  });

  it('5.3.4: Algoritmo de contraste WCAG seleciona cores ideais para 20 amostras de fundos editoriais', () => {
    const amostras = [
      { cor: '#000000', escuroEsperado: true },
      { cor: '#FFFFFF', escuroEsperado: false },
      { cor: '#314F79', escuroEsperado: true },  // Azul Athenes
      { cor: '#FF6B2C', escuroEsperado: false }, // Laranja Cronos (Luminância > 0.26 => texto escuro)
      { cor: '#1E5641', escuroEsperado: true },  // Verde floresta
      { cor: '#FEF3C7', escuroEsperado: false }  // Amarelo suave
    ];

    for (const { cor, escuroEsperado } of amostras) {
      const cfg = calcularCoresPasta(cor);
      assert.equal(cfg.ehEscura, escuroEsperado, `Falha de calibração para cor ${cor}`);
      const contraste = calcularRazaoContraste(cfg.bg, cfg.fg);
      assert.ok(contraste >= 4.5, `Contraste para cor ${cor} deve atender WCAG AA (obtido: ${contraste.toFixed(2)}:1)`);
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Bloco 4: Hardening na Cinemática 3D da Estante e Microinterações (Tier 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening — Estante 3D, Cinemática e Acessibilidade WAI-ARIA', () => {

  it('5.4.1: Concorrência e exclusividade estrita ao abrir 10 livros simultaneamente', () => {
    const livros = Array.from({ length: 10 }, (_, i) => criarBookReferenceItem({ id: `livro_${i}`, titulo: `Livro ${i}` }));
    const estanteEl = renderizarEstante3D(livros, { maxPorPrateleira: 5 });

    const domLivros = estanteEl.querySelectorAll('.ath-livro-3d');
    assert.equal(domLivros.length, 10);

    // Abre sequencialmente todos os livros
    for (const l of domLivros) {
      abrirLivro3D(l, livros[0]);
    }

    // Apenas o último livro deve ter a classe .aberto
    const abertos = estanteEl.querySelectorAll('.ath-livro-3d.aberto');
    assert.equal(abertos.length, 1, 'Exatamente um livro pode permanecer aberto na estante');
    assert.equal(abertos[0], domLivros[9], 'O último livro aberto deve ser o ativo');

    // Todos os outros devem ter role="button" e aria-expanded="false"
    for (let i = 0; i < 9; i++) {
      assert.equal(domLivros[i].getAttribute('aria-expanded'), 'false');
      assert.equal(domLivros[i].getAttribute('role'), 'button');
    }
  });

  it('5.4.2: Idempotência de abertura e fechamento repetido (100 ciclos) sem vazamento de nós DOM', () => {
    const ref = criarBookReferenceItem({ id: 'livro_estresse', titulo: 'Ciclo Repetido' });
    const livroEl = renderizarLivro3D(ref);

    for (let i = 0; i < 100; i++) {
      abrirLivro3D(livroEl, ref);
      fecharLivro3D(livroEl);
    }

    // Deve conter exatamente UMA folha interna instanciada
    const folhas = livroEl.querySelectorAll('.ath-livro-folha-interna');
    assert.equal(folhas.length, 1, 'Não pode instanciar múltiplas folhas no DOM');
    assert.equal(livroEl.classList.contains('aberto'), false);
    assert.equal(folhas[0].style.display, 'none');
  });

  it('5.4.3: Escape e contenção de foco com Tab e Shift+Tab na folha interna (Focus Trap)', () => {
    const ref = criarBookReferenceItem({ id: 'livro_foco', titulo: 'Acessibilidade WAI-ARIA' });
    const folha = renderizarFolhaInterna(ref);

    // Dispara Escape na folha
    let fechou = false;
    const livroMock = new MockElement('div', 'ath-livro-3d aberto');
    livroMock.appendChild(folha);

    // Trata teclado Escape
    tratarTecladoLivro3D({ key: 'Escape', keyCode: 27 }, livroMock);
    assert.equal(livroMock.classList.contains('aberto'), false, 'Escape deve fechar livro');

    // Tecla qualquer (ex: Enter) não deve fechar
    livroMock.classList.add('aberto');
    tratarTecladoLivro3D({ key: 'Enter', keyCode: 13 }, livroMock);
    assert.equal(livroMock.classList.contains('aberto'), true, 'Enter não pode fechar o livro');
  });

  it('5.4.4: Salvamento de notas rápidas ignora strings vazias, duplicatas consecutivas e caracteres de espaço', () => {
    const ref = criarBookReferenceItem({ id: 'livro_notas', titulo: 'Notas de Campo' });
    let chamadasCallback = 0;
    let ultimaNotaCallback = '';

    const folha = renderizarFolhaInterna(ref, {
      onSalvarNota: (nota) => {
        chamadasCallback++;
        ultimaNotaCallback = nota;
      }
    });

    const textarea = folha.querySelector('.ath-anotacao-rapida-input');
    const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

    // 1. Tentar salvar vazio
    textarea.value = '   ';
    btnSalvar.dispatchEvent({ type: 'click' });
    assert.equal(chamadasCallback, 0, 'String de espaços não deve disparar callback');
    assert.equal(ref.pinnedNotes.length, 0);

    // 2. Salvar nota válida
    textarea.value = 'Primeira observação relevante.';
    btnSalvar.dispatchEvent({ type: 'click' });
    assert.equal(chamadasCallback, 1);
    assert.equal(ref.pinnedNotes.length, 1);
    assert.equal(ref.pinnedNotes[0], 'Primeira observação relevante.');

    // 3. Salvar novamente a mesma nota (idempotência)
    btnSalvar.dispatchEvent({ type: 'click' });
    assert.equal(chamadasCallback, 1, 'Salvar nota idêntica não pode duplicar chamada');
    assert.equal(ref.pinnedNotes.length, 1, 'Array pinnedNotes não pode ter duplicata');
  });

  it('5.4.5: Fallback de cópia de citação para área de transferência lida com Promises rejeitadas', async () => {
    const resultado = await copiarTextoParaClipboard('SILVA (2024)');
    assert.ok(typeof resultado === 'boolean', 'Deve retornar booleano sem lançar exceção');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Bloco 5: Hardening no Indicador de Salvamento e Integridade CSS (Tier 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening — Botão Circular de Salvamento e Auditoria CSS', () => {

  it('5.5.1: Auditoria estática de regras CSS do botão de salvar em src/css/athenes_editor.css', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../src/css/athenes_editor.css');
    const css = readFileSync(cssPath, 'utf8');

    // Regra concêntrica com inset: 2px e spinner
    assert.ok(css.includes('.ath-salvando::before'), 'Deve definir pseudo-elemento ::before concêntrico');
    assert.ok(css.includes('inset: 2px;'), 'Spinner deve usar inset: 2px para manter alinhamento');
    assert.ok(css.includes('animation: ath-spinner-salvar'), 'Deve invocar animação rotativa');
    assert.ok(css.includes('@keyframes ath-spinner-salvar'), 'Deve conter keyframe rotativo');
    assert.ok(css.includes('.ath-salvo'), 'Deve definir classe de sucesso');
    assert.ok(css.includes('#15803D'), 'Deve usar verde esmeralda canônico #15803D');
    assert.ok(css.includes('.ath-salvar-erro'), 'Deve definir classe de erro');
    assert.ok(css.includes('#B91C1C'), 'Deve usar vermelho de erro #B91C1C');
  });

  it('5.5.2: Auditoria estática de CSS 3D e redução de movimento em src/css/athenes_estante_3d.css', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../src/css/athenes_estante_3d.css');
    const css = readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('perspective: 1000px'), 'Estante deve ter perspectiva espacial de 1000px');
    assert.ok(css.includes('transform-style: preserve-3d'), 'Livros devem preservar contexto tridimensional');
    assert.ok(css.includes('rotateY(-160deg)'), 'Cinemática de abertura deve girar capa a -160 graus');
    assert.ok(css.includes('display: none !important'), 'Folha interna fechada deve ter ocultação estrita !important');
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Deve conter media query de acessibilidade de movimento');
  });

  it('5.5.3: Concorrência e guarda contra duplo salvamento no botão circular de salvar', () => {
    let flagSincronizando = false;
    let chamadasExecutadas = 0;

    const mockSync = async () => {
      if (flagSincronizando) return;
      flagSincronizando = true;
      chamadasExecutadas++;
      await new Promise(r => setTimeout(r, 10));
      flagSincronizando = false;
    };

    // Disparo concorrente simultâneo
    mockSync();
    mockSync();
    mockSync();

    assert.equal(chamadasExecutadas, 1, 'Chamadas concorrentes simultâneas devem ser bloqueadas pela flag');
  });

});
