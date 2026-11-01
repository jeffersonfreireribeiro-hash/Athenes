// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarDocumento,
  criarNovoBloco,
  adicionarBlocoNaSecao,
  recalcularNumeracaoAutomatica,
  gerarListaFiguras,
  gerarListaMapas,
  gerarListaTabelas,
  gerarListaQuadros,
  resolverReferenciasCruzadas
} from '../src/core/athenes_documento.js';

describe('Athenes — Blocos Compostos, Numeração Separada e Referências Cruzadas', () => {
  it('cria blocos compostos próprios para figura, mapa, tabela e quadro', () => {
    const fig = criarNovoBloco('figura', {
      titulo: 'Figura 1 — Ensaio morfológico',
      layout: '2_lado',
      itens: [
        { url: 'img1.png', legenda_sub: 'Vista anterior' },
        { url: 'img2.png', legenda_sub: 'Vista posterior' }
      ],
      fonte: 'Fonte: Arquivo pessoal dos autores.'
    });
    assert.equal(fig.tipo, 'figura');
    assert.equal(fig.layout, '2_lado');
    assert.equal(fig.itens.length, 2);

    const mapa = criarNovoBloco('mapa', {
      titulo: 'Mapa 1 — Delimitação do Núcleo',
      escala: '1:5.000',
      orientacao_norte: true,
      legenda_cartografica: 'Perímetro e vias de acesso.'
    });
    assert.equal(mapa.tipo, 'mapa');
    assert.equal(mapa.escala, '1:5.000');
    assert.equal(mapa.orientacao_norte, true);

    const tab = criarNovoBloco('tabela', {
      titulo: 'Tabela 1 — Dados numéricos',
      colunas: ['Ano', 'Total'],
      linhas: [['2025', '100'], ['2026', '150']]
    });
    assert.equal(tab.tipo, 'tabela');
    assert.equal(tab.bordas_abertas, true); // padrão ABNT aberto

    const quadro = criarNovoBloco('quadro', {
      titulo: 'Quadro 1 — Categorias conceituais',
      colunas: ['Tipo', 'Descrição'],
      linhas: [['A', 'Texto descritivo A'], ['B', 'Texto descritivo B']]
    });
    assert.equal(quadro.tipo, 'quadro');
    assert.equal(quadro.bordas_fechadas, true); // padrão Quadro fechado
  });

  it('mantém sequências de numeração separadas para figuras, mapas, tabelas e quadros', () => {
    const doc = criarDocumento();
    const corpoSec = doc.secoes.find(s => s.mestraId === 'corpo');

    // Adiciona figura, tabela, quadro, outra figura, mapa, outra tabela
    adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('figura', { titulo: 'Figura X — Primeira Figura' }));
    adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('tabela', { titulo: 'Tabela X — Primeira Tabela' }));
    adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('quadro', { titulo: 'Quadro X — Primeiro Quadro' }));
    adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('figura', { titulo: 'Figura X — Segunda Figura' }));
    adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('mapa', { titulo: 'Mapa X — Primeiro Mapa' }));
    adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('tabela', { titulo: 'Tabela X — Segunda Tabela' }));

    const cont = recalcularNumeracaoAutomatica(doc);
    assert.equal(cont.figuras, 2);
    assert.equal(cont.mapas, 1);
    assert.equal(cont.tabelas, 3); // 1 pré-existente no doc padrão + 2 novas
    assert.equal(cont.quadros, 1);

    // Listas pré-textuais automáticas
    const listaFiguras = gerarListaFiguras(doc);
    assert.equal(listaFiguras.length, 2);
    assert.equal(listaFiguras[0].rotulo, 'Figura 1');
    assert.equal(listaFiguras[1].rotulo, 'Figura 2');

    const listaMapas = gerarListaMapas(doc);
    assert.equal(listaMapas.length, 1);
    assert.equal(listaMapas[0].rotulo, 'Mapa 1');

    const listaQuadros = gerarListaQuadros(doc);
    assert.equal(listaQuadros.length, 1);
    assert.equal(listaQuadros[0].rotulo, 'Quadro 1');
  });

  it('resolve referências cruzadas interativas no texto', () => {
    const doc = criarDocumento();
    const corpoSec = doc.secoes.find(s => s.mestraId === 'corpo');

    const fig1 = adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('figura', { titulo: 'Figura 1 — Esquema de fluxo' }));
    const tab1 = adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('tabela', { titulo: 'Tabela 1 — Amostragem' }));
    const qua1 = adicionarBlocoNaSecao(doc, corpoSec.id, criarNovoBloco('quadro', { titulo: 'Quadro 1 — Normas' }));

    const textoComRef = `Como ilustrado na [ref:figura:${fig1.id}], os resultados constam na [ref:tabela:${tab1.id}] e as diretrizes no [ref:quadro:${qua1.id}].`;
    const textoResolvido = resolverReferenciasCruzadas(textoComRef, doc);

    assert.match(textoResolvido, /Figura \d+/);
    assert.match(textoResolvido, /Tabela \d+/);
    assert.match(textoResolvido, /Quadro 1/);
    assert.doesNotMatch(textoResolvido, /\[ref:/);
  });
});
