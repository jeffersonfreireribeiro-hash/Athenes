// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contaDoPerfil, definirContaAtiva, limparContaAtiva, obterContaAtiva, lerConta, gravarConta, contaEhPrimeira, chaveConta, _reiniciarContaEmMemoria
} from '../src/core/athenes_conta.js';
import { salvarPerfilColaborador, encerrarSessao, obterPerfilColaborador, listarDocumentosDoSupabase, salvarDocumentoNoSupabase } from '../src/core/athenes_colaboracao.js';
import { listarTemplatesUsuario, salvarComoTemplate } from '../src/core/athenes_templates.js';
import { criarDocumento } from '../src/core/athenes_documento.js';

const novoArmazenamento = () => {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), get _m() { return m; } };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  _reiniciarContaEmMemoria();
  return m;
};

test('identificador da conta: e-mail Google > e-mail informado > nome (sem acento e caixa)', () => {
  assert.equal(contaDoPerfil({ email: 'Ana@Uni.br', autenticadoGoogle: true }), 'g:ana@uni.br');
  assert.equal(contaDoPerfil({ email: 'Ana@Uni.br' }), 'e:ana@uni.br');
  assert.equal(contaDoPerfil({ nome: '  José   da Silva ' }), 'n:jose da silva');
  assert.equal(contaDoPerfil({}), '');
});

test('duas contas no mesmo navegador não veem os arquivos uma da outra', () => {
  const m = novoArmazenamento();
  definirContaAtiva({ nome: 'Ana', email: 'ana@uni.br', autenticadoGoogle: true });
  gravarConta('athenes_docs_indice', JSON.stringify([{ id: 'doc_ana', titulo: 'Tese da Ana' }]));
  gravarConta('athenes_gdrive_config', JSON.stringify({ accessToken: 'token-da-ana' }));
  definirContaAtiva({ nome: 'Beto', email: 'beto@uni.br', autenticadoGoogle: true });
  assert.equal(lerConta('athenes_docs_indice'), null, 'a conta nova começa vazia');
  assert.equal(lerConta('athenes_gdrive_config'), null, 'e não herda o token do Drive');
  gravarConta('athenes_docs_indice', JSON.stringify([{ id: 'doc_beto' }]));
  definirContaAtiva({ nome: 'Ana', email: 'ana@uni.br', autenticadoGoogle: true });
  assert.match(lerConta('athenes_docs_indice'), /Tese da Ana/);
  assert.doesNotMatch(lerConta('athenes_docs_indice'), /doc_beto/);
  assert.ok([...m.keys()].filter(k => k.startsWith('athenes_docs_indice')).length === 2);
});

test('migração: os arquivos antigos (sem conta) vão para a PRIMEIRA conta que entrar; a segunda começa vazia', () => {
  const m = novoArmazenamento();
  m.set('athenes_docs_indice', JSON.stringify([{ id: 'antigo' }]));
  m.set('athenes_pastas_drive_v1', JSON.stringify([{ id: 'pasta' }]));
  definirContaAtiva({ nome: 'Dona', email: 'dona@uni.br' });
  assert.equal(m.get('athenes_docs_indice'), undefined, 'a chave antiga some (não duplica megabytes)');
  assert.match(lerConta('athenes_docs_indice'), /antigo/);
  assert.match(lerConta('athenes_pastas_drive_v1'), /pasta/);
  assert.equal(contaEhPrimeira(), true);
  definirContaAtiva({ nome: 'Outra', email: 'outra@uni.br' });
  assert.equal(lerConta('athenes_docs_indice'), null);
  assert.equal(contaEhPrimeira(), false, 'só a primeira conta recebe os documentos de exemplo');
  definirContaAtiva({ nome: 'Dona', email: 'dona@uni.br' });
  assert.match(lerConta('athenes_docs_indice'), /antigo/, 'a dona continua com os dela');
});

test('identificação manual usa espaço anônimo estável durante a sessão, sem herdar dados por nome ou e-mail', () => {
  novoArmazenamento();
  const perfil = { nome: 'Carla', conectado: true };
  salvarPerfilColaborador(perfil);
  assert.match(obterContaAtiva(), /^anon:/);
  const primeira = obterContaAtiva();
  gravarConta('athenes_docs_indice', '["c"]');
  perfil.nome = 'Carla Souza'; // edição do perfil
  salvarPerfilColaborador(perfil);
  assert.equal(obterContaAtiva(), primeira);
  assert.equal(lerConta('athenes_docs_indice'), '["c"]');
  perfil.conta = ''; perfil.email = 'carla@uni.br'; // novo login
  salvarPerfilColaborador(perfil);
  assert.match(obterContaAtiva(), /^anon:/);
  assert.notEqual(obterContaAtiva(), primeira);
  assert.equal(lerConta('athenes_docs_indice'), null);
});

test('entrada manual não reivindica Zotero nem documentos antigos sem conta', () => {
  const m = novoArmazenamento();
  m.set('athenes_zotero_cfg', JSON.stringify({ apiKey: 'chave-privada' }));
  m.set('athenes_docs_indice', JSON.stringify([{ id: 'particular' }]));
  definirContaAtiva({ nome: 'serro', email: '', conectado: true, autenticadoGoogle: false });
  assert.equal(lerConta('athenes_zotero_cfg'), null);
  assert.equal(lerConta('athenes_docs_indice'), null);
  assert.equal(m.get('athenes_zotero_cfg') !== undefined, true, 'dados antigos são preservados para a conta Google');
});

test('sair: volta ao espaço comum, apaga o token da conta e não mistura com a próxima', () => {
  const m = novoArmazenamento();
  salvarPerfilColaborador({ nome: 'Dani', email: 'dani@uni.br', autenticadoGoogle: true, conectado: true });
  gravarConta('athenes_gdrive_config', JSON.stringify({ accessToken: 'tk', accessTokenExpiraEm: 999 }));
  encerrarSessao();
  assert.equal(obterContaAtiva(), '');
  assert.equal(chaveConta('athenes_docs_indice'), 'athenes_docs_indice');
  const guardado = JSON.parse(m.get('athenes_gdrive_config::g:dani@uni.br'));
  assert.equal(guardado.accessToken, '');
  assert.equal(obterPerfilColaborador().conta, '');
});

test('modelos do usuário também são por conta', () => {
  const m = novoArmazenamento();
  definirContaAtiva({ nome: 'Eva', email: 'eva@uni.br' });
  salvarComoTemplate(criarDocumento({ titulo: 'D' }), { nome: 'Modelo da Eva' }, globalThis.localStorage);
  assert.equal(listarTemplatesUsuario(globalThis.localStorage).length, 1);
  definirContaAtiva({ nome: 'Fábio', email: 'fabio@uni.br' });
  assert.equal(listarTemplatesUsuario(globalThis.localStorage).length, 0);
  assert.ok(![...m.keys()].some(k => k.startsWith('athenes_templates_usuario::')), 'os modelos ficam na memória/servidor, não no navegador');
});

test('nuvem: o documento sai marcado com a conta e a listagem filtra pelo dono', async () => {
  novoArmazenamento();
  definirContaAtiva({ nome: 'Gil', email: 'gil@uni.br', autenticadoGoogle: true });
  let corpo = null, urlLista = null;
  const fetchSalvar = async (url, op) => { corpo = JSON.parse(op.body); return { ok: true, json: async () => [corpo] }; };
  await salvarDocumentoNoSupabase(criarDocumento({ titulo: 'Do Gil' }), { nome: 'Gil' }, fetchSalvar);
  assert.equal(corpo.conteudo_json.proprietario.conta, 'g:gil@uni.br');
  const fetchLista = async (url) => { urlLista = String(url); return { ok: true, json: async () => [] }; };
  await listarDocumentosDoSupabase(fetchLista);
  assert.ok(urlLista.includes(encodeURIComponent('conteudo_json->proprietario->>conta') + '=eq.' + encodeURIComponent('g:gil@uni.br')), urlLista);
  limparContaAtiva();
  await listarDocumentosDoSupabase(fetchLista);
  assert.equal(urlLista.includes('proprietario'), true, 'a chamada anterior foi a última; sem conta não consulta a lista');
});
