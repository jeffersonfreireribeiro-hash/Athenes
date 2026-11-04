package com.athenes.core.export

import com.athenes.core.model.ConfiguracaoPagina
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Bloco do documento em forma neutra (sem Android), para exportação. */
data class BlocoExport(
    val tipo: TipoBlocoExport,
    val titulo: String = "",
    val texto: String = "",
    val legenda: String = "",
    val fonte: String = "",
    val formula: String = "",
    val imagem: String = "",
    val alinhamento: AlinhamentoExport = AlinhamentoExport.JUSTIFICADO,
    val tabela: List<List<String>> = emptyList()
)

enum class TipoBlocoExport { TITULO, PARAGRAFO, CITACAO, FIGURA, TABELA, FORMULA, DIVISOR }
enum class AlinhamentoExport { ESQUERDA, CENTRO, DIREITA, JUSTIFICADO }

data class DocumentoExport(
    val titulo: String,
    val subtitulo: String,
    val autores: String,
    val resumo: String,
    val blocos: List<BlocoExport>,
    val pagina: ConfiguracaoPagina = ConfiguracaoPagina()
)

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

    // ------------------------------------------------------------------ DOCX

    fun gerarDocx(doc: DocumentoExport, imagens: ResolvedorImagem): ByteArray {
        require(doc.pagina.validar()) { "Configuração de página inválida." }
        val midias = mutableListOf<Pair<String, ImagemExport>>() // nome no zip -> imagem
        val corpo = StringBuilder()

        if (doc.titulo.isNotBlank()) corpo.append(par(doc.titulo, centro = true, negrito = true, tamanho = 32, depois = 120))
        if (doc.subtitulo.isNotBlank()) corpo.append(par(doc.subtitulo, centro = true, italico = true, tamanho = 26, depois = 120))
        if (doc.autores.isNotBlank()) corpo.append(par(doc.autores, centro = true, tamanho = 22, depois = 240))
        if (doc.resumo.isNotBlank()) {
            corpo.append(par("RESUMO", negrito = true, tamanho = 24, depois = 60))
            corpo.append(par(doc.resumo, justificado = true, simples = true, depois = 240))
        }

        var secao = 0
        var formula = 0
        for (b in doc.blocos) {
            when (b.tipo) {
                TipoBlocoExport.TITULO -> {
                    secao++
                    corpo.append(par("$secao  ${b.titulo.uppercase()}", negrito = true, tamanho = 24, antes = 240, depois = 120, estilo = "Heading1"))
                }
                TipoBlocoExport.PARAGRAFO -> if (b.texto.isNotBlank()) {
                    corpo.append(par(b.texto, alinhamento = b.alinhamento, recuoPrimeira = 709))
                }
                TipoBlocoExport.CITACAO -> if (b.texto.isNotBlank()) {
                    corpo.append(par(b.texto, justificado = true, simples = true, tamanho = 20, recuoEsq = 2268, antes = 120, depois = 120))
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
                TipoBlocoExport.TABELA -> {
                    if (b.legenda.isNotBlank()) corpo.append(par(b.legenda, centro = true, negrito = true, tamanho = 20, simples = true, antes = 120, depois = 60, mantemProximo = true))
                    corpo.append(tabela(b.tabela, doc.pagina))
                    if (b.fonte.isNotBlank()) corpo.append(par(b.fonte, centro = true, italico = true, tamanho = 20, simples = true, antes = 60, depois = 120))
                }
                TipoBlocoExport.FORMULA -> {
                    formula++
                    corpo.append(par("${b.formula}          ($formula)", centro = true, antes = 120, depois = 120))
                }
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

        val raiz = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"""

        val estilos = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="$NS_W"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>"""

        val saida = ByteArrayOutputStream()
        ZipOutputStream(saida).use { zip ->
            fun entrada(nome: String, conteudo: ByteArray) {
                zip.putNextEntry(ZipEntry(nome)); zip.write(conteudo); zip.closeEntry()
            }
            entrada("[Content_Types].xml", tipos.toString().toByteArray())
            entrada("_rels/.rels", raiz.toByteArray())
            entrada("word/document.xml", documento.toByteArray())
            entrada("word/styles.xml", estilos.toByteArray())
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
        estilo: String? = null
    ): String {
        val jc = when {
            centro -> "center"
            justificado -> "both"
            alinhamento == AlinhamentoExport.CENTRO -> "center"
            alinhamento == AlinhamentoExport.DIREITA -> "right"
            alinhamento == AlinhamentoExport.ESQUERDA -> "left"
            alinhamento == AlinhamentoExport.JUSTIFICADO -> "both"
            else -> "left"
        }
        val linha = if (simples) 240 else 360
        val ppr = buildString {
            estilo?.let { append("<w:pStyle w:val=\"$it\"/>") }
            if (mantemProximo) append("<w:keepNext/>")
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
        // Quebras de linha viram <w:br/>; o restante é escapado.
        val partes = texto.split("\n").joinToString("<w:br/>") { "<w:t xml:space=\"preserve\">${xml(it)}</w:t>" }
        return "<w:p><w:pPr>$ppr</w:pPr><w:r><w:rPr>$rpr</w:rPr>$partes</w:r></w:p>"
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
        for (b in doc.blocos) {
            val alinha = when (b.alinhamento) {
                AlinhamentoExport.ESQUERDA -> "left"; AlinhamentoExport.CENTRO -> "center"
                AlinhamentoExport.DIREITA -> "right"; AlinhamentoExport.JUSTIFICADO -> "justify"
            }
            when (b.tipo) {
                TipoBlocoExport.TITULO -> { secao++; sb.append("<h2>$secao&nbsp; ${html(b.titulo)}</h2>") }
                TipoBlocoExport.PARAGRAFO -> if (b.texto.isNotBlank()) sb.append("<p class=\"corpo\" style=\"text-align:$alinha\">${html(b.texto)}</p>")
                TipoBlocoExport.CITACAO -> if (b.texto.isNotBlank()) sb.append("<div class=\"cit\">${html(b.texto)}</div>")
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
                TipoBlocoExport.TABELA -> {
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
}
