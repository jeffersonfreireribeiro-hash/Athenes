// Regression: exercise the catalog button in its two real rendering locations.
import assert from 'node:assert/strict';
const tab=await(await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:3001/src/relations/panel.css',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
try{
 await new Promise(r=>setTimeout(r,500));
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
 const result=await evaluate(`(async()=>{
  document.body.innerHTML='<main id="catalog"><div id="athBibTopoPastasWrapper"></div></main>';
  const {EstudoArtigosView}=await import('/src/ui/athenes_estudo_artigos.js');
  const folders=await import('/src/core/athenes_colaboracao.js'),z=await import('/src/core/athenes_zotero_pastas.js');
  const before=folders.obterPastasDriveLocais();
  try{
   const fixture=z.espelharColecoesNasPastas([],[{key:'A',nome:'Pesquisa',parentCollection:false},{key:'B',nome:'Artigos',parentCollection:'A'},{key:'C',nome:'Mobilidade',parentCollection:'B'}]);folders.salvarPastasDriveLocais(fixture.pastas);
   const view=Object.assign(Object.create(EstudoArtigosView.prototype),{container:document.querySelector('main'),pastaFiltroId:'todas',artigos:[],artigosCompartilhados:[],obterAgrupamentoPastas:()=>new Map(),atualizarGridCatalogo:()=>{},aoMudarPastas:()=>{}});
   const ids=()=>[...document.querySelectorAll('.ath-bib-folder-card')].map(n=>n.dataset.pastaId);
   const open=id=>document.querySelector('.ath-bib-folder-card[data-pasta-id="'+id+'"]').click();
   view.renderizarBarraPastasTopo(document.querySelector('#athBibTopoPastasWrapper'));
   const root=ids();open('zot_col_A');const first=ids();open('zot_col_B');const second=ids();open('zot_col_C');
   const path=document.querySelector('#athBibBreadcrumb').textContent;
   document.querySelector('#athBibBreadcrumb [data-nav-pasta="zot_col_A"]').click();
   return {root,first,second,path,returned:view.pastaFiltroId,final:ids()};
  }finally{folders.salvarPastasDriveLocais(before);}
 })()`);
 assert.ok(result.root.includes('zot_col_A'));assert.ok(!result.root.includes('zot_col_B'));assert.deepEqual(result.first,['zot_col_A','zot_col_B']);assert.deepEqual(result.second,['zot_col_B','zot_col_C']);assert.match(result.path,/Pesquisa.*Artigos.*Mobilidade/s);assert.equal(result.returned,'zot_col_A');console.log(result);
}finally{ws.close();await fetch('http://127.0.0.1:9223/json/close/'+tab.id);}
