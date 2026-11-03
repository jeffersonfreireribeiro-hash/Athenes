// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { sincronizarPastasComDrive, enviarDocumentoAoDrive, sincronizarDocumentosComDrive, precisaEnviarAoDrive, buscarOuCriarPasta } from '../src/core/athenes_drive_sync.js';
import { criarDocumento } from '../src/core/athenes_documento.js';

// Drive falso em memória: pastas, arquivos, busca por nome/pai, criação, upload multipart e troca de pai
function driveFalso({ falharCriacaoDe = null, status401 = false } = {}) {
  const itens = []; let n = 0;
  const json = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => JSON.stringify(o) });
  const fetchImpl = async (url, op = {}) => {
    if (status401) return json({ error: { message: 'Invalid Credentials' } }, 401);
    const u = new URL(url);
    const metodo = op.method || 'GET';
    if (u.pathname === '/drive/v3/files' && metodo === 'GET') {
      const q = u.searchParams.get('q');
      const nome = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\'/g, "'");
      const pai = /'([^']+)' in parents/.exec(q)?.[1];
      return json({ files: itens.filter(i => i.mime === 'pasta' && i.name === nome && (!pai || i.parents.includes(pai))).map(i => ({ id: i.id, name: i.name })) });
    }
    if (u.pathname === '/drive/v3/files' && metodo === 'POST') {
      const b = JSON.parse(op.body);
      if (b.name === falharCriacaoDe) return json({ error: { message: 'cota' } }, 403);
      const it = { id: `d${++n}`, name: b.name, mime: 'pasta', parents: b.parents || [] }; itens.push(it); return json({ id: it.id });
    }
    if (u.pathname.startsWith('/upload/drive/v3/files')) {
      const corpo = String(op.body);
      const meta = JSON.parse(/\r\n\r\n(\{.*?\})\r\n--/s.exec(corpo)[1]);
      if (metodo === 'PATCH') {
        const it = itens.find(i => i.id === decodeURIComponent(u.pathname.split('/').pop()));
        if (!it) return json({ error: { message: 'nf' } }, 404);
        it.name = meta.name; return json({ id: it.id, name: it.name });
      }
      const it = { id: `d${++n}`, name: meta.name, mime: 'arquivo', parents: meta.parents || [] }; itens.push(it); return json({ id: it.id, name: it.name });
    }
    if (metodo === 'PATCH') { // mover entre pastas
      const it = itens.find(i => i.id === decodeURIComponent(u.pathname.split('/').pop()));
      if (!it) return json({ error: { message: 'nf' } }, 404);
      it.parents = it.parents.filter(p => p !== u.searchParams.get('removeParents')).concat(u.searchParams.get('addParents')); return json({ id: it.id });
    }
    return json({}, 400);
  };
  return { fetchImpl, itens };
}
const arvore = () => [
  { id: 'pasta_bib_raiz', nome: 'Bibliografia & Leituras', tipo: 'bibliografia', origem: 'minhas', subpastas: [] },
  { id: 'pasta_rel_raiz', nome: 'Relatórios & Artigos', tipo: 'relatorios', origem: 'minhas', subpastas: [{ id: 'sub_1', nome: "Tese d'Água", tipo: 'relatorios', origem: 'minhas', subpastas: [{ id: 'sub_2', nome: 'Capítulo 1', origem: 'minhas', subpastas: [] }] }] }
];
const storageFalso = () => { const m = new Map(); globalThis.localStorage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('pastas locais (inclusive aninhadas) são criadas no Drive sob a raiz Athenes e guardam o driveId', async () => {
  storageFalso();
  const d = driveFalso(); const pastas = arvore();
  const r = await sincronizarPastasComDrive('tk', { fetchImpl: d.fetchImpl, pastas });
  assert.equal(r.erros.length, 0, JSON.stringify(r.erros));
  const por = (nome) => d.itens.find(i => i.name === nome);
  const raiz = por('Athenes');
  assert.ok(raiz && por('Relatórios & Artigos').parents.includes(raiz.id));
  assert.ok(por("Tese d'Água").parents.includes(por('Relatórios & Artigos').id), 'subpasta fica dentro da pasta-mãe (e aspas no nome funcionam)');
  assert.ok(por('Capítulo 1').parents.includes(por("Tese d'Água").id), 'aninhamento de 3 níveis');
  assert.equal(pastas[1].subpastas[0].subpastas[0].driveId, por('Capítulo 1').id);
  const antes = d.itens.length;
  await sincronizarPastasComDrive('tk', { fetchImpl: d.fetchImpl, pastas });
  assert.equal(d.itens.length, antes, 'rodar de novo não duplica pastas');
});

test('pasta já existente no Drive é reaproveitada (não cria outra de mesmo nome)', async () => {
  storageFalso();
  const d = driveFalso();
  const a = await buscarOuCriarPasta('tk', 'X', null, d.fetchImpl);
  const b = await buscarOuCriarPasta('tk', 'X', null, d.fetchImpl);
  assert.equal(a.criada, true); assert.equal(b.criada, false); assert.equal(a.id, b.id);
});

test('documento vai para a pasta do Drive do seu pastaId; atualizar não duplica; mover troca o pai', async () => {
  storageFalso();
  const d = driveFalso(); const pastas = arvore();
  const doc = criarDocumento({ titulo: 'Meu Relatório: v1/2' }); doc.pastaId = 'sub_1';
  await enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas });
  const arq = d.itens.find(i => i.mime === 'arquivo');
  assert.equal(arq.name, 'Meu Relatório_ v1_2.athenes');
  assert.deepEqual(arq.parents, [pastas[1].subpastas[0].driveId]);
  assert.equal(doc.driveFileId, arq.id);
  await enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas });
  assert.equal(d.itens.filter(i => i.mime === 'arquivo').length, 1, 'segundo envio atualiza o mesmo arquivo');
  doc.pastaId = 'pasta_bib_raiz';
  await enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas });
  assert.deepEqual(arq.parents, [pastas[0].driveId], 'mudou de pasta no Drive');
});

test('envio simultâneo do mesmo documento não cria o arquivo duas vezes', async () => {
  storageFalso();
  const d = driveFalso(); const pastas = arvore();
  const doc = criarDocumento({ titulo: 'Corrida' }); doc.pastaId = 'pasta_rel_raiz';
  await Promise.all([enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas }), enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas })]);
  assert.equal(d.itens.filter(i => i.mime === 'arquivo').length, 1);
});

test('arquivo apagado no Drive é recriado; pendências só incluem o que mudou', async () => {
  storageFalso();
  const d = driveFalso(); const pastas = arvore();
  const doc = criarDocumento({ titulo: 'Recria' }); doc.pastaId = 'pasta_rel_raiz';
  assert.equal(precisaEnviarAoDrive(doc, pastas), true);
  await enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas });
  assert.equal(precisaEnviarAoDrive(doc, pastas), false);
  doc.dataModificacao = new Date(Date.now() + 5000).toISOString();
  assert.equal(precisaEnviarAoDrive(doc, pastas), true);
  d.itens.splice(d.itens.findIndex(i => i.mime === 'arquivo'), 1);
  const antigo = doc.driveFileId;
  await enviarDocumentoAoDrive(doc, 'tk', { fetchImpl: d.fetchImpl, pastas });
  assert.notEqual(doc.driveFileId, antigo);
  assert.equal(d.itens.filter(i => i.mime === 'arquivo').length, 1);
});

test('falhas não são silenciosas: pasta com erro vira relatório, filhos esperam, 401 sinaliza sessão expirada', async () => {
  storageFalso();
  const d = driveFalso({ falharCriacaoDe: 'Relatórios & Artigos' });
  const r = await sincronizarPastasComDrive('tk', { fetchImpl: d.fetchImpl, pastas: arvore() });
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].erro, /403/);
  assert.ok(!d.itens.some(i => i.name === "Tese d'Água"), 'sem a pasta-mãe no Drive não cria as filhas');
  storageFalso();
  const exp = driveFalso({ status401: true });
  const r2 = await sincronizarPastasComDrive('tk', { fetchImpl: exp.fetchImpl, pastas: arvore() });
  assert.equal(r2.sessaoExpirada, true);
  const r3 = await sincronizarDocumentosComDrive([criarDocumento({ titulo: 'A' })], 'tk', { fetchImpl: exp.fetchImpl, pastas: arvore() });
  assert.equal(r3.sessaoExpirada, true); assert.equal(r3.enviados, 0);
});
