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
  ROTULOS_STATUS_LEITURA,
  TIPOS_REFERENCIA_VALIDOS,
  ROTULOS_TIPO_REFERENCIA,
  RAIZ_BIBLIOGRAFIA,
  CORES_CAPA_PADRAO
} from '../src/core/athenes_referencias.js';

test('Fábrica criarBookReferenceItem: gera valores padrão seguros quando chamada sem parâmetros', () => {
  const item = criarBookReferenceItem();
  assert.ok(item.id.startsWith('ref_'), 'deve gerar um id único com prefixo ref_');
  assert.equal(item.pastaId, 'todas');
  assert.equal(item.titulo, '');
  assert.deepEqual(item.autores, [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
  assert.equal(item.ano, 's.d.');
  assert.equal(item.tipo, 'artigo');
  assert.equal(item.corCapa, CORES_CAPA_PADRAO[0]);
  assert.equal(item.statusLeitura, STATUS_LEITURA.NAO_LIDO);
  assert.equal(item.totalCitationsCount, 0);
  assert.deepEqual(item.citedInDocumentIds, []);
  assert.equal(item.highlightsCount, 0);
  assert.deepEqual(item.pinnedNotes, []);
  assert.equal(item.formattedCitationKey, '(ANÔNIMO, s.d.)');
  assert.equal(item.pdfUrl, '');
  assert.equal(item.pdfCaminho, '');

  const validacao = validarBookReferenceItem({ ...item, titulo: 'Obra Válida' });
  assert.equal(validacao.valido, true, 'item gerado com título preenchido deve ser válido');
});

test('Normalização de Autores: trata múltiplos formatos, instituições e fallbacks', () => {
  // String com vírgula
  assert.deepEqual(normalizarAutores({ autores: 'Santos, Milton' }), [{ sobrenome: 'Santos', prenome: 'Milton' }]);

  // String sem vírgula (nome corrido)
  assert.deepEqual(normalizarAutores({ autores: 'Milton Santos' }), [{ sobrenome: 'Santos', prenome: 'Milton' }]);

  // Múltiplos autores em string separada por ponto e vírgula
  assert.deepEqual(normalizarAutores({ autores: 'Santos, Milton; Ribeiro, Ana Clara' }), [
    { sobrenome: 'Santos', prenome: 'Milton' },
    { sobrenome: 'Ribeiro', prenome: 'Ana Clara' }
  ]);

  // Múltiplos autores em string separada por ' e '
  assert.deepEqual(normalizarAutores({ autores: 'Milton Santos e Ana Clara Ribeiro' }), [
    { sobrenome: 'Santos', prenome: 'Milton' },
    { sobrenome: 'Ribeiro', prenome: 'Ana Clara' }
  ]);

  // Array de strings
  assert.deepEqual(normalizarAutores({ autores: ['Santos, Milton', 'Ana Ribeiro'] }), [
    { sobrenome: 'Santos', prenome: 'Milton' },
    { sobrenome: 'Ribeiro', prenome: 'Ana' }
  ]);

  // Autor institucional em string única
  assert.deepEqual(normalizarAutores({ autores: 'IBGE' }), [{ sobrenome: 'IBGE', prenome: '' }]);

  // Objeto Zotero com lastName e firstName
  assert.deepEqual(normalizarAutores({ autores: [{ lastName: 'Kleppmann', firstName: 'Martin' }] }), [
    { sobrenome: 'Kleppmann', prenome: 'Martin' }
  ]);

  // Objeto CSL com family e given
  assert.deepEqual(normalizarAutores({ autores: [{ family: 'Gehl', given: 'Jan' }] }), [
    { sobrenome: 'Gehl', prenome: 'Jan' }
  ]);

  // Autor institucional Zotero com 'name'
  assert.deepEqual(normalizarAutores({ autores: [{ name: 'Ministério das Cidades' }] }), [
    { sobrenome: 'Ministério das Cidades', prenome: '' }
  ]);

  // Objeto com 'nome'
  assert.deepEqual(normalizarAutores({ autores: [{ nome: 'Paulo Freire' }] }), [
    { sobrenome: 'Freire', prenome: 'Paulo' }
  ]);

  // Chamada passando diretamente array ou string
  assert.deepEqual(normalizarAutores('Santos, Milton'), [{ sobrenome: 'Santos', prenome: 'Milton' }]);
  assert.deepEqual(normalizarAutores([{ sobrenome: 'Silva', prenome: 'José' }]), [{ sobrenome: 'Silva', prenome: 'José' }]);

  // Fallback quando vazio
  assert.deepEqual(normalizarAutores({ autores: [] }), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
  assert.deepEqual(normalizarAutores({ autores: '' }), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
  assert.deepEqual(normalizarAutores(null), [{ sobrenome: 'ANÔNIMO', prenome: '' }]);
});

test('Normalização de Ano: extrai 4 dígitos, preserva sufixos e trata s.d.', () => {
  assert.equal(normalizarAno({ ano: '2025' }), '2025');
  assert.equal(normalizarAno({ ano: 2024 }), '2024');
  assert.equal(normalizarAno({ date: '2023-11-08' }), '2023');
  assert.equal(normalizarAno({ ano: '2022a' }), '2022a');
  assert.equal(normalizarAno({ ano: '(2020)' }), '2020');
  assert.equal(normalizarAno({ ano: 'c2019' }), '2019');
  assert.equal(normalizarAno({ ano: 'Publicado em 2025 (2ª edição)' }), '2025');
  assert.equal(normalizarAno({ ano: 's.d.' }), 's.d.');
  assert.equal(normalizarAno({ ano: 'sem data' }), 's.d.');
  assert.equal(normalizarAno({ ano: '' }), 's.d.');
  assert.equal(normalizarAno({}), 's.d.');
  assert.equal(normalizarAno(2021), '2021');
  assert.equal(normalizarAno('2020b'), '2020b');
});

test('Mapeamento de Tipos: converte tipos Zotero e legados para o catálogo canônico', () => {
  assert.equal(normalizarTipoReferencia('journalArticle'), 'artigo');
  assert.equal(normalizarTipoReferencia('book'), 'livro');
  assert.equal(normalizarTipoReferencia('bookSection'), 'capitulo_livro');
  assert.equal(normalizarTipoReferencia('thesis'), 'tese');
  assert.equal(normalizarTipoReferencia('conferencePaper'), 'conferencia');
  assert.equal(normalizarTipoReferencia('report'), 'relatorio');
  assert.equal(normalizarTipoReferencia('standard'), 'norma');
  assert.equal(normalizarTipoReferencia('webpage'), 'website');

  // Tipos legados Athenes
  assert.equal(normalizarTipoReferencia('artigo_periodico'), 'artigo');
  assert.equal(normalizarTipoReferencia('tese_dissertacao'), 'tese');
  assert.equal(normalizarTipoReferencia('trabalho_conferencia'), 'conferencia');
  assert.equal(normalizarTipoReferencia('relatorio_tecnico'), 'relatorio');
  assert.equal(normalizarTipoReferencia('norma_tecnica'), 'norma');

  // Tipo não mapeado vira 'outro'
  assert.equal(normalizarTipoReferencia('podcast'), 'outro');
  assert.equal(normalizarTipoReferencia(''), 'artigo');

  // Verifica constantes exportadas
  assert.ok(TIPOS_REFERENCIA_VALIDOS.includes('artigo'));
  assert.equal(ROTULOS_TIPO_REFERENCIA.artigo, 'Artigo');
  assert.equal(ROTULOS_STATUS_LEITURA.nao_lido, 'Não lido');
});

test('Dedução Inteligente de statusLeitura: respeita regras de fichamento, leitura e não lido', () => {
  // Caso Fichado por quickSummary
  const itemFichado1 = criarBookReferenceItem({ quickSummary: 'Resumo pessoal da obra' });
  assert.equal(itemFichado1.statusLeitura, STATUS_LEITURA.FICHADO);

  // Caso Fichado por destaques/highlights
  const itemFichado2 = criarBookReferenceItem({ highlightsCount: 3 });
  assert.equal(itemFichado2.statusLeitura, STATUS_LEITURA.FICHADO);

  // Caso Fichado por notas fixadas
  const itemFichado3 = criarBookReferenceItem({ pinnedNotes: ['Nota importante na página 2'] });
  assert.equal(itemFichado3.statusLeitura, STATUS_LEITURA.FICHADO);

  // Caso Fichado via objeto fichamento
  const itemFichado4 = criarBookReferenceItem({ fichamento: { resumoPessoal: 'Resumo no fichamento' } });
  assert.equal(itemFichado4.statusLeitura, STATUS_LEITURA.FICHADO);

  // Caso Lendo por PDF vinculado
  const itemLendo1 = criarBookReferenceItem({ pdfUrl: 'https://exemplo.org/doc.pdf' });
  assert.equal(itemLendo1.statusLeitura, STATUS_LEITURA.LENDO);

  const itemLendo2 = criarBookReferenceItem({ driveFileId: 'drive_12345' });
  assert.equal(itemLendo2.statusLeitura, STATUS_LEITURA.LENDO);

  const itemLendo3 = criarBookReferenceItem({ totalPaginas: 10 });
  assert.equal(itemLendo3.statusLeitura, STATUS_LEITURA.LENDO);

  // Caso Não Lido padrão
  const itemNaoLido = criarBookReferenceItem({ titulo: 'Nova Referência' });
  assert.equal(itemNaoLido.statusLeitura, STATUS_LEITURA.NAO_LIDO);

  // Prioridade do valor explícito fornecido
  const itemForcado = criarBookReferenceItem({
    pdfUrl: 'https://exemplo.org/doc.pdf',
    quickSummary: 'Resumo',
    statusLeitura: 'nao_lido'
  });
  assert.equal(itemForcado.statusLeitura, STATUS_LEITURA.NAO_LIDO);
});

test('Preservação Integral de Metadados: não perde propriedades do Zotero e Google Drive', () => {
  const dados = {
    id: 'ref_zot_01',
    chaveZotero: 'ZOT8K2M9',
    titulo: 'Regularização Fundiária Urbana',
    driveFileId: 'drive_pdf_reurb_2025',
    driveFileName: 'Santos_Ribeiro_2025.pdf',
    driveStatus: 'Sincronizado no Google Drive',
    doi: '10.22296/2317-1529',
    isbn: '978-85-000-0000-0',
    issn: '2317-1529',
    publicacao: 'RBEUR',
    volume: '27',
    numero: '2',
    paginas: '114-138',
    totalPaginas: 25,
    palavrasChave: ['REURB', 'SIG'],
    camposZotero: { extra: 'Nota interna' },
    versaoZotero: 4
  };

  const item = criarBookReferenceItem(dados);
  assert.equal(item.chaveZotero, 'ZOT8K2M9');
  assert.equal(item.driveFileId, 'drive_pdf_reurb_2025');
  assert.equal(item.driveFileName, 'Santos_Ribeiro_2025.pdf');
  assert.equal(item.driveStatus, 'Sincronizado no Google Drive');
  assert.equal(item.doi, '10.22296/2317-1529');
  assert.equal(item.isbn, '978-85-000-0000-0');
  assert.equal(item.issn, '2317-1529');
  assert.equal(item.publicacao, 'RBEUR');
  assert.equal(item.volume, '27');
  assert.equal(item.numero, '2');
  assert.equal(item.paginas, '114-138');
  assert.equal(item.totalPaginas, 25);
  assert.deepEqual(item.palavrasChave, ['REURB', 'SIG']);
  assert.deepEqual(item.camposZotero, { extra: 'Nota interna' });
  assert.equal(item.versaoZotero, 4);
});

test('Validador validarBookReferenceItem: detecta e relata erros com precisão', () => {
  // Não-objeto
  const r1 = validarBookReferenceItem(null);
  assert.equal(r1.valido, false);
  assert.ok(r1.erros[0].includes('objeto válido'));

  // Objeto vazio: lista múltiplos erros obrigatórios
  const r2 = validarBookReferenceItem({});
  assert.equal(r2.valido, false);
  assert.ok(r2.erros.some(e => e.includes('id')));
  assert.ok(r2.erros.some(e => e.includes('pastaId')));
  assert.ok(r2.erros.some(e => e.includes('titulo')));
  assert.ok(r2.erros.some(e => e.includes('autores')));
  assert.ok(r2.erros.some(e => e.includes('ano')));

  // Cor inválida e contadores negativos
  const itemInvalido = criarBookReferenceItem();
  itemInvalido.corCapa = 'azul-escuro';
  itemInvalido.totalCitationsCount = -1;
  itemInvalido.statusLeitura = 'invalido';
  itemInvalido.tipo = 'podcast';

  const r3 = validarBookReferenceItem(itemInvalido);
  assert.equal(r3.valido, false);
  assert.ok(r3.erros.some(e => e.includes('corCapa')));
  assert.ok(r3.erros.some(e => e.includes('totalCitationsCount')));
  assert.ok(r3.erros.some(e => e.includes('statusLeitura')));
  assert.ok(r3.erros.some(e => e.includes('tipo')));

  // Item íntegro
  const itemValido = criarBookReferenceItem({
    id: 'ref_100',
    pastaId: 'pasta_01',
    titulo: 'Direito Urbanístico',
    autores: [{ sobrenome: 'Silva', prenome: 'José' }],
    ano: '2024',
    tipo: 'livro',
    corCapa: '#FF6B2C'
  });
  const r4 = validarBookReferenceItem(itemValido);
  assert.equal(r4.valido, true);
  assert.equal(r4.erros.length, 0);
});

test('Agrupamento agruparPorPastas: distribui itens e garante pasta raiz', () => {
  const pastas = [
    { id: 'pasta_urbanismo', nome: 'Urbanismo', cor: '#FF6B2C' },
    { id: 'pasta_metodologia', nome: 'Metodologia', cor: '#1E5641' }
  ];

  const itens = [
    criarBookReferenceItem({ id: 'item1', pastaId: 'pasta_urbanismo', titulo: 'Livro 1' }),
    criarBookReferenceItem({ id: 'item2', pastaId: 'pasta_urbanismo', titulo: 'Livro 2' }),
    criarBookReferenceItem({ id: 'item3', pastaId: 'pasta_metodologia', titulo: 'Livro 3' }),
    criarBookReferenceItem({ id: 'item4', pastaId: 'pasta_fantasma', titulo: 'Livro Órfão' })
  ];

  const mapa = agruparPorPastas(itens, pastas);

  // Garante a existência da raiz mesmo sem ter sido passada
  assert.ok(mapa.has(RAIZ_BIBLIOGRAFIA));
  assert.ok(mapa.has('pasta_urbanismo'));
  assert.ok(mapa.has('pasta_metodologia'));

  // Contagens
  assert.equal(mapa.get('pasta_urbanismo').total, 2);
  assert.equal(mapa.get('pasta_metodologia').total, 1);
  // Livro com pastaId desconhecido foi roteado para a raiz
  assert.equal(mapa.get(RAIZ_BIBLIOGRAFIA).total, 1);
  assert.equal(mapa.get(RAIZ_BIBLIOGRAFIA).itens[0].id, 'item4');
});

test('calcularMetricasCitacao: cenário 1 — documento sem nenhuma citação retorna contagem zero e arrays vazios', () => {
  const ref = { id: 'ref_01', autores: [{ sobrenome: 'Santos', prenome: 'M.' }], ano: '2025' };
  const doc = {
    id: 'doc_1',
    titulo: 'Artigo Sem Citações',
    secoes: [
      { id: 'sec_1', nome: 'Introdução', blocos: [{ id: 'b1', tipo: 'paragrafo', texto: 'Apenas texto comum.' }] }
    ]
  };

  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 0);
  assert.deepEqual(metricas.citedInDocumentIds, []);
  assert.deepEqual(metricas.citedInSections, []);
  assert.equal(metricas.formattedCitationKey, '(SANTOS, 2025)');
});

test('calcularMetricasCitacao: cenário 2 — rastreamento em bloco citacao e inline na mesma seção', () => {
  const ref = { id: 'ref_01', autores: [{ sobrenome: 'Santos', prenome: 'Milton' }, { sobrenome: 'Ribeiro', prenome: 'Ana' }], ano: '2025' };
  const doc = {
    id: 'doc_1',
    titulo: 'Governança Urbana',
    secoes: [
      {
        id: 'sec_intro',
        nome: '1. INTRODUÇÃO',
        blocos: [
          {
            id: 'b1',
            tipo: 'paragrafo',
            texto: 'Como indicado por <a class="ath-citacao-link" href="#ref-ref_01" data-ref-id="ref_01">Santos e Ribeiro (2025)</a>, a urbanização é complexa.'
          },
          {
            id: 'b2',
            tipo: 'citacao',
            texto: 'A cidade se define como um meio técnico-científico-informacional.',
            ref_id: 'ref_01'
          }
        ]
      }
    ]
  };

  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 2);
  assert.deepEqual(metricas.citedInDocumentIds, ['doc_1']);
  assert.equal(metricas.citedInSections.length, 2);
  assert.deepEqual(metricas.citedInSections[0], {
    docId: 'doc_1',
    docTitulo: 'Governança Urbana',
    secaoId: 'sec_intro',
    secaoTitulo: '1. INTRODUÇÃO',
    blocoId: 'b1',
    count: 1
  });
  assert.deepEqual(metricas.citedInSections[1], {
    docId: 'doc_1',
    docTitulo: 'Governança Urbana',
    secaoId: 'sec_intro',
    secaoTitulo: '1. INTRODUÇÃO',
    blocoId: 'b2',
    count: 1
  });
});

test('calcularMetricasCitacao: cenário 3 — múltiplas citações no mesmo parágrafo e obras diferentes', () => {
  const refAlvo = { id: 'ref_alvo', autores: [{ sobrenome: 'Silva', prenome: 'João' }], ano: '2023' };
  const doc = {
    id: 'doc_1',
    titulo: 'Artigo Multicitação',
    secoes: [
      {
        id: 'sec_1',
        nome: 'Revisão Teórica',
        blocos: [
          {
            id: 'p1',
            tipo: 'paragrafo',
            texto: 'Conforme <a class="ath-citacao-link" data-ref-id="ref_alvo">Silva (2023)</a> e reforçado em <a class="ath-citacao-link" data-ref-id="ref_outra">Costa (2021)</a>, além de outro trecho de <a class="ath-citacao-link" data-ref-id="ref_alvo">(SILVA, 2023, p. 45)</a>.'
          }
        ]
      }
    ]
  };

  const metricas = calcularMetricasCitacao(refAlvo, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 2);
  assert.equal(metricas.citedInSections.length, 1);
  assert.equal(metricas.citedInSections[0].count, 2);
  assert.equal(metricas.citedInSections[0].blocoId, 'p1');
});

test('calcularMetricasCitacao: cenário 4 — referência na bibliografia mas sem citações no corpo do texto', () => {
  const ref = { id: 'ref_bio', chaveZotero: 'ZOT_99', autores: [{ sobrenome: 'Furtado', prenome: 'C.' }], ano: '1961' };
  const doc = {
    id: 'doc_1',
    titulo: 'Economia Regional',
    referencias: [
      { id: 'ref_bio', chaveZotero: 'ZOT_99', titulo: 'Desenvolvimento e Subdesenvolvimento' }
    ],
    secoes: [
      { id: 'sec_1', nome: 'Contexto', blocos: [{ id: 'b1', tipo: 'paragrafo', texto: 'Texto que ainda não citou a obra.' }] }
    ]
  };

  // Modo padrão (estrito): obra não citada no texto tem contagem zero e citedInDocumentIds vazio
  const mEstrito = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(mEstrito.totalCitationsCount, 0);
  assert.deepEqual(mEstrito.citedInSections, []);
  assert.deepEqual(mEstrito.citedInDocumentIds, []);

  // Modo flexível (com inclusão de bibliografia): citedInDocumentIds inclui o doc
  const mBib = calcularMetricasCitacao(ref, { documentoAtivo: doc, incluirBibliografiaEmCitedDocIds: true });
  assert.equal(mBib.totalCitationsCount, 0);
  assert.deepEqual(mBib.citedInSections, []);
  assert.deepEqual(mBib.citedInDocumentIds, ['doc_1']);
});

test('calcularMetricasCitacao: interoperabilidade entre ref.id e ref.chaveZotero', () => {
  const ref = { id: 'ref_local', chaveZotero: 'CHAVE_ZOTERO_ABC', autores: [{ sobrenome: 'Lefebvre', prenome: 'Henri' }], ano: '1968' };
  const doc = {
    id: 'doc_1',
    titulo: 'O Direito à Cidade',
    secoes: [
      {
        id: 'sec_1',
        nome: 'Capítulo 1',
        blocos: [
          // Citado via id local
          { id: 'b1', tipo: 'paragrafo', texto: '<a class="ath-citacao-link" data-ref-id="ref_local">Lefebvre (1968)</a>' },
          // Citado via chave Zotero
          { id: 'b2', tipo: 'citacao', texto: 'A cidade...', ref_id: 'CHAVE_ZOTERO_ABC' }
        ]
      }
    ]
  };

  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 2);
  assert.equal(metricas.citedInSections.length, 2);
});

test('calcularMetricasCitacao: deduplicação de documentos e múltiplos documentos do projeto', () => {
  const ref = { id: 'ref_1', autores: [{ sobrenome: 'Santos', prenome: 'M.' }], ano: '2025' };
  const doc1 = {
    id: 'doc_1',
    titulo: 'Doc 1',
    secoes: [{ id: 's1', nome: 'S1', blocos: [{ id: 'b1', tipo: 'paragrafo', texto: '<a class="ath-citacao-link" data-ref-id="ref_1">cit</a>' }] }]
  };
  const doc2 = {
    id: 'doc_2',
    titulo: 'Doc 2',
    secoes: [{ id: 's2', nome: 'S2', blocos: [{ id: 'b2', tipo: 'paragrafo', texto: '<a class="ath-citacao-link" data-ref-id="ref_1">cit</a>' }] }]
  };

  // doc1 é passado como documentoAtivo e repetido em todosDocumentos
  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc1, todosDocumentos: [doc1, doc2] });
  assert.equal(metricas.totalCitationsCount, 2);
  assert.deepEqual(metricas.citedInDocumentIds.sort(), ['doc_1', 'doc_2']);
  assert.equal(metricas.citedInSections.length, 2);
});

test('calcularMetricasCitacao: desescapa entidades HTML em atributos data-ref-id', () => {
  const ref = { id: 'ref&1', autores: [{ sobrenome: 'Test', prenome: 'A.' }], ano: '2024' };
  const doc = {
    id: 'doc_1',
    secoes: [{
      id: 's1',
      blocos: [{
        id: 'b1',
        tipo: 'paragrafo',
        texto: '<a class="ath-citacao-link" data-ref-id="ref&amp;1">Citação</a>'
      }]
    }]
  };
  const metricas = calcularMetricasCitacao(ref, { documentoAtivo: doc });
  assert.equal(metricas.totalCitationsCount, 1);
  assert.deepEqual(metricas.citedInDocumentIds, ['doc_1']);
});
