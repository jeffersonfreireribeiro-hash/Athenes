// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarDocumento, criarNovoBloco, adicionarBlocoNaSecao, recalcularNumeracaoAutomatica,
  gerarListaFiguras, gerarListaGraficos, gerarListaQuadros, gerarListaIlustracoes, resolverReferenciasCruzadas
} from '../src/core/athenes_documento.js';
import {
  migrarBlocoFigura, definirPapelSemantico, papelSemanticoDoBloco, PAPEIS_SEMANTICOS, fonteDoItem, itemTemConteudo, descreverFigura, extrairEstiloFigura, sanitizarEstiloFigura
} from '../src/core/athenes_figura_layout.js';
import { exemploDeCodigo } from '../src/core/athenes_figura_codigo.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { abrirZip } from '../src/core/athenes_zip_leitor.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const corpo = (doc) => doc.secoes.find(s => s.mestraId === 'corpo');
const nova = (doc, papel, st, extra = {}) => adicionarBlocoNaSecao(doc, corpo(doc).id, criarNovoBloco('figura', {
  semanticRole: papel, titulo: extra.titulo || 'Algo', itens: [{ url: '', legenda_sub: 'a', sourceType: st, content: st === 'image_url' ? '' : exemploDeCodigo(st) }], ...extra
}));

describe('Athenes — Classificação semântica, migração e numeração por categoria', () => {
  it('cada categoria define subtipo, prefixo, contador independente e proporção padrão', () => {
    const doc = criarDocumento();
    const g1 = nova(doc, 'chart', 'chart_json');
    const f1 = nova(doc, 'figure', 'image_url');
    const d1 = nova(doc, 'diagram', 'mermaid_code');
    const e1 = nova(doc, 'scheme', 'svg_code');
    const g2 = nova(doc, 'chart', 'chart_json');
    const f2 = nova(doc, 'figure', 'image_url');
    recalcularNumeracaoAutomatica(doc);
    assert.deepEqual([g1, f1, d1, e1, g2, f2].map(b => b.subtipo), ['grafico', 'figura', 'diagrama', 'esquema', 'grafico', 'figura']);
    assert.deepEqual([g1, f1, d1, e1, g2, f2].map(b => b.numero_sequencial), [1, 1, 1, 1, 2, 2]);
    assert.deepEqual([g1.proporcao_imagem, f1.proporcao_imagem, d1.proporcao_imagem, e1.proporcao_imagem], ['4/3', 'livre', '16/9', '4/3']);
    assert.equal(g2.titulo.startsWith('Gráfico 2'), false, 'título guarda só o texto; o prefixo é intrínseco');
    assert.deepEqual(gerarListaGraficos(doc).map(i => i.rotulo), ['Gráfico 1', 'Gráfico 2']);
    assert.deepEqual(gerarListaFiguras(doc).map(i => i.rotulo), ['Figura 1', 'Figura 2']);
    assert.deepEqual(gerarListaIlustracoes(doc, 'diagrama').map(i => i.rotulo), ['Diagrama 1']);
    assert.deepEqual(gerarListaIlustracoes(doc, 'esquema').map(i => i.rotulo), ['Esquema 1']);
    assert.equal(resolverReferenciasCruzadas(`ver [ref:esquema:${e1.id}] e [ref:grafico:${g2.id}]`, doc), 'ver Esquema 1 e Gráfico 2');
    assert.equal(PAPEIS_SEMANTICOS.length, 5);
  });

  it('"Quadro" por código divide o contador e a lista com os quadros de texto', () => {
    const doc = criarDocumento();
    const q1 = adicionarBlocoNaSecao(doc, corpo(doc).id, criarNovoBloco('quadro', { titulo: 'Texto' }));
    const q2 = nova(doc, 'frame', 'html_code');
    const q3 = adicionarBlocoNaSecao(doc, corpo(doc).id, criarNovoBloco('quadro', { titulo: 'Outro' }));
    const cont = recalcularNumeracaoAutomatica(doc);
    assert.deepEqual([q1, q2, q3].map(b => b.numero_sequencial), [1, 2, 3]);
    assert.equal(cont.quadros, 3);
    assert.deepEqual(gerarListaQuadros(doc).map(i => i.rotulo), ['Quadro 1', 'Quadro 2', 'Quadro 3']);
  });

  it('documento antigo (só imagem) migra para image_url + figure e continua igual', () => {
    const b = { id: 'x', tipo: 'figura', subtipo: 'grafico', layout: '2_lado', itens: [{ url: 'data:image/png;base64,AAAA', legenda_sub: 'A' }, { url: '', legenda_sub: 'B' }] };
    migrarBlocoFigura(b);
    assert.equal(b.semanticRole, 'chart');
    assert.equal(b.itens[0].sourceType, 'image_url');
    assert.equal(b.itens[0].content, 'data:image/png;base64,AAAA');
    assert.equal(b.itens[0].url, 'data:image/png;base64,AAAA');
    assert.equal(itemTemConteudo(b.itens[0]), true);
    assert.equal(itemTemConteudo(b.itens[1]), false);
    const d = descreverFigura(b);
    assert.equal(d.itens[0].url, 'data:image/png;base64,AAAA');
    assert.equal(d.itens[0].sourceType, 'image_url');
    // idempotente
    const antes = JSON.stringify(b);
    migrarBlocoFigura(b);
    assert.equal(JSON.stringify(b), antes);
    // legado sem nenhum campo novo, lido por recalcular
    const doc = criarDocumento();
    const leg = adicionarBlocoNaSecao(doc, corpo(doc).id, criarNovoBloco('figura', { itens: [{ url: 'u.png', legenda_sub: '' }] }));
    delete leg.semanticRole; delete leg.itens[0].sourceType; delete leg.itens[0].content;
    recalcularNumeracaoAutomatica(doc);
    assert.equal(leg.semanticRole, 'figure');
    assert.equal(fonteDoItem(leg.itens[0]).sourceType, 'image_url');
    assert.equal(papelSemanticoDoBloco({ subtipo: 'fluxograma' }), 'diagram');
  });

  it('definirPapelSemantico troca prefixo e contador sem apagar o conteúdo', () => {
    const doc = criarDocumento();
    const a = nova(doc, 'chart', 'chart_json');
    const b = nova(doc, 'chart', 'chart_json');
    definirPapelSemantico(b, 'diagram');
    recalcularNumeracaoAutomatica(doc);
    assert.equal(b.subtipo, 'diagrama');
    assert.equal(b.numero_sequencial, 1);
    assert.equal(a.numero_sequencial, 1);
    assert.equal(b.itens[0].semanticRole, 'diagram');
    assert.equal(b.itens[0].content, exemploDeCodigo('chart_json'));
  });
});

describe('Athenes — Tema (athenes-tema-v1) carrega as propriedades das figuras por código', () => {
  it('codigo_fundo e codigo_paleta: exportam, validam (sanitizam), aplicam e constam do prompt de IA', () => {
    assert.equal(sanitizarEstiloFigura({ codigo_fundo: 'xyz', codigo_paleta: 'cinza' }).codigo_fundo, 'transparente');
    assert.equal(extrairEstiloFigura({ codigo_fundo: 'branco', codigo_paleta: 'cinza' }).codigo_paleta, 'cinza');
    const doc = criarDocumento({ titulo: 'T' });
    const g = nova(doc, 'chart', 'chart_json', { codigo_fundo: 'suave', codigo_paleta: 'vivida' });
    const pacote = exportarPacoteEstilo(doc, { nome: 'X' });
    assert.equal(pacote.layout_padrao_figuras.figura.estilo_figura.codigo_fundo, 'suave');
    assert.equal(pacote.layout_padrao_figuras.figura.estilo_figura.codigo_paleta, 'vivida');
    const json = JSON.parse(JSON.stringify(pacote));
    json.layout_padrao_figuras.figura.estilo_figura.codigo_paleta = 'cinza';
    json.layout_padrao_figuras.figura.estilo_figura.codigo_fundo = 'invalido';
    const v = validarPacoteEstilo(json);
    assert.equal(v.valido ?? v.ok ?? true, true);
    const doc2 = criarDocumento({ titulo: 'Y' });
    const g2 = nova(doc2, 'chart', 'chart_json');
    aplicarPacoteEstilo(doc2, json, { aplicarNosBlocosExistentes: true });
    assert.equal(g2.codigo_paleta, 'cinza');
    assert.equal(g2.codigo_fundo, 'transparente');
    assert.equal(g2.itens[0].sourceType, 'chart_json', 'o tema nunca toca no conteúdo');
    void g;
    const prompt = obterPromptIaParaExtracaoDeLayout();
    assert.match(prompt, /codigo_fundo/);
    assert.match(prompt, /codigo_paleta/);
    assert.match(prompt, /semanticRole/);
  });
});

describe('Athenes — Exportação fiel de figuras por código (PDF e DOCX)', () => {
  const montar = () => {
    const doc = criarDocumento({ titulo: 'Export' });
    nova(doc, 'chart', 'chart_json');
    nova(doc, 'diagram', 'mermaid_code');
    nova(doc, 'scheme', 'svg_code');
    nova(doc, 'frame', 'html_code', { itens: [{ url: '', legenda_sub: '', sourceType: 'html_code', content: '<style>.q{color:red}</style><div class="q" onclick="x()">Quadro</div><script>alert(1)</script>' }] });
    nova(doc, 'diagram', 'mermaid_code', { itens: [{ url: '', legenda_sub: '', sourceType: 'mermaid_code', content: 'flowchart TD\n A -->' }] });
    return doc;
  };

  it('PDF: gráfico/Mermaid/SVG saem como <svg> vetorial; HTML escopado e sem script; erro vira aviso, sem quebrar', () => {
    const html = gerarDocumentoHtmlPdf(montar());
    assert.ok((html.match(/<svg /g) || []).length >= 3);
    assert.match(html, /Gráfico 1/);
    assert.match(html, /Diagrama 1/);
    assert.match(html, /Esquema 1/);
    assert.match(html, /Quadro 1/);
    assert.match(html, /\[data-ath-esc="f[^"]+_0"\] \.q\{color:red\}/);
    assert.ok(!/onclick|<script>alert/.test(html));
    assert.match(html, /Figura por código com erro/);
    assert.ok(!/<img src="data:image\/svg\+xml/.test(html.split('Esquema 1')[1] || ''), 'SVG não vira bitmap/img');
  });

  it('DOCX com rasterizador: PNG + SVG (svgBlip) por figura vetorial, PNG do HTML; legendas mantidas', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0x40, 0, 0, 0, 0xC8, 8, 6, 0, 0, 0]);
    const chamadas = [];
    const buf = await exportarParaDocx(montar(), { rasterizar: async (d) => { chamadas.push(d.tipo); return { bytes: png, largura: 320, altura: 200 }; } });
    const zip = abrirZip(buf);
    assert.equal(chamadas.filter(t => t === 'svg').length, 3);
    assert.equal(chamadas.filter(t => t === 'html').length, 1);
    const midia = zip.nomes.filter(n => n.startsWith('word/media/'));
    assert.equal(midia.filter(n => n.endsWith('.png')).length, 4);
    assert.equal(midia.filter(n => n.endsWith('.svg')).length, 3);
    const doc = await zip.texto('word/document.xml');
    assert.equal((doc.match(/asvg:svgBlip/g) || []).length, 3);
    assert.match(doc, /Gráfico 1/);
    assert.match(doc, /Esquema 1/);
    assert.match(doc, /Figura por código com erro/);
    const rels = await zip.texto('word/_rels/document.xml.rels');
    assert.match(rels, /rIdSvg\d+/);
    assert.match(await zip.texto('[Content_Types].xml'), /Extension="svg"/);
    const svg = await zip.texto(midia.find(n => n.endsWith('.svg')));
    assert.match(svg, /^<svg width="\d+" height="\d+" xmlns/);
    assert.ok(!/<script|onclick/.test(svg));
  });

  it('DOCX sem rasterizador: não quebra e deixa texto de reserva descritivo', async () => {
    const buf = await exportarParaDocx(montar());
    const zip = abrirZip(buf);
    assert.equal(zip.nomes.filter(n => n.startsWith('word/media/')).length, 0);
    assert.match(await zip.texto('word/document.xml'), /figura por código: abra no Athenes/);
  });

  it('DOCX: imagem PNG embutida ganha moldura (a:ln) e tamanho pela proporção do arquivo', async () => {
    const doc = criarDocumento({ titulo: 'Img' });
    const png64 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 100, 0, 0, 0, 50, 8, 6, 0, 0, 0]).toString('base64');
    adicionarBlocoNaSecao(doc, corpo(doc).id, criarNovoBloco('figura', { img_moldura: 'fina', itens: [{ url: `data:image/png;base64,${png64}`, legenda_sub: '' }] }));
    const zip = abrirZip(await exportarParaDocx(doc));
    assert.ok(zip.nomes.some(n => /word\/media\/image\d+\.png/.test(n)));
    const x = await zip.texto('word/document.xml');
    assert.match(x, /<a:ln w="\d+">/);
    const m = /<wp:extent cx="(\d+)" cy="(\d+)"/.exec(x);
    assert.ok(Math.abs(m[1] / m[2] - 2) < 0.01, 'proporção 2:1 preservada');
  });
});
