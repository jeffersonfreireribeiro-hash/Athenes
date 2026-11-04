package com.athenes

import com.athenes.core.data.PastasDocumento
import com.athenes.core.model.PastaDocumento
import org.junit.Assert.assertEquals
import org.junit.Test

class PastasDocumentoTest {
    @Test
    fun `pastas profundas mantem caminho e niveis`() {
        val pastas = listOf(
            PastaDocumento("neta", "2026", "filha"),
            PastaDocumento("filha", "Artigos", "pai"),
            PastaDocumento("pai", "Pesquisa"),
            PastaDocumento("outra", "Relatórios")
        )
        val arvore = PastasDocumento.organizar(pastas)
        assertEquals(listOf("Pesquisa", "Pesquisa / Artigos", "Pesquisa / Artigos / 2026", "Relatórios"), arvore.map { it.caminho })
        assertEquals(listOf(0, 1, 2, 0), arvore.map { it.nivel })
    }
}
