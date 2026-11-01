// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel de Integração com Zotero e Biblioteca de Leitura.
 * Pesquisa em tempo real, inserção de citações e fichamento/resumos pessoais.
 */

import { ZoteroClient } from '../core/athenes_zotero.js';
import { svgIcone } from './athenes_icones.js';

export class PainelZotero {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.client = new ZoteroClient();
    this.referenciasCache = [];
    this.itemSelecionado = null;
    this.conectado = false;
    this.onInserirCitacao = opcoes.onInserirCitacao || (() => {});
    this.onAlterado = opcoes.onAlterado || (() => {});

    // Carrega credenciais salvas do localStorage
    this.carregarCredenciais();
    this.renderizar();
  }

  carregarCredenciais() {
    try {
      const salvo = localStorage.getItem('athenes_zotero_cfg');
      if (salvo) {
        const cfg = JSON.parse(salvo);
        this.client.userId = cfg.userId || '';
        this.client.apiKey = cfg.apiKey || '';
        this.client.isGroup = Boolean(cfg.isGroup);
      }
    } catch (_) {}
  }

  salvarCredenciais() {
    try {
      localStorage.setItem('athenes_zotero_cfg', JSON.stringify({
        userId: this.client.userId,
        apiKey: this.client.apiKey,
        isGroup: this.client.isGroup
      }));
    } catch (_) {}
  }

  setDocumento(doc) {
    this.doc = doc;
    this.renderizar();
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'ath-zotero-painel';

    root.innerHTML = `
      <div class="ath-zotero-status-box">
        <div class="ath-zotero-status-indicador">
          <span class="ath-status-dot ${this.conectado ? 'conectado' : ''}"></span>
          <span>${this.conectado ? 'Zotero Conectado' : 'Zotero Offline / Local'}</span>
        </div>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnCfgZotero" title="Configurar Conexão Zotero">${svgIcone('config', 14)}</button>
      </div>

      <div class="ath-zotero-busca-input">
        <input type="text" class="ath-input" id="athZoteroBusca" placeholder="Pesquisar referências (autor, título, ano)...">
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-size:12px; text-transform:uppercase; color:var(--ath-muted); letter-spacing:.05em;">Biblioteca de Leitura</strong>
        <label class="ath-btn ath-btn-sm" style="cursor:pointer;" title="Importar arquivo .bib do Zotero">
          ${svgIcone('mais', 12)} Importar BibTeX
          <input type="file" accept=".bib,.txt" id="athInputBibtex" style="display:none;">
        </label>
      </div>

      <div class="ath-zotero-lista" id="athZoteroLista">
        <!-- Itens da biblioteca -->
      </div>

      <div id="athZoteroDetalhesBox"></div>
    `;

    // Eventos
    const btnCfg = root.querySelector('#athBtnCfgZotero');
    btnCfg.addEventListener('click', () => this.abrirModalConfig());

    const inputBusca = root.querySelector('#athZoteroBusca');
    inputBusca.addEventListener('input', () => this.filtrarLista(inputBusca.value));

    const inputBib = root.querySelector('#athInputBibtex');
    inputBib.addEventListener('change', e => this.processarArquivoBibtex(e.target.files[0]));

    this.container.appendChild(root);

    // Se o documento já possui referências vinculadas, usá-las
    if (this.doc.referencias && this.doc.referencias.length > 0) {
      this.referenciasCache = [...this.doc.referencias];
      this.atualizarListaItens();
    } else if (this.client.userId && this.client.apiKey) {
      this.sincronizarZotero();
    } else {
      this.atualizarListaItens();
    }
  }

  async sincronizarZotero() {
    try {
      const itens = await this.client.buscarItens({ limite: 40 });
      this.conectado = true;
      this.referenciasCache = itens;
      this.atualizarListaItens();
    } catch (err) {
      this.conectado = false;
      this.atualizarListaItens();
    }
  }

  processarArquivoBibtex(arquivo) {
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const conteudo = ev.target.result;
      const novos = this.client.importarBibTeX(conteudo);
      this.referenciasCache = [...this.referenciasCache, ...novos];

      // Adiciona ao documento
      for (const n of novos) {
        if (!this.doc.referencias.some(r => r.id === n.id)) {
          this.doc.referencias.push(n);
        }
      }
      this.onAlterado();
      this.atualizarListaItens();
    };
    reader.readAsText(arquivo);
  }

  filtrarLista(termo) {
    const q = (termo || '').toLowerCase().trim();
    if (!q) {
      this.atualizarListaItens(this.referenciasCache);
      return;
    }
    const filtrados = this.referenciasCache.filter(r => {
      const txt = `${r.titulo} ${r.ano} ${(r.autores || []).map(a => a.sobrenome + ' ' + a.prenome).join(' ')} ${(r.palavrasChave || []).join(' ')}`.toLowerCase();
      return txt.includes(q);
    });
    this.atualizarListaItens(filtrados);
  }

  atualizarListaItens(lista = this.referenciasCache) {
    const listaEl = this.container.querySelector('#athZoteroLista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    if (lista.length === 0) {
      listaEl.innerHTML = `
        <div style="padding:24px 12px; text-align:center; color:var(--ath-muted); font-size:12.5px;">
          Nenhuma referência encontrada.<br>
          <small>Conecte sua conta Zotero ou importe um arquivo .bib acima.</small>
        </div>
      `;
      return;
    }

    for (const ref of lista) {
      const card = document.createElement('div');
      card.className = `ath-ref-card ${this.itemSelecionado?.id === ref.id ? 'selecionado' : ''}`;

      const autoresTxt = (ref.autores || []).map(a => a.sobrenome).slice(0, 3).join(', ') + ((ref.autores?.length || 0) > 3 ? ' et al.' : '');

      card.innerHTML = `
        <div class="ath-ref-card-titulo">${ref.titulo}</div>
        <div class="ath-ref-card-autores">${autoresTxt}</div>
        <div class="ath-ref-card-meta">
          <span>${ref.ano || 's.d.'} · ${ref.publicacao || ref.editora || 'Publicação'}</span>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm ath-btn-citar" title="Inserir Citação no Texto">Citar</button>
        </div>
      `;

      card.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('ath-btn-citar')) {
          ev.stopPropagation();
          this.inserirCitacaoNoDocumento(ref);
          return;
        }
        this.selecionarItem(ref);
      });

      listaEl.appendChild(card);
    }
  }

  selecionarItem(ref) {
    this.itemSelecionado = ref;
    this.atualizarListaItens();

    const detalhesBox = this.container.querySelector('#athZoteroDetalhesBox');
    if (!detalhesBox) return;

    // Busca nota de leitura / fichamento pessoal do documento
    let nota = this.doc.notasLeitura?.find(n => n.referenciaId === ref.id);
    if (!nota) {
      nota = { referenciaId: ref.id, texto: '', tags: [] };
      if (!this.doc.notasLeitura) this.doc.notasLeitura = [];
      this.doc.notasLeitura.push(nota);
    }

    detalhesBox.innerHTML = `
      <div class="ath-leitura-detalhes">
        <strong style="display:block; font-size:12px; margin-bottom:4px;">Resumo Oficial da Obra:</strong>
        <div class="ath-leitura-resumo-box">${ref.resumo || 'Nenhum resumo informado pelo registro.'}</div>

        <div class="ath-leitura-fichamento-label">Meu Fichamento / Notas Pessoais:</div>
        <textarea class="ath-leitura-fichamento-input" id="athFichamentoTxt" placeholder="Escreva aqui suas sínteses, citações favoritas e reflexões sobre a obra...">${nota.texto || ''}</textarea>
        <span style="font-size:10.5px; color:var(--ath-muted); display:block; margin-top:2px;">Suas notas pessoais não sobrescrevem os dados originais do Zotero.</span>
      </div>
    `;

    const txtArea = detalhesBox.querySelector('#athFichamentoTxt');
    txtArea.addEventListener('input', () => {
      nota.texto = txtArea.value;
      this.onAlterado();
    });
  }

  inserirCitacaoNoDocumento(ref) {
    // Garante que a referência está registrada no catálogo do documento
    if (!this.doc.referencias.some(r => r.id === ref.id)) {
      this.doc.referencias.push(ref);
      this.onAlterado();
    }
    this.onInserirCitacao(ref);
  }

  abrirModalConfig() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal">
        <div class="ath-modal-head">
          <h2>Conectar Biblioteca Zotero</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:13px; color:var(--ath-text-secondary); margin-top:0;">
            Acesse seus artigos e coleções diretamente no Athenes utilizando a Zotero Web API oficial.
          </p>

          <div class="ath-prop-grupo">
            <label>ID de Usuário Zotero (User ID)</label>
            <input type="text" class="ath-input" id="athZoteroUserId" value="${this.client.userId}" placeholder="Ex.: 1234567">
            <small style="color:var(--ath-muted);">Encontrado em zotero.org/settings/keys</small>
          </div>

          <div class="ath-prop-grupo">
            <label>Chave de API (API Key)</label>
            <input type="password" class="ath-input" id="athZoteroApiKey" value="${this.client.apiKey}" placeholder="Chave de leitura (ex.: aBcDeF123456...)">
            <small style="color:var(--ath-muted);">Gere uma chave com permissão de leitura em zotero.org</small>
          </div>

          <div id="athZoteroMsgStatus" style="font-size:12.5px; margin-top:10px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athBtnTestarZotero">Testar Conexão</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athBtnSalvarZotero">Salvar e Sincronizar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fechar = () => modal.remove();
    modal.querySelector('#athModalFechar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const msgStatus = modal.querySelector('#athZoteroMsgStatus');

    modal.querySelector('#athBtnTestarZotero').addEventListener('click', async () => {
      this.client.userId = modal.querySelector('#athZoteroUserId').value.trim();
      this.client.apiKey = modal.querySelector('#athZoteroApiKey').value.trim();
      msgStatus.innerHTML = '<span style="color:var(--ath-muted);">Testando autenticação...</span>';

      const res = await this.client.testarConexao();
      if (res.ok) {
        msgStatus.innerHTML = `<span style="color:var(--ath-ok); font-weight:700;">Conectado com sucesso como: ${res.nomeUsuario}</span>`;
      } else {
        msgStatus.innerHTML = `<span style="color:var(--ath-danger); font-weight:700;">${res.mensagem}</span>`;
      }
    });

    modal.querySelector('#athBtnSalvarZotero').addEventListener('click', async () => {
      this.client.userId = modal.querySelector('#athZoteroUserId').value.trim();
      this.client.apiKey = modal.querySelector('#athZoteroApiKey').value.trim();
      this.salvarCredenciais();
      fechar();
      await this.sincronizarZotero();
      this.renderizar();
    });
  }
}
