// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria } from '../src/core/athenes_conta.js';
import { trocarIdTokenPorSessao, tokenSupabaseValido, cabecalhosSupabase, lerSessaoSupabase, limparSessaoSupabase, decodificarJwt, temSessaoSupabase } from '../src/core/athenes_supabase_auth.js';

const cfg = { url: 'https://x.supabase.co', anonKey: 'ANON' };
const jwtDe = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const resp = (corpo, ok = true, status = 200) => ({ ok, status, json: async () => corpo });

function armazenamentoFalso() {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  _reiniciarContaEmMemoria?.();
}

test('troca o ID token do Google por uma sessão e a guarda', async () => {
  armazenamentoFalso();
  const chamadas = [];
  const f = async (url, op) => { chamadas.push({ url, corpo: JSON.parse(op.body), apikey: op.headers.apikey }); return resp({ access_token: jwtDe({ sub: 'u1', email: 'a@x.com' }), refresh_token: 'R1', expires_in: 3600, user: { id: 'u1', email: 'a@x.com' } }); };
  const s = await trocarIdTokenPorSessao('ID-TOKEN', cfg, f);
  assert.match(chamadas[0].url, /\/auth\/v1\/token\?grant_type=id_token$/);
  assert.deepEqual(chamadas[0].corpo, { provider: 'google', id_token: 'ID-TOKEN' });
  assert.equal(chamadas[0].apikey, 'ANON');
  assert.deepEqual([s.user_id, s.email], ['u1', 'a@x.com']);
  assert.equal(lerSessaoSupabase().refresh_token, 'R1');
  assert.ok(temSessaoSupabase());
});

test('recusa do Supabase vira erro claro e não guarda sessão', async () => {
  armazenamentoFalso();
  await assert.rejects(() => trocarIdTokenPorSessao('ruim', cfg, async () => resp({ error_description: 'Bad ID token' }, false, 400)), /Bad ID token/);
  assert.equal(lerSessaoSupabase(), null);
});

test('o JWT é reaproveitado enquanto vale e renovado com o refresh token perto de vencer', async () => {
  armazenamentoFalso();
  await trocarIdTokenPorSessao('t', cfg, async () => resp({ access_token: jwtDe({ sub: 'u1' }), refresh_token: 'R1', expires_in: 3600 }));
  let chamadas = 0;
  const renovar = async (url, op) => { chamadas++; assert.match(url, /grant_type=refresh_token/); assert.equal(JSON.parse(op.body).refresh_token, 'R1'); return resp({ access_token: jwtDe({ sub: 'u1', n: 2 }), refresh_token: 'R2', expires_in: 3600 }); };
  const antes = lerSessaoSupabase().access_token;
  assert.equal(await tokenSupabaseValido(cfg, { fetchImpl: renovar }), antes);
  assert.equal(chamadas, 0);
  const novo = await tokenSupabaseValido(cfg, { fetchImpl: renovar, agora: Date.now() + 3600_000 });
  assert.equal(chamadas, 1);
  assert.notEqual(novo, antes);
  assert.equal(lerSessaoSupabase().refresh_token, 'R2');
});

test('refresh recusado derruba a sessão (precisa entrar de novo)', async () => {
  armazenamentoFalso();
  await trocarIdTokenPorSessao('t', cfg, async () => resp({ access_token: jwtDe({ sub: 'u1' }), refresh_token: 'R1', expires_in: 3600 }));
  const r = await tokenSupabaseValido(cfg, { fetchImpl: async () => resp({ error: 'invalid_grant' }, false, 400), agora: Date.now() + 3600_000 });
  assert.equal(r, null);
  assert.equal(lerSessaoSupabase(), null);
});

test('cabeçalhos: com sessão levam o JWT do usuário; sem sessão, só a chave anônima', async () => {
  armazenamentoFalso();
  assert.deepEqual(await cabecalhosSupabase(cfg), { apikey: 'ANON', Authorization: 'Bearer ANON' });
  await trocarIdTokenPorSessao('t', cfg, async () => resp({ access_token: jwtDe({ sub: 'u1' }), refresh_token: 'R', expires_in: 3600 }));
  const h = await cabecalhosSupabase(cfg);
  assert.equal(h.apikey, 'ANON');
  assert.notEqual(h.Authorization, 'Bearer ANON');
  limparSessaoSupabase();
  assert.equal((await cabecalhosSupabase(cfg)).Authorization, 'Bearer ANON');
  assert.equal(decodificarJwt(jwtDe({ sub: 'z' })).sub, 'z');
});
