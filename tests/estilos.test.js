// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FONTES_SISTEMA,
  PERFIS_FORMATACAO,
  criarEstilosPadrao,
  estiloParaCss
} from '../src/core/athenes_estilos.js';

describe('Athenes — Sistema de Estilos e Perfis', () => {
  it('contém fontes do sistema seguras e identificadas', () => {
    assert.ok(FONTES_SISTEMA.nunito);
    assert.ok(FONTES_SISTEMA.times);
    assert.ok(FONTES_SISTEMA.arial);
    assert.ok(FONTES_SISTEMA.consolas);
  });

  it('perfis de formatação ABNT, APA e IEEE estão definidos com precisão', () => {
    assert.equal(PERFIS_FORMATACAO.abnt.pagina.margens_mm.t, 30);
    assert.equal(PERFIS_FORMATACAO.abnt.pagina.margens_mm.l, 30);
    assert.equal(PERFIS_FORMATACAO.abnt.citacao.recuo_citacao_longa_mm, 40);

    assert.equal(PERFIS_FORMATACAO.apa.pagina.margens_mm.t, 25.4);
    assert.equal(PERFIS_FORMATACAO.apa.citacao.entrelinha_citacao_longa, 2.0);

    assert.equal(PERFIS_FORMATACAO.ieee.pagina.grade.colunas, 2);
    assert.equal(PERFIS_FORMATACAO.ieee.citacao.sistema, 'numerico');
  });

  it('converte estilo para CSS com alinhamentos, recuos e regras editoriais', () => {
    const estilos = criarEstilosPadrao('abnt');
    const estCorpo = estilos.find(e => e.id === 'corpo');
    const estCitacao = estilos.find(e => e.id === 'citacao_direta');
    const estTitulo = estilos.find(e => e.id === 'titulo1');

    const cssCorpo = estiloParaCss(estCorpo);
    assert.ok(cssCorpo.includes('text-indent: 12.5mm'));
    assert.ok(cssCorpo.includes('line-height: 1.5'));

    const cssCitacao = estiloParaCss(estCitacao);
    assert.ok(cssCitacao.includes('margin-left: 40mm'));
    assert.ok(cssCitacao.includes('font-size: 10pt'));

    const cssTitulo = estiloParaCss(estTitulo);
    assert.ok(cssTitulo.includes('break-after: avoid'));
  });
});

describe('Entrelinha: "1" é a linha simples da fonte, como no Word', () => {
  it('fontes do Word ganham a altura da linha simples; Nunito e importadas seguem o valor cru', async () => {
    const { entrelinhaEfetiva, FATOR_LINHA_SIMPLES } = await import('../src/core/athenes_estilos.js');
    assert.equal(entrelinhaEfetiva({ fonte: 'aptos', entrelinha: 1 }), 1.22);
    assert.equal(entrelinhaEfetiva({ fonte: 'times', entrelinha: 1.5 }), 1.724); // 1,5 linhas de Times
    assert.equal(entrelinhaEfetiva({ fonte: 'nunito', entrelinha: 1.5 }), 1.5);
    assert.equal(entrelinhaEfetiva({ fonte: 'minha_fonte_importada', entrelinha: 1.2 }), 1.2);
    assert.equal(entrelinhaEfetiva({ fonte: 'aptos' }), 1.83, 'sem valor: 1,5 linhas');
    assert.ok(Object.values(FATOR_LINHA_SIMPLES).every(f => f > 1 && f < 1.4));
    const css = estiloParaCss({ id: 'x', fonte: 'aptos', entrelinha: 1 });
    assert.match(css, /line-height: 1\.22;/);
  });

  it('a estimativa de altura usa a mesma entrelinha do CSS (a paginação acompanha o que é desenhado)', async () => {
    const { parametrosTextoPt } = await import('../src/core/athenes_fragmentos.js');
    const P = parametrosTextoPt({ tipo: 'paragrafo', estiloId: 'corpo', texto: 'x' }, { estilos: { corpo: { id: 'corpo', fonte: 'aptos', tamanho_pt: 11, entrelinha: 1 } }, larguraPt: 400 });
    assert.equal(P.ent, 1.22);
  });
});
