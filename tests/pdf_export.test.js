// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { criarDocumento } from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';

describe('Athenes — Exportação PDF (HTML Paged Media)', () => {
  it('gera HTML imprimível completo com @page e dimensões A4', () => {
    const doc = criarDocumento({
      titulo: 'Estudo de Planejamento Integrado',
      subtitulo: 'Diretrizes Metodológicas'
    });

    const html = gerarDocumentoHtmlPdf(doc);

    assert.ok(html.includes('<!doctype html>'));
    assert.ok(html.includes('@page'));
    assert.ok(html.includes('size: A4 portrait'));
    assert.ok(html.includes('ath-pagina'));
    assert.ok(html.includes('INTRODUÇÃO'));
    assert.ok(html.includes('ath-tabela'));
    assert.ok(html.includes('page-break-after: always'));
  });
});
