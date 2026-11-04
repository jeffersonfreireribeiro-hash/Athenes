// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor: desenho de cada bloco na folha (título, parágrafo, citação, figura, tabela, fórmula…).
 * Métodos do EditorView (usam `this`); são acrescentados ao prototype em athenes_editor.js.
 */
import { estiloParaCss } from '../core/athenes_estilos.js';
import { modeloDaPagina, rotuloDaFigura, resolverReferenciasCruzadas, gerarCssMolduraBloco, removerPrefixoNumeracaoTitulo, obterTextoPuroTitulo, obterPrefixoNumeracao } from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';
import { referenciaDoBlocoCitacao } from '../core/athenes_citacao.js';
import { estiloDaBibliografia, ordenarReferencias } from '../core/athenes_bibliografia_estilos.js';
import { formatarReferenciaCompleta } from '../core/athenes_bibliografia.js';
import { chaveMarcador } from '../core/athenes_marcadores.js';
import { latexParaHtml } from '../core/athenes_formula.js';
import { hifenizarHtml, removerHifensCondicionais } from '../core/athenes_hifenizacao.js';
import { classesAvancadasDoBloco, aplicarPalavrasIniciais, removerPalavrasIniciais } from '../core/athenes_estilo_avancado.js';
import { construirTabelaDom, instalarSelecaoCelulas } from './athenes_tabela_ui.js';
import { aplicarRotulosNotasHtml } from '../core/athenes_notas_rodape.js';
import { construirGradeFiguraDom } from './athenes_figura_ui.js';
import { descreverFigura, ehFonteCodigo, fonteDoItem } from '../core/athenes_figura_layout.js';
import { sanearHtmlTexto, ehBlocoDeTexto, ajusteDeFragmento } from '../core/athenes_estilo_exclusivo.js';
import { tagDoNivel, nivelDe, estiloIdDoTitulo } from '../core/athenes_sumario.js';
import { MODOS_TRABALHO } from '../core/athenes_colaboracao.js';

import { TIPO_ROTULO } from './athenes_editor_comum.js';

export const metodosBlocoNaFolha = {
  renderizarBlocoNaFolha(b, pag) {
    const el = document.createElement('div');
    el.className = `ath-bloco-folha ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;
    el.dataset.blocoId = b.id;
    if (b._frag) { el.dataset.fragmento = String(b._frag.indice); el.classList.toggle('ath-frag-cont', !!b._frag.continuaDaAnterior); }
    el.style.gridColumn = `${b.col || 1} / span ${b.span || 12}`;

    // Crachá do Bloco
    const cracha = document.createElement('span');
    cracha.className = 'ath-bloco-cracha';
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'paragrafo' || b.tipo === 'texto') {
      const est = (this.doc.estilos || []).find(e => e.id === b.estiloId);
      cracha.textContent = est ? est.nome.toUpperCase() : 'TEXTO';
    } else {
      cracha.textContent = (TIPO_ROTULO[b.tipo] || b.tipo).toUpperCase();
    }
    el.appendChild(cracha);
    el.appendChild(this.construirBarraRapidaDoBloco(b, pag));
    el.setAttribute('lang', 'pt-BR');

    // Seleção dinâmica bidirecional ao clicar no bloco na página
    el.addEventListener('click', e => {
      e.stopPropagation();
      this.selecionarBloco(b, pag);
    });

    // Foco ao clicar dentro do texto para digitar: sincroniza imediatamente a lista lateral e presença Realtime
    el.addEventListener('focusin', () => {
      if (this.blocoSelecionado?.id !== b.id) {
        this.selecionarBloco(b, pag);
      }
      this.sessaoRealtime?.informarCursorBloco(b.id);
    });

    const idEstilo = b.tipo === 'titulo' ? estiloIdDoTitulo(Object.fromEntries((this.doc.estilos || []).map(e => [e.id, e])), b) : b.estiloId;
    const estilo = (this.doc.estilos || []).find(e => e.id === idEstilo) || {};
    const mestraPag = modeloDaPagina(this.doc, pag);

    // Suporte a grade bidimensional 2D para páginas com mestra Fixa
    if (mestraPag?.modo_aplicacao === 'fixa' && mestraPag?.grade_2d && b.grade_2d) {
      el.style.gridRow = `${b.grade_2d.linha || 1} / span ${b.grade_2d.span_linhas || 1}`;
      el.style.gridColumn = `${b.grade_2d.coluna || 1} / span ${b.grade_2d.span_colunas || 1}`;
    }

    // Texto: visual 100% do estilo (só o ajuste de fragmento da paginação se soma); outros tipos de bloco mantêm os campos do próprio bloco
    const ov = ehBlocoDeTexto(b) ? ajusteDeFragmento(b) : b;
    const estiloMesclado = {
      ...estilo,
      ...(ov.fonte ? { fonte: ov.fonte } : {}),
      ...(ov.alinhamento ? { alinhamento: ov.alinhamento } : {}),
      ...(ov.cor ? { cor: ov.cor } : {}),
      ...(ov.fundo_ativo ? { fundo_cor: ov.fundo_cor || '#FFF2A8' } : {}),
      ...(ov.borda_tipo ? { borda_tipo: ov.borda_tipo } : {}),
      ...(ov.entrelinha ? { entrelinha: ov.entrelinha } : {}),
      ...(ov.espaco_antes_pt !== undefined ? { espaco_antes_pt: ov.espaco_antes_pt } : {}),
      ...(ov.espaco_depois_pt !== undefined ? { espaco_depois_pt: ov.espaco_depois_pt } : {}),
      ...(ov.recuo_primeira_linha_mm !== undefined ? { recuo_primeira_linha_mm: ov.recuo_primeira_linha_mm } : {}),
      ...(ov.recuo_esquerdo_mm !== undefined ? { recuo_esquerdo_mm: ov.recuo_esquerdo_mm } : {}),
      ...(ov.recuo_direito_mm !== undefined ? { recuo_direito_mm: ov.recuo_direito_mm } : {}),
      ...(ov.espacamento_letras_em !== undefined ? { espacamento_letras_em: ov.espacamento_letras_em } : {}),
      ...(ov.espacamento_palavras_em !== undefined ? { espacamento_palavras_em: ov.espacamento_palavras_em } : {}),
      ...(!ehBlocoDeTexto(b) && b.hifenizacao !== undefined ? { hifenizacao: b.hifenizacao } : {})
    };
    // as margens verticais do estilo já vão no contêiner do bloco (abaixo); repetidas no texto, o espaço entre blocos saía em dobro
    const cssEstilo = estiloParaCss(estiloMesclado).replace(/margin-(?:top|bottom)\s*:[^;]*;?/g, '');

    // Espaçamentos e margens verticais entre blocos e entre parágrafos
    const espacoDepoisPt = ov.espaco_depois_pt ?? estiloMesclado.espaco_depois_pt ?? 8;
    const espacoAntesPt = ov.espaco_antes_pt ?? estiloMesclado.espaco_antes_pt ?? 0;
    el.style.marginTop = `${espacoAntesPt}pt`;
    el.style.marginBottom = `${espacoDepoisPt}pt`;

    const espacoParagrafosPt = b.espaco_paragrafos_pt ?? estiloMesclado.espaco_paragrafos_pt ?? 6;
    el.style.setProperty('--ath-paragrafo-gap', `${espacoParagrafosPt}pt`);

    const ehSomenteLeitura = this.modoTrabalho === MODOS_TRABALHO.VISUALIZACAO;

    // 1. TÍTULO
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
      const tag = b.tipo === 'titulo' ? tagDoNivel(nivelDe(b)) : (b.nivel === 1 ? 'h1' : b.nivel === 2 ? 'h2' : 'h3');
      const heading = document.createElement(tag);
      heading.contentEditable = ehSomenteLeitura ? 'false' : 'true';
      heading.className = 'ath-titulo-editable';
      const numSecao = b.tipo === 'titulo' ? this.mapaNumSecoes?.get(b.id) : null;
      if (numSecao) { heading.dataset.prefixo = numSecao.prefixo; heading.classList.add('ath-titulo-numerado'); } // o número é CSS: não entra no texto editado
      if (b.tipo === 'titulo' && nivelDe(b) > 6) { heading.setAttribute('role', 'heading'); heading.setAttribute('aria-level', String(nivelDe(b))); }
      heading.setAttribute('lang', 'pt-BR');
      const hifAtivoTit = Boolean(estiloMesclado.hifenizacao);
      heading.style.cssText = `${cssEstilo}; margin:0; outline:none;`;
      const textoTit = this.comEstilosDeTrecho(b.texto || 'Título da Seção');
      heading.innerHTML = aplicarRotulosNotasHtml(hifAtivoTit ? hifenizarHtml(textoTit) : removerHifensCondicionais(textoTit), pag?.rotulosNotas);
      const marcT = this.mapaMarc?.get(chaveMarcador(b));
      if (marcT) {
        // marcadores e numeração do título: o rótulo é CSS (data-marc), como o número de seção, e fica fora do texto
        const ind = (marcT.cfg.nivel - 1) * 6;
        heading.classList.add('ath-titulo-marcado');
        heading.style.paddingLeft = `${ind + marcT.cfg.tabMm}mm`;
        heading.style.setProperty('--ath-marc-esq', `${ind}mm`);
        heading.style.setProperty('--ath-marc-larg', `${marcT.cfg.tabMm - 1.5}mm`);
        heading.style.setProperty('--ath-marc-alin', marcT.cfg.alinhamento);
        if (!b._frag?.continuaDaAnterior) heading.dataset.marc = marcT.rotulo;
      }

      heading.addEventListener('input', () => {
        b.texto = sanearHtmlTexto(removerHifensCondicionais(heading.innerHTML));
        this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
        this.notificarMudancaRapida();
        this.agendarRepaginacao();
      });
      this.instalarSugestaoNoBloco(heading, b);
      el.appendChild(heading);
    }

    // 2. PARÁGRAFO (e CITAÇÃO: mesmo desenho, com o estilo e o recuo do estilo "Citação"; a referência (AUTOR, ano) vai ao fim, como no PDF)
    else if (b.tipo === 'paragrafo' || b.tipo === 'citacao') {
      const p = document.createElement('div');
      p.contentEditable = ehSomenteLeitura ? 'false' : 'true';
      p.className = 'ath-texto-editable';
      const classesAv = classesAvancadasDoBloco(estiloMesclado, b._frag);
      if (classesAv) p.className += ` ${classesAv}`;
      p.setAttribute('lang', 'pt-BR');
      const hifAtivoP = Boolean(estiloMesclado.hifenizacao);
      p.style.cssText = `${cssEstilo}; outline:none;`;

      let conteudoHtml = this.comEstilosDeTrecho(b.texto || 'Escreva diretamente neste bloco...');
      const marcP = this.mapaMarc?.get(chaveMarcador(b));
      if (marcP && !b._frag?.continuaDaAnterior && !conteudoHtml.includes('<ul') && !conteudoHtml.includes('<ol')) {
        if (marcP.cfg.tipo === 'numero') {
          conteudoHtml = `<ol><li>${conteudoHtml}</li></ol>`;
        } else {
          conteudoHtml = `<ul><li>${conteudoHtml}</li></ul>`;
        }
      }

      let htmlP = aplicarRotulosNotasHtml(resolverReferenciasCruzadas(hifAtivoP ? hifenizarHtml(conteudoHtml) : removerHifensCondicionais(conteudoHtml), this.doc), pag?.rotulosNotas);
      if (classesAv && !b._frag?.continuaDaAnterior && b.texto) htmlP = aplicarPalavrasIniciais(htmlP, estiloMesclado);
      p.innerHTML = htmlP;
      if (b.tipo === 'citacao' && !b._frag?.continuaNaProxima) {
        const ref = document.createElement('span');
        ref.className = 'ath-citacao-ref';
        ref.contentEditable = 'false';
        ref.style.userSelect = 'none';
        ref.innerHTML = ` ${referenciaDoBlocoCitacao(b).html}`;
        p.appendChild(ref);
      }
      this.aplicarConfigListaNoBloco(p, b, marcP);

      // Modo Sugestão (estilo Google Docs): digitar/colar vira inserção, apagar vira exclusão tachada (sem alterar a base)
      this.instalarSugestaoNoBloco(p, b);

      p.addEventListener('input', () => {
        b.texto = sanearHtmlTexto(removerPalavrasIniciais(p.innerHTML).replace(/<span class="ath-citacao-ref"[^>]*>.*?<\/span>/g, '')); // destaque de palavras iniciais e referência da citação são só de exibição
        this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
        this.notificarMudancaRapida(); // agenda gravação/histórico (adiados): fechar a aba com o cursor no campo não perde mais o texto
        this.agendarRepaginacao(); // o texto que cresce passa para a página seguinte na hora, sem precisar reabrir o arquivo
      });

      p.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey || (!e.shiftKey && marcP)) { // Ctrl+Enter divide; Enter num estilo com marcador/numeração abre o próximo item (novo bloco)
            e.preventDefault();
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const rangeAntes = range.cloneRange();
              rangeAntes.selectNodeContents(p);
              rangeAntes.setEnd(range.startContainer, range.startOffset);
              const divAntes = document.createElement('div');
              divAntes.appendChild(rangeAntes.cloneContents());

              const rangeDepois = range.cloneRange();
              rangeDepois.selectNodeContents(p);
              rangeDepois.setStart(range.endContainer, range.endOffset);
              const divDepois = document.createElement('div');
              divDepois.appendChild(rangeDepois.cloneContents());

              this.dividirBlocoAtual(b.id, { textoAntes: removerPalavrasIniciais(divAntes.innerHTML), textoDepois: removerPalavrasIniciais(divDepois.innerHTML) });
            } else {
              this.dividirBlocoAtual(b.id);
            }
            return;
          }

          // Enter normal em lista (continuidade do marcador ou saída da lista com Enter em item vazio)
          const sel = window.getSelection();
          if (sel && sel.anchorNode) {
            const elNode = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
            const li = elNode?.closest('li');
            if (li) {
              const textoLi = li.textContent.replace(/\u200B/g, '').trim();
              if (!textoLi) {
                // Item de lista vazio: sair da lista e voltar a ser parágrafo normal
                e.preventDefault();
                const ul = li.closest('ul, ol');
                document.execCommand('outdent', false, null);
                if (ul && ul.children.length === 0) {
                  ul.remove();
                }
                this.notificarMudancaRapida();
                return;
              }
              // Se tiver conteúdo no <li>, o Enter nativo gera o próximo <li> com o marcador
            }
          }
        }
      });
      p.addEventListener('blur', () => {
        b.texto = sanearHtmlTexto(removerPalavrasIniciais(p.innerHTML));
        this.notificarMudancaRapida();
      });
      el.appendChild(p);
    }

    // 3. FIGURA COMPOSTA (MULTI-ITENS, SUBGRADE, LEGENDA E FONTE)
    else if (b.tipo === 'figura' || b.tipo === 'imagem') {
      const figBox = document.createElement('div');
      figBox.className = 'ath-composto-figura';
      Object.assign(figBox.style, gerarCssMolduraBloco(b));

      // Título da Figura com Prefixo Intrínseco não-editável
      const tit = document.createElement('div');
      tit.className = 'ath-fig-titulo';
      const rot = rotuloDaFigura(b);
      const num = b.numero_sequencial || 1;
      const prefixoStr = obterPrefixoNumeracao(b);
      const textoPuro = obterTextoPuroTitulo(b) || 'Descrição da Ilustração';

      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoStr}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuro}</span>
      `;
      this.aplicarTipografiaBloco(tit, b, 'titulo', tit.querySelector('.ath-num-prefixo-fixo'));
      const spanEditavel = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavel.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavel.innerText.trim());
        this.notificarMudancaRapida();
      });

      // Grade de imagens (subgrid): estilo vindo de `descreverFigura`, o mesmo usado na exportação PDF
      const margensFig = modeloDaPagina(this.doc, pag)?.margens_mm || { l: 25, r: 20 };
      const aplicarBlocoFig = () => {
        ['width', 'marginLeft', 'marginRight', 'float', 'clear', 'marginBottom'].forEach(k => { figBox.style[k] = ''; });
        Object.assign(figBox.style, descreverFigura(b, { margens_mm: margensFig }).bloco);
      };
      const montarGrade = () => construirGradeFiguraDom(b, {
        margens_mm: margensFig,
        estilos: this.doc.estilos,
        interativo: true,
        selecionadoIdx: this._itemFigura?.id === b.id ? this._itemFigura.idx : null,
        doc: this.doc, // figuras por código herdam tipografia/paleta do documento
        // clique único na imagem: seleciona a figura individual (barra flutuante + painel do bloco)
        aoClicarItem: (idx, ev) => { ev.stopPropagation(); this.selecionarItemFigura(b, pag, idx); },
        // duplo clique: figura por código abre o editor de código; imagem abre o seletor de arquivo
        aoDuploClique: (idx, ev) => {
          ev.stopPropagation();
          if (ehFonteCodigo(fonteDoItem((b.itens || [])[idx]).sourceType)) this.editarCodigoItemFigura(b, idx);
          else this.escolherImagemItemFigura(b, idx);
        }
      }).grid;
      let grid = montarGrade();
      aplicarBlocoFig();
      // reconstrói só a grade (sem re-renderizar a folha) quando propriedades da imagem mudam
      el._reconstruirFigura = () => {
        const novo = montarGrade();
        grid.replaceWith(novo);
        grid = novo;
        aplicarBlocoFig();
        this.marcarItemFigura();
      };
      // clique no contêiner/moldura (fora das imagens): seleciona o bloco agregador
      figBox.addEventListener('click', (ev) => {
        if (!ev.target.closest('.ath-fig-item') && this._itemFigura?.id === b.id) {
          this._itemFigura = null;
          this.marcarItemFigura();
        }
      });
      if (this._itemFigura?.id === b.id) queueMicrotask(() => this.marcarItemFigura());

      // Legenda Geral
      let leg = null;
      if (b.mostrar_legenda !== false) {
        leg = document.createElement('div');
        leg.contentEditable = 'true';
        leg.className = 'ath-fig-legenda-geral';
        leg.innerHTML = b.legenda_geral || b.legenda || 'Legenda explicativa dos elementos representados.';
        this.aplicarTipografiaBloco(leg, b, 'legenda');
        leg.addEventListener('blur', () => { b.legenda_geral = leg.innerHTML; this.notificarMudancaRapida(); });
      }

      // Fonte
      let fonte = null;
      if (b.mostrar_fonte !== false) {
        fonte = document.createElement('div');
        fonte.contentEditable = 'true';
        fonte.className = 'ath-bloco-fonte';
        fonte.innerHTML = b.fonte || 'Fonte: Autores (2026).';
        this.aplicarTipografiaBloco(fonte, b, 'fonte');
        fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
      }

      // Aplicação da Subgrade estilo Desk (1 coluna vertical ou 2 colunas com legenda/dados ao lado)
      if (b.subgrade_colunas === 2) {
        figBox.style.display = 'grid';
        figBox.style.gridTemplateColumns = '1.35fr 1fr';
        figBox.style.gap = '14px';
        figBox.style.alignItems = 'center';

        const colDir = document.createElement('div');
        colDir.style.display = 'flex';
        colDir.style.flexDirection = 'column';
        colDir.style.gap = '6px';

        colDir.appendChild(tit);
        if (leg) colDir.appendChild(leg);
        if (fonte) colDir.appendChild(fonte);

        figBox.appendChild(grid);
        figBox.appendChild(colDir);
      } else {
        if (b.posicao_titulo === 'base') {
          figBox.appendChild(grid);
          figBox.appendChild(tit);
        } else {
          figBox.appendChild(tit);
          figBox.appendChild(grid);
        }
        if (leg) figBox.appendChild(leg);
        if (fonte) figBox.appendChild(fonte);
      }

      el.appendChild(figBox);
    }

    // 4. MAPA TERRITORIAL
    else if (b.tipo === 'mapa') {
      const mapaBox = document.createElement('div');
      mapaBox.className = 'ath-composto-mapa';

      const tit = document.createElement('div');
      tit.className = 'ath-mapa-titulo';
      const prefixoMapa = obterPrefixoNumeracao(b);
      const textoPuroMapa = obterTextoPuroTitulo(b) || 'Delimitação territorial';
      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoMapa}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuroMapa}</span>
      `;
      const spanEditavelMapa = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavelMapa.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavelMapa.innerText.trim());
        this.notificarMudancaRapida();
      });
      mapaBox.appendChild(tit);

      const canvasBox = document.createElement('div');
      canvasBox.className = 'ath-mapa-canvas-box';
      canvasBox.innerHTML = `
        ${b.orientacao_norte ? '<div class="ath-mapa-norte">N ↑</div>' : ''}
        <div style="text-align:center; color:#64748B;">
          ${svgIcone('mapa', 48)}
          <p style="margin:4px 0 0 0; font-size:12px; font-weight:700;">Área do Mapa Territorial (SIRGAS 2000)</p>
        </div>
        <div class="ath-mapa-escala-badge">Escala: ${b.escala || '1:10.000'}</div>
      `;
      mapaBox.appendChild(canvasBox);

      const leg = document.createElement('div');
      leg.contentEditable = 'true';
      leg.className = 'ath-mapa-legenda-carto';
      leg.innerHTML = b.legenda_cartografica || 'Convenções: Perímetro de regularização, vias e lotes cadastrados.';
      leg.addEventListener('blur', () => { b.legenda_cartografica = leg.innerHTML; this.notificarMudancaRapida(); });
      mapaBox.appendChild(leg);

      const fonte = document.createElement('div');
      fonte.contentEditable = 'true';
      fonte.className = 'ath-bloco-fonte';
      fonte.innerHTML = b.fonte || 'Fonte: Glaux GIS.';
      fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
      mapaBox.appendChild(fonte);

      el.appendChild(mapaBox);
    }

    // 5. TABELA (ABNT/IBGE COM MODELO DE MOLDURA)
    else if (b.tipo === 'tabela') {
      const tabBox = document.createElement('div');
      Object.assign(tabBox.style, gerarCssMolduraBloco(b));

      const tit = document.createElement('div');
      tit.className = 'ath-tab-titulo';
      const prefixoTab = obterPrefixoNumeracao(b);
      const textoPuroTab = obterTextoPuroTitulo(b) || 'Dados apresentados';
      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoTab}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuroTab}</span>
      `;
      this.aplicarTipografiaBloco(tit, b, 'titulo', tit.querySelector('.ath-num-prefixo-fixo'));
      const spanEditavelTab = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavelTab.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavelTab.innerText.trim());
        this.notificarMudancaRapida();
      });
      tabBox.appendChild(tit);
      this.ajustarLegendaDeContinuacao(tit, b);

      const table = construirTabelaDom(b, 'ath-tabela-abnt', () => this.notificarMudancaRapida(), this.doc.estilos);
      this._selTabelas.set(b.id, instalarSelecaoCelulas(table));
      tabBox.appendChild(table);
      this.anexarRotuloContinua(tabBox, b);

      if (b.notas && b.mostrar_legenda !== false && !b._frag?.continuaNaProxima) {
        const notas = document.createElement('div');
        notas.contentEditable = 'true';
        notas.style.fontSize = '11px';
        notas.style.color = '#64748B';
        notas.innerHTML = `Nota: ${b.notas}`;
        tabBox.appendChild(notas);
      }

      if (b.mostrar_fonte !== false && !b._frag?.continuaNaProxima) {
        const fonte = document.createElement('div');
        fonte.contentEditable = 'true';
        fonte.className = 'ath-bloco-fonte';
        fonte.innerHTML = b.fonte || 'Fonte: Elaborada pelos autores.';
        this.aplicarTipografiaBloco(fonte, b, 'fonte');
        fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
        tabBox.appendChild(fonte);
      }

      el.appendChild(tabBox);
    }

    // 6. QUADRO (ABNT - CAIXA COM MODELO DE MOLDURA)
    else if (b.tipo === 'quadro') {
      const qBox = document.createElement('div');
      Object.assign(qBox.style, gerarCssMolduraBloco(b));

      const tit = document.createElement('div');
      tit.className = 'ath-quadro-titulo';
      const prefixoQuadro = obterPrefixoNumeracao(b);
      const textoPuroQuadro = obterTextoPuroTitulo(b) || 'Categorias conceituais';
      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoQuadro}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuroQuadro}</span>
      `;
      this.aplicarTipografiaBloco(tit, b, 'titulo', tit.querySelector('.ath-num-prefixo-fixo'));
      const spanEditavelQuadro = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavelQuadro.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavelQuadro.innerText.trim());
        this.notificarMudancaRapida();
      });
      qBox.appendChild(tit);
      this.ajustarLegendaDeContinuacao(tit, b);

      const table = construirTabelaDom(b, 'ath-quadro-abnt', () => this.notificarMudancaRapida(), this.doc.estilos);
      this._selTabelas.set(b.id, instalarSelecaoCelulas(table));
      qBox.appendChild(table);
      this.anexarRotuloContinua(qBox, b);

      if (b.mostrar_fonte !== false && !b._frag?.continuaNaProxima) {
        const fonte = document.createElement('div');
        fonte.contentEditable = 'true';
        fonte.className = 'ath-bloco-fonte';
        fonte.innerHTML = b.fonte || 'Fonte: Referencial teórico.';
        this.aplicarTipografiaBloco(fonte, b, 'fonte');
        fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
        qBox.appendChild(fonte);
      }

      el.appendChild(qBox);
    }

    // 7. FÓRMULA MATEMÁTICA (COM SLOTS DE APRESENTAÇÃO E NÚMERO)
    else if (b.tipo === 'formula') {
      const fBox = document.createElement('div');
      fBox.className = 'ath-bloco-formula';
      Object.assign(fBox.style, gerarCssMolduraBloco(b));

      const posNum = b.posicao_numero || 'direita';
      const numTxt = b.numero_equacao || b.numero || '(1)';
      const corpoFormula = `<div class="ath-formula-corpo" style="flex:1; text-align:center;">${latexParaHtml(b.latex || b.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx')}</div>`;
      const numBadge = posNum !== 'oculto' ? `<div class="ath-formula-numero" style="font-weight:700; color:#475569;">${numTxt}</div>` : '';

      let linhaPrincipalHtml = '';
      if (posNum === 'esquerda') {
        linhaPrincipalHtml = `<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;">${numBadge}${corpoFormula}</div>`;
      } else if (posNum === 'abaixo') {
        linhaPrincipalHtml = `<div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:100%;">${corpoFormula}${numBadge}</div>`;
      } else {
        linhaPrincipalHtml = `<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;">${corpoFormula}${numBadge}</div>`;
      }

      let extraHtml = '';
      if (b.mostrar_legenda !== false && (b.legenda_formula || b.legenda)) {
        extraHtml += `<div class="ath-formula-legenda" style="margin-top:6px; font-size:11px; color:#64748B; font-style:italic;">${b.legenda_formula || b.legenda}</div>`;
      }
      if (b.mostrar_fonte !== false && (b.fonte_formula || b.fonte)) {
        extraHtml += `<div class="ath-bloco-fonte" style="margin-top:4px; font-size:10.5px; color:#94A3B8;">${b.fonte_formula || b.fonte}</div>`;
      }

      fBox.innerHTML = `${linhaPrincipalHtml}${extraHtml}`;
      el.appendChild(fBox);
    }

    // 8. CAMPOS (RÓTULO E VALOR)
    else if (b.tipo === 'campos') {
      const cBox = document.createElement('div');
      cBox.style.display = 'grid';
      cBox.style.gridTemplateColumns = `repeat(${b.colunas || 2}, 1fr)`;
      cBox.style.gap = '8px 12px';
      (b.itens || []).forEach(it => {
        const itemEl = document.createElement('div');
        itemEl.style.display = 'flex';
        itemEl.style.flexDirection = 'column';
        itemEl.innerHTML = `
          <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:#6B7585;">${it.rotulo}</span>
          <span style="font-size:12.5px; font-weight:700; color:#1F2733;">${it.valor}</span>
        `;
        cBox.appendChild(itemEl);
      });
      el.appendChild(cBox);
    }

    // 9. DIVISOR
    else if (b.tipo === 'divisor') {
      const hr = document.createElement('hr');
      hr.style.border = 'none';
      hr.style.borderTop = '1px solid #CBD5E1';
      hr.style.margin = '8px 0';
      el.appendChild(hr);
    }

    // 10. ESPAÇAMENTO
    else if (b.tipo === 'espaco') {
      const sp = document.createElement('div');
      sp.style.height = `${b.altura_pt || 24}px`;
      el.appendChild(sp);
    }

    // 10b. SUMÁRIO AUTOMÁTICO (vivo, com links para os títulos)
    else if (b.tipo === 'sumario') {
      el.appendChild(this.montarSumarioVivo(b, cssEstilo));
    }

    // 10c. REFERÊNCIAS: lista automática das obras citadas, no estilo escolhido (igual ao PDF e ao Word)
    else if (b.tipo === 'referencias') {
      const estiloRef = estiloDaBibliografia(this.doc, b);
      const refs = ordenarReferencias(this.doc.referencias || [], estiloRef);
      const caixa = document.createElement('div');
      caixa.className = 'ath-ref-lista';
      if (b.titulo) { const h = document.createElement('h2'); h.style.cssText = 'margin:0 0 8px;'; h.textContent = b.titulo; caixa.appendChild(h); }
      if (!refs.length) {
        const v = document.createElement('p'); v.style.cssText = 'color:#64748B; font-style:italic; margin:0;'; v.textContent = 'Nenhuma referência inserida no documento. Cite uma obra pelo Zotero e ela entra aqui.'; caixa.appendChild(v);
      }
      refs.forEach((r, i) => { const it = document.createElement('div'); it.className = 'ath-ref-item'; it.style.cssText = 'margin:0 0 8px; text-align:left;'; it.innerHTML = formatarReferenciaCompleta(r, estiloRef, i + 1); caixa.appendChild(it); });
      el.appendChild(caixa);
    }

    // 11. OUTROS BLOCOS (CITAÇÃO, NOTAS, ETC.)
    else {
      const gen = document.createElement('div');
      gen.contentEditable = 'true';
      gen.innerHTML = b.texto || `[Bloco ${b.tipo}]`;
      gen.addEventListener('blur', () => { b.texto = gen.innerHTML; this.notificarMudancaRapida(); });
      el.appendChild(gen);
    }

    // Alça lateral de mover (aparece ao passar o mouse ou selecionar o bloco)
    const alca = document.createElement('button');
    alca.type = 'button';
    alca.className = `ath-bloco-alca ${(b.col || 1) > 1 ? 'topo' : ''}`;
    alca.draggable = true;
    alca.title = 'Arraste para mover o bloco';
    alca.setAttribute('aria-label', 'Mover bloco');
    alca.innerHTML = svgIcone('alca', 14);
    alca.addEventListener('dragstart', ev => this.iniciarArrasto(ev, b, el));
    alca.addEventListener('dragend', () => this.encerrarArrasto());
    alca.addEventListener('click', e => e.stopPropagation());
    el.appendChild(alca);
    this.ligarAlvoDeSolta(el, b);

    return el;
  }
};
