// SPDX-License-Identifier: GPL-3.0-or-later
// Portable, deterministic relation analysis. Records remain in their owning application.
export const LIMITS={records:2000,nodes:180,links:900,terms:45,paths:256};
export const clean=v=>String(v??'').normalize('NFC').trim();
const key=v=>clean(v).toLocaleLowerCase('pt-BR');
const ignored=new Set('a o as os um uma uns umas de da do das dos em no na nos nas por para com sem e ou que se ao aos às é foi são ser como mais menos the and of in to for on with an is are by from'.split(' '));
export function normalizeAnalysis(raw={}){
 const strings=v=>(Array.isArray(v)?v:[]).map(clean).filter(Boolean);
 return {mode:raw.mode==='terms'?'terms':'fields',stages:strings(raw.stages).slice(0,6),textFields:strings(raw.textFields),context:raw.context==='paragraph'?'paragraph':'document',counting:raw.counting==='full'?'full':'fractional',measure:clean(raw.measure),colorField:clean(raw.colorField),minimum:Math.max(1,Math.min(1000,Number(raw.minimum)||1)),minLink:Math.max(0,Number(raw.minLink)||0),ignoredTerms:strings(raw.ignoredTerms),phrases:strings(raw.phrases),synonyms:raw.synonyms&&typeof raw.synonyms==='object'&&!Array.isArray(raw.synonyms)?Object.fromEntries(Object.entries(raw.synonyms).slice(0,1000).map(([a,b])=>[key(a),key(b)])): {},startYear:Number(raw.startYear)||null,endYear:Number(raw.endYear)||null,yearField:clean(raw.yearField),selectedIds:strings(raw.selectedIds)};
}
const phraseCache=new Map();
export function extractTerms(text,config={}){
 const c=normalizeAnalysis(config),stop=new Set([...ignored,...c.ignoredTerms.map(key)]),found=new Set(),alias=t=>Object.hasOwn(c.synonyms,t)?c.synonyms[t]:t,tokens=key(text).replace(/<[^>]*>/g,' ').slice(0,40000).match(/[\p{L}\p{N}-]+/gu)||[];
 const cacheKey=JSON.stringify(c.phrases.slice(0,200));let trie=phraseCache.get(cacheKey);
 if(!trie){trie={next:new Map()};for(const phrase of c.phrases.slice(0,200)){const p=key(phrase).slice(0,300),words=p.match(/[\p{L}\p{N}-]+/gu)||[];let branch=trie;for(const word of words){if(!branch.next.has(word))branch.next.set(word,{next:new Map()});branch=branch.next.get(word);}if(words.length)branch.phrase=p;}if(phraseCache.size>=4)phraseCache.delete(phraseCache.keys().next().value);phraseCache.set(cacheKey,trie);}
 for(let i=0;i<tokens.length&&found.size<LIMITS.terms;i++){let branch=trie,phrase='',last=i;for(let j=i;j<tokens.length&&j<i+50;j++){branch=branch.next.get(tokens[j]);if(!branch)break;if(branch.phrase){phrase=branch.phrase;last=j;}}const term=phrase||tokens[i];if(phrase)i=last;else if(term.length<3||!/[\p{L}]/u.test(term))continue;const normalized=alias(term);if(normalized&&!stop.has(normalized)&&!stop.has(term))found.add(normalized);}
 return [...found];
}
export function analyzeRelations(input=[],configuration={}){
 const config=normalizeAnalysis(configuration),nodes=new Map(),links=new Map(),warnings=[],chosen=new Set(config.selectedIds),ids=new Set();let processed=0,missing=0,omitted=Number(input.sourceOmitted)||0,recordWeight=0,textBudget=2000000;
 const values=(row,field)=>{const raw=row.fields?.[field];return [...new Set((Array.isArray(raw)?raw:[raw]).map(clean).filter(Boolean))];};
 let limited=false,recordGroup='';
 const addNode=(id,label,stage,recordId,group)=>{if(!nodes.has(id)){if(nodes.size>=3000){limited=true;return null;}nodes.set(id,{id,label,stage,group:group||'',value:0,records:[],seen:new Set(),groups:new Map()});}const n=nodes.get(id);if(!n.seen.has(recordId)){n.seen.add(recordId);n.value++;if(recordGroup)n.groups.set(recordGroup,(n.groups.get(recordGroup)||0)+1);if(n.records.length<100)n.records.push(recordId);}return n;};
 const addLink=(source,target,value,recordId)=>{if(!nodes.has(source)||!nodes.has(target))return;const id=JSON.stringify([source,target]);if(!links.has(id)){if(links.size>=20000){limited=true;return;}links.set(id,{source,target,value:0,records:[],recordCount:0,seen:new Set()});}const l=links.get(id);l.value+=value;if(!l.seen.has(recordId)){l.seen.add(recordId);l.recordCount++;if(l.records.length<100)l.records.push(recordId);}};
 for(const row of Array.isArray(input)?input:[]){const id=clean(row.id);if(!id||ids.has(id)||chosen.size&&!chosen.has(id))continue;ids.add(id);
  if(config.yearField&&(config.startYear||config.endYear)){const rawYear=values(row,config.yearField)[0]||'',year=Number(rawYear.match(/\b\d{4}\b/)?.[0]||rawYear);if(!year||config.startYear&&year<config.startYear||config.endYear&&year>config.endYear)continue;}
  if(processed>=LIMITS.records){omitted++;continue;}processed++;recordGroup=config.colorField?values(row,config.colorField).sort().join(' / ')||'Não informado':'';
  if(config.mode==='terms'){
   if(textBudget<=0){omitted++;continue;}const rawContent=config.textFields.map(f=>row.text?.[f]??values(row,f).join(' ')).join('\n'),content=rawContent.slice(0,Math.min(40000,textBudget));textBudget-=content.length;if(content.length<rawContent.length)warnings.push('O texto foi limitado a 40 mil caracteres por registro e 2 milhões por análise. Refine os registros para analisar o restante.');const contexts=config.context==='paragraph'?content.split(/\n\s*\n/):[content];const perRecord=new Set();if(contexts.length>300)warnings.push('O contexto foi limitado aos primeiros 300 parágrafos do registro.');
   for(const context of contexts.slice(0,300)){const terms=extractTerms(context,config);for(const t of terms)addNode('term:'+t,t,0,id);for(let i=0;i<terms.length;i++)for(let j=i+1;j<terms.length;j++){const pair=[terms[i],terms[j]].sort(),k=JSON.stringify(pair);if(!perRecord.has(k)){perRecord.add(k);addLink('term:'+pair[0],'term:'+pair[1],1,id);}}}
  }else{
   if(config.stages.length<2)continue;
   const stages=config.stages.map(f=>{const list=values(row,f);if(!list.length){missing++;return ['Não informado'];}return list;});const combinations=stages.reduce((n,a)=>n*a.length,1);
   if(combinations>LIMITS.paths){warnings.push(`Registro ${id}: mais de ${LIMITS.paths} combinações; refine os campos.`);continue;}
   let weight=config.measure?Number(values(row,config.measure)[0]):1;if(!Number.isFinite(weight)||weight<=0||weight>1e12){omitted++;continue;}recordWeight+=weight;
   const unit=config.counting==='fractional'?weight/combinations:weight;let paths=[[]];for(const stage of stages)paths=paths.flatMap(p=>stage.map(v=>[...p,v]));
   for(const p of paths){const chain=p.map((v,s)=>addNode(JSON.stringify([s,key(v)]),v,s,id));for(let i=0;i<chain.length-1;i++)if(chain[i]&&chain[i+1])addLink(chain[i].id,chain[i+1].id,unit,id);}
  }
 }
 const selected=[...nodes.values()].filter(n=>n.value>=config.minimum).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id)).slice(0,LIMITS.nodes),keep=new Set(selected.map(n=>n.id));
 const visible=[...links.values()].filter(l=>keep.has(l.source)&&keep.has(l.target)&&l.value>=config.minLink).sort((a,b)=>b.value-a.value||a.source.localeCompare(b.source)).slice(0,LIMITS.links);
 if(nodes.size>selected.length)warnings.push(`${nodes.size-selected.length} itens omitidos por frequência mínima ou limite de ${LIMITS.nodes} nós.`);
 if(links.size>visible.length)warnings.push(`${links.size-visible.length} conexões omitidas por filtros ou limites.`);
 if(omitted)warnings.push(`${omitted} registros omitidos por limites ou medida inválida.`);
 if(limited)warnings.push('Limite de processamento atingido. Refine os campos ou os termos para analisar todas as relações.');
 return {version:1,nodes:selected.map(({seen,groups,...n})=>({...n,group:[...groups].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||n.group})),links:visible.map(({seen,...l})=>l),config,stats:{processed,missing,omitted,recordWeight,totalNodes:nodes.size,totalLinks:links.size},warnings:[...new Set(warnings)].slice(0,20)};
}
