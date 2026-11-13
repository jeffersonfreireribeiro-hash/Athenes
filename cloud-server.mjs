// SPDX-License-Identifier: GPL-3.0-or-later
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAppHost } from './src/server/athenes_http_host.js';
import pdf from './api/pdf-aberto.js';
import traducao from './api/traduzir-referencia.js';

// Vercel sensitive variables cannot be exported. Keep translation on the existing
// endpoint until its key is configured privately on the VPS; no new user store.
export async function translationRoute(req,res,fetchImpl=fetch) {
  if (process.env.GEMINI_API_KEY || process.env.ATHENES_TRANSLATION_LEGACY !== '1') return traducao(req,res);
  if (req.method !== 'POST') return res.status(405).json({erro:'Método não permitido.'});
  const bytes=Buffer.byteLength(JSON.stringify(req.body || {}));
  if(bytes>30000)return res.status(413).json({erro:'Trecho muito grande.'});
  try {
    const response=await fetchImpl('https://athenes.vercel.app/api/traduzir-referencia',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://athenes.vercel.app'},body:JSON.stringify(req.body),signal:AbortSignal.timeout(35000)});
    const result=await response.json();
    return res.status(response.status).json(result);
  } catch { return res.status(502).json({erro:'Não foi possível conectar ao serviço de tradução.'}); }
}
// A 40 MB PDF may occupy several buffers. Keep one upstream request at a time,
// including the response drain; an aborted client does not release a running fetch.
export function limitPdfRequests(handler) {
  let busy=false;
  return async (req,res)=>{
    if(busy){res.setHeader('Retry-After','10');return res.status(429).json({erro:'Um PDF está sendo carregado. Tente novamente em instantes.'});}
    busy=true;let settled=false,finished=false,released=false;
    const release=()=>{if(!released&&settled&&finished){released=true;busy=false;res.removeListener('finish',onFinish);res.removeListener('close',onFinish);}};
    const onFinish=()=>{finished=true;release();};
    res.once('finish',onFinish);res.once('close',onFinish);
    try {return await handler(req,res);}
    finally {settled=true;finished ||= res.writableFinished || res.destroyed;release();}
  };
}
const routes = { '/api/pdf-aberto':limitPdfRequests(pdf), '/api/traduzir-referencia':translationRoute,
  '/api/health':(req,res)=>res.status(200).json({ok:true}) };
export const isPublicPath = path => ['/index.html','/oauth_callback.html','/manifest.json','/sw.js','/version.json','/athenes.apk'].includes(path) ||
  (/^\/(src|temas)\/[a-zA-Z0-9_./ -]+\.(js|css|svg|png|jpe?g|webp|json|woff2?|ttf|pdf|geojson)$/.test(path) && !path.startsWith('/src/server/'));
export const createCloudServer = options => createAppHost({root:import.meta.dirname,route:url=>routes[url.pathname],isPublicPath,publicOrigin:process.env.APP_PUBLIC_URL,...options});
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.env.APP_PUBLIC_URL?.startsWith('https://')) throw new Error('Configure APP_PUBLIC_URL com HTTPS.');
  const server=createCloudServer();
  server.listen(Number(process.env.PORT || 3300),'0.0.0.0',()=>console.log('Athenes cloud pronto.'));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
