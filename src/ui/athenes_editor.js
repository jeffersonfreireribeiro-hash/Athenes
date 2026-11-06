import { CamadaSemanticaEditorUI } from './athenes_semantica_ui.js';
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor WYSIWYG de Documentos em Blocos na Folha.
 * Adota fielmente o layout de 3 colunas e componentes do Glaux GIS (relatorios_modelos):
 * - Coluna 1 (Esquerda): Configuração do Documento, Margens (.rm-folha-mini + #rmMDiag),
 *   Seções & Mestras, Cabeçalho e Rodapé, Estilos de Texto e Lista de Blocos.
 * - Coluna 2 (Centro): Barra de Blocos flutuante (.rm-barra-blocos), Informações de Prévia,
 *   e Palco com a Folha A4 Real com edição direta in-page (contenteditable).
 * - Coluna 3 (Direita): Inspetor de Bloco, Posição na Folha (12 colunas) e Blocos Compostos.
 */

import { contarUsoDoEstilo, excluirEstilo, ESTILOS_PROTEGIDOS } from '../core/athenes_estilos.js';
import { tornarColunasRedimensionaveis } from './athenes_colunas_redim.js';
import { obterTokenDrive } from '../core/athenes_drive_sync.js';
import { elementosMestraHtml, renderizadoPeloCanvas, contextoVariaveisPagina } from '../core/athenes_mestra_render.js';
import { margensEfetivasMm, elementosEfetivosDaPagina, caixaEnvolvente, sobrescreverNoDocumento, restaurarNoDocumento } from '../core/athenes_mestra_canvas.js';
import { dimensoesPapelMm } from '../core/athenes_grid.js';
import { estiloParaCss, estiloParaCssComAlinhamento, estiloParaCssNumeracao, localizarEstilo, FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';
import {
  criarNovoBloco,
  modeloDaPagina,
  repaginarDocumento,
  adicionarBlocoNaSecao,
  removerBlocoDaSecao,
  duplicarBloco,
  moverBloco,
  gerarId,
  ROTULOS_FIGURA,
  rotuloDaFigura,
  calcularLinhas,
  colocarBloco,
  moverBlocoPorLinha,
  duplicarBlocoNaSecao,
  dividirBlocoTexto,
  colapsoEntreBlocosPt,
  margensTextoPt,
  adicionarSecao,
  removerSecao,
  removerMestra,
  moverSecao,
  trocarMestraDaSecao,
  recalcularNumeracaoAutomatica,
  resolverReferenciasCruzadas,
  formatarNumeroPagina,
  gerarCssMolduraBloco,
  buscarSecaoDoBloco,
  obterModelosLayoutBloco,
  aplicarModeloLayoutBloco,
  removerPrefixoNumeracaoTitulo,
  obterTextoPuroTitulo,
  obterPrefixoNumeracao,
  obterTituloCompletoComNumeracao
} from '../core/athenes_documento.js';
import { svgIcone, svgLogo } from './athenes_icones.js';

import { modosPermitidos, modoInicialDoPapel } from '../core/athenes_compartilhamento.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { montarCitacao, indiceNaLista } from '../core/athenes_citacao.js';
import { mapaMarcadores, marcadorEfetivo } from '../core/athenes_marcadores.js';

import { linhasEstimadas, porLinhaUsadoNoTexto, calibracaoDoTexto, definirCalibracaoTexto, definirAlturaMedida, TIPOS_COM_ALTURA_MEDIDA } from '../core/athenes_fragmentos.js';
import { removerHifensCondicionais } from '../core/athenes_hifenizacao.js';
import { cssAvancadoDosEstilos, removerPalavrasIniciais } from '../core/athenes_estilo_avancado.js';
import { ModalEditorMestra } from './athenes_editor_mestra.js';
import { ModalLayoutBloco } from './athenes_editor_layout_bloco.js';
import { abrirPopoverEstiloTabela } from './athenes_tabela_ui.js';
import { instalarZoomCanvas } from './athenes_zoom_canvas.js';
import { ligarReguasDoDocumento } from './athenes_reguas_documento.js';

/** As réguas começam visíveis; a escolha da pessoa fica lembrada. */
function reguasVisiveis() { try { return localStorage.getItem('athenes_reguas_visiveis') !== '0'; } catch (_) { return true; } }
import { montarLeituraFiel, montarComparacao } from './athenes_visoes_revisao.js';
import { instalarSugestaoInline, abrirCardSugestao, fecharCardSugestao, SEL_MARCA } from './athenes_sugestoes_ui.js';
import { geometriaCorpoMm, resolverAreasPagina } from '../core/athenes_paginacao.js';
import { cssMarcadoresNota, obterConfigNotas, criarNotaRodape, htmlMarcadorNota, sanitizarHtmlNota, obterNota, removerNota, podarNotasOrfas } from '../core/athenes_notas_rodape.js';
import { construirAreaPaginaDom, construirNotasDom, abrirEditorNota, fecharEditorNota } from './athenes_pagina_ui.js';

import { criarBarraItemFigura, criarBotaoLayoutFigura } from './athenes_figura_ui.js';
import { papelDoSubtipo, ehFonteCodigo, obterPapelSemantico } from '../core/athenes_figura_layout.js';
import { abrirModalInserirFigura, abrirEditorCodigoFigura } from './athenes_figura_codigo_ui.js';
import { exemploDeCodigo } from '../core/athenes_figura_codigo.js';
import { ModalEditorEstilo } from './athenes_editor_estilo_modal.js';
import { ModalCentralEstilos } from './athenes_central_estilos_modal.js';
import { sanearDocumentoEstilos, sanearHtmlTexto, aplicarEstilosDeTrecho } from '../core/athenes_estilo_exclusivo.js';
import { AtalhosDoEditor } from './athenes_atalhos_editor.js';

import { calcularNumeracaoSecoes, extrairItensSumario, sumarioHtml, configEfetivaSumario, nivelDe, estiloIdDoTitulo } from '../core/athenes_sumario.js';
import {
  MODOS_TRABALHO,
  modoSomenteLeitura,
  obterPerfilColaborador,
  salvarPerfilColaborador,
  garantirEstruturaSugestoes,
  registrarSugestao,
  gerarHtmlMarcacaoSugestao,
  aceitarSugestaoNoDocumento,
  rejeitarSugestaoNoDocumento,
  salvarDocumentoNoSupabase,
  listarDocumentosDoSupabase,
  carregarDocumentoDoSupabase,
  SessaoColaborativaRealtime,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive,
  autenticarGoogleDrive,
  salvarArquivoNoGoogleDrive,
  listarArquivosDoGoogleDrive,
  baixarArquivoDoGoogleDrive,
  obterInfoUsuarioGoogle,
  obterOuCriarEstruturaPastasAthenes
} from '../core/athenes_colaboracao.js';
import { metodosBarraContextual } from './athenes_editor_barra_contextual.js';
import { metodosMenusTopo } from './athenes_editor_menus_topo.js';
import { metodosBlocoNaFolha } from './athenes_editor_bloco_folha.js';
import { TIPO_ROTULO, alinhamentoCss } from './athenes_editor_comum.js';

function resumoBloco(b) {
  const txt = String(b.titulo || b.texto || b.rotulo || b.latex || '').replace(/<[^>]+>/g, '').trim();
  return txt.slice(0, 42) || '—';
}

const MENUS_BLOCO = {
  figura: [
    { tipo: 'figura', acao: 'modal_figura', icone: 'figura', rotulo: 'Nova figura…', desc: 'Para que vai servir? Gráfico, figura, diagrama, esquema ou quadro — upload ou código (SVG, HTML, Mermaid, JSON)' },
    { tipo: 'figura', subtipo: 'figura', icone: 'imagem', rotulo: 'Figura', desc: 'Imagem, esquema ou ilustração numerada' },
    { tipo: 'figura', subtipo: 'grafico', icone: 'grafico', rotulo: 'Gráfico', desc: 'Barras, linhas, dispersão — numeração própria' },
    { tipo: 'figura', subtipo: 'fotografia', icone: 'fotografia', rotulo: 'Fotografia', desc: 'Registro fotográfico, com fonte e crédito' },
    { tipo: 'figura', subtipo: 'diagrama', icone: 'diagrama', rotulo: 'Diagrama', desc: 'Relações e estruturas entre elementos' },
    { tipo: 'figura', subtipo: 'fluxograma', icone: 'fluxograma', rotulo: 'Fluxograma', desc: 'Etapas e decisões de um processo' }
  ],
  tabela: [
    { tipo: 'tabela', icone: 'tabela', rotulo: 'Tabela', desc: 'Dados em linhas e colunas (ABNT/IBGE), numerada' },
    { tipo: 'quadro', icone: 'quadro', rotulo: 'Quadro', desc: 'Texto organizado em caixa fechada, numerado' },
    { tipo: 'campos', icone: 'campos', rotulo: 'Campos (rótulo e valor)', desc: 'Pares de rótulo e valor em colunas' }
  ]
};

function rotuloDoBloco(b, doc = null) {
  if (b.tipo === 'figura') return ROTULOS_FIGURA[b.subtipo] || 'Figura';
  if (b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'paragrafo' || b.tipo === 'texto') {
    if (doc && b.estiloId) {
      const est = (doc.estilos || []).find(e => e.id === b.estiloId);
      if (est) return est.nome;
    }
    return 'Texto';
  }
  return TIPO_ROTULO[b.tipo] || b.tipo;
}

const LIMITE_HISTORICO_CARACTERES = 24_000_000;

export class EditorView {
  constructor(containerEl, documento, opcoes = {}) {
    this.container = containerEl;
    this.doc = sanearDocumentoEstilos(documento); // qualquer porta de entrada (abrir, importar, template): blocos de texto só com estilo
    this.blocoSelecionado = null;
    this.secaoAtivaId = documento.secoes?.[0]?.id || null;
    this.estiloSelecionadoId = documento.estilos?.[0]?.id || 'titulo1';
    this.historico = [];
    this.historicoIndice = -1;
    this.margemElo = false;
    this.guiasVisiveis = false;
    this.arrastandoId = null;
    this.rascunhoEstilo = null;
    this.estilosAberto = false;
    this._tSnap = null;
    this._selTabelas = new Map();
    this.zoomCanvas = 1;
    this._itemFigura = null; // { id, idx }: imagem selecionada no canvas
    this._visaoRevisao = null; // leitura fiel / comparação ativa (somente leitura)

    this.opcoes = opcoes;
    this.onAlterado = opcoes.onAlterado || (() => {});
    this.onSelecionarBloco = opcoes.onSelecionarBloco || (() => {});
    this.onVoltarDashboard = opcoes.onVoltarDashboard || (() => {});
    this.onAbrirExportar = opcoes.onAbrirExportar || (() => {});
    this.onAbrirZotero = opcoes.onAbrirZotero || (() => {});
    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});
    this.onRenderizado = opcoes.onRenderizado || (() => {});
    this.onEditarEstilo = opcoes.onEditarEstilo || (() => {});
    this.onLogout = opcoes.onLogout || (() => {});
    this.menuTopoAberto = null;
    this.modoTrabalho = modoInicialDoPapel(this.doc); // 'edicao' | 'sugestao' | 'leitura' (documento compartilhado já abre no modo do papel)
    this.perfilColaborador = obterPerfilColaborador();
    this.colaboradoresOnline = [this.perfilColaborador];
    this.statusNuvem = 'Local + Supabase';

    garantirEstruturaSugestoes(this.doc);
    repaginarDocumento(this.doc);
    this.normalizarBlocosLegados();
    repaginarDocumento(this.doc);
    if (!this.blocoSelecionado) {
      const secIni = this.obterSecaoAtiva();
      this.blocoSelecionado = secIni?.blocos?.[0] || null;
    }
    this.semanticaUI = new CamadaSemanticaEditorUI(this);
    this.salvarSnapshot();
    this.renderizar();
    this.inicializarBarraContextualTexto();
    this.iniciarSessaoColaborativa();
    this.iniciarAtalhos();
  }

  iniciarSessaoColaborativa() {
    if (this.sessaoRealtime) {
      this.sessaoRealtime.encerrar();
    }
    this.sessaoRealtime = new SessaoColaborativaRealtime(this.doc, {
      perfil: this.perfilColaborador,
      onPresencaAlterada: (lista) => {
        this.colaboradoresOnline = lista;
        this.atualizarAvataresPresenca();
        this.pintarCursoresRemotosNaFolha();
      },
      onCursorRemoto: () => {
        this.pintarCursoresRemotosNaFolha();
      },
      onBlocoRemotoAlterado: (blocoRemoto, sugestoesRemotas) => {
        const alvo = this.buscarBlocoPorId(blocoRemoto.id);
        if (alvo) {
          Object.assign(alvo, blocoRemoto);
        }
        if (Array.isArray(sugestoesRemotas)) {
          this.doc.sugestoes = sugestoesRemotas;
        }
        this.renderizarFolhasPaginas();
      },
      onDocumentoRemotoAlterado: (docSnap) => {
        this.doc = docSnap;
        repaginarDocumento(this.doc);
        this.renderizar();
      }
    });
    this.sessaoRealtime.iniciar();
  }

  atualizarAvataresPresenca() {
    const box = this.container?.querySelector('#athAvataresPresenca');
    if (!box) return;
    const lista = this.colaboradoresOnline || [this.perfilColaborador];
    box.innerHTML = lista.map(col => {
      const iniciais = String(col.nome || 'U')
        .split(/\s+/)
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const papelRot = col.papel === 'orientador' ? 'Orientador / Professor' : col.papel === 'revisor' ? 'Revisor' : 'Autor';
      return `<span class="ath-avatar-bolinha" style="background:${col.cor || '#314F79'};" title="${col.nome} (${papelRot}) — Online agora">${iniciais}</span>`;
    }).join('');
  }

  pintarCursoresRemotosNaFolha() {
    if (!this.container) return;
    this.container.querySelectorAll('.ath-cursor-remoto-badge').forEach(n => n.remove());
    const remotos = (this.colaboradoresOnline || []).filter(c => c.id !== this.perfilColaborador.id && c.blocoId);
    for (const r of remotos) {
      const elBloco = this.container.querySelector(`.ath-bloco-folha[data-bloco-id="${r.blocoId}"]`);
      if (elBloco) {
        elBloco.style.outline = `2px dashed ${r.cor || '#10B981'}`;
        const badge = document.createElement('span');
        badge.className = 'ath-cursor-remoto-badge';
        badge.style.background = r.cor || '#10B981';
        badge.textContent = r.nome;
        elBloco.appendChild(badge);
      }
    }
  }

  normalizarBlocosLegados() {
    for (const sec of this.doc.secoes || []) {
      for (const b of sec.blocos || []) {
        if (!b.span || (b.span === 1 && (b.col || 1) === 1)) { b.col = 1; b.span = 12; }
      }
    }
  }

  /**
   * Rola SÓ o palco das folhas até o elemento. `scrollIntoView` também rola os ancestrais (inclusive os
   * com overflow:hidden), o que empurrava o app inteiro para cima e cortava o cabeçalho e a folha.
   */
  rolarNoPalco(el, bloco = 'nearest', suave = true) {
    const palco = this.container?.querySelector('#rmPrevPalco');
    if (!palco || !el) return;
    const p = palco.getBoundingClientRect(); const r = el.getBoundingClientRect();
    let delta = 0;
    if (bloco === 'start') delta = r.top - p.top - 16;
    else if (bloco === 'center') delta = r.top - p.top - (p.height - r.height) / 2;
    else if (r.top < p.top) delta = r.top - p.top - 12;
    else if (r.bottom > p.bottom) delta = r.bottom - p.bottom + 12;
    if (Math.abs(delta) > 1) palco.scrollBy({ top: delta, behavior: suave ? 'smooth' : 'auto' });
  }

  /** Tabela dividida: a continuação mostra "Tabela 1 (continuação)" em vez do título editável. */
  ajustarLegendaDeContinuacao(tit, b) {
    if (!b._frag?.continuaDaAnterior) return;
    const rot = obterPrefixoNumeracao(b).trimEnd().replace(/[-—–:.]+$/, '').trimEnd();
    tit.contentEditable = 'false';
    tit.innerHTML = `<span class="ath-tab-continuacao" style="font-weight:800;color:var(--ath-primary,#314F79);">${rot} (continuação)</span>`;
  }

  anexarRotuloContinua(caixa, b) {
    if (!b._frag?.continuaNaProxima) return;
    const r = document.createElement('div');
    r.className = 'ath-tab-continua'; r.contentEditable = 'false';
    r.style.cssText = 'text-align:right;font:italic 600 11px var(--glx-font,inherit);color:#64748B;margin-top:3px;user-select:none;';
    r.textContent = 'Continua';
    caixa.appendChild(r);
  }

  /** HTML do sumário vivo de um bloco: itens atuais do documento, links que rolam até o título. */
  htmlSumario(b) {
    const cfg = configEfetivaSumario(this.doc, b);
    const itens = extrairItensSumario(this.doc, { profundidade: cfg.profundidade_max, mapa: this.mapaNumSecoes });
    const tit = (this.doc.estilos || []).find(e => e.id === 'titulo1');
    return sumarioHtml(itens, cfg, { href: (id) => `#ath-b-${id}`, estiloTitulo: tit ? `${estiloParaCss(tit)};` : '' });
  }

  montarSumarioVivo(b, cssEstilo) {
    const box = document.createElement('div');
    box.className = 'ath-sumario-vivo';
    box.dataset.sumarioBloco = b.id;
    box.contentEditable = 'false';
    box.style.cssText = `${cssEstilo}; user-select:none;`;
    box.innerHTML = this.htmlSumario(b);
    box.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-sumario-alvo]');
      if (!a) return;
      ev.preventDefault(); ev.stopPropagation();
      this.irParaBloco(a.dataset.sumarioAlvo);
    });
    return box;
  }

  /** Rola até o bloco (modo edição ou leitura) e o destaca por um instante. */
  irParaBloco(id) {
    const alvo = this.container.querySelector(`.ath-bloco-folha[data-bloco-id="${id}"]`);
    if (!alvo) return;
    this.rolarNoPalco(alvo, 'center');
    alvo.classList.add('ath-bloco-destaque-salto');
    setTimeout(() => alvo.classList.remove('ath-bloco-destaque-salto'), 1400);
    const bloco = this.buscarBlocoPorId(id);
    if (bloco && this.blocoSelecionado?.id !== id) { this.blocoSelecionado = bloco; this.onSelecionarBloco?.(bloco, null); }
  }

  /** Atualiza os sumários já desenhados (texto e números dos títulos) sem redesenhar a folha. */
  atualizarSumariosAoVivo() {
    clearTimeout(this._tSumario);
    this._tSumario = setTimeout(() => {
      this.mapaNumSecoes = calcularNumeracaoSecoes(this.doc);
    this.mapaMarc = mapaMarcadores(this.doc);
      this.container.querySelectorAll('.ath-sumario-vivo').forEach(box => {
        const b = this.buscarBlocoPorId(box.dataset.sumarioBloco);
        if (b) box.innerHTML = this.htmlSumario(b);
      });
    }, 350);
  }

  /** Liga (uma vez) o subsistema de atalhos de teclado deste editor. */
  iniciarAtalhos() {
    if (this.atalhos) return;
    this.atalhos = new AtalhosDoEditor(this);
  }

  desmontarAtalhos() {
    this.atalhos?.destruir();
    this.atalhos = null;
  }

  /** O papel do usuário neste documento permite este modo de trabalho? (compartilhado como leitura/comentário não edita) */
  modoPermitido(modo) {
    return modosPermitidos(this.doc).includes(modo);
  }

  setDocumento(doc) {
    this.doc = doc;
    repaginarDocumento(this.doc);
    this.salvarSnapshot();
    this.renderizar();
  }

  salvarSnapshot() {
    podarNotasOrfas(this.doc);
    const snap = JSON.stringify(this.doc);
    this._edicaoNativa = false; // edição consolidada: o próximo Ctrl+Z volta um estado do documento
    if (this.historicoIndice >= 0 && this.historico[this.historicoIndice] === snap) return;

    this.historico = this.historico.slice(0, this.historicoIndice + 1);
    this.historico.push(snap);
    // no máximo 50 estados E ~24 M caracteres no total: com imagens embutidas cada estado passa de 2 MB e 50 cópias ocupavam >100 MB
    let total = this.historico.reduce((n, x) => n + x.length, 0);
    while (this.historico.length > 2 && (this.historico.length > 50 || total > LIMITE_HISTORICO_CARACTERES)) total -= this.historico.shift().length;
    this.historicoIndice = this.historico.length - 1;
  }

  desfazer() {
    if (modoSomenteLeitura(this.modoTrabalho)) return;
    if (this.historicoIndice > 0) {
      this.historicoIndice--;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
      this.blocoSelecionado = null;
      this.rascunhoEstilo = null;
      repaginarDocumento(this.doc);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  refazer() {
    if (modoSomenteLeitura(this.modoTrabalho)) return;
    if (this.historicoIndice < this.historico.length - 1) {
      this.historicoIndice++;
      this.doc = JSON.parse(this.historico[this.historicoIndice]);
      this.blocoSelecionado = null;
      this.rascunhoEstilo = null;
      repaginarDocumento(this.doc);
      this.renderizar();
      this.onAlterado(this.doc);
    }
  }

  obterSecaoAtiva() {
    return this.doc.secoes?.find(s => s.id === this.secaoAtivaId) || this.doc.secoes?.[0];
  }

  obterMestraAtiva() {
    const sec = this.obterSecaoAtiva();
    const mestraId = sec?.mestraId || 'corpo';
    return (this.doc.mestras || []).find(m => m.id === mestraId) || this.doc.mestras?.[0];
  }

  /** Popover de override de um elemento da mestra nesta página (não altera as demais páginas). */
  abrirOverrideMestra(pag, mestra, base, ev) {
    document.querySelector('.ath-override-mestra')?.remove();
    const efetivo = elementosEfetivosDaPagina(mestra, pag).find(e => e.id === base.id) || base;
    const pop = document.createElement('div');
    pop.className = 'ath-override-mestra';
    pop.style.cssText = `position:fixed;z-index:99999;left:${Math.min(ev.clientX, innerWidth - 270)}px;top:${Math.min(ev.clientY, innerHeight - 290)}px;width:250px;padding:12px;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,.2);font:600 12px var(--glx-font,system-ui);display:flex;flex-direction:column;gap:8px`;
    const campo = (k, rot) => `<label style="display:flex;flex-direction:column;gap:2px;font-size:10px;color:#64748B">${rot}<input type="number" step="0.5" data-k="${k}" value="${efetivo[k] ?? 0}" style="height:26px;border:1px solid #D5DEE9;border-radius:7px;padding:0 6px"></label>`;
    pop.innerHTML = `<div style="font-weight:800;color:#314F79">${(base.titulo || base.tipo).replace(/</g, '&lt;')} — só nesta página</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${campo('x_mm', 'X (mm)')}${campo('y_mm', 'Y (mm)')}${campo('largura_mm', 'Largura')}${campo('altura_mm', 'Altura')}${campo('rotacao_graus', 'Rotação (°)')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-a="ocultar" class="glx-btn glx-btn-soft glx-btn-sm">Ocultar aqui</button><button type="button" data-a="restaurar" class="glx-btn glx-btn-soft glx-btn-sm">Restaurar herança</button><button type="button" data-a="fechar" class="glx-btn glx-btn-primary glx-btn-sm">OK</button></div>`;
    document.body.appendChild(pop);
    const aplicar = (m) => { sobrescreverNoDocumento(this.doc, pag, base, m); this.notificarMudanca(); this.renderizarFolhasPaginas(); };
    pop.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k) aplicar({ [k]: parseFloat(e.target.value) || 0 }); });
    pop.addEventListener('click', (e) => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'ocultar') aplicar({ oculto: true });
      if (a === 'restaurar') { restaurarNoDocumento(this.doc, pag, base.id); this.notificarMudanca(); this.renderizarFolhasPaginas(); }
      pop.remove();
    });
    setTimeout(() => document.addEventListener('mousedown', function f(e2) { if (!pop.contains(e2.target)) { pop.remove(); document.removeEventListener('mousedown', f); } }), 0);
  }

  renderizar() {
    if (!this.container) return;
    const rolagem = {
      palco: this.container.querySelector('#rmPrevPalco')?.scrollTop || 0,
      palcoLeft: this.container.querySelector('#rmPrevPalco')?.scrollLeft || 0,
      esq: this.container.querySelector('#rmColEsq')?.scrollTop || 0,
      cardsEsq: Array.from(this.container.querySelectorAll('#rmColEsq .rm-card-meio-a-meio-corpo')).map(el => el.scrollTop),
      dir: this.container.querySelector('#athInspectorContainer')?.scrollTop || 0,
      props: this.container.querySelector('#athInspectorContainer .rm-props')?.scrollTop || 0
    };
    this._visaoRevisao?.destruir();
    this._visaoRevisao = null;
    fecharCardSugestao();
    fecharEditorNota();
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'rm-conteudo';

    // 1. Topo Shell (Marca, Título do Documento e Botões Globais)
    const rotuloModo = { [MODOS_TRABALHO.EDICAO]: ['lapis', 'Edição'], [MODOS_TRABALHO.SUGESTAO]: ['sugestao', 'Sugestão'], [MODOS_TRABALHO.COMPARAR]: ['grade', 'Comparar'], [MODOS_TRABALHO.VISUALIZACAO]: ['olho', 'Leitura'] }[this.modoTrabalho] || ['lapis', 'Edição'];
    const MODO_ATUAL_ICONE = svgIcone(rotuloModo[0], 14);
    const MODO_ATUAL_ROTULO = rotuloModo[1];
    const MODOS_ITENS = `<button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.EDICAO ? 'on' : ''}" data-modo="edicao" ${this.modoPermitido('edicao') ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'} title="Modo Edição: edita o documento diretamente">
            ${svgIcone('lapis', 13)} <span>Edição</span>
          </button>
          <button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.SUGESTAO ? 'on' : ''}" data-modo="sugestao" ${this.modoPermitido('sugestao') ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'} title="Modo Sugestão: alterações ficam marcadas para Aceitar (✓) ou Rejeitar (✗)">
            ${svgIcone('sugestao', 13)} <span>Sugestão</span>
            ${(this.doc.sugestoes?.length > 0) ? `<span style="background:#FFFFFF; color:#059669; border-radius:999px; padding:0 5px; font-size:10px; font-weight:800;">${this.doc.sugestoes.length}</span>` : ''}
          </button>
          <button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.COMPARAR ? 'on' : ''}" data-modo="comparar" ${this.modoPermitido('comparar') ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'} title="Comparar lado a lado: original × proposta, com diff e rolagem sincronizada">
            ${svgIcone('grade', 13)} <span>Comparar</span>
          </button>
          <button type="button" class="ath-btn-modo-trab ${this.modoTrabalho === MODOS_TRABALHO.VISUALIZACAO ? 'on' : ''}" data-modo="leitura" ${this.modoPermitido('leitura') ? '' : 'disabled style="opacity:.4; cursor:not-allowed;"'} title="Leitura fiel: réplica exata da exportação/impressão, somente leitura">
            ${svgIcone('olho', 13)} <span>Leitura</span>
          </button>`;
    const topoShell = document.createElement('header');
    topoShell.className = 'ath-topo-shell' + (modoSomenteLeitura(this.modoTrabalho) ? ' ath-modo-revisao' : '');
    topoShell.innerHTML = `
      <div class="ath-topo-esq">
        <button type="button" class="ath-marca-link" id="athBrandVoltar" title="Voltar para a Visão Geral" style="background:none; border:none; padding:0; font:inherit; cursor:pointer;">
          ${svgLogo(26)}
          <span>ATHENES</span>
        </button>
        <input type="text" class="ath-doc-titulo-topo" id="athInputTituloDoc" value="${this.doc.titulo || 'Sem título'}" title="Clique para renomear">
        <span class="rm-selo">${(this.doc.perfil || 'abnt').toUpperCase()}</span>
      </div>
      <div class="ath-topo-dir">
        <!-- Presença em Tempo Real (Avatares Online) -->
        <div class="ath-presenca-avatares" id="athAvataresPresenca" title="Colaboradores online neste documento"></div>

        <div class="rm-prev-menus-topo" id="rmPrevMenusTopo">
          <div class="rm-menu-topo-item" data-menu="arquivo">
            <button type="button" class="rm-btn-menu-topo" id="athBtnMenuArquivo" aria-haspopup="dialog" aria-expanded="false" title="Configurar propriedades do arquivo, formato e margens">
              ${svgIcone('documento', 14)}
              <span>Arquivo & Margens</span>
              <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="rm-topo-popover" id="athPopoverArquivo" role="dialog" aria-label="Arquivo e Margens" hidden></div>
          </div>

          <div class="rm-menu-topo-item" data-menu="cabrod">
            <button type="button" class="rm-btn-menu-topo" id="athBtnMenuCabRod" aria-haspopup="dialog" title="Cabeçalho, rodapé, numeração de páginas e notas de rodapé">
              ${svgIcone('subtitulo', 14)}
              <span>Configuração de Página</span>
            </button>
          </div>

          <div class="rm-menu-topo-item" data-menu="estilos">
            <button type="button" class="rm-btn-menu-topo" id="athBtnMenuEstilos" aria-haspopup="dialog" aria-expanded="false" title="Estilos tipográficos do documento">
              ${svgIcone('paragrafo', 14)}
              <span>Estilos de Texto</span>
              <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="rm-topo-popover rm-topo-popover-estilos" id="athPopoverEstilos" role="dialog" aria-label="Estilos de Texto" hidden></div>
          </div>

          <div class="rm-menu-topo-item ath-menu-semantica" data-menu="semantica">
            <button type="button" class="rm-btn-menu-topo ath-btn-semantica-topo" id="athBtnMenuSemantica" aria-haspopup="dialog" aria-expanded="false" title="Estrutura Científica & Movimentos Retóricos (Alt+Shift+S)">
              ${svgIcone('olho', 14)}
              <span>Estrutura do Artigo</span>
              <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="rm-topo-popover ath-popover-semantica" id="athPopoverSemantica" role="dialog" aria-label="Estrutura Científica" hidden></div>
          </div>

          <div class="rm-menu-topo-item" data-menu="config">
            <button type="button" class="rm-btn-menu-topo" id="athBtnMenuConfig" aria-haspopup="menu" aria-expanded="false" aria-label="Configurações" title="Configurações: tema e estilos, nuvem e Drive">
              ${svgIcone('config', 15)}
              <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="rm-topo-popover rm-topo-config" id="athPopoverConfig" role="menu" aria-label="Configurações" hidden>
              <button type="button" class="rm-config-item" role="menuitem" data-cfg="tema">
                ${svgIcone('paleta', 16)}
                <span><strong>Tema & Estilos</strong><small>Importar, exportar ou gerar com IA</small></span>
              </button>
              <button type="button" class="rm-config-item" role="menuitem" data-cfg="nuvem">
                ${svgIcone('nuvem_ok', 16)}
                <span><strong>Nuvem & Drive</strong><small>Supabase, Google Drive e revisões</small></span>
              </button>
            </div>
            <div class="rm-topo-popover" id="athPopoverNuvem" role="dialog" aria-label="Nuvem, Google Drive e Revisões" hidden style="width:360px;"></div>
          </div>
        </div>

        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnAbaZotero">
          ${svgIcone('zotero', 15)} <span>Zotero</span>
        </button>
        <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnExportarModal">
          ${svgIcone('exportar', 14)} <span>Exportar</span>
        </button>
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnGuiaAtalhos" title="Ver atalhos de teclado (Ctrl+/)" aria-label="Ver atalhos de teclado">?</button>
      </div>
    `;
    root.appendChild(topoShell);

    // 2. Editor Principal Glaux (Grade de 3 Colunas: 310px | 1fr | 330px)
    const editorEl = document.createElement('div');
    editorEl.className = 'rm-editor rm-main' + (modoSomenteLeitura(this.modoTrabalho) ? ' ath-modo-revisao' : '');
    editorEl.innerHTML = `
      <div class="rm-ed-grade">
        <!-- COLUNA ESQUERDA: Configuração, Margens, Seções, Cabeçalho/Rodapé, Estilos e Blocos -->
        <aside class="rm-col rm-col-esq" id="rmColEsq"></aside>

        <!-- COLUNA CENTRAL: Prévia da Folha A4 com Barra de Blocos Flutuante e Edição Direta -->
        <section class="rm-col rm-col-prev" id="rmColPrev">
          <div class="rm-barra-blocos ath-barra-uma-linha" id="rmBarraBlocos">
            <button type="button" class="rm-ic-bt" id="rmVoltar" title="Voltar para a Visão Geral" aria-label="Voltar">
              ${svgIcone('voltar', 16)}
            </button>
            <button type="button" class="rm-ic-bt rm-ic-primario" id="rmSalvar" title="Salvar alterações" aria-label="Salvar">
              ${svgIcone('salvar', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>
            <button type="button" class="rm-ic-bt" id="rmDesfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
              ${svgIcone('desfazer', 16)}
            </button>
            <button type="button" class="rm-ic-bt" id="rmRefazer" title="Refazer (Ctrl+Y)" aria-label="Refazer">
              ${svgIcone('refazer', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Estilo de texto em uso (clique para escolher outro) -->
            <div class="ath-caixa-estilo" id="athCaixaEstilo">
              <button type="button" class="ath-caixa-estilo-btn" id="athBtnCaixaEstilo" aria-haspopup="listbox" aria-expanded="false" title="Estilo de texto em uso: clique para escolher outro">
                <span id="athRotuloCaixaEstilo">Corpo de Texto</span>
                <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true"><path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div class="ath-caixa-estilo-menu" id="athMenuCaixaEstilo" role="listbox" hidden></div>
            </div>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Botões de Inserção de Blocos: faixa única com rolagem horizontal (arrastar), sem barra visível -->
            <div class="ath-barra-rolagem" id="athBarraRolagem">
            <button type="button" class="rm-ic-bt" id="rmAddTitulo" data-tip="Título" title="Inserir Título">${svgIcone('titulo', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddTexto" data-tip="Texto" title="Inserir Parágrafo">${svgIcone('paragrafo', 16)}</button>
            <div class="rm-grupo-bt" data-grupo="figura">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddFigura" data-tip="Figura" title="Figura, gráfico, fotografia, diagrama…" aria-haspopup="menu" aria-expanded="false">
                ${svgIcone('imagem', 15)}
                <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="5.5" height="3.5" aria-hidden="true">
                  <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
            <div class="rm-grupo-bt" data-grupo="tabela">
              <button type="button" class="rm-ic-bt tem-menu" id="rmAddTabela" data-tip="Tabela" title="Tabela, quadro ou campos (rótulo e valor)" aria-haspopup="menu" aria-expanded="false">
                ${svgIcone('tabela', 15)}
                <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="5.5" height="3.5" aria-hidden="true">
                  <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="rm-menu-bloco" role="menu" hidden></div>
            </div>
            <button type="button" class="rm-ic-bt" id="rmAddFormula" data-tip="Fórmula" title="Inserir Fórmula Matemática">${svgIcone('formula', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddNota" data-tip="Nota" title="Inserir nota de rodapé (Ctrl+Alt+F)">${svgIcone('nota', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddDivisor" data-tip="Divisor" title="Inserir Divisor">${svgIcone('divisor', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddEspaco" data-tip="Espaço" title="Inserir Espaçamento">${svgIcone('espacamento', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddSumario" data-tip="Sumário" title="Inserir Sumário automático (títulos em todos os níveis)">${svgIcone('sumario', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddReferencias" data-tip="Bibliografia" title="Inserir a lista de referências (gerada sozinha com as obras citadas pelo Zotero)">${svgIcone('referencias', 16)}</button>
            <button type="button" class="rm-ic-bt" id="rmAddQuebra" data-tip="Quebra" title="Inserir Quebra de Página">${svgIcone('quebra_pagina', 16)}</button>
            </div>

            <!-- Controles de Zoom para Tablet e Telas Touch -->
            <div class="ath-zoom-controles-barra" style="display:flex; align-items:center; gap:2px; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:999px; padding:2px 4px; margin-left:6px;" title="Zoom das folhas">
              <button type="button" class="rm-ic-bt" id="athBtnZoomMenosEditor" title="Diminuir Zoom" aria-label="Diminuir Zoom" style="width:26px; height:26px; font-weight:800; font-size:14px; border:none; background:transparent; cursor:pointer;">−</button>
              <button type="button" id="athBtnZoomIndicadorBarraEditor" title="Clique para alternar escala (100% · 125% · 150% · 80%)" style="border:none; background:transparent; font:800 11.5px var(--glx-font, inherit); color:#314F79; padding:0 5px; cursor:pointer; min-width:40px; text-align:center;">100%</button>
              <button type="button" class="rm-ic-bt" id="athBtnZoomMaisEditor" title="Aumentar Zoom" aria-label="Aumentar Zoom" style="width:26px; height:26px; font-weight:800; font-size:14px; border:none; background:transparent; cursor:pointer;">+</button>
            </div>

            <!-- Modo de trabalho (como no Docs): Edição / Sugestão / Comparar / Leitura -->
            <div class="ath-modo-wrap" id="athModoWrap">
              <button type="button" class="ath-modo-atual" id="athBtnModoAtual" aria-haspopup="menu" aria-expanded="false" title="Modo de trabalho">
                ${MODO_ATUAL_ICONE} <span>${MODO_ATUAL_ROTULO}</span>
                <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true"><path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div class="ath-modo-menu" id="athModoMenu" role="menu" hidden>
                ${MODOS_ITENS}
              </div>
            </div>

            <button type="button" class="rm-ic-bt ${reguasVisiveis() ? 'on' : ''}" id="rmRegua" aria-pressed="${reguasVisiveis()}" title="Mostrar ou ocultar as réguas (milímetros, com as margens da página)">
              ${svgIcone('reguas', 18)}
            </button>

            <!-- Botão de Grade à Direita -->
            <button type="button" class="rm-ic-bt rm-ic-guia ${this.guiasVisiveis ? 'on' : ''}" id="rmGuia" aria-pressed="${this.guiasVisiveis}" title="Alternar visualização da grade de 12 colunas">
              ${svgIcone('guia_grade', 18)}
            </button>
          </div>

          <!-- Palco de Páginas Reais -->
          <div class="ath-palco-reguas ${reguasVisiveis() ? '' : 'sem-reguas'}" id="athPalcoReguas">
            <canvas class="ath-regua-h" aria-hidden="true"></canvas><canvas class="ath-regua-v" aria-hidden="true"></canvas><div class="ath-regua-canto" aria-hidden="true"></div>
            <div class="rm-prev rm-prev-palco" id="rmPrevPalco"></div>
          <div id="athIndicadorPincelAtivo" class="ath-indicador-pincel" style="display:none;"></div>
          </div>
          <button type="button" class="ath-zoom-indicador" id="athZoomIndicador" title="Ctrl + roda do mouse para zoom · clique para 100%">100%</button>
        </section>

        <!-- COLUNA DIREITA: Inspetor de Propriedades e Edição Composta -->
        <aside class="rm-col rm-col-dir" id="athInspectorContainer"></aside>
      </div>
    `;

    root.appendChild(editorEl);
    this.container.appendChild(root);
    tornarColunasRedimensionaveis(editorEl.querySelector('.rm-ed-grade'), { nome: 'editor', padraoEsq: 310, padraoDir: 330 }); // barras laterais: recolher e ajustar a largura

    // Liga eventos dos botões de topo e barra
    this.ligarEventosGerais(root);

    // Monta menus suspensos de topo (Arquivo, Cabeçalho/Rodapé, Estilos)
    this.montarMenusTopo(root);

    // Renderiza Coluna Esquerda
    this.renderizarColunaEsquerda(root.querySelector('#rmColEsq'));

    // Renderiza Folhas no Palco Central
    this.renderizarFolhasPaginas();

    // Atualiza diagrama de margens e avatares de presença
    this.pintarDiagramaMargens();
    this.atualizarAvataresPresenca();
    this.pintarCursoresRemotosNaFolha();

    const palcoNovo = root.querySelector('#rmPrevPalco');
    this._reguasDoc?.destruir?.();
    this._reguasDoc = ligarReguasDoDocumento(root.querySelector('#athPalcoReguas'), palcoNovo);
    root.querySelector('#rmRegua')?.addEventListener('click', (e) => {
      const caixa = root.querySelector('#athPalcoReguas'); const mostrar = caixa.classList.contains('sem-reguas');
      caixa.classList.toggle('sem-reguas', !mostrar);
      e.currentTarget.classList.toggle('on', mostrar); e.currentTarget.setAttribute('aria-pressed', String(mostrar));
      try { localStorage.setItem('athenes_reguas_visiveis', mostrar ? '1' : '0'); } catch (_) {}
      this._reguasDoc?.atualizar();
    });
    if (palcoNovo) {
      // clicar fora de qualquer bloco (fundo do palco, margem ou espaço vazio da folha) tira a seleção do bloco e do texto
      palcoNovo.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0 || modoSomenteLeitura(this.modoTrabalho) || !this.blocoSelecionado) return;
        if (ev.target.closest('.ath-bloco-folha, .ath-barra-contextual, .ath-pill-cursor-acoes, .ath-popover, [contenteditable="true"], button, input, select, textarea, a, .ath-pg-area, .ath-nota')) return;
        this.limparSelecaoDeBloco();
      });
      const ind = root.querySelector('#athZoomIndicador');
      const indBarra = root.querySelector('#athBtnZoomIndicadorBarraEditor');
      const definir = (z) => {
        this.zoomCanvas = z;
        const txt = `${Math.round(z * 100)}%`;
        if (ind) ind.textContent = txt;
        if (indBarra) indBarra.textContent = txt;
        const folhas = palcoNovo.querySelectorAll('.ath-folha-a4');
        folhas.forEach(f => {
          f.style.zoom = String(z);
          f.style.transformOrigin = 'top center';
        });
      };

      const aplicarNovoZoom = (novoZ) => {
        const lim = Math.max(0.4, Math.min(3, Math.round(novoZ * 100) / 100));
        palcoNovo.style.setProperty('--ath-zoom', String(lim));
        definir(lim);
      };

      root.querySelector('#athBtnZoomMenosEditor')?.addEventListener('click', () => {
        aplicarNovoZoom((this.zoomCanvas || 1) - 0.15);
      });
      root.querySelector('#athBtnZoomMaisEditor')?.addEventListener('click', () => {
        aplicarNovoZoom((this.zoomCanvas || 1) + 0.15);
      });
      root.querySelector('#athBtnZoomIndicadorBarraEditor')?.addEventListener('click', () => {
        const escalas = [1, 1.25, 1.5, 0.8];
        const zAtual = this.zoomCanvas || 1;
        const prox = escalas.find(z => z > zAtual + 0.05) || escalas[0];
        aplicarNovoZoom(prox);
      });
      instalarZoomCanvas(palcoNovo, { obter: () => this.zoomCanvas, definir });
      ind?.addEventListener('click', () => {
        const escalas = [1, 1.25, 1.5, 0.8];
        const zAtual = this.zoomCanvas || 1;
        const prox = escalas.find(z => z > zAtual + 0.05) || escalas[0];
        palcoNovo.style.setProperty('--ath-zoom', String(prox));
        definir(prox);
      });
    }
    const esqNovo = root.querySelector('#rmColEsq');
    if (palcoNovo) {
      palcoNovo.scrollTop = rolagem.palco;
      palcoNovo.scrollLeft = rolagem.palcoLeft;
    }
    if (esqNovo) {
      esqNovo.scrollTop = rolagem.esq;
      const novosCardsEsq = esqNovo.querySelectorAll('.rm-card-meio-a-meio-corpo');
      rolagem.cardsEsq.forEach((st, idx) => {
        if (novosCardsEsq[idx]) novosCardsEsq[idx].scrollTop = st;
      });
    }
    const dirNovo = root.querySelector('#athInspectorContainer');
    this.onRenderizado(dirNovo);
    if (dirNovo) {
      if (rolagem.dir > 0) dirNovo.scrollTop = rolagem.dir;
      const propsNovo = dirNovo.querySelector('.rm-props');
      if (propsNovo && rolagem.props > 0) propsNovo.scrollTop = rolagem.props;
    }
  }

  ligarEventosGerais(root) {
    root.querySelector('#athBrandVoltar').addEventListener('click', () => this.onVoltarDashboard());
    root.querySelector('#rmVoltar').addEventListener('click', () => this.onVoltarDashboard());
    root.querySelector('#rmSalvar').addEventListener('click', () => {
      this.salvarSnapshot();
      this.onAlterado(this.doc);
      const btn = root.querySelector('#rmSalvar');
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => { btn.style.transform = ''; }, 120);
    });

    const inputTitulo = root.querySelector('#athInputTituloDoc');
    inputTitulo.addEventListener('change', () => {
      this.doc.titulo = inputTitulo.value.trim() || 'Sem título';
      this.notificarMudanca();
    });

    root.querySelector('#rmDesfazer').addEventListener('click', () => this.desfazer());
    root.querySelector('#rmRefazer').addEventListener('click', () => this.refazer());

    root.querySelector('#athBtnAbaZotero').addEventListener('click', () => this.onAbrirZotero());
    root.querySelector('#athBtnExportarModal').addEventListener('click', () => this.onAbrirExportar());
    root.querySelector('#athBtnGuiaAtalhos').addEventListener('click', () => this.atalhos?.abrirAjuda());

    // Card de decisão: clique em uma marca de sugestão (ou cursor posicionado sobre ela) abre Aceitar/Rejeitar
    const abrirCardDaMarca = (marca) => abrirCardSugestao({
      doc: this.doc,
      sugestaoId: marca.dataset.sugestaoId,
      ancora: marca,
      aoResolver: () => { this.notificarMudanca(); this.renderizar(); }
    });
    root.addEventListener('click', (ev) => {
      if (modoSomenteLeitura(this.modoTrabalho)) return;
      const marca = ev.target.closest?.(SEL_MARCA);
      if (marca) abrirCardDaMarca(marca);
    }, true); // captura: os blocos da folha interrompem a propagação do clique
    root.addEventListener('keyup', (ev) => {
      if (modoSomenteLeitura(this.modoTrabalho)) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key)) return;
      const no = window.getSelection()?.anchorNode;
      const marca = (no?.nodeType === 1 ? no : no?.parentElement)?.closest?.(SEL_MARCA);
      if (marca && root.contains(marca)) abrirCardDaMarca(marca);
    }, true);

    // Seletor de Modos de Trabalho (Edição / Sugestão / Comparar / Leitura fiel)
    root.querySelectorAll('.ath-btn-modo-trab').forEach(btn => {
      btn.addEventListener('click', () => {
        const novoModo = btn.dataset.modo;
        if (!novoModo || this.modoTrabalho === novoModo || !this.modoPermitido(novoModo)) return;
        this.modoTrabalho = novoModo;
        this.renderizar();
      });
    });

    // Menu do modo de trabalho (na barra de ferramentas, como no Docs)
    const btnModo = root.querySelector('#athBtnModoAtual');
    const menuModo = root.querySelector('#athModoMenu');
    btnModo?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      menuModo.hidden = !menuModo.hidden;
      btnModo.setAttribute('aria-expanded', String(!menuModo.hidden));
    });
    document.addEventListener('click', (ev) => { if (menuModo && !menuModo.hidden && !ev.target.closest?.('#athModoWrap')) { menuModo.hidden = true; btnModo?.setAttribute('aria-expanded', 'false'); } });

    // Caixa do estilo de texto em uso: mostra o estilo do bloco/trecho e abre a lista para trocar
    const caixaBtn = root.querySelector('#athBtnCaixaEstilo');
    const caixaMenu = root.querySelector('#athMenuCaixaEstilo');
    const caixaRotulo = root.querySelector('#athRotuloCaixaEstilo');
    const estiloEmUso = () => {
      const sel = window.getSelection?.();
      const no = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
      const el = no ? (no.nodeType === 1 ? no : no.parentElement) : null;
      const spanId = el?.closest?.('.ath-estilo-span')?.dataset.estiloId;
      const dentro = el && this.container?.contains(el);
      const blocoId = dentro ? el.closest?.('[data-bloco-id]')?.dataset.blocoId : null;
      const dono = (blocoId && this.buscarBlocoPorId((this.doc.paginas || []).flatMap(p => p.blocos || []).find(x => x.id === blocoId)?._frag?.origemId || blocoId)) || this.blocoSelecionado;
      if (spanId) return (this.doc.estilos || []).find(e => e.id === spanId) || null;
      return dono ? (this.estiloDoBloco(dono) || null) : null;
    };
    const atualizarCaixaEstilo = () => {
      if (!caixaRotulo) return;
      const e = estiloEmUso();
      caixaRotulo.textContent = e?.nome || 'Sem estilo';
      caixaBtn.classList.toggle('vazio', !e);
    };
    this._atualizarCaixaEstilo = atualizarCaixaEstilo;
    const fecharCaixa = () => { if (caixaMenu) { caixaMenu.hidden = true; caixaBtn?.setAttribute('aria-expanded', 'false'); } };
    // mousedown sem tirar a seleção do texto: o estilo vai para o trecho selecionado (ou o bloco, sem seleção)
    caixaBtn?.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!caixaMenu.hidden) { fecharCaixa(); return; }
      const atual = estiloEmUso();
      caixaMenu.innerHTML = (this.doc.estilos || []).map(e => `
        <button type="button" class="ath-caixa-estilo-item ${atual?.id === e.id ? 'on' : ''}" role="option" data-estilo-id="${e.id}">
          <span style="font-weight:${e.peso || 400};">${escapeHtml(e.nome)}</span><small>${e.tamanho_pt || 12}pt</small>
        </button>`).join('');
      caixaMenu.hidden = false;
      caixaBtn.setAttribute('aria-expanded', 'true');
      caixaMenu.querySelectorAll('[data-estilo-id]').forEach(it => it.addEventListener('mousedown', (e2) => {
        e2.preventDefault();
        e2.stopPropagation();
        fecharCaixa();
        this.aplicarEstiloNoTextoSelecionado(it.dataset.estiloId);
        setTimeout(atualizarCaixaEstilo, 30);
      }));
    });
    document.addEventListener('mousedown', (ev) => { if (caixaMenu && !caixaMenu.hidden && !ev.target.closest?.('#athCaixaEstilo')) fecharCaixa(); });
    let tCaixa = 0;
    document.addEventListener('selectionchange', () => { clearTimeout(tCaixa); tCaixa = setTimeout(atualizarCaixaEstilo, 60); });
    root.addEventListener('click', () => setTimeout(atualizarCaixaEstilo, 60));
    setTimeout(atualizarCaixaEstilo, 0);

    // Botões de inserção de blocos
    const adicionar = (tipo, dados = {}) => {
      if (modoSomenteLeitura(this.modoTrabalho)) {
        alert('O documento está em um modo somente leitura (Leitura ou Comparar). Mude para Edição ou Sugestão no topo para inserir blocos.');
        return;
      }
      const sec = this.obterSecaoAtiva();
      if (!sec) return;
      const b = criarNovoBloco(tipo, dados);
      const idxSel = this.blocoSelecionado ? (sec.blocos || []).findIndex(x => x.id === this.blocoSelecionado.id) : -1;
      if (idxSel >= 0 && Array.isArray(sec.blocos)) {
        sec.blocos.splice(idxSel + 1, 0, b);
        repaginarDocumento(this.doc);
      } else {
        adicionarBlocoNaSecao(this.doc, sec.id, b);
      }
      this.blocoSelecionado = b;
      this.notificarMudanca();
      this.renderizar();
      this.onSelecionarBloco(b, null);
      requestAnimationFrame(() => {
        const elFolha = this.container?.querySelector(`.ath-bloco-folha[data-bloco-id="${b.id}"]`);
        if (elFolha) {
          try { this.rolarNoPalco(elFolha, 'nearest'); } catch (_) {}
        }
      });
    };

    root.querySelector('#rmAddTitulo').addEventListener('click', () => adicionar('titulo', { texto: 'Novo Título' }));
    root.querySelector('#rmAddTexto').addEventListener('click', () => adicionar('paragrafo', { texto: 'Escreva seu parágrafo diretamente aqui...' }));
    this.ligarMenusDeBlocos(root, adicionar);
    root.querySelector('#rmAddFormula').addEventListener('click', () => adicionar('formula', { latex: 'E = m \\cdot c^2' }));
    const btnNota = root.querySelector('#rmAddNota');
    btnNota.addEventListener('mousedown', (e) => e.preventDefault()); // mantém o cursor no texto
    btnNota.addEventListener('click', () => this.inserirNotaRodapeNoCursor());
    root.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && !e.shiftKey && (e.code === 'KeyF' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        this.inserirNotaRodapeNoCursor();
      }
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        this.semanticaUI?.alternarVisibilidade();
      }
      if (e.key === 'Escape' && this.semanticaUI?.estado?.brushActiveTagId) {
        e.preventDefault();
        this.semanticaUI.definirModoPincel(null);
      }
    }, true);
    // clique no marcador abre o editor da nota inteira (também para notas divididas entre páginas)
    root.addEventListener('click', (ev) => {
      const ref = ev.target.closest?.('sup.ath-nota-ref');
      if (!ref || !root.contains(ref)) return;
      ev.stopPropagation();
      abrirEditorNota({
        doc: this.doc, id: ref.dataset.nota, ancora: ref,
        aoSalvar: (id, html) => this.salvarNotaRodape(id, html),
        aoExcluir: (id) => this.excluirNotaRodape(id)
      });
    }, true);
    root.querySelector('#rmAddDivisor').addEventListener('click', () => adicionar('divisor', {}));
    root.querySelector('#rmAddEspaco').addEventListener('click', () => adicionar('espaco', { altura_pt: 24 }));
    root.querySelector('#rmAddSumario').addEventListener('click', () => adicionar('sumario', {}));
    root.querySelector('#rmAddReferencias').addEventListener('click', () => {
      const ja = (this.doc.secoes || []).flatMap(sec => sec.blocos || []).find(x => x.tipo === 'referencias');
      if (ja) {
        const el = this.container?.querySelector(`.ath-bloco-folha[data-bloco-id="${ja.id}"]`) || document.querySelector(`.ath-bloco-folha[data-bloco-id="${ja.id}"]`);
        if (el) this.rolarNoPalco(el, 'center', true);
        return;
      } // a lista é uma só: leva até ela
      adicionar('referencias', { titulo: 'Referências' });
    });
    root.querySelector('#rmAddQuebra').addEventListener('click', () => adicionar('quebra_pagina', {}));

    // Alternar Guia Grade
    const btnGuia = root.querySelector('#rmGuia');
    btnGuia.addEventListener('click', () => {
      this.guiasVisiveis = !this.guiasVisiveis;
      btnGuia.setAttribute('aria-pressed', String(this.guiasVisiveis));
      btnGuia.classList.toggle('on', this.guiasVisiveis);
      this.renderizarFolhasPaginas();
    });
  }

  renderizarColunaEsquerda(colEsq) {
    if (!colEsq) return;
    colEsq.innerHTML = '';

    const secAtiva = this.obterSecaoAtiva();

    // Metade superior (50%): Páginas Mestras em Uso
    colEsq.appendChild(this.montarCardMestrasEmUso());

    // Metade inferior (50%): Blocos da Seção Ativa
    colEsq.appendChild(this.montarCardBlocos(secAtiva));
  }

  montarCardMestrasEmUso() {
    const cardMestras = document.createElement('div');
    cardMestras.className = 'rm-card-meio-a-meio';
    cardMestras.id = 'athCardMestrasEmUso';

    cardMestras.innerHTML = `
      <div class="rm-card-meio-a-meio-topo">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <strong style="font:800 12px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.08em;">
            Páginas Mestras em Uso <span class="rm-contagem">(${this.doc.secoes?.length || 0})</span>
          </strong>
        </div>

        <!-- Caixa de seleção no topo com maiszinho para adicionar à sequência -->
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px; padding:10px; background:var(--ath-surface-elevated, #F8FAFC); border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px;">
          <span style="font:800 11px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em;">Adicionar Mestra à Sequência</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <select id="athSelectAdicionarMestra" class="glx-select" style="flex:1; height:32px; font-size:11.5px; padding:0 8px; border-radius:8px;">
              ${(this.doc.mestras || []).map(m => `
                <option value="${m.id}">${m.nome} (${m.orientacao === 'paisagem' ? 'Paisagem' : 'Retrato'})</option>
              `).join('')}
            </select>
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnAdicionarMestra" title="Adicionar mestra selecionada à sequência do documento" style="width:32px; height:32px; padding:0; flex:none; display:flex; align-items:center; justify-content:center; border-radius:8px;">
              ${svgIcone('mais', 14)}
            </button>
          </div>
          <!-- Gerenciamento do Catálogo de Mestras -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnNovaMestraCatalogo" style="font-size:10.5px; padding:2px 8px; height:22px; display:inline-flex; align-items:center; gap:4px;" title="Criar nova página mestra do zero no catálogo">
              ${svgIcone('mais', 11)} Nova Mestra
            </button>
            <div style="display:flex; align-items:center; gap:4px;">
              <button type="button" class="rm-ic" id="athBtnEditarMestraCatalogo" title="Editar propriedades da mestra selecionada no catálogo" style="width:22px; height:22px;">
                ${svgIcone('lapis', 12)}
              </button>
              <button type="button" class="rm-ic rm-ic-perigo" id="athBtnExcluirMestraCatalogo" title="Excluir esta mestra do catálogo" style="width:22px; height:22px; color:#DC2626;">
                ${svgIcone('lixeira', 12)}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Lista das Seções / Mestras em uso na sequência do documento -->
      <div class="rm-card-meio-a-meio-corpo" id="rmListaMestrasEmUso"></div>
    `;

    const listaEmUsoBox = cardMestras.querySelector('#rmListaMestrasEmUso');
    (this.doc.secoes || []).forEach((sec, idx) => {
      const mestra = (this.doc.mestras || []).find(m => m.id === sec.mestraId) || this.doc.mestras?.[0];
      const ehSecaoAtiva = (sec.id === this.secaoAtivaId);
      const ehPrimeira = (idx === 0);
      const ehUltima = (idx === this.doc.secoes.length - 1);

      const item = document.createElement('div');
      item.className = `rm-mestra-card ${ehSecaoAtiva ? 'sel' : ''}`;
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '4px';
      item.style.padding = '8px 10px';
      item.style.borderRadius = '10px';
      item.style.border = `1px solid ${ehSecaoAtiva ? 'var(--ath-primary, #314F79)' : 'var(--ath-primary-line, #C8D7E6)'}`;
      item.style.background = ehSecaoAtiva ? 'var(--ath-primary-soft, #EEF4FA)' : '#fff';
      item.style.boxSizing = 'border-box';
      item.style.width = '100%';
      item.style.cursor = 'pointer';
      item.style.flexShrink = '0';

      item.innerHTML = `
        <div class="rm-mestra-card-topo" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%;">
          <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:${ehSecaoAtiva ? 'var(--ath-primary, #314F79)' : '#E2E8F0'}; color:${ehSecaoAtiva ? '#fff' : '#475569'}; font:800 11px var(--glx-font); flex:none;">
              ${idx + 1}
            </span>
            <strong class="rm-mestra-titulo" style="font-size:12.5px; font-weight:800; color:var(--ath-text, #1F2733); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;" title="${mestra ? mestra.nome : sec.nome}">
              ${mestra ? mestra.nome : sec.nome}
            </strong>
          </div>
          <div style="display:flex; align-items:center; gap:2px; flex:none;">
            <button type="button" class="rm-ic" data-acao="subir-secao" title="Subir na sequência" style="width:22px; height:22px;" ${ehPrimeira ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>
              ${svgIcone('cima', 12)}
            </button>
            <button type="button" class="rm-ic" data-acao="descer-secao" title="Descer na sequência" style="width:22px; height:22px;" ${ehUltima ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>
              ${svgIcone('baixo', 12)}
            </button>
            <button type="button" class="rm-ic" data-acao="editar-mestra" title="Configurar Mestra (${mestra ? mestra.nome : ''})" style="width:22px; height:22px;">
              ${svgIcone('lapis', 12)}
            </button>
            <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover-secao" title="Tirar da sequência do documento" style="width:22px; height:22px; color:#DC2626;">
              ${svgIcone('fechar', 12)}
            </button>
          </div>
        </div>
        <div class="rm-mestra-card-meta" style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; width:100%; margin-top:2px;">
          <span class="rm-selo" style="font-size:9.5px; padding:2px 7px; white-space:nowrap !important; flex:none;">
            ${mestra?.modo_aplicacao === 'fixa' ? 'Fixa · Grade 2D' : 'Progressiva · Fluxo'}
          </span>
          <span style="font-size:10.5px; color:var(--glx-muted, #6B7585); white-space:nowrap; flex:none;">
            ${mestra?.orientacao === 'paisagem' ? 'Paisagem' : 'Retrato'}
          </span>
          <span style="font-size:10px; color:var(--ath-primary, #314F79); font-weight:700; background:#EAF2FA; padding:1px 6px; border-radius:999px;">
            ${sec.blocos?.length || 0} ${sec.blocos?.length === 1 ? 'bloco' : 'blocos'}
          </span>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.secaoAtivaId = sec.id;
        this.blocoSelecionado = sec.blocos?.[0] || null;
        this.renderizar();
        this.onSelecionarBloco(this.blocoSelecionado, null);
        requestAnimationFrame(() => {
          const pagSec = (this.doc.paginas || []).find(p => p.secaoId === sec.id);
          if (pagSec) {
            const folhaEl = this.container?.querySelector(`.ath-folha-a4[data-pagina-id="${pagSec.id}"]`);
            if (folhaEl) {
              try { this.rolarNoPalco(folhaEl, 'start'); } catch (_) {}
            }
          }
        });
      });

      item.querySelector('[data-acao="subir-secao"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (ehPrimeira) return;
        this.secaoAtivaId = sec.id;
        moverSecao(this.doc, sec.id, -1);
        repaginarDocumento(this.doc);
        this.notificarMudanca();
        this.renderizar();
      });

      item.querySelector('[data-acao="descer-secao"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (ehUltima) return;
        this.secaoAtivaId = sec.id;
        moverSecao(this.doc, sec.id, 1);
        repaginarDocumento(this.doc);
        this.notificarMudanca();
        this.renderizar();
      });

      item.querySelector('[data-acao="editar-mestra"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (!mestra) return;
        new ModalEditorMestra(this.doc, mestra.id, {
          onSalvar: () => {
            this.notificarMudanca();
            this.renderizar();
          }
        });
      });

      item.querySelector('[data-acao="remover-secao"]')?.addEventListener('click', e => {
        e.stopPropagation();
        if (this.doc.secoes.length <= 1) {
          alert('O documento precisa conter pelo menos uma seção de página mestra.');
          return;
        }
        this.salvarSnapshot();
        removerSecao(this.doc, sec.id);
        const novaSec = this.doc.secoes.find(s => s.id === this.secaoAtivaId) || this.doc.secoes[0];
        this.secaoAtivaId = novaSec?.id || null;
        this.blocoSelecionado = novaSec?.blocos?.[0] || null;
        this.notificarMudanca();
        this.renderizar();
        this.onSelecionarBloco(this.blocoSelecionado, null);
      });

      listaEmUsoBox.appendChild(item);
    });

    const selMestra = cardMestras.querySelector('#athSelectAdicionarMestra');

    cardMestras.querySelector('#athBtnAdicionarMestra').addEventListener('click', () => {
      const mestraId = selMestra.value;
      const mestra = (this.doc.mestras || []).find(m => m.id === mestraId) || this.doc.mestras?.[0];
      if (!mestra) return;
      const nova = adicionarSecao(this.doc, mestra.nome, mestra.id);
      if (!nova.blocos || nova.blocos.length === 0) {
        nova.blocos = [criarNovoBloco('paragrafo', { texto: 'Escreva diretamente neste bloco...' })];
      }
      this.secaoAtivaId = nova.id;
      this.blocoSelecionado = nova.blocos[0] || null;
      repaginarDocumento(this.doc);
      this.notificarMudanca();
      this.renderizar();
      this.onSelecionarBloco(this.blocoSelecionado, null);
      requestAnimationFrame(() => {
        const pagSec = (this.doc.paginas || []).find(p => p.secaoId === nova.id);
        if (pagSec) {
          const folhaEl = this.container?.querySelector(`.ath-folha-a4[data-pagina-id="${pagSec.id}"]`);
          if (folhaEl) {
            try { this.rolarNoPalco(folhaEl, 'start'); } catch (_) {}
          }
        }
      });
    });

    cardMestras.querySelector('#athBtnEditarMestraCatalogo').addEventListener('click', () => {
      const mestraId = selMestra.value;
      if (!mestraId) return;
      new ModalEditorMestra(this.doc, mestraId, {
        onSalvar: () => {
          this.notificarMudanca();
          this.renderizar();
        }
      });
    });

    cardMestras.querySelector('#athBtnExcluirMestraCatalogo').addEventListener('click', () => {
      const mestraId = selMestra.value;
      const mestra = (this.doc.mestras || []).find(m => m.id === mestraId);
      if (!mestra) return;

      if ((this.doc.mestras || []).length <= 1) {
        alert('Não é possível excluir a única página mestra do catálogo.');
        return;
      }

      const secoesUso = (this.doc.secoes || []).filter(s => s.mestraId === mestraId);
      let msg = `Deseja excluir a página mestra "${mestra.nome}" do catálogo?`;
      if (secoesUso.length > 0) {
        msg = `A página mestra "${mestra.nome}" está em uso por ${secoesUso.length} seção(ões) do documento.\nAo excluí-la, essas seções serão migradas para a mestra principal.\n\nDeseja continuar?`;
      }
      if (window.confirm && !window.confirm(msg)) return;

      removerMestra(this.doc, mestraId);
      this.notificarMudanca();
      this.renderizar();
    });

    cardMestras.querySelector('#athBtnNovaMestraCatalogo').addEventListener('click', () => {
      const novoId = 'mestra_' + Date.now().toString(36);
      const novaMestra = {
        id: novoId,
        nome: 'Nova Página Mestra',
        tipo: 'personalizada',
        modo_aplicacao: 'progressiva',
        formato: 'a4',
        orientacao: 'retrato',
        margens_mm: { t: 25, r: 20, b: 20, l: 25 },
        grade: { colunas: 1, gap_mm: 4 },
        grade_2d: { linhas: 3, colunas: 3, gap_mm: 4 },
        cabecalho: { ativo: false, texto: '', alinhamento: 'direita', linha_divisoria: true },
        rodape: { ativo: true, texto: 'Athenes', numeracao: true, posicao_numero: 'direita' },
        elementos_recorrentes: []
      };
      this.doc.mestras.push(novaMestra);
      new ModalEditorMestra(this.doc, novoId, {
        onSalvar: () => {
          this.notificarMudanca();
          this.renderizar();
        }
      });
    });

    return cardMestras;
  }

  /* Menus da barra de blocos (Figura: gráfico, fotografia…; Quadro: campos…) */
  /* Faixa de ícones com rolagem horizontal sem barra: toque rola sozinho; mouse rola arrastando */
  ligarRolagemArrastavel(faixa) {
    if (!faixa || faixa._arrastavel) return;
    faixa._arrastavel = true;
    let ativo = false, moveu = false, x0 = 0, s0 = 0;
    faixa.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      ativo = true; moveu = false; x0 = ev.clientX; s0 = faixa.scrollLeft;
    });
    window.addEventListener('pointermove', ev => {
      if (!ativo) return;
      const dx = ev.clientX - x0;
      if (!moveu && Math.abs(dx) > 5) { moveu = true; faixa.style.cursor = 'grabbing'; }
      if (moveu) faixa.scrollLeft = s0 - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!ativo) return;
      ativo = false; faixa.style.cursor = '';
    });
    faixa.addEventListener('click', ev => {
      if (moveu) { ev.stopPropagation(); ev.preventDefault(); moveu = false; }
    }, true);
  }

  ligarMenusDeBlocos(root, adicionar) {
    this.ligarRolagemArrastavel(root.querySelector('#athBarraRolagem'));
    const fecharTodos = () => {
      document.querySelectorAll('.rm-menu-bloco:not([hidden])').forEach(m => {
        m.hidden = true;
        m.parentElement.querySelector('.rm-ic-bt')?.setAttribute('aria-expanded', 'false');
      });
    };
    if (!this._menusRegistrados) {
      this._menusRegistrados = true;
      document.addEventListener('click', fecharTodos);
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharTodos(); });
    }

    root.querySelectorAll('.rm-grupo-bt').forEach(grupo => {
      const itens = MENUS_BLOCO[grupo.dataset.grupo] || [];
      const botao = grupo.querySelector('.rm-ic-bt');
      const menu = grupo.querySelector('.rm-menu-bloco');
      menu.innerHTML = itens.map((it, i) => `
        <button type="button" class="rm-menu-item" role="menuitem" data-i="${i}">
          <span class="rm-menu-icone">${svgIcone(it.icone, 16)}</span>
          <span class="rm-menu-texto"><strong>${it.rotulo}</strong><small>${it.desc}</small></span>
        </button>`).join('');

      botao.addEventListener('click', ev => {
        ev.stopPropagation();
        const abrir = menu.hidden;
        fecharTodos();
        menu.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
        if (abrir) {
          // a faixa rola e corta o que passa da borda: o menu abre solto (fixed), colado embaixo do botão
          const r = botao.getBoundingClientRect();
          const larg = Math.max(menu.offsetWidth, 270);
          menu.style.position = 'fixed';
          menu.style.transform = 'none';
          menu.style.top = `${Math.round(r.bottom + 10)}px`;
          menu.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - larg - 8, r.left + r.width / 2 - larg / 2)))}px`;
        }
      });
      menu.querySelectorAll('.rm-menu-item').forEach(el => el.addEventListener('click', ev => {
        ev.stopPropagation();
        const it = itens[Number(el.dataset.i)];
        fecharTodos();
        if (it.acao === 'modal_figura') {
          if (modoSomenteLeitura(this.modoTrabalho)) { alert('O documento está em um modo somente leitura (Leitura ou Comparar). Mude para Edição ou Sugestão no topo para inserir blocos.'); return; }
          abrirModalInserirFigura({ aoConfirmar: (r) => this.inserirFiguraClassificada(r, adicionar) });
          return;
        }
        const dados = it.tipo === 'figura'
          ? { subtipo: it.subtipo, titulo: `${it.rotulo} — Descrição` }
          : (it.tipo === 'quadro' ? { titulo: 'Quadro — Dados conceituais' } : (it.tipo === 'tabela' ? { titulo: 'Tabela — Dados quantitativos' } : {}));
        adicionar(it.tipo, dados);
      }));
    });
  }

  /* ======================================================================
     Estilos de texto: lista selecionável + rascunho + "Salvar estilo"
     ====================================================================== */
  montarSecaoEstilos() {
    const sec = document.createElement('details');
    sec.className = 'rm-sec';
    sec.open = !!this.estilosAberto;
    sec.addEventListener('toggle', () => { this.estilosAberto = sec.open; });

    const estilos = this.doc.estilos || [];
    const estilo = estilos.find(e => e.id === this.estiloSelecionadoId) || estilos[0];
    if (!estilo) {
      sec.innerHTML = '<summary>Estilos de texto</summary><span class="rm-dica">Este documento não tem estilos.</span>';
      return sec;
    }
    this.estiloSelecionadoId = estilo.id;
    const fonteRotulo = id => (FONTES_SISTEMA[id]?.rotulo || id || '').replace(/ \(.*\)$/, '');

    sec.innerHTML = `
      <summary>ESTILOS DE TEXTO <span class="rm-contagem">(${estilos.length})</span></summary>
      <ul class="rm-lista-estilos" id="rmListaEstilos" style="max-height:260px; overflow-y:auto; margin-top:6px;"></ul>
      <div class="rm-estilo-previa" id="rmEstiloPrevia" style="margin-top:10px; margin-bottom:8px;">Aa — Texto de exemplo do estilo</div>
      <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmBtnNovoEstiloEsq" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:6px;">
        ${svgIcone('mais', 12)} Novo Estilo
      </button>
    `;

    const previa = sec.querySelector('#rmEstiloPrevia');
    const atualizarPrevia = (est) => {
      previa.style.cssText = `${estiloParaCss(est)} margin-top:10px; margin-bottom:8px; max-height:84px; overflow:hidden; text-align:${alinhamentoCss(est.alinhamento, 'left')}; text-align-last:auto;`;
    };
    atualizarPrevia(estilo);

    // Lista de estilos
    const lista = sec.querySelector('#rmListaEstilos');
    estilos.forEach(est => {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.style.margin = '0 0 4px 0';
      const ehSel = (est.id === this.estiloSelecionadoId);
      li.innerHTML = `
        <div class="rm-estilo-item ${ehSel ? 'on' : ''}" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; cursor:pointer; padding:6px 10px; border-radius:10px; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span class="rm-estilo-amostra" style="color:${est.cor || '#1F2733'}; font-weight:${est.peso || 400}; flex:none;">Aa</span>
            <span class="rm-estilo-nome" style="flex:1; min-width:0;">
              <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${est.nome}</strong>
              <small style="color:var(--glx-muted, #6B7585);">${fonteRotulo(est.fonte)} · ${est.tamanho_pt || 12} pt · ${est.peso || 400}</small>
            </span>
            ${est.personalizado ? '<em class="rm-estilo-tag" style="flex:none;">seu</em>' : ''}
          </div>
          <button type="button" class="rm-ic" data-acao="editar-estilo" title="Editar estilo (${est.nome})" style="width:auto; height:26px; padding:0 10px; gap:5px; display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; font:700 11px var(--glx-font); flex:none; border-radius:8px; border:1px solid #CBD5E1; background:#fff; color:#314F79;">
            ${svgIcone('lapis', 13)} Editar
          </button>
          ${est.id === 'corpo' ? '' : `<button type="button" class="rm-ic" data-acao="excluir-estilo" title="Excluir estilo (${est.nome})" style="width:26px; height:26px; flex:none; border-radius:6px; color:#DC2626;">${svgIcone('lixeira', 13)}</button>`}
        </div>
      `;

      const itemCard = li.querySelector('.rm-estilo-item');
      const btnEditar = li.querySelector('[data-acao="editar-estilo"]');
      li.querySelector('[data-acao="excluir-estilo"]')?.addEventListener('click', (e) => { e.stopPropagation(); this.excluirEstiloComConfirmacao(est);  });

      const selecionarEAplicar = () => {
        this.estiloSelecionadoId = est.id;
        sec.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPrevia(est);
        if (this.blocoSelecionado) {
          this.blocoSelecionado.estiloId = est.id;
          this.notificarMudanca();
          this.renderizar();
          this.onSelecionarBloco(this.blocoSelecionado, null);
        }
        this.opcoes.onEditarEstilo?.(est);
      };

      itemCard.addEventListener('click', (e) => {
        if (e.target.closest('[data-acao]')) return;
        selecionarEAplicar();
      });

      btnEditar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.estiloSelecionadoId = est.id;
        sec.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPrevia(est);
        this.opcoes.onEditarEstilo?.(est);
      });

      lista.appendChild(li);
    });

    sec.querySelector('#rmBtnNovoEstiloEsq').addEventListener('click', () => {
      const novo = {
        id: 'est_' + Date.now().toString(36),
        nome: 'Novo Estilo',
        fonte: 'nunito',
        tamanho_pt: 12,
        peso: 400,
        alinhamento: 'esquerda',
        entrelinha: 1.5,
        espaco_depois_pt: 8,
        espaco_paragrafos_pt: 6,
        cor: '#1F2733',
        personalizado: true
      };
      this.doc.estilos.push(novo);
      this.estiloSelecionadoId = novo.id;
      this.notificarMudanca();
      this.renderizar();
      this.opcoes.onEditarEstilo?.(novo);
    });

    return sec;
  }

  redesenharColunaEsquerda() {
    const col = this.container.querySelector('#rmColEsq');
    if (!col) return;
    const scrollMestras = col.querySelector('#rmListaMestrasEmUso')?.scrollTop || 0;
    const scrollBlocos = col.querySelector('#athCardBlocosSecao .rm-card-meio-a-meio-corpo')?.scrollTop || 0;
    this.renderizarColunaEsquerda(col);
    const mEl = col.querySelector('#rmListaMestrasEmUso');
    if (mEl) mEl.scrollTop = scrollMestras;
    const bEl = col.querySelector('#athCardBlocosSecao .rm-card-meio-a-meio-corpo');
    if (bEl) bEl.scrollTop = scrollBlocos;
  }

  /* ======================================================================
     Lista de blocos: linhas, grupos e arrastar/soltar (mecânica do Clux.js)
     ====================================================================== */
  montarCardBlocos(secAtiva) {
    const blocosSecao = secAtiva?.blocos || [];
    const card = document.createElement('div');
    card.className = 'rm-card-meio-a-meio';
    card.id = 'athCardBlocosSecao';
    card.innerHTML = `
      <div class="rm-card-meio-a-meio-topo">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <strong style="font:800 12px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.08em;">
            Blocos da Seção <span class="rm-contagem">(${blocosSecao.length})</span>
          </strong>
        </div>
      </div>
      <div class="rm-card-meio-a-meio-corpo">
        <ol class="rm-blocos" id="rmListaBlocosSec"></ol>
      </div>
      <div class="rm-card-meio-a-meio-rodape">
        <span class="rm-dica" style="margin:0; font-size:11px; line-height:1.3; color:var(--glx-muted, #6B7585); display:block;">
          Arraste um bloco: solte na borda de outro para reordenar ou no centro para colocá-los lado a lado na mesma linha.
        </span>
      </div>
    `;
    const ol = card.querySelector('#rmListaBlocosSec');
    calcularLinhas(blocosSecao).forEach((linha, i) => {
      const cab = document.createElement('li');
      cab.className = 'rm-linha-cab';
      cab.innerHTML = `<span class="rm-linha-num">${i + 1}</span> LINHA ${i + 1}`;
      ol.appendChild(cab);
      if (linha.length > 1) {
        const grupo = document.createElement('li');
        grupo.className = 'rm-grupo';
        const ul = document.createElement('ul');
        ul.className = 'rm-grupo-lista';
        linha.forEach(b => ul.appendChild(this.criarItemBloco(b, secAtiva)));
        grupo.appendChild(ul);
        ol.appendChild(grupo);
      } else {
        ol.appendChild(this.criarItemBloco(linha[0], secAtiva));
      }
    });
    return card;
  }

  montarSecaoBlocos(secAtiva) {
    return this.montarCardBlocos(secAtiva);
  }

  criarItemBloco(b, secAtiva) {
    const li = document.createElement('li');
    li.className = `rm-bl ${b.id === this.blocoSelecionado?.id ? 'sel' : ''}`;
    li.dataset.blocoId = b.id;
    li.draggable = true;
    if (b.tipo === 'titulo') li.style.setProperty('--ath-outline-recuo', `${(nivelDe(b) - 1) * 10}px`); // mapa do documento: recuo por nível
    li.innerHTML = `
      <button type="button" class="rm-bl-nome">
        <strong>${rotuloDoBloco(b, this.doc)}</strong>
        <span>${resumoBloco(b)}</span>
      </button>
      <div class="rm-bl-acoes" draggable="false">
        <button type="button" class="rm-ic" data-acao="subir" draggable="false" title="Subir uma linha">${svgIcone('cima', 14)}</button>
        <button type="button" class="rm-ic" data-acao="descer" draggable="false" title="Descer uma linha">${svgIcone('baixo', 14)}</button>
        <button type="button" class="rm-ic" data-acao="duplicar" draggable="false" title="Duplicar">${svgIcone('copiar', 14)}</button>
        <button type="button" class="rm-ic" data-acao="dividir" draggable="false" title="Dividir este bloco em dois">${svgIcone('divisor', 14)}</button>
        <button type="button" class="rm-ic rm-ic-perigo" data-acao="remover" draggable="false" title="Excluir">${svgIcone('fechar', 14)}</button>
      </div>
    `;

    const boxAcoes = li.querySelector('.rm-bl-acoes');
    boxAcoes.addEventListener('mousedown', e => e.stopPropagation());
    boxAcoes.addEventListener('pointerdown', e => e.stopPropagation());

    li.querySelector('.rm-bl-nome').addEventListener('click', () => {
      this.selecionarBloco(b, null, { scrollPage: true });
    });

    const acao = (nome, fn) => {
      const btn = li.querySelector(`[data-acao="${nome}"]`);
      if (!btn) return;
      btn.addEventListener('mousedown', e => e.stopPropagation());
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    };

    acao('subir', () => { if (moverBlocoPorLinha(this.doc, b.id, -1)) this.aposEstrutura(b); });
    acao('descer', () => { if (moverBlocoPorLinha(this.doc, b.id, 1)) this.aposEstrutura(b); });
    acao('duplicar', () => { const c = duplicarBlocoNaSecao(this.doc, b.id); if (c) this.aposEstrutura(c); });
    acao('dividir', () => { this.dividirBlocoAtual(b.id); });
    acao('remover', () => {
      const secReal = buscarSecaoDoBloco(this.doc, b.id) || secAtiva;
      if (secReal) {
        const idxAntigo = (secReal.blocos || []).findIndex(x => x.id === b.id);
        removerBlocoDaSecao(this.doc, secReal.id, b.id);
        let novoSel = this.blocoSelecionado;
        if (this.blocoSelecionado?.id === b.id) {
          const rest = secReal.blocos || [];
          novoSel = rest[Math.min(Math.max(0, idxAntigo), rest.length - 1)] || null;
        }
        this.aposEstrutura(novoSel);
      }
    });

    li.addEventListener('dragstart', ev => {
      if (ev.target.closest('.rm-bl-acoes')) {
        ev.preventDefault();
        return false;
      }
      this.iniciarArrasto(ev, b, li);
    });
    li.addEventListener('dragend', () => this.encerrarArrasto());
    this.ligarAlvoDeSolta(li, b);
    return li;
  }

  /** Nenhum bloco selecionado: limpa o destaque, o cursor de texto e avisa o painel de propriedades. */
  limparSelecaoDeBloco() {
    if (this._itemFigura) { this._itemFigura = null; this.marcarItemFigura?.(); }
    this.blocoSelecionado = null;
    this.atualizarSelecaoVisualBloco(null);
    const ativo = document.activeElement;
    if (ativo && this.container?.contains(ativo) && ativo.isContentEditable) ativo.blur();
    window.getSelection?.()?.removeAllRanges();
    this.onSelecionarBloco(null, null);
  }

  /** Exclui um estilo do documento (pede confirmação e diz quantos blocos serão reatribuídos). O Corpo do Texto é protegido. */
  excluirEstiloComConfirmacao(est) {
    if (!est || ESTILOS_PROTEGIDOS.includes(est.id)) return false;
    const uso = contarUsoDoEstilo(this.doc, est.id);
    const aviso = uso
      ? `O estilo "${est.nome}" é usado em ${uso} bloco(s). Eles passarão para o título do mesmo nível ou para o Corpo do Texto. Excluir mesmo assim?`
      : `Excluir o estilo "${est.nome}"?`;
    if (!window.confirm(aviso)) return false;
    if (!excluirEstilo(this.doc, est.id).ok) return false;
    if (this.estiloSelecionadoId === est.id) this.estiloSelecionadoId = null;
    this.notificarMudanca(true);
    this.renderizar();
    return true;
  }

  atualizarSelecaoVisualBloco(blocoId) {
    if (!this.container) return;
    // 1. Atualiza nos blocos da folha na área de prévia
    this.container.querySelectorAll('.ath-bloco-folha').forEach(node => {
      const match = node.dataset.blocoId === blocoId;
      node.classList.toggle('sel', match);
    });
    // 2. Atualiza na lista de blocos da barra lateral esquerda
    this.container.querySelectorAll('.rm-bl').forEach(node => {
      const match = node.dataset.blocoId === blocoId;
      node.classList.toggle('sel', match);
      if (match) {
        try { this.rolarNaLista(node); } catch (_) {}
      }
    });
    this._reguasDoc?.atualizar();
  }

  /**
   * Mostra o item na lista lateral rolando SÓ o contêiner rolável da própria lista.
   * (Antes usava rolarNoPalco com a posição do item da lista, o que empurrava as páginas para o fim ao selecionar.)
   */
  rolarNaLista(item) {
    let pai = item.parentElement;
    while (pai && pai !== this.container && !(pai.scrollHeight > pai.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(pai).overflowY))) pai = pai.parentElement;
    if (!pai || pai === this.container) return;
    const p = pai.getBoundingClientRect(), r = item.getBoundingClientRect();
    if (r.top < p.top) pai.scrollTop += r.top - p.top - 8;
    else if (r.bottom > p.bottom) pai.scrollTop += r.bottom - p.bottom + 8;
  }

  /**
   * Aplica o estilo de texto COMPLETO escolhido para o `papel` (titulo, legenda, fonte…) do bloco:
   * fonte, tamanho, peso, cor, itálico, caixa alta, entrelinha, recuos, espaçamentos, fundo e alinhamento
   * (o alinhamento explícito do bloco vence o do estilo). Sem estilo escolhido, mantém o visual padrão.
   * `prefixoEl` (ex.: "Figura 1 —") passa a herdar peso e cor do estilo.
   */
  aplicarTipografiaBloco(el, b, papel, prefixoEl = null) {
    const est = localizarEstilo(this.doc.estilos, b[`${papel}_estilo_id`]);
    const css = estiloParaCssComAlinhamento(est, b[`${papel}_alinhamento`]);
    if (css) el.style.cssText += ';' + css;
    if (est && prefixoEl) {
      prefixoEl.style.fontWeight = 'inherit';
      prefixoEl.style.color = 'inherit';
    }
    // numeração ("Tabela 1 —", "Figura 2 —"): estilo próprio, independente do título
    const estNum = papel === 'titulo' ? localizarEstilo(this.doc.estilos, b.numeracao_estilo_id) : null;
    if (estNum && prefixoEl) prefixoEl.style.cssText += ';' + estiloParaCssNumeracao(estNum) + ';margin-right:4px;';
  }

  /** Insere um marcador de nota de rodapé na posição do cursor e foca o texto da nova nota na base da página. */
  inserirNotaRodapeNoCursor() {
    if (modoSomenteLeitura(this.modoTrabalho)) return;
    const sel = window.getSelection();
    const no = sel?.anchorNode;
    const alvo = (no?.nodeType === 1 ? no : no?.parentElement)?.closest?.('.ath-texto-editable, .ath-titulo-editable');
    const folha = alvo?.closest('.ath-bloco-folha');
    const b = folha ? this.buscarBlocoPorId(folha.dataset.blocoId) : null;
    if (!alvo || !b) {
      alert('Posicione o cursor no texto onde a nota de rodapé deve aparecer.');
      return;
    }
    const nota = criarNotaRodape(this.doc, '');
    document.execCommand('insertHTML', false, htmlMarcadorNota(nota.id));
    b.texto = sanearHtmlTexto(removerPalavrasIniciais(removerHifensCondicionais(alvo.innerHTML)));
    this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
    this.notificarMudanca();
    this.renderizarFolhasPaginas();
    requestAnimationFrame(() => {
      const campo = this.container?.querySelector(`.ath-nota[data-nota-id="${nota.id}"] .ath-nota-txt`);
      if (campo) { this.rolarNoPalco(campo, 'nearest', false); campo.focus(); }
    });
  }

  /** Grava o conteúdo (já sanitizado) de uma nota e repagina, pois a altura pode ter mudado. */
  salvarNotaRodape(id, html) {
    const nota = obterNota(this.doc, id);
    if (!nota || nota.html === html) return;
    nota.html = html;
    this.notificarMudanca();
    this.renderizarFolhasPaginas();
  }

  excluirNotaRodape(id) {
    removerNota(this.doc, id);
    this.notificarMudanca();
    this.renderizar();
  }

  /** Liga a captura de edição sob sugestão a um elemento editável de texto (parágrafo/título). */
  instalarSugestaoNoBloco(elemento, b) {
    instalarSugestaoInline(elemento, {
      bloco: b,
      doc: this.doc,
      perfil: () => this.perfilColaborador,
      ativo: () => this.modoTrabalho === MODOS_TRABALHO.SUGESTAO,
      aoAlterar: () => {
        b.texto = sanearHtmlTexto(removerPalavrasIniciais(removerHifensCondicionais(elemento.innerHTML)));
        this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
        this.notificarMudancaRapida();
      }
    });
  }

  /** Seleciona uma imagem individual do subgrid: destaca com contorno e mostra a barra do item. */
  selecionarItemFigura(b, pag, idx) {
    this._itemFigura = { id: b.id, idx };
    this.selecionarBloco(b, pag);
    this.marcarItemFigura();
  }

  /** Reflete `_itemFigura` no DOM: contorno ativo + barra flutuante (ou limpa se não houver seleção). */
  marcarItemFigura() {
    if (!this.container) return;
    this.container.querySelectorAll('.ath-fig-item.sel').forEach(n => n.classList.remove('sel'));
    this.container.querySelectorAll('.ath-fig-barra-item').forEach(n => n.remove());
    const sel = this._itemFigura;
    if (!sel) return;
    const bloco = this.buscarBlocoPorId(sel.id);
    const cel = this.container.querySelector(`.ath-bloco-folha[data-bloco-id="${sel.id}"] .ath-fig-item[data-idx="${sel.idx}"]`);
    if (!bloco || !cel) return;
    cel.classList.add('sel');
    cel.appendChild(criarBarraItemFigura({
      b: bloco,
      idx: sel.idx,
      aoAlterar: () => { this.notificarMudancaRapida(); this.reconstruirFigura(bloco.id); },
      aoTrocarImagem: (i) => this.escolherImagemItemFigura(bloco, i),
      aoEditarCodigo: (i) => this.editarCodigoItemFigura(bloco, i),
      aoLimpar: (i) => {
        bloco.itens[i].url = '';
        bloco.itens[i].content = '';
        bloco.src = bloco.itens[0]?.url || '';
        this.notificarMudanca();
        this.reconstruirFigura(bloco.id);
      }
    }));
  }

  reconstruirFigura(blocoId) {
    this.container?.querySelector(`.ath-bloco-folha[data-bloco-id="${blocoId}"]`)?._reconstruirFigura?.();
  }

  /** Modal dividido (código | prévia ao vivo) do slot `idx`; um slot de imagem vira figura por código ao aplicar. */
  editarCodigoItemFigura(b, idx) {
    if (modoSomenteLeitura(this.modoTrabalho)) return;
    abrirEditorCodigoFigura({
      doc: this.doc, bloco: b, idx,
      aoSalvar: (item) => {
        if (!Array.isArray(b.itens)) b.itens = [];
        b.itens[idx] = { ...(b.itens[idx] || {}), ...item, url: '' };
        b.src = b.itens[0]?.url || '';
        this.notificarMudanca();
        this.renderizar();
      }
    });
  }

  /** "Nova figura…": cria o bloco já classificado (prefixo/numeração/proporção) e abre upload ou editor de código. */
  inserirFiguraClassificada({ papel, sourceType }, adicionar) {
    const p = obterPapelSemantico(papel);
    const codigo = ehFonteCodigo(sourceType);
    adicionar('figura', {
      semanticRole: papel,
      subtipo: p?.subtipo,
      titulo: `${p?.prefixo || 'Figura'} — Descrição`,
      itens: [{ id: 'fig_item_' + Date.now().toString(36), url: '', legenda_sub: 'Visão geral', sourceType: codigo ? sourceType : 'image_url', content: codigo ? exemploDeCodigo(sourceType) : '' }]
    });
    const b = this.blocoSelecionado;
    if (!b) return;
    if (codigo) this.editarCodigoItemFigura(b, 0);
    else this.escolherImagemItemFigura(b, 0);
  }

  /** Abre o seletor de arquivo e grava a imagem (data URL, offline) no slot `idx`. */
  escolherImagemItemFigura(b, idx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const arq = input.files?.[0];
      if (!arq) return;
      const leitor = new FileReader();
      leitor.onload = (e) => {
        if (!Array.isArray(b.itens)) b.itens = [];
        const item = (b.itens[idx] ||= { url: '', legenda_sub: '' });
        item.sourceType = 'image_url'; // volta a ser imagem enviada (descarta o código do slot)
        item.url = e.target.result;
        item.content = e.target.result;
        b.src = b.itens[0]?.url || '';
        this.notificarMudanca();
        this.reconstruirFigura(b.id);
      };
      leitor.readAsDataURL(arq);
    });
    input.click();
  }

  selecionarBloco(b, pag = null, opcoes = {}) {
    if (this._itemFigura && this._itemFigura.id !== b?.id) {
      this._itemFigura = null;
      this.marcarItemFigura();
    }
    if (b?._frag) b = this.buscarBlocoPorId(b.id) || b; // um fragmento seleciona o bloco inteiro (o painel edita o original)
    this.blocoSelecionado = b;
    let mudouSecao = false;
    if (b) {
      const secReal = buscarSecaoDoBloco(this.doc, b.id);
      if (secReal && secReal.id !== this.secaoAtivaId) {
        this.secaoAtivaId = secReal.id;
        mudouSecao = true;
      }
    }
    if (mudouSecao) {
      this.redesenharColunaEsquerda();
    }
    this.atualizarSelecaoVisualBloco(b?.id);
    this.onSelecionarBloco(b, pag);

    if (opcoes.scrollPage && b && this.container) {
      const elFolha = this.container.querySelector(`.ath-bloco-folha[data-bloco-id="${b.id}"]`);
      if (elFolha) {
        try { this.rolarNoPalco(elFolha, 'nearest'); } catch (_) {}
      }
    }
  }

  
  dividirBlocoAtual(blocoId = null, corte = null) {
    const id = blocoId || this.blocoSelecionado?.id;
    if (!id) return;
    const res = dividirBlocoTexto(this.doc, id, corte);
    if (res) {
      this.aposEstrutura(res.novoBloco);
    }
  }

  aposEstrutura(selecionado) {
    this.blocoSelecionado = selecionado || null;
    this.notificarMudanca();
    this.renderizar();
    this.onSelecionarBloco(this.blocoSelecionado, null);
  }

  buscarBlocoPorId(id) {
    for (const s of this.doc.secoes || []) {
      const b = (s.blocos || []).find(x => x.id === id);
      if (b) return b;
    }
    return null;
  }

  iniciarArrasto(ev, bloco, elImagem) {
    this.arrastandoId = bloco.id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('application/x-athenes-bloco', bloco.id);
    if (elImagem) ev.dataTransfer.setDragImage(elImagem, 16, 16);
    setTimeout(() => elImagem?.classList.add('arrastando'), 0);
  }

  encerrarArrasto() {
    this.arrastandoId = null;
    this.limparMarcasSolta();
    this.container.querySelectorAll('.arrastando').forEach(n => n.classList.remove('arrastando'));
  }

  limparMarcasSolta() {
    this.container.querySelectorAll('.drop-antes, .drop-depois, .drop-grupo, .drop-esq, .drop-dir')
      .forEach(n => n.classList.remove('drop-antes', 'drop-depois', 'drop-grupo', 'drop-esq', 'drop-dir'));
  }

  calcularZonaDeSolta(ev, el) {
    const r = el.getBoundingClientRect();
    const y = ev.clientY - r.top;
    const x = ev.clientX - r.left;
    const borda = Math.min(22, r.height * 0.3);
    const zona = y < borda ? 'antes' : (y > r.height - borda ? 'depois' : 'grupo');
    return { zona, aDireita: x >= r.width / 2 };
  }

  ligarAlvoDeSolta(el, bloco) {
    el.addEventListener('dragover', ev => {
      if (!this.arrastandoId || this.arrastandoId === bloco.id) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.dataTransfer.dropEffect = 'move';
      const z = this.calcularZonaDeSolta(ev, el);
      this.limparMarcasSolta();
      el.classList.add(z.zona === 'antes' ? 'drop-antes' : (z.zona === 'depois' ? 'drop-depois' : 'drop-grupo'));
      if (z.zona === 'grupo') el.classList.add(z.aDireita ? 'drop-dir' : 'drop-esq');
    });
    el.addEventListener('dragleave', ev => {
      if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-antes', 'drop-depois', 'drop-grupo', 'drop-esq', 'drop-dir');
    });
    el.addEventListener('drop', ev => {
      if (!this.arrastandoId) return;
      ev.preventDefault();
      ev.stopPropagation();
      const z = this.calcularZonaDeSolta(ev, el);
      const id = this.arrastandoId;
      this.encerrarArrasto();
      if (colocarBloco(this.doc, id, bloco.id, z.zona, z.aDireita)) {
        const movido = this.buscarBlocoPorId(id);
        const sec = (this.doc.secoes || []).find(s => s.blocos.includes(movido));
        if (sec) this.secaoAtivaId = sec.id;
        this.aposEstrutura(movido);
      }
    });
  }

  /** Leitura fiel e Comparar: o palco passa a exibir réplicas da exportação em iframes (sem nenhum elemento editável). */
  renderizarVisaoRevisao(palco) {
    this._visaoRevisao?.destruir();
    palco.innerHTML = '';
    palco.classList.add('ath-palco-revisao');
    this._visaoRevisao = this.modoTrabalho === MODOS_TRABALHO.COMPARAR
      ? montarComparacao(palco, this.doc)
      : montarLeituraFiel(palco, this.doc);
    const info = this.container.querySelector('#rmPrevInfo');
    if (info) info.textContent = this.modoTrabalho === MODOS_TRABALHO.COMPARAR ? 'comparação original × proposta' : 'leitura fiel (réplica da exportação)';
  }

  renderizarFolhasPaginas() {
    const palco = this.container.querySelector('#rmPrevPalco');
    if (!palco) return;
    if (modoSomenteLeitura(this.modoTrabalho)) { this.renderizarVisaoRevisao(palco); return; }
    const scrollTopSalvo = palco.scrollTop || 0;
    const scrollLeftSalvo = palco.scrollLeft || 0;
    palco.classList.remove('ath-palco-revisao');
    palco.innerHTML = '';
    // regras de pseudo-elementos dos estilos avançados (capitular, 1ª linha, ornamento de fim)
    let stAv = document.getElementById('athEstiloAvancado');
    if (!stAv) { stAv = document.createElement('style'); stAv.id = 'athEstiloAvancado'; document.head.appendChild(stAv); }
    const cssAv = cssAvancadoDosEstilos(this.doc.estilos);
    if (stAv.textContent !== cssAv) stAv.textContent = cssAv;
    // marcadores das notas (no texto e no rodapé): fonte, cor, negrito e sobrescrito do documento
    let stNotas = document.getElementById('athNotasCss');
    if (!stNotas) { stNotas = document.createElement('style'); stNotas.id = 'athNotasCss'; document.head.appendChild(stNotas); }
    const cssNotas = cssMarcadoresNota(obterConfigNotas(this.doc), '#rmPrevPalco ', id => FONTES_SISTEMA[id]?.familia || '');
    if (stNotas.textContent !== cssNotas) stNotas.textContent = cssNotas;

    repaginarDocumento(this.doc);
    recalcularNumeracaoAutomatica(this.doc);
    this.mapaNumSecoes = calcularNumeracaoSecoes(this.doc);
    this.mapaMarc = mapaMarcadores(this.doc);
    setTimeout(() => this._atualizarCaixaEstilo?.(), 0);

    const paginas = this.doc.paginas || [];
    this._sigPaginas = this.assinaturaPaginacao();
    this.agendarCalibracao();
    const infoPrev = this.container.querySelector('#rmPrevInfo');
    const mestra = this.obterMestraAtiva();
    const paisagem = mestra?.orientacao === 'paisagem';

    if (infoPrev) {
      const dimInfo = dimensoesPapelMm(mestra?.formato, mestra?.orientacao, mestra?.dimensoes_personalizadas);
      infoPrev.textContent = `${mestra?.formato || 'A4'} ${paisagem ? 'paisagem' : 'retrato'} · ${dimInfo.largura_mm} × ${dimInfo.altura_mm} mm · este documento ocupa ${paginas.length} página${paginas.length > 1 ? 's' : ''}`;
    }

    paginas.forEach(pag => {
      try {
      const mestraPag = modeloDaPagina(this.doc, pag);
      const dimPag = dimensoesPapelMm(mestraPag?.formato, mestraPag?.orientacao, mestraPag?.dimensoes_personalizadas);
      const margens = margensEfetivasMm(mestraPag || {}, dimPag.largura_mm, dimPag.altura_mm);

      const folha = document.createElement('div');
      folha.className = `ath-folha-a4 ${mestraPag?.orientacao === 'paisagem' ? 'paisagem' : ''}`;
      folha.dataset.paginaId = pag.id;
      folha.dataset.largMm = String(dimPag.largura_mm); // base para medir alturas na folha (calibração)
      folha.dataset.altMm = String(dimPag.altura_mm);
      // o tamanho vem do papel da mestra (A4, Carta, A3, Executivo, personalizado), não de um valor fixo de A4 no CSS
      folha.style.width = `${dimPag.largura_mm * 3.7795}px`;
      folha.style.minHeight = `${dimPag.altura_mm * 3.7795}px`;

      // Margem interna proporcional (conversão mm para px a ~3.78 px/mm)
      const pxPorMm = 3.7795;
      const geo = geometriaCorpoMm(mestraPag);
      const padTop = geo.topoMm * pxPorMm;
      const padRight = margens.r * pxPorMm;
      const padBottom = geo.baseMm * pxPorMm;
      const padLeft = margens.l * pxPorMm;
      const areasPag = resolverAreasPagina(this.doc, mestraPag, pag, pag.numeroExibido ?? pag.numero, paginas.length);

      folha.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
      folha.dataset.margens = [geo.topoMm, margens.r, geo.baseMm, margens.l].map(v => Math.round((Number(v) || 0) * 10) / 10).join(','); // para as réguas

      // Linha indicativa das margens
      const guiaMargem = document.createElement('div');
      guiaMargem.className = 'ath-folha-guia-margem';
      guiaMargem.style.inset = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
      folha.appendChild(guiaMargem);

      // Elementos Recorrentes da Página Mestra (Nível Editorial)
      if (Array.isArray(mestraPag?.elementos_recorrentes) && mestraPag.elementos_recorrentes.length > 0) {
        const wrapElemMestra = document.createElement('div');
        wrapElemMestra.className = 'ath-folha-elementos-mestra';
        wrapElemMestra.style.position = 'absolute';
        wrapElemMestra.style.inset = '0';
        wrapElemMestra.style.pointerEvents = 'none';
        wrapElemMestra.style.zIndex = '0';

        const camadaCanvas = document.createElement('div');
        camadaCanvas.className = 'ath-folha-elementos-livres';
        camadaCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
        camadaCanvas.innerHTML = elementosMestraHtml(mestraPag, pag, { larguraMm: dimPag.largura_mm, alturaMm: dimPag.altura_mm, margens },
          contextoVariaveisPagina(this.doc, pag, paginas.length));
        wrapElemMestra.appendChild(camadaCanvas);

        mestraPag.elementos_recorrentes.forEach(elem => {
          if (renderizadoPeloCanvas(elem)) return;
          if (elem.tipo === 'foto_capa') {
            const sangria = !!elem.sangria;
            const respRecuo = !sangria && !!elem.respeitar_recuo;
            const folhaW = dimPag.largura_mm * pxPorMm;
            const folhaH = dimPag.altura_mm * pxPorMm;
            const topPx = sangria ? 0 : (respRecuo ? padTop + (elem.y_mm || 0) * pxPorMm : (elem.y_mm || 0) * pxPorMm);
            const leftPx = sangria ? 0 : (respRecuo ? padLeft + (elem.x_mm || 0) * pxPorMm : (elem.x_mm || 0) * pxPorMm);
            const wPx = sangria ? folhaW : (respRecuo ? (folhaW - padLeft - padRight) : (elem.largura_mm || 210) * pxPorMm);
            const hPx = sangria ? folhaH : (elem.altura_mm || 140) * pxPorMm;

            const fotoEl = document.createElement('div');
            fotoEl.style.position = 'absolute';
            fotoEl.style.top = `${topPx}px`;
            fotoEl.style.left = `${leftPx}px`;
            fotoEl.style.width = `${wPx}px`;
            fotoEl.style.height = `${hPx}px`;
            fotoEl.style.overflow = 'hidden';
            fotoEl.style.zIndex = elem.camada === 'frente' ? '4' : '0';

            if (elem.url) {
              const img = document.createElement('img');
              img.src = elem.url;
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.objectFit = elem.ajuste || 'cover';
              img.style.opacity = String(elem.opacidade !== undefined ? elem.opacidade : 1);
              fotoEl.appendChild(img);
            } else {
              fotoEl.style.background = 'linear-gradient(135deg, #EEF4FA, #D5E3F0)';
              fotoEl.style.display = 'flex';
              fotoEl.style.flexDirection = 'column';
              fotoEl.style.alignItems = 'center';
              fotoEl.style.justifyContent = 'center';
              fotoEl.style.color = '#314F79';
              fotoEl.style.fontSize = '12px';
              fotoEl.style.fontWeight = '700';
              fotoEl.innerHTML = `<span>🖼 Foto de Capa Livre</span><span style="font-size:10px; opacity:0.8;">${sangria ? 'Sangria Total' : `${elem.largura_mm || 210} × ${elem.altura_mm || 140} mm`}</span>`;
            }
            wrapElemMestra.appendChild(fotoEl);
          } else if (elem.tipo === 'tarja') {
            const altPx = (elem.altura_mm || 8) * pxPorMm;
            const tarjaEl = document.createElement('div');
            tarjaEl.style.position = 'absolute';
            tarjaEl.style.background = elem.cor || '#314F79';
            if (elem.posicao === 'topo') {
              tarjaEl.style.top = '0'; tarjaEl.style.left = '0'; tarjaEl.style.right = '0'; tarjaEl.style.height = `${altPx}px`;
            } else if (elem.posicao === 'base') {
              tarjaEl.style.bottom = '0'; tarjaEl.style.left = '0'; tarjaEl.style.right = '0'; tarjaEl.style.height = `${altPx}px`;
            } else {
              tarjaEl.style.top = '0'; tarjaEl.style.bottom = '0'; tarjaEl.style.left = '0'; tarjaEl.style.width = `${altPx}px`;
            }
            wrapElemMestra.appendChild(tarjaEl);
          } else if (elem.tipo === 'marca_dagua') {
            const marcaEl = document.createElement('div');
            marcaEl.style.position = 'absolute';
            marcaEl.style.top = '50%';
            marcaEl.style.left = '50%';
            marcaEl.style.transform = 'translate(-50%, -50%) rotate(-35deg)';
            marcaEl.style.fontSize = '48px';
            marcaEl.style.fontWeight = '900';
            marcaEl.style.letterSpacing = '8px';
            marcaEl.style.color = elem.cor || '#314F79';
            marcaEl.style.opacity = String(elem.opacidade || 0.12);
            marcaEl.style.textTransform = 'uppercase';
            marcaEl.style.whiteSpace = 'nowrap';
            marcaEl.textContent = elem.texto || 'VERSÃO PRELIMINAR';
            wrapElemMestra.appendChild(marcaEl);
          } else if (elem.tipo === 'rotulo_estatico') {
            const rotEl = document.createElement('div');
            rotEl.style.position = 'absolute';
            rotEl.style.top = `${(elem.y_mm || 12) * pxPorMm}px`;
            rotEl.style.left = `${padLeft}px`;
            rotEl.style.right = `${padRight}px`;
            rotEl.style.textAlign = 'center';
            rotEl.style.fontSize = `${(elem.tamanho_pt || 11) * 1.33}px`;
            rotEl.style.fontWeight = '800';
            rotEl.style.color = elem.cor || '#314F79';
            rotEl.textContent = elem.texto || '';
            wrapElemMestra.appendChild(rotEl);
          } else if (elem.tipo === 'caixa_grade') {
            const molduraEl = document.createElement('div');
            molduraEl.style.position = 'absolute';
            molduraEl.style.border = elem.borda || '1px solid #314F79';
            molduraEl.style.background = elem.fundo || 'rgba(49, 79, 121, 0.04)';
            molduraEl.style.borderRadius = '4px';
            molduraEl.style.padding = '8px';
            molduraEl.style.fontSize = '11px';
            molduraEl.style.fontWeight = '700';
            molduraEl.style.color = elem.cor || '#314F79';
            molduraEl.style.zIndex = elem.camada === 'frente' ? '4' : '0';

            if (elem.posicionamento_modo === 'coordenadas') {
              const sangria = !!elem.sangria;
              const folhaW = dimPag.largura_mm * pxPorMm;
              const folhaH = dimPag.altura_mm * pxPorMm;
              const topPx = sangria ? 0 : (elem.y_mm || 20) * pxPorMm;
              const leftPx = sangria ? 0 : (elem.x_mm || 20) * pxPorMm;
              const wPx = sangria ? folhaW : (elem.largura_mm || 170) * pxPorMm;
              const hPx = sangria ? folhaH : (elem.altura_mm || 50) * pxPorMm;
              molduraEl.style.top = `${topPx}px`;
              molduraEl.style.left = `${leftPx}px`;
              molduraEl.style.width = `${wPx}px`;
              molduraEl.style.height = `${hPx}px`;
            } else {
              const lin = mestraPag.grade_2d?.linhas || 3;
              const col = mestraPag.grade_2d?.colunas || 3;
              const alturaUtil = dimPag.altura_mm * pxPorMm - padTop - padBottom;
              const larguraUtil = dimPag.largura_mm * pxPorMm - padLeft - padRight;
              const cellH = alturaUtil / lin;
              const cellW = larguraUtil / col;
              molduraEl.style.top = `${padTop + ((elem.linha || 1) - 1) * cellH}px`;
              molduraEl.style.left = `${padLeft + ((elem.coluna || 1) - 1) * cellW}px`;
              molduraEl.style.width = `${Math.max(cellW * (elem.spanColunas || 1) - 8, 40)}px`;
              molduraEl.style.height = `${Math.max(cellH * (elem.spanLinhas || 1) - 8, 40)}px`;
            }
            molduraEl.innerHTML = `<span>${elem.titulo || 'Moldura'}</span>`;
            wrapElemMestra.appendChild(molduraEl);
          }
        });

        folha.appendChild(wrapElemMestra);

        // Shift+Ctrl+Clique num elemento herdado da mestra: destrava só nesta página (override)
        folha.addEventListener('click', (ev) => {
          if (!(ev.ctrlKey && ev.shiftKey)) return;
          const r = folha.getBoundingClientRect();
          const mx = (ev.clientX - r.left) / (r.width / dimPag.largura_mm);
          const my = (ev.clientY - r.top) / (r.height / dimPag.altura_mm);
          const topo = elementosEfetivosDaPagina(mestraPag, pag).filter(e => renderizadoPeloCanvas(e) && e.tipo !== 'quadro_texto').reverse().find(e => {
            const c = caixaEnvolvente(e);
            return mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h;
          });
          if (!topo) return;
          ev.preventDefault(); ev.stopPropagation();
          this.abrirOverrideMestra(pag, mestraPag, mestraPag.elementos_recorrentes.find(e => e.id === topo.id), ev);
        }, true);
      }

      // Grade de 12 Colunas (se ativada na barra)
      if (this.guiasVisiveis) {
        const gradeOverlay = document.createElement('div');
        gradeOverlay.className = 'ath-folha-grade-12';
        gradeOverlay.style.inset = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
        for (let i = 0; i < 12; i++) {
          const colEl = document.createElement('div');
          colEl.className = 'ath-col-guia';
          gradeOverlay.appendChild(colEl);
        }
        folha.appendChild(gradeOverlay);
      }

      // Área Útil de Conteúdo
      const areaUtil = document.createElement('div');
      areaUtil.className = 'ath-folha-area-util';

      // Cabeçalho em 3 zonas, posicionado na margem superior (distância da borda configurável)
      if (areasPag.cabecalho) {
        const cab = construirAreaPaginaDom(areasPag.cabecalho);
        cab.style.top = `${areasPag.cabecalho.distancia_borda_mm * pxPorMm}px`;
        cab.style.left = `${padLeft}px`;
        cab.style.right = `${padRight}px`;
        folha.appendChild(cab);
      }

      // Container dos Blocos na folha (Grid de 12 Colunas)
      const gradeBlocos = document.createElement('div');
      gradeBlocos.style.display = 'grid';
      gradeBlocos.style.gridTemplateColumns = 'repeat(12, 1fr)';
      gradeBlocos.style.gap = '0 12px'; // o espaço vertical vem dos estilos (igual ao PDF); antes havia 10px extras entre os blocos
      gradeBlocos.style.alignContent = 'start';

      const estilosPorId = Object.fromEntries((this.doc.estilos || []).map(e => [e.id, e]));
      (pag.blocos || []).forEach((b, k, todos) => {
        const blocoEl = this.renderizarBlocoNaFolha(b, pag);
        const colapso = k > 0 ? colapsoEntreBlocosPt(todos[k - 1], b, estilosPorId) : (margensTextoPt(b, estilosPorId)?.antes || 0); // entre parágrafos vale o maior espaço; no topo da página, nenhum
        if (colapso) blocoEl.style.marginTop = `${Math.max(0, (margensTextoPt(b, estilosPorId)?.antes || 0) - colapso)}pt`;
        gradeBlocos.appendChild(blocoEl);
      });

      areaUtil.appendChild(gradeBlocos);

      // Notas de rodapé desta página (na base do corpo, acima do rodapé)
      const notasEl = construirNotasDom(pag, this.doc, {
        editavel: !modoSomenteLeitura(this.modoTrabalho),
        aoSalvar: (id, html) => this.salvarNotaRodape(id, html)
      });
      if (notasEl) areaUtil.appendChild(notasEl);

      // Rodapé em 3 zonas na margem inferior (distância da borda configurável)
      if (areasPag.rodape) {
        const rod = construirAreaPaginaDom(areasPag.rodape);
        rod.style.bottom = `${areasPag.rodape.distancia_borda_mm * pxPorMm}px`;
        rod.style.left = `${padLeft}px`;
        rod.style.right = `${padRight}px`;
        folha.appendChild(rod);
      }

      folha.appendChild(areaUtil);
      if (this.zoomCanvas && this.zoomCanvas !== 1) {
        folha.style.zoom = String(this.zoomCanvas);
        folha.style.transformOrigin = 'top center';
      }
      palco.appendChild(folha);
      } catch (erro) {
        const aviso = document.createElement('div');
        aviso.className = 'rm-vazio-cartao';
        aviso.textContent = 'Não foi possível desenhar a página ' + pag.numero + ': ' + erro.message;
        palco.appendChild(aviso);
      }
    });
    if (scrollTopSalvo > 0) palco.scrollTop = scrollTopSalvo;
    if (scrollLeftSalvo > 0) palco.scrollLeft = scrollLeftSalvo;
    this.semanticaUI?.sincronizarOverlayCss();
    this.semanticaUI?.instalarPincelNoPalco(palco);
    this.semanticaUI?.instalarHoverBadge(palco);
  }

  construirBarraRapidaDoBloco(b, pag) {
    const barra = document.createElement('div');
    barra.className = 'ath-bloco-barra-rapida';
    barra.addEventListener('click', e => e.stopPropagation());

    const ehTexto = b.tipo === 'titulo' || b.tipo === 'subtitulo' || b.tipo === 'paragrafo' || b.tipo === 'texto' || b.tipo === 'citacao';
    const ehFigura = b.tipo === 'figura' || b.tipo === 'imagem';

    if (ehTexto) {
      // 1. Dropdown elegante de estilos diretamente na folha
      const selEst = document.createElement('select');
      selEst.className = 'ath-sel-rapido';
      selEst.title = 'Estilo tipográfico deste bloco';
      const estilos = this.doc.estilos || [];
      selEst.innerHTML = estilos.map(e => `<option value="${e.id}" ${(b.estiloId || 'corpo') === e.id ? 'selected' : ''}>${e.nome}</option>`).join('');
      selEst.addEventListener('change', e => {
        b.estiloId = e.target.value;
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(selEst);

      // (hifenização, como o resto da tipografia, é propriedade do estilo: nada de interruptor local no bloco)

      // 3. Botão para abrir edição de estilo diretamente
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'ath-btn-rapido';
      btnEdit.title = 'Editar propriedades deste estilo';
      btnEdit.innerHTML = `${svgIcone('lapis', 12)} <span style="font-weight:700; white-space:nowrap;">Editar</span>`;
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        const est = (this.doc.estilos || []).find(e => e.id === b.estiloId) || this.doc.estilos?.[0];
        if (est) {
          this.selecionarBloco(b, pag);
          new ModalEditorEstilo(this.doc, est, {
            onSalvar: () => {
              this.notificarMudanca();
              this.renderizar();
            }
          });
        }
      });
      barra.appendChild(btnEdit);
    } else if (ehFigura) {
      // 1. Dropdown de Rótulo / Subtipo da Ilustração
      const selSub = document.createElement('select');
      selSub.className = 'ath-sel-rapido';
      selSub.title = 'Rótulo da ilustração';
      const subtipos = [
        { id: 'figura', nome: 'Figura' },
        { id: 'grafico', nome: 'Gráfico' },
        { id: 'fotografia', nome: 'Foto' },
        { id: 'diagrama', nome: 'Diagrama' },
        { id: 'fluxograma', nome: 'Fluxo' },
        { id: 'esquema', nome: 'Esquema' },
        { id: 'quadro', nome: 'Quadro' },
        { id: 'croqui', nome: 'Croqui' },
        { id: 'desenho', nome: 'Desenho' },
        { id: 'ilustracao', nome: 'Ilustração' }
      ];
      selSub.innerHTML = subtipos.map(s => `<option value="${s.id}" ${(b.subtipo || 'figura') === s.id ? 'selected' : ''}>${s.nome}</option>`).join('');
      selSub.addEventListener('change', e => {
        b.subtipo = e.target.value;
        b.semanticRole = papelDoSubtipo(b.subtipo); // o subtipo escolhido manda (Foto/Fluxo/… seguem na mesma categoria)
        (b.itens || []).forEach(it => { if (it) it.semanticRole = b.semanticRole; });
        b.titulo = obterTituloCompletoComNumeracao(b);
        this.notificarMudanca();
        this.renderizar();
      });
      barra.appendChild(selSub);

      // 2. Dropdown de Layout de Imagens
      // Disposição das imagens: botão com o ícone do layout atual + grade de layouts
      barra.appendChild(criarBotaoLayoutFigura(b, () => {
        this.notificarMudanca();
        this.renderizar();
      }));

      // 3. Dropdown de Modelos de Apresentação
      const modelosFig = obterModelosLayoutBloco(b.tipo, this.doc);
      if (modelosFig && modelosFig.length > 0) {
        const selMod = document.createElement('select');
        selMod.className = 'ath-sel-rapido';
        selMod.title = 'Modelos de Apresentação';
        const modAtivo = b.modelo_layout_id || (b.moldura_tipo === 'cartao_suave' ? 'figura_cartao' : (b.subgrade_colunas === 2 ? 'figura_legenda_lateral' : 'figura_abnt'));
        selMod.innerHTML = modelosFig.map(m => {
          const rotulo = m.nome.replace(' (Limpo)', '').replace(' com Fundo', '').replace(' (Legenda ao Lado)', '');
          return `<option value="${escapeHtml(m.id)}" ${modAtivo === m.id ? 'selected' : ''}>${escapeHtml(rotulo)}</option>`;
        }).join('');
        selMod.addEventListener('change', e => {
          aplicarModeloLayoutBloco(b, e.target.value, this.doc);
          this.notificarMudanca();
          this.renderizar();
        });
        barra.appendChild(selMod);
      }

      // 4. Botão de edição avançada (Abre ModalLayoutBloco)
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'ath-btn-rapido';
      btnEdit.title = 'Editar moldura, slots de imagem e apresentação';
      btnEdit.innerHTML = `${svgIcone('lapis', 12)} <span style="font-weight:700; white-space:nowrap;">Editar</span>`;
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selecionarBloco(b, pag);
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.renderizar();
          }
        });
      });
      barra.appendChild(btnEdit);
    } else {
      // Outros blocos compostos (Tabela, Quadro, Mapa, Fórmula)
      const crachaTxt = document.createElement('span');
      crachaTxt.style.fontSize = '11px';
      crachaTxt.style.fontWeight = '800';
      crachaTxt.style.color = '#314F79';
      crachaTxt.textContent = (TIPO_ROTULO[b.tipo] || b.tipo).toUpperCase();
      barra.appendChild(crachaTxt);

      const modelosBloco = obterModelosLayoutBloco(b.tipo, this.doc);
      if (modelosBloco && modelosBloco.length > 0) {
        const selMod = document.createElement('select');
        selMod.className = 'ath-sel-rapido';
        selMod.title = 'Modelos de Apresentação';
        const modAtivo = b.modelo_layout_id || (b.moldura_tipo === 'cartao_suave' ? (b.tipo === 'formula' ? 'formula_cartao' : 'tabela_cartao') : (b.tipo === 'formula' ? 'formula_limpo' : 'tabela_abnt'));
        selMod.innerHTML = modelosBloco.map(m => {
          const rotulo = m.nome.replace(' (Limpo)', '').replace(' com Fundo', '').replace(' (Legenda ao Lado)', '');
          return `<option value="${escapeHtml(m.id)}" ${modAtivo === m.id ? 'selected' : ''}>${escapeHtml(rotulo)}</option>`;
        }).join('');
        selMod.addEventListener('change', e => {
          aplicarModeloLayoutBloco(b, e.target.value, this.doc);
          this.notificarMudanca();
          this.renderizar();
        });
        barra.appendChild(selMod);
      }

      if (b.tipo === 'tabela' || b.tipo === 'quadro') {
        const btnEstilo = document.createElement('button');
        btnEstilo.type = 'button';
        btnEstilo.className = 'ath-btn-rapido';
        btnEstilo.dataset.athPopTabToggle = '1';
        btnEstilo.title = 'Bordas, preenchimento, zebra e alinhamento das células';
        btnEstilo.innerHTML = `${svgIcone('grade', 12)} <span style="font-weight:700; white-space:nowrap;">Estilo</span>`;
        btnEstilo.addEventListener('click', (e) => {
          e.stopPropagation();
          abrirPopoverEstiloTabela({
            bloco: b,
            ancora: btnEstilo,
            obterTabela: () => this.container.querySelector(`table[data-bloco-id="${b.id}"]`),
            obterSelecao: () => this._selTabelas.get(b.id) || null,
            aoAlterar: () => this.notificarMudancaRapida(),
            aoReconstruir: () => { this.notificarMudanca(); this.renderizar(); }
          });
        });
        barra.appendChild(btnEstilo);
      }

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'ath-btn-rapido';
      btnEdit.title = 'Editar propriedades e apresentação';
      btnEdit.innerHTML = `${svgIcone('lapis', 12)} <span style="font-weight:700; white-space:nowrap;">Editar</span>`;
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selecionarBloco(b, pag);
        new ModalLayoutBloco(this.doc, b, {
          onSalvar: () => {
            this.notificarMudanca();
            this.renderizar();
          }
        });
      });
      barra.appendChild(btnEdit);
    }

    return barra;
  }

  pintarDiagramaMargens() {
    const mestra = this.obterMestraAtiva();
    const m = mestra.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
    const paisagem = mestra.orientacao === 'paisagem';
    const { largura_mm: W, altura_mm: H } = dimensoesPapelMm(mestra.formato, mestra.orientacao, mestra.dimensoes_personalizadas);

    const diag = this.container.querySelector('#rmMDiag');
    if (!diag) return;
    const folhaMini = diag.parentElement;
    folhaMini.style.aspectRatio = `${W} / ${H}`;
    diag.style.inset = `${(m.t / H) * 100}% ${(m.r / W) * 100}% ${(m.b / H) * 100}% ${(m.l / W) * 100}%`;
  }

  criarSugestaoInterativaNoBloco() {
    const b = this.blocoSelecionado || this.obterSecaoAtiva()?.blocos?.find(x => x.tipo === 'paragrafo');
    if (!b) return;
    const sel = window.getSelection();
    const textoOriginal = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
    const textoNovo = window.prompt
      ? window.prompt('Digite o texto sugerido pelo revisor/professor:', 'Revisão sugerida pelo orientador')
      : 'Revisão sugerida pelo orientador';
    if (textoNovo === null) return;

    const sug = registrarSugestao(this.doc, {
      blocoId: b.id,
      tipo: textoOriginal ? 'substituicao' : 'insercao',
      textoOriginal,
      textoNovo,
      autor: this.perfilColaborador.nome || 'Prof. Orientador',
      corAutor: this.perfilColaborador.cor
    });

    const htmlMark = gerarHtmlMarcacaoSugestao(sug);
    if (textoOriginal && String(b.texto || '').includes(textoOriginal)) {
      b.texto = String(b.texto).replace(textoOriginal, htmlMark);
    } else {
      b.texto = `${b.texto || ''} ${htmlMark}`.trim();
    }

    this.sessaoRealtime?.transmitirAtualizacaoBloco(b);
    this.notificarMudanca();
    this.renderizar();
  }

  abrirPainelZotero() {
    if (typeof this.onAbrirZotero === 'function') {
      this.onAbrirZotero();
    }
  }

  /** Insere a citação no cursor. `opcoes`: { estilo, linkar, pagina, textoPronto } (ver athenes_citacao.js). */
  inserirCitacaoNoCursor(ref, formato = 'parentese', opcoes = {}) {
    if (!ref) return;

    // Garante que a referência bibliográfica seja incluída na lista do documento
    if (!this.doc.referencias) this.doc.referencias = [];
    if (!this.doc.referencias.some(r => (r.id && r.id === ref.id) || (r.chaveZotero && r.chaveZotero === ref.chaveZotero))) {
      this.doc.referencias.push(ref);
    }

    const { html } = montarCitacao(ref, { estilo: 'abnt', ...opcoes, formato, indice: indiceNaLista(this.doc, ref) });
    const tagHtml = ` ${html}`;

    let inserido = false;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const comum = range.commonAncestorContainer;
      const elPai = comum?.nodeType === Node.ELEMENT_NODE ? comum : comum?.parentElement;
      const editable = elPai?.closest('.ath-texto-editable, .ath-titulo-editable, [contenteditable="true"]');
      if (editable) {
        try {
          if (typeof document !== 'undefined' && document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, tagHtml);
            inserido = true;
          } else {
            range.deleteContents();
            const molde = document.createElement('template');
            molde.innerHTML = tagHtml;
            const node = molde.content.cloneNode(true);
            const ultimo = node.lastChild;
            range.insertNode(node);
            if (ultimo) range.setStartAfter(ultimo);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            inserido = true;
          }
          if (this.blocoSelecionado) {
            this.blocoSelecionado.texto = editable.innerHTML;
          }
        } catch (_) {}
      }
    }

    if (!inserido && this.blocoSelecionado && this.blocoSelecionado.texto !== undefined) {
      this.blocoSelecionado.texto += tagHtml;
    }

    this.notificarMudanca();
    this.renderizarFolhasPaginas();
  }

  /** Trechos de estilo cadastrado (`.ath-estilo-span`): o CSS vem SEMPRE do estilo atual, então editar o estilo reflete na hora. */
  comEstilosDeTrecho(html) {
    return aplicarEstilosDeTrecho(html, this.doc.estilos || [], (e) => (FONTES_SISTEMA[e.fonte] || FONTES_SISTEMA.nunito).familia || 'sans-serif');
  }

  /** Estilo de texto do bloco (título: o do nível). */
  estiloDoBloco(b) {
    const porId = Object.fromEntries((this.doc.estilos || []).map(e => [e.id, e]));
    return (b?.tipo === 'titulo' ? porId[estiloIdDoTitulo(porId, b)] : porId[b?.estiloId]) || {};
  }

  /** Insere uma citação direta longa (bloco recuado, fonte menor) depois do bloco selecionado. */
  inserirCitacaoLonga(ref, { texto, pagina = '', refTexto, linkar = true } = {}) {
    if (!ref || !String(texto || '').trim()) return null;
    if (modoSomenteLeitura(this.modoTrabalho)) {
      alert('O documento está em um modo somente leitura (Leitura ou Comparar). Mude para Edição ou Sugestão no topo para inserir blocos.');
      return null;
    }
    const sec = this.obterSecaoAtiva();
    if (!sec) return null;
    if (!this.doc.referencias) this.doc.referencias = [];
    if (!this.doc.referencias.some(r => (r.id && r.id === ref.id) || (r.chaveZotero && r.chaveZotero === ref.chaveZotero))) this.doc.referencias.push(ref);
    const sobrenome = ref.autores?.[0]?.sobrenome || ref.autor || 'AUTOR';
    const html = escapeHtml(String(texto).trim()).replace(/\s*[\r\n]+\s*/g, ' ');
    const b = criarNovoBloco('citacao', { texto: html, autor: String(sobrenome).toUpperCase(), ano: ref.ano, pagina_citada: pagina, ref_texto: refTexto, ref_id: ref.id, ref_linkar: linkar });
    const idxSel = this.blocoSelecionado ? (sec.blocos || []).findIndex(x => x.id === this.blocoSelecionado.id) : -1;
    if (idxSel >= 0) { sec.blocos.splice(idxSel + 1, 0, b); repaginarDocumento(this.doc); }
    else adicionarBlocoNaSecao(this.doc, sec.id, b);
    this.blocoSelecionado = b;
    this.notificarMudanca();
    this.renderizar();
    this.onSelecionarBloco(b, null);
    return b;
  }

  notificarMudanca() {
    this.salvarSnapshot();
    this.onAlterado(this.doc);
  }

  notificarMudancaRapida() {
    this.agendarSnapshot();
    this.atualizarSumariosAoVivo();
    this.onAlterado(this.doc);
  }

  /** Assinatura da paginação: blocos por página e onde cada fragmento de texto termina (muda quando o texto passa para outra página). */
  assinaturaPaginacao() {
    return (this.doc.paginas || []).map(p => (p.blocos || []).map(b => `${b.id}:${b._frag ? `${b._frag.indice}/${b._frag.total}:${String(b.texto || '').length}` : ''}`).join(',')).join('|');
  }

  /**
   * Ao digitar, o texto pode crescer e passar para a página seguinte (ou voltar). Depois de uma pausa curta a paginação é
   * recalculada e, só se a divisão mudou, as folhas são redesenhadas mantendo o cursor e a rolagem onde estavam.
   */
  agendarRepaginacao() {
    clearTimeout(this._tRepag);
    this._tRepag = setTimeout(() => this.repaginarAoDigitar(), 350);
  }

  repaginarAoDigitar() {
    if (!this.container || modoSomenteLeitura(this.modoTrabalho)) return;
    repaginarDocumento(this.doc);
    if (this._sigPaginas === this.assinaturaPaginacao()) return;
    const palco = this.container.querySelector('#rmPrevPalco');
    const rolagem = palco?.scrollTop || 0;
    const cursor = this.guardarCursorNoBloco();
    this.renderizarFolhasPaginas();
    if (palco) palco.scrollTop = rolagem;
    this.restaurarCursorNoBloco(cursor);
  }

  /** Linhas realmente desenhadas num texto (agrupa os retângulos dos trechos pela posição vertical). */
  contarLinhasReais(el) {
    const tops = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.data.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) if (q.height > 0) tops.push({ t: q.top, h: q.height });
    }
    tops.sort((a, b) => a.t - b.t);
    let linhas = 0; let ultimo = -Infinity;
    for (const q of tops) { if (q.t - ultimo > q.h * 0.6) { linhas++; ultimo = q.t; } }
    return linhas;
  }

  agendarCalibracao() {
    clearTimeout(this._tCalib);
    this._tCalib = setTimeout(async () => {
      try { await document.fonts?.ready; } catch (_) {}
      this.calibrarTextoPelaTela();
    }, 150);
  }

  /**
   * A paginação ESTIMA as linhas de cada parágrafo; aqui elas são MEDIDAS na tela e o erro volta para a paginação:
   * - blocos inteiros: razão entre linhas reais e estimadas;
   * - texto dividido entre páginas: se a folha transbordou (ou sobrou espaço) no fim do trecho, o trecho encolhe (ou cresce).
   * Se algo mudou, a divisão é refeita (no máximo 8 vezes seguidas), com o cursor e a rolagem mantidos.
   */
  calibrarTextoPelaTela() {
    if (!this.container || modoSomenteLeitura(this.modoTrabalho)) return;
    const blocosPag = (this.doc.paginas || []).flatMap(p => p.blocos || []);
    const dividido = new Set(blocosPag.filter(x => x._frag).map(x => x._frag.origemId));
    const porBloco = new Map();
    const achar = (folha) => blocosPag.find(x => x.id === folha.dataset.blocoId && (x._frag ? String(x._frag.indice) === (folha.dataset.fragmento ?? '') : true));
    this.container.querySelectorAll('.ath-folha-area-util .ath-bloco-folha').forEach(folha => {
      const el = folha.querySelector('.ath-texto-editable');
      const id = folha.dataset.blocoId;
      if (!el || !id || dividido.has(id)) return; // texto dividido: calibrado pelo transbordo/sobra da folha (abaixo)
      const b = achar(folha);
      if (!b || !['paragrafo', 'citacao', 'texto'].includes(b.tipo)) return;
      const reais = this.contarLinhasReais(el);
      const porLinha = porLinhaUsadoNoTexto(id);
      if (!reais || !porLinha) return;
      const acc = porBloco.get(id) || { reais: 0, est: 0, textos: [], porLinha };
      acc.reais += reais;
      acc.est += linhasEstimadas(b.texto, porLinha);
      acc.textos.push(b.texto);
      porBloco.set(id, acc);
    });
    let mudou = false;
    for (const [id, a] of porBloco) {
      if (!a.est) continue;
      const atual = calibracaoDoTexto(id);
      let novo = Math.min(2, Math.max(0.5, atual * a.reais / a.est));
      // a razão média pode ainda estimar UMA linha a menos (arredondamento): ajusta até a contagem bater com a real, senão o último parágrafo da página invade a margem
      const linhasCom = (k) => a.textos.reduce((t, tx) => t + linhasEstimadas(tx, Math.max(6, Math.floor(a.porLinha * atual / k))), 0);
      for (let i = 0; i < 40 && linhasCom(novo) < a.reais && novo < 2; i++) novo *= 1.01;
      for (let i = 0; i < 40 && linhasCom(novo) > a.reais && novo > 0.5; i++) novo /= 1.01;
      if (linhasCom(novo) !== a.est || Math.abs(novo - atual) / atual > 0.04) { if (Math.abs(novo - atual) / atual > 0.002) { definirCalibracaoTexto(id, novo); mudou = true; } }
    }
    // blocos que não são texto (figura, tabela, fórmula…): a altura REAL da folha substitui a estimativa da paginação
    this.container.querySelectorAll('.ath-folha-area-util').forEach(area => {
      const folha = area.parentElement;
      const grade = area.firstElementChild;
      if (!grade) return;
      const k = folha.getBoundingClientRect().width / ((Number(folha.dataset.largMm) || 210) * 3.7795) || 1;
      const itens = [...grade.children].filter(el => el.classList?.contains('ath-bloco-folha'));
      itens.forEach(el => { el.style.alignSelf = 'start'; }); // sem isso o bloco estica até a altura da linha (o vizinho do grupo)
      // a altura que a paginação soma inclui o espaço antes/depois do bloco, que fica fora do retângulo
      const medidas = itens.map(el => { const cs = getComputedStyle(el); return [el, el.getBoundingClientRect().height / k * 0.75 + (parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)) * 0.75]; });
      itens.forEach(el => { el.style.alignSelf = ''; });
      for (const [el, pt] of medidas) {
        const b = achar(el);
        if (!b || b._frag || el.classList.contains('sel') || !TIPOS_COM_ALTURA_MEDIDA.has(b.tipo)) continue; // o selecionado tem a barra rápida no fluxo
        if (definirAlturaMedida(b, pt)) mudou = true;
      }
    });
    // texto dividido: compara o fim do trecho com o limite real da folha
    this.container.querySelectorAll('.ath-folha-area-util').forEach(area => {
      const folhaA4 = area.parentElement;
      const blocos = [...(area.firstElementChild?.children || [])];
      const ultimo = blocos[blocos.length - 1];
      const b = ultimo && achar(ultimo);
      const el = ultimo?.querySelector('.ath-texto-editable');
      if (!b?._frag?.continuaNaProxima || !el) return;
      const f = folhaA4.getBoundingClientRect();
      const nominal = f.width * ((Number(folhaA4.dataset.altMm) || 297) / (Number(folhaA4.dataset.largMm) || 210));
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
      const transbordo = f.height - nominal;
      const sobra = transbordo > 1 ? 0 : area.getBoundingClientRect().bottom - ultimo.getBoundingClientRect().bottom;
      const n = this.contarLinhasReais(el);
      if (!n) return;
      let delta = 0;
      if (transbordo > 1) delta = -Math.ceil(transbordo / lh);
      else if (sobra > lh * 2.5) delta = Math.floor(sobra / lh) - 1;
      if (!delta) return;
      const id = b._frag.origemId;
      const atual = calibracaoDoTexto(id);
      definirCalibracaoTexto(id, atual * n / Math.max(2, n + delta));
      mudou = true;
    });
    if (!mudou) { this._calibN = 0; return; }
    if ((this._calibN = (this._calibN || 0) + 1) > 8) { this._calibN = 0; return; }
    repaginarDocumento(this.doc);
    if (this._sigPaginas === this.assinaturaPaginacao()) return;
    const palco = this.container.querySelector('#rmPrevPalco');
    const rolagem = palco?.scrollTop || 0;
    const cursor = this.guardarCursorNoBloco();
    this.renderizarFolhasPaginas();
    if (palco) palco.scrollTop = rolagem;
    this.restaurarCursorNoBloco(cursor);
  }

  /** Posição do cursor como (bloco, nº de caracteres desde o início do bloco inteiro, somando os fragmentos anteriores). */
  guardarCursorNoBloco() {
    const sel = window.getSelection();
    const no = sel?.anchorNode;
    const el = (no?.nodeType === 3 ? no.parentElement : no)?.closest?.('.ath-texto-editable, .ath-titulo-editable');
    const folha = el?.closest('.ath-bloco-folha');
    if (!el || !folha || !this.container.contains(el)) return null;
    const id = folha.dataset.blocoId;
    const irmaos = [...this.container.querySelectorAll(`.ath-bloco-folha[data-bloco-id="${id}"]`)];
    let antes = 0;
    for (const f of irmaos) {
      if (f === folha) break;
      antes += (f.querySelector('.ath-texto-editable, .ath-titulo-editable')?.textContent || '').length;
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(sel.anchorNode, sel.anchorOffset);
    return { id, pos: antes + r.toString().length };
  }

  restaurarCursorNoBloco(cursor) {
    if (!cursor) return;
    const editaveis = [...this.container.querySelectorAll(`.ath-bloco-folha[data-bloco-id="${cursor.id}"] .ath-texto-editable, .ath-bloco-folha[data-bloco-id="${cursor.id}"] .ath-titulo-editable`)];
    let resta = cursor.pos;
    for (let i = 0; i < editaveis.length; i++) {
      const el = editaveis[i];
      const tam = (el.textContent || '').length;
      if (resta > tam && i < editaveis.length - 1) { resta -= tam; continue; }
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n; let alvo = null; let off = 0;
      while ((n = w.nextNode())) {
        if (resta <= n.data.length) { alvo = n; off = resta; break; }
        resta -= n.data.length;
        alvo = n; off = n.data.length;
      }
      try {
        el.focus({ preventScroll: true });
        const sel = window.getSelection();
        const r = document.createRange();
        if (alvo) { r.setStart(alvo, off); } else { r.selectNodeContents(el); }
        r.collapse(alvo ? true : false);
        sel.removeAllRanges();
        sel.addRange(r);
      } catch (_) {}
      return;
    }
  }

  agendarSnapshot() {
    clearTimeout(this._tSnap);
    this._tSnap = setTimeout(() => this.salvarSnapshot(), 700);
  }

  /** Chamado pelo inspetor: estrutural = mudou linha/posição (atualiza páginas e coluna esquerda preservando o inspetor e a rolagem). */
  aposAlteracaoExterna(estrutural) {
    repaginarDocumento(this.doc);
    if (estrutural) {
      this.salvarSnapshot();
      const esq = this.container?.querySelector('#rmColEsq');
      if (esq) {
        const stEsq = esq.scrollTop;
        const stCards = Array.from(esq.querySelectorAll('.rm-card-meio-a-meio-corpo')).map(el => el.scrollTop);
        this.renderizarColunaEsquerda(esq);
        esq.scrollTop = stEsq;
        const novosCards = esq.querySelectorAll('.rm-card-meio-a-meio-corpo');
        stCards.forEach((st, i) => { if (novosCards[i]) novosCards[i].scrollTop = st; });
      }
      this.renderizarFolhasPaginas();
      this.pintarDiagramaMargens();
    } else {
      this.renderizarFolhasPaginas();
      this.agendarSnapshot();
    }
  }
  /** `marc` ({ cfg, numero }, de mapaMarcadores) traz a configuração efetiva (estilo + bloco) e o número da numeração corrida. */
  aplicarConfigListaNoBloco(containerEditable, b, marc = null) {
    if (!containerEditable || !b) return;
    const listas = containerEditable.querySelectorAll('ul, ol');
    if (!listas.length) return;

    const cfg = marc?.cfg;
    const nivel = cfg?.nivel ?? 1;
    const tabMm = cfg?.tabMm ?? 7;
    const indentMm = (nivel - 1) * 6;
    const align = cfg?.alinhamento ?? 'left';
    const inicio = marc?.numero ?? 1;

    listas.forEach(lista => {
      const local = false; // o marcador é sempre do estilo (nada de lista local por linha)
      lista.classList.add('ath-lista-config');
      lista.style.setProperty('--ath-list-tab', `${tabMm}mm`);
      lista.style.setProperty('--ath-list-indent', `${indentMm}mm`);
      lista.style.setProperty('--ath-list-align', align);
      lista.style.setProperty('--ath-list-counter-start', String(local ? 0 : inicio - 1));
      if (local) return;

      if (lista.tagName.toLowerCase() === 'ol') {
        lista.dataset.numEstilo = cfg?.estiloNum ?? 'decimal';
        lista.dataset.numSep = cfg?.separador ?? 'ponto';
      } else {
        const tipoMarc = (cfg && cfg.tipo !== 'numero') ? cfg.tipo
          : lista.classList.contains('ath-lista-alinea') ? 'traco'
          : lista.classList.contains('ath-lista-ponto-traco') ? 'ponto_traco'
          : lista.classList.contains('ath-lista-quadrado') ? 'quadrado'
          : 'circulo';
        lista.dataset.marcador = tipoMarc;
        if (tipoMarc === 'simbolo') lista.querySelectorAll(':scope > li').forEach(li => { li.dataset.simbolo = cfg?.simbolo || '•'; }); // o CSS mostra o símbolo escolhido
      }
    });
  }

  /* ==========================================================================
     APLICAR ESTILO DE TEXTO NA PARTE SELECIONADA OU NO BLOCO INTEIRO
     ========================================================================== */
  /* ==========================================================================
     ABRIR CENTRAL DE ESTILOS & IDENTIDADE VISUAL (IMPORTAR / EXPORTAR / IA)
     ========================================================================== */
  abrirModalCentralEstilos(abaInicial = 'exportar') {
    new ModalCentralEstilos(this.doc, this, {
      abaInicial,
      onSucesso: () => {
        this.notificarMudanca();
        this.renderizar();
        if (this.onAlterado) this.onAlterado(this.doc);
      }
    });
  }
}

Object.assign(EditorView.prototype, metodosBarraContextual, metodosMenusTopo, metodosBlocoNaFolha);
