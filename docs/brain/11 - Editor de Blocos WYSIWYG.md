---
tags: [editor, wysiwyg, blocos, athenes, glaux-gis, layout]
---
# 11 - Editor de Blocos WYSIWYG, Layout Glaux GIS e Blocos Compostos

Esta nota detalha a experiência de escrita e diagramação do **Athenes**, que adota a arquitetura e a linguagem visual do **Glaux GIS (`relatorios_modelos`)**, centrada na folha de papel visual com edição direta dentro de cada bloco (`in-page contenteditable`), barra de blocos flutuante em pílula e controles avançados de 12 colunas.

---

## 1. O que é e Arquitetura de Interface

O editor do Athenes elimina a desconexão comum de editores baseados em formulários laterais: **o usuário clica e escreve diretamente sobre a página**, vendo em tempo real as fontes, pesos, tamanhos, entrelinhas, margens físicas e quebras exatamente como sairão no papel impresso ou no documento exportado.

A tela segue rigorosamente o layout de 3 colunas do Glaux GIS:
1. **Coluna Esquerda (`.rm-col-esq`, 310 px):** Configuração do documento, miniatura da folha com diagrama de margens (`.rm-folha-mini`, `#rmMDiag`), seções & páginas mestras, cabeçalho e rodapé, estilos de texto e lista de blocos da seção ativa.
2. **Coluna Central (`.rm-col-prev`, `1fr`):** Cabeçalho de prévia com dimensões e contagem de páginas, barra de blocos flutuante em pílula (`.rm-barra-blocos`) com botões circulares e o palco de folhas A4 com edição in-page direta.
3. **Coluna Direita (`.rm-col-dir`, 330 px):** Inspetor de propriedades do bloco selecionado, seletor de linha com pills numeradas `(1)`, `(2)`, `(3)`, `(+)`, 4 presets de largura e trilha interativa de 12 pontos (`.rm-trilha`).

---

## 2. Tipos de Blocos e Blocos Compostos

O catálogo de blocos (`src/core/athenes_documento.js`) distingue entidades semânticas e acadêmicas essenciais:

| Tipo | Descrição Semântica | Padrão Normativo / Visual | Componentes Agrupados |
| :--- | :--- | :--- | :--- |
| `titulo` | Título de Seção | H1, H2 ou H3 numerado | Nível, texto editável, estilo |
| `subtitulo` | Subseção | H2 ou H3 subordinado | Nível, texto editável, estilo |
| `paragrafo` | Corpo do texto | Recuo de 1ª linha e entrelinhas | Texto editável, alinhamento |
| `citacao` | Citação direta longa | Recuo de 4 cm, fonte 10 pt (ABNT) | Texto, autor, ano, página |
| `figura` | Ilustração / Fotografias | Layout de 1 a 6 imagens | Identificação, grid, legenda geral, fonte |
| `mapa` | Mapa territorial | Indicador de Norte, escala e legenda | Título, canvas, escala, legenda carto, fonte |
| `tabela` | Matriz de dados numéricos | **Laterais verticais abertas (ABNT/IBGE)** | Título, colunas, linhas, notas, fonte |
| `quadro` | Síntese textual / conceitual | **Caixa totalmente fechada por bordas** | Título, colunas, linhas, notas, fonte |
| `formula` | Equação matemática | Expressão LaTeX centralizada + `(1)` | LaTeX, número da equação, alinhamento |
| `campos` | Rótulo e valor em pílulas | Grid de 2 ou mais colunas | Pares de rótulo e valor |
| `nota` | Nota de rodapé explicativa | Caixa com traço lateral colorido | Título, texto, tipo (aviso, destaque) |
| `divisor` | Divisor de seção | Linha horizontal suave | Estilo de traço |
| `espaco` | Espaçador vertical | Respiro em pontos tipográficos | Altura em pt |
| `quebra_pagina` | Quebra forçada de página | Ponto de corte na repaginação | Força nova folha |

### Distinção Crucial: Tabela vs. Quadro
Em conformidade com a ABNT NBR 14724 e normas do IBGE:
- **Tabela:** Destinada a dados quantitativos, numéricos ou estatísticos. **Não possui grades verticais nas extremidades laterais** (laterais abertas) e possui bordas horizontais apenas no topo, abaixo do cabeçalho e na base inferior.
- **Quadro:** Destinado a informações textuais, conceituais, classificatórias ou descritivas. **É totalmente delimitado por bordas em todos os lados (caixa fechada)**.
- Ambos possuem sequências de numeração independentes ("Tabela 1", "Quadro 1") e geram listas pré-textuais distintas.

### Multi-Layouts para Figuras
O bloco composto `figura` suporta arranjos múltiplos em modelos reutilizáveis:
- `1`: Imagem individual centralizada.
- `2_lado`: 2 imagens lado a lado (50% / 50%).
- `2_empilhado`: 2 imagens empilhadas verticalmente.
- `3_linha`: 3 imagens em linha (33% cada).
- `3_misto`: 1 imagem em destaque (66%) e 2 menores empilhadas ao lado.
- `4_grade`: 4 imagens em grade 2 × 2.
- `6_grade`: 6 imagens em grade 2 × 3.
Cada sub-item recebe uma letra sequencial automática (ex.: Figura 3a, Figura 3b).

---

## 3. Posicionamento na Folha e Grade de 12 Colunas

Na coluna direita do editor, cada bloco pode ser alinhado com precisão:
- **Linha da folha:** Seletor com pills numeradas `(1)`, `(2)`, `(3)`, `(+)`. Múltiplos blocos na mesma linha dividem o espaço horizontal lado a lado.
- **Presets Rápidos:**
  - `Largura toda`: Ocupa colunas 1 a 12 (100%).
  - `Metade esq.`: Ocupa colunas 1 a 6 (50% à esquerda).
  - `Metade dir.`: Ocupa colunas 7 a 12 (50% à direita).
  - `Um terço`: Ocupa colunas 1 a 4 (33% à esquerda).
- **Trilha de 12 Pontos (`.rm-trilha`):**
  - Cada bolinha circular representa uma coluna de 1 a 12.
  - Clicar numa coluna estica ou encolhe a faixa contínua do bloco.
  - O bloco conecta visualmente as colunas ligadas com uma barra sólida laranja `#FF6B2C`.

---

## 4. Numeração Automática e Referências Cruzadas

O motor `recalcularNumeracaoAutomatica(doc)` varre todas as seções e calcula contadores independentes para:
- `Figura 1`, `Figura 2`, `Figura 3`...
- `Mapa 1`, `Mapa 2`...
- `Tabela 1`, `Tabela 2`...
- `Quadro 1`, `Quadro 2`...
- `Equação (1)`, `Equação (2)`...

No texto dos parágrafos, marcadores interativos no formato `[ref:tipo:id]` (ex.: `[ref:figura:b_123]`) são resolvidos em tempo real para "Figura 1" ou "Tabela 2", mantendo-se sempre corretos mesmo após reordenação, inserção ou remoção de blocos anteriores.

---

## 5. Localização no Código

- `src/ui/athenes_editor.js`: Orquestrador da visualização, grade de 3 colunas, barra de blocos e folhas A4.
- `src/ui/athenes_painel_propriedades.js`: Inspetor do bloco com seletor de linha, presets, trilha de 12 pontos e controles compostos.
- `src/css/athenes_editor.css`: Estilos completos importados do padrão Glaux GIS (`relatorios_modelos.css`) com extensões de folha A4 e blocos compostos.
- `src/core/athenes_documento.js`: Esquemas de dados, cálculo de alturas, numeração automática e referências cruzadas.
- `tests/blocos_compostos.test.js`: Suíte de validação de blocos compostos, numeração e referências.

---

## 6. Estilos em lista e mover blocos (01/11/2026)

- **Estilos de texto:** lista vertical selecionável + rascunho com prévia; Salvar estilo / Salvar como novo / Excluir.
- **Linhas e grupos:** campo `grupo` nos blocos; soltar no centro de outro bloco cria um grupo (até 4 lado a lado, larguras iguais); soltar na borda reordena em linha própria. Funciona na lista de blocos e na folha (alça lateral de seis pontos). Testes em `tests/grupos_blocos.test.js`.
