// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { localDoPdfVinculado, organizarFilhosZotero } from '../src/core/athenes_zotero_anexos_notas.js';

const WIN = String.raw`C:\Users\Ana\Artigos\acustica\Badino 2020.pdf`;

test('PDF vinculado: mostra a pasta e o arquivo (caminho absoluto do Windows, Linux e relativo ao diretório-base)', () => {
  assert.deepEqual(localDoPdfVinculado({ caminho: WIN }), { pasta: String.raw`C:\Users\Ana\Artigos\acustica`, arquivo: 'Badino 2020.pdf', completo: WIN, relativo: false });
  assert.equal(localDoPdfVinculado({ caminho: '/home/ana/Zotero/a.pdf' }).pasta, '/home/ana/Zotero');
  const rel = localDoPdfVinculado({ caminho: 'attachments:Teatros/Cidades/x.pdf' });
  assert.deepEqual([rel.pasta, rel.arquivo, rel.relativo], ['Teatros/Cidades', 'x.pdf', true]);
  assert.equal(localDoPdfVinculado({ caminho: '' }), null);
  assert.equal(localDoPdfVinculado(null), null);
});

test('o caminho do anexo vinculado vem da API e fica no registro do anexo', () => {
  const { anexos } = organizarFilhosZotero([{ key: 'ATT1', data: { itemType: 'attachment', parentItem: 'PAI1', contentType: 'application/pdf', linkMode: 'linked_file', filename: 'a.pdf', path: String.raw`D:\Livros\a.pdf` } }]);
  assert.equal(anexos.get('PAI1').caminho, String.raw`D:\Livros\a.pdf`);
  assert.equal(anexos.get('PAI1').baixavel, false);
});
