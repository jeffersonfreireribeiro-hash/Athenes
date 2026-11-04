// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO, normalizarEvento, normalizarAtalho, resolverAcao, construirIndice, conflitos, formatarAtalho, textoAtalhos,
  tooltipComAtalho, filtrarCatalogo, localizarOcorrencias, substituirOcorrencias, detectarMac, acaoPorId, atalhosDaAcao, ehAtalhoDeFormatacaoDireta
} from '../src/core/athenes_atalhos.js';

const ev = (code, o = {}) => ({ code, key: o.key ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code), ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });

test('Ctrl no Windows/Linux e Cmd no macOS casam como Mod', () => {
  assert.equal(normalizarEvento(ev('KeyZ', { ctrlKey: true }), false), 'Mod+Z');
  assert.equal(normalizarEvento(ev('KeyZ', { metaKey: true }), true), 'Mod+Z');
  assert.equal(normalizarEvento(ev('KeyZ', { ctrlKey: true }), true), 'Ctrl+Z');
  assert.equal(normalizarEvento(ev('KeyZ', { metaKey: true }), false), 'Z');
  assert.equal(normalizarEvento(ev('KeyF', { ctrlKey: true, altKey: true, shiftKey: true }), false), 'Mod+Alt+Shift+F');
  assert.equal(normalizarEvento({ code: 'ControlLeft', key: 'Control', ctrlKey: true }, false), null);
});

test('letras e dígitos independem do layout; pontuação usa o caractere (ABNT2)', () => {
  assert.equal(normalizarEvento(ev('KeyZ', { key: 'y', ctrlKey: true }), false), 'Mod+Z');
  assert.equal(normalizarEvento(ev('IntlRo', { key: '/', ctrlKey: true }), false), 'Mod+/');
  assert.equal(normalizarEvento(ev('IntlRo', { key: '?', ctrlKey: true, shiftKey: true }), false), 'Mod+?');
  assert.equal(normalizarEvento(ev('Digit1', { key: '!', ctrlKey: true, altKey: true }), false), 'Mod+Alt+1');
  assert.equal(normalizarEvento(ev('Period', { key: '.', ctrlKey: true }), false), 'Mod+.');
  assert.equal(normalizarEvento(ev('Period', { key: '≥', metaKey: true, altKey: true }), true), 'Mod+Alt+.');
  assert.equal(normalizarEvento(ev('Space', { key: ' ', ctrlKey: true }), false), 'Mod+Space');
});

test('catálogo: sem atalhos duplicados em nenhuma plataforma', () => {
  assert.deepEqual(conflitos(false), []);
  assert.deepEqual(conflitos(true), []);
  assert.ok(CATALOGO.length >= 25);
  assert.equal(new Set(CATALOGO.map(a => a.id)).size, CATALOGO.length);
});

test('variações por plataforma: refazer, próxima ocorrência, ir para', () => {
  const win = (id) => atalhosDaAcao(acaoPorId(id), false);
  const mac = (id) => atalhosDaAcao(acaoPorId(id), true);
  assert.deepEqual(win('refazer'), ['Mod+Y', 'Mod+Shift+Z']);
  assert.deepEqual(mac('refazer'), ['Mod+Shift+Z']);
  assert.deepEqual(win('proxima_ocorrencia'), ['F3']);
  assert.deepEqual(mac('proxima_ocorrencia'), ['Mod+G']);
  assert.deepEqual(win('ir_para'), ['Mod+G']);
  assert.deepEqual(mac('ir_para'), ['Mod+Alt+G']);
  assert.deepEqual(mac('ocorrencia_anterior'), ['Mod+Shift+G']);
});

test('escopo: formatação só na edição; "/" só na edição; globais sempre', () => {
  const ctrlK = ev('KeyK', { ctrlKey: true });
  assert.equal(resolverAcao(ctrlK, { contexto: { editavel: false } }), null);
  assert.equal(resolverAcao(ctrlK, { contexto: { editavel: true } }).id, 'link');
  assert.equal(resolverAcao(ev('KeyS', { ctrlKey: true }), { contexto: { editavel: false } }).id, 'salvar');
  assert.equal(resolverAcao(ev('KeyF', { ctrlKey: true }), { contexto: {} }).id, 'localizar');
  assert.equal(resolverAcao(ev('KeyH', { ctrlKey: true }), { contexto: {} }).id, 'substituir');
  assert.equal(resolverAcao(ev('Slash', { key: '/' }), { contexto: { editavel: true } }).id, 'comandos');
  assert.equal(resolverAcao(ev('Slash', { key: '/' }), { contexto: { editavel: false } }), null);
  assert.equal(resolverAcao(ev('Enter', { ctrlKey: true }), { contexto: {} }).id, 'quebra_pagina');
  assert.equal(resolverAcao(ev('Enter', { shiftKey: true }), { contexto: { editavel: true } }).id, 'quebra_linha');
});

test('catálogo completo do prompt é resolvido por evento', () => {
  const casos = [
    ['KeyZ', { ctrlKey: true }, 'desfazer'], ['KeyY', { ctrlKey: true }, 'refazer'], ['KeyZ', { ctrlKey: true, shiftKey: true }, 'refazer'],
    ['KeyV', { ctrlKey: true, shiftKey: true }, 'colar_puro'], ['KeyA', { ctrlKey: true }, 'selecionar_tudo'],
    ['KeyK', { ctrlKey: true }, 'link'], ['Backslash', { ctrlKey: true, key: '\\' }, 'limpar_formatacao'], ['Space', { ctrlKey: true, key: ' ' }, 'limpar_formatacao'],
    ['Tab', {}, 'recuo_aumentar'], ['Tab', { shiftKey: true }, 'recuo_diminuir'], ['F3', {}, 'proxima_ocorrencia'], ['F3', { shiftKey: true }, 'ocorrencia_anterior'],
    ['KeyG', { ctrlKey: true }, 'ir_para'], ['KeyF', { ctrlKey: true, altKey: true }, 'nota_rodape'], ['Digit1', { ctrlKey: true, altKey: true }, 'titulo1'],
    ['Digit2', { ctrlKey: true, altKey: true }, 'titulo2'], ['Digit3', { ctrlKey: true, altKey: true }, 'titulo3'], ['Digit0', { ctrlKey: true, altKey: true }, 'texto_normal'],
    ['KeyP', { ctrlKey: true }, 'exportar'], ['Slash', { ctrlKey: true, key: '/' }, 'guia_atalhos'], ['Slash', { ctrlKey: true, shiftKey: true, key: '?' }, 'guia_atalhos']
  ];
  for (const [code, o, id] of casos) {
    const a = resolverAcao(ev(code, o), { contexto: { editavel: true } });
    assert.equal(a?.id, id, `${code} ${JSON.stringify(o)} → ${a?.id}`);
  }
  const mac = (code, o) => resolverAcao(ev(code, { metaKey: true, ...o }), { mac: true, contexto: { editavel: true } })?.id;
  assert.equal(mac('KeyZ', { shiftKey: true }), 'refazer');
  assert.equal(mac('KeyG', {}), 'proxima_ocorrencia');
  assert.equal(mac('KeyG', { shiftKey: true }), 'ocorrencia_anterior');
  assert.equal(mac('KeyG', { altKey: true }), 'ir_para');
  assert.equal(mac('KeyF', { altKey: true }), 'nota_rodape');
  assert.equal(mac('KeyY', {}) ?? null, null);
});

test('glifos: Ctrl+Shift+Z no Windows, ⇧⌘Z no macOS', () => {
  assert.equal(formatarAtalho('Mod+Shift+Z', false), 'Ctrl+Shift+Z');
  assert.equal(formatarAtalho('Mod+Shift+Z', true), '⇧⌘Z');
  assert.equal(formatarAtalho('Mod+Alt+F', true), '⌥⌘F');
  assert.equal(formatarAtalho('Mod+Enter', true), '⌘↵');
  assert.equal(textoAtalhos(acaoPorId('refazer'), false), 'Ctrl+Y / Ctrl+Shift+Z');
  assert.equal(tooltipComAtalho('Localizar', 'localizar', false), 'Localizar (Ctrl+F)');
  assert.equal(tooltipComAtalho('Localizar', 'localizar', true), 'Localizar (⌘F)');
  assert.equal(tooltipComAtalho('Algo', 'inexistente'), 'Algo');
});

test('personalização substitui o atalho padrão da ação', () => {
  const idx = construirIndice(false, { localizar: 'Ctrl+Shift+B' });
  assert.equal(idx.get('Mod+Shift+B').id, 'localizar');
  assert.equal(idx.get('Mod+F'), undefined);
  assert.equal(normalizarAtalho('ctrl+shift+b'), 'Mod+Shift+B');
  assert.equal(normalizarAtalho('Cmd+Option+F'), 'Mod+Alt+F');
});

test('detectarMac', () => {
  assert.equal(detectarMac({ platform: 'MacIntel' }), true);
  assert.equal(detectarMac({ platform: 'Win32' }), false);
  assert.equal(detectarMac({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), false);
});

test('guia de atalhos: busca por rótulo, categoria e tecla, sem acento', () => {
  assert.ok(filtrarCatalogo('').historico.length > 3);
  assert.deepEqual(Object.keys(filtrarCatalogo('inserir link')), ['inline']);
  assert.ok(filtrarCatalogo('formatacao').inline.length >= 1);
  assert.ok(filtrarCatalogo('ctrl+h', false).busca.some(a => a.id === 'substituir'));
  assert.deepEqual(filtrarCatalogo('zzzz'), {});
});

test('busca: ocorrências, maiúsculas, palavra inteira e substituição', () => {
  assert.deepEqual(localizarOcorrencias('Casa casa CASA', 'casa'), [[0, 4], [5, 9], [10, 14]]);
  assert.deepEqual(localizarOcorrencias('Casa casa', 'casa', { maiusculas: true }), [[5, 9]]);
  assert.deepEqual(localizarOcorrencias('casa casaco', 'casa', { palavraInteira: true }), [[0, 4]]);
  assert.deepEqual(localizarOcorrencias('aaa', 'aa'), [[0, 2]]);
  assert.deepEqual(localizarOcorrencias('x', ''), []);
  assert.deepEqual(substituirOcorrencias('a b a b', 'a', 'X'), { texto: 'X b X b', quantidade: 2 });
  assert.deepEqual(substituirOcorrencias('a b a b', 'a', 'X', {}, 1), { texto: 'a b X b', quantidade: 1 });
  assert.deepEqual(substituirOcorrencias('abc', 'z', 'X'), { texto: 'abc', quantidade: 0 });
});

test('formatação direta: Ctrl/Cmd+B, I, U e Ctrl/Cmd+Shift+L/E/R/J são bloqueados; o resto não', () => {
  for (const code of ['KeyB', 'KeyI', 'KeyU']) {
    assert.equal(ehAtalhoDeFormatacaoDireta(ev(code, { ctrlKey: true })), true, code);
    assert.equal(ehAtalhoDeFormatacaoDireta(ev(code, { metaKey: true })), true, `${code} Cmd`);
  }
  for (const code of ['KeyL', 'KeyE', 'KeyR', 'KeyJ']) {
    assert.equal(ehAtalhoDeFormatacaoDireta(ev(code, { ctrlKey: true, shiftKey: true })), true, code);
    assert.equal(ehAtalhoDeFormatacaoDireta(ev(code, { metaKey: true, shiftKey: true })), true, `${code} Cmd`);
  }
  assert.equal(ehAtalhoDeFormatacaoDireta(ev('KeyB', {})), false);
  assert.equal(ehAtalhoDeFormatacaoDireta(ev('KeyF', { ctrlKey: true })), false);
  assert.equal(ehAtalhoDeFormatacaoDireta(ev('KeyL', { ctrlKey: true })), false);
  assert.equal(ehAtalhoDeFormatacaoDireta(ev('KeyV', { ctrlKey: true, shiftKey: true })), false);
});

test('atalhos de bloco: duplicar, excluir e mover existem, sem conflito com os outros', () => {
  for (const id of ['bloco_duplicar', 'bloco_excluir', 'bloco_subir', 'bloco_descer']) assert.ok(acaoPorId(id), id);
  assert.deepEqual(acaoPorId('bloco_duplicar').atalhos, ['Mod+Shift+D']);
  assert.deepEqual(acaoPorId('bloco_excluir').atalhos, ['Mod+Shift+Backspace']);
  assert.deepEqual(conflitos(false), []);
  assert.deepEqual(conflitos(true), []);
});
