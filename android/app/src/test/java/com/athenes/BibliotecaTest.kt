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
import java.nio.file.Files
import java.io.File
import org.json.JSONObject

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
        assertTrue(doc1.titulo.contains("Análise Espacial e Diretrizes"))
        assertEquals(TipoDocumento.ARTIGO, doc1.tipo)
        assertEquals(SituacaoDocumento.EM_REVISAO, doc1.situacao)
        assertEquals(EstadoNuvem.LOCAL, doc1.estadoNuvem)

        val doc2 = docs[1]
        assertTrue(doc2.titulo.contains("Relatório Técnico"))
        assertEquals(TipoDocumento.RELATORIO, doc2.tipo)

        val doc3 = docs[2]
        assertTrue(doc3.titulo.contains("Monografia"))
        assertEquals(TipoDocumento.MONOGRAFIA, doc3.tipo)
        assertEquals(EstadoNuvem.NUVEM_SUPABASE, doc3.estadoNuvem)
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

    @Test
    fun `pastas e subpastas movem documentos sem perda ao excluir pasta`() {
        val pai = repository.criarPasta("Pesquisa")!!
        val filha = repository.criarPasta("Artigos", pai.id)!!
        val doc = repository.documentos.value.first()
        assertTrue(repository.moverDocumento(doc.id, filha.id))
        assertEquals(filha.id, repository.documentos.value.first { it.id == doc.id }.pastaId)
        repository.excluirPasta(pai.id)
        assertTrue(repository.pastas.value.isEmpty())
        assertEquals(null, repository.documentos.value.first { it.id == doc.id }.pastaId)
    }

    @Test
    fun `recusa mover documento para pasta inexistente`() {
        val doc = repository.documentos.value.first()
        assertTrue(!repository.moverDocumento(doc.id, "inexistente"))
        assertEquals(null, repository.documentos.value.first { it.id == doc.id }.pastaId)
    }

    @Test
    fun `duplicacao copia conteudo e lixeira permite restaurar apos reabrir`() {
        val pasta = Files.createTempDirectory("athenes-docs-test").toFile()
        try {
            val repositorio = DocumentoRepository(storageDir = pasta)
            val original = repositorio.adicionarDocumento("Pesquisa completa")
            File(pasta, "editor_${original.id}.json").writeText(
                JSONObject().put("titulo", original.titulo).put("blocos", org.json.JSONArray().put(JSONObject().put("texto", "Conteúdo original"))).toString()
            )
            repositorio.duplicarDocumento(original.id)
            val copia = repositorio.documentos.value.first()
            assertTrue(copia.id != original.id)
            assertEquals("Conteúdo original", JSONObject(File(pasta, "editor_${copia.id}.json").readText()).getJSONArray("blocos").getJSONObject(0).getString("texto"))
            assertEquals(copia.titulo, JSONObject(File(pasta, "editor_${copia.id}.json").readText()).getString("titulo"))

            repositorio.excluirDocumento(copia.id)
            assertTrue(repositorio.documentos.value.none { it.id == copia.id })
            assertTrue(File(pasta, "editor_${copia.id}.json").exists())
            val reaberto = DocumentoRepository(storageDir = pasta)
            assertTrue(reaberto.lixeira.value.any { it.id == copia.id })
            assertTrue(reaberto.restaurarDocumento(copia.id))
            assertTrue(reaberto.documentos.value.any { it.id == copia.id })
            reaberto.excluirDocumento(copia.id)
            assertTrue(reaberto.excluirDefinitivamente(copia.id))
            assertTrue(!File(pasta, "editor_${copia.id}.json").exists())
        } finally {
            pasta.deleteRecursively()
        }
    }

    @Test
    fun `importacao json cria documento novo e rejeita tipos e imagens sem arquivo`() {
        val pasta = Files.createTempDirectory("athenes-import-test").toFile()
        try {
            val repositorio = DocumentoRepository(storageDir = pasta)
            val json = JSONObject()
                .put("titulo", "Documento importado")
                .put("autores", "Pesquisadora")
                .put("blocos", org.json.JSONArray().put(JSONObject().put("tipo", "PARAGRAFO").put("id", "antigo").put("texto", "Texto preservado")))
            val doc = repositorio.importarDocumentoJson(json.toString())
            val bloco = JSONObject(File(pasta, "editor_${doc.id}.json").readText()).getJSONArray("blocos").getJSONObject(0)
            assertEquals("Texto preservado", bloco.getString("texto"))
            assertTrue(bloco.getString("id") != "antigo")
            assertTrue(repositorio.documentos.value.any { it.id == doc.id })
            val comReferencias = JSONObject()
                .put("titulo", "Citações importadas")
                .put("estiloBibliografico", "apa")
                .put("referencias", org.json.JSONArray().put(JSONObject().put("id", "zotero-1").put("titulo", "Obra citada")))
                .put("blocos", org.json.JSONArray().put(JSONObject().put("tipo", "REFERENCIAS").put("id", "antigo")))
            val importado = repositorio.importarDocumentoJson(comReferencias.toString())
            val conteudo = JSONObject(File(pasta, "editor_${importado.id}.json").readText())
            assertEquals("apa", conteudo.getString("estiloBibliografico"))
            assertEquals("zotero-1", conteudo.getJSONArray("referencias").getJSONObject(0).getString("id"))
            assertEquals("REFERENCIAS", conteudo.getJSONArray("blocos").getJSONObject(0).getString("tipo"))
            assertTrue(runCatching { repositorio.importarDocumentoJson(json.put("blocos", org.json.JSONArray().put(JSONObject().put("tipo", "DESCONHECIDO"))).toString()) }.isFailure)
            assertTrue(runCatching { repositorio.importarDocumentoJson(json.put("blocos", org.json.JSONArray().put(JSONObject().put("tipo", "FIGURA").put("imagem", "ausente.png"))).toString()) }.isFailure)
        } finally {
            pasta.deleteRecursively()
        }
    }
}
