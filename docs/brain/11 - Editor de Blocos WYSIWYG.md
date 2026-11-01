---
tags: [editor, wysiwyg, blocos, athenes]
---
# 11 - Editor de Blocos WYSIWYG e Escrita Direta na Folha

Esta nota detalha a experiência de escrita do **Athenes**, centrada na folha de papel visual com edição direta dentro de cada bloco (`in-page contenteditable`) e controles flutuantes.

---

## 1. O que é

O editor do Athenes elimina a desconexão comum de editores baseados em formulários laterais: **o usuário clica e escreve diretamente sobre a página**, vendo em tempo real as fontes, pesos, tamanhos, entrelinhas e quebras exatamente como sairão no papel impresso ou no documento exportado.

A barra lateral direita permanece reservada para propriedades estruturais (formato da página, colunas, margens, grid e tipografia avançada), sendo opcional durante o fluxo contínuo de escrita.

---

## 2. Tipos de Blocos Suportados

O catálogo de blocos (`src/core/athenes_documento.js`) abrange todas as necessidades estruturais de relatórios e artigos científicos:

| Tipo | Descrição Semântica | Representação na Folha | Atributos Específicos |
| :--- | :--- | :--- | :--- |
| `titulo` | Título principal de seção ou documento | `<h1>` ou `<h2>` com estilo de título | `nivel: 1`, `estiloId: "titulo_1"` |
| `subtitulo` | Subseção ou cabeçalho de nível 2/3 | `<h2>` ou `<h3>` com numeração subordinada | `nivel: 2`, `estiloId: "titulo_2"` |
| `paragrafo` | Corpo de texto principal | `<p>` com recuo de 1ª linha e entrelinhas | `conteudo: "..."`, `estiloId: "corpo"` |
| `lista` | Lista ordenada ou com marcadores | `<ul>` / `<ol>` com itens em `<li>` | `ordenada: boolean`, `itens: []` |
| `citacao` | Citação longa direta (ABNT > 3 linhas / APA) | `<blockquote>` com recuo de 4 cm e fonte menor | `conteudo: "..."`, `autor: "..."`, `ano: "..."` |
| `tabela` | Matriz de dados tabulares | `<table>` formatada sem grades verticais (ABNT) | `colunas: []`, `linhas: [][]`, `alinhamentos: []` |
| `imagem` | Figura científica ou ilustração | `<img>` responsiva ou placeholder vetorial | `src: "..."`, `legenda: "..."`, `fonte: "..."` |
| `legenda` | Identificação de figuras e tabelas | `<p>` centralizado com numeração automática | `alvo: "Figura 1"`, `texto: "..."` |
| `nota` | Nota de rodapé ou nota explicativa | `<div>` com traço separador | `numero: 1`, `conteudo: "..."` |
| `formula` | Equação matemática ou expressão formal | `<pre>` estilizado com fundo suave | `conteudo: "E = mc²"`, `numero: "(1)"` |
| `anexo` | Documento vinculado, PDF ou apêndice | Pílula de anexo com ícone de clipe e tamanho | `nome: "...", tipo: "pdf", url: "..."` |
| `sumario` | Sumário dinâmico pré-textual | Lista de seções com números de página e pontilhado | `geradoAutomaticamente: true` |
| `referencias`| Lista bibliográfica final do documento | Parágrafos com recuo francês (hanging indent) | `itens: []` sincronizados com Zotero |

---

## 3. Interação, Atalhos e Comportamento de Edição

### In-Page Contenteditable
- Cada bloco textual possui o atributo `contenteditable="true"` em seu elemento interior.
- O evento `input` atualiza a propriedade `bloco.conteudo` do modelo com debounce e dispara o salvamento local.

### Barra de Ferramentas Flutuante (Floating Toolbar)
- Ao selecionar qualquer trecho de texto dentro de um bloco, surge automaticamente uma barra flutuante adjacente ao cursor com ações imediatas:
  - **Negrito** (`Ctrl+B`), **Itálico** (`Ctrl+I`), **Sublinhado** (`Ctrl+U`).
  - **Inserir Citação Zotero**: Abre o seletor rápido para inserir pílula bibliográfica no cursor.
  - **Transformar Tipo de Bloco**: Converte parágrafo em título, citação ou lista.

### Atalhos de Teclado
- **Enter**:
  - Em um bloco de título: cria automaticamente um novo bloco de parágrafo logo abaixo.
  - Em um item de lista: cria o próximo item de lista. Se o item estiver vazio, finaliza a lista e cria um parágrafo.
- **Backspace**: Em um bloco vazio, remove o bloco e foca no bloco anterior.
- **Tab / Shift+Tab**: Aumenta ou diminui a indentação do item em listas.
- **Ctrl+Z / Ctrl+Y (ou Ctrl+Shift+Z)**: Desfaz e refaz alterações na pilha de histórico imutável.

### Manipulação e Reordenação de Blocos
- Cada bloco exibe, ao passar o mouse (`:hover`), uma barra lateral de alças:
  - **Alça de Arrasto (Drag Handle)**: Permite reordenar blocos verticalmente arrastando com o cursor.
  - **Botões Subir / Descer**: Move o bloco uma posição acima ou abaixo mantendo o foco.
  - **Duplicar**: Clona o bloco com todos os estilos aplicados.
  - **Excluir**: Remove o bloco com confirmação se houver conteúdo extenso.

---

## 4. Onde Está no Código

- `src/ui/athenes_editor.js`: Classe `AthenesEditor` responsável pela renderização da página, ciclo de vida dos blocos, manipulação do cursor, atalhos de teclado e barra flutuante.
- `src/css/athenes_editor.css`: Folha de estilo contendo a representação visual da página de papel (`.athenes-pagina-folha`), caixas delimitadoras de blocos (`.athenes-bloco-item`), toolbar flutuante e alças de arrasto.
- `src/core/athenes_documento.js`: Métodos `criarBloco()`, `reordenarBlocos()`, `adicionarBloco()`, `removerBloco()` e `desfazer()`/`refazer()`.

---

## 5. Verificação e Testes

- `tests/documento.test.js`:
  - Valida criação de todos os tipos de blocos com propriedades semânticas.
  - Valida inserção, movimentação e remoção sem perda de integridade de dados.
  - Valida geração automática do sumário a partir dos títulos das páginas.
  - Valida cálculo dinâmico de estatísticas (palavras, caracteres, tabelas, imagens).

---

## 6. Próximos Passos
- Implementar seleção múltipla de blocos contíguos (`Shift+Click`) para exclusão ou movimentação em lote.
- Adicionar renderizador KaTeX em tempo real para blocos de fórmula matemática.
