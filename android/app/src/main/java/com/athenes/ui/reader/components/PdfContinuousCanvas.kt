package com.athenes.ui.reader.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.StickyNote2
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.*
import com.athenes.ui.reader.TextoSelecionadoPopup
import com.athenes.ui.theme.*

@Composable
fun PdfContinuousCanvas(
    artigo: ArtigoEstudoDetalhado,
    paginaAtual: Int,
    ferramentaAtiva: FerramentaLeitura,
    corAtiva: String,
    textoSelecionado: TextoSelecionadoPopup?,
    onTextoSelecionado: (String, Int, Float, Float) -> Unit,
    onFecharPopupSelecao: () -> Unit,
    onGrifarTexto: () -> Unit,
    onCriarCitacao: () -> Unit,
    onCriarNota: () -> Unit,
    onAdicionarTraco: (List<PontoTraco>) -> Unit,
    onPaginaAnterior: () -> Unit = {},
    onProximaPagina: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState()
    val context = LocalContext.current

    // Sincroniza scroll quando a página atual muda pelo painel esquerdo ou sub-bar
    LaunchedEffect(paginaAtual) {
        if (paginaAtual in 1..artigo.paginas.size) {
            listState.animateScrollToItem(paginaAtual - 1)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF1F5F9))
    ) {
        // Rolagem Contínua das Páginas do PDF
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 68.dp, bottom = 40.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            itemsIndexed(artigo.paginas) { index, pagina ->
                FolhaPdfRenderizada(
                    artigo = artigo,
                    pagina = pagina,
                    ferramentaAtiva = ferramentaAtiva,
                    corAtiva = corAtiva,
                    tracosPagina = artigo.tracos.filter { it.pagina == pagina.numero },
                    notasPagina = artigo.notas.filter { it.pagina == pagina.numero },
                    onTextoSelecionado = { texto ->
                        onTextoSelecionado(texto, pagina.numero, 0f, 0f)
                    },
                    onAdicionarTraco = onAdicionarTraco
                )
            }
        }

        // ========================================================
        // POPOVER FLUTUANTE DE SELEÇÃO DE TEXTO
        // Fiel ao mockup do usuário: [🟡 Grifar Texto] [99 + Citação Zotero] [📝 Criar Nota] [Copiar ABNT]
        // ========================================================
        if (textoSelecionado != null) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(24.dp),
                shadowElevation = 8.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(bottom = 60.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Botão 1: Grifar Texto com a cor ativa
                    val corDot = parseHexColor(corAtiva)
                    Button(
                        onClick = onGrifarTexto,
                        shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF8FAFC),
                            contentColor = AthenesTextDark
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(38.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .background(corDot, androidx.compose.foundation.shape.CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Grifar Texto", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Botão 2: + Citação Zotero
                    Button(
                        onClick = onCriarCitacao,
                        shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF8FAFC),
                            contentColor = AthenesTextDark
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(38.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.FormatQuote,
                            contentDescription = null,
                            tint = AthenesPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "+ Citação Zotero", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Botão 3: Criar Nota
                    Button(
                        onClick = onCriarNota,
                        shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF8FAFC),
                            contentColor = AthenesTextDark
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(38.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.StickyNote2,
                            contentDescription = null,
                            tint = Color(0xFFF59E0B),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Criar Nota", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Botão 4: Copiar ABNT
                    Button(
                        onClick = {
                            val refAbnt = "\"${textoSelecionado.texto}\" (${artigo.autores}, ${artigo.ano}, p. ${textoSelecionado.pagina})"
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("Citação ABNT", refAbnt)
                            clipboard.setPrimaryClip(clip)
                            Toast.makeText(context, "Citação copiada em formato ABNT!", Toast.LENGTH_SHORT).show()
                            onFecharPopupSelecao()
                        },
                        shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF8FAFC),
                            contentColor = AthenesTextDark
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(38.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.ContentCopy,
                            contentDescription = null,
                            tint = AthenesPrimary,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Copiar ABNT", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Fechar Popup
                    IconButton(
                        onClick = onFecharPopupSelecao,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Fechar Popover",
                            tint = AthenesTextMuted,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // ========================================================
        // INDICADOR FLUTUANTE DE PÁGINA (Ex.: < 1 / 33 >)
        // Discreto e elegante no canto inferior direito do canvas
        // ========================================================
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(999.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
            shadowElevation = 4.dp,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                IconButton(
                    onClick = onPaginaAnterior,
                    enabled = paginaAtual > 1,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChevronLeft,
                        contentDescription = "Página Anterior",
                        tint = if (paginaAtual > 1) AthenesPrimary else AthenesTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Text(
                    text = "$paginaAtual / ${artigo.totalPaginas}",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = AthenesPrimary
                    ),
                    modifier = Modifier.padding(horizontal = 4.dp)
                )

                IconButton(
                    onClick = onProximaPagina,
                    enabled = paginaAtual < artigo.totalPaginas,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChevronRight,
                        contentDescription = "Próxima Página",
                        tint = if (paginaAtual < artigo.totalPaginas) AthenesPrimary else AthenesTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun FolhaPdfRenderizada(
    artigo: ArtigoEstudoDetalhado,
    pagina: PaginaPdfInfo,
    ferramentaAtiva: FerramentaLeitura,
    corAtiva: String,
    tracosPagina: List<TracoDesenho>,
    notasPagina: List<NotaAdesiva>,
    onTextoSelecionado: (String) -> Unit,
    onAdicionarTraco: (List<PontoTraco>) -> Unit
) {
    var pontosAtuais = remember { mutableStateListOf<PontoTraco>() }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = 840.dp)
    ) {
        // Indicador do Topo da Folha
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 6.dp, start = 8.dp, end = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Página ${pagina.numero} de ${artigo.totalPaginas} — Folha do PDF",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 11.sp,
                    color = AthenesTextMuted,
                    fontWeight = FontWeight.Medium
                )
            )

            Text(
                text = "${tracosPagina.size} risco(s) · ${notasPagina.size} nota(s)",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 10.sp,
                    color = AthenesTextMuted
                )
            )
        }

        // Folha de Papel A4 com Sombra e Borda
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(elevation = 3.dp, shape = RoundedCornerShape(2.dp))
                .background(Color.White)
                .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(2.dp))
                .pointerInput(ferramentaAtiva, corAtiva) {
                    if (ferramentaAtiva == FerramentaLeitura.CANETA || ferramentaAtiva == FerramentaLeitura.MARCADOR) {
                        detectDragGestures(
                            onDragStart = { offset ->
                                pontosAtuais.clear()
                                pontosAtuais.add(PontoTraco(offset.x, offset.y))
                            },
                            onDrag = { change, _ ->
                                change.consume()
                                pontosAtuais.add(PontoTraco(change.position.x, change.position.y))
                            },
                            onDragEnd = {
                                if (pontosAtuais.isNotEmpty()) {
                                    onAdicionarTraco(pontosAtuais.toList())
                                    pontosAtuais.clear()
                                }
                            },
                            onDragCancel = {
                                pontosAtuais.clear()
                            }
                        )
                    }
                }
        ) {
            // Camada de Texto Acadêmico
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp)
            ) {
                // Cabeçalho Acadêmico do Artigo na Página 1
                if (pagina.numero == 1) {
                    Text(
                        text = artigo.titulo,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Black,
                            color = AthenesTextDark,
                            lineHeight = 28.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Autor: ${artigo.autores} — Publicado em ${artigo.ano} · DOI: ${artigo.zoteroConfig.doi}",
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = FontWeight.SemiBold,
                            color = AthenesPrimary,
                            fontSize = 11.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(Color(0xFFE2E8F0))
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Parágrafos do Artigo
                pagina.paragrafos.forEach { par ->
                    Text(
                        text = par,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontFamily = FontFamily.Serif,
                            fontSize = 14.5.sp,
                            lineHeight = 22.sp,
                            color = Color(0xFF1E293B)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                            .clickable {
                                onTextoSelecionado(par)
                            }
                    )
                }

                // Rodapé da Página do Artigo
                Spacer(modifier = Modifier.height(30.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Buildings 2020, 10, 36; doi:10.3390/buildings10020036",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 9.sp,
                            color = AthenesTextMuted
                        )
                    )
                    Text(
                        text = "${pagina.numero}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark
                        )
                    )
                }
            }

            // Camada de Risco / Anotações Caneta e Marca-Texto (Canvas sobre a folha)
            Canvas(modifier = Modifier.matchParentSize()) {
                // Desenhar traços já persistidos
                tracosPagina.forEach { traco ->
                    val cor = parseHexColor(traco.corHex).copy(
                        alpha = if (traco.ehMarcaTexto) 0.38f else 1.0f
                    )
                    if (traco.pontos.size > 1) {
                        val path = Path().apply {
                            moveTo(traco.pontos.first().x, traco.pontos.first().y)
                            for (p in traco.pontos.drop(1)) {
                                lineTo(p.x, p.y)
                            }
                        }
                        drawPath(
                            path = path,
                            color = cor,
                            style = Stroke(
                                width = traco.espessura,
                                cap = StrokeCap.Round,
                                join = StrokeJoin.Round
                            )
                        )
                    }
                }

                // Desenhar traço em tempo real sendo desenhado pelo usuário
                if (pontosAtuais.size > 1) {
                    val ehMarca = (ferramentaAtiva == FerramentaLeitura.MARCADOR)
                    val corAtual = parseHexColor(corAtiva).copy(alpha = if (ehMarca) 0.38f else 1.0f)
                    val pathAtual = Path().apply {
                        moveTo(pontosAtuais.first().x, pontosAtuais.first().y)
                        for (p in pontosAtuais.drop(1)) {
                            lineTo(p.x, p.y)
                        }
                    }
                    drawPath(
                        path = pathAtual,
                        color = corAtual,
                        style = Stroke(
                            width = if (ehMarca) 18f else 3f,
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                }
            }

            // Camada de Notas Adesivas fixadas nesta página
            notasPagina.forEach { nota ->
                val corNota = parseHexColor(nota.corHex)
                Surface(
                    color = Color(0xFFFEF3C7),
                    shape = RoundedCornerShape(4.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, corNota),
                    shadowElevation = 2.dp,
                    modifier = Modifier
                        .padding(top = 16.dp, end = 16.dp)
                        .align(Alignment.TopEnd)
                        .widthIn(max = 200.dp)
                ) {
                    Column(modifier = Modifier.padding(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.StickyNote2,
                                contentDescription = null,
                                tint = corNota,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = nota.titulo,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    color = AthenesTextDark
                                )
                            )
                        }
                        Text(
                            text = nota.texto,
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 9.sp,
                                color = AthenesTextDark
                            )
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}
