
## Identidade Visual Azul (#314F79), Controles Completos de Formatação e Editor de Páginas Mestras (01/11/2026 - Tarde)

- **Identidade Visual Athenes em Azul:**
  - Substituição da cor primária de marca laranja (`#FF6B2C`) pela paleta azul ardósia (`#314F79`, RGB 49, 79, 121), com variantes suaves (`--ath-primary-soft: #EEF4FA`), bordas (`--ath-primary-line: #C8D7E6`) e texto escuro (`--ath-primary-ink: #1B2D47`).
  - Unificação completa da tipografia na fonte Nunito em todos os componentes da interface.

- **Controles Avançados de Formatação de Texto e Parágrafo:**
  - Segmento de **7 alinhamentos tipográficos** com ícones SVG lineares e dicas de comportamento da última linha:
    1. À esquerda (`esquerda`)
    2. Centralizado (`centro`)
    3. À direita (`direita`)
    4. Justificado total (`justificado`)
    5. Justificado com última linha à esquerda (`justificado_esquerda` / `text-align-last: left`, padrão ABNT)
    6. Justificado com última linha centralizada (`justificado_centro` / `text-align-last: center`)
    7. Justificado com última linha à direita (`justificado_direita` / `text-align-last: right`)
  - Dropdown de fonte com opção "Do estilo (Nunito)" e fontes do sistema seguras.
  - Seletor de cor do texto integrado com cápsula "do estilo", botão de restauração e color picker nativo.
  - Caixa de seleção "Fundo atrás do texto" com escolha de cor.
  - Pílulas segmentadas de bordas e linhas de destaque (sem borda, tachado, sublinhado).
  - Pílulas segmentadas de marcador (círculo sólido, ponto-traço, traço, numeração).
  - Painel expansível de espaçamentos e recuos de parágrafo (entrelinha, tracking, espaço antes/depois em pt, recuo 1ª linha em mm, recuo esquerdo/direito).
  - Detecção inteligente de sobrescrita local com botões "Redefinir estilo a partir da seleção" e "Limpar ajustes locais".
  - Barra contextual flutuante no texto selecionado (`.ath-barra-contextual`) com comandos de formatação e atalho de citação Zotero.

- **Sistema de Páginas Mestras (Fixa vs Progressiva) e Editor Dedicado:**
  - Inclusão do botão lápis (`✏️`) em cada item de seção e no catálogo de mestras para abrir o `ModalEditorMestra`.
  - Botão de ação "+ Adicionar Mestra ao Documento" com escolha guiada de posição (início, após seção ativa, fim) e modo.
  - Modal editor de mestras completo (`src/ui/athenes_editor_mestra.js`) com prévia interativa em escala da folha, controle de margens, formato, orientação, cabeçalho, rodapé e numeração.
  - **Mestra Fixa:** Grade bidimensional 2D configurável (linhas × colunas e gutter em mm), permitindo posicionamento livre de blocos como no editor de pranchas.
  - **Mestra Progressiva:** Colunas de fluxo contínuo (1, 2 ou 3 colunas) com cálculo dinâmico de gutter e repaginação automática quando o conteúdo cresce.
  - Atualização automática de páginas existentes ao salvar alterações na mestra, preservando blocos e textos intactos.

- **Exportadores PDF e DOCX:**
  - Exportação PDF (`src/core/athenes_export_pdf.js`) aplicando os 7 modos de alinhamento com `text-align-last`, cores e recuos locais.
  - Exportação DOCX (`src/core/athenes_export_docx.js`) mapeando alinhamentos para `<w:jc w:val="..."/>`, espaçamentos para `<w:spacing .../>` e indentações para `<w:ind .../>`.
  - Suíte de testes automatizados com 53 testes passando (`npm test`) e validação visual de tela via Edge headless.

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


## Adoção do Layout Glaux GIS, Sistema de Páginas Mestras/Fluxo e Blocos Compostos (01/11/2026)

- **Adoção Integral do Layout Glaux GIS (`relatorios_modelos`):**
  - O Athenes passou a adotar fielmente a arquitetura visual e os componentes do modelador de relatórios do Glaux GIS (`web/pages/relatorios_modelos.html` e `web/css/relatorios_modelos.css`):
    - **Grade de 3 Colunas:** Coluna esquerda (310 px) para configurações do documento, margens, seções, cabeçalho/rodapé e estilos; Coluna central (`1fr`) com a folha real e barra flutuante; Coluna direita (330 px) para o inspetor de blocos e propriedades avançadas.
    - **Barra de Blocos Flutuante em Pílula (`.rm-barra-blocos`):** Botão Voltar, botão Salvar em laranja preenchido (`.rm-ic-primario`, `#FF6B2C`), separadores, botões Desfazer/Refazer, botões circulares para todos os blocos (Título, Texto, Campos, Figura, Tabela, Quadro, Mapa, Fórmula, Divisor, Espaçamento, Quebra de página) e botão de ativação da grade de 12 colunas (`.rm-ic-guia`) à direita.
    - **Miniatura da Folha com Diagrama de Margens (`.rm-folha-mini`, `#rmMDiag`):** Proporção exata A4 (210 × 297 mm retrato ou 297 × 210 mm paisagem) com retângulo interno pontilhado em laranja `#FF6B2C` indicando a área útil, 4 campos numéricos em milímetros com sufixo `mm` e botão de elo (`.rm-ic-elo`) para sincronizar as quatro margens simultaneamente.
    - **Controles de Linha e Grade de 12 Colunas:** Seletor de linha com botões em pílula numerada `(1)`, `(2)`, `(3)`, `(+)`; 4 cartões de largura pré-definida (Largura toda, Metade esq., Metade dir., Um terço); e trilha interativa de 12 pontos circulares (`.rm-trilha`) permitindo esticar ou encolher o bloco mantendo faixas contínuas.
    - **Acabamento Visual Glaux:** Caixas de marcar circulares com visto branco em fundo laranja (`.rm-chk`), chips de estilos em pílula (`.rm-est-chip`), seletores segmentados de alinhamento e formato.

- **Sistema de Páginas Mestras Fixas e Progressivas com Fluxo Contínuo:**
  - Modelagem em `src/core/athenes_documento.js`:
    - **Mestras Fixas:** Geram páginas pontuais que não se desdobram sozinhas (ex.: Capa, Folha de Rosto, Certificado).
    - **Mestras Progressivas:** Recebem fluxo contínuo de conteúdo. Quando o espaço útil da página acaba, o motor de repaginação automática cria novas páginas sucessivas com a mesma mestra sem exigir criação manual pelo usuário.
    - **Sequência de Seções:** O documento é organizado em seções baseadas em mestras (`Capa fixa → Sumário progressivo → Corpo progressivo → Referências progressivas`). A mudança de layout ocorre pela inserção de uma nova seção, impedindo trocas inadvertidas de mestra pela repaginação.
    - Regra editorial `manterComProximo`: Títulos não ficam órfãos na base da folha, sendo empurrados para a página seguinte com o primeiro parágrafo.

- **Blocos Compostos e Semânticos (Figura, Mapa, Tabela, Quadro e Fórmula):**
  - **Diferenciação Estrita entre Tabela e Quadro:** Conforme normas acadêmicas e bibliográficas (ABNT NBR 14724 / IBGE), a **Tabela** apresenta dados numéricos/estatísticos com laterais verticais abertas (sem bordas externas), enquanto o **Quadro** apresenta sínteses textuais, conceituais e tipologias com caixa totalmente fechada por bordas em todos os lados.
  - **Bloco Figura Composto com Multi-Itens:** Suporte a layouts de 1 item, 2 itens (lado a lado ou empilhados), 3 itens (em linha ou misto 1+2), 4 itens (grade 2×2) e 6 itens (grade 2×3), com identificação individual por letras (Figura 3a, Figura 3b), legenda geral e atribuição de fonte.
  - **Bloco Mapa Cartográfico:** Identificação, área cartográfica com indicador de Norte Verdadeiro (`N ↑`), escala nominal, legenda de convenções cartográficas e fonte institucional (Glaux GIS / SIRGAS 2000).
  - **Fórmulas Matemáticas em LaTeX:** Editor com expressão LaTeX monoespaçada, numeração de equação automática `(1)` e alinhamento customizável.

- **Numeração Automática, Listas Pré-Textuais e Referências Cruzadas:**
  - Função `recalcularNumeracaoAutomatica(doc)` mantém sequências de numeração independentes para Figuras, Mapas, Tabelas, Quadros e Equações.
  - Geradores dinâmicos de listas pré-textuais: `gerarListaFiguras(doc)`, `gerarListaMapas(doc)`, `gerarListaTabelas(doc)`, `gerarListaQuadros(doc)`.
  - Resolução dinâmica de referências cruzadas: marcadores `[ref:tipo:id]` no texto são resolvidos automaticamente para rótulos atualizados (ex.: `Figura 2`, `Tabela 1`, `Quadro 3`).

- **Exportação Fiel em PDF e DOCX Nativo:**
  - `athenes_export_pdf.js`: Renderização de quadros fechados, tabelas com bordas abertas, grades de figuras compostas, mapas com escalas e legendas.
  - `athenes_export_docx.js`: Geração de quebras de seção nativas Word `<w:sectPr>`, tabelas com `<w:insideV w:val="none"/>` (padrão ABNT), quadros com bordas completas, notas e identificações formatadas.

- **Suíte de Testes Automatizados:**
  - Criado o teste `tests/blocos_compostos.test.js`.
  - Suíte completa com **35 testes em 11 suítes**, 100% aprovados via `npm test` sem dependências externas.
  - Validação real executada gerando `tests/amostra_artigo_athenes.docx` e `tests/amostra_artigo_athenes.html`.

## Lista de estilos, salvar estilo e blocos arrastáveis (01/11/2026)

- **Estilos de texto em lista:** a seção deixou de usar chips; agora é uma lista vertical (amostra Aa, nome, fonte · pt · peso). Edição acontece num rascunho com prévia ao vivo; botões **Salvar estilo**, **Salvar como novo** e **Excluir** (só estilos próprios). Código: `montarSecaoEstilos` em `src/ui/athenes_editor.js`.
- **Linhas e grupos (mecânica do Clux.js):** blocos vizinhos com o mesmo `grupo` dividem as 12 colunas (máx. 4). `colocarBloco` (antes/depois/grupo), `moverBlocoPorLinha`, `moverParaLinha`, `duplicarBlocoNaSecao`, `calcularLinhas` em `src/core/athenes_documento.js`. A repaginação trata a linha agrupada como unidade.
- **Arrastar:** na lista de blocos (soltar na borda reordena, no centro agrupa) e na folha, com **alça lateral** (seis pontos) em cada bloco. Inspetor com pills de linha reais e Igualar larguras.
- **Inspetor remontado** a cada redesenho do editor (antes ficava solto ao inserir blocos); histórico passou a registrar edições de texto e do inspetor.
- Testes: `tests/grupos_blocos.test.js` (41 testes no total).

## Famílias de blocos na barra: Figura ▾ e Quadro ▾ (01/11/2026)

- **Figura ▾:** menu com Figura, Gráfico, Fotografia, Diagrama e Fluxograma. Todos são o bloco `figura` com `subtipo`; cada subtipo tem rótulo, numeração, lista (`gerarListaIlustracoes`) e referência cruzada próprios (Gráfico 1, Figura 1).
- **Quadro ▾:** menu com Quadro e Campos (rótulo e valor); o botão Campos avulso saiu da barra.
- Código: `MENUS_BLOCO` e `ligarMenusDeBlocos` em `src/ui/athenes_editor.js`; `ROTULOS_FIGURA` em `src/core/athenes_documento.js`; testes em `tests/ilustracoes.test.js` (43 no total).

## 01/11/2026 — Refinamento Visual de Setas de Menu, Alinhamento de Títulos, Lista Unificada de Mestras e Editor Nível Affinity

- **Setas para baixo (Dropdown de ferramentas):**
  - Substituído pseudo-elemento triangular CSS serrilhado por chevron SVG vetorial nítido (`.rm-seta-dropdown-icone`) em `Figura` e `Quadro`.
  - Ícone base reposicionado sutilmente para nunca colidir com a seta indicadora.
- **Alinhamento e Formato para Títulos e Subtítulos:**
  - Adicionado painel `FORMATO` com os 7 modos de alinhamento com dicas de última linha nos blocos de `titulo` e `subtitulo`.
  - Seletor de fontes e cor de texto integrados.
- **Layout Horizontal Estrito (Linha Única) na Cor do Texto:**
  - Corrigido empilhamento vertical do swatch com "do estilo" através de `.rm-cor-linha-badge` (`display: inline-flex !important; flex-direction: row !important;`).
- **Lista Unificada de Páginas Mestras:**
  - Unificados os acordiões "Seções" e "Catálogo de Mestras" em uma única seção: `PÁGINAS MESTRAS`.
  - Cada item exibe nome, modo (`Fixa · Grade 2D` ou `Progressiva · Fluxo`), orientação, selo de uso (`● Em uso` ou `Disponível`), botão lápis ✏️ funcional e botão `+ Usar`.
  - Removido botão duplicado de "+ Adicionar".
- **Editor de Páginas Mestras Nível Affinity Publisher / InDesign:**
  - Implementado painel de Elementos Recorrentes da Mestra (`tarja`, `caixa_grade`, `rotulo_estatico`, `marca_dagua`).
  - Prévia visual interativa com seleção em canvas e propagação para as páginas do documento e exportação PDF.
- **Barra Contextual Flutuante com Dropdown de Estilo:**
  - Seletor de estilos tipográficos inline (`#athBarraContextEstilo`) para aplicar múltiplos estilos a trechos de texto no mesmo bloco.
- **Correções CSS:**
  - Normalizadas 17 ocorrências de `rgba(49, 79, 121, )` incompletas no arquivo `src/css/athenes_editor.css`.
- **Testes:** 56 testes automatizados passando (`npm test`).

## 01/11/2026 — Ajuste Fino das Caixas de Texto (Páginas Mestras e Filtro dos Documentos)

- **Reestruturação do Card de Páginas Mestras (`.rm-mestra-card`):**
  - **Linha 1 (Cabeçalho):** Título completo da mestra à esquerda com largura total e truncamento suave por reticências apenas em nomes muito extensos (`title` nativo mantido); botão lápis ✏️ dedicado e estilizado no canto superior direito.
  - **Linha 2 (Metadados e Selos):** Linha dedicada ocupando 100% da largura útil do card para os selos (`Fixa · Grade 2D` / `Progressiva · Fluxo`, orientação `Retrato` / `Paisagem` e status `● Em uso (...)` / `Disponível`). Selos com `white-space: nowrap !important; flex: none;`, eliminando quebras verticais de palavras dentro das pílulas.
  - **Linha 3 (Ações):** Rodapé com separador tracejado sutil (`rgba(49, 79, 121, 0.16)`), botão `+ Usar` à esquerda e botões de reordenação/remoção (`^`, `v`, `X`) à direita.
- **Ajuste do Cabeçalho de Filtro dos Documentos (`.rm-filtro-doc-topo`):**
  - Título `Filtro dos documentos` mantido em linha única sem quebra (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`).
  - Botão `+ Filtro` em pílula compacta (`.glx-btn-xs`), com `white-space: nowrap !important; flex-shrink: 0;`, eliminando a quebra em duas linhas (`+` e `Filtro`).
- **Ajuste na Cor do Texto do Painel de Propriedades:**
  - Rótulo `Usar do estilo` compacto e alinhado perfeitamente na mesma linha horizontal com o badge de cor ativa.
- **Validação Visual:**
  - Capturadas evidências em alta resolução (`captura_caixas_texto_ajustadas.png` e `captura_painel_direito_ajustado.png`), comprovando estabilidade e espaçamento profissional.
- **Testes:** 56 testes 100% aprovados (`npm test`).
