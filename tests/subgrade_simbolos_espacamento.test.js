// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarDocumento,
  criarNovoBloco,
  recalcularNumeracaoAutomatica,
  aplicarNumeracaoNoTitulo,
  gerarCssMolduraBloco,
  salvarModeloLayoutCustomizado,
  obterModelosLayoutBloco,
  aplicarModeloLayoutBloco
} from '../src/core/athenes_documento.js';
import { PALETA_SIMBOLOS_MATEMATICA } from '../src/ui/athenes_simbolos_matematica.js';
import { estiloParaCss } from '../src/core/athenes_estilos.js';
import { svgIcone, ICONES } from '../src/ui/athenes_icones.js';

test('Athenes — Numeração Independente por Categoria (Sem Misturar)', async t => {
  await t.test('contadores de figura, gráfico, fotografia, mapa, tabela, quadro e fórmula são estritamente isolados', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[1]; // seção do corpo
    sec.blocos = [
      criarNovoBloco('figura', { subtipo: 'figura', titulo: 'Primeira Figura' }),
      criarNovoBloco('tabela', { titulo: 'Primeira Tabela' }),
      criarNovoBloco('figura', { subtipo: 'grafico', titulo: 'Primeiro Gráfico' }),
      criarNovoBloco('figura', { subtipo: 'fotografia', titulo: 'Primeira Foto' }),
      criarNovoBloco('tabela', { titulo: 'Segunda Tabela' }),
      criarNovoBloco('quadro', { titulo: 'Primeiro Quadro' }),
      criarNovoBloco('mapa', { titulo: 'Primeiro Mapa' }),
      criarNovoBloco('formula', { latex: 'E=mc^2' }),
      criarNovoBloco('figura', { subtipo: 'figura', titulo: 'Segunda Figura' }),
      criarNovoBloco('figura', { subtipo: 'grafico', titulo: 'Segundo Gráfico' }),
      criarNovoBloco('formula', { latex: '\\nabla \\cdot \\mathbf{B} = 0' }),
    ];

    const resumo = recalcularNumeracaoAutomatica(doc);

    // Contadores isolados
    assert.equal(resumo.porSubtipo.figura, 2, 'Devem existir exatamente 2 figuras');
    assert.equal(resumo.porSubtipo.grafico, 2, 'Devem existir exatamente 2 gráficos');
    assert.equal(resumo.porSubtipo.fotografia, 1, 'Deve existir exatamente 1 fotografia');
    assert.equal(resumo.tabelas, 2, 'Devem existir exatamente 2 tabelas');
    assert.equal(resumo.quadros, 1, 'Deve existir exatamente 1 quadro');
    assert.equal(resumo.mapas, 1, 'Deve existir exatamente 1 mapa');
    assert.equal(resumo.formulas, 2, 'Devem existir exatamente 2 fórmulas');

    // Sequências individuais nos blocos
    const blocos = sec.blocos;
    assert.equal(blocos[0].numero_sequencial, 1); // Figura 1
    assert.equal(blocos[1].numero_sequencial, 1); // Tabela 1
    assert.equal(blocos[2].numero_sequencial, 1); // Gráfico 1 (independente de Figura!)
    assert.equal(blocos[3].numero_sequencial, 1); // Fotografia 1 (independente!)
    assert.equal(blocos[4].numero_sequencial, 2); // Tabela 2
    assert.equal(blocos[5].numero_sequencial, 1); // Quadro 1
    assert.equal(blocos[6].numero_sequencial, 1); // Mapa 1
    assert.equal(blocos[7].numero_sequencial, 1); // Equação (1)
    assert.equal(blocos[8].numero_sequencial, 2); // Figura 2
    assert.equal(blocos[9].numero_sequencial, 2); // Gráfico 2
    assert.equal(blocos[10].numero_sequencial, 2); // Equação (2)
  });

  await t.test('aplicarNumeracaoNoTitulo prefixa o título respeitando o subtipo exato', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[1];
    const bGrafico = criarNovoBloco('figura', { subtipo: 'grafico', titulo: 'Dispersão de Amostras' });
    const bTabela = criarNovoBloco('tabela', { titulo: 'Resultados Físico-Químicos' });
    sec.blocos = [bGrafico, bTabela];

    const titGrafico = aplicarNumeracaoNoTitulo(bGrafico, doc);
    assert.equal(titGrafico, 'Gráfico 1 — Dispersão de Amostras');

    const titTabela = aplicarNumeracaoNoTitulo(bTabela, doc);
    assert.equal(titTabela, 'Tabela 1 — Resultados Físico-Químicos');
  });
});

test('Athenes — Subgrid e Estilos de Moldura da Caixa', async t => {
  await t.test('gera estilos de linha lateral contínua, quadriculada (0px), pontilhada e dupla', () => {
    const blocoReta = { moldura_tipo: 'linha_lateral', borda_cor: '#314F79', borda_largura_px: 3, linha_estilo: 'solida' };
    const cssReta = gerarCssMolduraBloco(blocoReta);
    assert.match(cssReta.borderLeft, /3px solid #314F79/);

    const blocoQuadriculada = { moldura_tipo: 'linha_lateral', borda_cor: '#314F79', borda_largura_px: 4, linha_estilo: 'quadriculada_reta' };
    const cssQuadriculada = gerarCssMolduraBloco(blocoQuadriculada);
    assert.equal(cssQuadriculada.borderRadius, '0px', 'Quadriculada deve forçar cantos retos (0px)');
    assert.match(cssQuadriculada.borderLeft, /4px solid #314F79/);

    const blocoPontilhada = { moldura_tipo: 'linha_lateral', borda_cor: '#314F79', borda_largura_px: 3, linha_estilo: 'pontilhada' };
    const cssPontilhada = gerarCssMolduraBloco(blocoPontilhada);
    assert.match(cssPontilhada.borderLeft, /3px dotted #314F79/);

    const blocoDupla = { moldura_tipo: 'linha_lateral', borda_cor: '#314F79', borda_largura_px: 4, linha_estilo: 'dupla' };
    const cssDupla = gerarCssMolduraBloco(blocoDupla);
    assert.match(cssDupla.borderLeft, /4px double #314F79/);
  });

  await t.test('salva modelo de layout customizado com subgrade 2 colunas e propaga para o documento', () => {
    const doc = criarDocumento();
    const blocoRascunho = {
      tipo: 'figura',
      moldura_tipo: 'linha_lateral',
      linha_estilo: 'pontilhada',
      subgrade_colunas: 2,
      subgrade_linhas: 2,
      posicao_titulo: 'topo'
    };
    const novoModelo = salvarModeloLayoutCustomizado(doc, 'Subgrade Dupla com Legenda Lateral', blocoRascunho);

    assert.ok(novoModelo.id.startsWith('modelo_'));
    const lista = obterModelosLayoutBloco('figura', doc);
    assert.ok(lista.some(m => m.id === novoModelo.id));

    const bloco = criarNovoBloco('figura', { titulo: 'Mapa Geológico' });
    aplicarModeloLayoutBloco(bloco, novoModelo.id, doc);

    assert.equal(bloco.subgrade_colunas, 2);
    assert.equal(bloco.linha_estilo, 'pontilhada');
    assert.equal(bloco.moldura_tipo, 'linha_lateral');
  });
});

test('Athenes — Distância entre Blocos e Distância entre Parágrafos com Enter', async t => {
  await t.test('estiloParaCss gera --ath-bloco-gap e --ath-paragrafo-gap', () => {
    const estilo = {
      id: 'teste_espacamento',
      fonte: 'nunito',
      tamanho_pt: 12,
      espaco_depois_pt: 10,
      espaco_paragrafos_pt: 7
    };
    const css = estiloParaCss(estilo);
    assert.match(css, /margin-bottom:\s*10pt;/);
    assert.match(css, /--ath-bloco-gap:\s*10pt;/);
    assert.match(css, /--ath-paragrafo-gap:\s*7pt;/);
  });
});

test('Athenes — Paleta Rica de Símbolos Matemáticos e Lógicos', async t => {
  await t.test('contém as 6 categorias de símbolos com snippets LaTeX válidos', () => {
    assert.ok(Array.isArray(PALETA_SIMBOLOS_MATEMATICA), 'A paleta deve ser um array de categorias');
    assert.ok(PALETA_SIMBOLOS_MATEMATICA.length >= 6, 'Deve conter pelo menos 6 categorias');

    const nomesCategorias = PALETA_SIMBOLOS_MATEMATICA.map(c => c.categoria);
    assert.ok(nomesCategorias.includes('Operadores & Relações'));
    assert.ok(nomesCategorias.includes('Cálculo & Análise'));
    assert.ok(nomesCategorias.includes('Lógica & Conjuntos'));
    assert.ok(nomesCategorias.includes('Alfabeto Grego'));
    assert.ok(nomesCategorias.includes('Estruturas & Notação'));
    assert.ok(nomesCategorias.includes('Física & Unidades'));

    // Verifica que símbolos têm latex e simb
    const catCalculo = PALETA_SIMBOLOS_MATEMATICA.find(c => c.categoria === 'Cálculo & Análise');
    assert.ok(catCalculo.itens.some(it => it.latex === '\\int '));
    assert.ok(catCalculo.itens.some(it => it.latex === '\\partial '));
    assert.ok(catCalculo.itens.some(it => it.latex === '\\sum_{i=1}^{n} '));

    const catLogica = PALETA_SIMBOLOS_MATEMATICA.find(c => c.categoria === 'Lógica & Conjuntos');
    assert.ok(catLogica.itens.some(it => it.latex === '\\forall '));
    assert.ok(catLogica.itens.some(it => it.latex === '\\exists '));
    assert.ok(catLogica.itens.some(it => it.latex === '\\in '));
  });
});

test('Athenes — Ícones e Listas (Marcadores, Numerada e Alínea ABNT)', async t => {
  await t.test('contém ícones vetoriais lista, lista_num e lista_alinea', () => {
    assert.ok(ICONES.lista, 'Ícone lista deve existir');
    assert.ok(ICONES.lista_num, 'Ícone lista_num deve existir');
    assert.ok(ICONES.lista_alinea, 'Ícone lista_alinea deve existir');

    const svgAlinea = svgIcone('lista_alinea', 14);
    assert.match(svgAlinea, /<svg class="ath-icon "/);
    assert.match(svgAlinea, /width="14"/);
  });
});
