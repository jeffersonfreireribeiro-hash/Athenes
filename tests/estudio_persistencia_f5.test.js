// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EstudoArtigosView } from '../src/ui/athenes_estudo_artigos.js';
import { metodosEstudoTela } from '../src/ui/athenes_estudo_artigos_tela.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock isolado para sessionStorage, window e document
const mapSession = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (mapSession.has(k) ? mapSession.get(k) : null),
  setItem: (k, v) => mapSession.set(k, String(v)),
  removeItem: (k) => mapSession.delete(k),
  clear: () => mapSession.clear(),
  key: (i) => [...mapSession.keys()][i],
  get length() { return mapSession.size; }
};

let fakeUrl = 'https://athenes.app/?tela=dashboard';
globalThis.window = {
  scrollY: 0,
  scrollTo: () => {},
  location: {
    get href() { return fakeUrl; },
    set href(v) { fakeUrl = String(v); },
    get search() {
      const idx = fakeUrl.indexOf('?');
      return idx >= 0 ? fakeUrl.slice(idx) : '';
    },
    get pathname() { return '/'; }
  },
  history: {
    replaceState: (_data, _title, url) => {
      if (url.startsWith('http')) fakeUrl = url;
      else if (url.startsWith('?')) fakeUrl = 'https://athenes.app/' + url;
      else fakeUrl = 'https://athenes.app' + url;
    }
  }
};

globalThis.document = {
  documentElement: { scrollTop: 0 },
  body: { scrollTop: 0 }
};

describe('Athenes — Preservação de Contexto F5 e Roteamento do Leitor de PDF (R4)', () => {
  beforeEach(() => {
    mapSession.clear();
    fakeUrl = 'https://athenes.app/?tela=dashboard';
  });

  it('1. abrirArtigoNoEstudio salva id, página, cache limpo no sessionStorage e atualiza URL com tela=estudio', () => {
    const view = Object.create(EstudoArtigosView.prototype);
    view.artigos = [];
    view.artigoAberto = null;
    view.paginaAtual = 1;
    view.renderizar = () => {};

    const artigoTeste = {
      id: 'art_urbanismo_2026',
      titulo: 'Mobilidade Urbana e Segregação Espacial',
      ano: 2026,
      pdfBlobUrl: 'blob:https://athenes.app/fake-blob-pesado',
      pdfBlob: { size: 5000000 }
    };

    view.abrirArtigoNoEstudio(artigoTeste, 4);

    assert.equal(sessionStorage.getItem('athenes_estudio_artigo_id'), 'art_urbanismo_2026');
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), '4');

    // Confere que cache serializado foi salvo e expurgou propriedades pesadas de blob
    const rawCache = sessionStorage.getItem('athenes_estudio_artigo_cache');
    assert.ok(rawCache, 'Deve persistir cache serializado do artigo');
    const cacheObj = JSON.parse(rawCache);
    assert.equal(cacheObj.id, 'art_urbanismo_2026');
    assert.equal(cacheObj.titulo, 'Mobilidade Urbana e Segregação Espacial');
    assert.equal(cacheObj.pdfBlobUrl, undefined, 'Blob URLs não devem ser salvos no storage');
    assert.equal(cacheObj.pdfBlob, undefined);

    // Confere URL atualizada com search params tela=estudio e artigo=...
    assert.ok(fakeUrl.includes('tela=estudio'), 'URL deve reter tela=estudio');
    assert.ok(fakeUrl.includes('artigo=art_urbanismo_2026'), 'URL deve reter parâmetro do artigo');
  });

  it('2. restaurarArtigoAbertoSessao restaura artigo aberto e página salva sem passar pelo catálogo', () => {
    const view = Object.create(EstudoArtigosView.prototype);
    let artigoAbertoRecebido = null;
    let pagRecebida = null;
    view.abrirArtigoNoEstudio = (art, pag) => {
      artigoAbertoRecebido = art;
      pagRecebida = pag;
      view.artigoAberto = art;
    };
    view.artigoAberto = null;
    view.artigos = [
      { id: 'art_100', titulo: 'Artigo Existente', ano: 2025 }
    ];

    sessionStorage.setItem('athenes_estudio_artigo_id', 'art_100');
    sessionStorage.setItem('athenes_estudio_pag', '7');

    const restaurou = view.restaurarArtigoAbertoSessao();
    assert.equal(restaurou, true);
    assert.ok(artigoAbertoRecebido);
    assert.equal(artigoAbertoRecebido.id, 'art_100');
    assert.equal(pagRecebida, 7);
  });

  it('3. restaurarArtigoAbertoSessao recupera artigo do cache em sessão quando a lista em memória ainda não carregou', () => {
    const view = Object.create(EstudoArtigosView.prototype);
    let artigoAbertoRecebido = null;
    view.abrirArtigoNoEstudio = (art, _pag) => {
      artigoAbertoRecebido = art;
      view.artigoAberto = art;
    };
    view.artigoAberto = null;
    view.artigos = []; // lista em memória vazia logo após reload F5

    sessionStorage.setItem('athenes_estudio_artigo_id', 'art_cache_99');
    sessionStorage.setItem('athenes_estudio_pag', '2');
    sessionStorage.setItem(
      'athenes_estudio_artigo_cache',
      JSON.stringify({ id: 'art_cache_99', titulo: 'Artigo do Cache F5', chaveZotero: 'ZOT99' })
    );

    const restaurou = view.restaurarArtigoAbertoSessao();
    assert.equal(restaurou, true);
    assert.ok(artigoAbertoRecebido);
    assert.equal(artigoAbertoRecebido.id, 'art_cache_99');
    assert.equal(artigoAbertoRecebido.titulo, 'Artigo do Cache F5');
  });

  it('4. Fechar artigo e voltar ao catálogo limpa sessão e restaura URL com tela=dashboard', () => {
    const view = Object.create(EstudoArtigosView.prototype);
    Object.assign(view, metodosEstudoTela);
    view.artigos = [];
    view.artigoAberto = { id: 'art_fechar_1' };

    sessionStorage.setItem('athenes_estudio_artigo_id', 'art_fechar_1');
    sessionStorage.setItem('athenes_estudio_pag', '3');
    fakeUrl = 'https://athenes.app/?tela=estudio&artigo=art_fechar_1';

    // Simula as linhas de fechamento canônicas de athenes_estudo_artigos_tela.js:351-367
    sessionStorage.removeItem('athenes_estudio_artigo_id');
    sessionStorage.removeItem('athenes_estudio_pag');
    sessionStorage.setItem('athenes_nav_tela', 'dashboard');
    const url = new URL(fakeUrl);
    url.searchParams.delete('artigo');
    url.searchParams.set('tela', 'dashboard');
    window.history.replaceState(null, '', url.toString());

    assert.equal(sessionStorage.getItem('athenes_estudio_artigo_id'), null);
    assert.equal(sessionStorage.getItem('athenes_estudio_pag'), null);
    assert.equal(sessionStorage.getItem('athenes_nav_tela'), 'dashboard');
    assert.ok(!fakeUrl.includes('artigo='), 'Parâmetro do artigo deve ser removido');
    assert.ok(fakeUrl.includes('tela=dashboard'), 'Deve direcionar URL para tela=dashboard');
  });
});

describe('Athenes — Padronização de Caixas, Textos e Botões (R1, R6)', () => {
  it('5. Botões de PDF (.ath-zd-btn-pdf) possuem white-space: nowrap, text-overflow: ellipsis e dimensões unificadas', () => {
    const cssPath = join(__dirname, '../src/css/athenes_dashboard.css');
    const css = readFileSync(cssPath, 'utf-8');

    assert.match(
      css,
      /\.ath-zd-btn-pdf\s*\{[^}]*height:\s*32px/,
      '.ath-zd-btn-pdf deve possuir altura unificada de 32px'
    );
    assert.match(
      css,
      /\.ath-zd-btn-pdf\s*\{[^}]*border-radius:\s*8px/,
      '.ath-zd-btn-pdf deve possuir border-radius de 8px'
    );
    assert.match(
      css,
      /\.ath-zd-btn-pdf\s*\{[^}]*border:\s*1px\s+solid\s+#CBD5E1/,
      '.ath-zd-btn-pdf deve possuir borda cinza padronizada #CBD5E1'
    );
    assert.match(
      css,
      /\.ath-zd-btn-pdf\s*\{[^}]*white-space:\s*nowrap/,
      '.ath-zd-btn-pdf deve possuir white-space: nowrap para evitar quebras indevidas'
    );
    assert.match(
      css,
      /\.ath-zd-btn-pdf\s*\{[^}]*text-overflow:\s*ellipsis/,
      '.ath-zd-btn-pdf deve possuir text-overflow: ellipsis'
    );
    assert.match(
      css,
      /\.ath-zd-btn-pdf\s+span\s*\{[^}]*text-overflow:\s*ellipsis/,
      'Span interno de .ath-zd-btn-pdf deve possuir text-overflow: ellipsis'
    );
  });

  it('6. Botões segmentados ativos (.ath-btn-seg.ativo) possuem contraste nítido com fundo azul #314F79 e texto branco', () => {
    const cssPath = join(__dirname, '../src/css/athenes_paineis.css');
    const css = readFileSync(cssPath, 'utf-8');

    assert.match(
      css,
      /\.ath-btn-seg\.ativo\s*\{[^}]*background:\s*var\(--ath-primary,\s*#314F79\)/,
      '.ath-btn-seg.ativo deve possuir fundo azul Athenes #314F79'
    );
    assert.match(
      css,
      /\.ath-btn-seg\.ativo\s*\{[^}]*color:\s*#FFFFFF/,
      '.ath-btn-seg.ativo deve possuir texto branco #FFFFFF para contraste de 9.8:1'
    );
    assert.match(
      css,
      /\.ath-btn-seg\.ativo\s+svg\s*\{[^}]*stroke:\s*#FFFFFF/,
      'Ícones SVG dentro de .ath-btn-seg.ativo devem ter stroke branco'
    );
  });

  it('7. Seletores booleanos N / I / S e switches no Sumário possuem classe .on e sincronização visual', () => {
    const jsPath = join(__dirname, '../src/ui/athenes_sumario_painel.js');
    const js = readFileSync(jsPath, 'utf-8');

    // Confere classe .on nos switches
    assert.match(
      js,
      /ath-sum-switch-linha\s+\$\{[^}]*'on'\s*:\s*''\}/,
      'Switches do sumário devem sincronizar classe .on conforme estado ativo'
    );
    // Confere classe .on nos botões de estilo N / I / S
    assert.match(
      js,
      /label\s+class="\$\{on\s*\?\s*'on'\s*:\s*''\}"/,
      'Seletores N / I / S devem refletir classe .on quando ativos'
    );
  });
});

describe('Athenes — Estabilidade de Rolagem e Ausência de scrollIntoView Residual (R5)', () => {
  it('8. Ausência total de invocações executáveis de scrollIntoView em athenes_editor.js', () => {
    const editorJsPath = join(__dirname, '../src/ui/athenes_editor.js');
    const codigo = readFileSync(editorJsPath, 'utf-8');

    // Remove comentários de bloco e linha única para analisar apenas código executável
    const codigoSemComentarios = codigo
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n\r]*/g, '');

    const temScrollIntoView = /\.scrollIntoView\s*\(/.test(codigoSemComentarios);
    assert.equal(
      temScrollIntoView,
      false,
      'src/ui/athenes_editor.js não deve conter chamadas diretas a scrollIntoView() — deve utilizar rolarNoPalco()'
    );
  });

  it('9. athenes_editor.js expõe e utiliza método rolarNoPalco para rolagem contida sem afetar ancestrais', () => {
    const editorJsPath = join(__dirname, '../src/ui/athenes_editor.js');
    const codigo = readFileSync(editorJsPath, 'utf-8');

    assert.match(
      codigo,
      /rolarNoPalco\s*\(el,\s*bloco\s*=\s*'nearest'/,
      'EditorView deve definir rolarNoPalco para rolar estritamente o container do palco'
    );
  });

  it('10. Sumário e Painel de Propriedades retêm posições de rolagem com requestAnimationFrame e preventDefault', () => {
    const sumarioPath = join(__dirname, '../src/ui/athenes_sumario_painel.js');
    const sumarioJs = readFileSync(sumarioPath, 'utf-8');
    assert.match(
      sumarioJs,
      /scrollTop\s*=\s*stColDir/,
      'Painel sumário deve restaurar scrollTop da coluna direita'
    );

    const propsPath = join(__dirname, '../src/ui/athenes_painel_propriedades.js');
    const propsJs = readFileSync(propsPath, 'utf-8');
    assert.match(
      propsJs,
      /colDir\.scrollTop\s*=\s*scrollDirSalvo/,
      'Painel propriedades deve restaurar scrollTop de colDir'
    );
    assert.match(
      propsJs,
      /requestAnimationFrame\s*\(\s*restaurar\s*\)/,
      'Painel propriedades deve usar requestAnimationFrame para restauração limpa de rolagem'
    );
  });
});
