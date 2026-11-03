// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { tipoEntrelinhaDoEstilo, aplicarTipoEntrelinha, entrelinhaEfetiva, estiloParaCss, TIPOS_ENTRELINHA } from '../src/core/athenes_estilos.js';
import { sanitizarEstiloAvancado } from '../src/core/athenes_estilo_avancado.js';
import { obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

test('tipos de espaçamento entre linhas usam os nomes do Word', () => {
  assert.deepEqual(TIPOS_ENTRELINHA.map(t => t.rotulo), ['Simples', '1,5 linhas', 'Duplo', 'Pelo menos', 'Exatamente', 'Múltiplos']);
  assert.equal(tipoEntrelinhaDoEstilo({ entrelinha: 1 }), 'simples');
  assert.equal(tipoEntrelinhaDoEstilo({ entrelinha: 1.5 }), '1_5');
  assert.equal(tipoEntrelinhaDoEstilo({ entrelinha: 2 }), 'duplo');
  assert.equal(tipoEntrelinhaDoEstilo({ entrelinha: 1.15 }), 'multiplos');
  assert.equal(tipoEntrelinhaDoEstilo({ entrelinha: 1.5, entrelinha_tipo: 'exatamente', entrelinha_pt: 18 }), 'exatamente');
});

test('Exatamente e Pelo menos usam pontos e acompanham o tamanho da fonte', () => {
  const e = { fonte: 'times', tamanho_pt: 12 };
  aplicarTipoEntrelinha(e, 'exatamente', 18);
  assert.equal(e.entrelinha_pt, 18);
  assert.equal(entrelinhaEfetiva(e), 1.5);
  assert.match(estiloParaCss(e), /line-height: 1\.5;/);
  e.tamanho_pt = 9;
  assert.equal(entrelinhaEfetiva(e), 2); // 18 pt continua 18 pt
  aplicarTipoEntrelinha(e, 'pelo_menos', 6);
  assert.equal(entrelinhaEfetiva(e), 1.149); // nunca menor que a linha simples
  aplicarTipoEntrelinha(e, 'duplo');
  assert.equal(e.entrelinha_tipo, undefined);
  assert.equal(e.entrelinha, 2);
  aplicarTipoEntrelinha(e, 'multiplos', 1.15);
  assert.equal(e.entrelinha, 1.15);
});

test('o pacote de tema saneia e documenta os campos de entrelinha', () => {
  assert.equal(sanitizarEstiloAvancado({ id: 'a', entrelinha_tipo: 'exatamente', entrelinha_pt: 9999 }).entrelinha_pt, 400);
  const sem = sanitizarEstiloAvancado({ id: 'a', entrelinha_tipo: 'bobagem', entrelinha_pt: 12 });
  assert.equal(sem.entrelinha_tipo, undefined);
  assert.equal(sem.entrelinha_pt, undefined);
  const prompt = obterPromptIaParaExtracaoDeLayout();
  assert.match(prompt, /entrelinha_tipo/);
  assert.match(prompt, /Pelo menos/);
  assert.match(prompt, /Deslocamento/);
});
