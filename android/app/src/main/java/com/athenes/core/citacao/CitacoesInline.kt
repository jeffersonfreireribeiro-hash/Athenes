package com.athenes.core.citacao

/** Intervalos no texto do bloco, com índice inicial inclusivo e final exclusivo. */
data class CitacaoInline(
    val refId: String,
    val inicio: Int,
    val fim: Int,
    val pagina: String = "",
    val narrativa: Boolean = false
)

data class TextoComCitacoes(val texto: String, val citacoes: List<CitacaoInline>)

object CitacoesInline {
    /** Se a edição tocar o texto de uma citação, o vínculo é retirado; demais intervalos acompanham o deslocamento. */
    fun atualizarDepoisDaEdicao(antigo: String, novo: String, citacoes: List<CitacaoInline>): List<CitacaoInline> {
        if (antigo == novo) return citacoes
        val prefixo = antigo.commonPrefixWith(novo).length
        val sufixo = antigo.substring(prefixo).commonSuffixWith(novo.substring(prefixo)).length
        val fimAntigo = antigo.length - sufixo
        val deslocamento = novo.length - antigo.length
        return citacoes.mapNotNull { c ->
            when {
                c.inicio < 0 || c.fim > antigo.length || c.inicio >= c.fim -> null
                c.fim <= prefixo -> c
                c.inicio >= fimAntigo -> c.copy(inicio = c.inicio + deslocamento, fim = c.fim + deslocamento)
                else -> null
            }
        }
    }

    fun inserir(estado: TextoComCitacoes, posicao: Int, refId: String, marca: String, pagina: String = "", narrativa: Boolean = false): TextoComCitacoes {
        val pos = posicao.coerceIn(0, estado.texto.length)
        val antes = estado.texto.substring(0, pos)
        val depois = estado.texto.substring(pos)
        val prefixo = if (antes.isNotEmpty() && !antes.last().isWhitespace()) " " else ""
        val sufixo = if (depois.isNotEmpty() && !depois.first().isWhitespace()) " " else ""
        val inserido = prefixo + marca + sufixo
        val inicio = pos + prefixo.length
        val novas = estado.citacoes.mapNotNull { c ->
            when {
                c.inicio < pos && pos < c.fim -> null
                c.inicio >= pos -> c.copy(inicio = c.inicio + inserido.length, fim = c.fim + inserido.length)
                else -> c
            }
        } + CitacaoInline(refId, inicio, inicio + marca.length, pagina, narrativa)
        return TextoComCitacoes(antes + inserido + depois, novas.sortedBy { it.inicio })
    }

    fun reformatar(
        estado: TextoComCitacoes,
        referencias: List<ReferenciaAcademica>,
        estilo: EstiloBibliografico
    ): TextoComCitacoes {
        val refs = referencias.associateBy { it.id }
        val ordenadas = estado.citacoes.sortedBy { it.inicio }
        val saida = StringBuilder()
        val novos = mutableListOf<CitacaoInline>()
        var anterior = 0
        for (c in ordenadas) {
            if (c.inicio < anterior || c.fim > estado.texto.length) continue
            val ref = refs[c.refId] ?: continue
            saida.append(estado.texto, anterior, c.inicio)
            val marca = Bibliografia.citacao(ref, estilo, referencias.indexOfFirst { it.id == c.refId } + 1, c.pagina, c.narrativa)
            val inicio = saida.length
            saida.append(marca)
            novos += c.copy(inicio = inicio, fim = saida.length)
            anterior = c.fim
        }
        saida.append(estado.texto, anterior, estado.texto.length)
        return TextoComCitacoes(saida.toString(), novos)
    }
}
