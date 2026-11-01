// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Paleta Rica de Símbolos Especiais Matemáticos, Científicos e Lógicos
 * Fornece operadores, cálculo, lógica proposicional, teoria dos conjuntos,
 * alfabeto grego (minúsculo e maiúsculo), estruturas/matrizes e constantes físicas
 * para inserção com 1 clique no editor de fórmulas LaTeX.
 */

export const PALETA_SIMBOLOS_MATEMATICA = [
  {
    id: 'operadores',
    categoria: 'Operadores & Relações',
    itens: [
      { simb: '+', latex: '+' },
      { simb: '−', latex: '-' },
      { simb: '×', latex: '\\times ' },
      { simb: '÷', latex: '\\div ' },
      { simb: '±', latex: '\\pm ' },
      { simb: '∓', latex: '\\mp ' },
      { simb: '·', latex: '\\cdot ' },
      { simb: '=', latex: '=' },
      { simb: '≠', latex: '\\neq ' },
      { simb: '≈', latex: '\\approx ' },
      { simb: '≡', latex: '\\equiv ' },
      { simb: '≤', latex: '\\le ' },
      { simb: '≥', latex: '\\ge ' },
      { simb: '≪', latex: '\\ll ' },
      { simb: '≫', latex: '\\gg ' },
      { simb: '∝', latex: '\\propto ' },
      { simb: '∼', latex: '\\sim ' },
      { simb: '∞', latex: '\\infty ' }
    ]
  },
  {
    id: 'calculo',
    categoria: 'Cálculo & Análise',
    itens: [
      { simb: '∫', latex: '\\int ' },
      { simb: '∬', latex: '\\iint ' },
      { simb: '∭', latex: '\\iiint ' },
      { simb: '∮', latex: '\\oint ' },
      { simb: '∂', latex: '\\partial ' },
      { simb: '∇', latex: '\\nabla ' },
      { simb: '∑', latex: '\\sum_{i=1}^{n} ' },
      { simb: '∏', latex: '\\prod_{i=1}^{n} ' },
      { simb: 'lim', latex: '\\lim_{x \\to 0} ' },
      { simb: '√x', latex: '\\sqrt{x}' },
      { simb: 'ⁿ√x', latex: '\\sqrt[n]{x}' },
      { simb: 'dx', latex: 'dx' },
      { simb: 'dt', latex: 'dt' },
      { simb: 'Δ', latex: '\\Delta ' },
      { simb: 'δ', latex: '\\delta ' }
    ]
  },
  {
    id: 'logica',
    categoria: 'Lógica & Conjuntos',
    itens: [
      { simb: '∀', latex: '\\forall ' },
      { simb: '∃', latex: '\\exists ' },
      { simb: '∄', latex: '\\nexists ' },
      { simb: '∧', latex: '\\land ' },
      { simb: '∨', latex: '\\lor ' },
      { simb: '¬', latex: '\\neg ' },
      { simb: '⇒', latex: '\\implies ' },
      { simb: '⇔', latex: '\\iff ' },
      { simb: '→', latex: '\\to ' },
      { simb: '←', latex: '\\gets ' },
      { simb: '∈', latex: '\\in ' },
      { simb: '∉', latex: '\\notin ' },
      { simb: '⊂', latex: '\\subset ' },
      { simb: '⊆', latex: '\\subseteq ' },
      { simb: '∪', latex: '\\cup ' },
      { simb: '∩', latex: '\\cap ' },
      { simb: '∅', latex: '\\emptyset ' },
      { simb: '∴', latex: '\\therefore ' },
      { simb: '∵', latex: '\\because ' }
    ]
  },
  {
    id: 'grego',
    categoria: 'Alfabeto Grego',
    itens: [
      { simb: 'α', latex: '\\alpha ' },
      { simb: 'β', latex: '\\beta ' },
      { simb: 'γ', latex: '\\gamma ' },
      { simb: 'δ', latex: '\\delta ' },
      { simb: 'ε', latex: '\\epsilon ' },
      { simb: 'ζ', latex: '\\zeta ' },
      { simb: 'η', latex: '\\eta ' },
      { simb: 'θ', latex: '\\theta ' },
      { simb: 'λ', latex: '\\lambda ' },
      { simb: 'μ', latex: '\\mu ' },
      { simb: 'π', latex: '\\pi ' },
      { simb: 'ρ', latex: '\\rho ' },
      { simb: 'σ', latex: '\\sigma ' },
      { simb: 'τ', latex: '\\tau ' },
      { simb: 'φ', latex: '\\phi ' },
      { simb: 'ψ', latex: '\\psi ' },
      { simb: 'ω', latex: '\\omega ' },
      { simb: 'Γ', latex: '\\Gamma ' },
      { simb: 'Δ', latex: '\\Delta ' },
      { simb: 'Θ', latex: '\\Theta ' },
      { simb: 'Λ', latex: '\\Lambda ' },
      { simb: 'Π', latex: '\\Pi ' },
      { simb: 'Σ', latex: '\\Sigma ' },
      { simb: 'Φ', latex: '\\Phi ' },
      { simb: 'Ψ', latex: '\\Psi ' },
      { simb: 'Ω', latex: '\\Omega ' }
    ]
  },
  {
    id: 'estruturas',
    categoria: 'Estruturas & Notação',
    itens: [
      { simb: 'a/b', latex: '\\frac{a}{b}' },
      { simb: 'xⁿ', latex: 'x^{n}' },
      { simb: 'xᵢ', latex: 'x_{i}' },
      { simb: 'xⁿᵢ', latex: 'x_{i}^{n}' },
      { simb: 'v⃗', latex: '\\vec{v}' },
      { simb: 'x̂', latex: '\\hat{x}' },
      { simb: 'x̄', latex: '\\bar{x}' },
      { simb: 'ẋ', latex: '\\dot{x}' },
      { simb: 'ẍ', latex: '\\ddot{x}' },
      { simb: '(·)', latex: '\\left( x \\right)' },
      { simb: '[·]', latex: '\\left[ x \\right]' },
      { simb: '{·}', latex: '\\left\\{ x \\right\\}' },
      { simb: '[matriz]', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { simb: '{sistema}', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}' }
    ]
  },
  {
    id: 'fisica',
    categoria: 'Física & Unidades',
    itens: [
      { simb: 'ℏ', latex: '\\hbar ' },
      { simb: 'Å', latex: '\\AA ' },
      { simb: '°C', latex: '^\\circ\\text{C}' },
      { simb: 'Ω', latex: '\\Omega ' },
      { simb: 'μm', latex: '\\mu\\text{m}' },
      { simb: 'kg', latex: '\\text{kg}' },
      { simb: 'm/s²', latex: '\\text{m/s}^2' },
      { simb: 'N', latex: '\\text{N}' },
      { simb: 'J', latex: '\\text{J}' },
      { simb: 'W', latex: '\\text{W}' },
      { simb: 'Pa', latex: '\\text{Pa}' },
      { simb: 'MPa', latex: '\\text{MPa}' }
    ]
  }
];

/**
 * Cria o elemento visual do seletor de símbolos para embutir no editor de fórmulas
 */
export function criarSeletorSimbolosMatematica(onInserir) {
  const container = document.createElement('div');
  container.className = 'ath-seletor-simbolos-mat';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '6px';
  container.style.margin = '6px 0 10px 0';
  container.style.padding = '8px';
  container.style.border = '1px solid var(--ath-primary-line, #C8D7E6)';
  container.style.borderRadius = '10px';
  container.style.background = '#FFFFFF';

  let catAtivaId = PALETA_SIMBOLOS_MATEMATICA[0].id;

  const abasBox = document.createElement('div');
  abasBox.style.display = 'flex';
  abasBox.style.gap = '4px';
  abasBox.style.overflowX = 'auto';
  abasBox.style.paddingBottom = '4px';
  abasBox.style.scrollbarWidth = 'none';

  const gradeBox = document.createElement('div');
  gradeBox.style.display = 'flex';
  gradeBox.style.flexWrap = 'wrap';
  gradeBox.style.gap = '4px';
  gradeBox.style.maxHeight = '96px';
  gradeBox.style.overflowY = 'auto';
  gradeBox.style.padding = '4px 2px';

  function renderizarAbas() {
    abasBox.innerHTML = '';
    PALETA_SIMBOLOS_MATEMATICA.forEach(cat => {
      const btnAba = document.createElement('button');
      btnAba.type = 'button';
      const ativa = cat.id === catAtivaId;
      btnAba.className = `glx-btn glx-btn-xs ${ativa ? 'glx-btn-primary' : 'glx-btn-soft'}`;
      btnAba.style.fontSize = '10.5px';
      btnAba.style.padding = '2px 7px';
      btnAba.style.whiteSpace = 'nowrap';
      btnAba.textContent = cat.categoria.split('&')[0].trim();
      btnAba.title = cat.categoria;
      btnAba.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        catAtivaId = cat.id;
        renderizarAbas();
        renderizarGrade();
      });
      abasBox.appendChild(btnAba);
    });
  }

  function renderizarGrade() {
    gradeBox.innerHTML = '';
    const cat = PALETA_SIMBOLOS_MATEMATICA.find(c => c.id === catAtivaId) || PALETA_SIMBOLOS_MATEMATICA[0];
    cat.itens.forEach(item => {
      const btnSimbolo = document.createElement('button');
      btnSimbolo.type = 'button';
      btnSimbolo.className = 'ath-btn-simbolo-mat';
      btnSimbolo.style.minWidth = '28px';
      btnSimbolo.style.height = '26px';
      btnSimbolo.style.padding = '0 6px';
      btnSimbolo.style.border = '1px solid #E2E8F0';
      btnSimbolo.style.borderRadius = '6px';
      btnSimbolo.style.background = '#F8FAFC';
      btnSimbolo.style.color = '#1E293B';
      btnSimbolo.style.fontFamily = "'Cambria Math', 'Times New Roman', serif";
      btnSimbolo.style.fontSize = '13px';
      btnSimbolo.style.cursor = 'pointer';
      btnSimbolo.style.display = 'inline-flex';
      btnSimbolo.style.alignItems = 'center';
      btnSimbolo.style.justifyContent = 'center';
      btnSimbolo.style.transition = 'background .1s, border-color .1s, transform .08s';
      btnSimbolo.textContent = item.simb;
      btnSimbolo.title = `Inserir ${item.latex}`;

      btnSimbolo.addEventListener('mouseenter', () => {
        btnSimbolo.style.background = '#EEF4FA';
        btnSimbolo.style.borderColor = '#314F79';
        btnSimbolo.style.color = '#314F79';
      });
      btnSimbolo.addEventListener('mouseleave', () => {
        btnSimbolo.style.background = '#F8FAFC';
        btnSimbolo.style.borderColor = '#E2E8F0';
        btnSimbolo.style.color = '#1E293B';
      });

      btnSimbolo.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onInserir === 'function') {
          onInserir(item.latex);
        }
      });
      gradeBox.appendChild(btnSimbolo);
    });
  }

  renderizarAbas();
  renderizarGrade();

  container.appendChild(abasBox);
  container.appendChild(gradeBox);
  return container;
}
