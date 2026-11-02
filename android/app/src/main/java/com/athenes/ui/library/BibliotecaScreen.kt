package com.athenes.ui.library

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.Documento
import com.athenes.ui.components.AthenesCard
import com.athenes.ui.components.AthenesSearchBar
import com.athenes.ui.components.AthenesTopBar
import com.athenes.ui.components.DialogConfirmarExclusao
import com.athenes.ui.components.DialogNovoDocumento
import com.athenes.ui.components.DialogRenomear
import com.athenes.ui.theme.AthenesBg
import com.athenes.ui.theme.AthenesText
import com.athenes.ui.theme.AthenesTextMuted

@Composable
fun BibliotecaScreen(
    viewModel: BibliotecaViewModel,
    onAbrirDocumento: (Documento) -> Unit,
    onAbrirLeitorPdf: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var modoAtivo by remember { mutableIntStateOf(0) } // 0 = Escrita & Documentos, 1 = Leitura & Zotero

    val textoBusca by viewModel.textoBusca.collectAsState()
    val tipoFiltro by viewModel.tipoFiltro.collectAsState()
    val documentos by viewModel.documentosFiltrados.collectAsState()

    val dialogNovoAberto by viewModel.dialogNovoAberto.collectAsState()
    val docParaExcluir by viewModel.docParaExcluir.collectAsState()
    val docParaRenomear by viewModel.docParaRenomear.collectAsState()

    Scaffold(
        topBar = {
            AthenesTopBar(
                modoAtivo = modoAtivo,
                onModoAlterado = { novoModo ->
                    modoAtivo = novoModo
                    if (novoModo == 1) {
                        onAbrirLeitorPdf("")
                    }
                },
                onMenuClick = { /* Abertura de gaveta futura */ }
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
            Spacer(modifier = Modifier.height(14.dp))

            // Cabeçalho da Seção (Idêntico ao Web e ao Mockup)
            Text(
                text = if (modoAtivo == 0) "Meus Documentos e Artigos" else "Biblioteca de Leitura, PDF & Zotero",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 21.sp,
                    color = AthenesText
                )
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = if (modoAtivo == 0) {
                    "Ambiente de escrita e diagramação acadêmica em blocos com revisão Google Docs em tempo real"
                } else {
                    "Fichamento de artigos científicos, leitura de PDFs com caneta e sincronização com o Zotero"
                },
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 12.sp,
                    color = AthenesTextMuted
                )
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Barra de Pesquisa + Filtros de Tipo + Botão Novo Documento
            AthenesSearchBar(
                textoBusca = textoBusca,
                onBuscaAlterada = viewModel::setTextoBusca,
                tipoFiltro = tipoFiltro,
                onTipoFiltroAlterado = viewModel::setTipoFiltro,
                onNovoDocumentoClick = viewModel::abrirDialogNovo
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Grade Adaptativa Responsiva: 2 a 3 colunas em Tablets; 1 coluna em Celulares
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val larguraDisponivel = maxWidth
                val colunas = if (larguraDisponivel >= 900.dp) {
                    GridCells.Fixed(3)
                } else if (larguraDisponivel >= 600.dp) {
                    GridCells.Fixed(2)
                } else {
                    GridCells.Fixed(1)
                }

                if (documentos.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 40.dp),
                        contentAlignment = Alignment.TopCenter
                    ) {
                        Text(
                            text = if (textoBusca.isNotBlank()) "Nenhum documento encontrado para \"$textoBusca\"" else "Nenhum documento cadastrado.",
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
                        items(documentos, key = { it.id }) { doc ->
                            AthenesCard(
                                documento = doc,
                                onAbrirClick = {
                                    if (modoAtivo == 1) {
                                        onAbrirLeitorPdf(doc.id)
                                    } else {
                                        onAbrirDocumento(doc)
                                    }
                                },
                                onDuplicarClick = { viewModel.duplicarDocumento(doc.id) },
                                onRenomearClick = { viewModel.solicitarRenomear(doc) },
                                onExcluirClick = { viewModel.solicitarExclusao(doc) }
                            )
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
            onConfirmar = viewModel::criarNovoDocumento
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
}
