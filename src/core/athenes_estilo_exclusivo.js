// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Arquitetura guiada por Estilos de Texto.
 *
 * Um bloco de texto não carrega formatação visual própria: fonte, cor, alinhamento, entrelinha, espaços, recuos,
 * fundo, borda e marcadores vêm SEMPRE do estilo apontado por `estiloId` (e, dentro do texto, só de trechos
 * `<span class="ath-estilo-span" data-estilo-id="…">`, que também apontam para um estilo cadastrado).
 * Este módulo é o ponto único de saneamento: documentos e templates antigos passam por aqui ao abrir/salvar.
 */
import { CAMPOS_MARCADOR } from './athenes_marcadores.js';

/** Blocos cujo visual é inteiramente definido pelo estilo. (Em figura/tabela/quadro `fonte` é a linha "Fonte:", não tipografia.) */
export const TIPOS_BLOCO_TEXTO = Object.freeze(['paragrafo', 'texto', 'titulo', 'subtitulo', 'citacao', 'lista']);

/** Sobrescritas visuais que um bloco de texto NÃO pode mais ter. */
export const CAMPOS_FORMATACAO_DIRETA = Object.freeze([
  'alinhamento', 'fonte', 'cor', 'fundo_ativo', 'fundo_cor', 'borda_tipo', 'entrelinha', 'entrelinha_tipo', 'entrelinha_pt',
  'espaco_antes_pt', 'espaco_depois_pt', 'recuo_primeira_linha_mm', 'recuo_esquerdo_mm', 'recuo_direito_mm', 'recuo_deslocado_mm',
  'espacamento_letras_em', 'espacamento_palavras_em', 'hifenizacao', 'tamanho_pt', 'peso', 'italico', 'sublinhado', 'caixa_alta',
  ...CAMPOS_MARCADOR
]);

export const ehBlocoDeTexto = (b) => !!b && TIPOS_BLOCO_TEXTO.includes(b.tipo);

const TAGS_FORMATACAO = 'b|strong|i|em|u|s|strike|del|ins|font|mark|big|small|center|span';
const RE_ABRE_SPAN_ESTILO = /^<span\b[^>]*\bath-estilo-span\b[^>]*>$/i;

/**
 * Remove do HTML do texto toda formatação direta (negrito, itálico, sublinhado, tachado, cor, fonte, `style`, classes soltas).
 * Mantém: quebras de linha, links, índice/expoente (sup/sub, inclusive ref. de nota), citações automáticas e trechos de estilo cadastrado.
 * Os trechos `ath-estilo-span` ficam só com `data-estilo-id`; o CSS é resolvido pelo estilo na hora de desenhar.
 */
export function sanearHtmlTexto(html) {
  if (typeof html !== 'string' || !html.includes('<')) return html;
  let h = html;
  // listas HTML antigas (<ul>/<ol>/<li>) viram linhas; o marcador passa a ser do estilo
  h = h.replace(/<\/li>\s*<li\b[^>]*>/gi, '<br>').replace(/<\/?(ul|ol|li)\b[^>]*>/gi, '');
  const marcasSugestao = []; // <ins>/<del> de sugestões pendentes (data-sugestao-id) são revisão, não formatação: ficam
  h = h.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, fecha, tag, attrs) => {
    const t = tag.toLowerCase();
    if (t === 'ins' || t === 'del') {
      if (!fecha) { const guarda = /\bdata-sugestao-id\s*=/i.test(attrs); marcasSugestao.push({ t, guarda }); return guarda ? m : ''; }
      const topo = marcasSugestao.at(-1);
      if (topo?.t !== t) return '';
      marcasSugestao.pop();
      return topo.guarda ? m : '';
    }
    if (t === 'span') {
      if (fecha) return '</span>';
      if (/\bath-estilo-span\b/i.test(attrs)) {
        const id = /data-estilo-id\s*=\s*["']([\w-]{1,64})["']/i.exec(attrs)?.[1];
        return id ? `<span class="ath-estilo-span" data-estilo-id="${id}">` : '<span>';
      }
      return '<span>'; // span solto sem estilo cadastrado: só perde o visual (é removido abaixo)
    }
    if (new RegExp(`^(${TAGS_FORMATACAO})$`, 'i').test(t)) return ''; // b, i, u, s, font, mark… → descarta a tag, fica o texto
    if (fecha) return m;
    if (t === 'a') {
      const href = /href\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      const cls = /class\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      const dref = /data-ref-id\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      const alvo = /target\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      const rel = /rel\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      return `<a${cls ? ` class=${cls}` : ''}${href ? ` href=${href}` : ''}${dref ? ` data-ref-id=${dref}` : ''}${alvo ? ` target=${alvo}` : ''}${rel ? ` rel=${rel}` : ''}>`;
    }
    if (t === 'sup' || t === 'sub') {
      const cls = /class\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      const nota = /data-nota\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      const ce = /contenteditable\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs)?.[1];
      return `<${t}${cls ? ` class=${cls}` : ''}${nota ? ` data-nota=${nota}` : ''}${ce ? ` contenteditable=${ce}` : ''}>`;
    }
    if (t === 'br') return '<br>';
    if (/^(div|p)$/.test(t)) return `<${t}>`;
    return m;
  });
  // </span> órfãos de spans removidos e <span> sem estilo → desembrulha
  h = unwrapSpansSemEstilo(h);
  return h;
}

function unwrapSpansSemEstilo(h) {
  const pilha = [];
  return h.replace(/<span\b[^>]*>|<\/span>/gi, (m) => {
    if (m[1] === '/') { const manter = pilha.pop(); return manter ? m : ''; }
    const manter = RE_ABRE_SPAN_ESTILO.test(m);
    pilha.push(manter);
    return manter ? m : '';
  });
}

/** Remove os campos de formatação direta de um bloco de texto. Devolve os que existiam (para a migração decidir o que preservar). */
export function removerFormatacaoDireta(bloco) {
  const removidos = {};
  for (const k of CAMPOS_FORMATACAO_DIRETA) {
    if (k in bloco) { removidos[k] = bloco[k]; delete bloco[k]; }
  }
  return removidos;
}

/** Texto antigo com <ul>/<ol>: tipo de marcador (e numeração) que o bloco mostrava, se nenhuma sobrescrita já o dizia. */
function herdarMarcadorDeListaHtml(html, removidos) {
  if (removidos.marcador_tipo && removidos.marcador_tipo !== 'nenhum') return;
  const m = /<(ul|ol)\b([^>]*)>/i.exec(html);
  if (!m) return;
  const attr = (n) => new RegExp(String.raw`${n}\s*=\s*["']([\w-]+)["']`, 'i').exec(m[2])?.[1];
  if (m[1].toLowerCase() === 'ol') {
    removidos.marcador_tipo = 'numero';
    removidos.marcador_estilo_num = attr('data-num-estilo') || removidos.marcador_estilo_num;
    removidos.marcador_separador = attr('data-num-sep') || removidos.marcador_separador;
  } else {
    const t = attr('data-marcador');
    removidos.marcador_tipo = ['circulo', 'traco', 'quadrado', 'ponto_traco'].includes(t) ? t : 'circulo';
  }
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Bloco de texto (já saneado) → só estilo. Se o bloco tinha marcador/numeração que o estilo não tem, o significado é
 * preservado apontando para um estilo derivado cadastrado (ex.: `corpo__lista_circulo`), nunca por override local.
 */
export function sanearBlocoDeTexto(bloco, estilos) {
  if (!ehBlocoDeTexto(bloco)) return bloco;
  const removidos = removerFormatacaoDireta(bloco);
  if (typeof bloco.texto === 'string') {
    herdarMarcadorDeListaHtml(bloco.texto, removidos); // <ul>/<ol> antigos: o marcador vira propriedade do estilo
    bloco.texto = sanearHtmlTexto(bloco.texto);
  }
  if (Array.isArray(bloco.itens)) bloco.itens = bloco.itens.map(i => (typeof i === 'string' ? sanearHtmlTexto(i) : i));
  if (typeof bloco.estiloId !== 'string' || !bloco.estiloId) {
    bloco.estiloId = bloco.tipo === 'titulo' ? 'titulo1' : bloco.tipo === 'subtitulo' ? 'subtitulo' : bloco.tipo === 'citacao' ? 'citacao_direta' : 'corpo';
  }
  const tipo = removidos.marcador_tipo;
  if (Array.isArray(estilos) && tipo && tipo !== 'nenhum') {
    const base = estilos.find(e => e.id === bloco.estiloId) || estilos.find(e => e.id === 'corpo');
    if (base && base.marcador_tipo !== tipo) {
      const sufixo = `lista_${slug(tipo)}${tipo === 'numero' ? `_${slug(removidos.marcador_estilo_num || 'decimal')}_${slug(removidos.marcador_separador || 'ponto')}` : ''}`;
      const id = `${base.id}__${sufixo}`.slice(0, 64);
      if (!estilos.some(e => e.id === id)) {
        const copia = { ...JSON.parse(JSON.stringify(base)), id, nome: `${base.nome || base.id} (${tipo === 'numero' ? 'numerada' : 'com marcador'})` };
        for (const k of CAMPOS_MARCADOR) if (removidos[k] !== undefined) copia[k] = removidos[k];
        estilos.push(copia);
      }
      bloco.estiloId = id;
    }
  }
  return bloco;
}

/** Sanea todos os blocos de texto de um documento (ou de um esqueleto de template). Idempotente. Devolve o próprio objeto. */
export function sanearDocumentoEstilos(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const estilos = Array.isArray(doc.estilos) ? doc.estilos : null;
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) sanearBlocoDeTexto(b, estilos);
  }
  return doc;
}

/** CSS inline de um trecho `ath-estilo-span`, lido do estilo cadastrado (reativo: muda junto com o estilo). */
export function cssDoEstiloDeTrecho(estilo, familiaCss) {
  if (!estilo) return '';
  const p = [
    `font-family: ${familiaCss || 'sans-serif'}`,
    `font-size: ${estilo.tamanho_pt || 12}pt`,
    `font-weight: ${estilo.peso || 400}`,
    `color: ${estilo.cor || '#1F2733'}`,
    `font-style: ${estilo.italico ? 'italic' : 'normal'}`
  ];
  if (estilo.sublinhado) p.push('text-decoration: underline');
  if (estilo.caixa_alta) p.push('text-transform: uppercase');
  if (estilo.espacamento_letras_em) p.push(`letter-spacing: ${estilo.espacamento_letras_em}em`);
  return p.join('; ');
}

/** Reescreve os trechos de estilo cadastrado de um HTML, injetando o CSS do estilo atual. */
export function aplicarEstilosDeTrecho(html, estilos, familiaDe) {
  if (typeof html !== 'string' || !html.includes('ath-estilo-span')) return html;
  const mapa = new Map((estilos || []).map(e => [e.id, e]));
  return html.replace(/<span\b[^>]*\bath-estilo-span\b[^>]*>/gi, (m) => {
    const id = /data-estilo-id\s*=\s*["']([\w-]{1,64})["']/i.exec(m)?.[1];
    const est = id && mapa.get(id);
    const css = est ? cssDoEstiloDeTrecho(est, familiaDe ? familiaDe(est) : undefined) : '';
    return `<span class="ath-estilo-span" data-estilo-id="${id || ''}"${css ? ` style="${css.replace(/"/g, "'")}"` : ''}>`;
  });
}

/**
 * Única "sobrescrita" que sobrevive em tempo de desenho: a que a paginação põe num FRAGMENTO de bloco partido entre páginas
 * (continuação sem espaço antes/recuo). Não é dado do documento; bloco de texto inteiro nunca devolve nada aqui.
 */
export function ajusteDeFragmento(bloco) {
  if (!bloco?._frag) return {};
  const r = {};
  for (const k of ['espaco_antes_pt', 'espaco_depois_pt', 'recuo_primeira_linha_mm']) if (bloco[k] !== undefined) r[k] = bloco[k];
  return r;
}
