// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Ligação dos atalhos ao editor: handlers de cada ação do catálogo, busca/substituição
 * in-canvas, ir para página, comando "/", popover de link e modal de ajuda pesquisável.
 */

import { GerenciadorAtalhos } from './athenes_atalhos_engine.js';
import {
  filtrarCatalogo, CATEGORIAS, localizarOcorrencias, ehAtalhoDeFormatacaoDireta, acaoPorId, atalhosDaAcao, formatarAtalho
} from '../core/athenes_atalhos.js';
import { criarNovoBloco, dividirBlocoTexto, duplicarBlocoNaSecao, removerBlocoDaSecao, moverBlocoPorLinha, buscarSecaoDoBloco } from '../core/athenes_documento.js';
import { modoSomenteLeitura } from '../core/athenes_colaboracao.js';
import { PainelFlutuanteIa, GhostTextEngine } from './athenes_assistente_ia_ui.js';

const MAPA_TOOLTIPS = [
  ['#rmDesfazer', 'desfazer'], ['#rmRefazer', 'refazer'], ['#rmSalvar', 'salvar'], ['#rmAddNota', 'nota_rodape'],
  ['#rmAddQuebra', 'quebra_pagina'], ['#athBtnExportarModal', 'exportar']
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
.ath-at-pop{position:fixed;z-index:100001;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.22);font:600 12px var(--glx-font,system-ui);color:#1F2733}
.ath-at-pop input[type=text],.ath-at-pop input[type=number]{height:30px;padding:0 9px;border:1px solid #D5DEE9;border-radius:8px;font:600 12.5px var(--glx-font,inherit);min-width:0}
.ath-at-pop button{height:28px;padding:0 10px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;color:#314F79;font:700 11.5px var(--glx-font,inherit);cursor:pointer}
.ath-at-pop button:hover:not(:disabled){background:#EEF4FA;border-color:#314F79}.ath-at-pop button:disabled{opacity:.45;cursor:default}
.ath-at-pop button.pri{background:#314F79;color:#fff;border-color:#314F79}
.ath-at-busca{top:12px;right:24px;display:flex;align-items:center;gap:6px;padding:8px 10px}
.ath-at-busca .n{min-width:64px;text-align:center;color:#64748B}
.ath-at-fundo{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding-top:8vh}
.ath-at-modal{width:min(640px,94vw);max-height:80vh;display:flex;flex-direction:column;position:relative;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.35);overflow:hidden;font:600 12.5px var(--glx-font,system-ui);color:#1F2733}
.ath-at-modal header{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #E3EAF2}
.ath-at-modal header h3{margin:0;font:800 15px var(--glx-font,inherit);flex:1}
.ath-at-modal .corpo{overflow:auto;padding:6px 18px 16px}
.ath-at-modal h4{margin:14px 0 6px;font:800 10.5px var(--glx-font,inherit);letter-spacing:.06em;text-transform:uppercase;color:#314F79}
.ath-at-lin{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #F1F5F9}
.ath-at-lin kbd{font:700 11px ui-monospace,Consolas,monospace;background:#F1F5F9;border:1px solid #D5DEE9;border-bottom-width:2px;border-radius:6px;padding:2px 7px;white-space:nowrap}
.ath-at-cmd{width:260px;padding:6px}.ath-at-cmd button{display:block;width:100%;text-align:left;border:0;height:30px;border-radius:7px}
.ath-at-cmd button.sel{background:#EAF1FA}
.ath-at-contexto{position:fixed;z-index:100003;min-width:230px;max-width:min(300px,90vw);padding:5px;background:#fff;border:1px solid #C8D7E6;border-radius:11px;box-shadow:0 12px 32px rgba(15,23,42,.22);font:500 12.5px var(--glx-font,system-ui);color:#1F2733}
.ath-at-contexto button{width:100%;height:32px;display:flex;align-items:center;gap:8px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ath-at-contexto button:hover{background:#EEF4FA}.ath-at-contexto button:disabled{opacity:.42;cursor:default}
.ath-at-contexto button span{margin-left:auto;color:#64748B;font-size:11px}
.ath-at-contexto hr{border:0;border-top:1px solid #E3EAF2;margin:4px 2px}
::highlight(ath-busca){background:#FFE08A}::highlight(ath-busca-atual){background:#FF9F43;color:#000}
`;

export class AtalhosDoEditor {
  constructor(editor) {
    this.ed = editor;
    this.gerenciador = new GerenciadorAtalhos({ raiz: editor.container });
    this.mac = this.gerenciador.mac;
    this.busca = { termo: '', subst: '', maiusculas: false, palavra: false, ranges: [], atual: -1 };
    this.colarPuro = false;
    this.pops = new Set();
    this.injetarCss();
    this.registrar();
    this.ligarColagem();
    this.ligarMenuContexto();
    this.ghostEngine = new GhostTextEngine(this.ed);
    this.aoInput = (e) => { if (e.target?.isContentEditable && this.ed.container.contains(e.target)) this.ed._edicaoNativa = true; };
    document.addEventListener('input', this.aoInput, true);
    this.gerenciador.anexar();
    this.gerenciador.observarTooltips(MAPA_TOOLTIPS);
  }

  destruir() {
    this.fecharTudo();
    this.ghostEngine?.destruir?.();
    this.gerenciador.destruir();
    this.removerColagem?.();
    this.removerMenuContexto?.();
    document.removeEventListener('input', this.aoInput, true);
    document.removeEventListener('keydown', this.aoEsc, true);
    this.limparDestaques();
  }

  injetarCss() {
    if (document.getElementById('ath-atalhos-css')) return;
    const st = document.createElement('style'); st.id = 'ath-atalhos-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  // ───────────── utilitários ─────────────
  get palco() { return this.ed.container.querySelector('#rmPrevPalco') || this.ed.container; }
  somenteLeitura() { return modoSomenteLeitura(this.ed.modoTrabalho); }

  blocoAtual() {
    const el = document.activeElement?.closest?.('[data-bloco-id]') || document.getSelection()?.anchorNode?.parentElement?.closest?.('[data-bloco-id]');
    const id = el?.dataset.blocoId;
    return (id && this.ed.buscarBlocoPorId(id)) || this.ed.blocoSelecionado || null;
  }

  editavelAtual() {
    const a = document.activeElement;
    return a && a.isContentEditable && this.ed.container.contains(a) ? a : null;
  }

  /** Re-renderiza e devolve o foco ao bloco (fim do texto), usado após mudar propriedades do bloco. */
  aplicarNoBloco(fn) {
    const b = this.blocoAtual();
    if (!b || this.somenteLeitura()) return false;
    const idx = this.indiceDoCaret();
    fn(b);
    this.ed.blocoSelecionado = b;
    this.ed.notificarMudanca();
    this.ed.renderizar();
    this.ed.onSelecionarBloco?.(b, null);
    requestAnimationFrame(() => this.focarBloco(b.id, idx));
    return true;
  }

  indiceDoCaret() {
    const ed = this.editavelAtual(); const s = getSelection();
    if (!ed || !s?.rangeCount) return null;
    const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(ed); r.setEnd(s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset);
    return r.toString().length;
  }

  focarBloco(id, idx = null) {
    const el = this.ed.container.querySelector(`.ath-bloco-folha[data-bloco-id="${id}"] [contenteditable="true"], .ath-bloco-folha[data-bloco-id="${id}"][contenteditable="true"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let resta = idx ?? Infinity; let n; let ultimo = null;
    while ((n = w.nextNode())) { ultimo = n; if (resta <= n.length) { this.posicionar(n, resta); return; } resta -= n.length; }
    if (ultimo) this.posicionar(ultimo, ultimo.length);
  }

  posicionar(no, off) { const r = document.createRange(); r.setStart(no, off); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  // ───────────── registro das ações ─────────────
  registrar() {
    const g = this.gerenciador; const ed = this.ed;
    g.registrar('desfazer', () => this.historico('desfazer'));
    g.registrar('refazer', () => this.historico('refazer'));
    g.registrar('selecionar_tudo', (e, ctx) => this.selecionarTudo(ctx));
    g.registrar('colar_puro', () => { this.colarPuro = true; setTimeout(() => { this.colarPuro = false; }, 1000); return false; });
    g.registrar('limpar_formatacao', () => { if (this.somenteLeitura()) return false; document.execCommand('removeFormat'); document.execCommand('unlink'); this.sinalizarEdicao(); });
    g.registrar('link', () => this.abrirLink());
    g.registrar('recuo_aumentar', () => this.recuo(+1));
    g.registrar('recuo_diminuir', () => this.recuo(-1));
    g.registrar('localizar', () => { this.abrirBusca(false); });
    g.registrar('substituir', () => { this.abrirBusca(true); });
    g.registrar('proxima_ocorrencia', () => { this.navegarBusca(+1); });
    g.registrar('ocorrencia_anterior', () => { this.navegarBusca(-1); });
    g.registrar('ir_para', () => { this.abrirIrPara(); });
    g.registrar('quebra_pagina', () => this.quebraPagina());
    g.registrar('bloco_duplicar', () => this.duplicarBlocoSelecionado());
    g.registrar('bloco_excluir', () => this.excluirBlocoSelecionado());
    g.registrar('bloco_subir', () => this.moverBlocoSelecionado(-1));
    g.registrar('bloco_descer', () => this.moverBlocoSelecionado(1));
    g.registrar('nota_rodape', () => { if (this.somenteLeitura()) return false; ed.inserirNotaRodapeNoCursor(); });
    const nivel = (n) => () => this.converterBloco('titulo', n);
    g.registrar('titulo1', nivel(1)); g.registrar('titulo2', nivel(2)); g.registrar('titulo3', nivel(3));
    g.registrar('texto_normal', () => this.converterBloco('paragrafo', 0));
    g.registrar('comandos', (e) => this.comandoBarra(e));
    g.registrar('salvar', () => { ed.container.querySelector('#rmSalvar')?.click(); });
    g.registrar('exportar', () => { ed.onAbrirExportar?.(); });
    g.registrar('guia_atalhos', () => { this.abrirAjuda(); });
    g.registrar('assistente_ia', () => { this.abrirAssistenteIa(); });
    // Esc: fecha busca/diálogos próprios
    this.aoEsc = (e) => { if (e.key === 'Escape' && this.pops.size) { this.fecharTudo(); } };
    document.addEventListener('keydown', this.aoEsc, true);
  }

  /** Marca que há edição nativa pendente (usado para decidir entre desfazer nativo e do documento). */
  sinalizarEdicao() { this.ed._edicaoNativa = true; this.editavelAtual()?.dispatchEvent(new Event('input', { bubbles: true })); }

  // ───────────── histórico / seleção ─────────────
  historico(qual) {
    if (this.somenteLeitura()) return false;
    const ctx = this.gerenciador.contexto();
    // dentro de um bloco com edição ainda não consolidada, o desfazer nativo é o mais preciso
    if (ctx.editavel && this.ed._edicaoNativa) return false;
    this.ed[qual]();
  }

  selecionarTudo(ctx) {
    const ed = this.editavelAtual();
    const sel = getSelection();
    const palco = this.palco;
    if (ed && sel?.rangeCount) {
      const todo = sel.toString().length >= (ed.innerText || '').replace(/\n$/, '').length && sel.toString().length > 0;
      if (!todo) { const r = document.createRange(); r.selectNodeContents(ed); sel.removeAllRanges(); sel.addRange(r); return; }
    }
    const r = document.createRange(); r.selectNodeContents(palco); sel.removeAllRanges(); sel.addRange(r);
  }

  // ───────────── colagem ─────────────
  ligarColagem() {
    const h = (e) => {
      const alvo = e.target;
      if (!(alvo instanceof Element) || !alvo.isContentEditable || !this.ed.container.contains(alvo)) return;
      if (this.somenteLeitura()) return;
      e.preventDefault();
      // só `text/plain`: nada de HTML/RTF externo, o bloco mantém o Estilo de Texto dele
      document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || '');
      this.colarPuro = false;
    };
    // formatação direta (Ctrl/Cmd+B, I, U e Ctrl/Cmd+Shift+L/E/R/J) não existe: o navegador não pode aplicá-la
    const bloqueio = (e) => {
      const alvo = e.target;
      if (!(alvo instanceof Element) || !alvo.isContentEditable || !this.ed.container.contains(alvo)) return;
      if (ehAtalhoDeFormatacaoDireta(e)) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('paste', h, true);
    document.addEventListener('keydown', bloqueio, true);
    this.removerColagem = () => { document.removeEventListener('paste', h, true); document.removeEventListener('keydown', bloqueio, true); };
  }

  ligarMenuContexto() {
    const fechar = () => { this.menuContexto?.remove(); this.menuContexto = null; };
    const aoContexto = (e) => {
      const alvo = e.target instanceof Element ? e.target : e.target?.parentElement;
      const editavel = alvo?.closest?.('[contenteditable="true"]');
      if (!editavel || !this.ed.container.contains(editavel)) return;
      // O menu nativo mostra as sugestões de ortografia; Alt abre as ações do Athenes.
      if (!e.altKey && e.button !== -1) { fechar(); return; }
      e.preventDefault();
      fechar();
      const selecao = getSelection();
      const range = selecao?.rangeCount && editavel.contains(selecao.anchorNode) ? selecao.getRangeAt(0).cloneRange() : null;
      const temTrecho = Boolean(range && !range.collapsed);
      const leitura = this.somenteLeitura();
      const menu = document.createElement('div');
      menu.className = 'ath-at-contexto'; menu.setAttribute('role', 'menu');
      menu.innerHTML = `
        <button type="button" role="menuitem" data-cm="recortar" ${!temTrecho || leitura ? 'disabled' : ''}>Recortar <span>Ctrl+X</span></button>
        <button type="button" role="menuitem" data-cm="copiar" ${!temTrecho ? 'disabled' : ''}>Copiar <span>Ctrl+C</span></button>
        <button type="button" role="menuitem" data-cm="colar" ${leitura ? 'disabled' : ''}>Colar texto <span>Ctrl+V</span></button>
        <hr>
        <button type="button" role="menuitem" data-cm="link" ${leitura ? 'disabled' : ''}>Inserir link <span>Ctrl+K</span></button>
        <button type="button" role="menuitem" data-cm="limpar" ${!temTrecho || leitura ? 'disabled' : ''}>Limpar formatação</button>
        <hr>
        <button type="button" role="menuitem" data-cm="zotero">Citar obra do Zotero</button>
        <button type="button" role="menuitem" data-cm="nota" ${leitura ? 'disabled' : ''}>Inserir nota de rodapé</button>
        <hr>
        <button type="button" role="menuitem" data-cm="duplicar" ${leitura ? 'disabled' : ''}>Duplicar bloco</button>
        <button type="button" role="menuitem" data-cm="excluir" ${leitura ? 'disabled' : ''}>Excluir bloco <span>Ctrl+Shift+X</span></button>
        <button type="button" role="menuitem" data-cm="atalhos">Ver atalhos de teclado</button>`;
      document.body.appendChild(menu);
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(e.clientX, innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(e.clientY, innerHeight - rect.height - 8))}px`;
      menu.addEventListener('mousedown', ev => ev.preventDefault());
      menu.addEventListener('click', async ev => {
        const acao = ev.target.closest('[data-cm]')?.dataset.cm;
        if (!acao) return;
        fechar();
        editavel.focus({ preventScroll: true });
        if (range && ['recortar', 'copiar', 'colar', 'link', 'limpar', 'nota'].includes(acao)) { selecao.removeAllRanges(); selecao.addRange(range); }
        if (acao === 'recortar' || acao === 'copiar') { document.execCommand(acao === 'recortar' ? 'cut' : 'copy'); if (acao === 'recortar') this.sinalizarEdicao(); }
        else if (acao === 'colar') { try { const texto = await navigator.clipboard.readText(); document.execCommand('insertText', false, texto); this.sinalizarEdicao(); } catch (_) { this.ed.toast?.('Use Ctrl+V para colar neste navegador.'); } }
        else if (acao === 'link') this.abrirLink();
        else if (acao === 'limpar') { document.execCommand('removeFormat'); document.execCommand('unlink'); this.sinalizarEdicao(); }
        else if (acao === 'zotero') this.ed.abrirPainelZotero();
        else if (acao === 'nota') this.ed.inserirNotaRodapeNoCursor();
        else if (acao === 'duplicar') this.duplicarBlocoSelecionado();
        else if (acao === 'excluir') this.excluirBlocoSelecionado();
        else if (acao === 'atalhos') this.abrirAjuda();
      });
      this.menuContexto = menu;
    };
    const aoClique = e => { if (!this.menuContexto?.contains(e.target)) fechar(); };
    const aoTeclar = e => {
      if (e.key === 'Escape') fechar();
      if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
        const editavel = document.activeElement?.closest?.('[contenteditable="true"]');
        if (!editavel || !this.ed.container.contains(editavel)) return;
        e.preventDefault();
        const rect = getSelection()?.rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : editavel.getBoundingClientRect();
        aoContexto({ target: editavel, altKey: true, button: -1, clientX: rect.left, clientY: rect.bottom, preventDefault() {} });
      }
    };
    this.ed.container.addEventListener('contextmenu', aoContexto);
    document.addEventListener('pointerdown', aoClique);
    document.addEventListener('keydown', aoTeclar);
    this.removerMenuContexto = () => { fechar(); this.ed.container.removeEventListener('contextmenu', aoContexto); document.removeEventListener('pointerdown', aoClique); document.removeEventListener('keydown', aoTeclar); };
  }

  // ───────────── recuo ─────────────
  recuo(sentido) {
    if (this.somenteLeitura()) return false;
    const ed = this.editavelAtual(); const sel = getSelection();
    const no = sel?.anchorNode; const el = no?.nodeType === 3 ? no.parentElement : no;
    if (el?.closest('li')) { document.execCommand(sentido > 0 ? 'indent' : 'outdent'); this.sinalizarEdicao(); return; }
    const b = this.blocoAtual();
    if (!b || !ed) return false;
    const r = sel.getRangeAt(0).cloneRange(); r.selectNodeContents(ed); r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    const noInicio = r.toString().length === 0;
    if (!noInicio && sentido > 0) { document.execCommand('insertText', false, '    '); this.sinalizarEdicao(); return; }
    if (!noInicio) return; // Shift+Tab no meio do texto: não faz nada (e não tira o foco)
    // o recuo do parágrafo é propriedade do estilo: nada é gravado no bloco
    return false;
  }

  // ───────────── conversão de bloco / quebra de página ─────────────
  converterBloco(tipo, nivel) {
    const b = this.blocoAtual();
    if (!b || !['paragrafo', 'titulo', 'subtitulo'].includes(b.tipo)) return false;
    return this.aplicarNoBloco(x => {
      x.tipo = tipo;
      if (tipo === 'titulo') { x.nivel = nivel; x.estiloId = 'titulo' + nivel; x.manterComProximo = true; }
      else { delete x.nivel; x.estiloId = 'corpo'; x.manterComProximo = false; }
    }) ? undefined : false;
  }

  /** Duplicar / excluir / mover o bloco em que está o cursor (ou o selecionado): os mesmos efeitos dos botões da barra rápida. */
  duplicarBlocoSelecionado() {
    if (this.somenteLeitura()) return false;
    const b = this.blocoAtual(); if (!b) return false;
    const copia = duplicarBlocoNaSecao(this.ed.doc, b.id);
    if (!copia) return false;
    this.ed.aposEstrutura(copia);
  }

  excluirBlocoSelecionado() {
    if (this.somenteLeitura()) return false;
    const b = this.blocoAtual(); if (!b) return false;
    const sec = buscarSecaoDoBloco(this.ed.doc, b.id); if (!sec) return false;
    const idx = (sec.blocos || []).findIndex(x => x.id === b.id);
    removerBlocoDaSecao(this.ed.doc, sec.id, b.id);
    const resto = sec.blocos || [];
    this.ed.aposEstrutura(resto[Math.min(Math.max(0, idx), resto.length - 1)] || null); // seleciona o vizinho, para poder seguir editando
  }

  moverBlocoSelecionado(delta) {
    if (this.somenteLeitura()) return false;
    const b = this.blocoAtual(); if (!b) return false;
    if (!moverBlocoPorLinha(this.ed.doc, b.id, delta)) return false;
    this.ed.aposEstrutura(b);
  }

  quebraPagina() {
    if (this.somenteLeitura()) return false;
    const ed = this.ed; const b = this.blocoAtual();
    const sec = (ed.doc.secoes || []).find(s => (s.blocos || []).some(x => x.id === b?.id)) || ed.obterSecaoAtiva();
    if (!sec) return false;
    const quebra = criarNovoBloco('quebra_pagina', {});
    const el = this.editavelAtual(); const sel = getSelection();
    let novoAposId = null;
    if (b && el && sel?.rangeCount && ['paragrafo'].includes(b.tipo)) {
      const range = sel.getRangeAt(0);
      const antes = range.cloneRange(); antes.selectNodeContents(el); antes.setEnd(range.startContainer, range.startOffset);
      const depois = range.cloneRange(); depois.selectNodeContents(el); depois.setStart(range.endContainer, range.endOffset);
      const dA = document.createElement('div'); dA.appendChild(antes.cloneContents());
      const dD = document.createElement('div'); dD.appendChild(depois.cloneContents());
      const res = dividirBlocoTexto(ed.doc, b.id, { textoAntes: dA.innerHTML, textoDepois: dD.innerHTML });
      novoAposId = res?.novoBloco?.id || null;
    }
    const lista = sec.blocos;
    let pos;
    if (novoAposId) pos = lista.findIndex(x => x.id === novoAposId);
    else pos = b ? lista.findIndex(x => x.id === b.id) + 1 : lista.length;
    lista.splice(Math.max(0, pos), 0, quebra);
    ed.blocoSelecionado = novoAposId ? ed.buscarBlocoPorId(novoAposId) : quebra;
    ed.notificarMudanca(); // empurra estado válido na pilha do Ctrl+Z
    ed.renderizar();
    ed.onSelecionarBloco?.(ed.blocoSelecionado, null);
  }

  // ───────────── link ─────────────
  abrirLink() {
    if (this.somenteLeitura()) return false;
    const sel = getSelection(); if (!sel?.rangeCount) return false;
    const range = sel.getRangeAt(0).cloneRange();
    const no = range.commonAncestorContainer; const a0 = (no.nodeType === 3 ? no.parentElement : no)?.closest('a');
    const rect = range.getBoundingClientRect();
    const pop = this.criarPop('ath-at-pop', `<div style="display:flex;gap:6px;padding:8px"><input type="text" placeholder="https://… (vazio remove o link)" style="width:260px" value="${esc(a0?.getAttribute('href') || '')}"><button class="pri" data-ok>Aplicar</button></div>`);
    pop.style.left = `${Math.max(8, Math.min(innerWidth - 400, rect.left))}px`; pop.style.top = `${Math.min(innerHeight - 60, rect.bottom + 8)}px`;
    const inp = pop.querySelector('input'); inp.focus(); inp.select();
    const aplicar = () => {
      let url = inp.value.trim();
      this.fecharPop(pop);
      const ed = this.editavelAtual() || range.commonAncestorContainer.parentElement?.closest('[contenteditable]');
      ed?.focus(); sel.removeAllRanges(); sel.addRange(range);
      if (!url) document.execCommand('unlink');
      else {
        if (!/^(https?:|mailto:|#)/i.test(url)) url = 'https://' + url;
        if (range.collapsed) document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url)}</a>`);
        else document.execCommand('createLink', false, url);
      }
      this.sinalizarEdicao();
    };
    pop.querySelector('[data-ok]').addEventListener('click', aplicar);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } e.stopPropagation(); });
  }

  // ───────────── comando "/" ─────────────
  comandoBarra(e) {
    if (this.somenteLeitura()) return false;
    const el = this.editavelAtual(); const b = this.blocoAtual();
    if (!el || !b || !['paragrafo', 'titulo'].includes(b.tipo)) return false;
    if ((el.textContent || '').replace(/​/g, '').trim() !== '') return false; // só no início de linha vazia
    const itens = [
      ['✨ Assistente de IA (/ia)', () => this.abrirAssistenteIa()],
      ['Título 1', () => this.converterBloco('titulo', 1)], ['Título 2', () => this.converterBloco('titulo', 2)], ['Título 3', () => this.converterBloco('titulo', 3)],
      ['Texto normal', () => this.converterBloco('paragrafo', 0)],
      ['Tabela', () => this.inserirAposVazio('tabela', { titulo: 'Tabela — Dados quantitativos' })], ['Fórmula', () => this.inserirAposVazio('formula', { latex: 'E = m \\cdot c^2' })],
      ['Citação', () => this.inserirAposVazio('citacao', {})], ['Sumário', () => this.inserirAposVazio('sumario', {})], ['Divisor', () => this.inserirAposVazio('divisor', {})], ['Quebra de página', () => this.inserirAposVazio('quebra_pagina', {})]
    ];
    const r = el.getBoundingClientRect();
    const pop = this.criarPop('ath-at-pop ath-at-cmd', itens.map(([t], i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'sel' : ''}">${esc(t)}</button>`).join(''));
    pop.style.left = `${Math.max(8, r.left)}px`; pop.style.top = `${Math.min(innerHeight - 330, r.bottom + 4)}px`;
    let atual = 0;
    const mover = (d) => { pop.querySelectorAll('button')[atual].classList.remove('sel'); atual = (atual + d + itens.length) % itens.length; pop.querySelectorAll('button')[atual].classList.add('sel'); };
    const escolher = (i) => { cleanup(); this.fecharPop(pop); itens[i][1](); };
    const teclas = (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); mover(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); ev.stopPropagation(); mover(-1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); escolher(atual); }
      else if (ev.key === 'Escape' || ev.key === 'Backspace') { cleanup(); this.fecharPop(pop); }
    };
    const cleanup = () => document.removeEventListener('keydown', teclas, true);
    document.addEventListener('keydown', teclas, true);
    pop.addEventListener('mousedown', (ev) => ev.preventDefault());
    pop.addEventListener('click', (ev) => { const i = ev.target.closest('[data-i]')?.dataset.i; if (i !== undefined) escolher(Number(i)); });
    pop._limpar = cleanup;
    // o "/" não deve ser digitado no bloco
  }

  inserirAposVazio(tipo, dados) {
    const ed = this.ed; const b = this.blocoAtual(); if (!b) return;
    const sec = (ed.doc.secoes || []).find(s => (s.blocos || []).some(x => x.id === b.id)); if (!sec) return;
    const i = sec.blocos.findIndex(x => x.id === b.id);
    const novo = criarNovoBloco(tipo, dados);
    sec.blocos.splice(i + 1, 0, novo);
    sec.blocos.splice(i, 1); // o parágrafo vazio dá lugar ao novo bloco
    ed.blocoSelecionado = novo; ed.notificarMudanca(); ed.renderizar(); ed.onSelecionarBloco?.(novo, null);
  }

  // ───────────── assistente de IA ─────────────
  abrirAssistenteIa(ancora = null, trecho = '') {
    if (this.somenteLeitura()) return null;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    const textoSel = trecho || (sel && !sel.isCollapsed ? sel.toString() : '');
    const anc = ancora || this.editavelAtual() || this.palco;
    return new PainelFlutuanteIa(this.ed, { ancora: anc, trechoInicial: textoSel });
  }

  // ───────────── busca e substituição ─────────────
  textoDosBlocos() {
    // por bloco: concatena os nós de texto; as ocorrências podem atravessar marcações inline
    const out = [];
    this.palco.querySelectorAll('.ath-bloco-folha').forEach(bl => {
      const nos = []; const w = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('[contenteditable="false"], .ath-num-prefixo-fixo, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      let n; let tx = '';
      while ((n = w.nextNode())) { nos.push({ n, ini: tx.length }); tx += n.data; }
      if (tx) out.push({ bl, nos, tx });
    });
    return out;
  }

  rangeDe(item, a, b) {
    const achar = (pos, fim) => { for (let i = item.nos.length - 1; i >= 0; i--) { const x = item.nos[i]; if (pos > x.ini || (pos === x.ini && !fim)) return { n: x.n, o: pos - x.ini }; } return { n: item.nos[0].n, o: 0 }; };
    const r = document.createRange(); const s = achar(a, false); const e = achar(b, true);
    r.setStart(s.n, s.o); r.setEnd(e.n, Math.min(e.o, e.n.length)); return r;
  }

  recalcularBusca(manterIndice = false) {
    const B = this.busca; const ant = B.atual;
    B.ranges = [];
    if (B.termo) {
      for (const item of this.textoDosBlocos()) {
        for (const [a, b] of localizarOcorrencias(item.tx, B.termo, { maiusculas: B.maiusculas, palavraInteira: B.palavra })) B.ranges.push({ item, r: this.rangeDe(item, a, b), a, b });
      }
    }
    B.atual = B.ranges.length ? (manterIndice ? Math.min(ant, B.ranges.length - 1) : 0) : -1;
    this.pintarBusca();
  }

  pintarBusca() {
    const B = this.busca;
    if (typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined') {
      CSS.highlights.set('ath-busca', new Highlight(...B.ranges.map(x => x.r)));
      if (B.atual >= 0) CSS.highlights.set('ath-busca-atual', new Highlight(B.ranges[B.atual].r)); else CSS.highlights.delete('ath-busca-atual');
    }
    const n = this.pop?.querySelector('.n');
    if (n) n.textContent = B.ranges.length ? `${B.atual + 1} de ${B.ranges.length}` : (B.termo ? 'Nenhum' : '');
    if (B.atual >= 0) this.ed.rolarNoPalco(B.ranges[B.atual].r.startContainer.parentElement, 'center');
  }

  limparDestaques() { if (typeof CSS !== 'undefined' && CSS.highlights) { CSS.highlights.delete('ath-busca'); CSS.highlights.delete('ath-busca-atual'); } }

  navegarBusca(d) {
    const B = this.busca;
    if (!B.ranges.length) { if (B.termo) this.recalcularBusca(); else { this.abrirBusca(false); return; } }
    if (!B.ranges.length) return;
    B.atual = (B.atual + d + B.ranges.length) % B.ranges.length;
    this.pintarBusca();
  }

  abrirBusca(comSubstituir) {
    this.fecharPopBusca();
    const B = this.busca;
    const selTxt = (getSelection()?.toString() || '').trim();
    if (selTxt && selTxt.length < 80 && !selTxt.includes('\n')) B.termo = selTxt;
    const pop = this.criarPop('ath-at-pop ath-at-busca', `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <input type="text" data-q placeholder="Buscar" style="width:200px" value="${esc(B.termo)}">
          <span class="n"></span>
          <button data-ant title="Ocorrência anterior (Shift+Enter)">‹</button><button data-prox title="Próxima ocorrência (Enter / F3)">›</button>
          <label style="display:flex;gap:3px;align-items:center;font-size:11px"><input type="checkbox" data-mai ${B.maiusculas ? 'checked' : ''}> Aa</label>
          <label style="display:flex;gap:3px;align-items:center;font-size:11px"><input type="checkbox" data-pal ${B.palavra ? 'checked' : ''}> Palavra</label>
          <button data-fechar title="Fechar (Esc)">×</button>
        </div>
        <div data-linha-sub style="display:${comSubstituir ? 'flex' : 'none'};align-items:center;gap:6px">
          <input type="text" data-sub placeholder="Substituir por" style="width:200px" value="${esc(B.subst)}">
          <button data-subst>Substituir</button><button data-subst-todas class="pri">Substituir todas</button>
        </div>
      </div>`);
    pop.classList.add('ath-at-busca');
    this.pop = pop; this.popBusca = pop;
    const q = pop.querySelector('[data-q]'); const sub = pop.querySelector('[data-sub]');
    const refazer = () => { B.termo = q.value; B.subst = sub.value; B.maiusculas = pop.querySelector('[data-mai]').checked; B.palavra = pop.querySelector('[data-pal]').checked; this.recalcularBusca(); };
    q.addEventListener('input', refazer); sub.addEventListener('input', () => { B.subst = sub.value; });
    pop.querySelector('[data-mai]').addEventListener('change', refazer); pop.querySelector('[data-pal]').addEventListener('change', refazer);
    pop.querySelector('[data-prox]').addEventListener('click', () => this.navegarBusca(+1));
    pop.querySelector('[data-ant]').addEventListener('click', () => this.navegarBusca(-1));
    pop.querySelector('[data-fechar]').addEventListener('click', () => this.fecharPopBusca());
    pop.querySelector('[data-subst]').addEventListener('click', () => this.substituir(false));
    pop.querySelector('[data-subst-todas]').addEventListener('click', () => this.substituir(true));
    pop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); if (e.target === sub) this.substituir(false); else this.navegarBusca(e.shiftKey ? -1 : +1); }
      else if (e.key === 'Escape') this.fecharPopBusca();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); pop.querySelector('[data-linha-sub]').style.display = 'flex'; sub.focus(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); q.focus(); q.select(); }
    });
    if (comSubstituir) pop.querySelector('[data-linha-sub]').style.display = 'flex';
    (comSubstituir && B.termo ? sub : q).focus(); q.select();
    this.recalcularBusca();
  }

  fecharPopBusca() { if (this.popBusca) { this.fecharPop(this.popBusca); this.popBusca = null; this.pop = null; } this.limparDestaques(); }

  substituir(todas) {
    const B = this.busca; if (this.somenteLeitura() || !B.termo) return;
    this.recalcularBusca(true);
    if (!B.ranges.length) return;
    const alvos = todas ? [...B.ranges] : [B.ranges[Math.max(0, B.atual)]];
    const tocados = new Set();
    const ed0 = this.ed;
    ed0.salvarSnapshot(); // estado anterior garantido na pilha: o Ctrl+Z desfaz a substituição inteira de uma vez
    // de trás para frente, para não invalidar os offsets das ocorrências restantes
    for (const x of alvos.reverse()) {
      const ed = x.r.startContainer.parentElement?.closest('[contenteditable="true"]');
      if (!ed) continue; // texto não editável (rótulos, tabelas etc.) fica de fora
      x.r.deleteContents(); x.r.insertNode(document.createTextNode(B.subst));
      tocados.add(ed);
    }
    // alguns campos (título/fonte de tabelas e figuras) só gravam no modelo ao perder o foco
    // os handlers dos campos agendam/gravam snapshots intermediários; suspende-os para gravar um só ao final
    const orig = ed0.salvarSnapshot; ed0.salvarSnapshot = () => {};
    try { tocados.forEach(ed => { ed.dispatchEvent(new Event('input', { bubbles: true })); ed.dispatchEvent(new FocusEvent('blur')); }); }
    finally { ed0.salvarSnapshot = orig; clearTimeout(ed0._tSnap); }
    this.ed.notificarMudanca(); // uma única entrada na pilha do Ctrl+Z, qualquer que seja o número de trocas
    this.ed.renderizar();
    setTimeout(() => this.recalcularBusca(true), 60);
  }

  // ───────────── ir para página ─────────────
  abrirIrPara() {
    const total = this.palco.querySelectorAll('[data-pagina-id]').length;
    const fundo = this.criarPop('ath-at-fundo', `<div class="ath-at-modal" style="width:min(340px,92vw)"><header><h3>Ir para página</h3></header>
      <div class="corpo" style="display:flex;gap:8px;align-items:center;padding-top:14px"><input type="number" min="1" max="${total}" value="1" style="width:90px"><span style="color:#64748B">de ${total}</span><span style="flex:1"></span><button class="pri" data-ok>Ir</button></div></div>`, true);
    const inp = fundo.querySelector('input'); inp.focus(); inp.select();
    const ir = () => {
      const n = Math.max(1, Math.min(total, parseInt(inp.value, 10) || 1));
      this.fecharPop(fundo);
      const pg = this.palco.querySelectorAll('[data-pagina-id]')[n - 1];
      this.ed.rolarNoPalco(pg, 'start');
    };
    fundo.querySelector('[data-ok]').addEventListener('click', ir);
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ir(); } if (e.key === 'Escape') this.fecharPop(fundo); });
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) this.fecharPop(fundo); });
  }

  // ───────────── ajuda ─────────────
  abrirAjuda() {
    const fundo = this.criarPop('ath-at-fundo', `<div class="ath-at-modal"><header><h3>Atalhos de teclado</h3><input type="text" data-q placeholder="Buscar atalho ou ação…" style="width:220px"><button data-fechar title="Fechar (Esc)">×</button></header><div class="corpo" data-corpo></div></div>`, true);
    const corpo = fundo.querySelector('[data-corpo]'); const q = fundo.querySelector('[data-q]');
    const desenhar = () => {
      const g = filtrarCatalogo(q.value, this.mac, this.gerenciador.personalizados);
      const html = Object.keys(CATEGORIAS).filter(c => g[c]).map(c => `<h4>${esc(CATEGORIAS[c])}</h4>${g[c].map(a => `<div class="ath-at-lin"><span>${esc(a.rotulo)}</span><span>${a.texto.split(' / ').map(t => `<kbd>${esc(t)}</kbd>`).join(' ')}</span></div>`).join('')}`).join('');
      corpo.innerHTML = (html || '<p style="color:#64748B;padding:14px 0">Nenhum atalho encontrado.</p>') + (!q.value ? '<p style="color:#64748B;padding:10px 0">Ortografia: clique com o botão direito em uma palavra sublinhada para ver correções. Alt + clique direito ou Shift + F10 abre as ações do Athenes.</p>' : '');
    };
    desenhar(); q.focus();
    q.addEventListener('input', desenhar);
    q.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.fecharPop(fundo); });
    fundo.querySelector('[data-fechar]').addEventListener('click', () => this.fecharPop(fundo));
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) this.fecharPop(fundo); });
  }

  // ───────────── popovers ─────────────
  criarPop(classe, html, fundo = false) {
    const el = document.createElement('div');
    el.className = classe; el.innerHTML = html;
    document.body.appendChild(el);
    this.pops.add(el);
    return el;
  }
  fecharPop(el) { el?._limpar?.(); el?.remove(); this.pops.delete(el); if (el === this.popBusca) { this.popBusca = null; this.pop = null; this.limparDestaques(); } }
  fecharTudo() { [...this.pops].forEach(p => this.fecharPop(p)); this.limparDestaques(); }
}

/** Texto de dica de um atalho da ação, para componentes que montam seus próprios tooltips. */
export function dicaDeAtalho(idAcao, mac) {
  const a = acaoPorId(idAcao); if (!a) return '';
  return atalhosDaAcao(a, mac).map(s => formatarAtalho(s, mac)).join(' / ');
}
