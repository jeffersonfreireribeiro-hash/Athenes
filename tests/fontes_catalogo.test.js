// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCatalogo, buscarNoCatalogo, escolherVariantes, idDoCatalogo, FONTES_POPULARES, VARIANTES_ESSENCIAIS } from '../src/core/athenes_fontes_catalogo.js';
import {
  registrarFonteImportada, removerFonteImportada, cssFontesImportadas, declaracaoDeFontes, sanearDeclaracaoDeFontes, fontesAusentes, registrarFontePendente, listarFontesImportadas
} from '../src/core/athenes_fontes.js';
import { FONTES_SISTEMA } from '../src/core/athenes_estilos.js';
import { criarDocumento } from '../src/core/athenes_documento.js';
import { baixarFamilia, hidratarFontesDoDocumento, fonteBaixada, sincronizarDeclaracaoDeFontes, descritorDoEstiloLocal, prepararFontesParaPdf, pesquisarFontes } from '../src/ui/athenes_fontes_ui.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo } from '../src/core/athenes_pacote_estilo.js';

const arq = (id, peso, estilo, sub = 'latin') => ({ url: { woff2: `https://cdn.jsdelivr.net/fontsource/fonts/${id}@5.0.0/${sub}-${peso}-${estilo}.woff2`, ttf: `https://cdn.jsdelivr.net/x/${peso}${estilo}.ttf` } });
const detalhe = (id, pesos, estilos = ['normal', 'italic']) => ({
  id, family: id.toUpperCase(), defSubset: 'latin', category: 'serif',
  variants: Object.fromEntries(pesos.map(p => [String(p), Object.fromEntries(estilos.map(e => [e, { latin: arq(id, p, e), 'latin-ext': arq(id, p, e, 'latin-ext') }]))]))
});

test('catálogo: normaliza, descarta lixo e entradas sem alfabeto latino, e busca por nome sem acento', () => {
  const lista = normalizarCatalogo([
    { id: 'montserrat', family: 'Montserrat', subsets: ['latin', 'latin-ext'], weights: [400, 700], styles: ['normal', 'italic'], category: 'sans-serif', type: 'google' },
    { id: 'eb-garamond', family: 'EB Garamond', subsets: ['latin'], weights: [400], styles: ['normal'], category: 'serif', type: 'google' },
    { id: 'noto-sans-jp', family: 'Noto Sans JP', subsets: ['japanese'], weights: [400], styles: ['normal'], category: 'sans-serif', type: 'google' },
    { id: '../hack', family: 'x' }, { family: 'sem id' }, null
  ]);
  assert.deepEqual(lista.map(f => f.id), ['montserrat', 'eb-garamond']);
  assert.equal(buscarNoCatalogo(lista, 'mont')[0].id, 'montserrat');
  assert.equal(buscarNoCatalogo(lista, 'garamond')[0].id, 'eb-garamond', 'palavra no meio do nome');
  assert.equal(buscarNoCatalogo(lista, 'EB GARAMOND')[0].id, 'eb-garamond');
  assert.deepEqual(buscarNoCatalogo(lista, ''), []);
  assert.equal(normalizarCatalogo('lixo').length, 0);
  assert.ok(FONTES_POPULARES.length >= 30 && buscarNoCatalogo(FONTES_POPULARES, 'inter').length);
  assert.equal(idDoCatalogo('EB Garamond'), 'eb-garamond');
});

test('escolherVariantes: baixa 400, 400i, 600, 700 e 700i; peso ausente usa o mais próximo; sem itálico não inventa', () => {
  const cheia = escolherVariantes(detalhe('lora', [400, 500, 600, 700]));
  assert.deepEqual(cheia.map(v => `${v.peso}${v.estilo[0]}`), ['400n', '400i', '600n', '700n', '700i']);
  assert.ok(cheia.every(v => v.url.startsWith('https://') && /latin-/.test(v.url) && !/latin-ext/.test(v.url) && v.formato === 'woff2'));
  const pobre = escolherVariantes(detalhe('so-regular', [400], ['normal']));
  assert.deepEqual(pobre.map(v => `${v.peso}${v.estilo[0]}`), ['400n'], '600 e 700 caem no 400 sem repetir; sem itálico');
  const so700 = escolherVariantes(detalhe('negrito', [300, 700], ['normal']));
  assert.deepEqual(so700.map(v => v.peso), [300, 700]);
  assert.deepEqual(escolherVariantes({}), []);
  assert.deepEqual(escolherVariantes({ variants: { 400: { normal: { latin: { url: { woff2: 'http://inseguro/x.woff2' } } } } } }), [], 'só https');
  assert.equal(VARIANTES_ESSENCIAIS.length, 5);
});

test('@font-face por variante: cada peso e estilo com o descritor exato (fim da discrepância de negrito/itálico)', () => {
  const doc = criarDocumento({ titulo: 'T' });
  registrarFonteImportada({ id: 'fonte_lora_t', nome: 'Lora T', origem: 'catalogo', catalogoId: 'lora', categoria: 'serif', variantes: [
    { peso: 400, estilo: 'normal', formato: 'woff2', dataUrl: 'data:font/woff2;base64,AAAA' },
    { peso: 400, estilo: 'italic', formato: 'woff2', dataUrl: 'data:font/woff2;base64,BBBB' },
    { peso: 700, estilo: 'normal', formato: 'woff2', dataUrl: 'data:font/woff2;base64,CCCC' },
    { peso: 700, estilo: 'italic', formato: 'woff2', dataUrl: 'data:font/woff2;base64,DDDD' }] });
  assert.equal(FONTES_SISTEMA.fonte_lora_t.rotulo, 'Lora T');
  assert.match(FONTES_SISTEMA.fonte_lora_t.familia, /Georgia/, 'reserva com serifa');
  doc.estilos.find(e => e.id === 'corpo').fonte = 'fonte_lora_t';
  const css = cssFontesImportadas(doc);
  assert.equal((css.match(/@font-face/g) || []).length, 4);
  assert.match(css, /font-weight:700;font-style:italic/);
  assert.match(css, /font-weight:400;font-style:normal/);
  assert.deepEqual(declaracaoDeFontes(doc), [{ id: 'fonte_lora_t', nome: 'Lora T', origem: 'catalogo', catalogoId: 'lora', categoria: 'serif' }]);
  removerFonteImportada('fonte_lora_t');
});

test('declarações de fonte: só dados curtos e conhecidos', () => {
  const l = sanearDeclaracaoDeFontes([{ id: 'fonte_a', nome: ' A ', origem: 'catalogo', catalogoId: 'a', categoria: 'serif', extra: 1 }, { id: '../x', nome: 'x' }, { id: 'fonte_b', nome: 'B', origem: 'zzz', catalogoId: 'Ruim Demais', categoria: 'qq' }, null, 'x']);
  assert.deepEqual(l, [{ id: 'fonte_a', nome: 'A', origem: 'catalogo', catalogoId: 'a', categoria: 'serif' }, { id: 'fonte_b', nome: 'B', origem: 'arquivo' }]);
  assert.deepEqual(sanearDeclaracaoDeFontes('x'), []);
});

function falsoFetch(mapa) {
  return async (url) => {
    const r = mapa(String(url));
    if (!r) throw new TypeError('offline');
    return { ok: true, status: 200, json: async () => r, arrayBuffer: async () => new Uint8Array([0, 1, 2, 3, 4]).buffer };
  };
}

test('FontManagerService: baixa a família inteira, registra e não baixa de novo', async () => {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = falsoFetch((url) => { chamadas.push(url); return url.includes('/v1/fonts/lora') ? detalhe('lora', [400, 500, 600, 700]) : {}; });
  try {
    const progresso = [];
    const e = await baixarFamilia({ id: 'lora', familia: 'LORA', categoria: 'serif' }, { aoProgresso: (p) => progresso.push(p) });
    assert.equal(e.id, 'fonte_lora');
    assert.equal(chamadas.length, 1 + 5, '1 detalhe + 5 variantes');
    assert.equal(listarFontesImportadas().find(f => f.id === 'fonte_lora').variantes.length, 5);
    assert.ok(fonteBaixada({ id: 'lora', familia: 'LORA' }));
    assert.equal(progresso.at(-1), 1);
    await baixarFamilia({ id: 'lora', familia: 'LORA' });
    assert.equal(chamadas.length, 6, 'já está na biblioteca: nenhuma nova requisição');
  } finally { globalThis.fetch = original; removerFonteImportada('fonte_lora'); }
});

test('hidratação: documento declarando fonte do catálogo baixa o que falta; offline vira falha com reserva', async () => {
  const doc = criarDocumento({ titulo: 'H' });
  doc.estilos.find(e => e.id === 'corpo').fonte = 'fonte_spectral';
  doc.fontes_declaradas = [{ id: 'fonte_spectral', nome: 'Spectral', origem: 'catalogo', catalogoId: 'spectral', categoria: 'serif' }];
  assert.equal(fontesAusentes(doc).length, 1);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = falsoFetch(() => null); // sem rede
    const off = await hidratarFontesDoDocumento(doc);
    assert.deepEqual(off.baixadas, []);
    assert.equal(off.falhas[0].nome, 'Spectral');
    assert.ok(FONTES_SISTEMA.fonte_spectral, 'a reserva já aparece no seletor');
    assert.equal((await prepararFontesParaPdf(doc)).ok, false, 'PDF avisa: a fonte não está carregada');
    globalThis.fetch = falsoFetch((url) => (url.includes('/v1/fonts/spectral') ? detalhe('spectral', [400, 700]) : {}));
    const on = await hidratarFontesDoDocumento(doc);
    assert.deepEqual(on.baixadas, ['Spectral']);
    assert.equal(fontesAusentes(doc).length, 0);
    assert.equal((await prepararFontesParaPdf(doc)).ok, true);
    assert.match(cssFontesImportadas(doc), /font-family:'Spectral'/);
    const arquivo = await hidratarFontesDoDocumento({ ...doc, fontes_declaradas: [{ id: 'fonte_spectral', nome: 'Spectral', origem: 'arquivo' }] });
    assert.deepEqual(arquivo.baixadas, [], 'já tem os binários');
  } finally { globalThis.fetch = original; removerFonteImportada('fonte_spectral'); }
});

test('documento: sincronizarDeclaracaoDeFontes grava só metadados, sem binários', () => {
  const doc = criarDocumento({ titulo: 'D' });
  registrarFonteImportada({ id: 'fonte_meta', nome: 'Meta', origem: 'catalogo', catalogoId: 'meta', variantes: [{ peso: 400, estilo: 'normal', formato: 'woff2', dataUrl: 'data:font/woff2;base64,AAAA' }] });
  doc.estilos.find(e => e.id === 'corpo').fonte = 'fonte_meta';
  sincronizarDeclaracaoDeFontes(doc);
  assert.equal(JSON.stringify(doc.fontes_declaradas).includes('base64'), false);
  doc.estilos.find(e => e.id === 'corpo').fonte = 'nunito';
  sincronizarDeclaracaoDeFontes(doc);
  assert.equal('fontes_declaradas' in doc, false);
  removerFonteImportada('fonte_meta');
});

test('busca no catálogo sem rede cai nas fontes populares', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = falsoFetch(() => null);
  try {
    const r = await pesquisarFontes('merriweather');
    assert.equal(r.origem, 'reserva');
    assert.equal(r.resultados[0].id, 'merriweather');
  } finally { globalThis.fetch = original; }
});

test('fontes do computador: peso e estilo pelo nome do estilo', () => {
  assert.deepEqual(descritorDoEstiloLocal('Bold Italic'), { peso: 700, estilo: 'italic' });
  assert.deepEqual(descritorDoEstiloLocal('SemiBold'), { peso: 600, estilo: 'normal' });
  assert.deepEqual(descritorDoEstiloLocal('Regular'), { peso: 400, estilo: 'normal' });
  assert.deepEqual(descritorDoEstiloLocal('Light Oblique'), { peso: 300, estilo: 'italic' });
});

test('pacote de tema: exporta, valida e aplica as fontes declaradas (sem binários) e continua aceitando temas antigos', () => {
  const doc = criarDocumento({ titulo: 'Tema' });
  registrarFonteImportada({ id: 'fonte_tema', nome: 'Tema Sans', origem: 'catalogo', catalogoId: 'tema-sans', categoria: 'sans-serif', variantes: [{ peso: 400, estilo: 'normal', formato: 'woff2', dataUrl: 'data:font/woff2;base64,AAAA' }] });
  doc.estilos.find(e => e.id === 'corpo').fonte = 'fonte_tema';
  const pacote = exportarPacoteEstilo(doc, { nome: 'Com fonte' });
  assert.deepEqual(pacote.fontes, [{ id: 'fonte_tema', nome: 'Tema Sans', origem: 'catalogo', catalogoId: 'tema-sans', categoria: 'sans-serif' }]);
  assert.equal(JSON.stringify(pacote).includes('base64,AAAA'), false);
  removerFonteImportada('fonte_tema');
  const v = validarPacoteEstilo(JSON.stringify({ ...pacote, fontes: [...pacote.fontes, { id: '../mau', nome: 'x' }] }));
  assert.equal(v.valido, true);
  assert.equal(v.pacote.fontes.length, 1);
  const outro = criarDocumento({ titulo: 'Outro' });
  aplicarPacoteEstilo(outro, v.pacote, { storage: null });
  assert.equal(outro.fontes_declaradas[0].catalogoId, 'tema-sans');
  assert.ok(FONTES_SISTEMA.fonte_tema, 'registrada como pendente até a hidratação baixar');
  assert.equal(fontesAusentes(outro).length, 1);
  removerFonteImportada('fonte_tema');
  const antigo = validarPacoteEstilo(JSON.stringify({ ...pacote, fontes: undefined }));
  assert.equal(antigo.valido, true);
  assert.equal('fontes' in antigo.pacote, false);
});

test('registrarFontePendente não sobrescreve fonte que já tem arquivo', () => {
  registrarFonteImportada({ id: 'fonte_ja', nome: 'Ja', origem: 'catalogo', variantes: [{ peso: 400, estilo: 'normal', formato: 'woff2', dataUrl: 'data:font/woff2;base64,AAAA' }] });
  registrarFontePendente({ id: 'fonte_ja', nome: 'Ja', origem: 'catalogo' });
  assert.equal(listarFontesImportadas().find(f => f.id === 'fonte_ja').pendente, false);
  removerFonteImportada('fonte_ja');
});
