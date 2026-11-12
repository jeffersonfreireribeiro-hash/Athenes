# Athenes

> **Editor web de relatórios e artigos científicos baseado no Clux.js.**

O **Athenes** é um ambiente completo para a web voltado à escrita e diagramação de artigos científicos, relatórios técnicos, teses e documentos acadêmicos com rigor editorial, tipografia profissional e facilidade de escrita em blocos diretamente na folha.

---

## Destaques do Athenes

- **Escrita Direta na Folha (WYSIWYG)**: Escreva diretamente dentro do bloco na própria folha, com o resultado visual idêntico ao papel. A barra lateral serve para ajustes avançados e tipografia refinada.
- **Estrutura de Modelos de Página e Herança**: Modelos reutilizáveis para **Capa, Corpo do Texto, Sumário, Referências e Anexos**. Alterar um modelo atualiza as páginas vinculadas sem apagar os blocos de texto digitados.
- **Controle Tipográfico Avançado**: Inspirado no Affinity Publisher e InDesign. Permite configurar famílias, pesos, corpos em pt, entrelinhas absolutas/proporcionais, recuo de 1ª linha, recuo francês (hanging indent), espaçamento antes/depois, hifenização e regras para evitar títulos órfãos (`break-after: avoid`).
- **Perfis de Formatação Acadêmica**: Perfis prontos para **ABNT** (NBR 14724 / 6023 / 10520), **APA 7ª Edição**, **IEEE** (duas colunas), **Vancouver** e **Personalizado**.
- **Sumário Dinâmico e Numeração**: Geração automática de sumário (TOC) com linhas pontilhadas (leader dots) e numeração de páginas calculada em tempo real.
- **Integração Zotero & Biblioteca de Leitura**: Conexão com a Zotero Web API oficial v3 e suporte offline a arquivos BibTeX (`.bib`). Permite busca de referências, inserção de citações no cursor, fichamento pessoal (sem sobrescrever dados do Zotero) e visualização do Grafo de Conexões entre autores, obras, temas e anos.
- **Exportação Dupla de Alta Fidelidade**:
  1. **PDF**: Renderização W3C Paged Media (`@page`) milimétrica com quebras exatas e fontes incorporadas.
  2. **DOCX Nativo**: Pacote Office Open XML compatível com Microsoft Word e Google Docs, mapeando estilos semânticos (`Heading 1`, `Heading 2`, `Normal`), tabelas, imagens, legendas e notas.
  3. **Relatório Pré-Voo de Compatibilidade**: Diagnóstico preventivo que orienta o usuário sobre cada elemento antes do download.

---

## Como Executar

### 1. Requisitos
- Node.js >= 20 instalado no sistema.

### 2. Rodar a Suíte de Testes
```bash
npm test
```
Executa os testes automatizados cobrindo modelos de documento, grid, regras tipográficas, parser BibTeX, cliente Zotero, grafo de conexões, relatório pré-voo de compatibilidade, geração de pacotes DOCX e HTML Paged Media para PDF.

### 3. Iniciar o Servidor Local
```bash
npm start
```
Acesse a aplicação no navegador em `http://127.0.0.1:3300`.

### Tradução acadêmica em Referências

Configure `GEMINI_API_KEY` no ambiente do servidor local e nos ambientes necessários do projeto na Vercel. A chave deve permanecer no servidor e nunca ser colocada no código ou no navegador. O modelo padrão é `gemini-3.8-flash`; `GEMINI_TRANSLATION_MODEL` permite escolher outro modelo Gemini Flash disponível para sua conta. A tradução por seleção e por página funciona somente na área de Referências, exige conexão e envia o trecho selecionado à API Gemini. Páginas longas são processadas em partes. O Athenes não impõe um teto diário próprio, mas as cotas e cobranças da conta Google continuam valendo.

---

## Estrutura do Código

```
d:\1. PROJETOS\Athenes\
├── index.html                   # Página inicial da aplicação web Athenes
├── server.js                    # Servidor local estático (zero dependências)
├── package.json                 # Metadados e scripts de execução/teste
├── docs/                        # Documentação técnica e manuais
│   ├── arquitetura.md           # Estudo comparativo, Clux.js, pranchas e proposta técnica
│   ├── zotero_integracao.md     # Estudo das APIs do Zotero, plugin vs web e leitura
│   ├── compatibilidade_docx.md  # Mapeamento semântico DOCX / Google Docs
│   └── manual_do_usuario.md     # Manual completo de utilização
├── src/
│   ├── core/                    # Motores matemáticos, lógica e modelos
│   │   ├── athenes_documento.js     # Modelo de documento, blocos, páginas e sumário
│   │   ├── athenes_estilos.js       # Tipografia, estilos e perfis acadêmicos (ABNT, APA, IEEE)
│   │   ├── athenes_grid.js          # Grid modular, colunas, mm, réguas e snap
│   │   ├── athenes_bibliografia.js  # Formatador de referências, citações e parser BibTeX
│   │   ├── athenes_zotero.js        # Cliente Zotero Web API v3 e cache offline
│   │   ├── athenes_conexoes.js      # Grafo de conexões e dados ausentes
│   │   ├── athenes_compatibilidade.js# Relatório pré-voo de compatibilidade DOCX
│   │   ├── athenes_export_pdf.js    # Gerador HTML Paged Media (@page)
│   │   ├── athenes_export_docx.js   # Gerador nativo Office Open XML (.docx)
│   │   └── zip_builder.js           # Gerador de arquivo ZIP puro
│   ├── ui/                      # Componentes de interface e interação
│   │   ├── athenes_app.js           # Coordenador da aplicação e roteamento
│   │   ├── athenes_dashboard.js     # Área inicial de documentos em andamento
│   │   ├── athenes_editor.js        # Editor WYSIWYG direto na folha
│   │   ├── athenes_icones.js        # Catálogo de ícones SVG lineares
│   │   ├── athenes_painel_propriedades.js # Inspetor lateral e tipografia
│   │   ├── athenes_painel_zotero.js # Biblioteca de leitura e inserção de citações
│   │   ├── athenes_painel_conexoes.js # Canvas visual do grafo de conhecimento
│   │   ├── athenes_painel_exportar.js # Modal de exportação dupla e pré-voo
│   │   └── athenes_reguas.js        # Réguas milimétricas e guias
│   ├── css/                     # Folhas de estilo Soft UI
│   │   ├── athenes_base.css         # Variáveis, fontes Nunito e reset
│   │   ├── athenes_dashboard.css    # Cards e filtros de documentos
│   │   ├── athenes_editor.css       # Folha, blocos editáveis e réguas
│   │   ├── athenes_paineis.css      # Inspetor e modais
│   │   └── athenes_zotero.css       # Biblioteca de leitura e grafo
│   └── assets/
│       └── fonts/                   # Fontes oficiais Nunito WOFF2 (offline)
└── tests/                       # Testes automatizados (Node Test Runner)
    ├── documento.test.js
    ├── estilos.test.js
    ├── grid.test.js
    ├── bibliografia.test.js
    ├── zotero.test.js
    ├── conexoes.test.js
    ├── compatibilidade.test.js
    ├── docx_export.test.js
    └── pdf_export.test.js
```

---

## Licença

Distribuído sob a licença **GPL-3.0-or-later**.
Consulte `LICENSE` para mais detalhes.
