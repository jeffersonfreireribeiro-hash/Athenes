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

test('dois computadores com pastas "Athenes" duplicadas passam a usar a mais antiga', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { obterPastaRaizDrive } = await import('../src/core/athenes_drive_sync.js');
  const { salvarConfigGoogleDrive, obterConfigGoogleDrive } = await import('../src/core/athenes_colaboracao.js');
  salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), pastaRaizId: 'RAIZ_NOVA', pastaDocumentosId: 'DOCS_NOVA', pastaId: 'DOCS_NOVA' });
  const fetchFalso = async (url) => {
    const u = new URL(url);
    if (u.pathname === '/drive/v3/files/RAIZ_NOVA') return resp({ id: 'RAIZ_NOVA', trashed: false });
    if (/orderBy=createdTime/.test(url)) return resp({ files: [{ id: 'RAIZ_ANTIGA' }, { id: 'RAIZ_NOVA' }] });
    return resp({ files: [] });
  };
  const pastas = [{ id: 'p1', nome: 'X', driveId: 'D1', subpastas: [] }];
  assert.equal(await obterPastaRaizDrive('TK', fetchFalso, pastas), 'RAIZ_ANTIGA');
  const cfg = obterConfigGoogleDrive();
  assert.equal(cfg.pastaRaizId, 'RAIZ_ANTIGA');
  assert.ok(!cfg.pastaDocumentosId, 'a estrutura da pasta nova é descartada');
  assert.equal(cfg.pastaId, 'RAIZ_ANTIGA', 'a pasta do Athenes da conta é a raiz, igual em todos os computadores');
  assert.equal(cfg.pastaUrl, 'https://drive.google.com/drive/folders/RAIZ_ANTIGA');
  assert.equal(pastas[0].driveId, undefined, 'pastas locais esquecem os ids da raiz antiga para revincular');
});

test('documento vindo de outro computador volta para a pasta certa pelo vínculo com o Drive', async () => {
  const { repararPastaDosDocumentos } = await import('../src/core/athenes_drive_sync.js');
  const pastas = [{ id: 'pasta_rel_raiz', nome: 'Relatórios', driveId: 'F1', subpastas: [{ id: 'drive_F11', nome: 'ARQ.CON', driveId: 'F11', subpastas: [] }] }];
  const docs = [{ id: 'a', pastaId: 'sub_do_outro_pc', driveFolderId: 'F11' }, { id: 'b', pastaId: 'pasta_rel_raiz', driveFolderId: 'F1' }, { id: 'c', pastaId: 'inexistente' }];
  assert.equal(repararPastaDosDocumentos(docs, pastas), 1);
  assert.deepEqual(docs.map(d => d.pastaId), ['drive_F11', 'pasta_rel_raiz', 'inexistente']);
});

test('a pasta do Athenes no Drive é fixa: sempre a raiz, mesmo que alguém tente gravar outra', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { salvarConfigGoogleDrive, obterConfigGoogleDrive } = await import('../src/core/athenes_colaboracao.js');
  salvarConfigGoogleDrive({ pastaRaizId: 'RAIZ', pastaDocumentosId: 'DOCS', pastaId: 'DOCS', pastaUrl: 'https://drive.google.com/drive/folders/OUTRA' });
  const cfg = obterConfigGoogleDrive();
  assert.deepEqual([cfg.pastaId, cfg.pastaUrl], ['RAIZ', 'https://drive.google.com/drive/folders/RAIZ']);
});

test('documento movido de pasta em outro computador segue o Drive, mas mudança local pendente não é desfeita', () => {
  const mapa = { F1: 'pasta_rel_raiz', F11: 'drive_F11' };
  // aqui o documento ainda está na pasta antiga e não há mudança pendente: segue o Drive
  const a = [{ id: 'a', driveFileId: 'x', driveFolderId: 'F1', pastaId: 'pasta_rel_raiz', driveSincronizadoEm: '2026-11-01T00:00:00Z', dataModificacao: '2026-11-01T00:00:00Z' }];
  mesclarBibliotecaDrive(a, [{ driveFileId: 'x', titulo: 'A', modificadoEm: '2026-11-01T00:00:00Z', driveFolderId: 'F11' }], mapa);
  assert.deepEqual([a[0].pastaId, a[0].driveFolderId], ['drive_F11', 'F11']);
  // aqui o usuário já moveu o documento para outra pasta e ainda não enviou: mantém a escolha local
  const b = [{ id: 'b', driveFileId: 'y', driveFolderId: 'F1', pastaId: 'minha_outra_pasta', driveSincronizadoEm: '2026-11-01T00:00:00Z', dataModificacao: '2026-11-02T00:00:00Z' }];
  mesclarBibliotecaDrive(b, [{ driveFileId: 'y', titulo: 'B', modificadoEm: '2026-11-01T00:00:00Z', driveFolderId: 'F11' }], mapa);
  assert.equal(b[0].pastaId, 'minha_outra_pasta');
});

test('o Drive mostra o arquivo solto na raiz mas o registro diz que está na pasta: o registro é corrigido para o envio mover', () => {
  const pastas = [{ id: 'sub_arq', nome: 'ARQ.CON', driveId: 'F_ARQ', subpastas: [] }];
  const docs = [{ id: 'a', driveFileId: 'x', pastaId: 'sub_arq', driveFolderId: 'F_ARQ', driveSincronizadoEm: '2026-11-03T00:00:00Z', dataModificacao: '2026-11-01T00:00:00Z' }];
  mesclarBibliotecaDrive(docs, [{ driveFileId: 'x', titulo: 'A', modificadoEm: '2026-11-03T00:00:00Z', driveFolderId: 'RAIZ' }], {}, pastas);
  assert.equal(docs[0].driveFolderId, 'RAIZ', 'o lugar real passa a constar; precisaEnviarAoDrive vê a diferença e move');
});

test('documento excluído não volta ao sincronizar e o arquivo vai para a lixeira do Drive (nunca o de outra pessoa)', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { registrarExclusoes, excluidosDoDrive, idsExcluidos, processarExclusoesPendentes } = await import('../src/core/athenes_drive_sync.js');
  registrarExclusoes([
    { id: 'a', driveFileId: 'FA', salvoNuvem: true },
    { id: 'b', driveFileId: 'FB', proprietarioExterno: true, compartilhadoComigo: true },
    { id: 'c' }
  ]);
  assert.deepEqual([...excluidosDoDrive()].sort(), ['FA', 'FB']);
  assert.ok(idsExcluidos().has('b') && idsExcluidos().has('c'));
  // a sincronização da biblioteca ignora o arquivo excluído
  const docs = [];
  const r = mesclarBibliotecaDrive(docs, [{ driveFileId: 'FA', titulo: 'A', modificadoEm: 'x', driveFolderId: '' }, { driveFileId: 'FN', titulo: 'Novo', modificadoEm: 'x', driveFolderId: '' }], {}, null);
  assert.deepEqual([r.novos, docs.map(d => d.driveFileId)], [1, ['FN']]);
  // lixeira: só o arquivo do próprio usuário
  const chamadas = [];
  const f = async (url, op) => { chamadas.push({ url, corpo: JSON.parse(op.body), metodo: op.method }); return resp({ id: 'FA' }); };
  assert.equal(await processarExclusoesPendentes('T', { fetchImpl: f }), 1);
  assert.match(chamadas[0].url, /\/files\/FA\?/);
  assert.deepEqual([chamadas[0].metodo, chamadas[0].corpo], ['PATCH', { trashed: true }]);
  assert.equal(await processarExclusoesPendentes('T', { fetchImpl: f }), 0, 'já está na lixeira: não repete');
  assert.equal(chamadas.length, 1);
});

test('excluído em outro computador: sai da lista só se o Drive confirma (lixeira/404) e não há alteração pendente', async () => {
  const { docsRemovidosDoDrive } = await import('../src/core/athenes_drive_sync.js');
  const sync = '2026-11-03T10:00:00Z';
  const docs = [
    { id: 'lixeira', driveFileId: 'F1', driveSincronizadoEm: sync, dataModificacao: '2026-11-03T09:00:00Z' },
    { id: 'apagado', driveFileId: 'F2', driveSincronizadoEm: sync, dataModificacao: '2026-11-03T09:00:00Z' },
    { id: 'renomeado', driveFileId: 'F3', driveSincronizadoEm: sync, dataModificacao: '2026-11-03T09:00:00Z' },
    { id: 'editado_aqui', driveFileId: 'F4', driveSincronizadoEm: sync, dataModificacao: '2026-11-03T11:00:00Z' },
    { id: 'de_outra_pessoa', driveFileId: 'F5', driveSincronizadoEm: sync, dataModificacao: sync, proprietarioExterno: true },
    { id: 'na_lista', driveFileId: 'F6', driveSincronizadoEm: sync, dataModificacao: sync },
    { id: 'nunca_enviado' }
  ];
  const f = async (url) => {
    const id = decodeURIComponent(new URL(url).pathname.split('/').pop());
    if (id === 'F1') return resp({ id, trashed: true });
    if (id === 'F2') return resp({ error: { message: 'nf' } }, false, 404);
    if (id === 'F3') return resp({ id, trashed: false }); // só saiu da listagem (renomeado): continua
    throw new Error('consulta inesperada: ' + id);
  };
  const r = await docsRemovidosDoDrive(docs, [{ driveFileId: 'F6' }], 'T', { fetchImpl: f });
  assert.deepEqual(r.sort(), ['apagado', 'lixeira']);
});

test('pasta excluída vai para a lixeira do Drive só quando está vazia', async () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  const { registrarPastasExcluidas, processarPastasExcluidas, pastasExcluidasRegistradas } = await import('../src/core/athenes_drive_sync.js');
  registrarPastasExcluidas([{ id: 'p_cheia', driveId: 'D1' }, { id: 'p_vazia', driveId: 'D2' }, { id: 'p_local' }]);
  assert.deepEqual(Object.keys(pastasExcluidasRegistradas()).sort(), ['p_cheia', 'p_local', 'p_vazia']);
  const chamadas = [];
  const f = async (url, op = {}) => {
    const u = new URL(url);
    if (u.pathname === '/drive/v3/files') { const pai = /'([^']+)' in parents/.exec(u.searchParams.get('q'))[1]; return resp({ files: pai === 'D1' ? [{ id: 'arq' }] : [] }); }
    chamadas.push(`${op.method} ${u.pathname}`); return resp({ id: 'ok' });
  };
  assert.equal(await processarPastasExcluidas('T', { fetchImpl: f }), 1);
  assert.deepEqual(chamadas, ['PATCH /drive/v3/files/D2'], 'a pasta com arquivo dentro espera');
});
