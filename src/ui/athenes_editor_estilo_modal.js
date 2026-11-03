// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modal Editor de Estilo Tipográfico
 * Permite editar nome, família tipográfica, tamanho (pt), peso,
 * 7 modos de formato editorial (esquerda, centro, direita, justificado com última linha...),
 * entrelinha, cor, distância entre parágrafos (Enter), recuos e hifenização com prévia ao vivo.
 */

import { svgIcone } from './athenes_icones.js';
import { ptParaMm, mmParaPt, FONTES_SISTEMA, PESOS_FONTE, estiloParaCss } from '../core/athenes_estilos.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { AVANCADO_PADRAO, cssAvancadoDosEstilos, classesAvancadasDoBloco, aplicarPalavrasIniciais, normalizarAvancado } from '../core/athenes_estilo_avancado.js';

const LBL = 'font:700 11.5px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:3px;';
const CHK = 'font-size:12px; font-weight:700; color:#334155;';
const campo = (rot, path, tipo, extra = '') => `<label style="${LBL}">${rot}<input type="${tipo}" class="ath-input" data-av="${path}" ${extra} style="height:34px; line-height:normal;${tipo === 'color' ? 'padding:1px;' : ''}"></label>`;
const marca = (rot, path) => `<label class="rm-chk" style="${CHK}"><input type="checkbox" data-av="${path}"> ${rot}</label>`;
const grupo = (titulo, ativaPath, corpo) => `<fieldset style="border:1px solid #E2E8F0; border-radius:8px; padding:8px 10px; margin:0; display:flex; flex-direction:column; gap:8px;">
  <legend style="font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:#475569; padding:0 4px;"><label style="cursor:pointer;"><input type="checkbox" data-av="${ativaPath}"> ${titulo}</label></legend>
  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px;">${corpo}</div></fieldset>`;

/** Seção "Recuos e decorações" (estilos de parágrafo avançados); os valores vêm de data-av="caminho". */
export function secaoAvancadaHtml() {
  return `<div id="athModalAvancado" style="display:flex; flex-direction:column; gap:8px;">
    <style>
      #athModalAvancado input:not([type=checkbox]), #athModalAvancado select { height:28px !important; min-height:0 !important; padding:0 8px !important; border-radius:6px !important; font:500 12px var(--glx-font) !important; color:#1F2733 !important; box-sizing:border-box; width:100%; background:#F8FAFC; border:1px solid #D5DDE8; }
      #athModalAvancado input[type=color] { padding:2px !important; cursor:pointer; }
      #athModalAvancado input[type=checkbox] { appearance:auto !important; -webkit-appearance:checkbox !important; width:14px !important; height:14px !important; min-height:0 !important; padding:0 !important; margin:0 6px 0 0 !important; border-radius:3px !important; vertical-align:-2px; accent-color:#314F79; flex:none; }
      #athModalAvancado label { gap:2px !important; }
      #athModalAvancado .rm-chk { display:inline-flex !important; flex-direction:row !important; align-items:center; gap:0 !important; white-space:nowrap; }
      #athModalAvancado fieldset { padding:6px 10px 8px !important; }
      #athModalAvancado fieldset > div { gap:6px !important; }
      #athModalAvancado legend label { display:inline-flex; flex-direction:row !important; align-items:center; }
    </style>
    <span style="font:800 11.5px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:#475569;">Recuos e decorações do parágrafo</span>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;">
      ${campo('Espaço antes (mm)', 'espaco_antes_pt', 'number', 'data-pt-em-mm step="0.5" min="0" max="42"')}
      ${campo('Espaço depois (mm)', 'espaco_depois_pt', 'number', 'data-pt-em-mm step="0.5" min="0" max="42"')}
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:8px;">
      ${campo('1ª linha (mm)', 'recuo_primeira_linha_mm', 'number', 'step="0.5" min="-50" max="100"')}
      ${campo('Esquerdo (mm)', 'recuo_esquerdo_mm', 'number', 'step="0.5" min="0" max="200"')}
      ${campo('Direito (mm)', 'recuo_direito_mm', 'number', 'step="0.5" min="0" max="200"')}
      ${campo('Deslocado (mm)', 'recuo_deslocado_mm', 'number', 'step="0.5" min="0" max="100"')}
    </div>
    ${grupo('Barra lateral', 'avancado.barra_lateral.ativa',
      `<label style="${LBL}">Lado<select class="ath-select" data-av="avancado.barra_lateral.lado" style="height:34px; line-height:normal;"><option value="esquerda">Esquerda</option><option value="direita">Direita</option></select></label>
       ${campo('Largura (pt)', 'avancado.barra_lateral.largura_pt', 'number', 'step="0.5" min="0.5" max="24"')}
       ${campo('Distância (mm)', 'avancado.barra_lateral.distancia_mm', 'number', 'step="0.5" min="0" max="20"')}
       ${campo('Cor', 'avancado.barra_lateral.cor', 'color')}
       <label style="${LBL}">Traço<select class="ath-select" data-av="avancado.barra_lateral.estilo" style="height:34px; line-height:normal;"><option value="solida">Sólido</option><option value="tracejada">Tracejado</option><option value="pontilhada">Pontilhado</option></select></label>`)}
    ${grupo('Fundo do bloco', 'avancado.fundo_bloco.ativo',
      `${campo('Cor', 'avancado.fundo_bloco.cor', 'color')}${campo('Preenchimento (mm)', 'avancado.fundo_bloco.preenchimento_mm', 'number', 'step="0.5" min="0" max="15"')}`)}
    ${grupo('Capitular (drop cap)', 'avancado.capitular.ativa',
      `${campo('Linhas', 'avancado.capitular.linhas', 'number', 'step="1" min="2" max="6"')}${campo('Cor', 'avancado.capitular.cor', 'color')}
       ${campo('Peso', 'avancado.capitular.peso', 'number', 'step="100" min="100" max="900"')}${campo('Afastamento (mm)', 'avancado.capitular.afastamento_mm', 'number', 'step="0.5" min="0" max="10"')}`)}
    ${grupo('Palavras iniciais', 'avancado.palavras_iniciais.ativa',
      `${campo('Quantidade', 'avancado.palavras_iniciais.quantidade', 'number', 'step="1" min="1" max="12"')}${campo('Peso', 'avancado.palavras_iniciais.peso', 'number', 'step="100" min="100" max="900"')}
       ${campo('Cor', 'avancado.palavras_iniciais.cor', 'color')}${marca('Caixa alta', 'avancado.palavras_iniciais.caixa_alta')}${marca('Itálico', 'avancado.palavras_iniciais.italico')}`)}
    ${grupo('Primeira linha', 'avancado.primeira_linha.ativa',
      `${campo('Peso', 'avancado.primeira_linha.peso', 'number', 'step="100" min="100" max="900"')}${campo('Cor', 'avancado.primeira_linha.cor', 'color')}
       ${campo('Espaç. letras (em)', 'avancado.primeira_linha.espacamento_letras_em', 'number', 'step="0.01" min="-0.1" max="1"')}${marca('Caixa alta', 'avancado.primeira_linha.caixa_alta')}${marca('Itálico', 'avancado.primeira_linha.italico')}`)}
    ${grupo('Ornamento de fim de texto', 'avancado.ornamento_fim.ativo',
      `${campo('Glifo', 'avancado.ornamento_fim.glifo', 'text', 'maxlength="3"')}${campo('Cor', 'avancado.ornamento_fim.cor', 'color')}
       ${campo('Tamanho (em)', 'avancado.ornamento_fim.tamanho_em', 'number', 'step="0.1" min="0.4" max="3"')}${campo('Afastamento (em)', 'avancado.ornamento_fim.afastamento_em', 'number', 'step="0.1" min="0" max="3"')}`)}
  </div>`;
}

const lerCaminho = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
function gravarCaminho(o, path, valor) {
  const ks = path.split('.');
  const ultimo = ks.pop();
  const alvo = ks.reduce((x, k) => (x[k] = x[k] && typeof x[k] === 'object' ? x[k] : {}, x[k]), o);
  alvo[ultimo] = valor;
}

/** Liga os campos data-av="caminho" de `raiz` ao rascunho do estilo (valores iniciais e alterações ao vivo). */
export function ligarCamposAvancados(raiz, rascunho, aoMudar) {
  raiz.querySelectorAll('[data-av]').forEach(inp => {
    const path = inp.dataset.av;
    const atual = lerCaminho(rascunho, path) ?? lerCaminho({ avancado: AVANCADO_PADRAO }, path); // vazio mostra o valor padrão
    const emMm = inp.hasAttribute('data-pt-em-mm'); // guardado em pt (formato do tema), mostrado em mm
    if (inp.type === 'checkbox') inp.checked = !!atual;
    else if (atual !== undefined && atual !== '') inp.value = emMm ? ptParaMm(atual) : atual;
    else if (emMm) inp.value = 0;
    else if (inp.type === 'color') inp.value = '#314F79';
    inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      let v;
      if (inp.type === 'checkbox') v = inp.checked;
      else if (inp.type === 'number') v = inp.value === '' ? 0 : (emMm ? mmParaPt(parseFloat(inp.value)) : parseFloat(inp.value));
      else v = inp.value;
      gravarCaminho(rascunho, path, v);
      aoMudar?.();
    });
  });
  // cada grupo só mostra os campos quando está ativo; desativado fica só o título com a caixa de ativar
  raiz.querySelectorAll('fieldset').forEach(fs => {
    const chave = fs.querySelector('legend input[type=checkbox]');
    const corpo = fs.querySelector(':scope > div');
    if (!chave || !corpo) return;
    const sincronizar = () => { corpo.style.display = chave.checked ? 'grid' : 'none'; fs.style.paddingBottom = chave.checked ? '' : '0'; };
    chave.addEventListener('change', sincronizar);
    sincronizar();
  });
}

/** Grava no estilo o rascunho, com o bloco avançado já saneado (sem nada ativo ele some do estilo). */
export function gravarRascunhoNoEstilo(estilo, rascunho) {
  const av = normalizarAvancado(rascunho.avancado);
  if (av) rascunho.avancado = av; else delete rascunho.avancado;
  if (!rascunho.recuo_direito_mm) delete rascunho.recuo_direito_mm;
  if (!av) delete estilo.avancado;
  if (!rascunho.recuo_direito_mm) delete estilo.recuo_direito_mm;
  Object.assign(estilo, rascunho);
}

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
    this.rascunho.avancado = JSON.parse(JSON.stringify(this.rascunho.avancado || {}));
    for (const k of Object.keys(AVANCADO_PADRAO)) this.rascunho.avancado[k] = { ...AVANCADO_PADRAO[k], ...(this.rascunho.avancado[k] || {}) };

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
            Espaço Enter (mm)
            <input type="number" id="athModalEstiloEspacoParagrafos" class="ath-input" min="0" max="17" step="0.5" value="${ptParaMm(r.espaco_paragrafos_pt ?? 6)}" style="height:34px;">
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

        ${secaoAvancadaHtml()}
      </div>

      <div class="ath-modal-rodape" style="display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid #E2E8F0; background:#F8FAFC;">
        <button type="button" class="ath-btn" id="athModalEstiloCancelar">Cancelar</button>
        <button type="button" class="ath-btn ath-btn-primary" id="athModalEstiloSalvar" style="font-weight:700;">Salvar Estilo</button>
      </div>
    `;

    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    const previaHtmlBase = modal.querySelector('#athModalEstiloPrevia')?.innerHTML || '';
    const stPrevia = document.createElement('style');
    modal.appendChild(stPrevia);
    const atualizarPrevia = () => {
      const prevEl = modal.querySelector('#athModalEstiloPrevia');
      if (prevEl) {
        const est = { ...this.rascunho, id: '__previa' };
        stPrevia.textContent = cssAvancadoDosEstilos([est]);
        prevEl.className = classesAvancadasDoBloco(est);
        prevEl.innerHTML = aplicarPalavrasIniciais(previaHtmlBase, est);
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
      this.rascunho.espaco_paragrafos_pt = mmParaPt(parseFloat(e.target.value));
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

    ligarCamposAvancados(modal, this.rascunho, atualizarPrevia);

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
      // grava o bloco avançado já saneado; sem nada ativo ele some do estilo
      const av = normalizarAvancado(this.rascunho.avancado);
      if (av) this.rascunho.avancado = av; else delete this.rascunho.avancado;
      if (!this.rascunho.recuo_direito_mm) delete this.rascunho.recuo_direito_mm;
      if (this.estiloOriginal) {
        if (!av) delete this.estiloOriginal.avancado;
        if (!this.rascunho.recuo_direito_mm) delete this.estiloOriginal.recuo_direito_mm;
        Object.assign(this.estiloOriginal, this.rascunho);
      }
      this.onSalvar(this.rascunho);
      fechar();
    });
  }
}
