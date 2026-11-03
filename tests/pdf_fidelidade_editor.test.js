// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarBlocoHtml, gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';

const mapa = (doc) => Object.fromEntries(doc.estilos.map(e => [e.id, e]));

test('PDF: a citação usa o estilo escolhido (fonte, recuo) e o 2º pedaço não repete o espaço antes', () => {
  const doc = criarDocumento({ titulo: 'T' });
  doc.estilos.push({ id: 'citacao_direta', nome: 'Citação', fonte: 'aptos', tamanho_pt: 10, peso: 400, entrelinha: 1, alinhamento: 'justificado', cor: '#1F2733', espaco_antes_pt: 12, recuo_esquerdo_mm: 40 });
  const cit = criarNovoBloco('citacao', { id: 'c1', texto: 'texto da citação', estiloId: 'citacao_direta' });
  const html = renderizarBlocoHtml(cit, mapa(doc), doc);
  assert.match(html, /font-size: 10pt/);
  assert.match(html, /margin-left: 40mm/);
  assert.match(html, /margin-top: 12pt/);
  const semEstilo = renderizarBlocoHtml(criarNovoBloco('citacao', { id: 'c2', texto: 'x' }), mapa(doc), doc);
  assert.match(semEstilo, /margin-left: 40mm/, 'sem estilo escolhido usa o estilo de citação do documento');
  const continuacao = renderizarBlocoHtml({ ...cit, espaco_antes_pt: 0, _frag: { continuaDaAnterior: true } }, mapa(doc), doc); // só o fragmento de paginação ajusta o espaço
  assert.doesNotMatch(continuacao, /margin-top: 12pt/);
});

test('PDF: a citação não perde largura com a margem padrão do navegador', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const corpo = doc.secoes.find(s => s.mestraId === 'corpo');
  corpo.blocos = [criarNovoBloco('citacao', { id: 'c1', texto: 'x' })];
  repaginarDocumento(doc);
  assert.match(gerarDocumentoHtmlPdf(doc), /blockquote\.ath-bloco\s*\{\s*margin-left:\s*0;\s*margin-right:\s*0;/);
});

test('PDF: figura sem estilos de legenda/fonte segue o visual do editor e leva o espaçamento do estilo do bloco', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const corpo = doc.secoes.find(s => s.mestraId === 'corpo');
  const fig = criarNovoBloco('figura', { id: 'f1', titulo: 'Descrição', legenda_geral: 'Legenda', fonte: 'Fonte: autor' });
  corpo.blocos = [fig];
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /font-size:9\.75pt; line-height:1\.5; font-weight:800/);
  assert.match(html, /font-size:9pt; color:#475569/);
  assert.match(html, /font-size:8\.25pt; line-height:1\.5; color:#6B7585; font-style:italic/);
  assert.match(html, /class="ath-bloco-grid" style="[^"]*margin-top:\d+(\.\d+)?pt; margin-bottom:\d+(\.\d+)?pt;/);
});
