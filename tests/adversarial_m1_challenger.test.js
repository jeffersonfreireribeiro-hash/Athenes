// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarBookReferenceItem,
  validarBookReferenceItem,
  agruparPorPastas,
  calcularMetricasCitacao,
  normalizarAutores,
  normalizarAno,
  normalizarTipoReferencia,
  STATUS_LEITURA,
  TIPOS_REFERENCIA_VALIDOS,
  RAIZ_BIBLIOGRAFIA,
  CORES_CAPA_PADRAO
} from '../src/core/athenes_referencias.js';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// 1. SUÍTE ADVERSARIAL: NORMALIZAÇÃO DE AUTORES (EDGE CASES & CARACTERES ESPECIAIS)
// ---------------------------------------------------------------------------
test('Adversarial Autores 1: Strings com separadores mistos (; e & and)', () => {
  const strMista = 'da Silva, Maria e Souza, João; Santos, P. & Costa, R.';
  const res = normalizarAutores({ autores: strMista });
  assert.equal(res.length, 4, 'Deve decompor em 4 autores distintos');
  assert.equal(res[0].sobrenome, 'da Silva');
  assert.equal(res[0].prenome, 'Maria');
  assert.equal(res[1].sobrenome, 'Souza');
  assert.equal(res[1].prenome, 'João');
  assert.equal(res[2].sobrenome, 'Santos');
  assert.equal(res[2].prenome, 'P.');
  assert.equal(res[3].sobrenome, 'Costa');
  assert.equal(res[3].prenome, 'R.');
});

test('Adversarial Autores 2: Sobrenomes com partículas nobres e prefixos', () => {
  assert.deepEqual(normalizarAutores('van der Linden, C.'), [{ sobrenome: 'van der Linden', prenome: 'C.' }]);
  assert.deepEqual(normalizarAutores('von Neumann, John'), [{ sobrenome: 'von Neumann', prenome: 'John' }]);
  assert.deepEqual(normalizarAutores("O'Connor, Flannery"), [{ sobrenome: "O'Connor", prenome: 'Flannery' }]);
  assert.deepEqual(normalizarAutores('de la Cruz, Sor Juana Inés'), [{ sobrenome: 'de la Cruz', prenome: 'Sor Juana Inés' }]);
});

test('Adversarial Autores 3: Autores institucionais e corporativos com vírgula', () => {
  // Objeto Zotero com campo 'name' contendo vírgula
  const inst1 = normalizarAutores({ name: 'Companhia Brasileira de Alumínio, S.A.' });
  assert.equal(inst1[0].sobrenome, 'Companhia Brasileira de Alumínio');
  assert.equal(inst1[0].prenome, 'S.A.');

  // Objeto Zotero com campo 'name' simples
  const inst2 = normalizarAutores({ name: 'Ministério do Meio Ambiente' });
  assert.equal(inst2[0].sobrenome, 'Ministério do Meio Ambiente');
  assert.equal(inst2[0].prenome, '');
});

test('Adversarial Autores 4: Array com entradas nulas, vazias ou corrompidas', () => {
  const corrompido = [null, undefined, {}, { sobrenome: '' }, { prenome: 'Sem Sobrenome' }, '   ', ''];
  const res = normalizarAutores({ autores: corrompido });
  assert.deepEqual(res, [{ sobrenome: 'ANÔNIMO', prenome: '' }], 'Deve aplicar fallback seguro ANÔNIMO');
});

// ---------------------------------------------------------------------------
// 2. SUÍTE ADVERSARIAL: NORMALIZAÇÃO DE ANO E DATAS ATÍPICAS
// ---------------------------------------------------------------------------
test('Adversarial Ano 1: Sufixos alfanuméricos, intervalos e datas no texto', () => {
  assert.equal(normalizarAno('2024b'), '2024b');
  assert.equal(normalizarAno('2024-2025'), '2024');
  assert.equal(normalizarAno('c. 1950'), '1950');
  assert.equal(normalizarAno('1999/2000'), '1999');
  assert.equal(normalizarAno('(1988)'), '1988');
  assert.equal(normalizarAno('Decreto Lei nº 1.988 de 2023'), '2023', 'Ignora número com ponto (1.988) e captura o ano 2023');
});

test('Adversarial Ano 2: Termos acadêmicos especiais (s.d., no prelo, in press)', () => {
  assert.equal(normalizarAno('s.d.'), 's.d.');
  assert.equal(normalizarAno('sem data'), 's.d.');
  assert.equal(normalizarAno('n.d.'), 's.d.');
  assert.equal(normalizarAno('no prelo'), 'no prelo');
  assert.equal(normalizarAno('in press'), 'in press');

  // No validador estrito, 's.d.' é aceito, enquanto 'no prelo' e 'in press' são rejeitados
  const itemSd = criarBookReferenceItem({ id: 'r1', titulo: 'Obra', ano: 's.d.' });
  assert.equal(validarBookReferenceItem(itemSd).valido, true);

  const itemPrelo = criarBookReferenceItem({ id: 'r2', titulo: 'Obra', ano: 'no prelo' });
  const valPrelo = validarBookReferenceItem(itemPrelo);
  assert.equal(valPrelo.valido, false);
  assert.ok(valPrelo.erros.some(e => e.includes('ano')));
});

// ---------------------------------------------------------------------------
// 3. SUÍTE ADVERSARIAL: FÁBRICA criarBookReferenceItem E VALIDADOR
// ---------------------------------------------------------------------------
test('Adversarial Fábrica 1: Objeto com prototype null (Object.create(null))', () => {
  const protoNull = Object.create(null);
  protoNull.id = 'ref_proto_01';
  protoNull.pastaId = 'todas';
  protoNull.titulo = 'Livro Sem Prototype';
  protoNull.ano = '2024';
  protoNull.tipo = 'livro';
  protoNull.corCapa = '#FF6B2C';

  const item = criarBookReferenceItem(protoNull);
  assert.equal(item.id, 'ref_proto_01');
  assert.equal(item.titulo, 'Livro Sem Prototype');
  assert.equal(validarBookReferenceItem(item).valido, true);
});

test('Adversarial Fábrica 2: Tentativa de Prototype Pollution via __proto__', () => {
  const payloadJson = '{"__proto__": {"poluido": true}, "titulo": "Obra Maliciosa", "ano": "2024"}';
  const payloadObj = JSON.parse(payloadJson);
  const item = criarBookReferenceItem(payloadObj);
  assert.equal(item.titulo, 'Obra Maliciosa');
  assert.equal({}.poluido, undefined, 'Object.prototype não deve ter sido poluído');
});

test('Adversarial Fábrica 3: Comportamento empírico de criarBookReferenceItem(null)', () => {
  // Identifica e confirma empiricamente que dados = null quebra default params (dados = {})
  let erroDisparado = null;
  try {
    criarBookReferenceItem(null);
  } catch (err) {
    erroDisparado = err;
  }
  assert.ok(erroDisparado instanceof TypeError, 'Deve disparar TypeError devido a dados.id com null');
  assert.match(erroDisparado.message, /Cannot read properties of null/);
});

test('Adversarial Validador: Cores hexadecimais válidas vs inválidas', () => {
  const item = criarBookReferenceItem({ id: 'r1', titulo: 'Obra Válida', ano: '2024' });

  // 3 dígitos (#fff) e 6 dígitos (#314F79) são aceitos
  item.corCapa = '#fff';
  assert.equal(validarBookReferenceItem(item).valido, true);

  item.corCapa = '#314F79';
  assert.equal(validarBookReferenceItem(item).valido, true);

  // 8 dígitos (hex com alpha) ou rgb(...) ou nomes de cor são rejeitados
  item.corCapa = '#314F79AA';
  assert.equal(validarBookReferenceItem(item).valido, false);

  item.corCapa = 'rgb(49, 79, 121)';
  assert.equal(validarBookReferenceItem(item).valido, false);

  item.corCapa = 'azul';
  assert.equal(validarBookReferenceItem(item).valido, false);
});

// ---------------------------------------------------------------------------
// 4. SUÍTE ADVERSARIAL: AGRUPAMENTO POR PASTAS (PASTAS DUPLICADAS & ÓRFÃS)
// ---------------------------------------------------------------------------
test('Adversarial Agrupamento 1: Pastas duplicadas com mesmo ID', () => {
  const pastasDuplicadas = [
    { id: 'pasta_urbanismo', nome: 'Urbanismo A', cor: '#111111' },
    { id: 'pasta_urbanismo', nome: 'Urbanismo B', cor: '#222222' }
  ];
  const itens = [
    criarBookReferenceItem({ id: 'i1', pastaId: 'pasta_urbanismo', titulo: 'Livro 1' }),
    criarBookReferenceItem({ id: 'i2', pastaId: 'pasta_urbanismo', titulo: 'Livro 2' })
  ];

  const mapa = agruparPorPastas(itens, pastasDuplicadas);
  assert.equal(mapa.has('pasta_urbanismo'), true);
  // Não cria dois grupos no Map com a mesma chave
  assert.equal(mapa.get('pasta_urbanismo').total, 2);
  assert.equal(mapa.get('pasta_urbanismo').pasta.nome, 'Urbanismo B', 'Última declaração sobrescreve metadados');
  assert.equal(mapa.get('todas').total, 2);
});

test('Adversarial Agrupamento 2: Pastas sem ID, nulas ou com ID "todas"', () => {
  const pastasAnomalas = [
    null,
    undefined,
    { nome: 'Pasta Sem ID' },
    { id: '', nome: 'Pasta Com ID Vazio' },
    { id: 'todas', nome: 'Tentativa de Hijack de Todas' }
  ];
  const itens = [
    criarBookReferenceItem({ id: 'i1', pastaId: 'todas', titulo: 'Item 1' }),
    criarBookReferenceItem({ id: 'i2', pastaId: 'pasta_inexistente', titulo: 'Item Órfão' })
  ];

  const mapa = agruparPorPastas(itens, pastasAnomalas);
  // "todas" não pode ser sobrescrita por pastas externas
  assert.equal(mapa.get('todas').pasta.nome, 'Estante Geral');
  assert.equal(mapa.get('todas').total, 2);
  // Item órfão deve ir para a raiz canônica
  assert.equal(mapa.get(RAIZ_BIBLIOGRAFIA).total, 1);
  assert.equal(mapa.get(RAIZ_BIBLIOGRAFIA).itens[0].id, 'i2');
});

// ---------------------------------------------------------------------------
// 5. SUÍTE ADVERSARIAL: MÉTRICAS DE CITAÇÃO (STRESS & COMPLEXIDADE DE DOCUMENTOS)
// ---------------------------------------------------------------------------
test('Adversarial Métricas 1: Tags inline aninhadas com formatação mista', () => {
  const ref = { id: 'ref_complexa', autores: [{ sobrenome: 'Lefebvre', prenome: 'Henri' }], ano: '1968' };
  const doc = {
    id: 'doc_nested',
    titulo: 'Análise Espacial',
    secoes: [{
      id: 'sec_1',
      nome: 'Capítulo 1',
      blocos: [{
        id: 'b1',
        tipo: 'paragrafo',
        texto: '<p>Como enfatizado em <a class="ath-citacao-link" href="#ref-ref_complexa" data-ref-id="ref_complexa"><span><strong>Lefebvre</strong> <em>(1968)</em></span></a>, o espaço é social.</p>'
      }]
    }]
  };

  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 1);
  assert.deepEqual(metricas.citedInDocumentIds, ['doc_nested']);
  assert.equal(metricas.citedInSections.length, 1);
});

test('Adversarial Métricas 2: Múltiplas ocorrências da mesma citação no mesmo bloco', () => {
  const ref = { id: 'ref_multi', autores: [{ sobrenome: 'Santos', prenome: 'M.' }], ano: '2025' };
  const doc = {
    id: 'doc_1',
    secoes: [{
      id: 'sec_1',
      blocos: [{
        id: 'b1',
        tipo: 'paragrafo',
        texto: 'Primeira vez: <a class="ath-citacao-link" data-ref-id="ref_multi">Santos (2025)</a>. Segunda vez: <a class="ath-citacao-link" data-ref-id="ref_multi">Santos (2025)</a>.'
      }]
    }]
  };

  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 2, 'Contador total deve somar as 2 ocorrências');
  assert.deepEqual(metricas.citedInDocumentIds, ['doc_1'], 'Documento deve ser contabilizado apenas uma vez no Set');
  assert.equal(metricas.citedInSections[0].count, 2);
});

test('Adversarial Métricas 3: Entidades HTML especiais em data-ref-id', () => {
  const ref = { id: 'ref<teste>&"1\'', autores: [{ sobrenome: 'Especial', prenome: 'E.' }], ano: '2024' };
  const doc = {
    id: 'doc_1',
    secoes: [{
      id: 'sec_1',
      blocos: [{
        id: 'b1',
        tipo: 'paragrafo',
        texto: '<a class="ath-citacao-link" data-ref-id="ref&lt;teste&gt;&amp;&quot;1&#39;">Citação com caracteres especiais</a>'
      }]
    }]
  };

  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 1);
  assert.deepEqual(metricas.citedInDocumentIds, ['doc_1']);
});

test('Adversarial Métricas 4: Documento gigante com 10.000 blocos (stress de performance)', () => {
  const ref = { id: 'ref_popular', autores: [{ sobrenome: 'Harvey', prenome: 'David' }], ano: '2012' };
  const secoes = [];
  for (let s = 0; s < 50; s++) {
    const blocos = [];
    for (let b = 0; b < 200; b++) {
      const temCit = (s + b) % 11 === 0;
      blocos.push({
        id: `b_${s}_${b}`,
        tipo: 'paragrafo',
        texto: temCit
          ? '<p>Trecho com citação <a class="ath-citacao-link" data-ref-id="ref_popular">Harvey (2012)</a> incluída.</p>'
          : '<p>Trecho acadêmico longo sem referências diretas.</p>'
      });
    }
    secoes.push({ id: `sec_${s}`, nome: `Seção ${s}`, blocos });
  }

  const docGigante = { id: 'doc_grande_1', titulo: 'Tese Enciclopédica', secoes };
  const t0 = performance.now();
  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: docGigante });
  const t1 = performance.now();

  assert.ok(metricas.totalCitationsCount > 0, 'Deve ter localizado as citações');
  assert.ok((t1 - t0) < 500, `Processamento de 10.000 blocos deve levar menos de 500ms (levou ${(t1 - t0).toFixed(1)}ms)`);
});

test('Adversarial Métricas 5: Comportamento empírico sob seção nula ou bloco nulo', () => {
  const ref = { id: 'ref_1' };
  let erroSecaoNula = null;
  try {
    calcularMetricasCitacao(ref, { documentoAtivo: { id: 'doc_com_furo', secoes: [null] } });
  } catch (err) {
    erroSecaoNula = err;
  }
  assert.ok(erroSecaoNula instanceof TypeError, 'Deve disparar TypeError se secao for null');
  assert.match(erroSecaoNula.message, /Cannot read properties of null/);

  let erroBlocoNulo = null;
  try {
    calcularMetricasCitacao(ref, { documentoAtivo: { id: 'doc_com_furo', secoes: [{ id: 's1', blocos: [null] }] } });
  } catch (err) {
    erroBlocoNulo = err;
  }
  assert.ok(erroBlocoNulo instanceof TypeError, 'Deve disparar TypeError se bloco for null');
  assert.match(erroBlocoNulo.message, /Cannot read properties of null/);
});

// ---------------------------------------------------------------------------
// 6. SUÍTE ADVERSARIAL: CONTRATOS CSS E ACESSIBILIDADE DO INDICADOR DE SALVAMENTO (R1)
// ---------------------------------------------------------------------------
test('Adversarial CSS R1: Inspeciona regras do botão e animações concêntricas', () => {
  const cssPath = path.resolve('src/css/athenes_editor.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verifica declaração do spinner concêntrico
  assert.ok(css.includes('.ath-salvando'), 'CSS deve conter classe .ath-salvando');
  assert.ok(css.includes('ath-spinner-salvar'), 'CSS deve conter keyframes ath-spinner-salvar');
  assert.ok(css.includes('inset: 2px'), 'Spinner concêntrico deve usar inset: 2px');
  assert.ok(css.includes('border-radius: 50%'), 'Spinner concêntrico deve manter border-radius: 50%');
  assert.ok(css.includes('pointer-events: none !important'), 'Deve desativar cliques repetidos durante salvamento');
  assert.ok(css.includes('.ath-salvo'), 'CSS deve conter classe de sucesso .ath-salvo');
  assert.ok(css.includes('#15803D'), 'Classe .ath-salvo deve aplicar verde floresta #15803D');
  assert.ok(css.includes('.ath-salvar-erro'), 'CSS deve conter classe de erro .ath-salvar-erro');
  assert.ok(css.includes('ath-shake-salvar'), 'CSS deve conter animação de tremor ath-shake-salvar');
});
