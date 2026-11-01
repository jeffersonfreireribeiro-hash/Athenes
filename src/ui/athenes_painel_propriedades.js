// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel Inspetor de Propriedades do Bloco, Posição na Folha e Modelos.
 * Segue fielmente o padrão Glaux GIS (relatorios_modelos):
 * - Seletor de linha com pills numeradas (1, 2, 3, 4, +)
 * - 4 cartões de largura pré-definida (Largura toda, Metade esq., Metade dir., Um terço)
 * - Trilha de 12 colunas interativas com pontos lincados (.rm-trilha)
 * - Controles de blocos compostos (Figura, Mapa, Tabela, Quadro, Fórmula)
 * - Inserção de referências cruzadas e citações Zotero
 */

import { FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';
import {
  modeloDaPagina, recalcularNumeracaoAutomatica, resolverReferenciasCruzadas,
  ROTULOS_FIGURA, calcularLinhas, linhaDoBloco, moverParaLinha, igualarLinha, LIMITE_BLOCOS_POR_LINHA
} from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';
import { ModalLayoutBloco } from './athenes_editor_layout_bloco.js';

export class PainelPropriedades {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.blocoSelecionado = null;
    this.paginaSelecionada = null;
    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onDividirBloco = opcoes.onDividirBloco || (() => {});

    this.renderizar();
  }

  setDocumento(doc) {
    this.doc = doc;
    this.renderizar();
  }

  setSelecao(bloco, pagina) {
    this.blocoSelecionado = bloco;
    this.paginaSelecionada = pagina;
    this.renderizar();
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'rm-props';

    if (!this.blocoSelecionado) {
      wrapper.innerHTML = `
        <div class="rm-vazio-cartao" style="padding:28px 16px;">
          <h3 style="margin:0 0 6px 0; font:800 15px var(--glx-font);">Nenhum bloco selecionado</h3>
          <p style="margin:0; font-size:12.5px; color:var(--glx-muted);">Clique diretamente em qualquer bloco na folha para ajustar sua linha, largura nas 12 colunas, estilo e conteúdo composto.</p>
        </div>
      `;
      this.container.appendChild(wrapper);
      return;
    }

    const b = this.blocoSelecionado;
    const tipoNome = {
      titulo: 'Título da Seção',
      subtitulo: 'Subtítulo',
      paragrafo: 'Texto / Parágrafo',
      citacao: 'Citação Direta Longa',
      tabela: 'Tabela (ABNT/IBGE)',
      quadro: 'Quadro Estruturado',
      figura: `${ROTULOS_FIGURA[b.subtipo] || 'Figura'} (ilustração)`,
      mapa: 'Mapa Territorial',
      formula: 'Fórmula Matemática',
      campos: 'Campos (rótulo e valor)',
      nota: 'Nota de Rodapé',
      divisor: 'Divisor de Seção',
      espaco: 'Espaçamento Vertical'
    }[b.tipo] || b.tipo.toUpperCase();

    // 1. Cabeçalho do Bloco
    const topo = document.createElement('div');
    topo.style.display = 'flex';
    topo.style.justifyContent = 'space-between';
    topo.style.alignItems = 'center';
    topo.style.marginBottom = '6px';
    topo.innerHTML = `
      <h3 style="margin:0; font:800 15px var(--glx-font);">${tipoNome}</h3>
      <span class="rm-selo">${b.tipo}</span>
    `;
    wrapper.appendChild(topo);

    // 2. Seção LINHA (Pills 1, 2, 3, 4, +)
    this.renderizarControleLinha(wrapper, b);

    // 3. Seção POSIÇÃO NA FOLHA (4 Cards de Presets + Trilha de 12 Pontos)
    this.renderizarControleGrade12(wrapper, b);

    // 4. Controles Específicos do Bloco
    this.renderizarCamposEspecificos(wrapper, b);

    // 5. Inserção de Referências Cruzadas
    this.renderizarAjudanteReferencias(wrapper, b);

    this.container.appendChild(wrapper);
  }

  renderizarControleLinha(wrapper, b) {
    const info = linhaDoBloco(this.doc, b.id);
    const secao = this.doc.secoes.find(s => s.blocos.some(x => x.id === b.id));
    const linhas = calcularLinhas(secao ? secao.blocos : []);
    const secLinha = document.createElement('div');
    secLinha.className = 'rm-linha-ctl';

    const msg = info.quantidade > 1
      ? `Este bloco está na linha ${info.numero} de ${info.total}, junto com mais ${info.quantidade - 1}.`
      : `Este bloco está sozinho na linha ${info.numero} de ${info.total}. Escolha outra linha para colocá-lo lado a lado (até ${LIMITE_BLOCOS_POR_LINHA} por linha).`;
    secLinha.innerHTML = `
      <span class="rm-rot">LINHA</span>
      <p class="rm-dica" style="margin:0;">${msg}</p>
      <div class="rm-lns"></div>
    `;

    const lns = secLinha.querySelector('.rm-lns');
    for (let i = 1; i <= info.total; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `rm-ln ${i === info.numero ? 'on' : ''}`;
      btn.textContent = String(i);
      const cheia = linhas[i - 1].length >= LIMITE_BLOCOS_POR_LINHA && i !== info.numero;
      btn.disabled = cheia;
      btn.title = cheia ? 'Esta linha já está cheia' : `Colocar na linha ${i}`;
      btn.addEventListener('click', () => {
        if (moverParaLinha(this.doc, b.id, i)) this.notificarMudanca(true);
      });
      lns.appendChild(btn);
    }
    const nova = document.createElement('button');
    nova.type = 'button';
    nova.className = 'rm-ln rm-ln-nova';
    nova.textContent = '+';
    nova.title = 'Mover para uma linha nova ao final';
    nova.disabled = info.quantidade === 1;
    nova.addEventListener('click', () => {
      if (moverParaLinha(this.doc, b.id, info.total + 1)) this.notificarMudanca(true);
    });
    lns.appendChild(nova);

    if (info.quantidade > 1) {
      const igual = document.createElement('button');
      igual.type = 'button';
      igual.className = 'glx-btn glx-btn-soft glx-btn-sm';
      igual.textContent = 'Igualar larguras';
      igual.title = 'Divide as 12 colunas igualmente entre os blocos desta linha';
      igual.addEventListener('click', () => {
        igualarLinha(linhas[info.numero - 1]);
        this.notificarMudanca(true);
      });
      secLinha.appendChild(igual);
    }

    wrapper.appendChild(secLinha);
  }

  renderizarControleGrade12(wrapper, b) {
    const secGrade = document.createElement('div');
    secGrade.className = 'rm-grade-sel';
    secGrade.style.paddingTop = '10px';

    b.col = b.col || 1;
    b.span = b.span || 12;

    secGrade.innerHTML = `
      <span class="rm-rot">POSIÇÃO NA FOLHA</span>
      <div class="rm-pres" id="rmPresetCards"></div>
      <div class="rm-trilha" role="group" aria-label="Colunas do grid" id="rmTrilhaPontos"></div>
      <span class="rm-dica" id="rmRotuloTrilha"></span>
    `;

    // 4 Cards Presets
    const presetsBox = secGrade.querySelector('#rmPresetCards');
    const presets = [
      { nome: 'Largura toda', col: 1, span: 12 },
      { nome: 'Metade esq.', col: 1, span: 6 },
      { nome: 'Metade dir.', col: 7, span: 6 },
      { nome: 'Um terço', col: 1, span: 4 }
    ];

    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rm-pre';

      // Desenha mini-barra de 12 colunas
      let bars = '';
      for (let i = 1; i <= 12; i++) {
        const ativo = i >= p.col && i < (p.col + p.span);
        bars += `<i class="${ativo ? 'on' : ''}"></i>`;
      }

      btn.innerHTML = `
        <div class="rm-pre-bar">${bars}</div>
        <small>${p.nome}</small>
      `;

      btn.addEventListener('click', () => {
        b.col = p.col;
        b.span = p.span;
        this.notificarMudanca(true);
      });

      presetsBox.appendChild(btn);
    });

    // 12 Pontos interativos da trilha
    const trilhaBox = secGrade.querySelector('#rmTrilhaPontos');
    const rotuloTrilha = secGrade.querySelector('#rmRotuloTrilha');

    const atualizarTrilhaVisual = () => {
      const ini = b.col;
      const fim = b.col + b.span - 1;
      rotuloTrilha.textContent = `Colunas ${ini} a ${fim} (${b.span} de 12). Clique numa coluna para ligar ou desligar; o bloco é sempre uma faixa contínua.`;

      trilhaBox.querySelectorAll('.rm-pt').forEach((ptEl, idx) => {
        const colNum = idx + 1;
        const noBloco = colNum >= ini && colNum <= fim;
        const comLigacao = colNum >= ini && colNum < fim;
        ptEl.classList.toggle('on', noBloco);
        ptEl.classList.toggle('lig', comLigacao);
        ptEl.classList.toggle('ancora', colNum === ini);
        ptEl.setAttribute('aria-pressed', String(noBloco));
      });
    };

    for (let c = 1; c <= 12; c++) {
      const pt = document.createElement('button');
      pt.type = 'button';
      pt.className = 'rm-pt';
      pt.innerHTML = '<i></i>';
      pt.title = `Coluna ${c}`;

      pt.addEventListener('click', () => {
        const ini = b.col;
        const fim = b.col + b.span - 1;
        if (c < ini) {
          b.col = c;
          b.span = fim - c + 1;
        } else if (c > fim) {
          b.span = c - ini + 1;
        } else if (c === ini && b.span > 1) {
          b.col = ini + 1;
          b.span--;
        } else if (c === fim && b.span > 1) {
          b.span--;
        } else if (b.span > 1) {
          if (c - ini < fim - c) {
            b.col = c + 1;
            b.span = fim - c;
          } else {
            b.span = c - ini;
          }
        }
        atualizarTrilhaVisual();
        this.notificarMudanca(true);
      });

      trilhaBox.appendChild(pt);
    }

    atualizarTrilhaVisual();
    wrapper.appendChild(secGrade);
  }

    renderizarCamposEspecificos(wrapper, b) {
    const box = document.createElement('div');
    box.className = 'rm-ctl-texto';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '12px';

    const estiloAtivo = (this.doc.estilos || []).find(e => e.id === b.estiloId) || this.doc.estilos?.[0] || {};

    // 1. TÍTULO / SUBTÍTULO
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
      const alinAtivo = b.alinhamento || estiloAtivo.alinhamento || 'esquerda';
      const corAtiva = b.cor || estiloAtivo.cor || '#1F2733';
      const fonteAtiva = b.fonte || '';

      box.innerHTML = `
        <label style="font:700 12px var(--glx-font);">Texto do Título
          <input type="text" id="rmCampoTexto" class="glx-input" style="width:100%; margin-top:4px;" value="${b.texto || ''}">
        </label>
        <div class="rm-linha2">
          <label style="font:700 12px var(--glx-font);">Nível
            <select id="rmCampoNivel" class="glx-select" style="width:100%; margin-top:4px;">
              <option value="1" ${b.nivel === 1 ? 'selected' : ''}>1 (Seção Primária)</option>
              <option value="2" ${b.nivel === 2 ? 'selected' : ''}>2 (Subseção)</option>
              <option value="3" ${b.nivel === 3 ? 'selected' : ''}>3 (Sub-subseção)</option>
            </select>
          </label>
          <label style="font:700 12px var(--glx-font);">Estilo Tipográfico
            <select id="rmCampoEstilo" class="glx-select" style="width:100%; margin-top:4px;">
              ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
            </select>
          </label>
        </div>

        <!-- FORMATO: 7 Modos de Alinhamento com Ícones e Dicas da Última Linha -->
        <div>
          <span style="display:block; font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--glx-muted, #6B7585); margin-bottom:6px;">
            Formato
          </span>
          <div class="rm-icg" style="display:flex; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:999px; padding:3px; gap:2px; justify-content:space-between;">
            <button type="button" class="rm-ic-bt ${alinAtivo === 'esquerda' ? 'on' : ''}" data-alin="esquerda" title="Alinhar à esquerda: primeira e última linhas à esquerda">
              ${svgIcone('alinhamento_esq', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'centro' ? 'on' : ''}" data-alin="centro" title="Centralizado: todo o texto centralizado">
              ${svgIcone('alinhamento_cen', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'direita' ? 'on' : ''}" data-alin="direita" title="Alinhar à direita: todo o texto alinhado à direita">
              ${svgIcone('alinhamento_dir', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado' ? 'on' : ''}" data-alin="justificado" title="Justificado total: todas as linhas preenchem toda a largura">
              ${svgIcone('alinhamento_jus', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_esquerda' ? 'on' : ''}" data-alin="justificado_esquerda" title="Justificado com a última linha à esquerda (padrão editorial)">
              ${svgIcone('alinhamento_jus_esq', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_centro' ? 'on' : ''}" data-alin="justificado_centro" title="Justificado com a última linha centralizada">
              ${svgIcone('alinhamento_jus_cen', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_direita' ? 'on' : ''}" data-alin="justificado_direita" title="Justificado com a última linha à direita">
              ${svgIcone('alinhamento_jus_dir', 16)}
            </button>
          </div>
        </div>

        <!-- Fonte -->
        <label style="font:700 12px var(--glx-font);">Fonte
          <select id="rmCampoFonte" class="glx-select" style="width:100%; margin-top:4px;">
            <option value="" ${!fonteAtiva ? 'selected' : ''}>Do estilo (${FONTES_SISTEMA[estiloAtivo.fonte]?.rotulo || 'Nunito'})</option>
            ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}" ${fonteAtiva === f.id ? 'selected' : ''}>${f.rotulo}</option>`).join('')}
          </select>
        </label>

        <!-- COR DO TEXTO (Linha única estrita) -->
        <div>
          <span style="display:block; font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--glx-muted, #6B7585); margin-bottom:6px;">
            Cor do texto
          </span>
          <div style="display:flex; align-items:center; justify-content:flex-start; gap:8px;">
            <label class="rm-cor-linha-badge" style="position:relative; cursor:pointer; padding:4px 10px; border-radius:999px; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); margin:0;">
              <span id="rmCorSwatch" style="width:18px; height:18px; border-radius:50%; background:${corAtiva}; border:1px solid rgba(0,0,0,0.18); display:inline-block; flex:none;"></span>
              <span style="font-size:11.5px; font-weight:700; color:var(--ath-text, #1F2733);" id="rmCorStatus">${b.cor ? 'personalizada' : 'do estilo'}</span>
              <input type="color" id="rmCampoCor" value="${corAtiva.startsWith('#') ? corAtiva : '#1F2733'}" style="position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;">
            </label>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="rmBtnCorEstilo" style="white-space:nowrap !important; flex:none !important; flex-shrink:0 !important; font-size:11px;" title="Restaurar cor padrão do estilo">
              Usar do estilo
            </button>
          </div>
        </div>

        <label class="rm-chk" style="font-size:12px; margin-top:4px;">
          <input type="checkbox" id="rmCampoManter" ${b.manterComProximo ? 'checked' : ''}>
          Manter título com o parágrafo seguinte (evitar órfão)
        </label>
      `;

      box.querySelector('#rmCampoTexto').addEventListener('input', e => { b.texto = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmCampoNivel').addEventListener('change', e => { b.nivel = parseInt(e.target.value, 10); this.notificarMudanca(); });
      box.querySelector('#rmCampoEstilo').addEventListener('change', e => { b.estiloId = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmCampoFonte').addEventListener('change', e => { b.fonte = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmCampoManter').addEventListener('change', e => { b.manterComProximo = e.target.checked; this.notificarMudanca(); });

      box.querySelectorAll('[data-alin]').forEach(btn => {
        btn.addEventListener('click', () => {
          b.alinhamento = btn.dataset.alin;
          box.querySelectorAll('[data-alin]').forEach(el => el.classList.remove('on'));
          btn.classList.add('on');
          this.notificarMudanca();
        });
      });

      const inpCor = box.querySelector('#rmCampoCor');
      const swatchCor = box.querySelector('#rmCorSwatch');
      const statusCor = box.querySelector('#rmCorStatus');
      const btnCorEstilo = box.querySelector('#rmBtnCorEstilo');

      inpCor.addEventListener('input', e => {
        b.cor = e.target.value;
        swatchCor.style.background = b.cor;
        statusCor.textContent = 'personalizada';
        this.notificarMudanca();
      });

      btnCorEstilo.addEventListener('click', () => {
        delete b.cor;
        const cEst = estiloAtivo.cor || '#1F2733';
        swatchCor.style.background = cEst;
        inpCor.value = cEst.startsWith('#') ? cEst : '#1F2733';
        statusCor.textContent = 'do estilo';
        this.notificarMudanca();
      });
    }

    // 2. PARÁGRAFO / TEXTO CORPO COM CONTROLES COMPLETOS (DESIGN SOFT UI)
    else if (b.tipo === 'paragrafo' || b.tipo === 'citacao') {
      const alinAtivo = b.alinhamento || estiloAtivo.alinhamento || 'esquerda';
      const corAtiva = b.cor || estiloAtivo.cor || '#1F2733';
      const fonteAtiva = b.fonte || '';
      const temOverride = Boolean(
        b.alinhamento || b.fonte || b.cor || b.fundo_ativo || b.borda_tipo || b.marcador_tipo ||
        b.entrelinha || b.espaco_antes_pt !== undefined || b.espaco_depois_pt !== undefined ||
        b.recuo_primeira_linha_mm !== undefined || b.recuo_esquerdo_mm !== undefined ||
        b.recuo_direito_mm !== undefined || b.espacamento_letras_em !== undefined ||
        b.espacamento_palavras_em !== undefined
      );

      box.innerHTML = `
        <!-- Estilo de texto -->
        <label style="font:700 12px var(--glx-font);">Estilo de texto
          <select id="rmCampoEstilo" class="glx-select" style="width:100%; margin-top:4px;">
            ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
          </select>
        </label>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:-6px; margin-bottom:2px;">
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAplicarEstiloBloco" style="flex:1;" title="Aplicar este estilo a todo o texto do bloco">
            Aplicar ao bloco todo
          </button>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAplicarEstiloTrecho" style="flex:1;" title="Aplicar estilo apenas ao trecho selecionado">
            Aplicar ao trecho
          </button>
        </div>

        <!-- FORMATO: 7 Modos de Alinhamento com Ícones e Dicas da Última Linha -->
        <div>
          <span style="display:block; font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--glx-muted, #6B7585); margin-bottom:6px;">
            Formato
          </span>
          <div class="rm-icg" style="display:flex; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:999px; padding:3px; gap:2px; justify-content:space-between;">
            <button type="button" class="rm-ic-bt ${alinAtivo === 'esquerda' ? 'on' : ''}" data-alin="esquerda" title="Alinhar à esquerda: primeira e última linhas à esquerda">
              ${svgIcone('alinhamento_esq', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'centro' ? 'on' : ''}" data-alin="centro" title="Centralizado: todo o texto centralizado">
              ${svgIcone('alinhamento_cen', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'direita' ? 'on' : ''}" data-alin="direita" title="Alinhar à direita: todo o texto alinhado à direita">
              ${svgIcone('alinhamento_dir', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado' ? 'on' : ''}" data-alin="justificado" title="Justificado total: todas as linhas preenchem toda a largura">
              ${svgIcone('alinhamento_jus', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_esquerda' ? 'on' : ''}" data-alin="justificado_esquerda" title="Justificado com a última linha à esquerda (padrão ABNT e editorial)">
              ${svgIcone('alinhamento_jus_esq', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_centro' ? 'on' : ''}" data-alin="justificado_centro" title="Justificado com a última linha centralizada (subtítulos e citações)">
              ${svgIcone('alinhamento_jus_cen', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${alinAtivo === 'justificado_direita' ? 'on' : ''}" data-alin="justificado_direita" title="Justificado com a última linha à direita (dedicatórias e notas)">
              ${svgIcone('alinhamento_jus_dir', 16)}
            </button>
          </div>
        </div>

        <!-- Fonte -->
        <label style="font:700 12px var(--glx-font);">Fonte
          <select id="rmCampoFonte" class="glx-select" style="width:100%; margin-top:4px;">
            <option value="" ${!fonteAtiva ? 'selected' : ''}>Do estilo (${FONTES_SISTEMA[estiloAtivo.fonte]?.rotulo || 'Nunito'})</option>
            ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}" ${fonteAtiva === f.id ? 'selected' : ''}>${f.rotulo}</option>`).join('')}
          </select>
        </label>

        <!-- COR DO TEXTO (Linha única estrita) -->
        <div>
          <span style="display:block; font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--glx-muted, #6B7585); margin-bottom:6px;">
            Cor do texto
          </span>
          <div style="display:flex; align-items:center; justify-content:flex-start; gap:8px;">
            <label class="rm-cor-linha-badge" style="position:relative; cursor:pointer; padding:4px 10px; border-radius:999px; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); margin:0;">
              <span id="rmCorSwatch" style="width:18px; height:18px; border-radius:50%; background:${corAtiva}; border:1px solid rgba(0,0,0,0.18); display:inline-block; flex:none;"></span>
              <span style="font-size:11.5px; font-weight:700; color:var(--ath-text, #1F2733);" id="rmCorStatus">${b.cor ? 'personalizada' : 'do estilo'}</span>
              <input type="color" id="rmCampoCor" value="${corAtiva.startsWith('#') ? corAtiva : '#1F2733'}" style="position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;">
            </label>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="rmBtnCorEstilo" style="white-space:nowrap !important; flex:none !important; flex-shrink:0 !important; font-size:11px;" title="Restaurar cor padrão do estilo">
              Usar do estilo
            </button>
          </div>
        </div>

        <!-- Fundo atrás do texto -->
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <label class="rm-chk" style="font-size:12.5px;">
            <input type="checkbox" id="rmCampoFundoAtivo" ${b.fundo_ativo ? 'checked' : ''}>
            Fundo atrás do texto
          </label>
          <input type="color" id="rmCampoFundoCor" value="${b.fundo_cor || '#FFF2A8'}" style="width:28px; height:24px; border:none; background:none; cursor:pointer; display:${b.fundo_ativo ? 'block' : 'none'};">
        </div>

        <!-- Bordas / Linhas de destaque -->
        <div>
          <div class="rm-icg" style="display:inline-flex; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:999px; padding:3px; gap:2px;">
            <button type="button" class="rm-ic-bt ${(!b.borda_tipo || b.borda_tipo === 'sem') ? 'on' : ''}" data-borda="sem" title="Sem borda / padrão">
              ${svgIcone('borda_sem', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${b.borda_tipo === 'tachado' ? 'on' : ''}" data-borda="tachado" title="Linha média / tachado">
              ${svgIcone('borda_tachado', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${b.borda_tipo === 'inferior' ? 'on' : ''}" data-borda="inferior" title="Linha inferior / sublinhado de destaque">
              ${svgIcone('borda_inferior', 16)}
            </button>
          </div>
        </div>

        <!-- MARCADOR -->
        <div>
          <span style="display:block; font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--glx-muted, #6B7585); margin-bottom:6px;">
            Marcador
          </span>
          <div class="rm-icg" style="display:inline-flex; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:999px; padding:3px; gap:2px;">
            <button type="button" class="rm-ic-bt ${b.marcador_tipo === 'circulo' ? 'on' : ''}" data-marcador="circulo" title="Círculo sólido">
              ${svgIcone('marcador_circulo', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${b.marcador_tipo === 'ponto_traco' ? 'on' : ''}" data-marcador="ponto_traco" title="Ponto-traço">
              ${svgIcone('marcador_ponto_traco', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${b.marcador_tipo === 'traco' ? 'on' : ''}" data-marcador="traco" title="Traço">
              ${svgIcone('marcador_traco', 16)}
            </button>
            <button type="button" class="rm-ic-bt ${b.marcador_tipo === 'numero' ? 'on' : ''}" data-marcador="numero" title="Numeração">
              ${svgIcone('marcador_numero', 16)}
            </button>
          </div>
        </div>

        
        <!-- Divisão do Bloco de Texto -->
        <div style="margin-top:6px;">
          <button type="button" class="glx-btn glx-btn-sm glx-btn-secondary" id="athBtnDividirBlocoProps" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;" title="Dividir este bloco de texto em dois na posição atual do cursor ou ao meio">
            ${svgIcone('divisor', 14)} Dividir Bloco de Texto
          </button>
        </div>

        <!-- Avançado: Entrelinha, Espaçamentos e Recuos -->
        <details class="rm-sec" style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px; padding:8px 10px; margin-top:4px;">
          <summary style="font:700 11.5px var(--glx-font); cursor:pointer; color:var(--ath-primary, #314F79);">
            Espaçamentos e Recuos do Parágrafo
          </summary>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
            <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <label style="font-size:11px; color:var(--glx-muted);">Entrelinha
                <input type="number" id="rmCampoEntrelinha" class="glx-input" style="width:100%;" min="0.8" max="3.0" step="0.05" value="${b.entrelinha || estiloAtivo.entrelinha || 1.5}">
              </label>
              <label style="font-size:11px; color:var(--glx-muted);">Tracking (letras em)
                <input type="number" id="rmCampoTracking" class="glx-input" style="width:100%;" min="-0.1" max="0.5" step="0.01" value="${b.espacamento_letras_em || estiloAtivo.espacamento_letras_em || 0}">
              </label>
            </div>
            <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <label style="font-size:11px; color:var(--glx-muted);">Espaço antes (pt)
                <input type="number" id="rmCampoEspacoAntes" class="glx-input" style="width:100%;" min="0" max="72" value="${b.espaco_antes_pt ?? estiloAtivo.espaco_antes_pt ?? 0}">
              </label>
              <label style="font-size:11px; color:var(--glx-muted);">Espaço depois (pt)
                <input type="number" id="rmCampoEspacoDepois" class="glx-input" style="width:100%;" min="0" max="72" value="${b.espaco_depois_pt ?? estiloAtivo.espaco_depois_pt ?? 6}">
              </label>
            </div>
            <div class="ath-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <label style="font-size:11px; color:var(--glx-muted);">Recuo 1ª linha (mm)
                <input type="number" id="rmCampoRecuo1" class="glx-input" style="width:100%;" min="0" max="50" value="${b.recuo_primeira_linha_mm ?? estiloAtivo.recuo_primeira_linha_mm ?? 0}">
              </label>
              <label style="font-size:11px; color:var(--glx-muted);">Recuo esquerdo (mm)
                <input type="number" id="rmCampoRecuoEsq" class="glx-input" style="width:100%;" min="0" max="100" value="${b.recuo_esquerdo_mm ?? estiloAtivo.recuo_esquerdo_mm ?? 0}">
              </label>
            </div>
          </div>
        </details>

        <!-- Indicador de Override Local e Redefinição do Estilo -->
        <div id="rmBoxOverrideStatus" style="display:${temOverride ? 'flex' : 'none'}; flex-direction:column; gap:6px; padding:10px; border-radius:8px; background:var(--ath-primary-soft, #EEF4FA); border:1px solid var(--ath-primary-line, #C8D7E6); margin-top:4px;">
          <span style="font:700 11.5px var(--glx-font); color:var(--ath-primary-ink, #1B2D47);">
            ⚠️ Formatação local diferente do estilo
          </span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="glx-btn glx-btn-sm glx-btn-primary" id="rmBtnRedefinirEstilo" style="flex:1; font-size:11px;" title="Atualiza o estilo com estas propriedades para todos os blocos">
              Redefinir estilo
            </button>
            <button type="button" class="glx-btn glx-btn-sm glx-btn-soft" id="rmBtnLimparOverride" style="flex:1; font-size:11px;" title="Remove ajustes locais e volta 100% ao estilo">
              Limpar ajustes
            </button>
          </div>
        </div>
      `;

      // Event Listeners
      box.querySelector('#rmCampoEstilo').addEventListener('change', e => {
        b.estiloId = e.target.value;
        this.notificarMudanca();
        this.renderizar();
      });

      // Alinhamento
      box.querySelectorAll('[data-alin]').forEach(btn => {
        btn.addEventListener('click', () => {
          b.alinhamento = btn.dataset.alin;
          this.notificarMudanca();
          this.renderizar();
        });
      });

      // Fonte
      box.querySelector('#rmCampoFonte').addEventListener('change', e => {
        if (e.target.value) {
          b.fonte = e.target.value;
        } else {
          delete b.fonte;
        }
        this.notificarMudanca();
        this.renderizar();
      });

      // Cor do Texto
      const inpCor = box.querySelector('#rmCampoCor');
      box.querySelector('#rmCorSwatch').parentElement.addEventListener('click', () => {
        inpCor.click();
      });
      inpCor.addEventListener('input', e => {
        b.cor = e.target.value;
        box.querySelector('#rmCorSwatch').style.backgroundColor = b.cor;
        box.querySelector('#rmCorStatus').textContent = 'personalizada';
        this.notificarMudanca();
      });

      box.querySelector('#rmBtnCorEstilo').addEventListener('click', () => {
        delete b.cor;
        this.notificarMudanca();
        this.renderizar();
      });

      // Fundo
      const chkFundo = box.querySelector('#rmCampoFundoAtivo');
      const inpFundoCor = box.querySelector('#rmCampoFundoCor');
      chkFundo.addEventListener('change', () => {
        b.fundo_ativo = chkFundo.checked;
        if (b.fundo_ativo && !b.fundo_cor) b.fundo_cor = '#FFF2A8';
        inpFundoCor.style.display = b.fundo_ativo ? 'block' : 'none';
        this.notificarMudanca();
      });
      inpFundoCor.addEventListener('input', e => {
        b.fundo_cor = e.target.value;
        this.notificarMudanca();
      });

      // Bordas
      box.querySelectorAll('[data-borda]').forEach(btn => {
        btn.addEventListener('click', () => {
          b.borda_tipo = btn.dataset.borda;
          this.notificarMudanca();
          this.renderizar();
        });
      });

      // Marcadores
      box.querySelector('#athBtnDividirBlocoProps')?.addEventListener('click', () => {
        this.onDividirBloco(b);
      });

      box.querySelectorAll('[data-marcador]').forEach(btn => {
        btn.addEventListener('click', () => {
          b.marcador_tipo = b.marcador_tipo === btn.dataset.marcador ? null : btn.dataset.marcador;
          this.notificarMudanca();
          this.renderizar();
        });
      });

      // Avançado
      box.querySelector('#rmCampoEntrelinha').addEventListener('input', e => {
        b.entrelinha = parseFloat(e.target.value) || 1.5;
        this.notificarMudanca();
      });
      box.querySelector('#rmCampoTracking').addEventListener('input', e => {
        b.espacamento_letras_em = parseFloat(e.target.value) || 0;
        this.notificarMudanca();
      });
      box.querySelector('#rmCampoEspacoAntes').addEventListener('input', e => {
        b.espaco_antes_pt = parseFloat(e.target.value) || 0;
        this.notificarMudanca();
      });
      box.querySelector('#rmCampoEspacoDepois').addEventListener('input', e => {
        b.espaco_depois_pt = parseFloat(e.target.value) || 0;
        this.notificarMudanca();
      });
      box.querySelector('#rmCampoRecuo1').addEventListener('input', e => {
        b.recuo_primeira_linha_mm = parseFloat(e.target.value) || 0;
        this.notificarMudanca();
      });
      box.querySelector('#rmCampoRecuoEsq').addEventListener('input', e => {
        b.recuo_esquerdo_mm = parseFloat(e.target.value) || 0;
        this.notificarMudanca();
      });

      // Botão Redefinir Estilo a partir da Seleção
      const btnRedefinir = box.querySelector('#rmBtnRedefinirEstilo');
      if (btnRedefinir) {
        btnRedefinir.addEventListener('click', () => {
          if (b.alinhamento) estiloAtivo.alinhamento = b.alinhamento;
          if (b.fonte) estiloAtivo.fonte = b.fonte;
          if (b.cor) estiloAtivo.cor = b.cor;
          if (b.entrelinha) estiloAtivo.entrelinha = b.entrelinha;
          if (b.espaco_antes_pt !== undefined) estiloAtivo.espaco_antes_pt = b.espaco_antes_pt;
          if (b.espaco_depois_pt !== undefined) estiloAtivo.espaco_depois_pt = b.espaco_depois_pt;
          if (b.recuo_primeira_linha_mm !== undefined) estiloAtivo.recuo_primeira_linha_mm = b.recuo_primeira_linha_mm;
          if (b.recuo_esquerdo_mm !== undefined) estiloAtivo.recuo_esquerdo_mm = b.recuo_esquerdo_mm;
          if (b.espacamento_letras_em !== undefined) estiloAtivo.espacamento_letras_em = b.espacamento_letras_em;

          // Limpa overrides do bloco
          delete b.alinhamento;
          delete b.fonte;
          delete b.cor;
          delete b.entrelinha;
          delete b.espaco_antes_pt;
          delete b.espaco_depois_pt;
          delete b.recuo_primeira_linha_mm;
          delete b.recuo_esquerdo_mm;
          delete b.espacamento_letras_em;

          this.notificarMudanca();
          this.renderizar();
        });
      }

      // Botão Limpar Formatação Local
      const btnLimpar = box.querySelector('#rmBtnLimparOverride');
      if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
          delete b.alinhamento;
          delete b.fonte;
          delete b.cor;
          delete b.fundo_ativo;
          delete b.fundo_cor;
          delete b.borda_tipo;
          delete b.marcador_tipo;
          delete b.entrelinha;
          delete b.espaco_antes_pt;
          delete b.espaco_depois_pt;
          delete b.recuo_primeira_linha_mm;
          delete b.recuo_esquerdo_mm;
          delete b.recuo_direito_mm;
          delete b.espacamento_letras_em;
          delete b.espacamento_palavras_em;

          this.notificarMudanca();
          this.renderizar();
        });
      }
    }

    // 3. FIGURA (BLOCO COMPOSTO COM MULTI-ITENS)
    else if (b.tipo === 'figura' || b.tipo === 'imagem') {
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Personalizar...
          </button>
        </div>
        <label>Identificação / Título
          <input type="text" id="rmFigTitulo" value="${b.titulo || ''}">
        </label>
        <label>Disposição das Imagens (Layout)
          <select id="rmFigLayout" class="glx-select">
            <option value="1" ${b.layout === '1' ? 'selected' : ''}>1 Imagem individual</option>
            <option value="2_lado" ${b.layout === '2_lado' ? 'selected' : ''}>2 Imagens lado a lado (50% / 50%)</option>
            <option value="2_empilhado" ${b.layout === '2_empilhado' ? 'selected' : ''}>2 Imagens empilhadas</option>
            <option value="3_linha" ${b.layout === '3_linha' ? 'selected' : ''}>3 Imagens em linha (33% cada)</option>
            <option value="3_misto" ${b.layout === '3_misto' ? 'selected' : ''}>3 Imagens (1 destaque + 2 menores)</option>
            <option value="4_grade" ${b.layout === '4_grade' ? 'selected' : ''}>4 Imagens em grade (2 × 2)</option>
            <option value="6_grade" ${b.layout === '6_grade' ? 'selected' : ''}>6 Imagens em grade (2 × 3)</option>
          </select>
        </label>
        <label>Legenda Geral
          <textarea id="rmFigLegenda" rows="2">${b.legenda_geral || b.legenda || ''}</textarea>
        </label>
        <label>Fonte / Atribuição
          <input type="text" id="rmFigFonte" value="${b.fonte || 'Fonte: Autores (2026).'}">
        </label>
      `;

      box.querySelector('#athBtnConfigLayoutBloco')?.addEventListener('click', () => {
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.notificarMudancaEstrutural();
          }
        });
      });
      box.querySelector('#rmFigTitulo').addEventListener('input', e => { b.titulo = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmFigLayout').addEventListener('change', e => { b.layout = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmFigLegenda').addEventListener('input', e => { b.legenda_geral = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmFigFonte').addEventListener('input', e => { b.fonte = e.target.value; this.notificarMudanca(); });
    }

    // 4. MAPA (BLOCO COMPOSTO CARTOGRÁFICO)
    else if (b.tipo === 'mapa') {
      box.innerHTML = `
        <label>Identificação / Título
          <input type="text" id="rmMapaTitulo" value="${b.titulo || ''}">
        </label>
        <div class="rm-linha2">
          <label>Escala Nominal
            <input type="text" id="rmMapaEscala" value="${b.escala || '1:10.000'}">
          </label>
          <label class="rm-chk" style="margin-top:22px;">
            <input type="checkbox" id="rmMapaNorte" ${b.orientacao_norte ? 'checked' : ''}>
            Mostrar Norte
          </label>
        </div>
        <label>Legenda Cartográfica
          <textarea id="rmMapaLegenda" rows="2">${b.legenda_cartografica || ''}</textarea>
        </label>
        <label>Fonte dos Dados
          <input type="text" id="rmMapaFonte" value="${b.fonte || 'Fonte: Glaux GIS.'}">
        </label>
      `;

      box.querySelector('#rmMapaTitulo').addEventListener('input', e => { b.titulo = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmMapaEscala').addEventListener('input', e => { b.escala = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmMapaNorte').addEventListener('change', e => { b.orientacao_norte = e.target.checked; this.notificarMudanca(); });
      box.querySelector('#rmMapaLegenda').addEventListener('input', e => { b.legenda_cartografica = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmMapaFonte').addEventListener('input', e => { b.fonte = e.target.value; this.notificarMudanca(); });
    }

    // 5. TABELA (ABNT/IBGE - BORDAS VERTICAIS ABERTAS) OU QUADRO (BORDAS FECHADAS)
    else if (b.tipo === 'tabela' || b.tipo === 'quadro') {
      const isQuadro = b.tipo === 'quadro';
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Personalizar...
          </button>
        </div>
        <label>Identificação / Título
          <input type="text" id="rmTabTitulo" value="${b.titulo || ''}">
        </label>
        <div class="rm-linha2">
          <label>Colunas
            <input type="number" id="rmTabCols" min="1" max="10" value="${b.colunas?.length || 3}">
          </label>
          <label>Linhas de Dados
            <input type="number" id="rmTabLins" min="1" max="50" value="${b.linhas?.length || 2}">
          </label>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:8px; font-size:11.5px; color:#475569;">
          <strong>Padrão ${isQuadro ? 'Quadro' : 'Tabela'}:</strong> ${isQuadro ? 'Caixa totalmente fechada por bordas horizontais e verticais.' : 'Norma ABNT/IBGE: laterais verticais abertas (sem bordas nas extremidades).'}
        </div>
        <label>Notas Explicativas
          <textarea id="rmTabNotas" rows="1">${b.notas || ''}</textarea>
        </label>
        <label>Fonte / Atribuição
          <input type="text" id="rmTabFonte" value="${b.fonte || ''}">
        </label>
      `;

      box.querySelector('#athBtnConfigLayoutBloco')?.addEventListener('click', () => {
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.notificarMudancaEstrutural();
          }
        });
      });
      box.querySelector('#rmTabTitulo').addEventListener('input', e => { b.titulo = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmTabNotas').addEventListener('input', e => { b.notas = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmTabFonte').addEventListener('input', e => { b.fonte = e.target.value; this.notificarMudanca(); });
    }

    // 6. FÓRMULA MATEMÁTICA (LATEX E SLOTS)
    else if (b.tipo === 'formula') {
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Personalizar...
          </button>
        </div>
        <label>Expressão Matemática (LaTeX)
          <textarea id="rmFormulaLatex" rows="3" style="font-family:var(--glx-font-mono); font-size:12px;">${b.latex || b.formula || ''}</textarea>
        </label>
        <div class="rm-linha2">
          <label>Número da Equação
            <input type="text" id="rmFormulaNum" value="${b.numero_equacao || b.numero || '(1)'}">
          </label>
          <label>Posição do Número
            <select id="rmFormulaPosNum" class="glx-select">
              <option value="direita" ${(!b.posicao_numero || b.posicao_numero === 'direita') ? 'selected' : ''}>À Direita (Padrão)</option>
              <option value="esquerda" ${b.posicao_numero === 'esquerda' ? 'selected' : ''}>À Esquerda</option>
              <option value="abaixo" ${b.posicao_numero === 'abaixo' ? 'selected' : ''}>Abaixo (Centralizado)</option>
              <option value="oculto" ${b.posicao_numero === 'oculto' ? 'selected' : ''}>Ocultar Número</option>
            </select>
          </label>
        </div>
        <label>Legenda Explicativa ("onde:")
          <textarea id="rmFormulaLegenda" rows="2" placeholder="Ex: onde x é o deslocamento e t é o tempo">${b.legenda_formula || b.legenda || ''}</textarea>
        </label>
      `;

      box.querySelector('#athBtnConfigLayoutBloco')?.addEventListener('click', () => {
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.notificarMudancaEstrutural();
          }
        });
      });
      box.querySelector('#rmFormulaLatex').addEventListener('input', e => {
        b.latex = e.target.value;
        b.formula = b.latex;
        this.notificarMudanca();
      });
      box.querySelector('#rmFormulaNum').addEventListener('input', e => {
        b.numero_equacao = e.target.value;
        b.numero = b.numero_equacao;
        this.notificarMudanca();
      });
      box.querySelector('#rmFormulaPosNum').addEventListener('change', e => {
        b.posicao_numero = e.target.value;
        this.notificarMudanca();
      });
      box.querySelector('#rmFormulaLegenda').addEventListener('input', e => {
        b.legenda_formula = e.target.value;
        b.legenda = b.legenda_formula;
        this.notificarMudanca();
      });
    }

    wrapper.appendChild(box);
  }

  renderizarAjudanteReferencias(wrapper, b) {
    const ajudanteBox = document.createElement('div');
    ajudanteBox.style.marginTop = '14px';
    ajudanteBox.style.paddingTop = '12px';
    ajudanteBox.style.borderTop = '1px solid #E2E8F0';

    ajudanteBox.innerHTML = `
      <span class="rm-rot">REFERÊNCIAS E CITAÇÕES</span>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmBtnInserirZotero" style="width:100%;">
          ${svgIcone('zotero', 15)} Citar Obra da Biblioteca Zotero...
        </button>
      </div>
    `;

    ajudanteBox.querySelector('#rmBtnInserirZotero').addEventListener('click', () => {
      this.onAbrirZotero();
    });

    wrapper.appendChild(ajudanteBox);
  }

  notificarMudanca(estrutural = false) {
    recalcularNumeracaoAutomatica(this.doc);
    this.onAlterado(this.doc, estrutural);
  }
}
