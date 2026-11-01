// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
let t = fs.readFileSync('src/ui/athenes_editor.js', 'utf8');
const crlf = t.includes('\r\n');
t = t.replace(/\r\n/g, '\n');
t = t.replace("const txtCab = (mestraPag.cabecalho.texto || '').replace('{{documento.titulo}}', this.doc.titulo || '');",
  "const txtCab = (mestraPag.cabecalho.texto || '')\n          .replace(/\\{\\{?\\s*documento\\.titulo\\s*\\}?\\}/g, this.doc.titulo || '')\n          .replace(/\\{\\{?\\s*documento\\.instituicao\\s*\\}?\\}/g, this.doc.metadados?.instituicao || '')\n          .replace(/\\n/g, ' · ');");
if (crlf) t = t.replace(/\n/g, '\r\n');
fs.writeFileSync('src/ui/athenes_editor.js', t);
console.log('ok');
