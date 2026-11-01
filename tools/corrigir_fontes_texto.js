// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';

function editar(arq, fn) {
  const bruto = fs.readFileSync(arq, 'utf8');
  const crlf = bruto.includes('\r\n');
  let t = bruto.replace(/\r\n/g, '\n');
  t = fn(t);
  if (crlf) t = t.replace(/\n/g, '\r\n');
  fs.writeFileSync(arq, t, 'utf8');
}

// 1. Editor: FONTES_SISTEMA é um objeto (não array) e PESOS_FONTE usa "rotulo"
editar('src/ui/athenes_editor.js', t => t
  .replace("${FONTES_SISTEMA.map(f => `<option value=\"${f.nome}\" ${f.nome === estAtivo.fonte ? 'selected' : ''}>${f.nome} (${f.classificacao})</option>`).join('')}",
    "${Object.values(FONTES_SISTEMA).map(f => `<option value=\"${f.id}\" ${f.id === estAtivo.fonte ? 'selected' : ''}>${f.rotulo}</option>`).join('')}")
  .replace("${PESOS_FONTE.map(p => `<option value=\"${p.valor}\" ${p.valor === estAtivo.peso ? 'selected' : ''}>${p.nome}</option>`).join('')}",
    "${PESOS_FONTE.map(p => `<option value=\"${p.valor}\" ${p.valor === estAtivo.peso ? 'selected' : ''}>${p.rotulo}</option>`).join('')}")
  .replace("import { estiloParaCss } from '../core/athenes_estilos.js';",
    "import { estiloParaCss, FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';"));

// 2. Estilos: o estilo de código também usa Nunito (linguagem tipográfica única)
editar('src/core/athenes_estilos.js', t => t.replace("fonte: 'consolas',", "fonte: 'nunito',"));

// 3. Tokens Glaux ausentes + Nunito em tudo
editar('src/css/athenes_base.css', t => {
  if (t.includes('--glx-font:')) return t;
  return t.replace('  --ath-primary-ink: #D9531E;\n',
    `  --ath-primary-ink: #D9531E;

  /* Tokens compatíveis com o Glaux GIS */
  --glx-font: 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --glx-font-mono: 'Nunito', system-ui, sans-serif;
  --glx-primary: #FF6B2C;
  --glx-text: #1F2733;
  --glx-text-secondary: #475569;
  --glx-muted: #6B7585;
  --glx-field: #F4F5F8;
  --glx-line: #E2E8F0;
`);
});

editar('src/css/athenes_editor.css', t => t + `

/* =========================================================================
   Linguagem tipográfica única: Nunito em toda a interface e na folha
   ========================================================================= */
html, body, button, input, select, textarea, option, summary, label, table,
.rm-conteudo, .rm-conteudo *, .glx-btn, .glx-select, .ath-folha-a4, .ath-folha-a4 * {
  font-family: var(--glx-font, 'Nunito', system-ui, sans-serif);
}
.ath-formula-corpo, .rm-var code, .rm-hex { font-family: var(--glx-font, 'Nunito', sans-serif); }

/* Botões e selects do padrão Glaux (glx-btn / glx-select) ausentes no Athenes */
.glx-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid #E6E9EF; border-radius: 999px; background: #fff; color: #1F2733; font: 700 12.5px var(--glx-font); padding: 0 14px; height: 34px; cursor: pointer; transition: background .12s, border-color .12s, color .12s; }
.glx-btn:hover { border-color: #FF6B2C; color: #D9531E; background: #FFF8F4; }
.glx-btn-sm { height: 32px; padding: 0 12px; font-size: 12px; }
.glx-btn-soft { background: #F4F5F8; border-color: transparent; }
.glx-btn-primary { background: #FF6B2C; border-color: #FF6B2C; color: #fff; }
.glx-btn-primary:hover { background: #D9531E; border-color: #D9531E; color: #fff; }
.glx-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.rm-main select, .glx-select { width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 999px; background: #fff; padding: 0 14px; font: 600 13px var(--glx-font); color: #1F2733; }
.rm-main select:focus { outline: none; border-color: #FF6B2C; box-shadow: 0 0 0 3px rgba(255,107,44,.14); }

/* Ícones SVG do Athenes herdam o traço Glaux */
.ath-icon { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

/* Layout: o conteúdo ocupa a altura toda e as colunas rolam sozinhas */
.rm-editor { flex: 1 1 0; min-height: 0; padding: 12px 14px; }
.rm-ed-grade { flex: 1 1 0; min-height: 0; align-items: stretch; }
.rm-col-esq, .rm-col-dir { min-height: 0; overflow-y: auto; overflow-x: hidden; }
.rm-col-prev { min-height: 0; position: static; }
.rm-prev-palco { flex: 1 1 0; min-height: 0; border-radius: 18px; }
.ath-folha-a4 { flex-shrink: 0; }
`);
console.log('ok');
