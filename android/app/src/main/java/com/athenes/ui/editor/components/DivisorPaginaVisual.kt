// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.InsertPageBreak
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.R
import com.athenes.core.model.ConfiguracaoPagina
import com.athenes.ui.theme.*

private val NunitoFolha = FontFamily.SansSerif
private val CorMesaA4 = Color(0xFFE8ECF1)

/**
 * Divisa visual realista de páginas A4 contínuas no editor.
 * Exibe:
 * 1. Rodapé mestre da página anterior com numeração e rigor normativo.
 * 2. Vão de mesa realista (#E8ECF1) com sombras de quebra e indicador de página contínua.
 * 3. Cabeçalho mestre da nova página com título do documento e numeração.
 */
@Composable
fun DivisorPaginaVisual(
    paginaAnterior: Int,
    paginaNova: Int = paginaAnterior + 1,
    tituloDocumento: String = "",
    nomeMestra: String = "Corpo Editorial (ABNT)",
    instituicao: String = "Athenes · Rigor Normativo Editorial (ABNT)",
    configPagina: ConfiguracaoPagina = ConfiguracaoPagina(),
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        // 1. Rodapé Mestre da Página Anterior
        FaixaMestraRodapeVisual(
            configPagina = configPagina,
            numeroPagina = paginaAnterior,
            instituicao = instituicao
        )

        // 2. Vão de Mesa Realista (#E8ECF1)
        VaoDeMesaRealista(
            paginaNova = paginaNova
        )

        // 3. Cabeçalho Mestre da Nova Página
        FaixaMestraCabecalhoVisual(
            titulo = tituloDocumento,
            configPagina = configPagina,
            nomeMestra = nomeMestra,
            numeroPagina = paginaNova
        )
    }
}

/**
 * Vão físico de mesa que separa duas páginas contínuas com acabamento Soft UI e sombra realista.
 */
@Composable
fun VaoDeMesaRealista(
    paginaNova: Int,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(34.dp)
            .background(CorMesaA4)
    ) {
        // Sombra suave inferior da folha anterior
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .align(Alignment.TopCenter)
        ) {
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color(0x220F172A),
                        Color(0x000F172A)
                    )
                )
            )
        }

        // Crachá elegante no vão de mesa indicando o corte de página contínuo
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(999.dp),
            shadowElevation = 2.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
            modifier = Modifier.align(Alignment.Center)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.InsertPageBreak,
                    contentDescription = null,
                    tint = AthenesPrimary,
                    modifier = Modifier.size(13.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    text = "QUEBRA A4 · PÁG. $paginaNova",
                    style = TextStyle(
                        fontFamily = NunitoFolha,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = AthenesPrimary,
                        letterSpacing = 0.5.sp
                    )
                )
            }
        }

        // Sombra suave superior da folha seguinte
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .align(Alignment.BottomCenter)
        ) {
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color(0x000F172A),
                        Color(0x1A0F172A)
                    )
                )
            )
        }
    }
}

@Composable
fun FaixaMestraCabecalhoVisual(
    titulo: String,
    configPagina: ConfiguracaoPagina,
    nomeMestra: String = "Corpo Editorial (ABNT)",
    numeroPagina: Int = 1,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(top = 10.dp, bottom = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f, fill = false)
            ) {
                Surface(
                    color = AthenesPrimarySoft,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = "MESTRA: ${nomeMestra.uppercase()}",
                        style = TextStyle(
                            fontFamily = NunitoFolha,
                            fontSize = 8.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = AthenesPrimary,
                            letterSpacing = 0.5.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = titulo.ifBlank { "Sem título" },
                    style = TextStyle(
                        fontFamily = NunitoFolha,
                        fontSize = 9.sp,
                        color = AthenesTextMuted,
                        fontStyle = FontStyle.Italic
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = "Pág. $numeroPagina",
                style = TextStyle(
                    fontFamily = NunitoFolha,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AthenesPrimaryDark
                )
            )
        }
        Spacer(Modifier.height(4.dp))
        HorizontalDivider(thickness = 0.8.dp, color = AthenesPrimary.copy(alpha = 0.25f))
    }
}

@Composable
fun FaixaMestraRodapeVisual(
    configPagina: ConfiguracaoPagina,
    numeroPagina: Int = 1,
    instituicao: String = "Athenes · Rigor Normativo Editorial (ABNT)",
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(top = 10.dp, bottom = 10.dp)
    ) {
        HorizontalDivider(thickness = 0.8.dp, color = AthenesBorderSubtle)
        Spacer(Modifier.height(6.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = instituicao,
                style = TextStyle(
                    fontFamily = NunitoFolha,
                    fontSize = 9.sp,
                    color = AthenesTextMuted
                )
            )
            Text(
                text = "— $numeroPagina —",
                style = TextStyle(
                    fontFamily = NunitoFolha,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = AthenesPrimary
                )
            )
            Text(
                text = "${configPagina.formato.rotulo} (${configPagina.larguraMm.toInt()}×${configPagina.alturaMm.toInt()} mm)",
                style = TextStyle(
                    fontFamily = NunitoFolha,
                    fontSize = 8.5.sp,
                    color = AthenesTextMuted
                )
            )
        }
    }
}

@Preview(name = "Divisor de Página Visual Contínuo", showBackground = true, widthDp = 480)
@Composable
fun DivisorPaginaVisualPreview() {
    AthenesTheme {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(16.dp)
        ) {
            DivisorPaginaVisual(
                paginaAnterior = 1,
                paginaNova = 2,
                tituloDocumento = "Análise Dialética do Urbanismo Contemporâneo e REURB",
                nomeMestra = "Corpo Editorial (ABNT)",
                instituicao = "Athenes · Rigor Normativo Editorial (ABNT)"
            )
        }
    }
}
