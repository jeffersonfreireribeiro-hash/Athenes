// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gerador de Documento PDF de Alta Fidelidade (HTML Paged Media).
 * Utiliza o padrão W3C CSS Paged Media (@page), caixas de margem, numeração
 * automática e grid modular milimétrico herdado do Clux.js.
 */

import { elementosMestraHtml, renderizadoPeloCanvas, contextoVariaveisPagina } from './athenes_mestra_render.js';
import { calcularNumeracaoSecoes, extrairItensSumario, sumarioHtml, configEfetivaSumario, removerNumeroManual, tagDoNivel, estiloIdDoTitulo, nivelDe } from './athenes_sumario.js';
import { cssFontesImportadas } from './athenes_fontes.js';
import { margensEfetivasMm } from './athenes_mestra_canvas.js';
import { dimensoesPapelMm } from './athenes_grid.js';
import { estiloParaCss, estiloParaCssComAlinhamento, estiloParaCssTipografia, estiloParaCssNumeracao, FONTES_SISTEMA } from './athenes_estilos.js';
import { formatarReferenciaCompleta } from './athenes_bibliografia.js';
import { ancoraDaReferencia, referenciaDoBlocoCitacao } from './athenes_citacao.js';
import { mapaMarcadores, chaveMarcador, configListaDoBloco, segmentosDeLista } from './athenes_marcadores.js';
import { latexParaHtml } from './athenes_formula.js';
import { hifenizarHtml } from './athenes_hifenizacao.js';
import { cssAvancadoDosEstilos, classesAvancadasDoBloco, aplicarPalavrasIniciais } from './athenes_estilo_avancado.js';
import { documentoComSugestoesResolvidas } from './athenes_diff.js';
import { ajusteDeFragmento, aplicarEstilosDeTrecho } from './athenes_estilo_exclusivo.js';
import { geometriaCorpoMm, resolverAreasPagina } from './athenes_paginacao.js';
import { obterConfigNotas, aplicarRotulosNotasHtml, sanitizarHtmlNota, cssMarcadoresNota } from './athenes_notas_rodape.js';
import { descreverFigura, cssObjParaString, PLACEHOLDER_IMG } from './athenes_figura_layout.js';
import { marcacaoItemCodigo } from './athenes_figura_codigo.js';
import { obterEstiloTabela, dimensoesTabela, resolverCelula, celulaParaCss, tabelaParaCss } from './athenes_tabela_estilo.js';
import { rotuloDaFigura, gerarSumarioDinamico, modeloDaPagina, formatarNumeroPagina, gerarCssMolduraBloco, repaginarDocumento, colapsoEntreBlocosPt, margensTextoPt, obterTituloCompletoComNumeracao, obterPrefixoNumeracao, recalcularNumeracaoAutomatica } from './athenes_documento.js';

export function escaparHtml(texto) {
  if (texto === undefined || texto === null) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renderiza um único bloco em HTML para a folha
 */
/** CSS (objeto camelCase) → atributo style. */
const cssDe = (o) => Object.entries(o).map(([k, v]) => `${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}:${v}`).join(';');

/** Cabeçalho ou rodapé em 3 zonas, posicionado na margem (distância da borda configurável). */
function areaPaginaHtml(area, m) {
  if (!area) return '';
  const lado = area.tipo === 'cabecalho'
    ? `top:${area.distancia_borda_mm}mm;${area.linha ? `border-bottom:${area.linha.espessura_pt}pt solid ${area.linha.cor};padding-bottom:1.5mm;` : ''}`
    : `bottom:${area.distancia_borda_mm}mm;${area.linha ? `border-top:${area.linha.espessura_pt}pt solid ${area.linha.cor};padding-top:1.5mm;` : ''}`;
  // com uma única zona preenchida, as vazias não ocupam espaço (o texto usa a largura inteira da área)
  const sozinha = [area.zonas.esquerda, area.zonas.centro, area.zonas.direita].filter(Boolean).length === 1;
  // multilinha (ex.: número acima do texto): o texto da esquerda usa a largura que sobra; centro e direita só o que ocupam
  const multi = area.multilinha && !!area.zonas.esquerda; // só centro/direita preenchidos: vale a divisão normal (o centro fica centralizado)
  const flexDe = (cls, txt) => (multi ? (cls === 'left' ? '1 1 0' : (txt ? '0 0 auto' : '0 0 0')) : (sozinha && !txt ? '0 0 0' : '1 1 0'));
  const z = (cls, txt) => `<div style="flex:${flexDe(cls, txt)};min-width:0;text-align:${cls};overflow-wrap:anywhere;white-space:pre-wrap;">${escaparHtml(txt)}</div>`;
  return `<${area.tipo === 'cabecalho' ? 'header' : 'footer'} class="ath-pg-area ath-folha-${area.tipo}" style="position:absolute;left:${m.l}mm;right:${m.r}mm;${lado}display:flex;align-items:flex-start;gap:${sozinha ? 0 : 3}mm;${cssDe(area.css)}">${z('left', area.zonas.esquerda)}${z('center', area.zonas.centro)}${z('right', area.zonas.direita)}</${area.tipo === 'cabecalho' ? 'header' : 'footer'}>`;
}

/** Notas de rodapé da página: traço separador configurável + notas na tipografia própria. */
function notasPaginaHtml(pag, documento) {
  if (!pag.notas?.length) return '';
  const cfg = obterConfigNotas(documento);
  const fam = (FONTES_SISTEMA[cfg.fonte]?.familia || FONTES_SISTEMA.nunito.familia).replace(/"/g, "'");
  const itens = pag.notas.map(seg => {
    const num = seg.continuaDaAnterior ? '' : escaparHtml(pag.rotulosNotas?.[seg.id] ?? '');
    return `<div class="ath-nota" style="display:flex;gap:1.2mm;align-items:baseline;margin:0 0 2pt 0;"><span class="ath-nota-num" style="flex:none;min-width:1.1em;">${num}</span><div style="flex:1;min-width:0;overflow-wrap:anywhere;">${sanitizarHtmlNota(seg.html)}</div></div>`;
  }).join('');
  return `<div class="ath-notas-rodape" style="margin-top:auto;font-family:${fam};font-size:${cfg.tamanho_pt}pt;line-height:${cfg.entrelinha};color:${cfg.cor};"><div style="height:${cfg.separador.espessura_pt}pt;width:${cfg.separador.comprimento_pct}%;background:${cfg.separador.cor};margin:0 0 4pt 0;"></div>${itens}</div>`;
}

/**
 * CSS do texto de um `papel` (titulo, legenda, fonte, sublegenda, subrotulo_texto) do bloco.
 * Com estilo de texto escolhido no bloco (`${papel}_estilo_id`) aplica o estilo COMPLETO; sem escolha,
 * mantém o visual padrão (`estPadrao` + `extraPadrao`). O alinhamento explícito do bloco sempre vence.
 */
function cssTextoPapel(bloco, papel, estilosMap, estPadrao, extraPadrao = '') {
  const est = estilosMap[bloco[`${papel}_estilo_id`]];
  const alin = bloco[`${papel}_alinhamento`];
  if (est) return estiloParaCssComAlinhamento(est, alin);
  return `${estPadrao ? estiloParaCss(estPadrao) : ''} ${extraPadrao} ${estiloParaCssComAlinhamento(null, alin)}`.trim();
}

/** Tabela dividida entre páginas: a continuação traz só "Tabela 1 (continuação)"; o "Continua" fecha os fragmentos não finais. */
function legendaContinuacaoHtml(bloco, css) {
  return `<div class="ath-legenda" style="${css}">${escaparHtml(obterPrefixoNumeracao(bloco).trimEnd().replace(/[-—–:.]+$/, '').trimEnd())} (continuação)</div>`;
}
const rodapeContinuaHtml = (bloco) => (bloco._frag?.continuaNaProxima ? '<div class="ath-continua" style="text-align:right;font-size:8.5pt;font-style:italic;color:#64748B;margin-top:3px;">Continua</div>' : '');
const fonteVisivel = (bloco) => !!bloco.fonte && !bloco._frag?.continuaNaProxima;

/** Título numerado ("Tabela 1 — …") com o prefixo no estilo de numeração escolhido (se houver). */
function tituloComNumeracaoHtml(bloco, estilosMap) {
  const completo = obterTituloCompletoComNumeracao(bloco) || '';
  const est = estilosMap[bloco.numeracao_estilo_id];
  const pref = obterPrefixoNumeracao(bloco); // "Tabela 1 — " com o separador escolhido
  if (!est || !completo.startsWith(pref.trimEnd())) return completo;
  const resto = completo.slice(pref.trimEnd().length);
  const espacos = pref.length - pref.trimEnd().length;
  const sep = resto.slice(0, resto.length - resto.trimStart().length) || '';
  return `<span style="${estiloParaCssNumeracao(est)}">${pref.trimEnd()}${sep}</span>${resto.slice(sep.length)}`;
}

/** Tabela/quadro com estilo declarativo (bordas, zebra, fundos, alinhamento) resolvido por célula. */
function gerarTabelaHtmlEstilizada(bloco, classe, estilosMap = {}) {
  const estilo = obterEstiloTabela(bloco);
  const dim = dimensoesTabela(bloco);
  const temCab = bloco.com_cabecalho !== false;
  const larg = bloco.larguras_relativas;
  const colgroup = Array.isArray(larg) && larg.length === (bloco.colunas || []).length
    ? '<colgroup>' + larg.map(w => '<col style="width:' + (Number(w) * 100 / (larg.reduce((x, y) => x + Number(y), 0) || 1)).toFixed(2) + '%">').join('') + '</colgroup>'
    : '';
  const css = (r, c) => celulaParaCss(resolverCelula(estilo, dim, r, c), estilo);
  const cab = temCab
    ? '<thead><tr>' + (bloco.colunas || []).map((col, c) => '<th style="' + css(0, c) + '">' + escaparHtml(col) + '</th>').join('') + '</tr></thead>'
    : '';
  const corpo = (bloco.linhas || []).map((linha, ri) =>
    '<tr>' + (Array.isArray(linha) ? linha : []).map((cel, c) => '<td style="' + css(ri + (temCab ? 1 : 0), c) + '">' + escaparHtml(cel || '') + '</td>').join('') + '</tr>'
  ).join('');
  const dados = estiloParaCssTipografia(estilosMap[bloco.dados_estilo_id]); // tipografia dos dados escolhida no bloco
  return '<table class="' + classe + '" style="' + tabelaParaCss('9.5pt') + ';' + dados + '">' + colgroup + cab + '<tbody>' + corpo + '</tbody></table>';
}

/** Marcador/numeração do bloco para o PDF: estilo do bloco em recuo suspenso + o rótulo posicionado à esquerda (só no 1º fragmento). */
function marcadorDoBlocoPdf(bloco, opcoes) {
  const m = opcoes.marcadores?.get(chaveMarcador(bloco));
  if (!m || bloco._frag?.continuaDaAnterior) return { estilo: m ? `padding-left:${(m.cfg.nivel - 1) * 6 + m.cfg.tabMm}mm;position:relative;` : '', html: '' };
  const ind = (m.cfg.nivel - 1) * 6;
  return {
    estilo: `padding-left:${ind + m.cfg.tabMm}mm;position:relative;`,
    html: `<span class="ath-marc" style="position:absolute;left:${ind}mm;width:${m.cfg.tabMm - 1.5}mm;text-align:${m.cfg.alinhamento};white-space:nowrap;text-indent:0;">${escaparHtml(m.rotulo)}</span>`
  };
}

export function renderizarBlocoHtml(bloco, estilosMap, documento, opcoes = {}) {
  const estBase = estilosMap[bloco.tipo === 'titulo' ? estiloIdDoTitulo(estilosMap, bloco) : (bloco.estiloId || (bloco.tipo === 'citacao' ? 'citacao_direta' : undefined))] || estilosMap.corpo || {};
  const est = { ...estBase, ...ajusteDeFragmento(bloco) }; // visual 100% do estilo; só o ajuste de fragmento (paginação) se soma
  const estiloCss = estiloParaCss(est);
  const deveHifenizar = Boolean(est.hifenizacao); // só o estilo decide
  const textoComTrechos = aplicarEstilosDeTrecho(bloco.texto || '', Object.values(estilosMap), (e) => (FONTES_SISTEMA[e.fonte] || FONTES_SISTEMA.nunito).familia); // trechos de estilo cadastrado: o CSS vem do estilo atual
  const textoFormatado = aplicarRotulosNotasHtml(deveHifenizar ? hifenizarHtml(textoComTrechos) : textoComTrechos, opcoes.rotulosNotas);

  switch (bloco.tipo) {
    case 'titulo': {
      const nivel = nivelDe(bloco);
      const tag = tagDoNivel(nivel);
      const num = opcoes.prefixosSecoes?.get(bloco.id);
      const corpoTitulo = num ? removerNumeroManual(textoFormatado) || textoFormatado : textoFormatado;
      const prefixo = num ? `<span class="ath-num-secao">${num.prefixo}</span> ` : '';
      const mk = marcadorDoBlocoPdf(bloco, opcoes);
      return `<${tag} id="ath-b-${bloco.id}" class="ath-bloco ath-titulo ath-nivel-${nivel}" ${nivel > 6 ? `role="heading" aria-level="${nivel}" ` : ''}style="${estiloCss}${mk.estilo}" data-id="${bloco.id}">${mk.html}${prefixo}${corpoTitulo}</${tag}>`;
    }

    case 'subtitulo':
      return `<div class="ath-bloco ath-subtitulo" style="${estiloCss}" data-id="${bloco.id}">${textoFormatado}</div>`;

    case 'paragrafo': {
      const av = classesAvancadasDoBloco(est, bloco._frag);
      const texto = av && !bloco._frag?.continuaDaAnterior ? aplicarPalavrasIniciais(textoFormatado, est) : textoFormatado;
      if (/<(ul|ol)[\s>]/i.test(texto)) {
        // linhas marcadas (uma lista por linha com Enter): cada item sai com o seu marcador; o texto fora das listas segue normal
        const cfg = configListaDoBloco(bloco, est);
        const ind = (cfg.nivel - 1) * 6;
        const inicio = opcoes.marcadores?.get(chaveMarcador(bloco))?.numero || 1;
        const partes = segmentosDeLista(texto, cfg, inicio).map(sg => sg.tipo === 'texto'
          ? `<div>${sg.html}</div>`
          : `<div style="position:relative;padding-left:${ind + cfg.tabMm}mm;text-indent:0;"><span class="ath-marc" style="position:absolute;left:${ind}mm;width:${cfg.tabMm - 1.5}mm;text-align:${cfg.alinhamento};white-space:nowrap;">${escaparHtml(sg.rotulo)}</span>${sg.html}</div>`).join('');
        return `<div class="ath-bloco ath-paragrafo${av ? ' ' + av : ''}" style="${estiloCss}" data-id="${bloco.id}">${partes}</div>`;
      }
      const mk = marcadorDoBlocoPdf(bloco, opcoes);
      return `<p class="ath-bloco ath-paragrafo${av ? ' ' + av : ''}" style="${estiloCss}${mk.estilo}" data-id="${bloco.id}">${mk.html}${texto}</p>`;
    }

    case 'citacao': {
      const cssCitacao = estiloParaCss(est); // estilo da citação já com os ajustes do bloco (e do fragmento: o 2º pedaço não repete o espaço antes), igual ao editor
      const ref = referenciaDoBlocoCitacao(bloco).html;
      return `<blockquote class="ath-bloco ath-citacao" style="${cssCitacao}" data-id="${bloco.id}">
        ${textoComTrechos}
        <span class="ath-citacao-ref">${ref}</span>
      </blockquote>`;
    }

    case 'lista': {
      const isNum = bloco.tipo_lista === 'numerada';
      const isTarefas = bloco.tipo_lista === 'tarefas';
      const tag = isNum ? 'ol' : 'ul';
      const itensHtml = (bloco.itens || []).map((it, idx) => {
        if (isTarefas) {
          return `<li class="ath-item-tarefa" style="${estiloCss}"><input type="checkbox" ${it.checked ? 'checked' : ''} disabled> <span>${it.texto || ''}</span></li>`;
        }
        return `<li style="${estiloCss}">${it.texto || it}</li>`;
      }).join('\n');
      return `<${tag} class="ath-bloco ath-lista ${bloco.tipo_lista || 'marcadores'}" data-id="${bloco.id}">${itensHtml}</${tag}>`;
    }

    case 'nota': {
      const tiposCores = {
        destaque: { bg: '#EEF4FA', border: '#314F79', text: '#1F2733' },
        aviso: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
        observacao: { bg: '#F1F5F9', border: '#64748B', text: '#334155' }
      };
      const c = tiposCores[bloco.tipo_nota] || tiposCores.destaque;
      return `<aside class="ath-bloco ath-nota" style="background:${c.bg}; border-left:4px solid ${c.border}; color:${c.text}; padding:10px 14px; border-radius:0 8px 8px 0; margin:10px 0; break-inside:avoid;" data-id="${bloco.id}">
        ${bloco.titulo ? `<strong style="display:block; margin-bottom:4px; font-size:10pt;">${escaparHtml(bloco.titulo)}</strong>` : ''}
        <div style="${estiloCss} margin:0;">${bloco.texto || ''}</div>
      </aside>`;
    }

    case 'quadro': {
      const estLegenda = estilosMap.legenda || estilosMap.corpo;
      const estFonte = estilosMap.fonte_citada || estilosMap.corpo;
      return '<div class="ath-bloco ath-quadro-wrap" style="margin:12px 0; break-inside:avoid;" data-id="' + bloco.id + '">' +
        (bloco._frag?.continuaDaAnterior ? legendaContinuacaoHtml(bloco, cssTextoPapel(bloco, 'titulo', estilosMap, estLegenda, 'font-weight:800; text-align:left; margin-bottom:4px;'))
          : (bloco.titulo ? '<div class="ath-legenda" style="' + cssTextoPapel(bloco, 'titulo', estilosMap, estLegenda, 'font-weight:800; text-align:left; margin-bottom:4px;') + '">' + tituloComNumeracaoHtml(bloco, estilosMap) + '</div>' : '')) +
        gerarTabelaHtmlEstilizada(bloco, 'ath-quadro', estilosMap) + rodapeContinuaHtml(bloco) +
        (fonteVisivel(bloco) ? '<div class="ath-fonte" style="' + cssTextoPapel(bloco, 'fonte', estilosMap, estFonte, 'text-align:left; margin-top:4px;') + '">' + bloco.fonte + '</div>' : '') +
      '</div>';
    }

    case 'figura': {
      const estLegenda = estilosMap.legenda || estilosMap.corpo;
      const estFonte = estilosMap.fonte_citada || estilosMap.corpo;
      // mesma descrição de estilo usada no canvas do editor (moldura, sombra, grade, rótulos, largura, fluxo)
      const d = descreverFigura(bloco, { margens_mm: opcoes.margens_mm || { l: 25, r: 20 }, permitirFlutuar: true });
      const rot = rotuloDaFigura(bloco);

      // conteúdo do slot: imagem (url) ou figura por código (SVG/Mermaid/gráfico JSON → SVG vetorial; HTML+CSS escopado)
      const conteudoItem = (it) => {
        if (it.sourceType && it.sourceType !== 'image_url') {
          const m = marcacaoItemCodigo(bloco, (bloco.itens || [])[it.idx] || {}, it.idx, documento);
          if (m.ok) return m.html;
          return '<div style="padding:10px; color:#B91C1C; font-size:9pt; border:1px dashed #FCA5A5; background:#FEF2F2">Figura por código com erro: ' + escaparHtml((m.erros[0] && m.erros[0].mensagem) || 'conteúdo inválido') + '</div>';
        }
        return '<img src="' + escaparHtml(it.url || PLACEHOLDER_IMG) + '" alt="" style="' + cssObjParaString({ ...it.img, ...(it.img.maxHeight === undefined && !it.img.height ? { maxHeight: '65mm' } : {}) }) + '">';
      };
      const itensHtml = d.itens.map((it) => {
        const cssRotulo = cssTextoPapel(bloco, 'subrotulo_texto', estilosMap, null, 'font-weight:800; font-size:9pt; color:#1F2733;');
        const cssSub = cssTextoPapel(bloco, 'sublegenda', estilosMap, null, 'font-size:9pt; color:#64748B; font-style:italic;');
        const chip = it.subrotulo?.interno
          ? '<span style="position:absolute; top:6px; left:6px; background:rgba(255,255,255,.92); padding:1px 6px; border-radius:5px; line-height:1.2; margin:0; text-indent:0; display:inline-block; ' + cssRotulo + '">' + escaparHtml(it.subrotulo.texto) + '</span>'
          : '';
        let legenda = '';
        if (it.subrotulo && !it.subrotulo.interno) {
          legenda = '<span style="' + cssSub + '"><span style="margin-right:4px; display:inline; text-indent:0; margin-left:0; padding:0; ' + cssRotulo + '">' + escaparHtml(it.subrotulo.texto) + '</span>' + escaparHtml(it.legenda_sub) + '</span>';
        } else if (it.legenda_sub && d.qtd > 1) {
          legenda = '<span style="' + cssSub + '">' + escaparHtml(rot + ' ' + (bloco.numero_sequencial || 1) + String.fromCharCode(97 + it.idx) + (bloco.legenda_sep ?? ' — ') + it.legenda_sub) + '</span>';
        }
        return '<div style="' + cssObjParaString(it.celula) + '">' +
          '<div style="' + cssObjParaString(it.moldura) + '">' +
            conteudoItem(it) +
            chip +
          '</div>' +
          legenda +
        '</div>';
      }).join('\n');

      const titFig = obterTituloCompletoComNumeracao(bloco);

      // mesmo visual do editor: sem estilo escolhido, título 13px/negrito, legenda 12px cinza e fonte 11px itálico; blocos separados por 6px
      const estLegFig = estilosMap.legenda || null; const estFonteFig = estilosMap.fonte_citada || null;
      return '<figure class="ath-bloco ath-figura-composta" style="margin:12px 0; break-inside:avoid; display:flex; flex-direction:column; gap:6px; ' + Object.entries(gerarCssMolduraBloco(bloco)).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v};`).join(' ') + ' ' + cssObjParaString(d.bloco) + '; margin-bottom:12px;" data-id="' + bloco.id + '">' + // o editor limpa a margem inferior da moldura e fica a da classe da figura (12px)
        (titFig ? '<div class="ath-legenda" style="' + cssTextoPapel(bloco, 'titulo', estilosMap, estLegFig, 'font-size:9.75pt; line-height:1.5; font-weight:800; color:#1F2733;') + '">' + tituloComNumeracaoHtml(bloco, estilosMap) + '</div>' : '') +
        '<div style="' + cssObjParaString(d.grade) + '; padding:6px; background:#F8FAFC; border-radius:6px;">' +
          itensHtml +
        '</div>' +
        (bloco.legenda_geral ? '<div style="' + cssTextoPapel(bloco, 'legenda', estilosMap, null, 'font-size:9pt; color:#475569; line-height:1.35;') + '">' + bloco.legenda_geral + '</div>' : '') +
        (bloco.fonte ? '<div class="ath-fonte" style="' + cssTextoPapel(bloco, 'fonte', estilosMap, estFonteFig, 'font-size:8.25pt; line-height:1.5; color:#6B7585; font-style:italic;') + '">' + bloco.fonte + '</div>' : '') +
      '</figure>';
    }

    case 'mapa': {
      const estLegenda = estilosMap.legenda || estilosMap.corpo;
      const estFonte = estilosMap.fonte_citada || estilosMap.corpo;
      const titMapa = obterTituloCompletoComNumeracao(bloco);
      return '<figure class="ath-bloco ath-mapa-wrap" style="margin:12px 0; break-inside:avoid;" data-id="' + bloco.id + '">' +
        (titMapa ? '<div class="ath-legenda" style="' + estiloParaCss(estLegenda) + ' font-weight:800; margin-bottom:6px;">' + titMapa + '</div>' : '') +
        '<div style="position:relative; width:100%; height:80mm; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:6px; display:grid; place-items:center;">' +
          '<span style="font-weight:700; color:#475569;">Área do Mapa Territorial</span>' +
          (bloco.orientacao_norte ? '<div style="position:absolute; top:8px; right:10px; font-weight:900; color:#314F79;">N ↑</div>' : '') +
          '<div style="position:absolute; bottom:6px; left:8px; font-size:8pt; background:rgba(255,255,255,0.9); padding:2px 6px; border-radius:3px;">Escala: ' + (bloco.escala || '1:10.000') + '</div>' +
        '</div>' +
        (bloco.legenda_cartografica ? '<div style="font-size:9pt; color:#475569; margin-top:4px;">' + bloco.legenda_cartografica + '</div>' : '') +
        (bloco.fonte ? '<div class="ath-fonte" style="' + estiloParaCss(estFonte) + ' margin-top:3px;">' + bloco.fonte + '</div>' : '') +
      '</figure>';
    }

    case 'tabela': {
      const estLegenda = estilosMap.legenda || estilosMap.corpo;
      const estFonte = estilosMap.fonte_citada || estilosMap.corpo;
      return `<div class="ath-bloco ath-tabela-wrap" style="margin:12px 0; break-inside:avoid;" data-id="${bloco.id}">
        ${bloco._frag?.continuaDaAnterior ? legendaContinuacaoHtml(bloco, cssTextoPapel(bloco, 'titulo', estilosMap, estLegenda, 'text-align:left; margin-bottom:4px;'))
          : (obterTituloCompletoComNumeracao(bloco) ? `<div class="ath-legenda" style="${cssTextoPapel(bloco, 'titulo', estilosMap, estLegenda, 'text-align:left; margin-bottom:4px;')}">${tituloComNumeracaoHtml(bloco, estilosMap)}</div>` : '')}
        ${gerarTabelaHtmlEstilizada(bloco, 'ath-tabela', estilosMap)}${rodapeContinuaHtml(bloco)}
        ${fonteVisivel(bloco) ? `<div class="ath-fonte" style="${cssTextoPapel(bloco, 'fonte', estilosMap, estFonte, 'text-align:left; margin-top:4px;')}">${bloco.fonte}</div>` : ''}
      </div>`;
    }

    case 'imagem': {
      const estLegenda = estilosMap.legenda || estilosMap.corpo;
      const estFonte = estilosMap.fonte_citada || estilosMap.corpo;
      const imgSrc = bloco.dataUrl || bloco.url;
      const wPct = Math.max(10, Math.min(100, bloco.largura_pct || 80));

      return `<figure class="ath-bloco ath-figura" style="margin:12px 0; text-align:${bloco.alinhamento || 'centro'}; break-inside:avoid;" data-id="${bloco.id}">
        ${bloco.legenda ? `<figcaption class="ath-legenda" style="${estiloParaCss(estLegenda)} margin-bottom:6px;">${bloco.legenda}</figcaption>` : ''}
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escaparHtml(bloco.legenda || 'Imagem')}" style="max-width:${wPct}%; height:auto; border-radius:4px; box-shadow:0 1px 4px rgba(0,0,0,0.08);">`
          : `<div class="ath-img-placeholder" style="width:${wPct}%; height:80mm; margin:0 auto; background:#F8FAFC; border:1.5px dashed #CBD5E1; border-radius:8px; display:grid; place-items:center; color:#64748B;">Imagem não carregada</div>`
        }
        ${bloco.fonte ? `<div class="ath-fonte" style="${estiloParaCss(estFonte)} margin-top:4px;">${bloco.fonte}</div>` : ''}
      </figure>`;
    }

    case 'formula': {
      const moldura = gerarCssMolduraBloco(bloco);
      const molduraCssStr = Object.entries(moldura).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v};`).join(' ');
      const posNum = bloco.posicao_numero || 'direita';
      const numTxt = bloco.numero_equacao || bloco.numero || '';
      const numBadge = (posNum !== 'oculto' && numTxt) ? `<span style="font-size:10pt; color:#64748B; font-weight:700;">${escaparHtml(numTxt)}</span>` : '';
      const formulaTxt = `<span style="font-family:'Cambria Math', 'Times New Roman', serif; font-size:12pt; font-style:italic; flex:1; text-align:center;">${latexParaHtml(bloco.latex || bloco.formula || '')}</span>`;

      let linhaPrincipal = '';
      if (posNum === 'esquerda') linhaPrincipal = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">${numBadge}${formulaTxt}</div>`;
      else if (posNum === 'abaixo') linhaPrincipal = `<div style="display:flex; flex-direction:column; align-items:center; gap:4px; width:100%;">${formulaTxt}${numBadge}</div>`;
      else linhaPrincipal = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">${formulaTxt}${numBadge}</div>`;

      const legendaHtml = (bloco.legenda_formula || bloco.legenda) ? `<div style="margin-top:4px; font-size:9pt; color:#64748B; font-style:italic;">${escaparHtml(bloco.legenda_formula || bloco.legenda)}</div>` : '';
      const fonteHtml = (bloco.fonte_formula || bloco.fonte) ? `<div style="margin-top:2px; font-size:8.5pt; color:#94A3B8;">${escaparHtml(bloco.fonte_formula || bloco.fonte)}</div>` : '';

      return `<div class="ath-bloco ath-formula" style="margin:10px 0; ${molduraCssStr} break-inside:avoid;" data-id="${bloco.id}">
        ${linhaPrincipal}
        ${legendaHtml}
        ${fonteHtml}
      </div>`;
    }

    case 'anexo':
      return `<div class="ath-bloco ath-anexo-card" style="margin:8px 0; padding:10px 14px; border:1px solid #E2E8F0; border-radius:8px; display:flex; align-items:center; gap:12px; background:#FFFFFF; break-inside:avoid;" data-id="${bloco.id}">
        <div style="width:36px; height:36px; border-radius:6px; background:#EFF6FF; color:#2563EB; display:grid; place-items:center; font-weight:700; font-size:10pt;">PDF</div>
        <div style="flex:1;">
          <strong style="display:block; font-size:10.5pt; color:#1F2733;">${escaparHtml(bloco.nome || 'Anexo')}</strong>
          <span style="font-size:9pt; color:#64748B;">${escaparHtml(bloco.descricao || 'Documento complementar')}</span>
        </div>
      </div>`;

    case 'sumario': {
      const cfg = configEfetivaSumario(documento, bloco);
      const itens = extrairItensSumario(documento, { profundidade: cfg.profundidade_max, mapa: opcoes.prefixosSecoes });
      const estTit = estilosMap.titulo1 ? `${estiloParaCss(estilosMap.titulo1)};` : '';
      return `<div class="ath-bloco ath-sumario-bloco" data-id="${bloco.id}" style="${estiloCss}">${sumarioHtml(itens, cfg, { estiloTitulo: estTit })}</div>`;
    }

    case 'referencias': {
      const refs = documento.referencias || [];
      const norma = documento.perfil || 'abnt';
      const refsFormatadas = refs.map((r, i) => {
        const html = formatarReferenciaCompleta(r, norma, i + 1);
        return `<div class="ath-ref-item" id="${ancoraDaReferencia(r)}" style="${estiloParaCss(estilosMap.referencias)}">${html}</div>`;
      }).join('\n');

      return `<div class="ath-bloco ath-referencias" data-id="${bloco.id}">
        ${bloco.titulo ? `<h2 style="${estiloParaCss(estilosMap.titulo1)}">${bloco.titulo}</h2>` : ''}
        <div class="ath-ref-lista">${refsFormatadas || '<p style="color:#64748B; font-style:italic;">Nenhuma referência inserida no documento.</p>'}</div>
      </div>`;
    }

    case 'separador':
      if (bloco.tipo_separador === 'quebra_pagina') {
        return '<div class="ath-quebra-pagina" style="break-after:page; page-break-after:always; height:0;"></div>';
      }
      if (bloco.tipo_separador === 'linha') {
        return '<hr class="ath-separador-linha" style="border:0; border-top:1px solid #E2E8F0; margin:14px 0;">';
      }
      return `<div class="ath-espaco" style="height:${bloco.mm || 6}mm;"></div>`;

    default:
      return '';
  }
}

/**
 * Gera o documento HTML completo com CSS Paged Media para impressão e exportação em PDF
 */
export function gerarDocumentoHtmlPdf(documento, opcoes = {}) {
  // Sugestões pendentes saem como "proposta aceita" (texto inserido mantido, excluído descartado); `sugestoes: 'manter'` preserva as marcas
  if (opcoes.sugestoes !== 'manter') documento = documentoComSugestoesResolvidas(documento, 'aceitar');
  if (!documento.paginas || documento.paginas.length === 0) repaginarDocumento(documento);
  recalcularNumeracaoAutomatica(documento); // legendas com o separador escolhido
  const estilosMap = {};
  for (const est of (documento.estilos || [])) {
    estilosMap[est.id] = est;
  }

  const prefixosSecoes = calcularNumeracaoSecoes(documento);
  const marcadores = mapaMarcadores(documento);
  const paginasHtml = (documento.paginas || []).map((pag, index) => {
    const modelo = modeloDaPagina(documento, pag);
    const dimFolha = dimensoesPapelMm(modelo.formato, modelo.orientacao);
    const m = margensEfetivasMm(modelo, dimFolha.largura_mm, dimFolha.altura_mm);
    const cols = modelo.grade?.colunas || 1;
    // página de uma coluna: o editor usa SEMPRE a grade de 12 colunas (blocos lado a lado por `grupo`, `col` e `span`); o PDF faz o mesmo,
    // senão cada bloco do grupo vira uma linha inteira e a página cresce além da área útil
    const grade12 = cols === 1;
    const gap = modelo.grade?.gap_mm || 0;

    const geo = geometriaCorpoMm(modelo);
    const areas = resolverAreasPagina(documento, modelo, pag, pag.numeroExibido ?? pag.numero ?? (index + 1), documento.paginas?.length || 1);
    const cabHtml = areaPaginaHtml(areas.cabecalho, m);

    // Blocos da página
    const opcoesPag = { ...opcoes, margens_mm: m, rotulosNotas: pag.rotulosNotas, prefixosSecoes, marcadores };
    const blocosPag = pag.blocos || [];
    const partes = [];
    for (let i = 0; i < blocosPag.length; i++) {
      const b = blocosPag[i];
      const span = Math.min(cols, b.span || 1);
      const gridCol = grade12 ? `grid-column: ${Math.min(12, Math.max(1, b.col || 1))} / span ${Math.min(12, Math.max(1, b.span || 12))};` : (cols > 1 ? `grid-column: span ${span};` : '');
      const contorna = (b.tipo === 'figura' || b.tipo === 'imagem') && ['contornar_esq', 'contornar_dir'].includes(b.fluxo);
      const prox = blocosPag[i + 1];
      // texto contornando: a figura flutuante e o parágrafo seguinte dividem a mesma célula (contexto de fluxo)
      if (contorna && prox && ['paragrafo', 'texto', 'citacao'].includes(prox.tipo)) {
        partes.push(`<div class="ath-bloco-grid" style="${gridCol} display:flow-root;">${renderizarBlocoHtml(b, estilosMap, documento, opcoesPag)}${renderizarBlocoHtml(prox, estilosMap, documento, opcoesPag)}</div>`);
        i++;
        continue;
      }
      // margens colapsadas (maior de "depois" e "antes"), como no Word: sem isso o espaço entre parágrafos dobrava
      const mesmaLinha = grade12 && i > 0 && b.grupo && blocosPag[i - 1].grupo === b.grupo; // lado a lado: sem colapso vertical entre eles
      const colapso = cols === 1 && !mesmaLinha ? (i > 0 ? colapsoEntreBlocosPt(blocosPag[i - 1], b, estilosMap) : (margensTextoPt(b, estilosMap)?.antes || 0)) : 0; // topo da página: sem espaço antes
      // figuras, tabelas, fórmulas… também ganham o espaço antes/depois do estilo do bloco, como na folha do editor (texto já leva o seu na própria margem)
      const ehTextoB = ['paragrafo', 'texto', 'titulo', 'subtitulo', 'citacao'].includes(b.tipo);
      const estB = estilosMap[b.estiloId] || estilosMap.corpo || {};
      const margemBloco = ehTextoB ? '' : ` margin-top:${b.espaco_antes_pt ?? estB.espaco_antes_pt ?? 0}pt; margin-bottom:${b.espaco_depois_pt ?? estB.espaco_depois_pt ?? 8}pt;`;
      partes.push(`<div class="ath-bloco-grid" style="${gridCol}${colapso ? ` margin-top:-${colapso}pt;` : ''}${margemBloco}">${renderizarBlocoHtml(b, estilosMap, documento, opcoesPag)}</div>`);
    }
    const blocosHtml = partes.join('\n');

    // Notas de rodapé (base do corpo) e rodapé em 3 zonas na margem
    const notasHtml = notasPaginaHtml(pag, documento);
    const rodHtml = areaPaginaHtml(areas.rodape, m);

    const { largura_mm, altura_mm } = dimensoesPapelMm(modelo.formato, modelo.orientacao);

    // Elementos recorrentes da página mestra (coordenadas mm, sangria total, capas e tarjas)
    let elemRecHtml = '';
    if (Array.isArray(modelo.elementos_recorrentes) && modelo.elementos_recorrentes.length > 0) {
      const htmlCanvas = elementosMestraHtml(modelo, pag, { larguraMm: largura_mm, alturaMm: altura_mm, margens: m }, contextoVariaveisPagina(documento, pag, documento.paginas.length));
      elemRecHtml = htmlCanvas + modelo.elementos_recorrentes.map(elem => {
        if (renderizadoPeloCanvas(elem)) return '';
        if (elem.tipo === 'foto_capa') {
          const sangria = !!elem.sangria;
          const respRecuo = !sangria && !!elem.respeitar_recuo;
          const topMm = sangria ? 0 : (respRecuo ? m.t + (elem.y_mm || 0) : (elem.y_mm || 0));
          const leftMm = sangria ? 0 : (respRecuo ? m.l + (elem.x_mm || 0) : (elem.x_mm || 0));
          const wMm = sangria ? largura_mm : (respRecuo ? (largura_mm - m.l - m.r) : (elem.largura_mm || largura_mm));
          
          const hMm = sangria ? altura_mm : (elem.altura_mm || 140);
          const imgUrl = elem.url || '';
          const zIdx = elem.camada === 'frente' ? 5 : 0;
          if (imgUrl) {
            return `<div style="position:absolute; top:${topMm}mm; left:${leftMm}mm; width:${wMm}mm; height:${hMm}mm; overflow:hidden; z-index:${zIdx};"><img src="${imgUrl}" style="width:100%; height:100%; object-fit:${elem.ajuste || 'cover'}; opacity:${elem.opacidade !== undefined ? elem.opacidade : 1};" alt="Foto de Capa" /></div>`;
          }
          return `<div style="position:absolute; top:${topMm}mm; left:${leftMm}mm; width:${wMm}mm; height:${hMm}mm; background:linear-gradient(135deg, #EEF4FA, #D5E3F0); display:flex; align-items:center; justify-content:center; color:#314F79; font-size:12pt; font-weight:700; z-index:${zIdx};">Foto de Capa (${wMm} × ${hMm} mm)</div>`;
        }
        if (elem.tipo === 'caixa_grade' && elem.posicionamento_modo === 'coordenadas') {
          const sangria = !!elem.sangria;
          const topMm = sangria ? 0 : (elem.y_mm || 20);
          const leftMm = sangria ? 0 : (elem.x_mm || 20);
          const wMm = sangria ? largura_mm : (elem.largura_mm || 170);
          const hMm = sangria ? altura_mm : (elem.altura_mm || 50);
          return `<div style="position:absolute; top:${topMm}mm; left:${leftMm}mm; width:${wMm}mm; height:${hMm}mm; border:1px solid ${elem.cor || '#314F79'}; background:${elem.fundo || 'rgba(49,79,121,0.05)'}; border-radius:4px; z-index:${elem.camada === 'frente' ? 4 : 0};"></div>`;
        }
        if (elem.tipo === 'tarja') {
          if (elem.posicao === 'topo') return '<div style="position:absolute; top:0; left:0; right:0; height:' + (elem.altura_mm || 8) + 'mm; background:' + (elem.cor || '#314F79') + '; pointer-events:none;"></div>';
          if (elem.posicao === 'base') return '<div style="position:absolute; bottom:0; left:0; right:0; height:' + (elem.altura_mm || 8) + 'mm; background:' + (elem.cor || '#314F79') + '; pointer-events:none;"></div>';
          return '<div style="position:absolute; top:0; bottom:0; left:0; width:' + (elem.altura_mm || 8) + 'mm; background:' + (elem.cor || '#314F79') + '; pointer-events:none;"></div>';
        }
        if (elem.tipo === 'marca_dagua') {
          return '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-35deg); font-size:36pt; font-weight:900; letter-spacing:5mm; color:' + (elem.cor || '#314F79') + '; opacity:' + (elem.opacidade || 0.12) + '; text-transform:uppercase; white-space:nowrap; pointer-events:none; z-index:0;">' + escaparHtml(elem.texto || 'PRELIMINAR') + '</div>';
        }
        if (elem.tipo === 'rotulo_estatico') {
          return '<div style="position:absolute; top:' + (elem.y_mm || 12) + 'mm; left:' + m.l + 'mm; right:' + m.r + 'mm; text-align:center; font-size:' + (elem.tamanho_pt || 11) + 'pt; font-weight:800; color:' + (elem.cor || '#314F79') + '; pointer-events:none;">' + escaparHtml(elem.texto || '') + '</div>';
        }
        return '';
      }).join('\n');
    }
    
return `<section class="ath-pagina" style="position:relative; width:${largura_mm}mm; height:${altura_mm}mm; overflow:hidden; padding:${geo.topoMm}mm ${m.r}mm ${geo.baseMm}mm ${m.l}mm;" data-pagina="${index + 1}">
      ${elemRecHtml}
      ${cabHtml}
      <div class="ath-folha-corpo" style="position:relative; z-index:1; display:flex; flex-direction:column; min-height:${altura_mm - geo.topoMm - geo.baseMm}mm;">
        <div class="ath-grid" style="display:grid; align-content:start; grid-template-columns:repeat(${grade12 ? 12 : cols}, minmax(0, 1fr)); column-gap:${grade12 ? 3.175 : gap}mm; flex:1;">
          ${blocosHtml}
        </div>
        ${notasHtml}
      </div>
      ${rodHtml}
    </section>`;
  }).join('\n');

  const cssGeral = `
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #E2E8F0; font-family: 'Nunito', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .ath-pagina {
      background: #FFFFFF;
      margin: 14px auto;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.12);
      page-break-after: always;
      break-after: page;
      position: relative;
    }
    .ath-pagina:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .ath-tabela {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    .ath-tabela th {
      border-top: 1.5px solid #1F2733;
      border-bottom: 1px solid #1F2733;
      padding: 5px 8px;
      text-align: left;
      font-weight: 700;
    }
    .ath-tabela td {
      border-bottom: 0.6px solid #E2E8F0;
      padding: 4px 8px;
    }
    .ath-tabela tbody tr:last-child td {
      border-bottom: 1.5px solid #1F2733;
    }

    .ath-sumario-linha {
      display: flex;
      align-items: baseline;
      margin-bottom: 5px;
      font-size: 11pt;
    }
    .ath-sumario-txt { flex-shrink: 0; }
    .ath-sumario-pontos {
      flex: 1;
      border-bottom: 1px dotted #94A3B8;
      margin: 0 6px;
      height: 1px;
    }
    .ath-sumario-num { flex-shrink: 0; }
    /* sem isso, estilo com espaço 0 recebia a margem padrão de <p>/<h1> (1em) e os parágrafos ficavam muito afastados */
    .ath-bloco { margin-top: 0; margin-bottom: 0; }
    blockquote.ath-bloco { margin-left: 0; margin-right: 0; } /* o recuo vem do estilo; sem a margem padrão do navegador (40px) o texto fica na mesma largura do editor */
    .ath-num-secao { margin-right: .4em; }
    .ath-toc-item { break-inside: avoid; }
    .ath-toc-link { color: inherit; text-decoration: none; }
    a.ath-citacao-link { color: inherit; text-decoration: none; } /* citação linkada: sem cara de link (a limpeza de estilos tira o style inline) */

    ${cssMarcadoresNota(obterConfigNotas(documento), '', id => (FONTES_SISTEMA[id]?.familia || '').replace(/"/g, "'"))}
    ${cssFontesImportadas(documento)}
    ${cssAvancadoDosEstilos(documento.estilos)}
    ${opcoes.cssExtra || ''}

    @media print {
      body { background: #FFFFFF; }
      .ath-pagina {
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
  `;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escaparHtml(documento.titulo || 'Documento Athenes')}</title>
  <style>${cssGeral}</style>
</head>
<body>
  ${paginasHtml}
</body>
</html>`;
}
