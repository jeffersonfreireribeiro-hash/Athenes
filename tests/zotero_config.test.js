// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { decidirConfigZotero, gravarConfigZotero, lerConfigZotero } from '../src/core/athenes_zotero_config.js';
import { mesclarPerfil } from '../src/core/athenes_perfil_servidor.js';

const velha = { userId: '1', apiKey: 'CHAVE_VELHA', alteradoEm: '2026-01-01T00:00:00.000Z' };
const nova = { userId: '1', apiKey: 'CHAVE_NOVA', alteradoEm: '2026-06-01T00:00:00.000Z' };

test('vale a configuração mais recente, mesmo que um marcador diga "não mudou"', () => {
  assert.equal(decidirConfigZotero(nova, velha, { localMudou: false, remotoEm: velha.alteradoEm }), 'local');
  assert.equal(decidirConfigZotero(velha, nova, { localMudou: true, remotoEm: nova.alteradoEm }), 'remoto');
  assert.equal(decidirConfigZotero(nova, nova), 'igual');
});

test('sem hora (cópias antigas) vale o aviso de mudança local; sem hora local e com hora remota, o remoto só ganha se for mais novo', () => {
  assert.equal(decidirConfigZotero({ userId: '1', apiKey: 'A' }, { userId: '1', apiKey: 'B' }, { localMudou: true }), 'local');
  assert.equal(decidirConfigZotero({ userId: '1', apiKey: 'A' }, { userId: '1', apiKey: 'B' }, { localMudou: false }), 'remoto');
  assert.equal(decidirConfigZotero(nova, { userId: '1', apiKey: 'B' }, { localMudou: false }), 'local');
});

test('trocar a chave carimba a hora; gravar a mesma chave não mexe nela', () => {
  const guarda = new Map();
  globalThis.localStorage = { getItem: (k) => guarda.get(k) ?? null, setItem: (k, v) => guarda.set(k, v), removeItem: (k) => guarda.delete(k) };
  gravarConfigZotero({ apiKey: 'K1', userId: '9' }, () => '2026-02-01T00:00:00.000Z');
  assert.equal(lerConfigZotero().alteradoEm, '2026-02-01T00:00:00.000Z');
  gravarConfigZotero({ apiKey: 'K1', userId: '9', username: 'x' }, () => '2026-03-01T00:00:00.000Z');
  assert.equal(lerConfigZotero().alteradoEm, '2026-02-01T00:00:00.000Z');
  gravarConfigZotero({ apiKey: 'K2' }, () => '2026-04-01T00:00:00.000Z');
  assert.equal(lerConfigZotero().alteradoEm, '2026-04-01T00:00:00.000Z');
  delete globalThis.localStorage;
});

test('perfil no servidor: a chave nova deste computador não é trocada pela cópia antiga do servidor', () => {
  const servidor = { versao: 3, pastas: [], documentos: [], zotero: { cfg: velha, atualizadoEm: velha.alteradoEm } };
  const local = { pastas: [], documentos: [], zotero: { cfg: nova, mudou: false } }; // marcador diz "igual" (o do Drive já foi marcado)
  const r = mesclarPerfil(servidor, local);
  assert.equal(r.aplicarZotero, null, 'não devolve a chave velha para este computador');
  assert.equal(r.indice.zotero.cfg.apiKey, 'CHAVE_NOVA', 'o servidor passa a guardar a nova');
});

test('perfil no servidor: a chave mais nova do servidor (outro computador) é aplicada aqui', () => {
  const servidor = { versao: 3, pastas: [], documentos: [], zotero: { cfg: nova, atualizadoEm: nova.alteradoEm } };
  const local = { pastas: [], documentos: [], zotero: { cfg: velha, mudou: true } };
  const r = mesclarPerfil(servidor, local);
  assert.equal(r.aplicarZotero.apiKey, 'CHAVE_NOVA');
  assert.equal(r.aplicarZotero.alteradoEm, nova.alteradoEm);
});
