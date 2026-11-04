package com.athenes

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.athenes.ui.components.AthenesSearchBar
import com.athenes.ui.components.NavegacaoPrincipal
import com.athenes.core.citacao.AutorReferencia
import com.athenes.core.citacao.ReferenciaAcademica
import com.athenes.ui.editor.components.GrafoConexoesDialog
import com.athenes.ui.library.DialogNovoArtigoLocal
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.ui.reader.EstudoArtigosScreen
import com.athenes.ui.reader.ReaderViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NavegacaoAcessibilidadeTest {
    @get:Rule val compose = createComposeRule()

    @Test fun buscaEAcaoPrincipalFuncionamEmTelaCompacta() {
        var busca by mutableStateOf("")
        var novoDocumento = false
        compose.setContent {
            MaterialTheme {
                AthenesSearchBar(
                    textoBusca = busca,
                    onBuscaAlterada = { busca = it },
                    tipoFiltro = null,
                    onTipoFiltroAlterado = {},
                    onNovoDocumentoClick = { novoDocumento = true }
                )
            }
        }

        compose.onNodeWithContentDescription("Buscar documentos").performTextInput("pesquisa")
        compose.runOnIdle { assertEquals("pesquisa", busca) }
        compose.onNodeWithContentDescription("Limpar busca").performClick()
        compose.runOnIdle { assertEquals("", busca) }
        compose.onNodeWithText("Novo documento").assertHasClickAction().performClick()
        compose.runOnIdle { assertTrue(novoDocumento) }
        compose.onNodeWithText("Todos os Documentos").assertExists()
    }

    @Test fun destinosPreservamSelecaoNaBarraENoTrilho() {
        var destino by mutableStateOf(DestinoPrincipal.DOCUMENTOS)
        var compacta by mutableStateOf(true)
        compose.setContent {
            MaterialTheme {
                NavegacaoPrincipal(destino, compacta, onDestino = { destino = it })
            }
        }
        compose.onNodeWithText("Biblioteca").performClick()
        compose.runOnIdle { assertEquals(DestinoPrincipal.BIBLIOTECA, destino) }
        compose.onNodeWithText("Biblioteca").assertIsSelected()
        compose.runOnIdle { compacta = false }
        compose.onNodeWithText("Conta").performClick()
        compose.runOnIdle { assertEquals(DestinoPrincipal.CONTA, destino) }
        compose.onNodeWithText("Conta").assertIsSelected()
    }

    @Test fun grafoComMaisDeCemObrasMantemListaCompleta() {
        val referencias = (1..140).map { i ->
            ReferenciaAcademica("obra-$i", "book", "Obra $i", listOf(AutorReferencia("Silva", "Ana")), "2025")
        }
        compose.setContent { MaterialTheme { GrafoConexoesDialog(referencias, onFechar = {}) } }
        compose.onNodeWithText("140 obras", substring = true).assertExists()
        compose.onNodeWithText("Mapa: 60 de", substring = true).assertExists()
        compose.onNodeWithText("A lista abaixo contém todos.", substring = true).assertExists()
    }

    @Test fun novoArtigoExigeTituloEAbreComDadosInformados() {
        var resultado: List<String>? = null
        var selecionarPdf = false
        compose.setContent {
            MaterialTheme {
                DialogNovoArtigoLocal(onFechar = {}, onSelecionarPdf = { selecionarPdf = true }, onCriar = { titulo, autores, ano, publicacao, resumo, chave ->
                    resultado = listOf(titulo, autores, ano.toString(), publicacao, resumo, chave)
                })
            }
        }
        compose.onNodeWithText("Selecionar PDF").performClick()
        compose.runOnIdle { assertTrue(selecionarPdf) }
        compose.onNodeWithText("Título").performTextInput("Pesquisa local")
        compose.onNodeWithText("Autores").performTextInput("Ana Silva")
        compose.onNodeWithText("Adicionar e abrir").performClick()
        compose.runOnIdle {
            assertEquals("Pesquisa local", resultado?.get(0))
            assertEquals("Ana Silva", resultado?.get(1))
        }
    }

    @Test fun referenciaZoteroPreencheNovoArtigo() {
        val referencia = ArtigoEstudoDetalhado(id = "ZOT123", titulo = "Estudo vinculado", autores = "Ana Silva",
            ano = 2024, chaveZotero = "ZOT123", resumoOficial = "Resumo da obra",
            camposZotero = mapOf("publicationTitle" to "Revista acadêmica"))
        var dados: List<String>? = null
        compose.setContent { MaterialTheme {
            DialogNovoArtigoLocal(onFechar = {}, referencias = listOf(referencia), onCriar = { t, a, ano, p, r, chave ->
                dados = listOf(t, a, ano.toString(), p, r, chave)
            })
        } }
        compose.onNodeWithText("Usar referência Zotero").performClick()
        compose.onNodeWithText("Estudo vinculado", substring = true).performClick()
        compose.onNodeWithText("Adicionar e abrir").performClick()
        compose.runOnIdle { assertEquals(listOf("Estudo vinculado", "Ana Silva", "2024", "Revista acadêmica", "Resumo da obra", "ZOT123"), dados) }
    }

    @Test fun estudioSemArtigosMostraProximaAcao() {
        val repositorio = ArtigoEstudoRepository().apply { aplicarBibliotecaZotero(emptyList(), emptyList()) }
        var voltou = false
        compose.setContent { MaterialTheme {
            EstudoArtigosScreen(onVoltarBiblioteca = { voltou = true }, viewModel = ReaderViewModel(repositorio))
        } }
        compose.onNodeWithText("Nenhum artigo disponível").assertExists()
        compose.onNodeWithText("Abrir Biblioteca").performClick()
        compose.runOnIdle { assertTrue(voltou) }
    }
}
