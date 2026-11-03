// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZipBuilder } from '../src/core/zip_builder.js';
import { abrirZip } from '../src/core/athenes_zip_leitor.js';
import { importarTemplateDocx } from '../src/core/athenes_docx_importador.js';
import { criarDocumentoDeTemplate } from '../src/core/athenes_templates.js';
import { repaginarDocumento } from '../src/core/athenes_documento.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const lorem = 'Este é um parágrafo do corpo do texto com palavras suficientes para contar como texto corrido do documento. '.repeat(3);
const p = (txt, { ppr = '', rpr = '', extra = '' } = {}) => `<w:p><w:pPr>${ppr}</w:pPr>${extra}<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`;
const PNG_1PX = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));

/** Pilha de tags: o XML exportado precisa abrir e fechar tudo na ordem (o Word recusa arquivo malformado). */
function bemFormado(xml) {
  const pilha = [];
  for (const m of xml.replace(/<\?[\s\S]*?\?>/g, '').matchAll(/<(\/?)([\w:.-]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (pilha.pop() !== m[2]) return false; } else pilha.push(m[2]);
  }
  return pilha.length === 0;
}

function docxRodapeDuasLinhas() {
  const z = new ZipBuilder();
  const corpo = Array.from({ length: 6 }, () => p(lorem)).join('');
  z.add('word/document.xml', `<w:document ${W}><w:body>${corpo}<w:sectPr><w:headerReference w:type="default" r:id="rId9"/><w:footerReference w:type="default" r:id="rId10"/><w:pgSz w:w="11900" w:h="16840"/><w:pgMar w:top="2268" w:right="851" w:bottom="1418" w:left="1418" w:header="0" w:footer="454"/></w:sectPr></w:body></w:document>`);
  z.add('word/styles.xml', `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  z.add('word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId9" Target="header1.xml"/><Relationship Id="rId10" Target="footer1.xml"/></Relationships>');
  z.add('word/header1.xml', `<w:hdr ${W} xmlns:wp="x" xmlns:a="y"><w:p><w:r><w:drawing><wp:inline><wp:extent cx="2160000" cy="1150560"/><a:graphic><a:graphicData><a:blip r:embed="rId1"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:hdr>`);
  z.add('word/_rels/header1.xml.rels', '<Relationships><Relationship Id="rId1" Target="media/image1.png"/></Relationships>');
  z.add('word/media/image1.png', PNG_1PX);
  z.add('word/footer1.xml', `<w:ftr ${W}>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Aptos"/><w:sz w:val="14"/><w:color w:val="808080"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
    <w:p><w:r><w:rPr><w:rFonts w:ascii="Aptos"/><w:sz w:val="14"/><w:color w:val="808080"/></w:rPr><w:t>Evento Anual | Cidade</w:t></w:r></w:p></w:ftr>`);
  return z.build();
}

test('rodapé em duas linhas (número à direita, texto abaixo) e imagem do cabeçalho viram zonas da mestra', async () => {
  const { template } = await importarTemplateDocx(docxRodapeDuasLinhas(), { incluirConteudo: true });
  const m = template.config.mestras.find(x => x.id === 'corpo');
  assert.deepEqual(m.rodape.zonas, { esquerda: '\nEvento Anual | Cidade', centro: '', direita: '{pagina}' });
  assert.equal(m.rodape.multilinha, true);
  assert.equal(m.rodape.tamanho_pt, 7);
  assert.equal(m.rodape.cor, '#808080');
  assert.equal(m.rodape.distancia_borda_mm, 8);
  assert.equal(m.numeracao_pagina.formato, 'apenas_numero', 'só o número, como no arquivo (o "2" em cache não vira texto)');
  assert.equal(m.elementos_recorrentes.length, 1);
  assert.match(m.elementos_recorrentes[0].url, /^data:image\/png;base64,/);
  assert.equal(m.elementos_recorrentes[0].largura_mm, 60);
});

test('PDF: o rodapé em duas linhas sai com o número acima do texto', async () => {
  const { template } = await importarTemplateDocx(docxRodapeDuasLinhas(), { incluirConteudo: true });
  const doc = criarDocumentoDeTemplate(template, { titulo: 'Fiel', modoConteudo: 'placeholder' });
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /<footer[^>]*>[\s\S]*?white-space:pre-wrap;">\s*Evento Anual|<footer[^>]*>[\s\S]*?\nEvento Anual \| Cidade/);
  assert.match(html, /text-align:right[^>]*>1</, 'número na zona direita');
});

test('DOCX exportado: cabeçalho/rodapé por mestra, imagem ancorada, rodapé em 2 parágrafos e partes bem formadas', async () => {
  const { template } = await importarTemplateDocx(docxRodapeDuasLinhas(), { incluirConteudo: true });
  const doc = criarDocumentoDeTemplate(template, { titulo: 'Fiel', modoConteudo: 'placeholder' });
  repaginarDocumento(doc);
  const zip = abrirZip(await exportarParaDocx(doc));
  for (const nome of zip.nomes.filter(n => /\.(xml|rels)$/.test(n))) assert.ok(bemFormado(await zip.texto(nome)), `${nome} bem formado`);

  const rodapes = [];
  for (const n of zip.nomes.filter(n => /^word\/footer\d+\.xml$/.test(n))) { const t = await zip.texto(n); if (/Evento Anual/.test(t)) rodapes.push(t); }
  assert.ok(rodapes.length >= 1);
  assert.equal((rodapes[0].match(/<w:p>/g) || []).length, 2, 'duas linhas = dois parágrafos');
  assert.ok(rodapes[0].indexOf('PAGE') < rodapes[0].indexOf('Evento Anual'), 'o número vem acima do texto');
  assert.match(rodapes[0], /w:sz w:val="14"/);
  assert.match(rodapes[0], /w:color w:val="808080"/);

  const cabs = [];
  for (const n of zip.nomes.filter(n => /^word\/header\d+\.xml$/.test(n))) { const t = await zip.texto(n); if (/wp:anchor/.test(t)) cabs.push([n, t]); }
  assert.ok(cabs.length >= 1, 'a imagem do cabeçalho vai ancorada na página');
  assert.match(cabs[0][1], /wp:extent cx="2160000"/);
  const rels = await zip.texto(`word/_rels/${cabs[0][0].split('/').pop()}.rels`);
  assert.ok(zip.existe(`word/media/${/Target="media\/([^"]+)"/.exec(rels)[1]}`), 'a mídia existe no pacote');

  const documento = await zip.texto('word/document.xml');
  assert.match(documento, /w:footer="454"/, 'distância do rodapé à borda preservada');
  const ct = await zip.texto('[Content_Types].xml');
  for (const n of zip.nomes.filter(n => /^word\/(header|footer)\d+\.xml$/.test(n))) assert.ok(ct.includes(`/${n}`), `${n} declarado`);
  const relsDoc = await zip.texto('word/_rels/document.xml.rels');
  const usados = [...documento.matchAll(/r:id="(rId(?:Hdr|Ftr)\d+)"/g)].map(m => m[1]);
  assert.ok(usados.length >= 2);
  for (const id of usados) assert.ok(relsDoc.includes(`Id="${id}"`), `${id} existe nas relações`);
});

test('cada seção declara o cabeçalho/rodapé da PRÓPRIA mestra (capa com imagem, corpo com texto)', async () => {
  const z = new ZipBuilder();
  const capa = [p('TÍTULO', { ppr: '<w:jc w:val="center"/>', rpr: '<w:b/><w:sz w:val="40"/>' }), p('Autor', { ppr: '<w:jc w:val="center"/>' }), p('Instituição', { ppr: '<w:jc w:val="center"/>' }), p('Cidade', { ppr: '<w:jc w:val="center"/>', extra: '<w:r><w:br w:type="page"/></w:r>' })].join('');
  z.add('word/document.xml', `<w:document ${W}><w:body>${capa}${Array.from({ length: 6 }, () => p(lorem)).join('')}<w:sectPr><w:footerReference w:type="default" r:id="rId10"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1134" w:bottom="1134" w:left="1417" w:header="709" w:footer="709"/></w:sectPr></w:body></w:document>`);
  z.add('word/styles.xml', `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  z.add('word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId10" Target="footer1.xml"/></Relationships>');
  z.add('word/footer1.xml', `<w:ftr ${W}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Rodapé do corpo</w:t></w:r></w:p></w:ftr>`);
  const { template } = await importarTemplateDocx(z.build(), { incluirConteudo: true });
  const doc = criarDocumentoDeTemplate(template, { titulo: 'Duas seções', modoConteudo: 'placeholder' });
  repaginarDocumento(doc);
  const zip = abrirZip(await exportarParaDocx(doc));
  const documento = await zip.texto('word/document.xml');
  const sects = documento.match(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g);
  assert.equal(sects.length, 2);
  const idsFtr = sects.map(s => /w:footerReference w:type="default" r:id="(rIdFtr\d+)"/.exec(s)?.[1]);
  assert.ok(idsFtr[0] && idsFtr[1] && idsFtr[0] !== idsFtr[1], 'rodapés diferentes por seção (a capa não herda o do corpo)');
  const alvoDe = async (id) => /Target="([^"]+)"/.exec(new RegExp(`<Relationship Id="${id}"[^>]*>`).exec(await zip.texto('word/_rels/document.xml.rels'))[0])[1];
  assert.doesNotMatch(await zip.texto(`word/${await alvoDe(idsFtr[0])}`), /Rodapé do corpo/);
  assert.match(await zip.texto(`word/${await alvoDe(idsFtr[1])}`), /Rodapé do corpo/);
});

test('estilos tipograficamente idênticos se fundem (a capa fica isolada e os títulos não se fundem entre si)', async () => {
  const z = new ZipBuilder();
  const capa = [
    p('TÍTULO DO TRABALHO', { ppr: '<w:jc w:val="center"/>', rpr: '<w:b/><w:sz w:val="40"/>' }),
    p('Autor Um', { ppr: '<w:jc w:val="right"/>', rpr: '<w:b/><w:sz w:val="24"/>' }),
    p('Instituição', { ppr: '<w:jc w:val="right"/>', rpr: '<w:b/><w:sz w:val="24"/>' }),
    p('Cidade', { ppr: '<w:jc w:val="right"/>', rpr: '<w:b/><w:sz w:val="24"/>', extra: '<w:r><w:br w:type="page"/></w:r>' })
  ].join('');
  z.add('word/document.xml', `<w:document ${W}><w:body>${capa}${p('Seção Um', { rpr: '<w:b/><w:sz w:val="24"/>', ppr: '<w:ind w:firstLine="0"/>' })}${Array.from({ length: 6 }, () => p(lorem)).join('')}</w:body></w:document>`);
  z.add('word/styles.xml', `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  const { template, relatorio } = await importarTemplateDocx(z.build(), { incluirConteudo: true });
  const ids = template.config.estilos.map(e => e.id);
  assert.ok(ids.includes('capa'));
  assert.ok(!ids.includes('capa_info'), 'as linhas de autor (12 pt negrito) usam o mesmo estilo do título de mesma tipografia');
  assert.ok((relatorio.estilos.find(e => e.absorveu)?.absorveu || []).some(n => /Capa/.test(n)));
  const todos = template.secoes.flatMap(s => s.blocos);
  assert.ok(todos.every(b => b.tipo === 'quebra_pagina' || template.config.estilos.some(e => e.id === b.estiloId)), 'nenhum bloco aponta para estilo removido');
  assert.equal(new Set(template.config.estilos.map(e => e.id)).size, template.config.estilos.length);
});

test('logo do cabeçalho: afastamento do topo = parágrafos vazios acima dele; alinhado à margem direita', async () => {
  const z = new ZipBuilder();
  z.add('word/document.xml', `<w:document ${W}><w:body>${Array.from({ length: 6 }, () => p(lorem)).join('')}<w:sectPr><w:headerReference w:type="default" r:id="rId9"/><w:pgSz w:w="11900" w:h="16840"/><w:pgMar w:top="2268" w:right="851" w:bottom="1418" w:left="1418" w:header="0" w:footer="454"/></w:sectPr></w:body></w:document>`);
  z.add('word/styles.xml', `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  z.add('word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId9" Target="header1.xml"/></Relationships>');
  const vazio = '<w:p><w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:pPr></w:p>';
  z.add('word/header1.xml', `<w:hdr ${W} xmlns:wp="x" xmlns:a="y">${vazio}${vazio}<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="2160000" cy="1150560"/><a:graphic><a:graphicData><a:blip r:embed="rId1"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:hdr>`);
  z.add('word/_rels/header1.xml.rels', '<Relationships><Relationship Id="rId1" Target="media/image1.png"/></Relationships>');
  z.add('word/media/image1.png', PNG_1PX);
  const { template } = await importarTemplateDocx(z.build(), { incluirConteudo: true });
  const m = template.config.mestras.find(x => x.id === 'corpo');
  const el = m.elementos_recorrentes[0];
  assert.ok(el.y_mm > 8 && el.y_mm < 11, `2 linhas de 11 pt acima ≈ 9,5 mm (veio ${el.y_mm})`);
  assert.ok(Math.abs(el.x_mm - (210 - 15 - 60)) < 0.5, `direita: termina na margem direita de 15 mm (x = ${el.x_mm})`);
  assert.ok(m.margens_mm.t >= el.y_mm + el.altura_mm, 'o texto começa abaixo do logo, como no Word');
});
