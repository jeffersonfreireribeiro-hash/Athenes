// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarDocumento, criarNovoBloco, adicionarBlocoNaSecao, removerBlocoDaSecao,
  calcularLinhas, colocarBloco, moverBlocoPorLinha, moverParaLinha, duplicarBlocoNaSecao, linhaDoBloco
} from '../src/core/athenes_documento.js';

function docComTres() {
  const doc = criarDocumento({ secoes: [] });
  const sec = doc.secoes[0];
  sec.blocos = [];
  const a = criarNovoBloco('paragrafo', { texto: 'A' });
  const b = criarNovoBloco('paragrafo', { texto: 'B' });
  const c = criarNovoBloco('paragrafo', { texto: 'C' });
  sec.blocos.push(a, b, c);
  return { doc, sec, a, b, c };
}

describe('Athenes — Linhas e grupos de blocos', () => {
  it('soltar no meio de outro bloco cria um grupo lado a lado', () => {
    const { doc, sec, a, b, c } = docComTres();
    colocarBloco(doc, c.id, a.id, 'grupo', true);
    assert.deepEqual(sec.blocos.map(x => x.texto), ['A', 'C', 'B']);
    assert.equal(a.grupo, c.grupo);
    assert.ok(a.grupo);
    assert.equal(a.span, 6);
    assert.equal(c.span, 6);
    assert.equal(c.col, 7);
    assert.equal(calcularLinhas(sec.blocos).length, 2);
    assert.equal(b.span, 12);
  });

  it('o grupo aceita até 4 blocos e divide as 12 colunas igualmente', () => {
    const { doc, sec, a, b, c } = docComTres();
    colocarBloco(doc, b.id, a.id, 'grupo');
    colocarBloco(doc, c.id, a.id, 'grupo');
    assert.deepEqual(sec.blocos.map(x => x.span), [4, 4, 4]);
    assert.equal(linhaDoBloco(doc, c.id).quantidade, 3);
  });

  it('tirar um bloco do grupo dissolve a linha de um só bloco', () => {
    const { doc, sec, a, b } = docComTres();
    colocarBloco(doc, b.id, a.id, 'grupo');
    colocarBloco(doc, b.id, a.id, 'depois');
    assert.equal(a.grupo, null);
    assert.equal(a.span, 12);
    assert.equal(b.span, 12);
    assert.equal(calcularLinhas(sec.blocos).length, 3);
  });

  it('antes e depois reordenam em linha própria e remover limpa o grupo', () => {
    const { doc, sec, a, b, c } = docComTres();
    colocarBloco(doc, c.id, a.id, 'antes');
    assert.deepEqual(sec.blocos.map(x => x.texto), ['C', 'A', 'B']);
    colocarBloco(doc, b.id, a.id, 'grupo');
    removerBlocoDaSecao(doc, sec.id, b.id);
    assert.equal(a.grupo, null);
    assert.equal(a.span, 12);
  });

  it('mover por linha e para a linha N preservam a ordem e o texto', () => {
    const { doc, sec, a, b, c } = docComTres();
    moverBlocoPorLinha(doc, c.id, -1);
    assert.deepEqual(sec.blocos.map(x => x.texto), ['A', 'C', 'B']);
    moverParaLinha(doc, b.id, 1);
    assert.equal(b.grupo, a.grupo);
    assert.equal(linhaDoBloco(doc, a.id).quantidade, 2);
    const copia = duplicarBlocoNaSecao(doc, a.id);
    assert.equal(copia.texto, 'A');
    assert.equal(copia.grupo, null);
  });

  it('a repaginação mantém a linha agrupada na mesma página', () => {
    const doc = criarDocumento();
    const sec = doc.secoes.find(s => s.mestraId === 'corpo');
    const x = criarNovoBloco('paragrafo', { texto: 'x' });
    const y = criarNovoBloco('paragrafo', { texto: 'y' });
    sec.blocos.push(x, y);
    colocarBloco(doc, y.id, x.id, 'grupo');
    const pag = doc.paginas.find(p => p.blocos.includes(x));
    assert.ok(pag.blocos.includes(y));
  });
});
