import test from 'node:test';import assert from 'node:assert/strict';import {criarFilaSalvamento} from '../src/core/athenes_fila_salvamento.js';
test('salvamentos do mesmo documento não terminam fora de ordem',async()=>{
 const queue=criarFilaSalvamento(),events=[];let release;const gate=new Promise(r=>release=r),first=queue.executar('a',async()=>{events.push('old-start');await gate;events.push('old-end');}),second=queue.executar('a',async()=>events.push('new-end'));
 await queue.executar('b',async()=>events.push('other-document'));assert.deepEqual(events,['old-start','other-document']);release();await Promise.all([first,second]);assert.deepEqual(events,['old-start','other-document','old-end','new-end']);
});
test('erro de um envio não impede salvar a próxima versão',async()=>{
 const queue=criarFilaSalvamento();await assert.rejects(queue.executar('a',()=>Promise.reject(Error('offline'))));assert.equal(await queue.executar('a',()=>42),42);
});
