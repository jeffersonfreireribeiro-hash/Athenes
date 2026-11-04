package com.athenes.core.data

import com.athenes.core.model.Documento
import java.time.LocalDate
import java.time.format.DateTimeFormatter

enum class OrdemDocumentos(val rotulo: String) {
    RECENTES("Recentes"), TITULO("Título"), TIPO("Tipo")
}

object OrdenacaoDocumentos {
    private val formatoData = DateTimeFormatter.ofPattern("dd/MM/uuuu")

    fun ordenar(lista: List<Documento>, ordem: OrdemDocumentos): List<Documento> = when (ordem) {
        OrdemDocumentos.RECENTES -> lista.sortedWith(compareByDescending<Documento> {
            if (it.modificadoEm.equals("Hoje", ignoreCase = true)) LocalDate.MAX
            else runCatching { LocalDate.parse(it.modificadoEm, formatoData) }.getOrDefault(LocalDate.MIN)
        }.thenBy { it.titulo.lowercase() })
        OrdemDocumentos.TITULO -> lista.sortedBy { it.titulo.lowercase() }
        OrdemDocumentos.TIPO -> lista.sortedWith(compareBy<Documento> { it.tipo.rotuloAmigavel }.thenBy { it.titulo.lowercase() })
    }
}
