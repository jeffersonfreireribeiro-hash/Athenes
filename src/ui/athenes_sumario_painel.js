// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel de propriedades do bloco Sumário: escopo de níveis, preenchimento de linha,
 * tipografia nível a nível, alinhamento/espaçamento e numeração decimal das seções do documento.
 */

import { FONTES_SISTEMA } from '../core/athenes_estilos.js';
import {
  NIVEL_MAX, normalizarConfigSumario, configEfetivaSumario, normalizarNumeracaoSecoes, nivelPadrao
} from '../core/athenes_sumario.js';
import { svgIcone } from './athenes_icones.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NIVEL_ATIVO_POR_BLOCO = new Map();
const SECOES_ABERTAS_POR_BLOCO = new Map(); // o painel é recriado a cada alteração: lembra quais seções estão abertas
const ROTULO_PROFUNDIDADE = (n) => (n === 1 ? 'Apenas nível 1' : n === 2 ? 'Níveis 1 e 2' : `Níveis 1 a ${n}`);

const CSS = `
.ath-sum { display: flex; flex-direction: column; gap: 10px; font: 500 12px var(--glx-font, 'Nunito', sans-serif); color: #1F2733; }
.ath-sum * { box-sizing: border-box; }

/* Topo do painel */
.ath-sum-topo { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 10px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.ath-sum-topo-info { display: flex; align-items: center; min-width: 0; width: 100%; }
.ath-sum-chip { display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 11px; font-weight: 800; padding: 0 10px; border-radius: 999px; height: 28px; white-space: nowrap; width: 100%; }
.ath-sum-chip.padrao { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
.ath-sum-chip.custom { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
.ath-sum-topo-acoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 6px; width: 100%; }
.ath-sum-btn-topo { height: 32px; padding: 0 8px; font-size: 11px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; white-space: nowrap; width: 100%; cursor: pointer; }
.ath-sum-btn-topo:hover { background: #F1F5F9; border-color: #94A3B8; color: #1E293B; }

/* Cards colapsáveis */
.ath-sum details { border: 1px solid #E2E8F0; border-radius: 12px; background: #fff; padding: 0 12px; transition: border-color .15s, box-shadow .15s; }
.ath-sum details[open] { padding-bottom: 12px; border-color: #CBD5E1; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
.ath-sum summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; padding: 11px 0; font: 800 11px var(--glx-font, inherit); letter-spacing: .05em; text-transform: uppercase; color: var(--ath-primary, #314F79); }
.ath-sum summary::-webkit-details-marker { display: none; }
.ath-sum summary::before { content: ''; width: 6px; height: 6px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform .15s; flex: none; }
.ath-sum details[open] > summary::before { transform: rotate(45deg); }
.ath-sum .corpo { display: flex; flex-direction: column; gap: 10px; }

/* Campos e formulários */
.ath-sum .grade2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ath-sum .grade-fonte { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.8fr); gap: 8px; }
.ath-sum .campo-full { grid-column: 1 / -1; width: 100%; }
.ath-sum .grade3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.ath-sum .grade4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }

.ath-sum input[type=text], .ath-sum input[type=number], .ath-sum select {
  width: 100%; height: 32px !important; padding: 0 9px !important; border: 1px solid #CBD5E1; border-radius: 8px !important; background: #F8FAFC; font: 600 12px var(--glx-font, inherit); color: #1F2733;
}
.ath-sum input:focus, .ath-sum select:focus { outline: none; border-color: var(--ath-primary, #314F79); box-shadow: 0 0 0 2px rgba(49, 79, 121, 0.15); background: #fff; }

.ath-sum input[type=color] { appearance: none; -webkit-appearance: none; width: 100%; height: 32px !important; padding: 3px !important; border: 1px solid #CBD5E1; border-radius: 8px !important; background: #fff; cursor: pointer; }
.ath-sum input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
.ath-sum input[type=color]::-webkit-color-swatch { border: 0; border-radius: 5px; }

/* Barra de níveis 1 a 9 */
.ath-sum-niveis-wrap { display: flex; flex-direction: column; gap: 6px; }
.ath-sum-niveis-rotulo { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #475569; }
.ath-sum-niveis-rotulo b { color: var(--ath-primary, #314F79); }
.ath-sum-niveis-barra { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; background: #F1F5F9; padding: 3px; border-radius: 10px; border: 1px solid #E2E8F0; }
.ath-sum-niveis-barra button {
  height: 28px; border: none; border-radius: 7px; background: transparent; color: #64748B; font: 800 11px var(--glx-font, inherit); cursor: pointer; transition: all .15s;
}
.ath-sum-niveis-barra button:hover:not(.on) { background: #E2E8F0; color: #1E293B; }
.ath-sum-niveis-barra button.fora { opacity: .4; }
.ath-sum-niveis-barra button.on { background: var(--ath-primary, #314F79); color: #fff; box-shadow: 0 1px 3px rgba(49, 79, 121, 0.3); }

/* Botão interruptor booleano de linha */
.ath-sum-switch-linha {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 11px; background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 11.5px; font-weight: 700; color: #334155; cursor: pointer; user-select: none; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); transition: all .15s ease;
}
.ath-sum-switch-linha:hover { border-color: #94A3B8; background: #F8FAFC; }
.ath-sum-switch-linha.on, .ath-sum-switch-linha:has(input:checked) {
  background: #EFF6FF; border-color: var(--ath-primary, #314F79); color: #1E3A8A; box-shadow: 0 1px 3px rgba(49, 79, 121, 0.14);
}
.ath-sum .interruptor { display: inline-flex; align-items: center; cursor: pointer; margin: 0; flex-shrink: 0; }
.ath-sum .interruptor input {
  appearance: none; -webkit-appearance: none; width: 38px !important; height: 22px !important; margin: 0; border-radius: 999px !important; border: 1.5px solid #94A3B8 !important; background: #CBD5E1 !important; position: relative; cursor: pointer; transition: background .15s, border-color .15s; flex-shrink: 0;
}
.ath-sum .interruptor input::after {
  content: '' !important; position: absolute; top: 2px; left: 2px; width: 15px !important; height: 15px !important; border: 0 !important; border-radius: 50% !important; background: #fff !important; box-shadow: 0 1px 2px rgba(15,23,42,.3); transform: none !important; transition: transform .15s;
}
.ath-sum .interruptor input:checked { background: var(--ath-primary, #314F79) !important; border-color: var(--ath-primary, #314F79) !important; }
.ath-sum .interruptor input:checked::after { transform: translateX(16px) !important; }

/* Botões booleanos tipográficos (N / I / S) */
.ath-sum-estilos-grupo { display: flex; align-items: center; gap: 8px; }
.ath-sum-estilos-segmented { display: flex; align-items: center; gap: 6px; width: 100%; }
.ath-sum-estilos-segmented label {
  display: inline-flex; align-items: center; justify-content: center; flex: 1; min-width: 34px; height: 32px; border-radius: 8px; border: 1.5px solid #CBD5E1; background: #FFFFFF; cursor: pointer; user-select: none; font-size: 13px; color: #334155; font-weight: 700; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); transition: all .15s ease;
}
.ath-sum-estilos-segmented label:hover:not(.on) { background: #F1F5F9; border-color: #94A3B8; color: #0F172A; }
.ath-sum-estilos-segmented input { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
.ath-sum-estilos-segmented label.on, .ath-sum-estilos-segmented label:has(input:checked) {
  background: var(--ath-primary, #314F79) !important; border-color: var(--ath-primary, #314F79) !important; color: #FFFFFF !important; box-shadow: 0 2px 5px rgba(49, 79, 121, 0.28); font-weight: 900;
}
.ath-sum-estilos-segmented label.on span, .ath-sum-estilos-segmented label:has(input:checked) span {
  color: #FFFFFF !important;
}
.ath-sum-estilos-segmented .b { font-weight: 900; }
.ath-sum-estilos-segmented .i { font-style: italic; font-family: Georgia, serif; }
.ath-sum-estilos-segmented .u { text-decoration: underline; }

/* Subseções visuais */
.ath-sum-subtit { margin: 4px 0 0; font: 800 10.5px var(--glx-font, inherit); letter-spacing: .05em; text-transform: uppercase; color: #64748B; display: flex; align-items: center; gap: 6px; }

/* Ações do nível */
.ath-sum-acoes-nivel { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; padding-top: 8px; border-top: 1px dashed #E2E8F0; }
.ath-sum-acoes-nivel button {
  height: 30px; padding: 0 8px; font-size: 11px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #F8FAFC; border: 1px solid #D5DEE9; color: #475569; cursor: pointer; transition: all .15s;
}
.ath-sum-acoes-nivel button:hover { background: #FFFFFF; border-color: #94A3B8; color: #1E293B; }
`;

/**
 * @param {object} doc documento (para o padrão e a numeração)
 * @param {object} bloco bloco `sumario`
 * @param {() => void} aoMudar chamado após cada alteração (o editor redesenha)
 * @returns {HTMLElement}
 */
export function montarPainelSumario(doc, bloco, aoMudar) {
  const raiz = document.createElement('div');
  raiz.className = 'ath-sumario-painel ath-sum';
  let nivelAtivo = NIVEL_ATIVO_POR_BLOCO.get(bloco.id) || 1; // lembra o nível em edição
  const abertas = () => {
    if (!SECOES_ABERTAS_POR_BLOCO.has(bloco.id)) SECOES_ABERTAS_POR_BLOCO.set(bloco.id, new Set(['escopo', 'preenchimento', 'tipografia']));
    return SECOES_ABERTAS_POR_BLOCO.get(bloco.id);
  };

  /** Config editável deste bloco (cópia da efetiva na primeira edição). */
  const cfg = () => {
    if (!bloco.sumario_config) bloco.sumario_config = JSON.parse(JSON.stringify(configEfetivaSumario(doc, bloco)));
    return bloco.sumario_config;
  };
  const nivelCfg = (n) => {
    const c = cfg(); c.niveis = c.niveis || {};
    c.niveis[n] = normalizarConfigSumario({ niveis: { [n]: c.niveis[n] } }).niveis[n];
    return c.niveis[n];
  };
  const mudou = () => { bloco.sumario_config = normalizarConfigSumario(bloco.sumario_config); aoMudar(); };

  const secao = (id, titulo, corpoHtml) => `<details data-secao="${id}" ${abertas().has(id) ? 'open' : ''}><summary>${titulo}</summary><div class="corpo">${corpoHtml}</div></details>`;
  const campo = (rot, html) => `<label class="campo">${rot}${html}</label>`;
  const num = (id, v, min, max, passo = 1) => `<input type="number" data-k="${id}" value="${v}" min="${min}" max="${max}" step="${passo}">`;
  const sel = (id, opcoes, atual) => `<select data-k="${id}">${opcoes.map(([v, r]) => `<option value="${v}" ${String(v) === String(atual) ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`;
  const cor = (id, v) => `<input type="color" data-k="${id}" value="${v || '#000000'}">`;
  const estilo = (id, rot, classe, on, dica) => `<label class="${on ? 'on' : ''}" title="${dica}" role="checkbox" aria-checked="${on ? 'true' : 'false'}"><input type="checkbox" data-k="${id}" ${on ? 'checked' : ''}><span class="${classe}">${rot}</span></label>`;

  function desenhar() {
    const colDir = raiz.closest?.('.rm-col-dir');
    const propsEl = raiz.closest?.('.rm-props');
    const stColDir = colDir ? colDir.scrollTop : 0;
    const stProps = propsEl ? propsEl.scrollTop : 0;

    const c = normalizarConfigSumario(bloco.sumario_config || doc.sumario_config_padrao);
    const numeracao = normalizarNumeracaoSecoes(doc.numeracao_secoes);
    const usandoPadrao = !bloco.sumario_config;
    nivelAtivo = Math.min(nivelAtivo, NIVEL_MAX);
    const nv = c.niveis[nivelAtivo]; const f = nv.fonte;
    const fontes = [['', 'Herdar do documento'], ...Object.entries(FONTES_SISTEMA).map(([id, x]) => [id, x.rotulo || id])];
    const fora = nivelAtivo > c.profundidade_max;

    raiz.innerHTML = [
      `<style>${CSS}</style>`,
      
      // Topo unificado e harmonioso
      `<div class="ath-sum-topo">
        <div class="ath-sum-topo-info">
          <span class="ath-sum-chip ${usandoPadrao ? 'padrao' : 'custom'}">
            ${svgIcone(usandoPadrao ? 'check' : 'estilo', 12)}
            ${usandoPadrao ? 'Padrão do Documento' : 'Configuração Própria'}
          </span>
        </div>
        <div class="ath-sum-topo-acoes">
          <button type="button" class="ath-sum-btn-topo" data-acao="padrao-doc" title="Salvar como padrão para todos os sumários">
            ${svgIcone('salvar', 12)} Tornar Padrão
          </button>
          ${usandoPadrao ? '' : `
            <button type="button" class="ath-sum-btn-topo" data-acao="usar-padrao" title="Restaurar para o padrão do documento">
              ${svgIcone('desfazer', 12)} Restaurar
            </button>
          `}
        </div>
      </div>`,

      // Seção 1: Escopo e título
      secao('escopo', 'Escopo e título', `
        ${campo('Profundidade do sumário', sel('profundidade_max', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, ROTULO_PROFUNDIDADE(i + 1)]), c.profundidade_max))}
        <div class="grade2">
          ${campo('Título do sumário', `<input type="text" data-k="titulo_texto" value="${esc(c.titulo.texto)}" placeholder="SUMÁRIO">`)}
          ${campo('Alinhamento', sel('titulo_alinhamento', [['esquerda', 'À esquerda'], ['centro', 'Centralizado'], ['direita', 'À direita']], c.titulo.alinhamento))}
        </div>
      `),

      // Seção 2: Preenchimento de linha
      secao('preenchimento', 'Preenchimento de linha', `
        ${campo('Entre o título e o número da página', sel('pre_tipo', [['pontos', 'Pontilhado ........'], ['tracos', 'Traços --------'], ['linha', 'Linha sólida ________'], ['nenhum', 'Vazio (sem preenchimento)']], c.preenchimento.tipo))}
        ${c.preenchimento.tipo === 'nenhum' ? '' : `<div class="grade3">
          ${campo('Cor da linha', cor('pre_cor', c.preenchimento.cor))}
          ${campo('Espessura (pt)', num('pre_esp', c.preenchimento.espessura_pt, 0.25, 4, 0.25))}
          ${campo('Densidade', sel('pre_dens', [['denso', 'Densa'], ['normal', 'Normal'], ['aberto', 'Aberta']], c.preenchimento.densidade))}
        </div>`}
      `),

      // Seção 3: Tipografia por nível
      secao('tipografia', 'Tipografia por nível', `
        <div class="ath-sum-niveis-wrap">
          <div class="ath-sum-niveis-rotulo">
            <span>Nível selecionado: <b>Nível ${nivelAtivo}</b></span>
            ${fora ? '<span style="color:#B45309; font-weight:700;">Fora do escopo</span>' : '<span style="color:#15803D;">Ativo no sumário</span>'}
          </div>
          <div class="ath-sum-niveis-barra" role="tablist" aria-label="Nível a editar">
            ${Array.from({ length: NIVEL_MAX }, (_, i) => `
              <button type="button" role="tab" data-nivel="${i + 1}" class="${i + 1 === nivelAtivo ? 'on' : ''} ${i + 1 > c.profundidade_max ? 'fora' : ''}" title="Nível ${i + 1}${i + 1 > c.profundidade_max ? ' (fora do escopo do sumário)' : ''}">
                ${i + 1}
              </button>
            `).join('')}
          </div>
        </div>

        <label class="ath-sum-switch-linha ${nv.mostrar_pagina ? 'on' : ''}">
          <span>Mostrar número da página no nível ${nivelAtivo}</span>
          <span class="interruptor">
            <input type="checkbox" data-k="n_mostrar_pagina" ${nv.mostrar_pagina ? 'checked' : ''}>
          </span>
        </label>

        <div class="grade-fonte">
          ${campo('Família da fonte', sel('n_familia', fontes, f.familia))}
          ${campo('Tamanho (pt)', num('n_tam', f.tamanho_pt, 6, 36, 0.5))}
        </div>

        <div class="grade2">
          ${campo('Transformação do texto', sel('n_transf', [['none', 'Como digitado'], ['uppercase', 'CAIXA ALTA'], ['lowercase', 'caixa baixa'], ['capitalize', 'Primeira Maiúscula']], nv.transformacao))}
          <div class="campo">
            <span style="font:700 11px var(--glx-font, inherit); color:#475569; margin-bottom:4px; display:block;">Estilo da fonte</span>
            <div class="ath-sum-estilos-segmented">
              ${estilo('n_negrito', 'N', 'b', f.negrito, 'Negrito')}
              ${estilo('n_italico', 'I', 'i', f.italico, 'Itálico')}
              ${estilo('n_sublinhado', 'S', 'u', f.sublinhado, 'Sublinhado')}
            </div>
          </div>
        </div>

        <p class="ath-sum-subtit">${svgIcone('paleta', 12)} Cores Tipográficas</p>
        <div class="grade3">
          ${campo('Texto', cor('n_cor', f.cor))}
          ${campo('Número', cor('n_cor_numero', f.cor_numero || f.cor))}
          ${campo('Pág.', cor('n_cor_pagina', f.cor_pagina || f.cor))}
        </div>

        <p class="ath-sum-subtit">${svgIcone('espacamento', 12)} Espaçamento e Recuo</p>
        <div class="grade2">
          ${campo('Recuo (mm)', num('n_recuo', nv.recuo_mm, 0, 80, 0.5))}
          ${campo('Entrelinha', num('n_entrelinha', nv.espacamento.entrelinha, 0.8, 3, 0.05))}
          ${campo('Antes (mm)', num('n_antes', nv.espacamento.margem_superior_mm, 0, 30, 0.5))}
          ${campo('Depois (mm)', num('n_depois', nv.espacamento.margem_inferior_mm, 0, 30, 0.5))}
        </div>

        <div class="ath-sum-acoes-nivel">
          <button type="button" data-acao="nivel-todos" title="Copia a tipografia e espaçamento deste nível para todos os outros">
            ${svgIcone('copiar', 12)} Replicar para todos
          </button>
          <button type="button" data-acao="nivel-restaurar" title="Volta este nível ao padrão ABNT">
            ${svgIcone('desfazer', 12)} Restaurar nível
          </button>
        </div>
      `),

      // Seção 4: Numeração das seções
      secao('numeracao', 'Numeração das seções', `
        <label class="ath-sum-switch-linha ${numeracao.ativa ? 'on' : ''}">
          <span>Numerar títulos do documento (1, 1.1, 1.1.1…)</span>
          <span class="interruptor">
            <input type="checkbox" data-k="num_ativa" ${numeracao.ativa ? 'checked' : ''}>
          </span>
        </label>
        ${campo('Numerar até o nível', sel('num_ate', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, `Nível ${i + 1}`]), numeracao.ate_nivel))}
        <p style="margin:2px 0 0; font-size:11px; color:#64748B; line-height:1.4;">
          Configuração global do documento. Se ativa, números digitados manualmente no início de títulos são tratados de forma limpa pelo gerador editorial.
        </p>
      `)
    ].join('');

    const restaurarScroll = () => {
      if (colDir && stColDir > 0) colDir.scrollTop = stColDir;
      if (propsEl && stProps > 0) propsEl.scrollTop = stProps;
    };
    restaurarScroll();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(restaurarScroll);
    }
  }

  const lerCor = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : '');

  function aplicar(el) {
    const k = el.dataset.k; if (!k) return false;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    const n = parseFloat(v);
    if (k.startsWith('num_')) {
      doc.numeracao_secoes = normalizarNumeracaoSecoes({ ...(doc.numeracao_secoes || {}), ...(k === 'num_ativa' ? { ativa: v } : { ate_nivel: parseInt(v, 10) }) });
      aoMudar(); desenhar(); return true;
    }
    const c = cfg();
    if (k === 'profundidade_max') c.profundidade_max = parseInt(v, 10);
    else if (k === 'titulo_texto') c.titulo = { ...(c.titulo || {}), texto: v };
    else if (k === 'titulo_alinhamento') c.titulo = { ...(c.titulo || {}), alinhamento: v };
    else if (k === 'pre_tipo') c.preenchimento = { ...(c.preenchimento || {}), tipo: v };
    else if (k === 'pre_cor') c.preenchimento = { ...(c.preenchimento || {}), cor: v };
    else if (k === 'pre_esp') c.preenchimento = { ...(c.preenchimento || {}), espessura_pt: n };
    else if (k === 'pre_dens') c.preenchimento = { ...(c.preenchimento || {}), densidade: v };
    else if (k.startsWith('n_')) {
      const nv = nivelCfg(nivelAtivo);
      if (k === 'n_mostrar_pagina') nv.mostrar_pagina = v;
      else if (k === 'n_recuo') nv.recuo_mm = n;
      else if (k === 'n_transf') nv.transformacao = v;
      else if (k === 'n_tam') nv.fonte.tamanho_pt = n;
      else if (k === 'n_familia') nv.fonte.familia = v;
      else if (k === 'n_negrito') nv.fonte.negrito = v;
      else if (k === 'n_italico') nv.fonte.italico = v;
      else if (k === 'n_sublinhado') nv.fonte.sublinhado = v;
      else if (k === 'n_cor') nv.fonte.cor = lerCor(v) || nv.fonte.cor;
      else if (k === 'n_cor_numero') nv.fonte.cor_numero = lerCor(v);
      else if (k === 'n_cor_pagina') nv.fonte.cor_pagina = lerCor(v);
      else if (k === 'n_entrelinha') nv.espacamento.entrelinha = n;
      else if (k === 'n_antes') nv.espacamento.margem_superior_mm = n;
      else if (k === 'n_depois') nv.espacamento.margem_inferior_mm = n;
    } else return false;
    mudou();
    return true;
  }

  raiz.addEventListener('toggle', (e) => {
    const id = e.target?.dataset?.secao; if (!id) return;
    if (e.target.open) abertas().add(id); else abertas().delete(id);
  }, true);
  raiz.addEventListener('input', (e) => { if (e.target.dataset?.k && e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') aplicar(e.target); });
  raiz.addEventListener('change', (e) => {
    if (!e.target.dataset?.k) return;
    const redesenha = ['profundidade_max', 'pre_tipo', 'n_mostrar_pagina'].includes(e.target.dataset.k) || e.target.tagName === 'SELECT' || e.target.type === 'checkbox';
    if (e.target.type === 'checkbox') {
      const lbl = e.target.closest('label');
      if (lbl) {
        lbl.classList.toggle('on', e.target.checked);
        lbl.setAttribute('aria-checked', e.target.checked ? 'true' : 'false');
      }
    }
    aplicar(e.target);
    if (redesenha && !e.target.dataset.k.startsWith('num_')) desenhar();
  });
  raiz.addEventListener('click', (e) => {
    const aba = e.target.closest('[data-nivel]');
    if (aba) {
      e.preventDefault();
      nivelAtivo = parseInt(aba.dataset.nivel, 10);
      NIVEL_ATIVO_POR_BLOCO.set(bloco.id, nivelAtivo);
      desenhar();
      return;
    }
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    if (a) {
      e.preventDefault();
      if (a === 'padrao-doc') { doc.sumario_config_padrao = JSON.parse(JSON.stringify(configEfetivaSumario(doc, bloco))); aoMudar(); desenhar(); return; }
      if (a === 'usar-padrao') { delete bloco.sumario_config; aoMudar(); desenhar(); return; }
      if (a === 'nivel-todos') {
        const origem = JSON.parse(JSON.stringify(nivelCfg(nivelAtivo)));
        for (let i = 1; i <= NIVEL_MAX; i++) {
          if (i === nivelAtivo) continue;
          const alvo = nivelCfg(i);
          alvo.fonte = { ...JSON.parse(JSON.stringify(origem.fonte)) };
          alvo.espacamento = { ...origem.espacamento };
          alvo.transformacao = origem.transformacao;
          alvo.mostrar_pagina = origem.mostrar_pagina; // o recuo continua de cada nível
        }
        mudou(); desenhar(); return;
      }
      if (a === 'nivel-restaurar') {
        const c = cfg(); c.niveis = c.niveis || {};
        c.niveis[nivelAtivo] = nivelPadrao(nivelAtivo);
        mudou(); desenhar(); return;
      }
    }
  });

  desenhar();
  return raiz;
}
