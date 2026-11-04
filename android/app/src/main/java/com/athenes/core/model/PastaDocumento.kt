package com.athenes.core.model

data class PastaDocumento(
    val id: String,
    val nome: String,
    val pastaPaiId: String? = null
)
