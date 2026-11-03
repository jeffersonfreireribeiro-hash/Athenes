// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Sistema Avançado de Tipografia, Estilos e Perfis Acadêmicos.
 * Inspiração: Controles tipográficos do Affinity Publisher e InDesign adaptados para a Web.
 */

import { cssAvancadoInline } from './athenes_estilo_avancado.js';

// Não congelado: as fontes importadas pelo usuário entram aqui em tempo de execução (athenes_fontes.js)
export const FONTES_SISTEMA = {
  nunito: {
    id: 'nunito',
    rotulo: 'Nunito (Glaux/Athenes)',
    familia: "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif",
    serif: false,
    incorporavel: true
  },
  times: {
    id: 'times',
    rotulo: 'Times New Roman',
    familia: "'Times New Roman', Times, serif",
    serif: true,
    incorporavel: true
  },
  arial: {
    id: 'arial',
    rotulo: 'Arial',
    familia: 'Arial, Helvetica, sans-serif',
    serif: false,
    incorporavel: true
  },
  georgia: {
    id: 'georgia',
    rotulo: 'Georgia',
    familia: 'Georgia, serif',
    serif: true,
    incorporavel: true
  },
  garamond: {
    id: 'garamond',
    rotulo: 'Garamond',
    familia: "Garamond, 'Times New Roman', serif",
    serif: true,
    incorporavel: true
  },
  cambria: {
    id: 'cambria',
    rotulo: 'Cambria',
    familia: "Cambria, 'Times New Roman', serif",
    serif: true,
    incorporavel: true
  },
  calibri: {
    id: 'calibri',
    rotulo: 'Calibri',
    familia: "Calibri, Carlito, 'Segoe UI', sans-serif",
    serif: false,
    incorporavel: true
  },
  aptos: {
    id: 'aptos',
    rotulo: 'Aptos (Microsoft 365)',
    // usa a Aptos instalada (Word/Office 365); sem ela, cai em fontes de aparência próxima. Para embutir, importe o arquivo em Fontes.
    familia: "Aptos, 'Aptos Display', 'Segoe UI Variable Text', 'Segoe UI', Calibri, sans-serif",
    serif: false,
    incorporavel: false
  },
  consolas: {
    id: 'consolas',
    rotulo: 'Consolas (Mono)',
    familia: "Consolas, 'Courier New', monospace",
    serif: false,
    incorporavel: true
  }
};

export const PESOS_FONTE = Object.freeze([
  { valor: 300, rotulo: '300 — Light' },
  { valor: 400, rotulo: '400 — Regular' },
  { valor: 600, rotulo: '600 — SemiBold' },
  { valor: 700, rotulo: '700 — Bold' },
  { valor: 800, rotulo: '800 — ExtraBold' },
  { valor: 900, rotulo: '900 — Black' }
]);

export const ALINHAMENTOS = Object.freeze([
  { id: 'esquerda', rotulo: 'À esquerda' },
  { id: 'centro', rotulo: 'Centralizado' },
  { id: 'direita', rotulo: 'À direita' },
  { id: 'justificado', rotulo: 'Justificado total' },
  { id: 'justificado_esquerda', rotulo: 'Justificado (última linha à esquerda)' },
  { id: 'justificado_centro', rotulo: 'Justificado (última linha centralizada)' },
  { id: 'justificado_direita', rotulo: 'Justificado (última linha à direita)' }
]);

/**
 * Perfis de formatação acadêmica e editorial pré-configurados
 */
export const PERFIS_FORMATACAO = Object.freeze({
  abnt: {
    id: 'abnt',
    nome: 'ABNT (NBR 14724 / 6023 / 10520)',
    descricao: 'Normas brasileiras para trabalhos acadêmicos, teses e relatórios técnicos.',
    pagina: {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 30, r: 20, b: 20, l: 30 }, // Superior 3cm, Esquerda 3cm, Inferior 2cm, Direita 2cm
      grade: { colunas: 1, gap_mm: 0 }
    },
    citacao: {
      sistema: 'autor-data', // ou 'numerico'
      caixa_alta_autor: true, // (SILVA, 2024)
      recuo_citacao_longa_mm: 40, // 4 cm
      tamanho_citacao_longa_pt: 10,
      entrelinha_citacao_longa: 1.0
    },
    numeracao: {
      iniciar_na_introducao: true,
      posicao: 'superior_direita'
    }
  },
  apa: {
    id: 'apa',
    nome: 'APA 7ª Edição',
    descricao: 'Padrão da American Psychological Association para artigos e periódicos.',
    pagina: {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 25.4, r: 25.4, b: 25.4, l: 25.4 }, // 1 polegada (2.54 cm)
      grade: { colunas: 1, gap_mm: 0 }
    },
    citacao: {
      sistema: 'autor-data',
      caixa_alta_autor: false, // (Silva, 2024)
      recuo_citacao_longa_mm: 12.7, // 0.5 polegada
      tamanho_citacao_longa_pt: 12,
      entrelinha_citacao_longa: 2.0
    },
    numeracao: {
      iniciar_na_introducao: false,
      posicao: 'superior_direita'
    }
  },
  ieee: {
    id: 'ieee',
    nome: 'IEEE (Conferências e Periódicos)',
    descricao: 'Modelo padrão para engenharia, computação e tecnologia em duas colunas.',
    pagina: {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 19, r: 14.3, b: 25.4, l: 14.3 },
      grade: { colunas: 2, gap_mm: 4.8 }
    },
    citacao: {
      sistema: 'numerico', // [1]
      caixa_alta_autor: false,
      recuo_citacao_longa_mm: 10,
      tamanho_citacao_longa_pt: 9,
      entrelinha_citacao_longa: 1.15
    },
    numeracao: {
      iniciar_na_introducao: false,
      posicao: 'inferior_centro'
    }
  },
  vancouver: {
    id: 'vancouver',
    nome: 'Vancouver (Área da Saúde e Biomédica)',
    descricao: 'Diretrizes do ICMJE para medicina e ciências da saúde.',
    pagina: {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 25, r: 25, b: 25, l: 25 },
      grade: { colunas: 1, gap_mm: 0 }
    },
    citacao: {
      sistema: 'numerico_sobrescrito', // ¹
      caixa_alta_autor: false,
      recuo_citacao_longa_mm: 15,
      tamanho_citacao_longa_pt: 10,
      entrelinha_citacao_longa: 1.2
    },
    numeracao: {
      iniciar_na_introducao: true,
      posicao: 'superior_direita'
    }
  },
  personalizado: {
    id: 'personalizado',
    nome: 'Perfil Personalizado',
    descricao: 'Ajuste livre de margens, colunas, tipografia e normas da sua instituição.',
    pagina: {
      formato: 'A4',
      orientacao: 'retrato',
      margens_mm: { t: 25, r: 20, b: 25, l: 25 },
      grade: { colunas: 1, gap_mm: 4 }
    },
    citacao: {
      sistema: 'autor-data',
      caixa_alta_autor: true,
      recuo_citacao_longa_mm: 30,
      tamanho_citacao_longa_pt: 10,
      entrelinha_citacao_longa: 1.15
    },
    numeracao: {
      iniciar_na_introducao: false,
      posicao: 'inferior_direita'
    }
  }
});

/**
 * Cria o conjunto padrão de estilos de texto para um documento.
 * Adaptado ao perfil selecionado (padrão: ABNT).
 */
export function criarEstilosPadrao(perfilId = 'abnt') {
  const p = PERFIS_FORMATACAO[perfilId] || PERFIS_FORMATACAO.abnt;
  const isAbnt = perfilId === 'abnt';
  const isApa = perfilId === 'apa';
  const isIeee = perfilId === 'ieee';

  const baseFonte = isAbnt ? 'nunito' : (isApa ? 'times' : (isIeee ? 'times' : 'nunito'));
  const baseCorpoPt = isIeee ? 10 : 12;
  const baseEntrelinha = isApa ? 2.0 : (isAbnt ? 1.5 : 1.15);

  return [
    {
      id: 'titulo1',
      nome: 'Título 1 (Seção Primária)',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: isAbnt ? 14 : (isIeee ? 18 : 16),
      peso: 800,
      cor: '#1F2733',
      italico: false,
      sublinhado: false,
      caixa_alta: isAbnt, // ABNT recomenda títulos primários em caixa alta
      alinhamento: isIeee ? 'centro' : 'esquerda',
      entrelinha: 1.2,
      espaco_antes_pt: 18,
      espaco_depois_pt: 8,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'titulo2',
      nome: 'Título 2 (Seção Secundária)',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: isAbnt ? 12 : (isIeee ? 13 : 13),
      peso: 700,
      cor: '#1F2733',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'esquerda',
      entrelinha: 1.25,
      espaco_antes_pt: 14,
      espaco_depois_pt: 6,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'titulo3',
      nome: 'Título 3 (Seção Terciária)',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: baseCorpoPt,
      peso: 600,
      cor: '#334155',
      italico: isAbnt, // ABNT admite itálico na terceira seção
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'esquerda',
      entrelinha: 1.3,
      espaco_antes_pt: 10,
      espaco_depois_pt: 4,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'titulo4',
      nome: 'Título 4 (Seção Quaternária)',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: baseCorpoPt,
      peso: 600,
      cor: '#334155',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'esquerda',
      entrelinha: 1.3,
      espaco_antes_pt: 8,
      espaco_depois_pt: 4,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'titulo5',
      nome: 'Título 5 (Seção Quinária)',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: baseCorpoPt,
      peso: 400,
      cor: '#334155',
      italico: true,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'esquerda',
      entrelinha: 1.3,
      espaco_antes_pt: 6,
      espaco_depois_pt: 3,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'titulo6',
      nome: 'Título 6 (Seção Senária)',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: baseCorpoPt,
      peso: 400,
      cor: '#475569',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'esquerda',
      entrelinha: 1.3,
      espaco_antes_pt: 6,
      espaco_depois_pt: 3,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'subtitulo',
      nome: 'Subtítulo do Documento',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: 13,
      peso: 600,
      cor: '#64748B',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'centro',
      entrelinha: 1.35,
      espaco_antes_pt: 6,
      espaco_depois_pt: 14,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'corpo',
      nome: 'Corpo de Texto',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: baseCorpoPt,
      peso: 400,
      cor: '#1F2733',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: isAbnt ? 'justificado' : 'justificado_esquerda',
      entrelinha: baseEntrelinha,
      espaco_antes_pt: 0,
      espaco_depois_pt: isAbnt ? 0 : 6, // ABNT usa recuo de 1ª linha sem espaço entre parágrafos
      recuo_primeira_linha_mm: isAbnt ? 12.5 : (isApa ? 12.7 : 0),
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: true,
      manter_com_proximo: false
    },
    {
      id: 'citacao_direta',
      nome: 'Citação Direta Longa',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: p.citacao.tamanho_citacao_longa_pt,
      peso: 400,
      cor: '#334155',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'justificado',
      entrelinha: p.citacao.entrelinha_citacao_longa,
      espaco_antes_pt: 8,
      espaco_depois_pt: 8,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: p.citacao.recuo_citacao_longa_mm, // 40 mm na ABNT
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: true,
      manter_com_proximo: false
    },
    {
      id: 'legenda',
      nome: 'Legenda de Figura / Tabela',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: 10,
      peso: 600,
      cor: '#475569',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'centro',
      entrelinha: 1.25,
      espaco_antes_pt: 6,
      espaco_depois_pt: 2,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: true
    },
    {
      id: 'fonte_citada',
      nome: 'Fonte da Ilustração / Tabela',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: 9,
      peso: 400,
      cor: '#64748B',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'centro',
      entrelinha: 1.2,
      espaco_antes_pt: 2,
      espaco_depois_pt: 8,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: false
    },
    {
      id: 'nota_rodape',
      nome: 'Nota de Rodapé',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: 9,
      peso: 400,
      cor: '#475569',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'justificado',
      entrelinha: 1.15,
      espaco_antes_pt: 2,
      espaco_depois_pt: 2,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: true,
      manter_com_proximo: false
    },
    {
      id: 'referencias',
      nome: 'Item de Referência Bibliográfica',
      tipo: 'paragrafo',
      fonte: baseFonte,
      tamanho_pt: baseCorpoPt,
      peso: 400,
      cor: '#1F2733',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: isAbnt ? 'esquerda' : 'justificado_esquerda', // ABNT exige referências alinhadas à margem esquerda
      entrelinha: 1.0, // ABNT: entrelinha simples entre as linhas da mesma referência
      espaco_antes_pt: 0,
      espaco_depois_pt: isAbnt ? 6 : 4, // ABNT: separadas por um espaço simples em branco
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 0,
      recuo_deslocado_mm: isApa ? 12.7 : 0, // APA usa hanging indent de 0.5 pol
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: false
    },
    {
      id: 'codigo',
      nome: 'Código / Algoritmo',
      tipo: 'paragrafo',
      fonte: 'nunito',
      tamanho_pt: 9.5,
      peso: 400,
      cor: '#0F172A',
      italico: false,
      sublinhado: false,
      caixa_alta: false,
      alinhamento: 'esquerda',
      entrelinha: 1.35,
      espaco_antes_pt: 6,
      espaco_depois_pt: 6,
      recuo_primeira_linha_mm: 0,
      recuo_esquerdo_mm: 6,
      recuo_deslocado_mm: 0,
      espacamento_letras_em: 0,
      hifenizacao: false,
      manter_com_proximo: false
    }
  ];
}

/**
 * Converte um estilo de texto em propriedades CSS para exibição inline na folha
 */
/**
 * Somente a TIPOGRAFIA de um estilo de texto (fonte, tamanho, peso, cor, itálico, caixa alta, entrelinha,
 * espaçamento de letras/palavras). Serve a conteúdos que têm layout próprio, como as células de uma tabela:
 * alinhamento, margens, recuos e fundo do estilo não se aplicam.
 */
/**
 * Altura da linha "simples" (entrelinha 1) de cada fonte do Word, em múltiplos do tamanho do corpo (ascent + descent + lineGap).
 * No Word, "entrelinha 1" é essa altura, não 1,0× o corpo: com line-height CSS cru (1,0) as linhas ficavam mais apertadas que no Word
 * e a seleção de texto se sobrepunha. Fontes fora da lista (Nunito, importadas) seguem o valor cru, como sempre foi.
 */
export const FATOR_LINHA_SIMPLES = Object.freeze({ times: 1.149, arial: 1.149, georgia: 1.136, garamond: 1.12, cambria: 1.172, calibri: 1.22, aptos: 1.22, consolas: 1.17 });

/** Entrelinha em múltiplos do corpo para o CSS e para a estimativa de altura (valor do estilo × altura da linha simples da fonte). */
export function entrelinhaEfetiva(estilo, padrao = 1.5) {
  const valor = Number(estilo?.entrelinha) || padrao;
  return Math.round(valor * (FATOR_LINHA_SIMPLES[estilo?.fonte] || 1) * 1000) / 1000;
}

export function estiloParaCssTipografia(estilo) {
  if (!estilo) return '';
  const f = FONTES_SISTEMA[estilo.fonte] || FONTES_SISTEMA.nunito;
  const p = [
    `font-family: ${f.familia}`,
    `font-size: ${estilo.tamanho_pt || 11}pt`,
    `font-weight: ${estilo.peso || 400}`,
    `color: ${estilo.cor || '#1F2733'}`,
    `line-height: ${entrelinhaEfetiva(estilo)}`
  ];
  if (estilo.italico) p.push('font-style: italic');
  if (estilo.caixa_alta) p.push('text-transform: uppercase');
  if (estilo.espacamento_letras_em) p.push(`letter-spacing: ${estilo.espacamento_letras_em}em`);
  if (estilo.espacamento_palavras_em) p.push(`word-spacing: ${estilo.espacamento_palavras_em}em`);
  return p.join('; ') + ';';
}

/** Estilo do prefixo de numeração ("Tabela 1 —"): tipografia do estilo, sem layout de bloco. */
export function estiloParaCssNumeracao(estilo) {
  return estilo ? `${estiloParaCssTipografia(estilo)} display: inline; margin: 0; padding: 0; text-indent: 0;` : '';
}

/** Localiza um estilo de texto por id (null se `id` vazio ou inexistente). */
export function localizarEstilo(estilos, id) {
  if (!id || !Array.isArray(estilos)) return null;
  return estilos.find(e => e.id === id) || null;
}

const ALINHAMENTO_BLOCO_CSS = {
  esquerda: 'left', left: 'left', centro: 'center', center: 'center', direita: 'right', right: 'right',
  justificado: 'justify', justificado_esquerda: 'justify', justify: 'justify'
};

/**
 * CSS COMPLETO de um estilo de texto (fonte, tamanho, peso, cor, itálico, caixa alta, entrelinha, recuos,
 * espaçamentos, fundo, hifenização…) mais o alinhamento explícito do bloco, que vence o do estilo.
 * `alinhamento`: 'estilo' | vazio (usa o do estilo) | left | center | right | justify (aceita também pt-BR).
 * Sem estilo, devolve apenas o alinhamento explícito (se houver).
 */
export function estiloParaCssComAlinhamento(estilo, alinhamento) {
  let css = estilo ? estiloParaCss(estilo) : '';
  const norm = ALINHAMENTO_BLOCO_CSS[alinhamento];
  if (norm) {
    css += norm === 'justify' ? ' text-align: justify; text-align-last: auto;' : ` text-align: ${norm}; text-align-last: ${norm};`;
  }
  return css.trim();
}

export function estiloParaCss(estilo, fontesDisponiveis = FONTES_SISTEMA) {
  if (!estilo) return '';

  const f = fontesDisponiveis[estilo.fonte] || FONTES_SISTEMA.nunito;
  const familiaCss = f.familia || 'sans-serif';

  const props = [];
  props.push(`font-family: ${familiaCss};`);
  props.push(`font-size: ${estilo.tamanho_pt || 11}pt;`);
  props.push(`font-weight: ${estilo.peso || 400};`);
  props.push(`color: ${estilo.cor || '#1F2733'};`);

  if (estilo.italico) props.push('font-style: italic;');
  if (estilo.sublinhado) props.push('text-decoration: underline;');
  if (estilo.caixa_alta) props.push('text-transform: uppercase;');

    // Alinhamento
  if (estilo.alinhamento === 'centro') {
    props.push('text-align: center; text-align-last: center;');
  } else if (estilo.alinhamento === 'direita') {
    props.push('text-align: right; text-align-last: right;');
  } else if (estilo.alinhamento === 'justificado') {
    props.push('text-align: justify; text-align-last: auto;');
  } else if (estilo.alinhamento === 'justificado_esquerda') {
    props.push('text-align: justify; text-align-last: left;');
  } else if (estilo.alinhamento === 'justificado_centro') {
    props.push('text-align: justify; text-align-last: center;');
  } else if (estilo.alinhamento === 'justificado_direita') {
    props.push('text-align: justify; text-align-last: right;');
  } else {
    props.push('text-align: left; text-align-last: left;');
  }

  // Entrelinha
  props.push(`line-height: ${entrelinhaEfetiva(estilo)};`);

  // Espaçamentos verticais
  if (estilo.espaco_antes_pt) props.push(`margin-top: ${estilo.espaco_antes_pt}pt;`);
  if (estilo.espaco_depois_pt) { props.push(`margin-bottom: ${estilo.espaco_depois_pt}pt;`); props.push(`--ath-bloco-gap: ${estilo.espaco_depois_pt}pt;`); }
  if (estilo.espaco_paragrafos_pt !== undefined) { props.push(`--ath-paragrafo-gap: ${estilo.espaco_paragrafos_pt}pt;`); }

  // Recuos horizontais
  if (estilo.recuo_primeira_linha_mm) {
    props.push(`text-indent: ${estilo.recuo_primeira_linha_mm}mm;`);
  }
  if (estilo.recuo_esquerdo_mm) {
    props.push(`margin-left: ${estilo.recuo_esquerdo_mm}mm;`);
  }
  if (estilo.recuo_deslocado_mm) {
    // Hanging indent (recuo francês)
    props.push(`padding-left: ${estilo.recuo_deslocado_mm}mm; text-indent: -${estilo.recuo_deslocado_mm}mm;`);
  }

  // Kerning / Tracking
  if (estilo.espacamento_letras_em) {
    props.push(`letter-spacing: ${estilo.espacamento_letras_em}em;`);
  }
  if (estilo.espacamento_palavras_em) {
    props.push(`word-spacing: ${estilo.espacamento_palavras_em}em;`);
  }
  if (estilo.fundo_cor) {
    props.push(`background-color: ${estilo.fundo_cor}; padding: 3px 6px; border-radius: 4px; display: inline-block; box-decoration-break: clone; -webkit-box-decoration-break: clone;`);
  }
  if (estilo.borda_tipo === 'tachado') {
    props.push('text-decoration: line-through;');
  } else if (estilo.borda_tipo === 'inferior') {
    props.push('border-bottom: 2px solid currentColor; padding-bottom: 3px; display: inline-block;');
  } else if (estilo.borda_tipo === 'caixa') {
    props.push('border: 1px solid var(--ath-primary-line, #C8D7E6); padding: 4px 8px; border-radius: 6px; display: inline-block;');
  }

  // Hifenização
  if (estilo.hifenizacao) {
    props.push('hyphens: auto; -webkit-hyphens: auto; -ms-hyphens: auto; hyphenate-limit-chars: 4 2 2; -webkit-hyphenate-limit-before: 2; -webkit-hyphenate-limit-after: 2; hyphenate-limit-lines: 3; overflow-wrap: break-word;');
  } else if (estilo.hifenizacao === false) {
    props.push('hyphens: manual; -webkit-hyphens: manual; -ms-hyphens: manual;');
  }

  // Regra editorial para não quebrar títulos no fim de página
  if (estilo.manter_com_proximo) {
    props.push('break-after: avoid; page-break-after: avoid;');
  }

  // Recuo direito, barra lateral e fundo de bloco (estilos de parágrafo avançados)
  const avancado = cssAvancadoInline(estilo);
  if (avancado) props.push(avancado);

  return props.join(' ');
}


export function alinhamentoCss(valor, padrao = 'left') {
  const map = {
    esquerda: 'left',
    centro: 'center',
    direita: 'right',
    justificado: 'justify',
    justificado_esquerda: 'justify',
    justificado_centro: 'justify',
    justificado_direita: 'justify'
  };
  return map[valor] || padrao;
}

/** Estilos que o documento não vive sem: o corpo é o destino dos blocos de um estilo excluído. */
export const ESTILOS_PROTEGIDOS = Object.freeze(['corpo']);

const ehChaveDeEstilo = (k) => k === 'estiloId' || /_estilo_id$/.test(k);
function paraCadaBloco(doc, fn) {
  for (const sec of doc?.secoes || []) for (const b of sec.blocos || []) fn(b);
  for (const b of doc?.modelos_blocos || []) fn(b);
}

/** Quantos blocos usam o estilo (como estilo do bloco ou como estilo de título/legenda/fonte/numeração/dados). */
export function contarUsoDoEstilo(doc, id) {
  let n = 0;
  paraCadaBloco(doc, (b) => { if (Object.keys(b).some(k => ehChaveDeEstilo(k) && b[k] === id)) n++; });
  return n;
}

/**
 * Exclui um estilo do documento. Blocos que o usavam passam a usar o título do mesmo nível (se for título) ou o Corpo;
 * referências auxiliares (`titulo_estilo_id`, `legenda_estilo_id`…) são removidas e voltam ao padrão do bloco.
 * Devolve { ok, reatribuidos, substituto } ou { ok:false, motivo }.
 */
export function excluirEstilo(doc, id) {
  if (!doc || !Array.isArray(doc.estilos)) return { ok: false, motivo: 'documento' };
  if (ESTILOS_PROTEGIDOS.includes(id)) return { ok: false, motivo: 'protegido' };
  const idx = doc.estilos.findIndex(e => e.id === id);
  if (idx < 0) return { ok: false, motivo: 'inexistente' };
  doc.estilos.splice(idx, 1);
  doc.estilos_excluidos = [...new Set([...(doc.estilos_excluidos || []), id])];
  const base = (doc.estilos.find(e => e.id === 'corpo') || doc.estilos[0])?.id || '';
  let reatribuidos = 0;
  paraCadaBloco(doc, (b) => {
    let tocou = false;
    for (const k of Object.keys(b)) {
      if (!ehChaveDeEstilo(k) || b[k] !== id) continue;
      if (k === 'estiloId') {
        const doNivel = b.tipo === 'titulo' ? `titulo${Math.min(6, Number(b.nivel) || 1)}` : '';
        b.estiloId = doNivel && doc.estilos.some(e => e.id === doNivel) ? doNivel : base;
      } else delete b[k];
      tocou = true;
    }
    if (tocou) reatribuidos++;
  });
  return { ok: true, reatribuidos, substituto: base };
}

/** Garante os estilos Título 4–6 em documentos criados antes do suporte a seções profundas (não altera os existentes). */
export function garantirEstilosDeTitulos(doc) {
  if (!doc || !Array.isArray(doc.estilos)) return doc;
  const ids = new Set(doc.estilos.map(e => e.id));
  const padrao = criarEstilosPadrao(doc.perfil || 'abnt');
  const maiorNivel = Math.max(0, ...(doc.secoes || []).flatMap(s => s.blocos || []).filter(b => b.tipo === 'titulo').map(b => Number(b.nivel) || 0));
  for (const n of [4, 5, 6]) {
    const excluido = (doc.estilos_excluidos || []).includes(`titulo${n}`); // o usuário apagou de propósito: não recriar
    if ((!doc.estilos_minimos || n <= maiorNivel) && !ids.has(`titulo${n}`) && !excluido) {
      const e = padrao.find(x => x.id === `titulo${n}`);
      if (e) doc.estilos.push(JSON.parse(JSON.stringify(e)));
    }
  }
  return doc;
}
