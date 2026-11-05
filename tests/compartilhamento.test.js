// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciarContaEmMemoria } from '../src/core/athenes_conta.js';
import { gravarSessaoSupabase } from '../src/core/athenes_supabase_auth.js';
import {
  papelNaLinha, salvarCompartilhamento, listarCompartilhadosComigo, carregarDocumentoCompartilhado, lerCompartilhamento,
  marcarComoCompartilhado, modosPermitidos, modoInicialDoPapel, emailValido, normalizarEmail, linkDoDocumento
} from '../src/core/athenes_compartilhamento.js';

const resp = (corpo, ok = true, status = 200) => ({ ok, status, json: async () => corpo, text: async () => JSON.stringify(corpo) });
function sessao(email = 'beto@x.com', userId = 'U-BETO') {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
  _reiniciarContaEmMemoria?.();
  gravarSessaoSupabase({ access_token: 'JWT', refresh_token: 'R', expira_em: Date.now() + 3600_000, user_id: userId, email });
}

test('papel de quem está logado: dono, papel gravado, convidado sem papel (o mais restrito), público e sem acesso', () => {
  const linha = { user_id: 'U-ANA', compartilhado_com: ['beto@x.com', 'caio@x.com'], permissoes: { 'beto@x.com': 'edicao' }, publico_leitura: false };
  assert.equal(papelNaLinha(linha, { userId: 'U-ANA', email: 'ana@x.com' }), 'dono');
  assert.equal(papelNaLinha(linha, { userId: 'U-B', email: 'Beto@X.com' }), 'edicao');
  assert.equal(papelNaLinha(linha, { userId: 'U-C', email: 'caio@x.com' }), 'leitura');
  assert.equal(papelNaLinha(linha, { userId: 'U-E', email: 'eva@x.com' }), '');
  assert.equal(papelNaLinha({ ...linha, publico_leitura: true }, { userId: 'U-E', email: 'eva@x.com' }), 'leitura');
});

test('salvar o compartilhamento normaliza e-mails, valida papéis e manda o JWT do usuário', async () => {
  sessao('ana@x.com', 'U-ANA');
  let chamada;
  const f = async (url, op) => { chamada = { url, op, corpo: JSON.parse(op.body) }; return resp([{ id: 'd1', ...chamada.corpo }]); };
  await salvarCompartilhamento('d1', { pessoas: { ' Beto@X.com ': 'comentario', 'caio@x.com': 'leitura' }, publico: true }, f);
  assert.match(chamada.url, /id=eq\.d1$/);
  assert.equal(chamada.op.method, 'PATCH');
  assert.equal(chamada.op.headers.Authorization, 'Bearer JWT');
  assert.deepEqual(chamada.corpo, { compartilhado_com: ['beto@x.com', 'caio@x.com'], permissoes: { 'beto@x.com': 'comentario', 'caio@x.com': 'leitura' }, publico_leitura: true });
  await assert.rejects(salvarCompartilhamento('d1', { pessoas: { 'sem-arroba': 'leitura' } }, f), /E-mail inválido/);
  await assert.rejects(salvarCompartilhamento('d1', { pessoas: { 'a@x.com': 'admin' } }, f), /Papel inválido/);
  await assert.rejects(salvarCompartilhamento('d1', { pessoas: {} }, async () => resp([])), /Só o dono/, 'o banco não alterou nenhuma linha: não é o dono');
});

test('lista de compartilhados comigo: filtra pelo meu e-mail e marca o papel', async () => {
  sessao('beto@x.com', 'U-BETO');
  let url;
  const f = async (u) => { url = u; return resp([
    { id: 'a', titulo: 'Da Ana', user_id: 'U-ANA', permissoes: { 'beto@x.com': 'comentario' }, compartilhado_com: ['beto@x.com'], dono: 'Ana' },
    { id: 'meu', titulo: 'Meu próprio', user_id: 'U-BETO', permissoes: {}, compartilhado_com: ['beto@x.com'] }
  ]); };
  const lista = await listarCompartilhadosComigo(f);
  assert.match(decodeURIComponent(url), /compartilhado_com=cs\.\{"beto@x\.com"\}/);
  assert.deepEqual(lista.map(l => [l.id, l.papel, l.dono]), [['a', 'comentario', 'Ana']], 'documento meu não aparece como "de outra pessoa"');
});

test('abrir documento compartilhado: marca papel, dono externo e bloqueia modos conforme o papel', async () => {
  sessao('caio@x.com', 'U-CAIO');
  const f = async () => resp([{ id: 'd1', user_id: 'U-ANA', conteudo_json: { id: 'd1', titulo: 'T', proprietario: { nome: 'Ana' } }, sugestoes_json: [], compartilhado_com: ['caio@x.com'], permissoes: { 'caio@x.com': 'leitura' } }]);
  const { doc, papel } = await carregarDocumentoCompartilhado('d1', f);
  assert.equal(papel, 'leitura');
  assert.deepEqual([doc.compartilhadoComigo, doc.proprietarioExterno, doc.permissao, doc.proprietario.nome], [true, true, 'leitura', 'Ana']);
  assert.deepEqual(modosPermitidos(doc), ['leitura', 'comparar']);
  assert.equal(modoInicialDoPapel(doc), 'leitura');
  assert.deepEqual(modosPermitidos({ compartilhadoComigo: true, permissao: 'comentario' }), ['sugestao', 'comparar', 'leitura']);
  assert.equal(modoInicialDoPapel({ compartilhadoComigo: true, permissao: 'comentario' }), 'sugestao');
  assert.deepEqual(modosPermitidos({ compartilhadoComigo: true, permissao: 'edicao' }), ['edicao', 'sugestao', 'comparar', 'leitura']);
  assert.equal(modoInicialDoPapel({ titulo: 'meu' }), 'edicao');
  assert.equal(await carregarDocumentoCompartilhado('x', async () => resp([])), null, 'sem acesso (ou inexistente) não revela qual dos dois');
});

test('o dono não é marcado como compartilhado; e-mail e link', () => {
  const d = marcarComoCompartilhado({ id: 'd' }, { user_id: 'U' }, 'dono');
  assert.equal(d.compartilhadoComigo, undefined);
  assert.ok(emailValido('a@b.co') && !emailValido('a@b') && !emailValido('a b@c.d'));
  assert.equal(normalizarEmail('  Ana@X.COM '), 'ana@x.com');
  assert.equal(linkDoDocumento('d 1', 'https://s.app/'), 'https://s.app/?doc=d%201');
});

test('ler compartilhamento devolve o papel de quem pergunta', async () => {
  sessao('ana@x.com', 'U-ANA');
  const info = await lerCompartilhamento('d1', async () => resp([{ id: 'd1', user_id: 'U-ANA', compartilhado_com: [], permissoes: null, publico_leitura: false }]));
  assert.deepEqual([info.papel, info.permissoes], ['dono', {}]);
});

test('marcarComoCompartilhado propaga metadados de colaboração para artigoEstudo e mesclagem preserva proprietario externo', async () => {
  const { mesclarFichamentoPreservandoDados } = await import('../src/ui/athenes_estudo_artigos_dados.js');
  const linha = {
    id: 'artigo_zot_123',
    user_id: 'U-DONO',
    conta: 'orientador@universidade.edu',
    dono: 'Prof. Orientador',
    permissoes: { 'aluno@universidade.edu': 'edicao' },
    compartilhado_com: ['aluno@universidade.edu'],
    publico_leitura: false
  };
  const docRef = {
    id: 'artigo_zot_123',
    titulo: '[Artigo] Estudo de Caso',
    norma: 'zotero_pdf',
    artigoEstudo: {
      id: 'zot_123',
      titulo: 'Estudo de Caso'
    }
  };
  const marcado = marcarComoCompartilhado(docRef, linha, 'edicao');
  assert.equal(marcado.compartilhadoComigo, true);
  assert.equal(marcado.artigoEstudo.compartilhadoComigo, true);
  assert.equal(marcado.artigoEstudo.proprietarioExterno, true);
  assert.equal(marcado.artigoEstudo.permissao, 'edicao');
  assert.equal(marcado.artigoEstudo.proprietario.nome, 'Prof. Orientador');
  assert.equal(marcado.artigoEstudo.proprietario.email, 'orientador@universidade.edu');

  // Testar mesclar com artigo existente localmente
  const artLocal = { id: 'zot_123', titulo: 'Estudo de Caso Local' };
  mesclarFichamentoPreservandoDados(artLocal, marcado.artigoEstudo);
  assert.equal(artLocal.compartilhadoComigo, true);
  assert.equal(artLocal.proprietarioExterno, true);
  assert.equal(artLocal.permissao, 'edicao');
  assert.equal(artLocal.proprietario.nome, 'Prof. Orientador');
});
