# Passagem de Bastão — Athenes

## Implementação Inicial, Sincronização com GitHub e Estruturação do Segundo Cérebro (01/11/2026)

- **Concepção do Produto e Arquitetura do Athenes:**
  - Criação do **Athenes**, editor web completo para escrita e diagramação de artigos científicos, relatórios técnicos e documentos acadêmicos baseado no **Clux.js**.
  - Definição do nome oficial **Athenes** em toda a interface, código-fonte, metadados e documentação técnica.
  - Independência estrita de bases GIS, mapas Leaflet e banco PostGIS: o Athenes opera de forma autônoma e leve, sem acoplamento a sistemas cartográficos.
  - Zero dependências de compilação ou execução (`node_modules` vazio em produção e desenvolvimento):
    - Compactador ZIP puro (`src/core/zip_builder.js`) baseado em streams nativos da Web Platform (`CompressionStream` e `Uint8Array`).
    - Servidor HTTP local estático (`server.js`) em Node.js puro na porta 3300.
    - Suíte de testes automatizados executada diretamente pelo Node Test Runner nativo (`node:test`).
  - Licença: Código aberto sob os termos da **GPL-3.0-or-later** com cabeçalho `// SPDX-License-Identifier: GPL-3.0-or-later` em todos os arquivos de código.

- **Reaproveitamento do Clux.js e Pranchas Desktop:**
  - **Do gerador PDF do Clux.js**: Reaproveitada e expandida a lógica de renderização HTML com estilos de impressão, incorporando a especificação W3C CSS Paged Media (`@page`, quebras limpas `break-before: page`, `break-after: avoid`, `break-inside: avoid` e contadores de página automáticos `@top-right`).
  - **Das pranchas do Glaux Desk**: Adaptado o conceito de folhas paramétricas com margens rígidas, carimbos e separação absoluta entre o **modelo da folha** (`ModeloPagina`) e o **conteúdo dos blocos** (`Pagina.blocos`). A alteração de um modelo atualiza instantaneamente as páginas que o utilizam sem perda de texto digitado.
  - **Linguagem Visual Soft UI**: Adotada a identidade visual do ecossistema Glaux/Clux com fundo claro `#EFF2F6`, cor de marca `#FF6B2C`, tipografia Nunito (OFL) em WOFF2 offline e catálogo de ícones vetoriais de traço (stroke 2px) sem emojis (`src/ui/athenes_icones.js`).

- **Editor de Blocos com Escrita Direta na Folha (In-Page WYSIWYG):**
  - Implementação em `src/ui/athenes_editor.js` e `src/css/athenes_editor.css` centrada na folha visual de papel:
    - O texto é digitado **diretamente dentro do bloco na própria folha** via `contenteditable="true"`. A barra lateral direita serve para propriedades estruturais e tipografia fina, nunca como barreira obrigatória para digitação.
    - Catálogo abrangente de blocos acadêmicos: Título (H1/H2), Subtítulo (H2/H3), Parágrafo, Lista (ordenada/não-ordenada), Citação Longa (recuo de 4 cm), Nota de Rodapé, Tabela sem grades verticais (padrão ABNT), Imagem com legenda e fonte, Fórmula matemática monoespaçada, Anexo em pílula, Sumário dinâmico e Lista de referências.
    - Barra de ferramentas flutuante adjacente à seleção de texto com formatação rápida (negrito, itálico, sublinhado, inserção de citação e conversão de bloco).
    - Atalhos de teclado: `Enter` cria novo parágrafo ou próximo item de lista; `Backspace` em bloco vazio remove e foca no anterior; `Tab`/`Shift+Tab` ajusta indentação; `Ctrl+Z`/`Ctrl+Y` manipula a pilha de histórico imutável.
    - Alças de movimentação (`:hover`): botão de arrasto vertical (drag handle), botões de subir/descer bloco mantendo foco, duplicação e exclusão.

- **Páginas, Grid Modular, Réguas e Snap Magnético:**
  - Módulos `src/core/athenes_grid.js` e `src/ui/athenes_reguas.js`:
    - Formatos de papel parametrizados: A4 Retrato (210 × 297 mm), A4 Paisagem (297 × 210 mm), Carta e A3.
    - Grade modular com suporte de 1 a 12 colunas, calha (gutter) configurável e cálculo de largura útil descontando margens físicas.
    - 5 modelos reutilizáveis pré-configurados: Capa, Corpo do Texto, Sumário, Referências e Anexos.
    - Réguas milimétricas horizontal e vertical desenhadas em `<canvas>` com indicador dinâmico de cursor e suporte a linhas-guia azuis arrastáveis para a folha.
    - Snap magnético automático (`aplicarSnap`) com atração a margens, colunas e guias dentro da tolerância de 2 mm, com controle de ligar/desligar na barra de ferramentas.

- **Tipografia Avançada e Perfis Acadêmicos:**
  - Módulo `src/core/athenes_estilos.js`:
    - Amplitude de controle inspirada no Affinity Publisher e InDesign: famílias de fontes, corpos em pt, pesos (400, 600, 700), alinhamentos (esquerda, centro, direita, justificado), entrelinhas absolutas e relativas, espaço antes e depois do parágrafo, recuo de 1ª linha (1,25 cm), recuo francês (hanging indent para bibliografia), hifenização automática e prevenção de títulos órfãos (`break-after: avoid` / `w:keepNext`).
    - Fonte padrão oficial **Nunito** incorporada em WOFF2 offline no repositório (`src/assets/fonts/`), com catálogo seguro de fontes clássicas do sistema (Arial, Times New Roman, Georgia, Calibri, Consolas).
    - Perfis normativos automatizados em 1 clique:
      - **ABNT** (NBR 14724 / 6023 / 10520): Arial/Times 12 pt, entrelinhas 1,5, texto justificado, recuo de 1,25 cm, títulos em negrito, citações longas a 10 pt com recuo de 4 cm e referências alinhadas à esquerda com entrelinhas simples e espaço entre itens.
      - **APA 7th Edition**: Times/Calibri 11-12 pt, entrelinhas dupla (2,0), texto à esquerda, recuo de 0,5 pol (1,27 cm) e referências com hanging indent.
      - **IEEE**: Layout de 2 colunas, Times 10 pt, entrelinhas simples, títulos em versalete e citações numéricas entre colchetes `[1]`.
      - **Vancouver**: Citações numéricas sequenciais sobrescritas para publicações biomédicas.
      - **Personalizado**: Liberdade total de parametrização.

- **Integração Zotero, Fichamento Pessoal e Grafo de Conhecimento:**
  - Módulos `src/core/athenes_zotero.js`, `src/core/athenes_bibliografia.js` e `src/core/athenes_conexoes.js`:
    - **Estudo aprofundado de integração**: A Zotero Web API v3 oficial foi adotada como meio principal online por sua segurança, padronização REST e imunidade a quebras. O desenvolvimento de um plugin local para Zotero Desktop foi descartado tecnicamente após análise da versão 7 do Zotero (que descontinuou a arquitetura legada XUL/XPCOM). Para suporte 100% offline, foi implementado um parser nativo de arquivos BibTeX (`.bib`).
    - **Biblioteca de Leitura e Fichamento**: Separação estrita entre os dados bibliográficos imutáveis do Zotero e a camada de fichamento pessoal do autor (resumos próprios, trechos selecionados, comentários críticos e tags). As anotações do pesquisador nunca poluem ou sobrescrevem os dados originais.
    - **Inserção de Citações**: Busca em tempo real com debounce, inserção de pílulas semânticas de citação no cursor do editor e atualização automática da lista de referências do documento.
    - **Grafo de Conexões**: Extração de rede de relacionamentos entre Obras, Autores, Coautores, Anos e Temas, renderizada em canvas interativo.
    - **Sinalização Explícita de Dados Ausentes**: Metadados incompletos (como país não informado ou tema ausente) são sinalizados de forma explícita na interface com cálculo de completude percentual, evitando suposições fictícias no artigo.

- **Exportação Dupla de Alta Fidelidade e Relatório Pré-Voo:**
  - Módulos `src/core/athenes_export_pdf.js`, `src/core/athenes_export_docx.js` e `src/core/athenes_compatibilidade.js`:
    - **Exportação PDF**: HTML Paged Media W3C com regras `@page`, margens físicas em mm, numeração de páginas automatizada no cabeçalho/rodapé e quebras limpas de página.
    - **Exportação DOCX Nativo**: Pacote Office Open XML binário completo (`.docx`) construído em memória com `ZipBuilder` sem bibliotecas externas:
      - Arquivos gerados: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/styles.xml`, `word/numbering.xml`, `word/settings.xml`, `word/header1.xml`, `word/footer1.xml` e `word/_rels/document.xml.rels`.
      - Compatibilidade plena com Microsoft Word e Google Docs: estilos semânticos (`Heading1`, `Heading2`, `Heading3`, `Normal`), campos de página dinâmicos (`PAGE`), alinhamentos de tabela e entrelinhas em dxa.
    - **Relatório Pré-Voo de Compatibilidade**: Auditor preventivo que analisa a árvore de blocos antes da exportação, calculando um índice de compatibilidade e orientando o autor sobre limitações específicas de renderização (fórmulas, multicolunas, tabelas sem cabeçalho) sem jamais substituir silenciosamente texto por imagem.

- **Configuração do Repositório Git e Sincronização Remota:**
  - Repositório local inicializado e branch principal renomeada para `main`.
  - Configurado remote `origin`: `https://github.com/jeffersonfreireribeiro-hash/Athenes.git`.
  - Sincronização e rebase limpo sobre o commit inicial do repositório remoto, mantendo os arquivos oficiais de licença GPL-3.0-or-later e README completo.
  - Push realizado com sucesso para `origin/main` (`7d6dc82`).

- **Estruturação do Segundo Cérebro (Obsidian Vault em `docs/`):**
  - Criação da pasta `docs/brain/` com padrão compatível com os outros projetos do ecossistema:
    - `00 - Index (MOC).md`: Mapa de navegação de todo o cofre com convenções e links para notas.
    - `01 - Passagem de Bastao.md`: Resumo executivo de arquitetura, como rodar, testes e próximos passos.
    - `10 - Arquitetura Geral e Clux.md`: Herança técnica, módulos reaproveitados e excluídos do Clux.js.
    - `11 - Editor de Blocos WYSIWYG.md`: Arquitetura do editor in-page, tipos de blocos e atalhos.
    - `12 - Paginas, Grid e Modelos.md`: Modelos de página, réguas mm, guias, snap magnético e colunas.
    - `13 - Tipografia e Perfis Academicos.md`: Controle micro-tipográfico e perfis ABNT/APA/IEEE/Vancouver.
    - `14 - Zotero, Fichamento e Grafo.md`: Web API v3, parser BibTeX, fichamento pessoal e grafo de conexões.
    - `15 - Exportacao PDF e DOCX.md`: W3C Paged Media, pacote OOXML Word/Google Docs e auditor pré-voo.
    - `90 - Fluxos de Trabalho.md`: Diagramas de sequência e fluxos completos de escrita e publicação.
    - `95 - Backlog e Ideias.md`: Roadmap priorizado (P1, P2, P3).
  - Criação deste diário técnico em `docs/passagem.md`.

- **Verificação, Testes e Evidências:**
  - Suíte de 25 testes unitários executada com sucesso via `npm test` (9/9 suítes 100% aprovadas em 163 ms).
  - Script `node tests/validacao_real.js` executado: gerou artigo de teste de 4 páginas com capa, sumário dinâmico, introdução, citações, tabelas, fórmulas e referências bibliográficas.
  - O arquivo gerado `tests/amostra_artigo_athenes.docx` (17.9 KB) foi validado e extraído com sucesso pelo PowerShell `Expand-Archive`, confirmando integridade estrutural do pacote ZIP e de todos os esquemas XML do Word.
  - O arquivo gerado `tests/amostra_artigo_athenes.html` (13.8 KB) foi validado com CSS Paged Media.
