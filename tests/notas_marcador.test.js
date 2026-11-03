// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { obterConfigNotas, textoMarcadorNota, cssMarcadoresNota } from '../src/core/athenes_notas_rodape.js';
import { exportarPacoteEstilo, validarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';
import { criarDocumento } from '../src/core/athenes_documento.js';

test('formato do marcador da nota: [1], (1), 1) e 1. (numeros, letras e simbolos)', () => {
  assert.equal(textoMarcadorNota(3), '3');
  assert.equal(textoMarcadorNota(3, 'numerico', 'colchetes'), '[3]');
  assert.equal(textoMarcadorNota(3, 'numerico', 'parenteses'), '(3)');
  assert.equal(textoMarcadorNota(3, 'numerico', 'parentese_direito'), '3)');
  assert.equal(textoMarcadorNota(3, 'numerico', 'ponto'), '3.');
  assert.equal(textoMarcadorNota(2, 'alfabetico', 'colchetes'), '[b]');
  assert.equal(textoMarcadorNota(2, 'simbolos', 'parenteses'), '(†)');
});

test('configuracao: padrao igual ao de antes; [1] vem na linha do texto; valores invalidos caem no padrao', () => {
  const pad = obterConfigNotas({});
  assert.equal(pad.formato, 'simples');
  assert.deepEqual(pad.marcador_texto, { fonte: '', cor: '', negrito: true, sobrescrito: true });
  const col = obterConfigNotas({ notas_config: { formato: 'colchetes' } });
  assert.equal(col.marcador_texto.sobrescrito, false);
  assert.equal(col.marcador_nota.sobrescrito, false);
  const livre = obterConfigNotas({ notas_config: { formato: 'colchetes', marcador_texto: { sobrescrito: true, cor: '#FF0000', negrito: false, fonte: 'times' } } });
  assert.deepEqual(livre.marcador_texto, { fonte: 'times', cor: '#FF0000', negrito: false, sobrescrito: true });
  const ruim = obterConfigNotas({ notas_config: { formato: 'xx', marcador_nota: { cor: 'vermelho', fonte: '<script>' } } });
  assert.equal(ruim.formato, 'simples');
  assert.equal(ruim.marcador_nota.cor, '');
  assert.equal(ruim.marcador_nota.fonte, '');
});

test('CSS dos marcadores: cor, fonte, negrito e sobrescrito do texto e do rodape', () => {
  const cfg = obterConfigNotas({ notas_config: { formato: 'colchetes', marcador_texto: { cor: '#C00000', fonte: 'times' }, marcador_nota: { negrito: false } } });
  const css = cssMarcadoresNota(cfg, '#x ', id => (id === 'times' ? "'Times New Roman'" : ''));
  assert.match(css, /#x sup\.ath-nota-ref\{font-family:'Times New Roman';color:#C00000;font-weight:700;vertical-align:baseline/);
  assert.match(css, /#x \.ath-nota-num\{font-weight:400;font-size:1em/);
});

test('pacote de tema leva o estilo e o formato dos marcadores das notas; o prompt os descreve', () => {
  const doc = criarDocumento();
  doc.notas_config = { formato: 'colchetes', marcador_texto: { cor: '#C00000', negrito: false } };
  const pacote = exportarPacoteEstilo(doc);
  assert.equal(pacote.configuracaoGlobal.notas_rodape.formato, 'colchetes');
  const v = validarPacoteEstilo(JSON.stringify(pacote));
  assert.equal(v.pacote.configuracaoGlobal.notas_rodape.marcador_texto.cor, '#C00000');
  assert.equal(v.pacote.configuracaoGlobal.notas_rodape.marcador_texto.negrito, false);
  assert.match(obterPromptIaParaExtracaoDeLayout(), /marcador_texto/);
});
