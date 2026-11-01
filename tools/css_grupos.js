// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
let t = fs.readFileSync('src/css/athenes_editor.css', 'utf8');
const crlf = t.includes('\r\n');
const css = `

/* =========================================================================
   Estilos de texto em lista, salvar estilo e arrastar blocos
   ========================================================================= */
.rm-lista-estilos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; scrollbar-width: thin; }
.rm-estilo-item { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; padding: 7px 12px 7px 8px; border: 1px solid #E6E9EF; border-radius: 14px; background: #fff; cursor: pointer; font-family: var(--glx-font); transition: border-color .12s, background .12s; }
.rm-estilo-item:hover { border-color: #FF6B2C; background: #FFF8F4; }
.rm-estilo-item.on { border-color: #FF6B2C; background: #FFF1EB; box-shadow: 0 0 0 2px rgba(255,107,44,.18); }
.rm-estilo-amostra { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: #F4F5F8; font-size: 15px; }
.rm-estilo-item.on .rm-estilo-amostra { background: #fff; }
.rm-estilo-nome { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.rm-estilo-nome strong { font-size: 12.5px; font-weight: 800; color: #1F2733; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rm-estilo-nome small { font-size: 11px; color: #6B7585; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rm-estilo-tag { font-style: normal; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 999px; background: #FFF1EB; color: #D9531E; }
.rm-estilo-previa { padding: 10px 14px; border: 1px dashed #CBD5E1; border-radius: 14px; background: #fff; }
.rm-estilo-acoes { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
.rm-estilo-acoes .glx-btn:disabled { opacity: .45; cursor: not-allowed; }
.rm-estilo-acoes .rm-perigo { color: #B42318; }
.rm-ic-bt.on { background: #FF6B2C; border-color: #FF6B2C; color: #fff; box-shadow: 0 4px 10px rgba(255,107,44,.28); }

/* Alça lateral de mover, na própria folha */
.ath-bloco-alca { position: absolute; left: -26px; top: 2px; width: 22px; height: 30px; padding: 0; display: grid; place-items: center; border: 0; border-radius: 8px; background: #fff; color: #94A3B8; cursor: grab; opacity: 0; box-shadow: 0 1px 4px rgba(15,23,42,.16); transition: opacity .12s, color .12s, background .12s; z-index: 5; }
.ath-bloco-alca:active { cursor: grabbing; }
.ath-bloco-alca:hover { color: #FF6B2C; background: #FFF8F4; }
.ath-bloco-alca.topo { left: 4px; top: -15px; width: 30px; height: 20px; transform: none; }
.ath-bloco-alca.topo svg { transform: rotate(90deg); }
.ath-bloco-folha:hover > .ath-bloco-alca, .ath-bloco-folha.sel > .ath-bloco-alca { opacity: 1; }
.ath-bloco-alca svg { stroke: none; }

/* Marcas de soltura na folha */
.ath-bloco-folha.arrastando { opacity: .4; }
.ath-bloco-folha.drop-antes { box-shadow: 0 -4px 0 0 #FF6B2C; }
.ath-bloco-folha.drop-depois { box-shadow: 0 4px 0 0 #FF6B2C; }
.ath-bloco-folha.drop-grupo { background: #FFF4EE; outline: 2px dashed #FF6B2C; outline-offset: -2px; }
.ath-bloco-folha.drop-grupo.drop-esq { box-shadow: inset 6px 0 0 0 #FF6B2C; }
.ath-bloco-folha.drop-grupo.drop-dir { box-shadow: inset -6px 0 0 0 #FF6B2C; }
.rm-bl.drop-antes { box-shadow: 0 -3px 0 0 #FF6B2C; }
.rm-bl.drop-depois { box-shadow: 0 3px 0 0 #FF6B2C; }
`;
t = t.replace(/\r\n/g, '\n') + css;
if (crlf) t = t.replace(/\n/g, '\r\n');
fs.writeFileSync('src/css/athenes_editor.css', t);
console.log('css ok');
