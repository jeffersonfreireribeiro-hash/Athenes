// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTILOS_BIBLIOGRAFIA, estiloDaBibliografia, ordenarReferencias, formatarReferenciaNoEstilo } from '../src/core/athenes_bibliografia_estilos.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo } from '../src/core/athenes_pacote_estilo.js';

const artigo = { id: 'a', tipo: 'artigo_periodico', autores: [{ sobrenome: 'Badino', prenome: 'Elena' }, { sobrenome: 'Shtrepi', prenome: 'Louena' }], titulo: 'Acoustic design', publicacao: 'Applied Acoustics', ano: '2020', volume: '12', numero: '3', paginas: '10-20', doi: '10.1/x' };
const livro = { id: 'l', tipo: 'livro', autores: [{ sobrenome: 'Freire', prenome: 'Paulo' }], titulo: 'Pedagogia da Autonomia', local: 'São Paulo', editora: 'Paz e Terra', ano: '1996' };

test('os oito estilos formatam todos os tipos de obra sem deixar lixo (undefined, [object])', () => {
  const tipos = ['artigo_periodico', 'livro', 'capitulo_livro', 'trabalho_conferencia', 'tese_dissertacao', 'relatorio_tecnico', 'website'];
  assert.equal(ESTILOS_BIBLIOGRAFIA.length, 8);
  for (const e of ESTILOS_BIBLIOGRAFIA) for (const tipo of tipos) {
    const t = formatarReferenciaNoEstilo({ ...artigo, tipo, livro_titulo: 'Livro X', url: 'https://x.org' }, e.id, 2);
    assert.ok(t.length > 20 && !/undefined|null|\[object/.test(t), `${e.id}/${tipo}: ${t}`);
    assert.ok(t.includes('Acoustic design'), `${e.id}/${tipo} traz o título`);
  }
});

test('cada estilo segue a sua convenção de autores e pontuação', () => {
  assert.match(formatarReferenciaNoEstilo(artigo, 'abnt'), /^BADINO, Elena; SHTREPI, Louena\. Acoustic design\. <strong>Applied Acoustics<\/strong>, v\. 12, n\. 3, p\. 10-20, 2020\./);
  assert.match(formatarReferenciaNoEstilo(artigo, 'apa'), /^Badino, E\., & Shtrepi, L\. \(2020\)\. Acoustic design\. <em>Applied Acoustics<\/em>, <em>12<\/em>\(3\), 10-20\./);
  assert.match(formatarReferenciaNoEstilo(artigo, 'vancouver', 4), /^4\. Badino E, Shtrepi L\. Acoustic design\. Applied Acoustics\. 2020;12\(3\):10-20/);
  assert.match(formatarReferenciaNoEstilo(artigo, 'ieee', 4), /^\[4\] E\. Badino and L\. Shtrepi, “Acoustic design,” <em>Applied Acoustics<\/em>, vol\. 12, no\. 3, pp\. 10-20, 2020\./);
  assert.match(formatarReferenciaNoEstilo(livro, 'chicago'), /^Freire, Paulo\. 1996\. <em>Pedagogia da Autonomia<\/em>\. São Paulo: Paz e Terra\./);
  assert.match(formatarReferenciaNoEstilo(livro, 'mla'), /^Freire, Paulo\. <em>Pedagogia da Autonomia<\/em>\. Paz e Terra, 1996\./);
});

test('estilo da lista: o do bloco, senão o da citação do documento (CSL do Zotero vira o equivalente)', () => {
  const doc = criarDocumento();
  assert.equal(estiloDaBibliografia(doc, null), 'abnt');
  doc.estiloCitacao = { estilo: 'apa' };
  assert.equal(estiloDaBibliografia(doc, {}), 'apa');
  assert.equal(estiloDaBibliografia(doc, { estilo_bibliografia: 'ieee' }), 'ieee');
  doc.estiloCitacao = { estilo: 'zotero', csl: 'modern-language-association' };
  assert.equal(estiloDaBibliografia(doc, {}), 'mla');
});

test('autor-data em ordem alfabética; numérico na ordem de citação', () => {
  const lista = [livro, artigo];
  assert.deepEqual(ordenarReferencias(lista, 'apa').map(r => r.id), ['a', 'l']);
  assert.deepEqual(ordenarReferencias(lista, 'ieee').map(r => r.id), ['l', 'a']);
});

test('o PDF monta a lista no estilo escolhido', () => {
  const doc = criarDocumento();
  doc.referencias = [livro, artigo];
  const sec = doc.secoes.find(s => s.blocos.some(b => b.tipo === 'referencias')) || doc.secoes[doc.secoes.length - 1];
  if (!sec.blocos.some(b => b.tipo === 'referencias')) sec.blocos.push(criarNovoBloco('referencias', {}));
  doc.estiloCitacao = { estilo: 'ieee' };
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc).replace(/­/g, '');
  assert.match(html, /\[1\] P\. Freire/);
  assert.match(html, /\[2\] E\. Badino/);
});

test('pacote de estilo carrega o estilo de citação/referências', () => {
  const doc = criarDocumento();
  doc.estiloCitacao = { estilo: 'harvard' };
  const pacote = exportarPacoteEstilo(doc);
  assert.equal(pacote.configuracaoGlobal.estilo_citacao, 'harvard');
  const v = validarPacoteEstilo(JSON.parse(JSON.stringify(pacote)));
  assert.ok(v.valido !== false);
  const outro = criarDocumento();
  aplicarPacoteEstilo(outro, v.pacote || pacote);
  assert.equal(outro.estiloCitacao.estilo, 'harvard');
});
