// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria } from '../src/core/athenes_conta.js';
import { gravarSessaoSupabase } from '../src/core/athenes_supabase_auth.js';
import { mesclarPerfil, sincronizarPerfil, idDoRegistroDoPerfil, ehRegistroDePerfil, entradaDoDocumento } from '../src/core/athenes_perfil_servidor.js';

const SYNC = '2026-11-03T10:00:00Z';
const doc = (id, extra = {}) => ({ id, titulo: `T ${id}`, tipoDoc: 'artigo', pastaId: 'p1', driveFileId: `F_${id}`, driveSincronizadoEm: SYNC, dataModificacao: '2026-11-03T09:00:00Z', ...extra });
const pasta = (id, subs = []) => ({ id, nome: id, subpastas: subs });

test('primeira vez: o estado do computador vira o índice do servidor', () => {
  const r = mesclarPerfil(null, { pastas: [pasta('p1')], documentos: [doc('a'), doc('b', { compartilhadoComigo: true })], excluidos: {} });
  assert.deepEqual(r.indice.documentos.map(d => d.id), ['a'], 'documento de outra pessoa não entra no índice do dono');
  assert.equal(r.mudouServidor, true);
  assert.deepEqual(r.remover, []);
});

test('o que outro computador criou aparece aqui; pastas se somam com os mesmos ids', () => {
  const servidor = { pastas: [pasta('p1', [pasta('arq')])], documentos: [entradaDoDocumento(doc('x', { pastaId: 'arq' }))], excluidos: {} };
  const r = mesclarPerfil(servidor, { pastas: [pasta('p1'), pasta('local_nova')], documentos: [doc('a')], excluidos: {} });
  assert.deepEqual(r.adicionar.map(e => e.id), ['x']);
  assert.deepEqual(r.pastas.map(p => p.id).sort(), ['local_nova', 'p1']);
  assert.deepEqual(r.pastas.find(p => p.id === 'p1').subpastas.map(p => p.id), ['arq'], 'a subpasta criada no outro PC chega com o mesmo id');
  assert.ok(r.indice.documentos.some(d => d.id === 'a'), 'o documento novo daqui sobe para o servidor');
});

test('excluído em outro computador sai daqui; com edição pendente a edição vence e o documento volta', () => {
  const servidor = { pastas: [], documentos: [], excluidos: { 'f:F_a': '2026-11-03T11:00:00Z', 'f:F_b': '2026-11-03T11:00:00Z' } };
  const r = mesclarPerfil(servidor, { pastas: [], documentos: [doc('a'), doc('b', { dataModificacao: '2026-11-03T12:00:00Z' })], excluidos: {} });
  assert.deepEqual(r.remover, ['a']);
  assert.deepEqual(r.indice.documentos.map(d => d.id), ['b'], 'o editado volta ao índice');
  assert.ok(!('f:F_b' in r.indice.excluidos));
});

test('exclusão feita aqui vai para o servidor e o documento não volta', () => {
  const servidor = { pastas: [], documentos: [entradaDoDocumento(doc('a'))], excluidos: {} };
  const r = mesclarPerfil(servidor, { pastas: [], documentos: [], excluidos: { 'f:F_a': '2026-11-03T11:00:00Z' } });
  assert.deepEqual(r.indice.documentos, []);
  assert.ok('f:F_a' in r.indice.excluidos);
  assert.deepEqual(r.adicionar, [], 'nada para trazer de volta');
});

test('mais recente vence (título e pasta); mesmo arquivo importado com outro id vira uma entrada só, com o id original', () => {
  const servidor = { pastas: [], documentos: [{ ...entradaDoDocumento(doc('a')), titulo: 'Novo título', pastaId: 'arq', atualizadoEm: '2026-11-03T09:30:00Z' }], excluidos: {} };
  const r = mesclarPerfil(servidor, { pastas: [], documentos: [doc('a')], excluidos: {} });
  assert.deepEqual(r.atualizar.map(x => [x.local, x.entrada.titulo, x.entrada.pastaId]), [['a', 'Novo título', 'arq']]);
  const r2 = mesclarPerfil({ pastas: [], documentos: [entradaDoDocumento(doc('doc_original', { driveFileId: 'FX' }))], excluidos: {} }, { pastas: [], documentos: [doc('drive_FX', { driveFileId: 'FX' })], excluidos: {} });
  assert.deepEqual(r2.indice.documentos.map(d => d.id), ['doc_original']);
  assert.deepEqual(r2.atualizar.map(x => [x.local, x.entrada.id]), [['drive_FX', 'doc_original']]);
});

test('sem nada novo o servidor não é regravado (as chaves do JSON podem vir em outra ordem)', () => {
  const servidor = { pastas: [pasta('p1')], documentos: [entradaDoDocumento(doc('a'))], excluidos: {} };
  const embaralhado = { excluidos: {}, documentos: servidor.documentos.map(e => Object.fromEntries(Object.entries(e).reverse())), pastas: servidor.pastas, versao: 7 };
  assert.equal(mesclarPerfil(embaralhado, { pastas: [pasta('p1')], documentos: [doc('a')], excluidos: {} }).mudouServidor, false);
});

test('rede: lê com o JWT, grava só se ninguém gravou antes e tenta de novo no conflito; o registro do perfil é reconhecível', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  _reiniciarContaEmMemoria?.();
  gravarSessaoSupabase({ access_token: 'JWT', refresh_token: 'R', expira_em: Date.now() + 3600_000, user_id: 'U1', email: 'a@x.com' });
  assert.ok(ehRegistroDePerfil(idDoRegistroDoPerfil('U1')) && !ehRegistroDePerfil('doc_123'));
  let linha = null; let conflitos = 1; const chamadas = [];
  const f = async (url, op = {}) => {
    chamadas.push(`${op.method || 'GET'} ${decodeURIComponent(url).split('?')[1]}`);
    assert.equal(op.headers.Authorization, 'Bearer JWT');
    if (!op.method) return { ok: true, status: 200, json: async () => (linha ? [linha] : []) };
    if (op.method === 'POST') { linha = { conteudo_json: JSON.parse(op.body).conteudo_json, atualizado_em: 'T1' }; return { ok: true, status: 201, json: async () => [] }; }
    if (conflitos-- > 0) { linha = { conteudo_json: { pastas: [], documentos: [entradaDoDocumento(doc('outro'))], excluidos: {} }, atualizado_em: 'T9' }; return { ok: true, status: 200, json: async () => [] }; } // alguém gravou antes
    linha = { conteudo_json: JSON.parse(op.body).conteudo_json, atualizado_em: 'T2' }; return { ok: true, status: 200, json: async () => [linha] };
  };
  const r1 = await sincronizarPerfil({ pastas: [pasta('p1')], documentos: [doc('a')], excluidos: {} }, { fetchImpl: f });
  assert.equal(r1.criado, true); assert.equal(linha.atualizado_em, 'T1');
  const r2 = await sincronizarPerfil({ pastas: [pasta('p1')], documentos: [doc('a'), doc('novo')], excluidos: {} }, { fetchImpl: f });
  assert.equal(r2.gravou, true);
  assert.deepEqual(r2.indice.documentos.map(d => d.id).sort(), ['a', 'novo', 'outro'], 'depois do conflito, mescla com o que o outro computador gravou');
  assert.ok(chamadas.some(c => /atualizado_em=eq\.T1/.test(c)), 'a gravação confere a versão lida');
});
