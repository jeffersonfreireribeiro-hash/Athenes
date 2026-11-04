// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoteroClient } from '../src/core/athenes_zotero.js';
import { linhasInformacoesZotero, informacoesDoArtigo } from '../src/core/athenes_zotero_campos.js';

const api = (itemType, extra = {}) => ({ key: 'AAAA1111', version: 3, data: { itemType, title: 'Título de teste', creators: [{ creatorType: 'author', lastName: 'Mercugliano', firstName: 'Alice' }, { creatorType: 'editor', lastName: 'Rossi', firstName: 'Luca' }], date: '2025-8-11', dateAdded: '2026-05-01T23:15:05Z', dateModified: '2026-05-01T23:15:05Z', ...extra } });
const linhas = (item) => linhasInformacoesZotero(new ZoteroClient().normalizarItemZotero(item));
const rot = (ls) => ls.map(l => l.rotulo);

test('artigo de periódico mostra os campos preenchidos, na ordem do Zotero', () => {
  const ls = linhas(api('journalArticle', { publicationTitle: 'Frontiers in Psychology', volume: '16', pages: '1586997', DOI: '10.3389/x', ISSN: '1664-1078', journalAbbreviation: 'Front. Psychol.', url: 'https://x.org/a', libraryCatalog: 'DOI.org (Crossref)', extra: '' }));
  assert.deepEqual(rot(ls).slice(0, 6), ['Tipo do item', 'Título', 'Autor', 'Editor', 'Título da publicação', 'Data']);
  const r = Object.fromEntries(ls.map(l => [l.rotulo, l.valor]));
  assert.equal(r['Tipo do item'], 'Artigo de periódico');
  assert.equal(r['Volume'], '16'); assert.equal(r['Páginas'], '1586997'); assert.equal(r['DOI'], '10.3389/x');
  assert.equal(r['Abreviatura do periódico'], 'Front. Psychol.');
  assert.ok(!rot(ls).includes('Extra'), 'campo vazio não aparece');
  assert.deepEqual(rot(ls).slice(-2), ['Data de adição', 'Data de modificação']);
});

test('cada tipo mostra os campos que são dele', () => {
  assert.ok(rot(linhas(api('book', { publisher: 'Paz e Terra', place: 'São Paulo', ISBN: '123', edition: '2', numPages: '200' }))).includes('Edição'));
  assert.ok(rot(linhas(api('book', { publisher: 'Paz e Terra', ISBN: '123' }))).includes('ISBN'));
  const cap = linhas(api('bookSection', { bookTitle: 'Livro X', pages: '10-20' }));
  assert.ok(rot(cap).includes('Título do livro') && cap.find(l => l.rotulo === 'Tipo do item').valor === 'Capítulo de livro');
  assert.ok(rot(linhas(api('conferencePaper', { proceedingsTitle: 'Anais', conferenceName: 'ICA 2025' }))).includes('Nome do congresso'));
  assert.ok(rot(linhas(api('thesis', { thesisType: 'Dissertação', university: 'UFC' }))).includes('Universidade'));
  assert.ok(rot(linhas(api('report', { reportNumber: '12', institution: 'IPEA' }))).includes('Instituição'));
  assert.ok(rot(linhas(api('webpage', { websiteTitle: 'Site', url: 'https://a.b' }))).includes('Título do site'));
});

test('tipo desconhecido mostra o que veio preenchido, sem perder campo', () => {
  const ls = linhas(api('patent', { assignee: 'ACME', patentNumber: 'BR123' }));
  assert.ok(ls.some(l => l.valor === 'ACME') && ls.some(l => l.valor === 'BR123'));
});

test('artigo vindo de .bib (sem campos do Zotero) ainda mostra o que tem', () => {
  const ls = linhasInformacoesZotero(informacoesDoArtigo({ titulo: 'T', ano: '2020', publicacao: 'Rev', autores: [{ sobrenome: 'Silva', prenome: 'J.' }], doi: '10.1/x' }));
  assert.ok(ls.some(l => l.rotulo === 'Autor' && l.valor === 'Silva, J.') && ls.some(l => l.rotulo === 'DOI'));
});
