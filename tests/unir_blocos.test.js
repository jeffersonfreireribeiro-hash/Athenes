// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';

test('unirBlocosTexto: une parágrafos em sequência (corrido ou em linhas) e recusa o que não dá', async () => {
  const { criarDocumento, criarNovoBloco, repaginarDocumento, unirBlocosTexto } = await import('../src/core/athenes_documento.js');
  const monta = () => {
    const doc = criarDocumento();
    const sec = doc.secoes[1] || doc.secoes[0];
    sec.blocos.length = 0;
    const a = criarNovoBloco('paragrafo', { texto: 'Primeiro.' });
    const b = criarNovoBloco('paragrafo', { texto: 'Segundo.' });
    const t = criarNovoBloco('titulo', { texto: 'Título', nivel: 2 });
    const c = criarNovoBloco('paragrafo', { texto: 'Terceiro.' });
    sec.blocos.push(a, b, t, c);
    repaginarDocumento(doc);
    return { doc, sec, a, b, t, c };
  };
  const m1 = monta();
  const r = unirBlocosTexto(m1.doc, [m1.b.id, m1.a.id]); // a ordem da seleção não importa
  assert.equal(r.bloco.id, m1.a.id);
  assert.equal(m1.a.texto, 'Primeiro. Segundo.');
  assert.deepEqual(m1.sec.blocos.map(x => x.id), [m1.a.id, m1.t.id, m1.c.id]);

  const m2 = monta();
  unirBlocosTexto(m2.doc, [m2.a.id, m2.b.id], 'linhas');
  assert.equal(m2.a.texto, 'Primeiro.<br>Segundo.');

  const m3 = monta();
  assert.equal(unirBlocosTexto(m3.doc, [m3.b.id, m3.c.id]), null, 'não une blocos separados por outro bloco');
  assert.equal(unirBlocosTexto(m3.doc, [m3.a.id, m3.t.id]), null, 'só parágrafos');
  assert.equal(unirBlocosTexto(m3.doc, [m3.a.id]), null, 'precisa de dois ou mais');
  assert.equal(m3.sec.blocos.length, 4, 'nada foi alterado');
});
