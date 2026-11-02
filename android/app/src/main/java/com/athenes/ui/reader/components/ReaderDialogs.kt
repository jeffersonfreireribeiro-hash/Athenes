package com.athenes.ui.reader.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.athenes.core.model.ZoteroVinculoConfig
import com.athenes.ui.theme.*

@Composable
fun DialogNovaCitacao(
    textoInicial: String = "",
    paginaInicial: Int = 1,
    onSalvar: (texto: String, comentario: String, pagina: Int) -> Unit,
    onFechar: () -> Unit
) {
    var texto by remember { mutableStateOf(textoInicial) }
    var comentario by remember { mutableStateOf("") }
    var pagina by remember { mutableStateOf(paginaInicial.toString()) }

    Dialog(onDismissRequest = onFechar) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color.White,
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "Criar Nova Citação Acadêmica",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark
                    )
                )

                Spacer(modifier = Modifier.height(14.dp))

                Text(text = "Trecho do Artigo", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AthenesTextDark)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = texto,
                    onValueChange = { texto = it },
                    placeholder = { Text("Cole ou digite o trecho citado...") },
                    modifier = Modifier.fillMaxWidth().height(100.dp),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(text = "Comentário / Onde usar no documento", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AthenesTextDark)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = comentario,
                    onValueChange = { comentario = it },
                    placeholder = { Text("Ex: Usar na Introdução...") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(text = "Página", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AthenesTextDark)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = pagina,
                    onValueChange = { pagina = it },
                    modifier = Modifier.width(100.dp),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(18.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onFechar) {
                        Text(text = "Cancelar", color = AthenesTextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val pNum = pagina.toIntOrNull() ?: 1
                            if (texto.isNotBlank()) {
                                onSalvar(texto, comentario, pNum)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AthenesPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(text = "Salvar Citação", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun DialogNovaNotaAdesiva(
    paginaInicial: Int = 1,
    onSalvar: (titulo: String, texto: String, pagina: Int) -> Unit,
    onFechar: () -> Unit
) {
    var titulo by remember { mutableStateOf("") }
    var texto by remember { mutableStateOf("") }
    var pagina by remember { mutableStateOf(paginaInicial.toString()) }

    Dialog(onDismissRequest = onFechar) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color.White,
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "Criar Nova Nota Adesiva",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark
                    )
                )

                Spacer(modifier = Modifier.height(14.dp))

                Text(text = "Título da Nota", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AthenesTextDark)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = titulo,
                    onValueChange = { titulo = it },
                    placeholder = { Text("Ex: Destaque Metodológico") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(text = "Conteúdo da Nota", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AthenesTextDark)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = texto,
                    onValueChange = { texto = it },
                    placeholder = { Text("Escreva suas observações...") },
                    modifier = Modifier.fillMaxWidth().height(90.dp),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(text = "Página", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AthenesTextDark)
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = pagina,
                    onValueChange = { pagina = it },
                    modifier = Modifier.width(100.dp),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.height(18.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onFechar) {
                        Text(text = "Cancelar", color = AthenesTextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val pNum = pagina.toIntOrNull() ?: 1
                            if (titulo.isNotBlank() && texto.isNotBlank()) {
                                onSalvar(titulo, texto, pNum)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AthenesPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(text = "Salvar Nota", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
