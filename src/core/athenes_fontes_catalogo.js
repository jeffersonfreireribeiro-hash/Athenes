// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Catálogo aberto de fontes (Fontsource: Google Fonts + outras, licenças livres). Módulo puro, sem DOM nem rede:
 * interpreta as respostas da API, busca por nome e escolhe quais variantes baixar. O download e o cache ficam em
 * `src/ui/athenes_fontes_ui.js` (FontManagerService).
 *
 *   Lista:   GET https://api.fontsource.org/v1/fonts            → [{ id, family, subsets, weights, styles, category, type, … }]
 *   Detalhe: GET https://api.fontsource.org/v1/fonts/{id}       → { …, variants: { "400": { "normal": { "latin": { url: { woff2, woff, ttf } } } } } }
 */

export const URL_API_FONTES = 'https://api.fontsource.org/v1/fonts';
export const CATALOGO_VALIDADE_MS = 7 * 24 * 3600 * 1000;

/** Variantes essenciais baixadas com a família: Regular, Itálico, Semibold, Bold e Bold Itálico. */
export const VARIANTES_ESSENCIAIS = Object.freeze([[400, 'normal'], [400, 'italic'], [600, 'normal'], [700, 'normal'], [700, 'italic']]);

/** Reserva offline: se o catálogo nunca foi baixado, estas famílias já podem ser pesquisadas (o download ainda precisa de rede). */
export const FONTES_POPULARES = Object.freeze([
  ['montserrat', 'Montserrat', 'sans-serif'], ['nunito', 'Nunito', 'sans-serif'], ['inter', 'Inter', 'sans-serif'], ['roboto', 'Roboto', 'sans-serif'],
  ['open-sans', 'Open Sans', 'sans-serif'], ['lato', 'Lato', 'sans-serif'], ['poppins', 'Poppins', 'sans-serif'], ['source-sans-3', 'Source Sans 3', 'sans-serif'],
  ['merriweather', 'Merriweather', 'serif'], ['lora', 'Lora', 'serif'], ['pt-serif', 'PT Serif', 'serif'], ['eb-garamond', 'EB Garamond', 'serif'],
  ['crimson-text', 'Crimson Text', 'serif'], ['libre-baskerville', 'Libre Baskerville', 'serif'], ['playfair-display', 'Playfair Display', 'serif'],
  ['source-serif-4', 'Source Serif 4', 'serif'], ['noto-serif', 'Noto Serif', 'serif'], ['noto-sans', 'Noto Sans', 'sans-serif'],
  ['roboto-mono', 'Roboto Mono', 'monospace'], ['fira-code', 'Fira Code', 'monospace'], ['jetbrains-mono', 'JetBrains Mono', 'monospace'],
  ['work-sans', 'Work Sans', 'sans-serif'], ['raleway', 'Raleway', 'sans-serif'], ['ubuntu', 'Ubuntu', 'sans-serif'], ['cabin', 'Cabin', 'sans-serif'],
  ['quicksand', 'Quicksand', 'sans-serif'], ['karla', 'Karla', 'sans-serif'], ['mulish', 'Mulish', 'sans-serif'], ['dm-sans', 'DM Sans', 'sans-serif'],
  ['cormorant-garamond', 'Cormorant Garamond', 'serif'], ['libre-franklin', 'Libre Franklin', 'sans-serif'], ['arimo', 'Arimo', 'sans-serif'],
  ['tinos', 'Tinos', 'serif'], ['cousine', 'Cousine', 'monospace'], ['spectral', 'Spectral', 'serif'], ['bitter', 'Bitter', 'serif']
].map(([id, familia, categoria]) => ({ id, familia, categoria, pesos: [400, 700], estilos: ['normal', 'italic'], subsets: ['latin'] })));

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Resposta da lista → [{ id, familia, categoria, pesos, estilos, subsets, tipo }] (descarta entradas inválidas e sem alfabeto latino). */
export function normalizarCatalogo(json) {
  if (!Array.isArray(json)) return [];
  const saida = [];
  for (const f of json) {
    if (!f || typeof f.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(f.id) || typeof f.family !== 'string') continue;
    const subsets = Array.isArray(f.subsets) ? f.subsets.filter(s => typeof s === 'string') : [];
    if (subsets.length && !subsets.includes('latin') && !subsets.includes('latin-ext')) continue; // o Athenes escreve em português
    saida.push({
      id: f.id, familia: f.family.slice(0, 80), categoria: typeof f.category === 'string' ? f.category : 'sans-serif',
      pesos: (Array.isArray(f.weights) ? f.weights : [400]).map(Number).filter(Number.isFinite),
      estilos: Array.isArray(f.styles) ? f.styles.filter(s => s === 'normal' || s === 'italic') : ['normal'],
      subsets, tipo: f.type === 'google' ? 'google' : 'outra'
    });
  }
  return saida;
}

/** Busca por nome (sem acento, sem diferenciar maiúsculas): começa com o termo > palavra começa > contém. */
export function buscarNoCatalogo(lista, termo, limite = 40) {
  const t = semAcento(termo).trim();
  if (!t) return [];
  const pontuados = [];
  for (const f of lista || []) {
    const nome = semAcento(f.familia);
    let p = -1;
    if (nome === t) p = 0;
    else if (nome.startsWith(t)) p = 1;
    else if (nome.split(/[\s-]+/).some(w => w.startsWith(t))) p = 2;
    else if (nome.includes(t) || f.id.includes(t.replace(/\s+/g, '-'))) p = 3;
    if (p >= 0) pontuados.push([p, nome.length, f]);
  }
  return pontuados.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limite).map(x => x[2]);
}

/**
 * Do detalhe da família escolhe os arquivos woff2 a baixar. Peso ausente usa o mais próximo disponível (empate: o mais pesado);
 * itálico só entra se a família tem itálico. Subconjunto: latin (cobre o português), senão latin-ext, senão o padrão.
 * Devolve [{ peso, estilo, url, formato }] sem repetir (peso, estilo).
 */
export function escolherVariantes(detalhe, essenciais = VARIANTES_ESSENCIAIS) {
  const variantes = detalhe?.variants;
  if (!variantes || typeof variantes !== 'object') return [];
  const pesosDisp = Object.keys(variantes).map(Number).filter(Number.isFinite);
  if (!pesosDisp.length) return [];
  const subset = (v) => {
    const prefs = ['latin', 'latin-ext', detalhe.defSubset].filter(Boolean);
    const achado = prefs.find(s => v?.[s]?.url);
    return achado ? v[achado] : Object.values(v || {}).find(x => x?.url);
  };
  const saida = []; const vistos = new Set();
  for (const [pesoPedido, estilo] of essenciais) {
    const comEstilo = pesosDisp.filter(p => variantes[p]?.[estilo]);
    if (!comEstilo.length) continue;
    const peso = comEstilo.reduce((m, p) => (Math.abs(p - pesoPedido) < Math.abs(m - pesoPedido) || (Math.abs(p - pesoPedido) === Math.abs(m - pesoPedido) && p > m) ? p : m));
    const chave = `${peso}|${estilo}`;
    if (vistos.has(chave)) continue;
    const arq = subset(variantes[peso][estilo]);
    const url = arq?.url?.woff2 || arq?.url?.woff || arq?.url?.ttf;
    if (!url || !/^https:\/\//.test(url)) continue;
    vistos.add(chave);
    saida.push({ peso, estilo, url, formato: arq.url.woff2 ? 'woff2' : arq.url.woff ? 'woff' : 'ttf' });
  }
  return saida;
}

/** Arquivo direto no CDN (prévia do nome da fonte na lista, sem baixar a família). */
export const urlPreviaFonte = (id, peso = 400) => `https://cdn.jsdelivr.net/fontsource/fonts/${encodeURIComponent(id)}@latest/latin-${peso}-normal.woff2`;
export const urlDetalheFonte = (id) => `${URL_API_FONTES}/${encodeURIComponent(id)}`;

/** Nome de fonte (família) → id do catálogo ("EB Garamond" → "eb-garamond"). */
export const idDoCatalogo = (familia) => semAcento(familia).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
