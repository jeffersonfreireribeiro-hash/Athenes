// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Prévia de Compatibilidade e Relatório Pré-Voo de Exportação.
 * Analisa cada bloco do documento antes de exportar para DOCX / Google Docs,
 * oferecendo avisos claros e alternativas editáveis (sem perdas silenciosas).
 */

export function analisarCompatibilidadeDocx(documento) {
  if (!documento || !Array.isArray(documento.paginas)) {
    return {
      score: 100,
      totalBlocos: 0,
      avisos: [],
      prontoParaExportar: true
    };
  }

  const itens = [];
  let totalBlocos = 0;
  let penalidade = 0;

  let numPagina = 1;
  for (const pag of documento.paginas) {
    const modelo = documento.modelosPagina?.find(m => m.id === pag.modeloId) || {};
    const isCapa = modelo.tipo === 'capa';
    const isMultiColuna = (modelo.grade?.colunas || 1) > 1;

    if (isMultiColuna) {
      itens.push({
        pagina: numPagina,
        blocoId: pag.id,
        tipo: 'grade_multicoluna',
        nivel: 'ajuste', // 'ok', 'ajuste', 'aviso'
        titulo: `Página ${numPagina}: Layout em ${modelo.grade.colunas} Colunas`,
        mensagem: 'O Google Docs possui suporte limitado a seções de colunas com fluxos independentes. No DOCX, o Athenes converte a disposição em tabela estruturada sem bordas para manter o alinhamento visual idêntico sem deslocar os blocos.',
        alternativa: 'Diagramação mantida via tabela invisível; texto 100% editável no Word e Google Docs.'
      });
      penalidade += 5;
    }

    for (const b of (pag.blocos || [])) {
      totalBlocos++;

      if (b.tipo === 'formula') {
        itens.push({
          pagina: numPagina,
          blocoId: b.id,
          tipo: 'formula',
          nivel: 'aviso',
          titulo: `Equação Matemática (${b.numero_equacao || 'sem numeração'})`,
          mensagem: `A fórmula LaTeX "${b.latex}" será exportada no DOCX com texto matemático formatado e campos compatíveis com o editor de equações do Word e Google Docs.`,
          alternativa: 'Representação em texto com formatação matemática simbólica nativa.'
        });
        penalidade += 4;
      } else if (b.tipo === 'anexo') {
        itens.push({
          pagina: numPagina,
          blocoId: b.id,
          tipo: 'anexo',
          nivel: 'ajuste',
          titulo: `Anexo de Arquivo: ${b.nome || 'Documento'}`,
          mensagem: 'Arquivos binários anexados não são embutidos como OLE Package no Google Docs web. O Athenes insere um cartão estruturado com metadados do arquivo, resumo e link de referência.',
          alternativa: 'Cartão de anexo documental formatado com identificação clara e texto preservado.'
        });
        penalidade += 3;
      } else if (b.tipo === 'nota' && b.tipo_nota === 'destaque') {
        itens.push({
          pagina: numPagina,
          blocoId: b.id,
          tipo: 'nota',
          nivel: 'ok',
          titulo: `Caixa de Destaque / Nota`,
          mensagem: 'Convertida para parágrafo com sombreamento de fundo suave e borda esquerda de realce (estilo Callout suportado nativamente pelo Word e Google Docs).',
          alternativa: 'Parágrafo nativo com sombreamento e recuo.'
        });
      } else if (b.tipo === 'tabela') {
        itens.push({
          pagina: numPagina,
          blocoId: b.id,
          tipo: 'tabela',
          nivel: 'ok',
          titulo: `Tabela (${b.colunas?.length || 0} colunas × ${b.linhas?.length || 0} linhas)`,
          mensagem: 'Mapeada para tabela nativa com cabeçalho repetido na quebra de página (tblHeader) e larguras de coluna proporcionais em mm.',
          alternativa: 'Tabela 100% editável no Word e Docs.'
        });
      } else if (b.tipo === 'imagem') {
        if (!b.dataUrl && !b.url) {
          itens.push({
            pagina: numPagina,
            blocoId: b.id,
            tipo: 'imagem',
            nivel: 'aviso',
            titulo: 'Imagem sem Arquivo Vinculado',
            mensagem: 'O bloco de imagem não possui arquivo carregado. No DOCX, apenas a legenda descritiva será inserida com indicação de espaço reservado.',
            alternativa: 'Carregue uma imagem PNG/JPEG antes da exportação final.'
          });
          penalidade += 8;
        } else {
          itens.push({
            pagina: numPagina,
            blocoId: b.id,
            tipo: 'imagem',
            nivel: 'ok',
            titulo: 'Imagem com Legenda',
            mensagem: 'Embutida em alta fidelidade no pacote DOCX (word/media/) com legenda e créditos associados.',
            alternativa: 'Desenho inline nativo.'
          });
        }
      }
    }
    numPagina++;
  }

  const score = Math.max(70, Math.min(100, 100 - penalidade));
  const avisosCriticos = itens.filter(it => it.nivel === 'aviso').length;

  return {
    score,
    totalBlocos,
    totalAvisos: itens.length,
    avisosCriticos,
    itens,
    prontoParaExportar: true,
    resumoStatus: score >= 90
      ? 'Excelente compatibilidade: o documento abrirá com alta fidelidade visual e estrutural no Word e Google Docs.'
      : 'Boa compatibilidade: alguns blocos livres foram ajustados para o fluxo linear do Word/Google Docs com preservação integral do texto.'
  };
}
