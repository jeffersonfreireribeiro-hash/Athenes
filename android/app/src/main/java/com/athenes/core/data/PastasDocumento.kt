package com.athenes.core.data

import com.athenes.core.model.PastaDocumento

data class PastaNaArvore(val pasta: PastaDocumento, val nivel: Int, val caminho: String)

object PastasDocumento {
    fun organizar(pastas: List<PastaDocumento>): List<PastaNaArvore> {
        val porId = pastas.associateBy { it.id }
        val filhos = pastas.groupBy { it.pastaPaiId?.takeIf { pai -> pai != it.id && pai in porId } }
        val resultado = mutableListOf<PastaNaArvore>()
        val visitados = mutableSetOf<String>()
        fun visitar(pasta: PastaDocumento, nivel: Int, caminhoPai: String) {
            if (!visitados.add(pasta.id)) return
            val caminho = if (caminhoPai.isBlank()) pasta.nome else "$caminhoPai / ${pasta.nome}"
            resultado += PastaNaArvore(pasta, nivel, caminho)
            filhos[pasta.id].orEmpty().sortedBy { it.nome.lowercase() }.forEach { visitar(it, nivel + 1, caminho) }
        }
        filhos[null].orEmpty().sortedBy { it.nome.lowercase() }.forEach { visitar(it, 0, "") }
        pastas.filterNot { it.id in visitados }.sortedBy { it.nome.lowercase() }.forEach { visitar(it, 0, "") }
        return resultado
    }
}
