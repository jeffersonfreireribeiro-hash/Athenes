// Regression: exercise the catalog button in its two real rendering locations.
import assert from 'node:assert/strict';
const tab=await(await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:3001/src/relations/panel.css',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
try{
 await new Promise(r=>setTimeout(r,500));
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const {EstudoArtigosView}=await import('/src/ui/athenes_estudo_artigos.js');
  const results=[];
  for(const header of [true,false]){
   document.body.innerHTML=(header?'<header id="athHeaderAcoesZotero"></header>':'')+'<main id="catalog"></main>';
   const view=Object.assign(Object.create(EstudoArtigosView.prototype),{container:document.querySelector('main'),artigos:[],artigosCompartilhados:[],zoteroClient:{},filtrosObra:{},pastaFiltroId:'todas',temZoteroConectado:()=>false,renderizarBarraPastasTopo:()=>{},atualizarGridCatalogo:()=>{}});
   view.renderizarCatalogoArtigos();
   document.querySelector('#athBtnAnalisarRelacoes').click();
   results.push({header,opened:!!document.querySelector('.relation-panel'),svg:!!document.querySelector('.rel-drawing svg')});
   document.querySelector('[data-rel-close]')?.click();
   results.at(-1).closed=!document.querySelector('[data-rel-body]');
   document.removeEventListener('click',view._fecharMenuOrdemBib);document.removeEventListener('click',view._fecharImportarBib);
  }
  return results;
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description);
 console.log(result.result.value);
 for(const r of result.result.value){assert.equal(r.opened,true);assert.equal(r.svg,true);assert.equal(r.closed,true);}
}finally{ws.close();await fetch('http://127.0.0.1:9223/json/close/'+tab.id);}
