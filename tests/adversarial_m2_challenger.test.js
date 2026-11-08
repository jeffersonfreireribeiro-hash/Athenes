// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file tests/adversarial_m2_challenger.test.js
 * Athenes — Suíte de Testes Adversariais Empíricos do Milestone 2.
 * 
 * Executa estresse rigoroso, injeção de falhas, casos de borda e oráculos matemáticos:
 * 1. Pastas inexistentes, IDs nulos/vazios ou formatos corrompidos (fallback seguro para RAIZ_BIBLIOGRAFIA).
 * 2. Referências órfãs e referências multi-pastas (pastasIds: [...]).
 * 3. Movimentações circulares, idempotência e recusa atômica para pastas somente leitura.
 * 4. Teste de estresse de performance: filtrar e calcular contadores com 500+ referências em 50+ pastas (O(N), < 50ms).
 * 5. Robustez contra nomes de pastas especiais, tags HTML/script, e strings com espaços extras.
 * 6. Paridade estrita e conservação de contagens entre filtrarReferenciasPorPasta e agruparPorPastas.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  criarBookReferenceItem,
  agruparPorPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas,
  calcularContadoresPastas,
  calcularCoresPasta,
  normalizarHexCor,
  calcularLuminanciaRelativa,
  calcularRazaoContraste,
  obterCorTextoAcessivel,
  RAIZ_BIBLIOGRAFIA,
  CORES_CAPA_PADRAO
} from '../src/core/athenes_referencias.js';

import {
  renderizarPastasCronos,
  renderizarFaixaDePastas,
  renderizarBreadcrumb,
  selecionarPasta,
  restaurarPastaAtiva,
  coletarPastasBibliografia,
  CORES_PASTAS_CRONOS,
  STORAGE_KEY_BIB_PASTA_ATIVA
} from '../src/ui/athenes_estudo_artigos_pastas.js';

import { moverLivroParaPasta } from '../src/ui/athenes_estudo_artigos_estante.js';
import { escapeHtml } from '../src/core/athenes_seguranca.js';

// ---------------------------------------------------------------------------
// Mock DOM Leve para Testes de Elementos de Interface sem Dependências Externas
// ---------------------------------------------------------------------------
function criarMockElemento(tag = 'div') {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  const children = [];
  const styles = {};
  let _innerHTML = '';
  let _textContent = '';

  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    type: 'button',
    parentNode: null,
    dataset: {},

    get className() {
      return [...classes].join(' ');
    },
    set className(val) {
      classes.clear();
      String(val || '').split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },

    get classList() {
      return {
        add: (...cls) => cls.forEach(c => classes.add(c)),
        remove: (...cls) => cls.forEach(c => classes.delete(c)),
        contains: (c) => classes.has(c),
        toggle: (c) => (classes.has(c) ? classes.delete(c) : classes.add(c))
      };
    },

    get innerHTML() {
      return _innerHTML;
    },
    set innerHTML(val) {
      _innerHTML = String(val ?? '');
      _textContent = _innerHTML.replace(/<[^>]*>/g, '');
    },

    get textContent() {
      return _textContent;
    },
    set textContent(val) {
      _textContent = String(val ?? '');
      _innerHTML = String(val ?? '');
    },

    style: {
      setProperty: (k, v) => { styles[k] = String(v); },
      getPropertyValue: (k) => styles[k] || '',
      ...styles
    },

    setAttribute: (k, v) => {
      const valStr = String(v ?? '');
      attributes.set(k, valStr);
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        el.dataset[camel] = valStr;
        el.dataset[k.slice(5)] = valStr;
      }
      if (k === 'id') el.id = valStr;
    },
    getAttribute: (k) => attributes.get(k) ?? null,
    removeAttribute: (k) => {
      attributes.delete(k);
      if (k.startsWith('data-')) {
        delete el.dataset[k.slice(5)];
      }
    },
    hasAttribute: (k) => attributes.has(k),

    appendChild: (child) => {
      if (child) {
        child.parentNode = el;
        children.push(child);
      }
      return child;
    },
    contains: (child) => children.includes(child),
    remove: () => {
      if (el.parentNode) {
        const idx = el.parentNode.children.indexOf(el);
        if (idx !== -1) el.parentNode.children.splice(idx, 1);
        el.parentNode = null;
      }
    },
    get children() {
      return children;
    },

    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    dispatchEvent: (ev) => {
      const handlers = listeners.get(ev.type) || [];
      handlers.forEach(h => h(ev));
    },

    querySelector: (selector) => {
      // Busca recursiva simples por tag, classe, id ou atributo
      const buscar = (node) => {
        for (const c of node.children) {
          if (correspondeSeletor(c, selector)) return c;
          const dentro = buscar(c);
          if (dentro) return dentro;
        }
        return null;
      };
      return buscar(el);
    },
    querySelectorAll: (selector) => {
      const resultados = [];
      const coletar = (node) => {
        for (const c of node.children) {
          if (correspondeSeletor(c, selector)) resultados.push(c);
          coletar(c);
        }
      };
      coletar(el);
      return resultados;
    }
  };

  return el;
}

function correspondeSeletor(node, selector) {
  if (!node || !selector) return false;
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const semColchetes = selector.slice(1, -1);
    if (semColchetes.includes('=')) {
      const [k, v] = semColchetes.split('=');
      const valLimpo = v.replace(/^["']|["']$/g, '');
      return node.getAttribute(k) === valLimpo;
    }
    return node.hasAttribute(semColchetes);
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

// Configuração do ambiente global para funções de UI
globalThis.document = {
  createElement: (tag) => criarMockElemento(tag),
  body: criarMockElemento('body')
};

// Fixtures auxiliares para suíte adversarial
function gerarPastasTeste() {
  return [
    { id: 'pasta_urbanismo', nome: 'Direito Urbanístico', cor: '#FF6B2C' },
    { id: 'pasta_metodologia', nome: 'Metodologia Científica', cor: '#314F79' },
    { id: 'pasta_computacao', nome: 'Inteligência Artificial', cor: '#0D9488' },
    { id: 'pasta_somente_leitura', nome: 'Acervo Compartilhado', cor: '#475569', origem: 'compartilhada', permissao: 'leitura' },
    { id: 'pasta_escrita_colab', nome: 'Laboratório Colaborativo', cor: '#7C3AED', origem: 'compartilhada', permissao: 'escrita' }
  ];
}

// ===========================================================================
// CENÁRIO 1: PASTAS INEXISTENTES, IDS NULOS/VAZIOS E FORMATOS CORROMPIDOS
// ===========================================================================
describe('Cenário 1: Robustez a Pastas Inexistentes, IDs Nulos/Vazios e Formatos Corrompidos', () => {

  it('1.1. filtrarReferenciasPorPasta: sobrevive a entradas totalmente inválidas sem lançar exceção', () => {
    assert.deepEqual(filtrarReferenciasPorPasta(null, 'todas'), []);
    assert.deepEqual(filtrarReferenciasPorPasta(undefined, 'todas'), []);
    assert.deepEqual(filtrarReferenciasPorPasta('não-array', 'todas'), []);
    assert.deepEqual(filtrarReferenciasPorPasta(12345, 'todas'), []);
    assert.deepEqual(filtrarReferenciasPorPasta({}, 'todas'), []);
    assert.deepEqual(filtrarReferenciasPorPasta(true, 'todas'), []);
  });

  it('1.2. filtrarReferenciasPorPasta: array contendo elementos corrompidos filtra valores falsy sem travar', () => {
    const listaCorrompida = [
      null,
      undefined,
      false,
      0,
      '',
      {},
      { id: 'ref_valida', pastaId: 'pasta_urbanismo' }
    ];
    const resTodas = filtrarReferenciasPorPasta(listaCorrompida, 'todas');
    assert.equal(resTodas.length, 2, 'Deve manter os objetos não falsy');
    assert.ok(resTodas.some(r => r.id === 'ref_valida'));

    const resUrb = filtrarReferenciasPorPasta(listaCorrompida, 'pasta_urbanismo');
    assert.equal(resUrb.length, 1);
    assert.equal(resUrb[0].id, 'ref_valida');
  });

  it('1.3. filtrarReferenciasPorPasta: pastaId vazio, nulo, whitespace ou booleano faz fallback seguro para "todas"', () => {
    const itens = [
      criarBookReferenceItem({ id: 'r1', titulo: 'Obra 1', pastaId: 'pasta_urbanismo' }),
      criarBookReferenceItem({ id: 'r2', titulo: 'Obra 2', pastaId: 'pasta_metodologia' })
    ];
    assert.equal(filtrarReferenciasPorPasta(itens, null).length, 2);
    assert.equal(filtrarReferenciasPorPasta(itens, undefined).length, 2);
    assert.equal(filtrarReferenciasPorPasta(itens, '').length, 2);
    assert.equal(filtrarReferenciasPorPasta(itens, '   ').length, 2);
    assert.equal(filtrarReferenciasPorPasta(itens, false).length, 2);
  });

  it('1.4. filtrarReferenciasPorPasta: consulta por pasta inexistente retorna vazio sem quebrar', () => {
    const itens = [
      criarBookReferenceItem({ id: 'r1', titulo: 'Obra 1', pastaId: 'pasta_urbanismo' })
    ];
    const res = filtrarReferenciasPorPasta(itens, 'pasta_fantasma_404', { pastas: gerarPastasTeste() });
    assert.deepEqual(res, []);
  });

  it('1.5. filtrarReferenciasPorPasta: busca por RAIZ_BIBLIOGRAFIA captura obras sem pastaId ou com pastaId nulo', () => {
    const itens = [
      { id: 'r_sem_pasta', titulo: 'Sem Pasta' },
      { id: 'r_pasta_vazia', titulo: 'Pasta Vazia', pastaId: '' },
      { id: 'r_pasta_nula', titulo: 'Pasta Nula', pastaId: null },
      { id: 'r_pasta_raiz', titulo: 'Pasta Raiz', pastaId: RAIZ_BIBLIOGRAFIA },
      { id: 'r_pasta_especifica', titulo: 'Específica', pastaId: 'pasta_urbanismo' }
    ];
    const res = filtrarReferenciasPorPasta(itens, RAIZ_BIBLIOGRAFIA, { pastas: gerarPastasTeste() });
    const ids = res.map(r => r.id);
    assert.ok(ids.includes('r_sem_pasta'), 'obra sem pastaId deve estar na raiz');
    assert.ok(ids.includes('r_pasta_vazia'), 'obra com pastaId vazio deve estar na raiz');
    assert.ok(ids.includes('r_pasta_nula'), 'obra com pastaId nulo deve estar na raiz');
    assert.ok(ids.includes('r_pasta_raiz'), 'obra explícita na raiz deve estar na raiz');
    assert.ok(!ids.includes('r_pasta_especifica'), 'obra em pasta válida não deve estar na raiz');
  });

  it('1.6. moverReferenciaEntrePastas: recusa atômica e segura para entradas nulas ou inválidas', () => {
    const itens = [criarBookReferenceItem({ id: 'r1', titulo: 'Obra 1', pastaId: 'pasta_urbanismo' })];

    // Array inválido
    const resItensNulos = moverReferenciaEntrePastas(null, 'r1', 'pasta_metodologia');
    assert.equal(resItensNulos.sucesso, false);
    assert.equal(resItensNulos.erro, 'Lista de referências inválida.');

    // ID do livro nulo ou vazio
    const resLivroVazio = moverReferenciaEntrePastas(itens, '', 'pasta_metodologia');
    assert.equal(resLivroVazio.sucesso, false);
    assert.ok(resLivroVazio.erro.includes('Identificador do livro é obrigatório'));

    const resLivroNulo = moverReferenciaEntrePastas(itens, null, 'pasta_metodologia');
    assert.equal(resLivroNulo.sucesso, false);

    // Livro inexistente
    const res404 = moverReferenciaEntrePastas(itens, 'id_fantasma_999', 'pasta_metodologia');
    assert.equal(res404.sucesso, false);
    assert.ok(res404.erro.includes('não foi encontrado'));
    assert.equal(itens[0].pastaId, 'pasta_urbanismo', 'não deve corromper os itens originais');
  });

  it('1.7. moverReferenciaEntrePastas: destino nulo, vazio ou "todas" normaliza atômico para RAIZ_BIBLIOGRAFIA', () => {
    const itens = [criarBookReferenceItem({ id: 'r1', titulo: 'Obra 1', pastaId: 'pasta_urbanismo' })];

    const resNulo = moverReferenciaEntrePastas(itens, 'r1', null);
    assert.equal(resNulo.sucesso, true);
    assert.equal(resNulo.pastaDestinoId, RAIZ_BIBLIOGRAFIA);
    assert.equal(resNulo.livroModificado.pastaId, RAIZ_BIBLIOGRAFIA);

    const resVazio = moverReferenciaEntrePastas(itens, 'r1', '   ');
    assert.equal(resVazio.sucesso, true);
    assert.equal(resVazio.pastaDestinoId, RAIZ_BIBLIOGRAFIA);

    const resTodas = moverReferenciaEntrePastas(itens, 'r1', 'todas');
    assert.equal(resTodas.sucesso, true);
    assert.equal(resTodas.pastaDestinoId, RAIZ_BIBLIOGRAFIA);
  });

  it('1.8. calcularContadoresPastas: sobrevive a coleções nulas e pastas malformadas', () => {
    const cNulo = calcularContadoresPastas(null, null);
    assert.equal(cNulo.get('todas'), 0);
    assert.equal(cNulo.get(RAIZ_BIBLIOGRAFIA), 0);

    const pastasAnomalas = [null, undefined, {}, { nome: 'Sem ID' }, { id: 'todas' }, { id: 'p_ok' }];
    const itensAnomalos = [
      null,
      {},
      { id: 'x1', pastaId: null },
      { id: 'x2', pastaId: 'p_ok' },
      { id: 'x3', pastasIds: 'não-é-array' }
    ];
    const cAnomalo = calcularContadoresPastas(itensAnomalos, pastasAnomalas);
    assert.equal(cAnomalo.get('todas'), 4);
    assert.equal(cAnomalo.get('p_ok'), 1);
    assert.ok(cAnomalo.get(RAIZ_BIBLIOGRAFIA) >= 2);
  });

  it('1.9. restaurarPastaAtiva: lida com storage defeituoso (exceções) e IDs inexistentes com fallback para "todas"', () => {
    // Storage que lança exceção em getItem
    const storageQuebrado = {
      getItem: () => { throw new Error('QuotaExceeded / SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); }
    };
    const resQuebrado = restaurarPastaAtiva({ pastas: gerarPastasTeste(), storage: storageQuebrado });
    assert.equal(resQuebrado, 'todas', 'Deve retornar "todas" em caso de exceção de storage');

    // Storage com ID que não existe na lista de pastas
    const mockStorage = new Map([[STORAGE_KEY_BIB_PASTA_ATIVA, 'pasta_removida_404']]);
    const storageFake = {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, v)
    };
    const resInexistente = restaurarPastaAtiva({ pastas: gerarPastasTeste(), storage: storageFake });
    assert.equal(resInexistente, 'todas', 'Deve resetar para "todas" quando pasta persistida não existe mais');
    assert.equal(storageFake.getItem(STORAGE_KEY_BIB_PASTA_ATIVA), 'todas', 'Deve gravar fallback no storage');
  });
});

// ===========================================================================
// CENÁRIO 2: REFERÊNCIAS ÓRFÃS E MULTI-PASTAS (pastasIds: [...])
// ===========================================================================
describe('Cenário 2: Tratamento de Referências Órfãs e Multi-Pastas (pastasIds)', () => {

  it('2.1. Referência pertencente a múltiplas pastas aparece em todas as pastas vinculadas', () => {
    const itemMulti = criarBookReferenceItem({
      id: 'ref_multidisciplinar',
      titulo: 'IA no Planejamento Urbano',
      pastaId: 'pasta_urbanismo',
      pastasIds: ['pasta_urbanismo', 'pasta_computacao', 'pasta_metodologia']
    });
    const itens = [itemMulti];

    assert.equal(filtrarReferenciasPorPasta(itens, 'pasta_urbanismo').length, 1);
    assert.equal(filtrarReferenciasPorPasta(itens, 'pasta_computacao').length, 1);
    assert.equal(filtrarReferenciasPorPasta(itens, 'pasta_metodologia').length, 1);
    assert.equal(filtrarReferenciasPorPasta(itens, 'pasta_somente_leitura').length, 0);
  });

  it('2.2. Referência multi-pastas é listada exatamente UMA VEZ na estante geral ("todas")', () => {
    const itemMulti = criarBookReferenceItem({
      id: 'ref_multi',
      titulo: 'Interdisciplinaridade',
      pastaId: 'pasta_urbanismo',
      pastasIds: ['pasta_urbanismo', 'pasta_computacao', 'pasta_metodologia']
    });
    const filtrados = filtrarReferenciasPorPasta([itemMulti], 'todas');
    assert.equal(filtrados.length, 1, 'Estante geral não pode duplicar obra multi-pasta');
    assert.equal(filtrados[0].id, 'ref_multi');
  });

  it('2.3. calcularContadoresPastas: computa multi-pastas com conservação do total na estante geral', () => {
    const pastas = gerarPastasTeste();
    const item1 = criarBookReferenceItem({
      id: 'r1',
      titulo: 'Obra 1',
      pastaId: 'pasta_urbanismo',
      pastasIds: ['pasta_urbanismo', 'pasta_computacao']
    });
    const item2 = criarBookReferenceItem({
      id: 'r2',
      titulo: 'Obra 2',
      pastaId: 'pasta_urbanismo',
      pastasIds: ['pasta_urbanismo']
    });

    const contadores = calcularContadoresPastas([item1, item2], pastas);
    assert.equal(contadores.get('todas'), 2, 'Total geral deve ser estritamente 2 obras físicas');
    assert.equal(contadores.get('pasta_urbanismo'), 2, 'Urbanismo contém r1 e r2');
    assert.equal(contadores.get('pasta_computacao'), 1, 'Computação contém r1');
    assert.equal(contadores.get('pasta_metodologia'), 0);
  });

  it('2.4. calcularContadoresPastas: pastasIds com IDs duplicados internamente não inflaciona o contador', () => {
    const pastas = gerarPastasTeste();
    const itemRedundante = criarBookReferenceItem({
      id: 'r_dup',
      titulo: 'Redundância',
      pastaId: 'pasta_urbanismo',
      pastasIds: ['pasta_urbanismo', 'pasta_urbanismo', 'pasta_urbanismo']
    });

    const contadores = calcularContadoresPastas([itemRedundante], pastas);
    assert.equal(contadores.get('pasta_urbanismo'), 1, 'Contador não deve ser inflacionado por IDs repetidos');
    assert.equal(contadores.get('todas'), 1);
  });

  it('2.5. Referência órfã (pastaId deletada): roteia para RAIZ_BIBLIOGRAFIA em filtragem e contagem', () => {
    const pastas = gerarPastasTeste();
    const itemOrfao = criarBookReferenceItem({
      id: 'r_orfa',
      titulo: 'Obra de Coleção Excluída',
      pastaId: 'pasta_inexistente_deletada_999'
    });

    // 1. Filtragem
    const filtradosRaiz = filtrarReferenciasPorPasta([itemOrfao], RAIZ_BIBLIOGRAFIA, { pastas });
    assert.equal(filtradosRaiz.length, 1, 'Obra órfã deve aparecer na raiz');
    assert.equal(filtradosRaiz[0].id, 'r_orfa');

    // 2. Contagem
    const contadores = calcularContadoresPastas([itemOrfao], pastas);
    assert.equal(contadores.get(RAIZ_BIBLIOGRAFIA), 1, 'Obra órfã deve ser contabilizada na raiz');
    assert.equal(contadores.get('todas'), 1);
  });

  it('2.6. Referência com múltiplos IDs inexistentes incrementa a RAIZ_BIBLIOGRAFIA apenas uma vez', () => {
    const pastas = gerarPastasTeste();
    const itemMultiOrfao = criarBookReferenceItem({
      id: 'r_multi_orfa',
      titulo: 'Obra com Várias Pastas Inexistentes',
      pastaId: 'fantasma_1',
      pastasIds: ['fantasma_1', 'fantasma_2', 'fantasma_3']
    });

    const contadores = calcularContadoresPastas([itemMultiOrfao], pastas);
    assert.equal(contadores.get(RAIZ_BIBLIOGRAFIA), 1, 'Destino raiz deve ser deduplicado por obra');
    assert.equal(contadores.get('todas'), 1);
  });
});

// ===========================================================================
// CENÁRIO 3: MOVIMENTAÇÕES CIRCULARES, IDEMPOTÊNCIA E RECUSA ATÔMICA
// ===========================================================================
describe('Cenário 3: Movimentações Circulares, Idempotência e Recusa Atômica para Pastas Read-Only', () => {

  it('3.1. Movimentação circular P1 -> P2 -> P3 -> P1 preserva imutabilidade e restaura contagens originais', () => {
    const pastas = gerarPastasTeste();
    const itemInicial = criarBookReferenceItem({
      id: 'livro_viajante',
      titulo: 'Teoria Geral da Regularização',
      autores: [{ sobrenome: 'Ribeiro', prenome: 'Jefferson' }],
      ano: '2023',
      tipo: 'livro',
      pastaId: 'pasta_urbanismo',
      pastasIds: ['pasta_urbanismo'],
      totalCitationsCount: 7,
      quickSummary: 'Resumo analítico profundo',
      highlightsCount: 12
    });
    const itensBase = [itemInicial];

    const contadoresIniciais = calcularContadoresPastas(itensBase, pastas);
    assert.equal(contadoresIniciais.get('pasta_urbanismo'), 1);
    assert.equal(contadoresIniciais.get('pasta_metodologia'), 0);
    assert.equal(contadoresIniciais.get('pasta_computacao'), 0);

    // Passo 1: Urbanismo -> Metodologia
    const m1 = moverReferenciaEntrePastas(itensBase, 'livro_viajante', 'pasta_metodologia');
    assert.equal(m1.sucesso, true);
    assert.equal(m1.pastaOrigemId, 'pasta_urbanismo');
    assert.equal(m1.pastaDestinoId, 'pasta_metodologia');
    assert.notEqual(m1.itens, itensBase, 'Array original não deve ser mutado');
    assert.equal(itensBase[0].pastaId, 'pasta_urbanismo', 'Item base permanece imutável');

    // Passo 2: Metodologia -> Computação
    const m2 = moverReferenciaEntrePastas(m1.itens, 'livro_viajante', 'pasta_computacao');
    assert.equal(m2.sucesso, true);
    assert.equal(m2.pastaOrigemId, 'pasta_metodologia');
    assert.equal(m2.pastaDestinoId, 'pasta_computacao');

    // Passo 3: Computação -> Urbanismo (fecha ciclo)
    const m3 = moverReferenciaEntrePastas(m2.itens, 'livro_viajante', 'pasta_urbanismo');
    assert.equal(m3.sucesso, true);
    assert.equal(m3.pastaOrigemId, 'pasta_computacao');
    assert.equal(m3.pastaDestinoId, 'pasta_urbanismo');

    // Verificação de integridade pós-ciclo
    const livroFinal = m3.livroModificado;
    assert.equal(livroFinal.pastaId, 'pasta_urbanismo');
    assert.deepEqual(livroFinal.pastasIds, ['pasta_urbanismo']);
    assert.equal(livroFinal.titulo, 'Teoria Geral da Regularização');
    assert.equal(livroFinal.totalCitationsCount, 7);
    assert.equal(livroFinal.quickSummary, 'Resumo analítico profundo');
    assert.equal(livroFinal.highlightsCount, 12);

    // Contadores finais devem coincidir estritamente com os iniciais
    const contadoresFinais = calcularContadoresPastas(m3.itens, pastas);
    assert.equal(contadoresFinais.get('pasta_urbanismo'), contadoresIniciais.get('pasta_urbanismo'));
    assert.equal(contadoresFinais.get('pasta_metodologia'), contadoresIniciais.get('pasta_metodologia'));
    assert.equal(contadoresFinais.get('pasta_computacao'), contadoresIniciais.get('pasta_computacao'));
    assert.equal(contadoresFinais.get('todas'), contadoresIniciais.get('todas'));
  });

  it('3.2. Idempotência estrita ao mover livro para a pasta onde ele já reside', () => {
    const item = criarBookReferenceItem({ id: 'r1', pastaId: 'pasta_urbanismo' });
    const itens = [item];

    const res = moverReferenciaEntrePastas(itens, 'r1', 'pasta_urbanismo');
    assert.equal(res.sucesso, true);
    assert.equal(res.semMudanca, true);
    assert.equal(res.pastaOrigemId, 'pasta_urbanismo');
    assert.equal(res.pastaDestinoId, 'pasta_urbanismo');
    assert.equal(res.mensagem, 'O livro já está nesta pasta.');
    assert.equal(res.itens, itens, 'Deve retornar a mesma lista sem clones desnecessários');
  });

  it('3.3. Idempotência na raiz: mover livro da RAIZ para a RAIZ', () => {
    const item = criarBookReferenceItem({ id: 'r_raiz', pastaId: RAIZ_BIBLIOGRAFIA });
    const res = moverReferenciaEntrePastas([item], 'r_raiz', RAIZ_BIBLIOGRAFIA);
    assert.equal(res.sucesso, true);
    assert.equal(res.semMudanca, true);
    assert.equal(res.pastaOrigemId, RAIZ_BIBLIOGRAFIA);
  });

  it('3.4. Recusa atômica e explícita ao tentar mover obra para pasta somente leitura', () => {
    const pastas = gerarPastasTeste();
    const item = criarBookReferenceItem({ id: 'r1', pastaId: 'pasta_urbanismo' });
    const itens = [item];

    const res = moverReferenciaEntrePastas(itens, 'r1', 'pasta_somente_leitura', { pastas });
    assert.equal(res.sucesso, false);
    assert.ok(res.erro.includes('somente leitura'));
    assert.equal(res.livroModificado, null);
    assert.equal(itens[0].pastaId, 'pasta_urbanismo', 'Estado original deve permanecer estritamente intacto');
  });

  it('3.5. Permissão de movimentação para pasta compartilhada com permissão de escrita', () => {
    const pastas = gerarPastasTeste();
    const item = criarBookReferenceItem({ id: 'r1', pastaId: 'pasta_urbanismo' });
    const res = moverReferenciaEntrePastas([item], 'r1', 'pasta_escrita_colab', { pastas });
    assert.equal(res.sucesso, true);
    assert.equal(res.pastaDestinoId, 'pasta_escrita_colab');
    assert.equal(res.livroModificado.pastaId, 'pasta_escrita_colab');
  });

  it('3.6. Movimentação transparente por chaveZotero quando identificador passado for a chave', () => {
    const item = criarBookReferenceItem({
      id: 'id_sistema_interno',
      chaveZotero: 'ZOTERO_KEY_999',
      pastaId: 'pasta_urbanismo'
    });
    const res = moverReferenciaEntrePastas([item], 'ZOTERO_KEY_999', 'pasta_metodologia');
    assert.equal(res.sucesso, true);
    assert.equal(res.livroModificado.id, 'id_sistema_interno');
    assert.equal(res.livroModificado.pastaId, 'pasta_metodologia');
  });

  it('3.7. moverLivroParaPasta (módulo de estante): valida contratos e comportamento de erro', () => {
    const livro = { id: 'l1', pastaId: 'pasta_urbanismo' };
    const livros = [livro];
    const pastas = gerarPastasTeste();

    // Livro inexistente
    const res404 = moverLivroParaPasta('livro_inexistente', 'pasta_metodologia', livros, pastas);
    assert.equal(res404.sucesso, false);
    assert.equal(res404.motivo, 'livro_nao_encontrado');

    // Pasta destino inexistente
    const resPasta404 = moverLivroParaPasta('l1', 'pasta_inexistente_999', livros, pastas);
    assert.equal(resPasta404.sucesso, false);
    assert.equal(resPasta404.motivo, 'pasta_destino_inexistente');

    // Movimentação idêntica (sem mudança)
    const resMesma = moverLivroParaPasta('l1', 'pasta_urbanismo', livros, pastas);
    assert.equal(resMesma.sucesso, true);
    assert.equal(resMesma.semMudanca, true);

    // Movimentação válida
    const resSucesso = moverLivroParaPasta('l1', 'pasta_metodologia', livros, pastas);
    assert.equal(resSucesso.sucesso, true);
    assert.equal(livro.pastaId, 'pasta_metodologia');
  });
});

// ===========================================================================
// CENÁRIO 4: TESTE DE ESTRESSE DE PERFORMANCE (O(N), 500+ REFS EM 50+ PASTAS)
// ===========================================================================
describe('Cenário 4: Teste de Estresse de Performance e Complexidade O(N)', () => {

  // Gerador sintético de alta densidade
  function gerarCatalogoMassivo(qtdLivros = 600, qtdPastas = 60) {
    const pastas = [];
    for (let i = 1; i <= qtdPastas; i++) {
      pastas.push({
        id: `pasta_stress_${i}`,
        nome: `Pasta Temática Especializada ${i}`,
        cor: CORES_PASTAS_CRONOS[i % CORES_PASTAS_CRONOS.length]
      });
    }

    const livros = [];
    for (let i = 1; i <= qtdLivros; i++) {
      const pastaPrimaria = `pasta_stress_${(i % qtdPastas) + 1}`;
      let pastasIds = [pastaPrimaria];

      // 20% das obras são multi-pastas
      if (i % 5 === 0) {
        const pastaSecundaria = `pasta_stress_${((i + 3) % qtdPastas) + 1}`;
        pastasIds = [pastaPrimaria, pastaSecundaria];
      }
      // 5% das obras estão na raiz
      else if (i % 20 === 0) {
        pastasIds = [RAIZ_BIBLIOGRAFIA];
      }
      // 5% das obras são órfãs (pasta excluída)
      else if (i % 19 === 0) {
        pastasIds = [`pasta_deletada_${i}`];
      }

      livros.push(criarBookReferenceItem({
        id: `livro_stress_${i}`,
        titulo: `Tratado Científico de Pesquisa Volume ${i} — Estudo Avançado`,
        autores: [
          { sobrenome: `Autor_${i}`, prenome: 'Cientista' },
          { sobrenome: `Coautor_${i}`, prenome: 'Pesquisador' }
        ],
        ano: String(1980 + (i % 45)),
        tipo: 'artigo',
        pastaId: pastasIds[0],
        pastasIds,
        corCapa: CORES_CAPA_PADRAO[i % CORES_CAPA_PADRAO.length],
        totalCitationsCount: i % 15,
        quickSummary: `Resumo do fichamento crítico do volume ${i}.`,
        highlightsCount: (i * 3) % 10
      }));
    }

    return { pastas, livros };
  }

  it('4.1. calcularContadoresPastas com 600 referências e 60 pastas executa em < 50ms (alvo < 15ms)', () => {
    const { pastas, livros } = gerarCatalogoMassivo(600, 60);

    // Warm-up JIT
    calcularContadoresPastas(livros.slice(0, 50), pastas.slice(0, 10));

    const inicio = performance.now();
    const contadores = calcularContadoresPastas(livros, pastas);
    const duracao = performance.now() - inicio;

    assert.ok(duracao < 50, `Tempo de execução foi de ${duracao.toFixed(2)}ms, deve ser estritamente < 50ms`);
    assert.equal(contadores.get('todas'), 600, 'Estante geral deve conter o total exato de 600 obras');

    // Valida que todas as 60 pastas receberam contagens íntegras
    for (const p of pastas) {
      assert.ok(contadores.has(p.id));
      assert.ok(typeof contadores.get(p.id) === 'number');
    }
  });

  it('4.2. Bateria de 62 filtragens (todas as pastas + raiz + geral) sobre 600 obras executa em < 50ms', () => {
    const { pastas, livros } = gerarCatalogoMassivo(600, 60);

    const inicio = performance.now();
    let totalFiltrados = 0;

    // Filtra geral
    totalFiltrados += filtrarReferenciasPorPasta(livros, 'todas').length;
    // Filtra raiz
    totalFiltrados += filtrarReferenciasPorPasta(livros, RAIZ_BIBLIOGRAFIA, { pastas }).length;
    // Filtra as 60 pastas individuais
    for (const p of pastas) {
      totalFiltrados += filtrarReferenciasPorPasta(livros, p.id, { pastas }).length;
    }
    const duracao = performance.now() - inicio;

    assert.ok(duracao < 50, `Tempo acumulado de 62 filtragens foi de ${duracao.toFixed(2)}ms, deve ser < 50ms`);
    assert.ok(totalFiltrados >= 600, 'Total acumulado de filtragens deve ser consistente');
  });

  it('4.3. Verificação de escalabilidade linear O(N): razão T(1000) / T(100) confirma complexidade linear', () => {
    const { pastas: p100, livros: l100 } = gerarCatalogoMassivo(100, 20);
    const { pastas: p1000, livros: l1000 } = gerarCatalogoMassivo(1000, 20);

    // Mede 10 iterações para estabilidade estatística
    const medir = (livros, pastas) => {
      const t0 = performance.now();
      for (let i = 0; i < 15; i++) {
        calcularContadoresPastas(livros, pastas);
      }
      return (performance.now() - t0) / 15;
    };

    const t100 = Math.max(0.01, medir(l100, p100));
    const t1000 = Math.max(0.01, medir(l1000, p1000));
    const razao = t1000 / t100;

    // Em O(N), para um fator 10x de dados a razão esperada é da ordem de 10x (tolerância até 30x para flutuações de GC/JIT).
    // Se fosse O(N²), a razão seria próxima de 100x.
    assert.ok(razao < 35, `Razão de escalabilidade foi de ${razao.toFixed(1)}x (não deve indicar O(N²))`);
  });
});

// ===========================================================================
// CENÁRIO 5: ROBUSTEZ CONTRA NOMES ESPECIAIS, SCRIPTS/HTML E STRINGS EXTREMAS
// ===========================================================================
describe('Cenário 5: Robustez contra Nomes de Pastas Especiais, Injeção HTML/Script e Strings Extremas', () => {

  it('5.1. Prevenção de XSS no Breadcrumb: tags <script> e <img> são neutralizadas via escapeHtml', () => {
    const container = criarMockElemento('div');
    const pastaAtaque = {
      id: 'pasta_xss',
      nome: '<script>alert("XSS")</script><img src=x onerror=alert(1)>'
    };

    const nav = renderizarBreadcrumb(container, pastaAtaque, { pastas: [pastaAtaque] });
    assert.ok(nav);

    // O HTML gerado deve conter entidades escapadas e NUNCA tags literais executáveis
    assert.ok(nav.innerHTML.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'));
    assert.ok(nav.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!nav.innerHTML.includes('<script>'));
    assert.ok(!nav.innerHTML.includes('<img'));
  });

  it('5.2. renderizarPastasCronos: utiliza textContent para nomes de abas e títulos, evitando injeção DOM', () => {
    const pastaPerigosa = {
      id: 'p_injecao',
      nome: '"><b onmouseover="alert(1)">Injeção</b>',
      cor: '#314F79'
    };
    const container = renderizarPastasCronos([pastaPerigosa], 'p_injecao');
    assert.ok(container);

    const card = container.querySelector('.ath-bib-folder-card');
    assert.ok(card);

    const tab = container.querySelector('.ath-bib-folder-tab');
    assert.ok(tab);
    assert.equal(tab.textContent, '"><b onmouseover="alert(1)">Injeção</b>', 'textContent armazena texto literal seguro');

    const titulo = container.querySelector('.ath-bib-folder-title');
    assert.ok(titulo);
    assert.equal(titulo.textContent, '"><b onmouseover="alert(1)">Injeção</b>');
  });

  it('5.3. Suporte integral a nomes com Emojis, caracteres especiais e alfabetos multilíngues', () => {
    const nomeComplexo = '📁 Urbanismo & REURB 🔥 2026 🎯 — 城市规划 — تخطيط المدن';
    const pastaUnicode = { id: 'p_unicode', nome: nomeComplexo, cor: '#0D9488' };

    const container = renderizarPastasCronos([pastaUnicode], 'p_unicode');
    const titulo = container.querySelector('.ath-bib-folder-title');
    assert.equal(titulo.textContent, nomeComplexo);

    // Breadcrumb
    const nav = renderizarBreadcrumb(criarMockElemento('div'), pastaUnicode, { pastas: [pastaUnicode] });
    assert.ok(nav.innerHTML.includes(escapeHtml(nomeComplexo)));
  });

  it('5.4. Pastas com nomes extremamente longos (1000 caracteres) não quebram renderização', () => {
    const nomeGigante = 'A'.repeat(1000);
    const pastaGigante = { id: 'p_gigante', nome: nomeGigante, cor: '#FF6B2C' };

    const container = renderizarPastasCronos([pastaGigante], 'p_gigante');
    const card = container.querySelector('.ath-bib-folder-card');
    assert.ok(card);
    assert.equal(card.getAttribute('data-pasta-id'), 'p_gigante');
  });

  it('5.5. Pastas com nome vazio, nulo ou whitespace exibem fallback "Sem Nome"', () => {
    const pastasVazias = [
      { id: 'p_vazia', nome: '', cor: '#314F79' },
      { id: 'p_nula', nome: null, cor: '#314F79' }
    ];
    const container = renderizarPastasCronos(pastasVazias, 'todas');
    const titulos = container.querySelectorAll('.ath-bib-folder-title');
    assert.equal(titulos.length, 2);
    assert.equal(titulos[0].textContent, 'Sem Nome');
    assert.equal(titulos[1].textContent, 'Sem Nome');
  });

  it('5.6. calcularCoresPasta com cores hexadecimais truncadas, nulas ou inválidas faz fallback gracioso', () => {
    const cNula = calcularCoresPasta(null);
    assert.equal(cNula.bg, '#EDF2FA', 'Deve aplicar fallback padrão');
    assert.equal(cNula.fg, '#0F172A');
    assert.equal(cNula.ehEscura, false);

    const cCurta = calcularCoresPasta('#FFF');
    assert.equal(cCurta.bg, '#FFFFFF');
    assert.equal(cCurta.fg, '#0F172A');

    const cInvalida = calcularCoresPasta('não-é-hex');
    assert.equal(cInvalida.bg, '#EDF2FA');

    const cEscura = calcularCoresPasta('#1E293B');
    assert.equal(cEscura.fg, '#FFFFFF');
    assert.equal(cEscura.ehEscura, true);
  });
});

// ===========================================================================
// CENÁRIO 6: PARIDADE ESTRITA E CONSERVAÇÃO ENTRE FILTRAGEM E AGRUPAMENTO
// ===========================================================================
describe('Cenário 6: Paridade Estrita e Conservação de Contagens (filtrar vs agrupar)', () => {

  it('6.1. Paridade estrita de totais e itens para catálogo padrão de coleções disjuntas', () => {
    const pastas = gerarPastasTeste();
    const itens = [
      criarBookReferenceItem({ id: 'ref_u1', titulo: 'Obra Urb 1', pastaId: 'pasta_urbanismo' }),
      criarBookReferenceItem({ id: 'ref_u2', titulo: 'Obra Urb 2', pastaId: 'pasta_urbanismo' }),
      criarBookReferenceItem({ id: 'ref_m1', titulo: 'Obra Met 1', pastaId: 'pasta_metodologia' }),
      criarBookReferenceItem({ id: 'ref_c1', titulo: 'Obra Comp 1', pastaId: 'pasta_computacao' }),
      criarBookReferenceItem({ id: 'ref_raiz', titulo: 'Manual Raiz', pastaId: RAIZ_BIBLIOGRAFIA }),
      criarBookReferenceItem({ id: 'ref_orf', titulo: 'Obra Órfã', pastaId: 'pasta_removida_404' })
    ];

    const mapaAgrupado = agruparPorPastas(itens, pastas);

    // 1. Estante Geral ("todas")
    const filtradosTodas = filtrarReferenciasPorPasta(itens, 'todas', { pastas });
    assert.equal(filtradosTodas.length, mapaAgrupado.get('todas').total);
    assert.equal(filtradosTodas.length, itens.length);

    // 2. Pasta Urbanismo
    const filtradosUrb = filtrarReferenciasPorPasta(itens, 'pasta_urbanismo', { pastas });
    assert.equal(filtradosUrb.length, mapaAgrupado.get('pasta_urbanismo').total);
    assert.deepEqual(filtradosUrb.map(r => r.id).sort(), mapaAgrupado.get('pasta_urbanismo').itens.map(r => r.id).sort());

    // 3. Pasta Metodologia
    const filtradosMet = filtrarReferenciasPorPasta(itens, 'pasta_metodologia', { pastas });
    assert.equal(filtradosMet.length, mapaAgrupado.get('pasta_metodologia').total);
    assert.deepEqual(filtradosMet.map(r => r.id).sort(), mapaAgrupado.get('pasta_metodologia').itens.map(r => r.id).sort());

    // 4. Pasta Computação
    const filtradosComp = filtrarReferenciasPorPasta(itens, 'pasta_computacao', { pastas });
    assert.equal(filtradosComp.length, mapaAgrupado.get('pasta_computacao').total);

    // 5. Raiz da Bibliografia (deve conter a obra na raiz e a obra órfã em ambos)
    const filtradosRaiz = filtrarReferenciasPorPasta(itens, RAIZ_BIBLIOGRAFIA, { pastas });
    assert.equal(filtradosRaiz.length, mapaAgrupado.get(RAIZ_BIBLIOGRAFIA).total);
    assert.deepEqual(filtradosRaiz.map(r => r.id).sort(), mapaAgrupado.get(RAIZ_BIBLIOGRAFIA).itens.map(r => r.id).sort());
    assert.equal(filtradosRaiz.length, 2, 'Raiz deve somar ref_raiz e ref_orf');

    // 6. Pasta sem itens
    const filtradosVazia = filtrarReferenciasPorPasta(itens, 'pasta_somente_leitura', { pastas });
    assert.equal(filtradosVazia.length, 0);
    assert.equal(mapaAgrupado.get('pasta_somente_leitura').total, 0);
  });

  it('6.2. Conservação da soma de itens: somatório de pastas disjuntas + raiz é exatamente igual a "todas"', () => {
    const pastas = [
      { id: 'p_alfa', nome: 'Alfa' },
      { id: 'p_beta', nome: 'Beta' }
    ];
    const itens = [
      criarBookReferenceItem({ id: 'a1', pastaId: 'p_alfa' }),
      criarBookReferenceItem({ id: 'a2', pastaId: 'p_alfa' }),
      criarBookReferenceItem({ id: 'b1', pastaId: 'p_beta' }),
      criarBookReferenceItem({ id: 'r1', pastaId: RAIZ_BIBLIOGRAFIA })
    ];

    const mapa = agruparPorPastas(itens, pastas);
    const contadores = calcularContadoresPastas(itens, pastas);

    const somaAgrupada = mapa.get('p_alfa').total + mapa.get('p_beta').total + mapa.get(RAIZ_BIBLIOGRAFIA).total;
    const somaContadores = contadores.get('p_alfa') + contadores.get('p_beta') + contadores.get(RAIZ_BIBLIOGRAFIA);

    assert.equal(somaAgrupada, itens.length);
    assert.equal(somaContadores, itens.length);
    assert.equal(mapa.get('todas').total, itens.length);
    assert.equal(contadores.get('todas'), itens.length);
  });

  it('6.3. Coerência entre calcularContadoresPastas e filtrarReferenciasPorPasta para todas as pastas', () => {
    const pastas = gerarPastasTeste();
    const itens = [
      criarBookReferenceItem({ id: '1', pastaId: 'pasta_urbanismo' }),
      criarBookReferenceItem({ id: '2', pastaId: 'pasta_urbanismo' }),
      criarBookReferenceItem({ id: '3', pastaId: 'pasta_metodologia' }),
      criarBookReferenceItem({ id: '4', pastaId: RAIZ_BIBLIOGRAFIA }),
      criarBookReferenceItem({ id: '5', pastaId: 'fantasma_inexistente' })
    ];

    const contadores = calcularContadoresPastas(itens, pastas);

    assert.equal(contadores.get('todas'), filtrarReferenciasPorPasta(itens, 'todas').length);
    assert.equal(contadores.get('pasta_urbanismo'), filtrarReferenciasPorPasta(itens, 'pasta_urbanismo', { pastas }).length);
    assert.equal(contadores.get('pasta_metodologia'), filtrarReferenciasPorPasta(itens, 'pasta_metodologia', { pastas }).length);
    assert.equal(contadores.get(RAIZ_BIBLIOGRAFIA), filtrarReferenciasPorPasta(itens, RAIZ_BIBLIOGRAFIA, { pastas }).length);
    assert.equal(contadores.get('pasta_somente_leitura'), filtrarReferenciasPorPasta(itens, 'pasta_somente_leitura', { pastas }).length);
  });
});
