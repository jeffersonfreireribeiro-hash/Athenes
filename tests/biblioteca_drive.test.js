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

test('outro computador: as pastas do Drive voltam para a árvore local e os documentos caem nas pastas certas', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { importarPastasDoDrive } = await import('../src/core/athenes_drive_sync.js');
  const filhos = {
    RAIZ: [{ id: 'F1', name: 'Relatórios & Artigos' }, { id: 'F2', name: 'Tese' }, { id: 'S', name: 'Documentos' }],
    F1: [{ id: 'F11', name: 'Capítulos' }], F2: [], F11: []
  };
  const fetchFalso = async (url) => {
    const q = decodeURIComponent(new URL(url).searchParams.get('q') || '');
    if (/name = 'Athenes'/.test(q)) return resp({ files: [{ id: 'RAIZ', name: 'Athenes' }] });
    const pai = /'([^']+)' in parents/.exec(q)?.[1];
    return resp({ files: filhos[pai] || [] });
  };
  const pastas = [
    { id: 'pasta_bib_raiz', nome: 'Bibliografia & Leituras', tipo: 'bibliografia', origem: 'minhas', subpastas: [] },
    { id: 'pasta_rel_raiz', nome: 'Relatórios & Artigos', tipo: 'relatorios', origem: 'minhas', subpastas: [] }
  ];
  const r = await importarPastasDoDrive('T', { fetchImpl: fetchFalso, pastas });
  assert.equal(pastas.find(p => p.id === 'pasta_rel_raiz').driveId, 'F1', 'a pasta local de mesmo nome é vinculada à do Drive');
  assert.equal(r.importadas, 2, 'Tese e Capítulos vieram do Drive');
  assert.ok(pastas.find(p => p.nome === 'Tese'));
  assert.equal(pastas.find(p => p.id === 'pasta_rel_raiz').subpastas[0].nome, 'Capítulos');
  assert.ok(!pastas.some(p => p.nome === 'Documentos'), 'pasta de sistema não vira pasta do usuário');

  const docs = [];
  const idCap = pastas.find(p => p.id === 'pasta_rel_raiz').subpastas[0].id;
  mesclarBibliotecaDrive(docs, [{ driveFileId: 'a1', titulo: 'Cap 1', modificadoEm: '2026-11-03T00:00:00Z', driveFolderId: 'F11' }], r.mapa);
  assert.deepEqual([docs[0].pastaId, docs[0].driveFolderId], [idCap, 'F11']);
});

test('a pasta padrão antiga (de outra conta) é descartada e o link mostrado vem do ID da pasta realmente usada', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { obterConfigGoogleDrive, salvarConfigGoogleDrive } = await import('../src/core/athenes_colaboracao.js');
  const LEGADO = '1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv';
  salvarConfigGoogleDrive({ pastaUrl: `https://drive.google.com/drive/folders/${LEGADO}?usp=drive_link`, pastaId: LEGADO });
  let cfg = obterConfigGoogleDrive();
  assert.deepEqual([cfg.pastaId, cfg.pastaUrl], ['', ''], 'o ID antigo nunca vale');
  salvarConfigGoogleDrive({ ...cfg, pastaId: 'PASTA_DESTA_CONTA' });
  cfg = obterConfigGoogleDrive();
  assert.equal(cfg.pastaUrl, 'https://drive.google.com/drive/folders/PASTA_DESTA_CONTA');
});

test('Zotero: conectado num computador aparece no outro; só o lado que mudou vence', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { sincronizarZoteroComDrive } = await import('../src/core/athenes_drive_sync.js');
  const { lerConta, gravarConta } = await import('../src/core/athenes_conta.js');
  const drive = { arquivo: null }; // o "Drive" compartilhado entre os dois computadores
  const fetchDrive = async (url, op = {}) => {
    const u = new URL(url);
    if (u.pathname === '/drive/v3/files' && /name = 'Athenes'/.test(u.searchParams.get('q') || '')) return resp({ files: [{ id: 'RAIZ' }] });
    if (u.pathname === '/drive/v3/files' && /athenes_config\.json/.test(u.searchParams.get('q') || '')) return resp({ files: drive.arquivo ? [{ id: 'CFG' }] : [] });
    if (u.pathname.startsWith('/upload/drive/v3/files')) { drive.arquivo = JSON.parse(String(op.body).split('\r\n').filter(l => l.startsWith('{"zotero"'))[0]); return resp({ id: 'CFG' }); }
    if (u.pathname === '/drive/v3/files/CFG') return resp(drive.arquivo);
    return resp({ files: [] });
  };
  // PC1 conecta o Zotero e sincroniza → vai para o Drive
  gravarConta('athenes_zotero_cfg', JSON.stringify({ userId: '123', apiKey: 'CHAVE1', username: 'ana' }));
  assert.equal(await sincronizarZoteroComDrive('T', { fetchImpl: fetchDrive }), 'enviou');
  assert.equal(drive.arquivo.zotero.apiKey, 'CHAVE1');
  // PC2 (sem nada) sincroniza → já aparece conectado
  m.clear();
  assert.equal(await sincronizarZoteroComDrive('T', { fetchImpl: fetchDrive }), 'baixou');
  assert.deepEqual([JSON.parse(lerConta('athenes_zotero_cfg')).userId, JSON.parse(lerConta('athenes_zotero_cfg')).apiKey], ['123', 'CHAVE1']);
  assert.equal(await sincronizarZoteroComDrive('T', { fetchImpl: fetchDrive }), 'igual');
  // PC2 troca a chave → vai para o Drive; PC1 (que não mudou) recebe
  gravarConta('athenes_zotero_cfg', JSON.stringify({ userId: '123', apiKey: 'CHAVE2', username: 'ana' }));
  assert.equal(await sincronizarZoteroComDrive('T', { fetchImpl: fetchDrive }), 'enviou');
  assert.equal(drive.arquivo.zotero.apiKey, 'CHAVE2');
});
