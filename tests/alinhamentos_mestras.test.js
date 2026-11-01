// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ALINHAMENTOS, estiloParaCss } from '../src/core/athenes_estilos.js';
import {
  criarDocumento, adicionarSecao, duplicarMestra, repaginarDocumento,
  criarNovoBloco, modeloDaPagina
} from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf, renderizarBlocoHtml } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';

test('Athenes — Sistema de Formatação, 7 Alinhamentos e Cores de Marca em Azul', async (t) => {
  await t.test('contém os 7 modos de alinhamento com dicas e comportamento da última linha', () => {
    assert.strictEqual(ALINHAMENTOS.length, 7);
    const ids = ALINHAMENTOS.map(a => a.id);
    assert.ok(ids.includes('esquerda'));
    assert.ok(ids.includes('centro'));
    assert.ok(ids.includes('direita'));
    assert.ok(ids.includes('justificado'));
    assert.ok(ids.includes('justificado_esquerda'));
    assert.ok(ids.includes('justificado_centro'));
    assert.ok(ids.includes('justificado_direita'));
  });

  await t.test('converte os 7 modos de alinhamento para CSS com text-align e text-align-last corretos', () => {
    const estiloBase = { tamanho_pt: 11, entrelinha: 1.5, cor: '#1F2733' };

    const cssEsq = estiloParaCss({ ...estiloBase, alinhamento: 'esquerda' });
    assert.match(cssEsq, /text-align:\s*left;/);
    assert.match(cssEsq, /text-align-last:\s*left;/);

    const cssCen = estiloParaCss({ ...estiloBase, alinhamento: 'centro' });
    assert.match(cssCen, /text-align:\s*center;/);
    assert.match(cssCen, /text-align-last:\s*center;/);

    const cssDir = estiloParaCss({ ...estiloBase, alinhamento: 'direita' });
    assert.match(cssDir, /text-align:\s*right;/);
    assert.match(cssDir, /text-align-last:\s*right;/);

    const cssJus = estiloParaCss({ ...estiloBase, alinhamento: 'justificado' });
    assert.match(cssJus, /text-align:\s*justify;/);

    const cssJusEsq = estiloParaCss({ ...estiloBase, alinhamento: 'justificado_esquerda' });
    assert.match(cssJusEsq, /text-align:\s*justify;/);
    assert.match(cssJusEsq, /text-align-last:\s*left;/);

    const cssJusCen = estiloParaCss({ ...estiloBase, alinhamento: 'justificado_centro' });
    assert.match(cssJusCen, /text-align:\s*justify;/);
    assert.match(cssJusCen, /text-align-last:\s*center;/);

    const cssJusDir = estiloParaCss({ ...estiloBase, alinhamento: 'justificado_direita' });
    assert.match(cssJusDir, /text-align:\s*justify;/);
    assert.match(cssJusDir, /text-align-last:\s*right;/);
  });

  await t.test('CSS base e editor usam azul (#314F79) como cor de estilo primária', () => {
    const cssBase = fs.readFileSync('src/css/athenes_base.css', 'utf8');
    assert.match(cssBase, /--ath-primary:\s*#314F79/i);
    assert.match(cssBase, /--glx-primary:\s*#314F79/i);
    assert.match(cssBase, /--ath-primary-soft:\s*#EEF4FA/i);

    const cssEditor = fs.readFileSync('src/css/athenes_editor.css', 'utf8');
    assert.ok(!cssEditor.includes('#FF6B2C'), 'athenes_editor.css não deve ter laranja legado');
  });

  await t.test('renderiza bloco no PDF honrando alinhamento local e última linha', () => {
    const doc = criarDocumento();
    const bloco = criarNovoBloco('paragrafo', {
      texto: 'Texto acadêmico formatado com rigor editorial.',
      alinhamento: 'justificado_esquerda',
      cor: '#314F79'
    });

    const html = renderizarBlocoHtml(bloco, Object.fromEntries(doc.estilos.map(e => [e.id, e])), doc);
    assert.match(html, /text-align:\s*justify/);
    assert.match(html, /text-align-last:\s*left/);
    assert.match(html, /color:\s*#314F79/i);
  });

  await t.test('exporta para DOCX com alinhamento justificado e indentações dinâmicas', async () => {
    const doc = criarDocumento();
    doc.secoes[1].blocos.push(criarNovoBloco('paragrafo', {
      texto: 'Parágrafo com alinhamento e recuo personalizados.',
      alinhamento: 'justificado_esquerda',
      recuo_primeira_linha_mm: 15,
      espaco_antes_pt: 6,
      espaco_depois_pt: 12
    }));

    const blobDocx = await exportarParaDocx(doc);
    assert.ok(blobDocx instanceof Uint8Array);
    assert.ok(blobDocx.length > 1000);
  });
});

test('Athenes — Sistema de Páginas Mestras (Fixa com Grade 2D vs Progressiva com Fluxo)', async (t) => {
  await t.test('distingue mestra fixa com grade 2D e mestra progressiva de fluxo', () => {
    const doc = criarDocumento();
    const mestraCapa = doc.mestras.find(m => m.id === 'capa');
    const mestraCorpo = doc.mestras.find(m => m.id === 'corpo');

    assert.strictEqual(mestraCapa.modo_aplicacao, 'fixa');
    assert.strictEqual(mestraCorpo.modo_aplicacao, 'progressiva');
  });

  await t.test('permite adicionar nova seção no início, após a atual ou no final', () => {
    const doc = criarDocumento();
    const totalSecoesIniciais = doc.secoes.length;

    // 1. Inserir no início (posição 0)
    const secInicio = adicionarSecao(doc, 'Página de Rosto', 'capa', 0);
    assert.strictEqual(doc.secoes[0].id, secInicio.id);
    assert.strictEqual(doc.secoes.length, totalSecoesIniciais + 1);

    // 2. Inserir após a seção atual (posição 1)
    const secApos = adicionarSecao(doc, 'Sumário Analítico', 'sumario', 1);
    assert.strictEqual(doc.secoes[1].id, secApos.id);

    // 3. Inserir no final (posição null ou doc.secoes.length)
    const secFim = adicionarSecao(doc, 'Anexo Metodológico', 'corpo', doc.secoes.length);
    assert.strictEqual(doc.secoes[doc.secoes.length - 1].id, secFim.id);
  });

  await t.test('editar propriedades de uma mestra atualiza a paginação e preserva o conteúdo dos blocos', () => {
    const doc = criarDocumento();
    const mestraCorpo = doc.mestras.find(m => m.id === 'corpo');

    // Altera margens da mestra
    mestraCorpo.margens_mm = { t: 35, r: 25, b: 25, l: 35 };
    mestraCorpo.cabecalho.texto = 'Cabeçalho Customizado Athenes';

    repaginarDocumento(doc);

    // Verifica que páginas do corpo herdaram o modelo atualizado
    const pagCorpo = doc.paginas.find(p => p.mestraId === 'corpo');
    assert.ok(pagCorpo, 'Deve existir pelo menos uma página com a mestra corpo');
    const modeloRecuperado = modeloDaPagina(doc, pagCorpo);
    assert.strictEqual(modeloRecuperado.margens_mm.t, 35);
    assert.strictEqual(modeloRecuperado.cabecalho.texto, 'Cabeçalho Customizado Athenes');
  });

  await t.test('bloco de título e subtítulo suportam os 7 alinhamentos e cores customizadas', () => {
    const doc = criarDocumento();
    const titulo = criarNovoBloco('titulo', {
      texto: 'Título de Diagnóstico Urbano',
      alinhamento: 'justificado_centro',
      cor: '#314F79'
    });
    const subtitulo = criarNovoBloco('subtitulo', {
      texto: 'Subtítulo com alinhamento justificado à esquerda',
      alinhamento: 'justificado_esquerda',
      cor: '#1F2733'
    });

    const htmlTitulo = renderizarBlocoHtml(titulo, Object.fromEntries(doc.estilos.map(e => [e.id, e])), doc);
    assert.match(htmlTitulo, /text-align:\s*justify/);
    assert.match(htmlTitulo, /text-align-last:\s*center/);
    assert.match(htmlTitulo, /color:\s*#314F79/i);

    const htmlSub = renderizarBlocoHtml(subtitulo, Object.fromEntries(doc.estilos.map(e => [e.id, e])), doc);
    assert.match(htmlSub, /text-align:\s*justify/);
    assert.match(htmlSub, /text-align-last:\s*left/);
  });

  await t.test('exportação PDF renderiza elementos recorrentes da página mestra (tarja, marca d\'água, rótulo)', () => {
    const doc = criarDocumento();
    const mestraCapa = doc.mestras.find(m => m.id === 'capa');
    mestraCapa.elementos_recorrentes = [
      { id: 'e1', tipo: 'tarja', posicao: 'topo', altura_mm: 10, cor: '#314F79' },
      { id: 'e2', tipo: 'marca_dagua', texto: 'CONFIDENCIAL', cor: '#314F79', opacidade: 0.15 },
      { id: 'e3', tipo: 'rotulo_estatico', texto: 'UNIVERSIDADE FEDERAL', y_mm: 15, cor: '#314F79' }
    ];

    repaginarDocumento(doc);
    const htmlPdf = gerarDocumentoHtmlPdf(doc);

    assert.match(htmlPdf, /height:10mm; background:#314F79/);
    assert.match(htmlPdf, /CONFIDENCIAL/);
    assert.match(htmlPdf, /UNIVERSIDADE FEDERAL/);
  });

  await t.test('CSS do editor tem botões de menu com classe rm-seta-dropdown-icone e sem rgba quebrado', () => {
    const cssEditor = fs.readFileSync('src/css/athenes_editor.css', 'utf8');
    assert.ok(!cssEditor.includes('rgba(49, 79, 121, )'), 'Não deve haver rgba incompleto');
    assert.match(cssEditor, /\.rm-seta-dropdown-icone/);
    assert.match(cssEditor, /\.rm-cor-linha-badge/);
  });

});
