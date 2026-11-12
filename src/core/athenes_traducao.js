// SPDX-License-Identifier: GPL-3.0-or-later
/** Tradução apenas da leitura de Referências; o PDF original permanece intacto. */
export const IDIOMAS_TRADUCAO = Object.freeze({ pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' });
const cache = new Map();
const cacheTrechos = new Map();
const LIMITE_TRECHO = 6000;
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

async function criarTradutorLocal(texto, origem, destino, TranslatorImpl) {
  if (!TranslatorImpl?.availability || !TranslatorImpl?.create) return null;
  const idiomaOrigem = origem === 'auto' ? detectarIdiomaLeitura(texto) : origem;
  if (idiomaOrigem === destino) return null;
  try {
    const opcoes = { sourceLanguage: idiomaOrigem, targetLanguage: destino };
    if (await TranslatorImpl.availability(opcoes) === 'unavailable') return null;
    return await TranslatorImpl.create(opcoes);
  } catch { return null; }
}

function dividirTrechoBasico(texto) {
  const partes = [];
  let atual = '';
  for (const palavra of String(texto).match(/\S+\s*/g) || []) {
    if (codificador.encode(atual + palavra).length <= 450) { atual += palavra; continue; }
    if (atual.trim()) { partes.push(atual.trim()); atual = ''; }
    if (codificador.encode(palavra).length <= 450) { atual = palavra; continue; }
    for (const caractere of palavra) {
      if (codificador.encode(atual + caractere).length > 450) { partes.push(atual.trim()); atual = ''; }
      atual += caractere;
    }
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

async function traduzirTrechoBasico(parte, origem, destino, fetchImpl, signal) {
  const idiomaOrigem = origem === 'auto' ? detectarIdiomaLeitura(parte) : origem;
  if (idiomaOrigem === destino) return parte;
  const traduzidos = [];
  const partes = dividirTrechoBasico(parte);
  for (let i = 0; i < partes.length; i += 3) {
    const grupo = await Promise.all(partes.slice(i, i + 3).map(async trecho => {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', trecho);
      url.searchParams.set('langpair', `${idiomaOrigem}|${destino}`);
      const resposta = await fetchImpl(url.toString(), { signal });
      if (!resposta.ok) throw new Error('A tradução gratuita está indisponível. Tente novamente mais tarde.');
      const dados = await resposta.json();
      const traducao = String(dados?.responseData?.translatedText || '').trim();
      if (Number(dados?.responseStatus) !== 200 || !traducao) {
        throw new Error('O serviço gratuito atingiu o limite de uso. Tente novamente mais tarde.');
      }
      return traducao;
    }));
    traduzidos.push(...grupo);
  }
  return traduzidos.join(' ');
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
    if (!resposta.ok) {
      const erro = new Error(dados.erro || 'O serviço de tradução está indisponível. Tente novamente.');
      erro.status = resposta.status;
      throw erro;
    }
    const traduzida = String(dados.traducao || '').trim();
    if (!traduzida) throw new Error('O serviço não retornou uma tradução. Tente novamente.');
    if (cacheTrechos.size >= 100) cacheTrechos.delete(cacheTrechos.keys().next().value);
    cacheTrechos.set(chave, traduzida);
    return traduzida;
  }
}

/** Prefere tradução local; Gemini e serviço público são alternativas quando ela não existe. */
export async function traduzirTextoAcademico(texto, {
  origem = 'auto', destino = 'pt', fetchImpl = globalThis.fetch, TranslatorImpl = globalThis.Translator,
  signal, aoProgresso, aoMotor
} = {}) {
  const original = String(texto || '').trim();
  if (!original) throw new Error('Selecione um trecho para traduzir.');
  if (!IDIOMAS_TRADUCAO[destino]) throw new Error('Idioma de destino inválido.');
  if (origem !== 'auto' && !IDIOMAS_TRADUCAO[origem]) throw new Error('Idioma de origem inválido.');
  if (origem === destino) return original;
  const chave = `${origem}|${destino}|${original}`;
  if (cache.has(chave)) {
    const anterior = cache.get(chave);
    aoMotor?.(anterior.motor);
    return anterior.resultado;
  }
  const tradutorLocal = await criarTradutorLocal(original, origem, destino, TranslatorImpl);
  let motor = tradutorLocal ? 'local' : 'gemini';
  aoMotor?.(motor);
  const blocos = original.split(/(\n\s*\n)/);
  const limite = tradutorLocal ? 3000 : LIMITE_TRECHO;
  const total = blocos.reduce((n, bloco, i) => n + (i % 2 === 0 ? dividirTextoTraducao(bloco, limite).length : 0), 0);
  let concluidos = 0;
  const traduzidos = [];
  try {
    for (const [indice, bloco] of blocos.entries()) {
      if (indice % 2) { traduzidos.push(bloco); continue; }
      const partes = [];
      for (const parte of dividirTextoTraducao(bloco, limite)) {
        if (signal?.aborted) throw signal.reason || new DOMException('Operação cancelada.', 'AbortError');
        let traducao;
        if (motor === 'local') {
          try { traducao = await tradutorLocal.translate(parte); }
          catch (erro) {
            if (signal?.aborted) throw erro;
            motor = 'gemini';
            aoMotor?.(motor);
          }
        }
        if (traducao === undefined && motor === 'gemini') {
          try { traducao = await traduzirTrecho(parte, origem, destino, fetchImpl, signal); }
          catch (erro) {
            if (signal?.aborted || ![429, 502, 503].includes(erro.status)) throw erro;
            motor = 'basico';
            aoMotor?.(motor);
            traducao = await traduzirTrechoBasico(parte, origem, destino, fetchImpl, signal);
          }
        } else if (traducao === undefined) {
          traducao = await traduzirTrechoBasico(parte, origem, destino, fetchImpl, signal);
        }
        partes.push(corrigirTermosTecnicos(parte, String(traducao).trim(), origem === 'auto' ? detectarIdiomaLeitura(parte) : origem, destino));
        aoProgresso?.(++concluidos, total);
      }
      traduzidos.push(partes.join(' '));
    }
  } finally {
    tradutorLocal?.destroy?.();
  }
  const resultado = traduzidos.join('');
  if (original.length <= 40000) {
    if (cache.size >= 30) cache.delete(cache.keys().next().value);
    cache.set(chave, { resultado, motor });
  }
  return resultado;
}
