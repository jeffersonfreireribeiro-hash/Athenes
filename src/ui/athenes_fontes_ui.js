// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — FontManagerService: gerenciador de fontes do navegador.
 *
 * - Catálogo aberto (Fontsource/Google Fonts, 2.000+ famílias) consultado de dentro do editor; a lista fica em cache (IndexedDB)
 *   e a busca funciona offline depois da primeira vez.
 * - "Baixar / Usar": baixa a família inteira (Regular, Itálico, Semibold, Bold, Bold Itálico), guarda os binários no IndexedDB e
 *   registra cada variante na FontFace API com o descritor exato (peso/estilo). Depois disso a fonte é 100% offline.
 * - Fontes do computador (`queryLocalFonts`) e arquivos .ttf/.otf/.woff/.woff2 entram na mesma biblioteca.
 * - Hidratação: ao abrir um documento/template as fontes dos estilos que faltam nesta máquina são baixadas e ativadas.
 * - PDF: `prepararFontesParaPdf` só libera a exportação quando todas as fontes dos estilos estão carregadas (`document.fonts`),
 *   e o PDF embute os mesmos binários em `@font-face` (`cssFontesImportadas`): tela e PDF usam exatamente os mesmos arquivos.
 */

import {
  registrarFonteImportada, removerFonteImportada, fonteEhVariavel, faixaDePesos, listarFontesImportadas, formatoDoArquivo, nomeSugerido, FORMATOS_FONTE,
  fontesUsadasNoDocumento, declaracaoDeFontes, fontesAusentes, registrarFontePendente, slugFonte, sanearDeclaracaoDeFontes
} from '../core/athenes_fontes.js';
import { FONTES_SISTEMA } from '../core/athenes_estilos.js';
import {
  normalizarCatalogo, buscarNoCatalogo, escolherVariantes, urlDetalheFonte, URL_API_FONTES, CATALOGO_VALIDADE_MS, FONTES_POPULARES, idDoCatalogo
} from '../core/athenes_fontes_catalogo.js';

const BANCO = 'athenes_fontes'; const LOJA = 'fontes'; const LOJA_CATALOGO = 'catalogo';

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível neste navegador.'));
    const req = indexedDB.open(BANCO, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(LOJA_CATALOGO)) db.createObjectStore(LOJA_CATALOGO, { keyPath: 'chave' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = async (modo, fn, loja = LOJA) => {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const t = db.transaction(loja, modo); const r = fn(t.objectStore(loja));
    t.oncomplete = () => { db.close(); resolve(r?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
};

const bufferParaDataUrl = (buffer, mime) => {
  let bin = ''; const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
};

/** FontFace já adicionadas ao `document.fonts` por fonte (para trocar sem duplicar). */
const FACES = new Map();

async function ativarFace(nome, fonte, descritores, chave) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
  const face = new FontFace(nome, `url(${fonte})`, descritores);
  await face.load();
  document.fonts.add(face);
  if (!FACES.has(chave)) FACES.set(chave, []);
  FACES.get(chave).push(face);
}

function desativarFaces(chave) {
  for (const f of FACES.get(chave) || []) { try { document.fonts.delete(f); } catch (_) { /* já fora */ } }
  FACES.delete(chave);
}

/** Faz o navegador conhecer a família (document.fonts). Cada variante com o seu peso e estilo exatos. */
async function ativarNoNavegador(meta) {
  if (typeof FontFace === 'undefined') return;
  desativarFaces(meta.id || meta.nome);
  const chave = meta.id || meta.nome;
  if (meta.variantes?.length) {
    for (const v of meta.variantes) await ativarFace(meta.nome, v.dataUrl, { weight: String(Number(v.peso) || 400), style: v.estilo === 'italic' ? 'italic' : 'normal' }, chave);
    return;
  }
  await ativarFace(meta.nome, meta.dataUrl, { weight: faixaDePesos({ variavel: fonteEhVariavel(meta) }) }, chave); // estática: 400 (o negrito é sintetizado)
}

/** Registra todas as fontes guardadas. Chamar na abertura do app, antes do primeiro desenho. */
export async function carregarFontesImportadas() {
  let todas = [];
  try { todas = (await tx('readonly', s => s.getAll())) || []; } catch (_) { return []; }
  for (const m of todas) {
    try {
      registrarFonteImportada(m);
      await ativarNoNavegador(m);
    } catch (_) { /* arquivo corrompido: ignora essa fonte */ }
  }
  return todas;
}

async function guardar(entradaId) {
  const guardada = listarFontesImportadas().find(f => f.id === entradaId);
  if (!guardada || typeof indexedDB === 'undefined') return; // sem IndexedDB (ou fora do navegador) a fonte vale só nesta sessão
  try { await tx('readwrite', s => s.put(JSON.parse(JSON.stringify(guardada)))); }
  catch (e) { throw new Error(`A fonte funciona nesta sessão, mas não pôde ser guardada: ${e.message}`); }
}

/** Importa um arquivo de fonte. Retorna a entrada do catálogo. Lança Error com mensagem para o usuário. */
export async function importarArquivoDeFonte(arquivo, { nome = '', serif = false } = {}) {
  const formato = formatoDoArquivo(arquivo?.name);
  if (!formato) throw new Error('Formato não suportado. Use .ttf, .otf, .woff ou .woff2.');
  if (arquivo.size > 12 * 1024 * 1024) throw new Error('Arquivo de fonte grande demais (máximo de 12 MB).');
  const buffer = await arquivo.arrayBuffer();
  const meta = { nome: (nome || nomeSugerido(arquivo.name)).trim(), formato, serif, dataUrl: bufferParaDataUrl(buffer, FORMATOS_FONTE[formato].mime) };
  try { await ativarNoNavegador(meta); } // valida: um arquivo que não é fonte falha aqui
  catch (_) { throw new Error('O arquivo não parece ser uma fonte válida.'); }
  const entrada = registrarFonteImportada(meta);
  await guardar(entrada.id);
  return entrada;
}

export async function excluirFonteImportada(id) {
  desativarFaces(id);
  removerFonteImportada(id);
  try { await tx('readwrite', s => s.delete(id)); } catch (_) { /* já removida da sessão */ }
}

// ───────────────────────────── catálogo online ─────────────────────────────

let catalogoEmMemoria = null;

async function buscarComTempo(url, { tempoMs = 20000, tipo = 'json' } = {}) {
  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new Error('Sem acesso à rede neste ambiente.');
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), tempoMs) : null;
  try {
    const r = await fetchFn(url, ctl ? { signal: ctl.signal } : undefined);
    if (!r.ok) throw new Error(`Servidor de fontes respondeu ${r.status}.`);
    return tipo === 'buffer' ? await r.arrayBuffer() : await r.json();
  } finally { if (t) clearTimeout(t); }
}

/**
 * Lista de famílias do catálogo. Cache de 7 dias no IndexedDB; sem rede usa o cache vencido; sem nada, as fontes populares.
 * Devolve { lista, origem: 'rede' | 'cache' | 'reserva' }.
 */
export async function carregarCatalogo({ forcar = false } = {}) {
  if (catalogoEmMemoria && !forcar) return catalogoEmMemoria;
  let cache = null;
  try { cache = await tx('readonly', s => s.get('lista'), LOJA_CATALOGO); } catch (_) { /* sem banco */ }
  if (cache?.lista?.length && !forcar && Date.now() - (cache.em || 0) < CATALOGO_VALIDADE_MS) return (catalogoEmMemoria = { lista: cache.lista, origem: 'cache' });
  try {
    const lista = normalizarCatalogo(await buscarComTempo(URL_API_FONTES));
    if (!lista.length) throw new Error('Catálogo vazio.');
    try { await tx('readwrite', s => s.put({ chave: 'lista', em: Date.now(), lista }), LOJA_CATALOGO); } catch (_) { /* cache é opcional */ }
    return (catalogoEmMemoria = { lista, origem: 'rede' });
  } catch (_) {
    if (cache?.lista?.length) return (catalogoEmMemoria = { lista: cache.lista, origem: 'cache' });
    return { lista: [...FONTES_POPULARES], origem: 'reserva' };
  }
}

export async function pesquisarFontes(termo, limite = 40) {
  const { lista, origem } = await carregarCatalogo();
  return { resultados: buscarNoCatalogo(lista, termo, limite), origem };
}

/** Já está na biblioteca desta máquina (baixada do catálogo ou importada)? */
export function fonteBaixada(item) {
  const nome = (item?.familia || item?.nome || '').toLowerCase();
  return listarFontesImportadas().find(f => !f.pendente && (f.catalogoId === item?.id || f.nome.toLowerCase() === nome)) || null;
}

/**
 * Baixa a família (variantes essenciais), guarda no IndexedDB e registra na FontFace API.
 * @param item { id (catálogo), familia, categoria }
 * @returns entrada do catálogo de tipografia (`FONTES_SISTEMA[id]`)
 */
export async function baixarFamilia(item, { aoProgresso = null } = {}) {
  const jaTem = fonteBaixada(item);
  if (jaTem) return FONTES_SISTEMA[jaTem.id];
  if (!item?.id) throw new Error('Fonte sem identificação no catálogo.');
  aoProgresso?.(0, 'Consultando o catálogo…');
  const detalhe = await buscarComTempo(urlDetalheFonte(item.id));
  const alvos = escolherVariantes(detalhe);
  if (!alvos.length) throw new Error(`"${item.familia}" não tem arquivos de fonte disponíveis para baixar.`);
  let feitos = 0;
  const variantes = await Promise.all(alvos.map(async (v) => {
    const buffer = await buscarComTempo(v.url, { tipo: 'buffer', tempoMs: 45000 });
    if (buffer.byteLength > 4 * 1024 * 1024) throw new Error('Arquivo de fonte grande demais.');
    aoProgresso?.(++feitos / alvos.length, `Baixando ${feitos}/${alvos.length}…`);
    return { peso: v.peso, estilo: v.estilo, formato: v.formato, dataUrl: bufferParaDataUrl(buffer, FORMATOS_FONTE[v.formato]?.mime || 'font/woff2') };
  }));
  const nome = item.familia || detalhe.family;
  const meta = { id: `fonte_${slugFonte(nome)}`, nome, formato: 'woff2', origem: 'catalogo', catalogoId: item.id, categoria: detalhe.category || item.categoria || '', variantes };
  try { await ativarNoNavegador(meta); } catch (_) { throw new Error('O navegador não aceitou os arquivos baixados desta fonte.'); }
  const entrada = registrarFonteImportada(meta);
  await guardar(entrada.id);
  return entrada;
}

// ───────────────────────────── fontes do computador ─────────────────────────────

export const suportaFontesLocais = () => typeof globalThis.queryLocalFonts === 'function';

/** Famílias instaladas no sistema (pede permissão ao usuário): [{ familia, variantes: FontData[] }]. */
export async function listarFontesLocais() {
  if (!suportaFontesLocais()) throw new Error('Este navegador não lista as fontes do computador (use Chrome ou Edge no desktop).');
  const dados = await globalThis.queryLocalFonts();
  const porFamilia = new Map();
  for (const d of dados) { if (!porFamilia.has(d.family)) porFamilia.set(d.family, []); porFamilia.get(d.family).push(d); }
  return [...porFamilia].map(([familia, variantes]) => ({ familia, variantes })).sort((a, b) => a.familia.localeCompare(b.familia));
}

/** Peso e estilo a partir do nome do estilo da fonte ("Bold Italic", "SemiBold", "Light"…). */
export function descritorDoEstiloLocal(estilo) {
  const s = String(estilo || '').toLowerCase();
  const estiloCss = /italic|oblique|itálic/.test(s) ? 'italic' : 'normal';
  const mapa = [[/thin|hairline/, 100], [/extra.?light|ultra.?light/, 200], [/light/, 300], [/medium/, 500], [/semi.?bold|demi/, 600], [/extra.?bold|ultra.?bold|heavy/, 800], [/black/, 900], [/bold/, 700]];
  const peso = mapa.find(([re]) => re.test(s))?.[1] || 400;
  return { peso, estilo: estiloCss };
}

/** Copia uma família do computador (os arquivos, para o PDF sair igual) para a biblioteca do Athenes. */
export async function importarFamiliaLocal({ familia, variantes }) {
  const jaTem = fonteBaixada({ familia });
  if (jaTem) return FONTES_SISTEMA[jaTem.id];
  const escolhidas = new Map();
  for (const d of variantes) {
    const desc = descritorDoEstiloLocal(d.style);
    const chave = `${desc.peso}|${desc.estilo}`;
    if (!escolhidas.has(chave) && [300, 400, 500, 600, 700].includes(desc.peso)) escolhidas.set(chave, { d, ...desc });
  }
  if (!escolhidas.size) for (const d of variantes.slice(0, 1)) escolhidas.set('400|normal', { d, peso: 400, estilo: 'normal' });
  const lista = [];
  let total = 0;
  for (const { d, peso, estilo } of [...escolhidas.values()].slice(0, 8)) {
    const blob = await d.blob();
    total += blob.size;
    if (total > 30 * 1024 * 1024) throw new Error('Esta família é grande demais para importar (máximo de 30 MB).');
    const buffer = await blob.arrayBuffer();
    const cab = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
    const formato = cab === 'OTTO' ? 'otf' : 'ttf';
    lista.push({ peso, estilo, formato, dataUrl: bufferParaDataUrl(buffer, FORMATOS_FONTE[formato].mime) });
  }
  const meta = { id: `fonte_${slugFonte(familia)}`, nome: familia, formato: lista[0]?.formato || 'ttf', origem: 'local', variantes: lista };
  try { await ativarNoNavegador(meta); } catch (_) { throw new Error('O navegador não aceitou os arquivos desta fonte.'); }
  const entrada = registrarFonteImportada(meta);
  await guardar(entrada.id);
  return entrada;
}

// ───────────────────────────── documento: hidratação e PDF ─────────────────────────────

/** Grava no documento quais fontes (importadas) os estilos usam, sem binários: outra máquina baixa de novo ao abrir. */
export function sincronizarDeclaracaoDeFontes(doc) {
  if (!doc) return doc;
  const decl = declaracaoDeFontes(doc);
  if (decl.length) doc.fontes_declaradas = decl; else delete doc.fontes_declaradas;
  return doc;
}

/**
 * Ao abrir documento ou template: registra as fontes declaradas e baixa/ativa as que esta máquina ainda não tem.
 * Nunca lança: devolve { baixadas: [nome], falhas: [{ nome, motivo }] }.
 */
export async function hidratarFontesDoDocumento(doc, { aoProgresso = null } = {}) {
  const baixadas = []; const falhas = [];
  for (const d of sanearDeclaracaoDeFontes(doc?.fontes_declaradas)) registrarFontePendente(d); // a reserva já aparece no seletor
  for (const d of fontesAusentes(doc)) {
    if (d.origem === 'arquivo' || (!d.catalogoId && d.origem !== 'local')) { falhas.push({ nome: d.nome, motivo: 'Fonte importada de arquivo: importe o arquivo de novo neste computador.' }); continue; }
    try {
      const alvo = d.catalogoId || idDoCatalogo(d.nome);
      aoProgresso?.(d.nome);
      await baixarFamilia({ id: alvo, familia: d.nome, categoria: d.categoria });
      baixadas.push(d.nome);
    } catch (e) { falhas.push({ nome: d.nome, motivo: e.message }); }
  }
  return { baixadas, falhas };
}

/**
 * Garante, antes do PDF, que TODAS as fontes dos estilos do documento estão carregadas no navegador (cada peso/estilo
 * registrado) e espera `document.fonts.ready`. Devolve { ok, falhas: [nome] }; ok=false significa que o PDF sairia com fonte reserva.
 */
export async function prepararFontesParaPdf(doc) {
  const { falhas: falhasHidratacao } = await hidratarFontesDoDocumento(doc);
  const falhas = new Set(falhasHidratacao.map(f => f.nome));
  const importadas = new Map(listarFontesImportadas().map(f => [f.id, f]));
  if (typeof document !== 'undefined' && document.fonts) {
    for (const id of fontesUsadasNoDocumento(doc)) {
      const f = importadas.get(id);
      if (!f) continue;
      if (f.pendente) { falhas.add(f.nome); continue; }
      const pedidos = f.variantes?.length ? f.variantes.map(v => `${v.estilo === 'italic' ? 'italic ' : ''}${v.peso} 12pt "${f.nome}"`) : [`400 12pt "${f.nome}"`];
      try { await Promise.all(pedidos.map(p => document.fonts.load(p, 'AaÇã'))); } catch (_) { falhas.add(f.nome); }
      if (!pedidos.every(p => document.fonts.check(p, 'AaÇã'))) falhas.add(f.nome);
    }
    try { await document.fonts.ready; } catch (_) { /* segue */ }
  }
  return { ok: falhas.size === 0, falhas: [...falhas] };
}
