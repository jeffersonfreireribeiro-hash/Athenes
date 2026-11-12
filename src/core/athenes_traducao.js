// SPDX-License-Identifier: GPL-3.0-or-later
/** Tradução de leitura: texto original nunca é alterado nem enviado ao modelo de documento. */

export const IDIOMAS_TRADUCAO = Object.freeze({ pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' });
const cache = new Map();
const codificador = new TextEncoder();

export function detectarIdiomaLeitura(texto) {
  const amostra = ` ${String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')} `;
  const pistas = {
    pt: /\b(de|que|para|com|uma|sao|nao|dos|das|pelo)\b/g,
    en: /\b(the|and|with|from|this|that|for|are|was|have)\b/g,
    es: /\b(el|los|las|una|para|con|del|por|que|son)\b/g,
    fr: /\b(le|les|des|une|avec|dans|pour|est|sont|aux)\b/g,
    it: /\b(il|gli|una|con|della|per|sono|nel|che|dei)\b/g
  };
  let idioma = 'en';
  let maior = 0;
  for (const [codigo, padrao] of Object.entries(pistas)) {
    const pontos = [...amostra.matchAll(padrao)].length;
    if (pontos > maior) { maior = pontos; idioma = codigo; }
  }
  return idioma;
}

export function dividirTextoTraducao(texto, limiteBytes = 450) {
  const palavras = String(texto || '').match(/\S+\s*/g) || [];
  const partes = [];
  let atual = '';
  for (const palavra of palavras) {
    if (codificador.encode(atual + palavra).length <= limiteBytes) { atual += palavra; continue; }
    if (atual.trim()) { partes.push(atual.trim()); atual = ''; }
    if (codificador.encode(palavra).length <= limiteBytes) { atual = palavra; continue; }
    for (const caractere of palavra) {
      if (codificador.encode(atual + caractere).length > limiteBytes) { partes.push(atual.trim()); atual = ''; }
      atual += caractere;
    }
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

function corrigirTermosTecnicos(original, traducao, origem, destino) {
  if (origem !== 'en' || destino !== 'pt') return traducao;
  let resultado = traducao;
  const termos = [
    [/scattering coefficient/i, /coeficiente de dispers[aã]o/gi, 'coeficiente de espalhamento'],
    [/sound absorption coefficient/i, /coeficiente de absor[cç][aã]o de som/gi, 'coeficiente de absorção sonora'],
    [/room acoustics/i, /ac[uú]stica do quarto/gi, 'acústica de ambientes']
  ];
  for (const [fonte, incorreto, correto] of termos) if (fonte.test(original)) resultado = resultado.replace(incorreto, correto);
  return resultado;
}

/** Traduz com memória de tradução pública; falhas são mostradas ao usuário, sem inventar texto. */
export async function traduzirTextoAcademico(texto, { origem = 'auto', destino = 'pt', fetchImpl = globalThis.fetch, signal } = {}) {
  const original = String(texto || '').trim();
  if (!original) throw new Error('Selecione um trecho para traduzir.');
  if (!IDIOMAS_TRADUCAO[destino]) throw new Error('Idioma de destino inválido.');
  const idiomaOrigem = origem === 'auto' ? detectarIdiomaLeitura(original) : origem;
  if (!IDIOMAS_TRADUCAO[idiomaOrigem]) throw new Error('Idioma de origem inválido.');
  if (idiomaOrigem === destino) return original;
  const chave = `${idiomaOrigem}|${destino}|${original}`;
  if (cache.has(chave)) return cache.get(chave);
  const paragrafos = original.split(/\n\s*\n/).map(paragrafo => dividirTextoTraducao(paragrafo));
  const traduzirParte = async parte => {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', parte);
    url.searchParams.set('langpair', `${idiomaOrigem}|${destino}`);
    const resposta = await fetchImpl(url.toString(), { signal });
    if (!resposta.ok) throw new Error('O serviço de tradução está indisponível. Tente novamente.');
    const dados = await resposta.json();
    const traduzida = String(dados?.responseData?.translatedText || '').trim();
    if (Number(dados?.responseStatus) !== 200 || !traduzida) throw new Error('Não foi possível traduzir este trecho.');
    return traduzida;
  };
  const traduzidos = [];
  for (const partes of paragrafos) {
    const frases = [];
    for (let i = 0; i < partes.length; i += 3) {
      frases.push(...await Promise.all(partes.slice(i, i + 3).map(traduzirParte)));
    }
    traduzidos.push(frases.join(' '));
  }
  const resultado = corrigirTermosTecnicos(original, traduzidos.join('\n\n'), idiomaOrigem, destino);
  if (cache.size > 200) cache.clear();
  cache.set(chave, resultado);
  return resultado;
}
