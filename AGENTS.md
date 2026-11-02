# Athenes — Notas Permanentes para Agentes e Desenvolvedores

Aplicativo web editorial acadêmico para elaboração de artigos científicos, relatórios técnicos e monografias com rigor normativo (ABNT, APA, Vancouver, IEEE), diagramação contínua de páginas mestras, tipografia editorial avançada, integração com Zotero e exportação fiel para PDF (HTML Paged Media) e DOCX (Word).

## Regras Permanentes do Projeto

1. **Arquitetura & Dependências:**
   - Código aberto, **GPL-3.0-or-later** (arquivo `LICENSE`).
   - Vanilla ES Modules puros (`type: "module"` no `package.json`), **zero dependências externas de runtime**.
   - Toda funcionalidade gráfica, tipográfica e de layout funciona 100% offline no navegador.

2. **Diretriz Mandatória de Temas e Pacotes de Estilo (.json):**
   - **Regra do Importador/Exportador Canônico:** Sempre que qualquer agente ou desenvolvedor adicionar, estender ou alterar atributos visuais, novos tipos de bloco, propriedades tipográficas, novos formatos ou traços de moldura de figuras/tabelas/fórmulas, ou propriedades de páginas mestras, **DEVE OBRIGATORIAMENTE na mesma rodada atualizar `src/core/athenes_pacote_estilo.js`** (`exportarPacoteEstilo`, `validarPacoteEstilo`, `aplicarPacoteEstilo` e `obterPromptIaParaExtracaoDeLayout`).
   - O formato `athenes-tema-v1` é o padrão canônico de compartilhamento de identidade visual entre relatórios, artigos e monografias no Athenes. Qualquer novo recurso de layout que não seja serializável no pacote de estilo quebra a portabilidade de documentos e será considerado defeito de regressão.
   - O prompt mestre retornado por `obterPromptIaParaExtracaoDeLayout()` deve ser mantido sempre alinhado com o schema de temas, garantindo que IAs consigam analisar PDFs/DOCX externos e gerar temas 100% compatíveis.

3. **Tipografia e Geometria:**
   - Dimensões de página e margens em milímetros (`mm`).
   - Tamanhos de fontes, entrelinhas e espaçamentos entre blocos em pontos tipográficos (`pt`).
   - Cores primárias no padrão Athenes Azul (`#314F79`), com suporte total a personalização por tema.
   - Preservar os 7 alinhamentos tipográficos editoriais (`esquerda`, `centro`, `direita`, `justificado`, `justificado_esquerda`, `justificado_centro`, `justificado_direita`).

4. **Testes Obrigatórios:**
   - Todos os commits e alterações devem manter `npm test` verde (100% de aprovação).
   - Teste qualquer mudança em temas com `tests/pacote_estilo.test.js`.

## Comandos

| Para | Comando |
| --- | --- |
| Executar suite completa de testes | `npm test` |
| Testes específicos de estilo | `node --test tests/pacote_estilo.test.js` |
