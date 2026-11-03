// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Área Inicial / Dashboard Dividida em Duas Páginas:
 * 1. Página de Escrita & Documentos (Artigos, Relatórios, Teses em blocos)
 * 2. Página de Leitura & Fichamento de Artigos (Vínculo Zotero + Leitor/Riscador de PDF estilo Samsung Notes + Google Drive)
 * Inclui barra superior de Identificação / Login do Usuário sincronizada com Supabase e Google Drive.
 */

import { lerConta, gravarConta, contaEhPrimeira } from '../core/athenes_conta.js';
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
import { escapeHtml } from '../core/athenes_seguranca.js';
import { EstudoArtigosView, carregarArtigosEstudo } from './athenes_estudo_artigos.js';
import { listarCompartilhadosComigo, marcarComoCompartilhado, carregarDocumentoCompartilhado } from '../core/athenes_compartilhamento.js';
import { svgIcone, svgLogo } from './athenes_icones.js';
import { GerenciadorArquivosUI } from './athenes_arquivos_ui.js';
import { mostrarAviso, eErroDeCota } from './athenes_aviso.js';
import { abrirNovoDocumentoModal, abrirImportadorDocxModal } from './athenes_novo_documento_modal.js';
import { criarDocumentoDeTemplate } from '../core/athenes_templates.js';
import { driveConectado, tokenDriveValido, obterTokenDrive, obterTokenOuConectar, sincronizarPastasComDrive, sincronizarDocumentosComDrive, marcarSessaoDriveExpirada, registrarExclusoes, idsExcluidos, processarExclusoesPendentes, obterPastaRaizDrive, repararPastaDosDocumentos, sincronizarZoteroComDrive, importarPastasDoDrive, listarBibliotecaDoDrive, mesclarBibliotecaDrive, baixarDocumentoDoDrive } from '../core/athenes_drive_sync.js';

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
    this.arquivos = new GerenciadorArquivosUI(this); // duplicar, mover, seleção em lote, arrastar e soltar

    this.carregarDocumentosLocais();
    this.renderizar();
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      setTimeout(() => this.sincronizarComSupabase(true), 1200);
    }
  }

  carregarDocumentosLocais() {
    try {
      const salvo = lerConta('athenes_docs_indice');
      if (salvo) {
        this.documentos = JSON.parse(salvo);
      }
    } catch (_) {
      this.documentos = [];
    }

    // os documentos de exemplo são só da primeira conta do navegador: as demais começam vazias (antes todas "herdavam" os mesmos arquivos)
    if ((!this.documentos || this.documentos.length === 0) && !contaEhPrimeira()) this.documentos = [];
    else if (!this.documentos || this.documentos.length === 0) {
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
      gravarConta('athenes_docs_indice', JSON.stringify(this.documentos));
    } catch (e) {
      mostrarAviso(eErroDeCota(e) ? 'Armazenamento do navegador cheio: as últimas alterações não foram salvas. Faça um backup ou exclua documentos antigos.' : `Não foi possível salvar: ${e.message}`);
    }
  }

  /**
   * Grava a lista local e, para documentos na nuvem, o registro remoto. Rejeita em caso de falha
   * (cota do navegador cheia, Supabase indisponível) para o gerenciador de arquivos desfazer a ação.
   */
  async persistirDocumentos(docs = []) {
    gravarConta('athenes_docs_indice', JSON.stringify(this.documentos));
    for (const d of docs) {
      if (d.salvoNuvem) await salvarDocumentoNoSupabase(d, this.perfilUsuario);
    }
  }

  /** Abre um documento (baixando da nuvem antes, se preciso). */
  async abrirDocumento(doc, card = null) {
    let docParaAbrir = doc;
    if (doc.precisaCarregarConteudo) {
      const btnAbrir = card?.querySelector('.ath-btn-abrir');
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
      } catch (e) {
        alert(`Falha ao abrir documento da nuvem: ${e.message}`);
        if (btnAbrir) btnAbrir.textContent = 'Abrir';
        return;
      }
    }
    this.onAbrirDocumento(docParaAbrir);
  }

  abrirDocumentoDoCard(doc) {
    return this.abrirDocumento(doc, this.container.querySelector(`[data-doc-id="${doc.id}"]`));
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
            <a href="${driveCfg.pastaUrl}" target="_blank" rel="noopener noreferrer" class="ath-dash-btn-topo" title="Abrir a pasta do Athenes no seu Google Drive">
              ${svgIcone('drive', 15)}<span>Pasta no Drive</span><span class="ath-dash-btn-topo-seta" aria-hidden="true">↗</span>
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
            <button type="button" class="ath-btn ath-btn-xs" id="athBtnRecarregarPastasDrive" title="Sincronizar agora: cria as pastas e envia os documentos pendentes ao Drive" style="padding:2px 7px; height:24px; font-size:11px;">
              ↻
            </button>
          </div>
          <button type="button" id="athDriveStatus" class="ath-btn ath-btn-xs" style="margin:6px 10px 0; width:calc(100% - 20px); justify-content:flex-start; gap:6px; font-size:11px; font-weight:700; height:auto; padding:5px 8px; text-align:left; white-space:normal;"></button>

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
                <label class="ath-btn" style="cursor:pointer;" title="Importar um modelo do Word (.docx): extrai e consolida os estilos, sem copiar o texto">
                  ${svgIcone('mais', 14)} Importar template .docx
                  <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" id="athInputImportarDocx" style="display:none;">
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
        const novaAba = btn.dataset.abaDash;
        if (this.abaAtiva !== novaAba) {
          this.abaAtiva = novaAba;
          this.pastaAtivaId = 'todas';
          this.renderizar();
        }
      });
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

    const selectTipo = root.querySelector('#athDashFiltroTipo');
    selectTipo.addEventListener('change', () => {
      this.filtroTipo = selectTipo.value;
      this.atualizarGrid();
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

    if (this.abaAtiva === 'escrita') {
      this.atualizarGrid();
    } else {
      const boxEstudo = root.querySelector('#athContainerEstudoArtigos');
      this.estudoView = new EstudoArtigosView(boxEstudo, {
        pastaFiltroId: this.pastaAtivaId
      });
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
      const z = JSON.parse(lerConta('athenes_zotero_cfg') || '{}');
      zoteroUserId = z.userId || '';
      zoteroApiKey = z.apiKey || '';
    } catch (_) {}

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    const fechar = () => {
      modal.remove();
      document.querySelectorAll('.ath-modal-backdrop').forEach(m => m.remove());
    };
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:460px;">
        <div class="ath-modal-head">
          <h2>Identificação do Usuário & Contas Conectadas</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalLoginFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:11.5px; color:var(--ath-text-secondary); margin:0 0 8px;">
            Quem edita neste dispositivo: nome e cor aparecem nos cursores, sugestões e fichamentos.
          </p>

          <!-- Login Oficial com Conta Google / Gmail -->
          ${p.autenticadoGoogle ? `
            <div class="ath-google-user-badge" style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:10px; background:#F0FDF4; border:1px solid #BBF7D0; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="${p.foto || 'https://lh3.googleusercontent.com/avatar_exemplo.png'}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #86EFAC;" alt="Foto">
                <div>
                  <strong style="display:block; font-size:12.5px; color:#166534;">${p.nome}</strong>
                  <span style="font-size:11px; color:#15803D;">${p.email} · Conta Google Conectada</span>
                </div>
              </div>
            </div>
            <div id="athBoxNuvemSegura" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:5px 10px; border-radius:10px; margin:0 0 8px; border:1px solid ${nuvemAutenticada() ? '#BBF7D0' : '#FDE68A'}; background:${nuvemAutenticada() ? '#F0FDF4' : '#FFFBEB'};">
              <span style="font-size:11.5px; color:${nuvemAutenticada() ? '#166534' : '#92400E'}; line-height:1.35;"><strong>Nuvem protegida:</strong> <span id="athTxtNuvemSegura">${nuvemAutenticada() ? 'conta confirmada, só você acessa seus documentos.' : 'ainda não confirmada. Confirme a conta Google para salvar na nuvem.'}</span></span>
              ${nuvemAutenticada() ? '' : '<button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnConfirmarNuvem" style="font-size:11px; padding:3px 10px; font-weight:750; white-space:nowrap; cursor:pointer;">Confirmar agora</button>'}
            </div>
          ` : `
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnModalLoginGoogle" style="width:100%; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700; margin-bottom:8px; background:#FFFFFF; color:#1F2937; border:1px solid #CBD5E1; box-shadow:0 1px 3px rgba(0,0,0,0.08); font-size:12.5px; border-radius:8px; cursor:pointer;">
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
                  Pasta do Athenes no Google Drive (fixa)
                </label>
                ${driveCfg.pastaUrl ? `<a href="${driveCfg.pastaUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:#2563EB; font-weight:700; text-decoration:underline;">Abrir Pasta ↗</a>` : ''}
              </div>
              <input type="text" class="ath-input" id="athLoginDrivePastaUrl" value="${driveCfg.pastaUrl || ''}" placeholder="Aparece depois de conectar o Google Drive" readonly title="Pasta fixa da sua conta: a mesma em todos os computadores" style="height:30px; font-size:11.5px; background:#F1F5F9; color:#475569; cursor:default;">
              <small style="font-size:10.5px; color:#64748B; margin-top:2px; display:block;">É a pasta "Athenes" do Drive desta conta: a mesma em todos os computadores e não pode ser trocada.</small>
            </div>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnModalSincronizarHub" style="width:100%; height:30px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:#FFFFFF; border:1px solid #CBD5E1; margin-top:6px;" title="Cria ou localiza automaticamente a pasta Hub 'Athenes' no Google Drive">
              ${svgIcone('pasta', 13)} Sincronizar / Criar Pasta Hub Athenes no Drive
            </button>
          </div>

          <!-- Opção discreta para download do App Android (.apk) no perfil -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:5px 10px; margin-top:6px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
            <span style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700; color:#334155;"><span style="color:#047857; display:flex;">${svgIcone('android', 14)}</span>Athenes para Android (.apk)</span>
            <a href="/athenes.apk" download="athenes.apk" class="ath-btn ath-btn-sm" id="athBtnModalDownloadAndroid" style="height:24px; font-size:11px; font-weight:700; color:#047857; background:#ECFDF5; border:1px solid #A7F3D0; text-decoration:none; padding:0 10px; border-radius:6px; display:inline-flex; align-items:center;" title="Baixar pacote de instalação para Android (.apk)">Baixar .APK</a>
          </div>
        </div>
        <div class="ath-modal-foot ath-modal-foot-perfil">
          <button type="button" class="ath-btn-rodape ath-btn-rodape-sair" id="athBtnModalSairConta" title="Encerrar a sessão e trocar de conta">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sair da conta
          </button>
          <div style="display:flex; gap:8px;">
            <button type="button" class="ath-btn-rodape" id="athBtnCancelarLogin">Cancelar</button>
            <button type="button" class="ath-btn-rodape ath-btn-rodape-primario" id="athBtnSalvarLogin" title="Salvar nome, papel, cores e as chaves do Zotero">Salvar</button>
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

    modal.querySelector('#athBtnModalSairConta')?.addEventListener('click', (e) => {
      e?.preventDefault?.();
      fechar();
      encerrarSessao();
      if (typeof this.onLogout === 'function') {
        this.onLogout();
      }
    });

    modal.querySelector('#athBtnConfirmarNuvem')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget; const txt = modal.querySelector('#athTxtNuvemSegura');
      btn.disabled = true;
      try {
        await entrarNaNuvemComGoogle();
        try { sessionStorage.removeItem('athenes_nuvem_adiada'); } catch (_) {}
        txt.textContent = 'conta confirmada, só você acessa seus documentos.';
        modal.querySelector('#athBoxNuvemSegura').style.cssText += 'border-color:#BBF7D0; background:#F0FDF4;';
        btn.remove();
      } catch (err) {
        txt.textContent = `não foi possível confirmar: ${err.message}`;
        btn.disabled = false;
      }
    });


    modal.querySelector('#athBtnModalSincronizarHub')?.addEventListener('click', async () => {
      try {
        const cfg = obterConfigGoogleDrive();
        const token = await obterTokenOuConectar(cfg);
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

    // fechar já definido no topo do modal
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


      const zId = modal.querySelector('#athLoginZoteroId').value.trim();
      const zKey = modal.querySelector('#athLoginZoteroKey').value.trim();
      try {
        const zAtual = JSON.parse(lerConta('athenes_zotero_cfg') || '{}');
        gravarConta('athenes_zotero_cfg', JSON.stringify({
          ...zAtual,
          userId: zId || zAtual.userId || '',
          apiKey: zKey !== undefined ? zKey : (zAtual.apiKey || '')
        }));
      } catch (_) {}
      // chave do Zotero digitada aqui vai para o Drive (e vale nos outros computadores)
      obterTokenDrive().then(t => t && sincronizarZoteroComDrive(t)).catch(() => {});

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
    } else {
      if (this.estudoView && typeof this.estudoView.filtrarPorPasta === 'function') {
        this.estudoView.filtrarPorPasta(pastaId);
      }
    }
  }

  renderizarPastasLateral() {
    const listaEl = this.container.querySelector('#athDashPastasLista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    const ehAbaBib = this.abaAtiva === 'artigos_zotero';

    // 1. Item Todas as Pastas (Visão Geral da Aba Ativa)
    const totalItens = ehAbaBib
      ? (this.estudoView?.artigos || carregarArtigosEstudo()).length
      : this.documentos.length;
    const rotuloTodas = ehAbaBib
      ? 'Todas as Bibliografias'
      : 'Todos os Documentos';
    const iconeTodas = ehAbaBib ? 'livro' : 'pasta';

    const itemTodas = document.createElement('div');
    itemTodas.className = `ath-pasta-item ${this.pastaAtivaId === 'todas' ? 'active' : ''}`;
    itemTodas.innerHTML = `
      <div style="display:flex; align-items:center; gap:7px;">
        ${svgIcone(iconeTodas, 15)}
        <span>${rotuloTodas}</span>
      </div>
      <span class="ath-pasta-badge">${totalItens}</span>
    `;
    itemTodas.addEventListener('click', () => this.selecionarPasta('todas'));
    listaEl.appendChild(itemTodas);

    // 2. Seção Minhas Pastas (Google Drive) - Estritamente filtrada por tipo da aba ativa
    const tituloMinhas = document.createElement('div');
    tituloMinhas.className = 'ath-dash-grupo-titulo';
    tituloMinhas.textContent = ehAbaBib
      ? 'Pastas de Bibliografia (Drive)'
      : 'Pastas de Documentos (Drive)';
    listaEl.appendChild(tituloMinhas);

    const minhasPastas = this.pastasDrive.filter(p => {
      if (p.origem === 'compartilhada') return false;
      if (ehAbaBib) {
        return p.tipo === 'bibliografia' || p.id === 'pasta_bib_raiz';
      } else {
        return p.tipo === 'relatorios' || p.id === 'pasta_rel_raiz';
      }
    });

    if (minhasPastas.length === 0) {
      const avisoVazio = document.createElement('div');
      avisoVazio.style.cssText = 'font-size:11px; color:#94A3B8; padding:6px 8px; font-style:italic;';
      avisoVazio.textContent = ehAbaBib ? 'Nenhuma pasta de bibliografia.' : 'Nenhuma pasta de documentos.';
      listaEl.appendChild(avisoVazio);
    } else {
      for (const pasta of minhasPastas) {
        this.montarItemPastaComSubpastas(listaEl, pasta, 0);
      }
    }

    // 3. Seção Pastas Compartilhadas Comigo - Estritamente filtrada por tipo da aba ativa
    const compartilhadas = this.pastasDrive.filter(p => {
      if (p.origem !== 'compartilhada') return false;
      if (ehAbaBib) {
        return p.tipo === 'bibliografia' || p.tipo === 'compartilhada';
      } else {
        return p.tipo === 'relatorios' || p.tipo === 'compartilhada';
      }
    });

    const tituloComp = document.createElement('div');
    tituloComp.className = 'ath-dash-grupo-titulo';
    tituloComp.textContent = 'Compartilhadas Comigo';
    listaEl.appendChild(tituloComp);

    if (!ehAbaBib) {
      const qtd = this.documentos.filter(d => d.compartilhadoComigo).length;
      const itemComigo = document.createElement('div');
      itemComigo.className = `ath-pasta-item ${this.pastaAtivaId === 'compartilhados_comigo' ? 'active' : ''}`;
      itemComigo.innerHTML = `<div style="display:flex; align-items:center; gap:7px;">${svgIcone('usuarios', 15)}<span>Documentos de outras pessoas</span></div><span class="ath-pasta-badge">${qtd}</span>`;
      itemComigo.addEventListener('click', () => this.selecionarPasta('compartilhados_comigo'));
      listaEl.appendChild(itemComigo);
    }

    if (compartilhadas.length === 0) {
      const avisoVazio = document.createElement('div');
      avisoVazio.style.cssText = 'font-size:11px; color:#94A3B8; padding:6px 8px; font-style:italic;';
      avisoVazio.textContent = ehAbaBib
        ? 'Nenhuma pasta de bibliografia compartilhada vinculada.'
        : 'Nenhuma pasta de relatórios compartilhada vinculada.';
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
    
    const ehAbaBib = this.abaAtiva === 'artigos_zotero';
    let count = 0;
    if (ehAbaBib) {
      const artigos = this.estudoView?.artigos || carregarArtigosEstudo();
      count = artigos.filter(a => {
        const pId = a.pastaId || 'pasta_bib_raiz';
        return pId === pasta.id;
      }).length;
    } else {
      count = this.documentos.filter(d => {
        const pId = this.pastaEfetivaDoDoc(d);
        return pId === pasta.id;
      }).length;
    }

    const iconeNome = pasta.icone || (pasta.tipo === 'bibliografia' ? 'livro' : (pasta.tipo === 'relatorios' ? 'documento' : (ehCompartilhada ? 'usuarios' : 'pasta')));
    const prefixo = nivel > 0 ? '↳ ' : '';

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
        ${svgIcone(iconeNome, 14)}
        <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${escapeHtml(pasta.nome)}">${prefixo}${escapeHtml(pasta.nome)}</span>
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
          if (this.abaAtiva === 'escrita') this.atualizarGrid();
          else this.estudoView?.filtrarPorPasta?.(this.pastaAtivaId);
        }
        return;
      }
      this.selecionarPasta(pasta.id);
    });

    container.appendChild(item);
    if (!ehAbaBib) this.arquivos.tornarAlvoDeSolta(item, pasta.id);

    if (Array.isArray(pasta.subpastas) && pasta.subpastas.length > 0) {
      for (const sub of pasta.subpastas) {
        this.montarItemPastaComSubpastas(container, sub, nivel + 1, ehCompartilhada);
      }
    }
  }

  renderizarBannerPasta() {
    const bannerEl = this.container.querySelector('#athDashPastaBanner');
    if (!bannerEl) return;

    const ehAbaBib = this.abaAtiva === 'artigos_zotero';

    if (this.pastaAtivaId === 'todas') {
      if (!ehAbaBib) {
        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            ${svgIcone('pasta', 18)}
            <div>
              <strong style="display:block; font-size:13px; color:#1E293B;">Todas as Pastas de Documentos (Visão Geral)</strong>
              <small style="font-size:11px; color:#64748B;">Exibindo todos os documentos locais e sincronizados (${this.documentos.length} no total)</small>
            </div>
          </div>
        `;
      } else {
        const totalArtigos = (this.estudoView?.artigos || carregarArtigosEstudo()).length;
        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            ${svgIcone('livro', 18)}
            <div>
              <strong style="display:block; font-size:13px; color:#1E293B;">Todas as Pastas de Bibliografia & Leituras</strong>
              <small style="font-size:11px; color:#64748B;">Exibindo todos os artigos, fichamentos e PDFs vinculados (${totalArtigos} no total)</small>
            </div>
          </div>
        `;
      }
    } else {
      const pastaInfo = buscarPastaNaArvore(this.pastasDrive, this.pastaAtivaId) || {
        nome: 'Pasta Selecionada',
        tipo: ehAbaBib ? 'bibliografia' : 'relatorios'
      };

      if (!ehAbaBib) {
        const docsNaPasta = this.documentos.filter(d => {
          const pId = this.pastaEfetivaDoDoc(d);
          return pId === this.pastaAtivaId;
        });

        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            ${svgIcone('pasta', 20)}
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Pasta de Documentos:</span>
                <strong style="font-size:13.5px; color:#314F79; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(pastaInfo.nome)}</strong>
                <span class="ath-badge ath-badge-info" style="font-size:10px;">${pastaInfo.origem === 'compartilhada' ? 'Compartilhada' : 'Minha Pasta'}</span>
              </div>
              <small style="font-size:11px; color:#64748B; display:block; margin-top:1px;">
                ${docsNaPasta.length} documento(s) nesta pasta · Mostrando apenas relatórios e artigos selecionados
              </small>
            </div>
          </div>
        `;
      } else {
        const artigos = this.estudoView?.artigos || carregarArtigosEstudo();
        const artigosNaPasta = artigos.filter(a => {
          const pId = a.pastaId || 'pasta_bib_raiz';
          return pId === this.pastaAtivaId;
        });

        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            ${svgIcone('livro', 20)}
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Pasta de Bibliografia:</span>
                <strong style="font-size:13.5px; color:#314F79; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(pastaInfo.nome)}</strong>
                <span class="ath-badge ath-badge-info" style="font-size:10px;">${pastaInfo.origem === 'compartilhada' ? 'Compartilhada' : 'Minha Pasta'}</span>
              </div>
              <small style="font-size:11px; color:#64748B; display:block; margin-top:1px;">
                ${artigosNaPasta.length} artigo(s) / fichamento(s) nesta pasta · Mostrando apenas bibliografia selecionada
              </small>
            </div>
          </div>
        `;
      }
    }
  }

  abrirModalNovaSubpasta() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';

    const ehAbaBib = this.abaAtiva === 'artigos_zotero';
    const tipoFiltro = ehAbaBib ? 'bibliografia' : 'relatorios';

    const opcoesMae = [];
    function coletarPastas(lista, prefixo = '') {
      for (const p of lista) {
        if (p.tipo === tipoFiltro || (!p.tipo && (ehAbaBib ? p.id === 'pasta_bib_raiz' : p.id === 'pasta_rel_raiz'))) {
          opcoesMae.push({ id: p.id, nome: `${prefixo}${p.nome}`, tipo: p.tipo });
          if (p.subpastas && p.subpastas.length > 0) {
            coletarPastas(p.subpastas, `${prefixo}  ↳ `);
          }
        }
      }
    }
    coletarPastas(this.pastasDrive);

    if (opcoesMae.length === 0) {
      if (ehAbaBib) opcoesMae.push({ id: 'pasta_bib_raiz', nome: 'Bibliografia & Leituras', tipo: 'bibliografia' });
      else opcoesMae.push({ id: 'pasta_rel_raiz', nome: 'Relatórios & Artigos', tipo: 'relatorios' });
    }

    const pastaPreselecionada = (this.pastaAtivaId !== 'todas' && opcoesMae.some(o => o.id === this.pastaAtivaId))
      ? this.pastaAtivaId
      : opcoesMae[0].id;

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
        tipo: pastaMae?.tipo || (this.abaAtiva === 'artigos_zotero' ? 'bibliografia' : 'relatorios')
      });

      fechar();
      // cria no Drive sob a pasta-mãe correspondente e guarda o driveId (falhas aparecem como aviso)
      await this.sincronizarComDrive({ aviso: false, docs: false });
      this.pastasDrive = obterPastasDriveLocais();
      this.selecionarPasta(novaSub.id);
    });
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
          <div class="ath-prop-grupo">
            <label>Sua permissão nesta pasta</label>
            <select class="ath-select" id="athCompPerm">
              <option value="leitura">Somente leitura</option>
              <option value="comentario">Comentar</option>
              <option value="edicao">Edição (pode mover e criar arquivos aqui)</option>
            </select>
          </div>
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Quem Compartilhou</label>
              <input type="text" class="ath-input" id="athCompDono" placeholder="Ex.: Prof. Orientador, Coautor...">
            </div>
            <div class="ath-prop-grupo">
              <label>Tipo de Conteúdo</label>
              <select class="ath-select" id="athCompTipo">
                <option value="relatorios" ${this.abaAtiva === 'escrita' ? 'selected' : ''}>Relatórios & Artigos</option>
                <option value="bibliografia" ${this.abaAtiva === 'artigos_zotero' ? 'selected' : ''}>Bibliografia & Leituras</option>
                <option value="compartilhada">Geral / Ambas as Abas</option>
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
      const permissao = modal.querySelector('#athCompPerm').value;

      const comp = adicionarPastaCompartilhadaDriveLocal({
        id: pastaId,
        nome,
        url: urlOuId.startsWith('http') ? urlOuId : `https://drive.google.com/drive/folders/${pastaId}`,
        dono,
        tipo,
        permissao
      });

      this.pastasDrive = obterPastasDriveLocais();
      fechar();
      this.selecionarPasta(comp.id);
    });
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
        if (this.arquivos.aoClicarCard(ev, doc)) return; // seleção (Ctrl/Shift/checkbox) e menu "···"
        if (ev.target.closest('.ath-btn-excluir')) {
          ev.stopPropagation();
          await this.arquivos.excluir([doc]); // mesmo caminho do menu: confirma, remove, e o documento não volta ao sincronizar
          return;
        }
        await this.abrirDocumento(doc, card);
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
  /**
   * Depois de excluir da lista: lembra a exclusão (a sincronização não traz de volta), leva o arquivo do Drive para a lixeira
   * (recuperável) e apaga a cópia da nuvem. Documentos de outras pessoas só somem da MINHA lista.
   */
  async aposExcluir(docs) {
    registrarExclusoes(docs);
    try {
      const token = driveConectado() ? await obterTokenDrive() : null;
      if (token) await processarExclusoesPendentes(token);
    } catch (e) { console.warn('[Athenes] Lixeira do Drive:', e.message); }
    for (const d of docs) if (d.salvoNuvem && !d.proprietarioExterno && !d.compartilhadoComigo) await excluirDocumentoDoSupabase(d.id);
  }

  /** Documentos que outras pessoas compartilharam com o meu e-mail (o banco só devolve os que posso ver); não depende do Drive. */
  async sincronizarCompartilhados() {
    let novos = 0;
    try {
      const compartilhados = await listarCompartilhadosComigo();
      const ids = new Set(compartilhados.map(c => String(c.id)));
      const excluidos = idsExcluidos();
      for (const c of compartilhados) {
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
    } catch (e) { console.warn('[Athenes] Compartilhados comigo:', e.message); }
    return novos;
  }

  async sincronizarComSupabase(silencioso = false) {
    await this.sincronizarCompartilhados();
    const btn = this.container?.querySelector('#athBtnSincronizarNuvem');
    if (!driveConectado()) {
      if (!silencioso) alert('Conecte o Google Drive (engrenagem → Nuvem & Drive) para ver seus documentos na nuvem. Cada conta enxerga só o próprio Drive.');
      return;
    }
    if (btn && !silencioso) {
      btn.innerHTML = `${svgIcone('nuvem', 14)} Sincronizando...`;
      btn.disabled = true;
    }
    try {
      const token = await obterTokenDrive();
      if (!token) { if (!silencioso) alert('A sessão do Google Drive expirou. Reconecte o Drive.'); return; }
      try { await obterPastaRaizDrive(token); } catch (e) { console.warn('[Athenes] Raiz do Drive:', e.message); } // adota a pasta Athenes mais antiga (a de todos os computadores)
      // outro computador: sem a estrutura gravada, descobre/cria as pastas do Athenes e fixa a pasta de documentos desta conta
      try { const c = obterConfigGoogleDrive(); if (!c.pastaDocumentosId || !c.pastaRaizId) await obterOuCriarEstruturaPastasAthenes(token); } catch (e) { console.warn('[Athenes] Estrutura do Drive:', e.message); }
      try { await processarExclusoesPendentes(token); } catch (e) { console.warn('[Athenes] Lixeira do Drive:', e.message); }
      // Zotero conectado em outro computador desta conta aparece aqui (e o daqui vai para os outros)
      let zotero = 'nada';
      try { zotero = await sincronizarZoteroComDrive(token); } catch (e) { console.warn('[Athenes] Zotero pelo Drive:', e.message); }
      // 1) a estrutura de pastas do Drive (outro computador começa só com as padrão); 2) os documentos, já nas pastas certas
      let pastasNovas = { importadas: 0, vinculadas: 0, mapa: {} };
      try { pastasNovas = await importarPastasDoDrive(token); } catch (e) { console.warn('[Athenes] Pastas do Drive não importadas:', e.message); }
      if (pastasNovas.importadas || pastasNovas.vinculadas) this.pastasDrive = obterPastasDriveLocais();
      const arquivos = await listarBibliotecaDoDrive(token);
      const r = mesclarBibliotecaDrive(this.documentos, arquivos, pastasNovas.mapa, obterPastasDriveLocais());
      const religados = repararPastaDosDocumentos(this.documentos, obterPastasDriveLocais()); // documentos trazidos de outro PC voltam para a pasta certa
      if (religados) r.atualizados += religados;
      if (pastasNovas.importadas || religados) { this.pastasDrive = obterPastasDriveLocais(); this.salvarDocumentosLocais(); this.renderizar(); }
      else if (r.novos || r.atualizados) {
        this.salvarDocumentosLocais();
        this.atualizarGrid();
      }
      // por fim, o caminho de volta: cria no Drive (dentro da raiz Athenes) as pastas que só existem aqui e envia/move os documentos,
      // para a estrutura ficar guardada no Drive e igual nos outros computadores
      let envio = null;
      try { envio = await this.sincronizarComDrive({ aviso: false }); } catch (e) { console.warn('[Athenes] Envio ao Drive:', e.message); }
      if (envio?.rp?.criadas || envio?.rd?.enviados) { this.atualizarGrid(); }
      if (!silencioso) {
        alert(r.novos || r.atualizados
          ? `${zotero === 'baixou' ? 'Zotero conectado trazido do seu Drive. ' : ''}${r.novos} documento(s) novo(s) e ${r.atualizados} atualizado(s)${pastasNovas.importadas ? `, ${pastasNovas.importadas} pasta(s) trazida(s)` : ''} vindos do seu Google Drive.`
          : `${zotero === 'baixou' ? 'Zotero conectado trazido do seu Drive. ' : ''}Seus documentos já estão atualizados com o seu Google Drive.`);
      }
    } catch (err) {
      if (!silencioso) alert(`Não foi possível sincronizar com o Drive: ${err.message}`);
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
      artigosEstudo = JSON.parse(lerConta('athenes_artigos_estudo') || '[]');
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
            const atuais = JSON.parse(lerConta('athenes_artigos_estudo') || '[]');
            for (const art of dados.artigosEstudo) {
              const idx = atuais.findIndex(a => String(a.id) === String(art.id));
              if (idx >= 0) atuais[idx] = art;
              else atuais.push(art);
            }
            gravarConta('athenes_artigos_estudo', JSON.stringify(atuais));
          } catch (_) {}
        }

        if (dados.zoteroCfg && Object.keys(dados.zoteroCfg).length > 0) {
          try {
            gravarConta('athenes_zotero_cfg', JSON.stringify(dados.zoteroCfg));
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
