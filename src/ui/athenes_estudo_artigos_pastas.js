// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Navegação por Pastas Estilo Cronos, Breadcrumb e Faixa de Coleções.
 * Requisito R2 (Milestone 2): cards com aba superior esquerda, contraste WCAG AA,
 * persistência em sessionStorage e modais de gerenciamento.
 *
 * Módulo puro: Vanilla ES Modules sem dependências externas.
 */

import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { moverArquivosDoArtigoNoDrive } from '../core/athenes_drive_sync.js';
import {
  obterPastasDriveLocais,
  salvarPastasDriveLocais,
  adicionarSubpastaDriveLocal,
  removerPastaDriveLocal,
  buscarPastaNaArvore
} from '../core/athenes_colaboracao.js';
import { RAIZ_BIBLIOGRAFIA, artigoEstaNaPasta } from '../core/athenes_zotero_pastas.js';
import { mostrarAviso } from './athenes_aviso.js';
import {
  normalizarHexCor,
  calcularLuminanciaRelativa,
  calcularRazaoContraste,
  obterCorTextoAcessivel,
  calcularCoresPasta,
  calcularContadoresPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas
} from '../core/athenes_referencias.js';
import { salvarArtigosEstudo } from './athenes_estudo_artigos_dados.js';

export const STORAGE_KEY_BIB_PASTA_ATIVA = 'athenes_bib_pasta_ativa';
export const STORAGE_KEY_DASH_PASTA = 'athenes_dash_pasta';

/**
 * Paleta de cores recomendadas para pastas acadêmicas e de bibliografia
 */
export const CORES_PASTAS_CRONOS = Object.freeze([
  '#314F79', // Azul Athenes (Padrão)
  '#FF6B2C', // Laranja Cronos / Editorial
  '#0D9488', // Verde Acácia
  '#7C3AED', // Roxo Imperial
  '#B45309', // Âmbar Acadêmico
  '#475569', // Grafite Neutro
  '#0284C7', // Azul Céu
  '#DC2626'  // Carmim / Alerta
]);

const NOMES_CORES_PASTAS = Object.freeze([
  'Azul Athenes', 'Laranja', 'Verde', 'Roxo',
  'Âmbar', 'Grafite', 'Azul céu', 'Vermelho'
]);

export {
  normalizarHexCor,
  calcularLuminanciaRelativa,
  calcularRazaoContraste,
  obterCorTextoAcessivel,
  calcularCoresPasta,
  calcularContadoresPastas,
  filtrarReferenciasPorPasta,
  moverReferenciaEntrePastas
};

/**
 * Coleta todas as pastas de bibliografia em lista plana a partir da árvore local
 * @param {Array<object>} pastasRaiz
 * @returns {Array<object>}
 */
export function coletarPastasBibliografia(pastasRaiz = obterPastasDriveLocais()) {
  const lista = [];
  const raizBib = (pastasRaiz || []).find(p => p && (p.id === RAIZ_BIBLIOGRAFIA || p.tipo === 'bibliografia'));

  if (raizBib) {
    lista.push(raizBib);
    const coletarFilhas = (pai) => {
      for (const f of (pai.subpastas || [])) {
        if (!f) continue;
        lista.push(f);
        if (f.subpastas?.length) coletarFilhas(f);
      }
    };
    coletarFilhas(raizBib);
  }

  // Adiciona também pastas compartilhadas de bibliografia
  for (const p of (pastasRaiz || [])) {
    if (!p) continue;
    if (p.origem === 'compartilhada' && (p.tipo === 'bibliografia' || p.tipo === 'compartilhada')) {
      if (!lista.some(item => item.id === p.id)) {
        lista.push(p);
      }
    }
  }

  return lista;
}

/**
 * Recupera e valida a pasta ativa persistida no sessionStorage com fallback seguro para 'todas'
 * @param {object} opcoes
 * @returns {string}
 */
export function restaurarPastaAtiva({ pastas = [], storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null) } = {}) {
  let salvo = null;
  try {
    salvo = storage?.getItem(STORAGE_KEY_BIB_PASTA_ATIVA);
  } catch (_) {}

  if (!salvo) {
    try {
      salvo = storage?.getItem(STORAGE_KEY_DASH_PASTA);
    } catch (_) {}
  }

  if (!salvo || salvo === 'todas') {
    return 'todas';
  }

  const existe = salvo === RAIZ_BIBLIOGRAFIA || (Array.isArray(pastas) && pastas.some(p => p && p.id === salvo));
  if (existe) {
    return salvo;
  }

  try {
    storage?.setItem(STORAGE_KEY_BIB_PASTA_ATIVA, 'todas');
  } catch (_) {}
  return 'todas';
}

/**
 * Seleciona a pasta ativa, atualiza sessionStorage e o breadcrumb.
 * @param {string} pastaId
 * @param {object} opcoes
 * @returns {string} id da pasta selecionada
 */
export function selecionarPasta(pastaId, { pastas = [], storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null), breadcrumbEl = null, onSelect = null } = {}) {
  const idAlvo = (pastaId && typeof pastaId === 'string') ? pastaId.trim() : 'todas';
  const alvo = (idAlvo === 'todas')
    ? { id: 'todas', nome: 'Estante Geral' }
    : ((Array.isArray(pastas) ? pastas.find(p => p && p.id === idAlvo) : null) || { id: 'todas', nome: 'Estante Geral' });

  try {
    storage?.setItem(STORAGE_KEY_BIB_PASTA_ATIVA, alvo.id);
    storage?.setItem(STORAGE_KEY_DASH_PASTA, alvo.id);
  } catch (_) {}

  if (breadcrumbEl) {
    breadcrumbEl.textContent = `Bibliografia / ${alvo.nome}`;
  }

  if (typeof onSelect === 'function') {
    onSelect(alvo.id, alvo);
  }

  return alvo.id;
}

/**
 * Renderiza o Breadcrumb de navegação de forma declarativa e com acessibilidade
 * @param {HTMLElement} container
 * @param {object|string} pastaAtiva
 * @param {object} opcoes
 * @returns {HTMLElement}
 */
export function renderizarBreadcrumb(container, pastaAtiva = 'todas', { pastas = [], onSelect = null } = {}) {
  if (!container) return null;
  const pastaId = typeof pastaAtiva === 'object' && pastaAtiva !== null ? pastaAtiva.id : pastaAtiva;
  const pastaObj = (pastaId === 'todas')
    ? { id: 'todas', nome: 'Estante Geral' }
    : ((Array.isArray(pastas) ? pastas.find(p => p && p.id === pastaId) : null) || { id: 'todas', nome: 'Estante Geral' });

  const nav = (container.tagName?.toLowerCase() === 'nav') ? container : document.createElement('nav');
  nav.className = 'ath-bib-breadcrumb';
  nav.id = 'athBibBreadcrumb';
  nav.setAttribute('aria-label', 'Navegação da Bibliografia');

  nav.innerHTML = `
    <button type="button" class="ath-bib-breadcrumb-btn ${pastaObj.id === 'todas' ? 'ath-bib-breadcrumb-btn--active' : ''}" data-nav-pasta="todas" title="Ver todas as obras (Estante Geral)">
      <span class="ath-bib-breadcrumb-icon" aria-hidden="true">${svgIcone('livro', 15)}</span>
      <span class="ath-bib-breadcrumb-txt">Bibliografia</span>
    </button>
    <span class="ath-bib-breadcrumb-sep" aria-hidden="true">/</span>
    <span class="ath-bib-breadcrumb-current" aria-current="page" title="${escapeHtml(pastaObj.nome)}">
      <span class="ath-bib-breadcrumb-icon" aria-hidden="true">${svgIcone('pasta', 15)}</span>
      <span class="ath-bib-breadcrumb-txt">${escapeHtml(pastaObj.nome)}</span>
    </span>
  `;

  nav.querySelector('[data-nav-pasta="todas"]')?.addEventListener('click', () => {
    if (typeof onSelect === 'function') {
      onSelect('todas');
    }
  });

  if (container !== nav && !container.contains(nav)) {
    container.innerHTML = '';
    container.appendChild(nav);
  }

  return nav;
}

/**
 * Renderiza os cards de pasta no formato Cronos (com aba superior esquerda)
 * @param {Array<object>} pastas
 * @param {string} pastaAtivaId
 * @param {Map<string, object>} mapaAgrupado
 * @param {object} opcoes
 * @returns {HTMLElement}
 */
export function renderizarPastasCronos(pastas = [], pastaAtivaId = 'todas', mapaAgrupado = null, { onSelecionarPasta = null, onOpcoesPasta = null, onMoverLivro = null } = {}) {
  const container = document.createElement('div');
  container.className = 'ath-bib-folders-grid ath-bib-pastas-faixa';

  if (!Array.isArray(pastas) || pastas.length === 0) {
    return container;
  }

  for (const p of pastas) {
    if (!p) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ath-bib-folder-card';
    card.setAttribute('data-pasta-id', p.id);

    const ativo = (p.id === pastaAtivaId);
    if (ativo) {
      card.classList.add('ath-bib-folder-card--active');
      card.setAttribute('aria-selected', 'true');
    } else {
      card.setAttribute('aria-selected', 'false');
    }

    const cores = calcularCoresPasta(p.cor || '#314F79');
    const corFundo = cores.bg;

    card.style.setProperty('--ath-folder-accent', normalizarHexCor(p.cor || '#314F79'));
    card.style.setProperty('--ath-folder-bg', '#FFFFFF');
    card.style.setProperty('--ath-folder-fg', '#1E293B');
    card.style.setProperty('--ath-folder-border', cores.border);
    card.style.setProperty('--ath-folder-badge-bg', cores.badgeBg);
    card.style.setProperty('--ath-folder-divider', cores.divider);

    const nomePasta = p.nome || 'Sem Nome';

    // 1. Aba Superior Esquerda (Folder Tab)
    const tab = document.createElement('div');
    tab.className = 'ath-bib-folder-tab';
    tab.setAttribute('aria-hidden', 'true');
    tab.textContent = nomePasta;
    card.appendChild(tab);

    // 2. Contagem de obras
    const count = (mapaAgrupado && typeof mapaAgrupado.get === 'function')
      ? (mapaAgrupado.get(p.id)?.total ?? (typeof mapaAgrupado.get(p.id) === 'number' ? mapaAgrupado.get(p.id) : 0))
      : (p.count ?? 0);

    const badgeCount = document.createElement('span');
    badgeCount.className = 'ath-bib-folder-count';
    badgeCount.textContent = count > 999 ? '999+' : String(count);

    // 3. Corpo da pasta
    const body = document.createElement('div');
    body.className = 'ath-bib-folder-body';

    const topo = document.createElement('div');
    topo.className = 'ath-bib-folder-top';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'ath-bib-folder-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = svgIcone('pasta', 22);
    topo.appendChild(iconWrap);

    const topActions = document.createElement('div');
    topActions.className = 'ath-bib-folder-top-actions';
    topActions.appendChild(badgeCount);

    const podeEditar = p.origem !== 'compartilhada';
    if (podeEditar && typeof onOpcoesPasta === 'function') {
      const btnOpt = document.createElement('button');
      btnOpt.type = 'button';
      btnOpt.className = 'ath-bib-folder-opt-btn';
      btnOpt.setAttribute('data-acao-pasta', 'opcoes');
      btnOpt.setAttribute('data-pasta-id', p.id);
      btnOpt.setAttribute('aria-label', `Opções da pasta ${nomePasta}`);
      btnOpt.textContent = '⋯';
      btnOpt.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onOpcoesPasta(p.id, btnOpt);
      });
      topActions.appendChild(btnOpt);
    }
    topo.appendChild(topActions);
    body.appendChild(topo);

    // Informações da pasta
    const info = document.createElement('div');
    info.className = 'ath-bib-folder-info';

    const titulo = document.createElement('strong');
    titulo.className = 'ath-bib-folder-title';
    titulo.title = nomePasta;
    titulo.textContent = nomePasta;
    info.appendChild(titulo);

    const sub = document.createElement('small');
    sub.className = 'ath-bib-folder-sub';
    sub.textContent = p.origemZotero ? 'Coleção Zotero' : (p.id === RAIZ_BIBLIOGRAFIA ? 'Coleção Principal' : 'Pasta Temática');
    info.appendChild(sub);
    body.appendChild(info);

    // Rodapé
    const footer = document.createElement('div');
    footer.className = 'ath-bib-folder-footer';

    const dot = document.createElement('span');
    dot.className = 'ath-bib-folder-color-dot';
    dot.style.background = corFundo;
    dot.title = `Cor: ${corFundo}`;
    footer.appendChild(dot);

    if (p.origem === 'compartilhada') {
      const tagComp = document.createElement('span');
      tagComp.className = 'ath-bib-tag-comp';
      tagComp.textContent = 'Compartilhada';
      footer.appendChild(tagComp);
    }
    body.appendChild(footer);
    card.appendChild(body);

    // Ação de clique no card
    card.addEventListener('click', () => {
      if (typeof onSelecionarPasta === 'function') {
        onSelecionarPasta(p.id);
      }
    });

    // Drag and Drop (arrastar e soltar livro sobre o card da pasta)
    if (typeof onMoverLivro === 'function' && podeEditar) {
      card.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        card.classList.add('ath-drop-target-over');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('ath-drop-target-over');
      });
      card.addEventListener('drop', (ev) => {
        ev.preventDefault();
        card.classList.remove('ath-drop-target-over');
        const livroId = ev.dataTransfer?.getData('application/x-ath-livro-id')
          || ev.dataTransfer?.getData('text/ath-artigo-id')
          || ev.dataTransfer?.getData('text/plain');
        if (livroId) {
          onMoverLivro(livroId, p.id);
        }
      });
    }

    container.appendChild(card);
  }

  return container;
}

/**
 * Renderiza a faixa horizontal de pastas dentro do container especificado
 * @param {HTMLElement} container
 * @param {object} opcoes
 * @returns {HTMLElement}
 */
export function renderizarFaixaDePastas(container, { pastas = [], pastaAtivaId = 'todas', mapaAgrupado = null, onSelecionarPasta = null, onOpcoesPasta = null, onMoverLivro = null } = {}) {
  if (!container) return null;
  container.innerHTML = '';
  const faixa = renderizarPastasCronos(pastas, pastaAtivaId, mapaAgrupado, {
    onSelecionarPasta,
    onOpcoesPasta,
    onMoverLivro
  });
  container.appendChild(faixa);
  return faixa;
}

/**
 * Abre o modal de criação de nova pasta de bibliografia
 * @param {Function} [callback]
 */
export function abrirModalNovaPasta(callback) {
  const modal = document.createElement('div');
  modal.className = 'ath-modal-backdrop';
  modal.id = 'athModalNovaPastaBib';
  let corSelecionada = CORES_PASTAS_CRONOS[0];

  modal.innerHTML = `
    <div class="ath-modal" style="max-width: 420px;">
      <div class="ath-modal-head">
        <h2>Nova Pasta de Bibliografia</h2>
        <button type="button" class="ath-btn ath-btn-icon" id="athBtnFecharModalNovaPasta" aria-label="Fechar">${svgIcone('fechar', 16)}</button>
      </div>
      <div class="ath-modal-corpo">
        <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">
          Nome da Pasta
          <input type="text" class="ath-input" id="athInputNomeNovaPastaBib" placeholder="Ex.: Metodologia, Regularização Fundiária..." style="width:100%; margin-top:4px;" autofocus>
        </label>

        <div style="margin-top:14px;">
          <span style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Cor da Pasta</span>
          <div class="ath-cores-swatches" id="athSwatchesCoresPastas" style="display:flex; gap:8px; flex-wrap:wrap;">
            ${CORES_PASTAS_CRONOS.map(c => `
              <button type="button" class="ath-swatch-btn ${c === corSelecionada ? 'sel' : ''}" data-cor="${c}" style="width:28px; height:28px; border-radius:50%; background:${c}; border:2px solid ${c === corSelecionada ? '#FFFFFF' : 'transparent'}; outline:${c === corSelecionada ? '2px solid #314F79' : 'none'}; box-shadow:0 1px 3px rgba(0,0,0,0.2); cursor:pointer;"></button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="ath-modal-rodape" style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnCancelarNovaPasta">Cancelar</button>
        <button type="button" class="ath-btn ath-btn-sm ath-btn-primary" id="athBtnConfirmarNovaPasta">Criar Pasta</button>
      </div>
    </div>
  `;

  const fechar = () => modal.remove();
  modal.querySelector('#athBtnFecharModalNovaPasta')?.addEventListener('click', fechar);
  modal.querySelector('#athBtnCancelarNovaPasta')?.addEventListener('click', fechar);

  const swatches = modal.querySelectorAll('[data-cor]');
  swatches.forEach(btn => {
    btn.addEventListener('click', () => {
      corSelecionada = btn.dataset.cor;
      swatches.forEach(b => {
        const ativo = b.dataset.cor === corSelecionada;
        b.style.borderColor = ativo ? '#FFFFFF' : 'transparent';
        b.style.outline = ativo ? '2px solid #314F79' : 'none';
      });
    });
  });

  const confirmar = () => {
    const nomeInput = modal.querySelector('#athInputNomeNovaPastaBib')?.value.trim();
    if (!nomeInput) {
      mostrarAviso('Informe um nome para a pasta.', { tipo: 'aviso' });
      return;
    }
    const nova = adicionarSubpastaDriveLocal({
      parentId: RAIZ_BIBLIOGRAFIA,
      nome: nomeInput,
      tipo: 'bibliografia'
    });
    if (nova) {
      nova.cor = corSelecionada;
      salvarPastasDriveLocais(obterPastasDriveLocais());
    }
    fechar();
    if (typeof callback === 'function') {
      callback(nova);
    }
    mostrarAviso(`Pasta "${nomeInput}" criada com sucesso!`, { tipo: 'sucesso' });
  };

  modal.querySelector('#athBtnConfirmarNovaPasta')?.addEventListener('click', confirmar);
  modal.querySelector('#athInputNomeNovaPastaBib')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') confirmar();
    if (ev.key === 'Escape') fechar();
  });

  document.body.appendChild(modal);
}

/**
 * Abre o modal para mover uma obra bibliográfica para outra pasta
 * @param {object|string} livro
 * @param {object} opcoes
 */
export function abrirModalMoverLivro(livro, { pastas = coletarPastasBibliografia(), onMover = null, onNovaPasta = null } = {}) {
  const livroId = (typeof livro === 'object' && livro !== null) ? livro.id : String(livro || '');
  const livroTitulo = (typeof livro === 'object' && livro !== null) ? (livro.titulo || 'Esta obra') : 'Esta obra';
  const pastaOrigemId = (typeof livro === 'object' && livro !== null) ? (livro.pastaId || RAIZ_BIBLIOGRAFIA) : RAIZ_BIBLIOGRAFIA;

  const modal = document.createElement('div');
  modal.className = 'ath-modal-backdrop';
  modal.id = 'athModalMoverLivro';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const itensPastasHtml = (pastas || []).map(p => {
    if (!p) return '';
    const ehAtual = p.id === pastaOrigemId;
    const ehLeitura = p.origem === 'compartilhada' && p.permissao === 'leitura';
    return `
      <button type="button" class="ath-btn ath-btn-opcao-pasta" data-pasta-destino-id="${p.id}" ${ehAtual || ehLeitura ? 'disabled' : ''} style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:9px 12px; border:1px solid #E2E8F0; border-radius:9px; background:#FFFFFF; cursor:${ehAtual || ehLeitura ? 'default' : 'pointer'}; opacity:${ehAtual || ehLeitura ? 0.6 : 1}; margin-bottom:6px; text-align:left;">
        <span style="display:inline-flex; align-items:center; gap:8px; font-weight:700; color:#1E293B;">
          <span style="width:10px; height:10px; border-radius:50%; background:${p.cor || '#314F79'}; display:inline-block;"></span>
          ${escapeHtml(p.nome || 'Sem Nome')}
        </span>
        <small style="color:#64748B; font-size:11px;">
          ${ehAtual ? '(Pasta atual)' : (ehLeitura ? '(Somente leitura)' : '')}
        </small>
      </button>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="ath-modal" style="max-width: 440px;">
      <div class="ath-modal-head">
        <h3 class="ath-modal-title">${svgIcone('pasta', 17)} Mover Obra</h3>
        <button type="button" class="ath-btn ath-btn-icon" id="athBtnFecharModalMover" aria-label="Fechar">${svgIcone('fechar', 16)}</button>
      </div>
      <div class="ath-modal-corpo">
        <p style="font-size:12.5px; color:#475569; margin:0 0 12px 0;">
          Mover a obra <strong style="color:#0F172A;">"${escapeHtml(livroTitulo)}"</strong> para:
        </p>
        <div class="ath-modal-pastas-lista" style="max-height:240px; overflow-y:auto;">
          <!-- Opção Raiz -->
          <button type="button" class="ath-btn ath-btn-opcao-pasta" data-pasta-destino-id="${RAIZ_BIBLIOGRAFIA}" ${pastaOrigemId === RAIZ_BIBLIOGRAFIA ? 'disabled' : ''} style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:9px 12px; border:1px solid #E2E8F0; border-radius:9px; background:#FFFFFF; cursor:${pastaOrigemId === RAIZ_BIBLIOGRAFIA ? 'default' : 'pointer'}; opacity:${pastaOrigemId === RAIZ_BIBLIOGRAFIA ? 0.6 : 1}; margin-bottom:6px; text-align:left;">
            <span style="display:inline-flex; align-items:center; gap:8px; font-weight:700; color:#1E293B;">
              <span style="width:10px; height:10px; border-radius:50%; background:#314F79; display:inline-block;"></span>
              Coleção Principal (Raiz)
            </span>
            <small style="color:#64748B; font-size:11px;">${pastaOrigemId === RAIZ_BIBLIOGRAFIA ? '(Pasta atual)' : ''}</small>
          </button>
          ${itensPastasHtml}
        </div>
      </div>
      <div class="ath-modal-rodape" style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnNovaPastaNoModalMover">+ Nova Pasta</button>
        <button type="button" class="ath-btn ath-btn-sm" id="athBtnCancelarMover">Cancelar</button>
      </div>
    </div>
  `;

  const fechar = () => modal.remove();
  modal.querySelector('#athBtnFecharModalMover')?.addEventListener('click', fechar);
  modal.querySelector('#athBtnCancelarMover')?.addEventListener('click', fechar);

  modal.querySelectorAll('[data-pasta-destino-id]:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const destinoId = btn.dataset.pastaDestinoId;
      fechar();
      if (typeof onMover === 'function') {
        onMover(livroId, destinoId);
      }
    });
  });

  modal.querySelector('#athBtnNovaPastaNoModalMover')?.addEventListener('click', () => {
    fechar();
    if (typeof onNovaPasta === 'function') {
      onNovaPasta();
    } else {
      abrirModalNovaPasta((nova) => {
        if (nova && typeof onMover === 'function') {
          onMover(livroId, nova.id);
        }
      });
    }
  });

  document.body.appendChild(modal);
}

/**
 * Configura listeners globais de Drag & Drop para os cards de pasta
 * @param {HTMLElement} container
 * @param {object} opcoes
 */
export function configurarDragAndDropPastas(container, { onMoverLivro = null } = {}) {
  if (!container) return;
  const cards = container.querySelectorAll('.ath-bib-folder-card');
  cards.forEach(card => {
    card.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      card.classList.add('ath-drop-target-over');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('ath-drop-target-over');
    });
    card.addEventListener('drop', (ev) => {
      ev.preventDefault();
      card.classList.remove('ath-drop-target-over');
      const livroId = ev.dataTransfer?.getData('application/x-ath-livro-id')
        || ev.dataTransfer?.getData('text/ath-artigo-id')
        || ev.dataTransfer?.getData('text/plain');
      const pastaDestinoId = card.getAttribute('data-pasta-id');
      if (livroId && pastaDestinoId && typeof onMoverLivro === 'function') {
        onMoverLivro(livroId, pastaDestinoId);
      }
    });
  });
}

/**
 * Métodos acrescentados ao protótipo de EstudoArtigosView para gerenciamento de pastas
 */
export const metodosEstudoPastas = {
  renderizarBarraPastasTopo(containerAlvo) {
    if (!containerAlvo) return;
    const pastas = coletarPastasBibliografia();
    const mapaAgrupado = this.obterAgrupamentoPastas();
    const totalGeral = this.artigosCatalogo().length;

    // 1. Barra de Navegação (Breadcrumb + Botão Estante Geral + Nova Pasta)
    let navBar = containerAlvo.querySelector('#athBibNavBar');
    if (!navBar) {
      navBar = document.createElement('header');
      navBar.className = 'ath-bib-nav-bar';
      navBar.id = 'athBibNavBar';
      containerAlvo.appendChild(navBar);
    }

    const pastaAtiva = this.pastaFiltroId || 'todas';
    const nomeAtivo = (pastaAtiva === 'todas')
      ? 'Estante Geral'
      : (pastas.find(p => p && p.id === pastaAtiva)?.nome || 'Estante Geral');

    navBar.innerHTML = `
      <nav class="ath-bib-breadcrumb" id="athBibBreadcrumb" aria-label="Navegação da Bibliografia">
        <button type="button" class="ath-bib-breadcrumb-btn ${pastaAtiva === 'todas' ? 'ath-bib-breadcrumb-btn--active' : ''}" data-nav-pasta="todas" title="Ver todas as obras (Estante Geral)">
          <span class="ath-bib-breadcrumb-icon" aria-hidden="true">${svgIcone('livro', 15)}</span>
          <span class="ath-bib-breadcrumb-txt">Bibliografia</span>
        </button>
        <span class="ath-bib-breadcrumb-sep" aria-hidden="true">/</span>
        <span class="ath-bib-breadcrumb-current" aria-current="page" title="${escapeHtml(nomeAtivo)}">
          <span class="ath-bib-breadcrumb-icon" aria-hidden="true">${svgIcone('pasta', 15)}</span>
          <span class="ath-bib-breadcrumb-txt">${escapeHtml(nomeAtivo)}</span>
        </span>
      </nav>

      <div class="ath-bib-nav-actions">
        <button type="button" class="ath-btn-estante-geral ${pastaAtiva === 'todas' ? 'ath-btn-estante-geral--on ath-btn-estante-geral--active' : ''}" id="athBtnEstanteGeral" data-nav-pasta="todas" title="Exibir todas as referências sem filtro de pasta">
          <span aria-hidden="true">${svgIcone('livro', 15)}</span>
          <span>Estante Geral</span>
          <span class="ath-bib-count-pill" id="athBibTotalObrasPill">${totalGeral}</span>
        </button>
        <button type="button" class="ath-btn ath-btn-nova-pasta" id="athBtnNovaPastaBib" title="Criar nova pasta de bibliografia">
          ${svgIcone('mais', 13)}
          <span>Nova Pasta</span>
        </button>
      </div>
    `;

    navBar.querySelectorAll('[data-nav-pasta]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selecionarPastaBib('todas');
      });
    });

    navBar.querySelector('#athBtnNovaPastaBib')?.addEventListener('click', () => {
      this.abrirModalCriarNovaPasta();
    });

    // 2. Faixa Horizontal de Pastas Estilo Cronos
    let trackContainer = containerAlvo.querySelector('#athBibFoldersTrackContainer');
    if (!trackContainer) {
      trackContainer = document.createElement('div');
      trackContainer.className = 'ath-bib-folders-track-container';
      trackContainer.id = 'athBibFoldersTrackContainer';
      containerAlvo.appendChild(trackContainer);
    }
    trackContainer.innerHTML = '';

    const faixaCards = renderizarPastasCronos(pastas, pastaAtiva, mapaAgrupado, {
      onSelecionarPasta: (pId) => this.selecionarPastaBib(pId),
      onOpcoesPasta: (pId, anchor) => this.abrirMenuOpcoesPasta(pId, anchor),
      onMoverLivro: (livroId, pId) => this.moverArtigoParaPasta(livroId, pId)
    });

    trackContainer.appendChild(faixaCards);
  },

  renderizarFaixaDePastas(containerAlvo) {
    return this.renderizarBarraPastasTopo(containerAlvo);
  },

  renderizarBreadcrumb(containerAlvo) {
    const pastas = coletarPastasBibliografia();
    return renderizarBreadcrumb(containerAlvo, this.pastaFiltroId, {
      pastas,
      onSelect: (pId) => this.selecionarPastaBib(pId)
    });
  },

  selecionarPastaBib(pastaId) {
    const pastas = coletarPastasBibliografia();
    const breadcrumbEl = this.container?.querySelector('#athBibBreadcrumb');
    const idFinal = selecionarPasta(pastaId, {
      pastas,
      breadcrumbEl,
      onSelect: (id) => {
        this.pastaFiltroId = id;
        this.atualizarSelecaoVisualPastas(id);
        this.atualizarGridCatalogo();
        this.aoMudarPastas?.();
      }
    });
    return idFinal;
  },

  atualizarSelecaoVisualPastas(pastaAtivaId) {
    const container = this.container;
    if (!container) return;
    container.querySelectorAll('.ath-bib-folder-card').forEach(card => {
      const match = card.getAttribute('data-pasta-id') === pastaAtivaId;
      card.classList.toggle('ath-bib-folder-card--active', match);
      card.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    const btnGeral = container.querySelector('#athBtnEstanteGeral');
    const ehTodas = pastaAtivaId === 'todas';
    btnGeral?.classList.toggle('ath-btn-estante-geral--active', ehTodas);
    btnGeral?.classList.toggle('ath-btn-estante-geral--on', ehTodas);

    const btnBreadcrumbGeral = container.querySelector('.ath-bib-breadcrumb-btn');
    btnBreadcrumbGeral?.classList.toggle('ath-bib-breadcrumb-btn--active', ehTodas);
  },

  atualizarBarraPastasContadores() {
    const container = this.container;
    if (!container) return;
    const mapaAgrupado = this.obterAgrupamentoPastas();
    container.querySelectorAll('.ath-bib-folder-card').forEach(card => {
      const pId = card.getAttribute('data-pasta-id');
      const badge = card.querySelector('.ath-bib-folder-count');
      if (badge && pId) {
        const count = mapaAgrupado.get(pId)?.total ?? 0;
        badge.textContent = count > 999 ? '999+' : String(count);
      }
    });

    const totalPill = container.querySelector('#athBibTotalObrasPill');
    if (totalPill) {
      totalPill.textContent = String(this.artigosCatalogo().length);
    }
  },

  obterAgrupamentoPastas() {
    const itens = this.artigosCatalogo();
    const pastas = coletarPastasBibliografia();
    const contadores = calcularContadoresPastas(itens, pastas);
    const mapa = new Map();
    for (const [key, total] of contadores.entries()) {
      mapa.set(key, { total });
    }
    return mapa;
  },

  abrirModalCriarNovaPasta() {
    abrirModalNovaPasta((nova) => {
      if (nova) {
        const topoWrapper = this.container?.querySelector('#athBibTopoPastasWrapper');
        if (topoWrapper) {
          this.renderizarBarraPastasTopo(topoWrapper);
        }
        this.selecionarPastaBib(nova.id);
      }
    });
  },

  abrirModalMoverLivro(livroId) {
    const livro = this.artigosCatalogo().find(a => a && (a.id === livroId || a.chaveZotero === livroId));
    if (!livro) {
      mostrarAviso('Obra não encontrada para mover.', { tipo: 'aviso' });
      return;
    }
    abrirModalMoverLivro(livro, {
      pastas: coletarPastasBibliografia(),
      onMover: (idL, pDestino) => {
        this.moverArtigoParaPasta(idL, pDestino);
      },
      onNovaPasta: () => {
        abrirModalNovaPasta((nova) => {
          if (nova) {
            this.moverArtigoParaPasta(livroId, nova.id);
          }
        });
      }
    });
  },

  moverArtigoParaPasta(livroId, pastaDestinoId) {
    const pastas = coletarPastasBibliografia();
    const resultado = moverReferenciaEntrePastas(this.artigos, livroId, pastaDestinoId, { pastas });
    if (!resultado.sucesso) {
      if (resultado.erro) {
        mostrarAviso(resultado.erro, { tipo: 'aviso' });
      }
      return resultado;
    }

    if (resultado.semMudanca) {
      mostrarAviso(resultado.mensagem || 'O livro já está nesta pasta.', { tipo: 'aviso' });
      return resultado;
    }

    // Persiste e atualiza interface
    salvarArtigosEstudo(this.artigos, resultado.livroModificado);
    moverArquivosDoArtigoNoDrive(resultado.livroModificado, pastaDestinoId).catch(() => {});
    this.atualizarBarraPastasContadores();
    this.atualizarGridCatalogo();
    const nomeDestino = (pastaDestinoId === RAIZ_BIBLIOGRAFIA || pastaDestinoId === 'todas')
      ? 'Coleção Principal'
      : (pastas.find(p => p && p.id === pastaDestinoId)?.nome || pastaDestinoId);
    mostrarAviso(`Obra movida para "${nomeDestino}" com sucesso!`, { tipo: 'sucesso' });
    return resultado;
  },

  abrirMenuOpcoesPasta(pastaId, anchorEl) {
    const pasta = coletarPastasBibliografia().find(p => p && p.id === pastaId);
    if (!pasta) return;

    // Remove menu anterior se houver
    document.querySelector('.ath-menu-pasta-contexto')?.remove();

    const menu = document.createElement('div');
    menu.className = 'ath-menu-pasta-contexto ath-artigo-menu-contexto';
    menu.style.position = 'absolute';
    menu.style.zIndex = '100005';

    menu.innerHTML = `
      <button type="button" data-acao="mudar-cor">${svgIcone('pincel', 15)}<span>Alterar cor</span></button>
      <button type="button" data-acao="renomear">${svgIcone('lapis', 15)}<span>Renomear</span></button>
      <hr>
      <button type="button" data-acao="excluir" class="ath-menu-pasta-excluir">${svgIcone('lixeira', 15)}<span>Excluir pasta</span></button>
    `;

    const fecharMenu = () => menu.remove();
    setTimeout(() => {
      document.addEventListener('click', fecharMenu, { once: true });
    }, 10);

    // Posiciona próximo ao anchor
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
      menu.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 220)}px`;
    }

    menu.querySelector('[data-acao="mudar-cor"]')?.addEventListener('click', () => {
      fecharMenu();
      this.abrirModalAlterarCorPasta(pastaId);
    });

    menu.querySelector('[data-acao="renomear"]')?.addEventListener('click', () => {
      fecharMenu();
      const novoNome = prompt('Novo nome para a pasta:', pasta.nome);
      if (novoNome && novoNome.trim()) {
        pasta.nome = novoNome.trim();
        salvarPastasDriveLocais(obterPastasDriveLocais());
        const topoWrapper = this.container?.querySelector('#athBibTopoPastasWrapper');
        if (topoWrapper) this.renderizarBarraPastasTopo(topoWrapper);
        mostrarAviso('Pasta renomeada com sucesso!', { tipo: 'sucesso' });
      }
    });

    menu.querySelector('[data-acao="excluir"]')?.addEventListener('click', () => {
      fecharMenu();
      if (confirm(`Deseja realmente excluir a pasta "${pasta.nome}"? As obras retornarão para a Coleção Principal.`)) {
        removerPastaDriveLocal(pastaId);
        // Atualiza obras que estavam nesta pasta para a raiz
        for (const art of this.artigos) {
          if (art && art.pastaId === pastaId) {
            art.pastaId = RAIZ_BIBLIOGRAFIA;
            art.pastasIds = [RAIZ_BIBLIOGRAFIA];
          }
        }
        salvarArtigosEstudo(this.artigos);
        if (this.pastaFiltroId === pastaId) {
          this.selecionarPastaBib('todas');
        } else {
          const topoWrapper = this.container?.querySelector('#athBibTopoPastasWrapper');
          if (topoWrapper) this.renderizarBarraPastasTopo(topoWrapper);
        }
        mostrarAviso('Pasta excluída com sucesso.', { tipo: 'sucesso' });
      }
    });

    document.body.appendChild(menu);
  },

  abrirModalAlterarCorPasta(pastaId) {
    const pasta = coletarPastasBibliografia().find(p => p && p.id === pastaId);
    if (!pasta) return;

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    let corEscolhida = normalizarHexCor(pasta.cor, CORES_PASTAS_CRONOS[0]);

    modal.innerHTML = `
      <div class="ath-modal ath-modal-cor-pasta" role="dialog" aria-modal="true" aria-labelledby="athCorPastaTitulo">
        <div class="ath-modal-head ath-modal-cor-pasta-head">
          <div>
            <span class="ath-modal-cor-pasta-sobretitulo">PERSONALIZAR PASTA</span>
            <h2 id="athCorPastaTitulo">Escolher cor</h2>
            <p>Identifique esta coleção na estante.</p>
          </div>
          <button type="button" class="ath-btn ath-btn-icon" id="athBtnFecharModalCor" aria-label="Fechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div class="ath-pasta-cor-preview" style="--ath-pasta-cor:${corEscolhida}">
            <div class="ath-pasta-cor-preview-fichario" aria-hidden="true"><span class="ath-pasta-cor-preview-rotulo"></span><span class="ath-pasta-cor-preview-anel"></span></div>
            <div class="ath-pasta-cor-preview-texto"><span>PRÉVIA DA PASTA</span><strong>${escapeHtml(pasta.nome)}</strong></div>
          </div>
          <fieldset class="ath-pasta-cor-paleta">
            <legend>Escolha uma cor</legend>
            <div class="ath-pasta-cor-opcoes">
            ${CORES_PASTAS_CRONOS.map((c, indice) => `
              <button type="button" class="ath-pasta-cor-opcao" data-cor="${c}" aria-label="${NOMES_CORES_PASTAS[indice]}" aria-pressed="${c.toLowerCase() === corEscolhida.toLowerCase()}">
                <span class="ath-pasta-cor-amostra" style="--ath-pasta-cor:${c}" aria-hidden="true"></span>
                <span>${NOMES_CORES_PASTAS[indice]}</span>
                ${svgIcone('check', 14)}
              </button>
            `).join('')}
            </div>
          </fieldset>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn ath-btn-sm" id="athBtnCancelarCor">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-sm ath-btn-primary" id="athBtnSalvarCor">Aplicar cor</button>
        </div>
      </div>
    `;

    const aoTeclado = ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); fechar(); }
      if (ev.key !== 'Tab') return;
      const botoes = [...modal.querySelectorAll('button')];
      const primeiro = botoes[0];
      const ultimo = botoes[botoes.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    };
    const fechar = () => { document.removeEventListener('keydown', aoTeclado, true); modal.remove(); };
    modal.addEventListener('click', ev => { if (ev.target === modal) fechar(); });
    modal.querySelector('#athBtnFecharModalCor')?.addEventListener('click', fechar);
    modal.querySelector('#athBtnCancelarCor')?.addEventListener('click', fechar);

    const swatches = modal.querySelectorAll('[data-cor]');
    swatches.forEach(btn => {
      btn.addEventListener('click', () => {
        corEscolhida = btn.dataset.cor;
        swatches.forEach(b => {
          b.setAttribute('aria-pressed', String(b.dataset.cor === corEscolhida));
        });
        modal.querySelector('.ath-pasta-cor-preview')?.style.setProperty('--ath-pasta-cor', corEscolhida);
      });
    });

    modal.querySelector('#athBtnSalvarCor')?.addEventListener('click', () => {
      // obterPastasDriveLocais() devolve uma árvore nova a cada chamada: a cor precisa ser
      // aplicada na MESMA árvore que será gravada, senão a alteração se perde.
      const arvore = obterPastasDriveLocais();
      const alvo = buscarPastaNaArvore(arvore, pastaId);
      if (alvo) alvo.cor = corEscolhida;
      pasta.cor = corEscolhida;
      salvarPastasDriveLocais(arvore);
      fechar();
      const topoWrapper = this.container?.querySelector('#athBibTopoPastasWrapper');
      if (topoWrapper) this.renderizarBarraPastasTopo(topoWrapper);
      mostrarAviso('Cor da pasta atualizada com sucesso!', { tipo: 'sucesso' });
    });

    document.body.appendChild(modal);
    document.addEventListener('keydown', aoTeclado, true);
    modal.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }
};
