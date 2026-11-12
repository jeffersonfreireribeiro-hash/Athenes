// SPDX-License-Identifier: GPL-3.0-or-later
/** Tradução apenas da leitura de Referências; o PDF original permanece intacto. */
export const IDIOMAS_TRADUCAO = Object.freeze({ pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' });
const cache = new Map();
const cacheTrechos = new Map();
const LIMITE_TRECHO = 6000;

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

export function dividirTextoTraducao(texto, limite = LIMITE_TRECHO) {
  const partes = [];
  let restante = String(texto || '').trim();
  while (restante.length > limite) {
    let corte = restante.lastIndexOf(' ', limite);
    if (corte < limite / 2) corte = limite;
    partes.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trimStart();
  }
  if (restante) partes.push(restante);
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

function aguardar(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancelar); resolve(); }, ms);
    function cancelar() { clearTimeout(timer); reject(signal.reason || new DOMException('Operação cancelada.', 'AbortError')); }
    signal?.addEventListener('abort', cancelar, { once: true });
  });
}

async function traduzirTrecho(parte, origem, destino, fetchImpl, signal) {
  const chave = `${origem}|${destino}|${parte}`;
  if (cacheTrechos.has(chave)) return cacheTrechos.get(chave);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resposta = await fetchImpl('/api/traduzir-referencia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: parte, origem, destino }), signal
    });
    if (resposta.status === 429 && tentativa < 2) {
      await aguardar(800 * 2 ** tentativa, signal);
      continue;
    }
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || 'O serviço de tradução está indisponível. Tente novamente.');
    const traduzida = String(dados.traducao || '').trim();
    if (!traduzida) throw new Error('O serviço não retornou uma tradução. Tente novamente.');
    if (cacheTrechos.size >= 100) cacheTrechos.delete(cacheTrechos.keys().next().value);
    cacheTrechos.set(chave, traduzida);
    return traduzida;
  }
}

/** Segmenta páginas longas sem um limite diário próprio e permite cancelar a leitura. */
export async function traduzirTextoAcademico(texto, { origem = 'auto', destino = 'pt', fetchImpl = globalThis.fetch, signal, aoProgresso } = {}) {
  const original = String(texto || '').trim();
  if (!original) throw new Error('Selecione um trecho para traduzir.');
  if (!IDIOMAS_TRADUCAO[destino]) throw new Error('Idioma de destino inválido.');
  if (origem !== 'auto' && !IDIOMAS_TRADUCAO[origem]) throw new Error('Idioma de origem inválido.');
  if (origem === destino) return original;
  const chave = `${origem}|${destino}|${original}`;
  if (cache.has(chave)) return cache.get(chave);
  const blocos = original.split(/(\n\s*\n)/);
  const total = blocos.reduce((n, bloco, i) => n + (i % 2 === 0 ? dividirTextoTraducao(bloco).length : 0), 0);
  let concluidos = 0;
  const traduzidos = [];
  for (const [indice, bloco] of blocos.entries()) {
    if (indice % 2) { traduzidos.push(bloco); continue; }
    const partes = [];
    for (const parte of dividirTextoTraducao(bloco)) {
      if (signal?.aborted) throw signal.reason || new DOMException('Operação cancelada.', 'AbortError');
      const traducao = await traduzirTrecho(parte, origem, destino, fetchImpl, signal);
      partes.push(corrigirTermosTecnicos(parte, traducao, origem, destino));
      aoProgresso?.(++concluidos, total);
    }
    traduzidos.push(partes.join(' '));
  }
  const resultado = traduzidos.join('');
  if (original.length <= 40000) {
    if (cache.size >= 30) cache.delete(cache.keys().next().value);
    cache.set(chave, resultado);
  }
  return resultado;
}
