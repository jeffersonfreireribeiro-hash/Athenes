// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ZoteroClient } from '../src/core/athenes_zotero.js';

describe('Athenes — Cliente Zotero e Leitura', () => {
  it('inicializa cliente com parâmetros corretos e gera URLs oficiais', () => {
    const client = new ZoteroClient({
      userId: '1234567',
      apiKey: 'xyzKeySecret123',
      isGroup: false
    });

    assert.equal(client.getBaseUrl(), 'https://api.zotero.org/users/1234567');
    const headers = client.getHeaders();
    assert.equal(headers['Zotero-API-Version'], '3');
    assert.equal(headers['Zotero-API-Key'], 'xyzKeySecret123');
  });

  it('normaliza item da Zotero API para o padrão do Athenes', () => {
    const client = new ZoteroClient();
    const itemBruto = {
      key: 'ABCD1234',
      version: 12,
      data: {
        itemType: 'journalArticle',
        title: 'Algoritmos de Diagramação para Publicação Científica',
        creators: [
          { lastName: 'Mendes', firstName: 'Roberta' },
          { lastName: 'Castro', firstName: 'Eduardo' }
        ],
        publicationTitle: 'Computação Gráfica e Documentos',
        volume: '14',
        issue: '3',
        pages: '45-60',
        date: '2024-05-10',
        DOI: '10.5555/cgd.2024.14',
        abstractNote: 'Este trabalho apresenta novos algoritmos de diagramação em blocos.',
        tags: [{ tag: 'diagramação' }, { tag: 'artigos' }],
        collections: ['COL1', 'COL2']
      }
    };

    const norm = client.normalizarItemZotero(itemBruto);
    assert.equal(norm.id, 'ABCD1234');
    assert.equal(norm.tipo, 'artigo_periodico');
    assert.equal(norm.titulo, 'Algoritmos de Diagramação para Publicação Científica');
    assert.equal(norm.ano, '2024');
    assert.equal(norm.autores.length, 2);
    assert.equal(norm.autores[0].sobrenome, 'Mendes');
    assert.equal(norm.doi, '10.5555/cgd.2024.14');
    assert.equal(norm.palavrasChave.length, 2);
  });

  it('permite carregar itens via BibTeX em modo offline', () => {
    const client = new ZoteroClient();
    const bib = `@book{turing1950, author={Turing, Alan}, title={Computing Machinery and Intelligence}, year={1950}}`;
    const itens = client.importarBibTeX(bib);

    assert.equal(itens.length, 1);
    assert.equal(client.cacheItens.size, 1);
    assert.ok(client.cacheItens.has('turing1950'));
  });
});
