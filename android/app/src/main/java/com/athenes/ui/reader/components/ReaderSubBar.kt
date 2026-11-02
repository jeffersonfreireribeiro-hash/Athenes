package com.athenes.ui.reader.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.StickyNote2
import androidx.compose.material.icons.automirrored.rounded.Undo
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import com.athenes.core.model.FerramentaLeitura
import com.athenes.ui.theme.AthenesPrimary

/**
 * Barra de Opções e Ferramentas Flutuante em Pílula (.rm-barra-blocos).
 * Idêntica ao Athenes Web (athenes_estudo_artigos.js e athenes_editor.css):
 * [ ← ] [ 💾 ] | [ ↶ ] [ 🗑 ] | [ ☰ ] [ ✏ ] [ 🖊 ] [ ⚬—⚬ ] [ ▱ ] [ 📝 ] [ ❝ ] | ● ● ● ● ● ●
 */
@Composable
fun ReaderSubBar(
    ferramentaAtiva: FerramentaLeitura,
    modoLinhaReta: Boolean,
    corAtiva: String,
    coresDisponiveis: List<String>,
    onVoltar: () -> Unit,
    onSalvar: () -> Unit,
    onDesfazer: () -> Unit,
    onLimparPagina: () -> Unit,
    onSelecionarFerramenta: (FerramentaLeitura) -> Unit,
    onAlternarModoLinhaReta: () -> Unit,
    onSelecionarCor: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(999.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE6E9EF)),
        shadowElevation = 3.dp,
        modifier = modifier
            .wrapContentWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 8.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // 1. Botão Voltar (chevron v deitado <)
            BotaoCircularBarra(
                onClick = onVoltar,
                contentDescription = "Voltar para Biblioteca"
            ) {
                Icon(
                    imageVector = Icons.Rounded.ChevronLeft,
                    contentDescription = null,
                    tint = Color(0xFF64748B),
                    modifier = Modifier.size(22.dp)
                )
            }

            // 2. Botão Salvar (💾) - Botão Primário Azul Marinho com Ícone Branco
            BotaoCircularBarra(
                onClick = onSalvar,
                contentDescription = "Salvar no Drive & Zotero",
                primario = true
            ) {
                Icon(
                    imageVector = Icons.Rounded.Save,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(17.dp)
                )
            }

            // Separador 1
            SeparadorBarra()

            // 3. Botão Desfazer (↶)
            BotaoCircularBarra(
                onClick = onDesfazer,
                contentDescription = "Desfazer Traço"
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.Undo,
                    contentDescription = null,
                    tint = Color(0xFF64748B),
                    modifier = Modifier.size(17.dp)
                )
            }

            // 4. Botão Limpar Riscos da Página (🗑)
            BotaoCircularBarra(
                onClick = onLimparPagina,
                contentDescription = "Limpar Riscos da Página"
            ) {
                Icon(
                    imageVector = Icons.Rounded.DeleteOutline,
                    contentDescription = null,
                    tint = Color(0xFF64748B),
                    modifier = Modifier.size(17.dp)
                )
            }

            // Separador 2
            SeparadorBarra()

            // 5. Modo Seleção de Texto / Cursor (☰ - Ícone de 4 linhas de texto)
            val ehSelecao = ferramentaAtiva == FerramentaLeitura.SELECAO
            BotaoCircularBarra(
                onClick = { onSelecionarFerramenta(FerramentaLeitura.SELECAO) },
                contentDescription = "Selecionar Texto no PDF",
                ativo = ehSelecao
            ) {
                IconeParagrafoTexto(
                    tint = if (ehSelecao) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(16.dp)
                )
            }

            // 6. Caneta Stylus / Desenho (✏)
            val ehCaneta = ferramentaAtiva == FerramentaLeitura.CANETA
            BotaoCircularBarra(
                onClick = { onSelecionarFerramenta(FerramentaLeitura.CANETA) },
                contentDescription = "Caneta de Desenho",
                ativo = ehCaneta
            ) {
                Icon(
                    imageVector = Icons.Rounded.Edit,
                    contentDescription = null,
                    tint = if (ehCaneta) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(16.dp)
                )
            }

            // 7. Marca-Texto Translúcido (🖊)
            val ehMarcador = ferramentaAtiva == FerramentaLeitura.MARCADOR
            BotaoCircularBarra(
                onClick = { onSelecionarFerramenta(FerramentaLeitura.MARCADOR) },
                contentDescription = "Marca-Texto Translúcido",
                ativo = ehMarcador
            ) {
                Icon(
                    imageVector = Icons.Rounded.Highlight,
                    contentDescription = null,
                    tint = if (ehMarcador) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(17.dp)
                )
            }

            // 8. Modo Linha Reta (⚬—⚬)
            val ehLinhaRetaAtiva = modoLinhaReta || ferramentaAtiva == FerramentaLeitura.LINHA_RETA
            BotaoCircularBarra(
                onClick = onAlternarModoLinhaReta,
                contentDescription = "Ativar Modo Linha Reta",
                ativo = ehLinhaRetaAtiva
            ) {
                IconeLinhaRetaConectada(
                    tint = if (ehLinhaRetaAtiva) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(16.dp)
                )
            }

            // 9. Borracha (▱)
            val ehBorracha = ferramentaAtiva == FerramentaLeitura.BORRACHA
            BotaoCircularBarra(
                onClick = { onSelecionarFerramenta(FerramentaLeitura.BORRACHA) },
                contentDescription = "Borracha",
                ativo = ehBorracha
            ) {
                Icon(
                    imageVector = Icons.Rounded.AutoFixNormal,
                    contentDescription = null,
                    tint = if (ehBorracha) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(17.dp)
                )
            }

            // 10. Nota Adesiva (📝)
            val ehNota = ferramentaAtiva == FerramentaLeitura.NOTA
            BotaoCircularBarra(
                onClick = { onSelecionarFerramenta(FerramentaLeitura.NOTA) },
                contentDescription = "Nota Adesiva",
                ativo = ehNota
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.StickyNote2,
                    contentDescription = null,
                    tint = if (ehNota) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(16.dp)
                )
            }

            // 11. Citação Direta Zotero (❝)
            val ehCitacao = ferramentaAtiva == FerramentaLeitura.CITACAO
            BotaoCircularBarra(
                onClick = { onSelecionarFerramenta(FerramentaLeitura.CITACAO) },
                contentDescription = "Nova Citação",
                ativo = ehCitacao
            ) {
                Icon(
                    imageVector = Icons.Rounded.FormatQuote,
                    contentDescription = null,
                    tint = if (ehCitacao) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(18.dp)
                )
            }

            // Separador 3
            SeparadorBarra()

            // 12. Paleta com as 6 Bolinhas de Cores Rápidas (.ath-cores-tinta)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(horizontal = 2.dp)
            ) {
                coresDisponiveis.forEach { hex ->
                    val ehAtiva = hex.equals(corAtiva, ignoreCase = true)
                    BolinhaCorTinta(
                        corHex = hex,
                        ativa = ehAtiva,
                        onClick = { onSelecionarCor(hex) }
                    )
                }
            }
        }
    }
}

/**
 * Botão Circular padrão do Athenes Web (.rm-ic-bt) de 36x36dp.
 */
@Composable
private fun BotaoCircularBarra(
    onClick: () -> Unit,
    contentDescription: String,
    ativo: Boolean = false,
    primario: Boolean = false,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val fundo = when {
        primario || ativo -> AthenesPrimary
        else -> Color.White
    }
    val bordaCor = when {
        primario || ativo -> AthenesPrimary
        else -> Color(0xFFE6E9EF)
    }

    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(36.dp)
            .shadow(
                elevation = if (primario || ativo) 3.dp else 0.5.dp,
                shape = CircleShape
            )
            .background(fundo, CircleShape)
            .border(1.dp, bordaCor, CircleShape)
    ) {
        content()
    }
}

/**
 * Separador Vertical (.rm-barra-sep)
 */
@Composable
private fun SeparadorBarra() {
    Box(
        modifier = Modifier
            .padding(horizontal = 3.dp)
            .width(1.dp)
            .height(22.dp)
            .background(Color(0xFFE6E9EF))
    )
}

/**
 * Bolinha de cor rápida (.ath-cor-dot):
 * Quando ativa, possui anel externo escuro #1F2733 e espaçamento branco com ponto central.
 */
@Composable
private fun BolinhaCorTinta(
    corHex: String,
    ativa: Boolean,
    onClick: () -> Unit
) {
    val cor = parseHexColor(corHex)

    Box(
        modifier = Modifier
            .size(if (ativa) 26.dp else 20.dp)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (ativa) {
            // Anel externo escuro #1F2733
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .border(2.dp, Color(0xFF1F2733), CircleShape)
            )
        }

        // Ponto de cor central
        Box(
            modifier = Modifier
                .size(if (ativa) 15.dp else 17.dp)
                .background(cor, CircleShape)
                .border(
                    width = if (ativa) 1.5.dp else 1.5.dp,
                    color = Color.White,
                    shape = CircleShape
                )
                .then(
                    if (!ativa) {
                        Modifier.border(0.8.dp, Color(0x33000000), CircleShape)
                    } else Modifier
                )
        )
    }
}

/**
 * Ícone SVG de 4 linhas de parágrafo / seleção de texto (exato ao web Athenes).
 */
@Composable
private fun IconeParagrafoTexto(tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val strokeW = 1.8.dp.toPx()
        val w = size.width
        val h = size.height

        // Linha 1
        drawLine(
            color = tint,
            start = Offset(1.5.dp.toPx(), h * 0.22f),
            end = Offset(w - 1.5.dp.toPx(), h * 0.22f),
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
        // Linha 2
        drawLine(
            color = tint,
            start = Offset(1.5.dp.toPx(), h * 0.44f),
            end = Offset(w - 1.5.dp.toPx(), h * 0.44f),
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
        // Linha 3
        drawLine(
            color = tint,
            start = Offset(1.5.dp.toPx(), h * 0.66f),
            end = Offset(w - 1.5.dp.toPx(), h * 0.66f),
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
        // Linha 4 (mais curta)
        drawLine(
            color = tint,
            start = Offset(1.5.dp.toPx(), h * 0.88f),
            end = Offset(w * 0.62f, h * 0.88f),
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
    }
}

/**
 * Ícone SVG de Linha Reta conectada por 2 pontos (exato ao web Athenes: <line/><circle/><circle/>).
 */
@Composable
private fun IconeLinhaRetaConectada(tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val strokeW = 2.dp.toPx()
        val r = 2.2.dp.toPx()
        val p1 = Offset(3.dp.toPx(), size.height - 3.dp.toPx())
        val p2 = Offset(size.width - 3.dp.toPx(), 3.dp.toPx())

        drawLine(
            color = tint,
            start = p1,
            end = p2,
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
        drawCircle(color = tint, radius = r, center = p1)
        drawCircle(color = tint, radius = r, center = p2)
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
        Color(0xFF314F79)
    }
}
