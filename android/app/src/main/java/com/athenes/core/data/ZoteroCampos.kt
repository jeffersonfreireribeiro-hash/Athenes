package com.athenes.core.data

import com.athenes.core.model.ArtigoEstudoDetalhado

object ZoteroCampos {
    private val tipos = mapOf(
        "journalArticle" to "Artigo de periódico", "book" to "Livro", "bookSection" to "Capítulo de livro",
        "conferencePaper" to "Trabalho em congresso", "thesis" to "Tese", "report" to "Relatório",
        "webpage" to "Página web", "preprint" to "Preprint", "dataset" to "Conjunto de dados",
        "software" to "Software", "map" to "Mapa", "standard" to "Norma"
    )
    private val rotulos = mapOf(
        "title" to "Título", "publicationTitle" to "Título da publicação", "journalAbbreviation" to "Abreviatura do periódico",
        "volume" to "Volume", "issue" to "Número", "pages" to "Páginas", "date" to "Data",
        "series" to "Série", "seriesNumber" to "Número da série", "edition" to "Edição",
        "place" to "Lugar", "publisher" to "Editora", "numPages" to "Nº de páginas",
        "language" to "Idioma", "DOI" to "DOI", "ISBN" to "ISBN", "ISSN" to "ISSN",
        "url" to "URL", "accessDate" to "Data de acesso", "bookTitle" to "Título do livro",
        "proceedingsTitle" to "Título dos anais", "conferenceName" to "Nome do congresso",
        "thesisType" to "Tipo de trabalho", "university" to "Universidade", "institution" to "Instituição",
        "reportNumber" to "Número do relatório", "websiteTitle" to "Título do site",
        "dateAdded" to "Data de adição", "dateModified" to "Data de modificação"
    )
    private val funcoes = mapOf(
        "author" to "Autor", "editor" to "Editor", "translator" to "Tradutor",
        "contributor" to "Colaborador", "bookAuthor" to "Autor do livro", "director" to "Diretor"
    )
    private val fim = listOf("language", "url", "accessDate")
    private val ordem = mapOf(
        "journalArticle" to listOf("title", "creators", "publicationTitle", "date", "volume", "issue", "pages", "journalAbbreviation", "DOI", "ISSN") + fim,
        "book" to listOf("title", "creators", "series", "seriesNumber", "volume", "edition", "place", "publisher", "date", "numPages", "ISBN") + fim,
        "bookSection" to listOf("title", "creators", "bookTitle", "edition", "place", "publisher", "date", "pages", "ISBN") + fim,
        "conferencePaper" to listOf("title", "creators", "date", "proceedingsTitle", "conferenceName", "place", "publisher", "pages", "DOI") + fim,
        "thesis" to listOf("title", "creators", "thesisType", "university", "place", "date", "numPages") + fim,
        "report" to listOf("title", "creators", "reportNumber", "institution", "date", "pages") + fim,
        "webpage" to listOf("title", "creators", "websiteTitle", "date") + fim
    )
    private val generica = listOf("title", "creators", "date", "publisher", "place", "publicationTitle", "volume", "issue", "pages", "DOI", "ISBN", "ISSN") + fim

    fun linhas(artigo: ArtigoEstudoDetalhado): List<Pair<String, String>> {
        val campos = artigo.camposZotero
        val linhas = mutableListOf<Pair<String, String>>()
        val tipo = artigo.tipoZotero.ifBlank { campos["itemType"].orEmpty() }
        if (tipo.isNotBlank()) linhas.add("Tipo do item" to (tipos[tipo] ?: tipo))
        val usados = mutableSetOf("itemType", "dateAdded", "dateModified", "key", "version")
        for (campo in ordem[tipo] ?: generica) {
            usados.add(campo)
            if (campo == "creators") {
                artigo.criadoresZotero.forEach { criador ->
                    val nome = listOf(criador.sobrenome, criador.nome).filter(String::isNotBlank).joinToString(", ")
                    if (nome.isNotBlank()) linhas.add((funcoes[criador.funcao] ?: criador.funcao) to nome)
                }
            } else campos[campo]?.takeIf(String::isNotBlank)?.let { linhas.add((rotulos[campo] ?: campo) to it) }
        }
        campos.forEach { (campo, valor) ->
            if (campo !in usados && valor.isNotBlank()) linhas.add((rotulos[campo] ?: campo) to valor)
        }
        listOf("dateAdded", "dateModified").forEach { campo ->
            campos[campo]?.takeIf(String::isNotBlank)?.let { linhas.add((rotulos[campo] ?: campo) to it) }
        }
        return linhas
    }
}
