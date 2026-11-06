// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { artigoTemPdf } from '../src/ui/athenes_estudo_artigos_dados.js';
import { blobEhPdf, normalizarDoi, normalizarIsbn, paginaEditorialDoPdf } from '../src/core/athenes_pdf_identificadores.js';
import { resolverPdfAberto } from '../src/server/athenes_pdf_aberto.js';

test('resumo antigo não conta como PDF e cabeçalho do arquivo é verificado', async () => {
  assert.equal(artigoTemPdf({ conteudoPaginasPdf: [{ numero: 1, paragrafos: ['Resumo'] }], totalPaginas: 1 }), false);
  assert.equal(artigoTemPdf({ driveFileId: 'arquivo-real' }), true);
  assert.equal(artigoTemPdf({ driveFileId: 'arquivo-html', pdfVerificadoInvalido: true }), false);
  assert.equal(await blobEhPdf(new Blob(['<html>Resumo</html>'], { type: 'application/pdf' })), false);
  assert.equal(await blobEhPdf(new Blob(['%PDF-1.7\nconteúdo'])), true);
});

test('DOI, ISBN e páginas editoriais são validados antes de usar', () => {
  assert.equal(normalizarDoi('https://doi.org/10.1234/abc'), '10.1234/abc');
  assert.equal(normalizarDoi('https://example.com/10.1234/abc'), '');
  assert.equal(normalizarIsbn('978-0-14-032872-1'), '9780140328721');
  assert.equal(normalizarIsbn('9780140328722'), '');
  const art = { paginas: '114–138' };
  assert.equal(paginaEditorialDoPdf(art, 1, 25), 114);
  assert.equal(paginaEditorialDoPdf(art, 25, 25), 138);
  assert.equal(paginaEditorialDoPdf(art, 1, 27), null);
  assert.equal(paginaEditorialDoPdf(art, 2, 27, 115), 115);
  assert.equal(paginaEditorialDoPdf(art, 2, 27, 900), null);
});

test('busca DOI aceita apenas PDF de localização aberta da obra exata', async () => {
  const fetchImpl = async url => {
    const u = String(url);
    if (u.includes('api.openalex.org')) return Response.json({ doi: 'https://doi.org/10.1371/journal.pone.0000001', best_oa_location: { is_oa: true, pdf_url: 'https://journals.plos.org/artigo.pdf' } });
    if (u.includes('journals.plos.org')) return new Response('%PDF-1.7\narquivo de teste');
    throw new Error(`Origem inesperada: ${u}`);
  };
  const resultado = await resolverPdfAberto({ doi: '10.1371/journal.pone.0000001' }, fetchImpl);
  assert.equal(resultado.status, 200);
  assert.equal(resultado.fonte, 'journals.plos.org');
  assert.match(resultado.pdf.toString(), /^%PDF-/);
});

test('busca ISBN só usa edição exata com acesso integral e recusa páginas HTML', async () => {
  const chamadas = [];
  const fetchImpl = async url => {
    const u = String(url); chamadas.push(u);
    if (u.includes('openlibrary.org')) return Response.json({ 'isbn:9780140328721': { items: [
      { match: 'exact', status: 'lendable', itemURL: 'https://archive.org/details/restrito' },
      { match: 'exact', status: 'full access', itemURL: 'http://archive.org/details/livre' }
    ] } });
    if (u.includes('/metadata/livre')) return Response.json({ files: [{ name: 'livre.pdf', size: '200' }] });
    if (u.includes('/download/livre/')) return new Response('<html>prévia</html>', { headers: { 'Content-Type': 'application/pdf' } });
    throw new Error(`Origem inesperada: ${u}`);
  };
  const resultado = await resolverPdfAberto({ isbn: '9780140328721' }, fetchImpl);
  assert.equal(resultado.status, 404);
  assert.equal(chamadas.some(u => u.includes('restrito')), false);
});
