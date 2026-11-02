package com.athenes.core.model

enum class EstadoNuvem(val rotuloAmigavel: String, val badge: String) {
    LOCAL("Local", "LOCAL"),
    NUVEM_SUPABASE("Nuvem Supabase", "NUVEM"),
    SINCRONIZANDO("Sincronizando...", "SYNC"),
    ERRO("Erro ao Sincronizar", "ERRO");

    companion object {
        fun deString(valor: String?): EstadoNuvem {
            return entries.firstOrNull { 
                it.name.equals(valor, ignoreCase = true) || 
                it.badge.equals(valor, ignoreCase = true) 
            } ?: LOCAL
        }
    }
}
