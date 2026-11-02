// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Folhas mestras dinâmicas: geometria, transformação, snapping, alinhamento, camadas,
 * atribuição por intervalo de páginas e overrides por página. Módulo puro (sem DOM), compartilhado
 * pelo editor de mestras, pelo editor de páginas, pela exportação PDF e pela DOCX.
 *
 * Convenções: milímetros (mm) em coordenadas da folha (origem no canto superior esquerdo);
 * rotação em graus, horária, em torno do centro do elemento; fontes em pt.
 */

export const UNIDADES = { mm: 1, cm: 10, pt: 25.4 / 72, px: 25.4 / 96 };
export const ALCAS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const ANCORAS = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'];
export const ANGULOS_TRAVADOS = [0, 90, 180, 270];
export const TIPOS_LIVRES = ['forma', 'texto', 'quadro_texto'];

const arred = (v, c = 3) => { const f = 10 ** c; return Math.round((Number(v) || 0) * f) / f; };

// ───────────────────────────── Unidades ─────────────────────────────

/** Converte um valor entre mm, cm, pt e px. */
export function converterUnidade(valor, de = 'mm', para = 'mm') {
  if (!(de in UNIDADES) || !(para in UNIDADES)) throw new Error(`Unidade desconhecida: ${de} → ${para}`);
  return arred((Number(valor) || 0) * UNIDADES[de] / UNIDADES[para], 4);
}

// ───────────────────────────── Elementos ─────────────────────────────

/** Garante os campos de transformação em qualquer elemento (inclusive os legados). Idempotente. */
export function normalizarElemento(el) {
  if (!el) return el;
  el.x_mm = Number.isFinite(el.x_mm) ? el.x_mm : 0;
  el.y_mm = Number.isFinite(el.y_mm) ? el.y_mm : 0;
  el.largura_mm = Number.isFinite(el.largura_mm) ? el.largura_mm : 40;
  el.altura_mm = Number.isFinite(el.altura_mm) ? el.altura_mm : 20;
  el.rotacao_graus = normalizarAngulo(el.rotacao_graus || 0);
  el.bloqueado = !!el.bloqueado;
  el.visivel = el.visivel !== false;
  el.travar_proporcao = !!el.travar_proporcao;
  return el;
}

/** Cria um elemento livre (forma, texto, quadro de texto) já com transformação completa. */
export function criarElementoLivre(tipo, dados = {}) {
  const id = dados.id || 'elem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const base = normalizarElemento({
    id, tipo, posicionamento_modo: 'coordenadas', camada: dados.camada || 'frente',
    x_mm: dados.x_mm ?? 30, y_mm: dados.y_mm ?? 30,
    largura_mm: dados.largura_mm ?? 60, altura_mm: dados.altura_mm ?? 30,
    rotacao_graus: dados.rotacao_graus ?? 0, bloqueado: !!dados.bloqueado, titulo: dados.titulo
  });
  if (tipo === 'forma') {
    return { ...base, titulo: dados.titulo || 'Forma', forma: dados.forma || 'retangulo', fundo: dados.fundo ?? 'rgba(49,79,121,0.10)',
      borda_cor: dados.borda_cor || '#314F79', borda_mm: dados.borda_mm ?? 0.3, raio_mm: dados.raio_mm ?? 0, opacidade: dados.opacidade ?? 1 };
  }
  if (tipo === 'texto') {
    return { ...base, titulo: dados.titulo || 'Texto', texto: dados.texto ?? 'Texto — use {pagina}, {total}, {secao}, {data}',
      tamanho_pt: dados.tamanho_pt ?? 10, cor: dados.cor || '#314F79', negrito: !!dados.negrito,
      alinhamento: dados.alinhamento || 'esquerda', fonte: dados.fonte || '', opacidade: dados.opacidade ?? 1 };
  }
  if (tipo === 'quadro_texto') {
    return { ...base, titulo: dados.titulo || 'Quadro de texto principal', colunas: dados.colunas ?? 1, gap_mm: dados.gap_mm ?? 4.5 };
  }
  throw new Error(`Tipo de elemento livre desconhecido: ${tipo}`);
}

export function normalizarAngulo(g) {
  const n = ((Number(g) || 0) % 360 + 360) % 360;
  return arred(n, 2);
}

/** Trava o ângulo no múltiplo de 90° mais próximo (rotação com Shift). */
export function travarAngulo(g) {
  const a = normalizarAngulo(g);
  return ANGULOS_TRAVADOS.reduce((m, v) => (Math.min(Math.abs(a - v), 360 - Math.abs(a - v)) < Math.min(Math.abs(a - m), 360 - Math.abs(a - m)) ? v : m), 0) % 360;
}

/** Retângulo envolvente (eixos alinhados) do elemento, considerando a rotação. */
export function caixaEnvolvente(el) {
  const { x_mm: x, y_mm: y, largura_mm: w, altura_mm: h } = el;
  const r = ((el.rotacao_graus || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(r)); const s = Math.abs(Math.sin(r));
  const bw = w * c + h * s; const bh = w * s + h * c;
  const cx = x + w / 2; const cy = y + h / 2;
  return { x: arred(cx - bw / 2), y: arred(cy - bh / 2), w: arred(bw), h: arred(bh), cx: arred(cx), cy: arred(cy) };
}

/** Define a posição pelo ponto de ancoragem (matriz de 9 pontos) em vez do canto superior esquerdo. */
export function pontoDeAncora(el, ancora = 'nw') {
  const fx = ancora.includes('w') ? 0 : ancora.includes('e') ? 1 : 0.5;
  const fy = ancora.includes('n') ? 0 : ancora.includes('s') ? 1 : 0.5;
  return { x: arred(el.x_mm + el.largura_mm * fx), y: arred(el.y_mm + el.altura_mm * fy) };
}
export function posicionarPorAncora(el, ancora, x, y) {
  const fx = ancora.includes('w') ? 0 : ancora.includes('e') ? 1 : 0.5;
  const fy = ancora.includes('n') ? 0 : ancora.includes('s') ? 1 : 0.5;
  if (x !== undefined && x !== null) el.x_mm = arred(x - el.largura_mm * fx);
  if (y !== undefined && y !== null) el.y_mm = arred(y - el.altura_mm * fy);
  return el;
}

/** Origem das coordenadas mostradas no inspetor: relativas à folha ou à área das margens. */
export function paraReferencia(el, referencia, margens) {
  const dx = referencia === 'margem' ? (margens?.l || 0) : 0;
  const dy = referencia === 'margem' ? (margens?.t || 0) : 0;
  return { x: arred(el.x_mm - dx), y: arred(el.y_mm - dy) };
}
export function deReferencia(x, y, referencia, margens) {
  const dx = referencia === 'margem' ? (margens?.l || 0) : 0;
  const dy = referencia === 'margem' ? (margens?.t || 0) : 0;
  return { x: arred(x + dx), y: arred(y + dy) };
}

// ───────────────────────────── Redimensionar ─────────────────────────────

/**
 * Aplica o arraste de uma alça (em mm, no espaço da folha) sobre a geometria inicial `ini`.
 * Elementos rotacionados têm o deslocamento levado ao referencial local. Retorna a nova geometria.
 * Opções: proporcional (mantém a razão w/h), centro (Alt: redimensiona a partir do centro), minimo (mm).
 */
export function redimensionar(ini, alca, dx, dy, { proporcional = false, centro = false, minimo = 2 } = {}) {
  const r = -((ini.rotacao_graus || 0) * Math.PI) / 180;
  const lx = dx * Math.cos(r) - dy * Math.sin(r);
  const ly = dx * Math.sin(r) + dy * Math.cos(r);
  let w = ini.largura_mm; let h = ini.altura_mm; let x = ini.x_mm; let y = ini.y_mm;
  const razao = ini.largura_mm / (ini.altura_mm || 1);
  const f = centro ? 2 : 1;
  const mexeW = alca.includes('e') || alca.includes('w');
  const mexeH = alca.includes('n') || alca.includes('s');
  if (alca.includes('e')) w = ini.largura_mm + lx * f;
  if (alca.includes('w')) w = ini.largura_mm - lx * f;
  if (alca.includes('s')) h = ini.altura_mm + ly * f;
  if (alca.includes('n')) h = ini.altura_mm - ly * f;
  if (proporcional) {
    if (mexeW && mexeH) { if (Math.abs(w - ini.largura_mm) / ini.largura_mm >= Math.abs(h - ini.altura_mm) / ini.altura_mm) h = w / razao; else w = h * razao; }
    else if (mexeW) h = w / razao;
    else if (mexeH) w = h * razao;
  }
  w = Math.max(minimo, w); h = Math.max(minimo, h);
  // posição: mantém fixo o lado oposto (ou o centro) no referencial local, depois volta à folha
  const cxi = ini.x_mm + ini.largura_mm / 2; const cyi = ini.y_mm + ini.altura_mm / 2;
  let ox = 0; let oy = 0; // deslocamento do centro no referencial local
  if (!centro) {
    if (alca.includes('e')) ox = (w - ini.largura_mm) / 2; else if (alca.includes('w')) ox = -(w - ini.largura_mm) / 2;
    if (alca.includes('s')) oy = (h - ini.altura_mm) / 2; else if (alca.includes('n')) oy = -(h - ini.altura_mm) / 2;
    if (proporcional && !mexeH) oy = 0;
    if (proporcional && !mexeW) ox = 0;
  }
  const rr = ((ini.rotacao_graus || 0) * Math.PI) / 180;
  const cx = cxi + ox * Math.cos(rr) - oy * Math.sin(rr);
  const cy = cyi + ox * Math.sin(rr) + oy * Math.cos(rr);
  x = cx - w / 2; y = cy - h / 2;
  return { x_mm: arred(x), y_mm: arred(y), largura_mm: arred(w), altura_mm: arred(h) };
}

/** Ângulo (graus) para o ponteiro (px,py) em torno do centro do elemento; 0° = alça de rotação no topo. */
export function anguloPeloPonteiro(el, px, py, { travar = false } = {}) {
  const cx = el.x_mm + el.largura_mm / 2; const cy = el.y_mm + el.altura_mm / 2;
  const g = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
  return travar ? travarAngulo(g) : normalizarAngulo(g);
}

// ───────────────────────────── Snapping e guias ─────────────────────────────

/**
 * Alvos magnéticos: bordas da folha, centro da página, margens, guias de régua e bordas/centros
 * dos outros elementos. Retorna { v: number[], h: number[] } (linhas verticais x e horizontais y, em mm).
 */
export function alvosDeSnap({ larguraMm, alturaMm, margens, guias = [], elementos = [], ignorarId = null, grade = null }) {
  const v = [0, larguraMm / 2, larguraMm]; const h = [0, alturaMm / 2, alturaMm];
  if (grade && grade.snap) { const l = linhasDeGrade(grade, larguraMm, alturaMm, margens); v.push(...l.v); h.push(...l.h); }
  if (margens) { v.push(margens.l, larguraMm - margens.r); h.push(margens.t, alturaMm - margens.b); }
  guias.forEach(g => (g.eixo === 'v' ? v : h).push(g.pos_mm));
  elementos.forEach(e => {
    if (e.id === ignorarId || e.visivel === false) return;
    const b = caixaEnvolvente(e);
    v.push(b.x, b.cx, b.x + b.w); h.push(b.y, b.cy, b.y + b.h);
  });
  return { v: v.map(n => arred(n)), h: h.map(n => arred(n)) };
}

/**
 * Calcula o ajuste magnético para uma caixa (x,y,w,h). Compara borda esquerda/centro/direita com as
 * linhas verticais e topo/meio/base com as horizontais; usa o menor deslocamento dentro da tolerância.
 * Retorna { dx, dy, guias: [{eixo:'v'|'h', pos_mm}] } — as guias a desenhar.
 */
export function calcularSnap(caixa, alvos, toleranciaMm = 1.5) {
  const melhor = (candidatos, linhas) => {
    let best = null;
    for (const c of candidatos) for (const l of linhas) {
      const d = l - c;
      if (Math.abs(d) <= toleranciaMm && (best === null || Math.abs(d) < Math.abs(best.d))) best = { d, l };
    }
    return best;
  };
  const bv = melhor([caixa.x, caixa.x + caixa.w / 2, caixa.x + caixa.w], alvos.v);
  const bh = melhor([caixa.y, caixa.y + caixa.h / 2, caixa.y + caixa.h], alvos.h);
  const guias = [];
  if (bv) guias.push({ eixo: 'v', pos_mm: arred(bv.l) });
  if (bh) guias.push({ eixo: 'h', pos_mm: arred(bh.l) });
  return { dx: bv ? arred(bv.d) : 0, dy: bh ? arred(bh.d) : 0, guias };
}

/** Cria uma guia de régua; `eixo` 'v' (linha vertical, arrastada da régua lateral) ou 'h'. */
export function criarGuia(eixo, posMm) {
  return { id: 'guia_' + Math.random().toString(36).slice(2, 7), eixo: eixo === 'h' ? 'h' : 'v', pos_mm: arred(posMm) };
}

// ───────────────────────────── Alinhar e distribuir ─────────────────────────────

/**
 * Alinha elementos pelo envolvente. Com um só elemento, alinha à folha (ou à área das margens se `area` for
 * passada); com vários, alinha ao envolvente da seleção. modo: esquerda|centro|direita|topo|meio|base.
 */
export function alinharElementos(elementos, modo, area = null) {
  const alvo = elementos.filter(e => !e.bloqueado);
  if (!alvo.length) return elementos;
  const caixas = alvo.map(caixaEnvolvente);
  const ref = (alvo.length === 1 && area) ? area : {
    x: Math.min(...caixas.map(c => c.x)), y: Math.min(...caixas.map(c => c.y)),
    w: Math.max(...caixas.map(c => c.x + c.w)) - Math.min(...caixas.map(c => c.x)),
    h: Math.max(...caixas.map(c => c.y + c.h)) - Math.min(...caixas.map(c => c.y))
  };
  alvo.forEach((e, i) => {
    const c = caixas[i];
    if (modo === 'esquerda') e.x_mm = arred(e.x_mm + (ref.x - c.x));
    else if (modo === 'centro') e.x_mm = arred(e.x_mm + (ref.x + ref.w / 2 - c.cx));
    else if (modo === 'direita') e.x_mm = arred(e.x_mm + (ref.x + ref.w - (c.x + c.w)));
    else if (modo === 'topo') e.y_mm = arred(e.y_mm + (ref.y - c.y));
    else if (modo === 'meio') e.y_mm = arred(e.y_mm + (ref.y + ref.h / 2 - c.cy));
    else if (modo === 'base') e.y_mm = arred(e.y_mm + (ref.y + ref.h - (c.y + c.h)));
  });
  return elementos;
}

/** Distribui com espaçamento uniforme entre 3+ elementos (eixo 'h' = horizontal, 'v' = vertical). */
export function distribuirElementos(elementos, eixo = 'h') {
  const alvo = elementos.filter(e => !e.bloqueado);
  if (alvo.length < 3) return elementos;
  const h = eixo === 'h';
  const ord = alvo.map(e => ({ e, c: caixaEnvolvente(e) })).sort((a, b) => (h ? a.c.x - b.c.x : a.c.y - b.c.y));
  const ini = h ? ord[0].c.x : ord[0].c.y;
  const fim = h ? ord[ord.length - 1].c.x + ord[ord.length - 1].c.w : ord[ord.length - 1].c.y + ord[ord.length - 1].c.h;
  const soma = ord.reduce((t, o) => t + (h ? o.c.w : o.c.h), 0);
  const vao = (fim - ini - soma) / (ord.length - 1);
  let cursor = ini;
  ord.forEach(o => {
    const atual = h ? o.c.x : o.c.y;
    const delta = cursor - atual;
    if (h) o.e.x_mm = arred(o.e.x_mm + delta); else o.e.y_mm = arred(o.e.y_mm + delta);
    cursor += (h ? o.c.w : o.c.h) + vao;
  });
  return elementos;
}

// ───────────────────────────── Camadas ─────────────────────────────

/** Ordem de empilhamento (menor = atrás): camada 'fundo' abaixo da 'frente', depois o índice `z`. */
export function ordemDeEmpilhamento(lista) {
  return lista.map((e, i) => ({ e, i })).sort((a, b) => {
    const ca = a.e.camada === 'fundo' ? 0 : 1; const cb = b.e.camada === 'fundo' ? 0 : 1;
    return ca - cb || (a.e.z ?? a.i) - (b.e.z ?? b.i) || a.i - b.i;
  }).map(o => o.e);
}

/** acao: frente | tras | avancar | recuar — reordena dentro da mesma camada e regrava `z` sequencial. */
export function mudarOrdemZ(lista, id, acao) {
  const ord = ordemDeEmpilhamento(lista);
  const alvo = ord.find(e => e.id === id);
  if (!alvo) return lista;
  const mesma = ord.filter(e => (e.camada === 'fundo') === (alvo.camada === 'fundo'));
  const i = mesma.indexOf(alvo);
  mesma.splice(i, 1);
  const novo = acao === 'frente' ? mesma.length : acao === 'tras' ? 0 : acao === 'avancar' ? Math.min(mesma.length, i + 1) : Math.max(0, i - 1);
  mesma.splice(novo, 0, alvo);
  mesma.forEach((e, k) => { e.z = k; });
  return lista;
}

// ───────────────────────────── Variáveis dinâmicas ─────────────────────────────

/** Substitui {pagina}, {total}, {secao}, {data}, {documento.*} em textos de elementos da mestra. */
export function resolverVariaveisTexto(texto, ctx = {}) {
  const doc = ctx.documento || {};
  const mapa = {
    pagina: ctx.pagina, total: ctx.total, secao: ctx.secao, data: ctx.data || new Date().toLocaleDateString('pt-BR'),
    'documento.titulo': doc.titulo, 'documento.subtitulo': doc.subtitulo,
    'documento.autor_principal': doc.autor_principal ?? doc.autores?.[0]?.nome ?? doc.autor,
    'documento.instituicao': doc.instituicao, 'documento.ano': doc.ano
  };
  return String(texto ?? '').replace(/\{\{?\s*([a-z_.]+)\s*\}?\}/gi, (m, k) => (mapa[k] !== undefined && mapa[k] !== null ? String(mapa[k]) : m));
}

// ───────────────────────────── Atribuição de mestras por página ─────────────────────────────

/**
 * Regras declarativas: [{ mestraId, de, ate? }] (páginas 1-based; `ate` ausente = até o fim).
 * Vence a regra mais específica (menor intervalo); empate → a declarada por último.
 */
export function resolverMestraDaPagina(regras, numeroPagina) {
  if (!Array.isArray(regras)) return null;
  let melhor = null; let tam = Infinity;
  regras.forEach(r => {
    const de = Math.max(1, Math.floor(r.de) || 1);
    const ate = r.ate === undefined || r.ate === null || r.ate === '' ? Infinity : Math.floor(r.ate);
    if (numeroPagina < de || numeroPagina > ate) return;
    const t = ate - de;
    if (t <= tam) { tam = t; melhor = r; }
  });
  return melhor ? melhor.mestraId : null;
}

/** Valida e normaliza as regras (descarta inválidas, ordena por início). */
export function normalizarRegrasMestra(regras, idsMestras = null) {
  return (Array.isArray(regras) ? regras : [])
    .map(r => ({ mestraId: String(r.mestraId || ''), de: Math.max(1, Math.floor(r.de) || 1), ate: (r.ate === undefined || r.ate === null || r.ate === '') ? null : Math.max(1, Math.floor(r.ate)) }))
    .filter(r => r.mestraId && (!idsMestras || idsMestras.includes(r.mestraId)) && (r.ate === null || r.ate >= r.de))
    .sort((a, b) => a.de - b.de);
}

/** Aplica as regras ao final da repaginação: troca `mestraId`/`modeloId` das páginas cobertas. */
export function aplicarRegrasMestraNasPaginas(doc, paginas) {
  const regras = normalizarRegrasMestra(doc?.atribuicoes_mestra, (doc?.mestras || []).map(m => m.id));
  if (!regras.length) return paginas;
  paginas.forEach(p => {
    const id = resolverMestraDaPagina(regras, p.numero);
    if (id) { p.mestraId = id; p.modeloId = id; p.mestraAtribuida = true; }
  });
  return paginas;
}

// ───────────────────────────── Herança e overrides ─────────────────────────────

/**
 * Elementos efetivos de uma página: os da mestra (ordem de empilhamento) com o override aplicado.
 * `pagina.overrides_mestra[elementoId]` = { oculto?:bool, ...campos de geometria/estilo substituídos }.
 * Cada resultado ganha `herdado: true` e `sobrescrito: bool`.
 */
export function elementosEfetivosDaPagina(mestra, pagina) {
  const ov = pagina?.overrides_mestra || {};
  return ordemDeEmpilhamento(mestra?.elementos_recorrentes || []).map(e => {
    const o = ov[e.id];
    if (o?.oculto) return null;
    return { ...e, ...(o || {}), id: e.id, herdado: true, sobrescrito: !!o };
  }).filter(Boolean);
}

/** Destrava um elemento herdado nesta página (Shift+Ctrl+clique): cria o override sem tocar na mestra. */
export function sobrescreverElemento(pagina, elemento, mudancas = {}) {
  pagina.overrides_mestra = pagina.overrides_mestra || {};
  const { x_mm, y_mm, largura_mm, altura_mm, rotacao_graus } = elemento;
  pagina.overrides_mestra[elemento.id] = { x_mm, y_mm, largura_mm, altura_mm, rotacao_graus, ...(pagina.overrides_mestra[elemento.id] || {}), ...mudancas };
  return pagina.overrides_mestra[elemento.id];
}
export function restaurarElemento(pagina, elementoId) {
  if (pagina?.overrides_mestra) delete pagina.overrides_mestra[elementoId];
  return pagina;
}

// ───────────────────────────── Quadro de texto principal ─────────────────────────────

/** Elemento 'quadro_texto' designado como fluxo primário da mestra (ou o primeiro existente). */
export function quadroTextoPrimario(mestra) {
  const els = mestra?.elementos_recorrentes || [];
  return els.find(e => e.id === mestra?.quadro_texto_id && e.tipo === 'quadro_texto') || els.find(e => e.tipo === 'quadro_texto') || null;
}

/** Margens {t,r,b,l} efetivas: as da mestra ou, havendo quadro de texto, as implícitas pelo retângulo dele. */
export function margensEfetivasMm(mestra, larguraMm, alturaMm) {
  const base = mestra?.margens_mm || mestra?.margens || { t: 30, r: 20, b: 20, l: 30 };
  const q = quadroTextoPrimario(mestra);
  if (!q || !larguraMm || !alturaMm) return { t: base.t, r: base.r, b: base.b, l: base.l };
  return {
    t: Math.max(0, arred(q.y_mm)), l: Math.max(0, arred(q.x_mm)),
    r: Math.max(0, arred(larguraMm - q.x_mm - q.largura_mm)), b: Math.max(0, arred(alturaMm - q.y_mm - q.altura_mm))
  };
}

// ───────────────────────────── Validação ─────────────────────────────

/** Corrige a lista de elementos de uma mestra (ids únicos, transformação completa, quadro válido). */
export function normalizarMestraCanvas(mestra) {
  if (!mestra) return mestra;
  mestra.elementos_recorrentes = Array.isArray(mestra.elementos_recorrentes) ? mestra.elementos_recorrentes : [];
  const vistos = new Set();
  mestra.elementos_recorrentes.forEach(e => {
    if (!e.id || vistos.has(e.id)) e.id = 'elem_' + Math.random().toString(36).slice(2, 8);
    vistos.add(e.id);
    normalizarElemento(e);
  });
  if (mestra.quadro_texto_id && !mestra.elementos_recorrentes.some(e => e.id === mestra.quadro_texto_id && e.tipo === 'quadro_texto')) delete mestra.quadro_texto_id;
  mestra.guias = (Array.isArray(mestra.guias) ? mestra.guias : []).filter(g => g && (g.eixo === 'v' || g.eixo === 'h') && Number.isFinite(g.pos_mm));
  if (mestra.espelhada !== undefined) mestra.espelhada = !!mestra.espelhada;
  if (mestra.grade_guia) mestra.grade_guia = normalizarGradeGuia(mestra.grade_guia);
  return mestra;
}

// ───────────────────────────── Páginas espelhadas (facing pages) ─────────────────────────────

/** Verso (página par) de uma mestra espelhada: reflete o elemento no eixo vertical da folha. */
export function espelharElemento(el, larguraMm) {
  return { ...el, x_mm: arred(larguraMm - el.x_mm - el.largura_mm), rotacao_graus: normalizarAngulo(-(el.rotacao_graus || 0)) };
}

// ───────────────────────────── Overrides persistentes no documento ─────────────────────────────

/** Chave estável de uma página entre repaginações (o `id` da página muda a cada cálculo). */
export const chaveOverridePagina = (pag) => `${pag?.secaoId}:${pag?.numeroNaSecao}`;

/** Reanexa os overrides guardados em `doc.overrides_mestra` às páginas recém-calculadas. */
export function vincularOverridesAsPaginas(doc, paginas) {
  const todos = doc?.overrides_mestra;
  if (!todos) return paginas;
  paginas.forEach(p => { const o = todos[chaveOverridePagina(p)]; if (o && Object.keys(o).length) p.overrides_mestra = o; });
  return paginas;
}

/** Cria/atualiza o override de um elemento herdado e o grava no documento (sobrevive à repaginação). */
export function sobrescreverNoDocumento(doc, pag, elemento, mudancas = {}) {
  doc.overrides_mestra = doc.overrides_mestra || {};
  const chave = chaveOverridePagina(pag);
  doc.overrides_mestra[chave] = doc.overrides_mestra[chave] || {};
  pag.overrides_mestra = doc.overrides_mestra[chave];
  return sobrescreverElemento(pag, elemento, mudancas);
}
export function restaurarNoDocumento(doc, pag, elementoId) {
  restaurarElemento(pag, elementoId);
  const o = doc.overrides_mestra?.[chaveOverridePagina(pag)];
  if (o) { delete o[elementoId]; if (!Object.keys(o).length) delete doc.overrides_mestra[chaveOverridePagina(pag)]; }
  return pag;
}

// ───────────────────────────── Grade guia da folha ─────────────────────────────

/** Grade guia da mestra: malha regular (`passo_mm`) e/ou colunas × linhas dentro das margens, com calha. */
export function normalizarGradeGuia(g) {
  const n = (v, d, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Number(v) : d));
  return {
    visivel: !!g?.visivel, snap: g?.snap !== false,
    passo_mm: n(g?.passo_mm, 10, 0, 100), colunas: Math.round(n(g?.colunas, 0, 0, 24)), linhas: Math.round(n(g?.linhas, 0, 0, 24)), calha_mm: n(g?.calha_mm, 4, 0, 30)
  };
}

/** Linhas da grade (em mm): malha regular e bordas das colunas/linhas de layout. */
export function linhasDeGrade(grade, larguraMm, alturaMm, margens = { t: 0, r: 0, b: 0, l: 0 }) {
  const g = normalizarGradeGuia(grade);
  const v = []; const h = [];
  if (g.passo_mm >= 1) {
    for (let x = g.passo_mm; x < larguraMm; x += g.passo_mm) v.push(arred(x));
    for (let y = g.passo_mm; y < alturaMm; y += g.passo_mm) h.push(arred(y));
  }
  const divide = (ini, tam, n, calha, saida) => {
    if (n < 1) return;
    const col = (tam - calha * (n - 1)) / n;
    for (let i = 0; i < n; i++) { const a = ini + i * (col + calha); saida.push(arred(a), arred(a + col)); }
  };
  divide(margens.l || 0, larguraMm - (margens.l || 0) - (margens.r || 0), g.colunas, g.calha_mm, v);
  divide(margens.t || 0, alturaMm - (margens.t || 0) - (margens.b || 0), g.linhas, g.calha_mm, h);
  return { v: [...new Set(v)].sort((a, b) => a - b), h: [...new Set(h)].sort((a, b) => a - b) };
}
