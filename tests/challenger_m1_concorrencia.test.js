// SPDX-License-Identifier: GPL-3.0-or-later
import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EstudoArtigosView } from '../src/ui/athenes_estudo_artigos.js';
import {
  criarBookReferenceItem,
  validarBookReferenceItem,
  calcularMetricasCitacao,
  normalizarAutores,
  normalizarAno,
  normalizarTipoReferencia,
  agruparPorPastas,
  STATUS_LEITURA,
  CORES_CAPA_PADRAO
} from '../src/core/athenes_referencias.js';

// Setup de Mocks Globais para Ambiente Node
const mapStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mapStorage.get(k) ?? null,
  setItem: (k, v) => mapStorage.set(k, String(v)),
  removeItem: (k) => mapStorage.delete(k),
  clear: () => mapStorage.clear(),
  get length() { return mapStorage.size; }
};

globalThis.document = {
  querySelector: () => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    remove: () => {}
  }),
  body: {
    appendChild: () => {}
  }
};

/**
 * Cria elemento DOM simulado para testes de botões e estados CSS
 */
function criarMockBotao({
  ehIcone = true,
  classes = ['rm-ic-bt', 'rm-ic-primario'],
  title = 'Salvar alterações',
  ariaLabel = 'Salvar',
  temSpan = false,
  spanTexto = 'Sincronizar agora'
} = {}) {
  const classListSet = new Set(classes);
  const attrs = new Map([
    ['title', title],
    ['aria-label', ariaLabel]
  ]);

  let _innerHTML = ehIcone ? '<svg width="16" height="16"><path d="M0 0h16v16H0z"/></svg>' : '';
  let _textContent = null;
  let _disabled = false;

  const mockSpan = temSpan ? {
    tagName: 'SPAN',
    _texto: spanTexto,
    get textContent() { return this._texto; },
    set textContent(v) { this._texto = String(v); }
  } : null;

  const btn = {
    tagName: 'BUTTON',
    _svgOriginal: ehIcone ? '<svg width="16" height="16"><path d="M0 0h16v16H0z"/></svg>' : '',
    _span: mockSpan,
    get classList() {
      return {
        add: (...cls) => cls.forEach(c => classListSet.add(c)),
        remove: (...cls) => cls.forEach(c => classListSet.delete(c)),
        contains: (c) => classListSet.has(c),
        get value() { return [...classListSet].join(' '); }
      };
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, val) => attrs.set(name, String(val)),
    removeAttribute: (name) => attrs.delete(name),
    hasAttribute: (name) => attrs.has(name),
    get title() { return attrs.get('title') || ''; },
    set title(val) { attrs.set('title', String(val)); },
    get disabled() { return _disabled; },
    set disabled(val) { _disabled = Boolean(val); },
    get innerHTML() { return _innerHTML; },
    set innerHTML(val) {
      _innerHTML = String(val);
      _textContent = null;
    },
    get textContent() {
      if (_textContent !== null) return _textContent;
      return _innerHTML.replace(/<[^>]*>/g, '');
    },
    set textContent(val) {
      _textContent = String(val);
      _innerHTML = String(val);
    },
    querySelector: (sel) => {
      if (sel === 'span') return mockSpan;
      if (sel === 'svg' && _innerHTML.includes('<svg')) {
        return { tagName: 'SVG', width: 16, height: 16 };
      }
      return null;
    },
    style: {}
  };

  return btn;
}

describe('M1 Challenger — Testes Adversariais de Concorrência e Estados de Interface', () => {

  beforeEach(() => {
    mapStorage.clear();
  });

  // ==========================================================================
  // SUITE 1: CONCORRÊNCIA, REENTRÂNCIA E BLOQUEIO DO BOTÃO DE SALVAR
  // ==========================================================================
  describe('1. Bloqueio de Concorrência e Reentrância em sincronizarArtigoComDriveEZotero', () => {

    it('1.1. Disparo de 50 chamadas simultâneas (Promise.all): exatamente 1 executa e 49 são rejeitadas/ignoradas pelo lock', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_concorrente_1', titulo: 'Concorrência de Salvamento' };
      const btn = criarMockBotao({ ehIcone: true });

      let execucoesReais = 0;
      const originalSincronizar = view.sincronizarArtigoComDriveEZotero;

      // Monitora quantas vezes o corpo realmente continuou além do guard clause
      view.sincronizarArtigoComDriveEZotero = async function(...args) {
        if (this._sincronizandoArtigo) {
          // Bloqueado pelo lock
          return;
        }
        execucoesReais++;
        return originalSincronizar.apply(this, args);
      };

      // Dispara 50 chamadas simultâneas concorrentes
      const promessas = Array.from({ length: 50 }, () =>
        view.sincronizarArtigoComDriveEZotero(art, btn)
      );

      await Promise.all(promessas);

      assert.equal(execucoesReais, 1, 'Exatamente 1 chamada deve passar pela guarda de concorrência');
      assert.equal(view._sincronizandoArtigo, false, 'Lock deve ser destravado (_sincronizandoArtigo = false) ao final');
    });

    it('1.2. Reentrância assíncrona: chamada secundária disparada durante o ciclo é bloqueada', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_reentrante_1', titulo: 'Teste de Reentrância' };
      const btn = criarMockBotao({ ehIcone: true });

      let chamadaReentranteExecutada = false;

      // Cria proxy para simular um serviço demorado que tenta reentrar
      view.temZoteroConectado = () => {
        // No meio da execução, tenta chamar sincronizar novamente
        const resultadoReentrancia = view.sincronizarArtigoComDriveEZotero(art, btn);
        chamadaReentranteExecutada = true;
        assert.equal(view._sincronizandoArtigo, true, 'Lock deve estar ativo durante o ciclo');
        return false;
      };

      await view.sincronizarArtigoComDriveEZotero(art, btn);

      assert.equal(chamadaReentranteExecutada, true);
      assert.equal(view._sincronizandoArtigo, false, 'Lock deve ser liberado no final do ciclo pai');
    });

    it('1.3. Recuperação de falha: se ocorrer exceção no fluxo, o lock é liberado pelo finally e o botão vai para .ath-salvar-erro', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => {
        throw new Error('Falha catastrófica de rede simulada');
      };

      const art = { id: 'art_erro_1', titulo: 'Teste de Erro de Concorrência' };
      const btn = criarMockBotao({ ehIcone: true });

      await view.sincronizarArtigoComDriveEZotero(art, btn);

      assert.equal(view._sincronizandoArtigo, false, 'O finally DEVE resetar _sincronizandoArtigo para false mesmo após erro');
      assert.equal(btn.classList.contains('ath-salvar-erro'), true, 'Botão deve entrar no estado de erro .ath-salvar-erro');
      assert.equal(btn.classList.contains('ath-salvando'), false, 'Não pode manter a classe .ath-salvando');
    });

    it('1.4. Chamadas sequenciais legítimas: após o término de uma, a próxima executa normalmente', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_seq_1', titulo: 'Teste Sequencial' };
      const btn = criarMockBotao({ ehIcone: true });

      await view.sincronizarArtigoComDriveEZotero(art, btn);
      assert.equal(view._sincronizandoArtigo, false);
      assert.equal(btn.classList.contains('ath-salvo'), true);

      // Segunda chamada após a conclusão da primeira
      await view.sincronizarArtigoComDriveEZotero(art, btn);
      assert.equal(view._sincronizandoArtigo, false);
      assert.equal(btn.classList.contains('ath-salvo'), true);
    });

    it('1.5. Resiliência a parâmetros nulos (btnEl = null, statusEl = null)', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_null_1', titulo: 'Teste Parâmetros Nulos' };

      // Não pode lançar exceção
      await assert.doesNotReject(async () => {
        await view.sincronizarArtigoComDriveEZotero(art, null, null);
      });
      assert.equal(view._sincronizandoArtigo, false);
    });
  });

  // ==========================================================================
  // SUITE 2: MÁQUINA DE ESTADOS CSS E INTEGRIDADE DO DOM
  // ==========================================================================
  describe('2. Máquina de Estados CSS e Integridade do DOM dos Botões', () => {

    it('2.1. Botões de ícone (.rm-ic-bt): NUNCA recebem textContent e preservam o nó SVG intacto', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_dom_1', titulo: 'Preservação de DOM' };
      const btn = criarMockBotao({ ehIcone: true, classes: ['rm-ic-bt', 'rm-ic-primario'] });

      const svgOriginal = btn.querySelector('svg');
      assert.ok(svgOriginal, 'Botão de ícone deve iniciar com nó SVG');

      // Intercepta e verifica o DOM durante o salvamento
      let verificadoDuranteSalvando = false;
      view.temZoteroConectado = () => {
        verificadoDuranteSalvando = true;
        assert.equal(btn.classList.contains('ath-salvando'), true);
        assert.equal(btn.getAttribute('aria-busy'), 'true');
        assert.equal(btn.getAttribute('title'), 'Salvando alterações...');
        assert.equal(btn.getAttribute('aria-label'), 'Salvando alterações...');
        // CRÍTICO: textContent não pode ter sido preenchido com 'Salvando...'
        assert.ok(!btn.textContent.includes('Salvando...'), 'Botão circular NÃO pode receber texto "Salvando..."');
        assert.ok(btn.querySelector('svg') !== null, 'Nó SVG deve permanecer íntegro dentro do botão');
        return false;
      };

      await view.sincronizarArtigoComDriveEZotero(art, btn);

      assert.equal(verificadoDuranteSalvando, true);
      // Estado salvo
      assert.equal(btn.classList.contains('ath-salvo'), true);
      assert.equal(btn.classList.contains('ath-salvando'), false);
      assert.equal(btn.hasAttribute('aria-busy'), false);
      assert.equal(btn.getAttribute('title'), 'Salvo com sucesso!');
      assert.equal(btn.getAttribute('aria-label'), 'Salvo com sucesso!');
      assert.ok(!btn.textContent.includes('Salvo ✓'), 'Botão circular NÃO pode receber texto "Salvo ✓"');
      assert.ok(btn.querySelector('svg') !== null, 'Nó SVG continua preservado');
    });

    it('2.2. Restauração do estado original após timer de sucesso (1800ms)', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_timer_1', titulo: 'Teste de Timer' };
      const btn = criarMockBotao({
        ehIcone: true,
        title: 'Título Original do Botão',
        ariaLabel: 'Aria Label Original'
      });

      await view.sincronizarArtigoComDriveEZotero(art, btn);

      assert.equal(btn.classList.contains('ath-salvo'), true);
      assert.ok(view._timerFeedbackSalvar !== null, 'Timer de feedback deve estar agendado');

      // Avança o timer aguardando 1850ms
      await new Promise(res => setTimeout(res, 1850));

      assert.equal(btn.classList.contains('ath-salvo'), false, 'Classe .ath-salvo deve ser removida');
      assert.equal(btn.getAttribute('title'), 'Título Original do Botão', 'Title deve retornar ao valor original');
      assert.equal(btn.getAttribute('aria-label'), 'Aria Label Original', 'Aria-label deve retornar ao valor original');
      assert.equal(view._timerFeedbackSalvar, null, 'Timer deve ser limpo');
    });

    it('2.3. Restauração do estado original após timer de erro (3000ms)', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => { throw new Error('Falha simulada'); };

      const art = { id: 'art_timer_erro', titulo: 'Teste de Timer de Erro' };
      const btn = criarMockBotao({
        ehIcone: true,
        title: 'Meu Botão',
        ariaLabel: 'Meu Botão'
      });

      await view.sincronizarArtigoComDriveEZotero(art, btn);

      assert.equal(btn.classList.contains('ath-salvar-erro'), true);
      assert.ok(view._timerFeedbackSalvar !== null);

      // Avança o timer de erro aguardando 3050ms
      await new Promise(res => setTimeout(res, 3050));

      assert.equal(btn.classList.contains('ath-salvar-erro'), false, 'Classe .ath-salvar-erro deve ser removida');
      assert.equal(btn.getAttribute('title'), 'Meu Botão');
      assert.equal(btn.getAttribute('aria-label'), 'Meu Botão');
      assert.equal(view._timerFeedbackSalvar, null);
    });

    it('2.4. Cancelamento de timer anterior (preempção) em sincronização consecutiva', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_preemp_1', titulo: 'Teste de Preempção' };
      const btn = criarMockBotao({ ehIcone: true });

      // Primeira sincronização (conclui e agenda timer)
      await view.sincronizarArtigoComDriveEZotero(art, btn);
      const timerOriginal = view._timerFeedbackSalvar;
      assert.ok(timerOriginal !== null);

      // Espera 200ms e inicia segunda sincronização enquanto timer ainda está ativo
      await new Promise(res => setTimeout(res, 200));
      await view.sincronizarArtigoComDriveEZotero(art, btn);

      const novoTimer = view._timerFeedbackSalvar;
      assert.notEqual(novoTimer, timerOriginal, 'O timer anterior deve ter sido cancelado e substituído');
      assert.equal(btn.classList.contains('ath-salvo'), true);
    });

    it('2.5. Botões regulares com span (Não-Ícone): recebem texto e disabled sem usar classes circulares', async () => {
      const view = Object.create(EstudoArtigosView.prototype);
      view.artigos = [];
      view._sincronizandoArtigo = false;
      view.temZoteroConectado = () => false;

      const art = { id: 'art_btn_texto', titulo: 'Botão de Texto' };
      const btn = criarMockBotao({
        ehIcone: false,
        classes: ['ath-btn', 'ath-btn-primary'],
        temSpan: true,
        spanTexto: 'Sincronizar agora'
      });

      let verificadoSalvando = false;
      view.temZoteroConectado = () => {
        verificadoSalvando = true;
        assert.equal(btn.disabled, true);
        assert.equal(btn._span.textContent, 'Salvando...');
        assert.equal(btn.classList.contains('ath-salvando'), false, 'Não deve adicionar .ath-salvando em botões de texto');
        return false;
      };

      await view.sincronizarArtigoComDriveEZotero(art, btn);

      assert.equal(verificadoSalvando, true);
      assert.equal(btn.disabled, false);
      assert.equal(btn._span.textContent, 'Salvo ✓');
    });
  });

  // ==========================================================================
  // SUITE 3: AUDITORIA DE REGRAS CSS E GEOMETRIA CIRCULAR DE 34PX
  // ==========================================================================
  describe('3. Auditoria Estática de Regras CSS e Geometria Circular de 34px', () => {

    const cssPath = resolve('src/css/athenes_editor.css');
    const cssConteudo = readFileSync(cssPath, 'utf8');

    it('3.1. Regra .rm-ic-bt define geometria circular e dimensões de 34px/36px com flex: none', () => {
      assert.ok(cssConteudo.includes('.rm-barra-blocos .rm-ic-bt { width: 34px; height: 34px; }'),
        'Barra de blocos deve fixar width: 34px; height: 34px;');
      assert.ok(cssConteudo.includes('border-radius: 50%'),
        'rm-ic-bt deve ter border-radius: 50%;');
    });

    it('3.2. Regra .ath-salvando::before implementa spinner concêntrico com inset: 2px e border-radius: 50%', () => {
      assert.ok(cssConteudo.includes('inset: 2px'), 'Spinner deve usar inset: 2px concêntrico');
      assert.ok(cssConteudo.includes('border-radius: 50%'), 'Spinner deve ser 50% circular');
      assert.ok(cssConteudo.includes('animation: ath-spinner-salvar 0.8s linear infinite'),
        'Deve ter animação contínua linear infinita');
      assert.ok(cssConteudo.includes('box-sizing: border-box'), 'Deve usar box-sizing border-box');
      assert.ok(cssConteudo.includes('pointer-events: none'), 'Spinner pseudo-elemento não pode interceptar ponteiro');
    });

    it('3.3. Regra .ath-salvando define pointer-events: none para proteção em nível de CSS', () => {
      assert.ok(cssConteudo.includes('pointer-events: none !important'),
        '.ath-salvando deve ter pointer-events: none !important para bloquear cliques duplos');
    });

    it('3.4. Regras .ath-salvo e .ath-salvar-erro mantêm cores canônicas e feedback visual', () => {
      assert.ok(cssConteudo.includes('background: #15803D !important'),
        '.ath-salvo deve ter verde editorial #15803D');
      assert.ok(cssConteudo.includes('background: #B91C1C !important'),
        '.ath-salvar-erro deve ter vermelho editorial #B91C1C');
      assert.ok(cssConteudo.includes('ath-shake-salvar'),
        '.ath-salvar-erro deve ter animação de shake horizontal');
    });
  });

  // ==========================================================================
  // SUITE 4: ESTRESSE ADVERSARIAL NO MODELO BookReferenceItem E MÉTRICAS (R5)
  // ==========================================================================
  describe('4. Estresse Adversarial no Modelo BookReferenceItem e Métricas de Citação', () => {

    it('4.1. Concorrência e volume: 200 cálculos concorrentes de métricas não causam vazamento de dados', async () => {
      const refA = criarBookReferenceItem({ id: 'ref_concorrente_A', titulo: 'Obra Alfa', chaveZotero: 'CHAVE_A' });
      const refB = criarBookReferenceItem({ id: 'ref_concorrente_B', titulo: 'Obra Beta', chaveZotero: 'CHAVE_B' });

      const documentoAtivo = {
        id: 'doc_1',
        secoes: [
          {
            id: 'sec_1',
            titulo: 'Introdução',
            blocos: [
              { tipo: 'paragrafo', texto: 'Texto citando <a class="ath-citacao-link" data-ref-id="ref_concorrente_A">Alfa</a>.' },
              { tipo: 'citacao', ref_id: 'ref_concorrente_B', texto: 'Citação direta de Beta' }
            ]
          }
        ]
      };

      // Dispara 200 chamadas concorrentes alternando entre as referências
      const tarefas = Array.from({ length: 200 }, (_, i) => {
        const refAlvo = i % 2 === 0 ? refA : refB;
        return Promise.resolve(calcularMetricasCitacao(refAlvo, { documentoAtivo }));
      });

      const resultados = await Promise.all(tarefas);

      for (let i = 0; i < resultados.length; i++) {
        const res = resultados[i];
        if (i % 2 === 0) {
          assert.equal(res.totalCitationsCount, 1, 'Ref A deve ter 1 citação');
          assert.deepEqual(res.citedInDocumentIds, ['doc_1']);
          assert.ok(res.citedInSections.includes('Introdução'));
        } else {
          assert.equal(res.totalCitationsCount, 1, 'Ref B deve ter 1 citação');
          assert.deepEqual(res.citedInDocumentIds, ['doc_1']);
          assert.ok(res.citedInSections.includes('Introdução'));
        }
      }
    });

    it('4.2. Entradas adversárias extremas em normalizarAutores: XSS, unicode e strings gigantes', () => {
      // Vetor XSS em autor
      const autoresXss = normalizarAutores({ autores: '<script>alert("xss")</script>, João' });
      assert.equal(autoresXss[0].sobrenome, '<script>alert("xss")</script>');
      assert.equal(autoresXss[0].prenome, 'João');

      // String com 5000 caracteres
      const autorLongo = 'A'.repeat(5000);
      const resLongo = normalizarAutores({ autores: `${autorLongo}, Pedro` });
      assert.equal(resLongo[0].sobrenome.length, 5000);
      assert.equal(resLongo[0].prenome, 'Pedro');

      // Nomes com caracteres especiais e acentuação internacional
      const autorEspecial = normalizarAutores({ autores: 'Kowalski-Ñandú, François D’Artagnan' });
      assert.equal(autorEspecial[0].sobrenome, 'Kowalski-Ñandú');
      assert.equal(autorEspecial[0].prenome, 'François D’Artagnan');
    });

    it('4.3. Entradas adversárias em normalizarAno: anos inválidos, limites e sufixos', () => {
      assert.equal(normalizarAno({ ano: 2026 }), '2026');
      assert.equal(normalizarAno({ ano: '2024b' }), '2024b');
      assert.equal(normalizarAno({ ano: '2024-2025' }), '2024');
      assert.equal(normalizarAno({ data: '2023-11-08T05:00:00Z' }), '2023');
      assert.equal(normalizarAno({ ano: 's.d.' }), 's.d.');
      assert.equal(normalizarAno({ ano: 'Sem data' }), 's.d.');
      assert.equal(normalizarAno({ ano: '' }), 's.d.');
      assert.equal(normalizarAno(null), 's.d.');
    });

    it('4.4. Validador validarBookReferenceItem rejeita estruturas gravemente malformadas', () => {
      // Sem título
      const semTitulo = validarBookReferenceItem(criarBookReferenceItem({ titulo: '' }));
      assert.equal(semTitulo.valido, false);
      assert.ok(semTitulo.erros.some(e => e.includes('titulo')));

      // Tipo inválido atribuído diretamente
      const itemTipoInvalido = criarBookReferenceItem({ titulo: 'Válido' });
      itemTipoInvalido.tipo = 'inexistente_tipo';
      const tipoInvalido = validarBookReferenceItem(itemTipoInvalido);
      assert.equal(tipoInvalido.valido, false);
      assert.ok(tipoInvalido.erros.some(e => e.includes('tipo')));

      // Status inválido atribuído diretamente
      const itemStatusInvalido = criarBookReferenceItem({ titulo: 'Válido' });
      itemStatusInvalido.statusLeitura = 'status_fantasma';
      const statusInvalido = validarBookReferenceItem(itemStatusInvalido);
      assert.equal(statusInvalido.valido, false);
      assert.ok(statusInvalido.erros.some(e => e.includes('statusLeitura')));
    });

    it('4.5. Agrupamento agruparPorPastas com 1000 referências e pastas heterogêneas', () => {
      const itens = Array.from({ length: 1000 }, (_, i) =>
        criarBookReferenceItem({
          id: `ref_vol_${i}`,
          titulo: `Livro Volume ${i}`,
          pastaId: i % 3 === 0 ? 'pasta_urbanismo' : (i % 3 === 1 ? 'pasta_direito' : 'pasta_orfao_inexistente')
        })
      );

      const pastas = [
        { id: 'pasta_urbanismo', nome: 'Urbanismo', cor: '#314F79' },
        { id: 'pasta_direito', nome: 'Direito', cor: '#FF6B2C' }
      ];

      const mapa = agruparPorPastas(itens, pastas);

      // 'todas' deve conter as 1000
      assert.equal(mapa.get('todas').total, 1000);

      // Pastas temáticas
      assert.ok(mapa.get('pasta_urbanismo').total > 0);
      assert.ok(mapa.get('pasta_direito').total > 0);

      // Itens órfãos (pasta_orfao_inexistente) devem ter sido roteados para 'pasta_bib_raiz'
      const raiz = mapa.get('pasta_bib_raiz');
      assert.ok(raiz !== undefined, 'Deve criar a pasta raiz para órfãos');
      assert.ok(raiz.total > 0, 'Deve agrupar os órfãos na pasta raiz');
    });
  });

});
