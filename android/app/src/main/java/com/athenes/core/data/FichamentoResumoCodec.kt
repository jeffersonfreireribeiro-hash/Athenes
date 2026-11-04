package com.athenes.core.data

import org.json.JSONObject

data class ResumoFichamento(val meuResumo: String, val analiseMetodologica: String)

/** Campos próprios do fichamento, independentes dos metadados que chegam do Zotero. */
object FichamentoResumoCodec {
    fun escrever(resumo: ResumoFichamento): String = JSONObject().apply {
        put("meuResumo", resumo.meuResumo)
        put("analiseMetodologica", resumo.analiseMetodologica)
    }.toString()

    fun ler(json: String?): ResumoFichamento? = json?.let {
        runCatching { JSONObject(it).let { o ->
            ResumoFichamento(o.optString("meuResumo"), o.optString("analiseMetodologica"))
        } }.getOrNull()
    }
}
