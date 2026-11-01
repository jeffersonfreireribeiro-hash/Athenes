// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Teste de Validação Real: gera um artigo multi-página com figuras, tabelas, notas e bibliografia,
 * exporta para DOCX binário e PDF HTML, e valida a integridade física dos artefatos.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import { criarDocumento, criarNovoBloco } from '../src/core/athenes_documento.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { analisarCompatibilidadeDocx } from '../src/core/athenes_compatibilidade.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testarValidacaoReal() {
  console.log('--- Iniciando Validação Real de Exportação do Athenes ---');

  // 1. Cria documento completo de 4 páginas
  const doc = criarDocumento({
    titulo: 'Desenvolvimento e Validação de um Editor Científico Web em Blocos',
    subtitulo: 'Metodologia, Controle Tipográfico e Interoperabilidade com Microsoft Word e Google Docs',
    perfilId: 'abnt',
    tipoDoc: 'artigo'
  });

  // Adiciona mais blocos na página 2 (corpo)
  const pagCorpo = doc.paginas[1];
  pagCorpo.blocos.push(
    criarNovoBloco('formula', {
      latex: 'S = \\sum_{i=1}^n \\frac{w_i \\cdot x_i}{\\sigma^2}',
      numero_equacao: '(1)'
    })
  );
  pagCorpo.blocos.push(
    criarNovoBloco('nota', {
      tipo_nota: 'destaque',
      titulo: 'Nota Metodológica',
      texto: 'Todos os testes foram executados em ambiente descartável com validação cruzada entre navegadores.'
    })
  );

  // Adiciona página 4 de anexos
  doc.paginas.push({
    id: 'pg_anexos',
    modeloId: 'anexos',
    numero: 4,
    blocos: [
      criarNovoBloco('titulo', { nivel: 1, texto: 'ANEXO A — ESPECIFICAÇÃO TÉCNICA' }),
      criarNovoBloco('anexo', {
        nome: 'Dicionario_de_Dados.pdf',
        descricao: 'Esquema completo de validação dos tipos de bloco'
      })
    ]
  });

  // Adiciona referências bibliográficas
  doc.referencias.push(
    {
      id: 'ref_abnt_1',
      tipo: 'livro',
      autores: [{ sobrenome: 'BRINGHURST', prenome: 'Robert' }],
      titulo: 'Elementos do Estilo Tipográfico',
      local: 'São Paulo',
      editora: 'Cosac Naify',
      ano: '2005'
    },
    {
      id: 'ref_abnt_2',
      tipo: 'artigo_periodico',
      autores: [
        { sobrenome: 'KNAUTH', prenome: 'Donald' },
        { sobrenome: 'LAMPORT', prenome: 'Leslie' }
      ],
      titulo: 'Estruturação Digital de Documentos Acadêmicos',
      publicacao: 'Journal of Computer Science',
      volume: '42',
      numero: '1',
      paginas: '15–32',
      ano: '2024',
      doi: '10.1016/j.jcs.2024.01'
    }
  );

  // 2. Prévia de compatibilidade
  const auditoria = analisarCompatibilidadeDocx(doc);
  console.log(`Índice de Compatibilidade Pré-Voo: ${auditoria.score}%`);
  console.log(`Total de blocos auditados: ${auditoria.totalBlocos}`);
  assert.ok(auditoria.prontoParaExportar);

  // 3. Exporta para DOCX binário
  const docxBytes = await exportarParaDocx(doc);
  assert.ok(docxBytes.length > 5000, 'DOCX gerado possui tamanho substancial (>5KB)');

  const docxPath = path.join(__dirname, 'amostra_artigo_athenes.docx');
  fs.writeFileSync(docxPath, docxBytes);
  console.log(`Arquivo DOCX salvo com sucesso em: ${docxPath} (${docxBytes.length} bytes)`);

  // 4. Exporta para HTML PDF
  const pdfHtml = gerarDocumentoHtmlPdf(doc);
  assert.ok(pdfHtml.includes('ANEXO A'), 'PDF contém anexo');
  assert.ok(pdfHtml.includes('Elementos do Estilo Tipográfico'), 'PDF contém referências');

  const htmlPath = path.join(__dirname, 'amostra_artigo_athenes.html');
  fs.writeFileSync(htmlPath, pdfHtml, 'utf8');
  console.log(`Arquivo HTML Paged Media salvo com sucesso em: ${htmlPath} (${pdfHtml.length} bytes)`);

  console.log('--- Validação Real Concluída com Sucesso! ---');
}

testarValidacaoReal();
