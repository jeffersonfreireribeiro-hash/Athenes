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
        assertTrue(viewModel.painelEsquerdoAberto.value)
        assertTrue(viewModel.painelDireitoAberto.value)

        viewModel.alternarPainelEsquerdo()
        assertFalse("Painel esquerdo deve fechar", viewModel.painelEsquerdoAberto.value)
        assertTrue("Painel direito deve continuar aberto", viewModel.painelDireitoAberto.value)

        viewModel.alternarPainelDireito()
        assertFalse("Ambos fechados", viewModel.painelDireitoAberto.value)

        viewModel.alternarPainelEsquerdo()
        assertTrue("Painel esquerdo reaberto", viewModel.painelEsquerdoAberto.value)
    }

    @Test
    fun testPaletaSeisCores() {
        assertEquals(6, viewModel.coresDisponiveis.size)
        assertTrue("Amarelo deve estar disponível", viewModel.coresDisponiveis.contains("#FDE047"))
        assertTrue("Verde deve estar disponível", viewModel.coresDisponiveis.contains("#86EFAC"))
        assertTrue("Azul deve estar disponível", viewModel.coresDisponiveis.contains("#93C5FD"))
        assertTrue("Rosa/Vermelho deve estar disponível", viewModel.coresDisponiveis.contains("#FCA5A5"))
        assertTrue("Roxo deve estar disponível", viewModel.coresDisponiveis.contains("#D8B4FE"))
        assertTrue("Laranja deve estar disponível", viewModel.coresDisponiveis.contains("#FDBA74"))

        // Testar seleção de cada cor
        viewModel.definirCor("#86EFAC")
        assertEquals("#86EFAC", viewModel.corAtiva.value)

        viewModel.definirCor("#93C5FD")
        assertEquals("#93C5FD", viewModel.corAtiva.value)

        viewModel.definirCor("#D8B4FE")
        assertEquals("#D8B4FE", viewModel.corAtiva.value)
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
}
