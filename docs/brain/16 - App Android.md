---
tags: [android, compose, editor-mobile, athenes]
---
# 16 - App Android (Tablet/Celular)

## 1. O que é
App Jetpack Compose (`android/`) com três telas: **Home** (documentos e biblioteca), **Editor** de documentos em blocos e **Leitura/Estudo** de artigos (PDF + fichamento). Pacote debug: `com.athenes.app.debug`. O APK é servido pelo web em `/api/v1/app/download` (`athenes.apk` na raiz — hoje é o build **debug**).

## 2. Onde está no código
- Navegação: `MainActivity.kt` (`AppTela`).
- Home: `ui/library/BibliotecaScreen.kt`, `ui/components/AthenesTopBar.kt`.
- Editor: `ui/editor/EditorDocumentoScreen.kt`, `EditorViewModel.kt`, `ExportarPdf.kt`, `components/` (`EditorTopBar`, `EditorBarraBlocos`, `EditorPainelEsquerdo`, `EditorPainelInspetor`, `EditorPainelCitacao`).
- Leitura: `ui/reader/` (`EstudoArtigosScreen`, `ReaderViewModel`, `components/`).
- Dados: `core/data/` (`DocumentoRepository`, `ArtigoEstudoRepository.compartilhado`, `ImagemRepositorio`).
- Exportação (Kotlin puro, testável na JVM): `core/export/ExportadorDocumento.kt`.

## 3. Como funciona hoje
**Editor**
- Folha virtualizada (`LazyColumn`, um item por bloco) com `BasicTextField`; largura total no celular, 820 dp no tablet.
- Barra de título (52 dp) + barra de blocos **no topo**, sobrepostas e recolhíveis ao rolar (modo foco); a folha reserva `contentPadding` superior.
- Gavetas (estrutura à esquerda, inspetor à direita) e o painel **Citar** são overlays com scrim; as gavetas e o scrim começam **abaixo** da barra de título, então voltar/estrutura/inspetor seguem visíveis e clicáveis.
- Persistência real: um JSON por documento (`filesDir/editor_<id>.json`), autosave 900 ms, salvamento ao voltar e em `onCleared`. Só o documento de exemplo (`doc_reurb_sustentavel`) traz conteúdo de demonstração.
- **Figuras com imagem real**: seletor de fotos do sistema (sem permissão de armazenamento); a imagem é copiada e reduzida (lado máx. 1600 px) para `filesDir/imagens` e o bloco guarda só o nome do arquivo; exibição decodificada já reduzida, fora da thread principal.
- **Citar**: painel inferior lista o acervo compartilhado e insere `(SOBRENOME; SOBRENOME, ano)` no bloco de texto selecionado (ou cria parágrafo).
- **Exportar** (menu ⋮): **Word (.docx)** via seletor de arquivos do sistema (OOXML sem bibliotecas, com figuras embutidas, A4, margens ABNT 3/3/2/2, Times 12, entrelinha 1,5, recuo 1,25 cm, citação longa recuada 4 cm) e **PDF** via impressão do sistema (HTML com `@page` A4). O `PrintManager` exige uma `Activity` (desembrulhada do `LocalContext`).
- Estrutura derivada dos blocos de título e navega até a seção. Modo "Leitura" torna a folha somente leitura.

**Leitura**
- Gavetas esquerda/direita são **mutuamente exclusivas** (abrir uma fecha a outra) e a barra flutuante de ferramentas some enquanto há gaveta aberta (antes ficava cortada atrás delas e as duas gavetas esmagavam a página).

**Acervo**
- `ArtigoEstudoRepository.compartilhado` é a instância única do processo usada por Home, Leitura e Citar (antes eram três instâncias separadas).

## 4. Decisões técnicas e trade-offs
- Barras em overlay (não no fluxo): recolher não redimensiona a lista.
- `ModalBottomSheet` trocado por painel em sobreposição na própria tela (renderizava mal no emulador e é janela separada).
- `carregarDocumento` idempotente por id e executado antes do primeiro frame.
- Barra de blocos no **topo** por preferência do usuário.
- Exportador em Kotlin puro (sem `android.*`) para ser testado na JVM; a imagem entra por `ResolvedorImagem`.
- DOCX/HTML do app **não** passam pelo `athenes_pacote_estilo.js` (pacote de tema da web): usam geometria ABNT fixa. Importar/aplicar temas no app é trabalho futuro.

## 5. Verificação e testes
- `./gradlew testDebugUnitTest`: 22 testes (inclui `ExportadorTest`: partes do ZIP, XML bem formado, escape, imagem embutida, HTML `@page`). Os testes `BibliotecaTest` (lista padrão) e `ReaderTest` (gavetas exclusivas) foram atualizados ao comportamento atual.
- Emulador (`127.0.0.1:5555`, tablet 823 dp): Home, editor, modo foco, gavetas, seletor de imagem, persistência da figura após reinstalar, `.docx` extraído do aparelho (XML válido, `image1.png` presente), prévia de impressão em 2 páginas A4, HUD do leitor.
- **Não** foi aberto o `.docx` no Word/LibreOffice (só validação estrutural).
- Abertura a frio do editor + toques em rajada gerou um ANR no emulador; com intervalos normais não repete. O APK distribuído é **debug** (debuggable, sem R8/baseline profile). Um build release usaria outro `applicationId` (sem `.debug`) e quebraria a atualização do app instalado — decisão pendente.

## 6. Próximos passos
- Build release assinado com R8 e baseline profile (definir `applicationId` e o fluxo do updater).
- Fórmula renderizada (hoje texto simples); páginas/mestras no app; importar/aplicar tema `athenes-tema-v1`.
- Zotero real (status "Zotero Conectado" e Sincronizar são ilustrativos); persistir anotações do leitor.
- Arrastar para reordenar blocos e seleção múltipla; verificar o `.docx` no Word.
