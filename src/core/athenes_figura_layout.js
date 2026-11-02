// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Figuras e Subgrid: catálogo de layouts, configuração normalizada e descrição de estilo.
 *
 * Módulo puro (sem DOM). O editor, a prévia do modal e a exportação PDF consomem a MESMA descrição
 * (`descreverFigura`), então o que se vê no canvas é o que sai no PDF.
 *
 * Propriedades serializadas no bloco `figura`/`imagem` (todas opcionais, com padrão):
 *   layout, gap_modo, subrotulo_tipo, subrotulo_formato, subrotulo_posicao,
 *   titulo_estilo_id, legenda_estilo_id, fonte_estilo_id, sublegenda_estilo_id, subrotulo_texto_estilo_id,
 *   titulo_alinhamento, legenda_alinhamento, fonte_alinhamento, sublegenda_alinhamento,
 *   img_moldura, img_borda_largura_pt, img_borda_estilo, img_borda_cor, img_raio, img_sombra,
 *   ajuste_enquadramento, foco_x, foco_y, proporcao_imagem, altura_modo,
 *   largura_modo, largura_pct, alinhamento_bloco, fluxo
 * Por item (`itens[i]`): url, legenda_sub, ajuste, foco_x, foco_y.
 */

// ───────────────────────────── Layouts do subgrid ─────────────────────────────

const L = (id, rotulo, cols, rows, slots, grupo) => ({ id, rotulo, cols, rows, slots, grupo });
// slot = [colIni, colFim, linhaIni, linhaFim] em linhas de grade (1-based, fim exclusivo)

export const LAYOUTS_FIGURA = Object.freeze([
  L('1', '1 imagem', [1], [1], [[1, 2, 1, 2]], 'unica'),
  L('2_lado', 'Lado a lado 1×2', [1, 1], [1], [[1, 2, 1, 2], [2, 3, 1, 2]], 'linha'),
  L('3_linha', 'Lado a lado 1×3', [1, 1, 1], [1], [[1, 2, 1, 2], [2, 3, 1, 2], [3, 4, 1, 2]], 'linha'),
  L('4_linha', 'Lado a lado 1×4', [1, 1, 1, 1], [1], [[1, 2, 1, 2], [2, 3, 1, 2], [3, 4, 1, 2], [4, 5, 1, 2]], 'linha'),
  L('2_empilhado', 'Empilhadas 2×1', [1], [1, 1], [[1, 2, 1, 2], [1, 2, 2, 3]], 'grade'),
  L('4_grade', 'Grade 2×2', [1, 1], [1, 1], [[1, 2, 1, 2], [2, 3, 1, 2], [1, 2, 2, 3], [2, 3, 2, 3]], 'grade'),
  L('6_grade', 'Grade 2×3', [1, 1, 1], [1, 1], [[1, 2, 1, 2], [2, 3, 1, 2], [3, 4, 1, 2], [1, 2, 2, 3], [2, 3, 2, 3], [3, 4, 2, 3]], 'grade'),
  L('6_grade_3x2', 'Grade 3×2', [1, 1], [1, 1, 1], [[1, 2, 1, 2], [2, 3, 1, 2], [1, 2, 2, 3], [2, 3, 2, 3], [1, 2, 3, 4], [2, 3, 3, 4]], 'grade'),
  // "3_misto" é o id legado de "1 grande à esquerda + 2 empilhadas à direita"
  L('3_misto', 'Destaque à esquerda + 2', [2, 1], [1, 1], [[1, 2, 1, 3], [2, 3, 1, 2], [2, 3, 2, 3]], 'destaque'),
  L('3_panoramica', 'Panorâmica no topo + 2', [1, 1], [1, 1], [[1, 3, 1, 2], [1, 2, 2, 3], [2, 3, 2, 3]], 'destaque')
]);

const POR_ID = new Map(LAYOUTS_FIGURA.map(l => [l.id, l]));

export function obterLayoutFigura(id) {
  return POR_ID.get(id) || POR_ID.get('1');
}

export function qtdSlotsDoLayout(id) {
  return obterLayoutFigura(id).slots.length;
}

/** Ajusta `bloco.itens` ao nº de slots do layout (trunca/completa) sem tocar nos itens existentes. */
export function ajustarItensAoLayout(bloco) {
  const q = qtdSlotsDoLayout(bloco.layout);
  if (!Array.isArray(bloco.itens) || bloco.itens.length === 0) {
    bloco.itens = [{ url: bloco.src || '', legenda_sub: 'Visão Geral' }];
  }
  if (bloco.itens.length > q) bloco.itens = bloco.itens.slice(0, q);
  while (bloco.itens.length < q) {
    bloco.itens.push({ url: '', legenda_sub: `Item ${String.fromCharCode(97 + bloco.itens.length).toUpperCase()}` });
  }
  if (q === 1 && bloco.itens[0]) bloco.src = bloco.itens[0].url || bloco.src || '';
  return bloco.itens;
}

// ───────────────────────────── Opções ─────────────────────────────

export const GAPS_FIGURA = Object.freeze({ nenhum: 0, compacto: 4, normal: 8, amplo: 16 }); // px
export const SUBROTULO_TIPOS = ['nenhum', 'letra_minuscula', 'letra_maiuscula', 'numero'];
export const SUBROTULO_FORMATOS = ['parenteses', 'fecha', 'ponto', 'simples'];
export const ALINHAMENTOS_TEXTO = ['estilo', 'left', 'center', 'right', 'justify'];
export const SUBROTULO_POSICOES = ['interna', 'externa'];
export const MOLDURAS_IMG = ['nenhuma', 'fina', 'dupla', 'passe_partout'];
export const RAIOS_IMG = Object.freeze({ reto: 0, discreto: 3, arredondado: 10, pilula: 999 });
export const SOMBRAS_IMG = Object.freeze({
  nenhuma: 'none',
  suave: '0 1px 3px rgba(15,23,42,.18)',
  media: '0 4px 10px rgba(15,23,42,.25)',
  elevada: '0 10px 24px rgba(15,23,42,.32)'
});
export const AJUSTES_IMG = ['contain', 'cover', 'fill'];
export const LARGURAS_BLOCO = ['corpo', 'estendida', 'pagina', 'pct'];
export const ALINHAMENTOS_BLOCO = ['esquerda', 'centro', 'direita'];
export const FLUXOS = ['em_linha', 'contornar_esq', 'contornar_dir'];
export const PROPORCOES = ['livre', '16/9', '4/3', '1/1', '3/4', '9/16'];

const COR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const dentro = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
const idEstilo = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : '');
const ALIN_PT = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'justify', justificado_esquerda: 'justify' };
const alinTexto = (v) => dentro(ALIN_PT[v] || v, ALINHAMENTOS_TEXTO, 'estilo');
const num = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

/** Chaves do bloco que compõem a identidade visual portável (tema). */
export const CHAVES_ESTILO_FIGURA = Object.freeze([
  'layout', 'gap_modo', 'subrotulo_tipo', 'subrotulo_formato', 'subrotulo_posicao',
  'titulo_estilo_id', 'numeracao_estilo_id', 'legenda_estilo_id', 'fonte_estilo_id', 'sublegenda_estilo_id', 'subrotulo_texto_estilo_id',
  'titulo_alinhamento', 'legenda_alinhamento', 'fonte_alinhamento', 'sublegenda_alinhamento',
  'img_moldura', 'img_borda_largura_pt', 'img_borda_estilo', 'img_borda_cor', 'img_raio', 'img_sombra',
  'ajuste_enquadramento', 'foco_x', 'foco_y', 'proporcao_imagem',
  'largura_modo', 'largura_pct', 'alinhamento_bloco', 'fluxo'
]);

/** Configuração efetiva (sem mutar o bloco): valores inválidos/ausentes caem no padrão. */
export function obterConfigFigura(b = {}) {
  return {
    layout: POR_ID.has(b.layout) ? b.layout : '1',
    gap_modo: dentro(b.gap_modo, Object.keys(GAPS_FIGURA), 'normal'),
    subrotulo_tipo: dentro(b.subrotulo_tipo, SUBROTULO_TIPOS, 'nenhum'),
    subrotulo_formato: dentro(b.subrotulo_formato, SUBROTULO_FORMATOS, 'parenteses'),
    subrotulo_posicao: dentro(b.subrotulo_posicao, SUBROTULO_POSICOES, 'externa'),
    img_moldura: dentro(b.img_moldura, MOLDURAS_IMG, 'nenhuma'),
    img_borda_largura_pt: num(b.img_borda_largura_pt, 0.25, 6, 0.75),
    img_borda_estilo: dentro(b.img_borda_estilo, ['solida', 'tracejada'], 'solida'),
    img_borda_cor: COR.test(b.img_borda_cor || '') ? b.img_borda_cor : '#94A3B8',
    img_raio: dentro(b.img_raio, Object.keys(RAIOS_IMG), 'discreto'),
    img_sombra: dentro(b.img_sombra, Object.keys(SOMBRAS_IMG), 'nenhuma'),
    ajuste_enquadramento: b.ajuste_enquadramento === 'scale-down' ? 'contain' : dentro(b.ajuste_enquadramento, AJUSTES_IMG, 'contain'),
    foco_x: num(b.foco_x, 0, 100, 50),
    foco_y: num(b.foco_y, 0, 100, 50),
    proporcao_imagem: dentro(b.proporcao_imagem, PROPORCOES, 'livre'),
    altura_modo: typeof b.altura_modo === 'string' && /^(auto|100%|\d{2,4}px)$/.test(b.altura_modo) ? b.altura_modo : 'auto',
    largura_modo: dentro(b.largura_modo, LARGURAS_BLOCO, 'corpo'),
    largura_pct: num(b.largura_pct, 20, 100, 100),
    alinhamento_bloco: dentro(b.alinhamento_bloco, ALINHAMENTOS_BLOCO, 'centro'),
    fluxo: dentro(b.fluxo, FLUXOS, 'em_linha'),
    titulo_estilo_id: idEstilo(b.titulo_estilo_id),
    numeracao_estilo_id: idEstilo(b.numeracao_estilo_id),
    legenda_estilo_id: idEstilo(b.legenda_estilo_id),
    fonte_estilo_id: idEstilo(b.fonte_estilo_id),
    sublegenda_estilo_id: idEstilo(b.sublegenda_estilo_id),
    subrotulo_texto_estilo_id: idEstilo(b.subrotulo_texto_estilo_id),
    titulo_alinhamento: alinTexto(b.titulo_alinhamento),
    legenda_alinhamento: alinTexto(b.legenda_alinhamento),
    fonte_alinhamento: alinTexto(b.fonte_alinhamento),
    sublegenda_alinhamento: alinTexto(b.sublegenda_alinhamento)
  };
}

/** Estilo de texto (id + alinhamento) do título e da fonte de tabela/quadro, sanitizado (portável em tema). */
export function extrairTipografiaTituloFonte(b = {}) {
  return {
    titulo_estilo_id: idEstilo(b.titulo_estilo_id),
    titulo_alinhamento: alinTexto(b.titulo_alinhamento),
    fonte_estilo_id: idEstilo(b.fonte_estilo_id),
    fonte_alinhamento: alinTexto(b.fonte_alinhamento),
    numeracao_estilo_id: idEstilo(b.numeracao_estilo_id),   // "Tabela 1", "Quadro 1"
    dados_estilo_id: idEstilo(b.dados_estilo_id)            // conteúdo das células
  };
}

/** Subconjunto portável (tema `athenes-tema-v1`), sempre sanitizado. */
export function extrairEstiloFigura(b = {}) {
  const cfg = obterConfigFigura(b);
  const out = {};
  for (const k of CHAVES_ESTILO_FIGURA) out[k] = cfg[k];
  return out;
}

/** Sanitiza o estilo vindo de JSON externo (tema/IA): só chaves conhecidas, valores válidos. */
export function sanitizarEstiloFigura(entrada) {
  return extrairEstiloFigura(entrada && typeof entrada === 'object' ? entrada : {});
}

/** Aplica o estilo portável ao bloco sem tocar no conteúdo (itens, título, legenda, fonte). */
export function aplicarEstiloFiguraAoBloco(b, estilo, { incluirLayout = false } = {}) {
  const e = sanitizarEstiloFigura(estilo);
  for (const k of CHAVES_ESTILO_FIGURA) {
    if (k === 'layout' && !incluirLayout) continue; // um tema não deve descartar imagens já inseridas
    b[k] = e[k];
  }
  if (incluirLayout) ajustarItensAoLayout(b);
  return b;
}

// ───────────────────────────── Descrição de estilo ─────────────────────────────

/** Placeholder neutro (SVG embutido) para slots sem imagem: funciona offline, no editor e no PDF. */
export const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">'
  + '<rect width="160" height="100" fill="#EEF2F7"/><rect x="1" y="1" width="158" height="98" fill="none" stroke="#CBD5E1" stroke-dasharray="4 3"/>'
  + '<g fill="none" stroke="#94A3B8" stroke-width="3" stroke-linejoin="round"><rect x="58" y="32" width="44" height="36" rx="3"/>'
  + '<circle cx="70" cy="44" r="4"/><path d="M60 64l13-12 9 8 7-6 11 10"/></g></svg>'
);

/**
 * Rótulo da subfigura. `tipo`: letra_minuscula (a), letra_maiuscula (A), numero (1) ou nenhum.
 * `formato`: parenteses `(a)`, fecha `a)`, ponto `a.`, simples `a`.
 */
export function rotuloSubfigura(idx, tipo, formato = 'parenteses') {
  if (!SUBROTULO_TIPOS.includes(tipo) || tipo === 'nenhum') return '';
  const letra = String.fromCharCode(97 + (idx % 26));
  const base = tipo === 'numero' ? String(idx + 1) : tipo === 'letra_maiuscula' ? letra.toUpperCase() : letra;
  if (formato === 'parenteses') return `(${base})`;
  if (formato === 'fecha') return `${base})`;
  if (formato === 'ponto') return `${base}.`;
  return base;
}

/** Sublegendas/rótulos só existem quando há mais de uma imagem no bloco. */
export function figuraTemVariasImagens(b) {
  return qtdSlotsDoLayout(b?.layout) > 1;
}

/** camelCase → kebab-case para montar `style="..."` no PDF. */
export function cssObjParaString(o) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
    .join(';');
}

/**
 * Descreve a figura: estilos CSS (objetos camelCase) do bloco, da grade e de cada item.
 * @param {object} b  bloco figura/imagem
 * @param {{margens_mm?:{l:number,r:number}, permitirFlutuar?:boolean}} opc
 *   `permitirFlutuar`: só o PDF (fluxo contínuo) contorna texto; o canvas do editor posiciona blocos em
 *   grade de 12 colunas, onde o contorno é obtido colocando blocos lado a lado.
 */
export function descreverFigura(b, { margens_mm = { l: 25, r: 20 }, permitirFlutuar = false } = {}) {
  const cfg = obterConfigFigura(b);
  const layout = obterLayoutFigura(cfg.layout);
  const gap = GAPS_FIGURA[cfg.gap_modo];
  const qtd = layout.slots.length;
  const itensSrc = Array.isArray(b.itens) && b.itens.length ? b.itens : [{ url: b.src || '', legenda_sub: '' }];

  // — bloco (largura, alinhamento, fluxo) —
  const bloco = {};
  const ml = Number(margens_mm.l) || 0;
  const mr = Number(margens_mm.r) || 0;
  const flutua = permitirFlutuar && cfg.fluxo !== 'em_linha';
  if (cfg.largura_modo === 'pct') bloco.width = `${cfg.largura_pct}%`;
  else if (cfg.largura_modo === 'pagina') {
    bloco.width = `calc(100% + ${ml + mr}mm)`;
    bloco.marginLeft = `-${ml}mm`;
    bloco.marginRight = `-${mr}mm`;
  } else if (cfg.largura_modo === 'estendida') {
    bloco.width = `calc(100% + ${(ml + mr) / 2}mm)`;
    bloco.marginLeft = `-${ml / 2}mm`;
    bloco.marginRight = `-${mr / 2}mm`;
  }
  if (cfg.largura_modo === 'pct' || flutua) {
    if (flutua && cfg.largura_modo !== 'pct') bloco.width = '50%';
    const al = cfg.alinhamento_bloco;
    bloco.marginLeft = al === 'esquerda' ? '0' : 'auto';
    bloco.marginRight = al === 'direita' ? '0' : 'auto';
  }
  if (flutua) {
    bloco.float = cfg.fluxo === 'contornar_esq' ? 'left' : 'right';
    bloco.marginLeft = cfg.fluxo === 'contornar_esq' ? '0' : '12px';
    bloco.marginRight = cfg.fluxo === 'contornar_esq' ? '12px' : '0';
    bloco.marginBottom = '8px';
  } else if (permitirFlutuar) {
    bloco.clear = 'both';
  }

  // — grade —
  const grade = {
    display: 'grid',
    gridTemplateColumns: layout.cols.map(f => `${f}fr`).join(' '),
    gridTemplateRows: layout.rows.map(() => 'auto').join(' '),
    gap: `${gap}px`
  };

  // — moldura (por imagem) —
  const moldura = { boxSizing: 'border-box', overflow: 'hidden', position: 'relative', borderRadius: `${RAIOS_IMG[cfg.img_raio]}px` };
  const estiloBorda = cfg.img_borda_estilo === 'tracejada' ? 'dashed' : 'solid';
  if (cfg.img_moldura === 'fina') {
    moldura.border = `${cfg.img_borda_largura_pt}pt ${estiloBorda} ${cfg.img_borda_cor}`;
  } else if (cfg.img_moldura === 'dupla') {
    moldura.border = `${Math.max(3, cfg.img_borda_largura_pt * 3)}px double ${cfg.img_borda_cor}`;
  } else if (cfg.img_moldura === 'passe_partout') {
    moldura.border = `${cfg.img_borda_largura_pt}pt ${estiloBorda} ${cfg.img_borda_cor}`;
    moldura.padding = '10px';
    moldura.background = '#FFFFFF';
  }
  if (cfg.img_sombra !== 'nenhuma') {
    moldura.boxShadow = SOMBRAS_IMG[cfg.img_sombra];
    moldura.overflow = cfg.img_moldura === 'passe_partout' ? 'hidden' : moldura.overflow;
  }

  const itens = [];
  for (let i = 0; i < qtd; i++) {
    const it = itensSrc[i] || { url: '', legenda_sub: '' };
    const ajuste = it.ajuste && AJUSTES_IMG.includes(it.ajuste) ? it.ajuste : cfg.ajuste_enquadramento;
    const fx = it.foco_x !== undefined ? num(it.foco_x, 0, 100, cfg.foco_x) : cfg.foco_x;
    const fy = it.foco_y !== undefined ? num(it.foco_y, 0, 100, cfg.foco_y) : cfg.foco_y;
    const [c0, c1, r0, r1] = layout.slots[i];
    const img = { display: 'block', objectFit: ajuste, objectPosition: `${fx}% ${fy}%` };
    const forca = ajuste !== 'contain' || cfg.proporcao_imagem !== 'livre' || cfg.altura_modo !== 'auto';
    // alinhamento da imagem na célula (vocabulário legado pt/en); com largura forçada a moldura ocupa a célula
    const alImg = { esquerda: 'flex-start', left: 'flex-start', direita: 'flex-end', right: 'flex-end' }[b.alinhamento_imagem] || 'center';
    if (forca) img.width = '100%'; else img.maxWidth = '100%';
    if (cfg.proporcao_imagem !== 'livre') img.aspectRatio = cfg.proporcao_imagem;
    if (cfg.altura_modo !== 'auto') { img.height = cfg.altura_modo; img.maxHeight = 'none'; }
    // célula que ocupa várias linhas: a moldura cresce e a imagem preenche a altura disponível (flex)
    const moldCelula = { ...moldura, alignSelf: forca ? 'stretch' : alImg };
    if (r1 - r0 > 1) {
      moldCelula.flex = '1 1 auto';
      moldCelula.display = 'flex';
      moldCelula.flexDirection = 'column';
      if (cfg.altura_modo === 'auto' && cfg.proporcao_imagem === 'livre') {
        img.width = '100%'; img.flex = '1 1 0'; img.minHeight = '0'; img.maxHeight = 'none'; img.objectFit = ajuste === 'contain' ? 'cover' : ajuste;
      }
    }
    const texto = qtd > 1 ? rotuloSubfigura(i, cfg.subrotulo_tipo, cfg.subrotulo_formato) : '';
    itens.push({
      idx: i,
      url: it.url || (qtd === 1 ? b.src || '' : ''),
      legenda_sub: it.legenda_sub || '',
      celula: { gridColumn: `${c0} / ${c1}`, gridRow: `${r0} / ${r1}`, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' },
      moldura: moldCelula,
      img,
      subrotulo: texto ? { texto, interno: cfg.subrotulo_posicao === 'interna' } : null
    });
  }
  return { cfg, qtd, bloco, grade, itens };
}
