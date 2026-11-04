package com.athenes.core.data

import org.json.JSONArray
import org.json.JSONObject

object ZoteroCacheCodec {
    fun escrever(itens: List<ZoteroItem>, colecoes: List<ZoteroColecao>): String = JSONObject().apply {
        put("itens", JSONArray().apply {
            itens.forEach { item -> put(JSONObject().apply {
                put("chave", item.chave)
                put("tipo", item.tipo)
                put("titulo", item.titulo)
                put("data", item.data)
                put("resumo", item.resumo)
                put("doi", item.doi)
                put("autores", JSONArray().apply {
                    item.autores.forEach { autor -> put(JSONObject()
                        .put("funcao", autor.funcao)
                        .put("nome", autor.nome)
                        .put("sobrenome", autor.sobrenome)) }
                })
                put("tags", JSONArray(item.tags))
                put("colecoes", JSONArray(item.colecoes))
                put("campos", JSONObject(item.campos))
            }) }
        })
        put("colecoes", JSONArray().apply {
            colecoes.forEach { colecao -> put(JSONObject()
                .put("chave", colecao.chave)
                .put("nome", colecao.nome)
                .put("pai", colecao.pai ?: "")) }
        })
    }.toString()

    fun ler(json: String): Pair<List<ZoteroItem>, List<ZoteroColecao>> {
        val raiz = JSONObject(json)
        val itens = raiz.getJSONArray("itens").let { lista -> (0 until lista.length()).map { indice ->
            val item = lista.getJSONObject(indice)
            val autores = item.getJSONArray("autores")
            val campos = item.getJSONObject("campos")
            ZoteroItem(
                chave = item.getString("chave"),
                tipo = item.getString("tipo"),
                titulo = item.getString("titulo"),
                autores = (0 until autores.length()).map { posicao ->
                    val autor = autores.getJSONObject(posicao)
                    ZoteroCriador(autor.getString("funcao"), autor.getString("nome"), autor.getString("sobrenome"))
                },
                data = item.getString("data"),
                resumo = item.getString("resumo"),
                doi = item.getString("doi"),
                tags = item.getJSONArray("tags").let { array -> (0 until array.length()).map(array::getString) },
                colecoes = item.getJSONArray("colecoes").let { array -> (0 until array.length()).map(array::getString) },
                campos = campos.keys().asSequence().associateWith(campos::getString)
            )
        } }
        val colecoes = raiz.getJSONArray("colecoes").let { lista -> (0 until lista.length()).map { indice ->
            val item = lista.getJSONObject(indice)
            ZoteroColecao(item.getString("chave"), item.getString("nome"), item.optString("pai").ifBlank { null })
        } }
        return itens to colecoes
    }
}
