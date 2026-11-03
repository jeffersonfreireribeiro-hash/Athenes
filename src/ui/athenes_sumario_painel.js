// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel de propriedades do bloco Sumário: escopo de níveis, preenchimento de linha,
 * tipografia nível a nível, alinhamento/espaçamento e numeração decimal das seções do documento.
 */

import { FONTES_SISTEMA } from '../core/athenes_estilos.js';
import {
  NIVEL_MAX, normalizarConfigSumario, configEfetivaSumario, normalizarNumeracaoSecoes, nivelPadrao
} from '../core/athenes_sumario.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NIVEL_ATIVO_POR_BLOCO = new Map();
const SECOES_ABERTAS_POR_BLOCO = new Map(); // o painel é recriado a cada alteração: lembra quais seções estão abertas
const ROTULO_PROFUNDIDADE = (n) => (n === 1 ? 'Apenas nível 1' : n === 2 ? 'Níveis 1 e 2' : `Níveis 1 a ${n}`);

const CSS = `
.ath-sum{display:flex;flex-direction:column;gap:8px;font:500 12px var(--glx-font,inherit);color:#1F2733}
.ath-sum *{box-sizing:border-box}
.ath-sum .nota{font:600 11px var(--glx-font,inherit);color:#64748B;line-height:1.4;margin:0}
.ath-sum .acoes{display:flex;gap:6px;flex-wrap:wrap}
.ath-sum details{border:1px solid #E2E8F0;border-radius:12px;background:#fff;padding:0 10px}
.ath-sum details[open]{padding-bottom:10px}
.ath-sum summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:10px 0;font:800 10.5px var(--glx-font,inherit);letter-spacing:.06em;text-transform:uppercase;color:var(--ath-primary,#314F79)}
.ath-sum summary::-webkit-details-marker{display:none}
.ath-sum summary::before{content:'';width:6px;height:6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);transition:transform .15s}
.ath-sum details[open] > summary::before{transform:rotate(45deg)}
.ath-sum .corpo{display:flex;flex-direction:column;gap:10px}
.ath-sum label.campo{display:flex;flex-direction:column;gap:4px;font:700 11px var(--glx-font,inherit);color:#475569;min-width:0}
.ath-sum .grade2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ath-sum .grade3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ath-sum input[type=text],.ath-sum input[type=number],.ath-sum select{width:100%;height:32px;padding:0 8px;border:1px solid #D5DEE9;border-radius:8px;background:#F8FAFC;font:500 12px var(--glx-font,inherit);color:#1F2733}
.ath-sum input:focus,.ath-sum select:focus{outline:2px solid rgba(49,79,121,.25);border-color:var(--ath-primary,#314F79)}
.ath-sum input[type=color]{appearance:none;-webkit-appearance:none;width:100%;height:32px;padding:0;border:1px solid #D5DEE9;border-radius:8px;background:#fff;cursor:pointer;overflow:hidden}
.ath-sum input[type=color]::-webkit-color-swatch-wrapper{padding:3px}
.ath-sum input[type=color]::-webkit-color-swatch{border:0;border-radius:5px}
.ath-sum .interruptor{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;font:600 12px var(--glx-font,inherit);color:#1F2733}
.ath-sum .interruptor input{appearance:none;-webkit-appearance:none;flex:none;width:34px;height:20px;margin:0;border-radius:999px;background:#CBD5E1;position:relative;cursor:pointer;transition:background .15s}
.ath-sum .interruptor input::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.3);transition:transform .15s}
.ath-sum .interruptor input:checked{background:var(--ath-primary,#314F79)}
.ath-sum .interruptor input:checked::after{transform:translateX(14px)}
.ath-sum .niveis{display:grid;grid-template-columns:repeat(9,1fr);gap:3px}
.ath-sum .niveis button{height:28px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;color:#475569;font:800 11px var(--glx-font,inherit);cursor:pointer}
.ath-sum .niveis button.fora{opacity:.45}
.ath-sum .niveis button.on{background:var(--ath-primary,#314F79);border-color:var(--ath-primary,#314F79);color:#fff;opacity:1}
.ath-sum .estilos{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ath-sum .estilos label{display:flex;align-items:center;justify-content:center;height:30px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;color:#475569;cursor:pointer;user-select:none;font-size:13px}
.ath-sum .estilos input{position:absolute;opacity:0;pointer-events:none}
.ath-sum .estilos label:has(input:checked){background:#DCE8F5;border-color:var(--ath-primary,#314F79);color:var(--ath-primary,#314F79)}
.ath-sum .estilos .b{font-weight:800}.ath-sum .estilos .i{font-style:italic;font-family:Georgia,serif}.ath-sum .estilos .u{text-decoration:underline}
.ath-sum .sub{margin:2px 0 0;font:800 10px var(--glx-font,inherit);letter-spacing:.05em;text-transform:uppercase;color:#94A3B8}
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
  let nivelAtivo = NIVEL_ATIVO_POR_BLOCO.get(bloco.id) || 1; // o painel é recriado a cada alteração: lembra o nível em edição
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
  const interruptor = (id, rot, on) => `<label class="interruptor"><span>${rot}</span><input type="checkbox" data-k="${id}" ${on ? 'checked' : ''}></label>`;
  const cor = (id, v) => `<input type="color" data-k="${id}" value="${v || '#000000'}">`;
  const estilo = (id, rot, classe, on, dica) => `<label title="${dica}"><input type="checkbox" data-k="${id}" ${on ? 'checked' : ''}><span class="${classe}">${rot}</span></label>`;

  function desenhar() {
    const c = normalizarConfigSumario(bloco.sumario_config || doc.sumario_config_padrao);
    const numeracao = normalizarNumeracaoSecoes(doc.numeracao_secoes);
    const usandoPadrao = !bloco.sumario_config;
    nivelAtivo = Math.min(nivelAtivo, NIVEL_MAX);
    const nv = c.niveis[nivelAtivo]; const f = nv.fonte;
    const fontes = [['', 'Herdar do documento'], ...Object.entries(FONTES_SISTEMA).map(([id, x]) => [id, x.rotulo || id])];
    const fora = nivelAtivo > c.profundidade_max;

    raiz.innerHTML = [
      `<style>${CSS}</style>`,
      `<p class="nota">${usandoPadrao ? 'Usando o padrão do documento. Qualquer ajuste cria uma configuração própria deste sumário.' : 'Configuração própria deste sumário.'}</p>
       <div class="acoes"><button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-acao="padrao-doc">Definir como padrão do documento</button>${usandoPadrao ? '' : '<button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-acao="usar-padrao">Voltar ao padrão</button>'}</div>`,

      secao('escopo', 'Escopo e título', `
        ${campo('Profundidade do sumário', sel('profundidade_max', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, ROTULO_PROFUNDIDADE(i + 1)]), c.profundidade_max))}
        ${campo('Título do sumário', `<input type="text" data-k="titulo_texto" value="${esc(c.titulo.texto)}" placeholder="SUMÁRIO">`)}
        ${campo('Alinhamento do título', sel('titulo_alinhamento', [['esquerda', 'À esquerda'], ['centro', 'Centralizado'], ['direita', 'À direita']], c.titulo.alinhamento))}`),

      secao('preenchimento', 'Preenchimento de linha', `
        ${campo('Entre o título e a página', sel('pre_tipo', [['pontos', 'Pontilhado ........'], ['tracos', 'Traços --------'], ['linha', 'Linha sólida ________'], ['nenhum', 'Vazio (sem preenchimento)']], c.preenchimento.tipo))}
        ${c.preenchimento.tipo === 'nenhum' ? '' : `<div class="grade3">
          ${campo('Cor', cor('pre_cor', c.preenchimento.cor))}
          ${campo('Espessura (pt)', num('pre_esp', c.preenchimento.espessura_pt, 0.25, 4, 0.25))}
          ${campo('Densidade', sel('pre_dens', [['denso', 'Densa'], ['normal', 'Normal'], ['aberto', 'Aberta']], c.preenchimento.densidade))}
        </div>`}`),

      secao('tipografia', 'Tipografia por nível', `
        <div class="niveis" role="tablist" aria-label="Nível a editar">${Array.from({ length: NIVEL_MAX }, (_, i) => `<button type="button" role="tab" data-nivel="${i + 1}" class="${i + 1 === nivelAtivo ? 'on' : ''} ${i + 1 > c.profundidade_max ? 'fora' : ''}" title="Nível ${i + 1}${i + 1 > c.profundidade_max ? ' (fora do escopo do sumário)' : ''}">${i + 1}</button>`).join('')}</div>
        <p class="nota">Editando o <b>nível ${nivelAtivo}</b>${fora ? ' — fora do escopo atual (não aparece no sumário)' : ''}.</p>
        ${interruptor('n_mostrar_pagina', 'Mostrar número da página', nv.mostrar_pagina)}
        <div class="grade2">
          ${campo('Recuo à esquerda (mm)', num('n_recuo', nv.recuo_mm, 0, 80, 0.5))}
          ${campo('Tamanho (pt)', num('n_tam', f.tamanho_pt, 6, 36, 0.5))}
        </div>
        ${campo('Família da fonte', sel('n_familia', fontes, f.familia))}
        ${campo('Transformação do texto', sel('n_transf', [['none', 'Como digitado'], ['uppercase', 'CAIXA ALTA'], ['lowercase', 'caixa baixa'], ['capitalize', 'Primeira Maiúscula']], nv.transformacao))}
        <div class="estilos">${estilo('n_negrito', 'N', 'b', f.negrito, 'Negrito')}${estilo('n_italico', 'I', 'i', f.italico, 'Itálico')}${estilo('n_sublinhado', 'S', 'u', f.sublinhado, 'Sublinhado')}</div>
        <p class="sub">Cores</p>
        <div class="grade3">
          ${campo('Texto', cor('n_cor', f.cor))}
          ${campo('Número (1.1)', cor('n_cor_numero', f.cor_numero || f.cor))}
          ${campo('Página', cor('n_cor_pagina', f.cor_pagina || f.cor))}
        </div>
        <p class="sub">Espaçamento</p>
        <div class="grade3">
          ${campo('Entrelinha', num('n_entrelinha', nv.espacamento.entrelinha, 0.8, 3, 0.05))}
          ${campo('Antes (mm)', num('n_antes', nv.espacamento.margem_superior_mm, 0, 30, 0.5))}
          ${campo('Depois (mm)', num('n_depois', nv.espacamento.margem_inferior_mm, 0, 30, 0.5))}
        </div>
        <div class="acoes">
          <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-acao="nivel-todos" title="Copia a tipografia e o espaçamento deste nível para todos os outros">Aplicar a todos os níveis</button>
          <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-acao="nivel-restaurar" title="Volta este nível ao padrão ABNT">Restaurar nível</button>
        </div>`),

      secao('numeracao', 'Numeração das seções', `
        ${interruptor('num_ativa', 'Numerar títulos (1, 1.1, 1.1.1…)', numeracao.ativa)}
        ${campo('Numerar até o nível', sel('num_ate', Array.from({ length: NIVEL_MAX }, (_, i) => [i + 1, `Nível ${i + 1}`]), numeracao.ate_nivel))}
        <p class="nota">Vale para o documento todo. Com a numeração ativa, o número digitado à mão no início de um título é ignorado. Cada título pode seguir ou ignorar esta regra nas próprias propriedades.</p>`)
    ].join('');
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
    aplicar(e.target);
    if (redesenha && !e.target.dataset.k.startsWith('num_')) desenhar();
  });
  raiz.addEventListener('click', (e) => {
    const aba = e.target.closest('[data-nivel]');
    if (aba) { nivelAtivo = parseInt(aba.dataset.nivel, 10); NIVEL_ATIVO_POR_BLOCO.set(bloco.id, nivelAtivo); desenhar(); return; }
    const a = e.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'padrao-doc') { doc.sumario_config_padrao = JSON.parse(JSON.stringify(configEfetivaSumario(doc, bloco))); aoMudar(); }
    if (a === 'usar-padrao') { delete bloco.sumario_config; aoMudar(); desenhar(); }
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
      mudou(); desenhar();
    }
    if (a === 'nivel-restaurar') {
      const c = cfg(); c.niveis = c.niveis || {};
      c.niveis[nivelAtivo] = nivelPadrao(nivelAtivo);
      mudou(); desenhar();
    }
  });

  desenhar();
  return raiz;
}
