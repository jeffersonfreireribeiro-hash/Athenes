// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  dimensoesPapelMm,
  calcularAreaUtilMm,
  calcularGrade,
  aplicarSnap
} from '../src/core/athenes_grid.js';

describe('Athenes — Grid, Dimensões e Snap', () => {
  it('retorna dimensões corretas para A4 retrato e paisagem', () => {
    const ret = dimensoesPapelMm('A4', 'retrato');
    const pai = dimensoesPapelMm('A4', 'paisagem');

    assert.equal(ret.largura_mm, 210);
    assert.equal(ret.altura_mm, 297);

    assert.equal(pai.largura_mm, 297);
    assert.equal(pai.altura_mm, 210);
  });

  it('calcula área útil descontando margens físicas', () => {
    const modelo = {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 30, r: 20, b: 20, l: 30 }
    };
    const area = calcularAreaUtilMm(modelo);

    assert.equal(area.papel_w, 210);
    assert.equal(area.papel_h, 297);
    assert.equal(area.largura_util, 210 - 30 - 20); // 160 mm
    assert.equal(area.altura_util, 297 - 30 - 20);  // 247 mm
  });

  it('calcula grade de 2 colunas com gutter proporcional', () => {
    const modelo = {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 20, r: 20, b: 20, l: 20 }, // util = 170 mm
      grade: { colunas: 2, gap_mm: 10 }
    };
    const grade = calcularGrade(modelo);

    // (170 - 10) / 2 = 80 mm por coluna
    assert.equal(grade.largura_coluna_mm, 80);
    assert.equal(grade.larguraBlocoMm(1), 80);
    assert.equal(grade.larguraBlocoMm(2), 170); // 2 colunas + 1 gap = 80*2 + 10 = 170
    assert.equal(grade.posicaoXColunaMm(1), 0);
    assert.equal(grade.posicaoXColunaMm(2), 90); // 80 + 10 = 90
  });

  it('aplica snap magnético para pontos próximos', () => {
    const pontos = [0, 80, 90, 170];
    const s1 = aplicarSnap(79.2, pontos, 2.0);
    const s2 = aplicarSnap(50.0, pontos, 2.0);

    assert.equal(s1.encaixou, true);
    assert.equal(s1.valor, 80);

    assert.equal(s2.encaixou, false);
    assert.equal(s2.valor, 50.0);
  });
});
