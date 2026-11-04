package com.athenes

import com.athenes.core.data.BibtexParser
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.data.ZoteroItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BibtexParserTest {
    @Test fun `le referencias com chaves aninhadas e autores`() {
        val bib = """
            @article{silva2025,
              title = {Pesquisa {Athenes} em @campo},
              author = {Silva, Ana and João Pereira},
              year = {2025},
              journal = {Revista Científica},
              keywords = {ciência; edição},
              doi = "10.1000/teste"
            }
            @book{livro, title={Livro}, author={Souza, Maria}, year=2024}
        """.trimIndent()
        val itens = BibtexParser.ler(bib)
        assertEquals(2, itens.size)
        assertEquals("bib:silva2025", itens[0].chave)
        assertEquals("Pesquisa Athenes em @campo", itens[0].titulo)
        assertEquals("Ana", itens[0].autores[0].nome)
        assertEquals("Pereira", itens[0].autores[1].sobrenome)
        assertEquals(listOf("ciência", "edição"), itens[0].tags)
        assertEquals("book", itens[1].tipo)
        assertEquals("2024", itens[1].data)
    }

    @Test fun `ignora diretivas que nao sao referencias`() {
        val itens = BibtexParser.ler("@comment{teste} @string{nome={x}} @misc{site, title={Página}}")
        assertEquals(1, itens.size)
        assertEquals("webpage", itens.single().tipo)
        assertTrue(itens.single().autores.isEmpty())
    }

    @Test fun `importacao repetida nao duplica e sincronizacao preserva bib`() {
        val repo = ArtigoEstudoRepository()
        val bib = "@article{obra, title={Obra local}, author={Silva, Ana}, year={2025}}"
        repo.importarBib(bib)
        repo.importarBib(bib)
        assertEquals(1, repo.artigos.value.count { it.id == "bib:obra" })
        repo.aplicarBibliotecaZotero(
            listOf(ZoteroItem("ZOTERO01", "book", "Livro remoto", emptyList(), "2024", "", "", emptyList(), emptyList(), emptyMap())),
            emptyList()
        )
        assertEquals(listOf("ZOTERO01", "bib:obra"), repo.artigos.value.map { it.id })
    }
}
