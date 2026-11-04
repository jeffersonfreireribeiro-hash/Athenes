package com.athenes

import com.athenes.core.data.OrdemDocumentos
import com.athenes.core.data.OrdenacaoDocumentos
import com.athenes.core.model.Documento
import com.athenes.core.model.TipoDocumento
import org.junit.Assert.assertEquals
import org.junit.Test

class OrdenacaoDocumentosTest {
    @Test
    fun `ordena por data titulo e tipo`() {
        val docs = listOf(
            Documento(titulo = "Zeta", tipo = TipoDocumento.RELATORIO, modificadoEm = "03/01/2025"),
            Documento(titulo = "Alfa", tipo = TipoDocumento.ARTIGO, modificadoEm = "Hoje"),
            Documento(titulo = "Beta", tipo = TipoDocumento.ARTIGO, modificadoEm = "02/01/2025")
        )
        assertEquals(listOf("Alfa", "Zeta", "Beta"), OrdenacaoDocumentos.ordenar(docs, OrdemDocumentos.RECENTES).map { it.titulo })
        assertEquals(listOf("Alfa", "Beta", "Zeta"), OrdenacaoDocumentos.ordenar(docs, OrdemDocumentos.TITULO).map { it.titulo })
        assertEquals(listOf("Alfa", "Beta", "Zeta"), OrdenacaoDocumentos.ordenar(docs, OrdemDocumentos.TIPO).map { it.titulo })
    }
}
