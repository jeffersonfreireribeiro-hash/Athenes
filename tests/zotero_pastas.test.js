// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { espelharColecoesNasPastas, ordenarColecoes, pastasDoItemZotero, artigoEstaNaPasta, caminhoDaPasta, pastasDoNivel, remapearPastasDosArtigos } from '../src/core/athenes_zotero_pastas.js';
import {mesclarPerfil} from '../src/core/athenes_perfil_servidor.js';

const raiz = () => [{ id: 'pasta_bib_raiz', nome: 'Bibliografia & Leituras', tipo: 'bibliografia', origem: 'minhas', subpastas: [] }];
const colecoes = [
  { key: 'B', nome: 'Acústica', parentCollection: 'A' },
  { key: 'A', nome: 'Arquitetura', parentCollection: false },
  { key: 'C', nome: 'Urbanismo', parentCollection: false }
];
test('subcoleções existentes mudam de pai sem trocar id, arquivos ou filhos locais',()=>{
 const initial=espelharColecoesNasPastas(raiz(),colecoes,{agora:'2026-01-01'});
 const arq=initial.pastas[0].subpastas.find(p=>p.zoteroKey==='A'),filho=arq.subpastas[0];
 filho.driveId='drive-preservado';filho.subpastas.push({id:'manual',nome:'Minhas notas',subpastas:[]});
 const moved=espelharColecoesNasPastas(initial.pastas,colecoes.map(c=>c.key==='B'?{...c,parentCollection:'C'}:c),{agora:'2026-02-01'});
 const urbano=moved.pastas[0].subpastas.find(p=>p.zoteroKey==='C');
 assert.equal(moved.movidas,1);assert.equal(moved.criadas,0);assert.equal(urbano.subpastas[0].id,filho.id);
 assert.equal(urbano.subpastas[0].driveId,'drive-preservado');assert.equal(urbano.subpastas[0].subpastas[0].id,'manual');
 assert.equal(moved.pastas[0].subpastas.find(p=>p.zoteroKey==='A').subpastas.length,0);
 assert.equal(espelharColecoesNasPastas(moved.pastas,colecoes.map(c=>c.key==='B'?{...c,parentCollection:'C'}:c)).mudou,false);
});
test('perfil antigo não desfaz a nova hierarquia nem duplica coleções entre computadores',()=>{
 const old=espelharColecoesNasPastas(raiz(),colecoes,{agora:'2026-01-01'}).pastas;
 const nested=espelharColecoesNasPastas(old,colecoes.map(c=>c.key==='C'?{...c,parentCollection:'B'}:c),{agora:'2026-02-01'}).pastas;
 const local={pastas:nested,documentos:[]},server={pastas:old,documentos:[]};
 const merged=mesclarPerfil(server,local);const all=[];const walk=ps=>ps.forEach(p=>{all.push(p);walk(p.subpastas||[])});walk(merged.pastas);
 assert.equal(all.filter(p=>p.zoteroKey==='C').length,1);assert.equal(all.find(p=>p.zoteroKey==='C').parentId,'zot_col_B');
 const stale=mesclarPerfil(merged.indice,{pastas:old,documentos:[]});const a=stale.pastas[0].subpastas.find(p=>p.zoteroKey==='A');
 assert.equal(a.subpastas[0].subpastas[0].zoteroKey,'C');
 assert.equal(mesclarPerfil(merged.indice,{pastas:merged.pastas,documentos:[]}).mudouServidor,false);
});
test('hierarquia sincronizada não ressuscita uma coleção excluída',()=>{
 const old=espelharColecoesNasPastas(raiz(),colecoes,{agora:'2026-01-01'}).pastas;
 const merged=mesclarPerfil({pastas:old,documentos:[],pastasExcluidas:{zot_col_A:'2026-02-01'}},{pastas:old,documentos:[]});
 assert.ok(!JSON.stringify(merged.pastas).includes('zot_col_A'));assert.ok(!JSON.stringify(merged.pastas).includes('zot_col_B'));
});
test('pasta manual com mesmo nome não absorve a identidade de uma coleção Zotero',()=>{
 const manual=raiz();manual[0].subpastas.push({id:'minha_pesquisa',nome:'Arquitetura',tipo:'bibliografia',subpastas:[]});
 const synced=espelharColecoesNasPastas(manual,colecoes,{agora:'2026-02-01'}).pastas;
 const result=mesclarPerfil({pastas:manual,documentos:[]},{pastas:synced,documentos:[]});
 const children=result.pastas[0].subpastas;
 assert.ok(children.some(p=>p.id==='minha_pesquisa'&&!p.zoteroKey));
 assert.ok(children.some(p=>p.zoteroKey==='A'&&p.subpastas[0]?.zoteroKey==='B'));
});
test('renomear numa árvore antiga não desfaz uma mudança de pai mais recente',()=>{
 const old=espelharColecoesNasPastas(raiz(),colecoes,{agora:'2026-01-01'}).pastas;
 const moved=espelharColecoesNasPastas(old,colecoes.map(c=>c.key==='B'?{...c,parentCollection:'C'}:c),{agora:'2026-02-01'}).pastas;
 for(const legacy of [false,true]){
  const stale=structuredClone(old);if(legacy)for(const p of [stale[0].subpastas[0],stale[0].subpastas[0].subpastas[0]]){delete p.zoteroEstruturaEm;delete p.zoteroNomeEm;delete p.parentId;}
  const renamed=espelharColecoesNasPastas(stale,colecoes.map(c=>c.key==='B'?{...c,nome:'Acústica revisada'}:c),{agora:'2026-03-01'}).pastas;
  const result=mesclarPerfil({pastas:moved,documentos:[]},{pastas:renamed,documentos:[]});
  const urban=result.pastas[0].subpastas.find(p=>p.zoteroKey==='C');
  assert.equal(urban.subpastas[0].zoteroKey,'B');assert.equal(urban.subpastas[0].nome,'Acústica revisada');
 }
});
test('todas as referências acompanham aliases de pastas, inclusive as ausentes da resposta atual',()=>{
 const records=[{id:'fora_da_resposta',pastaId:'velha',pastasIds:['velha','meio','outra']},{id:'shared',compartilhadoComigo:true,pastaId:'velha'}];
 assert.equal(remapearPastasDosArtigos(records,{velha:'meio',meio:'nova'}),true);
 assert.equal(records[0].pastaId,'nova');assert.deepEqual(records[0].pastasIds,['nova','outra']);assert.equal(records[1].pastaId,'velha');
 assert.equal(remapearPastasDosArtigos(records,{velha:'meio',meio:'nova'}),false);
});
test('sincronizar nomes iguais preserva a data da renomeação mais recente',()=>{
 const initial=espelharColecoesNasPastas(raiz(),colecoes,{agora:'2026-01-01'}).pastas;
 const renamed=espelharColecoesNasPastas(initial,colecoes.map(c=>c.key==='B'?{...c,nome:'Nome temporário'}:c),{agora:'2026-02-01'}).pastas;
 const restored=espelharColecoesNasPastas(renamed,colecoes,{agora:'2026-03-01'}).pastas;
 const merged=mesclarPerfil({pastas:initial,documentos:[]},{pastas:restored,documentos:[]});
 const later=mesclarPerfil(merged.indice,{pastas:renamed,documentos:[]});
 assert.equal(later.pastas[0].subpastas.find(p=>p.zoteroKey==='A').subpastas[0].nome,'Acústica');
});
test('caminho completo e faixa por nível não apresentam subpastas como raízes',()=>{
 const all=[{id:'root',nome:'Raiz'},{id:'a',nome:'Mãe',parentId:'root'},{id:'b',nome:'Filha',parentId:'a'},{id:'c',nome:'Neta',parentId:'b'}];
 assert.deepEqual(caminhoDaPasta(all,'c').map(p=>p.id),['root','a','b','c']);
 assert.deepEqual(pastasDoNivel(all,'a').map(p=>p.id),['a','b']);
 assert.deepEqual(pastasDoNivel(all,'b').map(p=>p.id),['b','c']);
});

test('coleções do Zotero viram pastas com os mesmos nomes e a mesma hierarquia', () => {
  const { pastas, mapa, criadas } = espelharColecoesNasPastas(raiz(), colecoes);
  assert.equal(criadas, 3);
  const r = pastas[0];
  assert.deepEqual(r.subpastas.map(p => p.nome), ['Arquitetura', 'Urbanismo']);
  const arq = r.subpastas[0];
  assert.deepEqual(arq.subpastas.map(p => p.nome), ['Acústica']);
  assert.equal(arq.subpastas[0].parentId, arq.id);
  assert.equal(mapa.get('B'), arq.subpastas[0].id);
  assert.ok(arq.origemZotero && arq.zoteroKey === 'A' && arq.tipo === 'bibliografia');
});

test('sincronizar de novo não duplica pastas e acompanha renomeações; nada é apagado', () => {
  const a = espelharColecoesNasPastas(raiz(), colecoes);
  const b = espelharColecoesNasPastas(a.pastas, colecoes.map(c => c.key === 'C' ? { ...c, nome: 'Cidades' } : c));
  assert.equal(b.criadas, 0);
  assert.equal(b.renomeadas, 1);
  assert.deepEqual(b.pastas[0].subpastas.map(p => p.nome), ['Arquitetura', 'Urbanismo'.replace('Urbanismo', 'Cidades')]);
  const c = espelharColecoesNasPastas(b.pastas, [colecoes[1]]); // as outras sumiram do Zotero
  assert.equal(c.pastas[0].subpastas.length, 2);
});

test('coleção-mãe desconhecida vira pasta na raiz e a ordem é do pai para o filho', () => {
  const ord = ordenarColecoes([{ key: 'X', nome: 'Filho', parentCollection: 'P' }, { key: 'Y', nome: 'Órfã', parentCollection: 'nao-existe' }]);
  assert.deepEqual(ord.map(c => c.key).sort(), ['X', 'Y']);
  assert.equal(ord.find(c => c.key === 'Y').parentCollection, false);
});

test('um item em várias coleções aparece em todas as pastas; sem coleção, na raiz', () => {
  const { mapa } = espelharColecoesNasPastas(raiz(), colecoes);
  const ids = pastasDoItemZotero(['A', 'C'], mapa);
  assert.equal(ids.length, 2);
  const art = { pastaId: ids[0], pastasIds: ids };
  assert.ok(ids.every(id => artigoEstaNaPasta(art, id)));
  assert.equal(artigoEstaNaPasta(art, 'pasta_bib_raiz'), false);
  assert.deepEqual(pastasDoItemZotero([], mapa), ['pasta_bib_raiz']);
  assert.ok(artigoEstaNaPasta({}, 'pasta_bib_raiz'), 'artigo antigo, sem lista, vale pelo pastaId (ou raiz)');
});
