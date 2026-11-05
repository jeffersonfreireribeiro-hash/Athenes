package com.athenes.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.text.TextStyle
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
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            if (maxWidth < 600.dp) {
                Column {
                    CampoBuscaDocumentos(textoBusca, onBuscaAlterada, Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    BotaoNovoDocumento(onNovoDocumentoClick, Modifier.fillMaxWidth())
                }
            } else {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    CampoBuscaDocumentos(textoBusca, onBuscaAlterada, Modifier.weight(1f))
                    Spacer(Modifier.width(10.dp))
                    BotaoNovoDocumento(onNovoDocumentoClick)
                }
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
                AthenesPillFiltro(
                    rotulo = rotulo,
                    ativo = ativo,
                    onClick = { onTipoFiltroAlterado(opt) },
                    altura = 30.dp,
                    tamanhoFonte = 12.sp
                )
            }
        }
    }
}

@Composable
private fun CampoBuscaDocumentos(texto: String, onAlterar: (String) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .height(38.dp)
            .background(AthenesSurface, RoundedCornerShape(10.dp))
            .border(1.dp, AthenesBorder, RoundedCornerShape(10.dp))
            .padding(start = 12.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Rounded.Search,
            contentDescription = null,
            tint = AthenesTextMuted,
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.width(8.dp))
        Box(Modifier.weight(1f)) {
            if (texto.isEmpty()) {
                Text(
                    text = "Buscar por título ou autor",
                    color = AthenesTextMuted,
                    fontSize = 13.sp
                )
            }
            BasicTextField(
                value = texto,
                onValueChange = onAlterar,
                singleLine = true,
                textStyle = TextStyle(
                    fontSize = 13.sp,
                    color = AthenesText,
                    fontWeight = FontWeight.Medium
                ),
                cursorBrush = SolidColor(AthenesPrimary),
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = "Buscar documentos" }
            )
        }
        if (texto.isNotEmpty()) {
            IconButton(
                onClick = { onAlterar("") },
                modifier = Modifier.size(34.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Clear,
                    contentDescription = "Limpar busca",
                    tint = AthenesTextMuted,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

@Composable
private fun BotaoNovoDocumento(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick,
        modifier = modifier.height(38.dp),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = AthenesPrimary,
            contentColor = Color.White
        ),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp)
    ) {
        Icon(
            imageVector = Icons.Rounded.Add,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = "Novo documento",
            style = TextStyle(
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        )
    }
}
