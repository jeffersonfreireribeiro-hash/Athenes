// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('PWA: manifest.json está configurado como standalone com metadados e ícones', () => {
  const pManifest = path.resolve('manifest.json');
  assert.equal(fs.existsSync(pManifest), true, 'manifest.json deve existir na raiz');

  const manifest = JSON.parse(fs.readFileSync(pManifest, 'utf8'));
  assert.equal(manifest.short_name, 'Athenes');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#314F79');
  assert.equal(manifest.start_url, './');

  assert.equal(Array.isArray(manifest.icons), true);
  assert.equal(manifest.icons.length >= 2, true);

  const icon192 = manifest.icons.find(i => i.sizes?.includes('192x192'));
  const icon512 = manifest.icons.find(i => i.sizes?.includes('512x512'));

  assert.equal(Boolean(icon192), true, 'deve ter ícone de 192x192');
  assert.equal(Boolean(icon512), true, 'deve ter ícone de 512x512');

  assert.equal(fs.existsSync(path.resolve(icon192.src)), true, 'arquivo do ícone 192 deve existir no disco');
  assert.equal(fs.existsSync(path.resolve(icon512.src)), true, 'arquivo do ícone 512 deve existir no disco');
});

test('PWA: Service Worker sw.js e index.html registram suporte offline e instalação', () => {
  const pSw = path.resolve('sw.js');
  assert.equal(fs.existsSync(pSw), true, 'sw.js deve existir na raiz');

  const swContent = fs.readFileSync(pSw, 'utf8');
  assert.equal(swContent.includes('CACHE_NAME'), true);
  assert.equal(swContent.includes('install'), true);
  assert.equal(swContent.includes('activate'), true);
  assert.equal(swContent.includes('fetch'), true);

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.equal(indexHtml.includes('rel="manifest"'), true, 'index.html deve referenciar manifest.json');
  assert.equal(indexHtml.includes('apple-mobile-web-app-capable'), true, 'index.html deve suportar standalone no iOS/iPadOS');
  assert.equal(indexHtml.includes("navigator.serviceWorker.register('./sw.js')"), true, 'index.html deve registrar o sw.js');
});

test('PWA: Servidor HTTP server.js serve webmanifest e cabeçalhos de Service Worker', () => {
  const serverCode = fs.readFileSync(path.resolve('server.js'), 'utf8');
  assert.equal(serverCode.includes("'.webmanifest'"), true);
  assert.equal(serverCode.includes('Service-Worker-Allowed'), true);
});
