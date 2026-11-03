// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Fórmulas: composição do LaTeX em HTML/texto (frações, raízes, expoentes, símbolos).
 * Puro (sem DOM): serve ao editor, ao PDF e ao Word.
 */

const FUNCOES = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'min', 'max', 'det', 'lim']);

const SIMBOLOS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', times: '×', pm: '±', mp: '∓', div: '÷', leq: '≤', geq: '≥', neq: '≠', approx: '≈', equiv: '≡', infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
  rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', in: '∈', forall: '∀', exists: '∃', ldots: '…', cdots: '⋯', degree: '°', circ: '°'
};
const ESPACOS = { ',': ' ', ';': ' ', ':': ' ', '!': '' };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lê um argumento entre chaves (ou 1 caractere/comando) a partir de `i`; devolve [conteúdo, próximoÍndice]. */
function argumento(s, i) {
  while (s[i] === ' ') i += 1;
  if (s[i] === '{') {
    let nivel = 1; let j = i + 1;
    while (j < s.length && nivel) { if (s[j] === '{') nivel += 1; else if (s[j] === '}') nivel -= 1; j += 1; }
    return [s.slice(i + 1, j - 1), j];
  }
  if (s[i] === '\\') { const m = /^\\[A-Za-z]+/.exec(s.slice(i)); if (m) return [m[0], i + m[0].length]; }
  return [s[i] ?? '', i + 1];
}

/** Tira o que o LaTeX usa em volta da expressão ($…$, \[…\], equation, \label, \tag): o número da fórmula é automático. */
export function limparEnvoltorioLatex(latex) {
  return String(latex ?? '')
    .replace(/\\(?:begin|end)\{(?:equation|align|gather|displaymath|math)\*?\}/g, '')
    .replace(/\\(?:label|tag|nonumber|notag|displaystyle|textstyle)(?:\{[^}]*\})?/g, '')
    .replace(/\\[\[\]()]/g, '')
    .replace(/\$\$|\$/g, '')
    .replace(/&/g, ' ')
    .replace(/\\\\/g, ' ; ')
    .trim();
}

const ACENTOS = { hat: '\u0302', bar: '\u0304', vec: '\u20D7', dot: '\u0307', ddot: '\u0308', tilde: '\u0303', overline: '\u0305' };

function compor(s, modo) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (m) {
        const nome = m[1];
        i += m[0].length;
        if (nome === 'frac') {
          const [a, ia] = argumento(s, i); const [b, ib] = argumento(s, ia); i = ib;
          out += modo === 'html'
            ? `<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 .15em;line-height:1.15;"><span style="padding:0 .2em;border-bottom:1px solid currentColor;">${compor(a, modo)}</span><span style="padding:0 .2em;">${compor(b, modo)}</span></span>`
            : `(${compor(a, modo)})/(${compor(b, modo)})`;
        } else if (nome === 'sqrt') {
          let indice = '';
          if (s[i] === '[') { const f = s.indexOf(']', i); indice = s.slice(i + 1, f); i = f + 1; }
          const [a, ia] = argumento(s, i); i = ia;
          out += modo === 'html'
            ? `${indice ? `<sup style="font-size:.6em;">${compor(indice, modo)}</sup>` : ''}√<span style="border-top:1px solid currentColor;padding:0 .15em;">${compor(a, modo)}</span>`
            : `${indice ? compor(indice, modo) : ''}√(${compor(a, modo)})`;
        } else if (nome === 'left' || nome === 'right') {
          if (s[i] === '.') i += 1; // \left. \right.
        } else if (nome === 'mathrm' || nome === 'text' || nome === 'mathbf' || nome === 'operatorname') {
          const [a, ia] = argumento(s, i); i = ia;
          out += nome === 'mathbf' && modo === 'html' ? `<b>${esc(a)}</b>` : esc(a);
        } else if (ACENTOS[nome]) {
          const [a, ia] = argumento(s, i); i = ia;
          const base = compor(a, modo);
          out += nome === 'overline' && modo === 'html' ? `<span style="border-top:1px solid currentColor;">${base}</span>` : (modo === 'html' ? `${base}${ACENTOS[nome]}` : `${a}${ACENTOS[nome]}`);
        } else if (nome === 'binom') {
          const [a, ia] = argumento(s, i); const [b, ib] = argumento(s, ia); i = ib;
          out += `(${compor(a, modo)} ${compor(b, modo)})`;
        } else if (nome === 'quad' || nome === 'qquad') {
          out += '  ';
        } else if (FUNCOES.has(nome)) {
          out += `${nome}`;
        } else {
          out += SIMBOLOS[nome] ?? esc(`\\${nome}`);
        }
        continue;
      }
      const prox = s[i + 1];
      if (prox !== undefined && ESPACOS[prox] !== undefined) { out += ESPACOS[prox]; i += 2; continue; }
      out += esc(prox ?? ''); i += 2; continue; // \{ \} \_ \% ...
    }
    if (c === '^' || c === '_') {
      const [a, ia] = argumento(s, i + 1); i = ia;
      const dentro = compor(a, modo);
      out += modo === 'html' ? `<${c === '^' ? 'sup' : 'sub'} style="font-size:.7em;line-height:0;">${dentro}</${c === '^' ? 'sup' : 'sub'}>` : (c === '^' ? `^(${dentro})` : `_(${dentro})`);
      continue;
    }
    if (c === '{' || c === '}') { i += 1; continue; }
    out += esc(c);
    i += 1;
  }
  return out;
}

/** LaTeX → HTML composto (frações, raízes, expoentes, índices e símbolos); texto sem LaTeX passa como está. */
export const latexParaHtml = (latex) => compor(limparEnvoltorioLatex(latex), 'html');

/** LaTeX → texto simples com Unicode (para o Word): frações como (a)/(b), expoentes como ^(x). */
export const latexParaTexto = (latex) => compor(limparEnvoltorioLatex(latex), 'texto').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
