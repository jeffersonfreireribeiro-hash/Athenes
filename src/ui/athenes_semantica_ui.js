// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Interface da Camada Visual de Marcação Retórica e Estrutura Científica
 * (Editor-Only Semantic Overlay).
 *
 * Provê:
 * - Botão e popover de estrutura do artigo no topo do editor (Alt+Shift+S).
 * - Modo pincel de marcação rápida.
 * - Modal / formulário para adicionar novos marcadores customizados (+ Adicionar Novo).
 * - Menu contextual na barra de texto para classificar trecho ou bloco.
 * - Badge / tooltip flutuante ao passar o mouse sobre trechos marcados (com remoção rápida).
 */

import {
  PRESETS_NATIVOS,
  inicializarEstadoSemantico,
  obterTagsSemanticas,
  adicionarMarcadorCustomizado,
  removerMarcadorCustomizado,
  aplicarMarcadorEmBloco,
  removerMarcadorDeBloco,
  aplicarMarcadorEmTrecho,
  removerMarcadorDeTrecho,
  toggleOverlaySemantico,
  gerarCssOverlaySemantico,
  contarUsoTagsSemanticas,
  validarHexCor
} from '../core/athenes_semantica.js';
import { svgIcone } from './athenes_icones.js';
import { escapeHtml } from '../core/athenes_seguranca.js';

export class CamadaSemanticaEditorUI {
  constructor(editor) {
    this.editor = editor;
    this.doc = editor.doc;
    this.estado = inicializarEstadoSemantico(this.doc);
    this.badgeFlutuanteEl = null;
    this.trechoEmHover = null;
    this._fecharPopoverExterno = null;
  }

  /**
   * Garante a injeção da folha de estilos reativa e classe no palco.
   */
  sincronizarOverlayCss() {
    let st = document.getElementById('athSemanticOverlayCss');
    if (!st) {
      st = document.createElement('style');
      st.id = 'athSemanticOverlayCss';
      document.head.appendChild(st);
    }
    const tags = obterTagsSemanticas(this.doc);
    st.textContent = gerarCssOverlaySemantico(tags);

    const palco = this.editor.container?.querySelector('#rmPrevPalco');
    if (palco) {
      palco.classList.toggle('ath-semantic-overlay-active', !!this.estado.showSemanticOverlay);
    }

    const btnTopo = this.editor.container?.querySelector('#athBtnSemanticaTopo');
    if (btnTopo) {
      btnTopo.classList.toggle('on', !!this.estado.showSemanticOverlay);
      btnTopo.setAttribute('aria-pressed', String(!!this.estado.showSemanticOverlay));
    }
  }

  /**
   * Alterna a visibilidade global da camada de marcação (Alt+Shift+S).
   */
  alternarVisibilidade(forcar = null) {
    const novoEstado = toggleOverlaySemantico(this.doc, forcar);
    this.sincronizarOverlayCss();
    this.editor.notificarMudancaRapida?.();
    return novoEstado;
  }

  /**
   * Ativa ou desativa o modo pincel para uma tag específica.
   */
  definirModoPincel(tagId) {
    if (this.estado.brushActiveTagId === tagId) {
      this.estado.brushActiveTagId = null;
    } else {
      this.estado.brushActiveTagId = tagId;
      // Garante overlay visível ao ativar o pincel
      if (!this.estado.showSemanticOverlay) {
        this.alternarVisibilidade(true);
      }
    }
    this.atualizarIndicadorPincel();
    this.sincronizarOverlayCss();
  }

  atualizarIndicadorPincel() {
    const boxPincel = this.editor.container?.querySelector('#athIndicadorPincelAtivo');
    const palco = this.editor.container?.querySelector('#rmPrevPalco');
    if (this.estado.brushActiveTagId) {
      const tag = obterTagsSemanticas(this.doc).find(t => t.id === this.estado.brushActiveTagId);
      if (boxPincel) {
        boxPincel.style.display = 'flex';
        boxPincel.innerHTML = `
          <span>🖌️ Modo Pincel Ativo: <strong>${escapeHtml(tag?.label || this.estado.brushActiveTagId)}</strong></span>
          <button type="button" id="athBtnEncerrarPincel" title="Encerrar pincel (Esc)" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 4px;">✕</button>
        `;
        boxPincel.querySelector('#athBtnEncerrarPincel')?.addEventListener('click', () => {
          this.definirModoPincel(null);
        });
      }
      if (palco) palco.classList.add('ath-cursor-pincel-ativo');
    } else {
      if (boxPincel) boxPincel.style.display = 'none';
      if (palco) palco.classList.remove('ath-cursor-pincel-ativo');
    }
  }

  /**
   * Monta o botão e popover na barra superior do editor.
   */
  montarItemMenuTopo() {
    const wrap = document.createElement('div');
    wrap.className = 'rm-menu-topo-item ath-menu-semantica';
    wrap.setAttribute('data-menu', 'semantica');

    const ativo = !!this.estado.showSemanticOverlay;
    wrap.innerHTML = `
      <button type="button" class="rm-btn-menu-topo ath-btn-semantica-topo ${ativo ? 'on' : ''}" id="athBtnSemanticaTopo" aria-haspopup="dialog" aria-expanded="false" title="Estrutura Científica & Movimentos Retóricos (Alt+Shift+S)">
        ${svgIcone('olho', 14)}
        <span>Estrutura do Artigo</span>
        <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
          <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="rm-topo-popover ath-popover-semantica" id="athPopoverSemantica" role="dialog" aria-label="Estrutura Científica do Documento" hidden></div>
    `;

    const btn = wrap.querySelector('#athBtnSemanticaTopo');
    const pop = wrap.querySelector('#athPopoverSemantica');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const aberto = !pop.hidden;
      if (aberto) {
        this.fecharPopover();
      } else {
        this.abrirPopover(pop, btn);
      }
    });

    return wrap;
  }

  abrirPopover(pop, btn) {
    this.fecharPopover();
    this.renderizarConteudoPopover(pop);
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('aberto');

    this._fecharPopoverExterno = (ev) => {
      if (!pop.contains(ev.target) && !btn.contains(ev.target)) {
        this.fecharPopover();
      }
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', this._fecharPopoverExterno);
    }, 0);
  }

  fecharPopover() {
    const pop = this.editor.container?.querySelector('#athPopoverSemantica');
    const btn = this.editor.container?.querySelector('#athBtnSemanticaTopo');
    if (pop) pop.hidden = true;
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('aberto');
    }
    if (this._fecharPopoverExterno) {
      document.removeEventListener('pointerdown', this._fecharPopoverExterno);
      this._fecharPopoverExterno = null;
    }
  }

  renderizarConteudoPopover(pop) {
    const tags = obterTagsSemanticas(this.doc);
    const contadores = contarUsoTagsSemanticas(this.doc);
    const overlayAtivo = !!this.estado.showSemanticOverlay;
    const pincelId = this.estado.brushActiveTagId;

    pop.innerHTML = `
      <div class="ath-sem-pop-head">
        <div>
          <div class="ath-sem-pop-titulo">Estrutura Científica (IMRaD)</div>
          <div class="ath-sem-pop-sub">Marcação retórica exclusiva de visualização (non-printable)</div>
        </div>
        <label class="ath-switch-label" title="Alternar visibilidade (Alt+Shift+S)">
          <input type="checkbox" id="athSwitchOverlaySemantico" ${overlayAtivo ? 'checked' : ''}>
          <span class="ath-switch-slider"></span>
        </label>
      </div>

      <div class="ath-sem-pop-botoes-topo">
        <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athBtnAdicionarNovoMarcador">
          + Adicionar Novo
        </button>
        ${pincelId ? `<button type="button" class="glx-btn glx-btn-danger glx-btn-xs" id="athBtnDesligarPincelTopo">Desligar Pincel</button>` : ''}
      </div>

      <div class="ath-sem-lista-tags ath-rolagem-interna">
        ${tags.map(t => {
          const qtd = contadores[t.id] || 0;
          const ehPincel = pincelId === t.id;
          const bgAm = t.backgroundColor || 'transparent';
          const corAm = t.textColor || '#1F2733';
          return `
            <div class="ath-sem-item-tag ${ehPincel ? 'pincel-on' : ''}" data-tag-id="${t.id}">
              <span class="ath-sem-amostra-cor" style="background:${bgAm}; color:${corAm};">Aa</span>
              <div class="ath-sem-info-tag">
                <span class="ath-sem-tag-nome">${escapeHtml(t.label)}</span>
                <span class="ath-sem-tag-sub">${t.isDefaultPreset ? 'IMRaD' : 'Custom'} · ${qtd} uso(s)</span>
              </div>
              <div class="ath-sem-acoes-tag">
                <button type="button" class="ath-btn-acao-pincel ${ehPincel ? 'ativo' : ''}" data-acao="pincel" title="${ehPincel ? 'Desativar pincel' : 'Ativar pincel de escrita rápida'}">
                  🖌️
                </button>
                ${!t.isDefaultPreset ? `
                  <button type="button" class="ath-btn-acao-remover" data-acao="remover" title="Excluir marcador customizado (preserva o texto)">
                    ✕
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="ath-sem-pop-footer">
        <small>Atalho rápido: <strong>Alt + Shift + S</strong> · Oculto em PDF/DOCX</small>
      </div>
    `;

    // Toggle switch
    pop.querySelector('#athSwitchOverlaySemantico')?.addEventListener('change', (e) => {
      this.alternarVisibilidade(e.target.checked);
      this.renderizarConteudoPopover(pop);
    });

    // Botão Adicionar Novo
    pop.querySelector('#athBtnAdicionarNovoMarcador')?.addEventListener('click', () => {
      this.abrirModalCriarMarcador();
    });

    // Botão Desligar Pincel
    pop.querySelector('#athBtnDesligarPincelTopo')?.addEventListener('click', () => {
      this.definirModoPincel(null);
      this.renderizarConteudoPopover(pop);
    });

    // Ações dos itens
    pop.querySelectorAll('.ath-sem-item-tag').forEach(item => {
      const tagId = item.dataset.tagId;
      item.querySelector('[data-acao="pincel"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.definirModoPincel(tagId);
        this.renderizarConteudoPopover(pop);
      });

      item.querySelector('[data-acao="remover"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmarExclusaoMarcador(tagId);
      });
    });
  }

  /**
   * Modal para criar marcador personalizado (+ Adicionar Novo).
   */
  abrirModalCriarMarcador() {
    const overlay = document.createElement('div');
    overlay.className = 'ath-modal-overlay';
    overlay.innerHTML = `
      <div class="ath-modal-caixa ath-modal-criar-semantico" role="dialog" aria-label="Novo Marcador de Estrutura Científica">
        <div class="ath-modal-topo">
          <div class="ath-modal-titulo">Novo Marcador Semântico</div>
          <button type="button" class="ath-modal-fechar" id="athBtnFecharModalSem">✕</button>
        </div>
        <div class="ath-modal-corpo">
          <label class="ath-form-label">
            Nome do Marcador
            <input type="text" id="athInputNomeMarcador" class="glx-input" placeholder="Ex: Hipótese Secundária, Revisar Depois..." maxlength="48">
          </label>

          <label class="ath-form-label">
            Modo de Exibição Cromática
            <select id="athSelModoMarcador" class="glx-input">
              <option value="both" selected>Fundo e Cor da Letra (Destaque Duplo)</option>
              <option value="background_only">Apenas Fundo (Highlight Suave)</option>
              <option value="text_color_only">Apenas Cor da Letra</option>
            </select>
          </label>

          <div class="ath-form-cores-grid">
            <label class="ath-form-label" id="athWrapCorFundo">
              Cor de Fundo
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="color" id="athColorBg" value="#FEF3C7" style="width:38px; height:32px; border:none; cursor:pointer;">
                <input type="text" id="athInputBgHex" class="glx-input" value="#FEF3C7" style="width:90px; text-transform:uppercase;">
              </div>
            </label>

            <label class="ath-form-label" id="athWrapCorTexto">
              Cor da Letra
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="color" id="athColorTxt" value="#92400E" style="width:38px; height:32px; border:none; cursor:pointer;">
                <input type="text" id="athInputTxtHex" class="glx-input" value="#92400E" style="width:90px; text-transform:uppercase;">
              </div>
            </label>
          </div>

          <div class="ath-previa-marcador-wrap">
            <span class="ath-previa-marcador-lbl">Prévia em tela:</span>
            <span id="athPreviaMarcadorAmostra" style="background:#FEF3C7; color:#92400E; padding:4px 10px; border-radius:4px; font-weight:600;">
              Exemplo de texto com marcação semântica
            </span>
          </div>
        </div>
        <div class="ath-modal-rodape">
          <button type="button" class="glx-btn glx-btn-soft" id="athBtnCancelarModalSem">Cancelar</button>
          <button type="button" class="glx-btn glx-btn-primary" id="athBtnSalvarModalSem">Criar Marcador</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const inputNome = overlay.querySelector('#athInputNomeMarcador');
    const selModo = overlay.querySelector('#athSelModoMarcador');
    const colorBg = overlay.querySelector('#athColorBg');
    const inputBgHex = overlay.querySelector('#athInputBgHex');
    const colorTxt = overlay.querySelector('#athColorTxt');
    const inputTxtHex = overlay.querySelector('#athInputTxtHex');
    const previa = overlay.querySelector('#athPreviaMarcadorAmostra');

    const atualizarPrevia = () => {
      const modo = selModo.value;
      const bg = inputBgHex.value.trim() || '#FEF3C7';
      const txt = inputTxtHex.value.trim() || '#92400E';

      if (modo === 'background_only') {
        previa.style.backgroundColor = bg;
        previa.style.color = '#1F2733';
      } else if (modo === 'text_color_only') {
        previa.style.backgroundColor = 'transparent';
        previa.style.color = txt;
      } else {
        previa.style.backgroundColor = bg;
        previa.style.color = txt;
      }
    };

    colorBg.addEventListener('input', () => { inputBgHex.value = colorBg.value.toUpperCase(); atualizarPrevia(); });
    inputBgHex.addEventListener('input', () => { if (validarHexCor(inputBgHex.value)) { colorBg.value = inputBgHex.value; } atualizarPrevia(); });
    colorTxt.addEventListener('input', () => { inputTxtHex.value = colorTxt.value.toUpperCase(); atualizarPrevia(); });
    inputTxtHex.addEventListener('input', () => { if (validarHexCor(inputTxtHex.value)) { colorTxt.value = inputTxtHex.value; } atualizarPrevia(); });
    selModo.addEventListener('change', atualizarPrevia);

    const fechar = () => overlay.remove();
    overlay.querySelector('#athBtnFecharModalSem').addEventListener('click', fechar);
    overlay.querySelector('#athBtnCancelarModalSem').addEventListener('click', fechar);

    overlay.querySelector('#athBtnSalvarModalSem').addEventListener('click', () => {
      const label = inputNome.value.trim();
      if (!label || label.length < 2) {
        alert('Digite um nome para o marcador (pelo menos 2 caracteres).');
        inputNome.focus();
        return;
      }

      try {
        adicionarMarcadorCustomizado(this.doc, {
          label,
          displayMode: selModo.value,
          backgroundColor: inputBgHex.value.trim().toUpperCase(),
          textColor: inputTxtHex.value.trim().toUpperCase()
        });
        this.sincronizarOverlayCss();
        this.editor.notificarMudanca?.();
        fechar();
        const pop = this.editor.container?.querySelector('#athPopoverSemantica');
        if (pop && !pop.hidden) this.renderizarConteudoPopover(pop);
      } catch (err) {
        alert('Erro ao criar marcador: ' + err.message);
      }
    });

    inputNome.focus();
  }

  confirmarExclusaoMarcador(tagId) {
    const tag = obterTagsSemanticas(this.doc).find(t => t.id === tagId);
    if (!tag) return;
    const ok = confirm(`Deseja excluir o marcador "${tag.label}"?\n\nO texto dos parágrafos será 100% preservado; apenas a marcação cromática será removida.`);
    if (!ok) return;

    removerMarcadorCustomizado(this.doc, tagId);
    this.sincronizarOverlayCss();
    this.editor.notificarMudanca?.();
    this.editor.renderizarFolhasPaginas?.();
    const pop = this.editor.container?.querySelector('#athPopoverSemantica');
    if (pop && !pop.hidden) this.renderizarConteudoPopover(pop);
  }

  /**
   * Instala a badge / tooltip flutuante ao passar o mouse sobre trechos ou blocos com data-semantic-tag.
   */
  instalarHoverBadge(palco) {
    if (!palco) return;

    if (!this.badgeFlutuanteEl) {
      this.badgeFlutuanteEl = document.createElement('div');
      this.badgeFlutuanteEl.id = 'athBadgeSemanticaHover';
      this.badgeFlutuanteEl.className = 'ath-badge-semantica-hover';
      this.badgeFlutuanteEl.style.display = 'none';
      document.body.appendChild(this.badgeFlutuanteEl);
    }

    let timeoutOcultar = null;

    palco.addEventListener('pointerover', (e) => {
      if (!this.estado.showSemanticOverlay) return;
      const alvo = e.target.closest('[data-semantic-tag]');
      if (!alvo) return;

      clearTimeout(timeoutOcultar);
      this.trechoEmHover = alvo;
      const tagId = alvo.getAttribute('data-semantic-tag');
      const tag = obterTagsSemanticas(this.doc).find(t => t.id === tagId);
      if (!tag) return;

      const rect = alvo.getBoundingClientRect();
      this.badgeFlutuanteEl.innerHTML = `
        <span class="ath-badge-icone">🏷️</span>
        <span class="ath-badge-texto">${escapeHtml(tag.label)}</span>
        <button type="button" class="ath-badge-remover" title="Desmarcar função retórica">✕</button>
      `;

      this.badgeFlutuanteEl.querySelector('.ath-badge-remover')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.desmarcarElemento(alvo, tagId);
        this.ocultarBadgeHover();
      });

      this.badgeFlutuanteEl.style.display = 'flex';
      this.badgeFlutuanteEl.style.left = `${rect.left + Math.min(rect.width / 2, 80)}px`;
      this.badgeFlutuanteEl.style.top = `${rect.top - 28}px`;
    });

    palco.addEventListener('pointerout', (e) => {
      const paraOnde = e.relatedTarget;
      if (this.badgeFlutuanteEl.contains(paraOnde)) return;
      timeoutOcultar = setTimeout(() => this.ocultarBadgeHover(), 250);
    });

    this.badgeFlutuanteEl.addEventListener('pointerenter', () => {
      clearTimeout(timeoutOcultar);
    });

    this.badgeFlutuanteEl.addEventListener('pointerleave', () => {
      timeoutOcultar = setTimeout(() => this.ocultarBadgeHover(), 250);
    });
  }

  ocultarBadgeHover() {
    if (this.badgeFlutuanteEl) {
      this.badgeFlutuanteEl.style.display = 'none';
      this.trechoEmHover = null;
    }
  }

  desmarcarElemento(alvo, tagId) {
    const blocoEl = alvo.closest('.ath-bloco-folha');
    const blocoId = blocoEl?.dataset?.blocoId;
    const bloco = blocoId ? this.editor.buscarBlocoPorId?.(blocoId) : this.editor.blocoSelecionado;

    if (alvo.classList.contains('ath-semantic-span')) {
      // Span inline
      if (bloco && typeof bloco.texto === 'string') {
        bloco.texto = removerMarcadorDeTrecho(bloco.texto, tagId);
        this.editor.notificarMudanca?.();
        this.editor.renderizarFolhasPaginas?.();
      }
    } else {
      // Nível de bloco
      if (bloco) {
        removerMarcadorDeBloco(bloco);
        alvo.removeAttribute('data-semantic-tag');
        this.editor.notificarMudanca?.();
        this.editor.renderizarFolhasPaginas?.();
      }
    }
  }
}
