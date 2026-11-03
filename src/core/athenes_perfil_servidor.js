// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Índice do perfil no servidor: a FONTE DA VERDADE do que existe e do que vale para uma conta.
 *
 * Cada conta tem UM registro no servidor (protegido: só o dono lê e grava) com: a árvore de pastas (mesmos ids em todos os
 * computadores), a lista de documentos (título, pasta, arquivo no Drive, quando o conteúdo mudou), o que foi excluído, os ids das
 * pastas do Drive e a conexão do Zotero — toda a comunicação entre os computadores, exceto o próprio arquivo. Cada computador só LÊ esse
 * registro e mostra o que ele diz; mudanças locais são enviadas a ele e vira o estado de todos. O conteúdo dos documentos
 * continua no Drive da pessoa (o servidor guarda só o índice).
 *
 * Funções puras (`mesclarPerfil`) separadas da rede, e a rede recebe `fetchImpl` (testável sem navegador).
 */
import { obterConfigSupabase } from './athenes_colaboracao.js';
import { cabecalhosSupabase, lerSessaoSupabase } from './athenes_supabase_auth.js';

export const PREFIXO_ID_PERFIL = '__perfil__:';
export const idDoRegistroDoPerfil = (userId) => `${PREFIXO_ID_PERFIL}${userId}`;
export const ehRegistroDePerfil = (id) => String(id || '').startsWith(PREFIXO_ID_PERFIL);

const clone = (o) => JSON.parse(JSON.stringify(o));
const chaveExclusao = (d) => (d.driveFileId ? `f:${d.driveFileId}` : `i:${d.id}`);

/** Um documento do usuário (não compartilhado comigo) como entrada do índice. */
export function entradaDoDocumento(d) {
  return {
    id: String(d.id), titulo: d.titulo || 'Documento', subtitulo: d.subtitulo || '', tipoDoc: d.tipoDoc || 'artigo', perfilId: d.perfilId || d.perfil || 'abnt',
    pastaId: d.pastaId || '', driveFileId: d.driveFileId || '', driveFolderId: d.driveFolderId || '',
    atualizadoEm: d.dataModificacao || d.dataCriacao || '',
    conteudoEm: d.driveSincronizadoEm || ''
  };
}

/** O documento tem alteração ainda não enviada ao Drive? (nesse caso uma exclusão feita em outro lugar não o apaga) */
export const temAlteracaoPendente = (d) => !d.driveFileId || !d.driveSincronizadoEm || (d.dataModificacao || '') > d.driveSincronizadoEm;

const nomeNorm = (n) => String(n || '').trim().toLowerCase();

/**
 * Soma duas árvores de pastas. Pastas "iguais" = mesmo id, mesmo id no Drive ou mesmo nome entre irmãs (um computador pode ter
 * criado/importado a mesma pasta com outro id: isso duplicava ARTIGOS e ARQ.CON). Fica o id de quem veio primeiro (servidor) e
 * `mapa` anota { idDescartado: idMantido } para religar documentos. Pastas excluídas (e o que há dentro delas) ficam de fora.
 */
function mesclarArvore(base = [], extra = [], mapa = {}, excluidas = {}) {
  const saida = [];
  const juntar = (p) => {
    if (excluidas[p.id]) return;
    const igual = saida.find(q => q.id === p.id || (p.driveId && q.driveId && p.driveId === q.driveId) || nomeNorm(q.nome) === nomeNorm(p.nome));
    if (!igual) {
      const novo = { ...clone(p), subpastas: [] };
      saida.push(novo);
      novo.subpastas = mesclarArvore([], p.subpastas || [], mapa, excluidas);
      return;
    }
    if (igual.id !== p.id) mapa[p.id] = igual.id;
    if (!igual.driveId && p.driveId) igual.driveId = p.driveId; // o servidor ainda não sabia o id da pasta no Drive
    igual.subpastas = mesclarArvore(igual.subpastas || [], p.subpastas || [], mapa, excluidas);
  };
  for (const p of base) juntar(p);
  for (const p of extra) juntar(p);
  return saida;
}

/**
 * Junta o índice do servidor com o estado local e diz o que cada lado precisa fazer.
 *  - servidor: { pastas, documentos[], excluidos{} } ou null (primeira vez)
 *  - local:    { pastas, documentos[] (docs completos), excluidos{} (exclusões registradas aqui) }
 * Regras: exclusão vale em todos (a menos que o documento tenha alteração pendente: aí a edição vence e ele volta);
 * entre duas versões da mesma entrada vale a mais recente; pastas se somam (mesmos ids em todos os computadores).
 * Também mescla os ids das pastas do Drive (`drive`) e a conexão do Zotero (`zotero`).
 * Devolve { indice, remover[], adicionar[], atualizar[], recarregar[], pastas, aplicarDrive, aplicarZotero, mudouServidor }.
 */
export function mesclarPerfil(servidor, local) {
  const srv = servidor ? clone(servidor) : { pastas: [], documentos: [], excluidos: {} };
  const excluidos = { ...(srv.excluidos || {}), ...(local.excluidos || {}) };
  const entradas = new Map();           // chave de identidade -> entrada
  const idParaChave = new Map();
  const chaveDe = (e) => (e.driveFileId ? `f:${e.driveFileId}` : `i:${e.id}`);
  const guardar = (e) => {
    const k = chaveDe(e);
    const atual = entradas.get(k);
    // mesmo arquivo do Drive com ids diferentes (um computador importou como "drive_…"): fica o id original
    const id = atual && !String(atual.id).startsWith('drive_') && String(e.id).startsWith('drive_') ? atual.id : e.id;
    const conteudoEm = [atual?.conteudoEm, e.conteudoEm].filter(Boolean).sort().at(-1) || ''; // o conteúdo mais recente gravado no Drive
    if (!atual || (e.atualizadoEm || '') >= (atual.atualizadoEm || '')) entradas.set(k, { ...e, id, conteudoEm });
    else entradas.set(k, { ...atual, id, conteudoEm });
    idParaChave.set(String(e.id), k);
  };
  for (const e of srv.documentos || []) guardar(e);

  const proprios = (local.documentos || []).filter(d => !d.compartilhadoComigo && !d.proprietarioExterno);
  const remover = [];
  for (const d of proprios) {
    const e = entradaDoDocumento(d);
    const excl = excluidos[chaveExclusao(d)] || excluidos[`i:${d.id}`];
    if (excl) {
      if (temAlteracaoPendente(d)) { delete excluidos[chaveExclusao(d)]; delete excluidos[`i:${d.id}`]; guardar(e); } // edição vence exclusão: o documento volta
      else remover.push(String(d.id));
      continue;
    }
    guardar(e);
  }
  for (const k of [...entradas.keys()]) if (excluidos[k] || excluidos[`i:${entradas.get(k).id}`]) entradas.delete(k);

  const documentos = [...entradas.values()];
  const idsLocais = new Map(proprios.map(d => [String(d.id), d]));
  const porArquivoLocal = new Map(proprios.filter(d => d.driveFileId).map(d => [d.driveFileId, d]));
  const adicionar = []; const atualizar = []; const recarregar = [];
  for (const e of documentos) {
    const l = idsLocais.get(String(e.id)) || (e.driveFileId && porArquivoLocal.get(e.driveFileId));
    if (!l) { adicionar.push(e); continue; }
    // o conteúdo foi regravado no Drive por outro computador depois do que este tem: baixar de novo (se aqui não há edição pendente)
    if (e.conteudoEm && l.driveSincronizadoEm && e.conteudoEm > l.driveSincronizadoEm && !temAlteracaoPendente(l)) recarregar.push(String(l.id));
    if (!remover.includes(String(l.id)) && (e.atualizadoEm || '') > (l.dataModificacao || '') && !temAlteracaoPendente(l)) atualizar.push({ local: String(l.id), entrada: e });
    else if (String(l.id).startsWith('drive_') && !String(e.id).startsWith('drive_')) atualizar.push({ local: String(l.id), entrada: e });
  }

  const pastasExcluidas = { ...(srv.pastasExcluidas || {}), ...(local.pastasExcluidas || {}) };
  const mapaIds = {};
  const pastas = mesclarArvore(srv.pastas || [], local.pastas || [], mapaIds, pastasExcluidas);
  // documentos: pasta duplicada descartada → a mantida; pasta excluída → volta à pasta padrão
  for (const e of documentos) {
    if (mapaIds[e.pastaId]) e.pastaId = mapaIds[e.pastaId];
    if (pastasExcluidas[e.pastaId]) e.pastaId = '';
  }

  // ids das pastas do Drive: o primeiro computador a gravar define; os demais usam os mesmos (acaba com "cada PC com a sua pasta")
  const driveLocal = local.drive || {};
  const drive = { ...driveLocal, ...Object.fromEntries(Object.entries(srv.drive || {}).filter(([, v]) => v)) };
  const aplicarDrive = Object.entries(drive).some(([k, v]) => v && v !== driveLocal[k]) ? drive : null;

  // conexão do Zotero: vale a mudança mais recente (o computador que mudou desde a última sincronização)
  const cfgLocal = local.zotero?.cfg || null;
  const temLocal = Boolean(cfgLocal?.apiKey && cfgLocal?.userId);
  const canonZ = (c) => JSON.stringify([c?.userId || '', c?.apiKey || '', c?.username || '', Boolean(c?.isGroup)]);
  let zotero = srv.zotero || null; let aplicarZotero = null;
  if (temLocal && (!zotero || local.zotero.mudou) && (!zotero || canonZ(zotero.cfg) !== canonZ(cfgLocal))) zotero = { cfg: cfgLocal, atualizadoEm: new Date().toISOString() };
  else if (zotero?.cfg?.apiKey && canonZ(zotero.cfg) !== canonZ(cfgLocal)) aplicarZotero = zotero.cfg;

  const indice = { versao: (srv.versao || 0) + 1, pastas, documentos, excluidos, pastasExcluidas, drive, ...(zotero ? { zotero } : {}) };
  const canon = (o) => JSON.stringify(o, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v));
  const resumo = (x) => canon({ p: x.pastas || [], d: [...(x.documentos || [])].sort((m, n) => String(m.id).localeCompare(String(n.id))), e: Object.keys(x.excluidos || {}).sort(), pe: Object.keys(x.pastasExcluidas || {}).sort(), dr: x.drive || {}, z: x.zotero?.cfg || null }); // o banco reordena as chaves do JSON
  const igual = (a, b) => resumo(a) === resumo(b);
  return { indice, remover, adicionar, atualizar, recarregar, pastas, mapaIds, pastasExcluidas, aplicarDrive, aplicarZotero, mudouServidor: !servidor || !igual(servidor, indice) };
}

// ───────────────────────────── Rede ─────────────────────────────

const urlTabela = (cfg, consulta) => `${cfg.url}/rest/v1/${cfg.tabela}?${consulta}`;

/** Lê o índice do perfil no servidor: { indice, versaoLinha } ou null (ainda não existe) ou lança (sem sessão/erro). */
export async function lerPerfilDoServidor(fetchImpl = globalThis.fetch) {
  const sessao = lerSessaoSupabase();
  if (!sessao?.user_id) throw new Error('Sem sessão da nuvem protegida.');
  const cfg = obterConfigSupabase();
  const resp = await fetchImpl(urlTabela(cfg, `id=eq.${encodeURIComponent(idDoRegistroDoPerfil(sessao.user_id))}&select=conteudo_json,atualizado_em&limit=1`), { headers: await cabecalhosSupabase(cfg, { fetchImpl }) });
  if (!resp.ok) throw new Error(`Não foi possível ler o índice do perfil (${resp.status}).`);
  const linha = (await resp.json())?.[0];
  return linha ? { indice: linha.conteudo_json || {}, versaoLinha: linha.atualizado_em } : null;
}

/**
 * Grava o índice. Com `versaoLinha` só grava se ninguém gravou antes (conflito → false e o chamador lê e mescla de novo);
 * sem ela, cria o registro. Devolve true/false.
 */
export async function gravarPerfilNoServidor(indice, versaoLinha, fetchImpl = globalThis.fetch) {
  const sessao = lerSessaoSupabase();
  if (!sessao?.user_id) throw new Error('Sem sessão da nuvem protegida.');
  const cfg = obterConfigSupabase();
  const id = idDoRegistroDoPerfil(sessao.user_id);
  const agora = new Date().toISOString();
  const corpo = { titulo: 'Índice do perfil', autor: '', norma: '', conteudo_json: { ...indice, atualizadoEm: agora }, sugestoes_json: [], atualizado_em: agora, atualizado_por: 'Athenes' };
  const cab = await cabecalhosSupabase(cfg, { fetchImpl });
  if (!versaoLinha) {
    const resp = await fetchImpl(urlTabela(cfg, ''), { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal', ...cab }, body: JSON.stringify({ id, ...corpo }) });
    if (resp.status === 409) return false; // outro computador criou primeiro
    if (!resp.ok) throw new Error(`Não foi possível criar o índice do perfil (${resp.status}).`);
    return true;
  }
  const resp = await fetchImpl(urlTabela(cfg, `id=eq.${encodeURIComponent(id)}&atualizado_em=eq.${encodeURIComponent(versaoLinha)}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation', ...cab }, body: JSON.stringify(corpo) });
  if (!resp.ok) throw new Error(`Não foi possível gravar o índice do perfil (${resp.status}).`);
  return ((await resp.json()) || []).length > 0;
}

/**
 * Um ciclo completo: lê o servidor, mescla com o estado local, grava se mudou (repete se houve conflito) e devolve o que o
 * computador precisa aplicar. `local` = { pastas, documentos, excluidos }. Lança se não houver sessão/erro de rede.
 */
export async function sincronizarPerfil(local, { fetchImpl = globalThis.fetch, tentativas = 3 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const atual = await lerPerfilDoServidor(fetchImpl);
    const r = mesclarPerfil(atual?.indice || null, local);
    if (!r.mudouServidor) return { ...r, criado: !atual, gravou: false };
    if (await gravarPerfilNoServidor(r.indice, atual?.versaoLinha || '', fetchImpl)) return { ...r, criado: !atual, gravou: true };
  }
  throw new Error('O índice do perfil mudou em outro computador durante a sincronização. Tente de novo.');
}
