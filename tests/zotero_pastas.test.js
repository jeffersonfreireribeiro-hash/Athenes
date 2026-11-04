// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { espelharColecoesNasPastas, ordenarColecoes, pastasDoItemZotero, artigoEstaNaPasta } from '../src/core/athenes_zotero_pastas.js';

const raiz = () => [{ id: 'pasta_bib_raiz', nome: 'Bibliografia & Leituras', tipo: 'bibliografia', origem: 'minhas', subpastas: [] }];
const colecoes = [
  { key: 'B', nome: 'Acústica', parentCollection: 'A' },
  { key: 'A', nome: 'Arquitetura', parentCollection: false },
  { key: 'C', nome: 'Urbanismo', parentCollection: false }
];

test('coleções do Zotero viram pastas com os mesmos nomes e a mesma hierarquia', () => {
  const { pastas, mapa, criadas } = espelharColecoesNasPastas(raiz(), colecoes);
  assert.equal(criadas, 3);
  const r = pastas[0];
  assert.deepEqual(r.subpastas.map(p => p.nome), ['Arquitetura', 'Urbanismo']);
  const arq = r.subpastas[0];
  assert.deepEqual(arq.subpastas.map(p => p.nome), ['Acústica']);
  assert.equal(arq.subpastas[0].parentId, arq.id);
  assert.equal(mapa.get('B'), arq.subpastas[0].id);
  assert.ok(arq.origemZotero && arq.zoteroKey === 'A' && arq.tipo === 'bibliografia');
});

test('sincronizar de novo não duplica pastas e acompanha renomeações; nada é apagado', () => {
  const a = espelharColecoesNasPastas(raiz(), colecoes);
  const b = espelharColecoesNasPastas(a.pastas, colecoes.map(c => c.key === 'C' ? { ...c, nome: 'Cidades' } : c));
  assert.equal(b.criadas, 0);
  assert.equal(b.renomeadas, 1);
  assert.deepEqual(b.pastas[0].subpastas.map(p => p.nome), ['Arquitetura', 'Urbanismo'.replace('Urbanismo', 'Cidades')]);
  const c = espelharColecoesNasPastas(b.pastas, [colecoes[1]]); // as outras sumiram do Zotero
  assert.equal(c.pastas[0].subpastas.length, 2);
});

test('coleção-mãe desconhecida vira pasta na raiz e a ordem é do pai para o filho', () => {
  const ord = ordenarColecoes([{ key: 'X', nome: 'Filho', parentCollection: 'P' }, { key: 'Y', nome: 'Órfã', parentCollection: 'nao-existe' }]);
  assert.deepEqual(ord.map(c => c.key).sort(), ['X', 'Y']);
  assert.equal(ord.find(c => c.key === 'Y').parentCollection, false);
});

test('um item em várias coleções aparece em todas as pastas; sem coleção, na raiz', () => {
  const { mapa } = espelharColecoesNasPastas(raiz(), colecoes);
  const ids = pastasDoItemZotero(['A', 'C'], mapa);
  assert.equal(ids.length, 2);
  const art = { pastaId: ids[0], pastasIds: ids };
  assert.ok(ids.every(id => artigoEstaNaPasta(art, id)));
  assert.equal(artigoEstaNaPasta(art, 'pasta_bib_raiz'), false);
  assert.deepEqual(pastasDoItemZotero([], mapa), ['pasta_bib_raiz']);
  assert.ok(artigoEstaNaPasta({}, 'pasta_bib_raiz'), 'artigo antigo, sem lista, vale pelo pastaId (ou raiz)');
});
