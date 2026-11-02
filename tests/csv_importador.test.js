// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco } from '../src/core/athenes_documento.js';
import {
  parseCsv, detectarSeparador, csvParaTabela, aplicarCsvAoBloco, decodificarCsv, MAX_COLUNAS_CSV, MAX_LINHAS_CSV
} from '../src/core/athenes_csv.js';
import { garantirEstiloTabela, aplicarCamadaSelecao, resolverCelula, obterEstiloTabela, dimensoesTabela } from '../src/core/athenes_tabela_estilo.js';
import { renderizarBlocoHtml } from '../src/core/athenes_export_pdf.js';

test('CSV — parser RFC 4180: aspas, aspas escapadas, quebra de linha em campo, CRLF e BOM', () => {
  const csv = '\uFEFFnome,obs\r\n"Silva, J.","disse ""oi"""\r\n"linha1\nlinha2",fim\r\n';
  assert.deepEqual(parseCsv(csv, ','), [['nome', 'obs'], ['Silva, J.', 'disse "oi"'], ['linha1\nlinha2', 'fim']]);
  assert.deepEqual(parseCsv('a;b\n\n  ;  \nc;d', ';'), [['a', 'b'], ['c', 'd']], 'linhas vazias são descartadas');
  assert.deepEqual(parseCsv('a,b,', ','), [['a', 'b', '']], 'campo final vazio é preservado');
});

test('CSV — detecção de separador (; , tab |) ignorando delimitadores dentro de aspas', () => {
  assert.equal(detectarSeparador('a;b;c\n1;2;3'), ';');
  assert.equal(detectarSeparador('a,b,c\n1,2,3'), ',');
  assert.equal(detectarSeparador('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(detectarSeparador('a|b\n1|2'), '|');
  assert.equal(detectarSeparador('nome;valor\n"Silva, J.";"1,5"\n"Souza, M.";"2,5"'), ';', 'vírgulas decimais não confundem');
});

test('CSV — csvParaTabela normaliza linhas irregulares, nomeia colunas vazias e respeita "sem cabeçalho"', () => {
  const r = csvParaTabela('Parâmetro;;Valor\nA;1\nB;2;3;4', {});
  assert.equal(r.separador, ';');
  assert.deepEqual(r.colunas, ['Parâmetro', 'Coluna 2', 'Valor', 'Coluna 4']);
  assert.deepEqual(r.linhas[0], ['A', '1', '', '']);
  assert.deepEqual(r.linhas[1], ['B', '2', '3', '4']);

  const sem = csvParaTabela('1,2\n3,4', { cabecalho: false });
  assert.deepEqual(sem.colunas, ['Coluna 1', 'Coluna 2']);
  assert.equal(sem.linhas.length, 2);
  assert.deepEqual(csvParaTabela('', {}).colunas, []);
});

test('CSV — limites de linhas e colunas', () => {
  const largo = Array.from({ length: MAX_COLUNAS_CSV + 5 }, (_, i) => `c${i}`).join(',');
  const r1 = csvParaTabela(largo + '\n' + largo, {});
  assert.equal(r1.colunas.length, MAX_COLUNAS_CSV);
  assert.equal(r1.truncado.colunas, true);
  const muitas = 'x\n' + Array.from({ length: MAX_LINHAS_CSV + 20 }, (_, i) => String(i)).join('\n');
  const r2 = csvParaTabela(muitas, {});
  assert.equal(r2.linhas.length, MAX_LINHAS_CSV);
  assert.equal(r2.truncado.linhas, true);
});

test('CSV — decodificação: UTF-8 e fallback Windows-1252 (Excel pt-BR)', () => {
  const utf8 = new TextEncoder().encode('Ação;Quantidade');
  assert.deepEqual(decodificarCsv(utf8), { texto: 'Ação;Quantidade', codificacao: 'utf-8' });
  const win = Uint8Array.from([0x41, 0xE7, 0xE3, 0x6F, 0x3B, 0x31]); // "Ação;1" em Windows-1252
  const d = decodificarCsv(win);
  assert.equal(d.codificacao, 'windows-1252');
  assert.equal(d.texto, 'Ação;1');
});

test('CSV — aplicar ao bloco: substitui preservando estilo global e zerando ajustes por índice; anexar mantém colunas', () => {
  const b = criarNovoBloco('tabela', {});
  const e = garantirEstiloTabela(b);
  e.zebra.ativo = true;
  aplicarCamadaSelecao(b, { r0: 1, c0: 0, r1: 1, c1: 0 }, { fundo: '#ABABAB' });
  aplicarCamadaSelecao(b, null, { tamanho_pt: 11 });

  const res = csvParaTabela('Item;Qtd;Preço;Obs\nA;1;2,50;x\nB;2;3,00;y', {});
  const tot = aplicarCsvAoBloco(b, res, { modo: 'substituir' });
  assert.deepEqual(tot, { linhas: 2, colunas: 4 });
  assert.equal(b.larguras_relativas.length, 4);
  assert.equal(b.estilo_tabela.zebra.ativo, true, 'estilo global preservado');
  assert.equal(b.estilo_tabela.camadas.tabela.tamanho_pt, 11, 'camada da tabela preservada');
  assert.deepEqual(b.estilo_tabela.camadas.celulas, {}, 'ajustes por célula descartados');
  const dim = dimensoesTabela(b);
  assert.equal(resolverCelula(obterEstiloTabela(b), dim, 1, 0).fundo, '#FFFFFF', 'zebra volta a valer');

  const mais = csvParaTabela('Item;Qtd\nC;3;9;9\nD', { cabecalho: true });
  aplicarCsvAoBloco(b, csvParaTabela('x;y\nC;3\nD;4;5;6;7', {}), { modo: 'anexar' });
  assert.equal(b.linhas.length, 4);
  assert.deepEqual(b.linhas[3], ['D', '4', '5', '6'], 'ajustada ao nº de colunas do bloco');
  assert.equal(b.colunas.length, 4);
});

test('CSV — conteúdo importado não injeta HTML na exportação PDF', () => {
  const b = criarNovoBloco('tabela', {});
  aplicarCsvAoBloco(b, csvParaTabela('Nome;Nota\n<img src=x onerror=alert(1)>;<b>9</b>', {}), { modo: 'substituir' });
  const html = renderizarBlocoHtml(b, {}, criarDocumento({ titulo: 'T' }));
  assert.ok(!html.includes('<img src=x'), 'tag crua não pode aparecer');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
