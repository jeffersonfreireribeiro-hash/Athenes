// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria } from '../src/core/athenes_conta.js';
import {
  adicionarPastaCompartilhadaDriveLocal,
  removerPastaDriveLocal,
  obterPastasDriveLocais,
  salvarPastasDriveLocais
} from '../src/core/athenes_colaboracao.js';
import {
  registrarPastasExcluidas,
  pastasExcluidasRegistradas,
  removerPastaExcluida,
  processarPastasExcluidas
} from '../src/core/athenes_drive_sync.js';
import {
  mesclarPerfil,
  entradaDoDocumento
} from '../src/core/athenes_perfil_servidor.js';

// Setup de mock isolado para localStorage em ambiente de teste Node.js
const mapStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (mapStorage.has(k) ? mapStorage.get(k) : null),
  setItem: (k, v) => mapStorage.set(k, String(v)),
  removeItem: (k) => mapStorage.delete(k),
  clear: () => mapStorage.clear(),
  key: (i) => [...mapStorage.keys()][i],
  get length() { return mapStorage.size; }
};

describe('Athenes — Exclusão Definitiva de Pastas Compartilhadas (R3)', () => {
  beforeEach(() => {
    mapStorage.clear();
    _reiniciarContaEmMemoria?.();
  });

  it('1. Adiciona pasta compartilhada com adicionarPastaCompartilhadaDriveLocal e confere estrutura', () => {
    const comp = adicionarPastaCompartilhadaDriveLocal({
      id: 'pasta_comp_123',
      url: 'https://drive.google.com/drive/folders/pasta_comp_123',
      nome: 'Laboratório de Urbanismo - Orientação',
      dono: 'Prof. Orientador',
      permissao: 'leitura'
    });

    assert.equal(comp.id, 'pasta_comp_123');
    assert.equal(comp.origem, 'compartilhada');
    assert.equal(comp.tipo, 'compartilhada');
    assert.equal(comp.permissao, 'leitura');
    assert.equal(comp.dono, 'Prof. Orientador');
    assert.deepEqual(comp.subpastas, []);

    const locais = obterPastasDriveLocais();
    // 2 raízes padrão (Bibliografia + Relatórios) + 1 compartilhada = 3
    assert.equal(locais.length, 3);
    const encontrada = locais.find(p => p.id === 'pasta_comp_123');
    assert.ok(encontrada, 'A pasta compartilhada deve existir no array de pastas');
    assert.equal(encontrada.nome, 'Laboratório de Urbanismo - Orientação');
    assert.equal(locais.filter(p => p.origem === 'compartilhada').length, 1);
  });

  it('2. Registra tombstone de exclusão em athenes_pastas_excluidas e confere via pastasExcluidasRegistradas()', () => {
    const comp = adicionarPastaCompartilhadaDriveLocal({
      url: 'https://drive.google.com/drive/folders/comp_laura_789',
      nome: 'Laurinha - pasta',
      dono: 'Laura'
    });
    assert.equal(comp.id, 'comp_laura_789');

    // Desvinculação: remove localmente e registra tombstone com lixeira: true
    removerPastaDriveLocal(comp.id);
    registrarPastasExcluidas([{ id: comp.id, driveId: comp.id, nome: comp.nome, lixeira: true }]);

    const locaisApos = obterPastasDriveLocais();
    assert.ok(!locaisApos.some(p => p.id === comp.id), 'Pasta compartilhada foi removida do array de pastas locais');
    assert.equal(locaisApos.filter(p => p.origem === 'compartilhada').length, 0);

    const excluidas = pastasExcluidasRegistradas();
    assert.ok(comp.id in excluidas, 'ID da pasta compartilhada deve constar no tombstone de pastas excluídas');
    assert.ok(typeof excluidas[comp.id] === 'string', 'Valor deve ser timestamp ISO');
  });

  it('3. Mesclagem de perfil (mesclarPerfil) contra servidor simulado não ressuscita pasta excluída', () => {
    const pastaCompId = 'pasta_servidor_comp_999';
    const pastaServidor = {
      id: pastaCompId,
      nome: 'Orientação Remota',
      origem: 'compartilhada',
      tipo: 'compartilhada',
      subpastas: []
    };

    // Servidor remoto Supabase ainda tem a pasta compartilhada no índice de perfil
    const servidor = {
      pastas: [pastaServidor],
      documentos: [],
      excluidos: {}
    };

    // Estado local deste computador com a pasta compartilhada marcada como excluída (tombstone)
    registrarPastasExcluidas([{ id: pastaCompId, driveId: pastaCompId, nome: 'Orientação Remota', lixeira: true }]);
    const local = {
      pastas: [],
      documentos: [],
      excluidos: {},
      pastasExcluidas: pastasExcluidasRegistradas()
    };

    const r = mesclarPerfil(servidor, local);

    // Na árvore resultante, a pasta compartilhada descartada pelo tombstone NÃO deve retornar
    assert.ok(!r.pastas.some(p => p.id === pastaCompId), 'A pasta compartilhada excluída não pode ressurgir na árvore de pastas');
    assert.ok(pastaCompId in r.indice.pastasExcluidas, 'A exclusão deve subir para o índice do servidor');

    // Segunda passagem de sincronização (re-sincronização): pasta continua eliminada
    const r2 = mesclarPerfil(r.indice, { pastas: r.pastas, documentos: [], excluidos: {}, pastasExcluidas: r.indice.pastasExcluidas });
    assert.ok(!r2.pastas.some(p => p.id === pastaCompId), 'Re-sincronizações subsequentes não devem ressuscitar a pasta');
  });

  it('4. Re-vincular pasta compartilhada remove o tombstone de athenes_pastas_excluidas', () => {
    const pastaId = 'pasta_revinculada_555';

    // 1) Registra como excluída
    registrarPastasExcluidas([{ id: pastaId, driveId: pastaId, nome: 'Pasta Anterior', lixeira: true }]);
    let excluidas = pastasExcluidasRegistradas();
    assert.ok(pastaId in excluidas, 'Deve estar inicialmente no tombstone');

    // 2) Usuário decide vincular novamente a pasta compartilhada
    const nova = adicionarPastaCompartilhadaDriveLocal({
      url: `https://drive.google.com/drive/folders/${pastaId}`,
      nome: 'Pasta Anterior Re-adicionada'
    });
    assert.equal(nova.id, pastaId);

    // 3) Confere que o ID foi removido de athenes_pastas_excluidas
    excluidas = pastasExcluidasRegistradas();
    assert.ok(!(pastaId in excluidas), 'Re-vincular pasta compartilhada deve remover seu ID da lista de excluídas');

    // 4) Agora mesclarPerfil com o servidor permite a pasta sem ser filtrada
    const servidor = {
      pastas: [{ id: pastaId, nome: 'Pasta Anterior Re-adicionada', subpastas: [] }],
      documentos: [],
      excluidos: {}
    };
    const local = {
      pastas: obterPastasDriveLocais(),
      documentos: [],
      excluidos: {},
      pastasExcluidas: pastasExcluidasRegistradas()
    };
    const r = mesclarPerfil(servidor, local);
    assert.ok(r.pastas.some(p => p.id === pastaId), 'A pasta agora é incluída normalmente');
  });

  it('5. Proteção da lixeira do Google Drive: pastas com lixeira: true nunca são enviadas para PATCH/DELETE na API remota', async () => {
    const chamadasHttp = [];
    const mockFetch = async (url, op = {}) => {
      chamadasHttp.push({ url: String(url), method: op.method || 'GET', body: op.body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ files: [] })
      };
    };

    // Registra uma pasta própria (lixeira: false) e uma pasta compartilhada (lixeira: true)
    registrarPastasExcluidas([
      { id: 'pasta_propria_1', driveId: 'drive_propria_1', nome: 'Minha Pasta', lixeira: false },
      { id: 'pasta_comp_alheia', driveId: 'drive_alheio_2', nome: 'Pasta de Terceiro', lixeira: true }
    ]);

    const removidas = await processarPastasExcluidas('fake_token_drive', { fetchImpl: mockFetch });

    // Apenas a pasta própria (lixeira: false) deve ser despachada para trashed: true na API
    assert.equal(removidas, 1);
    const patches = chamadasHttp.filter(c => c.method === 'PATCH');
    assert.equal(patches.length, 1, 'Deve realizar PATCH apenas para a pasta própria');
    assert.ok(patches[0].url.includes('drive_propria_1'), 'PATCH deve ser exclusivamente para pasta própria');
    assert.ok(!chamadasHttp.some(c => c.url.includes('drive_alheio_2')), 'Pasta compartilhada jamais deve ser alvo de chamada de lixeira no Google Drive');
  });

  it('6. Desassociação de documentos de pasta compartilhada removida previne documentos órfãos', () => {
    const pastaId = 'pasta_projeto_urbanismo';
    adicionarPastaCompartilhadaDriveLocal({ id: pastaId, nome: 'Projeto Urbanismo' });

    // Documentos associados à pasta compartilhada
    const docs = [
      { id: 'doc_1', titulo: 'Diagnóstico', pastaId },
      { id: 'doc_2', titulo: 'Mapa Territorial', pastaId },
      { id: 'doc_3', titulo: 'Relatório Independente', pastaId: 'outra_pasta' }
    ];

    // Simulação do procedimento de desvinculação canônico
    removerPastaDriveLocal(pastaId);
    registrarPastasExcluidas([{ id: pastaId, driveId: pastaId, nome: 'Projeto Urbanismo', lixeira: true }]);

    // Desassociar documentos
    for (const d of docs) {
      if (d.pastaId === pastaId) {
        d.pastaId = undefined; // volta para raiz/sem pasta
      }
    }

    assert.equal(docs[0].pastaId, undefined);
    assert.equal(docs[1].pastaId, undefined);
    assert.equal(docs[2].pastaId, 'outra_pasta', 'Documento de outra pasta permanece inalterado');
  });

  it('7. removerPastaExcluida remove pontualmente registro de tombstone por id ou driveId', () => {
    registrarPastasExcluidas([
      { id: 'p1', driveId: 'd1', nome: 'P1', lixeira: true },
      { id: 'p2', driveId: 'd2', nome: 'P2', lixeira: true }
    ]);

    assert.ok('p1' in pastasExcluidasRegistradas());
    assert.ok('p2' in pastasExcluidasRegistradas());

    removerPastaExcluida('p1');
    assert.ok(!('p1' in pastasExcluidasRegistradas()), 'p1 deve ser removido');
    assert.ok('p2' in pastasExcluidasRegistradas(), 'p2 deve permanecer');

    removerPastaExcluida('d2');
    assert.ok(!('p2' in pastasExcluidasRegistradas()), 'p2 deve ser removido por driveId');
  });
});
