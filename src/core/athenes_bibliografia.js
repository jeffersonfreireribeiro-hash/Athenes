// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Formatador e Gerenciador Bibliográfico Acadêmico.
 * Suporta ABNT (NBR 6023), APA 7th, IEEE e Vancouver com parser BibTeX embutido.
 */

import { formatarReferenciaNoEstilo } from './athenes_bibliografia_estilos.js';

export const TIPOS_OBRA = Object.freeze([
  { id: 'artigo_periodico', rotulo: 'Artigo de Periódico / Revista' },
  { id: 'livro', rotulo: 'Livro Completo' },
  { id: 'capitulo_livro', rotulo: 'Capítulo de Livro' },
  { id: 'trabalho_conferencia', rotulo: 'Trabalho em Congresso / Anais' },
  { id: 'tese_dissertacao', rotulo: 'Tese / Dissertação / TCC' },
  { id: 'relatorio_tecnico', rotulo: 'Relatório Técnico' },
  { id: 'website', rotulo: 'Página Web / Documento Online' }
]);

/**
 * Formata lista de autores conforme o padrão da norma
 */
export function formatarAutores(autores = [], norma = 'abnt', noTexto = false) {
  if (!Array.isArray(autores) || autores.length === 0) return 'AUTOR NÃO INFORMADO';

  const parseAutor = a => {
    if (typeof a === 'string') {
      const partes = a.split(',').map(s => s.trim());
      if (partes.length >= 2) return { sobrenome: partes[0], prenome: partes[1] };
      const palavras = a.split(/\s+/);
      const sobrenome = palavras.pop() || '';
      return { sobrenome, prenome: palavras.join(' ') };
    }
    return {
      sobrenome: a.sobrenome || a.lastName || a.family || '',
      prenome: a.prenome || a.firstName || a.given || ''
    };
  };

  const lista = autores.map(parseAutor);

  if (norma === 'abnt') {
    if (noTexto) {
      // No texto: Silva e Santos (2024) ou Silva et al. (2024)
      if (lista.length === 1) return lista[0].sobrenome;
      if (lista.length === 2) return `${lista[0].sobrenome} e ${lista[1].sobrenome}`;
      if (lista.length === 3) return `${lista[0].sobrenome}, ${lista[1].sobrenome} e ${lista[2].sobrenome}`;
      return `${lista[0].sobrenome} et al.`;
    }
    // Entre parênteses ou na bibliografia: SILVA, J.; SANTOS, M.
    if (lista.length > 3 && !noTexto) {
      const primeiro = `${lista[0].sobrenome.toUpperCase()}, ${lista[0].prenome}`;
      return `${primeiro} et al.`;
    }
    return lista.map(a => `${a.sobrenome.toUpperCase()}, ${a.prenome}`).join('; ');
  }

  if (norma === 'apa') {
    if (noTexto) {
      if (lista.length === 1) return lista[0].sobrenome;
      if (lista.length === 2) return `${lista[0].sobrenome} & ${lista[1].sobrenome}`;
      return `${lista[0].sobrenome} et al.`;
    }
    if (lista.length === 1) return `${lista[0].sobrenome}, ${lista[0].prenome ? lista[0].prenome[0] + '.' : ''}`;
    if (lista.length === 2) {
      const a1 = `${lista[0].sobrenome}, ${lista[0].prenome ? lista[0].prenome[0] + '.' : ''}`;
      const a2 = `${lista[1].sobrenome}, ${lista[1].prenome ? lista[1].prenome[0] + '.' : ''}`;
      return `${a1} & ${a2}`;
    }
    return `${lista[0].sobrenome} et al.`;
  }

  if (norma === 'ieee') {
    const formatIeee = a => `${a.prenome ? a.prenome[0] + '. ' : ''}${a.sobrenome}`;
    if (lista.length === 1) return formatIeee(lista[0]);
    if (lista.length === 2) return `${formatIeee(lista[0])} and ${formatIeee(lista[1])}`;
    return `${formatIeee(lista[0])} et al.`;
  }

  // Padrão genérico
  return lista.map(a => `${a.sobrenome}, ${a.prenome}`).join(', ');
}

/**
 * Gera a citação em texto no formato pílula (ex.: "(SILVA, 2024)" ou "[1]")
 */
export function gerarCitacaoInline(referencia, norma = 'abnt', indiceNumerico = 1, pagina = '') {
  if (!referencia) return '(?)';

  const ano = referencia.ano || 's.d.';
  const pag = pagina ? `, p. ${pagina}` : '';

  if (norma === 'ieee' || norma === 'vancouver') {
    return `[${indiceNumerico}]`;
  }

  const autores = referencia.autores || [];
  const autorFormatado = formatarAutores(autores, norma, false);

  if (norma === 'abnt') {
    const autorCaixaAlta = autorFormatado.split(';').map(a => a.split(',')[0].trim().toUpperCase()).join('; ');
    return `(${autorCaixaAlta}, ${ano}${pag})`;
  }

  if (norma === 'apa') {
    const autorApa = formatarAutores(autores, norma, true);
    return `(${autorApa}, ${ano}${pag})`;
  }

  return `(${autorFormatado}, ${ano})`;
}

/**
 * Renderiza a referência bibliográfica completa conforme a norma
 */
export function formatarReferenciaCompleta(ref, norma = 'abnt', indice = 1) {
  return formatarReferenciaNoEstilo(ref, norma, indice); // todos os estilos e tipos: athenes_bibliografia_estilos.js
}

/**
 * Parser de arquivos BibTeX (.bib) para leitura offline instantânea
 */
export function parseBibTeX(conteudoBib) {
  if (!conteudoBib || typeof conteudoBib !== 'string') return [];

  const entradas = [];
  const regexEntrada = /@([a-zA-Z]+)\s*\{\s*([^,]+),([^@]*)/g;
  let match;

  while ((match = regexEntrada.exec(conteudoBib)) !== null) {
    const tipoBib = match[1].toLowerCase();
    const chave = match[2].trim();
    const corpo = match[3];

    if (['comment', 'preamble', 'string'].includes(tipoBib)) continue;

    const campos = {};
    const regexCampo = /([a-zA-Z_-]+)\s*=\s*(?:\{([^}]*)\}|"([^"]*)"|(\d+))/g;
    let mCampo;

    while ((mCampo = regexCampo.exec(corpo)) !== null) {
      const chaveCampo = mCampo[1].toLowerCase();
      const valor = (mCampo[2] !== undefined ? mCampo[2] : (mCampo[3] !== undefined ? mCampo[3] : mCampo[4])) || '';
      campos[chaveCampo] = valor.trim();
    }

    const autores = (campos.author || '')
      .split(/\s+and\s+/i)
      .filter(Boolean)
      .map(nome => {
        const p = nome.split(',').map(s => s.trim());
        if (p.length >= 2) return { sobrenome: p[0], prenome: p[1] };
        const partes = nome.split(/\s+/);
        const sobrenome = partes.pop() || '';
        return { sobrenome, prenome: partes.join(' ') };
      });

    let tipo = 'artigo_periodico';
    if (tipoBib === 'book') tipo = 'livro';
    else if (tipoBib === 'incollection' || tipoBib === 'inbook') tipo = 'capitulo_livro';
    else if (tipoBib === 'inproceedings' || tipoBib === 'conference') tipo = 'trabalho_conferencia';
    else if (tipoBib === 'phdthesis' || tipoBib === 'mastersthesis') tipo = 'tese_dissertacao';
    else if (tipoBib === 'techreport') tipo = 'relatorio_tecnico';
    else if (tipoBib === 'misc' || tipoBib === 'online') tipo = 'website';

    entradas.push({
      id: chave,
      chave,
      tipo,
      titulo: campos.title?.replace(/[\{\}]/g, '') || 'Sem título',
      autores: autores.length ? autores : [{ sobrenome: 'ANÔNIMO', prenome: '' }],
      ano: campos.year || '',
      publicacao: campos.journal || campos.booktitle || '',
      editora: campos.publisher || '',
      local: campos.address || '',
      volume: campos.volume || '',
      numero: campos.number || '',
      paginas: campos.pages?.replace(/--/g, '–') || '',
      doi: campos.doi || '',
      isbn: campos.isbn || '',
      url: campos.url || '',
      resumo: campos.abstract || '',
      palavrasChave: (campos.keywords || '').split(/[,;]/).map(k => k.trim()).filter(Boolean)
    });
  }

  return entradas;
}
