// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { fonteEhVariavel, faixaDePesos, registrarFonteImportada, removerFonteImportada, cssFontesImportadas } from '../src/core/athenes_fontes.js';
import { criarDocumento } from '../src/core/athenes_documento.js';

function sfnt(tags) {
  const b = Buffer.alloc(12 + tags.length * 16);
  b.writeUInt32BE(0x00010000, 0);
  b.writeUInt16BE(tags.length, 4);
  tags.forEach((t, i) => b.write(t, 12 + i * 16, 'latin1'));
  return `data:font/ttf;base64,${b.toString('base64')}`;
}

test('fonte variável (tem fvar) cobre a faixa de pesos; estática declara 400 e o negrito é sintetizado', () => {
  assert.equal(fonteEhVariavel({ dataUrl: sfnt(['glyf', 'fvar', 'head']), nome: 'X' }), true);
  assert.equal(fonteEhVariavel({ dataUrl: sfnt(['glyf', 'head']), nome: 'X' }), false);
  assert.equal(fonteEhVariavel({ dataUrl: '', nome: 'Inter Variable' }), true, 'sem cabeçalho legível vale o nome');
  assert.equal(fonteEhVariavel({ dataUrl: '', nome: 'Aptos' }), false);
  assert.equal(faixaDePesos({ variavel: true }), '100 900');
  assert.equal(faixaDePesos({ variavel: false }), '400');
});

test('@font-face do PDF segue a mesma regra', () => {
  const doc = criarDocumento();
  doc.estilos.find(e => e.id === 'corpo').fonte = 'fonte_estatica_x';
  registrarFonteImportada({ id: 'fonte_estatica_x', nome: 'Estatica X', dataUrl: sfnt(['glyf', 'head']) });
  assert.match(cssFontesImportadas(doc), /font-weight:400;/);
  removerFonteImportada('fonte_estatica_x');
  doc.estilos.find(e => e.id === 'corpo').fonte = 'fonte_var_x';
  registrarFonteImportada({ id: 'fonte_var_x', nome: 'Var X', dataUrl: sfnt(['glyf', 'fvar']) });
  assert.match(cssFontesImportadas(doc), /font-weight:100 900;/);
  removerFonteImportada('fonte_var_x');
});
