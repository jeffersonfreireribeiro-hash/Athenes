package com.athenes.core.model

import kotlin.math.roundToInt

enum class FormatoPagina(val rotulo: String, val larguraPadraoMm: Double, val alturaPadraoMm: Double) {
    A4("A4", 210.0, 297.0),
    CARTA("Carta", 215.9, 279.4),
    A3("A3", 297.0, 420.0),
    EXECUTIVO("Executivo", 184.15, 266.7),
    PERSONALIZADO("Personalizado", 210.0, 297.0)
}

data class ConfiguracaoPagina(
    val formato: FormatoPagina = FormatoPagina.A4,
    val paisagem: Boolean = false,
    val larguraPersonalizadaMm: Double = 210.0,
    val alturaPersonalizadaMm: Double = 297.0,
    val margemSuperiorMm: Double = 30.0,
    val margemDireitaMm: Double = 20.0,
    val margemInferiorMm: Double = 20.0,
    val margemEsquerdaMm: Double = 30.0
) {
    val larguraMm: Double get() = if (paisagem) alturaBaseMm else larguraBaseMm
    val alturaMm: Double get() = if (paisagem) larguraBaseMm else alturaBaseMm
    val larguraCorpoMm: Double get() = larguraMm - margemEsquerdaMm - margemDireitaMm
    val alturaCorpoMm: Double get() = alturaMm - margemSuperiorMm - margemInferiorMm
    private val larguraBaseMm: Double get() = if (formato == FormatoPagina.PERSONALIZADO) larguraPersonalizadaMm else formato.larguraPadraoMm
    private val alturaBaseMm: Double get() = if (formato == FormatoPagina.PERSONALIZADO) alturaPersonalizadaMm else formato.alturaPadraoMm

    fun validar(): Boolean = larguraMm in 100.0..1000.0 && alturaMm in 100.0..1000.0 &&
        listOf(margemSuperiorMm, margemDireitaMm, margemInferiorMm, margemEsquerdaMm).all { it in 0.0..100.0 } &&
        larguraCorpoMm >= 30.0 && alturaCorpoMm >= 30.0

    companion object {
        fun mmParaTwips(mm: Double): Int = (mm * 1440.0 / 25.4).roundToInt()
    }
}
