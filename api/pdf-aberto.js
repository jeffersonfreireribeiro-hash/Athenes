// SPDX-License-Identifier: GPL-3.0-or-later
import { resolverPdfAberto } from '../src/server/athenes_pdf_aberto.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const resultado = await resolverPdfAberto(req.query);
  res.setHeader('Cache-Control', 'no-store');
  if (resultado.status !== 200) return res.status(resultado.status).json({ erro: resultado.mensagem });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Athenes-Fonte', resultado.fonte);
  return res.status(200).send(resultado.pdf);
}
