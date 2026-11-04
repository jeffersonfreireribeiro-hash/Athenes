package com.athenes.core.citacao

import org.json.JSONArray
import org.json.JSONObject

object BibliografiaCodec {
    fun escrever(refs: List<ReferenciaAcademica>): JSONArray = JSONArray().apply {
        refs.forEach { ref -> put(JSONObject().apply {
            put("id", ref.id); put("tipo", ref.tipo); put("titulo", ref.titulo); put("ano", ref.ano)
            put("publicacao", ref.publicacao); put("editora", ref.editora); put("local", ref.local)
            put("volume", ref.volume); put("numero", ref.numero); put("paginas", ref.paginas)
            put("doi", ref.doi); put("url", ref.url)
            put("palavrasChave", JSONArray(ref.palavrasChave))
            put("autores", JSONArray().apply { ref.autores.forEach { autor -> put(JSONObject().apply {
                put("sobrenome", autor.sobrenome); put("prenome", autor.prenome)
            }) } })
        }) }
    }

    fun ler(array: JSONArray?): List<ReferenciaAcademica> = if (array == null) emptyList() else (0 until array.length()).mapNotNull { i ->
        val o = array.optJSONObject(i) ?: return@mapNotNull null
        val id = o.optString("id").takeIf(String::isNotBlank) ?: return@mapNotNull null
        val autores = o.optJSONArray("autores")?.let { a -> (0 until a.length()).mapNotNull { j ->
            a.optJSONObject(j)?.let { AutorReferencia(it.optString("sobrenome"), it.optString("prenome")) }
        } }.orEmpty()
        val tags = o.optJSONArray("palavrasChave")?.let { a -> (0 until a.length()).mapNotNull { a.optString(it).takeIf(String::isNotBlank) } }.orEmpty()
        ReferenciaAcademica(id, o.optString("tipo"), o.optString("titulo"), autores, o.optString("ano"),
            o.optString("publicacao"), o.optString("editora"), o.optString("local"), o.optString("volume"),
            o.optString("numero"), o.optString("paginas"), o.optString("doi"), o.optString("url"), tags)
    }

    fun escreverCitacoes(citacoes: List<CitacaoInline>): JSONArray = JSONArray().apply {
        citacoes.forEach { c -> put(JSONObject().apply {
            put("refId", c.refId); put("inicio", c.inicio); put("fim", c.fim)
            put("pagina", c.pagina); put("narrativa", c.narrativa)
        }) }
    }

    fun lerCitacoes(array: JSONArray?, texto: String): List<CitacaoInline> = if (array == null) emptyList() else (0 until array.length()).mapNotNull { i ->
        val o = array.optJSONObject(i) ?: return@mapNotNull null
        val c = CitacaoInline(o.optString("refId"), o.optInt("inicio", -1), o.optInt("fim", -1),
            o.optString("pagina"), o.optBoolean("narrativa"))
        c.takeIf { it.refId.isNotBlank() && it.inicio >= 0 && it.fim > it.inicio && it.fim <= texto.length }
    }
}
