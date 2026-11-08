import test from 'node:test';
import assert from 'node:assert/strict';
import { svgGoogleDrive } from '../src/ui/athenes_icones.js';

test('cada ícone do Google Drive usa referências SVG próprias', () => {
  const primeiro = svgGoogleDrive(16);
  const segundo = svgGoogleDrive(20);
  const idPrimeiro = primeiro.match(/<mask id="([^"]+)"/)?.[1];
  const idSegundo = segundo.match(/<mask id="([^"]+)"/)?.[1];

  assert.ok(idPrimeiro);
  assert.ok(idSegundo);
  assert.notEqual(idPrimeiro, idSegundo);
  assert.ok(primeiro.includes(`mask="url(#${idPrimeiro})"`));
  assert.ok(segundo.includes(`mask="url(#${idSegundo})"`));
});
