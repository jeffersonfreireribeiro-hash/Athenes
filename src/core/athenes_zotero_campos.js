// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — "Informações" do item do Zotero: os campos de cada tipo de documento (artigo, livro, capítulo, congresso, tese,
 * relatório, página web…), com os mesmos rótulos e a mesma ordem do Zotero. Funções puras.
 */
export const TIPOS_DE_ITEM_ZOTERO = Object.freeze({
  journalArticle: 'Artigo de periódico', book: 'Livro', bookSection: 'Capítulo de livro', conferencePaper: 'Trabalho em congresso',
  thesis: 'Tese', report: 'Relatório', webpage: 'Página web', magazineArticle: 'Artigo de revista', newspaperArticle: 'Artigo de jornal',
  preprint: 'Preprint', document: 'Documento', patent: 'Patente', presentation: 'Apresentação', standard: 'Norma', dataset: 'Conjunto de dados',
  software: 'Software', map: 'Mapa', film: 'Filme', videoRecording: 'Gravação de vídeo', audioRecording: 'Gravação de áudio', interview: 'Entrevista',
  letter: 'Carta', manuscript: 'Manuscrito', artwork: 'Obra de arte', blogPost: 'Postagem de blog', encyclopediaArticle: 'Verbete de enciclopédia',
  dictionaryEntry: 'Verbete de dicionário', statute: 'Lei', case: 'Caso', hearing: 'Audiência', bill: 'Projeto de lei', email: 'E-mail',
  forumPost: 'Postagem em fórum', podcast: 'Podcast', radioBroadcast: 'Programa de rádio', tvBroadcast: 'Programa de TV', instantMessage: 'Mensagem instantânea',
  computerProgram: 'Programa de computador', attachment: 'Anexo', note: 'Nota'
});

export const ROTULOS_CAMPOS_ZOTERO = Object.freeze({
  title: 'Título', creators: 'Autores', abstractNote: 'Resumo', publicationTitle: 'Título da publicação', journalAbbreviation: 'Abreviatura do periódico',
  volume: 'Volume', issue: 'Número', pages: 'Páginas', date: 'Data', series: 'Série', seriesTitle: 'Título da série', seriesText: 'Texto da série',
  seriesNumber: 'Número da série', numberOfVolumes: 'Nº de volumes', edition: 'Edição', place: 'Lugar', publisher: 'Editora', numPages: 'Nº de páginas',
  language: 'Idioma', DOI: 'DOI', ISBN: 'ISBN', ISSN: 'ISSN', shortTitle: 'Título curto', url: 'URL', accessDate: 'Data de acesso', archive: 'Arquivo',
  archiveLocation: 'Localização no arquivo', libraryCatalog: 'Catálogo de biblioteca', callNumber: 'Número de chamada', rights: 'Licença', extra: 'Extra',
  bookTitle: 'Título do livro', proceedingsTitle: 'Título dos anais', conferenceName: 'Nome do congresso', thesisType: 'Tipo de trabalho', university: 'Universidade',
  reportNumber: 'Número do relatório', reportType: 'Tipo de relatório', institution: 'Instituição', websiteTitle: 'Título do site', websiteType: 'Tipo de site',
  section: 'Seção', blogTitle: 'Título do blog', repository: 'Repositório', archiveID: 'ID no repositório', company: 'Empresa', genre: 'Gênero',
  medium: 'Meio', system: 'Sistema', version: 'Versão', programmingLanguage: 'Linguagem de programação', type: 'Tipo', number: 'Número',
  dateAdded: 'Data de adição', dateModified: 'Data de modificação', itemType: 'Tipo do item'
});

const COMUNS_FIM = ['language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'rights', 'extra'];

/** Ordem dos campos por tipo, como no painel "Informações" do Zotero. */
export const CAMPOS_POR_TIPO = Object.freeze({
  journalArticle: ['title', 'creators', 'publicationTitle', 'date', 'volume', 'issue', 'pages', 'series', 'seriesTitle', 'seriesText', 'journalAbbreviation', 'DOI', 'ISSN', ...COMUNS_FIM],
  book: ['title', 'creators', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'date', 'numPages', 'ISBN', ...COMUNS_FIM],
  bookSection: ['title', 'creators', 'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'date', 'pages', 'ISBN', ...COMUNS_FIM],
  conferencePaper: ['title', 'creators', 'date', 'proceedingsTitle', 'conferenceName', 'place', 'publisher', 'volume', 'pages', 'series', 'DOI', 'ISBN', ...COMUNS_FIM],
  thesis: ['title', 'creators', 'thesisType', 'university', 'place', 'date', 'numPages', ...COMUNS_FIM],
  report: ['title', 'creators', 'reportNumber', 'reportType', 'seriesTitle', 'place', 'institution', 'date', 'pages', ...COMUNS_FIM],
  webpage: ['title', 'creators', 'websiteTitle', 'websiteType', 'date', ...COMUNS_FIM],
  preprint: ['title', 'creators', 'genre', 'repository', 'archiveID', 'place', 'date', 'series', 'DOI', ...COMUNS_FIM],
  magazineArticle: ['title', 'creators', 'publicationTitle', 'date', 'volume', 'issue', 'pages', 'ISSN', ...COMUNS_FIM],
  newspaperArticle: ['title', 'creators', 'publicationTitle', 'place', 'date', 'edition', 'section', 'pages', 'ISSN', ...COMUNS_FIM]
});
const ORDEM_GENERICA = ['title', 'creators', 'date', 'publisher', 'place', 'publicationTitle', 'volume', 'issue', 'pages', 'DOI', 'ISBN', 'ISSN', ...COMUNS_FIM];

export const TIPOS_DE_CRIADOR = Object.freeze({ author: 'Autor', editor: 'Editor', translator: 'Tradutor', contributor: 'Colaborador', seriesEditor: 'Editor da série', bookAuthor: 'Autor do livro', reviewedAuthor: 'Resenhado', director: 'Diretor', interviewee: 'Entrevistado', recipient: 'Destinatário', inventor: 'Inventor', programmer: 'Programador' });

const humanizar = (k) => String(k).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
const dataHora = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
const ehData = (k) => ['accessDate', 'dateAdded', 'dateModified'].includes(k);

/**
 * Linhas "rótulo → valor" para exibir as informações do item do Zotero: tipo, depois os campos preenchidos do tipo (na ordem do
 * Zotero), os criadores (um por linha, com a função) e, ao fim, datas de adição e modificação. Campos vazios não aparecem.
 */
export function linhasInformacoesZotero(art) {
  const campos = art?.camposZotero || {};
  const tipo = art?.itemTypeZotero || campos.itemType || '';
  const linhas = [];
  if (tipo) linhas.push({ rotulo: ROTULOS_CAMPOS_ZOTERO.itemType, valor: TIPOS_DE_ITEM_ZOTERO[tipo] || humanizar(tipo) });
  const ordem = CAMPOS_POR_TIPO[tipo] || ORDEM_GENERICA;
  const usados = new Set(['abstractNote', 'tags', 'collections', 'relations', 'key', 'version', 'itemType', 'dateAdded', 'dateModified', 'parentItem', 'contentType', 'filename', 'md5', 'mtime', 'linkMode']);
  const vazio = (v) => v === undefined || v === null || String(v).trim() === '';
  const criadores = Array.isArray(art?.criadores) ? art.criadores : [];
  const lin = (k, v) => linhas.push({ rotulo: ROTULOS_CAMPOS_ZOTERO[k] || humanizar(k), valor: ehData(k) ? dataHora(v) : String(v).trim() });
  for (const k of ordem) {
    usados.add(k);
    if (k === 'creators') {
      for (const c of criadores) {
        const nome = c.name || [c.lastName, c.firstName].filter(Boolean).join(', ');
        if (nome) linhas.push({ rotulo: TIPOS_DE_CRIADOR[c.creatorType] || humanizar(c.creatorType || 'author'), valor: nome });
      }
    } else if (!vazio(campos[k])) lin(k, campos[k]);
  }
  for (const [k, v] of Object.entries(campos)) { // o que o tipo não previu, mas veio preenchido
    if (usados.has(k) || vazio(v) || typeof v === 'object') continue;
    usados.add(k); lin(k, v);
  }
  for (const k of ['dateAdded', 'dateModified']) if (!vazio(campos[k])) lin(k, campos[k]);
  return linhas;
}

/**
 * Dados para o painel: os campos do Zotero quando o item veio da API; para os que vieram de .bib ou de uma sincronização antiga,
 * monta o que o artigo já tem (até a próxima sincronização trazer o item completo).
 */
export function informacoesDoArtigo(art) {
  if (art?.camposZotero && Object.keys(art.camposZotero).length) return art;
  const campos = { title: art?.titulo, publicationTitle: art?.publicacao, date: art?.ano, volume: art?.volume, issue: art?.numero, pages: art?.paginas, DOI: art?.doi, url: art?.url };
  const criadores = (art?.autores || []).map(a => ({ creatorType: 'author', lastName: a.sobrenome || '', firstName: a.prenome || '' }));
  return { itemTypeZotero: art?.itemTypeZotero || 'journalArticle', camposZotero: campos, criadores };
}
