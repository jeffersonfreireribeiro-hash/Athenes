// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { latexParaHtml, latexParaTexto } from '../src/core/athenes_formula.js';
import { criarDocumento, criarNovoBloco, recalcularNumeracaoAutomatica, formatarNumeroFormula, idFormatoNumeroFormula } from '../src/core/athenes_documento.js';
import { validarPacoteEstilo, exportarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const BS = '\\'; // barra invertida do LaTeX

test('LaTeX composto em HTML e em texto', () => {
  const html = latexParaHtml(`${BS}frac{a}{b} + x^{2} + ${BS}alpha_1 ${BS}cdot ${BS}sqrt{y}`);
  assert.match(html, /<sup[^>]*>2<\/sup>/);
  assert.match(html, /<sub[^>]*>1<\/sub>/);
  assert.ok(html.includes('α') && html.includes('·') && html.includes('√'));
  assert.ok(!html.includes(`${BS}frac`));
  assert.equal(latexParaTexto(`${BS}frac{a}{b} + x^{2}`), '(a)/(b) + x^(2)');
  assert.ok(!latexParaHtml('<script>').includes('<script>'));
});

function docComFormulas(formatoDoc) {
  const doc = criarDocumento();
  if (formatoDoc) doc.formato_numero_formula = formatoDoc;
  const sec = doc.secoes[1] || doc.secoes[0];
  sec.blocos.length = 0;
  const f = () => criarNovoBloco('formula', { latex: 'x' });
  const f1 = f(); const f2 = f(); const f3 = f();
  sec.blocos.push(criarNovoBloco('titulo', { nivel: 1, texto: 'A' }), f1, f2, criarNovoBloco('titulo', { nivel: 1, texto: 'B' }), f3);
  return { doc, f1, f2, f3 };
}

test('número da fórmula é sempre automático, mesmo se alguém escrever um valor', () => {
  const { doc, f1, f2 } = docComFormulas();
  f1.numero_equacao = '(99)'; f1.numero = '(99)';
  recalcularNumeracaoAutomatica(doc);
  assert.equal(f1.numero_equacao, '(1)');
  assert.equal(f2.numero_equacao, '(2)');
  assert.equal(criarNovoBloco('formula', { numero_equacao: '(7)' }).numero_equacao, '(1)');
});

test('formatos do número: por capítulo, colchetes, só o número, com Eq. e sobrescrita no bloco', () => {
  const a = docComFormulas('capitulo'); recalcularNumeracaoAutomatica(a.doc);
  assert.deepEqual([a.f1.numero, a.f2.numero, a.f3.numero], ['(1.1)', '(1.2)', '(2.1)']);
  const b = docComFormulas('colchetes'); b.f2.formato_numero = 'eq'; recalcularNumeracaoAutomatica(b.doc);
  assert.deepEqual([b.f1.numero, b.f2.numero, b.f3.numero], ['[1]', 'Eq. (2)', '[3]']);
  assert.equal(formatarNumeroFormula('simples', 4), '4');
  assert.equal(idFormatoNumeroFormula({}, {}), 'parenteses');
});

test('pacote de tema leva o formato do número da fórmula e o prompt de IA o descreve', () => {
  const { doc } = docComFormulas('capitulo');
  const pacote = exportarPacoteEstilo(doc);
  assert.equal(pacote.configuracaoGlobal.formato_numero_formula, 'capitulo');
  const v = validarPacoteEstilo(JSON.stringify(pacote));
  assert.equal(v.pacote.configuracaoGlobal.formato_numero_formula, 'capitulo');
  const ruim = JSON.parse(JSON.stringify(pacote)); ruim.configuracaoGlobal.formato_numero_formula = 'xx';
  assert.equal(validarPacoteEstilo(JSON.stringify(ruim)).pacote.configuracaoGlobal.formato_numero_formula, undefined);
  assert.match(obterPromptIaParaExtracaoDeLayout(), /formato_numero_formula/);
});

test('LaTeX colado do artigo: $…$, equation, \label e \tag não aparecem e o número segue automático', () => {
  const colado = `${BS}begin{equation} E = mc^{2} ${BS}label{eq:einstein} ${BS}tag{9} ${BS}end{equation}`;
  const html = latexParaHtml(colado);
  assert.ok(!/label|tag|begin|equation/.test(html), html);
  assert.match(html, /E = mc<sup[^>]*>2<\/sup>/);
  assert.equal(latexParaTexto('$$x^{2}$$'), 'x^(2)');
  assert.ok(latexParaHtml(`${BS}hat{x} + ${BS}overline{y}`).includes('x\u0302'));
});
