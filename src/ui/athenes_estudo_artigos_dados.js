// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Artigos: dados da biblioteca (artigos de exemplo, persistência), PDFs (pdf.js, Drive, IndexedDB),
 * citação ABNT e utilidades do desenho à mão livre. Separado da tela (athenes_estudo_artigos.js) para o arquivo não crescer sem fim.
 */
import * as bib from '../core/athenes_biblioteca_artigos.js';
import { obterTokenDrive, obterPastaRaizDrive, buscarOuCriarPasta, obterOuCriarPastaDoArtigoNoDrive, moverArquivoNoDrive } from '../core/athenes_drive_sync.js';
import { mostrarAviso } from './athenes_aviso.js';
import { salvarArquivoNoGoogleDrive } from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { codificarMetadadosNotaZotero } from '../core/athenes_zotero_anexos_notas.js';
import { blobEhPdf, normalizarDoi, normalizarIsbn } from '../core/athenes_pdf_identificadores.js';

export const STORAGE_KEY_ARTIGOS = 'athenes_estudo_artigos_v1';
export const IDS_ARTIGOS_EXEMPLO = new Set(['zot_art_01', 'zot_art_02', 'zot_art_03']);
export const CHAVES_ZOTERO_EXEMPLO = new Set(['ZOT8K2M9', 'ZOT4P9L2', 'ZOT9R3X7']);
const buscasPdfPublico = new WeakSet();

export function ehArtigoExemploFicticio(art) {
  if (!art) return false;
  return IDS_ARTIGOS_EXEMPLO.has(art.id) || CHAVES_ZOTERO_EXEMPLO.has(art.chaveZotero) || CHAVES_ZOTERO_EXEMPLO.has(art.chave);
}

/** O artigo tem (ou pode abrir) um PDF de verdade? Sem ele o estúdio avisa, em vez de inventar páginas. */
export function artigoTemPdf(art) {
  if (!art) return false;
  if (art.pdfVerificadoInvalido) return false;
  if (ehArtigoExemploFicticio(art) || art.pdfBlobUrl || art.temPdfLocal || art.pdfDataUrl) return true;
  const id = String(art.driveFileId || '').trim();
  return Boolean(id) && !/^drive_pdf_/.test(id);
}

export function criarArtigosEstudoExemplo() {
  return [
    {
      id: 'zot_art_01',
      chaveZotero: 'ZOT8K2M9',
      pastaId: 'pasta_bib_raiz',
      titulo: 'Regularização Fundiária Urbana e Morfologia de Assentamentos Consolidados na América Latina',
      autores: [
        { sobrenome: 'Santos', prenome: 'Milton' },
        { sobrenome: 'Ribeiro', prenome: 'Ana Clara' }
      ],
      ano: '2025',
      publicacao: 'Revista Brasileira de Estudos Urbanos e Regionais (RBEUR)',
      volume: '27',
      numero: '2',
      paginas: '114-138',
      doi: '10.22296/2317-1529.rbeur.2025v27n2p114',
      palavrasChave: ['REURB', 'Morfologia Urbana', 'Cadastro Territorial', 'SIG'],
      driveFileId: 'drive_pdf_reurb_2025',
      driveFileName: 'Santos_Ribeiro_2025_REURB_Morfologia.pdf',
      driveStatus: 'Sincronizado no Google Drive',
      corCapa: '#314F79',
      totalPaginas: 3,
      resumoOriginal: 'Este artigo analisa os instrumentos técnicos e jurídicos de regularização fundiária urbana (REURB-S e REURB-E) aplicados a núcleos urbanos informais consolidados, propondo diretrizes para integração entre levantamento aerofotogramétrico, cadastro multifinalitário e titulação.',
      fichamento: {
        resumoPessoal: 'Artigo fundamental para a seção de Metodologia. Demonstra que a integração entre o banco territorial (PostGIS) e peças técnicas automatizadas reduz em 64% o tempo de emissão da CRF.',
        metodologiaNotas: 'Estudo comparativo em 14 núcleos urbanos com uso de poligonais georreferenciadas SIRGAS 2000 / UTM e validação topológica prévia.',
        citacoesMarcadas: [
          {
            id: 'cit_1',
            pagina: 1,
            texto: 'A segurança jurídica da posse depende diretamente da precisão geométrica e da rastreabilidade social do cadastro territorial.',
            comentario: 'Usar na Introdução (parágrafo 3) para fundamentar a escolha metodológica.',
            cor: '#FACC15',
            criadoEm: '2026-11-01T14:20:00Z'
          },
          {
            id: 'cit_2',
            pagina: 2,
            texto: 'A dissociação entre a planta de parcelamento e os memoriais descritivos é a principal causa de notas devolutivas no registro de imóveis.',
            comentario: 'Excelente argumento para justificar o motor paramétrico do Athenes.',
            cor: '#34D399',
            criadoEm: '2026-11-01T14:35:00Z'
          }
        ],
        notasPagina: {
          1: [
            {
              id: 'pin_1',
              xPct: 62,
              yPct: 30,
              titulo: 'Destaque do Orientador',
              texto: 'Conferir como os autores definem o índice de consolidação viária na p. 115.',
              cor: '#F59E0B',
              autor: 'Autor Principal'
            }
          ]
        },
        tracosPorPagina: {}
      },
      conteudoPaginasPdf: [
        {
          numero: 1,
          cabecalho: 'REVISTA BRASILEIRA DE ESTUDOS URBANOS E REGIONAIS · v. 27, n. 2, p. 114–138, 2025',
          titulo: 'REGULARIZAÇÃO FUNDIÁRIA URBANA E MORFOLOGIA DE ASSENTAMENTOS CONSOLIDADOS NA AMÉRICA LATINA',
          autores: 'Milton Santos · Ana Clara Ribeiro (Universidade de São Paulo / Laboratório de Geoprocessamento)',
          paragrafos: [
            'RESUMO: Este artigo analisa os instrumentos técnicos e jurídicos de regularização fundiária urbana aplicados a núcleos urbanos informais consolidados, propondo diretrizes para integração entre levantamento de campo, cadastro multifinalitário e titulação registral.',
            '1. INTRODUÇÃO: O crescimento acelerado das cidades latino-americanas produziu tecidos urbanos heterogêneos nos quais a consolidação física precedeu a formalização cartorial. Nesse contexto, a segurança jurídica da posse depende diretamente da precisão geométrica e da rastreabilidade social do cadastro territorial.',
            'Historicamente, os projetos de urbanização enfrentaram gargalos severos na transição entre o diagnóstico socioespacial e a abertura de matrículas individualizadas. Quando os fluxos de desenho urbano e documentação jurídica operam em ferramentas desconectadas, multiplicam-se as inconsistências entre quadras, lotes e logradouros.',
            '2. REFERENCIAL METODOLÓGICO: Propomos uma arquitetura integrada em que cada unidade imobiliária mantém vínculo unívoco entre sua geometria projetada em projeção UTM (SIRGAS 2000) e os respectivos instrumentos de legitimação fundiária.'
          ]
        },
        {
          numero: 2,
          cabecalho: 'SANTOS, M.; RIBEIRO, A. C. · Regularização Fundiária Urbana e Morfologia · p. 115',
          titulo: '3. ANÁLISE ESPACIAL E CONFORMIDADE REGISTRAL',
          autores: 'Seção Experimental — Avaliação de 14 Núcleos Consolidados',
          paragrafos: [
            'Os dados empíricos coletados ao longo de 24 meses revelam que a dissociação entre a planta de parcelamento e os memoriais descritivos é a principal causa de notas devolutivas no registro de imóveis, respondendo por 58,4% dos atrasos processuais.',
            'Na Tabela 1 do estudo original, observa-se que municípios que adotaram validação topológica contínua e geração paramétrica de peças técnicas reduziram o retrabalho editorial em mais de dois terços.',
            'Além disso, o emprego de simbologia cartográfica padronizada e quadros síntese vinculados diretamente à base alfanumérica permitiu que equipes multidisciplinares (arquitetos, engenheiros, assistentes sociais e juristas) revisassem os relatórios em tempo real.'
          ]
        },
        {
          numero: 3,
          cabecalho: 'SANTOS, M.; RIBEIRO, A. C. · Regularização Fundiária Urbana e Morfologia · p. 116',
          titulo: '4. CONCLUSÕES E DIRETRIZES PARA POLÍTICAS PÚBLICAS',
          autores: 'Síntese Propositiva e Recomendações Normativas',
          paragrafos: [
            'Conclui-se que a modernização dos procedimentos de regularização fundiária exige ambientes colaborativos capazes de unir rigor tipográfico (ABNT), gestão bibliográfica estruturada e interoperabilidade com acervos em nuvem.',
            'Trabalhos futuros devem explorar a leitura compartilhada de laudos e artigos técnicos com camadas de anotação vetorial não destrutiva, preservando os arquivos originais no armazenamento em nuvem do pesquisador.'
          ]
        }
      ]
    },
    {
      id: 'zot_art_02',
      chaveZotero: 'ZOT4P9L2',
      pastaId: 'pasta_bib_raiz',
      titulo: 'Sistemas Colaborativos CRDT e Editoração Científica em Tempo Real na Web Moderna',
      autores: [
        { sobrenome: 'Kleppmann', prenome: 'Martin' },
        { sobrenome: 'Almeida', prenome: 'Lucas' }
      ],
      ano: '2024',
      publicacao: 'ACM Transactions on Computer-Human Interaction (TOCHI)',
      volume: '31',
      numero: '4',
      paginas: '1-29',
      doi: '10.1145/3612345.3612399',
      palavrasChave: ['CRDT', 'Colaboração Síncrona', 'Editoração Acadêmica', 'WebSockets'],
      driveFileId: 'drive_pdf_crdt_2024',
      driveFileName: 'Kleppmann_Almeida_2024_CRDT_Academic_Publishing.pdf',
      driveStatus: 'Sincronizado no Google Drive',
      corCapa: '#1E5641',
      totalPaginas: 2,
      resumoOriginal: 'Investigação sobre estruturas de dados livres de conflito (CRDTs) e canais de presença em tempo real aplicados à escrita acadêmica distribuída entre orientadores e pesquisadores.',
      fichamento: {
        resumoPessoal: 'Explica como combinar edição em tempo real com modos de revisão assíncrona (Sugestão com Aceitar/Rejeitar) sem perda de formatação tipográfica.',
        metodologiaNotas: 'Avaliação com 42 grupos de pesquisa universitários utilizando documentos estruturados em blocos.',
        citacoesMarcadas: [
          {
            id: 'cit_201',
            pagina: 1,
            texto: 'A combinação de presença síncrona com sugestões granulares de inserção e exclusão reduz a fricção cognitiva durante a revisão entre orientador e orientando.',
            comentario: 'Citar na seção sobre o fluxo de revisão colaborativa.',
            cor: '#60A5FA',
            criadoEm: '2026-11-01T15:10:00Z'
          }
        ],
        notasPagina: {},
        tracosPorPagina: {}
      },
      conteudoPaginasPdf: [
        {
          numero: 1,
          cabecalho: 'ACM TRANSACTIONS ON COMPUTER-HUMAN INTERACTION · Vol. 31, No. 4, Article 18 · 2024',
          titulo: 'SISTEMAS COLABORATIVOS CRDT E EDITORAÇÃO CIENTÍFICA EM TEMPO REAL NA WEB MODERNA',
          autores: 'Martin Kleppmann · Lucas Almeida',
          paragrafos: [
            'ABSTRACT: A escrita científica contemporânea é intrinsecamente colaborativa. Todavia, ferramentas tradicionais forçam pesquisadores a escolher entre controle tipográfico preciso (LaTeX/DTP) e colaboração fácil em nuvem.',
            '1. PROBLEMA DE PESQUISA: A combinação de presença síncrona com sugestões granulares de inserção e exclusão reduz a fricção cognitiva durante a revisão entre orientador e orientando, mantendo o histórico decisório transparente.',
            '2. ARQUITETURA EM BLOCOS: Quando o documento é modelado como uma sequência de seções mestras e blocos semânticos (títulos, parágrafos, figuras compostas, tabelas ABNT e equações), a resolução de conflitos torna-se determinística.'
          ]
        },
        {
          numero: 2,
          cabecalho: 'KLEPPMANN, M.; ALMEIDA, L. · Sistemas Colaborativos CRDT · p. 2',
          titulo: '3. INTEGRAÇÃO COM BIBLIOTECAS DE REFERÊNCIAS E ANOTAÇÃO DE PDF',
          autores: 'Fluxo de Leitura Ativa e Fichamento',
          paragrafos: [
            'Observamos que 78% dos pesquisadores realizam a leitura e o grifo de artigos em PDF separadamente do ambiente de redação, perdendo o vínculo entre os trechos riscados no PDF e as citações inseridas no manuscrito.',
            'A unificação do estúdio de leitura de PDF (com tinta digital estilo tablet e armazenamento direto no Drive pessoal do autor) ao gerenciador Zotero elimina a duplicação de arquivos pesados e preserva todas as marcações na nuvem.'
          ]
        }
      ]
    },
    {
      id: 'zot_art_03',
      chaveZotero: 'ZOT9R3X7',
      pastaId: 'pasta_bib_raiz',
      titulo: 'Diretrizes de Desenho Universal e Infraestrutura Verde em Projetos de Reurbanização',
      autores: [
        { sobrenome: 'Gehl', prenome: 'Jan' },
        { sobrenome: 'Ferreira', prenome: 'Mariana' }
      ],
      ano: '2026',
      publicacao: 'Cadernos de Arquitetura e Urbanismo Contemporâneo',
      volume: '19',
      numero: '1',
      paginas: '45-72',
      doi: '10.1590/cauc.2026.190145',
      palavrasChave: ['Infraestrutura Verde', 'Desenho Urbano', 'Acessibilidade', 'Drenagem Sustentável'],
      driveFileId: 'drive_pdf_gehl_2026',
      driveFileName: 'Gehl_Ferreira_2026_Infraestrutura_Verde.pdf',
      driveStatus: 'Sincronizado no Google Drive',
      corCapa: '#5B3E7A',
      totalPaginas: 2,
      resumoOriginal: 'Proposição de parâmetros projetuais para calçadas acessíveis, jardins de chuva e arborização viária em projetos integrados de reurbanização.',
      fichamento: {
        resumoPessoal: 'Ótima referência para os quadros de parâmetros urbanísticos e diretrizes de desenho viário.',
        metodologiaNotas: 'Parâmetros dimensionais mínimos para calçadas e faixas permeáveis.',
        citacoesMarcadas: [],
        notasPagina: {},
        tracosPorPagina: {}
      },
      conteudoPaginasPdf: [
        {
          numero: 1,
          cabecalho: 'CADERNOS DE ARQUITETURA E URBANISMO CONTEMPORÂNEO · v. 19, n. 1, p. 45–72, 2026',
          titulo: 'DIRETRIZES DE DESENHO UNIVERSAL E INFRAESTRUTURA VERDE EM PROJETOS DE REURBANIZAÇÃO',
          autores: 'Jan Gehl · Mariana Ferreira',
          paragrafos: [
            'RESUMO: A qualificação do espaço público em áreas de reurbanização requer a articulação entre microdrenagem urbana sustentável, caminhabilidade e sombreamento arbóreo.',
            '1. PARÂMETROS PROJETUAIS: A adoção de jardins de chuva e pavimentos permeáveis nas faixas de serviço reduz o pico de escoamento superficial em até 42% em eventos de precipitação intensa.'
          ]
        },
        {
          numero: 2,
          cabecalho: 'GEHL, J.; FERREIRA, M. · Infraestrutura Verde em Reurbanização · p. 46',
          titulo: '2. MATRIZ DE INDICADORES DE QUALIDADE CAMINHÁVEL',
          autores: 'Aplicação em Projetos Executivos',
          paragrafos: [
            'Os resultados demonstram que a continuidade das faixas livres de passeio (mínimo de 1,50 m livre de obstáculos) associada à iluminação em escala de pedestre eleva significativamente a vitalidade urbana noturna.'
          ]
        }
      ]
    }
  ];
}

export let _timerDebounceSalvarArtigos = null;
let _pendenteDebounce = null;
let _artigoAbertoAtivo = null;

export function definirArtigoAbertoAtivo(art) {
  _artigoAbertoAtivo = art || null;
}

export const PDFJS_VERSAO = '4.10.38';
export let _pdfjsPromise = null;
/** Carrega o pdf.js (renderizador oficial de PDF da Mozilla) sob demanda. */
export function carregarPdfJs() {
  if (!_pdfjsPromise) {
    const base = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSAO}/build`;
    _pdfjsPromise = import(`${base}/pdf.min.mjs`).then(m => {
      m.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
      return m;
    }).catch(err => { _pdfjsPromise = null; throw err; });
  }
  return _pdfjsPromise;
}

/* ==========================================================================
   PDFs e Snapshot Local em IndexedDB + Google Drive
   ========================================================================== */
export const IDB_NOME = 'athenes_pdfs_v1';
export const IDB_STORE = 'pdfs';
export const PASTA_PDFS_DRIVE = 'Bibliografia_PDFs';
const CHAVE_SNAPSHOT_IDB = '__athenes_estudo_snapshot_v1__';

export function abrirIdbPdfs() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(IDB_NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function obterPdfLocal(artId) {
  try {
    const db = await abrirIdbPdfs();
    return await new Promise((res, rej) => {
      const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(String(artId));
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (_) {
    return null;
  }
}

export async function salvarPdfLocal(artId, blob) {
  if (!artId || !blob) return false;
  try {
    const db = await abrirIdbPdfs();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, String(artId));
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function removerPdfLocal(artId) {
  try {
    const db = await abrirIdbPdfs();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(String(artId));
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (_) {}
}

function mapaTemItens(m) {
  return Boolean(m && typeof m === 'object' && Object.values(m).some(arr => Array.isArray(arr) && arr.length > 0));
}

export function fichamentoPossuiConteudo(f) {
  if (!f || typeof f !== 'object') return false;
  if (String(f.resumoPessoal || '').trim() || String(f.metodologiaNotas || '').trim()) return true;
  if (Array.isArray(f.citacoesMarcadas) && f.citacoesMarcadas.length > 0) return true;
  if (mapaTemItens(f.tracosPorPagina) || mapaTemItens(f.notasPagina) || mapaTemItens(f.grifosPorPagina)) return true;
  return false;
}

/**
 * Mescla o fichamento e os vínculos de `artFonte` em `artAlvo` sem perder traços de caneta, citações, notas ou grifos.
 */
export function mesclarFichamentoPreservandoDados(artAlvo, artFonte) {
  if (!artAlvo || !artFonte || artAlvo === artFonte) return artAlvo;
  if ((!artAlvo.driveFileId || /^drive_pdf_/.test(String(artAlvo.driveFileId))) && artFonte.driveFileId && !/^drive_pdf_/.test(String(artFonte.driveFileId))) {
    artAlvo.driveFileId = artFonte.driveFileId;
    if (artFonte.driveFileName) artAlvo.driveFileName = artFonte.driveFileName;
    if (artFonte.driveStatus) artAlvo.driveStatus = artFonte.driveStatus;
  }
  if (!artAlvo.notaZoteroKey && artFonte.notaZoteroKey) artAlvo.notaZoteroKey = artFonte.notaZoteroKey;
  if (artFonte.docCompartilhadoId) artAlvo.docCompartilhadoId = artFonte.docCompartilhadoId;
  if (artFonte.compartilhamento) artAlvo.compartilhamento = artFonte.compartilhamento;
  if (artFonte.compartilhadoComigo !== undefined) artAlvo.compartilhadoComigo = Boolean(artFonte.compartilhadoComigo);
  if (artFonte.proprietarioExterno !== undefined) artAlvo.proprietarioExterno = Boolean(artFonte.proprietarioExterno);
  if (artFonte.permissao) artAlvo.permissao = artFonte.permissao;
  if (artFonte.proprietario) artAlvo.proprietario = { ...(artAlvo.proprietario || {}), ...artFonte.proprietario };
  if (artFonte.salvoNuvem !== undefined) artAlvo.salvoNuvem = Boolean(artFonte.salvoNuvem);
  if ((!artAlvo.totalPaginas || artAlvo.totalPaginas <= 1) && artFonte.totalPaginas > 1) artAlvo.totalPaginas = artFonte.totalPaginas;
  if ((!Array.isArray(artAlvo.conteudoPaginasPdf) || !artAlvo.conteudoPaginasPdf.length) && Array.isArray(artFonte.conteudoPaginasPdf) && artFonte.conteudoPaginasPdf.length) {
    artAlvo.conteudoPaginasPdf = artFonte.conteudoPaginasPdf;
  }

  const fAlvo = artAlvo.fichamento || (artAlvo.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {}, grifosPorPagina: {} });
  const fFonte = artFonte.fichamento;
  if (!fFonte || typeof fFonte !== 'object') return artAlvo;

  const fonteMaisNova = (fFonte.atualizadoEm || '') > (fAlvo.atualizadoEm || '');
  if ((!fAlvo.resumoPessoal || fonteMaisNova) && fFonte.resumoPessoal) fAlvo.resumoPessoal = fFonte.resumoPessoal;
  if ((!fAlvo.metodologiaNotas || fonteMaisNova) && fFonte.metodologiaNotas) fAlvo.metodologiaNotas = fFonte.metodologiaNotas;

  if (Array.isArray(fFonte.citacoesMarcadas) && fFonte.citacoesMarcadas.length > 0) {
    if (!Array.isArray(fAlvo.citacoesMarcadas) || fAlvo.citacoesMarcadas.length === 0) {
      fAlvo.citacoesMarcadas = [...fFonte.citacoesMarcadas];
    } else if (fonteMaisNova) {
      fAlvo.citacoesMarcadas = [...fFonte.citacoesMarcadas];
    } else {
      const ids = new Set(fAlvo.citacoesMarcadas.map(c => c?.id));
      for (const c of fFonte.citacoesMarcadas) {
        if (c?.id && !ids.has(c.id)) { fAlvo.citacoesMarcadas.push(c); ids.add(c.id); }
      }
    }
  }

  for (const campo of ['tracosPorPagina', 'notasPagina', 'grifosPorPagina']) {
    if (!fAlvo[campo] || typeof fAlvo[campo] !== 'object') fAlvo[campo] = {};
    const mFonte = fFonte[campo];
    if (!mFonte || typeof mFonte !== 'object') continue;
    if (!mapaTemItens(fAlvo[campo]) && mapaTemItens(mFonte)) {
      fAlvo[campo] = JSON.parse(JSON.stringify(mFonte));
    } else if (fonteMaisNova && (mapaTemItens(mFonte) || fFonte.atualizadoEm)) {
      fAlvo[campo] = JSON.parse(JSON.stringify(mFonte));
    } else {
      for (const [pg, arr] of Object.entries(mFonte)) {
        if (!Array.isArray(arr) || !arr.length) continue;
        if (!Array.isArray(fAlvo[campo][pg]) || fAlvo[campo][pg].length === 0) {
          fAlvo[campo][pg] = JSON.parse(JSON.stringify(arr));
        }
      }
    }
  }

  if (fonteMaisNova && fFonte.atualizadoEm) fAlvo.atualizadoEm = fFonte.atualizadoEm;
  return artAlvo;
}

export async function guardarSnapshotArtigosIdb(lista) {
  if (!Array.isArray(lista) || typeof indexedDB === 'undefined') return false;
  try {
    const db = await abrirIdbPdfs();
    const existente = await new Promise((res) => {
      const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(CHAVE_SNAPSHOT_IDB);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
    const porChave = { ...(existente?.porChave || {}) };
    const artigosLimpos = [];
    for (const a of lista) {
      if (!a?.id || ehArtigoExemploFicticio(a)) continue;
      const copia = { ...a };
      delete copia.pdfBlobUrl;
      delete copia.pdfBlob;
      delete copia.temPdfLocal;
      artigosLimpos.push(copia);
      const dadosPreservar = {
        id: a.id,
        chaveZotero: a.chaveZotero || '',
        atualizadoEm: a.atualizadoEm || '',
        driveFileId: a.driveFileId || '',
        driveFileName: a.driveFileName || '',
        driveStatus: a.driveStatus || '',
        notaZoteroKey: a.notaZoteroKey || '',
        docCompartilhadoId: a.docCompartilhadoId || '',
        compartilhamento: a.compartilhamento || null,
        totalPaginas: a.totalPaginas || 1,
        conteudoPaginasPdf: Array.isArray(a.conteudoPaginasPdf) ? a.conteudoPaginasPdf : [],
        fichamento: a.fichamento ? JSON.parse(JSON.stringify(a.fichamento)) : null
      };
      porChave[String(a.id)] = dadosPreservar;
      if (a.chaveZotero) porChave[`zot:${a.chaveZotero}`] = dadosPreservar;
    }
    const payload = {
      atualizadoEm: new Date().toISOString(),
      artigos: artigosLimpos,
      porChave
    };
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(payload, CHAVE_SNAPSHOT_IDB);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function lerSnapshotArtigosIdb() {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await abrirIdbPdfs();
    return await new Promise((res) => {
      const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(CHAVE_SNAPSHOT_IDB);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch (_) {
    return null;
  }
}

/** Envia o PDF do artigo à pasta "Bibliografia_PDFs" do Drive (dentro da raiz Athenes) e guarda o id. Devolve true se subiu. */
export async function enviarPdfDoArtigoAoDrive(art, blob) {
  if (!await blobEhPdf(blob)) throw new Error('O arquivo não é um PDF válido.');
  const token = await obterTokenDrive();
  if (!token) return false;
  const pastaId = await obterOuCriarPastaDoArtigoNoDrive(art?.pastaId, token);
  const idAtual = String(art.driveFileId || '').trim();
  const salvo = await salvarArquivoNoGoogleDrive({
    nomeArquivo: art.driveFileName || blob.name || `${art.id}.pdf`, conteudoBlobOuTexto: blob, mimeType: 'application/pdf', accessToken: token,
    driveFileId: idAtual && !art.pdfVerificadoInvalido && !/^drive_pdf_/.test(idAtual) ? idAtual : null, pastaId
  });
  if (idAtual && !art.pdfVerificadoInvalido && !/^drive_pdf_/.test(idAtual) && pastaId) {
    await moverArquivoNoDrive(idAtual, pastaId, token).catch(() => {});
  }
  art.driveFileId = salvo.id;
  art.driveFolderId = pastaId;
  art.pdfVerificadoInvalido = false;
  art.driveStatus = 'PDF no Google Drive';
  salvarArtigosEstudo(carregarArtigosEstudo(), art); // o id do arquivo vai para o servidor

  // Se o artigo já está compartilhado, aplica o compartilhamento no arquivo do Drive imediatamente
  if (art.docCompartilhadoId || art.compartilhamento) {
    const arrPessoas = Object.entries(art.compartilhamento?.pessoas || {}).map(([email, papel]) => ({ email, papel }));
    compartilharPdfNoDrive(salvo.id, { pessoas: arrPessoas, publico: true }, token).catch(() => {});
  }
  return true;
}

/** Registra um arquivo PDF escolhido no computador: abre na sessão, guarda no cache local (IndexedDB) e sobe para o Drive. */
export async function registrarPdfLocalNoArtigo(art, file) {
  if (!await blobEhPdf(file)) {
    mostrarAviso('O arquivo selecionado não é um PDF válido.', { tipo: 'aviso' });
    return false;
  }
  if (art.pdfVerificadoInvalido) art.driveFileId = '';
  art.pdfVerificadoInvalido = false;
  art.driveFileName = file.name;
  art.driveStatus = 'Enviando o PDF ao Google Drive…';
  art.pdfBlobUrl = URL.createObjectURL(file);
  art.temPdfLocal = true;
  salvarPdfLocal(art.id, file).catch(() => {});
  if (art.chaveZotero) salvarPdfLocal(`zot_${art.chaveZotero}`, file).catch(() => {});
  enviarPdfDoArtigoAoDrive(art, file).then(ok => {
    if (!ok) {
      art.driveStatus = 'PDF salvo neste dispositivo (Drive desconectado)';
      salvarArtigosEstudo(carregarArtigosEstudo(), art);
    }
  }).catch(e => {
    art.driveStatus = 'PDF salvo neste dispositivo (falha ao enviar ao Drive)';
    salvarArtigosEstudo(carregarArtigosEstudo(), art);
    mostrarAviso(`Não foi possível enviar o PDF ao Google Drive (mantido neste aparelho): ${e.message}`, { tipo: 'info' });
  });
  return true;
}

export async function baixarPdfBlobDoDrive(fileId, accessToken) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error(`Drive respondeu ${resp.status}`);
  return await resp.blob();
}

/**
 * Concede permissão de leitura/edição no arquivo PDF do Google Drive para as pessoas convidadas ou link público.
 */
export async function compartilharPdfNoDrive(fileId, { pessoas = [], publico = false, papel = 'leitor' } = {}, accessToken = null) {
  const idLimpo = String(fileId || '').trim();
  if (!idLimpo || /^drive_pdf_/.test(idLimpo)) return false;
  const token = accessToken || await obterTokenDrive();
  if (!token) return false;
  const urlPerm = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(idLimpo)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let okAlgum = false;

  // Garante permissão pública de leitura no arquivo para que qualquer pessoa com o link de colaboração consiga ler o PDF
  try {
    const rPublico = await fetch(urlPerm, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'anyone', role: 'reader' })
    });
    if (rPublico.ok) okAlgum = true;
  } catch (_) {}

  for (const p of (Array.isArray(pessoas) ? pessoas : [])) {
    const email = String(p?.email || '').trim();
    if (!email) continue;
    const role = (p?.papel || papel) === 'editor' ? 'writer' : 'reader';
    try {
      const r = await fetch(urlPerm, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'user', role, emailAddress: email })
      });
      if (r.ok) okAlgum = true;
    } catch (_) {}
  }
  return okAlgum;
}

/**
 * Garante que o artigo tenha um PDF real para exibir: primeiro em memória, depois no cache IndexedDB local e no Google Drive.
 */
export async function obterPdfComoDataUrl(artId) {
  try {
    const local = await obterPdfLocal(artId);
    if (!local) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(local);
    });
  } catch (_) {
    return null;
  }
}

async function buscarPdfPublicoParaArtigo(art, forcar = false) {
  if (art.compartilhadoComigo || art.proprietarioExterno || (!forcar && buscasPdfPublico.has(art))) return false;
  const doi = normalizarDoi(art.doi || art.camposZotero?.DOI);
  const isbn = normalizarIsbn(art.isbn || art.camposZotero?.ISBN);
  if (!doi && !isbn) return false;
  buscasPdfPublico.add(art);
  for (const [tipo, valor] of [['doi', doi], ['isbn', isbn]]) {
    if (!valor) continue;
    try {
      const resposta = await fetch(`/api/pdf-aberto?${tipo}=${encodeURIComponent(valor)}`);
      if (!resposta.ok) continue;
      const blob = await resposta.blob();
      if (!await blobEhPdf(blob)) continue;
      const arquivo = new File([blob], `${String(art.titulo || 'Artigo').replace(/[\\/:*?"<>|]/g, '').slice(0, 90)}.pdf`, { type: 'application/pdf' });
      art.pdfBlobUrl = URL.createObjectURL(arquivo);
      art.temPdfLocal = true;
      if (art.pdfVerificadoInvalido) art.driveFileId = '';
      art.pdfVerificadoInvalido = false;
      art.driveFileName = arquivo.name;
      art.driveStatus = 'PDF público encontrado; enviando ao Google Drive…';
      await salvarPdfLocal(art.id, arquivo);
      if (art.chaveZotero) await salvarPdfLocal(`zot_${art.chaveZotero}`, arquivo);
      try {
        const enviado = await enviarPdfDoArtigoAoDrive(art, arquivo);
        if (!enviado) art.driveStatus = 'PDF salvo neste dispositivo (Drive desconectado)';
      } catch (e) {
        art.driveStatus = 'PDF salvo neste dispositivo (falha ao enviar ao Drive)';
        console.warn('[Athenes] PDF público no Drive:', e.message);
      }
      salvarArtigosEstudo(carregarArtigosEstudo(), art);
      return true;
    } catch (e) { console.warn('[Athenes] Busca de PDF público:', e.message); }
  }
  return false;
}

export async function garantirPdfDoArtigo(art, { forcarBuscaIdentificadores = false } = {}) {
  if (!art) return false;
  if (art.pdfBlobUrl) return true;
  if (art.pdfDataUrl) {
    try {
      const r = await fetch(art.pdfDataUrl);
      const blob = await r.blob();
      if (!await blobEhPdf(blob)) {
        art.pdfVerificadoInvalido = true;
        salvarArtigosEstudo(carregarArtigosEstudo(), art);
        throw new Error('O conteúdo salvo não é um PDF.');
      }
      art.pdfVerificadoInvalido = false;
      art.pdfBlobUrl = URL.createObjectURL(blob);
      art.temPdfLocal = true;
      salvarPdfLocal(art.id, blob).catch(() => {});
      return true;
    } catch (_) {}
  }
  try {
    let local = await obterPdfLocal(art.id);
    if (!local && art.chaveZotero) {
      local = await obterPdfLocal(`zot_${art.chaveZotero}`) || await obterPdfLocal(art.chaveZotero);
    }
    if (local && await blobEhPdf(local)) {
      art.pdfBlobUrl = URL.createObjectURL(local);
      art.temPdfLocal = true;
      const idDrive = String(art.driveFileId || '').trim();
      if (!idDrive || /^drive_pdf_/.test(idDrive)) {
        enviarPdfDoArtigoAoDrive(art, local).catch(() => {});
      }
      return true;
    }
  } catch (_) {}

  // Se o documento foi compartilhado via nuvem, tenta buscar a versão remota com o PDF embutido
  if (art.docCompartilhadoId || art.compartilhadoComigo) {
    const idDocRemoto = art.docCompartilhadoId || art.id;
    try {
      const remoto = await carregarDocumentoCompartilhado(idDocRemoto);
      const artRemoto = remoto?.doc?.artigoEstudo || remoto?.doc;
      if (artRemoto?.pdfDataUrl) {
        art.pdfDataUrl = artRemoto.pdfDataUrl;
        const r = await fetch(art.pdfDataUrl);
        const blob = await r.blob();
        if (!await blobEhPdf(blob)) throw new Error('O conteúdo compartilhado não é um PDF.');
        art.pdfBlobUrl = URL.createObjectURL(blob);
        art.temPdfLocal = true;
        salvarPdfLocal(art.id, blob).catch(() => {});
        return true;
      }
    } catch (_) {}
  }
  const idDrive = String(art.driveFileId || '').trim();
  if (idDrive && !/^drive_pdf_/.test(idDrive)) {
    const tokenDrive = await obterTokenDrive();
    if (tokenDrive) {
      try {
        const blob = await baixarPdfBlobDoDrive(idDrive, tokenDrive);
        if (!await blobEhPdf(blob)) {
          art.pdfVerificadoInvalido = true;
          art.driveStatus = 'Arquivo vinculado não é PDF';
          salvarArtigosEstudo(carregarArtigosEstudo(), art);
          throw new Error('O arquivo no Drive não é PDF.');
        }
        art.pdfVerificadoInvalido = false;
        art.pdfBlobUrl = URL.createObjectURL(blob);
        art.temPdfLocal = true;
        salvarPdfLocal(art.id, blob).catch(() => {});
        return true;
      } catch (_) {}
    }
    // Fallback: download direto do Google Drive caso o arquivo tenha permissão pública
    try {
      const respPub = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(idDrive)}`);
      if (respPub.ok) {
        const blob = await respPub.blob();
        if (await blobEhPdf(blob)) {
          art.pdfVerificadoInvalido = false;
          art.pdfBlobUrl = URL.createObjectURL(blob);
          art.temPdfLocal = true;
          salvarPdfLocal(art.id, blob).catch(() => {});
          return true;
        }
      }
    } catch (_) {}
  }
  return buscarPdfPublicoParaArtigo(art, forcarBuscaIdentificadores);
}

/**
 * Garante que os PDFs locais estejam sincronizados no Google Drive.
 */
export async function migrarPdfsLocaisParaODrive() {
  const token = await obterTokenDrive();
  if (!token) return 0;
  let movidos = 0;
  for (const art of carregarArtigosEstudo()) {
    try {
      const local = await obterPdfLocal(art.id);
      if (!local) continue;
      const idDrive = String(art.driveFileId || '').trim();
      let noDrive = false;
      if (idDrive && !/^drive_pdf_/.test(idDrive)) {
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(idDrive)}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } });
        noDrive = r.ok && !(await r.json()).trashed;
      }
      if (!noDrive) noDrive = await enviarPdfDoArtigoAoDrive(art, local);
      if (noDrive) movidos++;
    } catch (_) {}
  }
  return movidos;
}

/** Biblioteca da sessão (memória), sincronizada com o servidor; nada é lido nem gravado no localStorage. */
export function carregarArtigosEstudo() {
  bib.definirFiltroDeExemplos(ehArtigoExemploFicticio);
  return bib.obterArtigos();
}

function sincronizarArtigoNaLista(lista, artAlvo, carimbarAgora = false) {
  if (!artAlvo?.id || !Array.isArray(lista)) return;
  if (carimbarAgora) {
    const agora = new Date().toISOString();
    artAlvo.atualizadoEm = agora;
    if (!artAlvo.fichamento || typeof artAlvo.fichamento !== 'object') {
      artAlvo.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {}, grifosPorPagina: {} };
    }
    artAlvo.fichamento.atualizadoEm = agora;
  }
  const idx = lista.findIndex(x => x && (String(x.id) === String(artAlvo.id) || (artAlvo.chaveZotero && x.chaveZotero === artAlvo.chaveZotero)));
  if (idx >= 0) {
    if (lista[idx] !== artAlvo) {
      Object.assign(lista[idx], artAlvo);
    }
  } else if (!ehArtigoExemploFicticio(artAlvo)) {
    lista.unshift(artAlvo);
  }
}

export function salvarArtigosEstudo(lista, artModificado = null) {
  if (_timerDebounceSalvarArtigos) {
    clearTimeout(_timerDebounceSalvarArtigos);
    _timerDebounceSalvarArtigos = null;
  }
  _pendenteDebounce = null;
  const arr = Array.isArray(lista) ? lista : carregarArtigosEstudo();
  const alvo = artModificado || _artigoAbertoAtivo;
  if (alvo) {
    sincronizarArtigoNaLista(arr, alvo, Boolean(artModificado));
  }
  const memBib = bib.obterArtigos();
  if (alvo && memBib !== arr) {
    sincronizarArtigoNaLista(memBib, alvo, false);
  }
  bib.definirArtigos(arr); // memória + envio ao servidor
  guardarSnapshotArtigosIdb(bib.obterArtigos()).catch(() => {});
  return arr;
}

export function salvarArtigosEstudoDebounced(lista, delayMs = 320, artModificado = null) {
  const alvo = artModificado || _artigoAbertoAtivo;
  if (alvo) {
    const agora = new Date().toISOString();
    alvo.atualizadoEm = agora;
    if (alvo.fichamento && typeof alvo.fichamento === 'object') {
      alvo.fichamento.atualizadoEm = agora;
    }
  }
  _pendenteDebounce = { lista, artModificado: alvo };
  if (_timerDebounceSalvarArtigos) clearTimeout(_timerDebounceSalvarArtigos);
  _timerDebounceSalvarArtigos = setTimeout(() => {
    const p = _pendenteDebounce;
    _timerDebounceSalvarArtigos = null;
    _pendenteDebounce = null;
    if (p) salvarArtigosEstudo(p.lista, p.artModificado);
  }, delayMs);
}

export function descarregarSalvarArtigosDebounced() {
  if (_timerDebounceSalvarArtigos) {
    clearTimeout(_timerDebounceSalvarArtigos);
    _timerDebounceSalvarArtigos = null;
  }
  if (_pendenteDebounce) {
    const p = _pendenteDebounce;
    _pendenteDebounce = null;
    salvarArtigosEstudo(p.lista, p.artModificado);
  } else if (_artigoAbertoAtivo) {
    salvarArtigosEstudo(carregarArtigosEstudo(), _artigoAbertoAtivo);
  }
}

export function formatarCitacaoAbntDoArtigo(artigo, pagina = null) {
  const sobrenome = (artigo?.autores?.[0]?.sobrenome || 'AUTOR').toUpperCase();
  const maisAutores = (artigo?.autores?.length || 0) > 2
    ? ' et al.'
    : (artigo?.autores?.length === 2 ? `; ${(artigo.autores[1].sobrenome || '').toUpperCase()}` : '');
  const ano = artigo?.ano || 's.d.';
  const pagTxt = pagina ? `, p. ${pagina}` : '';
  return `(${sobrenome}${maisAutores}, ${ano}${pagTxt})`;
}

export function gerarHtmlNotaZoteroDoArtigo(artigo) {
  const f = artigo?.fichamento || {};
  const citacoes = Array.isArray(f.citacoesMarcadas) ? f.citacoesMarcadas : [];
  const notasPag = f.notasPagina || {};
  const tracosPag = f.tracosPorPagina || {};
  const grifosPag = f.grifosPorPagina || {};
  const todosPins = [];
  Object.keys(notasPag).forEach(pg => {
    (notasPag[pg] || []).forEach(pin => {
      todosPins.push({ pagina: pg, ...pin });
    });
  });
  const paginasComTracos = Object.keys(tracosPag).filter(pg => Array.isArray(tracosPag[pg]) && tracosPag[pg].length > 0);
  const totalTracos = paginasComTracos.reduce((acc, pg) => acc + tracosPag[pg].length, 0);
  const paginasComGrifos = Object.keys(grifosPag).filter(pg => Array.isArray(grifosPag[pg]) && grifosPag[pg].length > 0);
  const totalGrifos = paginasComGrifos.reduce((acc, pg) => acc + grifosPag[pg].length, 0);

  const b64Meta = codificarMetadadosNotaZotero({
    v: 1,
    id: artigo?.id || '',
    chaveZotero: artigo?.chaveZotero || '',
    driveFileId: artigo?.driveFileId || '',
    driveFileName: artigo?.driveFileName || '',
    docCompartilhadoId: artigo?.docCompartilhadoId || '',
    fichamento: {
      atualizadoEm: f.atualizadoEm || new Date().toISOString(),
      resumoPessoal: f.resumoPessoal || '',
      metodologiaNotas: f.metodologiaNotas || '',
      citacoesMarcadas: citacoes,
      notasPagina: notasPag,
      tracosPorPagina: tracosPag,
      grifosPorPagina: grifosPag
    }
  });

  return [
    `<h2>Fichamento Athenes — ${escapeHtml(artigo?.titulo || 'Artigo')}</h2>`,
    `<p><strong>Vínculo PDF no Google Drive:</strong> ${escapeHtml(artigo?.driveFileName || 'Não vinculado')} (ID: <code>${escapeHtml(artigo?.driveFileId || 'local')}</code>)</p>`,
    f.resumoPessoal ? `<h3>Resumo & Síntese</h3><p>${escapeHtml(f.resumoPessoal)}</p>` : '',
    f.metodologiaNotas ? `<h3>Notas de Metodologia & Reflexões</h3><p>${escapeHtml(f.metodologiaNotas)}</p>` : '',
    citacoes.length > 0
      ? `<h3>Citações Marcadas no PDF (${citacoes.length})</h3><ul>` +
        citacoes.map(c => `<li><blockquote>"${escapeHtml(c.texto)}" ${escapeHtml(formatarCitacaoAbntDoArtigo(artigo, c.paginaCitacao || c.pagina))}</blockquote>${c.comentario ? `<p><em>Nota:</em> ${escapeHtml(c.comentario)}</p>` : ''}</li>`).join('') +
        `</ul>`
      : '',
    todosPins.length > 0
      ? `<h3>Marcações e Notificações nas Páginas (${todosPins.length})</h3><ul>` +
        todosPins.map(p => `<li><strong>[p. ${escapeHtml(p.pagina)} — ${escapeHtml(p.titulo || 'Nota')}]:</strong> ${escapeHtml(p.texto)}</li>`).join('') +
        `</ul>`
      : '',
    (totalTracos > 0 || totalGrifos > 0)
      ? `<p><em>Camada de tinta e destaques salva no Athenes: ${totalTracos} traço(s) em ${paginasComTracos.length} página(s), ${totalGrifos} grifo(s) em ${paginasComGrifos.length} página(s).</em></p>`
      : '',
    b64Meta ? `<!--ATHENES_FICHAMENTO_B64:${b64Meta}-->` : ''
  ].filter(Boolean).join('\n');
}

/**
 * Calcula o ponto final de uma linha reta com trava suave (snap) horizontal/vertical (0° ou 90°)
 */
export function calcularPontoFinalLinhaReta(p0, p1, toleranciaGraus = 6) {
  if (!p0 || !p1) return p1;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return { x: p1.x, y: p1.y };

  const anguloGraus = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
  if (anguloGraus <= toleranciaGraus || anguloGraus >= (180 - toleranciaGraus)) {
    return { x: p1.x, y: p0.y }; // Trava perfeitamente na horizontal
  }
  if (Math.abs(anguloGraus - 90) <= toleranciaGraus) {
    return { x: p0.x, y: p1.y }; // Trava perfeitamente na vertical
  }
  return { x: p1.x, y: p1.y };
}
