// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarDocumento, criarNovoBloco, adicionarBlocoNaSecao, recalcularNumeracaoAutomatica,
  gerarListaFiguras, gerarListaGraficos, resolverReferenciasCruzadas, ROTULOS_FIGURA
} from '../src/core/athenes_documento.js';

describe('Athenes — Família Figura (figura, gráfico, fotografia…)', () => {
  it('cada subtipo tem rótulo, numeração e lista próprios', () => {
    const doc = criarDocumento();
    const sec = doc.secoes.find(s => s.mestraId === 'corpo');
    const f1 = adicionarBlocoNaSecao(doc, sec.id, criarNovoBloco('figura', { subtipo: 'figura', titulo: 'Figura 9 — Esquema' }));
    const g1 = adicionarBlocoNaSecao(doc, sec.id, criarNovoBloco('figura', { subtipo: 'grafico', titulo: 'Gráfico 9 — Evolução' }));
    const f2 = adicionarBlocoNaSecao(doc, sec.id, criarNovoBloco('figura', { subtipo: 'figura', titulo: 'Figura 9 — Outro' }));
    const g2 = adicionarBlocoNaSecao(doc, sec.id, criarNovoBloco('figura', { subtipo: 'grafico' }));

    const cont = recalcularNumeracaoAutomatica(doc);
    assert.equal(cont.figuras, 2);
    assert.equal(cont.porSubtipo.grafico, 2);
    assert.equal(f1.titulo.startsWith('Figura 1 —'), true);
    assert.equal(f2.titulo.startsWith('Figura 2 —'), true);
    assert.equal(g1.titulo.startsWith('Gráfico 1 —'), true);
    assert.equal(g2.titulo.startsWith('Gráfico 2 —'), true);

    assert.deepEqual(gerarListaFiguras(doc).map(i => i.rotulo), ['Figura 1', 'Figura 2']);
    assert.deepEqual(gerarListaGraficos(doc).map(i => i.rotulo), ['Gráfico 1', 'Gráfico 2']);
  });

  it('subtipo inválido vira figura e a referência cruzada usa o rótulo do bloco', () => {
    const doc = criarDocumento();
    const sec = doc.secoes.find(s => s.mestraId === 'corpo');
    const x = adicionarBlocoNaSecao(doc, sec.id, criarNovoBloco('figura', { subtipo: 'inexistente' }));
    const g = adicionarBlocoNaSecao(doc, sec.id, criarNovoBloco('figura', { subtipo: 'fluxograma' }));
    assert.equal(x.subtipo, 'figura');
    assert.equal(ROTULOS_FIGURA.fluxograma, 'Fluxograma');
    const txt = resolverReferenciasCruzadas(`ver [ref:figura:${x.id}] e [ref:fluxograma:${g.id}]`, doc);
    assert.equal(txt, 'ver Figura 1 e Fluxograma 1');
  });
});
