// SPDX-License-Identifier: GPL-3.0-or-later
/** Identificadores e numeração editorial de PDFs ligados a referências. */

export function normalizarDoi(valor) {
  const doi = String(valor || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  return /^10\.\d{4,9}\/[^\s<>"']{1,220}$/i.test(doi) ? doi : '';
}

export function normalizarIsbn(valor) {
  const isbn = String(valor || '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^(?:\d{13}|\d{9}[\dX])$/.test(isbn)) return '';
  if (isbn.length === 13) return isbn.split('').reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0 ? isbn : '';
  return isbn.split('').reduce((n, d, i) => n + (d === 'X' ? 10 : Number(d)) * (10 - i), 0) % 11 === 0 ? isbn : '';
}

export function paginaEditorialDoPdf(art, paginaFisica, totalPaginas, detectada = 0) {
  const m = /(?:^|\D)(\d{1,5})\s*[-–—]\s*(\d{1,5})(?:\D|$)/.exec(String(art?.paginas || ''));
  if (!m) return null;
  const inicio = Number(m[1]);
  const fim = Number(m[2]);
  const pagina = Number(paginaFisica);
  const total = Number(totalPaginas);
  if (!inicio || fim < inicio || !pagina || pagina > total) return null;
  const numDetectado = Number(detectada);
  if (numDetectado >= inicio && numDetectado <= fim) return numDetectado;
  return fim - inicio + 1 === total ? inicio + pagina - 1 : null;
}

export async function blobEhPdf(blob) {
  if (!blob || blob.size < 8) return false;
  const cabecalho = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  return new TextDecoder('latin1').decode(cabecalho).includes('%PDF-');
}
