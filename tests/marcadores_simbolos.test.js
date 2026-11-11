// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { marcadorEfetivo, rotuloMarcador, sanearCamposMarcador, simboloValido, CATEGORIAS_SIMBOLOS_MARCADOR, SIMBOLOS_MARCADOR, FORMATOS_SEQUENCIA, CAMPOS_MARCADOR, segmentosDeLista, configListaDoBloco } from '../src/core/athenes_marcadores.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';

test('marcador por símbolo da paleta: o rótulo é o símbolo escolhido', () => {
  const cfg = marcadorEfetivo({}, { marcador_tipo: 'simbolo', marcador_simbolo: '➤' });
  assert.equal(cfg.tipo, 'simbolo');
  assert.equal(rotuloMarcador(cfg, 3), '➤');
  assert.equal(rotuloMarcador(marcadorEfetivo({}, { marcador_tipo: 'simbolo' }), 1), '•', 'sem símbolo, usa o ponto');
  assert.equal(rotuloMarcador(marcadorEfetivo({}, { marcador_tipo: 'quadrado' }), 1), '▪', 'tipos antigos continuam valendo');
});

test('paletas: catálogo completo de símbolos em categorias e 64 formatos de sequência, todos válidos e sem repetição', () => {
  assert.equal(CATEGORIAS_SIMBOLOS_MARCADOR.length, 8);
  assert.equal(SIMBOLOS_MARCADOR.length, 312);
  assert.equal(new Set(SIMBOLOS_MARCADOR).size, SIMBOLOS_MARCADOR.length);
  assert.ok(SIMBOLOS_MARCADOR.every(s => simboloValido(s) === s));
  assert.equal(FORMATOS_SEQUENCIA.length, 64);
  assert.deepEqual(rotuloMarcador({ tipo: 'numero', estiloNum: 'lower_roman', separador: 'entre_parenteses' }, 4), '(iv)');
  assert.deepEqual(rotuloMarcador({ tipo: 'numero', estiloNum: 'upper_alpha', separador: 'parentese' }, 2), 'B)');
  assert.deepEqual(rotuloMarcador({ tipo: 'numero', estiloNum: 'decimal_zero', separador: 'travessao' }, 7), '07 –');
  assert.deepEqual(rotuloMarcador({ tipo: 'numero', estiloNum: 'ordinal', separador: 'ponto' }, 3), '3º.');
  assert.deepEqual(rotuloMarcador({ tipo: 'numero', estiloNum: 'lower_greek', separador: 'colchetes' }, 2), '[β]');
});

test('símbolo de tema importado é saneado: sem marcação, no máximo 2 caracteres; inválido volta ao círculo', () => {
  assert.equal(sanearCamposMarcador({ marcador_tipo: 'simbolo', marcador_simbolo: '◆' }).marcador_simbolo, '◆');
  const ruim = sanearCamposMarcador({ marcador_tipo: 'simbolo', marcador_simbolo: '<img src=x>' });
  assert.equal(ruim.marcador_tipo, 'circulo'); assert.equal(ruim.marcador_simbolo, undefined);
  assert.equal(sanearCamposMarcador({ marcador_tipo: 'circulo', marcador_simbolo: '◆' }).marcador_simbolo, undefined, 'símbolo só vale com o tipo símbolo');
  assert.ok(CAMPOS_MARCADOR.includes('marcador_simbolo'), 'faz parte dos campos do estilo (pacote de tema)');
  assert.equal(simboloValido('abc'), ''); assert.equal(simboloValido('"'), ''); assert.equal(simboloValido(''), '');
});

test('listas no texto e configuração do bloco carregam o símbolo; o PDF mostra o símbolo escolhido', () => {
  const cfg = { ...marcadorEfetivo({}, { marcador_tipo: 'simbolo', marcador_simbolo: '✓' }) };
  const seg = segmentosDeLista('<ul><li>um</li><li>dois</li></ul>', cfg).filter(x => x.tipo === 'item');
  assert.deepEqual(seg.map(x => x.rotulo), ['✓', '✓']);
  assert.equal(configListaDoBloco({}, { marcador_tipo: 'simbolo', marcador_simbolo: '✓' }).simbolo, '✓');

  const doc = criarDocumento();
  const sec = doc.secoes[1] || doc.secoes[0]; sec.blocos.length = 0;
  doc.estilos.find(e => e.id === 'corpo').marcador_tipo = 'simbolo';
  doc.estilos.find(e => e.id === 'corpo').marcador_simbolo = '❖';
  sec.blocos.push(criarNovoBloco('paragrafo', { texto: 'Item com símbolo' }));
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc).replace(/­/g, '');
  assert.ok(html.includes('❖'), 'o símbolo aparece no PDF');
});
