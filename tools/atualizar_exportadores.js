// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';

let docxCode = fs.readFileSync('src/core/athenes_export_docx.js', 'utf8');

const targetDocx = "} else if (b.tipo === 'tabela') {";
const replacementDocx = `} else if (b.tipo === 'quadro') {
        const cols = b.colunas || [];
        const linhas = b.linhas || [];
        const gridColsXml = cols.map(() => '<w:gridCol w:w="2200"/>').join('');

        let tblRowsXml = '';
        if (b.com_cabecalho !== false && cols.length) {
          const cels = cols.map(c => \`<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(c)}</w:t></w:r></w:p></w:tc>\`).join('');
          tblRowsXml += \`<w:tr><w:trPr><w:tblHeader/></w:trPr>\${cels}</w:tr>\`;
        }

        for (const lin of linhas) {
          const cels = (Array.isArray(lin) ? lin : []).map(val => \`<w:tc><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(limparHtmlParaTexto(val))}</w:t></w:r></w:p></w:tc>\`).join('');
          tblRowsXml += \`<w:tr>\${cels}</w:tr>\`;
        }

        if (b.titulo) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(b.titulo)}</w:t></w:r></w:p>\`);
        }

        bodyXmlParts.push(\`<w:tbl>
          <w:tblPr>
            <w:tblW w:w="0" w:type="auto"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="12" w:space="0" w:color="1F2733"/>
              <w:bottom w:val="single" w:sz="12" w:space="0" w:color="1F2733"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="12" w:space="0" w:color="1F2733"/>
              <w:right w:val="single" w:sz="12" w:space="0" w:color="1F2733"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tblGrid>\${gridColsXml}</w:tblGrid>
          \${tblRowsXml}
        </w:tbl>\`);

        if (b.fonte) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>\${escaparXml(b.fonte)}</w:t></w:r></w:p>\`);
        }
      } else if (b.tipo === 'figura') {
        if (b.titulo) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(b.titulo)}</w:t></w:r></w:p>\`);
        }
        bodyXmlParts.push(\`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>[Ilustração / Grid de Imagens - Layout \${escaparXml(b.layout || '1')}]</w:t></w:r></w:p>\`);
        if (b.legenda_geral) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(b.legenda_geral)}</w:t></w:r></w:p>\`);
        }
        if (b.fonte) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>\${escaparXml(b.fonte)}</w:t></w:r></w:p>\`);
        }
      } else if (b.tipo === 'mapa') {
        if (b.titulo) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(b.titulo)}</w:t></w:r></w:p>\`);
        }
        bodyXmlParts.push(\`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>[Mapa Territorial - Escala: \${escaparXml(b.escala || '1:10.000')}\${b.orientacao_norte ? ' | Norte Verdadeiro' : ''}]</w:t></w:r></w:p>\`);
        if (b.legenda_cartografica) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>\${escaparXml(b.legenda_cartografica)}</w:t></w:r></w:p>\`);
        }
        if (b.fonte) {
          bodyXmlParts.push(\`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>\${escaparXml(b.fonte)}</w:t></w:r></w:p>\`);
        }
      } else if (b.tipo === 'tabela') {`;

if (docxCode.includes(targetDocx)) {
  docxCode = docxCode.replace(targetDocx, replacementDocx);
  fs.writeFileSync('src/core/athenes_export_docx.js', docxCode, 'utf8');
  console.log('athenes_export_docx.js atualizado com sucesso!');
} else {
  console.log('Target não encontrado em athenes_export_docx.js');
}
