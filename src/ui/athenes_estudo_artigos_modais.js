// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Artigos: popovers do topo e janelas de Zotero, vínculo de artigo e citação.
 * Métodos do EstudoArtigosView (usam `this`); são acrescentados ao prototype em athenes_estudo_artigos.js.
 */
import { obterTokenDrive } from '../core/athenes_drive_sync.js';
import { resumoContaZotero } from '../core/athenes_zotero_conta.js';

/** Depois de salvar a chave: mostra, quando o envio termina, se ela ficou guardada na conta e no Drive. */
function mostrarOndeGuardou(el, prefixo) {
  const ouvir = (ev) => { if (el.isConnected) el.textContent = `${prefixo}${resumoContaZotero(ev.detail)}`; };
  window.addEventListener('athenes:zotero-conta', ouvir, { once: true });
}
import { ZoteroClient } from '../core/athenes_zotero.js';
import { obterConfigGoogleDrive, salvarConfigGoogleDrive, autenticarGoogleDrive, salvarArquivoNoGoogleDrive, obterPastasDriveLocais } from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { ehArtigoExemploFicticio, registrarPdfLocalNoArtigo, salvarArtigosEstudo, formatarCitacaoAbntDoArtigo } from './athenes_estudo_artigos_dados.js';

export const metodosEstudoModais = {
  configurarPopoversTopoEstudio(root, art) {
    const popZot = root.querySelector('#athPopoverEstZotero');
    const popDrive = root.querySelector('#athPopoverEstDrive');
    const popCaneta = root.querySelector('#athPopoverEstCaneta');

    if (popZot) {
      popZot.innerHTML = `
        <div class="rm-popover-head">
          <strong>Conexão Zotero Web API v3</strong>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>
        <div class="rm-popover-body">
          <label>Zotero API Key (Chave Privada)
            <input type="text" id="athPopZoteroKeyInput" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Cole aqui a chave (zotero.org/settings/keys)">
          </label>
          <label>Zotero User ID (opcional — detectado pela Key)
            <input type="text" id="athPopZoteroUserInput" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="Preenchido sozinho pela chave">
          </label>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnPopTestarESincronizarZot" style="flex:1; justify-content:center;">
              Conectar & Sincronizar Zotero
            </button>
          </div>
          <div id="athPopZoteroStatusMsg" style="font-size:11.5px; font-weight:700; color:#15803D;"></div>
        </div>
      `;

      popZot.querySelector('#athBtnPopTestarESincronizarZot').addEventListener('click', async () => {
        const k = popZot.querySelector('#athPopZoteroKeyInput').value.trim();
        const u = popZot.querySelector('#athPopZoteroUserInput').value.trim();
        const msgEl = popZot.querySelector('#athPopZoteroStatusMsg');
        this.salvarConfigZotero({ apiKey: k, userId: u });
        msgEl.style.color = '#314F79';
        msgEl.textContent = 'Verificando chave na API do Zotero...';
        const teste = await this.zoteroClient.testarConexao();
        if (teste.ok) {
          this.salvarConfigZotero({ apiKey: k, userId: teste.usuarioId, username: teste.nomeUsuario });
          popZot.querySelector('#athPopZoteroUserInput').value = teste.usuarioId || '';
          msgEl.style.color = '#15803D';
          msgEl.textContent = `Conectado como ${teste.nomeUsuario} (ID #${teste.usuarioId})! Sincronizando...`;
          mostrarOndeGuardou(msgEl, `Conectado como ${teste.nomeUsuario} (ID #${teste.usuarioId}) · `);
          await this.sincronizarComZoteroApi({ silencioso: true });
          this.renderizar();
        } else {
          msgEl.style.color = '#B42318';
          msgEl.textContent = teste.mensagem || 'Não foi possível validar a chave.';
        }
      });
    }

    if (popDrive) {
      const cfgDrive = obterConfigGoogleDrive();
      const driveConectado = Boolean(cfgDrive.accessToken);
      const pastaAtual = cfgDrive.pastaUrl || 'https://drive.google.com/drive/folders/1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv?usp=drive_link';
      if (!cfgDrive.pastaUrl) {
        salvarConfigGoogleDrive({ ...cfgDrive, pastaUrl: pastaAtual });
      }

      popDrive.innerHTML = `
        <div class="rm-popover-head ath-pop-drive-head">
          <div style="display:flex; align-items:center; gap:8px;">
            ${svgIcone('drive', 18)}
            <strong>Google Drive & Arquivo PDF</strong>
          </div>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>

        <div class="rm-popover-body ath-pop-drive-body">
          <!-- CARD 1: PASTA NO GOOGLE DRIVE -->
          <div class="ath-pop-drive-card">
            <div class="ath-pop-drive-card-tit">
              ${svgIcone('drive', 14)}
              <span>1. Pasta do Google Drive (Nuvem)</span>
            </div>
            <label class="ath-pop-label">
              Link da Pasta onde ficam seus PDFs:
              <input type="text" id="athPopDrivePastaInput" class="glx-input ath-pop-input" value="${escapeHtml(pastaAtual)}" placeholder="https://drive.google.com/drive/folders/...">
            </label>
            <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnPopAbrirPastaDrive" style="width:100%; justify-content:center; gap:6px;">
              ${svgIcone('drive', 14)} Abrir Pasta no Google Drive Web ↗
            </button>
            <div class="ath-pop-drive-card-dica">
              Abre sua pasta do Drive em nova aba para baixar o PDF deste artigo para o computador.
            </div>
          </div>

          <!-- CARD 2: VINCULAR PDF DESTE ARTIGO -->
          <div class="ath-pop-drive-card ath-pop-drive-card-destaque">
            <div class="ath-pop-drive-card-tit">
              ${svgIcone('artigo', 14)}
              <span>2. Arquivo PDF deste Artigo</span>
            </div>
            
            <div class="ath-pop-drive-status-pdf">
              ${art.temPdfLocal || art.pdfBlobUrl ? `
                <span class="ath-pop-tag-ok">✓ PDF Vinculado</span>
                <span class="ath-pop-nome-arquivo" title="${escapeHtml(art.driveFileName || 'arquivo.pdf')}">${escapeHtml(art.driveFileName || 'arquivo.pdf')}</span>
              ` : `
                <span class="ath-pop-tag-aviso">${svgIcone('alerta', 12)} Sem PDF Vinculado</span>
                <span class="ath-pop-nome-arquivo-vazio">Vincule o PDF para ler as páginas originais</span>
              `}
            </div>

            <div class="ath-pop-drive-card-acoes" style="margin-top:8px;">
              <label class="glx-btn glx-btn-primary glx-btn-sm" style="width:100%; justify-content:center; gap:6px; cursor:pointer;">
                ${svgIcone('upload', 14)} ${art.temPdfLocal || art.pdfBlobUrl ? 'Trocar Arquivo PDF (.pdf)...' : 'Selecionar Arquivo PDF no Computador...'}
                <input type="file" id="athPopDriveFileInput" accept=".pdf" hidden>
              </label>
            </div>
            <div class="ath-pop-drive-card-dica">
              O PDF é lido localmente e guardado com segurança no seu navegador (IndexedDB).
            </div>
          </div>

          <!-- CARD 3 (AVANÇADO / COLAPSÁVEL): OAUTH E ID -->
          <details class="ath-pop-drive-details">
            <summary class="ath-pop-drive-summary">Configurações Avançadas & OAuth (Opcional)</summary>
            <div class="ath-pop-drive-details-corpo">
              <label class="ath-pop-label">Google OAuth Client ID:
                <input type="text" id="athPopDriveClientIdInput" class="glx-input ath-pop-input" value="${escapeHtml(cfgDrive.clientId || '')}">
              </label>
              <button type="button" class="glx-btn ${driveConectado ? 'ath-btn-zotero-ok' : 'glx-btn-soft'} glx-btn-xs" id="athBtnPopAutenticarDrive" style="width:100%; justify-content:center; margin-top:4px;">
                ${svgIcone('drive', 12)} ${driveConectado ? 'Conta Conectada ✓ (Reconectar)' : 'Conectar Conta Google via OAuth'}
              </button>
              <div id="athPopDriveStatusMsg" style="font-size:11px; font-weight:700; color:#15803D; margin-top:4px;"></div>
              <label class="ath-pop-label" style="margin-top:8px;">Nome de Referência do Arquivo:
                <input type="text" id="athPopDriveNomeInput" class="glx-input ath-pop-input" value="${escapeHtml(art.driveFileName || '')}">
              </label>
              <label class="ath-pop-label" style="margin-top:6px;">ID do Arquivo no Drive:
                <input type="text" id="athPopDriveIdInput" class="glx-input ath-pop-input" value="${escapeHtml(art.driveFileId || '')}" placeholder="ID do arquivo no Google Drive">
              </label>
            </div>
          </details>
        </div>
      `;

      popDrive.querySelector('#athPopDrivePastaInput')?.addEventListener('change', e => {
        const val = e.target.value.trim();
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), pastaUrl: val });
      });

      popDrive.querySelector('#athBtnPopAbrirPastaDrive')?.addEventListener('click', () => {
        let raw = popDrive.querySelector('#athPopDrivePastaInput')?.value?.trim();
        if (!raw) raw = 'https://drive.google.com/drive/folders/1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv?usp=drive_link';
        const idPasta = extrairIdPastaDrive(raw);
        const urlFinal = idPasta ? `https://drive.google.com/drive/folders/${idPasta}` : (raw.startsWith('http') ? raw : `https://drive.google.com/drive/folders/${raw}`);
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), pastaUrl: urlFinal, pastaId: idPasta });
        window.open(urlFinal, '_blank', 'noopener,noreferrer');
      });

      popDrive.querySelector('#athPopDriveFileInput')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        registrarPdfLocalNoArtigo(art, file);
        if (this._pdfFalhou) this._pdfFalhou.clear();
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
      });

      popDrive.querySelector('#athPopDriveClientIdInput')?.addEventListener('change', e => {
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), clientId: e.target.value.trim() });
      });

      popDrive.querySelector('#athBtnPopAutenticarDrive')?.addEventListener('click', async () => {
        const cid = popDrive.querySelector('#athPopDriveClientIdInput').value.trim();
        const msgEl = popDrive.querySelector('#athPopDriveStatusMsg');
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), clientId: cid });
        msgEl.style.color = '#314F79';
        msgEl.textContent = 'Abrindo janela oficial de login do Google...';
        try {
          await autenticarGoogleDrive(cid);
          msgEl.style.color = '#15803D';
          msgEl.textContent = 'Google Drive conectado com sucesso! ✓';
          this.renderizar();
        } catch (err) {
          msgEl.style.color = '#B42318';
          msgEl.textContent = `Atenção: ${err.message || 'Autorize o domínio no Google Cloud Console.'}`;
        }
      });

      popDrive.querySelector('#athPopDriveNomeInput')?.addEventListener('change', e => {
        art.driveFileName = e.target.value.trim();
        salvarArtigosEstudo(this.artigos);
      });

      popDrive.querySelector('#athPopDriveIdInput')?.addEventListener('change', e => {
        art.driveFileId = e.target.value.trim();
        salvarArtigosEstudo(this.artigos);
      });
    }

    if (popCaneta) {
      popCaneta.innerHTML = `
        <div class="rm-popover-head">
          <strong>Ajustes da Caneta & Zoom da Folha</strong>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>
        <div class="rm-popover-body">
          <label>Espessura do Traço da Caneta
            <select id="athSelectEspessuraTinta" class="glx-select">
              <option value="2" ${this.espessuraTinta === 2 ? 'selected' : ''}>Fina (2 px)</option>
              <option value="3" ${this.espessuraTinta === 3 ? 'selected' : ''}>Média (3 px)</option>
              <option value="6" ${this.espessuraTinta === 6 ? 'selected' : ''}>Forte (6 px)</option>
              <option value="10" ${this.espessuraTinta === 10 ? 'selected' : ''}>Pincel Largo (10 px)</option>
            </select>
          </label>
          <label id="athZoomRotulo">Escala / Zoom das Folhas PDF (${this.zoomPct}%)
            <div style="display:flex; gap:6px;">
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athZoomMenos">- 10%</button>
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athZoom100">100%</button>
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athZoomMais">+ 10%</button>
            </div>
          </label>
        </div>
      `;
      popCaneta.querySelector('#athSelectEspessuraTinta').addEventListener('change', e => {
        this.espessuraTinta = parseInt(e.target.value, 10) || 3;
        this.atualizarEstadoFerramentasNoDom(root);
      });
      popCaneta.querySelector('#athZoomMenos').addEventListener('click', () => {
        this.aplicarZoom(this.zoomPct - 10, root);
      });
      popCaneta.querySelector('#athZoom100').addEventListener('click', () => {
        this.aplicarZoom(100, root);
      });
      popCaneta.querySelector('#athZoomMais').addEventListener('click', () => {
        this.aplicarZoom(this.zoomPct + 10, root);
      });
    }

    root.querySelectorAll('[data-menu-est]').forEach(item => {
      const btn = item.querySelector('.rm-btn-menu-topo');
      const pop = item.querySelector('.rm-topo-popover');
      if (!btn || !pop) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const jaAberto = !pop.hidden;
        root.querySelectorAll('.rm-topo-popover').forEach(p => { p.hidden = true; });
        root.querySelectorAll('.rm-btn-menu-topo').forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (!jaAberto) {
          pop.hidden = false;
          btn.setAttribute('aria-expanded', 'true');
        }
      });
      pop.addEventListener('click', e => e.stopPropagation());
    });

    root.querySelectorAll('[data-fechar-pop-est]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.rm-topo-popover').forEach(p => { p.hidden = true; });
        root.querySelectorAll('.rm-btn-menu-topo').forEach(b => b.setAttribute('aria-expanded', 'false'));
      });
    });
  },

  /**
   * Modal para escolher uma referência já existente na biblioteca Zotero do usuário
   * e vincular (puxar Título, Autores, Ano, Periódico, DOI, Resumo, Tags e Chave Zotero)
   * a qualquer PDF lido do Google Drive — SEM enviar o PDF para o Zotero.
   */
  async abrirModalEscolherReferenciaZotero(artAlvo = null, onSelecionado = null) {
    this.carregarConfigZotero();
    const conectado = Boolean(this.zoteroClient.apiKey);
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    const estSel = 'height:30px; font-size:11.5px; padding:0 8px; min-width:0; flex:1 1 110px;';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:640px; width:calc(100vw - 32px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="ath-modal-head">
          <h2>Vincular a uma Referência do Zotero</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalEscRefFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo" style="display:flex; flex-direction:column; gap:8px; min-height:0; flex:1;">
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <input type="text" class="ath-input" id="athBuscaRefZoteroModal" placeholder="Buscar por título, autor, ano, DOI ou tag..." style="flex:1 1 200px; height:32px; font-size:12px;">
            <button type="button" class="ath-btn ath-btn-sm" id="athBtnRecarregarRefZotModal" title="Buscar de novo na sua conta Zotero">${svgIcone('zotero', 13)} Atualizar</button>
            <label class="ath-btn ath-btn-sm" style="cursor:pointer;" title="Carregar referências de um arquivo .bib exportado do Zotero">
              ${svgIcone('upload', 13)} .bib
              <input type="file" accept=".bib,.txt" id="athInputBibNoModalRef" style="display:none;">
            </label>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <select class="ath-input" id="athFiltroRefAno" style="${estSel}"><option value="">Ano: todos</option></select>
            <select class="ath-input" id="athFiltroRefAutor" style="${estSel}"><option value="">Autor: todos</option></select>
            <select class="ath-input" id="athFiltroRefPeriodico" style="${estSel}"><option value="">Periódico: todos</option></select>
            <select class="ath-input" id="athFiltroRefTag" style="${estSel}"><option value="">Tag: todas</option></select>
            <select class="ath-input" id="athFiltroRefDoi" style="${estSel}">
              <option value="">DOI: tanto faz</option>
              <option value="com">Com DOI</option>
              <option value="sem">Sem DOI</option>
            </select>
            <select class="ath-input" id="athOrdemRef" style="${estSel}">
              <option value="recentes">Ordem: Zotero (recentes)</option>
              <option value="ano_desc">Ano (novo → antigo)</option>
              <option value="ano_asc">Ano (antigo → novo)</option>
              <option value="titulo">Título (A–Z)</option>
              <option value="autor">Autor (A–Z)</option>
            </select>
          </div>
          <div id="athStatusRefZoteroModal" style="font-size:11.5px; color:#314F79; font-weight:700;"></div>
          <div id="athListaRefZoteroModal" style="flex:1; min-height:120px; max-height:min(50vh, 400px); overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding-right:2px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalEscRefCancelar">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalEscRefFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalEscRefCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const paraRef = (it) => ({
      chave: it.chave || it.chaveZotero || it.id,
      titulo: it.titulo || '(sem título)',
      autores: it.autores?.length ? it.autores : [],
      ano: it.ano || '',
      publicacao: it.publicacao || it.editora || '',
      volume: it.volume || '',
      numero: it.numero || '',
      paginas: it.paginas || '',
      doi: it.doi || '',
      resumo: it.resumo || it.resumoOriginal || '',
      palavrasChave: it.palavrasChave || []
    });

    // Com a conta Zotero conectada, o catálogo é SOMENTE o que existe no Zotero.
    // Sem conta conectada, usa os artigos locais reais (nunca os 3 exemplos fictícios).
    let catalogoRefs = conectado
      ? (this._cacheRefsZotero?.itens || []).map(paraRef)
      : this.artigos.filter(a => !ehArtigoExemploFicticio(a)).map(paraRef);

    const listaEl = modal.querySelector('#athListaRefZoteroModal');
    const statusEl = modal.querySelector('#athStatusRefZoteroModal');
    const inputBusca = modal.querySelector('#athBuscaRefZoteroModal');
    const selAno = modal.querySelector('#athFiltroRefAno');
    const selAutor = modal.querySelector('#athFiltroRefAutor');
    const selPer = modal.querySelector('#athFiltroRefPeriodico');
    const selTag = modal.querySelector('#athFiltroRefTag');
    const selDoi = modal.querySelector('#athFiltroRefDoi');
    const selOrdem = modal.querySelector('#athOrdemRef');

    const sobrenomeAutor = (r) => (r.autores?.[0]?.sobrenome || '').trim();

    const preencherOpcoes = (sel, rotuloTodos, valores) => {
      const atual = sel.value;
      const unicos = Array.from(new Set(valores.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
      sel.innerHTML = `<option value="">${rotuloTodos}</option>` +
        unicos.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      if (unicos.includes(atual)) sel.value = atual;
    };

    const atualizarOpcoesFiltros = () => {
      preencherOpcoes(selAno, 'Ano: todos', catalogoRefs.map(r => String(r.ano || '')).sort().reverse());
      preencherOpcoes(selAutor, 'Autor: todos', catalogoRefs.map(sobrenomeAutor));
      preencherOpcoes(selPer, 'Periódico: todos', catalogoRefs.map(r => r.publicacao));
      preencherOpcoes(selTag, 'Tag: todas', catalogoRefs.flatMap(r => r.palavrasChave || []));
    };

    const renderizarLista = () => {
      const q = inputBusca.value.trim().toLowerCase();
      let filtradas = catalogoRefs.filter(r => {
        if (selAno.value && String(r.ano) !== selAno.value) return false;
        if (selAutor.value && sobrenomeAutor(r) !== selAutor.value) return false;
        if (selPer.value && r.publicacao !== selPer.value) return false;
        if (selTag.value && !(r.palavrasChave || []).includes(selTag.value)) return false;
        if (selDoi.value === 'com' && !r.doi) return false;
        if (selDoi.value === 'sem' && r.doi) return false;
        if (!q) return true;
        const autStr = (r.autores || []).map(x => `${x.sobrenome} ${x.prenome}`).join(' ');
        return `${r.titulo} ${autStr} ${r.ano} ${r.publicacao} ${r.doi} ${(r.palavrasChave || []).join(' ')}`.toLowerCase().includes(q);
      });

      const ordem = selOrdem.value;
      if (ordem === 'ano_desc') filtradas.sort((a, b) => String(b.ano).localeCompare(String(a.ano)));
      else if (ordem === 'ano_asc') filtradas.sort((a, b) => String(a.ano).localeCompare(String(b.ano)));
      else if (ordem === 'titulo') filtradas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      else if (ordem === 'autor') filtradas.sort((a, b) => sobrenomeAutor(a).localeCompare(sobrenomeAutor(b), 'pt-BR'));

      if (filtradas.length === 0) {
        listaEl.innerHTML = `
          <div style="padding:14px; text-align:center; color:#475569; font-size:12px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:10px; line-height:1.5;">
            ${catalogoRefs.length === 0
              ? (conectado
                ? 'Sua conta Zotero online não tem itens (ou ainda não sincronizou). No Zotero Desktop, clique no botão verde de sincronizar e depois em <b>Atualizar</b>; ou use <b>.bib</b>.'
                : 'Conecte sua Zotero API Key ou importe um arquivo <b>.bib</b>.')
              : 'Nenhuma referência com esses filtros.'}
          </div>`;
        return;
      }

      // Renderiza em lote único (sem reflow por item) e limita a 200 cartões para manter a tela leve.
      const limite = 200;
      const html = filtradas.slice(0, limite).map((r, i) => {
        const autTxt = (r.autores || []).map(a => `${a.sobrenome}${a.prenome ? ', ' + a.prenome : ''}`).join('; ') || 'Autor não informado';
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid #CBD5E1; border-radius:10px; background:#F8FAFC; flex:0 0 auto;">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:800; color:#0F172A; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(r.titulo)}</div>
              <div style="font-size:11px; color:#314F79; font-weight:700; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(autTxt)}${r.ano ? ` (${escapeHtml(r.ano)})` : ''}${r.publicacao ? ` · ${escapeHtml(r.publicacao)}` : ''}
              </div>
              <div style="font-size:10.5px; color:#64748B; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <code>${escapeHtml(r.chave || '')}</code>${r.doi ? ` · DOI ${escapeHtml(r.doi)}` : ''}
              </div>
            </div>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" data-vincular-ref-idx="${i}" style="flex:0 0 auto;">Vincular</button>
          </div>`;
      }).join('') + (filtradas.length > limite
        ? `<div style="font-size:11px; color:#64748B; text-align:center; padding:4px;">Mostrando ${limite} de ${filtradas.length}. Refine a busca ou os filtros.</div>`
        : '');
      listaEl.innerHTML = html;
      listaEl._filtradas = filtradas;
    };

    // Um único listener delegado em vez de um por botão
    listaEl.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-vincular-ref-idx]');
      if (!btn) return;
      const ref = listaEl._filtradas?.[parseInt(btn.dataset.vincularRefIdx, 10)];
      if (!ref) return;
      if (artAlvo) {
        artAlvo.chaveZotero = ref.chave || artAlvo.chaveZotero;
        artAlvo.titulo = ref.titulo || artAlvo.titulo;
        artAlvo.autores = ref.autores?.length ? ref.autores : artAlvo.autores;
        artAlvo.ano = ref.ano || artAlvo.ano;
        artAlvo.publicacao = ref.publicacao || artAlvo.publicacao;
        artAlvo.volume = ref.volume || artAlvo.volume;
        artAlvo.numero = ref.numero || artAlvo.numero;
        artAlvo.paginas = ref.paginas || artAlvo.paginas;
        artAlvo.doi = ref.doi || artAlvo.doi;
        if (ref.resumo) artAlvo.resumoOriginal = ref.resumo;
        if (ref.palavrasChave?.length) artAlvo.palavrasChave = ref.palavrasChave;
        if (artAlvo.conteudoPaginasPdf?.[0]) {
          artAlvo.conteudoPaginasPdf[0].titulo = artAlvo.titulo.toUpperCase();
          artAlvo.conteudoPaginasPdf[0].autores = (artAlvo.autores || []).map(a => `${a.prenome || ''} ${a.sobrenome}`.trim()).join(' · ');
        }
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
      }
      if (onSelecionado) onSelecionado(ref);
      fechar();
    });

    const TTL_CACHE_MS = 5 * 60 * 1000;
    const buscarDaApi = async (forcar = false) => {
      if (!conectado) {
        statusEl.textContent = 'Conecte sua Zotero API Key ou importe um arquivo .bib.';
        renderizarLista();
        return;
      }
      const c = this._cacheRefsZotero;
      if (!forcar && c && Date.now() - c.t < TTL_CACHE_MS) {
        catalogoRefs = c.itens.map(paraRef);
        statusEl.textContent = `${catalogoRefs.length} referência(s) da sua biblioteca Zotero ✓`;
        atualizarOpcoesFiltros();
        renderizarLista();
        return;
      }
      statusEl.textContent = 'Buscando referências na sua biblioteca Zotero...';
      const remotos = await this.zoteroClient.buscarItens();
      const lista = Array.isArray(remotos) ? remotos : [];
      this._cacheRefsZotero = { t: Date.now(), itens: lista };
      catalogoRefs = lista.map(paraRef);
      statusEl.textContent = catalogoRefs.length
        ? `${catalogoRefs.length} referência(s) da sua biblioteca Zotero ✓`
        : 'Sua biblioteca online em zotero.org tem 0 itens.';
      atualizarOpcoesFiltros();
      renderizarLista();
    };

    modal.querySelector('#athInputBibNoModalRef')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const importados = ZoteroClient.importarBibTeX(await file.text());
      importados.map(paraRef).forEach(r => {
        if (!catalogoRefs.some(c => c.titulo === r.titulo)) catalogoRefs.unshift(r);
      });
      statusEl.textContent = `${importados.length} referência(s) lida(s) do .bib ✓ (apenas para vincular; não entram no catálogo)`;
      atualizarOpcoesFiltros();
      renderizarLista();
    });

    let debounceBusca = null;
    inputBusca.addEventListener('input', () => {
      clearTimeout(debounceBusca);
      debounceBusca = setTimeout(renderizarLista, 120);
    });
    [selAno, selAutor, selPer, selTag, selDoi, selOrdem].forEach(s => s.addEventListener('change', renderizarLista));
    modal.querySelector('#athBtnRecarregarRefZotModal').addEventListener('click', () => buscarDaApi(true));

    atualizarOpcoesFiltros();
    renderizarLista();
    if (conectado) buscarDaApi(false);
    else statusEl.textContent = 'Zotero não conectado: mostrando só artigos locais.';
  },

  abrirModalVincularArtigo(opcoes = {}) {
    let arquivoPdfSelecionado = null;
    let driveFileIdSelecionado = '';

    const pastasDrive = obterPastasDriveLocais();
    const opcoesPastasBib = [];
    function coletarPastasBib(lista, prefixo = '') {
      for (const p of lista) {
        if (p.tipo === 'bibliografia' || p.id === 'pasta_bib_raiz' || p.tipo === 'compartilhada') {
          opcoesPastasBib.push({ id: p.id, nome: `${prefixo}${p.nome}` });
          if (p.subpastas && p.subpastas.length > 0) {
            coletarPastasBib(p.subpastas, `${prefixo}  ↳ `);
          }
        }
      }
    }
    coletarPastasBib(pastasDrive);
    if (opcoesPastasBib.length === 0) {
      opcoesPastasBib.push({ id: 'pasta_bib_raiz', nome: 'Bibliografia & Leituras' });
    }

    const pastaAlvoId = opcoes.pastaId || (this.pastaFiltroId && this.pastaFiltroId !== 'todas' ? this.pastaFiltroId : 'pasta_bib_raiz');

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:580px;">
        <div class="ath-modal-head">
          <h2>Vincular PDF do Google Drive & Referência do Zotero</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalArtFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 12px; background:#EEF4FA; border:1px solid #C8D7E6; border-radius:10px;">
            <span style="font-size:12px; font-weight:700; color:#1E293B;">Já cadastrou a referência no Zotero? Puxe os dados com 1 clique:</span>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnPuxarRefZoteroNoModal">
              ${svgIcone('zotero', 13)} Escolher do Zotero
            </button>
          </div>

          <div class="ath-prop-grupo">
            <label>Pasta de Destino (Google Drive)</label>
            <select class="ath-select" id="athNovoArtPasta">
              ${opcoesPastasBib.map(o => `<option value="${escapeHtml(o.id)}" ${o.id === pastaAlvoId ? 'selected' : ''}>${escapeHtml(o.nome)}</option>`).join('')}
            </select>
          </div>

          <div class="ath-prop-grupo">
            <label>Arquivo PDF (o PDF fica no seu Google Drive / Computador e não ocupa espaço no Zotero)</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:10px 12px; background:#F8FAFC; border:1.5px dashed #94A3B8; border-radius:10px;">
              <label class="ath-btn ath-btn-primary ath-btn-sm" style="cursor:pointer;">
                ${svgIcone('upload', 13)} Selecionar Arquivo PDF...
                <input type="file" accept=".pdf,application/pdf" id="athNovoArtInputPdfFile" style="display:none;">
              </label>
              <button type="button" class="ath-btn ath-btn-sm" id="athBtnEscolherPdfDriveNoModal">
                ${svgIcone('drive', 13)} Buscar no Google Drive
              </button>
              <span id="athNovoArtPdfBadge" style="font-size:11.5px; color:#314F79; font-weight:700; flex:1; min-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                Nenhum arquivo selecionado
              </span>
            </div>
            <input type="text" class="ath-input" id="athNovoArtDriveNome" placeholder="Nome do arquivo PDF (preenchido automaticamente ao selecionar)" style="margin-top:6px;">
          </div>

          <div class="ath-prop-grupo">
            <label>Título do Artigo</label>
            <input type="text" class="ath-input" id="athNovoArtTitulo" placeholder="Ex.: Planejamento Urbano e Regularização Sustentável">
          </div>
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Autor Principal (Sobrenome, Nome)</label>
              <input type="text" class="ath-input" id="athNovoArtAutor" placeholder="Ex.: Silva, Carlos">
            </div>
            <div class="ath-prop-grupo">
              <label>Ano de Publicação</label>
              <input type="text" class="ath-input" id="athNovoArtAno" value="2026">
            </div>
          </div>
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Periódico / Conferência</label>
              <input type="text" class="ath-input" id="athNovoArtPeriodico" placeholder="Ex.: Cadernos Metrópole">
            </div>
            <div class="ath-prop-grupo">
              <label>Chave da Referência no Zotero (Item Key)</label>
              <input type="text" class="ath-input" id="athNovoArtZotKey" placeholder="Vinculada do Zotero ou criada ao sincronizar">
            </div>
          </div>
          <div class="ath-prop-grupo">
            <label>Resumo / Abstract do Artigo</label>
            <textarea class="ath-input" id="athNovoArtResumo" rows="2" placeholder="Cole o abstract do artigo..."></textarea>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalArtCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalArtCriar">Adicionar & Abrir no Estúdio</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalArtFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalArtCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const badgePdf = modal.querySelector('#athNovoArtPdfBadge');
    const inputDriveNome = modal.querySelector('#athNovoArtDriveNome');
    const inputTitulo = modal.querySelector('#athNovoArtTitulo');

    modal.querySelector('#athNovoArtInputPdfFile').addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (!f) return;
      arquivoPdfSelecionado = f;
      inputDriveNome.value = f.name;
      badgePdf.style.color = '#15803D';
      badgePdf.textContent = `✓ ${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`;
      if (!inputTitulo.value.trim()) {
        inputTitulo.value = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      }
    });

    modal.querySelector('#athBtnEscolherPdfDriveNoModal').addEventListener('click', () => {
      this.abrirModalEscolherPdfDoGoogleDrive((arqDrive) => {
        driveFileIdSelecionado = arqDrive.id || '';
        inputDriveNome.value = arqDrive.name || '';
        badgePdf.style.color = '#15803D';
        badgePdf.textContent = `✓ Drive: ${arqDrive.name}`;
        if (!inputTitulo.value.trim() && arqDrive.name) {
          inputTitulo.value = arqDrive.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
        }
      });
    });

    modal.querySelector('#athBtnPuxarRefZoteroNoModal').addEventListener('click', () => {
      this.abrirModalEscolherReferenciaZotero(null, (ref) => {
        modal.querySelector('#athNovoArtTitulo').value = ref.titulo || '';
        const aut0 = ref.autores?.[0];
        if (aut0) {
          modal.querySelector('#athNovoArtAutor').value = `${aut0.sobrenome || ''}${aut0.prenome ? ', ' + aut0.prenome : ''}`;
        }
        modal.querySelector('#athNovoArtAno').value = ref.ano || '2026';
        modal.querySelector('#athNovoArtPeriodico').value = ref.publicacao || '';
        modal.querySelector('#athNovoArtZotKey').value = ref.chave || '';
        modal.querySelector('#athNovoArtResumo').value = ref.resumo || '';
        if (!inputDriveNome.value.trim()) {
          inputDriveNome.value = `${aut0?.sobrenome || 'Artigo'}_${ref.ano || '2026'}.pdf`;
        }
      });
    });

    modal.querySelector('#athModalArtCriar').addEventListener('click', async () => {
      const titulo = modal.querySelector('#athNovoArtTitulo').value.trim() || 'Novo Artigo Científico';
      const autorRaw = modal.querySelector('#athNovoArtAutor').value.trim() || 'Autor, Pesquisador';
      const partesAutor = autorRaw.split(',').map(s => s.trim());
      const ano = modal.querySelector('#athNovoArtAno').value.trim() || '2026';
      const publicacao = modal.querySelector('#athNovoArtPeriodico').value.trim() || 'Periódico Acadêmico';
      const chaveZotero = modal.querySelector('#athNovoArtZotKey').value.trim() || ('ZOT' + Math.random().toString(36).slice(2, 7).toUpperCase());
      const driveFileName = inputDriveNome.value.trim() || `${partesAutor[0]}_${ano}.pdf`;
      const resumo = modal.querySelector('#athNovoArtResumo').value.trim() || 'Artigo vinculado ao Zotero e ao Google Drive.';

      const pastaDestinoId = modal.querySelector('#athNovoArtPasta')?.value || pastaAlvoId;
      const novoArt = this.converterItemZoteroParaEstudo({
        id: Date.now().toString(36),
        pastaId: pastaDestinoId,
        chave: chaveZotero,
        titulo,
        autores: [{ sobrenome: partesAutor[0] || 'Autor', prenome: partesAutor[1] || '' }],
        ano,
        publicacao,
        resumo
      }, pastaDestinoId);
      novoArt.pastaId = pastaDestinoId;
      novoArt.driveFileName = driveFileName;
      if (driveFileIdSelecionado) {
        novoArt.driveFileId = driveFileIdSelecionado;
      }
      if (arquivoPdfSelecionado) {
        registrarPdfLocalNoArtigo(novoArt, arquivoPdfSelecionado);
        obterTokenDrive().then(tokenNovo => (tokenNovo ? salvarArquivoNoGoogleDrive({
            nomeArquivo: arquivoPdfSelecionado.name,
            conteudoBlobOuTexto: arquivoPdfSelecionado,
            mimeType: 'application/pdf',
            accessToken: tokenNovo
          }) : null)).then(salvo => {
            if (salvo?.id) {
              novoArt.driveFileId = salvo.id;
              salvarArtigosEstudo(this.artigos);
            }
          }).catch(() => {});
      }

      this.artigos.unshift(novoArt);
      salvarArtigosEstudo(this.artigos);
      fechar();
      this.abrirArtigoNoEstudio(novoArt);
    });
  },

  abrirModalCredenciaisZotero() {
    this.carregarConfigZotero();
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:500px;">
        <div class="ath-modal-head">
          <h2>Conectar Biblioteca Zotero (API Key)</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalZotCredFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:12.5px; color:#475569; margin:0;">
            Cole abaixo a sua <b>Chave Privada (API Key)</b> gerada em <code>zotero.org/settings/keys</code>. O Athenes descobre automaticamente o seu <b>User ID</b> (um número, como <code>1234567</code>) pela própria chave!
          </p>

          <div class="ath-prop-grupo">
            <label>Chave de API do Zotero (Private Key)</label>
            <input type="text" class="ath-input" id="athInputModalZotKey" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Cole aqui a chave (zotero.org/settings/keys)" autofocus>
          </div>

          <div class="ath-prop-grupo">
            <label>Zotero User ID (Opcional — preenchido automaticamente pela Key)</label>
            <input type="text" class="ath-input" id="athInputModalZotUser" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="Preenchido sozinho pela chave">
          </div>

          <div id="athModalZotStatusFeedback" style="font-size:12px; font-weight:700; min-height:18px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalZotCredCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalZotCredConectar">
            ${svgIcone('zotero', 14)} Testar Chave & Sincronizar Artigos
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalZotCredFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalZotCredCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athModalZotCredConectar').addEventListener('click', async () => {
      const apiKey = modal.querySelector('#athInputModalZotKey').value.trim();
      const userId = modal.querySelector('#athInputModalZotUser').value.trim();
      const statusEl = modal.querySelector('#athModalZotStatusFeedback');
      const btn = modal.querySelector('#athModalZotCredConectar');

      if (!apiKey) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = 'Informe a Chave de API (API Key) do Zotero.';
        return;
      }

      btn.disabled = true;
      statusEl.style.color = '#314F79';
      statusEl.textContent = 'Validando chave na API oficial do Zotero...';

      this.salvarConfigZotero({ apiKey, userId });
      const res = await this.zoteroClient.testarConexao();

      if (!res.ok) {
        btn.disabled = false;
        statusEl.style.color = '#B42318';
        statusEl.textContent = res.mensagem || 'Chave inválida ou erro de rede.';
        return;
      }

      this.salvarConfigZotero({
        apiKey,
        userId: res.usuarioId || userId,
        username: res.nomeUsuario || ''
      });
      modal.querySelector('#athInputModalZotUser').value = res.usuarioId || userId;
      statusEl.style.color = '#15803D';
      statusEl.textContent = `Conectado com sucesso (${res.nomeUsuario} · ID #${res.usuarioId})! Buscando biblioteca...`;
      mostrarOndeGuardou(statusEl, `Conectado (${res.nomeUsuario} · ID #${res.usuarioId}) · `);

      await this.sincronizarComZoteroApi({ silencioso: true });
      setTimeout(() => {
        fechar();
        this.renderizar();
      }, 500);
    });
  },

  abrirModalCitacaoPdf(art, dadosIniciais = {}) {
    // Esconde imediatamente o popover de seleção de texto para nunca sobrepor o modal
    const popSelAtivo = document.querySelector('#athPdfSelecaoPopover');
    if (popSelAtivo) popSelAtivo.hidden = true;

    const editandoId = dadosIniciais.id || null;
    const paginaPdfInicial = dadosIniciais.pagina || this.paginaAtual || 1;
    const folhaAtivaEl = this.container?.querySelector(`.ath-pdf-folha-container[data-num-pagina="${paginaPdfInicial}"]`);
    const paginaCitacaoInicial = dadosIniciais.paginaCitacao || folhaAtivaEl?.dataset?.pagEditorial || String(paginaPdfInicial);
    const textoInicial = dadosIniciais.texto || '';
    const comentarioInicial = dadosIniciais.comentario || '';
    const corInicial = dadosIniciais.cor || this.corTinta || '#314F79';

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:540px;">
        <div class="ath-modal-head">
          <h2>${editandoId ? 'Editar Citação do Fichamento' : 'Guardar Citação Direta no Zotero'}</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalCitFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Página da Citação (p. no Artigo / Revista)</label>
              <input type="text" class="ath-input" id="athModalCitPagina" value="${escapeHtml(paginaCitacaoInicial)}" placeholder="Ex.: 253 ou 17">
            </div>
            <div class="ath-prop-grupo">
              <label>Referência Gerada (ABNT)</label>
              <input type="text" class="ath-input" id="athModalCitPreviewAbnt" value="${escapeHtml(formatarCitacaoAbntDoArtigo(art, paginaCitacaoInicial))}" readonly style="background:#F8FAFC; font-weight:700; color:#314F79;">
            </div>
          </div>

          <div class="ath-prop-grupo">
            <label>Trecho Citado do Artigo</label>
            <textarea class="ath-input" id="athModalCitTexto" rows="4" placeholder="Cole ou digite o trecho exato do artigo...">${escapeHtml(textoInicial)}</textarea>
          </div>

          <div class="ath-prop-grupo">
            <label>Sua Nota / Onde Usar no Seu Artigo (Opcional)</label>
            <input type="text" class="ath-input" id="athModalCitComentario" value="${escapeHtml(comentarioInicial)}" placeholder="Ex.: Usar na seção de Metodologia para fundamentar...">
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalCitCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalCitSalvar">
            ${svgIcone('salvar', 14)} ${editandoId ? 'Salvar Alterações' : 'Salvar Citação no Fichamento'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalCitFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalCitCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const inputPag = modal.querySelector('#athModalCitPagina');
    const previewAbnt = modal.querySelector('#athModalCitPreviewAbnt');
    inputPag.addEventListener('input', () => {
      previewAbnt.value = formatarCitacaoAbntDoArtigo(art, inputPag.value.trim() || paginaPdfInicial);
    });

    modal.querySelector('#athModalCitSalvar').addEventListener('click', () => {
      const txt = modal.querySelector('#athModalCitTexto').value.trim();
      if (!txt) return;
      const pagCit = inputPag.value.trim() || String(paginaPdfInicial);
      const com = modal.querySelector('#athModalCitComentario').value.trim();

      if (!Array.isArray(art.fichamento.citacoesMarcadas)) {
        art.fichamento.citacoesMarcadas = [];
      }

      if (editandoId) {
        const alvo = art.fichamento.citacoesMarcadas.find(x => x.id === editandoId);
        if (alvo) {
          alvo.pagina = paginaPdfInicial;
          alvo.paginaCitacao = pagCit;
          alvo.texto = txt;
          alvo.comentario = com;
        }
      } else {
        art.fichamento.citacoesMarcadas.unshift({
          id: 'cit_' + Date.now().toString(36),
          pagina: paginaPdfInicial,
          paginaCitacao: pagCit,
          texto: txt,
          comentario: com,
          cor: corInicial,
          criadoEm: new Date().toISOString()
        });
      }

      salvarArtigosEstudo(this.artigos);
      this.abaDireita = 'citacoes';
      fechar();
      this.atualizarAbaCitacoesEContadores(art);
    });
  }
};
