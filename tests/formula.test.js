// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { matlabParaLatex, latexParaHtml, latexParaTexto, latexDaEntrada } from '../src/core/athenes_formula.js';
import { criarDocumento, criarNovoBloco, recalcularNumeracaoAutomatica, formatarNumeroFormula, idFormatoNumeroFormula } from '../src/core/athenes_documento.js';
import { validarPacoteEstilo, exportarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const BS = '\\'; // barra invertida do LaTeX

test('MATLAB → LaTeX: potências, raízes, frações, funções e símbolos', () => {
  assert.equal(matlabParaLatex('x.^2 + y^2'), 'x^{2} + y^{2}');
  assert.equal(matlabParaLatex('sqrt(x^2 + 1)'), `${BS}sqrt{x^{2} + 1}`);
  assert.equal(matlabParaLatex('(a + b) / (c - d)'), `${BS}frac{a + b}{c - d}`);
  assert.equal(matlabParaLatex('x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)'), `x = ${BS}frac{-b + ${BS}sqrt{b^{2} - 4 ${BS}cdot a ${BS}cdot c}}{2 ${BS}cdot a}`);
  assert.equal(matlabParaLatex('exp(-x.^2)'), 'e^{-x^{2}}');
  assert.equal(matlabParaLatex('sin(2*pi*f*t)'), `${BS}sin${BS}left(2 ${BS}cdot ${BS}pi ${BS}cdot f ${BS}cdot t${BS}right)`);
  assert.equal(matlabParaLatex('a <= b'), `a ${BS}leq b`);
  assert.equal(matlabParaLatex('abs(x1)'), `${BS}left|x_{1}${BS}right|`);
  assert.equal(matlabParaLatex("A'"), 'A^{T}');
  assert.throws(() => matlabParaLatex('x + (y'), /parêntese/);
  assert.ok(latexDaEntrada('x +* (', 'matlab').erro);
  assert.equal(latexDaEntrada('E = m c^2', 'latex').latex, 'E = m c^2');
});

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
