package com.athenes.core.model

enum class SituacaoDocumento(val rotuloAmigavel: String, val badge: String) {
    RASCUNHO("Rascunho", "RASCUNHO"),
    EM_REVISAO("Em Revisão", "EM REVISÃO"),
    FINALIZADO("Finalizado", "FINALIZADO");

    companion object {
        fun deString(valor: String?): SituacaoDocumento {
            return entries.firstOrNull { 
                it.name.equals(valor, ignoreCase = true) || 
                it.badge.equals(valor, ignoreCase = true) ||
                it.rotuloAmigavel.equals(valor, ignoreCase = true)
            } ?: RASCUNHO
        }
    }
}
