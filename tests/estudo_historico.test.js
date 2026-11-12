// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HistoricoLinear,
  clonarEstadoArtigo,
  aplicarEstadoArtigo,
  clonarEstadoCatalogo,
  restaurarEstadoCatalogo,
  deveIgnorarAtalhoHistoricoEmElemento,
  classificarAtalhoHistorico
} from '../src/core/athenes_estudo_historico.js';

test('HistoricoLinear registra estados, deduplica repetidos, desfaz e refaz', () => {
  const hist = new HistoricoLinear({ limite: 4, estadoInicial: { v: 1 } });
  assert.equal(hist.podeDesfazer(), false);
  assert.equal(hist.podeRefazer(), false);

  assert.equal(hist.registrar({ v: 1 }), false);
  assert.equal(hist.registrar({ v: 2 }), true);
  assert.equal(hist.registrar({ v: 3 }), true);

  assert.equal(hist.podeDesfazer(), true);
  assert.deepEqual(hist.desfazer(), { v: 2 });
  assert.equal(hist.podeRefazer(), true);
  assert.deepEqual(hist.desfazer(), { v: 1 });
  assert.equal(hist.podeDesfazer(), false);
  assert.equal(hist.desfazer(), null);

  assert.deepEqual(hist.refazer(), { v: 2 });
  assert.deepEqual(hist.refazer(), { v: 3 });
  assert.equal(hist.podeRefazer(), false);
  assert.equal(hist.refazer(), null);
});

test('HistoricoLinear trunca ramo futuro ao editar apos desfazer e respeita limite', () => {
  const hist = new HistoricoLinear({ limite: 3, estadoInicial: { v: 1 } });
  hist.registrar({ v: 2 });
  hist.registrar({ v: 3 });
  assert.deepEqual(hist.desfazer(), { v: 2 });
  assert.equal(hist.podeRefazer(), true);

  hist.registrar({ v: 99 });
  assert.equal(hist.podeRefazer(), false);
  assert.deepEqual(hist.atual(), { v: 99 });

  hist.registrar({ v: 100 });
  hist.registrar({ v: 101 });
  assert.equal(hist.pilha.length, 3);
  assert.deepEqual(hist.desfazer(), { v: 100 });
  assert.deepEqual(hist.desfazer(), { v: 99 });
  assert.equal(hist.desfazer(), null);
});

test('clonarEstadoArtigo e aplicarEstadoArtigo preservam tracos, grifos, notas, citacoes e blob ativo', () => {
  const art = {
    id: 'art_1',
    titulo: 'Acustica em Teatros',
    autores: [{ sobrenome: 'Ribeiro', prenome: 'J.' }],
    ano: 2026,
    pdfBlobUrl: 'blob:vivo-123',
    temPdfLocal: true,
    conteudoPaginasPdf: [
      { numero: 1, real: true, htmlGrifado: '' }
    ],
    fichamento: {
      resumoPessoal: 'Inicial',
      metodologiaNotas: '',
      tracosPorPagina: { 1: [] },
      grifosPorPagina: { 1: [] },
      notasPagina: { 1: [] },
      citacoesMarcadas: []
    }
  };

  const snap0 = clonarEstadoArtigo(art);

  art.fichamento.tracosPorPagina[1].push({ tipo: 'caneta', pontos: [{ x: 10, y: 10 }, { x: 40, y: 40 }] });
  art.fichamento.grifosPorPagina[1].push({ xPct: 10, yPct: 20, wPct: 30, hPct: 3, cor: '#FDE047' });
  art.fichamento.notasPagina[1].push({ id: 'pin_1', titulo: 'Nota', texto: 'Obs', xPct: 50, yPct: 30 });
  art.fichamento.citacoesMarcadas.push({ id: 'cit_1', pagina: 1, texto: 'Trecho citado' });
  art.conteudoPaginasPdf[0].htmlGrifado = '<p><mark>Trecho</mark></p>';
  art.conteudoPaginasPdf.push({ numero: 2, extra: true, titulo: 'Folha 2' });
  art.fichamento.resumoPessoal = 'Atualizado';
  art.palavrasChave = ['acustica', 'teatro'];

  const snap1 = clonarEstadoArtigo(art);

  aplicarEstadoArtigo(art, snap0);
  assert.equal(art.pdfBlobUrl, 'blob:vivo-123');
  assert.equal(art.temPdfLocal, true);
  assert.equal(art.fichamento.tracosPorPagina[1].length, 0);
  assert.equal(art.fichamento.grifosPorPagina[1].length, 0);
  assert.equal(art.fichamento.notasPagina[1].length, 0);
  assert.equal(art.fichamento.citacoesMarcadas.length, 0);
  assert.equal(art.conteudoPaginasPdf.length, 1);
  assert.equal(art.conteudoPaginasPdf[0].htmlGrifado, '');
  assert.equal(art.fichamento.resumoPessoal, 'Inicial');

  aplicarEstadoArtigo(art, snap1);
  assert.equal(art.fichamento.tracosPorPagina[1].length, 1);
  assert.equal(art.fichamento.grifosPorPagina[1].length, 1);
  assert.equal(art.fichamento.notasPagina[1].length, 1);
  assert.equal(art.fichamento.citacoesMarcadas.length, 1);
  assert.equal(art.conteudoPaginasPdf.length, 2);
  assert.equal(art.conteudoPaginasPdf[0].htmlGrifado, '<p><mark>Trecho</mark></p>');
  assert.equal(art.fichamento.resumoPessoal, 'Atualizado');
  assert.deepEqual(art.palavrasChave, ['acustica', 'teatro']);
});

test('clonarEstadoCatalogo e restaurarEstadoCatalogo desfazem movimentos e edicoes preservando binarios', () => {
  const artigos = [
    {
      id: 'a1',
      titulo: 'Artigo 1',
      pastaId: 'pasta_bib_raiz',
      corCapa: '#1E3A5F',
      pdfBlobUrl: 'blob:pdf-a1',
      temPdfLocal: true
    }
  ];
  const pastas = [{ id: 'p_nova', nome: 'Metodologia', cor: '#314F79' }];
  const snapAntes = clonarEstadoCatalogo(artigos, pastas);

  artigos[0].pastaId = 'p_nova';
  artigos[0].corCapa = '#D97706';
  const pastasDepois = [{ id: 'p_nova', nome: 'Metodologia Renomeada', cor: '#15803D' }];
  const snapDepois = clonarEstadoCatalogo(artigos, pastasDepois);

  assert.equal('pdfBlobUrl' in snapAntes.artigos[0], false);

  const restauradoAntes = restaurarEstadoCatalogo(artigos, snapAntes);
  assert.equal(restauradoAntes.artigos[0].pastaId, 'pasta_bib_raiz');
  assert.equal(restauradoAntes.artigos[0].corCapa, '#1E3A5F');
  assert.equal(restauradoAntes.artigos[0].pdfBlobUrl, 'blob:pdf-a1');
  assert.equal(restauradoAntes.pastas[0].nome, 'Metodologia');

  const restauradoDepois = restaurarEstadoCatalogo(restauradoAntes.artigos, snapDepois);
  assert.equal(restauradoDepois.artigos[0].pastaId, 'p_nova');
  assert.equal(restauradoDepois.artigos[0].corCapa, '#D97706');
  assert.equal(restauradoDepois.pastas[0].nome, 'Metodologia Renomeada');
});

test('classificarAtalhoHistorico reconhece Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y e ignora campos editaveis', () => {
  const divLivre = { tagName: 'DIV', isContentEditable: false };
  const inputEl = { tagName: 'INPUT', isContentEditable: false };
  const textareaEl = { tagName: 'TEXTAREA', isContentEditable: false };
  const editavelEl = { tagName: 'P', isContentEditable: true };

  assert.equal(deveIgnorarAtalhoHistoricoEmElemento(divLivre), false);
  assert.equal(deveIgnorarAtalhoHistoricoEmElemento(inputEl), true);
  assert.equal(deveIgnorarAtalhoHistoricoEmElemento(textareaEl), true);
  assert.equal(deveIgnorarAtalhoHistoricoEmElemento(editavelEl), true);

  assert.equal(
    classificarAtalhoHistorico({ key: 'z', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, target: divLivre }, false),
    'desfazer'
  );
  assert.equal(
    classificarAtalhoHistorico({ key: 'Z', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: divLivre }, false),
    'refazer'
  );
  assert.equal(
    classificarAtalhoHistorico({ key: 'y', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, target: divLivre }, false),
    'refazer'
  );
  assert.equal(
    classificarAtalhoHistorico({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, target: divLivre }, true),
    'desfazer'
  );
  assert.equal(
    classificarAtalhoHistorico({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false, target: divLivre }, true),
    'refazer'
  );
  assert.equal(
    classificarAtalhoHistorico({ key: 'z', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, target: inputEl }, false),
    null
  );
});
