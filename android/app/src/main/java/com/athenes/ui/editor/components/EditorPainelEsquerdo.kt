package com.athenes.ui.editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.ui.editor.SecaoEstrutura
import com.athenes.ui.theme.AthenesPrimary
import com.athenes.ui.theme.AthenesTextDark
import com.athenes.ui.theme.AthenesTextMuted

@Composable
fun EditorPainelEsquerdo(
    abaAtiva: Int, // 0 = Seções, 1 = Margens, 2 = Estilos
    estrutura: List<SecaoEstrutura>,
    onSelecionarAba: (Int) -> Unit,
    onFechar: () -> Unit,
    onIrParaSecao: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color(0xFFF8FAFC),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = modifier
            .width(310.dp)
            .fillMaxHeight()
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Cabeçalho com Abas: [Seções] [Margens ABNT] [Estilos]
            Surface(
                color = Color.White,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    ItemAbaEsq(
                        titulo = "Seções",
                        icone = Icons.AutoMirrored.Rounded.MenuBook,
                        selecionada = abaAtiva == 0,
                        onClick = { onSelecionarAba(0) },
                        modifier = Modifier.weight(1f)
                    )
                    ItemAbaEsq(
                        titulo = "Margens",
                        icone = Icons.Rounded.CropPortrait,
                        selecionada = abaAtiva == 1,
                        onClick = { onSelecionarAba(1) },
                        modifier = Modifier.weight(1f)
                    )
                    ItemAbaEsq(
                        titulo = "Estilos",
                        icone = Icons.Rounded.TextFields,
                        selecionada = abaAtiva == 2,
                        onClick = { onSelecionarAba(2) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(12.dp)
            ) {
                when (abaAtiva) {
                    0 -> ConteudoAbaSecoes(estrutura, onIrParaSecao)
                    1 -> ConteudoAbaMargens()
                    2 -> ConteudoAbaEstilos()
                }
            }
        }
    }
}

@Composable
private fun ItemAbaEsq(
    titulo: String,
    icone: androidx.compose.ui.graphics.vector.ImageVector,
    selecionada: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        color = if (selecionada) AthenesPrimary else Color.Transparent,
        shape = RoundedCornerShape(6.dp),
        modifier = modifier
    ) {
        Row(
            modifier = Modifier.padding(vertical = 7.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icone,
                contentDescription = null,
                tint = if (selecionada) Color.White else AthenesTextDark,
                modifier = Modifier.size(13.dp)
            )
            Spacer(modifier = Modifier.width(3.dp))
            Text(
                text = titulo,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = if (selecionada) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (selecionada) Color.White else AthenesTextDark,
                    fontSize = 10.5.sp
                ),
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ConteudoAbaSecoes(estrutura: List<SecaoEstrutura>, onIrParaSecao: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        item {
            Text(
                text = "ESTRUTURA DO TRABALHO",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = AthenesTextDark,
                    letterSpacing = 0.5.sp
                )
            )
            Spacer(modifier = Modifier.height(4.dp))
        }

        items(estrutura, key = { it.id }) { secao ->
            Surface(
                onClick = { onIrParaSecao(secao.id) },
                color = Color.White,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (secao.numero.isNotBlank()) {
                            Text(
                                text = secao.numero,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = AthenesPrimary,
                                    fontSize = 12.sp
                                )
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                        }
                        Text(
                            text = secao.titulo,
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontWeight = FontWeight.SemiBold,
                                color = AthenesTextDark,
                                fontSize = 12.sp
                            )
                        )
                    }

                    if (secao.subsecoes.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Column(
                            modifier = Modifier.padding(start = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            secao.subsecoes.forEach { sub ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = sub.numero,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = AthenesPrimary,
                                            fontSize = 11.sp
                                        )
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = sub.titulo,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = AthenesTextDark,
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConteudoAbaMargens() {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "MARGENS DA FOLHA (ABNT NBR 14724)",
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                color = AthenesTextDark,
                letterSpacing = 0.5.sp
            )
        )

        // Diagrama Visual da Folha A4 com Tarjas de Margem
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Miniatura da Folha A4 (proporção 210 x 297 mm)
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .height(198.dp)
                        .background(Color(0xFFF8FAFC), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(4.dp))
                ) {
                    // Tarja Superior (30 mm)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(20.dp)
                            .background(AthenesPrimary.copy(alpha = 0.15f))
                    ) {
                        Text(
                            text = "Sup: 30 mm",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = AthenesPrimary,
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }

                    // Tarja Esquerda (30 mm)
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .width(20.dp)
                            .background(AthenesPrimary.copy(alpha = 0.15f))
                    ) {
                        Text(
                            text = "30",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = AthenesPrimary,
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }

                    // Área Útil Central (160 x 247 mm)
                    Box(
                        modifier = Modifier
                            .padding(start = 20.dp, top = 20.dp, end = 14.dp, bottom = 14.dp)
                            .fillMaxSize()
                            .background(Color.White)
                            .border(1.dp, Color(0xFF93C5FD))
                    ) {
                        Text(
                            text = "Área Útil\n160 × 247 mm\n12 colunas",
                            fontSize = 7.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF2563EB),
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }

                    // Tarja Direita (20 mm)
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .fillMaxHeight()
                            .width(14.dp)
                            .background(AthenesPrimary.copy(alpha = 0.12f))
                    )

                    // Tarja Inferior (20 mm)
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(14.dp)
                            .background(AthenesPrimary.copy(alpha = 0.12f))
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "A4 (210 × 297 mm) • Retrato",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark,
                        fontSize = 11.sp
                    )
                )
                Text(
                    text = "Superior: 30 mm | Esquerda: 30 mm\nInferior: 20 mm | Direita: 20 mm",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = AthenesTextMuted,
                        fontSize = 10.sp
                    )
                )
            }
        }
    }
}

@Composable
private fun ConteudoAbaEstilos() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                text = "ESTILOS TIPOGRÁFICOS",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = AthenesTextDark,
                    letterSpacing = 0.5.sp
                )
            )
            Spacer(modifier = Modifier.height(2.dp))
        }

        val estilos = listOf(
            Triple("Título 1", "24 pt • Negrito • Caixa Alta • Espaçamento 18 pt", AthenesPrimary),
            Triple("Título 2", "18 pt • Negrito • Entrelinha 1,5 • Espaçamento 12 pt", AthenesPrimary),
            Triple("Título 3", "14 pt • Negrito • Entrelinha 1,5 • Espaçamento 8 pt", AthenesPrimary),
            Triple("Texto Normal", "12 pt • Regular • Entrelinha 1,5 • Recuo 1,25 cm", Color(0xFF1E293B)),
            Triple("Citação Direta Longa", "10 pt • Regular • Entrelinha Simples • Recuo 4 cm", Color(0xFF475569)),
            Triple("Legenda de Ilustração", "10 pt • Regular • Centralizado • Topo", Color(0xFF64748B)),
            Triple("Fonte de Ilustração", "10 pt • Regular • Centralizado • Rodapé", Color(0xFF64748B))
        )

        items(estilos) { (nome, desc, cor) ->
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text(
                        text = nome,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = cor,
                            fontSize = 12.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = AthenesTextMuted,
                            fontSize = 10.5.sp
                        )
                    )
                }
            }
        }
    }
}
