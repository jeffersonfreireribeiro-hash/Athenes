package com.athenes.core.model

enum class TipoDocumento(val rotuloAmigavel: String, val badge: String) {
    DOCUMENTO("Documento", "DOCUMENTO"),
    ARTIGO("Artigo Científico", "ARTIGO"),
    RELATORIO("Relatório Técnico", "RELATÓRIO"),
    MONOGRAFIA("Monografia / Tese", "MONOGRAFIA"),
    LIVRO("Livro / Capítulo", "LIVRO"),
    PROJETO("Projeto de Pesquisa", "PROJETO");

    companion object {
        fun deString(valor: String?): TipoDocumento {
            return entries.firstOrNull { 
                it.name.equals(valor, ignoreCase = true) || 
                it.badge.equals(valor, ignoreCase = true) ||
                it.rotuloAmigavel.equals(valor, ignoreCase = true)
            } ?: DOCUMENTO
        }
    }
}
