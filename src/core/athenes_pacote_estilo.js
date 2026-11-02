// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Sistema de Pacotes de Estilo Editorial e Identidade Visual.
 * Exportação, importação e validação de pacotes completos de design (.json):
 * - Estilos tipográficos de texto (Título 1, 2, 3, Subtítulo, Corpo, Citações, Legendas, etc.)
 * - Páginas Mestras (Capa, Sumário, Figuras, Corpo, IEEE Colunas, margens, cabeçalhos e rodapés)
 * - Layouts e molduras de imagem, ilustrações, tabelas, quadros e fórmulas matemáticas
 * - Prompt mestre para IAs analisarem documentos externos e gerarem o tema correspondente
 */

import { criarEstilosPadrao, FONTES_SISTEMA } from './athenes_estilos.js';
import { criarModelosPaginaPadrao, MODOS_APLICACAO_MESTRA } from './athenes_documento.js';
import { extrairEstiloGlobalTabela, sanitizarEstiloTabela, garantirEstiloTabela } from './athenes_tabela_estilo.js';

export const VERSAO_SCHEMA_TEMA = 'athenes-tema-v1';

/**
 * Extrai o pacote de estilo completo do documento ativo em um objeto pronto para exportação JSON
 */
export function exportarPacoteEstilo(documento, opcoes = {}) {
  if (!documento) {
    throw new Error('Documento inválido para exportação de estilo');
  }

  const estilos = Array.isArray(documento.estilos) && documento.estilos.length > 0
    ? JSON.parse(JSON.stringify(documento.estilos))
    : criarEstilosPadrao(documento.perfil || 'abnt');

  const mestras = Array.isArray(documento.mestras) && documento.mestras.length > 0
    ? JSON.parse(JSON.stringify(documento.mestras))
    : (Array.isArray(documento.modelosPagina) && documento.modelosPagina.length > 0
      ? JSON.parse(JSON.stringify(documento.modelosPagina))
      : criarModelosPaginaPadrao(documento.perfil || 'abnt'));

  const modelosBlocos = Array.isArray(documento.modelos_blocos)
    ? JSON.parse(JSON.stringify(documento.modelos_blocos))
    : [];

  // Mapeia layouts de moldura existentes nos blocos do documento
  const layoutPadraoBlocos = extrairConfiguracaoMoldurasDoDocumento(documento);

  const pacote = {
    formato: VERSAO_SCHEMA_TEMA,
    versao: '1.0.0',
    dataExportacao: new Date().toISOString(),
    metadados: {
      nome: opcoes.nome || documento.titulo || 'Estilo Editorial Athenes',
      descricao: opcoes.descricao || 'Pacote completo de estilos de texto, páginas mestras e molduras de ilustrações',
      autor: opcoes.autor || (documento.metadados?.autores?.[0]?.nome) || 'Athenes User',
      perfilBase: documento.perfil || 'abnt',
      tags: opcoes.tags || ['academico', 'relatorio', 'artigo']
    },
    configuracaoGlobal: {
      perfil: documento.perfil || 'abnt',
      tipoDoc: documento.tipoDoc || 'artigo',
      espacoDepoisBlocoPadraoPt: 8,
      espacoParagrafoPadraoPt: 6
    },
    estilos: estilos,
    mestras: mestras,
    modelos_blocos: modelosBlocos,
    layout_padrao_figuras: layoutPadraoBlocos
  };

  return pacote;
}

/**
 * Extrai a configuração predominante de moldura de figuras, tabelas e fórmulas dos blocos existentes
 */
export function extrairConfiguracaoMoldurasDoDocumento(doc) {
  const padroes = {
    figura: {
      moldura_tipo: 'limpo',
      linha_estilo: 'solida',
      linha_cor: '#314F79',
      linha_largura_pt: 1.5,
      padding_pt: 8,
      posicao_titulo: 'topo',
      posicao_fonte: 'base',
      subgrade_colunas: 1,
      subgrade_linhas: 3
    },
    tabela: {
      moldura_tipo: 'limpo',
      linha_estilo: 'solida',
      linha_cor: '#314F79',
      padding_pt: 8,
      posicao_titulo: 'topo',
      posicao_fonte: 'base'
    },
    quadro: {
      moldura_tipo: 'borda_completa',
      linha_estilo: 'solida',
      linha_cor: '#CBD5E1',
      padding_pt: 10,
      posicao_titulo: 'topo',
      posicao_fonte: 'base'
    },
    formula: {
      moldura_tipo: 'limpo',
      linha_estilo: 'solida',
      linha_cor: '#314F79',
      posicao_numero: 'direita',
      padding_pt: 6
    }
  };

  // Se o documento tiver blocos reais, captura os estilos reais aplicados
  const todosBlocos = (doc?.secoes || []).flatMap(s => s.blocos || []);
  for (const b of todosBlocos) {
    if ((b.tipo === 'figura' || b.tipo === 'imagem') && b.moldura_tipo) {
      padroes.figura.moldura_tipo = b.moldura_tipo;
      if (b.linha_estilo) padroes.figura.linha_estilo = b.linha_estilo;
      if (b.linha_cor) padroes.figura.linha_cor = b.linha_cor;
      if (b.padding_pt !== undefined) padroes.figura.padding_pt = b.padding_pt;
      if (b.subgrade_colunas) padroes.figura.subgrade_colunas = b.subgrade_colunas;
      break;
    }
  }

  for (const b of todosBlocos) {
    if (b.tipo === 'tabela' && b.moldura_tipo) {
      padroes.tabela.moldura_tipo = b.moldura_tipo;
      if (b.linha_estilo) padroes.tabela.linha_estilo = b.linha_estilo;
      break;
    }
  }

  // Estilo declarativo de células (bordas, zebra, cabeçalho...): sempre exportado, mesmo no padrão
  const tabelaRef = todosBlocos.find(b => b.tipo === 'tabela' && b.estilo_tabela);
  const quadroRef = todosBlocos.find(b => b.tipo === 'quadro' && b.estilo_tabela);
  padroes.tabela.estilo_tabela = extrairEstiloGlobalTabela(tabelaRef || { tipo: 'tabela' });
  padroes.quadro.estilo_tabela = extrairEstiloGlobalTabela(quadroRef || { tipo: 'quadro' });

  for (const b of todosBlocos) {
    if (b.tipo === 'formula' && b.moldura_tipo) {
      padroes.formula.moldura_tipo = b.moldura_tipo;
      if (b.posicao_numero) padroes.formula.posicao_numero = b.posicao_numero;
      break;
    }
  }

  return padroes;
}

/**
 * Valida se um objeto ou string JSON é um pacote de estilo compatível com Athenes
 */
export function validarPacoteEstilo(conteudo) {
  let obj = conteudo;
  if (typeof conteudo === 'string') {
    try {
      obj = JSON.parse(conteudo);
    } catch (err) {
      return { valido: false, erro: 'JSON inválido ou corrompido: ' + err.message };
    }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valido: false, erro: 'O pacote de estilo deve ser um objeto JSON' };
  }

  const erros = [];

  // Flexibilidade: aceita o formato athenes-tema-v1 ou estruturas com estilos/mestras
  if (obj.formato && obj.formato !== VERSAO_SCHEMA_TEMA) {
    erros.push(`Formato "${obj.formato}" não reconhecido. Esperado: "${VERSAO_SCHEMA_TEMA}"`);
  }

  if (!Array.isArray(obj.estilos) || obj.estilos.length === 0) {
    erros.push('O pacote não contém a lista de estilos tipográficos ("estilos")');
  } else {
    // Valida atributos essenciais de estilos
    obj.estilos.forEach((est, idx) => {
      if (!est.id || !est.nome) {
        erros.push(`Estilo no índice ${idx} não possui id ou nome válido`);
      }
    });
  }

  // Sanitiza mestras se presentes
  if (obj.mestras && !Array.isArray(obj.mestras)) {
    erros.push('O campo "mestras" deve ser um array');
  }

  if (erros.length > 0) {
    return { valido: false, erro: erros.join('; '), detalhes: erros };
  }

  // Preenche metadados default caso ausentes
  const pacoteNormalizado = {
    formato: VERSAO_SCHEMA_TEMA,
    versao: obj.versao || '1.0.0',
    dataExportacao: obj.dataExportacao || new Date().toISOString(),
    metadados: {
      nome: obj.metadados?.nome || 'Tema Importado',
      descricao: obj.metadados?.descricao || 'Tema customizado Athenes',
      autor: obj.metadados?.autor || 'Desconhecido',
      perfilBase: obj.metadados?.perfilBase || obj.configuracaoGlobal?.perfil || 'abnt',
      tags: Array.isArray(obj.metadados?.tags) ? obj.metadados.tags : []
    },
    configuracaoGlobal: {
      perfil: obj.configuracaoGlobal?.perfil || 'abnt',
      tipoDoc: obj.configuracaoGlobal?.tipoDoc || 'artigo'
    },
    estilos: obj.estilos,
    mestras: Array.isArray(obj.mestras) && obj.mestras.length > 0 ? obj.mestras : criarModelosPaginaPadrao('abnt'),
    modelos_blocos: Array.isArray(obj.modelos_blocos) ? obj.modelos_blocos : [],
    layout_padrao_figuras: obj.layout_padrao_figuras || {}
  };

  // Sanitiza o estilo declarativo de tabelas/quadros (cores hex, larguras, enums) vindo de JSON externo/IA
  for (const tipo of ['tabela', 'quadro']) {
    const conf = pacoteNormalizado.layout_padrao_figuras[tipo];
    if (conf && typeof conf === 'object' && conf.estilo_tabela) {
      conf.estilo_tabela = sanitizarEstiloTabela(conf.estilo_tabela, tipo);
    }
  }

  return { valido: true, pacote: pacoteNormalizado };
}

/**
 * Aplica a parte global do estilo de tabela do tema ao bloco, preservando os ajustes
 * pontuais (fundos/alinhamentos/bordas por célula, linha ou coluna) feitos pelo autor.
 */
function aplicarEstiloTabelaDoTema(bloco, estiloTema) {
  if (!estiloTema) return;
  const novo = sanitizarEstiloTabela(estiloTema, bloco.tipo === 'quadro' ? 'quadro' : 'tabela');
  if (bloco.estilo_tabela) {
    const atual = garantirEstiloTabela(bloco);
    novo.camadas.linhas = atual.camadas.linhas;
    novo.camadas.colunas = atual.camadas.colunas;
    novo.camadas.celulas = atual.camadas.celulas;
    novo.bordas_celulas = atual.bordas_celulas;
  }
  bloco.estilo_tabela = novo;
}

/**
 * Aplica um pacote de estilo validado ao documento ativo
 */
export function aplicarPacoteEstilo(documento, pacote, opcoes = {}) {
  const validacao = validarPacoteEstilo(pacote);
  if (!validacao.valido) {
    throw new Error(validacao.erro);
  }

  const p = validacao.pacote;
  const aplicarNosBlocosExistentes = opcoes.aplicarNosBlocosExistentes !== false;

  // 1. Atualiza Catálogo de Estilos de Texto
  documento.estilos = JSON.parse(JSON.stringify(p.estilos));

  // 2. Atualiza Páginas Mestras (ambas as chaves mestras e modelosPagina)
  if (Array.isArray(p.mestras) && p.mestras.length > 0) {
    documento.mestras = JSON.parse(JSON.stringify(p.mestras));
    documento.modelosPagina = documento.mestras;
  }

  // 3. Atualiza Modelos de Blocos Customizados
  if (Array.isArray(p.modelos_blocos) && p.modelos_blocos.length > 0) {
    documento.modelos_blocos = JSON.parse(JSON.stringify(p.modelos_blocos));
  }

  // 4. Perfil
  if (p.configuracaoGlobal?.perfil) {
    documento.perfil = p.configuracaoGlobal.perfil;
  }

  // 5. Se solicitado, propaga estilos padrão de moldura para figuras, tabelas e fórmulas existentes
  let blocosAtualizados = 0;
  if (aplicarNosBlocosExistentes && p.layout_padrao_figuras) {
    const todosBlocos = (documento.secoes || []).flatMap(s => s.blocos || []);
    for (const b of todosBlocos) {
      if ((b.tipo === 'figura' || b.tipo === 'imagem') && p.layout_padrao_figuras.figura) {
        const conf = p.layout_padrao_figuras.figura;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        if (conf.linha_estilo) b.linha_estilo = conf.linha_estilo;
        if (conf.linha_cor) b.linha_cor = conf.linha_cor;
        if (conf.padding_pt !== undefined) b.padding_pt = conf.padding_pt;
        if (conf.subgrade_colunas) b.subgrade_colunas = conf.subgrade_colunas;
        blocosAtualizados++;
      } else if (b.tipo === 'tabela' && p.layout_padrao_figuras.tabela) {
        const conf = p.layout_padrao_figuras.tabela;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        if (conf.linha_estilo) b.linha_estilo = conf.linha_estilo;
        aplicarEstiloTabelaDoTema(b, conf.estilo_tabela);
        blocosAtualizados++;
      } else if (b.tipo === 'quadro' && p.layout_padrao_figuras.quadro) {
        const conf = p.layout_padrao_figuras.quadro;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        aplicarEstiloTabelaDoTema(b, conf.estilo_tabela);
        blocosAtualizados++;
      } else if (b.tipo === 'formula' && p.layout_padrao_figuras.formula) {
        const conf = p.layout_padrao_figuras.formula;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        if (conf.posicao_numero) b.posicao_numero = conf.posicao_numero;
        blocosAtualizados++;
      }
    }
  }

  documento.dataModificacao = new Date().toISOString();

  return {
    sucesso: true,
    temaNome: p.metadados.nome,
    estilosQtd: documento.estilos.length,
    mestrasQtd: documento.mestras.length,
    blocosAtualizados
  };
}

/**
 * Retorna o Prompt de Engenharia pronto para copiar e usar com LLMs (ChatGPT, Claude, Gemini).
 * A IA lerá o PDF/documento fornecido pelo usuário e gerará o JSON exatamente no padrão athenes-tema-v1.
 */
export function obterPromptIaParaExtracaoDeLayout() {
  return `Você é um Designer Editorial e Especialista em Tipografia Acadêmica de nível sênior.
Sua missão é analisar minuciosamente o documento (PDF, imagem, texto ou manual de identidade) fornecido e extrair todo o seu sistema de design visual no formato JSON oficial de tema do Athenes ("athenes-tema-v1").

INSTRUÇÕES DE ANÁLISE:
1. TIPOGRAFIA & ESTILOS DE TEXTO:
   - Identifique a família de fonte dominante (escolha entre as fontes padrão do Athenes: "nunito", "times", "arial", "georgia", "garamond", "cambria", "calibri" ou "consolas").
   - Identifique os tamanhos em pontos (pt), pesos numéricos (300, 400, 600, 700, 800), cores hexadecimais (#1F2733, #314F79, etc.), itálico, sublinhado e caixa alta.
   - Identifique os alinhamentos ("esquerda", "centro", "direita", "justificado_esquerda", "justificado", "justificado_centro", "justificado_direita").
   - Identifique entrelinha (ex: 1.0 simples, 1.25, 1.5), espaçamento antes/depois do bloco em pt, e recuo da 1ª linha em mm (ex: 12.5mm ABNT, ou 0mm).
   - Mapeie obrigatoriamente os seguintes estilos essenciais:
     * titulo1: Seção primária (ex: 14pt, peso 800, caixa alta, cor primária)
     * titulo2: Seção secundária (ex: 12pt, peso 700, cor primária)
     * titulo3: Seção terciária (ex: 12pt, peso 600, itálico)
     * subtitulo: Subtítulo do documento (ex: 13pt, peso 400, cor atenuada)
     * corpo: Texto corrido normal (ex: 11pt ou 12pt, peso 400, entrelinha 1.5, recuo 12.5mm)
     * citacao_longa: Citação direta com mais de 3 linhas (ex: 10pt, peso 400, recuo esquerdo 40mm, entrelinha simples 1.0)
     * legenda: Identificação e título de ilustrações/tabelas (ex: 10pt, peso 700, centro)
     * fonte: Nota de fonte/crédito da ilustração (ex: 9pt, peso 400, cor #64748B, centro)
     * nota_rodape: Nota explicativa de rodapé (ex: 9pt, peso 400, entrelinha 1.15)

2. PÁGINAS MESTRAS & GEOMETRIA:
   - Formato de papel ("a4") e orientação ("retrato" ou "paisagem").
   - Margens exatas em milímetros { "t": 30, "r": 20, "b": 20, "l": 30 } (ABNT: Superior 30mm, Esquerda 30mm, Inferior 20mm, Direita 20mm).
   - Grade de colunas (1 coluna ampla para ABNT/monografia, ou 2 colunas com gap_mm: 5 para formato IEEE/Artigo internacional).
   - Cabeçalho (ativo, texto recorrente, alinhamento, linha divisória).
   - Rodapé (ativo, paginação/numeração ativada e posição: "superior_direita", "inferior_direita", "inferior_centro", etc.).

3. MOLDURAS DE ILUSTRAÇÕES, TABELAS E FÓRMULAS:
   - moldura_tipo: "limpo" (sem borda), "linha_lateral" (tarja lateral elegante), "cartao" (fundo suave), "borda_completa" (caixa fechada técnica), ou "esquadro".
   - linha_estilo: "solida" (linha reta), "quadriculada_reta" (cantos retos 0px), "pontilhada", "tracejada", "dupla" (técnica) ou "ponto_destaque".
   - linha_cor: cor hexadecimal da linha decorativa (ex: "#314F79").

4. ESTILO DE CÉLULAS DE TABELAS E QUADROS ("estilo_tabela" dentro de layout_padrao_figuras.tabela e .quadro):
   - bordas.externas {t,r,b,l} e bordas.internas {h,v}: cada aresta é null (sem borda) ou { "largura_pt": 0.25-6, "estilo": "solida"|"tracejada"|"pontilhada"|"dupla", "cor": "#RRGGBB" }.
     Tabela ABNT/IBGE: apenas topo e base externas e divisórias horizontais finas internas; Quadro: todas as bordas.
   - cabecalho { ativo, fundo, cor_texto, negrito, borda_superior, borda_inferior } e rodape { ativo, fundo, negrito, borda_superior, borda_inferior }: contorno independente das células comuns (omita a chave para herdar).
   - coluna_cabecalho { ativo, fundo, negrito, borda_direita }: primeira coluna destacada.
   - zebra { ativo, cor_impar, cor_par }: preenchimento alternado das linhas de dados.
   - padding: "compacto" (2pt) | "normal" (4pt) | "expandido" (8pt); quebra: "normal" | "forcada".
   - camadas.tabela { fundo, h: "esquerda"|"centro"|"direita"|"justificado", v: "topo"|"centro"|"base" }: fundo e alinhamento padrão das células.

FORMATO EXATO DE RESPOSTA:
Responda EXCLUSIVAMENTE com o bloco JSON válido abaixo, sem texto antes ou depois, pronto para ser colado no importador do Athenes:

\`\`\`json
{
  "formato": "athenes-tema-v1",
  "versao": "1.0.0",
  "metadados": {
    "nome": "Nome do Estilo Extraído",
    "descricao": "Estilo baseado no documento analisado",
    "autor": "IA Design Assistant",
    "perfilBase": "abnt",
    "tags": ["academico", "extraido-ia"]
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
    },
    {
      "id": "titulo2",
      "nome": "Título 2 (Seção Secundária)",
      "tipo": "titulo",
      "fonte": "nunito",
      "tamanho_pt": 12,
      "peso": 700,
      "cor": "#1F2733",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": true,
      "alinhamento": "esquerda",
      "entrelinha": 1.3,
      "espaco_antes_pt": 10,
      "espaco_depois_pt": 6,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    },
    {
      "id": "titulo3",
      "nome": "Título 3 (Seção Terciária)",
      "tipo": "titulo",
      "fonte": "nunito",
      "tamanho_pt": 12,
      "peso": 600,
      "cor": "#314F79",
      "italico": true,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "esquerda",
      "entrelinha": 1.3,
      "espaco_antes_pt": 8,
      "espaco_depois_pt": 4,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    },
    {
      "id": "subtitulo",
      "nome": "Subtítulo do Documento",
      "tipo": "subtitulo",
      "fonte": "nunito",
      "tamanho_pt": 13,
      "peso": 400,
      "cor": "#475569",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "centro",
      "entrelinha": 1.4,
      "espaco_antes_pt": 4,
      "espaco_depois_pt": 12,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    },
    {
      "id": "corpo",
      "nome": "Corpo de Texto",
      "tipo": "paragrafo",
      "fonte": "nunito",
      "tamanho_pt": 12,
      "peso": 400,
      "cor": "#1F2733",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "justificado_esquerda",
      "entrelinha": 1.5,
      "espaco_antes_pt": 0,
      "espaco_depois_pt": 6,
      "recuo_primeira_linha_mm": 12.5,
      "recuo_esquerdo_mm": 0
    },
    {
      "id": "citacao_longa",
      "nome": "Citação Direta Longa",
      "tipo": "paragrafo",
      "fonte": "nunito",
      "tamanho_pt": 10,
      "peso": 400,
      "cor": "#1F2733",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "justificado_esquerda",
      "entrelinha": 1.0,
      "espaco_antes_pt": 8,
      "espaco_depois_pt": 8,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 40
    },
    {
      "id": "legenda",
      "nome": "Legenda de Figura / Tabela",
      "tipo": "paragrafo",
      "fonte": "nunito",
      "tamanho_pt": 10,
      "peso": 700,
      "cor": "#1F2733",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "centro",
      "entrelinha": 1.2,
      "espaco_antes_pt": 4,
      "espaco_depois_pt": 2,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    },
    {
      "id": "fonte",
      "nome": "Fonte da Ilustração / Tabela",
      "tipo": "paragrafo",
      "fonte": "nunito",
      "tamanho_pt": 9,
      "peso": 400,
      "cor": "#64748B",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "centro",
      "entrelinha": 1.2,
      "espaco_antes_pt": 2,
      "espaco_depois_pt": 8,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    },
    {
      "id": "nota_rodape",
      "nome": "Nota de Rodapé",
      "tipo": "paragrafo",
      "fonte": "nunito",
      "tamanho_pt": 9,
      "peso": 400,
      "cor": "#475569",
      "italico": false,
      "sublinhado": false,
      "caixa_alta": false,
      "alinhamento": "justificado",
      "entrelinha": 1.15,
      "espaco_antes_pt": 2,
      "espaco_depois_pt": 2,
      "recuo_primeira_linha_mm": 0,
      "recuo_esquerdo_mm": 0
    }
  ],
  "mestras": [
    {
      "id": "capa",
      "nome": "Capa / Página Inicial",
      "tipo": "capa",
      "modo_aplicacao": "fixa",
      "formato": "a4",
      "orientacao": "retrato",
      "margens_mm": { "t": 30, "r": 20, "b": 20, "l": 30 },
      "grade": { "colunas": 1, "gap_mm": 0 },
      "cabecalho": { "ativo": false, "texto": "", "logo": "", "alinhamento": "esquerda" },
      "rodape": { "ativo": false, "texto": "", "numeracao": false },
      "posicionamento_livre": true,
      "elementos_recorrentes": []
    },
    {
      "id": "corpo",
      "nome": "Corpo do Texto",
      "tipo": "corpo",
      "modo_aplicacao": "progressiva",
      "formato": "a4",
      "orientacao": "retrato",
      "margens_mm": { "t": 30, "r": 20, "b": 20, "l": 30 },
      "grade": { "colunas": 1, "gap_mm": 0 },
      "cabecalho": {
        "ativo": true,
        "texto": "{documento.titulo}",
        "logo": "",
        "alinhamento": "direita",
        "linha_divisoria": true
      },
      "rodape": {
        "ativo": true,
        "texto": "{documento.autor_principal}",
        "numeracao": true,
        "posicao_numero": "superior_direita",
        "linha_divisoria": false
      },
      "posicionamento_livre": false,
      "elementos_recorrentes": []
    }
  ],
  "layout_padrao_figuras": {
    "figura": {
      "moldura_tipo": "limpo",
      "linha_estilo": "solida",
      "linha_cor": "#314F79",
      "linha_largura_pt": 1.5,
      "padding_pt": 8,
      "posicao_titulo": "topo",
      "posicao_fonte": "base",
      "subgrade_colunas": 1,
      "subgrade_linhas": 3
    },
    "tabela": {
      "moldura_tipo": "limpo",
      "linha_estilo": "solida",
      "linha_cor": "#314F79",
      "padding_pt": 8,
      "posicao_titulo": "topo",
      "posicao_fonte": "base",
      "estilo_tabela": {
        "bordas": {
          "externas": { "t": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" }, "r": null, "b": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" }, "l": null },
          "internas": { "h": { "largura_pt": 0.75, "estilo": "solida", "cor": "#E2E8F0" }, "v": null }
        },
        "cabecalho": { "ativo": true, "fundo": null, "negrito": true, "borda_inferior": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" } },
        "rodape": { "ativo": false },
        "coluna_cabecalho": { "ativo": false, "fundo": "#F1F5F9" },
        "zebra": { "ativo": false, "cor_impar": "#FFFFFF", "cor_par": "#F1F5F9" },
        "padding": "normal",
        "quebra": "normal",
        "camadas": { "tabela": { "h": "esquerda", "v": "topo" } }
      }
    },
    "quadro": {
      "moldura_tipo": "borda_completa",
      "linha_estilo": "solida",
      "linha_cor": "#CBD5E1",
      "padding_pt": 10,
      "posicao_titulo": "topo",
      "posicao_fonte": "base",
      "estilo_tabela": {
        "bordas": {
          "externas": { "t": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" }, "r": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" }, "b": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" }, "l": { "largura_pt": 1.1, "estilo": "solida", "cor": "#1F2733" } },
          "internas": { "h": { "largura_pt": 0.75, "estilo": "solida", "cor": "#1F2733" }, "v": { "largura_pt": 0.75, "estilo": "solida", "cor": "#1F2733" } }
        },
        "cabecalho": { "ativo": true, "fundo": "#F8FAFC", "negrito": true },
        "zebra": { "ativo": false, "cor_impar": "#FFFFFF", "cor_par": "#F1F5F9" },
        "padding": "normal",
        "quebra": "normal",
        "camadas": { "tabela": { "h": "esquerda", "v": "topo" } }
      }
    },
    "formula": {
      "moldura_tipo": "limpo",
      "linha_estilo": "solida",
      "linha_cor": "#314F79",
      "posicao_numero": "direita",
      "padding_pt": 6
    }
  }
}
\`\`\``;
}
