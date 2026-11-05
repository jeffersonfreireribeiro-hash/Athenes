// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { metodosDashboardPastas } from '../src/ui/athenes_dashboard_pastas.js';

test('Dashboard responsivo para tablets: CSS impede empilhamento vertical sobre o conteúdo e preserva rolagem', () => {
  const cssEditor = fs.readFileSync(path.resolve('src/css/athenes_editor.css'), 'utf8');
  const cssDash = fs.readFileSync(path.resolve('src/css/athenes_dashboard.css'), 'utf8');

  // 1. .ath-dash-main-area deve sempre possuir overflow-y: auto e rolagem por toque
  assert.equal(cssEditor.includes('overflow-y: auto'), true, 'main area deve ter overflow-y: auto');
  assert.equal(cssEditor.includes('-webkit-overflow-scrolling: touch'), true, 'main area deve suportar rolagem por toque inercial');

  // 2. Não deve existir o antigo @media (max-width: 860px) com flex-direction: column e overflow: visible que quebrava o scroll
  assert.equal(cssEditor.includes('flex-direction: column;\r\n    height: auto;\r\n    max-height: none;\r\n    overflow: visible;') ||
               cssEditor.includes('flex-direction: column;\n    height: auto;\n    max-height: none;\n    overflow: visible;'),
               false,
               'Não deve quebrar a rolagem nem empilhar verticalmente a barra lateral sobre a área principal');

  // 3. Suporte a gaveta sobreposta para tablets e telas menores (<= 1024px)
  assert.equal(cssEditor.includes('.ath-dash-sidebar.ath-aberto'), true, 'deve ter classe de abertura da gaveta');
  assert.equal(cssEditor.includes('.ath-dash-scrim'), true, 'deve ter backdrop scrim para fechar ao tocar fora');
  assert.equal(cssEditor.includes('.ath-dash-alca-pastas'), true, 'deve ter alça/atalho para abrir gaveta');
  assert.equal(cssEditor.includes('.ath-dash-btn-toggle-pastas'), true, 'deve ter botão no banner para abrir pastas');

  // 4. Grade de artigos zotero responsiva no tablet
  assert.equal(cssDash.includes('minmax(280px, 1fr)'), true, 'grade de artigos deve adaptar minmax para caber em 2 colunas no tablet');
});

test('Dashboard métodos de gaveta de pastas: alternar, abrir e fechar', () => {
  assert.equal(typeof metodosDashboardPastas.alternarDrawerPastas, 'function');
  assert.equal(typeof metodosDashboardPastas.abrirDrawerPastas, 'function');
  assert.equal(typeof metodosDashboardPastas.fecharDrawerPastas, 'function');

  // Simulação com mock de container
  let sidebarClasses = new Set();
  let scrimClasses = new Set();

  const mockSidebar = {
    classList: {
      contains: (c) => sidebarClasses.has(c),
      toggle: (c, val) => val ? sidebarClasses.add(c) : sidebarClasses.delete(c),
      add: (c) => sidebarClasses.add(c),
      remove: (c) => sidebarClasses.delete(c)
    }
  };

  const mockScrim = {
    classList: {
      toggle: (c, val) => val ? scrimClasses.add(c) : scrimClasses.delete(c),
      add: (c) => scrimClasses.add(c),
      remove: (c) => scrimClasses.delete(c)
    }
  };

  const ctx = {
    container: {
      querySelector: (sel) => {
        if (sel === '#athDashSidebar') return mockSidebar;
        if (sel === '#athDashScrim') return mockScrim;
        return null;
      }
    }
  };

  // Abrir gaveta
  metodosDashboardPastas.abrirDrawerPastas.call(ctx);
  assert.equal(sidebarClasses.has('ath-aberto'), true);
  assert.equal(scrimClasses.has('ath-aberto'), true);

  // Fechar gaveta
  metodosDashboardPastas.fecharDrawerPastas.call(ctx);
  assert.equal(sidebarClasses.has('ath-aberto'), false);
  assert.equal(scrimClasses.has('ath-aberto'), false);

  // Alternar gaveta
  metodosDashboardPastas.alternarDrawerPastas.call(ctx);
  assert.equal(sidebarClasses.has('ath-aberto'), true);
  assert.equal(scrimClasses.has('ath-aberto'), true);

  metodosDashboardPastas.alternarDrawerPastas.call(ctx);
  assert.equal(sidebarClasses.has('ath-aberto'), false);
  assert.equal(scrimClasses.has('ath-aberto'), false);
});
