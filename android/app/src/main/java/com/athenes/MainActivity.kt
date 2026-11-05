package com.athenes

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.athenes.core.data.DocumentoRepository
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.data.ZoteroCredentialsStore
import com.athenes.core.model.Documento
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.CitacaoMarcada
import com.athenes.core.updater.AppUpdateInfo
import com.athenes.core.updater.AppUpdater
import com.athenes.ui.editor.EditorDocumentoScreen
import com.athenes.ui.components.NavegacaoPrincipal
import com.athenes.ui.library.BibliotecaScreen
import com.athenes.ui.library.BibliotecaViewModel
import com.athenes.ui.reader.EstudoArtigosScreen
import com.athenes.ui.theme.AthenesTheme
import com.athenes.ui.updater.UpdateDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppTela {
    BIBLIOTECA,
    EDITOR_DOCUMENTO,
    LEITURA_ESTUDO
}

enum class DestinoPrincipal(val rotulo: String) {
    DOCUMENTOS("Documentos"), BIBLIOTECA("Biblioteca")
}

@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
class MainActivity : ComponentActivity() {

    private val repository by lazy { DocumentoRepository(applicationContext) }

    private val viewModel: BibliotecaViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return BibliotecaViewModel(repository) as T
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ArtigoEstudoRepository.compartilhado.ativarPersistencia(applicationContext)
        setContent {
            AthenesTheme {
                var telaAtual by rememberSaveable { mutableStateOf(AppTela.BIBLIOTECA) }
                var destino by rememberSaveable { mutableStateOf(DestinoPrincipal.DOCUMENTOS) }
                var documentoSelecionadoId by rememberSaveable { mutableStateOf<String?>(null) }
                var artigoSelecionadoId by rememberSaveable { mutableStateOf("art_radino_2020") }
                var citacaoPendenteArtigoId by rememberSaveable { mutableStateOf<String?>(null) }
                var citacaoPendenteId by rememberSaveable { mutableStateOf<String?>(null) }
                var escolherDocumentoCitacao by rememberSaveable { mutableStateOf(false) }
                val documentosAtuais by repository.documentos.collectAsState()
                var appUpdateInfo by remember { mutableStateOf<AppUpdateInfo?>(null) }
                var showUpdateDialog by remember { mutableStateOf(false) }
                val scope = rememberCoroutineScope()

                fun solicitarDocumentoParaCitacao(artigo: ArtigoEstudoDetalhado, citacao: CitacaoMarcada) {
                    citacaoPendenteArtigoId = artigo.id
                    citacaoPendenteId = citacao.id
                    escolherDocumentoCitacao = true
                }

                suspend fun checkAppUpdate(forced: Boolean = false) {
                    try {
                        val info = withContext(Dispatchers.IO) { AppUpdater.checkUpdate() }
                        appUpdateInfo = info
                        if (forced) {
                            if (info.temNovaVersao) {
                                showUpdateDialog = true
                            } else {
                                val msg = if (info.disponivel) {
                                    "Você já está na versão mais recente (v${BuildConfig.VERSION_NAME})."
                                } else {
                                    info.mensagemErro ?: "Nenhuma atualização disponível no momento."
                                }
                                Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (e: Exception) {
                        if (forced) {
                            Toast.makeText(
                                this@MainActivity,
                                "Não foi possível verificar atualizações: ${e.localizedMessage ?: "sem conexão"}",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }

                // Verificação automática e silenciosa em segundo plano ao abrir o app (padrão Glaux GIS)
                LaunchedEffect(Unit) {
                    checkAppUpdate(forced = false)
                }

                when (telaAtual) {
                    AppTela.BIBLIOTECA -> {
                        val largura = calculateWindowSizeClass(this@MainActivity).widthSizeClass
                        Row(Modifier.fillMaxSize()) {
                            if (largura != WindowWidthSizeClass.Compact)
                                NavegacaoPrincipal(destino, compacta = false, onDestino = { destino = it })
                            Scaffold(
                                modifier = Modifier.weight(1f),
                                bottomBar = {
                                    if (largura == WindowWidthSizeClass.Compact)
                                        NavegacaoPrincipal(destino, compacta = true, onDestino = { destino = it })
                                }
                            ) { padding ->
                                when (destino) {
                                    DestinoPrincipal.DOCUMENTOS, DestinoPrincipal.BIBLIOTECA -> BibliotecaScreen(
                                        viewModel = viewModel,
                                        modoAtivo = if (destino == DestinoPrincipal.DOCUMENTOS) 0 else 1,
                                        onModoAlterado = { destino = if (it == 0) DestinoPrincipal.DOCUMENTOS else DestinoPrincipal.BIBLIOTECA },
                                        updateInfo = appUpdateInfo,
                                        onOpenUpdateDialog = { showUpdateDialog = true },
                                        onAbrirDocumento = { doc ->
                                            documentoSelecionadoId = doc.id
                                            telaAtual = AppTela.EDITOR_DOCUMENTO
                                        },
                                        onAbrirLeitorPdf = { artId ->
                                            if (artId.isNotBlank()) artigoSelecionadoId = artId
                                            telaAtual = AppTela.LEITURA_ESTUDO
                                        },
                                        modifier = Modifier.padding(padding)
                                    )
                                }
                            }
                        }
                    }

                    AppTela.EDITOR_DOCUMENTO -> {
                        EditorDocumentoScreen(
                            documentoInicial = repository.documentos.value.find { it.id == documentoSelecionadoId },
                            citacaoPendenteArtigoId = citacaoPendenteArtigoId,
                            citacaoPendenteId = citacaoPendenteId,
                            onCitacaoPendenteInserida = { citacaoPendenteArtigoId = null; citacaoPendenteId = null },
                            onVoltarBiblioteca = {
                                destino = DestinoPrincipal.DOCUMENTOS
                                telaAtual = AppTela.BIBLIOTECA
                            }
                        )
                    }

                    AppTela.LEITURA_ESTUDO -> {
                        EstudoArtigosScreen(
                            artigoIdInicial = artigoSelecionadoId,
                            updateInfo = appUpdateInfo,
                            onOpenUpdateDialog = { showUpdateDialog = true },
                            onCheckUpdateManual = { scope.launch { checkAppUpdate(forced = true) } },
                            onVoltarBiblioteca = {
                                destino = DestinoPrincipal.BIBLIOTECA
                                telaAtual = AppTela.BIBLIOTECA
                            },
                            onCitarNoDocumento = ::solicitarDocumentoParaCitacao
                        )
                    }
                }

                if (escolherDocumentoCitacao) {
                    AlertDialog(
                        onDismissRequest = { escolherDocumentoCitacao = false; citacaoPendenteId = null; citacaoPendenteArtigoId = null },
                        title = { Text("Inserir citação em documento") },
                        text = {
                            Column(Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState())) {
                                documentosAtuais.forEach { doc ->
                                    TextButton(onClick = {
                                        documentoSelecionadoId = doc.id
                                        escolherDocumentoCitacao = false
                                        telaAtual = AppTela.EDITOR_DOCUMENTO
                                    }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                        Text(doc.titulo, modifier = Modifier.fillMaxWidth())
                                    }
                                }
                                if (documentosAtuais.isEmpty()) Text("Nenhum documento disponível.")
                            }
                        },
                        confirmButton = {
                            TextButton(onClick = {
                                documentoSelecionadoId = repository.adicionarDocumento("Novo documento").id
                                escolherDocumentoCitacao = false
                                telaAtual = AppTela.EDITOR_DOCUMENTO
                            }) { Text("Novo documento") }
                        },
                        dismissButton = {
                            TextButton(onClick = {
                                escolherDocumentoCitacao = false
                                citacaoPendenteId = null
                                citacaoPendenteArtigoId = null
                            }) { Text("Cancelar") }
                        }
                    )
                }

                // Diálogo de Atualização do Aplicativo (Modal com barra de progresso em tempo real)
                if (showUpdateDialog && appUpdateInfo != null) {
                    UpdateDialog(
                        updateInfo = appUpdateInfo!!,
                        onClose = { showUpdateDialog = false }
                    )
                }
            }
        }
    }
}
