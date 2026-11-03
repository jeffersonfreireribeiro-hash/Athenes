// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Biblioteca de artigos (leitura, fichamentos, notas, destaques) com o servidor como fonte da verdade.
 *
 * Antes ficava só no navegador de cada computador. Agora a lista vive na MEMÓRIA da sessão e é sincronizada com o servidor
 * (registro protegido do perfil); os PDFs ficam no Google Drive. Versões antigas deixaram a biblioteca no navegador: ela é lida
 * uma vez, enviada ao servidor e só então apagada daqui. Mesclagem por artigo (o mais recente vence; exclusão vale em todos).
 */
import { lerConta, removerConta, obterContaAtiva } from './athenes_conta.js';
import { nuvemAutenticada } from './athenes_colaboracao.js';
import { sincronizarDado } from './athenes_dados_servidor.js';

export const CHAVE_BIBLIOTECA = 'biblioteca_artigos';
const LEGADOS = ['athenes_estudo_artigos_v1', 'athenes_artigos_estudo', 'athenes_estudo_artigos'];
const ATRASO_ENVIO_MS = 1500;

let ehExemploDoLegado = () => false;
/** Registra como reconhecer os artigos de exemplo antigos (fictícios) para não os enviar ao servidor como se fossem reais. */
export const definirFiltroDeExemplos = (fn) => { ehExemploDoLegado = fn; };

const memoria = { conta: undefined, artigos: [], excluidos: {}, assin: new Map(), legadoLido: false, ouvintes: new Set(), emCurso: false, temporizador: null };

const EFEMEROS = ['pdfBlobUrl'];
const semEfemeros = (a) => { const r = { ...a }; EFEMEROS.forEach(k => delete r[k]); return r; };
const assinatura = (a) => { const r = semEfemeros(a); delete r.atualizadoEm; return JSON.stringify(r); };
const canon = (o) => JSON.stringify(o, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)); // o banco reordena as chaves

function garantirConta() {
  const conta = obterContaAtiva?.() || '';
  if (memoria.conta !== conta) { clearTimeout(memoria.temporizador); Object.assign(memoria, { conta, artigos: [], excluidos: {}, assin: new Map(), legadoLido: false, temporizador: null }); }
}

// ───────────────────────────── Mesclagem (pura) ─────────────────────────────

/**
 * Junta a biblioteca do servidor com a local. Cada lado: { artigos[], excluidos{ id: quando } }.
 * Por artigo vale o `atualizadoEm` mais recente; exclusão vale em todos, salvo se o artigo foi editado depois dela.
 */
export function mesclarBiblioteca(servidor, local) {
  const srv = servidor || { artigos: [], excluidos: {} };
  const excluidos = { ...(srv.excluidos || {}), ...(local.excluidos || {}) };
  const porId = new Map();
  for (const a of [...(srv.artigos || []), ...(local.artigos || [])]) {
    if (!a?.id) continue;
    const atual = porId.get(String(a.id));
    if (!atual || (a.atualizadoEm || '') > (atual.atualizadoEm || '')) porId.set(String(a.id), a);
  }
  for (const [id, a] of [...porId]) {
    const quando = excluidos[id];
    if (!quando) continue;
    if ((a.atualizadoEm || '') > quando) delete excluidos[id]; // editado depois de excluído: a edição vence
    else porId.delete(id);
  }
  const artigos = [...porId.values()];
  const resumo = (x) => canon({ a: [...(x.artigos || [])].sort((m, n) => String(m.id).localeCompare(String(n.id))), e: x.excluidos || {} });
  const valor = { artigos, excluidos };
  return { valor, mudouServidor: !servidor || resumo(servidor) !== resumo(valor) };
}

// ───────────────────────────── Memória da sessão ─────────────────────────────

function lerLegado() {
  for (const k of LEGADOS) {
    try { const v = JSON.parse(lerConta(k) || 'null'); if (Array.isArray(v) && v.length) return v; } catch (_) {}
  }
  return [];
}

/** Lista da sessão (a mesma referência a cada chamada). Na primeira vez traz, uma vez, o que versões antigas deixaram no navegador. */
export function obterArtigos() {
  garantirConta();
  if (!memoria.legadoLido) {
    memoria.legadoLido = true;
    const antigos = lerLegado();
    if (antigos.length && !memoria.artigos.length) {
      for (const a of antigos) { if (a && !ehExemploDoLegado(a)) { a.pdfBlobUrl = null; memoria.artigos.push(a); memoria.assin.set(String(a.id), assinatura(a)); } }
    }
  }
  return memoria.artigos;
}

export const legadoDaBibliotecaPendente = () => lerLegado().length > 0;

/** Registra a lista alterada: carimba os artigos que mudaram, anota exclusões e agenda o envio ao servidor. */
export function definirArtigos(lista) {
  garantirConta();
  if (!Array.isArray(lista)) return lista;
  const agora = new Date().toISOString();
  const ids = new Set();
  for (const a of lista) {
    if (!a?.id) continue;
    ids.add(String(a.id));
    const sig = assinatura(a);
    if (memoria.assin.get(String(a.id)) !== sig) { a.atualizadoEm = agora; memoria.assin.set(String(a.id), sig); }
  }
  for (const id of [...memoria.assin.keys()]) if (!ids.has(id)) { memoria.excluidos[id] = agora; memoria.assin.delete(id); }
  if (memoria.artigos !== lista) { memoria.artigos.length = 0; memoria.artigos.push(...lista); }
  agendarEnvio();
  return lista;
}

export function aoMudarBiblioteca(cb) { memoria.ouvintes.add(cb); return () => memoria.ouvintes.delete(cb); }
export function reiniciar() { clearTimeout(memoria.temporizador); Object.assign(memoria, { conta: undefined, artigos: [], excluidos: {}, assin: new Map(), legadoLido: false, temporizador: null, emCurso: false }); }
export const temEnvioPendente = () => Boolean(memoria.temporizador) || memoria.emCurso;

function agendarEnvio() {
  clearTimeout(memoria.temporizador);
  memoria.temporizador = setTimeout(() => { memoria.temporizador = null; sincronizarBiblioteca().catch(e => console.warn('[Athenes] Biblioteca no servidor:', e.message)); }, ATRASO_ENVIO_MS);
}

/**
 * Sincroniza com o servidor: traz o que mudou em outros computadores, envia o que mudou aqui e, na primeira vez, move a
 * biblioteca antiga do navegador para o servidor (apagando-a daqui só depois). Devolve { mudou } ou null sem a nuvem confirmada.
 */
export async function sincronizarBiblioteca({ fetchImpl = globalThis.fetch } = {}) {
  garantirConta();
  obterArtigos();
  if (!nuvemAutenticada() || memoria.emCurso) return null;
  memoria.emCurso = true;
  try {
    const local = { artigos: memoria.artigos.map(semEfemeros), excluidos: { ...memoria.excluidos } };
    const r = await sincronizarDado(CHAVE_BIBLIOTECA, local, mesclarBiblioteca, { fetchImpl });
    const novos = r.valor.artigos;
    let mudou = false;
    const atuais = new Map(memoria.artigos.map(a => [String(a.id), a]));
    const resultado = [];
    for (const n of novos) {
      const atual = atuais.get(String(n.id));
      if (atual && assinatura(atual) === assinatura(n) && (atual.atualizadoEm || '') >= (n.atualizadoEm || '')) { resultado.push(atual); continue; } // igual: mantém o objeto (e o que é só desta sessão)
      mudou = true;
      resultado.push(atual ? { ...n, pdfBlobUrl: atual.pdfBlobUrl ?? null } : { ...n, pdfBlobUrl: null });
    }
    if (resultado.length !== memoria.artigos.length) mudou = true;
    memoria.artigos.splice(0, memoria.artigos.length, ...resultado);
    memoria.excluidos = r.valor.excluidos || {};
    memoria.assin = new Map(resultado.map(a => [String(a.id), assinatura(a)]));
    LEGADOS.forEach(k => removerConta(k)); // a cópia antiga do navegador sai: o servidor já tem tudo
    if (mudou) memoria.ouvintes.forEach(cb => { try { cb(memoria.artigos); } catch (_) {} });
    return { mudou };
  } finally {
    memoria.emCurso = false;
  }
}
