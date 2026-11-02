package com.athenes.ui.reader

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.athenes.core.model.AbaInspetorDireito
import com.athenes.ui.reader.components.*

@Composable
fun EstudoArtigosScreen(
    onVoltarBiblioteca: () -> Unit,
    viewModel: ReaderViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val artigos by viewModel.artigos.collectAsState()
    val artigoAtivo = viewModel.obterArtigoAtivo()
    val paginaAtiva by viewModel.paginaAtiva.collectAsState()
    val ferramentaAtiva by viewModel.ferramentaAtiva.collectAsState()
    val corAtiva by viewModel.corAtiva.collectAsState()
    val painelEsquerdoAberto by viewModel.painelEsquerdoAberto.collectAsState()
    val painelDireitoAberto by viewModel.painelDireitoAberto.collectAsState()
    val abaDireitaAtiva by viewModel.abaDireitaAtiva.collectAsState()
    val textoSelecionado by viewModel.textoSelecionado.collectAsState()
    val filtroArtigos by viewModel.filtroArtigos.collectAsState()

    val mostrarDialogCitacao by viewModel.mostrarDialogNovaCitacao.collectAsState()
    val mostrarDialogNota by viewModel.mostrarDialogNovaNota.collectAsState()

    Scaffold(
        topBar = {
            ReaderTopBar(
                artigo = artigoAtivo,
                painelEsquerdoAberto = painelEsquerdoAberto,
                painelDireitoAberto = painelDireitoAberto,
                onAlternarEsquerdo = { viewModel.alternarPainelEsquerdo() },
                onAlternarDireito = { viewModel.alternarPainelDireito() },
                onAbrirPdfClick = {
                    Toast.makeText(context, "Abrindo ${artigoAtivo.zoteroConfig.driveFileName}...", Toast.LENGTH_SHORT).show()
                },
                onSalvarDriveZoteroClick = {
                    Toast.makeText(context, "Sincronizado e salvo no Google Drive & Zotero!", Toast.LENGTH_SHORT).show()
                },
                onVoltarBiblioteca = onVoltarBiblioteca
            )
        },
        modifier = modifier.fillMaxSize()
    ) { innerPadding ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF1F5F9))
        ) {
            val isTablet = maxWidth >= 768.dp

            if (isTablet) {
                // ========================================================
                // MODO TABLET: 3 PAINÉIS INDEPENDENTES E RETRÁTEIS
                // ========================================================
                Row(modifier = Modifier.fillMaxSize()) {
                    // Painel Esquerdo Retrátil
                    if (painelEsquerdoAberto) {
                        PainelEsquerdoLeitura(
                            artigos = artigos,
                            artigoAtivo = artigoAtivo,
                            filtroArtigos = filtroArtigos,
                            paginaAtiva = paginaAtiva,
                            onFiltroArtigosAlterado = { viewModel.definirFiltroArtigos(it) },
                            onSelecionarArtigo = { viewModel.selecionarArtigo(it) },
                            onSelecionarPagina = { viewModel.navegarParaPagina(it) },
                            onSyncZoteroClick = {
                                Toast.makeText(context, "Sincronizando biblioteca do Zotero...", Toast.LENGTH_SHORT).show()
                            },
                            onNovoArtigoClick = {
                                Toast.makeText(context, "Importar referência do Zotero", Toast.LENGTH_SHORT).show()
                            },
                            onNovaFolhaExtraClick = {
                                Toast.makeText(context, "Folha extra adicionada ao PDF", Toast.LENGTH_SHORT).show()
                            }
                        )
                    }

                    // Área Central de Leitura & Anotação (Aproveita automaticamente a largura liberada)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                    ) {
                        ReaderSubBar(
                            totalPaginas = artigoAtivo.totalPaginas,
                            paginaAtual = paginaAtiva,
                            ferramentaAtiva = ferramentaAtiva,
                            corAtiva = corAtiva,
                            coresDisponiveis = viewModel.coresDisponiveis,
                            onSelecionarFerramenta = { viewModel.definirFerramenta(it) },
                            onSelecionarCor = { viewModel.definirCor(it) },
                            onPaginaAnterior = { viewModel.paginaAnterior() },
                            onProximaPagina = { viewModel.proximaPagina() },
                            onDesfazer = { viewModel.desfazerTraco() },
                            onLimparPagina = { viewModel.limparPagina() }
                        )

                        PdfContinuousCanvas(
                            artigo = artigoAtivo,
                            paginaAtual = paginaAtiva,
                            ferramentaAtiva = ferramentaAtiva,
                            corAtiva = corAtiva,
                            textoSelecionado = textoSelecionado,
                            onTextoSelecionado = { txt, pag, x, y ->
                                viewModel.selecionarTexto(txt, pag, x, y)
                            },
                            onFecharPopupSelecao = { viewModel.fecharPopupSelecao() },
                            onGrifarTexto = { viewModel.grifarTextoSelecionado() },
                            onCriarCitacao = { viewModel.abrirCriacaoCitacao() },
                            onCriarNota = { viewModel.abrirCriacaoNota() },
                            onAdicionarTraco = { pontos -> viewModel.adicionarTracoLivre(pontos) },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Painel Direito Retrátil (Inspetor de 3 abas)
                    if (painelDireitoAberto) {
                        PainelDireitoInspetor(
                            artigo = artigoAtivo,
                            abaAtiva = abaDireitaAtiva,
                            onSelecionarAba = { viewModel.selecionarAbaDireita(it) },
                            onNovaCitacaoClick = { viewModel.abrirCriacaoCitacao() },
                            onRemoverCitacao = { viewModel.removerCitacao(it) },
                            onNovaNotaClick = { viewModel.abrirCriacaoNota() },
                            onRemoverNota = { viewModel.removerNota(it) },
                            onSalvarConfigZoteroDrive = { cfg -> viewModel.salvarConfigZoteroDrive(cfg) }
                        )
                    }
                }
            } else {
                // ========================================================
                // MODO CELULAR: VISÃO CENTRAL COM PAINÉIS ADAPTADOS
                // ========================================================
                Column(modifier = Modifier.fillMaxSize()) {
                    ReaderSubBar(
                        totalPaginas = artigoAtivo.totalPaginas,
                        paginaAtual = paginaAtiva,
                        ferramentaAtiva = ferramentaAtiva,
                        corAtiva = corAtiva,
                        coresDisponiveis = viewModel.coresDisponiveis,
                        onSelecionarFerramenta = { viewModel.definirFerramenta(it) },
                        onSelecionarCor = { viewModel.definirCor(it) },
                        onPaginaAnterior = { viewModel.paginaAnterior() },
                        onProximaPagina = { viewModel.proximaPagina() },
                        onDesfazer = { viewModel.desfazerTraco() },
                        onLimparPagina = { viewModel.limparPagina() }
                    )

                    PdfContinuousCanvas(
                        artigo = artigoAtivo,
                        paginaAtual = paginaAtiva,
                        ferramentaAtiva = ferramentaAtiva,
                        corAtiva = corAtiva,
                        textoSelecionado = textoSelecionado,
                        onTextoSelecionado = { txt, pag, x, y ->
                            viewModel.selecionarTexto(txt, pag, x, y)
                        },
                        onFecharPopupSelecao = { viewModel.fecharPopupSelecao() },
                        onGrifarTexto = { viewModel.grifarTextoSelecionado() },
                        onCriarCitacao = { viewModel.abrirCriacaoCitacao() },
                        onCriarNota = { viewModel.abrirCriacaoNota() },
                        onAdicionarTraco = { pontos -> viewModel.adicionarTracoLivre(pontos) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }

    // Diálogo de Nova Citação
    if (mostrarDialogCitacao) {
        DialogNovaCitacao(
            textoInicial = textoSelecionado?.texto ?: "",
            paginaInicial = textoSelecionado?.pagina ?: paginaAtiva,
            onSalvar = { texto, comentario, pagina ->
                viewModel.salvarCitacao(texto, comentario, pagina)
            },
            onFechar = { viewModel.fecharDialogNovaCitacao() }
        )
    }

    // Diálogo de Nova Nota Adesiva
    if (mostrarDialogNota) {
        DialogNovaNotaAdesiva(
            paginaInicial = textoSelecionado?.pagina ?: paginaAtiva,
            onSalvar = { titulo, texto, pagina ->
                viewModel.salvarNota(titulo, texto, pagina)
            },
            onFechar = { viewModel.fecharDialogNovaNota() }
        )
    }
}
