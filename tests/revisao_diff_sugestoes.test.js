// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import {
  MODOS_TRABALHO, modoSomenteLeitura, registrarSugestao, gerarHtmlMarcacaoSugestao, serializarSugestoesPadrao,
  aceitarSugestaoNoDocumento, rejeitarSugestaoNoDocumento
} from '../src/core/athenes_colaboracao.js';
import {
  tokenizarHtml, diffSequencias, compararHtml, resolverSugestoesEmHtml, temMarcasSugestao,
  documentoComSugestoesResolvidas, versoesDoDocumento, compararDocumento
} from '../src/core/athenes_diff.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';

// ───────────── auxiliares ─────────────

/** LCS por programação dinâmica (referência para validar o Myers). */
function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function semente(n) {
  let s = n >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Documento com um parágrafo contendo uma substituição e uma inserção pendentes. */
function docComSugestoes() {
  const doc = criarDocumento({ titulo: 'Revisão' });
  const p = criarNovoBloco('paragrafo', { texto: '' });
  const intacto = criarNovoBloco('paragrafo', { texto: 'Parágrafo sem alterações.' });
  doc.secoes[0].blocos.push(p, intacto);
  const sub = registrarSugestao(doc, { blocoId: p.id, tipo: 'substituicao', textoOriginal: 'cento e vinte', textoNovo: 'cento e trinta', autor: 'Prof. Helena', autorId: 'usr_h', corAutor: '#8B5CF6' });
  const ins = registrarSugestao(doc, { blocoId: p.id, tipo: 'insercao', textoNovo: ' (dados de 2026)', autor: 'Prof. Helena', autorId: 'usr_h', corAutor: '#8B5CF6' });
  p.texto = `O total foi de ${gerarHtmlMarcacaoSugestao(sub)} amostras${gerarHtmlMarcacaoSugestao(ins)}.`;
  repaginarDocumento(doc);
  return { doc, p, intacto, sub, ins };
}

// ───────────── diff ─────────────

test('Diff — Myers produz o menor script de edição (confere com LCS) em sequências aleatórias', () => {
  const rnd = semente(7);
  for (let t = 0; t < 250; t++) {
    const n = Math.floor(rnd() * 40);
    const m = Math.floor(rnd() * 40);
    const alfabeto = 1 + Math.floor(rnd() * 5);
    const a = Array.from({ length: n }, () => String(Math.floor(rnd() * alfabeto)));
    const b = Array.from({ length: m }, () => String(Math.floor(rnd() * alfabeto)));
    const { delA, insB } = diffSequencias(a, b);
    const l = lcs(a, b);
    const dels = delA.reduce((x, y) => x + y, 0);
    const inss = insB.reduce((x, y) => x + y, 0);
    assert.equal(dels, n - l, `remoções mínimas (caso ${t})`);
    assert.equal(inss, m - l, `adições mínimas (caso ${t})`);
    // o que sobra (não marcado) em A e em B é exatamente a mesma subsequência
    assert.deepEqual(a.filter((_, i) => !delA[i]), b.filter((_, j) => !insB[j]), `subsequência comum (caso ${t})`);
  }
});

test('Diff — HTML: realça só texto, preserva tags e mantém o aninhamento válido', () => {
  const r = compararHtml('O <b>gato</b> preto subiu no telhado azul.', 'O <b>gato</b> branco subiu no telhado vermelho de casa.');
  assert.equal(r.original, 'O <b>gato</b> <span class="ath-diff-del">preto</span> subiu no telhado <span class="ath-diff-del">azul.</span>');
  assert.equal(r.proposta, 'O <b>gato</b> <span class="ath-diff-add">branco</span> subiu no telhado <span class="ath-diff-add">vermelho de casa.</span>');
  assert.equal(r.remocoes, 2);
  assert.equal(r.adicoes, 4);

  // alteração cruzando uma tag: o span fecha antes da tag (nunca engloba <b>…</b> pela metade)
  const c = compararHtml('um <b>texto antigo</b> aqui', 'um <b>texto novo</b> aqui');
  for (const h of [c.original, c.proposta]) {
    const abre = (h.match(/<span/g) || []).length;
    const fecha = (h.match(/<\/span>/g) || []).length;
    assert.equal(abre, fecha, 'spans balanceados');
    assert.match(h, /<b>[^<]*(<span[^>]*>[^<]*<\/span>)?[^<]*<\/b>/, 'span dentro do <b>, não atravessando-o');
  }
  assert.equal(compararHtml('igual', 'igual').mudou, false);
  assert.deepEqual(tokenizarHtml('a <i>b</i>').map(t => t.v), ['a', ' ', '<i>', 'b', '</i>']);
});

test('Diff — desempenho: 30 mil palavras com poucas edições e pior caso de textos totalmente diferentes', () => {
  const base = Array.from({ length: 30000 }, (_, i) => 'palavra' + (i % 97)).join(' ');
  const alterado = base.replace('palavra10 palavra11', 'NOVA palavra11 EXTRA');
  let t0 = performance.now();
  const r = compararHtml(base, alterado);
  assert.ok(performance.now() - t0 < 800, 'poucas edições em texto longo: rápido');
  assert.equal(r.remocoes, 1);
  assert.equal(r.adicoes, 2);

  const a = Array.from({ length: 6000 }, (_, i) => 'a' + i).join(' ');
  const b = Array.from({ length: 6000 }, (_, i) => 'b' + i).join(' ');
  t0 = performance.now();
  const z = compararHtml(a, b);
  assert.ok(performance.now() - t0 < 3000, 'pior caso não trava');
  assert.equal(z.remocoes, 6000);
  assert.equal(z.adicoes, 6000);
});

// ───────────── sugestões ─────────────

test('Sugestões — metadados, escape, cor do autor e formato de intercâmbio', () => {
  const doc = criarDocumento({ titulo: 'D' });
  const s = registrarSugestao(doc, { blocoId: 'b1', tipo: 'substituicao', textoOriginal: 'a <b> & c', textoNovo: 'x', autor: 'Ana', autorId: 'usr_ana', corAutor: '#EC4899' });
  assert.equal(s.autorId, 'usr_ana');
  const html = gerarHtmlMarcacaoSugestao(s);
  assert.ok(html.includes('a &lt;b&gt; &amp; c'), 'conteúdo escapado (não injeta HTML)');
  assert.ok(html.includes('data-autor-id="usr_ana"'));
  assert.ok(html.includes('--ath-sug-cor:#EC4899'));
  assert.ok(/data-criado="\d{4}-\d{2}-\d{2}T/.test(html));
  assert.ok(!html.includes('</del> <ins'), 'sem espaço espúrio entre exclusão e inserção');
  assert.ok(!gerarHtmlMarcacaoSugestao({ ...s, corAutor: 'red;background:url(x)' }).includes('url('), 'cor inválida descartada');

  const ins = registrarSugestao(doc, { blocoId: 'b1', tipo: 'insercao', textoNovo: 'novo', autor: 'Ana', autorId: 'usr_ana' });
  const del = registrarSugestao(doc, { blocoId: 'b1', tipo: 'exclusao', textoOriginal: 'velho', autor: 'Ana', autorId: 'usr_ana' });
  const lista = serializarSugestoesPadrao(doc.sugestoes);
  assert.deepEqual(lista.map(x => x.type), ['deletion', 'insertion', 'insertion', 'deletion']);
  for (const item of lista) {
    for (const campo of ['id', 'author_id', 'author_name', 'timestamp', 'type', 'content']) assert.ok(campo in item, campo);
  }
  assert.equal(lista[0].group_id, lista[1].group_id, 'substituição: exclusão e inserção ligadas');
  assert.equal(lista[2].content, 'novo');
  assert.equal(lista[3].author_name, 'Ana');
  assert.ok(ins.id !== del.id);
});

test('Sugestões — aceitar e rejeitar (uma e todas) preservam o texto base', () => {
  const { doc, p, sub } = docComSugestoes();
  const textoMarcado = p.texto;
  assert.ok(temMarcasSugestao(textoMarcado));
  assert.equal(resolverSugestoesEmHtml(textoMarcado, 'rejeitar'), 'O total foi de cento e vinte amostras.');
  assert.equal(resolverSugestoesEmHtml(textoMarcado, 'aceitar'), 'O total foi de cento e trinta amostras (dados de 2026).');
  assert.equal(resolverSugestoesEmHtml('sem marcas', 'aceitar'), 'sem marcas');

  aceitarSugestaoNoDocumento(doc, sub.id);
  assert.ok(p.texto.startsWith('O total foi de cento e trinta amostras<ins'), 'aceitou a substituição; a inserção segue pendente');
  assert.ok(!p.texto.includes('cento e vinte') && !p.texto.includes('<del'), 'texto antigo descartado');
  assert.equal(doc.sugestoes.length, 1, 'só a inserção continua na lista');
  assert.equal(resolverSugestoesEmHtml(p.texto, 'aceitar'), 'O total foi de cento e trinta amostras (dados de 2026).');
});

test('Sugestões — rejeitar devolve exatamente o texto original', () => {
  const { doc, p, sub } = docComSugestoes();
  rejeitarSugestaoNoDocumento(doc, sub.id);
  assert.ok(p.texto.startsWith('O total foi de cento e vinte amostras'));
  assert.ok(!p.texto.includes('cento e trinta'));
});

// ───────────── versões do documento, comparação e exportação ─────────────

test('Versões — sem sugestões não há clone; com sugestões o documento base nunca é alterado', () => {
  const limpo = criarDocumento({ titulo: 'Limpo' });
  assert.equal(documentoComSugestoesResolvidas(limpo), limpo, 'custo zero no caso comum');
  assert.equal(versoesDoDocumento(limpo).alterados, false);

  const { doc, p, intacto } = docComSugestoes();
  const antes = p.texto;
  const { original, proposta, alterados } = versoesDoDocumento(doc);
  assert.equal(alterados, true);
  assert.equal(p.texto, antes, 'documento base intacto');
  const bo = original.secoes[0].blocos.find(b => b.id === p.id);
  const bp = proposta.secoes[0].blocos.find(b => b.id === p.id);
  assert.equal(bo.texto, 'O total foi de cento e vinte amostras.');
  assert.equal(bp.texto, 'O total foi de cento e trinta amostras (dados de 2026).');
  assert.equal(original.secoes[0].blocos.find(b => b.id === intacto.id), intacto, 'blocos sem marcas são compartilhados (sem cópia)');
  // as folhas refletem os blocos clonados
  const naFolha = proposta.paginas.flatMap(pg => pg.blocos).find(b => b.id === p.id);
  assert.equal(naFolha, bp);
});

test('Comparar — diff por bloco com estatísticas e realce nas duas versões', () => {
  const { doc, p } = docComSugestoes();
  const { original, proposta, stats } = compararDocumento(doc);
  assert.equal(stats.blocosAlterados, 1);
  assert.deepEqual(stats.idsAlterados, [p.id]);
  assert.ok(stats.remocoes >= 1 && stats.adicoes >= 3);
  const bo = original.secoes[0].blocos.find(b => b.id === p.id);
  const bp = proposta.secoes[0].blocos.find(b => b.id === p.id);
  assert.ok(bo.texto.includes('class="ath-diff-del">vinte'), 'remoção realçada na original');
  assert.ok(bp.texto.includes('class="ath-diff-add">trinta'), 'adição realçada na proposta');
  assert.ok(!bo.texto.includes('ath-diff-add') && !bp.texto.includes('ath-diff-del'));
  assert.equal(compararDocumento(criarDocumento({ titulo: 'x' })).stats.blocosAlterados, 0);
});

test('Exportação — sugestões pendentes saem como proposta aceita (sem <ins>/<del> cruas)', async () => {
  const { doc } = docComSugestoes();
  const html = gerarDocumentoHtmlPdf(doc).replace(/­/g, ''); // ignora hifens suaves da hifenização
  assert.ok(html.includes('cento e trinta amostras (dados de 2026).'));
  assert.ok(!html.includes('ath-sug-mark'));
  assert.ok(!html.includes('cento e vinte'));
  assert.ok(gerarDocumentoHtmlPdf(doc, { sugestoes: 'manter' }).includes('ath-sug-mark'), 'opção explícita preserva as marcas');
  assert.ok(gerarDocumentoHtmlPdf(doc, { cssExtra: '.x-teste{color:red}' }).includes('.x-teste{color:red}'), 'CSS extra da leitura fiel');

  const docx = new TextDecoder('utf-8').decode(await exportarParaDocx(doc));
  assert.ok(!docx.includes('ath-sug-mark'));
});

test('Modos — Comparar e Leitura são somente leitura; Edição e Sugestão não', () => {
  assert.equal(MODOS_TRABALHO.COMPARAR, 'comparar');
  assert.equal(modoSomenteLeitura(MODOS_TRABALHO.COMPARAR), true);
  assert.equal(modoSomenteLeitura(MODOS_TRABALHO.VISUALIZACAO), true);
  assert.equal(modoSomenteLeitura(MODOS_TRABALHO.EDICAO), false);
  assert.equal(modoSomenteLeitura(MODOS_TRABALHO.SUGESTAO), false);
});
