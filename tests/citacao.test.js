// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarCitacaoTexto, montarCitacao, referenciaDoArtigo, estiloDoDocumento, ancoraDaReferencia, nomeMarcadorWord, indiceNaLista, ESTILOS_CITACAO } from '../src/core/athenes_citacao.js';
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
