// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Módulo Canônico de Separação Silábica e Hifenização Editorial (Português do Brasil).
 * Aplica regras fonológicas e morfológicas para permitir quebra de linha com hífen
 * nos limites corretos da tipografia acadêmica (ABNT / Academia Brasileira de Letras).
 */

export const SOFT_HYPHEN = '\u00AD';

const VOGAIS = 'aáàãâeéêiíyyoóõôuúüAÁÀÃÂEÉÊIÍYYOÓÕÔUÚÜ';
const ehVogal = (c) => Boolean(c && VOGAIS.includes(c));
const ehConsoante = (c) => Boolean(c && /[a-zA-ZçÇ]/.test(c) && !VOGAIS.includes(c));

const DIGRAFOS_INSEPARAVEIS = [
  'ch', 'lh', 'nh', 'qu', 'gu',
  'bl', 'cl', 'fl', 'gl', 'pl', 'tl',
  'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'vr'
];

const DIGRAFOS_SEPARAVEIS = ['rr', 'ss', 'sc', 'sç', 'xc', 'xs'];

/**
 * Divide uma palavra em sílabas segundo a norma culta da Língua Portuguesa.
 * @param {string} palavra - Palavra a ser silabada
 * @returns {string[]} Array com as sílabas da palavra
 */
export function silabarPalavraPt(palavra) {
  if (!palavra || typeof palavra !== 'string') return [palavra || ''];
  const limpa = palavra.replace(/\u00AD/g, '');
  if (limpa.length < 5) return [limpa];

  const pontos = [];
  const n = limpa.length;

  for (let i = 0; i < n - 1; i++) {
    const c1 = limpa[i];
    const c2 = limpa[i + 1];
    const c3 = i + 2 < n ? limpa[i + 2] : '';
    const par = (c1 + c2).toLowerCase();

    // 1. Dígrafos separáveis: rr, ss, sc, sç, xc, xs -> corta no meio
    if (DIGRAFOS_SEPARAVEIS.includes(par)) {
      pontos.push(i + 1);
      continue;
    }

    // 2. Vogal + Consoante + Vogal -> corta após a primeira vogal (ex: re-la-tó-rio, fa-ci-li-da-de)
    if (ehVogal(c1) && ehConsoante(c2) && ehVogal(c3)) {
      pontos.push(i + 1);
      continue;
    }

    // 3. Vogal + Encontro Inseparável + Vogal -> corta antes do encontro (ex: es-cri-ta, dia-gra-ma, bi-blio)
    if (ehVogal(c1) && DIGRAFOS_INSEPARAVEIS.some(d => (c2 + c3).toLowerCase() === d)) {
      const c4 = i + 3 < n ? limpa[i + 3] : '';
      if (ehVogal(c4)) {
        pontos.push(i + 1);
        continue;
      }
    }

    // 4. Consoante + Consoante + Vogal onde par não é inseparável (ex: téc-ni-co, fun-da-men-to, ar-ti-go)
    if (ehConsoante(c1) && ehConsoante(c2) && ehVogal(c3) && !DIGRAFOS_INSEPARAVEIS.includes(par) && !['qu', 'gu'].includes(par)) {
      pontos.push(i + 1);
      continue;
    }

    // 5. Hiatos evidentes (vogais contíguas que separam sílaba)
    if (ehVogal(c1) && ehVogal(c2)) {
      const parVog = (c1 + c2).toLowerCase();
      if (['aa', 'ee', 'oo', 'aú', 'eú', 'oú', 'aí', 'eí', 'oí', 'uí', 'ia', 'ie', 'io', 'ua', 'ue', 'uo'].includes(parVog)) {
        if (['á', 'é', 'í', 'ó', 'ú', 'â', 'ê', 'ô'].includes(c1.toLowerCase()) || ['í', 'ú'].includes(c2.toLowerCase()) || c1.toLowerCase() === c2.toLowerCase()) {
          pontos.push(i + 1);
        }
      }
    }
  }

  // Regra tipográfica: no mínimo 2 letras antes do hífen e 2 letras depois do hífen
  const pontosValidos = pontos.filter(p => p >= 2 && (n - p) >= 2);
  if (pontosValidos.length === 0) return [limpa];

  const silabas = [];
  let ultimo = 0;
  for (const p of pontosValidos) {
    silabas.push(limpa.slice(ultimo, p));
    ultimo = p;
  }
  silabas.push(limpa.slice(ultimo));
  return silabas;
}

/**
 * Insere soft hyphens (\u00AD) em uma palavra da Língua Portuguesa.
 */
export function hifenizarPalavraPt(palavra) {
  if (!palavra || palavra.length < 5) return palavra;
  return silabarPalavraPt(palavra).join(SOFT_HYPHEN);
}

/**
 * Hifeniza texto puro substituindo palavras elegíveis por versões com soft hyphen.
 */
export function hifenizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  return texto.replace(/[a-zA-ZáàãâéêíóõôúüçÁÀÃÂÉÊÍÓÕÔÚÜÇ]{5,}/g, match => {
    return hifenizarPalavraPt(match);
  });
}

/**
 * Hifeniza conteúdo HTML preservando tags intactas e aplicando soft hyphens apenas aos nós de texto.
 */
export function hifenizarHtml(html) {
  if (!html || typeof html !== 'string') return html;
  const partes = html.match(/<[^>]+>|[^<]+/g) || [];
  const pontos = partes.map(() => new Set());
  const palavra = [];
  const letra = /[a-zA-ZáàãâéêíóõôúüçÁÀÃÂÉÊÍÓÕÔÚÜÇ]/;
  const finalizar = () => {
    if (palavra.length >= 5) {
      const silabas = silabarPalavraPt(palavra.map(x => x.caractere).join(''));
      let pos = 0;
      for (const silaba of silabas.slice(0, -1)) {
        pos += silaba.length;
        const anterior = palavra[pos - 1];
        pontos[anterior.parte].add(anterior.posicao);
      }
    }
    palavra.length = 0;
  };
  partes.forEach((parte, indice) => {
    if (parte.startsWith('<')) {
      // Spans de estrutura/estilo não interrompem uma palavra nem mudam sua hifenização.
      if (!/^<\/?(?:span|a|b|strong|i|em|u|ins|del)\b/i.test(parte)) finalizar();
      return;
    }
    for (let i = 0; i < parte.length; i++) {
      if (letra.test(parte[i])) palavra.push({ caractere: parte[i], parte: indice, posicao: i });
      else finalizar();
    }
  });
  finalizar();
  return partes.map((parte, indice) => [...parte].map((c, i) => c + (pontos[indice].has(i) ? SOFT_HYPHEN : '')).join('')).join('');
}

/**
 * Remove soft hyphens condicionais de uma string (para busca, cópia ou JSON limpo).
 */
export function removerHifensCondicionais(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\u00AD/g, '');
}
