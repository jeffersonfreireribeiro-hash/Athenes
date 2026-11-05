// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Controles de "Marcadores e numeração" do estilo de texto.
 * Três escolhas: Nenhum, Marcadores (paleta de símbolos) e Sequência (paleta de formatos: 1. / a) / (i) / 01 –…).
 * Só o estilo de texto tem marcador/numeração: o bloco não sobrescreve nada.
 */
import { SIMBOLOS_MARCADOR, FORMATOS_SEQUENCIA, rotuloMarcador } from '../core/athenes_marcadores.js';

const nomeEstilo = (id) => ({ decimal: 'Números', decimal_zero: 'Números com zero', lower_alpha: 'Letras minúsculas', upper_alpha: 'Letras maiúsculas', lower_roman: 'Romanos minúsculos', upper_roman: 'Romanos maiúsculos' }[id] || id);
const nomeSep = (id) => ({ ponto: 'com ponto', parentese: 'com parêntese', entre_parenteses: 'entre parênteses', travessao: 'com travessão' }[id] || id);

/** Seção "Marcadores e numeração" do estilo de texto (ligada por ligarMarcadoresEstilo). */
export function htmlMarcadoresEstilo() {
  const campoNum = (mk, rot, extra) => `<label class="ath-mk-campo">${rot}<input type="number" class="ath-input" data-mk="${mk}" ${extra}></label>`;
  const simbolos = SIMBOLOS_MARCADOR.map(s => `<button type="button" class="ath-mk-cel" data-mk-simbolo="${s}" title="Marcador ${s}" aria-label="Marcador ${s}">${s}</button>`).join('');
  const formatos = FORMATOS_SEQUENCIA.map(f => `<button type="button" class="ath-mk-cel ath-mk-cel-seq" data-mk-estilo="${f.estilo}" data-mk-sep="${f.sep}" title="${nomeEstilo(f.estilo)}, ${nomeSep(f.sep)}">${rotuloMarcador({ tipo: 'numero', estiloNum: f.estilo, separador: f.sep }, 1)}</button>`).join('');
  return `<div id="athMarcadoresEstilo" class="ath-mk">
    <span class="ath-mk-titulo">Marcadores e numeração</span>
    <div class="ath-mk-modos" role="tablist" aria-label="Tipo de marcação">
      <button type="button" role="tab" data-mk-modo="nenhum">Nenhum</button>
      <button type="button" role="tab" data-mk-modo="marcadores">Marcadores</button>
      <button type="button" role="tab" data-mk-modo="sequencia">Sequência</button>
    </div>
    <div class="ath-mk-painel" data-mk-painel="marcadores">
      <div class="ath-mk-grade" role="listbox" aria-label="Símbolos de marcador">${simbolos}</div>
    </div>
    <div class="ath-mk-painel" data-mk-painel="sequencia">
      <div class="ath-mk-grade ath-mk-grade-seq" role="listbox" aria-label="Formatos de sequência">${formatos}</div>
      <div class="ath-mk-linha">${campoNum('inicio', 'Iniciar em', 'min="1" max="999" step="1"')}${campoNum('nivel', 'Nível', 'min="1" max="5" step="1"')}</div>
    </div>
    <div class="ath-mk-painel ath-mk-comum" data-mk-painel="comum">
      <div class="ath-mk-linha">
        <label class="ath-mk-campo">Alinhamento do marcador<select class="ath-select" data-mk="alinhamento"><option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option></select></label>
        ${campoNum('tab', 'Tabulação (cm)', 'min="0.3" max="3" step="0.1"')}
      </div>
    </div>
    <small class="ath-mk-dica">Vale para todo texto com este estilo. A sequência continua entre blocos seguidos e recomeça quando um bloco sem numeração aparece no meio.</small>
  </div>`;
}

/** Liga os controles ao rascunho do estilo (marcador_* em mm, como no formato do tema). */
export function ligarMarcadoresEstilo(raiz, r, aoMudar) {
  const caixa = raiz.querySelector('#athMarcadoresEstilo');
  if (!caixa) return;
  const q = (n) => caixa.querySelector(`[data-mk="${n}"]`);
  const GLIFOS_ANTIGOS = { circulo: '•', quadrado: '▪' }; // tipos antigos que existem na paleta
  q('alinhamento').value = r.marcador_alinhamento || 'left';
  q('inicio').value = r.marcador_inicio ?? 1;
  q('nivel').value = r.marcador_nivel ?? 1;
  q('tab').value = Math.round((r.marcador_tab_mm ?? 7) / 10 * 100) / 100;

  const modoAtual = () => (!r.marcador_tipo || r.marcador_tipo === 'nenhum') ? 'nenhum' : (r.marcador_tipo === 'numero' ? 'sequencia' : 'marcadores');
  const simboloAtual = () => r.marcador_tipo === 'simbolo' ? r.marcador_simbolo : GLIFOS_ANTIGOS[r.marcador_tipo];

  const desenhar = () => {
    const modo = modoAtual();
    caixa.querySelectorAll('[data-mk-modo]').forEach(b => { const on = b.dataset.mkModo === modo; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    caixa.querySelector('[data-mk-painel="marcadores"]').hidden = modo !== 'marcadores';
    caixa.querySelector('[data-mk-painel="sequencia"]').hidden = modo !== 'sequencia';
    caixa.querySelector('[data-mk-painel="comum"]').hidden = modo === 'nenhum';
    const sim = simboloAtual();
    caixa.querySelectorAll('[data-mk-simbolo]').forEach(b => { const on = b.dataset.mkSimbolo === sim; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    caixa.querySelectorAll('[data-mk-estilo]').forEach(b => { const on = modo === 'sequencia' && b.dataset.mkEstilo === (r.marcador_estilo_num || 'decimal') && b.dataset.mkSep === (r.marcador_separador || 'ponto'); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  };
  const limparNumeracao = () => { delete r.marcador_estilo_num; delete r.marcador_separador; delete r.marcador_inicio; };
  const lerCampos = () => {
    r.marcador_alinhamento = q('alinhamento').value;
    r.marcador_nivel = Math.min(5, Math.max(1, parseInt(q('nivel').value, 10) || 1));
    r.marcador_tab_mm = Math.min(30, Math.max(3, (parseFloat(q('tab').value) || 0.7) * 10));
    if (r.marcador_tipo === 'numero') r.marcador_inicio = Math.max(1, parseInt(q('inicio').value, 10) || 1);
  };
  const concluir = () => { desenhar(); aoMudar?.(); };

  caixa.querySelectorAll('[data-mk-modo]').forEach(b => b.addEventListener('click', () => {
    const modo = b.dataset.mkModo;
    if (modo === 'nenhum') {
      ['tipo', 'simbolo', 'estilo_num', 'separador', 'inicio', 'nivel', 'tab_mm', 'alinhamento'].forEach(k => delete r[`marcador_${k}`]);
    } else if (modo === 'marcadores') {
      r.marcador_tipo = 'simbolo'; r.marcador_simbolo = simboloAtual() || '•'; limparNumeracao(); lerCampos();
    } else {
      r.marcador_tipo = 'numero'; delete r.marcador_simbolo; r.marcador_estilo_num = r.marcador_estilo_num || 'decimal'; r.marcador_separador = r.marcador_separador || 'ponto'; lerCampos();
    }
    concluir();
  }));
  caixa.querySelectorAll('[data-mk-simbolo]').forEach(b => b.addEventListener('click', () => {
    r.marcador_tipo = 'simbolo'; r.marcador_simbolo = b.dataset.mkSimbolo; limparNumeracao(); lerCampos(); concluir();
  }));
  caixa.querySelectorAll('[data-mk-estilo]').forEach(b => b.addEventListener('click', () => {
    r.marcador_tipo = 'numero'; delete r.marcador_simbolo; r.marcador_estilo_num = b.dataset.mkEstilo; r.marcador_separador = b.dataset.mkSep; lerCampos(); concluir();
  }));
  caixa.querySelectorAll('[data-mk]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { if (modoAtual() === 'nenhum') return; lerCampos(); concluir(); }));
  desenhar();
}

