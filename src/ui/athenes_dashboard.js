// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Área Inicial / Dashboard Dividida em Duas Páginas:
 * 1. Página de Escrita & Documentos (Artigos, Relatórios, Teses em blocos)
 * 2. Página de Leitura & Fichamento de Artigos (Vínculo Zotero + Leitor/Riscador de PDF estilo Samsung Notes + Google Drive)
 * Inclui barra superior de Identificação / Login do Usuário sincronizada com Supabase e Google Drive.
 */

import { lerConta, obterContaAtiva } from '../core/athenes_conta.js';
import { TIPOS_DOCUMENTO } from '../core/athenes_documento.js';

import {
  obterPerfilColaborador,
  salvarPerfilColaborador,
  encerrarSessao,
  CORES_COLABORADORES,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive,
  listarDocumentosDoSupabase,
  excluirDocumentoDoSupabase,
  entrarNaNuvemComGoogle,
  nuvemAutenticada,
  carregarDocumentoDoSupabase,
  salvarDocumentoNoSupabase,
  autenticarGoogleDrive,
  obterInfoUsuarioGoogle,
  obterOuCriarEstruturaPastasAthenes,
  obterPastasDriveLocais,
  salvarPastasDriveLocais,
  adicionarSubpastaDriveLocal,
  adicionarPastaCompartilhadaDriveLocal,
  removerPastaDriveLocal,
  buscarPastaNaArvore,
  criarSubpastaNoGoogleDrive,
  listarSubpastasDoGoogleDrive,
  extrairIdPastaDrive
} from '../core/athenes_colaboracao.js';

import { EstudoArtigosView, carregarArtigosEstudo } from './athenes_estudo_artigos.js';

import * as repositorio from '../core/athenes_repositorio.js';

import { caminhoDaPasta } from '../core/athenes_arquivos.js';
import { listarCompartilhadosComigo, carregarDocumentoCompartilhado } from '../core/athenes_compartilhamento.js';
import { svgIcone, svgLogo, svgGoogleDrive } from './athenes_icones.js';
import { GerenciadorArquivosUI } from './athenes_arquivos_ui.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { mostrarAviso } from './athenes_aviso.js';
import { abrirNovoDocumentoModal, abrirImportadorDocxModal } from './athenes_novo_documento_modal.js';
import { criarDocumentoDeTemplate } from '../core/athenes_templates.js';
import { driveConectado, tokenDriveValido, obterTokenDrive, sincronizarPastasComDrive, sincronizarDocumentosComDrive, marcarSessaoDriveExpirada, precisaEnviarAoDrive, registrarPastasExcluidas, processarPastasExcluidas, registrarExclusoes, idsExcluidos, processarExclusoesPendentes, baixarDocumentoDoDrive } from '../core/athenes_drive_sync.js';
import { metodosDashboardModais } from './athenes_dashboard_modais.js';
import { metodosDashboardPastas } from './athenes_dashboard_pastas.js';
import { metodosDashboardSincronia } from './athenes_dashboard_sincronia.js';
import { mostrarCadernoDocumento } from './athenes_dashboard_caderno.js';

export class DashboardView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.documentos = [];
    this.onAbrirDocumento = opcoes.onAbrirDocumento || (() => {});
    this.onCriarDocumento = opcoes.onCriarDocumento || (() => {});
    this.onLogout = opcoes.onLogout || (() => {});
    this.filtroBusca = '';
    this.filtroTipo = 'todos';
    this.ordemDocumentos = 'recente_desc';
    this.diretoEstudio = Boolean(opcoes.diretoEstudio);
    this.artigoInicialId = opcoes.artigoInicialId || null;
    this.abaAtiva = opcoes.abaInicial || (this.diretoEstudio ? 'artigos_zotero' : ((typeof sessionStorage !== 'undefined' && sessionStorage.getItem('athenes_dash_aba')) || 'escrita')); // 'escrita' | 'artigos_zotero'
    this.pastaAtivaId = opcoes.pastaInicialId || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('athenes_dash_pasta')) || 'todas';
    this.pastasDrive = obterPastasDriveLocais();
    this.perfilUsuario = obterPerfilColaborador();
    this.estudoView = null;
    this.arquivos = new GerenciadorArquivosUI(this); // duplicar, mover, seleção em lote, arrastar e soltar

    this.carregarDocumentosLocais();
    this.renderizar();
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      setTimeout(() => this.sincronizarComSupabase(true), 1200);
      // o servidor é a fonte da verdade: ao abrir, ao voltar para esta janela e depois de cada alteração local
      setTimeout(() => this.sincronizarPerfilServidor(), 300);
      let ultimaFoco = 0;
      this._aoFocar = () => { if (!this.container?.isConnected || Date.now() - ultimaFoco < 15000) return; ultimaFoco = Date.now(); this.sincronizarPerfilServidor(); this.sincronizarCompartilhados(); };
      window.addEventListener('focus', this._aoFocar);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this._aoFocar?.(); });
      this._aoMudarPastas = () => this.agendarPerfil();
      window.addEventListener('athenes:pastas-alteradas', this._aoMudarPastas);
    }
  }

  /**
   * A lista vem da memória da sessão (refeita a partir do servidor); nada é lido do navegador, exceto, uma única vez, os
   * documentos que versões antigas deixaram lá (para não perder nada) até estarem todos a salvo no Drive.
   */
  carregarDocumentosLocais() {
    repositorio.carregarLegadoUmaVez();
    this.documentos = [...repositorio.listar()];
  }

  salvarDocumentosLocais() {
    repositorio.definir(this.documentos); // só memória: o servidor e o Drive guardam
    if (!this._aplicandoPerfil) this.agendarPerfil(); // mudou algo: o servidor precisa saber
  }

  /**
   * Grava a lista local e, para documentos na nuvem, o registro remoto. Rejeita em caso de falha
   * (cota do navegador cheia, Supabase indisponível) para o gerenciador de arquivos desfazer a ação.
   */
  async persistirDocumentos(docs = []) {
    repositorio.definir(this.documentos);
    this.agendarPerfil();
    for (const d of docs) {
      if (d.salvoNuvem || nuvemAutenticada()) { await salvarDocumentoNoSupabase(d, this.perfilUsuario, undefined, { preservarData: true }); d.salvoNuvem = true; }
    }
  }

  /** Obtém o conteúdo completo para o editor e para a prévia do caderno. */
  async carregarDocumentoCompleto(doc, card = null) {
    let docParaAbrir = doc;
    if (doc.precisaCarregarConteudo) {
      const btnAbrir = card?.querySelector('.ath-btn-abrir');
      const rotuloAnterior = btnAbrir?.textContent;
      if (btnAbrir) btnAbrir.textContent = 'Baixando...';
      try {
        let remoto = null;
        if (doc.origemDrive && doc.driveFileId) {
          const token = await obterTokenDrive();
          if (!token) throw new Error('A sessão do Google Drive expirou. Reconecte o Drive.');
          remoto = await baixarDocumentoDoDrive(doc, token); // conteúdo do SEU Drive, só quando você abre
        } else if (doc.compartilhadoComigo) {
          const res = await carregarDocumentoCompartilhado(doc.id); // traz o papel (leitura, comentário ou edição) para abrir no modo certo
          if (!res) throw new Error('Você não tem mais acesso a este documento.');
          remoto = res.doc; remoto.precisaCarregarConteudo = false;
        } else {
          remoto = await carregarDocumentoDoSupabase(doc.id);
          if (remoto) { remoto.salvoNuvem = true; remoto.precisaCarregarConteudo = false; }
        }
        if (remoto) {
          docParaAbrir = remoto;
          const idx = this.documentos.findIndex(d => String(d.id) === String(doc.id));
          if (idx >= 0) this.documentos[idx] = docParaAbrir;
          this.salvarDocumentosLocais();
        }
        if (btnAbrir) btnAbrir.textContent = rotuloAnterior;
      } catch (e) {
        alert(`Falha ao abrir documento da nuvem: ${e.message}`);
        if (btnAbrir) btnAbrir.textContent = rotuloAnterior;
        return null;
      }
    }
    return docParaAbrir;
  }

  /** Abre um documento (baixando da nuvem antes, se preciso). */
  async abrirDocumento(doc, card = null) {
    const docParaAbrir = await this.carregarDocumentoCompleto(doc, card);
    if (!docParaAbrir) return;
    this.onAbrirDocumento(docParaAbrir);
  }

  abrirDocumentoDoCard(doc) {
    return this.abrirDocumento(doc, this.container.querySelector(`[data-doc-id="${doc.id}"]`));
  }

  abrirCadernoDocumento(doc, card) {
    if (this.abaAtiva !== 'escrita') return;
    const cardAtual = card?.isConnected ? card : [...this.container.querySelectorAll('[data-doc-id]')]
      .find(el => el.dataset.docId === String(doc.id));
    this._fecharCaderno?.();
    let carregamento;
    const fechar = mostrarCadernoDocumento(doc, {
      retornoFoco: cardAtual,
      onFechar: () => { this._fecharCaderno = null; },
      onAbrir: async () => {
        const completo = await carregamento;
        if (completo) this.onAbrirDocumento(completo);
      }
    });
    this._fecharCaderno = fechar;
    carregamento = doc.precisaCarregarConteudo
      ? this.carregarDocumentoCompleto(doc, cardAtual)
      : Promise.resolve(doc);
    if (doc.precisaCarregarConteudo) {
      carregamento.then(completo => {
        if (this._fecharCaderno !== fechar) return;
        fechar.atualizar(completo || doc, { falha: !completo });
      });
    }
  }

  obterIniciais(nome) {
    return String(nome || 'AU')
      .trim()
      .split(/\s+/)
      .map(p => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  rotuloPapel(papel) {
    if (papel === 'orientador') return 'Prof. Orientador / Revisor';
    if (papel === 'revisor') return 'Pesquisador / Coautor';
    return 'Autor Principal';
  }

  renderizar() {
    this._fecharCaderno?.();
    if (!this.container) return;
    this.container.innerHTML = '';
    this.perfilUsuario = obterPerfilColaborador();
    const driveCfg = obterConfigGoogleDrive();

    let estudioFullInicial = this.abaAtiva === 'artigos_zotero' && Boolean(this.diretoEstudio);
    try {
      if (!estudioFullInicial) {
        estudioFullInicial = this.abaAtiva === 'artigos_zotero' && typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('athenes_estudio_artigo_id'));
      }
    } catch (_) {}

    const root = document.createElement('div');
    root.className = estudioFullInicial ? 'ath-dashboard ath-dashboard-estudio-full' : 'ath-dashboard';

    const iniciais = this.obterIniciais(this.perfilUsuario.nome);
    const papelTxt = this.rotuloPapel(this.perfilUsuario.papel);
    const instituicaoTxt = this.perfilUsuario.instituicao || 'Universidade / Grupo de Pesquisa';

    root.innerHTML = `
      <!-- Barra Superior de Marca + Seletor de Páginas (Escrita vs Artigos Zotero/PDF) + Identificação/Login -->
      <div class="ath-dash-topbar">
        <div class="ath-dash-brand" title="Athenes — Plataforma Acadêmica Colaborativa">
          ${svgLogo(30)}
        </div>

        <!-- Seletor das Duas Páginas Principais -->
        <nav class="ath-dash-nav-paginas" id="athDashNavPaginas" aria-label="Páginas da Área Inicial">
          <button type="button" class="ath-dash-aba-btn ${this.abaAtiva === 'escrita' ? 'on' : ''}" data-aba-dash="escrita" id="athTabDashEscrita">
            ${svgIcone('documento', 15)}
            <span>1. Escrita & Documentos</span>
          </button>
          <button type="button" class="ath-dash-aba-btn ${this.abaAtiva === 'artigos_zotero' ? 'on' : ''}" data-aba-dash="artigos_zotero" id="athTabDashArtigosZotero">
            ${svgIcone('zotero', 15)}
            <span>2. Leitura de Artigos, PDF & Zotero</span>
          </button>
        </nav>

        <!-- Identificação de Quem Está Mexendo / Login -->
        <div class="ath-dash-user-box" style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="ath-dash-btn-topo ath-dash-btn-instalar" id="athBtnInstalarPwa" style="display:none;" title="Instalar Athenes no seu celular, tablet ou computador para usar como app">
            ${svgIcone('dispositivo', 15)}<span>Instalar App</span>
          </button>
          ${driveCfg.pastaUrl ? `
            <a href="${driveCfg.pastaUrl}" target="_blank" rel="noopener noreferrer" class="ath-dash-btn-topo ath-dash-btn-drive" title="Abrir a pasta do Athenes no seu Google Drive" aria-label="Pasta no Google Drive">
              ${svgIcone('drive', 15)}<span class="ath-dash-btn-texto-drive">Pasta no Drive</span><span class="ath-dash-btn-topo-seta" aria-hidden="true">↗</span>
            </a>
          ` : ''}
          <button type="button" class="ath-dash-user-pill" id="athBtnPerfilLoginDash" title="Clique para identificar quem está usando, trocar perfil ou conectar Google Drive e Zotero">
            ${this.perfilUsuario.autenticadoGoogle && this.perfilUsuario.foto 
              ? `<img src="${this.perfilUsuario.foto}" class="ath-dash-user-avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #CBD5E1; flex-shrink:0;" alt="Avatar">`
              : `<span class="ath-dash-user-avatar" style="background:${this.perfilUsuario.cor || '#314F79'};">${iniciais}</span>`}
            <span class="ath-dash-user-info">
              <strong>${this.perfilUsuario.nome || 'Autor Principal'}</strong>
              <small>${papelTxt} · ${instituicaoTxt}</small>
            </span>
            <span class="ath-dash-user-edit">${svgIcone('lapis', 12)}</span>
          </button>
        </div>
      </div>

      ${this.perfilUsuario.autenticadoGoogle && !nuvemAutenticada() ? `
      <div id="athAvisoSincronizacao" role="status" style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:0 0 10px; padding:8px 14px; border-radius:12px; background:#FFFBEB; border:1px solid #FDE68A; color:#92400E; font-size:12.5px;">
        <span><strong>Sincronização do perfil desativada neste computador.</strong> Confirme a conta Google para ver os mesmos documentos, pastas, exclusões, compartilhados e o Zotero dos seus outros computadores.</span>
        <button type="button" class="ath-btn-rodape ath-btn-rodape-primario" id="athBtnAtivarSincronizacao" style="height:32px;">Ativar sincronização</button>
      </div>` : ''}

      <!-- Layout Principal com Barra Lateral de Pastas do Google Drive e Conteúdo Filtrado -->
      <div class="ath-dash-layout" id="athDashLayout">
        <div class="ath-dash-scrim" id="athDashScrim" aria-hidden="true"></div>

        <!-- Alça de Toque para Abrir Pastas no Tablet e Telas Menores -->
        <button type="button" class="ath-dash-alca-pastas" id="athDashAlcaPastas" title="Abrir pastas do Drive" aria-label="Abrir pastas do Drive">
          ${svgIcone('pasta', 14)}
        </button>

        <!-- Barra Lateral de Pastas do Google Drive -->
        <aside class="ath-dash-sidebar" id="athDashSidebar" aria-label="Pastas do Google Drive">
          <div class="ath-dash-sidebar-head">
            <div style="display:flex; align-items:center; gap:6px;">
              ${svgIcone('drive', 16)}
              <strong style="font-size:12px; color:#314F79; letter-spacing:0.03em; text-transform:uppercase;">Pastas do Drive</strong>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <button type="button" class="ath-btn ath-btn-xs" id="athBtnRecarregarPastasDrive" title="Sincronizar agora: cria as pastas e envia os documentos pendentes ao Drive" style="padding:2px 7px; height:24px; font-size:11px;">
                ↻
              </button>
              <button type="button" class="ath-btn ath-btn-xs ath-dash-sidebar-fechar-btn" id="athBtnFecharPastasDrawer" title="Fechar painel de pastas" aria-label="Fechar pastas">
                ✕
              </button>
            </div>
          </div>
          <button type="button" id="athDriveStatus" class="ath-btn ath-btn-xs" style="margin:6px 0 0; width:100%; box-sizing:border-box; justify-content:flex-start; gap:6px; font-size:11px; font-weight:700; height:auto; padding:5px 8px; text-align:left; white-space:normal;"></button>

          <div class="ath-dash-pastas-lista" id="athDashPastasLista">
            <!-- Preenchido por this.renderizarPastasLateral() -->
          </div>

          <div class="ath-dash-sidebar-acoes">
            <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaSubpastaModal" style="width:100%; justify-content:center; gap:6px; font-weight:700; font-size:11.5px;">
              ${svgIcone('mais', 13)} Nova Subpasta
            </button>
            <button type="button" class="ath-btn ath-btn-sm" id="athBtnVincularPastaModal" style="width:100%; justify-content:center; gap:6px; font-weight:700; font-size:11.5px; margin-top:6px; background:#fff;">
              ${svgIcone('elo', 13)} Vincular Compartilhada
            </button>
          </div>
        </aside>

        <!-- Área Principal de Conteúdo -->
        <div class="ath-dash-main-area">
          <!-- Banner / Breadcrumbs da Pasta Selecionada -->
          <div class="ath-dash-pasta-banner" id="athDashPastaBanner">
            <div class="ath-dash-pasta-banner-info" id="athDashPastaBannerInfo"></div>
          </div>

          <!-- Conteúdo da Aba 1: Escrita & Documentos -->
          <section id="athSecaoDashEscrita" ${this.abaAtiva === 'escrita' ? '' : 'hidden'}>
            <header class="ath-dash-head">
              <div class="ath-dash-titulo">
                <h1>Meus Documentos e Artigos</h1>
                <p>Ambiente de escrita e diagramação acadêmica em blocos com revisão estilo Google Docs e sincronia em tempo real.</p>
              </div>
              <div class="ath-dash-head-acoes">
                <button type="button" class="ath-btn ath-btn-icone ${driveConectado() ? 'ath-btn-zotero-ok' : ''}" id="athBtnBackupEspaco" title="${driveConectado() ? 'Google Drive conectado: backup, nuvem e sincronização ativos' : 'Google Drive: conectar para backup e sincronização'}" aria-label="Google Drive">
                  ${svgGoogleDrive(20)}
                </button>
                <button type="button" class="ath-btn ath-btn-icone" id="athBtnSincronizarNuvem" title="Sincronizar: traz do servidor e do Drive o que mudou em outros computadores e envia o que mudou aqui" aria-label="Sincronizar">
                  ${svgIcone('sincronizar', 17)}
                </button>
                <div class="ath-menu-importar" id="athMenuImportar">
                  <button type="button" class="ath-btn ath-btn-icone ath-btn-importar-coluna" id="athBtnImportar" aria-haspopup="menu" aria-expanded="false" title="Importar documento (.json, .athenes) ou template do Word (.docx)" aria-label="Importar documento ou template">
                    ${svgIcone('importar', 14)}
                    ${svgIcone('baixo', 8)}
                  </button>
                  <ul class="ath-menu-importar-lista" id="athMenuImportarLista" role="menu" hidden>
                    <li><button type="button" role="menuitem" data-importar="json">${svgIcone('documento', 14)}<span><strong>Documento Athenes</strong><small>.athenes ou .json</small></span></button></li>
                    <li><button type="button" role="menuitem" data-importar="docx">${svgIcone('docx', 14)}<span><strong>Template do Word</strong><small>.docx: extrai os estilos, sem copiar o texto</small></span></button></li>
                  </ul>
                  <input type="file" accept=".json,.athenes" id="athInputImportarJson" style="display:none;">
                  <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" id="athInputImportarDocx" style="display:none;">
                </div>
                <button type="button" class="ath-btn ath-btn-primary ath-btn-icone" id="athBtnNovoDocModal" title="Novo Documento" aria-label="Novo Documento">
                  ${svgIcone('mais', 16)}
                </button>
              </div>
            </header>

            <div class="ath-dash-filtros-linha">
              <div class="ath-busca-box">
                ${svgIcone('busca', 16)}
                <input type="text" class="ath-input" id="athDashBusca" placeholder="Pesquisar por título, autor ou palavra-chave...">
              </div>

              <!-- Menu Ordenar Documentos -->
              <div class="ath-menu-popover-wrap" id="athMenuOrdenarDocWrap">
                <button type="button" class="ath-btn ath-btn-icone" id="athBtnOrdenarDoc" title="Definir ordem dos documentos" aria-label="Definir ordem dos documentos" aria-haspopup="menu" aria-expanded="false">
                  ${svgIcone('ordenar', 17)}
                </button>
                <div class="ath-menu-popover" id="athMenuOrdenarDocPopover" role="menu" hidden>
                  <div class="ath-menu-popover-header">
                    <strong>Ordem dos Documentos</strong>
                  </div>
                  <ul class="ath-menu-popover-lista" id="athListaOpcoesOrdemDoc">
                    <li><button type="button" role="menuitem" data-ordem-doc="recente_desc" class="${this.ordemDocumentos === 'recente_desc' ? 'sel' : ''}"><span>Alterado recentemente (Padrão)</span>${this.ordemDocumentos === 'recente_desc' ? svgIcone('check', 13) : ''}</button></li>
                    <li><button type="button" role="menuitem" data-ordem-doc="recente_asc" class="${this.ordemDocumentos === 'recente_asc' ? 'sel' : ''}"><span>Alterado mais antigo</span>${this.ordemDocumentos === 'recente_asc' ? svgIcone('check', 13) : ''}</button></li>
                    <li><button type="button" role="menuitem" data-ordem-doc="titulo_asc" class="${this.ordemDocumentos === 'titulo_asc' ? 'sel' : ''}"><span>Título (A → Z)</span>${this.ordemDocumentos === 'titulo_asc' ? svgIcone('check', 13) : ''}</button></li>
                    <li><button type="button" role="menuitem" data-ordem-doc="titulo_desc" class="${this.ordemDocumentos === 'titulo_desc' ? 'sel' : ''}"><span>Título (Z → A)</span>${this.ordemDocumentos === 'titulo_desc' ? svgIcone('check', 13) : ''}</button></li>
                  </ul>
                </div>
              </div>

              <!-- Menu Filtrar Documentos -->
              <div class="ath-menu-popover-wrap" id="athMenuFiltrarDocWrap">
                <button type="button" class="ath-btn ath-btn-icone ${this.filtroTipo !== 'todos' ? 'ath-btn-filtro-ativo' : ''}" id="athBtnFiltrarDoc" title="Filtrar por tipo de documento" aria-label="Filtrar por tipo de documento" aria-haspopup="menu" aria-expanded="false">
                  ${svgIcone('filtro', 16)}
                </button>
                <div class="ath-menu-popover" id="athMenuFiltrarDocPopover" role="menu" hidden>
                  <div class="ath-menu-popover-header">
                    <strong>Filtrar por Tipo</strong>
                  </div>
                  <ul class="ath-menu-popover-lista" id="athListaOpcoesFiltroDoc">
                    <li><button type="button" role="menuitem" data-filtro-tipo="todos" class="${this.filtroTipo === 'todos' ? 'sel' : ''}"><span>Todos os tipos (Padrão)</span>${this.filtroTipo === 'todos' ? svgIcone('check', 13) : ''}</button></li>
                    ${TIPOS_DOCUMENTO.map(t => `<li><button type="button" role="menuitem" data-filtro-tipo="${t.id}" class="${this.filtroTipo === t.id ? 'sel' : ''}"><span>${escapeHtml(t.rotulo)}</span>${this.filtroTipo === t.id ? svgIcone('check', 13) : ''}</button></li>`).join('')}
                  </ul>
                </div>
              </div>
            </div>

            <div class="ath-docs-grid" id="athDocsGrid">
              <!-- Cards dos documentos -->
            </div>
          </section>

          <!-- Conteúdo da Aba 2: Leitura de Artigos, Anotador de PDF (estilo Samsung Notes) & Zotero + Drive -->
          <section id="athSecaoDashArtigosZotero" ${this.abaAtiva === 'artigos_zotero' ? '' : 'hidden'}>
            <header class="ath-dash-head">
              <div class="ath-dash-titulo">
                <h1>Estúdio de Artigos, Leitura de PDF & Fichamento Zotero</h1>
                <p>Leia seus PDFs em tela cheia, risque à mão livre, marque citações e sincronize suas notas com o Zotero.</p>
              </div>
              <div id="athHeaderAcoesZotero" class="ath-dash-head-acoes"></div>
            </header>
            <div id="athContainerEstudoArtigos"></div>
          </section>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-aba-dash]').forEach(btn => {
      btn.addEventListener('click', () => {
        const novaAba = btn.dataset.abaDash;
        if (this.abaAtiva !== novaAba) {
          if (novaAba === 'escrita') {
            this.diretoEstudio = false;
            this.artigoInicialId = null;
            try {
              sessionStorage.setItem('athenes_nav_tela', 'dashboard');
              sessionStorage.removeItem('athenes_estudio_artigo_id');
              const url = new URL(window.location.href);
              if (url.searchParams.get('tela') === 'estudio') url.searchParams.delete('tela');
              url.searchParams.delete('artigo');
              window.history.replaceState(null, '', url.pathname + url.search + url.hash);
            } catch (_) {}
          }
          this.abaAtiva = novaAba; try { if (typeof sessionStorage !== 'undefined') { sessionStorage.setItem('athenes_dash_aba', novaAba); sessionStorage.setItem('athenes_dash_pasta', 'todas'); } } catch (_) {}
          this.pastaAtivaId = 'todas';
          this.renderizar();
        }
      });
    });

    root.querySelector('#athBtnAtivarSincronizacao')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Confirmando…';
      try {
        await entrarNaNuvemComGoogle();
        root.querySelector('#athAvisoSincronizacao')?.remove();
        await this.sincronizarComSupabase(true);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Ativar sincronização';
        mostrarAviso(`Não foi possível ativar a sincronização: ${err.message}`);
      }
    });

    // PWA Install Action
    const btnInstalar = root.querySelector('#athBtnInstalarPwa');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (!isStandalone) {
      if (window.deferredPwaPrompt || isIos) {
        if (btnInstalar) btnInstalar.style.display = 'inline-flex';
      }
    }

    btnInstalar?.addEventListener('click', async () => {
      if (window.deferredPwaPrompt) {
        window.deferredPwaPrompt.prompt();
        const choice = await window.deferredPwaPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          window.deferredPwaPrompt = null;
          if (btnInstalar) btnInstalar.style.display = 'none';
        }
      } else if (isIos) {
        mostrarAviso('Para instalar no iPad ou iPhone: toque no botão Compartilhar (quadrado com seta para cima) no Safari e escolha "Adicionar à Tela de Início".', { tipo: 'info' });
      } else {
        mostrarAviso('Para instalar o Athenes como app, clique no ícone de instalação na barra do navegador.', { tipo: 'info' });
      }
    });

    root.querySelector('#athBtnPerfilLoginDash')?.addEventListener('click', () => {
      this.abrirModalIdentificacaoLogin();
    });

    root.querySelector('#athBtnNovoDocModal').addEventListener('click', () => this.abrirModalNovoDoc({ pastaId: this.pastaAtivaId })); // na pasta selecionada, cria nela

    const inputBusca = root.querySelector('#athDashBusca');
    inputBusca.addEventListener('input', () => {
      this.filtroBusca = inputBusca.value.trim().toLowerCase();
      this.atualizarGrid();
    });

    // Popover Ordenar Documentos
    const btnOrdDoc = root.querySelector('#athBtnOrdenarDoc');
    const popOrdDoc = root.querySelector('#athMenuOrdenarDocPopover');
    const fecharPopOrdDoc = () => { if (popOrdDoc) popOrdDoc.hidden = true; btnOrdDoc?.setAttribute('aria-expanded', 'false'); };
    btnOrdDoc?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      fecharPopFiltroDoc();
      const abrir = popOrdDoc.hidden;
      popOrdDoc.hidden = !abrir;
      btnOrdDoc.setAttribute('aria-expanded', String(abrir));
    });
    popOrdDoc?.querySelectorAll('[data-ordem-doc]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ordemDocumentos = btn.dataset.ordemDoc;
        popOrdDoc.querySelectorAll('[data-ordem-doc]').forEach(b => {
          const ativo = b.dataset.ordemDoc === this.ordemDocumentos;
          b.classList.toggle('sel', ativo);
          const icon = b.querySelector('svg');
          if (ativo && !icon) b.insertAdjacentHTML('beforeend', svgIcone('check', 13));
          else if (!ativo && icon) icon.remove();
        });
        fecharPopOrdDoc();
        this.atualizarGrid();
      });
    });

    // Popover Filtrar Documentos
    const btnFiltroDoc = root.querySelector('#athBtnFiltrarDoc');
    const popFiltroDoc = root.querySelector('#athMenuFiltrarDocPopover');
    const fecharPopFiltroDoc = () => { if (popFiltroDoc) popFiltroDoc.hidden = true; btnFiltroDoc?.setAttribute('aria-expanded', 'false'); };
    btnFiltroDoc?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      fecharPopOrdDoc();
      const abrir = popFiltroDoc.hidden;
      popFiltroDoc.hidden = !abrir;
      btnFiltroDoc.setAttribute('aria-expanded', String(abrir));
    });
    popFiltroDoc?.querySelectorAll('[data-filtro-tipo]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroTipo = btn.dataset.filtroTipo;
        btnFiltroDoc.classList.toggle('ath-btn-filtro-ativo', this.filtroTipo !== 'todos');
        popFiltroDoc.querySelectorAll('[data-filtro-tipo]').forEach(b => {
          const ativo = b.dataset.filtroTipo === this.filtroTipo;
          b.classList.toggle('sel', ativo);
          const icon = b.querySelector('svg');
          if (ativo && !icon) b.insertAdjacentHTML('beforeend', svgIcone('check', 13));
          else if (!ativo && icon) icon.remove();
        });
        fecharPopFiltroDoc();
        this.atualizarGrid();
      });
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest?.('#athMenuOrdenarDocWrap')) fecharPopOrdDoc();
      if (!ev.target.closest?.('#athMenuFiltrarDocWrap')) fecharPopFiltroDoc();
    });

    const inputDocx = root.querySelector('#athInputImportarDocx');
    inputDocx?.addEventListener('change', async (e) => {
      const arq = e.target.files?.[0];
      e.target.value = ''; // permite importar o mesmo arquivo de novo
      if (arq) await abrirImportadorDocxModal(arq, {
        onSalvo: () => this.abrirModalNovoDoc({ pastaId: this.pastaAtivaId }),
        onCriarDocumento: (template) => {
          const novo = criarDocumentoDeTemplate(template, { titulo: template.titulo, modoConteudo: 'placeholder' });
          this.registrarNovoDocumento(novo, this.pastaAtivaId !== 'todas' ? this.pastaAtivaId : 'pasta_rel_raiz');
        }
      });
    });

    const inputImportar = root.querySelector('#athInputImportarJson');
    inputImportar.addEventListener('change', e => this.importarDocumentoJson(e.target.files[0]));

    const btnImportar = root.querySelector('#athBtnImportar');
    const listaImportar = root.querySelector('#athMenuImportarLista');
    const fecharMenuImportar = () => { listaImportar.hidden = true; btnImportar.setAttribute('aria-expanded', 'false'); };
    btnImportar?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const abrir = listaImportar.hidden;
      listaImportar.hidden = !abrir;
      btnImportar.setAttribute('aria-expanded', String(abrir));
      if (abrir) listaImportar.querySelector('button')?.focus();
    });
    listaImportar?.querySelectorAll('[data-importar]').forEach(item => item.addEventListener('click', () => {
      fecharMenuImportar();
      root.querySelector(item.dataset.importar === 'docx' ? '#athInputImportarDocx' : '#athInputImportarJson')?.click();
    }));
    document.addEventListener('click', (ev) => { if (!ev.target.closest?.('#athMenuImportar')) fecharMenuImportar(); });
    root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !listaImportar.hidden) { fecharMenuImportar(); btnImportar.focus(); } });

    root.querySelector('#athBtnSincronizarNuvem')?.addEventListener('click', () => {
      this.sincronizarComSupabase(false);
    });

    root.querySelector('#athBtnBackupEspaco')?.addEventListener('click', () => {
      this.abrirModalBackupEspaco();
    });

    if (estudioFullInicial) {
      const sb = root.querySelector('#athDashSidebar');
      const bn = root.querySelector('#athDashPastaBanner');
      if (sb) sb.style.display = 'none';
      if (bn) bn.style.display = 'none';
      root.querySelectorAll('.ath-dash-head, .ath-dash-topbar, .ath-dash-alca-pastas').forEach(el => {
        el.style.display = 'none';
      });
      const secaoEscrita = root.querySelector('#athSecaoDashEscrita');
      if (secaoEscrita) secaoEscrita.style.display = 'none';
    }
    this.container.appendChild(root);

    // O banner da pasta é o cabeçalho único das duas bibliotecas.
    const cabecalhoAtivo = root.querySelector(this.abaAtiva === 'escrita'
      ? '#athSecaoDashEscrita > .ath-dash-head'
      : '#athSecaoDashArtigosZotero > .ath-dash-head');
    const acoesAtivas = cabecalhoAtivo?.querySelector('.ath-dash-head-acoes');
    if (acoesAtivas) root.querySelector('#athDashPastaBanner')?.appendChild(acoesAtivas);
    root.querySelectorAll('#athSecaoDashEscrita > .ath-dash-head, #athSecaoDashArtigosZotero > .ath-dash-head')
      .forEach(cabecalho => cabecalho.remove());

    // Inicialização da barra lateral de pastas do Google Drive
    if (!estudioFullInicial) {
      this.renderizarPastasLateral();
      this.renderizarBannerPasta();
    }

    root.querySelector('#athDashScrim')?.addEventListener('click', () => this.fecharDrawerPastas());
    root.querySelector('#athBtnFecharPastasDrawer')?.addEventListener('click', () => this.fecharDrawerPastas());
    root.querySelector('#athDashAlcaPastas')?.addEventListener('click', () => this.alternarDrawerPastas());

    root.querySelector('#athBtnNovaSubpastaModal')?.addEventListener('click', () => {
      this.abrirModalNovaSubpasta();
    });

    root.querySelector('#athBtnVincularPastaModal')?.addEventListener('click', () => {
      this.abrirModalVincularPasta();
    });

    root.querySelector('#athDriveStatus')?.addEventListener('click', () => this.conectarDrive());
    this.atualizarStatusDrive();
    root.querySelector('#athBtnRecarregarPastasDrive')?.addEventListener('click', async () => {
      const btn = root.querySelector('#athBtnRecarregarPastasDrive');
      if (btn) btn.textContent = '...';
      await this.sincronizarComDrive({ aviso: true });
      this.pastasDrive = obterPastasDriveLocais();
      if (btn) btn.textContent = '✓';
      setTimeout(() => { if (btn) btn.textContent = '↻'; }, 900);
      this.renderizarPastasLateral();
      this.renderizarBannerPasta();
      this.atualizarGrid();
    });

    if (this.abaAtiva === 'escrita' && !estudioFullInicial) {
      this.atualizarGrid();
    } else {
      const boxEstudo = root.querySelector('#athContainerEstudoArtigos');
      if (boxEstudo) {
        boxEstudo.style.display = 'flex';
        boxEstudo.style.flexDirection = 'column';
        boxEstudo.style.flex = '1 1 auto';
        boxEstudo.style.height = '100%';
        boxEstudo.style.minHeight = '100%';
      }
      this.estudoView = new EstudoArtigosView(boxEstudo, {
        pastaFiltroId: this.pastaAtivaId,
        artigoInicialId: this.artigoInicialId,
        // coleções do Zotero chegaram como pastas: atualiza a lateral e espelha a estrutura no Drive
        aoMudarPastas: ({ pastasNovas = 0 } = {}) => {
          this.pastasDrive = obterPastasDriveLocais();
          this.renderizarPastasLateral();
          this.renderizarBannerPasta();
          if (pastasNovas) this.sincronizarComDrive({ aviso: false, docs: false }).then(() => { this.pastasDrive = obterPastasDriveLocais(); this.renderizarPastasLateral(); }).catch(() => {});
        }
      });
    }
  }

  abrirAbaArtigosZoteroComArtigo(art) {
    if (!art) return;
    this.abaAtiva = 'artigos_zotero'; try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('athenes_dash_aba', 'artigos_zotero'); } catch (_) {}
    this.renderizar();
    if (this.estudoView && typeof this.estudoView.abrirArtigoCompartilhadoRecebido === 'function') {
      this.estudoView.abrirArtigoCompartilhadoRecebido(art);
    }
  }

  abrirModalLogin() {
    this.abrirModalIdentificacaoLogin();
  }

  selecionarPasta(pastaId) {
    this.pastaAtivaId = pastaId; try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('athenes_dash_pasta', String(pastaId || 'todas')); } catch (_) {}
    this.fecharDrawerPastas?.();
    this.renderizarPastasLateral();
    this.renderizarBannerPasta();
    if (this.abaAtiva === 'escrita') {
      this.atualizarGrid();
    } else {
      if (this.estudoView && typeof this.estudoView.filtrarPorPasta === 'function') {
        this.estudoView.filtrarPorPasta(pastaId);
      }
    }
  }

  /**
   * Versões antigas guardavam os documentos no navegador. Quando todos estão a salvo no Drive, essa cópia é apagada;
   * enquanto houver algum que não esteja, ela fica (nada se perde) e a pessoa é avisada.
   */
  limparCopiaDoNavegador() {
    if (!repositorio.legadoPendente()) return;
    const pastas = obterPastasDriveLocais();
    const apagou = repositorio.removerLegadoSeSeguro(d => d.proprietarioExterno || d.compartilhadoComigo || (d.driveFileId && !precisaEnviarAoDrive(d, pastas)));
    if (apagou) mostrarAviso('Seus documentos já estão no Google Drive e no servidor: a cópia que ficava neste navegador foi apagada.', { tipo: 'info' });
    else if (!this._avisouCopiaNavegador) { this._avisouCopiaNavegador = true; mostrarAviso('Alguns documentos ainda estão guardados só neste navegador. Conecte o Google Drive e clique em Sincronizar para movê-los; a cópia só é apagada depois que todos estiverem a salvo.', { tipo: 'info' }); }
  }

  /** Pastas-base do app e pastas compartilhadas não são excluídas por aqui. */
  pastaPodeSerExcluida(pasta) {
    return Boolean(pasta) && pasta.origem !== 'compartilhada' && !['pasta_rel_raiz', 'pasta_bib_raiz'].includes(pasta.id);
  }

  /**
   * Exclui a pasta (e as subpastas): documentos de dentro vão para a pasta de cima, nada é apagado. O servidor passa a saber,
   * então ela some em todos os computadores; a pasta do Drive vai para a lixeira quando estiver vazia.
   */
  async excluirPasta(pasta) {
    const caminho = caminhoDaPasta(this.pastasDrive, pasta.id);
    const pai = caminho.length > 1 ? caminho[caminho.length - 2] : null;
    const todas = [];
    const coletar = (p) => { todas.push(p); (p.subpastas || []).forEach(coletar); };
    coletar(pasta);
    const ids = new Set(todas.map(p => p.id));
    const afetados = this.documentos.filter(d => ids.has(d.pastaId));
    const ok = await this.arquivos.confirmar({
      titulo: `Excluir a pasta "${pasta.nome}"?`,
      texto: `${afetados.length ? `${afetados.length} documento(s) dentro dela irão para ${pai ? `a pasta "${pai.nome}"` : 'a pasta principal'}. ` : ''}Nenhum documento é apagado. A pasta também sai dos outros computadores e, no Google Drive, vai para a lixeira quando estiver vazia.`,
      ok: 'Excluir pasta'
    });
    if (!ok) return;
    const destino = pai ? pai.id : undefined;
    for (const d of afetados) d.pastaId = destino;
    const remover = (lista) => lista.filter(p => { if (p.id === pasta.id) return false; p.subpastas = remover(p.subpastas || []); return true; });
    salvarPastasDriveLocais(remover(obterPastasDriveLocais()));
    registrarPastasExcluidas(todas);
    this.pastasDrive = obterPastasDriveLocais();
    if (ids.has(this.pastaAtivaId)) this.pastaAtivaId = pai ? pai.id : 'todas';
    this.salvarDocumentosLocais();
    this.renderizarPastasLateral(); this.renderizarBannerPasta(); this.atualizarGrid();
    this.agendarPerfil(200);
    try { const t = driveConectado() ? await obterTokenDrive() : null; if (t) await this.sincronizarComDrive({ aviso: false }); if (t) await processarPastasExcluidas(t); } catch (e) { console.warn('[Athenes] Pasta no Drive:', e.message); }
  }

  /** Indicador na barra lateral: conectado (com a última sincronização), conexão vencida ou desconectado; clicar conecta/renova. */
  atualizarStatusDrive() {
    const el = this.container.querySelector('#athDriveStatus');
    if (!el) return;
    const cfg = obterConfigGoogleDrive();
    let cor = '#64748B', fundo = '#F1F5F9', texto;
    if (cfg.accessToken && tokenDriveValido(cfg)) {
      const quando = cfg.ultimaSincronizacao ? new Date(cfg.ultimaSincronizacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'ainda não sincronizado';
      cor = '#166534'; fundo = '#DCFCE7'; texto = `● Drive conectado · ${quando}`;
    } else if (cfg.accessToken || cfg.accessTokenExpiraEm) {
      cor = '#92400E'; fundo = '#FEF3C7'; texto = '● Conexão vencida — clique para renovar';
    } else {
      texto = '○ Drive desconectado — clique para conectar';
    }
    el.textContent = texto;
    el.style.color = cor;
    el.style.background = fundo;
  }

  /** Conecta (ou renova) o Drive com um clique e já sincroniza pastas e documentos. */
  async conectarDrive() {
    const btn = this.container.querySelector('#athDriveStatus');
    if (btn) btn.textContent = '… conectando';
    try {
      const cfg = obterConfigGoogleDrive();
      const token = (await obterTokenDrive()) || await autenticarGoogleDrive(cfg.clientId);
      if (token) await this.sincronizarComDrive({ aviso: true });
    } catch (err) {
      mostrarAviso(`Não foi possível conectar ao Google Drive: ${err.message}`);
    }
    this.atualizarStatusDrive();
  }

  /**
   * Cria no Google Drive as pastas que só existem aqui e envia os documentos pendentes (cada um na pasta dele).
   * `aviso` mostra o resultado mesmo quando deu certo; erros sempre aparecem.
   */
  async sincronizarComDrive({ aviso = true, docs = true } = {}) {
    if (!driveConectado()) {
      if (aviso) mostrarAviso('Conecte o Google Drive para criar as pastas e enviar os documentos (menu da nuvem no editor ou tela de login).', { tipo: 'info' });
      return null;
    }
    const token = await obterTokenDrive(); // renova em silêncio se o token venceu
    if (!token) {
      this.atualizarStatusDrive();
      if (aviso) mostrarAviso('A conexão com o Google Drive venceu. Clique em "Conectar Drive" na barra lateral para renová-la.', { tipo: 'info' });
      return null;
    }
    const pastas = obterPastasDriveLocais();
    const rp = await sincronizarPastasComDrive(token, { pastas });
    const rd = docs && !rp.sessaoExpirada ? await sincronizarDocumentosComDrive(this.documentos, token, { pastas }) : { enviados: 0, erros: [], sessaoExpirada: false };
    this.salvarDocumentosLocais();
    if (!rp.sessaoExpirada && !rd.sessaoExpirada) salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), ultimaSincronizacao: new Date().toISOString() });
    this.atualizarStatusDrive();
    if (rp.sessaoExpirada || rd.sessaoExpirada) {
      marcarSessaoDriveExpirada();
      mostrarAviso('A sessão do Google Drive expirou. Reconecte o Drive e tente de novo.');
    } else if (rp.erros.length || rd.erros.length) {
      const primeiro = rp.erros[0] ? `${rp.erros[0].pasta}: ${rp.erros[0].erro}` : `${rd.erros[0].documento}: ${rd.erros[0].erro}`;
      mostrarAviso(`Drive: ${rp.criadas} pasta(s) criada(s), ${rd.enviados} documento(s) enviado(s), ${rp.erros.length + rd.erros.length} falha(s). ${primeiro}`);
    } else if (aviso) {
      mostrarAviso(`Drive sincronizado: ${rp.criadas} pasta(s) criada(s), ${rd.enviados} documento(s) enviado(s).`, { tipo: 'info' });
    }
    return { rp, rd };
  }

  /** Pasta do documento nesta árvore; se o id vem de outro computador (não existe aqui), vale a pasta padrão, para os totais fecharem. */
  pastaEfetivaDoDoc(d) {
    if (d.compartilhadoComigo) return 'compartilhados_comigo';
    if (d.pastaId && buscarPastaNaArvore(this.pastasDrive, d.pastaId)) return d.pastaId;
    return d.tipoDoc === 'artigo' || d.tipoDoc === 'relatorio' ? 'pasta_rel_raiz' : 'pasta_bib_raiz';
  }

  atualizarGrid() {
    const gridEl = this.container.querySelector('#athDocsGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const filtrados = this.documentos.filter(doc => {
      const matchTipo = this.filtroTipo === 'todos' || doc.tipoDoc === this.filtroTipo;
      const str = `${doc.titulo} ${doc.subtitulo} ${doc.metadados?.autores?.map(a => a.nome).join(' ')}`.toLowerCase();
      const matchBusca = !this.filtroBusca || str.includes(this.filtroBusca);

      let matchPasta = true;
      if (this.pastaAtivaId && this.pastaAtivaId !== 'todas') {
        const docPastaId = this.pastaEfetivaDoDoc(doc);
        matchPasta = (docPastaId === this.pastaAtivaId);
      }

      return matchTipo && matchBusca && matchPasta;
    });

    filtrados.sort((a, b) => {
      if (this.ordemDocumentos === 'titulo_asc') {
        return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR');
      }
      if (this.ordemDocumentos === 'titulo_desc') {
        return (b.titulo || '').localeCompare(a.titulo || '', 'pt-BR');
      }
      const ta = new Date(a.dataModificacao || a.atualizado_em || a.dataCriacao || 0).getTime();
      const tb = new Date(b.dataModificacao || b.atualizado_em || b.dataCriacao || 0).getTime();
      if (this.ordemDocumentos === 'recente_asc') {
        return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
      }
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
    });

    if (filtrados.length === 0) {
      const pastaInfo = (this.pastaAtivaId && this.pastaAtivaId !== 'todas')
        ? buscarPastaNaArvore(this.pastasDrive, this.pastaAtivaId)
        : null;
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--ath-muted);">
          <p style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">
            ${pastaInfo ? `Nenhum documento na pasta "${pastaInfo.nome}"` : 'Nenhum documento encontrado'}
          </p>
          <p style="font-size: 13px; margin: 0;">
            ${pastaInfo ? 'Clique em "+ Novo Documento" acima para criar um documento diretamente aqui.' : 'Clique em "+ Novo Documento" para iniciar um artigo ou relatório.'}
          </p>
        </div>
      `;
      return;
    }

    const ordemIds = filtrados.map(d => d.id);
    for (const doc of filtrados) {
      const card = document.createElement('div');
      card.className = 'ath-doc-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Ver caderno de ${doc.titulo || 'documento'}`);

      const dataFormatada = new Date(doc.dataModificacao || doc.dataCriacao || Date.now()).toLocaleDateString('pt-BR');
      const autorPrincipal = doc.metadados?.autores?.[0]?.nome || this.perfilUsuario?.nome || 'Autor Principal';

      const statusMap = {
        rascunho: { rotulo: 'Rascunho', classe: 'ath-badge-warn' },
        em_revisao: { rotulo: 'Em Revisão', classe: 'ath-badge-info' },
        finalizado: { rotulo: 'Finalizado', classe: 'ath-badge-ok' }
      };
      const st = statusMap[doc.estado] || statusMap.rascunho;

      card.innerHTML = `
        <div class="ath-doc-card-header">
          <span class="ath-badge ath-badge-primary">${escapeHtml(doc.tipoDoc?.toUpperCase() || 'DOCUMENTO')}</span>
          <span class="ath-badge ${st.classe}">${st.rotulo}</span>
          ${doc.salvoNuvem ? `<span class="ath-badge" style="background:#EEF4FA; color:#314F79; font-weight:700; border:1px solid #C8D7E6; display:inline-flex; align-items:center; gap:4px;">${svgIcone('nuvem_ok', 11)} NUVEM</span>` : ''}
        </div>

        <div class="ath-doc-card-capa-preview">
          <span class="ath-doc-card-capa-marca">ATHENES · ${escapeHtml(doc.metadados?.ano || '')}</span>
          <h3 class="ath-doc-card-titulo">${escapeHtml(doc.titulo || 'Documento sem título')}</h3>
          ${doc.subtitulo ? `<p class="ath-doc-card-subtitulo">${escapeHtml(doc.subtitulo)}</p>` : ''}
          <span class="ath-doc-card-capa-autor">${escapeHtml(autorPrincipal)}</span>
        </div>

        <div class="ath-doc-card-meta">
          <span>Modificado em ${dataFormatada}</span>
          <div class="ath-doc-card-actions">
            <button type="button" class="ath-btn ath-btn-sm ath-btn-excluir" title="Excluir">${svgIcone('lixeira', 12)}</button>
          </div>
        </div>
      `;

      card.addEventListener('click', async (ev) => {
        if (this.arquivos.aoClicarCard(ev, doc)) return; // seleção (Ctrl/Shift/checkbox) e menu "···"
        if (ev.target.closest('.ath-btn-excluir')) {
          ev.stopPropagation();
          await this.arquivos.excluir([doc]); // mesmo caminho do menu: confirma, remove, e o documento não volta ao sincronizar
          return;
        }
        await this.abrirCadernoDocumento(doc, card);
      });

      card.addEventListener('keydown', ev => {
        if (ev.target !== card || (ev.key !== 'Enter' && ev.key !== ' ')) return;
        ev.preventDefault();
        this.abrirCadernoDocumento(doc, card);
      });

      this.arquivos.decorarCard(card, doc, ordemIds);
      gridEl.appendChild(card);
    }
  }

  abrirModalNovoDoc(opcoes = {}) {
    const pastaAlvoId = (opcoes.pastaId && opcoes.pastaId !== 'todas')
      ? opcoes.pastaId
      : (this.pastaAtivaId !== 'todas' ? this.pastaAtivaId : 'pasta_rel_raiz');
    const pastas = [];
    const coletar = (lista, prefixo = '') => {
      for (const p of lista) {
        if (p.tipo === 'relatorios' || p.id === 'pasta_rel_raiz' || p.tipo === 'compartilhada') {
          pastas.push({ id: p.id, nome: `${prefixo}${p.nome}` });
          if (p.subpastas?.length) coletar(p.subpastas, `${prefixo}  ↳ `);
        }
      }
    };
    coletar(this.pastasDrive);
    if (!pastas.length) pastas.push({ id: 'pasta_rel_raiz', nome: 'Relatórios & Artigos' });

    abrirNovoDocumentoModal({
      pastas, pastaAlvoId,
      onCriar: ({ doc: novo, pastaId }) => this.registrarNovoDocumento(novo, pastaId)
    });
  }

  /** Guarda o documento novo (autor, pasta, lista local), atualiza a tela, abre no editor e sobe ao Drive se conectado. */
  registrarNovoDocumento(novo, pastaEscolhida) {
    if (this.perfilUsuario?.nome && novo.metadados?.autores?.[0] && novo.metadados.autores[0].nome === 'Autor Principal') {
      novo.metadados.autores[0].nome = this.perfilUsuario.nome;
    }
    novo.pastaId = pastaEscolhida;
    novo.proprietario = novo.proprietario || { id: this.perfilUsuario?.id, nome: this.perfilUsuario?.nome };
    this.documentos.unshift(novo);
    this.salvarDocumentosLocais();
    if (this.pastaAtivaId !== 'todas' && this.pastaAtivaId !== pastaEscolhida) {
      this.selecionarPasta(pastaEscolhida);
    } else {
      this.renderizarPastasLateral();
      this.renderizarBannerPasta();
      this.atualizarGrid();
    }
    this.onAbrirDocumento(novo);
    this.sincronizarComDrive({ aviso: false }); // sobe a pasta (se nova) e o documento, sem bloquear a abertura
  }

  importarDocumentoJson(arquivo) {
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json && (Array.isArray(json.paginas) || Array.isArray(json.secoes))) {
          json.proprietario = { id: this.perfilUsuario?.id, nome: this.perfilUsuario?.nome }; // importar = arquivo novo, do usuário
          this.documentos.unshift(json);
          this.salvarDocumentosLocais();
          this.atualizarGrid();
          this.onAbrirDocumento(json);
        } else {
          alert('Arquivo inválido: o formato Athenes esperado não foi reconhecido.');
        }
      } catch (err) {
        alert(`Erro ao ler arquivo JSON: ${err.message}`);
      }
    };
    reader.readAsText(arquivo);
  }

  /**
   * Biblioteca na nuvem = o Google Drive de QUEM ESTÁ CONECTADO (nunca a lista global do servidor): traz só o índice
   * (nome e data) dos documentos que o app criou lá; o conteúdo é baixado ao abrir. Sem Drive conectado, nada é listado.
   * (O nome do método é antigo: antes listava o Supabase, que mostrava os mesmos arquivos para todas as contas.)
   */
  /** Agenda o envio do estado local ao servidor (junta várias alterações seguidas). */
  agendarPerfil(atrasoMs = 1500) {
    clearTimeout(this._tPerfil);
    this._tPerfil = setTimeout(() => this.sincronizarPerfilServidor(), atrasoMs);
  }

  /**
   * Depois de excluir da lista: lembra a exclusão (a sincronização não traz de volta), leva o arquivo do Drive para a lixeira
   * (recuperável) e apaga a cópia da nuvem. Documentos de outras pessoas só somem da MINHA lista.
   */
  async aposExcluir(docs) {
    registrarExclusoes(docs);
    this.agendarPerfil(200); // o servidor passa a saber da exclusão já: os outros computadores deixam de mostrar o documento
    try {
      const token = driveConectado() ? await obterTokenDrive() : null;
      if (token) await processarExclusoesPendentes(token);
    } catch (e) { console.warn('[Athenes] Lixeira do Drive:', e.message); }
    for (const d of docs) if (d.salvoNuvem && !d.proprietarioExterno && !d.compartilhadoComigo) await excluirDocumentoDoSupabase(d.id);
  }

  /** Documentos que outras pessoas compartilharam com o meu e-mail (o banco só devolve os que posso ver); não depende do Drive. */
  async sincronizarCompartilhados() {
    let novos = 0;
    const conta = obterContaAtiva();
    try {
      const compartilhados = await listarCompartilhadosComigo();
      if (obterContaAtiva() !== conta) return;
      const documentosRecebidos = compartilhados.filter(c => c.norma !== 'zotero_pdf');
      const ids = new Set(documentosRecebidos.map(c => String(c.id)));
      const excluidos = idsExcluidos();
      for (const c of documentosRecebidos) {
        if (excluidos.has(String(c.id))) continue;
        const existente = this.documentos.find(d => String(d.id) === String(c.id));
        const marca = { compartilhadoComigo: true, proprietarioExterno: true, permissao: c.papel, salvoNuvem: true, proprietario: { id: `ext_${c.user_id}`, nome: c.dono || 'Outra pessoa' } };
        if (!existente) {
          const papelTxt = c.papel === 'edicao' ? 'edição' : c.papel === 'comentario' ? 'comentário' : 'leitura';
          this.documentos.unshift({ id: c.id, titulo: c.titulo || 'Documento compartilhado', subtitulo: `De ${c.dono || 'outra pessoa'} · ${papelTxt}`, tipoDoc: 'artigo', perfilId: c.norma || 'abnt', dataModificacao: c.atualizado_em, precisaCarregarConteudo: true, ...marca });
          novos++;
        } else if (existente.compartilhadoComigo) {
          Object.assign(existente, marca);
          if (c.atualizado_em && (!existente.dataModificacao || new Date(c.atualizado_em) > new Date(existente.dataModificacao))) { existente.precisaCarregarConteudo = true; existente.dataModificacao = c.atualizado_em; }
        }
      }
      // acesso retirado pelo dono: o documento some da lista
      const antes = this.documentos.length;
      this.documentos = this.documentos.filter(d => !d.compartilhadoComigo || (ids.has(String(d.id)) && !excluidos.has(String(d.id))));
      if (this.documentos.length !== antes || novos) { this.salvarDocumentosLocais(); this.atualizarGrid(); this.renderizarPastasLateral(); }
      if (this.estudoView?.container?.isConnected) await this.estudoView.carregarCompartilhados();
    } catch (e) { console.warn('[Athenes] Compartilhados comigo:', e.message); }
    return novos;
  }

  exportarBackupEspaco() {
    let artigosEstudo = [];
    let zoteroCfg = {};
    let perfil = {};
    try {
      artigosEstudo = carregarArtigosEstudo().map(({ pdfBlobUrl, ...resto }) => resto);
      zoteroCfg = JSON.parse(lerConta('athenes_zotero_cfg') || '{}');
      perfil = JSON.parse(localStorage.getItem('athenes_perfil_colaborador') || '{}');
    } catch (_) {}

    const dados = {
      tipo: 'athenes_workspace_backup',
      versao: '1.0',
      dataExportacao: new Date().toISOString(),
      perfil,
      zoteroCfg,
      documentos: this.documentos,
      artigosEstudo
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nomeLimpo = (perfil.nome || 'usuario').toLowerCase().replace(/\s+/g, '_');
    a.download = `athenes_backup_${nomeLimpo}_${new Date().toISOString().slice(0, 10)}.athenes-workspace`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

}

Object.assign(DashboardView.prototype, metodosDashboardModais, metodosDashboardPastas, metodosDashboardSincronia);
