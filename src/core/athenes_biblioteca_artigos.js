// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Biblioteca de artigos (leitura, fichamentos, notas, destaques) com o servidor como fonte da verdade.
 *
 * Antes ficava só no navegador de cada computador. Agora vive na MEMÓRIA da sessão e é sincronizada com o servidor; os PDFs
 * ficam no Google Drive. Detalhes da sincronização em `athenes_lista_sincronizada.js`.
 */
import { criarListaSincronizada, mesclarLista } from './athenes_lista_sincronizada.js';

export const CHAVE_BIBLIOTECA = 'biblioteca_artigos';

const lista = criarListaSincronizada({
  chave: CHAVE_BIBLIOTECA,
  legados: ['athenes_estudo_artigos_v1', 'athenes_artigos_estudo', 'athenes_estudo_artigos'],
  efemeros: ['pdfBlobUrl']
});

/** Junta a biblioteca do servidor com a local ({ artigos[], excluidos{} }). */
export function mesclarBiblioteca(servidor, local) {
  const r = mesclarLista(servidor && { itens: servidor.artigos, excluidos: servidor.excluidos }, { itens: local.artigos, excluidos: local.excluidos });
  return { valor: { artigos: r.valor.itens, excluidos: r.valor.excluidos }, mudouServidor: r.mudouServidor };
}

/** Registra como reconhecer os artigos de exemplo antigos (fictícios) para não os enviar ao servidor como se fossem reais. */
export const definirFiltroDeExemplos = (fn) => lista.definirFiltroLegado(fn);
export const obterArtigos = () => lista.obter();
export const definirArtigos = (l) => lista.definir(l);
export const aoMudarBiblioteca = (cb) => lista.aoMudar(cb);
export const sincronizarBiblioteca = (opcoes) => lista.sincronizar(opcoes);
export const legadoDaBibliotecaPendente = () => lista.legadoPendente();
export const temEnvioPendente = () => lista.temEnvioPendente();
export const reiniciar = () => lista.reiniciar();
