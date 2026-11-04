// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modelo de Dados do Documento, Páginas Mestras, Seções e Blocos.
 * Arquitetura declarativa e reativa com repaginação automática e fluxo contínuo.
 */

import { extrairItensSumario, nivelDe } from './athenes_sumario.js';
import { TIPOS_BLOCO_TEXTO, sanearHtmlTexto, ajusteDeFragmento } from './athenes_estilo_exclusivo.js';
import { parametrosTextoPt, linhasEstimadas, lacunasInternasPt, alturaTabelaPt, dividirParaPagina, podeDividir, alturaMedidaDoBloco } from './athenes_fragmentos.js';
import { garantirEstilosDeTitulos } from './athenes_estilos.js';
import { aplicarRegrasMestraNasPaginas, vincularOverridesAsPaginas } from './athenes_mestra_canvas.js';
import { criarEstilosPadrao, PERFIS_FORMATACAO } from './athenes_estilos.js';
import {
  obterLayoutFigura, CHAVES_ESTILO_FIGURA, PAPEIS_VALIDOS, obterPapelSemantico, papelDoSubtipo, migrarBlocoFigura
} from './athenes_figura_layout.js';
import { geometriaCorpoMm, calcularNumerosExibidos } from './athenes_paginacao.js';
import {
  obterConfigNotas, idsNotasDoBloco, alturaSegmentoPt, alturaSeparadorPt, ajustarNotasAoEspaco, rotularNotas, PT_POR_MM
} from './athenes_notas_rodape.js';
import { gerarId, ROTULOS_FIGURA } from './athenes_documento_base.js';
export { gerarId, ROTULOS_FIGURA, rotuloDaFigura } from './athenes_documento_base.js';
export { SEPARADORES_LEGENDA, SEPARADOR_LEGENDA_PADRAO, FORMATOS_NUMERO_FORMULA, FORMATO_NUMERO_FORMULA_PADRAO, idFormatoNumeroFormula, formatarNumeroFormula, idSeparadorLegenda, separadorLegenda, recalcularNumeracaoAutomatica, aplicarNumeracaoNoTitulo, removerPrefixoNumeracaoTitulo, obterTextoPuroTitulo, rotuloDoBloco, obterPrefixoNumeracao, obterTituloCompletoComNumeracao, buscarSecaoDoBloco, gerarListaIlustracoes, gerarListaFiguras, gerarListaGraficos, gerarListaMapas, gerarListaTabelas, gerarListaQuadros, resolverReferenciasCruzadas } from './athenes_numeracao_legendas.js';
export { MODELOS_LAYOUT_BLOCO, obterModelosLayoutBloco, aplicarModeloLayoutBloco, salvarModeloLayoutCustomizado, aplicarLayoutATodosBlocos, bordaAtivaEfetiva, gerarCssMolduraBloco } from './athenes_bloco_layout.js';
export { FORMATOS_NUMERACAO_PAGINA, paraRomano, formatarNumeroPagina, criarElementoMestra } from './athenes_pagina_elementos.js';

export const TIPOS_DOCUMENTO = Object.freeze([
  { id: 'artigo', rotulo: 'Artigo Científico', icone: 'artigo' },
  { id: 'relatorio', rotulo: 'Relatório Técnico', icone: 'relatorio' },
  { id: 'monografia', rotulo: 'Monografia / Tese / TCC', icone: 'livro' },
  { id: 'ensaio', rotulo: 'Ensaio / Paper Curto', icone: 'documento' }
]);

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
  // Bloco de texto: só `estiloId` define o visual. Fonte, cor, alinhamento, entrelinha, espaços, recuos e marcadores são do estilo.
  const ehTexto = TIPOS_BLOCO_TEXTO.includes(tipo || 'paragrafo');
  const b = {
    id: dados.id || gerarId('bloco'),
    tipo: tipo || 'paragrafo',
    col: dados.col || 1,
    span: dados.span || 12,
    linha_grade: dados.linha_grade || null,
    estiloId: dados.estiloId || (tipo === 'titulo' ? 'titulo1' : tipo === 'subtitulo' ? 'subtitulo' : 'corpo'),
    ...(ehTexto ? {} : { alinhamento: dados.alinhamento || 'esquerda' }),
    manterComProximo: dados.manterComProximo !== undefined ? dados.manterComProximo : (tipo === 'titulo' || tipo === 'subtitulo'),
    quebra_antes: !!dados.quebra_antes,
    ...(!ehTexto && dados.fonte ? { fonte: dados.fonte } : {}),
    ...(!ehTexto && dados.cor ? { cor: dados.cor } : {}),
    ...(!ehTexto && dados.fundo_ativo ? { fundo_ativo: dados.fundo_ativo, fundo_cor: dados.fundo_cor } : {}),
    ...(!ehTexto && dados.borda_tipo ? { borda_tipo: dados.borda_tipo } : {}),
    ...(!ehTexto && dados.marcador_tipo ? { marcador_tipo: dados.marcador_tipo } : {}),
    ...(!ehTexto && dados.entrelinha ? { entrelinha: dados.entrelinha } : {}),
    ...(!ehTexto && dados.espaco_antes_pt !== undefined ? { espaco_antes_pt: dados.espaco_antes_pt } : {}),
    ...(!ehTexto && dados.espaco_depois_pt !== undefined ? { espaco_depois_pt: dados.espaco_depois_pt } : {}),
    ...(!ehTexto && dados.recuo_primeira_linha_mm !== undefined ? { recuo_primeira_linha_mm: dados.recuo_primeira_linha_mm } : {}),
    ...(!ehTexto && dados.recuo_esquerdo_mm !== undefined ? { recuo_esquerdo_mm: dados.recuo_esquerdo_mm } : {}),
    ...(!ehTexto && dados.recuo_direito_mm !== undefined ? { recuo_direito_mm: dados.recuo_direito_mm } : {}),
    ...(!ehTexto && dados.espacamento_letras_em !== undefined ? { espacamento_letras_em: dados.espacamento_letras_em } : {}),
    ...(!ehTexto && dados.espacamento_palavras_em !== undefined ? { espacamento_palavras_em: dados.espacamento_palavras_em } : {}),
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
      b.texto = sanearHtmlTexto(dados.texto || 'Digite o texto aqui...');
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
      // classificação semântica ("Para que vai servir?"): define subtipo (prefixo + contador independente) e proporção padrão
      b.subtipo = ROTULOS_FIGURA[dados.subtipo] ? dados.subtipo : 'figura';
      if (PAPEIS_VALIDOS.includes(dados.semanticRole)) {
        const papel = obterPapelSemantico(dados.semanticRole);
        if (papel && !ROTULOS_FIGURA[dados.subtipo]) b.subtipo = papel.subtipo;
        b.semanticRole = dados.semanticRole;
        if (papel && dados.proporcao_imagem === undefined) dados = { ...dados, proporcao_imagem: papel.proporcao };
      } else {
        b.semanticRole = papelDoSubtipo(b.subtipo);
      }
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
      migrarBlocoFigura(b); // itens antigos (só `url`) viram image_url + content
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

/** Espaço antes/depois (pt) de um bloco de texto: o do estilo (só fragmentos de paginação ajustam). null para os demais tipos. */
export function margensTextoPt(bloco, estilos) {
  if (!bloco || !TIPOS_DE_TEXTO.includes(bloco.tipo)) return null;
  const est = estilos[bloco.estiloId] || (bloco.tipo === 'titulo' ? estilos[`titulo${Math.min(6, bloco.nivel || 1)}`] : null) || estilos.corpo || {};
  const aj = ajusteDeFragmento(bloco);
  return { antes: aj.espaco_antes_pt ?? est.espaco_antes_pt ?? 0, depois: aj.espaco_depois_pt ?? est.espaco_depois_pt ?? 0 };
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
  const medida = alturaMedidaDoBloco(bloco); // a altura medida na folha vale mais que a estimativa
  if (medida) return medida;
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
/**
 * Une blocos de parágrafo vizinhos (mesma seção, em sequência) no primeiro deles; os demais saem. O resultado fica com o
 * estilo do primeiro. modo 'continuo': um só texto corrido (junta com espaço quando não houver); 'linhas': cada bloco vira uma linha.
 * Devolve { bloco, removidos } ou null se não der para unir.
 */
export function unirBlocosTexto(doc, ids, modo = 'continuo') {
  const unicos = [...new Set(ids || [])];
  const locs = unicos.map(id => localizarBloco(doc, id));
  if (unicos.length < 2 || locs.some(l => !l)) return null;
  const sec = locs[0].sec;
  if (locs.some(l => l.sec !== sec || l.bloco.tipo !== 'paragrafo')) return null;
  locs.sort((a, b) => a.idx - b.idx);
  for (let i = 1; i < locs.length; i++) if (locs[i].idx !== locs[i - 1].idx + 1) return null; // só blocos em sequência
  const vazio = (t) => !String(t ?? '').replace(/&nbsp;|<br\s*\/?>|\s/gi, '');
  const textos = locs.map(l => String(l.bloco.texto ?? '')).filter(t => !vazio(t));
  const primeiro = locs[0].bloco;
  primeiro.texto = textos.reduce((acc, t, i) => {
    if (i === 0) return t;
    if (modo === 'linhas') return `${acc}<br>${t}`;
    const colar = /(\s|&nbsp;)$/i.test(acc) || /^(\s|&nbsp;)/i.test(t);
    return `${acc}${colar ? '' : ' '}${t}`;
  }, '') || '&nbsp;';
  const removidos = locs.slice(1).map(l => l.bloco.id);
  sec.blocos = sec.blocos.filter(b => !removidos.includes(b.id));
  repaginarDocumento(doc);
  return { bloco: primeiro, removidos };
}

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
