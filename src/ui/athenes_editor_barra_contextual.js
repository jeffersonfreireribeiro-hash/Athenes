// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor: barra flutuante do texto (estilo, lista, alinhamento, dividir/unir, citar) e aplicação de estilo ao trecho.
 * Métodos do EditorView (usam `this`); são acrescentados ao prototype em athenes_editor.js.
 */
import { FONTES_SISTEMA, criarEstilosPadrao } from '../core/athenes_estilos.js';
import { svgIcone } from './athenes_icones.js';
import { unirBlocosTexto } from '../core/athenes_documento.js';
import { removerPalavrasIniciais } from '../core/athenes_estilo_avancado.js';
import { sanearHtmlTexto } from '../core/athenes_estilo_exclusivo.js';

export const metodosBarraContextual = {
  inicializarBarraContextualTexto() {
    if (document.getElementById('athBarraContextualTexto')) return;

    const barra = document.createElement('div');
    barra.id = 'athBarraContextualTexto';
    barra.className = 'ath-barra-contextual';
    barra.style.display = 'none';
    barra.style.position = 'fixed';
    barra.style.zIndex = '9000';
    barra.style.background = 'var(--ath-surface, #fff)';
    barra.style.borderRadius = '999px';
    barra.style.boxShadow = '0 6px 22px rgba(49, 79, 121, 0.22)';
    barra.style.border = '1px solid var(--ath-primary-line, #C8D7E6)';
    barra.style.padding = '5px 10px';
    barra.style.gap = '4px';
    barra.style.alignItems = 'center';
    barra.style.transform = 'translate(-50%, -100%)';
    barra.style.marginTop = '-8px';
    barra.style.userSelect = 'none';

    barra.innerHTML = `
      <!-- Dropdown de Estilo de Texto na Barra Flutuante -->
      <div class="ath-ctx-dropdown-wrap" id="athWrapCtxEstilo">
        <button type="button" class="ath-ctx-dropdown-btn" id="athBtnContextEstiloMenu" title="Aplicar Estilo de Texto ao Bloco" style="height:28px; padding:0 10px; font-weight:700;">
          <span id="athRotuloCtxEstilo" style="font-size:11px; font-weight:700; max-width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Estilo</span>
          <span style="font-size:10px; opacity:0.8;">▾</span>
        </button>
        <div class="ath-ctx-dropdown-menu" id="athMenuContextEstilo" hidden style="width:240px; overflow:hidden; padding:4px;">
          <div style="font:800 10.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em; padding:4px 8px; border-bottom:1px solid #EEF2F6; margin-bottom:4px;">
            Estilos de Texto
          </div>
          <div id="athListaItensCtxEstilos" class="ath-rolagem-interna" style="display:flex; flex-direction:column; gap:2px; max-height:236px; overflow-y:auto; padding-right:4px;"></div>
        </div>
      </div>
      <span style="width:1px; height:16px; background:var(--ath-primary-line, #C8D7E6); margin:0 2px;"></span>
      <span style="width:1px; height:16px; background:var(--ath-primary-line, #C8D7E6); margin:0 2px;"></span>
      <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnContextDividir" title="Dividir este bloco de texto em dois no cursor" style="height:28px; display:inline-flex; align-items:center; gap:4px; border-radius:999px;">${svgIcone('divisor', 13)} Dividir</button>
      <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnContextCitar" title="Inserir citação Zotero" style="height:28px; display:inline-flex; align-items:center; border-radius:999px;">Citar Zotero</button>
    `;

    // Pill flutuante para quando o cursor está posicionado no texto (sem seleção prévia)
    let pillCaret = document.getElementById('athPillAcoesCursor');
    if (!pillCaret) {
      pillCaret = document.createElement('div');
      pillCaret.id = 'athPillAcoesCursor';
      pillCaret.className = 'ath-pill-cursor-acoes';
      pillCaret.style.display = 'none';
      pillCaret.style.position = 'fixed';
      pillCaret.style.zIndex = '9100';
      pillCaret.innerHTML = `
        <button type="button" class="ath-pill-bt" id="athBtnPillDividir" title="Dividir este bloco de texto em dois no cursor">
          ${svgIcone('divisor', 13)} <span>Dividir Bloco Aqui</span>
        </button>
        <span class="ath-pill-sep"></span>
        <button type="button" class="ath-pill-bt ath-pill-bt-zotero" id="athBtnPillCitar" title="Inserir citação bibliográfica do Zotero no cursor">
          ${svgIcone('zotero', 14)} <span>Citar Zotero</span>
        </button>
      `;
      document.body.appendChild(pillCaret);
    }

    // Pílula "Unir blocos": aparece quando a seleção atravessa dois ou mais blocos de texto
    let pillUnir = document.getElementById('athPillUnirBlocos');
    if (!pillUnir) {
      pillUnir = document.createElement('div');
      pillUnir.id = 'athPillUnirBlocos';
      pillUnir.className = 'ath-pill-cursor-acoes';
      Object.assign(pillUnir.style, { display: 'none', position: 'fixed', zIndex: '9100' });
      pillUnir.innerHTML = `
        <button type="button" class="ath-pill-bt" id="athBtnUnirContinuo" title="Juntar os blocos selecionados em um só texto corrido">
          ${svgIcone('divisor', 13)} <span id="athRotuloUnir">Unir blocos</span>
        </button>
        <span class="ath-pill-sep"></span>
        <button type="button" class="ath-pill-bt" id="athBtnUnirLinhas" title="Juntar em um só bloco, cada bloco em uma linha">
          <span>Unir em linhas</span>
        </button>`;
      document.body.appendChild(pillUnir);
    }

    document.body.appendChild(barra);

    // Blocos de parágrafo atingidos pela seleção (ids dos blocos de origem, na ordem do documento)
    const blocosDaSelecao = (range) => {
      const els = [...(this.container?.querySelectorAll('.ath-texto-editable') || [])].filter(el => range.intersectsNode(el));
      const ids = [];
      for (const el of els) {
        const idDom = el.closest('[data-bloco-id]')?.dataset.blocoId;
        const fb = (this.doc.paginas || []).flatMap(p => p.blocos || []).find(x => x.id === idDom);
        const id = fb?._frag?.origemId || idDom;
        const b = id ? this.buscarBlocoPorId(id) : null;
        if (b && b.tipo === 'paragrafo' && !ids.includes(id)) ids.push(id);
      }
      return ids;
    };
    const unir = (modo) => {
      const ids = this._idsParaUnir || [];
      pillUnir.style.display = 'none';
      const r = unirBlocosTexto(this.doc, ids, modo);
      if (r) this.aposEstrutura(r.bloco);
      else alert('Só dá para unir parágrafos em sequência, na mesma seção.');
    };
    pillUnir.querySelector('#athBtnUnirContinuo').addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); unir('continuo'); });
    pillUnir.querySelector('#athBtnUnirLinhas').addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); unir('linhas'); });

    const menuEstilo = barra.querySelector('#athMenuContextEstilo');
    const btnEstiloMenu = barra.querySelector('#athBtnContextEstiloMenu');

    const fecharDropdownsCtx = () => {
      if (menuEstilo) menuEstilo.hidden = true;
    };

    const renderizarListaEstilosContextuais = () => {
      const containerItens = barra.querySelector('#athListaItensCtxEstilos');
      if (!containerItens) return;
      if (!Array.isArray(this.doc.estilos) || this.doc.estilos.length === 0) {
        this.doc.estilos = criarEstilosPadrao('abnt');
      }
      const estilos = this.doc.estilos;
      const estiloAtivoId = this.blocoSelecionado?.estiloId;

      containerItens.innerHTML = estilos.map(est => {
        const ativo = est.id === estiloAtivoId;
        return `
          <button type="button" class="ath-ctx-menu-item ${ativo ? 'on' : ''}" data-ctx-estilo-id="${est.id}" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; cursor:pointer; width:100%; border:none; background:${ativo ? 'var(--ath-primary-soft, #EEF4FA)' : 'transparent'}; border-radius:6px; text-align:left;">
            <span style="font-weight:${est.peso || 600}; font-size:12px; color:#1E293B;">${est.nome}</span>
            <small style="color:#64748B; font-size:10.5px;">${est.tamanho_pt || 12}pt</small>
          </button>
        `;
      }).join('');

      containerItens.querySelectorAll('[data-ctx-estilo-id]').forEach(btn => {
        const acao = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const estiloId = btn.dataset.ctxEstiloId;
          this.aplicarEstiloNoTextoSelecionado(estiloId, barra);
          fecharDropdownsCtx();
        };
        btn.addEventListener('mousedown', acao);
        btn.addEventListener('click', acao);
      });
    };

    menuEstilo?.addEventListener('mousedown', e => e.stopPropagation());
    menuEstilo?.addEventListener('click', e => e.stopPropagation());

    btnEstiloMenu?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const abrir = menuEstilo.hidden;
      fecharDropdownsCtx();
      if (abrir) {
        renderizarListaEstilosContextuais();
      }
      menuEstilo.hidden = !abrir;
    });

    const acaoDividirRange = (range, editable) => {
      if (!range || !editable) return;
      const rangeAntes = range.cloneRange();
      rangeAntes.selectNodeContents(editable);
      rangeAntes.setEnd(range.startContainer, range.startOffset);
      const divAntes = document.createElement('div');
      divAntes.appendChild(rangeAntes.cloneContents());

      const rangeDepois = range.cloneRange();
      rangeDepois.selectNodeContents(editable);
      rangeDepois.setStart(range.endContainer, range.endOffset);
      const divDepois = document.createElement('div');
      divDepois.appendChild(rangeDepois.cloneContents());

      // o bloco a dividir é o que contém o cursor (o selecionado no painel pode ser outro, se o foco veio por teclado ou por outro caminho)
      const bId = editable.closest('[data-bloco-id]')?.dataset.blocoId || this.blocoSelecionado?.id;
      if (bId) {
        this.dividirBlocoAtual(bId, { textoAntes: removerPalavrasIniciais(divAntes.innerHTML), textoDepois: removerPalavrasIniciais(divDepois.innerHTML) });
      }
    };

    barra.querySelector('#athBtnContextDividir')?.addEventListener('mousedown', e => {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum.nodeType === Node.ELEMENT_NODE ? comum : comum.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      acaoDividirRange(range, editable);
    });

    pillCaret.querySelector('#athBtnPillDividir')?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum.nodeType === Node.ELEMENT_NODE ? comum : comum.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      pillCaret.style.display = 'none';
      acaoDividirRange(range, editable);
    });

    pillCaret.querySelector('#athBtnPillCitar')?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      pillCaret.style.display = 'none';
      this.abrirPainelZotero();
    });

    barra.querySelector('#athBtnContextCitar').addEventListener('mousedown', e => {
      e.preventDefault();
      this.abrirPainelZotero();
    });

    // Área em que o texto está visível: a barra e a pílula só aparecem quando a seleção está à vista (nunca por cima da faixa de ferramentas)
    const areaVisivel = () => {
      const r = this.container?.querySelector('#rmPrevPalco')?.getBoundingClientRect();
      return r && r.width ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : { top: 56, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    };
    const estaVisivel = (rect) => { const a = areaVisivel(); return rect.bottom > a.top + 4 && rect.top < a.bottom - 4; };

    // Posiciona a barra junto da seleção: acima dela; sem espaço em cima (início da área), abaixo. Devolve false se a seleção saiu da área visível.
    const posicionarBarra = (rect) => {
      if (!estaVisivel(rect)) { barra.style.display = 'none'; return false; }
      const area = areaVisivel();
      barra.style.display = 'flex';
      const larg = barra.offsetWidth || 420;
      const centro = rect.left + rect.width / 2;
      barra.style.left = `${Math.max(area.left + larg / 2 + 8, Math.min(area.right - larg / 2 - 8, centro))}px`;
      if (rect.top - (barra.offsetHeight || 40) - 12 < area.top) {
        barra.style.top = `${Math.min(rect.bottom, area.bottom - 50)}px`;
        barra.style.transform = 'translate(-50%, 0)';
        barra.style.marginTop = '8px';
      } else {
        barra.style.top = `${rect.top}px`;
        barra.style.transform = 'translate(-50%, -100%)';
        barra.style.marginTop = '-8px';
      }
      return true;
    };

    // Monitora seleção de texto e posição do cursor
    const atualizarPosicaoBarra = () => {
      // Se houver qualquer modal aberto na tela, oculta barra contextual e pill flutuante
      if (document.querySelector('.ath-modal-backdrop') || document.querySelector('.ath-modal')) {
        barra.style.display = 'none';
        fecharDropdownsCtx();
        if (pillCaret) pillCaret.style.display = 'none';
        return;
      }
      // Com um menu da barra aberto ela não some, mas continua junto do texto (rolagem, redimensionamento, repaginação)
      if (menuEstilo && !menuEstilo.hidden) {
        const r = this._ultimaSelecaoAtiva?.range;
        const rectSel = r && r.commonAncestorContainer?.isConnected ? r.getBoundingClientRect() : null;
        if (rectSel && rectSel.height > 0 && !posicionarBarra(rectSel)) fecharDropdownsCtx(); // saiu da área visível: fecha o menu junto
        return;
      }

      // Se o foco está dentro de um elemento interativo da própria barra, mantém aberta
      if (document.activeElement && barra.contains(document.activeElement)) {
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        barra.style.display = 'none';
        fecharDropdownsCtx();
        if (pillCaret) pillCaret.style.display = 'none';
        return;
      }

      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum.nodeType === Node.ELEMENT_NODE ? comum : comum.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');

      // Seleção que atravessa vários blocos de texto: oferece unir
      if (!sel.isCollapsed && !editable && this.container?.contains(comum)) {
        const ids = blocosDaSelecao(range);
        const rectU = range.getBoundingClientRect();
        if (ids.length >= 2 && rectU.height > 0 && estaVisivel(rectU)) {
          barra.style.display = 'none';
          if (pillCaret) pillCaret.style.display = 'none';
          this._idsParaUnir = ids;
          const area = areaVisivel();
          pillUnir.querySelector('#athRotuloUnir').textContent = `Unir ${ids.length} blocos`;
          pillUnir.style.display = 'flex';
          pillUnir.style.left = `${Math.max(area.left + 150, Math.min(area.right - 150, rectU.left + rectU.width / 2))}px`;
          pillUnir.style.top = `${rectU.top}px`;
          pillUnir.style.transform = 'translate(-50%, -100%)';
          pillUnir.style.marginTop = '-10px';
          return;
        }
      }
      pillUnir.style.display = 'none';

      if (!editable) {
        barra.style.display = 'none';
        fecharDropdownsCtx();
        if (pillCaret) pillCaret.style.display = 'none';
        return;
      }

      // Se há texto selecionado, exibe a barra completa com formatação e botão de dividir
      if (!sel.isCollapsed && sel.toString().trim()) {
        if (pillCaret) pillCaret.style.display = 'none';
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (!posicionarBarra(rect)) return; // seleção rolada para fora da área do texto

          // Salva última seleção ativa para aplicar estilos pontuais mesmo com perda temporária de foco
          const blocoEl = editable?.closest('[data-bloco-id]');
          const blocoId = blocoEl?.dataset?.blocoId || this.blocoSelecionado?.id;
          this._ultimaSelecaoAtiva = {
            range: range.cloneRange(),
            texto: sel.toString(),
            blocoId: blocoId,
            editable: editable
          };
          if (!this.blocoSelecionado && blocoId) {
            this.blocoSelecionado = (this.doc.secoes || []).flatMap(s => s.blocos || []).find(b => b.id === blocoId) || null;
          }

          // Reflete o estilo ativo do trecho ou do bloco
          const rotuloEstiloEl = barra.querySelector('#athRotuloCtxEstilo');
          if (rotuloEstiloEl) {
            const spanEst = elPai.closest('.ath-estilo-span');
            const idAtivo = spanEst?.dataset.estiloId || this.blocoSelecionado?.estiloId;
            const estAtual = (this.doc.estilos || []).find(x => x.id === idAtivo);
            rotuloEstiloEl.textContent = estAtual ? estAtual.nome : 'Estilo';
          }

          return;
        }
      }

      // Se é apenas o cursor posicionado no texto (sem seleção), exibe a pílula [Dividir Bloco Aqui] [Citar Zotero]
      barra.style.display = 'none';
      if (sel.isCollapsed && editable) {
        let r = null;
        const rects = range.getClientRects();
        if (rects.length > 0) {
          r = rects[0];
        } else {
          r = editable.getBoundingClientRect();
        }
        if (r && !estaVisivel(r)) { if (pillCaret) pillCaret.style.display = 'none'; return; }
        if (r && pillCaret) {
          pillCaret.style.display = 'flex';
          const area = areaVisivel();
          const left = Math.max(area.left + 140, Math.min(area.right - 140, r.left + (r.width || 0) / 2));
          pillCaret.style.left = `${left}px`;
          if (r.top - 50 < area.top) {
            pillCaret.style.top = `${r.bottom}px`;
            pillCaret.style.transform = 'translate(-50%, 0)';
            pillCaret.style.marginTop = '8px';
          } else {
            pillCaret.style.top = `${r.top}px`;
            pillCaret.style.transform = 'translate(-50%, -100%)';
            pillCaret.style.marginTop = '-10px';
          }
        }
      } else if (pillCaret) {
        pillCaret.style.display = 'none';
      }
    };

    document.addEventListener('selectionchange', atualizarPosicaoBarra);
    document.addEventListener('click', (e) => {
      if (barra && !barra.contains(e.target)) {
        fecharDropdownsCtx();
      }
      setTimeout(atualizarPosicaoBarra, 50);
    });
    document.addEventListener('keyup', () => setTimeout(atualizarPosicaoBarra, 50));
    window.addEventListener('scroll', atualizarPosicaoBarra, true);
    window.addEventListener('resize', atualizarPosicaoBarra);
    // a folha é redesenhada (marcadores, estilos, repaginação, zoom): a barra reencontra a seleção e segue o texto
    let quadro = 0;
    const seguirTexto = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(atualizarPosicaoBarra); };
    if (typeof MutationObserver !== 'undefined' && this.container) new MutationObserver(seguirTexto).observe(this.container, { childList: true, subtree: true });
  },

  aplicarEstiloNoTextoSelecionado(estiloId, barraEl = null) {
    if (!estiloId) return;
    const estilo = (this.doc.estilos || []).find(x => x.id === estiloId);
    if (!estilo) return;

    // Recupera a seleção ativa
    const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
    let range = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.toString().trim()) {
      range = sel.getRangeAt(0);
    } else if (this._ultimaSelecaoAtiva?.range && !this._ultimaSelecaoAtiva.range.collapsed && this._ultimaSelecaoAtiva.texto?.trim()) {
      range = this._ultimaSelecaoAtiva.range;
    }

    // Localiza o bloco correspondente
    let blocoId = this._ultimaSelecaoAtiva?.blocoId || this.blocoSelecionado?.id;
    let editable = this._ultimaSelecaoAtiva?.editable;

    if (range && !editable && typeof Node !== 'undefined') {
      const comum = range.commonAncestorContainer;
      const elPai = comum?.nodeType === Node.ELEMENT_NODE ? comum : comum?.parentElement;
      editable = elPai?.closest?.('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      const blocoEl = editable?.closest?.('[data-bloco-id]');
      if (blocoEl?.dataset?.blocoId) blocoId = blocoEl.dataset.blocoId;
    }

    let bloco = (this.doc.secoes || []).flatMap(s => s.blocos || []).find(b => b.id === blocoId) || this.blocoSelecionado;
    if (!this.blocoSelecionado && bloco) {
      this.blocoSelecionado = bloco;
    }

    // Propriedades tipográficas do estilo para aplicação inline
    const f = FONTES_SISTEMA[estilo.fonte] || FONTES_SISTEMA.nunito;
    const familiaCss = f.familia || 'sans-serif';
    const inlineProps = [
      `font-family: ${familiaCss}`,
      `font-size: ${estilo.tamanho_pt || 12}pt`,
      `font-weight: ${estilo.peso || 400}`,
      `color: ${estilo.cor || '#1F2733'}`
    ];
    if (estilo.italico) inlineProps.push('font-style: italic');
    else inlineProps.push('font-style: normal');
    if (estilo.sublinhado) inlineProps.push('text-decoration: underline');
    if (estilo.caixa_alta) inlineProps.push('text-transform: uppercase');
    if (estilo.espacamento_letras_em) inlineProps.push(`letter-spacing: ${estilo.espacamento_letras_em}em`);
    if (estilo.entrelinha) inlineProps.push(`line-height: ${estilo.entrelinha}`);
    const inlineCss = inlineProps.join('; ');

    // Se temos um trecho específico selecionado
    if (range && editable && !range.collapsed && range.toString().trim()) {
      try {
        const textoSel = range.toString().trim();
        const textoBloco = (editable.textContent || '').trim();

        // Se a seleção cobrir o bloco inteiro, aplica ao bloco todo
        if (textoSel.length > 0 && textoSel === textoBloco && bloco) {
          bloco.estiloId = estilo.id;
          if (estilo.tipo === 'titulo' || estilo.id.startsWith('titulo')) {
            bloco.tipo = 'titulo';
            bloco.nivel = (estilo.id === 'titulo1' || estilo.id === 'titulo_1') ? 1 : (estilo.id === 'titulo2' || estilo.id === 'titulo_2') ? 2 : 3;
          }
          this.notificarMudanca();
          this.renderizar();
        } else {
          // Aplica na parte selecionada (inline)
          const comum = range.commonAncestorContainer;
          const elPai = comum?.nodeType === Node.ELEMENT_NODE ? comum : comum?.parentElement;
          const spanExistente = elPai?.closest?.('.ath-estilo-span');

          if (spanExistente && spanExistente.textContent.trim() === textoSel) {
            spanExistente.dataset.estiloId = estilo.id;
            spanExistente.dataset.estiloNome = estilo.nome;
            spanExistente.style.cssText = inlineCss; // só exibição: ao salvar, o HTML guarda apenas o id do estilo
          } else {
            const fragment = range.extractContents();
            const span = document.createElement('span');
            span.className = 'ath-estilo-span';
            span.dataset.estiloId = estilo.id;
            span.dataset.estiloNome = estilo.nome;
            span.style.cssText = inlineCss;
            span.appendChild(fragment);
            range.insertNode(span);

            if (sel && typeof document !== 'undefined') {
              sel.removeAllRanges();
              const novoRange = document.createRange();
              novoRange.selectNodeContents(span);
              sel.addRange(novoRange);
            }
          }

          if (bloco && editable) {
            bloco.texto = sanearHtmlTexto(editable.innerHTML);
            try { this.onSelecionarBloco(bloco, null); } catch (_) {} // o painel passa a listar os estilos do texto
          }
        }
      } catch (err) {
        console.warn('[Athenes] Falha ao envelopar trecho com estilo:', err);
        if (bloco) bloco.estiloId = estilo.id;
      }
    } else if (bloco) {
      // Sem seleção de trecho, aplica ao bloco inteiro
      bloco.estiloId = estilo.id;
      if (estilo.tipo === 'titulo' || estilo.id.startsWith('titulo')) {
        bloco.tipo = 'titulo';
        bloco.nivel = (estilo.id === 'titulo1' || estilo.id === 'titulo_1') ? 1 : (estilo.id === 'titulo2' || estilo.id === 'titulo_2') ? 2 : 3;
      }
      this.renderizar();
    }

    const barra = barraEl || (typeof document !== 'undefined' ? document.getElementById('athBarraContextoTexto') : null);
    if (barra) {
      const rotuloEl = barra.querySelector('#athRotuloCtxEstilo');
      if (rotuloEl) rotuloEl.textContent = estilo.nome;
      const menuEst = barra.querySelector('#athMenuContextEstilo');
      if (menuEst) menuEst.hidden = true;
    }

    if (bloco) {
      this.sessaoRealtime?.transmitirAtualizacaoBloco(bloco);
      this.notificarMudanca();
      this.notificarMudancaRapida();
    }
  }
};
