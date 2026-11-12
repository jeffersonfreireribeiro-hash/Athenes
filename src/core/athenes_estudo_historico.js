// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Motor de historico (Desfazer / Refazer) para a Estante de Referencias e o Estudio de Leitura/PDF.
 * Puro em ES Modules, reutilizando a normalizacao canonica de atalhos do Athenes.
 */
import { normalizarEvento, detectarMac } from './athenes_atalhos.js';

function clonarJsonSeguro(valor, fallback) {
  try {
    return JSON.parse(JSON.stringify(valor === undefined ? fallback : valor));
  } catch {
    return fallback;
  }
}

export class HistoricoLinear {
  constructor({ limite = 50, estadoInicial = null } = {}) {
    this.limite = Math.max(2, Number(limite) || 50);
    this.pilha = [];
    this.indice = -1;
    if (estadoInicial !== null && estadoInicial !== undefined) {
      this.registrar(estadoInicial);
    }
  }

  registrar(estado) {
    const serializado = typeof estado === 'string' ? estado : JSON.stringify(estado);
    if (this.indice >= 0 && this.pilha[this.indice] === serializado) {
      return false;
    }
    if (this.indice < this.pilha.length - 1) {
      this.pilha = this.pilha.slice(0, this.indice + 1);
    }
    this.pilha.push(serializado);
    if (this.pilha.length > this.limite) {
      const excesso = this.pilha.length - this.limite;
      this.pilha.splice(0, excesso);
    }
    this.indice = this.pilha.length - 1;
    return true;
  }

  podeDesfazer() {
    return this.indice > 0;
  }

  podeRefazer() {
    return this.indice >= 0 && this.indice < this.pilha.length - 1;
  }

  atual() {
    if (this.indice < 0 || this.indice >= this.pilha.length) return null;
    return JSON.parse(this.pilha[this.indice]);
  }

  desfazer() {
    if (!this.podeDesfazer()) return null;
    this.indice -= 1;
    return JSON.parse(this.pilha[this.indice]);
  }

  refazer() {
    if (!this.podeRefazer()) return null;
    this.indice += 1;
    return JSON.parse(this.pilha[this.indice]);
  }
}

export function clonarEstadoArtigo(art) {
  if (!art) return null;
  const f = art.fichamento || {};
  return {
    id: art.id,
    titulo: art.titulo || '',
    autores: clonarJsonSeguro(art.autores ?? '', ''),
    ano: art.ano ?? '',
    resumo: art.resumo || '',
    resumoOriginal: art.resumoOriginal || '',
    publicacao: art.publicacao || '',
    volume: art.volume || '',
    numero: art.numero || '',
    paginas: art.paginas || '',
    doi: art.doi || '',
    chaveZotero: art.chaveZotero || '',
    driveFileName: art.driveFileName || '',
    driveFileId: art.driveFileId || '',
    tags: clonarJsonSeguro(Array.isArray(art.tags) ? art.tags : [], []),
    palavrasChave: clonarJsonSeguro(Array.isArray(art.palavrasChave) ? art.palavrasChave : [], []),
    pastaId: art.pastaId ?? null,
    corCapa: art.corCapa || '',
    status: art.status || '',
    totalPaginas: art.totalPaginas ?? null,
    conteudoPaginasPdf: clonarJsonSeguro(Array.isArray(art.conteudoPaginasPdf) ? art.conteudoPaginasPdf : [], []),
    fichamento: {
      resumoPessoal: f.resumoPessoal || '',
      metodologiaNotas: f.metodologiaNotas || '',
      citacoesMarcadas: clonarJsonSeguro(Array.isArray(f.citacoesMarcadas) ? f.citacoesMarcadas : [], []),
      tracosPorPagina: clonarJsonSeguro(f.tracosPorPagina && typeof f.tracosPorPagina === 'object' ? f.tracosPorPagina : {}, {}),
      grifosPorPagina: clonarJsonSeguro(f.grifosPorPagina && typeof f.grifosPorPagina === 'object' ? f.grifosPorPagina : {}, {}),
      notasPagina: clonarJsonSeguro(f.notasPagina && typeof f.notasPagina === 'object' ? f.notasPagina : {}, {}),
      htmlGrifado: typeof f.htmlGrifado === 'string' ? f.htmlGrifado : ''
    }
  };
}

export function aplicarEstadoArtigo(art, snapshot) {
  if (!art || !snapshot) return art;
  art.titulo = snapshot.titulo || '';
  art.autores = clonarJsonSeguro(snapshot.autores ?? '', '');
  art.ano = snapshot.ano ?? '';
  art.resumo = snapshot.resumo || '';
  if (snapshot.resumoOriginal !== undefined) art.resumoOriginal = snapshot.resumoOriginal;
  if (snapshot.publicacao !== undefined) art.publicacao = snapshot.publicacao;
  if (snapshot.volume !== undefined) art.volume = snapshot.volume;
  if (snapshot.numero !== undefined) art.numero = snapshot.numero;
  if (snapshot.paginas !== undefined) art.paginas = snapshot.paginas;
  if (snapshot.doi !== undefined) art.doi = snapshot.doi;
  if (snapshot.chaveZotero !== undefined) art.chaveZotero = snapshot.chaveZotero;
  if (snapshot.driveFileName !== undefined) art.driveFileName = snapshot.driveFileName;
  if (snapshot.driveFileId !== undefined) art.driveFileId = snapshot.driveFileId;
  art.tags = clonarJsonSeguro(Array.isArray(snapshot.tags) ? snapshot.tags : [], []);
  if (Array.isArray(snapshot.palavrasChave)) art.palavrasChave = clonarJsonSeguro(snapshot.palavrasChave, []);
  art.pastaId = snapshot.pastaId ?? null;
  if (snapshot.corCapa !== undefined) art.corCapa = snapshot.corCapa;
  if (snapshot.status !== undefined) art.status = snapshot.status;
  if (Array.isArray(snapshot.conteudoPaginasPdf)) {
    art.conteudoPaginasPdf = clonarJsonSeguro(snapshot.conteudoPaginasPdf, []);
  }
  if (snapshot.totalPaginas !== null && snapshot.totalPaginas !== undefined) {
    art.totalPaginas = snapshot.totalPaginas;
  }
  if (!art.fichamento) art.fichamento = {};
  const sf = snapshot.fichamento || {};
  art.fichamento.resumoPessoal = sf.resumoPessoal || '';
  art.fichamento.metodologiaNotas = sf.metodologiaNotas || '';
  art.fichamento.citacoesMarcadas = clonarJsonSeguro(Array.isArray(sf.citacoesMarcadas) ? sf.citacoesMarcadas : [], []);
  art.fichamento.tracosPorPagina = clonarJsonSeguro(sf.tracosPorPagina || {}, {});
  art.fichamento.grifosPorPagina = clonarJsonSeguro(sf.grifosPorPagina || {}, {});
  art.fichamento.notasPagina = clonarJsonSeguro(sf.notasPagina && typeof sf.notasPagina === 'object' ? sf.notasPagina : {}, {});
  art.fichamento.htmlGrifado = typeof sf.htmlGrifado === 'string' ? sf.htmlGrifado : '';
  return art;
}

function sanitizarArtigoParaCatalogo(art) {
  const { pdfBlobUrl, pdfDataUrl, pdfBlob, ...resto } = art || {};
  return clonarJsonSeguro(resto, {});
}

export function clonarEstadoCatalogo(artigos, pastas) {
  return {
    artigos: Array.isArray(artigos) ? artigos.map(sanitizarArtigoParaCatalogo) : [],
    pastas: clonarJsonSeguro(Array.isArray(pastas) ? pastas : [], [])
  };
}

export function restaurarEstadoCatalogo(artigosAtuais, snapshot) {
  const mapaBinarios = new Map();
  for (const art of (Array.isArray(artigosAtuais) ? artigosAtuais : [])) {
    if (!art?.id) continue;
    mapaBinarios.set(art.id, {
      pdfBlobUrl: art.pdfBlobUrl,
      pdfDataUrl: art.pdfDataUrl,
      pdfBlob: art.pdfBlob,
      temPdfLocal: art.temPdfLocal
    });
  }
  const artigos = (Array.isArray(snapshot?.artigos) ? snapshot.artigos : []).map((item) => {
    const copia = clonarJsonSeguro(item, {});
    const vivo = mapaBinarios.get(copia.id);
    if (vivo) {
      if (vivo.pdfBlobUrl !== undefined) copia.pdfBlobUrl = vivo.pdfBlobUrl;
      if (vivo.pdfDataUrl !== undefined) copia.pdfDataUrl = vivo.pdfDataUrl;
      if (vivo.pdfBlob !== undefined) copia.pdfBlob = vivo.pdfBlob;
      if (vivo.temPdfLocal !== undefined && copia.temPdfLocal === undefined) {
        copia.temPdfLocal = vivo.temPdfLocal;
      }
    }
    return copia;
  });
  const pastas = clonarJsonSeguro(Array.isArray(snapshot?.pastas) ? snapshot.pastas : [], []);
  return { artigos, pastas };
}

export function deveIgnorarAtalhoHistoricoEmElemento(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function') {
    if (target.closest('[contenteditable="true"]')) return true;
  }
  return false;
}

export function classificarAtalhoHistorico(e, mac = detectarMac()) {
  if (!e) return null;
  if (deveIgnorarAtalhoHistoricoEmElemento(e.target)) return null;
  const canonico = normalizarEvento(e, mac);
  if (canonico === 'Mod+Z') return 'desfazer';
  if (canonico === 'Mod+Shift+Z' || canonico === 'Mod+Y') return 'refazer';
  return null;
}
