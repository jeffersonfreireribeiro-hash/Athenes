// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { explicarErroDrive } from '../src/core/athenes_colaboracao.js';
import { sincronizarPastasComDrive } from '../src/core/athenes_drive_sync.js';

const ERRO_REAL = 'Google Drive API has not been used in project 948015162542 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=948015162542 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.';

test('403 "API não ativada" vira instrução em português com o link do projeto', () => {
  const m = explicarErroDrive(403, ERRO_REAL);
  assert.match(m, /ainda não está ativada/);
  assert.match(m, /nº 948015162542/);
  assert.match(m, /https:\/\/console\.developers\.google\.com\/apis\/api\/drive\.googleapis\.com\/overview\?project=948015162542/);
  assert.match(m, /2 a 5 minutos/);
  assert.equal(explicarErroDrive(403, '{"error":{"errors":[{"reason":"accessNotConfigured"}]}} project 111222333444'), explicarErroDrive(403, 'accessNotConfigured project=111222333444').replace('?project=111222333444', '?project=111222333444'));
  assert.match(explicarErroDrive(403, 'Request had insufficient authentication scopes.'), /Reconecte o Drive/);
  assert.equal(explicarErroDrive(500, ERRO_REAL), null, 'só o 403 é traduzido');
  assert.equal(explicarErroDrive(403, 'rate limit'), null);
});

test('a sincronização mostra a instrução (não o texto cru do Google) quando a API está desativada', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: ERRO_REAL } }), text: async () => ERRO_REAL });
  const r = await sincronizarPastasComDrive('tk', { fetchImpl, pastas: [{ id: 'a', nome: 'A', origem: 'minhas', subpastas: [] }] });
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].erro, /ainda não está ativada no projeto Google do Athenes/);
  assert.doesNotMatch(r.erros[0].erro, /has not been used/);
});
