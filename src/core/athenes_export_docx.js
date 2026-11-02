// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gerador Nativo de Documentos DOCX (Office Open XML - ECMA-376).
 * Totalmente compatível com Microsoft Word e Google Docs com suporte a Seções e Mestras.
 */

import { ZipBuilder } from './zip_builder.js';
import { MM_PARA_DXA } from './athenes_grid.js';
import { formatarReferenciaCompleta } from './athenes_bibliografia.js';
import { gerarSumarioDinamico, modeloDaPagina, obterTituloCompletoComNumeracao } from './athenes_documento.js';
import { obterEstiloTabela, dimensoesTabela, resolverCelula, celulaParaDocx, PADDINGS_CELULA } from './athenes_tabela_estilo.js';

/** Tabela/quadro OOXML com bordas por célula, sombreamento, alinhamento e zebra do estilo declarativo. */
function gerarTabelaDocxEstilizada(b) {
  const estilo = obterEstiloTabela(b);
  const dim = dimensoesTabela(b);
  const cols = b.colunas || [];
  const larg = Array.isArray(b.larguras_relativas) && b.larguras_relativas.length === cols.length ? b.larguras_relativas : null;
  const somaLarg = larg ? (larg.reduce((x, y) => x + Number(y), 0) || 1) : 1;
  const totalDxa = 9000;
  const gridColsXml = cols.map((_, i) => `<w:gridCol w:w="${larg ? Math.round(totalDxa * Number(larg[i]) / somaLarg) : Math.round(totalDxa / (cols.length || 1))}"/>`).join('');
  const padDxa = Math.round((PADDINGS_CELULA[estilo.padding] ?? 4) * 20);

  const celula = (texto, r, c, ehCab) => {
    const res = resolverCelula(estilo, dim, r, c);
    const { tcPr, jc } = celulaParaDocx(res);
    const rPr = `${res.negrito || ehCab ? '<w:b/>' : ''}${res.cor_texto ? `<w:color w:val="${res.cor_texto.replace('#', '')}"/>` : ''}<w:sz w:val="20"/>`;
    return `<w:tc>${tcPr}<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r></w:p></w:tc>`;
  };

  let rows = '';
  const temCab = b.com_cabecalho !== false;
  if (temCab && cols.length) {
    rows += `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cols.map((c, i) => celula(c, 0, i, true)).join('')}</w:tr>`;
  }
  (b.linhas || []).forEach((lin, ri) => {
    rows += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${(Array.isArray(lin) ? lin : []).map((v, ci) => celula(limparHtmlParaTexto(v), ri + (temCab ? 1 : 0), ci, false)).join('')}</w:tr>`;
  });

  return `<w:tbl>
          <w:tblPr>
            <w:tblW w:w="${totalDxa}" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblLayout w:type="fixed"/>
            <w:tblCellMar><w:top w:w="${padDxa}" w:type="dxa"/><w:left w:w="${padDxa * 2}" w:type="dxa"/><w:bottom w:w="${padDxa}" w:type="dxa"/><w:right w:w="${padDxa * 2}" w:type="dxa"/></w:tblCellMar>
          </w:tblPr>
          <w:tblGrid>${gridColsXml}</w:tblGrid>
          ${rows}
        </w:tbl>`;
}

function escaparXml(texto) {
  if (texto === undefined || texto === null) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function limparHtmlParaTexto(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Converte HTML simples em runs OpenXML <w:r>
 */
function htmlParaRunsDocx(htmlTexto, estiloPadrao = {}) {
  const runs = [];
  if (!htmlTexto) return runs;

  const paragrafos = String(htmlTexto).split(/\r?\n|<br\s*[\/]?>/gi);

  for (let pIdx = 0; pIdx < paragrafos.length; pIdx++) {
    const trecho = paragrafos[pIdx];
    if (pIdx > 0) {
      runs.push('<w:r><w:br/></w:r>');
    }

    const tokens = trecho.split(/(<\/?(?:strong|b|em|i|u|span|small)[^>]*>)/gi);
    let negrito = Boolean(estiloPadrao.negrito);
    let italico = Boolean(estiloPadrao.italico);
    let sublinhado = Boolean(estiloPadrao.sublinhado);

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();
      if (lower.startsWith('<strong') || lower.startsWith('<b')) {
        negrito = true;
      } else if (lower.startsWith('</strong') || lower.startsWith('</b')) {
        negrito = false;
      } else if (lower.startsWith('<em') || lower.startsWith('<i')) {
        italico = true;
      } else if (lower.startsWith('</em') || lower.startsWith('</i')) {
        italico = false;
      } else if (lower.startsWith('<u')) {
        sublinhado = true;
      } else if (lower.startsWith('</u')) {
        sublinhado = false;
      } else if (token.startsWith('<')) {
        // outras tags
      } else {
        const textoLimpo = escaparXml(token);
        if (textoLimpo) {
          const rPr = [];
          if (estiloPadrao.fonte) rPr.push(`<w:rFonts w:ascii="${estiloPadrao.fonte}" w:hAnsi="${estiloPadrao.fonte}"/>`);
          if (estiloPadrao.tamanhoPt) rPr.push(`<w:sz w:val="${Math.round(estiloPadrao.tamanhoPt * 2)}"/>`);
          if (estiloPadrao.cor) rPr.push(`<w:color w:val="${estiloPadrao.cor.replace('#', '')}"/>`);
          if (negrito) rPr.push('<w:b/>');
          if (italico) rPr.push('<w:i/>');
          if (sublinhado) rPr.push('<w:u w:val="single"/>');

          runs.push(`<w:r>${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${textoLimpo}</w:t></w:r>`);
        }
      }
    }
  }

  return runs;
}

function dataUrlParaBytes(dataUrl) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!match) return null;
  const tipoExt = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const base64Str = match[2];

  if (typeof Buffer !== 'undefined') {
    return { bytes: Buffer.from(base64Str, 'base64'), ext: tipoExt };
  }
  const binStr = atob(base64Str);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return { bytes, ext: tipoExt };
}

/**
 * Monta as propriedades de seção OpenXML (<w:sectPr>) para uma mestra
 */
function gerarSectPrXml(mestra, ehUltima = false) {
  const m = mestra.margens_mm || mestra.margens || { t: 30, r: 20, b: 20, l: 30 };
  const topDxa = Math.round((m.t || 30) * MM_PARA_DXA);
  const rightDxa = Math.round((m.r || 20) * MM_PARA_DXA);
  const bottomDxa = Math.round((m.b || 20) * MM_PARA_DXA);
  const leftDxa = Math.round((m.l || 30) * MM_PARA_DXA);

  const paisagem = mestra.orientacao === 'paisagem';
  const widthDxa = paisagem ? 16838 : 11906;
  const heightDxa = paisagem ? 11906 : 16838;
  const orient = paisagem ? 'landscape' : 'portrait';
  const cols = Math.max(1, mestra.colunas || (mestra.grade?.colunas || 1));

  const headerRef = mestra.cabecalho?.ativo
    ? '<w:headerReference w:type="default" r:id="rIdHeader1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>'
    : '';
  const footerRef = mestra.rodape?.ativo
    ? '<w:footerReference w:type="default" r:id="rIdFooter1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>'
    : '';

  const titlePg = (!mestra.cabecalho?.ativo && !mestra.rodape?.ativo) ? '<w:titlePg/>' : '';

  return `<w:sectPr>
    ${headerRef}
    ${footerRef}
    ${titlePg}
    <w:pgSz w:w="${widthDxa}" w:h="${heightDxa}" w:orient="${orient}"/>
    <w:pgMar w:top="${topDxa}" w:right="${rightDxa}" w:bottom="${bottomDxa}" w:left="${leftDxa}" w:header="720" w:footer="720"/>
    <w:cols w:num="${cols}" w:space="720"/>
  </w:sectPr>`;
}

/**
 * Gera um pacote .docx binário completo pronto para download e edição
 */
export async function exportarParaDocx(documento) {
  const zip = new ZipBuilder();
  const imagens = [];
  let contadorImagens = 0;

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;
  zip.add('[Content_Types].xml', contentTypesXml);

  // 2. _rels/.rels
  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  zip.add('_rels/.rels', packageRelsXml);

  // 3. word/settings.xml
  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`;
  zip.add('word/settings.xml', settingsXml);

  // 4. word/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="pt-BR"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="360" w:lineRule="auto" w:after="0"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="both"/>
    </w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="240" w:after="120"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:caps/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="200" w:after="100"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="160" w:after="80"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:i/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="CitacaoLonga">
    <w:name w:val="Citacao Longa"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="2268" w:firstLine="0"/>
      <w:spacing w:line="240" w:lineRule="auto" w:before="120" w:after="120"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="20"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Legenda">
    <w:name w:val="caption"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="60" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="20"/>
    </w:rPr>
  </w:style>
</w:styles>`;
  zip.add('word/styles.xml', stylesXml);

  // 5. word/numbering.xml
  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;
  zip.add('word/numbering.xml', numberingXml);

  // 6. word/header1.xml
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Header"/>
      <w:jc w:val="right"/>
      <w:spacing w:after="0"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
      <w:t>${escaparXml(documento.titulo || 'Athenes — Artigo Científico')}</w:t>
    </w:r>
  </w:p>
</w:hdr>`;
  zip.add('word/header1.xml', headerXml);

  // 7. word/footer1.xml
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Footer"/>
      <w:jc w:val="right"/>
      <w:spacing w:after="0"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
      <w:t xml:space="preserve">Página </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE"/>
  </w:p>
</w:ftr>`;
  zip.add('word/footer1.xml', footerXml);

  // 8. word/footnotes.xml
  const footnotesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1">
    <w:p><w:r><w:separator/></w:r></w:p>
  </w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0">
    <w:p><w:r><w:continuationSeparator/></w:r></w:p>
  </w:footnote>
</w:footnotes>`;
  zip.add('word/footnotes.xml', footnotesXml);

  // 9. word/document.xml - Geração estruturada por seções
  const bodyXmlParts = [];
  const secoes = Array.isArray(documento.secoes) && documento.secoes.length > 0
    ? documento.secoes
    : [{
        id: 'sec_raiz',
        nome: 'Conteúdo',
        mestraId: 'corpo',
        blocos: (documento.paginas || []).flatMap(p => p.blocos || [])
      }];

  const mestrasMap = new Map((documento.mestras || documento.modelosPagina || []).map(m => [m.id, m]));

  for (let sIdx = 0; sIdx < secoes.length; sIdx++) {
    const sec = secoes[sIdx];
    const mestra = mestrasMap.get(sec.mestraId) || mestrasMap.get('corpo') || {
      formato: 'a4',
      orientacao: 'retrato',
      margens_mm: { t: 30, r: 20, b: 20, l: 30 },
      cabecalho: { ativo: true },
      rodape: { ativo: true }
    };

    const ehUltimaSecao = sIdx === secoes.length - 1;
    const blocosDaSecao = Array.isArray(sec.blocos) ? sec.blocos : [];

    for (const b of blocosDaSecao) {
      if (b.tipo === 'quebra_pagina') {
        bodyXmlParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        continue;
      }

      if (b.tipo === 'titulo') {
        const nivel = Math.min(3, Math.max(1, b.nivel || 1));
        const estiloId = `Heading${nivel}`;
        const runs = htmlParaRunsDocx(b.texto);
        bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="${estiloId}"/><w:keepNext/></w:pPr>${runs.join('')}</w:p>`);
      } else if (b.tipo === 'subtitulo') {
        const runs = htmlParaRunsDocx(b.texto, { cor: '#64748B', tamanhoPt: 13 });
        bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>${runs.join('')}</w:p>`);
      } else if (b.tipo === 'paragrafo') {
        const runs = htmlParaRunsDocx(b.texto);
        let jcVal = 'both';
        if (b.alinhamento === 'esquerda') jcVal = 'left';
        else if (b.alinhamento === 'centro') jcVal = 'center';
        else if (b.alinhamento === 'direita') jcVal = 'right';
        else if (b.alinhamento === 'justificado' || b.alinhamento === 'justificado_esquerda') jcVal = 'both';
        else if (b.alinhamento === 'justificado_centro') jcVal = 'center';
        else if (b.alinhamento === 'justificado_direita') jcVal = 'right';

        const recuo1 = b.recuo_primeira_linha_mm !== undefined ? Math.round(b.recuo_primeira_linha_mm * 56.7) : 709;
        const recuoEsq = b.recuo_esquerdo_mm !== undefined ? ` w:left="${Math.round(b.recuo_esquerdo_mm * 56.7)}"` : '';
        const recuoDir = b.recuo_direito_mm !== undefined ? ` w:right="${Math.round(b.recuo_direito_mm * 56.7)}"` : '';
        const indXml = `<w:ind w:firstLine="${recuo1}"${recuoEsq}${recuoDir}/>`;

        const antes = b.espaco_antes_pt !== undefined ? Math.round(b.espaco_antes_pt * 20) : 0;
        const depois = b.espaco_depois_pt !== undefined ? Math.round(b.espaco_depois_pt * 20) : 0;
        const linha = b.entrelinha ? Math.round(b.entrelinha * 240) : 360;
        const spacingXml = `<w:spacing w:line="${linha}" w:lineRule="auto" w:before="${antes}" w:after="${depois}"/>`;

        bodyXmlParts.push(`<w:p><w:pPr>${indXml}<w:jc w:val="${jcVal}"/>${spacingXml}</w:pPr>${runs.join('')}</w:p>`);
      } else if (b.tipo === 'citacao') {
        const refTexto = ` (${b.autor || 'AUTOR'}, ${b.ano || 's.d.'}${b.pagina_citada ? ', p. ' + b.pagina_citada : ''})`;
        const textoCompleto = `${b.texto || ''}${refTexto}`;
        const runs = htmlParaRunsDocx(textoCompleto, { tamanhoPt: 10, cor: '#334155' });
        bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="CitacaoLonga"/></w:pPr>${runs.join('')}</w:p>`);
      } else if (b.tipo === 'lista') {
        const isNum = b.tipo_lista === 'numerada' || b.ordenada;
        const numId = isNum ? '2' : '1';
        for (const it of (b.itens || [])) {
          const txt = typeof it === 'string' ? it : it.texto;
          const runs = htmlParaRunsDocx(txt);
          bodyXmlParts.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr><w:spacing w:after="60"/></w:pPr>${runs.join('')}</w:p>`);
        }
      } else if (b.tipo === 'nota') {
        const runs = htmlParaRunsDocx(`${b.titulo ? '<strong>' + b.titulo + ':</strong> ' : ''}${b.texto || ''}`, { tamanhoPt: 10 });
        bodyXmlParts.push(`<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="314F79"/></w:pPr><w:shd w:val="clear" w:color="auto" w:fill="EEF4FA"/><w:ind w:left="360" w:right="360"/><w:spacing w:before="120" w:after="120"/></w:pPr>${runs.join('')}</w:p>`);
      } else if (b.tipo === 'quadro') {
        const titQuadro = obterTituloCompletoComNumeracao(b);
        if (titQuadro) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(titQuadro)}</w:t></w:r></w:p>`);
        }
        bodyXmlParts.push(gerarTabelaDocxEstilizada(b));
        if (b.fonte) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escaparXml(b.fonte)}</w:t></w:r></w:p>`);
        }
      } else if (b.tipo === 'figura') {
        const titFig = obterTituloCompletoComNumeracao(b);
        if (titFig) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(titFig)}</w:t></w:r></w:p>`);
        }
        bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>[Ilustração / Grid de Imagens - Layout ${escaparXml(b.layout || '1')}]</w:t></w:r></w:p>`);
        if (b.legenda_geral) {
          bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(b.legenda_geral)}</w:t></w:r></w:p>`);
        }
        if (b.fonte) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escaparXml(b.fonte)}</w:t></w:r></w:p>`);
        }
      } else if (b.tipo === 'mapa') {
        const titMapa = obterTituloCompletoComNumeracao(b);
        if (titMapa) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(titMapa)}</w:t></w:r></w:p>`);
        }
        bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>[Mapa Territorial - Escala: ${escaparXml(b.escala || '1:10.000')}${b.orientacao_norte ? ' | Norte Verdadeiro' : ''}]</w:t></w:r></w:p>`);
        if (b.legenda_cartografica) {
          bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(b.legenda_cartografica)}</w:t></w:r></w:p>`);
        }
        if (b.fonte) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escaparXml(b.fonte)}</w:t></w:r></w:p>`);
        }
      } else if (b.tipo === 'tabela') {
        const titTab = obterTituloCompletoComNumeracao(b);
        if (titTab) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(titTab)}</w:t></w:r></w:p>`);
        }
        bodyXmlParts.push(gerarTabelaDocxEstilizada(b));
        if (b.fonte) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escaparXml(b.fonte)}</w:t></w:r></w:p>`);
        }
      } else if (b.tipo === 'imagem') {
        const imgData = b.dataUrl || '';
        let imagemRelId = null;

        if (imgData.startsWith('data:image/')) {
          contadorImagens++;
          const dadosImg = dataUrlParaBytes(imgData);
          if (dadosImg) {
            const nomeArq = `image${contadorImagens}.${dadosImg.ext}`;
            imagemRelId = `rIdImg${contadorImagens}`;
            imagens.push({
              id: imagemRelId,
              nome: nomeArq,
              bytes: dadosImg.bytes
            });
            zip.add(`word/media/${nomeArq}`, dadosImg.bytes);
          }
        }

        if (b.legenda) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(b.legenda)}</w:t></w:r></w:p>`);
        }

        if (imagemRelId) {
          const cx = 5000000;
          const cy = 3500000;
          bodyXmlParts.push(`<w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                  <wp:extent cx="${cx}" cy="${cy}"/>
                  <wp:docPr id="${contadorImagens}" name="Figura ${contadorImagens}"/>
                  <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:nvPicPr>
                          <pic:cNvPr id="${contadorImagens}" name="Imagem ${contadorImagens}"/>
                          <pic:cNvPicPr/>
                        </pic:nvPicPr>
                        <pic:blipFill>
                          <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${imagemRelId}"/>
                          <a:stretch><a:fillRect/></a:stretch>
                        </pic:blipFill>
                        <pic:spPr>
                          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                        </pic:spPr>
                      </pic:pic>
                    </a:graphicData>
                  </a:graphic>
                </wp:inline>
              </w:drawing>
            </w:r>
          </w:p>`);
        } else {
          bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>[Espaço reservado para Imagem: ${escaparXml(b.legenda || 'Ilustração')}]</w:t></w:r></w:p>`);
        }

        if (b.fonte) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escaparXml(b.fonte)}</w:t></w:r></w:p>`);
        }
      } else if (b.tipo === 'formula') {
        bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="center"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/><w:sz w:val="24"/></w:rPr><w:t>${escaparXml(b.formula || b.latex || '')}   ${escaparXml(b.numero || b.numero_equacao || '')}</w:t></w:r></w:p>`);
      } else if (b.tipo === 'anexo') {
        bodyXmlParts.push(`<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="2563EB"/></w:pPr><w:shd w:val="clear" w:color="auto" w:fill="EFF6FF"/><w:ind w:left="240" w:right="240"/><w:spacing w:before="100" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E40AF"/></w:rPr><w:t>ANEXO: ${escaparXml(b.titulo || b.nome || 'Arquivo')} </w:t></w:r><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>(${escaparXml(b.nome_arquivo || b.descricao || 'Documento complementar')})</w:t></w:r></w:p>`);
      } else if (b.tipo === 'sumario') {
        bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:t>${escaparXml(b.titulo || 'SUMÁRIO')}</w:t></w:r></w:p>`);
        const itensSumario = gerarSumarioDinamico(documento);
        for (const it of itensSumario) {
          const recuo = (it.nivel - 1) * 360;
          bodyXmlParts.push(`<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8500"/></w:tabs><w:ind w:left="${recuo}"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:b/></w:r><w:t>${escaparXml(it.texto)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${it.pagina}</w:t></w:r></w:p>`);
        }
      } else if (b.tipo === 'referencias') {
        if (b.titulo) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escaparXml(b.titulo)}</w:t></w:r></w:p>`);
        }
        const refs = documento.referencias || [];
        const norma = documento.perfil || 'abnt';
        for (let i = 0; i < refs.length; i++) {
          const htmlRef = formatarReferenciaCompleta(refs[i], norma, i + 1);
          const runs = htmlParaRunsDocx(htmlRef);
          bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto" w:after="160"/><w:ind w:firstLine="0"/></w:pPr>${runs.join('')}</w:p>`);
        }
      }
    }

    // Se não for a última seção, insere a quebra de seção nativa do Word (<w:sectPr>) no parágrafo final
    if (!ehUltimaSecao) {
      bodyXmlParts.push(`<w:p><w:pPr>${gerarSectPrXml(mestra, false)}</w:pPr></w:p>`);
    } else {
      // Última seção: sectPr no nível raiz do body
      bodyXmlParts.push(gerarSectPrXml(mestra, true));
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyXmlParts.join('\n')}
  </w:body>
</w:document>`;
  zip.add('word/document.xml', documentXml);

  // 10. word/_rels/document.xml.rels
  let relsEntries = `
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rIdFootnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>`;

  for (const img of imagens) {
    relsEntries += `\n  <Relationship Id="${img.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.nome}"/>`;
  }

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relsEntries}
</Relationships>`;
  zip.add('word/_rels/document.xml.rels', documentRelsXml);

  return zip.build();
}
