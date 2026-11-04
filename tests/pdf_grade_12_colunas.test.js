// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';

function docComGrupo() {
  const doc = criarDocumento();
  const sec = doc.secoes[1] || doc.secoes[0];
  sec.blocos.length = 0;
  const a = criarNovoBloco('paragrafo', { texto: 'Esquerda' });
  const b = criarNovoBloco('paragrafo', { texto: 'Direita' });
  Object.assign(a, { grupo: 'g1', col: 1, span: 6 });
  Object.assign(b, { grupo: 'g1', col: 7, span: 6 });
  const c = criarNovoBloco('paragrafo', { texto: 'Embaixo' });
  sec.blocos.push(a, b, c);
  repaginarDocumento(doc);
  return doc;
}

test('PDF: blocos de um grupo ficam lado a lado na grade de 12 colunas (como no editor), não um por linha', () => {
  const html = gerarDocumentoHtmlPdf(docComGrupo()).replace(/­/g, '');
  assert.match(html, /grid-template-columns:repeat\(12, minmax\(0, 1fr\)\)/);
  const esq = html.indexOf('grid-column: 1 / span 6;');
  const dir = html.indexOf('grid-column: 7 / span 6;');
  const baixo = html.indexOf('grid-column: 1 / span 12;', dir);
  assert.ok(esq > 0 && dir > esq, 'os dois blocos do grupo têm colunas próprias');
  assert.ok(html.indexOf('Esquerda', esq) < dir && html.indexOf('Direita', dir) < baixo, 'cada texto está na sua coluna, na ordem');
});

test('PDF: a folha tem altura travada no tamanho do papel (nunca cresce nem vira folha extra)', () => {
  const html = gerarDocumentoHtmlPdf(docComGrupo());
  assert.match(html, /class="ath-pagina" style="position:relative; width:210mm; height:297mm; overflow:hidden;/);
  assert.doesNotMatch(html, /class="ath-pagina"[^>]*min-height:297mm/);
});
