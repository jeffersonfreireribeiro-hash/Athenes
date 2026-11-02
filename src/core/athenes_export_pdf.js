// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gerador de Documento PDF de Alta Fidelidade (HTML Paged Media).
 * Utiliza o padrão W3C CSS Paged Media (@page), caixas de margem, numeração
 * automática e grid modular milimétrico herdado do Clux.js.
 */

import { dimensoesPapelMm } from './athenes_grid.js';
import { estiloParaCss, FONTES_SISTEMA } from './athenes_estilos.js';
import { formatarReferenciaCompleta } from './athenes_bibliografia.js';
import { hifenizarHtml } from './athenes_hifenizacao.js';
import { obterEstiloTabela, dimensoesTabela, resolverCelula, celulaParaCss, tabelaParaCss } from './athenes_tabela_estilo.js';
import { gerarSumarioDinamico, modeloDaPagina, formatarNumeroPagina, gerarCssMolduraBloco, repaginarDocumento, obterTituloCompletoComNumeracao } from './athenes_documento.js';

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
/** Tabela/quadro com estilo declarativo (bordas, zebra, fundos, alinhamento) resolvido por célula. */
function gerarTabelaHtmlEstilizada(bloco, classe) {
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
    '<tr>' + (Array.isArray(linha) ? linha : []).map((cel, c) => '<td style="' + css(ri + (temCab ? 1 : 0), c) + '">' + (cel || '') + '</td>').join('') + '</tr>'
  ).join('');
  return '<table class="' + classe + '" style="' + tabelaParaCss('9.5pt') + '">' + colgroup + cab + '<tbody>' + corpo + '</tbody></table>';
}

export function renderizarBlocoHtml(bloco, estilosMap, documento, opcoes = {}) {
  const estBase = estilosMap[bloco.estiloId] || estilosMap.corpo || {};
  const est = {
    ...estBase,
    ...(bloco.fonte ? { fonte: bloco.fonte } : {}),
    ...(bloco.alinhamento ? { alinhamento: bloco.alinhamento } : {}),
    ...(bloco.cor ? { cor: bloco.cor } : {}),
    ...(bloco.fundo_ativo && bloco.fundo_cor ? { fundo_cor: bloco.fundo_cor } : {}),
    ...(bloco.borda_tipo ? { borda_tipo: bloco.borda_tipo } : {}),
    ...(bloco.entrelinha ? { entrelinha: bloco.entrelinha } : {}),
    ...(bloco.espaco_antes_pt !== undefined ? { espaco_antes_pt: bloco.espaco_antes_pt } : {}),
    ...(bloco.espaco_depois_pt !== undefined ? { espaco_depois_pt: bloco.espaco_depois_pt } : {}),
    ...(bloco.recuo_primeira_linha_mm !== undefined ? { recuo_primeira_linha_mm: bloco.recuo_primeira_linha_mm } : {}),
    ...(bloco.recuo_esquerdo_mm !== undefined ? { recuo_esquerdo_mm: bloco.recuo_esquerdo_mm } : {}),
    ...(bloco.recuo_direito_mm !== undefined ? { recuo_direito_mm: bloco.recuo_direito_mm } : {}),
    ...(bloco.espacamento_letras_em !== undefined ? { espacamento_letras_em: bloco.espacamento_letras_em } : {}),
    ...(bloco.espacamento_palavras_em !== undefined ? { espacamento_palavras_em: bloco.espacamento_palavras_em } : {})
  };
  const estiloCss = estiloParaCss(est);
  const deveHifenizar = bloco.hifenizacao !== undefined ? bloco.hifenizacao : Boolean(est.hifenizacao);
  const textoFormatado = deveHifenizar ? hifenizarHtml(bloco.texto || '') : (bloco.texto || '');

  switch (bloco.tipo) {
    case 'titulo': {
      const tag = `h${Math.min(4, Math.max(1, bloco.nivel || 1))}`;
      return `<${tag} class="ath-bloco ath-titulo" style="${estiloCss}" data-id="${bloco.id}">${textoFormatado}</${tag}>`;
    }

    case 'subtitulo':
      return `<div class="ath-bloco ath-subtitulo" style="${estiloCss}" data-id="${bloco.id}">${textoFormatado}</div>`;

    case 'paragrafo':
      return `<p class="ath-bloco ath-paragrafo" style="${estiloCss}" data-id="${bloco.id}">${textoFormatado}</p>`;

    case 'citacao': {
      const estCitacao = estilosMap.citacao_direta || est;
      const cssCitacao = estiloParaCss(estCitacao);
      const ref = `(${bloco.autor || 'AUTOR'}, ${bloco.ano || 's.d.'}${bloco.pagina_citada ? ', p. ' + bloco.pagina_citada : ''})`;
      return `<blockquote class="ath-bloco ath-citacao" style="${cssCitacao}" data-id="${bloco.id}">
        ${bloco.texto || ''}
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
        (bloco.titulo ? '<div class="ath-legenda" style="' + estiloParaCss(estLegenda) + ' font-weight:800; text-align:left; margin-bottom:4px;">' + bloco.titulo + '</div>' : '') +
        gerarTabelaHtmlEstilizada(bloco, 'ath-quadro') +
        (bloco.fonte ? '<div class="ath-fonte" style="' + estiloParaCss(estFonte) + ' text-align:left; margin-top:4px;">' + bloco.fonte + '</div>' : '') +
      '</div>';
    }

    case 'figura': {
      const estLegenda = estilosMap.legenda || estilosMap.corpo;
      const estFonte = estilosMap.fonte_citada || estilosMap.corpo;
      const layout = bloco.layout || '1';
      const qtdSlots = (layout === '2_lado' || layout === '2_empilhado') ? 2
        : (layout === '3_linha' || layout === '3_misto') ? 3
        : (layout === '4_grade') ? 4
        : (layout === '6_grade') ? 6 : 1;
      const gridCols = layout === '2_lado' || layout === '4_grade' ? 2 : (layout === '3_linha' || layout === '6_grade' ? 3 : 1);
      const itens = (Array.isArray(bloco.itens) ? bloco.itens : [{ url: bloco.src || '' }]).slice(0, qtdSlots);
      
      const itensHtml = itens.map((it, idx) => {
        const sub = it.legenda_sub ? '<figcaption style="font-size:9pt; color:#64748B; font-style:italic;">' + escaparHtml(it.legenda_sub) + '</figcaption>' : '';
        return '<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">' +
          '<img src="' + (it.url || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80') + '" style="max-width:100%; max-height:65mm; object-fit:contain; border-radius:3px;">' +
          sub +
        '</div>';
      }).join('\n');

      const titFig = obterTituloCompletoComNumeracao(bloco);

      return '<figure class="ath-bloco ath-figura-composta" style="margin:12px 0; break-inside:avoid;" data-id="' + bloco.id + '">' +
        (titFig ? '<div class="ath-legenda" style="' + estiloParaCss(estLegenda) + ' font-weight:800; margin-bottom:6px;">' + titFig + '</div>' : '') +
        '<div style="display:grid; grid-template-columns:repeat(' + gridCols + ', 1fr); gap:8px; padding:6px; background:#F8FAFC; border-radius:6px;">' +
          itensHtml +
        '</div>' +
        (bloco.legenda_geral ? '<div style="font-size:9.5pt; color:#475569; margin-top:4px;">' + bloco.legenda_geral + '</div>' : '') +
        (bloco.fonte ? '<div class="ath-fonte" style="' + estiloParaCss(estFonte) + ' margin-top:3px;">' + bloco.fonte + '</div>' : '') +
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
        ${obterTituloCompletoComNumeracao(bloco) ? `<div class="ath-legenda" style="${estiloParaCss(estLegenda)} text-align:left; margin-bottom:4px;">${obterTituloCompletoComNumeracao(bloco)}</div>` : ''}
        ${gerarTabelaHtmlEstilizada(bloco, 'ath-tabela')}
        ${bloco.fonte ? `<div class="ath-fonte" style="${estiloParaCss(estFonte)} text-align:left; margin-top:4px;">${bloco.fonte}</div>` : ''}
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
      const formulaTxt = `<span style="font-family:'Cambria Math', 'Times New Roman', serif; font-size:12pt; font-style:italic; flex:1; text-align:center;">${escaparHtml(bloco.latex || bloco.formula || '')}</span>`;

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
      const itensSumario = gerarSumarioDinamico(documento);
      const linhasSumario = itensSumario.map(it => {
        const recuo = (it.nivel - 1) * 6;
        const peso = it.nivel === 1 ? '700' : '400';
        return `<div class="ath-sumario-linha" style="padding-left:${recuo}mm; font-weight:${peso};">
          <span class="ath-sumario-txt">${it.texto}</span>
          <span class="ath-sumario-pontos"></span>
          <span class="ath-sumario-num">${it.pagina}</span>
        </div>`;
      }).join('\n');

      return `<div class="ath-bloco ath-sumario" data-id="${bloco.id}">
        <h2 style="${estiloParaCss(estilosMap.titulo1)} text-align:center; margin-bottom:14px;">${bloco.titulo || 'SUMÁRIO'}</h2>
        <div class="ath-sumario-lista">${linhasSumario}</div>
      </div>`;
    }

    case 'referencias': {
      const refs = documento.referencias || [];
      const norma = documento.perfil || 'abnt';
      const refsFormatadas = refs.map((r, i) => {
        const html = formatarReferenciaCompleta(r, norma, i + 1);
        return `<div class="ath-ref-item" style="${estiloParaCss(estilosMap.referencias)}">${html}</div>`;
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
  if (!documento.paginas || documento.paginas.length === 0) repaginarDocumento(documento);
  const estilosMap = {};
  for (const est of (documento.estilos || [])) {
    estilosMap[est.id] = est;
  }

  const paginasHtml = (documento.paginas || []).map((pag, index) => {
    const modelo = modeloDaPagina(documento, pag);
    const m = modelo.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
    const cols = modelo.grade?.colunas || 1;
    const gap = modelo.grade?.gap_mm || 0;

    // Cabeçalho da página
    let cabHtml = '';
    if (modelo.cabecalho?.ativo) {
      const textoCab = (modelo.cabecalho.texto || '')
        .replace('{documento.titulo}', documento.titulo || '')
        .replace('{documento.autor_principal}', documento.metadados?.autores?.[0]?.nome || '');
      cabHtml = `<header class="ath-folha-cabecalho" style="text-align:${modelo.cabecalho.alinhamento || 'direita'}; border-bottom:${modelo.cabecalho.linha_divisoria ? '1px solid #E2E8F0' : 'none'}; padding-bottom:3mm; margin-bottom:5mm; font-size:8.5pt; color:#64748B;">
        ${escaparHtml(textoCab)}
      </header>`;
    }

    // Blocos da página
    const blocosHtml = (pag.blocos || []).map(b => {
      const span = Math.min(cols, b.span || 1);
      const gridCol = cols > 1 ? `grid-column: span ${span};` : '';
      return `<div class="ath-bloco-grid" style="${gridCol}">${renderizarBlocoHtml(b, estilosMap, documento, opcoes)}</div>`;
    }).join('\n');

    // Rodapé da página com formatação avançada e numeração alternada
    let rodHtml = '';
    if (modelo.rodape?.ativo) {
      const textoRod = (modelo.rodape.texto || '')
        .replace('{documento.titulo}', documento.titulo || '')
        .replace('{documento.autor_principal}', documento.metadados?.autores?.[0]?.nome || '');
      
      const numFormatado = modelo.rodape.numeracao !== false
        ? formatarNumeroPagina(pag.numero || (index + 1), documento.paginas?.length || 1, modelo.rodape)
        : '';
      const numeroHtml = numFormatado ? `<span class="ath-num-pagina" style="font-weight:700;">${escaparHtml(numFormatado)}</span>` : '';

      const pos = modelo.rodape.posicao_numero || 'direita';
      const ehPar = (pag.numero || (index + 1)) % 2 === 0;
      let rodEstilo = 'display:flex; justify-content:space-between; align-items:center;';
      if (pos === 'alternado') {
        if (ehPar) rodEstilo = 'display:flex; flex-direction:row-reverse; justify-content:space-between; align-items:center;';
      } else if (pos === 'centro') {
        rodEstilo = 'display:flex; justify-content:center; gap:20px; align-items:center;';
      } else if (pos === 'esquerda') {
        rodEstilo = 'display:flex; flex-direction:row-reverse; justify-content:space-between; align-items:center;';
      }

      rodHtml = `<footer class="ath-folha-rodape" style="${rodEstilo} border-top:${modelo.rodape.linha_divisoria ? '1px solid #E2E8F0' : 'none'}; padding-top:3mm; margin-top:auto; font-size:8.5pt; color:#64748B;">
        <span>${escaparHtml(textoRod)}</span>
        ${numeroHtml}
      </footer>`;
    }

    const { largura_mm, altura_mm } = dimensoesPapelMm(modelo.formato, modelo.orientacao);

    // Elementos recorrentes da página mestra (coordenadas mm, sangria total, capas e tarjas)
    let elemRecHtml = '';
    if (Array.isArray(modelo.elementos_recorrentes) && modelo.elementos_recorrentes.length > 0) {
      elemRecHtml = modelo.elementos_recorrentes.map(elem => {
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
    
return `<section class="ath-pagina" style="position:relative; width:${largura_mm}mm; min-height:${altura_mm}mm; padding:${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm;" data-pagina="${index + 1}">
      ${elemRecHtml}
      <div class="ath-folha-corpo" style="position:relative; z-index:1; display:flex; flex-direction:column; min-height:${altura_mm - m.t - m.b}mm;">
        ${cabHtml}
        <div class="ath-grid" style="display:grid; grid-template-columns:repeat(${cols}, minmax(0, 1fr)); column-gap:${gap}mm; flex:1;">
          ${blocosHtml}
        </div>
        ${rodHtml}
      </div>
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
