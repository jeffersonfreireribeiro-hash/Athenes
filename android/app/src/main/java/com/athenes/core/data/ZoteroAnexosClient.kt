package com.athenes.core.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class ZoteroAnexoPdf(val chave: String, val nomeArquivo: String, val baixavel: Boolean)

class ZoteroAnexosClient(
    private val requisitarJson: suspend (String, String) -> String = ::requisitar,
    private val baixarBytes: suspend (String, String) -> ByteArray = ::baixar
) {
    suspend fun listarPdf(usuarioId: String, chave: String, itemKey: String): List<ZoteroAnexoPdf> {
        require(usuarioId.isNotBlank() && chave.isNotBlank() && itemKey.isNotBlank())
        val resultado = mutableListOf<ZoteroAnexoPdf>()
        for (pagina in 0 until 20) {
            val url = "https://api.zotero.org/users/${codificar(usuarioId)}/items/${codificar(itemKey)}/children?limit=100&start=${pagina * 100}"
            val itens = JSONArray(requisitarJson(url, chave))
            for (i in 0 until itens.length()) {
                val item = itens.getJSONObject(i)
                val dados = item.optJSONObject("data") ?: continue
                if (dados.optString("itemType") != "attachment" || !dados.optString("contentType").contains("pdf", ignoreCase = true)) continue
                val chaveAnexo = item.optString("key", dados.optString("key"))
                if (chaveAnexo.isBlank()) continue
                resultado += ZoteroAnexoPdf(
                    chaveAnexo,
                    dados.optString("filename", dados.optString("title", "$chaveAnexo.pdf")),
                    dados.optString("linkMode") in setOf("imported_file", "imported_url")
                )
            }
            if (itens.length() < 100) break
        }
        return resultado.sortedByDescending { it.baixavel }
    }

    suspend fun baixarPdf(usuarioId: String, chave: String, anexo: ZoteroAnexoPdf): ByteArray {
        require(anexo.baixavel) { "Este PDF está vinculado ao computador e não pode ser baixado do Zotero." }
        val url = "https://api.zotero.org/users/${codificar(usuarioId)}/items/${codificar(anexo.chave)}/file"
        val bytes = baixarBytes(url, chave)
        require(bytes.size >= 5 && bytes.copyOfRange(0, 5).contentEquals("%PDF-".toByteArray())) {
            "O Zotero não devolveu um PDF válido."
        }
        return bytes
    }

    companion object {
        private const val LIMITE_BYTES = 50 * 1024 * 1024
        private fun codificar(valor: String) = URLEncoder.encode(valor.trim(), "UTF-8")

        private suspend fun requisitar(url: String, chave: String): String = withContext(Dispatchers.IO) {
            val conexao = URL(url).openConnection() as HttpURLConnection
            try {
                conexao.connectTimeout = 10_000
                conexao.readTimeout = 20_000
                conexao.setRequestProperty("Accept", "application/json")
                conexao.setRequestProperty("Zotero-API-Version", "3")
                conexao.setRequestProperty("Zotero-API-Key", chave)
                if (conexao.responseCode !in 200..299) error("Zotero respondeu ${conexao.responseCode}.")
                conexao.inputStream.bufferedReader().use { it.readText() }
            } finally { conexao.disconnect() }
        }

        private suspend fun baixar(url: String, chave: String): ByteArray = withContext(Dispatchers.IO) {
            var atual = URL(url)
            repeat(4) { tentativa ->
                require(atual.protocol == "https") { "Redirecionamento inseguro do anexo." }
                val conexao = atual.openConnection() as HttpURLConnection
                try {
                    conexao.instanceFollowRedirects = false
                    conexao.connectTimeout = 10_000
                    conexao.readTimeout = 30_000
                    conexao.setRequestProperty("Accept", "application/pdf")
                    if (atual.host.equals("api.zotero.org", ignoreCase = true)) {
                        conexao.setRequestProperty("Zotero-API-Version", "3")
                        conexao.setRequestProperty("Zotero-API-Key", chave)
                    }
                    val status = conexao.responseCode
                    if (status in 300..399) {
                        require(tentativa < 3) { "Redirecionamentos demais ao baixar o PDF." }
                        val local = conexao.getHeaderField("Location") ?: error("Redirecionamento sem destino.")
                        atual = URL(atual, local)
                    } else {
                        if (status == 404) error("O PDF não está guardado no Zotero.")
                        if (status == 403) error("A chave do Zotero não permite baixar arquivos.")
                        if (status !in 200..299) error("Zotero respondeu $status ao baixar o PDF.")
                        conexao.inputStream.use { entrada ->
                            val dados = entrada.readNBytes(LIMITE_BYTES + 1)
                            require(dados.size <= LIMITE_BYTES) { "PDF maior que 50 MB." }
                            return@withContext dados
                        }
                    }
                } finally { conexao.disconnect() }
            }
            error("Não foi possível baixar o PDF.")
        }
    }
}
