package com.athenes.core.model

import java.util.UUID

data class Documento(
    val id: String = UUID.randomUUID().toString(),
    val titulo: String,
    val subtitulo: String = "",
    val tipo: TipoDocumento = TipoDocumento.DOCUMENTO,
    val situacao: SituacaoDocumento = SituacaoDocumento.RASCUNHO,
    val estadoNuvem: EstadoNuvem = EstadoNuvem.LOCAL,
    val autor: String = "Autor Principal",
    val ano: Int = 2026,
    val resumo: String = "",
    val modificadoEm: String = "01/11/2026",
    val disponivelOffline: Boolean = true,
    val caminhoPdfVinculado: String? = null,
    val conteudoJson: String = "{}"
)
