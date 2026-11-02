// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gestão de arquivos na página inicial: seleção múltipla, menu "···"/botão direito,
 * "Mover para…", arrastar e soltar nas pastas, duplicação e barra de ações em lote. Toda ação
 * é otimista: a interface muda na hora e volta atrás (com aviso) se a gravação falhar.
 */

import {
  RAIZ_PADRAO, buscarPasta, caminhoDaPasta, papelNoDocumento, planejarMovimentoEmLote, moverDocumento, desfazerMovimento,
  arvoreDeDestinos, duplicarEmLote, validarMovimento, pastaIdDoDocumento
} from '../core/athenes_arquivos.js';
import { obterPastasDriveLocais, adicionarSubpastaDriveLocal, carregarDocumentoDoSupabase } from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';

const CSS = `
.ath-doc-card{position:relative}
.ath-doc-card.ath-sel{outline:2px solid #2F7BD0;outline-offset:-2px;background:#F4F8FD}
.ath-doc-card.ath-arrastando{opacity:.45}
.ath-doc-chk{position:absolute;top:8px;left:8px;width:20px;height:20px;border-radius:6px;border:1.5px solid #9AB0C8;background:#fff;display:grid;place-items:center;cursor:pointer;opacity:0;transition:opacity .12s;z-index:3;padding:0;color:#fff}
.ath-doc-card:hover .ath-doc-chk,.ath-doc-card.ath-sel .ath-doc-chk,.ath-modo-selecao .ath-doc-chk{opacity:1}
.ath-doc-card.ath-sel .ath-doc-chk{background:#2F7BD0;border-color:#2F7BD0}
.ath-doc-mais{height:26px;width:26px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;color:#475569;cursor:pointer;font:800 15px/1 system-ui;display:inline-grid;place-items:center;padding:0}
.ath-doc-mais:hover{background:#EEF4FA;border-color:#314F79;color:#314F79}
.ath-pasta-item.ath-drop-ok{background:#DCEBFA!important;outline:2px dashed #2F7BD0;outline-offset:-2px}
.ath-pasta-item.ath-drop-no{background:#FDECEC!important;outline:2px dashed #E5484D;outline-offset:-2px;cursor:not-allowed}
.ath-arq-menu{position:fixed;z-index:100002;min-width:210px;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.2);padding:5px;font:600 12.5px var(--glx-font,system-ui);color:#1F2733}
.ath-arq-menu button{display:flex;align-items:center;gap:9px;width:100%;height:32px;border:0;border-radius:8px;background:none;padding:0 10px;text-align:left;cursor:pointer;font:inherit;color:inherit}
.ath-arq-menu button:hover{background:#EEF4FA}.ath-arq-menu hr{border:0;border-top:1px solid #E3EAF2;margin:4px 2px}
.ath-arq-menu .perigo{color:#B42318}
.ath-arq-barra{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100001;display:flex;align-items:center;gap:8px;padding:9px 12px;background:#1B2D47;color:#fff;border-radius:14px;box-shadow:0 14px 36px rgba(15,23,42,.35);font:700 12.5px var(--glx-font,system-ui)}
.ath-arq-barra button{height:30px;padding:0 12px;border:1px solid rgba(255,255,255,.25);border-radius:9px;background:rgba(255,255,255,.08);color:#fff;font:700 12px var(--glx-font,system-ui);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.ath-arq-barra button:hover{background:rgba(255,255,255,.18)}
.ath-arq-fundo{position:fixed;inset:0;z-index:100003;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center}
.ath-arq-modal{width:min(520px,94vw);max-height:84vh;display:flex;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,.4);overflow:hidden;font:600 13px var(--glx-font,system-ui);color:#1F2733}
.ath-arq-modal header{padding:16px 20px 10px}.ath-arq-modal header h3{margin:0;font:800 16px var(--glx-font,inherit)}
.ath-arq-crumb{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:0 20px 10px;color:#64748B;font-size:12px}
.ath-arq-crumb button{border:0;background:none;padding:2px 4px;border-radius:6px;cursor:pointer;color:#314F79;font:700 12px var(--glx-font,inherit)}.ath-arq-crumb button:hover{background:#EEF4FA}
.ath-arq-lista{flex:1;min-height:180px;overflow:auto;border-top:1px solid #E3EAF2;border-bottom:1px solid #E3EAF2;padding:6px}
.ath-arq-linha{display:flex;align-items:center;gap:10px;width:100%;min-height:38px;padding:0 12px;border:0;border-radius:9px;background:none;cursor:pointer;text-align:left;font:inherit;color:inherit}
.ath-arq-linha:hover{background:#F1F5F9}.ath-arq-linha[data-bloq="1"]{color:#94A3B8}
.ath-arq-linha small{margin-left:auto;color:#94A3B8;font-weight:600}
.ath-arq-modal .rod{display:flex;gap:8px;align-items:center;padding:12px 16px;flex-wrap:wrap}
.ath-arq-modal .rod .esp{flex:1}
.ath-arq-modal input[type=text]{height:32px;border:1px solid #D5DEE9;border-radius:8px;padding:0 10px;font:600 12.5px var(--glx-font,inherit);min-width:0}
.ath-arq-btn{height:32px;padding:0 14px;border:1px solid #D5DEE9;border-radius:9px;background:#fff;color:#314F79;font:700 12.5px var(--glx-font,inherit);cursor:pointer}
.ath-arq-btn:hover:not(:disabled){background:#EEF4FA;border-color:#314F79}.ath-arq-btn:disabled{opacity:.45;cursor:default}
.ath-arq-btn.pri{background:#314F79;color:#fff;border-color:#314F79}.ath-arq-btn.pri:hover:not(:disabled){background:#27406A}
.ath-arq-aviso{margin:0 20px 10px;padding:9px 12px;border-radius:10px;background:#FFF6E0;border:1px solid #F5D78A;color:#7A5200;font-size:12px;line-height:1.45}
.ath-arq-toasts{position:fixed;right:20px;bottom:20px;z-index:100004;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.ath-arq-toast{display:flex;align-items:center;gap:12px;max-width:380px;padding:11px 14px;background:#1B2D47;color:#fff;border-radius:12px;box-shadow:0 12px 30px rgba(15,23,42,.35);font:600 12.5px var(--glx-font,system-ui)}
.ath-arq-toast.erro{background:#8E1B1B}.ath-arq-toast button{border:0;background:none;color:#9CC4F0;font:800 12px var(--glx-font,inherit);cursor:pointer;padding:0}
`;

const ICONES = {
  abrir: 'documento', duplicar: 'copiar', mover: 'pasta', excluir: 'lixeira', pasta: 'pasta', fechar: 'fechar'
};

export class GerenciadorArquivosUI {
  /**
   * @param {object} dash DashboardView (documentos, pastasDrive, perfilUsuario, atualizarGrid, ...)
   * @param {{persistir?: (docs:object[])=>Promise<void>}} opcoes `persistir` grava no armazenamento; rejeitar dispara o rollback
   */
  constructor(dash, opcoes = {}) {
    this.d = dash;
    this.persistir = opcoes.persistir || ((docs) => dash.persistirDocumentos(docs));
    this.sel = new Set();
    this.ultimoId = null;
    this.arrastando = null;
    this.ordemIds = [];
    this.menu = null;
    this.barra = null;
    this.injetarCss();
    this.aoEsc = (e) => { if (e.key === 'Escape') { this.fecharMenu(); if (this.sel.size) this.limparSelecao(); } };
    document.addEventListener('keydown', this.aoEsc);
    this.aoFora = (e) => { if (this.menu && !this.menu.contains(e.target)) this.fecharMenu(); };
    document.addEventListener('mousedown', this.aoFora, true);
  }

  destruir() {
    document.removeEventListener('keydown', this.aoEsc);
    document.removeEventListener('mousedown', this.aoFora, true);
    this.fecharMenu(); this.barra?.remove();
  }

  injetarCss() {
    if (document.getElementById('ath-arquivos-css')) return;
    const st = document.createElement('style'); st.id = 'ath-arquivos-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  // ───────────── contexto ─────────────
  ctx(extra = {}) {
    const ativa = this.d.pastaAtivaId && this.d.pastaAtivaId !== 'todas' ? this.d.pastaAtivaId : null;
    return { perfil: this.d.perfilUsuario, pastas: this.d.pastasDrive, documentos: this.d.documentos, pastaAtivaId: ativa, ...extra };
  }
  porId(id) { return this.d.documentos.find(x => String(x.id) === String(id)); }
  selecionados() { return [...this.sel].map(id => this.porId(id)).filter(Boolean); }
  rotuloPasta(id) { return buscarPasta(this.d.pastasDrive, id || RAIZ_PADRAO)?.nome || 'pasta'; }
  compartilhado(doc) { return papelNoDocumento(doc, this.d.perfilUsuario, this.d.pastasDrive) !== 'proprietario'; }

  // ───────────── toasts e diálogos ─────────────
  toast(texto, { tipo = 'ok', acao = null, ms = 6000 } = {}) {
    let host = document.querySelector('.ath-arq-toasts');
    if (!host) { host = document.createElement('div'); host.className = 'ath-arq-toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = `ath-arq-toast ${tipo === 'erro' ? 'erro' : ''}`;
    t.innerHTML = `<span>${escapeHtml(texto)}</span>${acao ? `<button type="button">${escapeHtml(acao.rotulo)}</button>` : ''}`;
    host.appendChild(t);
    const fechar = () => t.remove();
    t.querySelector('button')?.addEventListener('click', () => { fechar(); acao.fn(); });
    setTimeout(fechar, ms);
    return t;
  }

  /** Diálogo de confirmação próprio (Promise<boolean>). */
  confirmar({ titulo, texto, ok = 'Confirmar', cancelar = 'Cancelar' }) {
    return new Promise(resolve => {
      const f = document.createElement('div'); f.className = 'ath-arq-fundo';
      f.innerHTML = `<div class="ath-arq-modal" role="dialog" aria-modal="true" style="width:min(440px,94vw)"><header><h3>${escapeHtml(titulo)}</h3></header><div style="padding:0 20px 8px;line-height:1.5;color:#475569">${escapeHtml(texto)}</div><div class="rod"><span class="esp"></span><button class="ath-arq-btn" data-n>${escapeHtml(cancelar)}</button><button class="ath-arq-btn pri" data-s>${escapeHtml(ok)}</button></div></div>`;
      document.body.appendChild(f);
      const fim = (v) => { f.remove(); resolve(v); };
      f.querySelector('[data-s]').addEventListener('click', () => fim(true));
      f.querySelector('[data-n]').addEventListener('click', () => fim(false));
      f.addEventListener('mousedown', (e) => { if (e.target === f) fim(false); });
      f.querySelector('[data-s]').focus();
    });
  }

  // ───────────── seleção ─────────────
  decorarCard(card, doc, ordemIds) {
    this.ordemIds = ordemIds;
    card.dataset.docId = doc.id;
    card.classList.toggle('ath-sel', this.sel.has(String(doc.id)));
    const chk = document.createElement('button');
    chk.type = 'button'; chk.className = 'ath-doc-chk'; chk.title = 'Selecionar'; chk.setAttribute('aria-label', 'Selecionar documento');
    chk.innerHTML = svgIcone('check', 12);
    card.prepend(chk);
    const acoes = card.querySelector('.ath-doc-card-actions');
    if (acoes) {
      const mais = document.createElement('button');
      mais.type = 'button'; mais.className = 'ath-doc-mais'; mais.title = 'Mais ações'; mais.setAttribute('aria-haspopup', 'menu'); mais.textContent = '···';
      acoes.insertBefore(mais, acoes.firstChild);
    }
    if (this.compartilhado(doc)) {
      card.querySelector('.ath-doc-card-header')?.insertAdjacentHTML('beforeend', '<span class="ath-badge" style="background:#FFF6E0;color:#7A5200;border:1px solid #F5D78A;font-weight:700">Compartilhado comigo</span>');
    }
    card.draggable = true;
    card.addEventListener('dragstart', (ev) => this.iniciarArraste(ev, doc, card));
    card.addEventListener('dragend', () => this.encerrarArraste());
    card.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (!this.sel.has(String(doc.id))) { this.sel = new Set([String(doc.id)]); this.ultimoId = String(doc.id); this.pintarSelecao(); } this.abrirMenu(doc, ev.clientX, ev.clientY); });
    this.pintarSelecao(false);
  }

  /** Trata cliques com seleção/menu. Retorna true se o clique foi consumido (não abre o documento). */
  aoClicarCard(ev, doc) {
    const id = String(doc.id);
    if (ev.target.closest('.ath-doc-mais')) {
      ev.stopPropagation();
      const r = ev.target.closest('.ath-doc-mais').getBoundingClientRect();
      if (!this.sel.has(id)) { this.sel = new Set([id]); this.pintarSelecao(); }
      this.abrirMenu(doc, Math.min(r.left, innerWidth - 230), r.bottom + 4);
      return true;
    }
    if (ev.target.closest('.ath-doc-chk') || ev.ctrlKey || ev.metaKey) { this.alternar(id); return true; }
    if (ev.shiftKey && this.ultimoId) { this.selecionarIntervalo(this.ultimoId, id); return true; }
    if (this.sel.size) { this.alternar(id); return true; } // com seleção ativa, clicar seleciona (como no Drive)
    return false;
  }

  alternar(id) {
    if (this.sel.has(id)) this.sel.delete(id); else this.sel.add(id);
    this.ultimoId = id;
    this.pintarSelecao();
  }
  selecionarIntervalo(de, ate) {
    const a = this.ordemIds.map(String).indexOf(String(de)); const b = this.ordemIds.map(String).indexOf(String(ate));
    if (a < 0 || b < 0) { this.alternar(String(ate)); return; }
    this.ordemIds.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(i => this.sel.add(String(i)));
    this.pintarSelecao();
  }
  limparSelecao() { this.sel.clear(); this.ultimoId = null; this.pintarSelecao(); }
  selecionarTodos() { this.ordemIds.forEach(i => this.sel.add(String(i))); this.pintarSelecao(); }

  pintarSelecao(atualizarBarra = true) {
    const existentes = new Set(this.d.documentos.map(x => String(x.id)));
    [...this.sel].forEach(i => { if (!existentes.has(i)) this.sel.delete(i); });
    const grid = this.d.container.querySelector('#athDocsGrid');
    grid?.classList.toggle('ath-modo-selecao', this.sel.size > 0);
    grid?.querySelectorAll('.ath-doc-card').forEach(c => c.classList.toggle('ath-sel', this.sel.has(c.dataset.docId)));
    if (atualizarBarra) this.atualizarBarra();
  }

  atualizarBarra() {
    if (!this.sel.size) { this.barra?.remove(); this.barra = null; return; }
    if (!this.barra) {
      this.barra = document.createElement('div');
      this.barra.className = 'ath-arq-barra'; this.barra.setAttribute('role', 'toolbar'); this.barra.setAttribute('aria-label', 'Ações em lote');
      this.barra.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'mover') this.abrirModalMover(this.selecionados());
        else if (a === 'duplicar') this.duplicar(this.selecionados());
        else if (a === 'todos') this.selecionarTodos();
        else if (a === 'limpar') this.limparSelecao();
      });
      document.body.appendChild(this.barra);
    }
    this.barra.innerHTML = `<span>${this.sel.size} selecionado${this.sel.size > 1 ? 's' : ''}</span>
      <button type="button" data-a="mover">${svgIcone('pasta', 14)} Mover selecionados</button>
      <button type="button" data-a="duplicar">${svgIcone('copiar', 14)} Duplicar selecionados</button>
      <button type="button" data-a="todos">Todos</button>
      <button type="button" data-a="limpar" title="Limpar seleção (Esc)">${svgIcone('fechar', 14)}</button>`;
  }

  // ───────────── menu de contexto ─────────────
  abrirMenu(doc, x, y) {
    this.fecharMenu();
    const docs = this.sel.has(String(doc.id)) && this.sel.size > 1 ? this.selecionados() : [doc];
    const varios = docs.length > 1;
    const compart = docs.some(d => this.compartilhado(d));
    const m = document.createElement('div');
    m.className = 'ath-arq-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `
      ${varios ? '' : `<button type="button" role="menuitem" data-a="abrir">${svgIcone(ICONES.abrir, 14)} Abrir</button><hr>`}
      <button type="button" role="menuitem" data-a="duplicar">${svgIcone(ICONES.duplicar, 14)} ${compart ? 'Fazer uma cópia' : 'Duplicar'}${varios ? ` (${docs.length})` : ''}</button>
      <button type="button" role="menuitem" data-a="mover">${svgIcone(ICONES.mover, 14)} Mover para…${varios ? ` (${docs.length})` : ''}</button>
      <hr><button type="button" role="menuitem" class="perigo" data-a="excluir">${svgIcone(ICONES.excluir, 14)} Excluir${varios ? ` (${docs.length})` : ''}</button>`;
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
    m.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    m.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      this.fecharMenu();
      if (a === 'abrir') this.d.abrirDocumentoDoCard?.(doc);
      else if (a === 'duplicar') this.duplicar(docs);
      else if (a === 'mover') this.abrirModalMover(docs);
      else if (a === 'excluir') this.excluir(docs);
    });
    this.menu = m;
    m.querySelector('button')?.focus();
  }
  fecharMenu() { this.menu?.remove(); this.menu = null; }

  async excluir(docs) {
    const ok = await this.confirmar({ titulo: docs.length > 1 ? `Excluir ${docs.length} arquivos?` : 'Excluir arquivo?', texto: docs.length > 1 ? 'Os arquivos selecionados serão removidos desta lista.' : `"${docs[0].titulo}" será removido desta lista.`, ok: 'Excluir' });
    if (!ok) return;
    const ids = new Set(docs.map(x => String(x.id)));
    const antes = [...this.d.documentos];
    this.d.documentos = this.d.documentos.filter(x => !ids.has(String(x.id)));
    this.afterMudanca();
    try { await this.persistir([]); } catch (e) { this.d.documentos = antes; this.afterMudanca(); this.toast(`Não foi possível excluir: ${e.message}`, { tipo: 'erro' }); }
  }

  afterMudanca() {
    this.pintarSelecao();
    this.d.atualizarGrid();
    this.d.renderizarPastasLateral?.();
  }

  // ───────────── mover ─────────────
  /** Move com atualização otimista. Retorna { movidos, bloqueados }. */
  async mover(docs, destinoId, { copiarCompartilhados = null } = {}) {
    // copiarCompartilhados: true/false = escolha já feita no "Mover para…"; null = perguntar (ex.: arrastar e soltar)
    const ctx = this.ctx();
    const plano = planejarMovimentoEmLote(docs, destinoId, ctx);
    const compartilhados = plano.bloqueados.filter(b => b.codigo === 'compartilhado');
    const outros = plano.bloqueados.filter(b => b.codigo !== 'compartilhado');
    const nomeDestino = this.rotuloPasta(destinoId);

    if (!plano.moviveis.length && compartilhados.length && !outros.length) {
      const quer = copiarCompartilhados !== null ? copiarCompartilhados : await this.confirmar({ titulo: 'Arquivo compartilhado', texto: compartilhados[0].motivo, ok: 'Fazer uma cópia aqui', cancelar: 'Agora não' });
      if (quer) await this.duplicar(compartilhados.map(b => b.doc), { pastaDestinoId: destinoId });
      else if (copiarCompartilhados === false) this.toast('Arquivos compartilhados comigo não foram movidos: ficam em "Compartilhados comigo".', { tipo: 'erro' });
      return { movidos: [], bloqueados: plano.bloqueados };
    }
    if (!plano.moviveis.length) {
      this.toast(outros[0]?.motivo || 'Não foi possível mover.', { tipo: 'erro' });
      return { movidos: [], bloqueados: plano.bloqueados };
    }
    // otimista: aplica já
    const feitos = plano.moviveis.map(d => ({ d, r: moverDocumento(d, destinoId, ctx) })).filter(x => x.r.ok);
    this.afterMudanca();
    try {
      await this.persistir(feitos.map(x => x.d));
    } catch (e) {
      feitos.forEach(x => desfazerMovimento(x.d, x.r.anterior)); // rollback
      this.afterMudanca();
      this.toast(`Não foi possível mover: ${e.message || 'falha ao salvar'}. O arquivo voltou para a pasta original.`, { tipo: 'erro' });
      return { movidos: [], bloqueados: plano.bloqueados };
    }
    this.limparSelecao();
    this.toast(`${feitos.length > 1 ? `${feitos.length} arquivos movidos` : 'Arquivo movido'} para "${nomeDestino}".`, {
      acao: { rotulo: 'Desfazer', fn: () => this.desfazerMovimentoLote(feitos) }
    });
    if (compartilhados.length) {
      if (copiarCompartilhados === true) await this.duplicar(compartilhados.map(b => b.doc), { pastaDestinoId: destinoId });
      else this.toast(`${compartilhados.length} arquivo(s) compartilhado(s) comigo não foram movidos: ficam em "Compartilhados comigo".`, { tipo: 'erro' });
    }
    return { movidos: feitos.map(x => x.d), bloqueados: plano.bloqueados };
  }

  async desfazerMovimentoLote(feitos) {
    const atuais = feitos.map(x => ({ d: x.d, depois: { pastaId: x.d.pastaId } }));
    feitos.forEach(x => desfazerMovimento(x.d, x.r.anterior));
    this.afterMudanca();
    try { await this.persistir(feitos.map(x => x.d)); this.toast('Movimentação desfeita.'); }
    catch (e) { atuais.forEach(a => { a.d.pastaId = a.depois.pastaId; }); this.afterMudanca(); this.toast(`Não foi possível desfazer: ${e.message}`, { tipo: 'erro' }); }
  }

  // ───────────── duplicar ─────────────
  async duplicar(docs, { pastaDestinoId = null } = {}) {
    if (!docs.length) return [];
    // documentos da nuvem ainda sem conteúdo precisam ser baixados antes da cópia
    for (const d of docs) {
      if (!d.precisaCarregarConteudo) continue;
      this.toast(`Baixando "${d.titulo}" para copiar…`);
      try {
        const remoto = await carregarDocumentoDoSupabase(d.id);
        if (!remoto) throw new Error('documento não encontrado na nuvem');
        Object.assign(d, remoto, { salvoNuvem: true, precisaCarregarConteudo: false });
      } catch (e) { this.toast(`Não foi possível baixar "${d.titulo}": ${e.message}`, { tipo: 'erro' }); return []; }
    }
    let resultados;
    try { resultados = duplicarEmLote(docs, this.ctx({ pastaAtivaId: pastaDestinoId || this.ctx().pastaAtivaId })); }
    catch (e) { this.toast(`Não foi possível duplicar: ${e.message}`, { tipo: 'erro' }); return []; }
    const copias = resultados.map(r => r.doc);
    this.d.documentos.unshift(...copias); // otimista: aparece já
    this.sel = new Set(copias.map(c => String(c.id)));
    this.afterMudanca();
    try { await this.persistir(copias); }
    catch (e) {
      const ids = new Set(copias.map(c => String(c.id)));
      this.d.documentos = this.d.documentos.filter(x => !ids.has(String(x.id))); // rollback
      this.limparSelecao(); this.afterMudanca();
      this.toast(`Não foi possível duplicar: ${e.message || 'falha ao salvar'}. Nenhuma cópia foi criada.`, { tipo: 'erro' });
      return [];
    }
    const destino = this.rotuloPasta(copias[0].pastaId);
    const algumCompart = resultados.some(r => r.compartilhado);
    this.toast(copias.length > 1 ? `${copias.length} cópias criadas em "${destino}".` : `${algumCompart ? 'Cópia sua criada' : 'Cópia criada'} em "${destino}": ${copias[0].titulo}`, {
      acao: copias.length === 1 ? { rotulo: 'Abrir', fn: () => this.d.onAbrirDocumento(copias[0]) } : null
    });
    return copias;
  }

  // ───────────── modal "Mover para…" ─────────────
  abrirModalMover(docs) {
    if (!docs.length) return;
    this.fecharMenu();
    const ctx = this.ctx();
    const quemCompartilha = docs.filter(d => this.compartilhado(d) && validarMovimento(d, RAIZ_PADRAO, ctx).codigo === 'compartilhado');
    let atual = null; // null = início (lista de raízes)
    let criando = false;
    const f = document.createElement('div'); f.className = 'ath-arq-fundo';
    f.innerHTML = `<div class="ath-arq-modal" role="dialog" aria-modal="true" aria-label="Mover para">
      <header><h3>Mover ${docs.length > 1 ? `${docs.length} arquivos` : `"${escapeHtml(docs[0].titulo)}"`} para…</h3></header>
      ${quemCompartilha.length ? `<div class="ath-arq-aviso"><strong>${quemCompartilha.length} arquivo(s) compartilhado(s) comigo</strong> não podem ser movidos (ficam em "Compartilhados comigo"). <label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" data-copiar checked> Criar uma cópia deles na pasta escolhida</label></div>` : ''}
      <div class="ath-arq-crumb" data-crumb></div>
      <div class="ath-arq-lista" data-lista role="listbox"></div>
      <div class="rod" data-rod></div></div>`;
    document.body.appendChild(f);
    const fechar = () => { f.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    document.addEventListener('keydown', esc, true);
    f.addEventListener('mousedown', (e) => { if (e.target === f) fechar(); });

    const achar = (arvore, id) => { for (const n of arvore) { if (n.id === id) return n; const r = achar(n.subpastas, id); if (r) return r; } return null; };
    const desenhar = () => {
      // destinos valem para o que será movido; se só há compartilhados, valem como destino das cópias (que serão do usuário)
      const proprios = docs.filter(d => !quemCompartilha.includes(d));
      const paraArvore = proprios.length ? proprios : docs.map(d => ({ ...d, proprietario: { id: this.d.perfilUsuario?.id }, permissao: undefined }));
      const arvore = arvoreDeDestinos(this.d.pastasDrive, paraArvore, this.ctx());
      const no = atual ? achar(arvore, atual) : null;
      const caminho = atual ? caminhoDaPasta(this.d.pastasDrive, atual) : [];
      f.querySelector('[data-crumb]').innerHTML = `<button type="button" data-ir="">Início</button>${caminho.map(p => ` › <button type="button" data-ir="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</button>`).join('')}`;
      const filhos = no ? no.subpastas : arvore;
      f.querySelector('[data-lista]').innerHTML = filhos.length
        ? filhos.map(n => `<button type="button" class="ath-arq-linha" data-ir="${escapeHtml(n.id)}" data-bloq="${n.habilitada ? 0 : 1}" role="option">${svgIcone(n.origem === 'compartilhada' ? 'usuarios' : 'pasta', 16)}<span>${escapeHtml(n.nome)}</span>${n.origem === 'compartilhada' ? '<small>Compartilhada</small>' : ''}${!n.habilitada && n.motivo ? `<small title="${escapeHtml(n.motivo)}">${escapeHtml(n.motivo.length > 34 ? n.motivo.slice(0, 32) + '…' : n.motivo)}</small>` : ''}</button>`).join('')
        : '<div style="padding:28px;text-align:center;color:#94A3B8">Esta pasta não tem subpastas.</div>';
      const podeAqui = !!no && no.habilitada;
      f.querySelector('[data-rod]').innerHTML = criando
        ? `<input type="text" data-nome placeholder="Nome da nova pasta" style="flex:1"><button class="ath-arq-btn pri" data-criar>Criar</button><button class="ath-arq-btn" data-cancelar-criar>Cancelar</button>`
        : `<button class="ath-arq-btn" data-nova ${no && !no.habilitada && no.origem === 'compartilhada' ? 'disabled' : (atual ? '' : 'disabled')} title="${atual ? '' : 'Entre em uma pasta para criar uma subpasta'}">+ Nova pasta</button>
           <button class="ath-arq-btn" data-raiz>Mover para a raiz</button><span class="esp"></span>
           <button class="ath-arq-btn" data-cancelar>Cancelar</button><button class="ath-arq-btn pri" data-aqui ${podeAqui ? '' : 'disabled'}>Mover aqui</button>`;
      f.querySelector('[data-nome]')?.focus();
    };
    const confirmarMover = async (destino) => {
      const copiar = f.querySelector('[data-copiar]')?.checked ?? false;
      fechar();
      await this.mover(docs, destino, { copiarCompartilhados: copiar });
    };
    f.addEventListener('click', (e) => {
      const ir = e.target.closest('[data-ir]');
      if (ir) { atual = ir.dataset.ir || null; criando = false; desenhar(); return; }
      if (e.target.closest('[data-cancelar]')) return fechar();
      if (e.target.closest('[data-raiz]')) return confirmarMover(null);
      if (e.target.closest('[data-aqui]')) return confirmarMover(atual);
      if (e.target.closest('[data-nova]')) { criando = true; desenhar(); return; }
      if (e.target.closest('[data-cancelar-criar]')) { criando = false; desenhar(); return; }
      if (e.target.closest('[data-criar]')) criarPasta();
    });
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-nome]')) { e.preventDefault(); criarPasta(); } });
    const criarPasta = () => {
      const nome = f.querySelector('[data-nome]')?.value.trim();
      if (!nome || !atual) return;
      try {
        const nova = adicionarSubpastaDriveLocal({ parentId: atual, nome, tipo: 'relatorios' });
        this.d.pastasDrive = obterPastasDriveLocais();
        this.d.renderizarPastasLateral?.();
        atual = nova?.id || atual; criando = false;
        this.toast(`Pasta "${nome}" criada.`);
      } catch (err) { this.toast(`Não foi possível criar a pasta: ${err.message}`, { tipo: 'erro' }); }
      desenhar();
    };
    desenhar();
  }

  // ───────────── arrastar e soltar ─────────────
  iniciarArraste(ev, doc, card) {
    const id = String(doc.id);
    if (!this.sel.has(id)) { this.sel = new Set([id]); this.ultimoId = id; this.pintarSelecao(); }
    this.arrastando = this.selecionados();
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('application/x-athenes-docs', JSON.stringify(this.arrastando.map(x => x.id)));
    ev.dataTransfer.setData('text/plain', this.arrastando.map(x => x.titulo).join(', '));
    this.d.container.querySelectorAll('.ath-doc-card').forEach(c => { if (this.sel.has(c.dataset.docId)) c.classList.add('ath-arrastando'); });
  }
  encerrarArraste() {
    this.arrastando = null;
    this.d.container.querySelectorAll('.ath-arrastando').forEach(c => c.classList.remove('ath-arrastando'));
    this.d.container.querySelectorAll('.ath-drop-ok,.ath-drop-no').forEach(c => c.classList.remove('ath-drop-ok', 'ath-drop-no'));
  }

  /** Torna um item da árvore lateral um alvo de soltura, com feedback de destino válido/inválido. */
  tornarAlvoDeSolta(el, pastaId) {
    // válido se algum item puder ir para lá; compartilhados também (a soltura oferece criar uma cópia)
    const validos = () => {
      const ctx = this.ctx();
      return (this.arrastando || []).some(d => {
        const v = validarMovimento(d, pastaId, ctx);
        return v.ok || (v.codigo === 'compartilhado' && validarMovimento({ ...d, proprietario: { id: ctx.perfil?.id } }, pastaId, ctx).ok);
      });
    };
    el.addEventListener('dragover', (ev) => {
      if (!this.arrastando) return;
      const ok = validos();
      el.classList.toggle('ath-drop-ok', ok); el.classList.toggle('ath-drop-no', !ok);
      if (ok) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; } else ev.dataTransfer.dropEffect = 'none';
    });
    el.addEventListener('dragleave', () => el.classList.remove('ath-drop-ok', 'ath-drop-no'));
    el.addEventListener('drop', (ev) => {
      if (!this.arrastando) return;
      ev.preventDefault();
      const docs = this.arrastando; this.encerrarArraste();
      this.mover(docs, pastaId);
    });
  }
}

export { pastaIdDoDocumento };
