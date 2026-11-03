// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Controles de "Marcadores e numeração" (bloco e estilo de texto).
 * Bloco: sobrescreve o estilo; "Nenhum" no bloco desliga o marcador herdado do estilo.
 */
import { TIPOS_MARCADOR, ESTILOS_NUMERO, SEPARADORES_NUMERO, marcadorEfetivo } from '../core/athenes_marcadores.js';

const op = (valor, rotulo, atual) => `<option value="${valor}" ${valor === atual ? 'selected' : ''}>${rotulo}</option>`;

/** Painel de marcadores do bloco (parágrafo ou título). `estiloBase` é o estilo de texto do bloco; `estilos` serve ao "Estilo de caractere". */
export function htmlMarcadoresBloco(b, estiloBase, estilos = []) {
  const ef = marcadorEfetivo(b, estiloBase);
  const tipo = ef?.tipo || 'nenhum';
  const herdado = !b.marcador_tipo && estiloBase?.marcador_tipo && estiloBase.marcador_tipo !== 'nenhum';
  return `<div style="border:1px solid var(--ath-primary-line, #C8D7E6); border-radius:10px; padding:10px 12px; margin-top:4px; background:#fff;">
    <div style="font:800 11.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
      <span>Marcadores e Numeração</span>
      <span style="font-size:10px; color:var(--glx-muted); text-transform:none; font-weight:600;">${herdado ? 'vem do estilo de texto' : 'Listas & Alíneas'}</span>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <label style="font-size:11px; font-weight:700; color:var(--ath-text, #1F2733);">Tipo
        <select id="rmMarcadorTipo" class="glx-select">${TIPOS_MARCADOR.map(([v, r]) => op(v, v === 'nenhum' ? 'Nenhuma lista' : r, tipo)).join('')}</select>
      </label>
      <div id="rmBoxMarcadorConfig" style="display:${tipo !== 'nenhum' ? 'flex' : 'none'}; flex-direction:column; gap:8px;">
        <div id="rmBoxMarcadorNumerico" style="display:${tipo === 'numero' ? 'flex' : 'none'}; flex-direction:column; gap:8px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <label style="font-size:11px; color:var(--glx-muted);">Numeração
              <select id="rmMarcadorEstiloNum" class="glx-select">${ESTILOS_NUMERO.map(([v, r]) => op(v, r, ef?.estiloNum || 'decimal')).join('')}</select>
            </label>
            <label style="font-size:11px; color:var(--glx-muted);">Pontuação
              <select id="rmMarcadorSeparador" class="glx-select">${SEPARADORES_NUMERO.map(([v, r]) => op(v, r, ef?.separador || 'ponto')).join('')}</select>
            </label>
          </div>
          <label style="font-size:11px; color:var(--glx-muted);">Iniciar em <small>(só vale se maior que 1; a contagem continua entre blocos seguidos)</small>
            <input type="number" id="rmMarcadorInicio" class="glx-input" min="1" max="999" value="${b.marcador_inicio ?? 1}">
          </label>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:end;">
          <label style="font-size:11px; color:var(--glx-muted);">Nível
            <input type="number" id="rmMarcadorNivel" class="glx-input" min="1" max="5" value="${ef?.nivel ?? 1}">
          </label>
          <label style="font-size:11px; color:var(--glx-muted);">Tabulação (mm)
            <input type="number" id="rmMarcadorTabMm" class="glx-input" min="3" max="30" step="0.5" value="${ef?.tabMm ?? 7}">
          </label>
        </div>
        <label style="font-size:11px; color:var(--glx-muted);">Alinhamento do marcador
          <select id="rmMarcadorAlinhamento" class="glx-select">${[['left', 'Esquerda'], ['center', 'Centralizado'], ['right', 'Direita']].map(([v, r]) => op(v, r, ef?.alinhamento || 'left')).join('')}</select>
        </label>
      </div>
    </div>
  </div>`;
}

/**
 * Liga os controles do bloco. `aoMudar(estrutural)` grava; `aoTrocarTipo()` roda antes de redesenhar (ex.: converter o HTML do texto).
 */
export function ligarMarcadoresBloco(box, b, estiloBase, { aoMudar, aoTrocarTipo } = {}) {
  const q = (id) => box.querySelector(`#${id}`);
  const grava = (campo, valor) => { b[campo] = valor; aoMudar?.(true); };

  q('rmMarcadorTipo')?.addEventListener('change', e => {
    const val = e.target.value;
    if (val === 'nenhum') {
      if (marcadorEfetivo({}, estiloBase)) b.marcador_tipo = 'nenhum'; // o estilo tem marcador: este bloco o desliga
      else delete b.marcador_tipo;
    } else {
      b.marcador_tipo = val;
      if (val === 'numero') {
        b.marcador_estilo_num = b.marcador_estilo_num || estiloBase?.marcador_estilo_num || 'decimal';
        b.marcador_separador = b.marcador_separador || estiloBase?.marcador_separador || 'ponto';
      }
    }
    aoTrocarTipo?.();
    aoMudar?.(true);
    // quem chama redesenha o painel: as seções de numeração aparecem/somem conforme o tipo
    if (box.isConnected) {
      const cfg = q('rmBoxMarcadorConfig'); const num = q('rmBoxMarcadorNumerico');
      if (cfg) cfg.style.display = val === 'nenhum' ? 'none' : 'flex';
      if (num) num.style.display = val === 'numero' ? 'flex' : 'none';
    }
  });
  q('rmMarcadorEstiloNum')?.addEventListener('change', e => grava('marcador_estilo_num', e.target.value));
  q('rmMarcadorSeparador')?.addEventListener('change', e => grava('marcador_separador', e.target.value));
  q('rmMarcadorInicio')?.addEventListener('change', e => grava('marcador_inicio', Math.max(1, parseInt(e.target.value, 10) || 1)));
  q('rmMarcadorNivel')?.addEventListener('change', e => grava('marcador_nivel', Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1))));
  q('rmMarcadorTabMm')?.addEventListener('change', e => grava('marcador_tab_mm', Math.max(3, parseFloat(e.target.value) || 7)));
  q('rmMarcadorAlinhamento')?.addEventListener('change', e => grava('marcador_alinhamento', e.target.value));
}

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
