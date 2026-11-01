---
tags: [backlog, ideias, roadmap, athenes]
---
# 95 - Backlog e Ideias de Evolução

Esta nota organiza as oportunidades de aprimoramento, melhorias arquiteturais e novas funcionalidades para as próximas versões do **Athenes**.

---

## 1. Prioridade Alta (Curto Prazo — P1)

- [ ] **Renderização KaTeX para Fórmulas Matemáticas**:
  - Renderizar equações matemáticas no editor usando KaTeX offline ou SVG Math, com edição interativa de código LaTeX no bloco.
- [ ] **Empacotamento de Imagens Binárias no DOCX**:
  - Salvar imagens inseridas pelo usuário como arquivos binários reais dentro da pasta `word/media/` (ex: `image1.png`, `image2.jpeg`) dentro do pacote ZIP, registrando os relacionamentos `r:embed` no `word/_rels/document.xml.rels`.
- [ ] **Seleção Múltipla de Blocos**:
  - Permitir selecionar vários blocos contíguos segurando a tecla `Shift` para exclusão em lote, movimentação conjunta ou aplicação coletiva de estilos.
- [ ] **Importação Direta de CSL-JSON**:
  - Adicionar suporte a arrastar arquivos `.json` exportados no formato Citation Style Language (CSL) além do suporte existente a `.bib`.

---

## 2. Prioridade Média (Médio Prazo — P2)

- [ ] **Conversão LaTeX para OMML no DOCX**:
  - Converter expressões matemáticas LaTeX para a notação nativa do Microsoft Word (`<m:oMath>`), permitindo que as fórmulas sejam editáveis no Word e Google Docs sem perda de formatação.
- [ ] **Páginas Espelhadas (Facing Pages)**:
  - Adicionar suporte a margens alternadas (margem interna maior para encadernação de teses e livros físicos).
- [ ] **Sangria e Marcas de Corte**:
  - Configuração de sangria (bleed de 3 a 5 mm) para exportação gráfica profissional de relatórios com imagens ou carimbos até a borda.
- [ ] **Sincronização Bidirecional com Zotero**:
  - Permitir criar coleções ou adicionar tags de volta à conta do Zotero do pesquisador diretamente pela Web API v3.
- [ ] **Exportação de Fichamento em Markdown**:
  - Gerar arquivo `.md` compilando todas as anotações e fichamentos de uma coleção para consulta rápida no Obsidian.

---

## 3. Prioridade Baixa / Futuro (Longo Prazo — P3)

- [ ] **Busca Direta por DOI / CrossRef**:
  - Campo de entrada rápida onde o usuário cola um DOI (`10.1016/...`) e os metadados são resolvidos diretamente via CrossRef API sem exigir biblioteca prévia.
- [ ] **Modo Colaborativo com CRDT**:
  - Permitir edição simultânea por múltiplos autores usando Yjs ou Automerge via WebSockets.
- [ ] **Geração de Slides a partir do Artigo**:
  - Modo que extrai os títulos, figuras e resumos de cada seção do artigo para gerar uma apresentação de slides preliminar para defesa da pesquisa.

---

## 4. Ideias Descartadas ou Postergadas com Justificativa

- **Plugin Desktop Local do Zotero**:
  - *Status*: **Descartado permanentemente**.
  - *Motivo*: O Zotero 7 quebrou a compatibilidade de extensões XUL antigas. A combinação oficial de **Zotero Web API v3** com **importador BibTeX offline** é 100% mais estável, multiplataforma, segura e imune a quebras de versão do aplicativo desktop.
- **Acoplamento com Bancos PostGIS e Leaflet**:
  - *Status*: **Descartado do escopo do Athenes**.
  - *Motivo*: O Athenes é focado em escrita acadêmica e diagramação editorial. Mapas e GIS pertencem ao Glaux GIS e Glaux Desk. A separação mantém o Athenes leve, rápido e universal.
