// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoteroClient } from '../src/core/athenes_zotero.js';

const item = (i) => ({ key: `K${String(i).padStart(4, '0')}`, version: 1, data: { itemType: 'journalArticle', title: `Obra ${i}`, creators: [{ lastName: 'Silva', firstName: 'J.' }], date: '2020' } });

function clienteComBiblioteca(total) {
  const c = new ZoteroClient({ userId: '1', apiKey: 'k' });
  const pedidos = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url); pedidos.push(u);
    const start = Number(u.searchParams.get('start') || 0); const limit = Math.min(100, Number(u.searchParams.get('limit') || 25));
    const corpo = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, k) => item(start + k));
    return { ok: true, headers: { get: (n) => (n === 'Total-Results' ? String(total) : null) }, json: async () => corpo };
  };
  return { c, pedidos };
}

test('biblioteca com mais de 100 itens vem inteira, em páginas de 100', async () => {
  const { c, pedidos } = clienteComBiblioteca(243);
  const itens = await c.buscarItens();
  assert.equal(itens.length, 243);
  assert.equal(new Set(itens.map(i => i.chave)).size, 243, 'sem repetir item entre páginas');
  assert.equal(pedidos.length, 3);
  assert.ok(pedidos.every(p => Number(p.searchParams.get('limit')) <= 100));
});

test('o limite pedido continua valendo', async () => {
  const { c } = clienteComBiblioteca(243);
  assert.equal((await c.buscarItens({ limite: 120 })).length, 120);
});

test('biblioteca pequena usa uma única chamada', async () => {
  const { c, pedidos } = clienteComBiblioteca(59);
  assert.equal((await c.buscarItens()).length, 59);
  assert.equal(pedidos.length, 1);
});
