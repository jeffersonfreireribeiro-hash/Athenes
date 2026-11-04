package com.athenes.ui.editor

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.athenes.core.model.Documento
import com.athenes.ui.editor.components.EditorBarraBlocos
import com.athenes.ui.editor.components.EditorPainelEsquerdo
import com.athenes.ui.editor.components.EditorPainelInspetor
import com.athenes.ui.editor.components.EditorPainelCitacao
import com.athenes.ui.editor.components.EditorTopBar
import com.athenes.ui.editor.components.DialogConfiguracaoPagina
import com.athenes.ui.editor.components.GrafoConexoesDialog
import com.athenes.ui.theme.AthenesPrimary
import com.athenes.ui.theme.AthenesTextMuted
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import android.widget.Toast
import com.athenes.core.data.ImagemRepositorio
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.export.ExportadorDocumento
import com.athenes.core.export.ResolvedorImagem
import com.athenes.core.citacao.Bibliografia
import com.athenes.core.citacao.EstiloBibliografico
import com.athenes.core.citacao.ReferenciaAcademica
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val PalcoCor = Color(0xFFEEF2F6)
private val TextoCor = Color(0xFF1E293B)
private const val LARGURA_COMPACTA_DP = 600

@Composable
fun EditorDocumentoScreen(
    documentoInicial: Documento?,
    onVoltarBiblioteca: () -> Unit,
    citacaoPendenteArtigoId: String? = null,
    citacaoPendenteId: String? = null,
    onCitacaoPendenteInserida: () -> Unit = {},
    viewModel: EditorViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Idempotente por id: carrega antes do primeiro frame (arquivo pequeno), sem piscar a folha vazia.
    remember(documentoInicial?.id) {
        if (documentoInicial != null) viewModel.carregarDocumento(documentoInicial, context.filesDir)
    }

    LaunchedEffect(documentoInicial?.id, citacaoPendenteArtigoId, citacaoPendenteId) {
        if (documentoInicial != null && citacaoPendenteArtigoId != null && citacaoPendenteId != null) {
            val artigo = ArtigoEstudoRepository.compartilhado.artigos.value.find { it.id == citacaoPendenteArtigoId }
            val destaque = artigo?.citacoes?.find { it.id == citacaoPendenteId }
            if (artigo != null && destaque != null) {
                runCatching { viewModel.inserirCitacaoLonga(artigo, destaque) }
                    .onFailure { Toast.makeText(context, it.message ?: "Não foi possível inserir a citação.", Toast.LENGTH_LONG).show() }
            } else {
                Toast.makeText(context, "Citação não encontrada na biblioteca.", Toast.LENGTH_LONG).show()
            }
            onCitacaoPendenteInserida()
        }
    }

    val titulo by viewModel.titulo.collectAsState()
    val subtitulo by viewModel.subtitulo.collectAsState()
    val autores by viewModel.autores.collectAsState()
    val resumo by viewModel.resumo.collectAsState()
    val tipoDoc by viewModel.tipoDocumento.collectAsState()
    val configPagina by viewModel.configuracaoPagina.collectAsState()
    val estiloBibliografico by viewModel.estiloBibliografico.collectAsState()
    val referencias by viewModel.referencias.collectAsState()
    var mostrarConfigPagina by remember { mutableStateOf(false) }
    var mostrarConexoes by remember { mutableStateOf(false) }
    val modoRevisao by viewModel.modoRevisao.collectAsState()
    val salvo by viewModel.salvo.collectAsState()
    val blocos by viewModel.blocos.collectAsState()
    val blocoSelecionadoId by viewModel.blocoSelecionadoId.collectAsState()
    val painelEstruturaAberto by viewModel.painelEstruturaAberto.collectAsState()
    val abaEsquerdaAtiva by viewModel.abaEsquerdaAtiva.collectAsState()
    val painelInspetorAberto by viewModel.painelInspetorAberto.collectAsState()
    val painelCitacaoAberto by viewModel.painelCitacaoAberto.collectAsState()

    // Seletor de fotos do sistema (sem permissão de armazenamento); a imagem é copiada e reduzida.
    var alvoImagem by remember { mutableStateOf<String?>(null) }
    val seletorImagem = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val alvo = alvoImagem
        alvoImagem = null
        if (uri != null && alvo != null) {
            scope.launch {
                val nome = withContext(Dispatchers.IO) { ImagemRepositorio.importar(context, uri) }
                if (nome != null) viewModel.definirImagemBloco(alvo, nome)
            }
        }
    }
    val escolherImagem: (String) -> Unit = { id ->
        alvoImagem = id
        seletorImagem.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }

    // Exportação: DOCX pelo seletor de arquivos do sistema; PDF pela impressão do sistema.
    val resolvedorImagem = remember { ResolvedorImagem { nome -> ImagemRepositorio.paraExportacao(context, nome) } }
    val criarDocx = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ) { uri ->
        if (uri != null) {
            scope.launch {
                val ok = withContext(Dispatchers.IO) {
                    runCatching {
                        val bytes = ExportadorDocumento.gerarDocx(viewModel.paraExportacao(), resolvedorImagem)
                        context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("sem saída")
                    }.isSuccess
                }
                val msg = if (ok) "Documento Word exportado." else "Não foi possível exportar o Word."
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            }
        }
    }
    val exportarDocx: () -> Unit = {
        viewModel.salvarDocumento()
        criarDocx.launch(viewModel.nomeBaseArquivo() + ".docx")
    }
    val criarJson = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch {
            val resultado = runCatching {
                val conteudo = viewModel.exportarJson()
                withContext(Dispatchers.IO) {
                    context.contentResolver.openOutputStream(uri)?.use { it.write(conteudo.toByteArray(Charsets.UTF_8)) }
                        ?: error("Não foi possível criar o arquivo.")
                }
            }
            Toast.makeText(context, resultado.fold({ "Documento JSON exportado." }, { it.message ?: "Falha na exportação JSON." }), Toast.LENGTH_LONG).show()
        }
    }
    val exportarJson: () -> Unit = {
        if (blocos.any { it.imagem.isNotBlank() }) {
            Toast.makeText(context, "JSON simples não incorpora imagens. Use DOCX ou PDF para este documento.", Toast.LENGTH_LONG).show()
        } else criarJson.launch(viewModel.nomeBaseArquivo() + ".json")
    }
    val exportarPdf: () -> Unit = {
        viewModel.salvarDocumento()
        scope.launch {
            val html = withContext(Dispatchers.IO) { ExportadorDocumento.gerarHtml(viewModel.paraExportacao(), resolvedorImagem) }
            val activity = ExportarPdf.activityDe(context)
            if (activity != null) {
                ExportarPdf.imprimir(activity, html, viewModel.nomeBaseArquivo())
            } else {
                Toast.makeText(context, "Não foi possível abrir a impressão.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val editavel = modoRevisao != "leitura"
    val blocoSelecionado = remember(blocos, blocoSelecionadoId) { blocos.find { it.id == blocoSelecionadoId } }
    val estrutura = remember(blocos) { viewModel.montarEstrutura(blocos) }
    val titulosIlustracoes = remember(blocos) { blocos.filter { it.tipo in setOf(TipoBlocoEditor.FIGURA, TipoBlocoEditor.TABELA, TipoBlocoEditor.QUADRO) && it.legenda.isNotBlank() }.map { it.legenda } }
    val algumPainelAberto = painelEstruturaAberto || painelInspetorAberto

    fun sair() {
        viewModel.salvarDocumento()
        onVoltarBiblioteca()
    }

    BackHandler {
        when {
            painelCitacaoAberto -> viewModel.fecharPainelCitacao()
            painelEstruturaAberto -> viewModel.fecharPainelEstrutura()
            painelInspetorAberto -> viewModel.fecharPainelInspetor()
            else -> sair()
        }
    }

    // Modo foco: barras recolhem ao rolar para baixo e voltam ao rolar para cima / no topo da folha.
    val listState = rememberLazyListState()
    var barrasVisiveis by remember { mutableStateOf(true) }
    val conexaoRolagem = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (available.y < -12f) barrasVisiveis = false else if (available.y > 12f) barrasVisiveis = true
                return Offset.Zero
            }
        }
    }
    val noTopo by remember { derivedStateOf { listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset < 40 } }
    val mostrarBarras = barrasVisiveis || noTopo || algumPainelAberto

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(PalcoCor)
            .nestedScroll(conexaoRolagem)
    ) {
        val compacto = maxWidth < LARGURA_COMPACTA_DP.dp
        val larguraFolha = if (compacto) maxWidth - 8.dp else minOf(820.dp, maxWidth - 32.dp)
        val margemEsquerda = maxOf(12.dp, larguraFolha * (configPagina.margemEsquerdaMm / configPagina.larguraMm).toFloat())
        val margemDireita = maxOf(12.dp, larguraFolha * (configPagina.margemDireitaMm / configPagina.larguraMm).toFloat())
        // Gavetas e scrim começam abaixo da barra de título: voltar/estrutura/inspetor seguem acessíveis.
        val topoHud = 52.dp + WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

        // ============================ FOLHA ============================
        LazyColumn(
            state = listState,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .imePadding()
                .width(larguraFolha)
                .fillMaxHeight()
                .shadow(2.dp)
                .background(Color.White),
            contentPadding = PaddingValues(
                start = margemEsquerda, end = margemDireita,
                top = 52.dp + 52.dp + 8.dp, bottom = 32.dp
            ),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item(key = "cabecalho") {
                CabecalhoFolha(
                    titulo = titulo, subtitulo = subtitulo, autores = autores, resumo = resumo,
                    editavel = editavel, compacto = compacto,
                    onTitulo = viewModel::definirTitulo,
                    onSubtitulo = viewModel::definirSubtitulo,
                    onResumo = viewModel::definirResumo
                )
            }
            itemsIndexed(blocos, key = { _, b -> b.id }) { indice, bloco ->
                val numeroFormula = blocos.take(indice + 1).count { it.tipo == TipoBlocoEditor.FORMULA }
                ItemBlocoFolha(
                    bloco = bloco,
                    selecionado = bloco.id == blocoSelecionadoId,
                    editavel = editavel,
                    compacto = compacto,
                    numeroFormula = numeroFormula,
                    estrutura = estrutura,
                    titulosIlustracoes = titulosIlustracoes,
                    referencias = referencias,
                    estiloBibliografico = estiloBibliografico,
                    onVerConexoes = { mostrarConexoes = true },
                    onEscolherImagem = escolherImagem,
                    vm = viewModel
                )
            }
        }

        // ============================ BARRAS (sobrepostas) ============================
        AnimatedVisibility(
            visible = mostrarBarras,
            enter = slideInVertically { -it } + fadeIn(),
            exit = slideOutVertically { -it } + fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            Column {
                EditorTopBar(
                    titulo = titulo,
                    tipoDocumento = tipoDoc,
                    modoRevisao = modoRevisao,
                    salvo = salvo,
                    painelEstruturaAberto = painelEstruturaAberto,
                    painelInspetorAberto = painelInspetorAberto,
                    onAlternarEstrutura = viewModel::alternarPainelEstrutura,
                    onAlternarInspetor = viewModel::alternarPainelInspetor,
                    onTipoAlterado = viewModel::definirTipoDocumento,
                    onModoRevisaoAlterado = viewModel::definirModoRevisao,
                    onSalvar = viewModel::salvarDocumento,
                    onExportarDocx = exportarDocx,
                    onExportarPdf = exportarPdf,
                    onExportarJson = exportarJson,
                    onConfigurarPagina = { mostrarConfigPagina = true },
                    onVoltar = ::sair
                )
                // Barra de inserção de blocos logo abaixo do título (preferência do usuário: no topo)
                if (editavel) {
                    EditorBarraBlocos(
                        onDesfazer = viewModel::desfazer,
                        onRefazer = viewModel::refazer,
                        onAdicionarBloco = { tipo ->
                            viewModel.adicionarBloco(tipo)
                            // leva o bloco recém-criado à vista
                            scope.launch { rolarParaSelecionado(listState, viewModel) }
                        },
                        onCitar = viewModel::abrirPainelCitacao
                    )
                }
            }
        }

        // ============================ GAVETAS (overlay + scrim) ============================
        if (algumPainelAberto) {
            Box(
                modifier = Modifier
                    .padding(top = topoHud)
                    .fillMaxSize()
                    .background(Color(0x55000000))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                        viewModel.fecharPainelEstrutura()
                        viewModel.fecharPainelInspetor()
                    }
            )
        }

        AnimatedVisibility(
            visible = painelEstruturaAberto,
            enter = slideInHorizontally { -it } + fadeIn(),
            exit = slideOutHorizontally { -it } + fadeOut(),
            modifier = Modifier.align(Alignment.CenterStart).padding(top = topoHud)
        ) {
            EditorPainelEsquerdo(
                abaAtiva = abaEsquerdaAtiva,
                estrutura = estrutura,
                onSelecionarAba = viewModel::definirAbaEsquerda,
                onFechar = viewModel::fecharPainelEstrutura,
                onIrParaSecao = { id ->
                    val destino = blocos.indexOfFirst { it.id == id }
                    viewModel.selecionarBloco(id)
                    viewModel.fecharPainelEstrutura()
                    if (destino >= 0) scope.launch { listState.animateScrollToItem(destino + 1) }
                }
            )
        }

        AnimatedVisibility(
            visible = painelInspetorAberto,
            enter = slideInHorizontally { it } + fadeIn(),
            exit = slideOutHorizontally { it } + fadeOut(),
            modifier = Modifier.align(Alignment.CenterEnd).padding(top = topoHud)
        ) {
            EditorPainelInspetor(
                bloco = blocoSelecionado,
                onAlinhamentoAlterado = { al -> blocoSelecionado?.let { viewModel.definirAlinhamentoBloco(it.id, al) } },
                onColunasAlteradas = { col -> blocoSelecionado?.let { viewModel.definirColunasBloco(it.id, col) } },
                onNivelTituloAlterado = { nivel -> blocoSelecionado?.let { viewModel.definirNivelTitulo(it.id, nivel) } },
                onDuplicarBloco = { blocoSelecionado?.let { viewModel.duplicarBloco(it.id) } },
                onExcluirBloco = { blocoSelecionado?.let { viewModel.removerBloco(it.id) } },
                onFechar = viewModel::fecharPainelInspetor
            )
        }

        // ============================ PAINEL DE CITAÇÃO (inferior) ============================
        if (painelCitacaoAberto) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0x55000000))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                        viewModel.fecharPainelCitacao()
                    }
            )
        }
        AnimatedVisibility(
            visible = painelCitacaoAberto,
            enter = slideInVertically { it } + fadeIn(),
            exit = slideOutVertically { it } + fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            EditorPainelCitacao(
                onCitar = viewModel::inserirCitacao,
                estilo = estiloBibliografico,
                onEstiloAlterado = viewModel::definirEstiloBibliografico,
                onFechar = viewModel::fecharPainelCitacao
            )
        }
    }

    if (mostrarConfigPagina) {
        DialogConfiguracaoPagina(
            atual = configPagina,
            onSalvar = { viewModel.definirConfiguracaoPagina(it); mostrarConfigPagina = false },
            onFechar = { mostrarConfigPagina = false }
        )
    }
    if (mostrarConexoes) GrafoConexoesDialog(referencias = referencias, onFechar = { mostrarConexoes = false })


}

private suspend fun rolarParaSelecionado(listState: LazyListState, vm: EditorViewModel) {
    val id = vm.blocoSelecionadoId.value ?: return
    val idx = vm.blocos.value.indexOfFirst { it.id == id }
    if (idx >= 0) listState.animateScrollToItem(idx + 1)
}

// ===================================================================
// Cabeçalho da folha (título, subtítulo, autores, resumo)
// ===================================================================
@Composable
private fun CabecalhoFolha(
    titulo: String, subtitulo: String, autores: String, resumo: String,
    editavel: Boolean, compacto: Boolean,
    onTitulo: (String) -> Unit, onSubtitulo: (String) -> Unit, onResumo: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        CampoFolha(
            value = titulo, onValueChange = onTitulo, editavel = editavel,
            placeholder = "Título do trabalho",
            style = TextStyle(
                fontWeight = FontWeight.ExtraBold, fontSize = if (compacto) 21.sp else 22.sp,
                lineHeight = 28.sp, color = Color(0xFF0F172A), textAlign = TextAlign.Center
            )
        )
        CampoFolha(
            value = subtitulo, onValueChange = onSubtitulo, editavel = editavel,
            placeholder = "Subtítulo (opcional)",
            style = TextStyle(
                fontSize = 14.sp, lineHeight = 20.sp, fontStyle = FontStyle.Italic,
                color = Color(0xFF475569), textAlign = TextAlign.Center
            )
        )
        if (autores.isNotBlank()) {
            Text(
                text = autores,
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF334155), textAlign = TextAlign.Center),
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
            )
        }
        Spacer(Modifier.height(12.dp))
        Surface(
            color = Color(0xFFF8FAFC),
            shape = RoundedCornerShape(6.dp),
            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(12.dp)) {
                Text("RESUMO", style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AthenesPrimary, letterSpacing = 0.5.sp))
                Spacer(Modifier.height(4.dp))
                CampoFolha(
                    value = resumo, onValueChange = onResumo, editavel = editavel,
                    placeholder = "Escreva o resumo do trabalho…",
                    style = TextStyle(fontSize = 13.sp, lineHeight = 19.sp, color = Color(0xFF334155), textAlign = TextAlign.Justify)
                )
            }
        }
    }
}

// ===================================================================
// Campo de texto leve (substitui OutlinedTextField: sem borda nem altura mínima de 56 dp)
// ===================================================================
@Composable
private fun CampoFolha(
    value: String,
    onValueChange: (String) -> Unit,
    style: TextStyle,
    placeholder: String,
    editavel: Boolean,
    modifier: Modifier = Modifier,
    onFocused: () -> Unit = {},
    onCursorChange: ((Int) -> Unit)? = null
) {
    var campo by remember { mutableStateOf(TextFieldValue(value)) }
    if (campo.text != value) campo = campo.copy(text = value, selection = TextRange(campo.selection.start.coerceAtMost(value.length)))
    BasicTextField(
        value = campo,
        onValueChange = {
            campo = it
            if (it.text != value) onValueChange(it.text)
            onCursorChange?.invoke(it.selection.start)
        },
        readOnly = !editavel,
        textStyle = style,
        cursorBrush = SolidColor(AthenesPrimary),
        modifier = modifier
            .fillMaxWidth()
            .onFocusChanged { if (it.isFocused) { onFocused(); onCursorChange?.invoke(campo.selection.start) } },
        decorationBox = { interno ->
            // propagateMinConstraints: o campo interno ocupa a largura toda, então textAlign (centro/justificado) funciona
            Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), propagateMinConstraints = true) {
                if (value.isEmpty()) {
                    Text(
                        placeholder,
                        style = style.copy(color = AthenesTextMuted.copy(alpha = 0.7f), fontWeight = FontWeight.Normal)
                    )
                }
                interno()
            }
        }
    )
}

// ===================================================================
// Blocos da folha
// ===================================================================
@Composable
private fun ItemBlocoFolha(
    bloco: BlocoEditor,
    selecionado: Boolean,
    editavel: Boolean,
    compacto: Boolean,
    numeroFormula: Int,
    estrutura: List<SecaoEstrutura>,
    titulosIlustracoes: List<String>,
    referencias: List<ReferenciaAcademica>,
    estiloBibliografico: EstiloBibliografico,
    onVerConexoes: () -> Unit,
    onEscolherImagem: (String) -> Unit,
    vm: EditorViewModel
) {
    val borda = RoundedCornerShape(6.dp)
    val selecionar = { vm.selecionarBloco(bloco.id) }
    var posicaoCursor by remember(bloco.id) { mutableIntStateOf(0) }
    val alinhamento = when (bloco.alinhamento) {
        AlinhamentoTexto.ESQUERDA -> TextAlign.Left
        AlinhamentoTexto.CENTRO -> TextAlign.Center
        AlinhamentoTexto.DIREITA -> TextAlign.Right
        AlinhamentoTexto.JUSTIFICADO, AlinhamentoTexto.JUSTIFICADO_ESQUERDA,
        AlinhamentoTexto.JUSTIFICADO_CENTRO, AlinhamentoTexto.JUSTIFICADO_DIREITA -> TextAlign.Justify
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(borda)
            .background(if (selecionado) AthenesPrimary.copy(alpha = 0.04f) else Color.Transparent)
            .border(1.dp, if (selecionado) AthenesPrimary.copy(alpha = 0.6f) else Color.Transparent, borda)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { selecionar() }
            .padding(horizontal = 4.dp, vertical = 2.dp)
    ) {
        when (bloco.tipo) {
            TipoBlocoEditor.TITULO -> Row(verticalAlignment = Alignment.CenterVertically) {
                val numero = estrutura.find { it.id == bloco.id }?.numero
                if (numero != null) Text(numero, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextoCor, modifier = Modifier.padding(end = 8.dp))
                CampoFolha(
                    value = bloco.titulo, onValueChange = { vm.atualizarTituloBloco(bloco.id, it) },
                    editavel = editavel, placeholder = "Título da seção", onFocused = selecionar,
                    modifier = Modifier.weight(1f),
                    style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 22.sp, color = Color(0xFF0F172A), letterSpacing = 0.3.sp, textAlign = alinhamento)
                )
            }

            TipoBlocoEditor.PARAGRAFO -> Column {
                CampoFolha(
                    value = bloco.texto, onValueChange = { vm.atualizarTextoBloco(bloco.id, it) },
                    editavel = editavel, placeholder = "Escreva aqui…", onFocused = selecionar,
                    onCursorChange = { posicaoCursor = it; vm.posicionarCursorTexto(bloco.id, it) },
                    modifier = Modifier.padding(start = if (compacto) 14.dp else 24.dp),
                    style = TextStyle(fontSize = if (compacto) 14.sp else 12.5.sp, lineHeight = if (compacto) 22.sp else 19.sp, color = TextoCor, textAlign = alinhamento)
                )
                if (selecionado && editavel && posicaoCursor in 1 until bloco.texto.length) {
                    TextButton(onClick = { vm.dividirBloco(bloco.id, posicaoCursor) }) { Text("Dividir bloco aqui") }
                }
            }

            TipoBlocoEditor.LISTA -> Column {
                val itens = bloco.texto.lines()
                if (editavel) Row {
                    FilterChip(selected = !bloco.listaNumerada, onClick = { vm.definirListaNumerada(bloco.id, false) }, label = { Text("Marcadores") })
                    Spacer(Modifier.width(8.dp))
                    FilterChip(selected = bloco.listaNumerada, onClick = { vm.definirListaNumerada(bloco.id, true) }, label = { Text("Numerada") })
                }
                itens.forEachIndexed { indice, item ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Text(if (bloco.listaNumerada) "${indice + 1}." else "•", modifier = Modifier.padding(top = 2.dp, end = 8.dp), color = TextoCor)
                        CampoFolha(
                            value = item,
                            onValueChange = { novo ->
                                vm.atualizarTextoBloco(bloco.id, itens.toMutableList().apply { this[indice] = novo.replace("\n", " ") }.joinToString("\n"))
                            },
                            editavel = editavel, placeholder = "Item da lista…", onFocused = selecionar,
                            style = TextStyle(fontSize = if (compacto) 14.sp else 12.5.sp, lineHeight = 21.sp, color = TextoCor)
                        )
                    }
                }
                if (editavel) TextButton(onClick = { vm.atualizarTextoBloco(bloco.id, bloco.texto + "\n") }) { Text("Adicionar item") }
            }

            TipoBlocoEditor.SUMARIO -> Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Text("SUMÁRIO", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextoCor)
                estrutura.forEach { secao ->
                    Text("${secao.numero}  ${secao.titulo}", fontSize = 12.sp, color = TextoCor, modifier = Modifier.padding(top = 4.dp, start = ((secao.nivel - 1) * 8).dp))
                }
                if (estrutura.isEmpty()) Text("Adicione títulos para gerar o sumário.", fontSize = 12.sp, color = AthenesTextMuted)
            }

            TipoBlocoEditor.LISTA_ILUSTRACOES -> Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Text("LISTA DE ILUSTRAÇÕES", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextoCor)
                titulosIlustracoes.forEach { titulo -> Text(titulo, fontSize = 12.sp, color = TextoCor, modifier = Modifier.padding(top = 4.dp)) }
                if (titulosIlustracoes.isEmpty()) Text("Adicione figuras, tabelas ou quadros com legenda.", fontSize = 12.sp, color = AthenesTextMuted)
            }

            TipoBlocoEditor.REFERENCIAS -> Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Text("REFERÊNCIAS", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextoCor)
                TextButton(onClick = onVerConexoes, modifier = Modifier.heightIn(min = 48.dp)) { Text("Ver conexões") }
                Bibliografia.ordenar(referencias, estiloBibliografico).forEachIndexed { indice, ref ->
                    Text(Bibliografia.formatar(ref, estiloBibliografico, indice + 1), fontSize = 12.sp,
                        color = TextoCor, modifier = Modifier.padding(top = 8.dp))
                }
                if (referencias.isEmpty()) Text("Cite obras da biblioteca para gerar as referências.", fontSize = 12.sp, color = AthenesTextMuted)
            }

            TipoBlocoEditor.QUEBRA_PAGINA -> Column {
                HorizontalDivider(color = AthenesPrimary.copy(alpha = 0.5f), modifier = Modifier.padding(top = 12.dp))
                Text("Quebra de página", fontSize = 11.sp, color = AthenesTextMuted)
            }

            TipoBlocoEditor.CITACAO -> Column {
                Row(modifier = Modifier.fillMaxWidth().padding(start = if (compacto) 28.dp else 50.dp).height(IntrinsicSize.Min)) {
                    Box(Modifier.width(3.dp).fillMaxHeight().background(AthenesPrimary))
                    Spacer(Modifier.width(8.dp))
                    CampoFolha(
                        value = bloco.texto, onValueChange = { vm.atualizarTextoBloco(bloco.id, it) },
                        editavel = editavel, placeholder = "Citação direta longa (mais de 3 linhas)…", onFocused = selecionar,
                        onCursorChange = { posicaoCursor = it; vm.posicionarCursorTexto(bloco.id, it) },
                        style = TextStyle(fontSize = if (compacto) 12.5.sp else 11.sp, lineHeight = if (compacto) 18.sp else 15.sp, color = Color(0xFF334155), textAlign = TextAlign.Justify)
                    )
                }
                if (selecionado && editavel && posicaoCursor in 1 until bloco.texto.length) {
                    TextButton(onClick = { vm.dividirBloco(bloco.id, posicaoCursor) }) { Text("Dividir bloco aqui") }
                }
            }

            TipoBlocoEditor.FIGURA -> Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                CampoLegenda(bloco.legenda, "Legenda da figura", editavel, selecionar) { vm.atualizarLegendaBloco(bloco.id, it) }
                Spacer(Modifier.height(6.dp))
                ImagemFigura(
                    nomeArquivo = bloco.imagem,
                    editavel = editavel,
                    onEscolher = { selecionar(); onEscolherImagem(bloco.id) }
                )
                if (selecionado && editavel && bloco.imagem.isNotEmpty()) {
                    TextButton(
                        onClick = { onEscolherImagem(bloco.id) },
                        modifier = Modifier.heightIn(min = 44.dp)
                    ) {
                        Icon(Icons.Rounded.Image, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Trocar imagem", fontSize = 13.sp)
                    }
                }
                Spacer(Modifier.height(4.dp))
                CampoFonte(bloco.fonte, editavel, selecionar) { vm.atualizarFonteBloco(bloco.id, it) }
            }

            TipoBlocoEditor.TABELA, TipoBlocoEditor.QUADRO -> Column(Modifier.fillMaxWidth()) {
                CampoLegenda(bloco.legenda, if (bloco.tipo == TipoBlocoEditor.QUADRO) "Título do quadro" else "Legenda da tabela", editavel, selecionar) { vm.atualizarLegendaBloco(bloco.id, it) }
                Spacer(Modifier.height(4.dp))
                HorizontalDivider(color = Color(0xFF1E293B), thickness = 1.2.dp)
                bloco.tabelaLinhas.forEachIndexed { i, linha ->
                    val cabecalho = i == 0
                    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        linha.forEachIndexed { j, celula ->
                            Box(Modifier.weight(1f)) {
                                CampoFolha(
                                    value = celula, onValueChange = { vm.atualizarCelulaTabela(bloco.id, i, j, it) },
                                    editavel = editavel, placeholder = "—", onFocused = selecionar,
                                    style = TextStyle(
                                        fontSize = 12.sp, lineHeight = 16.sp,
                                        fontWeight = if (cabecalho) FontWeight.Bold else FontWeight.Normal,
                                        color = if (cabecalho) Color(0xFF0F172A) else Color(0xFF334155)
                                    )
                                )
                            }
                        }
                    }
                    if (cabecalho) HorizontalDivider(color = Color(0xFFCBD5E1), thickness = 1.dp)
                }
                HorizontalDivider(color = Color(0xFF1E293B), thickness = 1.2.dp)
                if (selecionado && editavel) {
                    TextButton(
                        onClick = { vm.adicionarLinhaTabela(bloco.id) },
                        modifier = Modifier.heightIn(min = 44.dp)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Linha", fontSize = 13.sp)
                    }
                }
                CampoFonte(bloco.fonte, editavel, selecionar) { vm.atualizarFonteBloco(bloco.id, it) }
            }

            TipoBlocoEditor.FORMULA -> Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = Color(0xFFF8FAFC),
                    shape = RoundedCornerShape(6.dp),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.weight(1f)
                ) {
                    Box(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                        CampoFolha(
                            value = bloco.formulaLatex, onValueChange = { vm.atualizarFormulaBloco(bloco.id, it) },
                            editavel = editavel, placeholder = "Fórmula (ex.: x = y + z)", onFocused = selecionar,
                            style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 15.sp, color = AthenesPrimary, textAlign = TextAlign.Center, letterSpacing = 0.4.sp)
                        )
                    }
                }
                Text("($numeroFormula)", style = TextStyle(fontWeight = FontWeight.Bold, color = AthenesTextMuted, fontSize = 12.sp), modifier = Modifier.padding(start = 8.dp))
            }

            TipoBlocoEditor.DIVISOR -> HorizontalDivider(color = Color(0xFFCBD5E1), thickness = 1.dp, modifier = Modifier.padding(vertical = 14.dp))
        }
    }
}

@Composable
private fun CampoLegenda(valor: String, placeholder: String, editavel: Boolean, onFocused: () -> Unit, onChange: (String) -> Unit) {
    CampoFolha(
        value = valor, onValueChange = onChange, editavel = editavel, placeholder = placeholder, onFocused = onFocused,
        style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp, color = TextoCor, textAlign = TextAlign.Center)
    )
}

@Composable
private fun CampoFonte(valor: String, editavel: Boolean, onFocused: () -> Unit, onChange: (String) -> Unit) {
    CampoFolha(
        value = valor, onValueChange = onChange, editavel = editavel, placeholder = "Fonte: …", onFocused = onFocused,
        style = TextStyle(fontStyle = FontStyle.Italic, fontSize = 11.sp, lineHeight = 15.sp, color = AthenesTextMuted, textAlign = TextAlign.Center)
    )
}

/** Imagem da figura (decodificada reduzida, fora da thread principal) ou área de toque para escolher. */
@Composable
private fun ImagemFigura(nomeArquivo: String, editavel: Boolean, onEscolher: () -> Unit) {
    val context = LocalContext.current
    val bitmap by produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, nomeArquivo) {
        value = if (nomeArquivo.isEmpty()) null
        else withContext(Dispatchers.IO) { ImagemRepositorio.carregar(context, nomeArquivo) }
    }
    val img = bitmap
    if (img != null) {
        Image(
            bitmap = img,
            contentDescription = "Figura",
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp)
        )
    } else {
        Surface(
            onClick = onEscolher,
            enabled = editavel,
            color = Color(0xFFF1F5F9),
            shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
            modifier = Modifier.fillMaxWidth().height(120.dp)
        ) {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Rounded.Image, contentDescription = null, tint = AthenesTextMuted, modifier = Modifier.size(32.dp))
                Text(
                    if (editavel) "Toque para escolher a imagem" else "Sem imagem",
                    style = TextStyle(fontSize = 12.sp, color = AthenesTextMuted)
                )
            }
        }
    }
}
