package com.athenes.ui.reader

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
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
        // O Canvas Central de Leitura & Edição ocupa SEMPRE a largura útil total.
        // As abas laterais (Zotero e Inspetor) operam como SOBREPOSIÇÃO (Overlay)
        // para nunca espremer o texto nem quebrar o layout da folha.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF1F5F9))
        ) {
            // ========================================================
            // PALCO CENTRAL DE LEITURA & ANOTAÇÃO (100% DA LARGURA)
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

            // Scrim Translúcido de Fundo quando qualquer aba lateral estiver aberta sobre o canvas
            if (painelEsquerdoAberto || painelDireitoAberto) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0x33000000))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) {
                            if (painelEsquerdoAberto) viewModel.alternarPainelEsquerdo()
                            if (painelDireitoAberto) viewModel.alternarPainelDireito()
                        }
                )
            }

            // ========================================================
            // SOBREPOSIÇÃO ESQUERDA: ARTIGOS DO ZOTERO + PÁGINAS DO PDF
            // ========================================================
            AnimatedVisibility(
                visible = painelEsquerdoAberto,
                enter = slideInHorizontally(initialOffsetX = { -it }) + fadeIn(),
                exit = slideOutHorizontally(targetOffsetX = { -it }) + fadeOut(),
                modifier = Modifier.align(Alignment.CenterStart)
            ) {
                Surface(
                    color = Color.White,
                    shadowElevation = 16.dp,
                    shape = RoundedCornerShape(topEnd = 12.dp, bottomEnd = 12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                    modifier = Modifier
                        .fillMaxHeight()
                        .widthIn(max = 320.dp)
                ) {
                    PainelEsquerdoLeitura(
                        artigos = artigos,
                        artigoAtivo = artigoAtivo,
                        filtroArtigos = filtroArtigos,
                        paginaAtiva = paginaAtiva,
                        onFiltroArtigosAlterado = { viewModel.definirFiltroArtigos(it) },
                        onSelecionarArtigo = {
                            viewModel.selecionarArtigo(it)
                            viewModel.alternarPainelEsquerdo()
                        },
                        onSelecionarPagina = {
                            viewModel.navegarParaPagina(it)
                            viewModel.alternarPainelEsquerdo()
                        },
                        onSyncZoteroClick = {
                            Toast.makeText(context, "Sincronizando biblioteca do Zotero...", Toast.LENGTH_SHORT).show()
                        },
                        onNovoArtigoClick = {
                            Toast.makeText(context, "Novo artigo Zotero", Toast.LENGTH_SHORT).show()
                        },
                        onNovaFolhaExtraClick = {
                            Toast.makeText(context, "Folha extra adicionada ao PDF", Toast.LENGTH_SHORT).show()
                        }
                    )
                }
            }

            // ========================================================
            // SOBREPOSIÇÃO DIREITA: RESUMO, CITAÇÕES E ZOTERO & DRIVE
            // ========================================================
            AnimatedVisibility(
                visible = painelDireitoAberto,
                enter = slideInHorizontally(initialOffsetX = { it }) + fadeIn(),
                exit = slideOutHorizontally(targetOffsetX = { it }) + fadeOut(),
                modifier = Modifier.align(Alignment.CenterEnd)
            ) {
                Surface(
                    color = Color.White,
                    shadowElevation = 16.dp,
                    shape = RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                    modifier = Modifier
                        .fillMaxHeight()
                        .widthIn(max = 370.dp)
                ) {
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
        }
    }

    // Diálogos Modais
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
