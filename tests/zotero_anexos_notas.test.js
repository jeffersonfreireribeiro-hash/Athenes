// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoteroClient } from '../src/core/athenes_zotero.js';
import { organizarFilhosZotero, aplicarFilhosZoteroAoArtigo } from '../src/core/athenes_zotero_anexos_notas.js';

const anexo = (key, pai, linkMode, extra = {}) => ({ key, data: { itemType: 'attachment', parentItem: pai, linkMode, contentType: 'application/pdf', filename: `${key}.pdf`, ...extra } });
const nota = (key, pai, html) => ({ key, data: { itemType: 'note', parentItem: pai, note: html, dateModified: '2026-01-02T10:00:00Z' } });
const anot = (key, pai, extra) => ({ key, data: { itemType: 'annotation', parentItem: pai, annotationColor: '#ffd400', annotationPageLabel: '7', ...extra } });

const BRUTOS = [
  anexo('ANX1', 'PAI1', 'linked_file'), anexo('ANX2', 'PAI1', 'imported_file'), anexo('ANX3', 'PAI2', 'linked_file'),
  anexo('ANXH', 'PAI4', 'imported_url', { contentType: 'text/html' }),
  nota('N1', 'PAI1', '<p>Boa <b>ideia</b><script>alert(1)</script></p>'), nota('N2', 'PAI1', '<p></p>'),
  anot('A1', 'ANX2', { annotationText: 'trecho importante', annotationComment: 'ver cap. 2' }),
  anot('A2', 'ANX2', { annotationComment: 'só comentário' }), anot('A3', 'ANXH', { annotationText: 'ignorada' })
];

test('prefere o PDF importado ao vinculado e marca o que não é baixável', () => {
  const o = organizarFilhosZotero(BRUTOS);
  assert.equal(o.anexos.get('PAI1').chave, 'ANX2');
  assert.equal(o.anexos.get('PAI1').baixavel, true);
  assert.equal(o.anexos.get('PAI2').baixavel, false);
  assert.equal(o.anexos.has('PAI4'), false, 'anexo que não é PDF não conta');
  assert.equal(o.anotacoes.get('PAI1').length, 2);
});

test('aplica notas e anotações sem duplicar e sem tocar no que o usuário escreveu', () => {
  const o = organizarFilhosZotero(BRUTOS);
  const art = { fichamento: { resumoPessoal: 'meu', citacoesMarcadas: [{ id: 'cit_1', texto: 'minha' }] } };
  assert.equal(aplicarFilhosZoteroAoArtigo(art, 'PAI1', o), 1);
  assert.equal(aplicarFilhosZoteroAoArtigo(art, 'PAI1', o), 0, 'segunda sincronização não duplica');
  assert.equal(art.fichamento.citacoesMarcadas.length, 2);
  assert.equal(art.fichamento.resumoPessoal, 'meu');
  const c = art.fichamento.citacoesMarcadas[1];
  assert.deepEqual([c.id, c.pagina, c.cor, c.comentario, c.origem], ['zot_ann_A1', 7, '#ffd400', 'ver cap. 2', 'zotero']);
  assert.equal(art.notasZotero.length, 2, 'nota vazia ignorada; comentário solto vira nota');
  assert.equal(art.anexoPdfZotero.chave, 'ANX2');
});

test('listarFilhos busca anexos, notas e anotações em páginas e ignora tipo sem permissão', async () => {
  const c = new ZoteroClient({ userId: '1', apiKey: 'k' });
  const tipos = [];
  const f = async (url) => {
    const u = new URL(url); const tipo = u.searchParams.get('itemType'); tipos.push(tipo);
    if (tipo === 'annotation') return { ok: false, status: 403 };
    const todos = tipo === 'attachment' ? Array.from({ length: 130 }, (_, i) => anexo(`X${i}`, `P${i}`, 'imported_file')) : [nota('N1', 'P0', '<p>x</p>')];
    const ini = Number(u.searchParams.get('start')); return { ok: true, json: async () => todos.slice(ini, ini + 100) };
  };
  const o = await c.listarFilhos({ fetchImpl: f });
  assert.equal(o.anexos.size, 130);
  assert.equal(o.notas.get('P0').length, 1);
  assert.deepEqual(tipos, ['attachment', 'attachment', 'note', 'annotation']);
});

test('baixarAnexoPdf devolve o arquivo ou explica o motivo da falha', async () => {
  const c = new ZoteroClient({ userId: '1', apiKey: 'k' });
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  assert.equal((await c.baixarAnexoPdf('A', { fetchImpl: async () => ({ ok: true, status: 200, blob: async () => blob }) })).size, 8);
  await assert.rejects(c.baixarAnexoPdf('A', { fetchImpl: async () => ({ ok: false, status: 404 }) }), { codigo: 'sem_arquivo' });
  await assert.rejects(c.baixarAnexoPdf('A', { fetchImpl: async () => ({ ok: false, status: 403 }) }), { codigo: 'sem_permissao' });
  await assert.rejects(c.baixarAnexoPdf('A', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), { codigo: 'rede_ou_cors' });
});
