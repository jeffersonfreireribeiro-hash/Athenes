// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { larguraAoArrastar, lerEstadoColunas, gravarEstadoColunas } from '../src/ui/athenes_colunas_redim.js';

const caixa = { left: 100, right: 1500 };

test('arrastar a borda esquerda e a direita dá a largura da coluna, dentro dos limites', () => {
  assert.equal(larguraAoArrastar('esq', 500, caixa, 12, { min: 200, max: 640 }), 394);
  assert.equal(larguraAoArrastar('esq', 120, caixa, 12, { min: 200, max: 640 }), 200, 'não passa do mínimo');
  assert.equal(larguraAoArrastar('esq', 1200, caixa, 12, { min: 200, max: 640 }), 640, 'não passa do máximo');
  assert.equal(larguraAoArrastar('dir', 1100, caixa, 12, { min: 240, max: 720 }), 394);
  assert.equal(larguraAoArrastar('dir', 1490, caixa, 12, { min: 240, max: 720 }), 240);
});

test('largura e estado das colunas ficam lembrados por tela; armazenamento quebrado não derruba', () => {
  const m = new Map(); const arm = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  gravarEstadoColunas('editor', { esq: 400, fechadaDir: true }, arm);
  assert.deepEqual(lerEstadoColunas('editor', arm), { esq: 400, fechadaDir: true });
  assert.deepEqual(lerEstadoColunas('estudio', arm), {});
  const ruim = { getItem: () => '{nao json', setItem: () => { throw new Error('cheio'); } };
  assert.deepEqual(lerEstadoColunas('x', ruim), {});
  assert.doesNotThrow(() => gravarEstadoColunas('x', {}, ruim));
});
