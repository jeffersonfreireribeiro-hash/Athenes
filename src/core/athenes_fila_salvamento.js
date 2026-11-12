// SPDX-License-Identifier: GPL-3.0-or-later
/** Keep full-document writes in order, while allowing different documents to save independently. */
export function criarFilaSalvamento(){
 const tails=new Map();
 return {executar(id,operation){const result=(tails.get(id)||Promise.resolve()).then(operation),settled=result.then(()=>undefined,()=>undefined);tails.set(id,settled);settled.then(()=>{if(tails.get(id)===settled)tails.delete(id);});return result;}};
}
