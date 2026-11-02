package com.athenes.ui.editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuOpen
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.R
import com.athenes.core.model.TipoDocumento
import com.athenes.ui.theme.*

@Composable
fun EditorTopBar(
    tipoDocumento: TipoDocumento,
    painelEstruturaAberto: Boolean,
    painelInspetorAberto: Boolean,
    onAlternarEstrutura: () -> Unit,
    onAlternarInspetor: () -> Unit,
    onVoltar: () -> Unit,
    modifier: Modifier = Modifier
) {
    var menuTipoAberto by remember { mutableStateOf(false) }

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
            // Lado Esquerdo: Voltar (chevron v deitado) + Logo + ATHENES + Toggle Estrutura + Tipo Doc
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Voltar com chevron "v deitado" (<)
                IconButton(
                    onClick = onVoltar,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChevronLeft,
                        contentDescription = "Voltar",
                        tint = AthenesPrimary,
                        modifier = Modifier.size(26.dp)
                    )
                }

                // Logo Oficial Athenes
                Icon(
                    painter = painterResource(id = R.drawable.ic_athenes_owl_logo),
                    contentDescription = "Logo Athenes",
                    tint = AthenesPrimary,
                    modifier = Modifier.size(28.dp)
                )

                Text(
                    text = "ATHENES",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Black,
                        letterSpacing = 0.5.sp,
                        color = AthenesPrimary
                    )
                )

                Spacer(modifier = Modifier.width(4.dp))

                // Toggle Painel de Estrutura do Documento
                IconButton(
                    onClick = onAlternarEstrutura,
                    modifier = Modifier
                        .size(32.dp)
                        .background(
                            if (painelEstruturaAberto) AthenesPrimary.copy(alpha = 0.12f) else Color.Transparent,
                            shape = RoundedCornerShape(6.dp)
                        )
                ) {
                    Icon(
                        imageVector = if (painelEstruturaAberto) Icons.AutoMirrored.Rounded.MenuOpen else Icons.Rounded.Menu,
                        contentDescription = "Estrutura do Documento",
                        tint = if (painelEstruturaAberto) AthenesPrimary else AthenesTextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Seletor de Tipo de Documento: [ Artigo Científico v ]
                Box {
                    Surface(
                        onClick = { menuTipoAberto = true },
                        color = Color(0xFFF1F5F9),
                        shape = RoundedCornerShape(6.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Description,
                                contentDescription = null,
                                tint = AthenesPrimary,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = tipoDocumento.rotuloAmigavel,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.5.sp,
                                    color = AthenesTextDark
                                )
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.Rounded.KeyboardArrowDown,
                                contentDescription = null,
                                tint = AthenesTextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = menuTipoAberto,
                        onDismissRequest = { menuTipoAberto = false }
                    ) {
                        TipoDocumento.entries.forEach { tipo ->
                            DropdownMenuItem(
                                text = { Text(text = tipo.rotuloAmigavel, fontWeight = if (tipo == tipoDocumento) FontWeight.Bold else FontWeight.Normal) },
                                onClick = { menuTipoAberto = false }
                            )
                        }
                    }
                }
            }

            // Lado Direito: Status Salvo + Nuvem + Inspetor Toggle + Mais Opções
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Status Salvo Automaticamente
                Surface(
                    color = Color(0xFFECFDF5),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.CheckCircle,
                            contentDescription = null,
                            tint = Color(0xFF059669),
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = "Salvo automaticamente • 14:32",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF047857)
                            )
                        )
                    }
                }

                // Ícone Nuvem
                IconButton(
                    onClick = { },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CloudDone,
                        contentDescription = "Sincronizado na Nuvem",
                        tint = AthenesPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Toggle Painel Direito Inspetor
                IconButton(
                    onClick = onAlternarInspetor,
                    modifier = Modifier
                        .size(32.dp)
                        .background(
                            if (painelInspetorAberto) AthenesPrimary.copy(alpha = 0.12f) else Color.Transparent,
                            shape = RoundedCornerShape(6.dp)
                        )
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Dock,
                        contentDescription = "Alternar Painel Inspetor",
                        tint = if (painelInspetorAberto) AthenesPrimary else AthenesTextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Menu 3 Pontos
                IconButton(
                    onClick = { },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.MoreVert,
                        contentDescription = "Mais opções",
                        tint = AthenesTextDark,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
