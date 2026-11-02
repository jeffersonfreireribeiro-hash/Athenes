// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Tela de Login & Identificação Acadêmica.
 * Primeira tela apresentada ao usuário, com suporte a login Google com 1 clique,
 * identificação por nome/papel e persistência de sessão ("Continuar conectado").
 */

import {
  obterPerfilColaborador,
  salvarPerfilColaborador,
  ativarSessao,
  autenticarGoogleDrive,
  obterInfoUsuarioGoogle,
  obterOuCriarEstruturaPastasAthenes,
  obterConfigGoogleDrive
} from '../core/athenes_colaboracao.js';
import { svgIcone } from './athenes_icones.js';
import { escapeHtml } from '../core/athenes_seguranca.js';

export class TelaLoginView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.onLoginSucesso = opcoes.onLoginSucesso || (() => {});
    this.perfil = obterPerfilColaborador();
    this.carregando = false;
    this.mensagemStatus = '';
    this.tipoMensagem = 'info'; // 'info' | 'sucesso' | 'erro'

    this.renderizar();
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'ath-login-pagina';

    const p = this.perfil;
    const continuarConectadoPadrao = p.continuarConectado !== false;

    wrap.innerHTML = `
      <div class="ath-login-card">
        <!-- Cabeçalho com Logo Athenes -->
        <div class="ath-login-header">
          <div class="ath-login-logo-box">
            ${svgIcone('documento', 28)}
          </div>
          <h1>Athenes</h1>
          <p class="ath-login-subtitulo">
            Ambiente Editorial Científico & Redação Acadêmica (ABNT, APA e Zotero)
          </p>
        </div>

        ${this.mensagemStatus ? `
          <div class="ath-login-alerta ${this.tipoMensagem}">
            <span>${escapeHtml(this.mensagemStatus)}</span>
          </div>
        ` : ''}

        <!-- Seção 1: Login com 1 Clique via Google -->
        <div class="ath-login-secao-google">
          <button type="button" class="ath-btn-google-login" id="athBtnGoogleLogin" ${this.carregando ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>${this.carregando ? 'Conectando ao Google...' : 'Entrar com a Conta Google (Gmail)'}</span>
          </button>
        </div>

        <div class="ath-login-divisor">
          <span>ou acesse com identificação acadêmica</span>
        </div>

        <!-- Seção 2: Formulário de Identificação Editorial -->
        <form id="athFormLoginManual" class="ath-login-form">
          <div class="ath-login-campo">
            <label for="athInpLoginNome">Seu Nome / Como deve aparecer nas citações</label>
            <input type="text" id="athInpLoginNome" class="ath-input" value="${escapeHtml(p.nome && p.nome !== 'Autor Principal' ? p.nome : '')}" placeholder="Ex.: Dra. Helena Moreira ou seu nome" required>
          </div>

          <div class="ath-login-linha2">
            <div class="ath-login-campo">
              <label for="athInpLoginEmail">E-mail Acadêmico</label>
              <input type="email" id="athInpLoginEmail" class="ath-input" value="${escapeHtml(p.email || '')}" placeholder="pesquisador@universidade.edu.br">
            </div>

            <div class="ath-login-campo">
              <label for="athSelLoginPapel">Papel no Trabalho</label>
              <select id="athSelLoginPapel" class="ath-select">
                <option value="autor" ${p.papel === 'autor' ? 'selected' : ''}>Autor Principal</option>
                <option value="orientador" ${p.papel === 'orientador' ? 'selected' : ''}>Prof. Orientador / Revisor</option>
                <option value="revisor" ${p.papel === 'revisor' ? 'selected' : ''}>Pesquisador / Coautor</option>
              </select>
            </div>
          </div>

          <div class="ath-login-campo">
            <label for="athInpLoginInstituicao">Instituição de Ensino / Programa de Pós</label>
            <input type="text" id="athInpLoginInstituicao" class="ath-input" value="${escapeHtml(p.instituicao || '')}" placeholder="Ex.: USP / FAU / Laboratório de Conforto Ambiental">
          </div>

          <!-- Opção: Continuar conectado neste dispositivo -->
          <div class="ath-login-lembrar-box">
            <label class="ath-login-checkbox-label">
              <input type="checkbox" id="athChkContinuarConectado" ${continuarConectadoPadrao ? 'checked' : ''}>
              <div class="ath-login-checkbox-texto">
                <strong>Continuar conectado neste dispositivo</strong>
                <span>Entrar diretamente nos seus artigos e relatórios sem pedir identificação novamente.</span>
              </div>
            </label>
          </div>

          <!-- Botão Principal de Entrada -->
          <button type="submit" class="glx-btn glx-btn-primary ath-btn-entrar" id="athBtnEntrarManual" ${this.carregando ? 'disabled' : ''}>
            <span>Entrar no Athenes</span>
            ${svgIcone('seta_direita', 16)}
          </button>
        </form>

        <!-- Rodapé de Privacidade e Segurança Local -->
        <div class="ath-login-rodape">
          <div class="ath-login-seguranca">
            ${svgIcone('seguranca', 14)}
            <span>Seus textos, fichamentos e PDFs permanecem protegidos sob seu controle e no seu próprio Google Drive.</span>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(wrap);

    // Eventos
    const btnGoogle = wrap.querySelector('#athBtnGoogleLogin');
    btnGoogle?.addEventListener('click', () => this.fazerLoginGoogle());

    const form = wrap.querySelector('#athFormLoginManual');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.fazerLoginManual();
    });
  }

  async fazerLoginGoogle() {
    this.carregando = true;
    this.mensagemStatus = 'Abrindo autenticação Google oficial...';
    this.tipoMensagem = 'info';
    this.renderizar();

    try {
      const cfg = obterConfigGoogleDrive();
      const token = await autenticarGoogleDrive(cfg.clientId);

      if (!token) {
        throw new Error('Autenticação Google cancelada.');
      }

      const info = await obterInfoUsuarioGoogle(token).catch(() => null);
      const chkLembrar = this.container.querySelector('#athChkContinuarConectado');
      const continuarConectado = chkLembrar ? chkLembrar.checked : true;

      const p = this.perfil;
      if (info) {
        p.nome = info.name || p.nome || 'Autor Conectado';
        p.email = info.email || p.email;
        p.foto = info.picture;
      }
      p.autenticadoGoogle = true;
      p.conectado = true;
      p.continuarConectado = continuarConectado;
      salvarPerfilColaborador(p);

      // Ativa sessão conforme a escolha do usuário
      ativarSessao(continuarConectado);

      // Tentativa resiliente e silenciosa de criar ou localizar a pasta Athenes no Drive
      try {
        await obterOuCriarEstruturaPastasAthenes(token);
      } catch (errDrive) {
        console.warn('[Athenes] Pasta do Drive será criada ou vinculada posteriormente:', errDrive);
      }

      this.mensagemStatus = `Bem-vindo(a), ${p.nome}! Entrando no Athenes...`;
      this.tipoMensagem = 'sucesso';
      this.renderizar();

      setTimeout(() => {
        this.onLoginSucesso(p);
      }, 350);

    } catch (err) {
      console.warn('[Athenes] Falha ao conectar Google:', err);
      this.carregando = false;
      this.mensagemStatus = err.message || 'Falha ao autenticar com o Google. Tente entrar com identificação acadêmica.';
      this.tipoMensagem = 'erro';
      this.renderizar();
    }
  }

  fazerLoginManual() {
    const nomeInp = this.container.querySelector('#athInpLoginNome');
    const emailInp = this.container.querySelector('#athInpLoginEmail');
    const papelInp = this.container.querySelector('#athSelLoginPapel');
    const instInp = this.container.querySelector('#athInpLoginInstituicao');
    const chkLembrar = this.container.querySelector('#athChkContinuarConectado');

    const nome = nomeInp?.value.trim() || 'Pesquisador';
    const email = emailInp?.value.trim() || '';
    const papel = papelInp?.value || 'autor';
    const instituicao = instInp?.value.trim() || '';
    const continuarConectado = chkLembrar ? chkLembrar.checked : true;

    const p = this.perfil;
    p.nome = nome;
    p.email = email;
    p.papel = papel;
    p.instituicao = instituicao;
    p.conectado = true;
    p.continuarConectado = continuarConectado;
    salvarPerfilColaborador(p);

    ativarSessao(continuarConectado);

    this.onLoginSucesso(p);
  }
}
