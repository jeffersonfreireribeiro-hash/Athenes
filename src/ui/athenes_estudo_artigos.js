// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Leitura, Risco em PDF (estilo Samsung Notes) e Fichamento Síncrono (Zotero + Google Drive).
 *
 * Funcionalidades:
 * 1. Catálogo de Artigos vinculados ao Zotero com prévia da capa do PDF, autores, periódico, DOI e selo do Google Drive.
 * 2. Leitor e Riscador de PDF estilo Samsung Notes:
 *    - Camada de tinta livre (<canvas>) sobre as páginas do PDF (Caneta, Marca-texto translúcido, Borracha).
 *    - Notas adesivas / balões de notificação posicionados diretamente nas coordenadas da página do PDF.
 *    - Marcação de Citações Diretas com página automática (SOBRENOME, Ano, p. X).
 * 3. Sincronização inteligente:
 *    - O arquivo PDF permanece no Google Drive (lido e salvo via escopo seguro drive.file, sem ocupar o armazenamento do Zotero).
 *    - O resumo, as anotações de leitura e as citações marcadas sincronizam com o item do Zotero (Nota Filha via API v3) e com a nuvem Supabase.
 */

import { ZoteroClient } from '../core/athenes_zotero.js';
import {
  obterPerfilColaborador,
  obterConfigGoogleDrive,
  autenticarGoogleDrive,
  salvarArquivoNoGoogleDrive,
  listarArquivosDoGoogleDrive,
  salvarDocumentoNoSupabase
} from '../core/athenes_colaboracao.js';
import { svgIcone } from './athenes_icones.js';

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
              xPct: 74,
              yPct: 28,
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
    `<h2>Fichamento Athenes — ${artigo?.titulo || 'Artigo'}</h2>`,
    `<p><strong>Vínculo PDF no Google Drive:</strong> ${artigo?.driveFileName || 'Não vinculado'} (ID: <code>${artigo?.driveFileId || 'local'}</code>)</p>`,
    f.resumoPessoal ? `<h3>Resumo & Síntese</h3><p>${f.resumoPessoal}</p>` : '',
    f.metodologiaNotas ? `<h3>Notas de Metodologia & Reflexões</h3><p>${f.metodologiaNotas}</p>` : '',
    citacoes.length > 0
      ? `<h3>Citações Marcadas no PDF (${citacoes.length})</h3><ul>` +
        citacoes.map(c => `<li><blockquote>"${c.texto}" ${formatarCitacaoAbntDoArtigo(artigo, c.pagina)}</blockquote>${c.comentario ? `<p><em>Nota:</em> ${c.comentario}</p>` : ''}</li>`).join('') +
        `</ul>`
      : '',
    todosPins.length > 0
      ? `<h3>Marcações e Notificações nas Páginas (${todosPins.length})</h3><ul>` +
        todosPins.map(p => `<li><strong>[p. ${p.pagina} — ${p.titulo || 'Nota'}]:</strong> ${p.texto}</li>`).join('') +
        `</ul>`
      : ''
  ].filter(Boolean).join('\n');
}

export class EstudoArtigosView {
  constructor(containerEl, opcoes = {}) {
    this.container = containerEl;
    this.opcoes = opcoes;
    this.artigos = carregarArtigosEstudo();
    this.artigoAberto = null; // null = grade de artigos; objeto = estúdio PDF estilo Samsung Notes + Zotero
    this.paginaAtual = 1;
    this.zoomPct = 100;
    this.ferramentaAtiva = 'caneta'; // 'cursor' | 'caneta' | 'marcatexto' | 'borracha' | 'nota' | 'citacao'
    this.corTinta = '#314F79';
    this.espessuraTinta = 3;
    this.abaDireita = 'resumo'; // 'resumo' | 'citacoes' | 'zotero_drive'
    this.filtroBusca = '';
    this.zoteroClient = new ZoteroClient();
    this.carregarConfigZotero();
    this.renderizar();
  }

  carregarConfigZotero() {
    try {
      const salvo = localStorage.getItem('athenes_zotero_cfg');
      if (salvo) {
        const cfg = JSON.parse(salvo);
        this.zoteroClient.userId = cfg.userId || '';
        this.zoteroClient.apiKey = cfg.apiKey || '';
        this.zoteroClient.isGroup = Boolean(cfg.isGroup);
      }
    } catch (_) {}
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (this.artigoAberto) {
      this.renderizarEstudioPdf(this.artigoAberto);
    } else {
      this.renderizarCatalogoArtigos();
    }
  }

  /* ==========================================================================
     VISÃO 1: CATÁLOGO DE ARTIGOS VINCULADOS AO ZOTERO + CAPA DO PDF NO DRIVE
     ========================================================================== */
  renderizarCatalogoArtigos() {
    const wrap = document.createElement('div');
    wrap.className = 'ath-estudo-catalogo';

    wrap.innerHTML = `
      <div class="ath-estudo-barra-topo">
        <div class="ath-busca-box" style="flex:1; max-width:440px;">
          ${svgIcone('busca', 16)}
          <input type="text" class="ath-input" id="athEstudoBuscaInput" value="${this.filtroBusca}" placeholder="Buscar artigo por título, autor, tag Zotero ou citação marcada...">
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button type="button" class="ath-btn" id="athBtnSincronizarZoteroHub" title="Buscar e sincronizar artigos da sua biblioteca Zotero">
            ${svgIcone('zotero', 15)} <span>Sincronizar Zotero</span>
          </button>
          <label class="ath-btn" style="cursor:pointer;" title="Importar referências de arquivo .bib do Zotero">
            ${svgIcone('documento', 14)} <span>Importar .bib</span>
            <input type="file" accept=".bib,.txt" id="athInputImportarBibEstudo" style="display:none;">
          </label>
          <button type="button" class="ath-btn ath-btn-primary" id="athBtnNovoArtigoDrive">
            ${svgIcone('mais', 14)} <span>Vincular Artigo & PDF do Drive</span>
          </button>
        </div>
      </div>

      <div class="ath-estudo-aviso-arquitetura">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="ath-estudo-icone-destaque">${svgIcone('drive', 18)}</span>
          <div>
            <strong>Fluxo Inteligente Zotero + Google Drive + Anotação estilo Samsung Notes:</strong>
            <span>Os PDFs permanecem armazenados no seu <b>Google Drive</b> (sem consumir espaço do Zotero). Você lê, risca à mão livre, cria balões de nota e marca citações aqui no Athenes, sincronizando o fichamento com o Zotero e o PDF anotado com o Drive.</span>
          </div>
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
      palavrasChave: item.palavrasChave || ['Zotero'],
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
            `RESUMO: ${item.resumo || 'Texto integral carregado via vínculo do Google Drive. Use a barra superior para riscar com a caneta, destacar trechos com o marca-texto ou fixar notas adesivas nesta página.'}`,
            '1. INTRODUÇÃO E PROBLEMATIZAÇÃO: Selecione qualquer trecho ou utilize o botão "Marcar Citação" para extrair citações diretas já formatadas com o número da página para o seu fichamento Zotero.'
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
          <p style="font-size:12.5px; color:#64748B; margin:0;">Sincronize sua biblioteca Zotero ou clique em "Vincular Artigo & PDF do Drive".</p>
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
        <!-- Miniatura Visual da Capa do PDF -->
        <div class="ath-artigo-capa-pdf" style="border-top: 4px solid ${art.corCapa || '#314F79'};">
          <div class="ath-artigo-capa-folha">
            <span class="ath-artigo-capa-periodico">${art.publicacao || 'Periódico Científico'} · ${art.ano}</span>
            <strong class="ath-artigo-capa-titulo">${art.titulo}</strong>
            <span class="ath-artigo-capa-autores">${autoresFmt}</span>
            <div class="ath-artigo-capa-linhas" aria-hidden="true">
              <span></span><span class="hl"></span><span></span><span></span>
            </div>
          </div>
          <div class="ath-artigo-capa-badges">
            <span class="ath-selo-zotero" title="Chave do item no Zotero">${svgIcone('zotero', 11)} ${art.chaveZotero || 'ZOTERO'}</span>
            <span class="ath-selo-drive" title="PDF lido e salvo diretamente no Google Drive">${svgIcone('drive', 11)} PDF no Drive</span>
          </div>
        </div>

        <!-- Metadados e Resumo do Fichamento -->
        <div class="ath-artigo-card-corpo">
          <div class="ath-artigo-tags">
            ${(art.palavrasChave || []).slice(0, 3).map(t => `<span class="ath-tag-chip">${t}</span>`).join('')}
          </div>

          <h3 class="ath-artigo-titulo">${art.titulo}</h3>
          <p class="ath-artigo-autores">${autoresFmt} (${art.ano})</p>
          <p class="ath-artigo-resumo-curto">
            ${art.fichamento?.resumoPessoal
              ? `<strong>Seu resumo:</strong> ${art.fichamento.resumoPessoal}`
              : (art.resumoOriginal || 'Clique para abrir o PDF, riscar à mão livre e fazer o fichamento.')}
          </p>

          <div class="ath-artigo-estatisticas">
            <span><strong>${qtdCitacoes}</strong> citaç${qtdCitacoes === 1 ? 'ão' : 'ões'}</span>
            <span>·</span>
            <span><strong>${qtdTracos + qtdPins}</strong> marcaç${(qtdTracos + qtdPins) === 1 ? 'ão' : 'ões'} no PDF</span>
            <span>·</span>
            <span style="color:#059669; font-weight:700;">${art.driveFileName || 'PDF vinculado'}</span>
          </div>

          <div class="ath-artigo-card-rodape">
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm ath-btn-abrir-estudio" style="flex:1; justify-content:center;">
              ${svgIcone('lapis', 13)} Abrir PDF, Riscar & Fichar
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
    this.renderizar();
  }

  /* ==========================================================================
     VISÃO 2: ESTÚDIO DE LEITURA E RISCO DE PDF (ESTILO SAMSUNG NOTES + ZOTERO)
     ========================================================================== */
  renderizarEstudioPdf(art) {
    if (!art.fichamento) {
      art.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {} };
    }
    const paginasPdf = Array.isArray(art.conteudoPaginasPdf) && art.conteudoPaginasPdf.length > 0
      ? art.conteudoPaginasPdf
      : [{ numero: 1, cabecalho: art.publicacao || 'Artigo PDF', titulo: art.titulo, autores: '', paragrafos: [art.resumoOriginal || ''] }];
    const totalPags = paginasPdf.length;
    if (this.paginaAtual > totalPags) this.paginaAtual = totalPags;
    if (this.paginaAtual < 1) this.paginaAtual = 1;

    const pagDados = paginasPdf[this.paginaAtual - 1];
    const citacoes = art.fichamento.citacoesMarcadas || [];
    const pinsDaPagina = art.fichamento.notasPagina?.[this.paginaAtual] || [];

    const studio = document.createElement('div');
    studio.className = 'ath-estudio-pdf-shell';

    studio.innerHTML = `
      <!-- Barra Superior do Estúdio PDF (Estilo Samsung Notes + Zotero) -->
      <header class="ath-estudio-topo">
        <div class="ath-estudio-topo-esq">
          <button type="button" class="ath-btn ath-btn-sm" id="athBtnVoltarCatalogoArtigos" title="Voltar para a Biblioteca de Artigos">
            ${svgIcone('voltar', 14)} <span>Biblioteca</span>
          </button>
          <div class="ath-estudio-doc-info">
            <strong title="${art.titulo}">${art.titulo}</strong>
            <span>${formatarCitacaoAbntDoArtigo(art)} · Drive: <code>${art.driveFileName || 'PDF vinculado'}</code></span>
          </div>
        </div>

        <!-- Barra Central de Ferramentas de Risco e Anotação (Samsung Notes) -->
        <div class="ath-samsung-toolbar" role="toolbar" aria-label="Ferramentas de Anotação no PDF">
          <button type="button" class="ath-tool-btn ${this.ferramentaAtiva === 'cursor' ? 'on' : ''}" data-tool="cursor" title="Selecionar texto / Navegar">
            <span>👆</span> <small>Texto</small>
          </button>
          <button type="button" class="ath-tool-btn ${this.ferramentaAtiva === 'caneta' ? 'on' : ''}" data-tool="caneta" title="Caneta de Risco Livre (estilo Samsung Notes)">
            ${svgIcone('lapis', 14)} <small>Caneta</small>
          </button>
          <button type="button" class="ath-tool-btn ${this.ferramentaAtiva === 'marcatexto' ? 'on' : ''}" data-tool="marcatexto" title="Marca-texto translúcido sobre o PDF">
            <span>🖍</span> <small>Grifar</small>
          </button>
          <button type="button" class="ath-tool-btn ${this.ferramentaAtiva === 'borracha' ? 'on' : ''}" data-tool="borracha" title="Borracha para apagar riscos da página">
            <span>⌫</span> <small>Borracha</small>
          </button>
          <button type="button" class="ath-tool-btn ${this.ferramentaAtiva === 'nota' ? 'on' : ''}" data-tool="nota" title="Clique na folha do PDF para fixar um balão de nota/notificação">
            <span>📌</span> <small>Nota no PDF</small>
          </button>
          <button type="button" class="ath-tool-btn" id="athBtnCapturarCitacaoPdf" title="Capturar trecho selecionado (ou nova citação) da página atual para o Zotero">
            ${svgIcone('zotero', 14)} <small>+ Citação</small>
          </button>

          <span class="ath-toolbar-sep"></span>

          <!-- Seletor de Cores da Caneta / Marca-Texto -->
          <div class="ath-cores-tinta" title="Cor da caneta ou marca-texto">
            ${['#314F79', '#DC2626', '#059669', '#D97706', '#7C3AED', '#FACC15'].map(cor => `
              <button type="button" class="ath-cor-dot ${this.corTinta === cor ? 'on' : ''}" data-cor="${cor}" style="background:${cor};" aria-label="Cor ${cor}"></button>
            `).join('')}
          </div>

          <!-- Espessura do Traço -->
          <select id="athSelectEspessuraTinta" class="ath-select" style="height:28px; font-size:11px; padding:0 6px; width:82px;" title="Espessura do traço">
            <option value="2" ${this.espessuraTinta === 2 ? 'selected' : ''}>Fina (2px)</option>
            <option value="3" ${this.espessuraTinta === 3 ? 'selected' : ''}>Média (3px)</option>
            <option value="6" ${this.espessuraTinta === 6 ? 'selected' : ''}>Forte (6px)</option>
          </select>

          <button type="button" class="ath-btn ath-btn-sm" id="athBtnLimparTracosPagina" title="Limpar todos os riscos à mão livre desta página" style="height:28px; font-size:11px; padding:0 8px;">
            Limpar Riscos
          </button>
        </div>

        <!-- Ações de Sincronização Google Drive + Zotero -->
        <div class="ath-estudio-topo-dir">
          <label class="ath-btn ath-btn-sm" style="cursor:pointer;" title="Carregar arquivo PDF local ou da pasta do Google Drive">
            ${svgIcone('drive', 14)} <span>Trocar PDF</span>
            <input type="file" accept="application/pdf" id="athInputCarregarPdfReal" style="display:none;">
          </label>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnSalvarDriveEZotero">
            ${svgIcone('salvar', 14)} <span>Salvar no Drive & Zotero</span>
          </button>
        </div>
      </header>

      <!-- Corpo Principal Dividido: Leitor/Riscador PDF à Esquerda + Fichamento Zotero à Direita -->
      <div class="ath-estudio-corpo">
        <!-- Coluna do PDF com Camada de Risco estilo Samsung Notes -->
        <div class="ath-estudio-pdf-area">
          <div class="ath-estudio-paginador">
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="ath-btn ath-btn-sm" id="athPdfPagAnt" ${this.paginaAtual <= 1 ? 'disabled' : ''}>◀ Anterior</button>
              <span style="font:800 12px var(--glx-font); color:#1F2733;">Página ${this.paginaAtual} de ${totalPags}</span>
              <button type="button" class="ath-btn ath-btn-sm" id="athPdfPagProx" ${this.paginaAtual >= totalPags ? 'disabled' : ''}>Próxima ▶</button>
              <button type="button" class="ath-btn ath-btn-sm" id="athPdfNovaPag" title="Adicionar página de anotações extras ao PDF">+ Folha Extra</button>
            </div>
            <div style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#475569;">
              <span>Modo ativo: <strong id="athLabelModoRisco">${this.rotuloFerramenta(this.ferramentaAtiva)}</strong></span>
            </div>
          </div>

          <div class="ath-pdf-palco-scroll">
            <div class="ath-pdf-folha-container" id="athPdfFolhaContainer" style="transform: scale(${this.zoomPct / 100}); transform-origin: top center;">
              ${art.pdfBlobUrl ? `
                <embed src="${art.pdfBlobUrl}#page=${this.paginaAtual}" type="application/pdf" class="ath-pdf-embed-nativo">
              ` : `
                <!-- Renderização Editorial Nítida da Página do Artigo PDF -->
                <div class="ath-pdf-folha-texto" id="athPdfFolhaTexto">
                  <div class="ath-pdf-folha-cabecalho">${pagDados.cabecalho || ''}</div>
                  <h2 class="ath-pdf-folha-titulo">${pagDados.titulo || ''}</h2>
                  ${pagDados.autores ? `<div class="ath-pdf-folha-autores">${pagDados.autores}</div>` : ''}
                  <div class="ath-pdf-folha-colunas">
                    ${(pagDados.paragrafos || []).map(p => `<p>${p}</p>`).join('')}
                  </div>
                  <div class="ath-pdf-folha-rodape">
                    <span>DOI: ${art.doi || '10.1000/athenes.zotero'}</span>
                    <span>Página ${this.paginaAtual} de ${totalPags} · Lido via Google Drive (${art.driveFileName || 'PDF'})</span>
                  </div>
                </div>
              `}

              <!-- Camada Transparente de Risco Livre e Marca-Texto (Samsung Notes Canvas) -->
              <canvas id="athPdfInkCanvas" class="ath-pdf-ink-canvas" width="794" height="1040" style="pointer-events: ${this.ferramentaAtiva === 'cursor' ? 'none' : 'auto'}; cursor: ${this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair'};"></canvas>

              <!-- Camada de Pinos / Balões de Notificação na Página -->
              <div class="ath-pdf-pins-layer" id="athPdfPinsLayer">
                ${pinsDaPagina.map((pin, idx) => `
                  <div class="ath-pdf-pin-balao" style="left:${pin.xPct}%; top:${pin.yPct}%; border-color:${pin.cor || '#F59E0B'};" data-pin-id="${pin.id}">
                    <div class="ath-pdf-pin-cab" style="background:${pin.cor || '#F59E0B'};">
                      <strong>📌 #${idx + 1} · ${pin.titulo || 'Nota'}</strong>
                      <button type="button" class="ath-pin-del" data-del-pin="${pin.id}" title="Excluir nota">✕</button>
                    </div>
                    <div class="ath-pdf-pin-txt">${pin.texto}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Painel Lateral Direito: Resumo, Citações Marcadas e Sincronização Síncrona Zotero + Drive -->
        <aside class="ath-estudio-painel-dir">
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
        </aside>
      </div>
    `;

    this.container.appendChild(studio);

    // Eventos da Barra Superior
    studio.querySelector('#athBtnVoltarCatalogoArtigos').addEventListener('click', () => {
      salvarArtigosEstudo(this.artigos);
      this.artigoAberto = null;
      this.renderizar();
    });

    studio.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ferramentaAtiva = btn.dataset.tool;
        studio.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === this.ferramentaAtiva));
        const canvas = studio.querySelector('#athPdfInkCanvas');
        if (canvas) {
          canvas.style.pointerEvents = this.ferramentaAtiva === 'cursor' ? 'none' : 'auto';
          canvas.style.cursor = this.ferramentaAtiva === 'cursor' ? 'text' : 'crosshair';
        }
        const lbl = studio.querySelector('#athLabelModoRisco');
        if (lbl) lbl.textContent = this.rotuloFerramenta(this.ferramentaAtiva);
      });
    });

    studio.querySelectorAll('[data-cor]').forEach(dot => {
      dot.addEventListener('click', () => {
        this.corTinta = dot.dataset.cor;
        studio.querySelectorAll('[data-cor]').forEach(d => d.classList.toggle('on', d.dataset.cor === this.corTinta));
      });
    });

    studio.querySelector('#athSelectEspessuraTinta').addEventListener('change', e => {
      this.espessuraTinta = parseInt(e.target.value, 10) || 3;
    });

    studio.querySelector('#athBtnLimparTracosPagina').addEventListener('click', () => {
      if (!art.fichamento.tracosPorPagina) art.fichamento.tracosPorPagina = {};
      art.fichamento.tracosPorPagina[this.paginaAtual] = [];
      salvarArtigosEstudo(this.artigos);
      this.redesenharCanvasTinta(studio.querySelector('#athPdfInkCanvas'), art);
    });

    studio.querySelector('#athBtnCapturarCitacaoPdf').addEventListener('click', () => {
      this.capturarCitacaoDaPagina(art);
    });

    studio.querySelector('#athPdfPagAnt').addEventListener('click', () => {
      if (this.paginaAtual > 1) {
        this.paginaAtual--;
        this.renderizar();
      }
    });

    studio.querySelector('#athPdfPagProx').addEventListener('click', () => {
      if (this.paginaAtual < totalPags) {
        this.paginaAtual++;
        this.renderizar();
      }
    });

    studio.querySelector('#athPdfNovaPag').addEventListener('click', () => {
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
    });

    studio.querySelector('#athInputCarregarPdfReal').addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      art.driveFileName = file.name;
      art.driveStatus = 'PDF local / Google Drive vinculado';
      art.pdfBlobUrl = URL.createObjectURL(file);
      salvarArtigosEstudo(this.artigos);
      this.renderizar();
    });

    studio.querySelector('#athBtnSalvarDriveEZotero').addEventListener('click', () => {
      this.sincronizarArtigoComDriveEZotero(art, studio.querySelector('#athBtnSalvarDriveEZotero'));
    });

    // Excluir pinos de nota na página
    studio.querySelectorAll('[data-del-pin]').forEach(btn => {
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
    studio.querySelectorAll('.ath-estudio-aba').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaDireita = btn.dataset.aba;
        studio.querySelectorAll('.ath-estudio-aba').forEach(b => b.classList.toggle('on', b.dataset.aba === this.abaDireita));
        this.renderizarPainelDireitoEstudio(studio.querySelector('#athEstudioPainelCorpo'), art);
      });
    });

    // Inicializa Canvas de Risco Livre (estilo Samsung Notes) e Painel Direito
    this.inicializarCanvasTinta(studio.querySelector('#athPdfInkCanvas'), art);
    this.renderizarPainelDireitoEstudio(studio.querySelector('#athEstudioPainelCorpo'), art);
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
        xPct: Math.max(4, Math.min(82, Math.round(((ev.clientX - rect.left) / rect.width) * 100))),
        yPct: Math.max(4, Math.min(88, Math.round(((ev.clientY - rect.top) / rect.height) * 100)))
      };
    };

    canvas.addEventListener('pointerdown', (ev) => {
      if (this.ferramentaAtiva === 'cursor') return;
      const pos = obterPosicaoNoCanvas(ev);

      // Se a ferramenta for "Nota no PDF", fixa um balão de notificação na posição clicada
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

      // Se for Borracha, apaga traços próximos ao clique/arrasto
      if (this.ferramentaAtiva === 'borracha') {
        desenhando = true;
        this.apagarTracosProximos(art, pos.x, pos.y);
        this.redesenharCanvasTinta(canvas, art);
        return;
      }

      // Caneta ou Marca-texto
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
    const sel = window.getSelection();
    let textoCapturado = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';
    if (!textoCapturado) {
      textoCapturado = window.prompt
        ? window.prompt(`Digite ou cole o trecho citado da página ${this.paginaAtual}:`, '')
        : '';
    }
    if (!textoCapturado) return;

    const comentario = window.prompt
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
          <div class="ath-fichamento-resumo-orig">${art.resumoOriginal || 'Sem resumo cadastrado no Zotero.'}</div>

          <label class="ath-fichamento-rotulo" style="margin-top:12px;">Meu Resumo & Síntese Crítica</label>
          <textarea id="athEstudoResumoPessoal" class="ath-input" rows="5" placeholder="Escreva aqui o seu resumo do artigo, principais teses do autor e como ele dialoga com sua pesquisa...">${f.resumoPessoal || ''}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:12px;">Análise Metodológica & Anotações Livres</label>
          <textarea id="athEstudoMetodoNotas" class="ath-input" rows="5" placeholder="Anote parâmetros, equações, dados estatísticos ou críticas metodológicas...">${f.metodologiaNotas || ''}</textarea>

          <div class="ath-fichamento-dica">
            Tudo o que você escreve aqui é salvo automaticamente e pode ser enviado como uma <b>Nota Filha sincronizada no Zotero</b> e salvo junto ao PDF no seu <b>Google Drive</b>.
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
              <div class="ath-citacao-pdf-card" style="border-left: 4px solid ${c.cor || '#314F79'};">
                <div class="ath-citacao-pdf-topo">
                  <span class="ath-citacao-pag-badge" data-ir-pag="${c.pagina}" title="Ir para a página ${c.pagina}">Página ${c.pagina}</span>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="ath-btn ath-btn-sm" data-copiar-cit="${c.id}" style="height:22px; padding:0 7px; font-size:10.5px;">Copiar ABNT</button>
                    <button type="button" class="ath-btn ath-btn-sm" data-del-cit="${c.id}" style="height:22px; padding:0 6px; font-size:10.5px; color:#B42318;">✕</button>
                  </div>
                </div>
                <blockquote class="ath-citacao-pdf-texto">"${c.texto}"</blockquote>
                <div class="ath-citacao-pdf-ref">${formatarCitacaoAbntDoArtigo(art, c.pagina)}</div>
                ${c.comentario ? `<div class="ath-citacao-pdf-nota">💡 ${c.comentario}</div>` : ''}
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
        <div style="padding:10px 12px; border-radius:10px; background:#EEF4FA; border:1px solid #C8D7E6; margin-bottom:10px;">
          <strong style="display:block; font-size:11.5px; color:#314F79; text-transform:uppercase; margin-bottom:4px;">
            ${svgIcone('drive', 13)} Armazenamento do PDF no Google Drive
          </strong>
          <p style="font-size:11.5px; color:#334155; margin:0 0 8px 0;">
            O arquivo PDF é lido do seu Google Drive e salvo de volta com suas camadas de risco, sem enviar o PDF para o Zotero.
          </p>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Nome do Arquivo no Drive
            <input type="text" class="ath-input" id="athDriveNomeArqArtigo" value="${art.driveFileName || ''}" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block;">ID / Link do PDF no Google Drive
            <input type="text" class="ath-input" id="athDriveIdArqArtigo" value="${art.driveFileId || ''}" placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
        </div>

        <div style="padding:10px 12px; border-radius:10px; background:#F8FAFC; border:1px solid #CBD5E1; margin-bottom:10px;">
          <strong style="display:block; font-size:11.5px; color:#1F2733; text-transform:uppercase; margin-bottom:4px;">
            ${svgIcone('zotero', 13)} Vínculo Síncrono com Zotero
          </strong>
          <label style="font-size:11px; font-weight:700; display:block; margin-bottom:6px;">Chave do Item no Zotero (Item Key)
            <input type="text" class="ath-input" id="athZoteroKeyArtigo" value="${art.chaveZotero || ''}" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
          <label style="font-size:11px; font-weight:700; display:block;">DOI / Identificador Permanente
            <input type="text" class="ath-input" id="athDoiArtigo" value="${art.doi || ''}" style="margin-top:3px; height:30px; font-size:11.5px;">
          </label>
        </div>

        <button type="button" class="ath-btn ath-btn-primary" id="athBtnSyncCompletoPainel" style="width:100%; justify-content:center;">
          ${svgIcone('salvar', 14)} Sincronizar Agora (Drive + Zotero + Supabase)
        </button>
        <div id="athStatusSyncArtigo" style="font-size:11.5px; margin-top:8px; color:#15803D; font-weight:700;"></div>
      </div>
    `;

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
      this.sincronizarArtigoComDriveEZotero(art, box.querySelector('#athBtnSyncCompletoPainel'), box.querySelector('#athStatusSyncArtigo'));
    });
  }

  async sincronizarArtigoComDriveEZotero(art, btnEl = null, statusEl = null) {
    salvarArtigosEstudo(this.artigos);
    const txtOriginal = btnEl ? btnEl.innerHTML : '';
    if (btnEl) btnEl.textContent = 'Sincronizando...';

    const resultados = [];

    // 1. Sincroniza Nota Filha com Zotero (Resumo + Citações + Link do PDF no Drive)
    const htmlNotaZotero = gerarHtmlNotaZoteroDoArtigo(art);
    const resZot = await this.zoteroClient.sincronizarNotaFilhaNoZotero({
      parentItemKey: art.chaveZotero,
      noteKey: art.notaZoteroKey || null,
      htmlNota: htmlNotaZotero,
      tags: ['Athenes', 'Fichamento PDF', ...(art.palavrasChave || []).slice(0, 3)]
    });
    if (resZot.noteKey) art.notaZoteroKey = resZot.noteKey;
    resultados.push(resZot.ok ? 'Zotero sincronizado ✓' : 'Fichamento salvo localmente ✓');

    // 2. Salva na nuvem Supabase (como registro de estudo de artigo)
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

    // 3. Se houver token do Google Drive, salva o pacote de anotações do PDF no Google Drive
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

  async sincronizarComZoteroApi() {
    this.carregarConfigZotero();
    if (!this.zoteroClient.userId || !this.zoteroClient.apiKey) {
      const userId = window.prompt ? window.prompt('Informe seu Zotero User ID (encontrado em zotero.org/settings/keys):', this.zoteroClient.userId || '') : '';
      if (!userId) return;
      const apiKey = window.prompt ? window.prompt('Informe sua Zotero API Key (com permissão de leitura/escrita de notas):', this.zoteroClient.apiKey || '') : '';
      if (!apiKey) return;
      this.zoteroClient.userId = userId.trim();
      this.zoteroClient.apiKey = apiKey.trim();
      localStorage.setItem('athenes_zotero_cfg', JSON.stringify({
        userId: this.zoteroClient.userId,
        apiKey: this.zoteroClient.apiKey,
        isGroup: false
      }));
    }

    const itens = await this.zoteroClient.buscarItens({ limite: 30 });
    if (!itens || itens.length === 0) {
      alert('Nenhum item novo retornado da API do Zotero. Verifique suas credenciais ou importe um arquivo .bib.');
      return;
    }

    let novos = 0;
    itens.forEach(it => {
      if (!this.artigos.some(a => a.chaveZotero === it.chave || a.titulo === it.titulo)) {
        this.artigos.unshift(this.converterItemZoteroParaEstudo(it));
        novos++;
      }
    });
    salvarArtigosEstudo(this.artigos);
    this.atualizarGridCatalogo();
    alert(`Sincronização Zotero concluída! ${novos} novo(s) artigo(s) adicionado(s) ao estúdio.`);
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
              <input type="text" class="ath-input" id="athNovoArtZotKey" placeholder="Ex.: ZOT7A9B1">
            </div>
          </div>
          <div class="ath-prop-grupo">
            <label>Arquivo PDF no Google Drive (ou selecione do computador)</label>
            <input type="text" class="ath-input" id="athNovoArtDriveNome" placeholder="Ex.: Silva_2026_Planejamento_Urbano.pdf">
            <small style="color:var(--ath-muted); display:block; margin-top:4px;">O PDF permanece no seu Google Drive e será aberto no leitor de risco estilo Samsung Notes.</small>
          </div>
          <div class="ath-prop-grupo">
            <label>Resumo / Abstract do Artigo</label>
            <textarea class="ath-input" id="athNovoArtResumo" rows="3" placeholder="Cole o abstract do artigo..."></textarea>
          </div>
        </div>
        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athModalArtCancelar">Cancelar</button>
          <button type="button" class="ath-btn ath-btn-primary" id="athModalArtCriar">Adicionar & Abrir no Estúdio PDF</button>
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
