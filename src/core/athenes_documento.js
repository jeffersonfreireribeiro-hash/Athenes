// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modelo de Dados do Documento, Blocos e Modelos de Página.
 * Arquitetura declarativa e reativa para relatórios e artigos científicos.
 */

import { criarEstilosPadrao, PERFIS_FORMATACAO } from './athenes_estilos.js';

let contadorId = 0;
export const gerarId = prefixo => `${prefixo || 'b'}_${Date.now().toString(36)}_${(contadorId++).toString(36)}`;

export const TIPOS_DOCUMENTO = Object.freeze([
  { id: 'artigo', rotulo: 'Artigo Científico', icone: 'artigo' },
  { id: 'relatorio', rotulo: 'Relatório Técnico', icone: 'relatorio' },
  { id: 'monografia', rotulo: 'Monografia / Tese / TCC', icone: 'livro' },
  { id: 'ensaio', rotulo: 'Ensaio / Paper Curto', icone: 'documento' }
]);

export const TIPOS_MODELO_PAGINA = Object.freeze([
  { id: 'capa', rotulo: 'Capa / Página de Rosto' },
  { id: 'corpo', rotulo: 'Corpo do Texto (Padrão)' },
  { id: 'sumario', rotulo: 'Sumário / Pré-Textual' },
  { id: 'referencias', rotulo: 'Referências Bibliográficas' },
  { id: 'anexos', rotulo: 'Anexos e Apêndices' }
]);

export const TIPOS_BLOCO = Object.freeze([
  'titulo',
  'subtitulo',
  'paragrafo',
  'lista',
  'citacao',
  'nota',
  'tabela',
  'imagem',
  'formula',
  'anexo',
  'sumario',
  'referencias',
  'separador'
]);

/**
 * Cria os modelos de página padrão reutilizáveis
 */
export function criarModelosPaginaPadrao(perfilId = 'abnt') {
  const p = PERFIS_FORMATACAO[perfilId] || PERFIS_FORMATACAO.abnt;
  const m = p.pagina.margens_mm;

  return [
    {
      id: 'capa',
      nome: 'Capa / Página Inicial',
      tipo: 'capa',
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { t: 30, r: 20, b: 20, l: 30 },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: { ativo: false, texto: '', logo: '' },
      rodape: { ativo: false, texto: '', numeracao: false },
      posicionamento_livre: true
    },
    {
      id: 'corpo',
      nome: 'Corpo de Texto',
      tipo: 'corpo',
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { ...p.pagina.grade },
      cabecalho: {
        ativo: true,
        texto: '{documento.titulo}',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '{documento.autor_principal}',
        numeracao: true,
        posicao_numero: p.numeracao.posicao,
        linha_divisoria: false
      },
      posicionamento_livre: false
    },
    {
      id: 'sumario',
      nome: 'Sumário',
      tipo: 'sumario',
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: { ativo: false, texto: '' },
      rodape: { ativo: true, texto: '', numeracao: false },
      posicionamento_livre: false
    },
    {
      id: 'referencias',
      nome: 'Referências Bibliográficas',
      tipo: 'referencias',
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: {
        ativo: true,
        texto: 'REFERÊNCIAS',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '',
        numeracao: true,
        posicao_numero: p.numeracao.posicao
      },
      posicionamento_livre: false
    },
    {
      id: 'anexos',
      nome: 'Anexos / Documentos Complementares',
      tipo: 'anexos',
      formato: p.pagina.formato,
      orientacao: p.pagina.orientacao,
      margens_mm: { ...m },
      grade: { colunas: 1, gap_mm: 0 },
      cabecalho: {
        ativo: true,
        texto: 'ANEXOS',
        alinhamento: 'direita',
        linha_divisoria: true
      },
      rodape: {
        ativo: true,
        texto: '',
        numeracao: true,
        posicao_numero: p.numeracao.posicao
      },
      posicionamento_livre: false
    }
  ];
}

/**
 * Cria um novo documento Athenes completo e estruturado
 */
export function criarDocumento(opcoes = {}) {
  const perfilId = opcoes.perfilId || 'abnt';
  const tipoDoc = opcoes.tipoDoc || 'artigo';
  const modelosPagina = criarModelosPaginaPadrao(perfilId);
  const estilos = criarEstilosPadrao(perfilId);

  const doc = {
    schema_versao: 1,
    id: opcoes.id || gerarId('doc'),
    titulo: opcoes.titulo || 'Novo Artigo Científico',
    subtitulo: opcoes.subtitulo || '',
    tipoDoc,
    estado: 'rascunho', // rascunho, em_revisao, finalizado
    dataCriacao: new Date().toISOString(),
    dataModificacao: new Date().toISOString(),

    metadados: {
      autores: opcoes.autores || [
        { nome: 'Autor Principal', email: '', afiliacao: 'Universidade / Instituição', orcid: '' }
      ],
      resumo: '',
      abstract: '',
      palavrasChave: ['Palavra-chave 1', 'Palavra-chave 2', 'Palavra-chave 3'],
      keywords: ['Keyword 1', 'Keyword 2', 'Keyword 3'],
      instituicao: 'Universidade / Centro de Pesquisa',
      cidade: 'Cidade',
      ano: new Date().getFullYear().toString()
    },

    perfil: perfilId,
    modelosPagina,
    estilos,
    referencias: [], // registros bibliográficos do documento
    notasLeitura: [], // fichamentos e notas pessoais associados às referências
    guias: [],       // guias magnéticas salvas

    paginas: []
  };

  // Se opções fornecerem páginas iniciais, usá-las; senão criar estrutura canônica inicial
  if (Array.isArray(opcoes.paginas) && opcoes.paginas.length > 0) {
    doc.paginas = opcoes.paginas;
  } else {
    // 1. Capa
    doc.paginas.push({
      id: gerarId('pg'),
      modeloId: 'capa',
      numero: 1,
      blocos: [
        {
          id: gerarId('bloco'),
          tipo: 'titulo',
          nivel: 1,
          texto: doc.titulo,
          col: 1,
          span: 1,
          estiloId: 'titulo1',
          alinhamento: 'centro'
        },
        {
          id: gerarId('bloco'),
          tipo: 'subtitulo',
          texto: doc.subtitulo || 'Subtítulo ou delimitação temática da pesquisa',
          col: 1,
          span: 1,
          estiloId: 'subtitulo',
          alinhamento: 'centro'
        },
        {
          id: gerarId('bloco'),
          tipo: 'paragrafo',
          texto: `${doc.metadados.autores.map(a => a.nome).join(', ')}<br><small>${doc.metadados.instituicao}</small>`,
          col: 1,
          span: 1,
          estiloId: 'corpo',
          alinhamento: 'centro'
        }
      ]
    });

    // 2. Corpo do texto
    doc.paginas.push({
      id: gerarId('pg'),
      modeloId: 'corpo',
      numero: 2,
      blocos: [
        {
          id: gerarId('bloco'),
          tipo: 'titulo',
          nivel: 1,
          texto: '1. INTRODUÇÃO',
          col: 1,
          span: 1,
          estiloId: 'titulo1'
        },
        {
          id: gerarId('bloco'),
          tipo: 'paragrafo',
          texto: 'Escreva diretamente neste bloco. Este ambiente permite diagramar artigos científicos, relatórios técnicos e monografias com rigor editorial e facilidade de escrita em blocos.',
          col: 1,
          span: 1,
          estiloId: 'corpo'
        },
        {
          id: gerarId('bloco'),
          tipo: 'citacao',
          texto: 'A escrita científica exige precisão conceitual, clareza metodológica e fundamentação bibliográfica sólida e atualizada.',
          autor: 'SILVA, J.',
          ano: '2024',
          pagina_citada: '45',
          col: 1,
          span: 1,
          estiloId: 'citacao_direta'
        },
        {
          id: gerarId('bloco'),
          tipo: 'titulo',
          nivel: 1,
          texto: '2. METODOLOGIA E RESULTADOS',
          col: 1,
          span: 1,
          estiloId: 'titulo1'
        },
        {
          id: gerarId('bloco'),
          tipo: 'paragrafo',
          texto: 'Os dados foram coletados e analisados seguindo os procedimentos descritos a seguir. A Tabela 1 apresenta a síntese das observações.',
          col: 1,
          span: 1,
          estiloId: 'corpo'
        },
        {
          id: gerarId('bloco'),
          tipo: 'tabela',
          titulo: 'Tabela 1 — Parâmetros de análise e distribuição amostral',
          fonte: 'Fonte: Elaborada pelos autores (2026).',
          col: 1,
          span: 1,
          colunas: ['Parâmetro', 'Grupo de Controle', 'Grupo Experimental', 'Significância (p)'],
          linhas: [
            ['Tempo de Execução (min)', '45,2 ± 3,1', '28,4 ± 2,0', '< 0,01'],
            ['Taxa de Eficiência (%)', '78,4%', '94,2%', '< 0,001'],
            ['Aderência Normativa', 'Conforme', 'Excelente', '0,04']
          ],
          larguras_relativas: [0.35, 0.22, 0.23, 0.20],
          com_cabecalho: true
        }
      ]
    });

    // 3. Referências
    doc.paginas.push({
      id: gerarId('pg'),
      modeloId: 'referencias',
      numero: 3,
      blocos: [
        {
          id: gerarId('bloco'),
          tipo: 'titulo',
          nivel: 1,
          texto: 'REFERÊNCIAS',
          col: 1,
          span: 1,
          estiloId: 'titulo1',
          alinhamento: 'esquerda'
        },
        {
          id: gerarId('bloco'),
          tipo: 'referencias',
          titulo: '',
          col: 1,
          span: 1,
          estiloId: 'referencias'
        }
      ]
    });
  }

  return doc;
}

/**
 * Localiza o modelo de página herdado por uma página
 */
export function modeloDaPagina(documento, pagina) {
  if (!documento || !pagina) return null;
  const modId = pagina.modeloId || 'corpo';
  return documento.modelosPagina.find(m => m.id === modId) || documento.modelosPagina[0];
}

/**
 * Extrai a lista do sumário (TOC) a partir de todos os blocos de título do documento
 */
export function gerarSumarioDinamico(documento) {
  if (!documento || !Array.isArray(documento.paginas)) return [];

  const itens = [];
  let numPagina = 1;

  for (const pag of documento.paginas) {
    // Ignora páginas pré-textuais (capa e o próprio sumário)
    if (pag.modeloId === 'capa' || pag.modeloId === 'sumario') {
      numPagina++;
      continue;
    }

    for (const b of (pag.blocos || [])) {
      if (b.tipo === 'titulo' && b.texto) {
        const nivel = Number(b.nivel) || 1;
        const textoLimpo = b.texto.replace(/<[^>]+>/g, '').trim();
        itens.push({
          id: b.id,
          nivel,
          texto: textoLimpo,
          pagina: numPagina
        });
      }
    }
    numPagina++;
  }

  return itens;
}

/**
 * Estatísticas do documento (páginas, palavras, caracteres, figuras e tabelas)
 */
export function calcularEstatisticas(documento) {
  let palavras = 0;
  let caracteres = 0;
  let figuras = 0;
  let tabelas = 0;
  let citacoes = 0;

  for (const pag of documento.paginas || []) {
    for (const b of pag.blocos || []) {
      if (b.tipo === 'imagem') figuras++;
      if (b.tipo === 'tabela') tabelas++;
      if (b.tipo === 'citacao') citacoes++;

      let textoConteudo = '';
      if (b.texto) textoConteudo += ` ${b.texto}`;
      if (b.titulo) textoConteudo += ` ${b.titulo}`;
      if (Array.isArray(b.itens)) {
        textoConteudo += ` ${b.itens.map(it => it.texto || it).join(' ')}`;
      }

      const puro = textoConteudo.replace(/<[^>]+>/g, '').trim();
      caracteres += puro.length;
      if (puro) {
        palavras += puro.split(/\s+/).filter(Boolean).length;
      }
    }
  }

  return {
    paginas: documento.paginas?.length || 0,
    palavras,
    caracteres,
    figuras,
    tabelas,
    citacoes,
    referencias: documento.referencias?.length || 0
  };
}

/**
 * Cria um novo bloco de conteúdo para inserção na página
 */
export function criarNovoBloco(tipo, opcoes = {}) {
  const id = gerarId('bloco');
  const base = {
    id,
    tipo,
    col: Number(opcoes.col) || 1,
    span: Number(opcoes.span) || 1,
    estiloId: opcoes.estiloId || (tipo === 'titulo' ? 'titulo1' : (tipo === 'citacao' ? 'citacao_direta' : 'corpo'))
  };

  switch (tipo) {
    case 'titulo':
      return {
        ...base,
        nivel: Number(opcoes.nivel) || 1,
        texto: opcoes.texto || 'Novo Título de Seção'
      };
    case 'subtitulo':
      return {
        ...base,
        texto: opcoes.texto || 'Subtítulo da Seção'
      };
    case 'paragrafo':
      return {
        ...base,
        texto: opcoes.texto || 'Digite o texto do parágrafo diretamente aqui...'
      };
    case 'lista':
      return {
        ...base,
        tipo_lista: opcoes.tipo_lista || 'marcadores', // 'marcadores' ou 'numerada' ou 'tarefas'
        itens: opcoes.itens || [
          { texto: 'Primeiro item da lista', nivel: 0, checked: false },
          { texto: 'Segundo item da lista', nivel: 0, checked: false },
          { texto: 'Terceiro item da lista', nivel: 0, checked: false }
        ]
      };
    case 'citacao':
      return {
        ...base,
        texto: opcoes.texto || 'Texto da citação direta com mais de três linhas...',
        autor: opcoes.autor || 'SOBRENOME, N.',
        ano: opcoes.ano || '2026',
        pagina_citada: opcoes.pagina_citada || '1'
      };
    case 'nota':
      return {
        ...base,
        tipo_nota: opcoes.tipo_nota || 'destaque', // 'destaque', 'aviso', 'observacao'
        titulo: opcoes.titulo || 'Nota Importante',
        texto: opcoes.texto || 'Texto explicativo ou contextual da nota.'
      };
    case 'tabela':
      return {
        ...base,
        titulo: opcoes.titulo || 'Tabela 1 — Descrição dos dados apresentados',
        fonte: opcoes.fonte || 'Fonte: Autores (2026).',
        colunas: opcoes.colunas || ['Coluna 1', 'Coluna 2', 'Coluna 3'],
        linhas: opcoes.linhas || [
          ['Dado A1', 'Dado B1', 'Dado C1'],
          ['Dado A2', 'Dado B2', 'Dado C2']
        ],
        larguras_relativas: [0.34, 0.33, 0.33],
        com_cabecalho: true
      };
    case 'imagem':
      return {
        ...base,
        url: opcoes.url || '',
        dataUrl: opcoes.dataUrl || '',
        legenda: opcoes.legenda || 'Figura 1 — Legenda descritiva da figura.',
        fonte: opcoes.fonte || 'Fonte: Autores (2026).',
        largura_pct: Number(opcoes.largura_pct) || 80,
        altura_max_mm: Number(opcoes.altura_max_mm) || 120,
        alinhamento: opcoes.alinhamento || 'centro'
      };
    case 'formula':
      return {
        ...base,
        latex: opcoes.latex || 'E = m \\cdot c^2',
        texto_alternativo: 'Equação de energia e massa',
        numero_equacao: '(1)'
      };
    case 'anexo':
      return {
        ...base,
        nome: opcoes.nome || 'Documento_Complementar.pdf',
        tipo_mime: opcoes.tipo_mime || 'application/pdf',
        tamanho_bytes: opcoes.tamanho_bytes || 102400,
        url: opcoes.url || '',
        descricao: opcoes.descricao || 'Arquivo em anexo com dados brutos ou comprobatórios.'
      };
    case 'sumario':
      return {
        ...base,
        titulo: 'SUMÁRIO'
      };
    case 'referencias':
      return {
        ...base,
        titulo: 'REFERÊNCIAS'
      };
    case 'separador':
      return {
        ...base,
        tipo_separador: opcoes.tipo_separador || 'linha', // 'linha', 'espaco', 'quebra_pagina'
        mm: Number(opcoes.mm) || 6
      };
    default:
      return base;
  }
}
