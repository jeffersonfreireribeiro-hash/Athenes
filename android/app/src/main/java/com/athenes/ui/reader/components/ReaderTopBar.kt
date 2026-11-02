package com.athenes.ui.reader.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.R
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.ui.theme.*

@Composable
fun ReaderTopBar(
    artigo: ArtigoEstudoDetalhado,
    painelEsquerdoAberto: Boolean,
    painelDireitoAberto: Boolean,
    onAlternarEsquerdo: () -> Unit,
    onAlternarDireito: () -> Unit,
    onAbrirPdfClick: () -> Unit,
    onSalvarDriveZoteroClick: () -> Unit,
    onVoltarBiblioteca: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = AthenesSurface,
        shadowElevation = 2.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Lado Esquerdo: Botão Voltar + Logo + Painel Esquerdo Toggle + Título e Badges
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f, fill = false)
            ) {
                // Voltar para a Biblioteca
                IconButton(
                    onClick = onVoltarBiblioteca,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                        contentDescription = "Voltar à Biblioteca",
                        tint = AthenesPrimary
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Logo Athenes
                Icon(
                    painter = painterResource(id = R.drawable.ic_athenes_owl_logo),
                    contentDescription = "Logo Athenes",
                    tint = AthenesPrimary,
                    modifier = Modifier.size(28.dp)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = "ATHENES",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Black,
                        letterSpacing = 0.5.sp,
                        color = AthenesPrimary
                    )
                )

                Spacer(modifier = Modifier.width(12.dp))

                // Toggle Painel Esquerdo
                IconButton(
                    onClick = onAlternarEsquerdo,
                    modifier = Modifier
                        .size(32.dp)
                        .background(
                            if (painelEsquerdoAberto) AthenesPrimary.copy(alpha = 0.12f) else Color.Transparent,
                            shape = RoundedCornerShape(6.dp)
                        )
                ) {
                    Icon(
                        imageVector = if (painelEsquerdoAberto) Icons.Rounded.MenuOpen else Icons.Rounded.Menu,
                        contentDescription = "Alternar Painel Esquerdo",
                        tint = if (painelEsquerdoAberto) AthenesPrimary else AthenesTextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(10.dp))

                // Título do Artigo + Autor e Chave
                Column(
                    modifier = Modifier.widthIn(max = 420.dp)
                ) {
                    Text(
                        text = artigo.titulo,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "(${artigo.autores}, ${artigo.ano})",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 11.sp,
                                color = AthenesPrimary,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                        // Badge Chave Zotero
                        Surface(
                            color = Color(0xFFFEE2E2),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "#${artigo.chaveZotero}",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFDC2626)
                                ),
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                    }
                }
            }

            // Lado Direito: Status Zotero + Botão Abrir PDF + Botão Salvar no Drive & Zotero + Toggle Painel Direito
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Status Zotero com bolinha verde
                Surface(
                    color = Color(0xFFECFDF5),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .background(Color(0xFF10B981), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = "Zotero (${artigo.zoteroConfig.userId})",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF047857)
                            )
                        )
                    }
                }

                // Botão Abrir PDF
                OutlinedButton(
                    onClick = onAbrirPdfClick,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                    modifier = Modifier.height(32.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = AthenesPrimary
                    )
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PictureAsPdf,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Abrir PDF",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    )
                }

                // Botão Salvar no Drive & Zotero
                Button(
                    onClick = onSalvarDriveZoteroClick,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                    modifier = Modifier.height(32.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AthenesPrimary,
                        contentColor = Color.White
                    )
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CloudUpload,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Salvar no Drive & Zotero",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    )
                }

                // Toggle Painel Direito
                IconButton(
                    onClick = onAlternarDireito,
                    modifier = Modifier
                        .size(32.dp)
                        .background(
                            if (painelDireitoAberto) AthenesPrimary.copy(alpha = 0.12f) else Color.Transparent,
                            shape = RoundedCornerShape(6.dp)
                        )
                ) {
                    Icon(
                        imageVector = if (painelDireitoAberto) Icons.Rounded.ViewSidebar else Icons.Rounded.Dock,
                        contentDescription = "Alternar Painel Direito",
                        tint = if (painelDireitoAberto) AthenesPrimary else AthenesTextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
