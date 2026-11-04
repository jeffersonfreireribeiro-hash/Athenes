// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { consultaDoDrive, listarConteudoDoDrive, copiarPdfDoDriveParaAthenes, ESCOPOS_COM_LEITURA } from '../src/core/athenes_drive_navegar.js';

test('consulta: conteúdo de uma pasta, busca em todo o Drive e compartilhados; aspas escapadas', () => {
  assert.match(consultaDoDrive({ pastaId: 'abc' }), /'abc' in parents and .*application\/pdf/);
  assert.ok(consultaDoDrive({ busca: "D'Ávila" }).includes(String.raw`name contains 'D\'Ávila'`));
  assert.match(consultaDoDrive({ compartilhados: true }), /sharedWithMe = true/);
  assert.ok(!/in parents/.test(consultaDoDrive({ busca: 'x' })));
  assert.ok(ESCOPOS_COM_LEITURA.includes('drive.readonly') && ESCOPOS_COM_LEITURA.includes('drive.file'));
});

test('lista separa pastas de PDFs e devolve a próxima página', async () => {
  const fetchImpl = async (url) => { assert.match(String(url), /pageSize=100/); return { ok: true, json: async () => ({ nextPageToken: 'T2', files: [{ id: 'p1', name: 'Teatros', mimeType: 'application/vnd.google-apps.folder' }, { id: 'f1', name: 'a.pdf', mimeType: 'application/pdf' }] }) }; };
  const r = await listarConteudoDoDrive('tok', { pastaId: 'root' }, fetchImpl);
  assert.deepEqual([r.pastas.length, r.pdfs.length, r.proximo], [1, 1, 'T2']);
});

test('sem permissão de leitura (403) ou sem token, avisa com semPermissao para a tela pedir o acesso', async () => {
  await assert.rejects(listarConteudoDoDrive('tok', {}, async () => ({ ok: false, status: 403 })), (e) => e.semPermissao === true && e.status === 403);
  await assert.rejects(listarConteudoDoDrive('', {}), (e) => e.semPermissao === true);
  await assert.rejects(listarConteudoDoDrive('tok', {}, async () => ({ ok: false, status: 500 })), (e) => e.semPermissao === false);
});

test('copiar: baixa o PDF e envia como arquivo novo na pasta do Athenes, sem alterar o original', async () => {
  const chamadas = [];
  const blob = new Blob(['%PDF-1.4 teste'], { type: 'application/pdf' });
  const fetchImpl = async (url, init = {}) => {
    const u = String(url); chamadas.push([init.method || 'GET', u.replace(/\?.*/, '')]);
    if (u.includes('upload/drive')) return { ok: true, json: async () => ({ id: 'NOVO', name: 'a.pdf' }) };
    if (u.includes('alt=media')) return { ok: true, blob: async () => blob };
    if (u.includes('/files?') && u.includes('Athenes') && !u.includes('Bibliografia_PDFs')) return { ok: true, json: async () => ({ files: [{ id: 'RAIZ', name: 'Athenes' }] }) };
    if (u.includes('/files?') && u.includes('Bibliografia_PDFs')) return { ok: true, json: async () => ({ files: [{ id: 'PASTA', name: 'Bibliografia_PDFs' }] }) };
    if (u.includes('/files?')) return { ok: true, json: async () => ({ files: [] }) };
    return { ok: true, json: async () => ({}) };
  };
  const r = await copiarPdfDoDriveParaAthenes('tok', { id: 'ORIG', name: 'a.pdf' }, { pastaNome: 'Bibliografia_PDFs', fetchImpl });
  assert.equal(r.id, 'NOVO'); assert.equal(r.jaExistia, false);
  assert.ok(chamadas.some(([m, u]) => m === 'POST' && u.includes('upload/drive')), 'enviou como arquivo novo');
  assert.ok(!chamadas.some(([m]) => m === 'DELETE' || m === 'PATCH'), 'o original não é alterado');
});

import { tokenPodeLerTodoODrive } from '../src/core/athenes_drive_navegar.js';

test('token só com drive.file não lê o resto do Drive (a lista viria vazia); com drive.readonly lê', async () => {
  const resp = (scope, ok = true, status = 200) => async () => ({ ok, status, json: async () => ({ scope }) });
  assert.equal(await tokenPodeLerTodoODrive('t1', resp('openid email https://www.googleapis.com/auth/drive.file')), false);
  assert.equal(await tokenPodeLerTodoODrive('t2', resp('openid https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly')), true);
  assert.equal(await tokenPodeLerTodoODrive('t3', resp('https://www.googleapis.com/auth/drive')), true);
  assert.equal(await tokenPodeLerTodoODrive('t4', resp('', false, 400)), false, 'token inválido: pede de novo');
  assert.equal(await tokenPodeLerTodoODrive('t5', async () => { throw new Error('offline'); }), true, 'sem rede para consultar: tenta listar');
  assert.equal(await tokenPodeLerTodoODrive(''), false);
});
