// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Engine de atalhos: um único listener `keydown` (fase de captura) por instância, com
 * escopo contextual, tabela `ação → atalho → handler` e remoção limpa do listener.
 */

import {
  CATALOGO, construirIndice, resolverAcao, detectarMac, tooltipComAtalho, acaoPorId
} from '../core/athenes_atalhos.js';

// ações que continuam valendo com o foco num <input>/<textarea> (campos de busca e modais)
const VALE_EM_CAMPOS = new Set(['salvar', 'exportar', 'guia_atalhos', 'localizar', 'substituir', 'ir_para', 'proxima_ocorrencia', 'ocorrencia_anterior']);

let instanciaAtiva = null;

export class GerenciadorAtalhos {
  /**
   * @param {{raiz: HTMLElement, mac?: boolean, personalizados?: object, catalogo?: object[]}} opcoes
   * `raiz`: elemento do editor; blocos editáveis são os contenteditable dentro dele.
   */
  constructor({ raiz, mac = detectarMac(), personalizados = null, catalogo = CATALOGO }) {
    this.raiz = raiz;
    this.mac = mac;
    this.catalogo = catalogo;
    this.personalizados = personalizados;
    this.handlers = new Map();
    this.indice = construirIndice(mac, personalizados, catalogo);
    this.aoTeclar = (e) => this.processar(e);
    this.ativo = false;
  }

  /** Registra o handler de uma ação do catálogo. Retornar `false` devolve o evento ao navegador. */
  registrar(idAcao, handler) {
    if (!acaoPorId(idAcao, this.catalogo)) throw new Error(`Ação de atalho desconhecida: ${idAcao}`);
    this.handlers.set(idAcao, handler);
    return this;
  }

  definirPersonalizados(mapa) {
    this.personalizados = mapa;
    this.indice = construirIndice(this.mac, mapa, this.catalogo);
  }

  anexar() {
    if (instanciaAtiva && instanciaAtiva !== this) instanciaAtiva.desanexar(); // evita listeners duplicados
    if (this.ativo) return this;
    document.addEventListener('keydown', this.aoTeclar, true);
    this.ativo = true; instanciaAtiva = this;
    return this;
  }

  desanexar() {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.ativo = false;
    if (instanciaAtiva === this) instanciaAtiva = null;
  }

  /** Contexto do foco: bloco editável do editor, campo de formulário ou nada. */
  contexto(alvo = document.activeElement) {
    const el = alvo instanceof Element ? alvo : null;
    const campo = !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    const editavel = !!el && !campo && el.isContentEditable && this.raiz.contains(el);
    return { editavel, campo };
  }

  processar(e) {
    if (e.isComposing || e.repeat && !/^(Arrow|Backspace|Delete)/.test(e.key) && e.key !== 'F3') return;
    const ctx = this.contexto(e.target);
    // atalhos da engine não valem em modais próprios de outros componentes, exceto os marcados
    const acao = resolverAcao(e, { mac: this.mac, contexto: ctx, indice: this.indice });
    if (!acao) return;
    if (ctx.campo && !VALE_EM_CAMPOS.has(acao.id)) return;
    const h = this.handlers.get(acao.id);
    if (!h) return; // sem handler (ações `nativo`): o navegador cuida
    const r = h(e, ctx, acao);
    if (r === false) return;
    e.preventDefault();
    e.stopPropagation();
  }

  tooltip(rotulo, idAcao) { return tooltipComAtalho(rotulo, idAcao, this.mac, this.personalizados); }

  /** Reescreve o `title` dos elementos mapeados ("Negrito (Ctrl+B)" ou "(⌘B)"). Idempotente. */
  aplicarTooltips(mapa, escopo = document) {
    for (const [seletor, idAcao] of mapa) {
      escopo.querySelectorAll(seletor).forEach(el => {
        const base = el.dataset.rotuloAtalho || (el.getAttribute('title') || el.getAttribute('aria-label') || '').replace(/\s*\([^)]*\)\s*$/, '');
        if (!base) return;
        el.dataset.rotuloAtalho = base;
        const t = this.tooltip(base, idAcao);
        if (el.getAttribute('title') !== t) el.setAttribute('title', t);
      });
    }
  }

  /** Observa o DOM e reaplica os tooltips quando painéis/barras são redesenhados. */
  observarTooltips(mapa) {
    this.aplicarTooltips(mapa);
    let t = null;
    this._obs?.disconnect();
    this._obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => this.aplicarTooltips(mapa), 120); });
    this._obs.observe(document.body, { childList: true, subtree: true });
  }

  destruir() {
    this.desanexar();
    this._obs?.disconnect();
    this.handlers.clear();
  }
}
