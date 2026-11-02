// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel de Integração com Zotero e Biblioteca de Leitura.
 * Pesquisa em tempo real, filtros avançados (tipo, período, ordenação),
 * inserção de citações e fichamento/resumos pessoais.
 */

import { ZoteroClient } from '../core/athenes_zotero.js';
import { svgIcone } from './athenes_icones.js';

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
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.height = '100%';
    root.style.boxSizing = 'border-box';
    root.style.padding = '12px 16px';
    root.style.gap = '8px';

    // Calcula contagens para as badges das abas
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
      <div class="ath-zotero-lista" id="athZoteroLista" style="flex:1; overflow-y:auto; min-height:160px; display:flex; flex-direction:column; gap:8px;">
        <!-- Itens da biblioteca injetados dinamicamente -->
      </div>

      <!-- Fichamento e Notas de Leitura -->
      <div id="athZoteroDetalhesBox"></div>
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

    const inputBib = root.querySelector('#athInputBibtex');
    inputBib?.addEventListener('change', e => this.processarArquivoBibtex(e.target.files[0]));

    this.container.appendChild(root);

    // Carrega dados iniciais e integra artigos com fichamento do estúdio
    const refsMap = new Map();
    (this.doc.referencias || []).forEach(r => refsMap.set(r.id || r.chaveZotero, r));

    try {
      const salvoEstudo = localStorage.getItem('athenes_estudo_artigos');
      if (salvoEstudo) {
        const artigosEstudo = JSON.parse(salvoEstudo);
        if (Array.isArray(artigosEstudo)) {
          for (const a of artigosEstudo) {
            const chave = a.id || a.zoteroKey;
            if (chave && !refsMap.has(chave)) {
              const autoresArr = a.autores ? a.autores.split(/,| e /).map(s => ({ sobrenome: s.trim() })) : [{ sobrenome: a.autor || 'Autor' }];
              refsMap.set(chave, {
                id: a.id || ('ref_' + Math.random().toString(36).slice(2, 9)),
                chaveZotero: a.zoteroKey || '',
                titulo: a.titulo || 'Artigo sem título',
                autores: autoresArr,
                ano: a.ano || '2024',
                publicacao: a.periodico || a.categoria || 'Estúdio de Artigos',
                tipo: 'artigo',
                temPdf: !!(a.pdfUrl || a.driveArquivoId),
                fichamento: a.fichamento || a.resumo || '',
                resumo: a.resumo || '',
                citacoesMarcadas: a.citacoesMarcadas || [],
                palavrasChave: a.tags || []
              });
            }
          }
        }
      }
    } catch (_) {}

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
          <div style="display:flex; gap:4px; align-items:center; flex-shrink:0;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-primary ath-btn-citar" data-formato="parentese" style="padding:2px 8px; font-weight:700; border-radius:6px; font-size:10.5px;" title="Citação Indireta ABNT: (AUTOR, Ano)">(AUTOR, Ano)</button>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft ath-btn-citar" data-formato="narrativa" style="padding:2px 8px; font-weight:700; border-radius:6px; font-size:10.5px; border:1px solid #CBD5E1;" title="Citação Direta/Narrativa ABNT: Autor (Ano)">Autor (Ano)</button>
          </div>
        </div>
      `;

      card.addEventListener('click', ev => {
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

    const txtArea = detalhesBox.querySelector('#athFichamentoTxt');
    txtArea?.addEventListener('input', () => {
      nota.texto = txtArea.value;
      this.onAlterado();
    });
  }

  inserirCitacaoNoDocumento(ref, formato = 'parentese') {
    if (!this.doc.referencias.some(r => r.id === ref.id)) {
      this.doc.referencias.push(ref);
      this.onAlterado();
    }
    this.onInserirCitacao(ref, formato);
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
