// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { papelNaLinha, documentoEDaMinhaConta, marcarComoCompartilhado } from '../src/core/athenes_compartilhamento.js';

const eu = { userId: 'U-NOVO', email: 'Jeff@X.com', conta: 'jeff@x.com' };

test('documento da minha conta, aberto em outro computador (outro identificador de usuário), continua sendo meu', () => {
  const linha = { user_id: 'U-VELHO', conta: 'jeff@x.com', compartilhado_com: ['jeff@x.com'], permissoes: { 'jeff@x.com': 'edicao' } };
  assert.equal(papelNaLinha(linha, eu), 'dono');
  const viaConteudo = { user_id: 'U-VELHO', conteudo_json: { proprietario: { conta: 'JEFF@x.com' } } };
  assert.equal(papelNaLinha(viaConteudo, eu), 'dono');
});

test('documento de outra pessoa continua compartilhado, com o papel dado a mim', () => {
  const linha = { user_id: 'U-ANA', conta: 'ana@x.com', permissoes: { 'jeff@x.com': 'comentario' }, compartilhado_com: ['jeff@x.com'] };
  assert.equal(papelNaLinha(linha, eu), 'comentario');
  assert.equal(documentoEDaMinhaConta({ userIdDoDoc: 'U-ANA', contaDoDoc: 'ana@x.com' }, eu), false);
  assert.equal(documentoEDaMinhaConta({ userIdDoDoc: 'U-NOVO' }, eu), true);
  assert.equal(documentoEDaMinhaConta({}, eu), false, 'sem dono conhecido não vira "meu" por engano');
});

test('o que é meu não ganha as marcas de compartilhado', () => {
  const doc = { id: 'd1', titulo: 'Meu artigo' };
  const r = marcarComoCompartilhado(doc, { user_id: 'U-VELHO' }, papelNaLinha({ user_id: 'U-VELHO', conta: 'jeff@x.com' }, eu));
  assert.equal(r.compartilhadoComigo, undefined);
  assert.equal(r.proprietarioExterno, undefined);
});
