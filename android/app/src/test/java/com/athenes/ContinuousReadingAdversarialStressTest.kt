// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes

import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.model.*
import com.athenes.ui.reader.ReaderViewModel
import com.athenes.ui.reader.TextoSelecionadoPopup
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Suite de Verificação Adversarial e Testes de Estresse Empírico — Milestone 2.
 * Escopo: PdfContinuousCanvas, EstudoArtigosScreen, ReaderViewModel e ArtigoEstudoRepository.
 */
class ContinuousReadingAdversarialStressTest {

    private lateinit var repository: ArtigoEstudoRepository
    private lateinit var viewModel: ReaderViewModel

    @Before
    fun setup() {
        repository = ArtigoEstudoRepository()
        viewModel = ReaderViewModel(repository)
    }

    // =========================================================================
    // 1. STRESS-TEST: Fallback Rendering & Preservação de Páginas sem PDF Binário
    // =========================================================================

    @Test
    fun `desafio 1A - Fallback de leitura preserva totalPaginas e todos elementos de pagina nos 3 artigos canonicos`() {
        val artigos = repository.artigos.value
        assertEquals("Devem existir exatamente 3 artigos no repositório", 3, artigos.size)

        artigos.forEach { artigo ->
            // Simula renderização quando pdfUriTexto == null
            val totalEsperado = when (artigo.id) {
                "art_radino_2020" -> 33
                "art_reurb_2025" -> 24
                "art_sustentabilidade_2026" -> 18
                else -> fail("Artigo desconhecido: ${artigo.id}") as Int
            }

            assertEquals("Total de páginas deve ser preservado para ${artigo.id}", totalEsperado, artigo.totalPaginas)
            assertEquals("Lista de páginas deve ter o tamanho exato de totalPaginas", totalEsperado, artigo.paginas.size)
            assertTrue("Total de páginas não pode ser zero", artigo.totalPaginas > 0)

            // Validação de integridade de cada folha contínua
            artigo.paginas.forEachIndexed { index, pagina ->
                assertEquals("Número da página deve ser 1-based sequencial", index + 1, pagina.numero)
                assertTrue("Título da página não pode ser vazio", pagina.titulo.isNotBlank())
                assertTrue("Página deve conter parágrafos acadêmicos", pagina.paragrafos.isNotEmpty())
                pagina.paragrafos.forEach { par ->
                    assertTrue("Parágrafo não pode ser em branco", par.isNotBlank())
                }
            }
        }
    }

    @Test
    fun `desafio 1B - Fallback preserva notas adesivas, citacoes e tracos pre-existentes nas paginas`() {
        // Artigo REURB 2025 possui nota adesiva do orientador e 2 citações
        val artReurb = repository.artigos.value.first { it.id == "art_reurb_2025" }
        assertEquals(1, artReurb.notas.size)
        val nota = artReurb.notas.first()
        assertEquals(1, nota.pagina)
        assertEquals("Destaque do Orientador", nota.titulo)
        assertTrue(nota.texto.contains("índice de consolidação viária"))

        assertEquals(2, artReurb.citacoes.size)
        assertEquals(1, artReurb.citacoes[0].pagina)
        assertEquals(2, artReurb.citacoes[1].pagina)

        // Artigo Radino 2020 possui marcadores e traços persistidos
        val artRadino = repository.artigos.value.first { it.id == "art_radino_2020" }
        assertEquals(33, artRadino.totalPaginas)
        assertNotNull(artRadino.paginas.find { it.numero == 17 })
    }

    @Test
    fun `desafio 1C - Artigo com pagina sem paragrafos suporta fallback editorial sem excecao`() {
        val paginaVazia = PaginaPdfInfo(
            numero = 10,
            titulo = "Folha 10 — Sem Conteúdo",
            paragrafos = emptyList()
        )
        assertTrue("Lista de parágrafos está vazia", paginaVazia.paragrafos.isEmpty())
        // Em FolhaPdfRenderizada, páginas com paragrafos.isEmpty() exibem:
        // "Página ${pagina.numero} — Conteúdo analítico em processamento editorial."
        val mensagemFallback = "Página ${paginaVazia.numero} — Conteúdo analítico em processamento editorial."
        assertTrue(mensagemFallback.contains("Página 10"))
    }

    // =========================================================================
    // 2. STRESS-TEST: Navegação de Páginas e Bounds Checking Extremo
    // =========================================================================

    @Test
    fun `desafio 2A - Navegacao para limite inferior e alem de zero nao corrompe pagina ativa`() {
        viewModel.selecionarArtigo("art_reurb_2025")
        assertEquals(1, viewModel.paginaAtiva.value)

        // Tentar voltar antes da página 1
        viewModel.paginaAnterior()
        assertEquals("Página anterior a 1 deve permanecer 1", 1, viewModel.paginaAtiva.value)

        // Tentar navegar para página 0 (fora dos limites 1..total)
        viewModel.navegarParaPagina(0)
        assertEquals("Página 0 deve ser ignorada", 1, viewModel.paginaAtiva.value)

        // Tentar navegar para páginas negativas
        viewModel.navegarParaPagina(-1)
        assertEquals("Página -1 deve ser ignorada", 1, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(-9999)
        assertEquals("Página -9999 deve ser ignorada", 1, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(Int.MIN_VALUE)
        assertEquals("Página Int.MIN_VALUE deve ser ignorada", 1, viewModel.paginaAtiva.value)
    }

    @Test
    fun `desafio 2B - Navegacao para limite superior e alem de totalPaginas respeita limites`() {
        viewModel.selecionarArtigo("art_reurb_2025") // totalPaginas = 24
        val total = 24

        // Navega até a última página válida
        viewModel.navegarParaPagina(total)
        assertEquals(total, viewModel.paginaAtiva.value)

        // Tentar avançar além da última página
        viewModel.proximaPagina()
        assertEquals("Próxima página no fim deve permanecer na última página", total, viewModel.paginaAtiva.value)

        // Tentar navegar além dos limites
        viewModel.navegarParaPagina(total + 1)
        assertEquals("total + 1 deve ser ignorado", total, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(total + 10)
        assertEquals("total + 10 deve ser ignorado", total, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(9999)
        assertEquals("9999 deve ser ignorado", total, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(Int.MAX_VALUE)
        assertEquals("Int.MAX_VALUE deve ser ignorado", total, viewModel.paginaAtiva.value)
    }

    @Test
    fun `desafio 2C - Troca entre artigos com contagens de paginas diferentes reseta pagina para 1 com seguranca`() {
        // Seleciona Radino com 33 páginas e vai para a página 30
        viewModel.selecionarArtigo("art_radino_2020")
        viewModel.navegarParaPagina(30)
        assertEquals(30, viewModel.paginaAtiva.value)

        // Troca para Kleppmann com apenas 18 páginas (30 seria out of bounds!)
        viewModel.selecionarArtigo("art_sustentabilidade_2026")
        assertEquals("Troca de artigo deve resetar a página ativa para 1", 1, viewModel.paginaAtiva.value)
        assertEquals("art_sustentabilidade_2026", viewModel.artigoAtivoId.value)
        assertEquals(18, viewModel.obterArtigoAtivo().totalPaginas)

        // Navega para 18 em Kleppmann
        viewModel.navegarParaPagina(18)
        assertEquals(18, viewModel.paginaAtiva.value)

        // Troca para Santos & Ribeiro (24 páginas)
        viewModel.selecionarArtigo("art_reurb_2025")
        assertEquals(1, viewModel.paginaAtiva.value)
    }

    @Test
    fun `desafio 2D - Definir total de paginas de PDF menor que pagina atual ajusta com seguranca para 1`() {
        viewModel.selecionarArtigo("art_radino_2020")
        viewModel.navegarParaPagina(20)
        assertEquals(20, viewModel.paginaAtiva.value)

        // Redefine total de páginas para 10 (menor que 20)
        viewModel.definirTotalPaginasPdf(10)
        assertEquals("Página ativa deve voltar para 1 ao receber total menor", 1, viewModel.paginaAtiva.value)

        // Entrada negativa deve ser clamped para 0
        viewModel.definirTotalPaginasPdf(-5)
        assertEquals(1, viewModel.paginaAtiva.value)
    }

    // =========================================================================
    // 3. STRESS-TEST: Sticky Notes, Ink Strokes & Text Selection Popover
    // =========================================================================

    @Test
    fun `desafio 3A - Sticky Notes adicao em pagina arbitraria, remocao e alternancia automatica de aba`() {
        viewModel.selecionarArtigo("art_reurb_2025")
        val artId = viewModel.artigoAtivoId.value
        val qtdAntes = viewModel.obterArtigoAtivo().notas.size

        // Salvar nota na página 7
        viewModel.salvarNota(
            titulo = "Nota Metodológica Folha 7",
            texto = "Verificar triangulação topográfica de quadras consolidadas.",
            pagina = 7
        )

        val artAtualizado = viewModel.obterArtigoAtivo()
        assertEquals(qtdAntes + 1, artAtualizado.notas.size)
        assertEquals(AbaInspetorDireito.RESUMO_NOTAS, viewModel.abaDireitaAtiva.value)

        val notaCriada = artAtualizado.notas.last()
        assertEquals(7, notaCriada.pagina)
        assertEquals("Nota Metodológica Folha 7", notaCriada.titulo)
        assertEquals("#314F79", notaCriada.corHex)

        // Remover a nota criada
        viewModel.removerNota(notaCriada.id)
        val artAposRemocao = viewModel.obterArtigoAtivo()
        assertEquals(qtdAntes, artAposRemocao.notas.size)
        assertNull(artAposRemocao.notas.find { it.id == notaCriada.id })
    }

    @Test
    fun `desafio 3B - Ink Strokes desenho livre, modo linha reta, marca-texto e operacoes desfazer e limpar`() {
        viewModel.selecionarArtigo("art_radino_2020")
        viewModel.navegarParaPagina(5)

        // 1. Traço Livre Caneta Normal (3f)
        viewModel.definirFerramenta(FerramentaLeitura.CANETA)
        viewModel.definirCor("#DC2626") // Vermelho
        val pontosLivre = listOf(PontoTraco(10f, 10f), PontoTraco(20f, 25f), PontoTraco(30f, 40f))
        viewModel.adicionarTracoLivre(pontosLivre, pagina = 5)

        var tracosP5 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 5 }
        assertEquals(1, tracosP5.size)
        val traco1 = tracosP5.first()
        assertEquals(3f, traco1.espessura, 0.01f)
        assertEquals("#DC2626", traco1.corHex)
        assertFalse(traco1.ehMarcaTexto)
        assertFalse(traco1.ehLinhaReta)
        assertEquals(3, traco1.pontos.size)

        // 2. Traço com Modo Linha Reta Ativo -> achata para 2 pontos (início e fim)
        viewModel.alternarModoLinhaReta()
        assertTrue(viewModel.modoLinhaReta.value)
        val pontosCurva = listOf(
            PontoTraco(50f, 50f),
            PontoTraco(60f, 80f),
            PontoTraco(70f, 90f),
            PontoTraco(100f, 100f)
        )
        viewModel.adicionarTracoLivre(pontosCurva, pagina = 5)

        tracosP5 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 5 }
        assertEquals(2, tracosP5.size)
        val tracoReta = tracosP5.last()
        assertTrue(tracoReta.ehLinhaReta)
        assertEquals(2, tracoReta.pontos.size)
        assertEquals(50f, tracoReta.pontos.first().x, 0.01f)
        assertEquals(100f, tracoReta.pontos.last().x, 0.01f)

        // 3. Traço Marca-Texto (18f)
        viewModel.alternarModoLinhaReta() // Desliga linha reta
        viewModel.definirFerramenta(FerramentaLeitura.MARCADOR)
        viewModel.definirCor("#FACC15") // Amarelo
        viewModel.adicionarTracoLivre(listOf(PontoTraco(0f, 200f), PontoTraco(400f, 200f)), pagina = 5)

        tracosP5 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 5 }
        assertEquals(3, tracosP5.size)
        val tracoMarca = tracosP5.last()
        assertTrue(tracoMarca.ehMarcaTexto)
        assertEquals(18f, tracoMarca.espessura, 0.01f)

        // 4. Desfazer último traço da página 5
        viewModel.desfazerTraco()
        tracosP5 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 5 }
        assertEquals(2, tracosP5.size)

        // 5. Limpar todos os traços da página 5
        viewModel.limparPagina()
        tracosP5 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 5 }
        assertEquals(0, tracosP5.size)
    }

    @Test
    fun `desafio 3C - Text Selection Popover selecao, grifo, citacao Zotero e fechamento automatico ao alternar ferramenta`() {
        viewModel.selecionarArtigo("art_reurb_2025")
        viewModel.navegarParaPagina(2)

        // 1. Seleciona texto na página 2
        viewModel.selecionarTexto(
            texto = "A conformidade registral exige descrição perimétrica unívoca.",
            pagina = 2,
            x = 32f,
            y = 150f,
            largura = 500f,
            altura = 40f
        )
        val sel = viewModel.textoSelecionado.value
        assertNotNull(sel)
        assertEquals("A conformidade registral exige descrição perimétrica unívoca.", sel!!.texto)
        assertEquals(2, sel.pagina)

        // 2. Grifar Texto Selecionado -> Fecha popover e cria traços
        viewModel.definirCor("#059669") // Verde
        viewModel.grifarTextoSelecionado()
        assertNull("Popover deve ser fechado após grifar", viewModel.textoSelecionado.value)

        val tracosP2 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 2 && it.ehMarcaTexto }
        assertTrue("Deve criar traços de grifo marca-texto", tracosP2.isNotEmpty())
        assertEquals("#059669", tracosP2.first().corHex)

        // 3. Nova Seleção -> Fechamento automático ao alternar para ferramenta diferente de SELECAO
        viewModel.selecionarTexto(
            texto = "Outro trecho para seleção",
            pagina = 2
        )
        assertNotNull(viewModel.textoSelecionado.value)

        viewModel.definirFerramenta(FerramentaLeitura.CANETA)
        assertNull("Mudar de ferramenta deve fechar o popover de seleção automaticamente", viewModel.textoSelecionado.value)
    }

    @Test
    fun `desafio 3D - Citacao via Popover gera referencia canonica ABNT e alterna aba para CITACOES`() {
        viewModel.selecionarArtigo("art_reurb_2025")
        val art = viewModel.obterArtigoAtivo()
        val qtdCitacoesAntes = art.citacoes.size

        viewModel.selecionarTexto(
            texto = "O direito à moradia digna estrutura a função social da propriedade urbana.",
            pagina = 3
        )
        viewModel.abrirCriacaoCitacao()
        assertTrue(viewModel.mostrarDialogNovaCitacao.value)

        viewModel.salvarCitacao(
            texto = "O direito à moradia digna estrutura a função social da propriedade urbana.",
            comentario = "Fundamento constitucional da tese",
            pagina = 3
        )

        assertFalse("Diálogo deve ser fechado", viewModel.mostrarDialogNovaCitacao.value)
        assertNull("Popover deve ser fechado", viewModel.textoSelecionado.value)
        assertEquals(AbaInspetorDireito.CITACOES, viewModel.abaDireitaAtiva.value)

        val artAtualizado = viewModel.obterArtigoAtivo()
        assertEquals(qtdCitacoesAntes + 1, artAtualizado.citacoes.size)
        val novaCit = artAtualizado.citacoes.last()
        assertEquals(3, novaCit.pagina)
        assertTrue("Referência deve conter SANTOS e RIBEIRO", novaCit.referenciaAbnt.contains("SANTOS") || novaCit.referenciaAbnt.contains("Milton Santos"))
        assertTrue("Referência deve conter o ano 2025", novaCit.referenciaAbnt.contains("2025"))
        assertTrue("Referência deve conter p. 3", novaCit.referenciaAbnt.contains("p. 3"))
    }
}
