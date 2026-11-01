// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor WYSIWYG de Documentos em Blocos na Folha.
 * Adota fielmente o layout de 3 colunas e componentes do Glaux GIS (relatorios_modelos):
 * - Coluna 1 (Esquerda): Configuração do Documento, Margens (.rm-folha-mini + #rmMDiag),
 *   Seções & Mestras, Cabeçalho e Rodapé, Estilos de Texto e Lista de Blocos.
 * - Coluna 2 (Centro): Barra de Blocos flutuante (.rm-barra-blocos), Informações de Prévia,
 *   e Palco com a Folha A4 Real com edição direta in-page (contenteditable).
 * - Coluna 3 (Direita): Inspetor de Bloco, Posição na Folha (12 colunas) e Blocos Compostos.
 */

import { dimensoesPapelMm } from '../core/athenes_grid.js';
import { estiloParaCss, FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';
import {
  criarNovoBloco,
  modeloDaPagina,
  repaginarDocumento,
  adicionarBlocoNaSecao,
  removerBlocoDaSecao,
  duplicarBloco,
  moverBloco,
  gerarId,
  ROTULOS_FIGURA,
  rotuloDaFigura,
  calcularLinhas,
  colocarBloco,
  moverBlocoPorLinha,
  duplicarBlocoNaSecao,
  adicionarSecao,
  removerSecao,
  moverSecao,
  trocarMestraDaSecao,
  recalcularNumeracaoAutomatica,
  resolverReferenciasCruzadas
} from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';

const TIPO_ROTULO = {
  titulo: 'Título', subtitulo: 'Subtítulo', paragrafo: 'Texto', citacao: 'Citação', tabela: 'Tabela',
  quadro: 'Quadro', figura: 'Figura', imagem: 'Figura', mapa: 'Mapa', formula: 'Fórmula',
  campos: 'Campos (rótulo e valor)', nota: 'Nota', divisor: 'Divisor', espaco: 'Espaçamento',
  anexo: 'Anexo', sumario: 'Sumário', referencias: 'Referências', quebra_pagina: 'Quebra de página', lista: 'Lista'
};

function resumoBloco(b) {
  const txt = String(b.titulo || b.texto || b.rotulo || b.latex || '').replace(/<[^>]+>/g, '').trim();
  return txt.slice(0, 42) || '—';
}

const MENUS_BLOCO = {
  figura: [
    { tipo: 'figura', subtipo: 'figura', icone: 'imagem', rotulo: 'Figura', desc: 'Imagem, esquema ou ilustração numerada' },
    { tipo: 'figura', subtipo: 'grafico', icone: 'grafico', rotulo: 'Gráfico', desc: 'Barras, linhas, dispersão — numeração própria' },
    { tipo: 'figura', subtipo: 'fotografia', icone: 'fotografia', rotulo: 'Fotografia', desc: 'Registro fotográfico, com fonte e crédito' },
    { tipo: 'figura', subtipo: 'diagrama', icone: 'diagrama', rotulo: 'Diagrama', desc: 'Relações e estruturas entre elementos' },
    { tipo: 'figura', subtipo: 'fluxograma', icone: 'fluxograma', rotulo: 'Fluxograma', desc: 'Etapas e decisões de um processo' }
  ],
  quadro: [
    { tipo: 'quadro', icone: 'quadro', rotulo: 'Quadro', desc: 'Texto organizado em caixa fechada, numerado' },
    { tipo: 'campos', icone: 'campos', rotulo: 'Campos (rótulo e valor)', desc: 'Pares de rótulo e valor em colunas' }
  ]
};

function rotuloDoBloco(b) {
  if (b.tipo === 'figura') return ROTULOS_FIGURA[b.subtipo] || 'Figura';
  return TIPO_ROTULO[b.tipo] || b.tipo;
}

const ALINHAMENTO_CSS = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'justify' };
function alinhamentoCss(valor, padrao) {
  return ALINHAMENTO_CSS[valor] || padrao;
}

export class EditorView {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.blocoSelecionado = null;
    this.secaoAtivaId = documento.secoes?.[0]?.id || null;
    this.estiloSelecionadoId = documento.estilos?.[0]?.id || 'titulo1';
    this.historico = [];
    this.historicoIndice = -1;
    this.margemElo = false;
    this.guiasVisiveis = false;
    this.arrastandoId = null;
    this.rascunhoEstilo = null;
    this.estilosAberto = false;
    this._tSnap = null;

    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onSelecionarBloco = opcoes.onSelecionarBloco || (() => {});
    this.onVoltarDashboard = opcoes.onVoltarDashboard || (() => {});
    this.onAbrirExportar = opcoes.onAbrirExportar || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});
    this.onRenderizado = opcoes.onRenderizado || (() => {});

    repaginarDocumento(this.doc);
    this.normalizarBlocosLegados();
    repaginarDocumento(this.doc);
    this.salvarSnapshot();
    this.renderizar();
  }

  normalizarBlocosLegados() {
    for (const sec of this.doc.secoes || []) {
      for (const b of sec.blocos || []) {
        if (!b.span || (b.span === 1 && (b.col || 1) === 1)) { b.col = 1; b.span = 12; }
      }
    }
  }

  setDocumento(doc) {
    this.doc = doc;
    repaginarDocumento(this.doc);
    this.salvarSnapshot();
    this.renderizar();
  }

  salvarSnapshot() {
    const snap = JSON.stringify(this.doc);
    if (this.historicoIndice >= 0 && this.historico[this.historicoIndice] === snap) return;

    this.historico = this.historico.slice(0, this.historicoIndice + 1);
    this.historico.push(snap);
    if (this.historico.length > 50) this.historico.shift();
    this.historicoIndice = this.historico.length - 1;
  }

  desfazer() {
    if (this.historicoIndice > 0) {
      this.historicoIndice--;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
      this.blocoSelecionado = null;
      this.rascunhoEstilo = null;
      repaginarDocumento(this.doc);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  refazer() {
    if (this.historicoIndice < this.historico.length - 1) {
      this.historicoIndice++;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
      this.blocoSelecionado = null;
      this.rascunhoEstilo = null;
      repaginarDocumento(this.doc);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  obterSecaoAtiva() {
    return this.doc.secoes?.find(s => s.id === this.secaoAtivaId) || this.doc.secoes?.[0];
  }

  obterMestraAtiva() {
    const sec = this.obterSecaoAtiva();
    const mestraId = sec?.mestraId || 'corpo';
    return (this.doc.mestras || []).find(m => m.id === mestraId) || this.doc.mestras?.[0];
  }

  renderizar() {
    if (!this.container) return;
    const rolagem = {
      palco: this.container.querySelector('#rmPrevPalco')?.scrollTop || 0,
      esq: this.container.querySelector('#rmColEsq')?.scrollTop || 0
    };
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'rm-conteudo';

    // 1. Topo Shell (Marca, Título do Documento e Botões Globais)
    const topoShell = document.createElement('header');
    topoShell.className = 'ath-topo-shell';
    topoShell.innerHTML = `
      <div class="ath-topo-esq">
        <a class="ath-marca-link" id="athBrandVoltar" title="Voltar para a Visão Geral">
          ${svgIcone('artigo', 18)}
          <span>ATHENES</span>
        </a>
        <input type="text" class="ath-doc-titulo-topo" id="athInputTituloDoc" value="${this.doc.titulo || 'Sem título'}" title="Clique para renomear">
        <span class="rm-selo">${(this.doc.perfil || 'abnt').toUpperCase()}</span>
      </div>
      <div class="ath-topo-dir">
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnAbaZotero">
          ${svgIcone('zotero', 15)} <span>Zotero & Fichamento</span>
        </button>
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnAbaConexoes">
          ${svgIcone('conexoes', 15)} <span>Grafo</span>
        </button>
        <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnExportarModal">
          ${svgIcone('exportar', 14)} <span>Exportar</span>
        </button>
      </div>
    `;
    root.appendChild(topoShell);

    // 2. Editor Principal Glaux (Grade de 3 Colunas: 310px | 1fr | 330px)
    const editorEl = document.createElement('div');
    editorEl.className = 'rm-editor rm-main';
    editorEl.innerHTML = `
      <div class="rm-ed-grade">
        <!-- COLUNA ESQUERDA: Configuração, Margens, Seções, Cabeçalho/Rodapé, Estilos e Blocos -->
        <aside class="rm-col rm-col-esq" id="rmColEsq"></aside>

        <!-- COLUNA CENTRAL: Prévia da Folha A4 com Barra de Blocos Flutuante e Edição Direta -->
        <section class="rm-col rm-col-prev" id="rmColPrev">
          <div class="rm-prev-topo">
            <strong>Prévia</strong>
            <span id="rmPrevInfo" class="rm-prev-info"></span>
          </div>

          <div class="rm-barra-blocos" id="rmBarraBlocos">
            <button type="button" class="rm-ic-bt" id="rmVoltar" title="Voltar para a Visão Geral" aria-label="Voltar">
              ${svgIcone('voltar', 16)}
            </button>
            <button type="button" class="rm-ic-bt rm-ic-primario" id="rmSalvar" title="Salvar alterações" aria-label="Salvar">
              ${svgIcone('salvar', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>
            <button type="button" class="rm-ic-bt" id="rmDesfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
              ${svgIcone('desfazer', 16)}
            </button>
            <button type="button" class="rm-ic-bt" id="rmRefazer" title="Refazer (Ctrl+Y)" aria-label="Refazer">
              ${svgIcone('refazer', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Botões de Inserção de Blocos com Ícones Glaux -->
            <button type="button" class="rm-ic-bt" id="rmAddTitulo" data-tip="Título" title="Inserir Título">${svgIcone('titulo', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddTexto" data-tip="Texto" title="Inserir Parágrafo">${svgIcone('paragrafo', 16)}</button>
            <div class="rm-grupo-bt" data-grupo="figura">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddFigura" data-tip="Figura" title="Figura, gráfico, fotografia, diagrama…" aria-haspopup="menu" aria-expanded="false">${svgIcone('imagem', 16)}</button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
            <button type="button" class="rm-ic-bt" id="rmAddTabela" data-tip="Tabela" title="Inserir Tabela (ABNT/IBGE)">${svgIcone('tabela', 16)}</button>
            <div class="rm-grupo-bt" data-grupo="quadro">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddQuadro" data-tip="Quadro" title="Quadro ou campos (rótulo e valor)" aria-haspopup="menu" aria-expanded="false">${svgIcone('quadro', 16)}</button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
            <button type="button" class="rm-ic-bt" id="rmAddMapa" data-tip="Mapa" title="Inserir Mapa Territorial">${svgIcone('mapa', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddFormula" data-tip="Fórmula" title="Inserir Fórmula Matemática">${svgIcone('formula', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddDivisor" data-tip="Divisor" title="Inserir Divisor">${svgIcone('divisor', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddEspaco" data-tip="Espaço" title="Inserir Espaçamento">${svgIcone('espacamento', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddQuebra" data-tip="Quebra" title="Inserir Quebra de Página">${svgIcone('quebra_pagina', 16)}</button>

            <!-- Botão de Grade à Direita -->
            <button type="button" class="rm-ic-bt rm-ic-guia ${this.guiasVisiveis ? 'on' : ''}" id="rmGuia" aria-pressed="${this.guiasVisiveis}" title="Alternar visualização da grade de 12 colunas">
              ${svgIcone('guia_grade', 18)}
            </button>
          </div>

          <!-- Palco de Páginas Reais -->
          <div class="rm-prev rm-prev-palco" id="rmPrevPalco"></div>
        </section>

        <!-- COLUNA DIREITA: Inspetor de Propriedades e Edição Composta -->
        <aside class="rm-col rm-col-dir" id="athInspectorContainer"></aside>
      </div>
    `;

    root.appendChild(editorEl);
    this.container.appendChild(root);

    // Liga eventos dos botões de topo e barra
    this.ligarEventosGerais(root);

    // Renderiza Coluna Esquerda
    this.renderizarColunaEsquerda(root.querySelector('#rmColEsq'));

    // Renderiza Folhas no Palco Central
    this.renderizarFolhasPaginas();

    // Atualiza diagrama de margens
    this.pintarDiagramaMargens();

    const palcoNovo = root.querySelector('#rmPrevPalco');
    const esqNovo = root.querySelector('#rmColEsq');
    if (palcoNovo) palcoNovo.scrollTop = rolagem.palco;
    if (esqNovo) esqNovo.scrollTop = rolagem.esq;
    this.onRenderizado(root.querySelector('#athInspectorContainer'));
  }

  ligarEventosGerais(root) {
    root.querySelector('#athBrandVoltar').addEventListener('click', () => this.onVoltarDashboard());
    root.querySelector('#rmVoltar').addEventListener('click', () => this.onVoltarDashboard());
    root.querySelector('#rmSalvar').addEventListener('click', () => {
      this.salvarSnapshot();
      this.onAlterado(this.doc);
      const btn = root.querySelector('#rmSalvar');
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => { btn.style.transform = ''; }, 120);
    });

    const inputTitulo = root.querySelector('#athInputTituloDoc');
    inputTitulo.addEventListener('change', () => {
      this.doc.titulo = inputTitulo.value.trim() || 'Sem título';
      this.notificarMudanca();
    });

    root.querySelector('#rmDesfazer').addEventListener('click', () => this.desfazer());
    root.querySelector('#rmRefazer').addEventListener('click', () => this.refazer());

    root.querySelector('#athBtnAbaZotero').addEventListener('click', () => this.onAbrirZotero());
    root.querySelector('#athBtnAbaConexoes').addEventListener('click', () => this.onAbrirConexoes());
    root.querySelector('#athBtnExportarModal').addEventListener('click', () => this.onAbrirExportar());

    // Botões de inserção de blocos
    const adicionar = (tipo, dados = {}) => {
      const sec = this.obterSecaoAtiva();
      if (!sec) return;
      const b = criarNovoBloco(tipo, dados);
      adicionarBlocoNaSecao(this.doc, sec.id, b);
      this.blocoSelecionado = b;
      this.notificarMudanca();
      this.renderizar();
    };

    root.querySelector('#rmAddTitulo').addEventListener('click', () => adicionar('titulo', { texto: 'Novo Título' }));
    root.querySelector('#rmAddTexto').addEventListener('click', () => adicionar('paragrafo', { texto: 'Escreva seu parágrafo diretamente aqui...' }));
    this.ligarMenusDeBlocos(root, adicionar);
    root.querySelector('#rmAddTabela').addEventListener('click', () => adicionar('tabela', { titulo: 'Tabela — Dados quantitativos' }));
    root.querySelector('#rmAddMapa').addEventListener('click', () => adicionar('mapa', { titulo: 'Mapa — Delimitação territorial' }));
    root.querySelector('#rmAddFormula').addEventListener('click', () => adicionar('formula', { latex: 'E = m \\cdot c^2' }));
    root.querySelector('#rmAddDivisor').addEventListener('click', () => adicionar('divisor', {}));
    root.querySelector('#rmAddEspaco').addEventListener('click', () => adicionar('espaco', { altura_pt: 24 }));
    root.querySelector('#rmAddQuebra').addEventListener('click', () => adicionar('quebra_pagina', {}));

    // Alternar Guia Grade
    const btnGuia = root.querySelector('#rmGuia');
    btnGuia.addEventListener('click', () => {
      this.guiasVisiveis = !this.guiasVisiveis;
      btnGuia.setAttribute('aria-pressed', String(this.guiasVisiveis));
      btnGuia.classList.toggle('on', this.guiasVisiveis);
      this.renderizarFolhasPaginas();
    });
  }

  renderizarColunaEsquerda(colEsq) {
    if (!colEsq) return;
    colEsq.innerHTML = '';

    const mestra = this.obterMestraAtiva();
    const secAtiva = this.obterSecaoAtiva();
    const margens = mestra.margens_mm || { t: 25, r: 20, b: 20, l: 25 };

    // 1. Bloco de Configuração do Documento e Margens
    const cardCfg = document.createElement('div');
    cardCfg.className = 'rm-bloco-cfg';
    cardCfg.innerHTML = `
      <label>Nome
        <input type="text" id="rmNome" value="${this.doc.titulo || ''}">
      </label>
      <label>Descrição
        <input type="text" id="rmDescricao" value="${this.doc.subtitulo || ''}" placeholder="Subtítulo ou resumo breve">
      </label>
      <div class="rm-linha2">
        <label>Um documento por
          <select id="rmEscopo" class="glx-select">
            <option value="artigo" ${this.doc.tipoDoc === 'artigo' ? 'selected' : ''}>Artigo Científico</option>
            <option value="relatorio" ${this.doc.tipoDoc === 'relatorio' ? 'selected' : ''}>Relatório Técnico</option>
            <option value="monografia" ${this.doc.tipoDoc === 'monografia' ? 'selected' : ''}>Monografia / TCC</option>
            <option value="ensaio" ${this.doc.tipoDoc === 'ensaio' ? 'selected' : ''}>Ensaio / Paper</option>
          </select>
        </label>
        <label>Página
          <select id="rmOrientacao" class="glx-select">
            <option value="retrato" ${mestra.orientacao === 'retrato' ? 'selected' : ''}>A4 retrato</option>
            <option value="paisagem" ${mestra.orientacao === 'paisagem' ? 'selected' : ''}>A4 paisagem</option>
          </select>
        </label>
      </div>

      <div class="rm-filtro-doc-topo" style="margin-top:2px;">
        <span class="rm-rot">Filtro dos documentos (opcional)</span>
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm">+ Filtro</button>
      </div>

      <span class="rm-rot" style="margin-top:6px;">Margens da folha</span>
      <div class="rm-margens">
        <div class="rm-folha-mini" aria-hidden="true"><i id="rmMDiag"></i></div>
        <div class="rm-margens-campos">
          <label class="rm-mm rm-mm-t"><span>Topo</span><div class="rm-mm-in"><input type="number" id="rmMT" min="5" max="50" step="1" value="${margens.t}"><em>mm</em></div></label>
          <label class="rm-mm rm-mm-b"><span>Base</span><div class="rm-mm-in"><input type="number" id="rmMB" min="5" max="50" step="1" value="${margens.b}"><em>mm</em></div></label>
          <label class="rm-mm rm-mm-l"><span>Esquerda</span><div class="rm-mm-in"><input type="number" id="rmML" min="5" max="50" step="1" value="${margens.l}"><em>mm</em></div></label>
          <label class="rm-mm rm-mm-r"><span>Direita</span><div class="rm-mm-in"><input type="number" id="rmMR" min="5" max="50" step="1" value="${margens.r}"><em>mm</em></div></label>
        </div>
        <button type="button" class="rm-ic-bt rm-ic-elo ${this.margemElo ? 'on' : ''}" id="rmMElo" aria-pressed="${this.margemElo}" title="Margens iguais: alterar uma muda as quatro">
          ${svgIcone('elo', 16)}
        </button>
      </div>
      <span class="rm-dica">Dentro das margens a folha tem 12 colunas: cada bloco escolhe onde começa e quantas ocupa.</span>
    `;

    cardCfg.querySelector('#rmNome').addEventListener('input', e => {
      this.doc.titulo = e.target.value;
      const tInput = this.container.querySelector('#athInputTituloDoc');
      if (tInput) tInput.value = e.target.value;
      this.notificarMudanca();
    });

    cardCfg.querySelector('#rmDescricao').addEventListener('input', e => {
      this.doc.subtitulo = e.target.value;
      this.notificarMudanca();
    });

    cardCfg.querySelector('#rmEscopo').addEventListener('change', e => {
      this.doc.tipoDoc = e.target.value;
      this.notificarMudanca();
    });

    cardCfg.querySelector('#rmOrientacao').addEventListener('change', e => {
      mestra.orientacao = e.target.value;
      this.pintarDiagramaMargens();
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    // Lógica das Margens da Folha
    const ligarMargem = (id, chave) => {
      cardCfg.querySelector(id).addEventListener('input', e => {
        const val = parseInt(e.target.value, 10) || 10;
        if (this.margemElo) {
          mestra.margens_mm.t = val;
          mestra.margens_mm.r = val;
          mestra.margens_mm.b = val;
          mestra.margens_mm.l = val;
          for (const campoId of ['#rmMT', '#rmMB', '#rmML', '#rmMR']) {
            const el = cardCfg.querySelector(campoId);
            if (el) el.value = val;
          }
        } else {
          mestra.margens_mm[chave] = val;
        }
        this.pintarDiagramaMargens();
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      });
    };

    ligarMargem('#rmMT', 't');
    ligarMargem('#rmMB', 'b');
    ligarMargem('#rmML', 'l');
    ligarMargem('#rmMR', 'r');

    cardCfg.querySelector('#rmMElo').addEventListener('click', () => {
      this.margemElo = !this.margemElo;
      const eloBtn = cardCfg.querySelector('#rmMElo');
      eloBtn.setAttribute('aria-pressed', String(this.margemElo));
      eloBtn.classList.toggle('on', this.margemElo);
      if (this.margemElo) {
        const tVal = mestra.margens_mm.t;
        mestra.margens_mm.r = tVal;
        mestra.margens_mm.b = tVal;
        mestra.margens_mm.l = tVal;
        cardCfg.querySelector('#rmMR').value = tVal;
        cardCfg.querySelector('#rmMB').value = tVal;
        cardCfg.querySelector('#rmML').value = tVal;
        this.pintarDiagramaMargens();
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      }
    });

    colEsq.appendChild(cardCfg);

    // 2. Accordion SEÇÕES & PÁGINAS MESTRAS
    const secMestras = document.createElement('details');
    secMestras.className = 'rm-sec';
    secMestras.open = true;
    secMestras.innerHTML = `
      <summary>SEÇÕES & PÁGINAS MESTRAS <span class="rm-contagem">(${this.doc.secoes?.length || 1})</span></summary>
      <div style="display:flex; flex-direction:column; gap:6px;" id="rmListaSecoes"></div>
      <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmBtnNovaSecao" style="margin-top:6px; width:100%;">
        + Nova Seção
      </button>
    `;

    const listaSecBox = secMestras.querySelector('#rmListaSecoes');
    (this.doc.secoes || []).forEach((sec, idx) => {
      const item = document.createElement('div');
      item.className = `rm-bl ${sec.id === this.secaoAtivaId ? 'sel' : ''}`;
      const mestraObj = (this.doc.mestras || []).find(m => m.id === sec.mestraId) || {};
      const modo = mestraObj.modo_aplicacao || 'progressiva';

      item.innerHTML = `
        <div class="rm-bl-nome">
          <strong>${sec.nome}</strong>
          <span>${mestraObj.nome || sec.mestraId} · ${modo === 'fixa' ? 'Fixa' : 'Progressiva'}</span>
        </div>
        <div class="rm-bl-acoes">
          <button type="button" class="rm-ic" data-acao="subir" title="Mover seção para cima">${svgIcone('cima', 14)}</button>
          <button type="button" class="rm-ic" data-acao="descer" title="Mover seção para baixo">${svgIcone('baixo', 14)}</button>
          <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover" title="Remover seção">${svgIcone('fechar', 14)}</button>
        </div>
      `;

      item.querySelector('.rm-bl-nome').addEventListener('click', () => {
        this.secaoAtivaId = sec.id;
        this.renderizar();
      });

      item.querySelector('[data-acao="subir"]').addEventListener('click', e => {
        e.stopPropagation();
        moverSecao(this.doc, sec.id, -1);
        this.notificarMudanca();
        this.renderizar();
      });

      item.querySelector('[data-acao="descer"]').addEventListener('click', e => {
        e.stopPropagation();
        moverSecao(this.doc, sec.id, 1);
        this.notificarMudanca();
        this.renderizar();
      });

      item.querySelector('[data-acao="remover"]').addEventListener('click', e => {
        e.stopPropagation();
        if (this.doc.secoes.length > 1) {
          removerSecao(this.doc, sec.id);
          this.secaoAtivaId = this.doc.secoes[0]?.id;
          this.notificarMudanca();
          this.renderizar();
        }
      });

      listaSecBox.appendChild(item);
    });

    secMestras.querySelector('#rmBtnNovaSecao').addEventListener('click', () => {
      const nova = adicionarSecao(this.doc, 'Nova Seção', 'corpo');
      this.secaoAtivaId = nova.id;
      this.notificarMudanca();
      this.renderizar();
    });

    colEsq.appendChild(secMestras);

    // 3. Accordion CABEÇALHO E RODAPÉ
    const secCabRod = document.createElement('details');
    secCabRod.className = 'rm-sec';
    secCabRod.innerHTML = `
      <summary>Cabeçalho e rodapé</summary>
      <label class="rm-chk"><input type="checkbox" id="rmCabAtivo" ${mestra.cabecalho?.ativo ? 'checked' : ''}> Mostrar cabeçalho</label>
      <span class="rm-rot">Logo da empresa</span>
      <label class="rm-arquivo glx-btn glx-btn-soft glx-btn-sm">
        ${svgIcone('imagem', 14)}
        <span>Escolher imagem</span>
        <input type="file" id="rmLogoArq" accept="image/png,image/jpeg,image/webp" hidden>
      </label>
      <span class="rm-dica">PNG, JPEG ou WebP, até 400 KB.</span>
      <label>Linhas do cabeçalho (uma por linha; aceita variáveis)
        <textarea id="rmCabLinhas" rows="3">${mestra.cabecalho?.texto || '{{documento.titulo}}\n{{documento.instituicao}}'}</textarea>
      </label>
      <label>Alinhamento do cabeçalho
        <select id="rmCabAlinha" class="glx-select">
          <option value="esquerda" ${mestra.cabecalho?.alinhamento === 'esquerda' ? 'selected' : ''}>Logo à esquerda</option>
          <option value="direita" ${mestra.cabecalho?.alinhamento === 'direita' ? 'selected' : ''}>Logo à direita</option>
          <option value="centro" ${mestra.cabecalho?.alinhamento === 'centro' ? 'selected' : ''}>Centralizado</option>
        </select>
      </label>
      <label class="rm-chk"><input type="checkbox" id="rmRodAtivo" ${mestra.rodape?.ativo ? 'checked' : ''}> Mostrar rodapé</label>
      <label>Texto do rodapé
        <textarea id="rmRodTexto" rows="2">${mestra.rodape?.texto || 'Athenes · Editor Científico e Acadêmico'}</textarea>
      </label>
      <label class="rm-chk"><input type="checkbox" id="rmRodNum" ${mestra.rodape?.numeracao ? 'checked' : ''}> Numerar páginas ("Página 1 de 3")</label>
    `;

    secCabRod.querySelector('#rmCabAtivo').addEventListener('change', e => {
      mestra.cabecalho = mestra.cabecalho || {};
      mestra.cabecalho.ativo = e.target.checked;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    secCabRod.querySelector('#rmCabLinhas').addEventListener('input', e => {
      mestra.cabecalho = mestra.cabecalho || {};
      mestra.cabecalho.texto = e.target.value;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    secCabRod.querySelector('#rmCabAlinha').addEventListener('change', e => {
      mestra.cabecalho = mestra.cabecalho || {};
      mestra.cabecalho.alinhamento = e.target.value;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    secCabRod.querySelector('#rmRodAtivo').addEventListener('change', e => {
      mestra.rodape = mestra.rodape || {};
      mestra.rodape.ativo = e.target.checked;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    secCabRod.querySelector('#rmRodTexto').addEventListener('input', e => {
      mestra.rodape = mestra.rodape || {};
      mestra.rodape.texto = e.target.value;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    secCabRod.querySelector('#rmRodNum').addEventListener('change', e => {
      mestra.rodape = mestra.rodape || {};
      mestra.rodape.numeracao = e.target.checked;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    colEsq.appendChild(secCabRod);

    // 4. Estilos de texto (lista + salvar) e 5. Blocos (linhas, grupos e arrastar)
    colEsq.appendChild(this.montarSecaoEstilos());
    colEsq.appendChild(this.montarSecaoBlocos(secAtiva));
  }

  /* Menus da barra de blocos (Figura: gráfico, fotografia…; Quadro: campos…) */
  ligarMenusDeBlocos(root, adicionar) {
    const fecharTodos = () => {
      document.querySelectorAll('.rm-menu-bloco:not([hidden])').forEach(m => {
        m.hidden = true;
        m.parentElement.querySelector('.rm-ic-bt')?.setAttribute('aria-expanded', 'false');
      });
    };
    if (!this._menusRegistrados) {
      this._menusRegistrados = true;
      document.addEventListener('click', fecharTodos);
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharTodos(); });
    }

    root.querySelectorAll('.rm-grupo-bt').forEach(grupo => {
      const itens = MENUS_BLOCO[grupo.dataset.grupo] || [];
      const botao = grupo.querySelector('.rm-ic-bt');
      const menu = grupo.querySelector('.rm-menu-bloco');
      menu.innerHTML = itens.map((it, i) => `
        <button type="button" class="rm-menu-item" role="menuitem" data-i="${i}">
          <span class="rm-menu-icone">${svgIcone(it.icone, 16)}</span>
          <span class="rm-menu-texto"><strong>${it.rotulo}</strong><small>${it.desc}</small></span>
        </button>`).join('');

      botao.addEventListener('click', ev => {
        ev.stopPropagation();
        const abrir = menu.hidden;
        fecharTodos();
        menu.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
      });
      menu.querySelectorAll('.rm-menu-item').forEach(el => el.addEventListener('click', ev => {
        ev.stopPropagation();
        const it = itens[Number(el.dataset.i)];
        fecharTodos();
        const dados = it.tipo === 'figura'
          ? { subtipo: it.subtipo, titulo: `${it.rotulo} — Descrição` }
          : (it.tipo === 'quadro' ? { titulo: 'Quadro — Dados conceituais' } : {});
        adicionar(it.tipo, dados);
      }));
    });
  }

  /* ======================================================================
     Estilos de texto: lista selecionável + rascunho + "Salvar estilo"
     ====================================================================== */
  montarSecaoEstilos() {
    const sec = document.createElement('details');
    sec.className = 'rm-sec';
    sec.open = !!this.estilosAberto;
    sec.addEventListener('toggle', () => { this.estilosAberto = sec.open; });

    const estilos = this.doc.estilos || [];
    const estilo = estilos.find(e => e.id === this.estiloSelecionadoId) || estilos[0];
    if (!estilo) {
      sec.innerHTML = '<summary>Estilos de texto</summary><span class="rm-dica">Este documento não tem estilos.</span>';
      return sec;
    }
    this.estiloSelecionadoId = estilo.id;
    if (!this.rascunhoEstilo || this.rascunhoEstilo.id !== estilo.id) {
      this.rascunhoEstilo = JSON.parse(JSON.stringify(estilo));
    }
    const rasc = this.rascunhoEstilo;
    const modificado = () => JSON.stringify(rasc) !== JSON.stringify(estilo);
    const fonteRotulo = id => (FONTES_SISTEMA[id]?.rotulo || id || '').replace(/ \(.*\)$/, '');

    sec.innerHTML = `
      <summary>Estilos de texto <span class="rm-contagem">(${estilos.length})</span></summary>
      <ul class="rm-lista-estilos" id="rmListaEstilos"></ul>
      <div class="rm-estilo-previa" id="rmEstiloPrevia">Aa — Texto de exemplo do estilo</div>
      <label>Nome do estilo
        <input type="text" id="rmEstNome" value="">
      </label>
      <label>Fonte
        <select id="rmEstFonte" class="glx-select">
          ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}">${f.rotulo}</option>`).join('')}
        </select>
      </label>
      <div class="rm-linha2">
        <label>Tamanho (pt)
          <input type="number" id="rmEstTamanho" min="6" max="72" step="0.5">
        </label>
        <label>Peso
          <select id="rmEstPeso" class="glx-select">
            ${PESOS_FONTE.map(p => `<option value="${p.valor}">${p.rotulo}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="rm-linha2">
        <label>Entrelinha
          <input type="number" id="rmEstEntrelinha" step="0.1" min="1" max="3">
        </label>
        <label>Cor
          <div class="rm-cor-linha">
            <input type="color" id="rmEstCor" class="rm-cor">
            <span class="rm-hex" id="rmEstCorHex"></span>
          </div>
        </label>
      </div>
      <div class="rm-icg" id="rmEstAlin"></div>
      <label class="rm-chk"><input type="checkbox" id="rmEstItalico"> Itálico</label>
      <label class="rm-chk"><input type="checkbox" id="rmEstCaixaAlta"> Tudo em caixa-alta</label>
      <div class="rm-estilo-acoes">
        <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="rmEstSalvar">${svgIcone('salvar', 14)} Salvar estilo</button>
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmEstNovo">Salvar como novo</button>
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm rm-perigo" id="rmEstExcluir">Excluir</button>
      </div>
    `;

    // Lista de estilos
    const lista = sec.querySelector('#rmListaEstilos');
    estilos.forEach(est => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `rm-estilo-item ${est.id === estilo.id ? 'on' : ''}`;
      btn.innerHTML = `
        <span class="rm-estilo-amostra" style="color:${est.cor || '#1F2733'}; font-weight:${est.peso || 400}">Aa</span>
        <span class="rm-estilo-nome"><strong>${est.nome}</strong><small>${fonteRotulo(est.fonte)} · ${est.tamanho_pt || 12} pt · ${est.peso || 400}</small></span>
        ${est.personalizado ? '<em class="rm-estilo-tag">seu</em>' : ''}
      `;
      btn.addEventListener('click', () => {
        if (est.id === estilo.id) return;
        if (modificado() && !window.confirm('Descartar as alterações não salvas deste estilo?')) return;
        this.estiloSelecionadoId = est.id;
        this.rascunhoEstilo = null;
        this.estilosAberto = true;
        this.redesenharColunaEsquerda();
      });
      li.appendChild(btn);
      lista.appendChild(li);
    });

    // Campos ligados ao rascunho
    const previa = sec.querySelector('#rmEstiloPrevia');
    const btnSalvar = sec.querySelector('#rmEstSalvar');
    const btnExcluir = sec.querySelector('#rmEstExcluir');
    const alin = sec.querySelector('#rmEstAlin');

    const atualizar = () => {
      previa.style.cssText = `${estiloParaCss(rasc)} margin:0; max-height:84px; overflow:hidden; text-align:${alinhamentoCss(rasc.alinhamento, 'left')}; text-align-last:auto;`;
      sec.querySelector('#rmEstCorHex').textContent = rasc.cor || '#1F2733';
      btnSalvar.disabled = !modificado();
      alin.querySelectorAll('button').forEach(b => {
        const ativo = b.dataset.alin === (rasc.alinhamento || 'esquerda');
        b.classList.toggle('on', ativo);
        b.setAttribute('aria-pressed', String(ativo));
      });
    };

    sec.querySelector('#rmEstNome').value = rasc.nome || '';
    sec.querySelector('#rmEstFonte').value = rasc.fonte || 'nunito';
    sec.querySelector('#rmEstTamanho').value = rasc.tamanho_pt || 12;
    sec.querySelector('#rmEstPeso').value = String(rasc.peso || 400);
    sec.querySelector('#rmEstEntrelinha').value = rasc.entrelinha || 1.5;
    sec.querySelector('#rmEstCor').value = /^#[0-9a-f]{6}$/i.test(rasc.cor || '') ? rasc.cor : '#1F2733';
    sec.querySelector('#rmEstItalico').checked = !!rasc.italico;
    sec.querySelector('#rmEstCaixaAlta').checked = !!rasc.caixa_alta;

    [['esquerda', 'alinhamento_esq', 'À esquerda'], ['centro', 'alinhamento_cen', 'Centralizado'], ['direita', 'alinhamento_dir', 'À direita'], ['justificado', 'alinhamento_jus', 'Justificado']].forEach(([id, icone, titulo]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rm-ic-bt';
      b.dataset.alin = id;
      b.title = titulo;
      b.innerHTML = svgIcone(icone, 16);
      b.addEventListener('click', () => { rasc.alinhamento = id; atualizar(); });
      alin.appendChild(b);
    });

    sec.querySelector('#rmEstNome').addEventListener('input', e => { rasc.nome = e.target.value; atualizar(); });
    sec.querySelector('#rmEstFonte').addEventListener('change', e => { rasc.fonte = e.target.value; atualizar(); });
    sec.querySelector('#rmEstTamanho').addEventListener('input', e => { rasc.tamanho_pt = parseFloat(e.target.value) || 12; atualizar(); });
    sec.querySelector('#rmEstPeso').addEventListener('change', e => { rasc.peso = parseInt(e.target.value, 10); atualizar(); });
    sec.querySelector('#rmEstEntrelinha').addEventListener('input', e => { rasc.entrelinha = parseFloat(e.target.value) || 1.5; atualizar(); });
    sec.querySelector('#rmEstCor').addEventListener('input', e => { rasc.cor = e.target.value; atualizar(); });
    sec.querySelector('#rmEstItalico').addEventListener('change', e => { rasc.italico = e.target.checked; atualizar(); });
    sec.querySelector('#rmEstCaixaAlta').addEventListener('change', e => { rasc.caixa_alta = e.target.checked; atualizar(); });

    btnSalvar.addEventListener('click', () => {
      if (!modificado()) return;
      Object.assign(estilo, JSON.parse(JSON.stringify(rasc)));
      this.rascunhoEstilo = null;
      this.estilosAberto = true;
      this.notificarMudanca();
      this.renderizarFolhasPaginas();
      this.redesenharColunaEsquerda();
    });

    sec.querySelector('#rmEstNovo').addEventListener('click', () => {
      const novo = JSON.parse(JSON.stringify(rasc));
      novo.id = gerarId('estilo');
      novo.personalizado = true;
      if (novo.nome === estilo.nome) novo.nome = `${estilo.nome} (novo)`;
      this.doc.estilos.push(novo);
      this.estiloSelecionadoId = novo.id;
      this.rascunhoEstilo = null;
      this.estilosAberto = true;
      this.notificarMudanca();
      this.redesenharColunaEsquerda();
    });

    btnExcluir.disabled = !estilo.personalizado;
    btnExcluir.title = estilo.personalizado ? 'Excluir este estilo' : 'Estilos padrão do perfil não podem ser excluídos';
    btnExcluir.addEventListener('click', () => {
      if (!estilo.personalizado) return;
      if (!window.confirm(`Excluir o estilo "${estilo.nome}"? Os blocos que o usam voltam para "Corpo de Texto".`)) return;
      for (const s of this.doc.secoes || []) {
        for (const b of s.blocos || []) if (b.estiloId === estilo.id) b.estiloId = 'corpo';
      }
      this.doc.estilos = this.doc.estilos.filter(e => e.id !== estilo.id);
      this.estiloSelecionadoId = this.doc.estilos[0]?.id;
      this.rascunhoEstilo = null;
      this.estilosAberto = true;
      this.notificarMudanca();
      this.renderizarFolhasPaginas();
      this.redesenharColunaEsquerda();
    });

    atualizar();
    return sec;
  }

  redesenharColunaEsquerda() {
    const col = this.container.querySelector('#rmColEsq');
    if (!col) return;
    const rolagem = col.scrollTop;
    this.renderizarColunaEsquerda(col);
    col.scrollTop = rolagem;
  }

  /* ======================================================================
     Lista de blocos: linhas, grupos e arrastar/soltar (mecânica do Clux.js)
     ====================================================================== */
  montarSecaoBlocos(secAtiva) {
    const blocosSecao = secAtiva?.blocos || [];
    const sec = document.createElement('details');
    sec.className = 'rm-sec';
    sec.open = true;
    sec.innerHTML = `
      <summary>BLOCOS <span class="rm-contagem">(${blocosSecao.length})</span></summary>
      <ol class="rm-blocos" id="rmListaBlocosSec"></ol>
      <span class="rm-dica">Arraste um bloco: solte na borda de outro para reordenar ou no centro para colocá-los lado a lado na mesma linha.</span>
    `;
    const ol = sec.querySelector('#rmListaBlocosSec');
    calcularLinhas(blocosSecao).forEach((linha, i) => {
      const cab = document.createElement('li');
      cab.className = 'rm-linha-cab';
      cab.innerHTML = `<span class="rm-linha-num">${i + 1}</span> LINHA ${i + 1}`;
      ol.appendChild(cab);
      if (linha.length > 1) {
        const grupo = document.createElement('li');
        grupo.className = 'rm-grupo';
        const ul = document.createElement('ul');
        ul.className = 'rm-grupo-lista';
        linha.forEach(b => ul.appendChild(this.criarItemBloco(b, secAtiva)));
        grupo.appendChild(ul);
        ol.appendChild(grupo);
      } else {
        ol.appendChild(this.criarItemBloco(linha[0], secAtiva));
      }
    });
    return sec;
  }

  criarItemBloco(b, secAtiva) {
    const li = document.createElement('li');
    li.className = `rm-bl ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;
    li.draggable = true;
    li.innerHTML = `
      <button type="button" class="rm-bl-nome">
        <strong>${rotuloDoBloco(b)}</strong>
        <span>${resumoBloco(b)}</span>
      </button>
      <div class="rm-bl-acoes">
        <button type="button" class="rm-ic" data-acao="subir" title="Subir uma linha">${svgIcone('cima', 14)}</button>
        <button type="button" class="rm-ic" data-acao="descer" title="Descer uma linha">${svgIcone('baixo', 14)}</button>
        <button type="button" class="rm-ic" data-acao="duplicar" title="Duplicar">${svgIcone('copiar', 14)}</button>
        <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover" title="Excluir">${svgIcone('fechar', 14)}</button>
      </div>
    `;

    li.querySelector('.rm-bl-nome').addEventListener('click', () => this.selecionarBloco(b));

    const acao = (nome, fn) => li.querySelector(`[data-acao="${nome}"]`).addEventListener('click', e => {
      e.stopPropagation();
      fn();
    });
    acao('subir', () => { if (moverBlocoPorLinha(this.doc, b.id, -1)) this.aposEstrutura(b); });
    acao('descer', () => { if (moverBlocoPorLinha(this.doc, b.id, 1)) this.aposEstrutura(b); });
    acao('duplicar', () => { const c = duplicarBlocoNaSecao(this.doc, b.id); if (c) this.aposEstrutura(c); });
    acao('remover', () => {
      removerBlocoDaSecao(this.doc, secAtiva.id, b.id);
      this.aposEstrutura(this.blocoSelecionado?.id === b.id ? null : this.blocoSelecionado);
    });

    li.addEventListener('dragstart', ev => this.iniciarArrasto(ev, b, li));
    li.addEventListener('dragend', () => this.encerrarArrasto());
    this.ligarAlvoDeSolta(li, b);
    return li;
  }

  selecionarBloco(b) {
    this.blocoSelecionado = b;
    this.renderizar();
    this.onSelecionarBloco(b, null);
  }

  aposEstrutura(selecionado) {
    this.blocoSelecionado = selecionado || null;
    this.notificarMudanca();
    this.renderizar();
    this.onSelecionarBloco(this.blocoSelecionado, null);
  }

  buscarBlocoPorId(id) {
    for (const s of this.doc.secoes || []) {
      const b = (s.blocos || []).find(x => x.id === id);
      if (b) return b;
    }
    return null;
  }

  iniciarArrasto(ev, bloco, elImagem) {
    this.arrastandoId = bloco.id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('application/x-athenes-bloco', bloco.id);
    if (elImagem) ev.dataTransfer.setDragImage(elImagem, 16, 16);
    setTimeout(() => elImagem?.classList.add('arrastando'), 0);
  }

  encerrarArrasto() {
    this.arrastandoId = null;
    this.limparMarcasSolta();
    this.container.querySelectorAll('.arrastando').forEach(n => n.classList.remove('arrastando'));
  }

  limparMarcasSolta() {
    this.container.querySelectorAll('.drop-antes, .drop-depois, .drop-grupo, .drop-esq, .drop-dir')
      .forEach(n => n.classList.remove('drop-antes', 'drop-depois', 'drop-grupo', 'drop-esq', 'drop-dir'));
  }

  calcularZonaDeSolta(ev, el) {
    const r = el.getBoundingClientRect();
    const y = ev.clientY - r.top;
    const x = ev.clientX - r.left;
    const borda = Math.min(22, r.height * 0.3);
    const zona = y < borda ? 'antes' : (y > r.height - borda ? 'depois' : 'grupo');
    return { zona, aDireita: x >= r.width / 2 };
  }

  ligarAlvoDeSolta(el, bloco) {
    el.addEventListener('dragover', ev => {
      if (!this.arrastandoId || this.arrastandoId === bloco.id) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.dataTransfer.dropEffect = 'move';
      const z = this.calcularZonaDeSolta(ev, el);
      this.limparMarcasSolta();
      el.classList.add(z.zona === 'antes' ? 'drop-antes' : (z.zona === 'depois' ? 'drop-depois' : 'drop-grupo'));
      if (z.zona === 'grupo') el.classList.add(z.aDireita ? 'drop-dir' : 'drop-esq');
    });
    el.addEventListener('dragleave', ev => {
      if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-antes', 'drop-depois', 'drop-grupo', 'drop-esq', 'drop-dir');
    });
    el.addEventListener('drop', ev => {
      if (!this.arrastandoId) return;
      ev.preventDefault();
      ev.stopPropagation();
      const z = this.calcularZonaDeSolta(ev, el);
      const id = this.arrastandoId;
      this.encerrarArrasto();
      if (colocarBloco(this.doc, id, bloco.id, z.zona, z.aDireita)) {
        const movido = this.buscarBlocoPorId(id);
        const sec = (this.doc.secoes || []).find(s => s.blocos.includes(movido));
        if (sec) this.secaoAtivaId = sec.id;
        this.aposEstrutura(movido);
      }
    });
  }

  renderizarFolhasPaginas() {
    const palco = this.container.querySelector('#rmPrevPalco');
    if (!palco) return;
    palco.innerHTML = '';

    repaginarDocumento(this.doc);
    recalcularNumeracaoAutomatica(this.doc);

    const paginas = this.doc.paginas || [];
    const infoPrev = this.container.querySelector('#rmPrevInfo');
    const mestra = this.obterMestraAtiva();
    const paisagem = mestra?.orientacao === 'paisagem';

    if (infoPrev) {
      infoPrev.textContent = `A4 ${paisagem ? 'paisagem' : 'retrato'} · ${paisagem ? '297 × 210' : '210 × 297'} mm · este documento ocupa ${paginas.length} página${paginas.length > 1 ? 's' : ''}`;
    }

    paginas.forEach(pag => {
      try {
      const mestraPag = modeloDaPagina(this.doc, pag);
      const margens = mestraPag?.margens_mm || { t: 25, r: 20, b: 20, l: 25 };

      const folha = document.createElement('div');
      folha.className = `ath-folha-a4 ${mestraPag?.orientacao === 'paisagem' ? 'paisagem' : ''}`;
      folha.dataset.paginaId = pag.id;

      // Margem interna proporcional (conversão mm para px a ~3.78 px/mm)
      const pxPorMm = 3.7795;
      const padTop = margens.t * pxPorMm;
      const padRight = margens.r * pxPorMm;
      const padBottom = margens.b * pxPorMm;
      const padLeft = margens.l * pxPorMm;

      folha.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;

      // Linha indicativa das margens
      const guiaMargem = document.createElement('div');
      guiaMargem.className = 'ath-folha-guia-margem';
      guiaMargem.style.inset = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
      folha.appendChild(guiaMargem);

      // Grade de 12 Colunas (se ativada na barra)
      if (this.guiasVisiveis) {
        const gradeOverlay = document.createElement('div');
        gradeOverlay.className = 'ath-folha-grade-12';
        gradeOverlay.style.inset = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
        for (let i = 0; i < 12; i++) {
          const colEl = document.createElement('div');
          colEl.className = 'ath-col-guia';
          gradeOverlay.appendChild(colEl);
        }
        folha.appendChild(gradeOverlay);
      }

      // Área Útil de Conteúdo
      const areaUtil = document.createElement('div');
      areaUtil.className = 'ath-folha-area-util';

      // Cabeçalho da Página
      if (mestraPag?.cabecalho?.ativo) {
        const cab = document.createElement('div');
        cab.className = 'ath-folha-cabecalho';
        const txtCab = (mestraPag.cabecalho.texto || '')
          .replace(/\{\{?\s*documento\.titulo\s*\}?\}/g, this.doc.titulo || '')
          .replace(/\{\{?\s*documento\.instituicao\s*\}?\}/g, this.doc.metadados?.instituicao || '')
          .replace(/\n/g, ' · ');
        cab.innerHTML = `<span>${txtCab}</span><span>${this.doc.tipoDoc?.toUpperCase() || 'ARTIGO'}</span>`;
        areaUtil.appendChild(cab);
      }

      // Container dos Blocos na folha (Grid de 12 Colunas)
      const gradeBlocos = document.createElement('div');
      gradeBlocos.style.display = 'grid';
      gradeBlocos.style.gridTemplateColumns = 'repeat(12, 1fr)';
      gradeBlocos.style.gap = '10px 12px';
      gradeBlocos.style.alignContent = 'start';

      (pag.blocos || []).forEach(b => {
        const blocoEl = this.renderizarBlocoNaFolha(b, pag);
        gradeBlocos.appendChild(blocoEl);
      });

      areaUtil.appendChild(gradeBlocos);

      // Rodapé da Página com Numeração
      if (mestraPag?.rodape?.ativo) {
        const rod = document.createElement('div');
        rod.className = 'ath-folha-rodape';
        const txtRod = mestraPag.rodape.texto || 'Athenes · Editor de Documentos';
        const numTxt = mestraPag.rodape.numeracao ? `Página ${pag.numero} de ${paginas.length}` : '';
        rod.innerHTML = `<span>${txtRod}</span><span><strong>${numTxt}</strong></span>`;
        areaUtil.appendChild(rod);
      }

      folha.appendChild(areaUtil);
      palco.appendChild(folha);
      } catch (erro) {
        const aviso = document.createElement('div');
        aviso.className = 'rm-vazio-cartao';
        aviso.textContent = 'Não foi possível desenhar a página ' + pag.numero + ': ' + erro.message;
        palco.appendChild(aviso);
      }
    });
  }

  renderizarBlocoNaFolha(b, pag) {
    const el = document.createElement('div');
    el.className = `ath-bloco-folha ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;
    el.style.gridColumn = `${b.col || 1} / span ${b.span || 12}`;

    // Crachá do Bloco
    const cracha = document.createElement('span');
    cracha.className = 'ath-bloco-cracha';
    cracha.textContent = b.tipo;
    el.appendChild(cracha);

    // Seleção ao clicar no bloco
    el.addEventListener('click', e => {
      e.stopPropagation();
      this.blocoSelecionado = b;
      this.container.querySelectorAll('.ath-bloco-folha').forEach(node => node.classList.remove('sel'));
      el.classList.add('sel');
      this.onSelecionarBloco(b, pag);
    });

    const estilo = (this.doc.estilos || []).find(e => e.id === b.estiloId) || {};
    const cssEstilo = estiloParaCss(estilo);

    // 1. TÍTULO
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
      const tag = b.nivel === 1 ? 'h1' : b.nivel === 2 ? 'h2' : 'h3';
      const heading = document.createElement(tag);
      heading.contentEditable = 'true';
      heading.className = 'ath-titulo-editable';
      heading.style.cssText = `${cssEstilo}; margin:0; outline:none; text-align:${alinhamentoCss(b.alinhamento, 'left')};`;
      heading.innerHTML = b.texto || 'Título da Seção';

      heading.addEventListener('input', () => {
        b.texto = heading.innerHTML;
        this.notificarMudancaRapida();
      });
      el.appendChild(heading);
    }

    // 2. PARÁGRAFO
    else if (b.tipo === 'paragrafo') {
      const p = document.createElement('p');
      p.contentEditable = 'true';
      p.className = 'ath-texto-editable';
      p.style.cssText = `${cssEstilo}; margin:0; outline:none; text-align:${alinhamentoCss(b.alinhamento, 'justify')};`;
      p.innerHTML = resolverReferenciasCruzadas(b.texto || '', this.doc);

      p.addEventListener('blur', () => {
        b.texto = p.innerHTML;
        this.notificarMudancaRapida();
      });
      el.appendChild(p);
    }

    // 3. FIGURA COMPOSTA (MULTI-ITENS, LEGENDA E FONTE)
    else if (b.tipo === 'figura' || b.tipo === 'imagem') {
      const figBox = document.createElement('div');
      figBox.className = 'ath-composto-figura';

      // Título da Figura
      const tit = document.createElement('div');
      tit.contentEditable = 'true';
      tit.className = 'ath-fig-titulo';
      tit.innerHTML = b.titulo || `${rotuloDaFigura(b)} ${b.numero_sequencial || 1} — Descrição da Ilustração`;
      tit.addEventListener('blur', () => { b.titulo = tit.innerHTML; this.notificarMudancaRapida(); });
      figBox.appendChild(tit);

      // Grid de Imagens
      const grid = document.createElement('div');
      grid.className = 'ath-fig-grid';
      grid.dataset.layout = b.layout || '1';

      const itens = Array.isArray(b.itens) ? b.itens : [{ url: b.src || '', legenda_sub: 'Visão Geral' }];
      itens.forEach((it, idx) => {
        const itEl = document.createElement('div');
        itEl.className = 'ath-fig-item';
        const imgUrl = it.url || b.src || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';
        itEl.innerHTML = `
          <img src="${imgUrl}" alt="Ilustração">
          <span class="ath-fig-sublegenda">${rotuloDaFigura(b)} ${b.numero_sequencial || 1}${String.fromCharCode(97 + idx)} — ${it.legenda_sub || ''}</span>
        `;
        grid.appendChild(itEl);
      });
      figBox.appendChild(grid);

      // Legenda Geral
      const leg = document.createElement('div');
      leg.contentEditable = 'true';
      leg.className = 'ath-fig-legenda-geral';
      leg.innerHTML = b.legenda_geral || b.legenda || 'Legenda explicativa dos elementos representados.';
      leg.addEventListener('blur', () => { b.legenda_geral = leg.innerHTML; this.notificarMudancaRapida(); });
      figBox.appendChild(leg);

      // Fonte
      const fonte = document.createElement('div');
      fonte.contentEditable = 'true';
      fonte.className = 'ath-bloco-fonte';
      fonte.innerHTML = b.fonte || 'Fonte: Autores (2026).';
      fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
      figBox.appendChild(fonte);

      el.appendChild(figBox);
    }

    // 4. MAPA TERRITORIAL
    else if (b.tipo === 'mapa') {
      const mapaBox = document.createElement('div');
      mapaBox.className = 'ath-composto-mapa';

      const tit = document.createElement('div');
      tit.contentEditable = 'true';
      tit.className = 'ath-mapa-titulo';
      tit.innerHTML = b.titulo || `Mapa ${b.numero_sequencial || 1} — Delimitação territorial`;
      tit.addEventListener('blur', () => { b.titulo = tit.innerHTML; this.notificarMudancaRapida(); });
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

    // 5. TABELA (ABNT/IBGE - SEM BORDAS VERTICAIS NAS LATERAIS)
    else if (b.tipo === 'tabela') {
      const tabBox = document.createElement('div');

      const tit = document.createElement('div');
      tit.contentEditable = 'true';
      tit.className = 'ath-tab-titulo';
      tit.innerHTML = b.titulo || `Tabela ${b.numero_sequencial || 1} — Dados apresentados`;
      tit.addEventListener('blur', () => { b.titulo = tit.innerHTML; this.notificarMudancaRapida(); });
      tabBox.appendChild(tit);

      const table = document.createElement('table');
      table.className = 'ath-tabela-abnt';
      const thead = document.createElement('thead');
      const trH = document.createElement('tr');
      (b.colunas || ['Coluna A', 'Coluna B']).forEach(c => {
        const th = document.createElement('th');
        th.contentEditable = 'true';
        th.textContent = c;
        trH.appendChild(th);
      });
      thead.appendChild(trH);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      (b.linhas || [['Dado 1', 'Dado 2']]).forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tabBox.appendChild(table);

      if (b.notas) {
        const notas = document.createElement('div');
        notas.contentEditable = 'true';
        notas.style.fontSize = '11px';
        notas.style.color = '#64748B';
        notas.innerHTML = `Nota: ${b.notas}`;
        tabBox.appendChild(notas);
      }

      const fonte = document.createElement('div');
      fonte.contentEditable = 'true';
      fonte.className = 'ath-bloco-fonte';
      fonte.innerHTML = b.fonte || 'Fonte: Elaborada pelos autores.';
      fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
      tabBox.appendChild(fonte);

      el.appendChild(tabBox);
    }

    // 6. QUADRO (ABNT - CAIXA TOTALMENTE FECHADA)
    else if (b.tipo === 'quadro') {
      const qBox = document.createElement('div');

      const tit = document.createElement('div');
      tit.contentEditable = 'true';
      tit.className = 'ath-quadro-titulo';
      tit.innerHTML = b.titulo || `Quadro ${b.numero_sequencial || 1} — Categorias conceituais`;
      tit.addEventListener('blur', () => { b.titulo = tit.innerHTML; this.notificarMudancaRapida(); });
      qBox.appendChild(tit);

      const table = document.createElement('table');
      table.className = 'ath-quadro-abnt';
      const thead = document.createElement('thead');
      const trH = document.createElement('tr');
      (b.colunas || ['Categoria', 'Definição']).forEach(c => {
        const th = document.createElement('th');
        th.contentEditable = 'true';
        th.textContent = c;
        trH.appendChild(th);
      });
      thead.appendChild(trH);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      (b.linhas || [['Dimensão A', 'Conteúdo descritivo A']]).forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      qBox.appendChild(table);

      const fonte = document.createElement('div');
      fonte.contentEditable = 'true';
      fonte.className = 'ath-bloco-fonte';
      fonte.innerHTML = b.fonte || 'Fonte: Referencial teórico.';
      fonte.addEventListener('blur', () => { b.fonte = fonte.innerHTML; this.notificarMudancaRapida(); });
      qBox.appendChild(fonte);

      el.appendChild(qBox);
    }

    // 7. FÓRMULA MATEMÁTICA
    else if (b.tipo === 'formula') {
      const fBox = document.createElement('div');
      fBox.className = 'ath-bloco-formula';
      fBox.innerHTML = `
        <div class="ath-formula-corpo">${b.latex || b.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx'}</div>
        <div class="ath-formula-numero">${b.numero_equacao || b.numero || '(1)'}</div>
      `;
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

  pintarDiagramaMargens() {
    const mestra = this.obterMestraAtiva();
    const m = mestra.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
    const paisagem = mestra.orientacao === 'paisagem';
    const W = paisagem ? 297 : 210;
    const H = paisagem ? 210 : 297;

    const diag = this.container.querySelector('#rmMDiag');
    if (!diag) return;
    const folhaMini = diag.parentElement;
    folhaMini.style.aspectRatio = `${W} / ${H}`;
    diag.style.inset = `${(m.t / H) * 100}% ${(m.r / W) * 100}% ${(m.b / H) * 100}% ${(m.l / W) * 100}%`;
  }

  inserirCitacaoNoCursor(ref) {
    if (!ref) return;
    const autor = (ref.autores?.[0]?.sobrenome || 'AUTOR').toUpperCase();
    const ano = ref.ano || new Date().getFullYear();
    const tag = ` (${autor}, ${ano})`;

    if (this.blocoSelecionado && this.blocoSelecionado.texto !== undefined) {
      this.blocoSelecionado.texto += tag;
      this.notificarMudanca();
      this.renderizarFolhasPaginas();
    }
  }

  notificarMudanca() {
    this.salvarSnapshot();
    this.onAlterado(this.doc);
  }

  notificarMudancaRapida() {
    this.agendarSnapshot();
    this.onAlterado(this.doc);
  }

  agendarSnapshot() {
    clearTimeout(this._tSnap);
    this._tSnap = setTimeout(() => this.salvarSnapshot(), 700);
  }

  /** Chamado pelo inspetor: estrutural = mudou linha/posição (redesenha tudo). */
  aposAlteracaoExterna(estrutural) {
    repaginarDocumento(this.doc);
    if (estrutural) {
      this.salvarSnapshot();
      this.renderizar();
    } else {
      this.renderizarFolhasPaginas();
      this.agendarSnapshot();
    }
  }
}
