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

import { contarUsoDoEstilo, excluirEstilo } from '../core/athenes_estilos.js';
import { secaoAvancadaHtml, ligarCamposAvancados, gravarRascunhoNoEstilo } from './athenes_editor_estilo_modal.js';
import { ptParaMm, mmParaPt, FONTES_SISTEMA, PESOS_FONTE, estiloParaCss, alinhamentoCss, ALINHAMENTOS } from '../core/athenes_estilos.js';
import {
  modeloDaPagina, recalcularNumeracaoAutomatica, resolverReferenciasCruzadas,
  SEPARADORES_LEGENDA, idSeparadorLegenda, ROTULOS_FIGURA, rotuloDaFigura, aplicarNumeracaoNoTitulo, removerPrefixoNumeracaoTitulo,
  obterTextoPuroTitulo, rotuloDoBloco, obterPrefixoNumeracao, obterTituloCompletoComNumeracao,
  calcularLinhas, linhaDoBloco, moverParaLinha, igualarLinha, LIMITE_BLOCOS_POR_LINHA
} from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';
import { sanearHtmlTexto, cssDoEstiloDeTrecho } from '../core/athenes_estilo_exclusivo.js';
import { latexParaHtml } from '../core/athenes_formula.js';
import { FORMATOS_NUMERO_FORMULA, idFormatoNumeroFormula } from '../core/athenes_documento.js';
import { estiloIdDoTitulo } from '../core/athenes_sumario.js';
import { montarPainelSumario } from './athenes_sumario_painel.js';
import { NIVEL_MAX, nivelDe, blocoNumerado, normalizarNumeracaoSecoes, REGEX_NUMERO_MANUAL } from '../core/athenes_sumario.js';
import { ModalLayoutBloco } from './athenes_editor_layout_bloco.js';
import { montarPainelFiguraVisual, montarPainelTipografiaBloco, papeisTipografiaFigura } from './athenes_figura_ui.js';
import { qtdSlotsDoLayout, ajustarItensAoLayout } from '../core/athenes_figura_layout.js';
import { criarSeletorSimbolosMatematica } from './athenes_simbolos_matematica.js';
import { escapeHtml, registrarListenerSelecaoSegura, obterOuRestaurarSelecaoDoBloco } from '../core/athenes_seguranca.js';

function rotuloAlinhamento(id) {
  const map = {
    esquerda: 'Esquerda',
    centro: 'Centro',
    direita: 'Direita',
    justificado: 'Justificado',
    justificado_esquerda: 'Justificado Esq',
    justificado_centro: 'Justificado Cen',
    justificado_direita: 'Justificado Dir'
  };
  return map[id] || 'Esquerda';
}

export class PainelPropriedades {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.blocoSelecionado = null;
    this.paginaSelecionada = null;
    this.estiloSelecionado = null;
    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onDividirBloco = opcoes.onDividirBloco || (() => {});

    registrarListenerSelecaoSegura();
    this.renderizar();
  }

  setDocumento(doc) {
    this.doc = doc;
    this.renderizar();
  }

  /**
   * Estilos presentes no texto do bloco: o do bloco e os dos trechos com estilo próprio (`.ath-estilo-span`).
   * Devolve [] quando só há um (nada a mostrar). Cada item: { id, nome, deBloco, trechos }.
   */
  estilosNoTexto(b) {
    const trechos = new Map();
    for (const m of String(b?.texto || '').matchAll(/data-estilo-id="([^"]+)"/g)) trechos.set(m[1], (trechos.get(m[1]) || 0) + 1);
    const ids = [b?.estiloId, ...trechos.keys()].filter((id, i, a) => id && a.indexOf(id) === i);
    if (ids.length < 2) return [];
    return ids.map(id => ({ id, nome: (this.doc.estilos || []).find(e => e.id === id)?.nome || id, deBloco: id === b.estiloId, trechos: trechos.get(id) || 0 }));
  }

  /** "Estilos neste texto": aparece só quando o bloco mistura mais de um estilo de texto. */
  htmlEstilosNoTexto(b) {
    const lista = this.estilosNoTexto(b);
    if (!lista.length) return '';
    return `<div id="athEstilosNoTexto" style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:8px 10px; background:var(--ath-primary-soft, #EEF4FA); display:flex; flex-direction:column; gap:6px;">
          <span style="font:800 10.5px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--ath-primary, #314F79);">Estilos neste texto (${lista.length})</span>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${lista.map(x => `<button type="button" class="glx-btn glx-btn-xs glx-btn-soft" data-estilo-no-texto="${escapeHtml(x.id)}" title="Abrir o estilo ${escapeHtml(x.nome)}" style="display:inline-flex; align-items:center; gap:5px; height:24px; padding:0 8px; font-weight:700; background:#fff; border:1px solid #CBD5E1;">${escapeHtml(x.nome)}<small style="font-weight:600; color:#64748B;">${x.deBloco ? 'bloco' : `${x.trechos} trecho${x.trechos > 1 ? 's' : ''}`}</small></button>`).join('')}
          </div>
        </div>`;
  }

  setEstilo(estilo) {
    this.estiloSelecionado = estilo;
    this.blocoSelecionado = null;
    this.paginaSelecionada = null;
    this.renderizar();
  }

  setSelecao(bloco, pagina) {
    this.blocoSelecionado = bloco;
    this.paginaSelecionada = pagina;
    this.estiloSelecionado = null;
    this.renderizar();
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'rm-props';

    if (this.estiloSelecionado) {
      this.renderizarEditorEstilo(wrapper, this.estiloSelecionado);
      this.container.appendChild(wrapper);
      return;
    }

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
      texto: 'Texto / Parágrafo',
      citacao: 'Citação Direta Longa',
      lista: 'Lista Estruturada',
      tabela: 'Tabela (ABNT/IBGE)',
      quadro: 'Quadro Estruturado',
      figura: `${ROTULOS_FIGURA[b.subtipo] || 'Figura'} (ilustração)`,
      imagem: 'Figura / Imagem',
      mapa: 'Mapa Territorial',
      formula: 'Fórmula Matemática',
      campos: 'Campos (rótulo e valor)',
      nota: 'Nota de Rodapé',
      divisor: 'Divisor de Seção',
      espaco: 'Espaçamento Vertical',
      quebra_pagina: 'Quebra de Página',
      sumario: 'Sumário Automático',
      referencias: 'Referências Bibliográficas'
    }[b.tipo] || String(b.tipo || 'BLOCO').toUpperCase();

    // 1. Cabeçalho do Bloco
    const topo = document.createElement('div');
    topo.style.display = 'flex';
    topo.style.justifyContent = 'space-between';
    topo.style.alignItems = 'center';
    topo.style.marginBottom = '6px';
    topo.innerHTML = `
      <h3 style="margin:0; font:800 15px var(--glx-font);">${escapeHtml(tipoNome)}</h3>
      <span class="rm-selo">${escapeHtml(b.tipo)}</span>
    `;
    wrapper.appendChild(topo);

    const avisosDiagnostico = [];

    // 2. Seção LINHA (Pills 1, 2, 3, 4, +)
    try {
      this.renderizarControleLinha(wrapper, b);
    } catch (err) {
      avisosDiagnostico.push(`Linha (${b.tipo}): ${err.message}`);
    }

    // 3. Seção POSIÇÃO NA FOLHA (4 Cards de Presets + Trilha de 12 Pontos)
    try {
      this.renderizarControleGrade12(wrapper, b);
    } catch (err) {
      avisosDiagnostico.push(`Grade 12 (${b.tipo}): ${err.message}`);
    }

    // 4. Controles Específicos do Bloco
    try {
      this.renderizarCamposEspecificos(wrapper, b);
    } catch (err) {
      avisosDiagnostico.push(`Propriedades (${b.tipo}): ${err.message}`);
    }

    // 5. Inserção de Referências Cruzadas
    try {
      this.renderizarAjudanteReferencias(wrapper, b);
    } catch (err) {
      avisosDiagnostico.push(`Referências (${b.tipo}): ${err.message}`);
    }

    if (avisosDiagnostico.length > 0) {
      const toastAviso = document.createElement('div');
      toastAviso.className = 'ath-props-aviso-diagnostico';
      toastAviso.style.cssText = 'padding:8px 10px; border-radius:8px; background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; font-size:11px; margin-top:8px;';
      toastAviso.innerHTML = `<strong>Aviso de diagnóstico (${escapeHtml(b.tipo)}):</strong> ${escapeHtml(avisosDiagnostico.join(' | '))}`;
      wrapper.appendChild(toastAviso);
    }

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
    // com muitas linhas, só a vizinhança da linha atual vira botão (± DESLOCAMENTO); o resto fica na lista abaixo
    const DESLOCAMENTO = 6;
    const compacto = info.total > 21;
    const de = compacto ? Math.max(1, info.numero - DESLOCAMENTO) : 1;
    const ate = compacto ? Math.min(info.total, info.numero + DESLOCAMENTO) : info.total;
    const reticencias = (qtd, rot) => {
      const r = document.createElement('span');
      r.className = 'rm-ln rm-ln-mais';
      r.textContent = '…';
      r.title = `${qtd} ${qtd === 1 ? 'linha' : 'linhas'} ${rot} (use a lista abaixo)`;
      r.style.cssText = 'display:inline-grid;place-items:center;color:#94A3B8;cursor:default;border-style:dashed;';
      return r;
    };
    if (de > 1) lns.appendChild(reticencias(de - 1, 'antes'));
    for (let i = de; i <= ate; i++) {
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
    if (ate < info.total) lns.appendChild(reticencias(info.total - ate, 'depois'));
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

    if (compacto) {
      const resumo = (linha) => {
        const x = linha[0];
        const txt = String(x.texto || x.titulo || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 26);
        const nomes = { titulo: 'Título', paragrafo: 'Texto', tabela: 'Tabela', figura: 'Figura', imagem: 'Imagem', quadro: 'Quadro', mapa: 'Mapa', formula: 'Fórmula', citacao: 'Citação', lista: 'Lista', sumario: 'Sumário', referencias: 'Referências', quebra_pagina: 'Quebra de página', divisor: 'Divisor', espaco: 'Espaço' };
        return `${nomes[x.tipo] || x.tipo}${txt ? ` — ${txt}` : ''}${linha.length > 1 ? ` (+${linha.length - 1})` : ''}`;
      };
      const wrapSel = document.createElement('label');
      wrapSel.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:8px;font:700 11px var(--glx-font);color:#475569;';
      wrapSel.innerHTML = `Ir para outra linha<select class="glx-select" style="width:100%;">
        <option value="">Escolher entre as ${info.total} linhas…</option>
        ${linhas.map((l, i) => {
          const n = i + 1; const cheia = l.length >= LIMITE_BLOCOS_POR_LINHA && n !== info.numero;
          return `<option value="${n}" ${cheia ? 'disabled' : ''} ${n === info.numero ? 'selected' : ''}>Linha ${n}${n === info.numero ? ' (atual)' : ''} · ${escapeHtml(resumo(l))}${cheia ? ' · cheia' : ''}</option>`;
        }).join('')}
        <option value="${info.total + 1}" ${info.quantidade === 1 ? 'disabled' : ''}>Nova linha ao final</option>
      </select>`;
      wrapSel.querySelector('select').addEventListener('change', (e) => {
        const alvo = parseInt(e.target.value, 10);
        if (alvo && alvo !== info.numero && moverParaLinha(this.doc, b.id, alvo)) this.notificarMudanca(true);
      });
      secLinha.appendChild(wrapSel);
    }

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

    const estilos = this.doc.estilos || [];
    const estiloAtivo = estilos.find(e => e.id === b.estiloId) || estilos[0] || {};

    // 1. TÍTULO / SUBTÍTULO
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
      const estiloDoTitulo = (b.tipo === 'titulo' ? estilos.find(e => e.id === estiloIdDoTitulo(Object.fromEntries(estilos.map(x => [x.id, x])), b)) : null) || estiloAtivo;

      box.innerHTML = `
        <label style="font:700 12px var(--glx-font); width:100%; display:block;">Texto
          <textarea id="rmCampoTexto" class="glx-input" rows="2" style="width:100%; min-height:48px; margin-top:4px; resize:vertical; font-family:var(--glx-font); font-size:12.5px; line-height:1.45; padding:8px 12px; border-radius:12px; box-sizing:border-box;">${escapeHtml(b.texto || '')}</textarea>
        </label>
        <div class="rm-linha2">
          <label style="font:700 12px var(--glx-font);">Nível
            <select id="rmCampoNivel" class="glx-select" style="width:100%; margin-top:4px;">
              ${Array.from({ length: NIVEL_MAX }, (_, i) => `<option value="${i + 1}" ${nivelDe(b) === i + 1 ? 'selected' : ''}>${i + 1} (${['Seção primária', 'Seção secundária', 'Seção terciária', 'Seção quaternária', 'Seção quinária', 'Seção senária', 'Nível 7', 'Nível 8', 'Nível 9'][i]})</option>`).join('')}
            </select>
          </label>
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="font:700 12px var(--glx-font); margin:0;">Estilo</label>
              <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnEditarEstiloDoBloco" title="Abrir o painel completo deste estilo: fonte, entrelinha, recuos, espaçamentos e decorações" style="display:inline-flex; align-items:center; gap:4px; height:24px; padding:0 8px; font-weight:700;">
                ${svgIcone('lapis', 12)} Editar estilo
              </button>
            </div>
            <select id="rmCampoEstilo" class="glx-select" style="width:100%; margin-top:4px;">
              ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
            </select>
          </div>
        </div>

        <label class="rm-chk" style="font-size:12px; margin-top:4px;">
          <input type="checkbox" id="rmCampoManter" ${b.manterComProximo ? 'checked' : ''}>
          Manter título com o parágrafo seguinte (evitar órfão)
        </label>
        ${b.tipo === 'titulo' ? `
        <div style="display:flex; flex-direction:column; gap:8px; padding:10px; border:1px solid #E2E8F0; border-radius:10px; background:#F8FAFC;">
          <strong style="font:800 10.5px var(--glx-font); letter-spacing:.06em; text-transform:uppercase; color:var(--ath-primary,#314F79);">Numeração e sumário</strong>
          <label style="font:700 11px var(--glx-font); color:#475569;">Numeração desta seção
            <select id="rmCampoNumerar" class="glx-select" style="width:100%; margin-top:3px;">
              <option value="" ${b.numerar_secao === undefined ? 'selected' : ''}>Seguir o documento (${normalizarNumeracaoSecoes(this.doc.numeracao_secoes).ativa ? 'automática' : 'manual'})</option>
              <option value="sim" ${b.numerar_secao === true ? 'selected' : ''}>Automática (1.1.1…)</option>
              <option value="nao" ${b.numerar_secao === false ? 'selected' : ''}>Manual / sem número automático</option>
            </select>
          </label>
          <label class="rm-chk" style="font-size:12px;"><input type="checkbox" id="rmCampoNumDoc" ${normalizarNumeracaoSecoes(this.doc.numeracao_secoes).ativa ? 'checked' : ''}> Numerar todas as seções do documento automaticamente</label>
          <label class="rm-chk" style="font-size:12px;"><input type="checkbox" id="rmCampoForaSumario" ${b.ocultar_no_sumario ? 'checked' : ''}> Ocultar este título do sumário</label>
          ${blocoNumerado(this.doc, b) && REGEX_NUMERO_MANUAL.test((b.texto || '').replace(/<[^>]*>/g, '')) ? '<button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="rmBtnTirarNumeroManual">Remover o número digitado à mão no início do texto</button>' : ''}
        </div>` : ''}
      `;

      box.querySelector('#rmCampoTexto').addEventListener('input', e => { b.texto = sanearHtmlTexto(e.target.value); this.notificarMudanca(); });
      box.querySelector('#rmCampoNivel').addEventListener('change', e => {
        b.nivel = parseInt(e.target.value, 10);
        if (/^titulo\d$/.test(b.estiloId || '')) b.estiloId = `titulo${Math.min(6, b.nivel)}`; // o estilo acompanha o nível
        this.notificarMudanca(true);
        this.renderizar?.();
      });
      box.querySelector('#rmCampoNumerar')?.addEventListener('change', e => {
        if (e.target.value === '') delete b.numerar_secao; else b.numerar_secao = e.target.value === 'sim';
        this.notificarMudanca(true); this.renderizar?.();
      });
      box.querySelector('#rmCampoNumDoc')?.addEventListener('change', e => {
        this.doc.numeracao_secoes = normalizarNumeracaoSecoes({ ...(this.doc.numeracao_secoes || {}), ativa: e.target.checked });
        this.notificarMudanca(true); this.renderizar?.();
      });
      box.querySelector('#rmCampoForaSumario')?.addEventListener('change', e => { if (e.target.checked) b.ocultar_no_sumario = true; else delete b.ocultar_no_sumario; this.notificarMudanca(true); });
      box.querySelector('#rmBtnTirarNumeroManual')?.addEventListener('click', () => {
        b.texto = String(b.texto || '').replace(REGEX_NUMERO_MANUAL, '');
        this.notificarMudanca(true); this.renderizar?.();
      });
      box.querySelector('#rmCampoEstilo').addEventListener('change', e => { b.estiloId = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmCampoManter').addEventListener('change', e => { b.manterComProximo = e.target.checked; this.notificarMudanca(); });

      box.querySelector('#athBtnEditarEstiloDoBloco')?.addEventListener('click', () => {
        const est = (this.doc.estilos || []).find(e => e.id === b.estiloId) || this.doc.estilos?.[0];
        if (est) this.setEstilo(est);
      });

      box.querySelectorAll('[data-estilo-no-texto]').forEach(btn => btn.addEventListener('click', () => {
        const est = (this.doc.estilos || []).find(e => e.id === btn.dataset.estiloNoTexto);
        if (est) this.setEstilo(est);
      }));

    }

    // 2. PARÁGRAFO / TEXTO CORPO COM CONTROLES COMPLETOS (DESIGN SOFT UI)
    else if (b.tipo === 'paragrafo' || b.tipo === 'citacao' || b.tipo === 'texto' || b.tipo === 'nota' || b.tipo === 'lista') {

      box.innerHTML = `
        <label style="font:700 12px var(--glx-font); width:100%; display:block;">Texto
          <textarea id="rmCampoTexto" class="glx-input" rows="3" style="width:100%; min-height:56px; margin-top:4px; resize:vertical; font-family:var(--glx-font); font-size:12.5px; line-height:1.45; padding:8px 12px; border-radius:12px; box-sizing:border-box;">${escapeHtml(b.texto || '')}</textarea>
        </label>

        <!-- Estilo de texto -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="font:700 12px var(--glx-font); margin:0;">Estilo de texto</label>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnEditarEstiloDoBloco" title="Abrir o painel completo deste estilo: fonte, entrelinha, recuos, espaçamentos e decorações" style="display:inline-flex; align-items:center; gap:4px; height:24px; padding:0 8px; font-weight:700;">
              ${svgIcone('lapis', 12)} Editar estilo
            </button>
          </div>
          <select id="rmCampoEstilo" class="glx-select" style="width:100%; margin-top:4px;">
            ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
          </select>
        </div>
        ${this.htmlEstilosNoTexto(b)}
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:-6px; margin-bottom:2px;">
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAplicarEstiloBloco" style="flex:1;" title="Aplicar este estilo a todo o texto do bloco">
            Aplicar ao bloco todo
          </button>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAplicarEstiloTrecho" style="flex:1;" title="Aplicar estilo apenas ao trecho selecionado">
            Aplicar ao trecho
          </button>
        </div>

        <!-- Divisão do Bloco de Texto -->
        <div style="margin-top:6px;">
          <button type="button" class="glx-btn glx-btn-sm glx-btn-secondary" id="athBtnDividirBlocoProps" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;" title="Dividir este bloco de texto em dois na posição atual do cursor ou ao meio">
            ${svgIcone('divisor', 14)} Dividir Bloco de Texto
          </button>
        </div>

      `;

      // Event Listeners
      box.querySelector('#rmCampoTexto')?.addEventListener('input', e => {
        b.texto = sanearHtmlTexto(e.target.value);
        this.notificarMudanca();
      });

      box.querySelector('#rmCampoEstilo').addEventListener('change', e => {
        b.estiloId = e.target.value;
        this.notificarMudanca();
        this.renderizar();
      });

      box.querySelector('#athBtnAplicarEstiloBloco')?.addEventListener('click', () => {
        const selId = box.querySelector('#rmCampoEstilo')?.value;
        if (selId) b.estiloId = selId;
        this.notificarMudanca(true);
        this.renderizar();
      });

      box.querySelector('#athBtnAplicarEstiloTrecho')?.addEventListener('click', () => {
        const selId = box.querySelector('#rmCampoEstilo')?.value || b.estiloId;
        const est = estilos.find(e => e.id === selId) || estiloAtivo;
        const selInfo = obterOuRestaurarSelecaoDoBloco(b.id);
        if (selInfo.ok && selInfo.texto.trim() && est) {
          // trecho com estilo cadastrado: guarda só o id do estilo (o CSS vem do estilo, e muda junto com ele)
          const cssInline = cssDoEstiloDeTrecho(est, FONTES_SISTEMA[est.fonte]?.familia || 'inherit').replace(/"/g, "'");
          document.execCommand('insertHTML', false, `<span class="ath-estilo-span" data-estilo-id="${escapeHtml(est.id)}" style="${cssInline}">${escapeHtml(selInfo.texto)}</span>`);
          const elBlocoEditable = document.querySelector(`.ath-bloco-folha[data-bloco-id="${b.id}"] .ath-texto-editable`);
          if (elBlocoEditable) b.texto = sanearHtmlTexto(elBlocoEditable.innerHTML.replace(/<span class="ath-citacao-ref"[^>]*>.*?<\/span>/g, ''));
          this.notificarMudanca();
        } else if (selId) {
          b.estiloId = selId;
          this.notificarMudanca(true);
          this.renderizar();
        }
      });

      box.querySelector('#athBtnEditarEstiloDoBloco')?.addEventListener('click', () => {
        const est = (this.doc.estilos || []).find(e => e.id === b.estiloId) || this.doc.estilos?.[0];
        if (est) this.setEstilo(est);
      });

      // (marcadores, numeração, alinhamento, fonte, cor, fundo, borda, espaços e recuos pertencem ao Estilo de Texto)
      box.querySelector('#athBtnDividirBlocoProps')?.addEventListener('click', () => {
        this.onDividirBloco(b);
      });

    }

    // 3. FIGURA (BLOCO COMPOSTO COM MULTI-ITENS, SLOTS, ENQUADRAMENTO E TIPOGRAFIA)
    else if (b.tipo === 'figura' || b.tipo === 'imagem') {
      const rotuloAtual = rotuloDaFigura(b);
      const numAtual = b.numero_sequencial || 1;
      const textoPuro = obterTextoPuroTitulo(b);

      // Garante lista de itens de imagem
      ajustarItensAoLayout(b);
      const qtdSlots = qtdSlotsDoLayout(b.layout);

      const estilosTexto = this.doc.estilos || [];

      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Moldura / Subgrade...
          </button>
        </div>

        <!-- Categoria / Subtipo (Prefixo do Elemento) -->
        <label>Prefixo / Tipo do Elemento
          <select id="rmFigSubtipo" class="glx-select">
            <option value="figura" ${(!b.subtipo || b.subtipo === 'figura') ? 'selected' : ''}>Figura (Padrão ABNT)</option>
            <option value="fotografia" ${b.subtipo === 'fotografia' ? 'selected' : ''}>Fotografia</option>
            <option value="grafico" ${b.subtipo === 'grafico' ? 'selected' : ''}>Gráfico</option>
            <option value="diagrama" ${b.subtipo === 'diagrama' ? 'selected' : ''}>Diagrama</option>
            <option value="fluxograma" ${b.subtipo === 'fluxograma' ? 'selected' : ''}>Fluxograma</option>
            <option value="esquema" ${b.subtipo === 'esquema' ? 'selected' : ''}>Esquema</option>
            <option value="croqui" ${b.subtipo === 'croqui' ? 'selected' : ''}>Croqui</option>
            <option value="mapa" ${b.subtipo === 'mapa' ? 'selected' : ''}>Mapa</option>
            <option value="desenho" ${b.subtipo === 'desenho' ? 'selected' : ''}>Desenho</option>
            <option value="ilustracao" ${b.subtipo === 'ilustracao' ? 'selected' : ''}>Ilustração</option>
            <option value="personalizado" ${b.subtipo === 'personalizado' ? 'selected' : ''}>Personalizado...</option>
          </select>
        </label>

        ${b.subtipo === 'personalizado' ? `
          <label style="margin-top:4px;">Prefixo Personalizado
            <input type="text" id="rmFigPrefixoCustom" class="glx-input" value="${escapeHtml(b.prefixo_customizado || '')}" placeholder="Ex: Detalhe, Planta, Corte...">
          </label>
        ` : ''}

        <!-- Identificação / Nome Puro da Ilustração -->
        <label style="margin-top:6px;">Nome / Identificação da Ilustração
          <div style="display:flex; align-items:center; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px; overflow:hidden; background:#fff; margin-top:3px;">
            <span style="background:#EEF4FA; color:var(--ath-primary, #314F79); font:800 11.5px var(--glx-font); padding:6px 10px; border-right:1px solid #CBD5E1; user-select:none; white-space:nowrap;" title="Prefixo e numeração automáticos gerados pela posição no documento">
              ${obterPrefixoNumeracao(b).trimEnd()}
            </span>
            <input type="text" id="rmFigTitulo" value="${escapeHtml(textoPuro)}" placeholder="Escreva apenas o nome da ilustração..." style="border:none; padding:6px 10px; flex:1; outline:none; font-size:12px; margin:0;">
          </div>
          <span style="font-size:10px; color:var(--ath-muted, #64748B); display:block; margin-top:3px;">A numeração é sequencial e automática. Escreva apenas o nome descritivo.</span>
        </label>

        <!-- Disposição, moldura, sombra, enquadramento e posição no documento (seletores gráficos) -->
        <div style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:10px 12px; margin-top:8px; background:#fff;">
          <div style="font:800 11.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; margin-bottom:8px;">Diagramação da Figura</div>
          <div id="athFigPainelVisual"></div>
        </div>

        <!-- Seleção de Arquivos / Imagens por Campo / Slot -->
        <div style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:10px 12px; margin-top:8px; background:#fff;">
          <div style="font:800 11.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <span>Campos de Imagem (${qtdSlots})</span>
            <span style="font-size:10px; color:var(--glx-muted); text-transform:none; font-weight:600;">Upload ou URL</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;" id="athListaSlotsImagem">
            ${b.itens.slice(0, qtdSlots).map((it, idx) => `
              <div class="ath-slot-item" style="border:1px solid #E2E8F0; border-radius:10px; padding:8px 10px; background:#F8FAFC; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                  <strong style="font-size:11.5px; color:#1F2733;">Slot ${idx + 1} (${String.fromCharCode(97 + idx).toUpperCase()})</strong>
                  ${it.url ? `<button type="button" class="rm-ic rm-ic-perigo" data-limpar-slot="${idx}" title="Remover imagem deste campo" style="width:20px; height:20px;">${svgIcone('fechar', 12)}</button>` : ''}
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                  <div style="width:52px; height:52px; border-radius:8px; background:#EFF2F6; border:1px solid #CBD5E1; overflow:hidden; display:grid; place-items:center; flex:none;">
                    ${it.url ? `<img src="${it.url}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="color:#94A3B8; display:inline-flex;">${svgIcone('imagem', 20)}</span>`}
                  </div>
                  <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:5px;">
                    <label class="glx-btn glx-btn-xs glx-btn-soft ath-btn-slot-img" style="cursor:pointer; display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:center !important; gap:6px; height:28px; padding:0 10px; width:100%; box-sizing:border-box; font:700 11.5px var(--glx-font); color:var(--ath-primary, #314F79); border-radius:8px;">
                      <span style="display:inline-flex; align-items:center; flex:none;">${svgIcone('imagem', 14)}</span>
                      <span style="white-space:nowrap;">Escolher Imagem...</span>
                      <input type="file" accept="image/*" data-upload-slot="${idx}" hidden>
                    </label>
                    <input type="text" data-url-slot="${idx}" value="${it.url || ''}" placeholder="Ou cole URL da imagem" style="font-size:11px; height:28px; padding:4px 8px; border-radius:8px; box-sizing:border-box;">
                  </div>
                </div>
                ${qtdSlots > 1 ? `
                  <input type="text" data-subleg-slot="${idx}" value="${it.legenda_sub || ''}" placeholder="Sublegenda deste item (ex: Detalhe B)" style="font-size:11px; height:28px; padding:4px 8px; border-radius:8px; box-sizing:border-box;">
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Textos da figura e tipografia (estilos de texto completos) -->
        <div style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:10px; margin-top:8px; background:#fff;">
          <div style="font:800 11.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; margin-bottom:8px;">
            Legenda e Fonte
          </div>
          <label style="font-weight:700;">Legenda Geral
            <textarea id="rmFigLegenda" rows="2">${b.legenda_geral || b.legenda || ''}</textarea>
          </label>
          <label style="font-weight:700; margin-top:6px;">Fonte / Atribuição
            <input type="text" id="rmFigFonte" value="${b.fonte || 'Fonte: Autores (2026).'}">
          </label>
        </div>

        <div style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:10px 12px; margin-top:8px; background:#fff;">
          <div style="font:800 11.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; margin-bottom:8px;">Tipografia do Texto</div>
          <div id="athFigTipografia"></div>
        </div>
      `;

      box.querySelector('#athBtnConfigLayoutBloco')?.addEventListener('click', () => {
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.notificarMudancaEstrutural();
          }
        });
      });

      box.querySelector('#rmFigSubtipo').addEventListener('change', e => {
        b.subtipo = e.target.value;
        recalcularNumeracaoAutomatica(this.doc);
        this.notificarMudanca();
        this.renderizar();
      });

      box.querySelector('#rmFigPrefixoCustom')?.addEventListener('input', e => {
        b.prefixo_customizado = e.target.value;
        recalcularNumeracaoAutomatica(this.doc);
        this.notificarMudanca();
      });

      this.inserirSeletorSeparador(box, '#rmFigTitulo', b);
      box.querySelector('#rmFigTitulo').addEventListener('input', e => {
        b.titulo = removerPrefixoNumeracaoTitulo(e.target.value);
        this.notificarMudanca();
      });

      montarPainelFiguraVisual(box.querySelector('#athFigPainelVisual'), {
        bloco: b,
        aoAlterar: (chave) => {
          if (chave === 'layout' || chave === 'subrotulo_tipo') {
            // nº de slots ou tipo de rótulo mudou: refaz campos de imagem e papéis de tipografia do inspetor
            this.notificarMudanca();
            this.renderizar();
          } else {
            this.notificarMudanca();
          }
        }
      });

      // Uploads e URLs de Imagem por Slot
      box.querySelectorAll('[data-upload-slot]').forEach(inp => {
        inp.addEventListener('change', e => {
          const idx = parseInt(inp.dataset.uploadSlot, 10);
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            b.itens[idx].url = ev.target.result;
            b.src = b.itens[0]?.url || '';
            this.notificarMudanca();
            this.renderizar();
          };
          reader.readAsDataURL(file);
        });
      });

      box.querySelectorAll('[data-url-slot]').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.urlSlot, 10);
          b.itens[idx].url = inp.value;
          b.src = b.itens[0]?.url || '';
          this.notificarMudanca();
        });
      });

      box.querySelectorAll('[data-subleg-slot]').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.sublegSlot, 10);
          b.itens[idx].legenda_sub = inp.value;
          this.notificarMudanca();
        });
      });

      box.querySelectorAll('[data-limpar-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.limparSlot, 10);
          b.itens[idx].url = '';
          b.src = b.itens[0]?.url || '';
          this.notificarMudanca();
          this.renderizar();
        });
      });

      // Legenda e Fonte
      box.querySelector('#rmFigLegenda')?.addEventListener('input', e => {
        b.legenda_geral = e.target.value;
        this.notificarMudanca();
      });
      box.querySelector('#rmFigFonte')?.addEventListener('input', e => {
        b.fonte = e.target.value;
        this.notificarMudanca();
      });
      montarPainelTipografiaBloco(box.querySelector('#athFigTipografia'), {
        bloco: b,
        estilos: this.doc.estilos || [],
        papeis: papeisTipografiaFigura(b),
        aoAlterar: () => this.notificarMudanca()
      });
    }

    // 4. MAPA (BLOCO COMPOSTO CARTOGRÁFICO)
    else if (b.tipo === 'mapa') {
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Personalizar...
          </button>
        </div>
        <!-- Identificação / Título com Prefixo Estático Intrínseco -->
        <label>Identificação / Título
          <div style="display:flex; align-items:center; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px; overflow:hidden; background:#fff; margin-top:3px;">
            <span style="background:#EEF4FA; color:var(--ath-primary, #314F79); font:800 11.5px var(--glx-font); padding:6px 10px; border-right:1px solid #CBD5E1; user-select:none; white-space:nowrap;">
              ${obterPrefixoNumeracao(b).trimEnd()}
            </span>
            <input type="text" id="rmMapaTitulo" value="${escapeHtml(obterTextoPuroTitulo(b))}" placeholder="Descrição do mapa territorial" style="border:none; padding:6px 10px; flex:1; outline:none; font-size:12px; margin:0;">
          </div>
          <span style="font-size:10px; color:var(--ath-muted, #64748B); display:block; margin-top:3px;">Numeração automática intrínseca à posição.</span>
        </label>
        <div class="rm-linha2">
          <label>Escala Nominal
            <input type="text" id="rmMapaEscala" value="${escapeHtml(b.escala || '1:10.000')}">
          </label>
          <label class="rm-chk" style="margin-top:22px;">
            <input type="checkbox" id="rmMapaNorte" ${b.orientacao_norte ? 'checked' : ''}>
            Mostrar Norte
          </label>
        </div>
        <label>Legenda Cartográfica
          <textarea id="rmMapaLegenda" rows="2">${escapeHtml(b.legenda_cartografica || '')}</textarea>
        </label>
        <label>Fonte dos Dados
          <input type="text" id="rmMapaFonte" value="${escapeHtml(b.fonte || 'Fonte: Glaux GIS.')}">
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
      this.inserirSeletorSeparador(box, '#rmMapaTitulo', b);
      box.querySelector('#rmMapaTitulo').addEventListener('input', e => {
        b.titulo = removerPrefixoNumeracaoTitulo(e.target.value);
        this.notificarMudanca();
      });
      box.querySelector('#rmMapaEscala').addEventListener('input', e => { b.escala = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmMapaNorte').addEventListener('change', e => { b.orientacao_norte = e.target.checked; this.notificarMudanca(); });
      box.querySelector('#rmMapaLegenda').addEventListener('input', e => { b.legenda_cartografica = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmMapaFonte').addEventListener('input', e => { b.fonte = e.target.value; this.notificarMudanca(); });
    }

    // 5. TABELA (ABNT/IBGE - BORDAS VERTICAIS ABERTAS) OU QUADRO (BORDAS FECHADAS)
    else if (b.tipo === 'tabela' || b.tipo === 'quadro') {
      const isQuadro = b.tipo === 'quadro';
      const rotuloTab = isQuadro ? 'Quadro' : 'Tabela';
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Personalizar...
          </button>
        </div>
        <!-- Identificação / Título com Prefixo Estático Intrínseco -->
        <label>Identificação / Título
          <div style="display:flex; align-items:center; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:8px; overflow:hidden; background:#fff; margin-top:3px;">
            <span style="background:#EEF4FA; color:var(--ath-primary, #314F79); font:800 11.5px var(--glx-font); padding:6px 10px; border-right:1px solid #CBD5E1; user-select:none; white-space:nowrap;">
              ${obterPrefixoNumeracao(b).trimEnd()}
            </span>
            <input type="text" id="rmTabTitulo" value="${escapeHtml(obterTextoPuroTitulo(b))}" placeholder="Descrição da ${isQuadro ? 'estrutura' : 'tabela'}" style="border:none; padding:6px 10px; flex:1; outline:none; font-size:12px; margin:0;">
          </div>
          <span style="font-size:10px; color:var(--ath-muted, #64748B); display:block; margin-top:3px;">Numeração automática intrínseca à posição.</span>
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
          <textarea id="rmTabNotas" rows="1">${escapeHtml(b.notas || '')}</textarea>
        </label>
        <label>Fonte / Atribuição
          <input type="text" id="rmTabFonte" value="${escapeHtml(b.fonte || '')}">
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
      this.inserirSeletorSeparador(box, '#rmTabTitulo', b);
      box.querySelector('#rmTabTitulo').addEventListener('input', e => {
        b.titulo = removerPrefixoNumeracaoTitulo(e.target.value);
        this.notificarMudanca();
      });
      box.querySelector('#rmTabCols')?.addEventListener('change', e => {
        const nCols = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 2));
        if (!Array.isArray(b.colunas)) b.colunas = ['Coluna 1', 'Coluna 2'];
        while (b.colunas.length < nCols) b.colunas.push(`Coluna ${b.colunas.length + 1}`);
        if (b.colunas.length > nCols) b.colunas.length = nCols;
        if (!Array.isArray(b.linhas)) b.linhas = [];
        b.linhas.forEach(row => {
          while (row.length < nCols) row.push('—');
          if (row.length > nCols) row.length = nCols;
        });
        this.notificarMudanca();
      });
      box.querySelector('#rmTabLins')?.addEventListener('change', e => {
        const nLins = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 2));
        const nCols = b.colunas?.length || 2;
        if (!Array.isArray(b.linhas)) b.linhas = [];
        while (b.linhas.length < nLins) {
          b.linhas.push(Array.from({ length: nCols }, (_, i) => `Dado ${b.linhas.length + 1}.${i + 1}`));
        }
        if (b.linhas.length > nLins) b.linhas.length = nLins;
        this.notificarMudanca();
      });
      box.querySelector('#rmTabNotas').addEventListener('input', e => { b.notas = e.target.value; this.notificarMudanca(); });
      box.querySelector('#rmTabFonte').addEventListener('input', e => { b.fonte = e.target.value; this.notificarMudanca(); });
    }

    // 6. FÓRMULA MATEMÁTICA (LATEX, PALETA DE SÍMBOLOS E SLOTS)
    else if (b.tipo === 'formula') {
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--ath-primary-line, #C8D7E6);">
          <span style="font-size:11px; font-weight:800; color:var(--ath-primary, #314F79); text-transform:uppercase;">Apresentação e Moldura</span>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfigLayoutBloco" style="display:flex; align-items:center; gap:4px; font-size:11px; white-space:nowrap;">
            ${svgIcone('quadro', 12)} Personalizar...
          </button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
          <label style="font-weight:700; margin:0;">Expressão matemática (LaTeX)</label>
          <span style="font-size:10.5px; color:var(--glx-muted);">Aceita $…$, equation e \label</span>
        </div>

        <!-- Seletor Rico de Símbolos Especiais Matemáticos e Lógicos -->
        <div id="athBoxPaletaSimbolosMat"></div>

        <textarea id="rmFormulaLatex" rows="3" style="font-family:var(--glx-font-mono); font-size:12px;" placeholder="Ex: E = m \\cdot c^2">${escapeHtml(b.latex || b.formula || '')}</textarea>
        <div id="rmFormulaPrevia" style="margin-top:4px; padding:6px 8px; border:1px dashed #CBD5E1; border-radius:6px; font-family:'Cambria Math','Times New Roman',serif; font-size:14px; min-height:20px;">${latexParaHtml(b.latex || b.formula || '')}</div>

        <div class="rm-linha2" style="margin-top:8px;">
          <label>Número (automático: ${escapeHtml(b.numero_equacao || '(1)')})
            <select id="rmFormulaFormato" class="glx-select">
              <option value="" ${!b.formato_numero ? 'selected' : ''}>Padrão do documento (${FORMATOS_NUMERO_FORMULA.find(x => x.id === idFormatoNumeroFormula(this.doc, null)).exemplo})</option>
              ${FORMATOS_NUMERO_FORMULA.map(x => `<option value="${x.id}" ${b.formato_numero === x.id ? 'selected' : ''}>${x.rotulo} — ${x.exemplo}</option>`).join('')}
            </select>
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
        <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="rmFormulaFormatoTodos" style="align-self:flex-start; margin-top:4px;">Usar este formato de número em todo o documento</button>
        <label>Legenda Explicativa ("onde:")
          <textarea id="rmFormulaLegenda" rows="2" placeholder="Ex: onde x é o deslocamento e t é o tempo">${escapeHtml(b.legenda_formula || b.legenda || '')}</textarea>
        </label>
      `;

      const txtLatex = box.querySelector('#rmFormulaLatex');
      const boxPaleta = box.querySelector('#athBoxPaletaSimbolosMat');
      if (boxPaleta) {
        const paleta = criarSeletorSimbolosMatematica(snippet => {
          const start = txtLatex.selectionStart || 0;
          const end = txtLatex.selectionEnd || 0;
          const val = txtLatex.value;
          txtLatex.value = val.substring(0, start) + snippet + val.substring(end);
          txtLatex.selectionStart = txtLatex.selectionEnd = start + snippet.length;
          txtLatex.focus();
          b.latex = txtLatex.value;
          b.formula = b.latex;
          this.notificarMudanca();
        });
        boxPaleta.appendChild(paleta);
      }

      box.querySelector('#athBtnConfigLayoutBloco')?.addEventListener('click', () => {
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.notificarMudancaEstrutural();
          }
        });
      });
      const previa = box.querySelector('#rmFormulaPrevia');
      txtLatex.addEventListener('input', () => {
        b.latex = txtLatex.value;
        b.formula = b.latex;
        previa.innerHTML = latexParaHtml(b.latex);
        this.notificarMudanca();
      });
      box.querySelector('#rmFormulaFormato').addEventListener('change', e => {
        if (e.target.value) b.formato_numero = e.target.value; else delete b.formato_numero;
        this.notificarMudanca(true);
        this.renderizar();
      });
      box.querySelector('#rmFormulaFormatoTodos').addEventListener('click', () => {
        this.doc.formato_numero_formula = idFormatoNumeroFormula(this.doc, b);
        for (const sec of this.doc.secoes || []) for (const x of sec.blocos || []) if (x.tipo === 'formula') delete x.formato_numero;
        this.notificarMudanca(true);
        this.renderizar();
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

    // 7. CAMPOS (RÓTULO E VALOR EM COLUNAS)
    else if (b.tipo === 'campos') {
      if (!Array.isArray(b.itens)) b.itens = [{ rotulo: 'Campo 1', valor: 'Valor 1' }];
      box.innerHTML = `
        <div class="rm-linha2">
          <label>Título do Grupo
            <input type="text" id="rmCamposRotulo" value="${b.rotulo || 'Identificação e Parâmetros'}">
          </label>
          <label>Colunas
            <select id="rmCamposColunas" class="glx-select">
              <option value="1" ${b.colunas === 1 ? 'selected' : ''}>1 Coluna</option>
              <option value="2" ${(!b.colunas || b.colunas === 2) ? 'selected' : ''}>2 Colunas</option>
              <option value="3" ${b.colunas === 3 ? 'selected' : ''}>3 Colunas</option>
              <option value="4" ${b.colunas === 4 ? 'selected' : ''}>4 Colunas</option>
            </select>
          </label>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font:800 11px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase;">Itens (${b.itens.length})</strong>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="rmBtnAddCampoItem">+ Novo Campo</button>
          </div>
          <div id="rmListaCamposItens" style="display:flex; flex-direction:column; gap:6px;">
            ${b.itens.map((it, idx) => `
              <div style="display:grid; grid-template-columns:1fr 1.2fr 24px; gap:6px; align-items:center;">
                <input type="text" data-campo-rot="${idx}" value="${it.rotulo || ''}" placeholder="Rótulo" style="height:28px; font-size:11.5px; padding:2px 8px;">
                <input type="text" data-campo-val="${idx}" value="${it.valor || ''}" placeholder="Valor" style="height:28px; font-size:11.5px; padding:2px 8px;">
                <button type="button" class="rm-ic rm-ic-perigo" data-rem-campo="${idx}" title="Remover item" style="width:22px; height:22px;">${svgIcone('fechar', 12)}</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      box.querySelector('#rmCamposRotulo')?.addEventListener('input', e => {
        b.rotulo = e.target.value;
        this.notificarMudanca();
      });
      box.querySelector('#rmCamposColunas')?.addEventListener('change', e => {
        b.colunas = parseInt(e.target.value, 10) || 2;
        this.notificarMudanca();
      });
      box.querySelector('#rmBtnAddCampoItem')?.addEventListener('click', () => {
        b.itens.push({ rotulo: `Campo ${b.itens.length + 1}`, valor: '—' });
        this.notificarMudanca();
        this.renderizar();
      });
      box.querySelectorAll('[data-campo-rot]').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = parseInt(inp.dataset.campoRot, 10);
          if (b.itens[i]) b.itens[i].rotulo = inp.value;
          this.notificarMudanca();
        });
      });
      box.querySelectorAll('[data-campo-val]').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = parseInt(inp.dataset.campoVal, 10);
          if (b.itens[i]) b.itens[i].valor = inp.value;
          this.notificarMudanca();
        });
      });
      box.querySelectorAll('[data-rem-campo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.remCampo, 10);
          b.itens.splice(i, 1);
          this.notificarMudanca();
          this.renderizar();
        });
      });
    }

    // 8. DIVISOR OU ESPAÇAMENTO OU QUEBRA DE PÁGINA
    else if (b.tipo === 'divisor') {
      box.innerHTML = `
        <label>Estilo da Linha Divisória
          <select id="rmDivisorEstilo" class="glx-select">
            <option value="solida" ${(!b.estilo_linha || b.estilo_linha === 'solida') ? 'selected' : ''}>Linha Sólida Contínua</option>
            <option value="tracejada" ${b.estilo_linha === 'tracejada' ? 'selected' : ''}>Linha Tracejada</option>
            <option value="pontilhada" ${b.estilo_linha === 'pontilhada' ? 'selected' : ''}>Linha Pontilhada</option>
            <option value="dupla" ${b.estilo_linha === 'dupla' ? 'selected' : ''}>Linha Dupla Editorial</option>
          </select>
        </label>
        <label>Espaço Depois (mm)
          <input type="number" id="rmDivisorEspaco" min="0" max="40" step="0.5" value="${ptParaMm(b.espaco_depois_pt ?? 8)}">
        </label>
      `;
      box.querySelector('#rmDivisorEstilo')?.addEventListener('change', e => {
        b.estilo_linha = e.target.value;
        this.notificarMudanca();
      });
      box.querySelector('#rmDivisorEspaco')?.addEventListener('input', e => {
        b.espaco_depois_pt = mmParaPt(parseFloat(e.target.value));
        this.notificarMudanca();
      });
    }
    else if (b.tipo === 'espaco') {
      box.innerHTML = `
        <label>Altura do Espaçamento Vertical (mm)
          <input type="number" id="rmEspacoAltura" min="1" max="85" step="0.5" value="${ptParaMm(b.altura_pt || 24)}">
        </label>
      `;
      box.querySelector('#rmEspacoAltura')?.addEventListener('input', e => {
        b.altura_pt = Math.max(4, mmParaPt(parseFloat(e.target.value)) || 24);
        this.notificarMudanca();
      });
    }
    else if (b.tipo === 'sumario') {
      box.appendChild(montarPainelSumario(this.doc, b, () => this.notificarMudanca(true)));
    }
    else if (b.tipo === 'quebra_pagina') {
      box.innerHTML = `
        <div style="padding:10px 12px; border-radius:10px; background:#EEF4FA; border:1px solid #C8D7E6; font-size:12px; color:#1B2D47;">
          <strong>Quebra de Página Explícita:</strong> força os blocos seguintes desta seção a iniciarem na próxima folha física.
        </div>
      `;
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

  renderizarEditorEstilo(wrapper, est) {
    const rasc = JSON.parse(JSON.stringify(est));
    const alinAtivo = rasc.alinhamento || 'esquerda';
    const corAtiva = rasc.cor || '#1F2733';

    const box = document.createElement('div');
    box.className = 'ath-editor-estilo-painel';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '10px';

    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; padding-bottom:8px; border-bottom:1px solid var(--ath-primary-line, #C8D7E6);">
        <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnVoltarPropsBloco" style="display:inline-flex; align-items:center; gap:4px; font-weight:700; height:24px; padding:0 8px;">
          ${svgIcone('voltar', 12)} Voltar
        </button>
        <strong style="font:800 12px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.05em;">Estilo Tipográfico</strong>
      </div>

      <!-- Preview do Estilo -->
      <div id="athEstiloPreviaPainel" style="background:#fff; border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:12px 14px; box-shadow:0 2px 8px rgba(0,0,0,0.04); min-height:48px; max-height:84px; overflow:hidden;">
        Aa — Texto de exemplo do estilo
      </div>

      <label style="font:700 12px var(--glx-font); width:100%; display:block;">Nome do estilo
        <input type="text" id="athEstiloNome" class="glx-input" style="width:100%; height:34px; margin-top:4px; box-sizing:border-box;" value="${rasc.nome || ''}">
      </label>

      <label style="font:700 12px var(--glx-font); width:100%; display:block;">Fonte
        <select id="athEstiloFonte" class="glx-select" style="width:100%; height:34px; margin-top:4px;">
          ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}" ${f.id === (rasc.fonte || 'nunito') ? 'selected' : ''}>${f.rotulo}</option>`).join('')}
        </select>
      </label>

      <div class="rm-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label style="font:700 12px var(--glx-font);">Tamanho (pt)
          <input type="number" id="athEstiloTamanho" class="glx-input" min="6" max="72" step="0.5" value="${rasc.tamanho_pt || 12}" style="width:100%; height:34px; margin-top:4px; box-sizing:border-box;">
        </label>
        <label style="font:700 12px var(--glx-font);">Peso
          <select id="athEstiloPeso" class="glx-select" style="width:100%; height:34px; margin-top:4px;">
            ${PESOS_FONTE.map(p => `<option value="${p.valor}" ${p.valor === (rasc.peso || 400) ? 'selected' : ''}>${p.rotulo}</option>`).join('')}
          </select>
        </label>
      </div>

      <!-- FORMATO: 7 botões ocupando 100% da largura útil -->
      <div>
        <span style="display:block; font:800 11px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:var(--glx-muted, #6B7585); margin-bottom:6px;">
          Alinhamento
        </span>
        <div class="rm-icg rm-icg-formato" style="width:100%; box-sizing:border-box;">
          <button type="button" class="rm-ic-bt ${alinAtivo === 'esquerda' ? 'on' : ''}" data-alin="esquerda" title="Esquerda: primeira e última linhas à esquerda">
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

      <div class="rm-linha2" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label style="font:700 12px var(--glx-font);">Cor do texto
          <label class="rm-cor-linha-badge" id="athEstiloCorBadge" style="display:flex; align-items:center; gap:6px; cursor:pointer; padding:3px 10px; border-radius:999px; background:var(--ath-input, #F4F5F8); border:1px solid var(--ath-primary-line, #C8D7E6); margin-top:4px; height:34px; box-sizing:border-box; position:relative;" title="Clique para escolher a cor">
            <span id="athEstiloCorSwatch" style="width:16px; height:16px; border-radius:50%; background:${corAtiva}; border:1px solid rgba(0,0,0,0.2); display:inline-block; flex:none;"></span>
            <span style="font-size:11px; font-weight:700; color:var(--ath-text, #1F2733);" id="athEstiloCorHex">${corAtiva}</span>
            <input type="color" id="athEstiloCorInput" value="${corAtiva.startsWith('#') ? corAtiva : '#1F2733'}" style="position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;">
          </label>
        </label>
      </div>

      ${secaoAvancadaHtml()}

      <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
        <label class="rm-chk" style="font-size:12px;">
          <input type="checkbox" id="athEstiloItalico" ${rasc.italico ? 'checked' : ''}> Itálico
        </label>
        <label class="rm-chk" style="font-size:12px;">
          <input type="checkbox" id="athEstiloCaixaAlta" ${rasc.caixa_alta ? 'checked' : ''}> Caixa Alta
        </label>
        <label class="rm-chk" style="font-size:12px;" title="Ativa quebra silábica de palavras com hífen (exem-plo)">
          <input type="checkbox" id="athEstiloHifenizacao" ${rasc.hifenizacao ? 'checked' : ''}> Hifenização (exem-plo)
        </label>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px; padding-top:10px; border-top:1px solid var(--ath-primary-line, #C8D7E6);">
        <div style="display:flex; gap:8px;">
          <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnSalvarEstilo" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
            ${svgIcone('salvar', 14)} Salvar Estilo
          </button>
          <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnDuplicarEstilo" style="flex:1;">
            Salvar como Novo
          </button>
        </div>
        ${est.id !== 'corpo' ? `
          <button type="button" class="glx-btn glx-btn-perigo glx-btn-sm" id="athBtnExcluirEstilo" style="width:100%; color:#DC2626; border-color:#FECACA; background:#FEF2F2;">
            Excluir estilo
          </button>
        ` : '<p style="margin:0; font-size:11px; color:var(--glx-muted);">O Corpo do Texto é o estilo-base do documento e não pode ser excluído.</p>'}
      </div>
    `;

    const previaEl = box.querySelector('#athEstiloPreviaPainel');
    const swatchEl = box.querySelector('#athEstiloCorSwatch');
    const hexEl = box.querySelector('#athEstiloCorHex');
    const inputCor = box.querySelector('#athEstiloCorInput');

    const atualizarPrevia = () => {
      previaEl.style.cssText = `${estiloParaCss(rasc)} min-height:48px; max-height:84px; overflow:hidden; text-align:${alinhamentoCss(rasc.alinhamento, 'left')}; text-align-last:auto;`;
      swatchEl.style.background = rasc.cor || '#1F2733';
      hexEl.textContent = rasc.cor || '#1F2733';
    };
    atualizarPrevia();

    box.querySelector('#athBtnVoltarPropsBloco').addEventListener('click', () => {
      this.estiloSelecionado = null;
      this.renderizar();
    });

    box.querySelector('#athEstiloNome').addEventListener('input', e => {
      rasc.nome = e.target.value;
      atualizarPrevia();
    });

    box.querySelector('#athEstiloFonte').addEventListener('change', e => {
      rasc.fonte = e.target.value;
      atualizarPrevia();
    });

    box.querySelector('#athEstiloTamanho').addEventListener('input', e => {
      rasc.tamanho_pt = parseFloat(e.target.value) || 12;
      atualizarPrevia();
    });

    box.querySelector('#athEstiloPeso').addEventListener('change', e => {
      rasc.peso = parseInt(e.target.value, 10);
      atualizarPrevia();
    });

    box.querySelectorAll('[data-alin]').forEach(btn => {
      btn.addEventListener('click', () => {
        rasc.alinhamento = btn.dataset.alin;
        box.querySelectorAll('[data-alin]').forEach(b => b.classList.toggle('on', b.dataset.alin === rasc.alinhamento));
        atualizarPrevia();
      });
    });

    box.querySelector('#athEstiloCorBadge').addEventListener('click', () => {
      inputCor.click();
    });

    inputCor.addEventListener('input', e => {
      rasc.cor = e.target.value;
      atualizarPrevia();
    });

    box.querySelector('#athEstiloHifenizacao')?.addEventListener('change', e => {
      rasc.hifenizacao = e.target.checked;
      atualizarPrevia();
    });

    ligarCamposAvancados(box, rasc, atualizarPrevia);

    box.querySelector('#athEstiloItalico').addEventListener('change', e => {
      rasc.italico = e.target.checked;
      atualizarPrevia();
    });

    box.querySelector('#athEstiloCaixaAlta').addEventListener('change', e => {
      rasc.caixa_alta = e.target.checked;
      atualizarPrevia();
    });

    box.querySelector('#athBtnSalvarEstilo').addEventListener('click', () => {
      gravarRascunhoNoEstilo(est, rasc);
      this.notificarMudanca(true);
      this.renderizar();
    });

    box.querySelector('#athBtnDuplicarEstilo').addEventListener('click', () => {
      const novoId = 'est_' + Date.now().toString(36);
      const novoEst = {
        ...rasc,
        id: novoId,
        nome: `${rasc.nome} (Cópia)`,
        personalizado: true
      };
      this.doc.estilos.push(novoEst);
      this.estiloSelecionado = novoEst;
      this.notificarMudanca(true);
      this.renderizar();
    });

    box.querySelector('#athBtnExcluirEstilo')?.addEventListener('click', () => {
      const uso = contarUsoDoEstilo(this.doc, est.id);
      const aviso = uso
        ? `O estilo "${est.nome}" é usado em ${uso} bloco(s). Eles passarão para o título do mesmo nível ou para o Corpo do Texto. Excluir mesmo assim?`
        : `Excluir o estilo "${est.nome}"?`;
      if (!window.confirm(aviso)) return;
      if (!excluirEstilo(this.doc, est.id).ok) return;
      this.estiloSelecionado = null;
      this.notificarMudanca(true);
      this.renderizar();
    });

    wrapper.appendChild(box);
  }

  /**
   * "Separador entre o número e o título" (Tabela 1 — / : / . …): escolha do bloco, com atalho para
   * tornar a escolha o padrão do documento. Entra logo abaixo do campo de título.
   */
  inserirSeletorSeparador(box, seletorTitulo, b) {
    const alvo = box.querySelector(seletorTitulo)?.closest('label');
    if (!alvo) return;
    const docId = idSeparadorLegenda(this.doc, null);
    const padraoDoc = SEPARADORES_LEGENDA.find(x => x.id === docId);
    const atual = b.separador_legenda || '';
    const wrap = document.createElement('div');
    wrap.className = 'ath-sep-legenda';
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:6px;';
    wrap.innerHTML = `
      <label style="font:700 11px var(--glx-font); color:#475569; display:flex; flex-direction:column; gap:3px;">Separador entre o número e o título
        <select class="glx-select" data-sep style="width:100%;">
          <option value="" ${atual === '' ? 'selected' : ''}>Padrão do documento (${padraoDoc.exemplo})</option>
          ${SEPARADORES_LEGENDA.map(x => `<option value="${x.id}" ${atual === x.id ? 'selected' : ''}>${x.rotulo} — ${x.exemplo.replace('Tabela', rotuloDoBloco(b))}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-sep-todos style="align-self:flex-start;">Usar este separador em todo o documento</button>`;
    alvo.insertAdjacentElement('afterend', wrap);
    wrap.querySelector('[data-sep]').addEventListener('change', e => {
      if (e.target.value) b.separador_legenda = e.target.value; else delete b.separador_legenda;
      this.notificarMudanca(true);
      this.renderizar?.();
    });
    wrap.querySelector('[data-sep-todos]').addEventListener('click', () => {
      this.doc.separador_legenda = idSeparadorLegenda(this.doc, b);
      for (const sec of this.doc.secoes || []) for (const x of sec.blocos || []) delete x.separador_legenda;
      this.notificarMudanca(true);
      this.renderizar?.();
    });
  }

  notificarMudanca(estrutural = false) {
    recalcularNumeracaoAutomatica(this.doc);
    this.onAlterado(this.doc, estrutural);
  }
}
