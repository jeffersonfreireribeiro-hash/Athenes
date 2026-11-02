// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gerador Nativo de Documentos DOCX (Office Open XML - ECMA-376).
 * Totalmente compatível com Microsoft Word e Google Docs com suporte a Seções e Mestras.
 */

import { ZipBuilder } from './zip_builder.js';
import { MM_PARA_DXA } from './athenes_grid.js';
import { formatarReferenciaCompleta } from './athenes_bibliografia.js';
import { gerarSumarioDinamico, modeloDaPagina, obterTituloCompletoComNumeracao, recalcularNumeracaoAutomatica } from './athenes_documento.js';
import { documentoComSugestoesResolvidas } from './athenes_diff.js';
import { resolverAreasPagina, normalizarNumeracao, normalizarArea, estiloEfetivoNumeracao } from './athenes_paginacao.js';
import { obterConfigNotas, obterNota, sanitizarHtmlNota, idsNotasDoBloco } from './athenes_notas_rodape.js';
import { nomeFonteDocx } from './athenes_tabela_estilo.js';
import { calcularNumeracaoSecoes, extrairItensSumario, configEfetivaSumario, removerNumeroManual, aplicarTransformacao, nivelDe, NIVEL_MAX } from './athenes_sumario.js';
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
    const { tcPr, jc, rPr } = celulaParaDocx(res);
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
// Contexto da exportação em curso: notas de rodapé do Word (id sequencial por ordem de referência) e cabeçalho/rodapé
let ctxDocx = null;

function idFootnoteWord(idNota) {
  if (!ctxDocx) return null;
  if (!ctxDocx.notas.has(idNota)) ctxDocx.notas.set(idNota, ctxDocx.notas.size + 1);
  return ctxDocx.notas.get(idNota);
}

function htmlParaRunsDocx(htmlTexto, estiloPadrao = {}) {
  const runs = [];
  if (!htmlTexto) return runs;
  let pulandoMarcador = false;

  const paragrafos = String(htmlTexto).split(/\r?\n|<br\s*[\/]?>/gi);

  for (let pIdx = 0; pIdx < paragrafos.length; pIdx++) {
    const trecho = paragrafos[pIdx];
    if (pIdx > 0) {
      runs.push('<w:r><w:br/></w:r>');
    }

    const tokens = trecho.split(/(<\/?(?:strong|b|em|i|u|span|small|sup)[^>]*>)/gi);
    let negrito = Boolean(estiloPadrao.negrito);
    let italico = Boolean(estiloPadrao.italico);
    let sublinhado = Boolean(estiloPadrao.sublinhado);

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();
      if (lower.startsWith('<sup') && lower.includes('ath-nota-ref')) {
        // marcador de nota de rodapé → referência nativa do Word (o Word numera e posiciona a nota na página)
        const idNota = /data-nota="([\w-]+)"/.exec(token)?.[1];
        const idWord = idNota ? idFootnoteWord(idNota) : null;
        if (idWord) runs.push(`<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${idWord}"/></w:r>`);
        pulandoMarcador = true;
      } else if (lower.startsWith('</sup')) {
        pulandoMarcador = false;
      } else if (pulandoMarcador) {
        // texto visível do marcador (substituído pelo número nativo do Word)
      } else if (lower.startsWith('<strong') || lower.startsWith('<b')) {
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
const FMT_PGNUM = { arabico: 'decimal', romano_mai: 'upperRoman', romano_min: 'lowerRoman', alfa_mai: 'upperLetter', alfa_min: 'lowerLetter' };
const FMT_NOTA = { numerico: 'decimal', alfabetico: 'lowerLetter', simbolos: 'chicago' };
const REINICIO_NOTA = { documento: 'continuous', secao: 'eachSect', pagina: 'eachPage' };
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function gerarSectPrXml(mestra, ehUltima = false, sIdx = 0) {
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
  const doc = ctxDocx?.documento;
  const hf = ctxDocx?.hf;

  const refs = [];
  if (mestra.cabecalho?.ativo) {
    refs.push(`<w:headerReference w:type="default" r:id="rIdHeader1" ${NS_R}/>`);
    if (hf?.evenAndOdd) refs.push(`<w:headerReference w:type="even" r:id="rIdHeader2" ${NS_R}/>`);
    if (hf?.titlePg) refs.push(`<w:headerReference w:type="first" r:id="rIdHeader3" ${NS_R}/>`);
  }
  if (mestra.rodape?.ativo) {
    refs.push(`<w:footerReference w:type="default" r:id="rIdFooter1" ${NS_R}/>`);
    if (hf?.evenAndOdd) refs.push(`<w:footerReference w:type="even" r:id="rIdFooter2" ${NS_R}/>`);
    if (hf?.titlePg) refs.push(`<w:footerReference w:type="first" r:id="rIdFooter3" ${NS_R}/>`);
  }

  // Notas: marcador e reinício (a numeração em si é feita pelo Word)
  const cfgNotas = obterConfigNotas(doc || {});
  const footnotePr = `<w:footnotePr><w:numFmt w:val="${FMT_NOTA[cfgNotas.marcador]}"/><w:numRestart w:val="${REINICIO_NOTA[cfgNotas.reiniciar]}"/></w:footnotePr>`;

  // Numeração de páginas: estilo (romano/letras) e reinício na seção
  const num = normalizarNumeracao(doc || {}, mestra);
  const fmt = FMT_PGNUM[estiloEfetivoNumeracao(num)] || 'decimal';
  const reinicia = num.legado ? (sIdx === 0 && num.iniciar_em > 1) : (sIdx === 0 ? num.iniciar_em !== 1 : num.continuar === false);
  const pgNumType = `<w:pgNumType w:fmt="${fmt}"${reinicia ? ` w:start="${num.iniciar_em}"` : ''}/>`;

  // Distâncias do cabeçalho/rodapé à borda da folha
  const cab = normalizarArea(mestra.cabecalho);
  const rod = normalizarArea(mestra.rodape);
  const hdrDxa = Math.round(cab.distancia_borda_mm * MM_PARA_DXA);
  const ftrDxa = Math.round(rod.distancia_borda_mm * MM_PARA_DXA);

  return `<w:sectPr>
    ${refs.join('\n    ')}
    ${footnotePr}
    <w:pgSz w:w="${widthDxa}" w:h="${heightDxa}" w:orient="${orient}"/>
    <w:pgMar w:top="${topDxa}" w:right="${rightDxa}" w:bottom="${bottomDxa}" w:left="${leftDxa}" w:header="${hdrDxa}" w:footer="${ftrDxa}"/>
    ${pgNumType}
    <w:cols w:num="${cols}" w:space="720"/>
    ${hf?.titlePg ? '<w:titlePg/>' : ''}
  </w:sectPr>`;
}

/**
 * Cabeçalho/rodapé do Word a partir da mestra de corpo (um conjunto para o documento): 3 zonas por tabulação,
 * campos PAGE/NUMPAGES com formato (romano/letras), linha divisória e variantes de primeira página e pares.
 */
function construirCabecalhoRodapeDocx(documento, mestrasMap) {
  const lista = [...mestrasMap.values()];
  const mestra = mestrasMap.get('corpo') || lista.find(m => m.cabecalho?.ativo || m.rodape?.ativo) || lista[0];
  const vazio = { header: { default: '', even: '', first: '' }, footer: { default: '', even: '', first: '' }, titlePg: false, evenAndOdd: false };
  if (!mestra) return vazio;

  const m = mestra.margens_mm || { l: 30, r: 20 };
  const larguraDxa = Math.round(((mestra.orientacao === 'paisagem' ? 297 : 210) - (m.l || 0) - (m.r || 0)) * MM_PARA_DXA);
  const secaoId = (documento.secoes || [])[0]?.id;
  const numeracao = normalizarNumeracao(documento, mestra);
  const estilo = estiloEfetivoNumeracao(numeracao);
  const sw = { arabico: '', romano_mai: ' \\* ROMAN', romano_min: ' \\* roman', alfa_mai: ' \\* ALPHABETIC', alfa_min: ' \\* alphabetic' }[estilo] || '';
  const PAG = '§§PAG§§';
  const TOT = '§§TOT§§';

  const runTexto = (txt, rPr) => (txt ? `<w:r>${rPr}<w:t xml:space="preserve">${escaparXml(txt)}</w:t></w:r>` : '');
  const zonaXml = (txt, rPr) => txt.split(/(§§PAG§§|§§TOT§§)/).map(parte => {
    if (parte === PAG) return `<w:fldSimple w:instr="PAGE${sw}"><w:r>${rPr}<w:t>1</w:t></w:r></w:fldSimple>`;
    if (parte === TOT) return `<w:fldSimple w:instr="NUMPAGES"><w:r>${rPr}<w:t>1</w:t></w:r></w:fldSimple>`;
    return runTexto(parte, rPr);
  }).join('');

  const paragrafo = (area, tipo) => {
    if (!area) return '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
    const fonte = nomeFonteDocx(normalizarArea(mestra[tipo]).fonte);
    const a = normalizarArea(mestra[tipo]);
    const rPr = `<w:rPr>${fonte ? `<w:rFonts w:ascii="${fonte}" w:hAnsi="${fonte}" w:cs="${fonte}"/>` : ''}${a.peso >= 600 ? '<w:b/>' : ''}<w:color w:val="${a.cor.replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6)}"/><w:sz w:val="${Math.round(a.tamanho_pt * 2)}"/></w:rPr>`;
    const borda = area.linha
      ? `<w:pBdr><w:${tipo === 'cabecalho' ? 'bottom' : 'top'} w:val="single" w:sz="${Math.max(2, Math.round(area.linha.espessura_pt * 8))}" w:space="1" w:color="${area.linha.cor.replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6)}"/></w:pBdr>`
      : '';
    return `<w:p><w:pPr><w:pStyle w:val="${tipo === 'cabecalho' ? 'Header' : 'Footer'}"/>${borda}<w:tabs><w:tab w:val="clear" w:pos="4513"/><w:tab w:val="clear" w:pos="9026"/><w:tab w:val="center" w:pos="${Math.round(larguraDxa / 2)}"/><w:tab w:val="right" w:pos="${larguraDxa}"/></w:tabs><w:spacing w:after="0" w:line="${Math.round(a.entrelinha * 240)}" w:lineRule="auto"/></w:pPr>${zonaXml(area.zonas.esquerda, rPr)}<w:r><w:tab/></w:r>${zonaXml(area.zonas.centro, rPr)}<w:r><w:tab/></w:r>${zonaXml(area.zonas.direita, rPr)}</w:p>`;
  };

  const montar = (numero, naSecao) => {
    const pag = { numero, numeroNaSecao: naSecao, secaoId };
    const r = resolverAreasPagina(documento, mestra, pag, numero, 1, { marcadores: { p: PAG, t: TOT } });
    return { cabecalho: paragrafo(r.cabecalho, 'cabecalho'), rodape: paragrafo(r.rodape, 'rodape') };
  };
  const padrao = montar(3, 2);   // página ímpar comum
  const par = montar(2, 2);      // página par comum
  const primeira = montar(1, 1); // primeira página da seção

  const hf = {
    header: { default: padrao.cabecalho, even: par.cabecalho, first: primeira.cabecalho },
    footer: { default: padrao.rodape, even: par.rodape, first: primeira.rodape },
    titlePg: primeira.cabecalho !== padrao.cabecalho || primeira.rodape !== padrao.rodape,
    evenAndOdd: par.cabecalho !== padrao.cabecalho || par.rodape !== padrao.rodape
  };
  return hf;
}

/**
 * Gera um pacote .docx binário completo pronto para download e edição
 */
export async function exportarParaDocx(documento) {
  // Sugestões pendentes saem como "proposta aceita", sem marcações <ins>/<del> cruas no Word
  documento = documentoComSugestoesResolvidas(documento, 'aceitar');
  recalcularNumeracaoAutomatica(documento); // legendas com o separador escolhido
  const mestrasMapDoc = new Map((documento.mestras || documento.modelosPagina || []).map(m => [m.id, m]));
  ctxDocx = { documento, notas: new Map(), hf: construirCabecalhoRodapeDocx(documento, mestrasMapDoc) };
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
  <Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/header3.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/word/footer3.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
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
  ${ctxDocx.hf.evenAndOdd ? '<w:evenAndOddHeaders/>' : ''}
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

  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:outlineLvl w:val="3"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:outlineLvl w:val="4"/>
    </w:pPr>
    <w:rPr>
      <w:i/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:outlineLvl w:val="5"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading7">
    <w:name w:val="heading 7"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:outlineLvl w:val="6"/>
    </w:pPr>
    <w:rPr>
      <w:i/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading8">
    <w:name w:val="heading 8"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:outlineLvl w:val="7"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading9">
    <w:name w:val="heading 9"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:ind w:firstLine="0"/>
      <w:outlineLvl w:val="8"/>
    </w:pPr>
    <w:rPr>
      <w:i/>
      <w:sz w:val="22"/>
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

  // 6/7. word/header{1,2,3}.xml e footer{1,2,3}.xml (padrão, pares e primeira página)
  const NS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  ['default', 'even', 'first'].forEach((tipo, i) => {
    zip.add(`word/header${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS_W}>${ctxDocx.hf.header[tipo] || '<w:p/>'}</w:hdr>`);
    zip.add(`word/footer${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS_W}>${ctxDocx.hf.footer[tipo] || '<w:p/>'}</w:ftr>`);
  });

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
  const prefixosSecoes = calcularNumeracaoSecoes(documento);
  let contadorMarcadores = 0;

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
        const nivel = nivelDe(b);
        const estiloId = `Heading${nivel}`;
        const num = prefixosSecoes.get(b.id);
        const runs = htmlParaRunsDocx(num ? (removerNumeroManual(b.texto) || b.texto) : b.texto);
        const runsNum = num ? `<w:r><w:t xml:space="preserve">${escaparXml(num.prefixo)} </w:t></w:r>` : '';
        const idMarca = ++contadorMarcadores;
        // marcador _Toc_<id>: destino dos links do sumário
        bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="${estiloId}"/><w:keepNext/></w:pPr><w:bookmarkStart w:id="${idMarca}" w:name="_Toc_${escaparXml(b.id)}"/>${runsNum}${runs.join('')}<w:bookmarkEnd w:id="${idMarca}"/></w:p>`);
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
        const jcFig = ({ esquerda: 'left', direita: 'right' })[b.alinhamento_bloco] || 'center';
        const titFig = obterTituloCompletoComNumeracao(b);
        if (titFig) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="${jcFig}"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(titFig)}</w:t></w:r></w:p>`);
        }
        bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="${jcFig}"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>[Ilustração / Grid de Imagens - Layout ${escaparXml(b.layout || '1')}]</w:t></w:r></w:p>`);
        if (b.legenda_geral) {
          bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="${jcFig}"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escaparXml(b.legenda_geral)}</w:t></w:r></w:p>`);
        }
        if (b.fonte) {
          bodyXmlParts.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/><w:jc w:val="${jcFig}"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escaparXml(b.fonte)}</w:t></w:r></w:p>`);
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
        const cfg = configEfetivaSumario(documento, b);
        const mg = mestra.margens_mm || mestra.margens || { l: 30, r: 20 };
        const larguraDxa = (mestra.orientacao === 'paisagem' ? 16838 : 11906) - Math.round(((mg.l || 30) + (mg.r || 20)) * MM_PARA_DXA);
        const mm = (v) => Math.round(v * MM_PARA_DXA);
        const jcTit = { esquerda: 'left', centro: 'center', direita: 'right' }[cfg.titulo.alinhamento];
        if (cfg.titulo.texto) bodyXmlParts.push(`<w:p><w:pPr><w:jc w:val="${jcTit}"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escaparXml(cfg.titulo.texto)}</w:t></w:r></w:p>`);
        const lider = { pontos: 'dot', tracos: 'hyphen', linha: 'underscore', nenhum: 'none' }[cfg.preenchimento.tipo];
        const rpr = (nv, cor) => {
          const f = nv.fonte; const fam = f.familia ? nomeFonteDocx(f.familia) : null;
          return `<w:rPr>${fam ? `<w:rFonts w:ascii="${escaparXml(fam)}" w:hAnsi="${escaparXml(fam)}" w:cs="${escaparXml(fam)}"/>` : ''}${f.negrito ? '<w:b/>' : ''}${f.italico ? '<w:i/>' : ''}${f.sublinhado ? '<w:u w:val="single"/>' : ''}<w:color w:val="${cor.replace('#', '')}"/><w:sz w:val="${Math.round(f.tamanho_pt * 2)}"/></w:rPr>`;
        };
        for (const it of extrairItensSumario(documento, { profundidade: cfg.profundidade_max, mapa: prefixosSecoes })) {
          const nv = cfg.niveis[Math.min(NIVEL_MAX, it.nivel)]; const f = nv.fonte;
          const texto = aplicarTransformacao(it.texto, nv.transformacao);
          const rPre = it.prefixo ? `<w:r>${rpr(nv, f.cor_numero || f.cor)}<w:t xml:space="preserve">${escaparXml(it.prefixo)}  </w:t></w:r>` : '';
          const rTxt = `<w:r>${rpr(nv, f.cor)}<w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`;
          const rPag = nv.mostrar_pagina ? `<w:r>${rpr(nv, f.cor_pagina || f.cor)}<w:tab/></w:r><w:r>${rpr(nv, f.cor_pagina || f.cor)}<w:t>${escaparXml(it.pagina)}</w:t></w:r>` : '';
          const tabs = nv.mostrar_pagina ? `<w:tabs><w:tab w:val="right" w:leader="${lider}" w:pos="${larguraDxa}"/></w:tabs>` : '';
          bodyXmlParts.push(`<w:p><w:pPr>${tabs}<w:spacing w:before="${mm(nv.espacamento.margem_superior_mm)}" w:after="${mm(nv.espacamento.margem_inferior_mm)}" w:line="${Math.round(nv.espacamento.entrelinha * 240)}" w:lineRule="auto"/><w:ind w:left="${mm(nv.recuo_mm)}"/></w:pPr><w:hyperlink w:anchor="_Toc_${escaparXml(it.id)}" w:history="1">${rPre}${rTxt}${rPag}</w:hyperlink></w:p>`);
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
      bodyXmlParts.push(`<w:p><w:pPr>${gerarSectPrXml(mestra, false, sIdx)}</w:pPr></w:p>`);
    } else {
      // Última seção: sectPr no nível raiz do body
      bodyXmlParts.push(gerarSectPrXml(mestra, true, sIdx));
    }
  }

  // 8. word/footnotes.xml — notas nativas do Word, na ordem em que foram referenciadas no corpo
  const cfgNotasDoc = obterConfigNotas(documento);
  const notasXml = [...ctxDocx.notas.entries()].map(([idNota, idWord]) => {
    const nota = obterNota(documento, idNota);
    const runs = htmlParaRunsDocx(sanitizarHtmlNota(nota?.html || ''), { tamanhoPt: cfgNotasDoc.tamanho_pt, cor: cfgNotasDoc.cor });
    return `<w:footnote w:id="${idWord}"><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>${runs.join('')}</w:p></w:footnote>`;
  }).join('\n');
  zip.add('word/footnotes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
  ${notasXml}
</w:footnotes>`);

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
  <Relationship Id="rIdHeader2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>
  <Relationship Id="rIdHeader3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header3.xml"/>
  <Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rIdFooter2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>
  <Relationship Id="rIdFooter3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer3.xml"/>
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

  const bytes = zip.build();
  ctxDocx = null;
  return bytes;
}
