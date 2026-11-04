package com.athenes

import com.athenes.core.data.ZoteroApiClient
import com.athenes.core.data.ZoteroCacheCodec
import com.athenes.core.data.ZoteroColecao
import com.athenes.core.data.ZoteroItem
import com.athenes.core.data.ZoteroCriador
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.data.ZoteroCampos
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ZoteroApiClientTest {
    @Test
    fun `pagina mais de cem itens sem repetir anexos`() = runBlocking {
        val pedidos = mutableListOf<String>()
        val itens = (0 until 140).map { indice ->
            JSONObject().put("key", "ITEM$indice").put("data", JSONObject()
                .put("itemType", "journalArticle")
                .put("title", "Artigo $indice"))
        }.toMutableList()
        itens[25] = JSONObject().put("key", "ANEXO").put("data", JSONObject().put("itemType", "attachment"))
        val cliente = ZoteroApiClient { url, _ ->
            pedidos.add(url)
            val inicio = Regex("start=(\\d+)").find(url)!!.groupValues[1].toInt()
            JSONArray(itens.drop(inicio).take(100)).toString()
        }
        val resultado = cliente.listarItens("usuario_teste", "chave_falsa")
        assertEquals(139, resultado.size)
        assertEquals(2, pedidos.size)
        assertTrue(pedidos[1].contains("start=100"))
        assertTrue(resultado.none { it.chave == "ANEXO" })
    }

    @Test
    fun `preserva campos e funcoes dos criadores`() {
        val bruto = JSONObject().put("key", "ABC123")
            .put("data", JSONObject()
                .put("itemType", "book")
                .put("title", "Livro de teste")
                .put("date", "2026")
                .put("DOI", "10.1000/teste")
                .put("publisher", "Editora")
                .put("creators", JSONArray().put(JSONObject()
                    .put("creatorType", "editor")
                    .put("firstName", "Ana")
                    .put("lastName", "Silva")))
                .put("collections", JSONArray().put("COL1")))
        val item = ZoteroApiClient.normalizarItem(bruto)!!
        assertEquals("editor", item.autores.single().funcao)
        assertEquals("Editora", item.campos["publisher"])
        assertEquals("COL1", item.colecoes.single())
        assertEquals("10.1000/teste", item.doi)
        val colecoes = listOf(ZoteroColecao("COL1", "Pesquisa", null), ZoteroColecao("COL2", "Artigos", "COL1"))
        val restaurado = ZoteroCacheCodec.ler(ZoteroCacheCodec.escrever(listOf(item), colecoes))
        assertEquals(item, restaurado.first.single())
        assertEquals(colecoes, restaurado.second)
    }

    @Test
    fun `biblioteca aplica itens e colecoes sem perder metadados`() {
        val repo = ArtigoEstudoRepository()
        val item = ZoteroItem(
            chave = "ITEMTESTE", tipo = "journalArticle", titulo = "Pesquisa em teste",
            autores = listOf(ZoteroCriador("author", "Ana", "Silva")),
            data = "2024-05", resumo = "Resumo", doi = "10.1000/teste",
            tags = listOf("tema"), colecoes = listOf("COL1"), campos = mapOf("volume" to "12")
        )
        repo.aplicarBibliotecaZotero(listOf(item), listOf(ZoteroColecao("COL1", "Pesquisa", null)))
        val artigo = repo.artigos.value.single()
        assertEquals("ITEMTESTE", artigo.id)
        assertEquals(2024, artigo.ano)
        assertEquals("12", artigo.camposZotero["volume"])
        assertEquals("author", artigo.criadoresZotero.single().funcao)
        assertEquals("COL1", artigo.colecoesZotero.single())
        val linhas = ZoteroCampos.linhas(artigo)
        assertEquals("Tipo do item", linhas.first().first)
        assertTrue(linhas.indexOfFirst { it.first == "Autor" } < linhas.indexOfFirst { it.first == "Volume" })
        assertEquals("12", linhas.first { it.first == "Volume" }.second)
    }
}
