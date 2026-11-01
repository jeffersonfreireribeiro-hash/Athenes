// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
let t = fs.readFileSync('src/ui/athenes_editor.js', 'utf8');
const crlf = t.includes('\r\n');
t = t.replace(/\r\n/g, '\n');
t = t.replace(/text-align:\$\{b\.alinhamento \|\| '(left|justify)'\}/g, (m, d) => `text-align:\${alinhamentoCss(b.alinhamento, '${d}')}`);
t = t.replace("export class EditorView {",
  "const ALINHAMENTO_CSS = { esquerda: 'left', centro: 'center', direita: 'right', justificado: 'justify' };\nfunction alinhamentoCss(valor, padrao) {\n  return ALINHAMENTO_CSS[valor] || padrao;\n}\n\nexport class EditorView {");
if (crlf) t = t.replace(/\n/g, '\r\n');
fs.writeFileSync('src/ui/athenes_editor.js', t);
console.log((t.match(/alinhamentoCss\(/g) || []).length);
