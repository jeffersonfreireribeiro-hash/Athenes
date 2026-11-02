package com.athenes

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.athenes.core.data.DocumentoRepository
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
        setContent {
            AthenesTheme {
                var telaAtual by remember { mutableStateOf(AppTela.BIBLIOTECA) }
                var documentoSelecionado by remember { mutableStateOf<Documento?>(null) }
                var artigoSelecionadoId by remember { mutableStateOf("art_radino_2020") }
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
                        BibliotecaScreen(
                            viewModel = viewModel,
                            updateInfo = appUpdateInfo,
                            onOpenUpdateDialog = { showUpdateDialog = true },
                            onAbrirDocumento = { doc ->
                                documentoSelecionado = doc
                                telaAtual = AppTela.EDITOR_DOCUMENTO
                            },
                            onAbrirLeitorPdf = { artId ->
                                if (artId.isNotBlank()) {
                                    artigoSelecionadoId = artId
                                }
                                telaAtual = AppTela.LEITURA_ESTUDO
                            }
                        )
                    }

                    AppTela.EDITOR_DOCUMENTO -> {
                        EditorDocumentoScreen(
                            documentoInicial = documentoSelecionado,
                            onVoltarBiblioteca = {
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
