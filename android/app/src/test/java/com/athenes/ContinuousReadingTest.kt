package com.athenes

import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.ui.reader.ReaderViewModel
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ContinuousReadingTest {

    private lateinit var repository: ArtigoEstudoRepository
    private lateinit var viewModel: ReaderViewModel

    @Before
    fun setup() {
        repository = ArtigoEstudoRepository()
        viewModel = ReaderViewModel(repository)
    }

    @Test
    fun testArtigosSincronizadosComWebContemParagrafosReais() {
        val artigos = repository.artigos.value
        assertEquals("Devem existir 3 artigos acadêmicos de referência inicial", 3, artigos.size)

        // Artigo 1: Acoustic Performance-Based Design (33 páginas)
        val art1 = artigos.first { it.id == "art_radino_2020" }
        assertEquals(33, art1.totalPaginas)
        assertTrue(art1.paginas.isNotEmpty())
        assertTrue("Folha 1 deve conter PBD introduction", art1.paginas[0].paragrafos.any { it.contains("Performance-based Design") })
        assertTrue("Folha 2 deve conter formação vs generativo", art1.paginas[1].paragrafos.any { it.contains("generative models") })
        assertTrue("Folha 3 deve conter métodos de acústica", art1.paginas[2].paragrafos.any { it.contains("Ray-Tracing") })

        // Artigo 2: REURB e Morfologia Urbana (Santos & Ribeiro, 2025 - zot_art_01)
        val art2 = artigos.first { it.id == "art_reurb_2025" }
        assertEquals("ZOT8K2M9", art2.chaveZotero)
        assertEquals(24, art2.totalPaginas)
        assertTrue(art2.titulo.contains("Regularização Fundiária Urbana"))
        assertTrue("Folha 1 deve conter texto do Santos & Ribeiro", art2.paginas[0].paragrafos.any { it.contains("precisão geométrica e da rastreabilidade social") })
        assertTrue("Folha 2 deve conter nota sobre notas devolutivas", art2.paginas[1].paragrafos.any { it.contains("notas devolutivas no registro de imóveis") })
        assertTrue("Folha 3 deve conter conclusões normativas", art2.paginas[2].paragrafos.any { it.contains("ambientes colaborativos capazes de unir rigor tipográfico") })

        // Citações pré-existentes de Santos & Ribeiro
        assertEquals("Deve conter 2 citações canônicas", 2, art2.citacoes.size)
        assertEquals("(SANTOS; RIBEIRO, 2025, p. 1)", art2.citacoes[0].referenciaAbnt)
        assertEquals("(SANTOS; RIBEIRO, 2025, p. 2)", art2.citacoes[1].referenciaAbnt)

        // Nota do orientador
        assertEquals("Deve conter 1 nota adesiva canônica", 1, art2.notas.size)
        assertEquals("Destaque do Orientador", art2.notas[0].titulo)
        assertEquals(62f, art2.notas[0].xPct, 0.01f)
        assertEquals(30f, art2.notas[0].yPct, 0.01f)

        // Artigo 3: CRDT e Editoração Científica (Kleppmann & Almeida, 2024 - zot_art_02)
        val art3 = artigos.first { it.id == "art_sustentabilidade_2026" }
        assertEquals("ZOT4P9L2", art3.chaveZotero)
        assertEquals(18, art3.totalPaginas)
        assertTrue("Folha 1 deve conter texto de Kleppmann & Almeida", art3.paginas[0].paragrafos.any { it.contains("estruturas de dados livres de conflito (CRDTs)") || it.contains("fricção cognitiva") })
        assertEquals("Deve conter citação marcada", 1, art3.citacoes.size)
        assertEquals("(KLEPPMANN; ALMEIDA, 2024, p. 1)", art3.citacoes[0].referenciaAbnt)
    }

    @Test
    fun testSelecionarArtigoPorChaveZoteroOuAliasWeb() {
        // Selecionar por chave Zotero
        repository.selecionarArtigo("ZOT8K2M9")
        assertEquals("art_reurb_2025", repository.artigoAtivoId.value)
        assertEquals("Regularização Fundiária Urbana e Morfologia de Assentamentos Consolidados na América Latina", repository.obterArtigoAtivo().titulo)

        // Selecionar por alias zot_art_01
        repository.selecionarArtigo("zot_art_01")
        assertEquals("art_reurb_2025", repository.artigoAtivoId.value)

        // Selecionar por alias zot_art_02
        repository.selecionarArtigo("zot_art_02")
        assertEquals("art_sustentabilidade_2026", repository.artigoAtivoId.value)

        // Selecionar por chave Zotero ZOT4P9L2
        repository.selecionarArtigo("ZOT4P9L2")
        assertEquals("art_sustentabilidade_2026", repository.artigoAtivoId.value)

        // Selecionar por id nativo art_radino_2020
        repository.selecionarArtigo("art_radino_2020")
        assertEquals("art_radino_2020", repository.artigoAtivoId.value)
    }

    @Test
    fun testArtigoRetemTotalPaginasEConteudoParaLeituraContinuaSemPdfBinario() {
        // Simula o comportamento de leitura contínua quando não há arquivo binário em SharedPreferences
        val artigo = repository.artigos.value.first { it.id == "art_reurb_2025" }
        assertTrue("Artigo deve ter páginas formatadas mesmo sem PDF vinculado", artigo.paginas.isNotEmpty())
        assertEquals(24, artigo.totalPaginas)

        // Confirma que os parágrafos estão disponíveis para FolhaPdfRenderizada e PdfContinuousCanvas
        artigo.paginas.forEach { pagina ->
            assertTrue("Página ${pagina.numero} deve conter parágrafos de texto acadêmico", pagina.paragrafos.isNotEmpty())
            assertTrue("Página ${pagina.numero} deve ter título descritivo", pagina.titulo.isNotBlank())
        }
    }

    @Test
    fun testNavegacaoDePaginasNoArtigoReurb() {
        viewModel.selecionarArtigo("art_reurb_2025")
        assertEquals("art_reurb_2025", viewModel.artigoAtivoId.value)
        assertEquals(1, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(10)
        assertEquals(10, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(24)
        assertEquals(24, viewModel.paginaAtiva.value)

        // Tentar avançar além da última página
        viewModel.proximaPagina()
        assertEquals(24, viewModel.paginaAtiva.value)

        // Voltar
        viewModel.paginaAnterior()
        assertEquals(23, viewModel.paginaAtiva.value)
    }
}
