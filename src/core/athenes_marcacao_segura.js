// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Marcação segura: parser tolerante (XML/HTML), sanitizador de SVG, de HTML e de CSS.
 *
 * Substitui o DOMPurify sem nenhuma dependência: módulo puro (sem DOM), roda no navegador e no Node.
 * Estratégia "lista de permissões": só elementos/atributos conhecidos são reescritos na saída; todo o resto
 * (script, eventos `on*`, foreignObject, iframe, animações SMIL, `javascript:`, `url()` externo, @import…) é descartado.
 *
 *   sanitizarSvg(codigo, {prefixoId, escopoCss})  → { ok, svg, viewBox, largura, altura, erros, avisos }
 *   sanitizarHtml(codigo, {escopoCss})            → { ok, html, css, erros, avisos }
 *   sanitizarCss(css, {escopo, prefixoId})        → string
 *   formatarMarcacao(codigo, 'svg'|'html')        → string indentada
 */

const MAX_BYTES = 600_000;
const MAX_NOS = 25_000;
const MAX_PROFUNDIDADE = 60;

// ───────────────────────────── Entidades e escape ─────────────────────────────

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', deg: '°', plusmn: '±', times: '×', middot: '·', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', micro: 'µ', sup2: '²', sup3: '³' };
export function decodificarEntidades(s) {
  return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : '';
    }
    return ENT[e] ?? m;
  });
}
export const escTexto = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => escTexto(s).replace(/"/g, '&quot;');

// ───────────────────────────── Parser tolerante ─────────────────────────────

const VOID_HTML = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TEXTO_BRUTO = new Set(['script', 'style', 'textarea', 'title_']);

/**
 * Lê `texto` em uma árvore { tag, attrs: [[nome, valor]], filhos, linha } (texto = string).
 * `modo: 'xml'` exige fechamento correto; `'html'` aceita tags void e fechamento implícito.
 * Retorna { raiz, erros:[{linha, mensagem}] }.
 */
export function parseMarcacao(texto, { modo = 'xml' } = {}) {
  const src = String(texto ?? '');
  const erros = [];
  const raiz = { tag: '#raiz', attrs: [], filhos: [], linha: 1 };
  const pilha = [raiz];
  let i = 0;
  let linha = 1;
  let nos = 0;
  const n = src.length;
  const contaLinhas = (de, ate) => { for (let k = de; k < ate; k++) if (src.charCodeAt(k) === 10) linha++; };
  const topo = () => pilha[pilha.length - 1];
  const html = modo === 'html';
  const addTexto = (t) => { if (t) topo().filhos.push(t); };

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { addTexto(src.slice(i)); break; }
    if (lt > i) { const t = src.slice(i, lt); addTexto(t); contaLinhas(i, lt); }
    i = lt;
    if (++nos > MAX_NOS) { erros.push({ linha, mensagem: 'Código grande demais.' }); break; }

    if (src.startsWith('<!--', i)) {
      const fim = src.indexOf('-->', i + 4);
      const ate = fim < 0 ? n : fim + 3;
      contaLinhas(i, ate); i = ate; continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const fim = src.indexOf(']]>', i + 9);
      const ate = fim < 0 ? n : fim + 3;
      const t = src.slice(i + 9, fim < 0 ? n : fim);
      topo().filhos.push({ cdata: t });
      contaLinhas(i, ate); i = ate; continue;
    }
    if (src.startsWith('<!', i) || src.startsWith('<?', i)) {
      const fim = src.indexOf('>', i + 2);
      const ate = fim < 0 ? n : fim + 1;
      contaLinhas(i, ate); i = ate; continue;
    }

    // tag de fechamento
    if (src[i + 1] === '/') {
      const fim = src.indexOf('>', i + 2);
      const nome = src.slice(i + 2, fim < 0 ? n : fim).trim();
      const chave = html ? nome.toLowerCase() : nome;
      const ate = fim < 0 ? n : fim + 1;
      let k = pilha.length - 1;
      while (k > 0 && (html ? pilha[k].tag.toLowerCase() : pilha[k].tag) !== chave) k--;
      if (k > 0) {
        if (k !== pilha.length - 1 && !html) {
          erros.push({ linha, mensagem: `Tag <${pilha[pilha.length - 1].tag}> aberta na linha ${pilha[pilha.length - 1].linha} não foi fechada antes de </${nome}>.` });
        }
        pilha.length = k;
      } else {
        erros.push({ linha, mensagem: `Tag de fechamento </${nome}> sem tag de abertura correspondente.`, nivel: html ? 'aviso' : 'erro' });
      }
      contaLinhas(i, ate); i = ate; continue;
    }

    // tag de abertura
    const mNome = /^<([A-Za-z_][\w:.-]*)/.exec(src.slice(i, i + 80));
    if (!mNome) { addTexto('<'); i += 1; continue; }
    const nome = mNome[1];
    let j = i + mNome[0].length;
    const attrs = [];
    let autoFecha = false;
    let fechada = false;
    const linhaTag = linha;
    while (j < n) {
      while (j < n && /\s/.test(src[j])) { if (src[j] === '\n') linha++; j++; }
      if (j >= n) break;
      if (src[j] === '>') { j++; fechada = true; break; }
      if (src[j] === '/' && src[j + 1] === '>') { autoFecha = true; j += 2; fechada = true; break; }
      if (src[j] === '/') { j++; continue; }
      const mAttr = /^[^\s=/>"']+/.exec(src.slice(j, j + 200));
      if (!mAttr) { j++; continue; }
      const nomeAttr = mAttr[0];
      j += nomeAttr.length;
      while (j < n && /\s/.test(src[j])) { if (src[j] === '\n') linha++; j++; }
      let valor = '';
      if (src[j] === '=') {
        j++;
        while (j < n && /\s/.test(src[j])) { if (src[j] === '\n') linha++; j++; }
        const q = src[j];
        if (q === '"' || q === "'") {
          const fim = src.indexOf(q, j + 1);
          const f = fim < 0 ? n : fim;
          valor = src.slice(j + 1, f);
          for (let k = j; k < f; k++) if (src.charCodeAt(k) === 10) linha++;
          j = fim < 0 ? n : fim + 1;
        } else {
          const mv = /^[^\s>]+/.exec(src.slice(j, j + 500));
          valor = mv ? mv[0] : '';
          j += valor.length;
        }
        valor = decodificarEntidades(valor);
      }
      attrs.push([nomeAttr, valor]);
    }
    if (!fechada) erros.push({ linha: linhaTag, mensagem: `A tag <${nome}> não foi terminada com ">".` });
    i = j;

    const no = { tag: nome, attrs, filhos: [], linha: linhaTag };
    topo().filhos.push(no);
    const baixa = nome.toLowerCase();
    const vazio = autoFecha || (html && VOID_HTML.has(baixa));
    if (!vazio) {
      if (pilha.length > MAX_PROFUNDIDADE) { erros.push({ linha, mensagem: 'Aninhamento profundo demais.' }); break; }
      // elementos de texto bruto: tudo até o fechamento correspondente
      if ((html ? (baixa === 'style' || baixa === 'script' || baixa === 'textarea') : baixa === 'style' || baixa === 'script')) {
        const re = new RegExp('</' + baixa + '\\s*>', 'i');
        const resto = src.slice(i);
        const m = re.exec(resto);
        const corpo = m ? resto.slice(0, m.index) : resto;
        no.filhos.push({ bruto: corpo.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '') });
        const ate = i + (m ? m.index + m[0].length : resto.length);
        contaLinhas(i, ate); i = ate;
      } else {
        pilha.push(no);
      }
    }
  }
  for (let k = pilha.length - 1; k > 0; k--) {
    if (!html) erros.push({ linha: pilha[k].linha, mensagem: `A tag <${pilha[k].tag}> aberta na linha ${pilha[k].linha} não foi fechada.` });
    else if (!['p', 'li', 'td', 'th', 'tr', 'dd', 'dt', 'option', 'body', 'html', 'head'].includes(pilha[k].tag.toLowerCase())) {
      erros.push({ linha: pilha[k].linha, mensagem: `A tag <${pilha[k].tag}> aberta na linha ${pilha[k].linha} não foi fechada.`, nivel: 'aviso' });
    }
  }
  return { raiz, erros };
}

// ───────────────────────────── CSS ─────────────────────────────

const CSS_PERIGOSO = /expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding|@import|@charset|@namespace|<\/?script|\\0*[0-9a-f]{0,6}\s*(?:6a|4a)/i;

/** Remove comentários e escapes de CSS usados para esconder palavras proibidas (`\6a avascript`). */
function limparCssBase(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--|-->/g, '').replace(/\\([0-9a-fA-F]{1,6})\s?/g, (m, h) => {
    const c = parseInt(h, 16);
    return c > 31 && c < 127 ? String.fromCharCode(c) : '';
  }).replace(/\\\r?\n/g, '');
}

/** Valor de declaração seguro: `url()` só para referências locais `#id`; sem expression/javascript. */
export function valorCssSeguro(valor, { prefixoId = '' } = {}) {
  let v = limparCssBase(valor).trim();
  if (!v || CSS_PERIGOSO.test(v)) return null;
  let ruim = false;
  v = v.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (m, q, alvo) => {
    const t = alvo.trim();
    if (t.startsWith('#')) return `url(#${prefixoId}${t.slice(1)})`;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(t)) return `url(${t.replace(/\s+/g, '')})`;
    ruim = true;
    return '';
  });
  if (ruim) return null;
  if (/[<>]/.test(v)) return null;
  return v;
}

function declaracoesSeguras(corpo, opc = {}) {
  const out = [];
  for (const parte of splitTopo(corpo, ';')) {
    const k = parte.indexOf(':');
    if (k < 1) continue;
    const prop = parte.slice(0, k).trim().toLowerCase();
    if (!/^(--)?[a-z][a-z0-9-]*$/.test(prop) && !/^--[\w-]+$/.test(prop)) continue;
    if (/^(behavior|-moz-binding)$/.test(prop)) continue;
    let valor = parte.slice(k + 1).trim().replace(/\s*!important\s*$/i, ' !important');
    const seguro = valorCssSeguro(valor, opc);
    if (seguro === null) continue;
    out.push(`${prop}:${seguro}`);
  }
  return out.join(';');
}

/** Divide por `sep` ignorando o que está dentro de parênteses/aspas. */
function splitTopo(s, sep) {
  const out = []; let prof = 0; let aspas = ''; let atual = '';
  for (const c of s) {
    if (aspas) { atual += c; if (c === aspas) aspas = ''; continue; }
    if (c === '"' || c === "'") { aspas = c; atual += c; continue; }
    if (c === '(') prof++;
    if (c === ')') prof = Math.max(0, prof - 1);
    if (c === sep && prof === 0) { out.push(atual); atual = ''; continue; }
    atual += c;
  }
  if (atual.trim()) out.push(atual);
  return out;
}

function prefixarSeletor(seletor, escopo, prefixoId) {
  return splitTopo(seletor, ',').map(sel => {
    let s = sel.trim();
    if (!s) return '';
    if (prefixoId) s = s.replace(/#([A-Za-z_][\w-]*)/g, (m, id) => `#${prefixoId}${id}`);
    if (!escopo) return s;
    // :root / html / body / svg (raiz) → o próprio escopo
    s = s.replace(/^(:root|html|body)\b/i, '').trim();
    if (/^svg\b/i.test(s)) s = s.replace(/^svg\b/i, '').trim();
    return s ? `${escopo} ${s}` : escopo;
  }).filter(Boolean).join(', ');
}

/**
 * Sanitiza uma folha CSS: remove @import/@font-face/@namespace, `url()` externo, expression, etc.
 * Com `escopo` (ex.: `[data-athesc="f1"]`) todo seletor é prefixado — o estilo não vaza para o editor.
 * Com `prefixoId` os seletores `#id` e `url(#id)` acompanham o prefixo aplicado aos ids do SVG.
 */
export function sanitizarCss(css, { escopo = '', prefixoId = '' } = {}) {
  const src = limparCssBase(css);
  const out = [];
  const n = src.length;
  const processar = (texto) => {
    const res = [];
    let p = 0;
    while (p < texto.length) {
      const ab = texto.indexOf('{', p);
      if (ab < 0) break;
      const prelude = texto.slice(p, ab).trim();
      let prof = 0; let fim = texto.length - 1;
      for (let k = ab; k < texto.length; k++) {
        if (texto[k] === '{') prof++;
        else if (texto[k] === '}') { prof--; if (prof === 0) { fim = k; break; } }
      }
      const corpo = texto.slice(ab + 1, fim);
      p = fim + 1;
      if (prelude.startsWith('@')) {
        const nome = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase();
        if (nome === 'media' || nome === 'supports') {
          const interno = processar(corpo);
          if (interno) res.push(`${prelude.replace(/[<>]/g, '')}{${interno}}`);
        } else if (nome === 'keyframes' || nome === '-webkit-keyframes') {
          // animações são descartadas: figura impressa/estática
        }
        // @font-face, @import, @page, @namespace… descartados
        continue;
      }
      const decl = declaracoesSeguras(corpo, { prefixoId });
      const sel = prefixarSeletor(prelude, escopo, prefixoId);
      if (sel && decl) res.push(`${sel}{${decl}}`);
    }
    return res.join('\n');
  };
  // ignora `@import …;` soltos (sem bloco) antes de processar
  const semAtSimples = src.replace(/@(import|charset|namespace)[^;]*;/gi, '');
  out.push(processar(semAtSimples));
  return out.join('\n').trim();
}

// ───────────────────────────── SVG ─────────────────────────────

const SVG_TAGS = [
  'svg', 'g', 'defs', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath',
  'title', 'desc', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'marker', 'style', 'image', 'switch',
  'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode', 'feDropShadow', 'metadata'
];
const SVG_TAG_MAP = new Map(SVG_TAGS.map(t => [t.toLowerCase(), t]));

const SVG_ATTRS = [
  // geometria
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points', 'dx', 'dy', 'rotate', 'transform', 'pathLength',
  'viewBox', 'preserveAspectRatio', 'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'orient', 'fx', 'fy', 'fr',
  'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'startOffset', 'textLength', 'lengthAdjust', 'method', 'spacing', 'filterUnits', 'primitiveUnits',
  // apresentação
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'opacity', 'color', 'display', 'visibility', 'overflow', 'clip-path', 'clip-rule', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end', 'vector-effect',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'letter-spacing', 'word-spacing', 'text-anchor', 'text-decoration', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'writing-mode',
  'stop-color', 'stop-opacity', 'shape-rendering', 'text-rendering', 'paint-order', 'mix-blend-mode', 'isolation',
  // filtros
  'stdDeviation', 'in', 'in2', 'result', 'mode', 'type', 'values', 'flood-color', 'flood-opacity', 'operator', 'k1', 'k2', 'k3', 'k4', 'order', 'edgeMode',
  // estrutura
  'id', 'class', 'style', 'lang', 'role', 'tabindex_', 'xmlns', 'xmlns:xlink', 'version', 'href', 'xlink:href', 'xml:space', 'systemLanguage',
  'aria-label', 'aria-hidden', 'aria-labelledby', 'aria-describedby', 'focusable_'
];
const SVG_ATTR_MAP = new Map(SVG_ATTRS.map(a => [a.toLowerCase(), a]));
const ATTR_URL = new Set(['fill', 'stroke', 'clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end']);
const NOMES_DESCARTADOS_COM_FILHOS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'animate', 'animatetransform', 'animatemotion', 'set', 'animatecolor', 'handler', 'listener', 'audio', 'video', 'canvas', 'link', 'meta', 'base']);

const DPI = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, q: 96 / 101.6 };

/** "120", "12pt", "3cm" → px; porcentagem/ausente → null. */
export function comprimentoParaPx(v) {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|q|em|ex|%)?\s*$/i.exec(String(v ?? ''));
  if (!m) return null;
  const un = (m[2] || 'px').toLowerCase();
  if (un === '%') return null;
  if (un === 'em') return parseFloat(m[1]) * 16;
  if (un === 'ex') return parseFloat(m[1]) * 8;
  return parseFloat(m[1]) * (DPI[un] ?? 1);
}

function valorAttrSvgSeguro(nome, valor, prefixoId) {
  let v = String(valor).replace(/[\u0000-\u001F\u007F]/g, ' ');
  const colado = v.replace(/\s+/g, '').toLowerCase();
  if (/javascript:|vbscript:|data:text|data:application|<script/.test(colado)) return null;
  if (nome === 'style') {
    const d = declaracoesSeguras(v, { prefixoId });
    return d || null;
  }
  if (nome === 'href' || nome === 'xlink:href') {
    const t = v.trim();
    if (t.startsWith('#')) return `#${prefixoId}${t.slice(1)}`;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(t)) return t.replace(/\s+/g, '');
    return null;
  }
  if (nome === 'id') return /^[A-Za-z_][\w:.-]*$/.test(v.trim()) ? prefixoId + v.trim() : null;
  if (nome === 'class') return v.replace(/[^\w\s-]/g, '').trim() || null;
  if (ATTR_URL.has(nome) || /url\s*\(/i.test(v)) {
    const seg = valorCssSeguro(v, { prefixoId });
    return seg === null ? null : seg;
  }
  if (nome === 'xmlns' || nome === 'xmlns:xlink' || nome === 'version') return null; // regravados pelo sanitizador
  return v.replace(/[<>]/g, '');
}

function serializarSvgNo(no, ctx, prof) {
  const baixa = no.tag.toLowerCase();
  const nomeLocal = baixa.includes(':') ? baixa.split(':').pop() : baixa;
  if (NOMES_DESCARTADOS_COM_FILHOS.has(nomeLocal)) {
    ctx.avisos.push(`Elemento <${no.tag}> removido por segurança (linha ${no.linha}).`);
    return '';
  }
  if (nomeLocal === 'a') { // links viram apenas o conteúdo
    return no.filhos.map(f => (typeof f === 'object' && f.tag ? serializarSvgNo(f, ctx, prof + 1) : '')).join('');
  }
  const tag = SVG_TAG_MAP.get(nomeLocal);
  if (!tag) {
    ctx.avisos.push(`Elemento <${no.tag}> não é suportado e foi removido (linha ${no.linha}).`);
    return '';
  }
  if (++ctx.nos > MAX_NOS) { ctx.erros.push({ linha: no.linha, mensagem: 'SVG complexo demais.' }); return ''; }

  if (tag === 'style') {
    const css = no.filhos.map(f => (typeof f === 'string' ? f : f.bruto ?? f.cdata ?? '')).join('');
    const limpo = sanitizarCss(css, { escopo: ctx.escopoCss, prefixoId: ctx.prefixoId });
    return limpo ? `<style>${limpo.replace(/</g, '\\3c ')}</style>` : '';
  }
  if (tag === 'switch') {
    ctx.avisos.push('Elemento <switch> simplificado: apenas o primeiro filho é mantido.');
  }

  let attrs = '';
  for (const [kRaw, v] of no.attrs) {
    const k = kRaw.toLowerCase();
    if (k.startsWith('on')) { ctx.avisos.push(`Atributo ${kRaw} (evento) removido.`); continue; }
    const canon = SVG_ATTR_MAP.get(k);
    if (!canon || canon.endsWith('_')) continue;
    if (tag === 'svg' && ['xmlns', 'xmlns:xlink', 'version'].includes(canon)) continue;
    if (tag === 'use' && (canon === 'href' || canon === 'xlink:href') && !String(v).trim().startsWith('#')) {
      ctx.avisos.push('<use> externo removido: só referências locais (#id) são permitidas.');
      continue;
    }
    if (tag === 'image' && (canon === 'href' || canon === 'xlink:href') && !/^\s*data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) {
      ctx.avisos.push('Imagem externa removida do SVG (apenas data:image embutido é aceito).');
      continue;
    }
    if (tag === 'svg' && (canon === 'width' || canon === 'height' || canon === 'viewBox' || canon === 'preserveAspectRatio') && prof === 0) continue; // tratados à parte
    const seguro = valorAttrSvgSeguro(canon, v, ctx.prefixoId);
    if (seguro === null) { ctx.avisos.push(`Valor inseguro em ${kRaw} removido.`); continue; }
    attrs += ` ${canon}="${escAttr(seguro)}"`;
  }
  if ((tag === 'use' || tag === 'image') && !/ (xlink:)?href="/.test(attrs)) return '';
  const autoFecha = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'stop', 'use', 'image', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feFlood', 'feComposite', 'feMergeNode', 'feDropShadow'].includes(tag);
  let corpo = '';
  const filhos = tag === 'switch' ? no.filhos.filter(f => typeof f === 'object').slice(0, 1) : no.filhos;
  for (const f of filhos) {
    if (typeof f === 'string') {
      if (['text', 'tspan', 'textPath', 'title', 'desc'].includes(tag)) corpo += escTexto(decodificarEntidades(f));
    } else if (f.cdata !== undefined) {
      if (['text', 'tspan', 'title', 'desc'].includes(tag)) corpo += escTexto(f.cdata);
    } else if (f.bruto === undefined) {
      corpo += serializarSvgNo(f, ctx, prof + 1);
    }
  }
  if (!corpo && autoFecha) return `<${tag}${attrs}/>`;
  return `<${tag}${attrs}>${corpo}</${tag}>`;
}

/**
 * Sanitiza SVG. Garante `viewBox` (calculado de width/height quando faltar) para escalar sem cortar.
 * @param {string} codigo
 * @param {{prefixoId?:string, escopoCss?:string}} [opc]
 *   `prefixoId` evita colisão de ids entre figuras; `escopoCss` prefixa os seletores de <style>.
 */
export function sanitizarSvg(codigo, { prefixoId = '', escopoCss = '' } = {}) {
  const src = String(codigo ?? '');
  const res = { ok: false, svg: '', viewBox: null, largura: 0, altura: 0, erros: [], avisos: [] };
  if (!src.trim()) { res.erros.push({ linha: 1, mensagem: 'O código SVG está vazio.' }); return res; }
  if (src.length > MAX_BYTES) { res.erros.push({ linha: 1, mensagem: 'O código SVG excede o limite de 600 KB.' }); return res; }

  const { raiz, erros } = parseMarcacao(src, { modo: 'xml' });
  res.erros.push(...erros);
  const el = raiz.filhos.filter(f => typeof f === 'object' && f.tag);
  const svgNo = el.find(f => f.tag.toLowerCase() === 'svg');
  if (!svgNo) {
    res.erros.push({ linha: 1, mensagem: 'Não foi encontrado o elemento raiz <svg>.' });
    return res;
  }
  if (el.length > 1) res.avisos.push('Há mais de um elemento na raiz; apenas o <svg> foi usado.');

  const ctx = { prefixoId, escopoCss, erros: res.erros, avisos: res.avisos, nos: 0 };
  const attrDe = (nome) => svgNo.attrs.find(([k]) => k.toLowerCase() === nome.toLowerCase())?.[1];

  // dimensões e viewBox
  let vb = null;
  const vbTxt = attrDe('viewBox');
  if (vbTxt) {
    const nums = String(vbTxt).trim().split(/[\s,]+/).map(Number);
    if (nums.length === 4 && nums.every(Number.isFinite) && nums[2] > 0 && nums[3] > 0) vb = nums;
    else res.avisos.push('viewBox inválido: recalculado a partir de width/height.');
  }
  const w = comprimentoParaPx(attrDe('width'));
  const h = comprimentoParaPx(attrDe('height'));
  if (!vb) {
    if (w > 0 && h > 0) vb = [0, 0, w, h];
    else if (w > 0) vb = [0, 0, w, w * 0.625];
    else if (h > 0) vb = [0, 0, h * 1.6, h];
    else { vb = [0, 0, 300, 150]; res.avisos.push('O SVG não tem viewBox nem width/height: foi assumido 300×150. Defina o viewBox para escalar sem cortar.'); }
  }
  res.viewBox = vb;
  res.largura = vb[2];
  res.altura = vb[3];

  const par = attrDe('preserveAspectRatio');
  const pAR = par && /^(none|x(Min|Mid|Max)Y(Min|Mid|Max))(\s+(meet|slice))?$/.test(par.trim()) ? par.trim() : 'xMidYMid meet';
  // reaproveita o serializador nos filhos (a raiz é reescrita à mão)
  const noRaiz = { ...svgNo, attrs: svgNo.attrs.filter(([k]) => !['width', 'height', 'viewbox', 'preserveaspectratio'].includes(k.toLowerCase())) };
  const interno = serializarSvgNo({ ...noRaiz, tag: 'svg' }, ctx, 0);
  // `interno` = <svg ...attrs>filhos</svg>; reabre com os atributos controlados
  const m = /^<svg([^>]*)>([\s\S]*)<\/svg>$/.exec(interno) || /^<svg([^>]*)\/>$/.exec(interno);
  const attrsRaiz = m ? m[1] : '';
  const corpo = m && m[2] !== undefined ? m[2] : '';
  res.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(x => +x.toFixed(4)).join(' ')}" preserveAspectRatio="${pAR}"${attrsRaiz}>${corpo}</svg>`;
  res.ok = !res.erros.some(e => e.nivel !== 'aviso');
  return res;
}

// ───────────────────────────── HTML ─────────────────────────────

const HTML_TAGS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup', 'mark', 'abbr', 'cite', 'code', 'kbd', 'pre', 'blockquote', 'q', 'del', 'ins', 'br', 'hr', 'wbr',
  'figure', 'figcaption', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'details', 'summary', 'label', 'img', 'style', 'svg', 'time', 'var', 'samp', 'ruby', 'rt', 'rp'
]);
const HTML_ATTRS = new Set(['class', 'id', 'style', 'title', 'lang', 'dir', 'role', 'colspan', 'rowspan', 'scope', 'headers', 'alt', 'src', 'width', 'height', 'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'start', 'reversed', 'datetime', 'span', 'open']);

function serializarHtmlNo(no, ctx, noSvg = false) {
  const baixa = no.tag.toLowerCase();
  if (baixa === 'svg') {
    // SVG embutido no HTML: passa pelo sanitizador de SVG (ids prefixados, CSS escopado)
    const reconstruido = reconstruirMarcacao(no);
    const r = sanitizarSvg(reconstruido, { prefixoId: ctx.prefixoId, escopoCss: ctx.escopoCss });
    ctx.avisos.push(...r.avisos);
    if (!r.ok) { ctx.avisos.push(`SVG embutido na linha ${no.linha} ignorado: ${r.erros[0]?.mensagem || 'inválido'}`); return ''; }
    return r.svg.replace(/^<svg /, '<svg style="max-width:100%;height:auto" ');
  }
  if (baixa === 'script' || baixa === 'iframe' || baixa === 'object' || baixa === 'embed' || baixa === 'link' || baixa === 'meta' || baixa === 'base' || baixa === 'form' || baixa === 'input' || baixa === 'button' || baixa === 'textarea' || baixa === 'select' || baixa === 'canvas' || baixa === 'video' || baixa === 'audio' || baixa === 'a' && false) {
    ctx.avisos.push(`Elemento <${no.tag}> removido por segurança (linha ${no.linha}).`);
    return '';
  }
  if (baixa === 'style') {
    const css = no.filhos.map(f => (typeof f === 'string' ? f : f.bruto ?? f.cdata ?? '')).join('');
    ctx.css.push(sanitizarCss(css, { escopo: ctx.escopoCss }));
    return '';
  }
  if (baixa === 'a') { // links viram texto: figura impressa, sem navegação
    return no.filhos.map(f => (typeof f === 'string' ? escTexto(decodificarEntidades(f)) : f.tag ? serializarHtmlNo(f, ctx) : '')).join('');
  }
  if (!HTML_TAGS.has(baixa)) {
    ctx.avisos.push(`Elemento <${no.tag}> não é suportado; o conteúdo foi mantido (linha ${no.linha}).`);
    return no.filhos.map(f => (typeof f === 'string' ? escTexto(decodificarEntidades(f)) : f.tag ? serializarHtmlNo(f, ctx) : '')).join('');
  }
  if (++ctx.nos > MAX_NOS) return '';
  let attrs = '';
  for (const [kRaw, v] of no.attrs) {
    const k = kRaw.toLowerCase();
    if (k.startsWith('on')) { ctx.avisos.push(`Atributo ${kRaw} (evento) removido.`); continue; }
    if (!HTML_ATTRS.has(k) && !k.startsWith('data-') && !k.startsWith('aria-')) continue;
    if (k.startsWith('data-ath')) continue;
    let val = String(v).replace(/[\u0000-\u001F\u007F]/g, ' ');
    if (/javascript:|vbscript:|data:text|data:application/i.test(val.replace(/\s+/g, ''))) continue;
    if (k === 'style') { val = declaracoesSeguras(val); if (!val) continue; }
    else if (k === 'src') {
      if (baixa !== 'img' || !/^\s*data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(val)) { ctx.avisos.push('Imagem externa removida: use data:image embutido.'); continue; }
      val = val.replace(/\s+/g, '');
    } else if (k === 'id' || k === 'class') {
      val = val.replace(/[^\w\s-]/g, '');
      if (k === 'id') val = ctx.prefixoId + val;
    }
    attrs += ` ${k}="${escAttr(val)}"`;
  }
  if (VOID_HTML.has(baixa)) return `<${baixa}${attrs}>`;
  const corpo = no.filhos.map(f => (typeof f === 'string' ? escTexto(decodificarEntidades(f)) : f.cdata !== undefined ? escTexto(f.cdata) : f.tag ? serializarHtmlNo(f, ctx) : '')).join('');
  return `<${baixa}${attrs}>${corpo}</${baixa}>`;
}

/** Reconstrói texto de marcação a partir da árvore (para reenviar um <svg> embutido ao sanitizador de SVG). */
function reconstruirMarcacao(no) {
  if (typeof no === 'string') return escTexto(no);
  if (no.cdata !== undefined) return `<![CDATA[${no.cdata}]]>`;
  if (no.bruto !== undefined) return no.bruto;
  const attrs = no.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
  const corpo = no.filhos.map(reconstruirMarcacao).join('');
  return corpo ? `<${no.tag}${attrs}>${corpo}</${no.tag}>` : `<${no.tag}${attrs}/>`;
}

/**
 * Sanitiza HTML+CSS para um fragmento isolado. `css` (já escopado) é devolvido à parte: o chamador o coloca
 * num <style> dentro do Shadow DOM (editor) ou escopado por atributo (PDF).
 */
export function sanitizarHtml(codigo, { escopoCss = '', prefixoId = '' } = {}) {
  const src = String(codigo ?? '');
  const res = { ok: false, html: '', css: '', erros: [], avisos: [] };
  if (!src.trim()) { res.erros.push({ linha: 1, mensagem: 'O código HTML está vazio.' }); return res; }
  if (src.length > MAX_BYTES) { res.erros.push({ linha: 1, mensagem: 'O código HTML excede o limite de 600 KB.' }); return res; }
  const { raiz, erros } = parseMarcacao(src, { modo: 'html' });
  res.erros.push(...erros);
  const ctx = { src, escopoCss, prefixoId, css: [], avisos: res.avisos, nos: 0 };
  // <html>/<body> são achatados; <head> só contribui com <style>
  const achatar = (filhos) => filhos.flatMap(f => {
    if (typeof f === 'object' && f.tag) {
      const t = f.tag.toLowerCase();
      if (t === 'html' || t === 'body') return achatar(f.filhos);
      if (t === 'head') return achatar(f.filhos.filter(x => typeof x === 'object' && x.tag && x.tag.toLowerCase() === 'style'));
      if (t === 'title') return [];
    }
    return [f];
  });
  res.html = achatar(raiz.filhos).map(f => (typeof f === 'string' ? escTexto(decodificarEntidades(f)) : f.cdata !== undefined ? escTexto(f.cdata) : f.tag ? serializarHtmlNo(f, ctx) : '')).join('').trim();
  res.css = ctx.css.filter(Boolean).join('\n');
  res.ok = !res.erros.some(e => e.nivel !== 'aviso') && res.html.length > 0;
  if (!res.html) res.erros.push({ linha: 1, mensagem: 'Nada para exibir depois da sanitização.' });
  return res;
}

// ───────────────────────────── Formatação ─────────────────────────────

/** Indenta SVG/HTML (2 espaços), uma tag por linha; texto curto permanece na mesma linha da tag. */
export function formatarMarcacao(codigo, modo = 'svg') {
  const { raiz } = parseMarcacao(String(codigo ?? ''), { modo: modo === 'html' ? 'html' : 'xml' });
  const linhas = [];
  const emitir = (no, nivel) => {
    const ind = '  '.repeat(nivel);
    if (typeof no === 'string') { const t = no.replace(/\s+/g, ' ').trim(); if (t) linhas.push(ind + escTexto(decodificarEntidades(t))); return; }
    if (no.cdata !== undefined) { linhas.push(`${ind}<![CDATA[${no.cdata}]]>`); return; }
    if (no.bruto !== undefined) {
      const corpo = no.bruto.replace(/^\s*\n|\s+$/g, '');
      corpo.split('\n').forEach(l => linhas.push(ind + '  ' + l.trim()));
      return;
    }
    const attrs = no.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
    const vazio = no.filhos.length === 0;
    const soTexto = no.filhos.length > 0 && no.filhos.every(f => typeof f === 'string') && no.filhos.join('').trim().length < 80 && !/\n/.test(no.filhos.join('').trim());
    if (vazio) { linhas.push(`${ind}<${no.tag}${attrs}${modo === 'html' && VOID_HTML.has(no.tag.toLowerCase()) ? '>' : '/>'}`); return; }
    if (soTexto) { linhas.push(`${ind}<${no.tag}${attrs}>${escTexto(decodificarEntidades(no.filhos.join('').trim()))}</${no.tag}>`); return; }
    linhas.push(`${ind}<${no.tag}${attrs}>`);
    no.filhos.forEach(f => emitir(f, nivel + 1));
    linhas.push(`${ind}</${no.tag}>`);
  };
  raiz.filhos.forEach(f => emitir(f, 0));
  return linhas.join('\n');
}
