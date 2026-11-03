// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modelo de Dados do Documento, Páginas Mestras, Seções e Blocos.
 * Arquitetura declarativa e reativa com repaginação automática e fluxo contínuo.
 */

import { extrairItensSumario, nivelDe } from './athenes_sumario.js';
import { parametrosTextoPt, linhasEstimadas, lacunasInternasPt, alturaTabelaPt, dividirParaPagina, podeDividir } from './athenes_fragmentos.js';
import { garantirEstilosDeTitulos } from './athenes_estilos.js';
import { aplicarRegrasMestraNasPaginas, vincularOverridesAsPaginas } from './athenes_mestra_canvas.js';
import { criarEstilosPadrao, PERFIS_FORMATACAO } from './athenes_estilos.js';
import { obterLayoutFigura, CHAVES_ESTILO_FIGURA } from './athenes_figura_layout.js';
import { geometriaCorpoMm, calcularNumerosExibidos } from './athenes_paginacao.js';
import {
  obterConfigNotas, idsNotasDoBloco, alturaSegmentoPt, alturaSeparadorPt, ajustarNotasAoEspaco, rotularNotas, PT_POR_MM
} from './athenes_notas_rodape.js';

let contadorId = 0;
export const gerarId = prefixo => `${prefixo || 'b'}_${Date.now().toString(36)}_${(contadorId++).toString(36)}`;

export const TIPOS_DOCUMENTO = Object.freeze([
  { id: 'artigo', rotulo: 'Artigo Científico', icone: 'artigo' },
  { id: 'relatorio', rotulo: 'Relatório Técnico', icone: 'relatorio' },
  { id: 'monografia', rotulo: 'Monografia / Tese / TCC', icone: 'livro' },
  { id: 'ensaio', rotulo: 'Ensaio / Paper Curto', icone: 'documento' }
]);

/** Família "Figura": cada subtipo tem rótulo, numeração e lista próprios (ex.: Gráfico 1, Figura 1). */
export const ROTULOS_FIGURA = Object.freeze({
  figura: 'Figura',
  grafico: 'Gráfico',
  fotografia: 'Fotografia',
  diagrama: 'Diagrama',
  fluxograma: 'Fluxograma',
  esquema: 'Esquema',
  croqui: 'Croqui',
  desenho: 'Desenho',
  ilustracao: 'Ilustração',
  personalizado: 'Personalizado'
});

export function rotuloDaFigura(bloco) {
  if (bloco?.prefixo_customizado && String(bloco.prefixo_customizado).trim()) {
    return String(bloco.prefixo_customizado).trim();
  }
  return ROTULOS_FIGURA[bloco?.subtipo] || ROTULOS_FIGURA.figura;
}

export const MODOS_APLICACAO_MESTRA = Object.freeze({
  FIXA: 'fixa',
  PROGRESSIVA: 'progressiva'
});

export const TIPOS_MODELO_PAGINA = Object.freeze([
  { id: 'capa', rotulo: 'Capa / Página de Rosto', modo: 'fixa' },
  { id: 'sumario', rotulo: 'Sumário / Pré-Textual', modo: 'progressiva' },
  { id: 'figuras', rotulo: 'Lista de Figuras e Tabelas', modo: 'progressiva' },
  { id: 'corpo', rotulo: 'Corpo do Texto (Padrão)', modo: 'progressiva' },
  { id: 'ieee_colunas', rotulo: 'Artigo em 2 Colunas (IEEE)', modo: 'progressiva' },
  { id: 'referencias', rotulo: 'Referências Bibliográficas', modo: 'progressiva' },
  { id: 'anexos', rotulo: 'Anexos e Apêndices', modo: 'progressiva' }
]);

export const TIPOS_BLOCO = Object.freeze([
  'titulo',
  'subtitulo',
  'paragrafo',
  'lista',
  'citacao',
  'nota',
  'tabela',
  'quadro',
  'figura',
  'mapa',
  'imagem',
  'formula',
  'campos',
  'divisor',
  'espaco',
  'anexo',
  'sumario',
  'referencias',
  'separador',
  'quebra_pagina'
]);

/**
 * Cria o catálogo de páginas mestras reutilizáveis do documento
 */
export function criarModelosPaginaPadrao(perfilId = 'abnt') {
  const p = PERFIS_FORMATACAO[perfilId] || PERFIS_FORMATACAO.abnt;
  const m = p.pagina.margens_mm;

  return [
    {
      id: 'capa',
      nome: 'Capa / Página Inicial',
      tipo: 'capa',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.FIXA,
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { t: 30, r: 20, b: 20, l: 30 },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: { ativo: false, texto: '', logo: '', alinhamento: 'esquerda' },
      rodape: { ativo: false, texto: '', numeracao: false },
      posicionamento_livre: true,
      elementos_recorrentes: []
    },
    {
      id: 'sumario',
      nome: 'Sumário',
      tipo: 'sumario',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.PROGRESSIVA,
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: { ativo: false, texto: '', logo: '', alinhamento: 'esquerda' },
      rodape: { ativo: true, texto: '', numeracao: false },
      posicionamento_livre: false,
      elementos_recorrentes: []
    },
    {
      id: 'figuras',
      nome: 'Lista de Figuras e Tabelas',
      tipo: 'figuras',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.PROGRESSIVA,
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: { ativo: true, texto: 'LISTA DE ILUSTRAÇÕES', logo: '', alinhamento: 'direita', linha_divisoria: true },
      rodape: { ativo: true, texto: '', numeracao: false },
      posicionamento_livre: false,
      elementos_recorrentes: []
    },
    {
      id: 'corpo',
      nome: 'Corpo do Texto',
      tipo: 'corpo',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.PROGRESSIVA,
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { ...p.pagina.grade },
      cabecalho: {
        ativo: true,
        texto: '{documento.titulo}',
        logo: '',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '{documento.autor_principal}',
        numeracao: true,
        posicao_numero: p.numeracao.posicao,
        linha_divisoria: false
      },
      posicionamento_livre: false,
      elementos_recorrentes: []
    },
    {
      id: 'ieee_colunas',
      nome: 'Artigo em 2 Colunas (IEEE)',
      tipo: 'corpo',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.PROGRESSIVA,
      formato: 'a4',
      orientacao: 'retrato',
      margens_mm: { t: 20, r: 15, b: 20, l: 15 },
      grade: { colunas: 2, gap_mm: 4.5 },
      cabecalho: {
        ativo: true,
        texto: '{documento.titulo}',
        logo: '',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '',
        numeracao: true,
        posicao_numero: 'centro'
      },
      posicionamento_livre: false,
      elementos_recorrentes: []
    },
    {
      id: 'referencias',
      nome: 'Referências Bibliográficas',
      tipo: 'referencias',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.PROGRESSIVA,
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: {
        ativo: true,
        texto: 'REFERÊNCIAS',
        logo: '',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '',
        numeracao: true,
        posicao_numero: p.numeracao.posicao
      },
      posicionamento_livre: false,
      elementos_recorrentes: []
    },
    {
      id: 'anexos',
      nome: 'Anexos / Documentos Complementares',
      tipo: 'anexos',
      modo_aplicacao: MODOS_APLICACAO_MESTRA.PROGRESSIVA,
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { t: 20, r: 20, b: 20, l: 20 },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: {
        ativo: true,
        texto: 'ANEXOS',
        logo: '',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '',
        numeracao: true,
        posicao_numero: p.numeracao.posicao
      },
      posicionamento_livre: false,
      elementos_recorrentes: []
    }
  ];
}

/**
 * Cria uma nova seção de documento com blocos e mestra vinculada
 */
export function criarSecao(nome, mestraId, blocos = [], id = null) {
  return {
    id: id || gerarId('sec'),
    nome: nome || 'Nova Seção',
    mestraId: mestraId || 'corpo',
    blocos: Array.isArray(blocos) ? blocos : []
  };
}

/**
 * Copia para o bloco o estilo de texto (id + alinhamento) do título e da fonte de tabela/quadro.
 * Só aceita ids simples e alinhamentos conhecidos (dados podem vir de JSON externo).
 */
function copiarTipografiaBloco(b, dados) {
  for (const papel of ['titulo', 'fonte', 'numeracao', 'dados']) {
    const id = dados[`${papel}_estilo_id`];
    if (typeof id === 'string' && /^[\w-]{1,64}$/.test(id)) b[`${papel}_estilo_id`] = id;
    const al = dados[`${papel}_alinhamento`];
    if (['estilo', 'left', 'center', 'right', 'justify'].includes(al)) b[`${papel}_alinhamento`] = al;
  }
}

/**
 * Cria um novo bloco de conteúdo para o documento
 */
export function criarNovoBloco(tipo, dados = {}) {
  const b = {
    id: dados.id || gerarId('bloco'),
    tipo: tipo || 'paragrafo',
    col: dados.col || 1,
    span: dados.span || 12,
    linha_grade: dados.linha_grade || null,
    estiloId: dados.estiloId || (tipo === 'titulo' ? 'titulo1' : tipo === 'subtitulo' ? 'subtitulo' : 'corpo'),
    alinhamento: dados.alinhamento || 'esquerda',
    manterComProximo: dados.manterComProximo !== undefined ? dados.manterComProximo : (tipo === 'titulo' || tipo === 'subtitulo'),
    quebra_antes: !!dados.quebra_antes,
    ...(dados.fonte ? { fonte: dados.fonte } : {}),
    ...(dados.cor ? { cor: dados.cor } : {}),
    ...(dados.fundo_ativo ? { fundo_ativo: dados.fundo_ativo, fundo_cor: dados.fundo_cor } : {}),
    ...(dados.borda_tipo ? { borda_tipo: dados.borda_tipo } : {}),
    ...(dados.marcador_tipo ? { marcador_tipo: dados.marcador_tipo } : {}),
    ...(dados.entrelinha ? { entrelinha: dados.entrelinha } : {}),
    ...(dados.espaco_antes_pt !== undefined ? { espaco_antes_pt: dados.espaco_antes_pt } : {}),
    ...(dados.espaco_depois_pt !== undefined ? { espaco_depois_pt: dados.espaco_depois_pt } : {}),
    ...(dados.recuo_primeira_linha_mm !== undefined ? { recuo_primeira_linha_mm: dados.recuo_primeira_linha_mm } : {}),
    ...(dados.recuo_esquerdo_mm !== undefined ? { recuo_esquerdo_mm: dados.recuo_esquerdo_mm } : {}),
    ...(dados.recuo_direito_mm !== undefined ? { recuo_direito_mm: dados.recuo_direito_mm } : {}),
    ...(dados.espacamento_letras_em !== undefined ? { espacamento_letras_em: dados.espacamento_letras_em } : {}),
    ...(dados.espacamento_palavras_em !== undefined ? { espacamento_palavras_em: dados.espacamento_palavras_em } : {}),
    ...(dados.grade_2d ? { grade_2d: dados.grade_2d } : {})
  };

  switch (tipo) {
    case 'titulo':
      b.nivel = dados.nivel || 1;
      b.texto = dados.texto || 'Título da Seção';
      break;

    case 'subtitulo':
      b.nivel = dados.nivel || 2;
      b.texto = dados.texto || 'Subtítulo da Seção';
      break;

    case 'paragrafo':
      b.texto = dados.texto || 'Digite o texto aqui...';
      break;

    case 'lista':
      b.ordenada = !!dados.ordenada;
      b.itens = dados.itens || ['Primeiro item', 'Segundo item', 'Terceiro item'];
      break;

    case 'citacao':
      b.texto = dados.texto || 'Texto da citação direta com mais de três linhas...';
      b.autor = dados.autor || 'SOBRENOME, P.';
      b.ano = dados.ano || new Date().getFullYear().toString();
      b.pagina_citada = dados.pagina_citada || '';
      if (dados.ref_texto) { b.ref_texto = dados.ref_texto; b.ref_id = dados.ref_id || ''; b.ref_linkar = !!dados.ref_linkar; } // referência no estilo escolhido (ver athenes_citacao.js)
      b.estiloId = 'citacao_direta';
      break;

    case 'figura':
      b.tipo = 'figura';
      b.subtipo = ROTULOS_FIGURA[dados.subtipo] ? dados.subtipo : 'figura';
      b.titulo = dados.titulo || `${ROTULOS_FIGURA[b.subtipo]} 1 — Descrição detalhada da ilustração`;
      b.layout = dados.layout || '1'; // '1', '2_lado', '2_empilhado', '3_linha', '3_misto', '4_grade', '6_grade'
      b.itens = Array.isArray(dados.itens) ? dados.itens : [
        { id: gerarId('fig_item'), url: dados.src || dados.url || '', legenda_sub: 'Visão geral' }
      ];
      b.legenda_geral = dados.legenda_geral || dados.legenda || 'Legenda explicativa dos elementos representados.';
      b.fonte = dados.fonte || 'Fonte: Autores (2026).';
      b.numero_sequencial = dados.numero_sequencial || 1;
      b.largura_pct = dados.largura_pct || 90;
      b.moldura_tipo = dados.moldura_tipo || 'limpo';
      b.linha_estilo = dados.linha_estilo || 'solida';
      b.linha_cor = dados.linha_cor || '#314F79';
      b.linha_largura_pt = dados.linha_largura_pt !== undefined ? dados.linha_largura_pt : 1.5;
      b.posicao_titulo = dados.posicao_titulo || 'topo';
      b.subgrade_colunas = dados.subgrade_colunas || 1;
      b.padding_pt = dados.padding_pt !== undefined ? dados.padding_pt : 4;
      // diagramação do subgrid (gap, rótulos, moldura da imagem, sombra, enquadramento, largura, fluxo...)
      for (const k of CHAVES_ESTILO_FIGURA) {
        if (dados[k] !== undefined && k !== 'layout' && k !== 'largura_pct') b[k] = dados[k];
      }
      if (dados.largura_pct !== undefined) b.largura_pct = dados.largura_pct;
      break;

    case 'mapa':
      b.tipo = 'mapa';
      b.titulo = dados.titulo || 'Mapa 1 — Delimitação territorial e contexto urbano';
      b.arquivo_url = dados.arquivo_url || dados.src || dados.url || '';
      b.tipo_arquivo = dados.tipo_arquivo || 'imagem'; // 'imagem' | 'pdf'
      b.escala = dados.escala || '1:10.000';
      b.orientacao_norte = dados.orientacao_norte !== undefined ? dados.orientacao_norte : true;
      b.legenda_cartografica = dados.legenda_cartografica || 'Convenções cartográficas: malha viária, quadras e lotes regularizados.';
      b.fonte = dados.fonte || 'Fonte: Glaux GIS / Base Cartográfica Oficial (SIRGAS 2000).';
      b.numero_sequencial = dados.numero_sequencial || 1;
      b.largura_pct = dados.largura_pct || 100;
      break;

    case 'tabela':
      b.titulo = dados.titulo || 'Tabela 1 — Descrição dos dados quantitativos apresentados';
      b.fonte = dados.fonte || 'Fonte: Elaborada pelos autores com base em dados de campo (2026).';
      b.notas = dados.notas || '';
      b.colunas = dados.colunas || ['Parâmetro', 'Grupo de Controle', 'Grupo Experimental'];
      b.linhas = dados.linhas || [
        ['Amostra A', '14,2', '28,9'],
        ['Amostra B', '10,5', '32,1']
      ];
      b.larguras_relativas = dados.larguras_relativas || [0.4, 0.3, 0.3];
      b.com_cabecalho = dados.com_cabecalho !== undefined ? dados.com_cabecalho : true;
      b.bordas_abertas = true; // Estilo ABNT/IBGE (laterais verticais abertas)
      if (dados.estilo_tabela) b.estilo_tabela = JSON.parse(JSON.stringify(dados.estilo_tabela)); // bordas/zebra/alinhamento das células
      copiarTipografiaBloco(b, dados);
      b.numero_sequencial = dados.numero_sequencial || 1;
      b.moldura_tipo = dados.moldura_tipo || 'limpo';
      b.linha_estilo = dados.linha_estilo || 'solida';
      b.linha_cor = dados.linha_cor || '#314F79';
      b.linha_largura_pt = dados.linha_largura_pt !== undefined ? dados.linha_largura_pt : 1.0;
      b.posicao_titulo = dados.posicao_titulo || 'topo';
      b.padding_pt = dados.padding_pt !== undefined ? dados.padding_pt : 4;
      break;

    case 'quadro':
      b.tipo = 'quadro';
      b.titulo = dados.titulo || 'Quadro 1 — Categorias conceituais e tipologia descritiva';
      b.fonte = dados.fonte || 'Fonte: Elaborado pelos autores a partir do referencial teórico.';
      b.notas = dados.notas || '';
      b.colunas = dados.colunas || ['Categoria', 'Definição Operacional', 'Aplicação Prática'];
      b.linhas = dados.linhas || [
        ['Dimensão Espacial', 'Morfologia urbana e malha viária existente', 'Planejamento e cadastro'],
        ['Dimensão Jurídica', 'Regularização fundiária e titulação individual', 'Segurança na posse']
      ];
      b.larguras_relativas = dados.larguras_relativas || [0.3, 0.4, 0.3];
      b.com_cabecalho = dados.com_cabecalho !== undefined ? dados.com_cabecalho : true;
      b.bordas_fechadas = true; // Estilo Quadro ABNT (caixa com todas as bordas fechadas)
      if (dados.estilo_tabela) b.estilo_tabela = JSON.parse(JSON.stringify(dados.estilo_tabela));
      copiarTipografiaBloco(b, dados);
      b.numero_sequencial = dados.numero_sequencial || 1;
      b.moldura_tipo = dados.moldura_tipo || 'caixa_borda';
      b.linha_estilo = dados.linha_estilo || 'solida';
      b.linha_cor = dados.linha_cor || '#CBD5E1';
      b.linha_largura_pt = dados.linha_largura_pt !== undefined ? dados.linha_largura_pt : 1.0;
      b.posicao_titulo = dados.posicao_titulo || 'topo';
      b.padding_pt = dados.padding_pt !== undefined ? dados.padding_pt : 6;
      break;

    case 'imagem':
      b.src = dados.src || '';
      b.legenda = dados.legenda || 'Figura 1 — Legenda descritiva da imagem';
      b.fonte = dados.fonte || 'Fonte: Arquivo da pesquisa.';
      b.largura_pct = dados.largura_pct || 80;
      b.altura_mm = dados.altura_mm || 60;
      b.numero_sequencial = dados.numero_sequencial || 1;
      b.moldura_tipo = dados.moldura_tipo || 'limpo';
      break;

    case 'nota':
      b.numero = dados.numero || 1;
      b.texto = dados.texto || 'Texto explicativo da nota de rodapé.';
      break;

    case 'formula':
      b.latex = dados.latex || dados.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx';
      b.formula = b.latex;
      b.numero_equacao = '(1)'; // sempre recalculado pela numeração automática
      b.numero = b.numero_equacao;
      if (dados.formato_numero) b.formato_numero = dados.formato_numero;
      if (dados.formula_sintaxe === 'matlab') { b.formula_sintaxe = 'matlab'; b.formula_matlab = dados.formula_matlab || ''; }
      b.alinhamento = dados.alinhamento || 'centro';
      b.moldura_tipo = dados.moldura_tipo || 'limpo'; // 'limpo' (sem caixa/fundo), 'linha_esquerda', 'linhas_topo_base', 'cartao_suave', 'caixa_borda', 'personalizado'
      b.linha_estilo = dados.linha_estilo || 'solida';
      b.linha_cor = dados.linha_cor || '#314F79';
      b.linha_largura_pt = dados.linha_largura_pt !== undefined ? dados.linha_largura_pt : 1.5;
      b.posicao_numero = dados.posicao_numero || 'direita'; // 'direita' | 'esquerda' | 'abaixo' | 'oculto'
      b.legenda_formula = dados.legenda_formula || '';
      b.mostrar_legenda = dados.mostrar_legenda !== undefined ? dados.mostrar_legenda : false;
      b.fonte_formula = dados.fonte_formula || '';
      b.mostrar_fonte = dados.mostrar_fonte !== undefined ? dados.mostrar_fonte : false;
      b.padding_pt = dados.padding_pt !== undefined ? dados.padding_pt : 4;
      break;

    case 'campos':
      b.tipo = 'campos';
      b.rotulo = dados.rotulo || 'Identificação e Parâmetros';
      b.colunas = dados.colunas || 2;
      b.itens = dados.itens || [
        { rotulo: 'Titular', valor: 'Maria da Silva' },
        { rotulo: 'Área do Lote', valor: '250,00 m²' },
        { rotulo: 'Quadra', valor: '04' },
        { rotulo: 'Lote', valor: '12' }
      ];
      break;

    case 'divisor':
      b.tipo = 'divisor';
      b.estilo_linha = dados.estilo_linha || 'solida';
      break;

    case 'espaco':
      b.tipo = 'espaco';
      b.altura_pt = dados.altura_pt || 24;
      break;

    case 'anexo':
      b.titulo = dados.titulo || 'Anexo A — Documento Digitalizado';
      b.nome_arquivo = dados.nome_arquivo || 'documento.pdf';
      b.tamanho_kb = dados.tamanho_kb || 256;
      b.url = dados.url || '';
      break;

    case 'sumario':
      b.geradoAutomaticamente = true;
      break;

    case 'referencias':
      b.geradoAutomaticamente = true;
      break;

    case 'quebra_pagina':
      b.tipo = 'quebra_pagina';
      break;

    default:
      Object.assign(b, dados);
      break;
  }

  return b;
}

/**
 * Estima a altura de um bloco em pontos tipográficos (pt)
 * 1 mm ≈ 2.83465 pt
 */
const TIPOS_DE_TEXTO = ['paragrafo', 'titulo', 'subtitulo', 'citacao'];

/** Espaço antes/depois (pt) de um bloco de texto: o do bloco, senão o do estilo. null para os demais tipos. */
export function margensTextoPt(bloco, estilos) {
  if (!bloco || !TIPOS_DE_TEXTO.includes(bloco.tipo)) return null;
  const est = estilos[bloco.estiloId] || (bloco.tipo === 'titulo' ? estilos[`titulo${Math.min(6, bloco.nivel || 1)}`] : null) || estilos.corpo || {};
  return { antes: bloco.espaco_antes_pt ?? est.espaco_antes_pt ?? 0, depois: bloco.espaco_depois_pt ?? est.espaco_depois_pt ?? 0 };
}

/**
 * Colapso de margens verticais, como no Word e no CSS: entre dois parágrafos seguidos o espaço entre eles é
 * o MAIOR entre "depois" do primeiro e "antes" do segundo, e não a soma. Retorna o quanto subtrair (pt).
 */
export function colapsoEntreBlocosPt(anterior, atual, estilos) {
  if (!anterior || !atual || anterior.grupo || atual.grupo) return 0;
  const a = margensTextoPt(anterior, estilos); const b = margensTextoPt(atual, estilos);
  return a && b ? Math.min(a.depois, b.antes) : 0;
}

let TITULOS_NO_DOC = 8;

/**
 * Altura de um bloco de TEXTO conforme o estilo (tamanho, entrelinha, espaços) e a largura útil da coluna.
 * Antes, todo parágrafo valia "80 caracteres por linha a 18 pt", o que empurrava para a página seguinte
 * texto que cabia (um modelo de 11 pt com entrelinha simples ocupava quase o dobro do real).
 */
function alturaTextoPorEstilo(bloco, ctx) {
  const P = parametrosTextoPt(bloco, ctx);
  if (!P) return null;
  return linhasEstimadas(bloco.texto, P.porLinha) * P.tam * P.ent + P.antes + P.depois + lacunasInternasPt(bloco.texto, P.gapParagrafo);
}

export function estimarAlturaBlocoPt(bloco, ctx = null) {
  if (!bloco) return 20;
  if (ctx?.larguraPt && (bloco.tipo === 'tabela' || bloco.tipo === 'quadro')) return alturaTabelaPt(bloco, ctx.larguraPt);
  if (ctx?.estilos && (bloco.tipo === 'paragrafo' || bloco.tipo === 'titulo' || bloco.tipo === 'citacao')) {
    const h = alturaTextoPorEstilo(bloco, ctx);
    if (h !== null) return h;
  }

  switch (bloco.tipo) {
    case 'titulo':
      return bloco.nivel === 1 ? 48 : 36;

    case 'subtitulo':
      return 32;

    case 'paragrafo': {
      const texto = (bloco.texto || '').replace(/<[^>]+>/g, '');
      const numLinhas = Math.max(1, Math.ceil(texto.length / 80));
      // 12pt com entrelinhas 1.5 dá 18pt por linha + 10pt de margem depois
      return numLinhas * 18 + 10;
    }

    case 'lista': {
      const itens = Array.isArray(bloco.itens) ? bloco.itens : [];
      return Math.max(1, itens.length) * 20 + 8;
    }

    case 'citacao': {
      const texto = (bloco.texto || '').replace(/<[^>]+>/g, '');
      const numLinhas = Math.max(1, Math.ceil(texto.length / 70));
      return numLinhas * 14 + 24;
    }

    case 'tabela': {
      const numLinhas = (bloco.linhas?.length || 2) + (bloco.com_cabecalho ? 1 : 0);
      return 28 + numLinhas * 24 + 22; // título + linhas + fonte/notas
    }

    case 'quadro': {
      const numLinhas = (bloco.linhas?.length || 2) + (bloco.com_cabecalho ? 1 : 0);
      return 28 + numLinhas * 26 + 22; // título + linhas + fonte/notas
    }

    case 'figura': {
      const layout = bloco.layout || '1';
      let mult = 1;
      if (layout === '2_empilhado' || layout === '6_grade') mult = 1.6;
      else if (layout === '4_grade') mult = 1.4;
      else if (obterLayoutFigura(layout).rows.length > 2) mult = 2.1; // 3×2 e demais com 3 linhas
      else if (layout === '3_panoramica') mult = 1.4;
      return 180 * mult + 36; // imagem/grid + título, legenda geral e fonte
    }

    case 'mapa': {
      return 240; // mapa + título, escala, legenda cartográfica e fonte
    }

    case 'imagem': {
      const altMm = bloco.altura_mm || 65;
      return altMm * 2.83465 + 32; // imagem + legenda e fonte
    }

    case 'campos': {
      const nItens = Array.isArray(bloco.itens) ? bloco.itens.length : 2;
      const nLinhas = Math.ceil(nItens / (bloco.colunas || 2));
      return 28 + nLinhas * 28 + 10;
    }

    case 'divisor':
      return 14;

    case 'espaco':
      return bloco.altura_pt || 24;

    case 'formula':
      return 46;

    case 'nota':
      return 28;

    case 'sumario':
      return Math.min(640, 70 + TITULOS_NO_DOC * 20); // cresce com o número de títulos (definido a cada repaginação)

    case 'referencias':
      return 180;

    case 'quebra_pagina':
      return 9999; // Força nova página

    default:
      return 30;
  }
}

/**
 * Motor de Repaginação Automática com Fluxo Contínuo
 * Distribui os blocos de cada seção nas páginas físicas necessárias
 */
export function repaginarDocumento(doc) {
  if (!doc) return [];
  garantirEstilosDeTitulos(doc);
  TITULOS_NO_DOC = (doc.secoes || []).reduce((t, sec) => t + (sec.blocos || []).filter(b => b.tipo === 'titulo').length, 0);

  // Garante coleções mínimas
  if (!Array.isArray(doc.mestras) || doc.mestras.length === 0) {
    doc.mestras = doc.modelosPagina || criarModelosPaginaPadrao(doc.perfil || 'abnt');
  }
  doc.modelosPagina = doc.mestras;

  if (!Array.isArray(doc.secoes) || doc.secoes.length === 0) {
    // Migra de paginas antigas para seções caso necessário
    if (Array.isArray(doc.paginas) && doc.paginas.length > 0) {
      doc.secoes = doc.paginas.map((p, idx) => ({
        id: gerarId('sec'),
        nome: `Seção ${idx + 1} (${p.modeloId || 'corpo'})`,
        mestraId: p.modeloId || 'corpo',
        blocos: p.blocos || []
      }));
    } else {
      doc.secoes = [
        criarSecao('Capa', 'capa'),
        criarSecao('Corpo do Texto', 'corpo'),
        criarSecao('Referências', 'referencias')
      ];
    }
  }

  const paginasCalculadas = [];
  let contadorPaginaGlobal = 1;

  // Notas de rodapé: o espaço delas é reservado ANTES de decidir onde o texto principal quebra
  const cfgNotas = obterConfigNotas(doc);
  const registroNotas = new Map((doc.notasRodape || []).map(n => [n.id, n]));
  const segmentoDe = (id) => ({ id, html: registroNotas.get(id)?.html || '' });
  const idsDaLinha = (blocos, inicio) => {
    const primeiro = blocos[inicio];
    const ids = [...idsNotasDoBloco(primeiro)];
    if (primeiro.grupo) {
      for (let i = inicio + 1; i < blocos.length && blocos[i].grupo === primeiro.grupo; i++) ids.push(...idsNotasDoBloco(blocos[i]));
    }
    return ids.filter(id => registroNotas.has(id));
  };

  for (let sIdx = 0; sIdx < doc.secoes.length; sIdx++) {
    const sec = doc.secoes[sIdx];
    const mestra = doc.mestras.find(m => m.id === sec.mestraId) || doc.mestras[0];
    const blocosDaSecao = Array.isArray(sec.blocos) ? sec.blocos : [];

    // Corpo útil: cabeçalho/rodapé ficam na margem; se não couberem, a margem cresce (nunca sobrepõem o texto)
    const paisagem = mestra.orientacao === 'paisagem';
    const geo = geometriaCorpoMm(mestra);
    const alturaUtilPt = geo.alturaCorpoMm * PT_POR_MM;
    const larguraPt = ((paisagem ? 297 : 210) - geo.margemEsq - geo.margemDir) * PT_POR_MM;
    const estilosPorId = Object.fromEntries((doc.estilos || []).map(e => [e.id, e]));

    let blocosPag = [];
    let alturaAcumuladaPt = 0;
    let notasPag = [];           // segmentos de nota da página em montagem (inclui continuações da anterior)
    let numNaSecao = 1;

    const alturaNotasPag = () => (notasPag.length
      ? alturaSeparadorPt(cfgNotas) + notasPag.reduce((t, x) => t + alturaSegmentoPt(x.html, cfgNotas, larguraPt), 0)
      : 0);

    const fecharPagina = (fixa = false) => {
      let visiveis = notasPag;
      let resto = [];
      if (!fixa) ({ visiveis, resto } = ajustarNotasAoEspaco(notasPag, alturaUtilPt - alturaAcumuladaPt, cfgNotas, larguraPt));
      const numero = numNaSecao++;
      paginasCalculadas.push({
        id: gerarId('pg'),
        secaoId: sec.id,
        mestraId: mestra.id,
        modeloId: mestra.id,
        numero: contadorPaginaGlobal++,
        numeroNaSecao: numero,
        origemFluxo: fixa ? 'fixa' : (numero === 1 ? 'progressiva_raiz' : 'fluxo_automatico'),
        blocos: blocosPag,
        notas: visiveis
      });
      blocosPag = [];
      alturaAcumuladaPt = 0;
      notasPag = resto; // o que não coube continua no topo da página seguinte
    };

    const eFixa = mestra.modo_aplicacao === MODOS_APLICACAO_MESTRA.FIXA;
    // fila de trabalho: um parágrafo/tabela que não cabe vira fragmento e o restante volta para a fila
    const fila = [...blocosDaSecao];
    const ctxAltura = { estilos: estilosPorId, larguraPt };

    for (let bIdx = 0; bIdx < fila.length; bIdx++) {
      const b = fila[bIdx];

      if (b.tipo === 'quebra_pagina') {
        if (blocosPag.length > 0 || (!eFixa && notasPag.length > 0)) fecharPagina(eFixa);
        continue;
      }

      if (eFixa) {
        // PÁGINA FIXA: 1 página (ou as quebras explícitas); as notas dos blocos acompanham a página
        blocosPag.push(b);
        notasPag.push(...idsNotasDoBloco(b).filter(id => registroNotas.has(id)).map(segmentoDe));
        continue;
      }

      // PÁGINA PROGRESSIVA: flui blocos automaticamente
      // Blocos da mesma linha (grupo) ficam juntos: só o primeiro decide a quebra
      const anterior = bIdx > 0 ? fila[bIdx - 1] : null;
      if (b.grupo && anterior && anterior.grupo === b.grupo && blocosPag[blocosPag.length - 1] === anterior) {
        blocosPag.push(b);
        continue;
      }
      const altPt = alturaDaLinha(fila, bIdx, ctxAltura);
      const novas = idsDaLinha(fila, bIdx).filter(id => !notasPag.some(x => x.id === id)).map(segmentoDe);
      const alturaNovasPt = novas.reduce((t, x) => t + alturaSegmentoPt(x.html, cfgNotas, larguraPt), 0)
        + (notasPag.length === 0 && novas.length ? alturaSeparadorPt(cfgNotas) : 0);
      // espaço antes é ignorado no topo da página (como no Word); entre parágrafos vale o maior dos dois espaços
      const antesTopo = margensTextoPt(b, estilosPorId)?.antes || 0;
      const altEf = altPt - (blocosPag.length ? colapsoEntreBlocosPt(blocosPag[blocosPag.length - 1], b, estilosPorId) : antesTopo);
      const totalPt = alturaAcumuladaPt + altEf + alturaNotasPag() + alturaNovasPt;

      // não cabe: divide o parágrafo/tabela entre esta página e a seguinte (cabeçalho da tabela se repete)
      if (totalPt > alturaUtilPt && podeDividir(b)) {
        const livrePt = alturaUtilPt - alturaAcumuladaPt - alturaNotasPag();
        const dv = dividirParaPagina(b, livrePt, ctxAltura, blocosPag.length === 0);
        if (dv) {
          const novasPrimeiro = idsNotasDoBloco(dv.primeiro).filter(id => registroNotas.has(id) && !notasPag.some(x => x.id === id)).map(segmentoDe);
          const alturaPrimeiro = estimarAlturaBlocoPt(dv.primeiro, ctxAltura)
            - (blocosPag.length ? colapsoEntreBlocosPt(blocosPag[blocosPag.length - 1], dv.primeiro, estilosPorId) : antesTopo);
          blocosPag.push(dv.primeiro);
          alturaAcumuladaPt += alturaPrimeiro;
          notasPag.push(...novasPrimeiro);
          fecharPagina();
          fila.splice(bIdx + 1, 0, dv.resto);
          continue;
        }
      }

      // manterComProximo: título não fica no fim da folha sem espaço para o próximo bloco
      const exigeNovaPagina = blocosPag.length > 0
        && ((b.manterComProximo && totalPt + 60 > alturaUtilPt) || totalPt > alturaUtilPt);

      if (exigeNovaPagina) {
        if (podeDividir(b) && altPt > alturaUtilPt) { // maior que uma página inteira: fecha esta e divide na página nova
          fecharPagina();
          bIdx--;
          continue;
        }
        fecharPagina();
        blocosPag = [b];
        alturaAcumuladaPt = altPt - antesTopo;
        notasPag = [...notasPag, ...novas];
      } else {
        blocosPag.push(b);
        alturaAcumuladaPt += altEf;
        notasPag.push(...novas);
      }
    }

    // Última página da seção e, se sobrou continuação de nota, páginas adicionais só com as notas
    fecharPagina(eFixa);
    let guarda = 0;
    while (notasPag.length && guarda++ < 50) fecharPagina();
  }

  vincularOverridesAsPaginas(doc, paginasCalculadas);
  aplicarRegrasMestraNasPaginas(doc, paginasCalculadas); // "Mestre B nas páginas 4 em diante"
  rotularNotas(doc, paginasCalculadas);
  doc.paginas = paginasCalculadas;
  const exibidos = calcularNumerosExibidos(doc);
  paginasCalculadas.forEach((pg, i) => { pg.numeroExibido = exibidos[i]; });
  return paginasCalculadas;
}

/**
 * Cria um novo documento Athenes completo e estruturado com seções e mestras
 */
export function criarDocumento(opcoes = {}) {
  const perfilId = opcoes.perfilId || 'abnt';
  const tipoDoc = opcoes.tipoDoc || 'artigo';
  const mestras = criarModelosPaginaPadrao(perfilId);
  const estilos = criarEstilosPadrao(perfilId);

  const doc = {
    schema_versao: 2,
    id: opcoes.id || gerarId('doc'),
    titulo: opcoes.titulo || 'Novo Artigo Científico',
    subtitulo: opcoes.subtitulo || '',
    tipoDoc,
    estado: 'rascunho',
    dataCriacao: new Date().toISOString(),
    dataModificacao: new Date().toISOString(),

    metadados: {
      autores: opcoes.autores || [
        { nome: 'Autor Principal', email: '', afiliacao: 'Universidade / Instituição', orcid: '' }
      ],
      resumo: '',
      abstract: '',
      palavrasChave: ['Palavra-chave 1', 'Palavra-chave 2', 'Palavra-chave 3'],
      keywords: ['Keyword 1', 'Keyword 2', 'Keyword 3'],
      instituicao: 'Universidade / Centro de Pesquisa',
      cidade: 'Cidade',
      ano: new Date().getFullYear().toString()
    },

    perfil: perfilId,
    mestras,
    modelosPagina: mestras, // retrocompatibilidade
    modelos_blocos: opcoes.modelos_blocos || [],
    estilos,
    referencias: [],
    notasLeitura: [],
    guias: [],

    secoes: [],
    paginas: []
  };

  // Seções canônicas iniciais
  if (Array.isArray(opcoes.secoes) && opcoes.secoes.length > 0) {
    doc.secoes = opcoes.secoes;
  } else {
    // 1. Seção Capa (Fixa)
    doc.secoes.push(criarSecao('Capa Inicial', 'capa', [
      criarNovoBloco('titulo', { nivel: 1, texto: doc.titulo, alinhamento: 'centro' }),
      criarNovoBloco('subtitulo', { texto: doc.subtitulo || 'Subtítulo ou delimitação temática da pesquisa', alinhamento: 'centro' }),
      criarNovoBloco('paragrafo', {
        texto: `${doc.metadados.autores.map(a => a.nome).join(', ')}<br><small>${doc.metadados.instituicao}</small>`,
        alinhamento: 'centro'
      })
    ]));

    // 2. Seção Corpo do Texto (Progressiva)
    doc.secoes.push(criarSecao('Corpo do Texto', 'corpo', [
      criarNovoBloco('titulo', { nivel: 1, texto: '1. INTRODUÇÃO' }),
      criarNovoBloco('paragrafo', {
        texto: 'Escreva diretamente neste bloco. Este ambiente permite diagramar artigos científicos, relatórios técnicos e monografias com rigor editorial e facilidade de escrita em blocos.'
      }),
      criarNovoBloco('citacao', {
        texto: 'A escrita científica exige precisão conceitual, clareza metodológica e fundamentação bibliográfica sólida e atualizada.',
        autor: 'SILVA, J.',
        ano: '2024',
        pagina_citada: '45'
      }),
      criarNovoBloco('titulo', { nivel: 1, texto: '2. METODOLOGIA E RESULTADOS' }),
      criarNovoBloco('paragrafo', {
        texto: 'Os dados foram coletados e analisados seguindo os procedimentos descritos a seguir. A Tabela 1 apresenta a síntese das observações.'
      }),
      criarNovoBloco('tabela', {
        titulo: 'Tabela 1 — Parâmetros de análise e distribuição amostral',
        fonte: 'Fonte: Elaborada pelos autores (2026).',
        colunas: ['Parâmetro', 'Grupo de Controle', 'Grupo Experimental', 'Significância (p)'],
        linhas: [
          ['Tempo de Execução (min)', '45,2 ± 3,1', '28,4 ± 2,0', '< 0,01'],
          ['Taxa de Eficiência (%)', '78,4%', '94,2%', '< 0,001'],
          ['Aderência Normativa', 'Conforme', 'Excelente', '0,04']
        ],
        larguras_relativas: [0.35, 0.22, 0.23, 0.20],
        com_cabecalho: true
      })
    ]));

    // 3. Seção Referências (Progressiva)
    doc.secoes.push(criarSecao('Referências', 'referencias', [
      criarNovoBloco('titulo', { nivel: 1, texto: 'REFERÊNCIAS' }),
      criarNovoBloco('referencias', {})
    ]));
  }

  // Executa o motor de repaginação automática
  repaginarDocumento(doc);

  return doc;
}

/**
 * Retorna a mestra correspondente a uma página
 */
export function modeloDaPagina(doc, pagina) {
  if (!doc || !pagina) return null;
  const mestraId = pagina.mestraId || pagina.modeloId;
  const lista = doc.mestras || doc.modelosPagina || [];
  return lista.find(m => m.id === mestraId) || lista[0] || null;
}

export const obterMestraDaPagina = modeloDaPagina;

/**
 * Adiciona uma nova seção ao documento
 */
export function adicionarSecao(doc, nome, mestraId, posicao = null, blocosIniciais = []) {
  const sec = criarSecao(nome, mestraId, blocosIniciais);
  if (typeof posicao === 'number' && posicao >= 0 && posicao < doc.secoes.length) {
    doc.secoes.splice(posicao, 0, sec);
  } else {
    doc.secoes.push(sec);
  }
  repaginarDocumento(doc);
  return sec;
}

/**
 * Remove uma seção do documento (mantendo pelo menos 1 seção)
 */
export function removerSecao(doc, secaoId) {
  if (!doc || doc.secoes.length <= 1) return false;
  const idx = doc.secoes.findIndex(s => s.id === secaoId);
  if (idx < 0) return false;
  doc.secoes.splice(idx, 1);
  repaginarDocumento(doc);
  return true;
}

/**
 * Move a ordem de uma seção no documento
 */
export function moverSecao(doc, secaoId, direcao) {
  if (!doc) return false;
  const idx = doc.secoes.findIndex(s => s.id === secaoId);
  if (idx < 0) return false;
  const novoIdx = idx + direcao;
  if (novoIdx < 0 || novoIdx >= doc.secoes.length) return false;

  const [sec] = doc.secoes.splice(idx, 1);
  doc.secoes.splice(novoIdx, 0, sec);
  repaginarDocumento(doc);
  return true;
}

/**
 * Altera a mestra de uma seção
 */
export function trocarMestraDaSecao(doc, secaoId, novaMestraId) {
  if (!doc) return false;
  const sec = doc.secoes.find(s => s.id === secaoId);
  if (!sec) return false;
  sec.mestraId = novaMestraId;
  repaginarDocumento(doc);
  return true;
}

/**
 * Cria ou duplica uma mestra no catálogo de mestras
 */
export function duplicarMestra(doc, mestraId, novoNome = null) {
  if (!doc) return null;
  const base = (doc.mestras || []).find(m => m.id === mestraId);
  if (!base) return null;

  const nova = JSON.parse(JSON.stringify(base));
  nova.id = gerarId('mestra');
  nova.nome = novoNome || `${base.nome} (Cópia)`;
  doc.mestras.push(nova);
  doc.modelosPagina = doc.mestras;
  return nova;
}

/**
 * Remove uma página mestra do catálogo do documento
 * @param {Object} doc - Documento Athenes
 * @param {string} mestraId - ID da página mestra a remover
 * @returns {boolean} True se removida com sucesso, false caso contrário
 */
export function removerMestra(doc, mestraId) {
  if (!doc || !Array.isArray(doc.mestras) || doc.mestras.length <= 1) return false;
  const idx = doc.mestras.findIndex(m => m.id === mestraId);
  if (idx < 0) return false;

  doc.mestras.splice(idx, 1);
  doc.modelosPagina = doc.mestras;

  // Se alguma seção usava esta mestra, migra para a primeira mestra restante
  const mestraSubstituta = doc.mestras[0].id;
  (doc.secoes || []).forEach(sec => {
    if (sec.mestraId === mestraId) {
      sec.mestraId = mestraSubstituta;
    }
  });

  repaginarDocumento(doc);
  return true;
}

/**
 * Adiciona um bloco na seção ativa
 */
export function adicionarBlocoNaSecao(doc, secaoId, bloco, posicao = null) {
  if (!doc) return null;
  const sec = doc.secoes.find(s => s.id === secaoId) || doc.secoes[0];
  if (!sec) return null;

  if (typeof posicao === 'number' && posicao >= 0 && posicao <= sec.blocos.length) {
    sec.blocos.splice(posicao, 0, bloco);
  } else {
    sec.blocos.push(bloco);
  }

  repaginarDocumento(doc);
  return bloco;
}

/**
 * Remove um bloco de uma seção
 */
export function removerBlocoDaSecao(doc, secaoId, blocoId) {
  if (!doc) return false;
  const sec = doc.secoes.find(s => s.id === secaoId);
  if (!sec) return false;

  const idx = sec.blocos.findIndex(b => b.id === blocoId);
  if (idx < 0) return false;
  const removido = sec.blocos.splice(idx, 1)[0];
  reequilibrarGrupo(sec, removido?.grupo);
  normalizarGrupos(sec);
  repaginarDocumento(doc);
  return true;
}

// Retrocompatibilidade para adicionarBlocoNaPagina
export function adicionarBlocoNaPagina(doc, paginaId, bloco, posicao = null) {
  const pag = (doc.paginas || []).find(p => p.id === paginaId);
  const secaoId = pag?.secaoId || doc.secoes?.[0]?.id;
  return adicionarBlocoNaSecao(doc, secaoId, bloco, posicao);
}

export function removerBlocoDaPagina(doc, paginaId, blocoId) {
  const pag = (doc.paginas || []).find(p => p.id === paginaId);
  const secaoId = pag?.secaoId || doc.secoes?.[0]?.id;
  return removerBlocoDaSecao(doc, secaoId, blocoId);
}

export function duplicarBloco(doc, paginaId, blocoId) {
  const pag = (doc.paginas || []).find(p => p.id === paginaId);
  const secaoId = pag?.secaoId || doc.secoes?.[0]?.id;
  const sec = doc.secoes.find(s => s.id === secaoId);
  if (!sec) return null;

  const idx = sec.blocos.findIndex(b => b.id === blocoId);
  if (idx < 0) return null;

  const clone = JSON.parse(JSON.stringify(sec.blocos[idx]));
  clone.id = gerarId('bloco');
  sec.blocos.splice(idx + 1, 0, clone);
  repaginarDocumento(doc);
  return clone;
}

export function moverBloco(doc, paginaId, blocoId, direcao) {
  const pag = (doc.paginas || []).find(p => p.id === paginaId);
  const secaoId = pag?.secaoId || doc.secoes?.[0]?.id;
  const sec = doc.secoes.find(s => s.id === secaoId);
  if (!sec) return false;

  const idx = sec.blocos.findIndex(b => b.id === blocoId);
  if (idx < 0) return false;
  const novoIdx = idx + direcao;
  if (novoIdx < 0 || novoIdx >= sec.blocos.length) return false;

  const [b] = sec.blocos.splice(idx, 1);
  sec.blocos.splice(novoIdx, 0, b);
  repaginarDocumento(doc);
  return true;
}

export function reordenarBlocosNaPagina(doc, paginaId, novaOrdemIds) {
  const pag = (doc.paginas || []).find(p => p.id === paginaId);
  const secaoId = pag?.secaoId || doc.secoes?.[0]?.id;
  const sec = doc.secoes.find(s => s.id === secaoId);
  if (!sec) return false;

  const map = new Map(sec.blocos.map(b => [b.id, b]));
  sec.blocos = novaOrdemIds.map(id => map.get(id)).filter(Boolean);
  repaginarDocumento(doc);
  return true;
}

/**
 * Gera o sumário dinâmico a partir dos títulos (`titulo`, qualquer nível) das páginas já calculadas.
 * Cada item: { id, texto, nivel, prefixo, pagina }. Veja `extrairItensSumario` para as regras.
 */
export function gerarSumarioDinamico(doc, opcoes = {}) {
  return extrairItensSumario(doc, opcoes);
}

/**
 * Calcula estatísticas gerais do documento
 */
export function calcularEstatisticas(doc) {
  if (!doc) {
    return { palavras: 0, caracteres: 0, paginas: 0, tabelas: 0, imagens: 0, citacoes: 0 };
  }

  let totalPalavras = 0;
  let totalCaracteres = 0;
  let totalTabelas = 0;
  let totalImagens = 0;
  let totalCitacoes = 0;

  const todasPaginas = Array.isArray(doc.paginas) ? doc.paginas : [];

  for (const pag of todasPaginas) {
    const blocos = Array.isArray(pag.blocos) ? pag.blocos : [];
    for (const b of blocos) {
      if (b.tipo === 'paragrafo' || b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'citacao') {
        const txt = (b.texto || '').replace(/<[^>]+>/g, ' ').trim();
        if (txt) {
          totalCaracteres += txt.length;
          const palavras = txt.split(/\s+/).filter(Boolean);
          totalPalavras += palavras.length;
        }
      }
      const continuacao = !!b._frag?.continuaDaAnterior; // fragmento de bloco dividido não conta de novo
      if (b.tipo === 'tabela' && !continuacao) totalTabelas++;
      if (b.tipo === 'imagem') totalImagens++;
      if (b.tipo === 'citacao' && !continuacao) totalCitacoes++;
    }
  }

  return {
    palavras: totalPalavras,
    caracteres: totalCaracteres,
    paginas: todasPaginas.length,
    tabelas: totalTabelas,
    imagens: totalImagens,
    citacoes: totalCitacoes
  };
}

export const calcularEstatisticasDocumento = calcularEstatisticas;

/**
 * Recalcula numeração automática e sequencial separada para Figuras, Mapas, Tabelas, Quadros e Equações.
 */
/** Separadores entre o número e o título da legenda ("Tabela 1 — Título"). */
export const SEPARADORES_LEGENDA = Object.freeze([
  { id: 'travessao', rotulo: 'Travessão', exemplo: 'Tabela 1 — Título', valor: ' — ' },
  { id: 'meio_traco', rotulo: 'Meio-traço', exemplo: 'Tabela 1 – Título', valor: ' – ' },
  { id: 'hifen', rotulo: 'Hífen', exemplo: 'Tabela 1 - Título', valor: ' - ' },
  { id: 'dois_pontos', rotulo: 'Dois-pontos', exemplo: 'Tabela 1: Título', valor: ': ' },
  { id: 'ponto', rotulo: 'Ponto', exemplo: 'Tabela 1. Título', valor: '. ' },
  { id: 'espaco', rotulo: 'Somente espaço', exemplo: 'Tabela 1 Título', valor: ' ' }
]);
export const SEPARADOR_LEGENDA_PADRAO = 'travessao';

/** Formato do número automático das fórmulas. Sempre calculado: não se digita o número. */
export const FORMATOS_NUMERO_FORMULA = Object.freeze([
  { id: 'parenteses', rotulo: 'Entre parênteses', exemplo: '(1)' },
  { id: 'capitulo', rotulo: 'Por capítulo', exemplo: '(2.1)' },
  { id: 'colchetes', rotulo: 'Entre colchetes', exemplo: '[1]' },
  { id: 'simples', rotulo: 'Só o número', exemplo: '1' },
  { id: 'eq', rotulo: 'Com "Eq."', exemplo: 'Eq. (1)' }
]);
export const FORMATO_NUMERO_FORMULA_PADRAO = 'parenteses';

/** Id do formato em vigor: o do bloco, senão o do documento, senão "(1)". */
export function idFormatoNumeroFormula(doc, bloco) {
  const ok = (id) => FORMATOS_NUMERO_FORMULA.some(x => x.id === id) ? id : null;
  return ok(bloco?.formato_numero) || ok(doc?.formato_numero_formula) || FORMATO_NUMERO_FORMULA_PADRAO;
}

/** Texto do número da fórmula `n` (e do capítulo `cap`, no formato por capítulo). */
export function formatarNumeroFormula(formato, n, cap = 0) {
  switch (formato) {
    case 'capitulo': return `(${cap || 0}.${n})`;
    case 'colchetes': return `[${n}]`;
    case 'simples': return String(n);
    case 'eq': return `Eq. (${n})`;
    default: return `(${n})`;
  }
}
const REG_SEP = '[-—–:]';

/** Id do separador em vigor: o do bloco, senão o do documento, senão o travessão. */
export function idSeparadorLegenda(doc, bloco) {
  const ok = (id) => SEPARADORES_LEGENDA.some(x => x.id === id) ? id : null;
  return ok(bloco?.separador_legenda) || ok(doc?.separador_legenda) || SEPARADOR_LEGENDA_PADRAO;
}

/** Texto do separador em vigor (com os espaços): " — ", ": ", ". "… */
export function separadorLegenda(doc, bloco) {
  return SEPARADORES_LEGENDA.find(x => x.id === idSeparadorLegenda(doc, bloco)).valor;
}

export function recalcularNumeracaoAutomatica(doc) {
  const vazio = { figuras: 0, mapas: 0, tabelas: 0, quadros: 0, formulas: 0, porSubtipo: {} };
  if (!doc || !Array.isArray(doc.secoes)) return vazio;

  const cont = { mapa: 0, tabela: 0, quadro: 0, formula: 0 };
  let capitulo = 0; let formulaNoCapitulo = 0; // formato "por capítulo": reinicia a cada título de nível 1
  const porSubtipo = {};
  const nomes = Object.values(ROTULOS_FIGURA).join('|');
  const prefixoFigura = new RegExp('^(' + nomes + ')\\s+\\d+\\s*(?:' + REG_SEP + '|\\.(?=\\s))', 'i');
  const renumerar = (texto, rotulo, n, regex, forcarAuto = false, sep = ' — ', sepAnterior = null) => {
    if (!texto) return forcarAuto ? `${rotulo} ${n}${sep.trimEnd()}` : texto;
    const puro = removerPrefixoNumeracaoTitulo(texto);
    // com "somente espaço" não há sinal entre número e título: o separador anterior identifica o prefixo
    const prefixoSoEspaco = sepAnterior === ' ' && new RegExp('^' + rotulo + '\\s+\\d+\\s', 'i').test(texto);
    if (forcarAuto || regex.test(texto) || prefixoSoEspaco) {
      return puro ? `${rotulo} ${n}${sep}${puro}` : `${rotulo} ${n}${sep.trimEnd()}`;
    }
    return texto;
  };
  const regRot = (r) => new RegExp('^' + r + '\\s+\\d+\\s*(?:' + REG_SEP + '|\\.(?=\\s))', 'i');

  for (const sec of doc.secoes) {
    for (const b of sec.blocos || []) {
      const forcarAuto = b.numeracao_automatica === true;
      if (b.tipo === 'figura' || b.tipo === 'imagem') {
        const sub = b.tipo === 'imagem' ? 'figura' : (ROTULOS_FIGURA[b.subtipo] ? b.subtipo : 'figura');
        porSubtipo[sub] = (porSubtipo[sub] || 0) + 1;
        b.numero_sequencial = porSubtipo[sub];
        const rotulo = ROTULOS_FIGURA[sub];
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, rotulo, b.numero_sequencial, prefixoFigura, forcarAuto, b.legenda_sep, sepAnt);
        b.legenda = renumerar(b.legenda, rotulo, b.numero_sequencial, prefixoFigura, forcarAuto && !b.titulo, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'mapa') {
        b.numero_sequencial = ++cont.mapa;
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, 'Mapa', cont.mapa, regRot('Mapa'), forcarAuto, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'tabela') {
        b.numero_sequencial = ++cont.tabela;
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, 'Tabela', cont.tabela, regRot('Tabela'), forcarAuto, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'quadro') {
        b.numero_sequencial = ++cont.quadro;
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, 'Quadro', cont.quadro, regRot('Quadro'), forcarAuto, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'titulo') {
        if (nivelDe(b) === 1 && sec.mestraId !== 'capa' && sec.mestraId !== 'sumario') { capitulo += 1; formulaNoCapitulo = 0; } // o título da capa não é capítulo
      } else if (b.tipo === 'formula') {
        b.numero_sequencial = ++cont.formula;
        formulaNoCapitulo += 1;
        const formato = idFormatoNumeroFormula(doc, b);
        b.numero_equacao = formatarNumeroFormula(formato, formato === 'capitulo' ? formulaNoCapitulo : cont.formula, capitulo);
        b.numero = b.numero_equacao;
      }
    }
  }

  return {
    figuras: porSubtipo.figura || 0,
    mapas: cont.mapa,
    tabelas: cont.tabela,
    quadros: cont.quadro,
    formulas: cont.formula,
    porSubtipo
  };
}

/**
 * Aplica explicitamente o prefixo da numeração automática independente no título de um bloco
 */
export function aplicarNumeracaoNoTitulo(bloco, doc) {
  if (!bloco) return '';
  recalcularNumeracaoAutomatica(doc);
  const tipo = bloco.tipo;
  const rotulo = rotuloDoBloco(bloco);
  const num = bloco.numero_sequencial || 1;

  if (tipo === 'formula') {
    bloco.numero_equacao = `(${num})`;
    bloco.numero = bloco.numero_equacao;
    return bloco.numero_equacao;
  }

  const baseTexto = removerPrefixoNumeracaoTitulo(bloco.titulo);
  const sep = separadorLegenda(doc, bloco);
  bloco.legenda_sep = sep;
  bloco.titulo = baseTexto ? `${rotulo} ${num}${sep}${baseTexto}` : `${rotulo} ${num}${sep.trimEnd()}`;
  bloco.numeracao_automatica = true;
  return bloco.titulo;
}

/**
 * Remove qualquer prefixo de numeração automática do título, restaurando o texto limpo
 */
export function removerPrefixoNumeracaoTitulo(titulo, tipo = 'figura', subtipo = 'figura') {
  if (!titulo) return '';
  let limpo = String(titulo).trim();
  const todosRotulos = ['Figura', 'Gráfico', 'Grafico', 'Fotografia', 'Diagrama', 'Fluxograma', 'Ilustração', 'Ilustracao', 'Foto', 'Tabela', 'Quadro', 'Mapa', 'Fórmula', 'Formula', 'Equação', 'Equacao'];
  const regex = new RegExp(`^(${todosRotulos.join('|')})\\s*\\d*\\s*(?:[-—–:]+|\\.(?=\\s))?\\s*`, 'i');
  let anterior = '';
  // Remove prefixos encadeados para desarmar repetições como "Figura 1 — Figura 1asdasdasd"
  while (limpo && limpo !== anterior && regex.test(limpo)) {
    anterior = limpo;
    limpo = limpo.replace(regex, '').trim();
  }
  return limpo;
}

/**
 * Retorna apenas o texto descritivo do título do bloco, expurgando qualquer prefixo sequencial
 */
export function obterTextoPuroTitulo(bloco) {
  if (!bloco) return '';
  return removerPrefixoNumeracaoTitulo(bloco.titulo || '');
}

/**
 * Retorna o rótulo descritivo da categoria do bloco (Figura, Gráfico, Tabela, Quadro, Mapa, Equação)
 */
export function rotuloDoBloco(bloco) {
  if (!bloco) return 'Figura';
  if (bloco.tipo === 'tabela') return 'Tabela';
  if (bloco.tipo === 'quadro') return 'Quadro';
  if (bloco.tipo === 'mapa') return 'Mapa';
  if (bloco.tipo === 'formula') return 'Equação';
  return rotuloDaFigura(bloco);
}

/**
 * Retorna o prefixo oficial intrínseco à posição (ex: "Figura 1 — ")
 */
export function obterPrefixoNumeracao(bloco) {
  const rot = rotuloDoBloco(bloco);
  const num = bloco?.numero_sequencial || 1;
  return `${rot} ${num}${bloco?.legenda_sep ?? ' — '}`;
}

/**
 * Retorna o título completo formatado combinando o prefixo intrínseco e a descrição pura
 */
export function obterTituloCompletoComNumeracao(bloco) {
  if (!bloco) return '';
  const prefixo = obterPrefixoNumeracao(bloco);
  const textoPuro = obterTextoPuroTitulo(bloco);
  return textoPuro ? `${prefixo}${textoPuro}` : prefixo.trim();
}

/**
 * Busca a seção que contém o bloco pelo ID
 */
export function buscarSecaoDoBloco(doc, blocoId) {
  if (!doc || !blocoId) return null;
  for (const s of doc.secoes || []) {
    if ((s.blocos || []).some(b => b.id === blocoId)) return s;
  }
  return null;
}

/**
 * Localiza o número da página de um bloco no documento
 */
function encontrarPaginaDoBloco(doc, blocoId) {
  for (const pag of doc.paginas || []) {
    if ((pag.blocos || []).some(b => b.id === blocoId)) {
      return pag.numero || 1;
    }
  }
  return 1;
}

/** Lista de ilustrações de um subtipo da família Figura (figura, grafico, fotografia, diagrama, fluxograma). */
export function gerarListaIlustracoes(doc, subtipo = 'figura') {
  recalcularNumeracaoAutomatica(doc);
  const rotulo = ROTULOS_FIGURA[subtipo] || ROTULOS_FIGURA.figura;
  const prefixo = new RegExp('^' + rotulo + '\\s+\\d+\\s*(?:' + REG_SEP + '|\\.(?=\\s))?\\s*', 'i');
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      const sub = b.tipo === 'imagem' ? 'figura' : (b.tipo === 'figura' ? (ROTULOS_FIGURA[b.subtipo] ? b.subtipo : 'figura') : null);
      if (sub !== subtipo) continue;
      lista.push({
        id: b.id,
        tipo: subtipo,
        numero: b.numero_sequencial || 1,
        rotulo: rotulo + ' ' + (b.numero_sequencial || 1),
        titulo: (b.titulo || b.legenda || rotulo).replace(prefixo, ''),
        pagina: encontrarPaginaDoBloco(doc, b.id)
      });
    }
  }
  return lista;
}

export function gerarListaFiguras(doc) { return gerarListaIlustracoes(doc, 'figura'); }
export function gerarListaGraficos(doc) { return gerarListaIlustracoes(doc, 'grafico'); }

export function gerarListaMapas(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'mapa') {
        lista.push({
          id: b.id,
          tipo: 'mapa',
          numero: b.numero_sequencial || 1,
          rotulo: `Mapa ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || 'Mapa').replace(/^Mapa\s+\d+\s*(?:[-—–:]|\.(?=\s))?\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

export function gerarListaTabelas(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'tabela') {
        lista.push({
          id: b.id,
          tipo: 'tabela',
          numero: b.numero_sequencial || 1,
          rotulo: `Tabela ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || 'Tabela').replace(/^Tabela\s+\d+\s*(?:[-—–:]|\.(?=\s))?\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

export function gerarListaQuadros(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'quadro') {
        lista.push({
          id: b.id,
          tipo: 'quadro',
          numero: b.numero_sequencial || 1,
          rotulo: `Quadro ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || 'Quadro').replace(/^Quadro\s+\d+\s*(?:[-—–:]|\.(?=\s))?\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

/**
 * Substitui marcadores de referência cruzada [ref:tipo:id] pelo rótulo atualizado
 * Ex.: [ref:figura:b_123] -> "Figura 2", [ref:tabela:b_456] -> "Tabela 1"
 */
export function resolverReferenciasCruzadas(texto, doc) {
  if (!texto || typeof texto !== 'string') return texto || '';
  recalcularNumeracaoAutomatica(doc);

  const mapaBlocos = new Map();
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) mapaBlocos.set(b.id, b);
  }

  const tipos = 'figura|grafico|fotografia|diagrama|fluxograma|mapa|tabela|quadro|formula|equacao';
  const regex = new RegExp('\\[ref:(' + tipos + '):([a-zA-Z0-9_-]+)\\]', 'gi');
  return texto.replace(regex, (match, tipo, id) => {
    const b = mapaBlocos.get(id);
    if (!b) return match;
    const num = b.numero_sequencial || 1;
    switch (b.tipo) {
      case 'figura': return rotuloDaFigura(b) + ' ' + num;
      case 'imagem': return 'Figura ' + num;
      case 'mapa': return 'Mapa ' + num;
      case 'tabela': return 'Tabela ' + num;
      case 'quadro': return 'Quadro ' + num;
      case 'formula': return 'Equação (' + num + ')';
      default: return match;
    }
  });
}

/* =========================================================================
   Linhas e grupos de blocos (mesma mecânica do Clux.js / Glaux GIS)
   Um grupo é uma sequência de blocos vizinhos com o mesmo `grupo`; eles
   dividem as 12 colunas da folha lado a lado.
   ========================================================================= */

export const LIMITE_BLOCOS_POR_LINHA = 4;

export function calcularLinhas(blocos) {
  const linhas = [];
  for (const b of blocos || []) {
    const ultima = linhas[linhas.length - 1];
    if (b.grupo && ultima && ultima[0].grupo === b.grupo) ultima.push(b);
    else linhas.push([b]);
  }
  return linhas;
}

function alturaDaLinha(blocos, inicio, ctx = null) {
  const primeiro = blocos[inicio];
  let altura = estimarAlturaBlocoPt(primeiro, ctx);
  if (!primeiro.grupo) return altura;
  for (let i = inicio + 1; i < blocos.length && blocos[i].grupo === primeiro.grupo; i++) {
    altura = Math.max(altura, estimarAlturaBlocoPt(blocos[i], ctx));
  }
  return altura;
}

/** Divide as 12 colunas igualmente entre os blocos da linha. */
export function igualarLinha(linha) {
  const n = linha.length;
  if (n === 0) return;
  const base = Math.floor(12 / n);
  let resto = 12 - base * n;
  let col = 1;
  for (const b of linha) {
    const span = base + (resto-- > 0 ? 1 : 0);
    b.col = col;
    b.span = span;
    col += span;
  }
}

function reequilibrarGrupo(sec, grupoId) {
  if (!grupoId) return;
  const membros = sec.blocos.filter(b => b.grupo === grupoId);
  if (membros.length > 1) igualarLinha(membros);
}

/** Dissolve linhas de um só bloco (volta para a largura toda). */
export function normalizarGrupos(sec) {
  for (const linha of calcularLinhas(sec.blocos)) {
    if (linha.length === 1 && linha[0].grupo) {
      linha[0].grupo = null;
      linha[0].col = 1;
      linha[0].span = 12;
    }
  }
}

function localizarBloco(doc, blocoId) {
  for (const sec of doc.secoes || []) {
    const idx = (sec.blocos || []).findIndex(b => b.id === blocoId);
    if (idx >= 0) return { sec, idx, bloco: sec.blocos[idx] };
  }
  return null;
}

export function linhaDoBloco(doc, blocoId) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return { numero: 1, total: 1, quantidade: 1 };
  const linhas = calcularLinhas(loc.sec.blocos);
  const i = linhas.findIndex(l => l.some(b => b.id === blocoId));
  return { numero: i + 1, total: linhas.length, quantidade: linhas[i].length };
}

/**
 * Move um bloco para junto de outro.
 * zona: 'antes' | 'depois' (em linha própria) | 'grupo' (passa a dividir a linha do alvo).
 * `aDireita` indica de que lado do alvo o bloco entra quando agrupa.
 */
export function colocarBloco(doc, blocoId, alvoId, zona = 'depois', aDireita = true) {
  if (blocoId === alvoId) return false;
  const origem = localizarBloco(doc, blocoId);
  const alvoLoc = localizarBloco(doc, alvoId);
  if (!origem || !alvoLoc) return false;

  const bloco = origem.bloco;
  const grupoAntigo = bloco.grupo;
  origem.sec.blocos.splice(origem.idx, 1);
  bloco.grupo = null;
  bloco.col = 1;
  bloco.span = 12;
  reequilibrarGrupo(origem.sec, grupoAntigo);

  const sec = alvoLoc.sec;
  const alvo = sec.blocos.find(b => b.id === alvoId);
  const linhas = calcularLinhas(sec.blocos);
  const linha = linhas.find(l => l.includes(alvo));
  const primeiroIdx = sec.blocos.indexOf(linha[0]);
  const ultimoIdx = sec.blocos.indexOf(linha[linha.length - 1]);

  if (zona === 'grupo' && linha.length >= LIMITE_BLOCOS_POR_LINHA) zona = 'depois';

  if (zona === 'antes') {
    sec.blocos.splice(primeiroIdx, 0, bloco);
  } else if (zona === 'depois') {
    sec.blocos.splice(ultimoIdx + 1, 0, bloco);
  } else {
    const gid = alvo.grupo || gerarId('grp');
    alvo.grupo = gid;
    bloco.grupo = gid;
    const idxAlvo = sec.blocos.indexOf(alvo);
    sec.blocos.splice(aDireita ? idxAlvo + 1 : idxAlvo, 0, bloco);
    igualarLinha(sec.blocos.filter(b => b.grupo === gid));
  }

  normalizarGrupos(origem.sec);
  normalizarGrupos(sec);
  repaginarDocumento(doc);
  return true;
}

/** Sobe (-1) ou desce (+1) o bloco uma linha, saindo do grupo se estiver em um. */
export function moverBlocoPorLinha(doc, blocoId, direcao) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return false;
  const linhas = calcularLinhas(loc.sec.blocos);
  const i = linhas.findIndex(l => l.some(b => b.id === blocoId));
  const proxima = linhas[i + direcao];
  if (!proxima) {
    // já está na ponta: se dividia a linha, apenas sai dela
    if (linhas[i].length > 1) {
      const ref = linhas[i].find(b => b.id !== blocoId);
      return colocarBloco(doc, blocoId, ref.id, direcao < 0 ? 'antes' : 'depois');
    }
    return false;
  }
  const ancora = direcao < 0 ? proxima[0] : proxima[proxima.length - 1];
  return colocarBloco(doc, blocoId, ancora.id, direcao < 0 ? 'antes' : 'depois');
}

/** Coloca o bloco na linha de número `numero` (1..n) ou numa linha nova ao final (numero = n + 1). */
export function moverParaLinha(doc, blocoId, numero) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return false;
  const linhas = calcularLinhas(loc.sec.blocos);
  const atual = linhas.findIndex(l => l.some(b => b.id === blocoId));
  if (numero === atual + 1) return false;
  if (numero > linhas.length) {
    if (linhas[atual].length === 1) return false;
    const ultima = linhas[linhas.length - 1];
    return colocarBloco(doc, blocoId, ultima[ultima.length - 1].id, 'depois');
  }
  const alvoLinha = linhas[numero - 1];
  return colocarBloco(doc, blocoId, alvoLinha[alvoLinha.length - 1].id, 'grupo', true);
}

/** Duplica o bloco logo abaixo da sua linha, em linha própria. */
export function duplicarBlocoNaSecao(doc, blocoId) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return null;
  const clone = JSON.parse(JSON.stringify(loc.bloco));
  clone.id = gerarId('bloco');
  clone.grupo = null;
  clone.col = 1;
  clone.span = 12;
  const linha = calcularLinhas(loc.sec.blocos).find(l => l.some(b => b.id === blocoId));
  const ultimoIdx = loc.sec.blocos.indexOf(linha[linha.length - 1]);
  loc.sec.blocos.splice(ultimoIdx + 1, 0, clone);
  repaginarDocumento(doc);
  return clone;
}

/**
 * Divide um bloco de texto (parágrafo, título, subtítulo, nota) em dois blocos contíguos.
 * @param {Object} doc - Documento Athenes.
 * @param {string} blocoId - ID do bloco original a ser dividido.
 * @param {number|Object} [corte=null] - Índice do caractere onde cortar, ou objeto { textoAntes, textoDepois }.
 * @returns {Object|null} { blocoOriginal, novoBloco } ou null se o bloco não existir.
 */
export function dividirBlocoTexto(doc, blocoId, corte = null) {
  const loc = localizarBloco(doc, blocoId);
  if (!loc) return null;
  const blocoOrig = loc.bloco;

  let textoAntes = '';
  let textoDepois = '';

  const textoTotal = blocoOrig.texto !== undefined ? String(blocoOrig.texto) : String(blocoOrig.titulo || '');

  if (corte && typeof corte === 'object' && corte.textoAntes !== undefined && corte.textoDepois !== undefined) {
    textoAntes = corte.textoAntes;
    textoDepois = corte.textoDepois;
  } else if (typeof corte === 'number' && corte >= 0) {
    textoAntes = textoTotal.slice(0, corte);
    textoDepois = textoTotal.slice(corte);
  } else {
    // Corte no meio se não informado
    const meio = Math.floor(textoTotal.length / 2);
    const proxEspaco = textoTotal.indexOf(' ', meio);
    const pos = proxEspaco !== -1 ? proxEspaco : meio;
    textoAntes = textoTotal.slice(0, pos);
    textoDepois = textoTotal.slice(pos).trimStart();
  }

  // Atualiza o bloco original
  if (blocoOrig.texto !== undefined) {
    blocoOrig.texto = textoAntes || '&nbsp;';
  } else if (blocoOrig.titulo !== undefined) {
    blocoOrig.titulo = textoAntes || 'Título';
  }

  // Cria o novo bloco clonando propriedades e estilos
  const novoBloco = criarNovoBloco(blocoOrig.tipo || 'paragrafo', {
    ...blocoOrig,
    id: undefined,
    texto: textoDepois || '&nbsp;',
    titulo: (blocoOrig.tipo === 'titulo' || blocoOrig.tipo === 'subtitulo') ? (textoDepois || 'Subtítulo') : undefined
  });

  novoBloco.grupo = null;
  novoBloco.col = 1;
  novoBloco.span = 12;

  // Insere imediatamente após o bloco original na seção
  const idxBloco = loc.sec.blocos.findIndex(b => b.id === blocoId);
  loc.sec.blocos.splice(idxBloco + 1, 0, novoBloco);

  repaginarDocumento(doc);
  return { blocoOriginal: blocoOrig, novoBloco };
}

/**
 * Catálogo de Modelos de Layout e Apresentação para Blocos Compostos (Fórmula, Figura, Tabela, Quadro)
 * Inspirado no sistema de layouts/objetos do Desk com suporte a subgrade e variáveis.
 */
export const MODELOS_LAYOUT_BLOCO = {
  formula: [
    {
      id: 'formula_limpo',
      nome: 'Limpo Acadêmico (Sem Caixa)',
      descricao: 'Padrão limpo sem fundo nem bordas; fórmula centralizada e número à direita.',
      moldura_tipo: 'limpo',
      fundo_ativo: false,
      borda_ativa: false,
      posicao_numero: 'direita',
      mostrar_legenda: false,
      mostrar_fonte: false,
      padding_pt: 4
    },
    {
      id: 'formula_destaque',
      nome: 'Linha Lateral de Destaque',
      descricao: 'Barra vertical na cor da marca (#314F79) à esquerda com fundo suave.',
      moldura_tipo: 'linha_esquerda',
      fundo_ativo: true,
      fundo_cor: '#F4F7FB',
      borda_ativa: true,
      borda_cor: '#314F79',
      borda_largura_px: 3.5,
      posicao_numero: 'direita',
      mostrar_legenda: true,
      padding_pt: 8
    },
    {
      id: 'formula_topo_base',
      nome: 'Linhas Topo e Base',
      descricao: 'Duas linhas horizontais discretas delimitando a equação.',
      moldura_tipo: 'linhas_topo_base',
      fundo_ativo: false,
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      borda_largura_px: 1,
      posicao_numero: 'direita',
      padding_pt: 6
    },
    {
      id: 'formula_cartao',
      nome: 'Cartão Suave com Fundo',
      descricao: 'Caixa fechada com fundo suave acolchoado e cantos arredondados.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#EEF4FA',
      borda_ativa: true,
      borda_cor: '#C8D7E6',
      raio_borda_px: 8,
      posicao_numero: 'direita',
      padding_pt: 10
    },
    {
      id: 'formula_explicativa',
      nome: 'Com Legenda Explicativa (onde...)',
      descricao: 'Fórmula em destaque com bloco de descrição das variáveis e fontes.',
      moldura_tipo: 'linha_esquerda',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#314F79',
      posicao_numero: 'direita',
      mostrar_legenda: true,
      mostrar_fonte: true,
      padding_pt: 8
    },
    {
      id: 'formula_pontilhada',
      nome: 'Linha Lateral Pontilhada',
      descricao: 'Barra lateral pontilhada discreta com fundo limpo.',
      moldura_tipo: 'linha_esquerda',
      linha_estilo: 'pontilhada',
      borda_estilo: 'pontilhada',
      fundo_ativo: false,
      borda_ativa: true,
      borda_cor: '#314F79',
      borda_largura_px: 3,
      posicao_numero: 'direita',
      padding_pt: 6
    },
    {
      id: 'formula_quadriculada',
      nome: 'Borda Retinha / Cantos Vivos',
      descricao: 'Contorno retangular fino com cantos vivos (0 px) estilo desenho técnico.',
      moldura_tipo: 'caixa_borda',
      linha_estilo: 'quadriculada_reta',
      borda_estilo: 'solida',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 0,
      posicao_numero: 'direita',
      padding_pt: 8
    }
  ],
  figura: [
    {
      id: 'figura_abnt',
      nome: 'Padrão ABNT (Limpo)',
      descricao: 'Título no topo, imagem sem moldura no centro, legenda e fonte na base.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      subgrade_colunas: 1,
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 4
    },
    {
      id: 'figura_cartao',
      nome: 'Cartão Integrado com Fundo',
      descricao: 'Caixa acolchoada com fundo suave unificando título, imagem e fonte.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#E2E8F0',
      raio_borda_px: 10,
      posicao_titulo: 'topo',
      subgrade_colunas: 1,
      padding_pt: 12
    },
    {
      id: 'figura_legenda_lateral',
      nome: 'Subgrade 2 Colunas (Legenda ao Lado)',
      descricao: 'Imagem à esquerda (60%) e título, legenda e fonte alinhados à direita (40%).',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      subgrade_colunas: 2,
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 6
    },
    {
      id: 'figura_moldura',
      nome: 'Moldura Clássica',
      descricao: 'Contorno fino ao redor do bloco delimitando a ilustração.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 6,
      fundo_ativo: false,
      padding_pt: 8
    },
    {
      id: 'figura_linha_lateral',
      nome: 'Linha Lateral de Destaque',
      descricao: 'Barra lateral à esquerda com cantos retos vivos para pranchas e relatórios.',
      moldura_tipo: 'linha_esquerda',
      linha_estilo: 'quadriculada_reta',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#314F79',
      borda_largura_px: 3.5,
      raio_borda_px: 0,
      padding_pt: 10
    },
    {
      id: 'figura_tecnica',
      nome: 'Moldura Técnica / Prancha',
      descricao: 'Borda com contorno em esquadro estilo prancha técnica.',
      moldura_tipo: 'moldura_tecnica',
      fundo_ativo: false,
      borda_ativa: true,
      borda_cor: '#314F79',
      raio_borda_px: 0,
      padding_pt: 10
    }
  ],
  tabela: [
    {
      id: 'tabela_abnt',
      nome: 'Padrão ABNT / IBGE (Laterais Abertas)',
      descricao: 'Linhas no cabeçalho e na base, laterais abertas sem caixa externa.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 4
    },
    {
      id: 'tabela_quadro',
      nome: 'Quadro Fechado com Borda',
      descricao: 'Caixa retangular fechada em todos os lados com linhas divisórias.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#1F2733',
      posicao_titulo: 'topo',
      padding_pt: 6
    },
    {
      id: 'tabela_cartao',
      nome: 'Cartão Suave',
      descricao: 'Fundo sutil com bordas arredondadas para tabelas destacadas.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 8,
      posicao_titulo: 'topo',
      padding_pt: 10
    },
    {
      id: 'tabela_linha_topo',
      nome: 'Linha Superior de Destaque',
      descricao: 'Faixa superior na cor de estilo da marca (#314F79).',
      moldura_tipo: 'personalizado',
      borda_ativa: true,
      borda_posicao: 'topo',
      borda_cor: '#314F79',
      borda_largura_px: 3,
      padding_pt: 8
    }
  ],
  quadro: [
    {
      id: 'quadro_fechado',
      nome: 'Quadro Fechado (Padrão ABNT)',
      descricao: 'Caixa retangular fechada em todos os lados com linhas divisórias.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#1F2733',
      posicao_titulo: 'topo',
      padding_pt: 6
    },
    {
      id: 'quadro_cartao',
      nome: 'Cartão Suave com Fundo',
      descricao: 'Fundo acolchoado suave com cantos arredondados.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 8,
      posicao_titulo: 'topo',
      padding_pt: 8
    },
    {
      id: 'quadro_limpo',
      nome: 'Quadro Limpo Acadêmico',
      descricao: 'Sem borda externa decorativa, foco na tipografia tabular.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 4
    }
  ],
  mapa: [
    {
      id: 'mapa_abnt',
      nome: 'Padrão Cartográfico ABNT',
      descricao: 'Título no topo, área cartográfica delimitada e fonte na base.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 4,
      posicao_titulo: 'topo',
      padding_pt: 6
    },
    {
      id: 'mapa_prancha',
      nome: 'Moldura Técnica de Prancha',
      descricao: 'Esquadros técnicos nos cantos vivos (0 px) estilo prancha de engenharia.',
      moldura_tipo: 'moldura_tecnica',
      borda_ativa: true,
      borda_cor: '#314F79',
      raio_borda_px: 0,
      padding_pt: 8
    },
    {
      id: 'mapa_lateral',
      nome: 'Linha Lateral de Destaque',
      descricao: 'Faixa técnica na lateral esquerda na cor institucional (#314F79).',
      moldura_tipo: 'linha_esquerda',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#314F79',
      padding_pt: 8
    }
  ]
};

/**
 * Retorna os modelos pré-definidos e customizados para o tipo de bloco
 */
export function obterModelosLayoutBloco(tipo, doc = null) {
  let chave = (tipo === 'imagem' ? 'figura' : tipo);
  if (!MODELOS_LAYOUT_BLOCO[chave]) {
    if (chave === 'quadro') chave = 'tabela';
    else if (chave === 'mapa') chave = 'figura';
    else chave = 'figura';
  }
  const padroes = MODELOS_LAYOUT_BLOCO[chave] || [];
  const customizados = (doc?.modelos_blocos || []).filter(m => m.tipo === chave || m.tipo === tipo);
  return [...padroes, ...customizados];
}

/**
 * Aplica um modelo de layout e apresentação ao bloco
 */
export function aplicarModeloLayoutBloco(bloco, modeloIdOuConfig, doc = null) {
  if (!bloco) return false;
  let cfg = null;
  if (typeof modeloIdOuConfig === 'string') {
    const todos = obterModelosLayoutBloco(bloco.tipo, doc);
    cfg = todos.find(m => m.id === modeloIdOuConfig);
  } else if (typeof modeloIdOuConfig === 'object' && modeloIdOuConfig !== null) {
    cfg = modeloIdOuConfig;
  }
  if (!cfg) return false;

  bloco.modelo_layout_id = cfg.id || bloco.modelo_layout_id;
  bloco.moldura_tipo = cfg.moldura_tipo || 'limpo';
  bloco.fundo_ativo = cfg.fundo_ativo !== undefined ? cfg.fundo_ativo : false;
  if (cfg.fundo_cor) bloco.fundo_cor = cfg.fundo_cor;
  bloco.borda_ativa = cfg.borda_ativa !== undefined ? cfg.borda_ativa : false;
  if (cfg.borda_cor) bloco.borda_cor = cfg.borda_cor;
  if (cfg.borda_largura_px) bloco.borda_largura_px = cfg.borda_largura_px;
  if (cfg.borda_posicao) bloco.borda_posicao = cfg.borda_posicao;
  if (cfg.borda_estilo) bloco.borda_estilo = cfg.borda_estilo;
  if (cfg.raio_borda_px !== undefined) bloco.raio_borda_px = cfg.raio_borda_px;
  if (cfg.padding_pt !== undefined) bloco.padding_pt = cfg.padding_pt;

  // Subgrade / Variáveis específicas
  if (cfg.posicao_numero) bloco.posicao_numero = cfg.posicao_numero;
  if (cfg.mostrar_legenda !== undefined) bloco.mostrar_legenda = cfg.mostrar_legenda;
  if (cfg.mostrar_fonte !== undefined) bloco.mostrar_fonte = cfg.mostrar_fonte;
  if (cfg.posicao_titulo) bloco.posicao_titulo = cfg.posicao_titulo;
  if (cfg.subgrade_colunas) bloco.subgrade_colunas = cfg.subgrade_colunas;
  if (cfg.subgrade_linhas) bloco.subgrade_linhas = cfg.subgrade_linhas;
  if (cfg.subgrade_slots) bloco.subgrade_slots = JSON.parse(JSON.stringify(cfg.subgrade_slots));
  if (cfg.subgrade_gap_pt !== undefined) bloco.subgrade_gap_pt = cfg.subgrade_gap_pt;
  if (cfg.linha_estilo) bloco.linha_estilo = cfg.linha_estilo;
  if (cfg.svg_custom) bloco.svg_custom = cfg.svg_custom;

  // Imagem: altura, proporção e enquadramento
  if (cfg.altura_imagem_px !== undefined) bloco.altura_imagem_px = cfg.altura_imagem_px;
  if (cfg.altura_modo) bloco.altura_modo = cfg.altura_modo;
  if (cfg.proporcao_imagem) bloco.proporcao_imagem = cfg.proporcao_imagem;
  if (cfg.ajuste_enquadramento) bloco.ajuste_enquadramento = cfg.ajuste_enquadramento;
  if (cfg.alinhamento_imagem) bloco.alinhamento_imagem = cfg.alinhamento_imagem;

  // Tipografia e Alinhamentos dos textos da caixa/figura
  if (cfg.legenda_estilo_id) bloco.legenda_estilo_id = cfg.legenda_estilo_id;
  if (cfg.legenda_usar_alinhamento_estilo !== undefined) bloco.legenda_usar_alinhamento_estilo = cfg.legenda_usar_alinhamento_estilo;
  if (cfg.legenda_alinhamento) bloco.legenda_alinhamento = cfg.legenda_alinhamento;

  if (cfg.titulo_estilo_id) bloco.titulo_estilo_id = cfg.titulo_estilo_id;
  if (cfg.titulo_usar_alinhamento_estilo !== undefined) bloco.titulo_usar_alinhamento_estilo = cfg.titulo_usar_alinhamento_estilo;
  if (cfg.titulo_alinhamento) bloco.titulo_alinhamento = cfg.titulo_alinhamento;

  if (cfg.fonte_estilo_id) bloco.fonte_estilo_id = cfg.fonte_estilo_id;
  if (cfg.fonte_usar_alinhamento_estilo !== undefined) bloco.fonte_usar_alinhamento_estilo = cfg.fonte_usar_alinhamento_estilo;
  if (cfg.fonte_alinhamento) bloco.fonte_alinhamento = cfg.fonte_alinhamento;

  return true;
}

/**
 * Salva a configuração atual de layout do bloco como um modelo reutilizável
 */
export function salvarModeloLayoutCustomizado(doc, nome, bloco) {
  if (!doc || !bloco || !nome) return null;
  doc.modelos_blocos = doc.modelos_blocos || [];
  const tipoChave = bloco.tipo === 'imagem' ? 'figura' : bloco.tipo;
  const id = 'modelo_' + Date.now().toString(36);
  const modelo = {
    id,
    nome: nome.trim(),
    tipo: tipoChave,
    descricao: 'Modelo personalizado criado pelo usuário.',
    moldura_tipo: bloco.moldura_tipo || 'limpo',
    fundo_ativo: !!bloco.fundo_ativo,
    fundo_cor: bloco.fundo_cor || '#F4F7FB',
    borda_ativa: !!bloco.borda_ativa,
    borda_cor: bloco.borda_cor || '#CBD5E1',
    borda_largura_px: bloco.borda_largura_px || 1,
    borda_posicao: bloco.borda_posicao || 'todas',
    borda_estilo: bloco.borda_estilo || 'solida',
    linha_estilo: bloco.linha_estilo || 'solida',
    raio_borda_px: bloco.raio_borda_px !== undefined ? bloco.raio_borda_px : 0,
    padding_pt: bloco.padding_pt !== undefined ? bloco.padding_pt : 8,
    posicao_numero: bloco.posicao_numero,
    mostrar_legenda: bloco.mostrar_legenda,
    mostrar_fonte: bloco.mostrar_fonte,
    posicao_titulo: bloco.posicao_titulo,
    subgrade_colunas: bloco.subgrade_colunas,
    subgrade_linhas: bloco.subgrade_linhas,
    subgrade_slots: bloco.subgrade_slots ? JSON.parse(JSON.stringify(bloco.subgrade_slots)) : null,
    subgrade_gap_pt: bloco.subgrade_gap_pt,
    svg_custom: bloco.svg_custom || ''
  };
  doc.modelos_blocos.push(modelo);
  return modelo;
}

/**
 * Propaga o layout escolhido para todos os blocos do mesmo tipo no documento
 */
export function aplicarLayoutATodosBlocos(doc, tipo, config) {
  if (!doc || !doc.secoes || !tipo) return 0;
  const tipoChave = tipo === 'imagem' ? 'figura' : tipo;
  let alterados = 0;
  doc.secoes.forEach(sec => {
    (sec.blocos || []).forEach(b => {
      const bTipo = b.tipo === 'imagem' ? 'figura' : b.tipo;
      if (bTipo === tipoChave) {
        aplicarModeloLayoutBloco(b, config, doc);
        alterados++;
      }
    });
  });
  return alterados;
}

/**
 * A "Linha de borda" está ligada? Valor explícito (`borda_ativa`) sempre vence; sem ele, as molduras
 * com linha própria (lateral, topo/base, caixa, cartão, técnica) assumem ligada e "limpo"/"personalizado" desligada.
 * Fonte única para o CSS do bloco e para o checkbox do modal (evita checkbox marcado sem borda visível).
 */
export function bordaAtivaEfetiva(b) {
  if (b && b.borda_ativa !== undefined && b.borda_ativa !== null) return !!b.borda_ativa;
  const tipo = b?.moldura_tipo || 'limpo';
  return tipo !== 'limpo' && tipo !== 'personalizado';
}

/**
 * Gera as propriedades CSS do estilo de caixa / moldura do bloco
 */
export function gerarCssMolduraBloco(b) {
  if (!b) return {};
  const tipo = b.moldura_tipo || 'limpo';
  const pad = b.padding_pt !== undefined ? b.padding_pt : (tipo === 'limpo' ? 4 : (tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? 8 : 10);
  const linhaEstilo = b.linha_estilo || b.borda_estilo || 'solida';
  const raio = b.raio_borda_px !== undefined ? b.raio_borda_px : (tipo === 'cartao_suave' ? 8 : (linhaEstilo === 'quadriculada_reta' || tipo === 'quadriculada_reta') ? 0 : 0);
  const corBorda = b.borda_cor || ((tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? '#314F79' : '#CBD5E1');
  const corFundo = b.fundo_cor || (tipo === 'cartao_suave' ? '#F8FAFC' : (tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? '#F4F7FB' : 'transparent');
  const fundoAtivo = b.fundo_ativo !== undefined ? b.fundo_ativo : (tipo === 'cartao_suave' || ((tipo === 'linha_esquerda' || tipo === 'linha_lateral') && b.fundo_ativo));

  let border = 'none';
  let borderLeft = 'none';
  let borderTop = 'none';
  let borderBottom = 'none';
  let extraCss = {};

  const largLinha = b.borda_largura_px || ((tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? 3.5 : 1);
  const cssEstilo = (linhaEstilo === 'tracejada' || linhaEstilo === 'dashed') ? 'dashed'
    : (linhaEstilo === 'pontilhada' || linhaEstilo === 'dotted') ? 'dotted'
    : (linhaEstilo === 'dupla' || linhaEstilo === 'double') ? 'double'
    : 'solid';

  const bordaOn = bordaAtivaEfetiva(b);

  if (tipo === 'linha_esquerda' || tipo === 'linha_lateral') {
    if (bordaOn) borderLeft = `${largLinha}px ${cssEstilo} ${corBorda}`;
    if (linhaEstilo === 'quadriculada_reta') {
      extraCss.borderRadius = '0px';
    }
  } else if (tipo === 'linhas_topo_base') {
    if (bordaOn) {
      borderTop = `${largLinha}px ${cssEstilo} ${corBorda}`;
      borderBottom = `${largLinha}px ${cssEstilo} ${corBorda}`;
    }
  } else if (tipo === 'caixa_borda' || tipo === 'cartao_suave') {
    if (bordaOn) border = `${largLinha}px ${cssEstilo} ${corBorda}`;
  } else if (tipo === 'moldura_tecnica') {
    if (bordaOn) {
      border = `1.5px solid ${corBorda}`;
      extraCss.outline = '1px dashed #CBD5E1';
      extraCss.outlineOffset = '3px';
    }
  } else if (tipo === 'personalizado') {
    if (bordaOn) {
      const estilo = b.borda_estilo || linhaEstilo;
      const cssEstiloP = estilo === 'tracejada' ? 'dashed' : estilo === 'pontilhada' ? 'dotted' : estilo === 'dupla' ? 'double' : 'solid';
      const larg = b.borda_largura_px || 1;
      const pos = b.borda_posicao || 'todas';
      if (pos === 'esquerda') borderLeft = `${larg}px ${cssEstiloP} ${corBorda}`;
      else if (pos === 'topo_base') { borderTop = `${larg}px ${cssEstiloP} ${corBorda}`; borderBottom = `${larg}px ${cssEstiloP} ${corBorda}`; }
      else if (pos === 'topo') { borderTop = `${larg}px ${cssEstiloP} ${corBorda}`; }
      else border = `${larg}px ${cssEstiloP} ${corBorda}`;
    }
  } else if (bordaOn) {
    // "limpo" com a linha de borda ligada explicitamente: contorno completo
    border = `${largLinha}px ${cssEstilo} ${corBorda}`;
  }

  return {
    background: fundoAtivo ? corFundo : 'transparent',
    border,
    borderLeft: borderLeft !== 'none' ? borderLeft : border !== 'none' ? border : 'none',
    borderTop: borderTop !== 'none' ? borderTop : border !== 'none' ? border : 'none',
    borderBottom: borderBottom !== 'none' ? borderBottom : border !== 'none' ? border : 'none',
    borderRadius: `${raio}px`,
    padding: `${pad}px`,
    margin: '6px 0',
    boxSizing: 'border-box',
    ...extraCss
  };
}

/**
 * Catálogo dos formatos de numeração de páginas disponíveis
 */
export const FORMATOS_NUMERACAO_PAGINA = [
  { id: 'apenas_numero', rotulo: 'Apenas Número (ex: 3)', exemplo: '3' },
  { id: 'n_de_total', rotulo: 'N de Total (ex: 3 de 27)', exemplo: '3 de 27' },
  { id: 'n_of_total', rotulo: 'N of Total (ex: 3 of 27 — Periódicos MDPI)', exemplo: '3 of 27' },
  { id: 'pagina_n', rotulo: 'Página N (ex: Página 3)', exemplo: 'Página 3' },
  { id: 'pagina_n_de_total', rotulo: 'Página N de Total (ex: Página 3 de 27)', exemplo: 'Página 3 de 27' },
  { id: 'romano_min', rotulo: 'Romano Minúsculo (ex: iii — Pré-textual)', exemplo: 'iii' },
  { id: 'romano_mai', rotulo: 'Romano Maiúsculo (ex: III)', exemplo: 'III' },
  { id: 'hifen', rotulo: 'Hífen (ex: - 3 -)', exemplo: '- 3 -' },
  { id: 'personalizado', rotulo: 'Personalizado ({p} de {total})', exemplo: '{p} de {total}' }
];

/**
 * Converte um número arábico para algarismo romano
 */
export function paraRomano(num, minusculo = false) {
  const n = parseInt(num, 10);
  if (!n || n < 1) return String(num || 1);
  const val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const rom = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let res = '';
  let restante = n;
  for (let i = 0; i < val.length; i++) {
    while (restante >= val[i]) {
      res += rom[i];
      restante -= val[i];
    }
  }
  return minusculo ? res.toLowerCase() : res;
}

/**
 * Formata o número da página conforme as preferências da mestra e do documento
 */
export function formatarNumeroPagina(numPagina, totalPaginas = 1, config = {}) {
  const cfg = typeof config === 'object' && config !== null ? config : {};
  const iniciarEm = parseInt(cfg.iniciar_em, 10) || 1;
  const numEfetivo = Math.max(1, (numPagina - 1) + iniciarEm);
  const totalEfetivo = Math.max(1, totalPaginas);

  // Ocultar número na capa / primeira página física
  if (cfg.ocultar_na_capa !== false && numPagina === 1) {
    return '';
  }

  const formato = cfg.formato || 'n_de_total';
  let strNum = '';

  switch (formato) {
    case 'apenas_numero':
      strNum = String(numEfetivo);
      break;
    case 'pagina_n':
      strNum = `Página ${numEfetivo}`;
      break;
    case 'n_de_total':
      strNum = `${numEfetivo} de ${totalEfetivo}`;
      break;
    case 'n_of_total':
      strNum = `${numEfetivo} of ${totalEfetivo}`;
      break;
    case 'pagina_n_de_total':
      strNum = `Página ${numEfetivo} de ${totalEfetivo}`;
      break;
    case 'romano_min':
      strNum = paraRomano(numEfetivo, true);
      break;
    case 'romano_mai':
      strNum = paraRomano(numEfetivo, false);
      break;
    case 'hifen':
      strNum = `- ${numEfetivo} -`;
      break;
    case 'personalizado': {
      const mascara = cfg.mascara || '{p} de {total}';
      strNum = mascara
        .replace(/\{p\}/gi, String(numEfetivo))
        .replace(/\{total\}/gi, String(totalEfetivo));
      break;
    }
    default:
      strNum = `${numEfetivo} de ${totalEfetivo}`;
      break;
  }

  const prefixo = cfg.prefixo || '';
  const sufixo = cfg.sufixo || '';
  return `${prefixo}${strNum}${sufixo}`;
}

/**
 * Cria um novo elemento recorrente da página mestra com suporte a grade ou coordenadas exatas (mm)
 */
export function criarElementoMestra(tipo, dados = {}) {
  const id = 'elem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const padrao = {
    id,
    tipo: tipo || 'caixa_grade',
    posicionamento_modo: dados.posicionamento_modo || 'grade', // 'grade' | 'coordenadas'
    x_mm: dados.x_mm !== undefined ? dados.x_mm : 20,
    y_mm: dados.y_mm !== undefined ? dados.y_mm : 20,
    largura_mm: dados.largura_mm !== undefined ? dados.largura_mm : 170,
    altura_mm: dados.altura_mm !== undefined ? dados.altura_mm : 40,
    sangria: !!dados.sangria, // de borda a borda física da folha (0 mm)
    camada: dados.camada || 'frente', // 'fundo' | 'frente'
    cor: dados.cor || '#314F79'
  };

  if (tipo === 'tarja') {
    return {
      ...padrao,
      titulo: dados.titulo || 'Tarja Decorativa',
      posicao: dados.posicao || 'topo', // 'topo' | 'base' | 'lateral_esquerda'
      altura_mm: dados.altura_mm || 8,
      cor: dados.cor || '#314F79'
    };
  }

  if (tipo === 'rotulo_estatico') {
    return {
      ...padrao,
      titulo: dados.titulo || 'Rótulo Institucional',
      texto: dados.texto || 'UNIVERSIDADE / INSTITUTO DE PESQUISA',
      tamanho_pt: dados.tamanho_pt || 10,
      y_mm: dados.y_mm !== undefined ? dados.y_mm : 12,
      cor: dados.cor || '#314F79'
    };
  }

  if (tipo === 'marca_dagua') {
    return {
      ...padrao,
      titulo: dados.titulo || 'Marca d\'Água',
      texto: dados.texto || 'VERSÃO PRELIMINAR',
      opacidade: dados.opacidade !== undefined ? dados.opacidade : 0.12,
      cor: dados.cor || '#314F79'
    };
  }

  if (tipo === 'foto_capa') {
    return {
      ...padrao,
      tipo: 'foto_capa',
      titulo: dados.titulo || 'Foto de Capa',
      posicionamento_modo: 'coordenadas',
      sangria: dados.sangria !== undefined ? dados.sangria : true,
      x_mm: dados.x_mm || 0,
      y_mm: dados.y_mm || 0,
      largura_mm: dados.largura_mm || 210,
      altura_mm: dados.altura_mm || 140,
      url: dados.url || '',
      opacidade: dados.opacidade !== undefined ? dados.opacidade : 1,
      camada: dados.camada || 'fundo',
      ajuste: dados.ajuste || 'cover' // 'cover' | 'contain'
    };
  }

  // Caixa de Grade / Moldura
  return {
    ...padrao,
    titulo: dados.titulo || 'Moldura da Capa / Prancha',
    linha: dados.linha || 1,
    spanLinhas: dados.spanLinhas || 1,
    coluna: dados.coluna || 1,
    spanColunas: dados.spanColunas || 3,
    borda: dados.borda || '1px solid #314F79',
    fundo: dados.fundo || 'rgba(49, 79, 121, 0.05)'
  };
}
