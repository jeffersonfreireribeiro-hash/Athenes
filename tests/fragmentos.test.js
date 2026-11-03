// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoPlano, dividirHtmlNoTexto, podeDividir, ehFragmento, origemDoFragmento } from '../src/core/athenes_fragmentos.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';

const corpo = (doc) => doc.secoes.find(s => s.mestraId === 'corpo');
const paginasDe = (doc) => doc.paginas.filter(p => p.secaoId === corpo(doc).id);
const palavras = (n) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(' ');

test('corte de HTML: fecha e reabre marcações, conta entidades como 1 caractere', () => {
  assert.equal(textoPlano('a&nbsp;b <b>c</b>'), 'a\u0001b c');
  const [a, b] = dividirHtmlNoTexto('um <b>dois <i>três</i> quatro</b> cinco', 9);
  assert.equal(a, 'um <b>dois <i>t</i></b>');
  assert.equal(b, '<b><i>rês</i> quatro</b> cinco');
  assert.equal(textoPlano(a) + textoPlano(b), textoPlano('um <b>dois <i>três</i> quatro</b> cinco'));
  assert.deepEqual(dividirHtmlNoTexto('curto', 99).slice(0, 2), ['curto', '']);
  const [c, d] = dividirHtmlNoTexto('ab&amp;cd', 3);
  assert.equal(c, 'ab&amp;'); assert.equal(d, 'cd');
});

test('parágrafo longo continua na página seguinte (sem perder nem repetir texto)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  const enchimento = Array.from({ length: 16 }, (_, i) => criarNovoBloco('paragrafo', { id: `e${i}`, texto: palavras(25) }));
  const longo = criarNovoBloco('paragrafo', { id: 'longo', texto: palavras(220), recuo_primeira_linha_mm: 12.5 });
  sec.blocos = [...enchimento, longo, criarNovoBloco('paragrafo', { id: 'depois', texto: 'fim' })];
  repaginarDocumento(doc);
  const frags = paginasDe(doc).flatMap(p => p.blocos).filter(b => b.id === 'longo');
  assert.ok(frags.length >= 2, 'o parágrafo foi dividido');
  assert.ok(frags.every(ehFragmento) && frags.every(f => origemDoFragmento(f) === longo));
  assert.equal(frags.map(f => textoPlano(f.texto)).join(''), textoPlano(longo.texto), 'nada some nem se repete');
  assert.deepEqual(frags.map(f => f._frag.continuaDaAnterior), frags.map((_, i) => i > 0));
  assert.deepEqual(frags.map(f => f._frag.continuaNaProxima), frags.map((_, i) => i < frags.length - 1));
  assert.equal(frags[1].recuo_primeira_linha_mm, 0, 'a continuação não tem recuo de primeira linha');
  assert.equal(frags[0].espaco_depois_pt, 0);
  assert.equal(frags[1].espaco_antes_pt, 0);
  const pg = paginasDe(doc);
  assert.ok(pg.findIndex(p => p.blocos.includes(frags[0])) < pg.findIndex(p => p.blocos.includes(frags[1])));
  assert.ok(textoPlano(frags[0].texto).trim().length > 0 && textoPlano(frags.at(-1).texto).split(' ').length >= 4, 'sem viúva/órfã de uma palavra');
  assert.doesNotThrow(() => JSON.stringify(doc), 'o documento continua serializável (sem ciclos)');
});

test('editar um fragmento edita o parágrafo inteiro', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  const longo = criarNovoBloco('paragrafo', { id: 'longo', texto: palavras(300) });
  sec.blocos = [...Array.from({ length: 15 }, (_, i) => criarNovoBloco('paragrafo', { id: `e${i}`, texto: palavras(25) })), longo];
  repaginarDocumento(doc);
  const frags = paginasDe(doc).flatMap(p => p.blocos).filter(b => b.id === 'longo');
  assert.ok(frags.length >= 2);
  const original = longo.texto;
  frags[1].texto = frags[1].texto.replace('palavra299', 'ALTERADA');
  assert.ok(longo.texto.includes('ALTERADA') && !longo.texto.includes('palavra299'));
  assert.equal(longo.texto.length, original.length - 'palavra299'.length + 'ALTERADA'.length);
  repaginarDocumento(doc); // a repaginação parte do original atualizado
  assert.ok(paginasDe(doc).flatMap(p => p.blocos).some(b => b.id === 'longo' && b.texto.includes('ALTERADA')));
});

test('o que não deve dividir fica inteiro: curto, com tabela, em grupo e títulos', () => {
  const curto = criarNovoBloco('paragrafo', { texto: palavras(10) });
  assert.equal(podeDividir(curto), true);
  assert.equal(podeDividir(criarNovoBloco('paragrafo', { texto: 'a<br>b' })), true, 'quebras de linha internas não impedem a divisão');
  assert.equal(podeDividir(criarNovoBloco('paragrafo', { texto: '<table></table>' })), false);
  assert.equal(podeDividir(Object.assign(criarNovoBloco('paragrafo', { texto: 'x' }), { grupo: 'g1' })), false);
  assert.equal(podeDividir(criarNovoBloco('titulo', { texto: 'x' })), false);
  assert.equal(podeDividir(criarNovoBloco('figura', {})), false);
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  sec.blocos = [...Array.from({ length: 17 }, (_, i) => criarNovoBloco('paragrafo', { texto: palavras(25) })), criarNovoBloco('paragrafo', { id: 'quase', texto: palavras(14) })];
  repaginarDocumento(doc);
  const blocos = paginasDe(doc).flatMap(p => p.blocos);
  assert.ok(blocos.every(b => !b._frag || b.id !== 'quase'), 'parágrafo de 2–3 linhas não é dividido');
});

test('tabela longa continua na página seguinte com o cabeçalho repetido e linhas compartilhadas', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  const linhas = Array.from({ length: 45 }, (_, i) => [`Item ${i}`, `${i * 3}`, `${i * 7}`]);
  const tab = criarNovoBloco('tabela', { id: 'tab', titulo: 'Tabela 1 — Dados', linhas, colunas: ['Item', 'A', 'B'] });
  sec.blocos = [criarNovoBloco('paragrafo', { texto: palavras(40) }), tab];
  repaginarDocumento(doc);
  const frags = paginasDe(doc).flatMap(p => p.blocos).filter(b => b.id === 'tab');
  assert.ok(frags.length >= 2, 'a tabela foi dividida');
  assert.equal(frags.reduce((t, f) => t + f.linhas.length, 0), 45, 'todas as linhas, uma vez só');
  assert.deepEqual(frags.flatMap(f => f.linhas.map(l => l[0])), linhas.map(l => l[0]), 'na ordem');
  assert.ok(frags.every(f => f.colunas === tab.colunas || JSON.stringify(f.colunas) === JSON.stringify(tab.colunas)), 'cabeçalho em todos os fragmentos');
  assert.ok(frags.every(f => f.com_cabecalho !== false));
  assert.equal(frags[0]._frag.continuaNaProxima, true);
  assert.equal(frags.at(-1)._frag.continuaDaAnterior, true);
  assert.equal(frags.at(-1)._frag.continuaNaProxima, false);
  assert.equal(frags[1]._frag.linhaInicial, frags[0].linhas.length);
  assert.ok(frags.at(-1).linhas.length >= 2, 'nunca uma única linha isolada no fim');
  frags[1].linhas[0][1] = 'EDITADA'; // a linha é a mesma do original
  assert.equal(tab.linhas[frags[0].linhas.length][1], 'EDITADA');
});

test('tabela que cabe inteira não é dividida; sem espaço para cabeçalho + linha, vai inteira para a próxima', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  sec.blocos = [criarNovoBloco('tabela', { id: 'pequena', titulo: 'T', linhas: [['a', '1', '2'], ['b', '3', '4'], ['c', '5', '6']] })];
  repaginarDocumento(doc);
  const f = paginasDe(doc).flatMap(p => p.blocos).filter(b => b.id === 'pequena');
  assert.equal(f.length, 1); assert.equal(ehFragmento(f[0]), false);
});

test('PDF: tabela dividida repete o cabeçalho, marca "continuação"/"Continua" e põe a fonte só no fim', async () => {
  const { gerarDocumentoHtmlPdf } = await import('../src/core/athenes_export_pdf.js');
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  const linhas = Array.from({ length: 60 }, (_, i) => [`Item ${i}`, `${i}`, `${i * 2}`]);
  sec.blocos = [criarNovoBloco('tabela', { id: 'tab', titulo: 'Tabela 1 — Dados', linhas, colunas: ['Item', 'A', 'B'], fonte: 'Fonte: autores (2026).' })];
  repaginarDocumento(doc);
  const frags = paginasDe(doc).flatMap(p => p.blocos).filter(b => b.id === 'tab');
  assert.ok(frags.length >= 2);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.equal((html.match(/<thead>/g) || []).length, frags.length, 'um cabeçalho por fragmento');
  assert.equal((html.match(/Tabela 1 \(continuação\)/g) || []).length, frags.length - 1);
  assert.equal((html.match(/>Continua</g) || []).length, frags.length - 1);
  assert.equal((html.match(/Fonte: autores \(2026\)\./g) || []).length, 1, 'a fonte só no último fragmento');
  assert.equal((html.match(/Tabela 1 — Dados/g) || []).length, 1, 'o título completo só no primeiro');
  const estat = (await import('../src/core/athenes_documento.js')).calcularEstatisticas(doc);
  assert.equal(estat.tabelas, 1, 'a tabela dividida conta uma vez');
});

test('parágrafo com <br>/<div> continua na página seguinte e segue sendo UM bloco (editar um fragmento não o parte em dois)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  const html = Array.from({ length: 6 }, (_, i) => `<div>${palavras(160)} ${i}</div>`).join('') + palavras(90);
  sec.blocos = [criarNovoBloco('paragrafo', { id: 'longo', texto: html })];
  repaginarDocumento(doc);
  const frs = paginasDe(doc).flatMap(p => p.blocos).filter(b => b.id === 'longo');
  assert.ok(frs.length >= 2, 'o texto longo passa para a página seguinte');
  assert.equal(sec.blocos.length, 1, 'continua sendo um único bloco');
  frs[0].texto = frs[0].texto; // simula a edição de um fragmento (regrava o bloco inteiro)
  assert.equal(sec.blocos[0].texto, html, 'o texto original é reconstruído sem dividir os <div> em dois');
});
