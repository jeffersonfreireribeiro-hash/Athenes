// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Área Inicial / Dashboard de Documentos em Andamento.
 */

import { TIPOS_DOCUMENTO, criarDocumento } from '../core/athenes_documento.js';
import { PERFIS_FORMATACAO } from '../core/athenes_estilos.js';
import { svgIcone } from './athenes_icones.js';

export class DashboardView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.documentos = [];
    this.onAbrirDocumento = opcoes.onAbrirDocumento || (() => {});
    this.onCriarDocumento = opcoes.onCriarDocumento || (() => {});
    this.filtroBusca = '';
    this.filtroTipo = 'todos';

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

    // Se estiver vazio, gera 2 documentos de exemplo (Artigo ABNT e Relatório Técnico)
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

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'ath-dashboard';

    root.innerHTML = `
      <header class="ath-dash-head">
        <div class="ath-dash-titulo">
          <h1>Meus Documentos e Artigos</h1>
          <p>Ambiente de escrita e diagramação acadêmica em blocos baseado no Clux.js.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <label class="ath-btn" style="cursor:pointer;" title="Importar arquivo .athenes.json">
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
    `;

    // Eventos
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
    this.atualizarGrid();
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
      const autorPrincipal = doc.metadados?.autores?.[0]?.nome || 'Autor Principal';

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
          if (confirm(`Deseja realmente excluir "${doc.titulo}"?`)) {
            this.documentos = this.documentos.filter(d => d.id !== doc.id);
            this.salvarDocumentosLocais();
            this.atualizarGrid();
          }
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
        if (json && json.paginas && Array.isArray(json.paginas)) {
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
