// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Leitura, Risco em PDF (estilo Samsung Notes) e Fichamento Síncrono (Zotero + Google Drive).
 *
 * Recursos principais:
 * 1. Tela Cheia em 3 Colunas (.rm-conteudo / .rm-ed-grade) idêntica ao Editor de Escrita:
 *    - Coluna Esquerda 50/50 (.rm-card-meio-a-meio): Artigos do Zotero na metade superior + Páginas do PDF na metade inferior.
 *    - Coluna Central: Todas as páginas do PDF empilhadas em rolagem contínua (.rm-prev-palco) com barra flutuante (.rm-barra-blocos).
 *    - Coluna Direita: Inspetor em altura total (Resumo & Notas, Citações & Destaques, Zotero & Drive).
 * 2. Desenho Livre + Modo Linha Reta (estilo Samsung Notes):
 *    - Caneta e Marca-Texto operam à mão livre ou em Modo Linha Reta (botão "Linha Reta" na barra ou tecla Shift, com trava ortogonal 0°/90°).
 * 3. Notas Adesivas Editáveis na Folha (sem window.prompt):
 *    - Card flutuante Soft UI diretamente sobre a página do PDF; clicar em qualquer nota abre a edição de título, texto, cor e posição.
 * 4. Seleção de Texto Interativa:
 *    - Ao selecionar qualquer trecho do PDF, surge uma pílula flutuante sobre a seleção para Grifar Texto (<mark>),
 *      Salvar Citação no Zotero (p. X), Criar Nota Adesiva ou Copiar em formato ABNT.
 */

import { ZoteroClient } from '../core/athenes_zotero.js';
import {
  obterPerfilColaborador,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive,
  autenticarGoogleDrive,
  salvarArquivoNoGoogleDrive,
  listarPdfsDoGoogleDrive,
  salvarDocumentoNoSupabase
} from '../core/athenes_colaboracao.js';
import { escapeHtml, sanitizarHtmlEditorial } from '../core/athenes_seguranca.js';
import { svgIcone, svgLogo } from './athenes_icones.js';

const STORAGE_KEY_ARTIGOS = 'athenes_estudo_artigos_v1';
const IDS_ARTIGOS_EXEMPLO = new Set(['zot_art_01', 'zot_art_02', 'zot_art_03']);
const CHAVES_ZOTERO_EXEMPLO = new Set(['ZOT8K2M9', 'ZOT4P9L2', 'ZOT9R3X7']);

export function ehArtigoExemploFicticio(art) {
  if (!art) return false;
  return IDS_ARTIGOS_EXEMPLO.has(art.id) || CHAVES_ZOTERO_EXEMPLO.has(art.chaveZotero) || CHAVES_ZOTERO_EXEMPLO.has(art.chave);
}

export function criarArtigosEstudoExemplo() {
  return [
    {
      id: 'zot_art_01',
      chaveZotero: 'ZOT8K2M9',
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

let _timerDebounceSalvarArtigos = null;

const PDFJS_VERSAO = '4.10.38';
let _pdfjsPromise = null;
/** Carrega o pdf.js (renderizador oficial de PDF da Mozilla) sob demanda. */
function carregarPdfJs() {
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
   PDFs LOCAIS PERSISTENTES (IndexedDB) + DOWNLOAD DO GOOGLE DRIVE
   O PDF nunca vai para o Zotero: fica no computador (IndexedDB) ou no Drive.
   ========================================================================== */
const IDB_NOME = 'athenes_pdfs_v1';
const IDB_STORE = 'pdfs';

function abrirIdbPdfs() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(IDB_NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function salvarPdfLocal(artId, blob) {
  try {
    const db = await abrirIdbPdfs();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, String(artId));
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (_) {}
}

async function obterPdfLocal(artId) {
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

/** Registra um arquivo PDF escolhido no computador: gera URL e guarda para reabrir depois. */
function registrarPdfLocalNoArtigo(art, file) {
  art.driveFileName = file.name;
  art.driveStatus = 'PDF local / Google Drive vinculado';
  art.pdfBlobUrl = URL.createObjectURL(file);
  art.temPdfLocal = true;
  salvarPdfLocal(art.id, file);
}

async function baixarPdfBlobDoDrive(fileId, accessToken) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error(`Drive respondeu ${resp.status}`);
  return await resp.blob();
}

/**
 * Garante que o artigo tenha um PDF real para exibir: usa o que já está em memória,
 * depois o salvo no IndexedDB, depois baixa do Google Drive (se conectado).
 * Retorna true quando conseguiu um PDF novo.
 */
async function garantirPdfDoArtigo(art) {
  if (!art || art.pdfBlobUrl) return false;
  const local = await obterPdfLocal(art.id);
  if (local) {
    art.pdfBlobUrl = URL.createObjectURL(local);
    return true;
  }
  const idDrive = String(art.driveFileId || '').trim();
  if (idDrive && !/^drive_pdf_/.test(idDrive)) {
    const cfg = obterConfigGoogleDrive();
    if (cfg.accessToken) {
      try {
        const blob = await baixarPdfBlobDoDrive(idDrive, cfg.accessToken);
        salvarPdfLocal(art.id, blob);
        art.pdfBlobUrl = URL.createObjectURL(blob);
        return true;
      } catch (_) {}
    }
  }
  return false;
}

export function carregarArtigosEstudo() {
  try {
    if (typeof localStorage !== 'undefined') {
      let temChaveZotero = false;
      try {
        const zCfg = JSON.parse(localStorage.getItem('athenes_zotero_cfg') || '{}');
        temChaveZotero = Boolean(zCfg.apiKey && String(zCfg.apiKey).trim());
      } catch (_) {}

      const salvo = localStorage.getItem(STORAGE_KEY_ARTIGOS);
      if (salvo !== null) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed)) {
          if (temChaveZotero) {
            const semExemplos = parsed.filter(a => !ehArtigoExemploFicticio(a));
            if (semExemplos.length !== parsed.length) {
              salvarArtigosEstudo(semExemplos);
            }
            return semExemplos;
          }
          return parsed;
        }
      }

      if (temChaveZotero) {
        salvarArtigosEstudo([]);
        return [];
      }
    }
  } catch (_) {}
  const iniciais = criarArtigosEstudoExemplo();
  salvarArtigosEstudo(iniciais);
  return iniciais;
}

export function salvarArtigosEstudo(lista) {
  try {
    if (typeof localStorage !== 'undefined') {
      // Remove pdfBlobUrl temporário antes de serializar se necessário, preservando na memória
      localStorage.setItem(STORAGE_KEY_ARTIGOS, JSON.stringify(lista));
    }
  } catch (_) {}
  return lista;
}

export function salvarArtigosEstudoDebounced(lista, delayMs = 320) {
  if (_timerDebounceSalvarArtigos) clearTimeout(_timerDebounceSalvarArtigos);
  _timerDebounceSalvarArtigos = setTimeout(() => {
    salvarArtigosEstudo(lista);
  }, delayMs);
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
  const todosPins = [];
  Object.keys(notasPag).forEach(pg => {
    (notasPag[pg] || []).forEach(pin => {
      todosPins.push({ pagina: pg, ...pin });
    });
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
      : ''
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

export class EstudoArtigosView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.opcoes = opcoes;
    this.onModoFullScreenChange = opcoes.onModoFullScreenChange || (() => {});
    this.artigos = carregarArtigosEstudo();
    this.artigoAberto = null;
    this.paginaAtual = 1;
    this.zoomPct = 100;
    this.ferramentaAtiva = 'cursor'; // Começa com seleção de texto ou caneta; permite alternar livremente
    this.modoLinhaReta = false; // Quando true, Caneta e Marca-Texto fazem retas perfeitas
    this.corTinta = '#314F79';
    this.espessuraTinta = 3;
    this.abaDireita = 'resumo'; // 'resumo' | 'citacoes' | 'zotero_drive'
    this.pinEditandoId = null; // ID da nota adesiva atualmente aberta para edição na folha
    this.filtroBusca = '';
    this.filtroLateralEsq = '';
    this.zoteroClient = new ZoteroClient();
    this.carregarConfigZotero();
    this.renderizar();
  }

  carregarConfigZotero() {
    try {
      const salvo = localStorage.getItem('athenes_zotero_cfg');
      if (salvo) {
        const cfg = JSON.parse(salvo);
        this.zoteroClient.userId = cfg.userId ? String(cfg.userId).trim() : '';
        this.zoteroClient.apiKey = cfg.apiKey ? String(cfg.apiKey).trim() : '';
        this.zoteroClient.username = cfg.username || '';
        this.zoteroClient.isGroup = Boolean(cfg.isGroup);
      }
    } catch (_) {}
  }

  salvarConfigZotero(cfg = {}) {
    if (cfg.userId !== undefined) this.zoteroClient.userId = String(cfg.userId).trim();
    if (cfg.apiKey !== undefined) this.zoteroClient.apiKey = String(cfg.apiKey).trim();
    if (cfg.username !== undefined) this.zoteroClient.username = cfg.username;
    try {
      localStorage.setItem('athenes_zotero_cfg', JSON.stringify({
        userId: this.zoteroClient.userId,
        apiKey: this.zoteroClient.apiKey,
        username: this.zoteroClient.username || '',
        isGroup: Boolean(this.zoteroClient.isGroup)
      }));
    } catch (_) {}
  }

  temZoteroConectado() {
    return Boolean(this.zoteroClient.apiKey);
  }

  alternarModoDashboardFull(ativo) {
    const dashEl = this.container?.closest('.ath-dashboard');
    if (dashEl) {
      dashEl.classList.toggle('ath-dashboard-estudio-full', Boolean(ativo));
    }
    this.onModoFullScreenChange(Boolean(ativo));
  }

  renderizar() {
    if (!this.container) return;
    const palcoAntigo = this.container.querySelector('#athEstudioPalco');
    const scrollSalvo = palcoAntigo ? palcoAntigo.scrollTop : 0;

    this.carregarConfigZotero();
    this.container.innerHTML = '';

    if (this.artigoAberto) {
      this.alternarModoDashboardFull(true);
      this.renderizarEstudioPdfFullScreen(this.artigoAberto, scrollSalvo);
    } else {
      this.alternarModoDashboardFull(false);
      this.renderizarCatalogoArtigos();
    }
  }

  /* ==========================================================================
     VISÃO 1: CATÁLOGO DE ARTIGOS VINCULADOS AO ZOTERO + CAPA DO PDF NO DRIVE
     ========================================================================== */
  renderizarCatalogoArtigos() {
    const wrap = document.createElement('div');
    wrap.className = 'ath-estudo-catalogo';

    const conectado = this.temZoteroConectado();
    const labelZotero = conectado
      ? `Zotero Conectado (${this.zoteroClient.userId ? '#' + this.zoteroClient.userId : 'API Ativa'})`
      : 'Configurar Chave Zotero (API Key)';

    wrap.innerHTML = `
      <div class="ath-estudo-barra-topo">
        <div class="ath-busca-box" style="flex:1; max-width:420px;">
          ${svgIcone('busca', 16)}
          <input type="text" class="ath-input" id="athEstudoBuscaInput" value="${escapeHtml(this.filtroBusca)}" placeholder="Buscar artigo por título, autor, tag Zotero ou citação marcada...">
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button type="button" class="ath-btn ${conectado ? 'ath-btn-zotero-ok' : ''}" id="athBtnConfigurarChaveZotero" title="Inserir sua API Key e User ID do Zotero">
            <span class="ath-dot-conexao ${conectado ? 'on' : ''}"></span>
            ${svgIcone('zotero', 14)}
            <span>${escapeHtml(labelZotero)}</span>
          </button>

          <button type="button" class="ath-btn" id="athBtnSincronizarZoteroHub" title="Buscar e sincronizar artigos da sua biblioteca Zotero">
            ${svgIcone('zotero', 15)} <span>Sincronizar Biblioteca</span>
          </button>

          <label class="ath-btn" style="cursor:pointer;" title="Importar referências de arquivo .bib do Zotero">
            ${svgIcone('documento', 14)} <span>Importar .bib</span>
            <input type="file" accept=".bib,.txt" id="athInputImportarBibEstudo" style="display:none;">
          </label>

          <button type="button" class="ath-btn ath-btn-primary" id="athBtnNovoArtigoDrive">
            ${svgIcone('mais', 14)} <span>Vincular Artigo & PDF</span>
          </button>
        </div>
      </div>

      <div class="ath-artigos-zotero-grid" id="athArtigosZoteroGrid"></div>
    `;

    this.container.appendChild(wrap);

    const inputBusca = wrap.querySelector('#athEstudoBuscaInput');
    inputBusca.addEventListener('input', () => {
      this.filtroBusca = inputBusca.value.trim().toLowerCase();
      this.atualizarGridCatalogo();
    });

    wrap.querySelector('#athBtnConfigurarChaveZotero').addEventListener('click', () => {
      this.abrirModalCredenciaisZotero();
    });

    wrap.querySelector('#athBtnSincronizarZoteroHub').addEventListener('click', () => {
      this.sincronizarComZoteroApi();
    });

    wrap.querySelector('#athInputImportarBibEstudo').addEventListener('change', e => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const importados = this.zoteroClient.importarBibTeX(ev.target.result || '');
        let adicionados = 0;
        importados.forEach(item => {
          if (!this.artigos.some(a => a.titulo === item.titulo)) {
            this.artigos.unshift(this.converterItemZoteroParaEstudo(item));
            adicionados++;
          }
        });
        salvarArtigosEstudo(this.artigos);
        this.atualizarGridCatalogo();
      };
      reader.readAsText(arq);
    });

    wrap.querySelector('#athBtnNovoArtigoDrive').addEventListener('click', () => {
      this.abrirModalVincularArtigo();
    });

    this.atualizarGridCatalogo();
  }

  converterItemZoteroParaEstudo(item) {
    return {
      id: 'zot_' + (item.id || Date.now().toString(36)),
      chaveZotero: item.chave || item.id || 'ZOTLOCAL',
      titulo: item.titulo || 'Artigo sem título',
      autores: item.autores?.length ? item.autores : [{ sobrenome: 'Autor', prenome: '' }],
      ano: item.ano || String(new Date().getFullYear()),
      publicacao: item.publicacao || item.editora || 'Periódico Acadêmico',
      volume: item.volume || '',
      numero: item.numero || '',
      paginas: item.paginas || '',
      doi: item.doi || '',
      palavrasChave: item.palavrasChave?.length ? item.palavrasChave : ['Zotero'],
      driveFileId: '',
      driveFileName: `${(item.autores?.[0]?.sobrenome || 'Artigo')}_${item.ano || '2026'}.pdf`,
      driveStatus: 'Pronto para vincular ao Google Drive',
      corCapa: '#314F79',
      totalPaginas: 2,
      resumoOriginal: item.resumo || 'Resumo sincronizado da biblioteca Zotero.',
      fichamento: {
        resumoPessoal: '',
        metodologiaNotas: '',
        citacoesMarcadas: [],
        notasPagina: {},
        tracosPorPagina: {}
      },
      conteudoPaginasPdf: [
        {
          numero: 1,
          cabecalho: `${(item.publicacao || 'PERIÓDICO CIENTÍFICO').toUpperCase()} · ${item.ano || '2026'}`,
          titulo: (item.titulo || 'ARTIGO CIENTÍFICO').toUpperCase(),
          autores: (item.autores || []).map(a => `${a.prenome || ''} ${a.sobrenome || ''}`.trim()).join(' · '),
          paragrafos: [
            `RESUMO: ${item.resumo || 'Texto integral carregado via vínculo do Google Drive. Selecione qualquer frase desta página para grifar, transformar em citação ABNT ou fixar uma nota adesiva.'}`,
            '1. INTRODUÇÃO E PROBLEMATIZAÇÃO: Use a barra superior flutuante para alternar entre Seleção de Texto, Caneta Livre, Linha Reta, Marca-Texto ou Notas Adesivas.'
          ]
        },
        {
          numero: 2,
          cabecalho: `${(item.autores?.[0]?.sobrenome || 'AUTOR').toUpperCase()} (${item.ano || '2026'}) · p. 2`,
          titulo: '2. DESENVOLVIMENTO E RESULTADOS PRINCIPAIS',
          autores: 'Continuação do documento PDF vinculado',
          paragrafos: [
            'Todas as páginas do artigo aparecem empilhadas continuamente neste palco. Você pode rolar livremente entre elas, desenhar esquemas com linhas retas ou mão livre e sincronizar tudo com o Zotero e o Google Drive.'
          ]
        }
      ]
    };
  }

  atualizarGridCatalogo() {
    const grid = this.container.querySelector('#athArtigosZoteroGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtrados = this.artigos.filter(art => {
      if (!this.filtroBusca) return true;
      const autoresStr = (art.autores || []).map(a => `${a.prenome} ${a.sobrenome}`).join(' ');
      const tagsStr = (art.palavrasChave || []).join(' ');
      const citStr = (art.fichamento?.citacoesMarcadas || []).map(c => c.texto).join(' ');
      const alvo = `${art.titulo} ${autoresStr} ${art.ano} ${art.publicacao} ${tagsStr} ${citStr}`.toLowerCase();
      return alvo.includes(this.filtroBusca);
    });

    if (filtrados.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; padding:42px; text-align:center; background:#fff; border-radius:16px; border:1px solid #E2E8F0;">
          <p style="font-size:15px; font-weight:800; color:#1F2733; margin:0 0 6px 0;">Nenhum artigo encontrado para este filtro</p>
          <p style="font-size:12.5px; color:#64748B; margin:0;">Sincronize sua biblioteca Zotero ou clique em "Vincular Artigo & PDF".</p>
        </div>
      `;
      return;
    }

    filtrados.forEach(art => {
      const card = document.createElement('article');
      card.className = 'ath-artigo-zotero-card';

      const autoresFmt = (art.autores || []).map(a => `${a.sobrenome}, ${a.prenome?.[0] || ''}.`).join('; ');
      const qtdCitacoes = art.fichamento?.citacoesMarcadas?.length || 0;
      const qtdTracos = Object.values(art.fichamento?.tracosPorPagina || {}).reduce((acc, l) => acc + (Array.isArray(l) ? l.length : 0), 0);
      const qtdPins = Object.values(art.fichamento?.notasPagina || {}).reduce((acc, l) => acc + (Array.isArray(l) ? l.length : 0), 0);

      card.innerHTML = `
        <div class="ath-artigo-capa-pdf" style="border-top: 4px solid ${escapeHtml(art.corCapa || '#314F79')};">
          <div class="ath-artigo-capa-folha">
            <span class="ath-artigo-capa-periodico">${escapeHtml(art.publicacao || 'Periódico Científico')} · ${escapeHtml(art.ano)}</span>
            <strong class="ath-artigo-capa-titulo">${escapeHtml(art.titulo)}</strong>
            <span class="ath-artigo-capa-autores">${escapeHtml(autoresFmt)}</span>
            <div class="ath-artigo-capa-linhas" aria-hidden="true">
              <span></span><span class="hl"></span><span></span><span></span>
            </div>
          </div>
          <div class="ath-artigo-capa-badges">
            <span class="ath-selo-zotero" title="Chave do item no Zotero">${svgIcone('zotero', 11)} ${escapeHtml(art.chaveZotero || 'ZOTERO')}</span>
            <span class="ath-selo-drive" title="PDF lido e salvo diretamente no Google Drive">${svgIcone('drive', 11)} PDF no Drive</span>
          </div>
        </div>

        <div class="ath-artigo-card-corpo">
          <div class="ath-artigo-tags">
            ${(art.palavrasChave || []).slice(0, 3).map(t => `<span class="ath-tag-chip">${escapeHtml(t)}</span>`).join('')}
          </div>

          <h3 class="ath-artigo-titulo">${escapeHtml(art.titulo)}</h3>
          <p class="ath-artigo-autores">${escapeHtml(autoresFmt)} (${escapeHtml(art.ano)})</p>
          <p class="ath-artigo-resumo-curto">
            ${art.fichamento?.resumoPessoal
              ? `<strong>Seu resumo:</strong> ${escapeHtml(art.fichamento.resumoPessoal)}`
              : escapeHtml(art.resumoOriginal || 'Clique para abrir em tela cheia, riscar o PDF e fazer o fichamento.')}
          </p>

          <div class="ath-artigo-estatisticas">
            <span><strong>${qtdCitacoes}</strong> citaç${qtdCitacoes === 1 ? 'ão' : 'ões'}</span>
            <span>·</span>
            <span><strong>${qtdTracos + qtdPins}</strong> marcaç${(qtdTracos + qtdPins) === 1 ? 'ão' : 'ões'} no PDF</span>
            <span>·</span>
            <span style="color:#059669; font-weight:700;">${escapeHtml(art.driveFileName || 'PDF vinculado')}</span>
          </div>

          <div class="ath-artigo-card-rodape">
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm ath-btn-abrir-estudio" style="flex:1; justify-content:center;">
              ${svgIcone('lapis', 13)} Abrir em Tela Cheia (PDF & Fichamento)
            </button>
            <button type="button" class="ath-btn ath-btn-sm ath-btn-excluir-artigo" title="Remover artigo da lista">${svgIcone('lixeira', 13)}</button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.ath-btn-excluir-artigo')) {
          e.stopPropagation();
          this.artigos = this.artigos.filter(x => x.id !== art.id);
          salvarArtigosEstudo(this.artigos);
          this.atualizarGridCatalogo();
          return;
        }
        this.abrirArtigoNoEstudio(art);
      });

      grid.appendChild(card);
    });
  }

  abrirArtigoNoEstudio(art) {
    this.artigoAberto = art;
    this.paginaAtual = 1;
    this.pinEditandoId = null;
    this.renderizar();
    if (!art.pdfBlobUrl) {
      garantirPdfDoArtigo(art).then(carregou => {
        if (carregou && this.artigoAberto === art) this.renderizar();
      });
    }
  }

  /* ==========================================================================
     VISÃO 2: ESTÚDIO EM TELA CHEIA (TODAS AS PÁGINAS EMPILHADAS + 3 COLUNAS)
     ========================================================================== */
  renderizarEstudioPdfFullScreen(art, scrollSalvo = 0) {
    if (!art.fichamento) {
      art.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {} };
    }
    const paginasPdf = Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.length > 0
      ? art.conteudoPaginasPdf
      : [{ numero: 1, cabecalho: art.publicacao || 'Artigo PDF', titulo: art.titulo, autores: '', paragrafos: [art.resumoOriginal || ''] }];
    art.conteudoPaginasPdf = paginasPdf;

    const totalPags = paginasPdf.length;
    if (this.paginaAtual > totalPags) this.paginaAtual = totalPags;
    if (this.paginaAtual < 1) this.paginaAtual = 1;

    const citacoes = art.fichamento.citacoesMarcadas || [];
    const conectadoZot = this.temZoteroConectado();

    const root = document.createElement('div');
    root.className = 'rm-conteudo ath-estudio-full-shell';

    // 1. TOPO SHELL (.ath-topo-shell — 52px)
    const topoShell = document.createElement('header');
    topoShell.className = 'ath-topo-shell';
    topoShell.innerHTML = `
      <div class="ath-topo-esq">
        <a class="ath-marca-link" id="athBrandVoltarCatalogo" title="Voltar para o Catálogo de Artigos">
          ${svgLogo(26)}
          <span>ATHENES</span>
        </a>
        <input type="text" class="ath-doc-titulo-topo" id="athInputTituloArtigoTopo" value="${escapeHtml(art.titulo || 'Artigo Científico')}" title="Clique para editar o título do artigo">
        <span class="rm-selo">${escapeHtml(formatarCitacaoAbntDoArtigo(art))}</span>
        <span class="ath-selo-zotero" style="padding:4px 9px; border-radius:999px; font-size:10.5px;">
          ${svgIcone('zotero', 11)} ${escapeHtml(art.chaveZotero || 'ZOTERO')}
        </span>
      </div>

      <div class="ath-topo-dir">
        <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="athBtnTopoZoteroCredenciais" title="Configurar chave de API e User ID do Zotero">
          <span class="ath-dot-conexao ${conectadoZot ? 'on' : ''}"></span>
          ${svgIcone('zotero', 14)}
          <span>${conectadoZot ? `Zotero (${escapeHtml(this.zoteroClient.userId || 'Ativo')})` : 'Conectar Zotero'}</span>
        </button>

        <label class="glx-btn glx-btn-soft glx-btn-sm" style="cursor:pointer; margin:0;" title="Abrir arquivo PDF do computador ou da pasta do Google Drive">
          ${svgIcone('drive', 14)}
          <span>Abrir PDF</span>
          <input type="file" accept="application/pdf" id="athInputCarregarPdfReal" style="display:none;">
        </label>

        <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnSalvarDriveEZotero">
          ${svgIcone('salvar', 14)}
          <span>Salvar no Drive & Zotero</span>
        </button>
      </div>
    `;
    root.appendChild(topoShell);

    // 2. CORPO EM 3 COLUNAS (.rm-editor.rm-main > .rm-ed-grade)
    const editorEl = document.createElement('div');
    editorEl.className = 'rm-editor rm-main';
    editorEl.innerHTML = `
      <div class="rm-ed-grade">
        <!-- COLUNA 1 (ESQUERDA): Dividida 50/50 com .rm-card-meio-a-meio igual ao Editor de Escrita -->
        <aside class="rm-col rm-col-esq" id="athEstudioColEsq"></aside>

        <!-- COLUNA 2 (CENTRO): Barra de Topo + Barra Flutuante (.rm-barra-blocos) + Palco Contínuo de Todas as Páginas -->
        <section class="rm-col rm-col-prev" id="athEstudioColPrev">
          <div class="rm-prev-topo">
            <div class="rm-prev-topo-esq">
              <strong>Estúdio PDF</strong>
              <span class="rm-prev-info">
                ${totalPags} ${totalPags === 1 ? 'página' : 'páginas'} em rolagem contínua · <b id="athLabelModoRisco">${this.rotuloFerramenta(this.ferramentaAtiva)}${this.modoLinhaReta ? ' (Linha Reta)' : ''}</b>
              </span>
            </div>

            <div class="rm-prev-menus-topo" id="athEstudioMenusTopo">
              <div class="rm-menu-topo-item" data-menu-est="zotero">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopZotero" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('zotero', 14)}
                  <span>Chave Zotero & Sync</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverEstZotero" role="dialog" hidden style="width:340px;"></div>
              </div>

              <div class="rm-menu-topo-item" data-menu-est="drive">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopDrive" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('drive', 14)}
                  <span>Arquivo PDF & Drive</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverEstDrive" role="dialog" hidden style="width:340px;"></div>
              </div>

              <div class="rm-menu-topo-item" data-menu-est="caneta">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopCaneta" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('lapis', 14)}
                  <span>Espessura & Zoom</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverEstCaneta" role="dialog" hidden style="width:310px;"></div>
              </div>
            </div>
          </div>

          <!-- BARRA DE PÍLULA FLUTUANTE (.rm-barra-blocos) -->
          <div class="rm-barra-blocos" id="athEstudioBarraFlutuante">
            <button type="button" class="rm-ic-bt" id="athBtnVoltarCatalogoArtigos" title="Voltar para o Catálogo de Artigos" aria-label="Voltar">
              ${svgIcone('voltar', 16)}
            </button>
            <button type="button" class="rm-ic-bt rm-ic-primario" id="athBtnSalvarPilula" title="Salvar no Google Drive, Zotero e Supabase" aria-label="Salvar">
              ${svgIcone('salvar', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <button type="button" class="rm-ic-bt" id="athBtnDesfazerTraco" title="Desfazer último risco da página ativa" aria-label="Desfazer risco">
              ${svgIcone('desfazer', 16)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnLimparTracosPagina" title="Limpar riscos da página ativa" aria-label="Limpar riscos">
              ${svgIcone('lixeira', 15)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Ferramentas: Seleção de Texto, Caneta, Marca-Texto, Modo Linha Reta, Borracha, Nota Adesiva, Citação -->
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'cursor' ? 'ativo' : ''}" data-tool="cursor" data-tip="Selecionar Texto (Grifar / Citar)" title="Selecionar Texto no PDF (abre menu flutuante para Grifar, Citar ou Criar Nota)">
              ${svgIcone('paragrafo', 15)}
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'caneta' ? 'ativo' : ''}" data-tool="caneta" data-tip="Caneta" title="Caneta de Desenho (mão livre ou reta)">
              ${svgIcone('lapis', 15)}
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'marcatexto' ? 'ativo' : ''}" data-tool="marcatexto" data-tip="Marca-Texto" title="Marca-Texto Translúcido">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            </button>

            <!-- Botão de Ativar/Desativar Modo Linha Reta -->
            <button type="button" class="rm-ic-bt ath-btn-linha-reta ${this.modoLinhaReta ? 'ativo' : ''}" id="athBtnModoLinhaReta" data-tip="Linha Reta" title="Ativar/Desativar Modo Linha Reta para Caneta e Marca-Texto (ou segure Shift ao riscar)" aria-pressed="${this.modoLinhaReta ? 'true' : 'false'}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="4" y1="20" x2="20" y2="4"/>
                <circle cx="4" cy="20" r="2" fill="currentColor"/>
                <circle cx="20" cy="4" r="2" fill="currentColor"/>
              </svg>
            </button>

            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'borracha' ? 'ativo' : ''}" data-tool="borracha" data-tip="Borracha" title="Borracha para apagar traços">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'nota' ? 'ativo' : ''}" data-tool="nota" data-tip="Nota Adesiva" title="Clique em qualquer ponto da folha para abrir um painel de Nota Adesiva editável">
              ${svgIcone('nota', 15)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnCapturarCitacaoPdf" data-tip="Nova Citação" title="Registrar citação direta no fichamento Zotero">
              ${svgIcone('citacao', 15)}
            </button>

            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Bolinhas de Cor Rápidas -->
            <div class="ath-cores-tinta" title="Cor da caneta, linha reta, marca-texto ou nota">
              ${['#314F79', '#DC2626', '#059669', '#D97706', '#7C3AED', '#FACC15'].map(cor => `
                <button type="button" class="ath-cor-dot ${this.corTinta === cor ? 'on' : ''}" data-cor="${cor}" style="background:${cor};" aria-label="Cor ${cor}"></button>
              `).join('')}
            </div>

            <!-- Botão de Adicionar Folha Extra e Indicador de Página à Direita -->
            <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
              <span id="athIndicadorPagBarra" style="font:800 11.5px var(--glx-font); color:#314F79; background:#EEF4FA; padding:4px 10px; border-radius:999px;">
                Pág. ${this.paginaAtual} de ${totalPags}
              </span>
              <button type="button" class="rm-ic-bt" id="athPdfNovaPag" data-tip="Folha Extra" title="Adicionar folha extra de esquemas/notas ao final do PDF" style="width:32px; height:32px;">
                ${svgIcone('mais', 14)}
              </button>
            </div>
          </div>

          <!-- PALCO CENTRAL COM TODAS AS PÁGINAS EMPILHADAS (.rm-prev-palco) -->
          <div class="rm-prev-palco" id="athEstudioPalco">
            <!-- Pílula Contextual Flutuante ao Selecionar Texto no PDF -->
            <div class="ath-pdf-selecao-popover" id="athPdfSelecaoPopover" hidden>
              <button type="button" class="ath-sel-pop-btn" id="athSelBtnGrifar" title="Grifar o trecho selecionado na página">
                <span class="ath-sel-cor-dot" style="background:#FDE047;"></span>
                <span>Grifar Texto</span>
              </button>
              <button type="button" class="ath-sel-pop-btn primario" id="athSelBtnCitar" title="Salvar trecho selecionado como Citação no Zotero com página">
                ${svgIcone('citacao', 13)}
                <span>+ Citação Zotero</span>
              </button>
              <button type="button" class="ath-sel-pop-btn" id="athSelBtnNota" title="Criar uma Nota Adesiva na página com este trecho">
                ${svgIcone('nota', 13)}
                <span>Criar Nota</span>
              </button>
              <button type="button" class="ath-sel-pop-btn" id="athSelBtnCopiarAbnt" title="Copiar trecho já formatado com (AUTOR, ANO, p. X)">
                <span>Copiar ABNT</span>
              </button>
            </div>

            <div class="ath-pdf-todas-paginas-stack" id="athPdfTodasPaginasStack"></div>
          </div>
        </section>

        <!-- COLUNA 3 (DIREITA): Inspetor Completo de Fichamento, Citações e Zotero + Drive -->
        <aside class="rm-col rm-col-dir" id="athEstudioColDir">
          <div class="rm-props ath-estudio-inspetor-card">
            <div class="ath-estudio-abas">
              <button type="button" class="ath-estudio-aba ${this.abaDireita === 'resumo' ? 'on' : ''}" data-aba="resumo">
                Resumo & Notas
              </button>
              <button type="button" class="ath-estudio-aba ${this.abaDireita === 'citacoes' ? 'on' : ''}" data-aba="citacoes">
                Citações (${citacoes.length})
              </button>
              <button type="button" class="ath-estudio-aba ${this.abaDireita === 'zotero_drive' ? 'on' : ''}" data-aba="zotero_drive">
                Zotero & Drive
              </button>
            </div>
            <div class="ath-estudio-painel-corpo" id="athEstudioPainelCorpo"></div>
          </div>
        </aside>
      </div>
    `;

    root.appendChild(editorEl);
    this.container.appendChild(root);

    // Renderiza TODAS as páginas empilhadas no palco central
    this.renderizarTodasAsPaginasNoPalco(root, art, paginasPdf);

    // Monta a Coluna Esquerda 50/50 (Artigos Zotero em cima + Páginas do PDF embaixo)
    this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);

    // Monta Popovers de Topo
    this.configurarPopoversTopoEstudio(root, art);

    // Configura o Menu Flutuante de Seleção de Texto no PDF
    this.configurarSelecaoTextoInterativa(root, art, paginasPdf);

    // Eventos de Topo e Barra Flutuante
    const voltarParaCatalogo = () => {
      salvarArtigosEstudo(this.artigos);
      this.artigoAberto = null;
      this.renderizar();
    };
    root.querySelector('#athBrandVoltarCatalogo').addEventListener('click', voltarParaCatalogo);
    root.querySelector('#athBtnVoltarCatalogoArtigos').addEventListener('click', voltarParaCatalogo);

    root.querySelector('#athInputTituloArtigoTopo').addEventListener('change', e => {
      art.titulo = e.target.value.trim() || art.titulo;
      salvarArtigosEstudo(this.artigos);
      this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
    });

    root.querySelector('#athBtnTopoZoteroCredenciais').addEventListener('click', () => {
      this.abrirModalCredenciaisZotero();
    });

    const acionarSalvarCompleto = (btnRef) => {
      this.sincronizarArtigoComDriveEZotero(art, btnRef);
    };
    root.querySelector('#athBtnSalvarDriveEZotero').addEventListener('click', (e) => acionarSalvarCompleto(e.currentTarget));
    root.querySelector('#athBtnSalvarPilula').addEventListener('click', () => acionarSalvarCompleto(root.querySelector('#athBtnSalvarDriveEZotero')));

    // Desfazer último risco e limpar riscos da página ativa
    root.querySelector('#athBtnDesfazerTraco').addEventListener('click', () => {
      const lista = art.fichamento?.tracosPorPagina?.[this.paginaAtual];
      if (Array.isArray(lista) && lista.length > 0) {
        lista.pop();
        salvarArtigosEstudo(this.artigos);
        const canvasAtivo = root.querySelector(`canvas[data-canvas-pag="${this.paginaAtual}"]`);
        this.redesenharCanvasTinta(canvasAtivo, art, this.paginaAtual);
        this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
      }
    });

    root.querySelector('#athBtnLimparTracosPagina').addEventListener('click', () => {
      if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
      art.fichamento.tracosPorPagina[this.paginaAtual] = [];
      salvarArtigosEstudo(this.artigos);
      const canvasAtivo = root.querySelector(`canvas[data-canvas-pag="${this.paginaAtual}"]`);
      this.redesenharCanvasTinta(canvasAtivo, art, this.paginaAtual);
      this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
    });

    // Alternar Modo Linha Reta
    const btnLinhaReta = root.querySelector('#athBtnModoLinhaReta');
    btnLinhaReta.addEventListener('click', () => {
      this.modoLinhaReta = !this.modoLinhaReta;
      if (this.modoLinhaReta && (this.ferramentaAtiva === 'cursor' || this.ferramentaAtiva === 'borracha' || this.ferramentaAtiva === 'nota')) {
        this.ferramentaAtiva = 'caneta';
      }
      this.atualizarEstadoFerramentasNoDom(root);
    });

    // Seleção de Ferramenta (Cursor, Caneta, Marca-Texto, Borracha, Nota)
    root.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ferramentaAtiva = btn.dataset.tool;
        this.atualizarEstadoFerramentasNoDom(root);
      });
    });

    // Seleção de Cor da Tinta
    root.querySelectorAll('[data-cor]').forEach(dot => {
      dot.addEventListener('click', () => {
        this.corTinta = dot.dataset.cor;
        root.querySelectorAll('[data-cor]').forEach(d => d.classList.toggle('on', d.dataset.cor === this.corTinta));
      });
    });

    root.querySelector('#athBtnCapturarCitacaoPdf').addEventListener('click', () => {
      this.abrirModalCitacaoPdf(art, { pagina: this.paginaAtual });
    });

    root.querySelector('#athPdfNovaPag').addEventListener('click', () => {
      this.adicionarFolhaExtraNoPdf(art, paginasPdf);
    });

    root.querySelector('#athInputCarregarPdfReal').addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      registrarPdfLocalNoArtigo(art, file);
      salvarArtigosEstudo(this.artigos);
      this.renderizar();
    });

    // Abas do painel lateral direito
    root.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaDireita = btn.dataset.aba;
        root.querySelectorAll('.ath-estudio-aba').forEach(b => b.classList.toggle('on', b.dataset.aba === this.abaDireita));
        this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
      });
    });

    // Renderiza Inspetor Direito
    this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);

    // Restaura rolagem do palco se houver
    const palcoNovo = root.querySelector('#athEstudioPalco');
    if (palcoNovo && scrollSalvo > 0) {
      palcoNovo.scrollTop = scrollSalvo;
    }
  }

  atualizarEstadoFerramentasNoDom(root) {
    root.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('ativo', b.dataset.tool === this.ferramentaAtiva);
    });
    const btnReta = root.querySelector('#athBtnModoLinhaReta');
    if (btnReta) {
      btnReta.classList.toggle('ativo', this.modoLinhaReta);
      btnReta.setAttribute('aria-pressed', this.modoLinhaReta ? 'true' : 'false');
    }
    root.querySelectorAll('.ath-pdf-ink-canvas').forEach(canvas => {
      canvas.style.pointerEvents = this.ferramentaAtiva === 'cursor' ? 'none' : 'auto';
      canvas.style.cursor = this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair';
    });
    const lbl = root.querySelector('#athLabelModoRisco');
    if (lbl) {
      lbl.textContent = `${this.rotuloFerramenta(this.ferramentaAtiva)}${this.modoLinhaReta && (this.ferramentaAtiva === 'caneta' || this.ferramentaAtiva === 'marcatexto') ? ' (Linha Reta)' : ''}`;
    }
  }

  /* ==========================================================================
     RENDERIZAÇÃO DE TODAS AS PÁGINAS EMPILHADAS NO PALCO CENTRAL
     ========================================================================== */
  renderizarTodasAsPaginasNoPalco(root, art, paginasPdf) {
    const stack = root.querySelector('#athPdfTodasPaginasStack');
    if (!stack) return;
    stack.innerHTML = '';

    // PDF real: renderiza cada página do arquivo como uma folha própria (no formato original)
    const pdfInfo = art.pdfBlobUrl ? this._pdfDocs?.get(art.pdfBlobUrl) : null;
    if (art.pdfBlobUrl && !pdfInfo && !this._pdfFalhou?.has(art.pdfBlobUrl)) {
      stack.innerHTML = '<div class="ath-pdf-carregando">Carregando as páginas do PDF...</div>';
      this.carregarPdfReal(art).then(() => {
        if (this.artigoAberto === art) this.renderizar();
      });
      return;
    }
    if (pdfInfo) {
      if (!Array.isArray(art.conteudoPaginasPdf) || art.conteudoPaginasPdf.length !== pdfInfo.n || !art.conteudoPaginasPdf[0]?.real) {
        art.conteudoPaginasPdf = pdfInfo.dims.map((_, i) => ({
          numero: i + 1,
          real: true,
          cabecalho: '',
          titulo: `Folha ${i + 1} do PDF`,
          autores: '',
          paragrafos: []
        }));
      }
      paginasPdf = art.conteudoPaginasPdf;
    }
    const totalPags = paginasPdf.length;
    const folhasReais = [];

    paginasPdf.forEach((pagDados, idx) => {
      const numPag = idx + 1;
      const pinsDaPagina = art.fichamento.notasPagina?.[numPag] || [];
      const tracosDaPagina = art.fichamento.tracosPorPagina?.[numPag] || [];
      const isPagAtiva = numPag === this.paginaAtual;
      const dimPag = pdfInfo?.dims?.[idx];
      const alturaReal = dimPag ? Math.round(794 * dimPag.h / dimPag.w) : 1123;
      const escalaZoom = this.zoomPct / 100;
      const alturaWrapEscalada = pdfInfo ? Math.round(alturaReal * escalaZoom) : null;

      const folhaWrap = document.createElement('div');
      folhaWrap.className = 'ath-pdf-pagina-bloco-wrap';
      folhaWrap.dataset.wrapPagina = String(numPag);
      if (alturaWrapEscalada && escalaZoom !== 1) {
        folhaWrap.style.minHeight = `${alturaWrapEscalada + 36}px`;
      }

      folhaWrap.innerHTML = `
        <div class="ath-pdf-etiqueta-pagina ${isPagAtiva ? 'ativa' : ''}" data-etiqueta-pag="${numPag}">
          <span class="ath-pdf-etiqueta-num">Página ${numPag} de ${totalPags} — ${escapeHtml((pagDados.titulo || `Folha ${numPag} do PDF`).slice(0, 62))}</span>
          <span class="ath-pdf-etiqueta-stats" data-stats-pag="${numPag}">${tracosDaPagina.length} risco(s) · ${pinsDaPagina.length} nota(s)</span>
        </div>

        <div class="ath-folha-a4 ath-pdf-folha-container ${isPagAtiva ? 'pagina-ativa' : ''}" data-num-pagina="${numPag}" style="${pdfInfo ? `width:794px; height:${alturaReal}px; min-height:${alturaReal}px; max-height:${alturaReal}px; padding:0; flex-shrink:0; ` : ''}transform: scale(${escalaZoom}); transform-origin: top center;">
          ${pdfInfo ? `
            <canvas class="ath-pdf-render-canvas" style="width:794px; height:${alturaReal}px;"></canvas>
            <div class="ath-pdf-grifos-layer" data-grifos-pag="${numPag}"></div>
            <div class="ath-pdf-folha-texto ath-pdf-text-layer" data-texto-pag="${numPag}"></div>
          ` : art.pdfBlobUrl && numPag === 1 ? `
            <embed src="${art.pdfBlobUrl}" type="application/pdf" class="ath-pdf-embed-nativo">
          ` : `
            <div class="ath-pdf-folha-texto" data-texto-pag="${numPag}">
              <div class="ath-pdf-folha-cabecalho">${escapeHtml(pagDados.cabecalho || '')}</div>
              <h2 class="ath-pdf-folha-titulo">${escapeHtml(pagDados.titulo || '')}</h2>
              ${pagDados.autores ? `<div class="ath-pdf-folha-autores">${escapeHtml(pagDados.autores)}</div>` : ''}
              <div class="ath-pdf-folha-colunas" data-colunas-pag="${numPag}">
                ${pagDados.htmlGrifado
                  ? sanitizarHtmlEditorial(pagDados.htmlGrifado)
                  : (pagDados.paragrafos || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
              </div>
              <div class="ath-pdf-folha-rodape">
                <span>DOI: ${escapeHtml(art.doi || '10.1000/athenes.zotero')}</span>
                <span>Página ${numPag} de ${totalPags} · Google Drive (${escapeHtml(art.driveFileName || 'PDF')})</span>
              </div>
            </div>
          `}

          <!-- Camada Transparente de Risco Livre, Linha Reta e Marca-Texto (Samsung Notes Canvas) -->
          <canvas class="ath-pdf-ink-canvas" data-canvas-pag="${numPag}" width="794" height="${pdfInfo ? alturaReal : 1123}" style="pointer-events: ${this.ferramentaAtiva === 'cursor' ? 'none' : 'auto'}; cursor: ${this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair'};"></canvas>

          <!-- Camada de Notas Adesivas Editáveis na Página -->
          <div class="ath-pdf-pins-layer" data-pins-pag="${numPag}"></div>
        </div>
      `;

      stack.appendChild(folhaWrap);
      if (pdfInfo) {
        folhasReais.push(folhaWrap.querySelector('.ath-pdf-folha-container'));
        this.renderizarGrifosRetangularesDaPagina(folhaWrap.querySelector(`[data-grifos-pag="${numPag}"]`), art, numPag);
      }

      // Renderiza as notas adesivas (pins) desta página
      this.renderizarPinsDaPagina(folhaWrap.querySelector(`[data-pins-pag="${numPag}"]`), art, numPag, root);

      // Inicializa o Canvas de Risco Livre + Linha Reta desta página
      const canvasPag = folhaWrap.querySelector(`canvas[data-canvas-pag="${numPag}"]`);
      this.inicializarCanvasTinta(canvasPag, art, numPag, root);

      // Clicar na folha define ela como página ativa
      const folhaContainer = folhaWrap.querySelector('.ath-pdf-folha-container');
      folhaContainer.addEventListener('pointerdown', () => {
        this.definirPaginaAtivaSilencioso(numPag, root);
      });
    });

    // Desenha as páginas do PDF real sob demanda (só as que estão perto da tela)
    if (pdfInfo && folhasReais.length) {
      const palcoRender = root.querySelector('#athEstudioPalco');
      const desenhar = (folha) => this.renderizarPaginaPdfReal(pdfInfo, folha, parseInt(folha.dataset.numPagina, 10));
      if (typeof IntersectionObserver !== 'undefined' && palcoRender) {
        const obs = new IntersectionObserver(entradas => {
          entradas.forEach(en => {
            if (en.isIntersecting) { obs.unobserve(en.target); desenhar(en.target); }
          });
        }, { root: palcoRender, rootMargin: '900px 0px' });
        folhasReais.forEach(f => obs.observe(f));
      } else {
        folhasReais.forEach(desenhar);
      }
    }

    // Atualiza página ativa conforme rolagem do palco (com throttle via requestAnimationFrame)
    const palco = root.querySelector('#athEstudioPalco');
    if (palco) {
      const folhasCache = Array.from(palco.querySelectorAll('.ath-pdf-folha-container'));
      let scrollRafPendente = false;
      palco.addEventListener('scroll', () => {
        if (scrollRafPendente) return;
        scrollRafPendente = true;
        requestAnimationFrame(() => {
          scrollRafPendente = false;
          let melhorPag = this.paginaAtual;
          let menorDist = Infinity;
          const palcoRect = palco.getBoundingClientRect();
          for (let i = 0; i < folhasCache.length; i++) {
            const f = folhasCache[i];
            const r = f.getBoundingClientRect();
            const dist = Math.abs(r.top - palcoRect.top - 40);
            if (dist < menorDist) {
              menorDist = dist;
              melhorPag = parseInt(f.dataset.numPagina, 10) || 1;
            }
          }
          if (melhorPag !== this.paginaAtual) {
            this.definirPaginaAtivaSilencioso(melhorPag, root);
          }
        });
      }, { passive: true });
    }
  }

  /** Abre o PDF com pdf.js, mede cada página e prepara uma folha por página. */
  async carregarPdfReal(art) {
    const url = art.pdfBlobUrl;
    if (!this._pdfDocs) this._pdfDocs = new Map();
    if (!this._pdfFalhou) this._pdfFalhou = new Set();
    if (this._pdfDocs.has(url)) return true;
    try {
      const lib = await carregarPdfJs();
      const doc = await lib.getDocument({ url }).promise;
      const n = doc.numPages;
      const dims = await Promise.all(Array.from({ length: n }, async (_, i) => {
        const v = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
        return { w: v.width, h: v.height };
      }));
      const atuais = art.conteudoPaginasPdf || [];
      if (atuais.length !== n || !atuais[0]?.real) {
        art.conteudoPaginasPdf = dims.map((_, i) => ({
          numero: i + 1,
          real: true,
          cabecalho: '',
          titulo: 'Folha do PDF',
          autores: '',
          paragrafos: []
        }));
      }
      art.totalPaginas = n;
      this._pdfDocs.set(url, { doc, dims, n });
      return true;
    } catch (err) {
      console.warn('Athenes — falha ao abrir PDF com pdf.js:', err);
      this._pdfFalhou.add(url);
      return false;
    }
  }

  async renderizarPaginaPdfReal(info, folha, numPag) {
    if (!folha || folha.dataset.renderizada) return;
    folha.dataset.renderizada = '1';
    try {
      const page = await info.doc.getPage(numPag);
      const d = info.dims[numPag - 1];
      const escala = 794 / d.w;
      const viewport = page.getViewport({ scale: escala });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cv = folha.querySelector('.ath-pdf-render-canvas');
      if (!cv) return;
      cv.width = Math.floor(viewport.width * dpr);
      cv.height = Math.floor(viewport.height * dpr);
      await page.render({
        canvasContext: cv.getContext('2d'),
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
      }).promise;

      const camada = folha.querySelector('.ath-pdf-text-layer');
      if (camada) {
        camada.style.setProperty('--scale-factor', String(escala));
        camada.style.setProperty('--total-scale-factor', String(escala));
        const lib = await carregarPdfJs();
        const textContent = await page.getTextContent();
        await new lib.TextLayer({
          textContentSource: textContent,
          container: camada,
          viewport
        }).render();

        // Detecta número editorial real da página (ex.: p. 253 em vez de apenas p. 17 do PDF)
        const itensTxt = (textContent.items || [])
          .map(it => String(it.str || '').trim())
          .filter(Boolean);
        const candidatos = [...itensTxt.slice(0, 6), ...itensTxt.slice(-6)];
        for (const cand of candidatos) {
          if (/^\d{1,5}$/.test(cand)) {
            const numEditorial = parseInt(cand, 10);
            if (numEditorial > 0 && numEditorial !== numPag) {
              folha.dataset.pagEditorial = String(numEditorial);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Athenes — falha ao desenhar página do PDF:', err);
    }
  }

  definirPaginaAtivaSilencioso(numPag, root) {
    if (this.paginaAtual === numPag) return;
    this.paginaAtual = numPag;
    if (!root) return;
    const totalPags = this.artigoAberto?.conteudoPaginasPdf?.length || 1;
    const indBarra = root.querySelector('#athIndicadorPagBarra');
    if (indBarra) indBarra.textContent = `Pág. ${numPag} de ${totalPags}`;

    root.querySelectorAll('.ath-pdf-folha-container').forEach(el => {
      el.classList.toggle('pagina-ativa', parseInt(el.dataset.numPagina, 10) === numPag);
    });
    root.querySelectorAll('.ath-pdf-etiqueta-pagina').forEach(el => {
      el.classList.toggle('ativa', parseInt(el.dataset.etiquetaPag, 10) === numPag);
    });
    root.querySelectorAll('[data-ir-pagina-esq]').forEach(li => {
      li.classList.toggle('sel', parseInt(li.dataset.irPaginaEsq, 10) === numPag);
    });
  }

  rolarParaPagina(numPag, root) {
    this.definirPaginaAtivaSilencioso(numPag, root);
    const wrapPag = root?.querySelector(`[data-wrap-pagina="${numPag}"]`);
    if (wrapPag && wrapPag.scrollIntoView) {
      try {
        wrapPag.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    }
  }

  /* ==========================================================================
     PAINEL DE NOTAS ADESIVAS EDITÁVEIS NA FOLHA (SEM WINDOW.PROMPT)
     Suporta: Minimizar (—), Tamanho Compacto (P/M), Arrastar e Sem Cortar Borda
     ========================================================================== */
  atualizarPaineisLateraisDeNotas(root, art) {
    if (!root) return;
    this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
    this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
    (art.conteudoPaginasPdf || []).forEach((_, idx) => {
      const pg = idx + 1;
      const statsEl = root.querySelector(`[data-stats-pag="${pg}"]`);
      if (statsEl) {
        const nRiscos = (art.fichamento.tracosPorPagina?.[pg] || []).length;
        const nNotas = (art.fichamento.notasPagina?.[pg] || []).length;
        statsEl.textContent = `${nRiscos} risco(s) · ${nNotas} nota(s)`;
      }
    });
  }

  criarNotaAdesivaNaPagina(art, numPag, xPct = 52, yPct = 25, textoInicial = '', root = null) {
    const perfil = obterPerfilColaborador();
    if (!art.fichamento.notasPagina) art.fichamento.notasPagina = {};
    if (!Array.isArray(art.fichamento.notasPagina[numPag])) {
      art.fichamento.notasPagina[numPag] = [];
    }
    const novoPin = {
      id: 'pin_' + Date.now().toString(36),
      xPct: Math.max(3, Math.min(60, xPct)),
      yPct: Math.max(3, Math.min(82, yPct)),
      titulo: perfil.nome || 'Nota de Leitura',
      texto: textoInicial || '',
      cor: this.corTinta === '#314F79' ? '#F59E0B' : this.corTinta,
      autor: perfil.nome || 'Autor',
      minimizado: false,
      tamanho: 'normal'
    };
    art.fichamento.notasPagina[numPag].push(novoPin);
    this.pinEditandoId = novoPin.id;
    salvarArtigosEstudo(this.artigos);

    if (root) {
      const layer = root.querySelector(`[data-pins-pag="${numPag}"]`);
      this.renderizarPinsDaPagina(layer, art, numPag, root);
      this.atualizarPaineisLateraisDeNotas(root, art);
    } else {
      this.renderizar();
    }
  }

  renderizarPinsDaPagina(layerEl, art, numPag, root) {
    if (!layerEl) return;
    layerEl.innerHTML = '';

    const pins = art.fichamento.notasPagina?.[numPag] || [];
    const coresNota = ['#F59E0B', '#314F79', '#059669', '#DC2626', '#7C3AED', '#0284C7'];

    pins.forEach((pin, idx) => {
      const estaEditando = this.pinEditandoId === pin.id;
      const estaMinimizado = Boolean(pin.minimizado) && !estaEditando;
      const ehCompacta = pin.tamanho === 'pequena' && !estaEditando;

      // Impede que a nota ultrapasse a borda direita da página (794px)
      const larguraCardPx = estaEditando ? 276 : (estaMinimizado ? 150 : (ehCompacta ? 168 : 220));
      const xSeguroPct = Math.max(2, Math.min(96, pin.xPct ?? 55));
      const ySeguroPct = Math.max(2, Math.min(90, pin.yPct ?? 25));

      const card = document.createElement('div');
      card.className = [
        'ath-pdf-pin-balao',
        estaEditando ? 'editando' : '',
        estaMinimizado ? 'minimizado' : '',
        ehCompacta ? 'compacto' : ''
      ].filter(Boolean).join(' ');

      card.style.left = `min(${xSeguroPct}%, calc(100% - ${larguraCardPx + 12}px))`;
      card.style.top = `${ySeguroPct}%`;
      card.style.borderColor = pin.cor || '#F59E0B';
      card.dataset.pinId = pin.id;

      if (estaEditando) {
        card.innerHTML = `
          <div class="ath-pdf-pin-cab ath-pin-arrastavel" style="background:${escapeHtml(pin.cor || '#F59E0B')};">
            <span class="ath-pin-cab-titulo">${svgIcone('nota', 12)} Nota #${idx + 1} (Pág. ${numPag})</span>
            <div class="ath-pin-cab-acoes">
              <button type="button" class="ath-pin-edit-btn" data-min-edicao-pin="${escapeHtml(pin.id)}" title="Minimizar nota na folha">${svgIcone('minimizar', 11)}</button>
              <button type="button" class="ath-pin-del" data-fechar-edicao-pin="${escapeHtml(pin.id)}" title="Concluir edição">${svgIcone('fechar', 11)}</button>
            </div>
          </div>
          <div class="ath-pdf-pin-form">
            <input type="text" class="ath-pin-input-titulo" value="${escapeHtml(pin.titulo || '')}" placeholder="Título da nota...">
            <textarea class="ath-pin-textarea" rows="3" placeholder="Escreva sua anotação, crítica ou lembrete aqui...">${escapeHtml(pin.texto || '')}</textarea>
            <div class="ath-pin-form-rodape">
              <div class="ath-pin-cores">
                ${coresNota.map(c => `
                  <button type="button" class="ath-pin-cor-dot ${(pin.cor || '#F59E0B') === c ? 'on' : ''}" data-cor-pin="${c}" style="background:${c};" title="Cor ${c}"></button>
                `).join('')}
              </div>
              <div class="ath-pin-botoes">
                <button type="button" class="ath-pin-ic-acao ath-pin-ic-neutro" data-tam-pin="${escapeHtml(pin.id)}" title="Alternar largura (${pin.tamanho === 'pequena' ? 'Compacta -> Normal' : 'Normal -> Compacta'})">
                  ${svgIcone('redimensionar', 12)}
                </button>
                <button type="button" class="ath-pin-ic-acao ath-pin-ic-perigo" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">
                  ${svgIcone('lixeira', 12)}
                </button>
                <button type="button" class="ath-pin-ic-acao ath-pin-ic-primario" data-salvar-pin="${escapeHtml(pin.id)}" title="Salvar nota">
                  ${svgIcone('check', 13)}
                </button>
              </div>
            </div>
          </div>
        `;

        const inputTit = card.querySelector('.ath-pin-input-titulo');
        const txtArea = card.querySelector('.ath-pin-textarea');

        card.querySelectorAll('[data-cor-pin]').forEach(dot => {
          dot.addEventListener('click', e => {
            e.stopPropagation();
            pin.titulo = inputTit.value.trim() || pin.titulo;
            pin.texto = txtArea.value.trim() || pin.texto;
            pin.cor = dot.dataset.corPin;
            salvarArtigosEstudo(this.artigos);
            this.renderizarPinsDaPagina(layerEl, art, numPag, root);
            this.atualizarPaineisLateraisDeNotas(root, art);
          });
        });

        card.querySelector('[data-tam-pin]').addEventListener('click', e => {
          e.stopPropagation();
          pin.titulo = inputTit.value.trim() || pin.titulo;
          pin.texto = txtArea.value.trim() || pin.texto;
          pin.tamanho = pin.tamanho === 'pequena' ? 'normal' : 'pequena';
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
        });

        const salvarEdicaoPin = (minimizarAoSalvar = false) => {
          pin.titulo = inputTit.value.trim() || 'Nota';
          pin.texto = txtArea.value.trim() || 'Anotação na página';
          if (minimizarAoSalvar) pin.minimizado = true;
          this.pinEditandoId = null;
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        };

        card.querySelector('[data-salvar-pin]').addEventListener('click', e => {
          e.stopPropagation();
          salvarEdicaoPin(false);
        });

        card.querySelector('[data-fechar-edicao-pin]').addEventListener('click', e => {
          e.stopPropagation();
          salvarEdicaoPin(false);
        });

        card.querySelector('[data-min-edicao-pin]').addEventListener('click', e => {
          e.stopPropagation();
          salvarEdicaoPin(true);
        });

        card.querySelector('[data-del-pin]').addEventListener('click', e => {
          e.stopPropagation();
          art.fichamento.notasPagina[numPag] = pins.filter(p => p.id !== pin.id);
          this.pinEditandoId = null;
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });

        setTimeout(() => txtArea?.focus(), 20);
      } else if (estaMinimizado) {
        // Modo Minimizado: pílula compacta que não cobre o texto do PDF
        card.innerHTML = `
          <div class="ath-pdf-pin-cab ath-pin-arrastavel" style="background:${escapeHtml(pin.cor || '#F59E0B')};" title="${escapeHtml(pin.texto || 'Clique para expandir esta nota')}">
            <span class="ath-pin-cab-titulo" data-expandir-pin="${escapeHtml(pin.id)}">${svgIcone('nota', 11)} #${idx + 1} ${escapeHtml(pin.titulo || 'Nota')}</span>
            <div class="ath-pin-cab-acoes">
              <button type="button" class="ath-pin-edit-btn" data-expandir-pin="${escapeHtml(pin.id)}" title="Expandir nota">${svgIcone('mais', 11)}</button>
              <button type="button" class="ath-pin-del" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">${svgIcone('fechar', 11)}</button>
            </div>
          </div>
        `;

        card.querySelectorAll('[data-expandir-pin]').forEach(el => {
          el.addEventListener('click', e => {
            e.stopPropagation();
            pin.minimizado = false;
            salvarArtigosEstudo(this.artigos);
            this.renderizarPinsDaPagina(layerEl, art, numPag, root);
            this.atualizarPaineisLateraisDeNotas(root, art);
          });
        });

        card.querySelector('[data-del-pin]').addEventListener('click', e => {
          e.stopPropagation();
          art.fichamento.notasPagina[numPag] = pins.filter(p => p.id !== pin.id);
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });
      } else {
        card.innerHTML = `
          <div class="ath-pdf-pin-cab ath-pin-arrastavel" style="background:${escapeHtml(pin.cor || '#F59E0B')};" title="Arraste para mover ou clique nos ícones para redimensionar/editar">
            <span class="ath-pin-cab-titulo">${svgIcone('nota', 11)} #${idx + 1} · ${escapeHtml(pin.titulo || 'Nota')}</span>
            <div class="ath-pin-cab-acoes">
              <button type="button" class="ath-pin-edit-btn" data-tam-rapido-pin="${escapeHtml(pin.id)}" title="Alternar largura (${pin.tamanho === 'pequena' ? 'Compacta -> Normal' : 'Normal -> Compacta'})">${svgIcone('redimensionar', 10)}</button>
              <button type="button" class="ath-pin-edit-btn" data-minimizar-pin="${escapeHtml(pin.id)}" title="Minimizar nota em pílula">${svgIcone('minimizar', 11)}</button>
              <button type="button" class="ath-pin-edit-btn" data-abrir-edicao-pin="${escapeHtml(pin.id)}" title="Editar esta nota">${svgIcone('lapis', 10)}</button>
              <button type="button" class="ath-pin-del" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">${svgIcone('fechar', 11)}</button>
            </div>
          </div>
          <div class="ath-pdf-pin-txt" data-abrir-edicao-pin="${escapeHtml(pin.id)}" title="Clique para editar o texto desta nota">
            ${escapeHtml(pin.texto || 'Clique para escrever na nota...')}
          </div>
        `;

        card.querySelectorAll('[data-abrir-edicao-pin]').forEach(el => {
          el.addEventListener('click', e => {
            e.stopPropagation();
            this.pinEditandoId = pin.id;
            this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          });
        });

        card.querySelector('[data-minimizar-pin]').addEventListener('click', e => {
          e.stopPropagation();
          pin.minimizado = true;
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });

        card.querySelector('[data-tam-rapido-pin]').addEventListener('click', e => {
          e.stopPropagation();
          pin.tamanho = pin.tamanho === 'pequena' ? 'normal' : 'pequena';
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
        });

        card.querySelector('[data-del-pin]').addEventListener('click', e => {
          e.stopPropagation();
          art.fichamento.notasPagina[numPag] = pins.filter(p => p.id !== pin.id);
          salvarArtigosEstudo(this.artigos);
          this.renderizarPinsDaPagina(layerEl, art, numPag, root);
          this.atualizarPaineisLateraisDeNotas(root, art);
        });
      }

      // Permite arrastar o cabeçalho do balão de nota para reposicionar na página em qualquer estado
      const cab = card.querySelector('.ath-pin-arrastavel');
      if (cab) {
        cab.addEventListener('pointerdown', ev => {
          if (ev.target.closest('button')) return;
          ev.stopPropagation();
          const rectLayer = layerEl.getBoundingClientRect();
          const startX = ev.clientX;
          const startY = ev.clientY;
          const origXPct = pin.xPct ?? 55;
          const origYPct = pin.yPct ?? 25;
          let moveu = false;

          const onMove = (mev) => {
            const dx = mev.clientX - startX;
            const dy = mev.clientY - startY;
            if (Math.hypot(dx, dy) > 4) moveu = true;
            pin.xPct = Math.max(2, Math.min(72, Math.round(origXPct + (dx / rectLayer.width) * 100)));
            pin.yPct = Math.max(2, Math.min(88, Math.round(origYPct + (dy / rectLayer.height) * 100)));
            card.style.left = `min(${pin.xPct}%, calc(100% - ${larguraCardPx + 12}px))`;
            card.style.top = `${pin.yPct}%`;
          };

          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (moveu) {
              salvarArtigosEstudo(this.artigos);
            } else if (!estaEditando) {
              if (estaMinimizado) {
                pin.minimizado = false;
                salvarArtigosEstudo(this.artigos);
              } else {
                this.pinEditandoId = pin.id;
              }
              this.renderizarPinsDaPagina(layerEl, art, numPag, root);
              this.atualizarPaineisLateraisDeNotas(root, art);
            }
          };

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      }

      layerEl.appendChild(card);
    });
  }

  renderizarGrifosRetangularesDaPagina(layerEl, art, numPag) {
    if (!layerEl) return;
    layerEl.innerHTML = '';
    const grifos = art.fichamento?.grifosPorPagina?.[numPag] || [];
    grifos.forEach(g => {
      const div = document.createElement('div');
      div.className = 'ath-pdf-hl-rect';
      div.style.left = `${g.xPct}%`;
      div.style.top = `${g.yPct}%`;
      div.style.width = `${g.wPct}%`;
      div.style.height = `${g.hPct}%`;
      div.style.background = g.cor || 'rgba(250, 204, 21, 0.45)';
      layerEl.appendChild(div);
    });
  }

  /* ==========================================================================
     SELEÇÃO DE TEXTO INTERATIVA (GRIFAR TRECHO, CITAR NO ZOTERO, CRIAR NOTA)
     ========================================================================== */
  configurarSelecaoTextoInterativa(root, art, paginasPdf) {
    const palco = root.querySelector('#athEstudioPalco');
    const popSel = root.querySelector('#athPdfSelecaoPopover');
    if (!palco || !popSel) return;

    popSel.hidden = true;
    let ultimaSelecao = null; // { texto, numPag, range, folhaTextoEl }

    const verificarSelecaoTexto = () => {
      // Não exibe pílula flutuante se houver modal aberto na tela
      if (document.querySelector('.ath-modal-backdrop')) {
        popSel.hidden = true;
        return;
      }
      const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        popSel.hidden = true;
        return;
      }
      const texto = sel.toString().replace(/\s+/g, ' ').trim();
      if (texto.length < 2) {
        popSel.hidden = true;
        return;
      }

      const range = sel.getRangeAt(0);
      const containerEl = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      const folhaTextoEl = containerEl?.closest?.('.ath-pdf-folha-texto');
      if (!folhaTextoEl) {
        popSel.hidden = true;
        return;
      }

      const numPag = parseInt(folhaTextoEl.dataset.textoPag, 10) || 1;
      const folhaContainer = folhaTextoEl.closest('.ath-pdf-folha-container');
      const pagCitacao = folhaContainer?.dataset?.pagEditorial || String(numPag);
      this.definirPaginaAtivaSilencioso(numPag, root);
      ultimaSelecao = {
        texto,
        numPag,
        pagCitacao,
        range: range.cloneRange(),
        folhaTextoEl
      };

      const rectSel = range.getBoundingClientRect();
      const top = Math.max(12, rectSel.top - 48);
      const left = Math.max(180, Math.min(window.innerWidth - 180, rectSel.left + (rectSel.width / 2)));

      popSel.style.top = `${Math.round(top)}px`;
      popSel.style.left = `${Math.round(left)}px`;
      popSel.hidden = false;
    };

    palco.addEventListener('mouseup', () => setTimeout(verificarSelecaoTexto, 20));
    palco.addEventListener('keyup', () => setTimeout(verificarSelecaoTexto, 20));
    palco.addEventListener('scroll', () => { popSel.hidden = true; }, { passive: true });
    palco.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#athPdfSelecaoPopover')) {
        popSel.hidden = true;
      }
    });

    // 1. Grifar Trecho no Texto (funciona tanto em PDF real multi-span quanto em folha textual)
    popSel.querySelector('#athSelBtnGrifar').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const { numPag, range, folhaTextoEl } = ultimaSelecao;
      const folhaContainer = folhaTextoEl.closest('.ath-pdf-folha-container');
      const ehPdfReal = folhaTextoEl.classList.contains('ath-pdf-text-layer');
      const corGrifo = this.corTinta === '#314F79' ? 'rgba(250, 204, 21, 0.45)' : `${this.corTinta}55`;

      if (ehPdfReal && folhaContainer) {
        const rectFolha = folhaContainer.getBoundingClientRect();
        const rects = Array.from(range.getClientRects()).filter(r => r.width > 1 && r.height > 1);
        if (!art.fichamento.grifosPorPagina) art.fichamento.grifosPorPagina = {};
        if (!Array.isArray(art.fichamento.grifosPorPagina[numPag])) {
          art.fichamento.grifosPorPagina[numPag] = [];
        }
        rects.forEach(r => {
          art.fichamento.grifosPorPagina[numPag].push({
            xPct: Number((((r.left - rectFolha.left) / rectFolha.width) * 100).toFixed(2)),
            yPct: Number((((r.top - rectFolha.top) / rectFolha.height) * 100).toFixed(2)),
            wPct: Number(((r.width / rectFolha.width) * 100).toFixed(2)),
            hPct: Number(((r.height / rectFolha.height) * 100).toFixed(2)),
            cor: corGrifo
          });
        });
        this.renderizarGrifosRetangularesDaPagina(
          folhaContainer.querySelector(`[data-grifos-pag="${numPag}"]`),
          art,
          numPag
        );
        salvarArtigosEstudo(this.artigos);
      } else {
        try {
          const mark = document.createElement('mark');
          mark.className = 'ath-pdf-grifo-texto';
          mark.style.backgroundColor = corGrifo;
          range.surroundContents(mark);
          const colEl = folhaTextoEl.querySelector(`[data-colunas-pag="${numPag}"]`);
          if (colEl && paginasPdf[numPag - 1]) {
            paginasPdf[numPag - 1].htmlGrifado = colEl.innerHTML;
            salvarArtigosEstudo(this.artigos);
          }
        } catch (_) {}
      }
      window.getSelection()?.removeAllRanges();
      popSel.hidden = true;
    });

    // 2. + Citação Zotero (abre modal elegante preenchido com o trecho e a página)
    popSel.querySelector('#athSelBtnCitar').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const { texto, numPag, pagCitacao } = ultimaSelecao;
      popSel.hidden = true;
      window.getSelection()?.removeAllRanges();
      this.abrirModalCitacaoPdf(art, { pagina: numPag, paginaCitacao: pagCitacao, texto });
    });

    // 3. Criar Nota Adesiva na página com o trecho selecionado
    popSel.querySelector('#athSelBtnNota').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const { texto, numPag } = ultimaSelecao;
      popSel.hidden = true;
      window.getSelection()?.removeAllRanges();
      this.criarNotaAdesivaNaPagina(art, numPag, 58, 28, `"${texto.slice(0, 140)}"`, root);
    });

    // 4. Copiar ABNT direto
    popSel.querySelector('#athSelBtnCopiarAbnt').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ultimaSelecao) return;
      const formatada = `"${ultimaSelecao.texto}" ${formatarCitacaoAbntDoArtigo(art, ultimaSelecao.pagCitacao || ultimaSelecao.numPag)}`;
      navigator.clipboard?.writeText(formatada);
      const btn = popSel.querySelector('#athSelBtnCopiarAbnt span');
      if (btn) {
        btn.textContent = 'Copiado ✓';
        setTimeout(() => {
          btn.textContent = 'Copiar ABNT';
          popSel.hidden = true;
        }, 900);
      }
    });
  }

  /* ==========================================================================
     MODAL ELEGANTE PARA CRIAR OU EDITAR CITAÇÃO DO PDF (SEM WINDOW.PROMPT)
     ========================================================================== */
  abrirModalCitacaoPdf(art, dadosIniciais = {}) {
    // Esconde imediatamente o popover de seleção de texto para nunca sobrepor o modal
    const popSelAtivo = document.querySelector('#athPdfSelecaoPopover');
    if (popSelAtivo) popSelAtivo.hidden = true;

    const editandoId = dadosIniciais.id || null;
    const paginaPdfInicial = dadosIniciais.pagina || this.paginaAtual || 1;
    const folhaAtivaEl = this.container?.querySelector(`.ath-pdf-folha-container[data-num-pagina="${paginaPdfInicial}"]`);
    const paginaCitacaoInicial = dadosIniciais.paginaCitacao || folhaAtivaEl?.dataset?.pagEditorial || String(paginaPdfInicial);
    const textoInicial = dadosIniciais.texto || '';
    const comentarioInicial = dadosIniciais.comentario || '';
    const corInicial = dadosIniciais.cor || this.corTinta || '#314F79';

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:540px;">
        <div class="ath-modal-head">
          <h2>${editandoId ? 'Editar Citação do Fichamento' : 'Guardar Citação Direta no Zotero'}</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalCitFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Página da Citação (p. no Artigo / Revista)</label>
              <input type="text" class="ath-input" id="athModalCitPagina" value="${escapeHtml(paginaCitacaoInicial)}" placeholder="Ex.: 253 ou 17">
            </div>
            <div class="ath-prop-grupo">
              <label>Referência Gerada (ABNT)</label>
              <input type="text" class="ath-input" id="athModalCitPreviewAbnt" value="${escapeHtml(formatarCitacaoAbntDoArtigo(art, paginaCitacaoInicial))}" readonly style="background:#F8FAFC; font-weight:700; color:#314F79;">
            </div>
          </div>

          <div class="ath-prop-grupo">
            <label>Trecho Citado do Artigo</label>
            <textarea class="ath-input" id="athModalCitTexto" rows="4" placeholder="Cole ou digite o trecho exato do artigo...">${escapeHtml(textoInicial)}</textarea>
          </div>

          <div class="ath-prop-grupo">
            <label>Sua Nota / Onde Usar no Seu Artigo (Opcional)</label>
            <input type="text" class="ath-input" id="athModalCitComentario" value="${escapeHtml(comentarioInicial)}" placeholder="Ex.: Usar na seção de Metodologia para fundamentar...">
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalCitCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalCitSalvar">
            ${svgIcone('salvar', 14)} ${editandoId ? 'Salvar Alterações' : 'Salvar Citação no Fichamento'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalCitFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalCitCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const inputPag = modal.querySelector('#athModalCitPagina');
    const previewAbnt = modal.querySelector('#athModalCitPreviewAbnt');
    inputPag.addEventListener('input', () => {
      previewAbnt.value = formatarCitacaoAbntDoArtigo(art, inputPag.value.trim() || paginaPdfInicial);
    });

    modal.querySelector('#athModalCitSalvar').addEventListener('click', () => {
      const txt = modal.querySelector('#athModalCitTexto').value.trim();
      if (!txt) return;
      const pagCit = inputPag.value.trim() || String(paginaPdfInicial);
      const com = modal.querySelector('#athModalCitComentario').value.trim();

      if (!Array.isArray(art.fichamento.citacoesMarcadas)) {
        art.fichamento.citacoesMarcadas = [];
      }

      if (editandoId) {
        const alvo = art.fichamento.citacoesMarcadas.find(x => x.id === editandoId);
        if (alvo) {
          alvo.pagina = paginaPdfInicial;
          alvo.paginaCitacao = pagCit;
          alvo.texto = txt;
          alvo.comentario = com;
        }
      } else {
        art.fichamento.citacoesMarcadas.unshift({
          id: 'cit_' + Date.now().toString(36),
          pagina: paginaPdfInicial,
          paginaCitacao: pagCit,
          texto: txt,
          comentario: com,
          cor: corInicial,
          criadoEm: new Date().toISOString()
        });
      }

      salvarArtigosEstudo(this.artigos);
      this.abaDireita = 'citacoes';
      fechar();
      this.atualizarAbaCitacoesEContadores(art);
    });
  }

  atualizarAbaCitacoesEContadores(art) {
    if (!this.container) {
      this.renderizar();
      return;
    }
    const qtdCit = art.fichamento?.citacoesMarcadas?.length || 0;
    this.container.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.aba === this.abaDireita);
      if (btn.dataset.aba === 'citacoes') {
        btn.textContent = `Citações (${qtdCit})`;
      }
    });
    this.renderizarPainelDireitoEstudio(this.container.querySelector('#athEstudioPainelCorpo'), art);
    this.renderizarColunaEsquerdaEstudio(this.container.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
  }

  adicionarFolhaExtraNoPdf(art, paginasPdf) {
    const novoNum = paginasPdf.length + 1;
    paginasPdf.push({
      numero: novoNum,
      cabecalho: `${art.titulo.slice(0, 55)} · Folha de Anotações Manuscritas #${novoNum}`,
      titulo: `FOLHA DE RASCUNHO E ESQUEMAS VISUAIS (PÁGINA ${novoNum})`,
      autores: 'Espaço livre estilo Samsung Notes para esquemas, mapas mentais e linhas retas sobre o artigo',
      paragrafos: [
        'Use a Caneta, o Modo Linha Reta ou as Notas Adesivas acima para desenhar esquemas e fixar lembretes nesta folha complementar.'
      ]
    });
    art.totalPaginas = paginasPdf.length;
    this.paginaAtual = novoNum;
    salvarArtigosEstudo(this.artigos);
    this.renderizar();
    requestAnimationFrame(() => {
      this.rolarParaPagina(novoNum, this.container);
    });
  }

  /* ==========================================================================
     COLUNA ESQUERDA 50/50 COM .rm-card-meio-a-meio (IDÊNTICA À ESCRITA)
     ========================================================================== */
  renderizarColunaEsquerdaEstudio(colEsq, artAtivo, paginasPdf) {
    if (!colEsq) return;
    const artigosFiltrados = this.artigos.filter(a => {
      if (!this.filtroLateralEsq) return true;
      const str = `${a.titulo} ${(a.autores || []).map(x => x.sobrenome).join(' ')} ${a.ano}`.toLowerCase();
      return str.includes(this.filtroLateralEsq);
    });

    colEsq.innerHTML = `
      <!-- METADE SUPERIOR (50%): ARTIGOS DO ZOTERO -->
      <div class="rm-card-meio-a-meio">
        <div class="rm-card-meio-a-meio-topo">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:8px;">
            <strong style="font:800 11.5px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.06em;">
              Artigos do Zotero <span class="rm-contagem">(${this.artigos.length})</span>
            </strong>
            <div style="display:flex; gap:4px;">
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athEsqBtnSyncZotero" title="Sincronizar com Zotero API" style="height:24px; padding:0 8px; font-size:10.5px;">
                ${svgIcone('zotero', 11)} Sync
              </button>
              <button type="button" class="glx-btn glx-btn-primary glx-btn-xs" id="athEsqBtnNovoArtigo" title="Vincular novo artigo" style="height:24px; padding:0 8px; font-size:10.5px;">
                + Artigo
              </button>
            </div>
          </div>
          <div style="margin-bottom:8px;">
            <input type="search" id="athInputFiltroEsqArtigos" value="${escapeHtml(this.filtroLateralEsq)}" placeholder="Filtrar artigos da biblioteca..." style="height:32px; font-size:11.5px;">
          </div>
        </div>

        <div class="rm-card-meio-a-meio-corpo">
          ${artigosFiltrados.map((item, idx) => {
            const isAtivo = item.id === artAtivo.id;
            const qtdCit = item.fichamento?.citacoesMarcadas?.length || 0;
            return `
              <div class="rm-mestra-card ${isAtivo ? 'sel' : ''}" data-abrir-artigo-esq="${escapeHtml(item.id)}" style="display:flex; flex-direction:column; gap:4px; padding:8px 10px; border-radius:10px; border:1.5px solid ${isAtivo ? 'var(--ath-primary, #314F79)' : '#E2E8F0'}; background:${isAtivo ? '#EEF4FA' : '#FFFFFF'}; cursor:pointer; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:${isAtivo ? '#314F79' : '#E2E8F0'}; color:${isAtivo ? '#fff' : '#475569'}; font:800 10.5px var(--glx-font); flex:none;">
                    ${idx + 1}
                  </span>
                  <strong style="font-size:12px; font-weight:800; color:#1F2733; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;" title="${escapeHtml(item.titulo)}">
                    ${escapeHtml(item.titulo)}
                  </strong>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:2px;">
                  <span class="rm-selo" style="font-size:9.5px; padding:2px 7px;">${escapeHtml(formatarCitacaoAbntDoArtigo(item))}</span>
                  <span style="font-size:10.5px; color:#314F79; font-weight:700;">${qtdCit} citaç${qtdCit === 1 ? 'ão' : 'ões'}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- METADE INFERIOR (50%): PÁGINAS DO PDF & MARCAÇÕES -->
      <div class="rm-card-meio-a-meio">
        <div class="rm-card-meio-a-meio-topo">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:8px;">
            <strong style="font:800 11.5px var(--glx-font); color:var(--glx-muted, #6B7585); text-transform:uppercase; letter-spacing:.06em;">
              Páginas do PDF <span class="rm-contagem">(${paginasPdf.length})</span>
            </strong>
            <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athEsqBtnNovaFolha" style="height:24px; padding:0 9px; font-size:10.5px;">
              + Folha Extra
            </button>
          </div>
        </div>

        <div class="rm-card-meio-a-meio-corpo">
          <ul class="rm-blocos">
            ${paginasPdf.map((pg, idx) => {
              const numPag = idx + 1;
              const isPagAtiva = numPag === this.paginaAtual;
              const qtdRiscos = (artAtivo.fichamento?.tracosPorPagina?.[numPag] || []).length;
              const qtdNotas = (artAtivo.fichamento?.notasPagina?.[numPag] || []).length;
              const qtdCitsPag = (artAtivo.fichamento?.citacoesMarcadas || []).filter(c => c.pagina === numPag).length;
              return `
                <li class="rm-bl ${isPagAtiva ? 'sel' : ''}" data-ir-pagina-esq="${numPag}">
                  <button type="button" class="rm-bl-nome">
                    <strong>Página ${numPag} — ${escapeHtml((pg.titulo || 'Folha do Artigo').slice(0, 30))}</strong>
                    <span>${qtdRiscos} risco(s) · ${qtdNotas} nota(s) · ${qtdCitsPag} citação(ões)</span>
                  </button>
                  ${paginasPdf.length > 1 ? `
                    <div class="rm-bl-acoes">
                      <button type="button" class="rm-ic rm-ic-perigo" data-excluir-pag-pdf="${numPag}" title="Remover esta página">
                        ${svgIcone('fechar', 11)}
                      </button>
                    </div>
                  ` : ''}
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      </div>
    `;

    const inputFiltro = colEsq.querySelector('#athInputFiltroEsqArtigos');
    inputFiltro.addEventListener('input', () => {
      this.filtroLateralEsq = inputFiltro.value.trim().toLowerCase();
      this.renderizarColunaEsquerdaEstudio(colEsq, artAtivo, paginasPdf);
    });

    colEsq.querySelector('#athEsqBtnSyncZotero').addEventListener('click', () => {
      this.sincronizarComZoteroApi();
    });

    colEsq.querySelector('#athEsqBtnNovoArtigo').addEventListener('click', () => {
      this.abrirModalVincularArtigo();
    });

    colEsq.querySelector('#athEsqBtnNovaFolha').addEventListener('click', () => {
      this.adicionarFolhaExtraNoPdf(artAtivo, paginasPdf);
    });

    colEsq.querySelectorAll('[data-abrir-artigo-esq]').forEach(card => {
      card.addEventListener('click', () => {
        const alvo = this.artigos.find(a => a.id === card.dataset.abrirArtigoEsq);
        if (alvo && alvo.id !== artAtivo.id) {
          this.abrirArtigoNoEstudio(alvo);
        }
      });
    });

    colEsq.querySelectorAll('[data-ir-pagina-esq]').forEach(li => {
      li.addEventListener('click', (e) => {
        if (e.target.closest('[data-excluir-pag-pdf]')) return;
        const pg = parseInt(li.dataset.irPaginaEsq, 10) || 1;
        this.rolarParaPagina(pg, this.container);
      });
    });

    colEsq.querySelectorAll('[data-excluir-pag-pdf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (paginasPdf.length <= 1) return;
        const pgDel = parseInt(btn.dataset.excluirPagPdf, 10);
        artAtivo.conteudoPaginasPdf = paginasPdf.filter((_, i) => (i + 1) !== pgDel);
        artAtivo.totalPaginas = artAtivo.conteudoPaginasPdf.length;
        if (this.paginaAtual > artAtivo.totalPaginas) this.paginaAtual = artAtivo.totalPaginas;
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
      });
    });
  }

  /* ==========================================================================
     POPOVERS DE TOPO DO ESTÚDIO (ZOTERO API, GOOGLE DRIVE E CANETA)
     ========================================================================== */
  configurarPopoversTopoEstudio(root, art) {
    const popZot = root.querySelector('#athPopoverEstZotero');
    const popDrive = root.querySelector('#athPopoverEstDrive');
    const popCaneta = root.querySelector('#athPopoverEstCaneta');

    if (popZot) {
      popZot.innerHTML = `
        <div class="rm-popover-head">
          <strong>Conexão Zotero Web API v3</strong>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>
        <div class="rm-popover-body">
          <label>Zotero API Key (Chave Privada)
            <input type="text" id="athPopZoteroKeyInput" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Ex.: KNEYoy8RTMlkaTuHx5WPc3bH">
          </label>
          <label>Zotero User ID (opcional — detectado pela Key)
            <input type="text" id="athPopZoteroUserInput" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="Ex.: 18806479">
          </label>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="glx-btn glx-btn-primary glx-btn-sm" id="athBtnPopTestarESincronizarZot" style="flex:1; justify-content:center;">
              Conectar & Sincronizar Zotero
            </button>
          </div>
          <div id="athPopZoteroStatusMsg" style="font-size:11.5px; font-weight:700; color:#15803D;"></div>
        </div>
      `;

      popZot.querySelector('#athBtnPopTestarESincronizarZot').addEventListener('click', async () => {
        const k = popZot.querySelector('#athPopZoteroKeyInput').value.trim();
        const u = popZot.querySelector('#athPopZoteroUserInput').value.trim();
        const msgEl = popZot.querySelector('#athPopZoteroStatusMsg');
        this.salvarConfigZotero({ apiKey: k, userId: u });
        msgEl.style.color = '#314F79';
        msgEl.textContent = 'Verificando chave na API do Zotero...';
        const teste = await this.zoteroClient.testarConexao();
        if (teste.ok) {
          this.salvarConfigZotero({ apiKey: k, userId: teste.usuarioId, username: teste.nomeUsuario });
          popZot.querySelector('#athPopZoteroUserInput').value = teste.usuarioId || '';
          msgEl.style.color = '#15803D';
          msgEl.textContent = `Conectado como ${teste.nomeUsuario} (ID #${teste.usuarioId})! Sincronizando...`;
          await this.sincronizarComZoteroApi({ silencioso: true });
          this.renderizar();
        } else {
          msgEl.style.color = '#B42318';
          msgEl.textContent = teste.mensagem || 'Não foi possível validar a chave.';
        }
      });
    }

    if (popDrive) {
      const cfgDrive = obterConfigGoogleDrive();
      const driveConectado = Boolean(cfgDrive.accessToken);
      popDrive.innerHTML = `
        <div class="rm-popover-head">
          <strong>Conexão & PDF no Google Drive</strong>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>
        <div class="rm-popover-body">
          <label>Link da Pasta no Google Drive (onde ficam seus PDFs)
            <input type="text" id="athPopDrivePastaInput" value="${escapeHtml(cfgDrive.pastaUrl || '')}" placeholder="Ex.: https://drive.google.com/drive/folders/1ABCxyz...">
          </label>
          ${cfgDrive.pastaUrl ? `
            <div style="margin-bottom:8px;">
              <a href="${cfgDrive.pastaUrl}" target="_blank" rel="noopener noreferrer" class="ath-btn ath-btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; color:#2563EB; text-decoration:none; height:28px;">
                ${svgIcone('drive', 13)} Abrir Pasta no Google Drive Web ↗
              </a>
            </div>
          ` : ''}
          <label>Google OAuth Client ID (Opcional)
            <input type="text" id="athPopDriveClientIdInput" value="${escapeHtml(cfgDrive.clientId || '')}">
          </label>
          <button type="button" class="glx-btn ${driveConectado ? 'ath-btn-zotero-ok' : 'glx-btn-primary'} glx-btn-sm" id="athBtnPopAutenticarDrive" style="width:100%; justify-content:center; margin-bottom:6px;">
            ${svgIcone('drive', 13)} ${driveConectado ? 'Google Drive Conectado ✓ (Reconectar)' : 'Autorizar / Conectar meu Google Drive'}
          </button>
          <div id="athPopDriveStatusMsg" style="font-size:11.5px; font-weight:700; color:#15803D;"></div>
          <hr class="rm-popover-div">
          <label>Nome do PDF no Google Drive
            <input type="text" id="athPopDriveNomeInput" value="${escapeHtml(art.driveFileName || '')}">
          </label>
          <label>ID ou Link do Arquivo no Drive
            <input type="text" id="athPopDriveIdInput" value="${escapeHtml(art.driveFileId || '')}" placeholder="ID do arquivo no Google Drive">
          </label>
          <div style="font-size:11px; color:#64748B;">
            O PDF não é enviado ao Zotero: ele permanece no seu Google Drive e é lido/anotado diretamente aqui.
          </div>
        </div>
      `;
      popDrive.querySelector('#athPopDrivePastaInput')?.addEventListener('change', e => {
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), pastaUrl: e.target.value.trim() });
      });
      popDrive.querySelector('#athPopDriveClientIdInput').addEventListener('change', e => {
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), clientId: e.target.value.trim() });
      });
      popDrive.querySelector('#athBtnPopAutenticarDrive').addEventListener('click', async () => {
        const cid = popDrive.querySelector('#athPopDriveClientIdInput').value.trim();
        const msgEl = popDrive.querySelector('#athPopDriveStatusMsg');
        salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), clientId: cid });
        msgEl.style.color = '#314F79';
        msgEl.textContent = 'Abrindo janela oficial de login do Google...';
        try {
          await autenticarGoogleDrive(cid);
          msgEl.style.color = '#15803D';
          msgEl.textContent = 'Google Drive conectado com sucesso! ✓';
          this.renderizar();
        } catch (err) {
          msgEl.style.color = '#B42318';
          msgEl.textContent = `Atenção: ${err.message || 'Autorize o domínio athenes.vercel.app no Google Cloud Console.'}`;
        }
      });
      popDrive.querySelector('#athPopDriveNomeInput').addEventListener('change', e => {
        art.driveFileName = e.target.value.trim();
        salvarArtigosEstudo(this.artigos);
      });
      popDrive.querySelector('#athPopDriveIdInput').addEventListener('change', e => {
        art.driveFileId = e.target.value.trim();
        salvarArtigosEstudo(this.artigos);
      });
    }

    if (popCaneta) {
      popCaneta.innerHTML = `
        <div class="rm-popover-head">
          <strong>Ajustes da Caneta & Zoom da Folha</strong>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>
        <div class="rm-popover-body">
          <label>Espessura do Traço da Caneta
            <select id="athSelectEspessuraTinta" class="glx-select">
              <option value="2" ${this.espessuraTinta === 2 ? 'selected' : ''}>Fina (2 px)</option>
              <option value="3" ${this.espessuraTinta === 3 ? 'selected' : ''}>Média (3 px)</option>
              <option value="6" ${this.espessuraTinta === 6 ? 'selected' : ''}>Forte (6 px)</option>
              <option value="10" ${this.espessuraTinta === 10 ? 'selected' : ''}>Pincel Largo (10 px)</option>
            </select>
          </label>
          <label>Escala / Zoom das Folhas PDF (${this.zoomPct}%)
            <div style="display:flex; gap:6px;">
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athZoomMenos">- 10%</button>
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athZoom100">100%</button>
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athZoomMais">+ 10%</button>
            </div>
          </label>
        </div>
      `;
      popCaneta.querySelector('#athSelectEspessuraTinta').addEventListener('change', e => {
        this.espessuraTinta = parseInt(e.target.value, 10) || 3;
      });
      popCaneta.querySelector('#athZoomMenos').addEventListener('click', () => {
        this.zoomPct = Math.max(70, this.zoomPct - 10);
        this.renderizar();
      });
      popCaneta.querySelector('#athZoom100').addEventListener('click', () => {
        this.zoomPct = 100;
        this.renderizar();
      });
      popCaneta.querySelector('#athZoomMais').addEventListener('click', () => {
        this.zoomPct = Math.min(140, this.zoomPct + 10);
        this.renderizar();
      });
    }

    root.querySelectorAll('[data-menu-est]').forEach(item => {
      const btn = item.querySelector('.rm-btn-menu-topo');
      const pop = item.querySelector('.rm-topo-popover');
      if (!btn || !pop) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const jaAberto = !pop.hidden;
        root.querySelectorAll('.rm-topo-popover').forEach(p => { p.hidden = true; });
        root.querySelectorAll('.rm-btn-menu-topo').forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (!jaAberto) {
          pop.hidden = false;
          btn.setAttribute('aria-expanded', 'true');
        }
      });
      pop.addEventListener('click', e => e.stopPropagation());
    });

    root.querySelectorAll('[data-fechar-pop-est]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.rm-topo-popover').forEach(p => { p.hidden = true; });
        root.querySelectorAll('.rm-btn-menu-topo').forEach(b => b.setAttribute('aria-expanded', 'false'));
      });
    });
  }

  rotuloFerramenta(tool) {
    const map = {
      cursor: 'Selecionar Texto (Grifar / Citar)',
      caneta: 'Caneta de Risco',
      marcatexto: 'Marca-Texto Translúcido',
      borracha: 'Borracha de Traços',
      nota: 'Fixar Nota Adesiva Editável'
    };
    return map[tool] || tool;
  }

  /* ==========================================================================
     MOTOR DE TINTA DIGITAL + MODO LINHA RETA EM CANVAS (POR PÁGINA)
     ========================================================================== */
  inicializarCanvasTinta(canvas, art, numPag, root) {
    if (!canvas) return;
    if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
    if (!Array.isArray(art.fichamento.tracosPorPagina[numPag])) {
      art.fichamento.tracosPorPagina[numPag] = [];
    }

    this.redesenharCanvasTinta(canvas, art, numPag);

    let desenhando = false;
    let tracoAtual = null;
    let pontoInicialReta = null;
    let rectCache = null;
    let rafDesenhoPendente = false;

    const agendarRedesenho = () => {
      if (rafDesenhoPendente) return;
      rafDesenhoPendente = true;
      requestAnimationFrame(() => {
        rafDesenhoPendente = false;
        this.redesenharCanvasTinta(canvas, art, numPag);
      });
    };

    const obterPosicaoNoCanvas = (ev) => {
      const rect = rectCache || canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: Math.round((ev.clientX - rect.left) * scaleX),
        y: Math.round((ev.clientY - rect.top) * scaleY),
        xPct: Math.max(4, Math.min(68, Math.round(((ev.clientX - rect.left) / rect.width) * 100))),
        yPct: Math.max(4, Math.min(82, Math.round(((ev.clientY - rect.top) / rect.height) * 100)))
      };
    };

    canvas.addEventListener('pointerdown', (ev) => {
      if (this.ferramentaAtiva === 'cursor') return;
      this.definirPaginaAtivaSilencioso(numPag, root);
      rectCache = canvas.getBoundingClientRect();
      const pos = obterPosicaoNoCanvas(ev);

      // Se a ferramenta for "Nota Adesiva", cria o card editável diretamente no ponto clicado (sem window.prompt)
      if (this.ferramentaAtiva === 'nota') {
        this.criarNotaAdesivaNaPagina(art, numPag, pos.xPct, pos.yPct, '', root);
        return;
      }

      if (this.ferramentaAtiva === 'borracha') {
        desenhando = true;
        this.apagarTracosProximos(art, numPag, pos.x, pos.y);
        agendarRedesenho();
        return;
      }

      // Caneta ou Marca-texto (livre ou Linha Reta)
      desenhando = true;
      canvas.setPointerCapture?.(ev.pointerId);
      pontoInicialReta = { x: pos.x, y: pos.y };
      tracoAtual = {
        tipo: this.ferramentaAtiva === 'marcatexto' ? 'marcatexto' : 'caneta',
        reta: Boolean(this.modoLinhaReta || ev.shiftKey),
        cor: this.ferramentaAtiva === 'marcatexto' && this.corTinta === '#314F79' ? '#FACC15' : this.corTinta,
        espessura: this.ferramentaAtiva === 'marcatexto' ? 18 : this.espessuraTinta,
        pontos: [{ x: pos.x, y: pos.y }]
      };
      art.fichamento.tracosPorPagina[numPag].push(tracoAtual);
      agendarRedesenho();
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!desenhando) return;
      const pos = obterPosicaoNoCanvas(ev);
      if (this.ferramentaAtiva === 'borracha') {
        this.apagarTracosProximos(art, numPag, pos.x, pos.y);
        agendarRedesenho();
        return;
      }
      if (!tracoAtual) return;

      // Se Modo Linha Reta estiver ativo ou tecla Shift pressionada, desenha segmento reto com trava ortogonal (0°/90°)
      if (this.modoLinhaReta || ev.shiftKey || tracoAtual.reta) {
        const pFim = calcularPontoFinalLinhaReta(pontoInicialReta, pos, 6);
        tracoAtual.pontos = [
          { x: pontoInicialReta.x, y: pontoInicialReta.y },
          { x: pFim.x, y: pFim.y }
        ];
      } else {
        tracoAtual.pontos.push({ x: pos.x, y: pos.y });
      }
      agendarRedesenho();
    });

    const finalizarTraco = () => {
      if (!desenhando) return;
      desenhando = false;
      tracoAtual = null;
      pontoInicialReta = null;
      rectCache = null;
      this.redesenharCanvasTinta(canvas, art, numPag);
      salvarArtigosEstudoDebounced(this.artigos, 180);
      if (root) {
        this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, art.conteudoPaginasPdf);
      }
    };

    canvas.addEventListener('pointerup', finalizarTraco);
    canvas.addEventListener('pointercancel', finalizarTraco);
  }

  apagarTracosProximos(art, numPag, x, y, raio = 24) {
    const lista = art.fichamento?.tracosPorPagina?.[numPag];
    if (!Array.isArray(lista)) return;
    art.fichamento.tracosPorPagina[numPag] = lista.filter(traco => {
      const pts = traco.pontos || [];
      if (pts.length === 2) {
        // Verifica distância ponto-segmento para linhas retas
        const [a, b] = pts;
        const l2 = Math.hypot(b.x - a.x, b.y - a.y) ** 2;
        if (l2 === 0) return Math.hypot(x - a.x, y - a.y) > raio;
        const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / l2));
        const projX = a.x + t * (b.x - a.x);
        const projY = a.y + t * (b.y - a.y);
        return Math.hypot(x - projX, y - projY) > raio;
      }
      return !pts.some(pt => Math.hypot(pt.x - x, pt.y - y) <= raio);
    });
  }

  redesenharCanvasTinta(canvas, art, numPag = this.paginaAtual) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tracos = art.fichamento?.tracosPorPagina?.[numPag] || [];
    tracos.forEach(tr => {
      const pts = tr.pontos || [];
      if (pts.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tr.cor || '#314F79';
      ctx.lineWidth = tr.espessura || 3;
      ctx.globalAlpha = tr.tipo === 'marcatexto' ? 0.36 : 0.92;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.5, pts[0].y + 0.5);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ==========================================================================
     PAINEL LATERAL DIREITO DO ESTÚDIO: RESUMO, CITAÇÕES E VÍNCULO ZOTERO+DRIVE
     ========================================================================== */
  renderizarPainelDireitoEstudio(box, art) {
    if (!box) return;
    box.innerHTML = '';

    const f = art.fichamento;

    // Coleta todas as notas adesivas fixadas em todas as páginas do PDF
    const todasNotasPdf = [];
    const notasPagObj = f.notasPagina || {};
    Object.keys(notasPagObj).sort((a, b) => Number(a) - Number(b)).forEach(pgKey => {
      const numPag = parseInt(pgKey, 10) || 1;
      (notasPagObj[pgKey] || []).forEach((pin, idx) => {
        todasNotasPdf.push({ numPag, idx: idx + 1, pin });
      });
    });

    if (this.abaDireita === 'resumo') {
      box.innerHTML = `
        <div class="ath-fichamento-bloco">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong class="ath-fichamento-rotulo" style="margin-bottom:0;">Notas Fixadas no PDF (${todasNotasPdf.length})</strong>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnNovaNotaLateral" style="height:24px; padding:0 9px; font-size:11px;">+ Nova Nota</button>
          </div>

          <div class="ath-lista-citacoes-pdf" style="margin-bottom:14px;">
            ${todasNotasPdf.length === 0 ? `
              <div style="padding:12px; text-align:center; color:#64748B; font-size:11.5px; background:#F8FAFC; border-radius:10px; border:1px dashed #CBD5E1;">
                Nenhuma nota fixada nas páginas ainda. Clique em <b>+ Nova Nota</b> ou use a ferramenta <b>Nota</b> na barra superior.
              </div>
            ` : todasNotasPdf.map(({ numPag, idx, pin }) => `
              <div class="ath-citacao-pdf-card" style="border-left: 4px solid ${escapeHtml(pin.cor || '#F59E0B')}; padding:8px 10px;">
                <div class="ath-citacao-pdf-topo" style="margin-bottom:4px;">
                  <span class="ath-citacao-pag-badge" data-ir-nota-pag="${numPag}" data-ir-nota-id="${escapeHtml(pin.id)}" title="Ir até esta nota na Página ${numPag}" style="display:inline-flex; align-items:center; gap:4px;">
                    ${svgIcone('nota', 11)} Pág. ${numPag} · #${idx} ${escapeHtml(pin.titulo || 'Nota')}
                  </span>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="ath-pin-ic-acao ath-pin-ic-neutro" data-min-nota-lat="${escapeHtml(pin.id)}" data-min-nota-pag="${numPag}" title="${pin.minimizado ? 'Expandir nota na folha' : 'Minimizar nota na folha'}" style="width:22px; height:22px;">
                      ${svgIcone(pin.minimizado ? 'mais' : 'minimizar', 11)}
                    </button>
                    <button type="button" class="ath-pin-ic-acao ath-pin-ic-neutro" data-edit-nota-lat="${escapeHtml(pin.id)}" data-edit-nota-pag="${numPag}" title="Editar esta nota" style="width:22px; height:22px;">
                      ${svgIcone('lapis', 11)}
                    </button>
                    <button type="button" class="ath-pin-ic-acao ath-pin-ic-perigo" data-del-nota-lat="${escapeHtml(pin.id)}" data-del-nota-pag="${numPag}" title="Excluir nota" style="width:22px; height:22px;">
                      ${svgIcone('lixeira', 11)}
                    </button>
                  </div>
                </div>
                <div style="font-size:11.5px; color:#1E293B; line-height:1.38; cursor:pointer;" data-edit-nota-lat="${escapeHtml(pin.id)}" data-edit-nota-pag="${numPag}">
                  ${escapeHtml(pin.texto || 'Sem texto (clique para editar)')}
                </div>
              </div>
            `).join('')}
          </div>

          <label class="ath-fichamento-rotulo">Resumo Oficial do Artigo (Zotero)</label>
          <div class="ath-fichamento-resumo-orig">${escapeHtml(art.resumoOriginal || 'Sem resumo cadastrado no Zotero.')}</div>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Meu Resumo & Síntese Crítica</label>
          <textarea id="athEstudoResumoPessoal" class="ath-input" rows="5" placeholder="Escreva aqui o seu resumo do artigo, principais teses do autor e como ele dialoga com sua pesquisa...">${escapeHtml(f.resumoPessoal || '')}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Análise Metodológica & Anotações Livres</label>
          <textarea id="athEstudoMetodoNotas" class="ath-input" rows="4" placeholder="Anote parâmetros, equações, dados estatísticos ou críticas metodológicas...">${escapeHtml(f.metodologiaNotas || '')}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Tags / Palavras-Chave (Zotero)</label>
          <input type="text" id="athEstudoTagsInput" class="ath-input" value="${escapeHtml((art.palavrasChave || []).join(', '))}" placeholder="Ex.: REURB, Morfologia, SIG">
        </div>
      `;

      box.querySelector('#athBtnNovaNotaLateral').addEventListener('click', () => {
        const pg = this.paginaAtual || 1;
        this.rolarParaPagina(pg, this.container);
        this.criarNotaAdesivaNaPagina(art, pg, 52, 24, '', this.container);
      });

      box.querySelectorAll('[data-ir-nota-pag]').forEach(el => {
        el.addEventListener('click', () => {
          const pg = parseInt(el.dataset.irNotaPag, 10) || 1;
          this.rolarParaPagina(pg, this.container);
        });
      });

      box.querySelectorAll('[data-edit-nota-lat]').forEach(el => {
        el.addEventListener('click', () => {
          const pg = parseInt(el.dataset.editNotaPag, 10) || 1;
          const pinId = el.dataset.editNotaLat;
          const lista = art.fichamento.notasPagina?.[pg] || [];
          const alvo = lista.find(p => p.id === pinId);
          if (alvo) alvo.minimizado = false;
          this.pinEditandoId = pinId;
          this.rolarParaPagina(pg, this.container);
          const layer = this.container?.querySelector(`[data-pins-pag="${pg}"]`);
          this.renderizarPinsDaPagina(layer, art, pg, this.container);
        });
      });

      box.querySelectorAll('[data-min-nota-lat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pg = parseInt(btn.dataset.minNotaPag, 10) || 1;
          const pinId = btn.dataset.minNotaLat;
          const lista = art.fichamento.notasPagina?.[pg] || [];
          const alvo = lista.find(p => p.id === pinId);
          if (alvo) {
            alvo.minimizado = !alvo.minimizado;
            if (alvo.minimizado && this.pinEditandoId === pinId) this.pinEditandoId = null;
            salvarArtigosEstudo(this.artigos);
            const layer = this.container?.querySelector(`[data-pins-pag="${pg}"]`);
            this.renderizarPinsDaPagina(layer, art, pg, this.container);
            this.atualizarPaineisLateraisDeNotas(this.container, art);
          }
        });
      });

      box.querySelectorAll('[data-del-nota-lat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pg = parseInt(btn.dataset.delNotaPag, 10) || 1;
          const pinId = btn.dataset.delNotaLat;
          if (art.fichamento.notasPagina?.[pg]) {
            art.fichamento.notasPagina[pg] = art.fichamento.notasPagina[pg].filter(p => p.id !== pinId);
            if (this.pinEditandoId === pinId) this.pinEditandoId = null;
            salvarArtigosEstudo(this.artigos);
            const layer = this.container?.querySelector(`[data-pins-pag="${pg}"]`);
            this.renderizarPinsDaPagina(layer, art, pg, this.container);
            this.atualizarPaineisLateraisDeNotas(this.container, art);
          }
        });
      });

      box.querySelector('#athEstudoResumoPessoal').addEventListener('input', e => {
        f.resumoPessoal = e.target.value;
        salvarArtigosEstudoDebounced(this.artigos);
      });

      box.querySelector('#athEstudoMetodoNotas').addEventListener('input', e => {
        f.metodologiaNotas = e.target.value;
        salvarArtigosEstudoDebounced(this.artigos);
      });

      box.querySelector('#athEstudoTagsInput').addEventListener('change', e => {
        art.palavrasChave = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        salvarArtigosEstudo(this.artigos);
      });
      return;
    }

    if (this.abaDireita === 'citacoes') {
      const citacoes = f.citacoesMarcadas || [];
      box.innerHTML = `
        <div class="ath-fichamento-bloco">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:11.5px; color:#314F79; text-transform:uppercase;">Citações Marcadas (${citacoes.length})</strong>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnNovaCitacaoPainel">+ Nova Citação</button>
          </div>

          <div class="ath-lista-citacoes-pdf">
            ${citacoes.length === 0 ? `
              <div style="padding:20px 12px; text-align:center; color:#64748B; font-size:12px; background:#F8FAFC; border-radius:10px; border:1px dashed #CBD5E1;">
                Selecione qualquer frase no PDF ao lado para abrir o menu flutuante e clique em <b>+ Citação Zotero</b>.
              </div>
            ` : citacoes.map(c => `
              <div class="ath-citacao-pdf-card" style="border-left: 4px solid ${escapeHtml(c.cor || '#314F79')};">
                <div class="ath-citacao-pdf-topo">
                  <span class="ath-citacao-pag-badge" data-ir-pag="${escapeHtml(c.pagina)}" title="Rolar até a página ${escapeHtml(c.pagina)} do PDF">
                    Pág. PDF ${escapeHtml(c.pagina)}${c.paginaCitacao && String(c.paginaCitacao) !== String(c.pagina) ? ` · p. ${escapeHtml(c.paginaCitacao)}` : ''}
                  </span>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="ath-btn ath-btn-sm" data-edit-cit="${escapeHtml(c.id)}" title="Editar esta citação" style="height:22px; padding:0 7px; font-size:10.5px;">✎ Editar</button>
                    <button type="button" class="ath-btn ath-btn-sm" data-copiar-cit="${escapeHtml(c.id)}" style="height:22px; padding:0 7px; font-size:10.5px;">Copiar ABNT</button>
                    <button type="button" class="ath-btn ath-btn-sm" data-del-cit="${escapeHtml(c.id)}" style="height:22px; padding:0 6px; font-size:10.5px; color:#B42318;">✕</button>
                  </div>
                </div>
                <blockquote class="ath-citacao-pdf-texto">"${escapeHtml(c.texto)}"</blockquote>
                <div class="ath-citacao-pdf-ref">${escapeHtml(formatarCitacaoAbntDoArtigo(art, c.paginaCitacao || c.pagina))}</div>
                ${c.comentario ? `<div class="ath-citacao-pdf-nota">💡 ${escapeHtml(c.comentario)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;

      box.querySelector('#athBtnNovaCitacaoPainel').addEventListener('click', () => {
        this.abrirModalCitacaoPdf(art, { pagina: this.paginaAtual });
      });

      box.querySelectorAll('[data-ir-pag]').forEach(el => {
        el.addEventListener('click', () => {
          const pg = parseInt(el.dataset.irPag, 10) || 1;
          this.rolarParaPagina(pg, this.container);
        });
      });

      box.querySelectorAll('[data-edit-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = citacoes.find(x => x.id === btn.dataset.editCit);
          if (c) this.abrirModalCitacaoPdf(art, c);
        });
      });

      box.querySelectorAll('[data-copiar-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = citacoes.find(x => x.id === btn.dataset.copiarCit);
          if (!c) return;
          const formatada = `"${c.texto}" ${formatarCitacaoAbntDoArtigo(art, c.paginaCitacao || c.pagina)}`;
          navigator.clipboard?.writeText(formatada);
          btn.textContent = 'Copiado ✓';
          setTimeout(() => { btn.textContent = 'Copiar ABNT'; }, 1400);
        });
      });

      box.querySelectorAll('[data-del-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          f.citacoesMarcadas = citacoes.filter(x => x.id !== btn.dataset.delCit);
          salvarArtigosEstudo(this.artigos);
          this.atualizarAbaCitacoesEContadores(art);
        });
      });
      return;
    }

    // Aba 3: Vínculo Zotero & Google Drive
    const cfgDrivePainel = obterConfigGoogleDrive();
    const driveConectadoPainel = Boolean(cfgDrivePainel.accessToken);
    box.innerHTML = `
      <div class="ath-fichamento-bloco">
        <div style="padding:10px 12px; border-radius:12px; background:#F8FAFC; border:1px solid #CBD5E1; margin-bottom:10px;">
          <strong style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#1F2733; text-transform:uppercase; margin-bottom:6px;">
            ${svgIcone('zotero', 13)} Vínculo de Metadados com o Zotero
          </strong>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnVincularRefExistenteZotero" style="width:100%; justify-content:center; margin-bottom:8px;">
            ${svgIcone('zotero', 13)} Vincular a uma Referência já existente do Zotero
          </button>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Sua Zotero API Key
            <input type="text" class="ath-input" id="athDirZoteroApiKey" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Ex.: KNEYoy8RTMlkaTuHx5WPc3bH" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Seu Zotero User ID (ex.: 18806479)
            <input type="text" class="ath-input" id="athDirZoteroUserId" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="Auto-detectado pela API Key" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Chave deste Item no Zotero (Item Key)
            <input type="text" class="ath-input" id="athZoteroKeyArtigo" value="${escapeHtml(art.chaveZotero || '')}" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block;">DOI / Identificador Permanente
            <input type="text" class="ath-input" id="athDoiArtigo" value="${escapeHtml(art.doi || '')}" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
        </div>

        <div style="padding:10px 12px; border-radius:12px; background:#EEF4FA; border:1px solid #C8D7E6; margin-bottom:10px;">
          <strong style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#314F79; text-transform:uppercase; margin-bottom:6px;">
            ${svgIcone('drive', 13)} Selecionar & Vincular PDF (Google Drive / Local)
          </strong>
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
            <label class="ath-btn ath-btn-primary ath-btn-sm" style="width:100%; justify-content:center; cursor:pointer;">
              ${svgIcone('upload', 13)} Selecionar Arquivo PDF (Computador / Pasta Drive)
              <input type="file" accept=".pdf,application/pdf" id="athPainelInputArquivoPdf" style="display:none;">
            </label>
            <div style="display:flex; gap:6px;">
              <button type="button" class="ath-btn ath-btn-sm" id="athBtnPainelEscolherPdfDrive" style="flex:1; justify-content:center;">
                ${svgIcone('drive', 13)} Buscar PDF no Google Drive
              </button>
              <button type="button" class="ath-btn ${driveConectadoPainel ? 'ath-btn-zotero-ok' : ''} ath-btn-sm" id="athBtnPainelConectarDrive" title="Conectar conta do Google Drive">
                ${driveConectadoPainel ? 'Drive OK ✓' : 'Conectar Drive'}
              </button>
            </div>
          </div>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Arquivo PDF Selecionado
            <input type="text" class="ath-input" id="athDriveNomeArqArtigo" value="${escapeHtml(art.driveFileName || '')}" placeholder="Ex.: Silva_2026_Planejamento.pdf" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block;">ID / Link do PDF no Google Drive
            <input type="text" class="ath-input" id="athDriveIdArqArtigo" value="${escapeHtml(art.driveFileId || '')}" placeholder="Preenchido ao escolher do Google Drive" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
        </div>

        <button type="button" class="ath-btn ath-btn-primary" id="athBtnSyncCompletoPainel" style="width:100%; justify-content:center;">
          ${svgIcone('salvar', 14)} Sincronizar Agora (Zotero + Drive + Supabase)
        </button>
        <div id="athStatusSyncArtigo" style="font-size:11.5px; margin-top:8px; color:#15803D; font-weight:700;"></div>
      </div>
    `;

    box.querySelector('#athBtnVincularRefExistenteZotero').addEventListener('click', () => {
      this.abrirModalEscolherReferenciaZotero(art);
    });

    box.querySelector('#athPainelInputArquivoPdf')?.addEventListener('change', async e => {
      const fPdf = e.target.files?.[0];
      if (!fPdf) return;
      registrarPdfLocalNoArtigo(art, fPdf);
      salvarArtigosEstudo(this.artigos);
      const statusEl = box.querySelector('#athStatusSyncArtigo');
      if (statusEl) {
        statusEl.style.color = '#15803D';
        statusEl.textContent = `PDF "${fPdf.name}" carregado na folha!`;
      }
      if (cfgDrivePainel.accessToken) {
        try {
          const salvo = await salvarArquivoNoGoogleDrive({
            nomeArquivo: fPdf.name,
            conteudoBlobOuTexto: fPdf,
            mimeType: 'application/pdf',
            accessToken: cfgDrivePainel.accessToken,
            driveFileId: art.driveFileId || null
          });
          if (salvo?.id) {
            art.driveFileId = salvo.id;
            salvarArtigosEstudo(this.artigos);
          }
        } catch (_) {}
      }
      this.renderizar();
    });

    box.querySelector('#athBtnPainelEscolherPdfDrive')?.addEventListener('click', () => {
      this.abrirModalEscolherPdfDoGoogleDrive((arqDrive) => {
        art.driveFileName = arqDrive.name;
        art.driveFileId = arqDrive.id;
        art.pdfBlobUrl = null;
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
        garantirPdfDoArtigo(art).then(ok => { if (ok) this.renderizar(); });
      });
    });

    box.querySelector('#athBtnPainelConectarDrive').addEventListener('click', async () => {
      const statusEl = box.querySelector('#athStatusSyncArtigo');
      statusEl.style.color = '#314F79';
      statusEl.textContent = 'Abrindo janela de autorização do Google Drive...';
      try {
        await autenticarGoogleDrive(cfgDrivePainel.clientId);
        statusEl.style.color = '#15803D';
        statusEl.textContent = 'Google Drive conectado com sucesso! ✓';
        this.renderizar();
      } catch (err) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = `Atenção: ${err.message || 'Verifique se https://athenes.vercel.app está em Origens JavaScript autorizadas.'}`;
      }
    });

    box.querySelector('#athDirZoteroApiKey').addEventListener('change', e => {
      this.salvarConfigZotero({ apiKey: e.target.value.trim() });
    });
    box.querySelector('#athDirZoteroUserId').addEventListener('change', e => {
      this.salvarConfigZotero({ userId: e.target.value.trim() });
    });
    box.querySelector('#athDriveNomeArqArtigo').addEventListener('change', e => {
      art.driveFileName = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athDriveIdArqArtigo').addEventListener('change', e => {
      art.driveFileId = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athZoteroKeyArtigo').addEventListener('change', e => {
      art.chaveZotero = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athDoiArtigo').addEventListener('change', e => {
      art.doi = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athBtnSyncCompletoPainel').addEventListener('click', () => {
      const apiKeyIn = box.querySelector('#athDirZoteroApiKey')?.value.trim();
      const userIdIn = box.querySelector('#athDirZoteroUserId')?.value.trim();
      if (apiKeyIn !== undefined) this.salvarConfigZotero({ apiKey: apiKeyIn, userId: userIdIn });
      this.sincronizarArtigoComDriveEZotero(art, box.querySelector('#athBtnSyncCompletoPainel'), box.querySelector('#athStatusSyncArtigo'));
    });
  }

  /* ==========================================================================
     MODAL DE CONFIGURAÇÃO RÁPIDA DE CREDENCIAIS DO ZOTERO (API KEY + USER ID)
     ========================================================================== */
  abrirModalCredenciaisZotero() {
    this.carregarConfigZotero();
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:500px;">
        <div class="ath-modal-head">
          <h2>Conectar Biblioteca Zotero (API Key)</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalZotCredFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <p style="font-size:12.5px; color:#475569; margin:0;">
            Cole abaixo a sua <b>Chave Privada (API Key)</b> gerada em <code>zotero.org/settings/keys</code>. O Athenes descobre automaticamente o seu <b>User ID</b> (ex.: <code>18806479</code>) pela própria chave!
          </p>

          <div class="ath-prop-grupo">
            <label>Chave de API do Zotero (Private Key)</label>
            <input type="text" class="ath-input" id="athInputModalZotKey" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Ex.: KNEYoy8RTMlkaTuHx5WPc3bH" autofocus>
          </div>

          <div class="ath-prop-grupo">
            <label>Zotero User ID (Opcional — preenchido automaticamente pela Key)</label>
            <input type="text" class="ath-input" id="athInputModalZotUser" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="Ex.: 18806479">
          </div>

          <div id="athModalZotStatusFeedback" style="font-size:12px; font-weight:700; min-height:18px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalZotCredCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalZotCredConectar">
            ${svgIcone('zotero', 14)} Testar Chave & Sincronizar Artigos
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalZotCredFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalZotCredCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athModalZotCredConectar').addEventListener('click', async () => {
      const apiKey = modal.querySelector('#athInputModalZotKey').value.trim();
      const userId = modal.querySelector('#athInputModalZotUser').value.trim();
      const statusEl = modal.querySelector('#athModalZotStatusFeedback');
      const btn = modal.querySelector('#athModalZotCredConectar');

      if (!apiKey) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = 'Informe a Chave de API (API Key) do Zotero.';
        return;
      }

      btn.disabled = true;
      statusEl.style.color = '#314F79';
      statusEl.textContent = 'Validando chave na API oficial do Zotero...';

      this.salvarConfigZotero({ apiKey, userId });
      const res = await this.zoteroClient.testarConexao();

      if (!res.ok) {
        btn.disabled = false;
        statusEl.style.color = '#B42318';
        statusEl.textContent = res.mensagem || 'Chave inválida ou erro de rede.';
        return;
      }

      this.salvarConfigZotero({
        apiKey,
        userId: res.usuarioId || userId,
        username: res.nomeUsuario || ''
      });
      modal.querySelector('#athInputModalZotUser').value = res.usuarioId || userId;
      statusEl.style.color = '#15803D';
      statusEl.textContent = `Conectado com sucesso (${res.nomeUsuario} · ID #${res.usuarioId})! Buscando biblioteca...`;

      await this.sincronizarComZoteroApi({ silencioso: true });
      setTimeout(() => {
        fechar();
        this.renderizar();
      }, 500);
    });
  }

  async sincronizarArtigoComDriveEZotero(art, btnEl = null, statusEl = null) {
    salvarArtigosEstudo(this.artigos);
    const txtOriginal = btnEl ? btnEl.innerHTML : '';
    if (btnEl) btnEl.textContent = 'Sincronizando...';

    const resultados = [];

    const htmlNotaZotero = gerarHtmlNotaZoteroDoArtigo(art);
    const resZot = await this.zoteroClient.sincronizarNotaFilhaNoZotero({
      parentItemKey: art.chaveZotero,
      noteKey: art.notaZoteroKey || null,
      htmlNota: htmlNotaZotero,
      tags: ['Athenes', 'Fichamento PDF', ...(art.palavrasChave || []).slice(0, 3)],
      artigoMetadados: art
    });
    if (resZot.parentKey) art.chaveZotero = resZot.parentKey;
    if (resZot.noteKey) art.notaZoteroKey = resZot.noteKey;
    if (this.zoteroClient.userId) {
      this.salvarConfigZotero({ userId: this.zoteroClient.userId });
    }
    resultados.push(resZot.ok ? 'Zotero sincronizado ✓' : 'Fichamento salvo localmente ✓');

    try {
      await salvarDocumentoNoSupabase({
        id: `artigo_${art.id}`,
        titulo: `[Fichamento PDF] ${art.titulo}`,
        autor: (art.autores || []).map(a => a.sobrenome).join(', '),
        norma: 'zotero_pdf',
        secoes: [],
        artigoEstudo: art
      });
      resultados.push('Nuvem Supabase ✓');
    } catch (_) {}

    const driveCfg = obterConfigGoogleDrive();
    if (driveCfg.accessToken || driveCfg.clientId) {
      try {
        const token = driveCfg.accessToken || await autenticarGoogleDrive(driveCfg.clientId);
        const salvoDrive = await salvarArquivoNoGoogleDrive({
          nomeArquivo: `${(art.driveFileName || 'Artigo').replace(/\.pdf$/i, '')}.athenes-pdf.json`,
          conteudoBlobOuTexto: art,
          accessToken: token,
          driveFileId: art.driveAnnotationFileId || null
        });
        if (salvoDrive?.id) art.driveAnnotationFileId = salvoDrive.id;
        resultados.push('Google Drive ✓');
      } catch (_) {}
    }

    salvarArtigosEstudo(this.artigos);
    if (btnEl) {
      btnEl.textContent = 'Salvo & Sincronizado ✓';
      setTimeout(() => { btnEl.innerHTML = txtOriginal; }, 1800);
    }
    if (statusEl) {
      statusEl.textContent = resultados.join(' · ');
    }
  }

  async sincronizarComZoteroApi({ silencioso = false } = {}) {
    this.carregarConfigZotero();
    if (!this.zoteroClient.apiKey) {
      if (!silencioso) this.abrirModalCredenciaisZotero();
      return;
    }

    // Remove os 3 artigos fictícios de demonstração assim que o usuário sincroniza a conta real do Zotero
    this.artigos = this.artigos.filter(a => !ehArtigoExemploFicticio(a));
    if (this.artigoAtivo && ehArtigoExemploFicticio(this.artigoAtivo)) {
      this.artigoAtivo = null;
    }

    const itens = await this.zoteroClient.buscarItens({ limite: 60 });
    if (this.zoteroClient.userId) {
      this.salvarConfigZotero({ userId: this.zoteroClient.userId });
    }

    let novos = 0;
    (itens || []).forEach(it => {
      if (!this.artigos.some(a => a.chaveZotero === it.chave || a.titulo === it.titulo)) {
        this.artigos.unshift(this.converterItemZoteroParaEstudo(it));
        novos++;
      }
    });
    salvarArtigosEstudo(this.artigos);
    this.renderizar();
    if (!silencioso) {
      if (!itens || itens.length === 0) {
        alert(
          `Conexão ativa com sua conta Zotero (${this.zoteroClient.username || 'User'} · ID #${this.zoteroClient.userId || 'OK'}).\n\n` +
          `A nuvem online do Zotero (zotero.org) retornou 0 itens para esta conta.\n` +
          `• Se os seus artigos estão no Zotero Desktop do seu computador, clique no ícone redondo verde "Sincronizar com zotero.org" no canto superior direito do Zotero Desktop.\n` +
          `• Ou use o botão "Importar .bib" no topo para carregar sua coleção instantaneamente!`
        );
      } else {
        alert(`Sincronização Zotero concluída! ${novos} novo(s) artigo(s) trazido(s) da sua biblioteca (${itens.length} itens lidos).`);
      }
    }
  }

  /**
   * Modal para escolher uma referência já existente na biblioteca Zotero do usuário
   * e vincular (puxar Título, Autores, Ano, Periódico, DOI, Resumo, Tags e Chave Zotero)
   * a qualquer PDF lido do Google Drive — SEM enviar o PDF para o Zotero.
   */
  async abrirModalEscolherReferenciaZotero(artAlvo = null, onSelecionado = null) {
    this.carregarConfigZotero();
    const conectado = Boolean(this.zoteroClient.apiKey);
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    const estSel = 'height:30px; font-size:11.5px; padding:0 8px; min-width:0; flex:1 1 110px;';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:640px; width:calc(100vw - 32px); max-height:88vh; display:flex; flex-direction:column;">
        <div class="ath-modal-head">
          <h2>Vincular a uma Referência do Zotero</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalEscRefFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo" style="display:flex; flex-direction:column; gap:8px; min-height:0; flex:1;">
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <input type="text" class="ath-input" id="athBuscaRefZoteroModal" placeholder="Buscar por título, autor, ano, DOI ou tag..." style="flex:1 1 200px; height:32px; font-size:12px;">
            <button type="button" class="ath-btn ath-btn-sm" id="athBtnRecarregarRefZotModal" title="Buscar de novo na sua conta Zotero">${svgIcone('zotero', 13)} Atualizar</button>
            <label class="ath-btn ath-btn-sm" style="cursor:pointer;" title="Carregar referências de um arquivo .bib exportado do Zotero">
              ${svgIcone('upload', 13)} .bib
              <input type="file" accept=".bib,.txt" id="athInputBibNoModalRef" style="display:none;">
            </label>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <select class="ath-input" id="athFiltroRefAno" style="${estSel}"><option value="">Ano: todos</option></select>
            <select class="ath-input" id="athFiltroRefAutor" style="${estSel}"><option value="">Autor: todos</option></select>
            <select class="ath-input" id="athFiltroRefPeriodico" style="${estSel}"><option value="">Periódico: todos</option></select>
            <select class="ath-input" id="athFiltroRefTag" style="${estSel}"><option value="">Tag: todas</option></select>
            <select class="ath-input" id="athFiltroRefDoi" style="${estSel}">
              <option value="">DOI: tanto faz</option>
              <option value="com">Com DOI</option>
              <option value="sem">Sem DOI</option>
            </select>
            <select class="ath-input" id="athOrdemRef" style="${estSel}">
              <option value="recentes">Ordem: Zotero (recentes)</option>
              <option value="ano_desc">Ano (novo → antigo)</option>
              <option value="ano_asc">Ano (antigo → novo)</option>
              <option value="titulo">Título (A–Z)</option>
              <option value="autor">Autor (A–Z)</option>
            </select>
          </div>
          <div id="athStatusRefZoteroModal" style="font-size:11.5px; color:#314F79; font-weight:700;"></div>
          <div id="athListaRefZoteroModal" style="flex:1; min-height:120px; max-height:min(50vh, 400px); overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding-right:2px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalEscRefCancelar">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalEscRefFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalEscRefCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const paraRef = (it) => ({
      chave: it.chave || it.chaveZotero || it.id,
      titulo: it.titulo || '(sem título)',
      autores: it.autores?.length ? it.autores : [],
      ano: it.ano || '',
      publicacao: it.publicacao || it.editora || '',
      volume: it.volume || '',
      numero: it.numero || '',
      paginas: it.paginas || '',
      doi: it.doi || '',
      resumo: it.resumo || it.resumoOriginal || '',
      palavrasChave: it.palavrasChave || []
    });

    // Com a conta Zotero conectada, o catálogo é SOMENTE o que existe no Zotero.
    // Sem conta conectada, usa os artigos locais reais (nunca os 3 exemplos fictícios).
    let catalogoRefs = conectado
      ? (this._cacheRefsZotero?.itens || []).map(paraRef)
      : this.artigos.filter(a => !ehArtigoExemploFicticio(a)).map(paraRef);

    const listaEl = modal.querySelector('#athListaRefZoteroModal');
    const statusEl = modal.querySelector('#athStatusRefZoteroModal');
    const inputBusca = modal.querySelector('#athBuscaRefZoteroModal');
    const selAno = modal.querySelector('#athFiltroRefAno');
    const selAutor = modal.querySelector('#athFiltroRefAutor');
    const selPer = modal.querySelector('#athFiltroRefPeriodico');
    const selTag = modal.querySelector('#athFiltroRefTag');
    const selDoi = modal.querySelector('#athFiltroRefDoi');
    const selOrdem = modal.querySelector('#athOrdemRef');

    const sobrenomeAutor = (r) => (r.autores?.[0]?.sobrenome || '').trim();

    const preencherOpcoes = (sel, rotuloTodos, valores) => {
      const atual = sel.value;
      const unicos = Array.from(new Set(valores.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
      sel.innerHTML = `<option value="">${rotuloTodos}</option>` +
        unicos.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      if (unicos.includes(atual)) sel.value = atual;
    };

    const atualizarOpcoesFiltros = () => {
      preencherOpcoes(selAno, 'Ano: todos', catalogoRefs.map(r => String(r.ano || '')).sort().reverse());
      preencherOpcoes(selAutor, 'Autor: todos', catalogoRefs.map(sobrenomeAutor));
      preencherOpcoes(selPer, 'Periódico: todos', catalogoRefs.map(r => r.publicacao));
      preencherOpcoes(selTag, 'Tag: todas', catalogoRefs.flatMap(r => r.palavrasChave || []));
    };

    const renderizarLista = () => {
      const q = inputBusca.value.trim().toLowerCase();
      let filtradas = catalogoRefs.filter(r => {
        if (selAno.value && String(r.ano) !== selAno.value) return false;
        if (selAutor.value && sobrenomeAutor(r) !== selAutor.value) return false;
        if (selPer.value && r.publicacao !== selPer.value) return false;
        if (selTag.value && !(r.palavrasChave || []).includes(selTag.value)) return false;
        if (selDoi.value === 'com' && !r.doi) return false;
        if (selDoi.value === 'sem' && r.doi) return false;
        if (!q) return true;
        const autStr = (r.autores || []).map(x => `${x.sobrenome} ${x.prenome}`).join(' ');
        return `${r.titulo} ${autStr} ${r.ano} ${r.publicacao} ${r.doi} ${(r.palavrasChave || []).join(' ')}`.toLowerCase().includes(q);
      });

      const ordem = selOrdem.value;
      if (ordem === 'ano_desc') filtradas.sort((a, b) => String(b.ano).localeCompare(String(a.ano)));
      else if (ordem === 'ano_asc') filtradas.sort((a, b) => String(a.ano).localeCompare(String(b.ano)));
      else if (ordem === 'titulo') filtradas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      else if (ordem === 'autor') filtradas.sort((a, b) => sobrenomeAutor(a).localeCompare(sobrenomeAutor(b), 'pt-BR'));

      if (filtradas.length === 0) {
        listaEl.innerHTML = `
          <div style="padding:14px; text-align:center; color:#475569; font-size:12px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:10px; line-height:1.5;">
            ${catalogoRefs.length === 0
              ? (conectado
                ? 'Sua conta Zotero online não tem itens (ou ainda não sincronizou). No Zotero Desktop, clique no botão verde de sincronizar e depois em <b>Atualizar</b>; ou use <b>.bib</b>.'
                : 'Conecte sua Zotero API Key ou importe um arquivo <b>.bib</b>.')
              : 'Nenhuma referência com esses filtros.'}
          </div>`;
        return;
      }

      // Renderiza em lote único (sem reflow por item) e limita a 200 cartões para manter a tela leve.
      const limite = 200;
      const html = filtradas.slice(0, limite).map((r, i) => {
        const autTxt = (r.autores || []).map(a => `${a.sobrenome}${a.prenome ? ', ' + a.prenome : ''}`).join('; ') || 'Autor não informado';
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid #CBD5E1; border-radius:10px; background:#F8FAFC; flex:0 0 auto;">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:800; color:#0F172A; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(r.titulo)}</div>
              <div style="font-size:11px; color:#314F79; font-weight:700; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(autTxt)}${r.ano ? ` (${escapeHtml(r.ano)})` : ''}${r.publicacao ? ` · ${escapeHtml(r.publicacao)}` : ''}
              </div>
              <div style="font-size:10.5px; color:#64748B; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <code>${escapeHtml(r.chave || '')}</code>${r.doi ? ` · DOI ${escapeHtml(r.doi)}` : ''}
              </div>
            </div>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" data-vincular-ref-idx="${i}" style="flex:0 0 auto;">Vincular</button>
          </div>`;
      }).join('') + (filtradas.length > limite
        ? `<div style="font-size:11px; color:#64748B; text-align:center; padding:4px;">Mostrando ${limite} de ${filtradas.length}. Refine a busca ou os filtros.</div>`
        : '');
      listaEl.innerHTML = html;
      listaEl._filtradas = filtradas;
    };

    // Um único listener delegado em vez de um por botão
    listaEl.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-vincular-ref-idx]');
      if (!btn) return;
      const ref = listaEl._filtradas?.[parseInt(btn.dataset.vincularRefIdx, 10)];
      if (!ref) return;
      if (artAlvo) {
        artAlvo.chaveZotero = ref.chave || artAlvo.chaveZotero;
        artAlvo.titulo = ref.titulo || artAlvo.titulo;
        artAlvo.autores = ref.autores?.length ? ref.autores : artAlvo.autores;
        artAlvo.ano = ref.ano || artAlvo.ano;
        artAlvo.publicacao = ref.publicacao || artAlvo.publicacao;
        artAlvo.volume = ref.volume || artAlvo.volume;
        artAlvo.numero = ref.numero || artAlvo.numero;
        artAlvo.paginas = ref.paginas || artAlvo.paginas;
        artAlvo.doi = ref.doi || artAlvo.doi;
        if (ref.resumo) artAlvo.resumoOriginal = ref.resumo;
        if (ref.palavrasChave?.length) artAlvo.palavrasChave = ref.palavrasChave;
        if (artAlvo.conteudoPaginasPdf?.[0]) {
          artAlvo.conteudoPaginasPdf[0].titulo = artAlvo.titulo.toUpperCase();
          artAlvo.conteudoPaginasPdf[0].autores = (artAlvo.autores || []).map(a => `${a.prenome || ''} ${a.sobrenome}`.trim()).join(' · ');
        }
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
      }
      if (onSelecionado) onSelecionado(ref);
      fechar();
    });

    const TTL_CACHE_MS = 5 * 60 * 1000;
    const buscarDaApi = async (forcar = false) => {
      if (!conectado) {
        statusEl.textContent = 'Conecte sua Zotero API Key ou importe um arquivo .bib.';
        renderizarLista();
        return;
      }
      const c = this._cacheRefsZotero;
      if (!forcar && c && Date.now() - c.t < TTL_CACHE_MS) {
        catalogoRefs = c.itens.map(paraRef);
        statusEl.textContent = `${catalogoRefs.length} referência(s) da sua biblioteca Zotero ✓`;
        atualizarOpcoesFiltros();
        renderizarLista();
        return;
      }
      statusEl.textContent = 'Buscando referências na sua biblioteca Zotero...';
      const remotos = await this.zoteroClient.buscarItens({ limite: 100 });
      const lista = Array.isArray(remotos) ? remotos : [];
      this._cacheRefsZotero = { t: Date.now(), itens: lista };
      catalogoRefs = lista.map(paraRef);
      statusEl.textContent = catalogoRefs.length
        ? `${catalogoRefs.length} referência(s) da sua biblioteca Zotero ✓`
        : 'Sua biblioteca online em zotero.org tem 0 itens.';
      atualizarOpcoesFiltros();
      renderizarLista();
    };

    modal.querySelector('#athInputBibNoModalRef')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const importados = ZoteroClient.importarBibTeX(await file.text());
      importados.map(paraRef).forEach(r => {
        if (!catalogoRefs.some(c => c.titulo === r.titulo)) catalogoRefs.unshift(r);
      });
      statusEl.textContent = `${importados.length} referência(s) lida(s) do .bib ✓ (apenas para vincular; não entram no catálogo)`;
      atualizarOpcoesFiltros();
      renderizarLista();
    });

    let debounceBusca = null;
    inputBusca.addEventListener('input', () => {
      clearTimeout(debounceBusca);
      debounceBusca = setTimeout(renderizarLista, 120);
    });
    [selAno, selAutor, selPer, selTag, selDoi, selOrdem].forEach(s => s.addEventListener('change', renderizarLista));
    modal.querySelector('#athBtnRecarregarRefZotModal').addEventListener('click', () => buscarDaApi(true));

    atualizarOpcoesFiltros();
    renderizarLista();
    if (conectado) buscarDaApi(false);
    else statusEl.textContent = 'Zotero não conectado: mostrando só artigos locais.';
  }

  /**
   * Modal para escolher um arquivo PDF diretamente da nuvem do Google Drive do usuário.
   */
  async abrirModalEscolherPdfDoGoogleDrive(onEscolhido) {
    const cfg = obterConfigGoogleDrive();
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:540px;">
        <div class="ath-modal-head">
          <h2>Escolher Arquivo PDF do Google Drive</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalEscPdfDriveFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div id="athStatusPdfDriveModal" style="font-size:12px; color:#314F79; font-weight:700;">Conectando ao seu Google Drive...</div>
          <div id="athListaPdfDriveModal" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;"></div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalEscPdfDriveCancelar">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalEscPdfDriveFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalEscPdfDriveCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const statusEl = modal.querySelector('#athStatusPdfDriveModal');
    const listaEl = modal.querySelector('#athListaPdfDriveModal');

    try {
      const token = cfg.accessToken || await autenticarGoogleDrive(cfg.clientId);
      statusEl.textContent = 'Listando seus arquivos PDF no Google Drive...';
      const arquivos = await listarPdfsDoGoogleDrive(token);
      if (!arquivos || arquivos.length === 0) {
        statusEl.textContent = 'Nenhum PDF listado via API. Use o botão "Selecionar Arquivo PDF" para abrir da sua pasta do Google Drive ou computador.';
        return;
      }
      statusEl.textContent = `${arquivos.length} arquivo(s) PDF encontrado(s) no seu Google Drive:`;
      listaEl.innerHTML = arquivos.map((arq, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #CBD5E1; border-radius:10px; background:#F8FAFC;">
          <div style="min-width:0; flex:1;">
            <div style="font-size:12.5px; font-weight:800; color:#0F172A; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(arq.name)}</div>
            <div style="font-size:10.5px; color:#64748B;">ID Drive: <code>${escapeHtml(arq.id)}</code></div>
          </div>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" data-sel-pdf-drive="${idx}">Selecionar PDF</button>
        </div>
      `).join('');

      listaEl.querySelectorAll('[data-sel-pdf-drive]').forEach(btn => {
        btn.addEventListener('click', () => {
          const arq = arquivos[parseInt(btn.dataset.selPdfDrive, 10)];
          if (arq && onEscolhido) onEscolhido(arq);
          fechar();
        });
      });
    } catch (err) {
      statusEl.style.color = '#B42318';
      statusEl.textContent = `Não foi possível listar da nuvem (${err.message || 'autorize o domínio no Google Cloud'}). Você pode selecionar o PDF direto pela janela de arquivo do computador/pasta Google Drive.`;
    }
  }

  abrirModalVincularArtigo() {
    let arquivoPdfSelecionado = null;
    let driveFileIdSelecionado = '';

    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:580px;">
        <div class="ath-modal-head">
          <h2>Vincular PDF do Google Drive & Referência do Zotero</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalArtFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 12px; background:#EEF4FA; border:1px solid #C8D7E6; border-radius:10px;">
            <span style="font-size:12px; font-weight:700; color:#1E293B;">Já cadastrou a referência no Zotero? Puxe os dados com 1 clique:</span>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnPuxarRefZoteroNoModal">
              ${svgIcone('zotero', 13)} Escolher do Zotero
            </button>
          </div>

          <div class="ath-prop-grupo">
            <label>Arquivo PDF (o PDF fica no seu Google Drive / Computador e não ocupa espaço no Zotero)</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:10px 12px; background:#F8FAFC; border:1.5px dashed #94A3B8; border-radius:10px;">
              <label class="ath-btn ath-btn-primary ath-btn-sm" style="cursor:pointer;">
                ${svgIcone('upload', 13)} Selecionar Arquivo PDF...
                <input type="file" accept=".pdf,application/pdf" id="athNovoArtInputPdfFile" style="display:none;">
              </label>
              <button type="button" class="ath-btn ath-btn-sm" id="athBtnEscolherPdfDriveNoModal">
                ${svgIcone('drive', 13)} Buscar no Google Drive
              </button>
              <span id="athNovoArtPdfBadge" style="font-size:11.5px; color:#314F79; font-weight:700; flex:1; min-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                Nenhum arquivo selecionado
              </span>
            </div>
            <input type="text" class="ath-input" id="athNovoArtDriveNome" placeholder="Nome do arquivo PDF (preenchido automaticamente ao selecionar)" style="margin-top:6px;">
          </div>

          <div class="ath-prop-grupo">
            <label>Título do Artigo</label>
            <input type="text" class="ath-input" id="athNovoArtTitulo" placeholder="Ex.: Planejamento Urbano e Regularização Sustentável">
          </div>
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Autor Principal (Sobrenome, Nome)</label>
              <input type="text" class="ath-input" id="athNovoArtAutor" placeholder="Ex.: Silva, Carlos">
            </div>
            <div class="ath-prop-grupo">
              <label>Ano de Publicação</label>
              <input type="text" class="ath-input" id="athNovoArtAno" value="2026">
            </div>
          </div>
          <div class="ath-linha2">
            <div class="ath-prop-grupo">
              <label>Periódico / Conferência</label>
              <input type="text" class="ath-input" id="athNovoArtPeriodico" placeholder="Ex.: Cadernos Metrópole">
            </div>
            <div class="ath-prop-grupo">
              <label>Chave da Referência no Zotero (Item Key)</label>
              <input type="text" class="ath-input" id="athNovoArtZotKey" placeholder="Vinculada do Zotero ou criada ao sincronizar">
            </div>
          </div>
          <div class="ath-prop-grupo">
            <label>Resumo / Abstract do Artigo</label>
            <textarea class="ath-input" id="athNovoArtResumo" rows="2" placeholder="Cole o abstract do artigo..."></textarea>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalArtCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalArtCriar">Adicionar & Abrir no Estúdio</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalArtFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalArtCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    const badgePdf = modal.querySelector('#athNovoArtPdfBadge');
    const inputDriveNome = modal.querySelector('#athNovoArtDriveNome');
    const inputTitulo = modal.querySelector('#athNovoArtTitulo');

    modal.querySelector('#athNovoArtInputPdfFile').addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (!f) return;
      arquivoPdfSelecionado = f;
      inputDriveNome.value = f.name;
      badgePdf.style.color = '#15803D';
      badgePdf.textContent = `✓ ${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`;
      if (!inputTitulo.value.trim()) {
        inputTitulo.value = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      }
    });

    modal.querySelector('#athBtnEscolherPdfDriveNoModal').addEventListener('click', () => {
      this.abrirModalEscolherPdfDoGoogleDrive((arqDrive) => {
        driveFileIdSelecionado = arqDrive.id || '';
        inputDriveNome.value = arqDrive.name || '';
        badgePdf.style.color = '#15803D';
        badgePdf.textContent = `✓ Drive: ${arqDrive.name}`;
        if (!inputTitulo.value.trim() && arqDrive.name) {
          inputTitulo.value = arqDrive.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
        }
      });
    });

    modal.querySelector('#athBtnPuxarRefZoteroNoModal').addEventListener('click', () => {
      this.abrirModalEscolherReferenciaZotero(null, (ref) => {
        modal.querySelector('#athNovoArtTitulo').value = ref.titulo || '';
        const aut0 = ref.autores?.[0];
        if (aut0) {
          modal.querySelector('#athNovoArtAutor').value = `${aut0.sobrenome || ''}${aut0.prenome ? ', ' + aut0.prenome : ''}`;
        }
        modal.querySelector('#athNovoArtAno').value = ref.ano || '2026';
        modal.querySelector('#athNovoArtPeriodico').value = ref.publicacao || '';
        modal.querySelector('#athNovoArtZotKey').value = ref.chave || '';
        modal.querySelector('#athNovoArtResumo').value = ref.resumo || '';
        if (!inputDriveNome.value.trim()) {
          inputDriveNome.value = `${aut0?.sobrenome || 'Artigo'}_${ref.ano || '2026'}.pdf`;
        }
      });
    });

    modal.querySelector('#athModalArtCriar').addEventListener('click', async () => {
      const titulo = modal.querySelector('#athNovoArtTitulo').value.trim() || 'Novo Artigo Científico';
      const autorRaw = modal.querySelector('#athNovoArtAutor').value.trim() || 'Autor, Pesquisador';
      const partesAutor = autorRaw.split(',').map(s => s.trim());
      const ano = modal.querySelector('#athNovoArtAno').value.trim() || '2026';
      const publicacao = modal.querySelector('#athNovoArtPeriodico').value.trim() || 'Periódico Acadêmico';
      const chaveZotero = modal.querySelector('#athNovoArtZotKey').value.trim() || ('ZOT' + Math.random().toString(36).slice(2, 7).toUpperCase());
      const driveFileName = inputDriveNome.value.trim() || `${partesAutor[0]}_${ano}.pdf`;
      const resumo = modal.querySelector('#athNovoArtResumo').value.trim() || 'Artigo vinculado ao Zotero e ao Google Drive.';

      const novoArt = this.converterItemZoteroParaEstudo({
        id: Date.now().toString(36),
        chave: chaveZotero,
        titulo,
        autores: [{ sobrenome: partesAutor[0] || 'Autor', prenome: partesAutor[1] || '' }],
        ano,
        publicacao,
        resumo
      });
      novoArt.driveFileName = driveFileName;
      if (driveFileIdSelecionado) {
        novoArt.driveFileId = driveFileIdSelecionado;
      }
      if (arquivoPdfSelecionado) {
        registrarPdfLocalNoArtigo(novoArt, arquivoPdfSelecionado);
        const cfgDrive = obterConfigGoogleDrive();
        if (cfgDrive.accessToken) {
          salvarArquivoNoGoogleDrive({
            nomeArquivo: arquivoPdfSelecionado.name,
            conteudoBlobOuTexto: arquivoPdfSelecionado,
            mimeType: 'application/pdf',
            accessToken: cfgDrive.accessToken
          }).then(salvo => {
            if (salvo?.id) {
              novoArt.driveFileId = salvo.id;
              salvarArtigosEstudo(this.artigos);
            }
          }).catch(() => {});
        }
      }

      this.artigos.unshift(novoArt);
      salvarArtigosEstudo(this.artigos);
      fechar();
      this.abrirArtigoNoEstudio(novoArt);
    });
  }
}
