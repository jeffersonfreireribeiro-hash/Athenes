// SPDX-License-Identifier: GPL-3.0-or-later
import { IDIOMAS_TRADUCAO, traduzirTextoAcademico } from '../core/athenes_traducao.js';
import { salvarArtigosEstudo } from './athenes_estudo_artigos_dados.js';
import { svgIcone } from './athenes_icones.js';

let balaoAtual = null;

export function salvarTraducaoComoNota(view, root, art, original, traduzido, destino) {
  const nota = `Tradução para ${IDIOMAS_TRADUCAO[destino]}\n${traduzido}\n\nOriginal: ${original}`;
  if (!Array.isArray(art.pinnedNotes)) art.pinnedNotes = [];
  art.pinnedNotes.push(nota);
  if (!art.fichamento || typeof art.fichamento !== 'object') art.fichamento = {};
  art.fichamento.metodologiaNotas = [art.fichamento.metodologiaNotas, nota].filter(Boolean).join('\n\n');
  art.atualizadoEm = new Date().toISOString();
  art.fichamento.atualizadoEm = art.atualizadoEm;
  const campo = root?.querySelector?.('#athEstudoMetodoNotas');
  if (campo) campo.value = art.fichamento.metodologiaNotas;
  salvarArtigosEstudo(view.artigos, art);
  view.registrarSnapshotArtigo?.(art);
  return nota;
}

export function mostrarBalaoTraducao({ texto, destino = 'pt', ancora, aoSalvarNota }) {
  balaoAtual?.remove();
  const controlador = new AbortController();
  const balao = document.createElement('section');
  balao.className = 'ath-traducao-balao';
  balao.setAttribute('role', 'status');
  balao.innerHTML = `
    <div class="ath-traducao-cabecalho"><span>${svgIcone('globo', 15)} Tradução · ${IDIOMAS_TRADUCAO[destino]}</span><button type="button" class="ath-traducao-fechar" aria-label="Fechar tradução">${svgIcone('fechar', 15)}</button></div>
    <p class="ath-traducao-original"></p>
    <div class="ath-traducao-resultado" aria-live="polite">Traduzindo…</div>
    <div class="ath-traducao-acoes"><button type="button" data-acao="copiar" disabled>${svgIcone('copiar', 14)} Copiar tradução</button><button type="button" data-acao="nota" disabled>${svgIcone('mais', 14)} Inserir no fichamento</button></div>`;
  balao.querySelector('.ath-traducao-original').textContent = texto;
  const ret = ancora?.getBoundingClientRect?.() || ancora || { left: 16, bottom: 70 };
  balao.style.left = `${Math.max(12, Math.min(window.innerWidth - 360, ret.left))}px`;
  balao.style.top = `${Math.max(12, Math.min(window.innerHeight - 280, ret.bottom + 9))}px`;
  document.body.append(balao);
  balaoAtual = balao;
  let traduzido = '';
  const fechar = () => { controlador.abort(); balao.remove(); if (balaoAtual === balao) balaoAtual = null; };
  balao.querySelector('.ath-traducao-fechar').addEventListener('click', fechar);
  balao.querySelector('[data-acao="copiar"]').addEventListener('click', async ev => {
    if (!traduzido) return;
    await navigator.clipboard.writeText(traduzido);
    ev.currentTarget.textContent = 'Copiado';
  });
  balao.querySelector('[data-acao="nota"]').addEventListener('click', ev => {
    if (!traduzido) return;
    aoSalvarNota?.(traduzido);
    ev.currentTarget.textContent = 'Salvo no fichamento';
    ev.currentTarget.disabled = true;
  });
  traduzirTextoAcademico(texto, { destino, signal: controlador.signal }).then(resultado => {
    if (!balao.isConnected) return;
    traduzido = resultado;
    balao.querySelector('.ath-traducao-resultado').textContent = resultado;
    balao.querySelectorAll('.ath-traducao-acoes button').forEach(botao => { botao.disabled = false; });
  }).catch(erro => {
    if (controlador.signal.aborted) return;
    balao.querySelector('.ath-traducao-resultado').textContent = erro.message || 'Não foi possível traduzir.';
  });
  return { fechar, elemento: balao };
}

export function configurarTraducaoEstudio(view, root, art) {
  const botao = root.querySelector('#athBtnTraduzirPagina');
  const idioma = root.querySelector('#athIdiomaTraducao');
  if (!botao || !idioma) return;
  botao.addEventListener('click', async () => {
    const pagina = root.querySelector(`.ath-pdf-folha-container[data-num-pagina="${view.paginaAtual}"]`);
    if (!pagina) return;
    const anterior = pagina.querySelector('.ath-pdf-traducao-pagina');
    if (anterior) { anterior.remove(); botao.setAttribute('aria-pressed', 'false'); return; }
    const camadaTexto = pagina.querySelector('.ath-pdf-folha-texto');
    const texto = camadaTexto?.classList.contains('ath-pdf-text-layer')
      ? [...camadaTexto.querySelectorAll('span')].map(el => el.textContent).filter(Boolean).join(' ')
      : camadaTexto?.innerText?.trim();
    const painel = document.createElement('div');
    painel.className = 'ath-pdf-traducao-pagina';
    painel.innerHTML = `<div class="ath-pdf-traducao-topo"><strong>${svgIcone('globo', 16)} Página ${view.paginaAtual} · ${IDIOMAS_TRADUCAO[idioma.value]}</strong><button type="button">Ver original</button></div><div class="ath-pdf-traducao-corpo" aria-live="polite">Traduzindo página…</div>`;
    pagina.append(painel);
    botao.setAttribute('aria-pressed', 'true');
    const fechar = () => { painel.remove(); botao.setAttribute('aria-pressed', 'false'); };
    painel.querySelector('button').addEventListener('click', fechar);
    if (!texto) { painel.querySelector('.ath-pdf-traducao-corpo').textContent = 'Esta página não contém texto selecionável para traduzir.'; return; }
    try {
      const traduzido = await traduzirTextoAcademico(texto, { destino: idioma.value });
      if (painel.isConnected) painel.querySelector('.ath-pdf-traducao-corpo').textContent = traduzido;
    } catch (erro) {
      if (painel.isConnected) painel.querySelector('.ath-pdf-traducao-corpo').textContent = erro.message || 'Não foi possível traduzir esta página.';
    }
  });

  // Seleções em campos e no resumo do fichamento também oferecem tradução contextual.
  const inspecao = root.querySelector('#athEstudioColDir');
  let acao = null;
  const mostrarAcao = () => {
    acao?.remove(); acao = null;
    const ativo = document.activeElement;
    let texto = '';
    let ancora = null;
    if (ativo?.matches?.('textarea, input[type="text"]') && inspecao.contains(ativo)) {
      texto = ativo.value.slice(ativo.selectionStart, ativo.selectionEnd).trim();
      ancora = ativo.getBoundingClientRect();
    } else {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && inspecao.contains(sel.anchorNode)) {
        texto = sel.toString().trim();
        ancora = sel.getRangeAt(0).getBoundingClientRect();
      }
    }
    if (texto.length < 2) return;
    acao = document.createElement('button');
    acao.type = 'button';
    acao.className = 'ath-traducao-acao-flutuante';
    acao.innerHTML = `${svgIcone('globo', 14)} Traduzir seleção`;
    acao.style.left = `${Math.max(12, Math.min(window.innerWidth - 180, ancora.left))}px`;
    acao.style.top = `${Math.max(12, ancora.top - 40)}px`;
    document.body.append(acao);
    acao.addEventListener('click', () => {
      mostrarBalaoTraducao({ texto, destino: idioma.value, ancora: acao, aoSalvarNota: resultado => salvarTraducaoComoNota(view, root, art, texto, resultado, idioma.value) });
      acao.remove(); acao = null;
    });
  };
  inspecao.addEventListener('mouseup', mostrarAcao);
  inspecao.addEventListener('pointerup', ev => { if (ev.pointerType === 'touch') setTimeout(mostrarAcao, 100); });
  inspecao.addEventListener('keyup', mostrarAcao);
  inspecao.addEventListener('select', mostrarAcao, true);
  root.addEventListener('pointerdown', ev => { if (acao && !ev.target.closest('.ath-traducao-acao-flutuante')) { acao.remove(); acao = null; } });
  return () => {
    acao?.remove();
    balaoAtual?.remove();
    balaoAtual = null;
  };
}
