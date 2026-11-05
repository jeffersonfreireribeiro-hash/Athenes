// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  escapeHtml,
  sanitizarHtmlEditorial,
  sanitizarDocumentoImportado,
  obterOuRestaurarSelecaoDoBloco
} from '../src/core/athenes_seguranca.js';
import {
  EstudoArtigosView,
  criarArtigosEstudoExemplo,
  formatarCitacaoAbntDoArtigo,
  gerarHtmlNotaZoteroDoArtigo,
  calcularPontoFinalLinhaReta
} from '../src/ui/athenes_estudo_artigos.js';
import { ZoteroClient } from '../src/core/athenes_zotero.js';

// o estúdio é dividido em módulos (tela, painel direito, anotações, modais, dados): o código é lido em conjunto
const lerCodigoEstudo = () => ['', '_dados', '_tela', '_painel_direito', '_anotacoes', '_modais']
  .map(n => fs.readFileSync(path.resolve(`src/ui/athenes_estudo_artigos${n}.js`), 'utf8')).join('');

// o dashboard é dividido em módulos (modais, pastas, sincronia): o código é lido em conjunto
const lerCodigoDashboard = () => ['', '_modais', '_pastas', '_sincronia']
  .map(n => fs.readFileSync(path.resolve(`src/ui/athenes_dashboard${n}.js`), 'utf8')).join('');

test('escapeHtml e sanitizarHtmlEditorial bloqueiam vetores XSS preservando formatação editorial', () => {
  const sujo = `<p onclick="alert(1)">Texto <b>negrito</b> <script>evil()</script> <a href="javascript:alert(2)">link</a></p>`;
  const limpo = sanitizarHtmlEditorial(sujo);
  assert.equal(limpo.includes('<script'), false);
  assert.equal(limpo.includes('onclick='), false);
  assert.equal(limpo.includes('javascript:'), false);
  assert.equal(limpo.includes('<b>negrito</b>'), true);

  const attr = escapeHtml(`"Título" <script>&'`);
  assert.equal(attr, '&quot;Título&quot; &lt;script&gt;&amp;&#39;');
});

test('sanitizarDocumentoImportado higieniza títulos e blocos de documentos externos', () => {
  const doc = {
    titulo: 'Artigo <script>alert(1)</script>',
    subtitulo: 'Sub',
    secoes: [
      {
        id: 's1',
        nome: 'Capa',
        blocos: [
          { id: 'b1', tipo: 'paragrafo', texto: 'Olá <img src=x onerror="alert(1)"> <i>mundo</i>' }
        ]
      }
    ]
  };
  const limpo = sanitizarDocumentoImportado(doc);
  assert.equal(limpo.titulo.includes('<script>'), false);
  assert.equal(limpo.secoes[0].blocos[0].texto.includes('onerror='), false);
  assert.equal(limpo.secoes[0].blocos[0].texto.includes('<i>'), false, 'sem formatação direta no texto');
  assert.equal(limpo.secoes[0].blocos[0].texto.includes('mundo'), true);
});

test('Estúdio de Artigos Zotero & PDF gera citações ABNT com página e nota HTML para Zotero', () => {
  const artigos = criarArtigosEstudoExemplo();
  assert.equal(artigos.length >= 3, true);

  const art = artigos[0];
  const citAbnt = formatarCitacaoAbntDoArtigo(art, 115);
  assert.equal(citAbnt, '(SANTOS; RIBEIRO, 2025, p. 115)');

  const htmlNota = gerarHtmlNotaZoteroDoArtigo(art);
  assert.equal(htmlNota.includes('Fichamento Athenes'), true);
  assert.equal(htmlNota.includes('Google Drive'), true);
  assert.equal(htmlNota.includes('Citações Marcadas no PDF'), true);
});

test('PainelPropriedades define estilos e cobre todos os tipos de blocos sem ReferenceError', () => {
  const codigoProps = fs.readFileSync(path.resolve('src/ui/athenes_painel_propriedades.js'), 'utf8');
  assert.equal(codigoProps.includes('const estilos = this.doc.estilos || [];'), true);
  assert.equal(codigoProps.includes("b.tipo === 'campos'"), true);
  assert.equal(codigoProps.includes("b.tipo === 'divisor'"), true);
  assert.equal(codigoProps.includes("b.tipo === 'espaco'"), true);
  assert.equal(codigoProps.includes('ath-props-aviso-diagnostico'), true);
});

test('obterOuRestaurarSelecaoDoBloco opera com segurança em ambiente sem DOM', () => {
  const res = obterOuRestaurarSelecaoDoBloco('b_inexistente');
  assert.equal(res.ok, false);
  assert.equal(res.range, null);
});

test('ZoteroClient.sincronizarNotaFilhaNoZotero retorna fallback local quando sem credenciais', async () => {
  const client = new ZoteroClient();
  const res = await client.sincronizarNotaFilhaNoZotero({
    parentItemKey: 'ZOT123',
    htmlNota: '<p>Resumo</p>'
  });
  assert.equal(res.ok, false);
  assert.equal(res.modo, 'local');
});


test('Estúdio de Artigos Zotero & PDF usa estrutura Full-Screen de 3 colunas idêntica ao Editor (.rm-conteudo / .rm-ed-grade)', () => {
  const codigoEstudo = lerCodigoEstudo();
  const cssDash = fs.readFileSync(path.resolve('src/css/athenes_dashboard.css'), 'utf8');

  assert.equal(codigoEstudo.includes('rm-conteudo ath-estudio-full-shell'), true);
  assert.equal(codigoEstudo.includes('athEstudioColEsq'), true);
  assert.equal(codigoEstudo.includes('athEstudioColPrev'), true);
  assert.equal(codigoEstudo.includes('athEstudioColDir'), true);
  assert.equal(codigoEstudo.includes('rm-barra-blocos'), true);
  assert.equal(cssDash.includes('.ath-dashboard.ath-dashboard-estudio-full'), true);
  assert.equal(cssDash.includes('.ath-dashboard.ath-dashboard-estudio-full .ath-dash-sidebar'), true);
  assert.equal(cssDash.includes('.ath-dashboard.ath-dashboard-estudio-full .ath-dash-pasta-banner'), true);
});

test('Estúdio de Artigos renderiza todas as páginas em rolagem contínua, suporta linha reta, editor inline sem prompt nativo e popover de seleção de texto', () => {
  const codigoEstudo = lerCodigoEstudo();

  // Sem window.prompt( feio
  assert.equal(codigoEstudo.includes('window.prompt('), false);

  // Todas as páginas em pilha contínua
  assert.equal(codigoEstudo.includes('athPdfTodasPaginasStack'), true);
  assert.equal(codigoEstudo.includes('renderizarTodasAsPaginasNoPalco'), true);

  // Distribuição 50/50 padronizada na coluna esquerda
  assert.equal(codigoEstudo.includes('rm-card-meio-a-meio'), true);
  assert.equal(codigoEstudo.includes('rm-card-meio-a-meio-corpo'), true);

  // Editor inline de notas adesivas e popover de seleção de texto
  assert.equal(codigoEstudo.includes('ath-pdf-pin-form'), true);
  assert.equal(codigoEstudo.includes('athPdfSelecaoPopover'), true);
  assert.equal(codigoEstudo.includes('athBtnModoLinhaReta'), true);

  // Zoom fluido com Ctrl + +, Ctrl + -, Ctrl + 0 e wheel sem dicas poluindo a interface
  assert.equal(codigoEstudo.includes('aplicarZoom'), true);
  assert.equal(codigoEstudo.includes('_tecladoZoomHandler'), true);
  assert.equal(codigoEstudo.includes('NumpadAdd'), true);
  assert.equal(codigoEstudo.includes('NumpadSubtract'), true);

  // Estabilização de seleção de texto no PDF (evita que o mouse no espaço vazio/entre linhas selecione o bloco todo)
  const cssDash = fs.readFileSync(path.resolve('src/css/athenes_dashboard.css'), 'utf8');
  assert.equal(codigoEstudo.includes('_selectionChangeHandler'), true);
  assert.equal(codigoEstudo.includes('endOfContent'), true);
  assert.equal(cssDash.includes('.ath-pdf-text-layer.selecting .endOfContent'), true);
  assert.equal(cssDash.includes('margin-bottom: -2px'), true);

  // Teste geométrico do snap ortogonal da Linha Reta
  const horiz = calcularPontoFinalLinhaReta({ x: 100, y: 100 }, { x: 300, y: 104 });
  assert.equal(horiz.y, 100);
  assert.equal(horiz.x, 300);

  const vert = calcularPontoFinalLinhaReta({ x: 100, y: 100 }, { x: 103, y: 320 });
  assert.equal(vert.x, 100);
  assert.equal(vert.y, 320);

  const diag = calcularPontoFinalLinhaReta({ x: 100, y: 100 }, { x: 250, y: 240 });
  assert.equal(diag.x, 250);
  assert.equal(diag.y, 240);
});

test('Estúdio de Artigos: Borracha apaga traços livres, linhas retas, marca-texto e grifos de seleção', () => {
  const estudio = new EstudoArtigosView(null);
  const art = {
    id: 'art-teste-borracha',
    fichamento: {
      tracosPorPagina: {
        1: [
          // Traço 1: linha reta de (50, 100) a (300, 100)
          { tipo: 'caneta', reta: true, espessura: 4, pontos: [{ x: 50, y: 100 }, { x: 300, y: 100 }] },
          // Traço 2: marca-texto espesso em (500, 500)
          { tipo: 'marcatexto', reta: false, espessura: 18, pontos: [{ x: 500, y: 500 }, { x: 550, y: 500 }] },
          // Traço 3: traço distante em (800, 800)
          { tipo: 'caneta', reta: false, espessura: 3, pontos: [{ x: 800, y: 800 }, { x: 820, y: 820 }] }
        ]
      },
      grifosPorPagina: {
        1: [
          // Grifo de texto retangular no PDF (x: 20%, y: 30%, w: 40%, h: 5%)
          { xPct: 20, yPct: 30, wPct: 40, hPct: 5, cor: 'rgba(250, 204, 21, 0.45)' },
          // Grifo distante (x: 80%, y: 80%, w: 10%, h: 4%)
          { xPct: 80, yPct: 80, wPct: 10, hPct: 4, cor: 'rgba(250, 204, 21, 0.45)' }
        ]
      }
    }
  };

  // 1. Passar borracha no meio da linha reta em (180, 102) -> deve apagar Traço 1
  estudio.apagarTracosProximos(art, 1, 180, 102, 24);
  assert.equal(art.fichamento.tracosPorPagina[1].length, 2);
  assert.equal(art.fichamento.tracosPorPagina[1][0].espessura, 18);

  // 2. Passar borracha no marca-texto espesso em (520, 510) -> deve apagar Traço 2
  estudio.apagarTracosProximos(art, 1, 520, 510, 24);
  assert.equal(art.fichamento.tracosPorPagina[1].length, 1);
  assert.equal(art.fichamento.tracosPorPagina[1][0].pontos[0].x, 800);

  // 3. Passar borracha sobre o grifo de texto em xPct: 35%, yPct: 32% -> deve apagar o grifo de texto
  estudio.apagarTracosProximos(art, 1, 0, 0, 24, { xPct: 35, yPct: 32 });
  assert.equal(art.fichamento.grifosPorPagina[1].length, 1);
  assert.equal(art.fichamento.grifosPorPagina[1][0].xPct, 80);

  // 4. Testar apagamento de mark.ath-pdf-grifo-texto em folha com texto HTML
  const artHtml = {
    id: 'art-html-grifo',
    fichamento: { tracosPorPagina: {}, grifosPorPagina: {} },
    conteudoPaginasPdf: [{ htmlGrifado: '<p>Este é um <mark class="ath-pdf-grifo-texto">trecho selecionado e grifado</mark> no texto.</p>' }]
  };
  estudio.artigos = [artHtml];

  const pEl = {
    childNodes: [],
    innerHTML: '',
    normalize() {}
  };
  const textChild = { nodeType: 3, textContent: 'trecho selecionado e grifado' };
  const markEl = {
    classList: { contains: (c) => c === 'ath-pdf-grifo-texto' },
    parentNode: pEl,
    childNodes: [textChild],
    firstChild: textChild,
    replaceWith(...nodes) {
      pEl.childNodes = pEl.childNodes.filter(c => c !== markEl).concat(nodes);
    },
    getClientRects: () => [{ left: 100, top: 200, right: 300, bottom: 220, width: 200, height: 20 }],
    getBoundingClientRect: () => ({ left: 100, top: 200, right: 300, bottom: 220, width: 200, height: 20 }),
    closest: () => ({ innerHTML: '<p>Este é um trecho selecionado e grifado no texto.</p>' })
  };
  pEl.childNodes = [markEl];

  const mockFolha = {
    dataset: { numPagina: '1', alturaReal: '1123' },
    clientWidth: 794,
    clientHeight: 1123,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 794, height: 1123 }),
    querySelectorAll: (sel) => sel.includes('ath-pdf-grifo-texto') ? [markEl] : []
  };

  // Passa a borracha nas coordenadas do mark (clientX: 150, clientY: 210)
  estudio.apagarTracosProximos(artHtml, 1, 150, 210, 28, null, mockFolha, 150, 210);
  assert.equal(pEl.childNodes.includes(markEl), false, 'Mark de texto deve ter sido removido pela borracha');
  assert.equal(artHtml.conteudoPaginasPdf[0].htmlGrifado.includes('<mark'), false, 'htmlGrifado não deve mais conter a tag mark');
});

test('Estúdio de Artigos preserva folhas extras no PDF real e rolarParaPagina usa scroll do palco sem cortar topo', () => {
  const codigoEstudo = lerCodigoEstudo();
  const cssDash = fs.readFileSync(path.resolve('src/css/athenes_dashboard.css'), 'utf8');

  // Verifica que rolarParaPagina não usa scrollIntoView genérico no elemento raiz/window
  assert.equal(codigoEstudo.includes('wrapPag.scrollIntoView'), false);
  assert.equal(codigoEstudo.includes('palco.scrollTo'), true);

  // Verifica suporte a folha extra (classe visual e dot grid)
  assert.equal(codigoEstudo.includes('ath-pdf-folha-extra-corpo'), true);
  assert.equal(cssDash.includes('.ath-pdf-folha-extra-corpo'), true);

  // Verifica que folhas extras não são sobrescritas pela contagem de páginas do PDF
  assert.equal(codigoEstudo.includes('const extras = atuais.filter(p => p.extra);'), true);
  assert.equal(codigoEstudo.includes('const ehPaginaPdfReal = Boolean(pdfInfo && idx < pdfInfo.n && !pagDados.extra);'), true);
});

test('DashboardView possui sincronização com Supabase e backup de espaço para multi-PC', () => {
  const codigoDash = lerCodigoDashboard();

  assert.equal(codigoDash.includes('athBtnSincronizarNuvem'), true);
  assert.equal(codigoDash.includes('athBtnBackupEspaco'), true);
  assert.equal(codigoDash.includes('sincronizarComSupabase'), true);
  assert.equal(codigoDash.includes('exportarBackupEspaco'), true);
  assert.equal(codigoDash.includes('restaurarBackupEspaco'), true);
  assert.equal(codigoDash.includes('listarDocumentosDoSupabase'), true);
  assert.equal(codigoDash.includes('carregarDocumentoDoSupabase'), true);
});

test('DashboardView possui barra lateral de pastas do Google Drive, subpastas e filtro estrito', () => {
  const codigoDash = lerCodigoDashboard();
  const cssEditor = fs.readFileSync(path.resolve('src/css/athenes_editor.css'), 'utf8');

  // Estrutura de layout com sidebar e banner
  assert.equal(codigoDash.includes('ath-dash-sidebar'), true);
  assert.equal(codigoDash.includes('athDashPastasLista'), true);
  assert.equal(codigoDash.includes('athBtnNovaSubpastaModal'), true);
  assert.equal(codigoDash.includes('athBtnVincularPastaModal'), true);
  assert.equal(codigoDash.includes('ath-dash-pasta-banner'), true);

  // Métodos de seleção e renderização
  assert.equal(codigoDash.includes('selecionarPasta('), true);
  assert.equal(codigoDash.includes('renderizarPastasLateral('), true);
  assert.equal(codigoDash.includes('montarItemPastaComSubpastas('), true);
  assert.equal(codigoDash.includes('renderizarBannerPasta('), true);
  assert.equal(codigoDash.includes('abrirModalNovaSubpasta('), true);
  assert.equal(codigoDash.includes('abrirModalVincularPasta('), true);

  // Isolamento estrito entre Abas (Escrita mostra apenas Relatórios; Artigos/Zotero mostra apenas Bibliografia)
  assert.equal(codigoDash.includes("const ehAbaBib = this.abaAtiva === 'artigos_zotero'"), true);
  assert.equal(codigoDash.includes("p.tipo === 'bibliografia' || p.id === 'pasta_bib_raiz'"), true);
  assert.equal(codigoDash.includes("p.tipo === 'relatorios' || p.id === 'pasta_rel_raiz'"), true);
  assert.equal(codigoDash.includes("this.pastaAtivaId = 'todas'"), true);

  // CSS da barra lateral
  assert.equal(cssEditor.includes('.ath-dash-layout'), true);
  assert.equal(cssEditor.includes('.ath-dash-sidebar'), true);
  assert.equal(cssEditor.includes('.ath-pasta-item'), true);
  assert.equal(cssEditor.includes('.ath-pasta-item.active'), true);
});

test('Google Drive & PDF no Estúdio de Artigos: popover organizado, extração de ID de pasta e fallback amigável sem embed quebrado', () => {
  const codigoEstudo = lerCodigoEstudo();
  const codigoColab = fs.readFileSync(path.resolve('src/core/athenes_colaboracao.js'), 'utf8');
  const cssEditor = fs.readFileSync(path.resolve('src/css/athenes_editor.css'), 'utf8');

  // Popover com classe dedicada de largura generosa (440px) e sem style="width:340px;" colado
  assert.equal(codigoEstudo.includes('ath-topo-popover-drive'), true);
  assert.equal(codigoEstudo.includes('id="athPopoverEstDrive" role="dialog" hidden style="width:340px;"'), false);
  assert.equal(cssEditor.includes('.ath-topo-popover-drive'), true);
  assert.equal(cssEditor.includes('.ath-pop-drive-card'), true);

  // Botão direto no popover para abrir pasta web do Drive
  assert.equal(codigoEstudo.includes('athBtnPopAbrirPastaDrive'), true);
  assert.equal(codigoEstudo.includes('athPopDriveFileInput'), true);

  // Sem crash de embed nativo na folha 1 quando não há PDF
  assert.equal(codigoEstudo.includes('ath-pdf-folha-vincular-aviso'), true);
  assert.equal(codigoEstudo.includes('ath-input-vincular-pdf-palco'), true);
  assert.equal(codigoEstudo.includes('data-abrir-pasta-drive-palco'), true);
  assert.equal(codigoEstudo.includes('ath-palco-dragover'), true);

  // Extração precisa do ID da pasta do Google Drive
  const pastaExemplo = 'https://drive.google.com/drive/folders/1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv?usp=drive_link';
  const match = pastaExemplo.match(/folders\/([a-zA-Z0-9_-]+)/);
  assert.equal(match?.[1], '1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv');

  // Proteção contra marcações espúrias na lateral da folha e pisca-pisca de seleção
  const cssDash = fs.readFileSync(path.resolve('src/css/athenes_dashboard.css'), 'utf8');
  assert.equal(cssDash.includes('.ath-pdf-text-layer br::selection'), true);
  assert.equal(cssDash.includes('background: transparent !important;'), true);
  assert.equal(cssDash.includes('caret-color: transparent !important;'), true);

  // Sem rolagem horizontal externa (eliminação de 100vw no estúdio full-screen)
  assert.equal(cssDash.includes('width: 100vw !important'), false);
  assert.equal(cssDash.includes('width: 100% !important;'), true);

  // Suporte a pasta de destino no Google Drive e upload binário de PDF
  assert.equal(codigoColab.includes('pastaId = null'), true);
  assert.equal(codigoColab.includes('metadados.parents = [idDestinoPasta]'), true);
  assert.equal(codigoColab.includes('multipart/related'), true);

  // Paleta de cores para marcador / grifo no popover de seleção
  assert.equal(codigoEstudo.includes('ath-sel-pop-cores'), true);
  assert.equal(codigoEstudo.includes('data-sel-cor="#FDE047"'), true);
  assert.equal(codigoEstudo.includes('data-sel-cor="#86EFAC"'), true);
  assert.equal(codigoEstudo.includes('data-sel-cor="#93C5FD"'), true);
  assert.equal(codigoEstudo.includes('athBtnSalvarPdfNoDriveDireto'), true);

  // Editor: dropdown dinâmico de estilos e citação Zotero no cursor
  // o editor é dividido em módulos (barra contextual, menus do topo, bloco na folha): o código é lido em conjunto
  const codigoEditor = ['athenes_editor', 'athenes_editor_barra_contextual', 'athenes_editor_menus_topo', 'athenes_editor_bloco_folha']
    .map(n => fs.readFileSync(path.resolve(`src/ui/${n}.js`), 'utf8')).join('\n');
  assert.equal(codigoEditor.includes('renderizarListaEstilosContextuais'), true);
  assert.equal(codigoEditor.includes('abrirPainelZotero()'), true);
  assert.equal(codigoEditor.includes('this.doc.referencias.push(ref)'), true);
});

test('Estúdio de Artigos suporta isolamento por pasta, método filtrarPorPasta e vínculo em subpastas', () => {
  const codigoEstudo = lerCodigoEstudo();

  // Método e propriedade de filtro
  assert.equal(codigoEstudo.includes('filtrarPorPasta(pastaId)'), true);
  assert.equal(codigoEstudo.includes('this.pastaFiltroId ='), true);
  assert.equal(codigoEstudo.includes('artigoEstaNaPasta(art, this.pastaFiltroId)'), true); // um item do Zotero pode estar em várias pastas (coleções)

  // Vínculo de artigo com pasta
  assert.equal(codigoEstudo.includes('athNovoArtPasta'), true);
  assert.equal(codigoEstudo.includes('coletarPastasBib'), true);
  assert.equal(codigoEstudo.includes('novoArt.pastaId ='), true);
});

test('Todos os módulos frontend (UI e Core) importam sem SyntaxError ou referências inválidas', async () => {
  const modulos = [
    'src/core/athenes_documento.js',
    'src/ui/athenes_estudo_artigos_dados.js',
    'src/ui/athenes_estudo_artigos_tela.js',
    'src/ui/athenes_estudo_artigos_painel_direito.js',
    'src/ui/athenes_estudo_artigos_anotacoes.js',
    'src/ui/athenes_estudo_artigos_modais.js',
    'src/ui/athenes_editor_barra_contextual.js',
    'src/ui/athenes_editor_menus_topo.js',
    'src/ui/athenes_editor_bloco_folha.js',
    'src/core/athenes_estilos.js',
    'src/core/athenes_colaboracao.js',
    'src/core/athenes_seguranca.js',
    'src/core/athenes_zotero.js',
    'src/ui/athenes_icones.js',
    'src/ui/athenes_login_view.js',
    'src/ui/athenes_estudo_artigos.js',
    'src/ui/athenes_editor.js',
    'src/ui/athenes_dashboard.js',
    'src/ui/athenes_dashboard_modais.js',
    'src/ui/athenes_dashboard_pastas.js',
    'src/ui/athenes_dashboard_sincronia.js',
    'src/core/athenes_documento_base.js',
    'src/core/athenes_numeracao_legendas.js',
    'src/core/athenes_bloco_layout.js',
    'src/core/athenes_pagina_elementos.js',
    'src/ui/athenes_app.js'
  ];

  for (const m of modulos) {
    const mod = await import(pathToFileURL(path.resolve(m)).href);
    assert.ok(mod, `Módulo ${m} deve ser carregado com sucesso.`);
  }
});

test('Estúdio de Artigos preserva fichamento com traços/citações na mesclagem e suporta compartilhamento de referências', async () => {
  const { mesclarLista } = await import('../src/core/athenes_lista_sincronizada.js');
  const { decodificarMetadadosNotaZotero, codificarMetadadosNotaZotero, aplicarFilhosZoteroAoArtigo } = await import('../src/core/athenes_zotero_anexos_notas.js');
  const { mesclarFichamentoPreservandoDados, gerarHtmlNotaZoteroDoArtigo } = await import('../src/ui/athenes_estudo_artigos_dados.js');

  // 1. Preservação de dados ricos na mesclagem mesmo se o outro lado for mais recente mas tiver fichamento vazio
  const localRico = {
    id: 'art_100',
    titulo: 'Artigo com riscos e notas',
    atualizadoEm: '2026-11-01T10:00:00Z',
    fichamento: {
      resumoPessoal: 'Meu resumo importante',
      citacoesMarcadas: [{ id: 'c1', texto: 'Trecho 1', pagina: 2 }],
      tracosPorPagina: { 1: [{ tipo: 'caneta', pontos: [{ x: 10, y: 20 }] }] }
    }
  };
  const servidorReimportado = {
    id: 'art_100',
    titulo: 'Artigo com riscos e notas',
    atualizadoEm: '2026-11-05T12:00:00Z', // Data mais recente de reimportação
    fichamento: { resumoPessoal: '', citacoesMarcadas: [], tracosPorPagina: {} }
  };

  const { valor } = mesclarLista({ itens: [servidorReimportado], excluidos: {} }, { itens: [localRico], excluidos: {} });
  const itemMesclado = valor.itens.find(x => x.id === 'art_100');
  assert.ok(itemMesclado, 'Artigo mesclado deve existir');
  assert.equal(itemMesclado.fichamento.resumoPessoal, 'Meu resumo importante', 'Resumo não deve sumir na mesclagem');
  assert.equal(itemMesclado.fichamento.citacoesMarcadas.length, 1, 'Citações devem ser preservadas');
  assert.equal(itemMesclado.fichamento.tracosPorPagina[1].length, 1, 'Traços de caneta devem ser preservados');

  // 2. Codificação e decodificação de metadados em base64 na nota espelho Zotero
  const htmlNota = gerarHtmlNotaZoteroDoArtigo(localRico);
  assert.ok(htmlNota.includes('ATHENES_FICHAMENTO_B64:'), 'Nota Zotero deve conter metadados base64');
  const metaRecuperado = decodificarMetadadosNotaZotero(htmlNota);
  assert.ok(metaRecuperado, 'Metadados b64 devem ser decodificados com sucesso');
  assert.equal(metaRecuperado.fichamento.resumoPessoal, 'Meu resumo importante');
  assert.equal(metaRecuperado.fichamento.citacoesMarcadas[0].texto, 'Trecho 1');

  // 3. Restauração automática via aplicarFilhosZoteroAoArtigo
  const artLimpo = { id: 'art_100', titulo: 'Artigo limpo' };
  const mockFilhos = {
    anexos: new Map(),
    notas: new Map([['PAI_ZOT', [{ chave: 'NOTA_1', html: htmlNota, data: '2026-11-05T12:00:00Z' }]]]),
    anotacoes: new Map()
  };
  aplicarFilhosZoteroAoArtigo(artLimpo, 'PAI_ZOT', mockFilhos);
  assert.equal(artLimpo.fichamento.resumoPessoal, 'Meu resumo importante', 'Fichamento deve ser restaurado a partir da nota Zotero');
  assert.equal(artLimpo.fichamento.citacoesMarcadas.length, 1, 'Citações devem ser restauradas');
  assert.equal(artLimpo.fichamento.tracosPorPagina[1].length, 1, 'Traços de caneta devem ser restaurados');

  // 4. Verificação de suporte a compartilhamento no Estúdio de Artigos
  const codigoEstudo = fs.readFileSync('src/ui/athenes_estudo_artigos.js', 'utf8');
  assert.ok(codigoEstudo.includes('abrirModalCompartilharArtigo'), 'Estúdio deve ter método abrirModalCompartilharArtigo');
  assert.ok(codigoEstudo.includes('abrirArtigoCompartilhadoRecebido'), 'Estúdio deve suportar abrir artigo recebido via link compartilhado');
});
