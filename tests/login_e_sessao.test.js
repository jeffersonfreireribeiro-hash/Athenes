// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterPerfilColaborador,
  salvarPerfilColaborador,
  estaSessaoAtiva,
  ativarSessao,
  encerrarSessao,
  obterOuCriarEstruturaPastasAthenes,
  GOOGLE_DRIVE_ESCOPO,
  GOOGLE_AUTH_ESCOPOS
} from '../src/core/athenes_colaboracao.js';

test('Athenes — Sistema de Login, Sessão e Continuidade Conectada', async (t) => {
  // Mock global storage
  const mockStorage = {
    local: new Map(),
    session: new Map()
  };

  globalThis.localStorage = {
    getItem: (k) => mockStorage.local.get(k) || null,
    setItem: (k, v) => mockStorage.local.set(k, String(v)),
    removeItem: (k) => mockStorage.local.delete(k),
    clear: () => mockStorage.local.clear()
  };

  globalThis.sessionStorage = {
    getItem: (k) => mockStorage.session.get(k) || null,
    setItem: (k, v) => mockStorage.session.set(k, String(v)),
    removeItem: (k) => mockStorage.session.delete(k),
    clear: () => mockStorage.session.clear()
  };

  await t.test('1. Sessão inicia desconectada sem login prévio', () => {
    mockStorage.local.clear();
    mockStorage.session.clear();
    assert.equal(estaSessaoAtiva(), false);
  });

  await t.test('2. Ativar sessão com "continuar conectado" persiste no localStorage', () => {
    mockStorage.local.clear();
    mockStorage.session.clear();

    ativarSessao(true);
    assert.equal(estaSessaoAtiva(), true);
    assert.equal(mockStorage.local.get('athenes_sessao_ativa'), 'conectado');
    assert.equal(mockStorage.session.has('athenes_sessao_ativa'), false);
  });

  await t.test('3. Ativar sessão sem "continuar conectado" salva apenas na sessionStorage', () => {
    mockStorage.local.clear();
    mockStorage.session.clear();

    ativarSessao(false);
    assert.equal(estaSessaoAtiva(), true);
    assert.equal(mockStorage.session.get('athenes_sessao_ativa'), 'conectado');
    assert.equal(mockStorage.local.has('athenes_sessao_ativa'), false);
  });

  await t.test('4. Encerrar sessão (Logout) limpa ambos os storages', () => {
    ativarSessao(true);
    assert.equal(estaSessaoAtiva(), true);

    encerrarSessao();
    assert.equal(estaSessaoAtiva(), false);
    assert.equal(mockStorage.local.has('athenes_sessao_ativa'), false);
    assert.equal(mockStorage.session.has('athenes_sessao_ativa'), false);
  });

  await t.test('5. GOOGLE_AUTH_ESCOPOS inclui openid, email, profile e drive.file', () => {
    assert.equal(GOOGLE_DRIVE_ESCOPO, 'https://www.googleapis.com/auth/drive.file');
    assert.ok(GOOGLE_AUTH_ESCOPOS.includes('openid'));
    assert.ok(GOOGLE_AUTH_ESCOPOS.includes('email'));
    assert.ok(GOOGLE_AUTH_ESCOPOS.includes('profile'));
    assert.ok(GOOGLE_AUTH_ESCOPOS.includes('drive.file'));
  });

  await t.test('6. obterOuCriarEstruturaPastasAthenes trata falha de rede/GCP amigavelmente sem travar login', async () => {
    // Simula resposta 403 Forbidden do Google Drive API (ex: API desabilitada no GCP)
    const mockFetchErro = async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: 'Google Drive API has not been used in project or is disabled.' }
      })
    });

    // Não deve lançar exceção destrutiva
    const res = await obterOuCriarEstruturaPastasAthenes('token_teste', null, mockFetchErro);
    assert.ok(res !== null);
    assert.equal(res.sucesso, false);
    assert.equal(res.pastaRaizId, null);
  });
});
