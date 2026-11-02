// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Seções em N níveis, numeração decimal progressiva e motor de sumário (TOC).
 * Módulo puro (sem DOM), compartilhado pelo editor, pela exportação PDF e pela DOCX.
 *
 * Schema do sumário (bloco `sumario`, ou `doc.sumario_config_padrao` como padrão do documento):
 *   { profundidade_max, titulo:{texto,alinhamento}, preenchimento:{tipo,cor,espessura_pt,densidade},
 *     niveis:{ [n]: { mostrar_pagina, recuo_mm, transformacao,
 *                     fonte:{ familia, tamanho_pt, negrito, italico, sublinhado, cor, cor_numero, cor_pagina },
 *                     espacamento:{ entrelinha, margem_superior_mm, margem_inferior_mm } } } }
 */

import { FONTES_SISTEMA } from './athenes_estilos.js';

export const NIVEL_MAX = 9;
export const TIPOS_PREENCHIMENTO = ['pontos', 'tracos', 'linha', 'nenhum'];
export const DENSIDADES = ['denso', 'normal', 'aberto'];
export const TRANSFORMACOES = ['none', 'uppercase', 'lowercase', 'capitalize'];
export const ALINHAMENTOS_TITULO = ['esquerda', 'centro', 'direita'];

const COR = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d);
const NUM = (v, min, max, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const BOOL = (v, d) => (typeof v === 'boolean' ? v : d);
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Nível válido de um título (1..NIVEL_MAX). */
export const nivelDe = (b) => Math.min(NIVEL_MAX, Math.max(1, parseInt(b?.nivel, 10) || 1));

/** Texto puro de um HTML de título (sem marcações, sem hifens condicionais, espaços colapsados). */
export function textoPuroHtml(html) {
  return String(html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[­​]/g, '').replace(/\s+/g, ' ').trim();
}

// ───────────────────────────── Numeração decimal progressiva ─────────────────────────────

const SECOES_SEM_NUMERACAO = new Set(['capa', 'sumario']);

export const REGEX_NUMERO_MANUAL = /^\s*(?:\d+(?:\.\d+)+|\d+\s*[.)\-–—])\s*/;

/** Remove o número digitado à mão ("1.2 Contexto", "2. Método") do início do texto. */
export const removerNumeroManual = (texto) => String(texto ?? '').replace(REGEX_NUMERO_MANUAL, '');

export function normalizarNumeracaoSecoes(c) {
  return {
    ativa: !!c?.ativa,
    separador: ['.', '-', ''].includes(c?.separador) ? c.separador : '.',
    ate_nivel: Math.round(NUM(c?.ate_nivel, 1, NIVEL_MAX, NIVEL_MAX)),
    iniciar_em: Math.round(NUM(c?.iniciar_em, 1, 999, 1))
  };
}

/** O bloco recebe número automático? `b.numerar_secao` (true/false) vence o padrão do documento. */
export function blocoNumerado(doc, b) {
  if (!b || b.tipo !== 'titulo') return false;
  const cfg = normalizarNumeracaoSecoes(doc?.numeracao_secoes);
  if (nivelDe(b) > cfg.ate_nivel) return false;
  if (b.numerar_secao === true) return true;
  if (b.numerar_secao === false) return false;
  return cfg.ativa;
}

/**
 * Prefixos decimais de todos os títulos, na ordem de leitura do documento: "1", "1.1", "1.1.1", "1.1.1.1"…
 * Títulos sem numeração não consomem número. Um nível pulado (1 → 3) conta como 1 no nível intermediário.
 * Retorna Map(blocoId → { prefixo, nivel }).
 */
export function calcularNumeracaoSecoes(doc) {
  const mapa = new Map();
  const cfg = normalizarNumeracaoSecoes(doc?.numeracao_secoes);
  const cont = new Array(NIVEL_MAX + 1).fill(0);
  for (const sec of doc?.secoes || []) {
    if (SECOES_SEM_NUMERACAO.has(sec.mestraId)) continue; // título da capa e do próprio sumário não entram na numeração
    for (const b of sec.blocos || []) {
      if (!blocoNumerado(doc, b)) continue;
      const n = nivelDe(b);
      for (let i = 1; i < n; i++) if (cont[i] === 0) cont[i] = i === 1 ? cfg.iniciar_em : 1; // nível pulado
      cont[n] = cont[n] === 0 ? (n === 1 ? cfg.iniciar_em : 1) : cont[n] + 1;
      for (let i = n + 1; i <= NIVEL_MAX; i++) cont[i] = 0;
      mapa.set(b.id, { prefixo: cont.slice(1, n + 1).join(cfg.separador || ''), nivel: n });
    }
  }
  return mapa;
}

// ───────────────────────────── Configuração do sumário ─────────────────────────────

/** Padrão por nível, no espírito da ABNT: 1 = CAIXA ALTA negrito; 2 = CAIXA ALTA; 3 = negrito; 4 = itálico; 5+ = normal. */
export function nivelPadrao(n) {
  const base = {
    mostrar_pagina: true, recuo_mm: Math.max(0, (n - 1) * 5), transformacao: 'none',
    fonte: { familia: '', tamanho_pt: 12, negrito: false, italico: false, sublinhado: false, cor: '#1F2733', cor_numero: '', cor_pagina: '' },
    espacamento: { entrelinha: 1.2, margem_superior_mm: 0, margem_inferior_mm: 1.5 }
  };
  if (n === 1) { base.transformacao = 'uppercase'; base.fonte.negrito = true; base.espacamento.margem_superior_mm = 2; }
  else if (n === 2) base.transformacao = 'uppercase';
  else if (n === 3) base.fonte.negrito = true;
  else if (n === 4) base.fonte.italico = true;
  return base;
}

export function normalizarNivelSumario(c, n) {
  const d = nivelPadrao(n);
  const f = c?.fonte || {}; const e = c?.espacamento || {};
  return {
    mostrar_pagina: BOOL(c?.mostrar_pagina, d.mostrar_pagina),
    recuo_mm: NUM(c?.recuo_mm, 0, 80, d.recuo_mm),
    transformacao: TRANSFORMACOES.includes(c?.transformacao) ? c.transformacao : d.transformacao,
    fonte: {
      familia: f.familia in FONTES_SISTEMA ? f.familia : '',
      tamanho_pt: NUM(f.tamanho_pt, 6, 36, d.fonte.tamanho_pt),
      negrito: BOOL(f.negrito, d.fonte.negrito), italico: BOOL(f.italico, d.fonte.italico), sublinhado: BOOL(f.sublinhado, d.fonte.sublinhado),
      cor: COR(f.cor, d.fonte.cor),
      cor_numero: f.cor_numero ? COR(f.cor_numero, '') : '', cor_pagina: f.cor_pagina ? COR(f.cor_pagina, '') : ''
    },
    espacamento: {
      entrelinha: NUM(e.entrelinha, 0.8, 3, d.espacamento.entrelinha),
      margem_superior_mm: NUM(e.margem_superior_mm, 0, 30, d.espacamento.margem_superior_mm),
      margem_inferior_mm: NUM(e.margem_inferior_mm, 0, 30, d.espacamento.margem_inferior_mm)
    }
  };
}

export function normalizarConfigSumario(c) {
  const p = c?.preenchimento || {};
  const niveis = {};
  for (let n = 1; n <= NIVEL_MAX; n++) niveis[n] = normalizarNivelSumario(c?.niveis?.[n], n);
  return {
    profundidade_max: Math.round(NUM(c?.profundidade_max, 1, NIVEL_MAX, 3)),
    titulo: {
      texto: typeof c?.titulo?.texto === 'string' ? c.titulo.texto : 'SUMÁRIO',
      alinhamento: ALINHAMENTOS_TITULO.includes(c?.titulo?.alinhamento) ? c.titulo.alinhamento : 'centro'
    },
    preenchimento: {
      tipo: TIPOS_PREENCHIMENTO.includes(p.tipo) ? p.tipo : 'pontos',
      cor: COR(p.cor, '#94A3B8'), espessura_pt: NUM(p.espessura_pt, 0.25, 4, 0.75),
      densidade: DENSIDADES.includes(p.densidade) ? p.densidade : 'normal'
    },
    niveis
  };
}

/** Configuração efetiva de um bloco: a dele, senão o padrão do documento, senão o padrão ABNT. */
export const configEfetivaSumario = (doc, bloco) => normalizarConfigSumario(bloco?.sumario_config || doc?.sumario_config_padrao);

// ───────────────────────────── Extração dos itens ─────────────────────────────

/**
 * Itens do sumário a partir das páginas calculadas: { id, texto, nivel, prefixo, pagina }.
 * Só `titulo` entra; blocos com `ocultar_no_sumario` e páginas de capa/sumário ficam de fora.
 */
export function extrairItensSumario(doc, { profundidade = NIVEL_MAX, mapa = null } = {}) {
  if (!doc || !Array.isArray(doc.paginas)) return [];
  const prefixos = mapa || calcularNumeracaoSecoes(doc);
  const itens = [];
  for (const pag of doc.paginas) {
    const m = pag.mestraId || pag.modeloId;
    if (m === 'capa' || m === 'sumario') continue;
    for (const b of pag.blocos || []) {
      if (b.tipo !== 'titulo' || b.ocultar_no_sumario) continue;
      const nivel = nivelDe(b);
      if (nivel > profundidade) continue;
      const num = prefixos.get(b.id);
      const bruto = textoPuroHtml(b.texto) || 'Seção';
      itens.push({
        id: b.id, nivel, prefixo: num?.prefixo || '',
        texto: num ? (removerNumeroManual(bruto) || bruto) : bruto, // com número automático, o digitado à mão não duplica
        pagina: pag.numeroExibido ?? pag.numero ?? 1
      });
    }
  }
  return itens;
}

// ───────────────────────────── Renderização ─────────────────────────────

export function aplicarTransformacao(texto, modo) {
  if (modo === 'uppercase') return texto.toLocaleUpperCase('pt-BR');
  if (modo === 'lowercase') return texto.toLocaleLowerCase('pt-BR');
  if (modo === 'capitalize') return texto.toLocaleLowerCase('pt-BR').replace(/(^|[\s(\-–—/])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pt-BR'));
  return texto;
}

const FAMILIA = (id) => (FONTES_SISTEMA[id]?.familia || '').replace(/"/g, "'");
const ESPACO_LIDER = { denso: 0.12, normal: 0.5, aberto: 1.0 };

/** CSS do texto de um nível (família só quando definida; senão herda do bloco). */
export function cssTextoNivel(nv) {
  const f = nv.fonte;
  return [
    f.familia ? `font-family:${FAMILIA(f.familia)};` : '', `font-size:${f.tamanho_pt}pt;`, `font-weight:${f.negrito ? 700 : 400};`,
    `font-style:${f.italico ? 'italic' : 'normal'};`, f.sublinhado ? 'text-decoration:underline;' : '', `color:${f.cor};`
  ].join('');
}

/** Elemento de preenchimento entre o título e a página. */
export function liderHtml(pre) {
  if (pre.tipo === 'nenhum') return '<span class="ath-toc-lider" style="flex:1 1 0;min-width:2mm"></span>';
  const base = 'flex:1 1 0;min-width:4mm;overflow:hidden;white-space:nowrap;margin:0 1.5mm;';
  if (pre.tipo === 'linha') return `<span class="ath-toc-lider" aria-hidden="true" style="${base}border-bottom:${pre.espessura_pt}pt solid ${pre.cor};height:0.7em;align-self:flex-end;"></span>`;
  const glifo = pre.tipo === 'tracos' ? '-' : '.';
  const esp = pre.tipo === 'tracos' ? 0.25 : ESPACO_LIDER[pre.densidade];
  const tam = Math.round((0.7 + pre.espessura_pt * 0.45) * 100) / 100;
  return `<span class="ath-toc-lider" aria-hidden="true" style="${base}color:${pre.cor};font-size:${tam}em;letter-spacing:${esp}em;font-weight:400;font-style:normal;text-decoration:none;">${glifo.repeat(400)}</span>`;
}

/**
 * HTML do sumário (mesmo markup no editor e no PDF). `opcoes.href(id)` gera o destino do link interno;
 * `estiloTitulo` é o CSS do estilo de título do documento aplicado à palavra "SUMÁRIO".
 */
export function sumarioHtml(itens, cfg, { href = (id) => `#ath-b-${id}`, estiloTitulo = '', classe = '' } = {}) {
  const c = normalizarConfigSumario(cfg);
  const lista = itens.filter(it => it.nivel <= c.profundidade_max);
  const justif = { esquerda: 'left', centro: 'center', direita: 'right' }[c.titulo.alinhamento];
  const titulo = c.titulo.texto ? `<div class="ath-toc-titulo" style="${estiloTitulo}text-align:${justif};margin-bottom:6mm;">${escHtml(c.titulo.texto)}</div>` : '';
  const linhas = lista.map(it => {
    const nv = c.niveis[Math.min(NIVEL_MAX, it.nivel)];
    const f = nv.fonte;
    const corNum = f.cor_numero || f.cor; const corPag = f.cor_pagina || f.cor;
    const prefixo = it.prefixo ? `<span class="ath-toc-pre" style="color:${corNum};margin-right:2.2mm;white-space:nowrap;">${escHtml(it.prefixo)}</span>` : '';
    const pagina = nv.mostrar_pagina
      ? `${liderHtml(c.preenchimento)}<span class="ath-toc-pg" style="flex:none;min-width:9mm;text-align:right;font-variant-numeric:tabular-nums;color:${corPag};">${escHtml(it.pagina)}</span>`
      : '';
    return `<div class="ath-toc-item ath-toc-n${it.nivel}" style="margin:${nv.espacamento.margem_superior_mm}mm 0 ${nv.espacamento.margem_inferior_mm}mm ${nv.recuo_mm}mm;line-height:${nv.espacamento.entrelinha};text-indent:0;text-align:left;hyphens:manual;${cssTextoNivel(nv)}"><a class="ath-toc-link" href="${escHtml(href(it.id))}" data-sumario-alvo="${escHtml(it.id)}" style="display:flex;align-items:baseline;color:inherit;text-decoration:inherit;">${prefixo}<span class="ath-toc-txt" style="flex:0 1 auto;min-width:0;">${escHtml(aplicarTransformacao(it.texto, nv.transformacao))}</span>${pagina}</a></div>`;
  }).join('\n');
  const vazio = lista.length ? '' : '<div style="color:#64748B;font-size:10pt;">Nenhum título encontrado nos níveis selecionados.</div>';
  return `<div class="ath-sumario ${classe}">${titulo}<div class="ath-toc-lista">${linhas}${vazio}</div></div>`;
}

// ───────────────────────────── Exportação (apoio) ─────────────────────────────

/** Tag semântica de um nível (h1..h6; níveis 7+ viram h6 com `aria-level`). */
export const tagDoNivel = (n) => `h${Math.min(6, Math.max(1, n))}`;

/** Estilo de título do documento para um nível: o do bloco, senão `tituloN`, senão o último disponível abaixo. */
export function estiloIdDoTitulo(estilosMap, b) {
  if (estilosMap[b.estiloId]) return b.estiloId;
  for (let n = Math.min(6, nivelDe(b)); n >= 1; n--) if (estilosMap[`titulo${n}`]) return `titulo${n}`;
  return 'corpo';
}
