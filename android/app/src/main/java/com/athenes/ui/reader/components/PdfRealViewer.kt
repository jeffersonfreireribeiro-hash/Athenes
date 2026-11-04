package com.athenes.ui.reader.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lista = rememberLazyListState()
    val contagem by produceState<Int?>(initialValue = null, uri) {
        value = withContext(Dispatchers.IO) {
            runCatching { numeroPaginas(context, uri) }.getOrDefault(0)
        }
    }
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val largura = with(LocalDensity.current) { maxWidth.toPx().toInt() }.coerceIn(320, 1600)
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
                            Image(
                                bitmap = imagem!!.asImageBitmap(),
                                contentDescription = "Página ${indice + 1} do PDF",
                                modifier = Modifier.fillMaxWidth(),
                                contentScale = ContentScale.FillWidth
                            )
                        }
                    }
                    }
                }
            }
        }
    }
}
