// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modal Editor de Layout e Apresentação de Blocos Compostos
 * Inspirado no editor de composição e objetos de prancha do Glaux Desk:
 * Permite configurar estilo de caixa/moldura (limpo, linha de destaque, linhas topo/base, cartão suave),
 * subgrade interna e posicionamento de variáveis ({formula}, {numero}, {legenda}, {fonte}, {titulo}, {imagem}, {tabela}).
 */

import { svgIcone } from './athenes_icones.js';
import {
  obterModelosLayoutBloco,
  aplicarModeloLayoutBloco,
  salvarModeloLayoutCustomizado,
  aplicarLayoutATodosBlocos,
  gerarCssMolduraBloco
} from '../core/athenes_documento.js';

export class ModalLayoutBloco {
  constructor(documento, bloco, opcoes = {}) {
    this.doc = documento;
    this.blocoOriginal = bloco;
    this.onSalvar = opcoes.onSalvar || (() => {});
    this.onFechar = opcoes.onFechar || (() => {});

    // Clone profundo para edição no rascunho
    this.rascunho = JSON.parse(JSON.stringify(bloco));
    if (!this.rascunho.moldura_tipo) this.rascunho.moldura_tipo = 'limpo';
    if (this.rascunho.padding_pt === undefined) this.rascunho.padding_pt = 8;
    if (this.rascunho.tipo === 'formula') {
      if (!this.rascunho.posicao_numero) this.rascunho.posicao_numero = 'direita';
    } else if (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') {
      if (!this.rascunho.subgrade_colunas) this.rascunho.subgrade_colunas = 1;
      if (!this.rascunho.posicao_titulo) this.rascunho.posicao_titulo = 'topo';
    } else if (this.rascunho.tipo === 'tabela' || this.rascunho.tipo === 'quadro') {
      if (!this.rascunho.posicao_titulo) this.rascunho.posicao_titulo = 'topo';
    }

    this.backdrop = null;
    this.montar();
  }

  montar() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ath-modal-backdrop';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'ath-modal';
    modal.style.maxWidth = '1000px';
    modal.style.width = '96%';
    modal.style.height = '88vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';

    const tipoNome = this.rascunho.tipo === 'formula' ? 'Fórmula Matemática'
      : (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') ? 'Figura / Ilustração'
      : this.rascunho.tipo === 'tabela' ? 'Tabela'
      : this.rascunho.tipo === 'quadro' ? 'Quadro' : 'Bloco Composto';

    modal.innerHTML = `
      <div class="ath-modal-head" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--ath-primary-line, #C8D7E6); padding:14px 20px; flex:none;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:8px; background:var(--ath-primary-soft, #EEF4FA); color:var(--ath-primary, #314F79); display:grid; place-items:center;">
            ${svgIcone('grade', 18)}
          </div>
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--ath-text, #1F2733);">Layout e Apresentação do Bloco (${tipoNome})</h3>
            <span style="font-size:11.5px; color:var(--glx-muted, #6B7585);">Configure a moldura, subgrade de partes e variáveis na página (estilo Glaux Desk)</span>
          </div>
        </div>
        <button type="button" class="rm-ic" id="athModalFechar" title="Fechar">${svgIcone('fechar', 14)}</button>
      </div>

      <div class="ath-modal-body" style="flex:1; min-height:0; display:grid; grid-template-columns:420px 1fr; gap:16px; padding:16px 20px; background:#F8FAFC;">
        <!-- Painel Esquerdo: Controles, Presets e Variáveis -->
        <div style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; padding-right:8px;" id="athModalControles">
          <!-- Modelos Prontos estilo Desk -->
          <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:12px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="rm-rot" style="margin:0;">Modelos de Apresentação</span>
              <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnSalvarComoModelo" title="Salvar configuração atual como novo modelo reutilizável">
                + Salvar Modelo
              </button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;" id="athListaPresetsBloco"></div>
          </div>

          <!-- Moldura e Estilo da Caixa -->
          <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:10px;">
            <span class="rm-rot">Estilo da Caixa / Moldura</span>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
              <button type="button" class="glx-btn glx-btn-xs ${this.rascunho.moldura_tipo === 'limpo' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-moldura="limpo">Limpo (Sem caixa)</button>
              <button type="button" class="glx-btn glx-btn-xs ${this.rascunho.moldura_tipo === 'linha_esquerda' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-moldura="linha_esquerda">Linha Lateral</button>
              <button type="button" class="glx-btn glx-btn-xs ${this.rascunho.moldura_tipo === 'linhas_topo_base' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-moldura="linhas_topo_base">Topo e Base</button>
              <button type="button" class="glx-btn glx-btn-xs ${this.rascunho.moldura_tipo === 'cartao_suave' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-moldura="cartao_suave">Cartão com Fundo</button>
              <button type="button" class="glx-btn glx-btn-xs ${this.rascunho.moldura_tipo === 'caixa_borda' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-moldura="caixa_borda">Borda Completa</button>
              <button type="button" class="glx-btn glx-btn-xs ${this.rascunho.moldura_tipo === 'personalizado' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-moldura="personalizado">Personalizado</button>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:2px;">
              <label class="rm-chk" style="font-size:12px; margin:0;">
                <input type="checkbox" id="athFundoAtivo" ${this.rascunho.fundo_ativo ? 'checked' : ''}> Fundo preenchido
              </label>
              <input type="color" id="athFundoCor" value="${this.rascunho.fundo_cor || '#F4F7FB'}" style="width:32px; height:24px; border:none; cursor:pointer;">
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <label class="rm-chk" style="font-size:12px; margin:0;">
                <input type="checkbox" id="athBordaAtiva" ${this.rascunho.borda_ativa !== false ? 'checked' : ''}> Linha de borda
              </label>
              <input type="color" id="athBordaCor" value="${this.rascunho.borda_cor || '#314F79'}" style="width:32px; height:24px; border:none; cursor:pointer;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <label style="font-size:11.5px; font-weight:700; color:#475569;">Cantos Arredondados
                <select id="athRaioBorda" class="glx-select" style="height:30px; font-size:11.5px; padding:0 8px;">
                  <option value="0" ${this.rascunho.raio_borda_px === 0 ? 'selected' : ''}>0 px (Reto)</option>
                  <option value="4" ${this.rascunho.raio_borda_px === 4 ? 'selected' : ''}>4 px (Sutil)</option>
                  <option value="8" ${(this.rascunho.raio_borda_px === 8 || this.rascunho.raio_borda_px === undefined) ? 'selected' : ''}>8 px (Padrão)</option>
                  <option value="12" ${this.rascunho.raio_borda_px === 12 ? 'selected' : ''}>12 px (Arredondado)</option>
                </select>
              </label>
              <label style="font-size:11.5px; font-weight:700; color:#475569;">Espaçamento (Padding)
                <select id="athPadding" class="glx-select" style="height:30px; font-size:11.5px; padding:0 8px;">
                  <option value="2" ${this.rascunho.padding_pt === 2 ? 'selected' : ''}>Compacto (2 pt)</option>
                  <option value="6" ${this.rascunho.padding_pt === 6 ? 'selected' : ''}>Normal (6 pt)</option>
                  <option value="10" ${this.rascunho.padding_pt === 10 ? 'selected' : ''}>Confortável (10 pt)</option>
                  <option value="16" ${this.rascunho.padding_pt === 16 ? 'selected' : ''}>Amplo (16 pt)</option>
                </select>
              </label>
            </div>
          </div>

          <!-- Subgrade e Variáveis do Bloco -->
          <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;" id="athSecVariaveis"></div>
        </div>

        <!-- Painel Direito: Prévia Visual ao Vivo na Folha Real -->
        <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:10px; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="rm-rot" style="margin:0;">Prévia em Tempo Real na Folha</span>
            <span style="font-size:11px; color:#6B7585;">Fidelidade exata do layout aplicado</span>
          </div>
          <div style="flex:1; min-height:0; background:#EFF2F6; border-radius:10px; border:1px solid #CBD5E1; padding:24px; display:flex; align-items:center; justify-content:center; overflow:auto;">
            <div id="athPreviaFolhaSlot" style="width:100%; max-width:520px; background:#fff; border-radius:4px; box-shadow:0 3px 12px rgba(0,0,0,0.08); padding:20px;"></div>
          </div>
        </div>
      </div>

      <div class="ath-modal-foot" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--ath-primary-line, #C8D7E6); padding:12px 20px; flex:none; background:#fff;">
        <button type="button" class="glx-btn glx-btn-soft" id="athBtnAplicarTodos" title="Aplica este layout e moldura para todos os blocos do mesmo tipo no documento">
          ${svgIcone('grade', 14)} Aplicar a Todos os Blocos de ${tipoNome}
        </button>
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="glx-btn glx-btn-soft" id="athBtnCancelar">Cancelar</button>
          <button type="button" class="glx-btn glx-btn-primary" id="athBtnSalvar">Salvar e Aplicar</button>
        </div>
      </div>
    `;

    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    this.renderizarPresets();
    this.renderizarSecaoVariaveis();
    this.atualizarPrevia();
    this.ligarEventos();
  }

  renderizarPresets() {
    const box = this.backdrop.querySelector('#athListaPresetsBloco');
    if (!box) return;
    box.innerHTML = '';
    const presets = obterModelosLayoutBloco(this.rascunho.tipo, this.doc);

    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `glx-btn glx-btn-xs ${this.rascunho.modelo_layout_id === p.id ? 'glx-btn-primary' : 'glx-btn-soft'}`;
      btn.style.justifyContent = 'flex-start';
      btn.style.height = 'auto';
      btn.style.padding = '6px 8px';
      btn.style.textAlign = 'left';
      btn.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1px; width:100%;">
          <strong style="font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.nome}</strong>
          <small style="font-size:9.5px; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.moldura_tipo}</small>
        </div>
      `;
      btn.addEventListener('click', () => {
        aplicarModeloLayoutBloco(this.rascunho, p.id, this.doc);
        this.atualizarTodosControles();
        this.atualizarPrevia();
      });
      box.appendChild(btn);
    });
  }

  renderizarSecaoVariaveis() {
    const sec = this.backdrop.querySelector('#athSecVariaveis');
    if (!sec) return;
    sec.innerHTML = '';

    if (this.rascunho.tipo === 'formula') {
      sec.innerHTML = `
        <span class="rm-rot">Variáveis e Slots da Equação</span>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
          <span class="rm-selo" style="font-size:10px;">{formula} Expressão</span>
          <span class="rm-selo" style="font-size:10px;">{numero} Numeração</span>
          <span class="rm-selo" style="font-size:10px;">{legenda} Explicativa</span>
          <span class="rm-selo" style="font-size:10px;">{fonte} Citação Zotero</span>
        </div>

        <label style="font-size:11.5px; font-weight:700; color:#475569;">Posição da Numeração da Equação {numero}
          <select id="athPosNumero" class="glx-select" style="height:32px; font-size:12px; margin-top:2px;">
            <option value="direita" ${this.rascunho.posicao_numero === 'direita' ? 'selected' : ''}>À Direita na mesma linha (Padrão Acadêmico)</option>
            <option value="esquerda" ${this.rascunho.posicao_numero === 'esquerda' ? 'selected' : ''}>À Esquerda da Fórmula</option>
            <option value="abaixo" ${this.rascunho.posicao_numero === 'abaixo' ? 'selected' : ''}>Abaixo da Fórmula (Centralizado)</option>
            <option value="oculto" ${this.rascunho.posicao_numero === 'oculto' ? 'selected' : ''}>Ocultar Número</option>
          </select>
        </label>

        <label class="rm-chk" style="font-size:12px; margin-top:4px;">
          <input type="checkbox" id="athCheckLegenda" ${this.rascunho.mostrar_legenda ? 'checked' : ''}>
          Exibir texto explicativo das variáveis {legenda}
        </label>
        <textarea id="athTxtLegenda" rows="2" placeholder="Ex: onde E é a energia, m é a massa em repouso e c é a velocidade da luz..." style="font-size:11.5px; display:${this.rascunho.mostrar_legenda ? 'block' : 'none'};">${this.rascunho.legenda_formula || ''}</textarea>

        <label class="rm-chk" style="font-size:12px; margin-top:4px;">
          <input type="checkbox" id="athCheckFonte" ${this.rascunho.mostrar_fonte ? 'checked' : ''}>
          Exibir atribuição ou fonte bibliográfica {fonte}
        </label>
        <input type="text" id="athTxtFonte" placeholder="Ex: Fonte: Einstein (1905)." value="${this.rascunho.fonte_formula || ''}" style="font-size:12px; display:${this.rascunho.mostrar_fonte ? 'block' : 'none'};">
      `;

      sec.querySelector('#athPosNumero').addEventListener('change', e => {
        this.rascunho.posicao_numero = e.target.value;
        this.atualizarPrevia();
      });

      const chkLeg = sec.querySelector('#athCheckLegenda');
      const txtLeg = sec.querySelector('#athTxtLegenda');
      chkLeg.addEventListener('change', e => {
        this.rascunho.mostrar_legenda = e.target.checked;
        txtLeg.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked && !this.rascunho.legenda_formula) {
          this.rascunho.legenda_formula = 'onde as variáveis representam grandezas dimensionais da pesquisa.';
          txtLeg.value = this.rascunho.legenda_formula;
        }
        this.atualizarPrevia();
      });
      txtLeg.addEventListener('input', e => {
        this.rascunho.legenda_formula = e.target.value;
        this.atualizarPrevia();
      });

      const chkFonte = sec.querySelector('#athCheckFonte');
      const txtFonte = sec.querySelector('#athTxtFonte');
      chkFonte.addEventListener('change', e => {
        this.rascunho.mostrar_fonte = e.target.checked;
        txtFonte.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked && !this.rascunho.fonte_formula) {
          this.rascunho.fonte_formula = 'Fonte: Elaborada pelos autores.';
          txtFonte.value = this.rascunho.fonte_formula;
        }
        this.atualizarPrevia();
      });
      txtFonte.addEventListener('input', e => {
        this.rascunho.fonte_formula = e.target.value;
        this.atualizarPrevia();
      });
    } else if (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') {
      sec.innerHTML = `
        <span class="rm-rot">Subgrade e Disposição ({imagem}, {titulo}, {legenda}, {fonte})</span>
        <label style="font-size:11.5px; font-weight:700; color:#475569;">Arranjo de Subgrade
          <select id="athSubgradeCols" class="glx-select" style="height:32px; font-size:12px; margin-top:2px;">
            <option value="1" ${this.rascunho.subgrade_colunas === 1 ? 'selected' : ''}>1 Coluna Vertical (Padrão ABNT Clássico)</option>
            <option value="2" ${this.rascunho.subgrade_colunas === 2 ? 'selected' : ''}>2 Colunas (Imagem à esquerda 60% e Legenda à direita 40%)</option>
          </select>
        </label>
        <label style="font-size:11.5px; font-weight:700; color:#475569; margin-top:6px;">Posição do Título {titulo}
          <select id="athPosTitulo" class="glx-select" style="height:32px; font-size:12px; margin-top:2px;">
            <option value="topo" ${this.rascunho.posicao_titulo === 'topo' ? 'selected' : ''}>Acima da Imagem (Recomendado ABNT)</option>
            <option value="base" ${this.rascunho.posicao_titulo === 'base' ? 'selected' : ''}>Abaixo da Imagem</option>
          </select>
        </label>
      `;

      sec.querySelector('#athSubgradeCols').addEventListener('change', e => {
        this.rascunho.subgrade_colunas = parseInt(e.target.value, 10);
        this.atualizarPrevia();
      });
      sec.querySelector('#athPosTitulo').addEventListener('change', e => {
        this.rascunho.posicao_titulo = e.target.value;
        this.atualizarPrevia();
      });
    } else if (this.rascunho.tipo === 'tabela' || this.rascunho.tipo === 'quadro') {
      sec.innerHTML = `
        <span class="rm-rot">Posicionamento de Título e Variáveis</span>
        <label style="font-size:11.5px; font-weight:700; color:#475569;">Posição do Título {titulo}
          <select id="athPosTituloTab" class="glx-select" style="height:32px; font-size:12px; margin-top:2px;">
            <option value="topo" ${this.rascunho.posicao_titulo === 'topo' ? 'selected' : ''}>No Topo (Acima da Tabela — Padrão ABNT/IBGE)</option>
            <option value="base" ${this.rascunho.posicao_titulo === 'base' ? 'selected' : ''}>Na Base (Abaixo da Tabela)</option>
          </select>
        </label>
      `;
      sec.querySelector('#athPosTituloTab').addEventListener('change', e => {
        this.rascunho.posicao_titulo = e.target.value;
        this.atualizarPrevia();
      });
    }
  }

  atualizarTodosControles() {
    this.renderizarPresets();
    this.renderizarSecaoVariaveis();

    // Atualiza botões de moldura
    const bts = this.backdrop.querySelectorAll('[data-moldura]');
    bts.forEach(b => {
      const match = b.dataset.moldura === this.rascunho.moldura_tipo;
      b.className = `glx-btn glx-btn-xs ${match ? 'glx-btn-primary' : 'glx-btn-soft'}`;
    });

    const chkFundo = this.backdrop.querySelector('#athFundoAtivo');
    if (chkFundo) chkFundo.checked = !!this.rascunho.fundo_ativo;
    const corFundo = this.backdrop.querySelector('#athFundoCor');
    if (corFundo) corFundo.value = this.rascunho.fundo_cor || '#F4F7FB';

    const chkBorda = this.backdrop.querySelector('#athBordaAtiva');
    if (chkBorda) chkBorda.checked = this.rascunho.borda_ativa !== false;
    const corBorda = this.backdrop.querySelector('#athBordaCor');
    if (corBorda) corBorda.value = this.rascunho.borda_cor || '#314F79';
  }

  atualizarPrevia() {
    const slot = this.backdrop.querySelector('#athPreviaFolhaSlot');
    if (!slot) return;
    slot.innerHTML = '';

    const cssCaixa = gerarCssMolduraBloco(this.rascunho);
    const box = document.createElement('div');
    Object.assign(box.style, cssCaixa);

    if (this.rascunho.tipo === 'formula') {
      const alin = this.rascunho.alinhamento || 'centro';
      const posNum = this.rascunho.posicao_numero || 'direita';

      let inner = '';
      if (posNum === 'direita') {
        inner = `
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="flex:1; text-align:${alin}; font-family:'Cambria Math', 'Times New Roman', serif; font-size:16px; font-style:italic;">
              ${this.rascunho.latex || this.rascunho.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx'}
            </div>
            <div style="font-weight:700; font-size:12px; color:#6B7585; padding-left:12px;">${this.rascunho.numero_equacao || '(1)'}</div>
          </div>
        `;
      } else if (posNum === 'esquerda') {
        inner = `
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="font-weight:700; font-size:12px; color:#6B7585; padding-right:12px;">${this.rascunho.numero_equacao || '(1)'}</div>
            <div style="flex:1; text-align:${alin}; font-family:'Cambria Math', 'Times New Roman', serif; font-size:16px; font-style:italic;">
              ${this.rascunho.latex || this.rascunho.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx'}
            </div>
          </div>
        `;
      } else if (posNum === 'abaixo') {
        inner = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px; width:100%;">
            <div style="text-align:center; font-family:'Cambria Math', 'Times New Roman', serif; font-size:16px; font-style:italic;">
              ${this.rascunho.latex || this.rascunho.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx'}
            </div>
            <div style="font-weight:700; font-size:12px; color:#6B7585;">${this.rascunho.numero_equacao || '(1)'}</div>
          </div>
        `;
      } else {
        inner = `
          <div style="text-align:${alin}; font-family:'Cambria Math', 'Times New Roman', serif; font-size:16px; font-style:italic; width:100%;">
            ${this.rascunho.latex || this.rascunho.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx'}
          </div>
        `;
      }

      if (this.rascunho.mostrar_legenda && this.rascunho.legenda_formula) {
        inner += `<div style="font-size:11px; color:#475569; font-style:italic; margin-top:6px; padding-top:4px; border-top:1px dashed #CBD5E1;">${this.rascunho.legenda_formula}</div>`;
      }
      if (this.rascunho.mostrar_fonte && this.rascunho.fonte_formula) {
        inner += `<div style="font-size:10.5px; color:#64748B; margin-top:3px;">${this.rascunho.fonte_formula}</div>`;
      }

      box.innerHTML = inner;
    } else if (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') {
      const isSubgrade2Col = this.rascunho.subgrade_colunas === 2;
      const posTit = this.rascunho.posicao_titulo || 'topo';

      const titHtml = `<strong style="display:block; font-size:12px; font-weight:800; color:#1F2733; margin-bottom:4px;">${this.rascunho.titulo || 'Figura 1 — Ilustração Técnica'}</strong>`;
      const imgHtml = `
        <div style="background:#F1F5F9; border-radius:4px; height:90px; display:grid; place-items:center; color:#64748B;">
          ${svgIcone('imagem', 28)}
          <span style="font-size:10px; font-weight:700;">Área da Ilustração / Imagem</span>
        </div>
      `;
      const legHtml = `<p style="margin:4px 0 0 0; font-size:11px; color:#475569;">${this.rascunho.legenda_geral || this.rascunho.legenda || 'Legenda descritiva dos elementos.'}</p>`;
      const fonteHtml = `<small style="font-size:10px; color:#64748B; margin-top:2px; display:block;">${this.rascunho.fonte || 'Fonte: Autores (2026).'}</small>`;

      if (isSubgrade2Col) {
        box.innerHTML = `
          <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:12px; align-items:center;">
            <div>${imgHtml}</div>
            <div>
              ${titHtml}
              ${legHtml}
              ${fonteHtml}
            </div>
          </div>
        `;
      } else {
        if (posTit === 'topo') {
          box.innerHTML = `<div>${titHtml}${imgHtml}${legHtml}${fonteHtml}</div>`;
        } else {
          box.innerHTML = `<div>${imgHtml}${titHtml}${legHtml}${fonteHtml}</div>`;
        }
      }
    } else if (this.rascunho.tipo === 'tabela' || this.rascunho.tipo === 'quadro') {
      const posTit = this.rascunho.posicao_titulo || 'topo';
      const titHtml = `<strong style="display:block; font-size:12px; font-weight:800; color:#1F2733; margin-bottom:4px;">${this.rascunho.titulo || 'Tabela 1 — Dados Apresentados'}</strong>`;
      const tabHtml = `
        <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:left;">
          <thead>
            <tr style="border-top:1.5px solid #1F2733; border-bottom:1px solid #1F2733;">
              <th style="padding:4px 6px;">Parâmetro</th>
              <th style="padding:4px 6px;">Valor A</th>
              <th style="padding:4px 6px;">Valor B</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:3px 6px;">Indicador 1</td><td style="padding:3px 6px;">12,5</td><td style="padding:3px 6px;">24,8</td></tr>
            <tr style="border-bottom:1.5px solid #1F2733;"><td style="padding:3px 6px;">Indicador 2</td><td style="padding:3px 6px;">8,1</td><td style="padding:3px 6px;">19,3</td></tr>
          </tbody>
        </table>
      `;
      const fonteHtml = `<small style="font-size:10px; color:#64748B; margin-top:4px; display:block;">${this.rascunho.fonte || 'Fonte: IBGE / Autores.'}</small>`;

      if (posTit === 'topo') {
        box.innerHTML = `<div>${titHtml}${tabHtml}${fonteHtml}</div>`;
      } else {
        box.innerHTML = `<div>${tabHtml}${titHtml}${fonteHtml}</div>`;
      }
    }

    slot.appendChild(box);
  }

  ligarEventos() {
    this.backdrop.querySelector('#athModalFechar').addEventListener('click', () => this.fechar());
    this.backdrop.querySelector('#athBtnCancelar').addEventListener('click', () => this.fechar());

    // Botões de estilo de moldura
    const molduraBts = this.backdrop.querySelectorAll('[data-moldura]');
    molduraBts.forEach(btn => {
      btn.addEventListener('click', () => {
        const tipo = btn.dataset.moldura;
        this.rascunho.moldura_tipo = tipo;
        if (tipo === 'limpo') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = false;
        } else if (tipo === 'linha_esquerda') {
          this.rascunho.fundo_ativo = true;
          this.rascunho.fundo_cor = '#F4F7FB';
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#314F79';
        } else if (tipo === 'linhas_topo_base') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#CBD5E1';
        } else if (tipo === 'cartao_suave') {
          this.rascunho.fundo_ativo = true;
          this.rascunho.fundo_cor = '#EEF4FA';
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#C8D7E6';
          this.rascunho.raio_borda_px = 8;
        } else if (tipo === 'caixa_borda') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#CBD5E1';
        }
        this.atualizarTodosControles();
        this.atualizarPrevia();
      });
    });

    // Fundo e borda diretos
    this.backdrop.querySelector('#athFundoAtivo')?.addEventListener('change', e => {
      this.rascunho.fundo_ativo = e.target.checked;
      this.rascunho.moldura_tipo = 'personalizado';
      this.atualizarPrevia();
    });
    this.backdrop.querySelector('#athFundoCor')?.addEventListener('input', e => {
      this.rascunho.fundo_cor = e.target.value;
      this.rascunho.fundo_ativo = true;
      this.backdrop.querySelector('#athFundoAtivo').checked = true;
      this.atualizarPrevia();
    });

    this.backdrop.querySelector('#athBordaAtiva')?.addEventListener('change', e => {
      this.rascunho.borda_ativa = e.target.checked;
      this.rascunho.moldura_tipo = 'personalizado';
      this.atualizarPrevia();
    });
    this.backdrop.querySelector('#athBordaCor')?.addEventListener('input', e => {
      this.rascunho.borda_cor = e.target.value;
      this.rascunho.borda_ativa = true;
      this.backdrop.querySelector('#athBordaAtiva').checked = true;
      this.atualizarPrevia();
    });

    this.backdrop.querySelector('#athRaioBorda')?.addEventListener('change', e => {
      this.rascunho.raio_borda_px = parseInt(e.target.value, 10);
      this.atualizarPrevia();
    });
    this.backdrop.querySelector('#athPadding')?.addEventListener('change', e => {
      this.rascunho.padding_pt = parseInt(e.target.value, 10);
      this.atualizarPrevia();
    });

    // Salvar como novo modelo reutilizável
    this.backdrop.querySelector('#athBtnSalvarComoModelo')?.addEventListener('click', () => {
      const nome = window.prompt('Nome do novo modelo de bloco:', `Modelo ${this.rascunho.moldura_tipo}`);
      if (nome && nome.trim()) {
        salvarModeloLayoutCustomizado(this.doc, nome, this.rascunho);
        this.renderizarPresets();
      }
    });

    // Aplicar a todos os blocos do mesmo tipo no documento
    this.backdrop.querySelector('#athBtnAplicarTodos')?.addEventListener('click', () => {
      const qtd = aplicarLayoutATodosBlocos(this.doc, this.rascunho.tipo, this.rascunho);
      Object.assign(this.blocoOriginal, this.rascunho);
      this.onSalvar(this.blocoOriginal);
      alert(`Configuração aplicada com sucesso a ${qtd} bloco(s) de ${this.rascunho.tipo} no documento!`);
      this.fechar();
    });

    // Salvar e aplicar no bloco atual
    this.backdrop.querySelector('#athBtnSalvar')?.addEventListener('click', () => {
      Object.assign(this.blocoOriginal, this.rascunho);
      this.onSalvar(this.blocoOriginal);
      this.fechar();
    });
  }

  fechar() {
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
    this.onFechar();
  }
}
