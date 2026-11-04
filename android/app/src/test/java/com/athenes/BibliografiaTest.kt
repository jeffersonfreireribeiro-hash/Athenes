package com.athenes

import com.athenes.core.citacao.AutorReferencia
import com.athenes.core.citacao.Bibliografia
import com.athenes.core.citacao.EstiloBibliografico
import com.athenes.core.citacao.ReferenciaAcademica
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.ZoteroCriadorInfo
import com.athenes.core.data.ArtigoEstudoRepository
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

    @Test fun `referencias de artigo coincidem com a saida textual da web`() {
        val esperados = mapOf(
            EstiloBibliografico.ABNT to "SILVA, Ana; PEREIRA, João. Uma pesquisa. Revista Exemplo, v. 3, n. 2, p. 15-20, 2025. DOI: https://doi.org/10.1000/exemplo.",
            EstiloBibliografico.ABNT_NUMERICO to "2 SILVA, Ana; PEREIRA, João. Uma pesquisa. Revista Exemplo, v. 3, n. 2, p. 15-20, 2025. DOI: https://doi.org/10.1000/exemplo.",
            EstiloBibliografico.APA to "Silva, A., & Pereira, J. (2025). Uma pesquisa. Revista Exemplo, 3(2), 15-20. https://doi.org/10.1000/exemplo",
            EstiloBibliografico.HARVARD to "Silva, A. and Pereira, J. (2025) 'Uma pesquisa', Revista Exemplo, 3(2), pp. 15-20. doi: 10.1000/exemplo.",
            EstiloBibliografico.CHICAGO to "Silva, Ana and João Pereira. 2025. “Uma pesquisa.” Revista Exemplo 3 (2): 15-20. https://doi.org/10.1000/exemplo",
            EstiloBibliografico.MLA to "Silva, Ana, and João Pereira. “Uma pesquisa.” Revista Exemplo, vol. 3, no. 2, 2025, pp. 15-20. https://doi.org/10.1000/exemplo",
            EstiloBibliografico.VANCOUVER to "2. Silva A, Pereira J. Uma pesquisa. Revista Exemplo. 2025;3(2):15-20. doi:10.1000/exemplo",
            EstiloBibliografico.IEEE to "[2] A. Silva and J. Pereira, “Uma pesquisa,” Revista Exemplo, vol. 3, no. 2, pp. 15-20, 2025. doi: 10.1000/exemplo."
        )
        esperados.forEach { (estilo, esperado) -> assertEquals(estilo.id, esperado, Bibliografia.formatar(obra, estilo, 2)) }
    }

    @Test fun `referencias de capitulo coincidem com a saida textual da web`() {
        val capitulo = ReferenciaAcademica("c", "bookSection", "Uma obra", listOf(AutorReferencia("Silva", "Ana")),
            "2025", "Coletânea", "Editora X", "Fortaleza", paginas = "15-20", doi = "10.1000/exemplo", url = "https://example.org/obra")
        val esperados = mapOf(
            EstiloBibliografico.ABNT to "SILVA, Ana. Uma obra. In: Coletânea. Fortaleza: Editora X, 2025. p. 15-20. Disponível em: <https://example.org/obra>. DOI: https://doi.org/10.1000/exemplo.",
            EstiloBibliografico.APA to "Silva, A. (2025). Uma obra. In Coletânea (pp. 15-20). Editora X. https://doi.org/10.1000/exemplo",
            EstiloBibliografico.HARVARD to "Silva, A. (2025) 'Uma obra', in Coletânea. Fortaleza: Editora X. pp. 15-20. doi: 10.1000/exemplo.",
            EstiloBibliografico.CHICAGO to "Silva, Ana. 2025. “Uma obra.” In Coletânea, 15-20. Fortaleza: Editora X. https://doi.org/10.1000/exemplo",
            EstiloBibliografico.MLA to "Silva, Ana. “Uma obra.” Coletânea, Editora X, 2025, pp. 15-20. https://doi.org/10.1000/exemplo",
            EstiloBibliografico.VANCOUVER to "2. Silva A. Uma obra. In: Coletânea. Fortaleza: Editora X; 2025. p. 15-20.",
            EstiloBibliografico.IEEE to "[2] A. Silva, “Uma obra,” in Coletânea, Fortaleza, 2025, pp. 15-20. doi: 10.1000/exemplo."
        )
        esperados.forEach { (estilo, esperado) -> assertEquals(estilo.id, esperado, Bibliografia.formatar(capitulo, estilo, 2)) }
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

    @Test fun `pagina aceita faixas validas e respeita intervalo da obra`() {
        assertEquals("15–17, 20", Bibliografia.validarPagina("15-17; 20", "15-20", 33).valor)
        assertTrue(Bibliografia.validarPagina("21", "15-20", 33).valida.not())
        assertTrue(Bibliografia.validarPagina("17-15", "15-20", 33).valida.not())
        assertTrue(Bibliografia.validarPagina("abc", "15-20", 33).valida.not())
        assertTrue(Bibliografia.validarPagina("33", "", 33).valida)
    }

    @Test fun `referencia de bib preserva revista numero paginas e doi`() {
        val repo = ArtigoEstudoRepository()
        repo.importarBib("@article{bib1, title={Título}, author={Silva, Ana}, year={2025}, journal={Revista}, volume={4}, number={2}, pages={15-20}, doi={10.1/teste}}")
        val ref = ReferenciaAcademica.doArtigo(repo.artigos.value.single())
        assertEquals("Revista", ref.publicacao)
        assertEquals("2", ref.numero)
        assertEquals("15-20", ref.paginas)
        assertEquals("10.1/teste", ref.doi)
    }
}
