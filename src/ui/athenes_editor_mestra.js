// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modal Editor de Páginas Mestras (Fixas e Progressivas)
 * Nível Affinity Publisher / InDesign:
 * Permite configurar formato, orientação, margens, grade 2D (Fixa) ou colunas de fluxo (Progressiva),
 * cabeçalho, rodapé, numeração e elementos recorrentes (molduras, tarjas, rótulos e marcas d'água)
 * com manipulação interativa e prévia fiel em tempo real.
 */

import { svgIcone } from './athenes_icones.js';
import { repaginarDocumento, formatarNumeroPagina, criarElementoMestra, removerMestra } from '../core/athenes_documento.js';

export class ModalEditorMestra {
  constructor(documento, mestraId, opcoes = {}) {
    this.doc = documento;
    this.mestraOriginal = (this.doc.mestras || []).find(m => m.id === mestraId) || this.doc.mestras?.[0];
    this.onSalvar = opcoes.onSalvar || (() => {});
    this.onFechar = opcoes.onFechar || (() => {});

    // Cria clone profundo para rascunho de edição sem mutar imediatamente
    this.rascunho = JSON.parse(JSON.stringify(this.mestraOriginal || {}));
    if (!this.rascunho.grade_2d) {
      this.rascunho.grade_2d = { linhas: 3, colunas: 3, gap_mm: 4 };
    }
    if (!this.rascunho.grade) {
      this.rascunho.grade = { colunas: 1, gap_mm: 0 };
    }
    if (!this.rascunho.margens_mm) {
      this.rascunho.margens_mm = { t: 25, r: 20, b: 20, l: 25 };
    }
    if (!Array.isArray(this.rascunho.elementos_recorrentes)) {
      this.rascunho.elementos_recorrentes = [];
    }

    this.elementoSelecionadoId = null;
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
    modal.style.maxWidth = '980px';
    modal.style.width = '96%';
    modal.style.height = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';

    modal.innerHTML = `
      <div class="ath-modal-head" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--ath-primary-line, #C8D7E6); padding:14px 20px; flex:none;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:8px; background:var(--ath-primary-soft, #EEF4FA); color:var(--ath-primary, #314F79); display:grid; place-items:center;">
            ${svgIcone('lapis', 18)}
          </div>
          <div>
            <h2 style="margin:0; font:800 16px var(--glx-font); color:var(--ath-text, #1F2733);">Editor de Página Mestra</h2>
            <p style="margin:2px 0 0 0; font-size:12px; color:var(--glx-muted, #6B7585);" id="athMestraSubtitulo">
              ${this.rascunho.nome} · Modo <span class="rm-selo" id="athMestraModoSelo">${this.rascunho.modo_aplicacao === 'fixa' ? 'Fixa · Grade 2D' : 'Progressiva · Fluxo'}</span>
            </p>
          </div>
        </div>
        <button type="button" class="rm-ic" id="athBtnFecharMestraModal" title="Fechar" style="background:none; border:none; cursor:pointer;">
          ${svgIcone('fechar', 18)}
        </button>
      </div>

      <div class="ath-modal-corpo" style="display:grid; grid-template-columns: 1.15fr 1fr; gap:20px; padding:20px; overflow-y:auto; flex:1;">
        <!-- COLUNA ESQUERDA: CONTROLES E ELEMENTOS -->
        <div class="ath-mestra-controles" style="display:flex; flex-direction:column; gap:14px;">
          <!-- 1. Identificação e Modo -->
          <div class="rm-card" style="padding:14px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px;">
            <label style="display:block; font:700 12px var(--glx-font); margin-bottom:6px;">Nome da Página Mestra
              <input type="text" id="athMestraNome" class="glx-input" style="width:100%; margin-top:4px;" value="${this.rascunho.nome || ''}">
            </label>

            <div style="margin-top:10px;">
              <span style="display:block; font:700 12px var(--glx-font); margin-bottom:6px;">Modo de Aplicação</span>
              <div class="ath-btn-grupo" style="display:flex; gap:6px;">
                <button type="button" class="glx-btn glx-btn-sm ${this.rascunho.modo_aplicacao === 'progressiva' ? 'glx-btn-primary' : 'glx-btn-soft'}" id="athModoProgressiva" style="flex:1;">
                  Progressiva (Fluxo)
                </button>
                <button type="button" class="glx-btn glx-btn-sm ${this.rascunho.modo_aplicacao === 'fixa' ? 'glx-btn-primary' : 'glx-btn-soft'}" id="athModoFixa" style="flex:1;">
                  Fixa (Grade 2D)
                </button>
              </div>
              <small style="display:block; margin-top:6px; font-size:11.5px; color:var(--glx-muted, #6B7585);" id="athModoAjuda">
                ${this.rascunho.modo_aplicacao === 'fixa' 
                  ? 'Fixa: cria página individual para capas e pranchas com grade bidimensional livre.' 
                  : 'Progressiva: gera páginas automaticamente conforme o fluxo de blocos de texto cresce.'}
              </small>
            </div>
          </div>

          <!-- 2. Formato e Orientação -->
          <div class="rm-card" style="padding:14px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px;">
            <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <label style="font:700 12px var(--glx-font);">Formato da Folha
                <select id="athMestraFormato" class="glx-select" style="width:100%; margin-top:4px;">
                  <option value="a4" ${this.rascunho.formato === 'a4' ? 'selected' : ''}>A4 (210 × 297 mm)</option>
                  <option value="carta" ${this.rascunho.formato === 'carta' ? 'selected' : ''}>Carta (216 × 279 mm)</option>
                  <option value="a3" ${this.rascunho.formato === 'a3' ? 'selected' : ''}>A3 (297 × 420 mm)</option>
                </select>
              </label>
              <label style="font:700 12px var(--glx-font);">Orientação
                <select id="athMestraOrientacao" class="glx-select" style="width:100%; margin-top:4px;">
                  <option value="retrato" ${this.rascunho.orientacao === 'retrato' ? 'selected' : ''}>Retrato (Vertical)</option>
                  <option value="paisagem" ${this.rascunho.orientacao === 'paisagem' ? 'selected' : ''}>Paisagem (Horizontal)</option>
                </select>
              </label>
            </div>

            <!-- Margens em mm -->
            <div style="margin-top:12px;">
              <span style="display:block; font:700 12px var(--glx-font); margin-bottom:6px;">Margens da Folha (mm)</span>
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
                <label style="font-size:11px; color:var(--glx-muted);">Topo
                  <input type="number" id="athMestraMargemT" class="glx-input" style="width:100%; padding:4px 6px;" min="5" max="60" value="${this.rascunho.margens_mm.t || 25}">
                </label>
                <label style="font-size:11px; color:var(--glx-muted);">Direita
                  <input type="number" id="athMestraMargemR" class="glx-input" style="width:100%; padding:4px 6px;" min="5" max="60" value="${this.rascunho.margens_mm.r || 20}">
                </label>
                <label style="font-size:11px; color:var(--glx-muted);">Base
                  <input type="number" id="athMestraMargemB" class="glx-input" style="width:100%; padding:4px 6px;" min="5" max="60" value="${this.rascunho.margens_mm.b || 20}">
                </label>
                <label style="font-size:11px; color:var(--glx-muted);">Esquerda
                  <input type="number" id="athMestraMargemL" class="glx-input" style="width:100%; padding:4px 6px;" min="5" max="60" value="${this.rascunho.margens_mm.l || 25}">
                </label>
              </div>
            </div>
          </div>

          <!-- 3. Configuração de Grade / Colunas -->
          <div class="rm-card" id="athBoxGradeConfig" style="padding:14px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px;">
            <div id="athCfgGradeFixa" style="${this.rascunho.modo_aplicacao === 'fixa' ? '' : 'display:none;'}">
              <span style="display:block; font:700 12px var(--glx-font); margin-bottom:6px;">Grade Bidimensional 2D (Linhas × Colunas)</span>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                <label style="font-size:11px; color:var(--glx-muted);">Linhas
                  <input type="number" id="athGradeLinhas" class="glx-input" style="width:100%;" min="1" max="12" value="${this.rascunho.grade_2d?.linhas || 3}">
                </label>
                <label style="font-size:11px; color:var(--glx-muted);">Colunas
                  <input type="number" id="athGradeColunas" class="glx-input" style="width:100%;" min="1" max="12" value="${this.rascunho.grade_2d?.colunas || 3}">
                </label>
                <label style="font-size:11px; color:var(--glx-muted);">Gutter (mm)
                  <input type="number" id="athGradeGap" class="glx-input" style="width:100%;" min="0" max="25" value="${this.rascunho.grade_2d?.gap_mm || 4}">
                </label>
              </div>
              <small style="display:block; margin-top:6px; font-size:11px; color:var(--glx-muted);">Permite posicionar caixas livremente nas células combinadas da grade como no editor de pranchas.</small>
            </div>

            <div id="athCfgGradeProgressiva" style="${this.rascunho.modo_aplicacao === 'progressiva' ? '' : 'display:none;'}">
              <span style="display:block; font:700 12px var(--glx-font); margin-bottom:6px;">Colunas de Fluxo Contínuo</span>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <label style="font-size:11px; color:var(--glx-muted);">Número de Colunas
                  <select id="athFluxoColunas" class="glx-select" style="width:100%;">
                    <option value="1" ${(this.rascunho.grade?.colunas || 1) === 1 ? 'selected' : ''}>1 Coluna (Padrão ABNT/Monografia)</option>
                    <option value="2" ${(this.rascunho.grade?.colunas || 1) === 2 ? 'selected' : ''}>2 Colunas (Artigo IEEE/Periódico)</option>
                    <option value="3" ${(this.rascunho.grade?.colunas || 1) === 3 ? 'selected' : ''}>3 Colunas (Newsletter / Boletim)</option>
                  </select>
                </label>
                <label style="font-size:11px; color:var(--glx-muted);">Espaço entre colunas (mm)
                  <input type="number" id="athFluxoGap" class="glx-input" style="width:100%;" min="2" max="20" step="0.5" value="${this.rascunho.grade?.gap_mm || 4.5}">
                </label>
              </div>
              <small style="display:block; margin-top:6px; font-size:11px; color:var(--glx-muted);">O texto corre de cima a baixo na primeira coluna, passa para a seguinte e abre nova página automaticamente.</small>
            </div>
          </div>

          <!-- 4. Elementos da Mestra (Nível Editorial) -->
          <div class="rm-card" style="padding:14px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font:800 12px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--ath-primary, #314F79);">
                Elementos da Mestra (<span id="athContagemElementos">${this.rascunho.elementos_recorrentes?.length || 0}</span>)
              </span>
            </div>

            <!-- Botões de Adição Rápida de Elementos na Mestra (Quadrados Discretos com Tooltip) -->
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
              <button type="button" class="ath-btn-elem-quadrado" id="athBtnAddElemMoldura" title="Adicionar Moldura (Grade 2D ou Coordenadas mm)">
                ${svgIcone('quadro', 16)}
              </button>
              <button type="button" class="ath-btn-elem-quadrado" id="athBtnAddElemTarja" title="Adicionar Tarja Decorativa">
                ${svgIcone('divisor', 16)}
              </button>
              <button type="button" class="ath-btn-elem-quadrado" id="athBtnAddElemRotulo" title="Adicionar Rótulo Fixo">
                ${svgIcone('titulo', 16)}
              </button>
              <button type="button" class="ath-btn-elem-quadrado" id="athBtnAddElemMarca" title="Adicionar Marca d'Água">
                ${svgIcone('imagem', 16)}
              </button>
              <button type="button" class="ath-btn-elem-quadrado" id="athBtnAddElemFotoCapa" title="Adicionar Foto de Capa Livre (Coordenadas mm / Sangria Total)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
            </div>

            <!-- Lista dos Elementos Inseridos -->
            <div id="athListaElementosMestra" style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto; padding-right:2px;"></div>
          </div>

          <!-- 5. Cabeçalho e Rodapé -->
          <div class="rm-card" style="padding:14px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px;">
            <label class="rm-chk" style="font:700 12px var(--glx-font);">
              <input type="checkbox" id="athMestraCabAtivo" ${this.rascunho.cabecalho?.ativo ? 'checked' : ''}>
              Exibir Cabeçalho
            </label>
            <div id="athBoxCabCampos" style="margin-top:8px; display:${this.rascunho.cabecalho?.ativo ? 'flex' : 'none'}; flex-direction:column; gap:6px;">
              <input type="text" id="athMestraCabTexto" class="glx-input" style="width:100%;" placeholder="Texto ou {{documento.titulo}}" value="${this.rascunho.cabecalho?.texto || ''}">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label style="font-size:11px; color:var(--glx-muted);">Alinhamento:
                  <select id="athMestraCabAlin" class="glx-select" style="padding:2px 8px; font-size:11px;">
                    <option value="esquerda" ${this.rascunho.cabecalho?.alinhamento === 'esquerda' ? 'selected' : ''}>Esquerda</option>
                    <option value="centro" ${this.rascunho.cabecalho?.alinhamento === 'centro' ? 'selected' : ''}>Centro</option>
                    <option value="direita" ${this.rascunho.cabecalho?.alinhamento === 'direita' ? 'selected' : ''}>Direita</option>
                  </select>
                </label>
                <label class="rm-chk" style="font-size:11px;">
                  <input type="checkbox" id="athMestraCabLinha" ${this.rascunho.cabecalho?.linha_divisoria ? 'checked' : ''}> Linha divisória
                </label>
              </div>
            </div>

            <div style="margin-top:12px; border-top:1px dashed var(--ath-primary-line, #C8D7E6); padding-top:10px;">
              <label class="rm-chk" style="font:700 12px var(--glx-font);">
                <input type="checkbox" id="athMestraRodAtivo" ${this.rascunho.rodape?.ativo ? 'checked' : ''}>
                Exibir Rodapé Institucional
              </label>
              <div id="athBoxRodCampos" style="margin-top:8px; display:${this.rascunho.rodape?.ativo ? 'flex' : 'none'}; flex-direction:column; gap:6px;">
                <input type="text" id="athMestraRodTexto" class="glx-input" style="width:100%;" placeholder="Texto do rodapé institucional" value="${this.rascunho.rodape?.texto || ''}">
                
                <!-- Configurações Completas de Numeração de Página -->
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:4px; padding:10px; background:#fff; border-radius:6px; border:1px solid var(--ath-primary-line, #C8D7E6);">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label class="rm-chk" style="font-size:11.5px; font-weight:700;">
                      <input type="checkbox" id="athMestraRodNum" ${this.rascunho.rodape?.numeracao !== false ? 'checked' : ''}> Numerar Páginas
                    </label>
                    <label class="rm-chk" style="font-size:11px;">
                      <input type="checkbox" id="athMestraRodOcultarCapa" ${this.rascunho.rodape?.ocultar_na_capa !== false ? 'checked' : ''}> Ocultar na Capa
                    </label>
                  </div>

                  <div id="athBoxRodNumOpcoes" style="display:${this.rascunho.rodape?.numeracao !== false ? 'flex' : 'none'}; flex-direction:column; gap:6px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                      <label style="font-size:11px; color:var(--glx-muted);">Formato:
                        <select id="athMestraRodFormato" class="glx-select" style="width:100%; font-size:11px; padding:2px 6px;">
                          <option value="apenas_numero" ${this.rascunho.rodape?.formato === 'apenas_numero' ? 'selected' : ''}>Apenas Número (ex: 3)</option>
                          <option value="n_de_total" ${(!this.rascunho.rodape?.formato || this.rascunho.rodape?.formato === 'n_de_total') ? 'selected' : ''}>N de Total (ex: 3 de 27)</option>
                          <option value="n_of_total" ${this.rascunho.rodape?.formato === 'n_of_total' ? 'selected' : ''}>N of Total (ex: 3 of 27 — MDPI)</option>
                          <option value="pagina_n" ${this.rascunho.rodape?.formato === 'pagina_n' ? 'selected' : ''}>Página N (ex: Página 3)</option>
                          <option value="pagina_n_de_total" ${this.rascunho.rodape?.formato === 'pagina_n_de_total' ? 'selected' : ''}>Página N de Total (ex: Página 3 de 27)</option>
                          <option value="romano_min" ${this.rascunho.rodape?.formato === 'romano_min' ? 'selected' : ''}>Romano Minúsculo (ex: iii)</option>
                          <option value="romano_mai" ${this.rascunho.rodape?.formato === 'romano_mai' ? 'selected' : ''}>Romano Maiúsculo (ex: III)</option>
                          <option value="hifen" ${this.rascunho.rodape?.formato === 'hifen' ? 'selected' : ''}>Hífen (ex: - 3 -)</option>
                          <option value="personalizado" ${this.rascunho.rodape?.formato === 'personalizado' ? 'selected' : ''}>Personalizado ({p}/{total})</option>
                        </select>
                      </label>
                      <label style="font-size:11px; color:var(--glx-muted);">Alinhamento:
                        <select id="athMestraRodPos" class="glx-select" style="width:100%; font-size:11px; padding:2px 6px;">
                          <option value="direita" ${this.rascunho.rodape?.posicao_numero === 'direita' ? 'selected' : ''}>À Direita</option>
                          <option value="centro" ${this.rascunho.rodape?.posicao_numero === 'centro' ? 'selected' : ''}>Centralizado</option>
                          <option value="esquerda" ${this.rascunho.rodape?.posicao_numero === 'esquerda' ? 'selected' : ''}>À Esquerda</option>
                          <option value="alternado" ${this.rascunho.rodape?.posicao_numero === 'alternado' ? 'selected' : ''}>Alternado (Espelhado / Livro)</option>
                        </select>
                      </label>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                      <label style="font-size:11px; color:var(--glx-muted);">Prefixo:
                        <input type="text" id="athMestraRodPrefixo" class="glx-input" placeholder="Ex: Artigo · " value="${this.rascunho.rodape?.prefixo || ''}" style="width:100%; font-size:11px; padding:2px 6px;">
                      </label>
                      <label style="font-size:11px; color:var(--glx-muted);">Sufixo:
                        <input type="text" id="athMestraRodSufixo" class="glx-input" placeholder="Ex:  · MDPI" value="${this.rascunho.rodape?.sufixo || ''}" style="width:100%; font-size:11px; padding:2px 6px;">
                      </label>
                    </div>

                    <div id="athMestraBoxMascaraPers" style="display:${this.rascunho.rodape?.formato === 'personalizado' ? 'block' : 'none'};">
                      <label style="font-size:11px; color:var(--glx-muted);">Máscara ({p} = pág, {total} = total):
                        <input type="text" id="athMestraRodMascara" class="glx-input" placeholder="Ex: Folha {p}/{total}" value="${this.rascunho.rodape?.mascara || '{p} de {total}'}" style="width:100%; font-size:11px; padding:2px 6px;">
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- COLUNA DIREITA: PRÉVIA INTERATIVA DA FOLHA MESTRA COM ELEMENTOS -->
        <div class="ath-mestra-previa-wrap" style="display:flex; flex-direction:column; align-items:center; background:#E5E9F0; border-radius:8px; padding:16px; overflow:hidden;">
          <div style="font:800 11.5px var(--glx-font); color:var(--ath-primary-ink, #1B2D47); margin-bottom:10px; display:flex; justify-content:space-between; width:100%;">
            <span>Prévia da Folha Mestra</span>
            <span id="athPreviaDimensoes">A4 Retrato (210 × 297 mm)</span>
          </div>

          <div style="flex:1; width:100%; display:grid; place-items:center; overflow:auto;">
            <div id="athPreviaFolhaMestra" style="background:#fff; box-shadow:0 6px 18px rgba(0,0,0,0.12); position:relative; transition:all 0.2s ease;">
              <!-- Elementos SVG / HTML desenhados dinamicamente via atualizarPreviaVisual() -->
            </div>
          </div>

          <div style="margin-top:12px; width:100%; font-size:11px; color:var(--ath-text-secondary, #475569); text-align:center;" id="athPreviaAvisoUso">
            Esta mestra propaga todos os seus elementos automaticamente para as páginas do documento.
          </div>
        </div>
      </div>

      <div class="ath-modal-foot" style="padding:12px 20px; border-top:1px solid var(--ath-primary-line, #C8D7E6); background:var(--ath-surface-elevated, #F8FAFC); display:flex; justify-content:space-between; align-items:center; flex:none;">
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="glx-btn glx-btn-perigo glx-btn-sm" id="athBtnExcluirMestra" style="display:flex; align-items:center; gap:6px; color:#DC2626; border-color:#FECACA; background:#FEF2F2;" title="Excluir esta página mestra do catálogo">
            ${svgIcone('lixeira', 13)} Excluir Mestra
          </button>
          <span style="font-size:11.5px; color:var(--glx-muted, #6B7585);">Alterações serão aplicadas mantendo todos os blocos e textos.</span>
        </div>
        <div style="display:flex; gap:10px;">
          <button type="button" class="glx-btn glx-btn-soft" id="athBtnCancelarMestra">Cancelar</button>
          <button type="button" class="glx-btn glx-btn-primary" id="athBtnSalvarMestra">Salvar Página Mestra</button>
        </div>
      </div>
    `;

    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    this.vincularEventos(modal);
    this.renderizarListaElementos(modal);
    this.atualizarPreviaVisual();
  }

  renderizarListaElementos(modal) {
    const listaEl = modal.querySelector('#athListaElementosMestra');
    const contagemEl = modal.querySelector('#athContagemElementos');
    if (!listaEl) return;

    const elems = this.rascunho.elementos_recorrentes || [];
    if (contagemEl) contagemEl.textContent = elems.length;

    listaEl.innerHTML = '';
    if (elems.length === 0) {
      listaEl.innerHTML = `
        <div style="font-size:11.5px; color:var(--glx-muted, #6B7585); text-align:center; padding:10px; background:rgba(0,0,0,0.02); border-radius:6px; border:1px dashed var(--ath-primary-line, #C8D7E6);">
          Nenhum elemento decorativo recorrente adicionado nesta mestra.
        </div>
      `;
      return;
    }

    elems.forEach((elem) => {
      const item = document.createElement('div');
      item.className = `ath-mestra-elem-item ${elem.id === this.elementoSelecionadoId ? 'ativo' : ''}`;
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '6px';
      item.style.padding = '8px 10px';
      item.style.borderRadius = '6px';
      item.style.background = '#fff';
      item.style.border = `1px solid ${elem.id === this.elementoSelecionadoId ? 'var(--ath-primary, #314F79)' : 'var(--ath-primary-line, #C8D7E6)'}`;

      let iconeNome = 'quadro';
      let tipoRotulo = 'Moldura';
      if (elem.tipo === 'tarja') { iconeNome = 'divisor'; tipoRotulo = 'Tarja Decorativa'; }
      else if (elem.tipo === 'rotulo_estatico') { iconeNome = 'titulo'; tipoRotulo = 'Rótulo Fixo'; }
      else if (elem.tipo === 'marca_dagua') { iconeNome = 'imagem'; tipoRotulo = 'Marca d\'Água'; }
      else if (elem.tipo === 'foto_capa') { iconeNome = 'imagem'; tipoRotulo = 'Foto de Capa Livre'; }

      const modoCoord = elem.posicionamento_modo === 'coordenadas' || elem.tipo === 'foto_capa';

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="color:var(--ath-primary, #314F79); display:grid; place-items:center;">${svgIcone(iconeNome, 14)}</span>
            <strong style="font-size:12px; color:var(--ath-text, #1F2733);">${elem.titulo || tipoRotulo}</strong>
          </div>
          <button type="button" class="rm-ic rm-ic-perigo" data-del-elem="${elem.id}" title="Remover elemento" style="padding:2px;">
            ${svgIcone('fechar', 12)}
          </button>
        </div>

        ${elem.tipo === 'caixa_grade' ? `
          <div style="display:flex; align-items:center; gap:6px; font-size:11px;">
            <span style="color:var(--glx-muted);">Posicionamento:</span>
            <select class="glx-select" data-prop="posicionamento_modo" style="padding:1px 6px; font-size:11px; flex:1;">
              <option value="grade" ${elem.posicionamento_modo !== 'coordenadas' ? 'selected' : ''}>Grade 2D (Linhas / Colunas)</option>
              <option value="coordenadas" ${elem.posicionamento_modo === 'coordenadas' ? 'selected' : ''}>Coordenadas Exatas (mm)</option>
            </select>
          </div>
        ` : ''}

        <div style="display:flex; flex-direction:column; gap:5px; font-size:11px;">
          ${elem.tipo === 'foto_capa' ? `
            <input type="text" class="glx-input" data-prop="url" value="${elem.url || ''}" placeholder="URL ou caminho da imagem (ex: capa.jpg)" style="width:100%; padding:2px 6px; font-size:11px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <label class="rm-chk" style="font-size:11px;">
                <input type="checkbox" data-prop-chk="sangria" ${elem.sangria !== false ? 'checked' : ''}> Sangria Total (0 mm)
              </label>
              <label style="display:flex; align-items:center; gap:4px;">Camada:
                <select class="glx-select" data-prop="camada" style="padding:1px 6px; font-size:11px;">
                  <option value="fundo" ${elem.camada !== 'frente' ? 'selected' : ''}>No Fundo (Atrás)</option>
                  <option value="frente" ${elem.camada === 'frente' ? 'selected' : ''}>Na Frente</option>
                </select>
              </label>
            </div>
            ${elem.sangria === false ? `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin:2px 0;">
                <button type="button" class="glx-btn glx-btn-xs ${elem.respeitar_recuo ? 'glx-btn-primary' : 'glx-btn-soft'}" data-toggle-recuo style="display:flex; align-items:center; gap:5px; font-weight:700; width:100%; justify-content:center;" title="Alinha este elemento às margens da folha (recuo)">
                  <span>${svgIcone('margem', 12)} Respeitar Recuo da Página: <strong>${elem.respeitar_recuo ? 'Ativado (Margens)' : 'Desativado (Livre)'}</strong></span>
                </button>
              </div>
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;">
                <label>X: <input type="number" class="glx-input" data-prop="x_mm" value="${elem.x_mm || 0}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                <label>Y: <input type="number" class="glx-input" data-prop="y_mm" value="${elem.y_mm || 0}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                <label>Larg: <input type="number" class="glx-input" data-prop="largura_mm" value="${elem.largura_mm || 210}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                <label>Alt: <input type="number" class="glx-input" data-prop="altura_mm" value="${elem.altura_mm || 140}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
              </div>
            ` : ''}
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="display:flex; align-items:center; gap:4px; flex:1;">Opacidade:
                <input type="number" class="glx-input" data-prop="opacidade" step="0.05" min="0.05" max="1" value="${elem.opacidade !== undefined ? elem.opacidade : 1}" style="width:48px; padding:1px 4px; font-size:11px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px;">Ajuste:
                <select class="glx-select" data-prop="ajuste" style="padding:1px 6px; font-size:11px;">
                  <option value="cover" ${elem.ajuste !== 'contain' ? 'selected' : ''}>Cobrir (Cover)</option>
                  <option value="contain" ${elem.ajuste === 'contain' ? 'selected' : ''}>Conter (Contain)</option>
                </select>
              </label>
            </div>
          ` : elem.tipo === 'tarja' ? `
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="display:flex; align-items:center; gap:4px; flex:1;">Posição:
                <select class="glx-select" data-prop="posicao" style="padding:1px 6px; font-size:11px; width:100%;">
                  <option value="topo" ${elem.posicao === 'topo' ? 'selected' : ''}>Topo</option>
                  <option value="base" ${elem.posicao === 'base' ? 'selected' : ''}>Base</option>
                  <option value="lateral_esquerda" ${elem.posicao === 'lateral_esquerda' ? 'selected' : ''}>Lateral Esq.</option>
                </select>
              </label>
              <label style="display:flex; align-items:center; gap:4px;">Altura:
                <input type="number" class="glx-input" data-prop="altura_mm" value="${elem.altura_mm || 8}" style="width:45px; padding:1px 4px; font-size:11px;">mm
              </label>
              <input type="color" data-prop="cor" value="${elem.cor || '#314F79'}" style="width:24px; height:20px; border:none; background:none; cursor:pointer;" title="Cor">
            </div>
          ` : elem.tipo === 'rotulo_estatico' ? `
            <input type="text" class="glx-input" data-prop="texto" value="${elem.texto || ''}" placeholder="Texto institucional fixo" style="width:100%; padding:2px 6px; font-size:11px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="display:flex; align-items:center; gap:4px;">Afastamento Topo (Y):
                <input type="number" class="glx-input" data-prop="y_mm" value="${elem.y_mm || 12}" style="width:45px; padding:1px 4px; font-size:11px;">mm
              </label>
              <label style="display:flex; align-items:center; gap:4px;">Tamanho:
                <input type="number" class="glx-input" data-prop="tamanho_pt" value="${elem.tamanho_pt || 10}" style="width:40px; padding:1px 4px; font-size:11px;">pt
              </label>
              <input type="color" data-prop="cor" value="${elem.cor || '#314F79'}" style="width:24px; height:20px; border:none; background:none; cursor:pointer;" title="Cor">
            </div>
          ` : elem.tipo === 'marca_dagua' ? `
            <input type="text" class="glx-input" data-prop="texto" value="${elem.texto || 'RASCUNHO'}" style="width:100%; padding:2px 6px; font-size:11px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="display:flex; align-items:center; gap:4px; flex:1;">Opacidade:
                <input type="number" class="glx-input" data-prop="opacidade" step="0.05" min="0.05" max="0.5" value="${elem.opacidade || 0.12}" style="width:50px; padding:1px 4px; font-size:11px;">
              </label>
              <input type="color" data-prop="cor" value="${elem.cor || '#314F79'}" style="width:24px; height:20px; border:none; background:none; cursor:pointer;" title="Cor">
            </div>
          ` : `
            <input type="text" class="glx-input" data-prop="titulo" value="${elem.titulo || 'Moldura'}" placeholder="Nome do Quadro" style="width:100%; padding:2px 6px; font-size:11px;">
            ${elem.posicionamento_modo === 'coordenadas' ? `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                <label class="rm-chk" style="font-size:11px;">
                  <input type="checkbox" data-prop-chk="sangria" ${elem.sangria ? 'checked' : ''}> Sangria Total (0 mm)
                </label>
                <input type="color" data-prop="cor" value="${elem.cor || '#314F79'}" style="width:24px; height:20px; border:none; background:none; cursor:pointer;" title="Cor da Borda">
              </div>
              ${!elem.sangria ? `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin:2px 0;">
                  <button type="button" class="glx-btn glx-btn-xs ${elem.respeitar_recuo ? 'glx-btn-primary' : 'glx-btn-soft'}" data-toggle-recuo style="display:flex; align-items:center; gap:5px; font-weight:700; width:100%; justify-content:center;" title="Alinha este quadro às margens da folha (recuo)">
                    <span>${svgIcone('margem', 12)} Respeitar Recuo da Página: <strong>${elem.respeitar_recuo ? 'Ativado (Margens)' : 'Desativado (Livre)'}</strong></span>
                  </button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;">
                  <label>X: <input type="number" class="glx-input" data-prop="x_mm" value="${elem.x_mm || 20}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                  <label>Y: <input type="number" class="glx-input" data-prop="y_mm" value="${elem.y_mm || 20}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                  <label>Larg: <input type="number" class="glx-input" data-prop="largura_mm" value="${elem.largura_mm || 170}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                  <label>Alt: <input type="number" class="glx-input" data-prop="altura_mm" value="${elem.altura_mm || 50}" style="width:100%; padding:1px 3px; font-size:10.5px;">mm</label>
                </div>
              ` : ''}
            ` : `
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="display:flex; align-items:center; gap:4px;">Linha:
                  <input type="number" class="glx-input" data-prop="linha" min="1" max="12" value="${elem.linha || 1}" style="width:36px; padding:1px 4px; font-size:11px;">
                </label>
                <label style="display:flex; align-items:center; gap:4px;">Col:
                  <input type="number" class="glx-input" data-prop="coluna" min="1" max="12" value="${elem.coluna || 1}" style="width:36px; padding:1px 4px; font-size:11px;">
                </label>
                <label style="display:flex; align-items:center; gap:4px;">Span Lin:
                  <input type="number" class="glx-input" data-prop="spanLinhas" min="1" max="6" value="${elem.spanLinhas || 1}" style="width:36px; padding:1px 4px; font-size:11px;">
                </label>
                <label style="display:flex; align-items:center; gap:4px;">Span Col:
                  <input type="number" class="glx-input" data-prop="spanColunas" min="1" max="6" value="${elem.spanColunas || 3}" style="width:36px; padding:1px 4px; font-size:11px;">
                </label>
                <input type="color" data-prop="cor" value="${elem.cor || '#314F79'}" style="width:24px; height:20px; border:none; background:none; cursor:pointer;" title="Cor">
              </div>
            `}
          `}
        </div>
      `;

      item.addEventListener('click', e => {
        if (e.target.closest('[data-del-elem]') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        this.elementoSelecionadoId = elem.id;
        this.renderizarListaElementos(modal);
        this.atualizarPreviaVisual();
      });

      item.querySelector('[data-del-elem]').addEventListener('click', e => {
        e.stopPropagation();
        this.rascunho.elementos_recorrentes = this.rascunho.elementos_recorrentes.filter(x => x.id !== elem.id);
        if (this.elementoSelecionadoId === elem.id) this.elementoSelecionadoId = null;
        this.renderizarListaElementos(modal);
        this.atualizarPreviaVisual();
      });

      item.querySelectorAll('[data-prop]').forEach(inp => {
        const handler = () => {
          const prop = inp.dataset.prop;
          let val = inp.value;
          if (inp.type === 'number') val = parseFloat(val) || 0;
          elem[prop] = val;
          if (prop === 'posicionamento_modo') {
            this.renderizarListaElementos(modal);
          }
          this.atualizarPreviaVisual();
        };
        inp.addEventListener('input', handler);
        inp.addEventListener('change', handler);
      });

      item.querySelectorAll('[data-prop-chk]').forEach(chk => {
        chk.addEventListener('change', () => {
          const prop = chk.dataset.propChk;
          elem[prop] = chk.checked;
          this.renderizarListaElementos(modal);
          this.atualizarPreviaVisual();
        });
      });

      item.querySelectorAll('[data-toggle-recuo]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          elem.respeitar_recuo = !elem.respeitar_recuo;
          this.renderizarListaElementos(modal);
          this.atualizarPreviaVisual();
        });
      });

      listaEl.appendChild(item);
    });
  }

  vincularEventos(modal) {
    const fechar = () => {
      if (this.backdrop && this.backdrop.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop);
      }
      this.onFechar();
    };

    modal.querySelector('#athBtnFecharMestraModal').addEventListener('click', fechar);
    modal.querySelector('#athBtnCancelarMestra').addEventListener('click', fechar);

    const btnExcluir = modal.querySelector('#athBtnExcluirMestra');
    if (btnExcluir) {
      if ((this.doc.mestras || []).length <= 1) {
        btnExcluir.disabled = true;
        btnExcluir.title = 'Não é possível excluir a única página mestra do documento';
        btnExcluir.style.opacity = '0.5';
        btnExcluir.style.cursor = 'not-allowed';
      } else {
        btnExcluir.addEventListener('click', () => {
          const secoesQueUsam = (this.doc.secoes || []).filter(s => s.mestraId === this.rascunho.id);
          let msg = `Tem certeza que deseja excluir a página mestra "${this.mestraOriginal?.nome || this.rascunho.nome}"?`;
          if (secoesQueUsam.length > 0) {
            msg = `Esta página mestra está em uso por ${secoesQueUsam.length} seção(ões) do documento.\nAo excluí-la, essas seções serão vinculadas à primeira mestra restante.\n\nDeseja continuar?`;
          }
          if (window.confirm && !window.confirm(msg)) return;
          removerMestra(this.doc, this.rascunho.id);
          fechar();
          this.onSalvar();
        });
      }
    }

    this.backdrop.addEventListener('click', e => {
      if (e.target === this.backdrop) fechar();
    });

    // Nome
    const inpNome = modal.querySelector('#athMestraNome');
    inpNome.addEventListener('input', e => {
      this.rascunho.nome = e.target.value;
      modal.querySelector('#athMestraSubtitulo').firstChild.textContent = `${this.rascunho.nome} · Modo `;
    });

    // Modos Fixa vs Progressiva
    const btnProg = modal.querySelector('#athModoProgressiva');
    const btnFixa = modal.querySelector('#athModoFixa');
    const boxFixa = modal.querySelector('#athCfgGradeFixa');
    const boxProg = modal.querySelector('#athCfgGradeProgressiva');
    const ajudaModo = modal.querySelector('#athModoAjuda');
    const seloModo = modal.querySelector('#athMestraModoSelo');

    btnProg.addEventListener('click', () => {
      this.rascunho.modo_aplicacao = 'progressiva';
      btnProg.className = 'glx-btn glx-btn-sm glx-btn-primary';
      btnFixa.className = 'glx-btn glx-btn-sm glx-btn-soft';
      boxProg.style.display = '';
      boxFixa.style.display = 'none';
      ajudaModo.textContent = 'Progressiva: gera páginas automaticamente conforme o fluxo de blocos de texto cresce.';
      seloModo.textContent = 'Progressiva · Fluxo';
      this.atualizarPreviaVisual();
    });

    btnFixa.addEventListener('click', () => {
      this.rascunho.modo_aplicacao = 'fixa';
      btnFixa.className = 'glx-btn glx-btn-sm glx-btn-primary';
      btnProg.className = 'glx-btn glx-btn-sm glx-btn-soft';
      boxFixa.style.display = '';
      boxProg.style.display = 'none';
      ajudaModo.textContent = 'Fixa: cria página individual para capas e pranchas com grade bidimensional livre.';
      seloModo.textContent = 'Fixa · Grade 2D';
      this.atualizarPreviaVisual();
    });

    // Formato e Orientação
    modal.querySelector('#athMestraFormato').addEventListener('change', e => {
      this.rascunho.formato = e.target.value;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraOrientacao').addEventListener('change', e => {
      this.rascunho.orientacao = e.target.value;
      this.atualizarPreviaVisual();
    });

    // Margens
    const atualizarMargens = () => {
      this.rascunho.margens_mm.t = parseFloat(modal.querySelector('#athMestraMargemT').value) || 20;
      this.rascunho.margens_mm.r = parseFloat(modal.querySelector('#athMestraMargemR').value) || 20;
      this.rascunho.margens_mm.b = parseFloat(modal.querySelector('#athMestraMargemB').value) || 20;
      this.rascunho.margens_mm.l = parseFloat(modal.querySelector('#athMestraMargemL').value) || 20;
      this.atualizarPreviaVisual();
    };
    ['T', 'R', 'B', 'L'].forEach(lado => {
      modal.querySelector(`#athMestraMargem${lado}`).addEventListener('input', atualizarMargens);
    });

    // Grade 2D
    const atualizarGrade2D = () => {
      this.rascunho.grade_2d = {
        linhas: parseInt(modal.querySelector('#athGradeLinhas').value, 10) || 3,
        colunas: parseInt(modal.querySelector('#athGradeColunas').value, 10) || 3,
        gap_mm: parseFloat(modal.querySelector('#athGradeGap').value) || 4
      };
      this.atualizarPreviaVisual();
    };
    ['Linhas', 'Colunas', 'Gap'].forEach(k => {
      modal.querySelector(`#athGrade${k}`).addEventListener('input', atualizarGrade2D);
    });

    // Colunas de Fluxo
    modal.querySelector('#athFluxoColunas').addEventListener('change', e => {
      this.rascunho.grade.colunas = parseInt(e.target.value, 10) || 1;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athFluxoGap').addEventListener('input', e => {
      this.rascunho.grade.gap_mm = parseFloat(e.target.value) || 4.5;
      this.atualizarPreviaVisual();
    });

    // Cabeçalho
    const chkCab = modal.querySelector('#athMestraCabAtivo');
    const boxCab = modal.querySelector('#athBoxCabCampos');
    chkCab.addEventListener('change', () => {
      if (!this.rascunho.cabecalho) this.rascunho.cabecalho = {};
      this.rascunho.cabecalho.ativo = chkCab.checked;
      boxCab.style.display = chkCab.checked ? 'flex' : 'none';
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraCabTexto').addEventListener('input', e => {
      this.rascunho.cabecalho.texto = e.target.value;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraCabAlin').addEventListener('change', e => {
      this.rascunho.cabecalho.alinhamento = e.target.value;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraCabLinha').addEventListener('change', e => {
      this.rascunho.cabecalho.linha_divisoria = e.target.checked;
      this.atualizarPreviaVisual();
    });

    // Rodapé
    const chkRod = modal.querySelector('#athMestraRodAtivo');
    const boxRod = modal.querySelector('#athBoxRodCampos');
    chkRod.addEventListener('change', () => {
      if (!this.rascunho.rodape) this.rascunho.rodape = {};
      this.rascunho.rodape.ativo = chkRod.checked;
      boxRod.style.display = chkRod.checked ? 'flex' : 'none';
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodTexto').addEventListener('input', e => {
      this.rascunho.rodape.texto = e.target.value;
      this.atualizarPreviaVisual();
    });
    const chkRodNum = modal.querySelector('#athMestraRodNum');
    const boxRodNumOpcoes = modal.querySelector('#athBoxRodNumOpcoes');
    chkRodNum.addEventListener('change', () => {
      this.rascunho.rodape.numeracao = chkRodNum.checked;
      if (boxRodNumOpcoes) boxRodNumOpcoes.style.display = chkRodNum.checked ? 'flex' : 'none';
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodOcultarCapa')?.addEventListener('change', e => {
      this.rascunho.rodape.ocultar_na_capa = e.target.checked;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodFormato')?.addEventListener('change', e => {
      this.rascunho.rodape.formato = e.target.value;
      const boxMascara = modal.querySelector('#athMestraBoxMascaraPers');
      if (boxMascara) boxMascara.style.display = e.target.value === 'personalizado' ? 'block' : 'none';
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodPos')?.addEventListener('change', e => {
      this.rascunho.rodape.posicao_numero = e.target.value;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodPrefixo')?.addEventListener('input', e => {
      this.rascunho.rodape.prefixo = e.target.value;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodSufixo')?.addEventListener('input', e => {
      this.rascunho.rodape.sufixo = e.target.value;
      this.atualizarPreviaVisual();
    });
    modal.querySelector('#athMestraRodMascara')?.addEventListener('input', e => {
      this.rascunho.rodape.mascara = e.target.value;
      this.atualizarPreviaVisual();
    });

    // Ações de Adicionar Elementos (Botões Quadrados)
    modal.querySelector('#athBtnAddElemMoldura').addEventListener('click', () => {
      const novo = criarElementoMestra('caixa_grade', {
        titulo: 'Moldura',
        coluna: 1,
        spanColunas: this.rascunho.grade_2d?.colunas || 3,
        spanLinhas: 1,
        cor: '#314F79'
      });
      this.rascunho.elementos_recorrentes.push(novo);
      this.elementoSelecionadoId = novo.id;
      this.renderizarListaElementos(modal);
      this.atualizarPreviaVisual();
    });

    modal.querySelector('#athBtnAddElemTarja').addEventListener('click', () => {
      const novo = criarElementoMestra('tarja', {
        titulo: 'Tarja Decorativa',
        posicao: 'topo',
        altura_mm: 8,
        cor: '#314F79'
      });
      this.rascunho.elementos_recorrentes.push(novo);
      this.elementoSelecionadoId = novo.id;
      this.renderizarListaElementos(modal);
      this.atualizarPreviaVisual();
    });

    modal.querySelector('#athBtnAddElemRotulo').addEventListener('click', () => {
      const novo = criarElementoMestra('rotulo_estatico', {
        titulo: 'Rótulo Institucional',
        texto: 'UNIVERSIDADE / INSTITUTO DE PESQUISA',
        cor: '#314F79',
        tamanho_pt: 10,
        y_mm: 12
      });
      this.rascunho.elementos_recorrentes.push(novo);
      this.elementoSelecionadoId = novo.id;
      this.renderizarListaElementos(modal);
      this.atualizarPreviaVisual();
    });

    modal.querySelector('#athBtnAddElemMarca').addEventListener('click', () => {
      const novo = criarElementoMestra('marca_dagua', {
        titulo: 'Marca d\'Água',
        texto: 'VERSÃO PRELIMINAR',
        cor: '#314F79',
        opacidade: 0.12
      });
      this.rascunho.elementos_recorrentes.push(novo);
      this.elementoSelecionadoId = novo.id;
      this.renderizarListaElementos(modal);
      this.atualizarPreviaVisual();
    });

    modal.querySelector('#athBtnAddElemFotoCapa').addEventListener('click', () => {
      const paisagem = this.rascunho.orientacao === 'paisagem';
      const novo = criarElementoMestra('foto_capa', {
        titulo: 'Foto de Capa Livre',
        sangria: true,
        largura_mm: paisagem ? 297 : 210,
        altura_mm: 140,
        url: '',
        opacidade: 1,
        camada: 'fundo'
      });
      this.rascunho.elementos_recorrentes.push(novo);
      this.elementoSelecionadoId = novo.id;
      this.renderizarListaElementos(modal);
      this.atualizarPreviaVisual();
    });

    // Botão Salvar
    modal.querySelector('#athBtnSalvarMestra').addEventListener('click', () => {
      Object.assign(this.mestraOriginal, this.rascunho);
      repaginarDocumento(this.doc);
      this.onSalvar(this.mestraOriginal);
      fechar();
    });
  }

  atualizarPreviaVisual() {
    if (!this.backdrop) return;
    const container = this.backdrop.querySelector('#athPreviaFolhaMestra');
    const dimRotulo = this.backdrop.querySelector('#athPreviaDimensoes');
    if (!container) return;

    const r = this.rascunho;
    const paisagem = r.orientacao === 'paisagem';
    const larguraMm = paisagem ? 297 : 210;
    const alturaMm = paisagem ? 210 : 297;

    dimRotulo.textContent = `${r.formato?.toUpperCase() || 'A4'} ${paisagem ? 'Paisagem' : 'Retrato'} (${larguraMm} × ${alturaMm} mm)`;

    // Escala para caber perfeitamente na visualização
    const escala = 1.05;
    const larguraPx = larguraMm * escala;
    const alturaPx = alturaMm * escala;

    container.style.width = `${larguraPx}px`;
    container.style.height = `${alturaPx}px`;

    const m = r.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
    const mT = (m.t || 20) * escala;
    const mR = (m.r || 20) * escala;
    const mB = (m.b || 20) * escala;
    const mL = (m.l || 20) * escala;

    let gradeHtml = '';

    if (r.modo_aplicacao === 'fixa') {
      const lin = r.grade_2d?.linhas || 3;
      const col = r.grade_2d?.colunas || 3;
      const gap = (r.grade_2d?.gap_mm || 4) * escala;

      gradeHtml = `
        <div style="
          position:absolute; inset: ${mT}px ${mR}px ${mB}px ${mL}px;
          display:grid;
          grid-template-columns: repeat(${col}, 1fr);
          grid-template-rows: repeat(${lin}, 1fr);
          gap: ${gap}px;
          border: 1px dashed var(--ath-primary, #314F79);
          background: rgba(49, 79, 121, 0.03);
          box-sizing: border-box;
          padding: 2px;
          z-index: 1;
        ">
          ${Array.from({ length: lin * col }).map((_, idx) => `
            <div style="border: 1px dotted rgba(49, 79, 121, 0.28); border-radius: 2px; display:grid; place-items:center; font-size:8px; color:var(--ath-primary, #314F79); font-weight:700;">
              ${idx + 1}
            </div>
          `).join('')}
        </div>
      `;
    } else {
      const colunas = r.grade?.colunas || 1;
      const gap = (r.grade?.gap_mm || 4.5) * escala;

      gradeHtml = `
        <div style="
          position:absolute; inset: ${mT}px ${mR}px ${mB}px ${mL}px;
          display:grid;
          grid-template-columns: repeat(${colunas}, 1fr);
          gap: ${gap}px;
          border: 1px dashed var(--ath-primary, #314F79);
          background: rgba(49, 79, 121, 0.03);
          box-sizing: border-box;
          padding: 4px;
          z-index: 1;
        ">
          ${Array.from({ length: colunas }).map((_, idx) => `
            <div style="border: 1px solid rgba(49, 79, 121, 0.2); background: rgba(255,255,255,0.7); border-radius: 2px; padding: 4px; display:flex; flex-direction:column; gap:4px;">
              <div style="height:6px; width:70%; background:var(--ath-primary-line, #C8D7E6); border-radius:1px;"></div>
              <div style="height:4px; width:100%; background:rgba(49, 79, 121, 0.12); border-radius:1px;"></div>
              <div style="height:4px; width:95%; background:rgba(49, 79, 121, 0.12); border-radius:1px;"></div>
              <div style="height:4px; width:85%; background:rgba(49, 79, 121, 0.12); border-radius:1px;"></div>
              <div style="height:4px; width:90%; background:rgba(49, 79, 121, 0.12); border-radius:1px;"></div>
              <span style="margin-top:auto; font-size:7px; font-weight:700; color:var(--ath-primary, #314F79); text-align:center;">Coluna ${idx + 1}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Renderização dos Elementos Recorrentes
    let elementosHtml = '';
    (r.elementos_recorrentes || []).forEach(elem => {
      const sel = elem.id === this.elementoSelecionadoId;
      const bordaSel = sel ? 'outline: 2px solid var(--ath-primary, #314F79); outline-offset: 1px;' : '';

      if (elem.tipo === 'foto_capa') {
        const sangria = !!elem.sangria;
        const respRecuo = !sangria && !!elem.respeitar_recuo;
        const topPx = sangria ? 0 : (respRecuo ? mT + (elem.y_mm || 0) * escala : (elem.y_mm || 0) * escala);
        const leftPx = sangria ? 0 : (respRecuo ? mL + (elem.x_mm || 0) * escala : (elem.x_mm || 0) * escala);
        const wPx = sangria ? larguraPx : (respRecuo ? larguraPx - mL - mR : (elem.largura_mm || 210) * escala);
        const hPx = sangria ? alturaPx : (elem.altura_mm || 140) * escala;
        const imgUrl = elem.url || '';

        elementosHtml += `
          <div style="position:absolute; top:${topPx}px; left:${leftPx}px; width:${wPx}px; height:${hPx}px; overflow:hidden; z-index:${elem.camada === 'frente' ? 4 : 0}; ${bordaSel} cursor:pointer; background:#CBD5E1;" data-elem-id="${elem.id}">
            ${imgUrl ? `
              <img src="${imgUrl}" style="width:100%; height:100%; object-fit:${elem.ajuste || 'cover'}; opacity:${elem.opacidade !== undefined ? elem.opacidade : 1}; display:block;" onerror="this.style.display='none';"/>
            ` : `
              <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:linear-gradient(135deg, #EEF4FA, #D5E3F0); color:#314F79; font-size:9px; font-weight:700; text-align:center; padding:8px; box-sizing:border-box;">
                <span style="font-size:16px; margin-bottom:2px;">🖼</span>
                <span>Foto de Capa Livre</span>
                <span style="font-size:7.5px; opacity:0.8;">${sangria ? 'Sangria Total (Folha Inteira)' : `${elem.largura_mm || 210} × ${elem.altura_mm || 140} mm`}</span>
              </div>
            `}
          </div>
        `;
      } else if (elem.tipo === 'tarja') {
        const altPx = (elem.altura_mm || 8) * escala;
        let posCss = '';
        if (elem.posicao === 'topo') posCss = `top:0; left:0; right:0; height:${altPx}px;`;
        else if (elem.posicao === 'base') posCss = `bottom:0; left:0; right:0; height:${altPx}px;`;
        else posCss = `top:0; bottom:0; left:0; width:${altPx}px;`;

        elementosHtml += `
          <div style="position:absolute; ${posCss} background:${elem.cor || '#314F79'}; ${bordaSel} z-index:2; cursor:pointer;" data-elem-id="${elem.id}"></div>
        `;
      } else if (elem.tipo === 'marca_dagua') {
        elementosHtml += `
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-35deg); font-size:24px; font-weight:900; letter-spacing:4px; color:${elem.cor || '#314F79'}; opacity:${elem.opacidade || 0.12}; text-transform:uppercase; white-space:nowrap; pointer-events:none; z-index:0;">
            ${elem.texto || 'VERSÃO PRELIMINAR'}
          </div>
        `;
      } else if (elem.tipo === 'rotulo_estatico') {
        const yPx = (elem.y_mm || 12) * escala;
        elementosHtml += `
          <div style="position:absolute; top:${yPx}px; left:${mL}px; right:${mR}px; text-align:center; font-size:8.5px; font-weight:800; color:${elem.cor || '#314F79'}; ${bordaSel} z-index:3; cursor:pointer;" data-elem-id="${elem.id}">
            ${elem.texto || 'Rótulo da Mestra'}
          </div>
        `;
      } else if (elem.tipo === 'caixa_grade') {
        if (elem.posicionamento_modo === 'coordenadas') {
          const sangria = !!elem.sangria;
          const topPx = sangria ? 0 : (elem.y_mm || 20) * escala;
          const leftPx = sangria ? 0 : (elem.x_mm || 20) * escala;
          const wPx = sangria ? larguraPx : (elem.largura_mm || 170) * escala;
          const hPx = sangria ? alturaPx : (elem.altura_mm || 50) * escala;

          elementosHtml += `
            <div style="
              position:absolute; top:${topPx}px; left:${leftPx}px; width:${wPx}px; height:${hPx}px;
              background:${elem.fundo || 'rgba(49, 79, 121, 0.05)'};
              border: 1px solid ${elem.cor || '#314F79'};
              border-radius: 3px; display:flex; align-items:flex-start; padding:4px;
              font-size:7.5px; font-weight:700; color:${elem.cor || '#314F79'};
              ${bordaSel} z-index:${elem.camada === 'frente' ? 4 : 1}; cursor:pointer; box-sizing:border-box;
            " data-elem-id="${elem.id}">
              <span>${elem.titulo || 'Moldura'} (${sangria ? 'Sangria Total' : `${elem.largura_mm || 170}×${elem.altura_mm || 50}mm`})</span>
            </div>
          `;
        } else {
          const lin = r.grade_2d?.linhas || 3;
          const col = r.grade_2d?.colunas || 3;
          const cellH = (alturaPx - mT - mB) / lin;
          const cellW = (larguraPx - mL - mR) / col;
          const topPx = mT + ((elem.linha || 1) - 1) * cellH;
          const leftPx = mL + ((elem.coluna || 1) - 1) * cellW;
          const wPx = Math.max(cellW * (elem.spanColunas || 1) - 4, 20);
          const hPx = Math.max(cellH * (elem.spanLinhas || 1) - 4, 20);

          elementosHtml += `
            <div style="
              position:absolute; top:${topPx}px; left:${leftPx}px; width:${wPx}px; height:${hPx}px;
              background:${elem.fundo || 'rgba(49, 79, 121, 0.05)'};
              border: 1px solid ${elem.cor || '#314F79'};
              border-radius: 3px; display:flex; align-items:flex-start; padding:4px;
              font-size:7.5px; font-weight:700; color:${elem.cor || '#314F79'};
              ${bordaSel} z-index:4; cursor:pointer; box-sizing:border-box;
            " data-elem-id="${elem.id}">
              <span>${elem.titulo || 'Quadro'}</span>
            </div>
          `;
        }
      }
    });

    // Cabeçalho e Rodapé na prévia
    let cabHtml = '';
    if (r.cabecalho?.ativo) {
      cabHtml = `
        <div style="
          position:absolute; top: ${mT - 16}px; left: ${mL}px; right: ${mR}px;
          font-size: 8px; font-weight: 700; color: var(--ath-primary, #314F79);
          text-align: ${r.cabecalho.alinhamento || 'direita'};
          border-bottom: ${r.cabecalho.linha_divisoria ? '1px solid var(--ath-primary-line, #C8D7E6)' : 'none'};
          padding-bottom: 2px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; z-index:5;
        ">
          ${r.cabecalho.texto || 'Título do Documento'}
        </div>
      `;
    }

    let rodHtml = '';
    if (r.rodape?.ativo) {
      const numExemplo = r.rodape.numeracao !== false
        ? formatarNumeroPagina(2, 27, { ...r.rodape, ocultar_na_capa: false })
        : '';
      const pos = r.rodape.posicao_numero || 'direita';
      let estiloFlex = 'justify-content:space-between;';
      if (pos === 'centro') estiloFlex = 'justify-content:center; gap:16px;';
      else if (pos === 'esquerda') estiloFlex = 'flex-direction:row-reverse; justify-content:space-between;';

      rodHtml = `
        <div style="
          position:absolute; bottom: ${mB - 14}px; left: ${mL}px; right: ${mR}px;
          font-size: 8px; color: var(--ath-text-secondary, #475569);
          display:flex; ${estiloFlex} align-items:center;
          border-top: 1px solid var(--ath-primary-line, #C8D7E6); padding-top: 2px; z-index:5;
        ">
          <span>${r.rodape.texto || 'Athenes'}</span>
          ${numExemplo ? `<strong>${numExemplo}</strong>` : ''}
        </div>
      `;
    }

    container.innerHTML = `
      ${elementosHtml}
      ${cabHtml}
      ${gradeHtml}
      ${rodHtml}
    `;

    // Clique interativo nos elementos da folha mestra
    container.querySelectorAll('[data-elem-id]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.elementoSelecionadoId = el.dataset.elemId;
        const modal = this.backdrop.querySelector('.ath-modal');
        if (modal) this.renderizarListaElementos(modal);
        this.atualizarPreviaVisual();
      });
    });
  }
}
