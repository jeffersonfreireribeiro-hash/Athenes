import test from 'node:test';
import assert from 'node:assert/strict';
import {stepNetwork} from '../src/relations/physics.js';
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
