package com.athenes.ui.reader.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.StickyNote2
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.athenes.core.model.FerramentaLeitura
import com.athenes.core.model.PontoTraco
import com.athenes.core.model.TracoDesenho
import com.athenes.core.model.NotaAdesiva

private val cachePaginas = object : LruCache<String, Bitmap>(24 * 1024) {
    override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount / 1024
}

private fun numeroPaginas(context: Context, uri: Uri): Int {
    val descritor = context.contentResolver.openFileDescriptor(uri, "r") ?: return 0
    return descritor.use { PdfRenderer(it).use { renderer -> renderer.pageCount } }
}

private fun renderizarPagina(context: Context, uri: Uri, indice: Int, largura: Int): Bitmap {
    val chave = "$uri:$indice:$largura"
    synchronized(cachePaginas) { cachePaginas.get(chave) }?.let { return it }
    val descritor = context.contentResolver.openFileDescriptor(uri, "r")
        ?: error("PDF indisponível")
    val bitmap = descritor.use { arquivo ->
        PdfRenderer(arquivo).use { renderer ->
            renderer.openPage(indice).use { pagina ->
                val altura = (largura.toFloat() * pagina.height / pagina.width).toInt().coerceAtLeast(1)
                Bitmap.createBitmap(largura, altura, Bitmap.Config.ARGB_8888).also {
                    it.eraseColor(android.graphics.Color.WHITE)
                    pagina.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                }
            }
        }
    }
    synchronized(cachePaginas) { cachePaginas.put(chave, bitmap) }
    return bitmap
}

@Composable
fun PdfRealViewer(
    uri: Uri,
    paginaAtual: Int,
    onTotalPaginas: (Int) -> Unit,
    ferramenta: FerramentaLeitura,
    cor: String,
    modoSomenteStylus: Boolean,
    tracos: List<TracoDesenho>,
    notas: List<NotaAdesiva>,
    onAdicionarTraco: (Int, List<PontoTraco>) -> Unit,
    onApagarTraco: (Int, Float, Float) -> Unit,
    onStylusDetectada: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lista = rememberLazyListState()
    var zoom by rememberSaveable(uri.toString()) { mutableFloatStateOf(1f) }
    var notaAberta by remember { mutableStateOf<NotaAdesiva?>(null) }
    val contagem by produceState<Int?>(initialValue = null, uri) {
        value = withContext(Dispatchers.IO) {
            runCatching { numeroPaginas(context, uri) }.getOrDefault(0)
        }
    }
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val larguraDisponivel = maxWidth
        val largura = with(LocalDensity.current) { (maxWidth * zoom).toPx().toInt() }.coerceIn(320, 2400)
        when (val total = contagem) {
            null -> CircularProgressIndicator(Modifier.align(Alignment.Center))
            0 -> Text("Não foi possível abrir este PDF. Selecione outro arquivo.", modifier = Modifier.align(Alignment.Center))
            else -> {
                LaunchedEffect(total) { onTotalPaginas(total) }
                LaunchedEffect(paginaAtual, total) {
                    if (paginaAtual in 1..total) lista.animateScrollToItem(paginaAtual - 1)
                }
                LazyColumn(
                    state = lista,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    items((0 until total).toList(), key = { it }, contentType = { "pagina_pdf" }) { indice ->
                    val imagem by produceState<Bitmap?>(initialValue = null, uri, indice, largura) {
                        value = withContext(Dispatchers.IO) {
                            runCatching { renderizarPagina(context, uri, indice, largura) }.getOrNull()
                        }
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Página ${indice + 1} de $total", style = MaterialTheme.typography.labelSmall)
                        Spacer(Modifier.height(8.dp))
                        if (imagem == null) {
                            CircularProgressIndicator()
                        } else {
                            Box(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
                                val bitmap = imagem!!
                                val larguraPagina = larguraDisponivel * zoom
                                Box(Modifier.width(larguraPagina).aspectRatio(bitmap.width.toFloat() / bitmap.height)) {
                                Image(
                                    bitmap = bitmap.asImageBitmap(),
                                    contentDescription = "Página ${indice + 1} do PDF",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.FillWidth
                                )
                                TintaPdf(
                                    pagina = indice + 1,
                                    ferramenta = ferramenta,
                                    cor = cor,
                                    modoSomenteStylus = modoSomenteStylus,
                                    tracos = tracos.filter { it.pagina == indice + 1 },
                                    onAdicionarTraco = onAdicionarTraco,
                                    onApagarTraco = onApagarTraco,
                                    onStylusDetectada = onStylusDetectada,
                                    modifier = Modifier.matchParentSize()
                                )
                                BoxWithConstraints(Modifier.matchParentSize()) {
                                    notas.filter { it.pagina == indice + 1 }.forEach { nota ->
                                        IconButton(
                                            onClick = { notaAberta = nota },
                                            modifier = Modifier.offset(
                                                x = maxWidth * (nota.xPct / 100f),
                                                y = maxHeight * (nota.yPct / 100f)
                                            )
                                        ) {
                                            Icon(
                                                Icons.AutoMirrored.Rounded.StickyNote2,
                                                contentDescription = "Nota: ${nota.titulo}",
                                                tint = parseHexColor(nota.corHex)
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
            }
        }
        notaAberta?.let { nota ->
            AlertDialog(
                onDismissRequest = { notaAberta = null },
                title = { Text(nota.titulo) },
                text = { Text(nota.texto) },
                confirmButton = { TextButton(onClick = { notaAberta = null }) { Text("Fechar") } }
            )
        }
        Row(
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(onClick = { zoom = (zoom - 0.25f).coerceAtLeast(0.75f) }, enabled = zoom > 0.75f) {
                Text("− Zoom")
            }
            Button(onClick = { zoom = (zoom + 0.25f).coerceAtMost(2f) }, enabled = zoom < 2f) {
                Text("+ Zoom")
            }
        }
    }
}

@Composable
private fun TintaPdf(
    pagina: Int,
    ferramenta: FerramentaLeitura,
    cor: String,
    modoSomenteStylus: Boolean,
    tracos: List<TracoDesenho>,
    onAdicionarTraco: (Int, List<PontoTraco>) -> Unit,
    onApagarTraco: (Int, Float, Float) -> Unit,
    onStylusDetectada: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pontosAtuais = remember(pagina) { mutableStateListOf<PontoTraco>() }
    val desenhando = ferramenta in setOf(
        FerramentaLeitura.CANETA,
        FerramentaLeitura.MARCADOR,
        FerramentaLeitura.LINHA_RETA,
        FerramentaLeitura.BORRACHA
    )
    val apontador = if (desenhando) {
        Modifier.pointerInput(pagina, ferramenta, cor, modoSomenteStylus) {
            awaitEachGesture {
                val inicio = awaitFirstDown(pass = PointerEventPass.Initial, requireUnconsumed = false)
                if (inicio.type == PointerType.Stylus || inicio.type == PointerType.Eraser) onStylusDetectada()
                if (modoSomenteStylus && inicio.type == PointerType.Touch) return@awaitEachGesture
                val borracha = ferramenta == FerramentaLeitura.BORRACHA || inicio.type == PointerType.Eraser
                fun normalizar(x: Float, y: Float) = PontoTraco(
                    (x / size.width).coerceIn(0f, 1f),
                    (y / size.height).coerceIn(0f, 1f)
                )
                inicio.consume()
                val primeiro = normalizar(inicio.position.x, inicio.position.y)
                if (borracha) onApagarTraco(pagina, primeiro.x, primeiro.y)
                else {
                    pontosAtuais.clear()
                    pontosAtuais.add(primeiro)
                }
                while (true) {
                    val evento = awaitPointerEvent(pass = PointerEventPass.Initial)
                    val mudanca = evento.changes.firstOrNull { it.id == inicio.id } ?: break
                    if (!mudanca.pressed) break
                    mudanca.consume()
                    val ponto = normalizar(mudanca.position.x, mudanca.position.y)
                    if (borracha) onApagarTraco(pagina, ponto.x, ponto.y)
                    else pontosAtuais.add(ponto)
                }
                if (!borracha && pontosAtuais.isNotEmpty()) {
                    onAdicionarTraco(pagina, pontosAtuais.toList())
                    pontosAtuais.clear()
                }
            }
        }
    } else Modifier
    Canvas(modifier.then(apontador)) {
        fun riscar(pontos: List<PontoTraco>, tinta: Color, espessura: Float, reta: Boolean) {
            if (pontos.isEmpty()) return
            val caminho = Path().apply {
                moveTo(pontos.first().x * size.width, pontos.first().y * size.height)
                val seguintes = if (reta && pontos.size > 1) listOf(pontos.last()) else pontos.drop(1)
                seguintes.forEach { lineTo(it.x * size.width, it.y * size.height) }
            }
            drawPath(caminho, tinta, style = Stroke(width = espessura, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
        tracos.forEach { traco ->
            riscar(
                traco.pontos,
                parseHexColor(traco.corHex).copy(alpha = if (traco.ehMarcaTexto) 0.38f else 1f),
                traco.espessura,
                traco.ehLinhaReta
            )
        }
        riscar(
            pontosAtuais,
            parseHexColor(cor).copy(alpha = if (ferramenta == FerramentaLeitura.MARCADOR) 0.38f else 1f),
            if (ferramenta == FerramentaLeitura.MARCADOR) 18f else 3f,
            ferramenta == FerramentaLeitura.LINHA_RETA
        )
    }
}
