// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Importador de CSV para blocos Tabela/Quadro.
 *
 * Parser RFC 4180 (aspas, aspas escapadas "", quebras de linha dentro de campos, CRLF/LF/CR),
 * detecção automática de separador (`;` `,` TAB `|`) e decodificação UTF-8 com fallback Windows-1252
 * (CSV exportado pelo Excel brasileiro). Sem dependências e sem DOM.
 */

export const SEPARADORES = { ponto_virgula: ';', virgula: ',', tab: '\t', barra: '|' };
export const MAX_LINHAS_CSV = 5000;
export const MAX_COLUNAS_CSV = 40;

const CANDIDATOS = [';', ',', '\t', '|'];

/** Decodifica bytes: UTF-8 estrito; se inválido, Windows-1252 (Excel pt-BR). */
export function decodificarCsv(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacao: 'utf-8' };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), codificacao: 'windows-1252' };
  }
}

/** Conta ocorrências de `delim` fora de aspas em uma linha. */
function contarFora(linha, delim) {
  let n = 0;
  let aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (ch === delim && !aspas) n++;
  }
  return n;
}

/**
 * Escolhe o separador mais consistente entre as primeiras linhas:
 * maior contagem na 1ª linha, repetida nas demais.
 */
export function detectarSeparador(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(l => l.trim() !== '').slice(0, 8);
  if (!linhas.length) return ',';
  let melhor = ',';
  let melhorPontos = -1;
  for (const d of CANDIDATOS) {
    const contagens = linhas.map(l => contarFora(l, d));
    const primeira = contagens[0];
    if (!primeira) continue;
    const consistentes = contagens.filter(c => c === primeira).length;
    const pontos = consistentes * 100 + primeira;
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = d; }
  }
  return melhor;
}

/** Matriz de células (strings) a partir do texto CSV. */
export function parseCsv(texto, separador = ',') {
  const t = String(texto).replace(/^﻿/, '');
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  let i = 0;
  const fechaCampo = () => { linha.push(campo); campo = ''; };
  const fechaLinha = () => { fechaCampo(); linhas.push(linha); linha = []; };

  while (i < t.length) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i += 2; continue; }
        aspas = false; i++; continue;
      }
      campo += ch; i++; continue;
    }
    if (ch === '"' && campo === '') { aspas = true; i++; continue; }
    if (ch === separador) { fechaCampo(); i++; continue; }
    if (ch === '\r') { fechaLinha(); i += t[i + 1] === '\n' ? 2 : 1; continue; }
    if (ch === '\n') { fechaLinha(); i++; continue; }
    campo += ch; i++;
  }
  if (campo !== '' || linha.length) fechaLinha();

  // descarta linhas totalmente vazias (inclusive a final)
  return linhas.filter(l => l.some(c => c.trim() !== ''));
}

/**
 * Converte CSV em colunas/linhas de tabela, com linhas irregulares normalizadas.
 * @param {string} texto
 * @param {{separador?: string, cabecalho?: boolean}} opc  separador: 'auto' | caractere
 * @returns {{colunas:string[], linhas:string[][], separador:string, truncado:{linhas:boolean,colunas:boolean}}}
 */
export function csvParaTabela(texto, { separador = 'auto', cabecalho = true } = {}) {
  const sep = separador === 'auto' || !separador ? detectarSeparador(texto) : separador;
  let matriz = parseCsv(texto, sep);
  const truncado = { linhas: false, colunas: false };

  let nCols = Math.max(0, ...matriz.map(l => l.length));
  if (nCols > MAX_COLUNAS_CSV) { nCols = MAX_COLUNAS_CSV; truncado.colunas = true; }
  if (matriz.length > MAX_LINHAS_CSV + 1) { matriz = matriz.slice(0, MAX_LINHAS_CSV + 1); truncado.linhas = true; }

  const normaliza = (l) => Array.from({ length: nCols }, (_, i) => (l[i] ?? '').trim());
  const norm = matriz.map(normaliza);
  if (!norm.length || nCols === 0) return { colunas: [], linhas: [], separador: sep, truncado };

  let colunas;
  let linhas;
  if (cabecalho) {
    colunas = norm[0].map((c, i) => c || `Coluna ${i + 1}`);
    linhas = norm.slice(1);
  } else {
    colunas = Array.from({ length: nCols }, (_, i) => `Coluna ${i + 1}`);
    linhas = norm;
  }
  return { colunas, linhas, separador: sep, truncado };
}

/**
 * Aplica o resultado ao bloco tabela/quadro.
 *  - 'substituir': troca colunas e linhas, redistribui larguras e zera ajustes por linha/coluna/célula
 *    (índices antigos não fazem mais sentido); preserva o estilo global (bordas, zebra, cabeçalho...).
 *  - 'anexar': acrescenta as linhas de dados ao final, ajustadas ao nº de colunas atual.
 * @returns {{linhas:number, colunas:number}} totais após a importação
 */
export function aplicarCsvAoBloco(bloco, resultado, { modo = 'substituir' } = {}) {
  if (modo === 'anexar' && Array.isArray(bloco.colunas) && bloco.colunas.length) {
    const n = bloco.colunas.length;
    const novas = resultado.linhas.map(l => Array.from({ length: n }, (_, i) => l[i] ?? ''));
    bloco.linhas = [...(bloco.linhas || []), ...novas];
  } else {
    bloco.colunas = [...resultado.colunas];
    bloco.linhas = resultado.linhas.map(l => [...l]);
    const n = resultado.colunas.length;
    bloco.larguras_relativas = Array.from({ length: n }, () => Math.round((1 / n) * 1000) / 1000);
    bloco.com_cabecalho = true;
    const e = bloco.estilo_tabela;
    if (e) {
      e.camadas = { tabela: e.camadas?.tabela || {}, linhas: {}, colunas: {}, celulas: {} };
      e.bordas_celulas = {};
    }
  }
  return { linhas: bloco.linhas.length, colunas: bloco.colunas.length };
}
