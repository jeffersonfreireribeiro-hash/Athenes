---
tags: [moc, athenes]
---
# Athenes — Index (MOC)

Mapa do segundo cérebro do **Athenes** (editor web de relatórios e artigos científicos baseado no **Clux.js**).
Abra a pasta `docs/` como cofre no **Obsidian**: estas notas ficam em `docs/brain/` e os documentos de apoio em `docs/`.

---

## Para Retomar
- [[01 - Passagem de Bastao]] — onde parou, ambiente, como executar, rodar testes e próximos passos.
- [[95 - Backlog e Ideias]] — o que falta, oportunidades de expansão e melhorias futuras.

---

## Mapa do Produto
- [[10 - Arquitetura Geral e Clux]] — base técnica, reaproveitamento do Clux.js e pranchas, separação de camadas.
- [[11 - Editor de Blocos WYSIWYG]] — escrita direta na folha, contenteditable, atalhos, drag-and-drop, desfazer/refazer.
- [[12 - Paginas, Grid e Modelos]] — modelos de página (capa, corpo, sumário, anexos), colunas modulares, réguas, guias e snap.
- [[13 - Tipografia e Perfis Academicos]] — controle tipográfico (Affinity/InDesign), fontes offline, ABNT, APA, IEEE, Vancouver.
- [[14 - Zotero, Fichamento e Grafo]] — Zotero Web API v3, importação BibTeX, biblioteca de leitura, notas de fichamento e grafo de conexões.
- [[15 - Exportacao PDF e DOCX]] — W3C Paged Media (@page), Office Open XML (ECMA-376) para Word/Google Docs e relatório pré-voo.
- [[90 - Fluxos de Trabalho]] — ciclo de vida do artigo: criação, estruturação, citação, revisão e publicação.

---

## Documentos de Apoio (em `docs/`)
- [[passagem]] — diário técnico de cada rodada (o histórico completo com causas, decisões e evidências).
- [[arquitetura]] — estudo comparativo inicial, análise do gerador PDF do Clux.js e das pranchas desktop.
- [[zotero_integracao]] — estudo aprofundado das APIs do Zotero e fundamentação técnica de dispensa de plugin.
- [[compatibilidade_docx]] — tabela de mapeamento semântico DOCX / Google Docs e relatório pré-voo.
- [[manual_do_usuario]] — guia de utilização passo a passo do editor para o usuário final.

---

## Convenções do Cofre
- Uma nota por assunto com seções padronizadas:
  1. **O que é**: objetivo conceitual e escopo.
  2. **Onde está no código**: caminhos exatos de arquivos e funções principais.
  3. **Como funciona hoje**: arquitetura detalhada e fluxo de execução.
  4. **Decisões técnicas e trade-offs**: o porquê de cada escolha.
  5. **Verificação e testes**: evidências e testes automatizados correspondentes.
  6. **Próximos passos**: backlog específico do módulo.
- Ao alterar código, atualize a nota pertinente em `docs/brain/` e acrescente uma nova seção datada no diário `docs/passagem.md`.
