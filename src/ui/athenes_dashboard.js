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
  CORES_COLABORADORES,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive
} from '../core/athenes_colaboracao.js';
import { EstudoArtigosView } from './athenes_estudo_artigos.js';
import { svgIcone, svgLogo } from './athenes_icones.js';

export class DashboardView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.documentos = [];
    this.onAbrirDocumento = opcoes.onAbrirDocumento || (() => {});
    this.onCriarDocumento = opcoes.onCriarDocumento || (() => {});
    this.filtroBusca = '';
    this.filtroTipo = 'todos';
    this.abaAtiva = opcoes.abaInicial || 'escrita'; // 'escrita' | 'artigos_zotero'
    this.perfilUsuario = obterPerfilColaborador();
    this.estudoView = null;

    this.carregarDocumentosLocais();
    this.renderizar();
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

      const docExemplo2 = criarDocumento({
        titulo: 'Relatório Técnico de Diagnóstico Urbanístico e Infraestrutura',
        subtitulo: 'Levantamento de campo, consolidação de parcelas e equipamentos públicos',
        perfilId: 'abnt',
        tipoDoc: 'relatorio'
      });
      docExemplo2.estado = 'rascunho';

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
        <div class="ath-dash-user-box">
          <button type="button" class="ath-dash-user-pill" id="athBtnPerfilLoginDash" title="Clique para identificar quem está usando, trocar perfil ou conectar Google Drive e Zotero">
            <span class="ath-dash-user-avatar" style="background:${this.perfilUsuario.cor || '#314F79'};">${iniciais}</span>
            <span class="ath-dash-user-info">
              <strong>${this.perfilUsuario.nome || 'Autor Principal'}</strong>
              <small>${papelTxt} · ${instituicaoTxt}</small>
            </span>
            <span class="ath-dash-user-edit">${svgIcone('lapis', 12)}</span>
          </button>
        </div>
      </div>

      <!-- Conteúdo da Aba 1: Escrita & Documentos -->
      <section id="athSecaoDashEscrita" ${this.abaAtiva === 'escrita' ? '' : 'hidden'}>
        <header class="ath-dash-head">
          <div class="ath-dash-titulo">
            <h1>Meus Documentos e Artigos</h1>
            <p>Ambiente de escrita e diagramação acadêmica em blocos com revisão estilo Google Docs e sincronia em tempo real.</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <label class="ath-btn" style="cursor:pointer;" title="Importar arquivo .athenes ou .json">
              ${svgIcone('mais', 14)} Importar JSON / Drive
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
        </header>
        <div id="athContainerEstudoArtigos"></div>
      </section>
    `;

    root.querySelectorAll('[data-aba-dash]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaAtiva = btn.dataset.abaDash;
        this.renderizar();
      });
    });

    root.querySelector('#athBtnPerfilLoginDash').addEventListener('click', () => {
      this.abrirModalIdentificacaoLogin();
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

    this.container.appendChild(root);

    if (this.abaAtiva === 'escrita') {
      this.atualizarGrid();
    } else {
      const boxEstudo = root.querySelector('#athContainerEstudoArtigos');
      this.estudoView = new EstudoArtigosView(boxEstudo);
    }
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
          <p style="font-size:12.5px; color:var(--ath-text-secondary); margin-top:0;">
            Defina quem está editando ou revisando neste dispositivo. Seu nome e cor aparecerão nos cursores em tempo real, nos balões de sugestão e nos fichamentos de PDF.
          </p>

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
            <div class="ath-prop-grupo" style="margin-bottom:0;">
              <label style="font-size:11px;">Client ID Google Drive (OAuth)</label>
              <input type="text" class="ath-input" id="athLoginDriveClientId" value="${driveCfg.clientId || ''}" placeholder="Ex.: xxxx.apps.googleusercontent.com" style="height:30px; font-size:11.5px;">
            </div>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athBtnCancelarLogin">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athBtnSalvarLogin">Salvar Identificação & Chaves</button>
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

      const clientIdDrive = modal.querySelector('#athLoginDriveClientId').value.trim();
      if (clientIdDrive !== (driveCfg.clientId || '')) {
        salvarConfigGoogleDrive({ ...driveCfg, clientId: clientIdDrive });
      }

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

  atualizarGrid() {
    const gridEl = this.container.querySelector('#athDocsGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const filtrados = this.documentos.filter(doc => {
      const matchTipo = this.filtroTipo === 'todos' || doc.tipoDoc === this.filtroTipo;
      const str = `${doc.titulo} ${doc.subtitulo} ${doc.metadados?.autores?.map(a => a.nome).join(' ')}`.toLowerCase();
      const matchBusca = !this.filtroBusca || str.includes(this.filtroBusca);
      return matchTipo && matchBusca;
    });

    if (filtrados.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--ath-muted);">
          <p style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Nenhum documento encontrado</p>
          <p style="font-size: 13px; margin: 0;">Clique em "+ Novo Documento" para iniciar um artigo ou relatório.</p>
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

      card.addEventListener('click', (ev) => {
        if (ev.target.closest('.ath-btn-excluir')) {
          ev.stopPropagation();
          this.documentos = this.documentos.filter(d => d.id !== doc.id);
          this.salvarDocumentosLocais();
          this.atualizarGrid();
          return;
        }
        this.onAbrirDocumento(doc);
      });

      gridEl.appendChild(card);
    }
  }

  abrirModalNovoDoc() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';

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

      const novo = criarDocumento({ titulo, subtitulo, tipoDoc, perfilId });
      if (this.perfilUsuario?.nome && novo.metadados?.autores?.[0]) {
        novo.metadados.autores[0].nome = this.perfilUsuario.nome;
      }
      this.documentos.unshift(novo);
      this.salvarDocumentosLocais();
      fechar();
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
}
