// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Armazém de dados do perfil no servidor (um registro protegido por dado, só o dono lê e grava).
 *
 * Serve para o que NÃO é um documento nem um arquivo e antes ficava só no navegador de um computador: a biblioteca de artigos
 * (metadados, notas, destaques), os modelos do usuário etc. O servidor é a fonte da verdade; cada computador lê, mescla com o que
 * tem na memória e grava de volta (com conferência de versão para não pisar em outro computador).
 * Recebe `fetchImpl` (testável sem rede).
 */
import { obterConfigSupabase } from './athenes_colaboracao.js';
import { cabecalhosSupabase, lerSessaoSupabase } from './athenes_supabase_auth.js';

export const PREFIXO_ID_DADOS = '__dados__:';
export const idDoDado = (userId, chave) => `${PREFIXO_ID_DADOS}${userId}:${chave}`;
export const ehRegistroDeDados = (id) => String(id || '').startsWith(PREFIXO_ID_DADOS);

const tabela = (cfg, consulta) => `${cfg.url}/rest/v1/${cfg.tabela}?${consulta}`;

function idAtual(chave) {
  const s = lerSessaoSupabase();
  if (!s?.user_id) throw new Error('Sem sessão da nuvem protegida.');
  return idDoDado(s.user_id, chave);
}

/** { valor, versaoLinha } ou null (ainda não existe). Lança sem sessão/erro de rede. */
export async function lerDado(chave, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigSupabase();
  const resp = await fetchImpl(tabela(cfg, `id=eq.${encodeURIComponent(idAtual(chave))}&select=conteudo_json,atualizado_em&limit=1`), { headers: await cabecalhosSupabase(cfg, { fetchImpl }) });
  if (!resp.ok) throw new Error(`Não foi possível ler "${chave}" do servidor (${resp.status}).`);
  const linha = (await resp.json())?.[0];
  return linha ? { valor: linha.conteudo_json?.valor ?? null, versaoLinha: linha.atualizado_em } : null;
}

/** Grava o dado; com `versaoLinha` só se ninguém gravou antes (conflito → false). Sem ela cria (409 → false). */
export async function gravarDado(chave, valor, versaoLinha, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigSupabase();
  const id = idAtual(chave);
  const agora = new Date().toISOString();
  const corpo = { titulo: `Dados: ${chave}`, autor: '', norma: '', conteudo_json: { valor, atualizadoEm: agora }, sugestoes_json: [], atualizado_em: agora, atualizado_por: 'Athenes' };
  const cab = await cabecalhosSupabase(cfg, { fetchImpl });
  if (!versaoLinha) {
    const resp = await fetchImpl(tabela(cfg, ''), { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal', ...cab }, body: JSON.stringify({ id, ...corpo }) });
    if (resp.status === 409) return false;
    if (!resp.ok) throw new Error(`Não foi possível criar "${chave}" no servidor (${resp.status}).`);
    return true;
  }
  const resp = await fetchImpl(tabela(cfg, `id=eq.${encodeURIComponent(id)}&atualizado_em=eq.${encodeURIComponent(versaoLinha)}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation', ...cab }, body: JSON.stringify(corpo) });
  if (!resp.ok) throw new Error(`Não foi possível gravar "${chave}" no servidor (${resp.status}).`);
  return ((await resp.json()) || []).length > 0;
}

/**
 * Ciclo completo: lê o servidor, mescla com o local (`mesclar(servidor|null, local) → { valor, mudouServidor }`), grava se mudou
 * (repete no conflito) e devolve { valor, gravou, criado }.
 */
export async function sincronizarDado(chave, local, mesclar, { fetchImpl = globalThis.fetch, tentativas = 3 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const atual = await lerDado(chave, fetchImpl);
    const r = mesclar(atual?.valor ?? null, local);
    if (!r.mudouServidor) return { valor: r.valor, gravou: false, criado: !atual };
    if (await gravarDado(chave, r.valor, atual?.versaoLinha || '', fetchImpl)) return { valor: r.valor, gravou: true, criado: !atual };
  }
  throw new Error(`"${chave}" mudou em outro computador durante a sincronização. Tente de novo.`);
}
