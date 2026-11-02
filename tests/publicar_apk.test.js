// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { atualizarVersionJson, versaoValida, formatarTamanho } from '../tools/publicar_apk.js';

function pastaTemporaria() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'athenes-pub-'));
}

test('Publicação do APK — version.json', async (t) => {
  await t.test('valida o formato X.Y.Z', () => {
    assert.equal(versaoValida('1.0.1'), true);
    assert.equal(versaoValida('1.0'), false);
    assert.equal(versaoValida('v1.0.1'), false);
  });

  await t.test('formata o tamanho em MB', () => {
    assert.equal(formatarTamanho(20652795), '19.7 MB');
  });

  await t.test('grava versão, notas, tamanho e SHA-256 do APK', () => {
    const dir = pastaTemporaria();
    const apk = path.join(dir, 'app.apk');
    const conteudo = Buffer.from('conteudo-do-apk-de-teste');
    fs.writeFileSync(apk, conteudo);
    const json = path.join(dir, 'version.json');
    fs.writeFileSync(json, JSON.stringify({ versao: '1.0.1', nome: 'athenes.apk', downloadUrl: '/athenes.apk' }));

    const r = atualizarVersionJson(json, { versao: '1.2.0', notas: 'Teste', caminhoApk: apk });
    assert.equal(r.versao, '1.2.0');
    assert.equal(r.notas, 'Teste');
    assert.equal(r.tamanhoBytes, conteudo.length);
    assert.equal(r.sha256, crypto.createHash('sha256').update(conteudo).digest('hex'));
    assert.equal(JSON.parse(fs.readFileSync(json, 'utf8')).versao, '1.2.0');
    assert.equal(r.downloadUrl, '/athenes.apk');
  });

  await t.test('sem --versao preserva a atual e rejeita versão inválida', () => {
    const dir = pastaTemporaria();
    const json = path.join(dir, 'version.json');
    fs.writeFileSync(json, JSON.stringify({ versao: '2.0.0' }));
    assert.equal(atualizarVersionJson(json, { notas: 'x' }).versao, '2.0.0');
    assert.throws(() => atualizarVersionJson(json, { versao: 'abc' }), /Versão inválida/);
  });
});
