// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Lista de referências em vários estilos (ABNT, ABNT numérico, APA 7, Harvard, Chicago autor-data, MLA, Vancouver, IEEE),
 * por tipo de obra (periódico, livro, capítulo, congresso, tese, relatório, página web). Funções puras.
 * O estilo vem do próprio bloco "Referências" ou, sem escolha, do estilo de citação do documento (o da janela do Zotero).
 */
import { ESTILOS_CITACAO, estiloDoDocumento } from './athenes_citacao.js';

/** Estilos da lista de referências (os mesmos da citação no texto; "zotero" usa o estilo CSL escolhido, traduzido para o local). */
export const ESTILOS_BIBLIOGRAFIA = Object.freeze(ESTILOS_CITACAO.filter(e => !e.externo).map(e => ({ id: e.id, rotulo: e.rotulo, numerico: e.numerico })));

const CSL_PARA_LOCAL = { 'associacao-brasileira-de-normas-tecnicas': 'abnt', apa: 'apa', 'chicago-author-date': 'chicago', 'harvard-cite-them-right': 'harvard', 'modern-language-association': 'mla', vancouver: 'vancouver', ieee: 'ieee' };
const eIdValido = (id) => ESTILOS_BIBLIOGRAFIA.some(e => e.id === id);
export const eBibliografiaNumerica = (id) => ESTILOS_BIBLIOGRAFIA.find(e => e.id === id)?.numerico === true;

/** Estilo efetivo da lista: o do bloco; senão o da citação do documento (CSL do Zotero vira o equivalente local); senão o perfil (ABNT). */
export function estiloDaBibliografia(doc, bloco = null) {
  if (eIdValido(bloco?.estilo_bibliografia)) return bloco.estilo_bibliografia;
  const e = estiloDoDocumento(doc);
  if (e.estilo === 'zotero') return CSL_PARA_LOCAL[e.csl] || 'abnt';
  if (eIdValido(e.estilo)) return e.estilo;
  return eIdValido(doc?.perfil) ? doc.perfil : 'abnt';
}

const autorObj = (a) => {
  if (typeof a === 'string') {
    const t = a.trim();
    if (t.includes(',')) { const [s, ...r] = t.split(','); return { s: s.trim(), p: r.join(',').trim() }; }
    const w = t.split(/\s+/); const s = w.pop() || ''; return { s, p: w.join(' ') };
  }
  return { s: String(a?.sobrenome || a?.lastName || a?.family || '').trim(), p: String(a?.prenome || a?.firstName || a?.given || '').trim() };
};
const iniciais = (p, ponto = true, espaco = ' ') => String(p || '').split(/[\s-]+/).filter(Boolean).map(x => x[0].toLocaleUpperCase('pt-BR') + (ponto ? '.' : '')).join(espaco);
const eAnonimo = (l) => !l.length || (l.length === 1 && /^an[ôo]nimo|^autor$/i.test(l[0].s));

/** Autores no formato do estilo, na lista de referências. */
export function autoresDoEstilo(autores, estilo) {
  const l = (Array.isArray(autores) ? autores : []).map(autorObj).filter(a => a.s);
  if (eAnonimo(l)) return '';
  const unir = (xs, ultimo) => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ultimo + xs[xs.length - 1];
  switch (estilo) {
    case 'abnt': case 'abnt_numerico': {
      const f = (a) => `${a.s.toLocaleUpperCase('pt-BR')}${a.p ? ', ' + a.p : ''}`;
      return l.length > 3 ? `${f(l[0])} et al.` : l.map(f).join('; ');
    }
    case 'apa': return unir(l.slice(0, 20).map(a => `${a.s}${a.p ? ', ' + iniciais(a.p) : ''}`), ', & ');
    case 'harvard': return unir(l.map(a => `${a.s}${a.p ? ', ' + iniciais(a.p) : ''}`), ' and ');
    case 'chicago': return unir(l.map((a, i) => i === 0 ? `${a.s}${a.p ? ', ' + a.p : ''}` : `${a.p ? a.p + ' ' : ''}${a.s}`), l.length > 2 ? ', and ' : ' and ');
    case 'mla': {
      const f = l[0]; const p = `${f.s}${f.p ? ', ' + f.p : ''}`;
      if (l.length === 1) return p;
      if (l.length === 2) return `${p}, and ${l[1].p ? l[1].p + ' ' : ''}${l[1].s}`;
      return `${p}, et al`;
    }
    case 'vancouver': { const v = l.slice(0, 6).map(a => `${a.s}${a.p ? ' ' + iniciais(a.p, false, '') : ''}`); return v.join(', ') + (l.length > 6 ? ', et al' : ''); }
    case 'ieee': { const v = l.slice(0, 6).map(a => `${a.p ? iniciais(a.p) + ' ' : ''}${a.s}`); return unir(v, v.length > 2 ? ', and ' : ' and ') + (l.length > 6 ? ' et al.' : ''); }
    default: return l.map(a => `${a.s}, ${a.p}`).join('; ');
  }
}

/** Sobrenome de ordenação (alfabética) das listas autor-data. */
const chaveOrdem = (r) => `${(autorObj(r?.autores?.[0] ?? '').s || r?.titulo || '').toLocaleLowerCase('pt-BR')}|${r?.ano || ''}|${(r?.titulo || '').toLocaleLowerCase('pt-BR')}`;

/** Autor-data: ordem alfabética. Numérico: ordem em que as obras entraram no documento (a da primeira citação). */
export function ordenarReferencias(refs, estilo) {
  const lista = [...(refs || [])];
  return eBibliografiaNumerica(estilo) ? lista : lista.sort((a, b) => chaveOrdem(a).localeCompare(chaveOrdem(b), 'pt-BR'));
}

const sufixoPonto = (t) => { const s = String(t || '').trim(); return !s ? '' : /[.!?]$/.test(s) ? s : s + '.'; };
const juntar = (...partes) => partes.filter(x => x && String(x).trim()).map(x => String(x).trim()).join(' ');
const paginasLimpas = (p) => String(p || '').replace(/^pp?\.\s*/i, '').trim();

/** Uma referência no estilo pedido. `indice` é a posição na lista (estilos numéricos). */
export function formatarReferenciaNoEstilo(ref, estilo = 'abnt', indice = 1) {
  if (!ref) return '';
  const tipo = ref.tipo || 'artigo_periodico';
  const aut = autoresDoEstilo(ref.autores, estilo);
  const ano = String(ref.ano || '').trim();
  const titulo = String(ref.titulo || 'Sem título').trim();
  const pub = String(ref.publicacao || ref.revista || ref.periodico || '').trim();
  const livroTit = String(ref.livro_titulo || ref.publicacao || '').trim();
  const ed = String(ref.editora || '').trim();
  const loc = String(ref.local || ref.cidade || '').trim();
  const vol = String(ref.volume || '').trim();
  const num = String(ref.numero || '').trim();
  const pag = paginasLimpas(ref.paginas);
  const doi = String(ref.doi || '').trim();
  const url = String(ref.url || '').trim();
  const doiUrl = doi ? `https://doi.org/${doi}` : '';
  const periodico = tipo === 'artigo_periodico';
  const capitulo = tipo === 'capitulo_livro';
  const congresso = tipo === 'trabalho_conferencia';
  const tese = tipo === 'tese_dissertacao';
  const web = tipo === 'website';
  const prefixo = estilo === 'ieee' ? `[${indice}] ` : (estilo === 'vancouver' ? `${indice}. ` : (estilo === 'abnt_numerico' ? `${indice} ` : ''));
  const R = (html) => (prefixo + html).replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/\.\./g, '.').trim();

  switch (estilo) {
    case 'abnt': case 'abnt_numerico': {
      const a = aut;
      const imprenta = `${loc ? loc + ': ' : ''}${ed ? ed + ', ' : ''}${ano || 's.d.'}.`;
      const disp = juntar(url ? `Disponível em: <${url}>.` : '', doi ? `DOI: ${doiUrl}.` : '');
      if (periodico) return R(`${sufixoPonto(a)} ${sufixoPonto(titulo)} <strong>${pub}</strong>${loc ? ', ' + loc : ''}${vol ? ', v. ' + vol : ''}${num ? ', n. ' + num : ''}${pag ? ', p. ' + pag : ''}, ${ano || 's.d.'}. ${disp}`);
      if (capitulo) return R(`${sufixoPonto(a)} ${sufixoPonto(titulo)} In: <strong>${livroTit || 'Livro'}</strong>. ${imprenta}${pag ? ' p. ' + pag + '.' : ''} ${disp}`);
      if (congresso) return R(`${sufixoPonto(a)} ${sufixoPonto(titulo)} In: <strong>${pub || 'Anais'}</strong>${ano ? ', ' + ano : ''}${loc ? ', ' + loc : ''}. ${ed ? ed + ', ' : ''}${ano || 's.d.'}.${pag ? ' p. ' + pag + '.' : ''} ${disp}`);
      if (tese) return R(`${sufixoPonto(a)} <strong>${titulo}</strong>. ${ano || 's.d.'}. Tese/Dissertação${ed ? ' – ' + ed : ''}${loc ? ', ' + loc : ''}, ${ano || 's.d.'}. ${disp}`);
      if (web) return R(`${sufixoPonto(a)} <strong>${titulo}</strong>. ${pub ? pub + ', ' : ''}${ano || 's.d.'}. ${disp}`);
      return R(`${sufixoPonto(a)} <strong>${titulo}</strong>. ${imprenta}${tipo === 'relatorio_tecnico' ? ' Relatório técnico.' : ''} ${disp}`);
    }
    case 'apa': {
      const a = aut ? `${aut}` : `<em>${titulo}</em>`;
      const dt = `(${ano || 's.d.'}).`;
      const fim = doiUrl || url;
      const cab = aut ? `${sufixoPonto(a)} ${dt}` : `${a} ${dt}`;
      if (periodico) return R(`${cab} ${sufixoPonto(titulo)} <em>${pub}</em>${vol ? ', <em>' + vol + '</em>' : ''}${num ? '(' + num + ')' : ''}${pag ? ', ' + pag : ''}. ${fim}`);
      if (capitulo) return R(`${cab} ${sufixoPonto(titulo)} In <em>${livroTit || 'Livro'}</em>${pag ? ' (pp. ' + pag + ')' : ''}. ${sufixoPonto(ed)} ${fim}`);
      if (congresso) return R(`${cab} ${sufixoPonto(titulo)} <em>${pub || 'Anais'}</em>${loc ? ', ' + loc : ''}. ${fim}`);
      if (tese) return R(`${cab} <em>${titulo}</em> [Tese/Dissertação]. ${sufixoPonto(ed)} ${fim}`);
      if (web) return R(`${cab} <em>${titulo}</em>. ${sufixoPonto(pub)} ${url}`);
      return R(`${cab} <em>${titulo}</em>. ${sufixoPonto(ed)} ${fim}`);
    }
    case 'harvard': {
      const cab = `${aut || titulo} (${ano || 's.d.'})`;
      const fim = juntar(doiUrl ? `doi: ${doi}.` : '', !doi && url ? `Available at: ${url}.` : '');
      if (periodico) return R(`${cab} '${titulo}', <em>${pub}</em>${vol ? ', ' + vol : ''}${num ? '(' + num + ')' : ''}${pag ? ', pp. ' + pag : ''}. ${fim}`);
      if (capitulo) return R(`${cab} '${titulo}', in <em>${livroTit || 'Livro'}</em>. ${loc ? loc + ': ' : ''}${sufixoPonto(ed)}${pag ? ' pp. ' + pag + '.' : ''} ${fim}`);
      if (congresso) return R(`${cab} '${titulo}', <em>${pub || 'Proceedings'}</em>${loc ? ', ' + loc : ''}${pag ? ', pp. ' + pag : ''}. ${fim}`);
      if (tese) return R(`${cab} <em>${titulo}</em>. Tese/Dissertação. ${sufixoPonto(ed)} ${fim}`);
      return R(`${cab} <em>${titulo}</em>. ${loc ? loc + ': ' : ''}${sufixoPonto(ed || pub)} ${fim}`);
    }
    case 'chicago': {
      const cab = `${sufixoPonto(aut || titulo)} ${sufixoPonto(ano || 's.d.')}`;
      const fim = doiUrl || url;
      if (periodico) return R(`${cab} “${sufixoPonto(titulo).replace(/\.$/, '.')}” <em>${pub}</em>${vol ? ' ' + vol : ''}${num ? ' (' + num + ')' : ''}${pag ? ': ' + pag : ''}. ${fim}`);
      if (capitulo) return R(`${cab} “${sufixoPonto(titulo)}” In <em>${livroTit || 'Livro'}</em>${pag ? ', ' + pag : ''}. ${loc ? loc + ': ' : ''}${sufixoPonto(ed)} ${fim}`);
      if (congresso) return R(`${cab} “${sufixoPonto(titulo)}” Paper presented at <em>${pub || 'conference'}</em>${loc ? ', ' + loc : ''}. ${fim}`);
      if (tese) return R(`${cab} <em>${titulo}</em>. Tese/Dissertação, ${sufixoPonto(ed)} ${fim}`);
      return R(`${cab} <em>${titulo}</em>. ${loc ? loc + ': ' : ''}${sufixoPonto(ed || pub)} ${fim}`);
    }
    case 'mla': {
      const cab = aut ? sufixoPonto(aut) : '';
      const fim = doiUrl || url;
      if (periodico) return R(`${cab} “${sufixoPonto(titulo)}” <em>${pub}</em>${vol ? ', vol. ' + vol : ''}${num ? ', no. ' + num : ''}${ano ? ', ' + ano : ''}${pag ? ', pp. ' + pag : ''}. ${fim}`);
      if (capitulo) return R(`${cab} “${sufixoPonto(titulo)}” <em>${livroTit || 'Livro'}</em>${ed ? ', ' + ed : ''}${ano ? ', ' + ano : ''}${pag ? ', pp. ' + pag : ''}. ${fim}`);
      if (congresso) return R(`${cab} “${sufixoPonto(titulo)}” <em>${pub || 'Conference'}</em>${ano ? ', ' + ano : ''}${loc ? ', ' + loc : ''}. ${fim}`);
      return R(`${cab} <em>${titulo}</em>. ${ed ? ed + ', ' : ''}${ano ? ano : ''}. ${fim}`);
    }
    case 'vancouver': {
      const a = sufixoPonto(aut);
      if (periodico) return R(`${a} ${sufixoPonto(titulo)} ${sufixoPonto(pub)} ${ano}${vol ? ';' + vol : ''}${num ? '(' + num + ')' : ''}${pag ? ':' + pag : ''}. ${doi ? 'doi:' + doi : ''}`);
      if (capitulo) return R(`${a} ${sufixoPonto(titulo)} In: ${sufixoPonto(livroTit || 'Livro')} ${loc ? loc + ': ' : ''}${ed}${ano ? '; ' + ano : ''}${pag ? '. p. ' + pag : ''}.`);
      if (web) return R(`${a} ${sufixoPonto(titulo)} ${sufixoPonto(pub)} ${ano ? ano + '. ' : ''}${url ? 'Available from: ' + url : ''}`);
      return R(`${a} ${sufixoPonto(titulo)} ${loc ? loc + ': ' : ''}${ed}${ano ? '; ' + ano : ''}.`);
    }
    case 'ieee': {
      const a = aut ? `${aut}, ` : '';
      const fim = doi ? ` doi: ${doi}.` : (url ? ` [Online]. Available: ${url}` : '');
      if (periodico) return R(`${a}“${titulo},” <em>${pub}</em>${vol ? ', vol. ' + vol : ''}${num ? ', no. ' + num : ''}${pag ? ', pp. ' + pag : ''}${ano ? ', ' + ano : ''}.${fim}`);
      if (capitulo || congresso) return R(`${a}“${titulo},” in <em>${livroTit || pub || 'Proceedings'}</em>${loc ? ', ' + loc : ''}${ano ? ', ' + ano : ''}${pag ? ', pp. ' + pag : ''}.${fim}`);
      if (tese) return R(`${a}“${titulo},” Tese/Dissertação, ${ed || ''}${ano ? ', ' + ano : ''}.${fim}`);
      return R(`${a}<em>${titulo}</em>. ${loc ? loc + ': ' : ''}${ed}${ano ? ', ' + ano : ''}.${fim}`);
    }
    default: return R(`${aut}. ${titulo}. ${ano}.`);
  }
}
