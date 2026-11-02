package com.athenes.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.TipoDocumento
import com.athenes.ui.theme.*

@Composable
fun AthenesSearchBar(
    textoBusca: String,
    onBuscaAlterada: (String) -> Unit,
    tipoFiltro: TipoDocumento?,
    onTipoFiltroAlterado: (TipoDocumento?) -> Unit,
    onNovoDocumentoClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Campo de Busca com Estilo Soft UI
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(40.dp)
                    .background(AthenesSurface, shape = RoundedCornerShape(8.dp))
                    .border(1.dp, AthenesBorder, shape = RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Search,
                        contentDescription = "Buscar",
                        tint = AthenesTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(modifier = Modifier.weight(1f)) {
                        if (textoBusca.isEmpty()) {
                            Text(
                                text = "Pesquisar por título, autor, ou palavra-chave...",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    color = AthenesTextMuted,
                                    fontSize = 12.5.sp
                                )
                            )
                        }
                        BasicTextField(
                            value = textoBusca,
                            onValueChange = onBuscaAlterada,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(
                                color = AthenesText,
                                fontSize = 12.5.sp
                            ),
                            cursorBrush = SolidColor(AthenesPrimary),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (textoBusca.isNotEmpty()) {
                        Icon(
                            imageVector = Icons.Rounded.Clear,
                            contentDescription = "Limpar busca",
                            tint = AthenesTextMuted,
                            modifier = Modifier
                                .size(16.dp)
                                .clickable { onBuscaAlterada("") }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            // Botão "+ Novo Documento" Idêntico à Referência
            Button(
                onClick = onNovoDocumentoClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AthenesPrimary,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.height(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Add,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Novo Documento",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.5.sp
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Filtros Rápidos por Tipo de Trabalho
        val opcoes = listOf<TipoDocumento?>(null) + TipoDocumento.entries
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(opcoes) { opt ->
                val ativo = opt == tipoFiltro
                val rotulo = opt?.rotuloAmigavel ?: "Todos os Documentos"
                Box(
                    modifier = Modifier
                        .background(
                            color = if (ativo) AthenesPrimarySoft else AthenesSurface,
                            shape = RoundedCornerShape(999.dp)
                        )
                        .border(
                            width = 1.dp,
                            color = if (ativo) AthenesPrimary else AthenesBorderSubtle,
                            shape = RoundedCornerShape(999.dp)
                        )
                        .clickable { onTipoFiltroAlterado(opt) }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = rotulo,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (ativo) FontWeight.Bold else FontWeight.Medium,
                            color = if (ativo) AthenesPrimary else AthenesTextMuted,
                            fontSize = 11.sp
                        )
                    )
                }
            }
        }
    }
}
