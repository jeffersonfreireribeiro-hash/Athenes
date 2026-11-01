// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatarNumeroPagina,
  paraRomano,
  FORMATOS_NUMERACAO_PAGINA,
  criarElementoMestra,
  gerarCssMolduraBloco,
  aplicarLayoutATodosBlocos,
  obterModelosLayoutBloco,
  criarDocumento,
  criarNovoBloco
} from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';

describe('Athenes — Numeração de Páginas, Coordenadas Exatas de Mestra e Layout de Blocos', () => {

  it('formata números de páginas em todos os formatos canônicos e personalizados', () => {
    // 1. Apenas número
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'apenas_numero', ocultar_na_capa: false }), '3');

    // 2. N de Total
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'n_de_total', ocultar_na_capa: false }), '3 de 27');

    // 3. N of Total (padrão internacional MDPI)
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'n_of_total', ocultar_na_capa: false }), '3 of 27');

    // 4. Página N
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'pagina_n', ocultar_na_capa: false }), 'Página 3');

    // 5. Página N de Total
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'pagina_n_de_total', ocultar_na_capa: false }), 'Página 3 de 27');

    // 6. Romano minúsculo (sumários / seções pré-textuais)
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'romano_min', ocultar_na_capa: false }), 'iii');
    assert.strictEqual(paraRomano(14, true), 'xiv');

    // 7. Romano maiúsculo
    assert.strictEqual(formatarNumeroPagina(4, 27, { formato: 'romano_mai', ocultar_na_capa: false }), 'IV');

    // 8. Hífen
    assert.strictEqual(formatarNumeroPagina(3, 27, { formato: 'hifen', ocultar_na_capa: false }), '- 3 -');

    // 9. Personalizado com máscara, prefixo e sufixo
    const formatadoPers = formatarNumeroPagina(3, 27, {
      formato: 'personalizado',
      mascara: 'Folha {p} / {total}',
      prefixo: 'Doc. Nº 42 · ',
      sufixo: ' (Oficial)',
      ocultar_na_capa: false
    });
    assert.strictEqual(formatadoPers, 'Doc. Nº 42 · Folha 3 / 27 (Oficial)');
  });

  it('oculta a numeração na capa (página 1 física) por padrão', () => {
    // Página 1 física com ocultar_na_capa padrão
    assert.strictEqual(formatarNumeroPagina(1, 10, { formato: 'n_de_total', ocultar_na_capa: true }), '');

    // Página 2 física exibe normalmente
    assert.strictEqual(formatarNumeroPagina(2, 10, { formato: 'n_de_total', ocultar_na_capa: true }), '2 de 10');

    // Página 1 se ocultar_na_capa for explicitamente desativado
    assert.strictEqual(formatarNumeroPagina(1, 10, { formato: 'n_de_total', ocultar_na_capa: false }), '1 de 10');
  });

  it('cria elementos da página mestra por coordenadas exatas em milímetros e sangria total', () => {
    // Moldura por coordenadas exatas
    const elemCoord = criarElementoMestra('caixa_grade', {
      titulo: 'Quadro Central',
      posicionamento_modo: 'coordenadas',
      x_mm: 30,
      y_mm: 45,
      largura_mm: 150,
      altura_mm: 60,
      cor: '#314F79'
    });
    assert.strictEqual(elemCoord.posicionamento_modo, 'coordenadas');
    assert.strictEqual(elemCoord.x_mm, 30);
    assert.strictEqual(elemCoord.y_mm, 45);
    assert.strictEqual(elemCoord.largura_mm, 150);
    assert.strictEqual(elemCoord.altura_mm, 60);

    // Foto de capa livre com sangria total
    const fotoCapa = criarElementoMestra('foto_capa', {
      titulo: 'Foto Principal da Capa',
      sangria: true,
      url: 'resources/exemplo/capa.jpg',
      opacidade: 0.95
    });
    assert.strictEqual(fotoCapa.tipo, 'foto_capa');
    assert.strictEqual(fotoCapa.posicionamento_modo, 'coordenadas');
    assert.strictEqual(fotoCapa.sangria, true);
    assert.strictEqual(fotoCapa.url, 'resources/exemplo/capa.jpg');
  });

  it('gera CSS de molduras e estilos de caixa para fórmulas, figuras e tabelas', () => {
    // 1. Bloco de fórmula com moldura limpa (sem caixa/fundo)
    const bLimpo = criarNovoBloco('formula', { moldura_tipo: 'limpo' });
    const cssLimpo = gerarCssMolduraBloco(bLimpo);
    assert.strictEqual(cssLimpo.background, 'transparent');
    assert.strictEqual(cssLimpo.border, 'none');

    // 2. Bloco com linha lateral marcando (callout azul institucional)
    const bLinha = criarNovoBloco('formula', { moldura_tipo: 'linha_esquerda', borda_cor: '#314F79' });
    const cssLinha = gerarCssMolduraBloco(bLinha);
    assert.ok(cssLinha.borderLeft.includes('3.5px solid #314F79'));

    // 3. Bloco cartão suave com borda e raio
    const bCartao = criarNovoBloco('figura', { moldura_tipo: 'cartao_suave', raio_borda_px: 8 });
    const cssCartao = gerarCssMolduraBloco(bCartao);
    assert.strictEqual(cssCartao.borderRadius, '8px');
    assert.ok(cssCartao.background !== 'transparent');
  });

  it('exporta PDF com elementos por coordenadas e numeração customizada', () => {
    const doc = criarDocumento();
    doc.mestras[0].elementos_recorrentes = [
      criarElementoMestra('foto_capa', {
        titulo: 'Capa Sangrada',
        sangria: true,
        url: 'resources/exemplo/capa.jpg'
      }),
      criarElementoMestra('caixa_grade', {
        titulo: 'Moldura Coordenadas',
        posicionamento_modo: 'coordenadas',
        x_mm: 20,
        y_mm: 50,
        largura_mm: 170,
        altura_mm: 40
      })
    ];
    doc.mestras[0].rodape = {
      ativo: true,
      texto: 'Athenes Research Paper',
      numeracao: true,
      formato: 'n_of_total',
      posicao_numero: 'alternado',
      ocultar_na_capa: false
    };

    const htmlPdf = gerarDocumentoHtmlPdf(doc);
    assert.ok(htmlPdf.includes('Foto de Capa') || htmlPdf.includes('capa.jpg'));
    assert.ok(htmlPdf.includes('position:absolute'));
    assert.ok(htmlPdf.includes('of'));
  });

  it('propaga o layout de moldura para todos os blocos do mesmo tipo no documento', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[0];
    sec.blocos.push(criarNovoBloco('formula', { latex: 'E = mc^2' }));
    sec.blocos.push(criarNovoBloco('formula', { latex: 'a^2 + b^2 = c^2' }));

    const alterados = aplicarLayoutATodosBlocos(doc, 'formula', {
      moldura_tipo: 'linha_esquerda',
      posicao_numero: 'esquerda',
      legenda_formula: 'onde c é a velocidade da luz'
    });

    assert.strictEqual(alterados, 2);
    assert.strictEqual(sec.blocos[sec.blocos.length - 2].moldura_tipo, 'linha_esquerda');
    assert.strictEqual(sec.blocos[sec.blocos.length - 2].posicao_numero, 'esquerda');
  });
});
