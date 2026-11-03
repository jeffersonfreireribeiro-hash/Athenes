// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loginGoogleCompleto, uriCallbackGoogle } from '../src/core/athenes_colaboracao.js';

const jwtDe = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

function janelaFalsa({ bloqueada = false } = {}) {
  const ouvintes = new Set();
  const popup = { closed: false, close() { this.closed = true; }, location: { href: '' } };
  return {
    popup,
    open: () => (bloqueada ? null : popup),
    addEventListener: (_, f) => ouvintes.add(f),
    removeEventListener: (_, f) => ouvintes.delete(f),
    responder: (fragmento, origin = 'https://athenes.vercel.app') => ouvintes.forEach(f => f({ origin, data: { athenesOAuth: fragmento } }))
  };
}

test.beforeEach(() => { globalThis.location = { origin: 'https://athenes.vercel.app' }; });

test('um só popup devolve o token do Drive e o ID token, com state e nonce conferidos', async () => {
  const j = janelaFalsa();
  const p = loginGoogleCompleto('CLIENTE', { janela: j });
  await new Promise(r => setTimeout(r, 20));
  const url = new URL(j.popup.location.href);
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('response_type'), 'token id_token');
  assert.equal(url.searchParams.get('redirect_uri'), uriCallbackGoogle());
  assert.match(url.searchParams.get('scope'), /drive\.file/);
  const idToken = jwtDe({ email: 'a@x.com', name: 'Ana', nonce: url.searchParams.get('nonce') });
  j.responder(`access_token=AT&id_token=${idToken}&expires_in=3599&state=${url.searchParams.get('state')}`);
  const r = await p;
  assert.deepEqual([r.accessToken, r.claims.email, r.expiresIn], ['AT', 'a@x.com', 3599]);
  assert.equal(j.popup.closed, true);
  assert.ok(r.nonce && r.nonce !== url.searchParams.get('nonce'), 'o Google recebe o hash; o Supabase recebe o valor original');
});

test('state ou nonce trocados, erro do Google e popup bloqueado são recusados com explicação', async () => {
  let j = janelaFalsa(); let p = loginGoogleCompleto('C', { janela: j }); await new Promise(r => setTimeout(r, 20));
  j.responder('access_token=AT&id_token=' + jwtDe({ nonce: 'x' }) + '&state=errado');
  await assert.rejects(p, /state diferente/);

  j = janelaFalsa(); p = loginGoogleCompleto('C', { janela: j }); await new Promise(r => setTimeout(r, 20));
  const st = new URL(j.popup.location.href).searchParams.get('state');
  j.responder(`access_token=AT&id_token=${jwtDe({ nonce: 'outro' })}&state=${st}`);
  await assert.rejects(p, /nonce diferente/);

  j = janelaFalsa(); p = loginGoogleCompleto('C', { janela: j }); await new Promise(r => setTimeout(r, 20));
  j.responder('error=access_denied');
  await assert.rejects(p, /recusado/);

  await assert.rejects(loginGoogleCompleto('C', { janela: janelaFalsa({ bloqueada: true }) }), /bloqueou a janela/);
});

test('mensagem de outra origem é ignorada e fechar a janela cancela com a dica da URI', async () => {
  const j = janelaFalsa(); const p = loginGoogleCompleto('C', { janela: j }); await new Promise(r => setTimeout(r, 20));
  j.responder('access_token=AT', 'https://malicioso.example');
  j.popup.closed = true;
  await assert.rejects(p, /redirect_uri_mismatch.*oauth_callback\.html/s);
});
