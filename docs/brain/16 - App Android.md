---
tags: [android, compose, editor-mobile, athenes]
---
# 16 - App Android (Tablet/Celular)

## 1. O que é
App Jetpack Compose (`android/`) com três telas: **Home** (documentos e biblioteca), **Editor** de documentos em blocos e **Leitura/Estudo** de artigos (PDF + fichamento). Pacote debug: `com.athenes.app.debug`. APK servido pelo web em `/api/v1/app/download` (`athenes.apk` na raiz).

## 2. Onde está no código
- Navegação: `MainActivity.kt` (`AppTela`).
- Home: `ui/library/BibliotecaScreen.kt`, `ui/components/AthenesTopBar.kt`.
- Editor: `ui/editor/EditorDocumentoScreen.kt`, `EditorViewModel.kt`, `components/` (`EditorTopBar`, `EditorBarraBlocos`, `EditorPainelEsquerdo`, `EditorPainelInspetor`, `EditorPainelCitacao`).
- Leitura: `ui/reader/`.

## 3. Como funciona hoje (editor, redesenho de 02/11/2026)
- **Folha virtualizada** (`LazyColumn`, um item por bloco) em largura total no celular (margem 16 dp) e 820 dp no tablet. Campos são `BasicTextField` (sem borda/altura mínima do `OutlinedTextField`).
- **Barras no topo, sobrepostas e recolhíveis** (modo foco): barra de título (uma linha de 52 dp) + barra de blocos logo abaixo. Somem ao rolar para baixo, voltam ao rolar para cima ou no topo da folha. Não redimensionam a folha.
- **Barra de blocos**: desfazer/refazer, Título, Texto, Figura, Tabela, Citação longa, Fórmula, Divisor e **Citar** (botão de destaque). Alvos de 44 dp, só ícones de traço.
- **Citar**: painel inferior em sobreposição lista a biblioteca e insere `(SOBRENOME; SOBRENOME, ano)` no bloco de texto selecionado (ou cria parágrafo).
- **Estrutura** (gaveta esquerda) é derivada dos blocos de título e navega até a seção. Inspetor na gaveta direita.
- **Persistência real**: um JSON por documento (`filesDir/editor_<id>.json`) com autosave (900 ms), salvamento ao voltar e em `onCleared`. Documentos novos nascem com um parágrafo vazio; só o documento de exemplo (`doc_reurb_sustentavel`) traz conteúdo de demonstração.
- Edição de legenda, fonte, células de tabela (+ linha), fórmula e numeração automática de fórmulas. Modo "Leitura" torna a folha somente leitura.

## 4. Decisões técnicas e trade-offs
- Barras em overlay (e não no fluxo) para não redimensionar a lista ao recolher; a folha reserva `contentPadding` superior.
- `ModalBottomSheet` foi trocado por painel em sobreposição na própria tela (renderizava mal no emulador e era janela separada).
- `carregarDocumento` é idempotente por id e roda antes do primeiro frame (`remember`), evitando folha vazia piscando.
- Barra de blocos fica **no topo** por preferência do usuário (a versão anterior a pôs no rodapé).

## 5. Verificação e testes
- Validado no emulador (`127.0.0.1:5555`, tablet 1440×2304): Home, editor, modo foco, inserção de blocos, persistência e citação.
- Abertura a frio do editor + toques em rajada gerou um ANR no emulador (debug sem baseline profile, render por software); com intervalos normais não repete. Vale medir em aparelho real / build release.

## 6. Próximos passos
- Figura sem imagem real (só área reservada): falta seletor de imagem e armazenamento.
- Fórmula é texto simples (sem LaTeX renderizado). Sem páginas/mestras, sem exportação PDF/DOCX no app.
- Biblioteca da aba Zotero ainda usa dados locais fixos (status "Zotero Conectado" e botão Sincronizar são ilustrativos).
- Citar usa `ArtigoEstudoRepository.obterArtigosIniciais()`; falta um repositório compartilhado com a biblioteca e a leitura.
- Arrastar para reordenar blocos e seleção múltipla.
