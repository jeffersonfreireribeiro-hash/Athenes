package com.athenes.ui.editor.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ViewSidebar
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.TipoDocumento
import com.athenes.ui.editor.estilos.EstiloEditorial
import com.athenes.ui.theme.*

/**
 * Barra superior do editor: uma única linha de 52 dp (alvos de toque de 44 dp).
 * Voltar | título + estado de gravação | seletor de estilo | estrutura | inspetor | menu (modo, tipo, salvar).
 * Some ao rolar para baixo (modo foco) — ver EditorDocumentoScreen.
 */
@Composable
fun EditorTopBar(
    titulo: String,
    tipoDocumento: TipoDocumento,
    modoRevisao: String,
    salvo: Boolean,
    painelEstruturaAberto: Boolean,
    painelInspetorAberto: Boolean,
    onAlternarEstrutura: () -> Unit,
    onAlternarInspetor: () -> Unit,
    onTipoAlterado: (TipoDocumento) -> Unit,
    onModoRevisaoAlterado: (String) -> Unit,
    onSalvar: () -> Unit,
    onExportarDocx: () -> Unit,
    onExportarPdf: () -> Unit,
    onExportarJson: () -> Unit,
    onConfigurarPagina: () -> Unit,
    onVoltar: () -> Unit,
    estilosDisponiveis: List<EstiloEditorial> = emptyList(),
    estiloAtivoId: String = "corpo",
    onSelecionarEstilo: (String) -> Unit = {},
    onCriarNovoEstilo: () -> Unit = {},
    onEditarEstilo: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var menuAberto by remember { mutableStateOf(false) }

    Surface(
        color = AthenesSurface,
        shadowElevation = 2.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(52.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onVoltar, modifier = Modifier.size(44.dp)) {
                Icon(Icons.Rounded.ChevronLeft, contentDescription = "Voltar", tint = AthenesPrimary, modifier = Modifier.size(28.dp))
            }

            Column(modifier = Modifier.weight(1f).padding(horizontal = 4.dp)) {
                Text(
                    text = titulo.ifBlank { "Documento sem título" },
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold, color = AthenesTextDark, fontSize = 14.sp
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (salvo) Icons.Rounded.CheckCircle else Icons.Rounded.Sync,
                        contentDescription = null,
                        tint = if (salvo) Color(0xFF059669) else AthenesTextMuted,
                        modifier = Modifier.size(11.dp)
                    )
                    Spacer(Modifier.width(3.dp))
                    Text(
                        text = (if (salvo) "Salvo no aparelho" else "Salvando…") + " · " + tipoDocumento.rotuloAmigavel,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.5.sp, color = AthenesTextMuted),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            if (estilosDisponiveis.isNotEmpty()) {
                SeletorEstiloTopo(
                    estilos = estilosDisponiveis,
                    estiloAtivoId = estiloAtivoId,
                    onSelecionarEstilo = onSelecionarEstilo,
                    onCriarNovoEstilo = onCriarNovoEstilo,
                    onEditarEstilo = onEditarEstilo,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }

            BotaoTopo(Icons.Rounded.Menu, "Estrutura e Mestras", painelEstruturaAberto, onAlternarEstrutura)
            BotaoTopo(Icons.AutoMirrored.Rounded.ViewSidebar, "Inspetor do Bloco", painelInspetorAberto, onAlternarInspetor)

            Box {
                IconButton(onClick = { menuAberto = true }, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.MoreVert, contentDescription = "Mais opções", tint = AthenesTextDark)
                }
                DropdownMenu(expanded = menuAberto, onDismissRequest = { menuAberto = false }) {
                    CabecalhoMenu("Modo de trabalho")
                    listOf(
                        Triple("edicao", "Edição", Icons.Rounded.Edit),
                        Triple("sugestao", "Sugestão", Icons.Rounded.ModeComment),
                        Triple("leitura", "Leitura", Icons.Rounded.Visibility)
                    ).forEach { (id, rotulo, icone) ->
                        ItemMenu(rotulo, icone, modoRevisao == id) { onModoRevisaoAlterado(id); menuAberto = false }
                    }
                    HorizontalDivider()
                    CabecalhoMenu("Tipo de documento")
                    TipoDocumento.entries.forEach { tipo ->
                        ItemMenu(tipo.rotuloAmigavel, Icons.Rounded.Description, tipo == tipoDocumento) {
                            onTipoAlterado(tipo); menuAberto = false
                        }
                    }
                    HorizontalDivider()
                    CabecalhoMenu("Página")
                    ItemMenu("Formato e margens", Icons.Rounded.CropPortrait, false) { onConfigurarPagina(); menuAberto = false }
                    HorizontalDivider()
                    CabecalhoMenu("Exportar")
                    ItemMenu("Word (.docx)", Icons.Rounded.Description, false) { onExportarDocx(); menuAberto = false }
                    ItemMenu("PDF (imprimir)", Icons.Rounded.PictureAsPdf, false) { onExportarPdf(); menuAberto = false }
                    ItemMenu("Documento JSON", Icons.Rounded.Description, false) { onExportarJson(); menuAberto = false }
                    HorizontalDivider()
                    ItemMenu("Salvar agora", Icons.Rounded.Save, false) { onSalvar(); menuAberto = false }
                }
            }
        }
    }
}

@Composable
private fun BotaoTopo(
    icone: ImageVector,
    descricao: String,
    ativo: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = if (ativo) AthenesPrimarySoft else Color.Transparent,
        border = if (ativo) BorderStroke(1.dp, AthenesPrimary.copy(alpha = 0.25f)) else null,
        modifier = Modifier
            .padding(horizontal = 2.dp)
            .size(38.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icone,
                contentDescription = descricao,
                tint = if (ativo) AthenesPrimary else Color(0xFF475569),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun CabecalhoMenu(texto: String) {
    Text(
        text = texto.uppercase(),
        style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AthenesTextMuted, letterSpacing = 0.5.sp),
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
    )
}

@Composable
private fun ItemMenu(rotulo: String, icone: ImageVector, ativo: Boolean, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(rotulo, fontWeight = if (ativo) FontWeight.Bold else FontWeight.Normal, color = if (ativo) AthenesPrimary else AthenesTextDark) },
        leadingIcon = { Icon(icone, contentDescription = null, tint = if (ativo) AthenesPrimary else AthenesTextMuted, modifier = Modifier.size(20.dp)) },
        modifier = Modifier.heightIn(min = 44.dp),
        onClick = onClick
    )
}
