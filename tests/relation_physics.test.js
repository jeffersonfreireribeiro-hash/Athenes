import test from 'node:test';
import assert from 'node:assert/strict';
import {stepNetwork} from '../src/relations/physics.js';
import {RELATION_LAYOUTS} from '../src/relations/render.js';
test('todos os layouts têm reação elástica sem perder a referência de sua estrutura',()=>{
 for(const [layout] of RELATION_LAYOUTS){
  const nodes=[{id:'a',x:200,y:200,base:{x:150,y:200}},{id:'b',x:350,y:200,base:{x:350,y:200}}];
  stepNetwork(nodes,[{source:'a',target:'b'}],'a',1,{layout});
  assert.equal(nodes[0].x,200);assert.notEqual(nodes[1].x,350,layout);
  assert.ok(nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)),layout);
 }
});
test('fluxos altos usam os limites do próprio SVG e preservam nós abaixo de 600px',()=>{
 const nodes=[{id:'a',x:100,y:1200,base:{x:100,y:1200},marginY:80},{id:'b',x:800,y:1200,base:{x:800,y:1200},marginY:80}];
 for(let i=0;i<30;i++)stepNetwork(nodes,[{source:'a',target:'b'}],null,1,{layout:'temporal',height:1800});
 assert.ok(nodes.every(n=>n.y>1100&&n.y<1720));
});
test('repulsão afasta nós próximos e a mola atrai vizinhos distantes',()=>{
 const close=[{id:'a',x:450,y:300},{id:'b',x:460,y:300}];stepNetwork(close,[]);assert.ok(close[1].x-close[0].x>10);
 const linked=[{id:'a',x:100,y:300},{id:'b',x:800,y:300}];stepNetwork(linked,[{source:'a',target:'b'}]);assert.ok(linked[1].x-linked[0].x<700);
});
test('o nó arrastado fica preso ao cursor e a simulação permanece finita',()=>{
 const nodes=[{id:'a',x:450,y:300},{id:'b',x:450,y:300}];
 for(let i=0;i<200;i++)stepNetwork(nodes,[{source:'a',target:'b'}],'a');
 assert.equal(nodes[0].x,450);assert.equal(nodes[0].y,300);
 assert.ok(nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=30&&n.x<=890));
});
