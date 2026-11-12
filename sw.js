// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes â€” Service Worker PWA (Progressive Web App).
 * Permite instalar a interface no navegador, tablet e celular, funcionando com suporte offline.
 */

const CACHE_NAME = 'athenes-pwa-v43';

const ASSETS_CANONICOS = [
  './',
  './index.html',
  './manifest.json',
  './src/ui/athenes_logo.svg',
  './src/ui/athenes_icon_192.png',
  './src/ui/athenes_icon_512.png',
  './src/css/athenes_base.css',
  './src/css/athenes_dashboard.css',
  './src/css/athenes_editor.css',
  './src/css/athenes_paineis.css',
  './src/css/athenes_zotero.css',
  './src/css/athenes_estante_3d.css',
  './src/css/athenes_traducao.css',
  './src/ui/athenes_app.js',
  './src/ui/athenes_dashboard.js',
  './src/ui/athenes_dashboard_pastas.js',
  './src/ui/athenes_dashboard_modais.js',
  './src/ui/athenes_dashboard_sincronia.js',
  './src/ui/athenes_editor.js',
  './src/ui/athenes_atalhos_editor.js',
  './src/core/athenes_assistente_ia.js',
  './src/core/athenes_traducao.js',
  './src/ui/athenes_traducao_ui.js',
  './src/ui/athenes_assistente_ia_ui.js',
  './src/core/athenes_estudo_historico.js',
  './src/ui/athenes_estudo_artigos.js',
  './src/ui/athenes_estudo_artigos_pastas.js',
  './src/ui/athenes_estudo_artigos_estante.js',
  './src/ui/athenes_icones.js',
  './src/ui/athenes_fontes_ui.js',
  './src/core/athenes_referencias.js',
  './src/core/athenes_documento.js',
  './src/ui/athenes_zoom_canvas.js',
  './src/ui/athenes_estudo_artigos_tela.js',
  './src/ui/athenes_estudo_artigos_dados.js',
  './src/ui/athenes_estudo_artigos_anotacoes.js',
  './src/ui/athenes_estudo_artigos_painel_direito.js',
  './src/ui/athenes_compartilhar_modal.js',
  './src/core/athenes_colaboracao.js',
  './src/core/athenes_supabase_auth.js',
  './src/core/athenes_compartilhamento.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // PrÃ©-carrega recursos essenciais tolerando falha pontual
      for (const asset of ASSETS_CANONICOS) {
        try {
          await cache.add(asset);
        } catch (_) {}
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // NÃ£o intercepta chamadas de nuvem (Google Drive, Supabase, Zotero API, CDNs externas) nem rotas da API local
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('zotero.org') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // EstratÃ©gia Network-First com Fallback no Cache para arquivos locais
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          }).catch(() => {});
        }
        return networkRes;
      })
      .catch(async () => {
        const cachedRes = await caches.match(req);
        if (cachedRes) return cachedRes;

        // Se for navegaÃ§Ã£o de pÃ¡gina e estiver offline, entrega o index.html
        if (req.mode === 'navigate') {
          const indexFallback = await caches.match('./index.html') || await caches.match('/');
          if (indexFallback) return indexFallback;
        }

        return new Response('Offline â€” Athenes estÃ¡ offline e o recurso solicitado nÃ£o estÃ¡ em cache.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
