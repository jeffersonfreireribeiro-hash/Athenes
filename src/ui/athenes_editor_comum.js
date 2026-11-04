// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor: constantes e funções pequenas usadas pelo EditorView e pelos módulos que o compõem
 * (barra contextual, menus do topo, desenho do bloco na folha).
 */

export const TIPO_ROTULO = {
  titulo: 'Título', subtitulo: 'Subtítulo', paragrafo: 'Texto', citacao: 'Citação', tabela: 'Tabela',
  quadro: 'Quadro', figura: 'Figura', imagem: 'Figura', mapa: 'Mapa', formula: 'Fórmula',
  campos: 'Campos (rótulo e valor)', nota: 'Nota', divisor: 'Divisor', espaco: 'Espaçamento',
  anexo: 'Anexo', sumario: 'Sumário', referencias: 'Referências', quebra_pagina: 'Quebra de página', lista: 'Lista'
};

const ALINHAMENTO_CSS = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'justify' };
export function alinhamentoCss(valor, padrao) {
  return ALINHAMENTO_CSS[valor] || padrao;
}
