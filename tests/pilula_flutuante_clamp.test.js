// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampPosicaoPilula } from '../src/ui/athenes_editor_barra_contextual.js';

describe('Athenes — Geometria e Clamping da Pílula Flutuante Móvel (R2)', () => {
  const rectBlocoPadrao = {
    left: 200,
    top: 300,
    right: 800,
    bottom: 500,
    width: 600,
    height: 200
  };

  const areaVisivelPadrao = {
    left: 0,
    top: 50,
    right: 1200,
    bottom: 900,
    width: 1200,
    height: 850
  };

  const dimPillPadrao = {
    width: 220,
    height: 36
  };

  it('1. Posição perfeitamente válida dentro da margem do bloco é preservada', () => {
    const pos = { left: 350, top: 400 };
    const res = clampPosicaoPilula(pos, rectBlocoPadrao, areaVisivelPadrao, dimPillPadrao, 80);
    assert.equal(res.left, 350, 'Coordenada left válida deve ser mantida');
    assert.equal(res.top, 400, 'Coordenada top válida deve ser mantida');
  });

  it('2. Clamp à esquerda: arrastar muito à esquerda trava exatamente no limite permitido', () => {
    // Bloco left = 200, margem = 80 -> bMinX = 200 - 80 = 120. Viewport min = 0 + 8 = 8.
    // minX = Math.max(120, 8) = 120.
    const pos = { left: -300, top: 400 };
    const res = clampPosicaoPilula(pos, rectBlocoPadrao, areaVisivelPadrao, dimPillPadrao, 80);
    assert.equal(res.left, 120, 'Deve travar na margem máxima permitida à esquerda do bloco');
    assert.equal(res.top, 400);
  });

  it('3. Clamp à direita: arrastar muito à direita trava no limite direito com margem e dimensão da pílula', () => {
    // Bloco right = 800, margem = 80 -> bMaxX = 800 + 80 - 220 = 660. Viewport max = 1200 - 220 - 8 = 972.
    // maxX = Math.min(660, 972) = 660.
    const pos = { left: 1500, top: 400 };
    const res = clampPosicaoPilula(pos, rectBlocoPadrao, areaVisivelPadrao, dimPillPadrao, 80);
    assert.equal(res.left, 660, 'Deve travar no limite direito considerando a largura da pílula');
    assert.equal(res.top, 400);
  });

  it('4. Clamp ao topo: arrastar muito para cima trava no limite superior com margem', () => {
    // Bloco top = 300, margem = 80 -> bMinY = 300 - 80 = 220. Viewport min = 50 + 8 = 58.
    // minY = Math.max(220, 58) = 220.
    const pos = { left: 400, top: -100 };
    const res = clampPosicaoPilula(pos, rectBlocoPadrao, areaVisivelPadrao, dimPillPadrao, 80);
    assert.equal(res.left, 400);
    assert.equal(res.top, 220, 'Deve travar na margem máxima permitida acima do bloco');
  });

  it('5. Clamp ao fundo: arrastar muito para baixo trava no limite inferior', () => {
    // Bloco bottom = 500, margem = 80, height = 36 -> bMaxY = 500 + 80 - 36 = 544. Viewport max = 900 - 36 - 8 = 856.
    // maxY = Math.min(544, 856) = 544.
    const pos = { left: 400, top: 2000 };
    const res = clampPosicaoPilula(pos, rectBlocoPadrao, areaVisivelPadrao, dimPillPadrao, 80);
    assert.equal(res.left, 400);
    assert.equal(res.top, 544, 'Deve travar na margem máxima permitida abaixo do bloco');
  });

  it('6. Viewport precedence: bloco colado na borda da tela respeita padding mínimo de 8px da tela', () => {
    // Bloco colado no topo esquerdo da tela (left=5, top=2)
    const blocoBorda = {
      left: 5,
      top: 2,
      right: 400,
      bottom: 200,
      width: 395,
      height: 198
    };
    const areaTela = {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800
    };

    // Bloco com margem iria para left = 5 - 80 = -75, mas a viewport exige >= 8px
    const posExtremo = { left: -100, top: -50 };
    const res = clampPosicaoPilula(posExtremo, blocoBorda, areaTela, dimPillPadrao, 80);
    assert.equal(res.left, 8, 'Viewport mínima de 8px deve impedir que a pílula suma para fora da tela');
    assert.equal(res.top, 8, 'Viewport mínima de 8px no topo deve ser respeitada');
  });

  it('7. Margem e dimensões omitidas assumem defaults seguros (margem=80, width=220, height=36)', () => {
    const pos = { left: 9999, top: 9999 };
    const res = clampPosicaoPilula(pos, rectBlocoPadrao, areaVisivelPadrao);
    assert.ok(Number.isFinite(res.left), 'Left deve ser um número finito');
    assert.ok(Number.isFinite(res.top), 'Top deve ser um número finito');
    // Com dim default width=220, height=36 e margem=80:
    // bMaxX = 800 + 80 - 220 = 660
    // bMaxY = 500 + 80 - 36 = 544
    assert.equal(res.left, 660);
    assert.equal(res.top, 544);
  });

  it('8. Bloco estreito (menor que a pílula) mantém estabilidade sem NaN nem inversão de limites', () => {
    const blocoEstreito = {
      left: 400,
      top: 200,
      right: 450,
      bottom: 250,
      width: 50,
      height: 50
    };
    const pillLarga = { width: 300, height: 40 };

    const pos = { left: 420, top: 210 };
    const res = clampPosicaoPilula(pos, blocoEstreito, areaVisivelPadrao, pillLarga, 80);
    assert.ok(Number.isFinite(res.left), 'Left deve ser número válido');
    assert.ok(Number.isFinite(res.top), 'Top deve ser número válido');
    assert.ok(!Number.isNaN(res.left));
    assert.ok(!Number.isNaN(res.top));
  });

  it('9. Entradas nulas ou degeneradas retornam coordenadas de fallback seguras', () => {
    assert.deepEqual(clampPosicaoPilula(null, rectBlocoPadrao, areaVisivelPadrao), { left: 0, top: 0 });
    const pos = { left: 150, top: 250 };
    assert.deepEqual(clampPosicaoPilula(pos, null, areaVisivelPadrao), pos, 'Sem rectBloco, retorna pos original');
  });
});
