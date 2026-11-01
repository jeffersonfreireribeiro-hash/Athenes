// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Motor Matemático de Grid, Colunas, Páginas e Réguas.
 * Lógica modular herdada e expandida do Clux.js e das Pranchas Desk.
 */

export const FORMATOS_PAPEL = Object.freeze({
  A4: { nome: 'A4', w_mm: 210, h_mm: 297 },
  Letter: { nome: 'Carta (Letter)', w_mm: 215.9, h_mm: 279.4 },
  A3: { nome: 'A3', w_mm: 297, h_mm: 420 },
  Executive: { nome: 'Executivo', w_mm: 184.1, h_mm: 266.7 },
  Personalizado: { nome: 'Personalizado', w_mm: 210, h_mm: 297 }
});

// Fatores de conversão de unidades
export const MM_PARA_PT = 72 / 25.4; // ~2.8346 pt por mm
export const PT_PARA_MM = 25.4 / 72; // ~0.3528 mm por pt
export const MM_PARA_DXA = 56.7;     // dxa utilizado no Office Open XML (Word)
export const MM_PARA_PX_96DPI = 96 / 25.4; // ~3.7795 px por mm a 96 DPI

/**
 * Retorna as dimensões físicas da folha em mm (já orientada)
 */
export function dimensoesPapelMm(formato = 'A4', orientacao = 'retrato', personal = null) {
  const f = FORMATOS_PAPEL[formato] || FORMATOS_PAPEL.A4;
  let w = f.w_mm;
  let h = f.h_mm;

  if (formato === 'Personalizado' && personal) {
    w = Number(personal.w_mm) || 210;
    h = Number(personal.h_mm) || 297;
  }

  if (orientacao === 'paisagem') {
    return {
      largura_mm: Math.max(w, h),
      altura_mm: Math.min(w, h)
    };
  }

  return {
    largura_mm: Math.min(w, h),
    altura_mm: Math.max(w, h)
  };
}

/**
 * Calcula a área útil (dentro das margens) de uma página
 */
export function calcularAreaUtilMm(modelo) {
  const { largura_mm, altura_mm } = dimensoesPapelMm(
    modelo.formato,
    modelo.orientacao,
    modelo.dimensoes_personalizadas
  );

  const m = modelo.margens_mm || { t: 25, r: 20, b: 25, l: 25 };
  const top = Number(m.t) || 0;
  const right = Number(m.r) || 0;
  const bottom = Number(m.b) || 0;
  const left = Number(m.l) || 0;

  const largura_util = Math.max(10, largura_mm - left - right);
  const altura_util = Math.max(10, altura_mm - top - bottom);

  return {
    papel_w: largura_mm,
    papel_h: altura_mm,
    margens: { top, right, bottom, left },
    largura_util,
    altura_util
  };
}

/**
 * Calcula as colunas e larguras de blocos da grade
 */
export function calcularGrade(modelo, colunasDesejadas = null, gapDesejado = null) {
  const area = calcularAreaUtilMm(modelo);
  const colunas = Math.max(1, Math.min(12, colunasDesejadas || modelo.grade?.colunas || 1));
  const gap_mm = Number(gapDesejado !== null ? gapDesejado : (modelo.grade?.gap_mm ?? 4));

  const totalGaps = (colunas - 1) * gap_mm;
  const larguraColuna = Math.max(1, (area.largura_util - totalGaps) / colunas);

  return {
    ...area,
    colunas,
    gap_mm,
    largura_coluna_mm: Math.round(larguraColuna * 100) / 100,

    /**
     * Calcula a largura milimétrica de um bloco que ocupa `span` colunas
     */
    larguraBlocoMm(span = 1) {
      const s = Math.max(1, Math.min(colunas, span));
      const w = s * larguraColuna + (s - 1) * gap_mm;
      return Math.round(w * 10) / 10;
    },

    /**
     * Calcula a posição X milimétrica (relativa à margem esquerda) da coluna
     */
    posicaoXColunaMm(col = 1) {
      const c = Math.max(1, Math.min(colunas, col));
      const x = (c - 1) * (larguraColuna + gap_mm);
      return Math.round(x * 10) / 10;
    }
  };
}

/**
 * Aplica encaixe magnético (snap) para valores milimétricos com base no grid e guias
 */
export function aplicarSnap(valorMm, pontosSnapMm = [], toleranciaMm = 2.0) {
  let maisProximo = valorMm;
  let menorDistancia = toleranciaMm;

  for (const ponto of pontosSnapMm) {
    const dist = Math.abs(valorMm - ponto);
    if (dist < menorDistancia) {
      menorDistancia = dist;
      maisProximo = ponto;
    }
  }

  return {
    valor: maisProximo,
    encaixou: menorDistancia < toleranciaMm
  };
}

/**
 * Gera lista de posições X das colunas para réguas e guias magnéticas
 */
export function pontosSnapHorizontais(grade) {
  const pontos = [0, grade.largura_util]; // bordas da área útil
  for (let c = 1; c <= grade.colunas; c++) {
    const xInicio = grade.posicaoXColunaMm(c);
    const xFim = xInicio + grade.largura_coluna_mm;
    pontos.push(xInicio);
    pontos.push(xFim);
  }
  return [...new Set(pontos)].sort((a, b) => a - b);
}
