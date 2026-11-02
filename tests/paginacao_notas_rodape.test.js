// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import {
  formatarNumeroEstilo, paraAlfa, textoNumeroPagina, normalizarNumeracao, normalizarArea, calcularNumerosExibidos,
  resolverAreasPagina, geometriaCorpoMm, zonasIniciais, substituirVariaveis
} from '../src/core/athenes_paginacao.js';
import {
  criarNotaRodape, htmlMarcadorNota, extrairIdsNotas, aplicarRotulosNotasHtml, textoMarcadorNota, sanitizarHtmlNota,
  removerNota, podarNotasOrfas, dividirHtmlPorCaracteres, obterConfigNotas, rotularNotas, ajustarNotasAoEspaco
} from '../src/core/athenes_notas_rodape.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const corpo = (doc) => doc.mestras.find(m => m.id === 'corpo');
const secCorpo = (doc) => doc.secoes.find(s => s.mestraId === 'corpo');
const decodificar = (bytes) => Buffer.from(bytes).toString('utf8');

/** Documento de 1 seção de corpo com N parágrafos, cada um com sua nota. */
function docComNotas(n, htmlNota = (i) => `Nota ${i}.`) {
  const doc = criarDocumento({ titulo: 'Artigo de Teste' });
  const sec = secCorpo(doc);
  sec.blocos = [];
  for (let i = 0; i < n; i++) {
    const nota = criarNotaRodape(doc, htmlNota(i));
    sec.blocos.push(criarNovoBloco('paragrafo', { texto: `Parágrafo ${i} do artigo, com texto suficiente para ocupar espaço.` + htmlMarcadorNota(nota.id) }));
  }
  repaginarDocumento(doc);
  return { doc, sec };
}

// ───────────── numeração ─────────────

test('Paginação — estilos numéricos (arábico, romano, letras) e formatos com prefixo/sufixo', () => {
  assert.equal(formatarNumeroEstilo(4, 'romano_mai'), 'IV');
  assert.equal(formatarNumeroEstilo(9, 'romano_min'), 'ix');
  assert.equal(formatarNumeroEstilo(3, 'alfa_mai'), 'C');
  assert.equal(paraAlfa(27, true), 'AA');
  assert.equal(formatarNumeroEstilo(3, 'alfa_min'), 'c');
  assert.equal(textoNumeroPagina(3, 10, { formato: 'apenas_numero' }), '3');
  assert.equal(textoNumeroPagina(3, 10, { formato: 'n_de_total' }), '3 de 10');
  assert.equal(textoNumeroPagina(3, 10, { formato: 'n_barra_total' }), '3 / 10');
  assert.equal(textoNumeroPagina(3, 10, { formato: 'pagina_n_de_total' }), 'Página 3 de 10');
  assert.equal(textoNumeroPagina(3, 10, { formato: 'apenas_numero', prefixo: 'p. ' }), 'p. 3');
  assert.equal(textoNumeroPagina(3, 10, { formato: 'apenas_numero', prefixo: 'Artigo - ' }), 'Artigo - 3');
  assert.equal(textoNumeroPagina(4, 10, { formato: 'pagina_n', estilo: 'romano_mai' }), 'Página IV');
  assert.equal(textoNumeroPagina(2, 9, { formato: 'personalizado', mascara: 'Folha {p}/{t}' }), 'Folha 2/9');
  assert.equal(textoNumeroPagina(5, 9, { formato: 'romano_min' }), 'v', 'formato legado romano_min');
});

test('Paginação — início da contagem e reinício por seção (a capa conta, mas não aparece)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  secCorpo(doc).blocos = Array.from({ length: 3 }, () => criarNovoBloco('quebra_pagina'));
  repaginarDocumento(doc);
  const pagsCapa = doc.paginas.filter(p => p.mestraId === 'capa').length;
  assert.equal(pagsCapa, 1);

  // padrão: contínua — corpo começa em 2
  const continuo = calcularNumerosExibidos(doc);
  assert.equal(continuo[0], 1);
  assert.equal(continuo[pagsCapa], 2);

  // reinício na introdução: o corpo recomeça em 1 mesmo sendo a folha 2 do arquivo
  corpo(doc).numeracao_pagina = { ativo: true, local: 'rodape', horizontal: 'direita', formato: 'apenas_numero', iniciar_em: 1, continuar: false };
  repaginarDocumento(doc);
  const exib = doc.paginas.map(p => p.numeroExibido);
  assert.equal(exib[0], 1);
  assert.equal(exib[pagsCapa], 1, 'primeira página do corpo = 1');
  assert.equal(exib[pagsCapa + 1], 2);

  // início customizado
  corpo(doc).numeracao_pagina.iniciar_em = 7;
  repaginarDocumento(doc);
  assert.equal(doc.paginas[pagsCapa].numeroExibido, 7);
  assert.equal(doc.paginas[pagsCapa + 1].numeroExibido, 8);
});

test('Paginação — legado: rodapé antigo continua funcionando (capa sem número, mestra do corpo numerada)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  secCorpo(doc).blocos = [criarNovoBloco('paragrafo', { texto: 'x' })];
  repaginarDocumento(doc);
  const n = normalizarNumeracao(doc, corpo(doc));
  assert.equal(n.legado, true);
  assert.equal(n.ativo, true);
  const capaPag = doc.paginas[0];
  const rc = resolverAreasPagina(doc, doc.mestras.find(m => m.id === 'capa'), capaPag, 1, doc.paginas.length);
  assert.equal(rc.rotuloNumero, '', 'capa sem número');
  const pagCorpo = doc.paginas.find(p => p.mestraId === 'corpo');
  const r = resolverAreasPagina(doc, corpo(doc), pagCorpo, pagCorpo.numeroExibido, doc.paginas.length);
  assert.ok(/\d+ de \d+/.test(r.rotuloNumero));
  // o perfil ABNT numera no canto superior direito: o número entra na zona direita do cabeçalho
  assert.equal(n.local, 'cabecalho');
  assert.ok(r.cabecalho.zonas.direita.startsWith('T · '), 'texto legado do cabeçalho migrado para a zona do alinhamento');
  assert.ok(r.cabecalho.zonas.direita.endsWith(r.rotuloNumero), 'número na mesma zona, depois do texto');
});

// ───────────── cabeçalho e rodapé ─────────────

test('Cabeçalho/rodapé — 3 zonas com variáveis, número posicionado e alternância livro (par/ímpar)', () => {
  const doc = criarDocumento({ titulo: 'Estudo de Caso' });
  const m = corpo(doc);
  m.cabecalho = { ativo: true, zonas: { esquerda: '{documento.autor_principal}', centro: '{{documento.titulo}}', direita: '{secao}' }, fonte: 'times', tamanho_pt: 10, cor: '#112233', linha_divisoria: true, linha_espessura_pt: 1.5, linha_cor: '#FF0000' };
  m.rodape = { ativo: true, zonas: { esquerda: '', centro: '', direita: '' } };
  m.numeracao_pagina = { ativo: true, local: 'rodape', horizontal: 'alternado', formato: 'apenas_numero' };
  const pag = (numero, naSecao = 2) => ({ numero, numeroNaSecao: naSecao, secaoId: secCorpo(doc).id });

  const impar = resolverAreasPagina(doc, m, pag(3), 3, 10);
  assert.equal(impar.cabecalho.zonas.esquerda, 'Autor Principal');
  assert.equal(impar.cabecalho.zonas.centro, 'Estudo de Caso');
  assert.equal(impar.cabecalho.zonas.direita, 'Corpo do Texto');
  assert.equal(impar.cabecalho.css.color, '#112233');
  assert.deepEqual(impar.cabecalho.linha, { espessura_pt: 1.5, cor: '#FF0000' });
  assert.equal(impar.rodape.zonas.direita, '3', 'ímpar: lado externo = direita');
  assert.equal(impar.rodape.zonas.esquerda, '');

  const par = resolverAreasPagina(doc, m, pag(4), 4, 10);
  assert.equal(par.rodape.zonas.esquerda, '4', 'par: lado externo = esquerda');
  assert.equal(par.rodape.zonas.direita, '');
});

test('Cabeçalho/rodapé — pares/ímpares diferentes, ocultar na primeira página e {pagina} explícito', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const m = corpo(doc);
  m.cabecalho = { ativo: true, zonas: { esquerda: 'ESQ', centro: '', direita: 'DIR' }, pares_impares_diferentes: true, ocultar_primeira_pagina: true };
  m.rodape = { ativo: true, zonas: { esquerda: 'Pág. {pagina} de {total}', centro: '', direita: '' } };
  m.numeracao_pagina = { ativo: true, local: 'rodape', horizontal: 'direita', formato: 'apenas_numero' };
  const pag = (numero, naSecao) => ({ numero, numeroNaSecao: naSecao, secaoId: secCorpo(doc).id });

  assert.equal(resolverAreasPagina(doc, m, pag(2, 1), 2, 9).cabecalho, null, 'oculta na primeira página da seção');
  const par = resolverAreasPagina(doc, m, pag(4, 3), 4, 9);
  assert.equal(par.cabecalho.zonas.esquerda, 'DIR', 'espelha esquerda ↔ direita nas pares');
  assert.equal(par.cabecalho.zonas.direita, 'ESQ');
  m.cabecalho.zonas_par = { esquerda: 'PAR-E', centro: 'PAR-C', direita: '' };
  assert.equal(resolverAreasPagina(doc, m, pag(4, 3), 4, 9).cabecalho.zonas.centro, 'PAR-C', 'zonas_par explícitas');
  // {pagina} posicionado pelo usuário: o número não é duplicado na zona automática
  const r = resolverAreasPagina(doc, m, pag(5, 4), 5, 9);
  assert.equal(r.rodape.zonas.esquerda, 'Pág. 5 de 9');
  assert.equal(r.rodape.zonas.direita, '');
  assert.equal(substituirVariaveis('{documento.titulo}\n{secao}', { doc: { titulo: 'A' }, secaoNome: 'B' }), 'A · B');
});

test('Geometria — cabeçalho/rodapé ficam na margem e a empurram se não couberem (sem sobrepor o corpo)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const m = corpo(doc);
  m.cabecalho = { ativo: true, zonas: { esquerda: 'x', centro: '', direita: '' }, distancia_borda_mm: 10, respiro_mm: 4, tamanho_pt: 9 };
  m.rodape = { ativo: true, zonas: { esquerda: '', centro: '', direita: '' }, distancia_borda_mm: 8 };
  const g = geometriaCorpoMm(m);
  assert.equal(g.topoMm, m.margens_mm.t, 'cabe na margem: corpo começa na margem');
  m.cabecalho.distancia_borda_mm = 28;
  m.cabecalho.respiro_mm = 10;
  assert.ok(geometriaCorpoMm(m).topoMm > m.margens_mm.t, 'não cabe: o corpo desce');
  assert.ok(geometriaCorpoMm(m).alturaCorpoMm < g.alturaCorpoMm);
  assert.equal(normalizarArea({ tamanho_pt: 999, cor: 'url(x)', peso: 5 }).tamanho_pt, 24);
  assert.equal(normalizarArea({ cor: 'url(x)' }).cor, '#64748B');
  assert.deepEqual(zonasIniciais({ cabecalho: { ativo: true, texto: 'Título', alinhamento: 'centro' } }, 'cabecalho'), { esquerda: '', centro: 'Título', direita: '' });
});

// ───────────── notas de rodapé: modelo ─────────────

test('Notas — marcadores (número, letras, símbolos), ids na ordem do texto e rótulos aplicados', () => {
  assert.deepEqual([1, 2, 3].map(i => textoMarcadorNota(i, 'numerico')), ['1', '2', '3']);
  assert.deepEqual([1, 2, 26, 27].map(i => textoMarcadorNota(i, 'alfabetico')), ['a', 'b', 'z', 'aa']);
  assert.deepEqual([1, 2, 3, 6, 7].map(i => textoMarcadorNota(i, 'simbolos')), ['*', '†', '‡', '¶', '**']);
  const html = `a${htmlMarcadorNota('nt_1')} b${htmlMarcadorNota('nt_2')}`;
  assert.deepEqual(extrairIdsNotas(html), ['nt_1', 'nt_2']);
  const rot = aplicarRotulosNotasHtml(html, { nt_1: 'x', nt_2: 'y' });
  assert.ok(rot.includes('>x</sup>') && rot.includes('>y</sup>'));
  assert.equal(aplicarRotulosNotasHtml('sem nota', { a: 'b' }), 'sem nota');
});

test('Notas — conteúdo seguro (links e formatação básica), remoção e poda de órfãs', () => {
  const limpo = sanitizarHtmlNota('<b onclick=x>ok</b><script>alert(1)</script><a href="javascript:alert(1)">ruim</a><a href="https://a.com/x?y=1&z=2" onclick="x">bom</a><img src=x onerror=y>');
  assert.ok(!/onclick|onerror|<script|<img|javascript:/i.test(limpo));
  assert.ok(limpo.includes('<b>ok</b>') && limpo.includes('<a href="https://a.com/x?y=1&amp;z=2" target="_blank" rel="noopener noreferrer">bom</a>'));

  const { doc, sec } = docComNotas(3);
  const id = doc.notasRodape[1].id;
  assert.equal(removerNota(doc, id), 1);
  assert.equal(doc.notasRodape.length, 2);
  assert.ok(!sec.blocos[1].texto.includes('ath-nota-ref'));
  sec.blocos[0].texto = 'sem marcador';
  assert.equal(podarNotasOrfas(doc), 1, 'nota sem marcador é podada');
});

test('Notas — renumeração automática em cascata ao inserir, excluir ou mover', () => {
  const { doc, sec } = docComNotas(4);
  const rotulos = () => Object.assign({}, ...doc.paginas.map(p => p.rotulosNotas));
  const ids = doc.notasRodape.map(n => n.id);
  assert.deepEqual(ids.map(i => rotulos()[i]), ['1', '2', '3', '4']);

  // insere uma nota no início: todas as demais avançam
  const nova = criarNotaRodape(doc, 'Nova');
  sec.blocos.unshift(criarNovoBloco('paragrafo', { texto: 'Novo' + htmlMarcadorNota(nova.id) }));
  repaginarDocumento(doc);
  assert.equal(rotulos()[nova.id], '1');
  assert.deepEqual(ids.map(i => rotulos()[i]), ['2', '3', '4', '5']);

  // move o último bloco para o início: a ordem do texto manda
  sec.blocos.unshift(sec.blocos.pop());
  repaginarDocumento(doc);
  assert.equal(rotulos()[ids[3]], '1');

  // exclui uma: as seguintes recuam
  removerNota(doc, ids[0]);
  repaginarDocumento(doc);
  assert.deepEqual([ids[3], nova.id, ids[1], ids[2]].map(i => rotulos()[i]), ['1', '2', '3', '4']);
});

// ───────────── paginação com notas ─────────────

test('Paginação — o espaço das notas é reservado antes de decidir a quebra', () => {
  const semNotas = docComNotas(0).doc;
  const corpoSemNotas = secCorpo(semNotas);
  corpoSemNotas.blocos = Array.from({ length: 15 }, (_, i) => criarNovoBloco('paragrafo', { texto: `Parágrafo ${i} do artigo, com texto suficiente para ocupar espaço.` }));
  repaginarDocumento(semNotas);
  const pagsSem = semNotas.paginas.filter(p => p.secaoId === corpoSemNotas.id);

  const { doc, sec } = docComNotas(15, () => 'Nota explicativa de tamanho razoável para consumir algumas linhas do rodapé da página corrente.');
  const pagsCom = doc.paginas.filter(p => p.secaoId === sec.id);
  assert.ok(pagsCom.length > pagsSem.length || pagsCom[0].blocos.length < pagsSem[0].blocos.length, 'notas reduzem o texto por página');
  // toda nota fica na MESMA página do seu marcador
  for (const pag of pagsCom) {
    const idsNoTexto = pag.blocos.flatMap(b => extrairIdsNotas(b.texto));
    const idsNasNotas = pag.notas.filter(n => !n.continuaDaAnterior).map(n => n.id);
    assert.deepEqual(idsNasNotas.sort(), idsNoTexto.sort());
  }
});

test('Paginação — nota longa não quebra a paginação: continua no rodapé da página seguinte (HTML bem formado)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = secCorpo(doc);
  const nota = criarNotaRodape(doc, '<b>Início em negrito</b> ' + 'palavra '.repeat(1700));
  sec.blocos = [
    criarNovoBloco('paragrafo', { texto: 'Texto com nota gigante' + htmlMarcadorNota(nota.id) }),
    criarNovoBloco('paragrafo', { texto: 'Segundo parágrafo.' })
  ];
  repaginarDocumento(doc);
  const pags = doc.paginas.filter(p => p.secaoId === sec.id);
  assert.ok(pags.length >= 3, 'a nota ocupa mais de uma página');
  const segs = pags.flatMap(p => p.notas);
  assert.equal(segs[0].continua, true);
  assert.equal(segs[1].continuaDaAnterior, true);
  assert.ok(!segs.at(-1).continua, 'último trecho não continua');
  assert.ok(segs.every(s => s.id === nota.id));
  // o marcador só é numerado uma vez (na página onde a nota começa)
  assert.equal(Object.keys(pags[0].rotulosNotas).length, 1);
  assert.deepEqual(pags.slice(1).map(p => Object.keys(p.rotulosNotas || {}).length), pags.slice(1).map(() => 0));
  // nada se perde na divisão
  const texto = segs.map(s => s.html.replace(/<[^>]+>/g, '')).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal((texto.match(/palavra/g) || []).length, 1700);
  // negrito do início foi fechado no 1º trecho
  assert.ok((segs[0].html.match(/<b>/g) || []).length === (segs[0].html.match(/<\/b>/g) || []).length);
  // o segundo parágrafo vai para uma página posterior à do início da nota
  assert.ok(pags.findIndex(p => p.blocos.some(b => b.texto === 'Segundo parágrafo.')) >= 1);

  const [a, b] = dividirHtmlPorCaracteres('<b>um dois três</b> quatro cinco', 12);
  assert.equal(a, '<b>um dois três</b>');
  assert.equal(b, 'quatro cinco');
  assert.deepEqual(dividirHtmlPorCaracteres('<i>curto</i>', 100), ['<i>curto</i>', '']);
  const r = ajustarNotasAoEspaco([{ id: 'x', html: 'a '.repeat(500) }], 80, obterConfigNotas({}), 450);
  assert.ok(r.visiveis.length + r.resto.length >= 1);
});

test('Notas — reinício por página e por seção', () => {
  const { doc } = docComNotas(14, () => 'Nota curta com texto médio para ocupar espaço no rodapé da página corrente do documento.');
  assert.ok(doc.paginas.length >= 2);
  doc.notas_config = { reiniciar: 'pagina', marcador: 'simbolos' };
  repaginarDocumento(doc);
  const primeiros = doc.paginas.filter(p => Object.keys(p.rotulosNotas || {}).length).map(p => Object.values(p.rotulosNotas)[0]);
  assert.ok(primeiros.length >= 2 && primeiros.every(r => r === '*'), 'cada página recomeça em *');
  const cfg = obterConfigNotas(doc);
  const copia = doc.paginas.map(p => ({ ...p }));
  doc.notas_config = { reiniciar: 'documento', marcador: 'alfabetico' };
  rotularNotas(doc, copia);
  const comNotas = copia.filter(p => Object.keys(p.rotulosNotas || {}).length);
  assert.equal(Object.values(comNotas[0].rotulosNotas)[0], 'a');
  assert.notEqual(Object.values(comNotas[1].rotulosNotas)[0], 'a', 'contínua: a 2ª página não recomeça')
  assert.equal(cfg.marcador, 'simbolos');
});

// ───────────── exportação ─────────────

test('PDF — cabeçalho/rodapé em 3 zonas, número no lado certo, notas com separador configurável', () => {
  const { doc } = docComNotas(2, (i) => `Conteúdo da <b>nota ${i}</b>.`);
  const m = corpo(doc);
  m.cabecalho = { ativo: true, zonas: { esquerda: 'ESQ-CAB', centro: 'CEN-CAB', direita: 'DIR-CAB' }, linha_divisoria: true, linha_espessura_pt: 2, linha_cor: '#00AA00', distancia_borda_mm: 7 };
  m.rodape = { ativo: true, zonas: { esquerda: 'RODAPE', centro: '', direita: '' } };
  m.numeracao_pagina = { ativo: true, local: 'rodape', horizontal: 'direita', formato: 'pagina_n', estilo: 'romano_mai' };
  doc.notas_config = { marcador: 'simbolos', separador: { comprimento_pct: 40, espessura_pt: 1.5, cor: '#FF8800' }, tamanho_pt: 9 };
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc).replace(/­/g, '');
  for (const t of ['ESQ-CAB', 'CEN-CAB', 'DIR-CAB', 'RODAPE']) assert.ok(html.includes(t), t);
  assert.match(html, /top:7mm/);
  assert.match(html, /border-bottom:2pt solid #00AA00/);
  assert.match(html, /Página [IVX]+</, 'número romano no rodapé');
  assert.match(html, /class="ath-notas-rodape"[^>]*font-size:9pt/);
  assert.match(html, /width:40%;background:#FF8800/);
  assert.ok(html.includes('Conteúdo da <b>nota 0</b>.'));
  assert.match(html, /class="ath-nota-ref"[^>]*>\*<\/sup>/, 'marcador em símbolo');
  assert.ok(!/ath-nota-ref"[^>]*>\d<\/sup>/.test(html));
});

test('DOCX — notas nativas do Word, campos PAGE/NUMPAGES, estilo romano e regras de seção', async () => {
  const { doc } = docComNotas(2, (i) => `Conteúdo da <b>nota ${i}</b>.`);
  const m = corpo(doc);
  m.cabecalho = { ativo: true, zonas: { esquerda: 'Autor', centro: '', direita: '{documento.titulo}' }, pares_impares_diferentes: true, ocultar_primeira_pagina: true };
  m.rodape = { ativo: true, zonas: { esquerda: '', centro: '', direita: '' } };
  m.numeracao_pagina = { ativo: true, local: 'rodape', horizontal: 'direita', formato: 'pagina_n_de_total', estilo: 'romano_min', iniciar_em: 1, continuar: false };
  doc.notas_config = { marcador: 'alfabetico', reiniciar: 'pagina' };
  repaginarDocumento(doc);
  const t = decodificar(await exportarParaDocx(doc));

  assert.ok(t.includes('<w:footnoteReference w:id="1"/>') && t.includes('<w:footnoteReference w:id="2"/>'));
  assert.ok(t.includes('<w:footnote w:id="1">') && t.includes('nota 0'));
  assert.ok(!t.includes('ath-nota-ref'), 'sem marcadores HTML crus');
  assert.ok(t.includes('<w:numFmt w:val="lowerLetter"/><w:numRestart w:val="eachPage"/>'));
  assert.ok(t.includes('PAGE \\* roman'), 'campo PAGE em romano minúsculo');
  assert.ok(t.includes('w:instr="NUMPAGES"'));
  assert.ok(t.includes('<w:pgNumType w:fmt="lowerRoman" w:start="1"/>'), 'reinício na seção do corpo');
  assert.ok(t.includes('<w:evenAndOddHeaders/>'), 'pares e ímpares diferentes');
  assert.ok(t.includes('<w:titlePg/>'), 'primeira página diferente (cabeçalho oculto)');
  assert.ok(t.includes('<w:tab w:val="center"') && t.includes('<w:tab w:val="right"'), 'zonas por tabulação');
});

test('Tema — paginação e notas viajam no athenes-tema-v1, com sanitização e prompt de IA atualizado', () => {
  const doc = criarDocumento({ titulo: 'D' });
  doc.paginacao = { ativo: true, local: 'cabecalho', horizontal: 'alternado', formato: 'pagina_n', estilo: 'romano_mai', iniciar_em: 3, continuar: false };
  doc.notas_config = { marcador: 'simbolos', reiniciar: 'secao', separador: { comprimento_pct: 50, espessura_pt: 1, cor: '#123456' }, tamanho_pt: 9 };
  corpo(doc).cabecalho = { ativo: true, zonas: { esquerda: 'A', centro: 'B', direita: 'C' }, distancia_borda_mm: 12 };
  const pacote = exportarPacoteEstilo(doc, { nome: 'T' });
  const g = pacote.configuracaoGlobal;
  assert.equal(g.paginacao.horizontal, 'alternado');
  assert.equal(g.paginacao.estilo, 'romano_mai');
  assert.equal(g.notas_rodape.marcador, 'simbolos');
  assert.equal(g.notas_rodape.separador.comprimento_pct, 50);
  assert.deepEqual(pacote.mestras.find(m => m.id === 'corpo').cabecalho.zonas, { esquerda: 'A', centro: 'B', direita: 'C' });

  const ruim = JSON.parse(JSON.stringify(pacote));
  ruim.configuracaoGlobal.paginacao.formato = '<script>';
  ruim.configuracaoGlobal.paginacao.iniciar_em = -5;
  ruim.configuracaoGlobal.notas_rodape.separador.cor = 'url(x)';
  ruim.configuracaoGlobal.notas_rodape.tamanho_pt = 9999;
  const v = validarPacoteEstilo(ruim);
  assert.equal(v.valido, true);
  assert.equal(v.pacote.configuracaoGlobal.paginacao.formato, 'n_de_total');
  assert.equal(v.pacote.configuracaoGlobal.paginacao.iniciar_em, 1);
  assert.equal(v.pacote.configuracaoGlobal.notas_rodape.separador.cor, '#64748B');
  assert.equal(v.pacote.configuracaoGlobal.notas_rodape.tamanho_pt, 16);

  const outro = criarDocumento({ titulo: 'Outro' });
  aplicarPacoteEstilo(outro, pacote);
  assert.equal(outro.paginacao.estilo, 'romano_mai');
  assert.equal(outro.notas_config.reiniciar, 'secao');

  const prompt = obterPromptIaParaExtracaoDeLayout();
  for (const chave of ['zonas', 'pares_impares_diferentes', 'ocultar_primeira_pagina', 'distancia_borda_mm', 'numeracao_pagina', 'alternado', 'romano_mai', 'notas_rodape', 'simbolos', 'separador']) {
    assert.ok(prompt.includes(chave), `prompt deve documentar "${chave}"`);
  }
});
