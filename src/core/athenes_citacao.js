// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Citação no texto em vários estilos (ABNT, APA, Harvard, Chicago, MLA, Vancouver, IEEE), com link opcional para a
 * referência na lista, e ponte para o estilo (CSL) do próprio Zotero. Funções puras (sem DOM nem rede, exceto a do Zotero).
 */
const escaparHtml = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const ESTILOS_CITACAO = Object.freeze([
  { id: 'abnt', rotulo: 'ABNT · autor-data', numerico: false, exemplo: '(SILVA, 2020) · Silva (2020)' },
  { id: 'abnt_numerico', rotulo: 'ABNT · numérico', numerico: true, exemplo: '(1)' },
  { id: 'apa', rotulo: 'APA 7', numerico: false, exemplo: '(Silva, 2020) · Silva (2020)' },
  { id: 'harvard', rotulo: 'Harvard', numerico: false, exemplo: '(Silva, 2020) · Silva (2020)' },
  { id: 'chicago', rotulo: 'Chicago · autor-data', numerico: false, exemplo: '(Silva 2020) · Silva (2020)' },
  { id: 'mla', rotulo: 'MLA', numerico: false, exemplo: '(Silva 15) · Silva (15)' },
  { id: 'vancouver', rotulo: 'Vancouver · numérico', numerico: true, exemplo: '[1]' },
  { id: 'ieee', rotulo: 'IEEE · numérico', numerico: true, exemplo: '[1]' },
  { id: 'zotero', rotulo: 'Estilo do Zotero (CSL)', numerico: false, externo: true, exemplo: 'o que o estilo escolhido no Zotero produz' }
]);

/** Estilos CSL comuns (id do repositório de estilos do Zotero) para o modo "Estilo do Zotero". */
export const ESTILOS_CSL = Object.freeze([
  { id: 'associacao-brasileira-de-normas-tecnicas', rotulo: 'ABNT (NBR 6023/10520)' },
  { id: 'apa', rotulo: 'APA 7' },
  { id: 'chicago-author-date', rotulo: 'Chicago (autor-data)' },
  { id: 'harvard-cite-them-right', rotulo: 'Harvard (Cite Them Right)' },
  { id: 'modern-language-association', rotulo: 'MLA' },
  { id: 'vancouver', rotulo: 'Vancouver' },
  { id: 'ieee', rotulo: 'IEEE' }
]);

export const eEstiloNumerico = (id) => ESTILOS_CITACAO.find(e => e.id === id)?.numerico === true;

/** Sobrenomes dos autores, aceitando objetos Zotero ({ sobrenome|lastName|family }) e textos ("Silva, J." ou "João Silva"). */
export function sobrenomesDe(ref) {
  const lista = Array.isArray(ref?.autores) ? ref.autores : (ref?.autor ? [ref.autor] : []);
  return lista.map(a => {
    if (typeof a === 'string') {
      const virgula = a.split(',')[0].trim();
      return a.includes(',') ? virgula : (a.trim().split(/\s+/).pop() || '');
    }
    return String(a?.sobrenome || a?.lastName || a?.family || a?.nome || '').trim();
  }).filter(Boolean);
}

const maiuscula = (s) => s.toLocaleUpperCase('pt-BR');
const primeiraPalavra = (t) => String(t || 'Sem autor').trim().split(/\s+/)[0];
const comPagina = (partes, pag, prefixo = 'p. ') => [...partes, ...(pag ? [`${prefixo}${pag}`] : [])].join(', ');

/** Autores como aparecem no texto, conforme o estilo e a posição (entre parênteses ou narrativa). */
function autoresNoTexto(ref, estilo, narrativa) {
  const s = sobrenomesDe(ref);
  const n = s.length;
  if (n === 0) return estilo === 'abnt' && !narrativa ? maiuscula(primeiraPalavra(ref?.titulo)) : primeiraPalavra(ref?.titulo);
  const e = narrativa ? ' e ' : ' & ';
  switch (estilo) {
    case 'abnt':
      if (narrativa) return n === 1 ? s[0] : n === 2 ? `${s[0]} e ${s[1]}` : n === 3 ? `${s[0]}, ${s[1]} e ${s[2]}` : `${s[0]} et al.`;
      return n <= 3 ? s.map(maiuscula).join('; ') : `${maiuscula(s[0])} et al.`;
    case 'apa':
      return n === 1 ? s[0] : n === 2 ? `${s[0]}${e}${s[1]}` : `${s[0]} et al.`;
    case 'harvard':
      return n === 1 ? s[0] : n === 2 ? `${s[0]} e ${s[1]}` : n === 3 ? `${s[0]}, ${s[1]} e ${s[2]}` : `${s[0]} et al.`;
    case 'chicago':
      return n === 1 ? s[0] : n === 2 ? `${s[0]} e ${s[1]}` : n === 3 ? `${s[0]}, ${s[1]} e ${s[2]}` : `${s[0]} et al.`;
    case 'mla':
      return n === 1 ? s[0] : n === 2 ? `${s[0]} e ${s[1]}` : `${s[0]} et al.`;
    default:
      return s[0];
  }
}

/**
 * Texto da citação (sem marcação).
 *  - formato: 'parentese' → (SILVA, 2020) / 'narrativa' → Silva (2020); estilos numéricos ignoram o formato
 *  - pagina: opcional ("15" ou "15-17"); indice: posição da obra na lista de referências (estilos numéricos)
 */
export function formatarCitacaoTexto(ref, { estilo = 'abnt', formato = 'parentese', pagina = '', indice = 1 } = {}) {
  const ano = ref?.ano || 's.d.';
  const pag = String(pagina || '').trim();
  const narrativa = formato === 'narrativa';
  switch (estilo) {
    case 'abnt_numerico': return `(${comPagina([String(indice)], pag)})`;
    case 'vancouver':
    case 'ieee': return `[${comPagina([String(indice)], pag)}]`;
    case 'mla': {
      const autor = autoresNoTexto(ref, 'mla', narrativa);
      return narrativa ? (pag ? `${autor} (${pag})` : autor) : `(${[autor, pag].filter(Boolean).join(' ')})`;
    }
    case 'chicago': {
      const autor = autoresNoTexto(ref, 'chicago', narrativa);
      return narrativa ? `${autor} (${comPagina([ano], pag, '')})` : `(${autor} ${comPagina([ano], pag, '')})`;
    }
    case 'abnt': case 'apa': case 'harvard': default: {
      const e = ['abnt', 'apa', 'harvard'].includes(estilo) ? estilo : 'abnt';
      const autor = autoresNoTexto(ref, e, narrativa);
      return narrativa ? `${autor} (${comPagina([ano], pag)})` : `(${comPagina([autor, ano], pag)})`;
    }
  }
}

/** Identificador estável do alvo do link (a entrada da referência na lista). */
export const ancoraDaReferencia = (ref) => `ref-${String(ref?.id || ref?.chaveZotero || 'sem-id').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40)}`;

/** Nome do marcador (bookmark) do Word equivalente à âncora: só letras, números e sublinhado, até 40 caracteres. */
export const nomeMarcadorWord = (ancora) => `_${String(ancora).replace(/[^A-Za-z0-9_]/g, '_')}`.slice(0, 40);

/**
 * Citação pronta para inserir: { texto, html }. Com `linkar`, o `html` é um link interno para a referência na lista
 * (sem aparência de link: herda cor e sem sublinhado, para não mudar a tipografia da página).
 */
export function montarCitacao(ref, opcoes = {}) {
  const texto = opcoes.textoPronto || formatarCitacaoTexto(ref, opcoes);
  if (!opcoes.linkar) return { texto, html: escaparHtml(texto) };
  const ancora = ancoraDaReferencia(ref);
  return { texto, html: `<a class="ath-citacao-link" href="#${ancora}" data-ref-id="${escaparHtml(String(ref?.id || ref?.chaveZotero || ''))}" style="color:inherit;text-decoration:none;">${escaparHtml(texto)}</a>` };
}

/** Posição (1-based) da obra na lista de referências do documento (estilos numéricos). */
export function indiceNaLista(doc, ref) {
  const i = (doc?.referencias || []).findIndex(r => (r.id && r.id === ref.id) || (chaveDoZoteroDe(r) && chaveDoZoteroDe(r) === chaveDoZoteroDe(ref)));
  return i >= 0 ? i + 1 : (doc?.referencias?.length || 0) + 1;
}

/** Chave do item no Zotero, venha ele da API (`chave`), do documento (`chaveZotero`) ou da biblioteca (`zoteroKey`). */
export const chaveDoZoteroDe = (ref) => String(ref?.chaveZotero || ref?.chave || ref?.zoteroKey || '');

const ESTILO_PADRAO = Object.freeze({ estilo: 'abnt', linkar: true, csl: 'associacao-brasileira-de-normas-tecnicas' });

/** Escolha de estilo guardada no documento (padrão: ABNT, com a citação linkada à referência). */
export function estiloDoDocumento(doc) {
  const e = doc?.estiloCitacao || {};
  return {
    estilo: ESTILOS_CITACAO.some(x => x.id === e.estilo) ? e.estilo : ESTILO_PADRAO.estilo,
    linkar: e.linkar === undefined ? ESTILO_PADRAO.linkar : Boolean(e.linkar),
    csl: ESTILOS_CSL.some(x => x.id === e.csl) ? e.csl : ESTILO_PADRAO.csl
  };
}

const paraAutor = (a) => {
  if (a && typeof a === 'object') return { sobrenome: String(a.sobrenome || a.lastName || a.family || '').trim(), prenome: String(a.prenome || a.firstName || a.given || '').trim() };
  const t = String(a || '').trim();
  if (t.includes(',')) { const [sob, ...resto] = t.split(','); return { sobrenome: sob.trim(), prenome: resto.join(',').trim() }; }
  const p = t.split(/\s+/);
  return { sobrenome: p.pop() || '', prenome: p.join(' ') };
};

/** Converte um artigo da biblioteca de leitura em referência do documento (autores sempre como lista de objetos). */
export function referenciaDoArtigo(a) {
  const bruto = Array.isArray(a?.autores) ? a.autores : (typeof a?.autores === 'string' ? a.autores.split(/;|\se\s/) : (a?.autor ? [a.autor] : []));
  const autores = bruto.map(paraAutor).filter(x => x.sobrenome);
  const ficha = a?.fichamento && typeof a.fichamento === 'object'
    ? Object.values(a.fichamento).some(v => (Array.isArray(v) ? v.length : String(v || '').trim()))
    : Boolean(a?.fichamento);
  return {
    id: String(a?.id || a?.zoteroKey || ''),
    chaveZotero: chaveDoZoteroDe(a),
    titulo: a?.titulo || 'Artigo sem título',
    autores: autores.length ? autores : [{ sobrenome: 'Autor', prenome: '' }],
    ano: String(a?.ano || ''),
    publicacao: a?.publicacao || a?.periodico || a?.categoria || '',
    volume: a?.volume || '', numero: a?.numero || '', paginas: a?.paginas || '', doi: a?.doi || '',
    tipo: 'artigo',
    temPdf: Boolean(a?.pdfUrl || a?.driveFileId || a?.driveArquivoId),
    fichamento: ficha ? a.fichamento : '',
    resumo: a?.resumoOriginal || a?.resumo || '',
    totalPaginas: Number(a?.totalPaginas) || 0,
    citacoesMarcadas: a?.fichamento?.citacoesMarcadas || a?.citacoesMarcadas || [],
    palavrasChave: Array.isArray(a?.palavrasChave) ? a.palavrasChave : (a?.tags || [])
  };
}

/**
 * Intervalo de páginas que a obra permite citar: o das páginas da publicação (ex.: "114-138") ou, sem ele,
 * o do PDF vinculado (1 a N). Devolve null quando não há como saber.
 */
export function intervaloDePaginas(ref) {
  const m = /(\d+)\D+(\d+)/.exec(String(ref?.paginas || ''));
  if (m && Number(m[1]) <= Number(m[2])) return { min: Number(m[1]), max: Number(m[2]), origem: 'publicacao', texto: `${m[1]}–${m[2]}` };
  const n = Number(ref?.totalPaginas);
  if (n >= 1) return { min: 1, max: n, origem: 'pdf', texto: n === 1 ? '1' : `1–${n}` };
  return null;
}

/** Confere a página digitada ("15", "15-17" ou "15, 17") contra o intervalo da obra; vazio é válido (página opcional). */
export function validarPaginas(valor, intervalo) {
  const v = String(valor ?? '').trim();
  if (!v) return { ok: true, valor: '' };
  const partes = v.split(/\s*[,;]\s*/);
  for (const p of partes) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(p);
    if (!m) return { ok: false, mensagem: 'Use só números: 15, 15-17 ou 15, 17' };
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (b < a) return { ok: false, mensagem: 'O intervalo está invertido' };
    if (intervalo && (a < intervalo.min || b > intervalo.max)) return { ok: false, mensagem: `Fora do intervalo da obra (${intervalo.texto})` };
  }
  return { ok: true, valor: v.replace(/\s*[-–]\s*/g, '–').replace(/\s*[,;]\s*/g, ', ') };
}

/** Referência exibida depois de uma citação longa (bloco `citacao`): a do estilo escolhido, linkada se pedido; antiga em ABNT se não houver. */
export function referenciaDoBlocoCitacao(b) {
  const texto = b?.ref_texto || `(${b?.autor || 'AUTOR'}, ${b?.ano || 's.d.'}${b?.pagina_citada ? ', p. ' + b.pagina_citada : ''})`;
  if (!b?.ref_texto || !b.ref_linkar || !b.ref_id) return { texto, html: escaparHtml(texto) };
  return { texto, html: `<a class="ath-citacao-link" href="#${ancoraDaReferencia({ id: b.ref_id })}" data-ref-id="${escaparHtml(String(b.ref_id))}" style="color:inherit;text-decoration:none;">${escaparHtml(texto)}</a>` };
}
