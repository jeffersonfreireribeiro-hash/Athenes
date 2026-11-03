// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Coordenador Principal da Aplicação Web e Roteamento de Telas.
 */

import { definirContaAtiva } from '../core/athenes_conta.js';
import * as repositorio from '../core/athenes_repositorio.js';
import { sincronizarPerfil } from '../core/athenes_perfil_servidor.js';
import { montarEstadoLocal } from '../core/athenes_perfil_local.js';
import { DashboardView } from './athenes_dashboard.js';
import { TelaLoginView } from './athenes_login_view.js';
import { estaSessaoAtiva, encerrarSessao, obterPerfilColaborador, salvarDocumentoNoSupabase, nuvemAutenticada } from '../core/athenes_colaboracao.js';
import { criarDocumento } from '../core/athenes_documento.js';
import { carregarDocumentoDoSupabase } from '../core/athenes_colaboracao.js';
import { carregarDocumentoCompartilhado } from '../core/athenes_compartilhamento.js';
import { sanitizarDocumentoImportado } from '../core/athenes_seguranca.js';
import { EditorView } from './athenes_editor.js';
import { PainelPropriedades } from './athenes_painel_propriedades.js';
import { PainelZotero } from './athenes_painel_zotero.js';
import { PainelConexoes } from './athenes_painel_conexoes.js';
import { PainelExportarModal } from './athenes_painel_exportar.js';
import { ReguasController } from './athenes_reguas.js';

import { mostrarAviso } from './athenes_aviso.js';
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
    window.addEventListener('beforeunload', (ev) => {
      this.descarregarSalvamento();
      // nada fica no navegador: se ainda há alteração a caminho do Drive/servidor, o navegador pergunta antes de fechar
      if (this._docPendente || this._tDrive || this._tNuvem || this._enviando > 0) { ev.preventDefault(); ev.returnValue = ''; }
    });
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
    carregarDocumentoCompartilhado(docIdLink).then(res => {
      if (!res) throw new Error('Você não tem acesso a este documento (ou ele não existe). Peça ao dono para compartilhá-lo com o e-mail da sua conta Google.');
      this.documentoAtivo = sanitizarDocumentoImportado(res.doc);
      Object.assign(this.documentoAtivo, { compartilhadoComigo: res.doc.compartilhadoComigo, proprietarioExterno: res.doc.proprietarioExterno, permissao: res.doc.permissao, proprietario: res.doc.proprietario, salvoNuvem: true });
      this.autoSalvar();
      this.navegarParaEditor();
    }).catch(err => {
      alert(`Não foi possível abrir o link: ${err.message}`);
      this.navegarParaDashboard();
    });
  }

  carregarUltimoDocENavegarEditor() {
    // não há mais cópia no navegador: abre o painel, que traz a lista do servidor, e o documento é aberto de lá
    repositorio.carregarLegadoUmaVez();
    const lista = repositorio.listar();
    if (lista.length > 0 && !lista[0].precisaCarregarConteudo) this.documentoAtivo = lista[0];
    if (!this.documentoAtivo) { this.navegarParaDashboard(); return; }
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
      onInserirCitacao: (ref, formato, opcoes) => {
        fechar();
        this.editorView.inserirCitacaoNoCursor(ref, formato, opcoes);
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
      this._tDrive = null;
      this._enviando = (this._enviando || 0) + 1;
      try {
        const token = await obterTokenDrive();
        if (!token) {
          if (!this._avisouReconectar) { this._avisouReconectar = true; mostrarAviso('A conexão com o Google Drive venceu. Abra a página inicial e clique em "Conectar Drive" para voltar a enviar os documentos.', { tipo: 'info' }); }
          return;
        }
        this._avisouReconectar = false;
        await enviarDocumentoAoDrive(doc, token);
        this.autoSalvar({ semDrive: true });
        this.avisarServidorDoPerfil(); // grava driveFileId/driveFolderId sem reagendar nem mudar dataModificacao
      } catch (e) {
        if (e.sessaoExpirada) marcarSessaoDriveExpirada();
        mostrarAviso(`Não foi possível enviar "${doc.titulo}" ao Google Drive: ${e.message}`);
      } finally {
        this._enviando = Math.max(0, (this._enviando || 1) - 1);
      }
    }, 2000);
  }

  /** O índice do perfil no servidor passa a conhecer o arquivo no Drive / a cópia na nuvem (a lista daqui só existe na memória). */
  avisarServidorDoPerfil() {
    if (!nuvemAutenticada()) return;
    clearTimeout(this._tPerfil);
    this._tPerfil = setTimeout(() => { sincronizarPerfil(montarEstadoLocal(repositorio.listar())).catch(e => console.warn('[Athenes] Índice do perfil:', e.message)); }, 600);
  }

  /** Cópia do documento na nuvem protegida (servidor) logo depois da última alteração; só o que a pessoa pode gravar. */
  agendarEnvioNuvem(doc = this.documentoAtivo) {
    if (!doc || !nuvemAutenticada()) return;
    if ((doc.compartilhadoComigo || doc.proprietarioExterno) && doc.permissao === 'leitura') return;
    clearTimeout(this._tNuvem);
    this._tNuvem = setTimeout(async () => {
      this._tNuvem = null;
      this._enviando = (this._enviando || 0) + 1;
      try {
        await salvarDocumentoNoSupabase(doc, obterPerfilColaborador(), undefined, { preservarData: true });
        doc.salvoNuvem = true;
        this.avisarServidorDoPerfil();
      } catch (e) {
        console.warn('[Athenes] Cópia na nuvem:', e.message);
      } finally {
        this._enviando = Math.max(0, (this._enviando || 1) - 1);
      }
    }, 2000);
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

  /**
   * Guarda o documento na lista da sessão (memória) e o leva ao Drive e à nuvem protegida. NADA vai para o armazenamento do
   * navegador. Sem Drive nem nuvem conectados o documento só existe na memória: a pessoa é avisada (uma vez por sessão).
   */
  gravarDocumento(doc, { semDrive = false } = {}) {
    if (!doc) return;
    repositorio.gravarDocumento(doc);
    if (semDrive) return;
    this.agendarEnvioDrive(doc);
    this.agendarEnvioNuvem(doc);
    if (!driveConectado() && !nuvemAutenticada() && !this._avisouSemDestino) {
      this._avisouSemDestino = true;
      mostrarAviso('Este documento ainda não está sendo salvo em lugar nenhum: o Athenes não guarda nada no navegador. Conecte o Google Drive (engrenagem → Nuvem & Drive) ou confirme a conta Google para salvar.', { tipo: 'info' });
    }
  }
}
