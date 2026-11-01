// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { construirGrafoConexoes } from '../src/core/athenes_conexoes.js';

describe('Athenes — Grafo de Conexões e Tratamento de Dados Ausentes', () => {
  it('constrói nós de obras, autores, anos e temas com arestas de relação', () => {
    const refs = [
      {
        id: 'ref1',
        titulo: 'Artigo sobre Geoprocessamento',
        autores: [{ prenome: 'Ana', sobrenome: 'Lima' }, { prenome: 'Bruno', sobrenome: 'Rocha' }],
        ano: '2023',
        palavrasChave: ['geoprocessamento', 'cartografia'],
        pais: 'Brasil'
      },
      {
        id: 'ref2',
        titulo: 'Sensoriamento Remoto Aplicado',
        autores: [{ prenome: 'Ana', sobrenome: 'Lima' }],
        ano: '2024',
        palavrasChave: ['geoprocessamento', 'satélites']
      }
    ];

    const grafo = construirGrafoConexoes(refs);

    assert.equal(grafo.totalReferencias, 2);
    assert.ok(grafo.nos.length >= 6);
    assert.ok(grafo.arestas.length >= 6);

    // Ana Lima aparece em 2 obras, conectando as duas pesquisas
    const noAna = grafo.nos.find(n => n.rotulo === 'Ana Lima');
    assert.ok(noAna);
    assert.ok(noAna.grau >= 2);

    // Coautoria detectada entre Ana e Bruno
    const arestaCoautoria = grafo.arestas.find(a => a.tipo === 'coautoria');
    assert.ok(arestaCoautoria);
  });

  it('sinaliza explicitamente quando metadados (como país ou tema) estão ausentes', () => {
    const refsIncompletas = [
      {
        id: 'ref_incompleta',
        titulo: 'Documento Antigo Sem Dados',
        autores: [],
        ano: '',
        palavrasChave: []
      }
    ];

    const grafo = construirGrafoConexoes(refsIncompletas);

    assert.ok(grafo.dadosAusentes > 0);
    const noAutorAusente = grafo.nos.find(n => n.id === 'autor_ausente');
    const noAnoAusente = grafo.nos.find(n => n.id === 'ano_ausente');
    const noLocalAusente = grafo.nos.find(n => n.id === 'local_ausente');

    assert.ok(noAutorAusente && noAutorAusente.dadoAusente);
    assert.ok(noAnoAusente && noAnoAusente.dadoAusente);
    assert.ok(noLocalAusente && noLocalAusente.dadoAusente);
  });
});
