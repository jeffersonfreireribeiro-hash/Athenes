package com.athenes.core.data

import com.athenes.core.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

class ArtigoEstudoRepository {

    private val _artigos = MutableStateFlow<List<ArtigoEstudoDetalhado>>(obterArtigosIniciais())
    val artigos: StateFlow<List<ArtigoEstudoDetalhado>> = _artigos.asStateFlow()

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
    }

    fun removerCitacao(artigoId: String, citacaoId: String) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(citacoes = art.citacoes.filterNot { it.id == citacaoId })
            } else art
        }
    }

    fun adicionarNota(artigoId: String, nota: NotaAdesiva) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(notas = art.notas + nota)
            } else art
        }
    }

    fun removerNota(artigoId: String, notaId: String) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(notas = art.notas.filterNot { it.id == notaId })
            } else art
        }
    }

    fun adicionarTraco(artigoId: String, traco: TracoDesenho) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(tracos = art.tracos + traco)
            } else art
        }
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
    }

    fun limparTracosPagina(artigoId: String, pagina: Int) {
        _artigos.value = _artigos.value.map { art ->
            if (art.id == artigoId) {
                art.copy(tracos = art.tracos.filterNot { it.pagina == pagina })
            } else art
        }
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
                chaveZotero = "JKCLFWH6",
                totalPaginas = 33,
                resumoOficial = "Architecture, PBD benefits both design workflow and outcome, allowing one to control the performance of the design proposal since early design phases. The paper aims to explore its current application in the acoustic field, where its potential is still little exploited in architectural practice.",
                meuResumo = "Síntese dos principais achados sobre o uso de simulação acústica paramétrica integrada ao Grasshopper e solver evolutivo (Galapagos). Aponta os limites de tempo de processamento e a necessidade de interoperabilidade entre modelos geométricos e ferramentas de análise.",
                analiseMetodologica = "Levantamento de estudos de caso e análise comparativa de workflows paramétricos integrados no Rhinoceros/Grasshopper com algoritmos genéticos.",
                tags = listOf("Performance-Based Design", "Acústica", "Grasshopper", "Galapagos", "Otimização"),
                paginas = paginasArtigo1,
                citacoes = listOf(
                    CitacaoMarcada(
                        id = "cit_radino_17",
                        pagina = 17,
                        texto = "'s (Figure 12). The design process was enabled by the combined use of Grasshopper, a custom acoustic simulation tool and Galapagos solver, which allowed one to combine acoustic goals with production and assembly criteria...",
                        comentario = "Trecho grifado na leitura",
                        referenciaAbnt = "(RADINO, 2020, p. 17)",
                        corHex = "#FDE047",
                        criadoEm = "01/11/2026"
                    )
                ),
                notas = listOf(
                    NotaAdesiva(
                        id = "nota_radino_1",
                        pagina = 17,
                        xPct = 50f,
                        yPct = 40f,
                        titulo = "Conexão com Algoritmos Genéticos",
                        texto = "Verificar parâmetros de convergência do Galapagos para superfícies refletoras convexas.",
                        corHex = "#FDBA74",
                        autor = "Autor Principal"
                    )
                ),
                zoteroConfig = ZoteroVinculoConfig(
                    apiKey = "KNEYoy8RTMlkaTuHx5WPc3bH",
                    userId = "18806479",
                    itemKey = "JKCLFWH6",
                    doi = "10.3390/buildings10020036",
                    driveStatus = "Drive OK ✓",
                    driveFileName = "Acoustic Performance-Based Design A Brief Overview.pdf",
                    driveFileId = "drive_pdf_acoustic_2020"
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
