// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { sanearHtmlTexto, sanearBlocoDeTexto, sanearDocumentoEstilos, aplicarEstilosDeTrecho, CAMPOS_FORMATACAO_DIRETA } from '../src/core/athenes_estilo_exclusivo.js';
import { sanitizarDocumentoImportado } from '../src/core/athenes_seguranca.js';
import { renderizarBlocoHtml, gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { sanitizarTemplate, criarDocumentoDeTemplate, extrairEsqueleto } from '../src/core/athenes_templates.js';
import { mapaMarcadores, chaveMarcador } from '../src/core/athenes_marcadores.js';
import { abrirZip } from '../src/core/athenes_zip_leitor.js';

const mapa = (doc) => Object.fromEntries(doc.estilos.map(e => [e.id, e]));
const LIXO = { alinhamento: 'centro', fonte: 'aptos', cor: '#FF0000', fundo_ativo: true, fundo_cor: '#FFF2A8', borda_tipo: 'inferior', entrelinha: 2, espaco_antes_pt: 30, espaco_depois_pt: 30, recuo_primeira_linha_mm: 50, recuo_esquerdo_mm: 40, recuo_direito_mm: 40, espacamento_letras_em: 1, espacamento_palavras_em: 1, hifenizacao: true };

test('criarNovoBloco: bloco de texto nasce sem nenhuma sobrescrita visual', () => {
  for (const tipo of ['paragrafo', 'titulo', 'subtitulo', 'citacao']) {
    const b = criarNovoBloco(tipo, { texto: 'x', ...LIXO, marcador_tipo: 'numero' });
    for (const k of CAMPOS_FORMATACAO_DIRETA) assert.equal(k in b, false, `${tipo} não deve ter ${k}`);
    assert.ok(b.estiloId, `${tipo} aponta para um estilo`);
  }
  // figuras/tabelas mantêm os próprios campos (em figura `fonte` é a linha "Fonte:")
  assert.equal(criarNovoBloco('figura', { fonte: 'Fonte: IBGE' }).fonte, 'Fonte: IBGE');
});

test('sanearHtmlTexto: sai negrito/itálico/sublinhado/style/cor, ficam links, sup/sub, br e trechos de estilo cadastrado', () => {
  const sujo = 'A <b>forte</b> <strong>x</strong> <i>it</i><em>e</em> <u>sub</u> <s>t</s> <font color="red">c</font> <span style="color:red;font-weight:700">s</span>'
    + '<br><a href="https://x.org" style="color:red">link</a> H<sub>2</sub>O<sup class="ath-nota-ref" data-nota="n1" contenteditable="false">1</sup>'
    + '<span class="ath-estilo-span" data-estilo-id="destaque" style="font-weight:900;color:red">ok</span>';
  const l = sanearHtmlTexto(sujo);
  assert.doesNotMatch(l, /<(b|strong|i|em|u|s|font)\b|style=|color=/i);
  assert.match(l, /A forte x ite sub t c s<br>/);
  assert.match(l, /<a href="https:\/\/x\.org">link<\/a>/);
  assert.match(l, /H<sub>2<\/sub>O<sup class="ath-nota-ref" data-nota="n1" contenteditable="false">1<\/sup>/);
  assert.match(l, /<span class="ath-estilo-span" data-estilo-id="destaque">ok<\/span>/);
  assert.equal(sanearHtmlTexto(l), l, 'idempotente');
});

test('migração: documento antigo perde overrides e formatação inline; sem estiloId usa corpo', () => {
  const doc = criarDocumento({ titulo: 'Antigo' });
  const velho = { id: 'velho', tipo: 'paragrafo', texto: 'Oi <b>mundo</b> <span style="color:red">x</span>', ...LIXO };
  const titulo = { id: 'tv', tipo: 'titulo', nivel: 1, estiloId: 'titulo1', texto: '<i>T</i>', alinhamento: 'direita' };
  doc.secoes[0].blocos.push(velho, titulo);
  sanitizarDocumentoImportado(doc);
  assert.equal(velho.texto, 'Oi mundo x');
  for (const k of CAMPOS_FORMATACAO_DIRETA) { assert.equal(k in velho, false, k); assert.equal(k in titulo, false, k); }
  assert.equal(velho.estiloId, 'corpo');
  assert.equal(titulo.texto, 'T');
});

test('migração: marcador antigo (override ou <ul>/<ol>) vira ESTILO derivado, não override', () => {
  const doc = criarDocumento({ titulo: 'M' });
  const corpo = doc.secoes.find(s => s.mestraId === 'corpo');
  const a = { id: 'a', tipo: 'paragrafo', estiloId: 'corpo', texto: 'um', marcador_tipo: 'numero', marcador_estilo_num: 'lower_alpha', marcador_separador: 'parentese' };
  const b = { id: 'b', tipo: 'paragrafo', estiloId: 'corpo', texto: '<ul data-marcador="traco"><li>x</li><li>y</li></ul>' };
  const c = { id: 'c', tipo: 'paragrafo', estiloId: 'corpo', texto: 'sem' };
  const d = { id: 'd', tipo: 'paragrafo', estiloId: 'corpo', texto: 'dois', marcador_tipo: 'numero', marcador_estilo_num: 'lower_alpha', marcador_separador: 'parentese' };
  corpo.blocos = [a, b, c, d];
  sanearDocumentoEstilos(doc);
  assert.equal('marcador_tipo' in a, false);
  const ea = doc.estilos.find(e => e.id === a.estiloId);
  assert.equal(ea.marcador_tipo, 'numero');
  assert.equal(ea.marcador_estilo_num, 'lower_alpha');
  assert.equal(doc.estilos.find(e => e.id === b.estiloId).marcador_tipo, 'traco');
  assert.equal(b.texto, 'x<br>y');
  assert.equal(c.estiloId, 'corpo');
  assert.equal(d.estiloId, a.estiloId, 'estilo derivado reaproveitado, sem duplicar');
  repaginarDocumento(doc);
  assert.equal(mapaMarcadores(doc).get(chaveMarcador(a)).rotulo, 'a)');
  assert.equal(mapaMarcadores(doc).get(chaveMarcador(d)).rotulo, 'a)', 'recomeça depois do bloco sem marcador');
});

test('renderização lê só o estilo: campos soltos no bloco não aparecem no PDF', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const solto = { ...criarNovoBloco('paragrafo', { id: 'p', texto: 'oi' }), ...LIXO };
  const html = renderizarBlocoHtml(solto, mapa(doc), doc);
  assert.doesNotMatch(html, /#FF0000|margin-left: 40mm|letter-spacing: 1em|text-indent: 50mm/);
  const corpo = doc.estilos.find(e => e.id === 'corpo');
  assert.match(html, new RegExp(`font-size: ${corpo.tamanho_pt}pt`));
});

test('reatividade: editar o estilo muda todos os blocos que o usam (PDF e Word)', async () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = doc.secoes.find(s => s.mestraId === 'corpo');
  sec.blocos = [criarNovoBloco('paragrafo', { id: 'p1', texto: 'um' }), criarNovoBloco('paragrafo', { id: 'p2', texto: 'dois' })];
  repaginarDocumento(doc);
  assert.doesNotMatch(gerarDocumentoHtmlPdf(doc), /color: #123456/i);
  Object.assign(doc.estilos.find(e => e.id === 'corpo'), { cor: '#123456', alinhamento: 'direita' });
  const depois = gerarDocumentoHtmlPdf(doc);
  assert.equal((depois.match(/color: #123456/gi) || []).length >= 2, true);
  assert.equal((depois.match(/text-align: right/g) || []).length >= 2, true);
  const docx = await exportarParaDocx(doc);
  assert.ok(docx.length > 1000);
});

test('Word: alinhamento, recuo e espaços do parágrafo vêm do estilo', async () => {
  const doc = criarDocumento({ titulo: 'T' });
  Object.assign(doc.estilos.find(e => e.id === 'corpo'), { alinhamento: 'direita', recuo_primeira_linha_mm: 10, espaco_depois_pt: 9, entrelinha: 2 });
  doc.secoes.find(s => s.mestraId === 'corpo').blocos = [criarNovoBloco('paragrafo', { id: 'p', texto: 'texto do estilo' })];
  repaginarDocumento(doc);
  const zip = abrirZip(await exportarParaDocx(doc));
  const xml = await zip.texto('word/document.xml');
  const par = xml.match(/<w:p>(?:(?!<\/w:p>).)*texto do estilo(?:(?!<\/w:p>).)*<\/w:p>/s)[0];
  assert.match(par, /<w:jc w:val="right"\/>/);
  assert.match(par, /w:firstLine="567"/);
  assert.match(par, /w:after="180"/);
  assert.match(par, /w:line="480"/);
});

test('trechos de estilo cadastrado: só o id vai ao modelo; o CSS vem do estilo atual', () => {
  const estilos = [{ id: 'destaque', nome: 'Destaque', fonte: 'nunito', tamanho_pt: 12, peso: 800, cor: '#B00020', italico: true }];
  const html = aplicarEstilosDeTrecho('a <span class="ath-estilo-span" data-estilo-id="destaque">b</span>', estilos, () => 'serif');
  assert.match(html, /font-weight: 800/);
  assert.match(html, /color: #B00020/);
  estilos[0].cor = '#00AA00';
  assert.match(aplicarEstilosDeTrecho('<span class="ath-estilo-span" data-estilo-id="destaque">b</span>', estilos), /color: #00AA00/);
  assert.equal(sanearHtmlTexto(html), 'a <span class="ath-estilo-span" data-estilo-id="destaque">b</span>');
});

test('templates antigos (do usuário e de pacote) são saneados; documento novo nasce limpo', () => {
  const doc = criarDocumento({ titulo: 'Base' });
  const esq = extrairEsqueleto(doc, { incluirConteudo: true });
  esq.secoes[0].blocos.push({ id: 'z', tipo: 'paragrafo', texto: '<b>velho</b>', estiloId: 'corpo', ...LIXO });
  const tpl = sanitizarTemplate({ id: 'tpl_x', titulo: 'Antigo', config: esq.config, secoes: esq.secoes });
  const z = tpl.secoes[0].blocos.find(b => b.id === 'z');
  assert.equal(z.texto, 'velho');
  for (const k of CAMPOS_FORMATACAO_DIRETA) assert.equal(k in z, false, k);
  const novo = criarDocumentoDeTemplate({ ...tpl, secoes: [{ nome: 'S', mestraId: tpl.config.mestras[0].id, blocos: [{ id: 'w', tipo: 'paragrafo', texto: '<i>w</i>', ...LIXO }] }] }, { titulo: 'N' });
  const w = novo.secoes[0].blocos[0];
  assert.equal(w.texto, 'w');
  assert.equal(w.estiloId, 'corpo');
  assert.equal('cor' in w, false);
});

test('sanearBlocoDeTexto ignora blocos que não são de texto', () => {
  const fig = { tipo: 'figura', fonte: 'Fonte: X', alinhamento: 'centro', cor: '#111111' };
  sanearBlocoDeTexto(fig, []);
  assert.deepEqual(fig, { tipo: 'figura', fonte: 'Fonte: X', alinhamento: 'centro', cor: '#111111' });
});

test('achado Qodo 1: sugestões pendentes (ins/del com data-sugestao-id) sobrevivem à limpeza; ins/del soltos somem', async () => {
  const { sanearHtmlTexto } = await import('../src/core/athenes_estilo_exclusivo.js');
  const comSugestao = 'Texto <ins class="ath-sug-ins" data-sugestao-id="s1">novo</ins> e <del class="ath-sug-del" data-sugestao-id="s2">velho</del> fim';
  assert.equal(sanearHtmlTexto(comSugestao), comSugestao);
  assert.equal(sanearHtmlTexto('a <ins>b</ins> <del>c</del> <b>d</b>'), 'a b c d');
  // o fechamento de um <ins> solto não rouba o de uma sugestão aberta antes
  assert.equal(sanearHtmlTexto('<ins data-sugestao-id="s3">x<ins>y</ins>z</ins>'), '<ins data-sugestao-id="s3">xyz</ins>');
});
