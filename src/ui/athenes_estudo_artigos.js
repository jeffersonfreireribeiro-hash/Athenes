// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Leitura, Risco em PDF (estilo Samsung Notes) e Fichamento Síncrono (Zotero + Google Drive).
 *
 * Recursos principais:
 * 1. Tela Cheia em 3 Colunas (.rm-conteudo / .rm-ed-grade) idêntica ao Editor de Escrita:
 *    - Coluna Esquerda 50/50 (.rm-card-meio-a-meio): Artigos do Zotero na metade superior + Páginas do PDF na metade inferior.
 *    - Coluna Central: Todas as páginas do PDF empilhadas em rolagem contínua (.rm-prev-palco) com barra flutuante (.rm-barra-blocos).
 *    - Coluna Direita: Inspetor em altura total (Resumo & Notas, Citações & Destaques, Zotero & Drive).
 * 2. Desenho Livre + Modo Linha Reta (estilo Samsung Notes):
 *    - Caneta e Marca-Texto operam à mão livre ou em Modo Linha Reta (botão "Linha Reta" na barra ou tecla Shift, com trava ortogonal 0°/90°).
 * 3. Notas Adesivas Editáveis na Folha (sem window.prompt):
 *    - Card flutuante Soft UI diretamente sobre a página do PDF; clicar em qualquer nota abre a edição de título, texto, cor e posição.
 * 4. Seleção de Texto Interativa:
 *    - Ao selecionar qualquer trecho do PDF, surge uma pílula flutuante sobre a seleção para Grifar Texto (<mark>),
 *      Salvar Citação no Zotero (p. X), Criar Nota Adesiva ou Copiar em formato ABNT.
 */

import * as bib from '../core/athenes_biblioteca_artigos.js';
import { gravarConfigZotero } from '../core/athenes_zotero_config.js';
import { lerConta, gravarConta, obterContaAtiva } from '../core/athenes_conta.js';
import { obterTokenOuConectar, obterTokenDrive, sincronizarZoteroComDrive } from '../core/athenes_drive_sync.js';
import { ZoteroClient } from '../core/athenes_zotero.js';
import { obterPerfilColaborador, obterConfigGoogleDrive, salvarArquivoNoGoogleDrive, autenticarGoogleDrive, listarPdfsDoGoogleDrive, salvarDocumentoNoSupabase, obterPastasDriveLocais, salvarPastasDriveLocais, buscarPastaNaArvore } from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { espelharColecoesNasPastas, pastasDoItemZotero, artigoEstaNaPasta } from '../core/athenes_zotero_pastas.js';
import { aplicarFilhosZoteroAoArtigo } from '../core/athenes_zotero_anexos_notas.js';
import { tokenPodeLerTodoODrive, listarConteudoDoDrive, copiarPdfDoDriveParaAthenes, ESCOPOS_COM_LEITURA } from '../core/athenes_drive_navegar.js';
import { mostrarAviso } from './athenes_aviso.js';
import { ModalCompartilhar } from './athenes_compartilhar_modal.js';
import { listarCompartilhadosComigo, carregarDocumentoCompartilhado } from '../core/athenes_compartilhamento.js';
import { lerSessaoSupabase } from '../core/athenes_supabase_auth.js';
import { paginaEditorialDoPdf } from '../core/athenes_pdf_identificadores.js';
import { removerPdfLocal, PASTA_PDFS_DRIVE, artigoTemPdf, ehArtigoExemploFicticio, carregarPdfJs, obterPdfLocal, obterPdfComoDataUrl, garantirPdfDoArtigo, migrarPdfsLocaisParaODrive, carregarArtigosEstudo, salvarArtigosEstudo, gerarHtmlNotaZoteroDoArtigo, definirArtigoAbertoAtivo, lerSnapshotArtigosIdb, mesclarFichamentoPreservandoDados, compartilharPdfNoDrive } from './athenes_estudo_artigos_dados.js';
import { metodosEstudoTela } from './athenes_estudo_artigos_tela.js';
import { metodosEstudoPainelDireito } from './athenes_estudo_artigos_painel_direito.js';
import { metodosEstudoAnotacoes } from './athenes_estudo_artigos_anotacoes.js';
import { metodosEstudoModais } from './athenes_estudo_artigos_modais.js';
import { metodosEstudoPastas, restaurarPastaAtiva, coletarPastasBibliografia, CORES_PASTAS_CRONOS } from './athenes_estudo_artigos_pastas.js';
import { renderizarEstante3D, fecharTodosLivros3D, tratarTecladoLivro3D, moverLivroParaPasta, CORES_CAPA_SELECAO } from './athenes_estudo_artigos_estante.js';

export { ehArtigoExemploFicticio, criarArtigosEstudoExemplo, migrarPdfsLocaisParaODrive, carregarArtigosEstudo, salvarArtigosEstudo, salvarArtigosEstudoDebounced, formatarCitacaoAbntDoArtigo, gerarHtmlNotaZoteroDoArtigo, calcularPontoFinalLinhaReta } from './athenes_estudo_artigos_dados.js';

export class EstudoArtigosView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.opcoes = opcoes;
    this.onModoFullScreenChange = opcoes.onModoFullScreenChange || (() => {});
    this.artigos = carregarArtigosEstudo();
    this.artigosCompartilhados = [];
    // a biblioteca vem do servidor: chegou algo de outro computador → atualiza a tela (sem interromper quem está lendo um artigo)
    this._cancelarBib = bib.aoMudarBiblioteca(() => {
      this.artigos = carregarArtigosEstudo();
      if (this.artigoAberto) {
        const atualizado = (this.artigos || []).find(a => String(a.id) === String(this.artigoAberto.id) || (this.artigoAberto.chaveZotero && a.chaveZotero === this.artigoAberto.chaveZotero));
        if (atualizado && atualizado !== this.artigoAberto) {
          mesclarFichamentoPreservandoDados(this.artigoAberto, atualizado);
          this.salvarCacheArtigoAbertoSessao(this.artigoAberto);
        }
        const colEsq = this.container?.querySelector('#athEstudioColEsq');
        if (colEsq) this.renderizarColunaEsquerdaEstudio(colEsq, this.artigoAberto, this.artigoAberto.conteudoPaginasPdf || []);
      } else {
        this.restaurarArtigoAbertoSessao();
        if (!this.artigoAberto && typeof this.renderizar === 'function') this.renderizar();
      }
    });
    bib.sincronizarBiblioteca().catch(e => console.warn('[Athenes] Biblioteca no servidor:', e.message));
    migrarPdfsLocaisParaODrive().catch(() => {}); // PDFs que ficaram só neste computador vão para o Drive
    this.artigoAberto = null;
    this.paginaAtual = 1;
    this.zoomPct = 100;
    this.ferramentaAtiva = 'cursor'; // Começa com seleção de texto ou caneta; permite alternar livremente
    try {
      this.ordemReferencias = localStorage.getItem('athenes_ordem_referencias') || 'recente_desc';
    } catch (_) {
      this.ordemReferencias = 'recente_desc';
    }
    this.modoLinhaReta = false; // Quando true, Caneta e Marca-Texto fazem retas perfeitas
    this.bloquearDedoParaRolar = true; // Modo Samsung Notes ativo por padrão: Caneta escreve, Dedo rola/move e dá zoom
    this.corTinta = '#314F79';
    this.corGrifoAtiva = '#FDE047'; // Amarelo clássico por padrão; suporta verde, azul, coral, roxo, laranja
    this.espessuraTinta = 3;
    this.espessuraMarca = 18; // espessura própria do marca-texto
    this.carregarConfigPincelSalva();
    this.abaDireita = 'resumo'; // 'resumo' | 'citacoes' | 'zotero_drive'
    this.pinEditandoId = null; // ID da nota adesiva atualmente aberta para edição na folha
    this.filtroBusca = '';
    this.filtroStatus = 'todos';
    this.filtrosObra = { anoDe: '', anoAte: '', autor: '', editora: '', palavra: '' };
    this.filtroLateralEsq = '';
    this.pastaFiltroId = opcoes.pastaFiltroId || restaurarPastaAtiva({
      pastas: coletarPastasBibliografia(),
      storage: typeof sessionStorage !== 'undefined' ? sessionStorage : null
    }) || 'todas';
    this.aoMudarPastas = opcoes.aoMudarPastas || null; // a página inicial refaz a lista de pastas quando as coleções do Zotero chegam
    this.zoteroClient = new ZoteroClient();
    this.carregarConfigZotero();
    this.hidratarSnapshotIndexedDb();
    this.restaurarArtigoAbertoSessao();
    if (!this.artigoAberto) this.renderizar();
    this.carregarCompartilhados();
  }

  artigosCatalogo() {
    const proprios = this.artigos.filter(a => !a.compartilhadoComigo);
    return [...proprios, ...this.artigosCompartilhados];
  }

  async carregarCompartilhados() {
    const conta = obterContaAtiva();
    if (!lerSessaoSupabase()?.email) {
      this.artigosCompartilhados = [];
      if (!this.artigoAberto && this.container?.isConnected) this.atualizarGridCatalogo();
      this.aoMudarPastas?.();
      return;
    }
    try {
      const lista = (await listarCompartilhadosComigo()).filter(x => x.norma === 'zotero_pdf');
      const resultados = await Promise.allSettled(lista.map(x => carregarDocumentoCompartilhado(x.id)));
      if (obterContaAtiva() !== conta || !this.container?.isConnected) return;
      this.artigosCompartilhados = resultados.flatMap(r => {
        const doc = r.status === 'fulfilled' ? r.value?.doc : null;
        const art = doc?.artigoEstudo;
        return art ? [{ ...art, compartilhadoComigo: true, proprietarioExterno: true, docCompartilhadoId: doc.id, permissao: doc.permissao, proprietario: doc.proprietario }] : [];
      });
      if (!this.artigoAberto) this.atualizarGridCatalogo();
      this.aoMudarPastas?.();
    } catch (e) { console.warn('[Athenes] Artigos compartilhados:', e.message); }
  }

  salvarCacheArtigoAbertoSessao(art) {
    try {
      if (typeof sessionStorage === 'undefined' || !art?.id) return;
      const copia = { ...art };
      delete copia.pdfBlobUrl;
      delete copia.pdfDataUrl;
      delete copia.pdfBlob;
      sessionStorage.setItem('athenes_estudio_artigo_cache', JSON.stringify(copia));
    } catch (_) {}
  }

  restaurarArtigoAbertoSessao() {
    try {
      if (typeof sessionStorage === 'undefined' || this.artigoAberto) return false;
      const idSalvo = this.opcoes?.artigoInicialId || sessionStorage.getItem('athenes_estudio_artigo_id');
      if (!idSalvo) return false;
      let achado = (this.artigos || []).find(a => String(a.id) === String(idSalvo) || (a.chaveZotero && String(a.chaveZotero) === String(idSalvo)));
      if (!achado) {
        const rawCache = sessionStorage.getItem('athenes_estudio_artigo_cache');
        if (rawCache) {
          const objCache = JSON.parse(rawCache);
          if (objCache && (String(objCache.id) === String(idSalvo) || (objCache.chaveZotero && String(objCache.chaveZotero) === String(idSalvo)))) {
            achado = objCache;
            if (!Array.isArray(this.artigos)) this.artigos = [];
            this.artigos.unshift(achado);
          }
        }
      }
      if (!achado) return false;
      const pagSalva = parseInt(sessionStorage.getItem('athenes_estudio_pag') || '1', 10) || 1;
      this.abrirArtigoNoEstudio(achado, pagSalva);
      return true;
    } catch (_) {
      return false;
    }
  }

  hidratarSnapshotIndexedDb() {
    lerSnapshotArtigosIdb().then(snapshot => {
      if (snapshot?.porChave) {
        let mudou = false;
        for (const a of this.artigos) {
          const dados = snapshot.porChave[String(a.id)] || (a.chaveZotero && snapshot.porChave[`zot:${a.chaveZotero}`]);
          if (dados) {
            mesclarFichamentoPreservandoDados(a, dados);
            mudou = true;
          }
        }
        if (this.artigoAberto) {
          const dadosAberto = snapshot.porChave[String(this.artigoAberto.id)] || (this.artigoAberto.chaveZotero && snapshot.porChave[`zot:${this.artigoAberto.chaveZotero}`]);
          if (dadosAberto) {
            mesclarFichamentoPreservandoDados(this.artigoAberto, dadosAberto);
            this.salvarCacheArtigoAbertoSessao(this.artigoAberto);
          }
          return;
        }
        if (!this.artigoAberto && this.restaurarArtigoAbertoSessao()) return;
        if (mudou && !this.artigoAberto) {
          this.atualizarGridCatalogo();
        }
      }
    }).catch(() => {});
  }

  carregarConfigZotero() {
    try {
      const salvo = lerConta('athenes_zotero_cfg');
      if (salvo) {
        const cfg = JSON.parse(salvo);
        this.zoteroClient.userId = cfg.userId ? String(cfg.userId).trim() : '';
        this.zoteroClient.apiKey = cfg.apiKey ? String(cfg.apiKey).trim() : '';
        this.zoteroClient.username = cfg.username || '';
        this.zoteroClient.isGroup = Boolean(cfg.isGroup);
      }
    } catch (_) {}
  }

  salvarConfigZotero(cfg = {}) {
    if (cfg.userId !== undefined) this.zoteroClient.userId = String(cfg.userId).trim();
    if (cfg.apiKey !== undefined) this.zoteroClient.apiKey = String(cfg.apiKey).trim();
    if (cfg.username !== undefined) this.zoteroClient.username = cfg.username;
    gravarConfigZotero({ userId: this.zoteroClient.userId, apiKey: this.zoteroClient.apiKey, username: this.zoteroClient.username || '', isGroup: Boolean(this.zoteroClient.isGroup) });
    // o envio à conta (servidor e Drive) é feito por athenes_zotero_conta.js, ao ouvir a mudança da chave
  }

  temZoteroConectado() {
    return Boolean(this.zoteroClient.apiKey);
  }

  filtrarPorPasta(pastaId) {
    this.pastaFiltroId = pastaId || 'todas';
    if (typeof this.selecionarPastaBib === 'function') {
      this.selecionarPastaBib(this.pastaFiltroId);
    } else if (!this.artigoAberto) {
      this.atualizarGridCatalogo();
    }
    if (this.artigoAberto) {
      const colEsq = this.container?.querySelector('#athEstudioColEsq');
      if (colEsq) {
        this.renderizarColunaEsquerdaEstudio(colEsq, this.artigoAberto, this.artigoAberto.conteudoPaginasPdf);
      }
    }
  }

  alternarModoDashboardFull(ativo) {
    const dashEl = this.container?.closest('.ath-dashboard');
    if (dashEl) {
      dashEl.classList.toggle('ath-dashboard-estudio-full', Boolean(ativo));
      const sidebar = dashEl.querySelector('#athDashSidebar');
      const banner = dashEl.querySelector('#athDashPastaBanner');
      if (sidebar) sidebar.style.display = ativo ? 'none' : '';
      if (banner) banner.style.display = ativo ? 'none' : '';
      dashEl.querySelectorAll('.ath-dash-head, .ath-dash-topbar').forEach(el => {
        el.style.display = ativo ? 'none' : '';
      });
    }
    this.onModoFullScreenChange(Boolean(ativo));
  }

  renderizar() {
    if (!this.container) return;
    const palcoAntigo = this.container.querySelector('#athEstudioPalco');
    const scrollSalvo = palcoAntigo ? palcoAntigo.scrollTop : 0;

    this.carregarConfigZotero();
    this.container.innerHTML = '';

    if (this.artigoAberto) {
      const headerAcoes = document.getElementById('athHeaderAcoesZotero');
      if (headerAcoes) headerAcoes.innerHTML = '';
      this.alternarModoDashboardFull(true);
      this.renderizarEstudioPdfFullScreen(this.artigoAberto, scrollSalvo);
    } else {
      if (this._tecladoZoomHandler) {
        window.removeEventListener('keydown', this._tecladoZoomHandler);
        this._tecladoZoomHandler = null;
      }
      if (this._selectionChangeHandler) {
        document.removeEventListener('selectionchange', this._selectionChangeHandler);
        this._selectionChangeHandler = null;
      }
      this.alternarModoDashboardFull(false);
      this.renderizarCatalogoArtigos();
    }
  }

  /* ==========================================================================
     VISÃO 1: CATÁLOGO DE ARTIGOS VINCULADOS AO ZOTERO + CAPA DO PDF NO DRIVE
     ========================================================================== */
  renderizarCatalogoArtigos() {
    const wrap = document.createElement('div');
    wrap.className = 'ath-estudo-catalogo';

    const conectado = this.temZoteroConectado();
    const labelZotero = conectado
      ? `Zotero · ${this.zoteroClient.userId ? '#' + this.zoteroClient.userId : 'conectado'}`
      : 'Conectar Zotero';

    const htmlBotoesAcao = `
      <button type="button" class="ath-btn ath-btn-icone ${conectado ? 'ath-btn-zotero-ok' : ''}" id="athBtnConfigurarChaveZotero" title="${conectado ? 'Zotero conectado (' + (this.zoteroClient.userId ? '#' + this.zoteroClient.userId : 'ativo') + '): clique para ver ou trocar credenciais' : 'Inserir sua API Key e User ID do Zotero'}" aria-label="Zotero">
        ${svgIcone('zotero', 20)}
      </button>

      <button type="button" class="ath-btn ath-btn-icone" id="athBtnSincronizarZoteroHub" title="Sincronizar: busca na sua biblioteca do Zotero os artigos novos" aria-label="Sincronizar biblioteca do Zotero">
        ${svgIcone('sincronizar', 17)}
      </button>

      <div class="ath-menu-importar" id="athMenuImportarBib">
        <button type="button" class="ath-btn ath-btn-icone ath-btn-importar-coluna" id="athBtnImportarBib" aria-haspopup="menu" aria-expanded="false" title="Importar referências (.bib, .txt)" aria-label="Importar referências">
          ${svgIcone('importar', 14)}
          ${svgIcone('baixo', 8)}
        </button>
        <ul class="ath-menu-importar-lista" id="athMenuImportarBibLista" role="menu" hidden>
          <li><button type="button" role="menuitem" data-importar-bib=".bib">${svgIcone('documento', 14)}<span><strong>BibTeX (.bib)</strong><small>Coleção exportada do Zotero</small></span></button></li>
          <li><button type="button" role="menuitem" data-importar-bib=".txt">${svgIcone('documento', 14)}<span><strong>Texto (.txt)</strong><small>Referências em formato BibTeX, em texto</small></span></button></li>
        </ul>
        <input type="file" accept=".bib,.txt" id="athInputImportarBibEstudo" style="display:none;">
      </div>

      <button type="button" class="ath-btn ath-btn-primary ath-btn-icone" id="athBtnNovoArtigoDrive" title="Vincular Artigo & PDF" aria-label="Vincular Artigo & PDF">
        ${svgIcone('mais', 16)}
      </button>
    `;

    const containerHeaderAcoes = document.getElementById('athHeaderAcoesZotero');
    if (containerHeaderAcoes) {
      containerHeaderAcoes.innerHTML = htmlBotoesAcao;
    }

    wrap.innerHTML = `
      <div id="athBibTopoPastasWrapper"></div>

      <div class="ath-estudo-barra-topo">
        <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:620px;">
          <div class="ath-busca-box" style="flex:1;">
            ${svgIcone('busca', 16)}
            <input type="text" class="ath-input" id="athEstudoBuscaInput" value="${escapeHtml(this.filtroBusca)}" placeholder="Buscar artigo por título, autor, tag Zotero ou citação marcada...">
          </div>

          <!-- Botão de Definir Ordem das Referências -->
          <div class="ath-menu-ordenar-bib" id="athMenuOrdenarBib">
            <button type="button" class="ath-btn ath-btn-icone" id="athBtnOrdenarBib" title="Definir ordem das referências" aria-label="Definir ordem das referências" aria-haspopup="menu" aria-expanded="false">
              ${svgIcone('ordenar', 17)}
            </button>
            <div class="ath-menu-ordenar-popover" id="athMenuOrdenarBibPopover" role="menu" hidden>
              <div class="ath-menu-ordenar-header">
                <strong>Ordem das Referências</strong>
              </div>
              <ul class="ath-menu-ordenar-lista" id="athListaOpcoesOrdemBib">
                <li><button type="button" role="menuitem" data-ordem-bib="recente_desc" class="${this.ordemReferencias === 'recente_desc' ? 'sel' : ''}"><span>Alterado recentemente (Padrão)</span>${this.ordemReferencias === 'recente_desc' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-ordem-bib="recente_asc" class="${this.ordemReferencias === 'recente_asc' ? 'sel' : ''}"><span>Alterado mais antigo</span>${this.ordemReferencias === 'recente_asc' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-ordem-bib="titulo_asc" class="${this.ordemReferencias === 'titulo_asc' ? 'sel' : ''}"><span>Título (A → Z)</span>${this.ordemReferencias === 'titulo_asc' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-ordem-bib="titulo_desc" class="${this.ordemReferencias === 'titulo_desc' ? 'sel' : ''}"><span>Título (Z → A)</span>${this.ordemReferencias === 'titulo_desc' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-ordem-bib="autor_asc" class="${this.ordemReferencias === 'autor_asc' ? 'sel' : ''}"><span>Primeiro autor (A → Z)</span>${this.ordemReferencias === 'autor_asc' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-ordem-bib="ano_desc" class="${this.ordemReferencias === 'ano_desc' ? 'sel' : ''}"><span>Ano mais recente</span>${this.ordemReferencias === 'ano_desc' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-ordem-bib="ano_asc" class="${this.ordemReferencias === 'ano_asc' ? 'sel' : ''}"><span>Ano mais antigo</span>${this.ordemReferencias === 'ano_asc' ? svgIcone('check', 13) : ''}</button></li>
              </ul>
            </div>
          </div>

          <!-- Botão de Filtrar Referências -->
          <div class="ath-menu-popover-wrap" id="athMenuFiltrarBibWrap">
            <button type="button" class="ath-btn ath-btn-icone ${this.filtroStatus !== 'todos' ? 'ath-btn-filtro-ativo' : ''}" id="athBtnFiltrarBib" title="Filtrar referências e artigos" aria-label="Filtrar referências e artigos" aria-haspopup="menu" aria-expanded="false">
              ${svgIcone('filtro', 16)}
            </button>
            <div class="ath-menu-popover" id="athMenuFiltrarBibPopover" role="menu" hidden>
              <div class="ath-menu-popover-header">
                <strong>Filtrar Referências</strong>
              </div>
              <ul class="ath-menu-popover-lista" id="athListaOpcoesFiltroBib">
                <li><button type="button" role="menuitem" data-filtro-bib="todos" class="${this.filtroStatus === 'todos' ? 'sel' : ''}"><span>Todos os artigos (Padrão)</span>${this.filtroStatus === 'todos' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-filtro-bib="com_pdf" class="${this.filtroStatus === 'com_pdf' ? 'sel' : ''}"><span>Com arquivo PDF</span>${this.filtroStatus === 'com_pdf' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-filtro-bib="sem_pdf" class="${this.filtroStatus === 'sem_pdf' ? 'sel' : ''}"><span>Sem arquivo PDF</span>${this.filtroStatus === 'sem_pdf' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-filtro-bib="com_notas" class="${this.filtroStatus === 'com_notas' ? 'sel' : ''}"><span>Com notas ou fichamento</span>${this.filtroStatus === 'com_notas' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-filtro-bib="com_riscos" class="${this.filtroStatus === 'com_riscos' ? 'sel' : ''}"><span>Com riscos à mão livre</span>${this.filtroStatus === 'com_riscos' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-filtro-bib="com_citacoes" class="${this.filtroStatus === 'com_citacoes' ? 'sel' : ''}"><span>Com citações marcadas</span>${this.filtroStatus === 'com_citacoes' ? svgIcone('check', 13) : ''}</button></li>
                <li><button type="button" role="menuitem" data-filtro-bib="compartilhados" class="${this.filtroStatus === 'compartilhados' ? 'sel' : ''}"><span>Compartilhados comigo</span>${this.filtroStatus === 'compartilhados' ? svgIcone('check', 13) : ''}</button></li>
              </ul>
              <div class="ath-filtros-obra" aria-label="Filtros da obra">
                <strong>Dados da obra</strong>
                <div class="ath-filtros-anos"><label>Ano de <input type="number" inputmode="numeric" min="1000" max="9999" data-filtro-obra="anoDe" value="${escapeHtml(this.filtrosObra.anoDe)}"></label><label>Até <input type="number" inputmode="numeric" min="1000" max="9999" data-filtro-obra="anoAte" value="${escapeHtml(this.filtrosObra.anoAte)}"></label></div>
                <label>Autor <input type="search" data-filtro-obra="autor" value="${escapeHtml(this.filtrosObra.autor)}" placeholder="Nome ou sobrenome"></label>
                <label>Editora ou periódico <input type="search" data-filtro-obra="editora" value="${escapeHtml(this.filtrosObra.editora)}" placeholder="Nome da publicação"></label>
                <label>Palavra-chave <input type="search" data-filtro-obra="palavra" value="${escapeHtml(this.filtrosObra.palavra)}" placeholder="Tag do Zotero"></label>
                <button type="button" class="ath-filtros-limpar" data-limpar-filtros-obra>Limpar dados da obra</button>
              </div>
            </div>
          </div>
        </div>

        ${!containerHeaderAcoes ? `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">${htmlBotoesAcao}</div>` : ''}
      </div>

      <div class="ath-artigos-zotero-grid" id="athArtigosZoteroGrid"></div>
      <div class="ath-estante-scrim" id="athEstanteScrim"></div>
    `;

    this.container.appendChild(wrap);

    wrap.querySelector('#athEstanteScrim')?.addEventListener('click', () => {
      fecharTodosLivros3D(this.container);
    });

    if (!this._fecharEstanteGlobalConfigurado) {
      this._fecharEstanteGlobalConfigurado = true;
      this.container.addEventListener('click', (ev) => {
        if (!ev.target?.closest?.('.ath-livro-3d')) {
          fecharTodosLivros3D(this.container);
        }
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' || ev.keyCode === 27) {
          const aberto = this.container?.querySelector?.('.ath-livro-3d.aberto');
          if (aberto) tratarTecladoLivro3D(ev, aberto);
        }
      });
    }

    const topoPastasWrap = wrap.querySelector('#athBibTopoPastasWrapper');
    if (topoPastasWrap && typeof this.renderizarBarraPastasTopo === 'function') {
      this.renderizarBarraPastasTopo(topoPastasWrap);
    }

    const inputBusca = wrap.querySelector('#athEstudoBuscaInput');
    inputBusca?.addEventListener('input', () => {
      this.filtroBusca = inputBusca.value.trim().toLowerCase();
      this.atualizarGridCatalogo();
    });

    const btnOrd = wrap.querySelector('#athBtnOrdenarBib');
    const popOrd = wrap.querySelector('#athMenuOrdenarBibPopover');
    const fecharOrd = () => {
      if (!popOrd) return;
      popOrd.hidden = true;
      btnOrd?.setAttribute('aria-expanded', 'false');
    };
    btnOrd?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const abrir = popOrd.hidden;
      popOrd.hidden = !abrir;
      btnOrd.setAttribute('aria-expanded', String(abrir));
      if (abrir) popOrd.querySelector('button')?.focus();
    });
    popOrd?.querySelectorAll('[data-ordem-bib]').forEach(item => {
      item.addEventListener('click', () => {
        this.ordemReferencias = item.dataset.ordemBib;
        try { localStorage.setItem('athenes_ordem_referencias', this.ordemReferencias); } catch (_) {}
        fecharOrd();
        this.atualizarPopoverOrdem(wrap);
        this.atualizarGridCatalogo();
      });
    });
    // Popover Filtrar Referências
    const btnFiltroBib = wrap.querySelector('#athBtnFiltrarBib');
    const popFiltroBib = wrap.querySelector('#athMenuFiltrarBibPopover');
    const fecharFiltroBib = () => {
      if (!popFiltroBib) return;
      popFiltroBib.hidden = true;
      btnFiltroBib?.setAttribute('aria-expanded', 'false');
    };
    btnFiltroBib?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      fecharOrd();
      const abrir = popFiltroBib.hidden;
      popFiltroBib.hidden = !abrir;
      btnFiltroBib.setAttribute('aria-expanded', String(abrir));
    });
    popFiltroBib?.querySelectorAll('[data-filtro-bib]').forEach(item => {
      item.addEventListener('click', () => {
        this.filtroStatus = item.dataset.filtroBib;
        btnFiltroBib?.classList.toggle('ath-btn-filtro-ativo', this.filtroStatus !== 'todos');
        popFiltroBib.querySelectorAll('[data-filtro-bib]').forEach(b => {
          const ativo = b.dataset.filtroBib === this.filtroStatus;
          b.classList.toggle('sel', ativo);
          const icon = b.querySelector('svg');
          if (ativo && !icon) b.insertAdjacentHTML('beforeend', svgIcone('check', 13));
          else if (!ativo && icon) icon.remove();
        });
        fecharFiltroBib();
        this.atualizarGridCatalogo();
      });
    });
    const marcarFiltroAtivo = () => btnFiltroBib?.classList.toggle('ath-btn-filtro-ativo', this.filtroStatus !== 'todos' || Object.values(this.filtrosObra).some(Boolean));
    popFiltroBib?.querySelectorAll('[data-filtro-obra]').forEach(input => input.addEventListener('input', () => {
      this.filtrosObra[input.dataset.filtroObra] = input.value.trim();
      marcarFiltroAtivo();
      this.atualizarGridCatalogo();
    }));
    popFiltroBib?.querySelector('[data-limpar-filtros-obra]')?.addEventListener('click', () => {
      Object.keys(this.filtrosObra).forEach(chave => { this.filtrosObra[chave] = ''; });
      popFiltroBib.querySelectorAll('[data-filtro-obra]').forEach(input => { input.value = ''; });
      marcarFiltroAtivo();
      this.atualizarGridCatalogo();
    });
    marcarFiltroAtivo();

    if (this._fecharMenuOrdemBib) document.removeEventListener('click', this._fecharMenuOrdemBib);
    this._fecharMenuOrdemBib = (ev) => {
      if (!ev.target.closest?.('#athMenuOrdenarBib')) fecharOrd();
      if (!ev.target.closest?.('#athMenuFiltrarBibWrap')) fecharFiltroBib();
    };
    document.addEventListener('click', this._fecharMenuOrdemBib);

    const escopoBotoes = containerHeaderAcoes || wrap;

    escopoBotoes.querySelector('#athBtnConfigurarChaveZotero')?.addEventListener('click', () => {
      this.abrirModalCredenciaisZotero();
    });

    escopoBotoes.querySelector('#athBtnSincronizarZoteroHub')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.classList.add('ath-girando'); btn.disabled = true;
      try { await this.sincronizarComZoteroApi(); } finally { btn.classList.remove('ath-girando'); btn.disabled = false; }
    });

    // "Importar" como lista (mesmo padrão da página inicial)
    const btnImp = escopoBotoes.querySelector('#athBtnImportarBib');
    const listaImp = escopoBotoes.querySelector('#athMenuImportarBibLista');
    const entradaBib = escopoBotoes.querySelector('#athInputImportarBibEstudo');
    const fecharImp = () => { if (!listaImp) return; listaImp.hidden = true; btnImp?.setAttribute('aria-expanded', 'false'); };
    btnImp?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const abrir = listaImp.hidden;
      listaImp.hidden = !abrir;
      btnImp.setAttribute('aria-expanded', String(abrir));
      if (abrir) listaImp.querySelector('button')?.focus();
    });
    listaImp?.querySelectorAll('[data-importar-bib]').forEach(item => item.addEventListener('click', () => {
      fecharImp();
      entradaBib.accept = item.dataset.importarBib;
      entradaBib.click();
    }));
    if (this._fecharImportarBib) document.removeEventListener('click', this._fecharImportarBib);
    this._fecharImportarBib = (ev) => { if (!ev.target.closest?.('#athMenuImportarBib')) fecharImp(); };
    document.addEventListener('click', this._fecharImportarBib);
    escopoBotoes.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && listaImp && !listaImp.hidden) { fecharImp(); btnImp?.focus(); } });

    escopoBotoes.querySelector('#athInputImportarBibEstudo')?.addEventListener('change', e => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const importados = this.zoteroClient.importarBibTeX(ev.target.result || '');
        let adicionados = 0;
        importados.forEach(item => {
          if (!this.artigos.some(a => a.titulo === item.titulo)) {
            this.artigos.unshift(this.converterItemZoteroParaEstudo(item));
            adicionados++;
          }
        });
        salvarArtigosEstudo(this.artigos);
        this.atualizarGridCatalogo();
      };
      reader.readAsText(arq);
    });

    escopoBotoes.querySelector('#athBtnNovoArtigoDrive')?.addEventListener('click', () => {
      this.abrirModalVincularArtigo();
    });

    this.atualizarGridCatalogo();
  }

  converterItemZoteroParaEstudo(item, pastaId = 'pasta_bib_raiz') {
    return {
      id: 'zot_' + (item.id || Date.now().toString(36)),
      pastaId: item.pastaId || pastaId || 'pasta_bib_raiz',
      chaveZotero: item.chave || item.id || 'ZOTLOCAL',
      itemTypeZotero: item.itemTypeZotero || '',
      camposZotero: item.camposZotero || null,
      criadores: item.criadores || null,
      titulo: item.titulo || 'Artigo sem título',
      autores: item.autores?.length ? item.autores : [{ sobrenome: 'Autor', prenome: '' }],
      ano: item.ano || String(new Date().getFullYear()),
      publicacao: item.publicacao || item.editora || 'Periódico Acadêmico',
      editora: item.editora || '',
      volume: item.volume || '',
      numero: item.numero || '',
      paginas: item.paginas || '',
      doi: item.doi || '',
      isbn: item.isbn || item.camposZotero?.ISBN || '',
      palavrasChave: item.palavrasChave?.length ? item.palavrasChave : ['Zotero'],
      driveFileId: '',
      driveFileName: '',
      driveStatus: 'Sem PDF vinculado',
      corCapa: '#314F79',
      totalPaginas: 0,
      resumoOriginal: item.resumo || 'Resumo sincronizado da biblioteca Zotero.',
      fichamento: {
        resumoPessoal: '',
        metodologiaNotas: '',
        citacoesMarcadas: [],
        notasPagina: {},
        tracosPorPagina: {}
      },
      conteudoPaginasPdf: [] // sem PDF vinculado não há páginas: o estúdio avisa e oferece vincular
    };
  }

  atualizarPopoverOrdem(root) {
    const escopo = root || this.container;
    const lista = escopo?.querySelector('#athListaOpcoesOrdemBib');
    if (!lista) return;
    const opcoes = [
      { id: 'recente_desc', rotulo: 'Alterado recentemente (Padrão)' },
      { id: 'recente_asc', rotulo: 'Alterado mais antigo' },
      { id: 'titulo_asc', rotulo: 'Título (A → Z)' },
      { id: 'titulo_desc', rotulo: 'Título (Z → A)' },
      { id: 'autor_asc', rotulo: 'Primeiro autor (A → Z)' },
      { id: 'ano_desc', rotulo: 'Ano mais recente' },
      { id: 'ano_asc', rotulo: 'Ano mais antigo' }
    ];
    lista.innerHTML = opcoes.map(op => {
      const isSel = (this.ordemReferencias || 'recente_desc') === op.id;
      return `<li><button type="button" role="menuitem" data-ordem-bib="${op.id}" class="${isSel ? 'sel' : ''}"><span>${op.rotulo}</span>${isSel ? svgIcone('check', 13) : ''}</button></li>`;
    }).join('');
    lista.querySelectorAll('[data-ordem-bib]').forEach(item => {
      item.addEventListener('click', () => {
        this.ordemReferencias = item.dataset.ordemBib;
        try { localStorage.setItem('athenes_ordem_referencias', this.ordemReferencias); } catch (_) {}
        const pop = escopo.querySelector('#athMenuOrdenarBibPopover');
        if (pop) pop.hidden = true;
        this.atualizarPopoverOrdem(escopo);
        this.atualizarGridCatalogo();
      });
    });
  }

  ordenarArtigos(artigos) {
    const obterTimestampArt = (a) => {
      const dt = a.modificadoEm || a.fichamento?.modificadoEm || a.atualizado_em || a.dataAdicionado || a.data;
      const t = dt ? new Date(dt).getTime() : 0;
      return isNaN(t) ? 0 : t;
    };

    const obterAnoArt = (a) => {
      const n = parseInt(String(a.ano || '').replace(/\D/g, ''), 10);
      return isNaN(n) ? 0 : n;
    };

    const obterPrimeiroAutor = (a) => {
      const primeiro = a.autores?.[0];
      if (!primeiro) return '';
      return `${primeiro.sobrenome || ''} ${primeiro.prenome || ''}`.trim().toLowerCase();
    };

    const ordem = this.ordemReferencias || 'recente_desc';

    return artigos.slice().sort((a, b) => {
      switch (ordem) {
        case 'recente_asc':
          return obterTimestampArt(a) - obterTimestampArt(b);
        case 'titulo_asc':
          return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR', { sensitivity: 'base' });
        case 'titulo_desc':
          return (b.titulo || '').localeCompare(a.titulo || '', 'pt-BR', { sensitivity: 'base' });
        case 'autor_asc':
          return obterPrimeiroAutor(a).localeCompare(obterPrimeiroAutor(b), 'pt-BR', { sensitivity: 'base' });
        case 'ano_desc':
          return obterAnoArt(b) - obterAnoArt(a);
        case 'ano_asc':
          return obterAnoArt(a) - obterAnoArt(b);
        case 'recente_desc':
        default:
          return obterTimestampArt(b) - obterTimestampArt(a);
      }
    });
  }

  atualizarGridCatalogo() {
    const grid = this.container.querySelector('#athArtigosZoteroGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtrados = this.ordenarArtigos(this.artigosCatalogo()).filter(art => {
      if (this.pastaFiltroId && this.pastaFiltroId !== 'todas') {
        if (this.pastaFiltroId === 'compartilhados_comigo') {
          if (!art.compartilhadoComigo) return false;
        } else if (!artigoEstaNaPasta(art, this.pastaFiltroId)) return false;
      }
      if (this.filtroStatus && this.filtroStatus !== 'todos') {
        if (this.filtroStatus === 'com_pdf' && !artigoTemPdf(art)) return false;
        if (this.filtroStatus === 'sem_pdf' && artigoTemPdf(art)) return false;
        if (this.filtroStatus === 'com_notas') {
          const temNota = Boolean(art.fichamento?.resumoPessoal || art.fichamento?.metodologiaNotas || (art.fichamento?.notasPagina && Object.keys(art.fichamento.notasPagina).length > 0));
          if (!temNota) return false;
        }
        if (this.filtroStatus === 'com_riscos') {
          const temRisco = Boolean(art.fichamento?.tracosPorPagina && Object.values(art.fichamento.tracosPorPagina).some(l => Array.isArray(l) && l.length > 0));
          if (!temRisco) return false;
        }
        if (this.filtroStatus === 'com_citacoes') {
          const temCit = Boolean(art.fichamento?.citacoesMarcadas && art.fichamento.citacoesMarcadas.length > 0);
          if (!temCit) return false;
        }
        if (this.filtroStatus === 'compartilhados') {
          const ehComp = Boolean(art.compartilhadoComigo || art.proprietarioExterno || art.docCompartilhadoId);
          if (!ehComp) return false;
        }
      }
      const f = this.filtrosObra;
      const ano = Number(String(art.ano || '').match(/\d{4}/)?.[0] || 0);
      if (f.anoDe && (!ano || ano < Number(f.anoDe))) return false;
      if (f.anoAte && (!ano || ano > Number(f.anoAte))) return false;
      if (f.autor && !(art.autores || []).some(a => `${a.prenome || ''} ${a.sobrenome || ''}`.toLocaleLowerCase('pt-BR').includes(f.autor.toLocaleLowerCase('pt-BR')))) return false;
      if (f.editora && !`${art.editora || art.camposZotero?.publisher || ''} ${art.publicacao || ''}`.toLocaleLowerCase('pt-BR').includes(f.editora.toLocaleLowerCase('pt-BR'))) return false;
      if (f.palavra && !(art.palavrasChave || []).some(tag => String(tag).toLocaleLowerCase('pt-BR').includes(f.palavra.toLocaleLowerCase('pt-BR')))) return false;
      if (!this.filtroBusca) return true;
      const autoresStr = (art.autores || []).map(a => `${a.prenome} ${a.sobrenome}`).join(' ');
      const tagsStr = (art.palavrasChave || []).join(' ');
      const citStr = (art.fichamento?.citacoesMarcadas || []).map(c => c.texto).join(' ');
      const alvo = `${art.titulo} ${autoresStr} ${art.ano} ${art.publicacao} ${tagsStr} ${citStr}`.toLowerCase();
      return alvo.includes(this.filtroBusca);
    });

    if (filtrados.length === 0) {
      const pastaInfo = buscarPastaNaArvore(obterPastasDriveLocais(), this.pastaFiltroId);
      const rotuloLocal = pastaInfo?.nome ? `na pasta "${pastaInfo.nome}"` : 'para este filtro';
      const estanteVazia = renderizarEstante3D([], { maxPorPrateleira: 6 });
      const cardVazio = estanteVazia.querySelector('.ath-estante-vazia-card');
      if (cardVazio) {
        cardVazio.innerHTML = `
          <p style="font-size:15px; font-weight:800; color:#1F2733; margin:0 0 6px 0;">Nenhuma obra encontrada ${escapeHtml(rotuloLocal)}</p>
          <p style="font-size:12.5px; color:#64748B; margin:0 0 14px 0;">${this.pastaFiltroId === 'compartilhados_comigo' ? 'Os artigos compartilhados com seu e-mail Google aparecerão aqui.' : 'Sincronize sua biblioteca Zotero ou vincule um novo PDF para esta pasta de bibliografia.'}</p>
          ${this.pastaFiltroId === 'compartilhados_comigo' ? '' : `<button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnVincularArtigoVazio">${svgIcone('mais', 13)} Vincular Artigo & PDF</button>`}
        `;
        cardVazio.querySelector('#athBtnVincularArtigoVazio')?.addEventListener('click', () => {
          this.abrirModalVincularArtigo({ pastaId: this.pastaFiltroId });
        });
      }
      grid.appendChild(estanteVazia);
      return;
    }

    const estanteEl = renderizarEstante3D(filtrados, {
      maxPorPrateleira: 6,
      callbacks: {
        onAbrirLeitor: (art) => {
          if (art.compartilhadoComigo && !this.artigos.includes(art)) {
            this.abrirArtigoCompartilhadoRecebido(art);
          } else {
            this.abrirArtigoNoEstudio(art, 1);
          }
        },
        onStatusChange: (status) => {
          salvarArtigosEstudo(this.artigos);
        },
        onSalvarNota: (nota) => {
          salvarArtigosEstudo(this.artigos);
          mostrarAviso('Anotação de fichamento salva com sucesso!', { tipo: 'ok' });
        },
        onEditarMeta: (art) => {
          this.abrirModalVincularArtigo(art);
        },
        onEditarMetadados: (art) => {
          this.abrirModalVincularArtigo(art);
        },
        onMoverPasta: (art) => {
          this.abrirModalMoverArtigo(art);
        },
        onMudarCor: (art, cor) => {
          if (cor) {
            art.corCapa = cor;
            salvarArtigosEstudo(this.artigos, art);
          } else {
            this.abrirModalCorCapa(art);
          }
        },
        onAlterarCorCapa: (art, cor) => {
          if (cor) {
            art.corCapa = cor;
            salvarArtigosEstudo(this.artigos, art);
          } else {
            this.abrirModalCorCapa(art);
          }
        }
      }
    });

    grid.appendChild(estanteEl);
  }

  abrirModalMoverArtigo(art) {
    if (!art) return;
    const pastas = coletarPastasBibliografia();
    const modalExistente = document.getElementById('athModalMoverArtigo');
    if (modalExistente) modalExistente.remove();

    const overlay = document.createElement('div');
    overlay.id = 'athModalMoverArtigo';
    overlay.className = 'ath-modal-overlay ath-modal-overlay-visivel';
    overlay.style.zIndex = '120';

    const card = document.createElement('div');
    card.className = 'ath-modal-card';
    card.style.maxWidth = '420px';
    card.style.padding = '24px';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0; font-size:16px; font-weight:800; color:#1E293B; display:flex; align-items:center; gap:8px;">${svgIcone('pasta', 17)} Mover para Pasta</h3>
        <button type="button" class="ath-btn ath-btn-sm ath-btn-fechar" id="athBtnFecharMover" style="border:none; background:transparent; font-size:18px; cursor:pointer;">&times;</button>
      </div>
      <p style="font-size:12.5px; color:#64748B; margin:0 0 16px 0;">Selecione o destino para <strong>${escapeHtml(art.titulo || 'esta obra')}</strong>:</p>
      <div id="athListaPastasDestino" style="display:flex; flex-direction:column; gap:8px; max-height:260px; overflow-y:auto; margin-bottom:18px;">
        <button type="button" class="ath-btn ath-btn-soft" data-pasta-dest="todas" style="text-align:left; padding:8px 12px; font-size:12.5px; font-weight:700;">
          ${svgIcone('livro', 16)} Estante Geral (Raiz)
        </button>
        ${pastas.map(p => `
          <button type="button" class="ath-btn ath-btn-soft" data-pasta-dest="${escapeHtml(p.id)}" style="text-align:left; padding:8px 12px; font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${escapeHtml(p.cor || '#314F79')};"></span>
            ${escapeHtml(p.nome)}
          </button>
        `).join('')}
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    card.querySelector('#athBtnFecharMover')?.addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    card.querySelectorAll('[data-pasta-dest]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.dataset.pastaDest;
        moverLivroParaPasta(art.id, pId, this.artigos, pastas);
        salvarArtigosEstudo(this.artigos);
        fechar();
        this.atualizarGridCatalogo();
        mostrarAviso('Obra movida com sucesso!', { tipo: 'ok' });
      });
    });
  }

  abrirModalCorCapa(art) {
    if (!art) return;
    const modalExistente = document.getElementById('athModalCorCapa');
    if (modalExistente) modalExistente.remove();

    const overlay = document.createElement('div');
    overlay.id = 'athModalCorCapa';
    overlay.className = 'ath-modal-overlay ath-modal-overlay-visivel';
    overlay.style.zIndex = '120';

    const card = document.createElement('div');
    card.className = 'ath-modal-card';
    card.style.maxWidth = '360px';
    card.style.padding = '20px';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0; font-size:15px; font-weight:800; color:#1E293B;">Escolher cor da capa</h3>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnFecharCorCapa" style="border:none; background:transparent; font-size:18px; cursor:pointer;">&times;</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:16px;">
        ${CORES_CAPA_SELECAO.map(({ cor, nome }) => `
          <button type="button" data-cor="${cor}" aria-label="${nome}" aria-pressed="${String(art.corCapa === cor)}" style="height:36px; border-radius:6px; border:2px solid ${art.corCapa === cor ? '#0F172A' : 'transparent'}; background:${cor}; cursor:pointer; transition:transform 0.15s ease;" title="${nome}"></button>
        `).join('')}
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    card.querySelector('#athBtnFecharCorCapa')?.addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    card.querySelectorAll('[data-cor]').forEach(btn => {
      btn.addEventListener('click', () => {
        art.corCapa = btn.dataset.cor;
        salvarArtigosEstudo(this.artigos, art);
        fechar();
        this.atualizarGridCatalogo();
      });
    });
  }

  abrirArtigoCompartilhadoRecebido(art) {
    if (!art) return;
    const existente = this.artigos.find(a => a.id === art.id || (art.chaveZotero && a.chaveZotero === art.chaveZotero));
    if (existente) {
      mesclarFichamentoPreservandoDados(existente, art);
      salvarArtigosEstudo(this.artigos, existente);
      this.abrirArtigoNoEstudio(existente);
    } else {
      this.artigos.unshift(art);
      salvarArtigosEstudo(this.artigos, art);
      this.abrirArtigoNoEstudio(art);
    }
  }

  async abrirModalCompartilharArtigo(art) {
    if (!art) return;

    // Se o artigo tem PDF local mas ainda não subiu para o Google Drive, garante o upload antes de compartilhar
    const idAtualDrive = String(art.driveFileId || '').trim();
    if (!idAtualDrive || /^drive_pdf_/.test(idAtualDrive)) {
      const local = await obterPdfLocal(art.id);
      if (local) {
        await enviarPdfDoArtigoAoDrive(art, local).catch(() => {});
      }
    }

    if (!art.pdfDataUrl) {
      const dUrl = await obterPdfComoDataUrl(art.id);
      if (dUrl) art.pdfDataUrl = dUrl;
    }

    // Garante que o arquivo PDF no Google Drive já tenha permissão compartilhada ativa
    if (art.driveFileId && !/^drive_pdf_/.test(String(art.driveFileId))) {
      compartilharPdfNoDrive(art.driveFileId, { publico: true }).catch(() => {});
    }

    const sessao = lerSessaoSupabase();
    const idSufixo = sessao?.user_id ? `_${sessao.user_id.slice(0, 8)}` : '';
    const idDoc = art.docCompartilhadoId || `artigo_${art.id || 'ref'}${idSufixo}`;
    const docRef = {
      id: idDoc,
      titulo: `[Artigo] ${art.titulo || 'Referência'}`,
      autor: (art.autores || []).map(a => `${a.prenome || ''} ${a.sobrenome || ''}`.trim()).filter(Boolean).join(', ') || 'Autor',
      norma: 'zotero_pdf',
      secoes: [],
      artigoEstudo: art
    };
    art.docCompartilhadoId = docRef.id;
    salvarArtigosEstudo(this.artigos, art);

    new ModalCompartilhar(docRef, obterPerfilColaborador(), {
      aoSalvar: async ({ pessoas, publico }) => {
        art.compartilhamento = { pessoas, publico };
        docRef.artigoEstudo = { ...art, compartilhamento: { pessoas, publico } };
        salvarArtigosEstudo(this.artigos, art);
        if (art.driveFileId) {
          const arrPessoas = Object.entries(pessoas || {}).map(([email, papel]) => ({ email, papel }));
          await compartilharPdfNoDrive(art.driveFileId, { pessoas: arrPessoas, publico: true });
        }
        await salvarDocumentoNoSupabase(docRef, obterPerfilColaborador()).catch(() => {});
        mostrarAviso('Permissões de acesso salvas com sucesso!', { tipo: 'ok' });
      }
    });
  }

  abrirArtigoNoEstudio(art, paginaInicial = 1) {
    const trocouArtigo = this.artigoAberto && String(this.artigoAberto.id) !== String(art?.id);
    definirArtigoAbertoAtivo(art);
    this.artigoAberto = art;
    this.paginaAtual = Math.max(1, parseInt(paginaInicial, 10) || 1);
    this.pinEditandoId = null;
    try {
      if (typeof sessionStorage !== 'undefined' && art?.id) {
        const idAnterior = sessionStorage.getItem('athenes_estudio_artigo_id');
        if (trocouArtigo || (idAnterior && String(idAnterior) !== String(art.id))) {
          sessionStorage.removeItem('athenes_estudio_scroll');
        }
        sessionStorage.setItem('athenes_estudio_artigo_id', String(art.id));
        sessionStorage.setItem('athenes_estudio_pag', String(this.paginaAtual));
        sessionStorage.setItem('athenes_nav_tela', 'estudio');
        sessionStorage.setItem('athenes_dash_aba', 'artigos_zotero');
        this.salvarCacheArtigoAbertoSessao(art);
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && window.history && art?.id) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tela', 'estudio');
        url.searchParams.set('artigo', String(art.id));
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      if (window.scrollY > 0) window.scrollTo?.(0, 0);
      if (typeof document !== 'undefined') {
        if (document.documentElement?.scrollTop > 0) document.documentElement.scrollTop = 0;
        if (document.body?.scrollTop > 0) document.body.scrollTop = 0;
      }
    }
    this._carregandoPdf = !art.pdfBlobUrl && artigoTemPdf(art) ? art : null; // PDF no Drive: "Carregando…" em vez de aviso de "sem PDF"
    if (!art.pdfBlobUrl) {
      garantirPdfDoArtigo(art).then(carregou => {
        if (this._carregandoPdf === art) this._carregandoPdf = null;
        if (this.artigoAberto === art) this.renderizar();
        return carregou;
      }).catch(() => {
        if (this._carregandoPdf === art) this._carregandoPdf = null;
        if (this.artigoAberto === art) this.renderizar();
      });
    }
    this.renderizar();
  }

  /* ==========================================================================
     VISÃO 2: ESTÚDIO EM TELA CHEIA (TODAS AS PÁGINAS EMPILHADAS + 3 COLUNAS)
     ========================================================================== */
  atualizarEstadoFerramentasNoDom(root) {
    root.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('ativo', b.dataset.tool === this.ferramentaAtiva);
    });
    const btnReta = root.querySelector('#athBtnModoLinhaReta');
    if (btnReta) {
      btnReta.classList.toggle('ativo', this.modoLinhaReta);
      btnReta.setAttribute('aria-pressed', this.modoLinhaReta ? 'true' : 'false');
    }
    const btnDedo = root.querySelector('#athBtnDedoRola');
    if (btnDedo) {
      btnDedo.classList.toggle('ativo', Boolean(this.bloquearDedoParaRolar));
      btnDedo.setAttribute('aria-pressed', this.bloquearDedoParaRolar ? 'true' : 'false');
      btnDedo.title = this.bloquearDedoParaRolar
        ? 'Modo Samsung Notes ATIVO: Caneta Stylus escreve · Dedo apenas rola e dá zoom (clique para desenhar com o dedo)'
        : 'Desenhar com o Dedo: Dedo e caneta riscam (clique para ativar modo Samsung Notes)';
    }
    this.salvarConfigPincelAtual();
    root.querySelectorAll('.ath-pdf-ink-canvas').forEach(canvas => {
      canvas.style.pointerEvents = this.ferramentaAtiva === 'cursor' ? 'none' : 'auto';
      canvas.style.cursor = this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair';
      canvas.style.touchAction = 'none';
    });
    // Seletor de espessura: só aparece com Caneta ou Marca-Texto, com valores próprios de cada ferramenta
    const grupoEsp = root.querySelector('#athEspessuras');
    if (grupoEsp) {
      const ehMarca = this.ferramentaAtiva === 'marcatexto';
      const ehCaneta = this.ferramentaAtiva === 'caneta';
      grupoEsp.hidden = !(ehMarca || ehCaneta);
      const valores = ehMarca ? [10, 18, 28, 40] : [2, 3, 6, 10];
      const atual = ehMarca ? this.espessuraMarca : this.espessuraTinta;
      grupoEsp.querySelectorAll('[data-esp]').forEach((b, i) => {
        const v = valores[i];
        b.dataset.esp = String(v);
        b.title = `Espessura ${v} px`;
        b.setAttribute('aria-label', `Espessura ${v} px`);
        b.classList.toggle('on', v === atual);
        const barra = b.querySelector('span');
        if (barra) barra.style.height = `${Math.max(2, Math.min(14, Math.round(v / (ehMarca ? 3 : 1))))}px`;
      });
    }
    const lbl = root.querySelector('#athLabelModoRisco');
    if (lbl) {
      lbl.textContent = `${this.rotuloFerramenta(this.ferramentaAtiva)}${this.modoLinhaReta && (this.ferramentaAtiva === 'caneta' || this.ferramentaAtiva === 'marcatexto') ? ' (Linha Reta)' : ''}`;
    }
  }

  /* ==========================================================================
     RENDERIZAÇÃO DE TODAS AS PÁGINAS EMPILHADAS NO PALCO CENTRAL
     ========================================================================== */
  /** Abre o PDF com pdf.js, mede cada página e prepara uma folha por página. */
  async carregarPdfReal(art) {
    const url = art.pdfBlobUrl;
    if (!this._pdfDocs) this._pdfDocs = new Map();
    if (!this._pdfFalhou) this._pdfFalhou = new Set();
    if (this._pdfDocs.has(url)) return true;
    try {
      const lib = await carregarPdfJs();
      const doc = await lib.getDocument({ url }).promise;
      const n = doc.numPages;
      const dims = await Promise.all(Array.from({ length: n }, async (_, i) => {
        const v = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
        return { w: v.width, h: v.height };
      }));
      const atuais = art.conteudoPaginasPdf || [];
      const qtdReais = atuais.filter(p => p.real).length;
      if (!atuais.length || !atuais[0]?.real || qtdReais !== n) {
        const pagsReais = dims.map((_, i) => ({
          numero: i + 1,
          real: true,
          cabecalho: '',
          titulo: `Folha ${i + 1} do PDF`,
          autores: '',
          paragrafos: []
        }));
        const extras = atuais.filter(p => p.extra);
        extras.forEach((ext, idx) => {
          ext.numero = n + idx + 1;
        });
        art.conteudoPaginasPdf = [...pagsReais, ...extras];
      }
      art.totalPaginas = art.conteudoPaginasPdf.length;
      this._pdfDocs.set(url, { doc, dims, n });
      return true;
    } catch (err) {
      console.warn('Athenes — falha ao abrir PDF com pdf.js:', err);
      this._pdfFalhou.add(url);
      return false;
    }
  }

  /**
   * Pixels reais do bitmap por pixel de CSS da folha (nitidez do texto). Considera a tela (mínimo 2x, para o texto não ficar serrilhado
   * em tela comum), o zoom (ampliar pede mais pixels) e um teto de memória por página (~16 megapixels).
   */
  fatorQualidadePdf(altura = 1123) {
    const zoom = Math.max(1, (this.zoomPct || 100) / 100);
    const desejado = Math.max(window.devicePixelRatio || 1, 2) * zoom;
    const teto = Math.sqrt(16e6 / (794 * Math.max(1, altura)));
    return Math.max(1, Math.min(desejado, teto, 6));
  }

  async renderizarPaginaPdfReal(info, folha, numPag) {
    if (!folha) return;
    const alturaCss = Math.round(794 * info.dims[numPag - 1].h / info.dims[numPag - 1].w);
    const fator = this.fatorQualidadePdf(alturaCss);
    // já desenhada nesta definição: nada a fazer; desenhada em outra (zoom mudou): refaz só o bitmap
    if (folha.dataset.renderizada === '1' && Math.abs(Number(folha.dataset.qualidade || 0) - fator) < 0.2) return;
    const token = (folha._tokenRender = (folha._tokenRender || 0) + 1);
    folha.dataset.renderizada = '1';
    try {
      const page = await info.doc.getPage(numPag);
      const d = info.dims[numPag - 1];
      const escala = 794 / d.w;
      const viewport = page.getViewport({ scale: escala });
      const cv = folha.querySelector('.ath-pdf-render-canvas');
      if (!cv) return;
      // desenha fora da tela e só então troca: a página não pisca em branco ao mudar o zoom
      const novo = document.createElement('canvas');
      novo.width = Math.floor(viewport.width * fator);
      novo.height = Math.floor(viewport.height * fator);
      await page.render({
        canvasContext: novo.getContext('2d'),
        viewport,
        transform: [fator, 0, 0, fator, 0, 0]
      }).promise;
      if (token !== folha._tokenRender || !folha.isConnected) return; // outra renderização mais nova assumiu
      cv.width = novo.width; cv.height = novo.height;
      cv.getContext('2d').drawImage(novo, 0, 0);
      folha.dataset.qualidade = String(fator);
      if (folha.dataset.textoPronto === '1') return; // a camada de texto não depende do zoom

      folha.dataset.textoPronto = '1';
      const camada = folha.querySelector('.ath-pdf-text-layer');
      if (camada) {
        camada.style.setProperty('--scale-factor', String(escala));
        camada.style.setProperty('--total-scale-factor', String(escala));
        const lib = await carregarPdfJs();
        const textContent = await page.getTextContent();
        await new lib.TextLayer({
          textContentSource: textContent,
          container: camada,
          viewport
        }).render();

        let endOfContent = camada.querySelector('.endOfContent');
        if (!endOfContent) {
          endOfContent = document.createElement('div');
          endOfContent.className = 'endOfContent';
          camada.append(endOfContent);
        }
        camada.addEventListener('mousedown', () => {
          camada.classList.add('selecting');
        });

        // Detecta número editorial real da página (ex.: p. 253 em vez de apenas p. 17 do PDF)
        const itensTxt = (textContent.items || [])
          .map(it => String(it.str || '').trim())
          .filter(Boolean);
        const candidatos = [...itensTxt.slice(0, 6), ...itensTxt.slice(-6)];
        for (const cand of candidatos) {
          if (/^\d{1,5}$/.test(cand)) {
            const numEditorial = parseInt(cand, 10);
            const paginaValida = paginaEditorialDoPdf(this.artigoAberto, numPag, info.n, numEditorial);
            if (paginaValida && paginaValida !== numPag) {
              folha.dataset.pagEditorial = String(paginaValida);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Athenes — falha ao desenhar página do PDF:', err);
    }
  }

  /** Páginas muito longe da tela largam o bitmap (um PDF de 30 páginas em alta definição passaria de 1 GB); voltam a ser desenhadas ao se aproximar. */
  liberarBitmapDaFolha(folha) {
    const cv = folha?.querySelector('.ath-pdf-render-canvas');
    if (!cv || folha.dataset.renderizada !== '1') return;
    folha._tokenRender = (folha._tokenRender || 0) + 1;
    cv.width = 1; cv.height = 1;
    folha.dataset.renderizada = '';
    folha.dataset.qualidade = '';
  }

  definirPaginaAtivaSilencioso(numPag, root) {
    if (this.paginaAtual === numPag) return;
    this.paginaAtual = numPag;
    if (!root) return;
    const totalPags = this.artigoAberto?.conteudoPaginasPdf?.length || 1;
    const indBarra = root.querySelector('#athIndicadorPagBarra');
    if (indBarra) {
      const numEditorial = paginaEditorialDoPdf(this.artigoAberto, numPag, this._pdfDocs?.get(this.artigoAberto?.pdfBlobUrl)?.n);
      indBarra.textContent = numEditorial ? `Pág. ${numEditorial} · PDF ${numPag}/${totalPags}` : `Pág. ${numPag} de ${totalPags}`;
    }

    root.querySelectorAll('.ath-pdf-folha-container').forEach(el => {
      el.classList.toggle('pagina-ativa', parseInt(el.dataset.numPagina, 10) === numPag);
    });
    root.querySelectorAll('.ath-pdf-etiqueta-pagina').forEach(el => {
      el.classList.toggle('ativa', parseInt(el.dataset.etiquetaPag, 10) === numPag);
    });
    root.querySelectorAll('[data-ir-pagina-esq]').forEach(li => {
      li.classList.toggle('sel', parseInt(li.dataset.irPaginaEsq, 10) === numPag);
    });
  }

  rolarParaPagina(numPag, root) {
    this.definirPaginaAtivaSilencioso(numPag, root);
    const wrapPag = root?.querySelector(`[data-wrap-pagina="${numPag}"]`);
    const palco = root?.querySelector('#athEstudioPalco');
    if (wrapPag && palco) {
      try {
        const palcoRect = palco.getBoundingClientRect();
        const wrapRect = wrapPag.getBoundingClientRect();
        const diferenca = wrapRect.top - palcoRect.top;
        palco.scrollTo({
          top: palco.scrollTop + diferenca - 16,
          behavior: 'smooth'
        });
      } catch (_) {}
    }
    // Garante que o documento/window não seja deslocado para cima mantendo a barra de topo 100% visível
    if (typeof window !== 'undefined') {
      if (window.scrollY > 0) window.scrollTo(0, 0);
      if (document.documentElement?.scrollTop > 0) document.documentElement.scrollTop = 0;
      if (document.body?.scrollTop > 0) document.body.scrollTop = 0;
    }
  }

  /* ==========================================================================
     PAINEL DE NOTAS ADESIVAS EDITÁVEIS NA FOLHA (SEM WINDOW.PROMPT)
     Suporta: Minimizar (—), Tamanho Compacto (P/M), Arrastar e Sem Cortar Borda
     ========================================================================== */
  atualizarPaineisLateraisDeNotas(root, art) {
    if (!root) return;
    this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
    this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
    (art.conteudoPaginasPdf || []).forEach((_, idx) => {
      const pg = idx + 1;
      const statsEl = root.querySelector(`[data-stats-pag="${pg}"]`);
      if (statsEl) {
        const nRiscos = (art.fichamento.tracosPorPagina?.[pg] || []).length;
        const nNotas = (art.fichamento.notasPagina?.[pg] || []).length;
        statsEl.textContent = `${nRiscos} risco(s) · ${nNotas} nota(s)`;
      }
    });
  }

  criarNotaAdesivaNaPagina(art, numPag, xPct = 52, yPct = 25, textoInicial = '', root = null) {
    const perfil = obterPerfilColaborador();
    if (!art.fichamento.notasPagina) art.fichamento.notasPagina = {};
    if (!Array.isArray(art.fichamento.notasPagina[numPag])) {
      art.fichamento.notasPagina[numPag] = [];
    }
    const novoPin = {
      id: 'pin_' + Date.now().toString(36),
      xPct: Math.max(3, Math.min(60, xPct)),
      yPct: Math.max(3, Math.min(82, yPct)),
      titulo: perfil.nome || 'Nota de Leitura',
      texto: textoInicial || '',
      cor: this.corTinta === '#314F79' ? '#F59E0B' : this.corTinta,
      autor: perfil.nome || 'Autor',
      minimizado: false,
      tamanho: 'normal'
    };
    art.fichamento.notasPagina[numPag].push(novoPin);
    this.pinEditandoId = novoPin.id;
    salvarArtigosEstudo(this.artigos);

    if (root) {
      const layer = root.querySelector(`[data-pins-pag="${numPag}"]`);
      this.renderizarPinsDaPagina(layer, art, numPag, root);
      this.atualizarPaineisLateraisDeNotas(root, art);
    } else {
      this.renderizar();
    }
  }

  renderizarGrifosRetangularesDaPagina(layerEl, art, numPag) {
    if (!layerEl) return;
    layerEl.innerHTML = '';
    const grifos = art.fichamento?.grifosPorPagina?.[numPag] || [];
    grifos.forEach(g => {
      const div = document.createElement('div');
      div.className = 'ath-pdf-hl-rect';
      div.style.left = `${g.xPct}%`;
      div.style.top = `${g.yPct}%`;
      div.style.width = `${g.wPct}%`;
      div.style.height = `${g.hPct}%`;
      div.style.background = g.cor || 'rgba(250, 204, 21, 0.45)';
      layerEl.appendChild(div);
    });
  }

  /* ==========================================================================
     SELEÇÃO DE TEXTO INTERATIVA (GRIFAR TRECHO, CITAR NO ZOTERO, CRIAR NOTA)
     ========================================================================== */
  /* ==========================================================================
     MODAL ELEGANTE PARA CRIAR OU EDITAR CITAÇÃO DO PDF (SEM WINDOW.PROMPT)
     ========================================================================== */
  atualizarAbaCitacoesEContadores(art) {
    if (!this.container) {
      this.renderizar();
      return;
    }
    const qtdCit = art.fichamento?.citacoesMarcadas?.length || 0;
    this.container.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.aba === this.abaDireita);
      if (btn.dataset.aba === 'citacoes') {
        btn.textContent = `Citações (${qtdCit})`;
      }
    });
    this.renderizarPainelDireitoEstudio(this.container.querySelector('#athEstudioPainelCorpo'), art);
    this.renderizarColunaEsquerdaEstudio(this.container.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
  }

  adicionarFolhaExtraNoPdf(art, paginasPdf) {
    const lista = Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.length > 0 ? art.conteudoPaginasPdf : paginasPdf;
    const novoNum = lista.length + 1;
    lista.push({
      numero: novoNum,
      extra: true,
      cabecalho: `${(art.titulo || 'Artigo').slice(0, 55)} · Folha de Anotações Manuscritas #${novoNum}`,
      titulo: `FOLHA DE RASCUNHO E ESQUEMAS VISUAIS (PÁGINA ${novoNum})`,
      autores: 'Espaço livre estilo Samsung Notes para esquemas, mapas mentais e notas sobre o artigo',
      paragrafos: [
        'Use a Caneta, o Marca-Texto, a Linha Reta ou as Notas Adesivas para desenhar esquemas, diagramas e fixar anotações nesta folha complementar.'
      ]
    });
    art.conteudoPaginasPdf = lista;
    art.totalPaginas = lista.length;
    this.paginaAtual = novoNum;
    salvarArtigosEstudo(this.artigos);
    this.renderizar();
    requestAnimationFrame(() => {
      this.rolarParaPagina(novoNum, this.container);
    });
  }

  /* ==========================================================================
     COLUNA ESQUERDA 50/50 COM .rm-card-meio-a-meio (IDÊNTICA À ESCRITA)
     ========================================================================== */
  /* ==========================================================================
     POPOVERS DE TOPO DO ESTÚDIO (ZOTERO API, GOOGLE DRIVE E CANETA)
     ========================================================================== */
  carregarConfigPincelSalva() {
    try {
      const salvo = typeof localStorage !== 'undefined' ? localStorage.getItem('athenes_config_pincel_v1') : null;
      if (salvo) {
        const c = JSON.parse(salvo);
        if (c.ferramentaAtiva) this.ferramentaAtiva = c.ferramentaAtiva;
        if (c.corTinta) this.corTinta = c.corTinta;
        if (c.corGrifoAtiva) this.corGrifoAtiva = c.corGrifoAtiva;
        if (c.espessuraTinta) this.espessuraTinta = c.espessuraTinta;
        if (c.espessuraMarca) this.espessuraMarca = c.espessuraMarca;
        if (typeof c.modoLinhaReta === 'boolean') this.modoLinhaReta = c.modoLinhaReta;
        if (typeof c.bloquearDedoParaRolar === 'boolean') this.bloquearDedoParaRolar = c.bloquearDedoParaRolar;
      }
    } catch (_) {}
  }

  salvarConfigPincelAtual() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('athenes_config_pincel_v1', JSON.stringify({
          ferramentaAtiva: this.ferramentaAtiva,
          corTinta: this.corTinta,
          corGrifoAtiva: this.corGrifoAtiva,
          espessuraTinta: this.espessuraTinta,
          espessuraMarca: this.espessuraMarca,
          modoLinhaReta: this.modoLinhaReta,
          bloquearDedoParaRolar: this.bloquearDedoParaRolar
        }));
      }
    } catch (_) {}
  }

  rotuloFerramenta(tool) {
    const map = {
      cursor: 'Selecionar Texto (Grifar / Citar)',
      caneta: 'Caneta de Risco',
      marcatexto: 'Marca-Texto Translúcido',
      borracha: 'Borracha de Traços',
      nota: 'Fixar Nota Adesiva Editável'
    };
    return map[tool] || tool;
  }

  /** A folha ocupa no layout o tamanho que aparece (sem sobrar espaço entre as páginas): caixa com o tamanho escalado e a folha escalada dentro. */
  aplicarEscalaNaFolha(wrap, escala) {
    if (wrap) wrap.style.minHeight = '';
    const folha = wrap?.querySelector('.ath-pdf-folha-container');
    const caixa = folha?.parentElement;
    if (!folha || !caixa?.classList.contains('ath-pdf-escala')) return;
    const h = parseFloat(folha.dataset.alturaReal) || 1123;
    const wPx = `${Math.round(794 * escala)}px`;
    const hPx = `${Math.round(h * escala)}px`;
    if (caixa.style.width !== wPx) caixa.style.width = wPx;
    if (caixa.style.height !== hPx) caixa.style.height = hPx;
    folha.style.transformOrigin = '0 0';
    const tr = escala === 1 ? '' : `scale(${escala})`;
    if (folha.style.transform !== tr) folha.style.transform = tr;
  }

  aplicarPinchZoom(novoZoom, root, conteudoIniX, conteudoIniY, zoomBaseTouch, midAtualX, midAtualY) {
    const lim = Math.max(50, Math.min(250, Math.round(novoZoom * 10) / 10));
    const container = root || this.container;
    const palco = container?.querySelector('#athEstudioPalco');
    if (!palco) return;

    this.zoomPct = lim;
    const escalaNova = this.zoomPct / 100;
    const razao = this.zoomPct / zoomBaseTouch;

    palco.style.setProperty('--ath-zoom', String(escalaNova));
    palco.querySelectorAll('.ath-pdf-pagina-bloco-wrap').forEach(wrap => this.aplicarEscalaNaFolha(wrap, escalaNova));

    const novoScrollX = Math.round(conteudoIniX * razao - midAtualX);
    const novoScrollY = Math.round(conteudoIniY * razao - midAtualY);
    palco.scrollLeft = Math.max(0, novoScrollX);
    palco.scrollTop = Math.max(0, novoScrollY);

    clearTimeout(this._tZoomQualidade);
    this._tZoomQualidade = setTimeout(() => {
      const obs = this._obsPerto;
      if (!obs) return;
      palco.querySelectorAll('.ath-pdf-folha-container[data-num-pagina]').forEach(f => {
        if (f.querySelector('.ath-pdf-render-canvas')) { obs.unobserve(f); obs.observe(f); }
      });
    }, 250);

    const indBarra = container.querySelector('#athBtnZoomIndicadorBarra');
    if (indBarra) {
      indBarra.textContent = `${Math.round(this.zoomPct)}%`;
    }
  }

  aplicarZoom(novoZoom, root, pontoFoco = null) {
    const lim = Math.max(50, Math.min(250, Math.round(novoZoom * 10) / 10));
    if (Math.abs(this.zoomPct - lim) < 0.05) return;
    const escalaAntiga = this.zoomPct / 100;
    this.zoomPct = lim;
    const escalaNova = this.zoomPct / 100;
    const razao = escalaNova / escalaAntiga;

    const container = root || this.container;
    const palco = container?.querySelector('#athEstudioPalco');
    if (palco) {
      // Ponto focal exato (onde estão os dedos na pinça ou o cursor do mouse)
      const fx = pontoFoco && typeof pontoFoco.x === 'number' ? pontoFoco.x : (palco.clientWidth / 2);
      const fy = pontoFoco && typeof pontoFoco.y === 'number' ? pontoFoco.y : (palco.clientHeight / 2);

      // Coordenada do conteúdo no ponto focal
      const conteudoX = palco.scrollLeft + fx;
      const conteudoY = palco.scrollTop + fy;

      palco.style.setProperty('--ath-zoom', String(escalaNova));
      palco.querySelectorAll('.ath-pdf-pagina-bloco-wrap').forEach(wrap => this.aplicarEscalaNaFolha(wrap, escalaNova));

      // Mantém exatamente o mesmo ponto sob o foco após a nova escala
      const novoScrollX = Math.round(conteudoX * razao - fx);
      const novoScrollY = Math.round(conteudoY * razao - fy);
      palco.scrollLeft = Math.max(0, novoScrollX);
      palco.scrollTop = Math.max(0, novoScrollY);
      // a definição do texto acompanha o zoom: refaz o bitmap das páginas perto da tela (as outras, ao se aproximarem)
      clearTimeout(this._tZoomQualidade);
      this._tZoomQualidade = setTimeout(() => {
        const obs = this._obsPerto;
        if (!obs) return;
        palco.querySelectorAll('.ath-pdf-folha-container[data-num-pagina]').forEach(f => { if (f.querySelector('.ath-pdf-render-canvas')) { obs.unobserve(f); obs.observe(f); } });
      }, 220);
      const lbl = container.querySelector('#athZoomRotulo');
      if (lbl) {
        lbl.textContent = `Escala / Zoom das Folhas PDF (${Math.round(this.zoomPct)}%)`;
      }
      const indBarra = container.querySelector('#athBtnZoomIndicadorBarra');
      if (indBarra) {
        indBarra.textContent = `${Math.round(this.zoomPct)}%`;
      }
    }
  }

  /* ==========================================================================
     MOTOR DE TINTA DIGITAL + MODO LINHA RETA EM CANVAS (POR PÁGINA)
     ========================================================================== */
  apagarTracosProximos(art, numPag, x, y, raio = 28, posPct = null, folhaContainer = null, clientX = null, clientY = null) {
    if (!art || !art.fichamento) return;

    // 1. Apagar traços livres de caneta, marca-texto digital e linhas retas
    const lista = art.fichamento.tracosPorPagina?.[numPag];
    if (Array.isArray(lista)) {
      art.fichamento.tracosPorPagina[numPag] = lista.filter(traco => {
        const pts = traco.pontos || [];
        if (pts.length === 0) return false;
        const rEfetivo = (raio || 28) + ((traco.espessura || 3) / 2);

        // Distância euclidiana ponto-segmento
        const distSeg = (px, py, x1, y1, x2, y2) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const l2 = dx * dx + dy * dy;
          if (l2 === 0) return Math.hypot(px - x1, py - y1);
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
          return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
        };

        if (pts.length === 1) {
          return Math.hypot(pts[0].x - x, pts[0].y - y) > rEfetivo;
        }

        if (traco.reta && pts.length >= 2) {
          const a = pts[0];
          const b = pts[pts.length - 1];
          return distSeg(x, y, a.x, a.y, b.x, b.y) > rEfetivo;
        }

        // Para qualquer traço contínuo ou pincel livre, confere todos os segmentos adjacentes
        for (let i = 0; i < pts.length - 1; i++) {
          if (distSeg(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= rEfetivo) {
            return false;
          }
        }
        return true;
      });
    }

    // 2. Apagar grifos de seleção retangulares em PDF Real (art.fichamento.grifosPorPagina)
    if (Array.isArray(art.fichamento.grifosPorPagina?.[numPag])) {
      const qtdAntes = art.fichamento.grifosPorPagina[numPag].length;
      const alturaReal = folhaContainer ? (parseFloat(folhaContainer.dataset.alturaReal) || folhaContainer.clientHeight || 1123) : 1123;
      const larguraReal = folhaContainer ? (folhaContainer.clientWidth || 794) : 794;
      const r = raio || 28;

      art.fichamento.grifosPorPagina[numPag] = art.fichamento.grifosPorPagina[numPag].filter(g => {
        // A. Distância em coordenadas canônicas da página (canvas 794 x H)
        const gx = (g.xPct / 100) * larguraReal;
        const gy = (g.yPct / 100) * alturaReal;
        const gw = (g.wPct / 100) * larguraReal;
        const gh = (g.hPct / 100) * alturaReal;
        const dxCanvas = Math.max(gx - x, 0, x - (gx + gw));
        const dyCanvas = Math.max(gy - y, 0, y - (gy + gh));
        if (Math.hypot(dxCanvas, dyCanvas) <= r) return false;

        // B. Distância na viewport física (clientX, clientY)
        if (clientX != null && clientY != null && folhaContainer && typeof folhaContainer.getBoundingClientRect === 'function') {
          const rectFolha = folhaContainer.getBoundingClientRect();
          const screenX = rectFolha.left + (g.xPct / 100) * rectFolha.width;
          const screenY = rectFolha.top + (g.yPct / 100) * rectFolha.height;
          const screenW = (g.wPct / 100) * rectFolha.width;
          const screenH = (g.hPct / 100) * rectFolha.height;
          const dxScreen = Math.max(screenX - clientX, 0, clientX - (screenX + screenW));
          const dyScreen = Math.max(screenY - clientY, 0, clientY - (screenY + screenH));
          if (Math.hypot(dxScreen, dyScreen) <= r) return false;
        }

        // C. Tolerância percentual proporcional (posPct)
        if (posPct && typeof posPct.xPct === 'number' && typeof posPct.yPct === 'number') {
          const margemXPct = Math.max(4.5, (r / larguraReal) * 100);
          const margemYPct = Math.max(4.5, (r / alturaReal) * 100);
          const dentroX = posPct.xPct >= (g.xPct - margemXPct) && posPct.xPct <= (g.xPct + g.wPct + margemXPct);
          const dentroY = posPct.yPct >= (g.yPct - margemYPct) && posPct.yPct <= (g.yPct + g.hPct + margemYPct);
          if (dentroX && dentroY) return false;
        }

        return true;
      });

      if (art.fichamento.grifosPorPagina[numPag].length !== qtdAntes) {
        if (folhaContainer) {
          const layer = folhaContainer.querySelector(`[data-grifos-pag="${numPag}"]`);
          if (layer) this.renderizarGrifosRetangularesDaPagina(layer, art, numPag);
        }
        salvarArtigosEstudo(this.artigos || [art]);
      }
    }

    // 3. Apagar grifos de texto HTML (<mark class="ath-pdf-grifo-texto">)
    const escopoBusca = folhaContainer || (typeof document !== 'undefined' ? document : null);
    if (escopoBusca) {
      const marks = Array.from(escopoBusca.querySelectorAll('mark.ath-pdf-grifo-texto, .ath-pdf-grifo-texto'));
      let alterouHtml = false;
      let ultimoColEl = null;
      const r = raio || 28;

      for (const mark of marks) {
        let atingido = false;

        // A. Verificação via coordenadas de tela (clientX, clientY)
        if (clientX != null && clientY != null && typeof mark.getBoundingClientRect === 'function') {
          const rects = (typeof mark.getClientRects === 'function' && mark.getClientRects().length > 0)
            ? Array.from(mark.getClientRects())
            : [mark.getBoundingClientRect()];
          for (const mRect of rects) {
            if (mRect.width === 0 && mRect.height === 0) continue;
            const dx = Math.max(mRect.left - clientX, 0, clientX - mRect.right);
            const dy = Math.max(mRect.top - clientY, 0, clientY - mRect.bottom);
            if (Math.hypot(dx, dy) <= r) {
              atingido = true;
              break;
            }
          }
        }

        // B. Verificação geométrica relativa à folhaContainer
        if (!atingido && folhaContainer && typeof mark.getBoundingClientRect === 'function' && typeof folhaContainer.getBoundingClientRect === 'function') {
          const rectFolha = folhaContainer.getBoundingClientRect();
          const rects = (typeof mark.getClientRects === 'function' && mark.getClientRects().length > 0)
            ? Array.from(mark.getClientRects())
            : [mark.getBoundingClientRect()];
          for (const mRect of rects) {
            if (mRect.width === 0 && mRect.height === 0) continue;
            const relX = ((mRect.left - rectFolha.left) / rectFolha.width) * (folhaContainer.clientWidth || 794);
            const relY = ((mRect.top - rectFolha.top) / rectFolha.height) * (folhaContainer.clientHeight || 1123);
            const relW = (mRect.width / rectFolha.width) * (folhaContainer.clientWidth || 794);
            const relH = (mRect.height / rectFolha.height) * (folhaContainer.clientHeight || 1123);
            const dx = Math.max(relX - x, 0, x - (relX + relW));
            const dy = Math.max(relY - y, 0, y - (relY + relH));
            if (Math.hypot(dx, dy) <= r) {
              atingido = true;
              break;
            }
          }
        }

        // C. Fallback para document.elementsFromPoint se aplicável
        if (!atingido && clientX != null && clientY != null && typeof document !== 'undefined' && typeof document.elementsFromPoint === 'function') {
          const elementos = document.elementsFromPoint(clientX, clientY) || [];
          if (elementos.includes(mark) || elementos.some(el => el.closest?.('mark.ath-pdf-grifo-texto') === mark)) {
            atingido = true;
          }
        }

        if (atingido && mark.parentNode) {
          const colEl = mark.closest('[data-colunas-pag]') || mark.closest('.ath-pdf-folha-texto');
          if (colEl) ultimoColEl = colEl;
          const parent = mark.parentNode;
          if (typeof mark.replaceWith === 'function') {
            mark.replaceWith(...(mark.childNodes || []));
          } else {
            while (mark.firstChild) {
              const child = mark.firstChild;
              if (typeof mark.removeChild === 'function') {
                mark.removeChild(child);
              } else {
                mark.firstChild = null;
              }
              parent.insertBefore(child, mark);
            }
            if (typeof parent.removeChild === 'function') {
              parent.removeChild(mark);
            }
          }
          if (typeof parent.normalize === 'function') parent.normalize();
          alterouHtml = true;
        }
      }

      if (alterouHtml) {
        const nPag = parseInt(folhaContainer?.dataset?.numPagina, 10) || numPag;
        const artAtivo = this.artigos?.find(a => a.id === art.id) || art;
        if (artAtivo.conteudoPaginasPdf?.[nPag - 1]) {
          if (ultimoColEl) {
            artAtivo.conteudoPaginasPdf[nPag - 1].htmlGrifado = ultimoColEl.innerHTML;
          }
        }
        if (this.artigoAberto?.conteudoPaginasPdf?.[nPag - 1] && ultimoColEl) {
          this.artigoAberto.conteudoPaginasPdf[nPag - 1].htmlGrifado = ultimoColEl.innerHTML;
        }
        salvarArtigosEstudo(this.artigos || [artAtivo]);
      }
    }
  }

  redesenharCanvasTinta(canvas, art, numPag = this.paginaAtual) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tracos = art.fichamento?.tracosPorPagina?.[numPag] || [];
    tracos.forEach(tr => {
      const pts = tr.pontos || [];
      if (pts.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tr.cor || '#314F79';
      ctx.lineWidth = tr.espessura || 3;
      ctx.globalAlpha = tr.tipo === 'marcatexto' ? 0.36 : 0.92;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.5, pts[0].y + 0.5);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ==========================================================================
     PAINEL LATERAL DIREITO DO ESTÚDIO: RESUMO, CITAÇÕES E VÍNCULO ZOTERO+DRIVE
     ========================================================================== */
  /* ==========================================================================
     MODAL DE CONFIGURAÇÃO RÁPIDA DE CREDENCIAIS DO ZOTERO (API KEY + USER ID)
     ========================================================================== */
  async sincronizarArtigoComDriveEZotero(art, btnEl = null, statusEl = null) {
    if (this._sincronizandoArtigo) return;
    this._sincronizandoArtigo = true;

    definirArtigoAbertoAtivo(art);
    salvarArtigosEstudo(this.artigos, art);

    const ehBotaoIcone = Boolean(btnEl && (btnEl.classList.contains('rm-ic-bt') || !btnEl.querySelector('span')));
    const txtOriginal = btnEl ? btnEl.innerHTML : '';
    const tituloOriginal = btnEl ? (btnEl.getAttribute('title') || '') : '';
    const ariaLabelOriginal = btnEl ? (btnEl.getAttribute('aria-label') || '') : '';

    if (btnEl) {
      if (ehBotaoIcone) {
        btnEl.classList.add('ath-salvando');
        btnEl.classList.remove('ath-salvo', 'ath-salvar-erro');
        btnEl.setAttribute('aria-busy', 'true');
        btnEl.setAttribute('title', 'Salvando alterações...');
        btnEl.setAttribute('aria-label', 'Salvando alterações...');
      } else {
        btnEl.disabled = true;
        const span = btnEl.querySelector('span');
        if (span) span.textContent = 'Salvando...';
        else btnEl.textContent = 'Salvando...';
      }
    }

    const resultados = [];

    try {
      try {
        await bib.sincronizarBiblioteca();
        resultados.push('Biblioteca sincronizada ✓');
      } catch (_) {}

      const htmlNotaZotero = gerarHtmlNotaZoteroDoArtigo(art);
      if (this.temZoteroConectado() && art.chaveZotero) {
        try {
          const resZot = await this.zoteroClient.sincronizarNotaFilhaNoZotero({
            parentItemKey: art.chaveZotero,
            noteKey: art.notaZoteroKey || null,
            htmlNota: htmlNotaZotero,
            tags: ['Athenes', 'Fichamento PDF', ...(art.palavrasChave || []).slice(0, 3)],
            artigoMetadados: art
          });
          if (resZot.parentKey) art.chaveZotero = resZot.parentKey;
          if (resZot.noteKey) art.notaZoteroKey = resZot.noteKey;
          if (this.zoteroClient.userId) {
            this.salvarConfigZotero({ userId: this.zoteroClient.userId });
          }
          if (resZot.ok) resultados.push('Zotero ✓');
        } catch (e) {
          console.warn('[Athenes] Zotero sync nota:', e.message);
        }
      }

      try {
        const sessaoSync = lerSessaoSupabase();
        const idSufixoSync = sessaoSync?.user_id ? `_${sessaoSync.user_id.slice(0, 8)}` : '';
        const idDocSync = art.docCompartilhadoId || `artigo_${art.id || 'ref'}${idSufixoSync}`;
        art.docCompartilhadoId = idDocSync;
        await salvarDocumentoNoSupabase({
          id: idDocSync,
          titulo: `[Fichamento PDF] ${art.titulo}`,
          autor: (art.autores || []).map(a => `${a.prenome || ''} ${a.sobrenome || ''}`.trim()).filter(Boolean).join(', ') || 'Autor',
          norma: 'zotero_pdf',
          secoes: [],
          artigoEstudo: art
        });
        resultados.push('Nuvem Supabase ✓');
      } catch (_) {}

      const driveCfg = obterConfigGoogleDrive();
      if (driveCfg.accessToken || driveCfg.clientId) {
        try {
          const token = await obterTokenOuConectar(driveCfg);
          const salvoDrive = await salvarArquivoNoGoogleDrive({
            nomeArquivo: `${(art.driveFileName || 'Artigo').replace(/\.pdf$/i, '')}.athenes-pdf.json`,
            conteudoBlobOuTexto: art,
            accessToken: token,
            pastaId: driveCfg.pastaId || null,
            driveFileId: art.driveAnnotationFileId || null
          });
          if (salvoDrive?.id) art.driveAnnotationFileId = salvoDrive.id;

          // Se o PDF ainda não está salvo no Google Drive, faz o upload para a pasta indicada
          if (!art.driveFileId) {
            const pdfBlob = await obterPdfLocal(art.id) || art.pdfBlob;
            if (pdfBlob) {
              const nomePdf = art.driveFileName || `${(art.titulo || 'artigo').slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
              const salvoPdf = await salvarArquivoNoGoogleDrive({
                nomeArquivo: nomePdf,
                conteudoBlobOuTexto: pdfBlob,
                mimeType: 'application/pdf',
                accessToken: token,
                pastaId: driveCfg.pastaId || null
              });
              if (salvoPdf?.id) {
                art.driveFileId = salvoPdf.id;
                art.driveFileName = salvoPdf.name || nomePdf;
                art.driveStatus = 'PDF no Google Drive';
              }
            }
          }
          resultados.push('Google Drive ✓');
        } catch (_) {}
      }

      salvarArtigosEstudo(this.artigos, art);

      if (btnEl) {
        if (ehBotaoIcone) {
          btnEl.classList.remove('ath-salvando');
          btnEl.classList.add('ath-salvo');
          btnEl.removeAttribute('aria-busy');
          btnEl.setAttribute('title', 'Salvo com sucesso!');
          btnEl.setAttribute('aria-label', 'Salvo com sucesso!');

          if (this._timerFeedbackSalvar) clearTimeout(this._timerFeedbackSalvar);
          this._timerFeedbackSalvar = setTimeout(() => {
            btnEl.classList.remove('ath-salvo');
            btnEl.setAttribute('title', tituloOriginal || 'Salvar alterações');
            btnEl.setAttribute('aria-label', ariaLabelOriginal || 'Salvar');
            this._timerFeedbackSalvar = null;
          }, 1800);
        } else {
          btnEl.disabled = false;
          const span = btnEl.querySelector('span');
          if (span) span.textContent = 'Salvo ✓';
          else btnEl.textContent = 'Salvo ✓';
          setTimeout(() => {
            if (span) span.textContent = 'Sincronizar agora';
            else btnEl.innerHTML = txtOriginal;
          }, 1800);
        }
      }

      if (statusEl) {
        statusEl.textContent = resultados.join(' · ');
      }
      mostrarAviso('Alterações, riscos e citações salvos com sucesso!', { tipo: 'ok' });

    } catch (err) {
      console.error('[Athenes] Falha ao sincronizar artigo:', err);

      if (btnEl) {
        if (ehBotaoIcone) {
          btnEl.classList.remove('ath-salvando', 'ath-salvo');
          btnEl.classList.add('ath-salvar-erro');
          btnEl.removeAttribute('aria-busy');
          btnEl.setAttribute('title', 'Erro ao salvar. Clique para tentar novamente.');
          btnEl.setAttribute('aria-label', 'Erro ao salvar. Tentar novamente.');

          if (this._timerFeedbackSalvar) clearTimeout(this._timerFeedbackSalvar);
          this._timerFeedbackSalvar = setTimeout(() => {
            btnEl.classList.remove('ath-salvar-erro');
            btnEl.setAttribute('title', tituloOriginal || 'Salvar alterações');
            btnEl.setAttribute('aria-label', ariaLabelOriginal || 'Salvar');
            this._timerFeedbackSalvar = null;
          }, 3000);
        } else {
          btnEl.disabled = false;
          const span = btnEl.querySelector('span');
          if (span) span.textContent = 'Erro ao salvar';
          else btnEl.textContent = 'Erro ao salvar';
          setTimeout(() => {
            if (span) span.textContent = 'Sincronizar agora';
            else btnEl.innerHTML = txtOriginal;
          }, 3000);
        }
      }

      if (statusEl) {
        statusEl.style.color = '#B91C1C';
        statusEl.textContent = `Atenção: ${err.message || 'Falha na sincronização'}`;
      }
      mostrarAviso(`Erro ao salvar: ${err.message || 'verifique sua conexão.'}`, { tipo: 'erro' });

    } finally {
      this._sincronizandoArtigo = false;
    }
  }

  async sincronizarComZoteroApi({ silencioso = false } = {}) {
    this.carregarConfigZotero();
    if (!this.zoteroClient.apiKey) {
      if (!silencioso) this.abrirModalCredenciaisZotero();
      return;
    }

    // Remove os 3 artigos fictícios de demonstração assim que o usuário sincroniza a conta real do Zotero
    this.artigos = this.artigos.filter(a => !ehArtigoExemploFicticio(a));
    if (this.artigoAtivo && ehArtigoExemploFicticio(this.artigoAtivo)) {
      this.artigoAtivo = null;
    }

    const itens = await this.zoteroClient.buscarItens();
    if (this.zoteroClient.userId) {
      this.salvarConfigZotero({ userId: this.zoteroClient.userId });
    }

    // as coleções do Zotero viram pastas de bibliografia (mesmos nomes e hierarquia)
    let mapaPastas = new Map();
    let pastasNovas = 0;
    try {
      const colecoes = await this.zoteroClient.listarColecoes();
      if (colecoes.length) {
        const esp = espelharColecoesNasPastas(obterPastasDriveLocais(), colecoes);
        mapaPastas = esp.mapa;
        pastasNovas = esp.criadas;
        if (esp.criadas || esp.renomeadas) salvarPastasDriveLocais(esp.pastas);
      }
    } catch (e) { console.warn('[Athenes] Coleções do Zotero:', e.message); }
    const naRaizOuZotero = (a) => !a.pastaId || a.pastaId === 'pasta_bib_raiz' || String(a.pastaId).startsWith('zot_col_'); // pasta escolhida à mão não é desfeita

    let novos = 0;
    (itens || []).forEach(it => {
      const ids = pastasDoItemZotero(it.colecoes, mapaPastas);
      const existente = this.artigos.find(a => a.chaveZotero === it.chave || (!a.chaveZotero && a.titulo === it.titulo));
      if (existente) {
        existente.colecoesZotero = it.colecoes || [];
        existente.itemTypeZotero = it.itemTypeZotero || existente.itemTypeZotero || '';
        existente.camposZotero = it.camposZotero || existente.camposZotero || null; // informações do Zotero atualizadas a cada sincronização
        existente.criadores = it.criadores || existente.criadores || null;
        if (!existente.doi && it.doi) existente.doi = it.doi;
        if (!existente.isbn && it.isbn) existente.isbn = it.isbn;
        if (!existente.paginas && it.paginas) existente.paginas = it.paginas;
        if (naRaizOuZotero(existente)) { existente.pastasIds = ids; existente.pastaId = ids[0]; }
        return;
      }
      const novo = this.converterItemZoteroParaEstudo(it, ids[0]);
      novo.pastasIds = ids;
      novo.colecoesZotero = it.colecoes || [];
      this.artigos.unshift(novo);
      novos++;
    });
    // PDFs vinculados, notas e anotações de PDF do Zotero (só metadados: o arquivo é baixado sob demanda)
    try {
      const filhos = await this.zoteroClient.listarFilhos();
      this.artigos.forEach(a => { if (a.chaveZotero) aplicarFilhosZoteroAoArtigo(a, a.chaveZotero, filhos); });
    } catch (e) { console.warn('[Athenes] Anexos e notas do Zotero:', e.message); }
    salvarArtigosEstudo(this.artigos);
    if (typeof this.aoMudarPastas === 'function') this.aoMudarPastas({ pastasNovas });
    this.renderizar();
    if (!silencioso) {
      if (!itens || itens.length === 0) {
        alert(
          `Conexão ativa com sua conta Zotero (${this.zoteroClient.username || 'User'} · ID #${this.zoteroClient.userId || 'OK'}).\n\n` +
          `A nuvem online do Zotero (zotero.org) retornou 0 itens para esta conta.\n` +
          `• Se os seus artigos estão no Zotero Desktop do seu computador, clique no ícone redondo verde "Sincronizar com zotero.org" no canto superior direito do Zotero Desktop.\n` +
          `• Ou use o botão "Importar .bib" no topo para carregar sua coleção instantaneamente!`
        );
      } else {
        alert(`Sincronização Zotero concluída! ${novos} novo(s) artigo(s) trazido(s) da sua biblioteca (${itens.length} itens lidos).`);
      }
    }
  }

  /**
   * Desfaz o vínculo do PDF com a referência (vinculou o arquivo errado). O arquivo NÃO é apagado do Drive nem do Zotero: só deixa de
   * estar ligado a este artigo, que volta a "sem PDF" e pode receber outro. Citações, notas e riscos já feitos ficam guardados.
   */
  async desvincularPdfDoArtigo(art) {
    if (!art) return false;
    const marcas = (art.fichamento?.citacoesMarcadas?.length || 0) + Object.values(art.fichamento?.notasPagina || {}).reduce((t, l) => t + (l?.length || 0), 0) + Object.values(art.fichamento?.tracosPorPagina || {}).reduce((t, l) => t + (l?.length || 0), 0);
    const aviso = `Desvincular o PDF "${art.driveFileName || 'deste artigo'}" da referência?\n\nO arquivo continua no seu Drive (nada é apagado) e você poderá vincular outro PDF.${marcas ? `\n\nAs ${marcas} marcação(ões) já feitas (citações, notas e riscos) ficam guardadas, mas estão ligadas às páginas do PDF antigo.` : ''}`;
    if (!window.confirm(aviso)) return false;
    const url = art.pdfBlobUrl;
    this._pdfDocs?.delete(url);
    if (url) { try { URL.revokeObjectURL(url); } catch (_) {} }
    this._pdfFalhou?.clear();
    art.pdfBlobUrl = null; art.temPdfLocal = false; art.pdfBlob = null;
    art.driveFileId = ''; art.driveFileName = ''; art.driveStatus = 'Sem PDF vinculado';
    art.conteudoPaginasPdf = []; art.totalPaginas = 0; // as páginas vinham do arquivo antigo
    try { await removerPdfLocal(art.id); } catch (_) {} // sobra de versões antigas: sem isso o arquivo voltaria sozinho
    salvarArtigosEstudo(this.artigos);
    this.paginaAtual = 1;
    this.renderizar();
    mostrarAviso('PDF desvinculado. Escolha outro arquivo quando quiser.', { tipo: 'info', ms: 5000 });
    return true;
  }

  /** Escolhe um PDF no Drive e o liga ao artigo (a cópia já está na pasta do Athenes): abre na folha e guarda o vínculo. */
  escolherPdfNoDrive(art) {
    this.abrirModalEscolherPdfDoGoogleDrive((arq) => {
      art.driveFileName = arq.name;
      art.driveFileId = arq.id;
      art.driveStatus = 'PDF no Google Drive';
      art.pdfBlobUrl = null;
      if (this._pdfFalhou) this._pdfFalhou.clear();
      salvarArtigosEstudo(this.artigos);
      this.renderizar();
      garantirPdfDoArtigo(art).then(ok => { if (ok) this.renderizar(); });
    });
  }

  /**
   * Navega por TODAS as pastas do Google Drive (Meu Drive, Compartilhados comigo e a pasta do Athenes), com busca por nome. Ao escolher
   * um PDF de fora do Athenes, ele é COPIADO para a pasta do Athenes (o original não é tocado) e `onEscolhido({ id, name })` recebe a
   * cópia. Ler as pastas do resto do Drive exige o acesso de leitura, pedido aqui na primeira vez (o Athenes sozinho só vê o que criou).
   */
  async abrirModalEscolherPdfDoGoogleDrive(onEscolhido) {
    const cfg = obterConfigGoogleDrive();
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal ath-drive-nav" style="max-width:640px; width:94vw;">
        <div class="ath-modal-head">
          <h2>Escolher PDF do Google Drive</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalEscPdfDriveFechar" aria-label="Fechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div class="ath-dn-abas" role="tablist">
            <button type="button" role="tab" class="on" data-aba="meu">Meu Drive</button>
            <button type="button" role="tab" data-aba="comigo">Compartilhados comigo</button>
            <button type="button" role="tab" data-aba="athenes">Pasta do Athenes</button>
          </div>
          <input type="search" class="ath-input ath-dn-busca" placeholder="Buscar PDF ou pasta pelo nome em todo o Drive…" aria-label="Buscar no Drive">
          <nav class="ath-dn-trilha" aria-label="Caminho"></nav>
          <div class="ath-dn-status" role="status" aria-live="polite">Conectando ao seu Google Drive…</div>
          <div class="ath-dn-lista"></div>
          <button type="button" class="ath-btn ath-btn-sm ath-dn-mais" hidden>Carregar mais</button>
        </div>
        <div class="ath-modal-foot">
          <small class="ath-dn-dica">O PDF escolhido é copiado para a pasta do Athenes; o original fica onde está.</small>
          <button type="button" class="ath-btn" id="athModalEscPdfDriveCancelar">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalEscPdfDriveFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalEscPdfDriveCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const q = (s) => modal.querySelector(s);
    const statusEl = q('.ath-dn-status'); const listaEl = q('.ath-dn-lista'); const trilhaEl = q('.ath-dn-trilha'); const maisEl = q('.ath-dn-mais'); const buscaEl = q('.ath-dn-busca');
    const estado = { aba: 'meu', trilha: [{ id: 'root', nome: 'Meu Drive' }], busca: '', proximo: '', req: 0, itens: { pastas: [], pdfs: [] } };
    const aviso = (t, erro = false) => { statusEl.style.color = erro ? '#B42318' : '#314F79'; statusEl.textContent = t; };
    const fmtTam = (n) => { const b = Number(n) || 0; return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b ? `${Math.max(1, Math.round(b / 1024))} KB` : ''; };
    const fmtData = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR'); };

    const desenharTrilha = () => {
      trilhaEl.hidden = estado.aba !== 'meu' || Boolean(estado.busca);
      trilhaEl.innerHTML = estado.trilha.map((p, i) => i === estado.trilha.length - 1
        ? `<strong>${escapeHtml(p.nome)}</strong>`
        : `<button type="button" data-nivel="${i}">${escapeHtml(p.nome)}</button><span aria-hidden="true">›</span>`).join('');
      trilhaEl.querySelectorAll('[data-nivel]').forEach(b => b.addEventListener('click', () => { estado.trilha = estado.trilha.slice(0, Number(b.dataset.nivel) + 1); carregar(); }));
    };

    const desenharLista = () => {
      const { pastas, pdfs } = estado.itens;
      if (!pastas.length && !pdfs.length) { listaEl.innerHTML = '<div class="ath-dn-vazio">Nada por aqui: nenhuma pasta nem PDF.</div>'; return; }
      listaEl.innerHTML = [
        ...pastas.map((p, i) => `<button type="button" class="ath-dn-item ath-dn-pasta" data-pasta="${i}"><span class="ath-dn-ic">${svgIcone('pasta', 16)}</span><span class="ath-dn-nome">${escapeHtml(p.name)}</span><span class="ath-dn-seta" aria-hidden="true">›</span></button>`),
        ...pdfs.map((a, i) => `<div class="ath-dn-item ath-dn-pdf"><span class="ath-dn-ic">${svgIcone('pdf', 16)}</span><span class="ath-dn-nome" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}<small>${[fmtData(a.modifiedTime), fmtTam(a.size)].filter(Boolean).join(' · ')}</small></span><button type="button" class="ath-btn ath-btn-primary ath-btn-sm" data-pdf="${i}">${estado.aba === 'athenes' ? 'Usar este PDF' : 'Copiar e usar'}</button></div>`)
      ].join('');
      listaEl.querySelectorAll('[data-pasta]').forEach(b => b.addEventListener('click', () => { const p = estado.itens.pastas[Number(b.dataset.pasta)]; buscaEl.value = ''; estado.busca = ''; estado.trilha.push({ id: p.id, nome: p.name }); carregar(); }));
      listaEl.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => escolher(estado.itens.pdfs[Number(b.dataset.pdf)], b)));
    };

    const pedirPermissao = () => {
      statusEl.textContent = '';
      listaEl.innerHTML = `<div class="ath-dn-permissao">
        <strong>Permitir que o Athenes leia as pastas do seu Drive</strong>
        <p>Por padrão o Athenes só enxerga o que ele mesmo criou. Para escolher um PDF que está em qualquer pasta sua, o Google pede uma permissão de <b>somente leitura</b>. O Athenes não altera nem apaga nada nos seus arquivos: ele apenas copia o PDF escolhido para a pasta do Athenes.</p>
        <button type="button" class="ath-btn ath-btn-primary" data-permitir>Permitir leitura do Drive</button>
      </div>`;
      listaEl.querySelector('[data-permitir]').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true; aviso('Abrindo a autorização do Google…');
        try { await autenticarGoogleDrive(cfg.clientId, ESCOPOS_COM_LEITURA); carregar(); }
        catch (err) { aviso(`Não foi possível autorizar: ${err.message || err}`, true); pedirPermissao(); }
      });
    };

    const carregar = async ({ mais = false } = {}) => {
      desenharTrilha(); maisEl.hidden = true;
      if (!mais) { listaEl.innerHTML = ''; estado.itens = { pastas: [], pdfs: [] }; estado.proximo = ''; }
      const req = ++estado.req; // resposta de uma consulta antiga (troca rápida de aba/pasta) é descartada
      aviso(mais ? 'Carregando mais…' : 'Listando seu Google Drive…');
      try {
        const token = await obterTokenOuConectar(obterConfigGoogleDrive());
        if (estado.aba !== 'athenes' && !(await tokenPodeLerTodoODrive(token))) { if (req === estado.req) pedirPermissao(); return; } // só com `drive.file` a lista viria vazia
        let r;
        if (estado.aba === 'athenes') {
          const pdfs = await listarPdfsDoGoogleDrive(token);
          r = { pastas: [], pdfs, proximo: '' };
        } else {
          r = await listarConteudoDoDrive(token, { pastaId: estado.trilha[estado.trilha.length - 1].id, busca: estado.busca, compartilhados: estado.aba === 'comigo', pageToken: mais ? estado.proximo : '' });
        }
        if (req !== estado.req) return;
        estado.itens = { pastas: [...estado.itens.pastas, ...r.pastas], pdfs: [...estado.itens.pdfs, ...r.pdfs] };
        estado.proximo = r.proximo;
        maisEl.hidden = !r.proximo;
        const n = estado.itens.pdfs.length; const m = estado.itens.pastas.length;
        aviso(estado.busca ? `${n} PDF(s) e ${m} pasta(s) com "${estado.busca}"` : `${m} pasta(s) e ${n} PDF(s)`);
        desenharLista();
      } catch (err) {
        if (req !== estado.req) return;
        if (err.semPermissao && estado.aba !== 'athenes') { pedirPermissao(); return; }
        aviso(`Não foi possível listar o Drive: ${err.message || err}. Use "Selecionar PDF no computador" se preferir.`, true);
      }
    };

    const escolher = async (arq, botao) => {
      if (!arq) return;
      if (estado.aba === 'athenes') { onEscolhido?.({ id: arq.id, name: arq.name }); fechar(); return; }
      modal.querySelectorAll('button').forEach(b => { b.disabled = true; });
      aviso(`Copiando "${arq.name}" para a pasta do Athenes…`);
      try {
        const token = await obterTokenOuConectar(obterConfigGoogleDrive());
        const copia = await copiarPdfDoDriveParaAthenes(token, arq, { pastaNome: PASTA_PDFS_DRIVE });
        onEscolhido?.({ id: copia.id, name: copia.name, jaExistia: copia.jaExistia });
        fechar();
      } catch (err) {
        modal.querySelectorAll('button').forEach(b => { b.disabled = false; });
        aviso(`Não foi possível copiar o PDF: ${err.message || err}`, true);
      }
    };

    modal.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => {
      estado.aba = b.dataset.aba; estado.busca = ''; buscaEl.value = ''; estado.trilha = [{ id: 'root', nome: 'Meu Drive' }];
      modal.querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x === b));
      buscaEl.disabled = estado.aba === 'athenes';
      carregar();
    }));
    let tBusca = null;
    buscaEl.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { estado.busca = buscaEl.value.trim(); carregar(); }, 350); });
    maisEl.addEventListener('click', () => carregar({ mais: true }));

    carregar();
  }

}

Object.assign(EstudoArtigosView.prototype, metodosEstudoTela, metodosEstudoPainelDireito, metodosEstudoAnotacoes, metodosEstudoModais, metodosEstudoPastas);
