// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { listarBibliotecaDoDrive, mesclarBibliotecaDrive, baixarDocumentoDoDrive } from '../src/core/athenes_drive_sync.js';

const resp = (corpo, ok = true, status = 200) => ({ ok, status, json: async () => corpo, text: async () => JSON.stringify(corpo) });

test('a biblioteca lista só os .athenes do Drive de quem está conectado (índice, sem conteúdo)', async () => {
  const chamadas = [];
  const fetchFalso = async (url, op) => { chamadas.push({ url, auth: op?.headers?.Authorization }); return resp({ files: [
    { id: 'f1', name: 'Meu artigo.athenes', modifiedTime: '2026-11-03T10:00:00Z' },
    { id: 'f2', name: 'notas.json', modifiedTime: '2026-11-02T10:00:00Z' },
    { id: 'f3', name: 'Outro.athenes', modifiedTime: '2026-11-01T10:00:00Z' }
  ] }); };
  const lista = await listarBibliotecaDoDrive('TOKEN-DA-ANA', { fetchImpl: fetchFalso });
  assert.deepEqual(lista.map(x => [x.driveFileId, x.titulo]), [['f1', 'Meu artigo'], ['f3', 'Outro']]);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].auth, 'Bearer TOKEN-DA-ANA', 'a consulta usa o token da própria conta');
  assert.ok(!chamadas.some(c => /supabase/.test(c.url)), 'não consulta o servidor global');
});

test('mesclar: traz só o que falta, não mexe no que já existe e marca o mais novo do Drive para baixar', () => {
  const docs = [
    { id: 'a', titulo: 'Local', driveFileId: 'f1', driveSincronizadoEm: '2026-11-01T00:00:00Z', dataModificacao: '2026-11-01T00:00:00Z' },
    { id: 'b', titulo: 'Editado aqui', driveFileId: 'f2', driveSincronizadoEm: '2026-11-01T00:00:00Z', dataModificacao: '2026-11-02T00:00:00Z' }
  ];
  const r = mesclarBibliotecaDrive(docs, [
    { driveFileId: 'f1', titulo: 'Local', modificadoEm: '2026-11-03T00:00:00Z' },
    { driveFileId: 'f2', titulo: 'Editado aqui', modificadoEm: '2026-11-03T00:00:00Z' },
    { driveFileId: 'f9', titulo: 'Só no Drive', modificadoEm: '2026-11-03T00:00:00Z' }
  ]);
  assert.deepEqual(r, { novos: 1, atualizados: 1 });
  const so = docs.find(d => d.driveFileId === 'f9');
  assert.deepEqual([so.origemDrive, so.precisaCarregarConteudo], [true, true]);
  assert.equal(docs.find(d => d.driveFileId === 'f1').precisaCarregarConteudo, true, 'o do Drive é mais novo');
  assert.ok(!docs.find(d => d.driveFileId === 'f2').precisaCarregarConteudo, 'edição local pendente não é sobrescrita');
});

test('abrir baixa o conteúdo do Drive e mantém o vínculo com o arquivo', async () => {
  const fetchFalso = async () => resp({ id: 'doc_1', titulo: 'Meu artigo', secoes: [] });
  const doc = await baixarDocumentoDoDrive({ id: 'drive_f1', driveFileId: 'f1' }, 'T', { fetchImpl: fetchFalso });
  assert.equal(doc.titulo, 'Meu artigo');
  assert.equal(doc.driveFileId, 'f1');
  assert.equal(doc.precisaCarregarConteudo, false);
  assert.ok(doc.driveSincronizadoEm >= (doc.dataModificacao || ''), 'não é reenviado ao Drive só por ter sido baixado');
});
