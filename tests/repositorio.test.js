// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria, gravarConta, lerConta } from '../src/core/athenes_conta.js';
import * as repo from '../src/core/athenes_repositorio.js';

function armazenamento() {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  _reiniciarContaEmMemoria?.(); repo.reiniciar();
  return m;
}

test('gravar documento fica só na memória: nada vai para o armazenamento do navegador', () => {
  const m = armazenamento();
  repo.gravarDocumento({ id: 'a', titulo: 'A' });
  repo.gravarDocumento({ id: 'b', titulo: 'B' });
  repo.gravarDocumento({ id: 'a', titulo: 'A2' });
  assert.deepEqual(repo.listar().map(d => [d.id, d.titulo]), [['b', 'B'], ['a', 'A2']]);
  assert.equal([...m.keys()].filter(k => /docs_indice|athenes_doc_/.test(k)).length, 0);
  repo.definir([{ id: 'x' }]);
  assert.deepEqual(repo.listar().map(d => d.id), ['x']);
  assert.equal([...m.keys()].filter(k => /docs_indice/.test(k)).length, 0);
});

test('documentos de versões antigas são lidos uma vez e a cópia só é apagada com tudo a salvo no Drive', () => {
  const m = armazenamento();
  gravarConta('athenes_docs_indice', JSON.stringify([{ id: 'a', driveFileId: 'F1' }, { id: 'b' }]));
  m.set('athenes_doc_zzz', 'x');
  assert.equal(repo.legadoPendente(), true);
  assert.equal(repo.carregarLegadoUmaVez(), 2);
  assert.equal(repo.carregarLegadoUmaVez(), 0, 'uma vez só por sessão');
  assert.deepEqual(repo.listar().map(d => d.id), ['a', 'b']);
  // 'b' ainda não está no Drive: nada é apagado
  assert.equal(repo.removerLegadoSeSeguro(d => Boolean(d.driveFileId)), false);
  assert.ok(lerConta('athenes_docs_indice'));
  // 'b' foi enviado: agora pode
  repo.gravarDocumento({ id: 'b', driveFileId: 'F2' });
  assert.equal(repo.removerLegadoSeSeguro(d => Boolean(d.driveFileId)), true);
  assert.equal(lerConta('athenes_docs_indice'), null);
  assert.equal(m.has('athenes_doc_zzz'), false, 'cópias antigas de documentos individuais também saem');
  assert.equal(repo.legadoPendente(), false);
});

test('documento excluído de propósito não impede a limpeza; outra conta não herda a memória', () => {
  armazenamento();
  gravarConta('athenes_docs_indice', JSON.stringify([{ id: 'a', driveFileId: 'F1' }, { id: 'apagado' }]));
  repo.carregarLegadoUmaVez();
  repo.definir(repo.listar().filter(d => d.id !== 'apagado'));
  assert.equal(repo.removerLegadoSeSeguro(d => Boolean(d.driveFileId)), true);
});
