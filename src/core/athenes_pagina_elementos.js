// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Documento: formato do número da página e elementos das páginas mestras.
 * Extraído de athenes_documento.js (que continua exportando tudo o que exportava).
 */

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
