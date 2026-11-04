package com.athenes.core.data

import android.content.Context
import com.athenes.core.model.Documento
import com.athenes.core.model.PastaDocumento
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

class DocumentoRepository(private val context: Context? = null, private val storageDir: File? = context?.filesDir) {

    private val _documentos = MutableStateFlow<List<Documento>>(emptyList())
    val documentos: StateFlow<List<Documento>> = _documentos.asStateFlow()
    private val _lixeira = MutableStateFlow<List<Documento>>(emptyList())
    val lixeira: StateFlow<List<Documento>> = _lixeira.asStateFlow()
    private val _pastas = MutableStateFlow<List<PastaDocumento>>(emptyList())
    val pastas: StateFlow<List<PastaDocumento>> = _pastas.asStateFlow()

    init {
        carregarPastas()
        carregarDocumentos()
        carregarLixeira()
    }

    private fun carregarPastas() {
        val arquivo = storageDir?.let { File(it, "athenes_pastas.json") } ?: return
        if (!arquivo.exists()) return
        runCatching {
            val dados = JSONArray(arquivo.readText())
            _pastas.value = (0 until dados.length()).map { indice ->
                val item = dados.getJSONObject(indice)
                PastaDocumento(item.getString("id"), item.getString("nome"), item.optString("pastaPaiId").ifBlank { null })
            }
        }
    }

    private fun salvarPastas() {
        val arquivo = storageDir?.let { File(it, "athenes_pastas.json") } ?: return
        val dados = JSONArray()
        _pastas.value.forEach { pasta ->
            dados.put(JSONObject().put("id", pasta.id).put("nome", pasta.nome).put("pastaPaiId", pasta.pastaPaiId ?: ""))
        }
        arquivo.writeText(dados.toString())
    }

    fun criarPasta(nome: String, pastaPaiId: String? = null): PastaDocumento? {
        val limpo = nome.trim()
        if (limpo.isEmpty() || (pastaPaiId != null && _pastas.value.none { it.id == pastaPaiId })) return null
        val pasta = PastaDocumento(UUID.randomUUID().toString(), limpo, pastaPaiId)
        _pastas.value = _pastas.value + pasta
        salvarPastas()
        return pasta
    }

    fun renomearPasta(id: String, nome: String) {
        if (nome.isBlank()) return
        _pastas.value = _pastas.value.map { if (it.id == id) it.copy(nome = nome.trim()) else it }
        salvarPastas()
    }

    fun excluirPasta(id: String) {
        if (_pastas.value.none { it.id == id }) return
        val ids = mutableSetOf(id)
        do {
            val antes = ids.size
            _pastas.value.filter { it.pastaPaiId in ids }.forEach { ids.add(it.id) }
        } while (ids.size != antes)
        _documentos.value = _documentos.value.map { if (it.pastaId in ids) it.copy(pastaId = null) else it }
        _pastas.value = _pastas.value.filterNot { it.id in ids }
        salvarEmDisco()
        salvarPastas()
    }

    fun moverDocumento(id: String, pastaId: String?): Boolean {
        if (pastaId != null && _pastas.value.none { it.id == pastaId }) return false
        if (_documentos.value.none { it.id == id }) return false
        _documentos.value = _documentos.value.map { if (it.id == id) it.copy(pastaId = pastaId) else it }
        salvarEmDisco()
        return true
    }

    private fun obterArquivoPersistencia(): File? {
        return storageDir?.let { File(it, "athenes_documentos.json") }
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
                            disponivelOffline = obj.optBoolean("disponivelOffline", true),
                            pastaId = obj.optString("pastaId").ifBlank { null }
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
                    put("pastaId", doc.pastaId ?: "")
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
        val origem = arquivoEditor(original.id)
        val destino = arquivoEditor(copia.id)
        if (origem?.exists() == true && destino != null) {
            runCatching {
                val conteudo = JSONObject(origem.readText()).put("titulo", copia.titulo)
                destino.writeText(conteudo.toString())
            }.onFailure { return }
        }
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
        val documento = _documentos.value.find { it.id == id } ?: return
        _documentos.value = _documentos.value.filterNot { it.id == id }
        _lixeira.value = listOf(documento) + _lixeira.value.filterNot { it.id == id }
        salvarEmDisco()
        salvarLixeira()
    }

    fun restaurarDocumento(id: String): Boolean {
        val documento = _lixeira.value.find { it.id == id } ?: return false
        if (_documentos.value.any { it.id == id }) return false
        val pasta = documento.pastaId?.takeIf { idPasta -> _pastas.value.any { it.id == idPasta } }
        _documentos.value = listOf(documento.copy(pastaId = pasta)) + _documentos.value
        _lixeira.value = _lixeira.value.filterNot { it.id == id }
        salvarEmDisco()
        salvarLixeira()
        return true
    }

    fun excluirDefinitivamente(id: String): Boolean {
        if (_lixeira.value.none { it.id == id }) return false
        _lixeira.value = _lixeira.value.filterNot { it.id == id }
        salvarLixeira()
        arquivoEditor(id)?.delete()
        return true
    }

    private fun arquivoEditor(id: String): File? = storageDir?.let { File(it, "editor_$id.json") }

    private fun carregarLixeira() {
        val arquivo = storageDir?.let { File(it, "athenes_lixeira.json") } ?: return
        if (!arquivo.exists()) return
        runCatching {
            val conteudo = JSONArray(arquivo.readText())
            _lixeira.value = (0 until conteudo.length()).map { i -> documentoDeJson(conteudo.getJSONObject(i)) }
        }
    }

    private fun salvarLixeira() {
        val pasta = storageDir ?: return
        File(pasta, "athenes_lixeira.json").writeText(JSONArray(_lixeira.value.map(::documentoParaJson)).toString())
    }

    private fun documentoParaJson(doc: Documento) = JSONObject().apply {
        put("id", doc.id); put("titulo", doc.titulo); put("subtitulo", doc.subtitulo)
        put("tipo", doc.tipo.name); put("situacao", doc.situacao.name); put("estadoNuvem", doc.estadoNuvem.name)
        put("autor", doc.autor); put("ano", doc.ano); put("resumo", doc.resumo)
        put("modificadoEm", doc.modificadoEm); put("disponivelOffline", doc.disponivelOffline)
        put("pastaId", doc.pastaId ?: "")
    }

    private fun documentoDeJson(obj: JSONObject) = Documento(
        id = obj.getString("id"), titulo = obj.optString("titulo", "Sem título"),
        subtitulo = obj.optString("subtitulo"), tipo = TipoDocumento.deString(obj.optString("tipo")),
        situacao = SituacaoDocumento.deString(obj.optString("situacao")),
        estadoNuvem = EstadoNuvem.deString(obj.optString("estadoNuvem")),
        autor = obj.optString("autor"), ano = obj.optInt("ano", 2026),
        resumo = obj.optString("resumo"), modificadoEm = obj.optString("modificadoEm"),
        disponivelOffline = obj.optBoolean("disponivelOffline", true),
        pastaId = obj.optString("pastaId").ifBlank { null }
    )

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
