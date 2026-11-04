package com.athenes.ui.library

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.athenes.core.updater.AppUpdateInfo
import com.athenes.ui.components.*
import com.athenes.ui.theme.*
import com.athenes.ui.updater.UpdateBanner

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
    var updateBannerDismissed by remember { mutableStateOf(false) }

    // Estados da Aba 1 (Escrita)
    val textoBusca by viewModel.textoBusca.collectAsState()
    val tipoFiltro by viewModel.tipoFiltro.collectAsState()
    val documentos by viewModel.documentosFiltrados.collectAsState()
    val pastas by viewModel.pastas.collectAsState()
    var pastaAtivaId by rememberSaveable { mutableStateOf<String?>(null) }
    var criarPastaAberto by remember { mutableStateOf(false) }
    var nomeNovaPasta by remember { mutableStateOf("") }
    var renomearPastaAberto by remember { mutableStateOf(false) }
    var excluirPastaAberto by remember { mutableStateOf(false) }
    var nomePastaEditada by remember { mutableStateOf("") }
    var documentoParaMover by remember { mutableStateOf<Documento?>(null) }

    // Estados da Aba 2 (Artigos / Zotero)
    val textoBuscaArtigos by viewModel.textoBuscaArtigos.collectAsState()
    val artigos by viewModel.artigosFiltrados.collectAsState()
    val estadoZotero by viewModel.estadoZotero.collectAsState()
    val sincronizandoZotero by viewModel.sincronizandoZotero.collectAsState()
    val conectadoZotero by viewModel.conectadoZotero.collectAsState()
    val colecoesZotero by viewModel.colecoesZotero.collectAsState()
    val tipoZoteroFiltro by viewModel.tipoZoteroFiltro.collectAsState()
    val colecaoZoteroFiltro by viewModel.colecaoZoteroFiltro.collectAsState()
    val anoMinimo by viewModel.anoMinimo.collectAsState()
    val ordemZotero by viewModel.ordemZotero.collectAsState()
    var mostrarConexaoZotero by remember { mutableStateOf(false) }
    var chaveZotero by remember { mutableStateOf("") }
    var usuarioZotero by remember { mutableStateOf("") }

    val dialogNovoAberto by viewModel.dialogNovoAberto.collectAsState()
    val docParaExcluir by viewModel.docParaExcluir.collectAsState()
    val docParaRenomear by viewModel.docParaRenomear.collectAsState()

    Scaffold(
        topBar = {
            AthenesTopBar(
                modoAtivo = modoAtivo,
                onModoAlterado = onModoAlterado,
                onMenuClick = { /* Abertura de gaveta lateral */ }
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (modoAtivo == 0) "Meus documentos" else "Biblioteca e fichamentos",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 19.sp,
                            color = AthenesText
                        )
                    )
                }

                // Botões de Ação Específicos para a Aba de Artigos / Zotero (Idênticos ao Web)
                if (modoAtivo == 1) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        OutlinedButton(
                            onClick = { mostrarConexaoZotero = true },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                            modifier = Modifier.height(44.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = AthenesPrimary)
                        ) {
                            Icon(Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = if (sincronizandoZotero) "Sincronizando…" else "Sincronizar Zotero", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = {
                                Toast.makeText(context, "A importação de artigos ainda não está disponível.", Toast.LENGTH_SHORT).show()
                            },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(44.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AthenesPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(text = "Novo Artigo", fontSize = 11.sp, fontWeight = FontWeight.Bold)
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

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(selected = pastaAtivaId == null, onClick = { pastaAtivaId = null }, label = { Text("Todos (${documentos.size})") })
                    pastas.forEach { pasta ->
                        val pai = pastas.find { it.id == pasta.pastaPaiId }
                        FilterChip(
                            selected = pastaAtivaId == pasta.id,
                            onClick = { pastaAtivaId = pasta.id },
                            label = {
                                val nome = if (pai == null) pasta.nome else "${pai.nome} / ${pasta.nome}"
                                Text("$nome (${documentos.count { it.pastaId == pasta.id }})")
                            }
                        )
                    }
                    OutlinedButton(onClick = { nomeNovaPasta = ""; criarPastaAberto = true }) { Text("Nova pasta") }
                    if (pastaAtivaId != null) {
                        TextButton(onClick = {
                            nomePastaEditada = pastas.find { it.id == pastaAtivaId }?.nome.orEmpty()
                            renomearPastaAberto = true
                        }) { Text("Renomear") }
                        TextButton(onClick = { excluirPastaAberto = true }) { Text("Excluir pasta") }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                    val colunas = if (maxWidth >= 900.dp) GridCells.Fixed(3) else if (maxWidth >= 600.dp) GridCells.Fixed(2) else GridCells.Fixed(1)
                    val documentosNaPasta = if (pastaAtivaId == null) documentos else documentos.filter { it.pastaId == pastaAtivaId }

                    if (documentosNaPasta.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(top = 40.dp),
                            contentAlignment = Alignment.TopCenter
                        ) {
                            Text(
                                text = if (textoBusca.isNotBlank()) "Nenhum documento encontrado para \"$textoBusca\"" else "Nenhum documento nesta pasta.",
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
                                AthenesCard(
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
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(selected = colecaoZoteroFiltro == null, onClick = { viewModel.filtrarColecaoZotero(null) }, label = { Text("Todas as coleções") })
                        colecoesZotero.forEach { colecao ->
                            FilterChip(
                                selected = colecaoZoteroFiltro == colecao.chave,
                                onClick = { viewModel.filtrarColecaoZotero(colecao.chave) },
                                label = { Text(colecao.nome) }
                            )
                        }
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
                    Text("Informe sua chave do Zotero. O ID é opcional; o aplicativo pode descobri-lo pela chave.")
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
                    viewModel.sincronizarZotero(chaveZotero, usuarioZotero)
                    chaveZotero = ""
                    mostrarConexaoZotero = false
                }, enabled = chaveZotero.isNotBlank()) { Text("Sincronizar") }
            },
            dismissButton = { TextButton(onClick = { mostrarConexaoZotero = false }) { Text("Cancelar") } }
        )
    }
}
