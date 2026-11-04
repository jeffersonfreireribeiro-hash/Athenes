package com.athenes.ui.editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.ui.editor.AlinhamentoTexto
import com.athenes.ui.editor.BlocoEditor
import com.athenes.ui.editor.TipoBlocoEditor
import com.athenes.ui.theme.AthenesPrimary
import com.athenes.ui.theme.AthenesTextDark
import com.athenes.ui.theme.AthenesTextMuted

@Composable
fun EditorPainelInspetor(
    bloco: BlocoEditor?,
    onAlinhamentoAlterado: (AlinhamentoTexto) -> Unit,
    onColunasAlteradas: (Int) -> Unit,
    onNivelTituloAlterado: (Int) -> Unit,
    onDuplicarBloco: () -> Unit,
    onExcluirBloco: () -> Unit,
    onFechar: () -> Unit,
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
            // Cabeçalho do Inspetor
            Surface(
                color = Color.White,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "INSPETOR DE BLOCO",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark,
                            fontSize = 11.sp,
                            letterSpacing = 0.5.sp
                        )
                    )

                    IconButton(
                        onClick = onFechar,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Fechar Inspetor",
                            tint = AthenesTextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            if (bloco == null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Toque em qualquer bloco da folha para inspecionar e ajustar suas propriedades.",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = AthenesTextMuted,
                            fontSize = 12.sp
                        )
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // 1. Tipo do Bloco
                    Surface(
                        color = Color.White,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(AthenesPrimary.copy(alpha = 0.12f), RoundedCornerShape(6.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Category,
                                    contentDescription = null,
                                    tint = AthenesPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = bloco.tipo.rotulo,
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = AthenesTextDark,
                                        fontSize = 13.sp
                                    )
                                )
                                Text(
                                    text = bloco.tipo.desc,
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = AthenesTextMuted,
                                        fontSize = 10.5.sp
                                    )
                                )
                            }
                        }
                    }

                    if (bloco.tipo == TipoBlocoEditor.TITULO) {
                        Column {
                            Text("Nível do título: ${bloco.nivelTitulo}", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Slider(
                                value = bloco.nivelTitulo.toFloat(),
                                onValueChange = { onNivelTituloAlterado(it.toInt().coerceIn(1, 9)) },
                                valueRange = 1f..9f,
                                steps = 7
                            )
                        }
                    }

                    // 2. Largura na Grade Paramétrica (1 a 12 colunas)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "LARGURA NA GRADE (${bloco.colunas} / 12 COLUNAS)",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.5.sp,
                                color = AthenesTextDark
                            )
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            listOf(
                                Pair(12, "12 col (Total)"),
                                Pair(6, "6 col (50%)"),
                                Pair(8, "8 col (66%)")
                            ).forEach { (col, rotulo) ->
                                val selecionada = bloco.colunas == col
                                Surface(
                                    onClick = { onColunasAlteradas(col) },
                                    color = if (selecionada) AthenesPrimary else Color.White,
                                    shape = RoundedCornerShape(6.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (selecionada) AthenesPrimary else Color(0xFFE2E8F0)
                                    ),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Box(
                                        modifier = Modifier.padding(vertical = 7.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = rotulo,
                                            fontSize = 10.sp,
                                            fontWeight = if (selecionada) FontWeight.Bold else FontWeight.Medium,
                                            color = if (selecionada) Color.White else AthenesTextDark
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // 3. Alinhamento Tipográfico
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "ALINHAMENTO EDITORIAL",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.5.sp,
                                color = AthenesTextDark
                            )
                        )

                        val opcoesAlinhamento = listOf(
                            Triple(AlinhamentoTexto.ESQUERDA, Icons.Rounded.FormatAlignLeft, "Esquerda"),
                            Triple(AlinhamentoTexto.CENTRO, Icons.Rounded.FormatAlignCenter, "Centro"),
                            Triple(AlinhamentoTexto.DIREITA, Icons.Rounded.FormatAlignRight, "Direita"),
                            Triple(AlinhamentoTexto.JUSTIFICADO, Icons.Rounded.FormatAlignJustify, "Justificado"),
                            Triple(AlinhamentoTexto.JUSTIFICADO_ESQUERDA, Icons.Rounded.FormatAlignJustify, "Justificado, última linha à esquerda"),
                            Triple(AlinhamentoTexto.JUSTIFICADO_CENTRO, Icons.Rounded.FormatAlignJustify, "Justificado, última linha centralizada"),
                            Triple(AlinhamentoTexto.JUSTIFICADO_DIREITA, Icons.Rounded.FormatAlignJustify, "Justificado, última linha à direita")
                        )
                        opcoesAlinhamento.chunked(4).forEach { linha ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                            linha.forEach { (alinhamento, icone, descricao) ->
                                val ativo = bloco.alinhamento == alinhamento
                                Surface(
                                    onClick = { onAlinhamentoAlterado(alinhamento) },
                                    color = if (ativo) AthenesPrimary else Color.White,
                                    shape = RoundedCornerShape(6.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (ativo) AthenesPrimary else Color(0xFFE2E8F0)
                                    ),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Box(
                                        modifier = Modifier.padding(vertical = 7.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = icone,
                                            contentDescription = descricao,
                                            tint = if (ativo) Color.White else AthenesTextDark,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                            repeat(4 - linha.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // 4. Ações: Duplicar e Excluir Bloco
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDuplicarBloco,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = AthenesPrimary
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.ContentCopy,
                                contentDescription = null,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Duplicar", fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = onExcluirBloco,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFEF4444),
                                contentColor = Color.White
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.DeleteOutline,
                                contentDescription = null,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Excluir", fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
