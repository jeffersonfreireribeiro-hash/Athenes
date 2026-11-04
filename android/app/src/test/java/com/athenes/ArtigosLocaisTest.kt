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

    @Test fun `exclusao local nao remove item Zotero e aceita biblioteca vazia`() {
        val repositorio = ArtigoEstudoRepository()
        val local = repositorio.adicionarArtigoLocal("Local", "Ana", 2025, "", "")
        repositorio.aplicarBibliotecaZotero(emptyList(), emptyList())
        assertTrue(repositorio.excluirArtigoLocal(local.id))
        assertTrue(repositorio.artigos.value.isEmpty())
        assertFalse(repositorio.excluirArtigoLocal(local.id))
        repositorio.aplicarBibliotecaZotero(listOf(ZoteroItem(
            "ZOT12345", "journalArticle", "Remoto", emptyList(), "2024", "", "", emptyList(), emptyList(), emptyMap()
        )), emptyList())
        assertFalse(repositorio.excluirArtigoLocal("ZOT12345"))
        assertEquals("ZOT12345", repositorio.artigos.value.single().id)
    }

    @Test fun `edicao local preserva id e fichamento apos sincronizar`() {
        val repositorio = ArtigoEstudoRepository()
        val original = repositorio.adicionarArtigoLocal("Rascunho", "Ana", 2025, "Revista", "Resumo")
        repositorio.atualizarResumos(original.id, "Fichamento", "Método")
        assertTrue(repositorio.atualizarArtigoLocal(original.id, "  Título final  ", "Ana e Bruno", 2026, "Nova revista", "Novo resumo", "ITEM2"))
        repositorio.aplicarBibliotecaZotero(emptyList(), emptyList())
        val editado = repositorio.artigos.value.single()
        assertEquals(original.id, editado.id)
        assertEquals("Título final", editado.titulo)
        assertEquals("Fichamento", editado.meuResumo)
        assertEquals("Nova revista", ArtigosLocaisCodec.ler(ArtigosLocaisCodec.escrever(listOf(editado))).single().camposZotero["publicationTitle"])
        assertFalse(repositorio.atualizarArtigoLocal("ZOT123", "Não", "", 2025, "", "", ""))
    }
}
