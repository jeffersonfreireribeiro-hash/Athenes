package com.athenes.ui.library

import android.content.Intent
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.automirrored.rounded.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.Documento
import com.athenes.core.model.ArtigoEstudoDetalhado
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
    var pdfNovoArtigoUri by rememberSaveable { mutableStateOf<String?>(null) }
    var pdfNovoArtigoNome by rememberSaveable { mutableStateOf<String?>(null) }
    val escolherPdfNovoArtigo = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val permissao = runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            if (permissao.isFailure) {
                Toast.makeText(context, "Não foi possível manter acesso ao PDF.", Toast.LENGTH_LONG).show()
            } else {
                pdfNovoArtigoUri = uri.toString()
                pdfNovoArtigoNome = "PDF selecionado"
                escopo.launch {
                    val nome = withContext(Dispatchers.IO) {
                        runCatching {
                            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                                if (cursor.moveToFirst()) cursor.getString(0) else null
                            }
                        }.getOrNull()
                    }
                    if (pdfNovoArtigoUri == uri.toString()) pdfNovoArtigoNome = nome ?: "PDF selecionado"
                }
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
    var documentoDetalheId by rememberSaveable { mutableStateOf<String?>(null) }

    // Estados da Aba 2 (Artigos / Zotero)
    val textoBuscaArtigos by viewModel.textoBuscaArtigos.collectAsState()
    val artigos by viewModel.artigosFiltrados.collectAsState()
    val acervoCompleto by viewModel.artigos.collectAsState()
    var artigoLocalParaEditarId by rememberSaveable { mutableStateOf<String?>(null) }
    val artigoLocalParaEditar = acervoCompleto.find { it.id == artigoLocalParaEditarId }
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
    var novoArtigoAberto by rememberSaveable { mutableStateOf(false) }
    var artigoLocalParaExcluir by remember { mutableStateOf<ArtigoEstudoDetalhado?>(null) }

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

                // Botões de Ação Específicos para a Aba de Artigos / Zotero (Compactos e Alinhados à Direita)
                if (modoAtivo == 1) {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.End
                    ) {
                        // Botão Importar referências BIB (38dp, só ícone, Soft UI)
                        Surface(
                            onClick = { escolherBib.launch("*/*") },
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Rounded.PostAdd,
                                    contentDescription = "Importar referências BIB",
                                    tint = AthenesPrimary,
                                    modifier = Modifier.size(19.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        OutlinedButton(
                            onClick = {
                                credenciaisZotero.carregar()?.let { (chave, usuario) ->
                                    chaveZotero = chave
                                    usuarioZotero = usuario
                                }
                                mostrarConexaoZotero = true
                            },
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.height(38.dp),
                            border = BorderStroke(1.dp, AthenesPrimary),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = AthenesPrimary)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Sync,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (sincronizandoZotero) "Sincronizando…" else "Sincronizar Zotero",
                                style = TextStyle(
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = AthenesPrimary
                                )
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        Button(
                            onClick = {
                                pdfNovoArtigoUri = null
                                pdfNovoArtigoNome = null
                                artigoLocalParaEditarId = null
                                novoArtigoAberto = true
                            },
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            modifier = Modifier.height(38.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AthenesPrimary,
                                contentColor = Color.White
                            ),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Add,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Novo artigo",
                                style = TextStyle(
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            )
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

                Spacer(modifier = Modifier.height(10.dp))

                // LINHA DE PASTAS E AÇÕES RÁPIDAS UNIFICADA
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val pastaAtiva = arvorePastas.find { it.pasta.id == pastaAtivaId }
                    val rotuloPasta = if (mostrandoLixeira) "Lixeira" else pastaAtiva?.caminho ?: "Todos"
                    val totalDocsPasta = if (mostrandoLixeira) lixeira.size else if (pastaAtivaId == null) documentos.size else (contagensPastas[pastaAtivaId] ?: 0)

                    // À esquerda: Seletor de pasta ativa ("Todos (3)") e ações contextuais
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        AthenesPillFiltro(
                            rotulo = rotuloPasta,
                            ativo = !mostrandoLixeira,
                            onClick = {
                                if (mostrandoLixeira) mostrandoLixeira = false
                                mostrarPastas = true
                            },
                            icone = Icons.Rounded.Folder,
                            contador = totalDocsPasta
                        )

                        if (pastaAtivaId != null && !mostrandoLixeira) {
                            AthenesPillFiltro(
                                rotulo = "Renomear",
                                ativo = false,
                                onClick = {
                                    nomePastaEditada = pastas.find { it.id == pastaAtivaId }?.nome.orEmpty()
                                    renomearPastaAberto = true
                                },
                                icone = Icons.Rounded.Edit
                            )
                            AthenesPillFiltro(
                                rotulo = "Excluir pasta",
                                ativo = false,
                                onClick = { excluirPastaAberto = true },
                                icone = Icons.Rounded.DeleteOutline
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // À direita: Cluster de 3 botões de ícone (32dp cada, Soft UI, espaçados por 6dp)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // 1. [Importar JSON]: botão compacto só de ícone
                        Surface(
                            onClick = { escolherDocumentoJson.launch("application/json") },
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                            modifier = Modifier.size(32.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Rounded.FileUpload,
                                    contentDescription = "Importar documento JSON",
                                    tint = AthenesPrimary,
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                        }

                        // 2. [Nova pasta]: botão compacto só de ícone "+"
                        Surface(
                            onClick = { nomeNovaPasta = ""; criarPastaAberto = true },
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                            modifier = Modifier.size(32.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Rounded.Add,
                                    contentDescription = "Nova pasta",
                                    tint = AthenesPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        // 3. [Lixeira]: botão compacto só de ícone com badge se > 0
                        Surface(
                            onClick = { mostrandoLixeira = !mostrandoLixeira },
                            shape = RoundedCornerShape(8.dp),
                            color = if (mostrandoLixeira) Color(0xFFEEF4FA) else Color.White,
                            border = BorderStroke(1.dp, if (mostrandoLixeira) AthenesPrimary else Color(0xFFCBD5E1)),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center,
                                modifier = Modifier.padding(horizontal = 8.dp)
                            ) {
                                Icon(
                                    imageVector = if (mostrandoLixeira) Icons.Rounded.Delete else Icons.Rounded.DeleteOutline,
                                    contentDescription = "Lixeira",
                                    tint = if (mostrandoLixeira) AthenesPrimary else Color(0xFF64748B),
                                    modifier = Modifier.size(17.dp)
                                )
                                if (lixeira.isNotEmpty()) {
                                    Spacer(Modifier.width(4.dp))
                                    Surface(
                                        shape = RoundedCornerShape(999.dp),
                                        color = if (mostrandoLixeira) AthenesPrimary.copy(alpha = 0.15f) else Color(0xFFF1F5F9)
                                    ) {
                                        Text(
                                            text = lixeira.size.toString(),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (mostrandoLixeira) AthenesPrimary else Color(0xFF64748B),
                                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // CHIPS DE ORDENAÇÃO DE DOCUMENTOS (Pills Soft UI Athenes)
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OrdemDocumentos.entries.forEach { ordem ->
                        AthenesPillFiltro(
                            rotulo = ordem.rotulo,
                            ativo = ordemDocumentos == ordem,
                            onClick = { viewModel.setOrdemDocumentos(ordem) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                    val paineis = configurarPaineisDocumento(maxWidth.value.toInt(), mostrandoLixeira)
                    val painelLateral = paineis.pastas
                    val painelDetalhe = paineis.detalhe
                    val colunas = GridCells.Fixed(paineis.colunas)
                    val documentosNaPasta = if (mostrandoLixeira) lixeira else if (pastaAtivaId == null) documentos else documentos.filter { it.pastaId == pastaAtivaId }
                    val documentoDetalhe = documentosNaPasta.find { it.id == documentoDetalheId }
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
                                } else Box(Modifier.border(if (painelDetalhe && doc.id == documentoDetalheId) 2.dp else 0.dp,
                                    if (painelDetalhe && doc.id == documentoDetalheId) AthenesPrimary else Color.Transparent,
                                    RoundedCornerShape(12.dp))) {
                                    AthenesCard(
                                        documento = doc,
                                        onAbrirClick = { if (painelDetalhe) documentoDetalheId = doc.id else onAbrirDocumento(doc) },
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
                    if (painelDetalhe) {
                        Spacer(Modifier.width(16.dp))
                        PainelDetalheDocumento(
                            documento = documentoDetalhe,
                            onAbrir = { documentoDetalhe?.let(onAbrirDocumento) },
                            onMover = { documentoDetalhe?.let { documentoParaMover = it } },
                            onRenomear = { documentoDetalhe?.let(viewModel::solicitarRenomear) }
                        )
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
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .background(Color.White, RoundedCornerShape(10.dp))
                            .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(10.dp))
                            .padding(start = 12.dp, end = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Search,
                            contentDescription = null,
                            tint = AthenesTextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.weight(1f)) {
                            if (textoBuscaArtigos.isEmpty()) {
                                Text(
                                    text = "Pesquisar por título, autor, chave Zotero ou DOI...",
                                    fontSize = 12.5.sp,
                                    color = AthenesTextMuted
                                )
                            }
                            androidx.compose.foundation.text.BasicTextField(
                                value = textoBuscaArtigos,
                                onValueChange = viewModel::setTextoBuscaArtigos,
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontSize = 12.5.sp,
                                    color = AthenesTextDark,
                                    fontWeight = FontWeight.Medium
                                ),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(AthenesPrimary),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        if (textoBuscaArtigos.isNotEmpty()) {
                            IconButton(onClick = { viewModel.setTextoBuscaArtigos("") }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Rounded.Clear, contentDescription = "Limpar busca", tint = AthenesTextMuted, modifier = Modifier.size(16.dp))
                            }
                        }
                    }

                    // Badge de Status Conexão Zotero (Compactado em 38dp, alinhado à busca)
                    Surface(
                        color = Color(0xFFECFDF5),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                        modifier = Modifier.height(38.dp)
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

                Spacer(modifier = Modifier.height(10.dp))

                if (estadoZotero.isNotBlank()) {
                    Text(estadoZotero, style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // LINHA 1: Tipos de Obra Acadêmica (Pills Soft UI Athenes)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val filtrosTipo = listOf(
                        null to "Todos",
                        "journalArticle" to "Artigos",
                        "book" to "Livros",
                        "thesis" to "Teses",
                        "conferencePaper" to "Conferências",
                        "fichados" to "Fichados"
                    )
                    filtrosTipo.forEach { (tipo, nome) ->
                        AthenesPillFiltro(
                            rotulo = nome,
                            ativo = tipoZoteroFiltro == tipo,
                            onClick = { viewModel.filtrarTipoZotero(tipo) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // LINHA 2: Filtros de Ano, Ordenação e Coleções
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AthenesPillFiltro(
                        rotulo = "Todos os anos",
                        ativo = anoMinimo == null,
                        onClick = { viewModel.filtrarAnoMinimo(null) }
                    )
                    AthenesPillFiltro(
                        rotulo = "Desde 2020",
                        ativo = anoMinimo == 2020,
                        onClick = { viewModel.filtrarAnoMinimo(2020) }
                    )
                    AthenesPillFiltro(
                        rotulo = "Recentes",
                        ativo = ordemZotero == "recentes",
                        onClick = { viewModel.ordenarZotero("recentes") }
                    )
                    AthenesPillFiltro(
                        rotulo = "Título",
                        ativo = ordemZotero == "titulo",
                        onClick = { viewModel.ordenarZotero("titulo") }
                    )

                    if (colecoesZotero.isNotEmpty()) {
                        val colecaoAtiva = colecoesEmArvore.find { it.colecao.chave == colecaoZoteroFiltro }
                        AthenesPillFiltro(
                            rotulo = colecaoAtiva?.caminho ?: "Todas as coleções",
                            ativo = colecaoZoteroFiltro != null,
                            icone = Icons.Rounded.Folder,
                            onClick = { mostrarColecoes = true }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

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
                                    },
                                    onEditarLocal = if (art.id.startsWith("local_")) ({
                                        pdfNovoArtigoUri = null
                                        pdfNovoArtigoNome = null
                                        artigoLocalParaEditarId = art.id
                                    }) else null,
                                    onExcluirLocal = if (art.id.startsWith("local_")) ({ artigoLocalParaExcluir = art }) else null
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Diálogos Modais Contextuais
    if (novoArtigoAberto || artigoLocalParaEditar != null) {
        DialogNovoArtigoLocal(
            onFechar = { novoArtigoAberto = false; artigoLocalParaEditarId = null },
            artigoInicial = artigoLocalParaEditar,
            referencias = acervoCompleto.filter { it.chaveZotero.isNotBlank() && !it.id.startsWith("local_") },
            pdfNome = pdfNovoArtigoNome,
            onSelecionarPdf = { escolherPdfNovoArtigo.launch(arrayOf("application/pdf")) },
            onCriar = { titulo, autores, ano, publicacao, resumo, chaveZotero ->
                if (artigoLocalParaEditar != null) {
                    viewModel.atualizarArtigoLocal(artigoLocalParaEditar.id, titulo, autores, ano, publicacao, resumo, chaveZotero)
                    pdfNovoArtigoUri?.let { uri ->
                        context.getSharedPreferences("pdf_artigos", 0).edit().putString(artigoLocalParaEditar.id, uri).apply()
                    }
                } else {
                    val artigo = viewModel.criarArtigoLocal(titulo, autores, ano, publicacao, resumo, chaveZotero)
                    pdfNovoArtigoUri?.let { uri ->
                        context.getSharedPreferences("pdf_artigos", 0).edit().putString(artigo.id, uri).apply()
                    }
                    onAbrirLeitorPdf(artigo.id)
                }
                novoArtigoAberto = false
                artigoLocalParaEditarId = null
            }
        )
    }
    artigoLocalParaExcluir?.let { artigo ->
        AlertDialog(
            onDismissRequest = { artigoLocalParaExcluir = null },
            title = { Text("Excluir artigo local?") },
            text = { Text("O registro, o vínculo do PDF e as anotações de \"${artigo.titulo}\" serão removidos deste aparelho. O arquivo PDF original não será apagado.") },
            confirmButton = { TextButton(onClick = {
                viewModel.excluirArtigoLocal(artigo.id)
                artigoLocalParaExcluir = null
            }) { Text("Excluir") } },
            dismissButton = { TextButton(onClick = { artigoLocalParaExcluir = null }) { Text("Cancelar") } }
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

data class ConfiguracaoPaineisDocumento(val pastas: Boolean, val detalhe: Boolean, val colunas: Int)

fun configurarPaineisDocumento(larguraDp: Int, lixeira: Boolean): ConfiguracaoPaineisDocumento {
    val pastas = larguraDp >= 1150
    val detalhe = larguraDp >= 700 && !lixeira
    val larguraLista = larguraDp - (if (pastas) 236 else 0) - (if (detalhe) 316 else 0)
    val colunas = when {
        larguraLista >= 900 -> 3
        larguraLista >= 600 -> 2
        else -> 1
    }
    return ConfiguracaoPaineisDocumento(pastas, detalhe, colunas)
}

@Composable
fun PainelDetalheDocumento(
    documento: Documento?,
    onAbrir: () -> Unit,
    onMover: () -> Unit,
    onRenomear: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.width(300.dp).fillMaxHeight(),
        color = Color.White,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0))
    ) {
        if (documento == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFF8FAFC),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        modifier = Modifier.size(54.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Rounded.Description,
                                contentDescription = null,
                                tint = AthenesTextMuted,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = "Nenhum documento selecionado",
                        style = TextStyle(
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF475569)
                        ),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Selecione um documento da lista para ver os detalhes, resumo e ações.",
                        style = TextStyle(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal,
                            color = AthenesTextMuted,
                            lineHeight = 16.sp
                        ),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = documento.titulo,
                    style = TextStyle(
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark
                    ),
                    modifier = Modifier.semantics { heading() }
                )
                if (documento.subtitulo.isNotBlank()) {
                    Text(
                        text = documento.subtitulo,
                        style = TextStyle(
                            fontSize = 13.sp,
                            color = AthenesTextMuted
                        )
                    )
                }
                HorizontalDivider(color = Color(0xFFE2E8F0))
                Text(
                    text = "Tipo: ${documento.tipo.rotuloAmigavel}",
                    fontSize = 12.sp,
                    color = Color(0xFF334155)
                )
                Text(
                    text = "Situação: ${documento.situacao.name.lowercase().replaceFirstChar { it.uppercase() }}",
                    fontSize = 12.sp,
                    color = Color(0xFF334155)
                )
                Text(
                    text = "Autor: ${documento.autor}",
                    fontSize = 12.sp,
                    color = Color(0xFF334155)
                )
                Text(
                    text = "Alterado em: ${documento.modificadoEm}",
                    fontSize = 12.sp,
                    color = Color(0xFF334155)
                )
                if (documento.resumo.isNotBlank()) {
                    HorizontalDivider(color = Color(0xFFE2E8F0))
                    Text(
                        text = "Resumo",
                        style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = AthenesTextDark),
                        modifier = Modifier.semantics { heading() }
                    )
                    Text(
                        text = documento.resumo,
                        style = TextStyle(fontSize = 12.sp, color = AthenesTextMuted, lineHeight = 16.sp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Button(
                    onClick = onAbrir,
                    modifier = Modifier.fillMaxWidth().height(38.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = AthenesPrimary, contentColor = Color.White),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.AutoMirrored.Rounded.Article, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Abrir documento", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
                OutlinedButton(
                    onClick = onMover,
                    modifier = Modifier.fillMaxWidth().height(38.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AthenesPrimary),
                    border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.AutoMirrored.Rounded.DriveFileMove, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Mover para…", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
                OutlinedButton(
                    onClick = onRenomear,
                    modifier = Modifier.fillMaxWidth().height(38.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AthenesTextDark),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.Rounded.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Renomear", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
fun DialogNovoArtigoLocal(
    onFechar: () -> Unit,
    artigoInicial: ArtigoEstudoDetalhado? = null,
    referencias: List<ArtigoEstudoDetalhado> = emptyList(),
    pdfNome: String? = null,
    onSelecionarPdf: () -> Unit = {},
    onCriar: (String, String, Int, String, String, String) -> Unit
) {
    var titulo by rememberSaveable(artigoInicial?.id) { mutableStateOf(artigoInicial?.titulo.orEmpty()) }
    var autores by rememberSaveable(artigoInicial?.id) { mutableStateOf(artigoInicial?.autores.orEmpty()) }
    var ano by rememberSaveable(artigoInicial?.id) { mutableStateOf(artigoInicial?.ano?.toString() ?: java.time.Year.now().value.toString()) }
    var publicacao by rememberSaveable(artigoInicial?.id) { mutableStateOf(artigoInicial?.camposZotero?.get("publicationTitle").orEmpty()) }
    var resumo by rememberSaveable(artigoInicial?.id) { mutableStateOf(artigoInicial?.resumoOficial.orEmpty()) }
    var chaveZotero by rememberSaveable(artigoInicial?.id) { mutableStateOf(artigoInicial?.chaveZotero.orEmpty()) }
    var escolhendoReferencia by remember { mutableStateOf(false) }
    var buscaReferencia by remember { mutableStateOf("") }
    val anoValor = ano.toIntOrNull()
    AlertDialog(
        onDismissRequest = { if (escolhendoReferencia) escolhendoReferencia = false else onFechar() },
        title = { Text(if (escolhendoReferencia) "Escolher referência Zotero" else if (artigoInicial != null) "Editar artigo" else "Novo artigo") },
        text = {
            if (escolhendoReferencia) {
                Column {
                    OutlinedTextField(buscaReferencia, { buscaReferencia = it }, label = { Text("Buscar referência") },
                        singleLine = true, modifier = Modifier.fillMaxWidth())
                    val filtradas = referencias.filter { buscaReferencia.isBlank() ||
                        it.titulo.contains(buscaReferencia, ignoreCase = true) || it.autores.contains(buscaReferencia, ignoreCase = true) }
                    LazyColumn(Modifier.fillMaxWidth().heightIn(max = 320.dp)) {
                        items(filtradas, key = { it.id }) { ref ->
                            TextButton(onClick = {
                                titulo = ref.titulo
                                autores = ref.autores
                                if (ref.ano in 1500..2100) ano = ref.ano.toString()
                                publicacao = ref.camposZotero["publicationTitle"].orEmpty()
                                resumo = ref.resumoOficial
                                chaveZotero = ref.chaveZotero
                                escolhendoReferencia = false
                            }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                Text("${ref.titulo} · ${ref.ano}", modifier = Modifier.fillMaxWidth())
                            }
                        }
                    }
                }
            } else {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (artigoInicial == null) "Crie um registro local. Você pode vincular um PDF agora ou no estúdio."
                    else "Atualize os dados do artigo. O PDF e as anotações permanecem vinculados.", style = MaterialTheme.typography.bodySmall)
                if (referencias.isNotEmpty()) TextButton(onClick = { escolhendoReferencia = true }) {
                    Text(if (chaveZotero.isBlank()) "Usar referência Zotero" else "Referência Zotero vinculada")
                }
                OutlinedTextField(titulo, { titulo = it }, label = { Text("Título") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(autores, { autores = it }, label = { Text("Autores") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(ano, { ano = it.filter(Char::isDigit).take(4) }, label = { Text("Ano") }, singleLine = true, modifier = Modifier.fillMaxWidth(), isError = anoValor == null || anoValor !in 1500..2100)
                OutlinedTextField(publicacao, { publicacao = it }, label = { Text("Publicação") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(resumo, { resumo = it }, label = { Text("Resumo") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                OutlinedButton(
                    onClick = onSelecionarPdf,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth().height(38.dp),
                    border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.Rounded.PictureAsPdf, contentDescription = null, modifier = Modifier.size(16.dp), tint = AthenesPrimary)
                    Spacer(Modifier.width(6.dp))
                    Text(pdfNome ?: "Selecionar PDF", fontSize = 13.sp, color = AthenesTextDark)
                }
            }
            }
        },
        confirmButton = {
            if (!escolhendoReferencia) TextButton(onClick = { onCriar(titulo.trim(), autores.trim(), anoValor!!, publicacao.trim(), resumo.trim(), chaveZotero) },
                enabled = titulo.isNotBlank() && anoValor != null && anoValor in 1500..2100) {
                Text(if (artigoInicial == null) "Adicionar e abrir" else "Salvar alterações")
            }
        },
        dismissButton = { TextButton(onClick = { if (escolhendoReferencia) escolhendoReferencia = false else onFechar() }) {
            Text(if (escolhendoReferencia) "Voltar" else "Cancelar")
        } }
    )
}


