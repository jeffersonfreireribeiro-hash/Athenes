// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Importador de templates .docx → template Athenes (esqueleto: estilos + mestras + seções de exemplo, sem o texto do arquivo).
 *
 * Lê word/document.xml, styles.xml, settings.xml, header/footer e as relações. Em vez de criar um estilo para
 * cada formatação encontrada (o Word acumula dezenas), agrupa por ASSINATURA TIPOGRÁFICA e consolida em poucos
 * estilos canônicos: corpo, títulos por nível, citação longa, legenda/fonte (unificados), nota de rodapé,
 * referências e capa isolada. Negrito/itálico inline NÃO viram estilo: só vale a formatação que domina o parágrafo.
 */
import { abrirZip } from './athenes_zip_leitor.js';
import { parseXml, filhos, primeiro, attr, textoDe, descendentes } from './athenes_xml_mini.js';
import { criarModelosPaginaPadrao, criarNovoBloco, criarElementoMestra, gerarId } from './athenes_documento.js';
import { sanitizarTemplate } from './athenes_templates.js';

export const MAX_ESTILOS_CANONICOS = 8;
const TW_MM = 56.693;
const mm = (tw) => Math.round((Number(tw) / TW_MM) * 10) / 10;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ligado = (no) => !!no && !['0', 'false', 'off', 'none'].includes(String(attr(no, 'w:val') ?? 'true').toLowerCase());

// ------------------------------------------------------------------ fontes

const FONTES = [
  [/times/i, 'times'], [/arial|helvetica|liberation sans/i, 'arial'], [/georgia/i, 'georgia'], [/garamond/i, 'garamond'],
  [/cambria/i, 'cambria'], [/calibri|carlito/i, 'calibri'], [/aptos/i, 'aptos'], [/consolas|courier|mono/i, 'consolas'], [/nunito/i, 'nunito']
];
const SERIFADAS = /serif|palatino|book antiqua|century|bookman|minion|baskerville|didot|constantia|cambria|garamond|georgia|times|libre baskerville|merriweather/i;

export function mapearFonteDocx(nome) {
  const n = String(nome || '').trim();
  if (!n) return { id: 'nunito', exata: true };
  for (const [re, id] of FONTES) if (re.test(n)) return { id, exata: true };
  return { id: SERIFADAS.test(n) && !/sans/i.test(n) ? 'times' : 'arial', exata: false, original: n };
}

// ------------------------------------------------------------------ leitura de propriedades

function lerPPr(pPr) {
  const o = {};
  if (!pPr) return o;
  const jc = attr(primeiro(pPr, 'w:jc'), 'w:val');
  if (jc) o.jc = jc;
  const sp = primeiro(pPr, 'w:spacing');
  if (sp) {
    o.antes = num(sp.a['w:before']); o.depois = num(sp.a['w:after']);
    o.linha = num(sp.a['w:line']); o.regraLinha = sp.a['w:lineRule'];
  }
  const ind = primeiro(pPr, 'w:ind');
  if (ind) {
    o.esq = num(ind.a['w:left'] ?? ind.a['w:start']); o.dir = num(ind.a['w:right'] ?? ind.a['w:end']);
    o.primeira = num(ind.a['w:firstLine']); o.deslocado = num(ind.a['w:hanging']);
    if (o.deslocado) o.primeira = 0;
  }
  const ol = primeiro(pPr, 'w:outlineLvl');
  if (ol) o.outline = num(attr(ol, 'w:val'));
  if (primeiro(pPr, 'w:keepNext')) o.keepNext = true;
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

function lerRPr(rPr) {
  const o = {};
  if (!rPr) return o;
  const f = primeiro(rPr, 'w:rFonts');
  if (f) { const nome = f.a['w:ascii'] || f.a['w:hAnsi'] || f.a['w:cs'] || f.a['w:eastAsia']; if (nome) o.fonte = nome; }
  const sz = primeiro(rPr, 'w:sz');
  if (sz) o.tam = num(attr(sz, 'w:val')) / 2;
  const b = primeiro(rPr, 'w:b'); if (b) o.b = ligado(b);
  const i = primeiro(rPr, 'w:i'); if (i) o.i = ligado(i);
  const u = primeiro(rPr, 'w:u'); if (u) o.u = ligado(u);
  const caps = primeiro(rPr, 'w:caps'); if (caps) o.caps = ligado(caps);
  const cor = attr(primeiro(rPr, 'w:color'), 'w:val');
  if (cor) o.cor = /^[0-9a-fA-F]{6}$/.test(cor) ? `#${cor.toUpperCase()}` : null; // 'auto' = sem cor própria
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !Number.isNaN(v)));
}

const mesclar = (...partes) => Object.assign({}, ...partes.map(p => Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v !== undefined))));

function lerEstilos(xml) {
  const raiz = parseXml(xml);
  const dd = primeiro(raiz, 'w:docDefaults');
  const padraoR = lerRPr(primeiro(primeiro(dd, 'w:rPrDefault'), 'w:rPr'));
  const padraoP = lerPPr(primeiro(primeiro(dd, 'w:pPrDefault'), 'w:pPr'));
  const mapa = new Map();
  let padraoId = null;
  for (const s of filhos(raiz, 'w:style')) {
    if (s.a['w:type'] !== 'paragraph') continue;
    const id = s.a['w:styleId'];
    mapa.set(id, { id, nome: attr(primeiro(s, 'w:name'), 'w:val') || id, baseId: attr(primeiro(s, 'w:basedOn'), 'w:val'), p: lerPPr(primeiro(s, 'w:pPr')), r: lerRPr(primeiro(s, 'w:rPr')) });
    if (s.a['w:default'] === '1') padraoId = id;
  }
  const cache = new Map();
  const resolver = (id, vistos = new Set()) => {
    if (cache.has(id)) return cache.get(id);
    const e = mapa.get(id);
    if (!e || vistos.has(id)) return {};
    vistos.add(id);
    const base = e.baseId ? resolver(e.baseId, vistos) : {};
    const r = mesclar(base, e.p, e.r);
    cache.set(id, r);
    return r;
  };
  return { mapa, padrao: mesclar(padraoP, padraoR), padraoId, resolver };
}

// ------------------------------------------------------------------ documento

function lerSecao(sectPr) {
  if (!sectPr) return null;
  const sz = primeiro(sectPr, 'w:pgSz'), mg = primeiro(sectPr, 'w:pgMar'), cols = primeiro(sectPr, 'w:cols');
  const refs = filhos(sectPr, 'w:headerReference').concat(filhos(sectPr, 'w:footerReference')).map(r => ({ tipo: r.n.includes('header') ? 'cab' : 'rod', modo: r.a['w:type'] || 'default', rid: r.a['r:id'] }));
  return {
    w: num(sz?.a['w:w']), h: num(sz?.a['w:h']), orient: sz?.a['w:orient'],
    mg: mg ? { t: num(mg.a['w:top']), r: num(mg.a['w:right']), b: num(mg.a['w:bottom']), l: num(mg.a['w:left']), cab: num(mg.a['w:header']), rod: num(mg.a['w:footer']) } : null,
    colunas: num(cols?.a['w:num']) || 1, espacoCols: num(cols?.a['w:space']), refs, tituloDistinto: !!primeiro(sectPr, 'w:titlePg')
  };
}

function analisarCorpo(xml, est) {
  const raiz = parseXml(xml);
  const corpo = primeiro(raiz, 'w:body') || raiz;
  const paragrafos = [];
  const secoes = [];
  let secaoIdx = 0, tabelas = 0, quebraPendente = false, notasRef = 0, imagens = 0;

  const processar = (p) => {
    const pPr = primeiro(p, 'w:pPr');
    const direto = lerPPr(pPr);
    const sectPr = primeiro(pPr, 'w:sectPr');
    const styleId = attr(primeiro(pPr, 'w:pStyle'), 'w:val') || est.padraoId;
    const runs = descendentes(p, 'w:r').map(r => {
      const partes = [];
      for (const f of filhos(r)) {
        if (f.n === 'w:t') partes.push({ s: textoDe(f) });
        else if (f.n === 'w:tab') partes.push({ s: '\t' });
        else if (f.n === 'w:br' && f.a['w:type'] !== 'page') partes.push({ br: true });
        else if (f.n === 'w:footnoteReference' || f.n === 'w:endnoteReference') notasRef++;
      }
      return {
        props: lerRPr(primeiro(r, 'w:rPr')), partes, texto: partes.map(x => x.s || '').join(''),
        quebra: descendentes(r, 'w:br').some(b => b.a['w:type'] === 'page')
      };
    });
    imagens += descendentes(p, 'w:drawing').length;
    const texto = runs.map(r => r.texto).join('');
    const chars = texto.replace(/\s+/g, ' ').trim().length;
    const quebraDepois = runs.some(r => r.quebra);
    // formatação que DOMINA o parágrafo (≥70% dos caracteres); trechos em negrito/itálico no meio não contam
    const dominante = {};
    if (chars) {
      for (const chave of ['fonte', 'tam', 'b', 'i', 'u', 'caps', 'cor']) {
        const pesos = new Map();
        for (const r of runs) { const n = r.texto.length; if (n) { const v = r.props[chave] === undefined ? '\u0000herda' : String(r.props[chave]); pesos.set(v, (pesos.get(v) || 0) + n); } }
        const [v, w] = [...pesos.entries()].sort((a, b) => b[1] - a[1])[0] || [];
        if (v !== undefined && v !== '\u0000herda' && w >= 0.7 * texto.length) {
          const orig = runs.find(r => String(r.props[chave]) === v)?.props[chave];
          dominante[chave] = orig;
        }
      }
    }
    const estilo = est.resolver(styleId);
    const efetivo = mesclar(est.padrao, estilo, direto, dominante);
    paragrafos.push({
      texto, chars, styleId, nomeEstilo: est.mapa.get(styleId)?.nome || styleId || '(sem estilo)', efetivo, runs,
      secaoIdx, quebraDepois: quebraDepois || quebraPendente, quebraAntes: !!primeiro(pPr, 'w:pageBreakBefore'), fimSecao: !!sectPr
    });
    quebraPendente = false;
    if (sectPr) { secoes[secaoIdx] = { ...lerSecao(sectPr), chars: 0 }; secaoIdx++; }
  };
  const visitar = (no) => {
    for (const f of filhos(no)) {
      if (f.n === 'w:p') processar(f);
      else if (f.n === 'w:tbl') tabelas++;
      else if (f.n === 'w:sdt') visitar(primeiro(f, 'w:sdtContent') || f);
    }
  };
  visitar(corpo);
  const finalSect = lerSecao(primeiro(corpo, 'w:sectPr'));
  if (finalSect) secoes[secaoIdx] = { ...finalSect, chars: 0 };
  for (const p of paragrafos) if (secoes[p.secaoIdx]) secoes[p.secaoIdx].chars += p.chars;
  return { paragrafos, secoes: secoes.filter(Boolean), tabelas, notasRef, imagens };
}

// ------------------------------------------------------------------ papéis

const modaPonderada = (itens, chave, peso) => {
  const m = new Map();
  for (const it of itens) m.set(chave(it), (m.get(chave(it)) || 0) + peso(it));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

function detectarCapa(ps) {
  const uteis = ps.filter(p => p.chars > 0);
  if (uteis.length < 4) return new Set();
  const capa = [];
  for (const p of ps) {
    if (p.chars > 250 || /^(heading|titulo \d|título \d)/i.test(semAcento(p.nomeEstilo)) || p.efetivo.outline !== undefined) { return new Set(); }
    if (p.chars > 0) capa.push(p);
    if (p.quebraDepois || p.fimSecao) return capa.length && capa.length <= 15 ? new Set(capa) : new Set();
    if (capa.length > 15) return new Set();
  }
  return new Set();
}

function classificar(ps) {
  const comTexto = ps.filter(p => p.chars > 0);
  const corpoRef = comTexto.filter(p => p.chars >= 40);
  const tamCorpo = Number(modaPonderada(corpoRef.length ? corpoRef : comTexto, p => p.efetivo.tam ?? 11, p => p.chars)) || 11;
  const capa = detectarCapa(ps);
  const out = new Map();
  const nivelNomeado = [];
  for (const p of comTexto) {
    const nome = semAcento(p.nomeEstilo);
    const e = p.efetivo;
    let papel = null, nivel = null, forma = null;
    const h = /^(heading|titulo)\s*(\d)/.exec(nome);
    if (capa.has(p)) papel = 'capa';
    else if (/^(toc|sumario|table of contents|indice|contents)/.test(nome) || /^(header|footer|cabecalho|rodape)$/.test(nome)) papel = 'ignorar';
    else if (h) { papel = 'titulo'; nivel = Math.min(6, Number(h[2])); }
    else if (e.outline !== undefined && e.outline <= 5 && p.chars <= 200) { papel = 'titulo'; nivel = e.outline + 1; }
    else if (/footnote|nota de rodape/.test(nome)) papel = 'nota';
    else if (/caption|legenda/.test(nome)) papel = 'legenda';
    else if (/bibliograph|referencia/.test(nome)) papel = 'referencias';
    else if (/quote|citacao/.test(nome)) papel = 'citacao';
    else if (/^(fonte|source)\s*:/i.test(p.texto.trim()) && p.chars <= 250) papel = 'fonte';
    else if (/^(figura|fig\.|tabela|quadro|grafico|table|figure)\s*\d+/i.test(semAcento(p.texto.trim())) && p.chars <= 160 && (e.tam ?? tamCorpo) <= tamCorpo + 0.5) papel = 'legenda';
    else if ((e.esq || 0) / TW_MM >= 20 && p.chars >= 60 && ((e.tam ?? tamCorpo) <= tamCorpo - 0.5 || e.i)) papel = 'citacao';
    else if (e.b && (e.tam ?? tamCorpo) >= tamCorpo + 1.5 && p.chars <= 140) { papel = 'titulo'; forma = 'tam'; }
    else if (e.b && p.chars <= 100 && /^\d+(\.\d+)*\.?\s+\S/.test(p.texto.trim())) { papel = 'titulo'; nivel = (p.texto.trim().match(/^\d+(\.\d+)*/)[0].split('.').length); }
    // linha curta, toda em negrito e sem ponto final: título de seção (MAIÚSCULAS = nível acima de "Mista")
    else if (e.b && p.chars >= 3 && p.chars <= 80 && !/[.:;,!?]$/.test(p.texto.trim()) && !/^[(\[]/.test(p.texto.trim())) { papel = 'titulo'; forma = p.texto.trim() === p.texto.trim().toUpperCase() && /[A-ZÀ-Ý]/.test(p.texto) ? 'caps' : 'misto'; }
    else papel = 'corpo';
    out.set(p, { papel, nivel, forma });
    if (papel === 'titulo' && nivel) nivelNomeado.push({ nivel, tam: e.tam ?? tamCorpo });
  }
  // títulos achados só pela aparência: nível pelo tamanho (o mais próximo de um título já nomeado, senão pela ordem de tamanho)
  const sem = [...out.entries()].filter(([, v]) => v.papel === 'titulo' && !v.nivel);
  if (sem.length) {
    const tamanhos = [...new Set(sem.filter(([, v]) => v.forma === 'tam').map(([p]) => Math.round((p.efetivo.tam ?? tamCorpo) * 2) / 2))].sort((a, b) => b - a);
    const base = Math.max(tamanhos.length, ...nivelNomeado.map(n => n.nivel), 0);
    for (const [p, v] of sem) {
      const t = p.efetivo.tam ?? tamCorpo;
      if (v.forma === 'caps') v.nivel = Math.min(4, base + 1);
      else if (v.forma === 'misto') v.nivel = Math.min(4, base + 2);
      else if (nivelNomeado.length) v.nivel = nivelNomeado.map(n => ({ n: n.nivel, d: Math.abs(n.tam - t) })).sort((a, b) => a.d - b.d)[0].n;
      else v.nivel = Math.min(4, tamanhos.indexOf(Math.round(t * 2) / 2) + 1);
    }
  }
  return { papeis: out, tamCorpo };
}

// ------------------------------------------------------------------ estilos canônicos

const ALINHAMENTO = { left: 'esquerda', start: 'esquerda', center: 'centro', right: 'direita', end: 'direita', both: 'justificado', distribute: 'justificado' };

function assinatura(e, tamPad) {
  return [semAcento(e.fonte || ''), Math.round((e.tam ?? tamPad) * 2) / 2, !!e.b, !!e.i, !!e.caps, e.jc || 'left', Math.round((e.esq || 0) / TW_MM / 2), Math.round((e.primeira || 0) / TW_MM), Math.round((e.deslocado || 0) / TW_MM)].join('|');
}

function estiloDe(id, nome, e, tamPad, extra = {}) {
  const tam = e.tam ?? tamPad;
  const f = mapearFonteDocx(e.fonte);
  let entrelinha = 1;
  if (e.linha) entrelinha = e.regraLinha === 'exact' || e.regraLinha === 'atLeast' ? (e.linha / 20) / tam : e.linha / 240;
  const base = {
    id, nome, tipo: 'paragrafo', fonte: f.id, tamanho_pt: tam, peso: e.b ? 700 : 400, cor: e.cor || '#1F2733',
    italico: !!e.i, sublinhado: !!e.u, caixa_alta: !!e.caps, alinhamento: ALINHAMENTO[e.jc] || 'esquerda',
    entrelinha: Math.min(3, Math.max(1, Math.round(entrelinha * 100) / 100)),
    espaco_antes_pt: Math.round((e.antes || 0) / 20 * 10) / 10, espaco_depois_pt: Math.round((e.depois || 0) / 20 * 10) / 10,
    recuo_primeira_linha_mm: mm(e.primeira || 0), recuo_esquerdo_mm: mm(e.esq || 0), recuo_deslocado_mm: mm(e.deslocado || 0),
    espacamento_letras_em: 0, hifenizacao: false, ...extra
  };
  if (e.dir) base.recuo_direito_mm = mm(e.dir);
  return { estilo: base, fonte: f };
}

export function consolidarEstilos(ps, papeis, tamCorpo, { autoHifen = false } = {}) {
  // níveis de título sempre consecutivos (1, 2, 3…), mesmo que o arquivo pule um nível
  const usados = [...new Set([...papeis.values()].filter(v => v.papel === 'titulo').map(v => v.nivel))].sort((a, b) => a - b);
  for (const v of papeis.values()) if (v.papel === 'titulo') v.nivel = usados.indexOf(v.nivel) + 1;
  const grupos = new Map(); // papel(+nivel) → paragraphs
  const tamCapa = Math.max(0, ...[...papeis].filter(([, v]) => v.papel === 'capa').map(([p]) => p.efetivo.tam ?? tamCorpo));
  for (const [p, v] of papeis) {
    if (v.papel === 'ignorar') continue;
    // a capa tem o título (maior fonte) e as informações (autores, instituição, eixo) — dois estilos, isolados do resto
    const chave = v.papel === 'titulo' ? `titulo${v.nivel}` : (v.papel === 'capa' && (p.efetivo.tam ?? tamCorpo) < tamCapa - 0.4 ? 'capa_info' : v.papel);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  }
  if (!grupos.has('corpo')) grupos.set('corpo', []);

  // texto secundário (resumo, referências…): outro tamanho, bem representado, vira um segundo estilo de corpo
  {
    const corpo = grupos.get('corpo');
    const tamDominante = Number(modaPonderada(corpo, p => Math.round((p.efetivo.tam ?? tamCorpo) * 2) / 2, p => p.chars));
    const porTam = new Map();
    for (const p of corpo) { const t = Math.round((p.efetivo.tam ?? tamCorpo) * 2) / 2; if (Math.abs(t - tamDominante) >= 1) { const g = porTam.get(t) || []; g.push(p); porTam.set(t, g); } }
    const [, maior] = [...porTam.entries()].sort((a, b) => b[1].reduce((x, p) => x + p.chars, 0) - a[1].reduce((x, p) => x + p.chars, 0))[0] || [];
    if (maior && maior.length >= 3) { grupos.set('corpo_2', maior); grupos.set('corpo', corpo.filter(p => !maior.includes(p))); }
  }

  const naoTitulo = [...grupos.keys()].filter(k => !k.startsWith('titulo') && k !== 'fonte').length + (grupos.has('fonte') && !grupos.has('legenda') ? 1 : 0);
  let niveis = [...grupos.keys()].filter(k => k.startsWith('titulo')).map(k => Number(k.slice(6))).sort((a, b) => a - b);
  const orcamento = Math.max(2, MAX_ESTILOS_CANONICOS - naoTitulo);
  const permitidos = niveis.slice(0, orcamento);
  const ultimoPermitido = permitidos.at(-1);
  for (const n of niveis.slice(orcamento)) { grupos.get(`titulo${ultimoPermitido}`).push(...grupos.get(`titulo${n}`)); grupos.delete(`titulo${n}`); }
  // sem espaço no orçamento, "referências" é tratada como corpo
  if (naoTitulo + permitidos.length > MAX_ESTILOS_CANONICOS && grupos.has('referencias')) { grupos.get('corpo').push(...grupos.get('referencias')); grupos.delete('referencias'); }
  // legenda e fonte viram UM estilo
  const unificado = [...(grupos.get('legenda') || []), ...(grupos.get('fonte') || [])];
  grupos.delete('fonte'); grupos.delete('legenda');
  if (unificado.length) grupos.set('legenda', unificado);

  const estilos = [], relatorio = [], fontesSubstituidas = new Map(), mapaParagrafo = new Map();
  const nomes = { capa_info: 'Capa — Informações', corpo_2: 'Texto Secundário', corpo: 'Corpo do Texto', citacao: 'Citação Longa', legenda: 'Legenda / Fonte', nota: 'Nota de Rodapé', referencias: 'Referências', capa: 'Capa' };
  const idDe = { capa_info: 'capa_info', corpo_2: 'corpo_2', corpo: 'corpo', citacao: 'citacao_direta', legenda: 'legenda', nota: 'nota_rodape', referencias: 'referencias', capa: 'capa' };
  const ordem = ['capa', 'capa_info', ...[...grupos.keys()].filter(k => k.startsWith('titulo')).sort(), 'corpo', 'corpo_2', 'citacao', 'legenda', 'nota', 'referencias'];

  for (const chave of ordem) {
    const lista = grupos.get(chave);
    if (!lista) continue;
    const sigs = new Map();
    for (const p of lista) {
      const s = assinatura(p.efetivo, tamCorpo);
      const g = sigs.get(s) || { peso: 0, n: 0, p };
      g.peso += Math.max(p.chars, 1); g.n++; sigs.set(s, g);
    }
    // a capa é isolada: vale o título (maior fonte), não a linha mais longa; os demais, a formatação que mais aparece
    const dominante = [...sigs.values()].sort(chave === 'capa' ? (a, b) => (b.p.efetivo.tam ?? tamCorpo) - (a.p.efetivo.tam ?? tamCorpo) : (a, b) => b.peso - a.peso)[0];
    const ehTitulo = chave.startsWith('titulo');
    const id = ehTitulo ? chave : idDe[chave];
    const nome = ehTitulo ? `Título ${chave.slice(6)}` : nomes[chave];
    const e = dominante?.p.efetivo || {};
    let { estilo, fonte } = estiloDe(id, nome, e, tamCorpo, ehTitulo ? { manter_com_proximo: true } : (chave === 'corpo' && autoHifen ? { hifenizacao: true } : {}));
    if (chave === 'legenda') estilo.nome = 'Legenda / Fonte (unificado)';
    if (ehTitulo && !e.b) estilo.peso = 600;
    if (!fonte.exata) fontesSubstituidas.set(fonte.original, fonte.id);
    estilos.push(estilo);
    lista.forEach(p => mapaParagrafo.set(p, id));
    relatorio.push({
      id, nome: estilo.nome, paragrafos: lista.length, assinaturas: sigs.size, variantesAbsorvidas: sigs.size - 1,
      origem: [...new Set(lista.map(p => p.nomeEstilo))].slice(0, 6)
    });
    if (chave === 'legenda') estilos.push({ ...estilo, id: 'fonte_citada', nome: 'Fonte (alias do estilo unificado)' });
  }
  // dois estilos com a MESMA tipografia (fonte, tamanho, peso, itálico, caixa, cor e recuos) são uma coisa só: o alinhamento e o
  // espaçamento de cada parágrafo já ficam no bloco. Fica o de maior prioridade; a capa nunca é absorvida (é isolada de propósito).
  const chaveTipografica = (e) => [e.fonte, Math.round(e.tamanho_pt * 2) / 2, e.peso >= 600, e.italico, e.caixa_alta, (e.cor || '').toLowerCase(), Math.round(e.recuo_esquerdo_mm / 5), Math.round(e.recuo_deslocado_mm / 5)].join('|');
  const prioridade = (id) => (id.startsWith('titulo') ? 0 : id === 'corpo' ? 1 : id === 'corpo_2' ? 2 : id === 'capa' ? 99 : id === 'capa_info' ? 50 : 10);
  const ordenados = [...estilos].filter(e => e.id !== 'fonte_citada').sort((a, b) => prioridade(a.id) - prioridade(b.id));
  const mantidos = new Map();
  for (const e of ordenados) {
    if (e.id === 'capa') continue;
    const k = chaveTipografica(e);
    const destino = mantidos.get(k);
    if (!destino || e.id.startsWith('titulo')) { if (!destino) mantidos.set(k, e); continue; } // níveis de título nunca se fundem entre si (estrutura/sumário)
    const rel = relatorio.find(r => r.id === destino.id), absorvido = relatorio.find(r => r.id === e.id);
    rel.paragrafos += absorvido.paragrafos;
    rel.absorveu = [...(rel.absorveu || []), absorvido.nome];
    rel.origem = [...new Set([...rel.origem, ...absorvido.origem])].slice(0, 6);
    for (const [p, id] of mapaParagrafo) if (id === e.id) mapaParagrafo.set(p, destino.id);
    estilos.splice(estilos.findIndex(x => x.id === e.id), 1);
    relatorio.splice(relatorio.findIndex(x => x.id === e.id), 1);
  }
  return { estilos, relatorio, fontesSubstituidas, mapaParagrafo };
}

// ------------------------------------------------------------------ páginas, cabeçalho e rodapé

function formatoDe(w, h) {
  const [a, b] = [Math.min(w, h), Math.max(w, h)];
  const perto = (x, y) => Math.abs(x - y) <= 80;
  if (perto(a, 11906) && perto(b, 16838)) return { formato: 'A4' };
  if (perto(a, 12240) && perto(b, 15840)) return { formato: 'Letter' };
  if (perto(a, 16838) && perto(b, 23811)) return { formato: 'A3' };
  return { formato: 'Personalizado', dimensoes_personalizadas: { w_mm: mm(a), h_mm: mm(b) } };
}

function mestraDeSecao(base, sec, hf, { hifen } = {}) {
  const m = JSON.parse(JSON.stringify(base));
  if (sec?.w && sec?.h) {
    Object.assign(m, formatoDe(sec.w, sec.h));
    m.orientacao = sec.orient === 'landscape' || sec.w > sec.h ? 'paisagem' : 'retrato';
  }
  if (sec?.mg && sec.mg.t !== undefined) m.margens_mm = { t: mm(sec.mg.t), r: mm(sec.mg.r), b: mm(sec.mg.b), l: mm(sec.mg.l) };
  if (sec?.colunas > 1) m.grade = { colunas: Math.min(4, sec.colunas), gap_mm: sec.espacoCols ? mm(sec.espacoCols) : 6 };
  else m.grade = { colunas: 1, gap_mm: 0 };
  const areaMestra = (a, distTw) => {
    if (!a) return { ativo: false, zonas: { esquerda: '', centro: '', direita: '' } };
    const f = mapearFonteDocx(a.estilo.fonte);
    return {
      ativo: true, zonas: a.zonas, multilinha: Object.values(a.zonas).some(z => z.includes('\n')), fonte: f.id, tamanho_pt: Math.min(24, Math.max(6, a.estilo.tam || 9)), peso: a.estilo.b ? 700 : 400,
      cor: a.estilo.cor || '#64748B', entrelinha: 1.2, linha_divisoria: false, distancia_borda_mm: Math.min(40, Math.max(0, mm(distTw || 0)))
    };
  };
  m.cabecalho = areaMestra(hf.cab, sec?.mg?.cab);
  m.rodape = areaMestra(hf.rod, sec?.mg?.rod);
  // o número da página vem do campo PAGE do Word: no mesmo lugar (zona e área) e só o número, como no arquivo
  const comPagina = hf.rod?.usaPagina ? ['rodape', hf.rod] : (hf.cab?.usaPagina ? ['cabecalho', hf.cab] : null);
  if (comPagina) m.numeracao_pagina = { ativo: true, local: comPagina[0], horizontal: comPagina[1].zonaPagina || 'direita', formato: 'apenas_numero', mascara: '{p}', prefixo: '', sufixo: '', estilo: 'arabico', iniciar_em: 1, continuar: true, ocultar_primeira: false };
  else m.numeracao_pagina = { ativo: false, local: 'rodape', horizontal: 'direita', formato: 'apenas_numero', mascara: '{p}', prefixo: '', sufixo: '', estilo: 'arabico', iniciar_em: 1, continuar: true, ocultar_primeira: false };
  m.elementos_recorrentes = [];
  const larg = sec?.w ? sec.w / TW_MM : 210;
  for (const img of hf.imagens || []) {
    const margL = m.margens_mm.l, margR = m.margens_mm.r;
    const largura = Math.min(img.largura_mm, larg);
    const x = img.largura_mm >= larg - 1 ? 0 : (img.alinhamento === 'direita' ? larg - margR - largura : (img.alinhamento === 'centro' ? (larg - largura) / 2 : margL));
    m.elementos_recorrentes.push(criarElementoMestra('foto_capa', {
      titulo: 'Imagem do cabeçalho', x_mm: Math.round(x * 10) / 10, y_mm: Math.round((sec?.cabY || 0) * 10) / 10, largura_mm: largura, altura_mm: img.altura_mm * (largura / img.largura_mm),
      url: img.url, sangria: false, camada: 'frente', ajuste: 'contain'
    }));
  }
  // como no Word, um cabeçalho mais alto que a margem empurra o texto para baixo da imagem
  for (const el of m.elementos_recorrentes) {
    const base = (el.y_mm || 0) + (el.altura_mm || 0);
    if (base + 3 > m.margens_mm.t) m.margens_mm.t = Math.ceil(base + 3);
  }
  void hifen;
  return m;
}

/** Texto de um parágrafo com os campos do Word trocados por variáveis do Athenes ({pagina}, {total}); o resultado em cache do campo é descartado. */
function textoComCampos(p) {
  const partes = [];
  let campo = null;
  const campoParaVariavel = (instr) => (/\bNUMPAGES\b/.test(instr) ? '{total}' : /\bPAGE\b/.test(instr) ? '{pagina}' : '');
  const visitar = (no) => {
    for (const f of filhos(no)) {
      if (f.n === 'w:fldSimple') { partes.push(campoParaVariavel(f.a['w:instr'] || '')); continue; }
      if (f.n === 'w:r') {
        for (const x of filhos(f)) {
          if (x.n === 'w:fldChar') {
            const t = x.a['w:fldCharType'];
            if (t === 'begin') campo = { instr: '', fase: 'instr' };
            else if (t === 'separate' && campo) { campo.fase = 'res'; partes.push(campoParaVariavel(campo.instr)); }
            else if (t === 'end') { if (campo?.fase === 'instr') partes.push(campoParaVariavel(campo.instr)); campo = null; }
          } else if (x.n === 'w:instrText' && campo?.fase === 'instr') campo.instr += textoDe(x);
          else if (x.n === 'w:t' && !(campo?.fase === 'res')) partes.push(textoDe(x));
          else if (x.n === 'w:tab' && !campo) partes.push('\t');
        }
      } else visitar(f); // hiperlink, sdt, ins…
    }
  };
  visitar(p);
  if (campo?.fase === 'instr') partes.push(campoParaVariavel(campo.instr)); // campo sem 'separate'/'end' (arquivo gerado por outra ferramenta)
  return partes.join('');
}

/** Cabeçalho/rodapé do Word → zonas do Athenes (uma linha por parágrafo; jc ou tabulação escolhem a zona) + tipografia. */
function areaDeParte(arvore) {
  const linhas = [];
  let estilo = null, usaPagina = false, zonaPagina = null;
  for (const p of descendentes(arvore, 'w:p')) {
    const txt = textoComCampos(p);
    if (!txt.replace(/\t/g, '').trim()) continue;
    const jc = attr(primeiro(primeiro(p, 'w:pPr'), 'w:jc'), 'w:val');
    const base = { center: 'centro', right: 'direita', end: 'direita' }[jc] || 'esquerda';
    const ordem = ['esquerda', 'centro', 'direita'];
    const linha = { esquerda: '', centro: '', direita: '' };
    let zona = ordem.indexOf(base);
    for (const pedaco of txt.split('\t')) { if (pedaco.trim()) { linha[ordem[Math.min(2, zona)]] += pedaco.trim(); } zona++; }
    if (/\{pagina\}/.test(txt)) { usaPagina = true; zonaPagina = zonaPagina || ordem.find(k => linha[k].includes('{pagina}')); }
    linhas.push(linha);
    // tipografia da área: o 1º valor encontrado de cada propriedade nos trechos do cabeçalho/rodapé (o resultado em cache de um campo costuma vir sem formatação)
    estilo = estilo || {};
    for (const r of descendentes(p, 'w:r')) for (const [k, v] of Object.entries(lerRPr(primeiro(r, 'w:rPr')))) if (estilo[k] === undefined) estilo[k] = v;
  }
  if (!linhas.length) return null;
  const zonas = {};
  for (const k of ['esquerda', 'centro', 'direita']) zonas[k] = linhas.map(l => l[k]).join('\n').replace(/\n+$/, '');
  return { zonas, usaPagina, zonaPagina, estilo: estilo || {} };
}

function bytesParaDataUrl(bytes, nome) {
  const mime = /\.png$/i.test(nome) ? 'image/png' : /\.gif$/i.test(nome) ? 'image/gif' : /\.webp$/i.test(nome) ? 'image/webp' : 'image/jpeg';
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

async function lerCabecalhoRodape(zip, sec, modoRef = 'default') {
  const r = { cab: null, rod: null, imagens: [] };
  if (!sec?.refs?.length || !zip.existe('word/_rels/document.xml.rels')) return r;
  const rels = new Map();
  for (const x of descendentes(parseXml(await zip.texto('word/_rels/document.xml.rels')), 'Relationship', [])) rels.set(x.a.Id, x.a.Target);
  for (const ref of sec.refs.filter(x => x.modo === modoRef)) {
    const alvo = rels.get(ref.rid);
    const caminho = alvo && `word/${alvo.replace(/^\/?(word\/)?/, '')}`;
    if (!caminho || !zip.existe(caminho)) continue;
    const arvore = parseXml(await zip.texto(caminho));
    const area = areaDeParte(arvore);
    if (ref.tipo === 'cab') r.cab = area;
    if (ref.tipo === 'rod') r.rod = area;
    // imagens do cabeçalho (logos, faixa da capa): tamanho em mm e alinhamento do parágrafo
    const relsImg = `word/_rels/${caminho.split('/').pop()}.rels`;
    if (ref.tipo === 'cab' && zip.existe(relsImg)) {
      const alvos = new Map(descendentes(parseXml(await zip.texto(relsImg)), 'Relationship', []).map(x => [x.a.Id, x.a.Target]));
      const parComImagem = descendentes(arvore, 'w:p').find(x => descendentes(x, 'w:drawing').length);
      const jcImg = attr(primeiro(primeiro(parComImagem, 'w:pPr'), 'w:jc'), 'w:val');
      const alinhamento = { center: 'centro', right: 'direita', end: 'direita' }[jcImg] || 'esquerda';
      for (const d of descendentes(arvore, 'w:drawing')) {
        const emb = descendentes(d, 'a:blip')[0]?.a['r:embed'];
        const ext = descendentes(d, 'wp:extent')[0];
        const alvoImg = alvos.get(emb);
        const arq = alvoImg && `word/${alvoImg.replace(/^\/?(word\/)?/, '')}`;
        if (!arq || !ext || !zip.existe(arq)) continue;
        r.imagens.push({ url: bytesParaDataUrl(await zip.ler(arq), arq), largura_mm: Math.round(Number(ext.a.cx) / 360) / 100, altura_mm: Math.round(Number(ext.a.cy) / 360) / 100, alinhamento, ancorada: !!descendentes(d, 'wp:anchor').length });
      }
    }
  }
  return r;
}

// ------------------------------------------------------------------ importação

const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML do parágrafo: negrito/itálico/sublinhado só quando o trecho difere do parágrafo (o resto vem do estilo). */
function htmlDoParagrafo(p) {
  const e = p.efetivo;
  const pedacos = [];
  for (const r of p.runs) {
    const f = { b: !!r.props.b && !e.b, i: !!r.props.i && !e.i, u: !!r.props.u && !e.u };
    for (const parte of r.partes) {
      if (parte.br) { pedacos.push({ br: true }); continue; }
      if (!parte.s) continue;
      const ult = pedacos[pedacos.length - 1];
      if (ult && !ult.br && ult.b === f.b && ult.i === f.i && ult.u === f.u) ult.s += parte.s;
      else pedacos.push({ ...f, s: parte.s });
    }
  }
  const html = pedacos.map(x => {
    if (x.br) return '<br>';
    let t = escHtml(x.s).replace(/\t/g, '&emsp;');
    if (x.u) t = `<u>${t}</u>`;
    if (x.i) t = `<em>${t}</em>`;
    if (x.b) t = `<strong>${t}</strong>`;
    return t;
  }).join('');
  return html.replace(/^(<br>)+|(<br>)+$/g, '').trim();
}

const PAGINA_QUEBRA = () => criarNovoBloco('quebra_pagina', {});

/** Blocos com o conteúdo do arquivo: capa numa seção própria, páginas separadas por quebras, cada parágrafo no seu estilo. */
function montarConteudo(paragrafos, papeis, cons, temCapa) {
  const estilosPorId = new Map(cons.estilos.map(e => [e.id, e]));
  const capa = [], corpo = [];
  let alvo = temCapa ? capa : corpo;
  let noInicio = true;
  for (const p of paragrafos) {
    const id = cons.mapaParagrafo.get(p);
    const ehCapa = temCapa && alvo === capa;
    if (p.chars === 0 || !id) {
      if (p.quebraAntes && !ehCapa && corpo.length) corpo.push(PAGINA_QUEBRA());
      if (p.quebraDepois) { if (ehCapa) alvo = corpo; else if (corpo.length) corpo.push(PAGINA_QUEBRA()); }
      continue;
    }
    noInicio = false;
    const est = estilosPorId.get(id);
    const e = p.efetivo;
    const dados = { estiloId: id, texto: htmlDoParagrafo(p), alinhamento: ALINHAMENTO[e.jc] || 'esquerda' };
    const rotulo = papeis.get(p);
    const mmv = (tw) => mm(tw || 0);
    // diferenças em relação ao estilo canônico ficam no bloco (fidelidade sem criar mais estilos)
    if (Math.abs(mmv(e.primeira) - est.recuo_primeira_linha_mm) > 0.5) dados.recuo_primeira_linha_mm = mmv(e.primeira);
    if (Math.abs(mmv(e.esq) - est.recuo_esquerdo_mm) > 0.5) dados.recuo_esquerdo_mm = mmv(e.esq);
    const antes = Math.round((e.antes || 0) / 20 * 10) / 10, depois = Math.round((e.depois || 0) / 20 * 10) / 10;
    if (Math.abs(antes - est.espaco_antes_pt) > 0.5) dados.espaco_antes_pt = antes;
    if (Math.abs(depois - est.espaco_depois_pt) > 0.5) dados.espaco_depois_pt = depois;
    const f = mapearFonteDocx(e.fonte);
    if (f.id !== est.fonte) dados.fonte = f.id;
    if (e.cor && e.cor !== est.cor) dados.cor = e.cor;
    if (e.b && est.peso < 600 && dados.texto && !/^<strong>[\s\S]*<\/strong>$/.test(dados.texto)) dados.texto = `<strong>${dados.texto}</strong>`; // negrito do parágrafo que o estilo não tem
    const bloco = rotulo?.papel === 'titulo'
      ? criarNovoBloco('titulo', { ...dados, nivel: Number(id.slice(6)) || 1 })
      : criarNovoBloco('paragrafo', dados);
    bloco.texto = dados.texto;
    alvo.push(bloco);
    if (p.quebraDepois) { if (alvo === capa) alvo = corpo; else corpo.push(PAGINA_QUEBRA()); }
  }
  void noInicio;
  return { capa, corpo };
}

const placeholders = { 1: 'Título de nível 1', 2: 'Título de nível 2', 3: 'Título de nível 3', 4: 'Título de nível 4', 5: 'Título de nível 5', 6: 'Título de nível 6' };

/** Importa o .docx (Uint8Array/ArrayBuffer) e devolve { template, relatorio }. */
export async function importarTemplateDocx(dados, { nome = '', incluirConteudo = false } = {}) {
  const zip = abrirZip(dados);
  if (!zip.existe('word/document.xml')) throw new Error('Arquivo inválido: não contém word/document.xml (não é um .docx).');
  const est = zip.existe('word/styles.xml') ? lerEstilos(await zip.texto('word/styles.xml')) : { mapa: new Map(), padrao: {}, padraoId: null, resolver: () => ({}) };
  const { paragrafos, secoes, tabelas, notasRef, imagens: imgsCorpo } = analisarCorpo(await zip.texto('word/document.xml'), est);
  const comTexto = paragrafos.filter(p => p.chars > 0);
  if (!comTexto.length) throw new Error('O documento está vazio: não há parágrafos para analisar.');

  const settings = zip.existe('word/settings.xml') ? parseXml(await zip.texto('word/settings.xml')) : null;
  const autoHifen = !!settings && ligado(primeiro(settings, 'w:autoHyphenation'));
  const { papeis, tamCorpo } = classificar(paragrafos);
  const cons = consolidarEstilos(paragrafos, papeis, tamCorpo, { autoHifen });

  // páginas: a seção com mais texto é a do corpo; a capa só tem mestra própria quando existe e difere
  const secCorpo = [...secoes].sort((a, b) => b.chars - a.chars)[0] || null;
  const temCapa = cons.estilos.some(e => e.id === 'capa');
  const secCapa = temCapa && secoes[0] && secoes[0] !== secCorpo ? secoes[0] : null;
  const base = criarModelosPaginaPadrao('abnt');
  const hfCorpo = await lerCabecalhoRodape(zip, secCorpo);
  const mestraCorpo = { ...mestraDeSecao(base.find(m => m.id === 'corpo'), secCorpo, hfCorpo), id: 'corpo', nome: 'Corpo do Texto' };
  const mestras = [];
  if (temCapa) {
    const capaBase = base.find(m => m.id === 'capa');
    const hfCapa = secCorpo?.tituloDistinto ? await lerCabecalhoRodape(zip, secCorpo, 'first') : { cab: null, rod: null, imagens: [] };
    mestras.push({ ...mestraDeSecao(capaBase, secCapa || secCorpo, hfCapa), id: 'capa', nome: 'Capa', grade: { colunas: 1, gap_mm: 0 }, posicionamento_livre: true, modo_aplicacao: capaBase.modo_aplicacao });
  }
  mestras.push(mestraCorpo);

  // seções de exemplo: um bloco por estilo canônico (mostra a identidade visual; sem texto do arquivo)
  const ids = new Set(cons.estilos.map(e => e.id));
  const blocosCorpo = [];
  for (let n = 1; n <= 6; n++) if (ids.has(`titulo${n}`)) blocosCorpo.push(criarNovoBloco('titulo', { nivel: n, texto: placeholders[n], estiloId: `titulo${n}` }));
  blocosCorpo.push(criarNovoBloco('paragrafo', { texto: 'Texto de exemplo no estilo de corpo. Substitua pelo conteúdo do seu documento.', estiloId: 'corpo' }));
  if (ids.has('citacao_direta')) blocosCorpo.push(criarNovoBloco('citacao', { texto: 'Citação longa de exemplo.', autor: 'AUTOR', ano: '2025' }));
  if (ids.has('legenda')) blocosCorpo.push(criarNovoBloco('paragrafo', { texto: 'Figura 1 — Legenda de exemplo', estiloId: 'legenda' }), criarNovoBloco('paragrafo', { texto: 'Fonte: elaborado pelo autor (2025).', estiloId: 'fonte_citada' }));
  const secoesTpl = [];
  if (incluirConteudo) {
    const { capa, corpo } = montarConteudo(paragrafos, papeis, cons, temCapa);
    if (temCapa && capa.length) secoesTpl.push({ nome: 'Capa', mestraId: 'capa', blocos: capa });
    secoesTpl.push({ nome: 'Corpo do Texto', mestraId: 'corpo', blocos: corpo.length ? corpo : blocosCorpo });
  } else {
    if (temCapa) secoesTpl.push({ nome: 'Capa', mestraId: 'capa', blocos: [criarNovoBloco('paragrafo', { texto: 'Título do documento', estiloId: 'capa' })] });
    secoesTpl.push({ nome: 'Corpo do Texto', mestraId: 'corpo', blocos: blocosCorpo });
  }

  const titulo = String(nome || '').replace(/\.docx$/i, '').trim() || 'Template importado do Word';
  const avisos = [];
  for (const [de, para] of cons.fontesSubstituidas) avisos.push(`Fonte "${de}" não está no Athenes: usada "${para}" no lugar (importe a fonte em Fontes para fidelidade total).`);
  if (tabelas) avisos.push(`${tabelas} tabela(s) ignorada(s): o template guarda só o estilo dos parágrafos, não o conteúdo.`);
  if (imgsCorpo) avisos.push(`${imgsCorpo} imagem(ns) no corpo do texto não foram importadas (só as imagens do cabeçalho).`);
  if (notasRef && incluirConteudo) avisos.push(`${notasRef} nota(s) de rodapé do arquivo não foram importadas.`);
  if (!zip.existe('word/styles.xml')) avisos.push('O arquivo não tem styles.xml: os estilos foram deduzidos só da formatação direta.');
  const original = new Set(comTexto.map(p => p.styleId)).size;
  const template = sanitizarTemplate({
    id: gerarId('tpl'), titulo, conteudoImportado: !!incluirConteudo, descricao: `Importado de Word: ${cons.estilos.filter(e => e.id !== 'fonte_citada').length} estilos canônicos a partir de ${original} estilos do arquivo.`,
    categoria: 'user_custom', perfil: 'abnt', tipoDoc: 'artigo',
    config: { pagina: { formato: mestraCorpo.formato, orientacao: mestraCorpo.orientacao, margens_mm: mestraCorpo.margens_mm }, mestras, estilos: cons.estilos },
    secoes: secoesTpl
  });
  const canonicos = cons.relatorio.length;
  return {
    template,
    relatorio: {
      paragrafos: comTexto.length, estilosNoArquivo: original,
      assinaturasDistintas: new Set(comTexto.map(p => assinatura(p.efetivo, tamCorpo))).size,
      estilosCanonicos: canonicos, estilos: cons.relatorio, fontesSubstituidas: Object.fromEntries(cons.fontesSubstituidas),
      hifenizacaoAutomatica: autoHifen, avisos
    }
  };
}
