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
  PADDINGS_CELULA, PRESETS_BORDA, corValida
} from '../core/athenes_tabela_estilo.js';

// ───────────────────────────── DOM ─────────────────────────────

/** Reaplica o estilo declarativo do bloco a uma <table> existente (um único passe). */
export function aplicarEstiloTabelaDom(table, bloco) {
  const estilo = obterEstiloTabela(bloco);
  const dim = dimensoesTabela(bloco);
  table.style.cssText = tabelaParaCss();
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
export function construirTabelaDom(b, classe, aoAlterarConteudo) {
  const table = document.createElement('table');
  table.className = classe;
  table.dataset.blocoId = b.id;

  const cols = b.colunas || (b.tipo === 'quadro' ? ['Categoria', 'Definição'] : ['Coluna A', 'Coluna B']);
  const linhas = b.linhas || [[b.tipo === 'quadro' ? 'Dimensão A' : 'Dado 1', b.tipo === 'quadro' ? 'Conteúdo descritivo A' : 'Dado 2']];
  const temCab = b.com_cabecalho !== false;

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
    const r = cel.parentElement.rowIndex; // índice unificado (thead + tbody)
    const c = Number(cel.dataset.c);
    const texto = cel.textContent;
    if (temCab && r === 0) { (b.colunas ||= [...cols])[c] = texto; }
    else {
      const ri = r - (temCab ? 1 : 0);
      b.linhas ||= linhas;
      (b.linhas[ri] ||= [])[c] = texto;
    }
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

// ───────────────────────────── Popover ─────────────────────────────

const CSS_POPOVER = `
.ath-pop-tab{position:fixed;z-index:10050;width:330px;max-height:80vh;overflow:auto;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 12px 36px rgba(15,23,42,.22);padding:12px;font-size:12px;color:#1F2733;display:flex;flex-direction:column;gap:10px}
.ath-pop-tab h4{margin:0;font-size:10.5px;font-weight:800;color:#314F79;text-transform:uppercase;letter-spacing:.04em}
.ath-pop-tab .lin{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ath-pop-tab .grade-bordas{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.ath-pop-tab .bt{display:grid;place-items:center;height:30px;border:1px solid #D5DEE9;border-radius:7px;background:#fff;color:#1F2733;cursor:pointer;padding:0}
.ath-pop-tab .bt:hover{background:#EEF4FA}.ath-pop-tab .bt.on{background:#EEF4FA;border-color:#314F79;color:#314F79}
.ath-pop-tab select,.ath-pop-tab input[type=number]{height:28px;border:1px solid #D5DEE9;border-radius:6px;font-size:12px;padding:0 6px;background:#fff}
.ath-pop-tab input[type=color]{width:30px;height:26px;padding:0;border:1px solid #D5DEE9;border-radius:6px;background:none;cursor:pointer}
.ath-pop-tab label{display:flex;align-items:center;gap:5px;font-weight:600}
.ath-pop-tab .sec{display:flex;flex-direction:column;gap:6px;border-top:1px dashed #D5DEE9;padding-top:8px}
td.ath-cel-sel,th.ath-cel-sel{outline:2px solid #314F79;outline-offset:-2px;background-image:linear-gradient(rgba(49,79,121,.10),rgba(49,79,121,.10))}
`;

function garantirCss() {
  if (document.getElementById('athPopTabCss')) return;
  const s = document.createElement('style');
  s.id = 'athPopTabCss';
  s.textContent = CSS_POPOVER;
  document.head.appendChild(s);
}

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

/**
 * Abre o popover de estilo da tabela.
 * @param {object} p
 * @param {object} p.bloco
 * @param {HTMLElement} p.ancora      elemento de referência para posicionar
 * @param {() => HTMLTableElement|null} p.obterTabela
 * @param {() => ({obterRetangulo:Function, selecionar:Function}|null)} p.obterSelecao
 * @param {() => void} p.aoAlterar    persistência (ex.: notificarMudancaRapida)
 */
export function abrirPopoverEstiloTabela({ bloco, ancora, obterTabela, obterSelecao, aoAlterar }) {
  fecharPopoverEstiloTabela();
  garantirCss();

  const pop = document.createElement('div');
  pop.className = 'ath-pop-tab';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Estilo da tabela');

  const pincel = { largura_pt: 0.75, estilo: 'solida', cor: '#1F2733' };
  let escopo = 'selecao'; // 'selecao' | 'tabela'

  const dim = () => dimensoesTabela(bloco);
  const retanguloAtual = () => {
    if (escopo === 'tabela') return null;
    const sel = obterSelecao?.();
    return sel ? sel.obterRetangulo() : null;
  };
  const reaplicar = () => {
    const t = obterTabela();
    if (t) aplicarEstiloTabelaDom(t, bloco);
    aoAlterar?.();
  };
  const e = () => garantirEstiloTabela(bloco);

  const opcoesPad = Object.keys(PADDINGS_CELULA).map(k => `<option value="${k}">${k[0].toUpperCase() + k.slice(1)}</option>`).join('');
  const est0 = obterEstiloTabela(bloco);
  const camT = est0.camadas.tabela;

  pop.innerHTML = `
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
        <label>Fundo <input type="color" id="tpFundo" value="${camT.fundo || '#F1F5F9'}"></label>
        <button type="button" class="bt" id="tpAplicarFundo" style="padding:0 10px;width:auto">Aplicar</button>
        <button type="button" class="bt" id="tpLimparFundo" style="padding:0 10px;width:auto">Limpar</button>
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
      <h4>Texto da célula</h4>
      <div class="lin">
        <label>Horizontal <select id="tpH"><option value="esquerda">Esquerda</option><option value="centro">Centro</option><option value="direita">Direita</option><option value="justificado">Justificado</option></select></label>
        <label>Vertical <select id="tpV"><option value="topo">Topo</option><option value="centro">Centro</option><option value="base">Base</option></select></label>
      </div>
      <div class="lin">
        <label>Padding <select id="tpPadding">${opcoesPad}</select></label>
        <label>Quebra <select id="tpQuebra"><option value="normal">Normal</option><option value="forcada">Forçada (palavras longas)</option></select></label>
      </div>
    </div>
  `;
  document.body.appendChild(pop);
  popoverAtivo = pop;
  tabelaDoPopover = obterTabela;

  // posição ao lado da âncora, mantendo-se dentro da janela
  const rect = ancora.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 340))}px`;
  pop.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - pop.offsetHeight - 8))}px`;
  document.addEventListener('mousedown', fecharForaHandler, true);

  const $ = (id) => pop.querySelector(id);
  $('#tpPadding').value = est0.padding;
  $('#tpQuebra').value = est0.quebra;
  $('#tpH').value = camT.h || 'esquerda';
  $('#tpV').value = camT.v || 'topo';

  $('#tpEscopo').addEventListener('change', ev => { escopo = ev.target.value; });

  const lerPincel = () => ({
    largura_pt: Math.max(0.25, Math.min(6, Number($('#tpLargura').value) || 0.75)),
    estilo: $('#tpEstilo').value,
    cor: corValida($('#tpCorBorda').value, '#1F2733')
  });
  $('#tpGradeBordas').addEventListener('click', ev => {
    const bt = ev.target.closest('[data-preset]');
    if (!bt) return;
    aplicarPresetBorda(bloco, bt.dataset.preset, retanguloAtual(), lerPincel());
    reaplicar();
  });

  $('#tpAplicarFundo').addEventListener('click', () => { aplicarCamadaSelecao(bloco, retanguloAtual(), { fundo: $('#tpFundo').value }); reaplicar(); });
  $('#tpLimparFundo').addEventListener('click', () => { aplicarCamadaSelecao(bloco, retanguloAtual(), { fundo: null }); reaplicar(); });

  const zebra = () => {
    const z = e().zebra;
    z.ativo = $('#tpZebra').checked;
    z.cor_impar = corValida($('#tpZebraImpar').value, '#FFFFFF');
    z.cor_par = corValida($('#tpZebraPar').value, '#F1F5F9');
    reaplicar();
  };
  ['#tpZebra', '#tpZebraImpar', '#tpZebraPar'].forEach(id => $(id).addEventListener('input', zebra));

  const cabecalho = () => {
    const c = e().cabecalho;
    c.ativo = $('#tpCabAtivo').checked;
    c.fundo = corValida($('#tpCabFundo').value);
    const w = Number($('#tpCabDiv').value) || 0;
    c.borda_inferior = w > 0 ? normalizarBorda({ ...lerPincel(), largura_pt: w }) : null;
    reaplicar();
  };
  ['#tpCabAtivo', '#tpCabFundo', '#tpCabDiv'].forEach(id => $(id).addEventListener('input', cabecalho));

  const rodape = () => {
    const r = e().rodape;
    r.ativo = $('#tpRodAtivo').checked;
    r.fundo = corValida($('#tpRodFundo').value);
    const w = Number($('#tpRodDiv').value) || 0;
    r.borda_superior = w > 0 ? normalizarBorda({ ...lerPincel(), largura_pt: w }) : undefined;
    reaplicar();
  };
  ['#tpRodAtivo', '#tpRodFundo', '#tpRodDiv'].forEach(id => $(id).addEventListener('input', rodape));

  const colChave = () => {
    const cc = e().coluna_cabecalho;
    cc.ativo = $('#tpColAtivo').checked;
    cc.fundo = corValida($('#tpColFundo').value);
    const w = Number($('#tpColDiv').value) || 0;
    cc.borda_direita = w > 0 ? normalizarBorda({ ...lerPincel(), largura_pt: w }) : undefined;
    reaplicar();
  };
  ['#tpColAtivo', '#tpColFundo', '#tpColDiv'].forEach(id => $(id).addEventListener('input', colChave));

  $('#tpH').addEventListener('change', ev => { aplicarCamadaSelecao(bloco, retanguloAtual(), { h: ev.target.value }); reaplicar(); });
  $('#tpV').addEventListener('change', ev => { aplicarCamadaSelecao(bloco, retanguloAtual(), { v: ev.target.value }); reaplicar(); });
  $('#tpPadding').addEventListener('change', ev => { e().padding = ev.target.value; reaplicar(); });
  $('#tpQuebra').addEventListener('change', ev => { e().quebra = ev.target.value; reaplicar(); });

  pop.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharPopoverEstiloTabela(); });
  return pop;
}
