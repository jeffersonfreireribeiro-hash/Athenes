// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Fórmulas: entrada em estilo MATLAB (convertida para LaTeX) e composição do LaTeX em HTML/texto.
 * Puro (sem DOM): serve ao editor, ao PDF e ao Word.
 */

const GREGAS = { alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'epsilon', zeta: 'zeta', eta: 'eta', theta: 'theta', lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi', rho: 'rho', sigma: 'sigma', tau: 'tau', phi: 'phi', chi: 'chi', psi: 'psi', omega: 'omega', Gamma: 'Gamma', Delta: 'Delta', Theta: 'Theta', Lambda: 'Lambda', Sigma: 'Sigma', Phi: 'Phi', Psi: 'Psi', Omega: 'Omega' };
const FUNCOES = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'min', 'max', 'det', 'lim']);
const RELACOES = { '==': '=', '=': '=', '~=': '\\neq', '!=': '\\neq', '<=': '\\leq', '>=': '\\geq', '<': '<', '>': '>' };

function tokenizar(src) {
  const toks = [];
  const re = /\s*(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|\.\^|\.\*|\.\/|==|~=|!=|<=|>=|[-+*/^()<>=,;'\[\]])/y;
  let m;
  while (re.lastIndex < src.length && (m = re.exec(src))) toks.push(m[1]);
  if (re.lastIndex < src.trimEnd().length) throw new Error('Trecho não reconhecido na expressão.');
  return toks;
}

/** Converte uma expressão em sintaxe MATLAB (x.^2, sqrt(x), a/b, pi, ...) em LaTeX. */
export function matlabParaLatex(fonte) {
  const toks = tokenizar(String(fonte ?? ''));
  let i = 0;
  const ver = () => toks[i];
  const pega = () => toks[i++];

  const semParenteses = (n) => n.grupo ? n.tex.replace(/^\\left\(([\s\S]*)\\right\)$/, '$1') : n.tex;

  function primario() {
    const t = pega();
    if (t === undefined) throw new Error('Expressão incompleta.');
    if (/^[\d.]/.test(t)) return { tex: t };
    if (t === '(') {
      const e = expr();
      if (pega() !== ')') throw new Error('Falta fechar um parêntese.');
      return { tex: `\\left(${e.tex}\\right)`, grupo: true };
    }
    if (/^[A-Za-z_]/.test(t)) {
      if (ver() === '(') {
        pega();
        const args = [];
        if (ver() !== ')') { do { args.push(expr()); } while (ver() === ',' && pega()); }
        if (pega() !== ')') throw new Error('Falta fechar um parêntese.');
        const a = args.map(x => x.tex);
        const um = args[0] ? semParenteses(args[0]) : '';
        if (t === 'sqrt') return { tex: `\\sqrt{${um}}` };
        if (t === 'exp') return { tex: `e^{${um}}` };
        if (t === 'abs') return { tex: `\\left|${um}\\right|` };
        if (t === 'nthroot' && args.length === 2) return { tex: `\\sqrt[${semParenteses(args[1])}]{${um}}` };
        if (FUNCOES.has(t)) return { tex: `\\${t}\\left(${a.join(', ')}\\right)` };
        return { tex: `${nomeSimbolo(t)}\\left(${a.join(', ')}\\right)` };
      }
      return { tex: nomeSimbolo(t) };
    }
    throw new Error(`Símbolo inesperado: ${t}`);
  }
  function nomeSimbolo(t) {
    if (t === 'inf' || t === 'Inf') return '\\infty';
    if (GREGAS[t]) return `\\${GREGAS[t]}`;
    const m = /^([A-Za-z])_?(\d+)$/.exec(t);
    if (m) return `${m[1]}_{${m[2]}}`; // x1, x_1 → x₁
    return t.length > 1 ? `\\mathrm{${t.replace(/_/g, '\\_')}}` : t;
  }
  function pos() {
    let n = primario();
    while (ver() === "'") { pega(); n = { tex: `${n.tex}^{T}` }; }
    return n;
  }
  function potencia() {
    const base = pos();
    if (ver() === '^' || ver() === '.^') {
      pega();
      const neg = ver() === '-' ? (pega(), '-') : '';
      const e = potencia();
      return { tex: `${base.tex}^{${neg}${semParenteses(e)}}` };
    }
    return base;
  }
  function unario() {
    if (ver() === '-') { pega(); const n = unario(); return { tex: `-${n.tex}` }; }
    if (ver() === '+') { pega(); return unario(); }
    return potencia();
  }
  function termo() {
    let n = unario();
    while (['*', '.*', '/', './'].includes(ver())) {
      const op = pega();
      const d = unario();
      n = op === '*' || op === '.*' ? { tex: `${n.tex} \\cdot ${d.tex}` } : { tex: `\\frac{${semParenteses(n)}}{${semParenteses(d)}}` };
    }
    return n;
  }
  function expr() {
    let n = termo();
    while (ver() === '+' || ver() === '-') { const op = pega(); const d = termo(); n = { tex: `${n.tex} ${op} ${d.tex}` }; }
    return n;
  }

  const partes = [];
  partes.push(expr().tex);
  while (i < toks.length) {
    const t = pega();
    if (RELACOES[t]) partes.push(RELACOES[t], expr().tex);
    else if (t === ';' || t === ',') partes.push(t === ',' ? ',\\;' : ';\\;', expr().tex);
    else throw new Error(`Símbolo inesperado: ${t}`);
  }
  return partes.join(' ');
}

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
export const latexParaHtml = (latex) => compor(String(latex ?? ''), 'html');

/** LaTeX → texto simples com Unicode (para o Word): frações como (a)/(b), expoentes como ^(x). */
export const latexParaTexto = (latex) => compor(String(latex ?? ''), 'texto').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Converte a entrada do bloco (LaTeX ou MATLAB) em LaTeX; em caso de erro devolve { erro } e mantém o último LaTeX válido. */
export function latexDaEntrada(fonte, sintaxe = 'latex') {
  if (sintaxe !== 'matlab') return { latex: String(fonte ?? '') };
  try { return { latex: matlabParaLatex(fonte) }; } catch (e) { return { erro: e.message }; }
}
