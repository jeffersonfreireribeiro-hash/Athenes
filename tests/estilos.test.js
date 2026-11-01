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
