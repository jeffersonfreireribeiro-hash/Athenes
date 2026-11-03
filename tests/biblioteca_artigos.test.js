// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria, gravarConta, lerConta } from '../src/core/athenes_conta.js';
import { gravarSessaoSupabase } from '../src/core/athenes_supabase_auth.js';
import * as bib from '../src/core/athenes_biblioteca_artigos.js';

const art = (id, extra = {}) => ({ id, titulo: `Artigo ${id}`, notas: [], ...extra });

function ambiente() {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  _reiniciarContaEmMemoria?.(); bib.reiniciar();
  gravarSessaoSupabase({ access_token: 'JWT', refresh_token: 'R', expira_em: Date.now() + 3600_000, user_id: 'U1', email: 'a@x.com' });
  return m;
}

// servidor falso: um registro de dados com conferência de versão
function servidorFalso() {
  const s = { linha: null, v: 0, gravacoes: 0 };
  s.fetch = async (url, op = {}) => {
    const metodo = op.method || 'GET';
    if (metodo === 'GET') return { ok: true, status: 200, json: async () => (s.linha ? [{ conteudo_json: s.linha, atualizado_em: `V${s.v}` }] : []) };
    const corpo = JSON.parse(op.body);
    if (metodo === 'POST') { if (s.linha) return { ok: false, status: 409, json: async () => ({}) }; s.linha = corpo.conteudo_json; s.v++; s.gravacoes++; return { ok: true, status: 201, json: async () => [] }; }
    if (!decodeURIComponent(url).includes(`atualizado_em=eq.V${s.v}`)) return { ok: true, status: 200, json: async () => [] };
    s.linha = corpo.conteudo_json; s.v++; s.gravacoes++; return { ok: true, status: 200, json: async () => [{}] };
  };
  return s;
}

test('mesclar: o mais recente vence por artigo; exclusão vale em todos, salvo edição posterior', () => {
  const srv = { artigos: [art('a', { atualizadoEm: '2026-11-03T10:00:00Z', titulo: 'Do servidor' }), art('b', { atualizadoEm: '2026-11-03T10:00:00Z' }), art('c', { atualizadoEm: '2026-11-03T10:00:00Z' })], excluidos: { b: '2026-11-03T11:00:00Z' } };
  const local = { artigos: [art('a', { atualizadoEm: '2026-11-03T09:00:00Z', titulo: 'Antigo' }), art('c', { atualizadoEm: '2026-11-03T12:00:00Z', titulo: 'Editado depois' }), art('d', { atualizadoEm: '2026-11-03T08:00:00Z' })], excluidos: { c: '2026-11-03T11:30:00Z' } };
  const { valor } = bib.mesclarBiblioteca(srv, local);
  assert.deepEqual(valor.artigos.map(a => [a.id, a.titulo]).sort(), [['a', 'Do servidor'], ['c', 'Editado depois'], ['d', 'Artigo d']]);
  assert.ok(!('c' in valor.excluidos), 'a edição posterior desfaz a exclusão');
  assert.ok('b' in valor.excluidos);
});

test('alterar a lista carimba só o que mudou, registra exclusões e não grava nada no navegador', () => {
  const m = ambiente();
  const lista = bib.obterArtigos();
  lista.push(art('a'), art('b'));
  bib.definirArtigos(lista);
  const carimboA = lista[0].atualizadoEm;
  assert.ok(carimboA);
  lista[1].titulo = 'mudou'; bib.definirArtigos(lista);
  assert.equal(lista[0].atualizadoEm, carimboA, 'o artigo que não mudou mantém a data');
  assert.ok(lista[1].atualizadoEm >= carimboA);
  lista.splice(0, 1); bib.definirArtigos(lista);
  assert.deepEqual([...m.keys()].filter(k => /artigos|biblioteca/.test(k)), [], 'nada de biblioteca no armazenamento do navegador');
});

test('sincronizar: envia ao servidor, traz o que veio de outro computador e só então apaga a cópia antiga do navegador', async () => {
  const m = ambiente();
  gravarConta('athenes_estudo_artigos_v1', JSON.stringify([art('antigo', { atualizadoEm: '2026-11-01T00:00:00Z' })]));
  const srv = servidorFalso();
  srv.linha = { valor: { artigos: [art('de_outro_pc', { atualizadoEm: '2026-11-02T00:00:00Z' })], excluidos: {} }, atualizadoEm: 'x' }; srv.v = 1;
  let avisos = 0; bib.aoMudarBiblioteca(() => avisos++);
  // a rede usa nuvemAutenticada() (sessão gravada acima) e o fetch injetado
  const r = await bib.sincronizarBiblioteca({ fetchImpl: srv.fetch });
  assert.equal(r.mudou, true); assert.equal(avisos, 1);
  assert.deepEqual(bib.obterArtigos().map(a => a.id).sort(), ['antigo', 'de_outro_pc']);
  assert.deepEqual(srv.linha.valor.artigos.map(a => a.id).sort(), ['antigo', 'de_outro_pc'], 'o servidor passa a ter os dois');
  assert.equal(lerConta('athenes_estudo_artigos_v1'), null, 'a cópia antiga saiu do navegador depois de enviada');
  const gravacoes = srv.gravacoes;
  await bib.sincronizarBiblioteca({ fetchImpl: srv.fetch });
  assert.equal(srv.gravacoes, gravacoes, 'sem mudança não regrava');
  void m;
});

test('sem a nuvem confirmada nada é enviado e a cópia antiga permanece (nada se perde)', async () => {
  ambiente();
  const { limparSessaoSupabase } = await import('../src/core/athenes_supabase_auth.js');
  limparSessaoSupabase();
  gravarConta('athenes_estudo_artigos_v1', JSON.stringify([art('antigo')]));
  assert.equal(await bib.sincronizarBiblioteca({ fetchImpl: async () => { throw new Error('não deveria chamar'); } }), null);
  assert.deepEqual(bib.obterArtigos().map(a => a.id), ['antigo']);
  assert.ok(lerConta('athenes_estudo_artigos_v1'));
  assert.equal(bib.legadoDaBibliotecaPendente(), true);
});

test('artigos de exemplo fictícios do legado não sobem ao servidor', () => {
  ambiente();
  bib.definirFiltroDeExemplos((a) => a.exemplo === true);
  gravarConta('athenes_estudo_artigos_v1', JSON.stringify([art('real'), art('fake', { exemplo: true })]));
  assert.deepEqual(bib.obterArtigos().map(a => a.id), ['real']);
  bib.definirFiltroDeExemplos(() => false);
});
