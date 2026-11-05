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
    private var resumosPendentes: Job? = null
    private var itensZotero: List<ZoteroItem> = emptyList()
    private var itensBib: List<ZoteroItem> = emptyList()
    private var artigosLocais: List<ArtigoEstudoDetalhado> = emptyList()

    fun ativarPersistencia(context: Context) {
        if (contexto != null) return
        contexto = context.applicationContext
        artigosLocais = contexto!!.getSharedPreferences("biblioteca_artigos_locais", Context.MODE_PRIVATE)
            .getString("dados", null)?.let { runCatching { ArtigosLocaisCodec.ler(it) }.getOrNull() }.orEmpty()
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
        if ((itensBib.isNotEmpty() || artigosLocais.isNotEmpty()) && itensZotero.isEmpty())
            aplicarBibliotecaZotero(emptyList(), emptyList())
        val preferencias = contexto!!.getSharedPreferences("tracos_pdf", Context.MODE_PRIVATE)
        val anotacoes = contexto!!.getSharedPreferences("anotacoes_pdf", Context.MODE_PRIVATE)
        val notasZoteroPrefs = contexto!!.getSharedPreferences("notas_zotero", Context.MODE_PRIVATE)
        val resumosPrefs = contexto!!.getSharedPreferences("fichamentos_pdf", Context.MODE_PRIVATE)
        _artigos.value = _artigos.value.map { artigo ->
            val tracos = preferencias.getString(artigo.id, null)?.let { salvo ->
                runCatching { lerTracos(salvo) }.getOrNull()
            } ?: artigo.tracos
            val dados = anotacoes.getString(artigo.id, null)?.let { salvo ->
                runCatching { lerAnotacoes(salvo) }.getOrNull()
            }
            val resumoSalvo = if (artigo.id.startsWith("local_")) null
                else FichamentoResumoCodec.ler(resumosPrefs.getString(artigo.id, null))
            artigo.copy(
                tracos = tracos,
                meuResumo = resumoSalvo?.meuResumo ?: artigo.meuResumo,
                analiseMetodologica = resumoSalvo?.analiseMetodologica ?: artigo.analiseMetodologica,
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

    private fun salvarResumosDepois() {
        val ctx = contexto ?: return
        val estado = _artigos.value.map { it.id to FichamentoResumoCodec.escrever(ResumoFichamento(it.meuResumo, it.analiseMetodologica)) }
        resumosPendentes?.cancel()
        resumosPendentes = persistenciaScope.launch {
            delay(320)
            val editor = ctx.getSharedPreferences("fichamentos_pdf", Context.MODE_PRIVATE).edit()
            estado.forEach { (id, resumo) -> editor.putString(id, resumo) }
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

    fun adicionarArtigoLocal(titulo: String, autores: String, ano: Int, publicacao: String, resumo: String, chaveZotero: String = ""): ArtigoEstudoDetalhado {
        require(titulo.trim().isNotEmpty()) { "Informe o título do artigo." }
        require(ano in 1500..2100) { "Informe um ano válido." }
        val artigo = ArtigoEstudoDetalhado(
            id = "local_${UUID.randomUUID()}", titulo = titulo.trim(), autores = autores.trim(),
            ano = ano, chaveZotero = chaveZotero.trim(), totalPaginas = 0, resumoOficial = resumo.trim(),
            tipoZotero = "journalArticle", camposZotero = mapOf("publicationTitle" to publicacao.trim())
        )
        artigosLocais = listOf(artigo) + artigosLocais
        _artigos.value = listOf(artigo) + _artigos.value
        _artigoAtivoId.value = artigo.id
        salvarArtigosLocais()
        return artigo
    }

    fun atualizarArtigoLocal(id: String, titulo: String, autores: String, ano: Int, publicacao: String, resumo: String, chaveZotero: String): Boolean {
        require(titulo.trim().isNotEmpty()) { "Informe o título do artigo." }
        require(ano in 1500..2100) { "Informe um ano válido." }
        if (artigosLocais.none { it.id == id }) return false
        val alterar: (ArtigoEstudoDetalhado) -> ArtigoEstudoDetalhado = { art ->
            if (art.id != id) art else art.copy(
                titulo = titulo.trim(), autores = autores.trim(), ano = ano,
                resumoOficial = resumo.trim(), chaveZotero = chaveZotero.trim(),
                camposZotero = art.camposZotero + ("publicationTitle" to publicacao.trim())
            )
        }
        artigosLocais = artigosLocais.map(alterar)
        _artigos.value = _artigos.value.map(alterar)
        salvarArtigosLocais()
        return true
    }

    private fun salvarArtigosLocais() {
        contexto?.getSharedPreferences("biblioteca_artigos_locais", Context.MODE_PRIVATE)
            ?.edit()?.putString("dados", ArtigosLocaisCodec.escrever(artigosLocais))?.apply()
    }

    fun excluirArtigoLocal(id: String): Boolean {
        if (artigosLocais.none { it.id == id }) return false
        // Uma gravação adiada anterior não pode recriar as anotações do artigo excluído.
        anotacoesPendentes?.cancel()
        gravacaoPendente?.cancel()
        resumosPendentes?.cancel()
        artigosLocais = artigosLocais.filterNot { it.id == id }
        _artigos.value = _artigos.value.filterNot { it.id == id }
        if (_artigoAtivoId.value == id) _artigoAtivoId.value = _artigos.value.firstOrNull()?.id.orEmpty()
        salvarArtigosLocais()
        contexto?.let { ctx ->
            listOf("pdf_artigos", "anotacoes_pdf", "tracos_pdf", "notas_zotero", "fichamentos_pdf").forEach { nome ->
                ctx.getSharedPreferences(nome, Context.MODE_PRIVATE).edit().remove(id).apply()
            }
        }
        salvarAnotacoesDepois()
        salvarTracosDepois()
        salvarResumosDepois()
        return true
    }

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
        val resumosPrefs = contexto?.getSharedPreferences("fichamentos_pdf", Context.MODE_PRIVATE)
        artigosLocais = artigosLocais.map { anteriores[it.id] ?: it }
        _colecoesZotero.value = colecoes
        val bibliotecaRemota = (itens + itensBib).distinctBy { it.chave }.map { item ->
            val anterior = anteriores[item.chave]
            val resumoSalvo = FichamentoResumoCodec.ler(resumosPrefs?.getString(item.chave, null))
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
                meuResumo = anterior?.meuResumo ?: resumoSalvo?.meuResumo.orEmpty(),
                analiseMetodologica = anterior?.analiseMetodologica ?: resumoSalvo?.analiseMetodologica.orEmpty(),
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
        _artigos.value = artigosLocais + bibliotecaRemota
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
        val encontrado = _artigos.value.find { art ->
            art.id == id || art.chaveZotero == id ||
            (id == "zot_art_01" && art.id == "art_reurb_2025") ||
            (id == "zot_art_02" && art.id == "art_sustentabilidade_2026") ||
            (id == "zot_art_03" && art.id == "art_sustentabilidade_2026")
        }
        if (encontrado != null) {
            _artigoAtivoId.value = encontrado.id
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

    private fun distanciaPontoSegmento(px: Float, py: Float, x1: Float, y1: Float, x2: Float, y2: Float): Float {
        val dx = x2 - x1
        val dy = y2 - y1
        val l2 = dx * dx + dy * dy
        if (l2 == 0f) {
            val dpx = px - x1
            val dpy = py - y1
            return kotlin.math.sqrt(dpx * dpx + dpy * dpy)
        }
        val t = ((px - x1) * dx + (py - y1) * dy) / l2
        val tClamped = t.coerceIn(0f, 1f)
        val projX = x1 + tClamped * dx
        val projY = y1 + tClamped * dy
        val dpx = px - projX
        val dpy = py - projY
        return kotlin.math.sqrt(dpx * dpx + dpy * dpy)
    }

    private fun tracoColideComPonto(traco: TracoDesenho, x: Float, y: Float, raio: Float): Boolean {
        val pts = traco.pontos
        if (pts.isEmpty()) return false

        val tracoEhNormalizado = pts.all { it.x <= 1.05f && it.y <= 1.05f }
        val pontoEhNormalizado = x <= 1.05f && y <= 1.05f && raio <= 0.2f

        val (qx, qy, rEfetivo) = if (pontoEhNormalizado && !tracoEhNormalizado) {
            Triple(x * 840f, y * 1188f, (raio * 840f).coerceAtLeast(18f))
        } else if (!pontoEhNormalizado && tracoEhNormalizado) {
            Triple(x / 840f, y / 1188f, (raio / 840f).coerceAtLeast(0.025f))
        } else {
            Triple(x, y, raio)
        }

        val espessuraAdicional = if (tracoEhNormalizado && pontoEhNormalizado) {
            (traco.espessura / 840f) / 2f
        } else if (!tracoEhNormalizado && !pontoEhNormalizado) {
            traco.espessura / 2f
        } else {
            traco.espessura / 2f
        }
        val limiteColisao = rEfetivo + espessuraAdicional

        if (pts.size == 1) {
            val p = pts[0]
            val dx = p.x - qx
            val dy = p.y - qy
            return (dx * dx + dy * dy) <= (limiteColisao * limiteColisao)
        }

        if (traco.ehLinhaReta && pts.size >= 2) {
            val pIni = pts.first()
            val pFim = pts.last()
            val dist = distanciaPontoSegmento(qx, qy, pIni.x, pIni.y, pFim.x, pFim.y)
            if (dist <= limiteColisao) return true
        }

        for (i in 0 until pts.size - 1) {
            val p1 = pts[i]
            val p2 = pts[i + 1]
            val dist = distanciaPontoSegmento(qx, qy, p1.x, p1.y, p2.x, p2.y)
            if (dist <= limiteColisao) return true
        }

        return false
    }

    fun apagarTracosProximos(artigoId: String, pagina: Int, x: Float, y: Float, raio: Float = 28f) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                val tracosFiltrados = art.tracos.filterNot { traco ->
                    if (traco.pagina != pagina) false
                    else tracoColideComPonto(traco, x, y, raio)
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
        salvarResumosDepois()
        if (artigoId.startsWith("local_")) {
            artigosLocais = artigosLocais.map { art ->
                if (art.id == artigoId) art.copy(meuResumo = meuResumo, analiseMetodologica = analiseMetodologica) else art
            }
            salvarArtigosLocais()
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
                    titulo = if (num == 1) "Folha 1 — Introduction & PBD Framework" else "Folha $num — Performance-Based Acoustic Simulation",
                    qtdRiscos = if (num == 17) 2 else 0,
                    qtdNotas = 0,
                    qtdCitacoes = 0,
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
                        3 -> listOf(
                            "2. Room Acoustic Simulation Methods and Ray-Tracing Models",
                            "Geometrical acoustics (GA) algorithms, such as ray-tracing, image-source and particle tracing methods, offer a computationally viable approach for early stage design iterations compared to wave-based numerical solvers (BEM/FEM).",
                            "By coupling parametric NURBS surfaces in Rhinoceros/Grasshopper with high-efficiency ray-tracing engines, thousands of sound ray trajectories can be simulated in seconds to predict specular and diffuse reflections."
                        )
                        4 -> listOf(
                            "2.1 Acoustic Performance Metrics and Multi-Objective Criteria",
                            "ISO 3382-1 establishes clear quantitative metrics for indoor room acoustics: Reverberation Time (T30 and EDT), Early-to-Late Energy Ratios (Clarity C80 and Definition D50), Sound Strength (G), and Lateral Energy Fraction (LF).",
                            "In concert hall geometry design, optimizing the lateral fraction LF is critical to enhancing the listener's perceived spatial impression (auditory source width - ASW), while maintaining sufficient clarity C80 for orchestral articulation."
                        )
                        5 -> listOf(
                            "3. Parametric Design Workflow and Evolutionary Solvers",
                            "The parametric script developed in Grasshopper translates structural enclosure boundaries into adaptive reflector panels with variable curvature and orientation.",
                            "Genetic algorithms (Galapagos and Octopus) operate over continuous chromosome vectors representing panel inclination angles, spatial coordinates of sound sources, and receiver grid configurations."
                        )
                        6 -> listOf(
                            "3.1 Multi-Objective Pareto Frontiers: Acoustic Quality vs Daylight and Structural Mass",
                            "The trade-off between acoustic reflection efficiency and natural daylight penetration through glazed clerestories forms a distinct Pareto frontier.",
                            "Octopus multi-objective solver allows designers to interactively inspect non-dominated solutions across competing performance domains without collapsing objective weights prematurely."
                        )
                        7 -> listOf(
                            "4. Case Studies: Concert Hall Reflector Canopy Morphology",
                            "A representative 1,200-seat shoebox auditorium was evaluated to assess the performance difference between formation models (manual iterations) and generative algorithmic models.",
                            "The generative model achieved a 38% more uniform sound pressure level distribution across the stalls while reducing the physical weight of suspended reflector arrays by 22%."
                        )
                        8 -> listOf(
                            "4.1 Stage Shell Design and Performers' Acoustic Support (ST1)",
                            "Acoustic feedback on stage, quantified by the ST1 early stage support metric (-14 dB to -10 dB target range), was optimized by introducing micro-articulated timber baffles with quadratic residue diffusion profiles.",
                            "Musicians reported heightened ensemble communication and balanced timbre across string and brass sections in double-blind listening assessments."
                        )
                        else -> listOf(
                            "Seção analítica da folha $num: Validação experimental e convergência numérica.",
                            "Análise comparativa de malhas geométricas e tolerâncias de simulação acústica paramétrica no Grasshopper conforme normas ISO 3382-1 e critérios PBD.",
                            "Os resultados corroboram a viabilidade de pipelines computacionais integrados para projeto arquitetônico de alto desempenho."
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

            val paginasArtigo2 = (1..24).map { num ->
                PaginaPdfInfo(
                    numero = num,
                    titulo = when (num) {
                        1 -> "Folha 1 — Introdução e Referencial Teórico"
                        2 -> "Folha 2 — Análise Espacial e Conformidade Registral"
                        3 -> "Folha 3 — Conclusões e Diretrizes Propositivas"
                        else -> "Folha $num — Regularização Fundiária e Metodologia"
                    },
                    qtdRiscos = 0,
                    qtdNotas = if (num == 1) 1 else 0,
                    qtdCitacoes = if (num == 1) 1 else if (num == 2) 1 else 0,
                    paragrafos = when (num) {
                        1 -> listOf(
                            "RESUMO: Este artigo analisa os instrumentos técnicos e jurídicos de regularização fundiária urbana aplicados a núcleos urbanos informais consolidados, propondo diretrizes para integração entre levantamento de campo, cadastro multifinalitário e titulação registral.",
                            "1. INTRODUÇÃO: O crescimento acelerado das cidades latino-americanas produziu tecidos urbanos heterogêneos nos quais a consolidação física precedeu a formalização cartorial. Nesse contexto, a segurança jurídica da posse depende diretamente da precisão geométrica e da rastreabilidade social do cadastro territorial.",
                            "Historicamente, os projetos de urbanização enfrentaram gargalos severos na transição entre o diagnóstico socioespacial e a abertura de matrículas individualizadas. Quando os fluxos de desenho urbano e documentação jurídica operam em ferramentas desconectadas, multiplicam-se as inconsistências entre quadras, lotes e logradouros.",
                            "2. REFERENCIAL METODOLÓGICO: Propomos uma arquitetura integrada em que cada unidade imobiliária mantém vínculo unívoco entre sua geometria projetada em projeção UTM (SIRGAS 2000) e os respectivos instrumentos de legitimação fundiária."
                        )
                        2 -> listOf(
                            "3. ANÁLISE ESPACIAL E CONFORMIDADE REGISTRAL: Os dados empíricos coletados ao longo de 24 meses revelam que a dissociação entre a planta de parcelamento e os memoriais descritivos é a principal causa de notas devolutivas no registro de imóveis, respondendo por 58,4% dos atrasos processuais.",
                            "Na Tabela 1 do estudo original, observa-se que municípios que adotaram validação topológica contínua e geração paramétrica de peças técnicas reduziram o retrabalho editorial em mais de dois terços.",
                            "Além disso, o emprego de simbologia cartográfica padronizada e quadros síntese vinculados diretamente à base alfanumérica permitiu que equipes multidisciplinares (arquitetos, engenheiros, assistentes sociais e juristas) revisassem os relatórios em tempo real."
                        )
                        3 -> listOf(
                            "4. CONCLUSÕES E DIRETRIZES PARA POLÍTICAS PÚBLICAS: Conclui-se que a modernização dos procedimentos de regularização fundiária exige ambientes colaborativos capazes de unir rigor tipográfico (ABNT), gestão bibliográfica estruturada e interoperabilidade com acervos em nuvem.",
                            "Trabalhos futuros devem explorar a leitura compartilhada de laudos e artigos técnicos com camadas de anotação vetorial não destrutiva, preservando os arquivos originais no armazenamento em nuvem do pesquisador."
                        )
                        4 -> listOf(
                            "5. DIAGNÓSTICO SOCIOESPACIAL E LEVANTAMENTO TOPOGRÁFICO CADASTRAL",
                            "A demarcação urbanística inicia-se pela identificação precisa do perímetro de ocupação consolidada através de imagens de sensoriamento remoto de alta resolução e rastreamento GNSS geodésico.",
                            "Cada lote cadastrado recebe um identificador único de cadastro (CUI) vinculado a uma matriz de atributos alfanuméricos com perfil do titular, composição familiar e histórico de ocupação."
                        )
                        5 -> listOf(
                            "5.1 Validação Topológica em Banco de Dados Espacial (PostGIS)",
                            "Garantir a ausência de sobreposições (st_overlaps) e lacunas indevidas entre lotes e faixas de domínio público é pré-requisito mandatório para a qualificação registral da planta de parcelamento.",
                            "A automatização das rotinas de checagem topológica reduz a incidência de impugnações de confrontantes e acelera a tramitação perante a comissão municipal de REURB."
                        )
                        6 -> listOf(
                            "6. PROJETO DE REGULARIZAÇÃO FUNDIÁRIA (PRF) E MEMORIAIS DESCRITIVOS",
                            "O memorial descritivo paramétrico calcula azimutes, rumos, distâncias métricas e confrontações com base nas coordenadas de vértices do parcelamento aprovado.",
                            "A integração direta entre a cartografia vetorial e o motor editorial elimina divergências de digitação e garante conformidade estrita com o Provimento nº 144/2023 do CNJ."
                        )
                        else -> listOf(
                            "Seção $num: Diretrizes técnicas e jurídicas de regularização fundiária urbana (Lei Federal 13.465/2017).",
                            "Análise de conformidade urbanística, parâmetros de parcelamento do solo e diretrizes ambientais para consolidação de núcleos habitacionais em áreas de preservação.",
                            "Procedimentos integrados de expedição de Certidão de Regularização Fundiária (CRF) e titulação imobiliária coletiva e individual."
                        )
                    }
                )
            }

            val artigo2 = ArtigoEstudoDetalhado(
                id = "art_reurb_2025",
                titulo = "Regularização Fundiária Urbana e Morfologia de Assentamentos Consolidados na América Latina",
                autores = "SANTOS & RIBEIRO, 2025",
                ano = 2025,
                chaveZotero = "ZOT8K2M9",
                totalPaginas = 24,
                resumoOficial = "Este artigo analisa os instrumentos técnicos e jurídicos de regularização fundiária urbana (REURB-S e REURB-E) aplicados a núcleos urbanos informais consolidados, propondo diretrizes para integração entre levantamento aerofotogramétrico, cadastro multifinalitário e titulação.",
                meuResumo = "Artigo fundamental para a seção de Metodologia. Demonstra que a integração entre banco territorial (PostGIS) e peças técnicas automatizadas reduz em 64% o tempo de emissão da CRF.",
                analiseMetodologica = "Estudo comparativo em 14 núcleos urbanos com uso de poligonais georreferenciadas SIRGAS 2000 / UTM e validação topológica prévia.",
                tags = listOf("REURB", "Morfologia Urbana", "Cadastro Territorial", "PostGIS", "SIG"),
                paginas = paginasArtigo2,
                citacoes = listOf(
                    CitacaoMarcada(
                        id = "cit_1",
                        pagina = 1,
                        texto = "A segurança jurídica da posse depende diretamente da precisão geométrica e da rastreabilidade social do cadastro territorial.",
                        comentario = "Usar na Introdução (parágrafo 3) para fundamentar a escolha metodológica.",
                        referenciaAbnt = "(SANTOS; RIBEIRO, 2025, p. 1)",
                        corHex = "#FACC15"
                    ),
                    CitacaoMarcada(
                        id = "cit_2",
                        pagina = 2,
                        texto = "A dissociação entre a planta de parcelamento e os memoriais descritivos é a principal causa de notas devolutivas no registro de imóveis.",
                        comentario = "Excelente argumento para justificar o motor paramétrico do Athenes.",
                        referenciaAbnt = "(SANTOS; RIBEIRO, 2025, p. 2)",
                        corHex = "#059669"
                    )
                ),
                notas = listOf(
                    NotaAdesiva(
                        id = "pin_1",
                        pagina = 1,
                        xPct = 62f,
                        yPct = 30f,
                        titulo = "Destaque do Orientador",
                        texto = "Conferir como os autores definem o índice de consolidação viária na p. 115.",
                        corHex = "#D97706"
                    )
                ),
                zoteroConfig = ZoteroVinculoConfig(
                    apiKey = "",
                    userId = "",
                    itemKey = "ZOT8K2M9",
                    doi = "10.22296/2317-1529.rbeur.2025v27n2p114",
                    driveStatus = "Sincronizado no Google Drive",
                    driveFileName = "Santos_Ribeiro_2025_REURB_Morfologia.pdf",
                    driveFileId = "drive_pdf_reurb_2025"
                )
            )

            val paginasArtigo3 = (1..18).map { num ->
                PaginaPdfInfo(
                    numero = num,
                    titulo = when (num) {
                        1 -> "Folha 1 — Colaboração e Conflitos na Edição Científica"
                        2 -> "Folha 2 — Leitura Ativa e Fichamento Zotero"
                        else -> "Folha $num — Sistemas Distribuídos e Editoração"
                    },
                    qtdRiscos = 0,
                    qtdNotas = 0,
                    qtdCitacoes = if (num == 1) 1 else 0,
                    paragrafos = when (num) {
                        1 -> listOf(
                            "ABSTRACT: A escrita científica contemporânea é intrinsecamente colaborativa. Todavia, ferramentas tradicionais forçam pesquisadores a escolher entre controle tipográfico preciso (LaTeX/DTP) e colaboração fácil em nuvem.",
                            "1. PROBLEMA DE PESQUISA: A combinação de presença síncrona com sugestões granulares de inserção e exclusão reduz a fricção cognitiva durante a revisão entre orientador e orientando, mantendo o histórico decisório transparente.",
                            "2. ARQUITETURA EM BLOCOS: Quando o documento é modelado como uma sequência de seções mestras e blocos semânticos (títulos, parágrafos, figuras compostas, tabelas ABNT e equações), a resolução de conflitos torna-se determinística."
                        )
                        2 -> listOf(
                            "3. INTEGRAÇÃO COM BIBLIOTECAS DE REFERÊNCIAS E ANOTAÇÃO DE PDF: Observamos que 78% dos pesquisadores realizam a leitura e o grifo de artigos em PDF separadamente do ambiente de redação, perdendo o vínculo entre os trechos riscados no PDF e as citações inseridas no manuscrito.",
                            "A unificação do estúdio de leitura de PDF (com tinta digital estilo tablet e armazenamento direto no Drive pessoal do autor) ao gerenciador Zotero elimina a duplicação de arquivos pesados e preserva todas as marcações na nuvem."
                        )
                        3 -> listOf(
                            "4. ESTRUTURAS CRDT PARA TIPOGRAFIA E PAGINAÇÃO EDITORIAL",
                            "Tipos de dados replicados sem conflito (Conflict-free Replicated Data Types - CRDTs) garantem eventual consistência entre clientes distribuídos sem a necessidade de coordenadores centrais com bloqueio pessimista.",
                            "A decomposição do manuscrito em árvores causais associadas a identificadores fracionários viabiliza a ordenação imutável de parágrafos e citações sob conexões intermitentes."
                        )
                        4 -> listOf(
                            "4.1 Modos de Trabalho: Rascunho, Sugestão e Revisão Final",
                            "Inspirado nos ciclos de revisão editorial clássicos, o sistema permite que o orientador registre sugestões pontuais de edição sem destruir o texto original do autor discente.",
                            "A aprovação ou rejeição de alterações opera sobre operações de tombstone rastreáveis no grafo de versões, fornecendo prestação de contas integral para publicações submetidas a periódicos indexados."
                        )
                        else -> listOf(
                            "Seção analítica da folha $num: Protocolos de sincronização em tempo real via WebSockets e canais peer-to-peer.",
                            "Análise de latência, tolerância a falhas e desempenho de renderização vetorial de PDFs acadêmicos com aceleração gráfica em tablets de alta densidade.",
                            "Convergência entre rigor normativo ABNT, gerenciamento bibliográfico estruturado e portabilidade em formatos abertos."
                        )
                    }
                )
            }

            val artigo3 = ArtigoEstudoDetalhado(
                id = "art_sustentabilidade_2026",
                titulo = "Sistemas Colaborativos CRDT e Editoração Científica em Tempo Real na Web Moderna",
                autores = "KLEPPMANN & ALMEIDA, 2024",
                ano = 2024,
                chaveZotero = "ZOT4P9L2",
                totalPaginas = 18,
                resumoOficial = "Investigação sobre estruturas de dados livres de conflito (CRDTs) e canais de presença em tempo real aplicados à escrita acadêmica distribuída entre orientadores e pesquisadores.",
                meuResumo = "Explica como combinar edição em tempo real com modos de revisão assíncrona (Sugestão com Aceitar/Rejeitar) sem perda de formatação tipográfica.",
                analiseMetodologica = "Avaliação com 42 grupos de pesquisa universitários utilizando documentos estruturados em blocos.",
                tags = listOf("CRDT", "Colaboração Síncrona", "Editoração Acadêmica", "WebSockets"),
                paginas = paginasArtigo3,
                citacoes = listOf(
                    CitacaoMarcada(
                        id = "cit_201",
                        pagina = 1,
                        texto = "A combinação de presença síncrona com sugestões granulares de inserção e exclusão reduz a fricção cognitiva durante a revisão entre orientador e orientando.",
                        comentario = "Citar na seção sobre o fluxo de revisão colaborativa.",
                        referenciaAbnt = "(KLEPPMANN; ALMEIDA, 2024, p. 1)",
                        corHex = "#314F79"
                    )
                ),
                notas = emptyList(),
                zoteroConfig = ZoteroVinculoConfig(
                    apiKey = "",
                    userId = "",
                    itemKey = "ZOT4P9L2",
                    doi = "10.1145/3612345.3612399",
                    driveStatus = "Sincronizado no Google Drive",
                    driveFileName = "Kleppmann_Almeida_2024_CRDT_Academic_Publishing.pdf",
                    driveFileId = "drive_pdf_crdt_2024"
                )
            )

            return listOf(artigo1, artigo2, artigo3)
        }
    }
}
