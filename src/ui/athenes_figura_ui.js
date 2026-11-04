// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — UI de Figuras e Subgrid: seletores gráficos (ícones), grade de imagens e painel visual.
 *
 * Componentes reutilizáveis e desacoplados (editor, inspetor e modal usam os mesmos):
 *  - `criarGrupoIcones`            grupo de botões com ícone/tooltip, estado `aria-pressed`
 *  - `iconeLayout`/`iconeOpcao`     ícones SVG gerados a partir dos dados (sem imagens externas)
 *  - `construirGradeFiguraDom`      grade de imagens a partir de `descreverFigura` (mesma do PDF)
 *  - `criarBarraItemFigura`         barra flutuante da imagem selecionada no canvas
 *  - `montarPainelFiguraVisual`     painel lateral/modal completo
 *  - `abrirSeletorLayoutFigura`     popover de layouts para a barra rápida do bloco
 */

import {
  LAYOUTS_FIGURA, GAPS_FIGURA, RAIOS_IMG, obterLayoutFigura, obterConfigFigura, descreverFigura,
  ajustarItensAoLayout, PLACEHOLDER_IMG, AJUSTES_IMG, qtdSlotsDoLayout, SUBROTULO_TIPOS, SUBROTULO_FORMATOS,
  PAPEIS_SEMANTICOS, papelSemanticoDoBloco, definirPapelSemantico, FUNDOS_CODIGO, PALETAS_FIGURA
} from '../core/athenes_figura_layout.js';
import { montarConteudoCodigoDom } from './athenes_figura_codigo_ui.js';
import { rotuloDaFigura } from '../core/athenes_documento.js';
import { FONTES_SISTEMA, estiloParaCssComAlinhamento, localizarEstilo } from '../core/athenes_estilos.js';

const CSS = `
.ath-ic-grupo{display:flex;flex-wrap:wrap;gap:4px}
.ath-ic-bt{display:inline-grid;place-items:center;min-width:34px;height:30px;padding:0 6px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;color:#475569;cursor:pointer;font:700 11px var(--glx-font,inherit)}
.ath-ic-bt:hover{background:#EEF4FA;color:#314F79}
.ath-ic-bt[aria-pressed="true"]{background:#DCE8F5;border-color:#314F79;color:#314F79}
.ath-ic-bt svg{display:block}
.ath-ic-lista{display:flex;flex-direction:column;gap:3px}
.ath-ic-item{display:flex;align-items:center;gap:9px;width:100%;min-height:30px;padding:2px 8px 2px 6px;border:1px solid transparent;border-radius:8px;background:#fff;color:#334155;cursor:pointer;text-align:left;font:600 12px var(--glx-font,inherit)}
.ath-ic-item .ic{flex:none;display:inline-grid;place-items:center;width:30px;height:24px;color:#64748B}
.ath-ic-item .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ath-ic-item:hover{background:#F1F5F9}
.ath-ic-item[aria-pressed="true"]{background:#EAF1FA;border-color:#9DB6D4;color:#1F3B63}
.ath-ic-item[aria-pressed="true"] .ic{color:#314F79}
.ath-ic-item[aria-pressed="true"]::after{content:"✓";flex:none;font-weight:800;color:#314F79}
.ath-fig-painel{display:flex;flex-direction:column;gap:10px}
.ath-fig-painel details{border:1px solid #E2E8F0;border-radius:10px;background:#fff;padding:0 8px 8px}
.ath-fig-painel summary{cursor:pointer;padding:8px 2px;margin:0;font:800 10.5px var(--glx-font,inherit);color:#314F79;text-transform:uppercase;letter-spacing:.04em;list-style:none}
.ath-fig-painel summary::-webkit-details-marker{display:none}
.ath-fig-painel summary::before{content:"▸";display:inline-block;width:12px;transition:transform .12s}
.ath-fig-painel details[open] > summary::before{transform:rotate(90deg)}
.ath-fig-painel .sub{margin:8px 0 3px;font:700 10.5px var(--glx-font,inherit);color:#64748B}
.ath-fig-painel .campo{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin-top:6px;font:600 12px var(--glx-font,inherit);color:#475569}
.ath-fig-painel .campo input[type=number]{width:84px;height:30px;box-sizing:border-box;padding:0 8px;text-align:right}
.ath-fig-painel .campo input[type=color]{width:56px;height:30px;box-sizing:border-box;padding:2px;border:1px solid #D5DEE9;border-radius:6px;background:#fff;cursor:pointer}
.ath-fig-painel .campo .un{margin-left:4px;color:#94A3B8;font-weight:600}
.ath-fig-painel .foco-linha{display:flex;align-items:center;justify-content:space-between;margin-top:6px;font:600 12px var(--glx-font,inherit);color:#475569}
.ath-fig-painel input[type=number]{border:1px solid #D5DEE9;border-radius:6px}
.ath-fig-moldura{transition:box-shadow .12s ease,outline-color .12s ease}
.ath-fig-item{position:relative}
.ath-fig-item.interativo .ath-fig-moldura{cursor:pointer;outline:2px solid transparent;outline-offset:2px}
.ath-fig-item.interativo:hover .ath-fig-moldura{outline-color:rgba(49,79,121,.35)}
.ath-fig-item.sel .ath-fig-moldura{outline:2px solid #314F79!important;outline-offset:2px}
.ath-fig-subrot-in{position:absolute;top:6px;left:6px;background:rgba(255,255,255,.92);color:#1F2733;font:800 11px var(--glx-font,inherit);padding:1px 6px;border-radius:5px;box-shadow:0 1px 3px rgba(15,23,42,.2);pointer-events:none}
.ath-fig-subrot{font-weight:800;color:#1F2733;margin-right:4px}
.ath-fig-barra-item{position:absolute;top:-34px;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:3px;background:#fff;border:1.5px solid #CBD5E1;border-radius:8px;padding:2px 4px;box-shadow:0 4px 12px rgba(15,23,42,.18);white-space:nowrap}
.ath-fig-barra-item .ath-ic-bt{height:26px;min-width:28px;border-color:transparent}
.ath-fig-barra-item{width:max-content;max-width:none}
.ath-fig-barra-item .ath-ic-grupo{flex-wrap:nowrap;gap:2px}
.ath-fig-barra-item .sep{width:1px;height:18px;background:#D5DEE9}
.ath-fig-legenda-geral:focus,.ath-bloco-fonte:focus,.ath-fig-titulo .ath-titulo-texto-editavel:focus{outline:2px solid #314F79;outline-offset:2px;border-radius:3px}
.ath-pop-layout{position:fixed;z-index:10050;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 12px 36px rgba(15,23,42,.22);padding:8px;width:260px;max-height:70vh;overflow:auto}
`;

function garantirCss() {
  if (document.getElementById('athFigUiCss')) return;
  const s = document.createElement('style');
  s.id = 'athFigUiCss';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ───────────────────────────── Ícones ─────────────────────────────

const svg = (corpo, w = 24, h = 18) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${corpo}</svg>`;

/** Ícone do layout: retângulos posicionados exatamente como os slots da grade. */
export function iconeLayout(id) {
  const l = obterLayoutFigura(id);
  const W = 20, H = 14, g = 1.4, x0 = 2, y0 = 2;
  const somaC = l.cols.reduce((a, b) => a + b, 0);
  const somaR = l.rows.length;
  const larguras = l.cols.map(f => (W - g * (l.cols.length - 1)) * f / somaC);
  const altura = (H - g * (somaR - 1)) / somaR;
  const xi = (c) => x0 + larguras.slice(0, c).reduce((a, b) => a + b, 0) + g * c;
  const yi = (r) => y0 + (altura + g) * r;
  const rects = l.slots.map(([c0, c1, r0, r1]) => {
    const x = xi(c0 - 1), y = yi(r0 - 1);
    const w = xi(c1 - 1) - g - x, h = yi(r1 - 1) - g - y;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="1" fill="currentColor" fill-opacity=".22"/>`;
  }).join('');
  return svg(rects);
}

const ICONES = {
  gap: (v) => {
    const d = GAPS_FIGURA[v];
    const a = 3, tot = 18, w = (tot - d) / 2;
    return svg(`<rect x="${a}" y="4" width="${w}" height="10" rx="1" fill="currentColor" fill-opacity=".25"/><rect x="${a + w + d}" y="4" width="${w}" height="10" rx="1" fill="currentColor" fill-opacity=".25"/>${d ? `<path d="M${a + w} 16h${d}" stroke-width="1.2"/>` : ''}`);
  },
  subrotulo_tipo: (v) => svg(`<text x="12" y="13" text-anchor="middle" font-size="10" font-weight="800" fill="currentColor" stroke="none">${{ nenhum: '—', letra_minuscula: 'a', letra_maiuscula: 'A', numero: '1' }[v]}</text>`),
  subrotulo_formato: (v) => svg(`<text x="12" y="13" text-anchor="middle" font-size="10" font-weight="800" fill="currentColor" stroke="none">${{ parenteses: '(a)', fecha: 'a)', ponto: 'a.', simples: 'a' }[v]}</text>`),
  subrotulo_posicao: (v) => svg(`<rect x="4" y="2" width="16" height="10" rx="1.5"/>${v === 'interna' ? '<rect x="5.5" y="3.5" width="5" height="3" rx=".8" fill="currentColor" stroke="none"/>' : '<rect x="4" y="14" width="6" height="2.2" rx=".6" fill="currentColor" stroke="none"/>'}`),
  img_moldura: (v) => ({
    nenhuma: svg('<rect x="4" y="3" width="16" height="12" rx="1" stroke-dasharray="2 2" stroke-opacity=".5"/><path d="M6 13l4-4 3 3 2-2 3 3" stroke-opacity=".7"/>'),
    fina: svg('<rect x="4" y="3" width="16" height="12" rx="1"/><path d="M6 13l4-4 3 3 2-2 3 3" stroke-opacity=".6"/>'),
    dupla: svg('<rect x="3" y="2" width="18" height="14" rx="1"/><rect x="5.5" y="4.5" width="13" height="9" rx=".5"/>'),
    passe_partout: svg('<rect x="3" y="2" width="18" height="14" rx="1"/><rect x="7" y="6" width="10" height="6" fill="currentColor" fill-opacity=".3"/>')
  })[v],
  img_raio: (v) => svg(`<rect x="5" y="3" width="14" height="12" rx="${Math.min(RAIOS_IMG[v], 6) * (v === 'pilula' ? 1 : 0.9)}"/>`),
  img_sombra: (v) => svg(`${v !== 'nenhuma' ? `<rect x="${v === 'suave' ? 6 : v === 'media' ? 7 : 8}" y="${v === 'suave' ? 5 : v === 'media' ? 6 : 7.5}" width="13" height="10" rx="1.5" fill="currentColor" fill-opacity="${v === 'suave' ? .15 : v === 'media' ? .28 : .42}" stroke="none"/>` : ''}<rect x="4" y="3" width="13" height="10" rx="1.5" fill="#fff"/>`),
  ajuste: (v) => ({
    contain: svg('<rect x="3" y="2" width="18" height="14" rx="1"/><rect x="7" y="5" width="10" height="8" fill="currentColor" fill-opacity=".3"/>'),
    cover: svg('<rect x="3" y="2" width="18" height="14" rx="1"/><path d="M3 2h18v14H3z" fill="currentColor" fill-opacity=".3" stroke="none"/><path d="M5 12l5-5 4 4 2-2 3 3" stroke-opacity=".7"/>'),
    fill: svg('<rect x="3" y="2" width="18" height="14" rx="1"/><path d="M6 5l12 8M18 5L6 13" stroke-opacity=".6"/>')
  })[v],
  proporcao: (v) => {
    const mapa = { livre: [16, 12], '16/9': [18, 10], '4/3': [16, 12], '1/1': [13, 13], '3/4': [11, 14], '9/16': [8, 15] };
    const [w, h] = mapa[v] || [16, 12];
    return v === 'livre'
      ? svg('<rect x="3" y="3" width="18" height="12" rx="1" stroke-dasharray="2.5 2"/>')
      : svg(`<rect x="${12 - w / 2}" y="${9 - h / 2}" width="${w}" height="${h}" rx="1"/>`);
  },
  largura_modo: (v) => ({
    corpo: svg('<rect x="1.5" y="1.5" width="21" height="15" rx="1" stroke-opacity=".4"/><rect x="6" y="5" width="12" height="8" fill="currentColor" fill-opacity=".3"/>'),
    estendida: svg('<rect x="1.5" y="1.5" width="21" height="15" rx="1" stroke-opacity=".4"/><rect x="3.5" y="5" width="17" height="8" fill="currentColor" fill-opacity=".3"/>'),
    pagina: svg('<rect x="1.5" y="1.5" width="21" height="15" rx="1" stroke-opacity=".4"/><rect x="1.5" y="5" width="21" height="8" fill="currentColor" fill-opacity=".3"/>'),
    pct: svg('<rect x="1.5" y="1.5" width="21" height="15" rx="1" stroke-opacity=".4"/><rect x="6" y="5" width="12" height="8" stroke-dasharray="2 2"/><text x="12" y="11.5" text-anchor="middle" font-size="6" font-weight="800" fill="currentColor" stroke="none">%</text>')
  })[v],
  alinhamento_bloco: (v) => {
    const x = v === 'esquerda' ? 3 : v === 'direita' ? 13 : 8;
    return svg(`<path d="M2 3h20M2 15h20" stroke-opacity=".4"/><rect x="${x}" y="6" width="8" height="6" fill="currentColor" fill-opacity=".3"/>`);
  },
  fluxo: (v) => {
    const linhas = '<path d="M2 3h20M2 15h20" stroke-opacity=".45"/>';
    if (v === 'em_linha') return svg(`${linhas}<rect x="6" y="6" width="12" height="6" fill="currentColor" fill-opacity=".3"/>`);
    const x = v === 'contornar_esq' ? 2 : 14;
    const tx = v === 'contornar_esq' ? 12 : 2;
    return svg(`<rect x="${x}" y="2" width="8" height="8" fill="currentColor" fill-opacity=".3"/><path d="M${tx} 4h${v === 'contornar_esq' ? 10 : 10}M${tx} 8h10M2 13h20" stroke-opacity=".5"/>`);
  },
  estilo_traco: (v) => svg(`<path d="M3 9h18" stroke-width="2" ${v === 'tracejada' ? 'stroke-dasharray="3 2.5"' : ''}/>`),
  trocar: () => svg('<rect x="3" y="3" width="18" height="12" rx="1.5"/><path d="M8 10l3-3 3 3M11 7v6"/>'),
  remover: () => svg('<path d="M6 5l12 8M18 5L6 13" /><rect x="3" y="3" width="18" height="12" rx="1.5" stroke-opacity=".5"/>')
};

/** Ícones de alinhamento de texto (linhas) — valores CSS: left/center/right/justify. */
function iconeAlinhaTexto(v) {
  const l = { left: [[3, 21], [3, 15], [3, 21], [3, 12]], center: [[3, 21], [6, 18], [3, 21], [7, 17]], right: [[3, 21], [9, 21], [3, 21], [12, 21]], justify: [[3, 21], [3, 21], [3, 21], [3, 21]] }[v];
  if (!l) return svg('<text x="12" y="12.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="currentColor" stroke="none">Aa</text>');
  return svg(l.map(([a, b], i) => `<path d="M${a} ${3.5 + i * 3.6}H${b}"/>`).join(''));
}

/**
 * Alinhamento de texto da legenda/título/fonte: "do estilo" + esquerda/centro/direita/justificado.
 * Valores CSS válidos (`estilo` = herda do estilo tipográfico).
 */
export function criarGrupoAlinhamentoTexto({ valor = 'estilo', aoMudar }) {
  const rot = { estilo: 'Do estilo de texto', left: 'Esquerda', center: 'Centralizado', right: 'Direita', justify: 'Justificado' };
  const norm = { esquerda: 'left', centro: 'center', direita: 'right', justificado_esquerda: 'justify', justificado: 'justify' }[valor] || valor;
  return criarGrupoIcones({
    opcoes: ['estilo', 'left', 'center', 'right', 'justify'].map(k => ({ valor: k, rotulo: rot[k], icone: iconeAlinhaTexto(k === 'estilo' ? '' : k) })),
    valor: norm, aoMudar, rotulo: 'Alinhamento do texto', modo: 'lista'
  });
}

/** Ícone de opção `valor` do tipo `tipo` (ver `ICONES`). */
export function iconeOpcao(tipo, valor) {
  if (tipo === 'layout') return iconeLayout(valor);
  return ICONES[tipo]?.(valor) || '';
}

// ───────────────────────────── Grupo de ícones ─────────────────────────────

/**
 * Grupo de botões exclusivos (radiogroup visual).
 * @param {{opcoes:{valor:string,rotulo:string,icone?:string,texto?:string}[], valor:string,
 *   aoMudar:(v:string)=>void, rotulo?:string, colunas?:number}} p
 */
export function criarGrupoIcones({ opcoes, valor, aoMudar, rotulo = '', colunas = 0, modo = 'icones' }) {
  garantirCss();
  const g = document.createElement('div');
  g.className = modo === 'lista' ? 'ath-ic-lista' : 'ath-ic-grupo';
  g.setAttribute('role', 'radiogroup');
  if (rotulo) g.setAttribute('aria-label', rotulo);
  if (colunas) g.style.cssText = `display:grid;grid-template-columns:repeat(${colunas},1fr)`;
  const marcar = (v) => g.querySelectorAll('.ath-ic-bt, .ath-ic-item').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valor === String(v))));
  opcoes.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = modo === 'lista' ? 'ath-ic-item' : 'ath-ic-bt';
    b.dataset.valor = o.valor;
    b.title = o.rotulo;
    b.setAttribute('aria-label', o.rotulo);
    b.innerHTML = modo === 'lista'
      ? `<span class="ic">${o.icone || ''}</span><span class="tx">${o.rotulo}</span>`
      : (o.icone || `<span>${o.texto || o.rotulo}</span>`);
    b.addEventListener('mousedown', e => e.preventDefault()); // não rouba foco do texto editável
    b.addEventListener('click', e => { e.stopPropagation(); marcar(o.valor); aoMudar(o.valor); });
    g.appendChild(b);
  });
  marcar(valor);
  return g;
}

const ROT = {
  gap: { nenhum: 'Sem espaço', compacto: 'Compacto (4 px)', normal: 'Normal (8 px)', amplo: 'Amplo (16 px)' },
  subrotulo_tipo: { nenhum: 'Sem rótulos', letra_minuscula: 'Letras minúsculas (a, b, c)', letra_maiuscula: 'Letras maiúsculas (A, B, C)', numero: 'Números (1, 2, 3)' },
  subrotulo_formato: { parenteses: 'Entre parênteses  (a)', fecha: 'Parêntese à direita  a)', ponto: 'Com ponto  a.', simples: 'Simples  a' },
  subrotulo_posicao: { interna: 'Rótulo sobre a imagem', externa: 'Rótulo na legenda' },
  img_moldura: { nenhuma: 'Sem moldura', fina: 'Moldura fina', dupla: 'Moldura dupla', passe_partout: 'Passe-partout (respiro)' },
  img_raio: { reto: 'Cantos retos', discreto: 'Discreto (3 px)', arredondado: 'Arredondado (10 px)', pilula: 'Circular / pílula' },
  img_sombra: { nenhuma: 'Sem sombra', suave: 'Sombra suave', media: 'Sombra média', elevada: 'Sombra elevada' },
  ajuste: { contain: 'Ajustar sem cortar (contain)', cover: 'Preencher cortando (cover)', fill: 'Esticar (fill)' },
  proporcao: { livre: 'Proporção livre', '16/9': '16:9', '4/3': '4:3', '1/1': '1:1 quadrada', '3/4': '3:4 retrato', '9/16': '9:16 vertical' },
  largura_modo: { corpo: 'Largura do texto', estendida: 'Estendida até a margem', pagina: 'Largura total da página', pct: 'Porcentagem personalizada' },
  alinhamento_bloco: { esquerda: 'Alinhar à esquerda', centro: 'Centralizar', direita: 'Alinhar à direita' },
  fluxo: { em_linha: 'Em linha (sem contorno)', contornar_esq: 'Texto contorna à direita da figura', contornar_dir: 'Texto contorna à esquerda da figura' },
  estilo_traco: { solida: 'Traço contínuo', tracejada: 'Traço tracejado' },
  codigo_fundo: { transparente: 'Transparente (usa o fundo da folha)', branco: 'Branco', suave: 'Cinza suave' },
  codigo_paleta: { tema: 'Cores do tema', vivida: 'Cores vivas', cinza: 'Escala de cinza (impressão P&B)' }
};

/** Lista (ícone + nome) das opções de um tipo, a partir do dicionário `ROT`. */
function grupo(tipo, valor, aoMudar, chaves) {
  return criarGrupoIcones({
    opcoes: chaves.map(k => ({ valor: k, rotulo: ROT[tipo]?.[k] || k, icone: iconeOpcao(tipo, k) })),
    valor, aoMudar, rotulo: tipo, modo: 'lista'
  });
}

// ───────────────────────────── Grade de imagens (canvas e prévia) ─────────────────────────────

/**
 * Constrói a grade a partir de `descreverFigura`.
 * @param {object} b
 * @param {{margens_mm?:object, estilos?:object[], interativo?:boolean, selecionadoIdx?:number|null,
 *   aoClicarItem?:(idx:number,ev:Event)=>void, aoDuploClique?:(idx:number,ev:Event)=>void}} opc
 */
export function construirGradeFiguraDom(b, opc = {}) {
  garantirCss();
  ajustarItensAoLayout(b);
  const d = descreverFigura(b, { margens_mm: opc.margens_mm });
  const grid = document.createElement('div');
  grid.className = 'ath-fig-grid';
  grid.dataset.layout = d.cfg.layout;
  Object.assign(grid.style, d.grade);

  const rot = rotuloDaFigura(b);
  d.itens.forEach((it) => {
    const cel = document.createElement('div');
    cel.className = 'ath-fig-item' + (opc.interativo ? ' interativo' : '');
    cel.dataset.idx = String(it.idx);
    Object.assign(cel.style, it.celula);

    const mold = document.createElement('div');
    mold.className = 'ath-fig-moldura';
    Object.assign(mold.style, it.moldura);

    if (it.sourceType && it.sourceType !== 'image_url') {
      // figura por código: o resultado aparece como qualquer figura; o código fica oculto (abre em "Editar código")
      montarConteudoCodigoDom(mold, b, (b.itens || [])[it.idx] || {}, it.idx, opc.doc || { estilos: opc.estilos });
      cel.dataset.fonte = it.sourceType;
    } else {
      const img = document.createElement('img');
      img.alt = it.legenda_sub || 'Ilustração';
      img.src = it.url || PLACEHOLDER_IMG;
      img.draggable = false;
      Object.assign(img.style, it.img);
      mold.appendChild(img);
    }

    const estRotulo = localizarEstilo(opc.estilos, d.cfg.subrotulo_texto_estilo_id);
    const estSub = localizarEstilo(opc.estilos, d.cfg.sublegenda_estilo_id);
    if (it.subrotulo?.interno) {
      const chip = document.createElement('span');
      chip.className = 'ath-fig-subrot-in';
      chip.textContent = it.subrotulo.texto;
      if (estRotulo) chip.style.cssText += ';' + estiloParaCssComAlinhamento(estRotulo, '') + ';line-height:1.2;margin:0;text-indent:0;padding:1px 6px;display:inline-block';
      mold.appendChild(chip);
    }
    cel.appendChild(mold);

    if (it.legenda_sub || (it.subrotulo && !it.subrotulo.interno)) {
      const leg = document.createElement('span');
      leg.className = 'ath-fig-sublegenda';
      if (it.subrotulo && !it.subrotulo.interno) {
        const r = document.createElement('span');
        r.className = 'ath-fig-subrot';
        r.textContent = it.subrotulo.texto;
        if (estRotulo) r.style.cssText = estiloParaCssComAlinhamento(estRotulo, '') + ';display:inline;margin:0 4px 0 0;text-indent:0;padding:0';
        leg.appendChild(r);
        leg.appendChild(document.createTextNode(it.legenda_sub));
      } else if (d.qtd > 1) {
        leg.textContent = `${rot} ${b.numero_sequencial || 1}${String.fromCharCode(97 + it.idx)}${b.legenda_sep ?? ' — '}${it.legenda_sub}`;
      }
      if (leg.textContent) {
        if (estSub || d.cfg.sublegenda_alinhamento !== 'estilo') leg.style.cssText += ';' + estiloParaCssComAlinhamento(estSub, d.cfg.sublegenda_alinhamento);
        cel.appendChild(leg);
      }
    }

    if (opc.interativo) {
      mold.addEventListener('click', (ev) => opc.aoClicarItem?.(it.idx, ev));
      mold.addEventListener('dblclick', (ev) => opc.aoDuploClique?.(it.idx, ev));
    }
    if (opc.selecionadoIdx === it.idx) cel.classList.add('sel');
    grid.appendChild(cel);
  });
  return { grid, descricao: d };
}

/**
 * Barra flutuante da imagem selecionada: trocar, enquadramento, ponto focal e limpar.
 * @param {{b:object, idx:number, aoAlterar:()=>void, aoTrocarImagem:(idx:number)=>void, aoLimpar:(idx:number)=>void}} p
 */
export function criarBarraItemFigura({ b, idx, aoAlterar, aoTrocarImagem, aoLimpar, aoEditarCodigo }) {
  garantirCss();
  const it = (b.itens || [])[idx] || {};
  const cfg = obterConfigFigura(b);
  const ehCodigo = !!it.sourceType && it.sourceType !== 'image_url';
  const barra = document.createElement('div');
  barra.className = 'ath-fig-barra-item';
  barra.addEventListener('click', e => e.stopPropagation());
  barra.addEventListener('dblclick', e => e.stopPropagation());

  const sep = () => { const s = document.createElement('span'); s.className = 'sep'; return s; };
  const trocar = document.createElement('button');
  trocar.type = 'button'; trocar.className = 'ath-ic-bt'; trocar.title = ehCodigo ? 'Trocar por uma imagem enviada' : 'Trocar imagem';
  trocar.innerHTML = iconeOpcao('trocar');
  trocar.addEventListener('click', () => aoTrocarImagem(idx));
  barra.appendChild(trocar);

  if (aoEditarCodigo) {
    const cod = document.createElement('button');
    cod.type = 'button'; cod.className = 'ath-ic-bt'; cod.title = ehCodigo ? 'Editar código (SVG, HTML, Mermaid, gráfico JSON)' : 'Inserir via código / vetor';
    cod.innerHTML = '<b style="font:800 11px ui-monospace,Consolas,monospace;letter-spacing:-.5px">&lt;/&gt;</b>';
    if (ehCodigo) cod.setAttribute('aria-pressed', 'true');
    cod.addEventListener('click', () => aoEditarCodigo(idx));
    barra.appendChild(cod);
  }
  if (ehCodigo) return barra; // enquadramento/foco só fazem sentido para imagens raster
  barra.appendChild(sep());
  barra.appendChild(criarGrupoIcones({
    opcoes: AJUSTES_IMG.map(k => ({ valor: k, rotulo: ROT.ajuste[k], icone: iconeOpcao('ajuste', k) })),
    valor: it.ajuste || cfg.ajuste_enquadramento,
    aoMudar: (v) => { it.ajuste = v; aoAlterar(); }
  }));
  barra.appendChild(sep());
  barra.appendChild(criarPadFoco({
    x: it.foco_x ?? cfg.foco_x, y: it.foco_y ?? cfg.foco_y,
    aoMudar: (x, y) => { it.foco_x = x; it.foco_y = y; if (!it.ajuste && cfg.ajuste_enquadramento === 'contain') it.ajuste = 'cover'; aoAlterar(); }
  }));
  if (it.url) {
    barra.appendChild(sep());
    const limpar = document.createElement('button');
    limpar.type = 'button'; limpar.className = 'ath-ic-bt'; limpar.title = 'Remover imagem deste slot';
    limpar.innerHTML = iconeOpcao('remover');
    limpar.addEventListener('click', () => aoLimpar(idx));
    barra.appendChild(limpar);
  }
  return barra;
}

/** Matriz 3×3 do ponto focal (reenquadramento rápido com `cover`). */
export function criarPadFoco({ x, y, aoMudar }) {
  const pad = document.createElement('div');
  pad.title = 'Ponto focal do recorte';
  pad.style.cssText = 'display:grid;grid-template-columns:repeat(3,9px);gap:2px;padding:2px;border:1px solid #D5DEE9;border-radius:6px;background:#fff';
  const pos = [0, 50, 100];
  const ativo = (v) => pos.reduce((m, p) => (Math.abs(p - v) < Math.abs(m - v) ? p : m), 50);
  const ax = ativo(x), ay = ativo(y);
  pos.forEach(py => pos.forEach(px => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Foco ${px}% × ${py}%`);
    b.style.cssText = `width:9px;height:9px;padding:0;border:0;border-radius:2px;cursor:pointer;background:${px === ax && py === ay ? '#314F79' : '#CBD5E1'}`;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      pad.querySelectorAll('button').forEach(o => { o.style.background = '#CBD5E1'; });
      b.style.background = '#314F79';
      aoMudar(px, py);
    });
    pad.appendChild(b);
  }));
  return pad;
}

// ───────────────────────────── Painel visual ─────────────────────────────

/**
 * Painel completo de diagramação da figura.
 * @param {HTMLElement} el
 * @param {{bloco:object, aoAlterar:(chave:string)=>void}} ctx  `aoAlterar('layout')` quando muda o nº de slots
 */
export function montarPainelFiguraVisual(el, ctx) {
  garantirCss();
  const b = ctx.bloco;
  const cfg = obterConfigFigura(b);
  // Regra: opções que só fazem sentido com mais de uma imagem não aparecem para imagem única
  const varias = qtdSlotsDoLayout(cfg.layout) > 1;
  const comRotulo = varias && cfg.subrotulo_tipo !== 'nenhum';

  const abertos = [...el.querySelectorAll('details')].map(d => d.open);
  el.classList.add('ath-fig-painel');
  el.innerHTML = '';

  /** Seção recolhível; `partes` são nós ou [subtítulo, nó]. */
  const secao = (titulo, ...partes) => {
    const d = document.createElement('details');
    d.open = abertos[el.querySelectorAll('details').length] === true; // recolhidas por padrão; mantém só as que o usuário abriu
    const sm = document.createElement('summary');
    sm.textContent = titulo;
    d.appendChild(sm);
    partes.forEach(pt => {
      if (Array.isArray(pt)) {
        const sub = document.createElement('div');
        sub.className = 'sub';
        sub.textContent = pt[0];
        d.appendChild(sub);
        d.appendChild(pt[1]);
      } else d.appendChild(pt);
    });
    el.appendChild(d);
    return d;
  };
  const remontar = () => montarPainelFiguraVisual(el, ctx);
  const set = (chave, v, aviso = chave) => { b[chave] = v; ctx.aoAlterar(aviso); };
  const campo = (rotulo, no, unidade = '') => {
    const l = document.createElement('label');
    l.className = 'campo';
    const t = document.createElement('span');
    t.textContent = rotulo;
    const dir = document.createElement('span');
    dir.style.cssText = 'display:inline-flex;align-items:center';
    dir.appendChild(no);
    if (unidade) { const u = document.createElement('span'); u.className = 'un'; u.textContent = unidade; dir.appendChild(u); }
    l.append(t, dir);
    return l;
  };

  // 0. Classificação semântica: define prefixo da legenda, contador e lista automática
  const papelAtual = papelSemanticoDoBloco(b);
  secao('Classificação (prefixo e numeração)', criarGrupoIcones({
    opcoes: [...PAPEIS_SEMANTICOS.map(p => ({ valor: p.id, rotulo: `${p.rotulo} — "${p.prefixo} 1"`, icone: svg(`<text x="12" y="12.5" text-anchor="middle" font-size="7" font-weight="800" fill="currentColor" stroke="none">${p.prefixo.slice(0, 3)}</text>`) })),
      { valor: 'other', rotulo: 'Outro (rótulo personalizado)', icone: svg('<text x="12" y="12.5" text-anchor="middle" font-size="7" font-weight="800" fill="currentColor" stroke="none">…</text>') }],
    valor: papelAtual, rotulo: 'Classificação', modo: 'lista',
    aoMudar: (v) => { definirPapelSemantico(b, v); ctx.aoAlterar('semantica'); remontar(); }
  }));

  // 1. Disposição (layouts com ícone dedicado)
  secao('Disposição das imagens', criarGrupoIcones({
    opcoes: LAYOUTS_FIGURA.map(l => ({ valor: l.id, rotulo: l.rotulo, icone: iconeLayout(l.id) })),
    valor: cfg.layout, rotulo: 'Disposição', modo: 'lista',
    aoMudar: (v) => { b.layout = v; ajustarItensAoLayout(b); ctx.aoAlterar('layout'); remontar(); }
  }));

  // 2. Espaçamento (só entre várias imagens)
  if (varias) secao('Espaçamento entre imagens', grupo('gap', cfg.gap_modo, v => set('gap_modo', v), Object.keys(GAPS_FIGURA)));

  // 3. Rótulos das subfiguras (só com várias imagens): letra ou número, formato e posição
  if (varias) {
    const partes = [['Numerar com', grupo('subrotulo_tipo', cfg.subrotulo_tipo, v => { set('subrotulo_tipo', v); remontar(); }, SUBROTULO_TIPOS)]];
    if (comRotulo) {
      partes.push(['Formato', grupo('subrotulo_formato', cfg.subrotulo_formato, v => set('subrotulo_formato', v), SUBROTULO_FORMATOS)]);
      partes.push(['Posição', grupo('subrotulo_posicao', cfg.subrotulo_posicao, v => set('subrotulo_posicao', v), ['interna', 'externa'])]);
    }
    secao('Rótulos das subfiguras', ...partes);
  }

  // 4. Moldura, traço e cantos
  const largura = document.createElement('input');
  largura.type = 'number'; largura.min = '0.25'; largura.max = '6'; largura.step = '0.25'; largura.value = cfg.img_borda_largura_pt;
  largura.addEventListener('input', () => set('img_borda_largura_pt', Number(largura.value) || 0.75));
  const cor = document.createElement('input');
  cor.type = 'color'; cor.value = cfg.img_borda_cor;
  cor.addEventListener('input', () => set('img_borda_cor', cor.value));
  secao('Moldura da imagem',
    ['Tipo', grupo('img_moldura', cfg.img_moldura, v => set('img_moldura', v), ['nenhuma', 'fina', 'dupla', 'passe_partout'])],
    campo('Espessura', largura, 'pt'),
    campo('Cor da linha', cor),
    ['Traço', grupo('estilo_traco', cfg.img_borda_estilo, v => set('img_borda_estilo', v), ['solida', 'tracejada'])],
    ['Cantos', grupo('img_raio', cfg.img_raio, v => set('img_raio', v), Object.keys(RAIOS_IMG))]);

  // 4b. Figuras por código: fundo do contêiner e paleta herdada por Mermaid/gráficos
  secao('Figuras por código',
    ['Fundo', criarGrupoIcones({
      opcoes: FUNDOS_CODIGO.map(k => ({ valor: k, rotulo: ROT.codigo_fundo[k], icone: svg(`<rect x="3" y="2" width="18" height="14" rx="1.5" ${k === 'transparente' ? 'stroke-dasharray="2 2"' : `fill="${k === 'branco' ? '#fff' : '#E2E8F0'}"`}/>`) })),
      valor: cfg.codigo_fundo, modo: 'lista', aoMudar: v => set('codigo_fundo', v)
    })],
    ['Paleta (Mermaid e gráficos)', criarGrupoIcones({
      opcoes: PALETAS_FIGURA.map(k => ({ valor: k, rotulo: ROT.codigo_paleta[k], icone: svg(`<rect x="3" y="4" width="5" height="10" fill="${{ tema: '#314F79', vivida: '#2563EB', cinza: '#1F2937' }[k]}" stroke="none"/><rect x="9.5" y="7" width="5" height="7" fill="${{ tema: '#D97706', vivida: '#F59E0B', cinza: '#6B7280' }[k]}" stroke="none"/><rect x="16" y="9" width="5" height="5" fill="${{ tema: '#0F766E', vivida: '#10B981', cinza: '#D1D5DB' }[k]}" stroke="none"/>`) })),
      valor: cfg.codigo_paleta, modo: 'lista', aoMudar: v => set('codigo_paleta', v)
    })]);

  // 5. Sombra
  secao('Sombra projetada', grupo('img_sombra', cfg.img_sombra, v => set('img_sombra', v), ['nenhuma', 'suave', 'media', 'elevada']));

  // 6. Enquadramento, foco (matriz 3×3), proporção e altura
  const foco = criarPadFoco({ x: cfg.foco_x, y: cfg.foco_y, aoMudar: (x, y) => { b.foco_x = x; b.foco_y = y; ctx.aoAlterar('foco'); } });
  const focoLinha = document.createElement('div');
  focoLinha.className = 'foco-linha';
  const focoRot = document.createElement('span');
  focoRot.textContent = 'Ponto focal do recorte';
  focoLinha.append(focoRot, foco);
  const alturas = ['auto', '160px', '220px', '280px', '360px', '450px'];
  secao('Enquadramento da imagem',
    ['Ajuste', grupo('ajuste', cfg.ajuste_enquadramento, v => set('ajuste_enquadramento', v), AJUSTES_IMG)],
    focoLinha,
    ['Proporção', grupo('proporcao', cfg.proporcao_imagem, v => set('proporcao_imagem', v), ['livre', '16/9', '4/3', '1/1', '3/4', '9/16'])],
    ['Altura', criarGrupoIcones({
      opcoes: alturas.map(v => ({ valor: v, rotulo: v === 'auto' ? 'Automática' : `${v.replace('px', '')} px`, icone: svg(`<path d="M12 2v14M9 5l3-3 3 3M9 13l3 3 3-3"/>`) })),
      valor: cfg.altura_modo, aoMudar: v => set('altura_modo', v), modo: 'lista'
    })]);

  // 7. Bloco no documento
  const pctWrap = document.createElement('div');
  const montarPct = () => {
    pctWrap.innerHTML = '';
    if (obterConfigFigura(b).largura_modo !== 'pct') return;
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Porcentagem da coluna';
    pctWrap.append(sub, criarGrupoIcones({
      opcoes: [50, 75, 100].map(p => ({ valor: String(p), rotulo: `${p}% da coluna`, icone: svg(`<rect x="3" y="5" width="${p === 100 ? 18 : p === 75 ? 14 : 9}" height="8" rx="1" fill="currentColor" fill-opacity=".3"/>`) })),
      valor: String(Math.round(obterConfigFigura(b).largura_pct)), aoMudar: v => set('largura_pct', Number(v)), modo: 'lista'
    }));
  };
  secao('Largura e alinhamento no documento',
    ['Largura', grupo('largura_modo', cfg.largura_modo, v => { b.largura_modo = v; if (v === 'pct') b.largura_pct = 75; montarPct(); ctx.aoAlterar('largura_modo'); }, ['corpo', 'estendida', 'pagina', 'pct'])],
    pctWrap,
    ['Alinhamento', grupo('alinhamento_bloco', cfg.alinhamento_bloco, v => set('alinhamento_bloco', v), ['esquerda', 'centro', 'direita'])],
    ['Texto ao redor', grupo('fluxo', cfg.fluxo, v => set('fluxo', v), ['em_linha', 'contornar_esq', 'contornar_dir'])]);
  montarPct();

  const nota = document.createElement('div');
  nota.style.cssText = 'font-size:10.5px;color:#64748B;line-height:1.35';
  nota.textContent = 'O contorno de texto é aplicado na exportação PDF; no editor use blocos lado a lado (colunas da folha).';
  el.appendChild(nota);
}

// ───────────────────────────── Tipografia (estilos de texto) ─────────────────────────────

/**
 * Lista de estilos de texto do documento, cada um pré-visualizado na própria fonte/peso/itálico.
 * `valor` vazio = padrão do bloco.
 */
export function criarListaEstilosTexto({ estilos = [], valor = '', aoMudar, rotuloPadrao = 'Padrão do bloco' }) {
  garantirCss();
  const lista = [{ id: '', nome: rotuloPadrao }, ...estilos];
  const g = document.createElement('div');
  g.className = 'ath-ic-lista';
  g.style.cssText = 'max-height:176px;overflow:auto;padding-right:2px';
  g.setAttribute('role', 'radiogroup');
  const marcar = (v) => g.querySelectorAll('.ath-ic-item').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valor === String(v))));
  lista.forEach(est => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ath-ic-item';
    b.dataset.valor = est.id;
    b.title = est.id ? `${est.nome} — ${est.tamanho_pt || ''}pt` : rotuloPadrao;
    const fam = est.id ? (FONTES_SISTEMA[est.fonte]?.familia || 'inherit') : 'inherit';
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.textContent = 'Aa';
    ic.style.cssText = `font-family:${fam.replace(/"/g, "'")};font-weight:${est.peso || 600};font-style:${est.italico ? 'italic' : 'normal'};font-size:13px;color:${est.cor || 'inherit'}`;
    const tx = document.createElement('span');
    tx.className = 'tx';
    tx.textContent = est.nome;
    b.append(ic, tx);
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', e => { e.stopPropagation(); marcar(est.id); aoMudar(est.id); });
    g.appendChild(b);
  });
  marcar(valor || '');
  return g;
}

/**
 * Painel de tipografia por papel (título, legenda, fonte, rótulo e legenda das subimagens…).
 * Cada papel grava `${chave}_estilo_id` e (se `alinhamento`) `${chave}_alinhamento` no bloco.
 * @param {HTMLElement} el
 * @param {{bloco:object, estilos:object[], papeis:{chave:string, rotulo:string, alinhamento?:boolean, padrao?:string}[],
 *   aoAlterar:(chave:string)=>void}} ctx
 */
export function montarPainelTipografiaBloco(el, ctx) {
  garantirCss();
  const abertos = [...el.querySelectorAll('details')].map(d => d.open);
  el.classList.add('ath-fig-painel');
  el.innerHTML = '';
  ctx.papeis.forEach((papel, i) => {
    const d = document.createElement('details');
    d.open = abertos[i] === true; // recolhidas por padrão; mantém só as que o usuário abriu
    const sm = document.createElement('summary');
    sm.textContent = papel.rotulo;
    d.appendChild(sm);
    const sub1 = document.createElement('div');
    sub1.className = 'sub';
    sub1.textContent = 'Estilo de texto';
    d.append(sub1, criarListaEstilosTexto({
      estilos: ctx.estilos, valor: ctx.bloco[`${papel.chave}_estilo_id`] || '', rotuloPadrao: papel.padrao || 'Padrão do bloco',
      aoMudar: (id) => { ctx.bloco[`${papel.chave}_estilo_id`] = id; ctx.aoAlterar(papel.chave); }
    }));
    if (papel.alinhamento !== false) {
      const sub2 = document.createElement('div');
      sub2.className = 'sub';
      sub2.textContent = 'Alinhamento';
      d.append(sub2, criarGrupoAlinhamentoTexto({
        valor: ctx.bloco[`${papel.chave}_alinhamento`] || 'estilo',
        aoMudar: (v) => { ctx.bloco[`${papel.chave}_alinhamento`] = v; ctx.aoAlterar(papel.chave); }
      }));
    }
    el.appendChild(d);
  });
}

/** Papéis de tipografia de uma figura; os das subimagens só existem com mais de uma imagem (e rótulo ativo). */
export function papeisTipografiaFigura(b) {
  const cfg = obterConfigFigura(b);
  const varias = qtdSlotsDoLayout(cfg.layout) > 1;
  const papeis = [
    { chave: 'titulo', rotulo: 'Título da figura', padrao: 'Padrão do bloco' },
    { chave: 'numeracao', rotulo: 'Numeração ("Figura 1 —")', alinhamento: false, padrao: 'Padrão do bloco' },
    { chave: 'legenda', rotulo: 'Legenda geral', padrao: 'Padrão do bloco' },
    { chave: 'fonte', rotulo: 'Fonte / atribuição', padrao: 'Padrão do bloco' }
  ];
  if (varias) {
    papeis.push({ chave: 'sublegenda', rotulo: 'Legenda de cada subimagem', padrao: 'Padrão do bloco' });
    if (cfg.subrotulo_tipo !== 'nenhum') {
      papeis.push({ chave: 'subrotulo_texto', rotulo: 'Rótulo das subimagens (a, b, c / 1, 2, 3)', alinhamento: false, padrao: 'Padrão do bloco' });
    }
  }
  return papeis;
}

// ───────────────────────────── Seletor de layout (barra rápida) ─────────────────────────────

let popLayout = null;
export function fecharSeletorLayoutFigura() {
  popLayout?.remove();
  popLayout = null;
  document.removeEventListener('mousedown', fecharForaLayout, true);
}
function fecharForaLayout(e) {
  if (popLayout && !popLayout.contains(e.target) && !e.target.closest?.('[data-ath-layout-toggle]')) fecharSeletorLayoutFigura();
}

/** Botão da barra rápida: mostra o ícone do layout atual e abre a grade de layouts. */
export function criarBotaoLayoutFigura(b, aoMudar) {
  garantirCss();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ath-btn-rapido';
  btn.dataset.athLayoutToggle = '1';
  const l = obterLayoutFigura(b.layout);
  btn.title = `Disposição: ${l.rotulo}`;
  btn.innerHTML = `${iconeLayout(l.id)}<span style="font-weight:700">${l.slots.length > 1 ? l.slots.length + ' img' : '1 img'}</span>`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popLayout) { fecharSeletorLayoutFigura(); return; }
    popLayout = document.createElement('div');
    popLayout.className = 'ath-pop-layout';
    popLayout.appendChild(criarGrupoIcones({
      opcoes: LAYOUTS_FIGURA.map(x => ({ valor: x.id, rotulo: x.rotulo, icone: iconeLayout(x.id) })),
      valor: obterConfigFigura(b).layout, modo: 'lista',
      aoMudar: (v) => { b.layout = v; ajustarItensAoLayout(b); fecharSeletorLayoutFigura(); aoMudar(v); }
    }));
    document.body.appendChild(popLayout);
    const r = btn.getBoundingClientRect();
    popLayout.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 262))}px`;
    popLayout.style.top = `${Math.min(r.bottom + 6, window.innerHeight - popLayout.offsetHeight - 8)}px`;
    document.addEventListener('mousedown', fecharForaLayout, true);
  });
  return btn;
}
