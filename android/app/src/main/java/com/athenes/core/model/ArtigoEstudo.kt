package com.athenes.core.model

import java.util.UUID

data class ArtigoEstudo(
    val id: String = UUID.randomUUID().toString(),
    val titulo: String,
    val autores: String = "",
    val ano: Int = 2026,
    val chaveZotero: String = "",
    val doi: String = "",
    val driveFileId: String = "",
    val driveFileName: String = "",
    val resumoOficial: String = "",
    val meuResumo: String = "",
    val analiseMetodologica: String = "",
    val qtdCitacoes: Int = 0,
    val qtdNotas: Int = 0,
    val qtdGrifos: Int = 0,
    val totalPaginas: Int = 1
)
