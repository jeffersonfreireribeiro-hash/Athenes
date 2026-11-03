// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Fragmentação de blocos entre páginas: um parágrafo ou uma tabela que não cabe no que resta da
 * página continua na seguinte (como no Word). Módulo puro: a paginação pede a divisão; editor e exportação
 * apenas desenham os fragmentos.
 *
 * Um fragmento é uma cópia rasa do bloco original com `texto`/`linhas` parciais e `_frag` com os marcadores
 * { origemId, indice, total, continuaDaAnterior, continuaNaProxima, linhaInicial }. No texto, `texto` é uma
 * propriedade que grava de volta no bloco original (editar um fragmento edita o parágrafo inteiro). Nas
 * tabelas, as linhas são as MESMAS listas do original: editar uma célula edita a tabela.
 */

const PT_POR_MM = 72 / 25.4;
const VAZIOS = new Set(['br', 'img', 'hr', 'input', 'wbr']);

/** fragmento → { origem, irmaos[] }: relação mantida fora do objeto para o JSON do documento ficar plano. */
const REGISTRO = new WeakMap();

export const ehFragmento = (b) => !!b?._frag;
export const origemDoFragmento = (b) => REGISTRO.get(b)?.origem || null;

// ───────────────────────────── HTML: texto plano e corte ─────────────────────────────

const RE_TOKEN = /(<[^>]+>)|(&[a-zA-Z#0-9]+;)|([^<&]+|&)/g;

/** Texto plano com entidades contadas como 1 caractere (mesma contagem de `dividirHtmlNoTexto`). */
export function textoPlano(html) {
  let t = '';
  for (const m of String(html ?? '').matchAll(RE_TOKEN)) { if (m[1]) continue; t += m[2] ? '\u0001' : m[3]; }
  return t;
}

/**
 * Divide um HTML inline na posição `pos` do texto plano, fechando as marcações abertas na primeira parte e
 * reabrindo-as na segunda. Retorna [antes, depois].
 */
export function dividirHtmlNoTexto(html, pos) {
  let a = ''; let n = 0; let cortou = false; const pilha = []; let b = '';
  for (const m of String(html ?? '').matchAll(RE_TOKEN)) {
    const [tok, tag, ent, txt] = m;
    if (cortou) { b += tok; continue; }
    if (tag) {
      a += tag;
      const nome = (/^<\/?\s*([a-zA-Z0-9]+)/.exec(tag) || [])[1]?.toLowerCase();
      if (!nome || VAZIOS.has(nome) || /\/>$/.test(tag)) continue;
      if (tag[1] === '/') pilha.pop(); else pilha.push({ nome, tag });
      continue;
    }
    const pedacos = ent ? [ent] : [...txt];
    for (let i = 0; i < pedacos.length; i++) {
      if (!cortou && n >= pos) {
        cortou = true;
        a += [...pilha].reverse().map(p => `</${p.nome}>`).join('');
        b = pilha.map(p => p.tag).join('') + pedacos.slice(i).join('');
        break; // o resto do texto deste pedaço já foi para `b`
      }
      if (cortou) { b += pedacos[i]; continue; }
      a += pedacos[i]; n++;
    }
  }
  if (!cortou) return [a, ''];
  return [a, b];
}

// ───────────────────────────── Parâmetros de texto ─────────────────────────────

/** Tamanho, entrelinha, espaços e caracteres por linha de um bloco de texto (ou null sem estilo). */
export function parametrosTextoPt(bloco, ctx) {
  const est = ctx.estilos[bloco.estiloId] || (bloco.tipo === 'titulo' ? ctx.estilos[`titulo${Math.min(6, bloco.nivel || 1)}`] : null) || ctx.estilos.corpo;
  if (!est) return null;
  const tam = bloco.tamanho_pt ?? est.tamanho_pt ?? 12;
  const ent = bloco.entrelinha ?? est.entrelinha ?? 1.4;
  const antes = bloco.espaco_antes_pt ?? est.espaco_antes_pt ?? 0;
  const depois = bloco.espaco_depois_pt ?? est.espaco_depois_pt ?? 0;
  const recuoMm = bloco.recuo_esquerdo_mm ?? est.recuo_esquerdo_mm ?? 0;
  const larg = Math.max(40, ctx.larguraPt * Math.min(12, Math.max(1, bloco.span || 12)) / 12 - recuoMm * PT_POR_MM);
  const largChar = tam * (est.caixa_alta ? 0.63 : 0.5) * ((est.peso || 400) >= 700 ? 1.06 : 1);
  return { tam, ent, antes, depois, porLinha: Math.max(6, Math.floor(larg / largChar)), est };
}

/** Linhas estimadas de um HTML de texto (cada <br>/fim de bloco abre uma nova linha). */
export function linhasEstimadas(html, porLinha) {
  const partes = String(html || '').replace(/<sup[^>]*>.*?<\/sup>/g, '*').split(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/i).map(t => t.replace(/<[^>]+>/g, ''));
  return partes.reduce((t, x) => t + Math.max(1, Math.ceil(x.length / porLinha)), 0);
}

// ───────────────────────────── Tabelas ─────────────────────────────

const TAM_TABELA = 9.5; const ENT_TABELA = 1.36; const PAD_TABELA = 8.4; // medido no PDF: linha simples 21,5 pt; +12,7 pt por linha extra

/** Altura estimada de uma linha da tabela (a célula mais alta decide). */
export function alturaLinhaTabelaPt(linha, bloco, larguraPt) {
  const n = Math.max(1, (bloco.colunas || linha || []).length);
  const rel = Array.isArray(bloco.larguras_relativas) && bloco.larguras_relativas.length === n ? bloco.larguras_relativas.map(Number) : Array(n).fill(1);
  const soma = rel.reduce((x, y) => x + y, 0) || 1;
  let max = 1;
  (Array.isArray(linha) ? linha : []).forEach((cel, c) => {
    const porLinha = Math.max(3, Math.floor(((larguraPt * rel[c % n]) / soma - 16) / (TAM_TABELA * 0.52)));
    max = Math.max(max, linhasEstimadas(String(cel ?? ''), porLinha));
  });
  return max * TAM_TABELA * ENT_TABELA + PAD_TABELA;
}

const ALT_TITULO = 28; const ALT_CONTINUACAO = 16; const ALT_FONTE = 22; const ALT_CONTINUA = 14;

/** Altura de uma tabela/quadro (ou de um fragmento): título só no 1º, fonte só no último, cabeçalho em todos. */
export function alturaTabelaPt(bloco, larguraPt) {
  const f = bloco._frag || {};
  const cab = bloco.com_cabecalho !== false ? alturaLinhaTabelaPt(bloco.colunas || [], bloco, larguraPt) : 0;
  const corpo = (bloco.linhas || []).reduce((t, l) => t + alturaLinhaTabelaPt(l, bloco, larguraPt), 0);
  return (f.continuaDaAnterior ? ALT_CONTINUACAO : ALT_TITULO) + cab + corpo + (f.continuaNaProxima ? ALT_CONTINUA : ALT_FONTE);
}

// ───────────────────────────── Fragmentos ─────────────────────────────

function renumerar(irmaos) {
  irmaos.forEach((f, i) => {
    f._frag = { ...(f._frag || {}), origemId: f._frag?.origemId, indice: i, total: irmaos.length, continuaDaAnterior: i > 0, continuaNaProxima: i < irmaos.length - 1 };
  });
  // nas tabelas, a numeração das linhas continua de onde o fragmento anterior parou
  let acc = 0;
  irmaos.forEach(f => { if (Array.isArray(f.linhas)) { f._frag.linhaInicial = acc; acc += f.linhas.length; } });
}

function criarFragmentoTexto(origem, irmaos, html, extra) {
  const f = { ...origem, ...extra, _frag: { origemId: origem.id } };
  let parte = html;
  Object.defineProperty(f, 'texto', {
    enumerable: true, configurable: true,
    get: () => parte,
    set: (v) => { parte = v; origem.texto = irmaos.map(x => x.texto).join(''); } // edita o parágrafo inteiro
  });
  return f;
}

/**
 * O bloco pode ser dividido entre páginas? Texto: parágrafo/citação de HTML inline simples (sem <br>, listas
 * ou blocos internos) e fora de linhas lado a lado. Tabela/quadro: 3+ linhas.
 */
export function podeDividir(b) {
  if (!b || b.grupo || (b.span && b.span < 12)) return false;
  if (b.tipo === 'paragrafo' || b.tipo === 'citacao') return !/<\s*(br|ul|ol|li|p|div|table|h[1-6])\b/i.test(b.texto || '');
  if (b.tipo === 'tabela' || b.tipo === 'quadro') return (b.linhas || []).length >= 3;
  return false;
}

function dividirTexto(b, livrePt, ctx, topoDePagina) {
  const P = parametrosTextoPt(b, ctx);
  if (!P) return null;
  const plano = textoPlano(b.texto);
  const total = Math.ceil(plano.length / P.porLinha);
  const alturaLinha = P.tam * P.ent;
  let k = Math.floor((livrePt - (topoDePagina ? 0 : P.antes)) / alturaLinha);
  if (total < 4 || k < 2) return null; // evita viúva/órfã: pelo menos 2 linhas de cada lado
  if (total - k < 2) k = total - 2;
  if (k < 2) return null;
  let corte = Math.min(plano.length - 1, k * P.porLinha);
  const espaco = plano.lastIndexOf(' ', corte);
  if (espaco > corte * 0.5) corte = espaco + 1; // quebra em palavra inteira; o espaço fica na 1ª parte
  const [a, resto] = dividirHtmlNoTexto(b.texto, corte);
  if (!textoPlano(a).trim() || !textoPlano(resto).trim()) return null;
  return { a, resto };
}

function dividirTabela(b, livrePt, ctx, topoDePagina) {
  const linhas = b.linhas || [];
  const f = b._frag || {};
  const cab = b.com_cabecalho !== false ? alturaLinhaTabelaPt(b.colunas || [], b, ctx.larguraPt) : 0;
  // folga de 10 pt: a estimativa das linhas de tabela nunca pode passar da margem inferior
  let restante = livrePt - 10 - (f.continuaDaAnterior ? ALT_CONTINUACAO : ALT_TITULO) - cab - ALT_CONTINUA;
  let k = 0;
  for (const l of linhas) {
    const h = alturaLinhaTabelaPt(l, b, ctx.larguraPt);
    if (restante - h < 0) break;
    restante -= h; k++;
  }
  if (k < 1) return null; // nem o cabeçalho com uma linha cabe: a tabela inteira vai para a próxima página
  if (linhas.length - k < 1) return null;
  if (linhas.length - k === 1 && linhas.length > 3) k -= 1; // não deixa uma única linha isolada no fim
  if (k < 1) return null;
  return { k };
}

/**
 * Divide `b` para caber em `livrePt` (altura que resta na página). Retorna { primeiro, resto } com os dois
 * fragmentos (o `resto` pode ser dividido de novo) ou null quando não vale a pena dividir.
 */
export function dividirParaPagina(b, livrePt, ctx, topoDePagina = false) {
  if (!podeDividir(b)) return null;
  const reg = REGISTRO.get(b);
  const origem = reg?.origem || b;
  const irmaos = reg?.irmaos || [b];

  let primeiro; let resto;
  if (b.tipo === 'paragrafo' || b.tipo === 'citacao') {
    const d = dividirTexto(b, livrePt, ctx, topoDePagina);
    if (!d) return null;
    primeiro = criarFragmentoTexto(origem, irmaos, d.a, { espaco_depois_pt: 0, ...(b._frag ? { recuo_primeira_linha_mm: b.recuo_primeira_linha_mm, espaco_antes_pt: b.espaco_antes_pt } : {}) });
    resto = criarFragmentoTexto(origem, irmaos, d.resto, { espaco_antes_pt: 0, recuo_primeira_linha_mm: 0, espaco_depois_pt: b.espaco_depois_pt });
  } else {
    const d = dividirTabela(b, livrePt, ctx, topoDePagina);
    if (!d) return null;
    primeiro = { ...b, linhas: b.linhas.slice(0, d.k), _frag: { origemId: origem.id } };
    resto = { ...b, linhas: b.linhas.slice(d.k), _frag: { origemId: origem.id } };
  }
  const pos = irmaos.indexOf(b);
  const lista = irmaos.slice();
  lista.splice(pos < 0 ? lista.length : pos, pos < 0 ? 0 : 1, primeiro, resto);
  // os fragmentos de texto compartilham a lista viva (a soma dos `texto` reconstrói o original)
  irmaos.length = 0; irmaos.push(...lista);
  renumerar(irmaos);
  [primeiro, resto].forEach(f => REGISTRO.set(f, { origem, irmaos }));
  return { primeiro, resto };
}

/** Marca (para os desenhos) quais fragmentos de uma página abrem/fecham uma continuação. */
export const rotuloContinuacao = (b) => (!b?._frag ? '' : (b._frag.continuaDaAnterior && b._frag.continuaNaProxima ? 'continuação' : b._frag.continuaDaAnterior ? 'conclusão' : 'continua'));
