package com.athenes.core.data

import android.content.Context
import com.athenes.core.model.Documento
import com.athenes.core.model.EstadoNuvem
import com.athenes.core.model.SituacaoDocumento
import com.athenes.core.model.TipoDocumento
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

class DocumentoRepository(private val context: Context? = null) {

    private val _documentos = MutableStateFlow<List<Documento>>(emptyList())
    val documentos: StateFlow<List<Documento>> = _documentos.asStateFlow()

    init {
        carregarDocumentos()
    }

    private fun obterArquivoPersistencia(): File? {
        return context?.filesDir?.let { File(it, "athenes_documentos.json") }
    }

    fun carregarDocumentos() {
        val arquivo = obterArquivoPersistencia()
        if (arquivo != null && arquivo.exists()) {
            try {
                val jsonStr = arquivo.readText()
                val array = JSONArray(jsonStr)
                val lista = mutableListOf<Documento>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    lista.add(
                        Documento(
                            id = obj.optString("id", UUID.randomUUID().toString()),
                            titulo = obj.optString("titulo", "Sem título"),
                            subtitulo = obj.optString("subtitulo", ""),
                            tipo = TipoDocumento.deString(obj.optString("tipo")),
                            situacao = SituacaoDocumento.deString(obj.optString("situacao")),
                            estadoNuvem = EstadoNuvem.deString(obj.optString("estadoNuvem")),
                            autor = obj.optString("autor", "Autor Principal"),
                            ano = obj.optInt("ano", 2026),
                            resumo = obj.optString("resumo", ""),
                            modificadoEm = obj.optString("modificadoEm", "01/11/2026"),
                            disponivelOffline = obj.optBoolean("disponivelOffline", true)
                        )
                    )
                }
                _documentos.value = lista
                return
            } catch (_: Exception) {}
        }

        // Se não há dados gravados ainda, inicializa com os 3 trabalhos canônicos da plataforma
        _documentos.value = obterDocumentosPadraoIniciais()
        salvarEmDisco()
    }

    private fun salvarEmDisco() {
        val arquivo = obterArquivoPersistencia() ?: return
        try {
            val array = JSONArray()
            for (doc in _documentos.value) {
                val obj = JSONObject().apply {
                    put("id", doc.id)
                    put("titulo", doc.titulo)
                    put("subtitulo", doc.subtitulo)
                    put("tipo", doc.tipo.name)
                    put("situacao", doc.situacao.name)
                    put("estadoNuvem", doc.estadoNuvem.name)
                    put("autor", doc.autor)
                    put("ano", doc.ano)
                    put("resumo", doc.resumo)
                    put("modificadoEm", doc.modificadoEm)
                    put("disponivelOffline", doc.disponivelOffline)
                }
                array.put(obj)
            }
            arquivo.writeText(array.toString(2))
        } catch (_: Exception) {}
    }

    fun adicionarDocumento(
        titulo: String,
        subtitulo: String = "",
        tipo: TipoDocumento = TipoDocumento.DOCUMENTO,
        autor: String = "Autor Principal"
    ): Documento {
        val novo = Documento(
            id = UUID.randomUUID().toString(),
            titulo = titulo,
            subtitulo = subtitulo,
            tipo = tipo,
            situacao = SituacaoDocumento.RASCUNHO,
            estadoNuvem = EstadoNuvem.LOCAL,
            autor = autor,
            ano = 2026,
            modificadoEm = "Hoje"
        )
        _documentos.value = listOf(novo) + _documentos.value
        salvarEmDisco()
        return novo
    }

    fun duplicarDocumento(id: String) {
        val original = _documentos.value.find { it.id == id } ?: return
        val copia = original.copy(
            id = UUID.randomUUID().toString(),
            titulo = "${original.titulo} (Cópia)",
            situacao = SituacaoDocumento.RASCUNHO,
            estadoNuvem = EstadoNuvem.LOCAL,
            modificadoEm = "Hoje"
        )
        _documentos.value = listOf(copia) + _documentos.value
        salvarEmDisco()
    }

    fun renomearDocumento(id: String, novoTitulo: String) {
        _documentos.value = _documentos.value.map {
            if (it.id == id) it.copy(titulo = novoTitulo, modificadoEm = "Hoje") else it
        }
        salvarEmDisco()
    }

    fun excluirDocumento(id: String) {
        _documentos.value = _documentos.value.filter { it.id != id }
        salvarEmDisco()
    }

    companion object {
        fun obterDocumentosPadraoIniciais(): List<Documento> {
            return listOf(
                Documento(
                    id = "doc_reurb_sustentavel",
                    titulo = "Análise Espacial e Diretrizes de Reurbanização Sustentável",
                    subtitulo = "Estudo de caso e proposições metodológicas para comunidades consolidadas",
                    tipo = TipoDocumento.ARTIGO,
                    situacao = SituacaoDocumento.EM_REVISAO,
                    estadoNuvem = EstadoNuvem.LOCAL,
                    autor = "Jefferson F. Ribeiro",
                    ano = 2026,
                    modificadoEm = "01/11/2026"
                ),
                Documento(
                    id = "doc_relatorio_infra",
                    titulo = "Relatório Técnico de Diagnóstico Urbanístico e Infraestrutura",
                    subtitulo = "Levantamento de campo, consolidação de parcelas e equipamentos públicos",
                    tipo = TipoDocumento.RELATORIO,
                    situacao = SituacaoDocumento.RASCUNHO,
                    estadoNuvem = EstadoNuvem.LOCAL,
                    autor = "Jefferson F. Ribeiro",
                    ano = 2026,
                    modificadoEm = "01/11/2026"
                ),
                Documento(
                    id = "doc_monografia_reurb",
                    titulo = "Monografia de Políticas Urbanas e Regularização Fundiária",
                    subtitulo = "Instrumentos jurídicos e urbanísticos da Lei Federal 13.465/2017",
                    tipo = TipoDocumento.MONOGRAFIA,
                    situacao = SituacaoDocumento.RASCUNHO,
                    estadoNuvem = EstadoNuvem.NUVEM_SUPABASE,
                    autor = "Jefferson F. Ribeiro",
                    ano = 2026,
                    modificadoEm = "01/11/2026"
                )
            )
        }
    }
}
