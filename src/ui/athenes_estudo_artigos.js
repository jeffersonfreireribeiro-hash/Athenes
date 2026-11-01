// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Leitura, Risco em PDF (estilo Samsung Notes) e Fichamento Síncrono (Zotero + Google Drive).
 *
 * Arquitetura em Tela Cheia (Full-Screen 3 Colunas idêntica ao Editor de Escrita .rm-conteudo / .rm-ed-grade):
 * - Topo Shell (.ath-topo-shell): Marca Athenes, Título editável do artigo, Selo ABNT, Status Zotero API e Salvar Drive & Zotero.
 * - Coluna Esquerda (.rm-col-esq, dividida 50/50):
 *     1. Metade Superior: Artigos da Coleção Zotero (troca rápida sem sair da tela cheia + sincronização).
 *     2. Metade Inferior: Páginas do PDF & Marcações (navegação por páginas, contagem de riscos/notas e + Folha Extra).
 * - Coluna Central (.rm-col-prev):
 *     1. Barra de informações e popovers de topo (Zotero API, Google Drive PDF, Opções de Caneta).
 *     2. Barra flutuante de pílula (.rm-barra-blocos) com ferramentas estilo Samsung Notes (Cursor, Caneta, Marca-texto, Borracha, Nota Adesiva, + Citação, Cores, Espessura, Paginador e Zoom).
 *     3. Palco rolável (.rm-prev-palco) com a Folha A4 do PDF + Camada vetorial <canvas> + Pinos de Nota.
 * - Coluna Direita (.rm-col-dir):
 *     Inspetor completo em altura total com 3 abas: Resumo & Notas, Citações (p. X) e Zotero & Drive.
 */

import { ZoteroClient } from '../core/athenes_zotero.js';
import {
  obterPerfilColaborador,
  obterConfigGoogleDrive,
  salvarConfigGoogleDrive,
  autenticarGoogleDrive,
  salvarArquivoNoGoogleDrive,
  salvarDocumentoNoSupabase
} from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone, svgLogo } from './athenes_icones.js';

const STORAGE_KEY_ARTIGOS = 'athenes_estudo_artigos_v1';

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
              xPct: 68,
              yPct: 32,
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

export function carregarArtigosEstudo() {
  try {
    if (typeof localStorage !== 'undefined') {
      const salvo = localStorage.getItem(STORAGE_KEY_ARTIGOS);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
      localStorage.setItem(STORAGE_KEY_ARTIGOS, JSON.stringify(lista));
    }
  } catch (_) {}
  return lista;
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
        citacoes.map(c => `<li><blockquote>"${escapeHtml(c.texto)}" ${escapeHtml(formatarCitacaoAbntDoArtigo(artigo, c.pagina))}</blockquote>${c.comentario ? `<p><em>Nota:</em> ${escapeHtml(c.comentario)}</p>` : ''}</li>`).join('') +
        `</ul>`
      : '',
    todosPins.length > 0
      ? `<h3>Marcações e Notificações nas Páginas (${todosPins.length})</h3><ul>` +
        todosPins.map(p => `<li><strong>[p. ${escapeHtml(p.pagina)} — ${escapeHtml(p.titulo || 'Nota')}]:</strong> ${escapeHtml(p.texto)}</li>`).join('') +
        `</ul>`
      : ''
  ].filter(Boolean).join('\n');
}

export class EstudoArtigosView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.opcoes = opcoes;
    this.onModoFullScreenChange = opcoes.onModoFullScreenChange || (() => {});
    this.artigos = carregarArtigosEstudo();
    this.artigoAberto = null; // null = catálogo; objeto = estúdio full-screen 3 colunas (100vw x 100vh)
    this.paginaAtual = 1;
    this.zoomPct = 100;
    this.ferramentaAtiva = 'caneta'; // 'cursor' | 'caneta' | 'marcatexto' | 'borracha' | 'nota'
    this.corTinta = '#314F79';
    this.espessuraTinta = 3;
    this.abaDireita = 'resumo'; // 'resumo' | 'citacoes' | 'zotero_drive'
    this.filtroBusca = '';
    this.filtroLateralEsq = '';
    this.popoverTopoAberto = null;
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
    this.carregarConfigZotero();
    this.container.innerHTML = '';

    if (this.artigoAberto) {
      this.alternarModoDashboardFull(true);
      this.renderizarEstudioPdfFullScreen(this.artigoAberto);
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

      <div class="ath-estudo-aviso-arquitetura">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:260px;">
            <span class="ath-estudo-icone-destaque">${svgIcone('drive', 18)}</span>
            <div>
              <strong>Estúdio de Leitura em Tela Cheia (Samsung Notes + Zotero + Google Drive):</strong>
              <span>Clique em qualquer artigo abaixo para abrir o <b>Estúdio Full-Screen de 3 Colunas</b>. O PDF é lido do Google Drive (sem ocupar espaço no Zotero) e seus resumos e citações sincronizam direto na sua conta Zotero.</span>
            </div>
          </div>
          ${!conectado ? `
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnConectarZoteroBanner">
              Colar Chave API Zotero
            </button>
          ` : ''}
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

    const btnBanner = wrap.querySelector('#athBtnConectarZoteroBanner');
    if (btnBanner) {
      btnBanner.addEventListener('click', () => this.abrirModalCredenciaisZotero());
    }

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
        alert(`${adicionados} artigo(s) importado(s) do BibTeX para sua Biblioteca de Estudo!`);
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
            `RESUMO: ${item.resumo || 'Texto integral carregado via vínculo do Google Drive. Use a barra superior flutuante para riscar com a caneta, destacar trechos com o marca-texto ou fixar notas adesivas nesta página.'}`,
            '1. INTRODUÇÃO E PROBLEMATIZAÇÃO: Selecione qualquer trecho ou utilize o botão "+ Citação" na barra flutuante para extrair citações diretas já formatadas com o número da página para o seu fichamento Zotero.'
          ]
        },
        {
          numero: 2,
          cabecalho: `${(item.autores?.[0]?.sobrenome || 'AUTOR').toUpperCase()} (${item.ano || '2026'}) · p. 2`,
          titulo: '2. DESENVOLVIMENTO E RESULTADOS PRINCIPAIS',
          autores: 'Continuação do documento PDF vinculado',
          paragrafos: [
            'As anotações feitas à mão livre nesta folha ficam salvas na camada vetorial do Athenes e sincronizadas diretamente com seu arquivo no Google Drive.'
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
    this.popoverTopoAberto = null;
    this.renderizar();
  }

  /* ==========================================================================
     VISÃO 2: ESTÚDIO EM TELA CHEIA (FULL-SCREEN 3 COLUNAS IDÊNTICO À ESCRITA)
     ========================================================================== */
  renderizarEstudioPdfFullScreen(art) {
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

    const pagDados = paginasPdf[this.paginaAtual - 1];
    const citacoes = art.fichamento.citacoesMarcadas || [];
    const pinsDaPagina = art.fichamento.notasPagina?.[this.paginaAtual] || [];
    const conectadoZot = this.temZoteroConectado();

    // Estrutura Raiz .rm-conteudo (100vh x 100vw, idêntica ao EditorView de Escrita)
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

    // 2. CORPO EM 3 COLUNAS (.rm-editor.rm-main > .rm-ed-grade: 310px | 1fr | 330px)
    const editorEl = document.createElement('div');
    editorEl.className = 'rm-editor rm-main';
    editorEl.innerHTML = `
      <div class="rm-ed-grade">
        <!-- COLUNA 1 (ESQUERDA): Dividida 50/50 igual ao Editor de Escrita (Artigos da Coleção + Páginas do PDF) -->
        <aside class="rm-col rm-col-esq" id="athEstudioColEsq"></aside>

        <!-- COLUNA 2 (CENTRO): Barra de Topo + Barra Flutuante de Pílula (.rm-barra-blocos) + Palco A4 (.rm-prev-palco) -->
        <section class="rm-col rm-col-prev" id="athEstudioColPrev">
          <div class="rm-prev-topo">
            <div class="rm-prev-topo-esq">
              <strong>Estúdio PDF</strong>
              <span class="rm-prev-info">
                Página ${this.paginaAtual} de ${totalPags} · ${escapeHtml(art.driveFileName || 'PDF no Google Drive')} · Ferramenta: <b id="athLabelModoRisco">${this.rotuloFerramenta(this.ferramentaAtiva)}</b>
              </span>
            </div>

            <div class="rm-prev-menus-topo" id="athEstudioMenusTopo">
              <!-- Popover 1: Zotero API & Sincronização -->
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

              <!-- Popover 2: Arquivo PDF & Google Drive -->
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

              <!-- Popover 3: Estilo da Caneta & Marca-Texto -->
              <div class="rm-menu-topo-item" data-menu-est="caneta">
                <button type="button" class="rm-btn-menu-topo" id="athBtnPopCaneta" aria-haspopup="dialog" aria-expanded="false">
                  ${svgIcone('lapis', 14)}
                  <span>Caneta & Traço</span>
                  <svg class="rm-seta-dropdown-icone" viewBox="0 0 6 4" width="6" height="4" aria-hidden="true">
                    <path d="M1 1L3 3L5 1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="rm-topo-popover" id="athPopoverEstCaneta" role="dialog" hidden style="width:310px;"></div>
              </div>
            </div>
          </div>

          <!-- BARRA DE PÍLULA FLUTUANTE (.rm-barra-blocos) IDÊNTICA AO EDITOR DE ESCRITA -->
          <div class="rm-barra-blocos" id="athEstudioBarraFlutuante">
            <button type="button" class="rm-ic-bt" id="athBtnVoltarCatalogoArtigos" title="Voltar para o Catálogo de Artigos" aria-label="Voltar">
              ${svgIcone('voltar', 16)}
            </button>
            <button type="button" class="rm-ic-bt rm-ic-primario" id="athBtnSalvarPilula" title="Salvar no Google Drive, Zotero e Supabase" aria-label="Salvar">
              ${svgIcone('salvar', 16)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <button type="button" class="rm-ic-bt" id="athBtnDesfazerTraco" title="Desfazer último risco desta página" aria-label="Desfazer risco">
              ${svgIcone('desfazer', 16)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnLimparTracosPagina" title="Limpar todos os riscos desta página" aria-label="Limpar riscos">
              ${svgIcone('lixeira', 15)}
            </button>
            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Ferramentas de Leitura e Risco estilo Samsung Notes -->
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'cursor' ? 'ativo' : ''}" data-tool="cursor" data-tip="Selecionar Texto" title="Modo Seleção de Texto">
              ${svgIcone('paragrafo', 15)}
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'caneta' ? 'ativo' : ''}" data-tool="caneta" data-tip="Caneta Livre" title="Caneta de Risco Livre (Samsung Notes)">
              ${svgIcone('lapis', 15)}
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'marcatexto' ? 'ativo' : ''}" data-tool="marcatexto" data-tip="Marca-Texto" title="Marca-Texto Translúcido">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'borracha' ? 'ativo' : ''}" data-tool="borracha" data-tip="Borracha" title="Borracha para apagar traços">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
            </button>
            <button type="button" class="rm-ic-bt ath-tool-pilula ${this.ferramentaAtiva === 'nota' ? 'ativo' : ''}" data-tool="nota" data-tip="Nota Adesiva" title="Clique na folha do PDF para fixar um balão de nota">
              ${svgIcone('nota', 15)}
            </button>
            <button type="button" class="rm-ic-bt" id="athBtnCapturarCitacaoPdf" data-tip="Marcar Citação" title="Capturar trecho selecionado da página para o Zotero">
              ${svgIcone('citacao', 15)}
            </button>

            <span class="rm-barra-sep" aria-hidden="true"></span>

            <!-- Bolinhas de Cor Rápidas na Barra Flutuante -->
            <div class="ath-cores-tinta" title="Cor da caneta ou marca-texto">
              ${['#314F79', '#DC2626', '#059669', '#D97706', '#7C3AED', '#FACC15'].map(cor => `
                <button type="button" class="ath-cor-dot ${this.corTinta === cor ? 'on' : ''}" data-cor="${cor}" style="background:${cor};" aria-label="Cor ${cor}"></button>
              `).join('')}
            </div>

            <!-- Paginador e Zoom à Direita da Barra Flutuante -->
            <div style="margin-left:auto; display:flex; align-items:center; gap:5px;">
              <button type="button" class="rm-ic-bt" id="athPdfPagAnt" title="Página Anterior" ${this.paginaAtual <= 1 ? 'disabled' : ''} style="width:30px; height:30px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span style="font:800 11.5px var(--glx-font); color:#1F2733; min-width:48px; text-align:center;">${this.paginaAtual} / ${totalPags}</span>
              <button type="button" class="rm-ic-bt" id="athPdfPagProx" title="Próxima Página" ${this.paginaAtual >= totalPags ? 'disabled' : ''} style="width:30px; height:30px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>
              </button>
              <button type="button" class="rm-ic-bt" id="athPdfNovaPag" data-tip="Folha Extra" title="Adicionar folha extra de esquemas/notas ao PDF" style="width:30px; height:30px;">
                ${svgIcone('mais', 14)}
              </button>
            </div>
          </div>

          <!-- PALCO CENTRAL DE FOLHA A4 (.rm-prev-palco) -->
          <div class="rm-prev-palco" id="athEstudioPalco">
            <div class="ath-folha-a4 ath-pdf-folha-container" id="athPdfFolhaContainer" style="transform: scale(${this.zoomPct / 100}); transform-origin: top center;">
              ${art.pdfBlobUrl ? `
                <embed src="${art.pdfBlobUrl}#page=${this.paginaAtual}" type="application/pdf" class="ath-pdf-embed-nativo">
              ` : `
                <div class="ath-pdf-folha-texto" id="athPdfFolhaTexto">
                  <div class="ath-pdf-folha-cabecalho">${escapeHtml(pagDados.cabecalho || '')}</div>
                  <h2 class="ath-pdf-folha-titulo">${escapeHtml(pagDados.titulo || '')}</h2>
                  ${pagDados.autores ? `<div class="ath-pdf-folha-autores">${escapeHtml(pagDados.autores)}</div>` : ''}
                  <div class="ath-pdf-folha-colunas">
                    ${(pagDados.paragrafos || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
                  </div>
                  <div class="ath-pdf-folha-rodape">
                    <span>DOI: ${escapeHtml(art.doi || '10.1000/athenes.zotero')}</span>
                    <span>Página ${this.paginaAtual} de ${totalPags} · Google Drive (${escapeHtml(art.driveFileName || 'PDF')})</span>
                  </div>
                </div>
              `}

              <!-- Camada Transparente de Risco Livre e Marca-Texto (Samsung Notes Canvas) -->
              <canvas id="athPdfInkCanvas" class="ath-pdf-ink-canvas" width="794" height="1123" style="pointer-events: ${this.ferramentaAtiva === 'cursor' ? 'none' : 'auto'}; cursor: ${this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair'};"></canvas>

              <!-- Camada de Pinos / Balões de Notificação na Página -->
              <div class="ath-pdf-pins-layer" id="athPdfPinsLayer">
                ${pinsDaPagina.map((pin, idx) => `
                  <div class="ath-pdf-pin-balao" style="left:${pin.xPct}%; top:${pin.yPct}%; border-color:${escapeHtml(pin.cor || '#F59E0B')};" data-pin-id="${escapeHtml(pin.id)}">
                    <div class="ath-pdf-pin-cab" style="background:${escapeHtml(pin.cor || '#F59E0B')};">
                      <strong>📌 #${idx + 1} · ${escapeHtml(pin.titulo || 'Nota')}</strong>
                      <button type="button" class="ath-pin-del" data-del-pin="${escapeHtml(pin.id)}" title="Excluir nota">✕</button>
                    </div>
                    <div class="ath-pdf-pin-txt">${escapeHtml(pin.texto)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
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

    // Monta a Coluna Esquerda 50/50 (Artigos Zotero em cima + Páginas do PDF embaixo)
    this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);

    // Monta Popovers de Topo
    this.configurarPopoversTopoEstudio(root, art);

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

    // Desfazer último risco e limpar riscos
    root.querySelector('#athBtnDesfazerTraco').addEventListener('click', () => {
      const lista = art.fichamento?.tracosPorPagina?.[this.paginaAtual];
      if (Array.isArray(lista) && lista.length > 0) {
        lista.pop();
        salvarArtigosEstudo(this.artigos);
        this.redesenharCanvasTinta(root.querySelector('#athPdfInkCanvas'), art);
        this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
      }
    });

    root.querySelector('#athBtnLimparTracosPagina').addEventListener('click', () => {
      if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
      art.fichamento.tracosPorPagina[this.paginaAtual] = [];
      salvarArtigosEstudo(this.artigos);
      this.redesenharCanvasTinta(root.querySelector('#athPdfInkCanvas'), art);
      this.renderizarColunaEsquerdaEstudio(root.querySelector('#athEstudioColEsq'), art, paginasPdf);
    });

    // Seleção de Ferramenta (Cursor, Caneta, Marca-Texto, Borracha, Nota)
    root.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ferramentaAtiva = btn.dataset.tool;
        root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('ativo', b.dataset.tool === this.ferramentaAtiva));
        const canvas = root.querySelector('#athPdfInkCanvas');
        if (canvas) {
          canvas.style.pointerEvents = this.ferramentaAtiva === 'cursor' ? 'none' : 'auto';
          canvas.style.cursor = this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair';
        }
        const lbl = root.querySelector('#athLabelModoRisco');
        if (lbl) lbl.textContent = this.rotuloFerramenta(this.ferramentaAtiva);
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
      this.capturarCitacaoDaPagina(art);
    });

    root.querySelector('#athPdfPagAnt').addEventListener('click', () => {
      if (this.paginaAtual > 1) {
        this.paginaAtual--;
        this.renderizar();
      }
    });

    root.querySelector('#athPdfPagProx').addEventListener('click', () => {
      if (this.paginaAtual < totalPags) {
        this.paginaAtual++;
        this.renderizar();
      }
    });

    root.querySelector('#athPdfNovaPag').addEventListener('click', () => {
      this.adicionarFolhaExtraNoPdf(art, paginasPdf);
    });

    root.querySelector('#athInputCarregarPdfReal').addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      art.driveFileName = file.name;
      art.driveStatus = 'PDF local / Google Drive vinculado';
      art.pdfBlobUrl = URL.createObjectURL(file);
      salvarArtigosEstudo(this.artigos);
      this.renderizar();
    });

    // Excluir pinos de nota na página
    root.querySelectorAll('[data-del-pin]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pinId = btn.dataset.delPin;
        const listaPins = art.fichamento.notasPagina?.[this.paginaAtual] || [];
        art.fichamento.notasPagina[this.paginaAtual] = listaPins.filter(p => p.id !== pinId);
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
      });
    });

    // Abas do painel lateral direito
    root.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaDireita = btn.dataset.aba;
        root.querySelectorAll('.ath-estudio-aba').forEach(b => b.classList.toggle('on', b.dataset.aba === this.abaDireita));
        this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
      });
    });

    // Inicializa Canvas de Risco Livre e Inspetor Direito
    this.inicializarCanvasTinta(root.querySelector('#athPdfInkCanvas'), art);
    this.renderizarPainelDireitoEstudio(root.querySelector('#athEstudioPainelCorpo'), art);
  }

  adicionarFolhaExtraNoPdf(art, paginasPdf) {
    const novoNum = paginasPdf.length + 1;
    paginasPdf.push({
      numero: novoNum,
      cabecalho: `${art.titulo.slice(0, 55)} · Folha de Anotações Manuscritas #${novoNum}`,
      titulo: `FOLHA DE RASCUNHO E ESQUEMAS VISUAIS (PÁGINA ${novoNum})`,
      autores: 'Espaço livre estilo Samsung Notes para esquemas, mapas mentais e fórmulas sobre o artigo',
      paragrafos: [
        'Use a Caneta ou Marca-texto acima para desenhar esquemas ou fixar balões de anotação nesta folha complementar.'
      ]
    });
    art.totalPaginas = paginasPdf.length;
    this.paginaAtual = novoNum;
    salvarArtigosEstudo(this.artigos);
    this.renderizar();
  }

  /* ==========================================================================
     COLUNA ESQUERDA 50/50 (ARTIGOS DA COLEÇÃO ZOTERO + PÁGINAS DO PDF)
     ========================================================================== */
  renderizarColunaEsquerdaEstudio(colEsq, artAtivo, paginasPdf) {
    if (!colEsq) return;
    const artigosFiltrados = this.artigos.filter(a => {
      if (!this.filtroLateralEsq) return true;
      const str = `${a.titulo} ${(a.autores || []).map(x => x.sobrenome).join(' ')} ${a.ano}`.toLowerCase();
      return str.includes(this.filtroLateralEsq);
    });

    colEsq.innerHTML = `
      <!-- METADE SUPERIOR: ARTIGOS DA BIBLIOTECA ZOTERO -->
      <div class="rm-sec rm-painel-metade">
        <div class="rm-painel-metade-topo">
          <strong class="rm-rot" style="color:var(--glx-primary, #314F79);">ARTIGOS DO ZOTERO (${this.artigos.length})</strong>
          <div style="display:flex; gap:4px;">
            <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athEsqBtnSyncZotero" title="Sincronizar com Zotero API" style="height:24px; padding:0 8px; font-size:10.5px;">
              ${svgIcone('zotero', 11)} Sync
            </button>
            <button type="button" class="glx-btn glx-btn-primary glx-btn-xs" id="athEsqBtnNovoArtigo" title="Vincular novo artigo" style="height:24px; padding:0 8px; font-size:10.5px;">
              + Artigo
            </button>
          </div>
        </div>

        <div class="rm-painel-metade-sub">
          <input type="search" id="athInputFiltroEsqArtigos" value="${escapeHtml(this.filtroLateralEsq)}" placeholder="Filtrar artigos da biblioteca..." style="height:30px; font-size:11.5px;">
        </div>

        <div class="rm-painel-metade-scroll">
          <div class="rm-lista-mestras">
            ${artigosFiltrados.map((item, idx) => {
              const isAtivo = item.id === artAtivo.id;
              const qtdCit = item.fichamento?.citacoesMarcadas?.length || 0;
              return `
                <div class="rm-mestra-card ${isAtivo ? 'ativa' : ''}" data-abrir-artigo-esq="${escapeHtml(item.id)}">
                  <div class="rm-mestra-card-topo">
                    <span class="rm-mestra-num">${idx + 1}</span>
                    <strong class="rm-mestra-nome" title="${escapeHtml(item.titulo)}">${escapeHtml(item.titulo)}</strong>
                  </div>
                  <div class="rm-mestra-card-meta">
                    <span class="rm-mestra-badge progressiva">${escapeHtml(formatarCitacaoAbntDoArtigo(item))}</span>
                    <span class="rm-mestra-orient">${qtdCit} citaç${qtdCit === 1 ? 'ão' : 'ões'}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- METADE INFERIOR: PÁGINAS DO PDF & CAMADAS DE RISCO -->
      <div class="rm-sec rm-painel-metade">
        <div class="rm-painel-metade-topo">
          <strong class="rm-rot">PÁGINAS DO PDF (${paginasPdf.length})</strong>
          <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" id="athEsqBtnNovaFolha" style="height:24px; padding:0 8px; font-size:10.5px;">
            + Folha Extra
          </button>
        </div>

        <div class="rm-painel-metade-scroll">
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
                    <strong>Página ${numPag} — ${escapeHtml((pg.titulo || 'Folha do Artigo').slice(0, 32))}</strong>
                    <span>${qtdRiscos} risco(s) · ${qtdNotas} nota(s) · ${qtdCitsPag} citação(ões)</span>
                  </button>
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
      li.addEventListener('click', () => {
        const pg = parseInt(li.dataset.irPaginaEsq, 10) || 1;
        if (pg !== this.paginaAtual) {
          this.paginaAtual = pg;
          this.renderizar();
        }
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
      popDrive.innerHTML = `
        <div class="rm-popover-head">
          <strong>Arquivo PDF no Google Drive</strong>
          <button type="button" class="rm-ic" data-fechar-pop-est>${svgIcone('fechar', 14)}</button>
        </div>
        <div class="rm-popover-body">
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
          <label>Escala / Zoom da Folha PDF (${this.zoomPct}%)
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

    // Controle de abrir/fechar popovers de topo
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
      cursor: 'Seleção de Texto',
      caneta: 'Caneta de Risco Livre',
      marcatexto: 'Marca-Texto Translúcido',
      borracha: 'Borracha de Traços',
      nota: 'Fixar Nota Adesiva no PDF'
    };
    return map[tool] || tool;
  }

  /* ==========================================================================
     MOTOR DE TINTA DIGITAL E MARCAÇÃO EM CANVAS (ESTILO SAMSUNG NOTES)
     ========================================================================== */
  inicializarCanvasTinta(canvas, art) {
    if (!canvas) return;
    if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
    if (!Array.isArray(art.fichamento.tracosPorPagina[this.paginaAtual])) {
      art.fichamento.tracosPorPagina[this.paginaAtual] = [];
    }

    this.redesenharCanvasTinta(canvas, art);

    let desenhando = false;
    let tracoAtual = null;

    const obterPosicaoNoCanvas = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: Math.round((ev.clientX - rect.left) * scaleX),
        y: Math.round((ev.clientY - rect.top) * scaleY),
        xPct: Math.max(4, Math.min(78, Math.round(((ev.clientX - rect.left) / rect.width) * 100))),
        yPct: Math.max(4, Math.min(88, Math.round(((ev.clientY - rect.top) / rect.height) * 100)))
      };
    };

    canvas.addEventListener('pointerdown', (ev) => {
      if (this.ferramentaAtiva === 'cursor') return;
      const pos = obterPosicaoNoCanvas(ev);

      if (this.ferramentaAtiva === 'nota') {
        const textoNota = window.prompt
          ? window.prompt('Texto da anotação / lembrete neste ponto do PDF:', 'Verificar este argumento / dado para citar no artigo.')
          : 'Verificar este argumento / dado para citar no artigo.';
        if (!textoNota) return;
        const perfil = obterPerfilColaborador();
        if (!art.fichamento.notasPagina) art.fichamento.notasPagina = {};
        if (!Array.isArray(art.fichamento.notasPagina[this.paginaAtual])) {
          art.fichamento.notasPagina[this.paginaAtual] = [];
        }
        art.fichamento.notasPagina[this.paginaAtual].push({
          id: 'pin_' + Date.now().toString(36),
          xPct: pos.xPct,
          yPct: pos.yPct,
          titulo: perfil.nome || 'Nota',
          texto: textoNota,
          cor: this.corTinta,
          autor: perfil.nome || 'Autor'
        });
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
        return;
      }

      if (this.ferramentaAtiva === 'borracha') {
        desenhando = true;
        this.apagarTracosProximos(art, pos.x, pos.y);
        this.redesenharCanvasTinta(canvas, art);
        return;
      }

      desenhando = true;
      canvas.setPointerCapture?.(ev.pointerId);
      tracoAtual = {
        tipo: this.ferramentaAtiva === 'marcatexto' ? 'marcatexto' : 'caneta',
        cor: this.ferramentaAtiva === 'marcatexto' && this.corTinta === '#314F79' ? '#FACC15' : this.corTinta,
        espessura: this.ferramentaAtiva === 'marcatexto' ? 18 : this.espessuraTinta,
        pontos: [{ x: pos.x, y: pos.y }]
      };
      art.fichamento.tracosPorPagina[this.paginaAtual].push(tracoAtual);
      this.redesenharCanvasTinta(canvas, art);
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!desenhando) return;
      const pos = obterPosicaoNoCanvas(ev);
      if (this.ferramentaAtiva === 'borracha') {
        this.apagarTracosProximos(art, pos.x, pos.y);
        this.redesenharCanvasTinta(canvas, art);
        return;
      }
      if (!tracoAtual) return;
      tracoAtual.pontos.push({ x: pos.x, y: pos.y });
      this.redesenharCanvasTinta(canvas, art);
    });

    const finalizarTraco = () => {
      if (!desenhando) return;
      desenhando = false;
      tracoAtual = null;
      salvarArtigosEstudo(this.artigos);
    };

    canvas.addEventListener('pointerup', finalizarTraco);
    canvas.addEventListener('pointercancel', finalizarTraco);
  }

  apagarTracosProximos(art, x, y, raio = 22) {
    const lista = art.fichamento?.tracosPorPagina?.[this.paginaAtual];
    if (!Array.isArray(lista)) return;
    art.fichamento.tracosPorPagina[this.paginaAtual] = lista.filter(traco => {
      return !(traco.pontos || []).some(pt => Math.hypot(pt.x - x, pt.y - y) <= raio);
    });
  }

  redesenharCanvasTinta(canvas, art) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tracos = art.fichamento?.tracosPorPagina?.[this.paginaAtual] || [];
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

  capturarCitacaoDaPagina(art) {
    const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
    let textoCapturado = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
    if (!textoCapturado) {
      textoCapturado = typeof window !== 'undefined' && window.prompt
        ? window.prompt(`Digite ou cole o trecho citado da página ${this.paginaAtual}:`, '')
        : '';
    }
    if (!textoCapturado) return;

    const comentario = typeof window !== 'undefined' && window.prompt
      ? window.prompt('Nota ou comentário sobre esta citação (opcional):', 'Citar na fundamentação teórica')
      : '';

    if (!Array.isArray(art.fichamento.citacoesMarcadas)) {
      art.fichamento.citacoesMarcadas = [];
    }
    art.fichamento.citacoesMarcadas.unshift({
      id: 'cit_' + Date.now().toString(36),
      pagina: this.paginaAtual,
      texto: textoCapturado,
      comentario: comentario || '',
      cor: this.corTinta,
      criadoEm: new Date().toISOString()
    });

    salvarArtigosEstudo(this.artigos);
    this.abaDireita = 'citacoes';
    this.renderizar();
  }

  /* ==========================================================================
     PAINEL LATERAL DIREITO DO ESTÚDIO: RESUMO, CITAÇÕES E VÍNCULO ZOTERO+DRIVE
     ========================================================================== */
  renderizarPainelDireitoEstudio(box, art) {
    if (!box) return;
    box.innerHTML = '';

    const f = art.fichamento;

    if (this.abaDireita === 'resumo') {
      box.innerHTML = `
        <div class="ath-fichamento-bloco">
          <label class="ath-fichamento-rotulo">Resumo Oficial do Artigo (Zotero)</label>
          <div class="ath-fichamento-resumo-orig">${escapeHtml(art.resumoOriginal || 'Sem resumo cadastrado no Zotero.')}</div>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Meu Resumo & Síntese Crítica</label>
          <textarea id="athEstudoResumoPessoal" class="ath-input" rows="6" placeholder="Escreva aqui o seu resumo do artigo, principais teses do autor e como ele dialoga com sua pesquisa...">${escapeHtml(f.resumoPessoal || '')}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Análise Metodológica & Anotações Livres</label>
          <textarea id="athEstudoMetodoNotas" class="ath-input" rows="5" placeholder="Anote parâmetros, equações, dados estatísticos ou críticas metodológicas...">${escapeHtml(f.metodologiaNotas || '')}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Tags / Palavras-Chave (Zotero)</label>
          <input type="text" id="athEstudoTagsInput" class="ath-input" value="${escapeHtml((art.palavrasChave || []).join(', '))}" placeholder="Ex.: REURB, Morfologia, SIG">

          <div class="ath-fichamento-dica">
            Tudo o que você escreve aqui é salvo automaticamente e enviado como uma <b>Nota Filha sincronizada no Zotero</b> e salvo junto ao PDF no seu <b>Google Drive</b>.
          </div>
        </div>
      `;

      box.querySelector('#athEstudoResumoPessoal').addEventListener('input', e => {
        f.resumoPessoal = e.target.value;
        salvarArtigosEstudo(this.artigos);
      });

      box.querySelector('#athEstudoMetodoNotas').addEventListener('input', e => {
        f.metodologiaNotas = e.target.value;
        salvarArtigosEstudo(this.artigos);
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
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnNovaCitacaoPainel">+ Marcar Citação</button>
          </div>

          <div class="ath-lista-citacoes-pdf">
            ${citacoes.length === 0 ? `
              <div style="padding:20px 12px; text-align:center; color:#64748B; font-size:12px; background:#F8FAFC; border-radius:10px; border:1px dashed #CBD5E1;">
                Selecione qualquer frase no PDF ao lado e clique em <b>+ Citação</b> para guardar o trecho com a página exata.
              </div>
            ` : citacoes.map(c => `
              <div class="ath-citacao-pdf-card" style="border-left: 4px solid ${escapeHtml(c.cor || '#314F79')};">
                <div class="ath-citacao-pdf-topo">
                  <span class="ath-citacao-pag-badge" data-ir-pag="${escapeHtml(c.pagina)}" title="Ir para a página ${escapeHtml(c.pagina)}">Página ${escapeHtml(c.pagina)}</span>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="ath-btn ath-btn-sm" data-copiar-cit="${escapeHtml(c.id)}" style="height:22px; padding:0 7px; font-size:10.5px;">Copiar ABNT</button>
                    <button type="button" class="ath-btn ath-btn-sm" data-del-cit="${escapeHtml(c.id)}" style="height:22px; padding:0 6px; font-size:10.5px; color:#B42318;">✕</button>
                  </div>
                </div>
                <blockquote class="ath-citacao-pdf-texto">"${escapeHtml(c.texto)}"</blockquote>
                <div class="ath-citacao-pdf-ref">${escapeHtml(formatarCitacaoAbntDoArtigo(art, c.pagina))}</div>
                ${c.comentario ? `<div class="ath-citacao-pdf-nota">💡 ${escapeHtml(c.comentario)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;

      box.querySelector('#athBtnNovaCitacaoPainel').addEventListener('click', () => {
        this.capturarCitacaoDaPagina(art);
      });

      box.querySelectorAll('[data-ir-pag]').forEach(el => {
        el.addEventListener('click', () => {
          this.paginaAtual = parseInt(el.dataset.irPag, 10) || 1;
          this.renderizar();
        });
      });

      box.querySelectorAll('[data-copiar-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = citacoes.find(x => x.id === btn.dataset.copiarCit);
          if (!c) return;
          const formatada = `"${c.texto}" ${formatarCitacaoAbntDoArtigo(art, c.pagina)}`;
          navigator.clipboard?.writeText(formatada);
          btn.textContent = 'Copiado ✓';
          setTimeout(() => { btn.textContent = 'Copiar ABNT'; }, 1400);
        });
      });

      box.querySelectorAll('[data-del-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          f.citacoesMarcadas = citacoes.filter(x => x.id !== btn.dataset.delCit);
          salvarArtigosEstudo(this.artigos);
          this.renderizar();
        });
      });
      return;
    }

    // Aba 3: Vínculo Zotero & Google Drive
    box.innerHTML = `
      <div class="ath-fichamento-bloco">
        <div style="padding:10px 12px; border-radius:12px; background:#F8FAFC; border:1px solid #CBD5E1; margin-bottom:10px;">
          <strong style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#1F2733; text-transform:uppercase; margin-bottom:6px;">
            ${svgIcone('zotero', 13)} Credenciais & Vínculo Zotero
          </strong>
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
          <strong style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#314F79; text-transform:uppercase; margin-bottom:4px;">
            ${svgIcone('drive', 13)} Armazenamento do PDF no Google Drive
          </strong>
          <p style="font-size:11px; color:#334155; margin:0 0 8px 0;">
            O PDF é lido do Google Drive e salvo de volta com suas camadas de risco, sem consumir o armazenamento do Zotero.
          </p>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Nome do Arquivo no Drive
            <input type="text" class="ath-input" id="athDriveNomeArqArtigo" value="${escapeHtml(art.driveFileName || '')}" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block;">ID / Link do PDF no Google Drive
            <input type="text" class="ath-input" id="athDriveIdArqArtigo" value="${escapeHtml(art.driveFileId || '')}" placeholder="Ex.: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
        </div>

        <button type="button" class="ath-btn ath-btn-primary" id="athBtnSyncCompletoPainel" style="width:100%; justify-content:center;">
          ${svgIcone('salvar', 14)} Sincronizar Agora (Zotero + Drive + Supabase)
        </button>
        <div id="athStatusSyncArtigo" style="font-size:11.5px; margin-top:8px; color:#15803D; font-weight:700;"></div>
      </div>
    `;

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

    // 1. Sincroniza Nota Filha com Zotero (e cria o item bibliográfico pai caso ainda seja apenas local)
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

    // 2. Salva na nuvem Supabase
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

    // 3. Salva pacote de anotações no Google Drive se configurado
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

    const itens = await this.zoteroClient.buscarItens({ limite: 40 });
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
        alert(`Conexão ativa com sua biblioteca Zotero (User ID #${this.zoteroClient.userId || 'OK'})! Sua biblioteca remota ainda não possui itens ou todos já estão sincronizados.`);
      } else {
        alert(`Sincronização Zotero concluída! ${novos} novo(s) artigo(s) trazido(s) da sua biblioteca (${itens.length} itens lidos).`);
      }
    }
  }

  abrirModalVincularArtigo() {
    const modal = document.createElement('div');
    modal.className = 'ath-modal-backdrop';
    modal.innerHTML = `
      <div class="ath-modal" style="max-width:560px;">
        <div class="ath-modal-head">
          <h2>Vincular Artigo do Zotero & PDF do Google Drive</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalArtFechar">${svgIcone('fechar', 16)}</button>
        </div>
        <div class="ath-modal-corpo">
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
              <label>Chave Zotero (Opcional)</label>
              <input type="text" class="ath-input" id="athNovoArtZotKey" placeholder="Criado no Zotero ao sincronizar">
            </div>
          </div>
          <div class="ath-prop-grupo">
            <label>Arquivo PDF no Google Drive (ou selecione do computador)</label>
            <input type="text" class="ath-input" id="athNovoArtDriveNome" placeholder="Ex.: Silva_2026_Planejamento_Urbano.pdf">
            <small style="color:var(--ath-muted); display:block; margin-top:4px;">O PDF permanece no seu Google Drive e será aberto no Estúdio em Tela Cheia estilo Samsung Notes.</small>
          </div>
          <div class="ath-prop-grupo">
            <label>Resumo / Abstract do Artigo</label>
            <textarea class="ath-input" id="athNovoArtResumo" rows="3" placeholder="Cole o abstract do artigo..."></textarea>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalArtCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalArtCriar">Adicionar & Abrir em Tela Cheia</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const fechar = () => modal.remove();
    modal.querySelector('#athModalArtFechar').addEventListener('click', fechar);
    modal.querySelector('#athModalArtCancelar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    modal.querySelector('#athModalArtCriar').addEventListener('click', () => {
      const titulo = modal.querySelector('#athNovoArtTitulo').value.trim() || 'Novo Artigo Científico';
      const autorRaw = modal.querySelector('#athNovoArtAutor').value.trim() || 'Autor, Pesquisador';
      const partesAutor = autorRaw.split(',').map(s => s.trim());
      const ano = modal.querySelector('#athNovoArtAno').value.trim() || '2026';
      const publicacao = modal.querySelector('#athNovoArtPeriodico').value.trim() || 'Periódico Acadêmico';
      const chaveZotero = modal.querySelector('#athNovoArtZotKey').value.trim() || ('ZOT' + Math.random().toString(36).slice(2, 7).toUpperCase());
      const driveFileName = modal.querySelector('#athNovoArtDriveNome').value.trim() || `${partesAutor[0]}_${ano}.pdf`;
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

      this.artigos.unshift(novoArt);
      salvarArtigosEstudo(this.artigos);
      fechar();
      this.abrirArtigoNoEstudio(novoArt);
    });
  }
}
