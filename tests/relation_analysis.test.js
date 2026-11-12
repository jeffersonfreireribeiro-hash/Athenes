import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeRelations,extractTerms} from '../src/relations/analysis.js';
import {renderRelations,RELATION_LAYOUTS,relationPositions} from '../src/relations/render.js';
const rows=[{id:'1',label:'Artigo A',fields:{author:['Ana','Bia'],theme:['Saúde','Habitação'],year:2024},text:{abstract:'Habitação social e saúde. Saúde.'}},{id:'2',label:'Artigo B',fields:{author:['Ana'],theme:['Saúde'],year:2025},text:{abstract:'Saude e habitação social.'}}];
test('fluxos fracionados conservam o peso dos registros em todas as etapas',()=>{
 const graph=analyzeRelations(rows,{stages:['author','theme','year']});for(const stage of [0,1]){const ids=new Set(graph.nodes.filter(n=>n.stage===stage).map(n=>n.id));assert.equal(graph.links.filter(l=>ids.has(l.source)).reduce((s,l)=>s+l.value,0),2);}assert.equal(graph.stats.recordWeight,2);assert.ok(graph.links.every(l=>l.records.length));assert.doesNotThrow(()=>JSON.stringify(graph));
 const full=analyzeRelations(rows,{stages:['author','theme','year'],counting:'full'});assert.equal(full.links.filter(l=>full.nodes.find(n=>n.id===l.source).stage===0).reduce((s,l)=>s+l.value,0),5);
});
test('termos completos, sinônimos e presença por documento não duplicam pesos',()=>{
 const config={mode:'terms',textFields:['abstract'],phrases:['habitação social'],synonyms:{saude:'saúde'}};const g=analyzeRelations(rows,config);assert.equal(g.nodes.length,2);assert.equal(g.links.length,1);assert.equal(g.links[0].value,2);assert.equal(g.links[0].recordCount,2);
 assert.deepEqual(extractTerms('habitação   social; habitação social',config),['habitação social']);assert.ok(extractTerms('constructor prototype comunidade').includes('constructor'));
 const p=analyzeRelations([{id:'x',text:{abstract:'saúde\n\nhabitação'}}],{...config,context:'paragraph'});assert.equal(p.links.length,0);
});
test('campos homônimos em etapas diferentes não viram ciclos, e anos ISO são filtrados',()=>{
 const g=analyzeRelations([{id:'x',fields:{a:'Mesmo',b:'Mesmo',date:'2025-11-12'}}],{stages:['a','b'],yearField:'date',startYear:2025,endYear:2025});assert.equal(g.nodes.length,2);assert.notEqual(g.links[0].source,g.links[0].target);assert.equal(g.stats.processed,1);
 assert.equal(analyzeRelations(rows,{stages:['author','theme'],selectedIds:['2']}).stats.processed,1);
});
test('proveniência, limites e layout são determinísticos e seguros',()=>{
 const g=analyzeRelations(rows,{stages:['author','theme','year'],colorField:'year'});assert.ok(g.nodes.every(n=>n.group));assert.deepEqual(relationPositions(g),relationPositions(g));
 for(const [layout]of RELATION_LAYOUTS){const svg=renderRelations(g,{layout});assert.match(svg,/<svg/);assert.doesNotMatch(svg,/NaN|Infinity|undefined/);}
 const hostile=analyzeRelations([{id:'a',fields:{a:'<script>bad</script>',b:'" onload="x'}}],{stages:['a','b']});assert.doesNotMatch(renderRelations(hostile),/<script>|onload="x/);
 const large=analyzeRelations(Array.from({length:2005},(_,i)=>({id:String(i),fields:{a:'A',b:'B'}})),{stages:['a','b']});assert.equal(large.stats.processed,2000);assert.equal(large.links[0].records.length,100);assert.equal(large.links[0].recordCount,2000);assert.ok(large.warnings.length);
});
