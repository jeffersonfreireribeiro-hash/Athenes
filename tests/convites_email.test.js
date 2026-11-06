// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { conviteDocumento, codificarMensagemGmail, enviarConviteGmail } from '../src/core/athenes_convites_email.js';

test('convite aponta para o documento e usa o e-mail convidado', () => {
  const convite = conviteDocumento({ email: ' ANA@EXEMPLO.COM ', titulo: 'Pesquisa acústica', docId: 'doc 1', dono: 'Jefferson' });
  assert.equal(convite.destinatario, 'ana@exemplo.com');
  assert.match(convite.corpo, /doc=doc%201/);
  assert.match(convite.corpo, /Pesquisa acústica/);
  assert.throws(() => conviteDocumento({ email: 'invalido', docId: '1' }), /inválido/);
});

test('Gmail recebe uma mensagem UTF-8 para o destinatário indicado', async () => {
  const convite = conviteDocumento({ email: 'ana@exemplo.com', titulo: 'Água & ciência', docId: 'abc' });
  let chamada;
  const resposta = await enviarConviteGmail(convite, 'token-teste', async (url, opcoes) => {
    chamada = { url, opcoes };
    return { ok: true, json: async () => ({ id: 'msg1' }) };
  });
  assert.equal(resposta.id, 'msg1');
  assert.equal(chamada.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(chamada.opcoes.headers.Authorization, 'Bearer token-teste');
  const raw = JSON.parse(chamada.opcoes.body).raw.replace(/-/g, '+').replace(/_/g, '/');
  const mime = Buffer.from(raw, 'base64').toString('utf8');
  assert.match(mime, /To: ana@exemplo.com/);
  assert.match(mime, /Água & ciência/);
  assert.equal(codificarMensagemGmail(convite), JSON.parse(chamada.opcoes.body).raw);
});
