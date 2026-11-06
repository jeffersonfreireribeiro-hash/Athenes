// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  silabarPalavraPt,
  hifenizarPalavraPt,
  hifenizarTexto,
  hifenizarHtml,
  removerHifensCondicionais,
  SOFT_HYPHEN
} from '../src/core/athenes_hifenizacao.js';

test('Athenes — Hifenização Fonológica e Editorial em Língua Portuguesa (pt-BR)', async t => {
  await t.test('silabarPalavraPt separa corretamente palavras acadêmicas reais', () => {
    const casos = [
      { palavra: 'científicos', esperado: ['cien', 'tí', 'fi', 'cos'] },
      { palavra: 'relatórios', esperado: ['re', 'la', 'tó', 'rios'] },
      { palavra: 'técnicos', esperado: ['téc', 'ni', 'cos'] },
      { palavra: 'monografias', esperado: ['mo', 'no', 'gra', 'fias'] },
      { palavra: 'facilidade', esperado: ['fa', 'ci', 'li', 'da', 'de'] },
      { palavra: 'diagramar', esperado: ['dia', 'gra', 'mar'] },
      { palavra: 'artigos', esperado: ['ar', 'ti', 'gos'] },
      { palavra: 'escrita', esperado: ['es', 'cri', 'ta'] },
      { palavra: 'fundamentação', esperado: ['fun', 'da', 'men', 'ta', 'ção'] },
      { palavra: 'bibliográfica', esperado: ['bi', 'blio', 'grá', 'fi', 'ca'] },
      { palavra: 'metodológica', esperado: ['me', 'to', 'do', 'ló', 'gi', 'ca'] },
      { palavra: 'sólida', esperado: ['só', 'li', 'da'] },
      { palavra: 'atualizada', esperado: ['atua', 'li', 'za', 'da'] }
    ];

    for (const { palavra, esperado } of casos) {
      const obtido = silabarPalavraPt(palavra);
      assert.deepEqual(obtido, esperado, `Falha na silabação de "${palavra}": obtido ${obtido.join('-')}, esperado ${esperado.join('-')}`);
    }
  });

  await t.test('hifenizarPalavraPt insere soft hyphens e hifenizarTexto trata frases completas', () => {
    const palavraHif = hifenizarPalavraPt('científicos');
    assert.equal(palavraHif.includes(SOFT_HYPHEN), true);
    assert.equal(removerHifensCondicionais(palavraHif), 'científicos');

    const frase = 'A escrita científica exige precisão conceitual e clareza metodológica.';
    const fraseHif = hifenizarTexto(frase);
    assert.equal(fraseHif.includes(SOFT_HYPHEN), true);
    assert.equal(removerHifensCondicionais(fraseHif), frase);
  });

  await t.test('hifenizarHtml preserva tags HTML e hifeniza apenas nós de texto', () => {
    const htmlEntrada = '<p class="ath-paragrafo">A <b>escrita</b> científica com <a href="#">metodologia</a> rigorosa.</p>';
    const htmlSaida = hifenizarHtml(htmlEntrada);

    // Tags intactas
    assert.equal(htmlSaida.includes('<p class="ath-paragrafo">'), true);
    assert.equal(htmlSaida.includes('<b>'), true);
    assert.equal(htmlSaida.includes('<a href="#">'), true);

    // Texto hifenizado com soft hyphen
    assert.equal(htmlSaida.includes(SOFT_HYPHEN), true);
    assert.equal(removerHifensCondicionais(htmlSaida), htmlEntrada);
  });

  await t.test('marcação visual no meio da palavra mantém os mesmos pontos de hifenização', () => {
    const simples = hifenizarHtml('contextualização metodológica');
    const marcado = hifenizarHtml('con<span class="ath-semantic-span" data-semantic-tag="objetivos">textual</span>ização metodológica');
    assert.equal(marcado.replace(/<[^>]+>/g, ''), simples);
    assert.equal(removerHifensCondicionais(marcado), 'con<span class="ath-semantic-span" data-semantic-tag="objetivos">textual</span>ização metodológica');
  });
});

test('Athenes — Barra Rápida do Bloco ocupa a largura do bloco, abaixo dele, sem cortar controles', async t => {
  await t.test('CSS ancora .ath-bloco-barra-rapida em left:0/right:0, abaixo do bloco, com quebra de linha', () => {
    const css = fs.readFileSync(path.resolve('src/css/athenes_editor.css'), 'utf8');
    assert.match(css, /\.ath-bloco-barra-rapida\s*\{[^}]*left:\s*0;[^}]*right:\s*0;/);
    assert.match(css, /\.ath-bloco-barra-rapida\s*\{[^}]*top:\s*calc\(100% \+ 4px\);/);
    assert.match(css, /\.ath-bloco-barra-rapida\s*\{[^}]*flex-wrap:\s*wrap;/);
    assert.doesNotMatch(css, /\.ath-bloco-barra-rapida\s*\{[^}]*overflow-x:\s*auto;/, 'overflow não pode cortar controles');
  });
  await t.test('seletores da barra dividem o espaço com largura mínima legível', () => {
    const css = fs.readFileSync(path.resolve('src/css/athenes_editor.css'), 'utf8');
    assert.match(css, /\.ath-bloco-barra-rapida \.ath-sel-rapido\s*\{[^}]*flex:\s*1 1 64px;[^}]*min-width:\s*64px;/);
  });
});
