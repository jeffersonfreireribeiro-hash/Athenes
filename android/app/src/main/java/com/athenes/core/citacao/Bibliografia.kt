package com.athenes.core.citacao

import com.athenes.core.model.ArtigoEstudoDetalhado
import java.text.Collator
import java.util.Locale

enum class EstiloBibliografico(val id: String, val rotulo: String, val numerico: Boolean) {
    ABNT("abnt", "ABNT · autor-data", false),
    ABNT_NUMERICO("abnt_numerico", "ABNT · numérico", true),
    APA("apa", "APA 7", false),
    HARVARD("harvard", "Harvard", false),
    CHICAGO("chicago", "Chicago · autor-data", false),
    MLA("mla", "MLA", false),
    VANCOUVER("vancouver", "Vancouver · numérico", true),
    IEEE("ieee", "IEEE · numérico", true);

    companion object {
        fun deId(id: String?): EstiloBibliografico = entries.find { it.id == id } ?: ABNT
    }
}

data class AutorReferencia(val sobrenome: String, val prenome: String = "")
data class ValidacaoPagina(val valida: Boolean, val valor: String = "", val mensagem: String = "")

data class ReferenciaAcademica(
    val id: String,
    val tipo: String,
    val titulo: String,
    val autores: List<AutorReferencia>,
    val ano: String,
    val publicacao: String = "",
    val editora: String = "",
    val local: String = "",
    val volume: String = "",
    val numero: String = "",
    val paginas: String = "",
    val doi: String = "",
    val url: String = "",
    val palavrasChave: List<String> = emptyList()
) {
    companion object {
        fun doArtigo(artigo: ArtigoEstudoDetalhado): ReferenciaAcademica {
            val campos = artigo.camposZotero
            val autores = artigo.criadoresZotero.filter { it.funcao in setOf("author", "bookAuthor", "creator") }
                .map { AutorReferencia(it.sobrenome, it.nome) }
                .ifEmpty {
                    artigo.autores.split(Regex("\\s*(?:;|\\s+e\\s+)\\s*"))
                        .filter { it.isNotBlank() && it != "Autor não informado" }
                        .map { nome -> AutorReferencia(nome.substringAfterLast(' '), nome.substringBeforeLast(' ', "")) }
                }
            return ReferenciaAcademica(
                id = artigo.id, tipo = artigo.tipoZotero, titulo = artigo.titulo,
                autores = autores, ano = artigo.ano.takeIf { it > 0 }?.toString().orEmpty(),
                publicacao = campos["publicationTitle"] ?: campos["bookTitle"] ?: campos["proceedingsTitle"]
                    ?: campos["journal"] ?: campos["booktitle"] ?: "",
                editora = campos["publisher"].orEmpty(), local = campos["place"] ?: campos["address"].orEmpty(),
                volume = campos["volume"].orEmpty(), numero = campos["issue"] ?: campos["number"].orEmpty(),
                paginas = campos["pages"].orEmpty(), doi = campos["DOI"] ?: campos["doi"] ?: artigo.zoteroConfig.doi,
                url = campos["url"].orEmpty(), palavrasChave = artigo.tags
            )
        }
    }
}

object Bibliografia {
    private val pt = Locale.forLanguageTag("pt-BR")
    fun ancora(refId: String): String = "ref_" + refId.replace(Regex("[^A-Za-z0-9_]"), "_").take(27) +
        "_" + refId.hashCode().toUInt().toString(16)

    fun validarPagina(valor: String, paginasPublicacao: String = "", totalPaginasPdf: Int = 0): ValidacaoPagina {
        val texto = valor.trim()
        if (texto.isEmpty()) return ValidacaoPagina(true)
        val faixa = Regex("(\\d+)\\D+(\\d+)").find(paginasPublicacao)
        val minimo = faixa?.groupValues?.get(1)?.toIntOrNull() ?: if (totalPaginasPdf > 0) 1 else null
        val maximo = faixa?.groupValues?.get(2)?.toIntOrNull() ?: totalPaginasPdf.takeIf { it > 0 }
        val normalizados = mutableListOf<String>()
        for (parte in texto.split(Regex("\\s*[,;]\\s*"))) {
            val match = Regex("^(\\d+)(?:\\s*[-–]\\s*(\\d+))?$").matchEntire(parte)
                ?: return ValidacaoPagina(false, mensagem = "Use números: 15, 15-17 ou 15, 17")
            val inicio = match.groupValues[1].toIntOrNull() ?: return ValidacaoPagina(false, mensagem = "Página inválida")
            val fim = match.groupValues[2].takeIf(String::isNotBlank)?.toIntOrNull() ?: inicio
            if (fim < inicio) return ValidacaoPagina(false, mensagem = "O intervalo está invertido")
            if (minimo != null && maximo != null && (inicio < minimo || fim > maximo))
                return ValidacaoPagina(false, mensagem = "Fora do intervalo da obra ($minimo–$maximo)")
            normalizados += if (fim == inicio) "$inicio" else "$inicio–$fim"
        }
        return ValidacaoPagina(true, normalizados.joinToString(", "))
    }
    private fun ponto(texto: String): String = texto.trim().let { if (it.isBlank() || it.last() in ".!?") it else "$it." }
    private fun juntar(vararg partes: String): String = partes.filter(String::isNotBlank).joinToString(" ").replace(Regex("\\s+([,.;:])"), "$1").replace("..", ".").trim()
    private fun primeiroAutor(ref: ReferenciaAcademica): String = ref.autores.firstOrNull()?.sobrenome.orEmpty().ifBlank { ref.titulo }

    fun ordenar(refs: List<ReferenciaAcademica>, estilo: EstiloBibliografico): List<ReferenciaAcademica> {
        if (estilo.numerico) return refs.distinctBy { it.id }
        val colador = Collator.getInstance(pt)
        return refs.distinctBy { it.id }.sortedWith { a, b ->
            colador.compare(primeiroAutor(a), primeiroAutor(b)).takeIf { it != 0 }
                ?: colador.compare(a.ano, b.ano).takeIf { it != 0 }
                ?: colador.compare(a.titulo, b.titulo)
        }
    }

    fun autores(autores: List<AutorReferencia>, estilo: EstiloBibliografico): String {
        val l = autores.filter { it.sobrenome.isNotBlank() && !it.sobrenome.equals("ANÔNIMO", true) }
        if (l.isEmpty()) return ""
        fun iniciais(nome: String, pontos: Boolean = true, separador: String = " "): String =
            nome.split(Regex("[\\s-]+")) .filter(String::isNotBlank)
                .joinToString(separador) { it.take(1).uppercase(pt) + if (pontos) "." else "" }
        fun unir(partes: List<String>, ultimo: String): String = when (partes.size) {
            0 -> ""
            1 -> partes[0]
            else -> partes.dropLast(1).joinToString(", ") + ultimo + partes.last()
        }
        return when (estilo) {
            EstiloBibliografico.ABNT, EstiloBibliografico.ABNT_NUMERICO -> {
                val formatar = { a: AutorReferencia -> a.sobrenome.uppercase(pt) + if (a.prenome.isBlank()) "" else ", ${a.prenome}" }
                if (l.size > 3) "${formatar(l[0])} et al." else l.joinToString("; ") { formatar(it) }
            }
            EstiloBibliografico.APA -> unir(l.take(20).map { it.sobrenome + if (it.prenome.isBlank()) "" else ", ${iniciais(it.prenome)}" }, ", & ")
            EstiloBibliografico.HARVARD -> unir(l.map { it.sobrenome + if (it.prenome.isBlank()) "" else ", ${iniciais(it.prenome)}" }, " and ")
            EstiloBibliografico.CHICAGO -> unir(l.mapIndexed { i, a ->
                if (i == 0) a.sobrenome + if (a.prenome.isBlank()) "" else ", ${a.prenome}"
                else listOf(a.prenome, a.sobrenome).filter(String::isNotBlank).joinToString(" ")
            }, if (l.size > 2) ", and " else " and ")
            EstiloBibliografico.MLA -> when (l.size) {
                1 -> l[0].sobrenome + if (l[0].prenome.isBlank()) "" else ", ${l[0].prenome}"
                2 -> "${l[0].sobrenome}, ${l[0].prenome}, and ${l[1].prenome} ${l[1].sobrenome}".replace(Regex("\\s+"), " ")
                else -> "${l[0].sobrenome}, ${l[0].prenome}, et al".replace(Regex("\\s+"), " ")
            }
            EstiloBibliografico.VANCOUVER -> l.take(6).joinToString(", ") { it.sobrenome + if (it.prenome.isBlank()) "" else " ${iniciais(it.prenome, false, "")}" } + if (l.size > 6) ", et al" else ""
            EstiloBibliografico.IEEE -> unir(l.take(6).map { (if (it.prenome.isBlank()) "" else "${iniciais(it.prenome)} ") + it.sobrenome }, if (l.size > 2) ", and " else " and ") + if (l.size > 6) " et al." else ""
        }
    }

    fun citacao(ref: ReferenciaAcademica, estilo: EstiloBibliografico, indice: Int, pagina: String = "", narrativa: Boolean = false): String {
        val sobrenomes = ref.autores.map { it.sobrenome }.filter(String::isNotBlank)
        val ano = ref.ano.ifBlank { "s.d." }
        val autor = when (estilo) {
            EstiloBibliografico.ABNT, EstiloBibliografico.ABNT_NUMERICO -> if (sobrenomes.size > 3) "${sobrenomes[0]} et al." else sobrenomes.joinToString(if (narrativa) " e " else "; ")
            EstiloBibliografico.APA -> if (sobrenomes.size > 2) "${sobrenomes[0]} et al." else sobrenomes.joinToString(if (narrativa) " e " else " & ")
            EstiloBibliografico.HARVARD, EstiloBibliografico.CHICAGO -> if (sobrenomes.size > 3) "${sobrenomes[0]} et al." else sobrenomes.joinToString(" e ")
            EstiloBibliografico.MLA -> if (sobrenomes.size > 2) "${sobrenomes[0]} et al." else sobrenomes.joinToString(" e ")
            else -> sobrenomes.firstOrNull().orEmpty()
        }.ifBlank { ref.titulo.substringBefore(' ').ifBlank { "Sem autor" } }
        val autorExibido = if (estilo == EstiloBibliografico.ABNT && !narrativa) autor.uppercase(pt) else autor
        val pag = pagina.trim()
        return when (estilo) {
            EstiloBibliografico.ABNT_NUMERICO -> "($indice${if (pag.isNotEmpty()) ", p. $pag" else ""})"
            EstiloBibliografico.VANCOUVER, EstiloBibliografico.IEEE -> "[$indice${if (pag.isNotEmpty()) ", p. $pag" else ""}]"
            EstiloBibliografico.MLA -> if (narrativa) autorExibido + if (pag.isNotEmpty()) " ($pag)" else "" else "($autorExibido${if (pag.isNotEmpty()) " $pag" else ""})"
            EstiloBibliografico.CHICAGO -> if (narrativa) "$autorExibido ($ano${if (pag.isNotEmpty()) ", $pag" else ""})" else "($autorExibido $ano${if (pag.isNotEmpty()) ", $pag" else ""})"
            else -> if (narrativa) "$autorExibido ($ano${if (pag.isNotEmpty()) ", p. $pag" else ""})" else "($autorExibido, $ano${if (pag.isNotEmpty()) ", p. $pag" else ""})"
        }
    }

    fun formatar(ref: ReferenciaAcademica, estilo: EstiloBibliografico, indice: Int): String {
        val aut = autores(ref.autores, estilo)
        val ano = ref.ano.ifBlank { "s.d." }
        val titulo = ref.titulo.ifBlank { "Sem título" }
        val pub = ref.publicacao
        val pag = ref.paginas.removePrefix("pp.").removePrefix("p.").trim()
        val periodico = ref.tipo in setOf("journalArticle", "artigo_periodico")
        val capitulo = ref.tipo in setOf("bookSection", "capitulo_livro")
        val congresso = ref.tipo in setOf("conferencePaper", "trabalho_conferencia")
        val tese = ref.tipo in setOf("thesis", "tese_dissertacao")
        val web = ref.tipo in setOf("webpage", "website")
        val doiUrl = ref.doi.takeIf(String::isNotBlank)?.let { "https://doi.org/$it" }.orEmpty()
        val prefixo = when (estilo) {
            EstiloBibliografico.ABNT_NUMERICO -> "$indice "
            EstiloBibliografico.VANCOUVER -> "$indice. "
            EstiloBibliografico.IEEE -> "[$indice] "
            else -> ""
        }
        val corpo = when (estilo) {
            EstiloBibliografico.ABNT, EstiloBibliografico.ABNT_NUMERICO -> {
                val acesso = juntar(if (ref.url.isNotBlank()) "Disponível em: <${ref.url}>." else "", if (doiUrl.isNotBlank()) "DOI: $doiUrl." else "")
                when {
                    periodico -> juntar(ponto(aut), ponto(titulo), "$pub${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}${if (ref.volume.isNotBlank()) ", v. ${ref.volume}" else ""}${if (ref.numero.isNotBlank()) ", n. ${ref.numero}" else ""}${if (pag.isNotBlank()) ", p. $pag" else ""}, $ano.", acesso)
                    capitulo -> juntar(ponto(aut), ponto(titulo), "In: ${ponto(pub.ifBlank { "Livro" })}", "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${if (ref.editora.isNotBlank()) "${ref.editora}, " else ""}$ano.", if (pag.isNotBlank()) "p. $pag." else "", acesso)
                    congresso -> juntar(ponto(aut), ponto(titulo), "In: ${pub.ifBlank { "Anais" }}${if (ref.ano.isNotBlank()) ", $ano" else ""}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}.", "${if (ref.editora.isNotBlank()) "${ref.editora}, " else ""}$ano.", if (pag.isNotBlank()) "p. $pag." else "", acesso)
                    tese -> juntar(ponto(aut), ponto(titulo), "$ano. Tese/Dissertação${if (ref.editora.isNotBlank()) " – ${ref.editora}" else ""}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}, $ano.", acesso)
                    web -> juntar(ponto(aut), ponto(titulo), "${if (pub.isNotBlank()) "$pub, " else ""}$ano.", acesso)
                    else -> juntar(ponto(aut), ponto(titulo), "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${if (ref.editora.isNotBlank()) "${ref.editora}, " else ""}$ano.", if (ref.tipo in setOf("report", "relatorio_tecnico")) "Relatório técnico." else "", acesso)
                }
            }
            EstiloBibliografico.APA -> {
                val cab = juntar(ponto(aut.ifBlank { titulo }), "($ano).")
                val fim = doiUrl.ifBlank { ref.url }
                when {
                    periodico -> juntar(cab, ponto(titulo), "$pub${if (ref.volume.isNotBlank()) ", ${ref.volume}" else ""}${if (ref.numero.isNotBlank()) "(${ref.numero})" else ""}${if (pag.isNotBlank()) ", $pag" else ""}.", fim)
                    capitulo -> juntar(cab, ponto(titulo), "In ${pub.ifBlank { "Livro" }}${if (pag.isNotBlank()) " (pp. $pag)" else ""}.", ponto(ref.editora), fim)
                    congresso -> juntar(cab, ponto(titulo), "${pub.ifBlank { "Anais" }}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}.", fim)
                    tese -> juntar(cab, "$titulo [Tese/Dissertação].", ponto(ref.editora), fim)
                    web -> juntar(cab, ponto(titulo), ponto(pub), ref.url)
                    else -> juntar(cab, ponto(titulo), ponto(ref.editora.ifBlank { pub }), fim)
                }
            }
            EstiloBibliografico.HARVARD -> {
                val cab = "${aut.ifBlank { titulo }} ($ano)"
                when {
                    periodico -> juntar(cab, "'$titulo',", "$pub${if (ref.volume.isNotBlank()) ", ${ref.volume}" else ""}${if (ref.numero.isNotBlank()) "(${ref.numero})" else ""}${if (pag.isNotBlank()) ", pp. $pag" else ""}.", if (ref.doi.isNotBlank()) "doi: ${ref.doi}." else ref.url)
                    capitulo -> juntar(cab, "'$titulo',", "in ${ponto(pub.ifBlank { "Livro" })}", "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ponto(ref.editora)}", if (pag.isNotBlank()) "pp. $pag." else "", if (ref.doi.isNotBlank()) "doi: ${ref.doi}." else ref.url)
                    congresso -> juntar(cab, "'$titulo',", "${pub.ifBlank { "Proceedings" }}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}${if (pag.isNotBlank()) ", pp. $pag" else ""}.", if (ref.doi.isNotBlank()) "doi: ${ref.doi}." else ref.url)
                    tese -> juntar(cab, ponto(titulo), "Tese/Dissertação.", ponto(ref.editora), if (ref.doi.isNotBlank()) "doi: ${ref.doi}." else ref.url)
                    else -> juntar(cab, ponto(titulo), "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ponto(ref.editora.ifBlank { pub })}", if (ref.doi.isNotBlank()) "doi: ${ref.doi}." else ref.url)
                }
            }
            EstiloBibliografico.CHICAGO -> {
                val cab = juntar(ponto(aut.ifBlank { titulo }), ponto(ano))
                when {
                    periodico -> juntar(cab, "“${ponto(titulo)}”", "$pub${if (ref.volume.isNotBlank()) " ${ref.volume}" else ""}${if (ref.numero.isNotBlank()) " (${ref.numero})" else ""}${if (pag.isNotBlank()) ": $pag" else ""}.", doiUrl.ifBlank { ref.url })
                    capitulo -> juntar(cab, "“${ponto(titulo)}”", "In ${pub.ifBlank { "Livro" }}${if (pag.isNotBlank()) ", $pag" else ""}.", "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ponto(ref.editora)}", doiUrl.ifBlank { ref.url })
                    congresso -> juntar(cab, "“${ponto(titulo)}”", "Paper presented at ${pub.ifBlank { "conference" }}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}.", doiUrl.ifBlank { ref.url })
                    tese -> juntar(cab, ponto(titulo), "Tese/Dissertação, ${ponto(ref.editora)}", doiUrl.ifBlank { ref.url })
                    else -> juntar(cab, ponto(titulo), "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ponto(ref.editora.ifBlank { pub })}", doiUrl.ifBlank { ref.url })
                }
            }
            EstiloBibliografico.MLA -> {
                val cab = ponto(aut)
                when {
                    periodico -> juntar(cab, "“${ponto(titulo)}”", "$pub${if (ref.volume.isNotBlank()) ", vol. ${ref.volume}" else ""}${if (ref.numero.isNotBlank()) ", no. ${ref.numero}" else ""}${if (ref.ano.isNotBlank()) ", $ano" else ""}${if (pag.isNotBlank()) ", pp. $pag" else ""}.", doiUrl.ifBlank { ref.url })
                    capitulo -> juntar(cab, "“${ponto(titulo)}”", "${pub.ifBlank { "Livro" }}${if (ref.editora.isNotBlank()) ", ${ref.editora}" else ""}${if (ref.ano.isNotBlank()) ", $ano" else ""}${if (pag.isNotBlank()) ", pp. $pag" else ""}.", doiUrl.ifBlank { ref.url })
                    congresso -> juntar(cab, "“${ponto(titulo)}”", "${pub.ifBlank { "Conference" }}${if (ref.ano.isNotBlank()) ", $ano" else ""}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}.", doiUrl.ifBlank { ref.url })
                    else -> juntar(cab, ponto(titulo), "${if (ref.editora.isNotBlank()) "${ref.editora}, " else ""}$ano.", doiUrl.ifBlank { ref.url })
                }
            }
            EstiloBibliografico.VANCOUVER -> when {
                periodico -> juntar(ponto(aut), ponto(titulo), ponto(pub), "$ano${if (ref.volume.isNotBlank()) ";${ref.volume}" else ""}${if (ref.numero.isNotBlank()) "(${ref.numero})" else ""}${if (pag.isNotBlank()) ":$pag" else ""}.", if (ref.doi.isNotBlank()) "doi:${ref.doi}" else "")
                capitulo -> juntar(ponto(aut), ponto(titulo), "In: ${ponto(pub.ifBlank { "Livro" })}", "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ref.editora}${if (ref.ano.isNotBlank()) "; $ano" else ""}${if (pag.isNotBlank()) ". p. $pag" else ""}.")
                web -> juntar(ponto(aut), ponto(titulo), ponto(pub), if (ref.ano.isNotBlank()) "$ano." else "", if (ref.url.isNotBlank()) "Available from: ${ref.url}" else "")
                else -> juntar(ponto(aut), ponto(titulo), "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ref.editora}${if (ref.ano.isNotBlank()) "; $ano" else ""}.")
            }
            EstiloBibliografico.IEEE -> {
                val cab = if (aut.isBlank()) "" else "$aut,"
                val fim = if (ref.doi.isNotBlank()) "doi: ${ref.doi}." else if (ref.url.isNotBlank()) "[Online]. Available: ${ref.url}" else ""
                when {
                    periodico -> juntar(cab, "“$titulo,”", "$pub${if (ref.volume.isNotBlank()) ", vol. ${ref.volume}" else ""}${if (ref.numero.isNotBlank()) ", no. ${ref.numero}" else ""}${if (pag.isNotBlank()) ", pp. $pag" else ""}${if (ref.ano.isNotBlank()) ", $ano" else ""}.", fim)
                    capitulo || congresso -> juntar(cab, "“$titulo,”", "in ${pub.ifBlank { "Proceedings" }}${if (ref.local.isNotBlank()) ", ${ref.local}" else ""}${if (ref.ano.isNotBlank()) ", $ano" else ""}${if (pag.isNotBlank()) ", pp. $pag" else ""}.", fim)
                    tese -> juntar(cab, "“$titulo,”", "Tese/Dissertação, ${ref.editora}${if (ref.ano.isNotBlank()) ", $ano" else ""}.", fim)
                    else -> juntar(cab, ponto(titulo), "${if (ref.local.isNotBlank()) "${ref.local}: " else ""}${ref.editora}${if (ref.ano.isNotBlank()) ", $ano" else ""}.", fim)
                }
            }
        }
        return prefixo + corpo
    }
}
