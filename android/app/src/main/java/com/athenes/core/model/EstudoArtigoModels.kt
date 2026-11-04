package com.athenes.core.model

import java.util.UUID

/**
 * Modelos de dados para o Estúdio de Leitura de Artigos, Risco em PDF e Fichamento Zotero.
 */

enum class ModoAmbienteLeitura(val rotulo: String) {
    LEITURA("Leitura"),
    ANOTACAO("Anotação"),
    ORGANIZACAO("Organização")
}

enum class ModoRolagemPdf(val rotulo: String) {
    CONTINUA("Rolagem Contínua"),
    PAGINA_A_PAGINA("Página a Página")
}

data class SecaoSumario(
    val id: String = UUID.randomUUID().toString(),
    val titulo: String,
    val pagina: Int,
    val nivel: Int = 1
)

enum class TipoAnotacao(val rotulo: String) {
    TODOS("Todos"),
    DESTAQUE("Destaques"),
    NOTA("Notas"),
    CITACAO("Citações")
}

data class ItemAnotacaoArtigo(
    val id: String,
    val pagina: Int,
    val tipo: TipoAnotacao,
    val titulo: String,
    val trecho: String,
    val corHex: String,
    val referenciaAbnt: String = ""
)

data class CitacaoMarcada(
    val id: String = UUID.randomUUID().toString(),
    val pagina: Int,
    val texto: String,
    val comentario: String = "",
    val referenciaAbnt: String = "",
    val corHex: String = "#FDE047",
    val criadoEm: String = "01/11/2026"
)

data class NotaAdesiva(
    val id: String = UUID.randomUUID().toString(),
    val pagina: Int,
    val xPct: Float = 50f,
    val yPct: Float = 30f,
    val titulo: String,
    val texto: String,
    val corHex: String = "#FDBA74",
    val autor: String = "Autor Principal"
)

data class PontoTraco(
    val x: Float,
    val y: Float
)

data class TracoDesenho(
    val id: String = UUID.randomUUID().toString(),
    val pagina: Int,
    val corHex: String,
    val espessura: Float,
    val pontos: List<PontoTraco>,
    val ehLinhaReta: Boolean = false,
    val ehMarcaTexto: Boolean = false
)

data class PaginaPdfInfo(
    val numero: Int,
    val titulo: String = "Folha do PDF",
    val qtdRiscos: Int = 0,
    val qtdNotas: Int = 0,
    val qtdCitacoes: Int = 0,
    val paragrafos: List<String> = emptyList()
)

data class ZoteroVinculoConfig(
    val apiKey: String = "",
    val userId: String = "",
    val itemKey: String = "",
    val doi: String = "10.3390/buildings10020036",
    val driveStatus: String = "Não conectado",
    val driveFileName: String = "",
    val driveFileId: String = ""
)

data class ArtigoEstudoDetalhado(
    val id: String = UUID.randomUUID().toString(),
    val titulo: String,
    val autores: String,
    val ano: Int,
    val chaveZotero: String,
    val totalPaginas: Int = 33,
    val resumoOficial: String = "",
    val meuResumo: String = "",
    val analiseMetodologica: String = "",
    val tags: List<String> = emptyList(),
    val paginas: List<PaginaPdfInfo> = emptyList(),
    val citacoes: List<CitacaoMarcada> = emptyList(),
    val notas: List<NotaAdesiva> = emptyList(),
    val tracos: List<TracoDesenho> = emptyList(),
    val tipoZotero: String = "",
    val camposZotero: Map<String, String> = emptyMap(),
    val criadoresZotero: List<ZoteroCriadorInfo> = emptyList(),
    val colecoesZotero: List<String> = emptyList(),
    val sumario: List<SecaoSumario> = emptyList(),
    val marcadores: Set<Int> = emptySet(),
    val zoteroConfig: ZoteroVinculoConfig = ZoteroVinculoConfig()
)

data class ZoteroCriadorInfo(val funcao: String, val nome: String, val sobrenome: String)

enum class FerramentaLeitura(val rotulo: String) {
    SELECAO("Selecionar Texto"),
    CANETA("Caneta"),
    MARCADOR("Marca-Texto"),
    LINHA_RETA("Linha Reta"),
    BORRACHA("Borracha"),
    NOTA("Nota Adesiva"),
    CITACAO("Citação")
}

enum class AbaInspetorDireito {
    ANOTACOES_ARTIGO,
    RESUMO_NOTAS,
    CITACOES,
    INFORMACOES_ZOTERO,
    SUMARIO,
    ZOTERO_DRIVE
}
