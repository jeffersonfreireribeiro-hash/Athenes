package com.athenes.core.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class ZoteroCriador(
    val funcao: String,
    val nome: String,
    val sobrenome: String
)

data class ZoteroItem(
    val chave: String,
    val tipo: String,
    val titulo: String,
    val autores: List<ZoteroCriador>,
    val data: String,
    val resumo: String,
    val doi: String,
    val tags: List<String>,
    val colecoes: List<String>,
    val campos: Map<String, String>
)

data class ZoteroColecao(val chave: String, val nome: String, val pai: String?)

class ZoteroApiClient(
    private val requisitar: suspend (url: String, chave: String) -> String = ::requisicaoHttp
) {
    suspend fun descobrirUsuario(chave: String): String {
        require(chave.isNotBlank()) { "Informe a chave do Zotero." }
        val resposta = JSONObject(requisitar("https://api.zotero.org/keys/${codificar(chave)}", chave))
        return resposta.optString("userID").ifBlank { error("O Zotero não informou o ID do usuário.") }
    }

    suspend fun listarItens(usuarioId: String, chave: String): List<ZoteroItem> {
        require(usuarioId.isNotBlank() && chave.isNotBlank()) { "Informe a conta e a chave do Zotero." }
        val resultado = mutableListOf<ZoteroItem>()
        var inicio = 0
        repeat(60) {
            val url = "https://api.zotero.org/users/${codificar(usuarioId)}/items/top?limit=100&start=$inicio&sort=dateModified&direction=desc"
            val pagina = JSONArray(requisitar(url, chave))
            inicio += pagina.length()
            for (indice in 0 until pagina.length()) {
                normalizarItem(pagina.getJSONObject(indice))?.let(resultado::add)
            }
            if (pagina.length() < 100) return resultado
        }
        return resultado
    }

    suspend fun listarColecoes(usuarioId: String, chave: String): List<ZoteroColecao> {
        require(usuarioId.isNotBlank() && chave.isNotBlank()) { "Informe a conta e a chave do Zotero." }
        val resultado = mutableListOf<ZoteroColecao>()
        repeat(20) {
            val url = "https://api.zotero.org/users/${codificar(usuarioId)}/collections?limit=100&start=${resultado.size}"
            val pagina = JSONArray(requisitar(url, chave))
            for (indice in 0 until pagina.length()) {
                val bruto = pagina.getJSONObject(indice)
                val dados = bruto.getJSONObject("data")
                resultado.add(ZoteroColecao(
                    chave = bruto.optString("key", dados.optString("key")),
                    nome = dados.optString("name", "Coleção sem nome"),
                    pai = dados.optString("parentCollection").takeUnless { it.isBlank() || it == "false" }
                ))
            }
            if (pagina.length() < 100) return resultado
        }
        return resultado
    }

    companion object {
        private fun codificar(valor: String): String = URLEncoder.encode(valor.trim(), "UTF-8")

        fun normalizarItem(bruto: JSONObject): ZoteroItem? {
            val dados = bruto.optJSONObject("data") ?: return null
            val tipo = dados.optString("itemType")
            if (tipo == "note" || tipo == "annotation" || tipo == "attachment") return null
            val chave = bruto.optString("key", dados.optString("key"))
            if (chave.isBlank()) return null
            val criadores = dados.optJSONArray("creators") ?: JSONArray()
            val autores = (0 until criadores.length()).map { indice ->
                val criador = criadores.getJSONObject(indice)
                ZoteroCriador(
                    funcao = criador.optString("creatorType", "author"),
                    nome = criador.optString("firstName", criador.optString("name")),
                    sobrenome = criador.optString("lastName")
                )
            }
            val etiquetas = dados.optJSONArray("tags") ?: JSONArray()
            val colecoes = dados.optJSONArray("collections") ?: JSONArray()
            val ignorar = setOf("creators", "tags", "collections", "relations", "abstractNote")
            val campos = dados.keys().asSequence().filterNot { it in ignorar }.mapNotNull { campo ->
                val valor = dados.opt(campo)
                if (valor == null || valor == JSONObject.NULL || valor is JSONObject || valor is JSONArray) null
                else campo to valor.toString()
            }.toMap()
            return ZoteroItem(
                chave = chave,
                tipo = tipo,
                titulo = dados.optString("title", "Sem título"),
                autores = autores,
                data = dados.optString("date"),
                resumo = dados.optString("abstractNote"),
                doi = dados.optString("DOI"),
                tags = (0 until etiquetas.length()).mapNotNull { etiquetas.optJSONObject(it)?.optString("tag")?.takeIf(String::isNotBlank) },
                colecoes = (0 until colecoes.length()).map { colecoes.getString(it) },
                campos = campos
            )
        }

        private suspend fun requisicaoHttp(url: String, chave: String): String = withContext(Dispatchers.IO) {
            val conexao = URL(url).openConnection() as HttpURLConnection
            try {
                conexao.requestMethod = "GET"
                conexao.instanceFollowRedirects = false
                conexao.connectTimeout = 10_000
                conexao.readTimeout = 20_000
                conexao.setRequestProperty("Accept", "application/json")
                conexao.setRequestProperty("Zotero-API-Version", "3")
                conexao.setRequestProperty("Zotero-API-Key", chave)
                if (conexao.responseCode !in 200..299) error("Zotero respondeu ${conexao.responseCode}.")
                conexao.inputStream.bufferedReader().use { it.readText() }
            } finally {
                conexao.disconnect()
            }
        }
    }
}
