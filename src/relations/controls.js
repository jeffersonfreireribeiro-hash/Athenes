// SPDX-License-Identifier: GPL-3.0-or-later
const svg=path=>`<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
export const downloadIcon=svg('<path d="M10 3v9m-4-4 4 4 4-4M4 13v4h12v-4"/>');
export const databaseIcon=svg('<ellipse cx="10" cy="4.5" rx="6" ry="2.5"/><path d="M4 4.5v5c0 3.3 12 3.3 12 0v-5M4 9.5v5c0 3.3 12 3.3 12 0v-5"/>');
let serial=0,loaded=false;
function prepare(){
 if(typeof document==='undefined'||loaded)return;loaded=true;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./controls.css',import.meta.url).href;document.head.append(link);
 document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('.visual-download-menu[open]'))if(!menu.contains(event.target))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const menu of document.querySelectorAll('.visual-download-menu[open]')){menu.open=false;menu.querySelector('summary')?.focus();}});
 document.addEventListener('toggle',event=>{const menu=event.target;if(!menu.matches?.('.visual-download-menu[open]'))return;const options=menu.querySelector('.visual-format-options');options.style.left='';options.style.right='0';options.style.top='calc(100% + 6px)';options.style.bottom='';const box=options.getBoundingClientRect();if(box.left<8){options.style.left=(8-menu.getBoundingClientRect().left)+'px';options.style.right='auto';}if(box.bottom>innerHeight-8){options.style.top='auto';options.style.bottom='calc(100% + 6px)';}},true);
}
/** Attributes are application-owned constants, never record content. */
export function downloadMenuMarkup(attributes,formats=['svg','png']){
 prepare();const id='visual-export-'+ ++serial;
 return `<details class="visual-download-menu"><summary class="visual-icon-button" title="Baixar visualização" aria-label="Baixar visualização" aria-controls="${id}">${downloadIcon}</summary><div id="${id}" class="visual-format-options" role="group" aria-label="Formato do arquivo">${formats.map(format=>`<button type="button" ${attributes(format)}>${format.toUpperCase()}<small>${format==='svg'?'Vetor editável':format==='png'?'Imagem em alta resolução':format==='original'?'Abrir o arquivo original':'Dados e configuração'}</small></button>`).join('')}</div></details>`;
}
