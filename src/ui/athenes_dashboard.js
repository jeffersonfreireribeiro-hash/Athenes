// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Área Inicial / Dashboard Dividida em Duas Páginas:
 * 1. Página de Escrita & Documentos (Artigos, Relatórios, Teses em blocos)
 * 2. Página de Leitura & Fichamento de Artigos (Vínculo Zotero + Leitor/Riscador de PDF estilo Samsung Notes + Google Drive)
 * Inclui barra superior de Identificação / Login do Usuário sincronizada com Supabase e Google Drive.
 */

import { TIPOS_DOCUMENTO, criarDocumento } from '../core/athenes_documento.js';
import { PERFIS_FORMATACAO } from '../core/athenes_estilos.js';
import {
  obterPerfilColaborador,
  salvarPerfilColaborador,
  encerrarSessao,
  CORES_COLABORADORES,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive,
  listarDocumentosDoSupabase,
  carregarDocumentoDoSupabase,
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
import { EstudoArtigosView } from './athenes_estudo_artigos.js';
import { svgIcone, svgLogo } from './athenes_icones.js';

export class DashboardView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.documentos = [];
    this.onAbrirDocumento = opcoes.onAbrirDocumento || (() => {});
    this.onCriarDocumento = opcoes.onCriarDocumento || (() => {});
    this.onLogout = opcoes.onLogout || (() => {});
    this.filtroBusca = '';
    this.filtroTipo = 'todos';
    this.abaAtiva = opcoes.abaInicial || 'escrita'; // 'escrita' | 'artigos_zotero'
    this.pastaAtivaId = opcoes.pastaInicialId || 'todas';
    this.pastasDrive = obterPastasDriveLocais();
    this.perfilUsuario = obterPerfilColaborador();
    this.estudoView = null;

    this.carregarDocumentosLocais();
    this.renderizar();
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      setTimeout(() => this.sincronizarComSupabase(true), 1200);
    }
  }

  carregarDocumentosLocais() {
    try {
      const salvo = localStorage.getItem('athenes_docs_indice');
      if (salvo) {
        this.documentos = JSON.parse(salvo);
      }
    } catch (_) {
      this.documentos = [];
    }

    if (!this.documentos || this.documentos.length === 0) {
      const docExemplo1 = criarDocumento({
        titulo: 'Análise Espacial e Diretrizes de Reurbanização Sustentável',
        subtitulo: 'Estudo de caso e proposições metodológicas para comunidades consolidadas',
        perfilId: 'abnt',
        tipoDoc: 'artigo'
      });
      docExemplo1.estado = 'em_revisao';
      docExemplo1.pastaId = 'pasta_rel_raiz';

      const docExemplo2 = criarDocumento({
        titulo: 'Relatório Técnico de Diagnóstico Urbanístico e Infraestrutura',
        subtitulo: 'Levantamento de campo, consolidação de parcelas e equipamentos públicos',
        perfilId: 'abnt',
        tipoDoc: 'relatorio'
      });
      docExemplo2.estado = 'rascunho';
      docExemplo2.pastaId = 'pasta_rel_raiz';

      this.documentos = [docExemplo1, docExemplo2];
      this.salvarDocumentosLocais();
    }
  }

  salvarDocumentosLocais() {
    try {
      localStorage.setItem('athenes_docs_indice', JSON.stringify(this.documentos));
    } catch (_) {}
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
    if (!this.container) return;
    this.container.innerHTML = '';
    this.perfilUsuario = obterPerfilColaborador();
    const driveCfg = obterConfigGoogleDrive();

    const root = document.createElement('div');
    root.className = 'ath-dashboard';

    const iniciais = this.obterIniciais(this.perfilUsuario.nome);
    const papelTxt = this.rotuloPapel(this.perfilUsuario.papel);
    const instituicaoTxt = this.perfilUsuario.instituicao || 'Universidade / Grupo de Pesquisa';

    root.innerHTML = `
      <!-- Barra Superior de Marca + Seletor de Páginas (Escrita vs Artigos Zotero/PDF) + Identificação/Login -->
      <div class="ath-dash-topbar">
        <div class="ath-dash-brand">
          ${svgLogo(28)}
          <div>
            <span class="ath-dash-brand-nome">ATHENES</span>
            <small class="ath-dash-brand-sub">Plataforma Acadêmica Colaborativa</small>
          </div>
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
          ${driveCfg.pastaUrl ? `
            <a href="${driveCfg.pastaUrl}" target="_blank" rel="noopener noreferrer" class="ath-btn ath-btn-sm" style="height:32px; font-size:11.5px; display:inline-flex; align-items:center; gap:6px; font-weight:700; color:#314F79; background:#fff; border:1px solid #C8D7E6;" title="Abrir sua pasta de PDFs e artigos no Google Drive Web">
              ${svgIcone('drive', 14)} Pasta Drive ↗
            </a>
          ` : ''}
          <button type="button" class="ath-dash-user-pill" id="athBtnPerfilLoginDash" title="Clique para identificar quem está usando, trocar perfil ou conectar Google Drive e Zotero">
            ${this.perfilUsuario.autenticadoGoogle && this.perfilUsuario.foto 
              ? `<img src="${this.perfilUsuario.foto}" class="ath-dash-user-avatar" style="object-fit:cover; border:1px solid #CBD5E1;" alt="Avatar">`
              : `<span class="ath-dash-user-avatar" style="background:${this.perfilUsuario.cor || '#314F79'};">${iniciais}</span>`}
            <span class="ath-dash-user-info">
              <strong>${this.perfilUsuario.nome || 'Autor Principal'}</strong>
              <small>${papelTxt} · ${instituicaoTxt}</small>
            </span>
            <span class="ath-dash-user-edit">${svgIcone('lapis', 12)}</span>
          </button>
          <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnLogoutDash" title="Encerrar sessão e mudar de conta" style="height:32px; padding:0 10px; font-size:11.5px; font-weight:750; color:#DC2626; display:inline-flex; align-items:center; gap:4px; border:1px solid #FECACA; background:#FEF2F2;">
            Sair
          </button>
        </div>
      </div>

      <!-- Layout Principal com Barra Lateral de Pastas do Google Drive e Conteúdo Filtrado -->
      <div class="ath-dash-layout">
        <!-- Barra Lateral de Pastas do Google Drive -->
        <aside class="ath-dash-sidebar" id="athDashSidebar" aria-label="Pastas do Google Drive">
          <div class="ath-dash-sidebar-head">
            <div style="display:flex; align-items:center; gap:6px;">
              ${svgIcone('drive', 16)}
              <strong style="font-size:12px; color:#314F79; letter-spacing:0.03em; text-transform:uppercase;">Pastas do Drive</strong>
            </div>
            <button type="button" class="ath-btn ath-btn-xs" id="athBtnRecarregarPastasDrive" title="Recarregar árvore de pastas do Drive" style="padding:2px 7px; height:24px; font-size:11px;">
              ↻
            </button>
          </div>

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
            <!-- Preenchido por this.renderizarBannerPasta() -->
          </div>

          <!-- Conteúdo da Aba 1: Escrita & Documentos -->
          <section id="athSecaoDashEscrita" ${this.abaAtiva === 'escrita' ? '' : 'hidden'}>
            <header class="ath-dash-head">
              <div class="ath-dash-titulo">
                <h1>Meus Documentos e Artigos</h1>
                <p>Ambiente de escrita e diagramação acadêmica em blocos com revisão estilo Google Docs e sincronia em tempo real.</p>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="ath-btn" id="athBtnSincronizarNuvem" title="Sincronizar e baixar documentos salvos na nuvem Supabase" style="font-weight:700;">
                  ${svgIcone('nuvem', 14)} Sincronizar Nuvem
                </button>
                <button type="button" class="ath-btn" id="athBtnBackupEspaco" title="Exportar ou restaurar backup completo do seu perfil, artigos e documentos para Google Drive">
                  ${svgIcone('config', 14)} Backup / Drive
                </button>
                <label class="ath-btn" style="cursor:pointer;" title="Importar arquivo .athenes ou .json">
                  ${svgIcone('mais', 14)} Importar JSON
                  <input type="file" accept=".json,.athenes" id="athInputImportarJson" style="display:none;">
                </label>
                <button type="button" class="ath-btn ath-btn-primary" id="athBtnNovoDocModal">
                  ${svgIcone('mais', 14)} Novo Documento
                </button>
              </div>
            </header>

            <div class="ath-dash-filtros">
              <div class="ath-busca-box">
                ${svgIcone('busca', 16)}
                <input type="text" class="ath-input" id="athDashBusca" placeholder="Pesquisar por título, autor ou palavra-chave...">
              </div>

              <select class="ath-select" style="max-width:200px;" id="athDashFiltroTipo">
                <option value="todos">Todos os tipos</option>
                ${TIPOS_DOCUMENTO.map(t => `<option value="${t.id}">${t.rotulo}</option>`).join('')}
              </select>
            </div>

            <div class="ath-docs-grid" id="athDocsGrid">
              <!-- Cards dos documentos -->
            </div>
          </section>

          <!-- Conteúdo da Aba 2: Leitura de Artigos, Anotador de PDF (estilo Samsung Notes) & Zotero + Drive -->
          <section id="athSecaoDashArtigosZotero" ${this.abaAtiva === 'artigos_zotero' ? '' : 'hidden'}>
            <header class="ath-dash-head ath-dash-head-zotero" style="margin-bottom:18px;">
              <div class="ath-dash-titulo">
                <h1>Estúdio de Artigos, Leitura de PDF & Fichamento Zotero</h1>
                <p>Leia os PDFs direto do seu Google Drive em Tela Cheia, risque à mão livre estilo Samsung Notes, marque citações e sincronize notas com o Zotero.</p>
              </div>
              <div id="athHeaderAcoesZotero" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"></div>
            </header>
            <div id="athContainerEstudoArtigos"></div>
          </section>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-aba-dash]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaAtiva = btn.dataset.abaDash;
        this.renderizar();
      });
    });

    root.querySelector('#athBtnPerfilLoginDash')?.addEventListener('click', () => {
      this.abrirModalIdentificacaoLogin();
    });

    root.querySelector('#athBtnLogoutDash')?.addEventListener('click', () => {
      encerrarSessao();
      this.onLogout();
    });

    root.querySelector('#athBtnNovoDocModal').addEventListener('click', () => this.abrirModalNovoDoc());

    const inputBusca = root.querySelector('#athDashBusca');
    inputBusca.addEventListener('input', () => {
      this.filtroBusca = inputBusca.value.trim().toLowerCase();
      this.atualizarGrid();
    });

    const selectTipo = root.querySelector('#athDashFiltroTipo');
    selectTipo.addEventListener('change', () => {
      this.filtroTipo = selectTipo.value;
      this.atualizarGrid();
    });

    const inputImportar = root.querySelector('#athInputImportarJson');
    inputImportar.addEventListener('change', e => this.importarDocumentoJson(e.target.files[0]));

    root.querySelector('#athBtnSincronizarNuvem')?.addEventListener('click', () => {
      this.sincronizarComSupabase(false);
    });

    root.querySelector('#athBtnBackupEspaco')?.addEventListener('click', () => {
      this.abrirModalBackupEspaco();
    });

    this.container.appendChild(root);

    // Inicialização da barra lateral de pastas do Google Drive
    this.renderizarPastasLateral();
    this.renderizarBannerPasta();

    root.querySelector('#athBtnNovaSubpastaModal')?.addEventListener('click', () => {
      this.abrirModalNovaSubpasta();
    });

    root.querySelector('#athBtnVincularPastaModal')?.addEventListener('click', () => {
      this.abrirModalVincularPasta();
    });

    root.querySelector('#athBtnRecarregarPastasDrive')?.addEventListener('click', async () => {
      const driveCfg = obterConfigGoogleDrive();
      const btn = root.querySelector('#athBtnRecarregarPastasDrive');
      if (btn) btn.textContent = '...';
      if (driveCfg.accessToken) {
        try {
          await obterOuCriarEstruturaPastasAthenes(driveCfg.accessToken);
        } catch (_) {}
      }
      this.pastasDrive = obterPastasDriveLocais();
      if (btn) btn.textContent = '✓';
      setTimeout(() => { if (btn) btn.textContent = '↻'; }, 900);
      this.renderizarPastasLateral();
      this.renderizarBannerPasta();
      this.atualizarGrid();
    });

    if (this.abaAtiva === 'escrita') {
      this.atualizarGrid();
    } else {
      const boxEstudo = root.querySelector('#athContainerEstudoArtigos');
      this.estudoView = new EstudoArtigosView(boxEstudo);
    }
  }

  abrirModalLogin() {
    this.abrirModalIdentificacaoLogin();
  }

  abrirModalIdentificacaoLogin() {
    const p = obterPerfilColaborador();
    const driveCfg = obterConfigGoogleDrive();
    let zoteroUserId = '';
    let zoteroApiKey = '';
    try {
      const z = JSON.parse(localStorage.getItem('athenes_zotero_cfg') || '{}');
      zoteroUserId = z.userId || '';
      zoteroApiKey = z.apiKey || '';
    } catch (_) {}

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:540px;">
        <div class="ath-modal-head">
          <h2>Identificação do Usuário & Contas Conectadas</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalLoginFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:12.5px; color:var(--ath-text-secondary); margin-top:0; margin-bottom:12px;">
            Defina quem está editando ou revisando neste dispositivo. Seu nome e cor aparecerão nos cursores em tempo real, nos balões de sugestão e nos fichamentos de PDF.
          </p>

          <!-- Login Oficial com Conta Google / Gmail -->
          ${p.autenticadoGoogle ? `
            <div class="ath-google-user-badge" style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; background:#F0FDF4; border:1px solid #BBF7D0; margin-bottom:14px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="${p.foto || 'https://lh3.googleusercontent.com/avatar_exemplo.png'}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid #86EFAC;" alt="Foto">
                <div>
                  <strong style="display:block; font-size:12.5px; color:#166534;">${p.nome}</strong>
                  <span style="font-size:11px; color:#15803D;">${p.email} · Conta Google Conectada</span>
                </div>
              </div>
              <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnModalDesconectarGoogle" style="font-size:11px; padding:3px 10px; color:#DC2626; font-weight:750; border:1px solid #FCA5A5; background:#FFF1F2; cursor:pointer;" title="Desconectar e voltar ao login">Desconectar / Sair</button>
            </div>
          ` : `
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnModalLoginGoogle" style="width:100%; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700; margin-bottom:14px; background:#FFFFFF; color:#1F2937; border:1px solid #CBD5E1; box-shadow:0 1px 3px rgba(0,0,0,0.08); font-size:12.5px; border-radius:8px; cursor:pointer;">
              ${svgIcone('google', 16)} Entrar com a Conta Google (Gmail)
            </button>
          `}

          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Seu Nome / Identificação</label>
              <input type="text" class="ath-input" id="athLoginNome" value="${p.nome || 'Autor Principal'}" placeholder="Ex.: Prof. Dr. Carlos Eduardo">
            </div>
            <div class="ath-prop-grupo">
              <label>Papel no Trabalho</label>
              <select class="ath-select" id="athLoginPapel">
                <option value="autor" ${p.papel === 'autor' ? 'selected' : ''}>Autor Principal</option>
                <option value="orientador" ${p.papel === 'orientador' ? 'selected' : ''}>Prof. Orientador / Revisor</option>
                <option value="revisor" ${p.papel === 'revisor' ? 'selected' : ''}>Pesquisador / Coautor</option>
              </select>
            </div>
          </div>

          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Instituição / Laboratório</label>
              <input type="text" class="ath-input" id="athLoginInstituicao" value="${p.instituicao || ''}" placeholder="Ex.: USP / Laboratório de Urbanismo">
            </div>
            <div class="ath-prop-grupo">
              <label>E-mail Acadêmico</label>
              <input type="email" class="ath-input" id="athLoginEmail" value="${p.email || ''}" placeholder="Ex.: pesquisador@universidade.edu.br">
            </div>
          </div>

          <div class="ath-prop-grupo">
            <label>Cor do Seu Avatar e Cursor Colaborativo</label>
            <div style="display:flex; gap:8px; margin-top:4px;" id="athLoginCoresBox">
              ${CORES_COLABORADORES.map(c => `
                <button type="button" class="ath-cor-dot ${(p.cor || '#314F79') === c ? 'on' : ''}" data-cor-login="${c}" style="background:${c}; width:26px; height:26px;"></button>
              `).join('')}
            </div>
          </div>

          <div style="padding:10px 12px; border-radius:10px; background:#F8FAFC; border:1px solid #CBD5E1; margin-top:6px;">
            <strong style="display:block; font-size:11.5px; color:#314F79; text-transform:uppercase; margin-bottom:6px;">
              Vínculos Rápidos (Zotero API & Google Drive)
            </strong>
            <div class="ath-linha2" style="margin-bottom:8px;">
              <div class="ath-prop-grupo" style="margin-bottom:0;">
                <label style="font-size:11px;">Zotero API Key (Chave Privada)</label>
                <input type="text" class="ath-input" id="athLoginZoteroKey" value="${zoteroApiKey}" placeholder="Ex.: KNEYoy8RTMlkaTuHx5WPc3bH" style="height:30px; font-size:11.5px;">
              </div>
              <div class="ath-prop-grupo" style="margin-bottom:0;">
                <label style="font-size:11px;">Zotero User ID</label>
                <input type="text" class="ath-input" id="athLoginZoteroId" value="${zoteroUserId}" placeholder="Ex.: 18806479" style="height:30px; font-size:11.5px;">
              </div>
            </div>
            <div class="ath-prop-grupo" style="margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <label style="font-size:11px; font-weight:700; color:#314F79; margin:0;">
                  Link ou ID da Pasta no Google Drive (Web)
                </label>
                ${driveCfg.pastaUrl ? `<a href="${driveCfg.pastaUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:#2563EB; font-weight:700; text-decoration:underline;">Abrir Pasta ↗</a>` : ''}
              </div>
              <input type="text" class="ath-input" id="athLoginDrivePastaUrl" value="${driveCfg.pastaUrl || ''}" placeholder="Ex.: https://drive.google.com/drive/folders/1ABCxyz... ou ID da pasta" style="height:30px; font-size:11.5px;">
              <small style="font-size:10.5px; color:#64748B; margin-top:2px; display:block;">Cole aqui o link da pasta do Google Drive onde você guarda PDFs e backups. Não depende de letra de unidade (G:, C:) e abre em qualquer PC.</small>
            </div>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnModalSincronizarHub" style="width:100%; height:30px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:#FFFFFF; border:1px solid #CBD5E1; margin-top:6px;" title="Cria ou localiza automaticamente a pasta Hub 'Athenes' no Google Drive">
              ${svgIcone('pasta', 13)} Sincronizar / Criar Pasta Hub Athenes no Drive
            </button>
          </div>
        </div>
        <div class="ath-modal-foot" style="display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="glx-btn glx-btn-soft" id="athBtnModalSairConta" style="color:#DC2626; font-weight:750; font-size:12px; height:34px; padding:0 12px; display:inline-flex; align-items:center; gap:6px; border:1px solid #FCA5A5; background:#FEF2F2; cursor:pointer;" title="Encerrar sessão e trocar de conta">
            ⏻ Sair da Conta / Mudar Usuário
          </button>
          <div style="display:flex; gap:8px;">
            <button type="button" class="ath-btn" id="athBtnCancelarLogin">Cancelar</button>
            <button type="button" class="ath-btn ath-btn-primary" id="athBtnSalvarLogin">Salvar Identificação & Chaves</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    let corEscolhida = p.cor || '#314F79';

    modal.querySelectorAll('[data-cor-login]').forEach(btn => {
      btn.addEventListener('click', () => {
        corEscolhida = btn.dataset.corLogin;
        modal.querySelectorAll('[data-cor-login]').forEach(b => b.classList.toggle('on', b.dataset.corLogin === corEscolhida));
      });
    });

    // Eventos Google no Modal
    modal.querySelector('#athBtnModalLoginGoogle')?.addEventListener('click', async () => {
      try {
        const cfg = obterConfigGoogleDrive();
        const token = await autenticarGoogleDrive(cfg.clientId);
        if (token) {
          const info = await obterInfoUsuarioGoogle(token).catch(() => null);
          if (info) {
            p.nome = info.name || p.nome;
            p.email = info.email || p.email;
            p.foto = info.picture;
            p.autenticadoGoogle = true;
            salvarPerfilColaborador(p);

            modal.querySelector('#athLoginNome').value = p.nome;
            if (p.email) modal.querySelector('#athLoginEmail').value = p.email;
          }

          // Cria ou localiza a pasta Athenes no Drive
          const est = await obterOuCriarEstruturaPastasAthenes(token);
          if (est?.pastaRaizId) {
            const urlHub = `https://drive.google.com/drive/folders/${est.pastaRaizId}?usp=drive_link`;
            const inpPasta = modal.querySelector('#athLoginDrivePastaUrl');
            if (inpPasta) inpPasta.value = urlHub;
          }

          fechar();
          this.abrirModalLogin();
          this.renderizar();
        }
      } catch (err) {
        alert('Erro ao conectar com Google: ' + err.message);
      }
    });

    modal.querySelector('#athBtnModalSairConta')?.addEventListener('click', () => {
      fechar();
      encerrarSessao();
      this.onLogout();
    });

    modal.querySelector('#athBtnModalDesconectarGoogle')?.addEventListener('click', () => {
      fechar();
      encerrarSessao();
      this.onLogout();
    });

    modal.querySelector('#athBtnModalSairConta')?.addEventListener('click', () => {
      fechar();
      encerrarSessao();
      this.onLogout();
    });

    modal.querySelector('#athBtnModalSincronizarHub')?.addEventListener('click', async () => {
      try {
        const cfg = obterConfigGoogleDrive();
        const token = cfg.accessToken || await autenticarGoogleDrive(cfg.clientId);
        const est = await obterOuCriarEstruturaPastasAthenes(token);
        if (est?.pastaRaizId) {
          const urlHub = `https://drive.google.com/drive/folders/${est.pastaRaizId}?usp=drive_link`;
          const inpPasta = modal.querySelector('#athLoginDrivePastaUrl');
          if (inpPasta) inpPasta.value = urlHub;
          alert('Pasta Hub Athenes pronta e vinculada com sucesso no Google Drive!');
        }
      } catch (err) {
        alert('Erro ao sincronizar pasta Hub: ' + err.message);
      }
    });

    const fechar = () => modal.remove();
    modal.querySelector('#athModalLoginFechar').addEventListener('click', fechar);
    modal.querySelector('#athBtnCancelarLogin').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athBtnSalvarLogin').addEventListener('click', () => {
      const novoPerfil = {
        ...p,
        nome: modal.querySelector('#athLoginNome').value.trim() || 'Autor Principal',
        papel: modal.querySelector('#athLoginPapel').value,
        instituicao: modal.querySelector('#athLoginInstituicao').value.trim(),
        email: modal.querySelector('#athLoginEmail').value.trim(),
        cor: corEscolhida
      };
      salvarPerfilColaborador(novoPerfil);

      const pastaUrlDrive = modal.querySelector('#athLoginDrivePastaUrl')?.value.trim() || '';
      salvarConfigGoogleDrive({
        ...driveCfg,
        pastaUrl: pastaUrlDrive
      });

      const zId = modal.querySelector('#athLoginZoteroId').value.trim();
      const zKey = modal.querySelector('#athLoginZoteroKey').value.trim();
      try {
        const zAtual = JSON.parse(localStorage.getItem('athenes_zotero_cfg') || '{}');
        localStorage.setItem('athenes_zotero_cfg', JSON.stringify({
          ...zAtual,
          userId: zId || zAtual.userId || '',
          apiKey: zKey !== undefined ? zKey : (zAtual.apiKey || '')
        }));
      } catch (_) {}

      fechar();
      this.renderizar();
    });
  }

  selecionarPasta(pastaId) {
    this.pastaAtivaId = pastaId;
    this.renderizarPastasLateral();
    this.renderizarBannerPasta();
    if (this.abaAtiva === 'escrita') {
      this.atualizarGrid();
    }
  }

  renderizarPastasLateral() {
    const listaEl = this.container.querySelector('#athDashPastasLista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    // 1. Item Todas as Pastas (Visão Geral)
    const totalDocs = this.documentos.length;
    const itemTodas = document.createElement('div');
    itemTodas.className = `ath-pasta-item ${this.pastaAtivaId === 'todas' ? 'active' : ''}`;
    itemTodas.innerHTML = `
      <div style="display:flex; align-items:center; gap:7px;">
        ${svgIcone('pasta', 15)}
        <span>Todas as Pastas (Geral)</span>
      </div>
      <span class="ath-pasta-badge">${totalDocs}</span>
    `;
    itemTodas.addEventListener('click', () => this.selecionarPasta('todas'));
    listaEl.appendChild(itemTodas);

    // 2. Seção Minhas Pastas (Google Drive)
    const tituloMinhas = document.createElement('div');
    tituloMinhas.className = 'ath-dash-grupo-titulo';
    tituloMinhas.textContent = 'Minhas Pastas (Drive)';
    listaEl.appendChild(tituloMinhas);

    const minhasPastas = this.pastasDrive.filter(p => p.origem !== 'compartilhada');
    for (const pasta of minhasPastas) {
      this.montarItemPastaComSubpastas(listaEl, pasta, 0);
    }

    // 3. Seção Pastas Compartilhadas Comigo
    const compartilhadas = this.pastasDrive.filter(p => p.origem === 'compartilhada');
    const tituloComp = document.createElement('div');
    tituloComp.className = 'ath-dash-grupo-titulo';
    tituloComp.textContent = 'Compartilhadas Comigo';
    listaEl.appendChild(tituloComp);

    if (compartilhadas.length === 0) {
      const avisoVazio = document.createElement('div');
      avisoVazio.style.cssText = 'font-size:11px; color:#94A3B8; padding:6px 8px; font-style:italic;';
      avisoVazio.textContent = 'Nenhuma pasta compartilhada vinculada.';
      listaEl.appendChild(avisoVazio);
    } else {
      for (const pasta of compartilhadas) {
        this.montarItemPastaComSubpastas(listaEl, pasta, 0, true);
      }
    }
  }

  montarItemPastaComSubpastas(container, pasta, nivel = 0, ehCompartilhada = false) {
    const item = document.createElement('div');
    const ativo = (this.pastaAtivaId === pasta.id);
    item.className = `ath-pasta-item ${ativo ? 'active' : ''} ${nivel > 0 ? 'ath-pasta-item-sub' : ''}`;
    
    const count = this.documentos.filter(d => {
      const pId = d.pastaId || (d.tipoDoc === 'artigo' || d.tipoDoc === 'relatorio' ? 'pasta_rel_raiz' : 'pasta_bib_raiz');
      return pId === pasta.id;
    }).length;

    const iconeNome = pasta.icone || (pasta.tipo === 'bibliografia' ? 'livro' : (pasta.tipo === 'relatorios' ? 'documento' : (ehCompartilhada ? 'usuarios' : 'pasta')));
    const prefixo = nivel > 0 ? '↳ ' : '';

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
        ${svgIcone(iconeNome, 14)}
        <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${pasta.nome}">${prefixo}${pasta.nome}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <span class="ath-pasta-badge">${count}</span>
        ${ehCompartilhada ? `
          <button type="button" class="ath-btn ath-btn-xs ath-btn-remover-comp" title="Desvincular pasta compartilhada" style="padding:0 3px; height:18px; color:#DC2626; border:none; background:transparent;">
            ✕
          </button>
        ` : ''}
      </div>
    `;

    item.addEventListener('click', (ev) => {
      if (ev.target.closest('.ath-btn-remover-comp')) {
        ev.stopPropagation();
        if (confirm(`Deseja desvincular a pasta compartilhada "${pasta.nome}"?`)) {
          removerPastaDriveLocal(pasta.id);
          this.pastasDrive = obterPastasDriveLocais();
          if (this.pastaAtivaId === pasta.id) this.pastaAtivaId = 'todas';
          this.renderizarPastasLateral();
          this.renderizarBannerPasta();
          this.atualizarGrid();
        }
        return;
      }
      this.selecionarPasta(pasta.id);
    });

    container.appendChild(item);

    if (Array.isArray(pasta.subpastas) && pasta.subpastas.length > 0) {
      for (const sub of pasta.subpastas) {
        this.montarItemPastaComSubpastas(container, sub, nivel + 1, ehCompartilhada);
      }
    }
  }

  renderizarBannerPasta() {
    const bannerEl = this.container.querySelector('#athDashPastaBanner');
    if (!bannerEl) return;

    if (this.pastaAtivaId === 'todas') {
      bannerEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          ${svgIcone('pasta', 18)}
          <div>
            <strong style="display:block; font-size:13px; color:#1E293B;">Todas as Pastas (Visão Geral)</strong>
            <small style="font-size:11px; color:#64748B;">Exibindo todos os documentos locais e sincronizados (${this.documentos.length} no total)</small>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="ath-btn ath-btn-sm ath-btn-primary" id="athBtnNovoDocBanner">
            ${svgIcone('mais', 13)} Novo Documento
          </button>
        </div>
      `;
    } else {
      const pastaInfo = buscarPastaNaArvore(this.pastasDrive, this.pastaAtivaId) || { nome: 'Pasta Selecionada', tipo: 'relatorios' };
      const docsNaPasta = this.documentos.filter(d => {
        const pId = d.pastaId || (d.tipoDoc === 'artigo' || d.tipoDoc === 'relatorio' ? 'pasta_rel_raiz' : 'pasta_bib_raiz');
        return pId === this.pastaAtivaId;
      });

      const ehBib = pastaInfo.tipo === 'bibliografia';

      bannerEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
          ${svgIcone(ehBib ? 'livro' : 'pasta', 20)}
          <div style="min-width:0;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Pasta do Drive:</span>
              <strong style="font-size:13.5px; color:#314F79; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${pastaInfo.nome}</strong>
              <span class="ath-badge ath-badge-info" style="font-size:10px;">${pastaInfo.origem === 'compartilhada' ? 'Compartilhada' : 'Minha Pasta'}</span>
            </div>
            <small style="font-size:11px; color:#64748B; display:block; margin-top:1px;">
              ${docsNaPasta.length} documento(s) nesta pasta · Mostrando apenas o conteúdo selecionado
            </small>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${ehBib ? `
            <button type="button" class="ath-btn ath-btn-sm" id="athBtnVerArtigosZoteroBanner" style="font-weight:700; background:#EEF4FA; color:#314F79; border:1px solid #C8D7E6;">
              ${svgIcone('zotero', 13)} Ver Leituras & Fichamentos
            </button>
          ` : ''}
          <button type="button" class="ath-btn ath-btn-sm ath-btn-primary" id="athBtnNovoDocBanner">
            ${svgIcone('mais', 13)} Novo nesta Pasta
          </button>
        </div>
      `;

      bannerEl.querySelector('#athBtnVerArtigosZoteroBanner')?.addEventListener('click', () => {
        this.abaAtiva = 'artigos_zotero';
        this.renderizar();
      });
    }

    bannerEl.querySelector('#athBtnNovoDocBanner')?.addEventListener('click', () => {
      this.abrirModalNovoDoc({ pastaId: this.pastaAtivaId });
    });
  }

  abrirModalNovaSubpasta() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';

    const opcoesMae = [];
    function coletarPastas(lista, prefixo = '') {
      for (const p of lista) {
        opcoesMae.push({ id: p.id, nome: `${prefixo}${p.nome}`, tipo: p.tipo });
        if (p.subpastas && p.subpastas.length > 0) {
          coletarPastas(p.subpastas, `${prefixo}  ↳ `);
        }
      }
    }
    coletarPastas(this.pastasDrive);

    const pastaPreselecionada = (this.pastaAtivaId !== 'todas' ? this.pastaAtivaId : 'pasta_rel_raiz');

    modal.innerHTML = `
      <div class="ath-modal" style="max-width:440px;">
        <div class="ath-modal-head">
          <h2>Nova Subpasta no Google Drive</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalSubFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:12px; color:var(--ath-text-secondary); margin-top:0;">
            Crie uma subpasta para organizar seus artigos, relatórios técnicos ou revisões bibliográficas no Google Drive.
          </p>
          <div class="ath-prop-grupo">
            <label>Nome da Subpasta</label>
            <input type="text" class="ath-input" id="athSubpastaNome" placeholder="Ex.: Artigo SBPC 2026, Tese Doutorado..." autofocus>
          </div>
          <div class="ath-prop-grupo">
            <label>Pasta-Mãe (Onde será criada)</label>
            <select class="ath-select" id="athSubpastaPai">
              ${opcoesMae.map(o => `<option value="${o.id}" ${o.id === pastaPreselecionada ? 'selected' : ''}>${o.nome}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athBtnCancelarSub">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athBtnCriarSubpastaConfirmar">Criar Subpasta</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalSubFechar').addEventListener('click', fechar);
    modal.querySelector('#athBtnCancelarSub').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athBtnCriarSubpastaConfirmar').addEventListener('click', async () => {
      const nome = modal.querySelector('#athSubpastaNome').value.trim();
      if (!nome) {
        alert('Por favor, informe um nome para a subpasta.');
        return;
      }
      const parentId = modal.querySelector('#athSubpastaPai').value;
      const pastaMae = buscarPastaNaArvore(this.pastasDrive, parentId);

      const novaSub = adicionarSubpastaDriveLocal({
        parentId,
        nome,
        tipo: pastaMae?.tipo || 'relatorios'
      });

      const driveCfg = obterConfigGoogleDrive();
      if (driveCfg.accessToken) {
        criarSubpastaNoGoogleDrive({
          accessToken: driveCfg.accessToken,
          nome,
          parentFolderId: parentId.startsWith('pasta_') ? driveCfg.pastaId : parentId
        }).catch(err => console.warn('[Athenes] Subpasta criada localmente; aviso sincronia Drive:', err));
      }

      this.pastasDrive = obterPastasDriveLocais();
      fechar();
      this.selecionarPasta(novaSub.id);
    });
  }

  abrirModalVincularPasta() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';

    modal.innerHTML = `
      <div class="ath-modal" style="max-width:480px;">
        <div class="ath-modal-head">
          <h2>Vincular Pasta Compartilhada do Google Drive</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalCompFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:12px; color:var(--ath-text-secondary); margin-top:0;">
            Vincule uma pasta que um orientador, coautor ou laboratório compartilhou com você via Google Drive para acessar e colaborar diretamente nos resumos e documentos.
          </p>
          <div class="ath-prop-grupo">
            <label>Link ou ID da Pasta Compartilhada no Google Drive</label>
            <input type="text" class="ath-input" id="athCompUrl" placeholder="Ex.: https://drive.google.com/drive/folders/1ABCxyz... ou ID da pasta" autofocus>
          </div>
          <div class="ath-prop-grupo">
            <label>Nome / Identificação da Pasta</label>
            <input type="text" class="ath-input" id="athCompNome" placeholder="Ex.: Bibliografia Urbanismo - Prof. Carlos">
          </div>
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Quem Compartilhou</label>
              <input type="text" class="ath-input" id="athCompDono" placeholder="Ex.: Prof. Orientador, Coautor...">
            </div>
            <div class="ath-prop-grupo">
              <label>Tipo de Conteúdo</label>
              <select class="ath-select" id="athCompTipo">
                <option value="bibliografia">Bibliografia & Leituras</option>
                <option value="relatorios">Relatórios & Artigos</option>
                <option value="compartilhada">Geral / Compartilhada</option>
              </select>
            </div>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athBtnCancelarComp">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athBtnVincularCompConfirmar">Vincular Pasta</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalCompFechar').addEventListener('click', fechar);
    modal.querySelector('#athBtnCancelarComp').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athBtnVincularCompConfirmar').addEventListener('click', () => {
      const urlOuId = modal.querySelector('#athCompUrl').value.trim();
      const pastaId = extrairIdPastaDrive(urlOuId);
      if (!pastaId) {
        alert('Por favor, informe um link ou ID válido de pasta do Google Drive.');
        return;
      }
      const nome = modal.querySelector('#athCompNome').value.trim() || 'Pasta Compartilhada';
      const dono = modal.querySelector('#athCompDono').value.trim() || 'Colega / Orientador';
      const tipo = modal.querySelector('#athCompTipo').value;

      const comp = adicionarPastaCompartilhadaDriveLocal({
        id: pastaId,
        nome,
        url: urlOuId.startsWith('http') ? urlOuId : `https://drive.google.com/drive/folders/${pastaId}`,
        dono,
        tipo
      });

      this.pastasDrive = obterPastasDriveLocais();
      fechar();
      this.selecionarPasta(comp.id);
    });
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
        const docPastaId = doc.pastaId || (doc.tipoDoc === 'artigo' || doc.tipoDoc === 'relatorio' ? 'pasta_rel_raiz' : 'pasta_bib_raiz');
        matchPasta = (docPastaId === this.pastaAtivaId);
      }

      return matchTipo && matchBusca && matchPasta;
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
            ${pastaInfo ? 'Clique em "+ Novo nesta Pasta" acima para criar um documento diretamente aqui.' : 'Clique em "+ Novo Documento" para iniciar um artigo ou relatório.'}
          </p>
        </div>
      `;
      return;
    }

    for (const doc of filtrados) {
      const card = document.createElement('div');
      card.className = 'ath-doc-card';

      const dataFormatada = new Date(doc.dataModificacao || doc.dataCriacao || Date.now()).toLocaleDateString('pt-BR');
      const autorPrincipal = doc.metadados?.autores?.[0]?.nome || this.perfilUsuario?.nome || 'Autor Principal';

      const statusMap = {
        rascunho: { rotulo: 'Rascunho', classe: 'ath-badge-warn' },
        em_revisao: { rotulo: 'Em Revisão', classe: 'ath-badge-info' },
        finalizado: { rotulo: 'Finalizado', classe: 'ath-badge-ok' }
      };
      const st = statusMap[doc.estado] || statusMap.rascunho;

      card.innerHTML = `
        <div class="ath-doc-card-capa-preview">
          <div class="ath-doc-card-capa-titulo">${doc.titulo}</div>
          <div class="ath-doc-card-capa-autor">${autorPrincipal} · ${doc.metadados?.ano || '2026'}</div>
        </div>

        <div class="ath-doc-card-header">
          <span class="ath-badge ath-badge-primary">${doc.tipoDoc?.toUpperCase() || 'DOCUMENTO'}</span>
          <span class="ath-badge ${st.classe}">${st.rotulo}</span>
          ${doc.salvoNuvem ? `<span class="ath-badge" style="background:#EEF4FA; color:#314F79; font-weight:700; border:1px solid #C8D7E6; display:inline-flex; align-items:center; gap:4px;">${svgIcone('nuvem_ok', 11)} NUVEM</span>` : ''}
        </div>

        <h3 class="ath-doc-card-titulo">${doc.titulo}</h3>
        <p class="ath-doc-card-subtitulo">${doc.subtitulo || 'Sem subtítulo'}</p>

        <div class="ath-doc-card-meta">
          <span>Modificado em ${dataFormatada}</span>
          <div class="ath-doc-card-actions">
            <button type="button" class="ath-btn ath-btn-sm ath-btn-primary ath-btn-abrir">Abrir</button>
            <button type="button" class="ath-btn ath-btn-sm ath-btn-excluir" title="Excluir">${svgIcone('lixeira', 12)}</button>
          </div>
        </div>
      `;

      card.addEventListener('click', async (ev) => {
        if (ev.target.closest('.ath-btn-excluir')) {
          ev.stopPropagation();
          this.documentos = this.documentos.filter(d => d.id !== doc.id);
          this.salvarDocumentosLocais();
          this.atualizarGrid();
          return;
        }

        let docParaAbrir = doc;
        if (doc.precisaCarregarConteudo) {
          const btnAbrir = card.querySelector('.ath-btn-abrir');
          if (btnAbrir) btnAbrir.textContent = 'Baixando...';
          try {
            const remoto = await carregarDocumentoDoSupabase(doc.id);
            if (remoto) {
              docParaAbrir = remoto;
              docParaAbrir.salvoNuvem = true;
              docParaAbrir.precisaCarregarConteudo = false;
              const idx = this.documentos.findIndex(d => String(d.id) === String(doc.id));
              if (idx >= 0) this.documentos[idx] = docParaAbrir;
              this.salvarDocumentosLocais();
            }
          } catch (e) {
            alert(`Falha ao abrir documento da nuvem: ${e.message}`);
            if (btnAbrir) btnAbrir.textContent = 'Abrir';
            return;
          }
        }
        this.onAbrirDocumento(docParaAbrir);
      });

      gridEl.appendChild(card);
    }
  }

  abrirModalNovoDoc(opcoes = {}) {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';

    const pastaAlvoId = opcoes.pastaId || (this.pastaAtivaId !== 'todas' ? this.pastaAtivaId : 'pasta_rel_raiz');
    const opcoesPastas = [];
    function coletarPastas(lista, prefixo = '') {
      for (const p of lista) {
        opcoesPastas.push({ id: p.id, nome: `${prefixo}${p.nome}` });
        if (p.subpastas && p.subpastas.length > 0) {
          coletarPastas(p.subpastas, `${prefixo}  ↳ `);
        }
      }
    }
    coletarPastas(this.pastasDrive);

    modal.innerHTML = `
      <div class="ath-modal">
        <div class="ath-modal-head">
          <h2>Criar Novo Documento</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalNovoFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div class="ath-prop-grupo">
            <label>Título do Documento</label>
            <input type="text" class="ath-input" id="athNovoDocTitulo" placeholder="Ex.: Análise de Desempenho e Validação Experimental" autofocus>
          </div>

          <div class="ath-prop-grupo">
            <label>Subtítulo ou Delimitação Temática (Opcional)</label>
            <input type="text" class="ath-input" id="athNovoDocSubtitulo" placeholder="Ex.: Estudo comparativo e proposições normativas">
          </div>

          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Tipo de Documento</label>
              <select class="ath-select" id="athNovoDocTipo">
                ${TIPOS_DOCUMENTO.map(t => `<option value="${t.id}">${t.rotulo}</option>`).join('')}
              </select>
            </div>
            <div class="ath-prop-grupo">
              <label>Perfil de Formatação</label>
              <select class="ath-select" id="athNovoDocPerfil">
                ${Object.values(PERFIS_FORMATACAO).map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="ath-prop-grupo">
            <label>Pasta de Destino (Google Drive)</label>
            <select class="ath-select" id="athNovoDocPasta">
              ${opcoesPastas.map(p => `<option value="${p.id}" ${p.id === pastaAlvoId ? 'selected' : ''}>${p.nome}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athBtnCancelarNovo">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athBtnCriarDoc">Criar e Abrir</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fechar = () => modal.remove();
    modal.querySelector('#athModalNovoFechar').addEventListener('click', fechar);
    modal.querySelector('#athBtnCancelarNovo').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athBtnCriarDoc').addEventListener('click', () => {
      const titulo = modal.querySelector('#athNovoDocTitulo').value.trim() || 'Novo Documento';
      const subtitulo = modal.querySelector('#athNovoDocSubtitulo').value.trim();
      const tipoDoc = modal.querySelector('#athNovoDocTipo').value;
      const perfilId = modal.querySelector('#athNovoDocPerfil').value;
      const pastaEscolhida = modal.querySelector('#athNovoDocPasta')?.value || pastaAlvoId;

      const novo = criarDocumento({ titulo, subtitulo, tipoDoc, perfilId });
      if (this.perfilUsuario?.nome && novo.metadados?.autores?.[0]) {
        novo.metadados.autores[0].nome = this.perfilUsuario.nome;
      }
      novo.pastaId = pastaEscolhida;
      this.documentos.unshift(novo);
      this.salvarDocumentosLocais();
      fechar();

      if (this.pastaAtivaId !== 'todas' && this.pastaAtivaId !== pastaEscolhida) {
        this.selecionarPasta(pastaEscolhida);
      } else {
        this.renderizarPastasLateral();
        this.renderizarBannerPasta();
        this.atualizarGrid();
      }
      this.onAbrirDocumento(novo);
    });
  }

  importarDocumentoJson(arquivo) {
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json && (Array.isArray(json.paginas) || Array.isArray(json.secoes))) {
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

  async sincronizarComSupabase(silencioso = false) {
    const btn = this.container?.querySelector('#athBtnSincronizarNuvem');
    if (btn && !silencioso) {
      btn.innerHTML = `${svgIcone('nuvem', 14)} Sincronizando...`;
      btn.disabled = true;
    }
    try {
      const listaNuvem = await listarDocumentosDoSupabase();
      if (!Array.isArray(listaNuvem) || listaNuvem.length === 0) {
        if (!silencioso) alert('Nenhum documento encontrado na sua nuvem Supabase.');
        return;
      }

      let novos = 0;
      for (const item of listaNuvem) {
        const existente = this.documentos.find(d => String(d.id) === String(item.id));
        if (!existente) {
          this.documentos.unshift({
            id: item.id,
            titulo: item.titulo || 'Documento da Nuvem',
            subtitulo: `Sincronizado do Supabase · ${item.atualizado_por || 'Autor'}`,
            tipoDoc: 'artigo',
            perfilId: item.norma || 'abnt',
            dataModificacao: item.atualizado_em,
            salvoNuvem: true,
            precisaCarregarConteudo: true
          });
          novos++;
        } else {
          existente.salvoNuvem = true;
          if (item.atualizado_em && (!existente.dataModificacao || new Date(item.atualizado_em) > new Date(existente.dataModificacao))) {
            existente.precisaCarregarConteudo = true;
            existente.dataModificacao = item.atualizado_em;
            novos++;
          }
        }
      }

      if (novos > 0) {
        this.salvarDocumentosLocais();
        this.atualizarGrid();
      }
      if (!silencioso) {
        alert(novos > 0 
          ? `${novos} documento(s) da nuvem atualizados com sucesso!` 
          : 'Seus documentos já estão atualizados com a nuvem.');
      }
    } catch (err) {
      if (!silencioso) alert(`Não foi possível sincronizar com a nuvem: ${err.message}`);
    } finally {
      if (btn && !silencioso) {
        btn.innerHTML = `${svgIcone('nuvem', 14)} Sincronizar Nuvem`;
        btn.disabled = false;
      }
    }
  }

  abrirModalBackupEspaco() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';

    modal.innerHTML = `
      <div class="ath-modal" style="max-width:580px; width:92%; max-height:88vh; box-shadow:0 20px 45px rgba(15,23,42,0.25);">
        <div class="ath-modal-head" style="padding:16px 20px; border-bottom:1px solid var(--ath-line, #E2E8F0); flex-shrink:0;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--ath-primary, #314F79); display:flex;">${svgIcone('nuvem_ok', 20)}</span>
            <h2 style="margin:0; font-size:17px; font-weight:800; color:var(--ath-text, #1E293B);">Sincronização & Backup Multi-PC</h2>
          </div>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalBackupFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo" style="padding:18px 20px; display:flex; flex-direction:column; gap:14px; min-height:0; overflow-y:auto; flex:1 1 auto;">
          <div style="padding:12px 14px; background:#EEF4FA; border:1px solid #C8D7E6; border-radius:10px; font-size:12.5px; line-height:1.55; color:#1E293B;">
            <strong>Como acessar seus documentos e PDFs em outro computador:</strong>
            <ul style="margin:8px 0 0 18px; padding:0;">
              <li><strong>Nuvem Supabase:</strong> Seus documentos de texto salvos na nuvem aparecem automaticamente ao clicar em <em>Sincronizar Nuvem</em>.</li>
              <li><strong>Google Drive no Computador:</strong> Mantenha uma pasta sincronizada pelo app Google Drive Desktop com seus arquivos e PDFs de referência para acesso instantâneo em qualquer PC.</li>
            </ul>
          </div>

          <div style="border:1px solid #E2E8F0; border-radius:10px; padding:14px; background:#FFFFFF; display:flex; flex-direction:column; gap:8px;">
            <strong style="font-size:13px; color:#0F172A;">1. Baixar Backup Completo do Espaço</strong>
            <p style="font-size:12px; color:#64748B; margin:0;">Exporta todos os seus documentos de texto, fichamentos Zotero, citações e configurações para um arquivo <code>.athenes-workspace</code>.</p>
            <div style="margin-top:4px;">
              <button type="button" class="ath-btn ath-btn-primary" id="athBtnBaixarBackupWorkspace" style="font-size:12.5px; height:34px; padding:0 14px; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
                ${svgIcone('salvar', 14)} Baixar Arquivo de Backup (.athenes-workspace)
              </button>
            </div>
          </div>

          <div style="border:1px solid #E2E8F0; border-radius:10px; padding:14px; background:#FFFFFF; display:flex; flex-direction:column; gap:8px;">
            <strong style="font-size:13px; color:#0F172A;">2. Restaurar Backup do Google Drive / Arquivo</strong>
            <p style="font-size:12px; color:#64748B; margin:0;">Carrega o arquivo de backup para restaurar todos os documentos e fichamentos instantaneamente neste computador.</p>
            <div style="margin-top:4px;">
              <label class="ath-btn" style="cursor:pointer; font-size:12.5px; height:34px; padding:0 14px; display:inline-flex; align-items:center; gap:6px; font-weight:700; background:#F1F5F9; border:1px solid #CBD5E1;">
                ${svgIcone('mais', 14)} Escolher Arquivo .athenes-workspace...
                <input type="file" accept=".athenes-workspace,.json" id="athInputRestaurarBackup" style="display:none;">
              </label>
            </div>
          </div>
        </div>
        <div class="ath-modal-foot" style="padding:12px 20px; border-top:1px solid var(--ath-line, #E2E8F0); background:var(--ath-surface-elevated, #F8FAFC); display:flex; justify-content:flex-end; gap:10px; flex-shrink:0;">
          <button type="button" class="ath-btn" id="athModalBackupCancelar" style="padding:0 16px; height:32px; font-weight:700;">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fechar = () => modal.remove();
    modal.querySelector('#athModalBackupFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalBackupCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athBtnBaixarBackupWorkspace').addEventListener('click', () => {
      this.exportarBackupEspaco();
    });

    modal.querySelector('#athInputRestaurarBackup').addEventListener('change', e => {
      const arq = e.target.files[0];
      if (arq) {
        this.restaurarBackupEspaco(arq, () => fechar());
      }
    });
  }

  exportarBackupEspaco() {
    let artigosEstudo = [];
    let zoteroCfg = {};
    let perfil = {};
    try {
      artigosEstudo = JSON.parse(localStorage.getItem('athenes_artigos_estudo') || '[]');
      zoteroCfg = JSON.parse(localStorage.getItem('athenes_zotero_cfg') || '{}');
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

  restaurarBackupEspaco(arquivo, callbackSucesso) {
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (Array.isArray(dados.documentos)) {
          for (const doc of dados.documentos) {
            const idx = this.documentos.findIndex(d => String(d.id) === String(doc.id));
            if (idx >= 0) {
              this.documentos[idx] = doc;
            } else {
              this.documentos.push(doc);
            }
          }
          this.salvarDocumentosLocais();
        }

        if (Array.isArray(dados.artigosEstudo)) {
          try {
            const atuais = JSON.parse(localStorage.getItem('athenes_artigos_estudo') || '[]');
            for (const art of dados.artigosEstudo) {
              const idx = atuais.findIndex(a => String(a.id) === String(art.id));
              if (idx >= 0) atuais[idx] = art;
              else atuais.push(art);
            }
            localStorage.setItem('athenes_artigos_estudo', JSON.stringify(atuais));
          } catch (_) {}
        }

        if (dados.zoteroCfg && Object.keys(dados.zoteroCfg).length > 0) {
          try {
            localStorage.setItem('athenes_zotero_cfg', JSON.stringify(dados.zoteroCfg));
          } catch (_) {}
        }

        if (dados.perfil && Object.keys(dados.perfil).length > 0) {
          try {
            localStorage.setItem('athenes_perfil_colaborador', JSON.stringify(dados.perfil));
          } catch (_) {}
        }

        alert('Backup restaurado com sucesso! Seus documentos e fichamentos foram sincronizados.');
        if (callbackSucesso) callbackSucesso();
        this.renderizar();
      } catch (err) {
        alert(`Erro ao restaurar backup: ${err.message}`);
      }
    };
    reader.readAsText(arquivo);
  }
}
