// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { marcadorEfetivo, rotuloMarcador, formatarNumeroMarcador, mapaMarcadores, sanearCamposMarcador, chaveMarcador } from '../src/core/athenes_marcadores.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { sanitizarEstiloAvancado } from '../src/core/athenes_estilo_avancado.js';

test('rótulos: números, letras, romanos e pontuação', () => {
  assert.equal(formatarNumeroMarcador(3, 'decimal_zero'), '03');
  assert.equal(formatarNumeroMarcador(28, 'lower_alpha'), 'ab');
  assert.equal(formatarNumeroMarcador(4, 'upper_roman'), 'IV');
  assert.equal(formatarNumeroMarcador(14, 'lower_roman'), 'xiv');
  const cfg = (extra) => ({ tipo: 'numero', estiloNum: 'lower_alpha', separador: 'parentese', ...extra });
  assert.equal(rotuloMarcador(cfg({}), 2), 'b)');
  assert.equal(rotuloMarcador(cfg({ separador: 'entre_parenteses' }), 1), '(a)');
  assert.equal(rotuloMarcador(cfg({ separador: 'travessao', estiloNum: 'decimal' }), 5), '5 –');
  assert.equal(rotuloMarcador({ tipo: 'traco' }), '–');
});

test('o bloco sobrescreve o estilo e "nenhum" desliga o marcador herdado', () => {
  const estilo = { marcador_tipo: 'numero', marcador_estilo_num: 'upper_roman', marcador_tab_mm: 9 };
  assert.equal(marcadorEfetivo({}, estilo).estiloNum, 'upper_roman');
  assert.equal(marcadorEfetivo({}, estilo).tabMm, 9);
  assert.equal(marcadorEfetivo({ marcador_tipo: 'circulo' }, estilo).tipo, 'circulo');
  assert.equal(marcadorEfetivo({ marcador_tipo: 'nenhum' }, estilo), null);
  assert.equal(marcadorEfetivo({}, {}), null);
});

function docComMarcadores() {
  const doc = criarDocumento();
  const corpo = doc.secoes[1] || doc.secoes[0];
  corpo.blocos.length = 0;
  const t1 = criarNovoBloco('titulo', { texto: 'Objetivos', nivel: 2, marcador_tipo: 'numero' });
  Object.assign(t1, { marcador_estilo_num: 'lower_alpha', marcador_separador: 'parentese' }); // como o painel grava
  const p1 = criarNovoBloco('paragrafo', { texto: 'Primeiro', marcador_tipo: 'numero' });
  const p2 = criarNovoBloco('paragrafo', { texto: 'Segundo', marcador_tipo: 'numero' });
  const livre = criarNovoBloco('paragrafo', { texto: 'Sem marcador' });
  const p3 = criarNovoBloco('paragrafo', { texto: 'Recomeça', marcador_tipo: 'numero' });
  corpo.blocos.push(t1, p1, p2, livre, p3);
  repaginarDocumento(doc);
  return { doc, t1, p1, p2, livre, p3 };
}

test('numeração corrida entre blocos seguidos e reinício depois de um bloco sem marcador', () => {
  const { doc, t1, p1, p2, livre, p3 } = docComMarcadores();
  const mapa = mapaMarcadores(doc);
  assert.equal(mapa.get(chaveMarcador(t1)).rotulo, 'a)');
  assert.equal(mapa.get(chaveMarcador(p1)).rotulo, '2.'); // a contagem continua; só a forma do rótulo é de cada bloco
  assert.equal(mapa.get(chaveMarcador(p2)).rotulo, '3.');
  assert.equal(mapa.has(chaveMarcador(livre)), false);
  assert.equal(mapa.get(chaveMarcador(p3)).rotulo, '1.');
});

test('estilo de texto com marcador vale para os blocos que o usam', () => {
  const { doc, p1 } = docComMarcadores();
  delete p1.marcador_tipo;
  doc.estilos.find(e => e.id === (p1.estiloId || 'corpo')).marcador_tipo = 'quadrado';
  assert.equal(mapaMarcadores(doc).get(chaveMarcador(p1)).rotulo, '▪');
});

test('PDF: título e parágrafo saem com o rótulo e recuo suspenso; DOCX gera sem erro', async () => {
  const { doc } = docComMarcadores();
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /<span class="ath-marc"[^>]*>a\)<\/span>/);
  assert.match(html, /<span class="ath-marc"[^>]*>2\.<\/span>/);
  assert.match(html, /<span class="ath-marc"[^>]*>1\.<\/span>/);
  assert.match(html, /padding-left:\s*(?:\d+(?:\.\d+)?)mm;position:relative;/);
  const docx = await exportarParaDocx(doc);
  assert.ok(docx instanceof Uint8Array && docx.length > 1000);
});

test('pacote de tema: campos de marcador saneados', () => {
  const ok = sanitizarEstiloAvancado({ id: 'a', marcador_tipo: 'numero', marcador_estilo_num: 'zzz', marcador_nivel: 99, marcador_tab_mm: 1, marcador_alinhamento: 'x' });
  assert.equal(ok.marcador_estilo_num, undefined);
  assert.equal(ok.marcador_nivel, 5);
  assert.equal(ok.marcador_tab_mm, 3);
  assert.equal(ok.marcador_alinhamento, undefined);
  assert.equal(sanearCamposMarcador({ id: 'b', marcador_tipo: 'lixo', marcador_nivel: 2 }).marcador_nivel, undefined);
});

test('linhas marcadas com Enter: cada item tem o seu rótulo, listas têm tipo próprio e o texto solto continua normal', async () => {
  const { segmentosDeLista, configListaDoBloco } = await import('../src/core/athenes_marcadores.js');
  const cfg = configListaDoBloco({}, {});
  const html = 'Intro<ul data-marcador="traco"><li>um</li><li>dois</li></ul>meio<ol data-num-estilo="lower_alpha" data-num-sep="parentese"><li>x</li><li>y</li></ol>';
  const seg = segmentosDeLista(html, cfg, 1);
  assert.deepEqual(seg.map(s => s.tipo === 'item' ? s.rotulo : s.html), ['Intro', '–', '–', 'meio', 'a)', 'b)']);
  assert.equal(segmentosDeLista('<ol><li>a</li></ol>', cfg, 4)[0].rotulo, '4.');
});

test('PDF e Word: bloco com linhas marcadas não vira <ul> dentro de <p> e sai um item por linha', async () => {
  const { doc, p1 } = docComMarcadores();
  delete p1.marcador_tipo;
  p1.texto = 'Antes<ul><li>linha um</li><li>linha dois</li></ul>';
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc).replace(/­/g, ''); // sem os hífens opcionais
  assert.match(html, /<span class="ath-marc"[^>]*>•<\/span>linha um/);
  assert.match(html, /<span class="ath-marc"[^>]*>•<\/span>linha dois/);
  assert.ok(!/<p[^>]*data-id="[^"]*"[^>]*>Antes<ul/.test(html));
  const docx = await exportarParaDocx(doc);
  assert.ok(docx.length > 1000);
});
