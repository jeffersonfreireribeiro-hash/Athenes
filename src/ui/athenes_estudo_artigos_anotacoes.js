// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Artigos: notas adesivas, seleção de texto e tinta à mão livre.
 * Métodos do EstudoArtigosView (usam `this`); são acrescentados ao prototype em athenes_estudo_artigos.js.
 */
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { salvarArtigosEstudo, salvarArtigosEstudoDebounced, formatarCitacaoAbntDoArtigo, calcularPontoFinalLinhaReta } from './athenes_estudo_artigos_dados.js';

export const metodosEstudoAnotacoes = {
  renderizarPinsDaPagina(layerEl, art, numPag, root) {
    if (!layerEl) return;
    layerEl.innerHTML = '';

    const pins = art.fichamento.notasPagina?.[numPag] || [];
    const coresNota = ['#F59E0B', '#314F79', '#059669', '#DC2626', '#7C3AED', '#0284C7'];

    pins.forEach((pin, idx) => {
      const estaEditando = this.pinEditandoId === pin.id;
      const estaMinimizado = Boolean(pin.minimizado) && !estaEditando;
      const ehCompacta = pin.tamanho === 'pequena' && !estaEditando;

      // Impede que a nota ultrapasse a borda direita da página (794px)
      const larguraCardPx = estaEditando ? 276 : (estaMinimizado ? 150 : (ehCompacta ? 168 : 220));
      const xSeguroPct = Math.max(2, Math.min(96, pin.xPct ?? 55));
      const ySeguroPct = Math.max(2, Math.min(90, pin.yPct ?? 25));

      const card = document.createElement('div');
      card.className = [
        'ath-pdf-pin-balao',
        estaEditando ? 'editando' : '',
        estaMinimizado ? 'minimizado' : '',
        ehCompacta ? 'compacto' : ''
      ].filter(Boolean).join(' ');

      card.style.left = `min(${xSeguroPct}%, calc(100% - ${larguraCardPx + 12}px))`;
      card.style.top = `${ySeguroPct}%`;
      card.style.borderColor = pin.cor || '#F59E0B';
      card.dataset.pinId = pin.id;

      if (estaEditando) {
        card.innerHTML = `
          <div class="ath-pdf-pin-cab ath-pin-arrastavel" style="background:${escapeHtml(pin.cor || '#F59E0B')};">
            <span class="ath-pin-cab-titulo">${svgIcone('nota', 12)} Nota #${idx + 1} (Pág. ${numPag})</span>
            <div class="ath-pin-cab-acoes">
              <button type="button" class="ath-pin-edit-btn" data-min-edicao-pin="${escapeHtml(pin.id)}" title="Minimizar nota na folha">${svgIcone('minimizar', 11)}</button>
              <button type="button" class="ath-pin-del" data-fechar-edicao-pin="${escapeHtml(pin.id)}" title="Concluir edição">${svgIcone('fechar', 11)}</button>
            </div>
          </div>
          <div class="ath-pdf-pin-form">
            <input type="text" class="ath-pin-input-titulo" value="${escapeHtml(pin.titulo || '')}" placeholder="Título da nota...">
            <textarea class="ath-pin-textarea" rows="3" placeholder="Escreva sua anotação, crítica ou lembrete aqui...">${escapeHtml(pin.texto || '')}</textarea>
            <div class="ath-pin-form-rodape">
              <div class="ath-pin-cores">
                ${coresNota.map(c => `
                  <button type="button" class="ath-pin-cor-dot ${(pin.cor || '#F59E0B') === c ? 'on' : ''}" data-cor-pin="${c}" style="background:${c};" title="Cor ${c}"></button>
                `).join('')}
              </div>
              <div class="ath-pin-botoes">
                <button type="button" class="ath-pin-ic-acao ath-pin-ic-neutro" data-tam-pin="${escapeHtml(pin.id)}" title="Alternar largura (${pin.tamanho === 'pequena' ? 'Compacta -> Normal' : 'Normal -> Compacta'})">
                  ${svgIcone('redimensionar', 12)}
                </button>
                <button type="button" class="ath-pin-ic-acao ath-pin-ic-perigo" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">
                  ${svgIcone('lixeira', 12)}
                </button>
                <button type="button" class="ath-pin-ic-acao ath-pin-ic-primario" data-salvar-pin="${escapeHtml(pin.id)}" title="Salvar nota">
                  ${svgIcone('check', 13)}
                </button>
              </div>
            </div>
          </div>
        `;

        const inputTit = card.querySelector('.ath-pin-input-titulo');
        const txtArea = card.querySelector('.ath-pin-textarea');

        card.querySelectorAll('[data-cor-pin]').forEach(dot => {
          dot.addEventListener('click', e => {
            e.stopPropagation();
            pin.titulo = inputTit.value.trim() || pin.titulo;
            pin.texto = txtArea.value.trim() || pin.texto;
            pin.cor = dot.dataset.corPin;
            salvarArtigosEstudo(this.artigos);
            this.renderizarPinsDaPagina(layerEl, art, numPag, root);
            this.atualizarPaineisLateraisDeNotas(root, art);
          });
        });

        card.querySelector('[data-tam-pin]').addEventListener('click', e => {
          e.stopPropagation();
          pin.titulo = inputTit.value.trim() || pin.titulo;
          pin.texto = txtArea.value.trim() || pin.texto;
          pin.tamanho = pin.tamanho === 'pequena' ? 'normal' : 'pequena';
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
        });

        const salvarEdicaoPin = (minimizarAoSalvar = false) => {
          pin.titulo = inputTit.value.trim() || 'Nota';
          pin.texto = txtArea.value.trim() || 'Anotação na página';
          if (minimizarAoSalvar) pin.minimizado = true;
          this.pinEditandoId = null;
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        };

        card.querySelector('[data-salvar-pin]').addEventListener('click', e => {
          e.stopPropagation();
          salvarEdicaoPin(false);
        });

        card.querySelector('[data-fechar-edicao-pin]').addEventListener('click', e => {
          e.stopPropagation();
          salvarEdicaoPin(false);
        });

        card.querySelector('[data-min-edicao-pin]').addEventListener('click', e => {
          e.stopPropagation();
          salvarEdicaoPin(true);
        });

        card.querySelector('[data-del-pin]').addEventListener('click', e => {
          e.stopPropagation();
          art.fichamento.notasPagina[numPag] = pins.filter(p => p.id !== pin.id);
          this.pinEditandoId = null;
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });

        setTimeout(() => txtArea?.focus(), 20);
      } else if (estaMinimizado) {
        // Modo Minimizado: pílula compacta que não cobre o texto do PDF
        card.innerHTML = `
          <div class="ath-pdf-pin-cab ath-pin-arrastavel" style="background:${escapeHtml(pin.cor || '#F59E0B')};" title="${escapeHtml(pin.texto || 'Clique para expandir esta nota')}">
            <span class="ath-pin-cab-titulo" data-expandir-pin="${escapeHtml(pin.id)}">${svgIcone('nota', 11)} #${idx + 1} ${escapeHtml(pin.titulo || 'Nota')}</span>
            <div class="ath-pin-cab-acoes">
              <button type="button" class="ath-pin-edit-btn" data-expandir-pin="${escapeHtml(pin.id)}" title="Expandir nota">${svgIcone('mais', 11)}</button>
              <button type="button" class="ath-pin-del" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">${svgIcone('fechar', 11)}</button>
            </div>
          </div>
        `;

        card.querySelectorAll('[data-expandir-pin]').forEach(el => {
          el.addEventListener('click', e => {
            e.stopPropagation();
            pin.minimizado = false;
            salvarArtigosEstudo(this.artigos);
            this.renderizarPinsDaPagina(layerEl, art, numPag, root);
            this.atualizarPaineisLateraisDeNotas(root, art);
          });
        });

        card.querySelector('[data-del-pin]').addEventListener('click', e => {
          e.stopPropagation();
          art.fichamento.notasPagina[numPag] = pins.filter(p => p.id !== pin.id);
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });
      } else {
        card.innerHTML = `
          <div class="ath-pdf-pin-cab ath-pin-arrastavel" style="background:${escapeHtml(pin.cor || '#F59E0B')};" title="Arraste para mover ou clique nos ícones para redimensionar/editar">
            <span class="ath-pin-cab-titulo">${svgIcone('nota', 11)} #${idx + 1} · ${escapeHtml(pin.titulo || 'Nota')}</span>
            <div class="ath-pin-cab-acoes">
              <button type="button" class="ath-pin-edit-btn" data-tam-rapido-pin="${escapeHtml(pin.id)}" title="Alternar largura (${pin.tamanho === 'pequena' ? 'Compacta -> Normal' : 'Normal -> Compacta'})">${svgIcone('redimensionar', 10)}</button>
              <button type="button" class="ath-pin-edit-btn" data-minimizar-pin="${escapeHtml(pin.id)}" title="Minimizar nota em pílula">${svgIcone('minimizar', 11)}</button>
              <button type="button" class="ath-pin-edit-btn" data-abrir-edicao-pin="${escapeHtml(pin.id)}" title="Editar esta nota">${svgIcone('lapis', 10)}</button>
              <button type="button" class="ath-pin-del" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">${svgIcone('fechar', 11)}</button>
            </div>
          </div>
          <div class="ath-pdf-pin-txt" data-abrir-edicao-pin="${escapeHtml(pin.id)}" title="Clique para editar o texto desta nota">
            ${escapeHtml(pin.texto || 'Clique para escrever na nota...')}
          </div>
        `;

        card.querySelectorAll('[data-abrir-edicao-pin]').forEach(el => {
          el.addEventListener('click', e => {
            e.stopPropagation();
            this.pinEditandoId = pin.id;
            this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          });
        });

        card.querySelector('[data-minimizar-pin]').addEventListener('click', e => {
          e.stopPropagation();
          pin.minimizado = true;
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });

        card.querySelector('[data-tam-rapido-pin]').addEventListener('click', e => {
          e.stopPropagation();
          pin.tamanho = pin.tamanho === 'pequena' ? 'normal' : 'pequena';
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
        });

        card.querySelector('[data-del-pin]').addEventListener('click', e => {
          e.stopPropagation();
          art.fichamento.notasPagina[numPag] = pins.filter(p => p.id !== pin.id);
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });
      }

      // Permite arrastar o cabeçalho do balão de nota para reposicionar na página em qualquer estado
      const cab = card.querySelector('.ath-pin-arrastavel');
      if (cab) {
        cab.addEventListener('pointerdown', ev => {
          if (ev.target.closest('button')) return;
          ev.stopPropagation();
          const rectLayer = layerEl.getBoundingClientRect();
          const startX = ev.clientX;
          const startY = ev.clientY;
          const origXPct = pin.xPct ?? 55;
          const origYPct = pin.yPct ?? 25;
          let moveu = false;

          const onMove = (mev) => {
            const dx = mev.clientX - startX;
            const dy = mev.clientY - startY;
            if (Math.hypot(dx, dy) > 4) moveu = true;
            pin.xPct = Math.max(2, Math.min(72, Math.round(origXPct + (dx / rectLayer.width) * 100)));
            pin.yPct = Math.max(2, Math.min(88, Math.round(origYPct + (dy / rectLayer.height) * 100)));
            card.style.left = `min(${pin.xPct}%, calc(100% - ${larguraCardPx + 12}px))`;
            card.style.top = `${pin.yPct}%`;
          };

          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (moveu) {
              salvarArtigosEstudo(this.artigos);
            } else if (!estaEditando) {
              if (estaMinimizado) {
                pin.minimizado = false;
                salvarArtigosEstudo(this.artigos);
              } else {
                this.pinEditandoId = pin.id;
              }
              this.renderizarPinsDaPagina(layerEl, art, numPag, root);
              this.atualizarPaineisLateraisDeNotas(root, art);
            }
          };

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      }

      layerEl.appendChild(card);
    });
  },

  configurarSelecaoTextoInterativa(root, art, paginasPdf) {
    const palco = root.querySelector('#athEstudioPalco');
    const popSel = root.querySelector('#athPdfSelecaoPopover');
    if (!palco || !popSel) return;

    popSel.hidden = true;
    let ultimaSelecao = null; // { texto, numPag, range, folhaTextoEl }

    const verificarSelecaoTexto = () => {
      // Não exibe pílula flutuante se houver modal aberto na tela
      if (document.querySelector('.ath-modal-backdrop')) {
        popSel.hidden = true;
        return;
      }
      const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        popSel.hidden = true;
        return;
      }
      const texto = sel.toString().replace(/\s+/g, ' ').trim();
      if (texto.length < 2) {
        popSel.hidden = true;
        return;
      }

      const range = sel.getRangeAt(0);
      const containerEl = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      const folhaTextoEl = containerEl?.closest?.('.ath-pdf-folha-texto');
      if (!folhaTextoEl) {
        popSel.hidden = true;
        return;
      }

      const numPag = parseInt(folhaTextoEl.dataset.textoPag, 10) || 1;
      const folhaContainer = folhaTextoEl.closest('.ath-pdf-folha-container');
      const pagCitacao = folhaContainer?.dataset?.pagEditorial || String(numPag);
      this.definirPaginaAtivaSilencioso(numPag, root);
      ultimaSelecao = {
        texto,
        numPag,
        pagCitacao,
        range: range.cloneRange(),
        folhaTextoEl
      };

      const rectSel = range.getBoundingClientRect();
      const top = Math.max(12, rectSel.top - 48);
      const left = Math.max(180, Math.min(window.innerWidth - 180, rectSel.left + (rectSel.width / 2)));

      popSel.style.top = `${Math.round(top)}px`;
      popSel.style.left = `${Math.round(left)}px`;
      popSel.hidden = false;
    };

    let prevRange = null;
    let isPointerDown = false;

    const resetEndOfContent = (end, textLayer) => {
      if (end && textLayer) {
        textLayer.append(end);
        end.style.width = '';
        end.style.height = '';
        textLayer.classList.remove('selecting');
      }
    };

    const encerrarModoSelecting = () => {
      isPointerDown = false;
      root.querySelectorAll('.ath-pdf-text-layer').forEach(layer => {
        const end = layer.querySelector('.endOfContent');
        if (end) resetEndOfContent(end, layer);
      });
    };

    palco.addEventListener('mouseup', () => {
      encerrarModoSelecting();
      setTimeout(verificarSelecaoTexto, 20);
    });
    palco.addEventListener('keyup', () => {
      if (!isPointerDown) encerrarModoSelecting();
      setTimeout(verificarSelecaoTexto, 20);
    });
    palco.addEventListener('scroll', () => { popSel.hidden = true; }, { passive: true });
    palco.addEventListener('pointerdown', (e) => {
      isPointerDown = true;
      if (!e.target.closest('#athPdfSelecaoPopover')) {
        popSel.hidden = true;
      }
      const layer = e.target.closest('.ath-pdf-text-layer');
      if (layer) {
        layer.classList.add('selecting');
      }
    });

    window.addEventListener('blur', encerrarModoSelecting);

    if (this._selectionChangeHandler) {
      document.removeEventListener('selectionchange', this._selectionChangeHandler);
      this._selectionChangeHandler = null;
    }

    this._selectionChangeHandler = () => {
      const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        if (!isPointerDown) {
          encerrarModoSelecting();
        }
        return;
      }

      const activeLayers = new Set();
      for (let i = 0; i < selection.rangeCount; i++) {
        const r = selection.getRangeAt(i);
        root.querySelectorAll('.ath-pdf-text-layer').forEach(layer => {
          if (!activeLayers.has(layer) && r.intersectsNode(layer)) {
            activeLayers.add(layer);
          }
        });
      }

      root.querySelectorAll('.ath-pdf-text-layer').forEach(layer => {
        const end = layer.querySelector('.endOfContent');
        if (activeLayers.has(layer)) {
          layer.classList.add('selecting');
        } else if (end) {
          resetEndOfContent(end, layer);
        }
      });

      const range = selection.getRangeAt(0);
      const modifyStart = prevRange && (
        range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
        range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0
      );
      let anchor = modifyStart ? range.startContainer : range.endContainer;
      if (anchor && anchor.nodeType === 3) {
        anchor = anchor.parentNode;
      }
      const parentLayer = anchor?.closest?.('.ath-pdf-text-layer');
      const endDiv = parentLayer?.querySelector?.('.endOfContent');
      if (endDiv && anchor && anchor.parentElement === parentLayer) {
        endDiv.style.width = '100%';
        endDiv.style.height = '100%';
        parentLayer.insertBefore(endDiv, modifyStart ? anchor : anchor.nextSibling);
      }
      prevRange = range.cloneRange();
    };

    document.addEventListener('selectionchange', this._selectionChangeHandler);

    const extrairCorRgbaGrifo = (cor, alpha = 0.42) => {
      if (!cor) return `rgba(250, 204, 21, ${alpha})`;
      if (cor.startsWith('rgba')) return cor;
      let c = cor.replace('#', '');
      if (c.length === 3) c = c.split('').map(x => x + x).join('');
      if (c.length >= 6) {
        const r = parseInt(c.slice(0, 2), 16) || 250;
        const g = parseInt(c.slice(2, 4), 16) || 204;
        const b = parseInt(c.slice(4, 6), 16) || 21;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return `rgba(250, 204, 21, ${alpha})`;
    };

    const executarGrifoNoTrecho = (corEscolhida) => {
      if (!ultimaSelecao) return;
      const { numPag, range, folhaTextoEl } = ultimaSelecao;
      const folhaContainer = folhaTextoEl.closest('.ath-pdf-folha-container');
      const ehPdfReal = folhaTextoEl.classList.contains('ath-pdf-text-layer');
      const corGrifo = extrairCorRgbaGrifo(corEscolhida || this.corGrifoAtiva || this.corTinta);

      if (ehPdfReal && folhaContainer) {
        const rectFolha = folhaContainer.getBoundingClientRect();
        const rects = Array.from(range.getClientRects()).filter(r => r.width > 1 && r.height > 1);
        if (!art.fichamento.grifosPorPagina) art.fichamento.grifosPorPagina = {};
        if (!Array.isArray(art.fichamento.grifosPorPagina[numPag])) {
          art.fichamento.grifosPorPagina[numPag] = [];
        }
        rects.forEach(r => {
          art.fichamento.grifosPorPagina[numPag].push({
            xPct: Number((((r.left - rectFolha.left) / rectFolha.width) * 100).toFixed(2)),
            yPct: Number((((r.top - rectFolha.top) / rectFolha.height) * 100).toFixed(2)),
            wPct: Number(((r.width / rectFolha.width) * 100).toFixed(2)),
            hPct: Number(((r.height / rectFolha.height) * 100).toFixed(2)),
            cor: corGrifo
          });
        });
        this.renderizarGrifosRetangularesDaPagina(
          folhaContainer.querySelector(`[data-grifos-pag="${numPag}"]`),
          art,
          numPag
        );
        salvarArtigosEstudo(this.artigos);
      } else {
        try {
          const mark = document.createElement('mark');
          mark.className = 'ath-pdf-grifo-texto';
          mark.style.backgroundColor = corGrifo;
          try {
            range.surroundContents(mark);
          } catch (_) {
            const fragment = range.extractContents();
            mark.appendChild(fragment);
            range.insertNode(mark);
          }
          const colEl = folhaTextoEl.querySelector(`[data-colunas-pag="${numPag}"]`) || folhaTextoEl;
          if (colEl && paginasPdf?.[numPag - 1]) {
            paginasPdf[numPag - 1].htmlGrifado = colEl.innerHTML;
            if (art.conteudoPaginasPdf?.[numPag - 1]) {
              art.conteudoPaginasPdf[numPag - 1].htmlGrifado = colEl.innerHTML;
            }
            salvarArtigosEstudo(this.artigos);
          }
        } catch (_) {}
      }
      window.getSelection()?.removeAllRanges();
      popSel.hidden = true;
    };

    // Cliques nos chips de cores no popover de seleção
    popSel.querySelectorAll('[data-sel-cor]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.corGrifoAtiva = chip.dataset.selCor;
        popSel.querySelectorAll('[data-sel-cor]').forEach(c => c.classList.toggle('on', c === chip));
        const dot = popSel.querySelector('#athSelCorDotAtivo');
        if (dot) dot.style.background = this.corGrifoAtiva;
        executarGrifoNoTrecho(this.corGrifoAtiva);
      });
    });

    // 1. Grifar Trecho no Texto com a cor ativa
    popSel.querySelector('#athSelBtnGrifar').addEventListener('click', (e) => {
      e.stopPropagation();
      executarGrifoNoTrecho(this.corGrifoAtiva);
    });

    // 2. + Citação Zotero (abre modal elegante preenchido com o trecho e a página)
    popSel.querySelector('#athSelBtnCitar').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const { texto, numPag, pagCitacao } = ultimaSelecao;
      popSel.hidden = true;
      window.getSelection()?.removeAllRanges();
      this.abrirModalCitacaoPdf(art, { pagina: numPag, paginaCitacao: pagCitacao, texto });
    });

    // 3. Criar Nota Adesiva na página com o trecho selecionado
    popSel.querySelector('#athSelBtnNota').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const { texto, numPag } = ultimaSelecao;
      popSel.hidden = true;
      window.getSelection()?.removeAllRanges();
      this.criarNotaAdesivaNaPagina(art, numPag, 58, 28, `"${texto.slice(0, 140)}"`, root);
    });

    // 4. Copiar ABNT direto
    popSel.querySelector('#athSelBtnCopiarAbnt').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const formatada = `"${ultimaSelecao.texto}" ${formatarCitacaoAbntDoArtigo(art, ultimaSelecao.pagCitacao || ultimaSelecao.numPag)}`;
      navigator.clipboard?.writeText(formatada);
      const btn = popSel.querySelector('#athSelBtnCopiarAbnt span');
      if (btn) {
        btn.textContent = 'Copiado ✓';
        setTimeout(() => {
          btn.textContent = 'Copiar ABNT';
          popSel.hidden = true;
        }, 900);
      }
    });
  },

  inicializarCanvasTinta(canvas, art, numPag, root) {
    if (!canvas) return;
    if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
    if (!Array.isArray(art.fichamento.tracosPorPagina[numPag])) {
      art.fichamento.tracosPorPagina[numPag] = [];
    }

    this.redesenharCanvasTinta(canvas, art, numPag);

    let desenhando = false;
    let tracoAtual = null;
    let pontoInicialReta = null;
    let rectCache = null;
    let rafDesenhoPendente = false;

    const agendarRedesenho = () => {
      if (rafDesenhoPendente) return;
      rafDesenhoPendente = true;
      requestAnimationFrame(() => {
        rafDesenhoPendente = false;
        this.redesenharCanvasTinta(canvas, art, numPag);
      });
    };

    const obterPosicaoNoCanvas = (ev) => {
      const rect = rectCache || canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: Math.round((ev.clientX - rect.left) * scaleX),
        y: Math.round((ev.clientY - rect.top) * scaleY),
        xPct: Math.max(0, Math.min(100, Math.round(((ev.clientX - rect.left) / rect.width) * 100))),
        yPct: Math.max(0, Math.min(100, Math.round(((ev.clientY - rect.top) / rect.height) * 100)))
      };
    };

    canvas.addEventListener('pointerdown', (ev) => {
      if (this.ferramentaAtiva === 'cursor') return;
      this.definirPaginaAtivaSilencioso(numPag, root);
      rectCache = canvas.getBoundingClientRect();
      const pos = obterPosicaoNoCanvas(ev);

      // Se a ferramenta for "Nota Adesiva", cria o card editável diretamente no ponto clicado (sem window.prompt)
      if (this.ferramentaAtiva === 'nota') {
        this.criarNotaAdesivaNaPagina(art, numPag, pos.xPct, pos.yPct, '', root);
        return;
      }

      if (this.ferramentaAtiva === 'borracha') {
        desenhando = true;
        canvas.setPointerCapture?.(ev.pointerId);
        const folha = canvas.closest('.ath-pdf-folha-container');
        this.apagarTracosProximos(art, numPag, pos.x, pos.y, 28, pos, folha, ev.clientX, ev.clientY);
        agendarRedesenho();
        return;
      }

      // Caneta ou Marca-texto (livre ou Linha Reta)
      desenhando = true;
      canvas.setPointerCapture?.(ev.pointerId);
      pontoInicialReta = { x: pos.x, y: pos.y };
      tracoAtual = {
        tipo: this.ferramentaAtiva === 'marcatexto' ? 'marcatexto' : 'caneta',
        reta: Boolean(this.modoLinhaReta || ev.shiftKey),
        cor: this.ferramentaAtiva === 'marcatexto' && this.corTinta === '#314F79' ? '#FACC15' : this.corTinta,
        espessura: this.ferramentaAtiva === 'marcatexto' ? 18 : this.espessuraTinta,
        pontos: [{ x: pos.x, y: pos.y }]
      };
      art.fichamento.tracosPorPagina[numPag].push(tracoAtual);
      agendarRedesenho();
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!desenhando) return;
      const pos = obterPosicaoNoCanvas(ev);
      if (this.ferramentaAtiva === 'borracha') {
        const folha = canvas.closest('.ath-pdf-folha-container');
        this.apagarTracosProximos(art, numPag, pos.x, pos.y, 28, pos, folha, ev.clientX, ev.clientY);
        agendarRedesenho();
        return;
      }
      if (!tracoAtual) return;

      // Se Modo Linha Reta estiver ativo ou tecla Shift pressionada, desenha segmento reto com trava ortogonal (0°/90°)
      if (this.modoLinhaReta || ev.shiftKey || tracoAtual.reta) {
        const pFim = calcularPontoFinalLinhaReta(pontoInicialReta, pos, 6);
        tracoAtual.pontos = [
          { x: pontoInicialReta.x, y: pontoInicialReta.y },
          { x: pFim.x, y: pFim.y }
        ];
      } else {
        tracoAtual.pontos.push({ x: pos.x, y: pos.y });
      }
      agendarRedesenho();
    });

    const finalizarTraco = () => {
      if (!desenhando) return;
      desenhando = false;
      tracoAtual = null;
      pontoInicialReta = null;
      rectCache = null;
      this.redesenharCanvasTinta(canvas, art, numPag);
      salvarArtigosEstudoDebounced(this.artigos, 180);
      if (root) {
        this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
      }
    };

    canvas.addEventListener('pointerup', finalizarTraco);
    canvas.addEventListener('pointercancel', finalizarTraco);
  }
};
