// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Janela "Compartilhar": pessoas por e-mail, papel de cada uma (leitura, comentário, edição) e link público de leitura.
 * Só o dono altera; o banco recusa os demais. O documento precisa estar salvo na nuvem protegida.
 */
import { escapeHtml } from '../core/athenes_seguranca.js';
import { PAPEIS, emailValido, normalizarEmail, lerCompartilhamento, salvarCompartilhamento, linkDoDocumento } from '../core/athenes_compartilhamento.js';
import { salvarDocumentoNoSupabase, nuvemAutenticada, entrarNaNuvemComGoogle } from '../core/athenes_colaboracao.js';

const opcoesPapel = (sel) => Object.entries(PAPEIS).map(([id, p]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${p.rotulo}</option>`).join('');

export class ModalCompartilhar {
  constructor(doc, perfil = {}, opcoes = {}) {
    this.doc = doc;
    this.perfil = perfil;
    this.aoSalvar = opcoes.aoSalvar || (() => {});
    this.pessoas = {};
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
          <button type="button" class="ath-btn ath-btn-icon" data-fechar aria-label="Fechar">✕</button>
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
      await salvarDocumentoNoSupabase(this.doc, this.perfil); // o documento precisa existir na nuvem para ter dono e convidados
      const info = await lerCompartilhamento(this.doc.id);
      if (!info) throw new Error('O documento não foi encontrado na nuvem.');
      this.dono = info.papel === 'dono';
      this.pessoas = { ...info.permissoes };
      for (const e of info.compartilhado_com) if (!this.pessoas[e]) this.pessoas[e] = 'leitura';
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
        <select class="ath-select" data-papel style="width:120px; height:30px;" ${somenteLeitura ? 'disabled' : ''}>${opcoesPapel(papel)}</select>
        <button type="button" class="ath-btn ath-btn-icon" data-remover title="Remover acesso" ${somenteLeitura ? 'disabled' : ''}>✕</button>
      </div>`).join('') || '<p style="margin:0; font-size:12px; color:#64748B;">Ninguém além de você tem acesso.</p>';
    this.corpo.innerHTML = `
      ${somenteLeitura ? '<p style="margin:0; font-size:12px; color:#92400E; background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:6px 10px;">Só o dono do documento altera quem tem acesso.</p>' : ''}
      <div style="display:flex; flex-direction:column; gap:6px;" id="athCompLista">${linhas}</div>
      ${somenteLeitura ? '' : `
      <div style="display:flex; gap:6px;">
        <input type="email" class="ath-input" id="athCompEmail" placeholder="e-mail da pessoa (conta Google)" style="flex:1; height:30px;">
        <select class="ath-select" id="athCompNovoPapel" style="width:120px; height:30px;">${opcoesPapel('leitura')}</select>
        <button type="button" class="ath-btn" id="athCompAdd" style="height:30px;">Adicionar</button>
      </div>
      <small id="athCompMsg" style="min-height:14px; color:#B42318;"></small>`}
      <div style="font-size:11px; color:#64748B; line-height:1.4;">${Object.entries(PAPEIS).map(([, p]) => `<b>${p.rotulo}</b>: ${p.descricao}`).join(' · ')}</div>
      <label style="display:flex; gap:8px; align-items:flex-start; font-size:12px; ${somenteLeitura ? 'opacity:.7;' : ''}">
        <input type="checkbox" id="athCompPublico" ${this.publico ? 'checked' : ''} ${somenteLeitura ? 'disabled' : ''} style="margin-top:2px;">
        <span>Qualquer pessoa com o link pode <b>ler</b> (precisa entrar com uma conta Google). Desligado por padrão.</span>
      </label>
      <div style="display:flex; gap:6px;">
        <input type="text" class="ath-input" id="athCompLink" readonly value="${escapeHtml(linkDoDocumento(this.doc.id))}" style="flex:1; height:30px; font-size:11.5px;">
        <button type="button" class="ath-btn" id="athCompCopiar" style="height:30px;">Copiar link</button>
      </div>
      <small style="color:#64748B;">O link só abre para quem você adicionou acima${this.publico ? ' (ou para qualquer pessoa, com a leitura pública ligada)' : ''}.</small>`;
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
    c.querySelector('#athCompCopiar')?.addEventListener('click', async (e) => {
      const link = c.querySelector('#athCompLink').value;
      try { await navigator.clipboard.writeText(link); e.currentTarget.textContent = 'Copiado ✓'; } catch (_) { window.prompt('Copie o link:', link); }
    });
    this.btnSalvar.onclick = async () => {
      this.btnSalvar.disabled = true; this.btnSalvar.textContent = 'Salvando…';
      try {
        await salvarCompartilhamento(this.doc.id, { pessoas: this.pessoas, publico: this.publico });
        this.aoSalvar({ pessoas: { ...this.pessoas }, publico: this.publico });
        this.btnSalvar.textContent = 'Salvo ✓';
        setTimeout(() => { this.btnSalvar.textContent = 'Salvar acesso'; this.btnSalvar.disabled = false; }, 1200);
      } catch (err) {
        const msg = c.querySelector('#athCompMsg'); if (msg) msg.textContent = err.message;
        this.btnSalvar.textContent = 'Salvar acesso'; this.btnSalvar.disabled = false;
      }
    };
  }
}
