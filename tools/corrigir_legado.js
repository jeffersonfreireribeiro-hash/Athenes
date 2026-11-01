// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
let t = fs.readFileSync('src/ui/athenes_editor.js', 'utf8');
const crlf = t.includes('\r\n');
t = t.replace(/\r\n/g, '\n');
t = t.replace('    this.normalizarBlocosLegados();\n    repaginarDocumento(this.doc);\n    this.salvarSnapshot();',
  '    repaginarDocumento(this.doc);\n    this.normalizarBlocosLegados();\n    repaginarDocumento(this.doc);\n    this.salvarSnapshot();');
// proteção: erro ao desenhar uma página não pode esvaziar o editor
t = t.replace("    paginas.forEach(pag => {\n      const mestraPag", "    paginas.forEach(pag => {\n      try {\n      const mestraPag");
t = t.replace("      folha.appendChild(areaUtil);\n      palco.appendChild(folha);\n    });",
  "      folha.appendChild(areaUtil);\n      palco.appendChild(folha);\n      } catch (erro) {\n        const aviso = document.createElement('div');\n        aviso.className = 'rm-vazio-cartao';\n        aviso.textContent = 'Não foi possível desenhar a página ' + pag.numero + ': ' + erro.message;\n        palco.appendChild(aviso);\n      }\n    });");
if (crlf) t = t.replace(/\n/g, '\r\n');
fs.writeFileSync('src/ui/athenes_editor.js', t);
console.log('ok');
