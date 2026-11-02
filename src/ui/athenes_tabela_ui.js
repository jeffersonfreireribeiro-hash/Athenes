// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — UI de Tabelas e Quadros: construção do DOM, seleção de células e popover de estilo.
 *
 * Desempenho em tabelas grandes:
 *  - O estilo é aplicado em UM passe sobre as células (`aplicarEstiloTabelaDom`), sem recriar o DOM.
 *  - Alterar bordas/fundos/zebra NÃO re-renderiza o editor: só reescreve `style` das células.
 *  - Seleção usa uma classe CSS e atualiza apenas as células que entram/saem do retângulo.
 */

import {
  obterEstiloTabela, garantirEstiloTabela, dimensoesTabela, resolverCelula, celulaParaCss,
  tabelaParaCss, aplicarPresetBorda, aplicarCamadaSelecao, retanguloSelecao, normalizarBorda,
  ajustarCasasDecimais, formatarNumeroPtBr, TAMANHO_MIN_PT, TAMANHO_MAX_PT,
  PADDINGS_CELULA, PRESETS_BORDA, corValida
} from '../core/athenes_tabela_estilo.js';
import { FONTES_SISTEMA, estiloParaCssTipografia, localizarEstilo } from '../core/athenes_estilos.js';
import { csvParaTabela, aplicarCsvAoBloco, decodificarCsv, SEPARADORES } from '../core/athenes_csv.js';

// ───────────────────────────── DOM ─────────────────────────────

/** Reaplica o estilo declarativo do bloco a uma <table> existente (um único passe). */
export function aplicarEstiloTabelaDom(table, bloco, estilos = table._estilos) {
  const estilo = obterEstiloTabela(bloco);
  const dim = dimensoesTabela(bloco);
  // tipografia dos DADOS: estilo de texto escolhido no bloco aplicado à tabela (as células herdam;
  // ajustes por célula, como tamanho/negrito da barra de formatação, continuam valendo por cima)
  table.style.cssText = tabelaParaCss() + ';' + estiloParaCssTipografia(localizarEstilo(estilos, bloco.dados_estilo_id));
  const linhas = table.rows;
  for (let r = 0; r < linhas.length; r++) {
    const cels = linhas[r].cells;
    for (let c = 0; c < cels.length; c++) {
      cels[c].style.cssText = celulaParaCss(resolverCelula(estilo, dim, r, c), estilo);
    }
  }
}

/**
 * Constrói a <table> editável de um bloco tabela/quadro com colgroup proporcional e
 * sincronização do texto das células de volta ao bloco (delegação: 1 listener por tabela).
 */
export function construirTabelaDom(b, classe, aoAlterarConteudo, estilos = []) {
  const table = document.createElement('table');
  table._estilos = estilos;
  table.className = classe;
  table.dataset.blocoId = b.id;

  const cols = b.colunas || (b.tipo === 'quadro' ? ['Categoria', 'Definição'] : ['Coluna A', 'Coluna B']);
  const linhas = b.linhas || [[b.tipo === 'quadro' ? 'Dimensão A' : 'Dado 1', b.tipo === 'quadro' ? 'Conteúdo descritivo A' : 'Dado 2']];
  const temCab = b.com_cabecalho !== false;
  // materializa os padrões para que a edição de células grave no bloco sem perder as demais
  if (!b.colunas) b.colunas = [...cols];
  if (!b.linhas) b.linhas = linhas;

  if (Array.isArray(b.larguras_relativas) && b.larguras_relativas.length === cols.length) {
    const cg = document.createElement('colgroup');
    const soma = b.larguras_relativas.reduce((s, x) => s + (Number(x) || 0), 0) || 1;
    b.larguras_relativas.forEach(w => {
      const col = document.createElement('col');
      col.style.width = `${((Number(w) || 0) / soma * 100).toFixed(2)}%`;
      cg.appendChild(col);
    });
    table.appendChild(cg);
  }

  const frag = document.createDocumentFragment();
  if (temCab) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    cols.forEach((c, i) => {
      const th = document.createElement('th');
      th.contentEditable = 'true';
      th.dataset.c = String(i);
      th.textContent = c;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    frag.appendChild(thead);
  }
  const tbody = document.createElement('tbody');
  linhas.forEach((row, ri) => {
    const tr = document.createElement('tr');
    (Array.isArray(row) ? row : []).forEach((cell, ci) => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.dataset.c = String(ci);
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  frag.appendChild(tbody);
  table.appendChild(frag);

  // Sincroniza conteúdo ao sair da célula (focusout borbulha; um único listener)
  table.addEventListener('focusout', (e) => {
    const cel = e.target.closest?.('th,td');
    if (!cel) return;
    gravarTextoCelula(b, cel.parentElement.rowIndex, Number(cel.dataset.c), cel.textContent);
    aoAlterarConteudo?.();
  });

  aplicarEstiloTabelaDom(table, b);
  return table;
}

// ───────────────────────────── Seleção de células ─────────────────────────────

/**
 * Seleção por foco/clique e Shift+clique. Retorna o controlador com `obterRetangulo()`.
 * Estado vive no controlador (um por tabela), nunca no DOM além de uma classe visual.
 */
export function instalarSelecaoCelulas(table, aoMudar) {
  let ancora = { r: 0, c: 0 };
  let foco = { r: 0, c: 0 };
  let marcadas = [];

  const pos = (cel) => ({ r: cel.parentElement.rowIndex, c: cel.cellIndex });

  const pintar = () => {
    marcadas.forEach(el => el.classList.remove('ath-cel-sel'));
    marcadas = [];
    if (ancora.r === foco.r && ancora.c === foco.c) return;
    const { r0, c0, r1, c1 } = retanguloSelecao(ancora, foco);
    for (let r = r0; r <= r1; r++) {
      const tr = table.rows[r];
      if (!tr) continue;
      for (let c = c0; c <= c1; c++) {
        const el = tr.cells[c];
        if (el) { el.classList.add('ath-cel-sel'); marcadas.push(el); }
      }
    }
  };

  table.addEventListener('mousedown', (e) => {
    const cel = e.target.closest?.('th,td');
    if (!cel) return;
    const p = pos(cel);
    if (e.shiftKey) {
      e.preventDefault();
      foco = p;
    } else {
      ancora = foco = p;
    }
    pintar();
    aoMudar?.();
  });
  table.addEventListener('focusin', (e) => {
    const cel = e.target.closest?.('th,td');
    if (!cel || e.target !== cel) return;
    const p = pos(cel);
    const { r0, c0, r1, c1 } = retanguloSelecao(ancora, foco);
    const dentro = p.r >= r0 && p.r <= r1 && p.c >= c0 && p.c <= c1;
    if (!marcadas.length || !dentro) { ancora = foco = p; pintar(); }
    aoMudar?.();
  });

  return {
    obterRetangulo: () => retanguloSelecao(ancora, foco),
    obterCelulaFoco: () => ({ ...foco }),
    selecionar(rect) {
      ancora = { r: rect.r0, c: rect.c0 };
      foco = { r: rect.r1, c: rect.c1 };
      pintar();
    },
    limpar() { ancora = foco = { r: 0, c: 0 }; pintar(); }
  };
}

// ───────────────────────────── Ícones de borda ─────────────────────────────

/** Ícone 16×16: grade 2×2 tracejada clara + segmentos escuros dos lados afetados pelo preset. */
export function iconeBorda(preset) {
  const seg = {
    topo: 'M2 2H14', base: 'M2 14H14', esquerda: 'M2 2V14', direita: 'M14 2V14',
    h: 'M2 8H14', v: 'M8 2V14'
  };
  const mapa = {
    todas: ['topo', 'base', 'esquerda', 'direita', 'h', 'v'],
    externas: ['topo', 'base', 'esquerda', 'direita'],
    internas: ['h', 'v'],
    horizontais_internas: ['h'],
    verticais_internas: ['v'],
    topo: ['topo'], base: ['base'], esquerda: ['esquerda'], direita: ['direita'],
    nenhuma: []
  };
  const fundo = 'M2 2H14M2 8H14M2 14H14M2 2V14M8 2V14M14 2V14';
  const ativos = (mapa[preset] || []).map(k => seg[k]).join('');
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="${fundo}" stroke="currentColor" stroke-opacity=".28" stroke-width="1" stroke-dasharray="1.5 1.5" fill="none"/>
    ${ativos ? `<path d="${ativos}" stroke="currentColor" stroke-width="2" stroke-linecap="square" fill="none"/>` : ''}
  </svg>`;
}

const ROTULO_PRESET = {
  todas: 'Todos os contornos', externas: 'Bordas externas', internas: 'Divisórias internas',
  horizontais_internas: 'Linhas horizontais internas', verticais_internas: 'Colunas verticais internas',
  topo: 'Topo', base: 'Base', esquerda: 'Esquerda', direita: 'Direita', nenhuma: 'Sem bordas'
};

// ───────────────────────────── Painéis reutilizáveis (modal e popover) ─────────────────────────────

const CSS_PAINEL = `
.ath-tb-tab{display:flex;align-items:center;gap:2px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;white-space:nowrap;background:#fff;border:1px solid #C8D7E6;border-radius:10px;padding:4px 8px;font-size:12px;color:#1F2733}
.ath-tb-tab .sep{width:1px;height:20px;background:#D5DEE9;margin:0 3px}
.ath-tb-tab .tb{min-width:26px;height:28px;border:0;border-radius:6px;background:transparent;color:#1F2733;cursor:pointer;display:inline-grid;place-items:center;padding:0 6px;font:inherit;font-weight:700}
.ath-tb-tab .tb:hover{background:#EEF4FA}.ath-tb-tab .tb.on{background:#DCE8F5;color:#314F79}
.ath-tb-tab select{height:28px;border:1px solid transparent;border-radius:6px;background:transparent;font:inherit;padding:0 2px;cursor:pointer;color:#1F2733}
.ath-tb-tab select:hover{background:#EEF4FA}
.ath-tb-tab.quebra{flex-wrap:wrap;overflow:visible}
.ath-tb-tab .tb,.ath-tb-tab .cor,.ath-tb-tab .sep,.ath-tb-tab input[type=number]{flex:none}
.ath-tb-tab select{flex:none;text-overflow:ellipsis}
.ath-tb-tab #tbFmt{width:50px}.ath-tb-tab #tbFonte{width:88px}.ath-tb-tab #tbH{width:68px}.ath-tb-tab #tbV{width:64px}.ath-tb-tab #tbWrap{width:76px}.ath-tb-tab #tbRot{width:70px}
.ath-tb-tab input[type=number]{width:40px;height:26px;border:1px solid #D5DEE9;border-radius:6px;text-align:center;font:inherit;-moz-appearance:textfield}
.ath-tb-tab input[type=number]::-webkit-inner-spin-button{display:none}
.ath-tb-tab .cor{position:relative;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:6px;cursor:pointer}
.ath-tb-tab .cor:hover{background:#EEF4FA}
.ath-tb-tab .cor input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.ath-tb-tab .cor i{position:absolute;left:6px;right:6px;bottom:3px;height:3px;border-radius:1px;background:currentColor}
.ath-sec-tab{display:flex;flex-direction:column;gap:10px;font-size:12px;color:#1F2733}
.ath-sec-tab h4{margin:0;font-size:10.5px;font-weight:800;color:#314F79;text-transform:uppercase;letter-spacing:.04em}
.ath-sec-tab .lin{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ath-sec-tab .grade-bordas{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.ath-sec-tab .bt{display:grid;place-items:center;height:30px;border:1px solid #D5DEE9;border-radius:7px;background:#fff;color:#1F2733;cursor:pointer;padding:0}
.ath-sec-tab .bt:hover{background:#EEF4FA}
.ath-sec-tab select,.ath-sec-tab input[type=number]{height:28px;border:1px solid #D5DEE9;border-radius:6px;font-size:12px;padding:0 6px;background:#fff}
/* mesmo tamanho dos seletores de cor de Fundo/Linha de borda do modal */
.ath-sec-tab input[type=color]{width:32px;height:24px;border:none;cursor:pointer}
.ath-sec-tab label{display:flex;align-items:center;gap:5px;font-weight:600}
.ath-sec-tab .sec{display:flex;flex-direction:column;gap:6px;border-top:1px dashed #D5DEE9;padding-top:8px}
.ath-pop-tab{position:fixed;z-index:10050;width:330px;max-height:80vh;overflow:auto;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 12px 36px rgba(15,23,42,.22);padding:12px}
td.ath-cel-sel,th.ath-cel-sel{outline:2px solid #314F79;outline-offset:-2px;background-image:linear-gradient(rgba(49,79,121,.10),rgba(49,79,121,.10))}
`;

function garantirCss() {
  if (document.getElementById('athPopTabCss')) return;
  const s = document.createElement('style');
  s.id = 'athPopTabCss';
  s.textContent = CSS_PAINEL;
  document.head.appendChild(s);
}

/** Grava o texto de uma célula (índice unificado) no bloco: cabeçalho → colunas, demais → linhas. */
export function gravarTextoCelula(bloco, r, c, texto) {
  const temCab = bloco.com_cabecalho !== false;
  if (temCab && r === 0) { (bloco.colunas ||= [])[c] = texto; return; }
  const ri = r - (temCab ? 1 : 0);
  bloco.linhas ||= [];
  (bloco.linhas[ri] ||= [])[c] = texto;
}

/**
 * Contexto compartilhado entre barra e seções.
 * @typedef {object} CtxTabela
 * @property {object} bloco
 * @property {() => HTMLTableElement|null} obterTabela
 * @property {() => ({obterRetangulo:Function, obterCelulaFoco:Function}|null)} obterSelecao
 * @property {() => void} aoAlterar
 * @property {{escopo:'selecao'|'tabela'}} estado
 */

function retanguloDoCtx(ctx) {
  if (ctx.estado.escopo === 'tabela') return null;
  const sel = ctx.obterSelecao?.();
  return sel ? sel.obterRetangulo() : null;
}

function reaplicar(ctx) {
  const t = ctx.obterTabela();
  if (t) aplicarEstiloTabelaDom(t, ctx.bloco);
  ctx.aoAlterar?.();
}

/** Aplica `fn(texto)` ao texto das células da seleção (DOM + bloco). Retorna nº de células alteradas. */
function transformarTextoSelecao(ctx, fn) {
  const t = ctx.obterTabela();
  if (!t) return 0;
  const dim = dimensoesTabela(ctx.bloco);
  const rect = retanguloDoCtx(ctx) || { r0: 0, c0: 0, r1: dim.nLinhas - 1, c1: dim.nCols - 1 };
  let mudou = 0;
  for (let r = rect.r0; r <= rect.r1; r++) {
    const tr = t.rows[r];
    if (!tr) continue;
    for (let c = rect.c0; c <= rect.c1; c++) {
      const el = tr.cells[c];
      if (!el) continue;
      const antes = el.textContent;
      const depois = fn(antes);
      if (depois !== antes) { el.textContent = depois; gravarTextoCelula(ctx.bloco, r, c, depois); mudou++; }
    }
  }
  return mudou;
}

const FONTES_BARRA = Object.values(FONTES_SISTEMA);

/**
 * Barra de formatação no estilo de planilha: decimais, formato numérico, fonte, tamanho,
 * negrito/itálico/tachado, cor do texto, preenchimento, alinhamentos, quebra e rotação.
 * @returns {{atualizar: () => void}}
 */
export function montarBarraFormatacaoTabela(el, ctx, { linhaUnica = true } = {}) {
  garantirCss();
  el.classList.add('ath-tb-tab');
  el.classList.toggle('quebra', !linhaUnica);
  const opt = (v, t) => `<option value="${v}">${t}</option>`;
  el.innerHTML = `
    <button type="button" class="tb" data-a="dec-" title="Diminuir casas decimais">.0&#8592;</button>
    <button type="button" class="tb" data-a="dec+" title="Aumentar casas decimais">.00&#8594;</button>
    <select id="tbFmt" title="Formato numérico">${opt('', '123 ▾')}${opt('automatico', 'Automático')}${opt('numero', 'Número')}${opt('porcentagem', 'Porcentagem')}${opt('moeda', 'Moeda (R$)')}</select>
    <span class="sep"></span>
    <select id="tbFonte" title="Fonte" style="max-width:130px">${FONTES_BARRA.map(f => opt(f.id, f.rotulo.replace(/ \(.*\)/, ''))).join('')}</select>
    <span class="sep"></span>
    <button type="button" class="tb" data-a="tam-" title="Diminuir fonte">&minus;</button>
    <input type="number" id="tbTam" min="${TAMANHO_MIN_PT}" max="${TAMANHO_MAX_PT}" step="0.5" title="Tamanho da fonte (pt)">
    <button type="button" class="tb" data-a="tam+" title="Aumentar fonte">+</button>
    <span class="sep"></span>
    <button type="button" class="tb" data-a="negrito" title="Negrito"><b>B</b></button>
    <button type="button" class="tb" data-a="italico" title="Itálico"><i>I</i></button>
    <button type="button" class="tb" data-a="riscado" title="Tachado"><s>S</s></button>
    <label class="cor" title="Cor do texto"><span style="font-weight:800;text-decoration:none">A</span><i></i><input type="color" id="tbCorTexto" value="#1F2733"></label>
    <span class="sep"></span>
    <label class="cor" title="Cor de preenchimento"><span style="display:inline-grid;place-items:center;width:16px;height:16px;border:1.5px solid currentColor;border-radius:3px;font-size:9px">&#9632;</span><i style="background:#F1F5F9" id="tbFundoBarra"></i><input type="color" id="tbFundo" value="#F1F5F9"></label>
    <span class="sep"></span>
    <select id="tbH" title="Alinhamento horizontal">${opt('esquerda', '⇤ Esq.')}${opt('centro', '↔ Centro')}${opt('direita', 'Dir. ⇥')}${opt('justificado', '☰ Just.')}</select>
    <select id="tbV" title="Alinhamento vertical">${opt('topo', '⤒ Topo')}${opt('centro', '↕ Meio')}${opt('base', '⤓ Base')}</select>
    <select id="tbWrap" title="Quebra de texto">${opt('quebrar', '↵ Quebrar')}${opt('nao_quebrar', '→ Manter')}</select>
    <select id="tbRot" title="Rotação do texto">${opt('horizontal', 'A Horiz.')}${opt('cima', '↑ Cima')}${opt('baixo', '↓ Baixo')}</select>
  `;
  const $ = (q) => el.querySelector(q);
  const camada = (props) => { aplicarCamadaSelecao(ctx.bloco, retanguloDoCtx(ctx), props); reaplicar(ctx); atualizar(); };

  const celulaFoco = () => {
    const sel = ctx.obterSelecao?.();
    const f = sel ? sel.obterCelulaFoco() : { r: 0, c: 0 };
    const dim = dimensoesTabela(ctx.bloco);
    return resolverCelula(obterEstiloTabela(ctx.bloco), dim, Math.min(f.r, dim.nLinhas - 1), Math.min(f.c, dim.nCols - 1));
  };

  function atualizar() {
    const res = celulaFoco();
    const nomeFonte = res.fonte || FONTES_BARRA[0].id;
    $('#tbFonte').value = FONTES_BARRA.some(f => f.id === nomeFonte) ? nomeFonte : FONTES_BARRA[0].id;
    $('#tbTam').value = res.tamanho_pt || 9;
    el.querySelector('[data-a="negrito"]').classList.toggle('on', !!res.negrito);
    el.querySelector('[data-a="italico"]').classList.toggle('on', !!res.italico);
    el.querySelector('[data-a="riscado"]').classList.toggle('on', !!res.riscado);
    $('#tbCorTexto').value = res.cor_texto || '#1F2733';
    $('#tbH').value = res.h; $('#tbV').value = res.v;
    $('#tbWrap').value = res.wrap; $('#tbRot').value = res.rotacao;
    $('#tbFundoBarra').style.background = res.fundo || '#FFFFFF';
    if (res.fundo) $('#tbFundo').value = res.fundo;
  }

  el.addEventListener('mousedown', (e) => {
    // Botões não devem roubar o foco/seleção da célula; selects/inputs precisam do foco normal.
    if (e.target.closest('.tb')) e.preventDefault();
  });

  el.addEventListener('click', (e) => {
    const bt = e.target.closest('[data-a]');
    if (!bt) return;
    const a = bt.dataset.a;
    const res = celulaFoco();
    if (a === 'dec+' || a === 'dec-') {
      if (transformarTextoSelecao(ctx, t => ajustarCasasDecimais(t, a === 'dec+' ? 1 : -1))) ctx.aoAlterar?.();
    } else if (a === 'tam+' || a === 'tam-') {
      const novo = Math.max(TAMANHO_MIN_PT, Math.min(TAMANHO_MAX_PT, (res.tamanho_pt || 9) + (a === 'tam+' ? 1 : -1)));
      camada({ tamanho_pt: novo });
    } else if (a === 'negrito' || a === 'italico' || a === 'riscado') {
      camada({ [a]: !res[a] });
    }
  });

  $('#tbFmt').addEventListener('change', (e) => {
    const formato = e.target.value;
    e.target.value = '';
    if (formato && transformarTextoSelecao(ctx, t => formatarNumeroPtBr(t, { formato }))) ctx.aoAlterar?.();
  });
  $('#tbFonte').addEventListener('change', (e) => camada({ fonte: e.target.value }));
  $('#tbTam').addEventListener('change', (e) => camada({ tamanho_pt: Number(e.target.value) }));
  $('#tbCorTexto').addEventListener('input', (e) => camada({ cor_texto: e.target.value }));
  $('#tbFundo').addEventListener('input', (e) => camada({ fundo: e.target.value }));
  $('#tbH').addEventListener('change', (e) => camada({ h: e.target.value }));
  $('#tbV').addEventListener('change', (e) => camada({ v: e.target.value }));
  $('#tbWrap').addEventListener('change', (e) => camada({ wrap: e.target.value }));
  $('#tbRot').addEventListener('change', (e) => camada({ rotacao: e.target.value }));

  atualizar();
  return { atualizar };
}

/**
 * Seções de estilo: escopo, contornos (matriz de ícones), preenchimento, zebra,
 * cabeçalho/rodapé/coluna-chave, padding e quebra global.
 */
export function montarSecoesEstiloTabela(el, ctx) {
  garantirCss();
  el.classList.add('ath-sec-tab');
  const e = () => garantirEstiloTabela(ctx.bloco);
  const est0 = obterEstiloTabela(ctx.bloco);
  const pincel = { largura_pt: 0.75, estilo: 'solida', cor: '#1F2733' };
  const opcoesPad = Object.keys(PADDINGS_CELULA).map(k => `<option value="${k}">${k[0].toUpperCase() + k.slice(1)}</option>`).join('');

  el.innerHTML = `
    <div class="lin" style="justify-content:space-between">
      <h4>Aplicar a</h4>
      <select id="tpEscopo"><option value="selecao">Seleção (clique / Shift+clique)</option><option value="tabela">Tabela inteira</option></select>
    </div>

    <div class="sec" style="border:none;padding:0">
      <h4>Contornos</h4>
      <div class="grade-bordas" id="tpGradeBordas">
        ${PRESETS_BORDA.map(p => `<button type="button" class="bt" data-preset="${p}" title="${ROTULO_PRESET[p]}" aria-label="${ROTULO_PRESET[p]}">${iconeBorda(p)}</button>`).join('')}
      </div>
      <div class="lin">
        <label>Espessura <input type="number" id="tpLargura" min="0.25" max="6" step="0.25" value="${pincel.largura_pt}" style="width:58px"> pt</label>
        <label>Estilo <select id="tpEstilo"><option value="solida">Sólida</option><option value="tracejada">Tracejada</option><option value="pontilhada">Pontilhada</option><option value="dupla">Dupla</option></select></label>
        <label>Cor <input type="color" id="tpCorBorda" value="${pincel.cor}"></label>
      </div>
    </div>

    <div class="sec">
      <h4>Preenchimento</h4>
      <div class="lin">
        <button type="button" class="bt" id="tpLimparFundo" style="padding:0 10px;width:auto">Limpar fundo da seleção</button>
      </div>
      <div class="lin">
        <label><input type="checkbox" id="tpZebra" ${est0.zebra.ativo ? 'checked' : ''}> Zebrada</label>
        <input type="color" id="tpZebraImpar" value="${est0.zebra.cor_impar}" title="Linhas ímpares">
        <input type="color" id="tpZebraPar" value="${est0.zebra.cor_par}" title="Linhas pares">
      </div>
    </div>

    <div class="sec">
      <h4>Cabeçalho · Rodapé · Coluna-chave</h4>
      <div class="lin">
        <label><input type="checkbox" id="tpCabAtivo" ${est0.cabecalho.ativo ? 'checked' : ''}> Cabeçalho</label>
        <input type="color" id="tpCabFundo" value="${est0.cabecalho.fundo || '#F1F5F9'}" title="Fundo do cabeçalho">
        <label>Divisória <input type="number" id="tpCabDiv" min="0" max="6" step="0.25" value="${est0.cabecalho.borda_inferior?.largura_pt ?? 0}" style="width:54px"></label>
      </div>
      <div class="lin">
        <label><input type="checkbox" id="tpRodAtivo" ${est0.rodape.ativo ? 'checked' : ''}> Rodapé</label>
        <input type="color" id="tpRodFundo" value="${est0.rodape.fundo || '#F1F5F9'}" title="Fundo do rodapé">
        <label>Divisória <input type="number" id="tpRodDiv" min="0" max="6" step="0.25" value="${est0.rodape.borda_superior?.largura_pt ?? 0}" style="width:54px"></label>
      </div>
      <div class="lin">
        <label><input type="checkbox" id="tpColAtivo" ${est0.coluna_cabecalho.ativo ? 'checked' : ''}> Coluna de cabeçalho</label>
        <input type="color" id="tpColFundo" value="${est0.coluna_cabecalho.fundo || '#F1F5F9'}" title="Fundo da coluna-chave">
        <label>Lateral <input type="number" id="tpColDiv" min="0" max="6" step="0.25" value="${est0.coluna_cabecalho.borda_direita?.largura_pt ?? 0}" style="width:54px"></label>
      </div>
    </div>

    <div class="sec">
      <h4>Dados</h4>
      <div class="lin">
        <button type="button" class="bt" id="tpImportCsv" style="padding:0 12px;width:auto" title="Importar tabela de um arquivo CSV (Excel, Google Planilhas)">Importar CSV…</button>
        <input type="file" id="tpArqCsv" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden>
        <label><input type="checkbox" id="tpCsvCab" checked> 1ª linha é cabeçalho</label>
      </div>
      <div class="lin">
        <label>Separador <select id="tpCsvSep"><option value="auto">Automático</option><option value="${SEPARADORES.ponto_virgula}">Ponto e vírgula ( ; )</option><option value="${SEPARADORES.virgula}">Vírgula ( , )</option><option value="${SEPARADORES.tab}">Tabulação</option><option value="${SEPARADORES.barra}">Barra ( | )</option></select></label>
        <label>Modo <select id="tpCsvModo"><option value="substituir">Substituir dados</option><option value="anexar">Anexar linhas</option></select></label>
      </div>
      <div id="tpCsvMsg" role="status" style="font-size:11px;color:#64748B;min-height:14px"></div>
    </div>

    <div class="sec">
      <h4>Espaçamento e quebra</h4>
      <div class="lin">
        <label>Padding <select id="tpPadding">${opcoesPad}</select></label>
        <label>Palavras longas <select id="tpQuebra"><option value="normal">Normal</option><option value="forcada">Forçar quebra</option></select></label>
      </div>
    </div>
  `;
  const $ = (q) => el.querySelector(q);
  $('#tpPadding').value = est0.padding;
  $('#tpQuebra').value = est0.quebra;

  $('#tpEscopo').addEventListener('change', ev => { ctx.estado.escopo = ev.target.value; });

  const lerPincel = () => ({
    largura_pt: Math.max(0.25, Math.min(6, Number($('#tpLargura').value) || 0.75)),
    estilo: $('#tpEstilo').value,
    cor: corValida($('#tpCorBorda').value, '#1F2733')
  });
  $('#tpGradeBordas').addEventListener('click', ev => {
    const bt = ev.target.closest('[data-preset]');
    if (!bt) return;
    aplicarPresetBorda(ctx.bloco, bt.dataset.preset, retanguloDoCtx(ctx), lerPincel());
    reaplicar(ctx);
  });
  $('#tpLimparFundo').addEventListener('click', () => { aplicarCamadaSelecao(ctx.bloco, retanguloDoCtx(ctx), { fundo: null }); reaplicar(ctx); });

  const zebra = () => {
    const z = e().zebra;
    z.ativo = $('#tpZebra').checked;
    z.cor_impar = corValida($('#tpZebraImpar').value, '#FFFFFF');
    z.cor_par = corValida($('#tpZebraPar').value, '#F1F5F9');
    reaplicar(ctx);
  };
  ['#tpZebra', '#tpZebraImpar', '#tpZebraPar'].forEach(id => $(id).addEventListener('input', zebra));

  const cabecalho = () => {
    const c = e().cabecalho;
    c.ativo = $('#tpCabAtivo').checked;
    c.fundo = corValida($('#tpCabFundo').value);
    const w = Number($('#tpCabDiv').value) || 0;
    c.borda_inferior = w > 0 ? normalizarBorda({ ...lerPincel(), largura_pt: w }) : null;
    reaplicar(ctx);
  };
  ['#tpCabAtivo', '#tpCabFundo', '#tpCabDiv'].forEach(id => $(id).addEventListener('input', cabecalho));

  const rodape = () => {
    const r = e().rodape;
    r.ativo = $('#tpRodAtivo').checked;
    r.fundo = corValida($('#tpRodFundo').value);
    const w = Number($('#tpRodDiv').value) || 0;
    r.borda_superior = w > 0 ? normalizarBorda({ ...lerPincel(), largura_pt: w }) : undefined;
    reaplicar(ctx);
  };
  ['#tpRodAtivo', '#tpRodFundo', '#tpRodDiv'].forEach(id => $(id).addEventListener('input', rodape));

  const colChave = () => {
    const cc = e().coluna_cabecalho;
    cc.ativo = $('#tpColAtivo').checked;
    cc.fundo = corValida($('#tpColFundo').value);
    const w = Number($('#tpColDiv').value) || 0;
    cc.borda_direita = w > 0 ? normalizarBorda({ ...lerPincel(), largura_pt: w }) : undefined;
    reaplicar(ctx);
  };
  ['#tpColAtivo', '#tpColFundo', '#tpColDiv'].forEach(id => $(id).addEventListener('input', colChave));

  // Importação de CSV
  const msg = (t, erro = false) => { const m = $('#tpCsvMsg'); m.textContent = t; m.style.color = erro ? '#B42318' : '#15803D'; };
  $('#tpImportCsv').addEventListener('click', () => $('#tpArqCsv').click());
  $('#tpArqCsv').addEventListener('change', async (ev) => {
    const arq = ev.target.files?.[0];
    ev.target.value = '';
    if (!arq) return;
    try {
      const { texto, codificacao } = decodificarCsv(await arq.arrayBuffer());
      const res = csvParaTabela(texto, { separador: $('#tpCsvSep').value, cabecalho: $('#tpCsvCab').checked });
      if (!res.colunas.length || (!res.linhas.length && $('#tpCsvModo').value === 'anexar')) {
        msg('Nenhum dado encontrado no arquivo.', true);
        return;
      }
      garantirEstiloTabela(ctx.bloco);
      const total = aplicarCsvAoBloco(ctx.bloco, res, { modo: $('#tpCsvModo').value });
      const sepNome = res.separador === '	' ? 'tabulação' : `"${res.separador}"`;
      const aviso = res.truncado.linhas || res.truncado.colunas ? ' (arquivo grande: excedente ignorado)' : '';
      msg(`Importado: ${res.linhas.length} linha(s) × ${res.colunas.length} coluna(s) · separador ${sepNome} · ${codificacao}${aviso}. Total: ${total.linhas} × ${total.colunas}.`);
      if (ctx.aoReconstruir) ctx.aoReconstruir(); else reaplicar(ctx);
      ctx.aoAlterar?.();
    } catch (err) {
      msg('Não foi possível ler o arquivo: ' + err.message, true);
    }
  });

  $('#tpPadding').addEventListener('change', ev => { e().padding = ev.target.value; reaplicar(ctx); });
  $('#tpQuebra').addEventListener('change', ev => { e().quebra = ev.target.value; reaplicar(ctx); });
}

// ───────────────────────────── Popover ─────────────────────────────

let popoverAtivo = null;
let tabelaDoPopover = () => null;
export function fecharPopoverEstiloTabela() {
  if (popoverAtivo) { popoverAtivo.remove(); popoverAtivo = null; document.removeEventListener('mousedown', fecharForaHandler, true); }
}
function fecharForaHandler(e) {
  if (!popoverAtivo || popoverAtivo.contains(e.target)) return;
  // clicar na própria tabela serve para escolher a seleção; não fecha
  const t = tabelaDoPopover();
  if (t && t.contains(e.target)) return;
  if (e.target.closest?.('[data-ath-pop-tab-toggle]')) return;
  fecharPopoverEstiloTabela();
}

/** Popover rápido (barra do bloco): mesmas seções do modal, com a barra de formatação no topo. */
export function abrirPopoverEstiloTabela({ bloco, ancora, obterTabela, obterSelecao, aoAlterar, aoReconstruir }) {
  fecharPopoverEstiloTabela();
  garantirCss();

  const pop = document.createElement('div');
  pop.className = 'ath-pop-tab';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Estilo da tabela');
  pop.style.width = '420px';
  pop.innerHTML = '<div id="popBarra" style="margin-bottom:10px"></div><div id="popSecoes"></div>';
  document.body.appendChild(pop);
  popoverAtivo = pop;
  tabelaDoPopover = obterTabela;

  const ctx = { bloco, obterTabela, obterSelecao, aoAlterar, aoReconstruir, estado: { escopo: 'selecao' } };
  montarBarraFormatacaoTabela(pop.querySelector('#popBarra'), ctx, { linhaUnica: false });
  montarSecoesEstiloTabela(pop.querySelector('#popSecoes'), ctx);

  const rect = ancora.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 430))}px`;
  pop.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - pop.offsetHeight - 8))}px`;
  document.addEventListener('mousedown', fecharForaHandler, true);
  pop.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharPopoverEstiloTabela(); });
  return pop;
}
