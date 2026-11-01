// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Coordenador Principal da Aplicação Web e Roteamento de Telas.
 */

import { DashboardView } from './athenes_dashboard.js';
import { criarDocumento } from '../core/athenes_documento.js';
import { EditorView } from './athenes_editor.js';
import { PainelPropriedades } from './athenes_painel_propriedades.js';
import { PainelZotero } from './athenes_painel_zotero.js';
import { PainelConexoes } from './athenes_painel_conexoes.js';
import { PainelExportarModal } from './athenes_painel_exportar.js';
import { ReguasController } from './athenes_reguas.js';

export class AthenesApp {
  constructor(appContainer) {
    this.container = appContainer;
    this.documentoAtivo = null;
    this.tela = 'dashboard'; // 'dashboard' | 'editor'

    this.dashboardView = null;
    this.editorView = null;
    this.painelProps = null;
    this.painelZotero = null;
    this.painelConexoes = null;
    this.reguas = null;

    this.iniciar();
  }

    iniciar() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tela') === 'editor' || params.get('editor') === '1') {
      try {
        const salvo = localStorage.getItem('athenes_docs_indice');
        const lista = salvo ? JSON.parse(salvo) : [];
        if (lista.length > 0) {
          const docSalvo = localStorage.getItem(`athenes_doc_${lista[0].id}`);
          if (docSalvo) this.documentoAtivo = JSON.parse(docSalvo);
        }
      } catch (_) {}
      if (!this.documentoAtivo) {
        this.documentoAtivo = criarDocumento();
      }
      this.navegarParaEditor();
      return;
    }
    this.navegarParaDashboard();
  }

  navegarParaDashboard() {
    this.tela = 'dashboard';
    this.container.innerHTML = '<div id="athAppDashboard"></div>';
    const dashBox = this.container.querySelector('#athAppDashboard');

    this.dashboardView = new DashboardView(dashBox, {
      onAbrirDocumento: (doc) => {
        this.documentoAtivo = doc;
        this.navegarParaEditor();
      }
    });
  }

  navegarParaEditor() {
    this.tela = 'editor';
    this.container.innerHTML = '<div id="athAppEditor"></div>';
    const editorBox = this.container.querySelector('#athAppEditor');
    this.painelProps = null;

    this.editorView = new EditorView(editorBox, this.documentoAtivo, {
      onAlterado: (doc) => {
        this.documentoAtivo = doc;
        this.autoSalvar();
        if (this.painelProps) this.painelProps.setDocumento(doc);
      },
      onSelecionarBloco: (bloco, pagina) => {
        if (this.painelProps) this.painelProps.setSelecao(bloco, pagina);
      },
      onRenderizado: (inspetorEl) => this.montarPainelProps(inspetorEl),
      onVoltarDashboard: () => {
        this.autoSalvar();
        this.navegarParaDashboard();
      },
      onAbrirExportar: () => {
        new PainelExportarModal(this.documentoAtivo);
      },
      onAbrirZotero: () => {
        this.abrirModalZotero();
      },
      onAbrirConexoes: () => {
        this.abrirModalConexoes();
      }
    });
  }

  /** O editor recria o DOM a cada redesenho; o inspetor é remontado no novo contêiner. */
  montarPainelProps(inspetorEl) {
    if (!inspetorEl) return;
    const editor = this.editorView;
    this.painelProps = new PainelPropriedades(inspetorEl, editor ? editor.doc : this.documentoAtivo, {
      onAlterado: (doc, estrutural) => {
        if (this.editorView) {
          this.editorView.aposAlteracaoExterna(!!estrutural);
          this.documentoAtivo = this.editorView.doc;
        }
        this.autoSalvar();
      },
      onAbrirZotero: () => {
        this.abrirModalZotero();
      }
    });
    if (editor && editor.blocoSelecionado) this.painelProps.setSelecao(editor.blocoSelecionado, null);
  }

  abrirModalZotero() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width: 650px; height: 80vh;">
        <div class="ath-modal-head">
          <h2>Biblioteca Zotero & Fichamento de Leitura</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalZoteroFechar">✕</button>
        </div>
        <div class="ath-modal-corpo" id="athModalZoteroCorpo" style="padding:0; overflow:hidden;"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const fechar = () => modal.remove();
    modal.querySelector('#athModalZoteroFechar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const corpo = modal.querySelector('#athModalZoteroCorpo');
    new PainelZotero(corpo, this.documentoAtivo, {
      onInserirCitacao: (ref) => {
        fechar();
        this.editorView.inserirCitacaoNoCursor(ref);
      },
      onAlterado: () => {
        this.autoSalvar();
      }
    });
  }

  abrirModalConexoes() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width: 950px; height: 85vh;">
        <div class="ath-modal-head">
          <h2>Grafo de Conexões Bibliográficas (Obras, Autores, Temas e Anos)</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalConexoesFechar">✕</button>
        </div>
        <div class="ath-modal-corpo" id="athModalConexoesCorpo" style="padding:16px;"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const fechar = () => modal.remove();
    modal.querySelector('#athModalConexoesFechar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const corpo = modal.querySelector('#athModalConexoesCorpo');
    new PainelConexoes(corpo, this.documentoAtivo);
  }

  autoSalvar() {
    if (!this.documentoAtivo) return;
    this.documentoAtivo.dataModificacao = new Date().toISOString();

    try {
      const salvo = localStorage.getItem('athenes_docs_indice');
      let lista = salvo ? JSON.parse(salvo) : [];
      const idx = lista.findIndex(d => d.id === this.documentoAtivo.id);
      if (idx >= 0) {
        lista[idx] = this.documentoAtivo;
      } else {
        lista.unshift(this.documentoAtivo);
      }
      localStorage.setItem('athenes_docs_indice', JSON.stringify(lista));
    } catch (_) {}
  }
}
