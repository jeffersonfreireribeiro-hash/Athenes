import {stepNetwork} from './physics.js';
// Pointer selection and exploratory physics share one SVG geometry cache.
export function installRelationDrag(viewport,drawing,{elastic=()=>false}={}){
 const offsets=new Map();let active=null,moved=false,frame=0,heat=0,geometry=null,simulation=[];
 const point=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(drawing.querySelector('svg').getScreenCTM().inverse());
 function stop(){cancelAnimationFrame(frame);frame=0;}
 function cache(){
  const svg=drawing.querySelector('svg');if(geometry?.svg===svg)return geometry;
  stop();simulation=[];
  const nodes=[...drawing.querySelectorAll('[data-relation-node]')].map(el=>{const c=el.querySelector('circle'),r=el.querySelector('rect');return {el,id:el.dataset.relationNode,x:Number(c?.getAttribute('cx')||r?.getAttribute('x')||0),y:Number(c?.getAttribute('cy')||r?.getAttribute('y')||0)};});
  const edges=[...drawing.querySelectorAll('[data-relation-edge]')].map(el=>{const [source,target]=JSON.parse(el.dataset.relationEdge),path=el.getAttribute('d'),numbers=path.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[];return {el,source,target,path,pairs:numbers.length/2};});
  geometry={svg,nodes,edges};return geometry;
 }
 function apply(){
  const g=cache();
  for(const n of g.nodes){const o=offsets.get(n.id)||{x:0,y:0};n.el.setAttribute('transform',`translate(${o.x} ${o.y})`);}
  for(const edge of g.edges){const a=offsets.get(edge.source)||{x:0,y:0},b=offsets.get(edge.target)||{x:0,y:0};let index=0;edge.el.setAttribute('d',edge.path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,value=>{const i=index++,t=Math.floor(i/2)/(edge.pairs-1),axis=i%2?'y':'x';return Number(value)+a[axis]*(1-t)+b[axis]*t;}));}
 }
 function tick(){
  frame=0;if(!geometry?.svg?.isConnected)return;
  stepNetwork(simulation,geometry.edges,active?.id,heat);
  for(const n of simulation){const base=n.base;offsets.set(n.id,{x:n.x-base.x,y:n.y-base.y});}
  apply();heat*=.97;if(active||heat>.02)frame=requestAnimationFrame(tick);
 }
 function wake(){
  const g=cache();if(!elastic()||!g.nodes.every(n=>n.el.querySelector('circle')))return;
  simulation=g.nodes.map(n=>{const o=offsets.get(n.id)||{x:0,y:0};return {id:n.id,x:n.x+o.x,y:n.y+o.y,base:n,vx:0,vy:0};});
  heat=1;if(!frame)frame=requestAnimationFrame(tick);
 }
 function down(e){
  const node=e.target.closest('[data-relation-node]');if(!node||e.button!==0)return;
  const p=point(e),id=node.dataset.relationNode;active={id,node,p,offset:offsets.get(id)||{x:0,y:0},pointer:e.pointerId};moved=false;viewport.setPointerCapture(e.pointerId);e.preventDefault();
 }
 function move(e){
  if(!active||active.pointer!==e.pointerId)return;
  const p=point(e),dx=p.x-active.p.x,dy=p.y-active.p.y;if(!moved&&Math.hypot(dx,dy)<=3)return;
  if(!moved){moved=true;wake();}
  const o={x:active.offset.x+dx,y:active.offset.y+dy};offsets.set(active.id,o);
  const n=simulation.find(n=>n.id===active.id);if(n){n.x=n.base.x+o.x;n.y=n.base.y+o.y;heat=1;}
  apply();
 }
 function up(e){
  if(active?.pointer!==e.pointerId)return;
  const selection=active.node;active=null;
  if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
  if(!moved&&e.type!=='pointercancel')selection.dispatchEvent(new CustomEvent('relation-select',{bubbles:true}));
 }
 const click=e=>{if(moved){e.stopImmediatePropagation();moved=false;}};
 viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',up);viewport.addEventListener('click',click,true);
 return {apply,reset(){stop();offsets.clear();simulation=[];apply();},destroy(){stop();viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',up);viewport.removeEventListener('pointercancel',up);viewport.removeEventListener('click',click,true);}};
}
