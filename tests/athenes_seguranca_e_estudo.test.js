// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  escapeHtml,
  sanitizarHtmlEditorial,
  sanitizarDocumentoImportado,
  obterOuRestaurarSelecaoDoBloco
} from '../src/core/athenes_seguranca.js';
import {
  criarArtigosEstudoExemplo,
  formatarCitacaoAbntDoArtigo,
  gerarHtmlNotaZoteroDoArtigo,
  calcularPontoFinalLinhaReta
} from '../src/ui/athenes_estudo_artigos.js';
import { ZoteroClient } from '../src/core/athenes_zotero.js';

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
  assert.equal(limpo.secoes[0].blocos[0].texto.includes('<i>mundo</i>'), true);
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
  const codigoEstudo = fs.readFileSync(path.resolve('src/ui/athenes_estudo_artigos.js'), 'utf8');
  const cssDash = fs.readFileSync(path.resolve('src/css/athenes_dashboard.css'), 'utf8');

  assert.equal(codigoEstudo.includes('rm-conteudo ath-estudio-full-shell'), true);
  assert.equal(codigoEstudo.includes('athEstudioColEsq'), true);
  assert.equal(codigoEstudo.includes('athEstudioColPrev'), true);
  assert.equal(codigoEstudo.includes('athEstudioColDir'), true);
  assert.equal(codigoEstudo.includes('rm-barra-blocos'), true);
  assert.equal(cssDash.includes('.ath-dashboard.ath-dashboard-estudio-full'), true);
});

test('Estúdio de Artigos renderiza todas as páginas em rolagem contínua, suporta linha reta, editor inline sem prompt nativo e popover de seleção de texto', () => {
  const codigoEstudo = fs.readFileSync(path.resolve('src/ui/athenes_estudo_artigos.js'), 'utf8');

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

test('DashboardView possui sincronização com Supabase e backup de espaço para multi-PC', () => {
  const codigoDash = fs.readFileSync(path.resolve('src/ui/athenes_dashboard.js'), 'utf8');

  assert.equal(codigoDash.includes('athBtnSincronizarNuvem'), true);
  assert.equal(codigoDash.includes('athBtnBackupEspaco'), true);
  assert.equal(codigoDash.includes('sincronizarComSupabase'), true);
  assert.equal(codigoDash.includes('exportarBackupEspaco'), true);
  assert.equal(codigoDash.includes('restaurarBackupEspaco'), true);
  assert.equal(codigoDash.includes('listarDocumentosDoSupabase'), true);
  assert.equal(codigoDash.includes('carregarDocumentoDoSupabase'), true);
});

test('Google Drive & PDF no Estúdio de Artigos: popover organizado, extração de ID de pasta e fallback amigável sem embed quebrado', () => {
  const codigoEstudo = fs.readFileSync(path.resolve('src/ui/athenes_estudo_artigos.js'), 'utf8');
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
  const codigoEditor = fs.readFileSync(path.resolve('src/ui/athenes_editor.js'), 'utf8');
  assert.equal(codigoEditor.includes('renderizarListaEstilosContextuais'), true);
  assert.equal(codigoEditor.includes('abrirPainelZotero()'), true);
  assert.equal(codigoEditor.includes('this.doc.referencias.push(ref)'), true);
});
