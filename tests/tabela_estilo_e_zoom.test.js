// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco } from '../src/core/athenes_documento.js';
import {
  obterEstiloTabela, garantirEstiloTabela, dimensoesTabela, resolverCelula,
  aplicarPresetBorda, aplicarCamadaSelecao, sanitizarEstiloTabela, celulaParaCss, celulaParaDocx
} from '../src/core/athenes_tabela_estilo.js';
import { renderizarBlocoHtml } from '../src/core/athenes_export_pdf.js';
import {
  exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout
} from '../src/core/athenes_pacote_estilo.js';
import { calcularNovoZoom, scrollAncorado, limitarZoom, ZOOM_MIN, ZOOM_MAX } from '../src/ui/athenes_zoom_canvas.js';

const pincel = { largura_pt: 2, estilo: 'tracejada', cor: '#FF0000' };
const novaTabela = (extra = {}) => criarNovoBloco('tabela', {
  colunas: ['A', 'B', 'C'],
  linhas: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['10', '11', '12']],
  ...extra
});

test('Estilo de tabela — padrão preserva o visual ABNT legado', () => {
  const b = novaTabela();
  const est = obterEstiloTabela(b);
  const dim = dimensoesTabela(b);
  assert.equal(dim.nLinhas, 5);
  const cab = resolverCelula(est, dim, 0, 0);
  assert.ok(cab.bordas.t && cab.bordas.b, 'cabeçalho com topo e divisória inferior');
  assert.equal(cab.bordas.l, null, 'laterais abertas (ABNT/IBGE)');
  assert.equal(cab.negrito, true);
  const meio = resolverCelula(est, dim, 2, 1);
  assert.equal(meio.bordas.t.cor, '#E2E8F0');
  assert.equal(meio.bordas.l, null);
  const ultima = resolverCelula(est, dim, 4, 1);
  assert.equal(ultima.bordas.b.largura_pt, 1.1);
});

test('Presets de contorno na tabela inteira gravam nos campos globais (sem explodir por célula)', () => {
  const b = novaTabela();
  aplicarPresetBorda(b, 'todas', null, pincel);
  assert.deepEqual(b.estilo_tabela.bordas_celulas, {});
  const dim = dimensoesTabela(b);
  const est = obterEstiloTabela(b);
  const c = resolverCelula(est, dim, 2, 1);
  for (const lado of ['t', 'r', 'b', 'l']) assert.equal(c.bordas[lado].cor, '#FF0000', `lado ${lado}`);

  aplicarPresetBorda(b, 'nenhuma', null, pincel);
  const sem = resolverCelula(obterEstiloTabela(b), dim, 2, 1);
  assert.deepEqual(sem.bordas, { t: null, b: null, l: null, r: null });
  const cab = resolverCelula(obterEstiloTabela(b), dim, 0, 0);
  assert.deepEqual(cab.bordas, { t: null, b: null, l: null, r: null }, 'sem bordas zera inclusive a divisória do cabeçalho');
});

test('Presets: externas, internas, horizontais e verticais internas', () => {
  const b = novaTabela();
  const dim = dimensoesTabela(b);
  aplicarPresetBorda(b, 'nenhuma', null, pincel);
  aplicarPresetBorda(b, 'externas', null, pincel);
  let e = obterEstiloTabela(b);
  assert.ok(resolverCelula(e, dim, 0, 0).bordas.l && resolverCelula(e, dim, 0, 0).bordas.t);
  assert.equal(resolverCelula(e, dim, 2, 1).bordas.t, null, 'interior sem borda');

  aplicarPresetBorda(b, 'verticais_internas', null, pincel);
  e = obterEstiloTabela(b);
  assert.ok(resolverCelula(e, dim, 2, 1).bordas.l, 'divisória vertical interna');
  assert.equal(resolverCelula(e, dim, 2, 1).bordas.t, null);

  aplicarPresetBorda(b, 'horizontais_internas', null, pincel);
  e = obterEstiloTabela(b);
  assert.ok(resolverCelula(e, dim, 2, 1).bordas.t, 'divisória horizontal interna');
});

test('Presets em seleção parcial gravam por aresta e mantêm a aresta compartilhada coerente', () => {
  const b = novaTabela();
  const dim = dimensoesTabela(b);
  aplicarPresetBorda(b, 'nenhuma', null, pincel);
  aplicarPresetBorda(b, 'externas', { r0: 1, c0: 1, r1: 2, c1: 2 }, pincel);
  const e = obterEstiloTabela(b);
  // topo da seleção = base da linha acima
  assert.equal(resolverCelula(e, dim, 1, 1).bordas.t.cor, '#FF0000');
  assert.equal(resolverCelula(e, dim, 0, 1).bordas.b.cor, '#FF0000');
  // fora da seleção, sem borda
  assert.equal(resolverCelula(e, dim, 3, 0).bordas.t, null);
  assert.equal(resolverCelula(e, dim, 1, 0).bordas.r.cor, '#FF0000');
});

test('Cabeçalho e rodapé têm contorno independente das células comuns', () => {
  const b = novaTabela();
  const e = garantirEstiloTabela(b);
  e.rodape.ativo = true;
  e.rodape.borda_superior = { largura_pt: 3, estilo: 'dupla', cor: '#00AA00' };
  e.cabecalho.borda_inferior = { largura_pt: 2, estilo: 'solida', cor: '#0000FF' };
  const dim = dimensoesTabela(b);
  assert.equal(resolverCelula(e, dim, 4, 0).bordas.t.cor, '#00AA00');
  assert.equal(resolverCelula(e, dim, 3, 0).bordas.b.cor, '#00AA00', 'aresta compartilhada com a linha acima');
  assert.equal(resolverCelula(e, dim, 0, 0).bordas.b.cor, '#0000FF');
  assert.equal(resolverCelula(e, dim, 2, 0).bordas.t.cor, '#E2E8F0', 'células comuns inalteradas');
  assert.equal(resolverCelula(e, dim, 4, 0).tipo, 'rodape');
});

test('Zebra alterna linhas de dados; cabeçalho e coluna-chave têm fundo próprio; camadas têm precedência', () => {
  const b = novaTabela();
  const e = garantirEstiloTabela(b);
  e.zebra = { ativo: true, cor_impar: '#FFFFFF', cor_par: '#EEEEEE' };
  e.cabecalho.fundo = '#314F79';
  e.coluna_cabecalho = { ativo: true, fundo: '#DDDDDD', negrito: true, borda_direita: { largura_pt: 2, estilo: 'solida', cor: '#000000' } };
  const dim = dimensoesTabela(b);
  assert.equal(resolverCelula(e, dim, 0, 1).fundo, '#314F79');
  assert.equal(resolverCelula(e, dim, 1, 1).fundo, '#FFFFFF');
  assert.equal(resolverCelula(e, dim, 2, 1).fundo, '#EEEEEE');
  assert.equal(resolverCelula(e, dim, 3, 1).fundo, '#FFFFFF');
  assert.equal(resolverCelula(e, dim, 2, 0).fundo, '#DDDDDD');
  assert.equal(resolverCelula(e, dim, 2, 0).bordas.r.largura_pt, 2);
  assert.equal(resolverCelula(e, dim, 2, 1).bordas.l.largura_pt, 2, 'mesma aresta vista pela coluna vizinha');

  aplicarCamadaSelecao(b, { r0: 2, c0: 0, r1: 2, c1: 2 }, { fundo: '#FFEEAA' });
  assert.deepEqual(Object.keys(e.camadas.linhas), ['2'], 'linha inteira vira camada de linha');
  assert.equal(resolverCelula(e, dim, 2, 1).fundo, '#FFEEAA');
  aplicarCamadaSelecao(b, { r0: 2, c0: 1, r1: 2, c1: 1 }, { fundo: '#112233' });
  assert.equal(resolverCelula(e, dim, 2, 1).fundo, '#112233', 'célula vence linha');
  aplicarCamadaSelecao(b, { r0: 2, c0: 1, r1: 2, c1: 1 }, { fundo: null });
  assert.equal(resolverCelula(e, dim, 2, 1).fundo, '#FFEEAA', 'remover fundo da célula devolve o da linha');
});

test('Alinhamento horizontal/vertical por tabela, coluna e célula; tabela inteira limpa overrides', () => {
  const b = novaTabela();
  const dim = dimensoesTabela(b);
  aplicarCamadaSelecao(b, { r0: 0, c0: 2, r1: 4, c1: 2 }, { h: 'direita' });
  aplicarCamadaSelecao(b, { r0: 1, c0: 2, r1: 1, c1: 2 }, { v: 'centro' });
  let e = obterEstiloTabela(b);
  const c = resolverCelula(e, dim, 1, 2);
  assert.equal(c.h, 'direita'); assert.equal(c.v, 'centro');
  assert.match(celulaParaCss(c, e), /text-align:right;vertical-align:middle/);
  aplicarCamadaSelecao(b, null, { h: 'justificado' });
  e = obterEstiloTabela(b);
  assert.equal(resolverCelula(e, dim, 1, 2).h, 'justificado');
  assert.equal(e.camadas.colunas['2'], undefined);
});

test('Padding e quebra forçada geram CSS; sanitização rejeita cores/enums inválidos', () => {
  const e = sanitizarEstiloTabela({
    padding: 'expandido', quebra: 'forcada',
    zebra: { ativo: true, cor_par: 'javascript:alert(1)', cor_impar: '#abc' },
    bordas: { internas: { h: { largura_pt: 999, estilo: 'xyz', cor: 'red; background:url(x)' } } },
    camadas: { tabela: { h: 'diagonal', fundo: 'nope' }, celulas: { 'x:y': { fundo: '#fff' } } }
  });
  assert.equal(e.padding, 'expandido');
  assert.equal(e.zebra.cor_par, '#F1F5F9', 'cor inválida cai no padrão');
  assert.equal(e.zebra.cor_impar, '#ABC');
  assert.equal(e.bordas.internas.h.largura_pt, 6, 'largura limitada');
  assert.equal(e.bordas.internas.h.estilo, 'solida');
  assert.equal(e.bordas.internas.h.cor, '#1F2733', 'sem injeção de CSS');
  assert.equal(e.camadas.tabela.h, 'esquerda');
  assert.deepEqual(e.camadas.celulas, {});
  const css = celulaParaCss(resolverCelula(e, { nLinhas: 3, nCols: 2, temCab: true }, 1, 0), e);
  assert.match(css, /padding:8pt 16pt/);
  assert.match(css, /overflow-wrap:anywhere/);
});

test('Exportação PDF aplica bordas, zebra e alinhamento por célula e mantém colunas proporcionais', () => {
  const b = novaTabela({ larguras_relativas: [0.5, 0.25, 0.25] });
  const e = garantirEstiloTabela(b);
  e.zebra = { ativo: true, cor_impar: '#FFFFFF', cor_par: '#E5E5E5' };
  aplicarPresetBorda(b, 'todas', null, pincel);
  aplicarCamadaSelecao(b, { r0: 0, c0: 2, r1: 4, c1: 2 }, { h: 'direita' });
  const html = renderizarBlocoHtml(b, {}, criarDocumento({ titulo: 'T' }));
  assert.match(html, /<colgroup><col style="width:50\.00%"/);
  assert.match(html, /border-top:2pt dashed #FF0000/);
  assert.match(html, /background-color:#E5E5E5/);
  assert.match(html, /text-align:right/);
  assert.match(html, /table-layout:fixed/);

  const q = criarNovoBloco('quadro', {});
  const htmlQ = renderizarBlocoHtml(q, {}, criarDocumento({ titulo: 'T' }));
  assert.match(htmlQ, /<table class="ath-quadro"[^>]*>/);
  assert.match(htmlQ, /border-left:1\.1pt solid #1F2733/, 'quadro mantém caixa fechada por padrão');
});

test('Exportação DOCX: OOXML de célula com bordas, sombreamento e alinhamento', () => {
  const b = novaTabela();
  aplicarPresetBorda(b, 'todas', null, { largura_pt: 1, estilo: 'dupla', cor: '#123456' });
  aplicarCamadaSelecao(b, null, { fundo: '#ABCDEF', v: 'base', h: 'centro' });
  const dim = dimensoesTabela(b);
  const { tcPr, jc } = celulaParaDocx(resolverCelula(obterEstiloTabela(b), dim, 2, 1));
  assert.match(tcPr, /<w:top w:val="double" w:sz="8" w:space="0" w:color="123456"\/>/);
  assert.match(tcPr, /w:fill="ABCDEF"/);
  assert.match(tcPr, /<w:vAlign w:val="bottom"\/>/);
  assert.equal(jc, 'center');
});

test('Pacote de tema (athenes-tema-v1): exporta, valida, sanitiza e reaplica o estilo de tabela', () => {
  const doc = criarDocumento({ titulo: 'Doc' });
  const b = novaTabela();
  aplicarPresetBorda(b, 'todas', null, pincel);
  const e = garantirEstiloTabela(b);
  e.zebra = { ativo: true, cor_impar: '#FFFFFF', cor_par: '#EFEFEF' };
  aplicarCamadaSelecao(b, { r0: 2, c0: 1, r1: 2, c1: 1 }, { fundo: '#999999' }); // pontual: não vai ao tema
  doc.secoes[0].blocos.push(b);

  const pacote = exportarPacoteEstilo(doc, { nome: 'Tema Tabelas' });
  const tab = pacote.layout_padrao_figuras.tabela.estilo_tabela;
  assert.equal(tab.zebra.ativo, true);
  assert.equal(tab.bordas.externas.t.cor, '#FF0000');
  assert.deepEqual(tab.camadas.celulas, {}, 'ajustes por célula não são portáveis');
  assert.ok(pacote.layout_padrao_figuras.quadro.estilo_tabela.bordas.externas.l, 'quadro exportado com caixa fechada');

  // JSON externo malicioso é sanitizado
  const suspeito = JSON.parse(JSON.stringify(pacote));
  suspeito.layout_padrao_figuras.tabela.estilo_tabela.zebra.cor_par = 'url(http://x)';
  const val = validarPacoteEstilo(suspeito);
  assert.equal(val.valido, true);
  assert.equal(val.pacote.layout_padrao_figuras.tabela.estilo_tabela.zebra.cor_par, '#F1F5F9');

  // reaplicação em outro documento preserva conteúdo e ajustes pontuais
  const doc2 = criarDocumento({ titulo: 'Outro' });
  const t2 = novaTabela();
  aplicarCamadaSelecao(t2, { r0: 1, c0: 0, r1: 1, c1: 0 }, { fundo: '#ABABAB' });
  doc2.secoes[0].blocos.push(t2);
  aplicarPacoteEstilo(doc2, pacote);
  assert.equal(t2.estilo_tabela.zebra.ativo, true);
  assert.equal(t2.estilo_tabela.camadas.celulas['1:0'].fundo, '#ABABAB');
  assert.equal(t2.linhas[0][0], '1', 'conteúdo intacto');

  const prompt = obterPromptIaParaExtracaoDeLayout();
  for (const chave of ['estilo_tabela', 'zebra', 'coluna_cabecalho', 'bordas.externas', 'quebra']) {
    assert.ok(prompt.includes(chave), `prompt de IA deve documentar "${chave}"`);
  }
});

test('Zoom do canvas: clamp 25%–400%, suavidade e ancoragem no cursor', () => {
  assert.equal(limitarZoom(0.01), ZOOM_MIN);
  assert.equal(limitarZoom(99), ZOOM_MAX);
  assert.equal(calcularNovoZoom(1, -1e9), ZOOM_MAX);
  assert.equal(calcularNovoZoom(1, 1e9), ZOOM_MIN);
  const subiu = calcularNovoZoom(1, -100);
  assert.ok(subiu > 1 && subiu < 1.3, 'um tick de roda é um passo suave');
  assert.ok(calcularNovoZoom(1, 100) < 1);
  assert.ok(calcularNovoZoom(1, -3, 1) > calcularNovoZoom(1, -3, 0), 'deltaMode=linhas é amplificado');

  // O ponto do conteúdo sob o cursor não se move
  const scroll = 300, offset = 200, z0 = 1, z1 = 2;
  const novoScroll = scrollAncorado(scroll, offset, z0, z1);
  assert.equal((novoScroll + offset) / z1, (scroll + offset) / z0);
});
