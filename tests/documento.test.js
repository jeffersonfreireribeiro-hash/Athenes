// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  criarDocumento,
  criarNovoBloco,
  modeloDaPagina,
  gerarSumarioDinamico,
  calcularEstatisticas
} from '../src/core/athenes_documento.js';

describe('Athenes — Modelo de Documento e Blocos', () => {
  it('cria documento padrão com capa, corpo e referências', () => {
    const doc = criarDocumento({
      titulo: 'Análise Espacial de Reurbanização',
      subtitulo: 'Estudo de caso no município de Fortaleza',
      perfilId: 'abnt'
    });

    assert.equal(doc.titulo, 'Análise Espacial de Reurbanização');
    assert.equal(doc.perfil, 'abnt');
    assert.equal(doc.paginas.length, 3);
    assert.equal(doc.paginas[0].modeloId, 'capa');
    assert.equal(doc.paginas[1].modeloId, 'corpo');
    assert.equal(doc.paginas[2].modeloId, 'referencias');
  });

  it('permite criar novos blocos com propriedades consistentes', () => {
    const bTitulo = criarNovoBloco('titulo', { texto: '3. DISCUSSÃO', nivel: 1 });
    const bTabela = criarNovoBloco('tabela', { titulo: 'Tabela 2' });
    const bCitacao = criarNovoBloco('citacao', { texto: 'Texto citado', autor: 'SOUZA, M.', ano: '2025' });

    assert.equal(bTitulo.tipo, 'titulo');
    assert.equal(bTitulo.nivel, 1);
    assert.equal(bTabela.tipo, 'tabela');
    assert.ok(Array.isArray(bTabela.colunas));
    assert.equal(bCitacao.tipo, 'citacao');
    assert.equal(bCitacao.autor, 'SOUZA, M.');
  });

  it('herda modelo da página corretamente', () => {
    const doc = criarDocumento();
    const pagCorpo = doc.paginas[1];
    const mod = modeloDaPagina(doc, pagCorpo);

    assert.ok(mod);
    assert.equal(mod.id, 'corpo');
    assert.equal(mod.tipo, 'corpo');
    assert.ok(mod.margens_mm.t > 0);
  });

  it('gera sumário dinâmico a partir dos títulos das páginas', () => {
    const doc = criarDocumento();
    const sumario = gerarSumarioDinamico(doc);

    assert.ok(Array.isArray(sumario));
    assert.ok(sumario.length >= 2);
    assert.equal(sumario[0].texto, '1. INTRODUÇÃO');
    assert.equal(sumario[0].pagina, 2);
    assert.equal(sumario[1].texto, '2. METODOLOGIA E RESULTADOS');
    assert.equal(sumario[1].pagina, 2);
  });

  it('calcula estatísticas de palavras, caracteres, páginas e tabelas', () => {
    const doc = criarDocumento();
    const stats = calcularEstatisticas(doc);

    assert.equal(stats.paginas, 3);
    assert.ok(stats.palavras > 20);
    assert.ok(stats.caracteres > 100);
    assert.ok(stats.tabelas >= 1);
    assert.ok(stats.citacoes >= 1);
  });
});
