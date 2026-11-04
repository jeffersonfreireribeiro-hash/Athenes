package com.athenes.ui.editor.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.automirrored.rounded.Redo
import androidx.compose.material.icons.automirrored.rounded.Undo
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.athenes.ui.editor.TipoBlocoEditor
import com.athenes.ui.theme.AthenesPrimary

private val CinzaIcone = Color(0xFF64748B)

/**
 * Barra de inserção de blocos, fixa logo abaixo da barra de título (recolhe junto com ela ao rolar).
 * Só ícones de traço, alvos de 44 dp, rolagem horizontal quando não cabe.
 * [↶][↷] | [T][☰][🖼][▤][❝][Σ][—] | [Citar]
 */
@Composable
fun EditorBarraBlocos(
    onDesfazer: () -> Unit,
    onRefazer: () -> Unit,
    onAdicionarBloco: (TipoBlocoEditor) -> Unit,
    onCitar: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color.White,
        shadowElevation = 3.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Column {
            HorizontalDivider(color = Color(0xFFE2E8F0))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 6.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                BotaoBarra(onDesfazer, "Desfazer") { Icon(Icons.AutoMirrored.Rounded.Undo, null, tint = CinzaIcone) }
                BotaoBarra(onRefazer, "Refazer") { Icon(Icons.AutoMirrored.Rounded.Redo, null, tint = CinzaIcone) }
                Separador()

                BotaoBloco(Icons.Rounded.Title, "Inserir título", TipoBlocoEditor.TITULO, onAdicionarBloco)
                BotaoBarra({ onAdicionarBloco(TipoBlocoEditor.PARAGRAFO) }, "Inserir parágrafo") {
                    IconeLinhasParagrafo(tint = CinzaIcone, modifier = Modifier.size(18.dp))
                }
                BotaoBloco(Icons.Rounded.Image, "Inserir figura", TipoBlocoEditor.FIGURA, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.TableChart, "Inserir tabela", TipoBlocoEditor.TABELA, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.ViewModule, "Inserir quadro", TipoBlocoEditor.QUADRO, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.FormatQuote, "Inserir citação direta longa", TipoBlocoEditor.CITACAO, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.Functions, "Inserir fórmula", TipoBlocoEditor.FORMULA, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.FormatListBulleted, "Inserir lista", TipoBlocoEditor.LISTA, onAdicionarBloco)
                BotaoBloco(Icons.AutoMirrored.Rounded.MenuBook, "Inserir sumário", TipoBlocoEditor.SUMARIO, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.Collections, "Inserir lista de ilustrações", TipoBlocoEditor.LISTA_ILUSTRACOES, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.FormatListNumbered, "Inserir referências", TipoBlocoEditor.REFERENCIAS, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.InsertPageBreak, "Inserir quebra de página", TipoBlocoEditor.QUEBRA_PAGINA, onAdicionarBloco)
                BotaoBloco(Icons.Rounded.HorizontalRule, "Inserir divisor", TipoBlocoEditor.DIVISOR, onAdicionarBloco)
                Separador()

                // Ação de destaque: citar obra da biblioteca no ponto atual
                FilledTonalIconButton(
                    onClick = onCitar,
                    modifier = Modifier.size(44.dp),
                    colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = AthenesPrimary)
                ) {
                    Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = "Citar da biblioteca", tint = Color.White, modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

@Composable
private fun BotaoBloco(
    icone: ImageVector,
    descricao: String,
    tipo: TipoBlocoEditor,
    onAdicionar: (TipoBlocoEditor) -> Unit
) {
    BotaoBarra({ onAdicionar(tipo) }, descricao) { Icon(icone, null, tint = CinzaIcone) }
}

@Composable
private fun BotaoBarra(onClick: () -> Unit, descricao: String, conteudo: @Composable () -> Unit) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(44.dp).semantics { contentDescription = descricao }
    ) {
        Box(modifier = Modifier.size(22.dp), contentAlignment = Alignment.Center) { conteudo() }
    }
}

@Composable
private fun Separador() {
    Box(
        modifier = Modifier
            .padding(horizontal = 4.dp)
            .width(1.dp)
            .height(24.dp)
            .background(Color(0xFFE2E8F0))
    )
}

/** Ícone de 4 linhas de texto (parágrafo), igual ao da web. */
@Composable
private fun IconeLinhasParagrafo(tint: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val traco = 1.8.dp.toPx()
        val m = 1.5.dp.toPx()
        listOf(0.22f to 1f, 0.44f to 1f, 0.66f to 1f, 0.88f to 0.62f).forEach { (y, frac) ->
            drawLine(tint, Offset(m, h * y), Offset(if (frac == 1f) w - m else w * frac, h * y), traco, StrokeCap.Round)
        }
    }
}
