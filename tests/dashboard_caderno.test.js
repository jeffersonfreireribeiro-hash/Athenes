import test from 'node:test';
import assert from 'node:assert/strict';
import { obterDadosCaderno } from '../src/ui/athenes_dashboard_caderno.js';

test('caderno mostra referências, resumo e informações reais do relatório', () => {
  const dados = obterDadosCaderno({
    titulo: 'Relatório de Campo',
    tipoDoc: 'relatorio_tecnico',
    estado: 'em_revisao',
    metadados: {
      autores: [{ nome: 'Ana Costa' }],
      ano: '2026',
      resumo: 'Análise da área estudada.',
      instituicao: 'Universidade Athenes'
    },
    secoes: [{}, {}],
    paginas: [{}],
    referencias: [
      { titulo: 'Método de pesquisa', autores: [{ prenome: 'Paulo', sobrenome: 'Silva' }], ano: '2024' },
      { title: 'Dados territoriais', autores: ['Instituto A'], ano: '2025' }
    ]
  });

  assert.equal(dados.titulo, 'Relatório de Campo');
  assert.equal(dados.autor, 'Ana Costa');
  assert.equal(dados.resumo, 'Análise da área estudada.');
  assert.equal(dados.estado, 'Em revisão');
  assert.equal(dados.secoes, 2);
  assert.equal(dados.paginas, 1);
  assert.deepEqual(dados.referencias, [
    { titulo: 'Método de pesquisa', detalhe: 'Paulo Silva · 2024' },
    { titulo: 'Dados territoriais', detalhe: 'Instituto A · 2025' }
  ]);
});

test('caderno lida com documento resumido sem referências carregadas', () => {
  const dados = obterDadosCaderno({ titulo: 'Rascunho', referencias: null });
  assert.equal(dados.referencias.length, 0);
  assert.equal(dados.autor, 'Autor não informado');
  assert.equal(dados.paginas, 0);
});
