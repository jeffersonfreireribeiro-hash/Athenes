package com.athenes.core.export

import com.athenes.core.model.ConfiguracaoPagina
import com.athenes.core.model.NumeracaoSecoes
import com.athenes.core.citacao.Bibliografia
import com.athenes.core.citacao.CitacaoInline
import com.athenes.core.citacao.EstiloBibliografico
import com.athenes.core.citacao.ReferenciaAcademica
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Bloco do documento em forma neutra (sem Android), para exportação. */
data class BlocoExport(
    val tipo: TipoBlocoExport,
    val id: String = "",
    val titulo: String = "",
    val texto: String = "",
    val legenda: String = "",
    val fonte: String = "",
    val formula: String = "",
    val imagem: String = "",
    val alinhamento: AlinhamentoExport = AlinhamentoExport.JUSTIFICADO,
    val tabela: List<List<String>> = emptyList(),
    val listaNumerada: Boolean = false,
    val nivelTitulo: Int = 1,
    val citacoes: List<CitacaoInline> = emptyList(),
    val alturaPt: Double = 24.0,
    val camposColunas: Int = 2
)

enum class TipoBlocoExport { TITULO, PARAGRAFO, CITACAO, FIGURA, TABELA, QUADRO, FORMULA, LISTA, SUMARIO, LISTA_ILUSTRACOES, REFERENCIAS, CAMPOS, QUEBRA_PAGINA, ESPACO, DIVISOR }
enum class AlinhamentoExport {
    ESQUERDA, CENTRO, DIREITA, JUSTIFICADO,
    JUSTIFICADO_ESQUERDA, JUSTIFICADO_CENTRO, JUSTIFICADO_DIREITA
}

data class DocumentoExport(
    val titulo: String,
    val subtitulo: String,
    val autores: String,
    val resumo: String,
    val blocos: List<BlocoExport>,
    val pagina: ConfiguracaoPagina = ConfiguracaoPagina(),
    val estiloBibliografico: EstiloBibliografico = EstiloBibliografico.ABNT,
    val referencias: List<ReferenciaAcademica> = emptyList(),
    val notasRodape: List<NotaRodapeExport> = emptyList()
)

data class NotaRodapeExport(val id: String, val texto: String)

/** Imagem já resolvida para exportação. */
class ImagemExport(val bytes: ByteArray, val extensao: String, val largura: Int, val altura: Int) {
    val mime: String get() = if (extensao == "png") "image/png" else "image/jpeg"
}

fun interface ResolvedorImagem {
    fun resolver(nome: String): ImagemExport?
}

/**
 * Exporta o documento do app para DOCX (Office Open XML, sem bibliotecas) e HTML paginado (PDF via impressão).
 * Geometria ABNT: A4, margens 3/3/2/2 cm, Times 12 pt, entrelinha 1,5, recuo de 1ª linha 1,25 cm,
 * citação longa recuada 4 cm em 10 pt.
 */
object ExportadorDocumento {

    private val referenciaCruzada = Regex("\\[ref:(figura|tabela|quadro|formula):([a-zA-Z0-9_-]+)]", RegexOption.IGNORE_CASE)
    private val referenciaNota = Regex("\\[nota:([a-zA-Z0-9_-]+)]")

    private fun notasUsadas(doc: DocumentoExport): Map<String, Pair<Int, String>> {
        val notas = doc.notasRodape.associateBy { it.id }
        return buildMap {
            doc.blocos.filter { it.tipo == TipoBlocoExport.PARAGRAFO || it.tipo == TipoBlocoExport.CITACAO }.forEach { bloco ->
                referenciaNota.findAll(bloco.texto).forEach { marca ->
                    val id = marca.groupValues[1]
                    notas[id]?.let { nota -> if (id !in this) put(id, size + 1 to nota.texto) }
                }
            }
        }
    }

    private fun ancoraBloco(id: String) = "b_" + id.replace(Regex("[^a-zA-Z0-9_]"), "_").take(36)

    private fun rotulos(doc: DocumentoExport): Map<String, String> {
        val contagem = mutableMapOf<TipoBlocoExport, Int>()
        return buildMap {
            doc.blocos.forEach { bloco ->
                val nome = when (bloco.tipo) {
                    TipoBlocoExport.FIGURA -> "Figura"
                    TipoBlocoExport.TABELA -> "Tabela"
                    TipoBlocoExport.QUADRO -> "Quadro"
                    TipoBlocoExport.FORMULA -> "Equação"
                    else -> return@forEach
                }
                val numero = (contagem[bloco.tipo] ?: 0) + 1
                contagem[bloco.tipo] = numero
                if (bloco.id.isNotBlank()) put(bloco.id, if (bloco.tipo == TipoBlocoExport.FORMULA) "$nome ($numero)" else "$nome $numero")
            }
        }
    }

    private fun textoComReferenciasHtml(texto: String, rotulos: Map<String, String>, notas: Map<String, Pair<Int, String>>): String = buildString {
        val marcas = (referenciaCruzada.findAll(texto) + referenciaNota.findAll(texto)).sortedBy { it.range.first }
        var anterior = 0
        marcas.forEach { match ->
            append(html(texto.substring(anterior, match.range.first)))
            if (match.value.startsWith("[nota:")) {
                val nota = notas[match.groupValues[1]]
                if (nota == null) append(html(match.value))
                else append("<sup><a href=\"#nota-${nota.first}\">${nota.first}</a></sup>")
            } else {
                val id = match.groupValues[2]
                val rotulo = rotulos[id]
                if (rotulo == null) append(html(match.value))
                else append("<a href=\"#${ancoraBloco(id)}\">${html(rotulo)}</a>")
            }
            anterior = match.range.last + 1
        }
        append(html(texto.substring(anterior)))
    }

    // ------------------------------------------------------------------ DOCX

    fun gerarDocx(doc: DocumentoExport, imagens: ResolvedorImagem): ByteArray {
        require(doc.pagina.validar()) { "Configuração de página inválida." }
        val midias = mutableListOf<Pair<String, ImagemExport>>() // nome no zip -> imagem
        val corpo = StringBuilder()
        val temLista = doc.blocos.any { it.tipo == TipoBlocoExport.LISTA }
        val titulos = doc.blocos.filter { it.tipo == TipoBlocoExport.TITULO && it.titulo.isNotBlank() }
        val numerosTitulos = NumeracaoSecoes.calcular(titulos.map { it.nivelTitulo })
        val referenciasOrdenadas = Bibliografia.ordenar(doc.referencias, doc.estiloBibliografico)
        val rotulos = rotulos(doc)
        val notas = notasUsadas(doc)

        if (doc.titulo.isNotBlank()) corpo.append(par(doc.titulo, centro = true, negrito = true, tamanho = 32, depois = 120))
        if (doc.subtitulo.isNotBlank()) corpo.append(par(doc.subtitulo, centro = true, italico = true, tamanho = 26, depois = 120))
        if (doc.autores.isNotBlank()) corpo.append(par(doc.autores, centro = true, tamanho = 22, depois = 240))
        if (doc.resumo.isNotBlank()) {
            corpo.append(par("RESUMO", negrito = true, tamanho = 24, depois = 60))
            corpo.append(par(doc.resumo, justificado = true, simples = true, depois = 240))
        }

        var secao = 0
        var formula = 0
        var marcadorBlocoId = doc.referencias.size + 1
        for (b in doc.blocos) {
            if (b.id.isNotBlank() && b.tipo in setOf(TipoBlocoExport.FIGURA, TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO, TipoBlocoExport.FORMULA)) {
                corpo.append(par("", marcador = ancoraBloco(b.id), marcadorId = marcadorBlocoId++))
            }
            when (b.tipo) {
                TipoBlocoExport.TITULO -> {
                    if (b.titulo.isNotBlank()) {
                        secao++
                        corpo.append(par("${numerosTitulos[secao - 1]}  ${b.titulo.uppercase()}", negrito = true, tamanho = if (b.nivelTitulo == 1) 24 else 22, antes = 240, depois = 120, estilo = "Heading${b.nivelTitulo.coerceIn(1, 9)}"))
                    }
                }
                TipoBlocoExport.PARAGRAFO -> if (b.texto.isNotBlank()) {
                    corpo.append(par(b.texto, alinhamento = b.alinhamento, recuoPrimeira = 709, citacoes = b.citacoes, rotulos = rotulos, notas = notas))
                }
                TipoBlocoExport.CITACAO -> if (b.texto.isNotBlank()) {
                    corpo.append(par(b.texto, justificado = true, simples = true, tamanho = 20, recuoEsq = 2268, antes = 120, depois = 120, citacoes = b.citacoes, rotulos = rotulos, notas = notas))
                }
                TipoBlocoExport.FIGURA -> {
                    if (b.legenda.isNotBlank()) corpo.append(par(b.legenda, centro = true, negrito = true, tamanho = 20, simples = true, antes = 120, depois = 60, mantemProximo = true))
                    val img = if (b.imagem.isNotEmpty()) imagens.resolver(b.imagem) else null
                    if (img != null) {
                        val indice = midias.size + 1
                        midias += "image$indice.${img.extensao}" to img
                        corpo.append(paragrafoImagem(indice, img, doc.pagina))
                    }
                    if (b.fonte.isNotBlank()) corpo.append(par(b.fonte, centro = true, italico = true, tamanho = 20, simples = true, depois = 120))
                }
                TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO -> {
                    if (b.legenda.isNotBlank()) corpo.append(par(b.legenda, centro = true, negrito = true, tamanho = 20, simples = true, antes = 120, depois = 60, mantemProximo = true))
                    corpo.append(tabela(b.tabela, doc.pagina))
                    if (b.fonte.isNotBlank()) corpo.append(par(b.fonte, centro = true, italico = true, tamanho = 20, simples = true, antes = 60, depois = 120))
                }
                TipoBlocoExport.FORMULA -> {
                    formula++
                    corpo.append(par("${b.formula}          ($formula)", centro = true, antes = 120, depois = 120))
                }
                TipoBlocoExport.LISTA -> b.texto.lines().filter { it.isNotBlank() }.forEach { item ->
                    corpo.append(par(item.trim(), depois = 60, numId = if (b.listaNumerada) 2 else 1))
                }
                TipoBlocoExport.SUMARIO -> {
                    corpo.append(par("SUMÁRIO", negrito = true, antes = 120, depois = 120))
                    titulos.forEachIndexed { indice, titulo -> corpo.append(par("${numerosTitulos[indice]}  ${titulo.titulo}", depois = 60, recuoEsq = (titulo.nivelTitulo - 1).coerceAtLeast(0) * 200)) }
                }
                TipoBlocoExport.LISTA_ILUSTRACOES -> {
                    corpo.append(par("LISTA DE ILUSTRAÇÕES", negrito = true, antes = 120, depois = 120))
                    doc.blocos.filter { it.tipo in setOf(TipoBlocoExport.FIGURA, TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO) && it.legenda.isNotBlank() }
                        .forEach { figura -> corpo.append(par(figura.legenda, depois = 60)) }
                }
                TipoBlocoExport.REFERENCIAS -> {
                    corpo.append(par("REFERÊNCIAS", negrito = true, antes = 120, depois = 120))
                    referenciasOrdenadas.forEachIndexed { indice, ref ->
                        corpo.append(par(Bibliografia.formatar(ref, doc.estiloBibliografico, indice + 1), simples = true,
                            depois = 120, marcador = Bibliografia.ancora(ref.id), marcadorId = indice + 1))
                    }
                }
                TipoBlocoExport.CAMPOS -> {
                    if (b.titulo.isNotBlank()) corpo.append(par(b.titulo, negrito = true, antes = 120, depois = 80))
                    corpo.append(tabelaCampos(b.tabela, b.camposColunas, doc.pagina))
                }
                TipoBlocoExport.QUEBRA_PAGINA -> corpo.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>")
                TipoBlocoExport.ESPACO -> corpo.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"${(b.alturaPt.coerceIn(1.0, 720.0) * 20).toInt()}\" w:lineRule=\"exact\"/></w:pPr><w:r><w:t xml:space=\"preserve\"> </w:t></w:r></w:p>")
                TipoBlocoExport.DIVISOR -> corpo.append(
                    "<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"1\" w:color=\"94A3B8\"/></w:pBdr></w:pPr></w:p>"
                )
            }
        }

        val documento = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="$NS_W" xmlns:r="$NS_R" xmlns:wp="$NS_WP" xmlns:a="$NS_A" xmlns:pic="$NS_PIC"><w:body>$corpo<w:sectPr><w:pgSz w:w="${ConfiguracaoPagina.mmParaTwips(doc.pagina.larguraMm)}" w:h="${ConfiguracaoPagina.mmParaTwips(doc.pagina.alturaMm)}"${if (doc.pagina.paisagem) " w:orient=\"landscape\"" else ""}/><w:pgMar w:top="${ConfiguracaoPagina.mmParaTwips(doc.pagina.margemSuperiorMm)}" w:right="${ConfiguracaoPagina.mmParaTwips(doc.pagina.margemDireitaMm)}" w:bottom="${ConfiguracaoPagina.mmParaTwips(doc.pagina.margemInferiorMm)}" w:left="${ConfiguracaoPagina.mmParaTwips(doc.pagina.margemEsquerdaMm)}" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>"""

        val relsDoc = StringBuilder(
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>"""
        )
        if (temLista) relsDoc.append("<Relationship Id=\"rIdNumbering\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering\" Target=\"numbering.xml\"/>")
        if (notas.isNotEmpty()) relsDoc.append("<Relationship Id=\"rIdFootnotes\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes\" Target=\"footnotes.xml\"/>")
        midias.forEachIndexed { i, (nome, _) ->
            relsDoc.append("<Relationship Id=\"rIdImg${i + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/$nome\"/>")
        }
        relsDoc.append("</Relationships>")

        val extensoes = (midias.map { it.second.extensao }.toSet())
        val tipos = StringBuilder(
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>"""
        )
        extensoes.forEach { ext ->
            tipos.append("<Default Extension=\"$ext\" ContentType=\"${if (ext == "png") "image/png" else "image/jpeg"}\"/>")
        }
        tipos.append("<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>")
        tipos.append("<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/></Types>")
        if (temLista) tipos.insert(tipos.length - "</Types>".length, "<Override PartName=\"/word/numbering.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml\"/>")
        if (notas.isNotEmpty()) tipos.insert(tipos.length - "</Types>".length, "<Override PartName=\"/word/footnotes.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml\"/>")

        val raiz = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"""

        val estilos = buildString {
            append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="$NS_W"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>""")
            for (nivel in 1..9) append("<w:style w:type=\"paragraph\" w:styleId=\"Heading$nivel\"><w:name w:val=\"heading $nivel\"/><w:basedOn w:val=\"Normal\"/><w:next w:val=\"Normal\"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val=\"${nivel - 1}\"/></w:pPr></w:style>")
            append("</w:styles>")
        }

        val saida = ByteArrayOutputStream()
        ZipOutputStream(saida).use { zip ->
            fun entrada(nome: String, conteudo: ByteArray) {
                zip.putNextEntry(ZipEntry(nome)); zip.write(conteudo); zip.closeEntry()
            }
            entrada("[Content_Types].xml", tipos.toString().toByteArray())
            entrada("_rels/.rels", raiz.toByteArray())
            entrada("word/document.xml", documento.toByteArray())
            entrada("word/styles.xml", estilos.toByteArray())
            if (temLista) entrada("word/numbering.xml", numeracaoDocx.toByteArray())
            if (notas.isNotEmpty()) {
                val rodape = buildString {
                    append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:footnotes xmlns:w=\"$NS_W\">")
                    append("<w:footnote w:type=\"separator\" w:id=\"-1\"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>")
                    append("<w:footnote w:type=\"continuationSeparator\" w:id=\"0\"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>")
                    notas.values.forEach { (numero, conteudo) ->
                        append("<w:footnote w:id=\"$numero\"><w:p><w:r><w:footnoteRef/></w:r><w:r><w:t xml:space=\"preserve\"> ${xml(conteudo)}</w:t></w:r></w:p></w:footnote>")
                    }
                    append("</w:footnotes>")
                }
                entrada("word/footnotes.xml", rodape.toByteArray())
            }
            entrada("word/_rels/document.xml.rels", relsDoc.toString().toByteArray())
            midias.forEach { (nome, img) -> entrada("word/media/$nome", img.bytes) }
        }
        return saida.toByteArray()
    }

    private const val NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    private const val NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    private const val NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    private const val NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
    private const val NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"

    private val numeracaoDocx = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>"""

    private fun par(
        texto: String,
        centro: Boolean = false,
        justificado: Boolean = false,
        alinhamento: AlinhamentoExport? = null,
        negrito: Boolean = false,
        italico: Boolean = false,
        tamanho: Int = 24,
        simples: Boolean = false,
        recuoPrimeira: Int = 0,
        recuoEsq: Int = 0,
        antes: Int = 0,
        depois: Int = 0,
        mantemProximo: Boolean = false,
        numId: Int? = null,
        estilo: String? = null,
        citacoes: List<CitacaoInline> = emptyList(),
        rotulos: Map<String, String> = emptyMap(),
        notas: Map<String, Pair<Int, String>> = emptyMap(),
        marcador: String? = null,
        marcadorId: Int = 0
    ): String {
        val jc = when {
            centro -> "center"
            justificado -> "both"
            alinhamento == AlinhamentoExport.CENTRO || alinhamento == AlinhamentoExport.JUSTIFICADO_CENTRO -> "center"
            alinhamento == AlinhamentoExport.DIREITA || alinhamento == AlinhamentoExport.JUSTIFICADO_DIREITA -> "right"
            alinhamento == AlinhamentoExport.ESQUERDA -> "left"
            alinhamento == AlinhamentoExport.JUSTIFICADO || alinhamento == AlinhamentoExport.JUSTIFICADO_ESQUERDA -> "both"
            else -> "left"
        }
        val linha = if (simples) 240 else 360
        val ppr = buildString {
            estilo?.let { append("<w:pStyle w:val=\"$it\"/>") }
            if (mantemProximo) append("<w:keepNext/>")
            if (numId != null) append("<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"$numId\"/></w:numPr>")
            append("<w:spacing w:before=\"$antes\" w:after=\"$depois\" w:line=\"$linha\" w:lineRule=\"auto\"/>")
            if (recuoPrimeira > 0 || recuoEsq > 0) {
                append("<w:ind w:left=\"$recuoEsq\"${if (recuoPrimeira > 0) " w:firstLine=\"$recuoPrimeira\"" else ""}/>")
            }
            append("<w:jc w:val=\"$jc\"/>")
        }
        val rpr = buildString {
            if (negrito) append("<w:b/>")
            if (italico) append("<w:i/>")
            append("<w:sz w:val=\"$tamanho\"/>")
        }
        fun run(trecho: String): String {
            val partes = trecho.split("\n").joinToString("<w:br/>") { "<w:t xml:space=\"preserve\">${xml(it)}</w:t>" }
            return "<w:r><w:rPr>$rpr</w:rPr>$partes</w:r>"
        }
        fun runsComReferencias(trecho: String): String = buildString {
            val marcas = (referenciaCruzada.findAll(trecho) + referenciaNota.findAll(trecho)).sortedBy { it.range.first }
            var anterior = 0
            marcas.forEach { match ->
                if (match.range.first > anterior) append(run(trecho.substring(anterior, match.range.first)))
                if (match.value.startsWith("[nota:")) {
                    val nota = notas[match.groupValues[1]]
                    if (nota == null) append(run(match.value))
                    else append("<w:r><w:rPr><w:vertAlign w:val=\"superscript\"/></w:rPr><w:footnoteReference w:id=\"${nota.first}\"/></w:r>")
                } else {
                    val id = match.groupValues[2]
                    val rotulo = rotulos[id]
                    if (rotulo == null) append(run(match.value))
                    else append("<w:hyperlink w:anchor=\"${ancoraBloco(id)}\" w:history=\"1\">${run(rotulo)}</w:hyperlink>")
                }
                anterior = match.range.last + 1
            }
            if (anterior < trecho.length || isEmpty()) append(run(trecho.substring(anterior)))
        }
        val conteudo = buildString {
            var anterior = 0
            for (c in citacoes.sortedBy { it.inicio }) {
                if (c.inicio < anterior || c.fim > texto.length || c.fim <= c.inicio) continue
                if (c.inicio > anterior) append(runsComReferencias(texto.substring(anterior, c.inicio)))
                append("<w:hyperlink w:anchor=\"${Bibliografia.ancora(c.refId)}\" w:history=\"1\">")
                append(run(texto.substring(c.inicio, c.fim)))
                append("</w:hyperlink>")
                anterior = c.fim
            }
            if (anterior < texto.length || isEmpty()) append(runsComReferencias(texto.substring(anterior)))
        }
        val inicioMarcador = if (marcador != null) "<w:bookmarkStart w:id=\"$marcadorId\" w:name=\"$marcador\"/>" else ""
        val fimMarcador = if (marcador != null) "<w:bookmarkEnd w:id=\"$marcadorId\"/>" else ""
        return "<w:p><w:pPr>$ppr</w:pPr>$inicioMarcador$conteudo$fimMarcador</w:p>"
    }

    private fun tabela(linhas: List<List<String>>, pagina: ConfiguracaoPagina): String {
        if (linhas.isEmpty()) return ""
        val colunas = linhas.maxOf { it.size }.coerceAtLeast(1)
        val largura = ConfiguracaoPagina.mmParaTwips(pagina.larguraCorpoMm) / colunas
        val sb = StringBuilder("<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders><w:top w:val=\"single\" w:sz=\"8\" w:color=\"1E293B\"/><w:bottom w:val=\"single\" w:sz=\"8\" w:color=\"1E293B\"/></w:tblBorders></w:tblPr><w:tblGrid>")
        repeat(colunas) { sb.append("<w:gridCol w:w=\"$largura\"/>") }
        sb.append("</w:tblGrid>")
        linhas.forEachIndexed { i, linha ->
            sb.append("<w:tr>")
            for (c in 0 until colunas) {
                val celula = linha.getOrElse(c) { "" }
                val borda = if (i == 0) "<w:tcBorders><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"94A3B8\"/></w:tcBorders>" else ""
                sb.append("<w:tc><w:tcPr><w:tcW w:w=\"$largura\" w:type=\"dxa\"/>$borda</w:tcPr>")
                sb.append(par(celula, negrito = i == 0, tamanho = 22, simples = true, antes = 40, depois = 40))
                sb.append("</w:tc>")
            }
            sb.append("</w:tr>")
        }
        sb.append("</w:tbl>")
        return sb.toString()
    }

    private fun tabelaCampos(campos: List<List<String>>, colunas: Int, pagina: ConfiguracaoPagina): String {
        if (campos.isEmpty()) return ""
        val pares = colunas.coerceIn(1, 4)
        val largura = ConfiguracaoPagina.mmParaTwips(pagina.larguraCorpoMm) / (pares * 2)
        return buildString {
            append("<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr><w:tblGrid>")
            repeat(pares * 2) { append("<w:gridCol w:w=\"$largura\"/>") }
            append("</w:tblGrid>")
            campos.chunked(pares).forEach { grupo ->
                append("<w:tr>")
                repeat(pares) { indice ->
                    val campo = grupo.getOrNull(indice)
                    for (parte in 0..1) {
                        append("<w:tc><w:tcPr><w:tcW w:w=\"$largura\" w:type=\"dxa\"/></w:tcPr>")
                        append(par(campo?.getOrNull(parte).orEmpty(), negrito = parte == 0, tamanho = 20, simples = true, antes = 30, depois = 30))
                        append("</w:tc>")
                    }
                }
                append("</w:tr>")
            }
            append("</w:tbl>")
        }
    }

    private fun paragrafoImagem(indice: Int, img: ImagemExport, pagina: ConfiguracaoPagina): String {
        val larguraMaxEmu = (minOf(150.0, pagina.larguraCorpoMm) * 36_000).toLong()
        val alturaMaxEmu = (minOf(180.0, pagina.alturaCorpoMm) * 36_000).toLong()
        val proporcao = img.altura.toDouble() / img.largura.coerceAtLeast(1)
        var cx = larguraMaxEmu
        var cy = (cx * proporcao).toLong()
        if (cy > alturaMaxEmu) { cy = alturaMaxEmu; cx = (cy / proporcao).toLong() }
        return "<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">" +
            "<wp:extent cx=\"$cx\" cy=\"$cy\"/><wp:docPr id=\"$indice\" name=\"Figura $indice\"/>" +
            "<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic>" +
            "<pic:nvPicPr><pic:cNvPr id=\"$indice\" name=\"image$indice.${img.extensao}\"/><pic:cNvPicPr/></pic:nvPicPr>" +
            "<pic:blipFill><a:blip r:embed=\"rIdImg$indice\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>" +
            "<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"$cx\" cy=\"$cy\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr>" +
            "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
    }

    // ------------------------------------------------------------------ HTML (PDF via impressão)

    fun gerarHtml(doc: DocumentoExport, imagens: ResolvedorImagem): String {
        require(doc.pagina.validar()) { "Configuração de página inválida." }
        val titulos = doc.blocos.filter { it.tipo == TipoBlocoExport.TITULO && it.titulo.isNotBlank() }
        val numerosTitulos = NumeracaoSecoes.calcular(titulos.map { it.nivelTitulo })
        val referenciasOrdenadas = Bibliografia.ordenar(doc.referencias, doc.estiloBibliografico)
        val rotulos = rotulos(doc)
        val notas = notasUsadas(doc)
        fun mm(valor: Double): String = java.lang.String.format(java.util.Locale.US, "%.2f", valor)
        val sb = StringBuilder()
        sb.append(
            """<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${html(doc.titulo)}</title><style>
@page { size: ${mm(doc.pagina.larguraMm)}mm ${mm(doc.pagina.alturaMm)}mm; margin: ${mm(doc.pagina.margemSuperiorMm)}mm ${mm(doc.pagina.margemDireitaMm)}mm ${mm(doc.pagina.margemInferiorMm)}mm ${mm(doc.pagina.margemEsquerdaMm)}mm; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }
h1.t { text-align: center; font-size: 16pt; margin: 0 0 6pt; }
p.st { text-align: center; font-style: italic; font-size: 13pt; margin: 0 0 6pt; }
p.au { text-align: center; font-size: 11pt; margin: 0 0 14pt; }
h2 { font-size: 12pt; text-transform: uppercase; margin: 14pt 0 6pt; break-after: avoid; }
p { margin: 0; text-align: justify; }
p.corpo { text-indent: 1.25cm; }
.cit { margin: 6pt 0 6pt 4cm; font-size: 10pt; line-height: 1.15; text-align: justify; }
.resumo { line-height: 1.15; margin-bottom: 14pt; }
figure { margin: 8pt 0; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: 18cm; }
figcaption, .leg { font-size: 10pt; line-height: 1.15; text-align: center; font-weight: bold; margin: 4pt 0; break-after: avoid; }
.fonte { font-size: 10pt; line-height: 1.15; text-align: center; font-style: italic; margin: 4pt 0 8pt; }
table { width: 100%; border-collapse: collapse; border-top: 1.2pt solid #1e293b; border-bottom: 1.2pt solid #1e293b; font-size: 11pt; line-height: 1.15; break-inside: avoid; }
.campos-grid { display: grid; gap: 4pt 10pt; margin: 6pt 0 10pt; break-inside: avoid; }
.campo-par { display: flex; gap: 4pt; font-size: 10pt; line-height: 1.2; }
th, td { padding: 3pt 4pt; text-align: left; }
th { border-bottom: 0.8pt solid #94a3b8; }
.formula { text-align: center; margin: 8pt 0; }
hr { border: 0; border-top: 0.8pt solid #94a3b8; margin: 10pt 0; }
</style></head><body>"""
        )
        if (doc.titulo.isNotBlank()) sb.append("<h1 class=\"t\">${html(doc.titulo)}</h1>")
        if (doc.subtitulo.isNotBlank()) sb.append("<p class=\"st\">${html(doc.subtitulo)}</p>")
        if (doc.autores.isNotBlank()) sb.append("<p class=\"au\">${html(doc.autores)}</p>")
        if (doc.resumo.isNotBlank()) sb.append("<div class=\"resumo\"><b>RESUMO</b><p>${html(doc.resumo)}</p></div>")

        var secao = 0
        var formula = 0
        var ilustracao = 0
        for (b in doc.blocos) {
            if (b.id.isNotBlank() && b.tipo in setOf(TipoBlocoExport.FIGURA, TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO, TipoBlocoExport.FORMULA)) {
                sb.append("<span id=\"${ancoraBloco(b.id)}\"></span>")
            }
            if (b.tipo in setOf(TipoBlocoExport.FIGURA, TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO) && b.legenda.isNotBlank()) {
                ilustracao++
                sb.append("<span id=\"ilustracao-$ilustracao\"></span>")
            }
            val alinha = when (b.alinhamento) {
                AlinhamentoExport.ESQUERDA -> "left"
                AlinhamentoExport.CENTRO -> "center"
                AlinhamentoExport.DIREITA -> "right"
                else -> "justify"
            }
            val ultimaLinha = when (b.alinhamento) {
                AlinhamentoExport.ESQUERDA, AlinhamentoExport.JUSTIFICADO_ESQUERDA -> "left"
                AlinhamentoExport.CENTRO, AlinhamentoExport.JUSTIFICADO_CENTRO -> "center"
                AlinhamentoExport.DIREITA, AlinhamentoExport.JUSTIFICADO_DIREITA -> "right"
                AlinhamentoExport.JUSTIFICADO -> "auto"
            }
            when (b.tipo) {
                TipoBlocoExport.TITULO -> if (b.titulo.isNotBlank()) {
                    secao++
                    val nivelHtml = (b.nivelTitulo + 1).coerceAtMost(6)
                    sb.append("<h$nivelHtml id=\"secao-$secao\">${numerosTitulos[secao - 1]}&nbsp; ${html(b.titulo)}</h$nivelHtml>")
                }
                TipoBlocoExport.PARAGRAFO -> if (b.texto.isNotBlank()) sb.append("<p class=\"corpo\" style=\"text-align:$alinha;text-align-last:$ultimaLinha\">${htmlComCitacoes(b.texto, b.citacoes, rotulos, notas)}</p>")
                TipoBlocoExport.LISTA -> if (b.texto.isNotBlank()) {
                    val tag = if (b.listaNumerada) "ol" else "ul"
                    sb.append("<$tag>")
                    b.texto.lines().filter { it.isNotBlank() }.forEach { sb.append("<li>${html(it.trim())}</li>") }
                    sb.append("</$tag>")
                }
                TipoBlocoExport.SUMARIO -> {
                    sb.append("<nav aria-label=\"Sumário\"><h2>SUMÁRIO</h2><ol>")
                    titulos.forEachIndexed { indice, titulo -> sb.append("<li style=\"margin-left:${(titulo.nivelTitulo - 1) * 5}mm\"><a href=\"#secao-${indice + 1}\">${numerosTitulos[indice]} ${html(titulo.titulo)}</a></li>") }
                    sb.append("</ol></nav>")
                }
                TipoBlocoExport.LISTA_ILUSTRACOES -> {
                    sb.append("<nav aria-label=\"Lista de ilustrações\"><h2>LISTA DE ILUSTRAÇÕES</h2><ul>")
                    doc.blocos.filter { it.tipo in setOf(TipoBlocoExport.FIGURA, TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO) && it.legenda.isNotBlank() }
                        .forEachIndexed { indice, figura -> sb.append("<li><a href=\"#ilustracao-${indice + 1}\">${html(figura.legenda)}</a></li>") }
                    sb.append("</ul></nav>")
                }
                TipoBlocoExport.REFERENCIAS -> {
                    sb.append("<section aria-label=\"Referências\"><h2>REFERÊNCIAS</h2>")
                    referenciasOrdenadas.forEachIndexed { indice, ref ->
                        sb.append("<p id=\"${Bibliografia.ancora(ref.id)}\">${html(Bibliografia.formatar(ref, doc.estiloBibliografico, indice + 1))}</p>")
                    }
                    sb.append("</section>")
                }
                TipoBlocoExport.CAMPOS -> {
                    sb.append("<section class=\"campos\">")
                    if (b.titulo.isNotBlank()) sb.append("<h2>${html(b.titulo)}</h2>")
                    sb.append("<div class=\"campos-grid\" style=\"grid-template-columns:repeat(${b.camposColunas.coerceIn(1, 4)},minmax(0,1fr))\">")
                    b.tabela.forEach { campo ->
                        sb.append("<div class=\"campo-par\"><strong>${html(campo.getOrNull(0).orEmpty())}</strong><span>${html(campo.getOrNull(1).orEmpty())}</span></div>")
                    }
                    sb.append("</div></section>")
                }
                TipoBlocoExport.QUEBRA_PAGINA -> sb.append("<div style=\"break-before:page\"></div>")
                TipoBlocoExport.ESPACO -> sb.append("<div aria-hidden=\"true\" style=\"height:${b.alturaPt.coerceIn(1.0, 720.0)}pt\"></div>")
                TipoBlocoExport.CITACAO -> if (b.texto.isNotBlank()) sb.append("<div class=\"cit\">${htmlComCitacoes(b.texto, b.citacoes, rotulos, notas)}</div>")
                TipoBlocoExport.FIGURA -> {
                    sb.append("<figure>")
                    if (b.legenda.isNotBlank()) sb.append("<figcaption>${html(b.legenda)}</figcaption>")
                    val img = if (b.imagem.isNotEmpty()) imagens.resolver(b.imagem) else null
                    if (img != null) {
                        val b64 = Base64.getEncoder().encodeToString(img.bytes)
                        sb.append("<img src=\"data:${img.mime};base64,$b64\">")
                    }
                    if (b.fonte.isNotBlank()) sb.append("<div class=\"fonte\">${html(b.fonte)}</div>")
                    sb.append("</figure>")
                }
                TipoBlocoExport.TABELA, TipoBlocoExport.QUADRO -> {
                    if (b.legenda.isNotBlank()) sb.append("<div class=\"leg\">${html(b.legenda)}</div>")
                    sb.append("<table>")
                    b.tabela.forEachIndexed { i, linha ->
                        sb.append("<tr>")
                        linha.forEach { c -> sb.append(if (i == 0) "<th>${html(c)}</th>" else "<td>${html(c)}</td>") }
                        sb.append("</tr>")
                    }
                    sb.append("</table>")
                    if (b.fonte.isNotBlank()) sb.append("<div class=\"fonte\">${html(b.fonte)}</div>")
                }
                TipoBlocoExport.FORMULA -> { formula++; sb.append("<div class=\"formula\">${html(b.formula)} &nbsp;&nbsp;&nbsp; ($formula)</div>") }
                TipoBlocoExport.DIVISOR -> sb.append("<hr>")
            }
        }
        if (notas.isNotEmpty()) {
            sb.append("<section aria-label=\"Notas de rodapé\" style=\"font-size:10pt;border-top:1px solid #64748B;margin-top:12pt\">")
            notas.values.forEach { (numero, conteudo) -> sb.append("<p id=\"nota-$numero\"><sup>$numero</sup> ${html(conteudo)}</p>") }
            sb.append("</section>")
        }
        sb.append("</body></html>")
        return sb.toString()
    }

    // ------------------------------------------------------------------ escapes

    internal fun xml(s: String): String = s
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
        // caracteres de controle inválidos em XML 1.0
        .filter { it == '\n' || it == '\t' || it >= ' ' }

    private fun html(s: String): String = s
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("\n", "<br>")

    private fun htmlComCitacoes(texto: String, citacoes: List<CitacaoInline>, rotulos: Map<String, String>, notas: Map<String, Pair<Int, String>>): String = buildString {
        var anterior = 0
        for (c in citacoes.sortedBy { it.inicio }) {
            if (c.inicio < anterior || c.fim > texto.length || c.fim <= c.inicio) continue
            append(textoComReferenciasHtml(texto.substring(anterior, c.inicio), rotulos, notas))
            append("<a href=\"#${Bibliografia.ancora(c.refId)}\" style=\"color:inherit;text-decoration:none\">")
            append(html(texto.substring(c.inicio, c.fim)))
            append("</a>")
            anterior = c.fim
        }
        append(textoComReferenciasHtml(texto.substring(anterior), rotulos, notas))
    }
}
