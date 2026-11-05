// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { passoDosNumerosMm, passoDosTracosMm, paginaEmFoco, desenharRegua } from '../src/ui/athenes_reguas_documento.js';

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

test('desenharRegua desenha faixa destacada e linha azul escura para caixa selecionada', () => {
  const operacoes = [];
  const mockCtx = {
    setTransform: () => {},
    clearRect: () => {},
    fillRect: (...args) => operacoes.push({ tipo: 'fillRect', args, fillStyle: mockCtx.fillStyle }),
    beginPath: () => operacoes.push({ tipo: 'beginPath' }),
    moveTo: (x, y) => operacoes.push({ tipo: 'moveTo', x, y }),
    lineTo: (x, y) => operacoes.push({ tipo: 'lineTo', x, y }),
    stroke: () => operacoes.push({ tipo: 'stroke', strokeStyle: mockCtx.strokeStyle, lineWidth: mockCtx.lineWidth }),
    closePath: () => {},
    fill: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    style: {}
  };
  const mockCanvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => mockCtx
  };

  // Testa eixo horizontal com seleção
  desenharRegua(mockCanvas, {
    eixo: 'h',
    comprimentoPx: 800,
    espessura: 20,
    origem: 50,
    pxPorMm: 3.78,
    mm: 210,
    margens: [20, 20],
    selecao: { inicio: 100, fim: 350 }
  });

  const faixas = operacoes.filter(op => op.tipo === 'fillRect');
  const faixaSel = faixas.find(f => f.fillStyle === 'rgba(49, 79, 121, 0.16)');
  assert.ok(faixaSel, 'deve desenhar a faixa de destaque da seleção');
  assert.equal(faixaSel.args[0], 100);
  assert.equal(faixaSel.args[2], 250); // 350 - 100 = 250px

  const strokes = operacoes.filter(op => op.tipo === 'stroke');
  const linhaEscura = strokes.find(s => s.strokeStyle === '#172E4E' && s.lineWidth === 2.5);
  assert.ok(linhaEscura, 'deve traçar a linha azul mais escura marcando na régua o tamanho');

  // Testa eixo vertical com seleção
  operacoes.length = 0;
  desenharRegua(mockCanvas, {
    eixo: 'v',
    comprimentoPx: 1000,
    espessura: 20,
    origem: 40,
    pxPorMm: 3.78,
    mm: 297,
    margens: [20, 20],
    selecao: { inicio: 120, fim: 280 }
  });

  const faixaSelV = operacoes.filter(op => op.tipo === 'fillRect').find(f => f.fillStyle === 'rgba(49, 79, 121, 0.16)');
  assert.ok(faixaSelV, 'deve desenhar a faixa vertical');
  const linhaEscuraV = operacoes.filter(op => op.tipo === 'stroke').find(s => s.strokeStyle === '#172E4E' && s.lineWidth === 2.5);
  assert.ok(linhaEscuraV, 'deve traçar a linha vertical escura delimitadora');
});
