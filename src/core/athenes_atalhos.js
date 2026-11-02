// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Catálogo e motor puro de atalhos de teclado (sem DOM).
 *
 * Notação canônica: "Mod+Alt+Shift+Tecla". `Mod` = Ctrl no Windows/Linux e Cmd (⌘) no macOS;
 * `Alt` = Option (⌥) no macOS. `Ctrl` literal só existe no macOS (a tecla Control física).
 * O catálogo é a única fonte de verdade: handlers, tooltips e o modal de ajuda leem daqui.
 */

export const CATEGORIAS = {
  historico: 'Histórico e área de transferência',
  inline: 'Formatação de texto',
  paragrafo: 'Parágrafo e alinhamento',
  busca: 'Busca e navegação',
  estrutura: 'Estrutura e inserção',
  sistema: 'Sistema'
};

/**
 * escopo: 'global' (sempre) | 'edicao' (só com o cursor num bloco editável) | 'fora' (só fora da edição inline)
 * nativo: o navegador já executa a ação (a engine não bloqueia; serve só para tooltips e ajuda)
 * mac: atalhos específicos do macOS quando diferem da lista comum
 */
export const CATALOGO = [
  // A. Histórico e clipboard
  { id: 'desfazer', cat: 'historico', rotulo: 'Desfazer', atalhos: ['Mod+Z'], escopo: 'global' },
  { id: 'refazer', cat: 'historico', rotulo: 'Refazer', atalhos: ['Mod+Y', 'Mod+Shift+Z'], mac: ['Mod+Shift+Z'], escopo: 'global' },
  { id: 'recortar', cat: 'historico', rotulo: 'Recortar', atalhos: ['Mod+X'], escopo: 'edicao', nativo: true },
  { id: 'copiar', cat: 'historico', rotulo: 'Copiar', atalhos: ['Mod+C'], escopo: 'edicao', nativo: true },
  { id: 'colar', cat: 'historico', rotulo: 'Colar (com formatação limpa)', atalhos: ['Mod+V'], escopo: 'edicao', nativo: true },
  { id: 'colar_puro', cat: 'historico', rotulo: 'Colar como texto puro', atalhos: ['Mod+Shift+V'], escopo: 'edicao' },
  { id: 'selecionar_tudo', cat: 'historico', rotulo: 'Selecionar tudo (bloco, depois documento)', atalhos: ['Mod+A'], escopo: 'global' },
  // B. Inline
  { id: 'negrito', cat: 'inline', rotulo: 'Negrito', atalhos: ['Mod+B'], escopo: 'edicao' },
  { id: 'italico', cat: 'inline', rotulo: 'Itálico', atalhos: ['Mod+I'], escopo: 'edicao' },
  { id: 'sublinhado', cat: 'inline', rotulo: 'Sublinhado', atalhos: ['Mod+U'], escopo: 'edicao' },
  { id: 'tachado', cat: 'inline', rotulo: 'Tachado', atalhos: ['Alt+Shift+5', 'Mod+Shift+X'], mac: ['Mod+Shift+X'], escopo: 'edicao' },
  { id: 'sobrescrito', cat: 'inline', rotulo: 'Sobrescrito', atalhos: ['Mod+.'], escopo: 'edicao' },
  { id: 'subscrito', cat: 'inline', rotulo: 'Subscrito', atalhos: ['Mod+,'], escopo: 'edicao' },
  { id: 'link', cat: 'inline', rotulo: 'Inserir link', atalhos: ['Mod+K'], escopo: 'edicao' },
  { id: 'limpar_formatacao', cat: 'inline', rotulo: 'Limpar formatação', atalhos: ['Mod+\\', 'Mod+Space'], mac: ['Mod+\\'], escopo: 'edicao' },
  // C. Parágrafo
  { id: 'alinhar_esquerda', cat: 'paragrafo', rotulo: 'Alinhar à esquerda', atalhos: ['Mod+Shift+L'], escopo: 'global' },
  { id: 'alinhar_centro', cat: 'paragrafo', rotulo: 'Centralizar', atalhos: ['Mod+Shift+E'], escopo: 'global' },
  { id: 'alinhar_direita', cat: 'paragrafo', rotulo: 'Alinhar à direita', atalhos: ['Mod+Shift+R'], escopo: 'global' },
  { id: 'alinhar_justificado', cat: 'paragrafo', rotulo: 'Justificar', atalhos: ['Mod+Shift+J'], escopo: 'global' },
  { id: 'recuo_aumentar', cat: 'paragrafo', rotulo: 'Aumentar recuo', atalhos: ['Tab'], escopo: 'edicao' },
  { id: 'recuo_diminuir', cat: 'paragrafo', rotulo: 'Diminuir recuo', atalhos: ['Shift+Tab'], escopo: 'edicao' },
  // D. Busca
  { id: 'localizar', cat: 'busca', rotulo: 'Localizar', atalhos: ['Mod+F'], escopo: 'global' },
  { id: 'substituir', cat: 'busca', rotulo: 'Localizar e substituir', atalhos: ['Mod+H'], escopo: 'global' },
  { id: 'proxima_ocorrencia', cat: 'busca', rotulo: 'Próxima ocorrência', atalhos: ['F3'], mac: ['Mod+G'], escopo: 'global' },
  { id: 'ocorrencia_anterior', cat: 'busca', rotulo: 'Ocorrência anterior', atalhos: ['Shift+F3'], mac: ['Mod+Shift+G'], escopo: 'global' },
  { id: 'ir_para', cat: 'busca', rotulo: 'Ir para página', atalhos: ['Mod+G'], mac: ['Mod+Alt+G'], escopo: 'global' },
  // E. Estrutura
  { id: 'quebra_pagina', cat: 'estrutura', rotulo: 'Quebra de página', atalhos: ['Mod+Enter'], escopo: 'global' },
  { id: 'quebra_linha', cat: 'estrutura', rotulo: 'Quebra de linha suave', atalhos: ['Shift+Enter'], escopo: 'edicao', nativo: true },
  { id: 'nota_rodape', cat: 'estrutura', rotulo: 'Inserir nota de rodapé', atalhos: ['Mod+Alt+F'], escopo: 'edicao' },
  { id: 'titulo1', cat: 'estrutura', rotulo: 'Título 1', atalhos: ['Mod+Alt+1'], escopo: 'global' },
  { id: 'titulo2', cat: 'estrutura', rotulo: 'Título 2', atalhos: ['Mod+Alt+2'], escopo: 'global' },
  { id: 'titulo3', cat: 'estrutura', rotulo: 'Título 3', atalhos: ['Mod+Alt+3'], escopo: 'global' },
  { id: 'texto_normal', cat: 'estrutura', rotulo: 'Texto normal', atalhos: ['Mod+Alt+0'], escopo: 'global' },
  { id: 'comandos', cat: 'estrutura', rotulo: 'Menu de comandos (no início da linha)', atalhos: ['/'], escopo: 'edicao' },
  // F. Sistema
  { id: 'salvar', cat: 'sistema', rotulo: 'Salvar documento', atalhos: ['Mod+S'], escopo: 'global' },
  { id: 'exportar', cat: 'sistema', rotulo: 'Imprimir / Exportar', atalhos: ['Mod+P'], escopo: 'global' },
  { id: 'guia_atalhos', cat: 'sistema', rotulo: 'Guia de atalhos', atalhos: ['Mod+/', 'Mod+?'], escopo: 'global' }
];

// ───────────────────────────── Plataforma ─────────────────────────────

export function detectarMac(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  const s = `${nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || ''}`;
  return /mac|iphone|ipad|ipod/i.test(s) && !/windows|linux|android/i.test(s);
}

// ───────────────────────────── Normalização ─────────────────────────────

const NOMES_CODE = {
  Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Escape: 'Escape', Space: 'Space', Backspace: 'Backspace', Delete: 'Delete',
  Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']'
};

/** Tecla canônica de um evento: letras/dígitos pela posição física (independe do layout), resto pelo `code`/`key`. */
export function teclaCanonica(e, mac = false) {
  const code = e.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  const k = e.key || '';
  // pontuação pelo caractere produzido (em ABNT2 a tecla física da "/" é outra); no macOS Option altera o caractere
  if (k.length === 1 && !/[A-Za-z0-9 ]/.test(k) && !(mac && e.altKey)) return k;
  if (NOMES_CODE[code]) return NOMES_CODE[code];
  if (k.length === 1) return k === ' ' ? 'Space' : k.toUpperCase();
  return NOMES_CODE[k] || k;
}

/** "Mod+Alt+Shift+Tecla" de um evento de teclado. */
export function normalizarEvento(e, mac = false) {
  const mod = mac ? !!e.metaKey : !!e.ctrlKey;
  const partes = [];
  if (mod) partes.push('Mod');
  if (mac && e.ctrlKey) partes.push('Ctrl');
  if (e.altKey) partes.push('Alt');
  const t = teclaCanonica(e, mac);
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(t)) return null;
  if (e.shiftKey && t !== '?') partes.push('Shift'); // "?" já embute o Shift
  partes.push(t);
  return partes.join('+');
}

/** Normaliza uma string de atalho para comparação ("mod+shift+z" → "Mod+Shift+Z"; ordem fixa). */
export function normalizarAtalho(s) {
  const p = String(s).split('+');
  const tecla = p.pop() || '+';
  const mods = new Set(p.map(x => x.trim().toLowerCase()));
  const out = [];
  if (['mod', 'ctrl', 'control', 'cmd', 'command', 'meta'].some(m => mods.has(m))) out.push('Mod');
  if (mods.has('alt') || mods.has('option')) out.push('Alt');
  if (mods.has('shift')) out.push('Shift');
  out.push(tecla.length === 1 ? tecla.toUpperCase() : tecla);
  return out.join('+');
}

/** Atalhos efetivos de uma ação nesta plataforma (personalizações têm prioridade). */
export function atalhosDaAcao(acao, mac = false, personalizados = null) {
  if (personalizados && personalizados[acao.id]) return [].concat(personalizados[acao.id]).map(normalizarAtalho);
  return (mac && acao.mac ? acao.mac : acao.atalhos).map(normalizarAtalho);
}

/** Índice atalho → ação (as personalizações substituem as padrão da mesma ação). */
export function construirIndice(mac = false, personalizados = null, catalogo = CATALOGO) {
  const idx = new Map();
  for (const a of catalogo) for (const s of atalhosDaAcao(a, mac, personalizados)) if (!idx.has(s)) idx.set(s, a);
  return idx;
}

/** Detecta atalhos duplicados (mesma combinação em ações diferentes). */
export function conflitos(mac = false, personalizados = null, catalogo = CATALOGO) {
  const vistos = new Map(); const out = [];
  for (const a of catalogo) for (const s of atalhosDaAcao(a, mac, personalizados)) {
    if (vistos.has(s) && vistos.get(s) !== a.id) out.push({ atalho: s, acoes: [vistos.get(s), a.id] });
    else vistos.set(s, a.id);
  }
  return out;
}

/**
 * Resolve a ação de um evento no contexto atual.
 * contexto: { editavel: boolean (foco em bloco editável), busca: boolean (foco no campo de busca/modal) }
 */
export function resolverAcao(e, { mac = false, contexto = {}, indice = null, personalizados = null } = {}) {
  const chave = normalizarEvento(e, mac);
  if (!chave) return null;
  const a = (indice || construirIndice(mac, personalizados)).get(chave) || null;
  if (!a) return null;
  if (a.escopo === 'edicao' && !contexto.editavel) return null;
  if (a.escopo === 'fora' && contexto.editavel) return null;
  return a;
}

// ───────────────────────────── Apresentação ─────────────────────────────

const GLIFOS_MAC = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Enter: '↵', Tab: '⇥', Escape: 'Esc', Space: 'Espaço', Backspace: '⌫' };
const NOMES_WIN = { Mod: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc', Space: 'Espaço', Backspace: 'Backspace' };

/** "Mod+Shift+Z" → "Ctrl+Shift+Z" (Windows/Linux) ou "⇧⌘Z" (macOS, ordem ⌃⌥⇧⌘ como no sistema). */
export function formatarAtalho(s, mac = false) {
  const p = normalizarAtalho(s).split('+');
  const tecla = p.pop();
  if (!mac) return [...p.map(m => NOMES_WIN[m] || m), NOMES_WIN[tecla] || tecla].join('+');
  const ordem = ['Ctrl', 'Alt', 'Shift', 'Mod'];
  const mods = ordem.filter(m => p.includes(m)).map(m => GLIFOS_MAC[m]).join('');
  return mods + (GLIFOS_MAC[tecla] || tecla);
}

/** Todos os atalhos da ação formatados ("Ctrl+Y / Ctrl+Shift+Z"). */
export function textoAtalhos(acao, mac = false, personalizados = null) {
  return atalhosDaAcao(acao, mac, personalizados).map(s => formatarAtalho(s, mac)).join(' / ');
}

export const acaoPorId = (id, catalogo = CATALOGO) => catalogo.find(a => a.id === id) || null;

/** Texto de tooltip: "Negrito (Ctrl+B)" — usa só o primeiro atalho para ficar curto. */
export function tooltipComAtalho(rotulo, idAcao, mac = false, personalizados = null) {
  const a = acaoPorId(idAcao);
  if (!a) return rotulo;
  const [primeiro] = atalhosDaAcao(a, mac, personalizados);
  return primeiro ? `${rotulo} (${formatarAtalho(primeiro, mac)})` : rotulo;
}

/** Filtra o catálogo pelo texto digitado (rótulo, categoria, atalho formatado), agrupado por categoria. */
export function filtrarCatalogo(termo, mac = false, personalizados = null, catalogo = CATALOGO) {
  const t = String(termo || '').trim().toLowerCase();
  const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tt = sem(t);
  const grupos = {};
  for (const a of catalogo) {
    const txt = sem(`${a.rotulo} ${CATEGORIAS[a.cat]} ${textoAtalhos(a, mac, personalizados)}`);
    if (tt && !txt.includes(tt)) continue;
    (grupos[a.cat] = grupos[a.cat] || []).push({ ...a, texto: textoAtalhos(a, mac, personalizados) });
  }
  return grupos;
}

// ───────────────────────────── Busca e substituição (texto puro) ─────────────────────────────

/**
 * Posições [início, fim) de todas as ocorrências de `termo` em `texto`.
 * opcoes: { maiusculas: bool, palavraInteira: bool }. Sem sobreposição.
 */
export function localizarOcorrencias(texto, termo, { maiusculas = false, palavraInteira = false } = {}) {
  if (!termo) return [];
  const base = maiusculas ? texto : texto.toLowerCase();
  const alvo = maiusculas ? termo : termo.toLowerCase();
  const out = [];
  const letra = (c) => !!c && /[\p{L}\p{N}_]/u.test(c);
  let i = 0;
  while ((i = base.indexOf(alvo, i)) !== -1) {
    const fim = i + alvo.length;
    if (!palavraInteira || (!letra(texto[i - 1]) && !letra(texto[fim]))) out.push([i, fim]);
    i = fim;
  }
  return out;
}

/** Substitui ocorrências (todas, ou só a de índice `so`) e devolve { texto, quantidade }. */
export function substituirOcorrencias(texto, termo, novo, opcoes = {}, so = null) {
  const oc = localizarOcorrencias(texto, termo, opcoes);
  let out = ''; let ultimo = 0; let q = 0;
  oc.forEach(([a, b], i) => {
    if (so !== null && i !== so) return;
    out += texto.slice(ultimo, a) + novo; ultimo = b; q++;
  });
  return { texto: out + texto.slice(ultimo), quantidade: q };
}

// ───────────────────────────── Colagem segura ─────────────────────────────

const TAGS_PERMITIDAS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUP', 'SUB', 'A', 'BR', 'P', 'UL', 'OL', 'LI']);
const TAGS_DESCARTADAS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'TEXTAREA', 'SVG', 'NOSCRIPT']);

/**
 * Sanitiza HTML colado: mantém só marcação semântica inline/lista, remove estilos, classes, ids e
 * atributos de evento; links só http(s)/mailto. `doc` é um Document (navegador ou JSDOM-like).
 */
export function sanitizarHtmlColado(html, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return String(html).replace(/<[^>]*>/g, '');
  const tpl = doc.createElement('template');
  tpl.innerHTML = String(html);
  const limpar = (no) => {
    [...no.childNodes].forEach(f => {
      if (f.nodeType === 8) { f.remove(); return; }
      if (f.nodeType !== 1) return;
      if (TAGS_DESCARTADAS.has(f.tagName)) { f.remove(); return; }
      limpar(f);
      if (!TAGS_PERMITIDAS.has(f.tagName)) { f.replaceWith(...f.childNodes); return; }
      [...f.attributes].forEach(at => {
        if (f.tagName === 'A' && at.name === 'href' && /^(https?:|mailto:)/i.test(at.value.trim())) return;
        f.removeAttribute(at.name);
      });
      if (f.tagName === 'A') { f.setAttribute('rel', 'noopener noreferrer'); f.setAttribute('target', '_blank'); }
    });
  };
  limpar(tpl.content);
  return tpl.innerHTML;
}
