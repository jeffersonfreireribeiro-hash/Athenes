// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarCitacaoTexto, montarCitacao, referenciaDoArtigo, estiloDoDocumento, ancoraDaReferencia, nomeMarcadorWord, indiceNaLista, ESTILOS_CITACAO, intervaloDePaginas, validarPaginas, referenciaDoBlocoCitacao } from '../src/core/athenes_citacao.js';
import { ZoteroClient } from '../src/core/athenes_zotero.js';

const dois = { id: 'a1', ano: '2025', autores: [{ sobrenome: 'Santos', prenome: 'Milton' }, { sobrenome: 'Ribeiro', prenome: 'Ana' }] };
const muitos = { id: 'a2', ano: '2020', autores: ['Silva, J.', 'Souza, M.', 'Lima, P.', 'Costa, R.'] };

test('ABNT: parêntese em maiúsculas e narrativa, com página', () => {
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'abnt' }), '(SANTOS; RIBEIRO, 2025)');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'abnt', formato: 'narrativa' }), 'Santos e Ribeiro (2025)');
  assert.equal(formatarCitacaoTexto(muitos, { estilo: 'abnt' }), '(SILVA et al., 2020)');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'abnt', pagina: '15' }), '(SANTOS; RIBEIRO, 2025, p. 15)');
});

test('APA, Harvard, Chicago, MLA', () => {
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'apa' }), '(Santos & Ribeiro, 2025)');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'apa', formato: 'narrativa' }), 'Santos e Ribeiro (2025)');
  assert.equal(formatarCitacaoTexto(muitos, { estilo: 'apa' }), '(Silva et al., 2020)');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'harvard', pagina: '3' }), '(Santos e Ribeiro, 2025, p. 3)');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'chicago' }), '(Santos e Ribeiro 2025)');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'mla', pagina: '15' }), '(Santos e Ribeiro 15)');
});

test('estilos numéricos usam a posição na lista', () => {
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'ieee', indice: 3 }), '[3]');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'vancouver', indice: 2, pagina: '9' }), '[2, p. 9]');
  assert.equal(formatarCitacaoTexto(dois, { estilo: 'abnt_numerico', indice: 1 }), '(1)');
  assert.equal(indiceNaLista({ referencias: [{ id: 'x' }, { id: 'a1' }] }, dois), 2);
  assert.equal(indiceNaLista({ referencias: [{ id: 'x' }] }, dois), 2);
});

test('citação linkada aponta para a referência e escapa o texto', () => {
  const { html, texto } = montarCitacao({ id: 'a<1>', ano: '2020', autores: [{ sobrenome: 'A&B' }] }, { estilo: 'apa', linkar: true });
  assert.match(html, /<a class="ath-citacao-link" href="#ref-a_1_"/);
  assert.match(html, /color:inherit;text-decoration:none/);
  assert.ok(html.includes('A&amp;B') && !html.includes('<1>'));
  assert.equal(texto, '(A&B, 2020)');
  assert.equal(montarCitacao(dois, { estilo: 'abnt' }).html, '(SANTOS; RIBEIRO, 2025)');
  assert.equal(montarCitacao(dois, { linkar: true, textoPronto: '(X)' }).texto, '(X)');
});

test('âncora e marcador do Word são estáveis e válidos', () => {
  assert.equal(ancoraDaReferencia(dois), 'ref-a1');
  assert.match(nomeMarcadorWord('ref-a1'), /^_ref_a1$/);
  assert.ok(nomeMarcadorWord('ref-' + 'x'.repeat(80)).length <= 40);
});

test('artigo da biblioteca vira referência mesmo com autores em lista, texto ou ausentes', () => {
  const art = { id: 'art_1', titulo: 'T', ano: 2025, autores: [{ sobrenome: 'Santos', prenome: 'Milton' }], publicacao: 'Rev', driveFileId: 'abc', resumoOriginal: 'R', fichamento: { resumoPessoal: 'x' }, palavrasChave: ['k'] };
  const r = referenciaDoArtigo(art);
  assert.deepEqual(r.autores, [{ sobrenome: 'Santos', prenome: 'Milton' }]);
  assert.equal(r.temPdf, true);
  assert.equal(r.resumo, 'R');
  assert.ok(r.fichamento);
  assert.equal(r.ano, '2025');
  assert.equal(referenciaDoArtigo({ id: 'b', autores: 'Silva, João; Maria Souza' }).autores.length, 2);
  assert.equal(referenciaDoArtigo({ id: 'c' }).autores[0].sobrenome, 'Autor');
  assert.equal(referenciaDoArtigo({ id: 'd', fichamento: { resumoPessoal: '', temas: [] } }).fichamento, '');
});

test('estilo do documento: padrão ABNT linkado e valores inválidos ignorados', () => {
  assert.deepEqual(estiloDoDocumento({}), { estilo: 'abnt', linkar: true, csl: 'associacao-brasileira-de-normas-tecnicas' });
  assert.equal(estiloDoDocumento({ estiloCitacao: { estilo: 'zzz', linkar: false } }).estilo, 'abnt');
  assert.equal(estiloDoDocumento({ estiloCitacao: { estilo: 'apa', linkar: false } }).linkar, false);
  assert.ok(ESTILOS_CITACAO.some(e => e.id === 'zotero'));
});

test('Zotero: pede a citação ao serviço e limpa o HTML; sem chave devolve vazio', async () => {
  const c = new ZoteroClient({ userId: '9', apiKey: 'k' });
  let url = '';
  const fetchImpl = async (u) => { url = u; return { ok: true, json: async () => ({ citation: '<span>(Silva &amp; Souza, 2020)</span>' }) }; };
  assert.equal(await c.obterCitacaoFormatada('ABC123', 'apa', { fetchImpl }), '(Silva & Souza, 2020)');
  assert.match(url, /users\/9\/items\/ABC123\?include=citation&style=apa/);
  assert.equal(await c.obterCitacaoFormatada('', 'apa', { fetchImpl }), '');
  assert.equal(await c.obterCitacaoFormatada('X', 'apa', { fetchImpl: async () => ({ ok: false }) }), '');
  assert.equal(await new ZoteroClient().obterCitacaoFormatada('X', 'apa', { fetchImpl }), '');
});

test('intervalo de páginas: publicação, PDF ou desconhecido', () => {
  assert.deepEqual(intervaloDePaginas({ paginas: '114-138', totalPaginas: 3 }), { min: 114, max: 138, origem: 'publicacao', texto: '114–138' });
  assert.equal(intervaloDePaginas({ paginas: '114–138' }).max, 138);
  assert.deepEqual(intervaloDePaginas({ totalPaginas: 20 }), { min: 1, max: 20, origem: 'pdf', texto: '1–20' });
  assert.equal(intervaloDePaginas({}), null);
});

test('validação da página contra o intervalo da obra', () => {
  const iv = intervaloDePaginas({ paginas: '114-138' });
  assert.equal(validarPaginas('', iv).ok, true);
  assert.equal(validarPaginas('120', iv).valor, '120');
  assert.equal(validarPaginas('120 - 122', iv).valor, '120–122');
  assert.equal(validarPaginas('120;125', iv).valor, '120, 125');
  assert.match(validarPaginas('139', iv).mensagem, /114–138/);
  assert.match(validarPaginas('100-120', iv).mensagem, /Fora do intervalo/);
  assert.match(validarPaginas('130-120', iv).mensagem, /invertido/);
  assert.equal(validarPaginas('abc', iv).ok, false);
  assert.equal(validarPaginas('999', null).ok, true);
});

test('referência da citação longa: estilo escolhido, link opcional e ABNT antigo como padrão', () => {
  assert.equal(referenciaDoBlocoCitacao({ autor: 'SILVA', ano: '2020', pagina_citada: '5' }).texto, '(SILVA, 2020, p. 5)');
  const l = referenciaDoBlocoCitacao({ ref_texto: '(Silva, 2020, p. 5)', ref_id: 'a1', ref_linkar: true });
  assert.match(l.html, /href="#ref-a1"/);
  assert.equal(referenciaDoBlocoCitacao({ ref_texto: '[3]', ref_id: 'a1', ref_linkar: false }).html, '[3]');
});

test('artigo traz os destaques do fichamento e o total de páginas', () => {
  const r = referenciaDoArtigo({ id: 'x', totalPaginas: 3, fichamento: { citacoesMarcadas: [{ id: 'c', texto: 'T', paginaCitacao: '120' }] } });
  assert.equal(r.citacoesMarcadas[0].paginaCitacao, '120');
  assert.equal(r.totalPaginas, 3);
});

test('bloco de citação longa guarda a referência escolhida e a exportação para PDF a usa', async () => {
  const { criarNovoBloco } = await import('../src/core/athenes_documento.js');
  const b = criarNovoBloco('citacao', { texto: 'Trecho', autor: 'SANTOS', ano: '2025', pagina_citada: '120', ref_texto: '(Santos & Ribeiro, 2025, p. 120)', ref_id: 'a1', ref_linkar: true });
  assert.equal(b.ref_texto, '(Santos & Ribeiro, 2025, p. 120)');
  assert.equal(b.ref_id, 'a1');
  assert.equal(criarNovoBloco('citacao', { texto: 'x' }).ref_texto, undefined);
  assert.match(referenciaDoBlocoCitacao(b).html, /href="#ref-a1"/);
});

test('achado Qodo 2: a chave do Zotero vem de chave (API), chaveZotero (documento) ou zoteroKey (biblioteca)', async () => {
  const { chaveDoZoteroDe } = await import('../src/core/athenes_citacao.js');
  assert.equal(chaveDoZoteroDe({ chave: 'ABC123', id: 'ABC123' }), 'ABC123');
  assert.equal(chaveDoZoteroDe({ chaveZotero: 'DOC1' }), 'DOC1');
  assert.equal(chaveDoZoteroDe({ zoteroKey: 'LIB1' }), 'LIB1');
  assert.equal(chaveDoZoteroDe({}), '');
  assert.equal(referenciaDoArtigo({ id: 'x', zoteroKey: 'LIB1' }).chaveZotero, 'LIB1');
});
