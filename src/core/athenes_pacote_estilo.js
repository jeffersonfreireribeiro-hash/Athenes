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
import { sanitizarEstiloAvancado } from './athenes_estilo_avancado.js';
import { templatesParaPacote, importarTemplatesDoPacote } from './athenes_templates.js';
import { criarModelosPaginaPadrao, MODOS_APLICACAO_MESTRA, SEPARADORES_LEGENDA } from './athenes_documento.js';
import { sanitizarNumeracao } from './athenes_paginacao.js';
import { normalizarConfigSumario, normalizarNumeracaoSecoes } from './athenes_sumario.js';
import { normalizarMestraCanvas, normalizarRegrasMestra } from './athenes_mestra_canvas.js';
import { obterConfigNotas } from './athenes_notas_rodape.js';
import { extrairEstiloFigura, sanitizarEstiloFigura, aplicarEstiloFiguraAoBloco, extrairTipografiaTituloFonte } from './athenes_figura_layout.js';
import { extrairEstiloGlobalTabela, sanitizarEstiloTabela, garantirEstiloTabela } from './athenes_tabela_estilo.js';

export const VERSAO_SCHEMA_TEMA = 'athenes-tema-v1';

/**
 * Extrai o pacote de estilo completo do documento ativo em um objeto pronto para exportação JSON
 */
/** Configuração de sumário a exportar: o padrão do documento ou a do primeiro bloco de sumário que tenha a sua. */
function configSumarioDoDocumento(documento) {
  if (documento.sumario_config_padrao) return documento.sumario_config_padrao;
  for (const sec of documento.secoes || []) for (const b of sec.blocos || []) if (b.tipo === 'sumario' && b.sumario_config) return b.sumario_config;
  return null;
}

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
      espacoParagrafoPadraoPt: 6,
      // paginação padrão do documento (a mestra pode ter a sua em `numeracao_pagina`) e estilo das notas de rodapé
      ...(documento.paginacao ? { paginacao: sanitizarNumeracao(documento.paginacao) } : {}),
      notas_rodape: obterConfigNotas(documento),
      // separador da legenda numerada ("Tabela 1 — Título")
      ...(documento.separador_legenda ? { separador_legenda: documento.separador_legenda } : {}),
      // sumário (tipografia por nível, preenchimento) e numeração decimal das seções
      ...(configSumarioDoDocumento(documento) ? { sumario: normalizarConfigSumario(configSumarioDoDocumento(documento)) } : {}),
      ...(documento.numeracao_secoes ? { numeracao_secoes: normalizarNumeracaoSecoes(documento.numeracao_secoes) } : {}),
      // "Mestre A nas páginas 1–3; Mestre B da 4 em diante"
      ...(Array.isArray(documento.atribuicoes_mestra) && documento.atribuicoes_mestra.length ? { atribuicoes_mestra: normalizarRegrasMestra(documento.atribuicoes_mestra) } : {})
    },
    estilos: estilos,
    mestras: mestras,
    modelos_blocos: modelosBlocos,
    layout_padrao_figuras: layoutPadraoBlocos,
    // templates de documento (Meus templates) que acompanham o tema
    ...(Array.isArray(opcoes.templates) && opcoes.templates.length ? { templates: templatesParaPacote(opcoes.templates) } : {})
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

  // Diagramação de figuras/subgrid (layout, gap, rótulos, moldura, sombra, enquadramento, largura, fluxo)
  const figuraRef = todosBlocos.find(b => (b.tipo === 'figura' || b.tipo === 'imagem') && b.moldura_tipo);
  padroes.figura.estilo_figura = extrairEstiloFigura(figuraRef || {});

  // Estilo declarativo de células (bordas, zebra, cabeçalho...): sempre exportado, mesmo no padrão
  const tabelaRef = todosBlocos.find(b => b.tipo === 'tabela' && b.estilo_tabela);
  const quadroRef = todosBlocos.find(b => b.tipo === 'quadro' && b.estilo_tabela);
  padroes.tabela.estilo_tabela = extrairEstiloGlobalTabela(tabelaRef || { tipo: 'tabela' });
  padroes.quadro.estilo_tabela = extrairEstiloGlobalTabela(quadroRef || { tipo: 'quadro' });
  // Estilos de texto do título e da fonte (ids dos estilos do próprio tema + alinhamento)
  Object.assign(padroes.tabela, extrairTipografiaTituloFonte(todosBlocos.find(b => b.tipo === 'tabela') || {}));
  Object.assign(padroes.quadro, extrairTipografiaTituloFonte(todosBlocos.find(b => b.tipo === 'quadro') || {}));

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
      tipoDoc: obj.configuracaoGlobal?.tipoDoc || 'artigo',
      ...(obj.configuracaoGlobal?.paginacao && typeof obj.configuracaoGlobal.paginacao === 'object'
        ? { paginacao: sanitizarNumeracao(obj.configuracaoGlobal.paginacao) } : {}),
      ...(obj.configuracaoGlobal?.notas_rodape && typeof obj.configuracaoGlobal.notas_rodape === 'object'
        ? { notas_rodape: obterConfigNotas({ notas_config: obj.configuracaoGlobal.notas_rodape }) } : {}),
      ...(SEPARADORES_LEGENDA.some(x => x.id === obj.configuracaoGlobal?.separador_legenda) ? { separador_legenda: obj.configuracaoGlobal.separador_legenda } : {}),
      ...(obj.configuracaoGlobal?.sumario && typeof obj.configuracaoGlobal.sumario === 'object'
        ? { sumario: normalizarConfigSumario(obj.configuracaoGlobal.sumario) } : {}),
      ...(obj.configuracaoGlobal?.numeracao_secoes && typeof obj.configuracaoGlobal.numeracao_secoes === 'object'
        ? { numeracao_secoes: normalizarNumeracaoSecoes(obj.configuracaoGlobal.numeracao_secoes) } : {}),
      ...(Array.isArray(obj.configuracaoGlobal?.atribuicoes_mestra)
        ? { atribuicoes_mestra: normalizarRegrasMestra(obj.configuracaoGlobal.atribuicoes_mestra) } : {})
    },
    estilos: obj.estilos.map(sanitizarEstiloAvancado),
    mestras: (Array.isArray(obj.mestras) && obj.mestras.length > 0 ? obj.mestras : criarModelosPaginaPadrao('abnt')).map(m => normalizarMestraCanvas(m)),
    modelos_blocos: Array.isArray(obj.modelos_blocos) ? obj.modelos_blocos : [],
    layout_padrao_figuras: obj.layout_padrao_figuras || {},
    ...(Array.isArray(obj.templates) ? { templates: templatesParaPacote(obj.templates) } : {})
  };

  // Sanitiza o estilo declarativo de tabelas/quadros (cores hex, larguras, enums) vindo de JSON externo/IA
  const confFig = pacoteNormalizado.layout_padrao_figuras.figura;
  if (confFig && typeof confFig === 'object' && confFig.estilo_figura) {
    confFig.estilo_figura = sanitizarEstiloFigura(confFig.estilo_figura);
  }
  for (const tipo of ['tabela', 'quadro']) {
    const conf = pacoteNormalizado.layout_padrao_figuras[tipo];
    if (conf && typeof conf === 'object' && conf.estilo_tabela) {
      conf.estilo_tabela = sanitizarEstiloTabela(conf.estilo_tabela, tipo);
    }
    if (conf && typeof conf === 'object') Object.assign(conf, extrairTipografiaTituloFonte(conf));
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

  documento.atribuicoes_mestra = JSON.parse(JSON.stringify(p.configuracaoGlobal?.atribuicoes_mestra || []));
  if (p.configuracaoGlobal?.separador_legenda) {
    documento.separador_legenda = p.configuracaoGlobal.separador_legenda;
    if (aplicarNosBlocosExistentes) for (const sec of documento.secoes || []) for (const b of sec.blocos || []) delete b.separador_legenda;
  }
  if (p.configuracaoGlobal?.sumario) {
    documento.sumario_config_padrao = JSON.parse(JSON.stringify(p.configuracaoGlobal.sumario));
    // blocos com configuração própria passam a seguir o tema quando o usuário pede para propagar
    if (aplicarNosBlocosExistentes) for (const sec of documento.secoes || []) for (const b of sec.blocos || []) if (b.tipo === 'sumario') delete b.sumario_config;
  }
  if (p.configuracaoGlobal?.numeracao_secoes) documento.numeracao_secoes = JSON.parse(JSON.stringify(p.configuracaoGlobal.numeracao_secoes));

  // 3. Atualiza Modelos de Blocos Customizados
  if (Array.isArray(p.modelos_blocos) && p.modelos_blocos.length > 0) {
    documento.modelos_blocos = JSON.parse(JSON.stringify(p.modelos_blocos));
  }

  // 4. Perfil
  if (p.configuracaoGlobal?.perfil) {
    documento.perfil = p.configuracaoGlobal.perfil;
  }
  if (p.configuracaoGlobal?.paginacao) documento.paginacao = JSON.parse(JSON.stringify(p.configuracaoGlobal.paginacao));
  if (p.configuracaoGlobal?.notas_rodape) documento.notas_config = JSON.parse(JSON.stringify(p.configuracaoGlobal.notas_rodape));

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
        if (conf.estilo_figura) aplicarEstiloFiguraAoBloco(b, conf.estilo_figura); // preserva imagens e nº de slots
        blocosAtualizados++;
      } else if (b.tipo === 'tabela' && p.layout_padrao_figuras.tabela) {
        const conf = p.layout_padrao_figuras.tabela;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        if (conf.linha_estilo) b.linha_estilo = conf.linha_estilo;
        aplicarEstiloTabelaDoTema(b, conf.estilo_tabela);
        Object.assign(b, extrairTipografiaTituloFonte(conf));
        blocosAtualizados++;
      } else if (b.tipo === 'quadro' && p.layout_padrao_figuras.quadro) {
        const conf = p.layout_padrao_figuras.quadro;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        aplicarEstiloTabelaDoTema(b, conf.estilo_tabela);
        Object.assign(b, extrairTipografiaTituloFonte(conf));
        blocosAtualizados++;
      } else if (b.tipo === 'formula' && p.layout_padrao_figuras.formula) {
        const conf = p.layout_padrao_figuras.formula;
        if (conf.moldura_tipo) b.moldura_tipo = conf.moldura_tipo;
        if (conf.posicao_numero) b.posicao_numero = conf.posicao_numero;
        blocosAtualizados++;
      }
    }
  }

  // 6. Templates do pacote entram em "Meus templates" (quando o chamador informa o armazenamento)
  const templatesImportados = opcoes.storage && p.templates?.length ? importarTemplatesDoPacote(p.templates, opcoes.storage) : 0;

  documento.dataModificacao = new Date().toISOString();

  return {
    sucesso: true,
    templatesImportados,
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
   - Use a nomenclatura da caixa Parágrafo do Word: "Simples" = entrelinha 1, "1,5 linhas" = 1.5, "Duplo" = 2 e "Múltiplos" = qualquer outro valor em "entrelinha". Quando o Word usar "Pelo menos" ou "Exatamente", informe também "entrelinha_tipo": "pelo_menos" | "exatamente" e "entrelinha_pt" (altura da linha em pontos). "Recuo especial: Primeira linha" = "recuo_primeira_linha_mm" e "Especial: Deslocamento" = "recuo_deslocado_mm" (o valor "Por" convertido de cm para mm; use só um dos dois).
   - REGRA DE CONSOLIDAÇÃO (obrigatória): NÃO crie um estilo para cada formatação vista. Agrupe parágrafos por assinatura tipográfica (fonte, tamanho, peso, itálico, caixa alta, alinhamento, recuos, espaçamentos) e consolide em 5 a 8 estilos canônicos: "corpo" (texto corrido), "titulo1"…"titulo3" (um por nível de seção), "citacao_direta" (recuo esquerdo ≥ 20 mm, fonte menor), "legenda" e "fonte_citada" (iguais entre si: uma única formatação para legendas e fontes), "nota_rodape" e "capa" (isolada: só a folha de rosto). Variações de poucos décimos de ponto, de recuo ou de espaçamento pertencem ao MESMO estilo. Negrito, itálico ou cor aplicados a trechos dentro do parágrafo NÃO são estilos. Use o estilo dominante (mais caracteres) como valor do estilo canônico.
   - Identifique também recuos persistentes do parágrafo: "recuo_esquerdo_mm", "recuo_direito_mm" (mm) e "recuo_deslocado_mm" (recuo francês/hanging).
   - ESTILOS DE PARÁGRAFO AVANÇADOS (opcional, só quando o documento realmente os usa): adicione ao estilo o objeto "avancado" com apenas os grupos presentes:
     "avancado": {
       "barra_lateral": { "ativa": true, "lado": "esquerda"|"direita", "largura_pt": 0.5-24, "cor": "#hex", "distancia_mm": 0-20, "estilo": "solida"|"tracejada"|"pontilhada" },   // faixa vertical ao lado de citações/destaques
       "fundo_bloco": { "ativo": true, "cor": "#hex", "preenchimento_mm": 0-15 },   // caixa de fundo atrás do parágrafo
       "capitular": { "ativa": true, "linhas": 2-6, "cor": "#hex", "peso": 100-900, "afastamento_mm": 0-10 },   // letra capitular (drop cap) da 1ª letra
       "palavras_iniciais": { "ativa": true, "quantidade": 1-12, "peso": 100-900, "cor": "#hex" ou "", "caixa_alta": false, "italico": false },   // primeiras palavras destacadas
       "primeira_linha": { "ativa": true, "peso": 100-900, "cor": "#hex" ou "", "caixa_alta": false, "italico": false, "espacamento_letras_em": 0 },
       "ornamento_fim": { "ativo": true, "glifo": "■" (até 3 caracteres), "cor": "#hex", "tamanho_em": 0.4-3, "afastamento_em": 0-3 }   // marca ao fim do texto (ex.: ■, ◆, ❦)
     }
     Não invente grupos que não aparecem no documento; omita "avancado" nos estilos comuns.
   - TEMPLATES (opcional): se o documento for um modelo reutilizável, o pacote pode incluir "templates": [ { "id", "titulo", "descricao", "categoria": "academic"|"report"|"user_custom", "perfil", "tipoDoc", "config": { "pagina", "mestras": [...], "estilos": [...] (mesmo formato de "estilos"/"mestras" acima) }, "secoes": [ { "nome", "mestraId", "blocos": [] } ] } ]. Cada template inclui só o esqueleto (estilos, mestras e seções vazias).
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
   - Cabeçalho e rodapé ("cabecalho" / "rodape"): "ativo"; "zonas" { "esquerda", "centro", "direita" } com texto livre e variáveis
     {documento.titulo}, {documento.autor_principal}, {documento.instituicao}, {documento.ano}, {secao}, {pagina}, {total}, {data};
     "multilinha" (true = as quebras de linha dentro de cada zona viram linhas de verdade; ex.: número da página na 1ª linha à direita e o texto institucional na 2ª à esquerda: esquerda "\nTexto", direita "{pagina}"; false = quebras viram " · ");
     "pares_impares_diferentes" (true = páginas pares usam "zonas_par", ou espelham esquerda↔direita se vazio); "ocultar_primeira_pagina";
     tipografia: "fonte" (id: nunito, times, arial, georgia, garamond, cambria, calibri, consolas), "tamanho_pt" (6-24), "peso" (300-800), "cor" (#RRGGBB), "entrelinha" (1-2.5);
     "linha_divisoria", "linha_espessura_pt", "linha_cor"; "distancia_borda_mm" (da borda da folha) e "respiro_mm" (até o corpo do texto).
   - Paginação da mestra ("numeracao_pagina", ou "configuracaoGlobal.paginacao" para o padrão do documento): "ativo"; "local" ("cabecalho" | "rodape");
     "horizontal" ("esquerda" | "centro" | "direita" | "alternado" = lado externo, para frente e verso); "formato" ("apenas_numero" | "n_de_total" | "n_barra_total" |
     "n_of_total" | "pagina_n" | "pagina_n_de_total" | "pagina_barra_total" | "hifen" | "personalizado" com "mascara" usando {p} e {t}); "prefixo"; "sufixo";
     "estilo" ("arabico" | "romano_mai" | "romano_min" | "alfa_mai" | "alfa_min"); "iniciar_em"; "continuar" (false = reinicia a contagem na 1ª folha da seção); "ocultar_primeira".
   - Notas de rodapé ("configuracaoGlobal.notas_rodape"): "marcador" ("numerico" | "alfabetico" | "simbolos"); "reiniciar" ("documento" | "secao" | "pagina");
     "separador" { "comprimento_pct", "espessura_pt", "cor" }; "fonte"; "tamanho_pt" (ex.: 10); "entrelinha" (ex.: 1.15); "cor".

   - Elementos livres da mestra ("elementos_recorrentes"): todos têm "id", "tipo", "x_mm", "y_mm", "largura_mm", "altura_mm" (origem no canto superior
     esquerdo da folha), "rotacao_graus" (0-359), "bloqueado" (bool), "camada" ("fundo" | "frente") e "z" (ordem dentro da camada). Tipos livres:
     "forma" ("forma": "retangulo" | "elipse" | "linha"; "fundo"; "borda_cor"; "borda_mm"; "raio_mm"; "opacidade"), "texto" ("texto" com variáveis {pagina}, {total},
     {secao}, {data}, {documento.titulo}...; "tamanho_pt"; "cor"; "negrito"; "alinhamento"; "fonte"), "quadro_texto" (região de fluxo do corpo do texto; "colunas"; "gap_mm")
     e os legados "foto_capa", "caixa_grade", "tarja", "marca_dagua", "rotulo_estatico". "quadro_texto_id" da mestra aponta o quadro primário (define as margens efetivas).
     "espelhada": true usa o espelho horizontal dos elementos nas páginas pares (frente e verso). "guias": [{ "eixo": "v" | "h", "pos_mm" }] são guias de régua.
     "grade_guia": { "visivel", "snap", "passo_mm" (malha regular), "colunas", "linhas", "calha_mm" } é a grade de diagramação da folha.
   - Atribuição de mestras por página ("configuracaoGlobal.atribuicoes_mestra"): [{ "mestraId", "de", "ate" }] (páginas 1-based; "ate" omitido = até o fim; vence o intervalo mais específico).

   - Separador da legenda numerada ("configuracaoGlobal.separador_legenda"): "travessao" (Tabela 1 — Título) | "meio_traco" (–) | "hifen" (-) | "dois_pontos" (Tabela 1: Título) | "ponto" (Tabela 1. Título) | "espaco" (Tabela 1 Título). Vale para figuras, tabelas, quadros e mapas.
   - Títulos em N níveis ("nivel" 1 a 9; estilos "titulo1" a "titulo6", os níveis 7+ usam "titulo6") e numeração decimal progressiva
     ("configuracaoGlobal.numeracao_secoes": { "ativa", "separador": "." | "-" | "", "ate_nivel" (1-9), "iniciar_em" }), ex.: 1, 1.1, 1.1.1, 1.1.1.1.
   - Sumário ("configuracaoGlobal.sumario"): "profundidade_max" (1-9); "titulo": { "texto", "alinhamento": "esquerda" | "centro" | "direita" };
     "preenchimento": { "tipo": "pontos" | "tracos" | "linha" | "nenhum", "cor", "espessura_pt", "densidade": "denso" | "normal" | "aberto" };
     "niveis": { "1": {...}, "2": {...}, ... "9": {...} } com, por nível: "mostrar_pagina" (bool), "recuo_mm", "transformacao" ("none" | "uppercase" | "lowercase" | "capitalize"),
     "fonte": { "familia" (id de fonte ou ""), "tamanho_pt", "negrito", "italico", "sublinhado", "cor", "cor_numero", "cor_pagina" } e
     "espacamento": { "entrelinha", "margem_superior_mm", "margem_inferior_mm" }. Na ABNT: nível 1 em CAIXA ALTA negrito, nível 2 em CAIXA ALTA sem negrito,
     nível 3 em negrito, nível 4 em itálico e recuos crescentes (0, 5, 10, 15 mm…).

3. MOLDURAS DE ILUSTRAÇÕES, TABELAS E FÓRMULAS:
   - moldura_tipo: "limpo" (sem borda), "linha_lateral" (tarja lateral elegante), "cartao" (fundo suave), "borda_completa" (caixa fechada técnica), ou "esquadro".
   - linha_estilo: "solida" (linha reta), "quadriculada_reta" (cantos retos 0px), "pontilhada", "tracejada", "dupla" (técnica) ou "ponto_destaque".
   - linha_cor: cor hexadecimal da linha decorativa (ex: "#314F79").

4. DIAGRAMAÇÃO DE FIGURAS E SUBGRID ("estilo_figura" dentro de layout_padrao_figuras.figura):
   - layout: "1" | "2_lado" (1×2) | "3_linha" (1×3) | "4_linha" (1×4) | "2_empilhado" (2×1) | "4_grade" (2×2) | "6_grade" (2×3) | "6_grade_3x2" (3×2) | "3_misto" (1 grande à esquerda + 2 empilhadas) | "3_panoramica" (1 panorâmica no topo + 2 na base).
   - gap_modo: "nenhum" | "compacto" | "normal" | "amplo" (só com 2+ imagens).
   - Rótulos das subfiguras (só com 2+ imagens): subrotulo_tipo: "nenhum" | "letra_minuscula" (a, b, c) | "letra_maiuscula" (A, B, C) | "numero" (1, 2, 3); subrotulo_formato: "parenteses" ((a)) | "fecha" (a)) | "ponto" (a.) | "simples" (a); subrotulo_posicao: "interna" (sobre a imagem) | "externa" (na legenda).
   - Estilos de texto (ids de itens de "estilos", "" = padrão do bloco): titulo_estilo_id, numeracao_estilo_id (prefixo "Figura 1 —"), legenda_estilo_id, fonte_estilo_id, sublegenda_estilo_id (legenda de cada subimagem), subrotulo_texto_estilo_id (rótulo a/b/c); alinhamentos titulo_alinhamento, legenda_alinhamento, fonte_alinhamento, sublegenda_alinhamento: "estilo" | "left" | "center" | "right" | "justify".
   - img_moldura: "nenhuma" | "fina" | "dupla" | "passe_partout"; img_borda_largura_pt (0.25-6), img_borda_estilo ("solida"|"tracejada"), img_borda_cor (#RRGGBB); img_raio: "reto" | "discreto" | "arredondado" | "pilula"; img_sombra: "nenhuma" | "suave" | "media" | "elevada".
   - ajuste_enquadramento: "contain" | "cover" | "fill"; foco_x/foco_y (0-100, ponto focal); proporcao_imagem: "livre" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16".
   - largura_modo: "corpo" | "estendida" | "pagina" | "pct" (com largura_pct 20-100); alinhamento_bloco: "esquerda" | "centro" | "direita"; fluxo: "em_linha" | "contornar_esq" | "contornar_dir".

5. ESTILO DE CÉLULAS DE TABELAS E QUADROS ("estilo_tabela" dentro de layout_padrao_figuras.tabela e .quadro):
   - bordas.externas {t,r,b,l} e bordas.internas {h,v}: cada aresta é null (sem borda) ou { "largura_pt": 0.25-6, "estilo": "solida"|"tracejada"|"pontilhada"|"dupla", "cor": "#RRGGBB" }.
     Tabela ABNT/IBGE: apenas topo e base externas e divisórias horizontais finas internas; Quadro: todas as bordas.
   - cabecalho { ativo, fundo, cor_texto, negrito, borda_superior, borda_inferior } e rodape { ativo, fundo, negrito, borda_superior, borda_inferior }: contorno independente das células comuns (omita a chave para herdar).
   - coluna_cabecalho { ativo, fundo, negrito, borda_direita }: primeira coluna destacada.
   - zebra { ativo, cor_impar, cor_par }: preenchimento alternado das linhas de dados.
   - padding: "compacto" (2pt) | "normal" (4pt) | "expandido" (8pt); quebra: "normal" | "forcada".
   - titulo_estilo_id / fonte_estilo_id / numeracao_estilo_id (prefixo "Tabela 1 —" / "Quadro 1 —") / dados_estilo_id (tipografia das células) são ids de itens de "estilos" (ou ""); titulo_alinhamento / fonte_alinhamento: "estilo" | "left" | "center" | "right" | "justify". Ficam ao lado de "estilo_tabela" em layout_padrao_figuras.tabela e .quadro.
   - camadas.tabela { fundo, h: "esquerda"|"centro"|"direita"|"justificado", v: "topo"|"centro"|"base", fonte (id: "nunito"|"times"|"arial"|"georgia"|"garamond"|"cambria"|"calibri"|"consolas"), tamanho_pt (6-72), negrito, italico, riscado (booleanos), cor_texto (#RRGGBB), wrap: "quebrar"|"nao_quebrar", rotacao: "horizontal"|"cima"|"baixo" }: fundo, alinhamento e tipografia padrão das células.

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
    "espacoParagrafoPadraoPt": 6,
    "notas_rodape": {
      "marcador": "numerico",
      "reiniciar": "documento",
      "separador": { "comprimento_pct": 33, "espessura_pt": 0.75, "cor": "#64748B" },
      "fonte": "nunito",
      "tamanho_pt": 10,
      "entrelinha": 1.15,
      "cor": "#334155"
    }
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
        "zonas": { "esquerda": "{documento.autor_principal}", "centro": "", "direita": "{documento.titulo}" },
        "pares_impares_diferentes": false,
        "ocultar_primeira_pagina": false,
        "fonte": "nunito",
        "tamanho_pt": 9,
        "peso": 400,
        "cor": "#64748B",
        "entrelinha": 1.2,
        "linha_divisoria": true,
        "linha_espessura_pt": 0.75,
        "linha_cor": "#CBD5E1",
        "distancia_borda_mm": 10,
        "respiro_mm": 4
      },
      "rodape": {
        "ativo": true,
        "zonas": { "esquerda": "{secao}", "centro": "", "direita": "" },
        "linha_divisoria": false,
        "distancia_borda_mm": 10,
        "respiro_mm": 4
      },
      "numeracao_pagina": {
        "ativo": true,
        "local": "rodape",
        "horizontal": "direita",
        "formato": "n_de_total",
        "estilo": "arabico",
        "iniciar_em": 1,
        "continuar": true,
        "ocultar_primeira": false
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
      "subgrade_linhas": 3,
      "estilo_figura": {
        "layout": "1",
        "gap_modo": "normal",
        "subrotulo_tipo": "letra_minuscula",
        "subrotulo_formato": "parenteses",
        "subrotulo_posicao": "externa",
        "titulo_estilo_id": "",
        "legenda_estilo_id": "",
        "fonte_estilo_id": "",
        "sublegenda_estilo_id": "",
        "subrotulo_texto_estilo_id": "",
        "titulo_alinhamento": "estilo",
        "legenda_alinhamento": "estilo",
        "fonte_alinhamento": "estilo",
        "sublegenda_alinhamento": "estilo",
        "img_moldura": "nenhuma",
        "img_borda_largura_pt": 0.75,
        "img_borda_estilo": "solida",
        "img_borda_cor": "#94A3B8",
        "img_raio": "discreto",
        "img_sombra": "nenhuma",
        "ajuste_enquadramento": "contain",
        "foco_x": 50,
        "foco_y": 50,
        "proporcao_imagem": "livre",
        "largura_modo": "corpo",
        "largura_pct": 100,
        "alinhamento_bloco": "centro",
        "fluxo": "em_linha"
      }
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
