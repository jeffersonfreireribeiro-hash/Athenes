// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Sugestões inline (estilo Google Docs / Track Changes) e card de decisão.
 *
 * Em modo Sugestão a digitação NÃO altera o texto base:
 *   - texto digitado/colado vira `<ins class="ath-sug-mark">` (sublinhado na cor do autor);
 *   - texto apagado (Backspace/Delete/seleção) vira `<del class="ath-sug-mark">` (tachado), sem sair do documento;
 *   - digitar sobre uma seleção cria uma substituição (`del` + `ins` com o mesmo id).
 * O registro de cada sugestão (autor, id do autor, data, tipo, conteúdo) fica em `documento.sugestoes`.
 * Aceitar/Rejeitar usam `aceitarSugestaoNoDocumento`/`rejeitarSugestaoNoDocumento` (núcleo).
 */

import {
  registrarSugestao, gerarHtmlMarcacaoSugestao, garantirEstruturaSugestoes,
  aceitarSugestaoNoDocumento, rejeitarSugestaoNoDocumento
} from '../core/athenes_colaboracao.js';

export const SEL_MARCA = 'ins.ath-sug-mark, del.ath-sug-mark';

function marcaDe(no, raiz) {
  const el = no?.nodeType === 1 ? no : no?.parentElement;
  const m = el?.closest?.(SEL_MARCA);
  return m && raiz.contains(m) ? m : null;
}

function criarNos(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  return [...t.content.childNodes];
}

function colocarCursor(ref, modo) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  if (modo === 'dentro-fim') { r.selectNodeContents(ref); r.collapse(false); }
  else if (modo === 'antes') { r.setStartBefore(ref); r.collapse(true); }
  else { r.setStartAfter(ref); r.collapse(true); }
  sel.removeAllRanges();
  sel.addRange(r);
}

const irmao = (no, dir) => {
  let n = dir < 0 ? no.previousSibling : no.nextSibling;
  while (n && n.nodeType === 3 && n.textContent === '') n = dir < 0 ? n.previousSibling : n.nextSibling;
  return n;
};

/**
 * Instala a captura de edição sob sugestão em um elemento editável (parágrafo/título).
 * @param {HTMLElement} el
 * @param {{bloco:object, doc:object, perfil:()=>({id:string,nome:string,cor:string}), ativo:()=>boolean,
 *   aoAlterar:()=>void}} ctx
 */
export function instalarSugestaoInline(el, ctx) {
  const registros = () => garantirEstruturaSugestoes(ctx.doc);
  const regDe = (id) => registros().find(s => s.id === id);

  const novaSugestao = (tipo, textoOriginal, textoNovo) => {
    const p = ctx.perfil();
    return registrarSugestao(ctx.doc, {
      blocoId: ctx.bloco.id, tipo, textoOriginal, textoNovo,
      autor: p.nome, autorId: p.id, corAutor: p.cor
    });
  };

  /** Funde marcas vizinhas do mesmo autor/tipo (Backspace repetido vira UMA exclusão). */
  const fundirVizinhas = (marca) => {
    const simples = (m) => {
      const r = regDe(m.dataset.sugestaoId);
      return r && (r.tipo === 'insercao' || r.tipo === 'exclusao');
    };
    const pode = (a, b) => a && b && a.nodeType === 1 && b.nodeType === 1 && a.tagName === b.tagName
      && a.classList.contains('ath-sug-mark') && b.classList.contains('ath-sug-mark')
      && a.dataset.autorId === b.dataset.autorId && a.dataset.sugestaoId !== b.dataset.sugestaoId
      && simples(a) && simples(b);
    const fundir = (a, b) => {
      const ra = regDe(a.dataset.sugestaoId);
      const rb = regDe(b.dataset.sugestaoId);
      if (a.tagName === 'DEL') ra.textoOriginal += rb.textoOriginal; else ra.textoNovo += rb.textoNovo;
      while (b.firstChild) a.appendChild(b.firstChild);
      b.remove();
      ctx.doc.sugestoes = registros().filter(s => s.id !== rb.id);
      return a;
    };
    let atual = marca;
    const ant = irmao(atual, -1);
    if (pode(ant, atual)) atual = fundir(ant, atual);
    const prox = irmao(atual, 1);
    if (pode(atual, prox)) atual = fundir(atual, prox);
    return atual;
  };

  /** Reflete o DOM nos registros e descarta inserções que ficaram vazias. */
  const sincronizar = () => {
    el.querySelectorAll('ins.ath-sug-mark').forEach(m => {
      const reg = regDe(m.dataset.sugestaoId);
      if (!m.textContent) {
        m.remove();
        if (reg && !reg.textoOriginal) ctx.doc.sugestoes = registros().filter(s => s.id !== reg.id);
        else if (reg) { reg.textoNovo = ''; reg.tipo = 'exclusao'; }
      } else if (reg) {
        reg.textoNovo = m.textContent;
      }
    });
  };

  const concluir = () => {
    sincronizar();
    ctx.aoAlterar();
  };

  el.addEventListener('beforeinput', (e) => {
    if (!ctx.ativo()) return;
    const tipo = e.inputType || '';
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return;
    const perfil = ctx.perfil();
    const propria = (m) => m && m.tagName === 'INS' && m.dataset.autorId === perfil.id;

    // ── Exclusões ──
    if (tipo.startsWith('delete')) {
      let alvo = range;
      const trs = e.getTargetRanges?.();
      if (trs && trs.length) {
        try {
          alvo = document.createRange();
          alvo.setStart(trs[0].startContainer, trs[0].startOffset);
          alvo.setEnd(trs[0].endContainer, trs[0].endOffset);
        } catch (_) { alvo = range; }
      }
      if (alvo.collapsed) return;
      if (!el.contains(alvo.startContainer) || !el.contains(alvo.endContainer)) { e.preventDefault(); return; }

      const mIni = marcaDe(alvo.startContainer, el);
      const mFim = marcaDe(alvo.endContainer, el);
      // apagar dentro da PRÓPRIA inserção remove de verdade (é texto ainda não aceito)
      if (mIni && mIni === mFim && propria(mIni)) return;
      if (mIni || mFim || alvo.cloneContents().querySelector?.('.ath-sug-mark, .ath-nota-ref')) { e.preventDefault(); return; }

      const texto = alvo.toString();
      if (!texto) return;
      e.preventDefault();
      const sug = novaSugestao('exclusao', texto, '');
      const del = criarNos(gerarHtmlMarcacaoSugestao(sug))[0];
      alvo.deleteContents();
      alvo.insertNode(del);
      const final = fundirVizinhas(del);
      // Backspace: o cursor fica antes (continua apagando para a esquerda); Delete: depois
      colocarCursor(final, tipo.includes('Backward') ? 'antes' : 'depois');
      concluir();
      return;
    }

    // ── Inserções (digitação, colagem) ──
    if (tipo === 'insertText' || tipo === 'insertFromPaste' || tipo === 'insertFromDrop' || tipo === 'insertReplacementText') {
      const dados = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      if (!dados) return;

      if (!range.collapsed) {
        const mIni = marcaDe(range.startContainer, el);
        const mFim = marcaDe(range.endContainer, el);
        if (mIni && mIni === mFim && propria(mIni)) return; // substitui dentro da própria inserção
        if (mIni || mFim || range.cloneContents().querySelector?.('.ath-sug-mark, .ath-nota-ref')) { e.preventDefault(); return; }
        e.preventDefault();
        const sug = novaSugestao('substituicao', range.toString(), dados);
        const nos = criarNos(gerarHtmlMarcacaoSugestao(sug));
        range.deleteContents();
        const frag = document.createDocumentFragment();
        nos.forEach(n => frag.appendChild(n));
        range.insertNode(frag);
        const ins = el.querySelector(`ins[data-sugestao-id="${sug.id}"]`);
        if (ins) colocarCursor(ins, 'dentro-fim');
        concluir();
        return;
      }

      const m = marcaDe(range.startContainer, el);
      if (propria(m)) return; // continua digitando dentro da própria inserção (comportamento nativo)
      if (m) { range.setStartAfter(m); range.collapse(true); } // dentro de marca alheia/exclusão: insere logo depois

      e.preventDefault();
      const sug = novaSugestao('insercao', '', dados);
      const ins = criarNos(gerarHtmlMarcacaoSugestao(sug))[0];
      range.insertNode(ins);
      const final = fundirVizinhas(ins);
      colocarCursor(final, 'dentro-fim');
      concluir();
    }
  });

  // digitação nativa dentro da própria inserção: mantém o registro em dia
  el.addEventListener('input', () => { if (ctx.ativo()) sincronizar(); });
}

// ───────────────────────────── Card de decisão ─────────────────────────────

let cardAtivo = null;
let removerListeners = null;

export function fecharCardSugestao() {
  if (removerListeners) { removerListeners(); removerListeners = null; }
  cardAtivo?.remove();
  cardAtivo = null;
}

export function formatarQuandoSugestao(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROTULO_TIPO = { insercao: 'Inserção', exclusao: 'Exclusão', substituicao: 'Substituição' };

function trecho(t, max = 160) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Card contextual de uma sugestão: autor, data/hora, o que mudou e botões Aceitar / Rejeitar.
 * @param {{doc:object, sugestaoId:string, ancora:HTMLElement, aoResolver:(acao:'aceitar'|'rejeitar', sug:object)=>void}} p
 */
export function abrirCardSugestao({ doc, sugestaoId, ancora, aoResolver }) {
  fecharCardSugestao();
  const sug = garantirEstruturaSugestoes(doc).find(s => s.id === sugestaoId);
  if (!sug) return null;

  const card = document.createElement('div');
  card.className = 'ath-card-sugestao';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Sugestão de revisão');

  const cabec = document.createElement('div');
  cabec.className = 'ath-card-sug-topo';
  const avatar = document.createElement('span');
  avatar.className = 'ath-card-sug-avatar';
  avatar.style.background = /^#[0-9a-f]{3,8}$/i.test(sug.corAutor || '') ? sug.corAutor : '#10B981';
  avatar.textContent = (sug.autor || '?').trim().charAt(0).toUpperCase();
  const quem = document.createElement('div');
  quem.className = 'ath-card-sug-quem';
  const nome = document.createElement('strong');
  nome.textContent = sug.autor || 'Revisor';
  const quando = document.createElement('span');
  quando.textContent = `${ROTULO_TIPO[sug.tipo] || 'Sugestão'} · ${formatarQuandoSugestao(sug.criadoEm)}`;
  quem.append(nome, quando);
  cabec.append(avatar, quem);
  card.appendChild(cabec);

  const corpo = document.createElement('div');
  corpo.className = 'ath-card-sug-corpo';
  if (sug.textoOriginal) {
    const d = document.createElement('div');
    d.className = 'ath-card-sug-linha del';
    d.textContent = trecho(sug.textoOriginal);
    corpo.appendChild(d);
  }
  if (sug.textoNovo) {
    const i = document.createElement('div');
    i.className = 'ath-card-sug-linha ins';
    i.textContent = trecho(sug.textoNovo);
    corpo.appendChild(i);
  }
  card.appendChild(corpo);

  const acoes = document.createElement('div');
  acoes.className = 'ath-card-sug-acoes';
  const resolver = (acao) => {
    const ok = acao === 'aceitar' ? aceitarSugestaoNoDocumento(doc, sugestaoId) : rejeitarSugestaoNoDocumento(doc, sugestaoId);
    fecharCardSugestao();
    if (ok) aoResolver?.(acao, sug);
  };
  const btnAceitar = document.createElement('button');
  btnAceitar.type = 'button';
  btnAceitar.className = 'ath-btn-sug-aceitar';
  btnAceitar.textContent = '✓ Aceitar';
  btnAceitar.addEventListener('click', () => resolver('aceitar'));
  const btnRejeitar = document.createElement('button');
  btnRejeitar.type = 'button';
  btnRejeitar.className = 'ath-btn-sug-rejeitar';
  btnRejeitar.textContent = '✗ Rejeitar';
  btnRejeitar.addEventListener('click', () => resolver('rejeitar'));
  acoes.append(btnAceitar, btnRejeitar);
  card.appendChild(acoes);

  document.body.appendChild(card);
  cardAtivo = card;

  // posição: abaixo da marca, dentro da janela
  const r = ancora.getBoundingClientRect();
  const w = card.offsetWidth || 280;
  const h = card.offsetHeight || 150;
  card.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
  const abaixo = r.bottom + 8;
  card.style.top = `${abaixo + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 8) : abaixo}px`;

  const fora = (e) => { if (!card.contains(e.target) && !e.target.closest?.(SEL_MARCA)) fecharCardSugestao(); };
  const esc = (e) => { if (e.key === 'Escape') fecharCardSugestao(); };
  document.addEventListener('mousedown', fora, true);
  document.addEventListener('keydown', esc, true);
  removerListeners = () => {
    document.removeEventListener('mousedown', fora, true);
    document.removeEventListener('keydown', esc, true);
  };
  btnAceitar.focus({ preventScroll: true });
  return card;
}
