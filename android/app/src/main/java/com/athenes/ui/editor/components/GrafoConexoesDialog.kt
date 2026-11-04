package com.athenes.ui.editor.components

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.athenes.core.citacao.GrafoConexoes
import com.athenes.core.citacao.NoConexao
import com.athenes.core.citacao.ReferenciaAcademica
import com.athenes.core.citacao.TipoNoConexao
import com.athenes.ui.theme.AthenesPrimary
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

private fun corNo(tipo: TipoNoConexao, ausente: Boolean): Color = if (ausente) Color(0xFF94A3B8) else when (tipo) {
    TipoNoConexao.OBRA -> AthenesPrimary
    TipoNoConexao.AUTOR -> Color(0xFF3B82F6)
    TipoNoConexao.TEMA -> Color(0xFF10B981)
    TipoNoConexao.ANO -> Color(0xFFF59E0B)
    TipoNoConexao.VEICULO -> Color(0xFF8B5CF6)
    TipoNoConexao.LOCAL -> Color(0xFF64748B)
}

private fun posicoes(nos: List<NoConexao>, tamanho: IntSize): Map<String, Offset> {
    if (tamanho.width <= 0 || tamanho.height <= 0) return emptyMap()
    val centroX = tamanho.width / 2f
    val centroY = tamanho.height / 2f
    val menor = minOf(tamanho.width, tamanho.height).toFloat()
    return nos.mapIndexed { indice, no ->
        val raio = when (no.tipo) {
            TipoNoConexao.OBRA -> 0.18f
            TipoNoConexao.AUTOR -> 0.30f
            TipoNoConexao.TEMA -> 0.39f
            else -> 0.45f
        } * menor
        val angulo = 2.0 * PI * indice / nos.size - PI / 2
        no.id to Offset(centroX + cos(angulo).toFloat() * raio, centroY + sin(angulo).toFloat() * raio)
    }.toMap()
}

@Composable
fun GrafoConexoesDialog(referencias: List<ReferenciaAcademica>, onFechar: () -> Unit) {
    val grafo = remember(referencias) { GrafoConexoes.construir(referencias) }
    var filtro by remember { mutableStateOf<TipoNoConexao?>(null) }
    var selecionado by remember { mutableStateOf<NoConexao?>(null) }
    var tamanho by remember { mutableStateOf(IntSize.Zero) }
    val densidade = LocalDensity.current
    val nosVisiveis = remember(grafo, filtro) { grafo.nos.filter { filtro == null || it.tipo == filtro || it.tipo == TipoNoConexao.OBRA } }
    val pos = remember(nosVisiveis, tamanho) { posicoes(nosVisiveis, tamanho) }

    Dialog(onDismissRequest = onFechar, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(modifier = Modifier.fillMaxWidth().widthIn(max = 900.dp).padding(16.dp), shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
                Text("Conexões bibliográficas", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("${grafo.totalReferencias} obras · completude ${grafo.indiceCompletude}%", style = MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = filtro == null, onClick = { filtro = null }, label = { Text("Todos") })
                    TipoNoConexao.entries.forEach { tipo ->
                        FilterChip(selected = filtro == tipo, onClick = { filtro = tipo }, label = { Text(tipo.name.lowercase().replaceFirstChar(Char::uppercase)) })
                    }
                }
                if (grafo.nos.isEmpty()) {
                    Text("Nenhuma referência vinculada para gerar conexões.", modifier = Modifier.padding(vertical = 24.dp))
                } else {
                    Canvas(Modifier.fillMaxWidth().height(320.dp).onSizeChanged { tamanho = it }.pointerInput(pos) {
                        detectTapGestures { toque ->
                            val proximo = pos.minByOrNull { (_, ponto) -> (ponto - toque).getDistance() }
                            selecionado = proximo?.takeIf { (_, ponto) -> (ponto - toque).getDistance() <= 28.dp.toPx() }
                                ?.let { (id, _) -> grafo.nos.find { it.id == id } }
                        }
                    }) {
                        val ids = pos.keys
                        grafo.arestas.filter { it.origem in ids && it.destino in ids }.forEach { a ->
                            drawLine(if (a.tipo == "coautoria") Color(0xAA3B82F6) else Color(0xFFCBD5E1),
                                pos.getValue(a.origem), pos.getValue(a.destino), strokeWidth = if (a.tipo == "coautoria") 2.dp.toPx() else 1.dp.toPx())
                        }
                        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                            color = Color(0xFF1F2733).toArgb()
                            textSize = with(densidade) { 10.sp.toPx() }
                            textAlign = Paint.Align.CENTER
                        }
                        nosVisiveis.forEach { no ->
                            val ponto = pos[no.id] ?: return@forEach
                            val raio = if (no.tipo == TipoNoConexao.OBRA) 8.dp.toPx() else 6.dp.toPx()
                            drawCircle(corNo(no.tipo, no.dadoAusente), raio, ponto)
                            drawContext.canvas.nativeCanvas.drawText(no.rotulo.take(18), ponto.x, ponto.y + raio + 12.dp.toPx(), paint)
                        }
                    }
                    selecionado?.let { no ->
                        Text("${no.rotulo} · ${no.tipo.name.lowercase()}${if (no.dadoAusente) " · dado ausente" else ""}",
                            style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 8.dp))
                    }
                    Text("Nós visíveis", style = MaterialTheme.typography.titleSmall)
                    LazyColumn(Modifier.fillMaxWidth().height(180.dp)) {
                        items(nosVisiveis, key = { it.id }) { no ->
                            TextButton(onClick = { selecionado = no }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                Text("${no.rotulo} · ${no.tipo.name.lowercase()}", modifier = Modifier.fillMaxWidth())
                            }
                        }
                    }
                }
                TextButton(onClick = onFechar, modifier = Modifier.align(androidx.compose.ui.Alignment.End)) { Text("Fechar") }
            }
        }
    }
}
