package com.athenes.ui.reader.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuOpen
import androidx.compose.material.icons.automirrored.rounded.ViewSidebar
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
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // LADO ESQUERDO: Botão Voltar (chevron <) + Logo Coruja + ATHENES + Toggle Painel Esquerdo
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Voltar com seta "v deitado" (<)
                Surface(
                    onClick = onVoltarBiblioteca,
                    shape = RoundedCornerShape(8.dp),
                    color = Color.Transparent,
                    modifier = Modifier.size(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Rounded.ChevronLeft,
                            contentDescription = "Voltar à Biblioteca",
                            tint = AthenesPrimary,
                            modifier = Modifier.size(26.dp)
                        )
                    }
                }

                // Logo Athenes
                Icon(
                    painter = painterResource(id = R.drawable.ic_athenes_owl_logo),
                    contentDescription = "Logo Athenes",
                    tint = AthenesPrimary,
                    modifier = Modifier.size(26.dp)
                )

                Text(
                    text = "ATHENES",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Black,
                        letterSpacing = 0.5.sp,
                        color = AthenesPrimary,
                        fontSize = 15.sp
                    )
                )

                Spacer(modifier = Modifier.width(2.dp))

                // Toggle Painel Esquerdo (Zotero & Páginas) com ícone SVG expressivo
                Surface(
                    onClick = onAlternarEsquerdo,
                    shape = RoundedCornerShape(8.dp),
                    color = if (painelEsquerdoAberto) AthenesPrimary.copy(alpha = 0.12f) else Color(0xFFF1F5F9),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (painelEsquerdoAberto) AthenesPrimary else Color(0xFFCBD5E1)
                    ),
                    modifier = Modifier.size(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (painelEsquerdoAberto) Icons.AutoMirrored.Rounded.MenuOpen else Icons.Rounded.Menu,
                            contentDescription = "Alternar Painel Esquerdo",
                            tint = if (painelEsquerdoAberto) AthenesPrimary else AthenesTextDark,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // CENTRO: Identificação do Artigo (Título, Autor e Badge Zotero com espaço nobre)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 6.dp)
            ) {
                Text(
                    text = artigo.titulo,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark,
                        fontSize = 13.5.sp
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
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Text(
                        text = "•",
                        fontSize = 10.sp,
                        color = AthenesTextMuted
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
                            maxLines = 1,
                            softWrap = false,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.5.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // LADO DIREITO: Ícones SVG Expressivos e Compactos em vez de palavras longas
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // 1. Status Conexão Zotero (Ícone Acadêmico + Ponto Verde + Tag Compacta)
                Surface(
                    color = Color(0xFFECFDF5),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0)),
                    modifier = Modifier.height(36.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .background(Color(0xFF10B981), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Icon(
                            imageVector = Icons.Rounded.School,
                            contentDescription = "Zotero Conectado",
                            tint = Color(0xFF047857),
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Zotero",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF047857)
                            )
                        )
                    }
                }

                // 2. Ícone Expressivo SVG: Abrir PDF (36x36dp)
                Surface(
                    onClick = onAbrirPdfClick,
                    shape = RoundedCornerShape(8.dp),
                    color = Color.White,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                    shadowElevation = 0.5.dp,
                    modifier = Modifier.size(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Rounded.PictureAsPdf,
                            contentDescription = "Abrir Arquivo PDF",
                            tint = AthenesPrimary,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }

                // 3. Ícone Expressivo SVG: Salvar no Google Drive e Sincronizar (36x36dp)
                Surface(
                    onClick = onSalvarDriveZoteroClick,
                    shape = RoundedCornerShape(8.dp),
                    color = AthenesPrimary,
                    shadowElevation = 1.dp,
                    modifier = Modifier.size(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Rounded.CloudUpload,
                            contentDescription = "Salvar no Drive & Sincronizar",
                            tint = Color.White,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }

                // 4. Ícone Expressivo SVG: Alternar Inspetor Direito (36x36dp)
                Surface(
                    onClick = onAlternarDireito,
                    shape = RoundedCornerShape(8.dp),
                    color = if (painelDireitoAberto) AthenesPrimary.copy(alpha = 0.12f) else Color(0xFFF1F5F9),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (painelDireitoAberto) AthenesPrimary else Color(0xFFCBD5E1)
                    ),
                    modifier = Modifier.size(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (painelDireitoAberto) Icons.AutoMirrored.Rounded.ViewSidebar else Icons.Rounded.Dock,
                            contentDescription = "Alternar Painel Inspetor",
                            tint = if (painelDireitoAberto) AthenesPrimary else AthenesTextDark,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }
            }
        }
    }
}
