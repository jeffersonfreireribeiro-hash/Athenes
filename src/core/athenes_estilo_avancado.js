// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Estilos de parágrafo avançados (estilo Affinity Publisher).
 *
 * No estilo de texto (`estilos[]`), além de `recuo_primeira_linha_mm`, `recuo_esquerdo_mm` e
 * `recuo_deslocado_mm`, existem:
 *   recuo_direito_mm                    recuo direito persistente do parágrafo
 *   avancado: {
 *     barra_lateral:     { ativa, lado: 'esquerda'|'direita', largura_pt, cor, distancia_mm, estilo: 'solida'|'tracejada'|'pontilhada' }
 *     fundo_bloco:       { ativo, cor, preenchimento_mm }
 *     capitular:         { ativa, linhas (2–6), cor, peso, afastamento_mm }             // 1ª letra (drop cap)
 *     palavras_iniciais: { ativa, quantidade (1–12), peso, cor, caixa_alta, italico }
 *     primeira_linha:    { ativa, peso, cor, caixa_alta, italico, espacamento_letras_em }
 *     ornamento_fim:     { ativo, glifo (até 3 caracteres), cor, tamanho_em, afastamento_em } // fim do texto
 *   }
 * Tudo puro (sem DOM): serve ao editor, ao PDF, ao DOCX e ao pacote de tema.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const cor = (v, pad) => (typeof v === 'string' && HEX.test(v) ? v : pad);
const num = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad; };
const enumDe = (v, lista, pad) => (lista.includes(v) ? v : pad);
const peso = (v, pad) => { const n = Math.round(num(v, 100, 900, pad) / 100) * 100; return n; };
const bool = (v) => v === true || v === 'true';

export const AVANCADO_PADRAO = Object.freeze({
  barra_lateral: { ativa: false, lado: 'esquerda', largura_pt: 3, cor: '#314F79', distancia_mm: 4, estilo: 'solida' },
  fundo_bloco: { ativo: false, cor: '#EEF4FA', preenchimento_mm: 3 },
  capitular: { ativa: false, linhas: 3, cor: '#314F79', peso: 700, afastamento_mm: 1.5 },
  palavras_iniciais: { ativa: false, quantidade: 3, peso: 700, cor: '', caixa_alta: false, italico: false },
  primeira_linha: { ativa: false, peso: 600, cor: '', caixa_alta: false, italico: false, espacamento_letras_em: 0 },
  ornamento_fim: { ativo: false, glifo: '■', cor: '#314F79', tamanho_em: 0.8, afastamento_em: 0.4 }
});

/** Sanitiza o bloco `avancado` (vem de JSON externo/IA). Devolve null quando nada está ativo. */
export function normalizarAvancado(av) {
  if (!av || typeof av !== 'object') return null;
  const P = AVANCADO_PADRAO;
  const b = av.barra_lateral || {}, f = av.fundo_bloco || {}, c = av.capitular || {}, pi = av.palavras_iniciais || {}, pl = av.primeira_linha || {}, o = av.ornamento_fim || {};
  const out = {
    barra_lateral: {
      ativa: bool(b.ativa), lado: enumDe(b.lado, ['esquerda', 'direita'], P.barra_lateral.lado),
      largura_pt: num(b.largura_pt, 0.5, 24, P.barra_lateral.largura_pt), cor: cor(b.cor, P.barra_lateral.cor),
      distancia_mm: num(b.distancia_mm, 0, 20, P.barra_lateral.distancia_mm), estilo: enumDe(b.estilo, ['solida', 'tracejada', 'pontilhada'], 'solida')
    },
    fundo_bloco: { ativo: bool(f.ativo), cor: cor(f.cor, P.fundo_bloco.cor), preenchimento_mm: num(f.preenchimento_mm, 0, 15, P.fundo_bloco.preenchimento_mm) },
    capitular: {
      ativa: bool(c.ativa), linhas: Math.round(num(c.linhas, 2, 6, P.capitular.linhas)), cor: cor(c.cor, P.capitular.cor),
      peso: peso(c.peso, P.capitular.peso), afastamento_mm: num(c.afastamento_mm, 0, 10, P.capitular.afastamento_mm)
    },
    palavras_iniciais: {
      ativa: bool(pi.ativa), quantidade: Math.round(num(pi.quantidade, 1, 12, P.palavras_iniciais.quantidade)), peso: peso(pi.peso, P.palavras_iniciais.peso),
      cor: cor(pi.cor, ''), caixa_alta: bool(pi.caixa_alta), italico: bool(pi.italico)
    },
    primeira_linha: {
      ativa: bool(pl.ativa), peso: peso(pl.peso, P.primeira_linha.peso), cor: cor(pl.cor, ''), caixa_alta: bool(pl.caixa_alta), italico: bool(pl.italico),
      espacamento_letras_em: num(pl.espacamento_letras_em, -0.1, 1, 0)
    },
    ornamento_fim: {
      ativo: bool(o.ativo), glifo: String(o.glifo ?? P.ornamento_fim.glifo).replace(/[<>&"'\\]/g, '').slice(0, 3) || P.ornamento_fim.glifo,
      cor: cor(o.cor, P.ornamento_fim.cor), tamanho_em: num(o.tamanho_em, 0.4, 3, P.ornamento_fim.tamanho_em), afastamento_em: num(o.afastamento_em, 0, 3, P.ornamento_fim.afastamento_em)
    }
  };
  const algum = out.barra_lateral.ativa || out.fundo_bloco.ativo || out.capitular.ativa || out.palavras_iniciais.ativa || out.primeira_linha.ativa || out.ornamento_fim.ativo;
  return algum ? out : null;
}

/** Sanitiza todo estilo de uma lista (preserva o resto do objeto). */
export function sanitizarEstiloAvancado(estilo) {
  if (!estilo || typeof estilo !== 'object') return estilo;
  const novo = { ...estilo };
  if (novo.recuo_direito_mm !== undefined) novo.recuo_direito_mm = num(novo.recuo_direito_mm, 0, 200, 0);
  if (novo.entrelinha_tipo === 'pelo_menos' || novo.entrelinha_tipo === 'exatamente') novo.entrelinha_pt = num(novo.entrelinha_pt, 1, 400, 14);
  else { delete novo.entrelinha_tipo; delete novo.entrelinha_pt; }
  const av = normalizarAvancado(novo.avancado);
  if (av) novo.avancado = av; else delete novo.avancado;
  return novo;
}

export const temAvancado = (estilo) => !!normalizarAvancado(estilo?.avancado);

const idCss = (id) => String(id || 'x').replace(/[^\w-]/g, '_');
export const classeAvancada = (estilo) => `ath-av-${idCss(estilo?.id)}`;

/** CSS de bloco (recuo direito, barra lateral, fundo) para somar ao CSS inline do estilo. */
export function cssAvancadoInline(estilo) {
  if (!estilo) return '';
  const p = [];
  if (estilo.recuo_direito_mm) p.push(`margin-right: ${estilo.recuo_direito_mm}mm;`);
  const av = normalizarAvancado(estilo.avancado);
  if (!av) return p.join(' ');
  const { barra_lateral: b, fundo_bloco: f } = av;
  const pad = { t: 0, r: 0, b: 0, l: Number(estilo.recuo_deslocado_mm) || 0 };
  if (f.ativo) {
    p.push(`background-color: ${f.cor};`);
    pad.t += f.preenchimento_mm; pad.b += f.preenchimento_mm; pad.l += f.preenchimento_mm; pad.r += f.preenchimento_mm;
  }
  if (b.ativa) {
    const lado = b.lado === 'direita' ? 'right' : 'left';
    const tracado = { solida: 'solid', tracejada: 'dashed', pontilhada: 'dotted' }[b.estilo];
    p.push(`border-${lado}: ${b.largura_pt}pt ${tracado} ${b.cor};`);
    pad[lado === 'left' ? 'l' : 'r'] += b.distancia_mm;
  }
  if (f.ativo || b.ativa) {
    p.push(`padding: ${pad.t}mm ${pad.r}mm ${pad.b}mm ${pad.l}mm;`);
    p.push('box-sizing: border-box; box-decoration-break: clone; -webkit-box-decoration-break: clone;');
  }
  return p.join(' ');
}

/**
 * Regras de pseudo-elementos (capitular, 1ª linha, ornamento) para todos os estilos que as usam.
 * Os blocos recebem `classeAvancada(estilo)`; o ornamento só aparece com a classe `ath-av-fim`.
 */
export function cssAvancadoDosEstilos(estilos) {
  const regras = [];
  for (const e of Array.isArray(estilos) ? estilos : []) {
    const av = normalizarAvancado(e?.avancado);
    if (!av) continue;
    const k = `.${classeAvancada(e)}`;
    const L = Number(e.entrelinha) || 1.5;
    if (av.capitular.ativa) {
      const n = av.capitular.linhas;
      const fs = ((n - 1) * L + 0.7) / 0.7; // topo da capital alinha à 1ª linha, base à n-ésima
      regras.push(`${k}.ath-av-inicio::first-letter{float:left;font-size:${fs.toFixed(2)}em;line-height:${(0.72).toFixed(2)};padding:${(0.07 * fs).toFixed(2)}em ${av.capitular.afastamento_mm}mm 0 0;font-weight:${av.capitular.peso};color:${av.capitular.cor};text-indent:0;}`);
    }
    if (av.primeira_linha.ativa) {
      const pl = av.primeira_linha;
      regras.push(`${k}.ath-av-inicio::first-line{font-weight:${pl.peso};${pl.cor ? `color:${pl.cor};` : ''}${pl.caixa_alta ? 'text-transform:uppercase;' : ''}${pl.italico ? 'font-style:italic;' : ''}${pl.espacamento_letras_em ? `letter-spacing:${pl.espacamento_letras_em}em;` : ''}}`);
    }
    if (av.ornamento_fim.ativo) {
      const o = av.ornamento_fim;
      regras.push(`${k}.ath-av-fim::after{content:"${o.glifo}";color:${o.cor};font-size:${o.tamanho_em}em;margin-left:${o.afastamento_em}em;white-space:nowrap;font-weight:400;font-style:normal;text-transform:none;letter-spacing:0;}`);
    }
  }
  return regras.join('\n');
}

/** Classes do bloco; `frag` = { continuaDaAnterior, continuaNaProxima } quando o parágrafo foi dividido entre páginas. */
export function classesAvancadasDoBloco(estilo, frag = null) {
  if (!temAvancado(estilo)) return '';
  const k = [classeAvancada(estilo)];
  if (!frag?.continuaDaAnterior) k.push('ath-av-inicio');
  if (!frag?.continuaNaProxima) k.push('ath-av-fim');
  return k.join(' ');
}

/** Envolve as N primeiras palavras do texto (fora das marcações) em <span class="ath-pi">; idempotente. */
export function aplicarPalavrasIniciais(html, estilo) {
  const av = normalizarAvancado(estilo?.avancado);
  const pi = av?.palavras_iniciais;
  if (!pi?.ativa || typeof html !== 'string' || !html) return html;
  const sem = removerPalavrasIniciais(html);
  const css = `font-weight:${pi.peso};${pi.cor ? `color:${pi.cor};` : ''}${pi.caixa_alta ? 'text-transform:uppercase;' : ''}${pi.italico ? 'font-style:italic;' : ''}`;
  let restantes = pi.quantidade;
  let emTag = false;
  let saida = '';
  const pedacos = sem.split(/(<[^>]*>)/);
  for (const parte of pedacos) {
    if (!parte) continue;
    if (parte.startsWith('<') && parte.endsWith('>')) { saida += parte; continue; }
    if (restantes <= 0) { saida += parte; continue; }
    // percorre palavras do trecho de texto; espaços ficam fora do destaque
    const tokens = parte.split(/(\s+)/);
    let i = 0, aberto = '';
    for (; i < tokens.length && restantes > 0; i++) {
      const t = tokens[i];
      if (!t) continue;
      if (/^\s+$/.test(t)) { if (aberto) { saida += `<span class="ath-pi" style="${css}">${aberto}</span>`; aberto = ''; } saida += t; continue; }
      aberto += t; restantes--;
    }
    if (aberto) saida += `<span class="ath-pi" style="${css}">${aberto}</span>`;
    saida += tokens.slice(i).join('');
  }
  void emTag;
  return saida;
}

/** Desfaz aplicarPalavrasIniciais (o texto salvo nunca guarda os spans de exibição). */
export function removerPalavrasIniciais(html) {
  return typeof html === 'string' ? html.replace(/<span class="ath-pi" style="[^"]*">([^<]*)<\/span>/g, '$1') : html;
}

/** Separa a 1ª letra visível (fora das marcações) do HTML: { letra, resto } — base da capitular no DOCX. */
export function separarPrimeiraLetra(html) {
  const s = String(html || '');
  const m = /^((?:\s|<[^>]*>)*)(&[#\w]+;|[^\s<])/.exec(s);
  if (!m) return { letra: '', resto: s };
  return { letra: m[2], resto: m[1] + s.slice(m[0].length) };
}
