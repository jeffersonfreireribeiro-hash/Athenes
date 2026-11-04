package com.athenes

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.athenes.core.updater.AppUpdateInfo
import com.athenes.core.updater.AppUpdater
import com.athenes.ui.editor.EditorDocumentoScreen
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
    DOCUMENTOS("Documentos"), BIBLIOTECA("Biblioteca"), ESTUDO("Estudo"), CONTA("Conta")
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
                var appUpdateInfo by remember { mutableStateOf<AppUpdateInfo?>(null) }
                var showUpdateDialog by remember { mutableStateOf(false) }
                val scope = rememberCoroutineScope()

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
                            if (largura != WindowWidthSizeClass.Compact) {
                                NavigationRail {
                                    DestinoPrincipal.entries.forEach { item ->
                                        NavigationRailItem(
                                            selected = destino == item,
                                            onClick = { destino = item },
                                            icon = { Icon(iconeDestino(item), contentDescription = item.rotulo) },
                                            label = { Text(item.rotulo) }
                                        )
                                    }
                                }
                            }
                            Scaffold(
                                modifier = Modifier.weight(1f),
                                bottomBar = {
                                    if (largura == WindowWidthSizeClass.Compact) {
                                        NavigationBar {
                                            DestinoPrincipal.entries.forEach { item ->
                                                NavigationBarItem(
                                                    selected = destino == item,
                                                    onClick = { destino = item },
                                                    icon = { Icon(iconeDestino(item), contentDescription = item.rotulo) },
                                                    label = { Text(item.rotulo) }
                                                )
                                            }
                                        }
                                    }
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
                                    DestinoPrincipal.ESTUDO -> EstudoArtigosScreen(
                                        artigoIdInicial = artigoSelecionadoId,
                                        updateInfo = appUpdateInfo,
                                        onOpenUpdateDialog = { showUpdateDialog = true },
                                        onCheckUpdateManual = { scope.launch { checkAppUpdate(forced = true) } },
                                        onVoltarBiblioteca = { destino = DestinoPrincipal.BIBLIOTECA },
                                        modifier = Modifier.padding(padding)
                                    )
                                    DestinoPrincipal.CONTA -> ContaScreen(Modifier.padding(padding))
                                }
                            }
                        }
                    }

                    AppTela.EDITOR_DOCUMENTO -> {
                        EditorDocumentoScreen(
                            documentoInicial = repository.documentos.value.find { it.id == documentoSelecionadoId },
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
                            }
                        )
                    }
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

private fun iconeDestino(destino: DestinoPrincipal): ImageVector = when (destino) {
    DestinoPrincipal.DOCUMENTOS -> Icons.Rounded.Description
    DestinoPrincipal.BIBLIOTECA -> Icons.Rounded.MenuBook
    DestinoPrincipal.ESTUDO -> Icons.Rounded.Draw
    DestinoPrincipal.CONTA -> Icons.Rounded.Person
}

@Composable
private fun ContaScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val credenciais = remember(context) { ZoteroCredentialsStore(context) }
    var chaveGuardada by remember { mutableStateOf(credenciais.carregar() != null) }
    Column(modifier = modifier.fillMaxSize().padding(24.dp)) {
        Text("Conta", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(16.dp))
        Text("Zotero", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Text(if (chaveGuardada) "Chave protegida neste aparelho." else "Nenhuma chave do Zotero guardada.")
        Spacer(Modifier.height(8.dp))
        Text("Abra Biblioteca → Sincronizar Zotero para configurar ou atualizar a chave.")
        if (chaveGuardada) {
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { credenciais.remover(); chaveGuardada = false }) { Text("Remover chave deste aparelho") }
        }
        Spacer(Modifier.height(24.dp))
        Text("Google Drive e perfil", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Text("A conexão com a conta e o Drive ainda não está disponível no APK.")
    }
}
