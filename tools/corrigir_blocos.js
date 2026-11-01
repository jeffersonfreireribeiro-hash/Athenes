// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
function ed(f, fn) {
  let t = fs.readFileSync(f, 'utf8');
  const c = t.includes('\r\n');
  t = t.replace(/\r\n/g, '\n');
  t = fn(t);
  if (c) t = t.replace(/\n/g, '\r\n');
  fs.writeFileSync(f, t);
}
ed('src/core/athenes_documento.js', t => t.replace('span: dados.span || 1,', 'span: dados.span || 12,'));
ed('src/core/athenes_estilos.js', t => t.replace('text-align: justify; text-align-last: justify;', 'text-align: justify; text-align-last: left;'));
ed('src/ui/athenes_editor.js', t => t
  .replace('    repaginarDocumento(this.doc);\n    this.salvarSnapshot();\n    this.renderizar();\n  }\n\n  setDocumento',
`    this.normalizarBlocosLegados();
    repaginarDocumento(this.doc);
    this.salvarSnapshot();
    this.renderizar();
  }

  normalizarBlocosLegados() {
    for (const sec of this.doc.secoes || []) {
      for (const b of sec.blocos || []) {
        if (!b.span || (b.span === 1 && (b.col || 1) === 1)) { b.col = 1; b.span = 12; }
      }
    }
  }

  setDocumento`));
console.log('ok');
