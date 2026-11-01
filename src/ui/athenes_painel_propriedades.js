// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel Inspetor de Propriedades, Tipografia e Modelos de Página.
 */

import { FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';
import { modeloDaPagina } from '../core/athenes_documento.js';

export class PainelPropriedades {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.blocoSelecionado = null;
    this.paginaSelecionada = null;
    this.abaAtiva = 'bloco'; // 'bloco', 'estilos', 'modelo'
    this.onAlterado = opcoes.onAlterado || (() => {});

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

    // Abas do Inspetor
    const tabsEl = document.createElement('div');
    tabsEl.className = 'ath-inspector-tabs';
    tabsEl.innerHTML = `
      <div class="ath-inspector-tab ${this.abaAtiva === 'bloco' ? 'ativo' : ''}" data-tab="bloco">Bloco</div>
      <div class="ath-inspector-tab ${this.abaAtiva === 'estilos' ? 'ativo' : ''}" data-tab="estilos">Tipografia</div>
      <div class="ath-inspector-tab ${this.abaAtiva === 'modelo' ? 'ativo' : ''}" data-tab="modelo">Página</div>
    `;

    tabsEl.querySelectorAll('.ath-inspector-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.abaAtiva = tab.dataset.tab;
        this.renderizar();
      });
    });

    this.container.appendChild(tabsEl);

    const corpoEl = document.createElement('div');
    corpoEl.className = 'ath-inspector-corpo';

    if (this.abaAtiva === 'bloco') {
      this.renderizarAbaBloco(corpoEl);
    } else if (this.abaAtiva === 'estilos') {
      this.renderizarAbaEstilos(corpoEl);
    } else {
      this.renderizarAbaModelo(corpoEl);
    }

    this.container.appendChild(corpoEl);
  }

  renderizarAbaBloco(corpoEl) {
    if (!this.blocoSelecionado) {
      corpoEl.innerHTML = `
        <div style="padding:24px 16px; text-align:center; color:var(--ath-muted);">
          <p style="margin:0 0 8px 0; font-weight:700;">Nenhum bloco selecionado</p>
          <p style="font-size:12px; margin:0;">Clique em um parágrafo, título, imagem ou tabela na folha para editar suas propriedades.</p>
        </div>
      `;
      return;
    }

    const b = this.blocoSelecionado;
    const estAtual = this.doc.estilos.find(e => e.id === b.estiloId) || this.doc.estilos[0];

    const secao = document.createElement('div');
    secao.className = 'ath-inspector-secao';
    secao.innerHTML = `
      <h3>Propriedades do Bloco (${b.tipo.toUpperCase()})</h3>

      <div class="ath-prop-grupo">
        <label>Estilo Vinculado</label>
        <select class="ath-select" id="athPropEstilo">
          ${this.doc.estilos.map(e => `<option value="${e.id}" ${e.id === b.estiloId ? 'selected' : ''}>${e.nome}</option>`).join('')}
        </select>
      </div>

      ${b.tipo === 'titulo' ? `
        <div class="ath-prop-grupo">
          <label>Nível do Título</label>
          <select class="ath-select" id="athPropNivel">
            <option value="1" ${b.nivel === 1 ? 'selected' : ''}>Título 1 (Seção Primária)</option>
            <option value="2" ${b.nivel === 2 ? 'selected' : ''}>Título 2 (Subseção)</option>
            <option value="3" ${b.nivel === 3 ? 'selected' : ''}>Título 3 (Sub-subseção)</option>
          </select>
        </div>
      ` : ''}

      ${b.tipo === 'citacao' ? `
        <div class="ath-prop-grupo">
          <label>Autor / Origem da Citação</label>
          <input class="ath-input" id="athPropCitAutor" value="${b.autor || ''}" placeholder="Ex.: SILVA, J.">
        </div>
        <div class="ath-linha2">
          <div class="ath-prop-grupo">
            <label>Ano</label>
            <input class="ath-input" id="athPropCitAno" value="${b.ano || ''}" placeholder="2024">
          </div>
          <div class="ath-prop-grupo">
            <label>Página</label>
            <input class="ath-input" id="athPropCitPag" value="${b.pagina_citada || ''}" placeholder="45">
          </div>
        </div>
      ` : ''}

      ${b.tipo === 'imagem' ? `
        <div class="ath-prop-grupo">
          <label>Legenda da Figura</label>
          <input class="ath-input" id="athPropImgLegenda" value="${b.legenda || ''}">
        </div>
        <div class="ath-prop-grupo">
          <label>Fonte da Ilustração</label>
          <input class="ath-input" id="athPropImgFonte" value="${b.fonte || ''}">
        </div>
        <div class="ath-prop-grupo">
          <label>Largura na Folha (%)</label>
          <input type="range" min="20" max="100" step="5" class="ath-input" id="athPropImgLargura" value="${b.largura_pct || 80}">
          <span style="font-size:11px; color:var(--ath-muted);">${b.largura_pct || 80}% da área útil</span>
        </div>
      ` : ''}

      <div class="ath-prop-grupo">
        <label>Colunas da Grade (Span)</label>
        <select class="ath-select" id="athPropSpan">
          <option value="1" ${b.span === 1 ? 'selected' : ''}>1 coluna</option>
          <option value="2" ${b.span === 2 ? 'selected' : ''}>2 colunas</option>
          <option value="3" ${b.span === 3 ? 'selected' : ''}>3 colunas</option>
          <option value="4" ${b.span === 4 ? 'selected' : ''}>4 colunas</option>
          <option value="12" ${b.span === 12 ? 'selected' : ''}>Largura Total (12 cols)</option>
        </select>
      </div>
    `;

    // Eventos
    const selEstilo = secao.querySelector('#athPropEstilo');
    if (selEstilo) {
      selEstilo.addEventListener('change', () => {
        b.estiloId = selEstilo.value;
        this.onAlterado();
      });
    }

    const selNivel = secao.querySelector('#athPropNivel');
    if (selNivel) {
      selNivel.addEventListener('change', () => {
        b.nivel = Number(selNivel.value);
        this.onAlterado();
      });
    }

    const inCitAutor = secao.querySelector('#athPropCitAutor');
    if (inCitAutor) {
      inCitAutor.addEventListener('input', () => {
        b.autor = inCitAutor.value;
        this.onAlterado();
      });
    }
    const inCitAno = secao.querySelector('#athPropCitAno');
    if (inCitAno) {
      inCitAno.addEventListener('input', () => {
        b.ano = inCitAno.value;
        this.onAlterado();
      });
    }
    const inCitPag = secao.querySelector('#athPropCitPag');
    if (inCitPag) {
      inCitPag.addEventListener('input', () => {
        b.pagina_citada = inCitPag.value;
        this.onAlterado();
      });
    }

    const inImgLeg = secao.querySelector('#athPropImgLegenda');
    if (inImgLeg) {
      inImgLeg.addEventListener('input', () => {
        b.legenda = inImgLeg.value;
        this.onAlterado();
      });
    }
    const inImgFonte = secao.querySelector('#athPropImgFonte');
    if (inImgFonte) {
      inImgFonte.addEventListener('input', () => {
        b.fonte = inImgFonte.value;
        this.onAlterado();
      });
    }
    const inImgLarg = secao.querySelector('#athPropImgLargura');
    if (inImgLarg) {
      inImgLarg.addEventListener('input', () => {
        b.largura_pct = Number(inImgLarg.value);
        this.onAlterado();
      });
    }

    const selSpan = secao.querySelector('#athPropSpan');
    if (selSpan) {
      selSpan.addEventListener('change', () => {
        b.span = Number(selSpan.value);
        this.onAlterado();
      });
    }

    corpoEl.appendChild(secao);
  }

  renderizarAbaEstilos(corpoEl) {
    const secao = document.createElement('div');
    secao.className = 'ath-inspector-secao';

    secao.innerHTML = `
      <h3>Estilos de Parágrafo</h3>
      <div class="ath-estilos-chips" id="athListaEstilos">
        ${this.doc.estilos.map((est, idx) => `
          <button type="button" class="ath-chip-estilo ${idx === 0 ? 'ativo' : ''}" data-id="${est.id}">${est.nome}</button>
        `).join('')}
      </div>

      <div id="athEditorEstiloForm"></div>
    `;

    const chips = secao.querySelectorAll('.ath-chip-estilo');
    const formBox = secao.querySelector('#athEditorEstiloForm');

    const carregarEstilo = (estId) => {
      chips.forEach(c => c.classList.toggle('ativo', c.dataset.id === estId));
      const est = this.doc.estilos.find(e => e.id === estId);
      if (!est) return;

      formBox.innerHTML = `
        <div class="ath-prop-grupo">
          <label>Família da Fonte</label>
          <select class="ath-select" id="athEstFonte">
            ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}" ${f.id === est.fonte ? 'selected' : ''}>${f.rotulo}</option>`).join('')}
          </select>
        </div>

        <div class="ath-linha2">
          <div class="ath-prop-grupo">
            <label>Tamanho (pt)</label>
            <input type="number" min="6" max="72" step="0.5" class="ath-input" id="athEstTamanho" value="${est.tamanho_pt || 12}">
          </div>
          <div class="ath-prop-grupo">
            <label>Peso</label>
            <select class="ath-select" id="athEstPeso">
              ${PESOS_FONTE.map(p => `<option value="${p.valor}" ${p.valor === est.peso ? 'selected' : ''}>${p.rotulo}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="ath-linha2">
          <div class="ath-prop-grupo">
            <label>Entrelinha</label>
            <select class="ath-select" id="athEstEntrelinha">
              <option value="1.0" ${est.entrelinha === 1.0 ? 'selected' : ''}>1.0 (Simples)</option>
              <option value="1.15" ${est.entrelinha === 1.15 ? 'selected' : ''}>1.15 (Padrão Web)</option>
              <option value="1.5" ${est.entrelinha === 1.5 ? 'selected' : ''}>1.5 (ABNT)</option>
              <option value="2.0" ${est.entrelinha === 2.0 ? 'selected' : ''}>2.0 (APA Dupla)</option>
            </select>
          </div>
          <div class="ath-prop-grupo">
            <label>Cor do Texto</label>
            <input type="color" class="ath-input" style="padding:2px 4px; height:36px;" id="athEstCor" value="${est.cor || '#1F2733'}">
          </div>
        </div>

        <div class="ath-linha2">
          <div class="ath-prop-grupo">
            <label>Recuo 1ª Linha (mm)</label>
            <input type="number" min="0" max="50" step="0.5" class="ath-input" id="athEstRecuo1" value="${est.recuo_primeira_linha_mm || 0}">
          </div>
          <div class="ath-prop-grupo">
            <label>Recuo Esquerdo (mm)</label>
            <input type="number" min="0" max="60" step="1" class="ath-input" id="athEstRecuoEsq" value="${est.recuo_esquerdo_mm || 0}">
          </div>
        </div>

        <div class="ath-linha2">
          <div class="ath-prop-grupo">
            <label>Espaço Antes (pt)</label>
            <input type="number" min="0" max="40" step="1" class="ath-input" id="athEstAntes" value="${est.espaco_antes_pt || 0}">
          </div>
          <div class="ath-prop-grupo">
            <label>Espaço Depois (pt)</label>
            <input type="number" min="0" max="40" step="1" class="ath-input" id="athEstDepois" value="${est.espaco_depois_pt || 0}">
          </div>
        </div>

        <div class="ath-prop-grupo">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="athEstKeepNext" ${est.manter_com_proximo ? 'checked' : ''}>
            <span>Manter com o próximo parágrafo (sem órfãos)</span>
          </label>
        </div>
      `;

      formBox.querySelector('#athEstFonte').addEventListener('change', e => { est.fonte = e.target.value; this.onAlterado(); });
      formBox.querySelector('#athEstTamanho').addEventListener('input', e => { est.tamanho_pt = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstPeso').addEventListener('change', e => { est.peso = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstEntrelinha').addEventListener('change', e => { est.entrelinha = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstCor').addEventListener('input', e => { est.cor = e.target.value; this.onAlterado(); });
      formBox.querySelector('#athEstRecuo1').addEventListener('input', e => { est.recuo_primeira_linha_mm = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstRecuoEsq').addEventListener('input', e => { est.recuo_esquerdo_mm = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstAntes').addEventListener('input', e => { est.espaco_antes_pt = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstDepois').addEventListener('input', e => { est.espaco_depois_pt = Number(e.target.value); this.onAlterado(); });
      formBox.querySelector('#athEstKeepNext').addEventListener('change', e => { est.manter_com_proximo = e.target.checked; this.onAlterado(); });
    };

    chips.forEach(c => {
      c.addEventListener('click', () => carregarEstilo(c.dataset.id));
    });

    carregarEstilo(this.doc.estilos[0]?.id || 'corpo');
    corpoEl.appendChild(secao);
  }

  renderizarAbaModelo(corpoEl) {
    const pag = this.paginaSelecionada || this.doc.paginas[0];
    const mod = modeloDaPagina(this.doc, pag);

    const secao = document.createElement('div');
    secao.className = 'ath-inspector-secao';

    secao.innerHTML = `
      <h3>Modelo da Página</h3>

      <div class="ath-prop-grupo">
        <label>Tipo de Modelo Aplicado</label>
        <select class="ath-select" id="athPagModeloSelect">
          ${this.doc.modelosPagina.map(m => `<option value="${m.id}" ${m.id === mod.id ? 'selected' : ''}>${m.nome}</option>`).join('')}
        </select>
        <p style="font-size:11px; color:var(--ath-muted); margin:4px 0 0 0;">Alterar este modelo atualiza as páginas vinculadas sem apagar os blocos de texto.</p>
      </div>

      <div class="ath-linha2">
        <div class="ath-prop-grupo">
          <label>Formato</label>
          <select class="ath-select" id="athModFormato">
            <option value="A4" ${mod.formato === 'A4' ? 'selected' : ''}>A4 (210 × 297 mm)</option>
            <option value="Letter" ${mod.formato === 'Letter' ? 'selected' : ''}>Carta (Letter)</option>
            <option value="A3" ${mod.formato === 'A3' ? 'selected' : ''}>A3 (297 × 420 mm)</option>
          </select>
        </div>
        <div class="ath-prop-grupo">
          <label>Orientação</label>
          <select class="ath-select" id="athModOrientacao">
            <option value="retrato" ${mod.orientacao === 'retrato' ? 'selected' : ''}>Retrato</option>
            <option value="paisagem" ${mod.orientacao === 'paisagem' ? 'selected' : ''}>Paisagem</option>
          </select>
        </div>
      </div>

      <div class="ath-prop-grupo">
        <label>Margens Físicas (mm)</label>
        <div class="ath-linha4">
          <div><span style="font-size:10px; color:var(--ath-muted);">SUP</span><input type="number" class="ath-input" id="athMargT" value="${mod.margens_mm.t}"></div>
          <div><span style="font-size:10px; color:var(--ath-muted);">DIR</span><input type="number" class="ath-input" id="athMargR" value="${mod.margens_mm.r}"></div>
          <div><span style="font-size:10px; color:var(--ath-muted);">INF</span><input type="number" class="ath-input" id="athMargB" value="${mod.margens_mm.b}"></div>
          <div><span style="font-size:10px; color:var(--ath-muted);">ESQ</span><input type="number" class="ath-input" id="athMargL" value="${mod.margens_mm.l}"></div>
        </div>
      </div>

      <div class="ath-linha2">
        <div class="ath-prop-grupo">
          <label>Colunas da Grade</label>
          <select class="ath-select" id="athModColunas">
            <option value="1" ${mod.grade?.colunas === 1 ? 'selected' : ''}>1 Coluna (Texto)</option>
            <option value="2" ${mod.grade?.colunas === 2 ? 'selected' : ''}>2 Colunas (IEEE)</option>
            <option value="3" ${mod.grade?.colunas === 3 ? 'selected' : ''}>3 Colunas</option>
            <option value="12" ${mod.grade?.colunas === 12 ? 'selected' : ''}>12 Colunas (Modular)</option>
          </select>
        </div>
        <div class="ath-prop-grupo">
          <label>Gutter (mm)</label>
          <input type="number" min="0" max="20" class="ath-input" id="athModGap" value="${mod.grade?.gap_mm || 4}">
        </div>
      </div>

      <div class="ath-prop-grupo">
        <label>Cabeçalho da Página</label>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <input type="checkbox" id="athModCabAtivo" ${mod.cabecalho?.ativo ? 'checked' : ''}>
          <span style="font-size:12px;">Ativo nas páginas deste modelo</span>
        </div>
        <input class="ath-input" id="athModCabTexto" value="${mod.cabecalho?.texto || ''}" placeholder="{documento.titulo}">
      </div>

      <div class="ath-prop-grupo">
        <label>Rodapé e Numeração</label>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <input type="checkbox" id="athModRodNum" ${mod.rodape?.numeracao ? 'checked' : ''}>
          <span style="font-size:12px;">Exibir número da página</span>
        </div>
        <input class="ath-input" id="athModRodTexto" value="${mod.rodape?.texto || ''}" placeholder="{documento.autor_principal}">
      </div>
    `;

    // Eventos do Modelo
    secao.querySelector('#athPagModeloSelect').addEventListener('change', e => {
      pag.modeloId = e.target.value;
      this.onAlterado();
      this.renderizar();
    });

    secao.querySelector('#athModFormato').addEventListener('change', e => {
      mod.formato = e.target.value;
      this.onAlterado();
    });
    secao.querySelector('#athModOrientacao').addEventListener('change', e => {
      mod.orientacao = e.target.value;
      this.onAlterado();
    });

    secao.querySelector('#athMargT').addEventListener('input', e => { mod.margens_mm.t = Number(e.target.value); this.onAlterado(); });
    secao.querySelector('#athMargR').addEventListener('input', e => { mod.margens_mm.r = Number(e.target.value); this.onAlterado(); });
    secao.querySelector('#athMargB').addEventListener('input', e => { mod.margens_mm.b = Number(e.target.value); this.onAlterado(); });
    secao.querySelector('#athMargL').addEventListener('input', e => { mod.margens_mm.l = Number(e.target.value); this.onAlterado(); });

    secao.querySelector('#athModColunas').addEventListener('change', e => {
      mod.grade.colunas = Number(e.target.value);
      this.onAlterado();
    });
    secao.querySelector('#athModGap').addEventListener('input', e => {
      mod.grade.gap_mm = Number(e.target.value);
      this.onAlterado();
    });

    secao.querySelector('#athModCabAtivo').addEventListener('change', e => {
      mod.cabecalho.ativo = e.target.checked;
      this.onAlterado();
    });
    secao.querySelector('#athModCabTexto').addEventListener('input', e => {
      mod.cabecalho.texto = e.target.value;
      this.onAlterado();
    });

    secao.querySelector('#athModRodNum').addEventListener('change', e => {
      mod.rodape.numeracao = e.target.checked;
      this.onAlterado();
    });
    secao.querySelector('#athModRodTexto').addEventListener('input', e => {
      mod.rodape.texto = e.target.value;
      this.onAlterado();
    });

    corpoEl.appendChild(secao);
  }
}
