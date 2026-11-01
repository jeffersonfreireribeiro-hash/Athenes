# Athenes — Manual do Usuário e Guia de Referência

> **Athenes**: Ambiente Web para Escrita e Diagramação de Artigos Científicos, Relatórios e Documentos Acadêmicos.

---

## 1. Visão Geral e Filosofia do Athenes

O **Athenes** foi concebido para unir a fluidez de escrita de editores modernos baseados em blocos com o rigor tipográfico e a precisão milimétrica de ferramentas como o Affinity Publisher e o InDesign.

Diferente de editores tradicionais com barras laterais pesadas para digitação, no Athenes **você escreve diretamente dentro do bloco, na própria folha**. O que você vê na tela corresponde com exatidão ao que será gerado na exportação para **PDF** e para **DOCX** (compatível com Microsoft Word e Google Docs).

---

## 2. Início Rápido (Dashboard de Documentos)

Ao abrir o Athenes, você é recebido pela **Área Inicial**:
1. **Cards de Documentos**: Exibem a miniatura da capa, título, autor principal, data de modificação e estado (`Rascunho`, `Em Revisão` ou `Finalizado`).
2. **Criar Novo Documento**:
   - Clique em `+ Novo Documento`.
   - Defina o título e o subtítulo da sua pesquisa.
   - Escolha o tipo de documento (`Artigo Científico`, `Relatório Técnico`, `Monografia / Tese`, `Ensaio`).
   - Selecione o **Perfil de Formatação**:
     * **ABNT**: NBR 14724 / 6023 (margens 3-3-2-2 cm, entrelinha 1.5, recuo de 1ª linha 1.25 cm, citação longa recuada a 4 cm, referências alinhadas à esquerda).
     * **APA 7ª Edição**: Margens de 1 polegada (2.54 cm), entrelinha dupla, referências com recuo deslocado (hanging indent).
     * **IEEE**: Diagramação em duas colunas, citações numéricas entre colchetes (`[1]`).
     * **Vancouver**: Formato biomédico padrão ICMJE.
     * **Personalizado**: Controle total de margens, colunas e estilos.

---

## 3. Experiência de Escrita em Blocos (WYSIWYG na Folha)

### 3.1 Edição Direta
- Clique em qualquer parágrafo, título, citação ou célula de tabela e comece a digitar.
- O cursor de texto pisca diretamente na folha em escala real de leitura.

### 3.2 Navegação e Teclado
- **Enter**: Ao final de um parágrafo ou título, pressionar Enter cria automaticamente um novo parágrafo abaixo e já transfere o foco para ele.
- **Ctrl + B / Ctrl + I / Ctrl + U**: Aplica Negrito, Itálico e Sublinhado na seleção.
- **Ctrl + Z / Ctrl + Y**: Desfaz e Refaz alterações (mantém até 50 passos no histórico da sessão).

### 3.3 Barra de Blocos Rápidos
Na barra superior do editor, você pode inserir instantaneamente:
- **+ Título**: Insere título de seção (níveis 1, 2 ou 3).
- **+ Parágrafo**: Insere novo bloco de texto com recuo de 1ª linha automático.
- **+ Citação**: Insere citação direta longa com recuo francês de 4 cm (ABNT).
- **+ Tabela**: Insere tabela acadêmica formatada com botões rápidos de `+ Linha` e `+ Coluna`.
- **+ Imagem**: Insere figura com legenda descritiva e fonte.
- **+ Nota**: Insere caixa de destaque ou aviso com borda colorida.
- **+ Página**: Insere uma nova folha no documento.

### 3.4 Manipulação de Blocos
Ao clicar em qualquer bloco na folha:
- Ele é destacado com contorno laranja suave e uma badge com seu tipo.
- A barra de ações permite:
  * **Subir / Descer**: Move o bloco de posição sem perder nenhuma linha de texto.
  * **Duplicar**: Cria uma cópia idêntica logo abaixo.
  * **Excluir**: Remove o bloco da página.
  * **Alça de Arrasto**: Permite arrastar o bloco para reorganizar.

---

## 4. Modelos de Página e Herança de Layout

O Athenes separa com total clareza o que é **conteúdo da página** e o que é **modelo da página (template)**:
- Modelos disponíveis: **Capa**, **Corpo do Texto**, **Sumário**, **Referências**, **Anexos**.
- **Regra de Herança**: Se você alterar as margens, o cabeçalho ou o número de colunas do modelo `Corpo`, todas as páginas que utilizam esse modelo se adaptam instantaneamente, **sem apagar nem modificar os blocos de texto digitados**.

---

## 5. Integração com Zotero e Biblioteca de Leitura

### 5.1 Conectando com a Zotero Web API
1. Clique em **Zotero & Leitura** na barra superior.
2. Clique no ícone de engrenagem e informe seu **User ID** e sua **Chave de API (API Key)** gerada em `zotero.org/settings/keys`.
3. Clique em **Salvar e Sincronizar**. Suas obras e coleções são carregadas em tempo real.

### 5.2 Operação 100% Offline (Importar BibTeX)
Caso você esteja trabalhando sem internet, clique em **Importar BibTeX** e selecione qualquer arquivo `.bib` exportado do Zotero Desktop. O Athenes carrega todos os metadados localmente.

### 5.3 Inserindo Citações no Texto
- No painel lateral do Zotero, pesquise pelo autor ou título e clique no botão **Citar**.
- O Athenes injeta no cursor uma **pílula interativa de citação** formatada conforme a norma (ex.: `(SILVA; SANTOS, 2024)` na ABNT ou `[1]` no IEEE).
- O bloco de **REFERÊNCIAS** ao final do documento é atualizado automaticamente!

### 5.4 Biblioteca de Leitura e Fichamento
- Clicar em qualquer obra abre seus metadados oficiais (autores, periódico, volume, páginas, ano, DOI e resumo original).
- O campo **Meu Fichamento / Notas Pessoais** permite que você registre suas próprias reflexões, citações favoritas e sínteses sobre o artigo. Essas notas ficam gravadas com segurança no seu documento e **nunca sobrescrevem os dados originais do Zotero**.

### 5.5 Grafo de Conexões (Knowledge Graph)
- Clique no botão **Grafo** na barra superior para visualizar o mapa interativo de conexões entre Obras, Autores, Temas e Anos.
- Dados ausentes (como periódicos ou localidades não informadas no registro original) são explicitamente destacados como *Dado Ausente*, garantindo total transparência científica.

---

## 6. Exportação de Alta Fidelidade (PDF e DOCX)

Ao concluir seu trabalho, clique em **Exportar**:
1. **Relatório Pré-Voo de Compatibilidade**: O Athenes analisa cada bloco do documento e apresenta um índice de compatibilidade com o Google Docs e Microsoft Word, informando com clareza qualquer adaptação realizada.
2. **Baixar DOCX Editável**: Gera um pacote `.docx` nativo em padrão Office Open XML com estilos semânticos (`Heading 1`, `Heading 2`, `Normal`, `Citation`), tabelas nativas, imagens embutidas e notas de rodapé. Abre perfeitamente no Google Docs e Word.
3. **Visualizar / Salvar em PDF**: Abre a prévia em CSS Paged Media `@page` para impressão ou geração de PDF vetorial com qualidade gráfica.
