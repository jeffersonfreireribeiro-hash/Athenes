// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Coleções do Zotero como pastas de bibliografia (mesmos nomes e a mesma hierarquia). Funções puras: recebem a árvore de
 * pastas e a lista de coleções e devolvem a árvore nova e o mapa chave-da-coleção → id-da-pasta.
 */
export const RAIZ_BIBLIOGRAFIA = 'pasta_bib_raiz';

export function caminhoDaPasta(pastas,id){
  const mapa=new Map(pastas.map(p=>[p.id,p])),caminho=[],vistos=new Set();let atual=mapa.get(id);
  while(atual&&!vistos.has(atual.id)){vistos.add(atual.id);caminho.unshift(atual);atual=mapa.get(atual.parentId);}
  return caminho;
}
export function pastasDoNivel(pastas,id='todas'){
  const raiz=pastas.find(p=>p.id===RAIZ_BIBLIOGRAFIA),atual=pastas.find(p=>p.id===id);
  if(!atual)return pastas.filter(p=>!p.parentId||p.parentId===raiz?.id);
  const filhas=pastas.filter(p=>p.parentId===id);
  return filhas.length?[atual,...filhas]:pastas.filter(p=>p.parentId===atual.parentId);
}

const copiar = (x) => JSON.parse(JSON.stringify(x));

function acharNaArvore(lista, teste) {
  for (const p of lista || []) {
    if (teste(p)) return p;
    const f = acharNaArvore(p.subpastas, teste);
    if (f) return f;
  }
  return null;
}

/** Coleções do pai para os filhos (uma coleção só aparece depois do seu pai; pai desconhecido vira raiz). */
export function ordenarColecoes(colecoes) {
  const lista = (colecoes || []).filter(c => c?.key);
  const chaves = new Set(lista.map(c => c.key));
  const filhosDe = new Map();
  for (const c of lista) {
    const pai = c.parentCollection && chaves.has(c.parentCollection) ? c.parentCollection : '';
    if (!filhosDe.has(pai)) filhosDe.set(pai, []);
    filhosDe.get(pai).push(c);
  }
  const saida = []; const visto = new Set();
  const visitar = (pai) => {
    for (const c of (filhosDe.get(pai) || []).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))) {
      if (visto.has(c.key)) continue;
      visto.add(c.key); saida.push({ ...c, parentCollection: pai || false }); visitar(c.key);
    }
  };
  visitar('');
  return saida;
}

/**
 * Cria (ou renomeia) uma pasta de bibliografia para cada coleção do Zotero, sob a raiz "Bibliografia & Leituras", respeitando
 * as coleções-mãe. Não apaga nada: coleção que sumiu do Zotero deixa a pasta como está.
 * Devolve { pastas, mapa: Map(chave → id da pasta), criadas, renomeadas }.
 */
// Extract the newest known Zotero hierarchy before merging local/server trees.
export function colecoesMaisRecentes(...arvores) {
  const mapa = new Map();
  const visitar = (lista, pai) => { for (const p of lista || []) {
    if (p.zoteroKey) {
      const c = { key:p.zoteroKey, nome:p.nome, parentCollection:p.zoteroParentKey ?? pai?.zoteroKey ?? false, estruturaEm:p.zoteroEstruturaEm || '' };
      if (!mapa.has(c.key) || c.estruturaEm > mapa.get(c.key).estruturaEm) mapa.set(c.key,c);
    }
    visitar(p.subpastas,p);
  }};
  arvores.forEach(a=>visitar(a,null));return [...mapa.values()];
}

function retirarColecao(lista,key,paiId='',encontradas=[]) {
  for(let i=lista.length-1;i>=0;i--){const p=lista[i];
    if(p.zoteroKey===key){encontradas.unshift({pasta:p,paiId});lista.splice(i,1);}
    else retirarColecao(p.subpastas||[],key,p.id,encontradas);
  }
  return encontradas;
}
function unirFilhas(base,extra){
  for(const p of extra||[]){const igual=base.find(q=>q.id===p.id);if(!igual)base.push(p);else unirFilhas(igual.subpastas||=([]),p.subpastas);}
}
export function espelharColecoesNasPastas(pastas, colecoes, {agora=new Date().toISOString()}={}) {
  const arvore = copiar(pastas || []);
  let raiz = acharNaArvore(arvore, p => p.id === RAIZ_BIBLIOGRAFIA);
  if (!raiz) { raiz = { id: RAIZ_BIBLIOGRAFIA, nome: 'Bibliografia & Leituras', tipo: 'bibliografia', origem: 'minhas', icone: 'livro', subpastas: [] }; arvore.push(raiz); }
  const mapa = new Map(),idsUnificados={};let criadas=0,renomeadas=0,movidas=0;
  for (const c of ordenarColecoes(colecoes)) {
    const nome=String(c.nome||'Coleção sem nome').trim();
    const existentes=retirarColecao(arvore,c.key);
    const pai=(c.parentCollection?acharNaArvore(arvore,p=>p.id===mapa.get(c.parentCollection)):raiz)||raiz;
    let pasta=existentes[0]?.pasta,alterada=false;
    if(!pasta){pasta={id:`zot_col_${c.key}`,nome,tipo:'bibliografia',origem:'minhas',origemZotero:true,zoteroKey:c.key,subpastas:[]};criadas++;alterada=true;}
    else {
      if(pasta.nome!==nome){pasta.nome=nome;renomeadas++;alterada=true;}
      if(existentes[0].paiId!==pai.id||pasta.parentId!==pai.id){movidas++;alterada=true;}
      for(const outra of existentes.slice(1)){if(outra.pasta.id!==pasta.id)idsUnificados[outra.pasta.id]=pasta.id;unirFilhas(pasta.subpastas||=([]),outra.pasta.subpastas);if(!pasta.driveId&&outra.pasta.driveId)pasta.driveId=outra.pasta.driveId;}
    }
    pasta.parentId=pai.id;pasta.zoteroParentKey=c.parentCollection||false;
    if(alterada||!pasta.zoteroEstruturaEm)pasta.zoteroEstruturaEm=c.estruturaEm||agora;
    (pai.subpastas||=[]).push(pasta);mapa.set(c.key,pasta.id);
  }
  return {pastas:arvore,mapa,criadas,renomeadas,movidas,idsUnificados,mudou:JSON.stringify(arvore)!==JSON.stringify(pastas||[])};
}

/** Ids das pastas de um item (uma por coleção do Zotero a que ele pertence; sem coleção, a raiz). */
export function pastasDoItemZotero(colecoesDoItem, mapa) {
  const ids = [...new Set((colecoesDoItem || []).map(k => mapa?.get(k)).filter(Boolean))];
  return ids.length ? ids : [RAIZ_BIBLIOGRAFIA];
}

/** O artigo está nesta pasta? (um item do Zotero pode estar em várias coleções.) */
export function artigoEstaNaPasta(art, pastaId) {
  const ids = Array.isArray(art?.pastasIds) && art.pastasIds.length ? art.pastasIds : [art?.pastaId || RAIZ_BIBLIOGRAFIA];
  return ids.includes(pastaId);
}
