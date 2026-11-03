// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZipBuilder } from '../src/core/zip_builder.js';
import { abrirZip } from '../src/core/athenes_zip_leitor.js';
import { parseXml, filhos, textoDe } from '../src/core/athenes_xml_mini.js';
import { importarTemplateDocx, mapearFonteDocx, MAX_ESTILOS_CANONICOS } from '../src/core/athenes_docx_importador.js';
import { criarDocumentoDeTemplate, sanitizarTemplate } from '../src/core/athenes_templates.js';
import { repaginarDocumento } from '../src/core/athenes_documento.js';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const lorem = 'Este é um parágrafo do corpo do texto com palavras suficientes para contar como texto corrido do documento. '.repeat(3);

const estilo = (id, nome, { base = 'Normal', rpr = '', ppr = '' } = {}) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nome}"/>${base ? `<w:basedOn w:val="${base}"/>` : ''}${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
const p = (txt, { st = '', ppr = '', rpr = '', extra = '' } = {}) => `<w:p><w:pPr>${st ? `<w:pStyle w:val="${st}"/>` : ''}${ppr}</w:pPr>${extra}<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`;

function docxBagunçado() {
  // Normal: Times 12 justificado 1,5; Heading1: Arial 16 negrito; +10 estilos "personalizados" quase iguais ao corpo
  const variantes = Array.from({ length: 10 }, (_, i) => estilo(`Estilo${i + 1}`, `Meu estilo ${i + 1}`, { ppr: `<w:spacing w:after="${120 + i * 10}"/>`, rpr: i % 3 === 0 ? '<w:sz w:val="24"/>' : '' }));
  const styles = `<?xml version="1.0"?><w:styles ${W}>
    <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:jc w:val="both"/><w:ind w:firstLine="709"/></w:pPr></w:style>
    ${estilo('Heading1', 'heading 1', { rpr: '<w:rFonts w:ascii="Arial"/><w:b/><w:sz w:val="32"/>', ppr: '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/>' })}
    ${estilo('Legenda', 'caption', { rpr: '<w:sz w:val="20"/>', ppr: '<w:jc w:val="center"/><w:ind w:firstLine="0"/>' })}
    ${estilo('Cita', 'Quote', { rpr: '<w:sz w:val="20"/>', ppr: '<w:ind w:left="2268" w:firstLine="0"/>' })}
    ${estilo('NotaRodape', 'footnote text', { rpr: '<w:sz w:val="18"/>' })}
    ${variantes.join('')}
  </w:styles>`;
  const capa = [
    p('UNIVERSIDADE EXEMPLO', { ppr: '<w:jc w:val="center"/><w:ind w:firstLine="0"/>', rpr: '<w:b/><w:sz w:val="28"/>' }),
    p('Título Grande do Trabalho', { ppr: '<w:jc w:val="center"/><w:ind w:firstLine="0"/>', rpr: '<w:b/><w:sz w:val="40"/>' }),
    p('Autor da Silva', { ppr: '<w:jc w:val="center"/><w:ind w:firstLine="0"/>' }),
    p('Cidade, 2025', { ppr: '<w:jc w:val="center"/><w:ind w:firstLine="0"/>', extra: '<w:r><w:br w:type="page"/></w:r>' })
  ].join('');
  const corpo = [
    p('1 Introdução', { rpr: '<w:rFonts w:ascii="Arial"/><w:b/><w:sz w:val="32"/>', ppr: '<w:ind w:firstLine="0"/><w:jc w:val="left"/>' }), // título "à mão", sem estilo de título
    p('Introdução Formal', { st: 'Heading1' }),
    ...Array.from({ length: 10 }, (_, i) => p(lorem, { st: `Estilo${i + 1}` })),
    // negrito/itálico só em parte do parágrafo: continua sendo corpo, sem estilo novo
    `<w:p><w:r><w:t xml:space="preserve">Texto normal com </w:t></w:r><w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>trecho forte</w:t></w:r><w:r><w:t xml:space="preserve"> e continuação do parágrafo de corpo com mais texto para somar caracteres.</w:t></w:r></w:p>`,
    p(lorem, { st: 'Cita' }),
    p('Figura 1 – Mapa da área de estudo', { st: 'Legenda' }),
    p('Fonte: elaborado pelo autor (2025).', { rpr: '<w:sz w:val="18"/>', ppr: '<w:jc w:val="center"/>' }),
    p('Nota de rodapé de exemplo.', { st: 'NotaRodape' }),
    '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>célula</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
  ].join('');
  const doc = `<?xml version="1.0"?><w:document ${W}><w:body>${capa}${corpo}<w:sectPr><w:headerReference w:type="default" r:id="rId9"/><w:footerReference w:type="default" r:id="rId10"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"/><w:cols w:num="2" w:space="567"/></w:sectPr></w:body></w:document>`;
  const z = new ZipBuilder();
  z.add('[Content_Types].xml', '<Types/>');
  z.add('word/document.xml', doc);
  z.add('word/styles.xml', styles);
  z.add('word/settings.xml', `<w:settings ${W}><w:autoHyphenation/></w:settings>`);
  z.add('word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId9" Target="header1.xml"/><Relationship Id="rId10" Target="footer1.xml"/></Relationships>');
  z.add('word/header1.xml', `<w:hdr ${W}><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>Relatório Anual</w:t></w:r></w:p></w:hdr>`);
  z.add('word/footer1.xml', `<w:ftr ${W}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r></w:p></w:ftr>`);
  return z.build();
}

test('zip: lê o DOCX exportado pelo próprio Athenes (stored e deflate) e rejeita lixo', async () => {
  const zip = abrirZip(readFileSync('tests/amostra_artigo_athenes.docx'));
  assert.ok(zip.existe('word/document.xml'));
  assert.match(await zip.texto('word/document.xml'), /<w:body>/);
  assert.throws(() => abrirZip(new Uint8Array([1, 2, 3, 4, 5])), /não é um ZIP/);
  const z = new ZipBuilder(); z.add('a.txt', 'olá');
  assert.equal(await abrirZip(z.build()).texto('a.txt'), 'olá');
});

test('xml: entidades, CDATA, atributos e espaços em w:t', () => {
  const r = parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><w:t xml:space="preserve"> </w:t><b/><![CDATA[<k>]]></a>');
  assert.equal(r.a.x, '1 & 2');
  assert.equal(filhos(r, 'w:t').length, 1);
  assert.equal(textoDe(filhos(r, 'w:t')[0]), ' ');
});

test('fontes: mapeia as conhecidas e substitui as desconhecidas por serifada/sem serifa', () => {
  assert.equal(mapearFonteDocx('Times New Roman').id, 'times');
  assert.equal(mapearFonteDocx('Calibri').exata, true);
  assert.deepEqual(mapearFonteDocx('Palatino Linotype'), { id: 'times', exata: false, original: 'Palatino Linotype' });
  assert.equal(mapearFonteDocx('Segoe UI').id, 'arial');
});

test('docx bagunçado: ~16 estilos viram 5–8 canônicos, sem criar estilo para negrito inline', async () => {
  const { template, relatorio } = await importarTemplateDocx(docxBagunçado(), { nome: 'bagunca.docx' });
  const canonicos = template.config.estilos.filter(e => e.id !== 'fonte_citada');
  assert.ok(relatorio.estilosNoArquivo >= 8, `o arquivo tem muitos estilos (${relatorio.estilosNoArquivo})`);
  assert.ok(canonicos.length >= 5 && canonicos.length <= MAX_ESTILOS_CANONICOS, `canônicos: ${canonicos.map(e => e.id)}`);
  const ids = canonicos.map(e => e.id);
  for (const id of ['capa', 'titulo1', 'corpo', 'citacao_direta', 'legenda']) assert.ok(ids.includes(id), `tem ${id}`);
  const corpo = relatorio.estilos.find(e => e.id === 'corpo');
  assert.ok(corpo.paragrafos >= 11, 'as 10 variantes do corpo e o parágrafo com negrito inline caem em corpo');
  assert.ok(corpo.variantesAbsorvidas >= 0 && corpo.origem.length >= 3);
  const t1 = relatorio.estilos.find(e => e.id === 'titulo1');
  assert.equal(t1.paragrafos, 2, 'título "à mão" (negrito 16pt, sem estilo) e Heading1 viram o mesmo estilo');
  assert.ok(!ids.some(id => /negrito|italic/i.test(id)));
  assert.equal(relatorio.estilosCanonicos, canonicos.length);
});

test('docx: tipografia, página, cabeçalho/rodapé e hifenização vêm do arquivo', async () => {
  const { template, relatorio } = await importarTemplateDocx(docxBagunçado());
  const e = (id) => template.config.estilos.find(x => x.id === id);
  assert.equal(e('corpo').fonte, 'times');
  assert.equal(e('corpo').tamanho_pt, 12);
  assert.equal(e('corpo').alinhamento, 'justificado');
  assert.equal(e('corpo').entrelinha, 1.5);
  assert.equal(e('corpo').recuo_primeira_linha_mm, 12.5);
  assert.equal(e('corpo').hifenizacao, true);
  assert.equal(e('titulo1').fonte, 'arial');
  assert.equal(e('titulo1').peso, 700);
  assert.equal(e('titulo1').tamanho_pt, 16);
  assert.equal(e('citacao_direta').recuo_esquerdo_mm, 40);
  assert.equal(e('legenda').alinhamento, 'centro');
  assert.deepEqual(e('fonte_citada').tamanho_pt, e('legenda').tamanho_pt, 'legenda e fonte são o mesmo estilo');
  assert.equal(e('capa').alinhamento, 'centro');
  assert.equal(e('capa').tamanho_pt, 20, 'a capa usa o título (maior), não cada linha');
  const corpo = template.config.mestras.find(m => m.id === 'corpo');
  assert.equal(corpo.formato, 'A4');
  assert.deepEqual(corpo.margens_mm, { t: 30, r: 20, b: 20, l: 30 });
  assert.deepEqual(corpo.grade, { colunas: 2, gap_mm: 10 });
  assert.deepEqual([corpo.cabecalho.ativo, corpo.cabecalho.zonas.direita], [true, 'Relatório Anual']);
  assert.deepEqual([corpo.rodape.ativo, corpo.rodape.zonas.centro, corpo.numeracao_pagina.horizontal, corpo.numeracao_pagina.formato], [true, '{pagina}', 'centro', 'apenas_numero']);
  assert.ok(relatorio.avisos.some(a => /tabela/.test(a)));
  assert.ok(relatorio.hifenizacaoAutomatica);
});

test('o template importado é válido, não carrega o texto do arquivo e vira documento utilizável', async () => {
  const { template } = await importarTemplateDocx(docxBagunçado(), { nome: 'meu.docx' });
  assert.ok(sanitizarTemplate(template));
  assert.doesNotMatch(JSON.stringify(template), /UNIVERSIDADE EXEMPLO|Autor da Silva|Introdução Formal|Mapa da área/, 'o texto do arquivo não vai para o template');
  assert.equal(template.titulo, 'meu');
  assert.deepEqual(template.secoes.map(s => s.mestraId), ['capa', 'corpo']);
  const doc = criarDocumentoDeTemplate(template, { titulo: 'Novo', modoConteudo: 'placeholder' });
  repaginarDocumento(doc);
  assert.ok(doc.paginas.length >= 1);
  assert.deepEqual(doc.estilos.map(e => e.id).sort(), template.config.estilos.map(e => e.id).sort());
  const vazio = criarDocumentoDeTemplate(template, { titulo: 'Vazio', modoConteudo: 'vazio' });
  assert.ok(vazio.secoes.flatMap(s => s.blocos).every(b => !(b.texto || '').trim()));
});

test('arquivos inválidos dão erro claro', async () => {
  await assert.rejects(importarTemplateDocx(new Uint8Array([0, 1, 2, 3])), /ZIP|DOCX/);
  const z = new ZipBuilder(); z.add('qualquer.txt', 'x');
  await assert.rejects(importarTemplateDocx(z.build()), /word\/document\.xml/);
  const v = new ZipBuilder(); v.add('word/document.xml', '<w:document xmlns:w="x"><w:body/></w:document>');
  await assert.rejects(importarTemplateDocx(v.build()), /vazio/);
});

test('conteúdo: traz o texto do arquivo, capa em seção própria, quebras de página e negrito/itálico inline', async () => {
  const { template, relatorio } = await importarTemplateDocx(docxBagunçado(), { nome: 'm.docx', incluirConteudo: true });
  assert.equal(template.conteudoImportado, true);
  assert.deepEqual(template.secoes.map(s => s.mestraId), ['capa', 'corpo']);
  const capa = template.secoes[0].blocos, corpo = template.secoes[1].blocos;
  assert.equal(capa.length, 4);
  assert.match(capa[1].texto, /Título Grande do Trabalho/);
  assert.equal(capa[1].alinhamento, 'centro');
  const textos = corpo.map(b => b.texto || '').join('\n');
  assert.match(textos, /Introdução Formal/);
  assert.match(textos, /Texto normal com <strong><em>trecho forte<\/em><\/strong>/, 'negrito inline vira marcação do texto, não estilo');
  assert.match(textos, /<em>|<strong>/);
  assert.ok(corpo.some(b => b.tipo === 'titulo' && /Introdução/.test(b.texto)));
  assert.ok(relatorio.avisos.some(a => /tabela/.test(a)));
  // níveis de título consecutivos e ids de bloco únicos
  const niveis = [...new Set(corpo.filter(b => b.tipo === 'titulo').map(b => b.nivel))].sort();
  assert.deepEqual(niveis, niveis.map((_, i) => i + 1));
  const ids = [...capa, ...corpo].map(b => b.id);
  assert.equal(new Set(ids).size, ids.length);
  const doc = criarDocumentoDeTemplate(template, { titulo: 'Com conteúdo', modoConteudo: 'placeholder' });
  repaginarDocumento(doc);
  assert.ok(doc.secoes[1].blocos.some(b => /Introdução Formal/.test(b.texto || '')));
  const vazio = criarDocumentoDeTemplate(template, { titulo: 'Só estrutura', modoConteudo: 'vazio' });
  assert.ok(vazio.secoes.flatMap(s => s.blocos).every(b => !(b.texto || '').trim()));
});

test('títulos: linha curta toda em negrito vira título (MAIÚSCULAS acima de "Mista"), mesmo sem estilo de título', async () => {
  const z = new ZipBuilder();
  const corpoTxt = Array.from({ length: 8 }, () => p(lorem)).join('');
  const doc = `<w:document ${W}><w:body>
    ${p('INTRODUÇÃO', { rpr: '<w:b/>' })}${corpoTxt}${p('Subitem em negrito', { rpr: '<w:b/>' })}${corpoTxt}${p('METODOLOGIA', { rpr: '<w:b/>' })}${corpoTxt}
  </w:body></w:document>`;
  z.add('word/document.xml', doc);
  z.add('word/styles.xml', `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  const { template, relatorio } = await importarTemplateDocx(z.build(), { incluirConteudo: true });
  const t = template.secoes.at(-1).blocos.filter(b => b.tipo === 'titulo').map(b => [b.texto, b.nivel]);
  assert.deepEqual(t, [['INTRODUÇÃO', 1], ['Subitem em negrito', 2], ['METODOLOGIA', 1]]);
  assert.equal(relatorio.estilos.find(e => e.id === 'titulo1').paragrafos, 2);
});
