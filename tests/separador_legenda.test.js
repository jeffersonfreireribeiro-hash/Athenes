// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarDocumento, criarNovoBloco, repaginarDocumento, recalcularNumeracaoAutomatica, separadorLegenda, idSeparadorLegenda,
  SEPARADORES_LEGENDA, obterPrefixoNumeracao, obterTextoPuroTitulo, removerPrefixoNumeracaoTitulo, aplicarNumeracaoNoTitulo
} from '../src/core/athenes_documento.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo, obterPromptIaParaExtracaoDeLayout } from '../src/core/athenes_pacote_estilo.js';

const corpo = (doc) => doc.secoes.find(s => s.mestraId === 'corpo');

function docComLegendas() {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = corpo(doc);
  sec.blocos = [
    criarNovoBloco('tabela', { id: 'tab', titulo: 'Tabela 1 — Dados quantitativos' }),
    criarNovoBloco('figura', { id: 'fig', titulo: 'Figura 1 — Vista aérea' }),
    criarNovoBloco('mapa', { id: 'map', titulo: 'Mapa 1 — Área de estudo' }),
    criarNovoBloco('quadro', { id: 'qua', titulo: 'Quadro 1 — Categorias' })
  ];
  return doc;
}
const bloco = (doc, id) => corpo(doc).blocos.find(b => b.id === id);

test('padrão continua sendo o travessão (documentos existentes não mudam)', () => {
  const doc = docComLegendas();
  recalcularNumeracaoAutomatica(doc);
  assert.equal(bloco(doc, 'tab').titulo, 'Tabela 1 — Dados quantitativos');
  assert.equal(idSeparadorLegenda(doc, bloco(doc, 'tab')), 'travessao');
  assert.equal(obterPrefixoNumeracao(bloco(doc, 'tab')), 'Tabela 1 — ');
});

test('o separador do documento reescreve figuras, tabelas, mapas e quadros', () => {
  const doc = docComLegendas();
  for (const [id, esperado] of [['dois_pontos', ['Tabela 1: Dados quantitativos', 'Figura 1: Vista aérea', 'Mapa 1: Área de estudo', 'Quadro 1: Categorias']],
    ['ponto', ['Tabela 1. Dados quantitativos', 'Figura 1. Vista aérea', 'Mapa 1. Área de estudo', 'Quadro 1. Categorias']],
    ['espaco', ['Tabela 1 Dados quantitativos', 'Figura 1 Vista aérea', 'Mapa 1 Área de estudo', 'Quadro 1 Categorias']],
    ['meio_traco', ['Tabela 1 – Dados quantitativos', 'Figura 1 – Vista aérea', 'Mapa 1 – Área de estudo', 'Quadro 1 – Categorias']],
    ['hifen', ['Tabela 1 - Dados quantitativos', 'Figura 1 - Vista aérea', 'Mapa 1 - Área de estudo', 'Quadro 1 - Categorias']],
    ['travessao', ['Tabela 1 — Dados quantitativos', 'Figura 1 — Vista aérea', 'Mapa 1 — Área de estudo', 'Quadro 1 — Categorias']]]) {
    doc.separador_legenda = id;
    recalcularNumeracaoAutomatica(doc);
    assert.deepEqual(['tab', 'fig', 'map', 'qua'].map(k => bloco(doc, k).titulo), esperado, id);
  }
});

test('o bloco pode ignorar o padrão do documento', () => {
  const doc = docComLegendas();
  doc.separador_legenda = 'dois_pontos';
  bloco(doc, 'fig').separador_legenda = 'ponto';
  recalcularNumeracaoAutomatica(doc);
  assert.equal(bloco(doc, 'tab').titulo, 'Tabela 1: Dados quantitativos');
  assert.equal(bloco(doc, 'fig').titulo, 'Figura 1. Vista aérea');
  assert.equal(separadorLegenda(doc, bloco(doc, 'fig')), '. ');
  assert.equal(idSeparadorLegenda({ separador_legenda: 'invalido' }, { separador_legenda: 'tambem_invalido' }), 'travessao');
});

test('o texto do título é preservado em qualquer separador (sem prefixo duplicado)', () => {
  for (const x of SEPARADORES_LEGENDA) {
    const b = { tipo: 'tabela', numero_sequencial: 3, legenda_sep: x.valor, titulo: `Tabela 3${x.valor}Renda: média 2.5` };
    assert.equal(obterTextoPuroTitulo(b), 'Renda: média 2.5', x.id);
  }
  assert.equal(removerPrefixoNumeracaoTitulo('Tabela 2. Resultados'), 'Resultados');
  assert.equal(removerPrefixoNumeracaoTitulo('Figura 1asdasdasd'), 'asdasdasd', 'legado: prefixo encadeado');
  assert.equal(removerPrefixoNumeracaoTitulo('Quadro 4: Categorias'), 'Categorias');
});

test('título vazio fica só com o número e o separador sem espaço sobrando', () => {
  const doc = docComLegendas();
  doc.separador_legenda = 'dois_pontos';
  const b = bloco(doc, 'tab'); b.titulo = ''; b.numeracao_automatica = true;
  recalcularNumeracaoAutomatica(doc);
  assert.equal(b.titulo, 'Tabela 1:');
  const t = criarNovoBloco('tabela', { id: 'x', titulo: 'Dados' });
  corpo(doc).blocos.push(t);
  aplicarNumeracaoNoTitulo(t, doc);
  assert.match(t.titulo, /^Tabela 2: Dados$/);
});

test('PDF e DOCX usam o separador escolhido', async () => {
  const doc = docComLegendas();
  doc.separador_legenda = 'dois_pontos';
  bloco(doc, 'fig').separador_legenda = 'ponto';
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /Tabela 1: Dados quantitativos/);
  assert.match(html, /Figura 1\. Vista aérea/);
  assert.doesNotMatch(html, /Tabela 1 — /);
  const t = Buffer.from(await exportarParaDocx(doc)).toString('utf8');
  assert.ok(t.includes('Tabela 1: Dados quantitativos') && t.includes('Mapa 1: Área de estudo') && t.includes('Figura 1. Vista aérea'));
});

test('PDF aplica o estilo de numeração só ao prefixo, qualquer que seja o separador', () => {
  const doc = docComLegendas();
  doc.separador_legenda = 'dois_pontos';
  doc.estilos.push({ id: 'num_destaque', nome: 'Num', tipo: 'paragrafo', fonte: 'nunito', tamanho_pt: 10, peso: 800, cor: '#B91C1C', italico: false, sublinhado: false, caixa_alta: false, alinhamento: 'esquerda', entrelinha: 1.2, espaco_antes_pt: 0, espaco_depois_pt: 0, recuo_primeira_linha_mm: 0, recuo_esquerdo_mm: 0 });
  bloco(doc, 'tab').numeracao_estilo_id = 'num_destaque';
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /<span style="[^"]*#B91C1C[^"]*">Tabela 1: <\/span>Dados quantitativos/);
});

test('pacote de estilo: separador viaja no tema e é sanitizado', () => {
  const doc = docComLegendas();
  doc.separador_legenda = 'ponto';
  const pacote = exportarPacoteEstilo(doc);
  assert.equal(pacote.configuracaoGlobal.separador_legenda, 'ponto');
  assert.ok(validarPacoteEstilo(JSON.parse(JSON.stringify(pacote))).valido);
  const alvo = docComLegendas();
  bloco(alvo, 'tab').separador_legenda = 'hifen';
  aplicarPacoteEstilo(alvo, JSON.parse(JSON.stringify(pacote)));
  assert.equal(alvo.separador_legenda, 'ponto');
  assert.equal(bloco(alvo, 'tab').separador_legenda, undefined, 'blocos passam a seguir o tema');
  const sujo = JSON.parse(JSON.stringify(pacote)); sujo.configuracaoGlobal.separador_legenda = '<script>';
  assert.equal(validarPacoteEstilo(sujo).pacote.configuracaoGlobal.separador_legenda, undefined);
  assert.ok(obterPromptIaParaExtracaoDeLayout().includes('separador_legenda'));
});
