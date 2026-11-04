// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Documento: identificadores e rótulos básicos (gerarId, ROTULOS_FIGURA, rotuloDaFigura).
 * Extraído de athenes_documento.js (que continua exportando tudo o que exportava).
 */

let contadorId = 0;

export const gerarId = prefixo => `${prefixo || 'b'}_${Date.now().toString(36)}_${(contadorId++).toString(36)}`;

/** Família "Figura": cada subtipo tem rótulo, numeração e lista próprios (ex.: Gráfico 1, Figura 1). */
export const ROTULOS_FIGURA = Object.freeze({
  figura: 'Figura',
  grafico: 'Gráfico',
  fotografia: 'Fotografia',
  diagrama: 'Diagrama',
  fluxograma: 'Fluxograma',
  esquema: 'Esquema',
  quadro: 'Quadro', // quadro visual por código: divide o contador (e a lista) com os quadros de texto
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
