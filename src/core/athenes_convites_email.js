// SPDX-License-Identifier: GPL-3.0-or-later
/** Convites de compartilhamento pelo Gmail da conta Google que concedeu acesso. */
import { emailValido, linkDoDocumento, normalizarEmail } from './athenes_compartilhamento.js';

export const ESCOPO_GMAIL_ENVIO = 'https://www.googleapis.com/auth/gmail.send';

export function conviteDocumento({ email, titulo, docId, dono = '' }) {
  const destinatario = normalizarEmail(email);
  if (!emailValido(destinatario)) throw new Error('E-mail do convite inválido.');
  const assunto = 'Athenes: convite para documento';
  const corpo = `${dono || 'Uma pessoa'} compartilhou com você o documento “${titulo || 'Documento'}” no Athenes.\n\nAbra o documento: ${linkDoDocumento(docId)}\n\nEntre no Athenes com a conta Google deste e-mail para vê-lo em Compartilhados comigo.`;
  return { destinatario, assunto, corpo };
}

export function codificarMensagemGmail({ destinatario, assunto, corpo }) {
  const mime = `To: ${destinatario}\r\nSubject: ${assunto}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${corpo}`;
  const bytes = new TextEncoder().encode(mime);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function enviarConviteGmail(convite, token, fetchImpl = globalThis.fetch) {
  if (!token) throw new Error('Autorize o envio de convites pela sua conta Google.');
  const resp = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: codificarMensagemGmail(convite) })
  });
  if (!resp.ok) throw new Error(`O Gmail não enviou o convite (${resp.status}).`);
  return resp.json();
}
