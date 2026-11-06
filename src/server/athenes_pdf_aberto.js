// SPDX-License-Identifier: GPL-3.0-or-later
/** Busca apenas PDFs públicos encontrados pelo DOI ou pelo ISBN; não recebe URLs arbitrárias. */
import { isIP } from 'node:net';
import { normalizarDoi, normalizarIsbn } from '../core/athenes_pdf_identificadores.js';

const LIMITE = 40 * 1024 * 1024;
const PRAZO_MS = 20000;

function urlPublica(valor) {
  try {
    const u = new URL(valor);
    const h = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.port || isIP(h) || h === 'localhost' || /\.(?:local|localhost|internal|test)$/.test(h)) return null;
    return u;
  } catch { return null; }
}

async function buscar(fetchImpl, url) {
  let atual = urlPublica(url);
  if (!atual) throw new Error('Origem de PDF inválida.');
  for (let n = 0; n < 6; n++) {
    const resposta = await fetchImpl(atual, { redirect: 'manual', signal: AbortSignal.timeout(PRAZO_MS), headers: { Accept: 'application/pdf,application/json;q=0.8' } });
    if ([301, 302, 303, 307, 308].includes(resposta.status)) {
      atual = urlPublica(new URL(resposta.headers.get('location') || '', atual).href);
      if (!atual) throw new Error('Redirecionamento para origem inválida.');
      continue;
    }
    return resposta;
  }
  throw new Error('Redirecionamentos demais.');
}

async function candidatosDoi(doi, fetchImpl) {
  const resposta = await buscar(fetchImpl, `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  if (!resposta.ok) return [];
  const obra = await resposta.json();
  if (String(obra.doi || '').toLowerCase() !== `https://doi.org/${doi}`.toLowerCase()) return [];
  return [obra.best_oa_location, ...(obra.locations || [])]
    .filter(local => local?.is_oa && local.pdf_url)
    .map(local => local.pdf_url);
}

async function candidatosIsbn(isbn, fetchImpl) {
  const resposta = await buscar(fetchImpl, `https://openlibrary.org/api/volumes/brief/isbn/${isbn}.json`);
  if (!resposta.ok) return [];
  const dados = await resposta.json();
  const registro = dados.items ? dados : dados[`isbn:${isbn}`] || Object.values(dados).find(valor => Array.isArray(valor?.items)) || {};
  const itens = (registro.items || []).filter(item => item.match === 'exact' && item.status === 'full access');
  const candidatos = [];
  for (const item of itens.slice(0, 2)) {
    const id = /^https?:\/\/(?:www\.)?archive\.org\/details\/([a-zA-Z0-9_\-.]+)/.exec(item.itemURL || '')?.[1];
    if (!id) continue;
    const meta = await buscar(fetchImpl, `https://archive.org/metadata/${encodeURIComponent(id)}`);
    if (!meta.ok) continue;
    const arquivos = (await meta.json()).files || [];
    const pdf = arquivos.find(a => /\.pdf$/i.test(a.name || '') && !a.private && Number(a.size) > 0 && Number(a.size) <= LIMITE);
    if (pdf) candidatos.push(`https://archive.org/download/${encodeURIComponent(id)}/${pdf.name.split('/').map(encodeURIComponent).join('/')}`);
  }
  return candidatos;
}

async function baixarPdf(url, fetchImpl) {
  const resposta = await buscar(fetchImpl, url);
  if (!resposta.ok) return null;
  if (Number(resposta.headers.get('content-length') || 0) > LIMITE) return null;
  const partes = [];
  let bytes = 0;
  for await (const parte of resposta.body) {
    bytes += parte.length;
    if (bytes > LIMITE) { await resposta.body.cancel?.().catch(() => {}); return null; }
    partes.push(parte);
  }
  const pdf = Buffer.concat(partes, bytes);
  if (!pdf.subarray(0, 1024).includes(Buffer.from('%PDF-'))) return null;
  return pdf;
}

export async function resolverPdfAberto({ doi: doiBruto = '', isbn: isbnBruto = '' } = {}, fetchImpl = globalThis.fetch) {
  const doi = normalizarDoi(doiBruto);
  const isbn = normalizarIsbn(isbnBruto);
  if (!doi && !isbn) return { status: 400, mensagem: 'Informe um DOI ou ISBN válido.' };
  try {
    const urls = [...new Set(doi ? await candidatosDoi(doi, fetchImpl) : await candidatosIsbn(isbn, fetchImpl))];
    for (const url of urls.slice(0, 5)) {
      if (!urlPublica(url)) continue;
      try {
        const pdf = await baixarPdf(url, fetchImpl);
        if (pdf) return { status: 200, pdf, fonte: new URL(url).hostname };
      } catch { /* Outra localização de acesso aberto pode funcionar. */ }
    }
    return { status: 404, mensagem: 'Não foi encontrado PDF público para esta obra.' };
  } catch {
    return { status: 502, mensagem: 'A consulta ao catálogo público falhou. Tente novamente mais tarde.' };
  }
}
