// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatarAutores,
  gerarCitacaoInline,
  formatarReferenciaCompleta,
  parseBibTeX
} from '../src/core/athenes_bibliografia.js';

describe('Athenes — Bibliografia e Citações', () => {
  it('formata autores nos padrões ABNT e APA', () => {
    const autores = [
      { sobrenome: 'Silva', prenome: 'José' },
      { sobrenome: 'Santos', prenome: 'Maria' }
    ];

    const abntRef = formatarAutores(autores, 'abnt', false);
    const abntTexto = formatarAutores(autores, 'abnt', true);
    const apaRef = formatarAutores(autores, 'apa', false);

    assert.equal(abntRef, 'SILVA, José; SANTOS, Maria');
    assert.equal(abntTexto, 'Silva e Santos');
    assert.equal(apaRef, 'Silva, J. & Santos, M.');
  });

  it('gera citação inline no formato pílula', () => {
    const ref = {
      autores: [{ sobrenome: 'Ribeiro', prenome: 'Carlos' }],
      ano: '2024'
    };

    const citAbnt = gerarCitacaoInline(ref, 'abnt', 1, '15');
    const citApa = gerarCitacaoInline(ref, 'apa', 1, '15');
    const citIeee = gerarCitacaoInline(ref, 'ieee', 3);

    assert.equal(citAbnt, '(RIBEIRO, 2024, p. 15)');
    assert.equal(citApa, '(Ribeiro, 2024, p. 15)');
    assert.equal(citIeee, '[3]');
  });

  it('formata referência completa para livro e artigo', () => {
    const livro = {
      tipo: 'livro',
      autores: [{ sobrenome: 'Freire', prenome: 'Paulo' }],
      titulo: 'Pedagogia da Autonomia',
      local: 'São Paulo',
      editora: 'Paz e Terra',
      ano: '1996'
    };

    const refAbnt = formatarReferenciaCompleta(livro, 'abnt');
    assert.ok(refAbnt.includes('FREIRE, Paulo'));
    assert.ok(refAbnt.includes('<strong>Pedagogia da Autonomia</strong>'));
    assert.ok(refAbnt.includes('São Paulo: Paz e Terra, 1996'));
  });

  it('faz parse de arquivo BibTeX offline', () => {
    const bib = `
@article{silva2023,
  author = {Silva, João and Oliveira, Ana},
  title = {Modelagem Urbana e Gestão Territorial},
  journal = {Revista Brasileira de Cartografia},
  year = {2023},
  volume = {75},
  number = {2},
  pages = {120--135},
  doi = {10.1234/rbc.2023.01}
}
    `;

    const itens = parseBibTeX(bib);
    assert.equal(itens.length, 1);
    assert.equal(itens[0].chave, 'silva2023');
    assert.equal(itens[0].titulo, 'Modelagem Urbana e Gestão Territorial');
    assert.equal(itens[0].ano, '2023');
    assert.equal(itens[0].autores.length, 2);
    assert.equal(itens[0].autores[0].sobrenome, 'Silva');
    assert.equal(itens[0].doi, '10.1234/rbc.2023.01');
  });
});
