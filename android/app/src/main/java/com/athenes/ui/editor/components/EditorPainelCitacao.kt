package com.athenes.ui.editor.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FormatQuote
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.citacao.EstiloBibliografico
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.ui.theme.AthenesPrimary
import com.athenes.ui.theme.AthenesTextDark
import com.athenes.ui.theme.AthenesTextMuted

/**
 * Painel inferior "Citar" (sobreposição na própria tela, como as gavetas): lista a biblioteca de
 * artigos e insere (SOBRENOME, ano) no ponto atual do texto.
 */
@Composable
fun EditorPainelCitacao(
    onCitar: (ArtigoEstudoDetalhado) -> Unit,
    estilo: EstiloBibliografico,
    onEstiloAlterado: (EstiloBibliografico) -> Unit,
    onFechar: () -> Unit,
    modifier: Modifier = Modifier
) {
    val artigos by ArtigoEstudoRepository.compartilhado.artigos.collectAsState()
    var busca by remember { mutableStateOf("") }
    val filtrados = remember(busca, artigos) {
        if (busca.isBlank()) artigos
        else artigos.filter {
            it.titulo.contains(busca, ignoreCase = true) || it.autores.contains(busca, ignoreCase = true) ||
                it.chaveZotero.contains(busca, ignoreCase = true)
        }
    }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        shadowElevation = 12.dp,
        modifier = modifier.fillMaxWidth().widthIn(max = 640.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Citar da biblioteca",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = AthenesTextDark),
                    modifier = Modifier.weight(1f)
                )
                IconButton(onClick = onFechar, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = AthenesTextMuted)
                }
            }
            OutlinedTextField(
                value = busca,
                onValueChange = { busca = it },
                placeholder = { Text("Buscar por título, autor ou chave", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, tint = AthenesTextMuted) },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Text("Estilo de citação", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 10.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                EstiloBibliografico.entries.forEach { opcao ->
                    FilterChip(selected = estilo == opcao, onClick = { onEstiloAlterado(opcao) }, label = { Text(opcao.rotulo) })
                }
            }
            Spacer(Modifier.height(8.dp))
            LazyColumn(
                modifier = Modifier.heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(filtrados, key = { it.id }) { art ->
                    Surface(
                        onClick = { onCitar(art) },
                        color = Color(0xFFF8FAFC),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)
                    ) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.FormatQuote, contentDescription = null, tint = AthenesPrimary, modifier = Modifier.size(22.dp))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    art.titulo,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold, color = AthenesTextDark, fontSize = 13.sp),
                                    maxLines = 2, overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    "${art.autores} · ${art.ano}",
                                    style = MaterialTheme.typography.bodySmall.copy(color = AthenesTextMuted, fontSize = 11.sp),
                                    maxLines = 1, overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
                if (filtrados.isEmpty()) {
                    item { Text("Nenhuma obra encontrada.", color = AthenesTextMuted, fontSize = 13.sp, modifier = Modifier.padding(8.dp)) }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}
