// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — UI das figuras por código.
 *
 *  - `montarConteudoCodigoDom`     desenha o item por código (SVG inline, HTML+CSS em Shadow DOM) — o código fica oculto
 *  - `abrirEditorCodigoFigura`     modal dividido: código (linhas, validação, formatar) | prévia ao vivo com moldura e legenda
 *  - `abrirModalInserirFigura`     "Para que vai servir?": categoria semântica + origem (upload ou código)
 *  - `rasterizarFiguraParaPng`     SVG/HTML → PNG (canvas) para o DOCX
 */

import {
  PAPEIS_SEMANTICOS, FONTES_CONTEUDO, fonteDoItem, obterConfigFigura, definirPapelSemantico, papelSemanticoDoBloco, ehFonteCodigo
} from '../core/athenes_figura_layout.js';
import {
  marcacaoItemCodigo, resolverItemCodigo, validarCodigoFigura, formatarCodigoFigura, exemploDeCodigo, estiloContainerCodigo, uidDoItem
} from '../core/athenes_figura_codigo.js';
import { obterPrefixoNumeracao, obterTextoPuroTitulo, gerarCssMolduraBloco, ROTULOS_FIGURA } from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';

const CSS = `
.ath-fig-codigo{position:relative}
.ath-fig-erro{padding:10px 12px;font:600 11.5px var(--glx-font,inherit);color:#B91C1C;background:#FEF2F2;border:1px dashed #FCA5A5;border-radius:6px;line-height:1.4}
.ath-cod-ov{position:fixed;inset:0;z-index:10100;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:2vh 2vw}
.ath-cod-md{background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.45);display:flex;flex-direction:column;width:min(1280px,96vw);height:min(820px,94vh);overflow:hidden;font-family:var(--glx-font,system-ui,sans-serif)}
.ath-cod-cab{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #E2E8F0;background:#F8FAFC}
.ath-cod-cab h3{margin:0;font:800 14px var(--glx-font,inherit);color:#1F2733;flex:1}
.ath-cod-corpo{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.ath-cod-col{min-width:0;min-height:0;display:flex;flex-direction:column}
.ath-cod-col+.ath-cod-col{border-left:1px solid #E2E8F0;background:#EEF1F5}
.ath-cod-barra{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #E2E8F0;background:#fff}
.ath-cod-barra select,.ath-cod-barra button{height:28px;border:1px solid #D5DEE9;border-radius:7px;background:#fff;color:#334155;font:700 11.5px var(--glx-font,inherit);padding:0 10px;cursor:pointer}
.ath-cod-barra button:hover{background:#EEF4FA;color:#314F79}
.ath-cod-edit{position:relative;flex:1;min-height:0;display:flex;background:#0F172A}
.ath-cod-gut{flex:none;min-width:44px;box-sizing:border-box;padding:10px 8px 10px 0;margin:0;overflow:hidden;text-align:right;color:#64748B;background:#111C33;font:12px/1.55 ui-monospace,Consolas,monospace;user-select:none;white-space:pre}
.ath-cod-gut .e{color:#F87171;font-weight:800}
.ath-cod-ta{flex:1;min-width:0;box-sizing:border-box;padding:10px 12px;margin:0;border:0;outline:0;resize:none;background:#0F172A;color:#E2E8F0;font:12px/1.55 ui-monospace,Consolas,monospace;white-space:pre;overflow:auto;tab-size:2}
.ath-cod-stat{max-height:34%;overflow:auto;border-top:1px solid #E2E8F0;background:#fff;padding:8px 12px;font:600 11.5px var(--glx-font,inherit);color:#475569}
.ath-cod-stat .ok{color:#15803D;font-weight:800}
.ath-cod-stat .er{color:#B91C1C;cursor:pointer;display:block;padding:2px 0}
.ath-cod-stat .av{color:#B45309;display:block;padding:2px 0}
.ath-cod-prev{flex:1;min-height:0;overflow:auto;padding:18px;display:flex;justify-content:center;align-items:flex-start}
.ath-cod-folha{background:#fff;box-shadow:0 2px 14px rgba(15,23,42,.18);border-radius:3px;padding:22px 26px;width:100%;max-width:560px;box-sizing:border-box}
.ath-cod-rod{display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid #E2E8F0;background:#F8FAFC}
.ath-cod-rod .dica{flex:1;font:600 11px var(--glx-font,inherit);color:#64748B}
.ath-cod-bt{height:32px;padding:0 16px;border-radius:8px;border:1px solid #D5DEE9;background:#fff;color:#334155;font:800 12px var(--glx-font,inherit);cursor:pointer}
.ath-cod-bt.pri{background:#314F79;border-color:#314F79;color:#fff}
.ath-ins-md{background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.45);width:min(760px,96vw);max-height:92vh;overflow:auto;font-family:var(--glx-font,system-ui,sans-serif)}
.ath-ins-md h3{margin:0;padding:16px 20px 4px;font:800 16px var(--glx-font,inherit);color:#1F2733}
.ath-ins-md .sub{padding:0 20px 10px;font:600 12px var(--glx-font,inherit);color:#64748B}
.ath-ins-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;padding:6px 20px 12px}
.ath-ins-card{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:12px;border:1.5px solid #D5DEE9;border-radius:12px;background:#fff;cursor:pointer;font-family:inherit}
.ath-ins-card:hover{border-color:#9DB6D4;background:#F6F9FD}
.ath-ins-card[aria-pressed="true"]{border-color:#314F79;background:#EAF1FA;box-shadow:0 0 0 2px rgba(49,79,121,.15)}
.ath-ins-card .ic{flex:none;width:34px;height:34px;border-radius:9px;background:#DCE8F5;color:#314F79;display:grid;place-items:center}
.ath-ins-card strong{display:block;font:800 13px var(--glx-font,inherit);color:#1F2733}
.ath-ins-card small{display:block;margin-top:2px;font:600 11px/1.35 var(--glx-font,inherit);color:#64748B}
.ath-ins-sec{padding:2px 20px 6px;font:800 10.5px var(--glx-font,inherit);color:#314F79;text-transform:uppercase;letter-spacing:.04em}
.ath-ins-rod{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px 16px;border-top:1px solid #E2E8F0;margin-top:6px}
`;

function garantirCss() {
  if (document.getElementById('athFigCodCss')) return;
  const s = document.createElement('style');
  s.id = 'athFigCodCss';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ───────────────────────────── Item por código no canvas ─────────────────────────────

/**
 * Preenche `alvo` (a moldura da célula) com a figura por código. O código nunca aparece: só o resultado.
 * SVG/Mermaid/gráfico → SVG inline sanitizado; HTML+CSS → Shadow DOM isolado (ResizeObserver mantém o conteúdo dentro da moldura).
 */
export function montarConteudoCodigoDom(alvo, bloco, itemRaw, idx, doc) {
  garantirCss();
  const cfg = obterConfigFigura(bloco);
  const m = marcacaoItemCodigo(bloco, itemRaw, idx, doc);
  if (!m.ok) {
    const e = el('div', 'ath-fig-erro');
    e.textContent = `Figura por código com erro: ${m.erros?.[0]?.mensagem || 'conteúdo inválido'}${m.erros?.[0]?.linha ? ` (linha ${m.erros[0].linha})` : ''}. Clique duas vezes para corrigir.`;
    alvo.appendChild(e);
    return;
  }
  if (m.tipo === 'svg') {
    alvo.insertAdjacentHTML('beforeend', m.html);
    return;
  }
  // HTML+CSS isolado: Shadow DOM impede que o CSS do usuário afete o editor (e vice-versa)
  const r = resolverItemCodigo(bloco, itemRaw, idx, doc);
  const host = el('div', 'ath-fig-codigo ath-fig-html');
  host.style.cssText = estiloContainerCodigo(cfg, 'html').css;
  host.setAttribute('role', 'img');
  const raiz = host.attachShadow({ mode: 'open' });
  raiz.innerHTML = `<style>:host{display:block}.raiz{display:block;font-size:13px;line-height:1.4;color:#1F2733;box-sizing:border-box}.raiz *{box-sizing:border-box}img{max-width:100%}${r.css || ''}</style><div class="raiz" data-ath-esc="${r.uid}">${r.html}</div>`;
  alvo.appendChild(host);
  ajustarHtmlAoContorno(host, raiz.querySelector('.raiz'));
}

/** Se o conteúdo HTML for mais largo que o contêiner, reduz (escala) em vez de cortar; reage a redimensionamentos. */
function ajustarHtmlAoContorno(host, raiz) {
  if (typeof ResizeObserver !== 'function') return;
  const ajustar = () => {
    const larguraHost = host.clientWidth;
    if (!larguraHost) return;
    raiz.style.transform = ''; raiz.style.width = ''; host.style.height = '';
    const larguraConteudo = raiz.scrollWidth;
    if (larguraConteudo > larguraHost + 1) {
      const k = larguraHost / larguraConteudo;
      raiz.style.width = `${larguraConteudo}px`;
      raiz.style.transformOrigin = '0 0';
      raiz.style.transform = `scale(${k})`;
      host.style.height = `${Math.ceil(raiz.scrollHeight * k)}px`;
    }
  };
  const ro = new ResizeObserver(() => ajustar());
  ro.observe(host);
  queueMicrotask(ajustar);
}

// ───────────────────────────── Modal "Para que vai servir?" ─────────────────────────────

/**
 * @param {{aoConfirmar:(r:{papel:string, sourceType:string})=>void, papelInicial?:string}} p
 */
export function abrirModalInserirFigura({ aoConfirmar, papelInicial = 'chart' }) {
  garantirCss();
  let papel = papelInicial;
  let origem = PAPEIS_SEMANTICOS.find(p => p.id === papel)?.fontePadrao || 'image_url';
  let origemManual = false;
  const ov = el('div', 'ath-cod-ov');
  const md = el('div', 'ath-ins-md');
  md.setAttribute('role', 'dialog'); md.setAttribute('aria-modal', 'true'); md.setAttribute('aria-label', 'Inserir figura');
  md.innerHTML = '<h3>Para que vai servir?</h3><div class="sub">A escolha define o prefixo da legenda, a numeração própria, a lista automática e a proporção padrão.</div>';

  const grade = el('div', 'ath-ins-grade');
  const ICONE = { chart: 'grafico', figure: 'imagem', diagram: 'fluxograma', scheme: 'diagrama', frame: 'quadro' };
  PAPEIS_SEMANTICOS.forEach(p => {
    const b = el('button', 'ath-ins-card');
    b.type = 'button'; b.dataset.papel = p.id;
    b.innerHTML = `<span class="ic">${svgIcone(ICONE[p.id] || 'figura', 18)}</span><span><strong>${esc(p.rotulo)}</strong><small>${esc(p.desc)}</small></span>`;
    b.addEventListener('click', () => { papel = p.id; if (!origemManual) origem = p.fontePadrao; marcar(); });
    grade.appendChild(b);
  });
  md.appendChild(grade);

  md.appendChild(el('div', 'ath-ins-sec', 'Como inserir o conteúdo?'));
  const grade2 = el('div', 'ath-ins-grade');
  const DESC = {
    image_url: 'Envie um arquivo (PNG, JPG, SVG…) do seu computador',
    svg_code: 'Cole ou escreva SVG puro (vetor nítido no PDF)',
    html_code: 'HTML + CSS isolado, ideal para quadros e infográficos',
    mermaid_code: 'Fluxogramas, sequência, Gantt e pizza a partir de texto',
    chart_json: 'Barras, linhas, dispersão, pizza e boxplot a partir de JSON'
  };
  FONTES_CONTEUDO.forEach(f => {
    const b = el('button', 'ath-ins-card');
    b.type = 'button'; b.dataset.origem = f.id;
    b.innerHTML = `<span class="ic">${f.codigo ? '<b style="font:800 11px ui-monospace,monospace">&lt;/&gt;</b>' : svgIcone('imagem', 18)}</span><span><strong>${esc(f.codigo ? `Código — ${f.linguagem}` : 'Enviar imagem')}</strong><small>${esc(DESC[f.id])}</small></span>`;
    b.addEventListener('click', () => { origem = f.id; origemManual = true; marcar(); });
    grade2.appendChild(b);
  });
  md.appendChild(grade2);

  const rod = el('div', 'ath-ins-rod');
  const bCancel = el('button', 'ath-cod-bt', 'Cancelar'); bCancel.type = 'button';
  const bOk = el('button', 'ath-cod-bt pri', 'Inserir figura'); bOk.type = 'button';
  rod.append(bCancel, bOk);
  md.appendChild(rod);
  ov.appendChild(md);

  function marcar() {
    grade.querySelectorAll('.ath-ins-card').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.papel === papel)));
    grade2.querySelectorAll('.ath-ins-card').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.origem === origem)));
  }
  const fechar = () => { ov.remove(); document.removeEventListener('keydown', tecla, true); };
  const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
  bCancel.addEventListener('click', fechar);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(); });
  bOk.addEventListener('click', () => { fechar(); aoConfirmar({ papel, sourceType: origem }); });
  document.addEventListener('keydown', tecla, true);
  document.body.appendChild(ov);
  marcar();
  bOk.focus();
}

// ───────────────────────────── Editor de código (dividido) ─────────────────────────────

/**
 * Edita o item `idx` do bloco: código à esquerda (linhas, validação, formatar), prévia à direita com moldura/legenda.
 * @param {{doc:object, bloco:object, idx:number, aoSalvar:(item:object)=>void}} p
 */
export function abrirEditorCodigoFigura({ doc, bloco, idx, aoSalvar }) {
  garantirCss();
  const orig = (bloco.itens || [])[idx] || {};
  let { sourceType, content } = fonteDoItem(orig);
  if (!ehFonteCodigo(sourceType)) { sourceType = 'svg_code'; content = ''; }
  if (!content.trim()) content = exemploDeCodigo(sourceType);
  const rascunho = { ...orig, sourceType, content, url: '' };

  const ov = el('div', 'ath-cod-ov');
  const md = el('div', 'ath-cod-md');
  md.setAttribute('role', 'dialog'); md.setAttribute('aria-modal', 'true'); md.setAttribute('aria-label', 'Editar código da figura');
  md.innerHTML = `<div class="ath-cod-cab"><h3>Editar código — ${esc(obterPrefixoNumeracao(bloco).trim())}</h3><span style="font:700 11px var(--glx-font,inherit);color:#64748B">Ctrl+Enter aplica • Esc cancela</span></div>`;
  const corpo = el('div', 'ath-cod-corpo');
  const colEsq = el('div', 'ath-cod-col'), colDir = el('div', 'ath-cod-col');

  // barra do editor
  const barra = el('div', 'ath-cod-barra');
  const sel = el('select');
  sel.setAttribute('aria-label', 'Linguagem');
  sel.innerHTML = FONTES_CONTEUDO.filter(f => f.codigo).map(f => `<option value="${f.id}" ${f.id === sourceType ? 'selected' : ''}>${esc(f.linguagem)}${f.id === 'chart_json' ? ' (gráfico)' : ''}</option>`).join('');
  const bFormatar = el('button', '', '✨ Formatar'); bFormatar.type = 'button'; bFormatar.title = 'Reindentar o código';
  const bExemplo = el('button', '', 'Modelo'); bExemplo.type = 'button'; bExemplo.title = 'Substituir pelo modelo de exemplo';
  barra.append(sel, bFormatar, bExemplo);

  const edit = el('div', 'ath-cod-edit');
  const gut = el('pre', 'ath-cod-gut');
  const ta = el('textarea', 'ath-cod-ta');
  ta.spellcheck = false; ta.wrap = 'off'; ta.value = content;
  ta.setAttribute('aria-label', 'Código da figura');
  edit.append(gut, ta);
  const stat = el('div', 'ath-cod-stat');
  colEsq.append(barra, edit, stat);

  // prévia
  const prev = el('div', 'ath-cod-prev');
  const folha = el('div', 'ath-cod-folha');
  prev.appendChild(folha);
  const cabPrev = el('div', 'ath-cod-barra', '<strong style="font:800 11px var(--glx-font,inherit);color:#314F79;text-transform:uppercase">Prévia ao vivo</strong><span style="font:600 11px var(--glx-font,inherit);color:#64748B">com moldura, legenda e fonte do bloco</span>');
  colDir.append(cabPrev, prev);
  corpo.append(colEsq, colDir);
  md.appendChild(corpo);

  const rod = el('div', 'ath-cod-rod');
  rod.innerHTML = '<span class="dica">O código fica oculto no documento: ali a figura se comporta como qualquer outra (seleção, legenda, referência cruzada).</span>';
  const bCancel = el('button', 'ath-cod-bt', 'Cancelar'); bCancel.type = 'button';
  const bOk = el('button', 'ath-cod-bt pri', 'Aplicar'); bOk.type = 'button';
  rod.append(bCancel, bOk);
  md.appendChild(rod);
  ov.appendChild(md);

  let linhasErro = new Set();
  const atualizarGutter = () => {
    const n = ta.value.split('\n').length;
    gut.innerHTML = Array.from({ length: n }, (_, i) => (linhasErro.has(i + 1) ? `<span class="e">${i + 1}</span>` : String(i + 1))).join('\n');
    gut.scrollTop = ta.scrollTop;
  };

  let ultimoOk = null;
  const montarPrevia = (valido) => {
    folha.innerHTML = '';
    const tmp = { ...bloco, layout: '1', itens: [{ ...rascunho, content: ta.value, sourceType: sel.value }] };
    const tit = el('div');
    tit.style.cssText = 'font:800 13px var(--glx-font,inherit);color:#1F2733;margin-bottom:8px';
    tit.innerHTML = `<span style="color:#314F79">${esc(obterPrefixoNumeracao(bloco))}</span>${esc(obterTextoPuroTitulo(bloco) || 'Descrição da ilustração')}`;
    const caixa = el('div');
    Object.assign(caixa.style, gerarCssMolduraBloco(bloco));
    const alvo = el('div');
    alvo.style.cssText = 'margin:0 auto';
    const cfg = obterConfigFigura(tmp);
    // contêiner com a mesma moldura/sombra/raio do bloco
    const mold = el('div');
    mold.style.cssText = `box-sizing:border-box;overflow:hidden;position:relative;${moldeCss(cfg)}`;
    montarConteudoCodigoDom(mold, tmp, tmp.itens[0], 0, doc);
    alvo.appendChild(mold);
    caixa.append(alvo);
    const leg = el('div');
    leg.style.cssText = 'font:12px/1.4 var(--glx-font,inherit);color:#475569;margin-top:8px';
    leg.innerHTML = String(bloco.legenda_geral || '').replace(/<(?!\/?(b|i|em|strong|sub|sup)\b)[^>]*>/gi, '');
    const fonte = el('div');
    fonte.style.cssText = 'font:italic 11px/1.4 var(--glx-font,inherit);color:#6B7585;margin-top:4px';
    fonte.textContent = String(bloco.fonte || '').replace(/<[^>]+>/g, '');
    folha.append(tit, caixa);
    if (bloco.legenda_geral && bloco.mostrar_legenda !== false) folha.appendChild(leg);
    if (bloco.fonte && bloco.mostrar_fonte !== false) folha.appendChild(fonte);
    folha.style.opacity = valido ? '1' : '.45';
    void ultimoOk;
  };
  const moldeCss = (cfg) => {
    const raio = { reto: 0, discreto: 3, arredondado: 10, pilula: 999 }[cfg.img_raio] ?? 3;
    let css = `border-radius:${raio}px;`;
    if (cfg.img_moldura === 'fina') css += `border:${cfg.img_borda_largura_pt}pt ${cfg.img_borda_estilo === 'tracejada' ? 'dashed' : 'solid'} ${cfg.img_borda_cor};`;
    if (cfg.img_moldura === 'dupla') css += `border:${Math.max(3, cfg.img_borda_largura_pt * 3)}px double ${cfg.img_borda_cor};`;
    if (cfg.img_moldura === 'passe_partout') css += `border:${cfg.img_borda_largura_pt}pt solid ${cfg.img_borda_cor};padding:10px;background:#fff;`;
    const fundo = { branco: '#FFFFFF', suave: '#F8FAFC' }[cfg.codigo_fundo];
    if (fundo) css += `background:${fundo};`;
    return css;
  };

  let temporizador = 0;
  const atualizar = () => {
    const v = validarCodigoFigura(sel.value, ta.value);
    linhasErro = new Set(v.erros.map(e => e.linha).filter(Boolean));
    atualizarGutter();
    stat.innerHTML = '';
    if (v.ok && !v.avisos?.length) stat.innerHTML = '<span class="ok">✓ Sintaxe válida</span>';
    else {
      if (v.ok) stat.innerHTML = '<span class="ok">✓ Sintaxe válida</span> <span style="color:#B45309">com avisos:</span>';
      (v.erros || []).forEach(e => {
        const a = el('span', 'er', `✖ ${e.linha ? `Linha ${e.linha}: ` : ''}${esc(e.mensagem)}`);
        a.addEventListener('click', () => irParaLinha(e.linha));
        stat.appendChild(a);
      });
      (v.avisos || []).slice(0, 8).forEach(a => stat.appendChild(el('span', 'av', `⚠ ${esc(a)}`)));
    }
    bOk.disabled = !v.ok;
    bOk.style.opacity = v.ok ? '1' : '.5';
    montarPrevia(v.ok);
  };
  const irParaLinha = (n) => {
    if (!n) return;
    const linhas = ta.value.split('\n');
    const pos = linhas.slice(0, n - 1).join('\n').length + (n > 1 ? 1 : 0);
    ta.focus(); ta.setSelectionRange(pos, pos + (linhas[n - 1] || '').length);
    ta.scrollTop = Math.max(0, (n - 4) * 18.6);
  };

  ta.addEventListener('input', () => { clearTimeout(temporizador); atualizarGutter(); temporizador = setTimeout(atualizar, 180); });
  ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = ta;
      ta.setRangeText('  ', a, b, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
  sel.addEventListener('change', () => {
    const vazio = !ta.value.trim() || FONTES_CONTEUDO.some(f => f.codigo && ta.value.trim() === exemploDeCodigo(f.id).trim());
    if (vazio || confirm('Trocar a linguagem substitui o código atual por um modelo. Continuar?')) ta.value = exemploDeCodigo(sel.value);
    atualizar();
  });
  bFormatar.addEventListener('click', () => { ta.value = formatarCodigoFigura(sel.value, ta.value); atualizar(); ta.focus(); });
  bExemplo.addEventListener('click', () => { ta.value = exemploDeCodigo(sel.value); atualizar(); });

  const fechar = () => { clearTimeout(temporizador); ov.remove(); document.removeEventListener('keydown', tecla, true); };
  const aplicar = () => {
    if (bOk.disabled) return;
    fechar();
    aoSalvar({ ...rascunho, sourceType: sel.value, content: ta.value, url: '' });
  };
  const tecla = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); aplicar(); }
  };
  document.addEventListener('keydown', tecla, true);
  bCancel.addEventListener('click', fechar);
  bOk.addEventListener('click', aplicar);
  document.body.appendChild(ov);
  atualizar();
  ta.focus();
}

// ───────────────────────────── Rasterização para o DOCX ─────────────────────────────

function carregarImagem(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Falha ao carregar a figura.')); i.src = url; });
}

/**
 * Converte a figura por código em PNG (2× de densidade) com canvas.
 * @param {{tipo:'svg'|'html', svg?:string, html?:string, css?:string, escopo?:string, largura:number, altura:number, fundo?:string}} d
 * @returns {Promise<{bytes:Uint8Array, largura:number, altura:number}|null>}
 */
export async function rasterizarFiguraParaPng(d) {
  let svgDoc, w = Math.max(40, Math.round(d.largura || 640)), h = Math.round(d.altura || 0);
  if (d.tipo === 'svg') svgDoc = d.svg;
  else {
    const uid = /"([^"]+)"/.exec(d.escopo || '')?.[1] || 'f0_0';
    const medidor = el('div');
    medidor.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;font:13px/1.4 Arial,sans-serif;color:#1F2733`;
    medidor.innerHTML = `<style>${d.css || ''}</style><div data-ath-esc="${uid}">${d.html}</div>`;
    document.body.appendChild(medidor);
    h = Math.max(30, Math.ceil(medidor.scrollHeight));
    medidor.remove();
    const doc = new DOMParser().parseFromString(`<body>${d.html}</body>`, 'text/html');
    const xhtml = Array.from(doc.body.childNodes).map(n => new XMLSerializer().serializeToString(n)).join('');
    svgDoc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" data-ath-esc="${uid}" style="font:13px/1.4 Arial,sans-serif;color:#1F2733"><style>${(d.css || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>${xhtml}</div></foreignObject></svg>`;
  }
  const img = await carregarImagem('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDoc));
  const esc2 = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * esc2; canvas.height = Math.max(1, h) * esc2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = d.fundo || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), largura: w, altura: h };
}

export { definirPapelSemantico, papelSemanticoDoBloco, uidDoItem, ROTULOS_FIGURA };
