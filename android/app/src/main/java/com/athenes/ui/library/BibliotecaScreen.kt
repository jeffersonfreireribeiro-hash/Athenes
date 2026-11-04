package com.athenes.ui.library

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.Documento
import com.athenes.core.data.ZoteroCredentialsStore
import com.athenes.core.data.ZoteroColecoes
import com.athenes.core.data.PastasDocumento
import com.athenes.core.data.OrdemDocumentos
import com.athenes.core.updater.AppUpdateInfo
import com.athenes.ui.components.*
import com.athenes.ui.theme.*
import com.athenes.ui.updater.UpdateBanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BibliotecaScreen(
    viewModel: BibliotecaViewModel,
    onAbrirDocumento: (Documento) -> Unit,
    onAbrirLeitorPdf: (String) -> Unit = {},
    modoAtivo: Int = 0,
    onModoAlterado: (Int) -> Unit = {},
    updateInfo: AppUpdateInfo? = null,
    onOpenUpdateDialog: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val escopo = rememberCoroutineScope()
    val escolherDocumentoJson = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) escopo.launch {
            val resultado = runCatching {
                val texto = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { entrada ->
                        String(entrada.readNBytes(10_000_001), Charsets.UTF_8)
                    } ?: error("Não foi possível abrir o arquivo.")
                }
                withContext(Dispatchers.IO) { viewModel.importarDocumentoJson(texto) }
            }
            Toast.makeText(context, resultado.fold(
                onSuccess = { "Documento importado: ${it.titulo}" },
                onFailure = { it.message ?: "Não foi possível importar o arquivo." }
            ), Toast.LENGTH_LONG).show()
        }
    }
    val escolherBib = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) escopo.launch {
            val resultado = runCatching {
                val texto = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { entrada ->
                        String(entrada.readNBytes(10_000_001), Charsets.UTF_8)
                    } ?: error("Não foi possível abrir o arquivo BIB.")
                }
                viewModel.importarBib(texto)
            }
            Toast.makeText(context, resultado.fold(
                onSuccess = { "$it referências importadas do BIB." },
                onFailure = { it.message ?: "Não foi possível importar o BIB." }
            ), Toast.LENGTH_LONG).show()
        }
    }
    val credenciaisZotero = remember(context) { ZoteroCredentialsStore(context) }
    var pdfNovoArtigoUri by remember { mutableStateOf<Uri?>(null) }
    var pdfNovoArtigoNome by remember { mutableStateOf<String?>(null) }
    val escolherPdfNovoArtigo = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val permissao = runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            if (permissao.isFailure) {
                Toast.makeText(context, "Não foi possível manter acesso ao PDF.", Toast.LENGTH_LONG).show()
            } else {
                pdfNovoArtigoUri = uri
                pdfNovoArtigoNome = runCatching {
                    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                        if (cursor.moveToFirst()) cursor.getString(0) else null
                    }
                }.getOrNull() ?: "PDF selecionado"
            }
        }
    }
    var updateBannerDismissed by remember { mutableStateOf(false) }

    // Estados da Aba 1 (Escrita)
    val textoBusca by viewModel.textoBusca.collectAsState()
    val tipoFiltro by viewModel.tipoFiltro.collectAsState()
    val ordemDocumentos by viewModel.ordemDocumentos.collectAsState()
    val documentos by viewModel.documentosFiltrados.collectAsState()
    val contagensPastas = remember(documentos) { documentos.groupingBy { it.pastaId }.eachCount() }
    val lixeira by viewModel.lixeira.collectAsState()
    val pastas by viewModel.pastas.collectAsState()
    val arvorePastas = remember(pastas) { PastasDocumento.organizar(pastas) }
    var mostrandoLixeira by rememberSaveable { mutableStateOf(false) }
    var mostrarPastas by remember { mutableStateOf(false) }
    var pastaAtivaId by rememberSaveable { mutableStateOf<String?>(null) }
    var criarPastaAberto by remember { mutableStateOf(false) }
    var nomeNovaPasta by remember { mutableStateOf("") }
    var renomearPastaAberto by remember { mutableStateOf(false) }
    var excluirPastaAberto by remember { mutableStateOf(false) }
    var nomePastaEditada by remember { mutableStateOf("") }
    var documentoParaMover by remember { mutableStateOf<Documento?>(null) }
    var documentoParaExcluirDefinitivamente by remember { mutableStateOf<Documento?>(null) }

    // Estados da Aba 2 (Artigos / Zotero)
    val textoBuscaArtigos by viewModel.textoBuscaArtigos.collectAsState()
    val artigos by viewModel.artigosFiltrados.collectAsState()
    val estadoZotero by viewModel.estadoZotero.collectAsState()
    val sincronizandoZotero by viewModel.sincronizandoZotero.collectAsState()
    val conectadoZotero by viewModel.conectadoZotero.collectAsState()
    val colecoesZotero by viewModel.colecoesZotero.collectAsState()
    val colecoesEmArvore = remember(colecoesZotero) { ZoteroColecoes.organizar(colecoesZotero) }
    var mostrarColecoes by remember { mutableStateOf(false) }
    val tipoZoteroFiltro by viewModel.tipoZoteroFiltro.collectAsState()
    val colecaoZoteroFiltro by viewModel.colecaoZoteroFiltro.collectAsState()
    val anoMinimo by viewModel.anoMinimo.collectAsState()
    val ordemZotero by viewModel.ordemZotero.collectAsState()
    var mostrarConexaoZotero by remember { mutableStateOf(false) }
    var chaveZotero by remember { mutableStateOf("") }
    var usuarioZotero by remember { mutableStateOf("") }
    var novoArtigoAberto by remember { mutableStateOf(false) }

    val dialogNovoAberto by viewModel.dialogNovoAberto.collectAsState()
    val docParaExcluir by viewModel.docParaExcluir.collectAsState()
    val docParaRenomear by viewModel.docParaRenomear.collectAsState()

    Scaffold(
        topBar = {
            AthenesTopBar(
                modoAtivo = modoAtivo,
                onModoAlterado = onModoAlterado,
                onMenuClick = { if (modoAtivo == 0) mostrarPastas = true else mostrarColecoes = true }
            )
        },
        containerColor = AthenesBg,
        modifier = modifier.fillMaxSize()
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // ========================================================
            // CABEÇALHO DA SEÇÃO (IDÊNTICO AO WEB ATHENES)
            // ========================================================
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = if (modoAtivo == 0) "Meus documentos" else "Biblioteca e fichamentos",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 19.sp,
                        color = AthenesText
                    )
                )

                // Botões de Ação Específicos para a Aba de Artigos / Zotero (Idênticos ao Web)
                if (modoAtivo == 1) {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                credenciaisZotero.carregar()?.let { (chave, usuario) ->
                                    chaveZotero = chave
                                    usuarioZotero = usuario
                                }
                                mostrarConexaoZotero = true
                            },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            modifier = Modifier.heightIn(min = 48.dp).weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = AthenesPrimary)
                        ) {
                            Icon(Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = if (sincronizandoZotero) "Sincronizando…" else "Sincronizar Zotero", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { pdfNovoArtigoUri = null; pdfNovoArtigoNome = null; novoArtigoAberto = true },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.heightIn(min = 48.dp).weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AthenesPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(text = "Novo artigo", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Banner de Notificação de Atualização Disponível
            if (updateInfo != null && updateInfo.temNovaVersao && !updateBannerDismissed) {
                UpdateBanner(
                    updateInfo = updateInfo,
                    onOpenDialog = onOpenUpdateDialog,
                    onDismiss = { updateBannerDismissed = true }
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            // ========================================================
            // CONTEÚDO DA ABA SELECIONADA
            // ========================================================
            if (modoAtivo == 0) {
                // ABA 1: ESCRITA & DOCUMENTOS
                AthenesSearchBar(
                    textoBusca = textoBusca,
                    onBuscaAlterada = viewModel::setTextoBusca,
                    tipoFiltro = tipoFiltro,
                    onTipoFiltroAlterado = viewModel::setTipoFiltro,
                    onNovoDocumentoClick = viewModel::abrirDialogNovo
                )

                TextButton(onClick = { escolherDocumentoJson.launch("application/json") }) {
                    Icon(Icons.Rounded.FileOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Importar documento JSON")
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val pastaAtiva = arvorePastas.find { it.pasta.id == pastaAtivaId }
                    OutlinedButton(onClick = { mostrarPastas = true }) {
                        Icon(Icons.Rounded.Folder, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(pastaAtiva?.caminho ?: "Todos (${documentos.size})")
                    }
                    FilterChip(selected = mostrandoLixeira, onClick = { mostrandoLixeira = true }, label = { Text("Lixeira (${lixeira.size})") })
                    if (!mostrandoLixeira) OutlinedButton(onClick = { nomeNovaPasta = ""; criarPastaAberto = true }) { Text("Nova pasta") }
                    if (pastaAtivaId != null && !mostrandoLixeira) {
                        TextButton(onClick = {
                            nomePastaEditada = pastas.find { it.id == pastaAtivaId }?.nome.orEmpty()
                            renomearPastaAberto = true
                        }) { Text("Renomear") }
                        TextButton(onClick = { excluirPastaAberto = true }) { Text("Excluir pasta") }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OrdemDocumentos.entries.forEach { ordem ->
                        FilterChip(
                            selected = ordemDocumentos == ordem,
                            onClick = { viewModel.setOrdemDocumentos(ordem) },
                            label = { Text(ordem.rotulo) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                    val painelLateral = maxWidth >= 900.dp
                    val larguraConteudo = maxWidth - if (painelLateral) 236.dp else 0.dp
                    val colunas = if (larguraConteudo >= 900.dp) GridCells.Fixed(3) else if (larguraConteudo >= 600.dp) GridCells.Fixed(2) else GridCells.Fixed(1)
                    val documentosNaPasta = if (mostrandoLixeira) lixeira else if (pastaAtivaId == null) documentos else documentos.filter { it.pastaId == pastaAtivaId }
                    Row(Modifier.fillMaxSize()) {
                    if (painelLateral) {
                        Surface(
                            modifier = Modifier.width(220.dp).fillMaxHeight(),
                            color = Color.White,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
                        ) {
                            LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                                item {
                                    TextButton(onClick = { pastaAtivaId = null; mostrandoLixeira = false }, modifier = Modifier.fillMaxWidth()) {
                                        Text("Todos (${documentos.size})", modifier = Modifier.fillMaxWidth())
                                    }
                                }
                                items(arvorePastas, key = { it.pasta.id }) { entrada ->
                                    TextButton(
                                        onClick = { pastaAtivaId = entrada.pasta.id; mostrandoLixeira = false },
                                        modifier = Modifier.fillMaxWidth().padding(start = (entrada.nivel * 12).coerceAtMost(72).dp)
                                    ) {
                                        Text("${entrada.pasta.nome} (${contagensPastas[entrada.pasta.id] ?: 0})", modifier = Modifier.fillMaxWidth(), fontWeight = if (entrada.pasta.id == pastaAtivaId && !mostrandoLixeira) FontWeight.Bold else FontWeight.Normal)
                                    }
                                }
                                item {
                                    HorizontalDivider()
                                    TextButton(onClick = { mostrandoLixeira = true }, modifier = Modifier.fillMaxWidth()) {
                                        Text("Lixeira (${lixeira.size})", modifier = Modifier.fillMaxWidth())
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.width(16.dp))
                    }
                    Box(Modifier.weight(1f).fillMaxHeight()) {
                    if (documentosNaPasta.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(top = 40.dp),
                            contentAlignment = Alignment.TopCenter
                        ) {
                            Text(
                                text = if (mostrandoLixeira) "Lixeira vazia." else if (textoBusca.isNotBlank()) "Nenhum documento encontrado para \"$textoBusca\"" else "Nenhum documento nesta pasta.",
                                style = MaterialTheme.typography.bodyMedium.copy(color = AthenesTextMuted)
                            )
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = colunas,
                            contentPadding = PaddingValues(bottom = 24.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(documentosNaPasta, key = { it.id }, contentType = { "documento" }) { doc ->
                                if (mostrandoLixeira) Card(Modifier.fillMaxWidth()) {
                                    Column(Modifier.padding(16.dp)) {
                                        Text(doc.titulo, fontWeight = FontWeight.Bold)
                                        Row {
                                            TextButton(onClick = { viewModel.restaurarDocumento(doc.id) }) { Text("Restaurar") }
                                            TextButton(onClick = { documentoParaExcluirDefinitivamente = doc }) { Text("Excluir definitivamente") }
                                        }
                                    }
                                } else AthenesCard(
                                    documento = doc,
                                    onAbrirClick = { onAbrirDocumento(doc) },
                                    onDuplicarClick = { viewModel.duplicarDocumento(doc.id) },
                                    onRenomearClick = { viewModel.solicitarRenomear(doc) },
                                    onExcluirClick = { viewModel.solicitarExclusao(doc) },
                                    onMoverClick = { documentoParaMover = doc }
                                )
                            }
                        }
                    }
                    }
                    }
                }
            } else {
                // ABA 2: LEITURA DE ARTIGOS, PDF & ZOTERO (CATÁLOGO DE ARTIGOS)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = textoBuscaArtigos,
                        onValueChange = viewModel::setTextoBuscaArtigos,
                        placeholder = {
                            Text(
                                text = "Pesquisar por título, autor, chave Zotero ou DOI...",
                                fontSize = 12.sp,
                                color = AthenesTextMuted
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Rounded.Search,
                                contentDescription = null,
                                tint = AthenesTextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = AthenesPrimary,
                            unfocusedBorderColor = Color(0xFFE2E8F0)
                        ),
                        textStyle = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                        modifier = Modifier.weight(1f)
                    )

                    // Badge de Status Conexão Zotero
                    Surface(
                        color = Color(0xFFECFDF5),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0)),
                        modifier = Modifier.height(48.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(Color(0xFF10B981), androidx.compose.foundation.shape.CircleShape)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (conectadoZotero) "Zotero conectado" else "Zotero não conectado",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF047857)
                                )
                            )
                        }
                    }
                }

                TextButton(onClick = { escolherBib.launch("*/*") }) {
                    Icon(Icons.Rounded.FileOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Importar referências BIB")
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (estadoZotero.isNotBlank()) {
                    Text(estadoZotero, style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        null to "Todos", "journalArticle" to "Artigos", "book" to "Livros",
                        "thesis" to "Teses", "conferencePaper" to "Conferências", "fichados" to "Fichados"
                    ).forEach { (tipo, nome) ->
                        FilterChip(selected = tipoZoteroFiltro == tipo, onClick = { viewModel.filtrarTipoZotero(tipo) }, label = { Text(nome) })
                    }
                }
                if (colecoesZotero.isNotEmpty()) {
                    val colecaoAtiva = colecoesEmArvore.find { it.colecao.chave == colecaoZoteroFiltro }
                    OutlinedButton(onClick = { mostrarColecoes = true }) {
                        Icon(Icons.Rounded.Folder, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(colecaoAtiva?.caminho ?: "Todas as coleções")
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = anoMinimo == null, onClick = { viewModel.filtrarAnoMinimo(null) }, label = { Text("Todos os anos") })
                    FilterChip(selected = anoMinimo == 2020, onClick = { viewModel.filtrarAnoMinimo(2020) }, label = { Text("Desde 2020") })
                    FilterChip(selected = ordemZotero == "recentes", onClick = { viewModel.ordenarZotero("recentes") }, label = { Text("Recentes") })
                    FilterChip(selected = ordemZotero == "titulo", onClick = { viewModel.ordenarZotero("titulo") }, label = { Text("Título") })
                }

                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                    val colunas = if (maxWidth >= 900.dp) GridCells.Fixed(3) else if (maxWidth >= 600.dp) GridCells.Fixed(2) else GridCells.Fixed(1)

                    if (artigos.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(top = 40.dp),
                            contentAlignment = Alignment.TopCenter
                        ) {
                            Text(
                                text = if (textoBuscaArtigos.isNotBlank()) "Nenhum artigo encontrado para \"$textoBuscaArtigos\"" else "Nenhum artigo cadastrado.",
                                style = MaterialTheme.typography.bodyMedium.copy(color = AthenesTextMuted)
                            )
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = colunas,
                            contentPadding = PaddingValues(bottom = 24.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(artigos, key = { it.id }) { art ->
                                ArtigoEstudoCard(
                                    artigo = art,
                                    onAbrirTelaCheiaClick = {
                                        onAbrirLeitorPdf(art.id)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Diálogos Modais Contextuais
    if (novoArtigoAberto) {
        DialogNovoArtigoLocal(
            onFechar = { novoArtigoAberto = false },
            pdfNome = pdfNovoArtigoNome,
            onSelecionarPdf = { escolherPdfNovoArtigo.launch(arrayOf("application/pdf")) },
            onCriar = { titulo, autores, ano, publicacao, resumo ->
                val artigo = viewModel.criarArtigoLocal(titulo, autores, ano, publicacao, resumo)
                pdfNovoArtigoUri?.let { uri ->
                    context.getSharedPreferences("pdf_artigos", 0).edit().putString(artigo.id, uri.toString()).apply()
                }
                novoArtigoAberto = false
                onAbrirLeitorPdf(artigo.id)
            }
        )
    }
    if (dialogNovoAberto) {
        DialogNovoDocumento(
            onDismiss = viewModel::fecharDialogNovo,
            onConfirmar = { titulo, subtitulo, tipo, autor ->
                val novo = viewModel.criarNovoDocumento(titulo, subtitulo, tipo, autor)
                onAbrirDocumento(novo)
            }
        )
    }

    docParaExcluir?.let { doc ->
        DialogConfirmarExclusao(
            documento = doc,
            onDismiss = viewModel::fecharDialogExclusao,
            onConfirmar = viewModel::confirmarExclusao
        )
    }
    documentoParaExcluirDefinitivamente?.let { doc ->
        AlertDialog(
            onDismissRequest = { documentoParaExcluirDefinitivamente = null },
            title = { Text("Excluir definitivamente?") },
            text = { Text("\"${doc.titulo}\" e seu conteúdo editável serão removidos deste aparelho.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.excluirDefinitivamente(doc.id)
                    documentoParaExcluirDefinitivamente = null
                }) { Text("Excluir definitivamente") }
            },
            dismissButton = { TextButton(onClick = { documentoParaExcluirDefinitivamente = null }) { Text("Cancelar") } }
        )
    }

    docParaRenomear?.let { doc ->
        DialogRenomear(
            documento = doc,
            onDismiss = viewModel::fecharDialogRenomear,
            onConfirmar = viewModel::confirmarRenomear
        )
    }
    if (criarPastaAberto) {
        AlertDialog(
            onDismissRequest = { criarPastaAberto = false },
            title = { Text(if (pastaAtivaId == null) "Nova pasta" else "Nova subpasta") },
            text = { OutlinedTextField(value = nomeNovaPasta, onValueChange = { nomeNovaPasta = it }, label = { Text("Nome") }) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.criarPasta(nomeNovaPasta, pastaAtivaId)
                    criarPastaAberto = false
                }, enabled = nomeNovaPasta.isNotBlank()) { Text("Criar") }
            },
            dismissButton = { TextButton(onClick = { criarPastaAberto = false }) { Text("Cancelar") } }
        )
    }
    if (renomearPastaAberto) {
        AlertDialog(
            onDismissRequest = { renomearPastaAberto = false },
            title = { Text("Renomear pasta") },
            text = { OutlinedTextField(value = nomePastaEditada, onValueChange = { nomePastaEditada = it }, label = { Text("Nome") }) },
            confirmButton = {
                TextButton(onClick = {
                    pastaAtivaId?.let { viewModel.renomearPasta(it, nomePastaEditada) }
                    renomearPastaAberto = false
                }, enabled = nomePastaEditada.isNotBlank()) { Text("Salvar") }
            },
            dismissButton = { TextButton(onClick = { renomearPastaAberto = false }) { Text("Cancelar") } }
        )
    }
    if (excluirPastaAberto) {
        AlertDialog(
            onDismissRequest = { excluirPastaAberto = false },
            title = { Text("Excluir pasta?") },
            text = { Text("Os documentos voltarão para Meus documentos. As subpastas também serão excluídas.") },
            confirmButton = {
                TextButton(onClick = {
                    pastaAtivaId?.let { viewModel.excluirPasta(it) }
                    pastaAtivaId = null
                    excluirPastaAberto = false
                }) { Text("Excluir") }
            },
            dismissButton = { TextButton(onClick = { excluirPastaAberto = false }) { Text("Cancelar") } }
        )
    }
    documentoParaMover?.let { doc ->
        AlertDialog(
            onDismissRequest = { documentoParaMover = null },
            title = { Text("Mover para…") },
            text = {
                Column {
                    TextButton(onClick = { viewModel.moverDocumento(doc.id, null); documentoParaMover = null }) { Text("Meus documentos") }
                    pastas.forEach { pasta ->
                        TextButton(onClick = { viewModel.moverDocumento(doc.id, pasta.id); documentoParaMover = null }) {
                            Text(pasta.nome)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { documentoParaMover = null }) { Text("Cancelar") } }
        )
    }
    if (mostrarConexaoZotero) {
        AlertDialog(
            onDismissRequest = { mostrarConexaoZotero = false },
            title = { Text("Conectar Zotero") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Informe sua chave do Zotero. O ID é opcional; o aplicativo pode descobri-lo pela chave. A chave fica protegida neste aparelho.")
                    OutlinedTextField(
                        value = chaveZotero,
                        onValueChange = { chaveZotero = it },
                        label = { Text("Chave de API") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = usuarioZotero,
                        onValueChange = { usuarioZotero = it },
                        label = { Text("ID do usuário (opcional)") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    runCatching { credenciaisZotero.salvar(chaveZotero, usuarioZotero) }
                        .onSuccess {
                            viewModel.sincronizarZotero(chaveZotero, usuarioZotero)
                            chaveZotero = ""
                            mostrarConexaoZotero = false
                        }
                        .onFailure {
                            Toast.makeText(context, "Não foi possível proteger a chave neste aparelho.", Toast.LENGTH_SHORT).show()
                        }
                }, enabled = chaveZotero.isNotBlank()) { Text("Sincronizar") }
            },
            dismissButton = { TextButton(onClick = { mostrarConexaoZotero = false }) { Text("Cancelar") } }
        )
    }
    if (mostrarColecoes) {
        ModalBottomSheet(onDismissRequest = { mostrarColecoes = false }) {
            Text("Coleções do Zotero", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 560.dp)) {
                item {
                    TextButton(onClick = { viewModel.filtrarColecaoZotero(null); mostrarColecoes = false }, modifier = Modifier.fillMaxWidth()) {
                        Text("Todas as coleções", modifier = Modifier.fillMaxWidth())
                    }
                }
                items(colecoesEmArvore, key = { it.colecao.chave }) { entrada ->
                    TextButton(
                        onClick = { viewModel.filtrarColecaoZotero(entrada.colecao.chave); mostrarColecoes = false },
                        modifier = Modifier.fillMaxWidth().padding(start = (entrada.nivel * 16).coerceAtMost(96).dp)
                    ) {
                        Text(entrada.colecao.nome, modifier = Modifier.fillMaxWidth(), fontWeight = if (entrada.colecao.chave == colecaoZoteroFiltro) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }
        }
    }
    if (mostrarPastas) {
        ModalBottomSheet(onDismissRequest = { mostrarPastas = false }) {
            Text("Pastas de documentos", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 560.dp)) {
                item {
                    TextButton(onClick = { pastaAtivaId = null; mostrandoLixeira = false; mostrarPastas = false }, modifier = Modifier.fillMaxWidth()) {
                        Text("Todos (${documentos.size})", modifier = Modifier.fillMaxWidth())
                    }
                }
                items(arvorePastas, key = { it.pasta.id }) { entrada ->
                    TextButton(
                        onClick = { pastaAtivaId = entrada.pasta.id; mostrandoLixeira = false; mostrarPastas = false },
                        modifier = Modifier.fillMaxWidth().padding(start = (entrada.nivel * 16).coerceAtMost(96).dp)
                    ) {
                        Text("${entrada.pasta.nome} (${contagensPastas[entrada.pasta.id] ?: 0})", modifier = Modifier.fillMaxWidth(), fontWeight = if (entrada.pasta.id == pastaAtivaId) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }
        }
    }
}

@Composable
fun DialogNovoArtigoLocal(
    onFechar: () -> Unit,
    pdfNome: String? = null,
    onSelecionarPdf: () -> Unit = {},
    onCriar: (String, String, Int, String, String) -> Unit
) {
    var titulo by rememberSaveable { mutableStateOf("") }
    var autores by rememberSaveable { mutableStateOf("") }
    var ano by rememberSaveable { mutableStateOf(java.time.Year.now().value.toString()) }
    var publicacao by rememberSaveable { mutableStateOf("") }
    var resumo by rememberSaveable { mutableStateOf("") }
    val anoValor = ano.toIntOrNull()
    AlertDialog(
        onDismissRequest = onFechar,
        title = { Text("Novo artigo") },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Crie um registro local. Você pode vincular um PDF agora ou no estúdio.", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(titulo, { titulo = it }, label = { Text("Título") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(autores, { autores = it }, label = { Text("Autores") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(ano, { ano = it.filter(Char::isDigit).take(4) }, label = { Text("Ano") }, singleLine = true, modifier = Modifier.fillMaxWidth(), isError = anoValor == null || anoValor !in 1500..2100)
                OutlinedTextField(publicacao, { publicacao = it }, label = { Text("Publicação") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(resumo, { resumo = it }, label = { Text("Resumo") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = onSelecionarPdf, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Text(pdfNome ?: "Selecionar PDF")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onCriar(titulo.trim(), autores.trim(), anoValor!!, publicacao.trim(), resumo.trim()) },
                enabled = titulo.isNotBlank() && anoValor != null && anoValor in 1500..2100) { Text("Adicionar e abrir") }
        },
        dismissButton = { TextButton(onClick = onFechar) { Text("Cancelar") } }
    )
}
