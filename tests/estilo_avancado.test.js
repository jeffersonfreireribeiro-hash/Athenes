// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarAvancado, cssAvancadoInline, cssAvancadoDosEstilos, classesAvancadasDoBloco,
  aplicarPalavrasIniciais, removerPalavrasIniciais, separarPrimeiraLetra, sanitizarEstiloAvancado
} from '../src/core/athenes_estilo_avancado.js';
import { estiloParaCss } from '../src/core/athenes_estilos.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const AV = {
  barra_lateral: { ativa: true, lado: 'esquerda', largura_pt: 3, cor: '#C0392B', distancia_mm: 4 },
  fundo_bloco: { ativo: true, cor: '#EEF4FA', preenchimento_mm: 3 },
  capitular: { ativa: true, linhas: 3, cor: '#314F79' },
  palavras_iniciais: { ativa: true, quantidade: 2, peso: 800 },
  primeira_linha: { ativa: true, caixa_alta: true },
  ornamento_fim: { ativo: true, glifo: '◆' }
};

function docComEstilo() {
  const doc = criarDocumento({ titulo: 'T' });
  const corpo = doc.estilos.find(e => e.id === 'corpo');
  corpo.recuo_direito_mm = 10;
  corpo.avancado = JSON.parse(JSON.stringify(AV));
  doc.secoes.find(s => s.mestraId === 'corpo').blocos = [criarNovoBloco('paragrafo', { id: 'p1', texto: 'Ao longo deste estudo <b>veremos</b> muitas coisas.' })];
  return doc;
}

test('normalizar: sanitiza valores, ignora lixo e devolve null sem nada ativo', () => {
  assert.equal(normalizarAvancado(null), null);
  assert.equal(normalizarAvancado({ capitular: { ativa: false } }), null);
  const n = normalizarAvancado({ capitular: { ativa: true, linhas: 99, cor: 'vermelho' }, ornamento_fim: { ativo: true, glifo: '<b>x</b>abc' }, barra_lateral: { ativa: true, largura_pt: -4, lado: 'topo' } });
  assert.equal(n.capitular.linhas, 6);
  assert.equal(n.capitular.cor, '#314F79');
  assert.ok(!/[<>]/.test(n.ornamento_fim.glifo) && n.ornamento_fim.glifo.length <= 3);
  assert.equal(n.barra_lateral.largura_pt, 0.5);
  assert.equal(n.barra_lateral.lado, 'esquerda');
  assert.equal(sanitizarEstiloAvancado({ id: 'x', avancado: { capitular: { ativa: false } } }).avancado, undefined);
});

test('CSS: recuo direito, barra lateral e fundo entram no estilo do bloco', () => {
  const css = estiloParaCss({ id: 'c', recuo_direito_mm: 12, recuo_deslocado_mm: 5, avancado: AV });
  assert.match(css, /margin-right: 12mm/);
  assert.match(css, /border-left: 3pt solid #C0392B/);
  assert.match(css, /background-color: #EEF4FA/);
  assert.match(css, /padding: 3mm 3mm 3mm 12mm/, '5 (deslocado) + 3 (fundo) + 4 (barra)');
  assert.equal(cssAvancadoInline({ id: 'z' }), '');
});

test('pseudo-elementos: capitular, 1ª linha e ornamento só no início/fim do texto', () => {
  const css = cssAvancadoDosEstilos([{ id: 'corpo', entrelinha: 1.5, avancado: AV }]);
  assert.match(css, /\.ath-av-corpo\.ath-av-inicio::first-letter\{float:left/);
  assert.match(css, /::first-line\{[^}]*uppercase/);
  assert.match(css, /\.ath-av-corpo\.ath-av-fim::after\{content:"◆"/);
  const e = { id: 'corpo', avancado: AV };
  assert.equal(classesAvancadasDoBloco(e), 'ath-av-corpo ath-av-inicio ath-av-fim');
  assert.equal(classesAvancadasDoBloco(e, { continuaDaAnterior: true, continuaNaProxima: true }), 'ath-av-corpo');
  assert.equal(classesAvancadasDoBloco(e, { continuaDaAnterior: true, continuaNaProxima: false }), 'ath-av-corpo ath-av-fim');
  assert.equal(classesAvancadasDoBloco({ id: 'sem' }), '');
});

test('palavras iniciais: respeita marcações, é idempotente e reversível', () => {
  const e = { id: 'c', avancado: { palavras_iniciais: { ativa: true, quantidade: 3, peso: 800 } } };
  const html = 'Ao longo <b>deste estudo</b> veremos';
  const r = aplicarPalavrasIniciais(html, e);
  assert.equal((r.match(/class="ath-pi"/g) || []).length, 3);
  assert.ok(r.includes('<b><span class="ath-pi"'), 'o destaque fica dentro da marcação, sem cruzar tags');
  assert.ok(!/<span class="ath-pi"[^>]*>[^<]*veremos/.test(r), 'só 3 palavras');
  assert.equal(aplicarPalavrasIniciais(r, e), r);
  assert.equal(removerPalavrasIniciais(r), html);
  assert.equal(aplicarPalavrasIniciais(html, { id: 'x' }), html);
});

test('1ª letra para a capitular do DOCX', () => {
  assert.deepEqual(separarPrimeiraLetra('<b>Olá</b> mundo'), { letra: 'O', resto: '<b>lá</b> mundo' });
  assert.deepEqual(separarPrimeiraLetra(''), { letra: '', resto: '' });
});

test('PDF: classes, folha de estilo, palavras iniciais e recuo direito', () => {
  const doc = docComEstilo();
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /class="ath-bloco ath-paragrafo ath-av-corpo ath-av-inicio ath-av-fim"/);
  assert.match(html, /\.ath-av-corpo\.ath-av-inicio::first-letter/);
  assert.match(html, /<span class="ath-pi" style="font-weight:800;">Ao<\/span>/);
  assert.match(html, /margin-right: 10mm/);
});

test('PDF: parágrafo dividido — capitular só no 1º fragmento e ornamento só no último', () => {
  const doc = docComEstilo();
  const longo = Array.from({ length: 260 }, (_, i) => `palavra${i}`).join(' ');
  doc.secoes.find(s => s.mestraId === 'corpo').blocos = [
    ...Array.from({ length: 14 }, (_, i) => criarNovoBloco('paragrafo', { id: `e${i}`, texto: longo.slice(0, 190) })),
    criarNovoBloco('paragrafo', { id: 'longo', texto: longo })
  ];
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  const tags = [...html.matchAll(/<p class="ath-bloco ath-paragrafo ([^"]*)"[^>]*data-id="longo"/g)].map(m => m[1]);
  assert.ok(tags.length >= 2);
  assert.ok(tags[0].includes('ath-av-inicio') && !tags[0].includes('ath-av-fim'));
  assert.ok(!tags.at(-1).includes('ath-av-inicio') && tags.at(-1).includes('ath-av-fim'));
});

test('DOCX: capitular (framePr), barra lateral, fundo, recuo direito e ornamento', async () => {
  const doc = docComEstilo();
  repaginarDocumento(doc);
  const xml = new TextDecoder('utf-8').decode(await exportarParaDocx(doc));
  assert.match(xml, /w:dropCap="drop" w:lines="3"/);
  assert.match(xml, /<w:pBdr><w:left w:val="single"[^>]*w:color="C0392B"/);
  assert.match(xml, /w:shd w:val="clear" w:color="auto" w:fill="EEF4FA"/);
  assert.match(xml, /w:right="567"/);
  assert.ok(xml.includes('◆'));
});

test('tema: estilos avançados viajam no pacote, são saneados e o prompt de IA os descreve', () => {
  const doc = docComEstilo();
  const pacote = exportarPacoteEstilo(doc);
  const corpo = pacote.estilos.find(e => e.id === 'corpo');
  assert.equal(corpo.avancado.capitular.ativa, true);
  assert.equal(corpo.recuo_direito_mm, 10);
  const sujo = JSON.parse(JSON.stringify(pacote));
  sujo.estilos.find(e => e.id === 'corpo').avancado.capitular.linhas = 40;
  sujo.estilos.find(e => e.id === 'corpo').avancado.ornamento_fim.glifo = '<script>';
  const v = validarPacoteEstilo(JSON.stringify(sujo));
  assert.ok(v.valido, v.erro);
  const c2 = v.pacote.estilos.find(e => e.id === 'corpo');
  assert.equal(c2.avancado.capitular.linhas, 6);
  assert.ok(!/[<>]/.test(c2.avancado.ornamento_fim.glifo));
  const outro = criarDocumento({ titulo: 'Outro' });
  aplicarPacoteEstilo(outro, v.pacote);
  assert.equal(outro.estilos.find(e => e.id === 'corpo').avancado.capitular.ativa, true);
  const prompt = obterPromptIaParaExtracaoDeLayout();
  for (const chave of ['avancado', 'barra_lateral', 'fundo_bloco', 'capitular', 'palavras_iniciais', 'primeira_linha', 'ornamento_fim', 'recuo_direito_mm', 'templates']) {
    assert.ok(prompt.includes(chave), `o prompt cita ${chave}`);
  }
});
