package com.athenes.core.data

import android.content.Context
import com.athenes.core.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

class ArtigoEstudoRepository {

    private var contexto: Context? = null
    private val persistenciaScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var gravacaoPendente: Job? = null
    private var anotacoesPendentes: Job? = null
    private var itensZotero: List<ZoteroItem> = emptyList()
    private var itensBib: List<ZoteroItem> = emptyList()

    fun ativarPersistencia(context: Context) {
        if (contexto != null) return
        contexto = context.applicationContext
        itensBib = contexto!!.getSharedPreferences("biblioteca_bib", Context.MODE_PRIVATE)
            .getString("dados", null)?.let { salvo ->
                runCatching { ZoteroCacheCodec.ler(salvo).first }.getOrNull()
            }.orEmpty()
        contexto!!.getSharedPreferences("biblioteca_zotero", Context.MODE_PRIVATE)
            .getString("dados", null)?.let { salvo ->
                runCatching { ZoteroCacheCodec.ler(salvo) }.getOrNull()?.let { (itens, colecoes) ->
                    if (itens.isNotEmpty() || itensBib.isNotEmpty()) aplicarBibliotecaZotero(itens, colecoes)
                }
            }
        if (itensBib.isNotEmpty() && itensZotero.isEmpty()) aplicarBibliotecaZotero(emptyList(), emptyList())
        val preferencias = contexto!!.getSharedPreferences("tracos_pdf", Context.MODE_PRIVATE)
        val anotacoes = contexto!!.getSharedPreferences("anotacoes_pdf", Context.MODE_PRIVATE)
        val notasZoteroPrefs = contexto!!.getSharedPreferences("notas_zotero", Context.MODE_PRIVATE)
        _artigos.value = _artigos.value.map { artigo ->
            val tracos = preferencias.getString(artigo.id, null)?.let { salvo ->
                runCatching { lerTracos(salvo) }.getOrNull()
            } ?: artigo.tracos
            val dados = anotacoes.getString(artigo.id, null)?.let { salvo ->
                runCatching { lerAnotacoes(salvo) }.getOrNull()
            }
            artigo.copy(
                tracos = tracos,
                notas = dados?.first ?: artigo.notas,
                citacoes = dados?.second ?: artigo.citacoes,
                notasZotero = notasZoteroPrefs.getString(artigo.id, null)?.let { salvo ->
                    runCatching {
                        val array = JSONArray(salvo)
                        (0 until array.length()).map { i ->
                            val nota = array.getJSONObject(i)
                            NotaZoteroImportada(nota.getString("id"), nota.getString("texto"))
                        }
                    }.getOrNull()
                } ?: artigo.notasZotero
            )
        }
    }

    private fun salvarAnotacoesDepois() {
        val ctx = contexto ?: return
        val estado = _artigos.value.map { it.id to serializarAnotacoes(it.notas, it.citacoes) }
        anotacoesPendentes?.cancel()
        anotacoesPendentes = persistenciaScope.launch {
            delay(400)
            val editor = ctx.getSharedPreferences("anotacoes_pdf", Context.MODE_PRIVATE).edit()
            estado.forEach { (id, conteudo) -> editor.putString(id, conteudo) }
            editor.apply()
        }
    }

    internal fun serializarAnotacoes(notas: List<NotaAdesiva>, citacoes: List<CitacaoMarcada>): String = JSONObject().apply {
        put("notas", JSONArray().apply {
            notas.forEach { nota -> put(JSONObject().apply {
                put("id", nota.id); put("pagina", nota.pagina)
                put("xPct", nota.xPct.toDouble()); put("yPct", nota.yPct.toDouble())
                put("titulo", nota.titulo); put("texto", nota.texto)
                put("corHex", nota.corHex); put("autor", nota.autor)
            }) }
        })
        put("citacoes", JSONArray().apply {
            citacoes.forEach { citacao -> put(JSONObject().apply {
                put("id", citacao.id); put("pagina", citacao.pagina)
                put("texto", citacao.texto); put("comentario", citacao.comentario)
                put("referenciaAbnt", citacao.referenciaAbnt)
                put("corHex", citacao.corHex); put("criadoEm", citacao.criadoEm)
            }) }
        })
    }.toString()

    internal fun lerAnotacoes(json: String): Pair<List<NotaAdesiva>, List<CitacaoMarcada>> {
        val dados = JSONObject(json)
        val notas = dados.getJSONArray("notas").let { array -> (0 until array.length()).map { indice ->
            val item = array.getJSONObject(indice)
            NotaAdesiva(
                id = item.getString("id"), pagina = item.getInt("pagina"),
                xPct = item.getDouble("xPct").toFloat(), yPct = item.getDouble("yPct").toFloat(),
                titulo = item.getString("titulo"), texto = item.getString("texto"),
                corHex = item.getString("corHex"), autor = item.getString("autor")
            )
        } }
        val citacoes = dados.getJSONArray("citacoes").let { array -> (0 until array.length()).map { indice ->
            val item = array.getJSONObject(indice)
            CitacaoMarcada(
                id = item.getString("id"), pagina = item.getInt("pagina"),
                texto = item.getString("texto"), comentario = item.getString("comentario"),
                referenciaAbnt = item.getString("referenciaAbnt"),
                corHex = item.getString("corHex"), criadoEm = item.getString("criadoEm")
            )
        } }
        return notas to citacoes
    }

    private fun salvarTracosDepois() {
        val ctx = contexto ?: return
        val estado = _artigos.value.map { it.id to it.tracos }
        gravacaoPendente?.cancel()
        gravacaoPendente = persistenciaScope.launch {
            delay(400)
            val editor = ctx.getSharedPreferences("tracos_pdf", Context.MODE_PRIVATE).edit()
            estado.forEach { (id, tracos) -> editor.putString(id, serializarTracos(tracos)) }
            editor.apply()
        }
    }

    internal fun serializarTracos(tracos: List<TracoDesenho>): String = JSONArray().apply {
        tracos.forEach { traco ->
            put(JSONObject().apply {
                put("id", traco.id)
                put("pagina", traco.pagina)
                put("corHex", traco.corHex)
                put("espessura", traco.espessura.toDouble())
                put("ehLinhaReta", traco.ehLinhaReta)
                put("ehMarcaTexto", traco.ehMarcaTexto)
                put("pontos", JSONArray().apply {
                    traco.pontos.forEach { ponto -> put(JSONArray().put(ponto.x.toDouble()).put(ponto.y.toDouble())) }
                })
            })
        }
    }.toString()

    internal fun lerTracos(json: String): List<TracoDesenho> {
        val array = JSONArray(json)
        return (0 until array.length()).map { indice ->
            val item = array.getJSONObject(indice)
            val pontos = item.getJSONArray("pontos")
            TracoDesenho(
                id = item.getString("id"),
                pagina = item.getInt("pagina"),
                corHex = item.getString("corHex"),
                espessura = item.getDouble("espessura").toFloat(),
                ehLinhaReta = item.optBoolean("ehLinhaReta"),
                ehMarcaTexto = item.optBoolean("ehMarcaTexto"),
                pontos = (0 until pontos.length()).map { p ->
                    val par = pontos.getJSONArray(p)
                    PontoTraco(par.getDouble(0).toFloat(), par.getDouble(1).toFloat())
                }
            )
        }
    }

    private val _artigos = MutableStateFlow<List<ArtigoEstudoDetalhado>>(obterArtigosIniciais())
    val artigos: StateFlow<List<ArtigoEstudoDetalhado>> = _artigos.asStateFlow()
    private val _colecoesZotero = MutableStateFlow<List<ZoteroColecao>>(emptyList())
    val colecoesZotero: StateFlow<List<ZoteroColecao>> = _colecoesZotero.asStateFlow()

    fun importarBib(conteudo: String): Int {
        val importados = BibtexParser.ler(conteudo)
        require(importados.isNotEmpty()) { "O arquivo BIB não contém referências válidas." }
        itensBib = (itensBib + importados).associateBy { it.chave }.values.toList()
        contexto?.getSharedPreferences("biblioteca_bib", Context.MODE_PRIVATE)
            ?.edit()?.putString("dados", ZoteroCacheCodec.escrever(itensBib, emptyList()))?.apply()
        aplicarBibliotecaZotero(itensZotero, _colecoesZotero.value)
        return importados.size
    }

    fun aplicarBibliotecaZotero(itens: List<ZoteroItem>, colecoes: List<ZoteroColecao>) {
        itensZotero = itens
        val anteriores = _artigos.value.associateBy { it.id }
        _colecoesZotero.value = colecoes
        _artigos.value = (itens + itensBib).distinctBy { it.chave }.map { item ->
            val anterior = anteriores[item.chave]
            val ano = Regex("(?:19|20)\\d{2}").find(item.data)?.value?.toIntOrNull() ?: 0
            ArtigoEstudoDetalhado(
                id = item.chave,
                titulo = item.titulo,
                autores = item.autores.joinToString(", ") { criador ->
                    listOf(criador.nome, criador.sobrenome).filter(String::isNotBlank).joinToString(" ")
                }.ifBlank { "Autor não informado" },
                ano = ano,
                chaveZotero = item.chave,
                totalPaginas = anterior?.totalPaginas ?: 0,
                resumoOficial = item.resumo,
                meuResumo = anterior?.meuResumo.orEmpty(),
                analiseMetodologica = anterior?.analiseMetodologica.orEmpty(),
                tags = item.tags,
                paginas = anterior?.paginas.orEmpty(),
                citacoes = anterior?.citacoes.orEmpty(),
                notas = anterior?.notas.orEmpty(),
                notasZotero = anterior?.notasZotero.orEmpty(),
                tracos = anterior?.tracos.orEmpty(),
                tipoZotero = item.tipo,
                camposZotero = item.campos,
                criadoresZotero = item.autores.map { ZoteroCriadorInfo(it.funcao, it.nome, it.sobrenome) },
                colecoesZotero = item.colecoes,
                zoteroConfig = anterior?.zoteroConfig?.copy(itemKey = item.chave)
                    ?: ZoteroVinculoConfig(itemKey = item.chave, doi = item.doi)
            )
        }
        if (_artigos.value.isNotEmpty() && _artigos.value.none { it.id == _artigoAtivoId.value }) {
            _artigoAtivoId.value = _artigos.value.first().id
        }
        contexto?.getSharedPreferences("biblioteca_zotero", Context.MODE_PRIVATE)
            ?.edit()?.putString("dados", ZoteroCacheCodec.escrever(itens, colecoes))?.apply()
    }

    fun importarNotasAnotacoesZotero(artigoId: String, importacao: ZoteroImportacao): Pair<Int, Int> {
        var novasNotas = 0
        var novasCitacoes = 0
        _artigos.value = _artigos.value.map { artigo ->
            if (artigo.id != artigoId) return@map artigo
            val notasExistentes = artigo.notasZotero.map { it.id }.toMutableSet()
            val citacoesExistentes = artigo.citacoes.map { it.id }.toMutableSet()
            val notasNovas = mutableListOf<NotaZoteroImportada>()
            val citacoesNovas = mutableListOf<CitacaoMarcada>()
            importacao.notas.forEach { nota ->
                val id = "zot_nota_${nota.chave}"
                if (nota.texto.isNotBlank() && notasExistentes.add(id)) notasNovas += NotaZoteroImportada(id, nota.texto)
            }
            importacao.anotacoes.forEach { anotacao ->
                if (anotacao.texto.isNotBlank()) {
                    val id = "zot_ann_${anotacao.chave}"
                    if (citacoesExistentes.add(id)) citacoesNovas += CitacaoMarcada(
                        id = id, pagina = anotacao.pagina, texto = anotacao.texto,
                        comentario = anotacao.comentario, corHex = anotacao.corHex
                    )
                } else if (anotacao.comentario.isNotBlank()) {
                    val id = "zot_nota_${anotacao.chave}"
                    if (notasExistentes.add(id)) notasNovas += NotaZoteroImportada(id, anotacao.comentario)
                }
            }
            novasNotas = notasNovas.size
            novasCitacoes = citacoesNovas.size
            artigo.copy(notasZotero = artigo.notasZotero + notasNovas, citacoes = artigo.citacoes + citacoesNovas)
        }
        if (novasCitacoes > 0) salvarAnotacoesDepois()
        if (novasNotas > 0) {
            val ctx = contexto
            val artigo = _artigos.value.find { it.id == artigoId }
            if (ctx != null && artigo != null) {
                val dados = JSONArray(artigo.notasZotero.map { JSONObject().put("id", it.id).put("texto", it.texto) })
                ctx.getSharedPreferences("notas_zotero", Context.MODE_PRIVATE).edit().putString(artigoId, dados.toString()).apply()
            }
        }
        return novasNotas to novasCitacoes
    }

    private val _artigoAtivoId = MutableStateFlow<String>(_artigos.value.first().id)
    val artigoAtivoId: StateFlow<String> = _artigoAtivoId.asStateFlow()

    fun obterArtigoAtivo(): ArtigoEstudoDetalhado {
        return _artigos.value.find { it.id == _artigoAtivoId.value } ?: _artigos.value.first()
    }

    fun selecionarArtigo(id: String) {
        if (_artigos.value.any { it.id == id }) {
            _artigoAtivoId.value = id
        }
    }

    fun adicionarCitacao(artigoId: String, citacao: CitacaoMarcada) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(citacoes = art.citacoes + citacao)
            } else art
        }
        salvarAnotacoesDepois()
    }

    fun removerCitacao(artigoId: String, citacaoId: String) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(citacoes = art.citacoes.filterNot { it.id == citacaoId })
            } else art
        }
        salvarAnotacoesDepois()
    }

    fun adicionarNota(artigoId: String, nota: NotaAdesiva) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(notas = art.notas + nota)
            } else art
        }
        salvarAnotacoesDepois()
    }

    fun removerNota(artigoId: String, notaId: String) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(notas = art.notas.filterNot { it.id == notaId })
            } else art
        }
        salvarAnotacoesDepois()
    }

    fun adicionarTraco(artigoId: String, traco: TracoDesenho) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(tracos = art.tracos + traco)
            } else art
        }
        salvarTracosDepois()
    }

    fun desfazerUltimoTraco(artigoId: String, pagina: Int) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                val tracosPagina = art.tracos.filter { it.pagina == pagina }
                if (tracosPagina.isNotEmpty()) {
                    val ultimo = tracosPagina.last()
                    art.copy(tracos = art.tracos.filterNot { it.id == ultimo.id })
                } else art
            } else art
        }
        salvarTracosDepois()
    }

    fun limparTracosPagina(artigoId: String, pagina: Int) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(tracos = art.tracos.filterNot { it.pagina == pagina })
            } else art
        }
        salvarTracosDepois()
    }

    fun apagarTracosProximos(artigoId: String, pagina: Int, x: Float, y: Float, raio: Float = 28f) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                val tracosFiltrados = art.tracos.filterNot { traco ->
                    if (traco.pagina != pagina) false
                    else {
                        traco.pontos.any { p ->
                            val dx = p.x - x
                            val dy = p.y - y
                            (dx * dx + dy * dy) <= (raio * raio)
                        }
                    }
                }
                art.copy(tracos = tracosFiltrados)
            } else art
        }
        salvarTracosDepois()
    }

    fun atualizarResumos(artigoId: String, meuResumo: String, analiseMetodologica: String) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(meuResumo = meuResumo, analiseMetodologica = analiseMetodologica)
            } else art
        }
    }

    fun atualizarConfigZotero(artigoId: String, config: ZoteroVinculoConfig) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(zoteroConfig = config)
            } else art
        }
    }

    companion object {
        /** Instância única do processo: Home, Leitura e Citar do editor enxergam o mesmo acervo e as mesmas anotações. */
        val compartilhado: ArtigoEstudoRepository by lazy { ArtigoEstudoRepository() }

        fun obterArtigosIniciais(): List<ArtigoEstudoDetalhado> {
            val paginasArtigo1 = (1..33).map { num ->
                PaginaPdfInfo(
                    numero = num,
                    titulo = "Folha do PDF",
                    qtdRiscos = if (num == 1) 0 else if (num == 17) 2 else 0,
                    qtdNotas = if (num == 1) 0 else if (num == 17) 1 else 0,
                    qtdCitacoes = if (num == 17) 1 else 0,
                    paragrafos = when (num) {
                        1 -> listOf(
                            "Architecture, PBD benefits both design workflow and outcome, allowing one to control the performance of the design proposal since early design phases. The paper aims to explore its current application in the acoustic field, where its potential is still little exploited in architectural practice.",
                            "Keywords: performance-based design; acoustic design; digital workflow; architectural design; design optimization; form-finding",
                            "1. Introduction\n1.1. Performance-based Design\nArchitectural problems generally combine a great multitude of objectives, which pertain to different fields, such as cultural, aesthetic, economic, structural and energetic ones. As these objectives often contrast with each other, it is crucial for the design team to find the most favorable solution in overall terms.",
                            "However, in the recent years, another approach has gained popularity, according to which performance simulations are used to drive the design process. This approach is known as performance-based design (PBD). Pertinent information on one or more performance aspects is gathered since early design phases, and the proposals are iteratively optimized based on the performance feedbacks.",
                            "Adequate technical skills are required in manual processes, since the success of the optimization greatly relies on the correct understanding of the relations between design features and performance. However, the time and manpower required in the processes may limit the number of iterations pursued and the effectiveness of the design optimization."
                        )
                        2 -> listOf(
                            "Acoustics considerations, pertinent information on quantifiable performances can greatly support decision-making processes in the conceptual design stages.",
                            "In early design phases, designers consider a wide range of possible design solutions. Design decisions made at this stage have the greatest impact on the final performance, while late-time design adjustments can rarely compensate poor decisions made in early stages [5-8].",
                            "The PBD method can be subdivided into two subclasses according to the way the design optimization process is conducted. In 'formation models' the modifications are applied manually by the operator, while in 'generative models' the design is generated directly and optimized by the computer.",
                            "Adequate technical skills are required in manual processes, since the success of the optimization greatly relies on the correct understanding of the relations between design features and performance [2]. However, the time and manpower required in the processes may limit the number of iterations pursued and the effectiveness of the design optimization [1,23].",
                            "On the other hand, generative models allow one to explore a wide number of design options with a limited involvement of the operator, exploiting the functionalities of optimization tools (e.g., Galapagos [24] and Octopus [25]) [1,2,18,26]."
                        )
                        else -> listOf(
                            "Seção analítica da página $num com discussões paramétricas, equações de propagação sonora e simulação computacional integrada.",
                            "Resultados obtidos através de amostragem acústica no solver evolutivo integrado à modelagem tridimensional."
                        )
                    }
                )
            }

            val artigo1 = ArtigoEstudoDetalhado(
                id = "art_radino_2020",
                titulo = "Acoustic Performance-Based Design: A Brief Overview of the Opportunities and Limits in Current Practice",
                autores = "RADINO",
                ano = 2020,
                chaveZotero = "",
                totalPaginas = 33,
                resumoOficial = "Architecture, PBD benefits both design workflow and outcome, allowing one to control the performance of the design proposal since early design phases. The paper aims to explore its current application in the acoustic field, where its potential is still little exploited in architectural practice.",
                meuResumo = "Síntese dos principais achados sobre o uso de simulação acústica paramétrica integrada ao Grasshopper e solver evolutivo (Galapagos). Aponta os limites de tempo de processamento e a necessidade de interoperabilidade entre modelos geométricos e ferramentas de análise.",
                analiseMetodologica = "Levantamento de estudos de caso e análise comparativa de workflows paramétricos integrados no Rhinoceros/Grasshopper com algoritmos genéticos.",
                tags = listOf("Performance-Based Design", "Acústica", "Grasshopper", "Galapagos", "Otimização"),
                paginas = paginasArtigo1,
                citacoes = emptyList(),
                notas = emptyList(),
                zoteroConfig = ZoteroVinculoConfig(
                    apiKey = "",
                    userId = "",
                    itemKey = "",
                    doi = "10.3390/buildings10020036",
                    driveStatus = "Não conectado",
                    driveFileName = "",
                    driveFileId = ""
                )
            )

            val artigo2 = ArtigoEstudoDetalhado(
                id = "art_reurb_2025",
                titulo = "Regularização Fundiária Urbana e Morfologia de Assentamentos Consolidados na América Latina",
                autores = "SANTOS & RIBEIRO, 2025",
                ano = 2025,
                chaveZotero = "ZOT8K2M9",
                totalPaginas = 24,
                resumoOficial = "Este artigo analisa os instrumentos técnicos e jurídicos de regularização fundiária urbana aplicados a núcleos urbanos informais consolidados.",
                meuResumo = "Artigo fundamental para a seção de Metodologia. Demonstra que a integração entre banco territorial e peças técnicas automatizadas reduz em 64% o tempo de emissão da CRF.",
                analiseMetodologica = "Estudo comparativo em 14 núcleos urbanos com poligonais georreferenciadas SIRGAS 2000 / UTM.",
                tags = listOf("REURB", "Morfologia Urbana", "PostGIS", "SIG"),
                paginas = (1..24).map { PaginaPdfInfo(numero = it) },
                citacoes = emptyList(),
                notas = emptyList()
            )

            val artigo3 = ArtigoEstudoDetalhado(
                id = "art_sustentabilidade_2026",
                titulo = "Análise Espacial e Diretrizes de Reurbanização Sustentável",
                autores = "SILVA & LIMA, 2026",
                ano = 2026,
                chaveZotero = "ZOT4P9L2",
                totalPaginas = 18,
                resumoOficial = "Estudo de escopo e proposições metodológicas para comunidades consolidadas com foco em eficiência energética e microclima.",
                meuResumo = "Fundamenta a relevância de diagnósticos de conforto térmico e drenagem sustentável.",
                analiseMetodologica = "Modelagem estatística espacial e sensoriamento remoto de alta resolução.",
                tags = listOf("Sustentabilidade", "Conforto Térmico", "Microclima"),
                paginas = (1..18).map { PaginaPdfInfo(numero = it) },
                citacoes = emptyList(),
                notas = emptyList()
            )

            return listOf(artigo1, artigo2, artigo3)
        }
    }
}
