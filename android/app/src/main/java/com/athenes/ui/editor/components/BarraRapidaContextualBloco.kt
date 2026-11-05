// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.R
import com.athenes.ui.editor.BlocoEditor
import com.athenes.ui.editor.TipoBlocoEditor
import com.athenes.ui.theme.*

private val NunitoFolha = FontFamily.SansSerif
private val CorCinzaIcone = Color(0xFF64748B)
private val CorPerigo = Color(0xFFDC2626)

/**
 * Barra rápida contextual flutuante em formato pill com ícones de traço.
 * Substitui integralmente qualquer barra de formatação amadora embutida dentro de campos de texto.
 *
 * Ações:
 * 1. Mover cima
 * 2. Mover baixo
 * 3. Duplicar
 * 4. Citar
 * 5. Excluir
 * 6. Desmarcar
 */
@Composable
fun BarraRapidaContextualBloco(
    bloco: BlocoEditor,
    onMoverCima: () -> Unit,
    onMoverBaixo: () -> Unit,
    onDuplicar: () -> Unit,
    onCitar: () -> Unit,
    onExcluir: () -> Unit,
    onDesmarcar: () -> Unit,
    podeMoverCima: Boolean = true,
    podeMoverBaixo: Boolean = true,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = Color.White,
        shadowElevation = 8.dp,
        border = BorderStroke(1.2.dp, Color(0xFFCBD5E1)),
        modifier = modifier
            .wrapContentSize()
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
        ) {
            // Crachá identificador compacto do tipo de bloco
            Surface(
                color = AthenesPrimarySoft,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.padding(end = 4.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = rotuloCurtoBloco(bloco),
                        style = TextStyle(
                            fontFamily = NunitoFolha,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = AthenesPrimary,
                            letterSpacing = 0.5.sp
                        )
                    )
                }
            }

            // Separador
            SeparadorPill()

            // 1. Mover para cima
            BotaoAcaoPill(
                icone = Icons.Rounded.ArrowUpward,
                descricao = "Mover bloco para cima",
                onClick = onMoverCima,
                habilitado = podeMoverCima,
                tint = if (podeMoverCima) AthenesPrimary else CorCinzaIcone.copy(alpha = 0.4f)
            )

            // 2. Mover para baixo
            BotaoAcaoPill(
                icone = Icons.Rounded.ArrowDownward,
                descricao = "Mover bloco para baixo",
                onClick = onMoverBaixo,
                habilitado = podeMoverBaixo,
                tint = if (podeMoverBaixo) AthenesPrimary else CorCinzaIcone.copy(alpha = 0.4f)
            )

            // Separador
            SeparadorPill()

            // 3. Duplicar
            BotaoAcaoPill(
                icone = Icons.Rounded.ContentCopy,
                descricao = "Duplicar bloco",
                onClick = onDuplicar,
                tint = CorCinzaIcone
            )

            // 4. Citar
            BotaoAcaoPill(
                icone = Icons.Rounded.FormatQuote,
                descricao = "Citar obra acadêmica",
                onClick = onCitar,
                tint = AthenesPrimary
            )

            // Separador
            SeparadorPill()

            // 5. Excluir bloco
            BotaoAcaoPill(
                icone = Icons.Rounded.DeleteOutline,
                descricao = "Excluir bloco",
                onClick = onExcluir,
                tint = CorPerigo
            )

            // 6. Desmarcar
            BotaoAcaoPill(
                icone = Icons.Rounded.Close,
                descricao = "Desmarcar seleção",
                onClick = onDesmarcar,
                tint = CorCinzaIcone
            )
        }
    }
}

@Composable
private fun BotaoAcaoPill(
    icone: ImageVector,
    descricao: String,
    onClick: () -> Unit,
    habilitado: Boolean = true,
    tint: Color = AthenesPrimary
) {
    IconButton(
        onClick = onClick,
        enabled = habilitado,
        modifier = Modifier
            .size(36.dp)
            .semantics { contentDescription = descricao }
    ) {
        Icon(
            imageVector = icone,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(19.dp)
        )
    }
}

@Composable
private fun SeparadorPill() {
    Box(
        modifier = Modifier
            .padding(horizontal = 2.dp)
            .width(1.dp)
            .height(20.dp)
            .background(Color(0xFFE2E8F0))
    )
}

/** Rótulo textual do crachá do bloco */
fun rotuloCurtoBloco(bloco: BlocoEditor): String = when (bloco.tipo) {
    TipoBlocoEditor.TITULO -> "TÍTULO ${bloco.nivelTitulo}"
    TipoBlocoEditor.PARAGRAFO -> "PARÁGRAFO"
    TipoBlocoEditor.CITACAO -> "CITAÇÃO LONGA"
    TipoBlocoEditor.FIGURA -> "FIGURA"
    TipoBlocoEditor.TABELA -> "TABELA"
    TipoBlocoEditor.QUADRO -> "QUADRO"
    TipoBlocoEditor.FORMULA -> "FÓRMULA"
    TipoBlocoEditor.LISTA -> "LISTA"
    TipoBlocoEditor.SUMARIO -> "SUMÁRIO"
    TipoBlocoEditor.LISTA_ILUSTRACOES -> "ILUSTRAÇÕES"
    TipoBlocoEditor.REFERENCIAS -> "REFERÊNCIAS"
    TipoBlocoEditor.CAMPOS -> "CAMPOS"
    TipoBlocoEditor.QUEBRA_PAGINA -> "QUEBRA A4"
    TipoBlocoEditor.ESPACO -> "ESPAÇO"
    TipoBlocoEditor.DIVISOR -> "DIVISOR"
}

@Preview(name = "Barra Rápida Contextual Pill", showBackground = true)
@Composable
fun BarraRapidaContextualBlocoPreview() {
    AthenesTheme {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFEEF2F6))
                .padding(24.dp)
        ) {
            BarraRapidaContextualBloco(
                bloco = BlocoEditor(
                    tipo = TipoBlocoEditor.PARAGRAFO,
                    texto = "Texto selecionado para edição com rigor acadêmico."
                ),
                onMoverCima = {},
                onMoverBaixo = {},
                onDuplicar = {},
                onCitar = {},
                onExcluir = {},
                onDesmarcar = {}
            )
        }
    }
}
