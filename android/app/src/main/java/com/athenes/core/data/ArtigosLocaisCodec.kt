package com.athenes.core.data

import com.athenes.core.model.ArtigoEstudoDetalhado
import org.json.JSONArray
import org.json.JSONObject

/** Metadados dos artigos criados no aparelho; anotações e PDF usam seus armazenamentos próprios. */
object ArtigosLocaisCodec {
    fun escrever(artigos: List<ArtigoEstudoDetalhado>): String = JSONArray().apply {
        artigos.forEach { artigo -> put(JSONObject().apply {
            put("id", artigo.id)
            put("titulo", artigo.titulo)
            put("autores", artigo.autores)
            put("ano", artigo.ano)
            put("resumoOficial", artigo.resumoOficial)
            put("meuResumo", artigo.meuResumo)
            put("analiseMetodologica", artigo.analiseMetodologica)
            put("publicacao", artigo.camposZotero["publicationTitle"].orEmpty())
            put("tags", JSONArray(artigo.tags))
        }) }
    }.toString()

    fun ler(json: String): List<ArtigoEstudoDetalhado> {
        val array = JSONArray(json)
        require(array.length() <= 20_000) { "Biblioteca local grande demais." }
        return (0 until array.length()).mapNotNull { indice ->
            val item = array.optJSONObject(indice) ?: return@mapNotNull null
            val id = item.optString("id")
            val titulo = item.optString("titulo").trim()
            if (!id.startsWith("local_") || titulo.isEmpty()) return@mapNotNull null
            val tags = item.optJSONArray("tags")?.let { a ->
                (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) }
            }.orEmpty()
            ArtigoEstudoDetalhado(
                id = id, titulo = titulo, autores = item.optString("autores"),
                ano = item.optInt("ano"), chaveZotero = "", totalPaginas = 0,
                resumoOficial = item.optString("resumoOficial"),
                meuResumo = item.optString("meuResumo"),
                analiseMetodologica = item.optString("analiseMetodologica"),
                tags = tags, tipoZotero = "journalArticle",
                camposZotero = mapOf("publicationTitle" to item.optString("publicacao"))
            )
        }
    }
}
