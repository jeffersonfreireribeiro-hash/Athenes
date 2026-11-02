// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modal Editor de Estilo Tipográfico
 * Permite editar nome, família tipográfica, tamanho (pt), peso,
 * 7 modos de formato editorial (esquerda, centro, direita, justificado com última linha...),
 * entrelinha, cor, distância entre parágrafos (Enter), recuos e hifenização com prévia ao vivo.
 */

import { svgIcone } from './athenes_icones.js';
import { FONTES_SISTEMA, PESOS_FONTE, estiloParaCss } from '../core/athenes_estilos.js';
import { escapeHtml } from '../core/athenes_seguranca.js';

export class ModalEditorEstilo {
  constructor(documento, estilo, opcoes = {}) {
    this.doc = documento;
    this.estiloOriginal = estilo;
    this.onSalvar = opcoes.onSalvar || (() => {});
    this.onFechar = opcoes.onFechar || (() => {});

    // Rascunho clonado
    this.rascunho = JSON.parse(JSON.stringify(estilo || {}));
    if (!this.rascunho.fonte) this.rascunho.fonte = 'nunito';
    if (!this.rascunho.tamanho_pt) this.rascunho.tamanho_pt = 12;
    if (!this.rascunho.peso) this.rascunho.peso = 400;
    if (!this.rascunho.alinhamento) this.rascunho.alinhamento = 'justificado_esquerda';
    if (!this.rascunho.entrelinha) this.rascunho.entrelinha = 1.5;
    if (this.rascunho.espaco_paragrafos_pt === undefined) this.rascunho.espaco_paragrafos_pt = 6;
    if (!this.rascunho.cor) this.rascunho.cor = '#1F2733';

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
    modal.style.maxWidth = '640px';
    modal.style.width = '94%';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.overflow = 'hidden';

    const r = this.rascunho;
    const alinAtivo = r.alinhamento || 'justificado_esquerda';
    const corAtiva = r.cor || '#1F2733';

    modal.innerHTML = `
      <div class="ath-modal-head" style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #E2E8F0;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#314F79;">${svgIcone('lapis', 18)}</span>
          <h2 style="margin:0; font:800 16px var(--glx-font); color:#1E293B;">Editar Estilo: ${escapeHtml(r.nome || 'Estilo')}</h2>
        </div>
        <button type="button" class="ath-btn ath-btn-icon" id="athModalEstiloFechar" title="Fechar">${svgIcone('fechar', 16)}</button>
      </div>

      <div class="ath-modal-corpo" style="padding:16px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; flex:1;">
        <!-- Prévia do Estilo em Tempo Real -->
        <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:10px; padding:14px 16px;">
          <div style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:6px;">Prévia do Texto</div>
          <div id="athModalEstiloPrevia" style="min-height:56px; max-height:100px; overflow-y:auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px; ${estiloParaCss(r)}">
            Este é um exemplo de parágrafo formatado com o estilo <strong>${escapeHtml(r.nome || '')}</strong>. O texto reflete a tipografia, entrelinha, espaçamento e alinhamento em tempo real.
          </div>
        </div>

        <!-- Identificação -->
        <label style="font:700 12px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:4px;">
          Nome do Estilo
          <input type="text" id="athModalEstiloNome" class="ath-input" value="${escapeHtml(r.nome || '')}" style="height:34px; font-size:12.5px;">
        </label>

        <!-- Fonte e Peso -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <label style="font:700 12px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:4px;">
            Família Tipográfica
            <select id="athModalEstiloFonte" class="ath-select" style="height:34px; font-size:12.5px;">
              ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}" ${f.id === (r.fonte || 'nunito') ? 'selected' : ''}>${f.rotulo}</option>`).join('')}
            </select>
          </label>
          <label style="font:700 12px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:4px;">
            Peso da Fonte
            <select id="athModalEstiloPeso" class="ath-select" style="height:34px; font-size:12.5px;">
              ${PESOS_FONTE.map(p => `<option value="${p.valor}" ${p.valor === (r.peso || 400) ? 'selected' : ''}>${p.rotulo}</option>`).join('')}
            </select>
          </label>
        </div>

        <!-- Tamanho e Entrelinha -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
          <label style="font:700 12px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:4px;">
            Tamanho (pt)
            <input type="number" id="athModalEstiloTamanho" class="ath-input" min="6" max="72" step="0.5" value="${r.tamanho_pt || 12}" style="height:34px;">
          </label>
          <label style="font:700 12px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:4px;">
            Entrelinha
            <input type="number" id="athModalEstiloEntrelinha" class="ath-input" step="0.05" min="1" max="3" value="${r.entrelinha || 1.5}" style="height:34px;">
          </label>
          <label style="font:700 12px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:4px;">
            Espaço Enter (pt)
            <input type="number" id="athModalEstiloEspacoParagrafos" class="ath-input" min="0" max="48" step="1" value="${r.espaco_paragrafos_pt ?? 6}" style="height:34px;">
          </label>
        </div>

        <!-- 7 Modos de Formato / Alinhamento -->
        <div>
          <span style="display:block; font:800 11.5px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:#475569; margin-bottom:6px;">
            Formato / Alinhamento Editorial (7 Modos)
          </span>
          <div class="rm-icg rm-icg-formato" style="width:100%; box-sizing:border-box;">
            <button type="button" class="rm-ic-bt ${alinAtivo === 'esquerda' ? 'on' : ''}" data-alin="esquerda" title="Alinhar à esquerda">
              ${svgIcone('alinhamento_esq', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'centro' ? 'on' : ''}" data-alin="centro" title="Centralizado">
              ${svgIcone('alinhamento_cen', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'direita' ? 'on' : ''}" data-alin="direita" title="Alinhar à direita">
              ${svgIcone('alinhamento_dir', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado' ? 'on' : ''}" data-alin="justificado" title="Justificado total">
              ${svgIcone('alinhamento_jus', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_esquerda' ? 'on' : ''}" data-alin="justificado_esquerda" title="Justificado com última linha à esquerda (Padrão ABNT)">
              ${svgIcone('alinhamento_jus_esq', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_centro' ? 'on' : ''}" data-alin="justificado_centro" title="Justificado com última linha centralizada">
              ${svgIcone('alinhamento_jus_cen', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_direita' ? 'on' : ''}" data-alin="justificado_direita" title="Justificado com última linha à direita">
              ${svgIcone('alinhamento_jus_dir', 16)}
            </button>
          </div>
        </div>

        <!-- Cor e Opções Adicionais -->
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-top:2px;">
          <label style="font:700 12px var(--glx-font); color:#334155; display:flex; align-items:center; gap:8px;">
            Cor do Texto:
            <input type="color" id="athModalEstiloCor" value="${corAtiva.startsWith('#') ? corAtiva : '#1F2733'}" style="width:36px; height:28px; border:1px solid #CBD5E1; border-radius:6px; cursor:pointer;">
          </label>
          <label class="rm-chk" style="font-size:12.5px; font-weight:700; color:#334155;">
            <input type="checkbox" id="athModalEstiloItalico" ${r.italico ? 'checked' : ''}> Itálico
          </label>
          <label class="rm-chk" style="font-size:12.5px; font-weight:700; color:#334155;">
            <input type="checkbox" id="athModalEstiloSublinhado" ${r.sublinhado ? 'checked' : ''}> Sublinhado
          </label>
          <label class="rm-chk" style="font-size:12.5px; font-weight:700; color:#334155;">
            <input type="checkbox" id="athModalEstiloHifen" ${r.hifenizacao ? 'checked' : ''}> Hifenização (a-b)
          </label>
        </div>
      </div>

      <div class="ath-modal-rodape" style="display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid #E2E8F0; background:#F8FAFC;">
        <button type="button" class="ath-btn" id="athModalEstiloCancelar">Cancelar</button>
        <button type="button" class="ath-btn ath-btn-primary" id="athModalEstiloSalvar" style="font-weight:700;">Salvar Estilo</button>
      </div>
    `;

    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    const atualizarPrevia = () => {
      const prevEl = modal.querySelector('#athModalEstiloPrevia');
      if (prevEl) {
        prevEl.style.cssText = `min-height:56px; max-height:100px; overflow-y:auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px; ${estiloParaCss(this.rascunho)}`;
      }
    };

    modal.querySelector('#athModalEstiloNome').addEventListener('input', e => {
      this.rascunho.nome = e.target.value;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloFonte').addEventListener('change', e => {
      this.rascunho.fonte = e.target.value;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloPeso').addEventListener('change', e => {
      this.rascunho.peso = parseInt(e.target.value, 10);
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloTamanho').addEventListener('input', e => {
      this.rascunho.tamanho_pt = parseFloat(e.target.value) || 12;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloEntrelinha').addEventListener('input', e => {
      this.rascunho.entrelinha = parseFloat(e.target.value) || 1.5;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloEspacoParagrafos').addEventListener('input', e => {
      this.rascunho.espaco_paragrafos_pt = parseInt(e.target.value, 10) || 0;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloCor').addEventListener('input', e => {
      this.rascunho.cor = e.target.value;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloItalico').addEventListener('change', e => {
      this.rascunho.italico = e.target.checked;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloSublinhado').addEventListener('change', e => {
      this.rascunho.sublinhado = e.target.checked;
      atualizarPrevia();
    });

    modal.querySelector('#athModalEstiloHifen').addEventListener('change', e => {
      this.rascunho.hifenizacao = e.target.checked;
      atualizarPrevia();
    });

    modal.querySelectorAll('[data-alin]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('[data-alin]').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        this.rascunho.alinhamento = btn.dataset.alin;
        atualizarPrevia();
      });
    });

    const fechar = () => {
      this.backdrop?.remove();
      this.onFechar();
    };

    modal.querySelector('#athModalEstiloFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalEstiloCancelar').addEventListener('click', fechar);

    modal.querySelector('#athModalEstiloSalvar').addEventListener('click', () => {
      if (this.estiloOriginal) {
        Object.assign(this.estiloOriginal, this.rascunho);
      }
      this.onSalvar(this.rascunho);
      fechar();
    });
  }
}
