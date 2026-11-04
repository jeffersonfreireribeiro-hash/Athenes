package com.athenes.core.data

/** Leitor BibTeX offline. Percorre valores com chaves aninhadas e aspas sem cortar a entrada no próximo @. */
object BibtexParser {
    fun ler(texto: String): List<ZoteroItem> {
        val itens = mutableListOf<ZoteroItem>()
        var pos = 0
        while (pos < texto.length) {
            val inicio = texto.indexOf('@', pos)
            if (inicio < 0) break
            var i = inicio + 1
            while (i < texto.length && texto[i].isLetter()) i++
            val tipoBib = texto.substring(inicio + 1, i).lowercase()
            while (i < texto.length && texto[i].isWhitespace()) i++
            if (i >= texto.length || texto[i] !in "{(") { pos = i.coerceAtLeast(inicio + 1); continue }
            val abertura = texto[i++]
            val fechamento = if (abertura == '{') '}' else ')'
            val chaveInicio = i
            while (i < texto.length && texto[i] != ',' && texto[i] != fechamento) i++
            val chave = texto.substring(chaveInicio, i).trim()
            if (i >= texto.length || texto[i] != ',') { pos = i + 1; continue }
            i++
            val campos = mutableMapOf<String, String>()
            while (i < texto.length) {
                while (i < texto.length && (texto[i].isWhitespace() || texto[i] == ',')) i++
                if (i >= texto.length || texto[i] == fechamento) break
                val nomeInicio = i
                while (i < texto.length && (texto[i].isLetterOrDigit() || texto[i] == '_' || texto[i] == '-')) i++
                if (i == nomeInicio) { i++; continue }
                val nome = texto.substring(nomeInicio, i).lowercase()
                while (i < texto.length && texto[i].isWhitespace()) i++
                if (i >= texto.length || texto[i] != '=') continue
                i++
                while (i < texto.length && texto[i].isWhitespace()) i++
                if (i >= texto.length) break
                val valor = StringBuilder()
                if (texto[i] == '{' || texto[i] == '"') {
                    val delimitador = texto[i++]
                    if (delimitador == '{') {
                        var profundidade = 1
                        while (i < texto.length && profundidade > 0) {
                            val c = texto[i++]
                            if (c == '{') profundidade++ else if (c == '}') profundidade--
                            if (profundidade > 0) valor.append(c)
                        }
                    } else {
                        while (i < texto.length) {
                            val c = texto[i++]
                            if (c == '"' && (i < 2 || texto[i - 2] != '\\')) break
                            valor.append(c)
                        }
                    }
                } else {
                    while (i < texto.length && texto[i] != ',' && texto[i] != fechamento && !texto[i].isWhitespace()) valor.append(texto[i++])
                }
                campos[nome] = valor.toString().trim()
            }
            pos = (i + 1).coerceAtMost(texto.length)
            if (tipoBib in setOf("comment", "preamble", "string") || chave.isBlank()) continue
            val autores = campos["author"].orEmpty().split(Regex("\\s+and\\s+", RegexOption.IGNORE_CASE))
                .filter(String::isNotBlank).map { nome ->
                    val partes = nome.split(',', limit = 2)
                    if (partes.size == 2) ZoteroCriador("author", partes[1].trim(), partes[0].trim())
                    else ZoteroCriador("author", nome.substringBeforeLast(' ', "").trim(), nome.substringAfterLast(' ').trim())
                }
            val tipo = when (tipoBib) {
                "book" -> "book"
                "incollection", "inbook" -> "bookSection"
                "inproceedings", "conference" -> "conferencePaper"
                "phdthesis", "mastersthesis" -> "thesis"
                "techreport" -> "report"
                "misc", "online" -> "webpage"
                else -> "journalArticle"
            }
            itens += ZoteroItem(
                chave = "bib:$chave", tipo = tipo,
                titulo = campos["title"].orEmpty().replace("{", "").replace("}", "").ifBlank { "Sem título" },
                autores = autores, data = campos["year"].orEmpty(), resumo = campos["abstract"].orEmpty(),
                doi = campos["doi"].orEmpty(),
                tags = campos["keywords"].orEmpty().split(',', ';').map(String::trim).filter(String::isNotBlank),
                colecoes = emptyList(), campos = campos
            )
        }
        return itens
    }
}
