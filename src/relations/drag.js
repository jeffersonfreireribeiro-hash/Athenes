// Move SVG nodes and their incident links without rerunning the graph layout.
export function installRelationDrag(viewport,drawing){
 const offsets=new Map();let active=null,moved=false;
 const point=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(drawing.querySelector('svg').getScreenCTM().inverse());
 function apply(){
  for(const node of drawing.querySelectorAll('[data-relation-node]')){const o=offsets.get(node.dataset.relationNode)||{x:0,y:0};node.setAttribute('transform',`translate(${o.x} ${o.y})`);}
  for(const edge of drawing.querySelectorAll('[data-relation-edge]')){
   const [a,b]=JSON.parse(edge.dataset.relationEdge),start=offsets.get(a)||{x:0,y:0},end=offsets.get(b)||{x:0,y:0};
   const original=edge.dataset.originalPath||(edge.dataset.originalPath=edge.getAttribute('d'));
   const numbers=original.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[];let index=0;const pairs=numbers.length/2;
   edge.setAttribute('d',original.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,value=>{const i=index++,t=Math.floor(i/2)/(pairs-1),axis=i%2?'y':'x';return Number(value)+start[axis]*(1-t)+end[axis]*t;}));
  }
 }
 const down=e=>{const node=e.target.closest('[data-relation-node]');if(!node||e.button!==0)return;const p=point(e),id=node.dataset.relationNode;active={id,p,offset:offsets.get(id)||{x:0,y:0},pointer:e.pointerId};moved=false;viewport.setPointerCapture(e.pointerId);e.preventDefault();};
 const move=e=>{if(!active||active.pointer!==e.pointerId)return;const p=point(e),dx=p.x-active.p.x,dy=p.y-active.p.y;if(Math.hypot(dx,dy)>3)moved=true;offsets.set(active.id,{x:active.offset.x+dx,y:active.offset.y+dy});apply();};
 const up=e=>{if(active?.pointer===e.pointerId){active=null;if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);}};
 const click=e=>{if(moved){e.stopImmediatePropagation();moved=false;}};
 viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',up);viewport.addEventListener('click',click,true);
 return {apply,reset(){offsets.clear();apply();},destroy(){viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',up);viewport.removeEventListener('pointercancel',up);viewport.removeEventListener('click',click,true);}};
}
