package com.athenes.ui.reader.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Article
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.PaginaPdfInfo
import com.athenes.ui.theme.*

@Composable
fun PainelEsquerdoLeitura(
    artigos: List<ArtigoEstudoDetalhado>,
    artigoAtivo: ArtigoEstudoDetalhado,
    filtroArtigos: String,
    paginaAtiva: Int,
    onFiltroArtigosAlterado: (String) -> Unit,
    onSelecionarArtigo: (String) -> Unit,
    onSelecionarPagina: (Int) -> Unit,
    onSyncZoteroClick: () -> Unit = {},
    onNovoArtigoClick: () -> Unit = {},
    onNovaFolhaExtraClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color(0xFFF8FAFC),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = modifier
            .width(280.dp)
            .fillMaxHeight()
    ) {
        Column(modifier = Modifier.fillMaxSize()) {

            // ========================================================
            // METADE SUPERIOR (50%): ARTIGOS DO ZOTERO
            // ========================================================
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(10.dp)
            ) {
                // Cabeçalho da Seção Zotero
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "ARTIGOS DO ZOTERO (${artigos.size})",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark,
                            fontSize = 11.sp,
                            letterSpacing = 0.5.sp
                        )
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        // Botão Sync
                        OutlinedButton(
                            onClick = onSyncZoteroClick,
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                            modifier = Modifier.height(24.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = AthenesPrimary
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Sync,
                                contentDescription = "Sincronizar Zotero",
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(text = "Sync", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }

                        // Botão + Artigo
                        Button(
                            onClick = onNovoArtigoClick,
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                            modifier = Modifier.height(24.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AthenesPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Text(text = "+ Artigo", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Campo de Busca / Filtragem
                OutlinedTextField(
                    value = filtroArtigos,
                    onValueChange = onFiltroArtigosAlterado,
                    placeholder = {
                        Text(
                            text = "Filtrar artigos da biblioteca...",
                            fontSize = 11.sp,
                            color = AthenesTextMuted
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Rounded.Search,
                            contentDescription = null,
                            tint = AthenesTextMuted,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = AthenesPrimary,
                        unfocusedBorderColor = Color(0xFFE2E8F0)
                    ),
                    textStyle = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Lista de Artigos
                val artigosFiltrados = artigos.filter {
                    filtroArtigos.isBlank() ||
                            it.titulo.contains(filtroArtigos, ignoreCase = true) ||
                            it.autores.contains(filtroArtigos, ignoreCase = true)
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(artigosFiltrados, key = { it.id }) { art ->
                        val ehAtivo = art.id == artigoAtivo.id
                        Surface(
                            onClick = { onSelecionarArtigo(art.id) },
                            color = if (ehAtivo) Color(0xFFEFF6FF) else Color.White,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                width = if (ehAtivo) 1.5.dp else 1.dp,
                                color = if (ehAtivo) AthenesPrimary else Color(0xFFE2E8F0)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Rounded.Article,
                                        contentDescription = null,
                                        tint = if (ehAtivo) AthenesPrimary else AthenesTextDark,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = art.titulo,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontWeight = if (ehAtivo) FontWeight.Bold else FontWeight.SemiBold,
                                            color = if (ehAtivo) AthenesPrimary else AthenesTextDark,
                                            fontSize = 11.sp
                                        ),
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "(${art.autores}, ${art.ano})",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 10.sp,
                                            color = AthenesTextMuted
                                        )
                                    )

                                    if (art.citacoes.isNotEmpty()) {
                                        Surface(
                                            color = Color(0xFFF1F5F9),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = "${art.citacoes.size} citação${if (art.citacoes.size > 1) "ões" else ""}",
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = AthenesPrimary
                                                ),
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Divisor Horizontal entre as duas seções
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFE2E8F0))
            )

            // ========================================================
            // METADE INFERIOR (50%): PÁGINAS DO PDF
            // ========================================================
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(10.dp)
            ) {
                // Cabeçalho da Seção Páginas
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "PÁGINAS DO PDF (${artigoAtivo.paginas.size})",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark,
                            fontSize = 11.sp,
                            letterSpacing = 0.5.sp
                        )
                    )

                    OutlinedButton(
                        onClick = onNovaFolhaExtraClick,
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                        modifier = Modifier.height(24.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = AthenesPrimary
                        )
                    ) {
                        Text(text = "+ Folha Extra", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Lista de Páginas do PDF
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(artigoAtivo.paginas, key = { it.numero }) { pag ->
                        val ehAtiva = pag.numero == paginaAtiva
                        val qtdRiscos = artigoAtivo.tracos.count { it.pagina == pag.numero }
                        val qtdNotas = artigoAtivo.notas.count { it.pagina == pag.numero }
                        val qtdCitacoes = artigoAtivo.citacoes.count { it.pagina == pag.numero }

                        Surface(
                            onClick = { onSelecionarPagina(pag.numero) },
                            color = if (ehAtiva) Color(0xFFEFF6FF) else Color.White,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                width = if (ehAtiva) 1.5.dp else 1.dp,
                                color = if (ehAtiva) AthenesPrimary else Color(0xFFE2E8F0)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Página ${pag.numero} — Folha do PDF",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontWeight = if (ehAtiva) FontWeight.Bold else FontWeight.SemiBold,
                                            color = if (ehAtiva) AthenesPrimary else AthenesTextDark,
                                            fontSize = 11.sp
                                        )
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "$qtdRiscos risco(s) · $qtdNotas nota(s) · $qtdCitacoes citação(ões)",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 9.sp,
                                            color = AthenesTextMuted
                                        )
                                    )
                                }

                                if (ehAtiva) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(AthenesPrimary, RoundedCornerShape(4.dp))
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
