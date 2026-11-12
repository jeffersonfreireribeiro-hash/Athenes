// SPDX-License-Identifier: GPL-3.0-or-later
import { resolverTraducaoReferencia } from '../src/server/athenes_traducao.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const host = req.headers.host;
  const origin = req.headers.origin;
  try {
    if (origin && host && new URL(origin).host !== host) return res.status(403).json({ erro: 'Origem não permitida.' });
  } catch { return res.status(403).json({ erro: 'Origem não permitida.' }); }
  const resultado = await resolverTraducaoReferencia(req.body);
  return res.status(resultado.status).json(resultado.status === 200
    ? { traducao: resultado.traducao } : { erro: resultado.erro });
}
