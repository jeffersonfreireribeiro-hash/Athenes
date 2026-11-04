// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Coleções do Zotero como pastas de bibliografia (mesmos nomes e a mesma hierarquia). Funções puras: recebem a árvore de
 * pastas e a lista de coleções e devolvem a árvore nova e o mapa chave-da-coleção → id-da-pasta.
 */
export const RAIZ_BIBLIOGRAFIA = 'pasta_bib_raiz';

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
export function espelharColecoesNasPastas(pastas, colecoes) {
  const arvore = copiar(pastas || []);
  let raiz = acharNaArvore(arvore, p => p.id === RAIZ_BIBLIOGRAFIA);
  if (!raiz) { raiz = { id: RAIZ_BIBLIOGRAFIA, nome: 'Bibliografia & Leituras', tipo: 'bibliografia', origem: 'minhas', icone: 'livro', subpastas: [] }; arvore.push(raiz); }
  const mapa = new Map();
  let criadas = 0; let renomeadas = 0;
  for (const c of ordenarColecoes(colecoes)) {
    const nome = String(c.nome || 'Coleção sem nome').trim();
    let pasta = acharNaArvore(arvore, p => p.zoteroKey === c.key);
    if (pasta) {
      if (pasta.nome !== nome) { pasta.nome = nome; renomeadas++; }
    } else {
      const mae = c.parentCollection ? acharNaArvore(arvore, p => p.id === mapa.get(c.parentCollection)) : raiz;
      const pai = mae || raiz;
      pasta = { id: `zot_col_${c.key}`, nome, tipo: 'bibliografia', origem: 'minhas', origemZotero: true, zoteroKey: c.key, parentId: pai.id, subpastas: [] };
      (pai.subpastas ||= []).push(pasta);
      criadas++;
    }
    mapa.set(c.key, pasta.id);
  }
  return { pastas: arvore, mapa, criadas, renomeadas };
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
