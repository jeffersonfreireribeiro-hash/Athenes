// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Marcadores e numeração de parágrafos e títulos.
 *
 * A configuração mora no ESTILO de texto (`marcador_*`) e cada bloco pode sobrescrevê-la (`marcador_tipo: 'nenhum'` desliga).
 * Este módulo resolve a configuração efetiva e a sequência dos números, para o editor, o PDF e o Word mostrarem o mesmo.
 */
import { estiloIdDoTitulo } from './athenes_sumario.js';

export const TIPOS_MARCADOR = Object.freeze([
  ['nenhum', 'Nenhum'],
  ['circulo', '•  Ponto (círculo)'],
  ['traco', '–  Travessão / alínea'],
  ['quadrado', '▪  Quadrado'],
  ['ponto_traco', '·–  Ponto-traço'],
  ['numero', '1, 2, 3…  Numeração']
]);

export const ESTILOS_NUMERO = Object.freeze([
  ['decimal', '1, 2, 3…'],
  ['decimal_zero', '01, 02, 03…'],
  ['lower_alpha', 'a, b, c…'],
  ['upper_alpha', 'A, B, C…'],
  ['lower_roman', 'i, ii, iii…'],
  ['upper_roman', 'I, II, III…']
]);

export const SEPARADORES_NUMERO = Object.freeze([
  ['ponto', '1.'],
  ['parentese', '1)'],
  ['entre_parenteses', '(1)'],
  ['travessao', '1 –']
]);

export const CAMPOS_MARCADOR = Object.freeze(['marcador_tipo', 'marcador_estilo_num', 'marcador_separador', 'marcador_inicio', 'marcador_nivel', 'marcador_tab_mm', 'marcador_alinhamento']);

const GLIFOS = { circulo: '•', traco: '–', quadrado: '▪', ponto_traco: '·–' };
const TIPOS_VALIDOS = new Set(TIPOS_MARCADOR.map(t => t[0]));
const ALINHAMENTOS = new Set(['left', 'center', 'right']);

const inteiro = (v, min, max, pad) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad; };

/** Configuração efetiva do marcador (bloco sobrescreve estilo) ou null quando o parágrafo não tem marcador. */
export function marcadorEfetivo(bloco, estilo) {
  const tipo = bloco?.marcador_tipo ?? estilo?.marcador_tipo;
  if (!tipo || tipo === 'nenhum' || !TIPOS_VALIDOS.has(tipo)) return null;
  const pega = (k, pad) => bloco?.[k] ?? estilo?.[k] ?? pad;
  const alin = pega('marcador_alinhamento', 'left');
  return {
    tipo,
    estiloNum: pega('marcador_estilo_num', 'decimal'),
    separador: pega('marcador_separador', 'ponto'),
    inicio: inteiro(bloco?.marcador_inicio ?? estilo?.marcador_inicio, 1, 999, 1),
    inicioExplicito: inteiro(bloco?.marcador_inicio, 1, 999, 1) > 1,
    nivel: inteiro(pega('marcador_nivel', 1), 1, 5, 1),
    tabMm: Math.max(3, parseFloat(pega('marcador_tab_mm', 7)) || 7),
    alinhamento: ALINHAMENTOS.has(alin) ? alin : 'left'
  };
}

const ROMANOS = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];

export function formatarNumeroMarcador(n, estiloNum = 'decimal') {
  const v = Math.max(1, Math.floor(n) || 1);
  const letras = (x) => { let s = ''; let r = x; while (r > 0) { r -= 1; s = String.fromCharCode(97 + (r % 26)) + s; r = Math.floor(r / 26); } return s; };
  const romano = () => { let r = v; let s = ''; for (const [val, sim] of ROMANOS) while (r >= val) { s += sim; r -= val; } return s; };
  switch (estiloNum) {
    case 'decimal_zero': return String(v).padStart(2, '0');
    case 'lower_alpha': return letras(v);
    case 'upper_alpha': return letras(v).toUpperCase();
    case 'lower_roman': return romano();
    case 'upper_roman': return romano().toUpperCase();
    default: return String(v);
  }
}

/** Texto do marcador para o item de número `n` ("•", "1.", "a)", "(iii)", "01 –"…). */
export function rotuloMarcador(cfg, n = 1) {
  if (!cfg) return '';
  if (cfg.tipo !== 'numero') return GLIFOS[cfg.tipo] || '•';
  const num = formatarNumeroMarcador(n, cfg.estiloNum);
  switch (cfg.separador) {
    case 'parentese': return `${num})`;
    case 'entre_parenteses': return `(${num})`;
    case 'travessao': return `${num} –`;
    default: return `${num}.`;
  }
}

/** Chave do bloco no mapa: fragmentos de um mesmo bloco compartilham a do bloco de origem. */
export const chaveMarcador = (bloco) => String(bloco?._frag?.origemId || bloco?.id || '');

const TIPOS_COM_MARCADOR = new Set(['titulo', 'subtitulo', 'paragrafo', 'texto']);

/**
 * Numeração corrida do documento: blocos numerados consecutivos continuam a contagem (por nível); qualquer bloco sem numeração
 * a reinicia. Um bloco com "Iniciar em" maior que 1 recomeça dali. Devolve Map(chave → { cfg, numero, rotulo }).
 */
export function mapaMarcadores(doc) {
  const mapa = new Map();
  const porId = Object.fromEntries((doc?.estilos || []).map(e => [e.id, e]));
  let cont = [];
  for (const sec of doc?.secoes || []) {
    for (const b of sec.blocos || []) {
      const estilo = b.tipo === 'titulo' ? (porId[estiloIdDoTitulo(porId, b)] || porId[b.estiloId]) : (porId[b.estiloId] || porId.corpo);
      const cfg = TIPOS_COM_MARCADOR.has(b.tipo) ? marcadorEfetivo(b, estilo) : null;
      if (!cfg || cfg.tipo !== 'numero') {
        cont = [];
        if (cfg) mapa.set(chaveMarcador(b), { cfg, numero: 1, rotulo: rotuloMarcador(cfg, 1) });
        continue;
      }
      const i = cfg.nivel - 1;
      if (cfg.inicioExplicito) cont[i] = cfg.inicio - 1;
      cont[i] = (cont[i] ?? (cfg.inicio - 1)) + 1;
      cont.length = i + 1;
      mapa.set(chaveMarcador(b), { cfg, numero: cont[i], rotulo: rotuloMarcador(cfg, cont[i]) });
    }
  }
  return mapa;
}

/** Valida os campos `marcador_*` de um estilo vindo de um pacote de tema (remove o que não faz sentido). */
export function sanearCamposMarcador(estilo) {
  if (!estilo || typeof estilo !== 'object') return estilo;
  const novo = { ...estilo };
  if (!TIPOS_VALIDOS.has(novo.marcador_tipo) || novo.marcador_tipo === 'nenhum') { CAMPOS_MARCADOR.forEach(k => delete novo[k]); return novo; }
  if (!ESTILOS_NUMERO.some(e => e[0] === novo.marcador_estilo_num)) delete novo.marcador_estilo_num;
  if (!SEPARADORES_NUMERO.some(e => e[0] === novo.marcador_separador)) delete novo.marcador_separador;
  if (novo.marcador_inicio !== undefined) novo.marcador_inicio = inteiro(novo.marcador_inicio, 1, 999, 1);
  if (novo.marcador_nivel !== undefined) novo.marcador_nivel = inteiro(novo.marcador_nivel, 1, 5, 1);
  if (novo.marcador_tab_mm !== undefined) novo.marcador_tab_mm = Math.min(30, Math.max(3, parseFloat(novo.marcador_tab_mm) || 7));
  if (novo.marcador_alinhamento !== undefined && !ALINHAMENTOS.has(novo.marcador_alinhamento)) delete novo.marcador_alinhamento;
  return novo;
}
