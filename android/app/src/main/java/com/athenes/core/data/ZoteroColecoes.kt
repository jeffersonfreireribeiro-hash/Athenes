package com.athenes.core.data

data class ColecaoNaArvore(val colecao: ZoteroColecao, val nivel: Int, val caminho: String)

/** Ordena coleções do Zotero com a pasta mãe antes das subpastas. */
object ZoteroColecoes {
    fun organizar(colecoes: List<ZoteroColecao>): List<ColecaoNaArvore> {
        val porChave = colecoes.associateBy { it.chave }
        val filhos = colecoes.groupBy { c -> c.pai?.takeIf { it != c.chave && it in porChave } }
        val visitados = mutableSetOf<String>()
        val resultado = mutableListOf<ColecaoNaArvore>()
        fun visitar(c: ZoteroColecao, nivel: Int, caminhoPai: String) {
            if (!visitados.add(c.chave)) return
            val caminho = if (caminhoPai.isBlank()) c.nome else "$caminhoPai / ${c.nome}"
            resultado += ColecaoNaArvore(c, nivel, caminho)
            filhos[c.chave].orEmpty().sortedBy { it.nome.lowercase() }.forEach { visitar(it, nivel + 1, caminho) }
        }
        filhos[null].orEmpty().sortedBy { it.nome.lowercase() }.forEach { visitar(it, 0, "") }
        // Dados externos podem conter ciclos: ainda mostramos as coleções órfãs.
        colecoes.filterNot { it.chave in visitados }.sortedBy { it.nome.lowercase() }.forEach { visitar(it, 0, "") }
        return resultado
    }
}
