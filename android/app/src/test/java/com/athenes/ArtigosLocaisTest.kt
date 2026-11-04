package com.athenes

import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.data.ArtigosLocaisCodec
import com.athenes.core.data.ZoteroItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArtigosLocaisTest {
    @Test fun `novo artigo local sobrevive a sincronizacao sem itens e mantem metadados`() {
        val repositorio = ArtigoEstudoRepository()
        val criado = repositorio.adicionarArtigoLocal("  Pesquisa de campo  ", "Ana Silva", 2025, "Revista", "Resumo")
        assertEquals("Pesquisa de campo", criado.titulo)
        assertTrue(criado.id.startsWith("local_"))
        assertTrue(criado.chaveZotero.isEmpty())
        repositorio.aplicarBibliotecaZotero(emptyList(), emptyList())
        assertEquals(criado.id, repositorio.artigos.value.single().id)
        repositorio.aplicarBibliotecaZotero(listOf(ZoteroItem(
            "ZOT12345", "journalArticle", "Artigo remoto", emptyList(), "2024", "", "", emptyList(), emptyList(), emptyMap()
        )), emptyList())
        assertEquals(2, repositorio.artigos.value.size)
        assertEquals(criado.id, repositorio.artigos.value.first().id)
        repositorio.atualizarResumos(criado.id, "Meu fichamento", "Método")
        val restaurado = ArtigosLocaisCodec.ler(ArtigosLocaisCodec.escrever(repositorio.artigos.value)).single()
        assertEquals("Meu fichamento", restaurado.meuResumo)
        assertEquals("Método", restaurado.analiseMetodologica)
        assertEquals("Revista", restaurado.camposZotero["publicationTitle"])
    }

    @Test fun `cadastro local exige titulo e ano validos`() {
        val repositorio = ArtigoEstudoRepository()
        assertTrue(runCatching { repositorio.adicionarArtigoLocal(" ", "", 2025, "", "") }.isFailure)
        assertTrue(runCatching { repositorio.adicionarArtigoLocal("Título", "", 1200, "", "") }.isFailure)
        assertFalse(repositorio.artigos.value.any { it.id.startsWith("local_") })
    }

    @Test fun `vinculo zotero do artigo local persiste sem criar chave de acesso`() {
        val repositorio = ArtigoEstudoRepository()
        val artigo = repositorio.adicionarArtigoLocal("Obra", "Ana", 2025, "Revista", "", "ITEM1234")
        val restaurado = ArtigosLocaisCodec.ler(ArtigosLocaisCodec.escrever(listOf(artigo))).single()
        assertEquals("ITEM1234", restaurado.chaveZotero)
        assertEquals(artigo.id, restaurado.id)
    }
}
