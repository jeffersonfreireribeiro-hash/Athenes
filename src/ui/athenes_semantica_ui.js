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
  inicializarEstadoSemantico,
  obterTagsSemanticas,
  adicionarMarcadorCustomizado,
  atualizarMarcadorCustomizado,
  removerMarcadorCustomizado,
  removerMarcadorDeBloco,
  removerMarcadorDeTrecho,
  toggleOverlaySemantico,
  gerarCssOverlaySemantico,
  contarUsoTagsSemanticas,
  validarHexCor
} from '../core/athenes_semantica.js';
import { svgIcone } from './athenes_icones.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { removerHifensCondicionais } from '../core/athenes_hifenizacao.js';

export class CamadaSemanticaEditorUI {
  constructor(editor) {
    this.editor = editor;
    if (editor?.doc) {
      inicializarEstadoSemantico(editor.doc);
    }
    this.badgeFlutuanteEl = null;
    this.trechoEmHover = null;
    this._fecharPopoverExterno = null;
  }

  get doc() {
    return this.editor?.doc;
  }

  get estado() {
    if (!this.doc) return { showSemanticOverlay: true, availableTags: [] };
    return inicializarEstadoSemantico(this.doc);
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

    const btnTopo = this.editor.container?.querySelector('#athBtnSemanticaTopo, #athBtnMenuSemantica');
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
          ${svgIcone('pincel', 16)} <span>Modo Pincel Ativo: <strong>${escapeHtml(tag?.label || this.estado.brushActiveTagId)}</strong></span>
          <button type="button" id="athBtnEncerrarPincel" title="Encerrar pincel (Esc)" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 4px;">${svgIcone('fechar', 14)}</button>
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

  aplicarNoTextoSelecionado(tagId = this.estado.brushActiveTagId) {
    const selecao = window.getSelection?.();
    if (!selecao?.rangeCount || selecao.isCollapsed) return false;
    const range = selecao.getRangeAt(0);
    const inicio = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
    const fim = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
    const editavel = inicio?.closest?.('.ath-texto-editable, .ath-titulo-editable');
    if (!editavel || editavel !== fim?.closest?.('.ath-texto-editable, .ath-titulo-editable')) return false;
    if (!this.editor.container?.contains(editavel) || !range.toString().trim()) return false;
    const blocoId = editavel.closest('[data-bloco-id]')?.dataset.blocoId;
    const bloco = this.editor.buscarBlocoPorId?.(blocoId);
    if (!bloco) return false;
    const htmlOriginal = editavel.innerHTML;
    const textoOriginal = removerHifensCondicionais(editavel.textContent);
    const confirmar = () => {
      if (removerHifensCondicionais(editavel.textContent) !== textoOriginal) {
        editavel.innerHTML = htmlOriginal;
        return false;
      }
      selecao.removeAllRanges();
      editavel.dataset.alteracaoSemanticaPendente = '1';
      try { editavel.dispatchEvent(new Event('input', { bubbles: true })); }
      finally { delete editavel.dataset.alteracaoSemanticaPendente; }
      this.editor._edicaoNativa = false;
      this.editor.salvarSnapshot?.();
      this.sincronizarOverlayCss();
      return true;
    };
    if (!tagId) {
      const marcado = inicio.closest?.('.ath-semantic-span');
      if (!marcado || !editavel.contains(marcado) || marcado !== fim.closest?.('.ath-semantic-span')) return false;
      const antes = document.createRange();
      antes.selectNodeContents(marcado);
      antes.setEnd(range.startContainer, range.startOffset);
      const depois = document.createRange();
      depois.selectNodeContents(marcado);
      depois.setStart(range.endContainer, range.endOffset);
      const partes = document.createDocumentFragment();
      const inicioFragmento = antes.cloneContents();
      const selecionado = range.cloneContents();
      const fimFragmento = depois.cloneContents();
      if (inicioFragmento.textContent) { const copia = marcado.cloneNode(false); copia.appendChild(inicioFragmento); partes.appendChild(copia); }
      partes.appendChild(selecionado);
      if (fimFragmento.textContent) { const copia = marcado.cloneNode(false); copia.appendChild(fimFragmento); partes.appendChild(copia); }
      marcado.replaceWith(partes);
      return confirmar();
    }
    if (!obterTagsSemanticas(this.doc).some(t => t.id === tagId)) return false;
    if (bloco.semanticTagId) {
      removerMarcadorDeBloco(bloco);
      delete editavel.dataset.semanticTag;
    }
    const span = document.createElement('span');
    span.className = 'ath-semantic-span';
    span.dataset.semanticTag = tagId;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    return confirmar();
  }

  instalarPincelNoPalco(palco) {
    if (!palco) return;
    palco.addEventListener('mouseup', (evento) => {
      if (!this.estado.brushActiveTagId || evento.button !== 0) return;
      if (window.getSelection?.()?.isCollapsed === false) this.aplicarNoTextoSelecionado();
    });
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
    const btn = this.editor.container?.querySelector('#athBtnSemanticaTopo, #athBtnMenuSemantica');
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
                  ${svgIcone('pincel', 14)}
                </button>
                <button type="button" class="ath-btn-acao-pincel" data-acao="editar" title="Editar nome e cores de exibição" aria-label="Editar ${escapeHtml(t.label)}">${svgIcone('config', 13)}</button>
                ${!t.isDefaultPreset ? `
                  <button type="button" class="ath-btn-acao-remover" data-acao="remover" title="Excluir marcador customizado (preserva o texto)">
                    ${svgIcone('fechar', 13)}
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
      item.querySelector('[data-acao="editar"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.abrirModalCriarMarcador(tagId);
      });
    });
  }

  /**
   * Modal para criar marcador personalizado (+ Adicionar Novo).
   */
  abrirModalCriarMarcador(tagId = null) {
    const existente = tagId ? obterTagsSemanticas(this.doc).find(t => t.id === tagId) : null;
    const overlay = document.createElement('div');
    overlay.className = 'ath-modal-overlay';
    overlay.innerHTML = `
      <div class="ath-modal-caixa ath-modal-criar-semantico" role="dialog" aria-label="Novo Marcador de Estrutura Científica">
        <div class="ath-modal-topo">
        <div class="ath-modal-titulo">${existente ? 'Editar Estrutura Científica' : 'Novo Marcador Semântico'}</div>
          <button type="button" class="ath-modal-fechar" id="athBtnFecharModalSem">${svgIcone('fechar', 15)}</button>
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

          <div class="ath-cor-cromatica">
            <div class="ath-cor-cromatica-abas" role="group" aria-label="Cor a ajustar">
              <button type="button" class="ativo" data-cor-alvo="fundo">Fundo</button>
              <button type="button" data-cor-alvo="texto">Letra</button>
            </div>
            <div id="athCirculoCromatico" class="ath-circulo-cromatico" role="slider" tabindex="0" aria-label="Círculo cromático" aria-valuemin="0" aria-valuemax="360">
              <span id="athIndicadorCirculo" class="ath-circulo-indicador"></span>
            </div>
            <label class="ath-form-label" for="athBrilhoCor">Luminosidade
              <input type="range" id="athBrilhoCor" min="0" max="100" value="100">
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
          <button type="button" class="glx-btn glx-btn-primary" id="athBtnSalvarModalSem">${existente ? 'Salvar Alterações' : 'Criar Marcador'}</button>
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
    const circulo = overlay.querySelector('#athCirculoCromatico');
    const indicador = overlay.querySelector('#athIndicadorCirculo');
    const brilho = overlay.querySelector('#athBrilhoCor');
    let alvoCor = 'fundo';
    let matiz = 0;
    let saturacao = 1;
    const hsvParaHex = (h, s, v) => {
      const f = n => {
        const k = (n + h / 60) % 6;
        return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
      };
      return `#${[f(5), f(3), f(1)].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    };
    const atualizarIndicador = () => {
      const raio = circulo.clientWidth / 2 - 12;
      const angulo = (matiz - 90) * Math.PI / 180;
      indicador.style.left = `${circulo.clientWidth / 2 + Math.cos(angulo) * saturacao * raio}px`;
      indicador.style.top = `${circulo.clientHeight / 2 + Math.sin(angulo) * saturacao * raio}px`;
      circulo.setAttribute('aria-valuenow', String(Math.round(matiz)));
    };
    const aplicarCorDoCirculo = () => {
      const hex = hsvParaHex(matiz, saturacao, Number(brilho.value) / 100);
      const amostra = alvoCor === 'fundo' ? colorBg : colorTxt;
      const campo = alvoCor === 'fundo' ? inputBgHex : inputTxtHex;
      amostra.value = hex;
      campo.value = hex;
      atualizarIndicador();
      atualizarPrevia();
    };
    const sincronizarCirculo = () => {
      const hex = (alvoCor === 'fundo' ? inputBgHex : inputTxtHex).value.trim();
      if (!validarHexCor(hex)) return;
      const normalizado = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
      const rgb = [1, 3, 5].map(i => parseInt(normalizado.slice(i, i + 2), 16) / 255);
      const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
      saturacao = max ? delta / max : 0;
      if (delta) {
        const i = rgb.indexOf(max);
        matiz = ((i === 0 ? (rgb[1] - rgb[2]) / delta : i === 1 ? (rgb[2] - rgb[0]) / delta + 2 : (rgb[0] - rgb[1]) / delta + 4) * 60 + 360) % 360;
      }
      brilho.value = String(Math.round(max * 100));
      atualizarIndicador();
    };
    if (existente) {
      inputNome.value = existente.label;
      selModo.value = existente.displayMode;
      colorBg.value = existente.backgroundColor || '#FEF3C7';
      inputBgHex.value = colorBg.value.toUpperCase();
      colorTxt.value = existente.textColor || '#92400E';
      inputTxtHex.value = colorTxt.value.toUpperCase();
    }

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

    colorBg.addEventListener('input', () => { inputBgHex.value = colorBg.value.toUpperCase(); sincronizarCirculo(); atualizarPrevia(); });
    inputBgHex.addEventListener('input', () => { if (validarHexCor(inputBgHex.value)) { colorBg.value = inputBgHex.value; sincronizarCirculo(); } atualizarPrevia(); });
    colorTxt.addEventListener('input', () => { inputTxtHex.value = colorTxt.value.toUpperCase(); sincronizarCirculo(); atualizarPrevia(); });
    inputTxtHex.addEventListener('input', () => { if (validarHexCor(inputTxtHex.value)) { colorTxt.value = inputTxtHex.value; sincronizarCirculo(); } atualizarPrevia(); });
    selModo.addEventListener('change', atualizarPrevia);
    atualizarPrevia();
    sincronizarCirculo();
    overlay.querySelectorAll('[data-cor-alvo]').forEach(botao => botao.addEventListener('click', () => {
      alvoCor = botao.dataset.corAlvo;
      overlay.querySelectorAll('[data-cor-alvo]').forEach(b => b.classList.toggle('ativo', b === botao));
      sincronizarCirculo();
    }));
    const selecionarCorNoCirculo = evento => {
      const rect = circulo.getBoundingClientRect();
      const x = evento.clientX - rect.left - rect.width / 2;
      const y = evento.clientY - rect.top - rect.height / 2;
      matiz = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
      saturacao = Math.min(1, Math.hypot(x, y) / (rect.width / 2 - 12));
      aplicarCorDoCirculo();
    };
    circulo.addEventListener('pointerdown', evento => { circulo.setPointerCapture(evento.pointerId); selecionarCorNoCirculo(evento); });
    circulo.addEventListener('pointermove', evento => { if (circulo.hasPointerCapture(evento.pointerId)) selecionarCorNoCirculo(evento); });
    circulo.addEventListener('keydown', evento => {
      const passo = evento.shiftKey ? 10 : 1;
      if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp') matiz = (matiz + passo) % 360;
      else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') matiz = (matiz - passo + 360) % 360;
      else return;
      evento.preventDefault();
      aplicarCorDoCirculo();
    });
    brilho.addEventListener('input', aplicarCorDoCirculo);

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
        const dados = {
          label,
          displayMode: selModo.value,
          backgroundColor: inputBgHex.value.trim().toUpperCase(),
          textColor: inputTxtHex.value.trim().toUpperCase()
        };
        if (existente) atualizarMarcadorCustomizado(this.doc, existente.id, dados);
        else adicionarMarcadorCustomizado(this.doc, dados);
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
        <span class="ath-badge-icone">${svgIcone('pincel', 13)}</span>
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
