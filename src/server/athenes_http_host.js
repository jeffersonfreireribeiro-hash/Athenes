// Small Node adapter for the existing cloud handlers. No database is created here.
import { createServer } from 'node:http';
import { realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, sep, extname } from 'node:path';

const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.pdf':'application/pdf', '.geojson':'application/geo+json' };

export function createAppHost({ root, route, isPublicPath, publicOrigin, maxBodyBytes = 8_000_000 }) {
  const base = resolve(root);
  return createServer({ requestTimeout: 60_000, headersTimeout: 15_000 }, async (req, res) => {
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value)); return res; };
    res.send = value => { res.end(value); return res; };
    res.redirect = (code, target) => { res.writeHead(code,{Location:target}); res.end(); return res; };
    res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const origin = publicOrigin || `http://${req.headers.host}`;
      if (publicOrigin && req.headers.host !== new URL(origin).host) return res.status(421).json({error:'Endereço inválido.'});
      const url = new URL(req.url, origin);
      const path = decodeURIComponent(url.pathname);
      if (path.includes('\0') || path.includes('\\') || path.split('/').some(part => part.startsWith('.'))) return res.status(404).end();
      const handler = route(url);
      if (path.startsWith('/api/')) {
        res.setHeader('Cache-Control','no-store');
        if (!handler) return res.status(404).json({error:'Rota não encontrada.'});
        if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
          if (req.headers.origin && new URL(req.headers.origin).origin !== new URL(origin).origin) return res.status(403).json({error:'Origem não permitida.'});
          if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Origem não permitida.'});
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > maxBodyBytes) return res.status(413).json({error:'Requisição muito grande.'});
            chunks.push(chunk);
          }
          if (size && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return res.status(415).json({error:'Use JSON.'});
          try { req.body = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
          catch { return res.status(400).json({error:'JSON inválido.'}); }
        }
        req.url = url.pathname + url.search;
        req.query = Object.fromEntries(url.searchParams);
        await handler(req,res);
        return;
      }
      if (!['GET','HEAD'].includes(req.method)) return res.status(405).end();
      const asset = path === '/' ? '/index.html' : path;
      if (!isPublicPath(asset)) return res.status(404).end();
      const file = await realpath(resolve(base, '.' + asset));
      if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) return res.status(404).end();
      res.setHeader('Content-Type',mime[extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', /(?:\.html|\/sw\.js|\/entry\.js)$/.test(asset) ? 'no-store' : 'no-cache');
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      res.status(['ENOENT','ENOTDIR'].includes(error.code) ? 404 : error instanceof URIError ? 400 : 500).json({error:'Não foi possível atender a solicitação.'});
    }
  });
}
