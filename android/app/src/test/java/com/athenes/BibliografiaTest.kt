package com.athenes

import com.athenes.core.citacao.AutorReferencia
import com.athenes.core.citacao.Bibliografia
import com.athenes.core.citacao.EstiloBibliografico
import com.athenes.core.citacao.ReferenciaAcademica
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.ZoteroCriadorInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BibliografiaTest {
    private val obra = ReferenciaAcademica(
        id = "z1", tipo = "journalArticle", titulo = "Uma pesquisa",
        autores = listOf(AutorReferencia("Silva", "Ana"), AutorReferencia("Pereira", "João")),
        ano = "2025", publicacao = "Revista Exemplo", volume = "3", numero = "2", paginas = "15-20", doi = "10.1000/exemplo"
    )

    @Test fun `formatos de citacao seguem os oito estilos da web`() {
        val esperados = mapOf(
            EstiloBibliografico.ABNT to "(SILVA; PEREIRA, 2025, p. 15)",
            EstiloBibliografico.ABNT_NUMERICO to "(2, p. 15)",
            EstiloBibliografico.APA to "(Silva & Pereira, 2025, p. 15)",
            EstiloBibliografico.HARVARD to "(Silva e Pereira, 2025, p. 15)",
            EstiloBibliografico.CHICAGO to "(Silva e Pereira 2025, 15)",
            EstiloBibliografico.MLA to "(Silva e Pereira 15)",
            EstiloBibliografico.VANCOUVER to "[2, p. 15]",
            EstiloBibliografico.IEEE to "[2, p. 15]"
        )
        esperados.forEach { (estilo, esperado) -> assertEquals(estilo.id, esperado, Bibliografia.citacao(obra, estilo, 2, "15")) }
    }

    @Test fun `estilos numericos preservam citacao e autor data ordena alfabeticamente`() {
        val ana = obra.copy(id = "a", autores = listOf(AutorReferencia("Almeida", "Ana")))
        val refs = listOf(obra, ana, obra)
        assertEquals(listOf("z1", "a"), Bibliografia.ordenar(refs, EstiloBibliografico.IEEE).map { it.id })
        assertEquals(listOf("a", "z1"), Bibliografia.ordenar(refs, EstiloBibliografico.ABNT).map { it.id })
    }

    @Test fun `lista gera prefixos e metadados para oito estilos`() {
        EstiloBibliografico.entries.forEach { estilo ->
            val texto = Bibliografia.formatar(obra, estilo, 2)
            assertTrue(estilo.id, texto.contains("Uma pesquisa"))
            assertTrue(estilo.id, texto.contains("Revista Exemplo"))
            assertTrue(estilo.id, texto.contains("2025"))
        }
        assertTrue(Bibliografia.formatar(obra, EstiloBibliografico.IEEE, 2).startsWith("[2]"))
        assertTrue(Bibliografia.formatar(obra, EstiloBibliografico.VANCOUVER, 2).startsWith("2."))
    }

    @Test fun `referencia do Zotero preserva criadores e campos bibliograficos`() {
        val artigo = ArtigoEstudoDetalhado(
            id = "item1", titulo = "Pesquisa", autores = "Ana Silva", ano = 2025, chaveZotero = "item1",
            tipoZotero = "journalArticle", criadoresZotero = listOf(ZoteroCriadorInfo("author", "Ana", "Silva")),
            camposZotero = mapOf("publicationTitle" to "Revista", "volume" to "4", "DOI" to "10.1/teste")
        )
        val ref = ReferenciaAcademica.doArtigo(artigo)
        assertEquals("Silva", ref.autores.single().sobrenome)
        assertEquals("Revista", ref.publicacao)
        assertEquals("4", ref.volume)
        assertEquals("10.1/teste", ref.doi)
    }
}
