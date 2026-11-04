package com.athenes

import com.athenes.core.citacao.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CitacoesInlineTest {
    private val ref = ReferenciaAcademica("obra", "journalArticle", "Estudo", listOf(AutorReferencia("Silva", "Ana")), "2025")

    @Test fun `insere citacao no cursor e desloca outra referencia`() {
        val original = TextoComCitacoes("Texto final", listOf(CitacaoInline("anterior", 6, 11)))
        val novo = CitacoesInline.inserir(original, 5, "obra", "(SILVA, 2025)")
        assertEquals("Texto (SILVA, 2025) final", novo.texto)
        assertEquals("(SILVA, 2025)", novo.texto.substring(novo.citacoes[0].inicio, novo.citacoes[0].fim))
        assertEquals(20, novo.citacoes[1].inicio)
    }

    @Test fun `edicao antes desloca e edicao dentro remove vinculo`() {
        val antigo = "Texto (SILVA, 2025) final"
        val citacao = CitacaoInline("obra", 6, 19)
        assertEquals(10, CitacoesInline.atualizarDepoisDaEdicao(antigo, "Meu $antigo", listOf(citacao)).single().inicio)
        assertTrue(CitacoesInline.atualizarDepoisDaEdicao(antigo, antigo.replace("SILVA", "SILVA A"), listOf(citacao)).isEmpty())
    }

    @Test fun `troca estilo sem perder vinculo`() {
        val original = CitacoesInline.inserir(TextoComCitacoes("Texto", emptyList()), 5, "obra", "(SILVA, 2025)")
        val novo = CitacoesInline.reformatar(original, listOf(ref), EstiloBibliografico.IEEE)
        assertEquals("Texto [1]", novo.texto)
        assertEquals("[1]", novo.texto.substring(novo.citacoes.single().inicio, novo.citacoes.single().fim))
    }

    @Test fun `metadados sobrevivem ao ciclo JSON e intervalos invalidos sao descartados`() {
        val refs = listOf(ref)
        val citacoes = listOf(CitacaoInline("obra", 0, 5, "15", true))
        assertEquals(refs, BibliografiaCodec.ler(BibliografiaCodec.escrever(refs)))
        assertEquals(citacoes, BibliografiaCodec.lerCitacoes(BibliografiaCodec.escreverCitacoes(citacoes), "Texto"))
        assertTrue(BibliografiaCodec.lerCitacoes(BibliografiaCodec.escreverCitacoes(citacoes), "Curto".dropLast(1)).isEmpty())
    }
}
