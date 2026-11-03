// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Controles de "Marcadores e numeração" (bloco e estilo de texto).
 * Só o estilo de texto tem marcador/numeração: o bloco não sobrescreve nada.
 */
import { TIPOS_MARCADOR, ESTILOS_NUMERO, SEPARADORES_NUMERO } from '../core/athenes_marcadores.js';

const op = (valor, rotulo, atual) => `<option value="${valor}" ${valor === atual ? 'selected' : ''}>${rotulo}</option>`;

/** Seção "Marcadores e numeração" do estilo de texto (campos data-mk, ligados por ligarMarcadoresEstilo). */
export function htmlMarcadoresEstilo() {
  const sel = (mk, rot, opcoes) => `<label style="font:700 11.5px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:3px;">${rot}<select class="ath-select" data-mk="${mk}" style="height:34px;">${opcoes.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
  const num = (mk, rot, extra) => `<label style="font:700 11.5px var(--glx-font); color:#334155; display:flex; flex-direction:column; gap:3px;">${rot}<input type="number" class="ath-input" data-mk="${mk}" ${extra} style="height:34px;"></label>`;
  return `<div id="athMarcadoresEstilo" style="display:flex; flex-direction:column; gap:8px;">
    <span style="font:800 11.5px var(--glx-font); text-transform:uppercase; letter-spacing:.05em; color:#475569;">Marcadores e numeração</span>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;">
      ${sel('tipo', 'Tipo', TIPOS_MARCADOR.map(([v, r]) => [v, v === 'nenhum' ? 'Nenhum' : r]))}
      ${sel('alinhamento', 'Alinhamento do marcador', [['left', 'Esquerda'], ['center', 'Centralizado'], ['right', 'Direita']])}
      <div data-mk-num style="display:contents;">
        ${sel('estilo_num', 'Numeração', ESTILOS_NUMERO)}
        ${sel('separador', 'Pontuação', SEPARADORES_NUMERO)}
        ${num('inicio', 'Iniciar em', 'min="1" max="999" step="1"')}
      </div>
      ${num('nivel', 'Nível', 'min="1" max="5" step="1"')}
      ${num('tab', 'Tabulação (cm)', 'min="0.3" max="3" step="0.1"')}
    </div>
    <small style="color:#64748B;">Vale para todo texto com este estilo; cada bloco pode trocar ou desligar o marcador. A numeração continua entre blocos seguidos.</small>
  </div>`;
}

/** Liga os campos data-mk ao rascunho do estilo (marcador_* em mm, como no formato do tema). */
export function ligarMarcadoresEstilo(raiz, r, aoMudar) {
  const q = (n) => raiz.querySelector(`[data-mk="${n}"]`);
  if (!q('tipo')) return;
  q('tipo').value = r.marcador_tipo && r.marcador_tipo !== 'nenhum' ? r.marcador_tipo : 'nenhum';
  q('alinhamento').value = r.marcador_alinhamento || 'left';
  q('estilo_num').value = r.marcador_estilo_num || 'decimal';
  q('separador').value = r.marcador_separador || 'ponto';
  q('inicio').value = r.marcador_inicio ?? 1;
  q('nivel').value = r.marcador_nivel ?? 1;
  q('tab').value = Math.round((r.marcador_tab_mm ?? 7) / 10 * 100) / 100;
  const sincronizar = () => {
    const t = q('tipo').value;
    const caixa = raiz.querySelector('#athMarcadoresEstilo');
    caixa.querySelectorAll('[data-mk]').forEach(el => { if (el !== q('tipo')) el.closest('label').style.display = t === 'nenhum' ? 'none' : 'flex'; });
    ['estilo_num', 'separador', 'inicio'].forEach(n => { q(n).closest('label').style.display = t === 'numero' ? 'flex' : 'none'; });
  };
  sincronizar();
  const grava = () => {
    const t = q('tipo').value;
    if (t === 'nenhum') {
      ['tipo', 'estilo_num', 'separador', 'inicio', 'nivel', 'tab_mm', 'alinhamento'].forEach(k => delete r[`marcador_${k}`]);
    } else {
      r.marcador_tipo = t;
      r.marcador_alinhamento = q('alinhamento').value;
      r.marcador_nivel = Math.min(5, Math.max(1, parseInt(q('nivel').value, 10) || 1));
      r.marcador_tab_mm = Math.min(30, Math.max(3, (parseFloat(q('tab').value) || 0.7) * 10));
      if (t === 'numero') {
        r.marcador_estilo_num = q('estilo_num').value;
        r.marcador_separador = q('separador').value;
        r.marcador_inicio = Math.max(1, parseInt(q('inicio').value, 10) || 1);
      } else { delete r.marcador_estilo_num; delete r.marcador_separador; delete r.marcador_inicio; }
    }
    sincronizar();
    aoMudar?.();
  };
  raiz.querySelectorAll('[data-mk]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', grava));
}
