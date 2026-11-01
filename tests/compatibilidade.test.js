// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { criarDocumento, criarNovoBloco } from '../src/core/athenes_documento.js';
import { analisarCompatibilidadeDocx } from '../src/core/athenes_compatibilidade.js';

describe('Athenes — Relatório Pré-Voo de Compatibilidade DOCX / Word / Google Docs', () => {
  it('avalia documento padrão e emite parecer positivo', () => {
    const doc = criarDocumento();
    const rep = analisarCompatibilidadeDocx(doc);

    assert.ok(rep.prontoParaExportar);
    assert.ok(rep.score >= 90);
    assert.equal(rep.avisosCriticos, 0);
  });

  it('detecta fórmulas, layouts multicolunas e orienta o usuário preventivamente', () => {
    const doc = criarDocumento();
    doc.paginas[1].blocos.push(
      criarNovoBloco('formula', { latex: '\\int_0^1 x^2 dx', numero_equacao: '(2)' })
    );
    doc.paginas[1].blocos.push(
      criarNovoBloco('anexo', { nome: 'Certificado.pdf', descricao: 'Arquivo comprobatório' })
    );

    const rep = analisarCompatibilidadeDocx(doc);
    assert.ok(rep.totalAvisos >= 2);
    const itemFormula = rep.itens.find(it => it.tipo === 'formula');
    const itemAnexo = rep.itens.find(it => it.tipo === 'anexo');

    assert.ok(itemFormula);
    assert.ok(itemFormula.alternativa.includes('matemática'));
    assert.ok(itemAnexo);
    assert.ok(itemAnexo.alternativa.includes('anexo documental'));
  });
});
