// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Importador de fontes: o usuário escolhe o arquivo (.ttf, .otf, .woff, .woff2), a fonte é
 * validada, registrada no catálogo de tipografia e guardada no IndexedDB (volta a cada abertura do app).
 * Funciona 100% offline.
 */

import {
  registrarFonteImportada, removerFonteImportada, listarFontesImportadas, formatoDoArquivo, nomeSugerido, FORMATOS_FONTE
} from '../core/athenes_fontes.js';

const BANCO = 'athenes_fontes'; const LOJA = 'fontes';

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível neste navegador.'));
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = async (modo, fn) => {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const t = db.transaction(LOJA, modo); const r = fn(t.objectStore(LOJA));
    t.oncomplete = () => { db.close(); resolve(r?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
};

const bufferParaDataUrl = (buffer, mime) => {
  let bin = ''; const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
};

/** Faz o navegador conhecer a família (document.fonts) para telas e medições. */
async function ativarNoNavegador(meta) {
  if (typeof FontFace === 'undefined') return;
  const face = new FontFace(meta.nome, `url(${meta.dataUrl})`, { weight: '100 900' });
  await face.load();
  document.fonts.add(face);
}

/** Registra todas as fontes guardadas. Chamar na abertura do app, antes do primeiro desenho. */
export async function carregarFontesImportadas() {
  let todas = [];
  try { todas = (await tx('readonly', s => s.getAll())) || []; } catch (_) { return []; }
  for (const m of todas) {
    try {
      registrarFonteImportada(m);
      await ativarNoNavegador(m);
    } catch (_) { /* arquivo corrompido: ignora essa fonte */ }
  }
  return todas;
}

/** Importa um arquivo de fonte. Retorna a entrada do catálogo. Lança Error com mensagem para o usuário. */
export async function importarArquivoDeFonte(arquivo, { nome = '', serif = false } = {}) {
  const formato = formatoDoArquivo(arquivo?.name);
  if (!formato) throw new Error('Formato não suportado. Use .ttf, .otf, .woff ou .woff2.');
  if (arquivo.size > 12 * 1024 * 1024) throw new Error('Arquivo de fonte grande demais (máximo de 12 MB).');
  const buffer = await arquivo.arrayBuffer();
  const meta = { nome: (nome || nomeSugerido(arquivo.name)).trim(), formato, serif, dataUrl: bufferParaDataUrl(buffer, FORMATOS_FONTE[formato].mime) };
  try { await ativarNoNavegador(meta); } // valida: um arquivo que não é fonte falha aqui
  catch (_) { throw new Error('O arquivo não parece ser uma fonte válida.'); }
  const entrada = registrarFonteImportada(meta);
  const guardada = listarFontesImportadas().find(f => f.id === entrada.id);
  try { await tx('readwrite', s => s.put({ ...guardada, serif })); }
  catch (e) { throw new Error(`A fonte funciona nesta sessão, mas não pôde ser guardada: ${e.message}`); }
  return entrada;
}

export async function excluirFonteImportada(id) {
  removerFonteImportada(id);
  try { await tx('readwrite', s => s.delete(id)); } catch (_) { /* já removida da sessão */ }
}
