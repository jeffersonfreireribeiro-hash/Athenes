package com.athenes.ui.reader

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Draw
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import com.athenes.core.model.AbaInspetorDireito
import com.athenes.core.updater.AppUpdateInfo
import com.athenes.ui.reader.components.*

@Composable
fun EstudoArtigosScreen(
    artigoIdInicial: String? = null,
    onVoltarBiblioteca: () -> Unit,
    updateInfo: AppUpdateInfo? = null,
    onOpenUpdateDialog: () -> Unit = {},
    onCheckUpdateManual: () -> Unit = {},
    viewModel: ReaderViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    LaunchedEffect(artigoIdInicial) {
        if (!artigoIdInicial.isNullOrBlank()) {
            viewModel.selecionarArtigo(artigoIdInicial)
        }
    }
    val artigos by viewModel.artigos.collectAsState()
    val artigoAtivoId by viewModel.artigoAtivoId.collectAsState()
    val artigoAtivo = remember(artigos, artigoAtivoId) {
        artigos.find { it.id == artigoAtivoId } ?: artigos.first()
    }
    val paginaAtiva by viewModel.paginaAtiva.collectAsState()
    val ferramentaAtiva by viewModel.ferramentaAtiva.collectAsState()
    val modoLinhaReta by viewModel.modoLinhaReta.collectAsState()
    val corAtiva by viewModel.corAtiva.collectAsState()
    val painelEsquerdoAberto by viewModel.painelEsquerdoAberto.collectAsState()
    val painelDireitoAberto by viewModel.painelDireitoAberto.collectAsState()
    val abaDireitaAtiva by viewModel.abaDireitaAtiva.collectAsState()
    val textoSelecionado by viewModel.textoSelecionado.collectAsState()
    val filtroArtigos by viewModel.filtroArtigos.collectAsState()

    val modoSomenteStylus by viewModel.modoSomenteStylus.collectAsState()
    val stylusDetectada by viewModel.stylusDetectada.collectAsState()

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
                    Toast.makeText(context, "A abertura do PDF ainda não está disponível.", Toast.LENGTH_SHORT).show()
                },
                onSalvarDriveZoteroClick = {
                    Toast.makeText(context, "A sincronização com Drive e Zotero ainda não está disponível.", Toast.LENGTH_SHORT).show()
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
            PdfContinuousCanvas(
                artigo = artigoAtivo,
                paginaAtual = paginaAtiva,
                ferramentaAtiva = ferramentaAtiva,
                corAtiva = corAtiva,
                modoSomenteStylus = modoSomenteStylus,
                textoSelecionado = textoSelecionado,
                onTextoSelecionado = { txt, pag, x, y ->
                    viewModel.selecionarTexto(txt, pag, x, y)
                },
                onFecharPopupSelecao = { viewModel.fecharPopupSelecao() },
                onGrifarTexto = { viewModel.grifarTextoSelecionado() },
                onCriarCitacao = { viewModel.abrirCriacaoCitacao() },
                onCriarNota = { viewModel.abrirCriacaoNota() },
                onAdicionarTraco = { pag, pontos -> viewModel.adicionarTracoLivre(pag, pontos) },
                onApagarTracoProximo = { pag, x, y -> viewModel.apagarTracosProximos(pag, x, y) },
                onStylusDetectada = { viewModel.registrarStylusDetectada() },
                onPaginaAnterior = { viewModel.paginaAnterior() },
                onProximaPagina = { viewModel.proximaPagina() },
                modifier = Modifier.fillMaxSize()
            )

            // BARRA DE PÍLULA FLUTUANTE (.rm-barra-blocos)
            // Fiel ao web Athenes: [ ← ] [ 💾 ] | [ ↶ ] [ 🗑 ] | [ ☰ ] [ ✏ ] [ 🖊 ] [ ⚬—⚬ ] [ ▱ ] [ 📝 ] [ ❝ ] | ● ● ● ● ● ●
            // Some enquanto uma gaveta está aberta, para não ficar cortada atrás dela.
            AnimatedVisibility(
                visible = !painelEsquerdoAberto && !painelDireitoAberto,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(top = 10.dp)
            ) {
              Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                ReaderSubBar(
                    ferramentaAtiva = ferramentaAtiva,
                    modoLinhaReta = modoLinhaReta,
                    corAtiva = corAtiva,
                    coresDisponiveis = viewModel.coresDisponiveis,
                    onVoltar = onVoltarBiblioteca,
                    onSalvar = {
                        Toast.makeText(context, "A sincronização com Drive e Zotero ainda não está disponível.", Toast.LENGTH_SHORT).show()
                    },
                    onDesfazer = { viewModel.desfazerTraco() },
                    onLimparPagina = { viewModel.limparPagina() },
                    onSelecionarFerramenta = { viewModel.definirFerramenta(it) },
                    onAlternarModoLinhaReta = { viewModel.alternarModoLinhaReta() },
                    onSelecionarCor = { viewModel.definirCor(it) }
                )
              }
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
                            Toast.makeText(context, "A sincronização do Zotero ainda não está disponível.", Toast.LENGTH_SHORT).show()
                        },
                        onNovoArtigoClick = {
                            Toast.makeText(context, "A importação de artigos ainda não está disponível.", Toast.LENGTH_SHORT).show()
                        },
                        onNovaFolhaExtraClick = {
                            Toast.makeText(context, "Adicionar folha ao PDF ainda não está disponível.", Toast.LENGTH_SHORT).show()
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
                        modoSomenteStylus = modoSomenteStylus,
                        stylusDetectada = stylusDetectada,
                        updateInfo = updateInfo,
                        onAlternarModoStylus = { viewModel.alternarModoSomenteStylus() },
                        onOpenUpdateDialog = onOpenUpdateDialog,
                        onCheckUpdateManual = onCheckUpdateManual,
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
