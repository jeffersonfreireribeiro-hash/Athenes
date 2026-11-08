// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarBookReferenceItem,
  agruparPorPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas,
  calcularContadoresPastas,
  RAIZ_BIBLIOGRAFIA
} from '../src/core/athenes_referencias.js';

// Fixtures padronizadas para testes de pastas
const criarPastasExemplo = () => [
  { id: 'pasta_urbanismo', nome: 'Direito Urbanístico', cor: '#FF6B2C' },
  { id: 'pasta_metodologia', nome: 'Metodologia Científica', cor: '#314F79' },
  { id: 'pasta_somente_leitura', nome: 'Acervo Compartilhado', cor: '#475569', origem: 'compartilhada', permissao: 'leitura' }
];

const criarItensExemplo = () => [
  criarBookReferenceItem({ id: 'ref_1', titulo: 'Estatuto da Cidade', pastaId: 'pasta_urbanismo', ano: '2021' }),
  criarBookReferenceItem({ id: 'ref_2', titulo: 'Plano Diretor e Gestão', pastaId: 'pasta_urbanismo', ano: '2022' }),
  criarBookReferenceItem({ id: 'ref_3', titulo: 'Como Elaborar Projetos', pastaId: 'pasta_metodologia', ano: '2019' }),
  criarBookReferenceItem({ id: 'ref_raiz', titulo: 'Manual Geral de Pesquisa', pastaId: RAIZ_BIBLIOGRAFIA, ano: '2020' }),
  criarBookReferenceItem({ id: 'ref_orfa', titulo: 'Documento de Pasta Removida', pastaId: 'pasta_inexistente_999', ano: '2023' })
];

// -----------------------------------------------------------------------------
// GRUPO 1: Filtragem Reativa de Referências por Pasta (filtrarReferenciasPorPasta)
// -----------------------------------------------------------------------------

test('1.1. filtrarReferenciasPorPasta: "todas" ou vazio retorna a totalidade das referências válidas', () => {
  const itens = criarItensExemplo();
  assert.equal(filtrarReferenciasPorPasta(itens, 'todas').length, 5);
  assert.equal(filtrarReferenciasPorPasta(itens, '').length, 5);
  assert.equal(filtrarReferenciasPorPasta(itens, null).length, 5);
  assert.equal(filtrarReferenciasPorPasta(itens, undefined).length, 5);
});

test('1.2. filtrarReferenciasPorPasta: "pasta_bib_raiz" retorna obras na raiz e sem pasta', () => {
  const itens = criarItensExemplo();
  const pastas = criarPastasExemplo();
  const resultado = filtrarReferenciasPorPasta(itens, RAIZ_BIBLIOGRAFIA, { pastas });
  
  // Deve conter ref_raiz e também ref_orfa (cujo pastaId não está entre as pastas conhecidas)
  const ids = resultado.map(r => r.id);
  assert.ok(ids.includes('ref_raiz'), 'deve conter a obra explicitamente na raiz');
  assert.ok(ids.includes('ref_orfa'), 'deve conter a obra órfã direcionada à raiz');
  assert.ok(!ids.includes('ref_1'), 'não deve conter obras de pasta específica');
});

test('1.3. filtrarReferenciasPorPasta: pasta específica retorna exclusivamente obras vinculadas', () => {
  const itens = criarItensExemplo();
  const resultado = filtrarReferenciasPorPasta(itens, 'pasta_urbanismo');
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map(r => r.id).sort(), ['ref_1', 'ref_2']);
});

test('1.4. filtrarReferenciasPorPasta: suporte a multi-coleções do Zotero (pastasIds)', () => {
  const itemMulti = criarBookReferenceItem({
    id: 'ref_multi',
    titulo: 'Obra Multidisciplinar',
    pastaId: 'pasta_urbanismo',
    pastasIds: ['pasta_urbanismo', 'pasta_metodologia']
  });
  const itens = [itemMulti];

  assert.equal(filtrarReferenciasPorPasta(itens, 'pasta_urbanismo').length, 1);
  assert.equal(filtrarReferenciasPorPasta(itens, 'pasta_metodologia').length, 1);
  assert.equal(filtrarReferenciasPorPasta(itens, 'outra_pasta').length, 0);
});

test('1.5. filtrarReferenciasPorPasta: robustez a entradas nulas, vazias ou corrompidas', () => {
  assert.deepEqual(filtrarReferenciasPorPasta(null, 'todas'), []);
  assert.deepEqual(filtrarReferenciasPorPasta(undefined, 'todas'), []);
  assert.deepEqual(filtrarReferenciasPorPasta([], 'todas'), []);
  assert.deepEqual(filtrarReferenciasPorPasta([null, undefined, {}], 'todas'), [{}]);
});

test('1.6. Paridade Estrita com agruparPorPastas: coerência de itens e contagens', () => {
  const itens = criarItensExemplo();
  const pastas = criarPastasExemplo();

  const mapaGrupos = agruparPorPastas(itens, pastas);
  
  // Todas
  const filtradosTodas = filtrarReferenciasPorPasta(itens, 'todas', { pastas });
  assert.equal(filtradosTodas.length, mapaGrupos.get('todas').total);

  // Pasta Urbanismo
  const filtradosUrb = filtrarReferenciasPorPasta(itens, 'pasta_urbanismo', { pastas });
  assert.equal(filtradosUrb.length, mapaGrupos.get('pasta_urbanismo').total);

  // Raiz (inclui órfão em ambos)
  const filtradosRaiz = filtrarReferenciasPorPasta(itens, RAIZ_BIBLIOGRAFIA, { pastas });
  assert.equal(filtradosRaiz.length, mapaGrupos.get(RAIZ_BIBLIOGRAFIA).total);
});

// -----------------------------------------------------------------------------
// GRUPO 2: Movimentação Atômica de Livros Entre Pastas (moverReferenciaEntrePastas)
// -----------------------------------------------------------------------------

test('2.1. moverReferenciaEntrePastas: altera pastaId e pastasIds para o destino informado', () => {
  const itens = criarItensExemplo();
  const resultado = moverReferenciaEntrePastas(itens, 'ref_1', 'pasta_metodologia');

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.pastaOrigemId, 'pasta_urbanismo');
  assert.equal(resultado.pastaDestinoId, 'pasta_metodologia');
  assert.equal(resultado.livroModificado.pastaId, 'pasta_metodologia');
  assert.deepEqual(resultado.livroModificado.pastasIds, ['pasta_metodologia']);
  assert.ok(resultado.livroModificado.atualizadoEm);
});

test('2.2. moverReferenciaEntrePastas: preserva integralmente metadados e fichamento da obra', () => {
  const refCompleta = criarBookReferenceItem({
    id: 'ref_rica',
    titulo: 'Tratado de Regularização Fundiária',
    autores: [{ sobrenome: 'Silva', prenome: 'José' }],
    ano: '2024',
    tipo: 'livro',
    corCapa: '#FF6B2C',
    pastaId: 'pasta_urbanismo',
    quickSummary: 'Fichamento detalhado do capítulo 1',
    highlightsCount: 5,
    pinnedNotes: ['Nota crucial'],
    chaveZotero: 'ZOT888',
    driveFileId: 'drive_xyz_123',
    totalCitationsCount: 3,
    citedInDocumentIds: ['doc_1']
  });

  const resultado = moverReferenciaEntrePastas([refCompleta], 'ref_rica', 'pasta_metodologia');
  const mod = resultado.livroModificado;

  assert.equal(mod.titulo, 'Tratado de Regularização Fundiária');
  assert.deepEqual(mod.autores, [{ sobrenome: 'Silva', prenome: 'José' }]);
  assert.equal(mod.ano, '2024');
  assert.equal(mod.tipo, 'livro');
  assert.equal(mod.corCapa, '#FF6B2C');
  assert.equal(mod.quickSummary, 'Fichamento detalhado do capítulo 1');
  assert.equal(mod.highlightsCount, 5);
  assert.deepEqual(mod.pinnedNotes, ['Nota crucial']);
  assert.equal(mod.chaveZotero, 'ZOT888');
  assert.equal(mod.driveFileId, 'drive_xyz_123');
  assert.equal(mod.totalCitationsCount, 3);
  assert.deepEqual(mod.citedInDocumentIds, ['doc_1']);
});

test('2.3. moverReferenciaEntrePastas: idempotência ao mover para a mesma pasta', () => {
  const itens = criarItensExemplo();
  const resultado = moverReferenciaEntrePastas(itens, 'ref_1', 'pasta_urbanismo');
  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.pastaOrigemId, 'pasta_urbanismo');
  assert.equal(resultado.pastaDestinoId, 'pasta_urbanismo');
  assert.equal(resultado.mensagem, 'O livro já está nesta pasta.');
});

test('2.4. moverReferenciaEntrePastas: recusa movimentação para pasta compartilhada somente leitura', () => {
  const itens = criarItensExemplo();
  const pastas = criarPastasExemplo();
  const resultado = moverReferenciaEntrePastas(itens, 'ref_1', 'pasta_somente_leitura', { pastas });

  assert.equal(resultado.sucesso, false);
  assert.ok(resultado.erro.includes('somente leitura'));
  assert.equal(itens[0].pastaId, 'pasta_urbanismo', 'estado original não deve ser corrompido');
});

test('2.5. moverReferenciaEntrePastas: mover para "todas" normaliza destino para RAIZ_BIBLIOGRAFIA', () => {
  const itens = criarItensExemplo();
  const resultado = moverReferenciaEntrePastas(itens, 'ref_1', 'todas');

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.pastaDestinoId, RAIZ_BIBLIOGRAFIA);
  assert.equal(resultado.livroModificado.pastaId, RAIZ_BIBLIOGRAFIA);
});

test('2.6. moverReferenciaEntrePastas: livro inexistente retorna erro seguro', () => {
  const itens = criarItensExemplo();
  const resultado = moverReferenciaEntrePastas(itens, 'ref_inexistente_404', 'pasta_urbanismo');
  assert.equal(resultado.sucesso, false);
  assert.ok(resultado.erro.includes('não foi encontrado'));
});

// -----------------------------------------------------------------------------
// GRUPO 3: Atualização Reativa de Contadores (calcularContadoresPastas)
// -----------------------------------------------------------------------------

test('3.1. calcularContadoresPastas: computa contadores exatos em uma única passagem', () => {
  const itens = criarItensExemplo();
  const pastas = criarPastasExemplo();
  const contadores = calcularContadoresPastas(itens, pastas);

  assert.equal(contadores.get('todas'), 5, 'estante geral deve conter o total exato');
  assert.equal(contadores.get('pasta_urbanismo'), 2);
  assert.equal(contadores.get('pasta_metodologia'), 1);
  assert.equal(contadores.get(RAIZ_BIBLIOGRAFIA), 2, 'raiz deve somar ref_raiz e a ref_orfa');
  assert.equal(contadores.get('pasta_somente_leitura'), 0, 'pasta vazia deve ter contagem zero');
});

test('3.2. Dinâmica de Contadores ao Mover Livro: conservação do total geral e ajuste atômico', () => {
  const itens = criarItensExemplo();
  const pastas = criarPastasExemplo();

  const cAntes = calcularContadoresPastas(itens, pastas);
  assert.equal(cAntes.get('pasta_urbanismo'), 2);
  assert.equal(cAntes.get('pasta_metodologia'), 1);
  assert.equal(cAntes.get('todas'), 5);

  // Move ref_1 de urbanismo para metodologia
  const resultado = moverReferenciaEntrePastas(itens, 'ref_1', 'pasta_metodologia');
  const cDepois = calcularContadoresPastas(resultado.itens, pastas);

  assert.equal(cDepois.get('pasta_urbanismo'), 1, 'pasta origem decrementa em 1');
  assert.equal(cDepois.get('pasta_metodologia'), 2, 'pasta destino incrementa em 1');
  assert.equal(cDepois.get('todas'), 5, 'total da estante geral permanece estritamente constante');
});

test('3.3. Dinâmica de Contadores ao Mover Livro para a Raiz', () => {
  const itens = criarItensExemplo();
  const pastas = criarPastasExemplo();

  // Move ref_3 de metodologia para a raiz
  const resultado = moverReferenciaEntrePastas(itens, 'ref_3', RAIZ_BIBLIOGRAFIA);
  const cDepois = calcularContadoresPastas(resultado.itens, pastas);

  assert.equal(cDepois.get('pasta_metodologia'), 0);
  assert.equal(cDepois.get(RAIZ_BIBLIOGRAFIA), 3);
  assert.equal(cDepois.get('todas'), 5);
});
