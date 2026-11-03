// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Sessão segura no Supabase (login Google → JWT do usuário).
 *
 * As regras de acesso do banco (RLS) comparam `auth.uid()` com o dono de cada linha. Para isso as chamadas à API precisam
 * levar o JWT DO USUÁRIO, e não só a chave anônima (que é pública). O JWT vem de trocar o ID token do Google por uma
 * sessão do Supabase (`grant_type=id_token`) e é renovado em silêncio com o refresh token.
 * Tudo recebe `fetchImpl`/`armazenamento` por parâmetro (testável sem rede nem navegador).
 */
import { lerConta, gravarConta, removerConta } from './athenes_conta.js';

const CHAVE_SESSAO = 'athenes_sb_sessao';
const MARGEM_MS = 60_000; // renova 1 min antes de vencer

export const lerSessaoSupabase = () => {
  try { return JSON.parse(lerConta(CHAVE_SESSAO) || 'null'); } catch { return null; }
};
export const gravarSessaoSupabase = (s) => gravarConta(CHAVE_SESSAO, JSON.stringify(s));
export const limparSessaoSupabase = () => removerConta(CHAVE_SESSAO);

/** Corpo (payload) de um JWT, sem validar assinatura (quem valida é o servidor). */
export function decodificarJwt(jwt) {
  try {
    const parte = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const txt = typeof atob === 'function' ? atob(parte) : Buffer.from(parte, 'base64').toString('binary');
    return JSON.parse(decodeURIComponent(Array.from(txt, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
  } catch { return null; }
}

function sessaoDaResposta(r) {
  const claims = decodificarJwt(r.access_token) || {};
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expira_em: (Number(r.expires_at) ? Number(r.expires_at) * 1000 : Date.now() + (Number(r.expires_in) || 3600) * 1000),
    user_id: r.user?.id || claims.sub || '',
    email: r.user?.email || claims.email || ''
  };
}

async function chamarAuth(cfg, grant, corpo, fetchImpl) {
  const resp = await fetchImpl(`${cfg.url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey },
    body: JSON.stringify(corpo)
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok || !dados.access_token) {
    const det = dados.error_description || dados.msg || dados.error || `status ${resp.status}`;
    const e = new Error(`Login na nuvem recusado: ${det}`);
    e.status = resp.status;
    throw e;
  }
  return sessaoDaResposta(dados);
}

/** Troca o ID token do Google por uma sessão do Supabase e a guarda (na conta ativa). */
export async function trocarIdTokenPorSessao(idToken, cfg, fetchImpl = globalThis.fetch) {
  if (!idToken) throw new Error('ID token do Google ausente.');
  const sessao = await chamarAuth(cfg, 'id_token', { provider: 'google', id_token: idToken }, fetchImpl);
  gravarSessaoSupabase(sessao);
  return sessao;
}

/**
 * JWT do usuário válido agora (renova com o refresh token quando está para vencer).
 * Null quando não há sessão ou ela não pode ser renovada: nesse caso a nuvem fica indisponível até entrar de novo.
 */
export async function tokenSupabaseValido(cfg, { fetchImpl = globalThis.fetch, agora = Date.now() } = {}) {
  const s = lerSessaoSupabase();
  if (!s?.access_token) return null;
  if (s.expira_em - MARGEM_MS > agora) return s.access_token;
  if (!s.refresh_token) { limparSessaoSupabase(); return null; }
  try {
    const nova = await chamarAuth(cfg, 'refresh_token', { refresh_token: s.refresh_token }, fetchImpl);
    gravarSessaoSupabase(nova);
    return nova.access_token;
  } catch (e) {
    if (e.status === 400 || e.status === 401) limparSessaoSupabase(); // refresh token inválido/usado: precisa entrar de novo
    return null;
  }
}

/** Cabeçalhos da API REST: com sessão leva o JWT do usuário; sem ela, só a chave anônima (que as regras do banco não aceitam mais). */
export async function cabecalhosSupabase(cfg, opcoes = {}) {
  const jwt = await tokenSupabaseValido(cfg, opcoes);
  return { apikey: cfg.anonKey, Authorization: `Bearer ${jwt || cfg.anonKey}` };
}

export const temSessaoSupabase = () => Boolean(lerSessaoSupabase()?.access_token);

/**
 * Pede ao Google o ID token (JWT) da conta com o botão oficial do Google Identity Services, dentro de um pequeno aviso.
 * (O fluxo de token de acesso usado no Drive não devolve ID token.) Rejeita se o usuário fechar o aviso.
 */
export function obterIdTokenGoogle(clientId, { carregarScript } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      if (typeof document === 'undefined') throw new Error('O login do Google requer o navegador.');
      if (!window.google?.accounts?.id) await carregarScript?.('https://accounts.google.com/gsi/client');
      if (!window.google?.accounts?.id) throw new Error('Não foi possível carregar o login do Google.');
      const fundo = document.createElement('div');
      fundo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:grid;place-items:center;padding:16px;';
      fundo.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Proteger documentos na nuvem" style="background:#fff;border-radius:14px;padding:22px 24px;max-width:360px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:system-ui,sans-serif;">
        <strong style="display:block;font-size:15px;color:#1F2733;margin-bottom:6px;">Proteger seus documentos na nuvem</strong>
        <p style="margin:0 0 14px;font-size:12.5px;color:#475569;line-height:1.45;">Confirme a mesma conta Google para que só você acesse seus documentos salvos na nuvem.</p>
        <div id="athGsiBotao" style="display:flex;justify-content:center;min-height:44px;"></div>
        <button type="button" id="athGsiPular" style="margin-top:12px;width:100%;border:0;background:transparent;color:#64748B;font-size:12px;cursor:pointer;">Agora não</button></div>`;
      const fechar = () => fundo.remove();
      fundo.querySelector('#athGsiPular').addEventListener('click', () => { fechar(); reject(new Error('Confirmação da conta Google adiada.')); });
      document.body.appendChild(fundo);
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => { fechar(); r?.credential ? resolve(r.credential) : reject(new Error('O Google não devolveu a credencial.')); },
        use_fedcm_for_prompt: true
      });
      window.google.accounts.id.renderButton(fundo.querySelector('#athGsiBotao'), { theme: 'filled_blue', size: 'large', text: 'continue_with', locale: 'pt-BR', width: 280 });
    } catch (e) { reject(e); }
  });
}

/** Fluxo completo: ID token do Google → sessão do Supabase. `obterIdToken` é injetável para teste. */
export async function entrarNoSupabaseComGoogle(cfg, clientId, { fetchImpl = globalThis.fetch, obterIdToken = obterIdTokenGoogle } = {}) {
  const idToken = await obterIdToken(clientId);
  return trocarIdTokenPorSessao(idToken, cfg, fetchImpl);
}
