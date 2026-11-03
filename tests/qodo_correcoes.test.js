// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { abrirZip } from '../src/core/athenes_zip_leitor.js';
import { ZipBuilder } from '../src/core/zip_builder.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { dimensoesPapelMm, MM_PARA_DXA } from '../src/core/athenes_grid.js';
import { obterTokenOuConectar } from '../src/core/athenes_drive_sync.js';

/** ZIP de 1 entrada com compressão deflate e tamanhos declarados à mão (permite forjar cabeçalhos mentirosos). */
function zipDeflate(nome, bruto, { tamOrigDeclarado = bruto.length } = {}) {
  const comp = deflateRawSync(bruto);
  const n = Buffer.from(nome);
  const local = Buffer.alloc(30 + n.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(tamOrigDeclarado, 22); local.writeUInt16LE(n.length, 26); n.copy(local, 30);
  const central = Buffer.alloc(46 + n.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(tamOrigDeclarado, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42); n.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length + comp.length, 16);
  return new Uint8Array(Buffer.concat([local, comp, central, eocd]));
}

test('zip: entrada que termina além do fim do arquivo (upload cortado) dá erro claro, não XML truncado', async () => {
  const z = new ZipBuilder(); z.add('word/document.xml', '<w:document>' + 'x'.repeat(5000) + '</w:document>');
  const inteiro = z.build();
  // corta o arquivo no meio do conteúdo da entrada, mas preserva o diretório central (como um download interrompido e remendado)
  const eocd = inteiro.length - 22, tamCentral = new DataView(inteiro.buffer, inteiro.byteOffset).getUint32(eocd + 12, true);
  const central = inteiro.slice(inteiro.length - 22 - tamCentral);
  const cortado = new Uint8Array([...inteiro.slice(0, 2000), ...central]);
  new DataView(cortado.buffer).setUint32(cortado.length - 22 + 16, 2000, true); // o diretório começa logo após o conteúdo cortado
  await assert.rejects(abrirZip(cortado).texto('word/document.xml'), /corrompido ou incompleto/);
});

test('zip: ZIP bomb é abortado durante a leitura (tamanho real acima do declarado) e entrada honesta continua funcionando', async () => {
  const bomba = zipDeflate('word/document.xml', Buffer.alloc(20 * 1024 * 1024, 0x61), { tamOrigDeclarado: 1000 });
  await assert.rejects(abrirZip(bomba).ler('word/document.xml'), /inconsistente/);
  const honesta = zipDeflate('a.xml', Buffer.from('<a>olá</a>'));
  assert.equal(await abrirZip(honesta).texto('a.xml'), '<a>olá</a>');
  const grande = zipDeflate('b.bin', Buffer.alloc(100, 1), { tamOrigDeclarado: 80 * 1024 * 1024 });
  await assert.rejects(abrirZip(grande).ler('b.bin'), /grande demais/);
});

test('DOCX: a tabulação do sumário usa a largura útil real da mestra (A3, Carta e paisagem), não a do A4', async () => {
  for (const [formato, orientacao] of [['A4', 'retrato'], ['A3', 'retrato'], ['Letter', 'retrato'], ['A4', 'paisagem']]) {
    const doc = criarDocumento({ titulo: 'T' });
    const corpo = doc.mestras.find(m => m.id === 'corpo');
    Object.assign(corpo, { formato, orientacao });
    const sec = doc.secoes.find(s => s.mestraId === 'corpo');
    sec.blocos = [criarNovoBloco('sumario', {}), criarNovoBloco('titulo', { nivel: 1, texto: 'Introdução' })];
    repaginarDocumento(doc);
    const xml = new TextDecoder('utf-8').decode(await exportarParaDocx(doc));
    const m = corpo.margens_mm;
    const esperado = Math.round((dimensoesPapelMm(formato, orientacao).largura_mm - m.l - m.r) * MM_PARA_DXA);
    const pos = [...xml.matchAll(/<w:tab w:val="right" w:leader="[a-z]+" w:pos="(\d+)"\/>/g)].map(x => Number(x[1]));
    assert.ok(pos.length >= 1, `${formato} ${orientacao}: o sumário tem tabulação com guia`);
    assert.ok(pos.every(v => Math.abs(v - esperado) <= 2), `${formato} ${orientacao}: pos ${pos[0]} ≠ ${esperado}`);
  }
});

test('Drive na interface: o token válido guardado é usado sem abrir o login', async () => {
  const cfg = { clientId: 'x', accessToken: 'tk-valido', accessTokenExpiraEm: Date.now() + 600000 };
  assert.equal(await obterTokenOuConectar(cfg), 'tk-valido');
});
