// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Dashboard: árvore de pastas da lateral e banner da pasta.
 * Métodos da classe DashboardView (usam `this`); são acrescentados ao prototype em athenes_dashboard.js.
 */
import { obterPastasDriveLocais, removerPastaDriveLocal, buscarPastaNaArvore } from '../core/athenes_colaboracao.js';
import { registrarPastasExcluidas } from '../core/athenes_drive_sync.js';
import { artigoEstaNaPasta } from '../core/athenes_zotero_pastas.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { carregarArtigosEstudo } from './athenes_estudo_artigos.js';
import { svgIcone } from './athenes_icones.js';

export const metodosDashboardPastas = {
  alternarDrawerPastas() {
    const sidebar = this.container?.querySelector('#athDashSidebar');
    const scrim = this.container?.querySelector('#athDashScrim');
    if (!sidebar) return;
    const abrir = !sidebar.classList.contains('ath-aberto');
    sidebar.classList.toggle('ath-aberto', abrir);
    scrim?.classList.toggle('ath-aberto', abrir);
  },

  fecharDrawerPastas() {
    const sidebar = this.container?.querySelector('#athDashSidebar');
    const scrim = this.container?.querySelector('#athDashScrim');
    sidebar?.classList.remove('ath-aberto');
    scrim?.classList.remove('ath-aberto');
  },

  abrirDrawerPastas() {
    const sidebar = this.container?.querySelector('#athDashSidebar');
    const scrim = this.container?.querySelector('#athDashScrim');
    sidebar?.classList.add('ath-aberto');
    scrim?.classList.add('ath-aberto');
  },
  renderizarPastasLateral() {
    const listaEl = this.container.querySelector('#athDashPastasLista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    const ehAbaBib = this.abaAtiva === 'artigos_zotero';

    // 1. Item Todas as Pastas (Visão Geral da Aba Ativa)
    const totalItens = ehAbaBib
      ? (this.estudoView?.artigosCatalogo?.() || carregarArtigosEstudo()).length
      : this.documentos.length;
    const rotuloTodas = ehAbaBib
      ? 'Todas as Bibliografias'
      : 'Todos os Documentos';
    const iconeTodas = ehAbaBib ? 'livro' : 'pasta';

    const itemTodas = document.createElement('div');
    itemTodas.className = `ath-pasta-item ${this.pastaAtivaId === 'todas' ? 'active' : ''}`;
    itemTodas.innerHTML = `
      <div style="display:flex; align-items:center; gap:7px;">
        ${svgIcone(iconeTodas, 15)}
        <span>${rotuloTodas}</span>
      </div>
      <span class="ath-pasta-badge">${totalItens}</span>
    `;
    itemTodas.addEventListener('click', () => this.selecionarPasta('todas'));
    listaEl.appendChild(itemTodas);

    // 2. Seção Minhas Pastas (Google Drive) - Estritamente filtrada por tipo da aba ativa
    const tituloMinhas = document.createElement('div');
    tituloMinhas.className = 'ath-dash-grupo-titulo';
    tituloMinhas.textContent = ehAbaBib
      ? 'Pastas de Bibliografia (Drive)'
      : 'Pastas de Documentos (Drive)';
    listaEl.appendChild(tituloMinhas);

    const minhasPastas = this.pastasDrive.filter(p => {
      if (p.origem === 'compartilhada') return false;
      if (ehAbaBib) {
        return p.tipo === 'bibliografia' || p.id === 'pasta_bib_raiz';
      } else {
        return p.tipo === 'relatorios' || p.id === 'pasta_rel_raiz';
      }
    });

    if (minhasPastas.length === 0) {
      const avisoVazio = document.createElement('div');
      avisoVazio.style.cssText = 'font-size:11px; color:#94A3B8; padding:6px 8px; font-style:italic;';
      avisoVazio.textContent = ehAbaBib ? 'Nenhuma pasta de bibliografia.' : 'Nenhuma pasta de documentos.';
      listaEl.appendChild(avisoVazio);
    } else {
      for (const pasta of minhasPastas) {
        this.montarItemPastaComSubpastas(listaEl, pasta, 0);
      }
    }

    // 3. Seção Pastas Compartilhadas Comigo - Estritamente filtrada por tipo da aba ativa
    const compartilhadas = this.pastasDrive.filter(p => {
      if (p.origem !== 'compartilhada') return false;
      if (ehAbaBib) {
        return p.tipo === 'bibliografia' || p.tipo === 'compartilhada';
      } else {
        return p.tipo === 'relatorios' || p.tipo === 'compartilhada';
      }
    });

    const tituloComp = document.createElement('div');
    tituloComp.className = 'ath-dash-grupo-titulo';
    tituloComp.textContent = 'Compartilhadas Comigo';
    listaEl.appendChild(tituloComp);

    {
      const qtd = ehAbaBib
        ? (this.estudoView?.artigosCompartilhados || []).length
        : this.documentos.filter(d => d.compartilhadoComigo).length;
      const itemComigo = document.createElement('div');
      itemComigo.className = `ath-pasta-item ${this.pastaAtivaId === 'compartilhados_comigo' ? 'active' : ''}`;
      itemComigo.innerHTML = `<div style="display:flex; align-items:center; gap:7px;">${svgIcone('usuarios', 15)}<span>${ehAbaBib ? 'Artigos de outras pessoas' : 'Documentos de outras pessoas'}</span></div><span class="ath-pasta-badge">${qtd}</span>`;
      itemComigo.addEventListener('click', () => this.selecionarPasta('compartilhados_comigo'));
      listaEl.appendChild(itemComigo);
    }

    if (compartilhadas.length === 0) {
      const avisoVazio = document.createElement('div');
      avisoVazio.style.cssText = 'font-size:11px; color:#94A3B8; padding:6px 8px; font-style:italic;';
      avisoVazio.textContent = ehAbaBib
        ? 'Nenhuma pasta de bibliografia compartilhada vinculada.'
        : 'Nenhuma pasta de relatórios compartilhada vinculada.';
      listaEl.appendChild(avisoVazio);
    } else {
      for (const pasta of compartilhadas) {
        this.montarItemPastaComSubpastas(listaEl, pasta, 0, true);
      }
    }
  },

  montarItemPastaComSubpastas(container, pasta, nivel = 0, ehCompartilhada = false) {
    const item = document.createElement('div');
    const ativo = (this.pastaAtivaId === pasta.id);
    item.className = `ath-pasta-item ${ativo ? 'active' : ''} ${nivel > 0 ? 'ath-pasta-item-sub' : ''}`;
    
    const ehAbaBib = this.abaAtiva === 'artigos_zotero';
    let count = 0;
    if (ehAbaBib) {
      const artigos = this.estudoView?.artigos || carregarArtigosEstudo();
      count = artigos.filter(a => artigoEstaNaPasta(a, pasta.id)).length;
    } else {
      count = this.documentos.filter(d => {
        const pId = this.pastaEfetivaDoDoc(d);
        return pId === pasta.id;
      }).length;
    }

    const iconeNome = pasta.icone || (pasta.tipo === 'bibliografia' ? 'livro' : (pasta.tipo === 'relatorios' ? 'documento' : (ehCompartilhada ? 'usuarios' : 'pasta')));
    const prefixo = nivel > 0 ? '↳ ' : '';

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
        ${svgIcone(iconeNome, 14)}
        <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${escapeHtml(pasta.nome)}">${prefixo}${escapeHtml(pasta.nome)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <span class="ath-pasta-badge">${count}</span>
        ${ehCompartilhada ? `
          <button type="button" class="ath-btn ath-btn-xs ath-btn-remover-comp" title="Desvincular pasta compartilhada" style="padding:0 3px; height:18px; color:#DC2626; border:none; background:transparent;">
            ✕
          </button>
        ` : (this.pastaPodeSerExcluida(pasta) ? `
          <button type="button" class="ath-btn ath-btn-xs ath-btn-excluir-pasta" title="Excluir pasta (os documentos dela vão para a pasta de cima)" aria-label="Excluir pasta ${escapeHtml(pasta.nome)}" style="padding:0 3px; height:18px; color:#94A3B8; border:none; background:transparent;">
            ${svgIcone('lixeira', 12)}
          </button>
        ` : '')}
      </div>
    `;

    item.addEventListener('click', (ev) => {
      if (ev.target.closest('.ath-btn-excluir-pasta')) {
        ev.stopPropagation();
        this.excluirPasta(pasta);
        return;
      }
      if (ev.target.closest('.ath-btn-remover-comp')) {
        ev.stopPropagation();
        if (confirm(`Deseja desvincular a pasta compartilhada "${pasta.nome}"?`)) {
          const todas = [];
          const coletar = (p) => {
            todas.push({ id: p.id, driveId: p.driveId || p.id, nome: p.nome, lixeira: true });
            (p.subpastas || []).forEach(coletar);
          };
          coletar(pasta);

          const ids = new Set(todas.map(p => p.id));
          let mudouDocs = false;
          for (const d of (this.documentos || [])) {
            if (ids.has(d.pastaId)) {
              d.pastaId = undefined;
              mudouDocs = true;
            }
          }
          if (mudouDocs) {
            this.salvarDocumentosLocais?.();
          }

          registrarPastasExcluidas(todas);
          removerPastaDriveLocal(pasta.id);
          this.pastasDrive = obterPastasDriveLocais();
          if (ids.has(this.pastaAtivaId)) this.pastaAtivaId = 'todas';
          this.renderizarPastasLateral();
          this.renderizarBannerPasta();
          if (this.abaAtiva === 'escrita') this.atualizarGrid();
          else this.estudoView?.filtrarPorPasta?.(this.pastaAtivaId);
          this.agendarPerfil?.(200);
        }
        return;
      }
      this.selecionarPasta(pasta.id);
    });

    container.appendChild(item);
    if (!ehAbaBib) this.arquivos.tornarAlvoDeSolta(item, pasta.id);

    if (Array.isArray(pasta.subpastas) && pasta.subpastas.length > 0) {
      for (const sub of pasta.subpastas) {
        this.montarItemPastaComSubpastas(container, sub, nivel + 1, ehCompartilhada);
      }
    }
  },

  renderizarBannerPasta() {
    const bannerEl = this.container.querySelector('#athDashPastaBanner');
    if (!bannerEl) return;

    const ehAbaBib = this.abaAtiva === 'artigos_zotero';
    const botaoDrawerHtml = `
      <button type="button" class="ath-btn ath-btn-sm ath-dash-btn-toggle-pastas" id="athBtnTogglePastasBanner" title="Ver pastas e coleções do Google Drive" aria-label="Abrir pastas">
        ${svgIcone('pasta', 14)}
        <span class="ath-dash-btn-toggle-txt">Pastas</span>
      </button>
    `;

    if (this.pastaAtivaId === 'todas') {
      if (!ehAbaBib) {
        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            ${botaoDrawerHtml}
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              ${svgIcone('pasta', 18)}
              <div style="min-width:0;">
              <strong style="display:block; font-size:13px; color:#1E293B;">Todas as Pastas de Documentos (Visão Geral)</strong>
              <small style="font-size:11px; color:#64748B;">Exibindo todos os documentos locais e sincronizados (${this.documentos.length} no total)</small>
            </div>
          </div>
        `;
      } else {
        const totalArtigos = (this.estudoView?.artigosCatalogo?.() || carregarArtigosEstudo()).length;
        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            ${botaoDrawerHtml}
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              ${svgIcone('livro', 18)}
              <div style="min-width:0;">
              <strong style="display:block; font-size:13px; color:#1E293B;">Todas as Pastas de Bibliografia & Leituras</strong>
              <small style="font-size:11px; color:#64748B;">Exibindo todos os artigos, fichamentos e PDFs vinculados (${totalArtigos} no total)</small>
            </div>
          </div>
        `;
      }
    } else {
      const pastaInfo = buscarPastaNaArvore(this.pastasDrive, this.pastaAtivaId) || {
        nome: this.pastaAtivaId === 'compartilhados_comigo' ? 'Compartilhados comigo' : 'Pasta Selecionada',
        tipo: ehAbaBib ? 'bibliografia' : 'relatorios'
      };

      if (!ehAbaBib) {
        const docsNaPasta = this.documentos.filter(d => {
          const pId = this.pastaEfetivaDoDoc(d);
          return pId === this.pastaAtivaId;
        });

        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            ${botaoDrawerHtml}
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              ${svgIcone('pasta', 20)}
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Pasta de Documentos:</span>
                <strong style="font-size:13.5px; color:#314F79; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(pastaInfo.nome)}</strong>
                <span class="ath-badge ath-badge-info" style="font-size:10px;">${pastaInfo.origem === 'compartilhada' ? 'Compartilhada' : 'Minha Pasta'}</span>
              </div>
              <small style="font-size:11px; color:#64748B; display:block; margin-top:1px;">
                ${docsNaPasta.length} documento(s) nesta pasta · Mostrando apenas relatórios e artigos selecionados
              </small>
            </div>
          </div>
        `;
      } else {
        const artigos = this.estudoView?.artigosCatalogo?.() || carregarArtigosEstudo();
        const artigosNaPasta = artigos.filter(a => this.pastaAtivaId === 'compartilhados_comigo' ? a.compartilhadoComigo : artigoEstaNaPasta(a, this.pastaAtivaId));

        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            ${botaoDrawerHtml}
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              ${svgIcone('livro', 20)}
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Pasta de Bibliografia:</span>
                <strong style="font-size:13.5px; color:#314F79; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(pastaInfo.nome)}</strong>
                <span class="ath-badge ath-badge-info" style="font-size:10px;">${pastaInfo.origem === 'compartilhada' ? 'Compartilhada' : 'Minha Pasta'}</span>
              </div>
              <small style="font-size:11px; color:#64748B; display:block; margin-top:1px;">
                ${artigosNaPasta.length} artigo(s) / fichamento(s) nesta pasta · Mostrando apenas bibliografia selecionada
              </small>
            </div>
          </div>
        `;
      }
    }

    bannerEl.querySelector('#athBtnTogglePastasBanner')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.alternarDrawerPastas();
    });
  }
};
