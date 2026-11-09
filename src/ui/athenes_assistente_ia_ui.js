// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Interface e Componentes do Assistente de IA de Escrita Científica.
 *
 * Inclui:
 *  1. Motor de Autocompletar Fantasma (GhostTextEngine / Smart Compose) acionado por debounce de inatividade.
 *  2. Painel Flutuante de Co-autoria de IA (PainelFlutuanteIa) para seleção de texto e comando "/ia".
 *  3. Sugestões Não-Destrutivas em Linha (Track Changes / Diff Inline com botões [ ✓ Aceitar ] e [ ✕ Recusar ]).
 *  4. Integração contextual com a Estante de Livros do Athenes e governança estrita de TextStyles.
 */

import {
  ACOES_IA,
  PROMPTS_IA,
  executarCompletudeIa,
  sanearTextoIa,
  limparSpansFantasma
} from '../core/athenes_assistente_ia.js';
import {
  registrarSugestao,
  gerarHtmlMarcacaoSugestao,
  aceitarSugestaoNoDocumento,
  rejeitarSugestaoNoDocumento
} from '../core/athenes_colaboracao.js';
import { abrirCardSugestao } from './athenes_sugestoes_ui.js';

const CSS_IA = `
.ath-ghost-text {
  color: #94A3B8 !important;
  opacity: 0.85;
  pointer-events: none !important;
  user-select: none !important;
  display: inline;
}

.ath-ia-popover {
  position: fixed;
  z-index: 100010;
  width: min(440px, 94vw);
  background: #FFFFFF;
  border: 1px solid #C8D7E6;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(15, 23, 42, 0.08);
  font: 500 12.5px var(--glx-font, system-ui);
  color: #1F2733;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.ath-ia-pop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(135deg, #F8FAFC 0%, #EEF2F6 100%);
  border-bottom: 1px solid #E2E8F0;
}

.ath-ia-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
  font-size: 11.5px;
  color: #6D28D9;
}

.ath-ia-btn-fechar {
  background: transparent;
  border: none;
  font-size: 15px;
  color: #64748B;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.ath-ia-btn-fechar:hover { background: #E2E8F0; color: #0F172A; }

.ath-ia-prompt-box {
  padding: 10px 14px 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ath-ia-input-row {
  display: flex;
  gap: 8px;
}

.ath-ia-input {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  font: inherit;
  font-size: 12.5px;
  outline: none;
  background: #F8FAFC;
  transition: all 0.2s ease;
}
.ath-ia-input:focus {
  background: #FFFFFF;
  border-color: #7C3AED;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.ath-ia-btn-enviar {
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: #7C3AED;
  color: #FFFFFF;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.ath-ia-btn-enviar:hover:not(:disabled) { background: #6D28D9; }
.ath-ia-btn-enviar:disabled { opacity: 0.5; cursor: default; }

.ath-ia-acoes-rapidas {
  display: flex;
  flex-direction: column;
  padding: 4px 8px 8px;
  gap: 2px;
}

.ath-ia-acao-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #334155;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.ath-ia-acao-btn:hover {
  background: #F1F5F9;
  color: #6D28D9;
}

.ath-ia-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #FAF5FF;
  border-top: 1px solid #F3E8FF;
  font-size: 11.5px;
  font-weight: 600;
  color: #7E22CE;
}

.ath-ia-loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #D8B4FE;
  border-top-color: #7E22CE;
  border-radius: 50%;
  animation: ath-spin 0.7s linear infinite;
}

@keyframes ath-spin {
  to { transform: rotate(360deg); }
}

.ath-ia-preview-box {
  padding: 10px 14px;
  background: #FDFBFF;
  border-top: 1px solid #F3E8FF;
  font-size: 12.5px;
  line-height: 1.5;
  color: #1E293B;
  max-height: 180px;
  overflow-y: auto;
}

.ath-ia-preview-acoes {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 14px;
  background: #F8FAFC;
  border-top: 1px solid #E2E8F0;
}

.ath-ia-btn-aceitar-preview {
  height: 30px;
  padding: 0 12px;
  background: #10B981;
  color: #FFFFFF;
  border: none;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}
.ath-ia-btn-aceitar-preview:hover { background: #059669; }

.ath-ia-btn-recusar-preview {
  height: 30px;
  padding: 0 10px;
  background: #F1F5F9;
  color: #475569;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
.ath-ia-btn-recusar-preview:hover { background: #E2E8F0; }
`;

function injetarCssIa() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ath-ia-escrita-css')) return;
  const st = document.createElement('style');
  st.id = 'ath-ia-escrita-css';
  st.textContent = CSS_IA;
  document.head.appendChild(st);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Motor de Autocompletar Fantasma (Ghost Text Engine / Smart Compose)
// ─────────────────────────────────────────────────────────────────────────────

export class GhostTextEngine {
  /**
   * @param {object} editor - Instância do AthenesEditor
   * @param {object} [opcoes={}]
   * @param {number} [opcoes.debounceMs=600] - Pausa de digitação para disparo da sugestão
   * @param {function():Array<object>} [opcoes.obterArtigos] - Função que entrega artigos da estante
   */
  constructor(editor, { debounceMs = 600, obterArtigos = null } = {}) {
    this.editor = editor;
    this.debounceMs = debounceMs;
    this.obterArtigos = obterArtigos || (() => (typeof window !== 'undefined' && window.__athenes_artigos) || []);
    this.timer = null;
    this.requisicaoAtiva = null;
    this.spanAtivo = null;
    this.blocoAtivo = null;
    this.sugestaoAtual = '';

    injetarCssIa();
    this.ligarListeners();
  }

  destruir() {
    this.cancelar();
    this.desligarListeners();
  }

  ligarListeners() {
    if (typeof document === 'undefined') return;
    this._aoInput = (e) => this.tratarInput(e);
    this._aoKeydown = (e) => this.tratarKeydown(e);
    this._aoBlur = () => this.descartar();
    this._aoSelection = () => {
      // Se a seleção mudou para fora do bloco onde está o fantasma, descarta
      if (this.spanAtivo && !document.getSelection()?.containsNode?.(this.spanAtivo, true)) {
        this.descartar();
      }
    };

    document.addEventListener('input', this._aoInput, true);
    document.addEventListener('keydown', this._aoKeydown, true);
    document.addEventListener('selectionchange', this._aoSelection, true);
  }

  desligarListeners() {
    if (typeof document === 'undefined') return;
    if (this._aoInput) document.removeEventListener('input', this._aoInput, true);
    if (this._aoKeydown) document.removeEventListener('keydown', this._aoKeydown, true);
    if (this._aoSelection) document.removeEventListener('selectionchange', this._aoSelection, true);
  }

  tratarInput(e) {
    // Descarta sugestão anterior ao continuar digitando
    if (this.spanAtivo) {
      this.removerSpanFantasma();
    }
    this.cancelarTimer();

    const target = e.target;
    if (!target || !target.isContentEditable) return;
    const blocoEl = target.closest?.('[data-bloco-id]');
    if (!blocoEl) return;

    this.timer = setTimeout(() => {
      this.dispararPredicao(blocoEl);
    }, this.debounceMs);
  }

  tratarKeydown(e) {
    if (!this.spanAtivo) return;

    // 1. Tecla TAB: Aceita a sugestão fantasma
    if (e.key === 'Tab' || e.keyCode === 9) {
      e.preventDefault();
      e.stopPropagation();
      this.aceitar();
      return;
    }

    // 2. Tecla ESC: Descarta a sugestão
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      this.descartar();
      return;
    }

    // Qualquer outra tecla remove o span para não misturar com a digitação
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      this.removerSpanFantasma();
    }
  }

  cancelarTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  cancelar() {
    this.cancelarTimer();
    if (this.requisicaoAtiva) {
      this.requisicaoAtiva.cancelar();
      this.requisicaoAtiva = null;
    }
    this.removerSpanFantasma();
  }

  descartar() {
    this.cancelar();
    this.sugestaoAtual = '';
    this.blocoAtivo = null;
  }

  removerSpanFantasma() {
    if (this.spanAtivo) {
      this.spanAtivo.remove();
      this.spanAtivo = null;
    }
  }

  dispararPredicao(blocoEl) {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return; // não sugere sobre seleções

    const blocoId = blocoEl.dataset.blocoId;
    const bloco = this.editor?.buscarBlocoPorId?.(blocoId);
    if (!bloco || !['paragrafo', 'titulo'].includes(bloco.tipo)) return;

    const textoTotal = (blocoEl.textContent || '').replace(/\u200B/g, '');
    if (textoTotal.trim().length < 5) return; // não dispara em parágrafos quase vazios

    this.blocoAtivo = bloco;

    // Extrai contexto da seção ativa e título
    const secaoEl = blocoEl.closest?.('[data-secao-id]');
    const secaoTitulo = secaoEl?.querySelector?.('h2, h1')?.textContent || '';
    const docTitulo = this.editor?.doc?.titulo || 'Documento Científico';
    const artigos = this.obterArtigos();

    this.requisicaoAtiva = executarCompletudeIa({
      acao: ACOES_IA.CONTINUAR,
      contextoPrecedente: textoTotal,
      secaoTitulo,
      docTitulo,
      artigos,
      streaming: false,
      onConcluido: (sugestao) => {
        this.requisicaoAtiva = null;
        if (!sugestao || !sugestao.trim()) return;
        this.renderizarFantasma(sugestao, range);
      }
    });
  }

  renderizarFantasma(sugestao, range) {
    if (!sugestao || typeof document === 'undefined') return;
    this.removerSpanFantasma();

    const span = document.createElement('span');
    span.className = 'ath-ghost-text';
    span.setAttribute('contenteditable', 'false');
    span.setAttribute('aria-hidden', 'true');
    span.textContent = sugestao;

    try {
      range.insertNode(span);
      this.spanAtivo = span;
      this.sugestaoAtual = sugestao;
    } catch (_) {
      this.descartar();
    }
  }

  aceitar() {
    if (!this.spanAtivo || !this.sugestaoAtual) return;
    const span = this.spanAtivo;
    const texto = this.sugestaoAtual;
    const parent = span.parentNode;
    if (!parent) return;

    // Converte o span fantasma em um nó de texto puro, respeitando o styleId do bloco
    const textNode = typeof document !== 'undefined' && typeof document.createTextNode === 'function'
      ? document.createTextNode(texto)
      : { nodeType: 3, textContent: texto, data: texto };
    parent.replaceChild(textNode, span);
    this.spanAtivo = null;
    this.sugestaoAtual = '';

    // Posiciona o cursor ao final do texto inserido
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.createRange === 'function') {
      const sel = window.getSelection();
      if (sel) {
        const novoRange = document.createRange();
        novoRange.setStartAfter(textNode);
        novoRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(novoRange);
      }
    }

    // Dispara evento input para que o editor persista a mudança no modelo
    const evento = typeof Event !== 'undefined'
      ? new Event('input', { bubbles: true, cancelable: true })
      : { type: 'input' };
    parent.dispatchEvent(evento);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Painel Flutuante de Comando de IA (Floating Popover)
// ─────────────────────────────────────────────────────────────────────────────

let painelIaAtivo = null;

export function fecharPainelIa() {
  if (painelIaAtivo) {
    painelIaAtivo.fechar();
    painelIaAtivo = null;
  }
}

export class PainelFlutuanteIa {
  constructor(editor, { ancora = null, trechoInicial = '', obterArtigos = null } = {}) {
    this.editor = editor;
    this.ancora = ancora;
    this.trechoInicial = trechoInicial || '';
    this.obterArtigos = obterArtigos || (() => (typeof window !== 'undefined' && window.__athenes_artigos) || []);
    this.reqAtiva = null;
    this.el = null;

    injetarCssIa();
    this.montar();
  }

  montar() {
    fecharPainelIa();

    const pop = document.createElement('div');
    pop.className = 'ath-ia-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Assistente de IA de Escrita');

    // Header
    const head = document.createElement('div');
    head.className = 'ath-ia-pop-header';
    head.innerHTML = `
      <span class="ath-ia-badge">✨ Assistente de IA · Athenes</span>
      <button type="button" class="ath-ia-btn-fechar" title="Fechar (Esc)">✕</button>
    `;
    head.querySelector('.ath-ia-btn-fechar').addEventListener('click', () => this.fechar());
    pop.appendChild(head);

    // Campo de Prompt Livre
    const boxPrompt = document.createElement('div');
    boxPrompt.className = 'ath-ia-prompt-box';
    boxPrompt.innerHTML = `
      <div class="ath-ia-input-row">
        <input type="text" class="ath-ia-input" placeholder="Peça uma melhoria ou instrução livre… (Enter)">
        <button type="button" class="ath-ia-btn-enviar">Gerar</button>
      </div>
    `;
    const input = boxPrompt.querySelector('.ath-ia-input');
    const btnEnviar = boxPrompt.querySelector('.ath-ia-btn-enviar');

    const dispararLivre = () => {
      const val = input.value.trim();
      if (!val) return;
      this.executarAcao(ACOES_IA.LIVRE, val);
    };

    btnEnviar.addEventListener('click', dispararLivre);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        dispararLivre();
      } else if (ev.key === 'Escape') {
        this.fechar();
      }
      ev.stopPropagation();
    });
    pop.appendChild(boxPrompt);

    // Lista de Ações Rápidas
    const listaAcoes = document.createElement('div');
    listaAcoes.className = 'ath-ia-acoes-rapidas';

    const acoes = [
      { id: ACOES_IA.ACADEMICO, icone: '✨', label: 'Melhorar coesão e tom acadêmico' },
      { id: ACOES_IA.EXPANDIR_BIBLIOGRAFIA, icone: '📚', label: 'Expandir com base na Bibliografia do Athenes' },
      { id: ACOES_IA.ENCURTAR, icone: '📝', label: 'Encurtar e tornar mais objetivo' },
      { id: ACOES_IA.TRADUZIR_INGLES, icone: '🌐', label: 'Traduzir / Reescrever em inglês formal' },
      { id: ACOES_IA.CONTINUAR, icone: '💡', label: 'Continuar escrevendo a partir daqui' }
    ];

    for (const ac of acoes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ath-ia-acao-btn';
      btn.innerHTML = `<span>${ac.icone}</span> <span>${ac.label}</span>`;
      btn.addEventListener('click', () => this.executarAcao(ac.id));
      listaAcoes.appendChild(btn);
    }
    pop.appendChild(listaAcoes);

    // Posicionamento na tela
    document.body.appendChild(pop);
    this.el = pop;
    painelIaAtivo = this;
    this.posicionar();

    // Listeners de clique fora e escape
    this._aoMouseDown = (e) => {
      if (!pop.contains(e.target)) this.fechar();
    };
    this._aoKeyDown = (e) => {
      if (e.key === 'Escape') this.fechar();
    };
    document.addEventListener('mousedown', this._aoMouseDown, true);
    document.addEventListener('keydown', this._aoKeyDown, true);

    setTimeout(() => input.focus(), 40);
  }

  posicionar() {
    if (!this.el) return;
    let r = this.ancora?.getBoundingClientRect?.();
    if (!r) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        r = sel.getRangeAt(0).getBoundingClientRect();
      }
    }
    const w = this.el.offsetWidth || 380;
    const h = this.el.offsetHeight || 260;

    if (r && r.bottom > 0) {
      const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 16));
      let top = r.bottom + 8;
      if (top + h > window.innerHeight - 12) {
        top = Math.max(12, r.top - h - 8);
      }
      this.el.style.left = `${left}px`;
      this.el.style.top = `${top}px`;
    } else {
      this.el.style.left = '50%';
      this.el.style.top = '30%';
      this.el.style.transform = 'translate(-50%, -30%)';
    }
  }

  fechar() {
    if (this.reqAtiva) {
      this.reqAtiva.cancelar();
      this.reqAtiva = null;
    }
    if (this._aoMouseDown) document.removeEventListener('mousedown', this._aoMouseDown, true);
    if (this._aoKeyDown) document.removeEventListener('keydown', this._aoKeyDown, true);
    this.el?.remove();
    this.el = null;
  }

  executarAcao(acao, promptLivre = '') {
    if (!this.el) return;

    // Desativa botões e mostra status de streaming
    const boxPrompt = this.el.querySelector('.ath-ia-prompt-box');
    const listaAcoes = this.el.querySelector('.ath-ia-acoes-rapidas');
    if (boxPrompt) boxPrompt.style.display = 'none';
    if (listaAcoes) listaAcoes.style.display = 'none';

    let statusBar = this.el.querySelector('.ath-ia-status-bar');
    if (!statusBar) {
      statusBar = document.createElement('div');
      statusBar.className = 'ath-ia-status-bar';
      statusBar.innerHTML = `<span class="ath-ia-loading-spinner"></span> <span>Gerando sugestão científica…</span>`;
      this.el.appendChild(statusBar);
    }

    let previewBox = this.el.querySelector('.ath-ia-preview-box');
    if (!previewBox) {
      previewBox = document.createElement('div');
      previewBox.className = 'ath-ia-preview-box';
      this.el.appendChild(previewBox);
    }

    const docTitulo = this.editor?.doc?.titulo || 'Documento Científico';
    const artigos = this.obterArtigos();

    this.reqAtiva = executarCompletudeIa({
      acao,
      promptLivre,
      trechoSelecionado: this.trechoInicial,
      contextoPrecedente: this.trechoInicial,
      docTitulo,
      artigos,
      streaming: true,
      onChunk: (acumulado) => {
        if (previewBox) previewBox.textContent = acumulado;
      },
      onConcluido: (textoFinal) => {
        this.reqAtiva = null;
        if (statusBar) statusBar.innerHTML = `<span>✓ Sugestão pronta</span>`;
        this.exibirAcoesPreview(textoFinal);
      },
      onErro: (err) => {
        if (statusBar) statusBar.innerHTML = `<span style="color:#EF4444">Erro ao gerar: ${err.message}</span>`;
      }
    });
  }

  exibirAcoesPreview(textoFinal) {
    if (!this.el) return;
    let acoesBox = this.el.querySelector('.ath-ia-preview-acoes');
    if (!acoesBox) {
      acoesBox = document.createElement('div');
      acoesBox.className = 'ath-ia-preview-acoes';
      acoesBox.innerHTML = `
        <button type="button" class="ath-ia-btn-recusar-preview">Descartar</button>
        <button type="button" class="ath-ia-btn-aceitar-preview">Aplicar como Sugestão</button>
      `;
      this.el.appendChild(acoesBox);
    }

    acoesBox.querySelector('.ath-ia-btn-recusar-preview').addEventListener('click', () => this.fechar());
    acoesBox.querySelector('.ath-ia-btn-aceitar-preview').addEventListener('click', () => {
      this.aplicarComoSugestaoInline(textoFinal);
      this.fechar();
    });
  }

  aplicarComoSugestaoInline(textoNovo) {
    const editor = this.editor;
    if (!editor || !editor.doc) return;

    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    let blocoEl = this.ancora?.closest?.('[data-bloco-id]');
    if (!blocoEl && sel && sel.rangeCount > 0) {
      blocoEl = sel.getRangeAt(0).startContainer?.parentElement?.closest?.('[data-bloco-id]');
    }
    const blocoId = blocoEl?.dataset?.blocoId;
    const bloco = blocoId ? editor.buscarBlocoPorId?.(blocoId) : editor.blocoSelecionado;
    if (!bloco) return;

    const textoOriginal = this.trechoInicial.trim();
    const tipo = textoOriginal ? 'substituicao' : 'insercao';

    // Registra sugestão nos metadados do documento
    const sug = registrarSugestao(editor.doc, {
      blocoId: bloco.id,
      tipo,
      textoOriginal,
      textoNovo: sanearTextoIa(textoNovo),
      autor: 'Assistente IA',
      autorId: 'ai_athenes',
      corAutor: '#8B5CF6'
    });

    const htmlMarcacao = gerarHtmlMarcacaoSugestao(sug);

    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const template = document.createElement('template');
      template.innerHTML = htmlMarcacao;
      range.insertNode(template.content);
    } else if (blocoEl) {
      blocoEl.innerHTML = (blocoEl.innerHTML || '') + ' ' + htmlMarcacao;
    }

    if (blocoEl) {
      bloco.texto = blocoEl.innerHTML;
      editor.notificarMudanca?.();
      editor.renderizar?.();
    }
  }
}
