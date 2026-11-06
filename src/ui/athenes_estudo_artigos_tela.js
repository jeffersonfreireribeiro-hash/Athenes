// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Artigos: tela cheia: palco de páginas, coluna esquerda e estrutura do estúdio.
 * Métodos do EstudoArtigosView (usam `this`); são acrescentados ao prototype em athenes_estudo_artigos.js.
 */
import { obterConfigGoogleDrive } from '../core/athenes_colaboracao.js';
import { localDoPdfVinculado } from '../core/athenes_zotero_anexos_notas.js';
import { tornarColunasRedimensionaveis } from './athenes_colunas_redim.js';
import { artigoEstaNaPasta } from '../core/athenes_zotero_pastas.js';
import { escapeHtml, sanitizarHtmlEditorial } from '../core/athenes_seguranca.js';
import { svgIcone, svgLogo } from './athenes_icones.js';
import { mostrarAviso } from './athenes_aviso.js';
import { registrarPdfLocalNoArtigo, salvarArtigosEstudo, definirArtigoAbertoAtivo, formatarCitacaoAbntDoArtigo, artigoTemPdf, ehArtigoExemploFicticio } from './athenes_estudo_artigos_dados.js';

/**
 * PDF guardado pelo próprio Zotero (arquivo importado): fica na pasta de dados do Zotero, em storage/CHAVE-DO-ANEXO/arquivo.pdf.
 * A web não sabe onde é a pasta de dados deste computador (padrão: a pasta "Zotero" do seu usuário), então mostra o que sabe.
 */
function htmlArmazenamentoZotero(anexo) {
  if (!anexo?.chave) return '';
  const rel = `storage/${anexo.chave}`;
  const copiar = (rot, texto) => texto ? `<button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-copiar="${escapeHtml(texto)}">${rot}</button>` : '';
  return `<div class="ath-pdf-local">
    <div><span>Pasta</span><code>${escapeHtml(rel)}</code>${copiar('Copiar pasta', rel)}</div>
    <div><span>Arquivo</span><code>${escapeHtml(anexo.nomeArquivo || '')}</code>${copiar('Copiar nome', anexo.nomeArquivo || '')}</div>
    <small>Dentro da pasta de dados do Zotero (padrão: a pasta "Zotero" do seu usuário). No Zotero Desktop, clique com o botão direito no item e escolha "Mostrar arquivo" para abrir essa pasta.</small>
  </div>`;
}

/** Onde o Zotero guardou o PDF vinculado, com botões para copiar a pasta ou o caminho (para achar o arquivo ao selecioná-lo). */
function htmlLocalDoPdf(anexo) {
  const l = localDoPdfVinculado(anexo);
  if (!l) return '<p class="ath-pdf-local-dica">O Zotero não informou onde o arquivo está. Procure pelo nome: <code>' + escapeHtml(anexo.nomeArquivo || '') + '</code></p>';
  const copiar = (rot, texto) => texto ? `<button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-copiar="${escapeHtml(texto)}">${rot}</button>` : '';
  return `<div class="ath-pdf-local">
    ${l.pasta ? `<div><span>Pasta</span><code>${escapeHtml(l.pasta)}</code>${copiar('Copiar pasta', l.pasta)}</div>` : ''}
    <div><span>Arquivo</span><code>${escapeHtml(l.arquivo)}</code>${copiar('Copiar nome', l.arquivo)}</div>
    ${l.relativo ? '<small>O caminho é relativo à pasta de anexos vinculados configurada no Zotero (Editar › Configurações › Avançado › Arquivos e pastas › Diretório base).</small>' : '<small>Cole a pasta na janela de seleção de arquivo para ir direto até ele.</small>'}
  </div>`;
}

export const metodosEstudoTela = {
  renderizarEstudioPdfFullScreen(art, scrollSalvo = 0) {
    definirArtigoAbertoAtivo(art);
    if (!art.fichamento) {
      art.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {}, grifosPorPagina: {} };
    }

    const pdfInfo = art.pdfBlobUrl ? this._pdfDocs?.get(art.pdfBlobUrl) : null;
    if (pdfInfo) {
      const atuais = Array.isArray(art.conteudoPaginasPdf) ? art.conteudoPaginasPdf : [];
      const qtdReais = atuais.filter(p => p.real).length;
      if (!atuais.length || !atuais[0]?.real || qtdReais !== pdfInfo.n) {
        const paginasReais = pdfInfo.dims.map((_, i) => ({
          numero: i + 1,
          real: true,
          cabecalho: '',
          titulo: `Folha ${i + 1} do PDF`,
          autores: '',
          paragrafos: []
        }));
        const extras = atuais.filter(p => p.extra);
        extras.forEach((ext, idx) => {
          ext.numero = pdfInfo.n + idx + 1;
        });
        art.conteudoPaginasPdf = [...paginasReais, ...extras];
      }
    }

    // sem PDF vinculado não se inventam páginas: o palco avisa e oferece vincular (o fichamento e o resumo seguem disponíveis)
    const temPaginasCompartilhadas = Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.some(p => Array.isArray(p.paragrafos) && p.paragrafos.length > 0 && p.paragrafos.some(txt => String(txt || '').trim()));
    const semPdf = !art.pdfBlobUrl && !ehArtigoExemploFicticio(art) && !temPaginasCompartilhadas;
    const paginasPdf = semPdf ? [] : (Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.length > 0
      ? art.conteudoPaginasPdf
      : [{ numero: 1, cabecalho: art.publicacao || 'Artigo PDF', titulo: art.titulo, autores: '', paragrafos: [art.resumoOriginal || ''] }]);
    if (!semPdf) { art.conteudoPaginasPdf = paginasPdf; art.totalPaginas = paginasPdf.length; }

    const totalPags = paginasPdf.length;
    if (this.paginaAtual > totalPags) this.paginaAtual = Math.max(1, totalPags);
    if (this.paginaAtual < 1) this.paginaAtual = 1;

    const citacoes = art.fichamento.citacoesMarcadas || [];
    const conectadoZot = this.temZoteroConectado();

    const root = document.createElement('div');
    root.className = 'rm-conteudo ath-estudio-full-shell';

    // 1. TOPO SHELL (.ath-topo-shell — 52px)
    const topoShell = document.createElement('header');
    topoShell.className = 'ath-topo-shell';
    topoShell.innerHTML = `
      <div class="ath-topo-esq">
        <a class="ath-marca-link" id="athBrandVoltarCatalogo" title="Voltar para o Catálogo de Artigos">
          ${svgLogo(26)}
          <span>ATHENES</span>
        </a>
        <input type="text" class="ath-doc-titulo-topo" id="athInputTituloArtigoTopo" value="${escapeHtml(art.titulo || 'Artigo Científico')}" title="Clique para editar o título do artigo">
        <span class="rm-selo">${escapeHtml(formatarCitacaoAbntDoArtigo(art))}</span>
        <span class="ath-selo-zotero" style="padding:4px 9px; border-radius:999px; font-size:10.5px;">
          ${svgIcone('zotero', 11)} ${escapeHtml(art.chaveZotero || 'ZOTERO')}
        </span>
      </div>

      <div class="ath-topo-dir">
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnTopoZoteroCredenciais" title="Configurar chave de API e User ID do Zotero">
          <span class="ath-dot-conexao ${conectadoZot ? 'on' : ''}"></span>
          ${svgIcone('zotero', 14)}
          <span>${conectadoZot ? `Zotero (${escapeHtml(this.zoteroClient.userId || 'Ativo')})` : 'Conectar Zotero'}</span>
        </button>

        <label class="glx-btn glx-btn-soft glx-btn-sm" style="cursor:pointer; margin:0;" title="Abrir arquivo PDF do computador ou da pasta do Google Drive">
          ${svgIcone('drive', 14)}
          <span>Abrir PDF</span>
          <input type="file" accept="application/pdf" id="athInputCarregarPdfReal" style="display:none;">
        </label>

        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnCompartilharArtigo" title="Compartilhar este artigo, PDF e anotações com outras pessoas">
          ${svgIcone('usuarios', 14)}
          <span>Compartilhar</span>
        </button>
      </div>
    `;
    root.appendChild(topoShell);

    // 2. CORPO EM 3 COLUNAS (.rm-editor.rm-main > .rm-ed-grade)
    const editorEl = document.createElement('div');
    editorEl.className = 'rm-editor rm-main';
    editorEl.innerHTML = `
      <div class="rm-ed-grade">
        <!-- COLUNA 1 (ESQUERDA): Dividida 50/50 com .rm-card-meio-a-meio igual ao Editor de Escrita -->
        <aside class="rm-col rm-col-esq" id="athEstudioColEsq"></aside>

        <!-- COLUNA 2 (CENTRO): Barra de Topo + Barra Flutuante (.rm-barra-blocos) + Palco Contínuo de Todas as Páginas -->
        <section class="rm-col rm-col-prev" id="athEstudioColPrev">
          <div class="rm-prev-topo">
            <div class="rm-prev-topo-esq">
              <strong>Estúdio PDF</strong>
              <span class="rm-prev-info">
                ${semPdf ? 'Sem PDF vinculado' : `${totalPags} ${totalPags === 1 ? 'página' : 'páginas'} em rolagem contínua`} · <b id="athLabelModoRisco">${this.rotuloFerramenta(this.ferramentaAtiva)}${this.modoLinhaReta ? ' (Linha Reta)' : ''}</b>
              </span>
            </div>

            <div class="rm-prev-menus-topo" id="athEstudioMenusTopo">
              <div class="rm-menu-topo-item" data-menu-est="zotero">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopZotero" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('zotero', 14)}
                  <span>Chave Zotero & Sync</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverEstZotero" role="dialog" hidden style="width:340px;"></div>
              </div>

              <div class="rm-menu-topo-item" data-menu-est="drive">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopDrive" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('drive', 14)}
                  <span>Arquivo PDF & Drive</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover ath-topo-popover-drive" id="athPopoverEstDrive" role="dialog" hidden></div>
              </div>

              <div class="rm-menu-topo-item" data-menu-est="caneta">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopCaneta" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('lapis', 14)}
                  <span>Espessura & Zoom</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverEstCaneta" role="dialog" hidden style="width:310px;"></div>
              </div>
            </div>
          </div>

          <!-- BARRA DE PÍLULA FLUTUANTE (.rm-barra-blocos) -->
          <div class="rm-barra-blocos" id="athEstudioBarraFlutuante">
            <button type="button" class="rm-ic-bt" id="athBtnVoltarCatalogoArtigos" title="Voltar para o Catálogo de Artigos" aria-label="Voltar">
              ${svgIcone('voltar', 16)}
            </button>
            <button type="button" class="rm-ic-bt rm-ic-primario" id="athBtnSalvarPilula" title="Salvar alterações, traços de caneta e citações" aria-label="Salvar">
              ${svgIcone('salvar', 16)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnCompartilharPilula" title="Compartilhar este documento com outras pessoas" aria-label="Compartilhar">
              ${svgIcone('usuarios', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <button type="button" class="rm-ic-bt" id="athBtnDesfazerTraco" title="Desfazer último risco da página ativa" aria-label="Desfazer risco">
              ${svgIcone('desfazer', 16)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnLimparTracosPagina" title="Limpar riscos da página ativa" aria-label="Limpar riscos">
              ${svgIcone('lixeira', 15)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Ferramentas: Seleção de Texto, Caneta, Marca-Texto, Modo Linha Reta, Borracha, Nota Adesiva, Citação -->
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'cursor' ? 'ativo' : ''}" data-tool="cursor" data-tip="Selecionar Texto (Grifar / Citar)" title="Selecionar Texto no PDF (abre menu flutuante para Grifar, Citar ou Criar Nota)">
              ${svgIcone('paragrafo', 15)}
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'caneta' ? 'ativo' : ''}" data-tool="caneta" data-tip="Caneta" title="Caneta de Desenho (mão livre ou reta)">
              ${svgIcone('lapis', 15)}
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'marcatexto' ? 'ativo' : ''}" data-tool="marcatexto" data-tip="Marca-Texto" title="Marca-Texto Translúcido">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            </button>

            <!-- Botão de Ativar/Desativar Modo Linha Reta -->
            <button type="button" class="rm-ic-bt ath-btn-linha-reta ${this.modoLinhaReta ? 'ativo' : ''}" id="athBtnModoLinhaReta" data-tip="Linha Reta" title="Ativar/Desativar Modo Linha Reta para Caneta e Marca-Texto (ou segure Shift ao riscar)" aria-pressed="${this.modoLinhaReta ? 'true' : 'false'}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="4" y1="20" x2="20" y2="4"/>
                <circle cx="4" cy="20" r="2" fill="currentColor"/>
                <circle cx="20" cy="4" r="2" fill="currentColor"/>
              </svg>
            </button>

            <!-- Botão Modo Caneta / Samsung Notes (Caneta escreve · Dedo apenas rola e faz zoom) -->
            <button type="button" class="rm-ic-bt ath-btn-dedo-rola ${this.bloquearDedoParaRolar ? 'ativo' : ''}" id="athBtnDedoRola" data-tip="Modo Caneta" title="${this.bloquearDedoParaRolar ? 'Modo Samsung Notes ATIVO: Caneta Stylus escreve · Dedo apenas rola e dá zoom (clique para desenhar com o dedo)' : 'Desenhar com o Dedo: Dedo e caneta riscam (clique para ativar modo Samsung Notes)'}" aria-pressed="${this.bloquearDedoParaRolar ? 'true' : 'false'}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
              </svg>
            </button>

            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'borracha' ? 'ativo' : ''}" data-tool="borracha" data-tip="Borracha" title="Borracha para apagar traços">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'nota' ? 'ativo' : ''}" data-tool="nota" data-tip="Nota Adesiva" title="Clique em qualquer ponto da folha para abrir um painel de Nota Adesiva editável">
              ${svgIcone('nota', 15)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnCapturarCitacaoPdf" data-tip="Nova Citação" title="Registrar citação direta no fichamento Zotero">
              ${svgIcone('citacao', 15)}
            </button>

            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Bolinhas de Cor Rápidas -->
            <div class="ath-cores-tinta" title="Cor da caneta, linha reta, marca-texto ou nota">
              ${['#314F79', '#DC2626', '#059669', '#D97706', '#7C3AED', '#FACC15'].map(cor => `
                <button type="button" class="ath-cor-dot ${this.corTinta === cor ? 'on' : ''}" data-cor="${cor}" style="background:${cor};" aria-label="Cor ${cor}"></button>
              `).join('')}
            </div>

            <!-- Espessura do traço (Caneta / Marca-Texto) -->
            <div class="ath-espessuras" id="athEspessuras" ${(this.ferramentaAtiva === 'caneta' || this.ferramentaAtiva === 'marcatexto') ? '' : 'hidden'} title="Espessura do traço">
              ${[0, 1, 2, 3].map(() => `<button type="button" class="ath-esp-btn" data-esp="0"><span></span></button>`).join('')}
            </div>

            <!-- Controles de Zoom para Tablet e Desktop -->
            <div class="ath-zoom-controles-barra" style="display:flex; align-items:center; gap:2px; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:999px; padding:2px 4px;" title="Zoom das folhas">
              <button type="button" class="rm-ic-bt" id="athBtnZoomMenos" title="Diminuir Zoom" aria-label="Diminuir Zoom" style="width:26px; height:26px; font-weight:800; font-size:14px; display:inline-flex; align-items:center; justify-content:center; border:none; background:transparent; cursor:pointer;">−</button>
              <button type="button" id="athBtnZoomIndicadorBarra" title="Clique para alternar escala (100% · 125% · 150% · 75%)" style="border:none; background:transparent; font:800 11.5px var(--glx-font, inherit); color:#314F79; padding:0 5px; cursor:pointer; min-width:40px; text-align:center;">${this.zoomPct}%</button>
              <button type="button" class="rm-ic-bt" id="athBtnZoomMais" title="Aumentar Zoom" aria-label="Aumentar Zoom" style="width:26px; height:26px; font-weight:800; font-size:14px; display:inline-flex; align-items:center; justify-content:center; border:none; background:transparent; cursor:pointer;">+</button>
            </div>

            <!-- Botão de Adicionar Folha Extra e Indicador de Página à Direita -->
            <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
              <span id="athIndicadorPagBarra" style="font:800 11.5px var(--glx-font); color:#314F79; background:#EEF4FA; padding:4px 10px; border-radius:999px;">
                ${semPdf ? 'Sem PDF' : `Pág. ${this.paginaAtual} de ${totalPags}`}
              </span>
              <button type="button" class="rm-ic-bt" id="athPdfNovaPag" data-tip="Folha Extra" title="Adicionar folha extra de esquemas/notas ao final do PDF" style="width:32px; height:32px;">
                ${svgIcone('mais', 14)}
              </button>
            </div>
          </div>

          <!-- PALCO CENTRAL COM TODAS AS PÁGINAS EMPILHADAS (.rm-prev-palco) -->
          <div class="rm-prev-palco" id="athEstudioPalco">
            <!-- Pílula Contextual Flutuante ao Selecionar Texto no PDF -->
            <div class="ath-pdf-selecao-popover" id="athPdfSelecaoPopover" hidden>
              <!-- Paleta de Cores para o Marcador / Grifo -->
              <div class="ath-sel-pop-cores" id="athSelPopCores" title="Escolha a cor do marcador para este trecho">
                <button type="button" class="ath-sel-cor-chip on" data-sel-cor="#FDE047" style="background:#FDE047;" title="Amarelo"></button>
                <button type="button" class="ath-sel-cor-chip" data-sel-cor="#86EFAC" style="background:#86EFAC;" title="Verde"></button>
                <button type="button" class="ath-sel-cor-chip" data-sel-cor="#93C5FD" style="background:#93C5FD;" title="Azul"></button>
                <button type="button" class="ath-sel-cor-chip" data-sel-cor="#FCA5A5" style="background:#FCA5A5;" title="Rosa / Coral"></button>
                <button type="button" class="ath-sel-cor-chip" data-sel-cor="#D8B4FE" style="background:#D8B4FE;" title="Roxo"></button>
                <button type="button" class="ath-sel-cor-chip" data-sel-cor="#FDBA74" style="background:#FDBA74;" title="Laranja"></button>
              </div>
              <button type="button" class="ath-sel-pop-btn" id="athSelBtnGrifar" title="Grifar o trecho selecionado na página">
                <span class="ath-sel-cor-dot" id="athSelCorDotAtivo" style="background:#FDE047;"></span>
                <span>Grifar Texto</span>
              </button>
              <button type="button" class="ath-sel-pop-btn primario" id="athSelBtnCitar" title="Salvar trecho selecionado como Citação no Zotero com página">
                ${svgIcone('citacao', 13)}
                <span>+ Citação Zotero</span>
              </button>
              <button type="button" class="ath-sel-pop-btn" id="athSelBtnNota" title="Criar uma Nota Adesiva na página com este trecho">
                ${svgIcone('nota', 13)}
                <span>Criar Nota</span>
              </button>
              <button type="button" class="ath-sel-pop-btn" id="athSelBtnCopiarAbnt" title="Copiar trecho já formatado com (AUTOR, ANO, p. X)">
                <span>Copiar ABNT</span>
              </button>
            </div>

            <div class="ath-pdf-todas-paginas-stack" id="athPdfTodasPaginasStack"></div>
          </div>
        </section>

        <!-- COLUNA 3 (DIREITA): Inspetor Completo de Fichamento, Citações e Zotero + Drive -->
        <aside class="rm-col rm-col-dir" id="athEstudioColDir">
          <div class="rm-props ath-estudio-inspetor-card">
            <div class="ath-estudio-abas">
              <button type="button" class="ath-estudio-aba ${this.abaDireita === 'resumo' ? 'on' : ''}" data-aba="resumo">
                Resumo & Notas
              </button>
              <button type="button" class="ath-estudio-aba ${this.abaDireita === 'citacoes' ? 'on' : ''}" data-aba="citacoes">
                Citações (${citacoes.length})
              </button>
              <button type="button" class="ath-estudio-aba ${this.abaDireita === 'zotero_drive' ? 'on' : ''}" data-aba="zotero_drive">
                Zotero & Drive
              </button>
            </div>
            <div class="ath-estudio-painel-corpo" id="athEstudioPainelCorpo"></div>
          </div>
        </aside>
      </div>
    `;

    root.appendChild(editorEl);
    this.container.appendChild(root);
    tornarColunasRedimensionaveis(editorEl.querySelector('.rm-ed-grade'), { nome: 'estudio', padraoEsq: 340, padraoDir: 350 }); // barras laterais: recolher e ajustar a largura

    // Renderiza TODAS as páginas empilhadas no palco central
    this.renderizarTodasAsPaginasNoPalco(root, art, paginasPdf);

    // Monta a Coluna Esquerda 50/50 (Artigos Zotero em cima + Páginas do PDF embaixo)
    this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);

    // Monta Popovers de Topo
    this.configurarPopoversTopoEstudio(root, art);

    // Configura o Menu Flutuante de Seleção de Texto no PDF
    this.configurarSelecaoTextoInterativa(root, art, paginasPdf);

    // Eventos de Topo e Barra Flutuante
    const voltarParaCatalogo = () => {
      if (this._tecladoZoomHandler) {
        window.removeEventListener('keydown', this._tecladoZoomHandler);
        this._tecladoZoomHandler = null;
      }
      if (this._selectionChangeHandler) {
        document.removeEventListener('selectionchange', this._selectionChangeHandler);
        this._selectionChangeHandler = null;
      }
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('athenes_estudio_artigo_id');
          sessionStorage.removeItem('athenes_estudio_pag');
          sessionStorage.setItem('athenes_nav_tela', 'dashboard');
        }
      } catch (_) {}
      if (typeof window !== 'undefined' && window.history) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('artigo');
          if (url.searchParams.get('tela') === 'estudio') {
            url.searchParams.set('tela', 'dashboard');
          }
          window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
        } catch (_) {}
      }
      salvarArtigosEstudo(this.artigos, art);
      definirArtigoAbertoAtivo(null);
      this.artigoAberto = null;
      this.renderizar();
    };
    root.querySelector('#athBrandVoltarCatalogo').addEventListener('click', voltarParaCatalogo);
    root.querySelector('#athBtnVoltarCatalogoArtigos').addEventListener('click', voltarParaCatalogo);

    // Atalhos de Zoom silenciosos (Ctrl + +, Ctrl + -, Ctrl + 0)
    if (this._tecladoZoomHandler) {
      window.removeEventListener('keydown', this._tecladoZoomHandler);
      this._tecladoZoomHandler = null;
    }
    this._tecladoZoomHandler = (e) => {
      if (!this.artigoAberto) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault();
          this.aplicarZoom(this.zoomPct + 10, root);
        } else if (e.key === '-' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          this.aplicarZoom(this.zoomPct - 10, root);
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          this.aplicarZoom(100, root);
        }
      }
    };
    window.addEventListener('keydown', this._tecladoZoomHandler);

    // Suporte a zoom com foco e pan fluído no Palco do PDF
    const palcoZoomEl = root.querySelector('#athEstudioPalco');
    if (palcoZoomEl) {
      // Zoom suave com roda do mouse / trackpad pinch ancorado exatamente no cursor (PC Desktop)
      palcoZoomEl.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const rect = palcoZoomEl.getBoundingClientRect();
          const pontoFoco = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
          // Sensibilidade proporcional calibrada para alta precisão e suavidade
          const delta = Math.max(-100, Math.min(100, e.deltaY));
          const fator = 1 - (delta * 0.0016);
          const novoZoom = this.zoomPct * fator;
          this.aplicarZoom(novoZoom, root, pontoFoco);
        }
      }, { passive: false });

      // Gesto de pinça contínuo e pan simultâneo a 60/120 FPS via requestAnimationFrame (Tablets)
      let distIniTouch = 0;
      let zoomBaseTouch = 100;
      let midIniX = 0;
      let midIniY = 0;
      let conteudoIniX = 0;
      let conteudoIniY = 0;
      let rafTouchId = null;
      let pinchPendente = null;

      const executarPinch = () => {
        if (!pinchPendente) return;
        const { novoZoom, midAtualX, midAtualY } = pinchPendente;
        pinchPendente = null;
        this.aplicarPinchZoom(novoZoom, root, conteudoIniX, conteudoIniY, zoomBaseTouch, midAtualX, midAtualY);
      };

      palcoZoomEl.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 2) {
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          distIniTouch = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
          if (distIniTouch > 10) {
            zoomBaseTouch = this.zoomPct;
            const rect = palcoZoomEl.getBoundingClientRect();
            midIniX = (t0.clientX + t1.clientX) / 2 - rect.left;
            midIniY = (t0.clientY + t1.clientY) / 2 - rect.top;
            conteudoIniX = palcoZoomEl.scrollLeft + midIniX;
            conteudoIniY = palcoZoomEl.scrollTop + midIniY;
          }
        }
      }, { passive: true });

      palcoZoomEl.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length === 2 && distIniTouch > 10) {
          e.preventDefault();
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          const distAtual = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
          const rect = palcoZoomEl.getBoundingClientRect();
          const midAtualX = (t0.clientX + t1.clientX) / 2 - rect.left;
          const midAtualY = (t0.clientY + t1.clientY) / 2 - rect.top;

          const ratio = distAtual / distIniTouch;
          const novoZoom = zoomBaseTouch * ratio;

          pinchPendente = { novoZoom, midAtualX, midAtualY };
          if (!rafTouchId) {
            rafTouchId = requestAnimationFrame(() => {
              rafTouchId = null;
              executarPinch();
            });
          }
        }
      }, { passive: false });

      const finalizarTouch = () => {
        distIniTouch = 0;
        pinchPendente = null;
        if (rafTouchId) {
          cancelAnimationFrame(rafTouchId);
          rafTouchId = null;
        }
      };

      palcoZoomEl.addEventListener('touchend', (e) => {
        if (!e.touches || e.touches.length < 2) {
          finalizarTouch();
        }
      }, { passive: true });

      palcoZoomEl.addEventListener('touchcancel', finalizarTouch, { passive: true });
    }

    // Botões dedicados de zoom na barra flutuante (Tablets e Desktop)
    root.querySelector('#athBtnZoomMenos')?.addEventListener('click', () => {
      this.aplicarZoom(this.zoomPct - 15, root);
    });
    root.querySelector('#athBtnZoomMais')?.addEventListener('click', () => {
      this.aplicarZoom(this.zoomPct + 15, root);
    });
    root.querySelector('#athBtnZoomIndicadorBarra')?.addEventListener('click', () => {
      const escalas = [100, 125, 150, 75];
      const idx = escalas.indexOf(this.zoomPct);
      const proximo = escalas[(idx + 1) % escalas.length];
      this.aplicarZoom(proximo, root);
    });

    root.querySelector('#athInputTituloArtigoTopo').addEventListener('change', e => {
      art.titulo = e.target.value.trim() || art.titulo;
      salvarArtigosEstudo(this.artigos, art);
      this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
    });

    root.querySelector('#athBtnTopoZoteroCredenciais').addEventListener('click', () => {
      this.abrirModalCredenciaisZotero();
    });

    const acionarCompartilhar = () => {
      this.abrirModalCompartilharArtigo(art);
    };
    root.querySelector('#athBtnCompartilharArtigo')?.addEventListener('click', acionarCompartilhar);
    root.querySelector('#athBtnCompartilharPilula')?.addEventListener('click', acionarCompartilhar);

    const acionarSalvarCompleto = (btnRef) => {
      this.sincronizarArtigoComDriveEZotero(art, btnRef);
    };
    root.querySelector('#athBtnSalvarDriveEZotero')?.addEventListener('click', (e) => acionarSalvarCompleto(e.currentTarget));
    root.querySelector('#athBtnSalvarPilula')?.addEventListener('click', (e) => acionarSalvarCompleto(e.currentTarget));

    // Desfazer último risco e limpar riscos da página ativa
    root.querySelector('#athBtnDesfazerTraco').addEventListener('click', () => {
      const lista = art.fichamento?.tracosPorPagina?.[this.paginaAtual];
      if (Array.isArray(lista) && lista.length > 0) {
        lista.pop();
        salvarArtigosEstudo(this.artigos, art);
        const canvasAtivo = root.querySelector(`canvas[data-canvas-pag="${this.paginaAtual}"]`);
        this.redesenharCanvasTinta(canvasAtivo, art, this.paginaAtual);
        this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
      }
    });

    root.querySelector('#athBtnLimparTracosPagina').addEventListener('click', () => {
      if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
      art.fichamento.tracosPorPagina[this.paginaAtual] = [];
      salvarArtigosEstudo(this.artigos, art);
      const canvasAtivo = root.querySelector(`canvas[data-canvas-pag="${this.paginaAtual}"]`);
      this.redesenharCanvasTinta(canvasAtivo, art, this.paginaAtual);
      this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
    });

    // Alternar Modo Caneta Inteligente / Samsung Notes vs Desenho com o Dedo
    root.querySelector('#athBtnDedoRola')?.addEventListener('click', () => {
      this.bloquearDedoParaRolar = !this.bloquearDedoParaRolar;
      this.atualizarEstadoFerramentasNoDom(root);
    });

    // Alternar Modo Linha Reta
    const btnLinhaReta = root.querySelector('#athBtnModoLinhaReta');
    btnLinhaReta.addEventListener('click', () => {
      this.modoLinhaReta = !this.modoLinhaReta;
      if (this.modoLinhaReta && (this.ferramentaAtiva === 'cursor' || this.ferramentaAtiva === 'borracha' || this.ferramentaAtiva === 'nota')) {
        this.ferramentaAtiva = 'caneta';
      }
      this.atualizarEstadoFerramentasNoDom(root);
    });

    // Seleção de Ferramenta (Cursor, Caneta, Marca-Texto, Borracha, Nota)
    root.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ferramentaAtiva = btn.dataset.tool;
        this.atualizarEstadoFerramentasNoDom(root);
      });
    });

    // Seleção de Cor da Tinta e do Marcador
    root.querySelectorAll('[data-cor]').forEach(dot => {
      dot.addEventListener('click', () => {
        this.corTinta = dot.dataset.cor;
        this.corGrifoAtiva = dot.dataset.cor;
        root.querySelectorAll('[data-cor]').forEach(d => d.classList.toggle('on', d.dataset.cor === this.corTinta));
        const dotPopover = root.querySelector('#athSelCorDotAtivo');
        if (dotPopover) dotPopover.style.background = this.corGrifoAtiva;
        root.querySelectorAll('[data-sel-cor]').forEach(c => c.classList.toggle('on', c.dataset.selCor === this.corGrifoAtiva));
      });
    });

    // Espessura do traço (Caneta usa espessuraTinta; Marca-Texto usa espessuraMarca)
    root.querySelectorAll('#athEspessuras [data-esp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = parseInt(btn.dataset.esp, 10) || 3;
        if (this.ferramentaAtiva === 'marcatexto') this.espessuraMarca = v;
        else this.espessuraTinta = v;
        this.atualizarEstadoFerramentasNoDom(root);
      });
    });
    this.atualizarEstadoFerramentasNoDom(root);

    root.querySelector('#athBtnCapturarCitacaoPdf').addEventListener('click', () => {
      this.abrirModalCitacaoPdf(art, { pagina: this.paginaAtual });
    });

    root.querySelector('#athPdfNovaPag').addEventListener('click', () => {
      this.adicionarFolhaExtraNoPdf(art, paginasPdf);
    });

    root.querySelector('#athInputCarregarPdfReal').addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      registrarPdfLocalNoArtigo(art, file);
      if (this._pdfFalhou) this._pdfFalhou.clear();
      salvarArtigosEstudo(this.artigos, art);
      this.renderizar();
    });

    // Vincular PDF via botão do aviso na folha do palco
    root.querySelectorAll('.ath-input-vincular-pdf-palco').forEach(inp => {
      inp.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        registrarPdfLocalNoArtigo(art, file);
        if (this._pdfFalhou) this._pdfFalhou.clear();
        salvarArtigosEstudo(this.artigos, art);
        this.renderizar();
      });
    });

    // Botão de buscar PDF na nuvem dentro do placeholder do palco
    root.querySelectorAll('[data-tentar-baixar-pdf-nuvem]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = 'Buscando PDF na Nuvem...';

        let ok = await garantirPdfDoArtigo(art);
        if (!ok && typeof obterTokenOuConectar === 'function') {
          try {
            await obterTokenOuConectar();
            ok = await garantirPdfDoArtigo(art);
          } catch (_) {}
        }

        if (ok) {
          this.abrirArtigoNoEstudio(art);
        } else {
          btn.disabled = false;
          btn.innerHTML = textoOriginal;
          mostrarAviso('O PDF ainda não foi localizado na nuvem ou requer conexão com o Google Drive. Peça ao proprietário para verificar o compartilhamento no Athenes dele.', { tipo: 'aviso' });
        }
      });
    });

    // Abrir pasta no Google Drive a partir do botão da folha
    root.querySelectorAll('[data-abrir-pasta-drive-palco]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cfg = obterConfigGoogleDrive();
        let pasta = cfg.pastaUrl || 'https://drive.google.com/drive/folders/1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv?usp=drive_link';
        const idPasta = extrairIdPastaDrive(pasta);
        const urlFinal = idPasta ? `https://drive.google.com/drive/folders/${idPasta}` : (pasta.startsWith('http') ? pasta : `https://drive.google.com/drive/folders/${pasta}`);
        window.open(urlFinal, '_blank', 'noopener,noreferrer');
      });
    });

    // Drag & Drop de arquivo PDF direto no Palco central
    const palcoEl = root.querySelector('#athEstudioPalco');
    if (palcoEl && !palcoEl.dataset.dropPdfLigado) {
      palcoEl.dataset.dropPdfLigado = '1';
      ['dragenter', 'dragover'].forEach(evName => {
        palcoEl.addEventListener(evName, e => {
          e.preventDefault();
          e.stopPropagation();
          palcoEl.classList.add('ath-palco-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(evName => {
        palcoEl.addEventListener(evName, e => {
          e.preventDefault();
          e.stopPropagation();
          palcoEl.classList.remove('ath-palco-dragover');
        });
      });
      palcoEl.addEventListener('drop', e => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const pdfFile = Array.from(files).find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
          if (pdfFile) {
            registrarPdfLocalNoArtigo(art, pdfFile);
            if (this._pdfFalhou) this._pdfFalhou.clear();
            salvarArtigosEstudo(this.artigos, art);
            this.renderizar();
          }
        }
      });
    }

    // Abas do painel lateral direito
    root.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaDireita = btn.dataset.aba;
        root.querySelectorAll('.ath-estudio-aba').forEach(b => b.classList.toggle('on', b.dataset.aba === this.abaDireita));
        this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
      });
    });

    // Renderiza Inspetor Direito
    this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);

    // Restaura rolagem do palco se houver
    const palcoNovo = root.querySelector('#athEstudioPalco');
    if (palcoNovo && scrollSalvo > 0) {
      palcoNovo.scrollTop = scrollSalvo;
    }
  },

  renderizarTodasAsPaginasNoPalco(root, art, paginasPdf) {
    const stack = root.querySelector('#athPdfTodasPaginasStack');
    if (!stack) return;
    stack.innerHTML = '';
    const palcoEl = root.querySelector('#athEstudioPalco');
    if (palcoEl) palcoEl.style.setProperty('--ath-zoom', String((this.zoomPct || 100) / 100));

    const temPaginasCompartilhadas = Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.some(p => Array.isArray(p.paragrafos) && p.paragrafos.length > 0 && p.paragrafos.some(txt => String(txt || '').trim()));
    // sem PDF: aviso claro no lugar das páginas (nada de folha inventada)
    if (!art.pdfBlobUrl && !ehArtigoExemploFicticio(art) && !temPaginasCompartilhadas) {
      const carregando = this._carregandoPdf === art;
      const aviso = document.createElement('div');
      aviso.className = 'ath-pdf-sem-arquivo';
      aviso.innerHTML = carregando
        ? '<strong>Carregando o PDF do Google Drive…</strong>'
        : `<strong>Este artigo ainda não tem PDF vinculado</strong>
           <p>O registro veio do Zotero só com os dados da obra. Vincule o arquivo para ler, grifar e citar com página. O resumo e o fichamento ao lado já funcionam.</p>
           ${art.anexoPdfZotero?.baixavel ? `<p><b>PDF disponível no Zotero:</b> baixe-o do armazenamento do Zotero e ele será guardado no seu Google Drive.</p>${htmlArmazenamentoZotero(art.anexoPdfZotero)}`
             : art.anexoPdfZotero ? `<p><b>PDF só no seu computador:</b> no Zotero ele é um arquivo vinculado (não baixável pela web). Selecione o arquivo abaixo.</p>${htmlLocalDoPdf(art.anexoPdfZotero)}` : ''}
           <div class="ath-pdf-sem-arquivo-acoes">
             ${art.anexoPdfZotero?.baixavel ? `<button type="button" class="glx-btn glx-btn-primary glx-btn-sm" data-baixar-pdf-zotero>${svgIcone('drive', 14)} Baixar do Zotero</button>` : ''}
             <label class="glx-btn glx-btn-primary glx-btn-sm" style="cursor:pointer;">${svgIcone('upload', 14)} Selecionar PDF no computador<input type="file" accept="application/pdf,.pdf" hidden></label>
             <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" data-sem-pdf-drive>${svgIcone('drive', 14)} Do Google Drive…</button>
           </div>`;
      aviso.querySelector('input[type=file]')?.addEventListener('change', (e) => {
        const arq = e.target.files?.[0];
        if (!arq) return;
        registrarPdfLocalNoArtigo(art, arq);
        if (this._pdfFalhou) this._pdfFalhou.clear();
        salvarArtigosEstudo(this.artigos, art);
        this.renderizar();
      });
      aviso.querySelector('[data-baixar-pdf-zotero]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Baixando do Zotero…';
        try {
          this.carregarConfigZotero();
          const blob = await this.zoteroClient.baixarAnexoPdf(art.anexoPdfZotero.chave);
          const nome = String(art.anexoPdfZotero.nomeArquivo || `${art.id}.pdf`).replace(/(\.pdf)?$/i, '.pdf');
          registrarPdfLocalNoArtigo(art, new File([blob], nome, { type: 'application/pdf' })); // abre e envia ao Drive
          if (this._pdfFalhou) this._pdfFalhou.clear();
          salvarArtigosEstudo(this.artigos, art);
          this.renderizar();
        } catch (err) {
          btn.disabled = false; btn.textContent = 'Baixar do Zotero';
          mostrarAviso(`${err.message} Selecione o PDF no computador ou no Google Drive.`);
        }
      });
      aviso.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
        const texto = b.dataset.copiar;
        try { await navigator.clipboard.writeText(texto); } catch (_) {
          const r = document.createRange(); const alvo = b.closest('.ath-pdf-local')?.querySelector('code'); if (alvo) { r.selectNodeContents(alvo); getSelection().removeAllRanges(); getSelection().addRange(r); }
        }
        const rot = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => { b.textContent = rot; }, 1500);
      }));
      aviso.querySelector('[data-sem-pdf-drive]')?.addEventListener('click', () => this.escolherPdfNoDrive(art));
      stack.appendChild(aviso);
      return;
    }

    // PDF real: renderiza cada página do arquivo como uma folha própria (no formato original)
    const pdfInfo = art.pdfBlobUrl ? this._pdfDocs?.get(art.pdfBlobUrl) : null;
    if (art.pdfBlobUrl && !pdfInfo && !this._pdfFalhou?.has(art.pdfBlobUrl)) {
      stack.innerHTML = '<div class="ath-pdf-carregando">Carregando as páginas do PDF...</div>';
      this.carregarPdfReal(art).then(() => {
        if (this.artigoAberto === art) this.renderizar();
      }).catch(() => {
        if (this.artigoAberto === art) this.renderizar();
      });
      return;
    }
    if (pdfInfo) {
      const atuais = Array.isArray(art.conteudoPaginasPdf) ? art.conteudoPaginasPdf : [];
      const qtdReais = atuais.filter(p => p.real).length;
      if (!atuais.length || !atuais[0]?.real || qtdReais !== pdfInfo.n) {
        const paginasReais = pdfInfo.dims.map((_, i) => ({
          numero: i + 1,
          real: true,
          cabecalho: '',
          titulo: `Folha ${i + 1} do PDF`,
          autores: '',
          paragrafos: []
        }));
        const extras = atuais.filter(p => p.extra);
        extras.forEach((ext, idx) => {
          ext.numero = pdfInfo.n + idx + 1;
        });
        art.conteudoPaginasPdf = [...paginasReais, ...extras];
      }
      paginasPdf = art.conteudoPaginasPdf;
      art.totalPaginas = paginasPdf.length;
    }
    const totalPags = paginasPdf.length;
    const folhasReais = [];

    paginasPdf.forEach((pagDados, idx) => {
      const numPag = idx + 1;
      const pinsDaPagina = art.fichamento.notasPagina?.[numPag] || [];
      const tracosDaPagina = art.fichamento.tracosPorPagina?.[numPag] || [];
      const isPagAtiva = numPag === this.paginaAtual;
      const ehPaginaPdfReal = Boolean(pdfInfo && idx < pdfInfo.n && !pagDados.extra);
      const dimPag = ehPaginaPdfReal ? pdfInfo.dims[idx] : null;
      const alturaReal = dimPag ? Math.round(794 * dimPag.h / dimPag.w) : 1123;
      const escalaZoom = this.zoomPct / 100;
      const alturaWrapEscalada = Math.round(alturaReal * escalaZoom);

      const folhaWrap = document.createElement('div');
      folhaWrap.className = 'ath-pdf-pagina-bloco-wrap';
      folhaWrap.dataset.wrapPagina = String(numPag);
      folhaWrap.style.minHeight = '';

      folhaWrap.innerHTML = `
        <div class="ath-pdf-etiqueta-pagina ${isPagAtiva ? 'ativa' : ''}" data-etiqueta-pag="${numPag}">
          <span class="ath-pdf-etiqueta-num">Página ${numPag} de ${totalPags} — ${escapeHtml((pagDados.titulo || (ehPaginaPdfReal ? `Folha ${numPag} do PDF` : `Folha Extra ${numPag}`)).slice(0, 62))}</span>
          <span class="ath-pdf-etiqueta-stats" data-stats-pag="${numPag}">${tracosDaPagina.length} risco(s) · ${pinsDaPagina.length} nota(s)</span>
        </div>

        <div class="ath-folha-a4 ath-pdf-folha-container ${pagDados.extra ? 'ath-pdf-folha-extra' : ''} ${isPagAtiva ? 'pagina-ativa' : ''}" data-num-pagina="${numPag}" data-altura-real="${alturaReal}" style="${ehPaginaPdfReal ? `width:794px; height:${alturaReal}px; min-height:${alturaReal}px; max-height:${alturaReal}px; padding:0; flex-shrink:0; ` : 'width:794px; height:1123px; min-height:1123px; flex-shrink:0; background:#FFFFFF; '}transform: scale(${escalaZoom}); transform-origin: 0 0;">
          ${ehPaginaPdfReal ? `
            <canvas class="ath-pdf-render-canvas" style="width:794px; height:${alturaReal}px;"></canvas>
            <div class="ath-pdf-grifos-layer" data-grifos-pag="${numPag}"></div>
            <div class="ath-pdf-folha-texto ath-pdf-text-layer" data-texto-pag="${numPag}"></div>
          ` : (pagDados.paragrafos && pagDados.paragrafos.length > 0) ? `
            <div class="ath-pdf-folha-texto ${pagDados.extra ? 'ath-pdf-folha-extra-corpo' : ''}" data-texto-pag="${numPag}">
              <div class="ath-pdf-folha-cabecalho">${escapeHtml(pagDados.cabecalho || '')}</div>
              <h2 class="ath-pdf-folha-titulo">${escapeHtml(pagDados.titulo || '')}</h2>
              ${pagDados.autores ? `<div class="ath-pdf-folha-autores">${escapeHtml(pagDados.autores)}</div>` : ''}
              <div class="ath-pdf-folha-colunas" data-colunas-pag="${numPag}">
                ${pagDados.htmlGrifado
                  ? sanitizarHtmlEditorial(pagDados.htmlGrifado)
                  : (pagDados.paragrafos || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
              </div>
              <div class="ath-pdf-folha-rodape">
                <span>DOI: ${escapeHtml(art.doi || '10.1000/athenes.zotero')}</span>
                <span>Página ${numPag} de ${totalPags} · ${pagDados.extra ? 'Folha de Anotações e Esquemas' : `Google Drive (${escapeHtml(art.driveFileName || 'PDF')})`}</span>
              </div>
            </div>
          ` : numPag === 1 ? `
            <div class="ath-pdf-folha-vincular-aviso">
              <div class="ath-pdf-vincular-card">
                <div class="ath-pdf-vincular-icone">
                  ${svgIcone((art.compartilhadoComigo || art.proprietarioExterno) ? 'usuarios' : 'drive', 36)}
                </div>
                <h3 class="ath-pdf-vincular-titulo">${(art.compartilhadoComigo || art.proprietarioExterno) ? 'Artigo Compartilhado com Você' : 'Vincular Arquivo PDF a Este Artigo'}</h3>
                <p class="ath-pdf-vincular-sub">
                  ${(art.compartilhadoComigo || art.proprietarioExterno) 
                    ? `Este documento foi compartilhado por <strong>${escapeHtml(art.proprietario?.nome || art.proprietario_email || 'outro autor')}</strong>. As notas e riscos foram sincronizados!`
                    : `O arquivo PDF de <strong>${escapeHtml(art.titulo || 'este artigo')}</strong> ainda não foi carregado neste computador.`}
                </p>
                <p class="ath-pdf-vincular-instrucao">
                  ${(art.compartilhadoComigo || art.proprietarioExterno)
                    ? 'Para ler o PDF original na tela cheia, tente baixar da nuvem ou selecione o arquivo .pdf no seu computador:'
                    : 'Seus PDFs ficam salvos na sua pasta do Google Drive. Você pode abrir sua pasta para baixar o arquivo ou selecioná-lo diretamente no seu computador:'}
                </p>
                <div class="ath-pdf-vincular-botoes">
                  <button type="button" class="glx-btn glx-btn-primary" data-tentar-baixar-pdf-nuvem style="display:inline-flex; align-items:center; gap:8px;">
                    ${svgIcone('sincronizar', 14)} Buscar PDF na Nuvem
                  </button>
                  <label class="glx-btn glx-btn-soft" style="cursor:pointer; display:inline-flex; align-items:center; gap:8px;">
                    ${svgIcone('upload', 14)} Selecionar Arquivo PDF...
                    <input type="file" accept=".pdf" class="ath-input-vincular-pdf-palco" hidden>
                  </label>
                  <button type="button" class="glx-btn glx-btn-soft" data-abrir-pasta-drive-palco style="display:inline-flex; align-items:center; gap:8px;">
                    ${svgIcone('drive', 14)} Abrir Google Drive ↗
                  </button>
                </div>
                <div class="ath-pdf-vincular-dropzone">
                  ${svgIcone('lampada', 14)} <strong>Dica rápida:</strong> Você também pode arrastar o arquivo <code>.pdf</code> e soltar em qualquer lugar desta tela!
                </div>
              </div>
            </div>
          ` : `
            <div class="ath-pdf-folha-texto ath-pdf-folha-vazia-placeholder">
              <div class="ath-pdf-folha-vazia-aviso">
                <span>Página ${numPag} de ${totalPags}</span>
                <p>Vincule o arquivo PDF na folha 1 para visualizar e anotar o conteúdo original desta página.</p>
              </div>
            </div>
          `}

          <!-- Camada Transparente de Risco Livre, Linha Reta e Marca-Texto (Samsung Notes Canvas) -->
          <canvas class="ath-pdf-ink-canvas" data-canvas-pag="${numPag}" width="794" height="${ehPaginaPdfReal ? alturaReal : 1123}" style="pointer-events: ${this.ferramentaAtiva === 'cursor' ? 'none' : 'auto'}; cursor: ${this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair'};"></canvas>

          <!-- Camada de Notas Adesivas Editáveis na Página -->
          <div class="ath-pdf-pins-layer" data-pins-pag="${numPag}"></div>
        </div>
      `;

      stack.appendChild(folhaWrap);
      if (ehPaginaPdfReal) {
        folhasReais.push(folhaWrap.querySelector('.ath-pdf-folha-container'));
        this.renderizarGrifosRetangularesDaPagina(folhaWrap.querySelector(`[data-grifos-pag="${numPag}"]`), art, numPag);
      }

      // Renderiza as notas adesivas (pins) desta página
      this.renderizarPinsDaPagina(folhaWrap.querySelector(`[data-pins-pag="${numPag}"]`), art, numPag, root);

      // Inicializa o Canvas de Risco Livre + Linha Reta desta página
      const canvasPag = folhaWrap.querySelector(`canvas[data-canvas-pag="${numPag}"]`);
      this.inicializarCanvasTinta(canvasPag, art, numPag, root);

      // a folha fica dentro de uma caixa do tamanho que aparece na tela (o zoom muda a caixa, não só o desenho)
      const folhaParaEscala = folhaWrap.querySelector('.ath-pdf-folha-container');
      const caixaEscala = document.createElement('div');
      caixaEscala.className = 'ath-pdf-escala';
      folhaParaEscala.replaceWith(caixaEscala);
      caixaEscala.appendChild(folhaParaEscala);
      this.aplicarEscalaNaFolha(folhaWrap, escalaZoom);

      // Clicar na folha define ela como página ativa
      const folhaContainer = folhaWrap.querySelector('.ath-pdf-folha-container');
      folhaContainer.addEventListener('pointerdown', () => {
        this.definirPaginaAtivaSilencioso(numPag, root);
      });
    });

    // Desenha as páginas do PDF real sob demanda (só as que estão perto da tela)
    if (pdfInfo && folhasReais.length) {
      const palcoRender = root.querySelector('#athEstudioPalco');
      const desenhar = (folha) => this.renderizarPaginaPdfReal(pdfInfo, folha, parseInt(folha.dataset.numPagina, 10));
      if (typeof IntersectionObserver !== 'undefined' && palcoRender) {
        this._obsPerto?.disconnect(); this._obsLonge?.disconnect();
        this._obsPerto = new IntersectionObserver(entradas => { entradas.forEach(en => { if (en.isIntersecting) desenhar(en.target); }); }, { root: palcoRender, rootMargin: '900px 0px' });
        this._obsLonge = new IntersectionObserver(entradas => { entradas.forEach(en => { if (!en.isIntersecting) this.liberarBitmapDaFolha(en.target); }); }, { root: palcoRender, rootMargin: '4500px 0px' });
        folhasReais.forEach(f => { this._obsPerto.observe(f); this._obsLonge.observe(f); });
      } else {
        folhasReais.forEach(desenhar);
      }
    }

    // Atualiza página ativa conforme rolagem do palco (com throttle via requestAnimationFrame)
    const palco = root.querySelector('#athEstudioPalco');
    if (palco) {
      const folhasCache = Array.from(palco.querySelectorAll('.ath-pdf-folha-container'));
      let scrollRafPendente = false;
      palco.addEventListener('scroll', () => {
        if (scrollRafPendente) return;
        scrollRafPendente = true;
        requestAnimationFrame(() => {
          scrollRafPendente = false;
          let melhorPag = this.paginaAtual;
          let menorDist = Infinity;
          const palcoRect = palco.getBoundingClientRect();
          for (let i = 0; i < folhasCache.length; i++) {
            const f = folhasCache[i];
            const r = f.getBoundingClientRect();
            const dist = Math.abs(r.top - palcoRect.top - 40);
            if (dist < menorDist) {
              menorDist = dist;
              melhorPag = parseInt(f.dataset.numPagina, 10) || 1;
            }
          }
          if (melhorPag !== this.paginaAtual) {
            this.definirPaginaAtivaSilencioso(melhorPag, root);
          }
        });
      }, { passive: true });
    }
  },

  renderizarColunaEsquerdaEstudio(colEsq, artAtivo, paginasPdf) {
    if (!colEsq) return;
    const listaOrdenada = typeof this.ordenarArtigos === 'function' ? this.ordenarArtigos(this.artigos) : this.artigos;
    const artigosFiltrados = listaOrdenada.filter(a => {
      if (this.pastaFiltroId && this.pastaFiltroId !== 'todas') {
        if (!artigoEstaNaPasta(a, this.pastaFiltroId)) return false;
      }
      if (!this.filtroLateralEsq) return true;
      const str = `${a.titulo} ${(a.autores || []).map(x => x.sobrenome).join(' ')} ${a.ano}`.toLowerCase();
      return str.includes(this.filtroLateralEsq);
    });

    colEsq.innerHTML = `
      <!-- METADE SUPERIOR (50%): ARTIGOS DO ZOTERO -->
      <div class="rm-card-meio-a-meio">
        <div class="rm-card-meio-a-meio-topo">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:8px; min-width:0;">
            <strong style="font:800 11.5px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;">
              Artigos do Zotero <span class="rm-contagem">(${this.artigos.length})</span>
            </strong>
            <div style="display:flex; gap:4px; flex-shrink:0;">
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athEsqBtnSyncZotero" title="Sincronizar com Zotero API" style="height:26px; padding:0 8px; font-size:11px; white-space:nowrap;">
                ${svgIcone('zotero', 12)} Sync
              </button>
              <button type="button" class="glx-btn glx-btn-primary glx-btn-xs" id="athEsqBtnNovoArtigo" title="Vincular novo artigo" style="height:26px; padding:0 8px; font-size:11px; white-space:nowrap;">
                + Artigo
              </button>
            </div>
          </div>
          <div style="margin-bottom:8px;">
            <input type="search" id="athInputFiltroEsqArtigos" value="${escapeHtml(this.filtroLateralEsq)}" placeholder="Filtrar artigos da biblioteca..." style="height:34px; font-size:12px; padding:0 12px; border-radius:8px; width:100%; box-sizing:border-box;">
          </div>
        </div>

        <div class="rm-card-meio-a-meio-corpo">
          ${artigosFiltrados.map((item, idx) => {
            const isAtivo = item.id === artAtivo.id;
            const qtdCit = item.fichamento?.citacoesMarcadas?.length || 0;
            return `
              <div class="rm-mestra-card ${isAtivo ? 'sel' : ''}" data-abrir-artigo-esq="${escapeHtml(item.id)}" style="display:flex; flex-direction:column; gap:5px; padding:10px 12px; border-radius:10px; border:1.5px solid ${isAtivo ? 'var(--ath-primary, #314F79)' : '#E2E8F0'}; background:${isAtivo ? '#EEF4FA' : '#FFFFFF'}; cursor:pointer; flex-shrink:0;">
                <div style="display:flex; align-items:flex-start; gap:8px; min-width:0;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:${isAtivo ? '#314F79' : '#E2E8F0'}; color:${isAtivo ? '#fff' : '#475569'}; font:800 11px var(--glx-font); flex:none; margin-top:1px;">
                    ${idx + 1}
                  </span>
                  <strong style="font-size:12.5px; font-weight:750; color:#1F2733; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; flex:1; min-width:0;" title="${escapeHtml(item.titulo)}">
                    ${escapeHtml(item.titulo)}
                  </strong>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:2px;">
                  <span class="rm-selo" style="font-size:10px; padding:3px 8px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(formatarCitacaoAbntDoArtigo(item))}</span>
                  <span style="font-size:11px; color:#314F79; font-weight:700; white-space:nowrap;">${qtdCit} citaç${qtdCit === 1 ? 'ão' : 'ões'}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- METADE INFERIOR (50%): PÁGINAS DO PDF & MARCAÇÕES -->
      <div class="rm-card-meio-a-meio">
        <div class="rm-card-meio-a-meio-topo">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:8px; min-width:0;">
            <strong style="font:800 11.5px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;">
              Páginas do PDF <span class="rm-contagem">(${paginasPdf.length})</span>
            </strong>
            <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athEsqBtnNovaFolha" style="height:26px; padding:0 9px; font-size:11px; white-space:nowrap; flex-shrink:0;">
              + Folha Extra
            </button>
          </div>
        </div>

        <div class="rm-card-meio-a-meio-corpo">
          <ul class="rm-blocos">
            ${paginasPdf.map((pg, idx) => {
              const numPag = idx + 1;
              const isPagAtiva = numPag === this.paginaAtual;
              const qtdRiscos = (artAtivo.fichamento?.tracosPorPagina?.[numPag] || []).length;
              const qtdNotas = (artAtivo.fichamento?.notasPagina?.[numPag] || []).length;
              const qtdCitsPag = (artAtivo.fichamento?.citacoesMarcadas || []).filter(c => Number(c.pagina) === Number(numPag)).length;
              const ehExtra = Boolean(pg.extra || (!pg.real && artAtivo.pdfBlobUrl && this._pdfDocs?.has(artAtivo.pdfBlobUrl) && idx >= (this._pdfDocs.get(artAtivo.pdfBlobUrl)?.n || 0)));
              return `
                <li class="rm-bl ${isPagAtiva ? 'sel' : ''}" data-ir-pagina-esq="${numPag}">
                  <button type="button" class="rm-bl-nome">
                    <strong>Página ${numPag} — ${escapeHtml((pg.titulo || (ehExtra ? `Folha Extra #${numPag}` : 'Folha do Artigo')).slice(0, 30))}</strong>
                    <span>${qtdRiscos} risco(s) · ${qtdNotas} nota(s) · ${qtdCitsPag} citação(ões)</span>
                  </button>
                  ${(ehExtra || !artAtivo.pdfBlobUrl) && paginasPdf.length > 1 ? `
                    <div class="rm-bl-acoes">
                      <button type="button" class="rm-ic rm-ic-perigo" data-excluir-pag-pdf="${numPag}" title="Remover esta página">
                        ${svgIcone('fechar', 11)}
                      </button>
                    </div>
                  ` : ''}
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      </div>
    `;

    const inputFiltro = colEsq.querySelector('#athInputFiltroEsqArtigos');
    inputFiltro.addEventListener('input', () => {
      this.filtroLateralEsq = inputFiltro.value.trim().toLowerCase();
      this.renderizarColunaEsquerdaEstudio(colEsq, artAtivo, paginasPdf);
    });

    colEsq.querySelector('#athEsqBtnSyncZotero').addEventListener('click', () => {
      this.sincronizarComZoteroApi();
    });

    colEsq.querySelector('#athEsqBtnNovoArtigo').addEventListener('click', () => {
      this.abrirModalVincularArtigo();
    });

    colEsq.querySelector('#athEsqBtnNovaFolha').addEventListener('click', () => {
      this.adicionarFolhaExtraNoPdf(artAtivo, paginasPdf);
    });

    colEsq.querySelectorAll('[data-abrir-artigo-esq]').forEach(card => {
      card.addEventListener('click', () => {
        const alvo = this.artigos.find(a => a.id === card.dataset.abrirArtigoEsq);
        if (alvo && alvo.id !== artAtivo.id) {
          salvarArtigosEstudo(this.artigos, artAtivo);
          this.abrirArtigoNoEstudio(alvo);
        }
      });
    });

    colEsq.querySelectorAll('[data-ir-pagina-esq]').forEach(li => {
      li.addEventListener('click', (e) => {
        if (e.target.closest('[data-excluir-pag-pdf]')) return;
        const pg = parseInt(li.dataset.irPaginaEsq, 10) || 1;
        this.rolarParaPagina(pg, this.container);
      });
    });

    colEsq.querySelectorAll('[data-excluir-pag-pdf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (paginasPdf.length <= 1) return;
        const pgDel = parseInt(btn.dataset.excluirPagPdf, 10);
        artAtivo.conteudoPaginasPdf = paginasPdf.filter((_, i) => (i + 1) !== pgDel);
        artAtivo.conteudoPaginasPdf.forEach((p, i) => { p.numero = i + 1; });
        artAtivo.totalPaginas = artAtivo.conteudoPaginasPdf.length;
        if (this.paginaAtual > artAtivo.totalPaginas) this.paginaAtual = artAtivo.totalPaginas;
        salvarArtigosEstudo(this.artigos, artAtivo);
        this.renderizar();
      });
    });
  }
};
