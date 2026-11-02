// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel de propriedades do bloco Sumário: escopo de níveis, preenchimento de linha,
 * tipografia nível a nível, alinhamento/espaçamento e numeração decimal das seções do documento.
 */

import { FONTES_SISTEMA } from '../core/athenes_estilos.js';
import {
  NIVEL_MAX, normalizarConfigSumario, configEfetivaSumario, normalizarNumeracaoSecoes
} from '../core/athenes_sumario.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NIVEL_ATIVO_POR_BLOCO = new Map();
const ROTULO_PROFUNDIDADE = (n) => (n === 1 ? 'Apenas nível 1' : n === 2 ? 'Níveis 1 e 2' : `Níveis 1 a ${n}`);

/**
 * @param {object} doc documento (para o padrão e a numeração)
 * @param {object} bloco bloco `sumario`
 * @param {() => void} aoMudar chamado após cada alteração (o editor redesenha)
 * @returns {HTMLElement}
 */
export function montarPainelSumario(doc, bloco, aoMudar) {
  const raiz = document.createElement('div');
  raiz.className = 'ath-sumario-painel';
  raiz.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  let nivelAtivo = NIVEL_ATIVO_POR_BLOCO.get(bloco.id) || 1; // o painel é recriado a cada alteração: lembra o nível em edição

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

  const secao = (titulo, corpoHtml) => `<section style="display:flex;flex-direction:column;gap:8px"><h4 style="margin:0;font:800 10.5px var(--glx-font);letter-spacing:.06em;text-transform:uppercase;color:var(--ath-primary,#314F79)">${titulo}</h4>${corpoHtml}</section>`;
  const campo = (rot, html) => `<label style="display:flex;flex-direction:column;gap:3px;font:700 11px var(--glx-font);color:#475569">${rot}${html}</label>`;
  const num = (id, v, min, max, passo = 1) => `<input type="number" class="glx-input" data-k="${id}" value="${v}" min="${min}" max="${max}" step="${passo}" style="width:100%">`;
  const sel = (id, opcoes, atual) => `<select class="glx-select" data-k="${id}" style="width:100%">${opcoes.map(([v, r]) => `<option value="${v}" ${String(v) === String(atual) ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`;
  const chk = (id, rot, on) => `<label style="display:flex;gap:6px;align-items:center;font:600 12px var(--glx-font)"><input type="checkbox" data-k="${id}" ${on ? 'checked' : ''}> ${rot}</label>`;
  const cor = (id, v) => `<input type="color" class="glx-input" data-k="${id}" value="${v || '#000000'}" style="width:100%;height:30px;padding:2px">`;

  function desenhar() {
    const c = normalizarConfigSumario(bloco.sumario_config || doc.sumario_config_padrao);
    const numeracao = normalizarNumeracaoSecoes(doc.numeracao_secoes);
    const usandoPadrao = !bloco.sumario_config;
    nivelAtivo = Math.min(nivelAtivo, c.profundidade_max);
    const nv = c.niveis[nivelAtivo]; const f = nv.fonte;
    const fontes = [['', 'Herdar do documento'], ...Object.entries(FONTES_SISTEMA).map(([id, x]) => [id, x.rotulo || id])];

    raiz.innerHTML = [
      `<div style="font:600 11px var(--glx-font);color:#64748B">${usandoPadrao ? 'Usando o padrão do documento. Qualquer ajuste cria uma configuração própria deste sumário.' : 'Configuração própria deste sumário.'}</div>
       <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-acao="padrao-doc">Definir como padrão do documento</button>${usandoPadrao ? '' : '<button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-acao="usar-padrao">Voltar ao padrão</button>'}</div>`,

      secao('Escopo e título', `
        ${campo('Profundidade do sumário', sel('profundidade_max', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, ROTULO_PROFUNDIDADE(i + 1)]), c.profundidade_max))}
        ${campo('Título do sumário', `<input type="text" class="glx-input" data-k="titulo_texto" value="${esc(c.titulo.texto)}" placeholder="SUMÁRIO" style="width:100%">`)}
        ${campo('Alinhamento do título', sel('titulo_alinhamento', [['esquerda', 'À esquerda'], ['centro', 'Centralizado'], ['direita', 'À direita']], c.titulo.alinhamento))}`),

      secao('Preenchimento de linha', `
        ${campo('Tipo (entre o título e a página)', sel('pre_tipo', [['pontos', 'Pontilhado ........'], ['tracos', 'Traços --------'], ['linha', 'Linha sólida ________'], ['nenhum', 'Vazio (sem preenchimento)']], c.preenchimento.tipo))}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          ${campo('Cor', cor('pre_cor', c.preenchimento.cor))}
          ${campo('Espessura (pt)', num('pre_esp', c.preenchimento.espessura_pt, 0.25, 4, 0.25))}
          ${campo('Densidade', sel('pre_dens', [['denso', 'Densa'], ['normal', 'Normal'], ['aberto', 'Aberta']], c.preenchimento.densidade))}
        </div>`),

      secao('Tipografia por nível', `
        ${campo('Nível a editar', sel('nivel_ativo', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, `Nível ${i + 1}${i + 1 > c.profundidade_max ? ' (fora do escopo)' : ''}`]), nivelAtivo))}
        ${chk('n_mostrar_pagina', 'Exibir número de página neste nível', nv.mostrar_pagina)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${campo('Recuo à esquerda (mm)', num('n_recuo', nv.recuo_mm, 0, 80, 0.5))}
          ${campo('Tamanho (pt)', num('n_tam', f.tamanho_pt, 6, 36, 0.5))}
        </div>
        ${campo('Família da fonte', sel('n_familia', fontes, f.familia))}
        ${campo('Transformação do texto', sel('n_transf', [['none', 'Como digitado'], ['uppercase', 'CAIXA ALTA'], ['lowercase', 'caixa baixa'], ['capitalize', 'Primeira Maiúscula']], nv.transformacao))}
        <div style="display:flex;gap:12px">${chk('n_negrito', 'Negrito', f.negrito)}${chk('n_italico', 'Itálico', f.italico)}${chk('n_sublinhado', 'Sublinhado', f.sublinhado)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          ${campo('Cor do texto', cor('n_cor', f.cor))}
          ${campo('Cor do número (1.1)', cor('n_cor_numero', f.cor_numero || f.cor))}
          ${campo('Cor da página', cor('n_cor_pagina', f.cor_pagina || f.cor))}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          ${campo('Entrelinha', num('n_entrelinha', nv.espacamento.entrelinha, 0.8, 3, 0.05))}
          ${campo('Espaço antes (mm)', num('n_antes', nv.espacamento.margem_superior_mm, 0, 30, 0.5))}
          ${campo('Espaço depois (mm)', num('n_depois', nv.espacamento.margem_inferior_mm, 0, 30, 0.5))}
        </div>`),

      secao('Numeração das seções do documento', `
        ${chk('num_ativa', 'Numerar títulos automaticamente (1, 1.1, 1.1.1…)', numeracao.ativa)}
        ${campo('Numerar até o nível', sel('num_ate', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, `Nível ${i + 1}`]), numeracao.ate_nivel))}
        <div style="font:600 10.5px var(--glx-font);color:#64748B">O número digitado à mão no início de um título é ignorado quando a numeração automática está ativa. Cada título pode seguir ou ignorar esta regra no seu painel.</div>`)
    ].join('');
  }

  const lerCor = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : '');

  function aplicar(el) {
    const k = el.dataset.k; if (!k) return false;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    const n = parseFloat(v);
    if (k === 'nivel_ativo') { nivelAtivo = parseInt(v, 10); NIVEL_ATIVO_POR_BLOCO.set(bloco.id, nivelAtivo); desenhar(); return true; }
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

  raiz.addEventListener('input', (e) => { if (e.target.dataset?.k && e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') aplicar(e.target); });
  raiz.addEventListener('change', (e) => {
    if (!e.target.dataset?.k) return;
    const redesenha = ['profundidade_max', 'pre_tipo', 'n_mostrar_pagina'].includes(e.target.dataset.k) || e.target.tagName === 'SELECT' || e.target.type === 'checkbox';
    aplicar(e.target);
    if (redesenha && !e.target.dataset.k.startsWith('num_') && e.target.dataset.k !== 'nivel_ativo') desenhar();
  });
  raiz.addEventListener('click', (e) => {
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'padrao-doc') { doc.sumario_config_padrao = JSON.parse(JSON.stringify(configEfetivaSumario(doc, bloco))); aoMudar(); }
    if (a === 'usar-padrao') { delete bloco.sumario_config; aoMudar(); desenhar(); }
  });

  desenhar();
  return raiz;
}
