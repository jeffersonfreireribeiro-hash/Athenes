package com.athenes

import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.model.AbaInspetorDireito
import com.athenes.core.model.FerramentaLeitura
import com.athenes.core.model.PontoTraco
import com.athenes.core.model.ZoteroVinculoConfig
import com.athenes.ui.reader.ReaderViewModel
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ReaderTest {

    private lateinit var repository: ArtigoEstudoRepository
    private lateinit var viewModel: ReaderViewModel

    @Before
    fun setup() {
        repository = ArtigoEstudoRepository()
        viewModel = ReaderViewModel(repository)
    }

    @Test
    fun testArtigosIniciaisCarregados() {
        val artigos = viewModel.artigos.value
        assertTrue("Deve haver artigos acadêmicos carregados", artigos.isNotEmpty())

        val artigoAtivo = viewModel.obterArtigoAtivo()
        assertTrue("Artigo ativo deve ser o Acoustic Performance-Based Design", artigoAtivo.titulo.contains("Acoustic"))
        assertEquals("Deve possuir 33 páginas de estudo", 33, artigoAtivo.totalPaginas)
        assertEquals("Chave Zotero deve ser JKCLFWH6", "JKCLFWH6", artigoAtivo.chaveZotero)
        assertEquals("User ID Zotero deve ser 18806479", "18806479", artigoAtivo.zoteroConfig.userId)
        assertTrue("Deve possuir citação inicial marcada", artigoAtivo.citacoes.isNotEmpty())
    }

    @Test
    fun testNavegacaoEntrePaginas() {
        assertEquals(1, viewModel.paginaAtiva.value)

        viewModel.proximaPagina()
        assertEquals(2, viewModel.paginaAtiva.value)

        viewModel.navegarParaPagina(17)
        assertEquals(17, viewModel.paginaAtiva.value)

        viewModel.paginaAnterior()
        assertEquals(16, viewModel.paginaAtiva.value)

        // Limite inferior
        viewModel.navegarParaPagina(1)
        viewModel.paginaAnterior()
        assertEquals(1, viewModel.paginaAtiva.value)
    }

    @Test
    fun testAlternarPaineisIndependentemente() {
        assertFalse(viewModel.painelEsquerdoAberto.value)
        assertFalse(viewModel.painelDireitoAberto.value)

        viewModel.alternarPainelEsquerdo()
        assertTrue("Painel esquerdo deve abrir", viewModel.painelEsquerdoAberto.value)
        assertFalse("Painel direito deve continuar fechado", viewModel.painelDireitoAberto.value)

        viewModel.alternarPainelDireito()
        assertTrue("Ambos abertos", viewModel.painelDireitoAberto.value)

        viewModel.alternarPainelEsquerdo()
        assertFalse("Painel esquerdo fechado", viewModel.painelEsquerdoAberto.value)
    }

    @Test
    fun testPaletaSeisCores() {
        assertEquals(6, viewModel.coresDisponiveis.size)
        assertTrue("Azul Marinho Athenes deve estar disponível", viewModel.coresDisponiveis.contains("#314F79"))
        assertTrue("Vermelho deve estar disponível", viewModel.coresDisponiveis.contains("#DC2626"))
        assertTrue("Verde deve estar disponível", viewModel.coresDisponiveis.contains("#059669"))
        assertTrue("Laranja deve estar disponível", viewModel.coresDisponiveis.contains("#D97706"))
        assertTrue("Roxo deve estar disponível", viewModel.coresDisponiveis.contains("#7C3AED"))
        assertTrue("Amarelo deve estar disponível", viewModel.coresDisponiveis.contains("#FACC15"))

        // Testar seleção de cada cor
        viewModel.definirCor("#DC2626")
        assertEquals("#DC2626", viewModel.corAtiva.value)

        viewModel.definirCor("#059669")
        assertEquals("#059669", viewModel.corAtiva.value)

        viewModel.definirCor("#314F79")
        assertEquals("#314F79", viewModel.corAtiva.value)
    }

    @Test
    fun testAdicionarECopiarCitacao() {
        val qtdAntes = viewModel.obterArtigoAtivo().citacoes.size

        viewModel.salvarCitacao(
            texto = "O design paramétrico permite otimizar a resposta acústica do ambiente.",
            comentario = "Fundamentação teórica",
            pagina = 2
        )

        val artigoAtualizado = viewModel.obterArtigoAtivo()
        assertEquals(qtdAntes + 1, artigoAtualizado.citacoes.size)
        assertEquals(AbaInspetorDireito.CITACOES, viewModel.abaDireitaAtiva.value)

        val citacaoAdicionada = artigoAtualizado.citacoes.last()
        assertTrue(citacaoAdicionada.referenciaAbnt.contains("RADINO, 2020, p. 2"))

        // Remover citação
        viewModel.removerCitacao(citacaoAdicionada.id)
        assertEquals(qtdAntes, viewModel.obterArtigoAtivo().citacoes.size)
    }

    @Test
    fun testAdicionarTracoEDesfazer() {
        val artId = viewModel.obterArtigoAtivo().id
        viewModel.navegarParaPagina(3)

        viewModel.adicionarTracoLivre(
            listOf(PontoTraco(10f, 10f), PontoTraco(20f, 20f), PontoTraco(30f, 30f))
        )

        val tracosP3 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 3 }
        assertEquals(1, tracosP3.size)

        viewModel.desfazerTraco()
        val tracosAposDesfazer = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 3 }
        assertEquals(0, tracosAposDesfazer.size)
    }

    @Test
    fun testSincronizarConfigZoteroDrive() {
        val novaConfig = ZoteroVinculoConfig(
            apiKey = "CHAVE_TESTE_ABC",
            userId = "998877",
            itemKey = "ITEM_NOVO_123",
            doi = "10.1000/teste",
            driveStatus = "Drive OK ✓",
            driveFileName = "artigo_teste.pdf"
        )

        viewModel.salvarConfigZoteroDrive(novaConfig)
        val artAtualizado = viewModel.obterArtigoAtivo()
        assertEquals("CHAVE_TESTE_ABC", artAtualizado.zoteroConfig.apiKey)
        assertEquals("998877", artAtualizado.zoteroConfig.userId)
        assertEquals("ITEM_NOVO_123", artAtualizado.zoteroConfig.itemKey)
    }

    @Test
    fun testStylusDetectionAndPalmRejectionToggle() {
        // Estado Inicial: Palm Rejection desligado e stylus ainda não detectada
        assertFalse(viewModel.modoSomenteStylus.value)
        assertFalse(viewModel.stylusDetectada.value)

        // Alternar manualmente nas Configurações para Modo Somente Caneta / Rejeição de Palma
        viewModel.alternarModoSomenteStylus()
        assertTrue("Modo Stylus exclusivo deve estar ativo nas configurações", viewModel.modoSomenteStylus.value)

        // Alternar de volta para Dedo + Caneta
        viewModel.alternarModoSomenteStylus()
        assertFalse("Modo Stylus exclusivo deve estar desligado", viewModel.modoSomenteStylus.value)

        // Detecção Automática e Silenciosa de Stylus / S-Pen ao encostar na tela (Estilo Samsung Notes - sem poluir a visão)
        viewModel.registrarStylusDetectada()
        assertTrue("Stylus detectada deve ser verdadeira", viewModel.stylusDetectada.value)
        assertTrue("Modo somente stylus deve ativar automaticamente de forma 100% silenciosa", viewModel.modoSomenteStylus.value)
    }

    @Test
    fun testApagarTracosProximosComBorracha() {
        viewModel.navegarParaPagina(4)
        val artId = viewModel.obterArtigoAtivo().id

        // Traço 1 próximo a (100, 100)
        viewModel.adicionarTracoLivre(
            listOf(PontoTraco(100f, 100f), PontoTraco(110f, 110f))
        )
        // Traço 2 longe em (500, 500)
        viewModel.adicionarTracoLivre(
            listOf(PontoTraco(500f, 500f), PontoTraco(510f, 510f))
        )

        var tracosP4 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 4 }
        assertEquals("Devem existir 2 traços na página 4", 2, tracosP4.size)

        // Passar a borracha em (105, 105) com raio 25f
        viewModel.apagarTracosProximos(105f, 105f, raio = 25f)

        tracosP4 = viewModel.obterArtigoAtivo().tracos.filter { it.pagina == 4 }
        assertEquals("Deve restar apenas 1 traço (o que está distante)", 1, tracosP4.size)
        assertEquals(500f, tracosP4.first().pontos.first().x, 0.1f)
    }
}
