package com.athenes.core.citacao

import kotlin.math.roundToInt

enum class TipoNoConexao { OBRA, AUTOR, TEMA, ANO, VEICULO, LOCAL }
data class NoConexao(val id: String, val rotulo: String, val tipo: TipoNoConexao, val grau: Int, val dadoAusente: Boolean = false)
data class ArestaConexao(val origem: String, val destino: String, val tipo: String, val peso: Float = 1f)
data class GrafoBibliografico(
    val nos: List<NoConexao>, val arestas: List<ArestaConexao>, val totalReferencias: Int,
    val dadosAusentes: Int, val indiceCompletude: Int
)

object GrafoConexoes {
    fun construir(referencias: List<ReferenciaAcademica>): GrafoBibliografico {
        val nos = linkedMapOf<String, NoConexao>()
        val arestas = mutableListOf<ArestaConexao>()
        val chaves = mutableSetOf<String>()
        fun no(id: String, rotulo: String, tipo: TipoNoConexao, ausente: Boolean = false) {
            val antigo = nos[id]
            nos[id] = if (antigo == null) NoConexao(id, rotulo.ifBlank { "(Não informado)" }, tipo, 1, ausente)
                else antigo.copy(grau = antigo.grau + 1)
        }
        fun aresta(origem: String, destino: String, tipo: String, peso: Float = 1f) {
            val chave = "$origem->$destino:$tipo"
            val inversa = "$destino->$origem:$tipo"
            if (chave !in chaves && inversa !in chaves) {
                chaves += chave
                arestas += ArestaConexao(origem, destino, tipo, peso)
            }
        }
        fun id(prefixo: String, valor: String): String = prefixo + valor.lowercase().replace(Regex("[^a-z0-9]"), "_")

        for (ref in referencias) {
            val obraId = "obra_${ref.id}"
            val rotulo = ref.titulo.let { if (it.length > 40) it.take(37) + "..." else it }
            no(obraId, rotulo, TipoNoConexao.OBRA)
            val autores = ref.autores.filter { it.sobrenome.isNotBlank() }
            if (autores.isEmpty()) {
                no("autor_ausente", "Autoria não informada", TipoNoConexao.AUTOR, true)
                aresta(obraId, "autor_ausente", "autoria")
            } else {
                val idsAutores = autores.map { autor ->
                    val nome = listOf(autor.prenome, autor.sobrenome).filter(String::isNotBlank).joinToString(" ")
                    val autorId = id("autor_", nome)
                    no(autorId, nome, TipoNoConexao.AUTOR)
                    aresta(obraId, autorId, "autoria")
                    autorId
                }
                for (i in idsAutores.indices) for (j in i + 1 until idsAutores.size)
                    aresta(idsAutores[i], idsAutores[j], "coautoria", 1.5f)
            }
            if (ref.ano.isBlank()) {
                no("ano_ausente", "Ano não informado", TipoNoConexao.ANO, true)
                aresta(obraId, "ano_ausente", "cronologia")
            } else {
                val anoId = "ano_${ref.ano}"
                no(anoId, ref.ano, TipoNoConexao.ANO)
                aresta(obraId, anoId, "cronologia")
            }
            val temas = ref.palavrasChave.map(String::trim).filter(String::isNotBlank)
            if (temas.isEmpty()) {
                no("tema_ausente", "Sem palavras-chave", TipoNoConexao.TEMA, true)
                aresta(obraId, "tema_ausente", "tematica")
            } else temas.forEach { tema ->
                val temaId = id("tema_", tema)
                no(temaId, tema, TipoNoConexao.TEMA)
                aresta(obraId, temaId, "tematica")
            }
            ref.publicacao.ifBlank { ref.editora }.takeIf(String::isNotBlank)?.let { veiculo ->
                val veiculoId = id("veic_", veiculo)
                no(veiculoId, veiculo, TipoNoConexao.VEICULO)
                aresta(obraId, veiculoId, "veiculacao")
            }
            if (ref.local.isBlank()) {
                no("local_ausente", "País/Local não determinado", TipoNoConexao.LOCAL, true)
                aresta(obraId, "local_ausente", "localidade")
            } else {
                val localId = id("loc_", ref.local)
                no(localId, ref.local, TipoNoConexao.LOCAL)
                aresta(obraId, localId, "localidade")
            }
        }
        val ausentes = nos.values.count { it.dadoAusente }
        return GrafoBibliografico(nos.values.toList(), arestas, referencias.size, ausentes,
            if (nos.isEmpty()) 100 else ((nos.size - ausentes) * 100.0 / nos.size).roundToInt())
    }
}
