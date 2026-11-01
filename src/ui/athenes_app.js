// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Coordenador Principal da Aplicação Web e Roteamento de Telas.
 */

import { DashboardView } from './athenes_dashboard.js';
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

    this.editorView = new EditorView(editorBox, this.documentoAtivo, {
      onAlterado: (doc) => {
        this.documentoAtivo = doc;
        this.autoSalvar();
        if (this.painelProps) this.painelProps.setDocumento(doc);
      },
      onSelecionarBloco: (bloco, pagina) => {
        if (this.painelProps) {
          this.painelProps.setSelecao(bloco, pagina);
        }
      },
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

    // Inicializa régua horizontal
    const reguaCanvas = editorBox.querySelector('#athReguaH');
    const stage = editorBox.querySelector('#athCanvasStage');
    if (reguaCanvas) {
      this.reguas = new ReguasController(reguaCanvas, stage);
    }

    // Inicializa painel de propriedades na lateral direita
    const inspectorContainer = editorBox.querySelector('#athInspectorContainer');
    if (inspectorContainer) {
      this.painelProps = new PainelPropriedades(inspectorContainer, this.documentoAtivo, {
        onAlterado: () => {
          this.editorView.renderizarFolhasPaginas();
          this.autoSalvar();
        }
      });
    }
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
