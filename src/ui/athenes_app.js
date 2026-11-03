// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Coordenador Principal da Aplicação Web e Roteamento de Telas.
 */

import { lerConta, gravarConta, definirContaAtiva } from '../core/athenes_conta.js';
import { DashboardView } from './athenes_dashboard.js';
import { TelaLoginView } from './athenes_login_view.js';
import { estaSessaoAtiva, encerrarSessao, obterPerfilColaborador } from '../core/athenes_colaboracao.js';
import { criarDocumento } from '../core/athenes_documento.js';
import { carregarDocumentoDoSupabase } from '../core/athenes_colaboracao.js';
import { sanitizarDocumentoImportado } from '../core/athenes_seguranca.js';
import { EditorView } from './athenes_editor.js';
import { PainelPropriedades } from './athenes_painel_propriedades.js';
import { PainelZotero } from './athenes_painel_zotero.js';
import { PainelConexoes } from './athenes_painel_conexoes.js';
import { PainelExportarModal } from './athenes_painel_exportar.js';
import { ReguasController } from './athenes_reguas.js';

import { mostrarAviso, eErroDeCota } from './athenes_aviso.js';
import { driveConectado, enviarDocumentoAoDrive, marcarSessaoDriveExpirada, obterTokenDrive } from '../core/athenes_drive_sync.js';
import { obterConfigGoogleDrive } from '../core/athenes_colaboracao.js';

export class AthenesApp {
  constructor(appContainer) {
    this.container = appContainer;
    // o salvamento é adiado alguns instantes (ver autoSalvar); ao sair da aba/página o que está pendente é gravado na hora
    this._tSalvar = null;
    this._docPendente = null;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.descarregarSalvamento(); });
    window.addEventListener('pagehide', () => this.descarregarSalvamento());
    window.addEventListener('beforeunload', () => this.descarregarSalvamento());
    this.documentoAtivo = null;
    this.tela = 'dashboard'; // 'dashboard' | 'editor'

    this.loginView = null;
    this.dashboardView = null;
    this.editorView = null;
    this.painelProps = null;
    this.painelZotero = null;
    this.painelConexoes = null;
    this.reguas = null;

    if (estaSessaoAtiva()) definirContaAtiva(obterPerfilColaborador()); // já conectado: os dados lidos a seguir são os desta conta
    this.iniciar();
  }

  iniciar() {
    const params = new URLSearchParams(window.location.search);
    const docIdLink = params.get('doc');
    const forcarLogin = params.get('login') === '1';

    // A primeira coisa exibida ao acessar o site é a tela de login (a menos que já esteja conectado)
    if (!forcarLogin && estaSessaoAtiva()) {
      if (docIdLink) {
        this.abrirDocumentoCompartilhado(docIdLink);
        return;
      }
      if (params.get('tela') === 'editor' || params.get('editor') === '1') {
        this.carregarUltimoDocENavegarEditor();
        return;
      }
      this.navegarParaDashboard();
      return;
    }

    // Primeira tela no site: Login com opção de continuar conectado
    this.navegarParaLogin(docIdLink);
  }

  abrirDocumentoCompartilhado(docIdLink) {
    this.container.innerHTML = '<p style="padding:32px; font:600 14px Nunito, sans-serif; color:#314F79;">Abrindo documento compartilhado...</p>';
    carregarDocumentoDoSupabase(docIdLink).then(remoto => {
      if (!remoto) throw new Error('Documento não encontrado na nuvem.');
      this.documentoAtivo = sanitizarDocumentoImportado(remoto);
      this.autoSalvar();
      this.navegarParaEditor();
    }).catch(err => {
      alert(`Não foi possível abrir o link: ${err.message}`);
      this.navegarParaDashboard();
    });
  }

  carregarUltimoDocENavegarEditor() {
    try {
      const salvo = lerConta('athenes_docs_indice');
      const lista = salvo ? JSON.parse(salvo) : [];
      if (lista.length > 0) {
        const docSalvo = localStorage.getItem(`athenes_doc_${lista[0].id}`);
        if (docSalvo) this.documentoAtivo = JSON.parse(docSalvo);
        else this.documentoAtivo = lista[0];
      }
    } catch (_) {}
    if (!this.documentoAtivo) {
      this.documentoAtivo = criarDocumento();
    }
    this.navegarParaEditor();
  }

  navegarParaLogin(docIdLink = null) {
    this.descarregarSalvamento();
    this.documentoAtivo = null; // o documento da conta que saiu não pode ser gravado na conta seguinte
    document.querySelectorAll('.ath-modal-backdrop').forEach(m => m.remove());
    this.tela = 'login';
    this.container.innerHTML = '<div id="athAppLogin"></div>';
    const loginBox = this.container.querySelector('#athAppLogin');

    this.loginView = new TelaLoginView(loginBox, {
      onLoginSucesso: () => {
        if (docIdLink) {
          this.abrirDocumentoCompartilhado(docIdLink);
        } else {
          this.navegarParaDashboard();
        }
      }
    });
  }

  fazerLogout() {
    encerrarSessao();
    document.querySelectorAll('.ath-modal-backdrop').forEach(m => m.remove());
    try {
      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('tela');
        url.searchParams.delete('editor');
        url.searchParams.delete('doc');
        url.searchParams.delete('login');
        window.history.replaceState(null, '', url.pathname);
      }
    } catch (_) {}
    this.navegarParaLogin();
  }

  navegarParaDashboard() {
    this.descarregarSalvamento(); // o painel lê os documentos do armazenamento: grava antes o que ainda estava pendente
    this.editorView?.desmontarAtalhos?.(); // remove os listeners globais do editor que está saindo
    this.tela = 'dashboard';
    this.container.innerHTML = '<div id="athAppDashboard"></div>';
    const dashBox = this.container.querySelector('#athAppDashboard');

    this.dashboardView = new DashboardView(dashBox, {
      onAbrirDocumento: (doc) => {
        this.documentoAtivo = sanitizarDocumentoImportado(doc);
        this.navegarParaEditor();
      },
      onLogout: () => {
        this.fazerLogout();
      }
    });
  }

  navegarParaEditor() {
    this.editorView?.desmontarAtalhos?.();
    this.tela = 'editor';
    this.container.innerHTML = '<div id="athAppEditor"></div>';
    const editorBox = this.container.querySelector('#athAppEditor');
    this.painelProps = null;

    this.editorView = new EditorView(editorBox, this.documentoAtivo, {
      onAlterado: (doc) => {
        this.documentoAtivo = doc;
        this.autoSalvar();
        if (this.painelProps) {
          this.painelProps.doc = doc;
        }
      },
      onSelecionarBloco: (bloco, pagina) => {
        if (this.painelProps) this.painelProps.setSelecao(bloco, pagina);
      },
      onEditarEstilo: (estilo) => {
        if (this.painelProps) this.painelProps.setEstilo(estilo);
      },
      onRenderizado: (inspetorEl) => this.montarPainelProps(inspetorEl),
      onVoltarDashboard: () => {
        this.autoSalvar();
        this.navegarParaDashboard();
      },
      onLogout: () => {
        this.fazerLogout();
      },
      onAbrirExportar: () => {
        new PainelExportarModal(this.documentoAtivo);
      },
      onDividirBloco: (bloco) => {
        if (this.editorView) this.editorView.dividirBlocoAtual(bloco?.id);
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
      onDividirBloco: (bloco) => {
        if (this.editorView) this.editorView.dividirBlocoAtual(bloco?.id);
      },
      onAbrirZotero: () => {
        this.abrirModalZotero();
      }
    });
    if (editor && editor.blocoSelecionado) {
      this.painelProps.setSelecao(editor.blocoSelecionado, null);
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
      onInserirCitacao: (ref, formato) => {
        fechar();
        this.editorView.inserirCitacaoNoCursor(ref, formato);
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

  /** Com o Drive conectado, o documento sobe (na pasta dele) alguns segundos depois da última alteração. */
  agendarEnvioDrive(doc = this.documentoAtivo) {
    if (!driveConectado() || !doc) return;
    clearTimeout(this._tDrive);
    this._tDrive = setTimeout(async () => {
      try {
        const token = await obterTokenDrive();
        if (!token) {
          if (!this._avisouReconectar) { this._avisouReconectar = true; mostrarAviso('A conexão com o Google Drive venceu. Abra a página inicial e clique em "Conectar Drive" para voltar a enviar os documentos.', { tipo: 'info' }); }
          return;
        }
        this._avisouReconectar = false;
        await enviarDocumentoAoDrive(doc, token);
        this.autoSalvar({ semDrive: true }); // grava driveFileId/driveFolderId sem reagendar nem mudar dataModificacao
      } catch (e) {
        if (e.sessaoExpirada) marcarSessaoDriveExpirada();
        mostrarAviso(`Não foi possível enviar "${doc.titulo}" ao Google Drive: ${e.message}`);
      }
    }, 4000);
  }

  /**
   * Marca o documento como alterado e agenda a gravação. Serializar e gravar a lista inteira (vários MB com imagens) a cada
   * tecla custava ~30 ms síncronos; agora a digitação só carimba a data e a gravação acontece ~400 ms depois da última alteração.
   */
  autoSalvar({ semDrive = false, imediato = false } = {}) {
    if (!this.documentoAtivo) return;
    if (semDrive || imediato) { this.descarregarSalvamento(); this.gravarDocumento(this.documentoAtivo, { semDrive }); return; }
    this.documentoAtivo.dataModificacao = new Date().toISOString();
    this._docPendente = this.documentoAtivo;
    clearTimeout(this._tSalvar);
    this._tSalvar = setTimeout(() => this.descarregarSalvamento(), 400);
  }

  /** Grava agora o que estiver pendente (troca de tela, aba oculta, fechamento da página). */
  descarregarSalvamento() {
    clearTimeout(this._tSalvar);
    this._tSalvar = null;
    let doc = this._docPendente;
    this._docPendente = null;
    // um snapshot de colaboração troca `editorView.doc` sem passar por onAlterado: gravar o objeto antigo sobrescreveria o mais novo
    const doEditor = this.editorView?.doc;
    if (doc && doEditor && doEditor.id === doc.id && doEditor !== doc) {
      doc = doEditor;
      if (this.documentoAtivo?.id === doc.id) this.documentoAtivo = doc;
    }
    if (doc) this.gravarDocumento(doc, { semDrive: false });
  }

  gravarDocumento(doc, { semDrive = false } = {}) {
    if (!doc) return;
    try {
      const salvo = lerConta('athenes_docs_indice');
      let lista = salvo ? JSON.parse(salvo) : [];
      const idx = lista.findIndex(d => d.id === doc.id);
      if (idx >= 0) {
        lista[idx] = doc;
      } else {
        lista.unshift(doc);
      }
      gravarConta('athenes_docs_indice', JSON.stringify(lista));
      if (!semDrive) this.agendarEnvioDrive(doc);
    } catch (e) {
      // antes falhava em silêncio e o documento voltava sem as alterações ao reabrir
      mostrarAviso(eErroDeCota(e)
        ? 'Não foi possível salvar: o armazenamento do navegador está cheio (imagens grandes ocupam muito espaço). Faça um backup, exclua documentos antigos ou use imagens menores.'
        : `Não foi possível salvar o documento neste navegador: ${e.message}`);
    }
  }
}
