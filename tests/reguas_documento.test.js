// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { passoDosNumerosMm, passoDosTracosMm, paginaEmFoco } from '../src/ui/athenes_reguas_documento.js';

test('passo dos números: cresce quando o zoom diminui, para o texto não se sobrepor', () => {
  assert.equal(passoDosNumerosMm(3.78), 20); // 100%: 1 número a cada 2 cm
  assert.equal(passoDosNumerosMm(15), 5);    // zoom grande: de 5 em 5 mm
  assert.equal(passoDosNumerosMm(0.9), 50);  // zoom pequeno
  assert.ok(passoDosNumerosMm(0.01) >= 100);
});

test('traços pequenos: 1 mm quando cabem; senão de 5 ou 10 em 10', () => {
  assert.equal(passoDosTracosMm(3.78), 1);
  assert.equal(passoDosTracosMm(1.2), 5);
  assert.equal(passoDosTracosMm(0.4), 10);
});

test('página em foco: a que contém o meio da tela; entre páginas, a mais próxima', () => {
  const caixas = [{ topo: -900, base: 100 }, { topo: 130, base: 1230 }, { topo: 1260, base: 2360 }];
  assert.equal(paginaEmFoco(caixas, 50), 0);
  assert.equal(paginaEmFoco(caixas, 600), 1);
  assert.equal(paginaEmFoco(caixas, 108), 0, 'no vão, a mais perto');
  assert.equal(paginaEmFoco(caixas, 125), 1);
  assert.equal(paginaEmFoco([], 10), -1);
});
