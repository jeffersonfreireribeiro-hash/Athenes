// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gráficos por JSON → SVG vetorial (renderer próprio, sem Chart.js/Vega, 100% offline).
 *
 * Tipos: barras, barras_horizontais, barras_empilhadas, linhas, area, dispersao, pizza, rosca, boxplot.
 * Aliases em inglês (bar, line, scatter, pie, doughnut, boxplot…) e o formato `{type, data:{labels, datasets}}`
 * (estilo Chart.js, apenas como entrada) também são aceitos.
 *
 * ── Schema (campos em português; todos opcionais exceto tipo e dados) ──────────────────────────────
 * {
 *   "tipo": "barras",                         // ver lista acima
 *   "titulo": "Produção por região",          // título dentro do gráfico (a legenda da figura fica no bloco)
 *   "x": { "titulo": "Região", "categorias": ["Norte", "Sul"] },
 *   "y": { "titulo": "Toneladas", "min": 0, "max": 100, "passo": 20, "sufixo": " t", "casas": 0 },
 *   "series": [ { "nome": "2023", "valores": [12, 30], "cor": "#314F79" } ],
 *   // dispersão:  series[].pontos = [[x, y], ...]  (x numérico; "x": {"min","max","titulo"})
 *   // pizza/rosca: "dados": [ { "rotulo": "A", "valor": 40, "cor": "#..." } ]
 *   // boxplot:    series[].caixas = [ { "rotulo": "G1", "min":1, "q1":2, "mediana":3, "q3":4, "max":5, "atipicos":[9] } ]
 *   //             ou series[].amostras = [[...valores brutos do grupo 1], [...grupo 2]] (quartis calculados)
 *   "legenda": "baixo",                       // "baixo" | "direita" | "nenhuma" (padrão: automática)
 *   "grade": true, "rotulos_valores": false,  // grade horizontal; valores sobre as barras/pontos
 *   "largura": 640, "altura": 400             // espaço de desenho em unidades do SVG (viewBox)
 * }
 */

import { escTexto } from './athenes_marcacao_segura.js';

export const TIPOS_GRAFICO = Object.freeze(['barras', 'barras_horizontais', 'barras_empilhadas', 'linhas', 'area', 'dispersao', 'pizza', 'rosca', 'boxplot']);

const ALIAS_TIPO = {
  bar: 'barras', column: 'barras', barras: 'barras', coluna: 'barras', colunas: 'barras',
  barh: 'barras_horizontais', horizontalbar: 'barras_horizontais', hbar: 'barras_horizontais', barras_horizontais: 'barras_horizontais', barras_horizontal: 'barras_horizontais',
  stacked: 'barras_empilhadas', stackedbar: 'barras_empilhadas', barras_empilhadas: 'barras_empilhadas',
  line: 'linhas', linhas: 'linhas', linha: 'linhas',
  area: 'area',
  scatter: 'dispersao', dispersao: 'dispersao', 'dispersão': 'dispersao', bubble: 'dispersao',
  pie: 'pizza', pizza: 'pizza',
  doughnut: 'rosca', donut: 'rosca', rosca: 'rosca',
  boxplot: 'boxplot', box: 'boxplot', caixa: 'boxplot'
};

// ───────────────────────────── Tema visual ─────────────────────────────

const PALETAS = {
  tema: ['#314F79', '#D97706', '#0F766E', '#B91C1C', '#6D28D9', '#4D7C0F', '#0369A1', '#BE185D'],
  vivida: ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#84CC16', '#06B6D4', '#EC4899'],
  cinza: ['#1F2937', '#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB', '#374151', '#E5E7EB', '#111827']
};
export const PALETAS_CODIGO = Object.freeze(Object.keys(PALETAS));

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Tema que Mermaid e gráficos herdam do documento: tipografia, cor primária e paleta categórica.
 * `paleta`: 'tema' (cor primária do tema + complementares), 'vivida' ou 'cinza' (impressão P&B).
 */
export function criarTemaVisual({ fonte = 'Arial, Helvetica, sans-serif', corPrimaria = '#314F79', corTexto = '#1F2733', paleta = 'tema', fundo = '' } = {}) {
  const base = [...(PALETAS[paleta] || PALETAS.tema)];
  if (paleta === 'tema' && HEX.test(corPrimaria)) base[0] = corPrimaria;
  return {
    fonte: String(fonte).replace(/["<>&]/g, ''),
    cor: HEX.test(corPrimaria) ? corPrimaria : '#314F79',
    texto: HEX.test(corTexto) ? corTexto : '#1F2733',
    suave: paleta === 'cinza' ? '#4B5563' : '#64748B',
    grade: '#E2E8F0',
    eixo: paleta === 'cinza' ? '#374151' : '#94A3B8',
    nome_paleta: paleta in PALETAS ? paleta : 'tema',
    paleta: base,
    fundo: HEX.test(fundo) ? fundo : ''
  };
}

const T = (t) => t || criarTemaVisual();

// ───────────────────────────── Utilidades ─────────────────────────────

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

/** Largura aproximada do texto em unidades do SVG (sem DOM, para layout determinístico). */
export function medirTexto(s, tam = 12, negrito = false) {
  let w = 0;
  for (const c of String(s)) {
    if ('iljI.,:;\'|!ft '.includes(c)) w += 0.3;
    else if ('mwMW@%'.includes(c)) w += 0.88;
    else if (c >= 'A' && c <= 'Z') w += 0.68;
    else if (c >= '0' && c <= '9') w += 0.56;
    else w += 0.53;
  }
  return w * tam * (negrito ? 1.07 : 1);
}

function formatarValor(v, y = {}) {
  if (!Number.isFinite(v)) return '';
  const casas = Number.isInteger(y.casas) ? y.casas : (Math.abs(v) < 10 && !Number.isInteger(v) ? 2 : (Number.isInteger(v) ? 0 : 1));
  const s = v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${y.prefixo || ''}${s}${y.sufixo || ''}`;
}

/** Escala "bonita" (passos 1/2/5 × 10ⁿ). */
export function escalaBonita(min, max, alvo = 5, fixos = {}) {
  let lo = Number.isFinite(fixos.min) ? fixos.min : min;
  let hi = Number.isFinite(fixos.max) ? fixos.max : max;
  if (lo === hi) { hi = lo + 1; if (lo > 0 && !Number.isFinite(fixos.min)) lo = 0; }
  let passo = Number.isFinite(fixos.passo) && fixos.passo > 0 ? fixos.passo : 0;
  if (!passo) {
    const bruto = (hi - lo) / Math.max(1, alvo);
    const mag = 10 ** Math.floor(Math.log10(bruto));
    const norm = bruto / mag;
    passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  }
  if (!Number.isFinite(fixos.min)) lo = Math.floor(lo / passo) * passo;
  if (!Number.isFinite(fixos.max)) hi = Math.ceil(hi / passo) * passo;
  const ticks = [];
  for (let v = lo; v <= hi + passo * 1e-6; v += passo) ticks.push(+v.toPrecision(12));
  return { min: lo, max: hi, passo, ticks };
}

export function quartis(valores) {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => { const k = (v.length - 1) * p; const f = Math.floor(k); return v[f] + (v[Math.min(f + 1, v.length - 1)] - v[f]) * (k - f); };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const dentro = v.filter(x => x >= lo && x <= hi);
  return { min: dentro[0], q1, mediana: q(0.5), q3, max: dentro[dentro.length - 1], atipicos: v.filter(x => x < lo || x > hi) };
}

// ───────────────────────────── Normalização e validação ─────────────────────────────

const num = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v);
const ehNum = (v) => typeof num(v) === 'number' && Number.isFinite(num(v));

/** Converte entradas equivalentes (pt/en/Chart.js) para o schema canônico. Não valida. */
export function normalizarEspecGrafico(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const tipoBruto = String(e.tipo ?? e.type ?? '').toLowerCase().replace(/[\s-]/g, '');
  const tipo = ALIAS_TIPO[tipoBruto] || tipoBruto;
  const out = {
    tipo,
    titulo: e.titulo ?? e.title ?? e.options?.plugins?.title?.text ?? '',
    subtitulo: e.subtitulo ?? e.subtitle ?? '',
    x: { ...(e.x || e.eixo_x || {}) },
    y: { ...(e.y || e.eixo_y || {}) },
    legenda: e.legenda ?? e.legend ?? 'auto',
    grade: e.grade ?? e.grid ?? true,
    rotulos_valores: e.rotulos_valores ?? e.valueLabels ?? e.data_labels ?? false,
    largura: Number(e.largura ?? e.width) || 640,
    altura: Number(e.altura ?? e.height) || 400,
    series: [],
    dados: []
  };
  if (typeof out.legenda === 'boolean') out.legenda = out.legenda ? 'auto' : 'nenhuma';
  const cats = e.categorias ?? e.categories ?? e.labels ?? e.data?.labels ?? out.x.categorias ?? out.x.categories;
  if (Array.isArray(cats)) out.x.categorias = cats.map(String);
  const series = e.series ?? e.datasets ?? e.data?.datasets;
  if (Array.isArray(series)) {
    out.series = series.map((s, i) => {
      const val = s.valores ?? s.values ?? s.data;
      const r = { nome: String(s.nome ?? s.name ?? s.label ?? `Série ${i + 1}`), cor: s.cor ?? s.color ?? s.backgroundColor ?? s.borderColor };
      if (typeof r.cor !== 'string' || !HEX.test(r.cor)) r.cor = '';
      if (Array.isArray(s.pontos ?? s.points)) r.pontos = (s.pontos ?? s.points).map(p => (Array.isArray(p) ? [num(p[0]), num(p[1])] : [num(p.x), num(p.y)]));
      else if (Array.isArray(val) && val.length && typeof val[0] === 'object' && val[0] !== null && !Array.isArray(val[0]) && 'x' in val[0]) r.pontos = val.map(p => [num(p.x), num(p.y)]);
      else if (Array.isArray(val)) r.valores = val.map(num);
      if (Array.isArray(s.caixas ?? s.boxes)) r.caixas = s.caixas ?? s.boxes;
      if (Array.isArray(s.amostras ?? s.samples)) r.amostras = (s.amostras ?? s.samples).map(a => (Array.isArray(a) ? a.map(num) : []));
      return r;
    });
  }
  const dados = e.dados ?? e.slices ?? (tipo === 'pizza' || tipo === 'rosca' ? e.data : null);
  if (Array.isArray(dados) && !Array.isArray(e.data?.datasets)) {
    out.dados = dados.map(d => (typeof d === 'object' ? { rotulo: String(d.rotulo ?? d.label ?? d.nome ?? d.name ?? ''), valor: num(d.valor ?? d.value), cor: HEX.test(d.cor ?? d.color ?? '') ? (d.cor ?? d.color) : '' } : { rotulo: '', valor: num(d), cor: '' }));
  } else if ((tipo === 'pizza' || tipo === 'rosca') && out.series[0]?.valores) {
    const s = out.series[0];
    out.dados = s.valores.map((v, i) => ({ rotulo: out.x.categorias?.[i] ?? `Item ${i + 1}`, valor: v, cor: '' }));
  }
  return out;
}

/** Posição (índice) do primeiro erro de sintaxe JSON, ou -1. Independe da mensagem do motor JS. */
export function localizarErroJson(t) {
  let i = 0;
  const n = t.length;
  const ws = () => { while (i < n && ' \t\r\n'.includes(t[i])) i++; };
  const valor = (prof) => {
    ws();
    if (i >= n) return false;
    const c = t[i];
    if (prof > 100) return false;
    if (c === '{') {
      i++; ws();
      if (t[i] === '}') { i++; return true; }
      for (;;) {
        ws(); if (t[i] !== '"' || !texto()) return false;
        ws(); if (t[i] !== ':') return false; i++;
        if (!valor(prof + 1)) return false;
        ws();
        if (t[i] === ',') { i++; continue; }
        if (t[i] === '}') { i++; return true; }
        return false;
      }
    }
    if (c === '[') {
      i++; ws();
      if (t[i] === ']') { i++; return true; }
      for (;;) {
        if (!valor(prof + 1)) return false;
        ws();
        if (t[i] === ',') { i++; continue; }
        if (t[i] === ']') { i++; return true; }
        return false;
      }
    }
    if (c === '"') return texto();
    const m = /^(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(t.slice(i, i + 40));
    if (!m) return false;
    i += m[0].length; return true;
  };
  const texto = () => {
    i++;
    while (i < n) {
      if (t[i] === '\\') { i += 2; continue; }
      if (t[i] === '"') { i++; return true; }
      if (t[i] === '\n') return false;
      i++;
    }
    return false;
  };
  if (!valor(0)) return Math.min(i, n);
  ws();
  return i < n ? i : -1;
}

function posicaoJson(texto) {
  const pos = localizarErroJson(texto);
  const antes = texto.slice(0, pos < 0 ? texto.length : pos);
  return { linha: antes.split('\n').length, coluna: antes.length - antes.lastIndexOf('\n') };
}

/**
 * Valida o JSON do gráfico. Devolve { ok, erros:[{linha,coluna?,mensagem}], avisos, spec } (spec já normalizada).
 */
export function validarGraficoJson(texto) {
  const res = { ok: false, erros: [], avisos: [], spec: null };
  const src = String(texto ?? '');
  if (!src.trim()) { res.erros.push({ linha: 1, mensagem: 'O JSON do gráfico está vazio.' }); return res; }
  let bruto;
  try { bruto = JSON.parse(src); } catch (err) {
    const p = posicaoJson(src);
    res.erros.push({ ...p, mensagem: `JSON inválido: ${String(err.message).replace(/^JSON\.parse: /, '')}` });
    return res;
  }
  const spec = normalizarEspecGrafico(bruto);
  res.spec = spec;
  const falha = (mensagem) => res.erros.push({ linha: 1, mensagem });
  if (!TIPOS_GRAFICO.includes(spec.tipo)) {
    falha(`Tipo de gráfico "${spec.tipo || '(vazio)'}" não suportado. Use: ${TIPOS_GRAFICO.join(', ')}.`);
    return res;
  }
  if (spec.largura < 200 || spec.largura > 2000 || spec.altura < 120 || spec.altura > 1500) falha('largura/altura fora do intervalo aceito (200–2000 × 120–1500).');
  const tipo = spec.tipo;
  if (tipo === 'pizza' || tipo === 'rosca') {
    if (!spec.dados.length) falha('Pizza/rosca precisam de "dados": [{"rotulo": "...", "valor": 10}].');
    spec.dados.forEach((d, i) => { if (!ehNum(d.valor) || num(d.valor) < 0) falha(`dados[${i}].valor deve ser um número ≥ 0.`); });
    if (spec.dados.length && spec.dados.every(d => !(num(d.valor) > 0))) falha('A soma dos valores precisa ser maior que zero.');
  } else if (tipo === 'dispersao') {
    if (!spec.series.length) falha('Dispersão precisa de "series" com "pontos": [[x, y], ...].');
    spec.series.forEach((s, i) => {
      if (!Array.isArray(s.pontos) || !s.pontos.length) falha(`series[${i}] precisa de "pontos".`);
      else if (s.pontos.some(p => !ehNum(p[0]) || !ehNum(p[1]))) falha(`series[${i}].pontos deve conter apenas pares numéricos.`);
    });
  } else if (tipo === 'boxplot') {
    if (!spec.series.length) falha('Boxplot precisa de "series" com "caixas" ou "amostras".');
    spec.series.forEach((s, i) => {
      if (!s.caixas && !s.amostras) falha(`series[${i}] precisa de "caixas" ou "amostras".`);
      (s.caixas || []).forEach((c, j) => {
        const k = ['min', 'q1', 'mediana', 'q3', 'max'];
        if (k.some(x => !ehNum(c[x] ?? c[{ mediana: 'median' }[x]]))) falha(`series[${i}].caixas[${j}] precisa de min, q1, mediana, q3 e max numéricos.`);
      });
    });
  } else {
    if (!spec.series.length) falha('Informe "series": [{"nome": "...", "valores": [..]}].');
    const cats = spec.x.categorias || [];
    spec.series.forEach((s, i) => {
      if (!Array.isArray(s.valores) || !s.valores.length) falha(`series[${i}] precisa de "valores".`);
      else {
        if (s.valores.some(v => v !== null && !ehNum(v))) falha(`series[${i}].valores deve conter apenas números (ou null).`);
        if (cats.length && s.valores.length !== cats.length) res.avisos.push(`series[${i}] tem ${s.valores.length} valores e há ${cats.length} categorias.`);
      }
    });
    if (!cats.length && spec.series[0]?.valores) res.avisos.push('Sem "x.categorias": serão usados 1, 2, 3…');
  }
  res.ok = res.erros.length === 0;
  return res;
}

// ───────────────────────────── Desenho ─────────────────────────────

const svgTexto = (x, y, s, { tam = 11, ancora = 'start', cor, peso = 400, rot = 0, base = '', estilo = '' } = {}, tema) =>
  `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${tam}" text-anchor="${ancora}" fill="${cor || tema.texto}"${peso !== 400 ? ` font-weight="${peso}"` : ''}${rot ? ` transform="rotate(${rot} ${fmt(x)} ${fmt(y)})"` : ''}${base ? ` dominant-baseline="${base}"` : ''}${estilo}>${escTexto(s)}</text>`;

function corDaSerie(s, i, tema) { return s.cor || tema.paleta[i % tema.paleta.length]; }

/** Padrões de preenchimento para o modo cinza: distingue séries sem depender de cor. */
function defsPadroes(tema, n) {
  if (tema.nome_paleta !== 'cinza') return '';
  const pads = [];
  for (let i = 0; i < n; i++) {
    const c = tema.paleta[i % tema.paleta.length];
    const id = `pad${i}`;
    if (i % 3 === 0) continue;
    pads.push(`<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(${i % 3 === 1 ? 45 : -45})"><rect width="6" height="6" fill="#fff"/><rect width="2.4" height="6" fill="${c}"/></pattern>`);
  }
  return pads.length ? `<defs>${pads.join('')}</defs>` : '';
}
const preenchimento = (s, i, tema) => (tema.nome_paleta === 'cinza' && i % 3 !== 0 && !s.cor ? `url(#pad${i})` : corDaSerie(s, i, tema));

function legendaItens(itens, tema, posicao, W, H, areaTopo) {
  if (posicao === 'nenhuma' || !itens.length) return { svg: '', dx: 0, dy: 0 };
  const tam = 11;
  if (posicao === 'direita') {
    const larg = Math.max(...itens.map(i => medirTexto(i.nome, tam))) + 30;
    let y = areaTopo + 8;
    const svg = itens.map(it => {
      const g = `<rect x="${fmt(W - larg)}" y="${fmt(y)}" width="12" height="12" rx="2" fill="${it.fill}" stroke="${it.cor}" stroke-width="0.8"/>${svgTexto(W - larg + 18, y + 10, it.nome, { tam }, tema)}`;
      y += 20; return g;
    }).join('');
    return { svg, dx: larg + 12, dy: 0 };
  }
  // baixo: quebra em linhas
  const maxL = W - 40;
  const linhas = [[]]; let ocupado = 0;
  itens.forEach(it => {
    const w = medirTexto(it.nome, tam) + 34;
    if (ocupado + w > maxL && linhas[linhas.length - 1].length) { linhas.push([]); ocupado = 0; }
    linhas[linhas.length - 1].push({ ...it, w }); ocupado += w;
  });
  const alturaTotal = linhas.length * 20 + 6;
  let svg = '';
  linhas.forEach((ln, li) => {
    const total = ln.reduce((a, b) => a + b.w, 0);
    let x = (W - total) / 2;
    const y = H - alturaTotal + li * 20 + 4;
    ln.forEach(it => {
      svg += `<rect x="${fmt(x)}" y="${fmt(y)}" width="12" height="12" rx="2" fill="${it.fill}" stroke="${it.cor}" stroke-width="0.8"/>${svgTexto(x + 18, y + 10, it.nome, { tam }, tema)}`;
      x += it.w;
    });
  });
  return { svg, dx: 0, dy: alturaTotal + 4 };
}

function tituloSvg(spec, W, tema) {
  let svg = ''; let alt = 10;
  if (spec.titulo) { svg += svgTexto(W / 2, 22, spec.titulo, { tam: 14, ancora: 'middle', peso: 700 }, tema); alt = 34; }
  if (spec.subtitulo) { svg += svgTexto(W / 2, alt + 12, spec.subtitulo, { tam: 11, ancora: 'middle', cor: tema.suave }, tema); alt += 18; }
  return { svg, altura: alt };
}

function envolver(spec, corpo, tema, extras = '') {
  const { largura: W, altura: H } = spec;
  const fundo = tema.fundo ? `<rect width="${W}" height="${H}" fill="${tema.fundo}"/>` : '';
  const descr = `${spec.titulo || 'Gráfico'} (${spec.tipo})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="${tema.fonte}" role="img" aria-label="${escTexto(descr).replace(/"/g, '&quot;')}">${extras}${fundo}${corpo}</svg>`;
}

/** Eixos cartesianos (categorias × valores). Devolve { svg, area, escalaY, xCat(i), larguraCat }. */
function eixosCategoricos(spec, area, ymin, ymax, tema, horizontal = false) {
  const escala = escalaBonita(ymin, ymax, horizontal ? 5 : 6, spec.y);
  const cats = spec.__cats;
  const yTitulo = spec.y.titulo;
  const xTitulo = spec.x.titulo;
  const tam = 11;
  const rotulosY = escala.ticks.map(t => formatarValor(t, spec.y));
  const larguraRotY = Math.max(...rotulosY.map(r => medirTexto(r, tam)), 10);
  const maxCat = Math.max(...cats.map(c => medirTexto(c, tam)), 0);
  let esq = area.x + (horizontal ? maxCat + 12 : larguraRotY + 10) + (yTitulo && !horizontal ? 18 : 0) + (horizontal && xTitulo ? 18 : 0);
  let rodape = area.y + area.h - (xTitulo && !horizontal ? 20 : 0) - (horizontal && yTitulo ? 20 : 0);
  const larguraCat = (area.x + area.w - esq) / Math.max(cats.length, 1);
  const girar = !horizontal && cats.length > 0 && maxCat > larguraCat - 6;
  const baseRot = girar ? Math.min(maxCat * 0.72, 90) + 8 : 18;
  rodape -= horizontal ? 18 : baseRot;
  const topo = area.y;
  const direita = area.x + area.w;
  let svg = '';
  const alturaPlot = rodape - topo;
  if (horizontal) {
    const yv = (v) => esq + (v - escala.min) / (escala.max - escala.min) * (direita - esq);
    escala.ticks.forEach((t, i) => {
      const x = yv(t);
      if (spec.grade) svg += `<line x1="${fmt(x)}" y1="${fmt(topo)}" x2="${fmt(x)}" y2="${fmt(rodape)}" stroke="${tema.grade}" stroke-width="1"/>`;
      svg += svgTexto(x, rodape + 14, rotulosY[i], { tam, ancora: 'middle', cor: tema.suave }, tema);
    });
    const h = alturaPlot / Math.max(cats.length, 1);
    cats.forEach((c, i) => { svg += svgTexto(esq - 8, topo + h * (i + 0.5) + 4, c, { tam, ancora: 'end' }, tema); });
    svg += `<line x1="${fmt(esq)}" y1="${fmt(topo)}" x2="${fmt(esq)}" y2="${fmt(rodape)}" stroke="${tema.eixo}" stroke-width="1.2"/>`;
    if (yTitulo) svg += svgTexto((esq + direita) / 2, rodape + 32, yTitulo, { tam, ancora: 'middle', cor: tema.suave, peso: 600 }, tema);
    if (xTitulo) svg += svgTexto(area.x + 8, (topo + rodape) / 2, xTitulo, { tam, ancora: 'middle', cor: tema.suave, peso: 600, rot: -90 }, tema);
    return { svg, esq, direita, topo, rodape, escala, valor: yv, passoCat: h };
  }
  const yv = (v) => rodape - (v - escala.min) / (escala.max - escala.min) * alturaPlot;
  escala.ticks.forEach((t, i) => {
    const y = yv(t);
    if (spec.grade) svg += `<line x1="${fmt(esq)}" y1="${fmt(y)}" x2="${fmt(direita)}" y2="${fmt(y)}" stroke="${t === 0 ? tema.eixo : tema.grade}" stroke-width="1"/>`;
    svg += svgTexto(esq - 8, y + 4, rotulosY[i], { tam, ancora: 'end', cor: tema.suave }, tema);
  });
  cats.forEach((c, i) => {
    const cx = esq + larguraCat * (i + 0.5);
    svg += girar ? svgTexto(cx, rodape + 12, c, { tam, ancora: 'end', rot: -35 }, tema) : svgTexto(cx, rodape + 15, c, { tam, ancora: 'middle' }, tema);
  });
  svg += `<line x1="${fmt(esq)}" y1="${fmt(rodape)}" x2="${fmt(direita)}" y2="${fmt(rodape)}" stroke="${tema.eixo}" stroke-width="1.2"/><line x1="${fmt(esq)}" y1="${fmt(topo)}" x2="${fmt(esq)}" y2="${fmt(rodape)}" stroke="${tema.eixo}" stroke-width="1.2"/>`;
  if (xTitulo) svg += svgTexto((esq + direita) / 2, area.y + area.h - 2, xTitulo, { tam, ancora: 'middle', cor: tema.suave, peso: 600 }, tema);
  if (yTitulo) svg += svgTexto(area.x + 10, (topo + rodape) / 2, yTitulo, { tam, ancora: 'middle', cor: tema.suave, peso: 600, rot: -90 }, tema);
  return { svg, esq, direita, topo, rodape, escala, valor: yv, passoCat: larguraCat };
}

function areaUtil(spec, tema, itensLegenda) {
  const W = spec.largura, H = spec.altura;
  const tit = tituloSvg(spec, W, tema);
  const posLeg = spec.legenda === 'auto' ? (itensLegenda.length > 1 ? (itensLegenda.length > 5 ? 'direita' : 'baixo') : 'nenhuma') : spec.legenda;
  const leg = legendaItens(itensLegenda, tema, ['baixo', 'direita', 'nenhuma'].includes(posLeg) ? posLeg : 'baixo', W, H, tit.altura);
  return { W, H, tit, leg, area: { x: 10, y: tit.altura + 6, w: W - 20 - leg.dx, h: H - tit.altura - 12 - leg.dy } };
}

function rotuloValor(x, y, v, spec, tema) {
  return spec.rotulos_valores ? svgTexto(x, y, formatarValor(v, spec.y), { tam: 10, ancora: 'middle', cor: tema.texto }, tema) : '';
}

function desenharBarras(spec, tema) {
  const horizontal = spec.tipo === 'barras_horizontais';
  const empilhado = spec.tipo === 'barras_empilhadas';
  const n = Math.max(...spec.series.map(s => s.valores.length), 0);
  spec.__cats = Array.from({ length: n }, (_, i) => spec.x.categorias?.[i] ?? String(i + 1));
  const itens = spec.series.map((s, i) => ({ nome: s.nome, cor: corDaSerie(s, i, tema), fill: preenchimento(s, i, tema) }));
  const { W, H, tit, leg, area } = areaUtil(spec, tema, itens);
  const todos = spec.series.flatMap(s => s.valores.filter(Number.isFinite));
  let lo = Math.min(0, ...todos, Number.isFinite(spec.y.min) ? spec.y.min : 0), hi = Math.max(...todos, 0);
  if (empilhado) {
    hi = 0; lo = 0;
    for (let i = 0; i < n; i++) {
      let p = 0, ng = 0;
      spec.series.forEach(s => { const v = s.valores[i]; if (Number.isFinite(v)) { if (v >= 0) p += v; else ng += v; } });
      hi = Math.max(hi, p); lo = Math.min(lo, ng);
    }
  }
  const ex = eixosCategoricos(spec, area, lo, hi, tema, horizontal);
  let barras = '';
  const k = spec.series.length;
  const folga = 0.22;
  const grupo = ex.passoCat * (1 - folga);
  const larg = empilhado ? grupo : grupo / k;
  const eixoZero = ex.valor(0);
  for (let i = 0; i < n; i++) {
    const ini = (horizontal ? ex.topo : ex.esq) + ex.passoCat * i + ex.passoCat * folga / 2;
    let acumPos = 0, acumNeg = 0;
    spec.series.forEach((s, si) => {
      const v = s.valores[i];
      if (!Number.isFinite(v)) return;
      const fill = preenchimento(s, si, tema), cor = corDaSerie(s, si, tema);
      let v0 = 0, v1 = v;
      if (empilhado) { if (v >= 0) { v0 = acumPos; acumPos += v; v1 = acumPos; } else { v0 = acumNeg; acumNeg += v; v1 = acumNeg; } }
      const pos0 = ex.valor(v0), pos1 = ex.valor(v1);
      const off = ini + (empilhado ? 0 : larg * si);
      if (horizontal) {
        const x = Math.min(pos0, pos1), w = Math.abs(pos1 - pos0);
        barras += `<rect x="${fmt(x)}" y="${fmt(off)}" width="${fmt(w)}" height="${fmt(larg - (empilhado ? 0 : 2))}" fill="${fill}" stroke="${cor}" stroke-width="0.6"/>`;
        if (spec.rotulos_valores) barras += svgTexto(Math.max(pos0, pos1) + 4, off + larg / 2 + 3, formatarValor(v, spec.y), { tam: 10 }, tema);
      } else {
        const y = Math.min(pos0, pos1), h = Math.abs(pos1 - pos0);
        barras += `<rect x="${fmt(off)}" y="${fmt(y)}" width="${fmt(larg - (empilhado ? 0 : 2))}" height="${fmt(Math.max(h, 0.5))}" fill="${fill}" stroke="${cor}" stroke-width="0.6"/>`;
        barras += rotuloValor(off + (larg - (empilhado ? 0 : 2)) / 2, (v >= 0 ? y : y + h) + (v >= 0 ? -4 : 12), v, spec, tema);
      }
    });
  }
  void eixoZero;
  return envolver(spec, `${tit.svg}${ex.svg}${barras}${leg.svg}`, tema, defsPadroes(tema, spec.series.length));
}

function desenharLinhas(spec, tema, comArea) {
  const n = Math.max(...spec.series.map(s => s.valores.length), 0);
  spec.__cats = Array.from({ length: n }, (_, i) => spec.x.categorias?.[i] ?? String(i + 1));
  const itens = spec.series.map((s, i) => ({ nome: s.nome, cor: corDaSerie(s, i, tema), fill: corDaSerie(s, i, tema) }));
  const { tit, leg, area } = areaUtil(spec, tema, itens);
  const todos = spec.series.flatMap(s => s.valores.filter(Number.isFinite));
  const ex = eixosCategoricos(spec, area, comArea ? Math.min(0, ...todos) : Math.min(...todos), Math.max(...todos), tema);
  let corpo = '';
  const dash = ['', '6 3', '2 3', '8 3 2 3'];
  spec.series.forEach((s, si) => {
    const cor = corDaSerie(s, si, tema);
    const pts = s.valores.map((v, i) => (Number.isFinite(v) ? [ex.esq + ex.passoCat * (i + 0.5), ex.valor(v), v] : null));
    const segmentos = []; let atual = [];
    pts.forEach(p => { if (p) atual.push(p); else if (atual.length) { segmentos.push(atual); atual = []; } });
    if (atual.length) segmentos.push(atual);
    segmentos.forEach(seg => {
      if (comArea) corpo += `<path d="M${fmt(seg[0][0])} ${fmt(ex.valor(0))} ${seg.map(p => `L${fmt(p[0])} ${fmt(p[1])}`).join(' ')} L${fmt(seg[seg.length - 1][0])} ${fmt(ex.valor(0))} Z" fill="${cor}" fill-opacity="0.22"/>`;
      corpo += `<path d="M${seg.map(p => `${fmt(p[0])} ${fmt(p[1])}`).join(' L')}" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"${tema.nome_paleta === 'cinza' && dash[si % 4] ? ` stroke-dasharray="${dash[si % 4]}"` : ''}/>`;
    });
    pts.forEach(p => {
      if (!p) return;
      corpo += `<circle cx="${fmt(p[0])}" cy="${fmt(p[1])}" r="3.4" fill="#fff" stroke="${cor}" stroke-width="2"/>`;
      corpo += rotuloValor(p[0], p[1] - 8, p[2], spec, tema);
    });
  });
  return envolver(spec, `${tit.svg}${ex.svg}${corpo}${leg.svg}`, tema);
}

function desenharDispersao(spec, tema) {
  const itens = spec.series.map((s, i) => ({ nome: s.nome, cor: corDaSerie(s, i, tema), fill: corDaSerie(s, i, tema) }));
  const { tit, leg, area } = areaUtil(spec, tema, itens);
  const xs = spec.series.flatMap(s => s.pontos.map(p => num(p[0]))), ys = spec.series.flatMap(s => s.pontos.map(p => num(p[1])));
  const ey = escalaBonita(Math.min(...ys), Math.max(...ys), 6, spec.y);
  const ex = escalaBonita(Math.min(...xs), Math.max(...xs), 7, spec.x);
  const tam = 11;
  const rotY = ey.ticks.map(t => formatarValor(t, spec.y));
  const esq = area.x + Math.max(...rotY.map(r => medirTexto(r, tam))) + 12 + (spec.y.titulo ? 18 : 0);
  const rodape = area.y + area.h - 20 - (spec.x.titulo ? 18 : 0);
  const direita = area.x + area.w - 8, topo = area.y;
  const X = (v) => esq + 12 + (v - ex.min) / (ex.max - ex.min) * (direita - esq - 24);
  const Y = (v) => rodape - 12 - (v - ey.min) / (ey.max - ey.min) * (rodape - topo - 24);
  let svg = '';
  ey.ticks.forEach((t, i) => {
    if (spec.grade) svg += `<line x1="${fmt(esq)}" y1="${fmt(Y(t))}" x2="${fmt(direita)}" y2="${fmt(Y(t))}" stroke="${tema.grade}"/>`;
    svg += svgTexto(esq - 8, Y(t) + 4, rotY[i], { tam, ancora: 'end', cor: tema.suave }, tema);
  });
  ex.ticks.forEach(t => {
    if (spec.grade) svg += `<line x1="${fmt(X(t))}" y1="${fmt(topo)}" x2="${fmt(X(t))}" y2="${fmt(rodape)}" stroke="${tema.grade}"/>`;
    svg += svgTexto(X(t), rodape + 15, formatarValor(t, spec.x), { tam, ancora: 'middle', cor: tema.suave }, tema);
  });
  svg += `<line x1="${fmt(esq)}" y1="${fmt(rodape)}" x2="${fmt(direita)}" y2="${fmt(rodape)}" stroke="${tema.eixo}" stroke-width="1.2"/><line x1="${fmt(esq)}" y1="${fmt(topo)}" x2="${fmt(esq)}" y2="${fmt(rodape)}" stroke="${tema.eixo}" stroke-width="1.2"/>`;
  if (spec.x.titulo) svg += svgTexto((esq + direita) / 2, area.y + area.h - 2, spec.x.titulo, { tam, ancora: 'middle', cor: tema.suave, peso: 600 }, tema);
  if (spec.y.titulo) svg += svgTexto(area.x + 10, (topo + rodape) / 2, spec.y.titulo, { tam, ancora: 'middle', cor: tema.suave, peso: 600, rot: -90 }, tema);
  const forma = (si, x, y, cor) => {
    const k = si % 4;
    if (k === 0) return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="4" fill="${cor}" fill-opacity="0.8" stroke="#fff" stroke-width="0.8"/>`;
    if (k === 1) return `<rect x="${fmt(x - 3.6)}" y="${fmt(y - 3.6)}" width="7.2" height="7.2" fill="${cor}" fill-opacity="0.8" stroke="#fff" stroke-width="0.8"/>`;
    if (k === 2) return `<path d="M${fmt(x)} ${fmt(y - 4.6)} L${fmt(x + 4.2)} ${fmt(y + 3.4)} L${fmt(x - 4.2)} ${fmt(y + 3.4)} Z" fill="${cor}" fill-opacity="0.8" stroke="#fff" stroke-width="0.8"/>`;
    return `<path d="M${fmt(x - 4)} ${fmt(y - 4)} L${fmt(x + 4)} ${fmt(y + 4)} M${fmt(x + 4)} ${fmt(y - 4)} L${fmt(x - 4)} ${fmt(y + 4)}" stroke="${cor}" stroke-width="2"/>`;
  };
  spec.series.forEach((s, si) => { const cor = corDaSerie(s, si, tema); s.pontos.forEach(p => { svg += forma(si, X(num(p[0])), Y(num(p[1])), cor); }); });
  return envolver(spec, `${tit.svg}${svg}${leg.svg}`, tema);
}

function desenharPizza(spec, tema, rosca) {
  const dados = spec.dados.filter(d => num(d.valor) > 0);
  const total = dados.reduce((a, d) => a + num(d.valor), 0);
  const itens = dados.map((d, i) => ({ nome: `${d.rotulo || `Item ${i + 1}`} (${formatarValor(num(d.valor) / total * 100, { casas: 1 })}%)`, cor: d.cor || tema.paleta[i % tema.paleta.length], fill: d.cor || tema.paleta[i % tema.paleta.length] }));
  const { W, tit, leg, area } = areaUtil({ ...spec, legenda: spec.legenda === 'auto' ? 'direita' : spec.legenda }, tema, itens);
  const r = Math.max(30, Math.min(area.w, area.h) / 2 - 8);
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  void W;
  let ang = -Math.PI / 2; let corpo = '';
  const ri = rosca ? r * 0.55 : 0;
  dados.forEach((d, i) => {
    const frac = num(d.valor) / total;
    const a1 = ang + frac * Math.PI * 2;
    const cor = itens[i].cor;
    if (frac >= 0.9999) {
      corpo += `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${cor}" stroke="#fff" stroke-width="1.5"/>`;
      if (rosca) corpo += `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(ri)}" fill="${tema.fundo || '#fff'}"/>`;
    } else {
      const p = (a, rr) => `${fmt(cx + rr * Math.cos(a))} ${fmt(cy + rr * Math.sin(a))}`;
      const grande = frac > 0.5 ? 1 : 0;
      corpo += rosca
        ? `<path d="M${p(ang, r)} A${fmt(r)} ${fmt(r)} 0 ${grande} 1 ${p(a1, r)} L${p(a1, ri)} A${fmt(ri)} ${fmt(ri)} 0 ${grande} 0 ${p(ang, ri)} Z" fill="${cor}" stroke="#fff" stroke-width="1.5"/>`
        : `<path d="M${fmt(cx)} ${fmt(cy)} L${p(ang, r)} A${fmt(r)} ${fmt(r)} 0 ${grande} 1 ${p(a1, r)} Z" fill="${cor}" stroke="#fff" stroke-width="1.5"/>`;
    }
    if (frac >= 0.04) {
      const am = (ang + a1) / 2, rl = rosca ? (r + ri) / 2 : r * 0.62;
      const claro = /^#?(f|e|d)/i.test(cor.replace('#', ''));
      corpo += svgTexto(cx + rl * Math.cos(am), cy + rl * Math.sin(am) + 4, `${formatarValor(frac * 100, { casas: 0 })}%`, { tam: 11, ancora: 'middle', cor: claro ? '#1F2733' : '#fff', peso: 700 }, tema);
    }
    ang = a1;
  });
  return envolver(spec, `${tit.svg}${corpo}${leg.svg}`, tema);
}

function desenharBoxplot(spec, tema) {
  const grupos = []; // { serie, rotulo, stats }
  spec.series.forEach((s, si) => {
    if (s.caixas) s.caixas.forEach((c, j) => grupos.push({ si, j, rotulo: String(c.rotulo ?? c.label ?? spec.x.categorias?.[j] ?? j + 1), st: { min: num(c.min), q1: num(c.q1), mediana: num(c.mediana ?? c.median), q3: num(c.q3), max: num(c.max), atipicos: (c.atipicos || c.outliers || []).map(num) } }));
    else (s.amostras || []).forEach((a, j) => { const st = quartis(a); if (st) grupos.push({ si, j, rotulo: String(spec.x.categorias?.[j] ?? j + 1), st }); });
  });
  const nCat = Math.max(...spec.series.map(s => (s.caixas || s.amostras || []).length), 0);
  spec.__cats = Array.from({ length: nCat }, (_, j) => String(grupos.find(g => g.j === j)?.rotulo ?? j + 1));
  const itens = spec.series.length > 1 ? spec.series.map((s, i) => ({ nome: s.nome, cor: corDaSerie(s, i, tema), fill: corDaSerie(s, i, tema) })) : [];
  const { tit, leg, area } = areaUtil(spec, tema, itens);
  const vals = grupos.flatMap(g => [g.st.min, g.st.max, ...g.st.atipicos]);
  const ex = eixosCategoricos(spec, area, Math.min(...vals), Math.max(...vals), tema);
  const k = spec.series.length;
  const largGrupo = ex.passoCat * 0.7, largCaixa = Math.min(46, largGrupo / k - 4);
  let corpo = '';
  grupos.forEach(g => {
    const cor = corDaSerie(spec.series[g.si], g.si, tema);
    const cx = ex.esq + ex.passoCat * (g.j + 0.5) - largGrupo / 2 + (largGrupo / k) * (g.si + 0.5);
    const y = (v) => ex.valor(v);
    const { min, q1, mediana, q3, max, atipicos } = g.st;
    corpo += `<line x1="${fmt(cx)}" y1="${fmt(y(max))}" x2="${fmt(cx)}" y2="${fmt(y(q3))}" stroke="${cor}" stroke-width="1.5"/><line x1="${fmt(cx)}" y1="${fmt(y(q1))}" x2="${fmt(cx)}" y2="${fmt(y(min))}" stroke="${cor}" stroke-width="1.5"/>`;
    corpo += `<line x1="${fmt(cx - largCaixa / 4)}" y1="${fmt(y(max))}" x2="${fmt(cx + largCaixa / 4)}" y2="${fmt(y(max))}" stroke="${cor}" stroke-width="1.5"/><line x1="${fmt(cx - largCaixa / 4)}" y1="${fmt(y(min))}" x2="${fmt(cx + largCaixa / 4)}" y2="${fmt(y(min))}" stroke="${cor}" stroke-width="1.5"/>`;
    corpo += `<rect x="${fmt(cx - largCaixa / 2)}" y="${fmt(y(q3))}" width="${fmt(largCaixa)}" height="${fmt(Math.max(y(q1) - y(q3), 1))}" fill="${cor}" fill-opacity="0.25" stroke="${cor}" stroke-width="1.5"/>`;
    corpo += `<line x1="${fmt(cx - largCaixa / 2)}" y1="${fmt(y(mediana))}" x2="${fmt(cx + largCaixa / 2)}" y2="${fmt(y(mediana))}" stroke="${tema.texto}" stroke-width="2.2"/>`;
    atipicos.forEach(o => { corpo += `<circle cx="${fmt(cx)}" cy="${fmt(y(o))}" r="3" fill="none" stroke="${cor}" stroke-width="1.4"/>`; });
  });
  return envolver(spec, `${tit.svg}${ex.svg}${corpo}${leg.svg}`, tema);
}

/**
 * Renderiza o gráfico em SVG vetorial.
 * @param {string|object} entrada  texto JSON ou objeto
 * @param {object} [tema]  de `criarTemaVisual`
 * @returns {{ok:boolean, svg:string, largura:number, altura:number, erros:object[], avisos:string[]}}
 */
export function renderizarGraficoJson(entrada, tema) {
  const t = T(tema);
  const texto = typeof entrada === 'string' ? entrada : JSON.stringify(entrada ?? {});
  const v = validarGraficoJson(texto);
  if (!v.ok) return { ok: false, svg: '', largura: 0, altura: 0, erros: v.erros, avisos: v.avisos };
  const spec = v.spec;
  let svg;
  switch (spec.tipo) {
    case 'barras': case 'barras_horizontais': case 'barras_empilhadas': svg = desenharBarras(spec, t); break;
    case 'linhas': svg = desenharLinhas(spec, t, false); break;
    case 'area': svg = desenharLinhas(spec, t, true); break;
    case 'dispersao': svg = desenharDispersao(spec, t); break;
    case 'pizza': svg = desenharPizza(spec, t, false); break;
    case 'rosca': svg = desenharPizza(spec, t, true); break;
    default: svg = desenharBoxplot(spec, t);
  }
  return { ok: true, svg, largura: spec.largura, altura: spec.altura, erros: [], avisos: v.avisos };
}

/** Formata o JSON (2 espaços); devolve o texto original se for inválido. */
export function formatarGraficoJson(texto) {
  try { return JSON.stringify(JSON.parse(texto), null, 2); } catch { return String(texto ?? ''); }
}

export const EXEMPLOS_GRAFICO = Object.freeze({
  barras: { tipo: 'barras', titulo: 'Produção por região', x: { titulo: 'Região', categorias: ['Norte', 'Nordeste', 'Sul', 'Sudeste'] }, y: { titulo: 'Toneladas', min: 0 }, series: [{ nome: '2023', valores: [120, 180, 260, 310] }, { nome: '2024', valores: [150, 210, 240, 340] }] },
  linhas: { tipo: 'linhas', titulo: 'Evolução mensal', x: { categorias: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'] }, y: { titulo: 'Casos' }, series: [{ nome: 'Grupo A', valores: [12, 19, 15, 25, 32, 40] }, { nome: 'Grupo B', valores: [8, 11, 14, 13, 20, 24] }] },
  dispersao: { tipo: 'dispersao', titulo: 'Relação entre variáveis', x: { titulo: 'Horas de estudo' }, y: { titulo: 'Nota' }, series: [{ nome: 'Amostra', pontos: [[1, 4.5], [2, 5.2], [3, 6.8], [4, 7.1], [5, 8.4], [6, 8.9]] }] },
  pizza: { tipo: 'pizza', titulo: 'Distribuição', dados: [{ rotulo: 'Residencial', valor: 52 }, { rotulo: 'Comercial', valor: 31 }, { rotulo: 'Industrial', valor: 17 }] },
  boxplot: { tipo: 'boxplot', titulo: 'Distribuição por grupo', y: { titulo: 'Valor' }, series: [{ nome: 'Medidas', amostras: [[4, 5, 5, 6, 7, 8, 9, 14], [6, 7, 7, 8, 9, 10, 11], [3, 4, 5, 5, 6, 6, 7]] }], x: { categorias: ['Controle', 'Tratamento A', 'Tratamento B'] } }
});
