package com.athenes

import com.athenes.core.model.ConfiguracaoPagina
import com.athenes.core.model.ConfiguracaoPaginaCodec
import com.athenes.core.model.FormatoPagina
import com.athenes.core.model.NumeracaoSecoes
import com.athenes.core.export.AlinhamentoExport
import com.athenes.core.export.BlocoExport
import com.athenes.core.export.DocumentoExport
import com.athenes.core.export.ExportadorDocumento
import com.athenes.core.export.ImagemExport
import com.athenes.core.export.ResolvedorImagem
import com.athenes.core.export.TipoBlocoExport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory

class ExportadorTest {

    private val pixelPng = byteArrayOf(
        0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A // cabeçalho PNG (conteúdo irrelevante para o teste)
    )
    private val imagens = ResolvedorImagem { nome ->
        if (nome == "img_ok.png") ImagemExport(pixelPng, "png", 800, 400) else null
    }

    private fun documento() = DocumentoExport(
        titulo = "Análise & Diretrizes <2026>",
        subtitulo = "Subtítulo",
        autores = "Jefferson F. Ribeiro",
        resumo = "Resumo do trabalho.",
        blocos = listOf(
            BlocoExport(TipoBlocoExport.TITULO, titulo = "Introdução"),
            BlocoExport(TipoBlocoExport.PARAGRAFO, texto = "Texto com \"aspas\" e (SANTOS; RIBEIRO, 2025).", alinhamento = AlinhamentoExport.JUSTIFICADO),
            BlocoExport(TipoBlocoExport.CITACAO, texto = "Citação longa."),
            BlocoExport(TipoBlocoExport.FIGURA, legenda = "Figura 1 — x", fonte = "Fonte: autores", imagem = "img_ok.png"),
            BlocoExport(TipoBlocoExport.TABELA, legenda = "Tabela 1", tabela = listOf(listOf("A", "B"), listOf("1", "2"))),
            BlocoExport(TipoBlocoExport.FORMULA, formula = "x = y"),
            BlocoExport(TipoBlocoExport.DIVISOR)
        )
    )

    private fun entradas(zip: ByteArray): Map<String, ByteArray> {
        val mapa = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(zip)).use { z ->
            var e = z.nextEntry
            while (e != null) { mapa[e.name] = z.readBytes(); e = z.nextEntry }
        }
        return mapa
    }

    @Test
    fun `docx contem as partes obrigatorias e a imagem embutida`() {
        val partes = entradas(ExportadorDocumento.gerarDocx(documento(), imagens))
        listOf("[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels", "word/media/image1.png")
            .forEach { assertNotNull("falta $it", partes[it]) }
        assertTrue(String(partes["word/_rels/document.xml.rels"]!!).contains("media/image1.png"))
        assertTrue(String(partes["[Content_Types].xml"]!!).contains("image/png"))
    }

    @Test
    fun `document xml e bem formado e escapa caracteres especiais`() {
        val xml = String(entradas(ExportadorDocumento.gerarDocx(documento(), imagens))["word/document.xml"]!!)
        // Não lança exceção se o XML estiver bem formado
        val dom = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
            .newDocumentBuilder().parse(ByteArrayInputStream(xml.toByteArray()))
        assertNotNull(dom.documentElement)
        assertTrue(xml.contains("Análise &amp; Diretrizes &lt;2026&gt;"))
        assertTrue(xml.contains("&quot;aspas&quot;"))
        assertTrue(xml.contains("1  INTRODUÇÃO"))
        assertTrue(xml.contains("(1)")) // numeração da fórmula
    }

    @Test
    fun `figura sem arquivo resolvido nao quebra a exportacao`() {
        val doc = documento().copy(blocos = listOf(BlocoExport(TipoBlocoExport.FIGURA, legenda = "F", imagem = "inexistente.jpg")))
        val partes = entradas(ExportadorDocumento.gerarDocx(doc, imagens))
        assertEquals(null, partes["word/media/image1.jpg"])
    }

    @Test
    fun `html paginado traz pagina A4 margens ABNT e imagem em data uri`() {
        val html = ExportadorDocumento.gerarHtml(documento(), imagens)
        assertTrue(html.contains("@page { size: 210.00mm 297.00mm; margin: 30.00mm 20.00mm 20.00mm 30.00mm; }"))
        assertTrue(html.contains("data:image/png;base64,"))
        assertTrue(html.contains("Análise &amp; Diretrizes &lt;2026&gt;"))
        assertTrue(html.contains("<table>"))
    }

    @Test
    fun `pdf e docx usam formato e margens personalizados`() {
        val pagina = ConfiguracaoPagina(
            formato = FormatoPagina.CARTA, paisagem = true,
            margemSuperiorMm = 15.0, margemDireitaMm = 12.0,
            margemInferiorMm = 18.0, margemEsquerdaMm = 22.0
        )
        val doc = documento().copy(pagina = pagina)
        val html = ExportadorDocumento.gerarHtml(doc, imagens)
        assertTrue(html.contains("size: 279.40mm 215.90mm"))
        assertTrue(html.contains("margin: 15.00mm 12.00mm 18.00mm 22.00mm"))
        val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
        assertTrue(xml.contains("w:orient=\"landscape\""))
        assertTrue(xml.contains("w:w=\"${ConfiguracaoPagina.mmParaTwips(279.4)}\""))
        assertTrue(xml.contains("w:left=\"${ConfiguracaoPagina.mmParaTwips(22.0)}\""))
    }

    @Test
    fun `configuracao de pagina preserva medidas e rejeita corpo impossivel`() {
        val pagina = ConfiguracaoPagina(
            formato = FormatoPagina.PERSONALIZADO,
            larguraPersonalizadaMm = 160.0,
            alturaPersonalizadaMm = 230.0,
            margemEsquerdaMm = 24.0
        )
        assertEquals(pagina, ConfiguracaoPaginaCodec.ler(ConfiguracaoPaginaCodec.escrever(pagina)))
        assertTrue(!pagina.copy(margemEsquerdaMm = 100.0, margemDireitaMm = 100.0).validar())
        assertEquals(ConfiguracaoPagina(), ConfiguracaoPaginaCodec.ler(null))
    }

    @Test
    fun `sete alinhamentos editoriais saem no html e docx`() {
        val casos = listOf(
            AlinhamentoExport.ESQUERDA to Pair("left", "left"),
            AlinhamentoExport.CENTRO to Pair("center", "center"),
            AlinhamentoExport.DIREITA to Pair("right", "right"),
            AlinhamentoExport.JUSTIFICADO to Pair("justify", "auto"),
            AlinhamentoExport.JUSTIFICADO_ESQUERDA to Pair("justify", "left"),
            AlinhamentoExport.JUSTIFICADO_CENTRO to Pair("justify", "center"),
            AlinhamentoExport.JUSTIFICADO_DIREITA to Pair("justify", "right")
        )
        for ((alinhamento, css) in casos) {
            val doc = documento().copy(blocos = listOf(BlocoExport(TipoBlocoExport.PARAGRAFO, texto = "Texto de teste", alinhamento = alinhamento)))
            val html = ExportadorDocumento.gerarHtml(doc, imagens)
            assertTrue("HTML: $alinhamento", html.contains("text-align:${css.first};text-align-last:${css.second}"))
            val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
            val jc = when (alinhamento) {
                AlinhamentoExport.ESQUERDA -> "left"
                AlinhamentoExport.CENTRO, AlinhamentoExport.JUSTIFICADO_CENTRO -> "center"
                AlinhamentoExport.DIREITA, AlinhamentoExport.JUSTIFICADO_DIREITA -> "right"
                else -> "both"
            }
            assertTrue("DOCX: $alinhamento", xml.contains("<w:jc w:val=\"$jc\"/>"))
        }
    }

    @Test
    fun `lista e quebra de pagina aparecem no pdf e no word`() {
        val doc = documento().copy(blocos = listOf(
            BlocoExport(TipoBlocoExport.LISTA, texto = "Primeiro item\nSegundo item"),
            BlocoExport(TipoBlocoExport.QUEBRA_PAGINA),
            BlocoExport(TipoBlocoExport.PARAGRAFO, texto = "Página seguinte")
        ))
        val html = ExportadorDocumento.gerarHtml(doc, imagens)
        assertTrue(html.contains("<li>Primeiro item</li><li>Segundo item</li>"))
        assertTrue(html.contains("break-before:page"))
        val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
        assertTrue(xml.contains("<w:numId w:val=\"1\"/>"))
        assertTrue(xml.contains("Primeiro item"))
        assertTrue(xml.contains("Segundo item"))
        assertTrue(entradas(ExportadorDocumento.gerarDocx(doc, imagens)).containsKey("word/numbering.xml"))
        assertTrue(xml.contains("<w:br w:type=\"page\"/>"))
    }

    @Test
    fun `lista numerada e quadro preservam conteúdo nas exportações`() {
        val doc = documento().copy(blocos = listOf(
            BlocoExport(TipoBlocoExport.LISTA, texto = "Etapa um\nEtapa dois", listaNumerada = true),
            BlocoExport(TipoBlocoExport.QUADRO, legenda = "Quadro 1 — Conceitos", tabela = listOf(listOf("Termo", "Definição"), listOf("A", "B")))
        ))
        val html = ExportadorDocumento.gerarHtml(doc, imagens)
        assertTrue(html.contains("<ol><li>Etapa um</li><li>Etapa dois</li></ol>"))
        assertTrue(html.contains("Quadro 1 — Conceitos"))
        assertTrue(html.contains("<table>"))
        val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
        assertTrue(xml.contains("<w:numId w:val=\"2\"/>"))
        assertTrue(xml.contains("Etapa um"))
        assertTrue(xml.contains("Etapa dois"))
        val numeracao = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/numbering.xml"]!!)
        assertTrue(numeracao.contains("<w:numFmt w:val=\"decimal\"/>"))
        assertTrue(xml.contains("Quadro 1 — Conceitos"))
        assertTrue(xml.contains("<w:tbl>"))
    }

    @Test
    fun `sumario acompanha os titulos no html e docx`() {
        val doc = documento().copy(blocos = listOf(
            BlocoExport(TipoBlocoExport.SUMARIO),
            BlocoExport(TipoBlocoExport.TITULO, titulo = "Introdução"),
            BlocoExport(TipoBlocoExport.PARAGRAFO, texto = "Texto"),
            BlocoExport(TipoBlocoExport.TITULO, titulo = "Método")
        ))
        val html = ExportadorDocumento.gerarHtml(doc, imagens)
        assertTrue(html.contains("href=\"#secao-1\">1 Introdução</a>"))
        assertTrue(html.contains("href=\"#secao-2\">2 Método</a>"))
        assertTrue(html.contains("id=\"secao-2\""))
        val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
        assertTrue(xml.contains("SUMÁRIO"))
        assertTrue(xml.contains("1  Introdução"))
        assertTrue(xml.contains("2  Método"))
    }

    @Test
    fun `lista de ilustracoes acompanha legendas e cria links no html`() {
        val doc = documento().copy(blocos = listOf(
            BlocoExport(TipoBlocoExport.LISTA_ILUSTRACOES),
            BlocoExport(TipoBlocoExport.FIGURA, legenda = "Figura 1 — Mapa"),
            BlocoExport(TipoBlocoExport.TABELA, legenda = "Tabela 1 — Dados", tabela = listOf(listOf("A")))
        ))
        val html = ExportadorDocumento.gerarHtml(doc, imagens)
        assertTrue(html.contains("href=\"#ilustracao-1\">Figura 1 — Mapa</a>"))
        assertTrue(html.contains("href=\"#ilustracao-2\">Tabela 1 — Dados</a>"))
        assertTrue(html.contains("id=\"ilustracao-2\""))
        val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
        assertTrue(xml.contains("LISTA DE ILUSTRAÇÕES"))
        assertTrue(xml.contains("Figura 1 — Mapa"))
        assertTrue(xml.contains("Tabela 1 — Dados"))
    }

    @Test
    fun `titulos de varios niveis recebem numeracao decimal e entram no sumario`() {
        assertEquals(listOf("1", "1.1", "1.1.1", "1.2", "2", "2.1.1"), NumeracaoSecoes.calcular(listOf(1, 2, 3, 2, 1, 3)))
        val doc = documento().copy(blocos = listOf(
            BlocoExport(TipoBlocoExport.SUMARIO),
            BlocoExport(TipoBlocoExport.TITULO, titulo = "Introdução", nivelTitulo = 1),
            BlocoExport(TipoBlocoExport.TITULO, titulo = "Problema", nivelTitulo = 2),
            BlocoExport(TipoBlocoExport.TITULO, titulo = "Método", nivelTitulo = 1)
        ))
        val html = ExportadorDocumento.gerarHtml(doc, imagens)
        assertTrue(html.contains("1.1 Problema</a>"))
        assertTrue(html.contains("<h3 id=\"secao-2\">1.1&nbsp; Problema</h3>"))
        val xml = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/document.xml"]!!)
        assertTrue(xml.contains("1.1  Problema"))
        assertTrue(xml.contains("<w:pStyle w:val=\"Heading2\"/>"))
        val estilos = String(entradas(ExportadorDocumento.gerarDocx(doc, imagens))["word/styles.xml"]!!)
        assertTrue(estilos.contains("<w:outlineLvl w:val=\"1\"/>"))
    }
}
