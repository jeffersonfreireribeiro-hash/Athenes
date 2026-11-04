// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento, estimarAlturaBlocoPt } from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { definirAlturaMedida, limparAlturasMedidas } from '../src/core/athenes_fragmentos.js';

function docComFormato(formato, extra = {}) {
  const doc = criarDocumento();
  const sec = doc.secoes[1] || doc.secoes[0];
  sec.blocos.length = 0;
  const mestra = doc.mestras.find(m => m.id === sec.mestraId);
  Object.assign(mestra, { formato, orientacao: 'retrato', ...extra });
  sec.blocos.push(criarNovoBloco('paragrafo', { texto: 'Texto' }));
  repaginarDocumento(doc);
  return doc;
}

test('PDF: a folha tem o tamanho do papel da mestra (Carta, A3, Executivo, personalizado), com altura travada', () => {
  const casos = [['Letter', null, 215.9, 279.4], ['A3', null, 297, 420], ['Personalizado', { w_mm: 150, h_mm: 200 }, 150, 200]];
  for (const [formato, personal, w, h] of casos) {
    const html = gerarDocumentoHtmlPdf(docComFormato(formato, personal ? { dimensoes_personalizadas: personal } : {}));
    assert.ok(html.includes(`width:${w}mm`) || html.includes(`${w}mm`), `${formato}: largura ${w}mm`);
    assert.match(html, new RegExp(`height:${h}mm`), `${formato}: altura ${h}mm travada`);
  }
});

test('PDF: figura/tabela não somam margem própria ao espaço do bloco (empurrava o texto para a margem inferior)', () => {
  const html = gerarDocumentoHtmlPdf(docComFormato('A4'));
  assert.match(html, /\.ath-bloco-grid:not\(\[style\*="flow-root"\]\) > :is\(\.ath-figura, \.ath-figura-composta, \.ath-mapa-wrap, \.ath-tabela-wrap, \.ath-quadro-wrap\) \{ margin-top: 0 !important; margin-bottom: 0 !important; \}/);
});

test('altura medida na folha substitui a estimativa dos blocos que não são texto', () => {
  limparAlturasMedidas();
  const fig = criarNovoBloco('figura', {});
  const estimada = estimarAlturaBlocoPt(fig);
  assert.ok(definirAlturaMedida(fig, estimada + 50), 'mudou bastante: pede nova paginação');
  assert.equal(estimarAlturaBlocoPt(fig), estimada + 50);
  assert.equal(definirAlturaMedida(fig, estimada + 50.5), false, 'variação pequena não refaz a paginação');
  fig.legenda = 'Outra legenda bem mais longa que a anterior';
  assert.notEqual(estimarAlturaBlocoPt(fig), estimada + 50, 'conteúdo mudou: a medida antiga deixa de valer');
  limparAlturasMedidas();
  assert.equal(estimarAlturaBlocoPt(fig), estimada);
});
