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
import { estiloParaCss, FONTES_SISTEMA, PESOS_FONTE, criarEstilosPadrao } from '../core/athenes_estilos.js';
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
  dividirBlocoTexto,
  adicionarSecao,
  removerSecao,
  removerMestra,
  moverSecao,
  trocarMestraDaSecao,
  recalcularNumeracaoAutomatica,
  resolverReferenciasCruzadas,
  formatarNumeroPagina,
  gerarCssMolduraBloco,
  buscarSecaoDoBloco,
  obterModelosLayoutBloco,
  aplicarModeloLayoutBloco,
  removerPrefixoNumeracaoTitulo,
  obterTextoPuroTitulo,
  obterPrefixoNumeracao,
  obterTituloCompletoComNumeracao
} from '../core/athenes_documento.js';
import { svgIcone, svgLogo } from './athenes_icones.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { ModalEditorMestra } from './athenes_editor_mestra.js';
import { ModalLayoutBloco } from './athenes_editor_layout_bloco.js';
import { ModalEditorEstilo } from './athenes_editor_estilo_modal.js';
import { ModalCentralEstilos } from './athenes_central_estilos_modal.js';
import {
  MODOS_TRABALHO,
  obterPerfilColaborador,
  salvarPerfilColaborador,
  garantirEstruturaSugestoes,
  registrarSugestao,
  gerarHtmlMarcacaoSugestao,
  aceitarSugestaoNoDocumento,
  rejeitarSugestaoNoDocumento,
  salvarDocumentoNoSupabase,
  listarDocumentosDoSupabase,
  carregarDocumentoDoSupabase,
  SessaoColaborativaRealtime,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive,
  autenticarGoogleDrive,
  salvarArquivoNoGoogleDrive,
  listarArquivosDoGoogleDrive,
  baixarArquivoDoGoogleDrive,
  obterInfoUsuarioGoogle,
  obterOuCriarEstruturaPastasAthenes
} from '../core/athenes_colaboracao.js';

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

function rotuloDoBloco(b, doc = null) {
  if (b.tipo === 'figura') return ROTULOS_FIGURA[b.subtipo] || 'Figura';
  if (b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'paragrafo' || b.tipo === 'texto') {
    if (doc && b.estiloId) {
      const est = (doc.estilos || []).find(e => e.id === b.estiloId);
      if (est) return est.nome;
    }
    return 'Texto';
  }
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

    this.opcoes = opcoes;
    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onSelecionarBloco = opcoes.onSelecionarBloco || (() => {});
    this.onVoltarDashboard = opcoes.onVoltarDashboard || (() => {});
    this.onAbrirExportar = opcoes.onAbrirExportar || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});
    this.onRenderizado = opcoes.onRenderizado || (() => {});
    this.onEditarEstilo = opcoes.onEditarEstilo || (() => {});
    this.onLogout = opcoes.onLogout || (() => {});
    this.menuTopoAberto = null;
    this.modoTrabalho = MODOS_TRABALHO.EDICAO; // 'edicao' | 'sugestao' | 'leitura'
    this.perfilColaborador = obterPerfilColaborador();
    this.colaboradoresOnline = [this.perfilColaborador];
    this.statusNuvem = 'Local + Supabase';

    garantirEstruturaSugestoes(this.doc);
    repaginarDocumento(this.doc);
    this.normalizarBlocosLegados();
    repaginarDocumento(this.doc);
    if (!this.blocoSelecionado) {
      const secIni = this.obterSecaoAtiva();
      this.blocoSelecionado = secIni?.blocos?.[0] || null;
    }
    this.salvarSnapshot();
    this.renderizar();
    this.inicializarBarraContextualTexto();
    this.iniciarSessaoColaborativa();
  }

  iniciarSessaoColaborativa() {
    if (this.sessaoRealtime) {
      this.sessaoRealtime.encerrar();
    }
    this.sessaoRealtime = new SessaoColaborativaRealtime(this.doc, {
      perfil: this.perfilColaborador,
      onPresencaAlterada: (lista) => {
        this.colaboradoresOnline = lista;
        this.atualizarAvataresPresenca();
        this.pintarCursoresRemotosNaFolha();
      },
      onCursorRemoto: () => {
        this.pintarCursoresRemotosNaFolha();
      },
      onBlocoRemotoAlterado: (blocoRemoto, sugestoesRemotas) => {
        const alvo = this.buscarBlocoPorId(blocoRemoto.id);
        if (alvo) {
          Object.assign(alvo, blocoRemoto);
        }
        if (Array.isArray(sugestoesRemotas)) {
          this.doc.sugestoes = sugestoesRemotas;
        }
        this.renderizarFolhasPaginas();
      },
      onDocumentoRemotoAlterado: (docSnap) => {
        this.doc = docSnap;
        repaginarDocumento(this.doc);
        this.renderizar();
      }
    });
    this.sessaoRealtime.iniciar();
  }

  atualizarAvataresPresenca() {
    const box = this.container?.querySelector('#athAvataresPresenca');
    if (!box) return;
    const lista = this.colaboradoresOnline || [this.perfilColaborador];
    box.innerHTML = lista.map(col => {
      const iniciais = String(col.nome || 'U')
        .split(/\s+/)
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const papelRot = col.papel === 'orientador' ? 'Orientador / Professor' : col.papel === 'revisor' ? 'Revisor' : 'Autor';
      return `<span class="ath-avatar-bolinha" style="background:${col.cor || '#314F79'};" title="${col.nome} (${papelRot}) — Online agora">${iniciais}</span>`;
    }).join('');
  }

  pintarCursoresRemotosNaFolha() {
    if (!this.container) return;
    this.container.querySelectorAll('.ath-cursor-remoto-badge').forEach(n => n.remove());
    const remotos = (this.colaboradoresOnline || []).filter(c => c.id !== this.perfilColaborador.id && c.blocoId);
    for (const r of remotos) {
      const elBloco = this.container.querySelector(`.ath-bloco-folha[data-bloco-id="${r.blocoId}"]`);
      if (elBloco) {
        elBloco.style.outline = `2px dashed ${r.cor || '#10B981'}`;
        const badge = document.createElement('span');
        badge.className = 'ath-cursor-remoto-badge';
        badge.style.background = r.cor || '#10B981';
        badge.textContent = r.nome;
        elBloco.appendChild(badge);
      }
    }
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
          ${svgLogo(26)}
          <span>ATHENES</span>
        </a>
        <input type="text" class="ath-doc-titulo-topo" id="athInputTituloDoc" value="${this.doc.titulo || 'Sem título'}" title="Clique para renomear">
        <span class="rm-selo">${(this.doc.perfil || 'abnt').toUpperCase()}</span>
      </div>
      <div class="ath-topo-dir">
        <!-- Presença em Tempo Real (Avatares Online) -->
        <div class="ath-presenca-avatares" id="athAvataresPresenca" title="Colaboradores online neste documento"></div>

        <!-- Seletor dos 3 Modos de Trabalho estilo Google Docs (Edição / Sugestão / Visualização) -->
        <div class="ath-seletor-modo-trabalho" id="athSeletorModoTrabalho" role="group" aria-label="Modo de Trabalho">
          <button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.EDICAO ? 'on' : ''}" data-modo="edicao" title="Modo Edição: edita o documento diretamente">
            ${svgIcone('lapis', 13)} <span>Edição</span>
          </button>
          <button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.SUGESTAO ? 'on' : ''}" data-modo="sugestao" title="Modo Sugestão: alterações ficam marcadas para Aceitar (✓) ou Rejeitar (✗)">
            ${svgIcone('sugestao', 13)} <span>Sugestão</span>
            ${(this.doc.sugestoes?.length > 0) ? `<span style="background:#FFFFFF; color:#059669; border-radius:999px; padding:0 5px; font-size:10px; font-weight:800;">${this.doc.sugestoes.length}</span>` : ''}
          </button>
          <button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.VISUALIZACAO ? 'on' : ''}" data-modo="leitura" title="Modo Visualização: trava o documento somente para leitura">
            ${svgIcone('olho', 13)} <span>Leitura</span>
          </button>
        </div>

        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnAbaZotero">
          ${svgIcone('zotero', 15)} <span>Zotero</span>
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
            <div class="rm-prev-topo-esq">
              <strong>Prévia</strong>
              <span id="rmPrevInfo" class="rm-prev-info"></span>
            </div>
            <div class="rm-prev-menus-topo" id="rmPrevMenusTopo">
              <div class="rm-menu-topo-item" data-menu="arquivo">
                <button type="button" class="rm-btn-menu-topo" id="athBtnMenuArquivo" aria-haspopup="dialog" aria-expanded="false" title="Configurar propriedades do arquivo, formato e margens">
                  ${svgIcone('documento', 14)}
                  <span>Arquivo & Margens</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverArquivo" role="dialog" aria-label="Arquivo e Margens" hidden></div>
              </div>

              <div class="rm-menu-topo-item" data-menu="cabrod">
                <button type="button" class="rm-btn-menu-topo" id="athBtnMenuCabRod" aria-haspopup="dialog" aria-expanded="false" title="Configurar cabeçalho, rodapé e numeração da página">
                  ${svgIcone('subtitulo', 14)}
                  <span>Cabeçalho & Rodapé</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverCabRod" role="dialog" aria-label="Cabeçalho e Rodapé" hidden></div>
              </div>

              <div class="rm-menu-topo-item" data-menu="estilos">
                <button type="button" class="rm-btn-menu-topo" id="athBtnMenuEstilos" aria-haspopup="dialog" aria-expanded="false" title="Estilos tipográficos do documento">
                  ${svgIcone('paragrafo', 14)}
                  <span>Estilos de Texto</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover rm-topo-popover-estilos" id="athPopoverEstilos" role="dialog" aria-label="Estilos de Texto" hidden></div>
              </div>

              <div class="rm-menu-topo-item" data-menu="tema">
                <button type="button" class="rm-btn-menu-topo" id="athBtnMenuTema" title="Central de Estilos & Tema: Importar, Exportar ou Gerar com IA">
                  ${svgIcone('paleta', 14)}
                  <span>Tema & Estilos</span>
                </button>
              </div>

              <div class="rm-menu-topo-item" data-menu="nuvem">
                <button type="button" class="rm-btn-menu-topo" id="athBtnMenuNuvem" aria-haspopup="dialog" aria-expanded="false" title="Supabase Nuvem, Google Drive e Revisões Colaborativas">
                  ${svgIcone('nuvem_ok', 14)}
                  <span>Nuvem & Drive</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverNuvem" role="dialog" aria-label="Nuvem, Google Drive e Revisões" hidden style="width:360px;"></div>
              </div>
            </div>
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
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddFigura" data-tip="Figura" title="Figura, gráfico, fotografia, diagrama…" aria-haspopup="menu" aria-expanded="false">
                ${svgIcone('imagem', 15)}
                <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="5.5" height="3.5" aria-hidden="true">
                  <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
            <button type="button" class="rm-ic-bt" id="rmAddTabela" data-tip="Tabela" title="Inserir Tabela (ABNT/IBGE)">${svgIcone('tabela', 16)}</button>
            <div class="rm-grupo-bt" data-grupo="quadro">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddQuadro" data-tip="Quadro" title="Quadro ou campos (rótulo e valor)" aria-haspopup="menu" aria-expanded="false">
                ${svgIcone('quadro', 15)}
                <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="5.5" height="3.5" aria-hidden="true">
                  <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
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

    // Monta menus suspensos de topo (Arquivo, Cabeçalho/Rodapé, Estilos)
    this.montarMenusTopo(root);

    // Renderiza Coluna Esquerda
    this.renderizarColunaEsquerda(root.querySelector('#rmColEsq'));

    // Renderiza Folhas no Palco Central
    this.renderizarFolhasPaginas();

    // Atualiza diagrama de margens e avatares de presença
    this.pintarDiagramaMargens();
    this.atualizarAvataresPresenca();
    this.pintarCursoresRemotosNaFolha();

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

    // Seletor de Modos de Trabalho estilo Google Docs (Edição / Sugestão / Visualização)
    root.querySelectorAll('.ath-btn-modo-trab').forEach(btn => {
      btn.addEventListener('click', () => {
        const novoModo = btn.dataset.modo;
        if (!novoModo || this.modoTrabalho === novoModo) return;
        this.modoTrabalho = novoModo;
        this.renderizar();
      });
    });

    // Botões de inserção de blocos
    const adicionar = (tipo, dados = {}) => {
      if (this.modoTrabalho === MODOS_TRABALHO.VISUALIZACAO) {
        alert('O documento está em Modo Visualização (Somente Leitura). Mude para Edição ou Sugestão no topo para inserir blocos.');
        return;
      }
      const sec = this.obterSecaoAtiva();
      if (!sec) return;
      const b = criarNovoBloco(tipo, dados);
      const idxSel = this.blocoSelecionado ? (sec.blocos || []).findIndex(x => x.id === this.blocoSelecionado.id) : -1;
      if (idxSel >= 0 && Array.isArray(sec.blocos)) {
        sec.blocos.splice(idxSel + 1, 0, b);
        repaginarDocumento(this.doc);
      } else {
        adicionarBlocoNaSecao(this.doc, sec.id, b);
      }
      this.blocoSelecionado = b;
      this.notificarMudanca();
      this.renderizar();
      this.onSelecionarBloco(b, null);
      requestAnimationFrame(() => {
        const elFolha = this.container?.querySelector(`.ath-bloco-folha[data-bloco-id="${b.id}"]`);
        if (elFolha) {
          try { elFolha.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
        }
      });
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

  montarMenusTopo(root) {
    const mestra = this.obterMestraAtiva();
    const margens = mestra.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
    const estilos = this.doc.estilos || [];

    const popArquivo = root.querySelector('#athPopoverArquivo');
    const popCabRod = root.querySelector('#athPopoverCabRod');
    const popEstilos = root.querySelector('#athPopoverEstilos');
    const popNuvem = root.querySelector('#athPopoverNuvem');

    const btnArquivo = root.querySelector('#athBtnMenuArquivo');
    const btnCabRod = root.querySelector('#athBtnMenuCabRod');
    const btnEstilos = root.querySelector('#athBtnMenuEstilos');
    const btnNuvem = root.querySelector('#athBtnMenuNuvem');

    const popovers = { arquivo: popArquivo, cabrod: popCabRod, estilos: popEstilos, nuvem: popNuvem };
    const botoes = { arquivo: btnArquivo, cabrod: btnCabRod, estilos: btnEstilos, nuvem: btnNuvem };

    const fecharTodos = () => {
      Object.values(popovers).forEach(p => { if (p) p.hidden = true; });
      Object.values(botoes).forEach(b => {
        if (b) {
          b.setAttribute('aria-expanded', 'false');
          b.classList.remove('ativo');
        }
      });
      this.menuTopoAberto = null;
    };

    const togglePopover = (chave) => {
      const p = popovers[chave];
      const b = botoes[chave];
      if (!p || !b) return;
      const estavaAberto = !p.hidden;
      fecharTodos();
      if (!estavaAberto) {
        p.hidden = false;
        b.setAttribute('aria-expanded', 'true');
        b.classList.add('ativo');
        this.menuTopoAberto = chave;
        if (chave === 'arquivo') {
          this.pintarDiagramaMargens();
        }
      }
    };

    btnArquivo.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('arquivo');
    });

    btnCabRod.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('cabrod');
    });

    btnEstilos.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('estilos');
    });

    btnNuvem?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('nuvem');
    });

    root.querySelector('#athBtnMenuTema')?.addEventListener('click', (e) => {
      e.stopPropagation();
      fecharTodos();
      this.abrirModalCentralEstilos();
    });

    // 1. Popover Arquivo & Margens
    popArquivo.innerHTML = `
      <div class="rm-popover-topo-head">
        <strong>Arquivo & Margens</strong>
        <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
      </div>
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

      <span class="rm-rot" style="margin-top:4px;">Margens da folha</span>
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

    popArquivo.querySelector('#rmNome').addEventListener('input', e => {
      this.doc.titulo = e.target.value;
      const tInput = this.container.querySelector('#athInputTituloDoc');
      if (tInput) tInput.value = e.target.value;
      this.notificarMudanca();
    });

    popArquivo.querySelector('#rmDescricao').addEventListener('input', e => {
      this.doc.subtitulo = e.target.value;
      this.notificarMudanca();
    });

    popArquivo.querySelector('#rmEscopo').addEventListener('change', e => {
      this.doc.tipoDoc = e.target.value;
      this.notificarMudanca();
    });

    popArquivo.querySelector('#rmOrientacao').addEventListener('change', e => {
      mestra.orientacao = e.target.value;
      this.pintarDiagramaMargens();
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    const ligarMargem = (id, chave) => {
      popArquivo.querySelector(id).addEventListener('input', e => {
        const val = parseInt(e.target.value, 10) || 10;
        if (this.margemElo) {
          mestra.margens_mm.t = val;
          mestra.margens_mm.r = val;
          mestra.margens_mm.b = val;
          mestra.margens_mm.l = val;
          for (const campoId of ['#rmMT', '#rmMB', '#rmML', '#rmMR']) {
            const el = popArquivo.querySelector(campoId);
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

    popArquivo.querySelector('#rmMElo').addEventListener('click', () => {
      this.margemElo = !this.margemElo;
      const eloBtn = popArquivo.querySelector('#rmMElo');
      eloBtn.setAttribute('aria-pressed', String(this.margemElo));
      eloBtn.classList.toggle('on', this.margemElo);
      if (this.margemElo) {
        const tVal = mestra.margens_mm.t;
        mestra.margens_mm.r = tVal;
        mestra.margens_mm.b = tVal;
        mestra.margens_mm.l = tVal;
        popArquivo.querySelector('#rmMR').value = tVal;
        popArquivo.querySelector('#rmMB').value = tVal;
        popArquivo.querySelector('#rmML').value = tVal;
        this.pintarDiagramaMargens();
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      }
    });

    // 2. Popover Cabeçalho e Rodapé
    popCabRod.innerHTML = `
      <div class="rm-popover-topo-head">
        <strong>Cabeçalho e Rodapé</strong>
        <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
      </div>
      <label class="rm-chk"><input type="checkbox" id="rmCabAtivo" ${mestra.cabecalho?.ativo ? 'checked' : ''}> Mostrar cabeçalho</label>
      <span class="rm-rot">Logo da empresa</span>
      <label class="rm-arquivo glx-btn glx-btn-soft glx-btn-sm" style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
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
      <label class="rm-chk" style="margin-top:6px;"><input type="checkbox" id="rmRodAtivo" ${mestra.rodape?.ativo ? 'checked' : ''}> Mostrar rodapé</label>
      <label>Texto do rodapé
        <textarea id="rmRodTexto" rows="2">${mestra.rodape?.texto || 'Athenes · Editor Científico e Acadêmico'}</textarea>
      </label>
      <label class="rm-chk"><input type="checkbox" id="rmRodNum" ${mestra.rodape?.numeracao ? 'checked' : ''}> Numerar páginas ("Página 1 de 3")</label>
    `;

    popCabRod.querySelector('#rmCabAtivo').addEventListener('change', e => {
      mestra.cabecalho = mestra.cabecalho || {};
      mestra.cabecalho.ativo = e.target.checked;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    popCabRod.querySelector('#rmCabLinhas').addEventListener('input', e => {
      mestra.cabecalho = mestra.cabecalho || {};
      mestra.cabecalho.texto = e.target.value;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    popCabRod.querySelector('#rmCabAlinha').addEventListener('change', e => {
      mestra.cabecalho = mestra.cabecalho || {};
      mestra.cabecalho.alinhamento = e.target.value;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    popCabRod.querySelector('#rmLogoArq')?.addEventListener('change', e => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      const leitor = new FileReader();
      leitor.onload = ev => {
        mestra.cabecalho = mestra.cabecalho || {};
        mestra.cabecalho.logo_base64 = ev.target.result;
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      };
      leitor.readAsDataURL(arq);
    });

    popCabRod.querySelector('#rmRodAtivo').addEventListener('change', e => {
      mestra.rodape = mestra.rodape || {};
      mestra.rodape.ativo = e.target.checked;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    popCabRod.querySelector('#rmRodTexto').addEventListener('input', e => {
      mestra.rodape = mestra.rodape || {};
      mestra.rodape.texto = e.target.value;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    popCabRod.querySelector('#rmRodNum').addEventListener('change', e => {
      mestra.rodape = mestra.rodape || {};
      mestra.rodape.numeracao = e.target.checked;
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    // 3. Popover Estilos de Texto
    const estiloAtivo = estilos.find(e => e.id === this.estiloSelecionadoId) || estilos[0];
    const fonteRotulo = id => (FONTES_SISTEMA[id]?.rotulo || id || '').replace(/ \(.*\)$/, '');

    popEstilos.innerHTML = `
      <div class="rm-popover-topo-head">
        <strong>Estilos de Texto <span class="rm-contagem">(${estilos.length})</span></strong>
        <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
      </div>
      <div style="display:flex; gap:6px; margin-top:6px; margin-bottom:8px;">
        <button type="button" class="glx-btn glx-btn-primary glx-btn-xs" id="rmBtnCentralEstilosTopo" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; height:28px; font-weight:750;">
          ${svgIcone('paleta', 13)} Central de Estilos & IA
        </button>
      </div>
      <ul class="rm-lista-estilos" id="rmListaEstilosTopo" style="max-height:220px; overflow-y:auto; margin-top:4px; margin-bottom:4px; padding:2px;"></ul>
      <div class="rm-estilo-previa" id="rmEstiloPreviaTopo" style="margin-top:6px; margin-bottom:6px;">Aa — Texto de exemplo do estilo</div>
      <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmBtnNovoEstiloTopo" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
        ${svgIcone('mais', 12)} Novo Estilo
      </button>
    `;

    popEstilos.querySelector('#rmBtnCentralEstilosTopo')?.addEventListener('click', () => {
      fecharTodos();
      this.abrirModalCentralEstilos();
    });

    const previaTopo = popEstilos.querySelector('#rmEstiloPreviaTopo');
    const atualizarPreviaTopo = (est) => {
      if (!est || !previaTopo) return;
      previaTopo.style.cssText = `${estiloParaCss(est)} margin-top:6px; margin-bottom:6px; max-height:70px; overflow:hidden; text-align:${alinhamentoCss(est.alinhamento, 'left')}; text-align-last:auto;`;
    };
    if (estiloAtivo) atualizarPreviaTopo(estiloAtivo);

    const listaEstilosTopo = popEstilos.querySelector('#rmListaEstilosTopo');
    estilos.forEach(est => {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.style.margin = '0 0 4px 0';
      const ehSel = (est.id === this.estiloSelecionadoId);
      li.innerHTML = `
        <div class="rm-estilo-item ${ehSel ? 'on' : ''}" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; cursor:pointer; padding:6px 10px; border-radius:10px; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span class="rm-estilo-amostra" style="color:${est.cor || '#1F2733'}; font-weight:${est.peso || 400}; flex:none;">Aa</span>
            <span class="rm-estilo-nome" style="flex:1; min-width:0;">
              <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${est.nome}</strong>
              <small style="color:var(--glx-muted, #6B7585);">${fonteRotulo(est.fonte)} · ${est.tamanho_pt || 12} pt · ${est.peso || 400}</small>
            </span>
            ${est.personalizado ? '<em class="rm-estilo-tag" style="flex:none;">seu</em>' : ''}
          </div>
          <button type="button" class="rm-ic" data-acao="editar-estilo" title="Editar estilo (${est.nome})" style="width:26px; height:26px; flex:none; border-radius:6px; border:1px solid #CBD5E1; background:#fff;">
            ${svgIcone('lapis', 13)}
          </button>
        </div>
      `;

      const itemCard = li.querySelector('.rm-estilo-item');
      const btnEditar = li.querySelector('[data-acao="editar-estilo"]');

      const selecionarEAplicar = () => {
        this.estiloSelecionadoId = est.id;
        popEstilos.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPreviaTopo(est);
        if (this.blocoSelecionado) {
          this.blocoSelecionado.estiloId = est.id;
          this.notificarMudanca();
          this.renderizar();
          this.onSelecionarBloco(this.blocoSelecionado, null);
        }
        fecharTodos();
        this.onEditarEstilo(est);
      };

      itemCard.addEventListener('click', (e) => {
        if (e.target.closest('[data-acao="editar-estilo"]')) return;
        selecionarEAplicar();
      });

      btnEditar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.estiloSelecionadoId = est.id;
        popEstilos.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPreviaTopo(est);
        fecharTodos();
        this.onEditarEstilo(est);
      });

      listaEstilosTopo.appendChild(li);
    });

    popEstilos.querySelector('#rmBtnNovoEstiloTopo').addEventListener('click', () => {
      const novo = {
        id: 'est_' + Date.now().toString(36),
        nome: 'Novo Estilo',
        fonte: 'nunito',
        tamanho_pt: 12,
        peso: 400,
        alinhamento: 'esquerda',
        entrelinha: 1.5,
        espaco_depois_pt: 8,
        espaco_paragrafos_pt: 6,
        cor: '#1F2733',
        personalizado: true
      };
      this.doc.estilos.push(novo);
      this.estiloSelecionadoId = novo.id;
      this.notificarMudanca();
      fecharTodos();
      this.renderizar();
      this.onEditarEstilo(novo);
    });

    // 4. Popover Nuvem (Supabase), Google Drive & Revisões Colaborativas
    if (popNuvem) {
      const sugestoesPendentes = garantirEstruturaSugestoes(this.doc);
      const driveCfg = obterConfigGoogleDrive();
      const perfilColab = this.perfilColaborador;

      popNuvem.innerHTML = `
        <div class="rm-popover-topo-head">
          <strong>Nuvem, Drive & Revisão</strong>
          <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
        </div>

        <!-- Identificação do Colaborador com Login Google / Gmail -->
        <div style="padding:8px 10px; border-radius:10px; background:#F8FAFC; border:1px solid #E2E8F0; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font:800 10.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase;">Identificação / Conta Google</span>
            ${perfilColab.autenticadoGoogle ? '<span style="font-size:9.5px; color:#15803D; font-weight:800; background:#DCFCE7; padding:1px 6px; border-radius:999px;">Conectado</span>' : ''}
          </div>

          ${perfilColab.autenticadoGoogle ? `
            <div class="ath-google-user-badge">
              <img src="${perfilColab.foto || 'https://lh3.googleusercontent.com/avatar_exemplo.png'}" class="ath-google-user-avatar" alt="Avatar">
              <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <span style="font-size:11.5px; font-weight:700; color:#1F2733; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${perfilColab.nome}</span>
                <span style="font-size:10px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${perfilColab.email}</span>
              </div>
              <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnDesconectarGoogle" style="font-size:10px; height:22px; padding:0 6px;" title="Sair da conta Google">Sair</button>
            </div>
          ` : `
            <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnLoginGmail" style="height:32px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;">
              ${svgIcone('google', 14)} Entrar com o Google / Gmail
            </button>
          `}

          <div style="display:grid; grid-template-columns:1fr 115px; gap:6px; align-items:end; margin-top:2px;">
            <label style="font-size:11px;">Nome no cursor/sugestões
              <input type="text" id="athColabNome" value="${perfilColab.nome || 'Autor'}" style="height:28px; font-size:11.5px; padding:3px 8px;">
            </label>
            <label style="font-size:11px;">Papel
              <select id="athColabPapel" class="glx-select" style="height:28px; font-size:11.5px; padding:0 6px;">
                <option value="autor" ${perfilColab.papel === 'autor' ? 'selected' : ''}>Autor</option>
                <option value="orientador" ${perfilColab.papel === 'orientador' ? 'selected' : ''}>Prof. Orientador</option>
                <option value="revisor" ${perfilColab.papel === 'revisor' ? 'selected' : ''}>Coautor / Revisor</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Passo 1 & 3: Supabase Cloud + Realtime -->
        <div style="padding:8px 10px; border-radius:10px; background:#EEF4FA; border:1px solid var(--ath-primary-line, #C8D7E6); display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="font:800 11px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
              ${svgIcone('nuvem_ok', 14)} Nuvem Supabase (Athenes)
            </strong>
            <span id="athBadgeStatusSupabase" style="font:700 10px var(--glx-font); color:#15803D; background:#DCFCE7; padding:2px 7px; border-radius:999px;">Ativo · Realtime</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnSalvarSupabase" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700;">
              ${svgIcone('salvar', 13)} Salvar na Nuvem
            </button>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAbrirSupabase" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700; background:#fff;">
              ${svgIcone('documento', 13)} Abrir da Nuvem
            </button>
          </div>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnCopiarLinkColab" title="Salva na nuvem e copia o link para o professor entrar neste texto em tempo real" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700; background:#fff;">
            ${svgIcone('usuarios', 13)} Copiar link para colaborar
          </button>
          <div id="athListaArquivosSupabase" hidden style="max-height:130px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; margin-top:4px;"></div>
        </div>

        <!-- Passo 4: Google Drive Pessoal (escopo seguro drive.file) -->
        <div style="padding:8px 10px; border-radius:10px; background:#FFFFFF; border:1px solid #CBD5E1; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="font:800 11px var(--glx-font); color:#1F2733; text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
              ${svgIcone('drive', 14)} Google Drive (drive.file)
            </strong>
            <span style="font-size:10px; color:#64748B;">Privacidade segura</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnSalvarDrive" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700;">
              ${svgIcone('salvar', 13)} Salvar no Drive
            </button>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAbrirDrive" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700;">
              ${svgIcone('drive', 13)} Abrir do Drive
            </button>
          </div>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnSincronizarHubDrive" style="height:28px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700; background:#fff;" title="Garante a estrutura sincronizada da pasta Athenes no Drive (Documentos, Zotero e Relatórios)">
            ${svgIcone('pasta', 13)} Sincronizar Pasta Hub (Athenes)
          </button>
          <div id="athListaArquivosDrive" hidden style="max-height:120px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>
        </div>

        <!-- Passo 2: Lista de Sugestões de Revisão (Aceitar ✓ / Rejeitar ✗) -->
        <div style="display:flex; flex-direction:column; gap:6px; border-top:1px solid #E2E8F0; padding-top:8px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="font:800 11px var(--glx-font); color:#065F46; text-transform:uppercase;">
              Sugestões de Revisão (${sugestoesPendentes.length})
            </strong>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnNovaSugestaoDemo" style="font-size:10.5px; height:22px; padding:0 8px;" title="Registrar sugestão no bloco selecionado">
              + Sugerir no bloco
            </button>
          </div>
          <div id="athListaSugestoesPopover" style="max-height:170px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
            ${sugestoesPendentes.length === 0
              ? `<span style="font-size:11.5px; color:#64748B;">Nenhuma sugestão pendente. Ative o modo <b>Sugestão</b> no topo para revisar com marcações verdes/vermelhas.</span>`
              : sugestoesPendentes.map(s => `
                <div class="ath-balao-sugestao" data-sug-card="${s.id}">
                  <div class="ath-balao-sugestao-topo">
                    <span class="ath-balao-sugestao-autor">Sugestão de ${s.autor}</span>
                    <div class="ath-balao-sugestao-acoes">
                      <button type="button" class="ath-btn-sug-aceitar" data-aceitar-sug="${s.id}" title="Aceitar sugestão (✓)">✓ Aceitar</button>
                      <button type="button" class="ath-btn-sug-rejeitar" data-rejeitar-sug="${s.id}" title="Rejeitar sugestão (✗)">✗</button>
                    </div>
                  </div>
                  <div style="font-size:11.5px; color:#1F2733; line-height:1.35;">
                    ${s.textoOriginal ? `<del class="ath-sug-del">${s.textoOriginal}</del> ` : ''}
                    ${s.textoNovo ? `<ins class="ath-sug-ins">${s.textoNovo}</ins>` : ''}
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      `;

      popNuvem.querySelector('#athColabNome')?.addEventListener('change', e => {
        this.perfilColaborador.nome = e.target.value.trim() || 'Autor';
        salvarPerfilColaborador(this.perfilColaborador);
        this.sessaoRealtime?.atualizarPresencaLocal();
        this.atualizarAvataresPresenca();
      });

      popNuvem.querySelector('#athColabPapel')?.addEventListener('change', e => {
        this.perfilColaborador.papel = e.target.value;
        if (e.target.value === 'orientador' && this.perfilColaborador.nome === 'Autor Principal') {
          this.perfilColaborador.nome = 'Prof. Orientador';
          popNuvem.querySelector('#athColabNome').value = 'Prof. Orientador';
        }
        salvarPerfilColaborador(this.perfilColaborador);
        this.sessaoRealtime?.atualizarPresencaLocal();
        this.atualizarAvataresPresenca();
      });

      popNuvem.querySelector('#athBtnSalvarSupabase')?.addEventListener('click', async () => {
        const badge = popNuvem.querySelector('#athBadgeStatusSupabase');
        try {
          if (badge) { badge.textContent = 'Salvando...'; badge.style.background = '#FEF3C7'; badge.style.color = '#92400E'; }
          await salvarDocumentoNoSupabase(this.doc, this.perfilColaborador);
          this.sessaoRealtime?.transmitirDocumento(this.doc);
          if (badge) { badge.textContent = 'Salvo na Nuvem ✓'; badge.style.background = '#DCFCE7'; badge.style.color = '#15803D'; }
        } catch (err) {
          if (badge) { badge.textContent = 'Erro ao salvar'; badge.style.background = '#FEE2E2'; badge.style.color = '#991B1B'; }
          alert(err.message);
        }
      });

      popNuvem.querySelector('#athBtnCopiarLinkColab')?.addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        const rotuloOriginal = btn.innerHTML;
        try {
          btn.textContent = 'Salvando na nuvem...';
          await salvarDocumentoNoSupabase(this.doc, this.perfilColaborador);
          this.sessaoRealtime?.transmitirDocumento(this.doc);
          const link = `${window.location.origin}${window.location.pathname}?doc=${encodeURIComponent(this.doc.id)}`;
          try { await navigator.clipboard.writeText(link); } catch (_) { window.prompt('Copie o link:', link); }
          btn.textContent = 'Link copiado ✓';
        } catch (err) {
          btn.textContent = 'Erro ao gerar link';
          alert(err.message);
        }
        setTimeout(() => { btn.innerHTML = rotuloOriginal; }, 2200);
      });

      popNuvem.querySelector('#athBtnAbrirSupabase')?.addEventListener('click', async () => {
        const boxLista = popNuvem.querySelector('#athListaArquivosSupabase');
        if (!boxLista) return;
        boxLista.hidden = false;
        boxLista.innerHTML = '<span style="font-size:11px; color:#64748B;">Buscando documentos no Supabase...</span>';
        try {
          const docs = await listarDocumentosDoSupabase();
          if (!docs.length) {
            boxLista.innerHTML = '<span style="font-size:11px; color:#64748B;">Nenhum documento salvo na nuvem ainda.</span>';
            return;
          }
          boxLista.innerHTML = docs.map(d => `
            <button type="button" class="ath-ctx-menu-item" data-abrir-supa-id="${d.id}" style="background:#fff; border:1px solid #CBD5E1;">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.titulo}</span>
              <small style="color:#64748B; flex:none;">${d.atualizado_por || ''}</small>
            </button>
          `).join('');
          boxLista.querySelectorAll('[data-abrir-supa-id]').forEach(bt => {
            bt.addEventListener('click', async () => {
              const docCarregado = await carregarDocumentoDoSupabase(bt.dataset.abrirSupaId);
              if (docCarregado) {
                this.setDocumento(docCarregado);
                this.iniciarSessaoColaborativa();
                this.onAlterado(this.doc);
                fecharTodos();
              }
            });
          });
        } catch (err) {
          boxLista.innerHTML = `<span style="font-size:11px; color:#B42318;">${err.message}</span>`;
        }
      });

      // Eventos Google Drive
      // Eventos de Autenticação Google e Pasta Hub
      popNuvem.querySelector('#athBtnLoginGmail')?.addEventListener('click', async () => {
        try {
          const cfg = obterConfigGoogleDrive();
          const token = await autenticarGoogleDrive(cfg.clientId);
          if (token) {
            const info = await obterInfoUsuarioGoogle(token).catch(() => null);
            if (info) {
              this.perfilColaborador.nome = info.name || this.perfilColaborador.nome;
              this.perfilColaborador.email = info.email;
              this.perfilColaborador.foto = info.picture;
              this.perfilColaborador.autenticadoGoogle = true;
              salvarPerfilColaborador(this.perfilColaborador);
            }
            // Cria ou localiza a pasta raiz 'Athenes' e subpastas no Drive
            await obterOuCriarEstruturaPastasAthenes(token);
            this.renderizar();
          }
        } catch (err) {
          alert('Erro na autenticação Google: ' + err.message);
        }
      });

      popNuvem.querySelector('#athBtnDesconectarGoogle')?.addEventListener('click', () => {
        fecharTodos();
        encerrarSessao();
        this.onLogout();
      });

      popNuvem.querySelector('#athBtnSincronizarHubDrive')?.addEventListener('click', async () => {
        try {
          const cfg = obterConfigGoogleDrive();
          const token = cfg.accessToken || await autenticarGoogleDrive(cfg.clientId);
          const est = await obterOuCriarEstruturaPastasAthenes(token);
          alert('Pasta Hub Athenes pronta no Google Drive!\n- Documentos: ' + est.pastaDocumentosId + '\n- Zotero: ' + est.pastaZoteroId + '\n- Relatórios: ' + est.pastaRelatoriosId);
        } catch (err) {
          alert('Erro ao sincronizar pasta Hub: ' + err.message);
        }
      });

      popNuvem.querySelector('#athBtnSalvarDrive')?.addEventListener('click', async () => {
        const cfg = obterConfigGoogleDrive();
        const nomeArq = `${(this.doc.titulo || 'Documento_Athenes').replace(/[^\w\d_-]+/g, '_')}.athenes`;
        if (!cfg.clientId && !cfg.accessToken) {
          // Quando ainda não há Client ID OAuth configurado, permite salvar direto na pasta sincronizada do Google Drive Desktop (.athenes) ou informar Client ID
          const blob = new Blob([JSON.stringify(this.doc, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nomeArq;
          a.click();
          URL.revokeObjectURL(a.href);
          return;
        }
        try {
          const token = cfg.accessToken || await autenticarGoogleDrive(cfg.clientId);
          const salvo = await salvarArquivoNoGoogleDrive({
            nomeArquivo: nomeArq,
            conteudoBlobOuTexto: this.doc,
            accessToken: token,
            driveFileId: this.doc.driveFileId || null
          });
          if (salvo?.id) this.doc.driveFileId = salvo.id;
          alert(`Documento salvo com sucesso no Google Drive (${salvo.name || nomeArq})!`);
        } catch (err) {
          alert(err.message);
        }
      });

      popNuvem.querySelector('#athBtnAbrirDrive')?.addEventListener('click', async () => {
        const cfg = obterConfigGoogleDrive();
        if (!cfg.clientId && !cfg.accessToken) {
          // Seletor rápido de arquivo .athenes/.json (compatível com pasta do Google Drive no computador)
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = '.athenes,.json,application/json';
          inp.onchange = async () => {
            const f = inp.files?.[0];
            if (!f) return;
            const txt = await f.text();
            const parsed = JSON.parse(txt);
            if (parsed && parsed.secoes) {
              this.setDocumento(parsed);
              this.onAlterado(this.doc);
              fecharTodos();
            }
          };
          inp.click();
          return;
        }
        const boxDrive = popNuvem.querySelector('#athListaArquivosDrive');
        if (!boxDrive) return;
        boxDrive.hidden = false;
        boxDrive.innerHTML = '<span style="font-size:11px; color:#64748B;">Consultando Google Drive...</span>';
        try {
          const token = cfg.accessToken || await autenticarGoogleDrive(cfg.clientId);
          const arqs = await listarArquivosDoGoogleDrive(token);
          if (!arqs.length) {
            boxDrive.innerHTML = '<span style="font-size:11px; color:#64748B;">Nenhum arquivo .athenes encontrado no seu Drive.</span>';
            return;
          }
          boxDrive.innerHTML = arqs.map(f => `
            <button type="button" class="ath-ctx-menu-item" data-drive-file="${f.id}">
              <span>${f.name}</span>
            </button>
          `).join('');
          boxDrive.querySelectorAll('[data-drive-file]').forEach(bt => {
            bt.addEventListener('click', async () => {
              const docDrive = await baixarArquivoDoGoogleDrive(bt.dataset.driveFile, token);
              if (docDrive && docDrive.secoes) {
                this.setDocumento(docDrive);
                this.onAlterado(this.doc);
                fecharTodos();
              }
            });
          });
        } catch (err) {
          boxDrive.innerHTML = `<span style="font-size:11px; color:#B42318;">${err.message}</span>`;
        }
      });

      // Eventos de Aceitar / Rejeitar Sugestões
      popNuvem.querySelectorAll('[data-aceitar-sug]').forEach(bt => {
        bt.addEventListener('click', () => {
          aceitarSugestaoNoDocumento(this.doc, bt.dataset.aceitarSug);
          this.notificarMudanca();
          this.renderizar();
        });
      });

      popNuvem.querySelectorAll('[data-rejeitar-sug]').forEach(bt => {
        bt.addEventListener('click', () => {
          rejeitarSugestaoNoDocumento(this.doc, bt.dataset.rejeitarSug);
          this.notificarMudanca();
          this.renderizar();
        });
      });

      popNuvem.querySelector('#athBtnNovaSugestaoDemo')?.addEventListener('click', () => {
        this.criarSugestaoInterativaNoBloco();
      });
    }

    // Fechar ao clicar nos botões 'X'
    root.querySelectorAll('[data-fechar-popover]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        fecharTodos();
      });
    });

    // Fechar ao clicar fora dos itens de menu topo
    if (!this._menusTopoRegistrados) {
      this._menusTopoRegistrados = true;
      document.addEventListener('click', (ev) => {
        if (!ev.target.closest('.rm-menu-topo-item')) {
          fecharTodos();
        }
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') fecharTodos();
      });
    }

    if (this.menuTopoAberto && popovers[this.menuTopoAberto]) {
      popovers[this.menuTopoAberto].hidden = false;
      botoes[this.menuTopoAberto]?.setAttribute('aria-expanded', 'true');
      botoes[this.menuTopoAberto]?.classList.add('ativo');
    }
  }

  renderizarColunaEsquerda(colEsq) {
    if (!colEsq) return;
    colEsq.innerHTML = '';

    const secAtiva = this.obterSecaoAtiva();

    // Metade superior (50%): Páginas Mestras em Uso
    colEsq.appendChild(this.montarCardMestrasEmUso());

    // Metade inferior (50%): Blocos da Seção Ativa
    colEsq.appendChild(this.montarCardBlocos(secAtiva));
  }

  montarCardMestrasEmUso() {
    const cardMestras = document.createElement('div');
    cardMestras.className = 'rm-card-meio-a-meio';
    cardMestras.id = 'athCardMestrasEmUso';

    cardMestras.innerHTML = `
      <div class="rm-card-meio-a-meio-topo">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <strong style="font:800 12px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.08em;">
            Páginas Mestras em Uso <span class="rm-contagem">(${this.doc.secoes?.length || 0})</span>
          </strong>
        </div>

        <!-- Caixa de seleção no topo com maiszinho para adicionar à sequência -->
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px; padding:10px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px;">
          <span style="font:800 11px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em;">Adicionar Mestra à Sequência</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <select id="athSelectAdicionarMestra" class="glx-select" style="flex:1; height:32px; font-size:11.5px; padding:0 8px; border-radius:8px;">
              ${(this.doc.mestras || []).map(m => `
                <option value="${m.id}">${m.nome} (${m.orientacao === 'paisagem' ? 'Paisagem' : 'Retrato'})</option>
              `).join('')}
            </select>
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnAdicionarMestra" title="Adicionar mestra selecionada à sequência do documento" style="width:32px; height:32px; padding:0; flex:none; display:flex; align-items:center; justify-content:center; border-radius:8px;">
              ${svgIcone('mais', 14)}
            </button>
          </div>
          <!-- Gerenciamento do Catálogo de Mestras -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnNovaMestraCatalogo" style="font-size:10.5px; padding:2px 8px; height:22px; display:inline-flex; align-items:center; gap:4px;" title="Criar nova página mestra do zero no catálogo">
              ${svgIcone('mais', 11)} Nova Mestra
            </button>
            <div style="display:flex; align-items:center; gap:4px;">
              <button type="button" class="rm-ic" id="athBtnEditarMestraCatalogo" title="Editar propriedades da mestra selecionada no catálogo" style="width:22px; height:22px;">
                ${svgIcone('lapis', 12)}
              </button>
              <button type="button" class="rm-ic rm-ic-perigo" id="athBtnExcluirMestraCatalogo" title="Excluir esta mestra do catálogo" style="width:22px; height:22px; color:#DC2626;">
                ${svgIcone('lixeira', 12)}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Lista das Seções / Mestras em uso na sequência do documento -->
      <div class="rm-card-meio-a-meio-corpo" id="rmListaMestrasEmUso"></div>
    `;

    const listaEmUsoBox = cardMestras.querySelector('#rmListaMestrasEmUso');
    (this.doc.secoes || []).forEach((sec, idx) => {
      const mestra = (this.doc.mestras || []).find(m => m.id === sec.mestraId) || this.doc.mestras?.[0];
      const ehSecaoAtiva = (sec.id === this.secaoAtivaId);
      const ehPrimeira = (idx === 0);
      const ehUltima = (idx === this.doc.secoes.length - 1);

      const item = document.createElement('div');
      item.className = `rm-mestra-card ${ehSecaoAtiva ? 'sel' : ''}`;
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '4px';
      item.style.padding = '8px 10px';
      item.style.borderRadius = '10px';
      item.style.border = `1px solid ${ehSecaoAtiva ? 'var(--ath-primary, #314F79)' : 'var(--ath-primary-line, #C8D7E6)'}`;
      item.style.background = ehSecaoAtiva ? 'var(--ath-primary-soft, #EEF4FA)' : '#fff';
      item.style.boxSizing = 'border-box';
      item.style.width = '100%';
      item.style.cursor = 'pointer';
      item.style.flexShrink = '0';

      item.innerHTML = `
        <div class="rm-mestra-card-topo" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%;">
          <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:${ehSecaoAtiva ? 'var(--ath-primary, #314F79)' : '#E2E8F0'}; color:${ehSecaoAtiva ? '#fff' : '#475569'}; font:800 11px var(--glx-font); flex:none;">
              ${idx + 1}
            </span>
            <strong class="rm-mestra-titulo" style="font-size:12.5px; font-weight:800; color:var(--ath-text, #1F2733); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;" title="${mestra ? mestra.nome : sec.nome}">
              ${mestra ? mestra.nome : sec.nome}
            </strong>
          </div>
          <div style="display:flex; align-items:center; gap:2px; flex:none;">
            <button type="button" class="rm-ic" data-acao="subir-secao" title="Subir na sequência" style="width:22px; height:22px;" ${ehPrimeira ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>
              ${svgIcone('cima', 12)}
            </button>
            <button type="button" class="rm-ic" data-acao="descer-secao" title="Descer na sequência" style="width:22px; height:22px;" ${ehUltima ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>
              ${svgIcone('baixo', 12)}
            </button>
            <button type="button" class="rm-ic" data-acao="editar-mestra" title="Configurar Mestra (${mestra ? mestra.nome : ''})" style="width:22px; height:22px;">
              ${svgIcone('lapis', 12)}
            </button>
            <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover-secao" title="Tirar da sequência do documento" style="width:22px; height:22px; color:#DC2626;">
              ${svgIcone('fechar', 12)}
            </button>
          </div>
        </div>
        <div class="rm-mestra-card-meta" style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; width:100%; margin-top:2px;">
          <span class="rm-selo" style="font-size:9.5px; padding:2px 7px; white-space:nowrap !important; flex:none;">
            ${mestra?.modo_aplicacao === 'fixa' ? 'Fixa · Grade 2D' : 'Progressiva · Fluxo'}
          </span>
          <span style="font-size:10.5px; color:var(--glx-muted, #6B7585); white-space:nowrap; flex:none;">
            ${mestra?.orientacao === 'paisagem' ? 'Paisagem' : 'Retrato'}
          </span>
          <span style="font-size:10px; color:var(--ath-primary, #314F79); font-weight:700; background:#EAF2FA; padding:1px 6px; border-radius:999px;">
            ${sec.blocos?.length || 0} ${sec.blocos?.length === 1 ? 'bloco' : 'blocos'}
          </span>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.secaoAtivaId = sec.id;
        this.blocoSelecionado = sec.blocos?.[0] || null;
        this.renderizar();
        this.onSelecionarBloco(this.blocoSelecionado, null);
        requestAnimationFrame(() => {
          const pagSec = (this.doc.paginas || []).find(p => p.secaoId === sec.id);
          if (pagSec) {
            const folhaEl = this.container?.querySelector(`.ath-folha-a4[data-pagina-id="${pagSec.id}"]`);
            if (folhaEl) {
              try { folhaEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
            }
          }
        });
      });

      item.querySelector('[data-acao="subir-secao"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (ehPrimeira) return;
        this.secaoAtivaId = sec.id;
        moverSecao(this.doc, sec.id, -1);
        repaginarDocumento(this.doc);
        this.notificarMudanca();
        this.renderizar();
      });

      item.querySelector('[data-acao="descer-secao"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (ehUltima) return;
        this.secaoAtivaId = sec.id;
        moverSecao(this.doc, sec.id, 1);
        repaginarDocumento(this.doc);
        this.notificarMudanca();
        this.renderizar();
      });

      item.querySelector('[data-acao="editar-mestra"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (!mestra) return;
        new ModalEditorMestra(this.doc, mestra.id, {
          onSalvar: () => {
            this.notificarMudanca();
            this.renderizar();
          }
        });
      });

      item.querySelector('[data-acao="remover-secao"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (this.doc.secoes.length <= 1) {
          alert('O documento precisa conter pelo menos uma seção de página mestra.');
          return;
        }
        this.salvarSnapshot();
        removerSecao(this.doc, sec.id);
        const novaSec = this.doc.secoes.find(s => s.id === this.secaoAtivaId) || this.doc.secoes[0];
        this.secaoAtivaId = novaSec?.id || null;
        this.blocoSelecionado = novaSec?.blocos?.[0] || null;
        this.notificarMudanca();
        this.renderizar();
        this.onSelecionarBloco(this.blocoSelecionado, null);
      });

      listaEmUsoBox.appendChild(item);
    });

    const selMestra = cardMestras.querySelector('#athSelectAdicionarMestra');

    cardMestras.querySelector('#athBtnAdicionarMestra').addEventListener('click', () => {
      const mestraId = selMestra.value;
      const mestra = (this.doc.mestras || []).find(m => m.id === mestraId) || this.doc.mestras?.[0];
      if (!mestra) return;
      const nova = adicionarSecao(this.doc, mestra.nome, mestra.id);
      if (!nova.blocos || nova.blocos.length === 0) {
        nova.blocos = [criarNovoBloco('paragrafo', { texto: 'Escreva diretamente neste bloco...' })];
      }
      this.secaoAtivaId = nova.id;
      this.blocoSelecionado = nova.blocos[0] || null;
      repaginarDocumento(this.doc);
      this.notificarMudanca();
      this.renderizar();
      this.onSelecionarBloco(this.blocoSelecionado, null);
      requestAnimationFrame(() => {
        const pagSec = (this.doc.paginas || []).find(p => p.secaoId === nova.id);
        if (pagSec) {
          const folhaEl = this.container?.querySelector(`.ath-folha-a4[data-pagina-id="${pagSec.id}"]`);
          if (folhaEl) {
            try { folhaEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
          }
        }
      });
    });

    cardMestras.querySelector('#athBtnEditarMestraCatalogo').addEventListener('click', () => {
      const mestraId = selMestra.value;
      if (!mestraId) return;
      new ModalEditorMestra(this.doc, mestraId, {
        onSalvar: () => {
          this.notificarMudanca();
          this.renderizar();
        }
      });
    });

    cardMestras.querySelector('#athBtnExcluirMestraCatalogo').addEventListener('click', () => {
      const mestraId = selMestra.value;
      const mestra = (this.doc.mestras || []).find(m => m.id === mestraId);
      if (!mestra) return;

      if ((this.doc.mestras || []).length <= 1) {
        alert('Não é possível excluir a única página mestra do catálogo.');
        return;
      }

      const secoesUso = (this.doc.secoes || []).filter(s => s.mestraId === mestraId);
      let msg = `Deseja excluir a página mestra "${mestra.nome}" do catálogo?`;
      if (secoesUso.length > 0) {
        msg = `A página mestra "${mestra.nome}" está em uso por ${secoesUso.length} seção(ões) do documento.\nAo excluí-la, essas seções serão migradas para a mestra principal.\n\nDeseja continuar?`;
      }
      if (window.confirm && !window.confirm(msg)) return;

      removerMestra(this.doc, mestraId);
      this.notificarMudanca();
      this.renderizar();
    });

    cardMestras.querySelector('#athBtnNovaMestraCatalogo').addEventListener('click', () => {
      const novoId = 'mestra_' + Date.now().toString(36);
      const novaMestra = {
        id: novoId,
        nome: 'Nova Página Mestra',
        tipo: 'personalizada',
        modo_aplicacao: 'progressiva',
        formato: 'a4',
        orientacao: 'retrato',
        margens_mm: { t: 25, r: 20, b: 20, l: 25 },
        grade: { colunas: 1, gap_mm: 4 },
        grade_2d: { linhas: 3, colunas: 3, gap_mm: 4 },
        cabecalho: { ativo: false, texto: '', alinhamento: 'direita', linha_divisoria: true },
        rodape: { ativo: true, texto: 'Athenes', numeracao: true, posicao_numero: 'direita' },
        elementos_recorrentes: []
      };
      this.doc.mestras.push(novaMestra);
      new ModalEditorMestra(this.doc, novoId, {
        onSalvar: () => {
          this.notificarMudanca();
          this.renderizar();
        }
      });
    });

    return cardMestras;
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
    const fonteRotulo = id => (FONTES_SISTEMA[id]?.rotulo || id || '').replace(/ \(.*\)$/, '');

    sec.innerHTML = `
      <summary>ESTILOS DE TEXTO <span class="rm-contagem">(${estilos.length})</span></summary>
      <ul class="rm-lista-estilos" id="rmListaEstilos" style="max-height:260px; overflow-y:auto; margin-top:6px;"></ul>
      <div class="rm-estilo-previa" id="rmEstiloPrevia" style="margin-top:10px; margin-bottom:8px;">Aa — Texto de exemplo do estilo</div>
      <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmBtnNovoEstiloEsq" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:6px;">
        ${svgIcone('mais', 12)} Novo Estilo
      </button>
    `;

    const previa = sec.querySelector('#rmEstiloPrevia');
    const atualizarPrevia = (est) => {
      previa.style.cssText = `${estiloParaCss(est)} margin-top:10px; margin-bottom:8px; max-height:84px; overflow:hidden; text-align:${alinhamentoCss(est.alinhamento, 'left')}; text-align-last:auto;`;
    };
    atualizarPrevia(estilo);

    // Lista de estilos
    const lista = sec.querySelector('#rmListaEstilos');
    estilos.forEach(est => {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.style.margin = '0 0 4px 0';
      const ehSel = (est.id === this.estiloSelecionadoId);
      li.innerHTML = `
        <div class="rm-estilo-item ${ehSel ? 'on' : ''}" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; cursor:pointer; padding:6px 10px; border-radius:10px; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span class="rm-estilo-amostra" style="color:${est.cor || '#1F2733'}; font-weight:${est.peso || 400}; flex:none;">Aa</span>
            <span class="rm-estilo-nome" style="flex:1; min-width:0;">
              <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${est.nome}</strong>
              <small style="color:var(--glx-muted, #6B7585);">${fonteRotulo(est.fonte)} · ${est.tamanho_pt || 12} pt · ${est.peso || 400}</small>
            </span>
            ${est.personalizado ? '<em class="rm-estilo-tag" style="flex:none;">seu</em>' : ''}
          </div>
          <button type="button" class="rm-ic" data-acao="editar-estilo" title="Editar estilo (${est.nome})" style="width:26px; height:26px; flex:none; border-radius:6px; border:1px solid #CBD5E1; background:#fff;">
            ${svgIcone('lapis', 13)}
          </button>
        </div>
      `;

      const itemCard = li.querySelector('.rm-estilo-item');
      const btnEditar = li.querySelector('[data-acao="editar-estilo"]');

      const selecionarEAplicar = () => {
        this.estiloSelecionadoId = est.id;
        sec.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPrevia(est);
        if (this.blocoSelecionado) {
          this.blocoSelecionado.estiloId = est.id;
          this.notificarMudanca();
          this.renderizar();
          this.onSelecionarBloco(this.blocoSelecionado, null);
        }
        this.opcoes.onEditarEstilo?.(est);
      };

      itemCard.addEventListener('click', (e) => {
        if (e.target.closest('[data-acao="editar-estilo"]')) return;
        selecionarEAplicar();
      });

      btnEditar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.estiloSelecionadoId = est.id;
        sec.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPrevia(est);
        this.opcoes.onEditarEstilo?.(est);
      });

      lista.appendChild(li);
    });

    sec.querySelector('#rmBtnNovoEstiloEsq').addEventListener('click', () => {
      const novo = {
        id: 'est_' + Date.now().toString(36),
        nome: 'Novo Estilo',
        fonte: 'nunito',
        tamanho_pt: 12,
        peso: 400,
        alinhamento: 'esquerda',
        entrelinha: 1.5,
        espaco_depois_pt: 8,
        espaco_paragrafos_pt: 6,
        cor: '#1F2733',
        personalizado: true
      };
      this.doc.estilos.push(novo);
      this.estiloSelecionadoId = novo.id;
      this.notificarMudanca();
      this.renderizar();
      this.opcoes.onEditarEstilo?.(novo);
    });

    return sec;
  }

  redesenharColunaEsquerda() {
    const col = this.container.querySelector('#rmColEsq');
    if (!col) return;
    const scrollMestras = col.querySelector('#rmListaMestrasEmUso')?.scrollTop || 0;
    const scrollBlocos = col.querySelector('#athCardBlocosSecao .rm-card-meio-a-meio-corpo')?.scrollTop || 0;
    this.renderizarColunaEsquerda(col);
    const mEl = col.querySelector('#rmListaMestrasEmUso');
    if (mEl) mEl.scrollTop = scrollMestras;
    const bEl = col.querySelector('#athCardBlocosSecao .rm-card-meio-a-meio-corpo');
    if (bEl) bEl.scrollTop = scrollBlocos;
  }

  /* ======================================================================
     Lista de blocos: linhas, grupos e arrastar/soltar (mecânica do Clux.js)
     ====================================================================== */
  montarCardBlocos(secAtiva) {
    const blocosSecao = secAtiva?.blocos || [];
    const card = document.createElement('div');
    card.className = 'rm-card-meio-a-meio';
    card.id = 'athCardBlocosSecao';
    card.innerHTML = `
      <div class="rm-card-meio-a-meio-topo">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <strong style="font:800 12px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.08em;">
            Blocos da Seção <span class="rm-contagem">(${blocosSecao.length})</span>
          </strong>
        </div>
      </div>
      <div class="rm-card-meio-a-meio-corpo">
        <ol class="rm-blocos" id="rmListaBlocosSec"></ol>
      </div>
      <div class="rm-card-meio-a-meio-rodape">
        <span class="rm-dica" style="margin:0; font-size:11px; line-height:1.3; color:var(--glx-muted, #6B7585); display:block;">
          Arraste um bloco: solte na borda de outro para reordenar ou no centro para colocá-los lado a lado na mesma linha.
        </span>
      </div>
    `;
    const ol = card.querySelector('#rmListaBlocosSec');
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
    return card;
  }

  montarSecaoBlocos(secAtiva) {
    return this.montarCardBlocos(secAtiva);
  }

  criarItemBloco(b, secAtiva) {
    const li = document.createElement('li');
    li.className = `rm-bl ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;
    li.dataset.blocoId = b.id;
    li.draggable = true;
    li.innerHTML = `
      <button type="button" class="rm-bl-nome">
        <strong>${rotuloDoBloco(b, this.doc)}</strong>
        <span>${resumoBloco(b)}</span>
      </button>
      <div class="rm-bl-acoes" draggable="false">
        <button type="button" class="rm-ic" data-acao="subir" draggable="false" title="Subir uma linha">${svgIcone('cima', 14)}</button>
        <button type="button" class="rm-ic" data-acao="descer" draggable="false" title="Descer uma linha">${svgIcone('baixo', 14)}</button>
        <button type="button" class="rm-ic" data-acao="duplicar" draggable="false" title="Duplicar">${svgIcone('copiar', 14)}</button>
        <button type="button" class="rm-ic" data-acao="dividir" draggable="false" title="Dividir este bloco em dois">${svgIcone('divisor', 14)}</button>
        <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover" draggable="false" title="Excluir">${svgIcone('fechar', 14)}</button>
      </div>
    `;

    const boxAcoes = li.querySelector('.rm-bl-acoes');
    boxAcoes.addEventListener('mousedown', e => e.stopPropagation());
    boxAcoes.addEventListener('pointerdown', e => e.stopPropagation());

    li.querySelector('.rm-bl-nome').addEventListener('click', () => {
      this.selecionarBloco(b, null, { scrollPage: true });
    });

    const acao = (nome, fn) => {
      const btn = li.querySelector(`[data-acao="${nome}"]`);
      if (!btn) return;
      btn.addEventListener('mousedown', e => e.stopPropagation());
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    };

    acao('subir', () => { if (moverBlocoPorLinha(this.doc, b.id, -1)) this.aposEstrutura(b); });
    acao('descer', () => { if (moverBlocoPorLinha(this.doc, b.id, 1)) this.aposEstrutura(b); });
    acao('duplicar', () => { const c = duplicarBlocoNaSecao(this.doc, b.id); if (c) this.aposEstrutura(c); });
    acao('dividir', () => { this.dividirBlocoAtual(b.id); });
    acao('remover', () => {
      const secReal = buscarSecaoDoBloco(this.doc, b.id) || secAtiva;
      if (secReal) {
        const idxAntigo = (secReal.blocos || []).findIndex(x => x.id === b.id);
        removerBlocoDaSecao(this.doc, secReal.id, b.id);
        let novoSel = this.blocoSelecionado;
        if (this.blocoSelecionado?.id === b.id) {
          const rest = secReal.blocos || [];
          novoSel = rest[Math.min(Math.max(0, idxAntigo), rest.length - 1)] || null;
        }
        this.aposEstrutura(novoSel);
      }
    });

    li.addEventListener('dragstart', ev => {
      if (ev.target.closest('.rm-bl-acoes')) {
        ev.preventDefault();
        return false;
      }
      this.iniciarArrasto(ev, b, li);
    });
    li.addEventListener('dragend', () => this.encerrarArrasto());
    this.ligarAlvoDeSolta(li, b);
    return li;
  }

  atualizarSelecaoVisualBloco(blocoId) {
    if (!this.container) return;
    // 1. Atualiza nos blocos da folha na área de prévia
    this.container.querySelectorAll('.ath-bloco-folha').forEach(node => {
      const match = node.dataset.blocoId === blocoId;
      node.classList.toggle('sel', match);
    });
    // 2. Atualiza na lista de blocos da barra lateral esquerda
    this.container.querySelectorAll('.rm-bl').forEach(node => {
      const match = node.dataset.blocoId === blocoId;
      node.classList.toggle('sel', match);
      if (match) {
        try { node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
      }
    });
  }

  selecionarBloco(b, pag = null, opcoes = {}) {
    this.blocoSelecionado = b;
    let mudouSecao = false;
    if (b) {
      const secReal = buscarSecaoDoBloco(this.doc, b.id);
      if (secReal && secReal.id !== this.secaoAtivaId) {
        this.secaoAtivaId = secReal.id;
        mudouSecao = true;
      }
    }
    if (mudouSecao) {
      this.redesenharColunaEsquerda();
    }
    this.atualizarSelecaoVisualBloco(b?.id);
    this.onSelecionarBloco(b, pag);

    if (opcoes.scrollPage && b && this.container) {
      const elFolha = this.container.querySelector(`.ath-bloco-folha[data-bloco-id="${b.id}"]`);
      if (elFolha) {
        try { elFolha.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
      }
    }
  }

  
  dividirBlocoAtual(blocoId = null, corte = null) {
    const id = blocoId || this.blocoSelecionado?.id;
    if (!id) return;
    const res = dividirBlocoTexto(this.doc, id, corte);
    if (res) {
      this.aposEstrutura(res.novoBloco);
    }
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

      // Elementos Recorrentes da Página Mestra (Nível Editorial)
      if (Array.isArray(mestraPag?.elementos_recorrentes) && mestraPag.elementos_recorrentes.length > 0) {
        const wrapElemMestra = document.createElement('div');
        wrapElemMestra.className = 'ath-folha-elementos-mestra';
        wrapElemMestra.style.position = 'absolute';
        wrapElemMestra.style.inset = '0';
        wrapElemMestra.style.pointerEvents = 'none';
        wrapElemMestra.style.zIndex = '0';

        mestraPag.elementos_recorrentes.forEach(elem => {
          if (elem.tipo === 'foto_capa') {
            const sangria = !!elem.sangria;
            const respRecuo = !sangria && !!elem.respeitar_recuo;
            const folhaW = (paisagem ? 297 : 210) * pxPorMm;
            const folhaH = (paisagem ? 210 : 297) * pxPorMm;
            const topPx = sangria ? 0 : (respRecuo ? padTop + (elem.y_mm || 0) * pxPorMm : (elem.y_mm || 0) * pxPorMm);
            const leftPx = sangria ? 0 : (respRecuo ? padLeft + (elem.x_mm || 0) * pxPorMm : (elem.x_mm || 0) * pxPorMm);
            const wPx = sangria ? folhaW : (respRecuo ? (folhaW - padLeft - padRight) : (elem.largura_mm || 210) * pxPorMm);
            const hPx = sangria ? folhaH : (elem.altura_mm || 140) * pxPorMm;

            const fotoEl = document.createElement('div');
            fotoEl.style.position = 'absolute';
            fotoEl.style.top = `${topPx}px`;
            fotoEl.style.left = `${leftPx}px`;
            fotoEl.style.width = `${wPx}px`;
            fotoEl.style.height = `${hPx}px`;
            fotoEl.style.overflow = 'hidden';
            fotoEl.style.zIndex = elem.camada === 'frente' ? '4' : '0';

            if (elem.url) {
              const img = document.createElement('img');
              img.src = elem.url;
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.objectFit = elem.ajuste || 'cover';
              img.style.opacity = String(elem.opacidade !== undefined ? elem.opacidade : 1);
              fotoEl.appendChild(img);
            } else {
              fotoEl.style.background = 'linear-gradient(135deg, #EEF4FA, #D5E3F0)';
              fotoEl.style.display = 'flex';
              fotoEl.style.flexDirection = 'column';
              fotoEl.style.alignItems = 'center';
              fotoEl.style.justifyContent = 'center';
              fotoEl.style.color = '#314F79';
              fotoEl.style.fontSize = '12px';
              fotoEl.style.fontWeight = '700';
              fotoEl.innerHTML = `<span>🖼 Foto de Capa Livre</span><span style="font-size:10px; opacity:0.8;">${sangria ? 'Sangria Total' : `${elem.largura_mm || 210} × ${elem.altura_mm || 140} mm`}</span>`;
            }
            wrapElemMestra.appendChild(fotoEl);
          } else if (elem.tipo === 'tarja') {
            const altPx = (elem.altura_mm || 8) * pxPorMm;
            const tarjaEl = document.createElement('div');
            tarjaEl.style.position = 'absolute';
            tarjaEl.style.background = elem.cor || '#314F79';
            if (elem.posicao === 'topo') {
              tarjaEl.style.top = '0'; tarjaEl.style.left = '0'; tarjaEl.style.right = '0'; tarjaEl.style.height = `${altPx}px`;
            } else if (elem.posicao === 'base') {
              tarjaEl.style.bottom = '0'; tarjaEl.style.left = '0'; tarjaEl.style.right = '0'; tarjaEl.style.height = `${altPx}px`;
            } else {
              tarjaEl.style.top = '0'; tarjaEl.style.bottom = '0'; tarjaEl.style.left = '0'; tarjaEl.style.width = `${altPx}px`;
            }
            wrapElemMestra.appendChild(tarjaEl);
          } else if (elem.tipo === 'marca_dagua') {
            const marcaEl = document.createElement('div');
            marcaEl.style.position = 'absolute';
            marcaEl.style.top = '50%';
            marcaEl.style.left = '50%';
            marcaEl.style.transform = 'translate(-50%, -50%) rotate(-35deg)';
            marcaEl.style.fontSize = '48px';
            marcaEl.style.fontWeight = '900';
            marcaEl.style.letterSpacing = '8px';
            marcaEl.style.color = elem.cor || '#314F79';
            marcaEl.style.opacity = String(elem.opacidade || 0.12);
            marcaEl.style.textTransform = 'uppercase';
            marcaEl.style.whiteSpace = 'nowrap';
            marcaEl.textContent = elem.texto || 'VERSÃO PRELIMINAR';
            wrapElemMestra.appendChild(marcaEl);
          } else if (elem.tipo === 'rotulo_estatico') {
            const rotEl = document.createElement('div');
            rotEl.style.position = 'absolute';
            rotEl.style.top = `${(elem.y_mm || 12) * pxPorMm}px`;
            rotEl.style.left = `${padLeft}px`;
            rotEl.style.right = `${padRight}px`;
            rotEl.style.textAlign = 'center';
            rotEl.style.fontSize = `${(elem.tamanho_pt || 11) * 1.33}px`;
            rotEl.style.fontWeight = '800';
            rotEl.style.color = elem.cor || '#314F79';
            rotEl.textContent = elem.texto || '';
            wrapElemMestra.appendChild(rotEl);
          } else if (elem.tipo === 'caixa_grade') {
            const molduraEl = document.createElement('div');
            molduraEl.style.position = 'absolute';
            molduraEl.style.border = elem.borda || '1px solid #314F79';
            molduraEl.style.background = elem.fundo || 'rgba(49, 79, 121, 0.04)';
            molduraEl.style.borderRadius = '4px';
            molduraEl.style.padding = '8px';
            molduraEl.style.fontSize = '11px';
            molduraEl.style.fontWeight = '700';
            molduraEl.style.color = elem.cor || '#314F79';
            molduraEl.style.zIndex = elem.camada === 'frente' ? '4' : '0';

            if (elem.posicionamento_modo === 'coordenadas') {
              const sangria = !!elem.sangria;
              const folhaW = (paisagem ? 297 : 210) * pxPorMm;
              const folhaH = (paisagem ? 210 : 297) * pxPorMm;
              const topPx = sangria ? 0 : (elem.y_mm || 20) * pxPorMm;
              const leftPx = sangria ? 0 : (elem.x_mm || 20) * pxPorMm;
              const wPx = sangria ? folhaW : (elem.largura_mm || 170) * pxPorMm;
              const hPx = sangria ? folhaH : (elem.altura_mm || 50) * pxPorMm;
              molduraEl.style.top = `${topPx}px`;
              molduraEl.style.left = `${leftPx}px`;
              molduraEl.style.width = `${wPx}px`;
              molduraEl.style.height = `${hPx}px`;
            } else {
              const lin = mestraPag.grade_2d?.linhas || 3;
              const col = mestraPag.grade_2d?.colunas || 3;
              const alturaUtil = (paisagem ? 210 : 297) * pxPorMm - padTop - padBottom;
              const larguraUtil = (paisagem ? 297 : 210) * pxPorMm - padLeft - padRight;
              const cellH = alturaUtil / lin;
              const cellW = larguraUtil / col;
              molduraEl.style.top = `${padTop + ((elem.linha || 1) - 1) * cellH}px`;
              molduraEl.style.left = `${padLeft + ((elem.coluna || 1) - 1) * cellW}px`;
              molduraEl.style.width = `${Math.max(cellW * (elem.spanColunas || 1) - 8, 40)}px`;
              molduraEl.style.height = `${Math.max(cellH * (elem.spanLinhas || 1) - 8, 40)}px`;
            }
            molduraEl.innerHTML = `<span>${elem.titulo || 'Moldura'}</span>`;
            wrapElemMestra.appendChild(molduraEl);
          }
        });

        folha.appendChild(wrapElemMestra);
      }

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

      // Rodapé da Página com Numeração Completa e Alternada
      if (mestraPag?.rodape?.ativo) {
        const rod = document.createElement('div');
        rod.className = 'ath-folha-rodape';
        const txtRod = mestraPag.rodape.texto || 'Athenes · Editor de Documentos';
        
        let numTxt = '';
        if (mestraPag.rodape.numeracao !== false) {
          numTxt = formatarNumeroPagina(pag.numero, paginas.length, mestraPag.rodape);
        }

        const pos = mestraPag.rodape.posicao_numero || 'direita';
        const ehPar = pag.numero % 2 === 0;

        if (pos === 'alternado') {
          // Espelhado: par = número à esquerda, ímpar = número à direita
          if (ehPar) {
            rod.style.flexDirection = 'row-reverse';
            rod.innerHTML = `<span>${txtRod}</span><span><strong>${numTxt}</strong></span>`;
          } else {
            rod.style.flexDirection = 'row';
            rod.innerHTML = `<span>${txtRod}</span><span><strong>${numTxt}</strong></span>`;
          }
        } else if (pos === 'centro') {
          rod.style.justifyContent = 'center';
          rod.style.gap = '20px';
          rod.innerHTML = `<span>${txtRod}</span><span><strong>${numTxt}</strong></span>`;
        } else if (pos === 'esquerda') {
          rod.style.flexDirection = 'row-reverse';
          rod.innerHTML = `<span>${txtRod}</span><span><strong>${numTxt}</strong></span>`;
        } else {
          rod.style.flexDirection = 'row';
          rod.innerHTML = `<span>${txtRod}</span><span><strong>${numTxt}</strong></span>`;
        }

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

  construirBarraRapidaDoBloco(b, pag) {
    const barra = document.createElement('div');
    barra.className = 'ath-bloco-barra-rapida';
    barra.addEventListener('click', e => e.stopPropagation());

    const ehTexto = b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'paragrafo' || b.tipo === 'texto' || b.tipo === 'citacao';
    const ehFigura = b.tipo === 'figura' || b.tipo === 'imagem';

    if (ehTexto) {
      // 1. Dropdown elegante de estilos diretamente na folha
      const selEst = document.createElement('select');
      selEst.className = 'ath-sel-rapido';
      selEst.title = 'Estilo tipográfico deste bloco';
      const estilos = this.doc.estilos || [];
      selEst.innerHTML = estilos.map(e => `<option value="${e.id}" ${(b.estiloId || 'corpo') === e.id ? 'selected' : ''}>${e.nome}</option>`).join('');
      selEst.addEventListener('change', e => {
        b.estiloId = e.target.value;
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(selEst);

      // 2. Botão toggle de hifenização automática (exem-plo)
      const btnHifen = document.createElement('button');
      btnHifen.type = 'button';
      const hifAtivo = b.hifenizacao !== undefined ? b.hifenizacao : (estilos.find(e => e.id === b.estiloId)?.hifenizacao ?? false);
      btnHifen.className = `ath-btn-rapido ${hifAtivo ? 'ativo' : ''}`;
      btnHifen.title = hifAtivo ? 'Hifenização automática ATIVA (exem-plo) — clique para desativar' : 'Hifenização automática DESATIVADA — clique para ativar';
      btnHifen.innerHTML = '<span style="white-space:nowrap; letter-spacing:0.5px; font-weight:800;">a-b</span>';
      btnHifen.addEventListener('click', (e) => {
        e.stopPropagation();
        b.hifenizacao = !hifAtivo;
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(btnHifen);

      // 3. Botão para abrir edição de estilo diretamente
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'ath-btn-rapido';
      btnEdit.title = 'Editar propriedades deste estilo';
      btnEdit.innerHTML = `${svgIcone('lapis', 12)} <span style="font-weight:700; white-space:nowrap;">Editar</span>`;
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        const est = (this.doc.estilos || []).find(e => e.id === b.estiloId) || this.doc.estilos?.[0];
        if (est) {
          this.selecionarBloco(b, pag);
          new ModalEditorEstilo(this.doc, est, {
            onSalvar: () => {
              this.notificarMudanca();
              this.renderizar();
            }
          });
        }
      });
      barra.appendChild(btnEdit);
    } else if (ehFigura) {
      // 1. Dropdown de Rótulo / Subtipo da Ilustração
      const selSub = document.createElement('select');
      selSub.className = 'ath-sel-rapido';
      selSub.title = 'Rótulo da ilustração';
      const subtipos = [
        { id: 'figura', nome: 'Figura' },
        { id: 'grafico', nome: 'Gráfico' },
        { id: 'fotografia', nome: 'Fotografia' },
        { id: 'diagrama', nome: 'Diagrama' },
        { id: 'fluxograma', nome: 'Fluxograma' },
        { id: 'esquema', nome: 'Esquema' },
        { id: 'croqui', nome: 'Croqui' },
        { id: 'desenho', nome: 'Desenho' },
        { id: 'ilustracao', nome: 'Ilustração' }
      ];
      selSub.innerHTML = subtipos.map(s => `<option value="${s.id}" ${(b.subtipo || 'figura') === s.id ? 'selected' : ''}>${s.nome}</option>`).join('');
      selSub.addEventListener('change', e => {
        b.subtipo = e.target.value;
        b.titulo = obterTituloCompletoComNumeracao(b);
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(selSub);

      // 2. Dropdown de Layout de Imagens
      const selLay = document.createElement('select');
      selLay.className = 'ath-sel-rapido';
      selLay.title = 'Layout de slots de imagens';
      const layouts = [
        { id: '1', nome: '1 Imagem' },
        { id: '2_lado', nome: '2 Lado a Lado' },
        { id: '2_empilhado', nome: '2 Empilhado' },
        { id: '3_linha', nome: '3 em Linha' },
        { id: '4_grade', nome: '4 em Grade (2×2)' },
        { id: '6_grade', nome: '6 em Grade (2×3)' }
      ];
      selLay.innerHTML = layouts.map(l => `<option value="${l.id}" ${(b.layout || '1') === l.id ? 'selected' : ''}>${l.nome}</option>`).join('');
      selLay.addEventListener('change', e => {
        b.layout = e.target.value;
        const q = (b.layout === '2_lado' || b.layout === '2_empilhado') ? 2
          : (b.layout === '3_linha' || b.layout === '3_misto') ? 3
          : (b.layout === '4_grade') ? 4
          : (b.layout === '6_grade') ? 6 : 1;

        if (!Array.isArray(b.itens)) {
          b.itens = [{ url: b.src || '', legenda_sub: 'Item A' }];
        }
        if (b.itens.length > q) {
          // Quando muda para menos imagens, remove e limpa os slots excedentes
          b.itens = b.itens.slice(0, q);
        } else {
          while (b.itens.length < q) {
            b.itens.push({ url: '', legenda_sub: `Item ${String.fromCharCode(97 + b.itens.length).toUpperCase()}` });
          }
        }
        if (q === 1 && b.itens[0]) {
          b.src = b.itens[0].url || '';
        }
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(selLay);

      // 3. Dropdown de Modelos de Apresentação
      const modelosFig = obterModelosLayoutBloco(b.tipo, this.doc);
      if (modelosFig && modelosFig.length > 0) {
        const selMod = document.createElement('select');
        selMod.className = 'ath-sel-rapido';
        selMod.title = 'Modelos de Apresentação';
        const modAtivo = b.modelo_layout_id || (b.moldura_tipo === 'cartao_suave' ? 'figura_cartao' : (b.subgrade_colunas === 2 ? 'figura_legenda_lateral' : 'figura_abnt'));
        selMod.innerHTML = modelosFig.map(m => `<option value="${escapeHtml(m.id)}" ${modAtivo === m.id ? 'selected' : ''}>${escapeHtml(m.nome)}</option>`).join('');
        selMod.addEventListener('change', e => {
          aplicarModeloLayoutBloco(b, e.target.value, this.doc);
          this.notificarMudanca();
          this.renderizar();
        });
        barra.appendChild(selMod);
      }

      // 3. Dropdown de Subgrade / Legenda
      const selSubgrade = document.createElement('select');
      selSubgrade.className = 'ath-sel-rapido';
      selSubgrade.title = 'Estrutura da legenda';
      selSubgrade.innerHTML = `
        <option value="1" ${(!b.subgrade_colunas || b.subgrade_colunas === 1) ? 'selected' : ''}>Vertical</option>
        <option value="2" ${b.subgrade_colunas === 2 ? 'selected' : ''}>Legenda ao Lado</option>
      `;
      selSubgrade.addEventListener('change', e => {
        b.subgrade_colunas = parseInt(e.target.value, 10);
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(selSubgrade);

      // 4. Botão de edição avançada (Abre ModalLayoutBloco)
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'ath-btn-rapido';
      btnEdit.title = 'Editar moldura, slots de imagem e apresentação';
      btnEdit.innerHTML = `${svgIcone('lapis', 12)} <span style="font-weight:700; white-space:nowrap;">Editar</span>`;
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selecionarBloco(b, pag);
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.renderizar();
          }
        });
      });
      barra.appendChild(btnEdit);
    } else {
      // Outros blocos compostos (Tabela, Quadro, Mapa, Fórmula)
      const crachaTxt = document.createElement('span');
      crachaTxt.style.fontSize = '11px';
      crachaTxt.style.fontWeight = '800';
      crachaTxt.style.color = '#314F79';
      crachaTxt.textContent = (TIPO_ROTULO[b.tipo] || b.tipo).toUpperCase();
      barra.appendChild(crachaTxt);

      const modelosBloco = obterModelosLayoutBloco(b.tipo, this.doc);
      if (modelosBloco && modelosBloco.length > 0) {
        const selMod = document.createElement('select');
        selMod.className = 'ath-sel-rapido';
        selMod.title = 'Modelos de Apresentação';
        const modAtivo = b.modelo_layout_id || (b.moldura_tipo === 'cartao_suave' ? (b.tipo === 'formula' ? 'formula_cartao' : 'tabela_cartao') : (b.tipo === 'formula' ? 'formula_limpo' : 'tabela_abnt'));
        selMod.innerHTML = modelosBloco.map(m => `<option value="${escapeHtml(m.id)}" ${modAtivo === m.id ? 'selected' : ''}>${escapeHtml(m.nome)}</option>`).join('');
        selMod.addEventListener('change', e => {
          aplicarModeloLayoutBloco(b, e.target.value, this.doc);
          this.notificarMudanca();
          this.renderizar();
        });
        barra.appendChild(selMod);
      }

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'ath-btn-rapido';
      btnEdit.title = 'Editar propriedades e apresentação';
      btnEdit.innerHTML = `${svgIcone('lapis', 12)} <span style="font-weight:700; white-space:nowrap;">Editar</span>`;
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selecionarBloco(b, pag);
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.renderizar();
          }
        });
      });
      barra.appendChild(btnEdit);
    }

    return barra;
  }

  renderizarBlocoNaFolha(b, pag) {
    const el = document.createElement('div');
    el.className = `ath-bloco-folha ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;
    el.dataset.blocoId = b.id;
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

    const estilo = (this.doc.estilos || []).find(e => e.id === b.estiloId) || {};
    const mestraPag = modeloDaPagina(this.doc, pag);

    // Suporte a grade bidimensional 2D para páginas com mestra Fixa
    if (mestraPag?.modo_aplicacao === 'fixa' && mestraPag?.grade_2d && b.grade_2d) {
      el.style.gridRow = `${b.grade_2d.linha || 1} / span ${b.grade_2d.span_linhas || 1}`;
      el.style.gridColumn = `${b.grade_2d.coluna || 1} / span ${b.grade_2d.span_colunas || 1}`;
    }

    // Mescla estilo base com sobrescritas locais do bloco
    const estiloMesclado = {
      ...estilo,
      ...(b.fonte ? { fonte: b.fonte } : {}),
      ...(b.alinhamento ? { alinhamento: b.alinhamento } : {}),
      ...(b.cor ? { cor: b.cor } : {}),
      ...(b.fundo_ativo ? { fundo_cor: b.fundo_cor || '#FFF2A8' } : {}),
      ...(b.borda_tipo ? { borda_tipo: b.borda_tipo } : {}),
      ...(b.entrelinha ? { entrelinha: b.entrelinha } : {}),
      ...(b.espaco_antes_pt !== undefined ? { espaco_antes_pt: b.espaco_antes_pt } : {}),
      ...(b.espaco_depois_pt !== undefined ? { espaco_depois_pt: b.espaco_depois_pt } : {}),
      ...(b.recuo_primeira_linha_mm !== undefined ? { recuo_primeira_linha_mm: b.recuo_primeira_linha_mm } : {}),
      ...(b.recuo_esquerdo_mm !== undefined ? { recuo_esquerdo_mm: b.recuo_esquerdo_mm } : {}),
      ...(b.recuo_direito_mm !== undefined ? { recuo_direito_mm: b.recuo_direito_mm } : {}),
      ...(b.espacamento_letras_em !== undefined ? { espacamento_letras_em: b.espacamento_letras_em } : {}),
      ...(b.espacamento_palavras_em !== undefined ? { espacamento_palavras_em: b.espacamento_palavras_em } : {}),
      ...(b.hifenizacao !== undefined ? { hifenizacao: b.hifenizacao } : {})
    };
    const cssEstilo = estiloParaCss(estiloMesclado);

    // Espaçamentos e margens verticais entre blocos e entre parágrafos
    const espacoDepoisPt = b.espaco_depois_pt ?? estiloMesclado.espaco_depois_pt ?? 8;
    const espacoAntesPt = b.espaco_antes_pt ?? estiloMesclado.espaco_antes_pt ?? 0;
    el.style.marginTop = `${espacoAntesPt}pt`;
    el.style.marginBottom = `${espacoDepoisPt}pt`;

    const espacoParagrafosPt = b.espaco_paragrafos_pt ?? estiloMesclado.espaco_paragrafos_pt ?? 6;
    el.style.setProperty('--ath-paragrafo-gap', `${espacoParagrafosPt}pt`);

    const ehSomenteLeitura = this.modoTrabalho === MODOS_TRABALHO.VISUALIZACAO;

    // 1. TÍTULO
    if (b.tipo === 'titulo' || b.tipo === 'subtitulo') {
      const tag = b.nivel === 1 ? 'h1' : b.nivel === 2 ? 'h2' : 'h3';
      const heading = document.createElement(tag);
      heading.contentEditable = ehSomenteLeitura ? 'false' : 'true';
      heading.className = 'ath-titulo-editable';
      heading.style.cssText = `${cssEstilo}; margin:0; outline:none;`;
      heading.innerHTML = b.texto || 'Título da Seção';

      heading.addEventListener('input', () => {
        b.texto = heading.innerHTML;
        this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
        this.notificarMudancaRapida();
      });
      el.appendChild(heading);
    }

    // 2. PARÁGRAFO
    else if (b.tipo === 'paragrafo') {
      const p = document.createElement('div');
      p.contentEditable = ehSomenteLeitura ? 'false' : 'true';
      p.className = 'ath-texto-editable';
      p.style.cssText = `${cssEstilo}; outline:none;`;

      let conteudoHtml = b.texto || 'Escreva diretamente neste bloco...';
      if (b.marcador_tipo && b.marcador_tipo !== 'nenhum' && !conteudoHtml.includes('<ul') && !conteudoHtml.includes('<ol')) {
        if (b.marcador_tipo === 'numero') {
          conteudoHtml = `<ol><li>${conteudoHtml}</li></ol>`;
        } else {
          conteudoHtml = `<ul><li>${conteudoHtml}</li></ul>`;
        }
      }

      p.innerHTML = resolverReferenciasCruzadas(conteudoHtml, this.doc);
      this.aplicarConfigListaNoBloco(p, b);

      // Modo Sugestão (estilo Google Docs): intercepta deleção/digitação quando modoTrabalho === 'sugestao'
      p.addEventListener('beforeinput', e => {
        if (this.modoTrabalho !== MODOS_TRABALHO.SUGESTAO) return;
        const tipoIn = e.inputType;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const textoSelecionado = range.toString();

        // Se o professor apaga um trecho selecionado, marca com <del class="ath-sug-del"> (tachado vermelho) sem apagar de verdade
        if ((tipoIn === 'deleteContentBackward' || tipoIn === 'deleteContentForward' || tipoIn === 'deleteByCut') && textoSelecionado.trim()) {
          e.preventDefault();
          const sug = registrarSugestao(this.doc, {
            blocoId: b.id,
            tipo: 'exclusao',
            textoOriginal: textoSelecionado,
            textoNovo: '',
            autor: this.perfilColaborador.nome,
            corAutor: this.perfilColaborador.cor
          });
          const htmlDel = gerarHtmlMarcacaoSugestao(sug);
          document.execCommand('insertHTML', false, htmlDel);
          b.texto = p.innerHTML;
          this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
          this.notificarMudancaRapida();
          return;
        }

        // Se o professor digita substituindo uma seleção, cria sugestão de substituição (<del> + <ins>)
        if (tipoIn === 'insertText' && e.data && textoSelecionado.trim()) {
          e.preventDefault();
          const sug = registrarSugestao(this.doc, {
            blocoId: b.id,
            tipo: 'substituicao',
            textoOriginal: textoSelecionado,
            textoNovo: e.data,
            autor: this.perfilColaborador.nome,
            corAutor: this.perfilColaborador.cor
          });
          const htmlSub = gerarHtmlMarcacaoSugestao(sug);
          document.execCommand('insertHTML', false, htmlSub);
          b.texto = p.innerHTML;
          this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
          this.notificarMudancaRapida();
        }
      });

      p.addEventListener('input', () => {
        b.texto = p.innerHTML;
        this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
      });

      p.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey) {
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

              this.dividirBlocoAtual(b.id, { textoAntes: divAntes.innerHTML, textoDepois: divDepois.innerHTML });
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
        b.texto = p.innerHTML;
        this.notificarMudancaRapida();
      });
      el.appendChild(p);
    }

    // 3. FIGURA COMPOSTA (MULTI-ITENS, SUBGRADE, LEGENDA E FONTE)
    else if (b.tipo === 'figura' || b.tipo === 'imagem') {
      const figBox = document.createElement('div');
      figBox.className = 'ath-composto-figura';
      Object.assign(figBox.style, gerarCssMolduraBloco(b));

      // Estilos tipográficos aplicados
      const estTit = (this.doc.estilos || []).find(e => e.id === b.titulo_estilo_id);
      const estLeg = (this.doc.estilos || []).find(e => e.id === b.legenda_estilo_id);
      const estFonte = (this.doc.estilos || []).find(e => e.id === b.fonte_estilo_id);

      // Título da Figura com Prefixo Intrínseco não-editável
      const tit = document.createElement('div');
      tit.className = 'ath-fig-titulo';
      const rot = rotuloDaFigura(b);
      const num = b.numero_sequencial || 1;
      const prefixoStr = `${rot} ${num} — `;
      const textoPuro = obterTextoPuroTitulo(b) || 'Descrição da Ilustração';

      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoStr}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuro}</span>
      `;
      if (estTit) {
        tit.style.fontFamily = FONTES_SISTEMA[estTit.fonte]?.familia || 'inherit';
        tit.style.fontSize = `${estTit.tamanho_pt || 12}pt`;
        tit.style.fontWeight = estTit.peso || '700';
        if (estTit.cor) tit.style.color = estTit.cor;
      }
      if (b.titulo_alinhamento && b.titulo_alinhamento !== 'estilo') {
        tit.style.textAlign = b.titulo_alinhamento;
      }
      const spanEditavel = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavel.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavel.innerText.trim());
        this.notificarMudancaRapida();
      });

      // Grid de Imagens (limitado estritamente à quantidade de slots do layout ativo)
      const grid = document.createElement('div');
      grid.className = 'ath-fig-grid';
      grid.dataset.layout = b.layout || '1';

      // Dimensionamento, proporção e recorte da imagem
      const imgStyleArr = [];
      if (b.altura_modo && b.altura_modo !== 'auto') {
        imgStyleArr.push(`height:${b.altura_modo}; max-height:none;`);
      } else if (b.altura_imagem_px) {
        imgStyleArr.push(`height:${b.altura_imagem_px}px; max-height:none;`);
      }
      if (b.proporcao_imagem && b.proporcao_imagem !== 'livre') {
        imgStyleArr.push(`aspect-ratio:${b.proporcao_imagem};`);
      }
      if (b.ajuste_enquadramento) {
        imgStyleArr.push(`object-fit:${b.ajuste_enquadramento};`);
      }
      const inlineImgStyle = imgStyleArr.join(' ');

      const qtdSlots = (b.layout === '2_lado' || b.layout === '2_empilhado') ? 2
        : (b.layout === '3_linha' || b.layout === '3_misto') ? 3
        : (b.layout === '4_grade') ? 4
        : (b.layout === '6_grade') ? 6 : 1;

      // Se o bloco tiver itens excedentes em relação ao layout ativo, limpa imediatamente
      if (Array.isArray(b.itens) && b.itens.length > qtdSlots) {
        b.itens = b.itens.slice(0, qtdSlots);
      }
      const itens = (Array.isArray(b.itens) ? b.itens : [{ url: b.src || '', legenda_sub: 'Visão Geral' }]).slice(0, qtdSlots);
      itens.forEach((it, idx) => {
        const itEl = document.createElement('div');
        itEl.className = 'ath-fig-item';

        const alinImg = b.alinhamento_imagem || 'centro';
        if (alinImg === 'esquerda') itEl.style.alignItems = 'flex-start';
        else if (alinImg === 'direita') itEl.style.alignItems = 'flex-end';
        else itEl.style.alignItems = 'center';

        const imgUrl = it.url || b.src || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';
        const subLegHtml = (qtdSlots > 1 && it.legenda_sub) 
          ? `<span class="ath-fig-sublegenda">${rotuloDaFigura(b)} ${b.numero_sequencial || 1}${String.fromCharCode(97 + idx)} — ${it.legenda_sub}</span>`
          : '';

        itEl.innerHTML = `
          <img src="${imgUrl}" alt="Ilustração" ${inlineImgStyle ? `style="${inlineImgStyle}"` : ''}>
          ${subLegHtml}
        `;
        grid.appendChild(itEl);
      });

      // Legenda Geral
      let leg = null;
      if (b.mostrar_legenda !== false) {
        leg = document.createElement('div');
        leg.contentEditable = 'true';
        leg.className = 'ath-fig-legenda-geral';
        leg.innerHTML = b.legenda_geral || b.legenda || 'Legenda explicativa dos elementos representados.';
        if (estLeg) {
          leg.style.fontFamily = FONTES_SISTEMA[estLeg.fonte]?.familia || 'inherit';
          leg.style.fontSize = `${estLeg.tamanho_pt || 11}pt`;
          leg.style.fontWeight = estLeg.peso || '400';
          if (estLeg.cor) leg.style.color = estLeg.cor;
        }
        if (b.legenda_alinhamento && b.legenda_alinhamento !== 'estilo') {
          leg.style.textAlign = b.legenda_alinhamento === 'justificado_esquerda' ? 'justify' : b.legenda_alinhamento;
        }
        leg.addEventListener('blur', () => { b.legenda_geral = leg.innerHTML; this.notificarMudancaRapida(); });
      }

      // Fonte
      let fonte = null;
      if (b.mostrar_fonte !== false) {
        fonte = document.createElement('div');
        fonte.contentEditable = 'true';
        fonte.className = 'ath-bloco-fonte';
        fonte.innerHTML = b.fonte || 'Fonte: Autores (2026).';
        if (estFonte) {
          fonte.style.fontFamily = FONTES_SISTEMA[estFonte.fonte]?.familia || 'inherit';
          fonte.style.fontSize = `${estFonte.tamanho_pt || 10.5}pt`;
          fonte.style.fontWeight = estFonte.peso || '400';
          if (estFonte.cor) fonte.style.color = estFonte.cor;
        }
        if (b.fonte_alinhamento && b.fonte_alinhamento !== 'estilo') {
          fonte.style.textAlign = b.fonte_alinhamento;
        }
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
      const prefixoMapa = `Mapa ${b.numero_sequencial || 1} — `;
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
      const prefixoTab = `Tabela ${b.numero_sequencial || 1} — `;
      const textoPuroTab = obterTextoPuroTitulo(b) || 'Dados apresentados';
      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoTab}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuroTab}</span>
      `;
      const spanEditavelTab = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavelTab.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavelTab.innerText.trim());
        this.notificarMudancaRapida();
      });
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

      if (b.notas && b.mostrar_legenda !== false) {
        const notas = document.createElement('div');
        notas.contentEditable = 'true';
        notas.style.fontSize = '11px';
        notas.style.color = '#64748B';
        notas.innerHTML = `Nota: ${b.notas}`;
        tabBox.appendChild(notas);
      }

      if (b.mostrar_fonte !== false) {
        const fonte = document.createElement('div');
        fonte.contentEditable = 'true';
        fonte.className = 'ath-bloco-fonte';
        fonte.innerHTML = b.fonte || 'Fonte: Elaborada pelos autores.';
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
      const prefixoQuadro = `Quadro ${b.numero_sequencial || 1} — `;
      const textoPuroQuadro = obterTextoPuroTitulo(b) || 'Categorias conceituais';
      tit.innerHTML = `
        <span class="ath-num-prefixo-fixo" contenteditable="false" style="user-select:none; font-weight:800; color:var(--ath-primary, #314F79); margin-right:4px;">${prefixoQuadro}</span><span class="ath-titulo-texto-editavel" contenteditable="true" style="outline:none;">${textoPuroQuadro}</span>
      `;
      const spanEditavelQuadro = tit.querySelector('.ath-titulo-texto-editavel');
      spanEditavelQuadro.addEventListener('blur', () => {
        b.titulo = removerPrefixoNumeracaoTitulo(spanEditavelQuadro.innerText.trim());
        this.notificarMudancaRapida();
      });
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

      if (b.mostrar_fonte !== false) {
        const fonte = document.createElement('div');
        fonte.contentEditable = 'true';
        fonte.className = 'ath-bloco-fonte';
        fonte.innerHTML = b.fonte || 'Fonte: Referencial teórico.';
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
      const corpoFormula = `<div class="ath-formula-corpo" style="flex:1; text-align:center;">${b.latex || b.formula || 'f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx'}</div>`;
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

  criarSugestaoInterativaNoBloco() {
    const b = this.blocoSelecionado || this.obterSecaoAtiva()?.blocos?.find(x => x.tipo === 'paragrafo');
    if (!b) return;
    const sel = window.getSelection();
    const textoOriginal = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
    const textoNovo = window.prompt
      ? window.prompt('Digite o texto sugerido pelo revisor/professor:', 'Revisão sugerida pelo orientador')
      : 'Revisão sugerida pelo orientador';
    if (textoNovo === null) return;

    const sug = registrarSugestao(this.doc, {
      blocoId: b.id,
      tipo: textoOriginal ? 'substituicao' : 'insercao',
      textoOriginal,
      textoNovo,
      autor: this.perfilColaborador.nome || 'Prof. Orientador',
      corAutor: this.perfilColaborador.cor
    });

    const htmlMark = gerarHtmlMarcacaoSugestao(sug);
    if (textoOriginal && String(b.texto || '').includes(textoOriginal)) {
      b.texto = String(b.texto).replace(textoOriginal, htmlMark);
    } else {
      b.texto = `${b.texto || ''} ${htmlMark}`.trim();
    }

    this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
    this.notificarMudanca();
    this.renderizar();
  }

  abrirPainelZotero() {
    if (typeof this.onAbrirZotero === 'function') {
      this.onAbrirZotero();
    }
  }

  inserirCitacaoNoCursor(ref, formato = 'parentese') {
    if (!ref) return;
    const autorSobrenome = (ref.autores?.[0]?.sobrenome || ref.autor || 'AUTOR');
    const autor = formato === 'narrativa' ? autorSobrenome : autorSobrenome.toUpperCase();
    const ano = ref.ano || new Date().getFullYear();
    const tag = formato === 'narrativa' ? ` ${autor} (${ano})` : ` (${autor}, ${ano})`;

    // Garante que a referência bibliográfica seja incluída na lista do documento
    if (!this.doc.referencias) this.doc.referencias = [];
    if (!this.doc.referencias.some(r => (r.id && r.id === ref.id) || (r.chaveZotero && r.chaveZotero === ref.chaveZotero))) {
      this.doc.referencias.push(ref);
    }

    let inserido = false;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum?.nodeType === Node.ELEMENT_NODE ? comum : comum?.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      if (editable) {
        try {
          if (typeof document !== 'undefined' && document.queryCommandSupported && document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, tag);
            inserido = true;
          } else {
            range.deleteContents();
            const node = document.createTextNode(tag);
            range.insertNode(node);
            range.setStartAfter(node);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            inserido = true;
          }
          if (this.blocoSelecionado) {
            this.blocoSelecionado.texto = editable.innerHTML;
          }
        } catch (_) {}
      }
    }

    if (!inserido && this.blocoSelecionado && this.blocoSelecionado.texto !== undefined) {
      this.blocoSelecionado.texto += tag;
    }

    this.notificarMudanca();
    this.renderizarFolhasPaginas();
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
  aplicarConfigListaNoBloco(containerEditable, b) {
    if (!containerEditable || !b) return;
    const listas = containerEditable.querySelectorAll('ul, ol');
    if (!listas.length) return;

    const nivel = Math.max(1, parseInt(b.marcador_nivel, 10) || 1);
    const tabMm = Math.max(3, parseFloat(b.marcador_tab_mm) || 7);
    const indentMm = (nivel - 1) * 6;
    const align = b.marcador_alinhamento || 'left';
    const inicio = Math.max(1, parseInt(b.marcador_inicio, 10) || 1);

    listas.forEach(lista => {
      lista.classList.add('ath-lista-config');
      lista.style.setProperty('--ath-list-tab', `${tabMm}mm`);
      lista.style.setProperty('--ath-list-indent', `${indentMm}mm`);
      lista.style.setProperty('--ath-list-align', align);
      lista.style.setProperty('--ath-list-counter-start', String(inicio - 1));

      if (lista.tagName.toLowerCase() === 'ol') {
        lista.dataset.numEstilo = b.marcador_estilo_num || 'decimal';
        lista.dataset.numSep = b.marcador_separador || 'ponto';
      } else {
        const tipoMarc = (b.marcador_tipo && b.marcador_tipo !== 'numero') ? b.marcador_tipo
          : lista.classList.contains('ath-lista-alinea') ? 'traco'
          : lista.classList.contains('ath-lista-ponto-traco') ? 'ponto_traco'
          : lista.classList.contains('ath-lista-quadrado') ? 'quadrado'
          : 'circulo';
        lista.dataset.marcador = tipoMarc;
      }
    });
  }

  inicializarBarraContextualTexto() {
    if (document.getElementById('athBarraContextualTexto')) return;

    const barra = document.createElement('div');
    barra.id = 'athBarraContextualTexto';
    barra.className = 'ath-barra-contextual';
    barra.style.display = 'none';
    barra.style.position = 'fixed';
    barra.style.zIndex = '9000';
    barra.style.background = 'var(--ath-surface, #fff)';
    barra.style.borderRadius = '999px';
    barra.style.boxShadow = '0 6px 22px rgba(49, 79, 121, 0.22)';
    barra.style.border = '1px solid var(--ath-primary-line, #C8D7E6)';
    barra.style.padding = '5px 10px';
    barra.style.gap = '4px';
    barra.style.alignItems = 'center';
    barra.style.transform = 'translate(-50%, -100%)';
    barra.style.marginTop = '-8px';
    barra.style.userSelect = 'none';

    barra.innerHTML = `
      <!-- Dropdown de Estilo de Texto na Barra Flutuante -->
      <div class="ath-ctx-dropdown-wrap" id="athWrapCtxEstilo">
        <button type="button" class="ath-ctx-dropdown-btn" id="athBtnContextEstiloMenu" title="Aplicar Estilo de Texto ao Bloco" style="height:28px; padding:0 10px; font-weight:700;">
          <span id="athRotuloCtxEstilo" style="font-size:11px; font-weight:700; max-width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Estilo</span>
          <span style="font-size:10px; opacity:0.8;">▾</span>
        </button>
        <div class="ath-ctx-dropdown-menu" id="athMenuContextEstilo" hidden style="width:240px; max-height:280px; overflow-y:auto; padding:4px;">
          <div style="font:800 10.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em; padding:4px 8px; border-bottom:1px solid #EEF2F6; margin-bottom:4px;">
            Estilos de Texto
          </div>
          <div id="athListaItensCtxEstilos" style="display:flex; flex-direction:column; gap:2px;"></div>
        </div>
      </div>
      <span style="width:1px; height:16px; background:var(--ath-primary-line, #C8D7E6); margin:0 2px;"></span>
      <button type="button" class="rm-ic-sm" data-cmd="bold" title="Negrito (Ctrl+B)"><b>B</b></button>
      <button type="button" class="rm-ic-sm" data-cmd="italic" title="Itálico (Ctrl+I)"><i>I</i></button>
      <button type="button" class="rm-ic-sm" data-cmd="underline" title="Sublinhado (Ctrl+U)"><u>U</u></button>
      <button type="button" class="rm-ic-sm" data-cmd="strikeThrough" title="Tachado"><s>S</s></button>
      <span style="width:1px; height:16px; background:var(--ath-primary-line, #C8D7E6); margin:0 2px;"></span>

      <!-- Símbolo único de Lista / Marcadores e Numeração com Menu Dropdown (estilo Affinity) -->
      <div class="ath-ctx-dropdown-wrap" id="athWrapCtxLista">
        <button type="button" class="ath-ctx-dropdown-btn" id="athBtnContextListaMenu" title="Marcadores e Numeração (escolher tipo e estilo)">
          <span id="athIconeCtxLista" style="display:inline-flex; align-items:center;">${svgIcone('lista', 14)}</span>
          <span style="font-size:10px; opacity:0.8;">▾</span>
        </button>
        <div class="ath-ctx-dropdown-menu" id="athMenuContextLista" hidden style="width:270px;">
          <div style="font:800 10.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em; padding:2px 6px 4px; border-bottom:1px solid #EEF2F6;">
            Marcadores e Numeração
          </div>
          <button type="button" class="ath-ctx-menu-item" data-ctx-marcador="nenhum">
            <span>Nenhuma lista</span>
            <span class="ath-ctx-menu-simbolo">—</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-ctx-marcador="circulo">
            <span>Marcador — Ponto</span>
            <span class="ath-ctx-menu-simbolo">•</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-ctx-marcador="traco">
            <span>Alínea / Travessão ABNT</span>
            <span class="ath-ctx-menu-simbolo">–</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-ctx-marcador="quadrado">
            <span>Marcador — Quadrado</span>
            <span class="ath-ctx-menu-simbolo">▪</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-ctx-marcador="ponto_traco">
            <span>Marcador — Ponto-traço</span>
            <span class="ath-ctx-menu-simbolo">·–</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-ctx-marcador="numero">
            <span>Lista Numerada</span>
            <span class="ath-ctx-menu-simbolo">1, a, I</span>
          </button>

          <!-- Sub-configuração rápida de Numeração estilo Affinity -->
          <div id="athSubMenuCtxNumerico" style="display:flex; flex-direction:column; gap:6px; margin-top:4px; padding:8px; border-radius:10px; background:#F8FAFC; border:1px solid #E2E8F0;">
            <span style="font:800 10px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase;">Configuração Numérica</span>
            <label style="font:700 10.5px var(--glx-font); color:#475569; display:flex; flex-direction:column; gap:2px;">Estilo (Número / Letra / Romano)
              <select id="athCtxNumEstilo" class="glx-select" style="height:26px; font-size:11px; padding:0 6px; border-radius:7px; border:1px solid #CBD5E1;">
                <option value="decimal">1, 2, 3… (Número)</option>
                <option value="decimal_zero">01, 02, 03… (Zero esq.)</option>
                <option value="lower_alpha">a, b, c… (Minúscula)</option>
                <option value="upper_alpha">A, B, C… (Maiúscula)</option>
                <option value="lower_roman">i, ii, iii… (Romano min.)</option>
                <option value="upper_roman">I, II, III… (Romano mai.)</option>
              </select>
            </label>
            <div style="display:grid; grid-template-columns:1fr 72px; gap:6px; align-items:end;">
              <label style="font:700 10.5px var(--glx-font); color:#475569; display:flex; flex-direction:column; gap:2px;">Formato
                <select id="athCtxNumSep" class="glx-select" style="height:26px; font-size:11px; padding:0 6px; border-radius:7px; border:1px solid #CBD5E1;">
                  <option value="ponto">\#. (1. / a.)</option>
                  <option value="parentese">\#) (1) / a))</option>
                  <option value="entre_parenteses">(\#) ((1))</option>
                  <option value="travessao">\# – (1 –)</option>
                </select>
              </label>
              <label style="font:700 10.5px var(--glx-font); color:#475569; display:flex; flex-direction:column; gap:2px;">Início
                <input type="number" id="athCtxNumInicio" min="1" max="999" value="1" style="height:26px; font-size:11px; padding:0 6px; border-radius:7px; border:1px solid #CBD5E1; width:100%; box-sizing:border-box;">
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Símbolo único de Alinhamento com Menu Dropdown -->
      <div class="ath-ctx-dropdown-wrap" id="athWrapCtxAlinhamento">
        <button type="button" class="ath-ctx-dropdown-btn" id="athBtnContextAlinMenu" title="Alinhamento do Parágrafo">
          <span id="athIconeCtxAlin" style="display:inline-flex; align-items:center;">${svgIcone('alinhamento_esq', 14)}</span>
          <span id="athRotuloCtxAlin" style="font-size:10.5px;">Alinhar</span>
          <span style="font-size:10px; opacity:0.8;">▾</span>
        </button>
        <div class="ath-ctx-dropdown-menu" id="athMenuContextAlin" hidden style="width:220px;">
          <div style="font:800 10.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em; padding:2px 6px 4px; border-bottom:1px solid #EEF2F6;">
            Alinhamento do Bloco
          </div>
          <button type="button" class="ath-ctx-menu-item" id="athBtnContextAlinEstilo">
            <span>Do estilo de texto</span>
            <span class="ath-ctx-menu-simbolo">Auto</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-alin-rapido="esquerda">
            <span>À Esquerda</span>
            <span class="ath-ctx-menu-simbolo">${svgIcone('alinhamento_esq', 13)}</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-alin-rapido="centro">
            <span>Centralizado</span>
            <span class="ath-ctx-menu-simbolo">${svgIcone('alinhamento_cen', 13)}</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-alin-rapido="direita">
            <span>À Direita</span>
            <span class="ath-ctx-menu-simbolo">${svgIcone('alinhamento_dir', 13)}</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-alin-rapido="justificado_esquerda">
            <span>Justificado (últ. esq.)</span>
            <span class="ath-ctx-menu-simbolo">${svgIcone('alinhamento_jus_esq', 13)}</span>
          </button>
          <button type="button" class="ath-ctx-menu-item" data-alin-rapido="justificado_direita">
            <span>Justificado (últ. dir.)</span>
            <span class="ath-ctx-menu-simbolo">${svgIcone('alinhamento_jus_dir', 13)}</span>
          </button>
        </div>
      </div>

      <span style="width:1px; height:16px; background:var(--ath-primary-line, #C8D7E6); margin:0 2px;"></span>
      <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnContextDividir" title="Dividir este bloco de texto em dois no cursor" style="height:28px; display:inline-flex; align-items:center; gap:4px; border-radius:999px;">${svgIcone('divisor', 13)} Dividir</button>
      <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnContextCitar" title="Inserir citação Zotero" style="height:28px; display:inline-flex; align-items:center; border-radius:999px;">Citar Zotero</button>
    `;

    // Pill flutuante para quando o cursor está posicionado no texto (sem seleção prévia)
    let pillCaret = document.getElementById('athPillAcoesCursor');
    if (!pillCaret) {
      pillCaret = document.createElement('div');
      pillCaret.id = 'athPillAcoesCursor';
      pillCaret.className = 'ath-pill-cursor-acoes';
      pillCaret.style.display = 'none';
      pillCaret.style.position = 'fixed';
      pillCaret.style.zIndex = '9100';
      pillCaret.innerHTML = `
        <button type="button" class="ath-pill-bt" id="athBtnPillDividir" title="Dividir este bloco de texto em dois no cursor">
          ${svgIcone('divisor', 13)} <span>Dividir Bloco Aqui</span>
        </button>
        <span class="ath-pill-sep"></span>
        <button type="button" class="ath-pill-bt ath-pill-bt-zotero" id="athBtnPillCitar" title="Inserir citação bibliográfica do Zotero no cursor">
          ${svgIcone('zotero', 14)} <span>Citar Zotero</span>
        </button>
      `;
      document.body.appendChild(pillCaret);
    }

    document.body.appendChild(barra);

    const menuEstilo = barra.querySelector('#athMenuContextEstilo');
    const menuLista = barra.querySelector('#athMenuContextLista');
    const menuAlin = barra.querySelector('#athMenuContextAlin');
    const btnEstiloMenu = barra.querySelector('#athBtnContextEstiloMenu');
    const btnListaMenu = barra.querySelector('#athBtnContextListaMenu');
    const btnAlinMenu = barra.querySelector('#athBtnContextAlinMenu');

    const fecharDropdownsCtx = () => {
      if (menuEstilo) menuEstilo.hidden = true;
      if (menuLista) menuLista.hidden = true;
      if (menuAlin) menuAlin.hidden = true;
    };

    const renderizarListaEstilosContextuais = () => {
      const containerItens = barra.querySelector('#athListaItensCtxEstilos');
      if (!containerItens) return;
      if (!Array.isArray(this.doc.estilos) || this.doc.estilos.length === 0) {
        this.doc.estilos = criarEstilosPadrao('abnt');
      }
      const estilos = this.doc.estilos;
      const estiloAtivoId = this.blocoSelecionado?.estiloId;

      containerItens.innerHTML = estilos.map(est => {
        const ativo = est.id === estiloAtivoId;
        return `
          <button type="button" class="ath-ctx-menu-item ${ativo ? 'on' : ''}" data-ctx-estilo-id="${est.id}" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; cursor:pointer; width:100%; border:none; background:${ativo ? 'var(--ath-primary-soft, #EEF4FA)' : 'transparent'}; border-radius:6px; text-align:left;">
            <span style="font-weight:${est.peso || 600}; font-size:12px; color:#1E293B;">${est.nome}</span>
            <small style="color:#64748B; font-size:10.5px;">${est.tamanho_pt || 12}pt</small>
          </button>
        `;
      }).join('');

      containerItens.querySelectorAll('[data-ctx-estilo-id]').forEach(btn => {
        const acao = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const estiloId = btn.dataset.ctxEstiloId;
          this.aplicarEstiloNoTextoSelecionado(estiloId, barra);
          fecharDropdownsCtx();
        };
        btn.addEventListener('mousedown', acao);
        btn.addEventListener('click', acao);
      });
    };

    menuEstilo?.addEventListener('mousedown', e => e.stopPropagation());
    menuEstilo?.addEventListener('click', e => e.stopPropagation());
    menuAlin?.addEventListener('mousedown', e => e.stopPropagation());
    menuAlin?.addEventListener('click', e => e.stopPropagation());

    btnEstiloMenu?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const abrir = menuEstilo.hidden;
      fecharDropdownsCtx();
      if (abrir) {
        renderizarListaEstilosContextuais();
      }
      menuEstilo.hidden = !abrir;
    });

    btnListaMenu?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const abrir = menuLista.hidden;
      fecharDropdownsCtx();
      menuLista.hidden = !abrir;
    });

    btnAlinMenu?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const abrir = menuAlin.hidden;
      fecharDropdownsCtx();
      menuAlin.hidden = !abrir;
    });

    menuLista?.addEventListener('mousedown', e => {
      if (e.target.closest('select, input, label')) {
        e.stopPropagation();
      }
    });

    const aplicarMarcadorNoBlocoSelecionado = (tipo) => {
      const b = this.blocoSelecionado;
      if (!b) return;
      if (tipo === 'nenhum') {
        delete b.marcador_tipo;
        const txt = String(b.texto || '').trim();
        if (txt.startsWith('<ul') || txt.startsWith('<ol')) {
          const tmp = document.createElement('div');
          tmp.innerHTML = txt;
          const itens = Array.from(tmp.querySelectorAll('li')).map(li => li.innerHTML);
          if (itens.length > 0) b.texto = itens.join('<br>');
        }
      } else {
        b.marcador_tipo = tipo;
        if (tipo === 'numero') {
          b.marcador_estilo_num = barra.querySelector('#athCtxNumEstilo')?.value || b.marcador_estilo_num || 'decimal';
          b.marcador_separador = barra.querySelector('#athCtxNumSep')?.value || b.marcador_separador || 'ponto';
          b.marcador_inicio = Math.max(1, parseInt(barra.querySelector('#athCtxNumInicio')?.value, 10) || b.marcador_inicio || 1);
        }
        const txt = String(b.texto || '').trim();
        if (txt.includes('<ul') || txt.includes('<ol')) {
          const tmp = document.createElement('div');
          tmp.innerHTML = txt;
          tmp.querySelectorAll('ul, ol').forEach(listaAntiga => {
            const tagAlvo = tipo === 'numero' ? 'ol' : 'ul';
            const novaLista = document.createElement(tagAlvo);
            novaLista.innerHTML = listaAntiga.innerHTML;
            listaAntiga.replaceWith(novaLista);
          });
          b.texto = tmp.innerHTML;
        }
      }
      this.notificarMudanca();
      this.renderizar();
      this.onSelecionarBloco(b, null);
    };

    barra.querySelectorAll('[data-ctx-marcador]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const tipo = btn.dataset.ctxMarcador;
        aplicarMarcadorNoBlocoSelecionado(tipo);
        if (tipo !== 'numero') {
          fecharDropdownsCtx();
        }
      });
    });

    barra.querySelector('#athCtxNumEstilo')?.addEventListener('change', e => {
      if (this.blocoSelecionado) {
        this.blocoSelecionado.marcador_tipo = 'numero';
        this.blocoSelecionado.marcador_estilo_num = e.target.value;
        aplicarMarcadorNoBlocoSelecionado('numero');
      }
    });

    barra.querySelector('#athCtxNumSep')?.addEventListener('change', e => {
      if (this.blocoSelecionado) {
        this.blocoSelecionado.marcador_tipo = 'numero';
        this.blocoSelecionado.marcador_separador = e.target.value;
        aplicarMarcadorNoBlocoSelecionado('numero');
      }
    });

    barra.querySelector('#athCtxNumInicio')?.addEventListener('input', e => {
      if (this.blocoSelecionado) {
        this.blocoSelecionado.marcador_tipo = 'numero';
        this.blocoSelecionado.marcador_inicio = Math.max(1, parseInt(e.target.value, 10) || 1);
        aplicarMarcadorNoBlocoSelecionado('numero');
      }
    });

    barra.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        document.execCommand(btn.dataset.cmd, false, null);
      });
    });

    barra.querySelector('#athBtnContextAlinEstilo')?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      if (this.blocoSelecionado) {
        delete this.blocoSelecionado.alinhamento;
        fecharDropdownsCtx();
        this.notificarMudanca();
        this.renderizar();
        this.onSelecionarBloco(this.blocoSelecionado, null);
      }
    });

    barra.querySelectorAll('[data-alin-rapido]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        if (this.blocoSelecionado) {
          this.blocoSelecionado.alinhamento = btn.dataset.alinRapido;
          fecharDropdownsCtx();
          this.notificarMudanca();
          this.renderizar();
          this.onSelecionarBloco(this.blocoSelecionado, null);
        }
      });
    });

    const acaoDividirRange = (range, editable) => {
      if (!range || !editable) return;
      const rangeAntes = range.cloneRange();
      rangeAntes.selectNodeContents(editable);
      rangeAntes.setEnd(range.startContainer, range.startOffset);
      const divAntes = document.createElement('div');
      divAntes.appendChild(rangeAntes.cloneContents());

      const rangeDepois = range.cloneRange();
      rangeDepois.selectNodeContents(editable);
      rangeDepois.setStart(range.endContainer, range.endOffset);
      const divDepois = document.createElement('div');
      divDepois.appendChild(rangeDepois.cloneContents());

      const bId = this.blocoSelecionado?.id;
      if (bId) {
        this.dividirBlocoAtual(bId, { textoAntes: divAntes.innerHTML, textoDepois: divDepois.innerHTML });
      }
    };

    barra.querySelector('#athBtnContextDividir')?.addEventListener('mousedown', e => {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum.nodeType === Node.ELEMENT_NODE ? comum : comum.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      acaoDividirRange(range, editable);
    });

    pillCaret.querySelector('#athBtnPillDividir')?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum.nodeType === Node.ELEMENT_NODE ? comum : comum.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      pillCaret.style.display = 'none';
      acaoDividirRange(range, editable);
    });

    pillCaret.querySelector('#athBtnPillCitar')?.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      pillCaret.style.display = 'none';
      this.abrirPainelZotero();
    });

    barra.querySelector('#athBtnContextCitar').addEventListener('mousedown', e => {
      e.preventDefault();
      this.abrirPainelZotero();
    });

    // Monitora seleção de texto e posição do cursor
    const atualizarPosicaoBarra = () => {
      // Se houver qualquer modal aberto na tela, oculta barra contextual e pill flutuante
      if (document.querySelector('.ath-modal-backdrop') || document.querySelector('.ath-modal')) {
        barra.style.display = 'none';
        fecharDropdownsCtx();
        if (pillCaret) pillCaret.style.display = 'none';
        return;
      }
      // Se algum menu dropdown da barra flutuante estiver aberto, não esconde nem reposiciona a barra
      if ((menuEstilo && !menuEstilo.hidden) || (menuLista && !menuLista.hidden) || (menuAlin && !menuAlin.hidden)) {
        return;
      }

      // Se o foco está dentro de um elemento interativo da própria barra, mantém aberta
      if (document.activeElement && barra.contains(document.activeElement)) {
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        barra.style.display = 'none';
        fecharDropdownsCtx();
        if (pillCaret) pillCaret.style.display = 'none';
        return;
      }

      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum.nodeType === Node.ELEMENT_NODE ? comum : comum.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');

      if (!editable) {
        barra.style.display = 'none';
        fecharDropdownsCtx();
        if (pillCaret) pillCaret.style.display = 'none';
        return;
      }

      // Se há texto selecionado, exibe a barra completa com formatação e botão de dividir
      if (!sel.isCollapsed && sel.toString().trim()) {
        if (pillCaret) pillCaret.style.display = 'none';
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          barra.style.display = 'flex';
          barra.style.left = `${rect.left + rect.width / 2}px`;
          barra.style.top = `${rect.top}px`;

          // Salva última seleção ativa para aplicar estilos pontuais mesmo com perda temporária de foco
          const blocoEl = editable?.closest('[data-bloco-id]');
          const blocoId = blocoEl?.dataset?.blocoId || this.blocoSelecionado?.id;
          this._ultimaSelecaoAtiva = {
            range: range.cloneRange(),
            texto: sel.toString(),
            blocoId: blocoId,
            editable: editable
          };
          if (!this.blocoSelecionado && blocoId) {
            this.blocoSelecionado = (this.doc.secoes || []).flatMap(s => s.blocos || []).find(b => b.id === blocoId) || null;
          }

          // Reflete o estilo ativo do trecho ou do bloco
          const rotuloEstiloEl = barra.querySelector('#athRotuloCtxEstilo');
          if (rotuloEstiloEl) {
            const spanEst = elPai.closest('.ath-estilo-span');
            const idAtivo = spanEst?.dataset.estiloId || this.blocoSelecionado?.estiloId;
            const estAtual = (this.doc.estilos || []).find(x => x.id === idAtivo);
            rotuloEstiloEl.textContent = estAtual ? estAtual.nome : 'Estilo';
          }

          // Reflete estado do menu de Alinhamento
          const alinAtivo = this.blocoSelecionado?.alinhamento || '';
          const btnCtxAlinEstilo = barra.querySelector('#athBtnContextAlinEstilo');
          if (btnCtxAlinEstilo) {
            btnCtxAlinEstilo.classList.toggle('on', !alinAtivo);
          }
          barra.querySelectorAll('[data-alin-rapido]').forEach(bt => {
            bt.classList.toggle('on', bt.dataset.alinRapido === alinAtivo);
          });
          const rotuloAlinEl = barra.querySelector('#athRotuloCtxAlin');
          if (rotuloAlinEl) {
            const mapaAlin = {
              '': 'Do estilo',
              esquerda: 'Esquerda',
              centro: 'Centro',
              direita: 'Direita',
              justificado_esquerda: 'Justif.',
              justificado_direita: 'Justif. Dir.'
            };
            rotuloAlinEl.textContent = mapaAlin[alinAtivo] || 'Alinhar';
          }

          // Reflete estado do menu de Lista / Marcadores e Numeração
          const marcAtivo = this.blocoSelecionado?.marcador_tipo || 'nenhum';
          barra.querySelectorAll('[data-ctx-marcador]').forEach(bt => {
            bt.classList.toggle('on', bt.dataset.ctxMarcador === marcAtivo);
          });
          btnListaMenu?.classList.toggle('on', marcAtivo !== 'nenhum');
          const selNumEst = barra.querySelector('#athCtxNumEstilo');
          const selNumSep = barra.querySelector('#athCtxNumSep');
          const inpNumIni = barra.querySelector('#athCtxNumInicio');
          if (selNumEst) selNumEst.value = this.blocoSelecionado?.marcador_estilo_num || 'decimal';
          if (selNumSep) selNumSep.value = this.blocoSelecionado?.marcador_separador || 'ponto';
          if (inpNumIni) inpNumIni.value = this.blocoSelecionado?.marcador_inicio ?? 1;

          // Reflete estado dos botões de formatação inline
          try {
            const cmdB = barra.querySelector('[data-cmd="bold"]');
            const cmdI = barra.querySelector('[data-cmd="italic"]');
            const cmdU = barra.querySelector('[data-cmd="underline"]');
            const cmdS = barra.querySelector('[data-cmd="strikeThrough"]');

            if (cmdB) cmdB.classList.toggle('on', document.queryCommandState('bold'));
            if (cmdI) cmdI.classList.toggle('on', document.queryCommandState('italic'));
            if (cmdU) cmdU.classList.toggle('on', document.queryCommandState('underline'));
            if (cmdS) cmdS.classList.toggle('on', document.queryCommandState('strikeThrough'));
          } catch (_) {}
          return;
        }
      }

      // Se é apenas o cursor posicionado no texto (sem seleção), exibe a pílula [Dividir Bloco Aqui] [Citar Zotero]
      barra.style.display = 'none';
      if (sel.isCollapsed && editable) {
        let r = null;
        const rects = range.getClientRects();
        if (rects.length > 0) {
          r = rects[0];
        } else {
          r = editable.getBoundingClientRect();
        }
        if (r && pillCaret) {
          pillCaret.style.display = 'flex';
          const left = Math.max(140, Math.min(window.innerWidth - 140, r.left + (r.width || 0) / 2));
          pillCaret.style.left = `${left}px`;
          if (r.top < 55) {
            pillCaret.style.top = `${r.bottom}px`;
            pillCaret.style.transform = 'translate(-50%, 0)';
            pillCaret.style.marginTop = '8px';
          } else {
            pillCaret.style.top = `${r.top}px`;
            pillCaret.style.transform = 'translate(-50%, -100%)';
            pillCaret.style.marginTop = '-10px';
          }
        }
      } else if (pillCaret) {
        pillCaret.style.display = 'none';
      }
    };

    document.addEventListener('selectionchange', atualizarPosicaoBarra);
    document.addEventListener('click', (e) => {
      if (barra && !barra.contains(e.target)) {
        fecharDropdownsCtx();
      }
      setTimeout(atualizarPosicaoBarra, 50);
    });
    document.addEventListener('keyup', () => setTimeout(atualizarPosicaoBarra, 50));
    window.addEventListener('scroll', atualizarPosicaoBarra, true);
  }

  /* ==========================================================================
     APLICAR ESTILO DE TEXTO NA PARTE SELECIONADA OU NO BLOCO INTEIRO
     ========================================================================== */
  aplicarEstiloNoTextoSelecionado(estiloId, barraEl = null) {
    if (!estiloId) return;
    const estilo = (this.doc.estilos || []).find(x => x.id === estiloId);
    if (!estilo) return;

    // Recupera a seleção ativa
    const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
    let range = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.toString().trim()) {
      range = sel.getRangeAt(0);
    } else if (this._ultimaSelecaoAtiva?.range && !this._ultimaSelecaoAtiva.range.collapsed && this._ultimaSelecaoAtiva.texto?.trim()) {
      range = this._ultimaSelecaoAtiva.range;
    }

    // Localiza o bloco correspondente
    let blocoId = this._ultimaSelecaoAtiva?.blocoId || this.blocoSelecionado?.id;
    let editable = this._ultimaSelecaoAtiva?.editable;

    if (range && !editable && typeof Node !== 'undefined') {
      const comum = range.commonAncestorContainer;
      const elPai = comum?.nodeType === Node.ELEMENT_NODE ? comum : comum?.parentElement;
      editable = elPai?.closest?.('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      const blocoEl = editable?.closest?.('[data-bloco-id]');
      if (blocoEl?.dataset?.blocoId) blocoId = blocoEl.dataset.blocoId;
    }

    let bloco = (this.doc.secoes || []).flatMap(s => s.blocos || []).find(b => b.id === blocoId) || this.blocoSelecionado;
    if (!this.blocoSelecionado && bloco) {
      this.blocoSelecionado = bloco;
    }

    // Propriedades tipográficas do estilo para aplicação inline
    const f = FONTES_SISTEMA[estilo.fonte] || FONTES_SISTEMA.nunito;
    const familiaCss = f.familia || 'sans-serif';
    const inlineProps = [
      `font-family: ${familiaCss}`,
      `font-size: ${estilo.tamanho_pt || 12}pt`,
      `font-weight: ${estilo.peso || 400}`,
      `color: ${estilo.cor || '#1F2733'}`
    ];
    if (estilo.italico) inlineProps.push('font-style: italic');
    else inlineProps.push('font-style: normal');
    if (estilo.sublinhado) inlineProps.push('text-decoration: underline');
    if (estilo.caixa_alta) inlineProps.push('text-transform: uppercase');
    if (estilo.espacamento_letras_em) inlineProps.push(`letter-spacing: ${estilo.espacamento_letras_em}em`);
    if (estilo.entrelinha) inlineProps.push(`line-height: ${estilo.entrelinha}`);
    const inlineCss = inlineProps.join('; ');

    // Se temos um trecho específico selecionado
    if (range && editable && !range.collapsed && range.toString().trim()) {
      try {
        const textoSel = range.toString().trim();
        const textoBloco = (editable.textContent || '').trim();

        // Se a seleção cobrir o bloco inteiro, aplica ao bloco todo
        if (textoSel.length > 0 && textoSel === textoBloco && bloco) {
          bloco.estiloId = estilo.id;
          if (estilo.tipo === 'titulo' || estilo.id.startsWith('titulo')) {
            bloco.tipo = 'titulo';
            bloco.nivel = (estilo.id === 'titulo1' || estilo.id === 'titulo_1') ? 1 : (estilo.id === 'titulo2' || estilo.id === 'titulo_2') ? 2 : 3;
          }
          this.notificarMudanca();
          this.renderizar();
        } else {
          // Aplica na parte selecionada (inline)
          const comum = range.commonAncestorContainer;
          const elPai = comum?.nodeType === Node.ELEMENT_NODE ? comum : comum?.parentElement;
          const spanExistente = elPai?.closest?.('.ath-estilo-span');

          if (spanExistente && spanExistente.textContent.trim() === textoSel) {
            spanExistente.dataset.estiloId = estilo.id;
            spanExistente.dataset.estiloNome = estilo.nome;
            spanExistente.style.cssText = inlineCss;
          } else {
            const fragment = range.extractContents();
            const span = document.createElement('span');
            span.className = 'ath-estilo-span';
            span.dataset.estiloId = estilo.id;
            span.dataset.estiloNome = estilo.nome;
            span.style.cssText = inlineCss;
            span.appendChild(fragment);
            range.insertNode(span);

            if (sel && typeof document !== 'undefined') {
              sel.removeAllRanges();
              const novoRange = document.createRange();
              novoRange.selectNodeContents(span);
              sel.addRange(novoRange);
            }
          }

          if (bloco && editable) {
            bloco.texto = editable.innerHTML;
          }
        }
      } catch (err) {
        console.warn('[Athenes] Falha ao envelopar trecho com estilo:', err);
        if (bloco) bloco.estiloId = estilo.id;
      }
    } else if (bloco) {
      // Sem seleção de trecho, aplica ao bloco inteiro
      bloco.estiloId = estilo.id;
      if (estilo.tipo === 'titulo' || estilo.id.startsWith('titulo')) {
        bloco.tipo = 'titulo';
        bloco.nivel = (estilo.id === 'titulo1' || estilo.id === 'titulo_1') ? 1 : (estilo.id === 'titulo2' || estilo.id === 'titulo_2') ? 2 : 3;
      }
      this.renderizar();
    }

    const barra = barraEl || (typeof document !== 'undefined' ? document.getElementById('athBarraContextoTexto') : null);
    if (barra) {
      const rotuloEl = barra.querySelector('#athRotuloCtxEstilo');
      if (rotuloEl) rotuloEl.textContent = estilo.nome;
      const menuEst = barra.querySelector('#athMenuContextEstilo');
      if (menuEst) menuEst.hidden = true;
    }

    if (bloco) {
      this.sessaoRealtime?.transmitirAtualizacaoBloco(bloco);
      this.notificarMudanca();
      this.notificarMudancaRapida();
    }
  }

  /* ==========================================================================
     ABRIR CENTRAL DE ESTILOS & IDENTIDADE VISUAL (IMPORTAR / EXPORTAR / IA)
     ========================================================================== */
  abrirModalCentralEstilos(abaInicial = 'exportar') {
    new ModalCentralEstilos(this.doc, this, {
      abaInicial,
      onSucesso: () => {
        this.notificarMudanca();
        this.renderizar();
        if (this.onAlterado) this.onAlterado();
      }
    });
  }
}
