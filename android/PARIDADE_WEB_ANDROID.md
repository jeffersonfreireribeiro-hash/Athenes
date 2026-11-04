# Paridade entre web e Android

Inventário de 04/11/2026. A coluna **estado** descreve o código Android atual, não uma promessa de implementação. `Parcial` significa que existe uma interface ou modelo relacionado, mas falta comportamento da web. A web é a referência funcional. Arquivos citados são relativos à raiz do repositório.

| Recurso da web | Fonte na web | Estado no APK | Destino Android |
| --- | --- | --- | --- |
| Abas Escrita e Artigos Zotero | `src/ui/athenes_dashboard.js`, `src/ui/athenes_estudo_artigos.js` | Parcial: biblioteca e leitor existem, sem as duas abas equivalentes | Documentos / Biblioteca |
| Árvore de pastas, subpastas, contadores, Todos e compartilhadas | `src/ui/athenes_dashboard_pastas.js`, `src/core/athenes_arquivos.js` | Parcial: pastas locais, subpastas e contadores em árvore na folha inferior e painel lateral em janelas largas; faltam pastas compartilhadas e ações de arrastar | Documentos, painel de pastas |
| Criar, renomear, excluir e mover pastas; vincular pasta do Drive | `src/ui/athenes_dashboard_pastas.js`, `src/core/athenes_drive_navegar.js` | Parcial: criação, renomeação e exclusão locais; faltam arrastar pastas e vínculo ao Drive | Documentos, painel de pastas |
| Mover documentos entre pastas | `src/ui/athenes_dashboard_pastas.js` | Parcial: menu Mover para… local; falta arrastar no tablet | Documentos, menu Mover para…; arrastar no tablet |
| Cartões com metadados, busca, ordenação e ações de documento | `src/ui/athenes_dashboard.js`, `src/ui/athenes_arquivos_ui.js`, `src/core/athenes_repositorio.js` | Parcial: cartões, busca e ordenação por data, título ou tipo; faltam metadados e ações equivalentes completos | Documentos |
| Lixeira, duplicação e compartilhamento de documentos | `src/ui/athenes_dashboard_modais.js`, `src/core/athenes_compartilhamento.js` | Parcial: duplicação copia o conteúdo editável; lixeira local persiste, restaura e exclui definitivamente; falta compartilhamento e paridade com a lixeira sincronizada | Documentos, menu do cartão |
| Sincronização de perfil, estado e Google Drive | `src/ui/athenes_dashboard_sincronia.js`, `src/core/athenes_perfil_servidor.js`, `src/core/athenes_drive_sync.js` | Não: estado local não equivale a sincronização | Documentos / Conta |
| Login Google e perfil de colaborador | `src/ui/athenes_login_view.js`, `src/core/athenes_supabase_auth.js`, `src/core/athenes_conta.js` | Não | Conta |
| Backup do espaço e importação de DOCX, JSON e BIB | `src/core/athenes_arquivos.js`, `src/core/athenes_docx_importador.js`, `src/core/athenes_bibliografia.js` | Parcial: importa e exporta JSON simples do editor Android com blocos de texto e tabela; imagens, backup completo, formato JSON da web, DOCX e BIB ainda faltam | Documentos, Importar / Exportar |
| Formatos de papel, orientação, margens e páginas mestras | `src/ui/athenes_config_pagina_modal.js`, `src/ui/athenes_editor_mestra.js`, `src/core/athenes_mestra_canvas.js` | Parcial: formato, orientação e margens configuráveis, persistidos por documento e aplicados ao PDF/DOCX; faltam paginação visual e páginas mestras | Editor, Página |
| Cabeçalho, rodapé, numeração, elementos recorrentes e intervalos de mestra | `src/core/athenes_mestra_render.js`, `src/core/athenes_pagina_elementos.js` | Não | Editor, Mestras |
| Grade de 12 colunas e blocos lado a lado | `src/core/athenes_grid.js`, `src/core/athenes_bloco_layout.js`, `src/ui/athenes_editor_layout_bloco.js` | Parcial: coluna simples por bloco | Editor, Layout |
| Títulos, parágrafos, listas, citações, tabelas, quadros e figuras | `src/ui/athenes_editor_bloco_folha.js`, `src/ui/athenes_tabela_ui.js`, `src/ui/athenes_figura_ui.js` | Parcial: títulos de 1 a 9 com numeração decimal, listas, quadro simples e demais tipos básicos editáveis/exportáveis; faltam propriedades avançadas, paginação e fidelidade visual | Editor, barra de blocos |
| Figura por código, imagem, mapa e fórmula LaTeX | `src/core/athenes_figura_codigo.js`, `src/ui/athenes_figura_codigo_ui.js`, `src/core/athenes_formula.js` | Parcial: imagem e campo de fórmula sem paridade de renderização | Editor, barra de blocos |
| Campos, divisor, espaço, quebra, sumário, lista de ilustrações e referências | `src/core/athenes_sumario.js`, `src/core/athenes_documento.js`, `src/ui/athenes_sumario_painel.js` | Parcial: quebra de página, sumário por níveis e lista de ilustrações derivados dos blocos, com links no PDF; faltam números de página, opções avançadas, campos, espaço e referências | Editor, barra de blocos |
| Notas de rodapé, marcadores e referências cruzadas | `src/core/athenes_notas_rodape.js`, `src/core/athenes_marcadores.js`, `src/ui/athenes_marcadores_ui.js` | Não | Editor, Inserir |
| Estilos editáveis, sete alinhamentos, pt, entrelinha, espaçamentos e recuos | `src/core/athenes_estilos.js`, `src/core/athenes_estilo_avancado.js`, `src/ui/athenes_editor_estilo_modal.js` | Parcial: sete alinhamentos selecionáveis, persistidos e exportados (última linha fiel no PDF); visualização Compose não distingue as três variantes da última linha; faltam estilos editáveis e controles tipográficos | Editor, Estilos |
| Fontes de catálogo/importadas/variáveis e hifenização | `src/core/athenes_fontes.js`, `src/core/athenes_fontes_catalogo.js`, `src/core/athenes_hifenizacao.js` | Não | Editor, Estilos |
| Pacote `athenes-tema-v1`: importar, validar, aplicar, exportar e prompt de extração | `src/core/athenes_pacote_estilo.js`, `src/ui/athenes_central_estilos_modal.js` | Não | Editor, Central de Estilos |
| Modelos ABNT, APA, Vancouver e IEEE | `src/core/athenes_templates.js`, `src/core/athenes_template_de_tema.js` | Não | Novo documento |
| Citar Zotero e Dividir Bloco Aqui | `src/ui/athenes_editor_barra_contextual.js`, `src/ui/athenes_painel_zotero.js` | Parcial: inserção simples de citação, sem divisão | Editor, barra contextual |
| Oito estilos bibliográficos e referências automáticas com links | `src/core/athenes_bibliografia_estilos.js`, `src/core/athenes_citacao.js`, `src/core/athenes_bibliografia.js` | Não | Editor, Citações / Referências |
| Modos Edição, Sugestão, Comparar e Leitura | `src/ui/athenes_visoes_revisao.js` | Parcial: seletor sem fluxo completo | Editor, Revisão |
| Comentários, sugestões e comparação de versões | `src/core/athenes_colaboracao.js`, `src/core/athenes_diff.js`, `src/ui/athenes_sugestoes_ui.js` | Não | Editor, Revisão |
| Presença e compartilhamento com permissões | `src/core/athenes_compartilhamento.js`, `src/ui/athenes_compartilhar_modal.js` | Não | Editor, Compartilhar |
| PDF fiel e DOCX, com opções de exportação | `src/core/athenes_export_pdf.js`, `src/core/athenes_export_docx.js`, `src/ui/athenes_painel_exportar.js` | Parcial: exportadores Android básicos | Editor, Exportar |
| Atalhos, zoom, réguas, grade, margens e desfazer/refazer | `src/core/athenes_atalhos.js`, `src/ui/athenes_zoom_canvas.js`, `src/ui/athenes_reguas.js` | Parcial: desfazer/refazer no editor | Editor |
| Configuração Zotero na conta e no Drive | `src/core/athenes_zotero_config.js`, `src/core/athenes_zotero_conta.js` | Parcial: chave protegida pelo Android Keystore neste aparelho; faltam cópias no servidor e no Drive com resolução pela mais recente | Conta, Zotero |
| Biblioteca Zotero paginada, filtros, busca, período e ordenação | `src/core/athenes_zotero.js`, `src/core/athenes_biblioteca_artigos.js` | Parcial: consulta paginada de 100, cache local, busca, filtros por tipo/coleção/ano e ordem; faltam integração de conta e estados completos | Biblioteca |
| Coleções Zotero como pastas de bibliografia | `src/core/athenes_zotero_pastas.js` | Parcial: coleções paginadas e filtro em árvore hierárquica na folha inferior; falta integração com a árvore geral de pastas e contadores | Biblioteca, pastas |
| Campos Zotero por tipo e autores com função | `src/core/athenes_zotero_campos.js`, `src/ui/athenes_estudo_artigos_dados.js` | Parcial: normalização e painel Informações por tipo com função dos criadores; falta ampliar todos os rótulos e tipos da web | Biblioteca, detalhes do item |
| PDF real em rolagem contínua, zoom e cache | `src/ui/athenes_estudo_artigos_tela.js`, `src/ui/athenes_estudo_artigos.js` | Parcial: seleção local, renderização sob demanda, zoom de 75% a 200% e cache em `PdfRealViewer.kt`; falta vínculo ao Drive | Estudo |
| Grifos, seis cores, caneta, linha, borracha, notas, citações e fichamento | `src/ui/athenes_estudo_artigos_anotacoes.js`, `src/ui/athenes_estudo_artigos_painel_direito.js` | Parcial: traços, notas e citações guardados localmente e visíveis na página; falta seleção real de texto do PDF, importação Zotero e paridade completa do fichamento | Estudo |
| Selecionar PDF, baixar anexo e importar notas do Zotero | `src/core/athenes_zotero_anexos_notas.js`, `src/ui/athenes_estudo_artigos_modais.js` | Parcial: seleção local, escolha e download de PDF importado, e importação de notas/destaques com IDs estáveis; falta paridade completa dos dados importados e vínculo com Drive | Estudo, PDF |
| Citação direta longa a partir de destaque | `src/core/athenes_citacao.js`, `src/ui/athenes_estudo_artigos_anotacoes.js` | Não | Estudo, Citar |
| Grafo de obras, autores, temas e anos | `src/core/athenes_conexoes.js`, `src/ui/athenes_painel_conexoes.js` | Não | Biblioteca, Conexões |

## Sequência de implementação

1. Navegação adaptativa, conta e pastas; preservar o estado na rotação.
2. Persistência e sincronização reais para documentos e Zotero, com fila offline.
3. PDF real, sem páginas simuladas quando não houver arquivo, e ferramentas de anotação.
4. Motor de documento compatível com blocos, estilos, mestras, citações e exportação da web.
5. Revisão, colaboração, acessibilidade e medição de desempenho em aparelhos reais.

Nenhuma linha marcada `Não` ou `Parcial` deve ser tratada como paridade concluída. A implementação completa requer contratos de dados compatíveis com a web e testes de integração para importação, sincronização, renderização e exportação.

## Interface adaptativa

A navegação principal agora oferece Documentos, Biblioteca, Estudo e Conta. Em largura Compact usa barra inferior; em Medium e Expanded usa trilho lateral, segundo `WindowSizeClass`. A tela selecionada e os IDs do documento/artigo sobrevivem à rotação. O editor continua imersivo. Ainda faltam os painéis simultâneos de lista/detalhe, painéis redimensionáveis, controles completos da conta e testes de interface em aparelho.

## Leitor de PDF

Sem arquivo vinculado, o leitor mostra o estado vazio e a ação **Selecionar PDF**. A escolha usa o seletor de documentos do Android e guarda a URI por artigo. `PdfRenderer` abre o arquivo fora da thread principal; `LazyColumn` compõe as páginas visíveis e um cache LRU limita os bitmaps a aproximadamente 24 MiB. A contagem de páginas vem do PDF. Caneta, marca-texto, linha e borracha desenham sobre a página real em coordenadas proporcionais; os traços são guardados localmente por artigo. Notas adesivas aparecem na posição correspondente e citações são acessíveis pelo número de página. Notas e citações são guardadas localmente. Ainda falta extrair seleção de texto real do PDF e importar anotações do Zotero.

Os indicadores antigos de conexão com Drive e a mensagem de sincronização concluída foram retirados dos dados de exemplo e do formulário. O formulário ainda mantém os dados apenas na sessão atual.
