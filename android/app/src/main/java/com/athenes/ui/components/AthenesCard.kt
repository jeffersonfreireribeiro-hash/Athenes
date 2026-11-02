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
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.Documento
import com.athenes.ui.theme.*

@Composable
fun AthenesCard(
    documento: Documento,
    onAbrirClick: () -> Unit,
    onDuplicarClick: () -> Unit = {},
    onRenomearClick: () -> Unit = {},
    onExcluirClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var menuAberto by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = AthenesSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, AthenesBorderSubtle, RoundedCornerShape(12.dp))
            .clickable { onAbrirClick() }
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // 1. Banner de Prévia Visual da Capa do Documento (Idêntico ao Web e à foto de referência)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(CardPreviewBg)
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                    .padding(10.dp)
            ) {
                // Tarja decorativa lateral azul
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .height(34.dp)
                        .background(AthenesPrimary, shape = RoundedCornerShape(2.dp))
                        .align(Alignment.CenterStart)
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = documento.titulo,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesText,
                            fontSize = 11.sp
                        ),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = "${documento.autor} · ${documento.ano}",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = AthenesTextMuted,
                            fontSize = 9.5.sp
                        ),
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // 2. Linha de Badges: [TIPO] [SITUAÇÃO] [ESTADO NUVEM]
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                BadgeTipo(tipo = documento.tipo)
                BadgeSituacao(situacao = documento.situacao)
                BadgeNuvem(estado = documento.estadoNuvem)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // 3. Título Principal em Destaque
            Text(
                text = documento.titulo,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = AthenesText,
                    fontSize = 14.5.sp,
                    lineHeight = 19.sp
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            // 4. Subtítulo / Resumo Descritivo (se houver)
            if (documento.subtitulo.isNotEmpty() || documento.resumo.isNotEmpty()) {
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = documento.subtitulo.ifEmpty { documento.resumo },
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = AthenesTextMuted,
                        fontSize = 11.5.sp,
                        lineHeight = 15.sp
                    ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // 5. Nome do Autor
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = documento.autor,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = AthenesTextMuted,
                    fontSize = 11.sp
                )
            )

            Spacer(modifier = Modifier.height(10.dp))

            // 6. Rodapé: Modificado em XX + Botão Abrir + Menu de Opções
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Modificado em ${documento.modificadoEm}",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = AthenesTextMuted,
                        fontSize = 10.5.sp
                    )
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Botão "Abrir"
                    Button(
                        onClick = onAbrirClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AthenesPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.height(28.dp)
                    ) {
                        Text(
                            text = "Abrir",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        )
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    // Menu de Ações Secundárias
                    Box {
                        IconButton(
                            onClick = { menuAberto = true },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.MoreVert,
                                contentDescription = "Mais opções",
                                tint = AthenesTextMuted,
                                modifier = Modifier.size(17.dp)
                            )
                        }

                        DropdownMenu(
                            expanded = menuAberto,
                            onDismissRequest = { menuAberto = false },
                            modifier = Modifier.background(AthenesSurface)
                        ) {
                            DropdownMenuItem(
                                text = { Text("Renomear Documento", fontSize = 12.sp) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Rounded.Edit,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                onClick = {
                                    menuAberto = false
                                    onRenomearClick()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Duplicar Trabalho", fontSize = 12.sp) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Rounded.ContentCopy,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                onClick = {
                                    menuAberto = false
                                    onDuplicarClick()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Excluir", fontSize = 12.sp, color = Color(0xFFDC2626)) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Rounded.Delete,
                                        contentDescription = null,
                                        tint = Color(0xFFDC2626),
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                onClick = {
                                    menuAberto = false
                                    onExcluirClick()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
