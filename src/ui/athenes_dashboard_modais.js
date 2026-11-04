// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Dashboard: janelas de identificação/login, nova subpasta, vincular pasta e backup do espaço.
 * Métodos da classe DashboardView (usam `this`); são acrescentados ao prototype em athenes_dashboard.js.
 */
import { lerConta, gravarConta } from '../core/athenes_conta.js';
import { obterPerfilColaborador, salvarPerfilColaborador, encerrarSessao, CORES_COLABORADORES, obterConfigGoogleDrive, entrarNaNuvemComGoogle, nuvemAutenticada, autenticarGoogleDrive, obterInfoUsuarioGoogle, obterOuCriarEstruturaPastasAthenes, obterPastasDriveLocais, adicionarSubpastaDriveLocal, adicionarPastaCompartilhadaDriveLocal, buscarPastaNaArvore, extrairIdPastaDrive } from '../core/athenes_colaboracao.js';
import { salvarArtigosEstudo } from './athenes_estudo_artigos.js';
import { svgIcone } from './athenes_icones.js';
import { obterTokenDrive, obterTokenOuConectar, sincronizarZoteroComDrive } from '../core/athenes_drive_sync.js';

export const metodosDashboardModais = {
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
  },

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
  },

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
  },

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
  },

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
            const atuais = [...carregarArtigosEstudo()];
            for (const art of dados.artigosEstudo) {
              const idx = atuais.findIndex(a => String(a.id) === String(art.id));
              if (idx >= 0) atuais[idx] = art;
              else atuais.push(art);
            }
            salvarArtigosEstudo(atuais); // vai para o servidor
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
};
