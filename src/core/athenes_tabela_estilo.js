// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estilo declarativo de Tabelas e Quadros (bordas, sombreamento, zebra, alinhamento)
 *
 * Módulo puro (sem DOM): o mesmo resolvedor alimenta o editor, a exportação PDF e a DOCX,
 * e o schema é serializado em `bloco.estilo_tabela` e no pacote de estilo `athenes-tema-v1`.
 *
 * Linhas são indexadas de forma unificada: se `com_cabecalho !== false`, a linha 0 é o cabeçalho
 * e as linhas de dados começam em 1. A última linha é o rodapé quando `rodape.ativo`.
 *
 * Modelo de camadas (menor → maior precedência) para fundo e alinhamento:
 *   zebra < tabela < colunas < linhas < celulas   (+ cabeçalho/rodapé/coluna-chave entre zebra e tabela)
 * Bordas: globais (externas/internas) < cabeçalho/rodapé/coluna-chave < `bordas_celulas` (por aresta).
 */

export const ESTILOS_LINHA = ['solida', 'tracejada', 'pontilhada', 'dupla'];
export const ALINHAMENTOS_H = ['esquerda', 'centro', 'direita', 'justificado'];
export const ALINHAMENTOS_V = ['topo', 'centro', 'base'];
export const PADDINGS_CELULA = { compacto: 2, normal: 4, expandido: 8 }; // pt
export const PRESETS_BORDA = [
  'todas', 'externas', 'internas', 'horizontais_internas', 'verticais_internas',
  'topo', 'base', 'esquerda', 'direita', 'nenhuma'
];

const COR_TEXTO_PADRAO = '#1F2733';
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function corValida(cor, padrao = null) {
  return typeof cor === 'string' && HEX.test(cor.trim()) ? cor.trim().toUpperCase() : padrao;
}

/** Normaliza uma borda: objeto {largura_pt, estilo, cor} ou null (= sem borda). */
export function normalizarBorda(b) {
  if (!b || typeof b !== 'object') return null;
  const largura = Number(b.largura_pt);
  if (!(largura > 0)) return null;
  return {
    largura_pt: Math.min(6, Math.round(largura * 100) / 100),
    estilo: ESTILOS_LINHA.includes(b.estilo) ? b.estilo : 'solida',
    cor: corValida(b.cor, COR_TEXTO_PADRAO)
  };
}

const borda = (largura_pt, cor = COR_TEXTO_PADRAO, estilo = 'solida') => ({ largura_pt, estilo, cor });

/** Estilo padrão por tipo: reproduz o visual legado (tabela ABNT/IBGE aberta; quadro fechado). */
export function estiloTabelaPadrao(tipo = 'tabela') {
  if (tipo === 'quadro') {
    return {
      versao: 1,
      bordas: {
        externas: { t: borda(1.1), r: borda(1.1), b: borda(1.1), l: borda(1.1) },
        internas: { h: borda(0.75), v: borda(0.75) }
      },
      cabecalho: { ativo: true, fundo: '#F8FAFC', cor_texto: null, negrito: true, borda_superior: undefined, borda_inferior: undefined },
      rodape: { ativo: false, fundo: null, negrito: false, borda_superior: undefined, borda_inferior: undefined },
      coluna_cabecalho: { ativo: false, fundo: '#F1F5F9', negrito: true, borda_direita: undefined },
      zebra: { ativo: false, cor_impar: '#FFFFFF', cor_par: '#F1F5F9' },
      padding: 'normal',
      quebra: 'normal',
      camadas: { tabela: { h: 'esquerda', v: 'topo' }, linhas: {}, colunas: {}, celulas: {} },
      bordas_celulas: {}
    };
  }
  return {
    versao: 1,
    bordas: {
      externas: { t: borda(1.1), r: null, b: borda(1.1), l: null },
      internas: { h: borda(0.75, '#E2E8F0'), v: null }
    },
    cabecalho: { ativo: true, fundo: null, cor_texto: null, negrito: true, borda_superior: undefined, borda_inferior: borda(1.1) },
    rodape: { ativo: false, fundo: null, negrito: false, borda_superior: undefined, borda_inferior: undefined },
    coluna_cabecalho: { ativo: false, fundo: '#F1F5F9', negrito: true, borda_direita: undefined },
    zebra: { ativo: false, cor_impar: '#FFFFFF', cor_par: '#F1F5F9' },
    padding: 'normal',
    quebra: 'normal',
    camadas: { tabela: { h: 'esquerda', v: 'topo' }, linhas: {}, colunas: {}, celulas: {} },
    bordas_celulas: {}
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? '__u' : v)), (k, v) => (v === '__u' ? undefined : v));

function sanitizarBordaOpcional(b) {
  // undefined = herdar; null = sem borda; objeto = borda explícita
  if (b === undefined) return undefined;
  return normalizarBorda(b);
}

function sanitizarCamada(c) {
  const o = {};
  if (!c || typeof c !== 'object') return o;
  const f = corValida(c.fundo);
  if (f) o.fundo = f;
  if (ALINHAMENTOS_H.includes(c.h)) o.h = c.h;
  if (ALINHAMENTOS_V.includes(c.v)) o.v = c.v;
  return o;
}

function sanitizarMapaCamadas(m, chaveValida) {
  const out = {};
  if (!m || typeof m !== 'object') return out;
  for (const [k, v] of Object.entries(m)) {
    if (!chaveValida(k)) continue;
    const c = sanitizarCamada(v);
    if (Object.keys(c).length) out[k] = c;
  }
  return out;
}

/**
 * Sanitiza e completa um estilo vindo de JSON externo (pacote de tema, IA, documento antigo).
 * Nunca lança; valores inválidos caem no padrão do tipo.
 */
export function sanitizarEstiloTabela(entrada, tipo = 'tabela') {
  const base = estiloTabelaPadrao(tipo);
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const out = clone(base);

  if (e.bordas && typeof e.bordas === 'object') {
    for (const lado of ['t', 'r', 'b', 'l']) {
      if (e.bordas.externas && lado in e.bordas.externas) out.bordas.externas[lado] = normalizarBorda(e.bordas.externas[lado]);
    }
    for (const eixo of ['h', 'v']) {
      if (e.bordas.internas && eixo in e.bordas.internas) out.bordas.internas[eixo] = normalizarBorda(e.bordas.internas[eixo]);
    }
  }

  if (e.cabecalho && typeof e.cabecalho === 'object') {
    const c = e.cabecalho;
    if (typeof c.ativo === 'boolean') out.cabecalho.ativo = c.ativo;
    if ('fundo' in c) out.cabecalho.fundo = corValida(c.fundo);
    if ('cor_texto' in c) out.cabecalho.cor_texto = corValida(c.cor_texto);
    if (typeof c.negrito === 'boolean') out.cabecalho.negrito = c.negrito;
    if ('borda_superior' in c) out.cabecalho.borda_superior = sanitizarBordaOpcional(c.borda_superior);
    if ('borda_inferior' in c) out.cabecalho.borda_inferior = sanitizarBordaOpcional(c.borda_inferior);
  }
  if (e.rodape && typeof e.rodape === 'object') {
    const r = e.rodape;
    if (typeof r.ativo === 'boolean') out.rodape.ativo = r.ativo;
    if ('fundo' in r) out.rodape.fundo = corValida(r.fundo);
    if (typeof r.negrito === 'boolean') out.rodape.negrito = r.negrito;
    if ('borda_superior' in r) out.rodape.borda_superior = sanitizarBordaOpcional(r.borda_superior);
    if ('borda_inferior' in r) out.rodape.borda_inferior = sanitizarBordaOpcional(r.borda_inferior);
  }
  if (e.coluna_cabecalho && typeof e.coluna_cabecalho === 'object') {
    const cc = e.coluna_cabecalho;
    if (typeof cc.ativo === 'boolean') out.coluna_cabecalho.ativo = cc.ativo;
    if ('fundo' in cc) out.coluna_cabecalho.fundo = corValida(cc.fundo);
    if (typeof cc.negrito === 'boolean') out.coluna_cabecalho.negrito = cc.negrito;
    if ('borda_direita' in cc) out.coluna_cabecalho.borda_direita = sanitizarBordaOpcional(cc.borda_direita);
  }
  if (e.zebra && typeof e.zebra === 'object') {
    if (typeof e.zebra.ativo === 'boolean') out.zebra.ativo = e.zebra.ativo;
    out.zebra.cor_impar = corValida(e.zebra.cor_impar, out.zebra.cor_impar);
    out.zebra.cor_par = corValida(e.zebra.cor_par, out.zebra.cor_par);
  }
  if (e.padding in PADDINGS_CELULA) out.padding = e.padding;
  if (e.quebra === 'normal' || e.quebra === 'forcada') out.quebra = e.quebra;

  if (e.camadas && typeof e.camadas === 'object') {
    out.camadas.tabela = { ...out.camadas.tabela, ...sanitizarCamada(e.camadas.tabela) };
    out.camadas.linhas = sanitizarMapaCamadas(e.camadas.linhas, k => /^\d+$/.test(k));
    out.camadas.colunas = sanitizarMapaCamadas(e.camadas.colunas, k => /^\d+$/.test(k));
    out.camadas.celulas = sanitizarMapaCamadas(e.camadas.celulas, k => /^\d+:\d+$/.test(k));
  }
  if (e.bordas_celulas && typeof e.bordas_celulas === 'object') {
    for (const [k, v] of Object.entries(e.bordas_celulas)) {
      if (!/^\d+:\d+$/.test(k) || !v || typeof v !== 'object') continue;
      const arestas = {};
      for (const l of ['t', 'r', 'b', 'l']) if (l in v) arestas[l] = normalizarBorda(v[l]);
      if (Object.keys(arestas).length) out.bordas_celulas[k] = arestas;
    }
  }
  return out;
}

/** Leitura sem efeitos colaterais: estilo efetivo do bloco (padrão do tipo se ausente). */
export function obterEstiloTabela(bloco) {
  return sanitizarEstiloTabela(bloco?.estilo_tabela, bloco?.tipo === 'quadro' ? 'quadro' : 'tabela');
}

/** Garante `bloco.estilo_tabela` completo e devolve a referência para edição. */
export function garantirEstiloTabela(bloco) {
  if (!bloco.estilo_tabela || bloco.estilo_tabela.versao !== 1) {
    bloco.estilo_tabela = obterEstiloTabela(bloco);
  }
  const e = bloco.estilo_tabela;
  e.camadas ||= { tabela: {}, linhas: {}, colunas: {}, celulas: {} };
  e.camadas.tabela ||= {}; e.camadas.linhas ||= {}; e.camadas.colunas ||= {}; e.camadas.celulas ||= {};
  e.bordas_celulas ||= {};
  return e;
}

/** Subconjunto global (portável) do estilo: sem overrides por célula/linha/coluna. */
export function extrairEstiloGlobalTabela(bloco) {
  const e = obterEstiloTabela(bloco);
  e.camadas = { tabela: e.camadas.tabela, linhas: {}, colunas: {}, celulas: {} };
  e.bordas_celulas = {};
  return e;
}

/** Dimensões lógicas (linhas totais incluindo cabeçalho, colunas). */
export function dimensoesTabela(bloco) {
  const nCols = Math.max(bloco?.colunas?.length || 0, ...(bloco?.linhas || []).map(l => (Array.isArray(l) ? l.length : 0)), 1);
  const temCab = bloco?.com_cabecalho !== false;
  const nLinhas = (bloco?.linhas?.length || 0) + (temCab ? 1 : 0);
  return { nLinhas: Math.max(nLinhas, 1), nCols, temCab };
}

// ───────────────────────────── Resolução por célula ─────────────────────────────

/**
 * Resolve o estilo final de uma célula (r, c).
 * @returns {{fundo:string|null, h:string, v:string, bordas:{t,r,b,l}, padding_pt:number,
 *            negrito:boolean, cor_texto:string|null, tipo:'cabecalho'|'rodape'|'dados'}}
 */
export function resolverCelula(estilo, dim, r, c) {
  const { nLinhas, nCols, temCab } = dim;
  const ehCab = temCab && r === 0 && estilo.cabecalho.ativo;
  const ehRod = estilo.rodape.ativo && r === nLinhas - 1 && !(temCab && r === 0);
  const ehColChave = estilo.coluna_cabecalho.ativo && c === 0 && !ehCab;

  // Fundo
  let fundo = null;
  if (estilo.zebra.ativo && !ehCab && !ehRod) {
    const idxDados = r - (temCab ? 1 : 0); // 0-based entre as linhas de dados
    fundo = idxDados % 2 === 0 ? estilo.zebra.cor_impar : estilo.zebra.cor_par;
  }
  if (ehCab && estilo.cabecalho.fundo) fundo = estilo.cabecalho.fundo;
  if (ehRod && estilo.rodape.fundo) fundo = estilo.rodape.fundo;
  if (ehColChave && estilo.coluna_cabecalho.fundo) fundo = estilo.coluna_cabecalho.fundo;

  const cam = estilo.camadas;
  let h = 'esquerda';
  let v = 'topo';
  const camadasOrdem = [cam.tabela, cam.colunas[c], cam.linhas[r], cam.celulas[`${r}:${c}`]];
  for (const l of camadasOrdem) {
    if (!l) continue;
    if (l.fundo) fundo = l.fundo;
    if (l.h) h = l.h;
    if (l.v) v = l.v;
  }

  // Bordas: uma aresta é "compartilhada" com a célula vizinha; resolvemos sempre pelo mesmo critério
  // dos dois lados para que o modelo de bordas colapsadas seja consistente.
  const bordas = {
    t: resolverArestaH(estilo, dim, r, c),       // aresta superior da linha r
    b: resolverArestaH(estilo, dim, r + 1, c),   // aresta superior da linha r+1 = inferior de r
    l: resolverArestaV(estilo, dim, r, c),
    r: resolverArestaV(estilo, dim, r, c + 1)
  };

  return {
    fundo,
    h, v,
    bordas,
    padding_pt: PADDINGS_CELULA[estilo.padding] ?? 4,
    negrito: ehCab ? !!estilo.cabecalho.negrito : ehRod ? !!estilo.rodape.negrito : ehColChave ? !!estilo.coluna_cabecalho.negrito : false,
    cor_texto: ehCab ? estilo.cabecalho.cor_texto || null : null,
    tipo: ehCab ? 'cabecalho' : ehRod ? 'rodape' : 'dados'
  };
}

/** Aresta horizontal acima da linha `linha` (0 = topo da tabela, nLinhas = base), na coluna `c`. */
function resolverArestaH(estilo, dim, linha, c) {
  const { nLinhas, temCab } = dim;
  const acima = linha - 1;
  const abaixo = linha;
  // 1) Override por célula (aceita definição de qualquer um dos lados)
  const ovAbaixo = estilo.bordas_celulas[`${abaixo}:${c}`];
  if (ovAbaixo && 't' in ovAbaixo) return ovAbaixo.t;
  const ovAcima = estilo.bordas_celulas[`${acima}:${c}`];
  if (ovAcima && 'b' in ovAcima) return ovAcima.b;

  // 2) Cabeçalho / rodapé (independentes das células comuns)
  if (temCab && estilo.cabecalho.ativo) {
    if (linha === 0 && estilo.cabecalho.borda_superior !== undefined) return estilo.cabecalho.borda_superior;
    if (linha === 1 && estilo.cabecalho.borda_inferior !== undefined) return estilo.cabecalho.borda_inferior;
  }
  if (estilo.rodape.ativo) {
    if (linha === nLinhas - 1 && estilo.rodape.borda_superior !== undefined) return estilo.rodape.borda_superior;
    if (linha === nLinhas && estilo.rodape.borda_inferior !== undefined) return estilo.rodape.borda_inferior;
  }

  // 3) Globais
  if (linha === 0) return estilo.bordas.externas.t;
  if (linha === nLinhas) return estilo.bordas.externas.b;
  return estilo.bordas.internas.h;
}

/** Aresta vertical à esquerda da coluna `coluna` na linha `r`. */
function resolverArestaV(estilo, dim, r, coluna) {
  const { nCols } = dim;
  const esq = coluna - 1;
  const dir = coluna;
  const ovDir = estilo.bordas_celulas[`${r}:${dir}`];
  if (ovDir && 'l' in ovDir) return ovDir.l;
  const ovEsq = estilo.bordas_celulas[`${r}:${esq}`];
  if (ovEsq && 'r' in ovEsq) return ovEsq.r;

  if (estilo.coluna_cabecalho.ativo && coluna === 1 && estilo.coluna_cabecalho.borda_direita !== undefined) {
    return estilo.coluna_cabecalho.borda_direita;
  }
  if (coluna === 0) return estilo.bordas.externas.l;
  if (coluna === nCols) return estilo.bordas.externas.r;
  return estilo.bordas.internas.v;
}

// ───────────────────────────── Edição (seleção → estilo) ─────────────────────────────

/** Retângulo normalizado {r0,c0,r1,c1} (inclusivo). */
export function retanguloSelecao(a, b) {
  return {
    r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c),
    r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c)
  };
}

function cobreTudo(rect, dim) {
  return rect.r0 === 0 && rect.c0 === 0 && rect.r1 === dim.nLinhas - 1 && rect.c1 === dim.nCols - 1;
}

function setArestaCelula(e, r, c, lado, valor) {
  const k = `${r}:${c}`;
  (e.bordas_celulas[k] ||= {})[lado] = valor;
}

/**
 * Aplica um preset de contorno (como no Word) a uma seleção.
 * Seleção cobrindo a tabela inteira grava nos campos globais (compacto para tabelas grandes).
 * @param {object} bloco
 * @param {string} preset  um de PRESETS_BORDA
 * @param {{r0,c0,r1,c1}|null} rect  null = tabela inteira
 * @param {{largura_pt,estilo,cor}} pincel
 */
export function aplicarPresetBorda(bloco, preset, rect, pincel) {
  if (!PRESETS_BORDA.includes(preset)) throw new Error(`Preset de borda inválido: ${preset}`);
  const e = garantirEstiloTabela(bloco);
  const dim = dimensoesTabela(bloco);
  const traco = preset === 'nenhuma' ? null : normalizarBorda(pincel) || borda(0.75);
  const alvo = rect && !cobreTudo(rect, dim) ? rect : null;

  if (!alvo) {
    const ex = e.bordas.externas;
    const it = e.bordas.internas;
    const ext = ['todas', 'externas', 'nenhuma'].includes(preset);
    const int = ['todas', 'internas', 'nenhuma'].includes(preset);
    if (preset === 'nenhuma') {
      e.bordas = { externas: { t: null, r: null, b: null, l: null }, internas: { h: null, v: null } };
      e.cabecalho.borda_superior = e.cabecalho.borda_inferior = undefined;
      e.rodape.borda_superior = e.rodape.borda_inferior = undefined;
      e.coluna_cabecalho.borda_direita = undefined;
      e.cabecalho.borda_inferior = null;
    } else {
      if (ext) ex.t = ex.r = ex.b = ex.l = traco;
      if (int || preset === 'horizontais_internas') it.h = traco;
      if (int || preset === 'verticais_internas') it.v = traco;
      if (preset === 'topo') ex.t = traco;
      if (preset === 'base') ex.b = traco;
      if (preset === 'esquerda') ex.l = traco;
      if (preset === 'direita') ex.r = traco;
      // Preset explícito sobrepõe os destaques derivados do cabeçalho/rodapé nas arestas atingidas
      if (['todas', 'internas', 'horizontais_internas'].includes(preset)) {
        e.cabecalho.borda_inferior = undefined;
        e.rodape.borda_superior = undefined;
      }
      if (['todas', 'externas', 'topo'].includes(preset)) e.cabecalho.borda_superior = undefined;
      if (['todas', 'externas', 'base'].includes(preset)) e.rodape.borda_inferior = undefined;
      if (['todas', 'internas', 'verticais_internas'].includes(preset)) e.coluna_cabecalho.borda_direita = undefined;
    }
    e.bordas_celulas = {};
    return e;
  }

  // Seleção parcial: grava por aresta (célula a célula; ambos os lados da mesma aresta)
  const { r0, c0, r1, c1 } = alvo;
  const limpa = preset === 'nenhuma';
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const topo = r === r0, base = r === r1, esq = c === c0, dir = c === c1;
      const set = (lado, v) => setArestaCelula(e, r, c, lado, v);
      if (limpa || preset === 'todas') { set('t', traco); set('b', traco); set('l', traco); set('r', traco); continue; }
      if (preset === 'externas') {
        if (topo) set('t', traco); if (base) set('b', traco); if (esq) set('l', traco); if (dir) set('r', traco);
      } else if (preset === 'internas') {
        if (!topo) set('t', traco); if (!base) set('b', traco); if (!esq) set('l', traco); if (!dir) set('r', traco);
      } else if (preset === 'horizontais_internas') {
        if (!topo) set('t', traco); if (!base) set('b', traco);
      } else if (preset === 'verticais_internas') {
        if (!esq) set('l', traco); if (!dir) set('r', traco);
      } else if (preset === 'topo' && topo) set('t', traco);
      else if (preset === 'base' && base) set('b', traco);
      else if (preset === 'esquerda' && esq) set('l', traco);
      else if (preset === 'direita' && dir) set('r', traco);
    }
  }
  // Espelha nas células vizinhas para manter a aresta compartilhada coerente
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const ov = e.bordas_celulas[`${r}:${c}`];
    if (!ov) continue;
    if ('t' in ov && r > 0) setArestaCelula(e, r - 1, c, 'b', ov.t);
    if ('b' in ov && r < dim.nLinhas - 1) setArestaCelula(e, r + 1, c, 't', ov.b);
    if ('l' in ov && c > 0) setArestaCelula(e, r, c - 1, 'r', ov.l);
    if ('r' in ov && c < dim.nCols - 1) setArestaCelula(e, r, c + 1, 'l', ov.r);
  }
  return e;
}

/**
 * Aplica propriedades de camada (fundo, h, v) a uma seleção, escolhendo a camada mais compacta:
 * tabela inteira → `tabela`; linhas completas → `linhas`; colunas completas → `colunas`; senão `celulas`.
 * Passar `null` em uma propriedade a remove.
 */
export function aplicarCamadaSelecao(bloco, rect, props) {
  const e = garantirEstiloTabela(bloco);
  const dim = dimensoesTabela(bloco);
  const limpo = sanitizarCamada(props);
  const remover = Object.keys(props).filter(k => props[k] === null);
  const gravar = (mapa, chave) => {
    const atual = { ...(mapa[chave] || {}), ...limpo };
    for (const k of remover) delete atual[k];
    if (Object.keys(atual).length) mapa[chave] = atual; else delete mapa[chave];
  };

  if (!rect || cobreTudo(rect, dim)) {
    const atual = { ...e.camadas.tabela, ...limpo };
    for (const k of remover) delete atual[k];
    e.camadas.tabela = atual;
    // seleção total sobrepõe qualquer override mais específico das mesmas propriedades
    const props2 = [...Object.keys(limpo), ...remover];
    for (const mapa of [e.camadas.linhas, e.camadas.colunas, e.camadas.celulas]) {
      for (const k of Object.keys(mapa)) {
        for (const p of props2) delete mapa[k][p];
        if (!Object.keys(mapa[k]).length) delete mapa[k];
      }
    }
    return e;
  }
  const linhasInteiras = rect.c0 === 0 && rect.c1 === dim.nCols - 1;
  const colunasInteiras = rect.r0 === 0 && rect.r1 === dim.nLinhas - 1;
  if (linhasInteiras) {
    for (let r = rect.r0; r <= rect.r1; r++) gravar(e.camadas.linhas, String(r));
  } else if (colunasInteiras) {
    for (let c = rect.c0; c <= rect.c1; c++) gravar(e.camadas.colunas, String(c));
  } else {
    for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) gravar(e.camadas.celulas, `${r}:${c}`);
  }
  return e;
}

// ───────────────────────────── Adaptadores de saída ─────────────────────────────

const CSS_ESTILO = { solida: 'solid', tracejada: 'dashed', pontilhada: 'dotted', dupla: 'double' };
const CSS_H = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'justify' };
const CSS_V = { topo: 'top', centro: 'middle', base: 'bottom' };

export function bordaParaCss(b) {
  if (!b) return 'none';
  // `double` precisa de >= 3px para ser visível; garante legibilidade
  const pt = b.estilo === 'dupla' ? Math.max(b.largura_pt, 2.25) : b.largura_pt;
  return `${pt}pt ${CSS_ESTILO[b.estilo] || 'solid'} ${b.cor}`;
}

/** Declarações CSS (string) de uma célula resolvida — usadas pelo editor e pelo PDF. */
export function celulaParaCss(res, estilo) {
  const decl = [
    `text-align:${CSS_H[res.h]}`,
    `vertical-align:${CSS_V[res.v]}`,
    `padding:${res.padding_pt}pt ${res.padding_pt * 2}pt`,
    `border-top:${bordaParaCss(res.bordas.t)}`,
    `border-bottom:${bordaParaCss(res.bordas.b)}`,
    `border-left:${bordaParaCss(res.bordas.l)}`,
    `border-right:${bordaParaCss(res.bordas.r)}`
  ];
  if (res.fundo) decl.push(`background-color:${res.fundo}`);
  if (res.negrito) decl.push('font-weight:800');
  if (res.cor_texto) decl.push(`color:${res.cor_texto}`);
  if (estilo.quebra === 'forcada') decl.push('overflow-wrap:anywhere', 'word-break:break-word');
  else decl.push('overflow-wrap:break-word');
  return decl.join(';');
}

/** Atributo de layout da tabela: colunas proporcionais e quebra de linha sem deformar. */
export function tabelaParaCss(tamanhoFonte = '12px') {
  return `width:100%;border-collapse:collapse;table-layout:fixed;font-size:${tamanhoFonte};margin:6px 0`;
}

/** Propriedades OOXML de uma aresta ({w:sz em 1/8 pt}). */
export function bordaParaDocx(b) {
  if (!b) return { val: 'nil', sz: 0, cor: 'auto' };
  const val = { solida: 'single', tracejada: 'dashed', pontilhada: 'dotted', dupla: 'double' }[b.estilo] || 'single';
  return { val, sz: Math.max(2, Math.min(96, Math.round(b.largura_pt * 8))), cor: b.cor.replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6) };
}

export function celulaParaDocx(res) {
  const arestas = (lado, nome) => {
    const o = bordaParaDocx(res.bordas[lado]);
    return `<w:${nome} w:val="${o.val}" w:sz="${o.sz}" w:space="0" w:color="${o.cor}"/>`;
  };
  const xml = `<w:tcBorders>${arestas('t', 'top')}${arestas('l', 'left')}${arestas('b', 'bottom')}${arestas('r', 'right')}</w:tcBorders>`;
  const shd = res.fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${res.fundo.replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6)}"/>` : '';
  const valign = `<w:vAlign w:val="${{ topo: 'top', centro: 'center', base: 'bottom' }[res.v]}"/>`;
  const jc = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'both' }[res.h];
  return { tcPr: `<w:tcPr>${xml}${shd}${valign}</w:tcPr>`, jc };
}
