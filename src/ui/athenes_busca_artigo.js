// SPDX-License-Identifier: GPL-3.0-or-later
import {buscarNasPaginas,encontrarNoTexto,textoDosItensPdf,segmentosDosItensPdf} from '../core/athenes_busca_artigo.js';
import {escapeHtml as esc} from '../core/athenes_seguranca.js';
import {svgIcone} from './athenes_icones.js';
const cachePdf=new WeakMap();
let sequencia=0;
export function registrarTextoPdfBuscavel(layer,items,divs){
  const modelo=segmentosDosItensPdf(items);
  if(!divs||divs.length!==modelo.segmentos.length||modelo.segmentos.some((s,i)=>s.texto!==divs[i].textContent))return;
  const partes=[];
  modelo.segmentos.forEach((s,i)=>{const walker=document.createTreeWalker(divs[i],NodeFilter.SHOW_TEXT);let offset=s.inicio;while(walker.nextNode()){const node=walker.currentNode;partes.push({node,inicio:offset,fim:offset+node.nodeValue.length});offset+=node.nodeValue.length;}});
  layer._athBuscaTexto={texto:modelo.texto,partes};layer.dispatchEvent(new CustomEvent('athenes:pdf-text-ready',{bubbles:true}));
}
function modeloTexto(layer){
  if(layer._athBuscaTexto?.partes.every(p=>p.node.isConnected))return layer._athBuscaTexto;
  const partes=[];let texto='',anterior=null;
  const walker=document.createTreeWalker(layer,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;if(!node.nodeValue||node.parentElement.closest('.endOfContent,.ath-pdf-folha-rodape'))continue;
    const range=document.createRange();range.selectNodeContents(node);const rect=range.getBoundingClientRect();
    if(!rect.width&&!rect.height)continue;
    if(anterior){const bloco=node.parentElement.closest('p,h1,h2,h3,li'),outro=anterior.node.parentElement.closest('p,h1,h2,h3,li');
      const br=anterior.node.parentElement.nextElementSibling?.tagName==='BR';
      if(br||bloco!==outro||Math.abs(rect.top-anterior.rect.top)>Math.min(rect.height,anterior.rect.height)*.7)texto+='\n';
      else if(!/\s$/.test(anterior.node.nodeValue)&&!/^\s/.test(node.nodeValue)&&(getComputedStyle(node.parentElement).direction==='rtl'?anterior.rect.left-rect.right:rect.left-anterior.rect.right)>Math.min(rect.height,anterior.rect.height)*.15)texto+=' ';
    }
    partes.push({node,inicio:texto.length,fim:texto.length+node.nodeValue.length});texto+=node.nodeValue;anterior={node,rect};
  }
  return {texto,partes};
}
function intervalo(modelo,match){
  const a=modelo.partes.find(p=>p.fim>match.inicio),b=modelo.partes.find(p=>p.fim>=match.fim);
  if(!a||!b)return null;const range=document.createRange();range.setStart(a.node,Math.max(0,match.inicio-a.inicio));range.setEnd(b.node,Math.min(b.node.length,match.fim-b.inicio));return range;
}
export function instalarBuscaArtigo(view,root,art,estado={}){
  if(!root)return {destroy(){}};
  if(!document.querySelector('link[data-busca-artigo-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../css/athenes_busca_artigo.css',import.meta.url).href;css.dataset.buscaArtigoCss='';document.head.append(css);}
  const id='ath-reader-find-'+ ++sequencia,palco=root.querySelector('#athEstudioPalco');
  const button=document.createElement('button');button.type='button';button.className='ath-reader-find-button';button.title='Buscar no artigo (Ctrl+F)';button.setAttribute('aria-label','Buscar no artigo (Ctrl+F)');button.innerHTML=svgIcone('busca',18);root.querySelector('.ath-topo-dir')?.prepend(button);
  const panel=document.createElement('section');panel.className='ath-reader-find';panel.hidden=true;panel.setAttribute('role','search');panel.setAttribute('aria-label','Busca no artigo');
  const seta=d=>`<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${d}"/></svg>`;
  panel.innerHTML=`<header><strong>Buscar no artigo</strong><kbd>Ctrl F</kbd><button type="button" data-find="close" aria-label="Fechar busca (Esc)">${seta('m5 5 10 10M15 5 5 15')}</button></header><div class="ath-reader-find-input"><span>${svgIcone('busca',17)}</span><input id="${id}" type="search" placeholder="Palavra ou trecho do artigo" aria-label="Texto a procurar" autocomplete="off"><span data-count aria-live="polite"></span><button type="button" data-find="prev" aria-label="Ocorrência anterior (Shift+Enter)">${seta('m5 12 5-5 5 5')}</button><button type="button" data-find="next" aria-label="Próxima ocorrência (Enter)">${seta('m5 8 5 5 5-5')}</button></div><div class="ath-reader-find-options"><button type="button" data-option="maiusculas" aria-pressed="false" title="Distinguir maiúsculas e minúsculas">Aa</button><button type="button" data-option="inteira" aria-pressed="false" title="Encontrar somente palavras inteiras">Palavra inteira</button><button type="button" data-option="semAcentos" aria-pressed="true" title="Ignorar diferenças de acentuação">Á = a</button></div><p class="ath-reader-find-status" role="status"></p><ol aria-label="Trechos encontrados"></ol><footer>Enter: próxima · Shift+Enter: anterior · Esc: fechar</footer>`;
  const anchor=palco?.parentElement||root,jaPosicionado=anchor.classList.contains('ath-reader-find-container');
  anchor.classList.add('ath-reader-find-container');
  const host=document.createElement('div');host.className='ath-reader-find-host';anchor.append(host);host.append(panel);
  const alinhar=()=>{const r=(palco||root).getBoundingClientRect(),a=anchor.getBoundingClientRect();Object.assign(host.style,{left:(r.left-a.left-anchor.clientLeft+anchor.scrollLeft)+'px',top:(r.top-a.top-anchor.clientTop+anchor.scrollTop)+'px',width:((palco||root).clientWidth||r.width)+'px',height:((palco||root).clientHeight||r.height)+'px'});};
  alinhar();
  const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(alinhar):null;resizeObserver?.observe(palco||root);if(anchor!==palco)resizeObserver?.observe(anchor);
  const input=panel.querySelector('input'),list=panel.querySelector('ol'),status=panel.querySelector('[role=status]'),count=panel.querySelector('[data-count]');
  estado.consulta||='';estado.opcoes||={maiusculas:false,inteira:false,semAcentos:true};
  input.value=estado.consulta;for(const b of panel.querySelectorAll('[data-option]'))b.setAttribute('aria-pressed',String(!!estado.opcoes[b.dataset.option]));
  let abort=null,timer=0,frame=0,resultados=[],ativo=-1,limite=false,destruido=false,revelar=null,navegou=false,modelos=new WeakMap(),geracao=0;
  const infoPdf=()=>view._pdfDocs?.get(art.pdfBlobUrl);
  const visivel=()=>root.isConnected&&root.getClientRects().length&&!root.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(root).visibility!=='hidden';
  function limpar(){root.querySelectorAll('.ath-pdf-search-layer').forEach(el=>el.remove());}
  function agendarPintura(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;pintar();});}
  function pintar(){
    if(!estado.aberta||!input.value.trim()){limpar();return;}
    const area=palco?.getBoundingClientRect(),selecionado=resultados[ativo];
    for(const folha of root.querySelectorAll('.ath-pdf-folha-container')){
      const pagina=Number(folha.dataset.numPagina),rect=folha.getBoundingClientRect();
      const existente=folha.querySelector('.ath-pdf-search-layer');
      if(area&&(rect.bottom<area.top-100||rect.top>area.bottom+100)&&revelar?.pagina!==pagina){existente?.remove();continue;}
      const layer=folha.querySelector('[data-texto-pag]');if(!layer)continue;
      let modelo=modelos.get(layer);if(!modelo){modelo=modeloTexto(layer);modelos.set(layer,modelo);}
      const matches=encontrarNoTexto(modelo.texto,input.value,estado.opcoes,1001);
      const overlay=existente||document.createElement('div');overlay.className='ath-pdf-search-layer';overlay.setAttribute('aria-hidden','true');overlay.replaceChildren();
      if(!existente)folha.append(overlay);
      const escalaX=rect.width/(folha.offsetWidth||794),escalaY=rect.height/(folha.offsetHeight||1123),vistos=new Set();
      matches.forEach((m,index)=>{
        const atual=selecionado?.pagina===pagina&&selecionado.ordem===index;if(index>=200&&!atual)return;
        const range=intervalo(modelo,m);if(!range)return;let primeiro=null;
        for(const r of range.getClientRects()){
          if(!r.width||!r.height)continue;const chave=[r.x,r.y,r.width,r.height].map(n=>Math.round(n)).join(':');if(vistos.has(chave))continue;vistos.add(chave);primeiro||=r;
          const mark=document.createElement('span');mark.className=atual?'is-current':'';Object.assign(mark.style,{left:(r.left-rect.left)/escalaX+'px',top:(r.top-rect.top)/escalaY+'px',width:r.width/escalaX+'px',height:r.height/escalaY+'px'});overlay.append(mark);
        }
        if(atual&&primeiro&&revelar?.pagina===pagina){revelar=null;if(palco&&area)palco.scrollBy({top:primeiro.top-area.top-area.height*.35,behavior:'smooth'});}
      });
    }
  }
  function renderResultados(){
    count.textContent=resultados.length?`${ativo+1} / ${resultados.length}${limite?'+':''}`:'0 / 0';
    const top=list.scrollTop,de=Math.max(0,ativo-15);list.innerHTML=resultados.map((r,i)=>({r,i})).slice(de,de+60).map(({r,i})=>`<li><button type="button" data-result="${i}" ${i===ativo?'aria-current="true"':''}><strong>Página ${esc(r.pagina)}</strong><span>${r.antes?'…':''}${esc(r.trecho.slice(0,r.destaque.inicio))}<mark>${esc(r.trecho.slice(r.destaque.inicio,r.destaque.fim))}</mark>${esc(r.trecho.slice(r.destaque.fim))}${r.depois?'…':''}</span></button></li>`).join('');list.scrollTop=top;
    panel.querySelectorAll('[data-find=prev],[data-find=next]').forEach(b=>b.disabled=!resultados.length);
  }
  function ir(index){if(!resultados.length)return;navegou=true;ativo=(index+resultados.length)%resultados.length;const r=resultados[ativo];estado.atual={pagina:r.pagina,ordem:r.ordem};revelar=r;view.rolarParaPagina(r.pagina,root);renderResultados();const el=list.querySelector('[aria-current]');if(el){const r=el.getBoundingClientRect(),l=list.getBoundingClientRect();if(r.bottom>l.bottom)list.scrollTop+=r.bottom-l.bottom;else if(r.top<l.top)list.scrollTop-=l.top-r.top;}agendarPintura();}
  async function lerPagina(pagina,pdf){
    if(!pdf||pagina>(pdf.n||pdf.doc.numPages)){const layer=root.querySelector(`[data-num-pagina="${pagina}"] [data-texto-pag]`);return layer?modeloTexto(layer).texto:'';}
    let cache=cachePdf.get(pdf.doc);if(!cache){cache=new Map();cachePdf.set(pdf.doc,cache);}
    if(!cache.has(pagina)){const pending=pdf.doc.getPage(pagina).then(p=>p.getTextContent()).then(t=>textoDosItensPdf(t.items));cache.set(pagina,pending);pending.catch(()=>cache.delete(pagina));}
    return cache.get(pagina);
  }
  async function procurar(autoRevelar=true){
    const assinatura=JSON.stringify([input.value,estado.opcoes]);if(estado.assinatura!==assinatura)estado.atual=null;estado.assinatura=assinatura;const restaurar=!autoRevelar?estado.atual:null;
    abort?.abort();abort=new AbortController();const sinal=abort.signal,token=++geracao;estado.consulta=input.value;resultados=[];ativo=-1;limite=false;navegou=false;limpar();renderResultados();
    if(!input.value.trim()){status.textContent='Procure no texto do artigo inteiro.';return;}
    status.textContent='Lendo o texto das páginas…';
    let pdf=infoPdf();
    if(art.pdfBlobUrl&&!pdf){for(let i=0;i<120&&!pdf;i++){if(sinal.aborted||destruido)return;await new Promise(r=>setTimeout(r,100));pdf=infoPdf();}if(sinal.aborted||destruido||token!==geracao)return;if(!pdf){status.textContent='O PDF ainda não está disponível. Reabra o arquivo e tente novamente.';return;}}
    const total=Math.max(pdf?.n||pdf?.doc.numPages||0,art.conteudoPaginasPdf?.length||0,...[...root.querySelectorAll('[data-num-pagina]')].map(el=>Number(el.dataset.numPagina)||0));
    try{
      const found=await buscarNasPaginas({total,lerPagina:p=>lerPagina(p,pdf),consulta:input.value,opcoes:{...estado.opcoes},signal:sinal,onProgress:p=>{if(token!==geracao||sinal.aborted)return;if(p.processadas%8===0||p.processadas===total){status.textContent=`Pesquisando página ${p.processadas} de ${total}…`;resultados=p.resultados;limite=p.limitado;if(ativo<0&&resultados.length)ativo=0;renderResultados();}}});
      if(found.cancelado||sinal.aborted||destruido||token!==geracao)return;
      resultados=found.resultados;limite=found.limitado;ativo=resultados.length?Math.max(0,Math.min(ativo,resultados.length-1)):-1;if(restaurar){const anterior=resultados.findIndex(r=>r.pagina===restaurar.pagina&&r.ordem===restaurar.ordem);if(anterior>=0)ativo=anterior;}renderResultados();
      status.textContent=limite?'Mais de 1.000 ocorrências. Refine o termo para localizar as demais.':found.erros?`${resultados.length} ocorrências. Não foi possível ler ${found.erros} página(s).`:!total?'Abra um PDF para pesquisar o texto.':found.vazias===total?'Este PDF não possui texto pesquisável. PDFs digitalizados precisam de reconhecimento de texto (OCR).':resultados.length?`${resultados.length} ${resultados.length===1?'ocorrência':'ocorrências'} em ${new Set(resultados.map(r=>r.pagina)).size} ${new Set(resultados.map(r=>r.pagina)).size===1?'página':'páginas'}.`:'Nenhum trecho encontrado com estas opções.';
      if(resultados.length&&!navegou&&autoRevelar)ir(0);else agendarPintura();
    }catch(error){if(!sinal.aborted&&token===geracao)status.textContent='Não foi possível pesquisar este arquivo. Tente reabri-lo.';}
  }
  function abrir(foco=true){alinhar();if(!visivel()){estado.aberta=true;panel.hidden=true;return;}if(estado.aberta&&!panel.hidden){if(foco){input.focus();input.select();}return;}estado.aberta=true;panel.hidden=false;button.setAttribute('aria-expanded','true');if(foco){input.focus();input.select();}procurar(foco);}
  function fechar(){estado.aberta=false;panel.hidden=true;button.setAttribute('aria-expanded','false');abort?.abort();geracao++;clearTimeout(timer);limpar();button.focus({preventScroll:true});}
  button.addEventListener('click',()=>abrir());input.addEventListener('input',()=>{estado.consulta=input.value;abort?.abort();geracao++;clearTimeout(timer);resultados=[];ativo=-1;limpar();renderResultados();status.textContent='Pesquisando…';timer=setTimeout(()=>{timer=0;procurar();},200);});
  panel.addEventListener('click',e=>{const option=e.target.closest('[data-option]'),result=e.target.closest('[data-result]'),action=e.target.closest('[data-find]')?.dataset.find;if(option){const name=option.dataset.option;estado.opcoes[name]=!estado.opcoes[name];option.setAttribute('aria-pressed',String(estado.opcoes[name]));clearTimeout(timer);procurar();}if(result){ir(Number(result.dataset.result));input.focus({preventScroll:true});}if(action==='close')fechar();if(action==='next')ir(ativo+1);if(action==='prev')ir(ativo-1);});
  const teclado=e=>{
    if(destruido||!visivel()||document.querySelector('.ath-modal-backdrop,.ath-modal-overlay'))return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopPropagation();abrir();return;}
    if(!estado.aberta)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fechar();}
    else if(e.key==='F3'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='g'||panel.contains(e.target)&&e.key==='Enter'&&!e.target.closest('button')){e.preventDefault();if(timer){clearTimeout(timer);timer=0;procurar();}else ir(ativo+(e.shiftKey?-1:1));}
  };
  const redimensionar=()=>{alinhar();agendarPintura();};
  window.addEventListener('keydown',teclado,true);palco?.addEventListener('scroll',agendarPintura,{passive:true});window.addEventListener('resize',redimensionar);
  const pronto=e=>{const layer=e.target.closest('[data-texto-pag]');if(layer)modelos.delete(layer);agendarPintura();};root.addEventListener('athenes:pdf-text-ready',pronto);
  const observer=new MutationObserver(mutations=>{let mudou=false,reindexar=false;for(const m of mutations){const el=m.target.nodeType===1?m.target:m.target.parentElement;const layer=el?.closest('[data-texto-pag]');if(layer){modelos.delete(layer);mudou=true;if(el.closest('[data-colunas-pag]'))reindexar=true;}}if(mudou)agendarPintura();if(reindexar&&estado.aberta&&input.value.trim()){abort?.abort();geracao++;clearTimeout(timer);timer=setTimeout(()=>{timer=0;procurar(false);},200);}});observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style']});
  let lifecycle;
  const controller={abrir,destroy(){if(destruido)return;estado.foco=!!estado.aberta&&document.activeElement===input;estado.selecao={inicio:input.selectionStart||0,fim:input.selectionEnd||0};destruido=true;abort?.abort();geracao++;clearTimeout(timer);cancelAnimationFrame(frame);observer.disconnect();lifecycle?.disconnect();resizeObserver?.disconnect();root.removeEventListener('athenes:pdf-text-ready',pronto);window.removeEventListener('keydown',teclado,true);window.removeEventListener('resize',redimensionar);palco?.removeEventListener('scroll',agendarPintura);limpar();host.remove();if(!jaPosicionado)anchor.classList.remove('ath-reader-find-container');button.remove();}};
  lifecycle=new MutationObserver(()=>{if(destruido)return;if(!root.isConnected){estado.aberta=false;controller.destroy();return;}if(!visivel()&&!panel.hidden){panel.hidden=true;abort?.abort();geracao++;clearTimeout(timer);limpar();}else if(visivel()&&estado.aberta&&panel.hidden)abrir(false);if(visivel())alinhar();});
  for(let el=root;el;el=el.parentElement)lifecycle.observe(el,{childList:true,attributes:true,attributeFilter:['hidden','aria-hidden','style','class']});
  if(estado.aberta){abrir(false);if(estado.foco&&visivel()){input.focus({preventScroll:true});if(estado.selecao)input.setSelectionRange(estado.selecao.inicio,estado.selecao.fim);}}
  return controller;
}
