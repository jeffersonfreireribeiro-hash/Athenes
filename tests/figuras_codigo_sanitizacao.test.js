// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarSvg, sanitizarHtml, sanitizarCss, parseMarcacao, formatarMarcacao, comprimentoParaPx, valorCssSeguro
} from '../src/core/athenes_marcacao_segura.js';

describe('Athenes — Sanitizador de SVG próprio (sem DOMPurify)', () => {
  it('remove scripts, eventos, foreignObject, animações e links externos; mantém defs, gradientes, style e viewBox', () => {
    const r = sanitizarSvg(`<svg viewBox="0 0 100 50" onload="alert(1)">
      <script>alert(1)</script>
      <defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><style>.a{fill:url(#g)}</style></defs>
      <rect class="a" width="10" height="10" onclick="x()" fill="url(#g)"/>
      <foreignObject width="10" height="10"><div onclick="x()">oi</div></foreignObject>
      <animate attributeName="x" to="1"/><set attributeName="href" to="javascript:alert(1)"/>
      <a href="javascript:alert(1)"><text x="1" y="2">A &amp; B</text></a>
      <use href="https://evil.test/x.svg#a"/><image href="https://evil.test/p.png"/>
      <circle r="3" style="fill:red;background:url(http://evil.test/x)"/>
    </svg>`);
    assert.equal(r.ok, true);
    assert.ok(!/script|onload|onclick|foreignObject|<animate|<set|javascript:|evil\.test|<image|<use/i.test(r.svg), r.svg);
    assert.match(r.svg, /<defs>/);
    assert.match(r.svg, /<linearGradient id="g">/);
    assert.match(r.svg, /<stop offset="0" stop-color="red"\/>/);
    assert.match(r.svg, /<style>\.a\{fill:url\(#g\)\}<\/style>/);
    assert.match(r.svg, /viewBox="0 0 100 50"/);
    assert.match(r.svg, /<text x="1" y="2">A &amp; B<\/text>/); // links viram só conteúdo
    assert.match(r.svg, /<circle r="3" style="fill:red"\/>/); // url() externo cai da declaração
    assert.ok(r.avisos.length >= 5);
  });

  it('sem viewBox, calcula de width/height (com unidades) para escalar sem cortar', () => {
    const mm = sanitizarSvg('<svg width="100mm" height="50mm"><rect width="5" height="5"/></svg>');
    assert.ok(Math.abs(mm.viewBox[2] - 377.95) < 0.1 && Math.abs(mm.viewBox[3] - 188.98) < 0.1);
    assert.match(mm.svg, /viewBox="0 0 377\.9528 188\.9764"/);
    assert.ok(!/ width=| height=/.test(mm.svg.replace(/<rect[^>]*>/, '')), 'width/height da raiz são removidos: o contêiner dimensiona');
    const px = sanitizarSvg('<svg width="200" height="100"></svg>');
    assert.deepEqual(px.viewBox, [0, 0, 200, 100]);
    const so = sanitizarSvg('<svg height="120"></svg>');
    assert.equal(so.viewBox[3], 120);
    const nada = sanitizarSvg('<svg><g/></svg>');
    assert.deepEqual(nada.viewBox, [0, 0, 300, 150]);
    assert.ok(nada.avisos.some(a => /viewBox/.test(a)));
    assert.equal(comprimentoParaPx('2.54cm'), 96);
    assert.equal(comprimentoParaPx('50%'), null);
  });

  it('prefixa ids e referências (várias figuras no mesmo documento não colidem) e escopa o CSS', () => {
    const r = sanitizarSvg(`<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/><marker id="m"/><style>svg{fill:red} #g{opacity:.5} .x{stroke:url(#g)}</style></defs>
      <path d="M0 0" fill="url(#g)" marker-end="url(#m)"/><use href="#m"/></svg>`, { prefixoId: 'f9_0-', escopoCss: '[data-ath-esc="f9_0"]' });
    assert.match(r.svg, /id="f9_0-g"/);
    assert.match(r.svg, /fill="url\(#f9_0-g\)"/);
    assert.match(r.svg, /marker-end="url\(#f9_0-m\)"/);
    assert.match(r.svg, /href="#f9_0-m"/);
    assert.match(r.svg, /\[data-ath-esc="f9_0"\]\{fill:red\}/);
    assert.match(r.svg, /\[data-ath-esc="f9_0"\] \.x\{stroke:url\(#f9_0-g\)\}/);
    assert.match(r.svg, /\[data-ath-esc="f9_0"\] #f9_0-g\{opacity:\.5\}|#f9_0-g\{opacity:\.5\}/);
  });

  it('aceita imagem embutida (data:image) e recusa data:text/html, vbscript e escapes de CSS', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const ok = sanitizarSvg(`<svg viewBox="0 0 1 1"><image href="${png}" width="1" height="1"/></svg>`);
    assert.match(ok.svg, /<image href="data:image\/png;base64,iVBORw0KGgo="/);
    const ruim = sanitizarSvg('<svg viewBox="0 0 1 1"><image href="data:text/html;base64,PHNjcmlwdD4="/><rect fill="java\nscript:alert(1)"/><rect style="background:\\6a avascript:alert(1)"/></svg>');
    assert.ok(!/data:text|javascript/i.test(ruim.svg), ruim.svg);
    assert.equal(valorCssSeguro('expression(alert(1))'), null);
    assert.equal(valorCssSeguro('url(https://x.test/a.png)'), null);
    assert.equal(valorCssSeguro('url(#a)', { prefixoId: 'p-' }), 'url(#p-a)');
  });

  it('valida sintaxe com número de linha e recusa o que não é SVG', () => {
    const r = sanitizarSvg('<svg viewBox="0 0 1 1">\n  <g>\n    <rect/>\n</svg>');
    assert.equal(r.ok, false);
    assert.ok(r.erros.some(e => e.linha >= 1 && /não foi fechada|aberta/.test(e.mensagem)), JSON.stringify(r.erros));
    assert.equal(sanitizarSvg('<div>oi</div>').ok, false);
    assert.equal(sanitizarSvg('   ').ok, false);
    assert.equal(sanitizarSvg('<svg><rect/>' + 'x'.repeat(700000) + '</svg>').ok, false);
  });

  it('nome de elementos/atributos em outra caixa é normalizado e eventos em qualquer caixa caem', () => {
    const r = sanitizarSvg('<SVG VIEWBOX="0 0 4 4"><LINEARGRADIENT ID="a"/><RECT ONCLICK="x()" WIDTH="2" HEIGHT="2"/></SVG>');
    assert.match(r.svg, /viewBox="0 0 4 4"/);
    assert.match(r.svg, /<linearGradient id="a"><\/linearGradient>/);
    assert.ok(!/onclick/i.test(r.svg));
  });
});

describe('Athenes — Sanitizador de HTML/CSS para figuras HTML+CSS', () => {
  it('remove script/iframe/form/eventos/links/imagens externas e escopa o <style>', () => {
    const r = sanitizarHtml(`<style>.c{color:blue;background:url(http://evil.test/a.png)} body{margin:0} @import url(x.css); @font-face{src:url(x)}</style>
      <div class="c" onclick="x()" style="color:red;behavior:url(x)"><script>alert(1)</script><iframe src="x"></iframe><form><input></form>
      <b>oi</b><img src="https://evil.test/p.png"><a href="javascript:alert(1)">link</a><svg viewBox="0 0 2 2"><rect width="1" height="1" onload="x()"/></svg></div>`,
    { escopoCss: '[data-ath-esc="f1_0"]', prefixoId: 'f1_0-' });
    assert.equal(r.ok, true);
    assert.ok(!/script|iframe|<form|<input|onclick|onload|javascript:|evil\.test|<a /i.test(r.html + r.css), r.html + r.css);
    assert.match(r.html, /<div class="c" style="color:red">/);
    assert.match(r.html, /<b>oi<\/b>/);
    assert.match(r.html, /link/); // o texto do link permanece
    assert.match(r.html, /<svg /);
    assert.match(r.css, /\[data-ath-esc="f1_0"\] \.c\{color:blue\}/);
    assert.match(r.css, /\[data-ath-esc="f1_0"\]\{margin:0\}/); // body → o próprio escopo
    assert.ok(!/@import|@font-face/.test(r.css));
  });

  it('CSS: @media é mantido (escopado), @keyframes e url() externo são descartados', () => {
    const css = sanitizarCss('@media (max-width:600px){.a{width:100%}} @keyframes k{from{opacity:0}} .b{background:url(javascript:1)} .c{margin:0}', { escopo: '#esc' });
    assert.match(css, /@media \(max-width:600px\)\{#esc \.a\{width:100%\}\}/);
    assert.ok(!/keyframes|javascript/.test(css));
    assert.match(css, /#esc \.c\{margin:0\}/);
  });

  it('parser tolerante: tags void do HTML, atributos sem aspas e fechamento implícito', () => {
    const { raiz, erros } = parseMarcacao('<p class=a>um<br>dois<img src=x></p><ul><li>a<li>b</ul>', { modo: 'html' });
    assert.equal(raiz.filhos[0].tag, 'p');
    assert.equal(raiz.filhos[0].attrs[0][1], 'a');
    assert.ok(erros.every(e => e.nivel === 'aviso'));
  });

  it('formatar reindenta SVG', () => {
    const f = formatarMarcacao('<svg viewBox="0 0 1 1"><g><rect width="1" height="1"/><text>oi</text></g></svg>', 'svg');
    assert.equal(f, '<svg viewBox="0 0 1 1">\n  <g>\n    <rect width="1" height="1"/>\n    <text>oi</text>\n  </g>\n</svg>');
  });
});
