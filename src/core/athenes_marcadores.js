// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Marcadores e numeração de parágrafos e títulos.
 *
 * A configuração mora no ESTILO de texto (`marcador_*`) e só nele (o bloco não sobrescreve nada).
 * Este módulo resolve a configuração efetiva e a sequência dos números, para o editor, o PDF e o Word mostrarem o mesmo.
 */
import { estiloIdDoTitulo } from './athenes_sumario.js';

export const TIPOS_MARCADOR = Object.freeze([
  ['nenhum', 'Nenhum'],
  ['circulo', '•  Ponto (círculo)'],
  ['traco', '–  Travessão / alínea'],
  ['quadrado', '▪  Quadrado'],
  ['ponto_traco', '·–  Ponto-traço'],
  ['simbolo', 'Símbolo da paleta'],
  ['numero', '1, 2, 3…  Numeração']
]);

export const ESTILOS_NUMERO = Object.freeze([
  ['decimal', '1, 2, 3…'],
  ['decimal_zero', '01, 02, 03…'],
  ['ordinal', '1º, 2º, 3º…'],
  ['lower_alpha', 'a, b, c…'],
  ['upper_alpha', 'A, B, C…'],
  ['lower_roman', 'i, ii, iii…'],
  ['upper_roman', 'I, II, III…'],
  ['lower_greek', 'α, β, γ…']
]);

export const SEPARADORES_NUMERO = Object.freeze([
  ['ponto', '1.'],
  ['parentese', '1)'],
  ['entre_parenteses', '(1)'],
  ['travessao', '1 –'],
  ['colchetes', '[1]'],
  ['dois_pontos', '1:'],
  ['seta', '1 ›'],
  ['ponto_traco', '1.–']
]);

/** Categorias completas de símbolos para marcadores editoriais, acadêmicos, geométricos e de destaque. */
export const CATEGORIAS_SIMBOLOS_MARCADOR = Object.freeze([
  Object.freeze({
    id: 'classicos',
    rotulo: 'Clássicos e Pontos',
    simbolos: Object.freeze(['•', '◦', '∙', '·', '⋅', '●', '○', '◉', '◎', '◌', '◍', '◐', '◑', '◒', '◓', '◔', '◕', '⚬', '⚭', '⚮', '⁌', '⁍', '‣', '⁃'])
  }),
  Object.freeze({
    id: 'geometricos',
    rotulo: 'Geométricos e Formas',
    simbolos: Object.freeze(['▪', '▫', '■', '□', '▢', '▣', '▤', '▥', '▦', '▧', '▨', '▩', '◻', '◼', '◽', '◾', '◧', '◨', '◩', '◪', '◆', '◇', '◈', '◊', '⬘', '⬙', '⬚', '▲', '△', '▴', '▵', '▼', '▽', '▾', '▿', '◀', '◁', '◂', '◃', '⬢', '⬡', '⬟', '⬠', '◯'])
  }),
  Object.freeze({
    id: 'setas',
    rotulo: 'Setas e Indicadores',
    simbolos: Object.freeze(['▸', '▹', '►', '▻', '▶', '▷', '➔', '➜', '➤', '➢', '➣', '→', '↠', '↣', '↦', '↪', '↬', '⇀', '⇒', '⟹', '⇨', '⇾', '»', '›', '❯', '❱', '⋙', '⟡', '☞', '☛', '☜', '↳', '↴', '↵', '↗', '↘', '⟲', '⟳', '⟿', '⤇'])
  }),
  Object.freeze({
    id: 'alineas',
    rotulo: 'Travessões e Alíneas',
    simbolos: Object.freeze(['–', '—', '―', '‒', '·–', '•–', '—•', '›–', '»–', '~', '∼', '≈', '≡', '∷', '∶', '⊢', '⊣', '⊤', '⊥', '∣', '∥', '⋮', '⋯', '⸰'])
  }),
  Object.freeze({
    id: 'estrelas',
    rotulo: 'Estrelas e Ornamentos',
    simbolos: Object.freeze(['★', '☆', '✦', '✧', '✪', '✫', '✬', '✭', '✮', '✯', '✰', '✱', '✲', '✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽', '✾', '✿', '❀', '❁', '❂', '❃', '❇', '❈', '❉', '❊', '❋', '❖', '❦', '❧', '☙', '❘', '❙', '❚'])
  }),
  Object.freeze({
    id: 'status',
    rotulo: 'Checks e Status',
    simbolos: Object.freeze(['✓', '✔', '☑', '✗', '✘', '☒', '☐', '✕', '✖', '✚', '➕', '➖', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊜', '⊝', '⊞', '⊟', '⊠', '⊡', '⚑', '⚐', '⚠', '⚡', '⏳', '⌛', '🔒', '🔓', '📌', '📍', '🔔'])
  }),
  Object.freeze({
    id: 'editorial',
    rotulo: 'Editorial e Acadêmico',
    simbolos: Object.freeze(['§', '¶', '†', '‡', '※', '⁂', '⁑', '⁜', '⸫', '⸬', '⸭', '✎', '✏', '✒', '✑', '⌘', '⌥', '⌖', '⌗', '℗', '©', '®', '™', '№', 'º', 'ª', '°', '‰', '∟', '∠', '∴', '∵', '∞', '∆', '∇', '∂', '∫', '∑', '∏', '√', '∝', '∈', '⊂', '∪', '∩', '∧', '∨', '∀', '∃', 'ℵ'])
  }),
  Object.freeze({
    id: 'destaques',
    rotulo: 'Avaliação e Destaques',
    simbolos: Object.freeze(['♥', '♡', '♦', '♢', '♠', '♤', '♣', '♧', '☀', '☼', '☾', '☽', '☁', '☂', '☃', '☄', '♪', '♫', '♬', '♭', '♮', '♯', '🔥', '👍', '👎', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '👑', '💎', '🎯', '🚀', '💡', '🍀', '🌱', '🌿', '🧭', '⚖', '⚙', '⚗', '🔬', '🔭', '📚', '📖', '🏷', '💬', '💭', '✨', '💯'])
  })
]);

/** Paleta plana de símbolos para marcadores (qualquer um serve; fica em `marcador_simbolo` com `marcador_tipo: "simbolo"`). */
export const SIMBOLOS_MARCADOR = Object.freeze(CATEGORIAS_SIMBOLOS_MARCADOR.flatMap(c => c.simbolos));

/** Formatos de sequência: cada estilo de numeração com cada pontuação (64 combinações). */
export const FORMATOS_SEQUENCIA = Object.freeze(ESTILOS_NUMERO.flatMap(([estilo]) => SEPARADORES_NUMERO.map(([sep]) => ({ estilo, sep }))));

export const CAMPOS_MARCADOR = Object.freeze(['marcador_tipo', 'marcador_simbolo', 'marcador_estilo_num', 'marcador_separador', 'marcador_inicio', 'marcador_nivel', 'marcador_tab_mm', 'marcador_alinhamento']);

const GLIFOS = { circulo: '•', traco: '–', quadrado: '▪', ponto_traco: '·–' };
const TIPOS_VALIDOS = new Set(TIPOS_MARCADOR.map(t => t[0]));
const ALINHAMENTOS = new Set(['left', 'center', 'right']);

/** Símbolo de marcador aceito: texto curto (até 2 caracteres), sem marcação nem caracteres de controle; senão ''. */
export const simboloValido = (v) => {
  const t = Array.from(String(v ?? '').trim());
  return t.length >= 1 && t.length <= 2 && !/[<>&"'\\\u0000-\u001f]/.test(t.join('')) ? t.join('') : '';
};

const inteiro = (v, min, max, pad) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad; };

/** Configuração efetiva do marcador (só o estilo; `bloco` fica na assinatura por compatibilidade) ou null quando o parágrafo não tem marcador. */
export function marcadorEfetivo(bloco, estilo) {
  const tipo = estilo?.marcador_tipo;
  if (!tipo || tipo === 'nenhum' || !TIPOS_VALIDOS.has(tipo)) return null;
  const pega = (k, pad) => estilo?.[k] ?? pad;
  const alin = pega('marcador_alinhamento', 'left');
  return {
    tipo,
    simbolo: simboloValido(estilo?.marcador_simbolo) || '•',
    estiloNum: pega('marcador_estilo_num', 'decimal'),
    separador: pega('marcador_separador', 'ponto'),
    inicio: inteiro(estilo?.marcador_inicio, 1, 999, 1),
    inicioExplicito: false, // a numeração corre pelo documento; recomeça com um bloco sem marcador no meio
    nivel: inteiro(pega('marcador_nivel', 1), 1, 5, 1),
    tabMm: Math.max(3, parseFloat(pega('marcador_tab_mm', 7)) || 7),
    alinhamento: ALINHAMENTOS.has(alin) ? alin : 'left'
  };
}

const ROMANOS = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
const GREGOS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];

export function formatarNumeroMarcador(n, estiloNum = 'decimal') {
  const v = Math.max(1, Math.floor(n) || 1);
  const letras = (x) => { let s = ''; let r = x; while (r > 0) { r -= 1; s = String.fromCharCode(97 + (r % 26)) + s; r = Math.floor(r / 26); } return s; };
  const grego = (x) => { let s = ''; let r = x; while (r > 0) { r -= 1; s = GREGOS[r % GREGOS.length] + s; r = Math.floor(r / GREGOS.length); } return s; };
  const romano = () => { let r = v; let s = ''; for (const [val, sim] of ROMANOS) while (r >= val) { s += sim; r -= val; } return s; };
  switch (estiloNum) {
    case 'decimal_zero': return String(v).padStart(2, '0');
    case 'ordinal': return `${v}º`;
    case 'lower_alpha': return letras(v);
    case 'upper_alpha': return letras(v).toUpperCase();
    case 'lower_roman': return romano();
    case 'upper_roman': return romano().toUpperCase();
    case 'lower_greek': return grego(v);
    default: return String(v);
  }
}

/** Texto do marcador para o item de número `n` ("•", "1.", "a)", "(iii)", "01 –", "[1]", "1º."…). */
export function rotuloMarcador(cfg, n = 1) {
  if (!cfg) return '';
  if (cfg.tipo === 'simbolo') return simboloValido(cfg.simbolo) || '•';
  if (cfg.tipo !== 'numero') return GLIFOS[cfg.tipo] || '•';
  const num = formatarNumeroMarcador(n, cfg.estiloNum);
  switch (cfg.separador) {
    case 'parentese': return `${num})`;
    case 'entre_parenteses': return `(${num})`;
    case 'travessao': return `${num} –`;
    case 'colchetes': return `[${num}]`;
    case 'dois_pontos': return `${num}:`;
    case 'seta': return `${num} ›`;
    case 'ponto_traco': return `${num}.–`;
    default: return `${num}.`;
  }
}

/** Chave do bloco no mapa: fragmentos de um mesmo bloco compartilham a do bloco de origem. */
export const chaveMarcador = (bloco) => String(bloco?._frag?.origemId || bloco?.id || '');

const TIPOS_COM_MARCADOR = new Set(['titulo', 'subtitulo', 'paragrafo', 'texto']);

/**
 * Numeração corrida do documento: blocos numerados consecutivos continuam a contagem (por nível); qualquer bloco sem numeração
 * a reinicia. Um bloco com "Iniciar em" maior que 1 recomeça dali. Devolve Map(chave → { cfg, numero, rotulo }).
 */
export function mapaMarcadores(doc) {
  const mapa = new Map();
  const porId = Object.fromEntries((doc?.estilos || []).map(e => [e.id, e]));
  let cont = [];
  for (const sec of doc?.secoes || []) {
    for (const b of sec.blocos || []) {
      const estilo = b.tipo === 'titulo' ? (porId[estiloIdDoTitulo(porId, b)] || porId[b.estiloId]) : (porId[b.estiloId] || porId.corpo);
      const cfg = TIPOS_COM_MARCADOR.has(b.tipo) ? marcadorEfetivo(b, estilo) : null;
      if (!cfg || cfg.tipo !== 'numero') {
        cont = [];
        if (cfg) mapa.set(chaveMarcador(b), { cfg, numero: 1, rotulo: rotuloMarcador(cfg, 1) });
        continue;
      }
      const i = cfg.nivel - 1;
      if (cfg.inicioExplicito) cont[i] = cfg.inicio - 1;
      cont[i] = (cont[i] ?? (cfg.inicio - 1)) + 1;
      cont.length = i + 1;
      mapa.set(chaveMarcador(b), { cfg, numero: cont[i], rotulo: rotuloMarcador(cfg, cont[i]) });
    }
  }
  return mapa;
}

/** Valida os campos `marcador_*` de um estilo vindo de um pacote de tema (remove o que não faz sentido). */
export function sanearCamposMarcador(estilo) {
  if (!estilo || typeof estilo !== 'object') return estilo;
  const novo = { ...estilo };
  if (!TIPOS_VALIDOS.has(novo.marcador_tipo) || novo.marcador_tipo === 'nenhum') { CAMPOS_MARCADOR.forEach(k => delete novo[k]); return novo; }
  if (novo.marcador_tipo === 'simbolo') { const sv = simboloValido(novo.marcador_simbolo); if (sv) novo.marcador_simbolo = sv; else { novo.marcador_tipo = 'circulo'; delete novo.marcador_simbolo; } } else delete novo.marcador_simbolo;
  if (!ESTILOS_NUMERO.some(e => e[0] === novo.marcador_estilo_num)) delete novo.marcador_estilo_num;
  if (!SEPARADORES_NUMERO.some(e => e[0] === novo.marcador_separador)) delete novo.marcador_separador;
  if (novo.marcador_inicio !== undefined) novo.marcador_inicio = inteiro(novo.marcador_inicio, 1, 999, 1);
  if (novo.marcador_nivel !== undefined) novo.marcador_nivel = inteiro(novo.marcador_nivel, 1, 5, 1);
  if (novo.marcador_tab_mm !== undefined) novo.marcador_tab_mm = Math.min(30, Math.max(3, parseFloat(novo.marcador_tab_mm) || 7));
  if (novo.marcador_alinhamento !== undefined && !ALINHAMENTOS.has(novo.marcador_alinhamento)) delete novo.marcador_alinhamento;
  return novo;
}

/** Configuração de aparência (nível, tabulação, alinhamento, numeração) para listas escritas no texto do bloco. */
export function configListaDoBloco(bloco, estilo, padrao = {}) {
  const ef = marcadorEfetivo(bloco, estilo);
  const alin = estilo?.marcador_alinhamento ?? 'left';
  return {
    tipo: ef?.tipo || padrao.tipo || 'circulo',
    simbolo: ef?.simbolo || simboloValido(estilo?.marcador_simbolo) || '•',
    estiloNum: ef?.estiloNum || estilo?.marcador_estilo_num || 'decimal',
    separador: ef?.separador || estilo?.marcador_separador || 'ponto',
    nivel: inteiro(estilo?.marcador_nivel, 1, 5, 1),
    tabMm: Math.max(3, parseFloat(estilo?.marcador_tab_mm) || 7),
    alinhamento: ALINHAMENTOS.has(alin) ? alin : 'left'
  };
}

const attr = (atributos, nome) => new RegExp(`${nome}="([^"]*)"`, 'i').exec(atributos)?.[1];

/**
 * Quebra o HTML de um bloco que tem listas (<ul>/<ol>, uma por linha marcada com Enter) em segmentos: o texto fora das listas e
 * um item por <li>, já com o rótulo (cada lista pode ter o seu tipo; numeradas contam a partir de `numeroInicial`).
 * Serve ao PDF e ao Word, que não têm o CSS de listas do editor.
 */
export function segmentosDeLista(html, cfg, numeroInicial = 1) {
  const segmentos = [];
  const texto = String(html ?? '');
  const re = /<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let ultimo = 0;
  let m;
  const plano = (t) => { if (t.replace(/<br\s*\/?>|&nbsp;|\s/gi, '')) segmentos.push({ tipo: 'texto', html: t }); };
  while ((m = re.exec(texto))) {
    plano(texto.slice(ultimo, m.index));
    ultimo = m.index + m[0].length;
    const numerada = m[1].toLowerCase() === 'ol';
    const itensCfg = {
      ...cfg,
      tipo: numerada ? 'numero' : (attr(m[2], 'data-marcador') || (cfg.tipo !== 'numero' ? cfg.tipo : 'circulo')),
      estiloNum: attr(m[2], 'data-num-estilo') || cfg.estiloNum,
      separador: attr(m[2], 'data-num-sep') || cfg.separador
    };
    let n = numerada ? numeroInicial : 1;
    for (const li of m[3].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      segmentos.push({ tipo: 'item', html: li[1], cfg: itensCfg, rotulo: rotuloMarcador(itensCfg, n) });
      if (numerada) n += 1;
    }
  }
  plano(texto.slice(ultimo));
  return segmentos;
}
