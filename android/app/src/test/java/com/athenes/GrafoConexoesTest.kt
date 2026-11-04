package com.athenes

import com.athenes.core.citacao.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GrafoConexoesTest {
    @Test fun `conecta obras por autor tema ano e coautoria sem duplicar arestas`() {
        val a = AutorReferencia("Silva", "Ana")
        val b = AutorReferencia("Costa", "Bruno")
        val refs = listOf(
            ReferenciaAcademica("1", "journalArticle", "Primeira obra", listOf(a, b), "2025", "Revista", local = "Fortaleza", palavrasChave = listOf("Pesquisa")),
            ReferenciaAcademica("2", "book", "Segunda obra", listOf(a, b), "2025", palavrasChave = listOf("Pesquisa"))
        )
        val grafo = GrafoConexoes.construir(refs)
        assertEquals(2, grafo.totalReferencias)
        assertEquals(1, grafo.arestas.count { it.tipo == "coautoria" })
        assertEquals(1, grafo.nos.count { it.tipo == TipoNoConexao.TEMA && it.rotulo == "Pesquisa" })
        assertEquals(1, grafo.nos.count { it.tipo == TipoNoConexao.ANO && it.rotulo == "2025" })
        assertEquals(1, grafo.dadosAusentes)
        assertTrue(grafo.indiceCompletude in 1..99)
    }

    @Test fun `dados ausentes sao explicitados e grafo vazio e completo`() {
        assertEquals(100, GrafoConexoes.construir(emptyList()).indiceCompletude)
        val grafo = GrafoConexoes.construir(listOf(ReferenciaAcademica("sem", "book", "Sem dados", emptyList(), "")))
        assertEquals(4, grafo.dadosAusentes)
        assertEquals(4, grafo.arestas.size)
    }

    @Test fun `palavras chave persistem no documento`() {
        val ref = ReferenciaAcademica("1", "book", "Livro", emptyList(), "2025", palavrasChave = listOf("Tema"))
        assertEquals(listOf(ref), BibliografiaCodec.ler(BibliografiaCodec.escrever(listOf(ref))))
    }
}
