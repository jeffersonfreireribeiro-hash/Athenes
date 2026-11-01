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
  calcularLinhas, linhaDoBloco, moverParaLinha, igualarLinha, LIMITE_BLOCOS_POR_LINHA
} from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';

export class PainelPropriedades {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.blocoSelecionado = null;
    this.paginaSelecionada = null;
    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});

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
      figura: 'Figura / Ilustração',
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
    box.style.gap = '10px';

    // 1. TÍTULO / SUBTÍTULO
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
      box.innerHTML = `
        <label>Texto do Título
          <input type="text" id="rmCampoTexto" value="${b.texto || ''}">
        </label>
        <div class="rm-linha2">
          <label>Nível
            <select id="rmCampoNivel" class="glx-select">
              <option value="1" ${b.nivel === 1 ? 'selected' : ''}>1 (Seção Primária)</option>
              <option value="2" ${b.nivel === 2 ? 'selected' : ''}>2 (Subseção)</option>
              <option value="3" ${b.nivel === 3 ? 'selected' : ''}>3 (Sub-subseção)</option>
            </select>
          </label>
          <label>Estilo Tipográfico
            <select id="rmCampoEstilo" class="glx-select">
              ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="rm-chk">
          <input type="checkbox" id="rmCampoManter" ${b.manterComProximo ? 'checked' : ''}>
          Manter título com o parágrafo seguinte (evitar órfão)
        </label>
      `;

      box.querySelector('#rmCampoTexto').addEventListener('input', e => { b.texto = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmCampoNivel').addEventListener('change', e => { b.nivel = parseInt(e.target.value, 10); this.notificarMudanca(); });
      box.querySelector('#rmCampoEstilo').addEventListener('change', e => { b.estiloId = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmCampoManter').addEventListener('change', e => { b.manterComProximo = e.target.checked; this.notificarMudanca(); });
    }

    // 2. PARÁGRAFO
    else if (b.tipo === 'paragrafo') {
      box.innerHTML = `
        <label>Estilo do Texto
          <select id="rmCampoEstilo" class="glx-select">
            ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
          </select>
        </label>
        <label>Alinhamento
          <div class="rm-icg">
            <button type="button" class="rm-ic-bt ${b.alinhamento === 'esquerda' ? 'on' : ''}" data-alin="esquerda" title="À Esquerda">${svgIcone('alinhamento_esq', 16)}</button>
            <button type="button" class="rm-ic-bt ${b.alinhamento === 'centro' ? 'on' : ''}" data-alin="centro" title="Centralizado">${svgIcone('alinhamento_cen', 16)}</button>
            <button type="button" class="rm-ic-bt ${b.alinhamento === 'direita' ? 'on' : ''}" data-alin="direita" title="À Direita">${svgIcone('alinhamento_dir', 16)}</button>
            <button type="button" class="rm-ic-bt ${b.alinhamento === 'justificado' ? 'on' : ''}" data-alin="justificado" title="Justificado">${svgIcone('alinhamento_jus', 16)}</button>
          </div>
        </label>
      `;

      box.querySelector('#rmCampoEstilo').addEventListener('change', e => { b.estiloId = e.target.value; this.notificarMudanca(); });
      box.querySelectorAll('[data-alin]').forEach(btn => {
        btn.addEventListener('click', () => {
          b.alinhamento = btn.dataset.alin;
          this.notificarMudanca();
        });
      });
    }

    // 3. FIGURA (BLOCO COMPOSTO COM MULTI-ITENS)
    else if (b.tipo === 'figura' || b.tipo === 'imagem') {
      box.innerHTML = `
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

      box.querySelector('#rmTabTitulo').addEventListener('input', e => { b.titulo = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmTabNotas').addEventListener('input', e => { b.notas = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmTabFonte').addEventListener('input', e => { b.fonte = e.target.value; this.notificarMudanca(); });
    }

    // 6. FÓRMULA MATEMÁTICA (LATEX)
    else if (b.tipo === 'formula') {
      box.innerHTML = `
        <label>Expressão Matemática (LaTeX)
          <textarea id="rmFormulaLatex" rows="3" style="font-family:var(--glx-font-mono); font-size:12px;">${b.latex || b.formula || ''}</textarea>
        </label>
        <div class="rm-linha2">
          <label>Número da Equação
            <input type="text" id="rmFormulaNum" value="${b.numero_equacao || b.numero || '(1)'}">
          </label>
          <label>Alinhamento
            <select id="rmFormulaAlin" class="glx-select">
              <option value="centro" ${b.alinhamento === 'centro' ? 'selected' : ''}>Centralizado</option>
              <option value="esquerda" ${b.alinhamento === 'esquerda' ? 'selected' : ''}>À Esquerda</option>
            </select>
          </label>
        </div>
      `;

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
      box.querySelector('#rmFormulaAlin').addEventListener('change', e => {
        b.alinhamento = e.target.value;
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
