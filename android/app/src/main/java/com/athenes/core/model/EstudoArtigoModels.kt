package com.athenes.core.model

import java.util.UUID

/**
 * Modelos de dados para o Estúdio de Leitura de Artigos, Risco em PDF e Fichamento Zotero.
 */

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
    val apiKey: String = "KNEYoy8RTMlkaTuHx5WPc3bH",
    val userId: String = "18806479",
    val itemKey: String = "JKCLFWH6",
    val doi: String = "10.3390/buildings10020036",
    val driveStatus: String = "Drive OK ✓",
    val driveFileName: String = "Acoustic Performance-Based Design A Brief Overview.pdf",
    val driveFileId: String = "drive_pdf_acoustic_2020"
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
    val zoteroConfig: ZoteroVinculoConfig = ZoteroVinculoConfig()
)

enum class FerramentaLeitura {
    SELECAO,
    MARCADOR,     // Marca-texto
    SUBLINHADO,
    CANETA,        // Desenho livre stylus
    BORRACHA,
    NOTA,          // Criar pin de nota
    CITACAO        // Marcar citação
}

enum class AbaInspetorDireito {
    RESUMO_NOTAS,
    CITACOES,
    ZOTERO_DRIVE
}
