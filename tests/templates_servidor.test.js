// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria, gravarConta, lerConta } from '../src/core/athenes_conta.js';
import { gravarSessaoSupabase } from '../src/core/athenes_supabase_auth.js';
import { criarDocumento } from '../src/core/athenes_documento.js';
import { salvarComoTemplate, listarTemplatesUsuario, removerTemplateUsuario, sincronizarTemplatesUsuario, reiniciarTemplatesUsuario } from '../src/core/athenes_templates.js';
import { mesclarLista } from '../src/core/athenes_lista_sincronizada.js';

function ambiente() {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  _reiniciarContaEmMemoria?.(); reiniciarTemplatesUsuario();
  gravarSessaoSupabase({ access_token: 'JWT', refresh_token: 'R', expira_em: Date.now() + 3600_000, user_id: 'U1', email: 'a@x.com' });
  return m;
}
function servidorFalso() {
  const s = { linha: null, v: 0 };
  s.fetch = async (url, op = {}) => {
    const metodo = op.method || 'GET';
    if (metodo === 'GET') return { ok: true, status: 200, json: async () => (s.linha ? [{ conteudo_json: s.linha, atualizado_em: `V${s.v}` }] : []) };
    const corpo = JSON.parse(op.body);
    if (metodo === 'POST') { s.linha = corpo.conteudo_json; s.v++; return { ok: true, status: 201, json: async () => [] }; }
    if (!decodeURIComponent(url).includes(`atualizado_em=eq.V${s.v}`)) return { ok: true, status: 200, json: async () => [] };
    s.linha = corpo.conteudo_json; s.v++; return { ok: true, status: 200, json: async () => [{}] };
  };
  return s;
}

test('modelos do usuário: ficam na memória, sobem ao servidor e vêm de outro computador', async () => {
  const m = ambiente();
  const t = salvarComoTemplate(criarDocumento({ titulo: 'D' }), { nome: 'Meu modelo' });
  assert.equal(listarTemplatesUsuario().length, 1);
  assert.deepEqual([...m.keys()].filter(k => /templates/.test(k)), [], 'nada no navegador');
  const srv = servidorFalso();
  await sincronizarTemplatesUsuario({ fetchImpl: srv.fetch });
  assert.deepEqual(srv.linha.valor.itens.map(x => x.id), [t.id]);
  // "outro computador": memória vazia, o servidor devolve o modelo
  reiniciarTemplatesUsuario();
  assert.equal(listarTemplatesUsuario().length, 0);
  await sincronizarTemplatesUsuario({ fetchImpl: srv.fetch });
  assert.deepEqual(listarTemplatesUsuario().map(x => x.titulo), ['Meu modelo']);
  removerTemplateUsuario(t.id);
  assert.equal(listarTemplatesUsuario().length, 0);
  await sincronizarTemplatesUsuario({ fetchImpl: srv.fetch });
  assert.ok(t.id in srv.linha.valor.excluidos, 'a exclusão vale nos outros computadores');
});

test('modelos antigos do navegador sobem ao servidor e só então saem daqui', async () => {
  ambiente();
  gravarConta('athenes_templates_usuario', JSON.stringify([{ id: 'tpl_velho', titulo: 'Velho', config: { mestras: [] }, secoes: [] }]));
  assert.equal(listarTemplatesUsuario().length, 1);
  const srv = servidorFalso();
  await sincronizarTemplatesUsuario({ fetchImpl: srv.fetch });
  assert.deepEqual(srv.linha.valor.itens.map(x => x.id), ['tpl_velho']);
  assert.equal(lerConta('athenes_templates_usuario'), null);
});

test('mesclarLista aceita o formato antigo { artigos } do servidor sem perder itens', () => {
  const r = mesclarLista({ artigos: [{ id: 'a', atualizadoEm: '2026-11-03T10:00:00Z' }], excluidos: {} }, { itens: [{ id: 'b', atualizadoEm: '2026-11-03T09:00:00Z' }], excluidos: {} });
  assert.deepEqual(r.valor.itens.map(x => x.id).sort(), ['a', 'b']);
});
