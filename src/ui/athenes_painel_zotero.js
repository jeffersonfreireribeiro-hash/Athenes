// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel de Integração com Zotero e Biblioteca de Leitura.
 * Pesquisa em tempo real, filtros avançados (tipo, período, ordenação),
 * inserção de citações e fichamento/resumos pessoais.
 */

import { lerConta, gravarConta } from '../core/athenes_conta.js';
import { gravarConfigZotero } from '../core/athenes_zotero_config.js';
import { ZoteroClient } from '../core/athenes_zotero.js';
import * as bib from '../core/athenes_biblioteca_artigos.js';
import { svgIcone } from './athenes_icones.js';
import { ESTILOS_CITACAO, ESTILOS_CSL, eEstiloNumerico, estiloDoDocumento, referenciaDoArtigo, chaveDoZoteroDe, formatarCitacaoTexto, indiceNaLista, intervaloDePaginas, validarPaginas } from '../core/athenes_citacao.js';

export function classificarTipoRef(ref) {
  if (!ref) return { id: 'outro', label: 'Outro', bg: '#F1F5F9', cor: '#475569' };
  const t = String(ref.tipo || ref.itemTypeZotero || '').toLowerCase();
  if (t.includes('artigo') || t === 'journalarticle' || t === 'article' || ref.publicacao) {
    return { id: 'artigo', label: 'Artigo', bg: '#EFF6FF', cor: '#1D4ED8' };
  }
  if (t.includes('livro') || t.includes('capitulo') || t === 'book' || t === 'booksection' || ref.editora) {
    return { id: 'livro', label: 'Livro', bg: '#ECFDF5', cor: '#047857' };
  }
  if (t.includes('tese') || t.includes('dissertacao') || t === 'thesis') {
    return { id: 'tese', label: 'Tese/Dissertação', bg: '#FAF5FF', cor: '#7E22CE' };
  }
  if (t.includes('conferencia') || t.includes('congresso') || t === 'conferencepaper') {
    return { id: 'conferencia', label: 'Conferência', bg: '#FFFBEB', cor: '#B45309' };
  }
  return { id: 'outro', label: 'Referência', bg: '#F1F5F9', cor: '#475569' };
}

const escaparAttr = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export class PainelZotero {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.client = new ZoteroClient();
    this.referenciasCache = [];
    this.itemSelecionado = null;
    this.conectado = false;
    this.filtroTermo = '';
    this.filtroTipo = 'todos'; // todos | artigo | livro | tese | conferencia
    this.filtroOrdenacao = 'ano_desc'; // ano_desc | ano_asc | autor_asc | titulo_asc
    this.filtroPeriodo = 'todos'; // todos | ultimos_5 | ultimos_10 | anteriores
    this.onInserirCitacao = opcoes.onInserirCitacao || (() => {});
    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onInserirCitacaoLonga = opcoes.onInserirCitacaoLonga || (() => {});

    // Carrega credenciais salvas do localStorage
    this.carregarCredenciais();
    this.renderizar();
  }

  carregarCredenciais() {
    try {
      const salvo = lerConta('athenes_zotero_cfg');
      if (salvo) {
        const cfg = JSON.parse(salvo);
        this.client.userId = cfg.userId || '';
        this.client.apiKey = cfg.apiKey || '';
        this.client.isGroup = Boolean(cfg.isGroup);
      }
    } catch (_) {}
  }

  salvarCredenciais() {
    gravarConfigZotero({ userId: this.client.userId, apiKey: this.client.apiKey, isGroup: this.client.isGroup });
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
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.flex = '1 1 auto'; root.style.minHeight = '0'; // a janela acompanha o conteúdo (até 85% da tela)
    root.style.boxSizing = 'border-box';
    root.style.padding = '12px 16px';
    root.style.overflowY = 'hidden';
    root.style.gap = '8px';

    // Calcula contagens para as badges das abas
    const est = estiloDoDocumento(this.doc);
    const totalRef = this.referenciasCache.length;
    let nArt = 0;
    let nLiv = 0;
    let nTese = 0;
    let nConf = 0;
    let nEstudo = 0;
    for (const r of this.referenciasCache) {
      const cat = classificarTipoRef(r).id;
      if (cat === 'artigo') nArt++;
      else if (cat === 'livro') nLiv++;
      else if (cat === 'tese') nTese++;
      else if (cat === 'conferencia') nConf++;
      if (r.fichamento || r.temPdf || r.pdfUrl || r.citacoesMarcadas?.length) nEstudo++;
    }

    root.innerHTML = `
      <!-- Topo: Status Zotero + Botão Importar BibTeX -->
      <div class="ath-zotero-status-box" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
        <div class="ath-zotero-status-indicador" style="display:flex; align-items:center; gap:8px;">
          <span class="ath-status-dot ${this.conectado ? 'conectado' : ''}" style="width:8px; height:8px; border-radius:50%; background:${this.conectado ? '#10B981' : '#94A3B8'}; display:inline-block;"></span>
          <span style="font-size:11.5px; font-weight:700; color:#334155;">${this.conectado ? 'Zotero Conectado' : 'Zotero Offline / Local'}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <label class="glx-btn glx-btn-xs glx-btn-soft" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:11px;" title="Importar arquivo .bib exportado do Zotero ou Mendeley">
            ${svgIcone('mais', 11)} Importar BibTeX
            <input type="file" accept=".bib,.txt" id="athInputBibtex" style="display:none;">
          </label>
          <button type="button" class="ath-btn ath-btn-sm" id="athBtnCfgZotero" title="Configurar Conexão Zotero" style="width:28px; height:28px; padding:0; display:grid; place-items:center;">
            ${svgIcone('config', 13)}
          </button>
        </div>
      </div>

      <!-- Estilo de citação no texto -->
      <div id="athZoteroEstilo" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 10px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; font-size:11.5px; color:#334155;">
        <label style="display:flex; align-items:center; gap:6px; font-weight:700;">Estilo
          <select id="athCitEstilo" class="glx-select" style="height:26px; font-size:11px;" title="Estilo da citação no texto">
            ${ESTILOS_CITACAO.map(e => `<option value="${e.id}" ${est.estilo === e.id ? 'selected' : ''}>${e.rotulo}</option>`).join('')}
          </select>
        </label>
        <label id="athCitCslBox" style="display:${est.estilo === 'zotero' ? 'flex' : 'none'}; align-items:center; gap:6px; font-weight:700;" title="Estilo CSL pedido ao Zotero (precisa da conexão com a sua conta)">CSL
          <select id="athCitCsl" class="glx-select" style="height:26px; font-size:11px;">
            ${ESTILOS_CSL.map(e => `<option value="${e.id}" ${est.csl === e.id ? 'selected' : ''}>${e.rotulo}</option>`).join('')}
          </select>
        </label>
        <label style="display:flex; align-items:center; gap:4px; cursor:pointer;" title="A citação leva ao item correspondente na lista de referências (no editor, no PDF e no Word)">
          <input type="checkbox" id="athCitLinkar" ${est.linkar ? 'checked' : ''}> Linkar à referência
        </label>
      </div>

      <!-- Duas colunas: obras à esquerda; resumo, fichamento e citação longa à direita (uma só em tela estreita) -->
      <div class="ath-zotero-colunas">
      <div class="ath-zotero-col-esq">
      <!-- Barra de Pesquisa Rápida -->
      <div style="position:relative; width:100%; box-sizing:border-box;">
        <input type="text" class="ath-input" id="athZoteroBusca" value="${this.filtroTermo}" placeholder="Pesquisar referências (autor, título, ano, resumo)..." style="width:100%; box-sizing:border-box; padding-right:26px; height:32px; font-size:12px;">
        ${this.filtroTermo ? `<button type="button" id="athZoteroLimparBusca" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); border:none; background:transparent; cursor:pointer; color:#94A3B8; font-size:12px;" title="Limpar busca">✕</button>` : ''}
      </div>

      <!-- Filtros por Categoria / Tipo de Obra (Abas / Pills) -->
      <div style="display:flex; gap:4px; overflow-x:auto; padding-bottom:2px;" id="athZoteroTabsTipo">
        <button type="button" class="glx-btn glx-btn-xs ${this.filtroTipo === 'todos' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-tipo="todos" style="border-radius:12px; font-size:10.5px; white-space:nowrap; padding:2px 8px;">
          Todos (${totalRef})
        </button>
        <button type="button" class="glx-btn glx-btn-xs ${this.filtroTipo === 'artigo' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-tipo="artigo" style="border-radius:12px; font-size:10.5px; white-space:nowrap; padding:2px 8px;">
          Artigos (${nArt})
        </button>
        <button type="button" class="glx-btn glx-btn-xs ${this.filtroTipo === 'livro' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-tipo="livro" style="border-radius:12px; font-size:10.5px; white-space:nowrap; padding:2px 8px;">
          Livros (${nLiv})
        </button>
        <button type="button" class="glx-btn glx-btn-xs ${this.filtroTipo === 'tese' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-tipo="tese" style="border-radius:12px; font-size:10.5px; white-space:nowrap; padding:2px 8px;">
          Teses (${nTese})
        </button>
        <button type="button" class="glx-btn glx-btn-xs ${this.filtroTipo === 'conferencia' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-tipo="conferencia" style="border-radius:12px; font-size:10.5px; white-space:nowrap; padding:2px 8px;">
          Conferências (${nConf})
        </button>
        <button type="button" class="glx-btn glx-btn-xs ${this.filtroTipo === 'fichados' ? 'glx-btn-primary' : 'glx-btn-soft'}" data-tipo="fichados" style="border-radius:12px; font-size:10.5px; white-space:nowrap; padding:2px 8px;">
          Fichados / PDF (${nEstudo})
        </button>
      </div>

      <!-- Barra Secundária: Ordenação e Período -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:4px 0;">
        <div style="display:flex; gap:6px; align-items:center;">
          <select id="athZoteroOrdem" class="glx-select" style="height:26px; font-size:11px; padding:0 18px 0 6px;" title="Critério de ordenação da lista">
            <option value="ano_desc" ${this.filtroOrdenacao === 'ano_desc' ? 'selected' : ''}>Mais Recentes (Ano ↓)</option>
            <option value="ano_asc" ${this.filtroOrdenacao === 'ano_asc' ? 'selected' : ''}>Mais Antigos (Ano ↑)</option>
            <option value="autor_asc" ${this.filtroOrdenacao === 'autor_asc' ? 'selected' : ''}>Autor (A → Z)</option>
            <option value="titulo_asc" ${this.filtroOrdenacao === 'titulo_asc' ? 'selected' : ''}>Título (A → Z)</option>
          </select>

          <select id="athZoteroPeriodo" class="glx-select" style="height:26px; font-size:11px; padding:0 18px 0 6px;" title="Filtrar por período de publicação">
            <option value="todos" ${this.filtroPeriodo === 'todos' ? 'selected' : ''}>Todos os anos</option>
            <option value="ultimos_5" ${this.filtroPeriodo === 'ultimos_5' ? 'selected' : ''}>Últimos 5 anos (2021+)</option>
            <option value="ultimos_10" ${this.filtroPeriodo === 'ultimos_10' ? 'selected' : ''}>Últimos 10 anos (2016+)</option>
            <option value="anteriores" ${this.filtroPeriodo === 'anteriores' ? 'selected' : ''}>Anteriores a 2016</option>
          </select>
        </div>
        <span id="athZoteroContador" style="font-size:11px; color:#64748B; font-weight:600; white-space:nowrap;"></span>
      </div>

      <!-- Lista de Referências Filtradas e Ordenadas -->
      <div class="ath-zotero-lista" id="athZoteroLista" style="display:flex; flex-direction:column; gap:8px;">
        <!-- Itens da biblioteca injetados dinamicamente -->
      </div>
      </div>

      <!-- Fichamento e Notas de Leitura -->
      <div class="ath-zotero-col-dir"><div id="athZoteroDetalhesBox"><div class="ath-zotero-vazio">Escolha uma obra na lista para ver o resumo, escrever o fichamento ou montar uma citação longa.</div></div></div>
      </div>
    `;

    // Eventos de Filtro e Busca
    const btnCfg = root.querySelector('#athBtnCfgZotero');
    btnCfg?.addEventListener('click', () => this.abrirModalConfig());

    const inputBusca = root.querySelector('#athZoteroBusca');
    inputBusca?.addEventListener('input', () => {
      this.filtroTermo = inputBusca.value;
      this.atualizarListaItens();
    });

    const btnLimparBusca = root.querySelector('#athZoteroLimparBusca');
    btnLimparBusca?.addEventListener('click', () => {
      this.filtroTermo = '';
      if (inputBusca) inputBusca.value = '';
      this.renderizar();
    });

    root.querySelectorAll('#athZoteroTabsTipo [data-tipo]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroTipo = btn.dataset.tipo;
        root.querySelectorAll('#athZoteroTabsTipo [data-tipo]').forEach(b => {
          b.className = `glx-btn glx-btn-xs ${b.dataset.tipo === this.filtroTipo ? 'glx-btn-primary' : 'glx-btn-soft'}`;
        });
        this.atualizarListaItens();
      });
    });

    const selOrdem = root.querySelector('#athZoteroOrdem');
    selOrdem?.addEventListener('change', e => {
      this.filtroOrdenacao = e.target.value;
      this.atualizarListaItens();
    });

    const selPeriodo = root.querySelector('#athZoteroPeriodo');
    selPeriodo?.addEventListener('change', e => {
      this.filtroPeriodo = e.target.value;
      this.atualizarListaItens();
    });

    const guardarEstilo = () => {
      this.doc.estiloCitacao = {
        estilo: root.querySelector('#athCitEstilo').value,
        linkar: root.querySelector('#athCitLinkar').checked,
        csl: root.querySelector('#athCitCsl').value
      };
      root.querySelector('#athCitCslBox').style.display = this.doc.estiloCitacao.estilo === 'zotero' ? 'flex' : 'none';
      this.onAlterado();
      this.atualizarListaItens();
    };
    ['#athCitEstilo', '#athCitCsl', '#athCitLinkar'].forEach(q => root.querySelector(q)?.addEventListener('change', guardarEstilo));
    const inputBib = root.querySelector('#athInputBibtex');
    inputBib?.addEventListener('change', e => this.processarArquivoBibtex(e.target.files[0]));

    [...root.children].forEach(c => { if (!c.classList.contains('ath-zotero-colunas')) c.style.flexShrink = '0'; }); // a área de colunas é a que rola
    this.container.appendChild(root);

    // Carrega dados iniciais e integra artigos com fichamento do estúdio
    const refsMap = new Map();
    (this.doc.referencias || []).forEach(r => refsMap.set(r.id || r.chaveZotero, r));

    // Cada artigo é convertido sozinho: um registro estranho não pode esconder a biblioteca inteira
    for (const a of (bib.obterArtigos() || [])) {
      try {
        const ref = referenciaDoArtigo(a);
        const chave = ref.id || ref.chaveZotero;
        if (chave && !refsMap.has(chave) && !(ref.chaveZotero && refsMap.has(ref.chaveZotero))) refsMap.set(chave, ref);
      } catch (e) { console.warn('[Athenes] artigo ignorado na lista de citação:', e.message); }
    }

    this.referenciasCache = Array.from(refsMap.values());

    if (this.referenciasCache.length > 0) {
      this.atualizarListaItens();
    } else if (this.client.userId && this.client.apiKey) {
      this.sincronizarZotero();
    } else {
      this.atualizarListaItens();
    }
  }

  async sincronizarZotero() {
    try {
      const itens = await this.client.buscarItens({ limite: 50 });
      this.conectado = true;
      this.referenciasCache = itens;
      this.renderizar();
    } catch (_) {
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

      for (const n of novos) {
        if (!this.doc.referencias.some(r => r.id === n.id)) {
          this.doc.referencias.push(n);
        }
      }
      this.onAlterado();
      this.renderizar();
    };
    reader.readAsText(arquivo);
  }

  obterListaFiltradaEOrdenada() {
    let lista = [...this.referenciasCache];

    // 1. Filtro por Termo de Busca
    const q = (this.filtroTermo || '').toLowerCase().trim();
    if (q) {
      lista = lista.filter(r => {
        const autores = (r.autores || []).map(a => `${a.sobrenome} ${a.prenome || ''}`).join(' ');
        const tags = (r.palavrasChave || []).join(' ');
        const textoComp = `${r.titulo || ''} ${r.ano || ''} ${autores} ${tags} ${r.publicacao || ''} ${r.editora || ''} ${r.resumo || ''}`.toLowerCase();
        return textoComp.includes(q);
      });
    }

    // 2. Filtro por Categoria / Tipo
    if (this.filtroTipo === 'fichados') {
      lista = lista.filter(r => r.fichamento || r.temPdf || r.pdfUrl || r.citacoesMarcadas?.length);
    } else if (this.filtroTipo !== 'todos') {
      lista = lista.filter(r => classificarTipoRef(r).id === this.filtroTipo);
    }

    // 3. Filtro por Período
    const anoAtual = new Date().getFullYear();
    if (this.filtroPeriodo === 'ultimos_5') {
      lista = lista.filter(r => {
        const ano = parseInt(r.ano, 10);
        return !isNaN(ano) && ano >= (anoAtual - 5);
      });
    } else if (this.filtroPeriodo === 'ultimos_10') {
      lista = lista.filter(r => {
        const ano = parseInt(r.ano, 10);
        return !isNaN(ano) && ano >= (anoAtual - 10);
      });
    } else if (this.filtroPeriodo === 'anteriores') {
      lista = lista.filter(r => {
        const ano = parseInt(r.ano, 10);
        return !isNaN(ano) && ano < (anoAtual - 10);
      });
    }

    // 4. Ordenação
    lista.sort((a, b) => {
      if (this.filtroOrdenacao === 'ano_desc') {
        const anoA = parseInt(a.ano, 10) || 0;
        const anoB = parseInt(b.ano, 10) || 0;
        return anoB - anoA;
      }
      if (this.filtroOrdenacao === 'ano_asc') {
        const anoA = parseInt(a.ano, 10) || 9999;
        const anoB = parseInt(b.ano, 10) || 9999;
        return anoA - anoB;
      }
      if (this.filtroOrdenacao === 'autor_asc') {
        const sobA = (a.autores?.[0]?.sobrenome || '').toLowerCase();
        const sobB = (b.autores?.[0]?.sobrenome || '').toLowerCase();
        return sobA.localeCompare(sobB, 'pt-BR');
      }
      if (this.filtroOrdenacao === 'titulo_asc') {
        return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR');
      }
      return 0;
    });

    return lista;
  }

  atualizarListaItens() {
    const listaEl = this.container.querySelector('#athZoteroLista');
    const contadorEl = this.container.querySelector('#athZoteroContador');
    if (!listaEl) return;

    const lista = this.obterListaFiltradaEOrdenada();
    listaEl.innerHTML = '';

    if (contadorEl) {
      contadorEl.textContent = `Exibindo ${lista.length} de ${this.referenciasCache.length}`;
    }

    if (lista.length === 0) {
      listaEl.innerHTML = `
        <div style="padding:28px 12px; text-align:center; color:var(--ath-muted); font-size:12px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:8px;">
          Nenhuma referência encontrada com os filtros selecionados.<br>
          <small style="color:#94A3B8;">Tente mudar os filtros de tipo/ano ou importar novas referências.</small>
        </div>
      `;
      return;
    }

    for (const ref of lista) {
      const card = document.createElement('div');
      card.className = `ath-ref-card ${this.itemSelecionado?.id === ref.id ? 'selecionado' : ''}`;
      card.style.position = 'relative';
      card.style.transition = 'all 0.15s ease';

      const cat = classificarTipoRef(ref);
      const botoesCitar = this.botoesDeCitacao(ref);
      const autoresTxt = (ref.autores || []).map(a => a.sobrenome).slice(0, 3).join(', ') + ((ref.autores?.length || 0) > 3 ? ' et al.' : '');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:800; text-transform:uppercase; background:${cat.bg}; color:${cat.cor}; padding:2px 6px; border-radius:4px; letter-spacing:0.04em;">
            ${cat.label}
          </span>
          <span style="font-size:11px; font-weight:800; color:#314F79;">${ref.ano || 's.d.'}</span>
        </div>
        <div class="ath-ref-card-titulo" style="font-size:12.5px; font-weight:700; color:#0F172A; line-height:1.35; margin-bottom:4px;">${ref.titulo}</div>
        <div class="ath-ref-card-autores" style="font-size:11.5px; color:#475569; margin-bottom:6px;">${autoresTxt || 'Autoria não informada'}</div>
        <div class="ath-ref-card-meta" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #F1F5F9; padding-top:6px; margin-top:4px; gap:8px;">
          <span style="font-size:10.5px; color:#64748B; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;" title="${ref.publicacao || ref.editora || ''}">
            ${ref.publicacao || ref.editora || 'Biblioteca Geral'}
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <label style="display:flex; align-items:center; gap:4px; font-size:10.5px; color:#475569; font-weight:700;" title="${escaparAttr(this.dicaPagina(ref))}">Pág.
            <input type="text" class="ath-cit-pag" value="${escaparAttr(this.paginas[ref.id] || '')}" placeholder="${escaparAttr(intervaloDePaginas(ref)?.texto || '—')}" style="width:64px; height:22px; font-size:11px; padding:0 6px; border:1px solid #CBD5E1; border-radius:6px;">
            <small class="ath-cit-pag-dica" style="font-weight:600; color:#64748B;">${escaparAttr(this.dicaCurta(ref))}</small>
          </label>
          <div class="ath-cit-botoes" style="display:flex; gap:4px; align-items:center; flex-shrink:0;">${botoesCitar}</div>
        </div>
      `;

      const campoPag = card.querySelector('.ath-cit-pag');
      campoPag.addEventListener('input', () => {
        this.paginas[ref.id] = campoPag.value;
        const v = validarPaginas(campoPag.value, intervaloDePaginas(ref));
        campoPag.style.borderColor = v.ok ? '#CBD5E1' : '#DC2626';
        card.querySelector('.ath-cit-pag-dica').textContent = v.ok ? this.dicaCurta(ref) : v.mensagem;
        card.querySelector('.ath-cit-pag-dica').style.color = v.ok ? '#64748B' : '#DC2626';
        card.querySelector('.ath-cit-botoes').innerHTML = this.botoesDeCitacao(ref);
      });

      card.addEventListener('click', ev => {
        if (ev.target.closest('.ath-cit-pag')) { ev.stopPropagation(); return; }
        if (ev.target.closest('.ath-btn-longa')) {
          ev.stopPropagation();
          this.selecionarItem(ref);
          this.container.querySelector('#athZoteroLongaBox')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        const btnCitar = ev.target.closest('.ath-btn-citar');
        if (btnCitar) {
          ev.stopPropagation();
          const formato = btnCitar.dataset.formato || 'parentese';
          this.inserirCitacaoNoDocumento(ref, formato);
          return;
        }
        this.selecionarItem(ref);
      });

      listaEl.appendChild(card);
    }
  }

  get paginas() { return (this._paginas ||= {}); }

  /** Página digitada para a obra, já conferida contra o intervalo dela ({ ok, valor, mensagem }). */
  paginaDaObra(ref) { return validarPaginas(this.paginas[ref.id], intervaloDePaginas(ref)); }

  dicaCurta(ref) {
    const iv = intervaloDePaginas(ref);
    return iv ? `${iv.origem === 'pdf' ? 'PDF: ' : 'disp.: '}${iv.texto}` : '';
  }

  dicaPagina(ref) {
    const iv = intervaloDePaginas(ref);
    if (!iv) return 'Página ou intervalo (opcional), ex.: 15 ou 15-17';
    return iv.origem === 'pdf'
      ? `Opcional. O PDF vinculado tem ${iv.texto} página(s); informe a página da publicação, se souber.`
      : `Opcional. Páginas da publicação: ${iv.texto}.`;
  }

  /** Botões de inserir, com o texto exato que será colocado no documento (conforme estilo e página). */
  botoesDeCitacao(ref) {
    const est = estiloDoDocumento(this.doc);
    const pag = this.paginaDaObra(ref);
    const base = { estilo: est.estilo, pagina: pag.ok ? pag.valor : '', indice: indiceNaLista(this.doc, ref) };
    const rotulo = (formato) => escaparAttr(est.estilo === 'zotero' ? (formato === 'narrativa' ? 'Narrativa' : 'Citar') : formatarCitacaoTexto(ref, { ...base, formato }));
    const lim = pag.ok ? '' : ' disabled';
    const botao = (formato, classe, extra) => `<button type="button" class="glx-btn glx-btn-xs ${classe} ath-btn-citar" data-formato="${formato}"${lim} style="padding:2px 8px; font-weight:700; border-radius:6px; font-size:10.5px; ${pag.ok ? '' : 'opacity:.45; cursor:not-allowed;'}${extra}" title="${pag.ok ? 'Inserir no texto: ' + rotulo(formato) : escaparAttr(pag.mensagem)}">${rotulo(formato)}</button>`;
    const unico = eEstiloNumerico(est.estilo) || est.estilo === 'zotero';
    const longa = `<button type="button" class="glx-btn glx-btn-xs glx-btn-soft ath-btn-longa" style="padding:2px 8px; font-weight:700; border-radius:6px; font-size:10.5px; border:1px solid #CBD5E1;" title="Citação direta longa (mais de 3 linhas): bloco recuado com a referência">Longa</button>`;
    return botao('parentese', 'glx-btn-primary', '') + (unico ? '' : botao('narrativa', 'glx-btn-soft', 'border:1px solid #CBD5E1;')) + longa;
  }

  /** Texto da citação no estilo do documento; no modo Zotero pede ao serviço e, sem resposta, cai no ABNT local. */
  async textoDaCitacao(ref, pagina, formato = 'parentese') {
    const est = estiloDoDocumento(this.doc);
    const base = { estilo: est.estilo, pagina, formato, indice: indiceNaLista(this.doc, ref) };
    if (est.estilo === 'zotero') {
      const t = await this.client.obterCitacaoFormatada(chaveDoZoteroDe(ref), est.csl);
      if (t) return pagina ? t.replace(/\)$/, `, p. ${pagina})`) : t;
      base.estilo = 'abnt';
    }
    return formatarCitacaoTexto(ref, base);
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
      <div class="ath-leitura-detalhes" style="margin-top:10px; padding-top:10px; border-top:1px dashed #CBD5E1;">
        <strong style="display:block; font-size:11.5px; margin-bottom:4px; color:#314F79;">Resumo Oficial da Obra:</strong>
        <div class="ath-leitura-resumo-box" style="font-size:11.5px; line-height:1.4; max-height:80px; overflow-y:auto; background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:6px; color:#334155;">
          ${ref.resumo || 'Nenhum resumo informado pelo registro.'}
        </div>

        <div class="ath-leitura-fichamento-label" style="font-size:11.5px; font-weight:700; margin-top:8px; color:#1E293B;">Meu Fichamento / Notas Pessoais:</div>
        <textarea class="ath-leitura-fichamento-input" id="athFichamentoTxt" placeholder="Escreva aqui suas sínteses, citações favoritas e reflexões sobre a obra..." style="width:100%; box-sizing:border-box; height:60px; font-size:11.5px; border-radius:6px; margin-top:4px; padding:6px 8px; border:1px solid #CBD5E1;">${nota.texto || ''}</textarea>
        <span style="font-size:10px; color:#64748B; display:block; margin-top:2px;">Suas notas pessoais não sobrescrevem os dados originais do Zotero.</span>
      </div>
    `;

    this.montarCitacaoLonga(detalhesBox, ref);

    const txtArea = detalhesBox.querySelector('#athFichamentoTxt');
    txtArea?.addEventListener('input', () => {
      nota.texto = txtArea.value;
      this.onAlterado();
    });
  }

  /** Seção "Citação direta longa": trecho (de um destaque do fichamento ou colado) vira bloco recuado com a referência. */
  montarCitacaoLonga(detalhesBox, ref) {
    const iv = intervaloDePaginas(ref);
    const marcadas = (ref.citacoesMarcadas || []).filter(c => c?.texto);
    const caixa = document.createElement('div');
    caixa.id = 'athZoteroLongaBox';
    caixa.style.cssText = 'margin-top:10px; padding-top:10px; border-top:1px dashed #CBD5E1;';
    caixa.innerHTML = `
      <strong style="display:block; font-size:11.5px; margin-bottom:4px; color:#314F79;">Citação direta longa (mais de 3 linhas)</strong>
      ${marcadas.length ? `<div style="font-size:10.5px; color:#64748B; margin-bottom:4px;">Destaques marcados na leitura deste artigo (${marcadas.length}):</div>
      <div id="athLongaLista" style="max-height:170px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
        ${marcadas.map((c, i) => `<div class="ath-longa-item" data-i="${i}" style="border:1px solid #E2E8F0; border-left:4px solid ${escaparAttr(c.cor || '#314F79')}; border-radius:6px; padding:6px 8px; background:#fff;">
          <div style="font-size:11px; line-height:1.35; color:#334155; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${escaparAttr(c.texto)}</div>
          <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
            <span style="font-size:10px; font-weight:700; color:#64748B; flex:1;">${c.paginaCitacao ? 'p. ' + escaparAttr(c.paginaCitacao) : (c.pagina ? 'PDF p. ' + escaparAttr(c.pagina) : 'sem página')}</span>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" data-longa-editar style="padding:1px 8px; font-size:10.5px;">Editar antes</button>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" data-longa-inserir style="padding:1px 8px; font-size:10.5px; font-weight:700;">Inserir como citação longa</button>
          </div>
        </div>`).join('')}
      </div>` : ''}
      <textarea id="athLongaTexto" placeholder="Ou cole aqui outro trecho da obra, sem aspas: entra como bloco recuado, em fonte menor, com a referência no fim." style="width:100%; box-sizing:border-box; height:70px; font-size:11.5px; border-radius:6px; padding:6px 8px; border:1px solid #CBD5E1;"></textarea>
      <div style="display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;">
        <label style="display:flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:#475569;">Pág.
          <input type="text" id="athLongaPag" placeholder="${escaparAttr(iv?.texto || '—')}" style="width:72px; height:24px; font-size:11px; padding:0 6px; border:1px solid #CBD5E1; border-radius:6px;">
        </label>
        <small id="athLongaDica" style="font-size:10.5px; color:#64748B; flex:1;">${escaparAttr(this.dicaPagina(ref))}</small>
        <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnInserirLonga" style="padding:3px 10px; font-weight:700; border-radius:6px;">Inserir citação longa</button>
      </div>`;
    detalhesBox.appendChild(caixa);

    const txt = caixa.querySelector('#athLongaTexto');
    const pag = caixa.querySelector('#athLongaPag');
    const dica = caixa.querySelector('#athLongaDica');
    const btn = caixa.querySelector('#athBtnInserirLonga');
    const conferir = () => {
      const v = validarPaginas(pag.value, iv);
      pag.style.borderColor = v.ok ? '#CBD5E1' : '#DC2626';
      dica.textContent = v.ok ? this.dicaPagina(ref) : v.mensagem;
      dica.style.color = v.ok ? '#64748B' : '#DC2626';
      btn.disabled = !v.ok || !txt.value.trim();
      btn.style.opacity = btn.disabled ? '.5' : '1';
      return v;
    };
    const paginaDoDestaque = (c) => c.paginaCitacao || (iv?.origem === 'pdf' ? (c.pagina || '') : '');
    const inserir = async (texto, pagina) => {
      const v = validarPaginas(pagina, iv);
      if (!v.ok) { dica.textContent = v.mensagem; dica.style.color = '#DC2626'; return; }
      if (!String(texto).trim()) return;
      const est = estiloDoDocumento(this.doc);
      const refTexto = await this.textoDaCitacao(ref, v.valor);
      this.onInserirCitacaoLonga(ref, { texto, pagina: v.valor, refTexto, linkar: est.linkar });
    };
    caixa.querySelectorAll('.ath-longa-item').forEach(item => {
      const c = marcadas[Number(item.dataset.i)];
      const bruto = paginaDoDestaque(c);
      const ok = validarPaginas(bruto, iv).ok;
      const botao = item.querySelector('[data-longa-inserir]');
      if (!ok) { botao.disabled = true; botao.style.opacity = '.5'; botao.title = `A página ${bruto} está fora do intervalo da obra (${iv?.texto}). Use "Editar antes" para corrigir.`; }
      botao.addEventListener('click', () => inserir(c.texto, bruto));
      item.querySelector('[data-longa-editar]').addEventListener('click', () => {
        txt.value = c.texto;
        pag.value = bruto;
        conferir();
        txt.focus();
      });
    });
    txt.addEventListener('input', conferir);
    pag.addEventListener('input', conferir);
    conferir();

    btn.addEventListener('click', async () => {
      const v = conferir();
      if (!v.ok || !txt.value.trim()) return;
      if (!this.doc.referencias) this.doc.referencias = [];
      const est = estiloDoDocumento(this.doc);
      const refTexto = await this.textoDaCitacao(ref, v.valor);
      this.onInserirCitacaoLonga(ref, { texto: txt.value, pagina: v.valor, refTexto, linkar: est.linkar });
    });
  }

  async inserirCitacaoNoDocumento(ref, formato = 'parentese') {
    if (!this.doc.referencias) this.doc.referencias = [];
    if (!this.doc.referencias.some(r => r.id === ref.id)) {
      this.doc.referencias.push(ref);
      this.onAlterado();
    }
    const est = estiloDoDocumento(this.doc);
    const pag = this.paginaDaObra(ref);
    if (!pag.ok) return;
    const opcoes = { estilo: est.estilo, linkar: est.linkar, pagina: pag.valor };
    if (est.estilo === 'zotero') {
      // O Zotero formata (CSL); sem conexão ou sem a obra lá, cai no formato ABNT local
      const texto = await this.client.obterCitacaoFormatada(chaveDoZoteroDe(ref), est.csl);
      if (texto) opcoes.textoPronto = pag.valor ? texto.replace(/\)$/, `, p. ${pag.valor})`) : texto;
      else opcoes.estilo = 'abnt';
    }
    this.onInserirCitacao(ref, formato, opcoes);
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
