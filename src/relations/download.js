// SPDX-License-Identifier: GPL-3.0-or-later
const name=s=>String(s||'grafico').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function imagePlacement(width,height,naturalWidth,naturalHeight,fit='fill',position='50% 50%'){
 let w=width,h=height;const nw=naturalWidth||width,nh=naturalHeight||height;
 if(fit!=='fill'){let factor=fit==='cover'?Math.max(width/nw,height/nh):Math.min(width/nw,height/nh);if(fit==='none')factor=1;if(fit==='scale-down')factor=Math.min(1,factor);w=nw*factor;h=nh*factor;}
 const parts=position.trim().split(/\s+/),fraction=(v,extra)=>v?.endsWith('%')?extra*parseFloat(v)/100:v?.endsWith('px')?parseFloat(v):extra*({left:0,top:0,center:.5,right:1,bottom:1}[v]??.5);
 return {x:fraction(parts[0],width-w),y:fraction(parts[1]||'50%',height-h),width:w,height:h};
}
/** Hard conic stops used by HTML donut charts, expressed as SVG sectors. */
export function conicSectors(background,x,y,width,height){
 if(!background.startsWith('conic-gradient('))return '';
 const stops=[...background.matchAll(/(rgba?\([^)]+\)|#[\da-f]+|[a-z]+)\s+([-\d.]+)(%|deg)(?:\s+([-\d.]+)(%|deg))?/gi)];
 let cursor=0;const cx=x+width/2,cy=y+height/2,r=Math.min(width,height)/2;
 return stops.map((stop,index)=>{const start=stop[4]===undefined?cursor:Math.max(cursor,Number(stop[2])/(stop[3]==='deg'?3.6:1)),end=Math.min(100,Math.max(start,stop[4]===undefined&&index===stops.length-1?100:Number(stop[4]??stop[2])/(stop[5]==='deg'||!stop[5]&&stop[3]==='deg'?3.6:1)));cursor=end;
  if(end<=start)return '';if(end-start>=99.999)return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(stop[1])}"/>`;
  const point=p=>[cx+Math.sin(p*Math.PI/50)*r,cy-Math.cos(p*Math.PI/50)*r];return `<path d="M${cx} ${cy}L${point(start)}A${r} ${r} 0 ${end-start>50?1:0} 1 ${point(end)}Z" fill="${esc(stop[1])}"/>`;
 }).join('');
}
/** Capture a rendered visual as vector primitives, including HTML charts and legends. */
export async function snapshotVisual(element){
 const box=element.getBoundingClientRect();if(!box.width||!box.height)throw Error('A visualização está oculta. Abra o bloco antes de baixar.');const parts=[];let characters=0;
 async function walk(node){
  if(node.nodeType===3){if(!node.textContent.trim())return;if(characters+node.textContent.length>25000)throw Error('A visualização excede o limite de texto para baixar. Reduza os registros ou rótulos exibidos.');const parent=node.parentElement,style=getComputedStyle(parent);if(style.visibility==='hidden')return;const range=document.createRange(),lines=new Map();for(let i=0;i<node.textContent.length&&characters++<25000;i++){range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;const y=Math.round(r.y);if(!lines.has(y))lines.set(y,{x:r.x,y:r.y,h:r.height,text:''});lines.get(y).text+=node.textContent[i];}for(const line of lines.values())parts.push(`<text x="${line.x-box.x}" y="${line.y-box.y+line.h*.8}" font-family="${esc(style.fontFamily)}" font-size="${parseFloat(style.fontSize)}" font-weight="${esc(style.fontWeight)}" fill="${esc(style.color)}">${esc(line.text)}</text>`);return;}
  if(node.nodeType!==1)return;const style=getComputedStyle(node),r=node.getBoundingClientRect();if(style.display==='none'||style.visibility==='hidden'||!r.width||!r.height||node.matches('button,input,select,textarea,.block-toolbar-unified,.data-top-floating-bar,.data-block-toolbar,.block-comment-btn,.ath-visual-download'))return;
  const x=r.x-box.x,y=r.y-box.y;
  if(node instanceof SVGElement){const clone=node.cloneNode(true);clone.style.color=style.color;clone.style.fontFamily=style.fontFamily;clone.setAttribute('x',x);clone.setAttribute('y',y);clone.setAttribute('width',r.width);clone.setAttribute('height',r.height);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');parts.push(new XMLSerializer().serializeToString(clone));return;}
  if(node instanceof HTMLImageElement||node instanceof HTMLCanvasElement){let url=node instanceof HTMLCanvasElement?node.toDataURL('image/png'):node.currentSrc||node.src;if(!url.startsWith('data:')){const response=await fetch(url);if(!response.ok)throw Error('Imagem indisponível para exportação.');const blob=await response.blob();url=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});}const place=imagePlacement(r.width,r.height,node.naturalWidth,node.naturalHeight,style.objectFit,style.objectPosition),id='image-clip-'+parts.length;parts.push(`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${r.width}" height="${r.height}" rx="${parseFloat(style.borderTopLeftRadius)||0}"/></clipPath></defs><image clip-path="url(#${id})" x="${x+place.x}" y="${y+place.y}" width="${place.width}" height="${place.height}" preserveAspectRatio="none" href="${esc(url)}" opacity="${Number(style.opacity)||0}"/>`);return;}
  const background=style.backgroundColor,border=parseFloat(style.borderTopWidth)||0;if(background!=='rgba(0, 0, 0, 0)'||border)parts.push(`<rect x="${x}" y="${y}" width="${r.width}" height="${r.height}" rx="${parseFloat(style.borderTopLeftRadius)||0}" fill="${esc(background)}" stroke="${esc(style.borderTopColor)}" stroke-width="${border}"/>`);
  parts.push(conicSectors(style.backgroundImage,x,y,r.width,r.height));
  if(node.matches('.data-view-donut'))parts.push(`<circle cx="${x+r.width/2}" cy="${y+r.height/2}" r="${Math.max(0,Math.min(r.width,r.height)/2-14)}" fill="white"/>`);
  const clip=style.overflow==='hidden'||style.overflow==='clip',id='visual-clip-'+parts.length;
  if(clip)parts.push(`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${r.width}" height="${r.height}" rx="${parseFloat(style.borderTopLeftRadius)||0}"/></clipPath></defs><g clip-path="url(#${id})">`);
  if(Number(style.opacity)<1)parts.push(`<g opacity="${Number(style.opacity)}">`);
  for(const child of (node.shadowRoot||node).childNodes)await walk(child);
  if(Number(style.opacity)<1)parts.push('</g>');if(clip)parts.push('</g>');
 }
 await walk(element);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.width} ${box.height}">${parts.join('')}</svg>`;
}
export async function downloadRenderedVisual(element,title,format='png'){return downloadSvg(await snapshotVisual(element),title,format);}
export function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name(fileName);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function downloadSvg(svg,title='grafico',format='svg',scale=2){
 const source=svg instanceof SVGElement?new XMLSerializer().serializeToString(svg):String(svg);if(!source.includes('<svg'))throw Error('Não há gráfico vetorial disponível.');
 if(format==='svg'){downloadBlob(new Blob([source],{type:'image/svg+xml;charset=utf-8'}),name(title)+'.svg');return;}
 const url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
 try{const img=new Image();img.src=url;await img.decode();const parsed=new DOMParser().parseFromString(source,'image/svg+xml').documentElement,view=(parsed.getAttribute('viewBox')||'0 0 920 620').split(/[ ,]+/).map(Number),factor=Math.min(4,Math.max(1,Number(scale)||2)),canvas=document.createElement('canvas');canvas.width=Math.min(8000,(view[2]||img.width||920)*factor);canvas.height=Math.min(8000,(view[3]||img.height||620)*factor);const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('Não foi possível gerar a imagem.');downloadBlob(blob,name(title)+'.png');}finally{URL.revokeObjectURL(url);}
}
export async function downloadVisual(element,title='imagem',format='png'){
 if(element instanceof SVGElement||element?.querySelector('svg'))return downloadSvg(element instanceof SVGElement?element:element.querySelector('svg'),title,format);
 if(element instanceof HTMLCanvasElement){const blob=await new Promise(r=>element.toBlob(r,'image/png'));if(!blob)throw Error('Imagem indisponível.');return downloadBlob(blob,name(title)+'.png');}
 const img=element instanceof HTMLImageElement?element:element?.querySelector('img');if(!img)throw Error('Selecione uma imagem ou gráfico para baixar.');
 if(format==='original'){window.open(img.currentSrc||img.src,'_blank','noopener,noreferrer');return;}
 try{return await downloadRenderedVisual(img,title,format);}catch(error){throw Error('Não foi possível converter esta imagem. Se for externa, o servidor precisa permitir a exportação; use a opção Original para abri-la.');}
}
