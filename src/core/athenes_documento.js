// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modelo de Dados do Documento, Páginas Mestras, Seções e Blocos.
 * Arquitetura declarativa e reativa com repaginação automática e fluxo contínuo.
 */

import { criarEstilosPadrao, PERFIS_FORMATACAO } from './athenes_estilos.js';

let contadorId = 0;
export const gerarId = prefixo => `${prefixo || 'b'}_${Date.now().toString(36)}_${(contadorId++).toString(36)}`;

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
    quebra_antes: !!dados.quebra_antes
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
      b.estiloId = 'citacao_direta';
      break;

    case 'figura':
      b.tipo = 'figura';
      b.titulo = dados.titulo || 'Figura 1 — Descrição detalhada da ilustração';
      b.layout = dados.layout || '1'; // '1', '2_lado', '2_empilhado', '3_linha', '3_misto', '4_grade', '6_grade'
      b.itens = Array.isArray(dados.itens) ? dados.itens : [
        { id: gerarId('fig_item'), url: dados.src || dados.url || '', legenda_sub: 'Visão geral' }
      ];
      b.legenda_geral = dados.legenda_geral || dados.legenda || 'Legenda explicativa dos elementos representados.';
      b.fonte = dados.fonte || 'Fonte: Autores (2026).';
      b.numero_sequencial = dados.numero_sequencial || 1;
      b.largura_pct = dados.largura_pct || 90;
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
      b.numero_sequencial = dados.numero_sequencial || 1;
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
      b.numero_sequencial = dados.numero_sequencial || 1;
      break;

    case 'imagem':
      b.src = dados.src || '';
      b.legenda = dados.legenda || 'Figura 1 — Legenda descritiva da imagem';
      b.fonte = dados.fonte || 'Fonte: Arquivo da pesquisa.';
      b.largura_pct = dados.largura_pct || 80;
      b.altura_mm = dados.altura_mm || 60;
      b.numero_sequencial = dados.numero_sequencial || 1;
      break;

    case 'nota':
      b.numero = dados.numero || 1;
      b.texto = dados.texto || 'Texto explicativo da nota de rodapé.';
      break;

    case 'formula':
      b.latex = dados.latex || dados.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx';
      b.formula = b.latex;
      b.numero_equacao = dados.numero_equacao || dados.numero || '(1)';
      b.numero = b.numero_equacao;
      b.alinhamento = dados.alinhamento || 'centro';
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
export function estimarAlturaBlocoPt(bloco) {
  if (!bloco) return 20;

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
      return 220;

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

  for (let sIdx = 0; sIdx < doc.secoes.length; sIdx++) {
    const sec = doc.secoes[sIdx];
    const mestra = doc.mestras.find(m => m.id === sec.mestraId) || doc.mestras[0];
    const blocosDaSecao = Array.isArray(sec.blocos) ? sec.blocos : [];

    // Altura útil da folha A4 em pontos tipográficos
    const paisagem = mestra.orientacao === 'paisagem';
    const alturaFolhaMm = paisagem ? 210 : 297;
    const margens = mestra.margens_mm || mestra.margens || { t: 30, b: 20, l: 30, r: 20 };
    const espacoCabecalhoMm = mestra.cabecalho?.ativo ? 12 : 0;
    const espacoRodapeMm = mestra.rodape?.ativo ? 10 : 0;
    const alturaUtilMm = Math.max(100, alturaFolhaMm - (margens.t + margens.b + espacoCabecalhoMm + espacoRodapeMm));
    const alturaUtilPt = alturaUtilMm * 2.83465;

    if (mestra.modo_aplicacao === MODOS_APLICACAO_MESTRA.FIXA) {
      // PÁGINA FIXA: gera exatamente 1 página (ou respeita quebra_pagina explícita)
      let blocosPagAtual = [];
      let numNaSecao = 1;

      for (let bIdx = 0; bIdx < blocosDaSecao.length; bIdx++) {
        const b = blocosDaSecao[bIdx];
        if (b.tipo === 'quebra_pagina' && blocosPagAtual.length > 0) {
          paginasCalculadas.push({
            id: gerarId('pg'),
            secaoId: sec.id,
            mestraId: mestra.id,
            modeloId: mestra.id,
            numero: contadorPaginaGlobal++,
            numeroNaSecao: numNaSecao++,
            origemFluxo: 'fixa',
            blocos: blocosPagAtual
          });
          blocosPagAtual = [];
        } else if (b.tipo !== 'quebra_pagina') {
          blocosPagAtual.push(b);
        }
      }

      paginasCalculadas.push({
        id: gerarId('pg'),
        secaoId: sec.id,
        mestraId: mestra.id,
        modeloId: mestra.id,
        numero: contadorPaginaGlobal++,
        numeroNaSecao: numNaSecao,
        origemFluxo: 'fixa',
        blocos: blocosPagAtual
      });

    } else {
      // PÁGINA PROGRESSIVA: Repagina e flui blocos automaticamente
      let alturaAcumuladaPt = 0;
      let blocosPagAtual = [];
      let numNaSecao = 1;

      for (let bIdx = 0; bIdx < blocosDaSecao.length; bIdx++) {
        const b = blocosDaSecao[bIdx];

        if (b.tipo === 'quebra_pagina') {
          if (blocosPagAtual.length > 0) {
            paginasCalculadas.push({
              id: gerarId('pg'),
              secaoId: sec.id,
              mestraId: mestra.id,
              modeloId: mestra.id,
              numero: contadorPaginaGlobal++,
              numeroNaSecao: numNaSecao++,
              origemFluxo: numNaSecao === 2 ? 'progressiva_raiz' : 'fluxo_automatico',
              blocos: blocosPagAtual
            });
            blocosPagAtual = [];
            alturaAcumuladaPt = 0;
          }
          continue;
        }

        // Blocos da mesma linha (grupo) ficam juntos: só o primeiro decide a quebra
        const anterior = bIdx > 0 ? blocosDaSecao[bIdx - 1] : null;
        if (b.grupo && anterior && anterior.grupo === b.grupo && blocosPagAtual[blocosPagAtual.length - 1] === anterior) {
          blocosPagAtual.push(b);
          continue;
        }
        const altPt = alturaDaLinha(blocosDaSecao, bIdx);

        // Regra manterComProximo: título não pode ficar no fim da folha sem espaço para o próximo bloco
        let exigeNovaPagina = false;
        if (b.manterComProximo && (alturaAcumuladaPt + altPt + 60 > alturaUtilPt) && blocosPagAtual.length > 0) {
          exigeNovaPagina = true;
        } else if (alturaAcumuladaPt + altPt > alturaUtilPt && blocosPagAtual.length > 0) {
          exigeNovaPagina = true;
        }

        if (exigeNovaPagina) {
          paginasCalculadas.push({
            id: gerarId('pg'),
            secaoId: sec.id,
            mestraId: mestra.id,
            modeloId: mestra.id,
            numero: contadorPaginaGlobal++,
            numeroNaSecao: numNaSecao++,
            origemFluxo: numNaSecao === 2 ? 'progressiva_raiz' : 'fluxo_automatico',
            blocos: blocosPagAtual
          });
          blocosPagAtual = [b];
          alturaAcumuladaPt = altPt;
        } else {
          blocosPagAtual.push(b);
          alturaAcumuladaPt += altPt;
        }
      }

      // Última página da seção progressiva
      paginasCalculadas.push({
        id: gerarId('pg'),
        secaoId: sec.id,
        mestraId: mestra.id,
        modeloId: mestra.id,
        numero: contadorPaginaGlobal++,
        numeroNaSecao: numNaSecao,
        origemFluxo: numNaSecao === 1 ? 'progressiva_raiz' : 'fluxo_automatico',
        blocos: blocosPagAtual
      });
    }
  }

  doc.paginas = paginasCalculadas;
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
 * Gera sumário dinâmico baseado nos títulos das páginas
 */
export function gerarSumarioDinamico(doc) {
  if (!doc || !Array.isArray(doc.paginas)) return [];

  const itens = [];
  for (const pag of doc.paginas) {
    if (pag.mestraId === 'capa' || pag.modeloId === 'capa' || pag.mestraId === 'sumario' || pag.modeloId === 'sumario') {
      continue;
    }
    const blocos = Array.isArray(pag.blocos) ? pag.blocos : [];
    for (const b of blocos) {
      if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
        itens.push({
          id: b.id,
          nivel: b.nivel || 1,
          texto: b.texto || 'Seção',
          pagina: pag.numero || 1
        });
      }
    }
  }

  return itens;
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
      if (b.tipo === 'tabela') totalTabelas++;
      if (b.tipo === 'imagem') totalImagens++;
      if (b.tipo === 'citacao') totalCitacoes++;
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
export function recalcularNumeracaoAutomatica(doc) {
  if (!doc || !Array.isArray(doc.secoes)) return { figuras: 0, mapas: 0, tabelas: 0, quadros: 0, formulas: 0 };

  let contFiguras = 0;
  let contMapas = 0;
  let contTabelas = 0;
  let contQuadros = 0;
  let contFormulas = 0;

  for (const sec of doc.secoes) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'figura' || b.tipo === 'imagem') {
        contFiguras++;
        b.numero_sequencial = contFiguras;
        if (b.titulo && /^Figura\s+\d+\s*[-—]/i.test(b.titulo)) {
          b.titulo = b.titulo.replace(/^Figura\s+\d+\s*[-—]/i, `Figura ${contFiguras} —`);
        } else if (b.legenda && /^Figura\s+\d+\s*[-—]/i.test(b.legenda)) {
          b.legenda = b.legenda.replace(/^Figura\s+\d+\s*[-—]/i, `Figura ${contFiguras} —`);
        }
      } else if (b.tipo === 'mapa') {
        contMapas++;
        b.numero_sequencial = contMapas;
        if (b.titulo && /^Mapa\s+\d+\s*[-—]/i.test(b.titulo)) {
          b.titulo = b.titulo.replace(/^Mapa\s+\d+\s*[-—]/i, `Mapa ${contMapas} —`);
        }
      } else if (b.tipo === 'tabela') {
        contTabelas++;
        b.numero_sequencial = contTabelas;
        if (b.titulo && /^Tabela\s+\d+\s*[-—]/i.test(b.titulo)) {
          b.titulo = b.titulo.replace(/^Tabela\s+\d+\s*[-—]/i, `Tabela ${contTabelas} —`);
        }
      } else if (b.tipo === 'quadro') {
        contQuadros++;
        b.numero_sequencial = contQuadros;
        if (b.titulo && /^Quadro\s+\d+\s*[-—]/i.test(b.titulo)) {
          b.titulo = b.titulo.replace(/^Quadro\s+\d+\s*[-—]/i, `Quadro ${contQuadros} —`);
        }
      } else if (b.tipo === 'formula') {
        contFormulas++;
        b.numero_sequencial = contFormulas;
        b.numero_equacao = `(${contFormulas})`;
        b.numero = b.numero_equacao;
      }
    }
  }

  return {
    figuras: contFiguras,
    mapas: contMapas,
    tabelas: contTabelas,
    quadros: contQuadros,
    formulas: contFormulas
  };
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

export function gerarListaFiguras(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'figura' || b.tipo === 'imagem') {
        lista.push({
          id: b.id,
          tipo: 'figura',
          numero: b.numero_sequencial || 1,
          rotulo: `Figura ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || b.legenda || 'Ilustração').replace(/^Figura\s+\d+\s*[-—]\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

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
          titulo: (b.titulo || 'Mapa').replace(/^Mapa\s+\d+\s*[-—]\s*/i, ''),
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
          titulo: (b.titulo || 'Tabela').replace(/^Tabela\s+\d+\s*[-—]\s*/i, ''),
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
          titulo: (b.titulo || 'Quadro').replace(/^Quadro\s+\d+\s*[-—]\s*/i, ''),
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
    for (const b of sec.blocos || []) {
      mapaBlocos.set(b.id, b);
    }
  }

  return texto.replace(/\[ref:(figura|mapa|tabela|quadro|formula|equacao):([a-zA-Z0-9_-]+)\]/gi, (match, tipo, id) => {
    const b = mapaBlocos.get(id);
    if (!b) return match;
    const num = b.numero_sequencial || 1;
    switch (tipo.toLowerCase()) {
      case 'figura': return `Figura ${num}`;
      case 'mapa': return `Mapa ${num}`;
      case 'tabela': return `Tabela ${num}`;
      case 'quadro': return `Quadro ${num}`;
      case 'formula':
      case 'equacao': return `Equação (${num})`;
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

function alturaDaLinha(blocos, inicio) {
  const primeiro = blocos[inicio];
  let altura = estimarAlturaBlocoPt(primeiro);
  if (!primeiro.grupo) return altura;
  for (let i = inicio + 1; i < blocos.length && blocos[i].grupo === primeiro.grupo; i++) {
    altura = Math.max(altura, estimarAlturaBlocoPt(blocos[i]));
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
