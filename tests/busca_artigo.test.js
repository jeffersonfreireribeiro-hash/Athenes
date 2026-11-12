import test from 'node:test';
import assert from 'node:assert/strict';
import {encontrarNoTexto,textoDosItensPdf,buscarNasPaginas} from '../src/core/athenes_busca_artigo.js';
test('busca literal ignora acentos e caixa, com opções para distingui-los',()=>{
 const text='Saúde saúde saude SAUDE';
 assert.equal(encontrarNoTexto(text,'saude').length,4);
 assert.equal(encontrarNoTexto(text,'saude',{semAcentos:false}).length,2);
 assert.equal(encontrarNoTexto(text,'Saúde',{maiusculas:true,semAcentos:false}).length,1);
 assert.equal(encontrarNoTexto('sau\u0301de','saúde',{semAcentos:false}).length,1);
 assert.equal(encontrarNoTexto('كِ','ك',{semAcentos:false,inteira:true}).length,0);
 assert.equal(encontrarNoTexto('texto [a+b] literal','[a+b]').length,1);
});
test('mapeia ligaturas e palavras hifenizadas na quebra para o texto original',()=>{
 for(const [text,q] of [['oﬃce','office'],['mobili-\ndade','mobilidade'],['SAÚDE','saude']]){
  const [m]=encontrarNoTexto(text,q);assert.ok(m);assert.equal(text.slice(m.inicio,m.fim),text);
 }
 assert.equal(encontrarNoTexto('cidade cidades cidadão','cidade',{inteira:true}).length,1);
 assert.equal(encontrarNoTexto('cidade cidades','cidade').length,2);
 assert.equal(encontrarNoTexto('guarda-\nchuva','guarda-chuva').length,1);
 assert.equal(encontrarNoTexto('guarda-chuva','guarda-chuva').length,1);
});
test('texto PDF mantém fragmentos de palavra unidos, espaços geométricos e quebras',()=>{
 const items=[{str:'habi',transform:[10,0,0,10,0,100],width:20},{str:'tação',transform:[10,0,0,10,20,100],width:25},{str:'social',transform:[10,0,0,10,50,100],width:30,hasEOL:true},{str:'nova',transform:[10,0,0,10,0,80],width:20}];
 assert.equal(textoDosItensPdf(items),'habitação social\nnova');
 assert.equal(textoDosItensPdf([{str:'علم',dir:'rtl',transform:[10,0,0,10,190,100],width:20},{str:'المدن',dir:'rtl',transform:[10,0,0,10,140,100],width:40}]),'علم المدن');
});
test('busca todas as páginas inclusive as não renderizadas e limita termos muito amplos',async()=>{
 const read=[];const r=await buscarNasPaginas({total:3,consulta:'saude',lerPagina:async p=>{read.push(p);return p===2?'Sem ocorrência.':'Saúde pública e saúde urbana.';}});
 assert.deepEqual(read,[1,2,3]);assert.deepEqual(r.resultados.map(m=>m.pagina),[1,1,3,3]);
 for(const m of r.resultados)assert.match(m.trecho.slice(m.destaque.inicio,m.destaque.fim),/saúde/i);
 const limited=await buscarNasPaginas({total:3,consulta:'a',limite:2,lerPagina:async()=>'a a a'});assert.equal(limited.resultados.length,2);assert.equal(limited.limitado,true);
});
test('cancelamento não publica resultados antigos e falhas de página são informadas',async()=>{
 const ac=new AbortController();const r=await buscarNasPaginas({total:3,consulta:'a',signal:ac.signal,lerPagina:async()=>{ac.abort();return 'a';}});assert.equal(r.cancelado,true);assert.deepEqual(r.resultados,[]);
 const fail=await buscarNasPaginas({total:2,consulta:'a',lerPagina:async p=>{if(p===1)throw Error('Falhou');return 'a';}});assert.equal(fail.erros,1);assert.equal(fail.resultados[0].pagina,2);
});
