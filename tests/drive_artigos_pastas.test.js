// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterOuCriarPastaDoArtigoNoDrive,
  moverArquivoNoDrive,
  moverArquivosDoArtigoNoDrive,
  reconciliarArtigosComDrive
} from '../src/core/athenes_drive_sync.js';
import { salvarConfigGoogleDrive } from '../src/core/athenes_colaboracao.js';

function criarFetchMock(respostas = {}) {
  const chamadas = [];
  const fetchMock = async (url, opts = {}) => {
    chamadas.push({ url, opts, method: opts.method || 'GET' });
    for (const [padrao, resposta] of Object.entries(respostas)) {
      if (url.includes(padrao)) {
        if (typeof resposta === 'function') {
          return resposta(url, opts);
        }
        return {
          ok: resposta.ok !== false,
          status: resposta.status || 200,
          json: async () => resposta.body || {}
        };
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'mock_padrao_id', files: [] })
    };
  };
  return { fetchMock, chamadas };
}

test('obterOuCriarPastaDoArtigoNoDrive: resolve a pasta de coleção correta dentro de Bibliografia', async () => {
  salvarConfigGoogleDrive({ accessToken: 'tok_teste_1', pastaRaizId: 'raiz_athenes_id' });

  const pastasLocais = [
    {
      id: 'pasta_bib_raiz',
      nome: 'Bibliografia & Leituras',
      tipo: 'bibliografia',
      driveId: 'drive_bib_raiz_id',
      subpastas: [
        {
          id: 'pasta_colecao_urbanismo',
          nome: 'Urbanismo e REURB',
          driveId: 'drive_urbanismo_id',
          subpastas: []
        }
      ]
    }
  ];

  const { fetchMock } = criarFetchMock();

  // 1. Busca pasta de coleção específica
  const idCol = await obterOuCriarPastaDoArtigoNoDrive('pasta_colecao_urbanismo', 'tok_teste_1', {
    fetchImpl: fetchMock,
    pastas: pastasLocais
  });
  assert.equal(idCol, 'drive_urbanismo_id', 'Deve retornar o driveId da pasta específica');

  // 2. Busca quando pastaId é "todas" ou nulo (vai para a raiz de bibliografia)
  const idBibRaiz = await obterOuCriarPastaDoArtigoNoDrive('todas', 'tok_teste_1', {
    fetchImpl: fetchMock,
    pastas: pastasLocais
  });
  assert.equal(idBibRaiz, 'drive_bib_raiz_id', 'Deve retornar o driveId da pasta raiz de bibliografia');
});

test('moverArquivoNoDrive: envia PATCH com addParents e removeParents para o Google Drive', async () => {
  let patchChamado = null;

  const { fetchMock } = criarFetchMock({
    'fields=id,parents,trashed': {
      ok: true,
      status: 200,
      body: { id: 'file_pdf_123', parents: ['pasta_antiga_id'], trashed: false }
    },
    'addParents=': (url, opts) => {
      patchChamado = { url, opts };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'file_pdf_123', parents: ['pasta_nova_id'] })
      };
    }
  });

  const res = await moverArquivoNoDrive('file_pdf_123', 'pasta_nova_id', 'token_teste', { fetchImpl: fetchMock });
  assert.ok(res);
  assert.equal(res.jaEstavaNaPasta, false, 'Deve indicar que o arquivo foi movido');
  assert.ok(patchChamado, 'Deve ter disparado o PATCH de movimentação');
  assert.match(patchChamado.url, /addParents=pasta_nova_id/);
  assert.match(patchChamado.url, /removeParents=pasta_antiga_id/);
  assert.equal(patchChamado.opts.method, 'PATCH');
});

test('moverArquivoNoDrive: não dispara PATCH se o arquivo já está na pasta destino', async () => {
  let patchChamado = false;

  const { fetchMock } = criarFetchMock({
    'fields=id,parents,trashed': {
      ok: true,
      status: 200,
      body: { id: 'file_pdf_123', parents: ['pasta_destino_id'], trashed: false }
    },
    'addParents=': () => {
      patchChamado = true;
      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  const res = await moverArquivoNoDrive('file_pdf_123', 'pasta_destino_id', 'token_teste', { fetchImpl: fetchMock });
  assert.ok(res);
  assert.equal(res.jaEstavaNaPasta, true, 'Deve indicar que já estava na pasta');
  assert.equal(patchChamado, false, 'Não deve fazer PATCH redundante');
});

test('moverArquivosDoArtigoNoDrive: move tanto o PDF quanto o arquivo de anotações JSON', async () => {
  const movidosUrls = [];

  const { fetchMock } = criarFetchMock({
    'fields=id,parents,trashed': (url) => {
      const id = url.includes('pdf_drive_456') ? 'pdf_drive_456' : 'anot_drive_789';
      return {
        ok: true,
        status: 200,
        json: async () => ({ id, parents: ['pasta_origem_id'], trashed: false })
      };
    },
    'addParents=': (url) => {
      movidosUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'ok' })
      };
    }
  });

  const pastas = [
    {
      id: 'pasta_bib_raiz',
      nome: 'Bibliografia & Leituras',
      tipo: 'bibliografia',
      driveId: 'drive_bib_raiz_id',
      subpastas: [
        {
          id: 'pasta_mestrado',
          nome: 'Mestrado',
          driveId: 'drive_mestrado_id',
          subpastas: []
        }
      ]
    }
  ];

  const art = {
    id: 'art_teste_01',
    titulo: 'Morfologia Urbana',
    pastaId: 'pasta_origem',
    driveFileId: 'pdf_drive_456',
    driveAnnotationFileId: 'anot_drive_789'
  };

  const resultado = await moverArquivosDoArtigoNoDrive(art, 'pasta_mestrado', {
    token: 'token_valido',
    fetchImpl: fetchMock,
    pastas
  });

  assert.equal(resultado.movidos, 2, 'Deve ter movido os 2 arquivos (PDF e Anotações)');
  assert.equal(resultado.erros.length, 0);
  assert.equal(art.driveFolderId, 'drive_mestrado_id', 'Deve atualizar driveFolderId no artigo');
  assert.equal(movidosUrls.length, 2);
  assert.ok(movidosUrls[0].includes('pdf_drive_456'));
  assert.ok(movidosUrls[1].includes('anot_drive_789'));
  assert.ok(movidosUrls[0].includes('addParents=drive_mestrado_id'));
  assert.ok(movidosUrls[1].includes('addParents=drive_mestrado_id'));
});

test('reconciliarArtigosComDrive: reorganiza artigos antigos salvos na raiz ou pasta errada para sua coleção', async () => {
  const patches = [];

  const { fetchMock } = criarFetchMock({
    'fields=id,parents,trashed': (url) => {
      // O PDF do art_antigo_1 estava na raiz antiga
      if (url.includes('antigo_pdf_1')) {
        return { ok: true, status: 200, json: async () => ({ id: 'antigo_pdf_1', parents: ['raiz_athenes_antiga'], trashed: false }) };
      }
      // O PDF do art_antigo_2 já estava na pasta certa
      if (url.includes('antigo_pdf_2')) {
        return { ok: true, status: 200, json: async () => ({ id: 'antigo_pdf_2', parents: ['drive_doutorado_id'], trashed: false }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'generico', parents: [], trashed: false }) };
    },
    'addParents=': (url) => {
      patches.push(url);
      return { ok: true, status: 200, json: async () => ({ id: 'ok' }) };
    }
  });

  const pastas = [
    {
      id: 'pasta_bib_raiz',
      nome: 'Bibliografia & Leituras',
      tipo: 'bibliografia',
      driveId: 'drive_bib_raiz_id',
      subpastas: [
        {
          id: 'pasta_doutorado',
          nome: 'Doutorado',
          driveId: 'drive_doutorado_id',
          subpastas: []
        }
      ]
    }
  ];

  const artigos = [
    {
      id: 'art_1',
      titulo: 'Acústica Arquitetônica',
      pastaId: 'pasta_doutorado',
      driveFileId: 'antigo_pdf_1',
      driveFolderId: 'raiz_athenes_antiga'
    },
    {
      id: 'art_2',
      titulo: 'Reverberação Sonora',
      pastaId: 'pasta_doutorado',
      driveFileId: 'antigo_pdf_2',
      driveFolderId: 'drive_doutorado_id'
    }
  ];

  const res = await reconciliarArtigosComDrive(artigos, 'token_sync_1', {
    fetchImpl: fetchMock,
    pastas
  });

  assert.equal(res.total, 2, 'Total de artigos com arquivos no Drive');
  assert.equal(res.movidos, 1, 'Apenas o artigo que estava fora da pasta deve ser movido');
  assert.equal(patches.length, 1, 'Deve ter disparado 1 PATCH no Drive');
  assert.ok(patches[0].includes('antigo_pdf_1'));
  assert.ok(patches[0].includes('addParents=drive_doutorado_id'));
  assert.ok(patches[0].includes('removeParents=raiz_athenes_antiga'));
  assert.equal(artigos[0].driveFolderId, 'drive_doutorado_id');
});
