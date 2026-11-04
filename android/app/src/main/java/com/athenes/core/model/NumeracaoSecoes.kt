package com.athenes.core.model

/** Prefixos decimais dos títulos; níveis intermediários pulados recebem 1. */
object NumeracaoSecoes {
    fun calcular(niveis: List<Int>): List<String> {
        val contadores = IntArray(10)
        return niveis.map { nivelBruto ->
            val nivel = nivelBruto.coerceIn(1, 9)
            for (i in 1 until nivel) if (contadores[i] == 0) contadores[i] = 1
            contadores[nivel]++
            for (i in nivel + 1..9) contadores[i] = 0
            (1..nivel).joinToString(".") { contadores[it].toString() }
        }
    }
}
