---
tags: [passagem-bastao, athenes]
---
# 01 - Passagem de Bastão — Athenes

Este documento é o ponto de partida para qualquer desenvolvedor ou agente que retomar o projeto **Athenes**.

---

## 1. O que é o Athenes

O **Athenes** é um editor web completo para a escrita e diagramação de artigos científicos, relatórios técnicos, monografias e teses, construído sobre os alicerces do **Clux.js** com a linguagem visual **Soft UI** (Nunito, `#FF6B2C`, traços limpos).

### Diretrizes Fundamentais
1. **Nome Único**: O nome da aplicação é **Athenes** em toda a interface, documentação e metadados. A base técnica subjacente permanece o Clux.js.
2. **Escrita Direta na Folha (In-Page WYSIWYG)**: A escrita ocorre diretamente no bloco na folha de papel. A barra lateral serve para propriedades avançadas e ajustes tipográficos finos, nunca como formulário obrigatório para digitar texto.
3. **Independência de GIS**: O Athenes não depende de bases geográficas ou bancos PostGIS. Todo o modelo é modular e autônomo.
4. **Licença**: **GPL-3.0-or-later** (`// SPDX-License-Identifier: GPL-3.0-or-later`).
5. **Repositório Oficial**: `https://github.com/jeffersonfreireribeiro-hash/Athenes.git` (branch `main`).

---

## 2. Como Executar e Testar

### Comandos Principais

| Para | Comando |
| :--- | :--- |
| **Rodar Testes Automatizados** | `npm test` |
| **Iniciar o Servidor Web Local** | `npm start` (abre em `http://127.0.0.1:3300`) |
| **Validar Exportação Real com DOCX e PDF** | `node tests/validacao_real.js` |
| **Conferir Status Git e Remoto** | `git status` e `git remote -v` |
| **Enviar Alterações para o GitHub** | `git push origin main` |

### Pré-requisitos
- **Node.js**: v20+ LTS (utiliza Node Test Runner nativo `node --test` e `node:test`).
- **Navegador**: Qualquer navegador moderno com suporte a ES Modules, Custom Elements / DOM Level 3 e W3C Paged Media (`@page`).
- **Zero Dependências Externas**: O projeto foi desenhado propositalmente sem dependências pesadas (`node_modules` vazio). O gerador ZIP (`zip_builder.js`), o servidor estático (`server.js`), o parser BibTeX e os motores de exportação utilizam apenas APIs nativas do Node.js e da Web Platform (`CompressionStream`, `Uint8Array`, `fetch`).

---

## 3. Onde Paramos (Estado Atual)

Todas as funcionalidades das etapas 1 a 6 foram implementadas, testadas e integradas com sucesso:

1. **Motores de Núcleo (`src/core/`)**:
   - `athenes_documento.js`: Modelo de documento, blocos semânticos (parágrafo, título, subtítulo, lista, citação, nota, tabela, imagem, fórmula, anexo, sumário, referências), herança de modelos de página e cálculo dinâmico de estatísticas/sumário.
   - `athenes_estilos.js`: Sistema tipográfico profissional (Affinity Publisher / InDesign), fontes do sistema seguras, espaçamentos, recuos e perfis acadêmicos (ABNT, APA, IEEE, Vancouver, Personalizado).
   - `athenes_grid.js`: Grid modular com colunas configuráveis (1 a 12), margens milimétricas, réguas e snap magnético com liga/desliga.
   - `athenes_bibliografia.js`: Formatador de nomes (ABNT Caixa Alta, APA Inicial), gerador de citações inline e referências completas, e parser BibTeX offline.
   - `athenes_zotero.js`: Conexão oficial com a Zotero Web API v3, busca em tempo real, importação de coleções e preservação de notas de leitura/fichamento pessoal.
   - `athenes_conexoes.js`: Construtor do Grafo de Conhecimento (obras, autores, anos, temas), cálculo de completude de metadados e sinalização explícita de campos ausentes.
   - `athenes_compatibilidade.js`: Relatório Pré-Voo de compatibilidade DOCX para Word e Google Docs com detecção de riscos e sugestões acionáveis.
   - `athenes_export_pdf.js`: Gerador de HTML Paged Media W3C (`@page`, quebras limpas, numeração, cabeçalhos/rodapés e margens reais).
   - `athenes_export_docx.js`: Gerador nativo de pacotes Office Open XML (`.docx`), produzindo ZIP com `document.xml`, `styles.xml`, `numbering.xml`, `settings.xml` e cabeçalhos.
   - `zip_builder.js`: Gerador de ZIP puro sem dependências externas via compressão Deflate.

2. **Interface e Componentes (`src/ui/` e `src/css/`)**:
   - `athenes_app.js`: Coordenador da aplicação, SPA router, barramentos de evento e persistência no `localStorage`.
   - `athenes_dashboard.js`: Tela inicial com cartões de documentos em andamento, miniaturas de capa, tipo, data e status.
   - `athenes_editor.js`: Folha de papel visual com edição in-page (`contenteditable`), réguas milimétricas interativas, barra flutuante de texto, movimentação de blocos e atalhos de teclado.
   - `athenes_painel_propriedades.js`: Inspetor lateral retrátil para configuração do grid, modelo de página, colunas e tipografia fina.
   - `athenes_painel_zotero.js`: Painel de integração Zotero, busca com debounce, inserção de citação no cursor e área de fichamento pessoal.
   - `athenes_painel_conexoes.js`: Canvas interativo renderizando o grafo de conexões com tooltips e aviso de completude.
   - `athenes_painel_exportar.js`: Modal de exportação com aba de Pré-Voo de Compatibilidade, download de DOCX e visualização/impressão de PDF.

3. **Repositório Git e Segundo Cérebro**:
   - Repositório remoto configurado e sincronizado: `https://github.com/jeffersonfreireribeiro-hash/Athenes.git`.
   - Cofre do Obsidian estruturado em `docs/brain/` com índice MOC e notas especializadas.
   - Diário técnico `docs/passagem.md` criado e atualizado.

---

## 4. Evidências de Validação

- **Suíte de Testes Automatizados**:
  - `npm test` executa 9 suítes e 25 testes unitários: **25 passaram (100% verde)**.
- **Validação de Documento Real Multilíngue e Multipágina**:
  - Script `node tests/validacao_real.js` gera com sucesso um artigo científico de 4 páginas com capa, sumário dinâmico, introdução, citações inline, tabela formatada, fórmulas e referências bibliográficas.
  - O arquivo DOCX gerado (`tests/amostra_artigo_athenes.docx` — 17.9 KB) foi descompactado e validado estruturalmente com o PowerShell (`Expand-Archive`), conferindo a conformidade dos esquemas XML do Word (`document.xml`, `styles.xml`, etc.).
  - O arquivo HTML Paged Media gerado (`tests/amostra_artigo_athenes.html` — 13.8 KB) foi validado contra a especificação W3C CSS Paged Media.

---

## 5. Próximos Passos Imediatos

Consulte [[95 - Backlog e Ideias]] para a lista completa. Os passos imediatos para as próximas sessões são:

1. **Renderização de Fórmulas Matemáticas**:
   - Integrar suporte a renderização visual KaTeX/MathJax no bloco de fórmula na folha e conversão correspondente em OMML (`m:oMath`) no exportador DOCX.
2. **Suporte a Mídia Binária no DOCX**:
   - Implementar inserção de bytes de imagens (`image/png`, `image/jpeg`) dentro do diretório `word/media/` do pacote `.docx`, mapeando as relações `r:embed` no `document.xml.rels`.
3. **Sincronização Bidirecional com Zotero**:
   - Adicionar escrita de coleções ou tags de volta à API do Zotero quando o usuário definir nas configurações de leitura.
4. **Mais Modelos Pré-Configurados**:
   - Adicionar templates rápidos no Dashboard para Monografia de Especialização, Artigo Elsevier de 2 colunas e Relatório Técnico Governamental.
