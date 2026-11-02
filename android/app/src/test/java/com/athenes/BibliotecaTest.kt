package com.athenes

import com.athenes.core.data.DocumentoRepository
import com.athenes.core.model.EstadoNuvem
import com.athenes.core.model.SituacaoDocumento
import com.athenes.core.model.TipoDocumento
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class BibliotecaTest {

    private lateinit var repository: DocumentoRepository

    @Before
    fun setup() {
        repository = DocumentoRepository(null)
    }

    @Test
    fun `inicializa com 3 documentos padrao identicos a plataforma web`() {
        val docs = repository.documentos.value
        assertEquals(3, docs.size)

        val doc1 = docs[0]
        assertTrue(doc1.titulo.contains("Acoustic Performance-Based Design"))
        assertEquals(TipoDocumento.DOCUMENTO, doc1.tipo)
        assertEquals(SituacaoDocumento.RASCUNHO, doc1.situacao)
        assertEquals(EstadoNuvem.NUVEM_SUPABASE, doc1.estadoNuvem)

        val doc2 = docs[1]
        assertTrue(doc2.titulo.contains("Análise Espacial e Diretrizes"))
        assertEquals(TipoDocumento.ARTIGO, doc2.tipo)
        assertEquals(SituacaoDocumento.EM_REVISAO, doc2.situacao)

        val doc3 = docs[2]
        assertTrue(doc3.titulo.contains("Relatório Técnico"))
        assertEquals(TipoDocumento.RELATORIO, doc3.tipo)
    }

    @Test
    fun `permite adicionar novo documento na biblioteca`() {
        val novo = repository.adicionarDocumento(
            titulo = "Tese de Doutorado em Urbanismo",
            subtitulo = "Metodologias de intervenção em áreas de preservação",
            tipo = TipoDocumento.MONOGRAFIA,
            autor = "Pesquisador Titular"
        )

        assertNotNull(novo.id)
        val docs = repository.documentos.value
        assertEquals(4, docs.size)
        assertEquals(novo.id, docs[0].id)
        assertEquals("Tese de Doutorado em Urbanismo", docs[0].titulo)
        assertEquals(TipoDocumento.MONOGRAFIA, docs[0].tipo)
    }

    @Test
    fun `permite duplicar documento existente`() {
        val original = repository.documentos.value[1]
        repository.duplicarDocumento(original.id)

        val docs = repository.documentos.value
        assertEquals(4, docs.size)
        assertTrue(docs[0].titulo.contains("Cópia"))
        assertEquals(original.tipo, docs[0].tipo)
    }

    @Test
    fun `permite renomear documento existente`() {
        val original = repository.documentos.value[0]
        repository.renomearDocumento(original.id, "Novo Título Acadêmico Revisado")

        val docAtualizado = repository.documentos.value.find { it.id == original.id }
        assertNotNull(docAtualizado)
        assertEquals("Novo Título Acadêmico Revisado", docAtualizado?.titulo)
    }

    @Test
    fun `permite excluir documento da biblioteca`() {
        val docParaExcluir = repository.documentos.value[0]
        repository.excluirDocumento(docParaExcluir.id)

        val docs = repository.documentos.value
        assertEquals(2, docs.size)
        assertTrue(docs.none { it.id == docParaExcluir.id })
    }
}
