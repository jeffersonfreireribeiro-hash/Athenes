// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor WYSIWYG de Documentos em Blocos na Folha.
 * Escrita direta nos blocos da página, navegação por teclado, histórico e réguas.
 */

import { dimensoesPapelMm } from '../core/athenes_grid.js';
import { estiloParaCss } from '../core/athenes_estilos.js';
import { criarNovoBloco, modeloDaPagina, gerarSumarioDinamico, gerarId } from '../core/athenes_documento.js';
import { formatarReferenciaCompleta, gerarCitacaoInline } from '../core/athenes_bibliografia.js';
import { svgIcone } from './athenes_icones.js';

export class EditorView {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = documento;
    this.blocoSelecionado = null;
    this.paginaSelecionada = null;
    this.historico = [];
    this.historicoIndice = -1;
    this.zoom = 1.0;
    this.snapAtivo = true;
    this.guiasVisiveis = true;
    this.margensVisiveis = true;

    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onSelecionarBloco = opcoes.onSelecionarBloco || (() => {});
    this.onVoltarDashboard = opcoes.onVoltarDashboard || (() => {});
    this.onAbrirExportar = opcoes.onAbrirExportar || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});

    this.salvarSnapshot();
    this.renderizar();
  }

  setDocumento(doc) {
    this.doc = doc;
    this.salvarSnapshot();
    this.renderizar();
  }

  salvarSnapshot() {
    // Mantém histórico de até 50 passos para Desfazer/Refazer
    const snap = JSON.stringify(this.doc);
    if (this.historicoIndice >= 0 && this.historico[this.historicoIndice] === snap) return;

    this.historico = this.historico.slice(0, this.historicoIndice + 1);
    this.historico.push(snap);
    if (this.historico.length > 50) this.historico.shift();
    this.historicoIndice = this.historico.length - 1;
  }

  desfazer() {
    if (this.historicoIndice > 0) {
      this.historicoIndice--;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  refazer() {
    if (this.historicoIndice < this.historico.length - 1) {
      this.historicoIndice++;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'ath-editor-layout';

    // 1. TopBar do Editor
    root.innerHTML = `
      <header class="ath-topbar">
        <div class="ath-topbar-left">
          <div class="ath-brand-badge" id="athBrandVoltar" title="Voltar ao Painel Inicial">
            ${svgIcone('artigo', 20)}
            <span>ATHENES</span>
          </div>
          <input type="text" class="ath-doc-titulo-input" id="athInputTituloDoc" value="${this.doc.titulo || 'Sem título'}" title="Renomear Documento">
          <span class="ath-badge ath-badge-primary" style="font-size:10px;">${this.doc.perfil?.toUpperCase() || 'ABNT'}</span>
        </div>

        <div class="ath-topbar-right">
          <button type="button" class="ath-btn ath-btn-icon" id="athBtnDesfazer" title="Desfazer (Ctrl+Z)">${svgIcone('desfazer', 16)}</button>
          <button type="button" class="ath-btn ath-btn-icon" id="athBtnRefazer" title="Refazer (Ctrl+Y)">${svgIcone('refazer', 16)}</button>
          <div class="ath-toolbar-sep"></div>
          <button type="button" class="ath-btn ath-btn-sm" id="athBtnAbaZotero">${svgIcone('zotero', 15)} Zotero & Leitura</button>
          <button type="button" class="ath-btn ath-btn-sm" id="athBtnAbaConexoes">${svgIcone('conexoes', 15)} Grafo</button>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnExportarModal">${svgIcone('exportar', 14)} Exportar</button>
        </div>
      </header>

      <!-- 2. Barra de Formatação e Controles -->
      <nav class="ath-toolbar">
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovoParagrafo">+ Parágrafo</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovoTitulo">+ Título</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaCitacao">+ Citação</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaTabela">+ Tabela</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaImagem">+ Imagem</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaNota">+ Nota</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaPagina" title="Inserir nova folha de página">+ Página</button>
        <div class="ath-toolbar-sep"></div>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtNegrito" title="Negrito (Ctrl+B)">${svgIcone('negrito', 14)}</button>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtItalico" title="Itálico (Ctrl+I)">${svgIcone('italico', 14)}</button>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtSublinhado" title="Sublinhado (Ctrl+U)">${svgIcone('sublinhado', 14)}</button>
        <div class="ath-toolbar-sep"></div>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtAlinEsq" title="Alinhar à Esquerda">${svgIcone('alinhamento_esq', 14)}</button>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtAlinCen" title="Centralizar">${svgIcone('alinhamento_cen', 14)}</button>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtAlinDir" title="Alinhar à Direita">${svgIcone('alinhamento_dir', 14)}</button>
        <button type="button" class="ath-btn ath-btn-icon" id="athFmtAlinJus" title="Justificar">${svgIcone('alinhamento_jus', 14)}</button>
        <div class="ath-toolbar-sep"></div>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnToggleMargens" title="Alternar Visibilidade das Linhas de Margem">${svgIcone('snap', 14)} Margens</button>
      </nav>

      <!-- 3. Workspace (Estrutura à Esquerda + Palco de Páginas ao Centro + Inspetor à Direita) -->
      <div class="ath-workspace">
        <aside class="ath-sidebar-left">
          <div class="ath-sidebar-head">
            <span>Estrutura do Artigo</span>
            <span class="ath-badge ath-badge-primary">${this.doc.paginas?.length || 1} Págs</span>
          </div>
          <div class="ath-toc-arvore" id="athSidebarToc"></div>
        </aside>

        <main class="ath-canvas-stage" id="athCanvasStage">
          <canvas class="ath-regua-canvas ath-regua-h" id="athReguaH" width="1200" height="24"></canvas>
          <div id="athPaginasContainer"></div>
        </main>

        <aside class="ath-inspector" id="athInspectorContainer"></aside>
      </div>
    `;

    this.container.appendChild(root);

    // Eventos da barra superior
    root.querySelector('#athBrandVoltar').addEventListener('click', () => this.onVoltarDashboard());

    const inputTitulo = root.querySelector('#athInputTituloDoc');
    inputTitulo.addEventListener('change', () => {
      this.doc.titulo = inputTitulo.value.trim() || 'Sem título';
      this.salvarSnapshot();
      this.onAlterado(this.doc);
    });

    root.querySelector('#athBtnDesfazer').addEventListener('click', () => this.desfazer());
    root.querySelector('#athBtnRefazer').addEventListener('click', () => this.refazer());
    root.querySelector('#athBtnExportarModal').addEventListener('click', () => this.onAbrirExportar());
    root.querySelector('#athBtnAbaZotero').addEventListener('click', () => this.onAbrirZotero());
    root.querySelector('#athBtnAbaConexoes').addEventListener('click', () => this.onAbrirConexoes());

    // Ações de criação de bloco rápido
    root.querySelector('#athBtnNovoParagrafo').addEventListener('click', () => this.adicionarBloco('paragrafo'));
    root.querySelector('#athBtnNovoTitulo').addEventListener('click', () => this.adicionarBloco('titulo'));
    root.querySelector('#athBtnNovaCitacao').addEventListener('click', () => this.adicionarBloco('citacao'));
    root.querySelector('#athBtnNovaTabela').addEventListener('click', () => this.adicionarBloco('tabela'));
    root.querySelector('#athBtnNovaImagem').addEventListener('click', () => this.adicionarBloco('imagem'));
    root.querySelector('#athBtnNovaNota').addEventListener('click', () => this.adicionarBloco('nota'));
    root.querySelector('#athBtnNovaPagina').addEventListener('click', () => this.adicionarPagina());

    // Formatação de seleção
    root.querySelector('#athFmtNegrito').addEventListener('click', () => document.execCommand('bold'));
    root.querySelector('#athFmtItalico').addEventListener('click', () => document.execCommand('italic'));
    root.querySelector('#athFmtSublinhado').addEventListener('click', () => document.execCommand('underline'));
    root.querySelector('#athFmtAlinEsq').addEventListener('click', () => document.execCommand('justifyLeft'));
    root.querySelector('#athFmtAlinCen').addEventListener('click', () => document.execCommand('justifyCenter'));
    root.querySelector('#athFmtAlinDir').addEventListener('click', () => document.execCommand('justifyRight'));
    root.querySelector('#athFmtAlinJus').addEventListener('click', () => document.execCommand('justifyFull'));

    root.querySelector('#athBtnToggleMargens').addEventListener('click', () => {
      this.margensVisiveis = !this.margensVisiveis;
      root.querySelectorAll('.ath-folha').forEach(f => f.classList.toggle('com-margens-visiveis', this.margensVisiveis));
    });

    // Atalhos de teclado no editor (Ctrl+Z, Ctrl+Y, Ctrl+S)
    document.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') {
        ev.preventDefault();
        this.desfazer();
      } else if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'y' || (ev.shiftKey && ev.key === 'Z'))) {
        ev.preventDefault();
        this.refazer();
      }
    });

    this.renderizarSidebarToc();
    this.renderizarFolhasPaginas();
  }

  renderizarSidebarToc() {
    const tocEl = this.container.querySelector('#athSidebarToc');
    if (!tocEl) return;
    tocEl.innerHTML = '';

    (this.doc.paginas || []).forEach((pag, idx) => {
      const modelo = modeloDaPagina(this.doc, pag);
      const itemPag = document.createElement('div');
      itemPag.className = `ath-toc-item ${this.paginaSelecionada?.id === pag.id ? 'ativo' : ''}`;
      itemPag.innerHTML = `
        <span style="font-weight:700; color:var(--ath-primary);">${idx + 1}</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Página ${idx + 1} (${modelo.nome})</span>
      `;
      itemPag.addEventListener('click', () => {
        this.paginaSelecionada = pag;
        this.renderizarSidebarToc();
        const folhaEl = this.container.querySelector(`[data-folha-id="${pag.id}"]`);
        if (folhaEl) folhaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      tocEl.appendChild(itemPag);
    });
  }

  renderizarFolhasPaginas() {
    const container = this.container.querySelector('#athPaginasContainer');
    if (!container) return;
    container.innerHTML = '';

    const estilosMap = {};
    for (const est of (this.doc.estilos || [])) {
      estilosMap[est.id] = est;
    }

    (this.doc.paginas || []).forEach((pag, pagIdx) => {
      const modelo = modeloDaPagina(this.doc, pag);
      const m = modelo.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
      const { largura_mm, altura_mm } = dimensoesPapelMm(modelo.formato, modelo.orientacao);

      const folha = document.createElement('article');
      folha.className = `ath-folha ${this.margensVisiveis ? 'com-margens-visiveis' : ''}`;
      folha.dataset.folhaId = pag.id;
      folha.style.width = `${largura_mm}mm`;
      folha.style.minHeight = `${altura_mm}mm`;
      folha.style.setProperty('--ath-margem-top', `${m.t}mm`);
      folha.style.setProperty('--ath-margem-right', `${m.r}mm`);
      folha.style.setProperty('--ath-margem-bottom', `${m.b}mm`);
      folha.style.setProperty('--ath-margem-left', `${m.l}mm`);
      folha.style.padding = `${m.t}mm ${m.r}mm ${m.b}mm ${m.l}mm`;

      // Conteúdo da Folha
      const folhaConteudo = document.createElement('div');
      folhaConteudo.className = 'ath-folha-conteudo';

      // 1. Cabeçalho se o modelo ativar
      if (modelo.cabecalho?.ativo) {
        const cabTexto = (modelo.cabecalho.texto || '')
          .replace('{documento.titulo}', this.doc.titulo || '')
          .replace('{documento.autor_principal}', this.doc.metadados?.autores?.[0]?.nome || '');
        const cabEl = document.createElement('div');
        cabEl.style.cssText = `text-align:${modelo.cabecalho.alinhamento || 'direita'}; border-bottom:${modelo.cabecalho.linha_divisoria ? '1px solid #E2E8F0' : 'none'}; padding-bottom:3mm; margin-bottom:5mm; font-size:8.5pt; color:#64748B;`;
        cabEl.textContent = cabTexto;
        folhaConteudo.appendChild(cabEl);
      }

      // 2. Grade de Blocos
      const cols = modelo.grade?.colunas || 1;
      const gap = modelo.grade?.gap_mm || 0;
      const grade = document.createElement('div');
      grade.className = 'ath-grade-colunas';
      grade.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      grade.style.columnGap = `${gap}mm`;

      (pag.blocos || []).forEach(b => {
        const blocoEl = this.criarElementoBloco(b, pag, estilosMap);
        grade.appendChild(blocoEl);
      });

      folhaConteudo.appendChild(grade);

      // 3. Rodapé se o modelo ativar
      if (modelo.rodape?.ativo) {
        const rodTexto = (modelo.rodape.texto || '')
          .replace('{documento.titulo}', this.doc.titulo || '')
          .replace('{documento.autor_principal}', this.doc.metadados?.autores?.[0]?.nome || '');
        const rodEl = document.createElement('div');
        rodEl.style.cssText = `display:flex; justify-content:space-between; align-items:center; border-top:${modelo.rodape.linha_divisoria ? '1px solid #E2E8F0' : 'none'}; padding-top:3mm; margin-top:auto; font-size:8.5pt; color:#64748B;`;
        rodEl.innerHTML = `
          <span>${rodTexto}</span>
          ${modelo.rodape.numeracao ? `<span>Página ${pag.numero || (pagIdx + 1)}</span>` : ''}
        `;
        folhaConteudo.appendChild(rodEl);
      }

      folha.appendChild(folhaConteudo);
      container.appendChild(folha);
    });
  }

  criarElementoBloco(b, pagina, estilosMap) {
    const wrap = document.createElement('div');
    wrap.className = `ath-bloco-wrapper ${this.blocoSelecionado?.id === b.id ? 'ath-selecionado' : ''}`;
    wrap.dataset.blocoId = b.id;

    const span = Math.min(b.span || 1, 12);
    wrap.style.gridColumn = `span ${span}`;

    const est = estilosMap[b.estiloId] || estilosMap.corpo;
    const estiloCss = estiloParaCss(est);

    // Badge do Tipo
    const badge = document.createElement('span');
    badge.className = 'ath-bloco-badge-tipo';
    badge.textContent = b.tipo;
    wrap.appendChild(badge);

    // Alça de Arrasto
    const alca = document.createElement('span');
    alca.className = 'ath-bloco-alca';
    alca.title = 'Arrastar bloco';
    alca.innerHTML = svgIcone('arrastar', 14);
    wrap.appendChild(alca);

    // Barra de Ações do Bloco
    const acoes = document.createElement('div');
    acoes.className = 'ath-bloco-acoes';
    acoes.innerHTML = `
      <button type="button" class="ath-btn ath-btn-icon ath-btn-subir" title="Subir Bloco">${svgIcone('seta_cima', 12)}</button>
      <button type="button" class="ath-btn ath-btn-icon ath-btn-descer" title="Descer Bloco">${svgIcone('seta_baixo', 12)}</button>
      <button type="button" class="ath-btn ath-btn-icon ath-btn-duplicar" title="Duplicar Bloco">${svgIcone('copiar', 12)}</button>
      <button type="button" class="ath-btn ath-btn-icon ath-btn-excluir" title="Excluir Bloco">${svgIcone('lixeira', 12)}</button>
    `;

    acoes.querySelector('.ath-btn-subir').addEventListener('click', (e) => { e.stopPropagation(); this.moverBloco(pagina, b, -1); });
    acoes.querySelector('.ath-btn-descer').addEventListener('click', (e) => { e.stopPropagation(); this.moverBloco(pagina, b, 1); });
    acoes.querySelector('.ath-btn-duplicar').addEventListener('click', (e) => { e.stopPropagation(); this.duplicarBloco(pagina, b); });
    acoes.querySelector('.ath-btn-excluir').addEventListener('click', (e) => { e.stopPropagation(); this.removerBloco(pagina, b); });

    wrap.appendChild(acoes);

    // Área Editável do Bloco (WYSIWYG Direto)
    const corpoBloco = document.createElement('div');
    corpoBloco.className = 'ath-bloco-editavel';
    corpoBloco.style.cssText = estiloCss;

    if (b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'paragrafo') {
      corpoBloco.contentEditable = 'true';
      corpoBloco.dataset.placeholder = b.tipo === 'titulo' ? 'Título da seção...' : 'Digite seu texto aqui...';
      corpoBloco.innerHTML = b.texto || '';

      corpoBloco.addEventListener('input', () => {
        b.texto = corpoBloco.innerHTML;
        this.salvarSnapshot();
        this.onAlterado(this.doc);
      });

      // Pressionar Enter em parágrafo cria um novo parágrafo abaixo
      corpoBloco.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey && (b.tipo === 'paragrafo' || b.tipo === 'titulo')) {
          ev.preventDefault();
          this.inserirBlocoAbaixo(pagina, b, 'paragrafo');
        }
      });
    } else if (b.tipo === 'citacao') {
      corpoBloco.innerHTML = `
        <blockquote style="margin:0; padding-left:14px; border-left:3px solid var(--ath-primary);">
          <div contenteditable="true" class="ath-citacao-txt" data-placeholder="Texto da citação...">${b.texto || ''}</div>
          <span style="display:block; font-size:10.5pt; color:var(--ath-muted); margin-top:4px;">(${b.autor || 'AUTOR'}, ${b.ano || 's.d.'}${b.pagina_citada ? ', p. ' + b.pagina_citada : ''})</span>
        </blockquote>
      `;
      const txt = corpoBloco.querySelector('.ath-citacao-txt');
      txt.addEventListener('input', () => {
        b.texto = txt.innerHTML;
        this.salvarSnapshot();
        this.onAlterado(this.doc);
      });
    } else if (b.tipo === 'tabela') {
      const colunas = b.colunas || [];
      const linhas = b.linhas || [];

      corpoBloco.innerHTML = `
        ${b.titulo ? `<div contenteditable="true" class="ath-tb-tit" style="font-weight:700; margin-bottom:4px;">${b.titulo}</div>` : ''}
        <table class="ath-tabela" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>${colunas.map((c, ci) => `<th contenteditable="true" data-col="${ci}">${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${linhas.map((l, li) => `<tr>${l.map((v, ci) => `<td contenteditable="true" data-row="${li}" data-col="${ci}">${v}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button type="button" class="ath-btn ath-btn-sm ath-btn-add-linha">+ Linha</button>
          <button type="button" class="ath-btn ath-btn-sm ath-btn-add-col">+ Coluna</button>
        </div>
      `;

      // Eventos das células da tabela
      corpoBloco.querySelectorAll('td, th').forEach(cell => {
        cell.addEventListener('input', () => {
          const r = cell.dataset.row;
          const c = cell.dataset.col;
          if (r !== undefined) {
            b.linhas[r][c] = cell.innerText;
          } else {
            b.colunas[c] = cell.innerText;
          }
          this.salvarSnapshot();
          this.onAlterado(this.doc);
        });
      });

      corpoBloco.querySelector('.ath-btn-add-linha').addEventListener('click', (e) => {
        e.stopPropagation();
        const novaLinha = colunas.map(() => 'Novo dado');
        b.linhas.push(novaLinha);
        this.renderizarFolhasPaginas();
        this.onAlterado(this.doc);
      });

      corpoBloco.querySelector('.ath-btn-add-col').addEventListener('click', (e) => {
        e.stopPropagation();
        b.colunas.push(`Col ${b.colunas.length + 1}`);
        b.linhas.forEach(l => l.push('—'));
        this.renderizarFolhasPaginas();
        this.onAlterado(this.doc);
      });
    } else if (b.tipo === 'imagem') {
      corpoBloco.innerHTML = `
        ${b.dataUrl || b.url
          ? `<img src="${b.dataUrl || b.url}" style="max-width:${b.largura_pct || 80}%; border-radius:4px; display:block; margin:0 auto;">`
          : `<div style="height:80px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:6px; display:grid; place-items:center; color:#64748B;">Clique no painel direito para carregar a imagem</div>`
        }
        <div contenteditable="true" class="ath-img-leg" style="text-align:center; font-size:10pt; color:#475569; margin-top:4px;">${b.legenda || 'Figura 1 — Legenda da imagem'}</div>
      `;
      corpoBloco.querySelector('.ath-img-leg').addEventListener('input', (e) => {
        b.legenda = e.target.innerText;
        this.onAlterado(this.doc);
      });
    } else if (b.tipo === 'sumario') {
      const itens = gerarSumarioDinamico(this.doc);
      corpoBloco.innerHTML = `
        <h2 style="text-align:center; margin-bottom:12px;">SUMÁRIO</h2>
        <div>${itens.map(it => `
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11pt; padding-left:${(it.nivel - 1) * 6}mm;">
            <span>${it.texto}</span>
            <span style="flex:1; border-bottom:1px dotted #CBD5E1; margin:0 8px;"></span>
            <span>${it.pagina}</span>
          </div>
        `).join('')}</div>
      `;
    } else if (b.tipo === 'referencias') {
      const refs = this.doc.referencias || [];
      const norma = this.doc.perfil || 'abnt';
      corpoBloco.innerHTML = `
        <h2 style="margin-bottom:12px;">REFERÊNCIAS</h2>
        <div>${refs.map((r, i) => `<div style="margin-bottom:8px; font-size:11pt;">${formatarReferenciaCompleta(r, norma, i + 1)}</div>`).join('') || '<p style="color:#64748B; font-style:italic;">Nenhuma referência inserida ainda.</p>'}</div>
      `;
    } else {
      corpoBloco.contentEditable = 'true';
      corpoBloco.innerHTML = b.texto || '';
      corpoBloco.addEventListener('input', () => {
        b.texto = corpoBloco.innerHTML;
        this.onAlterado(this.doc);
      });
    }

    wrap.appendChild(corpoBloco);

    // Seleção de Bloco
    wrap.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.selecionarBloco(b, pagina);
    });

    return wrap;
  }

  selecionarBloco(bloco, pagina) {
    this.blocoSelecionado = bloco;
    this.paginaSelecionada = pagina;

    this.container.querySelectorAll('.ath-bloco-wrapper').forEach(el => {
      el.classList.toggle('ath-selecionado', el.dataset.blocoId === bloco.id);
    });

    this.onSelecionarBloco(bloco, pagina);
  }

  adicionarBloco(tipo) {
    const pag = this.paginaSelecionada || this.doc.paginas[0];
    const novo = criarNovoBloco(tipo);
    pag.blocos.push(novo);
    this.salvarSnapshot();
    this.renderizarFolhasPaginas();
    this.selecionarBloco(novo, pag);
    this.onAlterado(this.doc);
  }

  inserirBlocoAbaixo(pagina, blocoAtual, tipo) {
    const idx = pagina.blocos.indexOf(blocoAtual);
    const novo = criarNovoBloco(tipo, { estiloId: 'corpo', texto: '' });
    pagina.blocos.splice(idx + 1, 0, novo);
    this.salvarSnapshot();
    this.renderizarFolhasPaginas();
    this.selecionarBloco(novo, pagina);
    this.onAlterado(this.doc);

    // Foca imediatamente no novo bloco
    setTimeout(() => {
      const el = this.container.querySelector(`[data-bloco-id="${novo.id}"] .ath-bloco-editavel`);
      if (el) el.focus();
    }, 50);
  }

  moverBloco(pagina, bloco, delta) {
    const idx = pagina.blocos.indexOf(bloco);
    const novoIdx = idx + delta;
    if (novoIdx < 0 || novoIdx >= pagina.blocos.length) return;

    pagina.blocos.splice(idx, 1);
    pagina.blocos.splice(novoIdx, 0, bloco);
    this.salvarSnapshot();
    this.renderizarFolhasPaginas();
    this.selecionarBloco(bloco, pagina);
    this.onAlterado(this.doc);
  }

  duplicarBloco(pagina, bloco) {
    const idx = pagina.blocos.indexOf(bloco);
    const clone = JSON.parse(JSON.stringify(bloco));
    clone.id = gerarId('bloco');
    pagina.blocos.splice(idx + 1, 0, clone);
    this.salvarSnapshot();
    this.renderizarFolhasPaginas();
    this.selecionarBloco(clone, pagina);
    this.onAlterado(this.doc);
  }

  removerBloco(pagina, bloco) {
    const idx = pagina.blocos.indexOf(bloco);
    pagina.blocos.splice(idx, 1);
    this.blocoSelecionado = null;
    this.salvarSnapshot();
    this.renderizarFolhasPaginas();
    this.onAlterado(this.doc);
  }

  adicionarPagina() {
    const num = this.doc.paginas.length + 1;
    const nova = {
      id: gerarId('pg'),
      modeloId: 'corpo',
      numero: num,
      blocos: [
        criarNovoBloco('titulo', { nivel: 2, texto: `Seção da Página ${num}` }),
        criarNovoBloco('paragrafo', { texto: 'Escreva diretamente aqui...' })
      ]
    };
    this.doc.paginas.push(nova);
    this.salvarSnapshot();
    this.renderizarSidebarToc();
    this.renderizarFolhasPaginas();
    this.onAlterado(this.doc);
  }

  inserirCitacaoNoCursor(referencia) {
    const citPillTexto = gerarCitacaoInline(referencia, this.doc.perfil || 'abnt');
    const pillHtml = `<span class="ath-citacao-pill" data-ref-id="${referencia.id}" title="${referencia.titulo}">${citPillTexto}</span>&nbsp;`;
    document.execCommand('insertHTML', false, pillHtml);
    this.salvarSnapshot();
    this.onAlterado(this.doc);
  }
}
