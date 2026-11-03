// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — UI de página: cabeçalho/rodapé em 3 zonas, bloco de notas de rodapé e editor de nota.
 * Os mesmos construtores servem a folha do editor e a prévia do painel "Configuração de Página".
 */

import { obterConfigNotas, sanitizarHtmlNota, obterNota } from '../core/athenes_notas_rodape.js';
import { FONTES_SISTEMA } from '../core/athenes_estilos.js';

const CSS = `
.ath-pg-area{position:absolute;z-index:3;display:flex;align-items:flex-start;gap:8px;box-sizing:border-box;pointer-events:none}
.ath-pg-zona{flex:1 1 0;min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
.ath-pg-area.multilinha .ath-pg-zona.cen,.ath-pg-area.multilinha .ath-pg-zona.dir{flex:0 0 auto}.ath-pg-zona.esq{text-align:left}.ath-pg-zona.cen{text-align:center}.ath-pg-zona.dir{text-align:right}
.ath-notas-rodape{margin-top:auto;position:relative;z-index:2}
.ath-nota-sep{margin:0 0 4pt 0}
.ath-nota{display:flex;gap:4px;align-items:baseline;margin:0 0 2pt 0}
.ath-nota-num{flex:none;min-width:1.1em;font-size:.75em;vertical-align:super;line-height:1;position:relative;top:-.35em;font-weight:700}
.ath-nota-txt{flex:1;min-width:0;outline:none;overflow-wrap:anywhere}
.ath-nota-txt:empty::before{content:'Digite a nota de rodapé…';color:#94A3B8}
.ath-nota-txt:focus{background:rgba(49,79,121,.07);border-radius:3px;box-shadow:0 0 0 2px rgba(49,79,121,.35)}
.ath-nota.continuacao .ath-nota-num{visibility:hidden}
.ath-nota.dividida .ath-nota-txt{cursor:default;opacity:.95}
sup.ath-nota-ref{cursor:pointer;color:#314F79;font-weight:700;padding:0 1px;border-radius:3px}
sup.ath-nota-ref:hover{background:rgba(49,79,121,.14)}
.ath-editor-nota{position:fixed;z-index:10070;width:340px;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 12px 36px rgba(15,23,42,.24);padding:10px;display:flex;flex-direction:column;gap:8px;font-family:var(--glx-font,'Nunito',sans-serif)}
.ath-editor-nota header{display:flex;align-items:center;justify-content:space-between;font:800 11px var(--glx-font,inherit);color:#314F79;text-transform:uppercase;letter-spacing:.04em}
.ath-editor-nota .barra{display:flex;gap:4px}
.ath-editor-nota .barra button{height:26px;min-width:28px;border:1px solid #D5DEE9;border-radius:6px;background:#fff;cursor:pointer;font:700 12px var(--glx-font,inherit)}
.ath-editor-nota .barra button:hover{background:#EEF4FA}
.ath-editor-nota .corpo{min-height:70px;max-height:200px;overflow:auto;border:1px solid #D5DEE9;border-radius:8px;padding:6px 8px;font-size:13px;line-height:1.4;outline:none}
.ath-editor-nota .corpo:focus{border-color:#314F79;box-shadow:0 0 0 2px rgba(49,79,121,.18)}
.ath-editor-nota .acoes{display:flex;gap:8px}
.ath-editor-nota .acoes button{flex:1;height:30px;border-radius:8px;border:1px solid transparent;font:800 12px var(--glx-font,inherit);cursor:pointer}
.ath-editor-nota .salvar{background:#314F79;color:#fff}
.ath-editor-nota .excluir{background:#fff;color:#B42318;border-color:#F3B4AE}
`;

function garantirCss() {
  if (document.getElementById('athPaginaUiCss')) return;
  const s = document.createElement('style');
  s.id = 'athPaginaUiCss';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const familia = (id) => (FONTES_SISTEMA[id]?.familia || FONTES_SISTEMA.nunito.familia).replace(/"/g, "'");

/**
 * Cabeçalho ou rodapé em 3 zonas (esquerda · centro · direita). O posicionamento (top/bottom, left/right)
 * fica a cargo de quem chama, já que depende da escala (px/mm) do contexto.
 * @param {object} area  resultado de `resolverAreasPagina(...).cabecalho|rodape`
 */
export function construirAreaPaginaDom(area) {
  garantirCss();
  const el = document.createElement('div');
  el.className = `ath-pg-area ath-pg-${area.tipo}${area.multilinha && area.zonas.esquerda ? ' multilinha' : ''}`;
  Object.assign(el.style, area.css);
  const zona = (cls, texto) => {
    const z = document.createElement('div');
    z.className = `ath-pg-zona ${cls}`;
    z.textContent = texto;
    return z;
  };
  el.append(zona('esq', area.zonas.esquerda), zona('cen', area.zonas.centro), zona('dir', area.zonas.direita));
  if (area.linha) {
    const borda = `${area.linha.espessura_pt}pt solid ${area.linha.cor}`;
    if (area.tipo === 'cabecalho') { el.style.borderBottom = borda; el.style.paddingBottom = '1.5mm'; }
    else { el.style.borderTop = borda; el.style.paddingTop = '1.5mm'; }
  }
  return el;
}

/**
 * Bloco de notas de rodapé de uma página: traço separador configurável + notas com marcador e tipografia própria.
 * Notas inteiras são editáveis no próprio canvas; notas divididas entre páginas abrem o editor ao clicar no marcador.
 * @param {{notas?:object[], rotulosNotas?:object}} pag
 * @param {{editavel?:boolean, aoSalvar?:(id:string, html:string)=>void}} opc
 */
export function construirNotasDom(pag, doc, opc = {}) {
  garantirCss();
  if (!pag.notas?.length) return null;
  const cfg = obterConfigNotas(doc);
  const wrap = document.createElement('div');
  wrap.className = 'ath-notas-rodape';
  Object.assign(wrap.style, {
    fontFamily: familia(cfg.fonte), fontSize: `${cfg.tamanho_pt}pt`, lineHeight: String(cfg.entrelinha), color: cfg.cor
  });
  const sep = document.createElement('div');
  sep.className = 'ath-nota-sep';
  Object.assign(sep.style, { height: `${cfg.separador.espessura_pt}pt`, width: `${cfg.separador.comprimento_pct}%`, background: cfg.separador.cor });
  wrap.appendChild(sep);

  for (const seg of pag.notas) {
    const dividida = !!(seg.continua || seg.continuaDaAnterior);
    const linha = document.createElement('div');
    linha.className = 'ath-nota' + (seg.continuaDaAnterior ? ' continuacao' : '') + (dividida ? ' dividida' : '');
    linha.dataset.notaId = seg.id;
    const num = document.createElement('span');
    num.className = 'ath-nota-num';
    num.textContent = pag.rotulosNotas?.[seg.id] ?? '';
    const txt = document.createElement('div');
    txt.className = 'ath-nota-txt';
    txt.innerHTML = sanitizarHtmlNota(seg.html);
    if (opc.editavel && !dividida) {
      txt.contentEditable = 'true';
      txt.addEventListener('blur', () => opc.aoSalvar?.(seg.id, sanitizarHtmlNota(txt.innerHTML)));
      // marcador do próprio corpo do texto não deve ser colado aqui: colagem em texto simples
      txt.addEventListener('paste', (e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || '');
      });
    } else if (dividida) {
      txt.title = 'Nota dividida entre páginas — clique no marcador no texto para editar a nota inteira';
    }
    linha.append(num, txt);
    wrap.appendChild(linha);
  }
  return wrap;
}

// ───────────────────────────── Editor de nota (popover) ─────────────────────────────

let editorAtivo = null;
let limpar = null;

export function fecharEditorNota() {
  if (limpar) { limpar(); limpar = null; }
  editorAtivo?.remove();
  editorAtivo = null;
}

/**
 * Editor flutuante da nota inteira: formatação básica (negrito, itálico, link), salvar e excluir.
 * @param {{doc:object, id:string, ancora:HTMLElement, aoSalvar:(id:string, html:string)=>void, aoExcluir:(id:string)=>void}} p
 */
export function abrirEditorNota({ doc, id, ancora, aoSalvar, aoExcluir }) {
  garantirCss();
  fecharEditorNota();
  const nota = obterNota(doc, id);
  if (!nota) return null;

  const el = document.createElement('div');
  el.className = 'ath-editor-nota';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Nota de rodapé');
  const cab = document.createElement('header');
  cab.append(Object.assign(document.createElement('span'), { textContent: 'Nota de rodapé' }));
  const barra = document.createElement('div');
  barra.className = 'barra';
  const cmd = (rot, titulo, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = rot; b.title = titulo;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', fn);
    barra.appendChild(b);
  };
  cmd('N', 'Negrito', () => document.execCommand('bold'));
  cmd('I', 'Itálico', () => document.execCommand('italic'));
  cmd('🔗', 'Inserir link', () => {
    const url = window.prompt('Endereço do link (https://…):', 'https://');
    if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) document.execCommand('createLink', false, url.trim());
  });
  cmd('⌫', 'Remover formatação', () => document.execCommand('removeFormat'));
  cab.appendChild(barra);

  const corpo = document.createElement('div');
  corpo.className = 'corpo';
  corpo.contentEditable = 'true';
  corpo.innerHTML = sanitizarHtmlNota(nota.html);

  const acoes = document.createElement('div');
  acoes.className = 'acoes';
  const salvar = Object.assign(document.createElement('button'), { type: 'button', className: 'salvar', textContent: 'Salvar' });
  const excluir = Object.assign(document.createElement('button'), { type: 'button', className: 'excluir', textContent: 'Excluir nota' });
  salvar.addEventListener('click', () => { const html = sanitizarHtmlNota(corpo.innerHTML); fecharEditorNota(); aoSalvar?.(id, html); });
  excluir.addEventListener('click', () => { fecharEditorNota(); aoExcluir?.(id); });
  acoes.append(salvar, excluir);
  el.append(cab, corpo, acoes);
  document.body.appendChild(el);
  editorAtivo = el;

  const r = ancora.getBoundingClientRect();
  const h = el.offsetHeight || 220;
  el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 352))}px`;
  el.style.top = `${r.bottom + 8 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 8) : r.bottom + 8}px`;

  const fora = (e) => { if (!el.contains(e.target) && !e.target.closest?.('.ath-nota-ref')) fecharEditorNota(); };
  const esc = (e) => { if (e.key === 'Escape') fecharEditorNota(); };
  document.addEventListener('mousedown', fora, true);
  document.addEventListener('keydown', esc, true);
  limpar = () => { document.removeEventListener('mousedown', fora, true); document.removeEventListener('keydown', esc, true); };
  corpo.focus();
  return el;
}
