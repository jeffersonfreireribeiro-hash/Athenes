# Athenes — Compatibilidade de Exportação para DOCX e Google Docs

> Mapeamento de estilos, estruturas suportadas, prévia de compatibilidade preventiva e diretrizes de integridade documental.

---

## 1. Princípios da Exportação Editável

Publicações científicas, comitês editoriais de periódicos e orientadores acadêmicos frequentemente exigem a submissão de artigos em formato **editável (.docx)** para controle de alterações (Track Changes) e diagramação final em softwares editoriais.

O conversor **Athenes DOCX Engine** foi projetado com três regras inegociáveis:
1. **Sem Caixas Pretas nem Perda Silenciosa**: Nenhum conteúdo estruturado é substituído secretamente por imagens. Se um bloco tiver complexidade de layout livre que o Word ou Google Docs não suportam nativamente (por exemplo, sobreposição de cartões ou múltiplos elementos com z-index), o sistema informa antes de exportar.
2. **Estilos Semânticos Oficiais**: Os títulos do Athenes são mapeados diretamente para `Heading 1`, `Heading 2` e `Heading 3` do WordProcessingML (OOXML), garantindo que o **Painel de Navegação do Google Docs** e do **Microsoft Word** exiba a estrutura do documento imediatamente.
3. **Edição e Resalvamento Seguros**: O documento gerado foi testado para ser aberto no Google Docs e no Microsoft Word, sofrer pequenas edições de texto e ser salvo novamente sem corromper estilos ou layout.

---

## 2. Tabela de Correspondência: Athenes -> DOCX / Google Docs

| Elemento no Athenes | Representação no DOCX (`word/document.xml`) | Comportamento no Google Docs / MS Word |
| :--- | :--- | :--- |
| **Página e Margens** | `w:sectPr` com `w:pgSz` (A4: 11906 × 16838 dxa) e `w:pgMar` com margens exatas em dxa (1 mm = 56.7 dxa). | Idêntico ao editor: margens de 3cm/2cm ou 1 polegada preservadas perfeitamente. |
| **Título 1 (H1)** | `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="360" w:after="180"/><w:keepNext/></w:pPr>...` | Reconhecido como Título 1, entra no Sumário automático e na barra lateral de tópicos. `keepNext` impede título órfão no fim da página. |
| **Título 2 e 3** | `Heading2` e `Heading3` com seus respectivos tamanhos e recuos. | Perfeita hierarquia de tópicos. |
| **Parágrafo** | `w:p` com estilo `Normal`, espaçamento configurável (ex.: 1.5 linhas = `w:line="360" w:lineRule="auto"`), recuo de 1ª linha (`w:ind w:firstLine="709"` = 1.25 cm). | Formatação acadêmica exata (ABNT / APA). |
| **Citação Direta Longa** | `w:p` com `w:ind w:left="2268"` (4 cm de recuo à esquerda), tamanho 10pt (`w:sz w:val="20"`), entrelinha simples (`w:line="240"`). | Renderiza com recuo francês conforme ABNT NBR 10520. |
| **Listas** | `w:numPr` associado a `word/numbering.xml` com níveis e marcadores. | Listas nativas editáveis (pressionar Enter cria novo item com marcador). |
| **Tabelas** | `w:tbl` com `w:tblPr` (largura total, bordas finas), `w:tblHeader` na 1ª linha (repetir cabeçalho em quebra de página) e células `w:tc`. | Tabela nativa editável com linhas e colunas redimensionáveis. |
| **Imagens e Figuras** | `w:drawing` com ancoragem `wp:inline`, imagem real embutida em `word/media/imageN.png` e relacionamento em `document.xml.rels`. | Imagem nativa de alta resolução centralizada na folha. |
| **Legenda de Figura/Tabela** | Parágrafo com estilo `Caption`, centralizado ou justificado, tamanho 10pt. | Legenda legível associada à imagem/tabela. |
| **Notas de Rodapé** | `w:footnoteReference` associada a `word/footnotes.xml` com numeração sequencial. | Nota de rodapé nativa com separador horizontal no pé da página. |
| **Quebra de Página** | `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` | Força início da próxima seção em página nova. |
| **Sumário (TOC)** | Campo dinâmico `<w:fldSimple w:instr="TOC \o &quot;1-3&quot; \h \z \u"/>`. | Pode ser atualizado no Word com F9 ou botão direito "Atualizar Campo". |
| **Cabeçalhos e Rodapés** | `word/header1.xml` e `word/footer1.xml` com campos dinâmicos `w:fldSimple w:instr="PAGE"` e `NUMPAGES`. | Numeração "Página X de Y" atualizada pelo visualizador do Word/Docs. |

---

## 3. Prévia de Compatibilidade (Relatório Pré-Voo)

Antes de gerar o download do DOCX, o Athenes executa um diagnóstico estrutural do documento:

1. **Varredura de Blocos**: Avalia cada bloco contra as capacidades do Office Open XML e do renderizador do Google Docs.
2. **Classificação dos Itens**:
   - `Verde (Compatível)`: Elementos com mapeamento semântico direto 1:1 (textos, títulos, parágrafos, tabelas, imagens, citações, listas, notas de rodapé).
   - `Amarelo (Ajustado com Aviso)`: Elementos que passam por adaptação de layout (exemplo: grade de 3 colunas laterais que no Word vira tabela sem bordas para preservar a leitura horizontal estável).
   - `Azul (Informativo)`: Campos dinâmicos (como sumário ou números de página) que dependem da paginação do Word/Docs para recalcular.
3. **Decisão do Usuário**: O usuário pode visualizar o relatório, escolher se deseja aplicar as sugestões e prosseguir com a exportação com 100% de confiança e transparência.
