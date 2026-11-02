package com.athenes.ui.reader.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import com.athenes.core.model.FerramentaLeitura
import com.athenes.ui.theme.*

@Composable
fun ReaderSubBar(
    totalPaginas: Int,
    paginaAtual: Int,
    ferramentaAtiva: FerramentaLeitura,
    corAtiva: String,
    coresDisponiveis: List<String>,
    onSelecionarFerramenta: (FerramentaLeitura) -> Unit,
    onSelecionarCor: (String) -> Unit,
    onPaginaAnterior: () -> Unit,
    onProximaPagina: () -> Unit,
    onDesfazer: () -> Unit,
    onLimparPagina: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color(0xFFF1F5F9),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Lado Esquerdo: Ações de Histórico (Desfazer, Limpar) + Ferramentas de Estudo
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Desfazer
                IconButton(
                    onClick = onDesfazer,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Undo,
                        contentDescription = "Desfazer Traço",
                        tint = AthenesTextDark,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Limpar Folha
                IconButton(
                    onClick = onLimparPagina,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.DeleteOutline,
                        contentDescription = "Limpar Riscos da Página",
                        tint = Color(0xFFDC2626),
                        modifier = Modifier.size(18.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .height(20.dp)
                        .width(1.dp)
                        .background(Color(0xFFCBD5E1))
                )

                // Ferramenta Seleção
                ItemBotaoFerramenta(
                    icone = Icons.Rounded.NearMe,
                    selecionado = ferramentaAtiva == FerramentaLeitura.SELECAO,
                    onClick = { onSelecionarFerramenta(FerramentaLeitura.SELECAO) }
                )

                // Ferramenta Marca-Texto
                ItemBotaoFerramenta(
                    icone = Icons.Rounded.Highlight,
                    selecionado = ferramentaAtiva == FerramentaLeitura.MARCADOR,
                    onClick = { onSelecionarFerramenta(FerramentaLeitura.MARCADOR) }
                )

                // Ferramenta Caneta Stylus / Desenho
                ItemBotaoFerramenta(
                    icone = Icons.Rounded.Draw,
                    selecionado = ferramentaAtiva == FerramentaLeitura.CANETA,
                    onClick = { onSelecionarFerramenta(FerramentaLeitura.CANETA) }
                )

                // Ferramenta Borracha
                ItemBotaoFerramenta(
                    icone = Icons.Rounded.AutoFixNormal,
                    selecionado = ferramentaAtiva == FerramentaLeitura.BORRACHA,
                    onClick = { onSelecionarFerramenta(FerramentaLeitura.BORRACHA) }
                )

                // Ferramenta Nota Adesiva
                ItemBotaoFerramenta(
                    icone = Icons.Rounded.StickyNote2,
                    selecionado = ferramentaAtiva == FerramentaLeitura.NOTA,
                    onClick = { onSelecionarFerramenta(FerramentaLeitura.NOTA) }
                )

                // Ferramenta Citação
                ItemBotaoFerramenta(
                    icone = Icons.Rounded.FormatQuote,
                    selecionado = ferramentaAtiva == FerramentaLeitura.CITACAO,
                    onClick = { onSelecionarFerramenta(FerramentaLeitura.CITACAO) }
                )

                Spacer(modifier = Modifier.width(6.dp))

                Box(
                    modifier = Modifier
                        .height(20.dp)
                        .width(1.dp)
                        .background(Color(0xFFCBD5E1))
                )

                Spacer(modifier = Modifier.width(6.dp))

                // Paleta de 6 Cores
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    coresDisponiveis.forEach { hex ->
                        val cor = parseHexColor(hex)
                        val ehAtiva = hex.equals(corAtiva, ignoreCase = true)
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(cor)
                                .border(
                                    width = if (ehAtiva) 2.5.dp else 1.dp,
                                    color = if (ehAtiva) AthenesPrimary else Color(0x33000000),
                                    shape = CircleShape
                                )
                                .clickable { onSelecionarCor(hex) },
                            contentAlignment = Alignment.Center
                        ) {
                            if (ehAtiva) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(AthenesPrimary, CircleShape)
                                )
                            }
                        }
                    }
                }
            }

            // Lado Direito: Navegação de Páginas
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                IconButton(
                    onClick = onPaginaAnterior,
                    enabled = paginaAtual > 1,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChevronLeft,
                        contentDescription = "Página Anterior",
                        tint = if (paginaAtual > 1) AthenesPrimary else AthenesTextMuted
                    )
                }

                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(6.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1))
                ) {
                    Text(
                        text = "Pág. $paginaAtual de $totalPaginas",
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark
                        ),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                IconButton(
                    onClick = onProximaPagina,
                    enabled = paginaAtual < totalPaginas,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChevronRight,
                        contentDescription = "Próxima Página",
                        tint = if (paginaAtual < totalPaginas) AthenesPrimary else AthenesTextMuted
                    )
                }
            }
        }
    }
}

@Composable
private fun ItemBotaoFerramenta(
    icone: androidx.compose.ui.graphics.vector.ImageVector,
    selecionado: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(if (selecionado) AthenesPrimary else Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icone,
            contentDescription = null,
            tint = if (selecionado) Color.White else AthenesTextDark,
            modifier = Modifier.size(18.dp)
        )
    }
}

fun parseHexColor(hex: String): Color {
    return try {
        val limpo = hex.removePrefix("#")
        val colorInt = limpo.toLong(16)
        if (limpo.length == 6) {
            Color(colorInt or 0x00000000FF000000)
        } else {
            Color(colorInt)
        }
    } catch (_: Exception) {
        Color(0xFFFDE047)
    }
}
