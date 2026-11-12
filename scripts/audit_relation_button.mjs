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
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate(`(async()=>{
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/src/css/athenes_paineis.css">');
  const {EstudoArtigosView}=await import('/src/ui/athenes_estudo_artigos.js');
  window.auditView=Object.assign(Object.create(EstudoArtigosView.prototype),{artigos:Array.from({length:12},(_,i)=>({id:'r'+i,titulo:'Mobilidade urbana sustentável',autores:['Ana','Bruno','Carla'][i%3],palavrasChave:['Mobilidade','Saúde'],ano:2020+i%5,resumo:'Mobilidade urbana e saúde coletiva. Planejamento das cidades e transporte sustentável.'})),artigosCompartilhados:[],pastaFiltroId:'todas'});
  auditView.abrirAnaliseRelacoes();await new Promise(r=>setTimeout(r,300));
 })()`);
 const geometry=await evaluate(`(()=>{const n=document.querySelector('[data-relation-node] circle'),r=n.getBoundingClientRect(),m=document.querySelector('.ath-relations-modal').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,height:m.height};})()`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:geometry.x,y:geometry.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:geometry.x+50,y:geometry.y+30,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:geometry.x+50,y:geometry.y+30,button:'left',clickCount:1});
 assert.notEqual(await evaluate(`document.querySelector('[data-relation-node]').getAttribute('transform')`),'translate(0 0)');
 await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:geometry.x,y:geometry.y,deltaY:-150,deltaX:0});
 assert.match(await evaluate(`document.querySelector('.rel-drawing').style.transform`),/scale\(1\./);
 await evaluate(`const mode=document.querySelector('[name=mode]');mode.value='terms';mode.dispatchEvent(new Event('change',{bubbles:true}));`);
 assert.equal(await evaluate(`Math.round(document.querySelector('.ath-relations-modal').getBoundingClientRect().height)`),Math.round(geometry.height));
 assert.equal(await evaluate(`document.querySelector('.rel-term-ranking').hidden`),false);
 assert.ok(await evaluate(`document.querySelector('.rel-term-ranking ol')?.textContent.toLowerCase().includes('mobilidade')`));
 await evaluate(`document.querySelector('[data-rel-action=fit]').click();`);
 const screenshot=await send('Page.captureScreenshot',{format:'png'});
 const {writeFile}=await import('node:fs/promises');await writeFile('docs/relations-audit/athenes-panel-refined.png',Buffer.from(screenshot.data,'base64'));
 console.log('Node drag, pointer-centered zoom, stable modal height and term ranking passed.');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 const mobile=await evaluate(`(()=>{const r=document.querySelector('.ath-relations-modal').getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.querySelector('.relation-panel').scrollWidth>document.querySelector('.relation-panel').clientWidth};})()`);
 assert.ok(mobile.width<=390);assert.ok(mobile.height<=844);assert.equal(mobile.overflow,false);
 console.log('390px viewport: no horizontal overflow.');
}finally{ws.close();await fetch('http://127.0.0.1:9223/json/close/'+tab.id);}
