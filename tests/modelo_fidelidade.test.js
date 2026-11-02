// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento, margensTextoPt, colapsoEntreBlocosPt, estimarAlturaBlocoPt } from '../src/core/athenes_documento.js';
import { FONTES_SISTEMA, criarEstilosPadrao } from '../src/core/athenes_estilos.js';
import { registrarFonteImportada, removerFonteImportada, cssFontesImportadas, listarFontesImportadas, formatoDoArquivo, nomeSugerido, slugFonte, fontesUsadasNoDocumento } from '../src/core/athenes_fontes.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { criarElementoLivre } from '../src/core/athenes_mestra_canvas.js';
import { elementosMestraHtml } from '../src/core/athenes_mestra_render.js';

const estilos = () => Object.fromEntries(criarEstilosPadrao('abnt').map(e => [e.id, e]));

test('Aptos vem no catálogo e usa a instalada, com reserva parecida', () => {
  assert.ok(FONTES_SISTEMA.aptos);
  assert.match(FONTES_SISTEMA.aptos.familia, /^Aptos,/);
  assert.match(FONTES_SISTEMA.aptos.familia, /Segoe UI|Calibri/);
});

test('fonte importada entra no catálogo, vai embutida no PDF e pode ser removida', () => {
  assert.equal(formatoDoArquivo('Aptos-Regular.TTF'), 'ttf');
  assert.equal(formatoDoArquivo('x.exe'), null);
  assert.equal(nomeSugerido('Aptos-Bold.ttf'), 'Aptos');
  assert.equal(nomeSugerido('MinhaFonteLegal_Regular.otf'), 'Minha Fonte Legal');
  assert.equal(slugFonte('Fonte Ação 2'), 'fonte_acao_2');
  const f = registrarFonteImportada({ nome: 'Aptos Teste', formato: 'ttf', dataUrl: 'data:font/ttf;base64,AAAA' });
  assert.ok(FONTES_SISTEMA[f.id].importada);
  assert.match(FONTES_SISTEMA[f.id].familia, /^'Aptos Teste', /);
  assert.throws(() => registrarFonteImportada({ nome: '  ' }), /nome/i);
  assert.throws(() => registrarFonteImportada({ id: 'nunito', nome: 'Nunito' }), /sistema/);
  const doc = criarDocumento({ titulo: 'T' });
  doc.estilos.find(e => e.id === 'corpo').fonte = f.id;
  assert.ok(fontesUsadasNoDocumento(doc).has(f.id));
  assert.match(cssFontesImportadas(doc), /@font-face\{font-family:'Aptos Teste';src:url\(data:font\/ttf;base64,AAAA\) format\('truetype'\)/);
  repaginarDocumento(doc);
  assert.match(gerarDocumentoHtmlPdf(doc), /@font-face\{font-family:'Aptos Teste'/);
  const sem = criarDocumento({ titulo: 'S' });
  assert.equal(cssFontesImportadas(sem), '', 'só embute a fonte que o documento usa');
  assert.ok(removerFonteImportada(f.id));
  assert.equal(FONTES_SISTEMA[f.id], undefined);
  assert.equal(listarFontesImportadas().some(x => x.id === f.id), false);
  assert.equal(removerFonteImportada('nunito'), false, 'fonte do sistema não se remove');
});

test('espaço entre parágrafos colapsa: vale o maior, não a soma (como no Word)', () => {
  const e = estilos();
  const a = criarNovoBloco('paragrafo', { texto: 'a', espaco_depois_pt: 18 });
  const b = criarNovoBloco('paragrafo', { texto: 'b', espaco_antes_pt: 12 });
  assert.deepEqual(margensTextoPt(b, e), { antes: 12, depois: e.corpo.espaco_depois_pt ?? 0 });
  assert.equal(colapsoEntreBlocosPt(a, b, e), 12);
  assert.equal(colapsoEntreBlocosPt(b, a, e), Math.min(b.espaco_depois_pt ?? e.corpo.espaco_depois_pt ?? 0, a.espaco_antes_pt ?? e.corpo.espaco_antes_pt ?? 0));
  assert.equal(colapsoEntreBlocosPt(a, criarNovoBloco('tabela', {}), e), 0, 'só entre blocos de texto');
  assert.equal(colapsoEntreBlocosPt(a, { ...b, grupo: 'g1' }, e), 0, 'blocos lado a lado não colapsam');
});

test('PDF: margens colapsadas, topo da página sem espaço antes e sem margem padrão de <p>', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const sec = doc.secoes.find(s => s.mestraId === 'corpo');
  sec.blocos = [
    criarNovoBloco('paragrafo', { id: 'p1', texto: 'um', espaco_antes_pt: 10, espaco_depois_pt: 18 }),
    criarNovoBloco('paragrafo', { id: 'p2', texto: 'dois', espaco_antes_pt: 12, espaco_depois_pt: 0 })
  ];
  repaginarDocumento(doc);
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /margin-top:-10pt;[^>]*>(?:(?!ath-bloco-grid)[\s\S])*?data-id="p1"/, 'topo da página: o "antes" do 1º bloco é anulado');
  assert.match(html, /margin-top:-12pt;[^>]*>(?:(?!ath-bloco-grid)[\s\S])*?data-id="p2"/, 'entre p1 (18 depois) e p2 (12 antes) sobra 18, não 30');
  assert.match(html, /\.ath-bloco \{ margin-top: 0; margin-bottom: 0; \}/);
});

test('altura estimada de parágrafo respeita tamanho, entrelinha e largura (11 pt simples ≠ 18 pt/linha fixo)', () => {
  const e = estilos();
  const ctx = { estilos: e, larguraPt: 482 }; // 170 mm
  const p = criarNovoBloco('paragrafo', { texto: 'x'.repeat(300) });
  p.estiloId = 'corpo';
  const comEstilo = estimarAlturaBlocoPt(p, ctx);
  const antigo = estimarAlturaBlocoPt(p);
  assert.ok(comEstilo > 0 && comEstilo !== antigo);
  const apertado = criarNovoBloco('paragrafo', { texto: 'x'.repeat(300), entrelinha: 1.0, espaco_antes_pt: 0, espaco_depois_pt: 0 });
  assert.ok(estimarAlturaBlocoPt(apertado, ctx) < comEstilo, 'entrelinha menor ocupa menos');
  const largo = estimarAlturaBlocoPt(criarNovoBloco('paragrafo', { texto: 'x'.repeat(300), entrelinha: 1.0, espaco_antes_pt: 0, espaco_depois_pt: 0 }), { ...ctx, larguraPt: 900 });
  assert.ok(largo < estimarAlturaBlocoPt(apertado, ctx), 'coluna mais larga, menos linhas');
});

test('texto livre da mestra aceita id de fonte do catálogo e variáveis (rodapé do modelo)', () => {
  const el = criarElementoLivre('texto', { x_mm: 25, y_mm: 282.8, largura_mm: 170, altura_mm: 3.2, texto: '{pagina}', tamanho_pt: 7, cor: '#808080', alinhamento: 'direita', fonte: 'aptos' });
  const html = elementosMestraHtml({ elementos_recorrentes: [el] }, { numero: 3 }, { larguraMm: 210, alturaMm: 297, margens: { l: 25, r: 15, t: 40, b: 25 } }, { pagina: 3 });
  assert.match(html, /font-family:Aptos,/);
  assert.match(html, /text-align:right/);
  assert.match(html, />3</);
});
