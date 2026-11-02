// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import {
  LAYOUTS_FIGURA, obterLayoutFigura, qtdSlotsDoLayout, ajustarItensAoLayout, obterConfigFigura,
  descreverFigura, rotuloSubfigura, cssObjParaString, extrairEstiloFigura, sanitizarEstiloFigura,
  aplicarEstiloFiguraAoBloco
} from '../src/core/athenes_figura_layout.js';
import { renderizarBlocoHtml, gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { estiloParaCssComAlinhamento, localizarEstilo } from '../src/core/athenes_estilos.js';
import { papeisTipografiaFigura } from '../src/ui/athenes_figura_ui.js';
import { figuraTemVariasImagens, extrairTipografiaTituloFonte } from '../src/core/athenes_figura_layout.js';
import { aplicarCamadaSelecao } from '../src/core/athenes_tabela_estilo.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const fig = (extra = {}) => criarNovoBloco('figura', { itens: [{ url: 'a.png' }, { url: 'b.png' }, { url: 'c.png' }], ...extra });

test('Subgrid — catálogo de layouts: presets, destaques e compatibilidade com ids legados', () => {
  const ids = LAYOUTS_FIGURA.map(l => l.id);
  for (const id of ['1', '2_lado', '3_linha', '4_linha', '2_empilhado', '4_grade', '6_grade', '6_grade_3x2', '3_misto', '3_panoramica']) assert.ok(ids.includes(id), id);
  assert.equal(qtdSlotsDoLayout('4_linha'), 4);
  assert.equal(qtdSlotsDoLayout('6_grade_3x2'), 6);
  assert.equal(qtdSlotsDoLayout('3_misto'), 3, 'id legado preservado');
  assert.equal(qtdSlotsDoLayout('inexistente'), 1);
  // destaque: 1 grande à esquerda (2 linhas) + 2 menores à direita
  const m = obterLayoutFigura('3_misto');
  assert.deepEqual(m.slots[0], [1, 2, 1, 3]);
  assert.deepEqual(m.slots.slice(1), [[2, 3, 1, 2], [2, 3, 2, 3]]);
  // panorâmica: 1 ocupando as 2 colunas no topo + 2 na base
  assert.deepEqual(obterLayoutFigura('3_panoramica').slots[0], [1, 3, 1, 2]);
  // nenhum slot sai dos limites da grade
  for (const l of LAYOUTS_FIGURA) {
    for (const [c0, c1, r0, r1] of l.slots) {
      assert.ok(c0 >= 1 && c1 <= l.cols.length + 1 && r0 >= 1 && r1 <= l.rows.length + 1, `${l.id} dentro da grade`);
    }
  }
});

test('Subgrid — ajustar itens ao layout preserva imagens ao completar e trunca só o excedente', () => {
  const b = fig({ layout: '1' });
  b.itens = [{ url: 'x.png' }];
  b.layout = '4_linha';
  ajustarItensAoLayout(b);
  assert.equal(b.itens.length, 4);
  assert.equal(b.itens[0].url, 'x.png');
  b.layout = '2_lado';
  ajustarItensAoLayout(b);
  assert.deepEqual(b.itens.map(i => i.url), ['x.png', '']);
});

test('Subgrid — configuração normalizada rejeita valores inválidos', () => {
  const c = obterConfigFigura({
    layout: 'x', gap_modo: 'gigante', img_moldura: 'neon', img_raio: '??', img_sombra: 'x', img_borda_cor: 'red',
    img_borda_largura_pt: 999, foco_x: -40, largura_modo: 'pct', largura_pct: 5, fluxo: 'voar', altura_modo: 'url(x)'
  });
  assert.equal(c.layout, '1');
  assert.equal(c.gap_modo, 'normal');
  assert.equal(c.img_moldura, 'nenhuma');
  assert.equal(c.img_raio, 'discreto');
  assert.equal(c.img_sombra, 'nenhuma');
  assert.equal(c.img_borda_cor, '#94A3B8');
  assert.equal(c.img_borda_largura_pt, 6);
  assert.equal(c.foco_x, 0);
  assert.equal(c.largura_pct, 20);
  assert.equal(c.fluxo, 'em_linha');
  assert.equal(c.altura_modo, 'auto');
  assert.equal(obterConfigFigura({ ajuste_enquadramento: 'scale-down' }).ajuste_enquadramento, 'contain');
});

test('Subgrid — descrição: gap, moldura, raio, sombra, foco, rótulos e ajuste por item', () => {
  const b = fig({
    layout: '3_misto', gap_modo: 'amplo', img_moldura: 'passe_partout', img_raio: 'pilula', img_sombra: 'elevada',
    ajuste_enquadramento: 'cover', foco_x: 20, foco_y: 80, subrotulo_tipo: 'letra_minuscula', subrotulo_posicao: 'interna'
  });
  const d = descreverFigura(b);
  assert.equal(d.grade.gap, '16px');
  assert.equal(d.grade.gridTemplateColumns, '2fr 1fr');
  assert.equal(d.itens[0].celula.gridRow, '1 / 3', 'destaque ocupa 2 linhas');
  assert.match(d.itens[0].moldura.border, /solid/);
  assert.equal(d.itens[0].moldura.padding, '10px');
  assert.equal(d.itens[0].moldura.borderRadius, '999px');
  assert.match(d.itens[0].moldura.boxShadow, /24px/);
  assert.equal(d.itens[1].img.objectPosition, '20% 80%');
  assert.equal(d.itens[1].img.objectFit, 'cover');
  assert.deepEqual(d.itens.map(i => i.subrotulo.texto), ['(a)', '(b)', '(c)']);
  assert.ok(d.itens.every(i => i.subrotulo.interno));
  assert.equal(rotuloSubfigura(1, 'letra_maiuscula', 'simples'), 'B');
  assert.equal(rotuloSubfigura(0, 'nenhum'), '');
  assert.equal(descreverFigura(fig({ layout: '1', subrotulo_tipo: 'letra_minuscula' })).itens[0].subrotulo, null, 'imagem única não leva rótulo');

  const dupla = descreverFigura(fig({ img_moldura: 'dupla', img_borda_largura_pt: 0.5 })).itens[0].moldura.border;
  assert.match(dupla, /^3px double/);

  const bi = fig({ layout: '2_lado', itens: [{ url: 'a', ajuste: 'fill', foco_x: 0, foco_y: 100 }, { url: 'b' }] });
  const di = descreverFigura(bi);
  assert.equal(di.itens[0].img.objectFit, 'fill');
  assert.equal(di.itens[0].img.objectPosition, '0% 100%');
  assert.equal(di.itens[1].img.objectFit, 'contain');
});

test('Subgrid — largura, alinhamento e fluxo do bloco', () => {
  assert.deepEqual(descreverFigura(fig({})).bloco, {}, 'padrão: largura do texto, sem estilos extras');
  const pct = descreverFigura(fig({ largura_modo: 'pct', largura_pct: 50, alinhamento_bloco: 'direita' })).bloco;
  assert.equal(pct.width, '50%');
  assert.equal(pct.marginLeft, 'auto');
  assert.equal(pct.marginRight, '0');
  const pagina = descreverFigura(fig({ largura_modo: 'pagina' }), { margens_mm: { l: 30, r: 20 } }).bloco;
  assert.equal(pagina.width, 'calc(100% + 50mm)');
  assert.equal(pagina.marginLeft, '-30mm');
  assert.equal(pagina.marginRight, '-20mm');
  const est = descreverFigura(fig({ largura_modo: 'estendida' }), { margens_mm: { l: 30, r: 20 } }).bloco;
  assert.equal(est.marginLeft, '-15mm');
  // contorno só quando o consumidor permite (PDF)
  assert.equal(descreverFigura(fig({ fluxo: 'contornar_esq' })).bloco.float, undefined);
  const fl = descreverFigura(fig({ fluxo: 'contornar_dir' }), { permitirFlutuar: true }).bloco;
  assert.equal(fl.float, 'right');
  assert.equal(fl.width, '50%');
  assert.equal(cssObjParaString({ marginLeft: '-3mm', gridRow: '1 / 2', x: undefined }), 'margin-left:-3mm;grid-row:1 / 2');
});

test('PDF — figura usa a mesma descrição: grade, sombra, rótulos e placeholder offline', () => {
  const b = fig({ layout: '3_panoramica', img_sombra: 'media', subrotulo_tipo: 'letra_maiuscula', subrotulo_formato: 'simples', img_moldura: 'fina' });
  b.itens[2].url = '';
  const html = renderizarBlocoHtml(b, {}, criarDocumento({ titulo: 'T' }));
  assert.match(html, /grid-template-columns:1fr 1fr/);
  assert.match(html, /grid-column:1 \/ 3/, 'panorâmica ocupa as duas colunas');
  assert.match(html, /box-shadow:0 4px 10px/);
  assert.match(html, />A<\/span>/);
  assert.ok(html.includes('data:image/svg+xml'), 'slot vazio usa placeholder embutido');
  assert.ok(!html.includes('unsplash'), 'sem imagem externa');
});

test('PDF — texto contorna a figura: figura flutuante e parágrafo seguinte dividem a célula', () => {
  const doc = criarDocumento({ titulo: 'Contorno' });
  const f = fig({ layout: '1', fluxo: 'contornar_esq', largura_modo: 'pct', largura_pct: 40 });
  const p = criarNovoBloco('paragrafo', { texto: 'Texto que contorna a figura.' });
  doc.secoes[0].blocos.push(f, p);
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  const i = html.indexOf('display:flow-root');
  assert.ok(i > 0, 'célula de fluxo');
  const cel = html.slice(i, i + 12000).replace(/­/g, ''); // ignora hifens suaves da hifenização
  assert.match(cel, /float:left/);
  const iTexto = cel.indexOf('Texto que');
  assert.ok(iTexto > 0, 'parágrafo na mesma célula');
  assert.ok(cel.indexOf('float:left') < iTexto, 'figura vem antes do texto');
});

test('Tema athenes-tema-v1 — estilo_figura exporta, sanitiza e reaplica sem perder imagens', () => {
  const doc = criarDocumento({ titulo: 'D' });
  const b = fig({
    moldura_tipo: 'limpo', gap_modo: 'amplo', img_sombra: 'suave', img_raio: 'arredondado',
    largura_modo: 'pct', largura_pct: 75, subrotulo_tipo: 'letra_maiuscula'
  });
  doc.secoes[0].blocos.push(b);
  const pacote = exportarPacoteEstilo(doc, { nome: 'T' });
  const ef = pacote.layout_padrao_figuras.figura.estilo_figura;
  assert.equal(ef.gap_modo, 'amplo');
  assert.equal(ef.img_sombra, 'suave');
  assert.equal(ef.largura_pct, 75);
  assert.ok(!('itens' in ef) && !('src' in ef), 'conteúdo não vai no tema');

  const ruim = JSON.parse(JSON.stringify(pacote));
  ruim.layout_padrao_figuras.figura.estilo_figura.img_borda_cor = 'red; x:url(y)';
  ruim.layout_padrao_figuras.figura.estilo_figura.fluxo = 'explodir';
  const v = validarPacoteEstilo(ruim);
  assert.equal(v.valido, true);
  assert.equal(v.pacote.layout_padrao_figuras.figura.estilo_figura.img_borda_cor, '#94A3B8');
  assert.equal(v.pacote.layout_padrao_figuras.figura.estilo_figura.fluxo, 'em_linha');

  const doc2 = criarDocumento({ titulo: 'Outro' });
  const b2 = fig({ layout: '3_linha', moldura_tipo: 'limpo' });
  doc2.secoes[0].blocos.push(b2);
  aplicarPacoteEstilo(doc2, pacote);
  assert.equal(b2.gap_modo, 'amplo');
  assert.equal(b2.subrotulo_tipo, 'letra_maiuscula');
  assert.equal(b2.layout, '3_linha', 'layout e imagens da figura existente são preservados');
  assert.equal(b2.itens.length, 3);
  assert.equal(b2.itens[0].url, 'a.png');

  const prompt = obterPromptIaParaExtracaoDeLayout();
  for (const chave of ['estilo_figura', 'subrotulo_tipo', 'subrotulo_formato', 'sublegenda_estilo_id', 'img_sombra', 'passe_partout', '3_panoramica', 'contornar_esq']) {
    assert.ok(prompt.includes(chave), chave);
  }
  assert.deepEqual(Object.keys(extrairEstiloFigura({})).sort(), Object.keys(sanitizarEstiloFigura({})).sort());
  assert.equal(aplicarEstiloFiguraAoBloco({ layout: '2_lado', itens: [{}, {}] }, { layout: '1', gap_modo: 'nenhum' }).layout, '2_lado');
});

const estiloCompleto = {
  id: 'legenda_forte', nome: 'Legenda forte', fonte: 'times', tamanho_pt: 13, peso: 700, cor: '#AA0000', italico: true,
  caixa_alta: true, entrelinha: 1.8, alinhamento: 'centro', espaco_antes_pt: 6, recuo_esquerdo_mm: 4, espacamento_letras_em: 0.05
};

test('Estilo de texto COMPLETO: todas as propriedades do estilo chegam ao CSS e o alinhamento do bloco vence', () => {
  const css = estiloParaCssComAlinhamento(estiloCompleto, '');
  for (const trecho of ['font-size: 13pt', 'font-weight: 700', 'color: #AA0000', 'font-style: italic', 'text-transform: uppercase',
    'line-height: 1.8', 'text-align: center', 'margin-top: 6pt', 'margin-left: 4mm', 'letter-spacing: 0.05em']) {
    assert.ok(css.includes(trecho), trecho);
  }
  assert.match(css, /Times New Roman/);
  const sobre = estiloParaCssComAlinhamento(estiloCompleto, 'right');
  assert.ok(sobre.trim().endsWith('text-align: right; text-align-last: right;'), 'alinhamento explícito do bloco vence o do estilo');
  assert.equal(estiloParaCssComAlinhamento(estiloCompleto, 'estilo'), estiloParaCssComAlinhamento(estiloCompleto, ''), '"estilo" = usa o do estilo');
  assert.equal(estiloParaCssComAlinhamento(null, ''), '');
  assert.equal(estiloParaCssComAlinhamento(null, 'centro'), 'text-align: center; text-align-last: center;');
  assert.equal(localizarEstilo([estiloCompleto], 'legenda_forte'), estiloCompleto);
  assert.equal(localizarEstilo([estiloCompleto], ''), null);
});

test('PDF — o estilo escolhido no bloco é aplicado por inteiro em título, legenda, fonte e subimagens', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const estilos = { [estiloCompleto.id]: estiloCompleto, legenda: { id: 'legenda', fonte: 'nunito', tamanho_pt: 10, peso: 700 } };
  const b = fig({
    layout: '2_lado', itens: [{ url: 'a', legenda_sub: 'Vista A' }, { url: 'b', legenda_sub: 'Vista B' }],
    subrotulo_tipo: 'numero', subrotulo_formato: 'fecha',
    titulo_estilo_id: 'legenda_forte', legenda_estilo_id: 'legenda_forte', fonte_estilo_id: 'legenda_forte',
    sublegenda_estilo_id: 'legenda_forte', subrotulo_texto_estilo_id: 'legenda_forte', legenda_alinhamento: 'right'
  });
  const html = renderizarBlocoHtml(b, estilos, doc);
  assert.ok((html.match(/text-transform: uppercase/g) || []).length >= 5, 'título, legenda, fonte, sublegendas e rótulos');
  assert.match(html, />1\)<\/span>/, 'rótulo numérico com parêntese à direita');
  assert.match(html, />2\)<\/span>/);
  assert.match(html, /text-align: right; text-align-last: right;/, 'alinhamento do bloco aplicado à legenda');

  // sem estilo escolhido: visual padrão preservado
  const padrao = renderizarBlocoHtml(fig({ layout: '2_lado' }), estilos, doc);
  assert.ok(!padrao.includes('text-transform: uppercase'));
});

test('PDF — título e fonte de tabela e quadro aceitam estilo de texto completo', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const estilos = { [estiloCompleto.id]: estiloCompleto };
  for (const tipo of ['tabela', 'quadro']) {
    const b = criarNovoBloco(tipo, { titulo_estilo_id: 'legenda_forte', fonte_estilo_id: 'legenda_forte', fonte_alinhamento: 'center', fonte: 'Fonte: X' });
    assert.equal(b.titulo_estilo_id, 'legenda_forte', `${tipo}: criarNovoBloco guarda o estilo`);
    const html = renderizarBlocoHtml(b, estilos, doc);
    assert.ok((html.match(/text-transform: uppercase/g) || []).length >= 2, `${tipo}: título e fonte estilizados`);
  }
  // ids/alinhamentos inválidos são descartados
  const ruim = criarNovoBloco('tabela', { titulo_estilo_id: 'x;y', fonte_alinhamento: 'diagonal' });
  assert.equal(ruim.titulo_estilo_id, undefined);
  assert.equal(ruim.fonte_alinhamento, undefined);
});

test('Subfiguras — rótulos por letra OU número, com 4 formatos', () => {
  assert.equal(rotuloSubfigura(0, 'letra_minuscula', 'parenteses'), '(a)');
  assert.equal(rotuloSubfigura(1, 'letra_minuscula', 'fecha'), 'b)');
  assert.equal(rotuloSubfigura(2, 'letra_maiuscula', 'ponto'), 'C.');
  assert.equal(rotuloSubfigura(2, 'numero', 'parenteses'), '(3)');
  assert.equal(rotuloSubfigura(0, 'numero', 'simples'), '1');
  assert.equal(rotuloSubfigura(0, 'nenhum'), '');
  assert.equal(rotuloSubfigura(0, 'invalido'), '');
  const d = descreverFigura(fig({ layout: '3_linha', subrotulo_tipo: 'numero', subrotulo_formato: 'ponto' }));
  assert.deepEqual(d.itens.map(i => i.subrotulo.texto), ['1.', '2.', '3.']);
});

test('Regra "só com mais de uma imagem": rótulos, espaçamento e estilos das subimagens somem com imagem única', () => {
  assert.equal(figuraTemVariasImagens({ layout: '1' }), false);
  assert.equal(figuraTemVariasImagens({ layout: '2_lado' }), true);
  const unica = papeisTipografiaFigura({ layout: '1', subrotulo_tipo: 'numero' }).map(p => p.chave);
  assert.deepEqual(unica, ['titulo', 'numeracao', 'legenda', 'fonte']);
  const varias = papeisTipografiaFigura({ layout: '3_linha', subrotulo_tipo: 'nenhum' }).map(p => p.chave);
  assert.deepEqual(varias, ['titulo', 'numeracao', 'legenda', 'fonte', 'sublegenda'], 'sem rótulo ativo, não há estilo de rótulo');
  const comRotulo = papeisTipografiaFigura({ layout: '3_linha', subrotulo_tipo: 'letra_minuscula' }).map(p => p.chave);
  assert.deepEqual(comRotulo, ['titulo', 'numeracao', 'legenda', 'fonte', 'sublegenda', 'subrotulo_texto']);
  // imagem única nunca gera rótulo nem sublegenda na descrição
  const d = descreverFigura(fig({ layout: '1', subrotulo_tipo: 'numero' }));
  assert.equal(d.itens[0].subrotulo, null);
});

test('Tema — estilos de texto de figura, tabela e quadro viajam no pacote e são sanitizados', () => {
  const doc = criarDocumento({ titulo: 'D' });
  doc.secoes[0].blocos.push(
    fig({ moldura_tipo: 'limpo', titulo_estilo_id: 'legenda', sublegenda_estilo_id: 'legenda', titulo_alinhamento: 'centro' }),
    criarNovoBloco('tabela', { titulo_estilo_id: 'legenda', fonte_alinhamento: 'right' })
  );
  const pacote = exportarPacoteEstilo(doc, { nome: 'T' });
  const f = pacote.layout_padrao_figuras.figura.estilo_figura;
  assert.equal(f.titulo_estilo_id, 'legenda');
  assert.equal(f.sublegenda_estilo_id, 'legenda');
  assert.equal(f.titulo_alinhamento, 'center', 'vocabulário pt-BR normalizado para CSS');
  assert.equal(pacote.layout_padrao_figuras.tabela.titulo_estilo_id, 'legenda');
  assert.equal(pacote.layout_padrao_figuras.tabela.fonte_alinhamento, 'right');

  const ruim = JSON.parse(JSON.stringify(pacote));
  ruim.layout_padrao_figuras.figura.estilo_figura.fonte_estilo_id = 'x"><script>';
  ruim.layout_padrao_figuras.tabela.titulo_estilo_id = '</style>';
  const v = validarPacoteEstilo(ruim);
  assert.equal(v.pacote.layout_padrao_figuras.figura.estilo_figura.fonte_estilo_id, '');
  assert.equal(v.pacote.layout_padrao_figuras.tabela.titulo_estilo_id, '');

  const doc2 = criarDocumento({ titulo: 'Outro' });
  const t2 = criarNovoBloco('tabela', {});
  doc2.secoes[0].blocos.push(t2);
  aplicarPacoteEstilo(doc2, pacote);
  assert.equal(t2.titulo_estilo_id, 'legenda');
  assert.equal(t2.fonte_alinhamento, 'right');
  assert.deepEqual(Object.keys(extrairTipografiaTituloFonte({})).sort(), ['dados_estilo_id', 'fonte_alinhamento', 'fonte_estilo_id', 'numeracao_estilo_id', 'titulo_alinhamento', 'titulo_estilo_id']);
});

test('Tabela/quadro/figura — estilo de texto próprio para a NUMERAÇÃO ("Tabela 1 —") e para os DADOS das células', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const num = { id: 'num_forte', nome: 'Numeração forte', fonte: 'times', tamanho_pt: 14, peso: 800, cor: '#AA0000', italico: true, caixa_alta: true };
  const dados = { id: 'dados_serif', nome: 'Dados serifados', fonte: 'georgia', tamanho_pt: 8.5, peso: 400, cor: '#123456', entrelinha: 1.1, italico: true };
  const estilos = { num_forte: num, dados_serif: dados };

  for (const tipo of ['tabela', 'quadro']) {
    const b = criarNovoBloco(tipo, { titulo: 'Descrição dos dados', numeracao_estilo_id: 'num_forte', dados_estilo_id: 'dados_serif', colunas: ['A', 'B'], linhas: [['1', '2']] });
    assert.equal(b.numeracao_estilo_id, 'num_forte', `${tipo}: criarNovoBloco guarda a numeração`);
    assert.equal(b.dados_estilo_id, 'dados_serif');
    b.numero_sequencial = 3;
    const html = renderizarBlocoHtml(b, estilos, doc);
    // prefixo numerado com o estilo da numeração (e só ele)
    const rot = tipo === 'quadro' ? 'Quadro' : 'Tabela';
    const m = new RegExp(`<span style="([^"]*)">${rot} 3 — </span>Descrição dos dados`).exec(html);
    assert.ok(m, `${tipo}: prefixo "${rot} 3 —" em span próprio`);
    assert.ok(m[1].includes('font-size: 14pt') && m[1].includes('text-transform: uppercase') && m[1].includes('font-style: italic'), 'estilo completo da numeração');
    assert.ok(!m[1].includes('text-align'), 'sem layout de bloco no prefixo');
    // dados: tipografia na própria <table>, sem alinhamento/margens do estilo
    const tab = /<table[^>]*style="([^"]*)"/.exec(html)[1];
    assert.ok(tab.includes('font-size: 8.5pt') && tab.includes('color: #123456') && tab.includes('line-height: 1.1') && tab.includes('font-style: italic'), `${tipo}: tipografia dos dados`);
    assert.ok(!/text-align: (left|center|right); text-align-last/.test(tab), 'alinhamento do estilo não vaza para a tabela');
    // negrito do cabeçalho continua explícito; dados não anulam o peso do estilo
    assert.ok(/<th style="[^"]*font-weight:(800|400)/.test(html));
    assert.ok(!/<td style="[^"]*font-weight/.test(html), 'células de dados não forçam o peso');
  }

  // sem escolha: nada muda
  const padrao = renderizarBlocoHtml(criarNovoBloco('tabela', { titulo: 'x' }), estilos, doc);
  assert.ok(!padrao.includes('font-size: 8.5pt') && !padrao.includes('text-transform: uppercase'));

  // figura: numeração com estilo próprio
  const f = fig({ numeracao_estilo_id: 'num_forte' });
  f.numero_sequencial = 2;
  const hf = renderizarBlocoHtml(f, estilos, doc);
  assert.ok(/<span style="[^"]*font-size: 14pt[^"]*">Figura 2 — <\/span>/.test(hf), 'figura: prefixo "Figura 2 —" estilizado');

  // ajuste explícito por célula continua valendo (negrito desligado de propósito)
  const t = criarNovoBloco('tabela', { colunas: ['A'], linhas: [['x']] });
  aplicarCamadaSelecao(t, { r0: 1, c0: 0, r1: 1, c1: 0 }, { negrito: false });
  assert.ok(/<td style="[^"]*font-weight:400/.test(renderizarBlocoHtml(t, estilos, doc)));
});
