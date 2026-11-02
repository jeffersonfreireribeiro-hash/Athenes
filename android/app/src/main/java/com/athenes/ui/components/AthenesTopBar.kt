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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.School
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.R
import com.athenes.ui.theme.*

@Composable
fun AthenesTopBar(
    modoAtivo: Int, // 0 = Escrita & Documentos, 1 = Leitura de Artigos, PDF & Zotero
    onModoAlterado: (Int) -> Unit,
    onMenuClick: () -> Unit = {},
    usuarioIniciais: String = "AP",
    modifier: Modifier = Modifier
) {
    Surface(
        color = AthenesSurface,
        modifier = modifier.fillMaxWidth(),
        shadowElevation = 1.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            // Linha Superior: Logo Athenes + Menu + Avatar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Identidade Visual da Marca ATHENES (Ícone Oficial da Coruja com Óculos / Lápis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_athenes_owl_logo),
                        contentDescription = "Logo Athenes",
                        tint = AthenesPrimary,
                        modifier = Modifier.size(30.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "ATHENES",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.8.sp,
                                color = AthenesPrimary
                            )
                        )
                    }
                }

                // Ações à Direita: Menu Hambúrguer e Avatar do Usuário
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onMenuClick,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Menu,
                            contentDescription = "Menu Principal",
                            tint = AthenesText
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(AvatarBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = usuarioIniciais,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 12.sp
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Seletor de Modo Pílula: 1. Escrita & Documentos | 2. Leitura de Artigos, PDF & Zotero
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AthenesBg, shape = RoundedCornerShape(999.dp))
                    .border(1.dp, AthenesBorderSubtle, shape = RoundedCornerShape(999.dp))
                    .padding(3.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    // Modo 0: Escrita
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (modoAtivo == 0) AthenesPrimary else Color.Transparent)
                            .clickable { onModoAlterado(0) }
                            .heightIn(min = 44.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.Description,
                                contentDescription = null,
                                tint = if (modoAtivo == 0) Color.White else AthenesTextMuted,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Escrita",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = if (modoAtivo == 0) Color.White else AthenesText
                                )
                            )
                        }
                    }

                    // Modo 1: Leitura de Artigos & Zotero
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (modoAtivo == 1) AthenesPrimary else Color.Transparent)
                            .clickable { onModoAlterado(1) }
                            .heightIn(min = 44.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.AutoStories,
                                contentDescription = null,
                                tint = if (modoAtivo == 1) Color.White else AthenesTextMuted,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Leitura e Zotero",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = if (modoAtivo == 1) Color.White else AthenesText
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}
