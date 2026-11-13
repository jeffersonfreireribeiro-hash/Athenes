import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createCloudServer,translationRoute,limitPdfRequests} from '../cloud-server.mjs';
test('VPS serves Athenes and OAuth callback without exposing private files',async t=>{
 const server=createCloudServer({publicOrigin:undefined});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/','/oauth_callback.html','/manifest.json','/api/health'])assert.equal((await fetch(base+path)).status,200,path);
 for(const path of ['/.env','/.git/config','/src/server/athenes_traducao.js','/AGENTS.md','/server.js','/src//server/athenes_traducao.js','/src/%2fserver/athenes_traducao.js'])assert.equal((await fetch(base+path)).status,404,path);
 assert.equal((await fetch(base+'/api/traduzir-referencia',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/traduzir-referencia',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,400);
});
test('PDF: um pedido em andamento, inclusive durante envio e cancelamento do cliente',async()=>{
 let complete,calls=0;const limited=limitPdfRequests(async()=>{calls++;await new Promise(resolve=>complete=resolve);});
 const response=()=>Object.assign(new EventEmitter(),{status(n){this.code=n;return this;},json(body){this.body=body;},setHeader(){}});
 const first=response(),request=limited({},first),second=response();await limited({},second);assert.equal(second.code,429);assert.equal(calls,1);
 first.emit('close');const third=response();await limited({},third);assert.equal(third.code,429);complete();await request;
 const fourth=response(),last=limited({},fourth);assert.equal(calls,2);complete();await last;
 const fifth=response();await limited({},fifth);assert.equal(fifth.code,429);fourth.emit('finish');
 const sixth=response(),done=limited({},sixth);assert.equal(calls,3);sixth.emit('close');complete();await done;
});
test('ponte temporária de tradução usa apenas o endpoint antigo e não encaminha sessão',async t=>{
 const old=process.env.ATHENES_TRANSLATION_LEGACY,key=process.env.GEMINI_API_KEY;
 t.after(()=>{if(old===undefined)delete process.env.ATHENES_TRANSLATION_LEGACY;else process.env.ATHENES_TRANSLATION_LEGACY=old;if(key!==undefined)process.env.GEMINI_API_KEY=key;});
 process.env.ATHENES_TRANSLATION_LEGACY='1';delete process.env.GEMINI_API_KEY;
 let status,data;const res={status(n){status=n;return this;},json(body){data=body;}};
 await translationRoute({method:'POST',body:{texto:'texto',destino:'pt'},headers:{cookie:'private'}},res,async(url,options)=>{
  assert.equal(url,'https://athenes.vercel.app/api/traduzir-referencia');assert.equal(options.headers.cookie,undefined);assert.equal(options.headers.Origin,'https://athenes.vercel.app');return {status:200,json:async()=>({traducao:'traduzido'})};
 });assert.equal(status,200);assert.equal(data.traducao,'traduzido');
});
