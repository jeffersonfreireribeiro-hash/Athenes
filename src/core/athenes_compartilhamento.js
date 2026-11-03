// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Compartilhamento de documentos por e-mail, com papel por pessoa.
 *
 * O controle de acesso é do BANCO (regras RLS do Supabase): o app só pede e mostra.
 *   leitura    → abre e lê (modo Leitura fiel)
 *   comentario → lê e registra sugestões, sem alterar o texto (modo Sugestão)
 *   edicao     → lê e edita (modo Edição)
 * Só o dono muda quem tem acesso, o papel de cada pessoa e o link público. Tudo recebe `fetchImpl` (testável sem rede).
 */
import { obterConfigSupabase } from './athenes_colaboracao.js';
import { cabecalhosSupabase, lerSessaoSupabase } from './athenes_supabase_auth.js';

export const PAPEIS = Object.freeze({
  leitura: { rotulo: 'Leitura', descricao: 'Só abre e lê' },
  comentario: { rotulo: 'Comentário', descricao: 'Registra sugestões, sem mexer no texto' },
  edicao: { rotulo: 'Edição', descricao: 'Edita o conteúdo' }
});

export const normalizarEmail = (e) => String(e || '').trim().toLowerCase();
export const emailValido = (e) => /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(normalizarEmail(e));
export const papelValido = (p) => Object.prototype.hasOwnProperty.call(PAPEIS, p);

const url = (cfg, consulta) => `${cfg.url}/rest/v1/${cfg.tabela}?${consulta}`;
const aspasPg = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Papel de quem está logado numa linha do banco: 'dono' | 'leitura' | 'comentario' | 'edicao' | '' (sem acesso). */
export function papelNaLinha(linha, { userId = lerSessaoSupabase()?.user_id, email = lerSessaoSupabase()?.email } = {}) {
  if (!linha) return '';
  if (userId && linha.user_id === userId) return 'dono';
  const meu = normalizarEmail(email);
  const papel = linha.permissoes?.[meu];
  if (papelValido(papel)) return papel;
  if ((linha.compartilhado_com || []).includes(meu)) return 'leitura'; // convidado sem papel gravado: o mais restrito
  return linha.publico_leitura ? 'leitura' : '';
}

/** Dados de compartilhamento do documento (dono, pessoas, link público). Null se o documento não existe ou não é acessível. */
export async function lerCompartilhamento(docId, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigSupabase();
  const resp = await fetchImpl(url(cfg, `id=eq.${encodeURIComponent(docId)}&select=id,user_id,compartilhado_com,permissoes,publico_leitura&limit=1`), { headers: await cabecalhosSupabase(cfg, { fetchImpl }) });
  if (!resp.ok) throw new Error(`Não foi possível ler o compartilhamento (${resp.status}).`);
  const linha = (await resp.json())?.[0] || null;
  return linha && { ...linha, permissoes: linha.permissoes || {}, compartilhado_com: linha.compartilhado_com || [], papel: papelNaLinha(linha) };
}

/**
 * Grava quem tem acesso e com qual papel (só o dono consegue: o banco ignora/recusa os demais).
 * `pessoas`: { 'ana@x.com': 'edicao', … }. Devolve a linha gravada.
 */
export async function salvarCompartilhamento(docId, { pessoas = {}, publico = false } = {}, fetchImpl = globalThis.fetch) {
  const permissoes = {};
  for (const [email, papel] of Object.entries(pessoas)) {
    if (!emailValido(email)) throw new Error(`E-mail inválido: ${email}`);
    if (!papelValido(papel)) throw new Error(`Papel inválido para ${email}.`);
    permissoes[normalizarEmail(email)] = papel;
  }
  const cfg = obterConfigSupabase();
  const resp = await fetchImpl(url(cfg, `id=eq.${encodeURIComponent(docId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation', ...(await cabecalhosSupabase(cfg, { fetchImpl })) },
    body: JSON.stringify({ compartilhado_com: Object.keys(permissoes), permissoes, publico_leitura: Boolean(publico) })
  });
  if (!resp.ok) throw new Error(`Não foi possível salvar o compartilhamento (${resp.status}).`);
  const linhas = await resp.json();
  if (!Array.isArray(linhas) || !linhas.length) throw new Error('Só o dono do documento pode alterar quem tem acesso (ou o documento ainda não está na nuvem).');
  return linhas[0];
}

/** Documentos que outras pessoas compartilharam com o e-mail logado: [{ id, titulo, papel, dono, atualizado_em, … }]. */
export async function listarCompartilhadosComigo(fetchImpl = globalThis.fetch) {
  const sessao = lerSessaoSupabase();
  const email = normalizarEmail(sessao?.email);
  if (!email) return [];
  const cfg = obterConfigSupabase();
  const consulta = `compartilhado_com=cs.{${encodeURIComponent(aspasPg(email))}}&select=id,titulo,norma,atualizado_em,atualizado_por,permissoes,user_id,dono:conteudo_json->proprietario->>nome&order=atualizado_em.desc&limit=100`;
  const resp = await fetchImpl(url(cfg, consulta), { headers: await cabecalhosSupabase(cfg, { fetchImpl }) });
  if (!resp.ok) throw new Error(`Não foi possível listar os compartilhados comigo (${resp.status}).`);
  return ((await resp.json()) || [])
    .filter(l => l.user_id !== sessao.user_id)
    .map(l => ({ ...l, papel: papelNaLinha(l, { userId: sessao.user_id, email }) || 'leitura' }));
}

/** Abre um documento a que a pessoa tem acesso (por e-mail, convite ou link público) e devolve { doc, papel } já marcado para o editor. */
export async function carregarDocumentoCompartilhado(docId, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigSupabase();
  const resp = await fetchImpl(url(cfg, `id=eq.${encodeURIComponent(docId)}&select=*&limit=1`), { headers: await cabecalhosSupabase(cfg, { fetchImpl }) });
  if (!resp.ok) throw new Error(`Falha ao abrir o documento (${resp.status}).`);
  const linha = (await resp.json())?.[0];
  if (!linha) return null; // não existe ou a pessoa não tem acesso (o banco não diferencia, de propósito)
  const papel = papelNaLinha(linha) || 'leitura';
  const doc = linha.conteudo_json || {};
  if (Array.isArray(linha.sugestoes_json) && (!doc.sugestoes || !doc.sugestoes.length)) doc.sugestoes = linha.sugestoes_json;
  return { doc: marcarComoCompartilhado(doc, linha, papel), papel };
}

/** Marca o documento para o app tratá-lo como "de outra pessoa": papel, dono externo e sem envio ao Drive de quem recebeu. */
export function marcarComoCompartilhado(doc, linha, papel) {
  if (papel === 'dono') return doc;
  doc.compartilhadoComigo = true;
  doc.proprietarioExterno = true;
  doc.permissao = papel;
  doc.proprietario = { ...(doc.proprietario || {}), id: `ext_${linha.user_id}`, nome: doc.proprietario?.nome || linha.dono || 'Outra pessoa' };
  doc.salvoNuvem = true;
  return doc;
}

/** Modos do editor que o papel permite. */
export function modosPermitidos(doc) {
  if (!doc?.compartilhadoComigo) return ['edicao', 'sugestao', 'comparar', 'leitura'];
  if (doc.permissao === 'edicao') return ['edicao', 'sugestao', 'comparar', 'leitura'];
  if (doc.permissao === 'comentario') return ['sugestao', 'comparar', 'leitura'];
  return ['leitura', 'comparar'];
}

export function modoInicialDoPapel(doc) {
  if (!doc?.compartilhadoComigo) return 'edicao';
  return doc.permissao === 'edicao' ? 'edicao' : doc.permissao === 'comentario' ? 'sugestao' : 'leitura';
}

export const linkDoDocumento = (docId, base = `${globalThis.location?.origin || ''}${globalThis.location?.pathname || '/'}`) => `${base}?doc=${encodeURIComponent(docId)}`;
