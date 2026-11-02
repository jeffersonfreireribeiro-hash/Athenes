package com.athenes.ui.reader

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
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
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF1F5F9))
        ) {
            // Em tablets horizontais (Landscape com largura >= 960dp), usamos as 3 colunas lado a lado
            val isLandscape = maxWidth > maxHeight && maxWidth >= 960.dp

            if (isLandscape) {
                // ========================================================
                // MODO PAISAGEM / HORIZONTAL: 3 COLUNAS LADO A LADO
                // ========================================================
                Row(modifier = Modifier.fillMaxSize()) {
                    // Coluna 1: Painel Esquerdo Retrátil (Zotero + Páginas)
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

                    // Coluna 2: Área Central de Leitura & Anotação (Aproveita automaticamente o espaço)
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

                    // Coluna 3: Painel Direito Retrátil (Inspetor de 3 Abas)
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
                // MODO VERTICAL / RETRATO (TABLET VERTICAL & CELULAR):
                // Canvas central com largura nobre para leitura e risco,
                // e painéis laterais como Gavetas Sobrepostas (Side Drawers).
                // ========================================================
                Box(modifier = Modifier.fillMaxSize()) {
                    // Área Central de Edição (Sempre em largura cheia para máxima legibilidade)
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

                    // Scrim de fundo translúcido para fechar gaveta sobreposta ao tocar fora
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

                    // Gaveta Sobreposta Esquerda (Zotero + Páginas)
                    AnimatedVisibility(
                        visible = painelEsquerdoAberto,
                        enter = slideInHorizontally(initialOffsetX = { -it }) + fadeIn(),
                        exit = slideOutHorizontally(targetOffsetX = { -it }) + fadeOut(),
                        modifier = Modifier.align(Alignment.CenterStart)
                    ) {
                        Surface(
                            color = Color.White,
                            shadowElevation = 16.dp,
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
                                    Toast.makeText(context, "Sincronizando Zotero...", Toast.LENGTH_SHORT).show()
                                },
                                onNovoArtigoClick = {
                                    Toast.makeText(context, "Novo Artigo", Toast.LENGTH_SHORT).show()
                                },
                                onNovaFolhaExtraClick = {
                                    Toast.makeText(context, "Folha extra adicionada", Toast.LENGTH_SHORT).show()
                                }
                            )
                        }
                    }

                    // Gaveta Sobreposta Direita (Inspetor: Resumo, Citações, Zotero & Drive)
                    AnimatedVisibility(
                        visible = painelDireitoAberto,
                        enter = slideInHorizontally(initialOffsetX = { it }) + fadeIn(),
                        exit = slideOutHorizontally(targetOffsetX = { it }) + fadeOut(),
                        modifier = Modifier.align(Alignment.CenterEnd)
                    ) {
                        Surface(
                            color = Color.White,
                            shadowElevation = 16.dp,
                            modifier = Modifier
                                .fillMaxHeight()
                                .widthIn(max = 360.dp)
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
        }
    }

    // Diálogos
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
