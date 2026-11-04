package com.athenes

import com.athenes.core.data.ZoteroColecao
import com.athenes.core.data.ZoteroColecoes
import org.junit.Assert.assertEquals
import org.junit.Test

class ZoteroColecoesTest {
    @Test
    fun `colecoes aparecem com as maes antes das filhas e caminho completo`() {
        val lista = listOf(
            ZoteroColecao("filha", "Artigos", "pai"),
            ZoteroColecao("neta", "2026", "filha"),
            ZoteroColecao("pai", "Pesquisa", null),
            ZoteroColecao("orfã", "Outros", "ausente")
        )
        val arvore = ZoteroColecoes.organizar(lista)
        assertEquals(listOf("Outros", "Pesquisa", "Pesquisa / Artigos", "Pesquisa / Artigos / 2026"), arvore.map { it.caminho })
        assertEquals(listOf(0, 0, 1, 2), arvore.map { it.nivel })
    }

    @Test
    fun `ciclo de colecoes nao trava a ordenacao`() {
        val arvore = ZoteroColecoes.organizar(listOf(ZoteroColecao("a", "A", "b"), ZoteroColecao("b", "B", "a")))
        assertEquals(2, arvore.size)
        assertEquals(setOf("a", "b"), arvore.map { it.colecao.chave }.toSet())
    }
}
