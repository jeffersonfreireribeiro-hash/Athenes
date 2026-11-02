package com.athenes.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.Documento
import com.athenes.core.model.TipoDocumento
import com.athenes.ui.theme.*

@Composable
fun DialogNovoDocumento(
    onDismiss: () -> Unit,
    onConfirmar: (titulo: String, subtitulo: String, tipo: TipoDocumento, autor: String) -> Unit
) {
    var titulo by remember { mutableStateOf("") }
    var subtitulo by remember { mutableStateOf("") }
    var autor by remember { mutableStateOf("Autor Principal") }
    var tipoSelecionado by remember { mutableStateOf(TipoDocumento.DOCUMENTO) }
    var menuTipoAberto by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Novo Documento Acadêmico",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    color = AthenesPrimary
                )
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = titulo,
                    onValueChange = { titulo = it },
                    label = { Text("Título do Documento ou Artigo", fontSize = 12.sp) },
                    singleLine = false,
                    maxLines = 2,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AthenesPrimary,
                        unfocusedBorderColor = AthenesBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = subtitulo,
                    onValueChange = { subtitulo = it },
                    label = { Text("Subtítulo ou Linha de Pesquisa (Opcional)", fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AthenesPrimary,
                        unfocusedBorderColor = AthenesBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = autor,
                    onValueChange = { autor = it },
                    label = { Text("Nome do Autor / Pesquisador", fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AthenesPrimary,
                        unfocusedBorderColor = AthenesBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                // Seletor de Tipo
                Column {
                    Text(
                        text = "Tipo de Documento",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(42.dp)
                            .background(AthenesBg, RoundedCornerShape(8.dp))
                            .border(1.dp, AthenesBorder, RoundedCornerShape(8.dp))
                            .clickable { menuTipoAberto = true }
                            .padding(horizontal = 12.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Text(
                            text = tipoSelecionado.rotuloAmigavel,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = FontWeight.SemiBold,
                                color = AthenesText
                            )
                        )

                        DropdownMenu(
                            expanded = menuTipoAberto,
                            onDismissRequest = { menuTipoAberto = false }
                        ) {
                            TipoDocumento.entries.forEach { t ->
                                DropdownMenuItem(
                                    text = { Text(t.rotuloAmigavel, fontSize = 12.sp) },
                                    onClick = {
                                        tipoSelecionado = t
                                        menuTipoAberto = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (titulo.isNotBlank()) {
                        onConfirmar(titulo.trim(), subtitulo.trim(), tipoSelecionado, autor.trim())
                    }
                },
                enabled = titulo.isNotBlank(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AthenesPrimary,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Criar Documento", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = AthenesTextMuted)
            }
        },
        containerColor = AthenesSurface,
        shape = RoundedCornerShape(16.dp)
    )
}

@Composable
fun DialogConfirmarExclusao(
    documento: Documento,
    onDismiss: () -> Unit,
    onConfirmar: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Rounded.Warning,
                contentDescription = null,
                tint = Color(0xFFDC2626),
                modifier = Modifier.size(32.dp)
            )
        },
        title = {
            Text(
                text = "Excluir Documento?",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    color = AthenesText
                )
            )
        },
        text = {
            Text(
                text = "Tem certeza de que deseja excluir \"${documento.titulo}\"? Esta ação removerá o trabalho da biblioteca local.",
                style = MaterialTheme.typography.bodyMedium.copy(color = AthenesTextMuted)
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirmar,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFDC2626),
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Excluir", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = AthenesTextMuted)
            }
        },
        containerColor = AthenesSurface,
        shape = RoundedCornerShape(16.dp)
    )
}

@Composable
fun DialogRenomear(
    documento: Documento,
    onDismiss: () -> Unit,
    onConfirmar: (novoTitulo: String) -> Unit
) {
    var novoTitulo by remember { mutableStateOf(documento.titulo) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Renomear Trabalho",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    color = AthenesPrimary
                )
            )
        },
        text = {
            OutlinedTextField(
                value = novoTitulo,
                onValueChange = { novoTitulo = it },
                label = { Text("Novo Título", fontSize = 12.sp) },
                singleLine = false,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AthenesPrimary,
                    unfocusedBorderColor = AthenesBorder
                ),
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            Button(
                onClick = {
                    if (novoTitulo.isNotBlank()) onConfirmar(novoTitulo.trim())
                },
                enabled = novoTitulo.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = AthenesPrimary),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Salvar", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = AthenesTextMuted)
            }
        },
        containerColor = AthenesSurface,
        shape = RoundedCornerShape(16.dp)
    )
}
