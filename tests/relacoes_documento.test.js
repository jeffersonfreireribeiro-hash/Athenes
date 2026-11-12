import test from 'node:test';import assert from 'node:assert/strict';
import {registrosReferencias,registrosDocumento,inserirFiguraRelacoes,graficoRelacaoDoItem,sincronizarRelacoesBiblioteca} from '../src/core/athenes_relacoes.js';
import {analyzeRelations} from '../src/relations/analysis.js';
import {renderRelations} from '../src/relations/render.js';
import {resolverItemCodigo} from '../src/core/athenes_figura_codigo.js';
import {criarDocumento} from '../src/core/athenes_documento.js';
import {exportarPacoteEstilo,validarPacoteEstilo,aplicarPacoteEstilo,obterPromptIaParaExtracaoDeLayout} from '../src/core/athenes_pacote_estilo.js';
import {normalizeRelationStyle} from '../src/relations/render.js';
import {aoEditarBiblioteca,definirArtigos,reiniciar} from '../src/core/athenes_biblioteca_artigos.js';
const refs=[{id:'a',titulo:'Artigo A',autores:[{prenome:'Ana',sobrenome:'Silva'}],tags:[{tag:'Habitação'}],ano:2024,fichamento:{notasPagina:{1:[{texto:'Texto de anotação'}]}}},{id:'b',titulo:'Artigo B',autores:['Bruno'],palavrasChave:['Saúde'],ano:2025}];
test('palavras-chave e etiquetas têm campos próprios e metadados Zotero são preservados',()=>{
 const [r]=registrosReferencias([{palavrasChave:[],tags:[{tag:'Saúde'}],itemTypeZotero:'journalArticle',camposZotero:{publisher:'Editora A',language:'pt',DOI:'10.1/exemplo'}}]);
 assert.deepEqual(r.fields.theme,['Saúde']);assert.deepEqual(r.fields.tags,['Saúde']);assert.deepEqual(r.fields.keywords,[]);
 assert.equal(r.fields.type,'journalArticle');assert.equal(r.fields.publisher,'Editora A');assert.equal(r.fields.language,'pt');assert.equal(r.fields.doi,'10.1/exemplo');
 const [other]=registrosReferencias([{palavrasChave:'Saúde; Mobilidade',tags:[{tag:'Saúde'},{tag:'Cidade'}]}]);
 assert.deepEqual(other.fields.theme,['Saúde','Mobilidade','Cidade']);assert.equal(other.text.keywords,'Saúde; Mobilidade');
});
test('adaptador usa metadados existentes e inclui anotações sem inventar países',()=>{const r=registrosReferencias(refs);assert.deepEqual(r[0].fields.author,['Ana Silva']);assert.deepEqual(r[0].fields.theme,['Habitação']);assert.match(r[0].text.notes,/Texto de anotação/);assert.equal(r[0].fields.location,'');});
test('figura vinculada acompanha as referências; versão congelada conserva os dados',()=>{
 const doc=criarDocumento();doc.referencias=structuredClone(refs);const config={stages:['author','theme','year']},graph=analyzeRelations(registrosReferencias(refs),config),style={layout:'sankey'},svg=renderRelations(graph,style);
 const live=inserirFiguraRelacoes(doc,{sourceId:'document-references',config,graph,style,svg,linked:true}),fixed=inserirFiguraRelacoes(doc,{sourceId:'document-references',config,graph,style,svg,linked:false});const original=graficoRelacaoDoItem(fixed.itens[0],doc);
 doc.referencias[0].autores=['Novo autor'];assert.match(graficoRelacaoDoItem(live.itens[0],doc),/Novo autor/);assert.equal(graficoRelacaoDoItem(fixed.itens[0],doc),original);assert.equal(resolverItemCodigo(live,live.itens[0],0,doc).ok,true);assert.ok(!registrosDocumento(doc).some(r=>r.id===live.id));
});
test('vínculo acompanha a pasta e não transforma pasta vazia em biblioteca inteira',()=>{
 const doc=criarDocumento(),config={stages:['author','theme']},graph=analyzeRelations([],config),style={layout:'sankey'};
 const figure=inserirFiguraRelacoes(doc,{sourceId:'library',scope:{folderId:'pasta-1'},config,graph,style,svg:renderRelations(graph,style),linked:true,records:[]}),binding=figure.itens[0].relationAnalysis;
 assert.equal(sincronizarRelacoesBiblioteca(doc,[{...refs[0],pastaId:'outra'}]),false);assert.deepEqual(binding.records,[]);
 assert.equal(sincronizarRelacoesBiblioteca(doc,[{...refs[0],pastaId:'pasta-1'}]),true);assert.equal(binding.records.length,1);
 assert.equal(sincronizarRelacoesBiblioteca(doc,[{...refs[0],pastaId:'outra'}]),true);assert.equal(binding.records.length,0);
});
test('instantâneo limita depois da seleção e salva o visual no pacote canônico',()=>{
 const doc=criarDocumento(),records=Array.from({length:2300},(_,i)=>({id:String(i),label:'Registro '+i,fields:{author:'Ana',theme:'Teste'}})),config={stages:['author','theme'],selectedIds:['2299']},graph=analyzeRelations(records,config),style={layout:'arc',labels:false};
 const item=inserirFiguraRelacoes(doc,{sourceId:'library',config,graph,style,svg:renderRelations(graph,style),linked:true,records}).itens[0];assert.deepEqual(item.relationAnalysis.records.map(r=>r.id),['2299']);assert.equal(exportarPacoteEstilo(doc).estilo_relacoes.layout,'arc');
 assert.ok(!/[;:()]/.test(normalizeRelationStyle({font:'Arial;display:none;background:url(test)'}).font));
});
test('edições locais notificam relações sem depender de sincronização remota',async()=>{
 reiniciar();let calls=0;const stop=aoEditarBiblioteca(()=>calls++);definirArtigos(structuredClone(refs));await Promise.resolve();assert.equal(calls,1);stop();reiniciar();
});
test('papel de comentário não insere nem atualiza figuras e o texto inclui itens e notas',()=>{
 const doc=criarDocumento(),config={stages:['author','theme']},graph=analyzeRelations([],config);doc.compartilhadoComigo=true;doc.permissao='comentario';assert.throws(()=>inserirFiguraRelacoes(doc,{sourceId:'library',config,graph,style:{},svg:'',linked:true}),/não permite/);assert.equal(sincronizarRelacoesBiblioteca(doc,refs),false);
 const blocks={secoes:[{blocos:[{id:'list',tipo:'lista',itens:['Habitação social','Saúde urbana']},{id:'table',tipo:'tabela',titulo:'Dados',colunas:['Mobilidade'],linhas:[['Território']]}]}]};assert.match(registrosDocumento(blocks).map(r=>r.text.text).join(' '),/Habitação social[\s\S]*Território/);
 const records=registrosReferencias([{id:'n',fichamento:{citacoesMarcadas:[{texto:'Destaque',comentario:'Comentário'}]},notasZotero:[{html:'<p>Nota externa</p>'}]}]);assert.match(records[0].text.notes,/Destaque[\s\S]*Comentário[\s\S]*Nota externa/);
});
test('biblioteca vinculada atualiza o instantâneo e o tema viaja no pacote de estilo',()=>{
 const doc=criarDocumento(),config={stages:['author','theme']},graph=analyzeRelations(registrosReferencias(refs),config),style={layout:'clusters',nodeScale:1.4,labels:false,primary:'#123456'};
 const figure=inserirFiguraRelacoes(doc,{sourceId:'library',config,graph,style,svg:renderRelations(graph,style),linked:true,records:[]});assert.equal(sincronizarRelacoesBiblioteca(doc,refs),true);assert.equal(sincronizarRelacoesBiblioteca(doc,refs),false);assert.equal(figure.itens[0].relationAnalysis.records.length,2);
 doc.estilo_relacoes=style;const pack=exportarPacoteEstilo(doc);assert.equal(validarPacoteEstilo(pack).valido,true);const next=criarDocumento();aplicarPacoteEstilo(next,pack);assert.equal(next.estilo_relacoes.nodeScale,1.4);assert.equal(next.estilo_relacoes.labels,false);assert.equal(next.estilo_relacoes.layout,'clusters');assert.match(obterPromptIaParaExtracaoDeLayout(),/estilo_relacoes/);
});
