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
  adicionarSecao,
  removerSecao,
  moverSecao,
  trocarMestraDaSecao,
  recalcularNumeracaoAutomatica,
  resolverReferenciasCruzadas
} from '../core/athenes_documento.js';
import { svgIcone } from './athenes_icones.js';

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

    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onSelecionarBloco = opcoes.onSelecionarBloco || (() => {});
    this.onVoltarDashboard = opcoes.onVoltarDashboard || (() => {});
    this.onAbrirExportar = opcoes.onAbrirExportar || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});

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
      repaginarDocumento(this.doc);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  refazer() {
    if (this.historicoIndice < this.historico.length - 1) {
      this.historicoIndice++;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
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
            <button type="button" class="rm-ic-bt" id="rmAddCampos" data-tip="Campos" title="Inserir Campos / Rótulo e Valor">${svgIcone('campos', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddFigura" data-tip="Figura" title="Inserir Figura / Imagem">${svgIcone('imagem', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddTabela" data-tip="Tabela" title="Inserir Tabela (ABNT/IBGE)">${svgIcone('tabela', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddQuadro" data-tip="Quadro" title="Inserir Quadro Fechado">${svgIcone('quadro', 16)}</button>
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
    root.querySelector('#rmAddCampos').addEventListener('click', () => adicionar('campos', {}));
    root.querySelector('#rmAddFigura').addEventListener('click', () => adicionar('figura', { titulo: 'Figura — Descrição da imagem' }));
    root.querySelector('#rmAddTabela').addEventListener('click', () => adicionar('tabela', { titulo: 'Tabela — Dados quantitativos' }));
    root.querySelector('#rmAddQuadro').addEventListener('click', () => adicionar('quadro', { titulo: 'Quadro — Dados conceituais' }));
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

    // 4. Accordion ESTILOS DE TEXTO
    const secEstilos = document.createElement('details');
    secEstilos.className = 'rm-sec';
    secEstilos.innerHTML = `
      <summary>Estilos de texto</summary>
      <div class="rm-est-chips" id="rmEstilosChips"></div>
      <div id="rmEstiloEditorBox" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;"></div>
    `;

    const chipsBox = secEstilos.querySelector('#rmEstilosChips');
    (this.doc.estilos || []).forEach(est => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `rm-est-chip ${est.id === this.estiloSelecionadoId ? 'on' : ''}`;
      chip.textContent = est.nome;
      chip.addEventListener('click', () => {
        this.estiloSelecionadoId = est.id;
        this.renderizarColunaEsquerda(colEsq);
      });
      chipsBox.appendChild(chip);
    });

    const estAtivo = (this.doc.estilos || []).find(e => e.id === this.estiloSelecionadoId) || this.doc.estilos?.[0];
    if (estAtivo) {
      const edBox = secEstilos.querySelector('#rmEstiloEditorBox');
      edBox.innerHTML = `
        <label>Nome do estilo
          <input type="text" id="rmEstNome" value="${estAtivo.nome}">
        </label>
        <label>Fonte
          <select id="rmEstFonte" class="glx-select">
            ${Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}" ${f.id === estAtivo.fonte ? 'selected' : ''}>${f.rotulo}</option>`).join('')}
          </select>
        </label>
        <div class="rm-linha2">
          <label>Tamanho (pt)
            <input type="number" id="rmEstTamanho" min="6" max="72" value="${estAtivo.tamanho_pt || 12}">
          </label>
          <label>Peso
            <select id="rmEstPeso" class="glx-select">
              ${PESOS_FONTE.map(p => `<option value="${p.valor}" ${p.valor === estAtivo.peso ? 'selected' : ''}>${p.rotulo}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="rm-linha2">
          <label>Entrelinha
            <input type="number" id="rmEstEntrelinha" step="0.1" min="1.0" max="3.0" value="${estAtivo.entrelinha || 1.5}">
          </label>
          <label>Cor
            <div class="rm-cor-linha">
              <input type="color" id="rmEstCor" class="rm-cor" value="${estAtivo.cor || '#1F2733'}">
              <span class="rm-hex" id="rmEstCorHex">${estAtivo.cor || '#1F2733'}</span>
            </div>
          </label>
        </div>
      `;

      edBox.querySelector('#rmEstNome').addEventListener('input', e => { estAtivo.nome = e.target.value; this.notificarMudanca(); });
      edBox.querySelector('#rmEstFonte').addEventListener('change', e => { estAtivo.fonte = e.target.value; this.renderizarFolhasPaginas(); this.notificarMudanca(); });
      edBox.querySelector('#rmEstTamanho').addEventListener('input', e => { estAtivo.tamanho_pt = parseFloat(e.target.value) || 12; this.renderizarFolhasPaginas(); this.notificarMudanca(); });
      edBox.querySelector('#rmEstPeso').addEventListener('change', e => { estAtivo.peso = parseInt(e.target.value, 10); this.renderizarFolhasPaginas(); this.notificarMudanca(); });
      edBox.querySelector('#rmEstEntrelinha').addEventListener('input', e => { estAtivo.entrelinha = parseFloat(e.target.value) || 1.5; this.renderizarFolhasPaginas(); this.notificarMudanca(); });
      edBox.querySelector('#rmEstCor').addEventListener('input', e => {
        estAtivo.cor = e.target.value;
        edBox.querySelector('#rmEstCorHex').textContent = e.target.value;
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      });
    }

    colEsq.appendChild(secEstilos);

    // 5. Accordion BLOCOS (N) da Seção Ativa
    const blocosSecao = secAtiva?.blocos || [];
    const secBlocos = document.createElement('details');
    secBlocos.className = 'rm-sec';
    secBlocos.open = true;
    secBlocos.innerHTML = `
      <summary>BLOCOS <span class="rm-contagem">(${blocosSecao.length})</span></summary>
      <ol class="rm-blocos" id="rmListaBlocosSec"></ol>
    `;

    const olBlocos = secBlocos.querySelector('#rmListaBlocosSec');
    blocosSecao.forEach((b, idx) => {
      const li = document.createElement('li');
      li.className = `rm-bl ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;

      const linhaNum = b.linha_grade || (idx + 1);
      const tituloBloco = b.titulo || b.texto?.replace(/<[^>]+>/g, '').slice(0, 24) || b.tipo;
      const subBloco = b.legenda_geral || b.fonte || (b.tipo === 'tabela' ? `${b.colunas?.length || 3} colunas` : b.tipo);

      li.innerHTML = `
        <div class="rm-bl-nome">
          <span class="rm-linha-num" style="display:inline-block; font-size:10px; font-weight:800; color:#D9531E; margin-bottom:2px;">${linhaNum} LINHA ${linhaNum}</span>
          <strong>${tituloBloco}</strong>
          <span>${subBloco}</span>
        </div>
        <div class="rm-bl-acoes">
          <button type="button" class="rm-ic" data-acao="subir" title="Subir">${svgIcone('cima', 14)}</button>
          <button type="button" class="rm-ic" data-acao="descer" title="Descer">${svgIcone('baixo', 14)}</button>
          <button type="button" class="rm-ic" data-acao="duplicar" title="Duplicar">${svgIcone('copiar', 14)}</button>
          <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover" title="Excluir">${svgIcone('fechar', 14)}</button>
        </div>
      `;

      li.querySelector('.rm-bl-nome').addEventListener('click', () => {
        this.blocoSelecionado = b;
        this.renderizar();
        this.onSelecionarBloco(b, null);
      });

      li.querySelector('[data-acao="subir"]').addEventListener('click', e => {
        e.stopPropagation();
        moverBloco(this.doc, null, b.id, -1);
        this.notificarMudanca();
        this.renderizar();
      });

      li.querySelector('[data-acao="descer"]').addEventListener('click', e => {
        e.stopPropagation();
        moverBloco(this.doc, null, b.id, 1);
        this.notificarMudanca();
        this.renderizar();
      });

      li.querySelector('[data-acao="duplicar"]').addEventListener('click', e => {
        e.stopPropagation();
        duplicarBloco(this.doc, null, b.id);
        this.notificarMudanca();
        this.renderizar();
      });

      li.querySelector('[data-acao="remover"]').addEventListener('click', e => {
        e.stopPropagation();
        removerBlocoDaSecao(this.doc, secAtiva.id, b.id);
        if (this.blocoSelecionado?.id === b.id) this.blocoSelecionado = null;
        this.notificarMudanca();
        this.renderizar();
      });

      olBlocos.appendChild(li);
    });

    colEsq.appendChild(secBlocos);
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
      tit.innerHTML = b.titulo || `Figura ${b.numero_sequencial || 1} — Descrição da Ilustração`;
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
          <span class="ath-fig-sublegenda">Figura ${b.numero_sequencial || 1}${String.fromCharCode(97 + idx)} — ${it.legenda_sub || ''}</span>
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
    this.onAlterado(this.doc);
  }
}
