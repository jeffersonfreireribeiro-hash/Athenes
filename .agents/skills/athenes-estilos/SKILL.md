---
name: athenes-estilos
description: Manter, exportar, importar e estender o sistema de temas e pacotes de estilo editorial (.json) do Athenes, garantindo sincronia entre atributos visuais, mestras, molduras e prompts de IA.
---

# Athenes — Gestão de Estilos Editoriais e Temas (athenes-tema-v1)

Esta skill define as diretrizes e procedimentos obrigatórios para manipulação de estilos visuais, tipografia, páginas mestras e molduras de ilustrações no Athenes.

## Quando Usar

- Sempre que adicionar ou editar propriedades visuais de texto (fontes, tamanhos pt, pesos, entrelinhas, recuos, cores).
- Sempre que criar ou modificar páginas mestras (margens, cabeçalhos, rodapés, numeração de páginas, grades).
- Sempre que alterar layouts de moldura ou subgrade de blocos compostos (figuras, tabelas, quadros, fórmulas matemáticas).
- Sempre que implementar novos perfis normativos (ABNT, APA, IEEE, Vancouver).
- Sempre que estender ou atualizar o importador, o exportador de estilo ou o prompt para IA.

## Regra Permanente de Manutenção

> [!IMPORTANT]
> **REGRA DE OURO:** Todo novo atributo visual ou configuração de layout inserido no Athenes **DEVE ser refletido imediatamente** nos quatro pilares de `src/core/athenes_pacote_estilo.js`:
> 1. `exportarPacoteEstilo`: para incluir o novo atributo na exportação JSON.
> 2. `validarPacoteEstilo`: para validar e normalizar o atributo com defaults seguros.
> 3. `aplicarPacoteEstilo`: para injetar e propagar o atributo no documento ativo.
> 4. `obterPromptIaParaExtracaoDeLayout`: para ensinar às IAs externas como ler e preencher esse novo atributo.

## Estrutura do Pacote de Estilo (`athenes-tema-v1`)

```json
{
  "formato": "athenes-tema-v1",
  "versao": "1.0.0",
  "dataExportacao": "2026-11-02T00:00:00.000Z",
  "metadados": {
    "nome": "Nome do Estilo",
    "descricao": "Finalidade e descrição",
    "autor": "Nome do autor ou instituição",
    "perfilBase": "abnt",
    "tags": ["academico", "artigo"]
  },
  "configuracaoGlobal": {
    "perfil": "abnt",
    "tipoDoc": "artigo",
    "espacoDepoisBlocoPadraoPt": 8,
    "espacoParagrafoPadraoPt": 6
  },
  "estilos": [
    {
      "id": "titulo1",
      "nome": "Título 1 (Seção Primária)",
      "tipo": "titulo",
      "fonte": "nunito",
      "tamanho_pt": 14,
      "peso": 800,
      "cor": "#1F2733",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": true,
      "alinhamento": "esquerda",
      "entrelinha": 1.3,
      "espaco_antes_pt": 14,
      "espaco_depois_pt": 8,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    }
  ],
  "mestras": [
    {
      "id": "corpo",
      "nome": "Corpo do Texto",
      "tipo": "corpo",
      "modo_aplicacao": "progressiva",
      "formato": "a4",
      "orientacao": "retrato",
      "margens_mm": { "t": 30, "r": 20, "b": 20, "l": 30 },
      "grade": { "colunas": 1, "gap_mm": 0 },
      "cabecalho": { "ativo": true, "texto": "{documento.titulo}", "alinhamento": "direita" },
      "rodape": { "ativo": true, "numeracao": true, "posicao_numero": "superior_direita" }
    }
  ],
  "layout_padrao_figuras": {
    "figura": { "moldura_tipo": "limpo", "linha_estilo": "solida", "linha_cor": "#314F79" },
    "tabela": { "moldura_tipo": "limpo", "linha_estilo": "solida", "linha_cor": "#314F79" },
    "quadro": { "moldura_tipo": "borda_completa", "linha_estilo": "solida", "linha_cor": "#CBD5E1" },
    "formula": { "moldura_tipo": "limpo", "posicao_numero": "direita" }
  }
}
```

## Checklist de Verificação

1. Executar `node --test tests/pacote_estilo.test.js`.
2. Executar `npm test` e verificar que todas as suítes passam.
3. Testar a importação de um JSON recém-exportado para garantir idempotência.
