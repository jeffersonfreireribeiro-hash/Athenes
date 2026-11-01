// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modal Editor de Layout e Apresentação de Blocos Compostos
 * Inspirado no editor de composição e objetos de prancha do Glaux Desk:
 * - Subgrade interna 2D (linhas, colunas, slots posicionáveis)
 * - Posicionamento flexível de variáveis: {formula}, {numero}, {legenda}, {fonte}, {titulo}, {imagem}, {tabela}
 * - Estilos de moldura: Limpo, Linha Lateral (Reta, Quadriculada/Cantos Retos, Pontilhada, Tracejada, Dupla, Bullet),
 *   Cartão com Fundo, Borda Completa, Moldura Técnica em Esquadro e SVG Personalizado.
 * - Paleta rica de símbolos matemáticos e lógicos com inserção ao vivo.
 */

import { svgIcone } from './athenes_icones.js';
import {
  obterModelosLayoutBloco,
  aplicarModeloLayoutBloco,
  salvarModeloLayoutCustomizado,
  aplicarLayoutATodosBlocos,
  gerarCssMolduraBloco,
  rotuloDaFigura
} from '../core/athenes_documento.js';
import { criarSeletorSimbolosMatematica } from './athenes_simbolos_matematica.js';

export class ModalLayoutBloco {
  constructor(documento, bloco, opcoes = {}) {
    this.doc = documento;
    this.blocoOriginal = bloco;
    this.onSalvar = opcoes.onSalvar || (() => {});
    this.onFechar = opcoes.onFechar || (() => {});

    // Clone profundo para edição no rascunho
    this.rascunho = JSON.parse(JSON.stringify(bloco));
    if (!this.rascunho.moldura_tipo) this.rascunho.moldura_tipo = 'limpo';
    if (!this.rascunho.linha_estilo) this.rascunho.linha_estilo = 'solida';
    if (this.rascunho.padding_pt === undefined) this.rascunho.padding_pt = 8;
    if (!this.rascunho.subgrade_colunas) this.rascunho.subgrade_colunas = (this.rascunho.layout === '2_lado' ? 2 : 1);
    if (!this.rascunho.subgrade_linhas) this.rascunho.subgrade_linhas = 3;

    if (this.rascunho.tipo === 'formula') {
      if (!this.rascunho.posicao_numero) this.rascunho.posicao_numero = 'direita';
    } else if (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') {
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
    modal.style.maxWidth = '1060px';
    modal.style.width = '96%';
    modal.style.height = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';

    const tipoNome = this.rascunho.tipo === 'formula' ? 'Fórmula Matemática'
      : (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') ? (rotuloDaFigura(this.rascunho) + ' / Ilustração')
      : this.rascunho.tipo === 'tabela' ? 'Tabela'
      : this.rascunho.tipo === 'quadro' ? 'Quadro'
      : this.rascunho.tipo === 'mapa' ? 'Mapa Cartográfico' : 'Bloco Composto';

    modal.innerHTML = `
      <div class="ath-modal-head" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--ath-primary-line, #C8D7E6); padding:14px 20px; flex:none;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:8px; background:var(--ath-primary-soft, #EEF4FA); color:var(--ath-primary, #314F79); display:grid; place-items:center;">
            ${svgIcone('grade', 18)}
          </div>
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--ath-text, #1F2733);">Layout, Subgrade e Moldura (${tipoNome})</h3>
            <span style="font-size:11.5px; color:var(--glx-muted, #6B7585);">Subgrade paramétrica estilo Glaux Desk: configure caixas, variáveis, traços e SVG</span>
          </div>
        </div>
        <button type="button" class="rm-ic" id="athModalFechar" title="Fechar">${svgIcone('fechar', 14)}</button>
      </div>

      <div class="ath-modal-body" style="flex:1; min-height:0; display:grid; grid-template-columns:440px 1fr; gap:16px; padding:16px 20px; background:#F8FAFC;">
        <!-- Painel Esquerdo: Controles, Presets, Molduras e Subgrade -->
        <div style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; padding-right:8px;" id="athModalControles">
          <!-- Modelos Prontos estilo Desk em Caixa com Lista Selecionável -->
          <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:12px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="rm-rot" style="margin:0;">Modelos de Apresentação</span>
              <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnSalvarComoModelo" title="Salvar configuração atual como novo modelo reutilizável">
                + Salvar Modelo
              </button>
            </div>
            <div class="ath-lista-selecionavel" id="athListaPresetsBloco" style="max-height:135px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding-right:2px; scrollbar-width:thin;"></div>
          </div>

          <!-- Estilos de Caixa e Moldura em Caixa com Lista Selecionável -->
          <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="rm-rot" style="margin:0;">Estilos de Caixa e Moldura</span>
              <span style="font-size:10px; color:var(--glx-muted);">Selecione na lista</span>
            </div>
            <div class="ath-lista-selecionavel" id="athListaMoldurasBox" style="max-height:140px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding-right:2px; scrollbar-width:thin;"></div>

            <!-- Estilo do Traço / Cantos (Reta, Quadriculada, Pontilhada, Tracejada, Dupla) -->
            <div id="athBoxLinhaEstilo" style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
              <label style="font-size:11.5px; font-weight:700; color:#475569;">Estilo do Traço e Cantos
                <select id="athLinhaEstilo" class="glx-select" style="height:30px; font-size:11.5px; padding:0 8px; margin-top:2px;">
                  <option value="solida" ${(!this.rascunho.linha_estilo || this.rascunho.linha_estilo === 'solida') ? 'selected' : ''}>Reta Contínua</option>
                  <option value="quadriculada_reta" ${this.rascunho.linha_estilo === 'quadriculada_reta' ? 'selected' : ''}>Quadriculada (Cantos Retos 0 px)</option>
                  <option value="pontilhada" ${this.rascunho.linha_estilo === 'pontilhada' ? 'selected' : ''}>Pontilhada (Dotted)</option>
                  <option value="tracejada" ${this.rascunho.linha_estilo === 'tracejada' ? 'selected' : ''}>Tracejada (Dashed)</option>
                  <option value="dupla" ${this.rascunho.linha_estilo === 'dupla' ? 'selected' : ''}>Linha Dupla Técnica (Double)</option>
                  <option value="ponto_destaque" ${this.rascunho.linha_estilo === 'ponto_destaque' ? 'selected' : ''}>Com Marcador / Ponto no Topo</option>
                </select>
              </label>
            </div>

            <!-- Editor de SVG Personalizado -->
            <div id="athBoxSvgCustom" style="display:${this.rascunho.moldura_tipo === 'personalizado' ? 'flex' : 'none'}; flex-direction:column; gap:4px;">
              <label style="font-size:11px; font-weight:700; color:#475569;">Desenho ou Código SVG da Moldura
                <textarea id="athTxtSvgCustom" rows="2" placeholder="<svg ...>...</svg>" style="font-family:var(--glx-font-mono); font-size:11px; width:100%;">${this.rascunho.svg_custom || ''}</textarea>
              </label>
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
                  <option value="0" ${this.rascunho.raio_borda_px === 0 ? 'selected' : ''}>0 px (Reto / Quadriculado)</option>
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

          <!-- Subgrade e Variáveis do Bloco (Estilo Glaux Desk) -->
          <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;" id="athSecVariaveis"></div>
        </div>

        <!-- Painel Direito: Prévia Visual ao Vivo na Folha Real -->
        <div style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:10px; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="rm-rot" style="margin:0;">Prévia em Tempo Real na Folha</span>
            <span style="font-size:11px; color:#6B7585;">Fidelidade exata do layout aplicado</span>
          </div>
          <div style="flex:1; min-height:0; background:#EFF2F6; border-radius:10px; border:1px solid #CBD5E1; padding:24px; display:flex; align-items:center; justify-content:center; overflow:auto;">
            <div id="athPreviaFolhaSlot" style="width:100%; max-width:540px; background:#fff; border-radius:4px; box-shadow:0 3px 12px rgba(0,0,0,0.08); padding:20px;"></div>
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
    this.renderizarListaMolduras();
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
      const isSel = this.rascunho.modelo_layout_id === p.id;
      const row = document.createElement('div');
      row.className = `ath-item-lista-sel ${isSel ? 'ativo' : ''}`;
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid ${isSel ? 'var(--ath-primary, #314F79)' : 'var(--ath-primary-line, #E2E8F0)'};
        background: ${isSel ? 'var(--ath-primary-soft, #EEF4FA)' : '#FFFFFF'};
        cursor: pointer;
        transition: all .12s ease;
      `;
      row.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1px; min-width:0; flex:1;">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="font-size:11.5px; color:${isSel ? 'var(--ath-primary, #314F79)' : '#1F2733'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.nome}</strong>
            <span class="rm-selo" style="font-size:9px; padding:1px 5px; flex:none;">${p.moldura_tipo}</span>
          </div>
          <span style="font-size:10px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.descricao || 'Modelo de apresentação'}</span>
        </div>
        ${isSel ? `<div style="color:var(--ath-primary, #314F79); display:flex; align-items:center; margin-left:8px;">${svgIcone('check', 14)}</div>` : ''}
      `;
      const selecionar = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        aplicarModeloLayoutBloco(this.rascunho, p.id, this.doc);
        this.rascunho.modelo_layout_id = p.id;
        this.atualizarTodosControles();
        this.atualizarPrevia();
      };
      row.addEventListener('click', selecionar);
      box.appendChild(row);
    });
  }

  renderizarListaMolduras() {
    const box = this.backdrop.querySelector('#athListaMoldurasBox');
    if (!box) return;
    box.innerHTML = '';

    const estilosMoldura = [
      { id: 'limpo', nome: 'Limpo (Sem caixa / Padrão ABNT)', desc: 'Sem moldura, bordas ou fundo decorativo' },
      { id: 'linha_esquerda', nome: 'Linha Lateral de Destaque', desc: 'Faixa técnica na lateral esquerda' },
      { id: 'linhas_topo_base', nome: 'Linhas no Topo e Base', desc: 'Linhas horizontais superior e inferior (estilo IBGE)' },
      { id: 'cartao_suave', nome: 'Cartão com Fundo Integrado', desc: 'Preenchimento suave com cantos arredondados' },
      { id: 'caixa_borda', nome: 'Borda Completa (Moldura)', desc: 'Contorno retangular completo contínuo ou estilizado' },
      { id: 'moldura_tecnica', nome: 'Moldura Técnica / Prancha', desc: 'Esquadros de precisão técnica nos 4 cantos' },
      { id: 'personalizado', nome: 'Desenho SVG / Personalizado', desc: 'Vetor customizado ou código SVG importado' }
    ];

    estilosMoldura.forEach(m => {
      const isSel = this.rascunho.moldura_tipo === m.id;
      const item = document.createElement('div');
      item.className = `ath-item-lista-sel ${isSel ? 'ativo' : ''}`;
      item.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid ${isSel ? 'var(--ath-primary, #314F79)' : 'var(--ath-primary-line, #E2E8F0)'};
        background: ${isSel ? 'var(--ath-primary-soft, #EEF4FA)' : '#FFFFFF'};
        cursor: pointer;
        transition: all .12s ease;
      `;
      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1px; min-width:0; flex:1;">
          <strong style="font-size:11.5px; color:${isSel ? 'var(--ath-primary, #314F79)' : '#1F2733'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.nome}</strong>
          <span style="font-size:10px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.desc}</span>
        </div>
        ${isSel ? `<div style="color:var(--ath-primary, #314F79); display:flex; align-items:center; margin-left:8px;">${svgIcone('check', 14)}</div>` : ''}
      `;
      item.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.rascunho.moldura_tipo = m.id;
        if (m.id === 'limpo') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = false;
        } else if (m.id === 'linha_esquerda') {
          this.rascunho.fundo_ativo = true;
          this.rascunho.fundo_cor = '#F4F7FB';
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#314F79';
        } else if (m.id === 'linhas_topo_base') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#CBD5E1';
        } else if (m.id === 'cartao_suave') {
          this.rascunho.fundo_ativo = true;
          this.rascunho.fundo_cor = '#EEF4FA';
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#C8D7E6';
          this.rascunho.raio_borda_px = 8;
        } else if (m.id === 'caixa_borda') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#CBD5E1';
        } else if (m.id === 'moldura_tecnica') {
          this.rascunho.fundo_ativo = false;
          this.rascunho.borda_ativa = true;
          this.rascunho.borda_cor = '#314F79';
          this.rascunho.raio_borda_px = 0;
        }
        this.atualizarTodosControles();
        this.atualizarPrevia();
      });
      box.appendChild(item);
    });
  }

  renderizarSecaoVariaveis() {
    const sec = this.backdrop.querySelector('#athSecVariaveis');
    if (!sec) return;
    sec.innerHTML = '';

    // Cabeçalho da Subgrade estilo Desk
    sec.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span class="rm-rot" style="margin:0;">Subgrade do Bloco (Estilo Glaux Desk)</span>
        <span style="font-size:10px; color:var(--glx-muted);">Posicionamento interno</span>
      </div>

      <!-- Seletor de Colunas da Subgrade -->
      <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label style="font-size:11.5px; font-weight:700; color:#475569;">Colunas da Subgrade
          <select id="athSubgradeCols" class="glx-select" style="height:30px; font-size:11.5px;">
            <option value="1" ${this.rascunho.subgrade_colunas === 1 ? 'selected' : ''}>1 Coluna (Vertical)</option>
            <option value="2" ${this.rascunho.subgrade_colunas === 2 ? 'selected' : ''}>2 Colunas (Lado a Lado)</option>
          </select>
        </label>
        <label style="font-size:11.5px; font-weight:700; color:#475569;">Posição do Título {titulo}
          <select id="athPosTitulo" class="glx-select" style="height:30px; font-size:11.5px;">
            <option value="topo" ${this.rascunho.posicao_titulo === 'topo' ? 'selected' : ''}>No Topo (Acima)</option>
            <option value="base" ${this.rascunho.posicao_titulo === 'base' ? 'selected' : ''}>Na Base (Abaixo)</option>
          </select>
        </label>
      </div>

      <!-- Visualizador Interativo da Matriz do Subgrid -->
      <div style="background:#F1F5F9; border:1px dashed #CBD5E1; border-radius:8px; padding:8px; margin:4px 0;">
        <div style="font-size:10.5px; font-weight:800; color:#314F79; margin-bottom:6px; text-transform:uppercase;">
          Células da Subgrade Interna (${this.rascunho.subgrade_colunas || 1} colunas)
        </div>
        <div id="athMatrizSubgrid" style="display:grid; grid-template-columns:${this.rascunho.subgrade_colunas === 2 ? '1fr 1fr' : '1fr'}; gap:6px;"></div>
      </div>
    `;

    // Renderiza matriz das células do subgrid
    const matrizBox = sec.querySelector('#athMatrizSubgrid');
    if (matrizBox) {
      if (this.rascunho.tipo === 'formula') {
        matrizBox.innerHTML = `
          <div style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:6px; font-size:11px;">
            <strong>Slot 1:</strong> {formula} Expressão LaTeX
          </div>
          <div style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:6px; font-size:11px;">
            <strong>Slot 2:</strong> {numero} Numeração ${this.rascunho.posicao_numero || 'direita'}
          </div>
        `;
      } else {
        const is2Col = this.rascunho.subgrade_colunas === 2;
        if (is2Col) {
          matrizBox.innerHTML = `
            <div style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:8px; font-size:11px;">
              <strong>Coluna 1 (60%):</strong><br>
              <span class="rm-selo" style="font-size:9.5px; margin-top:4px;">{conteudo} Objeto Principal</span>
            </div>
            <div style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:8px; font-size:11px;">
              <strong>Coluna 2 (40%):</strong><br>
              <div style="display:flex; flex-direction:column; gap:3px; margin-top:4px;">
                <span class="rm-selo" style="font-size:9.5px;">{titulo} Título / Número</span>
                <span class="rm-selo" style="font-size:9.5px;">{legenda} Legenda</span>
                <span class="rm-selo" style="font-size:9.5px;">{fonte} Fonte</span>
              </div>
            </div>
          `;
        } else {
          matrizBox.innerHTML = `
            <div style="background:#fff; border:1px solid #CBD5E1; border-radius:6px; padding:6px; font-size:11px; display:flex; flex-direction:column; gap:4px;">
              <div><strong>Linha 1:</strong> ${this.rascunho.posicao_titulo === 'topo' ? '{titulo} Título / Número' : '{conteudo} Imagem / Tabela'}</div>
              <div><strong>Linha 2:</strong> ${this.rascunho.posicao_titulo === 'topo' ? '{conteudo} Imagem / Tabela' : '{titulo} Título / Número'}</div>
              <div><strong>Linha 3:</strong> {legenda} Legenda explicativa + {fonte} Fonte</div>
            </div>
          `;
        }
      }
    }

    // Variáveis específicas por tipo
    if (this.rascunho.tipo === 'formula') {
      const formBox = document.createElement('div');
      formBox.style.display = 'flex';
      formBox.style.flexDirection = 'column';
      formBox.style.gap = '8px';
      formBox.style.marginTop = '6px';

      formBox.innerHTML = `
        <label style="font-size:11.5px; font-weight:700; color:#475569;">Posição da Numeração da Equação {numero}
          <select id="athPosNumero" class="glx-select" style="height:32px; font-size:12px; margin-top:2px;">
            <option value="direita" ${this.rascunho.posicao_numero === 'direita' ? 'selected' : ''}>À Direita na mesma linha (Padrão Acadêmico)</option>
            <option value="esquerda" ${this.rascunho.posicao_numero === 'esquerda' ? 'selected' : ''}>À Esquerda da Fórmula</option>
            <option value="abaixo" ${this.rascunho.posicao_numero === 'abaixo' ? 'selected' : ''}>Abaixo da Fórmula (Centralizado)</option>
            <option value="oculto" ${this.rascunho.posicao_numero === 'oculto' ? 'selected' : ''}>Ocultar Número</option>
          </select>
        </label>

        <!-- Paleta de Símbolos Matemáticos embutida no modal -->
        <div>
          <span style="font-size:11px; font-weight:700; color:#475569;">Paleta de Símbolos Especiais (Clique para Inserir)</span>
          <div id="athModalPaletaSimbolos"></div>
        </div>

        <label style="font-size:11.5px; font-weight:700; color:#475569;">Expressão LaTeX
          <textarea id="athTxtLatexModal" rows="2" style="font-family:var(--glx-font-mono); font-size:11.5px; width:100%;">${this.rascunho.latex || this.rascunho.formula || ''}</textarea>
        </label>

        <label class="rm-chk" style="font-size:12px; margin-top:2px;">
          <input type="checkbox" id="athCheckLegenda" ${this.rascunho.mostrar_legenda ? 'checked' : ''}>
          Exibir texto explicativo das variáveis {legenda}
        </label>
        <textarea id="athTxtLegenda" rows="2" placeholder="Ex: onde E é a energia e m é a massa..." style="font-size:11.5px; display:${this.rascunho.mostrar_legenda ? 'block' : 'none'};">${this.rascunho.legenda_formula || ''}</textarea>

        <label class="rm-chk" style="font-size:12px; margin-top:2px;">
          <input type="checkbox" id="athCheckFonte" ${this.rascunho.mostrar_fonte ? 'checked' : ''}>
          Exibir atribuição ou fonte bibliográfica {fonte}
        </label>
        <input type="text" id="athTxtFonte" placeholder="Ex: Fonte: Einstein (1905)." value="${this.rascunho.fonte_formula || ''}" style="font-size:12px; display:${this.rascunho.mostrar_fonte ? 'block' : 'none'};">
      `;

      sec.appendChild(formBox);

      // Paleta de símbolos
      const txtLatexModal = formBox.querySelector('#athTxtLatexModal');
      const boxPaleta = formBox.querySelector('#athModalPaletaSimbolos');
      if (boxPaleta) {
        const paleta = criarSeletorSimbolosMatematica(snippet => {
          const start = txtLatexModal.selectionStart || 0;
          const end = txtLatexModal.selectionEnd || 0;
          const val = txtLatexModal.value;
          txtLatexModal.value = val.substring(0, start) + snippet + val.substring(end);
          txtLatexModal.selectionStart = txtLatexModal.selectionEnd = start + snippet.length;
          txtLatexModal.focus();
          this.rascunho.latex = txtLatexModal.value;
          this.rascunho.formula = this.rascunho.latex;
          this.atualizarPrevia();
        });
        boxPaleta.appendChild(paleta);
      }

      txtLatexModal.addEventListener('input', e => {
        this.rascunho.latex = e.target.value;
        this.rascunho.formula = this.rascunho.latex;
        this.atualizarPrevia();
      });

      formBox.querySelector('#athPosNumero').addEventListener('change', e => {
        this.rascunho.posicao_numero = e.target.value;
        this.atualizarPrevia();
      });

      const chkLeg = formBox.querySelector('#athCheckLegenda');
      const txtLeg = formBox.querySelector('#athTxtLegenda');
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

      const chkFonte = formBox.querySelector('#athCheckFonte');
      const txtFonte = formBox.querySelector('#athTxtFonte');
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
      const figBox = document.createElement('div');
      figBox.style.display = 'flex';
      figBox.style.flexDirection = 'column';
      figBox.style.gap = '8px';
      figBox.style.marginTop = '6px';
      figBox.style.paddingTop = '6px';
      figBox.style.borderTop = '1px dashed #CBD5E1';

      const estilos = this.doc.estilos || [];

      figBox.innerHTML = `
        <div style="font-size:11px; font-weight:800; color:#314F79; text-transform:uppercase;">Enquadramento e Dimensões da Imagem</div>
        <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Altura da Imagem
            <select id="athModalImgAltura" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="auto" ${(!this.rascunho.altura_modo || this.rascunho.altura_modo === 'auto') ? 'selected' : ''}>Auto (Proporcional)</option>
              <option value="160px" ${this.rascunho.altura_modo === '160px' ? 'selected' : ''}>160 px (Compacta)</option>
              <option value="220px" ${this.rascunho.altura_modo === '220px' ? 'selected' : ''}>220 px (Média)</option>
              <option value="280px" ${this.rascunho.altura_modo === '280px' ? 'selected' : ''}>280 px (Padrão)</option>
              <option value="360px" ${this.rascunho.altura_modo === '360px' ? 'selected' : ''}>360 px (Grande)</option>
              <option value="450px" ${this.rascunho.altura_modo === '450px' ? 'selected' : ''}>450 px (Ampla)</option>
              <option value="100%" ${this.rascunho.altura_modo === '100%' ? 'selected' : ''}>100% (Ocupar Altura)</option>
            </select>
          </label>
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Proporção (Aspect Ratio)
            <select id="athModalImgProporcao" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="livre" ${(!this.rascunho.proporcao_imagem || this.rascunho.proporcao_imagem === 'livre') ? 'selected' : ''}>Livre (Natural)</option>
              <option value="16/9" ${this.rascunho.proporcao_imagem === '16/9' ? 'selected' : ''}>16:9 (Widescreen)</option>
              <option value="4/3" ${this.rascunho.proporcao_imagem === '4/3' ? 'selected' : ''}>4:3 (Clássica)</option>
              <option value="1/1" ${this.rascunho.proporcao_imagem === '1/1' ? 'selected' : ''}>1:1 (Quadrada)</option>
              <option value="3/4" ${this.rascunho.proporcao_imagem === '3/4' ? 'selected' : ''}>3:4 (Retrato)</option>
              <option value="9/16" ${this.rascunho.proporcao_imagem === '9/16' ? 'selected' : ''}>9:16 (Vertical)</option>
            </select>
          </label>
        </div>
        <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Recorte / Enquadramento
            <select id="athModalImgAjuste" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="contain" ${(!this.rascunho.ajuste_enquadramento || this.rascunho.ajuste_enquadramento === 'contain') ? 'selected' : ''}>Conter sem cortar (Contain)</option>
              <option value="cover" ${this.rascunho.ajuste_enquadramento === 'cover' ? 'selected' : ''}>Cobrir cortando bordas (Cover)</option>
              <option value="scale-down" ${this.rascunho.ajuste_enquadramento === 'scale-down' ? 'selected' : ''}>Reduzir se necessário</option>
              <option value="fill" ${this.rascunho.ajuste_enquadramento === 'fill' ? 'selected' : ''}>Esticar (Fill)</option>
            </select>
          </label>
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Alinhamento da Imagem
            <select id="athModalImgAlinhamento" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="center" ${(!this.rascunho.alinhamento_imagem || this.rascunho.alinhamento_imagem === 'center') ? 'selected' : ''}>Centralizado</option>
              <option value="left" ${this.rascunho.alinhamento_imagem === 'left' ? 'selected' : ''}>À Esquerda</option>
              <option value="right" ${this.rascunho.alinhamento_imagem === 'right' ? 'selected' : ''}>À Direita</option>
            </select>
          </label>
        </div>

        <div style="font-size:11px; font-weight:800; color:#314F79; text-transform:uppercase; margin-top:4px;">Tipografia e Alinhamento de Legenda e Título</div>
        <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Estilo da Legenda
            <select id="athModalLegEstilo" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="">Padrão do Bloco</option>
              ${estilos.map(e => `<option value="${e.id}" ${this.rascunho.legenda_estilo_id === e.id ? 'selected' : ''}>${e.nome}</option>`).join('')}
            </select>
          </label>
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Alinhamento da Legenda
            <select id="athModalLegAlin" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="estilo" ${(!this.rascunho.legenda_alinhamento || this.rascunho.legenda_alinhamento === 'estilo') ? 'selected' : ''}>Do estilo de texto</option>
              <option value="center" ${this.rascunho.legenda_alinhamento === 'center' ? 'selected' : ''}>Centralizado</option>
              <option value="left" ${this.rascunho.legenda_alinhamento === 'left' ? 'selected' : ''}>À Esquerda</option>
              <option value="right" ${this.rascunho.legenda_alinhamento === 'right' ? 'selected' : ''}>À Direita</option>
              <option value="justify" ${this.rascunho.legenda_alinhamento === 'justify' ? 'selected' : ''}>Justificado</option>
            </select>
          </label>
        </div>
        <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Estilo do Título
            <select id="athModalTitEstilo" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="">Padrão do Bloco</option>
              ${estilos.map(e => `<option value="${e.id}" ${this.rascunho.titulo_estilo_id === e.id ? 'selected' : ''}>${e.nome}</option>`).join('')}
            </select>
          </label>
          <label style="font-size:11.5px; font-weight:700; color:#475569;">Alinhamento do Título
            <select id="athModalTitAlin" class="glx-select" style="height:30px; font-size:11.5px;">
              <option value="estilo" ${(!this.rascunho.titulo_alinhamento || this.rascunho.titulo_alinhamento === 'estilo') ? 'selected' : ''}>Do estilo de texto</option>
              <option value="center" ${this.rascunho.titulo_alinhamento === 'center' ? 'selected' : ''}>Centralizado</option>
              <option value="left" ${this.rascunho.titulo_alinhamento === 'left' ? 'selected' : ''}>À Esquerda</option>
              <option value="right" ${this.rascunho.titulo_alinhamento === 'right' ? 'selected' : ''}>À Direita</option>
            </select>
          </label>
        </div>
      `;

      sec.appendChild(figBox);

      figBox.querySelector('#athModalImgAltura')?.addEventListener('change', e => {
        this.rascunho.altura_modo = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalImgProporcao')?.addEventListener('change', e => {
        this.rascunho.proporcao_imagem = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalImgAjuste')?.addEventListener('change', e => {
        this.rascunho.ajuste_enquadramento = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalImgAlinhamento')?.addEventListener('change', e => {
        this.rascunho.alinhamento_imagem = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalLegEstilo')?.addEventListener('change', e => {
        this.rascunho.legenda_estilo_id = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalLegAlin')?.addEventListener('change', e => {
        this.rascunho.legenda_alinhamento = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalTitEstilo')?.addEventListener('change', e => {
        this.rascunho.titulo_estilo_id = e.target.value;
        this.atualizarPrevia();
      });
      figBox.querySelector('#athModalTitAlin')?.addEventListener('change', e => {
        this.rascunho.titulo_alinhamento = e.target.value;
        this.atualizarPrevia();
      });
    }

    sec.querySelector('#athSubgradeCols')?.addEventListener('change', e => {
      this.rascunho.subgrade_colunas = parseInt(e.target.value, 10);
      this.renderizarSecaoVariaveis();
      this.atualizarPrevia();
    });
    sec.querySelector('#athPosTitulo')?.addEventListener('change', e => {
      this.rascunho.posicao_titulo = e.target.value;
      this.renderizarSecaoVariaveis();
      this.atualizarPrevia();
    });
  }

  atualizarTodosControles() {
    this.renderizarPresets();
    this.renderizarListaMolduras();
    this.renderizarSecaoVariaveis();

    const selLinhaEstilo = this.backdrop.querySelector('#athLinhaEstilo');
    if (selLinhaEstilo) selLinhaEstilo.value = this.rascunho.linha_estilo || 'solida';

    const boxSvg = this.backdrop.querySelector('#athBoxSvgCustom');
    if (boxSvg) boxSvg.style.display = this.rascunho.moldura_tipo === 'personalizado' ? 'flex' : 'none';

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

    // Se for moldura técnica, desenha esquadros nos 4 cantos
    if (this.rascunho.moldura_tipo === 'moldura_tecnica') {
      box.style.position = 'relative';
      const cantosHtml = `
        <div style="position:absolute; top:2px; left:2px; width:8px; height:8px; border-top:2px solid #314F79; border-left:2px solid #314F79;"></div>
        <div style="position:absolute; top:2px; right:2px; width:8px; height:8px; border-top:2px solid #314F79; border-right:2px solid #314F79;"></div>
        <div style="position:absolute; bottom:2px; left:2px; width:8px; height:8px; border-bottom:2px solid #314F79; border-left:2px solid #314F79;"></div>
        <div style="position:absolute; bottom:2px; right:2px; width:8px; height:8px; border-bottom:2px solid #314F79; border-right:2px solid #314F79;"></div>
      `;
      box.innerHTML = cantosHtml;
    }

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

      box.innerHTML += inner;
    } else if (this.rascunho.tipo === 'figura' || this.rascunho.tipo === 'imagem') {
      const isSubgrade2Col = this.rascunho.subgrade_colunas === 2;
      const posTit = this.rascunho.posicao_titulo || 'topo';

      const rotulo = rotuloDaFigura(this.rascunho);
      const estTit = (this.doc.estilos || []).find(e => e.id === this.rascunho.titulo_estilo_id);
      const estLeg = (this.doc.estilos || []).find(e => e.id === this.rascunho.legenda_estilo_id);

      const titAlin = (this.rascunho.titulo_alinhamento && this.rascunho.titulo_alinhamento !== 'estilo') ? this.rascunho.titulo_alinhamento : (estTit?.alinhamento || 'left');
      const legAlin = (this.rascunho.legenda_alinhamento && this.rascunho.legenda_alinhamento !== 'estilo') ? this.rascunho.legenda_alinhamento : (estLeg?.alinhamento || 'left');

      const hVal = this.rascunho.altura_modo && this.rascunho.altura_modo !== 'auto' ? (this.rascunho.altura_modo === '100%' ? '100%' : this.rascunho.altura_modo) : '90px';
      const aspRatio = this.rascunho.proporcao_imagem && this.rascunho.proporcao_imagem !== 'livre' ? `aspect-ratio: ${this.rascunho.proporcao_imagem};` : '';
      const objFit = this.rascunho.ajuste_enquadramento || 'contain';
      const imgAlin = this.rascunho.alinhamento_imagem || 'center';

      const titHtml = `<strong style="display:block; font-size:12px; font-weight:800; color:#1F2733; margin-bottom:4px; text-align:${titAlin};">${this.rascunho.titulo || `${rotulo} 1 — Ilustração Técnica`}</strong>`;
      const imgHtml = `
        <div style="background:#F1F5F9; border-radius:4px; height:${hVal}; ${aspRatio} display:grid; place-items:center; color:#64748B; object-fit:${objFit}; margin:${imgAlin === 'center' ? '0 auto' : imgAlin === 'right' ? '0 0 0 auto' : '0 auto 0 0'};">
          ${svgIcone('imagem', 28)}
          <span style="font-size:10px; font-weight:700;">Área da Ilustração / Imagem</span>
        </div>
      `;
      const legHtml = `<p style="margin:4px 0 0 0; font-size:11px; color:#475569; text-align:${legAlin};">${this.rascunho.legenda_geral || this.rascunho.legenda || 'Legenda descritiva dos elementos.'}</p>`;
      const fonteHtml = `<small style="font-size:10px; color:#64748B; margin-top:2px; display:block; text-align:${legAlin};">${this.rascunho.fonte || 'Fonte: Autores (2026).'}</small>`;

      if (isSubgrade2Col) {
        box.innerHTML += `
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
          box.innerHTML += `<div>${titHtml}${imgHtml}${legHtml}${fonteHtml}</div>`;
        } else {
          box.innerHTML += `<div>${imgHtml}${titHtml}${legHtml}${fonteHtml}</div>`;
        }
      }
    } else if (this.rascunho.tipo === 'tabela' || this.rascunho.tipo === 'quadro') {
      const isQuadro = this.rascunho.tipo === 'quadro';
      const rotuloTab = isQuadro ? 'Quadro' : 'Tabela';
      const posTit = this.rascunho.posicao_titulo || 'topo';
      const titHtml = `<strong style="display:block; font-size:12px; font-weight:800; color:#1F2733; margin-bottom:4px;">${this.rascunho.titulo || `${rotuloTab} 1 — Dados Apresentados`}</strong>`;
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
        box.innerHTML += `<div>${titHtml}${tabHtml}${fonteHtml}</div>`;
      } else {
        box.innerHTML += `<div>${tabHtml}${titHtml}${fonteHtml}</div>`;
      }
    }

    slot.appendChild(box);
  }

  ligarEventos() {
    this.backdrop.querySelector('#athModalFechar').addEventListener('click', () => this.fechar());
    this.backdrop.querySelector('#athBtnCancelar').addEventListener('click', () => this.fechar());

    // Seletor de estilo de traço (reta, quadriculada, pontilhada, tracejada, dupla)
    this.backdrop.querySelector('#athLinhaEstilo')?.addEventListener('change', e => {
      this.rascunho.linha_estilo = e.target.value;
      if (this.rascunho.linha_estilo === 'quadriculada_reta') {
        this.rascunho.raio_borda_px = 0;
      }
      this.atualizarPrevia();
    });

    // SVG Personalizado
    this.backdrop.querySelector('#athTxtSvgCustom')?.addEventListener('input', e => {
      this.rascunho.svg_custom = e.target.value;
      this.atualizarPrevia();
    });

    // Fundo e borda diretos
    this.backdrop.querySelector('#athFundoAtivo')?.addEventListener('change', e => {
      this.rascunho.fundo_ativo = e.target.checked;
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
