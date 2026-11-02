// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Canvas de folhas mestras (estilo Affinity/InDesign): seleção com caixa de 8 alças e rotação,
 * arraste com guias magnéticas, réguas com guias puxáveis, inspetor numérico bidirecional (mm/cm/pt/px),
 * alinhar/distribuir, camadas, bloqueio, quadro de texto principal e atribuição de mestras por páginas.
 * Edita diretamente o `rascunho` da mestra (o chamador decide se confirma ou descarta).
 */

import {
  ANCORAS, normalizarElemento, criarElementoLivre, redimensionar, anguloPeloPonteiro, calcularSnap, alvosDeSnap, criarGuia,
  alinharElementos, distribuirElementos, mudarOrdemZ, ordemDeEmpilhamento, converterUnidade, pontoDeAncora, posicionarPorAncora,
  paraReferencia, deReferencia, normalizarMestraCanvas, normalizarGradeGuia, linhasDeGrade, normalizarRegrasMestra, quadroTextoPrimario, caixaEnvolvente
} from '../core/athenes_mestra_canvas.js';
import { elementosMestraHtml, renderizadoPeloCanvas } from '../core/athenes_mestra_render.js';
import { dimensoesPapelMm } from '../core/athenes_grid.js';
import { svgIcone } from './athenes_icones.js';
import { lerImagemComprimida } from './athenes_imagem_util.js';
import { mostrarAviso } from './athenes_aviso.js';

const PX_MM = 96 / 25.4;
const CSS = `
.ath-mc{position:fixed;inset:0;z-index:100000;background:#E5E9F0;display:flex;flex-direction:column;font:600 12px var(--glx-font,system-ui);color:#1F2733}
.ath-mc *{box-sizing:border-box}
.ath-mc-top{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;overflow-x:auto;padding:8px 12px;background:#fff;border-bottom:1px solid #C8D7E6;scrollbar-width:thin}
.ath-mc-top>*{flex:none}
.ath-mc-top .sep{width:1px;height:22px;background:#D5DEE9;margin:0 4px}
.ath-mc-b{height:30px;min-width:30px;padding:0 7px;white-space:nowrap;border:1px solid #D5DEE9;border-radius:8px;background:#fff;cursor:pointer;font:700 11.5px var(--glx-font,inherit);color:#314F79;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.ath-mc-b:hover:not(:disabled){background:#EEF4FA;border-color:#314F79}.ath-mc-b:disabled{opacity:.4;cursor:default}.ath-mc-b.on{background:#314F79;color:#fff;border-color:#314F79}
.ath-mc-b.pri{background:#314F79;color:#fff;border-color:#314F79}
.ath-mc-corpo{flex:1;min-height:0;display:grid;grid-template-columns:1fr 300px}
.ath-mc-area{position:relative;overflow:auto;background:#E5E9F0}
.ath-mc-regua-h,.ath-mc-regua-v{position:absolute;background:#fff;z-index:5;color:#64748B;font:600 9px sans-serif;user-select:none}
.ath-mc-regua-h{left:22px;top:0;right:0;height:22px;border-bottom:1px solid #C8D7E6;cursor:s-resize}
.ath-mc-regua-v{left:0;top:22px;bottom:0;width:22px;border-right:1px solid #C8D7E6;cursor:e-resize}
.ath-mc-cant{position:absolute;left:0;top:0;width:22px;height:22px;background:#fff;z-index:6;border-right:1px solid #C8D7E6;border-bottom:1px solid #C8D7E6}
.ath-mc-cena{position:absolute;left:22px;top:22px;right:0;bottom:0;overflow:auto;display:flex;padding:40px}
.ath-mc-mesa{position:relative;margin:auto;flex:none}
.ath-mc-folha{position:relative;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.18);transform-origin:0 0;overflow:visible;user-select:none;touch-action:none}
.ath-mc-folha .ath-mc-margem{position:absolute;border:0.2mm dashed #6AA0D8;pointer-events:none;z-index:2}
.ath-mc-folha .ath-mc-guia{position:absolute;background:#E5484D;z-index:7;pointer-events:none}
.ath-mc-folha .ath-mc-guia.v{top:0;bottom:0;width:0.18mm}.ath-mc-folha .ath-mc-guia.h{left:0;right:0;height:0.18mm}
.ath-mc-folha .ath-mc-guia.smart{background:#E11D74}
.ath-mc-sel{position:absolute;z-index:9;border:0.3mm solid #2F7BD0;pointer-events:none}
.ath-mc-sel.multi{border-style:dashed}
.ath-mc-h{position:absolute;background:#fff;border:0.3mm solid #2F7BD0;pointer-events:auto;z-index:10}
.ath-mc-hrot{position:absolute;border-radius:50%;background:#2F7BD0;pointer-events:auto;cursor:grab;z-index:10}
.ath-mc-lateral{background:#fff;border-left:1px solid #C8D7E6;overflow:auto;display:flex;flex-direction:column}
.ath-mc-sec{padding:10px 12px;border-bottom:1px solid #E3EAF2;display:flex;flex-direction:column;gap:7px}
.ath-mc-sec h4{margin:0;font:800 10.5px var(--glx-font,inherit);letter-spacing:.06em;text-transform:uppercase;color:#314F79}
.ath-mc-g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ath-mc-g3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ath-mc label{display:flex;flex-direction:column;gap:2px;font:700 10px var(--glx-font,inherit);color:#64748B}
.ath-mc input[type=number],.ath-mc input[type=text],.ath-mc select,.ath-mc textarea{height:28px;width:100%;padding:0 7px;border:1px solid #D5DEE9;border-radius:7px;font:600 12px var(--glx-font,inherit);background:#fff;color:#1F2733}
.ath-mc textarea{height:56px;padding:5px 7px;resize:vertical}.ath-mc input[type=color]{height:28px;width:100%;padding:2px;border:1px solid #D5DEE9;border-radius:7px}
.ath-mc-chk{flex-direction:row!important;align-items:center;gap:6px!important;font:600 11.5px var(--glx-font,inherit)!important;color:#1F2733!important}.ath-mc-chk input{width:auto!important;height:auto!important}
.ath-mc-anc{display:grid;grid-template-columns:repeat(3,14px);gap:3px}.ath-mc-anc button{width:14px;height:14px;border:1px solid #9AB0C8;background:#fff;border-radius:3px;padding:0;cursor:pointer}.ath-mc-anc button.on{background:#314F79;border-color:#314F79}
.ath-mc-cam{display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid transparent;border-radius:7px;cursor:pointer}.ath-mc-cam:hover{background:#F1F5F9}.ath-mc-cam.on{background:#EAF1FA;border-color:#9DB9DA}
.ath-mc-cam .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ath-mc-cam .t{color:#64748B;font-size:10px}
.ath-mc-cam button{border:0;background:none;cursor:pointer;color:#64748B;font-size:12px;padding:0 3px}
.ath-mc-regra{display:grid;grid-template-columns:1fr 46px 46px 20px;gap:4px;align-items:center}
.ath-mc-dica{font:600 10.5px var(--glx-font,inherit);color:#64748B;line-height:1.4}
`;

const IC = {"olho": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>", "olho_off": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22\"/></svg>", "trancado": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/></svg>", "aberto": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 7.5-2\"/></svg>", "lixo": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14\"/></svg>", "copiar": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M5 15V5a2 2 0 0 1 2-2h8\"/></svg>", "ima": "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 3v8a6 6 0 0 0 12 0V3M6 7h4M14 7h4\"/></svg>"};
const sv = (d) => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONES = {
  esquerda: sv('<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>'),
  centro: sv('<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>'),
  direita: sv('<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>'),
  topo: sv('<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>'),
  meio: sv('<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>'),
  base: sv('<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>')
};
const ICO = {
  forma: sv('<rect x="4" y="6" width="16" height="12" rx="1.5"/>'), elipse: sv('<circle cx="12" cy="12" r="8"/>'), filete: sv('<path d="M3 12h18"/>'),
  texto: sv('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'), quadro: sv('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  distH: sv('<path d="M3 4v16M21 4v16"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>'), distV: sv('<path d="M4 3h16M4 21h16"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>'),
  frente: sv('<rect x="3" y="3" width="11" height="11" rx="1" fill="currentColor" fill-opacity=".25"/><rect x="10" y="10" width="11" height="11" rx="1"/>'),
  tras: sv('<rect x="10" y="10" width="11" height="11" rx="1" fill="currentColor" fill-opacity=".25"/><rect x="3" y="3" width="11" height="11" rx="1"/>'),
  sobe: sv('<path d="M12 19V5M6 11l6-6 6 6"/>'), desce: sv('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  zmenos: sv('<path d="M5 12h14"/>'), zmais: sv('<path d="M12 5v14M5 12h14"/>'), ajustar: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')
};
const rotulosAnc = { nw: 'Topo-esquerda', n: 'Topo', ne: 'Topo-direita', w: 'Esquerda', c: 'Centro', e: 'Direita', sw: 'Base-esquerda', s: 'Base', se: 'Base-direita' };

export class CanvasMestra {
  /**
   * @param {object} doc documento (para a lista de mestras e `atribuicoes_mestra`)
   * @param {object} rascunho mestra em edição (mutada diretamente)
   * @param {{onFechar?:Function}} opcoes
   */
  constructor(doc, rascunho, opcoes = {}) {
    this.doc = doc;
    this.r = normalizarMestraCanvas(rascunho);
    this.onFechar = opcoes.onFechar || (() => {});
    this.sel = new Set();
    this.unidade = 'mm';
    this.referencia = 'folha';
    this.ancora = 'nw';
    this.zoom = 1;
    this.verso = false;
    this.snap = true;
    this.guiasInteligentes = [];
    this.inserido = false;
    const dim = dimensoesPapelMm(this.r.formato, this.r.orientacao);
    this.W = dim.largura_mm; this.H = dim.altura_mm;
    this.montar();
  }

  // ───────────── geometria e coordenadas ─────────────
  get esc() { return this.zoom * 2.4; } // px por mm no ecrã (≈ 2,4 px/mm no zoom 100%)
  margens() { return this.r.margens_mm || { t: 25, r: 20, b: 20, l: 25 }; }
  geo() { return { larguraMm: this.W, alturaMm: this.H, margens: this.margens() }; }
  elementos() { return this.r.elementos_recorrentes; }
  porId(id) { return this.elementos().find(e => e.id === id); }
  selecionados() { return [...this.sel].map(id => this.porId(id)).filter(Boolean); }
  primario() { const s = this.selecionados(); return s.length === 1 ? s[0] : null; }
  paraMm(ev) {
    const r = this.folha.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / (r.width / this.W), y: (ev.clientY - r.top) / (r.height / this.H) };
  }

  // ───────────── montagem ─────────────
  montar() {
    if (!document.getElementById('ath-mc-css')) {
      const st = document.createElement('style'); st.id = 'ath-mc-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const raiz = document.createElement('div');
    raiz.className = 'ath-mc'; raiz.tabIndex = -1;
    raiz.innerHTML = `
      <div class="ath-mc-top" data-top></div>
      <div class="ath-mc-corpo">
        <div class="ath-mc-area">
          <div class="ath-mc-cant"></div><div class="ath-mc-regua-h" data-regua="h"></div><div class="ath-mc-regua-v" data-regua="v"></div>
          <div class="ath-mc-cena" data-cena><div class="ath-mc-mesa" data-mesa><div class="ath-mc-folha" data-folha></div></div></div>
        </div>
        <aside class="ath-mc-lateral" data-lateral></aside>
      </div>`;
    document.body.appendChild(raiz);
    this.raiz = raiz;
    this.folha = raiz.querySelector('[data-folha]');
    this.mesa = raiz.querySelector('[data-mesa]');
    this.cena = raiz.querySelector('[data-cena]');
    this.top = raiz.querySelector('[data-top]');
    this.lateral = raiz.querySelector('[data-lateral]');
    this.reguaH = raiz.querySelector('[data-regua="h"]');
    this.reguaV = raiz.querySelector('[data-regua="v"]');
    this.vincular();
    this.montarBarra();
    this.atualizarTudo();
    raiz.focus();
  }

  fechar() {
    document.removeEventListener('keydown', this.teclado, true);
    window.removeEventListener('resize', this.aoRedimensionar);
    this.raiz.remove();
    this.onFechar();
  }

  montarBarra() {
    const b = (acao, rot, tit, extra = '') => `<button type="button" class="ath-mc-b ${extra}" data-acao="${acao}" title="${tit}" aria-label="${tit}">${rot}</button>`;
    this.top.innerHTML = `
      ${b('fechar', `${svgIcone('voltar', 16)} Voltar`, 'Voltar ao editor da mestra (as alterações ficam no rascunho até salvar)', 'pri')}
      <span class="sep"></span>
      ${b('add-forma', ICO.forma, 'Adicionar retângulo')}${b('add-elipse', ICO.elipse, 'Adicionar elipse')}${b('add-linha', ICO.filete, 'Adicionar filete (linha)')}
      ${b('add-texto', ICO.texto, 'Adicionar texto com variáveis ({pagina}, {total}, {secao}, {data})')}${b('add-quadro', ICO.quadro, 'Quadro de texto principal (fluxo do corpo do documento)')}
      <span class="sep"></span>
      ${Object.entries(ICONES).map(([k, i]) => b('al-' + k, i, 'Alinhar: ' + k)).join('')}
      ${b('dist-h', ICO.distH, 'Distribuir horizontalmente (3 ou mais)')}${b('dist-v', ICO.distV, 'Distribuir verticalmente (3 ou mais)')}
      <span class="sep"></span>
      ${b('z-frente', ICO.frente, 'Trazer para frente')}${b('z-avancar', ICO.sobe, 'Avançar um nível')}${b('z-recuar', ICO.desce, 'Recuar um nível')}${b('z-tras', ICO.tras, 'Enviar para trás')}
      <span class="sep"></span>
      ${b('bloquear', IC.trancado, 'Bloquear/desbloquear elemento')}${b('duplicar', svgIcone('copiar', 15), 'Duplicar (Ctrl+D)')}${b('excluir', svgIcone('lixeira', 15), 'Excluir (Delete)')}
      <span class="sep"></span>
      ${b('snap', IC.ima, 'Ímã: guias magnéticas (segure Alt para ignorar)', this.snap ? 'on' : '')}${b('grade', svgIcone('guia_grade', 15), 'Mostrar grade guia', this.r.grade_guia?.visivel ? 'on' : '')}
      <span class="sep"></span>
      ${b('zoom-menos', ICO.zmenos, 'Reduzir zoom')}<span data-zoom style="min-width:40px;text-align:center">100%</span>${b('zoom-mais', ICO.zmais, 'Ampliar zoom')}${b('zoom-ajustar', ICO.ajustar, 'Ajustar à tela')}
      <span style="flex:1"></span>
      <span style="color:#64748B;white-space:nowrap" data-status></span>`;
  }

  // ───────────── desenho ─────────────
  atualizarTudo() { this.desenhar(); this.painel(); this.atualizarBarra(); }

  atualizarBarra() {
    const sels = this.selecionados();
    const tem = sels.length > 0; const um = sels.length === 1;
    const set = (a, on) => { const x = this.top.querySelector(`[data-acao="${a}"]`); if (x) x.disabled = !on; };
    ['excluir', 'duplicar', 'bloquear', 'z-frente', 'z-avancar', 'z-recuar', 'z-tras'].forEach(a => set(a, tem));
    Object.keys(ICONES).forEach(k => set('al-' + k, tem));
    set('dist-h', sels.length >= 3); set('dist-v', sels.length >= 3);
    const sn = this.top.querySelector('[data-acao="snap"]'); if (sn) sn.classList.toggle('on', this.snap);
    const bl = this.top.querySelector('[data-acao="bloquear"]');
    if (bl) { bl.innerHTML = um && sels[0].bloqueado ? IC.aberto : IC.trancado; bl.title = um && sels[0].bloqueado ? 'Desbloquear elemento' : 'Bloquear elemento'; }
    const gr = this.top.querySelector('[data-acao="grade"]'); if (gr) gr.classList.toggle('on', !!this.r.grade_guia?.visivel);
    this.top.querySelector('[data-zoom]').textContent = `${Math.round(this.zoom * 100)}%`;
  }

  desenhar() {
    const s = this.esc / PX_MM; // CSS mm → escala
    const f = this.folha;
    f.style.width = `${this.W}mm`; f.style.height = `${this.H}mm`;
    f.style.transform = `scale(${s})`;
    this.mesa.style.width = `${this.W * this.esc}px`; this.mesa.style.height = `${this.H * this.esc}px`;
    const m = this.margens();
    const q = quadroTextoPrimario(this.r);
    const guias = (this.r.guias || []).map((g, i) => `<div class="ath-mc-guia ${g.eixo}" style="${g.eixo === 'v' ? `left:${g.pos_mm}mm` : `top:${g.pos_mm}mm`}" data-guia="${i}"></div>`).join('');
    const smart = this.guiasInteligentes.map(g => `<div class="ath-mc-guia smart ${g.eixo}" style="${g.eixo === 'v' ? `left:${g.pos_mm}mm` : `top:${g.pos_mm}mm`}"></div>`).join('');
    const margem = q ? '' : `<div class="ath-mc-margem" style="left:${m.l}mm;top:${m.t}mm;right:${m.r}mm;bottom:${m.b}mm"></div>`;
    const html = elementosMestraHtml(this.r, { numero: this.verso ? 2 : 1 }, this.geo(), { pagina: 1, total: 10, secao: 'Seção', documento: { titulo: 'Título' } }, { editor: true });
    f.innerHTML = `${this.gradeHtml()}${margem}${this.legadosHtml()}<div data-els style="position:absolute;inset:0">${html}</div>${guias}${smart}${this.selecaoHtml()}`;
    this.desenharReguas();
    const st = this.top.querySelector('[data-status]');
    if (st) st.textContent = this.verso ? 'Verso (somente leitura)' : `${this.W} × ${this.H} mm`;
  }

  /** Malha regular (gradiente em mm) e colunas/linhas de layout; fica atrás dos elementos. */
  gradeHtml() {
    const g = this.r.grade_guia;
    if (!g?.visivel) return '';
    let h = '';
    if (g.passo_mm >= 1) {
      const c = 'rgba(47,123,208,.38)';
      h += `<div style="position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(to right,${c} 0.22mm,transparent 0.22mm),linear-gradient(to bottom,${c} 0.22mm,transparent 0.22mm);background-size:${g.passo_mm}mm ${g.passo_mm}mm"></div>`;
    }
    const m = this.margens();
    const l = linhasDeGrade({ ...g, passo_mm: 0 }, this.W, this.H, m);
    const faixas = (arr, eixo) => {
      let o = '';
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const pos = eixo === 'v'
          ? `left:${arr[i]}mm;width:${arr[i + 1] - arr[i]}mm;top:${m.t}mm;bottom:${m.b}mm`
          : `top:${arr[i]}mm;height:${arr[i + 1] - arr[i]}mm;left:${m.l}mm;right:${m.r}mm`;
        o += `<div style="position:absolute;pointer-events:none;background:rgba(225,29,116,.07);border:0.12mm solid rgba(225,29,116,.35);${pos}"></div>`;
      }
      return o;
    };
    return h + faixas(l.v, 'v') + faixas(l.h, 'h');
  }

  /** Elementos legados (tarja, rótulo, marca d'água): só referência visual; editados no painel clássico. */
  legadosHtml() {
    return this.elementos().filter(e => !renderizadoPeloCanvas(e)).map(e => {
      const cor = e.cor || '#314F79';
      if (e.tipo === 'tarja') {
        const a = e.altura_mm || 8;
        const pos = e.posicao === 'topo' ? `top:0;left:0;right:0;height:${a}mm` : e.posicao === 'base' ? `bottom:0;left:0;right:0;height:${a}mm` : `top:0;bottom:0;left:0;width:${a}mm`;
        return `<div style="position:absolute;${pos};background:${cor};opacity:.55;pointer-events:none" title="Tarja (editar no painel clássico)"></div>`;
      }
      if (e.tipo === 'rotulo_estatico') return `<div style="position:absolute;top:${e.y_mm || 12}mm;left:${this.margens().l}mm;right:${this.margens().r}mm;text-align:center;font:800 ${e.tamanho_pt || 10}pt sans-serif;color:${cor};opacity:.6;pointer-events:none">${(e.texto || '').replace(/</g, '&lt;')}</div>`;
      return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font:900 32pt sans-serif;color:${cor};opacity:${e.opacidade || 0.12};pointer-events:none;white-space:nowrap">${(e.texto || '').replace(/</g, '&lt;')}</div>`;
    }).join('');
  }

  selecaoHtml() {
    if (this.verso) return '';
    const sels = this.selecionados().filter(e => e.visivel !== false);
    if (!sels.length) return '';
    const hpx = 7 / this.esc; // 7px em mm
    const caixa = (e, cls) => {
      const rot = e.rotacao_graus ? `transform:rotate(${e.rotacao_graus}deg);transform-origin:50% 50%;` : '';
      return `<div class="ath-mc-sel ${cls}" style="left:${e.x_mm}mm;top:${e.y_mm}mm;width:${e.largura_mm}mm;height:${e.altura_mm}mm;${rot}">`;
    };
    if (sels.length > 1) return sels.map(e => `${caixa(e, 'multi')}</div>`).join('');
    const e = sels[0];
    let h = '';
    if (!e.bloqueado) {
      const pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
      const cur = { nw: 'nwse', n: 'ns', ne: 'nesw', e: 'ew', se: 'nwse', s: 'ns', sw: 'nesw', w: 'ew' };
      h = Object.entries(pos).map(([k, [px, py]]) => `<div class="ath-mc-h" data-alca="${k}" style="left:calc(${px}% - ${hpx / 2}mm);top:calc(${py}% - ${hpx / 2}mm);width:${hpx}mm;height:${hpx}mm;cursor:${cur[k]}-resize"></div>`).join('');
      h += `<div class="ath-mc-hrot" data-alca="rot" title="Girar (Shift = 90°)" style="left:calc(50% - ${hpx / 1.5}mm);top:${-hpx * 3.4}mm;width:${hpx * 1.3}mm;height:${hpx * 1.3}mm"></div>`;
      h += `<div style="position:absolute;left:calc(50% - 0.1mm);top:${-hpx * 2.2}mm;width:0.2mm;height:${hpx * 2.2}mm;background:#2F7BD0"></div>`;
    }
    return `${caixa(e, '')}${h}</div>`;
  }

  desenharReguas() {
    const passo = this.zoom >= 1.6 ? 5 : this.zoom >= 0.7 ? 10 : 20;
    const esc = this.esc;
    const ox = this.mesa.offsetLeft; const oy = this.mesa.offsetTop;
    let h = ''; let v = '';
    for (let mm = 0; mm <= this.W; mm += passo) h += `<span style="position:absolute;left:${ox + mm * esc - this.cena.scrollLeft}px;bottom:2px;border-left:1px solid #9AB0C8;padding-left:2px;height:10px">${mm % (passo * 2) === 0 || passo >= 10 ? mm : ''}</span>`;
    for (let mm = 0; mm <= this.H; mm += passo) v += `<span style="position:absolute;top:${oy + mm * esc - this.cena.scrollTop}px;right:2px;border-top:1px solid #9AB0C8;padding-top:1px;font-size:8px">${mm % (passo * 2) === 0 || passo >= 10 ? mm : ''}</span>`;
    this.reguaH.innerHTML = h; this.reguaV.innerHTML = v;
  }

  // ───────────── painel lateral ─────────────
  numeroDe(mm) { return Math.round(converterUnidade(mm, 'mm', this.unidade) * 100) / 100; }
  paraMmDe(v) { return converterUnidade(v, this.unidade, 'mm'); }

  painel() {
    const e = this.primario();
    const sels = this.selecionados();
    const un = this.unidade;
    const num = (id, rot, val, extra = '') => `<label>${rot}<input type="number" step="any" data-f="${id}" value="${val}" ${extra}></label>`;
    let insp = '';
    if (e) {
      const ref = paraReferencia(e, this.referencia, this.margens());
      const ap = pontoDeAncora({ ...e, x_mm: ref.x, y_mm: ref.y }, this.ancora);
      insp = `
        <div class="ath-mc-sec"><h4>Transformar</h4>
          <div class="ath-mc-g2">
            <label>Unidade<select data-f="unidade">${['mm', 'cm', 'pt', 'px'].map(u => `<option ${u === un ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
            <label>Origem<select data-f="referencia"><option value="folha" ${this.referencia === 'folha' ? 'selected' : ''}>Folha</option><option value="margem" ${this.referencia === 'margem' ? 'selected' : ''}>Margem</option></select></label>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <div class="ath-mc-anc" title="Ponto de referência de X/Y">${ANCORAS.map(a => `<button type="button" data-anc="${a}" class="${a === this.ancora ? 'on' : ''}" title="${rotulosAnc[a]}"></button>`).join('')}</div>
            <div class="ath-mc-g2" style="flex:1">${num('x', 'X (' + un + ')', this.numeroDe(ap.x))}${num('y', 'Y (' + un + ')', this.numeroDe(ap.y))}</div>
          </div>
          <div class="ath-mc-g2">${num('w', 'Largura', this.numeroDe(e.largura_mm), 'min="0"')}${num('h', 'Altura', this.numeroDe(e.altura_mm), 'min="0"')}</div>
          <div class="ath-mc-g2">${num('rot', 'Rotação (°)', e.rotacao_graus)}
            <label class="ath-mc-chk" style="margin-top:14px"><input type="checkbox" data-f="prop" ${e.travar_proporcao ? 'checked' : ''}> Travar proporção</label></div>
          <div style="display:flex;gap:4px">${[0, 90, 180, 270].map(g => `<button type="button" class="ath-mc-b" data-rot="${g}" style="flex:1;padding:0">${g}°</button>`).join('')}</div>
          <label class="ath-mc-chk"><input type="checkbox" data-f="bloq" ${e.bloqueado ? 'checked' : ''}> Bloquear (evita seleção acidental)</label>
        </div>
        ${this.painelTipo(e)}`;
    } else if (sels.length > 1) {
      insp = `<div class="ath-mc-sec"><h4>${sels.length} elementos</h4><div class="ath-mc-dica">Use a barra superior para alinhar/distribuir. Segure Shift ao clicar para somar à seleção.</div></div>`;
    } else {
      insp = `<div class="ath-mc-sec"><h4>Nada selecionado</h4><div class="ath-mc-dica">Clique num elemento para editar. Arraste das réguas para criar guias; arraste de volta para remover. Ctrl+roda = zoom.</div></div>`;
    }
    const q = quadroTextoPrimario(this.r);
    const gd = normalizarGradeGuia(this.r.grade_guia);
    this.lateral.innerHTML = `${insp}
      <div class="ath-mc-sec"><h4>Camadas</h4><div data-camadas style="display:flex;flex-direction:column;gap:2px;max-height:190px;overflow:auto">${this.camadasHtml()}</div></div>
      <div class="ath-mc-sec"><h4>Grade guia</h4>
        <label class="ath-mc-chk"><input type="checkbox" data-gd="visivel" ${gd.visivel ? 'checked' : ''}> Mostrar grade na folha</label>
        <label class="ath-mc-chk"><input type="checkbox" data-gd="snap" ${gd.snap ? 'checked' : ''}> Ímã na grade</label>
        <div class="ath-mc-g2"><label>Malha (mm, 0 = sem)<input type="number" min="0" max="100" step="1" data-gd="passo_mm" value="${gd.passo_mm}"></label>
          <label>Calha (mm)<input type="number" min="0" max="30" step="0.5" data-gd="calha_mm" value="${gd.calha_mm}"></label></div>
        <div class="ath-mc-g2"><label>Colunas<input type="number" min="0" max="24" data-gd="colunas" value="${gd.colunas}"></label>
          <label>Linhas<input type="number" min="0" max="24" data-gd="linhas" value="${gd.linhas}"></label></div>
        <div class="ath-mc-dica">Colunas e linhas dividem a área das margens; os elementos encaixam nas bordas.</div></div>
      <div class="ath-mc-sec"><h4>Páginas frente e verso</h4>
        <label class="ath-mc-chk"><input type="checkbox" data-f="espelhada" ${this.r.espelhada ? 'checked' : ''}> Mestra espelhada (verso invertido)</label>
        <div style="display:flex;gap:4px"><button type="button" class="ath-mc-b ${!this.verso ? 'on' : ''}" data-verso="0" style="flex:1">Reto</button><button type="button" class="ath-mc-b ${this.verso ? 'on' : ''}" data-verso="1" style="flex:1" ${this.r.espelhada ? '' : 'disabled'}>Verso</button></div>
      </div>
      <div class="ath-mc-sec"><h4>Aplicar mestras às páginas</h4>${this.regrasHtml()}</div>
      <div class="ath-mc-sec"><div class="ath-mc-dica">${q ? 'O corpo do texto flui dentro do quadro de texto (margens definidas por ele).' : 'Sem quadro de texto: o corpo usa as margens da mestra.'}</div></div>`;
  }

  painelTipo(e) {
    const cor = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);
    if (e.tipo === 'texto') {
      return `<div class="ath-mc-sec"><h4>Texto</h4>
        <label>Conteúdo (variáveis: {pagina} {total} {secao} {data} {documento.titulo})<textarea data-p="texto">${(e.texto || '').replace(/</g, '&lt;')}</textarea></label>
        <div class="ath-mc-g3"><label>Tamanho (pt)<input type="number" step="0.5" data-p="tamanho_pt" value="${e.tamanho_pt || 10}"></label>
          <label>Cor<input type="color" data-p="cor" value="${cor(e.cor, '#314F79')}"></label>
          <label>Alinhar<select data-p="alinhamento">${['esquerda', 'centro', 'direita', 'justificado'].map(a => `<option ${a === e.alinhamento ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
        <label class="ath-mc-chk"><input type="checkbox" data-pc="negrito" ${e.negrito ? 'checked' : ''}> Negrito</label></div>`;
    }
    if (e.tipo === 'forma') {
      return `<div class="ath-mc-sec"><h4>Forma</h4>
        <div class="ath-mc-g2"><label>Tipo<select data-p="forma">${['retangulo', 'elipse', 'linha'].map(a => `<option ${a === e.forma ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label>Opacidade<input type="number" min="0" max="1" step="0.05" data-p="opacidade" value="${e.opacidade ?? 1}"></label></div>
        <div class="ath-mc-g3"><label>Borda<input type="color" data-p="borda_cor" value="${cor(e.borda_cor, '#314F79')}"></label>
        <label>Espessura (mm)<input type="number" min="0" step="0.1" data-p="borda_mm" value="${e.borda_mm ?? 0.3}"></label>
        <label>Raio (mm)<input type="number" min="0" step="0.5" data-p="raio_mm" value="${e.raio_mm ?? 0}"></label></div>
        <label>Preenchimento<input type="color" data-p="fundo" value="${cor(e.fundo, '#E8EEF6')}"></label>
        <label class="ath-mc-chk"><input type="checkbox" data-sem-fundo ${e.fundo === 'transparent' ? 'checked' : ''}> Sem preenchimento</label></div>`;
    }
    if (e.tipo === 'quadro_texto') {
      const primario = quadroTextoPrimario(this.r)?.id === e.id;
      return `<div class="ath-mc-sec"><h4>Quadro de texto</h4>
        <label class="ath-mc-chk"><input type="checkbox" data-f="primario" ${primario ? 'checked' : ''}> Fluxo principal do corpo</label>
        <div class="ath-mc-g2"><label>Colunas<input type="number" min="1" max="4" data-p="colunas" value="${e.colunas || 1}"></label><label>Espaço (mm)<input type="number" min="0" step="0.5" data-p="gap_mm" value="${e.gap_mm ?? 4.5}"></label></div></div>`;
    }
    if (e.tipo === 'foto_capa') {
      const incorporada = (e.url || '').startsWith('data:');
      return `<div class="ath-mc-sec"><h4>Imagem</h4>
        <div class="ath-mc-dica">${incorporada ? 'Imagem incorporada ao documento.' : (e.url ? 'Endereço: ' + String(e.url).replace(/</g, '&lt;') : 'Nenhuma imagem escolhida.')}</div>
        <div style="display:flex;gap:6px"><button type="button" class="ath-mc-b" data-up-foto style="flex:1">Escolher imagem…</button>${e.url ? '<button type="button" class="ath-mc-b" data-rm-foto>Remover</button>' : ''}</div>
        <div class="ath-mc-g2"><label>Ajuste<select data-p="ajuste">${[['cover', 'Preencher (corta)'], ['contain', 'Caber inteira']].map(([v, r]) => `<option value="${v}" ${v === (e.ajuste || 'cover') ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label>Opacidade<input type="number" min="0" max="1" step="0.05" data-p="opacidade" value="${e.opacidade ?? 1}"></label></div></div>`;
    }
    return `<div class="ath-mc-sec"><h4>${(e.titulo || e.tipo).replace(/</g, '&lt;')}</h4><div class="ath-mc-dica">Transformação disponível; demais propriedades no painel clássico.</div></div>`;
  }

  camadasHtml() {
    const lista = ordemDeEmpilhamento(this.elementos()).reverse();
    if (!lista.length) return '<div class="ath-mc-dica">Sem elementos. Use a barra superior para adicionar.</div>';
    return lista.map(e => `<div class="ath-mc-cam ${this.sel.has(e.id) ? 'on' : ''}" data-cam="${e.id}">
      <span class="n">${(e.titulo || e.tipo).replace(/</g, '&lt;')}</span><span class="t">${e.camada === 'fundo' ? 'fundo' : e.tipo}</span>
      <button type="button" data-vis="${e.id}" title="Mostrar/ocultar">${e.visivel === false ? IC.olho_off : IC.olho}</button>
      <button type="button" data-lock="${e.id}" title="Bloquear">${e.bloqueado ? IC.trancado : IC.aberto}</button></div>`).join('');
  }

  regrasHtml() {
    const regras = this.doc.atribuicoes_mestra = Array.isArray(this.doc.atribuicoes_mestra) ? this.doc.atribuicoes_mestra : [];
    const opcoes = (sel) => (this.doc.mestras || []).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${String(m.nome || m.id).replace(/</g, '&lt;')}</option>`).join('');
    return `${regras.map((g, i) => `<div class="ath-mc-regra" data-regra="${i}">
        <select data-rf="mestraId">${opcoes(g.mestraId)}</select>
        <input type="number" min="1" data-rf="de" value="${g.de ?? 1}" title="Da página">
        <input type="number" min="1" data-rf="ate" value="${g.ate ?? ''}" placeholder="fim" title="Até a página (vazio = fim)">
        <button type="button" class="ath-mc-b" data-rdel="${i}" style="padding:0;min-width:20px;height:24px">×</button></div>`).join('')}
      <button type="button" class="ath-mc-b" data-radd>+ Regra (mestra → páginas)</button>
      <div class="ath-mc-dica">Ex.: Capa nas páginas 1–1; Corpo da 2 em diante. Vence a regra mais específica.</div>`;
  }

  // ───────────── interação ─────────────
  vincular() {
    const raiz = this.raiz;
    raiz.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-acao]'); if (b && !b.disabled) this.acao(b.dataset.acao);
    });
    this.teclado = (ev) => this.aoTeclar(ev);
    document.addEventListener('keydown', this.teclado, true);
    this.cena.addEventListener('scroll', () => this.desenharReguas());
    this.aoRedimensionar = () => this.desenharReguas();
    window.addEventListener('resize', this.aoRedimensionar);
    this.cena.addEventListener('wheel', (ev) => {
      if (!ev.ctrlKey) return; ev.preventDefault();
      this.ajustarZoom(this.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    this.folha.addEventListener('pointerdown', (ev) => this.aoPressionar(ev));
    for (const rg of [this.reguaH, this.reguaV]) {
      rg.addEventListener('pointerdown', (ev) => {
        const guia = criarGuia(rg.dataset.regua === 'h' ? 'h' : 'v', 0);
        // régua horizontal (topo) gera guia horizontal; régua lateral gera guia vertical
        guia.eixo = rg.dataset.regua === 'h' ? 'h' : 'v';
        this.r.guias.push(guia);
        this.iniciarArrasteGuia(ev, guia);
      });
    }
    // painel lateral (delegação)
    this.lateral.addEventListener('input', (ev) => this.aoEditarPainel(ev));
    this.lateral.addEventListener('change', (ev) => this.aoEditarPainel(ev));
    this.lateral.addEventListener('click', (ev) => this.aoClicarPainel(ev));
  }

  aoTeclar(ev) {
    if (!this.raiz.isConnected) return;
    const alvo = ev.target;
    const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT');
    if (ev.key === 'Escape' && !digitando) { ev.stopPropagation(); this.sel.clear(); this.atualizarTudo(); return; }
    if (digitando) return;
    const sels = this.selecionados().filter(e => !e.bloqueado);
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && sels.length) { ev.preventDefault(); this.excluir(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); this.duplicar(); return; }
    const passo = ev.shiftKey ? 5 : 0.5;
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
    if (d && sels.length) {
      ev.preventDefault(); sels.forEach(e => { e.x_mm = +(e.x_mm + d[0]).toFixed(3); e.y_mm = +(e.y_mm + d[1]).toFixed(3); });
      this.atualizarTudo();
    }
    ev.stopPropagation();
  }

  aoPressionar(ev) {
    if (ev.button !== 0 || this.verso) return;
    const alca = ev.target.closest('[data-alca]');
    const alvoEl = ev.target.closest('[data-elem-id]');
    this.raiz.focus();
    if (alca) { ev.preventDefault(); this.iniciarAlca(ev, alca.dataset.alca); return; }
    if (alvoEl) {
      const e = this.porId(alvoEl.dataset.elemId);
      if (!e) return;
      if (e.bloqueado) { this.sel = new Set([e.id]); this.atualizarTudo(); return; }
      if (ev.shiftKey) { this.sel.has(e.id) ? this.sel.delete(e.id) : this.sel.add(e.id); }
      else if (!this.sel.has(e.id)) this.sel = new Set([e.id]);
      this.atualizarTudo();
      ev.preventDefault();
      this.iniciarArraste(ev);
      return;
    }
    const m = this.paraMm(ev);
    const tol = 4 / this.esc;
    const guia = (this.r.guias || []).find(g => Math.abs((g.eixo === 'v' ? m.x : m.y) - g.pos_mm) <= tol);
    if (guia) { this.iniciarArrasteGuia(ev, guia); return; }
    if (!ev.shiftKey) { this.sel.clear(); this.atualizarTudo(); }
  }

  /** Arraste com requestAnimationFrame (~60 fps) e imã nas guias/margens/centro/outros elementos. */
  rastrear(ev, aoMover, aoSoltar) {
    let tick = false; let ultimo = ev;
    const mover = (e) => { ultimo = e; if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; aoMover(ultimo); }); };
    const soltar = (e) => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
      aoMover(e); aoSoltar?.(e);
    };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  }

  iniciarArraste(ev) {
    const ini = this.paraMm(ev);
    const alvos = this.selecionados().filter(e => !e.bloqueado);
    if (!alvos.length) return;
    const origem = alvos.map(e => ({ e, x: e.x_mm, y: e.y_mm }));
    const outros = this.elementos().filter(e => !this.sel.has(e.id));
    const alvosSnap = alvosDeSnap({ larguraMm: this.W, alturaMm: this.H, margens: this.margens(), guias: this.r.guias, elementos: outros, grade: this.r.grade_guia?.visivel ? this.r.grade_guia : null });
    const caixaIni = alvos.length === 1 ? caixaEnvolvente(alvos[0]) : this.caixaDe(alvos);
    let moveu = false;
    this.rastrear(ev, (e) => {
      const p = this.paraMm(e);
      let dx = p.x - ini.x; let dy = p.y - ini.y;
      if (!moveu && Math.hypot(dx, dy) * this.esc < 3) return;
      moveu = true;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      this.guiasInteligentes = [];
      if (this.snap && !e.altKey) {
        const s = calcularSnap({ x: caixaIni.x + dx, y: caixaIni.y + dy, w: caixaIni.w, h: caixaIni.h }, alvosSnap, 6 / this.esc);
        dx += s.dx; dy += s.dy; this.guiasInteligentes = s.guias;
      }
      origem.forEach(o => { o.e.x_mm = +(o.x + dx).toFixed(3); o.e.y_mm = +(o.y + dy).toFixed(3); });
      this.desenhar(); this.sincronizarCampos();
    }, () => { this.guiasInteligentes = []; this.atualizarTudo(); });
  }

  caixaDe(els) {
    const cs = els.map(caixaEnvolvente);
    const x = Math.min(...cs.map(c => c.x)); const y = Math.min(...cs.map(c => c.y));
    return { x, y, w: Math.max(...cs.map(c => c.x + c.w)) - x, h: Math.max(...cs.map(c => c.y + c.h)) - y };
  }

  iniciarAlca(ev, alca) {
    const e = this.primario(); if (!e || e.bloqueado) return;
    const ini = { x_mm: e.x_mm, y_mm: e.y_mm, largura_mm: e.largura_mm, altura_mm: e.altura_mm, rotacao_graus: e.rotacao_graus };
    const p0 = this.paraMm(ev);
    this.rastrear(ev, (m) => {
      const p = this.paraMm(m);
      if (alca === 'rot') {
        e.rotacao_graus = anguloPeloPonteiro(e, p.x, p.y, { travar: m.shiftKey });
      } else {
        const r = redimensionar(ini, alca, p.x - p0.x, p.y - p0.y, { proporcional: m.shiftKey || e.travar_proporcao, centro: m.altKey });
        Object.assign(e, r);
      }
      this.desenhar(); this.sincronizarCampos();
    }, () => this.atualizarTudo());
  }

  iniciarArrasteGuia(ev, guia) {
    ev.preventDefault();
    this.rastrear(ev, (m) => {
      const p = this.paraMm(m);
      guia.pos_mm = +(guia.eixo === 'v' ? p.x : p.y).toFixed(2);
      if (m.shiftKey === false && this.snap) guia.pos_mm = Math.round(guia.pos_mm * 2) / 2;
      this.desenhar();
    }, () => {
      const dentro = guia.eixo === 'v' ? guia.pos_mm >= 0 && guia.pos_mm <= this.W : guia.pos_mm >= 0 && guia.pos_mm <= this.H;
      if (!dentro) this.r.guias = this.r.guias.filter(g => g !== guia);
      this.atualizarTudo();
    });
  }

  /** Atualiza só os números do inspetor durante o arraste (não recria o painel). */
  sincronizarCampos() {
    const e = this.primario(); if (!e) return;
    const ref = paraReferencia(e, this.referencia, this.margens());
    const ap = pontoDeAncora({ ...e, x_mm: ref.x, y_mm: ref.y }, this.ancora);
    const set = (f, v) => { const i = this.lateral.querySelector(`[data-f="${f}"]`); if (i && document.activeElement !== i) i.value = v; };
    set('x', this.numeroDe(ap.x)); set('y', this.numeroDe(ap.y)); set('w', this.numeroDe(e.largura_mm)); set('h', this.numeroDe(e.altura_mm)); set('rot', e.rotacao_graus);
  }

  aoEditarPainel(ev) {
    const t = ev.target;
    const e = this.primario();
    if (t.dataset.rf !== undefined) {
      const i = Number(t.closest('[data-regra]').dataset.regra);
      const g = this.doc.atribuicoes_mestra[i];
      if (t.dataset.rf === 'mestraId') g.mestraId = t.value;
      else g[t.dataset.rf] = t.value === '' ? null : Math.max(1, parseInt(t.value, 10) || 1);
      return;
    }
    if (t.dataset.gd) {
      const k = t.dataset.gd;
      const g = this.r.grade_guia = normalizarGradeGuia({ ...(this.r.grade_guia || {}), [k]: t.type === 'checkbox' ? t.checked : (parseFloat(t.value) || 0) });
      if (k === 'passo_mm' || k === 'colunas' || k === 'linhas') g.visivel = true;
      this.desenhar(); this.atualizarBarra();
      if (t.type === 'checkbox' || ev.type === 'change') this.painel();
      return;
    }
    const f = t.dataset.f;
    if (f === 'unidade') { this.unidade = t.value; this.painel(); return; }
    if (f === 'referencia') { this.referencia = t.value; this.painel(); return; }
    if (f === 'espelhada') { this.r.espelhada = t.checked; if (!t.checked) this.verso = false; this.atualizarTudo(); return; }
    if (!e) return;
    if (f === 'x' || f === 'y') {
      const ref = paraReferencia(e, this.referencia, this.margens());
      const ap = pontoDeAncora({ ...e, x_mm: ref.x, y_mm: ref.y }, this.ancora);
      const alvo = { x: f === 'x' ? this.paraMmDe(parseFloat(t.value) || 0) : ap.x, y: f === 'y' ? this.paraMmDe(parseFloat(t.value) || 0) : ap.y };
      const tmp = { ...e, x_mm: ref.x, y_mm: ref.y };
      posicionarPorAncora(tmp, this.ancora, alvo.x, alvo.y);
      const abs = deReferencia(tmp.x_mm, tmp.y_mm, this.referencia, this.margens());
      e.x_mm = abs.x; e.y_mm = abs.y;
    } else if (f === 'w' || f === 'h') {
      const v = Math.max(1, this.paraMmDe(parseFloat(t.value) || 0));
      const ponto = pontoDeAncora(e, this.ancora);
      const razao = e.largura_mm / (e.altura_mm || 1);
      if (f === 'w') { e.largura_mm = v; if (e.travar_proporcao) e.altura_mm = v / razao; } else { e.altura_mm = v; if (e.travar_proporcao) e.largura_mm = v * razao; }
      posicionarPorAncora(e, this.ancora, ponto.x, ponto.y); // a âncora fica parada ao redimensionar
    } else if (f === 'rot') { e.rotacao_graus = ((parseFloat(t.value) || 0) % 360 + 360) % 360; }
    else if (f === 'prop') { e.travar_proporcao = t.checked; }
    else if (f === 'bloq') { e.bloqueado = t.checked; this.atualizarTudo(); return; }
    else if (f === 'primario') { if (t.checked) this.r.quadro_texto_id = e.id; else if (this.r.quadro_texto_id === e.id) delete this.r.quadro_texto_id; this.atualizarTudo(); return; }
    else if (t.dataset.p) { const k = t.dataset.p; e[k] = t.type === 'number' ? (parseFloat(t.value) || 0) : t.value; if (k === 'fundo') delete e._semFundo; }
    else if (t.dataset.pc) { e[t.dataset.pc] = t.checked; }
    else if (t.hasAttribute('data-sem-fundo')) { e.fundo = t.checked ? 'transparent' : '#E8EEF6'; this.atualizarTudo(); return; }
    this.desenhar(); this.atualizarBarra();
    if (ev.type === 'change') this.sincronizarCampos();
  }

  aoClicarPainel(ev) {
    const t = ev.target;
    if (t.closest('[data-up-foto]')) {
      const e = this.primario(); if (!e) return;
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.addEventListener('change', async () => {
        try { e.url = await lerImagemComprimida(inp.files[0]); this.atualizarTudo(); } catch (err) { mostrarAviso(err.message); }
      });
      inp.click(); return;
    }
    if (t.closest('[data-rm-foto]')) { const e = this.primario(); if (e) { e.url = ''; this.atualizarTudo(); } return; }
    const anc = t.closest('[data-anc]'); if (anc) { this.ancora = anc.dataset.anc; this.painel(); return; }
    const rot = t.closest('[data-rot]'); if (rot) { const e = this.primario(); if (e && !e.bloqueado) { e.rotacao_graus = Number(rot.dataset.rot); this.atualizarTudo(); } return; }
    const cam = t.closest('[data-cam]');
    const vis = t.closest('[data-vis]'); if (vis) { const e = this.porId(vis.dataset.vis); e.visivel = e.visivel === false; this.atualizarTudo(); return; }
    const lock = t.closest('[data-lock]'); if (lock) { const e = this.porId(lock.dataset.lock); e.bloqueado = !e.bloqueado; this.atualizarTudo(); return; }
    if (cam) { this.sel = new Set([cam.dataset.cam]); this.atualizarTudo(); return; }
    const verso = t.closest('[data-verso]'); if (verso) { this.verso = verso.dataset.verso === '1'; this.atualizarTudo(); return; }
    if (t.closest('[data-radd]')) {
      const m = (this.doc.mestras || [])[0];
      this.doc.atribuicoes_mestra.push({ mestraId: this.r.id || m?.id, de: 1, ate: null });
      this.painel(); return;
    }
    const del = t.closest('[data-rdel]'); if (del) { this.doc.atribuicoes_mestra.splice(Number(del.dataset.rdel), 1); this.painel(); }
  }

  // ───────────── ações da barra ─────────────
  acao(a) {
    const sels = this.selecionados();
    if (a === 'fechar') { this.doc.atribuicoes_mestra = normalizarRegrasMestra(this.doc.atribuicoes_mestra); this.fechar(); return; }
    if (a.startsWith('add-')) { this.adicionar(a.slice(4)); return; }
    if (a.startsWith('al-')) { alinharElementos(sels, a.slice(3), sels.length === 1 ? this.areaAlinhamento() : null); this.atualizarTudo(); return; }
    if (a === 'dist-h') { distribuirElementos(sels, 'h'); this.atualizarTudo(); return; }
    if (a === 'dist-v') { distribuirElementos(sels, 'v'); this.atualizarTudo(); return; }
    if (a.startsWith('z-')) { sels.forEach(e => mudarOrdemZ(this.elementos(), e.id, a.slice(2))); this.atualizarTudo(); return; }
    if (a === 'bloquear') { const novo = !(sels[0] && sels[0].bloqueado); sels.forEach(e => { e.bloqueado = novo; }); this.atualizarTudo(); return; }
    if (a === 'duplicar') { this.duplicar(); return; }
    if (a === 'excluir') { this.excluir(); return; }
    if (a === 'grade') {
      const g = this.r.grade_guia = normalizarGradeGuia({ ...(this.r.grade_guia || {}), visivel: !this.r.grade_guia?.visivel });
      if (g.visivel && !g.passo_mm && !g.colunas && !g.linhas) g.passo_mm = 10;
      this.atualizarTudo(); return;
    }
    if (a === 'snap') { this.snap = !this.snap; this.atualizarBarra(); return; }
    if (a === 'zoom-mais') this.ajustarZoom(this.zoom * 1.2);
    if (a === 'zoom-menos') this.ajustarZoom(this.zoom / 1.2);
    if (a === 'zoom-ajustar') this.ajustarZoom(Math.max(0.3, (this.cena.clientHeight - 80) / (this.H * 2.4)));
  }

  areaAlinhamento() { return { x: 0, y: 0, w: this.W, h: this.H }; }

  ajustarZoom(z) { this.zoom = Math.min(4, Math.max(0.25, z)); this.desenhar(); this.atualizarBarra(); }

  adicionar(tipo) {
    const c = { x_mm: this.W / 2 - 30, y_mm: this.H / 2 - 15 };
    let e;
    if (tipo === 'forma') e = criarElementoLivre('forma', { ...c, largura_mm: 60, altura_mm: 30 });
    else if (tipo === 'elipse') e = criarElementoLivre('forma', { ...c, forma: 'elipse', largura_mm: 40, altura_mm: 40, titulo: 'Elipse' });
    else if (tipo === 'linha') e = criarElementoLivre('forma', { ...c, forma: 'linha', largura_mm: 80, altura_mm: 2, titulo: 'Filete', borda_mm: 0.5 });
    else if (tipo === 'texto') e = criarElementoLivre('texto', { ...c, largura_mm: 70, altura_mm: 12 });
    else if (tipo === 'quadro') {
      const m = this.margens();
      e = criarElementoLivre('quadro_texto', { x_mm: m.l, y_mm: m.t, largura_mm: this.W - m.l - m.r, altura_mm: this.H - m.t - m.b });
      this.r.quadro_texto_id = e.id;
    }
    if (!e) return;
    this.elementos().push(e); mudarOrdemZ(this.elementos(), e.id, 'frente');
    this.sel = new Set([e.id]); this.atualizarTudo();
  }

  duplicar() {
    const novos = this.selecionados().map(e => {
      const c = JSON.parse(JSON.stringify(e));
      c.id = 'elem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      c.x_mm += 5; c.y_mm += 5; c.bloqueado = false;
      return c;
    });
    novos.forEach(c => this.elementos().push(c));
    this.sel = new Set(novos.map(c => c.id)); this.atualizarTudo();
  }

  excluir() {
    const ids = new Set(this.selecionados().filter(e => !e.bloqueado).map(e => e.id));
    if (!ids.size) return;
    this.r.elementos_recorrentes = this.elementos().filter(e => !ids.has(e.id));
    if (ids.has(this.r.quadro_texto_id)) delete this.r.quadro_texto_id;
    this.sel = new Set(); this.atualizarTudo();
  }
}

export function abrirCanvasMestra(doc, rascunho, opcoes) {
  return new CanvasMestra(doc, rascunho, opcoes);
}
