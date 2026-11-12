// Audit real PDF find interactions without changing saved articles.
import assert from 'node:assert/strict';
const tab=await(await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:3001/src/relations/panel.css',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('docs/search-audit',{recursive:true});
const pages=['Sa\\372de urbana|Saude publica e cidades.|Mobili-|dade sustentavel.','Nenhuma palavra alvo nesta pagina.','Sa\\372de coletiva e cidade.'];
const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
for(let i=0;i<pages.length;i++){const lines=pages[i].replaceAll('\\\\','\\').split('|');const stream='BT /F1 16 Tf 1 0 0 1 25 350 Tm '+lines.map((line,j)=>(j?'0 -25 Td ':'')+'('+line+') Tj').join(' ')+' ET';objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(5+i*2)+' 0 R >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream');}
let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer << /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
await writeFile('docs/search-audit/search-fixture.pdf',pdf.replaceAll('\\n','\n'));
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Timed out: '+expression);};
try{
 await new Promise(r=>setTimeout(r,500));await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate(`(async()=>{
  document.head.innerHTML='<link rel="stylesheet" href="/src/css/athenes_dashboard.css">';
  document.body.innerHTML='<main class="ath-estudio-full-shell" style="width:1100px;margin:20px"><header class="ath-topo-dir"></header><div id="athEstudioPalco" style="height:650px;overflow:auto;background:#e9eff7;padding:12px"></div></main>';
  const lib=await (await import('/src/ui/athenes_estudo_artigos_dados.js')).carregarPdfJs();
  const doc=await lib.getDocument('/docs/search-audit/search-fixture.pdf').promise;
  window.art={id:'audit',pdfBlobUrl:'fixture',conteudoPaginasPdf:[{real:true},{real:true},{real:true}]};window.state={};
  window.root=document.querySelector('main');window.palco=document.querySelector('#athEstudioPalco');
  for(let p=1;p<=3;p++)palco.insertAdjacentHTML('beforeend','<div data-wrap-pagina="'+p+'" style="height:1080px"><div class="ath-pdf-folha-container" data-num-pagina="'+p+'" style="position:relative;width:794px;height:1059px;background:white"><div class="ath-pdf-text-layer" data-texto-pag="'+p+'"></div></div></div>');
  const rendered=new Set();window.renderPage=async p=>{if(rendered.has(p))return;rendered.add(p);const page=await doc.getPage(p),viewport=page.getViewport({scale:794/300}),layer=root.querySelector('[data-texto-pag="'+p+'"]');layer.style.setProperty('--scale-factor',794/300);layer.style.setProperty('--total-scale-factor',794/300);const cv=document.createElement('canvas');cv.width=viewport.width;cv.height=viewport.height;cv.style.cssText='position:absolute;inset:0;width:794px;height:1059px';layer.before(cv);await page.render({canvasContext:cv.getContext('2d'),viewport}).promise;const tc=await page.getTextContent(),tl=new lib.TextLayer({textContentSource:tc,container:layer,viewport});await tl.render();(await import('/src/ui/athenes_busca_artigo.js')).registrarTextoPdfBuscavel(layer,tc.items,tl.textDivs);};
  window.view={_pdfDocs:new Map([['fixture',{doc,n:3}]]),rolarParaPagina(p){window.currentPage=p;palco.scrollTop=root.querySelector('[data-wrap-pagina="'+p+'"]').offsetTop-palco.offsetTop;if(p<=3)renderPage(p);}};
  window.search=(await import('/src/ui/athenes_busca_artigo.js')).instalarBuscaArtigo(view,root,art,state);
  await renderPage(1);window.original=JSON.stringify(art);
 })()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF',modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF',modifiers:2});
 assert.equal(await evaluate(`document.querySelector('.ath-reader-find').hidden`),false);
 await waitFor(`(()=>{const p=document.querySelector('.ath-reader-find'),r=p.getBoundingClientRect(),c=palco.getBoundingClientRect();return root.contains(p)&&r.left>=c.left&&r.right<=c.right&&r.top>=c.top&&r.bottom<=c.bottom;})()`);
 await send('Input.insertText',{text:'saude'});
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('3 ocorrência')`);
 await waitFor(`document.querySelectorAll('[data-num-pagina="1"] .ath-pdf-search-layer>span').length>=2`);
 assert.equal(await evaluate(`root.querySelector('[data-texto-pag="3"]').textContent`),'');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});
 await waitFor(`!!document.querySelector('[data-num-pagina="3"] .ath-pdf-search-layer>.is-current')`);
 assert.equal(await evaluate('currentPage'),3);
 await evaluate(`(async()=>{search.destroy();window.search=(await import('/src/ui/athenes_busca_artigo.js')).instalarBuscaArtigo(view,root,art,state);})()`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('3 ocorrências')`);
 assert.equal(await evaluate('currentPage'),3);assert.equal(await evaluate(`document.querySelector('.ath-reader-find [data-count]').textContent`),'3 / 3');assert.equal(await evaluate(`!!root.querySelector('[data-texto-pag="1"]')._athBuscaTexto`),true);
 await evaluate(`document.querySelector('[data-option=semAcentos]').click()`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('1 ocorrência')`);
 await evaluate(`document.querySelector('[data-option=semAcentos]').click();const input=document.querySelector('.ath-reader-find input');input.value='mobilidade';input.dispatchEvent(new Event('input',{bubbles:true}));`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('1 ocorrência')`);
 await waitFor(`!!document.querySelector('[data-num-pagina="1"] .ath-pdf-search-layer>.is-current')`);
 assert.equal(await evaluate('JSON.stringify(art)'),await evaluate('original'));
 await evaluate(`(()=>{
  art.conteudoPaginasPdf.push({extra:true});palco.insertAdjacentHTML('beforeend','<div data-wrap-pagina="4" style="height:1080px"><div class="ath-pdf-folha-container" data-num-pagina="4" style="position:relative;width:794px;height:1059px;background:white"><div data-texto-pag="4"><div data-colunas-pag="4" contenteditable="true"><p>Informação exclusiva da folha extra.</p></div></div></div></div>');
  const input=document.querySelector('.ath-reader-find input');input.value='exclusiva';input.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('1 ocorrência')&&currentPage===4`);
 await waitFor(`!!document.querySelector('[data-num-pagina="4"] .ath-pdf-search-layer>.is-current')`);
 await evaluate(`const extra=root.querySelector('[data-colunas-pag="4"]');extra.focus();extra.querySelector('p').textContent='Texto atualizado da folha extra.';`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('Nenhum trecho')`);
 assert.equal(await evaluate(`document.activeElement===root.querySelector('[data-colunas-pag="4"]')`),true);

 await evaluate(`(async()=>{
  art.conteudoPaginasPdf.push({extra:true});palco.insertAdjacentHTML('beforeend','<div data-wrap-pagina="5" style="height:1080px"><div class="ath-pdf-folha-container" data-num-pagina="5" style="position:relative;width:794px;height:1059px;background:white"><div class="ath-pdf-text-layer" data-texto-pag="5"><span dir="rtl" style="left:500px;top:100px;font-size:24px">علم</span><span dir="rtl" style="left:420px;top:100px;font-size:24px">المدن</span></div></div></div>');
  const layer=root.querySelector('[data-texto-pag="5"]');(await import('/src/ui/athenes_busca_artigo.js')).registrarTextoPdfBuscavel(layer,[{str:'علم',dir:'rtl',transform:[24,0,0,24,500,100],width:40},{str:'المدن',dir:'rtl',transform:[24,0,0,24,420,100],width:60}],[...layer.querySelectorAll('span')]);
  const input=document.querySelector('.ath-reader-find input');input.value='علم المدن';input.dispatchEvent(new Event('input',{bubbles:true}));
 })()`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('1 ocorrência')&&currentPage===5`);
 await waitFor(`document.querySelectorAll('[data-num-pagina="5"] .ath-pdf-search-layer>.is-current').length>=2`);
 await evaluate(`(()=>{const input=document.querySelector('.ath-reader-find input');input.value='mobilidade';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('1 ocorrência')`);

 const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile('docs/search-audit/reader-find.png',Buffer.from(screenshot.data,'base64'));
 const anchoredY=await evaluate(`document.querySelector('.ath-reader-find').getBoundingClientRect().top`);
 await evaluate(`palco.scrollTop+=150`);
 assert.equal(await evaluate(`document.querySelector('.ath-reader-find').getBoundingClientRect().top`),anchoredY);
 await evaluate(`window.palcoStyle=palco.style.cssText;palco.style.width='320px';palco.style.height='200px';palco.style.marginLeft='40px';`);
 await waitFor(`(()=>{const p=document.querySelector('.ath-reader-find'),r=p.getBoundingClientRect(),c=palco.getBoundingClientRect();return r.left>=c.left&&r.right<=c.right&&r.top>=c.top&&r.bottom<=c.bottom&&p.scrollWidth===p.clientWidth;})()`);
 await evaluate(`palco.style.cssText=palcoStyle`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 assert.equal(await evaluate(`document.querySelector('.ath-reader-find').hidden`),true);assert.equal(await evaluate(`document.querySelectorAll('.ath-pdf-search-layer').length`),0);
 await evaluate('search.destroy()');assert.equal(await evaluate(`document.querySelectorAll('.ath-reader-find').length`),0);
 assert.equal(await evaluate(`(()=>{const e=new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true,cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()`),false);
 await evaluate(`(async()=>{window.search=(await import('/src/ui/athenes_busca_artigo.js')).instalarBuscaArtigo(view,root,art,state);root.hidden=true;})()`);
 assert.equal(await evaluate(`(()=>{const e=new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true,cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()`),false);
 await evaluate(`root.hidden=false;search.abrir();`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await waitFor(`(()=>{const p=document.querySelector('.ath-reader-find'),r=p.getBoundingClientRect();return r.left>=0&&r.right<=390&&p.scrollWidth===p.clientWidth;})()`);
 await evaluate(`root.hidden=true`);await waitFor(`document.querySelector('.ath-reader-find').hidden`);
 await evaluate(`root.hidden=false`);await waitFor(`!document.querySelector('.ath-reader-find').hidden`);
 await evaluate('search.destroy()');
 await evaluate(`(async()=>{
  root.querySelectorAll('[data-texto-pag]').forEach(el=>el.replaceChildren());
  const empty={n:1,doc:{getPage:async()=>({getTextContent:async()=>({items:[]})})}};
  window.search=(await import('/src/ui/athenes_busca_artigo.js')).instalarBuscaArtigo({_pdfDocs:new Map([['empty',empty]]),rolarParaPagina(){}},root,{pdfBlobUrl:'empty'}, {consulta:'saude'});search.abrir();
 })()`);
 await waitFor(`document.querySelector('.ath-reader-find [role=status]').textContent.includes('OCR')`);
 assert.equal(await evaluate(`document.querySelectorAll('.ath-pdf-search-layer>span').length`),0);
 await evaluate(`search.destroy()`);
 const integrated=await evaluate(`(async()=>{
  const {EstudoArtigosView}=await import('/src/ui/athenes_estudo_artigos.js');
  const container=document.createElement('div');document.body.append(container);
  const v=Object.assign(Object.create(EstudoArtigosView.prototype),{container,artigoAberto:art,carregarConfigZotero(){},alternarModoDashboardFull(){},registrarSnapshotCatalogo(){},renderizarCatalogoArtigos(){},renderizarEstudioPdfFullScreen(){this.container.innerHTML='<main class="ath-estudio-full-shell"><header class="ath-topo-dir"></header><div id="athEstudioPalco"></div></main>';}});
  v.renderizar();v._buscaArtigo.abrir();const q=document.querySelector('.ath-reader-find input');q.value='consulta pendente';q.dispatchEvent(new Event('input',{bubbles:true}));q.setSelectionRange(2,6);v.renderizar();if(document.activeElement!==document.querySelector('.ath-reader-find input')||document.activeElement.value!=='consulta pendente'||document.activeElement.selectionStart!==2)throw Error('Reader refresh lost search focus');const panels=document.querySelectorAll('.ath-reader-find').length,buttons=container.querySelectorAll('.ath-reader-find-button').length;
  v.artigoAberto=null;v.renderizar();const cleaned=document.querySelectorAll('.ath-reader-find').length;v.destruir();container.remove();return {panels,buttons,cleaned};
 })()`);
 assert.deepEqual(integrated,{panels:1,buttons:1,cleaned:0});
 await evaluate(`(async()=>{window.search=(await import('/src/ui/athenes_busca_artigo.js')).instalarBuscaArtigo(view,root,art,{});search.abrir();root.remove();})()`);
 await waitFor(`!document.querySelector('.ath-reader-find')`);
 console.log('Real PDF: Ctrl+F, all pages, lazy highlights, accents, dehyphenation, navigation, cleanup and document integrity passed.');
}finally{ws.close();await fetch('http://127.0.0.1:9223/json/close/'+tab.id);}
