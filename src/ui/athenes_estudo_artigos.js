// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Leitura, Risco em PDF (estilo Samsung Notes) e Fichamento Síncrono (Zotero + Google Drive).
 *
 * Recursos principais:
 * 1. Tela Cheia em 3 Colunas (.rm-conteudo / .rm-ed-grade) idêntica ao Editor de Escrita:
 *    - Coluna Esquerda 50/50 (.rm-card-meio-a-meio): Artigos do Zotero na metade superior + Páginas do PDF na metade inferior.
 *    - Coluna Central: Todas as páginas do PDF empilhadas em rolagem contínua (.rm-prev-palco) com barra flutuante (.rm-barra-blocos).
 *    - Coluna Direita: Inspetor em altura total (Resumo & Notas, Citações & Destaques, Zotero & Drive).
 * 2. Desenho Livre + Modo Linha Reta (estilo Samsung Notes):
 *    - Caneta e Marca-Texto operam à mão livre ou em Modo Linha Reta (botão "Linha Reta" na barra ou tecla Shift, com trava ortogonal 0°/90°).
 * 3. Notas Adesivas Editáveis na Folha (sem window.prompt):
 *    - Card flutuante Soft UI diretamente sobre a página do PDF; clicar em qualquer nota abre a edição de título, texto, cor e posição.
 * 4. Seleção de Texto Interativa:
 *    - Ao selecionar qualquer trecho do PDF, surge uma pílula flutuante sobre a seleção para Grifar Texto (<mark>),
 *      Salvar Citação no Zotero (p. X), Criar Nota Adesiva ou Copiar em formato ABNT.
 */

import * as bib from '../core/athenes_biblioteca_artigos.js';
import { lerConta, gravarConta } from '../core/athenes_conta.js';
import { obterTokenOuConectar, obterTokenDrive, sincronizarZoteroComDrive } from '../core/athenes_drive_sync.js';
import { ZoteroClient } from '../core/athenes_zotero.js';
import { obterPerfilColaborador, obterConfigGoogleDrive, salvarArquivoNoGoogleDrive, listarPdfsDoGoogleDrive, salvarDocumentoNoSupabase, obterPastasDriveLocais, salvarPastasDriveLocais, buscarPastaNaArvore } from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { espelharColecoesNasPastas, pastasDoItemZotero, artigoEstaNaPasta } from '../core/athenes_zotero_pastas.js';
import { artigoTemPdf, ehArtigoExemploFicticio, carregarPdfJs, obterPdfLocal, garantirPdfDoArtigo, migrarPdfsLocaisParaODrive, carregarArtigosEstudo, salvarArtigosEstudo, gerarHtmlNotaZoteroDoArtigo } from './athenes_estudo_artigos_dados.js';
import { metodosEstudoTela } from './athenes_estudo_artigos_tela.js';
import { metodosEstudoPainelDireito } from './athenes_estudo_artigos_painel_direito.js';
import { metodosEstudoAnotacoes } from './athenes_estudo_artigos_anotacoes.js';
import { metodosEstudoModais } from './athenes_estudo_artigos_modais.js';

export { ehArtigoExemploFicticio, criarArtigosEstudoExemplo, migrarPdfsLocaisParaODrive, carregarArtigosEstudo, salvarArtigosEstudo, salvarArtigosEstudoDebounced, formatarCitacaoAbntDoArtigo, gerarHtmlNotaZoteroDoArtigo, calcularPontoFinalLinhaReta } from './athenes_estudo_artigos_dados.js';

export class EstudoArtigosView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.opcoes = opcoes;
    this.onModoFullScreenChange = opcoes.onModoFullScreenChange || (() => {});
    this.artigos = carregarArtigosEstudo();
    // a biblioteca vem do servidor: chegou algo de outro computador → atualiza a tela (sem interromper quem está lendo um artigo)
    this._cancelarBib = bib.aoMudarBiblioteca(() => { this.artigos = carregarArtigosEstudo(); if (!this.artigoAberto && typeof this.renderizar === 'function') this.renderizar(); });
    bib.sincronizarBiblioteca().catch(e => console.warn('[Athenes] Biblioteca no servidor:', e.message));
    migrarPdfsLocaisParaODrive().catch(() => {}); // PDFs que ficaram só neste computador vão para o Drive
    this.artigoAberto = null;
    this.paginaAtual = 1;
    this.zoomPct = 100;
    this.ferramentaAtiva = 'cursor'; // Começa com seleção de texto ou caneta; permite alternar livremente
    this.modoLinhaReta = false; // Quando true, Caneta e Marca-Texto fazem retas perfeitas
    this.corTinta = '#314F79';
    this.corGrifoAtiva = '#FDE047'; // Amarelo clássico por padrão; suporta verde, azul, coral, roxo, laranja
    this.espessuraTinta = 3;
    this.abaDireita = 'resumo'; // 'resumo' | 'citacoes' | 'zotero_drive'
    this.pinEditandoId = null; // ID da nota adesiva atualmente aberta para edição na folha
    this.filtroBusca = '';
    this.filtroLateralEsq = '';
    this.pastaFiltroId = opcoes.pastaFiltroId || 'todas';
    this.aoMudarPastas = opcoes.aoMudarPastas || null; // a página inicial refaz a lista de pastas quando as coleções do Zotero chegam
    this.zoteroClient = new ZoteroClient();
    this.carregarConfigZotero();
    this.renderizar();
  }

  carregarConfigZotero() {
    try {
      const salvo = lerConta('athenes_zotero_cfg');
      if (salvo) {
        const cfg = JSON.parse(salvo);
        this.zoteroClient.userId = cfg.userId ? String(cfg.userId).trim() : '';
        this.zoteroClient.apiKey = cfg.apiKey ? String(cfg.apiKey).trim() : '';
        this.zoteroClient.username = cfg.username || '';
        this.zoteroClient.isGroup = Boolean(cfg.isGroup);
      }
    } catch (_) {}
  }

  salvarConfigZotero(cfg = {}) {
    if (cfg.userId !== undefined) this.zoteroClient.userId = String(cfg.userId).trim();
    if (cfg.apiKey !== undefined) this.zoteroClient.apiKey = String(cfg.apiKey).trim();
    if (cfg.username !== undefined) this.zoteroClient.username = cfg.username;
    try {
      gravarConta('athenes_zotero_cfg', JSON.stringify({
        userId: this.zoteroClient.userId,
        apiKey: this.zoteroClient.apiKey,
        username: this.zoteroClient.username || '',
        isGroup: Boolean(this.zoteroClient.isGroup)
      }));
    } catch (_) {}
    // depois de uma pausa curta, leva a conexão para o Drive (vale nos outros computadores da conta)
    clearTimeout(this._tZoteroDrive);
    this._tZoteroDrive = setTimeout(() => { obterTokenDrive().then(t => t && sincronizarZoteroComDrive(t)).catch(() => {}); }, 1500);
  }

  temZoteroConectado() {
    return Boolean(this.zoteroClient.apiKey);
  }

  filtrarPorPasta(pastaId) {
    this.pastaFiltroId = pastaId || 'todas';
    if (!this.artigoAberto) {
      this.atualizarGridCatalogo();
    } else {
      const colEsq = this.container.querySelector('#athEstudioColEsq');
      if (colEsq && this.artigoAberto) {
        this.renderizarColunaEsquerdaEstudio(colEsq, this.artigoAberto, this.artigoAberto.conteudoPaginasPdf);
      }
    }
  }

  alternarModoDashboardFull(ativo) {
    const dashEl = this.container?.closest('.ath-dashboard');
    if (dashEl) {
      dashEl.classList.toggle('ath-dashboard-estudio-full', Boolean(ativo));
      const sidebar = dashEl.querySelector('#athDashSidebar');
      const banner = dashEl.querySelector('#athDashPastaBanner');
      if (sidebar) sidebar.style.display = ativo ? 'none' : '';
      if (banner) banner.style.display = ativo ? 'none' : '';
    }
    this.onModoFullScreenChange(Boolean(ativo));
  }

  renderizar() {
    if (!this.container) return;
    const palcoAntigo = this.container.querySelector('#athEstudioPalco');
    const scrollSalvo = palcoAntigo ? palcoAntigo.scrollTop : 0;

    this.carregarConfigZotero();
    this.container.innerHTML = '';

    if (this.artigoAberto) {
      const headerAcoes = document.getElementById('athHeaderAcoesZotero');
      if (headerAcoes) headerAcoes.innerHTML = '';
      this.alternarModoDashboardFull(true);
      this.renderizarEstudioPdfFullScreen(this.artigoAberto, scrollSalvo);
    } else {
      if (this._tecladoZoomHandler) {
        window.removeEventListener('keydown', this._tecladoZoomHandler);
        this._tecladoZoomHandler = null;
      }
      if (this._selectionChangeHandler) {
        document.removeEventListener('selectionchange', this._selectionChangeHandler);
        this._selectionChangeHandler = null;
      }
      this.alternarModoDashboardFull(false);
      this.renderizarCatalogoArtigos();
    }
  }

  /* ==========================================================================
     VISÃO 1: CATÁLOGO DE ARTIGOS VINCULADOS AO ZOTERO + CAPA DO PDF NO DRIVE
     ========================================================================== */
  renderizarCatalogoArtigos() {
    const wrap = document.createElement('div');
    wrap.className = 'ath-estudo-catalogo';

    const conectado = this.temZoteroConectado();
    const labelZotero = conectado
      ? `Zotero · ${this.zoteroClient.userId ? '#' + this.zoteroClient.userId : 'conectado'}`
      : 'Conectar Zotero';

    const htmlBotoesAcao = `
      <button type="button" class="ath-btn ${conectado ? 'ath-btn-zotero-ok' : ''}" id="athBtnConfigurarChaveZotero" title="${conectado ? 'Zotero conectado: clique para ver ou trocar a API Key e o User ID' : 'Inserir sua API Key e User ID do Zotero'}">
        <span class="ath-dot-conexao ${conectado ? 'on' : ''}"></span>
        ${svgIcone('zotero', 14)}
        <span>${escapeHtml(labelZotero)}</span>
      </button>

      <button type="button" class="ath-btn ath-btn-icone" id="athBtnSincronizarZoteroHub" title="Sincronizar: busca na sua biblioteca do Zotero os artigos novos" aria-label="Sincronizar biblioteca do Zotero">
        ${svgIcone('sincronizar', 17)}
      </button>

      <div class="ath-menu-importar" id="athMenuImportarBib">
        <button type="button" class="ath-btn" id="athBtnImportarBib" aria-haspopup="menu" aria-expanded="false" title="Importar referências de um arquivo">
          ${svgIcone('importar', 15)} Importar ${svgIcone('baixo', 12)}
        </button>
        <ul class="ath-menu-importar-lista" id="athMenuImportarBibLista" role="menu" hidden>
          <li><button type="button" role="menuitem" data-importar-bib=".bib">${svgIcone('documento', 14)}<span><strong>BibTeX (.bib)</strong><small>Coleção exportada do Zotero</small></span></button></li>
          <li><button type="button" role="menuitem" data-importar-bib=".txt">${svgIcone('documento', 14)}<span><strong>Texto (.txt)</strong><small>Referências em formato BibTeX, em texto</small></span></button></li>
        </ul>
        <input type="file" accept=".bib,.txt" id="athInputImportarBibEstudo" style="display:none;">
      </div>

      <button type="button" class="ath-btn ath-btn-primary" id="athBtnNovoArtigoDrive">
        ${svgIcone('mais', 14)} <span>Vincular Artigo & PDF</span>
      </button>
    `;

    const containerHeaderAcoes = document.getElementById('athHeaderAcoesZotero');
    if (containerHeaderAcoes) {
      containerHeaderAcoes.innerHTML = htmlBotoesAcao;
    }

    wrap.innerHTML = `
      <div class="ath-estudo-barra-topo">
        <div class="ath-busca-box" style="flex:1; max-width:540px;">
          ${svgIcone('busca', 16)}
          <input type="text" class="ath-input" id="athEstudoBuscaInput" value="${escapeHtml(this.filtroBusca)}" placeholder="Buscar artigo por título, autor, tag Zotero ou citação marcada...">
        </div>

        ${!containerHeaderAcoes ? `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">${htmlBotoesAcao}</div>` : ''}
      </div>

      <div class="ath-artigos-zotero-grid" id="athArtigosZoteroGrid"></div>
    `;

    this.container.appendChild(wrap);

    const inputBusca = wrap.querySelector('#athEstudoBuscaInput');
    inputBusca?.addEventListener('input', () => {
      this.filtroBusca = inputBusca.value.trim().toLowerCase();
      this.atualizarGridCatalogo();
    });

    const escopoBotoes = containerHeaderAcoes || wrap;

    escopoBotoes.querySelector('#athBtnConfigurarChaveZotero')?.addEventListener('click', () => {
      this.abrirModalCredenciaisZotero();
    });

    escopoBotoes.querySelector('#athBtnSincronizarZoteroHub')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.classList.add('ath-girando'); btn.disabled = true;
      try { await this.sincronizarComZoteroApi(); } finally { btn.classList.remove('ath-girando'); btn.disabled = false; }
    });

    // "Importar" como lista (mesmo padrão da página inicial)
    const btnImp = escopoBotoes.querySelector('#athBtnImportarBib');
    const listaImp = escopoBotoes.querySelector('#athMenuImportarBibLista');
    const entradaBib = escopoBotoes.querySelector('#athInputImportarBibEstudo');
    const fecharImp = () => { if (!listaImp) return; listaImp.hidden = true; btnImp?.setAttribute('aria-expanded', 'false'); };
    btnImp?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const abrir = listaImp.hidden;
      listaImp.hidden = !abrir;
      btnImp.setAttribute('aria-expanded', String(abrir));
      if (abrir) listaImp.querySelector('button')?.focus();
    });
    listaImp?.querySelectorAll('[data-importar-bib]').forEach(item => item.addEventListener('click', () => {
      fecharImp();
      entradaBib.accept = item.dataset.importarBib;
      entradaBib.click();
    }));
    if (this._fecharImportarBib) document.removeEventListener('click', this._fecharImportarBib);
    this._fecharImportarBib = (ev) => { if (!ev.target.closest?.('#athMenuImportarBib')) fecharImp(); };
    document.addEventListener('click', this._fecharImportarBib);
    escopoBotoes.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && listaImp && !listaImp.hidden) { fecharImp(); btnImp?.focus(); } });

    escopoBotoes.querySelector('#athInputImportarBibEstudo')?.addEventListener('change', e => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const importados = this.zoteroClient.importarBibTeX(ev.target.result || '');
        let adicionados = 0;
        importados.forEach(item => {
          if (!this.artigos.some(a => a.titulo === item.titulo)) {
            this.artigos.unshift(this.converterItemZoteroParaEstudo(item));
            adicionados++;
          }
        });
        salvarArtigosEstudo(this.artigos);
        this.atualizarGridCatalogo();
      };
      reader.readAsText(arq);
    });

    escopoBotoes.querySelector('#athBtnNovoArtigoDrive')?.addEventListener('click', () => {
      this.abrirModalVincularArtigo();
    });

    this.atualizarGridCatalogo();
  }

  converterItemZoteroParaEstudo(item, pastaId = 'pasta_bib_raiz') {
    return {
      id: 'zot_' + (item.id || Date.now().toString(36)),
      pastaId: item.pastaId || pastaId || 'pasta_bib_raiz',
      chaveZotero: item.chave || item.id || 'ZOTLOCAL',
      titulo: item.titulo || 'Artigo sem título',
      autores: item.autores?.length ? item.autores : [{ sobrenome: 'Autor', prenome: '' }],
      ano: item.ano || String(new Date().getFullYear()),
      publicacao: item.publicacao || item.editora || 'Periódico Acadêmico',
      volume: item.volume || '',
      numero: item.numero || '',
      paginas: item.paginas || '',
      doi: item.doi || '',
      palavrasChave: item.palavrasChave?.length ? item.palavrasChave : ['Zotero'],
      driveFileId: '',
      driveFileName: '',
      driveStatus: 'Sem PDF vinculado',
      corCapa: '#314F79',
      totalPaginas: 0,
      resumoOriginal: item.resumo || 'Resumo sincronizado da biblioteca Zotero.',
      fichamento: {
        resumoPessoal: '',
        metodologiaNotas: '',
        citacoesMarcadas: [],
        notasPagina: {},
        tracosPorPagina: {}
      },
      conteudoPaginasPdf: [] // sem PDF vinculado não há páginas: o estúdio avisa e oferece vincular
    };
  }

  atualizarGridCatalogo() {
    const grid = this.container.querySelector('#athArtigosZoteroGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtrados = this.artigos.filter(art => {
      if (this.pastaFiltroId && this.pastaFiltroId !== 'todas') {
        if (!artigoEstaNaPasta(art, this.pastaFiltroId)) return false;
      }
      if (!this.filtroBusca) return true;
      const autoresStr = (art.autores || []).map(a => `${a.prenome} ${a.sobrenome}`).join(' ');
      const tagsStr = (art.palavrasChave || []).join(' ');
      const citStr = (art.fichamento?.citacoesMarcadas || []).map(c => c.texto).join(' ');
      const alvo = `${art.titulo} ${autoresStr} ${art.ano} ${art.publicacao} ${tagsStr} ${citStr}`.toLowerCase();
      return alvo.includes(this.filtroBusca);
    });

    if (filtrados.length === 0) {
      const pastaInfo = buscarPastaNaArvore(obterPastasDriveLocais(), this.pastaFiltroId);
      const rotuloLocal = pastaInfo?.nome ? `na pasta "${pastaInfo.nome}"` : 'para este filtro';
      grid.innerHTML = `
        <div style="grid-column:1/-1; padding:42px; text-align:center; background:#fff; border-radius:16px; border:1px solid #E2E8F0;">
          <p style="font-size:15px; font-weight:800; color:#1F2733; margin:0 0 6px 0;">Nenhum artigo encontrado ${escapeHtml(rotuloLocal)}</p>
          <p style="font-size:12.5px; color:#64748B; margin:0 0 14px 0;">Sincronize sua biblioteca Zotero ou vincule um novo PDF para esta pasta de bibliografia.</p>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnVincularArtigoVazio">
            ${svgIcone('mais', 13)} Vincular Artigo & PDF
          </button>
        </div>
      `;
      grid.querySelector('#athBtnVincularArtigoVazio')?.addEventListener('click', () => {
        this.abrirModalVincularArtigo({ pastaId: this.pastaFiltroId });
      });
      return;
    }

    filtrados.forEach(art => {
      const card = document.createElement('article');
      card.className = 'ath-artigo-zotero-card';

      const autoresFmt = (art.autores || []).map(a => `${a.sobrenome}, ${a.prenome?.[0] || ''}.`).join('; ');
      const qtdCitacoes = art.fichamento?.citacoesMarcadas?.length || 0;
      const qtdTracos = Object.values(art.fichamento?.tracosPorPagina || {}).reduce((acc, l) => acc + (Array.isArray(l) ? l.length : 0), 0);
      const qtdPins = Object.values(art.fichamento?.notasPagina || {}).reduce((acc, l) => acc + (Array.isArray(l) ? l.length : 0), 0);

      card.innerHTML = `
        <div class="ath-artigo-capa-pdf" style="border-top: 4px solid ${escapeHtml(art.corCapa || '#314F79')};">
          <div class="ath-artigo-capa-folha">
            <span class="ath-artigo-capa-periodico">${escapeHtml(art.publicacao || 'Periódico Científico')} · ${escapeHtml(art.ano)}</span>
            <strong class="ath-artigo-capa-titulo">${escapeHtml(art.titulo)}</strong>
            <span class="ath-artigo-capa-autores">${escapeHtml(autoresFmt)}</span>
            <div class="ath-artigo-capa-linhas" aria-hidden="true">
              <span></span><span class="hl"></span><span></span><span></span>
            </div>
          </div>
          <div class="ath-artigo-capa-badges">
            <span class="ath-selo-zotero" title="Chave do item no Zotero">${svgIcone('zotero', 11)} ${escapeHtml(art.chaveZotero || 'ZOTERO')}</span>
            <span class="ath-selo-drive" title="PDF lido e salvo diretamente no Google Drive">${svgIcone('drive', 11)} PDF no Drive</span>
          </div>
        </div>

        <div class="ath-artigo-card-corpo">
          <div class="ath-artigo-tags">
            ${(art.palavrasChave || []).slice(0, 3).map(t => `<span class="ath-tag-chip">${escapeHtml(t)}</span>`).join('')}
          </div>

          <h3 class="ath-artigo-titulo">${escapeHtml(art.titulo)}</h3>
          <p class="ath-artigo-autores">${escapeHtml(autoresFmt)} (${escapeHtml(art.ano)})</p>
          <p class="ath-artigo-resumo-curto">
            ${art.fichamento?.resumoPessoal
              ? `<strong>Seu resumo:</strong> ${escapeHtml(art.fichamento.resumoPessoal)}`
              : escapeHtml(art.resumoOriginal || 'Clique para abrir em tela cheia, riscar o PDF e fazer o fichamento.')}
          </p>

          <div class="ath-artigo-estatisticas">
            <span><strong>${qtdCitacoes}</strong> citaç${qtdCitacoes === 1 ? 'ão' : 'ões'}</span>
            <span>·</span>
            <span><strong>${qtdTracos + qtdPins}</strong> marcaç${(qtdTracos + qtdPins) === 1 ? 'ão' : 'ões'} no PDF</span>
            <span>·</span>
            ${artigoTemPdf(art) ? `<span style="color:#059669; font-weight:700;">${escapeHtml(art.driveFileName || 'PDF vinculado')}</span>` : '<span style="color:#B45309; font-weight:700;">Sem PDF vinculado</span>'}
          </div>

          <div class="ath-artigo-card-rodape">
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm ath-btn-abrir-estudio" style="flex:1; justify-content:center;">
              ${svgIcone('lapis', 13)} Abrir em Tela Cheia (PDF & Fichamento)
            </button>
            <button type="button" class="ath-btn ath-btn-sm ath-btn-excluir-artigo" title="Remover artigo da lista">${svgIcone('lixeira', 13)}</button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.ath-btn-excluir-artigo')) {
          e.stopPropagation();
          this.artigos = this.artigos.filter(x => x.id !== art.id);
          salvarArtigosEstudo(this.artigos);
          this.atualizarGridCatalogo();
          return;
        }
        this.abrirArtigoNoEstudio(art);
      });

      grid.appendChild(card);
    });
  }

  abrirArtigoNoEstudio(art) {
    this.artigoAberto = art;
    this.paginaAtual = 1;
    this.pinEditandoId = null;
    if (typeof window !== 'undefined') {
      if (window.scrollY > 0) window.scrollTo(0, 0);
      if (document.documentElement?.scrollTop > 0) document.documentElement.scrollTop = 0;
      if (document.body?.scrollTop > 0) document.body.scrollTop = 0;
    }
    this._carregandoPdf = !art.pdfBlobUrl && artigoTemPdf(art) ? art : null; // PDF no Drive: "Carregando…" em vez de aviso de "sem PDF"
    this.renderizar();
    if (!art.pdfBlobUrl) {
      garantirPdfDoArtigo(art).then(carregou => {
        if (this._carregandoPdf === art) this._carregandoPdf = null;
        if (this.artigoAberto === art) this.renderizar();
        return carregou;
      }).catch(() => { if (this._carregandoPdf === art) this._carregandoPdf = null; if (this.artigoAberto === art) this.renderizar(); });
    }
  }

  /* ==========================================================================
     VISÃO 2: ESTÚDIO EM TELA CHEIA (TODAS AS PÁGINAS EMPILHADAS + 3 COLUNAS)
     ========================================================================== */
  atualizarEstadoFerramentasNoDom(root) {
    root.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('ativo', b.dataset.tool === this.ferramentaAtiva);
    });
    const btnReta = root.querySelector('#athBtnModoLinhaReta');
    if (btnReta) {
      btnReta.classList.toggle('ativo', this.modoLinhaReta);
      btnReta.setAttribute('aria-pressed', this.modoLinhaReta ? 'true' : 'false');
    }
    root.querySelectorAll('.ath-pdf-ink-canvas').forEach(canvas => {
      canvas.style.pointerEvents = this.ferramentaAtiva === 'cursor' ? 'none' : 'auto';
      canvas.style.cursor = this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair';
    });
    const lbl = root.querySelector('#athLabelModoRisco');
    if (lbl) {
      lbl.textContent = `${this.rotuloFerramenta(this.ferramentaAtiva)}${this.modoLinhaReta && (this.ferramentaAtiva === 'caneta' || this.ferramentaAtiva === 'marcatexto') ? ' (Linha Reta)' : ''}`;
    }
  }

  /* ==========================================================================
     RENDERIZAÇÃO DE TODAS AS PÁGINAS EMPILHADAS NO PALCO CENTRAL
     ========================================================================== */
  /** Abre o PDF com pdf.js, mede cada página e prepara uma folha por página. */
  async carregarPdfReal(art) {
    const url = art.pdfBlobUrl;
    if (!this._pdfDocs) this._pdfDocs = new Map();
    if (!this._pdfFalhou) this._pdfFalhou = new Set();
    if (this._pdfDocs.has(url)) return true;
    try {
      const lib = await carregarPdfJs();
      const doc = await lib.getDocument({ url }).promise;
      const n = doc.numPages;
      const dims = await Promise.all(Array.from({ length: n }, async (_, i) => {
        const v = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
        return { w: v.width, h: v.height };
      }));
      const atuais = art.conteudoPaginasPdf || [];
      const qtdReais = atuais.filter(p => p.real).length;
      if (!atuais.length || !atuais[0]?.real || qtdReais !== n) {
        const pagsReais = dims.map((_, i) => ({
          numero: i + 1,
          real: true,
          cabecalho: '',
          titulo: `Folha ${i + 1} do PDF`,
          autores: '',
          paragrafos: []
        }));
        const extras = atuais.filter(p => p.extra);
        extras.forEach((ext, idx) => {
          ext.numero = n + idx + 1;
        });
        art.conteudoPaginasPdf = [...pagsReais, ...extras];
      }
      art.totalPaginas = art.conteudoPaginasPdf.length;
      this._pdfDocs.set(url, { doc, dims, n });
      return true;
    } catch (err) {
      console.warn('Athenes — falha ao abrir PDF com pdf.js:', err);
      this._pdfFalhou.add(url);
      return false;
    }
  }

  async renderizarPaginaPdfReal(info, folha, numPag) {
    if (!folha || folha.dataset.renderizada) return;
    folha.dataset.renderizada = '1';
    try {
      const page = await info.doc.getPage(numPag);
      const d = info.dims[numPag - 1];
      const escala = 794 / d.w;
      const viewport = page.getViewport({ scale: escala });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cv = folha.querySelector('.ath-pdf-render-canvas');
      if (!cv) return;
      cv.width = Math.floor(viewport.width * dpr);
      cv.height = Math.floor(viewport.height * dpr);
      await page.render({
        canvasContext: cv.getContext('2d'),
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
      }).promise;

      const camada = folha.querySelector('.ath-pdf-text-layer');
      if (camada) {
        camada.style.setProperty('--scale-factor', String(escala));
        camada.style.setProperty('--total-scale-factor', String(escala));
        const lib = await carregarPdfJs();
        const textContent = await page.getTextContent();
        await new lib.TextLayer({
          textContentSource: textContent,
          container: camada,
          viewport
        }).render();

        let endOfContent = camada.querySelector('.endOfContent');
        if (!endOfContent) {
          endOfContent = document.createElement('div');
          endOfContent.className = 'endOfContent';
          camada.append(endOfContent);
        }
        camada.addEventListener('mousedown', () => {
          camada.classList.add('selecting');
        });

        // Detecta número editorial real da página (ex.: p. 253 em vez de apenas p. 17 do PDF)
        const itensTxt = (textContent.items || [])
          .map(it => String(it.str || '').trim())
          .filter(Boolean);
        const candidatos = [...itensTxt.slice(0, 6), ...itensTxt.slice(-6)];
        for (const cand of candidatos) {
          if (/^\d{1,5}$/.test(cand)) {
            const numEditorial = parseInt(cand, 10);
            if (numEditorial > 0 && numEditorial !== numPag) {
              folha.dataset.pagEditorial = String(numEditorial);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Athenes — falha ao desenhar página do PDF:', err);
    }
  }

  definirPaginaAtivaSilencioso(numPag, root) {
    if (this.paginaAtual === numPag) return;
    this.paginaAtual = numPag;
    if (!root) return;
    const totalPags = this.artigoAberto?.conteudoPaginasPdf?.length || 1;
    const indBarra = root.querySelector('#athIndicadorPagBarra');
    if (indBarra) indBarra.textContent = `Pág. ${numPag} de ${totalPags}`;

    root.querySelectorAll('.ath-pdf-folha-container').forEach(el => {
      el.classList.toggle('pagina-ativa', parseInt(el.dataset.numPagina, 10) === numPag);
    });
    root.querySelectorAll('.ath-pdf-etiqueta-pagina').forEach(el => {
      el.classList.toggle('ativa', parseInt(el.dataset.etiquetaPag, 10) === numPag);
    });
    root.querySelectorAll('[data-ir-pagina-esq]').forEach(li => {
      li.classList.toggle('sel', parseInt(li.dataset.irPaginaEsq, 10) === numPag);
    });
  }

  rolarParaPagina(numPag, root) {
    this.definirPaginaAtivaSilencioso(numPag, root);
    const wrapPag = root?.querySelector(`[data-wrap-pagina="${numPag}"]`);
    const palco = root?.querySelector('#athEstudioPalco');
    if (wrapPag && palco) {
      try {
        const palcoRect = palco.getBoundingClientRect();
        const wrapRect = wrapPag.getBoundingClientRect();
        const diferenca = wrapRect.top - palcoRect.top;
        palco.scrollTo({
          top: palco.scrollTop + diferenca - 16,
          behavior: 'smooth'
        });
      } catch (_) {}
    }
    // Garante que o documento/window não seja deslocado para cima mantendo a barra de topo 100% visível
    if (typeof window !== 'undefined') {
      if (window.scrollY > 0) window.scrollTo(0, 0);
      if (document.documentElement?.scrollTop > 0) document.documentElement.scrollTop = 0;
      if (document.body?.scrollTop > 0) document.body.scrollTop = 0;
    }
  }

  /* ==========================================================================
     PAINEL DE NOTAS ADESIVAS EDITÁVEIS NA FOLHA (SEM WINDOW.PROMPT)
     Suporta: Minimizar (—), Tamanho Compacto (P/M), Arrastar e Sem Cortar Borda
     ========================================================================== */
  atualizarPaineisLateraisDeNotas(root, art) {
    if (!root) return;
    this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
    this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
    (art.conteudoPaginasPdf || []).forEach((_, idx) => {
      const pg = idx + 1;
      const statsEl = root.querySelector(`[data-stats-pag="${pg}"]`);
      if (statsEl) {
        const nRiscos = (art.fichamento.tracosPorPagina?.[pg] || []).length;
        const nNotas = (art.fichamento.notasPagina?.[pg] || []).length;
        statsEl.textContent = `${nRiscos} risco(s) · ${nNotas} nota(s)`;
      }
    });
  }

  criarNotaAdesivaNaPagina(art, numPag, xPct = 52, yPct = 25, textoInicial = '', root = null) {
    const perfil = obterPerfilColaborador();
    if (!art.fichamento.notasPagina) art.fichamento.notasPagina = {};
    if (!Array.isArray(art.fichamento.notasPagina[numPag])) {
      art.fichamento.notasPagina[numPag] = [];
    }
    const novoPin = {
      id: 'pin_' + Date.now().toString(36),
      xPct: Math.max(3, Math.min(60, xPct)),
      yPct: Math.max(3, Math.min(82, yPct)),
      titulo: perfil.nome || 'Nota de Leitura',
      texto: textoInicial || '',
      cor: this.corTinta === '#314F79' ? '#F59E0B' : this.corTinta,
      autor: perfil.nome || 'Autor',
      minimizado: false,
      tamanho: 'normal'
    };
    art.fichamento.notasPagina[numPag].push(novoPin);
    this.pinEditandoId = novoPin.id;
    salvarArtigosEstudo(this.artigos);

    if (root) {
      const layer = root.querySelector(`[data-pins-pag="${numPag}"]`);
      this.renderizarPinsDaPagina(layer, art, numPag, root);
      this.atualizarPaineisLateraisDeNotas(root, art);
    } else {
      this.renderizar();
    }
  }

  renderizarGrifosRetangularesDaPagina(layerEl, art, numPag) {
    if (!layerEl) return;
    layerEl.innerHTML = '';
    const grifos = art.fichamento?.grifosPorPagina?.[numPag] || [];
    grifos.forEach(g => {
      const div = document.createElement('div');
      div.className = 'ath-pdf-hl-rect';
      div.style.left = `${g.xPct}%`;
      div.style.top = `${g.yPct}%`;
      div.style.width = `${g.wPct}%`;
      div.style.height = `${g.hPct}%`;
      div.style.background = g.cor || 'rgba(250, 204, 21, 0.45)';
      layerEl.appendChild(div);
    });
  }

  /* ==========================================================================
     SELEÇÃO DE TEXTO INTERATIVA (GRIFAR TRECHO, CITAR NO ZOTERO, CRIAR NOTA)
     ========================================================================== */
  /* ==========================================================================
     MODAL ELEGANTE PARA CRIAR OU EDITAR CITAÇÃO DO PDF (SEM WINDOW.PROMPT)
     ========================================================================== */
  atualizarAbaCitacoesEContadores(art) {
    if (!this.container) {
      this.renderizar();
      return;
    }
    const qtdCit = art.fichamento?.citacoesMarcadas?.length || 0;
    this.container.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.aba === this.abaDireita);
      if (btn.dataset.aba === 'citacoes') {
        btn.textContent = `Citações (${qtdCit})`;
      }
    });
    this.renderizarPainelDireitoEstudio(this.container.querySelector('#athEstudioPainelCorpo'), art);
    this.renderizarColunaEsquerdaEstudio(this.container.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
  }

  adicionarFolhaExtraNoPdf(art, paginasPdf) {
    const lista = Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.length > 0 ? art.conteudoPaginasPdf : paginasPdf;
    const novoNum = lista.length + 1;
    lista.push({
      numero: novoNum,
      extra: true,
      cabecalho: `${(art.titulo || 'Artigo').slice(0, 55)} · Folha de Anotações Manuscritas #${novoNum}`,
      titulo: `FOLHA DE RASCUNHO E ESQUEMAS VISUAIS (PÁGINA ${novoNum})`,
      autores: 'Espaço livre estilo Samsung Notes para esquemas, mapas mentais e notas sobre o artigo',
      paragrafos: [
        'Use a Caneta, o Marca-Texto, a Linha Reta ou as Notas Adesivas para desenhar esquemas, diagramas e fixar anotações nesta folha complementar.'
      ]
    });
    art.conteudoPaginasPdf = lista;
    art.totalPaginas = lista.length;
    this.paginaAtual = novoNum;
    salvarArtigosEstudo(this.artigos);
    this.renderizar();
    requestAnimationFrame(() => {
      this.rolarParaPagina(novoNum, this.container);
    });
  }

  /* ==========================================================================
     COLUNA ESQUERDA 50/50 COM .rm-card-meio-a-meio (IDÊNTICA À ESCRITA)
     ========================================================================== */
  /* ==========================================================================
     POPOVERS DE TOPO DO ESTÚDIO (ZOTERO API, GOOGLE DRIVE E CANETA)
     ========================================================================== */
  rotuloFerramenta(tool) {
    const map = {
      cursor: 'Selecionar Texto (Grifar / Citar)',
      caneta: 'Caneta de Risco',
      marcatexto: 'Marca-Texto Translúcido',
      borracha: 'Borracha de Traços',
      nota: 'Fixar Nota Adesiva Editável'
    };
    return map[tool] || tool;
  }

  aplicarZoom(novoZoom, root) {
    const lim = Math.max(50, Math.min(250, Math.round(novoZoom)));
    this.zoomPct = lim;
    const escala = this.zoomPct / 100;

    const container = root || this.container;
    const palco = container?.querySelector('#athEstudioPalco');
    if (palco) {
      const wraps = palco.querySelectorAll('.ath-pdf-pagina-bloco-wrap');
      wraps.forEach(wrap => {
        const folha = wrap.querySelector('.ath-pdf-folha-container');
        if (folha) {
          folha.style.transform = `scale(${escala})`;
          folha.style.transformOrigin = 'top center';
          const hOriginal = parseFloat(folha.dataset.alturaReal || folha.style.height) || 1123;
          wrap.style.minHeight = `${Math.round(hOriginal * escala) + 36}px`;
        }
      });
      const lbl = container.querySelector('#athZoomRotulo');
      if (lbl) {
        lbl.textContent = `Escala / Zoom das Folhas PDF (${this.zoomPct}%)`;
      }
    }
  }

  /* ==========================================================================
     MOTOR DE TINTA DIGITAL + MODO LINHA RETA EM CANVAS (POR PÁGINA)
     ========================================================================== */
  apagarTracosProximos(art, numPag, x, y, raio = 24) {
    const lista = art.fichamento?.tracosPorPagina?.[numPag];
    if (!Array.isArray(lista)) return;
    art.fichamento.tracosPorPagina[numPag] = lista.filter(traco => {
      const pts = traco.pontos || [];
      if (pts.length === 2) {
        // Verifica distância ponto-segmento para linhas retas
        const [a, b] = pts;
        const l2 = Math.hypot(b.x - a.x, b.y - a.y) ** 2;
        if (l2 === 0) return Math.hypot(x - a.x, y - a.y) > raio;
        const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / l2));
        const projX = a.x + t * (b.x - a.x);
        const projY = a.y + t * (b.y - a.y);
        return Math.hypot(x - projX, y - projY) > raio;
      }
      return !pts.some(pt => Math.hypot(pt.x - x, pt.y - y) <= raio);
    });
  }

  redesenharCanvasTinta(canvas, art, numPag = this.paginaAtual) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tracos = art.fichamento?.tracosPorPagina?.[numPag] || [];
    tracos.forEach(tr => {
      const pts = tr.pontos || [];
      if (pts.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tr.cor || '#314F79';
      ctx.lineWidth = tr.espessura || 3;
      ctx.globalAlpha = tr.tipo === 'marcatexto' ? 0.36 : 0.92;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.5, pts[0].y + 0.5);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ==========================================================================
     PAINEL LATERAL DIREITO DO ESTÚDIO: RESUMO, CITAÇÕES E VÍNCULO ZOTERO+DRIVE
     ========================================================================== */
  /* ==========================================================================
     MODAL DE CONFIGURAÇÃO RÁPIDA DE CREDENCIAIS DO ZOTERO (API KEY + USER ID)
     ========================================================================== */
  async sincronizarArtigoComDriveEZotero(art, btnEl = null, statusEl = null) {
    salvarArtigosEstudo(this.artigos);
    const txtOriginal = btnEl ? btnEl.innerHTML : '';
    if (btnEl) btnEl.textContent = 'Sincronizando...';

    const resultados = [];

    const htmlNotaZotero = gerarHtmlNotaZoteroDoArtigo(art);
    const resZot = await this.zoteroClient.sincronizarNotaFilhaNoZotero({
      parentItemKey: art.chaveZotero,
      noteKey: art.notaZoteroKey || null,
      htmlNota: htmlNotaZotero,
      tags: ['Athenes', 'Fichamento PDF', ...(art.palavrasChave || []).slice(0, 3)],
      artigoMetadados: art
    });
    if (resZot.parentKey) art.chaveZotero = resZot.parentKey;
    if (resZot.noteKey) art.notaZoteroKey = resZot.noteKey;
    if (this.zoteroClient.userId) {
      this.salvarConfigZotero({ userId: this.zoteroClient.userId });
    }
    resultados.push(resZot.ok ? 'Zotero sincronizado ✓' : 'Fichamento salvo localmente ✓');

    try {
      await salvarDocumentoNoSupabase({
        id: `artigo_${art.id}`,
        titulo: `[Fichamento PDF] ${art.titulo}`,
        autor: (art.autores || []).map(a => a.sobrenome).join(', '),
        norma: 'zotero_pdf',
        secoes: [],
        artigoEstudo: art
      });
      resultados.push('Nuvem Supabase ✓');
    } catch (_) {}

    const driveCfg = obterConfigGoogleDrive();
    if (driveCfg.accessToken || driveCfg.clientId) {
      try {
        const token = await obterTokenOuConectar(driveCfg);
        const salvoDrive = await salvarArquivoNoGoogleDrive({
          nomeArquivo: `${(art.driveFileName || 'Artigo').replace(/\.pdf$/i, '')}.athenes-pdf.json`,
          conteudoBlobOuTexto: art,
          accessToken: token,
          pastaId: driveCfg.pastaId || null,
          driveFileId: art.driveAnnotationFileId || null
        });
        if (salvoDrive?.id) art.driveAnnotationFileId = salvoDrive.id;

        // Se o PDF ainda não está salvo no Google Drive, faz o upload para a pasta indicada
        if (!art.driveFileId) {
          const pdfBlob = await obterPdfLocal(art.id) || art.pdfBlob;
          if (pdfBlob) {
            const nomePdf = art.driveFileName || `${(art.titulo || 'artigo').slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
            const salvoPdf = await salvarArquivoNoGoogleDrive({
              nomeArquivo: nomePdf,
              conteudoBlobOuTexto: pdfBlob,
              mimeType: 'application/pdf',
              accessToken: token,
              pastaId: driveCfg.pastaId || null
            });
            if (salvoPdf?.id) {
              art.driveFileId = salvoPdf.id;
              art.driveFileName = salvoPdf.name || nomePdf;
            }
          }
        }
        resultados.push('Google Drive ✓');
      } catch (_) {}
    }

    salvarArtigosEstudo(this.artigos);
    if (btnEl) {
      btnEl.textContent = 'Salvo & Sincronizado ✓';
      setTimeout(() => { btnEl.innerHTML = txtOriginal; }, 1800);
    }
    if (statusEl) {
      statusEl.textContent = resultados.join(' · ');
    }
  }

  async sincronizarComZoteroApi({ silencioso = false } = {}) {
    this.carregarConfigZotero();
    if (!this.zoteroClient.apiKey) {
      if (!silencioso) this.abrirModalCredenciaisZotero();
      return;
    }

    // Remove os 3 artigos fictícios de demonstração assim que o usuário sincroniza a conta real do Zotero
    this.artigos = this.artigos.filter(a => !ehArtigoExemploFicticio(a));
    if (this.artigoAtivo && ehArtigoExemploFicticio(this.artigoAtivo)) {
      this.artigoAtivo = null;
    }

    const itens = await this.zoteroClient.buscarItens({ limite: 60 });
    if (this.zoteroClient.userId) {
      this.salvarConfigZotero({ userId: this.zoteroClient.userId });
    }

    // as coleções do Zotero viram pastas de bibliografia (mesmos nomes e hierarquia)
    let mapaPastas = new Map();
    let pastasNovas = 0;
    try {
      const colecoes = await this.zoteroClient.listarColecoes();
      if (colecoes.length) {
        const esp = espelharColecoesNasPastas(obterPastasDriveLocais(), colecoes);
        mapaPastas = esp.mapa;
        pastasNovas = esp.criadas;
        if (esp.criadas || esp.renomeadas) salvarPastasDriveLocais(esp.pastas);
      }
    } catch (e) { console.warn('[Athenes] Coleções do Zotero:', e.message); }
    const naRaizOuZotero = (a) => !a.pastaId || a.pastaId === 'pasta_bib_raiz' || String(a.pastaId).startsWith('zot_col_'); // pasta escolhida à mão não é desfeita

    let novos = 0;
    (itens || []).forEach(it => {
      const ids = pastasDoItemZotero(it.colecoes, mapaPastas);
      const existente = this.artigos.find(a => a.chaveZotero === it.chave || a.titulo === it.titulo);
      if (existente) {
        existente.colecoesZotero = it.colecoes || [];
        if (naRaizOuZotero(existente)) { existente.pastasIds = ids; existente.pastaId = ids[0]; }
        return;
      }
      const novo = this.converterItemZoteroParaEstudo(it, ids[0]);
      novo.pastasIds = ids;
      novo.colecoesZotero = it.colecoes || [];
      this.artigos.unshift(novo);
      novos++;
    });
    salvarArtigosEstudo(this.artigos);
    if (typeof this.aoMudarPastas === 'function') this.aoMudarPastas({ pastasNovas });
    this.renderizar();
    if (!silencioso) {
      if (!itens || itens.length === 0) {
        alert(
          `Conexão ativa com sua conta Zotero (${this.zoteroClient.username || 'User'} · ID #${this.zoteroClient.userId || 'OK'}).\n\n` +
          `A nuvem online do Zotero (zotero.org) retornou 0 itens para esta conta.\n` +
          `• Se os seus artigos estão no Zotero Desktop do seu computador, clique no ícone redondo verde "Sincronizar com zotero.org" no canto superior direito do Zotero Desktop.\n` +
          `• Ou use o botão "Importar .bib" no topo para carregar sua coleção instantaneamente!`
        );
      } else {
        alert(`Sincronização Zotero concluída! ${novos} novo(s) artigo(s) trazido(s) da sua biblioteca (${itens.length} itens lidos).`);
      }
    }
  }

  /**
   * Modal para escolher um arquivo PDF diretamente da nuvem do Google Drive do usuário.
   */
  async abrirModalEscolherPdfDoGoogleDrive(onEscolhido) {
    const cfg = obterConfigGoogleDrive();
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:540px;">
        <div class="ath-modal-head">
          <h2>Escolher Arquivo PDF do Google Drive</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalEscPdfDriveFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div id="athStatusPdfDriveModal" style="font-size:12px; color:#314F79; font-weight:700;">Conectando ao seu Google Drive...</div>
          <div id="athListaPdfDriveModal" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalEscPdfDriveCancelar">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalEscPdfDriveFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalEscPdfDriveCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const statusEl = modal.querySelector('#athStatusPdfDriveModal');
    const listaEl = modal.querySelector('#athListaPdfDriveModal');

    try {
      const token = await obterTokenOuConectar(cfg);
      statusEl.textContent = 'Listando seus arquivos PDF no Google Drive...';
      const arquivos = await listarPdfsDoGoogleDrive(token);
      if (!arquivos || arquivos.length === 0) {
        statusEl.textContent = 'Nenhum PDF listado via API. Use o botão "Selecionar Arquivo PDF" para abrir da sua pasta do Google Drive ou computador.';
        return;
      }
      statusEl.textContent = `${arquivos.length} arquivo(s) PDF encontrado(s) no seu Google Drive:`;
      listaEl.innerHTML = arquivos.map((arq, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #CBD5E1; border-radius:10px; background:#F8FAFC;">
          <div style="min-width:0; flex:1;">
            <div style="font-size:12.5px; font-weight:800; color:#0F172A; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(arq.name)}</div>
            <div style="font-size:10.5px; color:#64748B;">ID Drive: <code>${escapeHtml(arq.id)}</code></div>
          </div>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" data-sel-pdf-drive="${idx}">Selecionar PDF</button>
        </div>
      `).join('');

      listaEl.querySelectorAll('[data-sel-pdf-drive]').forEach(btn => {
        btn.addEventListener('click', () => {
          const arq = arquivos[parseInt(btn.dataset.selPdfDrive, 10)];
          if (arq && onEscolhido) onEscolhido(arq);
          fechar();
        });
      });
    } catch (err) {
      statusEl.style.color = '#B42318';
      statusEl.textContent = `Não foi possível listar da nuvem (${err.message || 'autorize o domínio no Google Cloud'}). Você pode selecionar o PDF direto pela janela de arquivo do computador/pasta Google Drive.`;
    }
  }

}

Object.assign(EstudoArtigosView.prototype, metodosEstudoTela, metodosEstudoPainelDireito, metodosEstudoAnotacoes, metodosEstudoModais);
