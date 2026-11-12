import test from 'node:test';
import assert from 'node:assert/strict';
import {conicSectors,imagePlacement} from '../src/relations/download.js';
import {downloadMenuMarkup} from '../src/relations/controls.js';
test('um menu de baixar oferece os formatos e mantém o acionador como ícone',()=>{
 const html=downloadMenuMarkup(format=>`data-format="${format}"`);assert.equal((html.match(/<summary/g)||[]).length,1);assert.match(html,/aria-label="Baixar visualização"/);assert.match(html,/data-format="svg"/);assert.match(html,/data-format="png"/);assert.ok(!html.includes('Baixar SVG'));
});
test('geometria da imagem mantém cover, foco, contain e stretch',()=>{
 assert.deepEqual(imagePlacement(100,100,200,100,'cover','50% 50%'),{x:-50,y:0,width:200,height:100});
 assert.deepEqual(imagePlacement(100,100,200,100,'cover','100% 50%'),{x:-100,y:0,width:200,height:100});
 assert.deepEqual(imagePlacement(100,100,200,100,'contain'),{x:0,y:25,width:100,height:50});
 assert.deepEqual(imagePlacement(100,100,200,100,'fill'),{x:0,y:0,width:100,height:100});
});
test('roscas HTML exportam seus setores e a faixa restante',()=>{
 const svg=conicSectors('conic-gradient(rgb(10, 20, 30) 0% 33%, rgb(50, 60, 70) 33% 100%)',0,0,120,120);assert.equal((svg.match(/<path/g)||[]).length,2);assert.match(svg,/rgb\(50, 60, 70\)/);assert.ok(!/NaN|Infinity/.test(svg));
 assert.match(conicSectors('conic-gradient(rgb(1, 2, 3) 50%, rgb(4, 5, 6) 0deg)',0,0,110,110),/rgb\(4, 5, 6\)/);
});
