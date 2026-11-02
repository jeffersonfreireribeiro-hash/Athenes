// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularNumeracaoSecoes, extrairItensSumario, normalizarConfigSumario, sumarioHtml, nivelPadrao, aplicarTransformacao,
  removerNumeroManual, configEfetivaSumario, estiloIdDoTitulo, tagDoNivel, normalizarNumeracaoSecoes, NIVEL_MAX
} from '../src/core/athenes_sumario.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento, gerarSumarioDinamico } from '../src/core/athenes_documento.js';
import { criarEstilosPadrao, garantirEstilosDeTitulos } from '../src/core/athenes_estilos.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const corpo = (doc) => doc.secoes.find(s => s.mestraId === 'corpo');

function docComTitulos(niveis, { numerar = true } = {}) {
  const doc = criarDocumento({ titulo: 'Tese' });
  const sec = corpo(doc);
  sec.blocos = niveis.flatMap((n, i) => [
    criarNovoBloco('titulo', { id: `t${i}`, nivel: n, texto: `Título ${i} (n${n})` }),
    criarNovoBloco('paragrafo', { id: `p${i}`, texto: 'Texto do parágrafo.' })
  ]);
  if (numerar) doc.numeracao_secoes = { ativa: true };
  repaginarDocumento(doc);
  return doc;
}

test('numeração decimal progressiva até o nível 5 e além', () => {
  const doc = docComTitulos([1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 2, 6]);
  const m = calcularNumeracaoSecoes(doc);
  const pref = (i) => m.get(`t${i}`).prefixo;
  assert.deepEqual([0, 1, 2, 3, 4].map(pref), ['1', '1.1', '1.1.1', '1.1.1.1', '1.1.1.1.1']);
  assert.equal(pref(5), '1.1.1.1.2');
  assert.equal(pref(6), '1.1.1.2');
  assert.equal(pref(7), '1.1.2');
  assert.equal(pref(8), '1.2');
  assert.equal(pref(9), '2');
  assert.equal(pref(10), '2.1');
  assert.equal(pref(11), '2.1.1.1.1.1'); // nível pulado conta como 1
});

test('numeração: opt-in do documento, exceção por bloco, limite de nível e início', () => {
  const doc = docComTitulos([1, 2, 1], { numerar: false });
  assert.equal(calcularNumeracaoSecoes(doc).size, 0, 'desligada por padrão: documentos antigos não mudam');
  corpo(doc).blocos.find(b => b.id === 't0').numerar_secao = true;
  assert.deepEqual([...calcularNumeracaoSecoes(doc).keys()], ['t0']);
  doc.numeracao_secoes = { ativa: true, ate_nivel: 1, iniciar_em: 3 };
  corpo(doc).blocos.find(b => b.id === 't2').numerar_secao = false;
  const m = calcularNumeracaoSecoes(doc);
  assert.equal(m.get('t0').prefixo, '3');
  assert.equal(m.has('t1'), false, 'nível 2 acima do limite');
  assert.equal(m.has('t2'), false, 'bloco que ignora a numeração não consome número');
  assert.equal(normalizarNumeracaoSecoes({ ate_nivel: 99 }).ate_nivel, NIVEL_MAX);
});

test('número digitado à mão não duplica; títulos comuns são preservados', () => {
  assert.equal(removerNumeroManual('1.2 Contexto'), 'Contexto');
  assert.equal(removerNumeroManual('2. Método'), 'Método');
  assert.equal(removerNumeroManual('3) Resultados'), 'Resultados');
  assert.equal(removerNumeroManual('2024 em revisão'), '2024 em revisão');
  assert.equal(removerNumeroManual('Capítulo 1'), 'Capítulo 1');
});

test('extração do sumário: níveis, páginas, prefixos, filtros e ocultos', () => {
  const doc = docComTitulos([1, 2, 3, 4, 2]);
  corpo(doc).blocos.find(b => b.id === 't4').ocultar_no_sumario = true;
  corpo(doc).blocos.find(b => b.id === 't1').texto = '1.1 <b>Contexto</b>&nbsp;geral';
  repaginarDocumento(doc);
  const todos = extrairItensSumario(doc);
  assert.deepEqual(todos.slice(0, 4).map(i => i.prefixo), ['1', '1.1', '1.1.1', '1.1.1.1']);
  assert.ok(!todos.some(i => i.id === 't4'), 'título oculto fora do sumário');
  assert.equal(todos[todos.length - 1].texto, 'REFERÊNCIAS', 'seção de referências do documento padrão');
  assert.equal(todos[1].texto, 'Contexto geral', 'sem marcação, sem espaço rígido, sem número manual');
  assert.ok(todos.every(i => i.pagina >= 1 && i.id));
  assert.deepEqual(extrairItensSumario(doc, { profundidade: 2 }).map(i => i.nivel), [1, 2, 1]);
  assert.deepEqual(gerarSumarioDinamico(doc).map(i => i.id), todos.map(i => i.id), 'API antiga usa o mesmo motor');
});

test('sumário ignora subtítulos do documento e páginas de capa', () => {
  const doc = criarDocumento({ titulo: 'X' });
  repaginarDocumento(doc);
  const ids = gerarSumarioDinamico(doc).map(i => i.id);
  const cap = doc.secoes.find(s => s.mestraId === 'capa');
  assert.ok(cap.blocos.every(b => !ids.includes(b.id)));
});

test('configuração: padrão ABNT por nível, limites e herança do documento', () => {
  const c = normalizarConfigSumario(null);
  assert.equal(c.profundidade_max, 3);
  assert.deepEqual([c.niveis[1].transformacao, c.niveis[1].fonte.negrito], ['uppercase', true]);
  assert.deepEqual([c.niveis[2].transformacao, c.niveis[2].fonte.negrito], ['uppercase', false]);
  assert.equal(c.niveis[4].fonte.italico, true);
  assert.deepEqual([1, 2, 3].map(n => c.niveis[n].recuo_mm), [0, 5, 10]);
  assert.equal(Object.keys(c.niveis).length, NIVEL_MAX);
  const r = normalizarConfigSumario({ profundidade_max: 99, preenchimento: { tipo: 'x', cor: 'vermelho', espessura_pt: 50 }, niveis: { 2: { recuo_mm: -4, transformacao: 'zz', fonte: { tamanho_pt: 400, familia: 'inexistente', cor: '#abc' } } } });
  assert.equal(r.profundidade_max, 9);
  assert.deepEqual([r.preenchimento.tipo, r.preenchimento.cor, r.preenchimento.espessura_pt], ['pontos', '#94A3B8', 4]);
  assert.deepEqual([r.niveis[2].recuo_mm, r.niveis[2].transformacao, r.niveis[2].fonte.tamanho_pt, r.niveis[2].fonte.familia, r.niveis[2].fonte.cor], [0, 'uppercase', 36, '', '#1F2733']);
  const doc = { sumario_config_padrao: { profundidade_max: 5 } };
  assert.equal(configEfetivaSumario(doc, {}).profundidade_max, 5);
  assert.equal(configEfetivaSumario(doc, { sumario_config: { profundidade_max: 2 } }).profundidade_max, 2);
});

test('transformações de texto em português', () => {
  assert.equal(aplicarTransformacao('introdução à ciência', 'uppercase'), 'INTRODUÇÃO À CIÊNCIA');
  assert.equal(aplicarTransformacao('INTRODUÇÃO À CIÊNCIA', 'lowercase'), 'introdução à ciência');
  assert.equal(aplicarTransformacao('introdução à CIÊNCIA (parte-1)', 'capitalize'), 'Introdução À Ciência (Parte-1)');
  assert.equal(aplicarTransformacao('Texto', 'none'), 'Texto');
});

test('HTML do sumário: recuos, página por nível, preenchimentos, links e escape', () => {
  const itens = [
    { id: 'a', nivel: 1, prefixo: '1', texto: 'Intro <script>', pagina: 3 },
    { id: 'b', nivel: 2, prefixo: '1.1', texto: 'contexto', pagina: 4 },
    { id: 'c', nivel: 4, prefixo: '1.1.1.1', texto: 'detalhe', pagina: 5 }
  ];
  const cfg = { profundidade_max: 4, niveis: { 4: { mostrar_pagina: false, recuo_mm: 22, fonte: { cor: '#112233', cor_numero: '#445566' } }, 2: { fonte: { cor_pagina: '#778899' } } } };
  const h = sumarioHtml(itens, cfg);
  assert.match(h, /INTRO &lt;SCRIPT&gt;/, 'maiúsculas do nível 1 e HTML escapado');
  assert.doesNotMatch(h, /<script>/);
  assert.match(h, /margin:[\d.]+mm 0 [\d.]+mm 22mm/, 'recuo do nível 4');
  assert.match(h, /href="#ath-b-a"[^>]*data-sumario-alvo="a"/);
  const n4 = h.split('ath-toc-n4')[1];
  assert.doesNotMatch(n4, /ath-toc-pg|ath-toc-lider/, 'nível 4 sem número de página nem preenchimento');
  assert.match(n4, /color:#445566/, 'cor do número');
  assert.match(h.split('ath-toc-n2')[1], /ath-toc-pg" style="[^"]*color:#778899/, 'cor da página');
  assert.match(sumarioHtml(itens, { preenchimento: { tipo: 'pontos', densidade: 'denso' } }), /letter-spacing:0\.12em[^>]*>\.\.\.\./);
  assert.match(sumarioHtml(itens, { preenchimento: { tipo: 'tracos' } }), />----/);
  assert.match(sumarioHtml(itens, { preenchimento: { tipo: 'linha', espessura_pt: 2, cor: '#FF0000' } }), /border-bottom:2pt solid #FF0000/);
  const sem = sumarioHtml(itens, { preenchimento: { tipo: 'nenhum' } });
  assert.doesNotMatch(sem, /\.\.\.\.|----|border-bottom/);
  assert.match(sumarioHtml(itens, { titulo: { texto: 'Conteúdo', alinhamento: 'direita' } }), /text-align:right[^>]*>Conteúdo/);
  assert.doesNotMatch(sumarioHtml(itens, { profundidade_max: 1 }), /ath-toc-n2/);
  assert.match(sumarioHtml([], {}), /Nenhum título/);
});

test('estilos de título 4–6 existem e documentos antigos são completados', () => {
  const ids = criarEstilosPadrao('abnt').map(e => e.id);
  ['titulo4', 'titulo5', 'titulo6'].forEach(id => assert.ok(ids.includes(id)));
  const antigo = { perfil: 'abnt', estilos: criarEstilosPadrao('abnt').filter(e => !/^titulo[456]$/.test(e.id)) };
  garantirEstilosDeTitulos(antigo);
  assert.ok(antigo.estilos.some(e => e.id === 'titulo5'));
  const mapa = { titulo1: {}, titulo3: {} };
  assert.equal(estiloIdDoTitulo(mapa, { nivel: 5 }), 'titulo3', 'recua até o estilo mais próximo');
  assert.equal(estiloIdDoTitulo(mapa, { nivel: 2, estiloId: 'titulo1' }), 'titulo1');
  assert.equal(tagDoNivel(8), 'h6');
});

test('PDF: h1–h6, níveis 7+ acessíveis, prefixo, âncoras e sumário configurado', () => {
  const doc = docComTitulos([1, 2, 3, 4, 5, 6, 8]);
  const sec = corpo(doc);
  sec.blocos.splice(0, 0, criarNovoBloco('sumario', { id: 'toc' }));
  sec.blocos.find(b => b.id === 'toc').sumario_config = { profundidade_max: 6, preenchimento: { tipo: 'tracos' } };
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  for (let n = 1; n <= 6; n++) assert.match(html, new RegExp(`<h${n} id="ath-b-t${n - 1}"`));
  assert.match(html, /<h6 id="ath-b-t6"[^>]*role="heading" aria-level="8"/);
  assert.match(html, /<span class="ath-num-secao">1\.1\.1\.1<\/span> Título 3/);
  assert.match(html, /href="#ath-b-t3"/);
  assert.match(html, /ath-sumario-bloco/);
  assert.doesNotMatch(html.split('ath-sumario-bloco')[1].split('</div></div>')[0], /Título 6 \(n8\)/, 'nível 8 fora da profundidade 6');
});

test('DOCX: Heading1–9, marcadores, numeração e sumário com tabulação, líder e hiperlinks', async () => {
  const doc = docComTitulos([1, 2, 3, 4, 5]);
  const sec = corpo(doc);
  const toc = criarNovoBloco('sumario', { id: 'toc' });
  toc.sumario_config = { profundidade_max: 5, preenchimento: { tipo: 'linha' }, niveis: { 1: { fonte: { familia: 'times', tamanho_pt: 14 } }, 2: { mostrar_pagina: false } } };
  sec.blocos.unshift(toc);
  repaginarDocumento(doc);
  const t = Buffer.from(await exportarParaDocx(doc)).toString('utf8');
  for (let n = 1; n <= 9; n++) assert.ok(t.includes(`w:styleId="Heading${n}"`), `Heading${n}`);
  assert.ok(t.includes('<w:pStyle w:val="Heading5"/>'));
  assert.ok(t.includes('w:name="_Toc_t3"'));
  assert.ok(t.includes('w:anchor="_Toc_t3"'));
  assert.ok(t.includes('w:leader="underscore"'));
  assert.ok(t.includes('1.1.1.1 Título 3') || (t.includes('>1.1.1.1 </w:t>') && t.includes('Título 3')));
  assert.ok(t.includes('w:ascii="Times New Roman"') && t.includes('<w:sz w:val="28"/>'), 'fonte e tamanho do nível 1');
});

test('pacote de estilo: sumário e numeração viajam no tema (exportar, validar, aplicar)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  doc.sumario_config_padrao = { profundidade_max: 5, titulo: { texto: 'CONTEÚDO', alinhamento: 'esquerda' }, preenchimento: { tipo: 'tracos', cor: '#123456' }, niveis: { 2: { recuo_mm: 7, fonte: { negrito: true } } } };
  doc.numeracao_secoes = { ativa: true, ate_nivel: 4, separador: '.' };
  const pacote = exportarPacoteEstilo(doc);
  assert.equal(pacote.configuracaoGlobal.sumario.profundidade_max, 5);
  assert.equal(pacote.configuracaoGlobal.sumario.niveis[2].recuo_mm, 7);
  assert.equal(pacote.configuracaoGlobal.numeracao_secoes.ate_nivel, 4);
  const v = validarPacoteEstilo(JSON.parse(JSON.stringify(pacote)));
  assert.ok(v.valido);
  const alvo = criarDocumento({ titulo: 'Outro' });
  const toc = criarNovoBloco('sumario', {}); toc.sumario_config = { profundidade_max: 1 };
  corpo(alvo).blocos.push(toc);
  aplicarPacoteEstilo(alvo, JSON.parse(JSON.stringify(pacote)));
  assert.equal(alvo.sumario_config_padrao.titulo.texto, 'CONTEÚDO');
  assert.equal(alvo.numeracao_secoes.ativa, true);
  assert.equal(toc.sumario_config, undefined, 'bloco segue o tema ao propagar');
  assert.equal(configEfetivaSumario(alvo, toc).niveis[2].recuo_mm, 7);
  // valores inválidos vindos de IA/JSON externo são sanitizados
  const sujo = JSON.parse(JSON.stringify(pacote)); sujo.configuracaoGlobal.sumario = { profundidade_max: 50, preenchimento: { tipo: 'zig' } };
  assert.equal(validarPacoteEstilo(sujo).pacote.configuracaoGlobal.sumario.profundidade_max, 9);
  const prompt = obterPromptIaParaExtracaoDeLayout();
  assert.ok(prompt.includes('configuracaoGlobal.sumario') && prompt.includes('numeracao_secoes') && prompt.includes('cor_pagina'));
});
