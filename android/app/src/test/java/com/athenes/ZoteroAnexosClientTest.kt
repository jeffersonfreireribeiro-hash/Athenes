package com.athenes

import com.athenes.core.data.ZoteroAnexoPdf
import com.athenes.core.data.ZoteroAnexosClient
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ZoteroAnexosClientTest {
    @Test
    fun `lista apenas pdf e prioriza anexo baixavel`() = runBlocking {
        val urls = mutableListOf<String>()
        val cliente = ZoteroAnexosClient(
            requisitarJson = { url, _ ->
                urls += url
                """[
                  {"key":"VINCULADO","data":{"itemType":"attachment","contentType":"application/pdf","linkMode":"linked_file","filename":"local.pdf"}},
                  {"key":"BAIXAVEL","data":{"itemType":"attachment","contentType":"application/pdf","linkMode":"imported_file","filename":"remoto.pdf"}},
                  {"key":"IMAGEM","data":{"itemType":"attachment","contentType":"image/png","linkMode":"imported_file"}}
                ]"""
            },
            baixarBytes = { _, _ -> "%PDF-1.7\nconteúdo".toByteArray() }
        )
        val anexos = cliente.listarPdf("123", "chave", "ITEM")
        assertEquals(listOf("BAIXAVEL", "VINCULADO"), anexos.map { it.chave })
        assertTrue(urls.single().contains("/users/123/items/ITEM/children?"))
        assertTrue(cliente.baixarPdf("123", "chave", anexos.first()).size > 5)
        assertTrue(runCatching { cliente.baixarPdf("123", "chave", anexos.last()) }.isFailure)
    }

    @Test
    fun `recusa resposta que nao seja pdf`() = runBlocking {
        val cliente = ZoteroAnexosClient(
            requisitarJson = { _, _ -> "[]" },
            baixarBytes = { _, _ -> "<html>erro</html>".toByteArray() }
        )
        assertTrue(runCatching { cliente.baixarPdf("123", "chave", ZoteroAnexoPdf("ABC", "a.pdf", true)) }.isFailure)
    }
}
