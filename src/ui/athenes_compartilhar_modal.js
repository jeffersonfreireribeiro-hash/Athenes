// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Janela "Compartilhar": pessoas por e-mail, papel de cada uma (leitura, comentário, edição) e link público de leitura.
 * Só o dono altera; o banco recusa os demais. O documento precisa estar salvo na nuvem protegida.
 */
import { escapeHtml } from '../core/athenes_seguranca.js';
import { PAPEIS, emailValido, normalizarEmail, lerCompartilhamento, salvarCompartilhamento, linkDoDocumento } from '../core/athenes_compartilhamento.js';
import { salvarDocumentoNoSupabase, nuvemAutenticada, entrarNaNuvemComGoogle, autenticarGoogleDrive, obterConfigGoogleDrive, GOOGLE_AUTH_ESCOPOS } from '../core/athenes_colaboracao.js';
import { conviteDocumento, enviarConviteGmail, ESCOPO_GMAIL_ENVIO } from '../core/athenes_convites_email.js';
import { svgIcone } from './athenes_icones.js';

// campos de formulário da janela: altura única, texto sem corte e sem a aparência de pílula do tema
const CAMPO = 'height:34px; box-sizing:border-box; padding:0 12px; border:1px solid #CBD5E1; border-radius:8px; background:#fff; font:500 13px var(--glx-font, system-ui); color:#1F2733; line-height:normal;';
const opcoesPapel = (sel) => Object.entries(PAPEIS).map(([id, p]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${p.rotulo}</option>`).join('');

export class ModalCompartilhar {
  constructor(doc, perfil = {}, opcoes = {}) {
    this.doc = doc;
    this.perfil = perfil;
    this.aoSalvar = opcoes.aoSalvar || (() => {});
    this.pessoas = {};
    this.pessoasOriginais = {};
    this.notificarEmail = true;
    this.publico = false;
    this.dono = true;
    this.abrir();
  }

  async abrir() {
    const fundo = document.createElement('div');
    fundo.className = 'ath-modal-backdrop';
    fundo.innerHTML = `
      <div class="ath-modal" style="max-width:460px;" role="dialog" aria-modal="true" aria-label="Compartilhar documento">
        <div class="ath-modal-head">
          <h2>Compartilhar “${escapeHtml(this.doc.titulo || 'Documento')}”</h2>
          <button type="button" class="ath-btn ath-btn-icon" data-fechar aria-label="Fechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo" id="athCompBody" style="display:flex; flex-direction:column; gap:10px;">
          <p style="margin:0; font-size:12px; color:var(--ath-text-secondary);">Preparando o documento na nuvem…</p>
        </div>
        <div class="ath-modal-foot" style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="ath-btn" data-fechar>Fechar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athCompSalvar" disabled>Salvar acesso</button>
        </div>
      </div>`;
    document.body.appendChild(fundo);
    this.fundo = fundo;
    fundo.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => fundo.remove()));
    this.corpo = fundo.querySelector('#athCompBody');
    this.btnSalvar = fundo.querySelector('#athCompSalvar');
    try {
      if (!nuvemAutenticada()) { this.mostrarLogin(); return; }
      try {
        await salvarDocumentoNoSupabase(this.doc, this.perfil); // o documento precisa existir na nuvem para ter dono e convidados
      } catch (errSave) {
        // Se houver violação de RLS (42501) por colisão de ID pré-existente na tabela do Supabase com outro dono:
        if (String(errSave?.message || '').includes('42501') || String(errSave?.message || '').includes('row-level security')) {
          this.doc.id = `${this.doc.id}_${Math.random().toString(36).slice(2, 7)}`;
          if (this.doc.artigoEstudo) {
            this.doc.artigoEstudo.docCompartilhadoId = this.doc.id;
          }
          await salvarDocumentoNoSupabase(this.doc, this.perfil);
        } else {
          throw errSave;
        }
      }
      const info = await lerCompartilhamento(this.doc.id);
      if (!info) throw new Error('O documento não foi encontrado na nuvem.');
      this.dono = info.papel === 'dono';
      this.pessoas = { ...info.permissoes };
      for (const e of info.compartilhado_com) if (!this.pessoas[e]) this.pessoas[e] = 'leitura';
      this.pessoasOriginais = { ...this.pessoas };
      this.publico = Boolean(info.publico_leitura);
      this.desenhar();
    } catch (err) {
      this.corpo.innerHTML = `<p style="margin:0; font-size:12.5px; color:#B42318;">${escapeHtml(err.message)}</p>`;
    }
  }

  mostrarLogin() {
    this.corpo.innerHTML = `
      <p style="margin:0; font-size:12.5px; color:#334155;">Para compartilhar, confirme a sua conta Google: é ela que protege o acesso aos documentos na nuvem.</p>
      <button type="button" class="ath-btn ath-btn-primary" id="athCompEntrar">Confirmar conta Google</button>
      <small id="athCompErro" style="color:#B42318;"></small>`;
    this.corpo.querySelector('#athCompEntrar').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try { await entrarNaNuvemComGoogle(); this.fundo.remove(); new ModalCompartilhar(this.doc, this.perfil, { aoSalvar: this.aoSalvar }); }
      catch (err) { this.corpo.querySelector('#athCompErro').textContent = err.message; e.currentTarget.disabled = false; }
    });
  }

  desenhar() {
    const somenteLeitura = !this.dono;
    const linhas = Object.entries(this.pessoas).map(([email, papel]) => `
      <div style="display:flex; align-items:center; gap:6px;" data-pessoa="${escapeHtml(email)}">
        <span style="flex:1; min-width:0; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(email)}">${escapeHtml(email)}</span>
        <select class="ath-select" data-papel aria-label="Papel de ${escapeHtml(email)}" style="${CAMPO} width:130px; flex:none;" ${somenteLeitura ? 'disabled' : ''}>${opcoesPapel(papel)}</select>
        <button type="button" class="ath-btn ath-btn-icon" data-remover title="Remover acesso" aria-label="Remover acesso" style="flex:none;" ${somenteLeitura ? 'disabled' : ''}>✕</button>
      </div>`).join('') || '<p style="margin:0; font-size:12px; color:#64748B;">Ninguém além de você tem acesso.</p>';
    this.corpo.innerHTML = `
      ${somenteLeitura ? '<p style="margin:0; font-size:12px; color:#92400E; background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:6px 10px;">Só o dono do documento altera quem tem acesso.</p>' : ''}
      <div style="display:flex; flex-direction:column; gap:6px;" id="athCompLista">${linhas}</div>
      ${somenteLeitura ? '' : `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <input type="email" class="ath-input" id="athCompEmail" placeholder="E-mail da pessoa (conta Google)" autocomplete="off" style="${CAMPO} width:100%;">
        <div style="display:flex; gap:6px;">
          <select class="ath-select" id="athCompNovoPapel" aria-label="Papel" style="${CAMPO} flex:1; min-width:0;">${opcoesPapel('leitura')}</select>
          <button type="button" class="ath-btn ath-btn-primary" id="athCompAdd" style="height:34px; padding:0 16px; white-space:nowrap;">Adicionar</button>
        </div>
      </div>
      <small id="athCompMsg" style="min-height:14px; color:#B42318;"></small>`}
      <div style="font-size:11px; color:#64748B; line-height:1.4;">${Object.entries(PAPEIS).map(([, p]) => `<b>${p.rotulo}</b>: ${p.descricao}`).join(' · ')}</div>
      <label style="display:flex; gap:8px; align-items:flex-start; font-size:12px; ${somenteLeitura ? 'opacity:.7;' : ''}">
        <input type="checkbox" id="athCompPublico" ${this.publico ? 'checked' : ''} ${somenteLeitura ? 'disabled' : ''} style="margin-top:2px;">
        <span>Qualquer pessoa com o link pode <b>ler</b> (precisa entrar com uma conta Google). Desligado por padrão.</span>
      </label>
      <div style="display:flex; gap:6px;">
        <input type="text" class="ath-input" id="athCompLink" readonly value="${escapeHtml(linkDoDocumento(this.doc.id))}" style="${CAMPO} flex:1; min-width:0; font-size:11.5px; background:#F1F5F9;">
        <button type="button" class="ath-btn" id="athCompCopiar" style="height:34px; padding:0 14px; white-space:nowrap; flex:none;">Copiar link</button>
      </div>
      <small style="color:#64748B;">O link só abre para quem você adicionou acima${this.publico ? ' (ou para qualquer pessoa, com a leitura pública ligada)' : ''}.</small>`;
    if (!somenteLeitura) this.corpo.insertAdjacentHTML('beforeend', `<label style="display:flex;align-items:center;gap:8px;font-size:12px;"><input type="checkbox" id="athCompNotificar" ${this.notificarEmail ? 'checked' : ''}> Avisar novas pessoas por e-mail</label>`);
    this.btnSalvar.disabled = somenteLeitura;
    this.ligar();
  }

  ligar() {
    const c = this.corpo;
    c.querySelectorAll('[data-pessoa]').forEach(linha => {
      const email = linha.dataset.pessoa;
      linha.querySelector('[data-papel]')?.addEventListener('change', (e) => { this.pessoas[email] = e.target.value; });
      linha.querySelector('[data-remover]')?.addEventListener('click', () => { delete this.pessoas[email]; this.desenhar(); });
    });
    const adicionar = () => {
      const msg = c.querySelector('#athCompMsg'); const campo = c.querySelector('#athCompEmail');
      const email = normalizarEmail(campo.value);
      if (!emailValido(email)) { msg.textContent = 'Digite um e-mail válido.'; return; }
      this.pessoas[email] = c.querySelector('#athCompNovoPapel').value;
      this.desenhar();
    };
    c.querySelector('#athCompAdd')?.addEventListener('click', adicionar);
    c.querySelector('#athCompEmail')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
    c.querySelector('#athCompPublico')?.addEventListener('change', (e) => { this.publico = e.target.checked; });
    c.querySelector('#athCompNotificar')?.addEventListener('change', (e) => { this.notificarEmail = e.target.checked; });
    c.querySelector('#athCompCopiar')?.addEventListener('click', async (e) => {
      const link = c.querySelector('#athCompLink').value;
      try { await navigator.clipboard.writeText(link); e.currentTarget.textContent = 'Copiado ✓'; } catch (_) { window.prompt('Copie o link:', link); }
    });
    this.btnSalvar.onclick = async () => {
      this.btnSalvar.disabled = true; this.btnSalvar.textContent = 'Salvando…';
      try {
        c.querySelector('[data-email-convite-fallback]')?.remove();
        const novos = Object.keys(this.pessoas).filter(email => !Object.hasOwn(this.pessoasOriginais, email));
        let tokenEmail = null;
        if (novos.length && this.notificarEmail && this.perfil.autenticadoGoogle) {
          try {
            tokenEmail = await autenticarGoogleDrive(obterConfigGoogleDrive().clientId, `${GOOGLE_AUTH_ESCOPOS} ${ESCOPO_GMAIL_ENVIO}`);
            const conta = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenEmail}` } });
            const info = conta.ok ? await conta.json() : null;
            if (normalizarEmail(info?.email) !== normalizarEmail(this.perfil.email)) throw new Error('A conta Google autorizada é diferente da conta que compartilhou.');
          }
          catch (e) { tokenEmail = null; console.warn('[Athenes] Autorização de convite por e-mail:', e.message); }
        }
        await salvarCompartilhamento(this.doc.id, { pessoas: this.pessoas, publico: this.publico });
        await this.aoSalvar({ pessoas: { ...this.pessoas }, publico: this.publico });
        this.pessoasOriginais = { ...this.pessoas };
        const pendentes = [];
        if (novos.length && this.notificarEmail) {
          for (const email of novos) {
            const convite = conviteDocumento({ email, titulo: this.doc.titulo, docId: this.doc.id, dono: this.perfil.nome });
            if (tokenEmail) {
              try { await enviarConviteGmail(convite, tokenEmail); continue; }
              catch (e) { console.warn('[Athenes] Envio do convite:', e.message); }
            }
            pendentes.push(convite);
          }
        }
        const msg = c.querySelector('#athCompMsg');
        if (msg) {
          msg.textContent = pendentes.length ? `Acesso salvo. ${pendentes.length} convite(s) aguardando envio pelo seu aplicativo de e-mail.` : (novos.length && this.notificarEmail ? 'Acesso salvo e convite(s) enviado(s) por e-mail.' : 'Acesso salvo.');
          for (const convite of pendentes) {
            const botao = document.createElement('button');
            botao.type = 'button'; botao.className = 'ath-btn ath-btn-sm'; botao.dataset.emailConviteFallback = '';
            botao.textContent = `Abrir convite para ${convite.destinatario}`;
            botao.addEventListener('click', () => {
              window.location.href = `mailto:${convite.destinatario}?subject=${encodeURIComponent(convite.assunto)}&body=${encodeURIComponent(convite.corpo)}`;
            });
            msg.after(botao);
          }
        }
        this.btnSalvar.textContent = 'Salvo ✓';
        setTimeout(() => { this.btnSalvar.textContent = 'Salvar acesso'; this.btnSalvar.disabled = false; }, 1200);
      } catch (err) {
        const msg = c.querySelector('#athCompMsg'); if (msg) msg.textContent = err.message;
        this.btnSalvar.textContent = 'Salvar acesso'; this.btnSalvar.disabled = false;
      }
    };
  }
}
