// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { criarDocumento } from '../src/core/athenes_documento.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';

describe('Athenes — Exportação DOCX (Office Open XML)', () => {
  it('gera pacote DOCX binário completo e válido', async () => {
    const doc = criarDocumento({
      titulo: 'Desenvolvimento e Otimização de Sistemas Espaciais',
      subtitulo: 'Metodologia e Resultados Experimentais'
    });

    const bufferDocx = await exportarParaDocx(doc);
    assert.ok(bufferDocx instanceof Uint8Array);
    assert.ok(bufferDocx.length > 1000, `Tamanho DOCX (${bufferDocx.length} bytes) deve ser maior que 1KB`);

    // Assinatura mágica de arquivo ZIP (PK\x03\x04)
    assert.equal(bufferDocx[0], 0x50); // 'P'
    assert.equal(bufferDocx[1], 0x4B); // 'K'
    assert.equal(bufferDocx[2], 0x03);
    assert.equal(bufferDocx[3], 0x04);

    // O buffer deve conter os caminhos canônicos do OOXML
    const str = new TextDecoder('utf-8').decode(bufferDocx);
    assert.ok(str.includes('[Content_Types].xml'), 'Possui [Content_Types].xml');
    assert.ok(str.includes('word/document.xml'), 'Possui word/document.xml');
    assert.ok(str.includes('word/styles.xml'), 'Possui word/styles.xml');
    assert.ok(str.includes('word/header1.xml'), 'Possui word/header1.xml');
    assert.ok(str.includes('word/footer1.xml'), 'Possui word/footer1.xml');
    assert.ok(str.includes('word/numbering.xml'), 'Possui word/numbering.xml');

    // O conteúdo de document.xml deve conter os elementos do documento
    assert.ok(str.includes('Heading1'), 'Possui estilos Heading1 mapeados');
    assert.ok(str.includes('INTRODUÇÃO'), 'Possui texto do título da introdução');
    assert.ok(str.includes('w:tblHeader'), 'Possui cabeçalho de tabela repetido (tblHeader)');
  });
});
