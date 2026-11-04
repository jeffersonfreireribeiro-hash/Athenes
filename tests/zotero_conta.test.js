// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { enviarConexaoZoteroParaConta, resumoContaZotero } from '../src/core/athenes_zotero_conta.js';
import { gravarConfigZotero } from '../src/core/athenes_zotero_config.js';

const base = (extra = {}) => ({ nuvemAutenticada: () => true, montarEstadoLocal: () => ({}), listarDocumentos: () => [], obterTokenDrive: async () => 'tok', sincronizarZoteroComDrive: async () => 'enviou', sincronizarPerfil: async () => ({ gravou: true }), gravarConfigZotero: () => {}, ...extra });

test('chave nova vai para o servidor e para o Drive', async () => {
  const r = await enviarConexaoZoteroParaConta(base());
  assert.deepEqual([r.servidor, r.drive, r.erros.length], ['enviou', 'enviou', 0]);
  assert.match(resumoContaZotero(r), /conta: guardada ✓ · Drive: guardada ✓/);
});

test('sem login na nuvem ou sem Drive, avisa onde faltou em vez de fingir', async () => {
  const r = await enviarConexaoZoteroParaConta(base({ nuvemAutenticada: () => false, obterTokenDrive: async () => null }));
  assert.deepEqual([r.servidor, r.drive], ['sem_nuvem', 'sem_drive']);
  assert.match(resumoContaZotero(r), /entre com o Google.*Drive não conectado|entre com o Google/);
});

test('falha em um lado não impede o outro e vira erro explicado', async () => {
  const r = await enviarConexaoZoteroParaConta(base({ sincronizarPerfil: async () => { throw new Error('offline'); } }));
  assert.equal(r.servidor, 'erro'); assert.equal(r.drive, 'enviou'); assert.match(r.erros[0], /Servidor: offline/);
});

test('se a conta tem uma chave mais nova, ela é aplicada aqui', async () => {
  let aplicada = null;
  const r = await enviarConexaoZoteroParaConta(base({ sincronizarPerfil: async () => ({ gravou: false, aplicarZotero: { apiKey: 'N', userId: '1', alteradoEm: '2026-07-01T00:00:00.000Z' } }), gravarConfigZotero: (c) => { aplicada = c; } }));
  assert.equal(r.servidor, 'aplicou'); assert.equal(aplicada.alteradoEm, '2026-07-01T00:00:00.000Z');
});

test('gravar a chave dispara o aviso para a conta; cópia vinda da conta mantém a hora dela e igual não dispara', () => {
  const guarda = new Map(); let avisos = 0;
  globalThis.localStorage = { getItem: (k) => guarda.get(k) ?? null, setItem: (k, v) => guarda.set(k, v), removeItem: (k) => guarda.delete(k) };
  globalThis.window = { dispatchEvent: (e) => { if (e.type === 'athenes:zotero-alterado') avisos++; return true; } };
  gravarConfigZotero({ apiKey: 'K1', userId: '9' }, () => '2026-02-01T00:00:00.000Z');
  assert.equal(avisos, 1);
  gravarConfigZotero({ apiKey: 'K1', userId: '9' });
  assert.equal(avisos, 1, 'mesma chave: nada a enviar');
  const c = gravarConfigZotero({ apiKey: 'K2', userId: '9', alteradoEm: '2026-07-01T00:00:00.000Z' });
  assert.equal(c.alteradoEm, '2026-07-01T00:00:00.000Z');
  delete globalThis.localStorage; delete globalThis.window;
});
