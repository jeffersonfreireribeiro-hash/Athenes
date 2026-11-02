// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Cabeçalho, Rodapé e Paginação dinâmica (módulo puro, sem DOM).
 *
 * Schema (todos os campos opcionais; documentos antigos continuam válidos):
 *
 *  mestra.cabecalho / mestra.rodape  (headerConfig / footerConfig)
 *    ativo, zonas {esquerda, centro, direita}, zonas_par {…}, pares_impares_diferentes,
 *    ocultar_primeira_pagina, fonte, tamanho_pt, peso, cor, entrelinha,
 *    linha_divisoria, linha_espessura_pt, linha_cor, distancia_borda_mm, respiro_mm
 *    (legado: texto, alinhamento — migrados para `zonas` na leitura)
 *
 *  mestra.numeracao_pagina / documento.paginacao  (pageNumberingConfig; a da mestra vence a do documento)
 *    ativo, local ('cabecalho'|'rodape'), horizontal ('esquerda'|'centro'|'direita'|'alternado'),
 *    formato, mascara, prefixo, sufixo, estilo ('arabico'|'romano_mai'|'romano_min'|'alfa_mai'|'alfa_min'),
 *    iniciar_em, continuar (false = reinicia a contagem no 1º folha da seção), ocultar_primeira
 *    (legado: rodape.numeracao/posicao_numero/formato/iniciar_em/ocultar_na_capa)
 *
 * Variáveis nas zonas: {documento.titulo} {documento.subtitulo} {documento.autor_principal}
 * {documento.instituicao} {documento.ano} {secao} {pagina} {total} {data}  (também com chaves duplas).
 */

import { FONTES_SISTEMA } from './athenes_estilos.js';

// ───────────────────────────── Estilos de numeração ─────────────────────────────

import { dimensoesPapelMm } from './athenes_grid.js';
import { margensEfetivasMm } from './athenes_mestra_canvas.js';

export const ESTILOS_NUMERICOS = Object.freeze([
  { id: 'arabico', rotulo: 'Arábicos', exemplo: '1, 2, 3' },
  { id: 'romano_mai', rotulo: 'Romanos maiúsculos', exemplo: 'I, II, III' },
  { id: 'romano_min', rotulo: 'Romanos minúsculos', exemplo: 'i, ii, iii' },
  { id: 'alfa_mai', rotulo: 'Letras maiúsculas', exemplo: 'A, B, C' },
  { id: 'alfa_min', rotulo: 'Letras minúsculas', exemplo: 'a, b, c' }
]);

export function paraRomano(num, minusculo = false) {
  const n = parseInt(num, 10);
  if (!n || n < 1) return String(num ?? 1);
  const val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const rom = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let res = '';
  let resto = n;
  for (let i = 0; i < val.length; i++) while (resto >= val[i]) { res += rom[i]; resto -= val[i]; }
  return minusculo ? res.toLowerCase() : res;
}

/** 1→A, 26→Z, 27→AA (base-26 bijetiva). */
export function paraAlfa(num, maiusculo = true) {
  let n = parseInt(num, 10);
  if (!n || n < 1) return String(num ?? 1);
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return maiusculo ? s : s.toLowerCase();
}

export function formatarNumeroEstilo(n, estilo = 'arabico') {
  switch (estilo) {
    case 'romano_mai': return paraRomano(n, false);
    case 'romano_min': return paraRomano(n, true);
    case 'alfa_mai': return paraAlfa(n, true);
    case 'alfa_min': return paraAlfa(n, false);
    default: return String(n);
  }
}

/** Modelos de exibição: `{p}` = página (no estilo escolhido) e `{t}` = total de páginas. */
export const FORMATOS_NUMERO = Object.freeze([
  { id: 'apenas_numero', rotulo: 'Número simples', modelo: '{p}' },
  { id: 'n_de_total', rotulo: 'Com total', modelo: '{p} de {t}' },
  { id: 'n_barra_total', rotulo: 'Com total (barra)', modelo: '{p} / {t}' },
  { id: 'n_of_total', rotulo: 'Com total (inglês)', modelo: '{p} of {t}' },
  { id: 'pagina_n', rotulo: 'Página N', modelo: 'Página {p}' },
  { id: 'pagina_n_de_total', rotulo: 'Página N de Total', modelo: 'Página {p} de {t}' },
  { id: 'pagina_barra_total', rotulo: 'Página N / Total', modelo: 'Página {p} / {t}' },
  { id: 'hifen', rotulo: 'Entre hífens', modelo: '- {p} -' },
  { id: 'romano_min', rotulo: 'Romano minúsculo (legado)', modelo: '{p}', estilo: 'romano_min' },
  { id: 'romano_mai', rotulo: 'Romano maiúsculo (legado)', modelo: '{p}', estilo: 'romano_mai' },
  { id: 'personalizado', rotulo: 'Personalizado', modelo: null }
]);

const POR_FORMATO = new Map(FORMATOS_NUMERO.map(f => [f.id, f]));

/** Texto do número de página já formatado (estilo + modelo + prefixo/sufixo). */
export function textoNumeroPagina(numero, total, cfg = {}, marcadores = null) {
  const f = POR_FORMATO.get(cfg.formato) || POR_FORMATO.get('n_de_total');
  const modelo = f.id === 'personalizado' ? String(cfg.mascara || '{p} de {t}') : f.modelo;
  // `marcadores` ({p, t}) permite que exportadores (DOCX) troquem o valor por campos dinâmicos do Word
  const corpo = modelo
    .replace(/\{p\}/gi, marcadores?.p ?? formatarNumeroEstilo(numero, estiloEfetivoNumeracao(cfg)))
    .replace(/\{(t|total)\}/gi, marcadores?.t ?? String(Math.max(1, total || 1)));
  return `${cfg.prefixo || ''}${corpo}${cfg.sufixo || ''}`;
}

/** Estilo numérico efetivo: o escolhido ou o implícito nos formatos legados (romano_min/mai). */
export function estiloEfetivoNumeracao(cfg = {}) {
  const f = POR_FORMATO.get(cfg.formato);
  return cfg.estilo && cfg.estilo !== 'arabico' ? cfg.estilo : (f?.estilo || 'arabico');
}

// ───────────────────────────── Normalização (com migração do legado) ─────────────────────────────

export const AREA_PADRAO = Object.freeze({
  ativo: false,
  zonas: null,                   // null = usar o legado (texto + alinhamento)
  zonas_par: null,
  pares_impares_diferentes: false,
  ocultar_primeira_pagina: false,
  fonte: 'nunito',
  tamanho_pt: 9,
  peso: 400,
  cor: '#64748B',
  entrelinha: 1.2,
  linha_divisoria: false,
  linha_espessura_pt: 0.75,
  linha_cor: '#CBD5E1',
  distancia_borda_mm: 10,
  respiro_mm: 4
});

const NUM = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};
const COR = (v, padrao) => (/^#[0-9a-f]{3,8}$/i.test(v || '') ? v : padrao);
const ZONAS_VAZIAS = () => ({ esquerda: '', centro: '', direita: '' });

function normalizarZonas(z) {
  if (!z || typeof z !== 'object') return null;
  return {
    esquerda: String(z.esquerda ?? ''),
    centro: String(z.centro ?? ''),
    direita: String(z.direita ?? '')
  };
}

/** Configuração efetiva (sem mutar) de cabeçalho ou rodapé, tolerante a valores inválidos. */
export function normalizarArea(area) {
  const a = area && typeof area === 'object' ? area : {};
  const base = AREA_PADRAO;
  return {
    ativo: !!a.ativo,
    zonas: normalizarZonas(a.zonas),
    zonas_par: normalizarZonas(a.zonas_par),
    texto_legado: typeof a.texto === 'string' ? a.texto : '',
    alinhamento_legado: ['esquerda', 'centro', 'direita'].includes(a.alinhamento) ? a.alinhamento : 'direita',
    pares_impares_diferentes: !!a.pares_impares_diferentes,
    ocultar_primeira_pagina: !!a.ocultar_primeira_pagina,
    fonte: a.fonte in FONTES_SISTEMA ? a.fonte : base.fonte,
    tamanho_pt: NUM(a.tamanho_pt, 6, 24, base.tamanho_pt),
    peso: [300, 400, 500, 600, 700, 800].includes(Number(a.peso)) ? Number(a.peso) : base.peso,
    cor: COR(a.cor, base.cor),
    entrelinha: NUM(a.entrelinha, 1, 2.5, base.entrelinha),
    linha_divisoria: !!a.linha_divisoria,
    linha_espessura_pt: NUM(a.linha_espessura_pt, 0.25, 4, base.linha_espessura_pt),
    linha_cor: COR(a.linha_cor, base.linha_cor),
    distancia_borda_mm: NUM(a.distancia_borda_mm, 0, 40, base.distancia_borda_mm),
    respiro_mm: NUM(a.respiro_mm, 0, 30, base.respiro_mm)
  };
}

export const NUMERACAO_PADRAO = Object.freeze({
  ativo: true,
  local: 'rodape',
  horizontal: 'direita',
  formato: 'n_de_total',
  mascara: '{p} de {t}',
  prefixo: '',
  sufixo: '',
  estilo: 'arabico',
  iniciar_em: 1,
  continuar: true,
  ocultar_primeira: false
});

export function sanitizarNumeracao(n) {
  return {
    ativo: n.ativo !== false,
    local: n.local === 'cabecalho' ? 'cabecalho' : 'rodape',
    horizontal: ['esquerda', 'centro', 'direita', 'alternado'].includes(n.horizontal) ? n.horizontal : 'direita',
    formato: POR_FORMATO.has(n.formato) ? n.formato : 'n_de_total',
    mascara: String(n.mascara || '{p} de {t}').slice(0, 80),
    prefixo: String(n.prefixo || '').slice(0, 40),
    sufixo: String(n.sufixo || '').slice(0, 40),
    estilo: ESTILOS_NUMERICOS.some(e => e.id === n.estilo) ? n.estilo : 'arabico',
    iniciar_em: Math.max(1, Math.min(9999, parseInt(n.iniciar_em, 10) || 1)),
    continuar: n.continuar !== false,
    ocultar_primeira: !!n.ocultar_primeira
  };
}

/**
 * Configuração de numeração da mestra: `mestra.numeracao_pagina` > `documento.paginacao` > legado do rodapé.
 * `legado: true` mantém a contagem física antiga (iniciar_em desloca todas as páginas).
 */
export function normalizarNumeracao(doc, mestra) {
  const novo = mestra?.numeracao_pagina || doc?.paginacao;
  if (novo && typeof novo === 'object') return { ...sanitizarNumeracao(novo), legado: false };

  const r = mestra?.rodape || {};
  const pos = String(r.posicao_numero || 'direita');
  const horizontal = pos.includes('alternado') ? 'alternado' : pos.includes('esquerda') ? 'esquerda' : pos.includes('centro') ? 'centro' : 'direita';
  const local = pos.startsWith('superior') ? 'cabecalho' : 'rodape';
  const ativo = local === 'cabecalho' ? !!mestra?.cabecalho?.ativo && r.numeracao !== false : !!r.ativo && r.numeracao !== false;
  return {
    ...sanitizarNumeracao({
      ativo, local, horizontal, formato: r.formato, mascara: r.mascara, prefixo: r.prefixo, sufixo: r.sufixo,
      iniciar_em: r.iniciar_em, estilo: 'arabico', continuar: true, ocultar_primeira: false
    }),
    ativo,
    legado: true,
    ocultar_fisica_1: r.ocultar_na_capa !== false
  };
}

// ───────────────────────────── Variáveis ─────────────────────────────

export function substituirVariaveis(texto, ctx = {}) {
  const doc = ctx.doc || {};
  const mapa = {
    'documento.titulo': doc.titulo || '',
    'documento.subtitulo': doc.subtitulo || '',
    'documento.autor_principal': doc.metadados?.autores?.[0]?.nome || '',
    'documento.instituicao': doc.metadados?.instituicao || '',
    'documento.ano': doc.metadados?.ano || String(new Date().getFullYear()),
    'secao': ctx.secaoNome || '',
    'pagina': ctx.pagina ?? '',
    'total': ctx.total ?? '',
    'data': new Date().toLocaleDateString('pt-BR')
  };
  return String(texto || '')
    .replace(/\{\{?\s*([\w.]+)\s*\}?\}/g, (m, k) => (k in mapa ? String(mapa[k]) : m))
    .replace(/\r?\n/g, ' · ');
}

const temVariavelPagina = (z) => /\{\{?\s*pagina\s*\}?\}/.test(`${z.esquerda}${z.centro}${z.direita}`);

export function espelharZonas(z) {
  return { esquerda: z.direita, centro: z.centro, direita: z.esquerda };
}

// ───────────────────────────── Numeração por seção ─────────────────────────────

function mestraDaPagina(doc, pag) {
  const lista = doc.mestras || doc.modelosPagina || [];
  const id = pag.mestraId || pag.modeloId;
  return lista.find(m => m.id === id) || lista[0] || null;
}

/**
 * Número exibido de cada página. Páginas sem número visível também contam (a capa é a página 1).
 * `continuar:false` reinicia a contagem na primeira folha da seção em `iniciar_em`.
 * @returns {number[]} um valor por página, na ordem de `doc.paginas`
 */
export function calcularNumerosExibidos(doc) {
  const paginas = doc?.paginas || [];
  const out = [];
  let ultimo = 0;
  paginas.forEach((pag, i) => {
    const cfg = normalizarNumeracao(doc, mestraDaPagina(doc, pag));
    let n;
    if (i === 0) n = cfg.iniciar_em;
    // legado: `iniciar_em` > 1 vale como "começar aqui"; sem isso a contagem continua (= numeração física)
    else if (pag.numeroNaSecao === 1 && (cfg.legado ? cfg.iniciar_em > 1 : cfg.continuar === false)) n = cfg.iniciar_em;
    else n = ultimo + 1;
    ultimo = n;
    out.push(n);
  });
  return out;
}

// ───────────────────────────── Geometria ─────────────────────────────

const PT_PARA_MM = 0.352778;

/** Altura estimada (mm) de uma área de cabeçalho/rodapé de uma linha. */
export function alturaAreaMm(area) {
  return area.tamanho_pt * area.entrelinha * PT_PARA_MM + (area.linha_divisoria ? area.linha_espessura_pt * PT_PARA_MM + 1.5 : 0);
}

/**
 * Onde começa e termina o corpo do texto. Cabeçalho/rodapé ficam na margem, a `distancia_borda_mm` da borda
 * da folha; se não couberem (com o respiro) a margem cresce — o corpo nunca é invadido.
 */
export function geometriaCorpoMm(mestra) {
  const dim = dimensoesPapelMm(mestra?.formato, mestra?.orientacao, mestra?.formato_personalizado);
  const m = margensEfetivasMm(mestra, dim.largura_mm, dim.altura_mm); // um quadro de texto na mestra define o corpo
  const cab = normalizarArea(mestra?.cabecalho);
  const rod = normalizarArea(mestra?.rodape);
  const topoCab = cab.ativo ? cab.distancia_borda_mm + alturaAreaMm(cab) + cab.respiro_mm : 0;
  const baseRod = rod.ativo ? rod.distancia_borda_mm + alturaAreaMm(rod) + rod.respiro_mm : 0;
  const alturaFolha = dim.altura_mm;
  const topo = Math.max(m.t || 0, topoCab);
  const base = Math.max(m.b || 0, baseRod);
  return { topoMm: topo, baseMm: base, alturaCorpoMm: Math.max(100, alturaFolha - topo - base), margemEsq: m.l || 0, margemDir: m.r || 0 };
}

/**
 * Zonas iniciais de uma área para edição: as já definidas ou o legado (texto único) distribuído como o
 * renderizador sempre fez — cabeçalho no lado do `alinhamento`; rodapé no lado oposto ao do número.
 */
export function zonasIniciais(mestra, tipo, numeracao = normalizarNumeracao(null, mestra)) {
  const area = normalizarArea(mestra?.[tipo]);
  if (area.zonas) return { ...area.zonas };
  const z = ZONAS_VAZIAS();
  if (tipo === 'cabecalho') z[area.alinhamento_legado] = area.texto_legado;
  else z[numeracao.horizontal === 'direita' ? 'esquerda' : numeracao.horizontal === 'esquerda' ? 'direita' : 'esquerda'] = area.texto_legado;
  return z;
}

// ───────────────────────────── Resolução por página ─────────────────────────────

/** CSS (objeto camelCase) do texto de uma área. */
export function cssTextoArea(area) {
  return {
    fontFamily: (FONTES_SISTEMA[area.fonte]?.familia || FONTES_SISTEMA.nunito.familia).replace(/"/g, "'"),
    fontSize: `${area.tamanho_pt}pt`,
    fontWeight: String(area.peso),
    color: area.cor,
    lineHeight: String(area.entrelinha)
  };
}

/**
 * Tudo o que um renderizador precisa para desenhar cabeçalho e rodapé de UMA página.
 * @returns {{numeroExibido:number, rotuloNumero:string, cabecalho:object|null, rodape:object|null}}
 */
export function resolverAreasPagina(doc, mestra, pag, numeroExibido, total, opcoes = {}) {
  const numeracao = normalizarNumeracao(doc, mestra);
  const primeiraDaSecao = pag.numeroNaSecao === 1;
  const ehPar = pag.numero % 2 === 0;
  const secao = (doc.secoes || []).find(s => s.id === pag.secaoId);

  let mostrarNumero = numeracao.ativo;
  if (numeracao.legado && numeracao.ocultar_fisica_1 && pag.numero === 1) mostrarNumero = false;
  if (!numeracao.legado && numeracao.ocultar_primeira && primeiraDaSecao) mostrarNumero = false;
  const rotuloNumero = mostrarNumero ? textoNumeroPagina(numeroExibido, total, numeracao, opcoes.marcadores) : '';
  const zonaNumero = numeracao.horizontal === 'alternado' ? (ehPar ? 'esquerda' : 'direita') : numeracao.horizontal;

  const montar = (tipo) => {
    const area = normalizarArea(mestra?.[tipo]);
    if (!area.ativo) return null;
    if (area.ocultar_primeira_pagina && primeiraDaSecao) return null;

    let zonas;
    if (area.zonas) {
      zonas = area.pares_impares_diferentes && ehPar ? (area.zonas_par || espelharZonas(area.zonas)) : area.zonas;
      zonas = { ...zonas };
    } else {
      // legado: um único texto; no rodapé fica no lado oposto ao do número
      zonas = ZONAS_VAZIAS();
      if (tipo === 'cabecalho') zonas[area.alinhamento_legado] = area.texto_legado;
      else {
        const oposta = zonaNumero === 'direita' ? 'esquerda' : zonaNumero === 'esquerda' ? 'direita' : 'esquerda';
        zonas[oposta] = area.texto_legado;
      }
    }

    const ctx = { doc, secaoNome: secao?.nome || '', pagina: rotuloNumero, total };
    const resolvidas = {
      esquerda: substituirVariaveis(zonas.esquerda, ctx),
      centro: substituirVariaveis(zonas.centro, ctx),
      direita: substituirVariaveis(zonas.direita, ctx)
    };
    // o número é injetado na zona escolhida, a menos que o usuário já o tenha posicionado com {pagina}
    if (rotuloNumero && numeracao.local === tipo && !temVariavelPagina(zonas)) {
      const atual = resolvidas[zonaNumero];
      resolvidas[zonaNumero] = atual ? `${atual} · ${rotuloNumero}` : rotuloNumero;
    }
    return {
      tipo,
      zonas: resolvidas,
      css: cssTextoArea(area),
      linha: area.linha_divisoria ? { espessura_pt: area.linha_espessura_pt, cor: area.linha_cor } : null,
      distancia_borda_mm: area.distancia_borda_mm,
      respiro_mm: area.respiro_mm,
      vazia: !resolvidas.esquerda && !resolvidas.centro && !resolvidas.direita
    };
  };

  return { numeroExibido, rotuloNumero, cabecalho: montar('cabecalho'), rodape: montar('rodape') };
}
