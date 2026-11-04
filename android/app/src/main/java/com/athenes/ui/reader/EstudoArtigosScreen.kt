package com.athenes.ui.reader

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import com.athenes.core.model.AbaInspetorDireito
import com.athenes.core.model.PaginaPdfInfo
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
    var pdfUriTexto by remember(artigoAtivo.id) {
        mutableStateOf(context.getSharedPreferences("pdf_artigos", 0).getString(artigoAtivo.id, null))
    }
    var totalPdf by remember(artigoAtivo.id) { mutableIntStateOf(0) }
    val artigoExibido = remember(artigoAtivo, pdfUriTexto, totalPdf) {
        if (pdfUriTexto == null) artigoAtivo.copy(totalPaginas = 0, paginas = emptyList())
        else if (totalPdf > 0) artigoAtivo.copy(
            totalPaginas = totalPdf,
            paginas = (1..totalPdf).map { PaginaPdfInfo(numero = it) }
        ) else artigoAtivo.copy(totalPaginas = 0, paginas = emptyList())
    }
    val seletorPdf = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.getSharedPreferences("pdf_artigos", 0).edit().putString(artigoAtivo.id, uri.toString()).apply()
            pdfUriTexto = uri.toString()
            totalPdf = 0
            viewModel.definirTotalPaginasPdf(0)
        }
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
                artigo = artigoExibido,
                painelEsquerdoAberto = painelEsquerdoAberto,
                painelDireitoAberto = painelDireitoAberto,
                onAlternarEsquerdo = { viewModel.alternarPainelEsquerdo() },
                onAlternarDireito = { viewModel.alternarPainelDireito() },
                onAbrirPdfClick = {
                    seletorPdf.launch(arrayOf("application/pdf"))
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
            if (pdfUriTexto != null) {
                PdfRealViewer(
                    uri = Uri.parse(pdfUriTexto!!),
                    paginaAtual = paginaAtiva,
                    onTotalPaginas = { totalPdf = it; viewModel.definirTotalPaginasPdf(it) },
                    ferramenta = ferramentaAtiva,
                    cor = corAtiva,
                    modoSomenteStylus = modoSomenteStylus,
                    tracos = artigoAtivo.tracos,
                    notas = artigoAtivo.notas,
                    citacoes = artigoAtivo.citacoes,
                    onAdicionarTraco = { pagina, pontos -> viewModel.adicionarTracoLivre(pagina, pontos) },
                    onApagarTraco = { pagina, x, y -> viewModel.apagarTracosProximos(pagina, x, y, 0.03f) },
                    onStylusDetectada = { viewModel.registrarStylusDetectada() },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Column(
                    modifier = Modifier.fillMaxSize().semantics { liveRegion = LiveRegionMode.Polite },
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Sem PDF vinculado", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(8.dp))
                    Text("Selecione o arquivo deste artigo para ler as páginas reais.")
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { seletorPdf.launch(arrayOf("application/pdf")) }) { Text("Selecionar PDF") }
                }
            }
            // BARRA DE PÍLULA FLUTUANTE (.rm-barra-blocos)
            // Fiel ao web Athenes: [ ← ] [ 💾 ] | [ ↶ ] [ 🗑 ] | [ ☰ ] [ ✏ ] [ 🖊 ] [ ⚬—⚬ ] [ ▱ ] [ 📝 ] [ ❝ ] | ● ● ● ● ● ●
            // Some enquanto uma gaveta está aberta, para não ficar cortada atrás dela.
            AnimatedVisibility(
                visible = pdfUriTexto != null && !painelEsquerdoAberto && !painelDireitoAberto,
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
                        artigoAtivo = artigoExibido,
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
                        artigo = artigoExibido,
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
