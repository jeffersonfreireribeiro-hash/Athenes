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
import com.athenes.ui.library.BibliotecaScreen
import com.athenes.ui.library.BibliotecaViewModel
import com.athenes.ui.reader.EstudoArtigosScreen
import com.athenes.ui.theme.AthenesTheme

enum class AppTela {
    BIBLIOTECA,
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

                when (telaAtual) {
                    AppTela.BIBLIOTECA -> {
                        BibliotecaScreen(
                            viewModel = viewModel,
                            onAbrirDocumento = { doc ->
                                if (doc.titulo.contains("Fichamento", ignoreCase = true) ||
                                    doc.titulo.contains("Acoustic", ignoreCase = true)
                                ) {
                                    telaAtual = AppTela.LEITURA_ESTUDO
                                } else {
                                    Toast.makeText(
                                        this,
                                        "Abrindo documento: ${doc.titulo}",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                            },
                            onAbrirLeitorPdf = { _ ->
                                telaAtual = AppTela.LEITURA_ESTUDO
                            }
                        )
                    }
                    AppTela.LEITURA_ESTUDO -> {
                        EstudoArtigosScreen(
                            onVoltarBiblioteca = {
                                telaAtual = AppTela.BIBLIOTECA
                            }
                        )
                    }
                }
            }
        }
    }
}
