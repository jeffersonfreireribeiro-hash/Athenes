package com.athenes.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Cloud
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.athenes.core.model.EstadoNuvem
import com.athenes.core.model.SituacaoDocumento
import com.athenes.core.model.TipoDocumento
import com.athenes.ui.theme.*

@Composable
fun BadgeBase(
    texto: String,
    corFundo: Color,
    corTexto: Color,
    corBorda: Color,
    icone: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(corFundo, shape = RoundedCornerShape(999.dp))
            .border(1.dp, corBorda, shape = RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 2.5.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icone != null) {
                icone()
                Spacer(modifier = Modifier.width(4.dp))
            }
            Text(
                text = texto,
                style = MaterialTheme.typography.labelSmall,
                color = corTexto
            )
        }
    }
}

@Composable
fun BadgeTipo(tipo: TipoDocumento, modifier: Modifier = Modifier) {
    BadgeBase(
        texto = tipo.badge,
        corFundo = BadgeTipoBg,
        corTexto = BadgeTipoText,
        corBorda = BadgeTipoBorder,
        modifier = modifier
    )
}

@Composable
fun BadgeSituacao(situacao: SituacaoDocumento, modifier: Modifier = Modifier) {
    val (fundo, texto, borda) = when (situacao) {
        SituacaoDocumento.RASCUNHO -> Triple(BadgeRascunhoBg, BadgeRascunhoText, BadgeRascunhoBorder)
        SituacaoDocumento.EM_REVISAO -> Triple(BadgeRevisaoBg, BadgeRevisaoText, BadgeRevisaoBorder)
        SituacaoDocumento.FINALIZADO -> Triple(BadgeFinalizadoBg, BadgeFinalizadoText, BadgeFinalizadoBorder)
    }
    BadgeBase(
        texto = situacao.badge,
        corFundo = fundo,
        corTexto = texto,
        corBorda = borda,
        modifier = modifier
    )
}

@Composable
fun BadgeNuvem(estado: EstadoNuvem, modifier: Modifier = Modifier) {
    val (fundo, texto, borda) = when (estado) {
        EstadoNuvem.NUVEM_SUPABASE -> Triple(BadgeNuvemBg, BadgeNuvemText, BadgeNuvemBorder)
        EstadoNuvem.LOCAL -> Triple(BadgeTipoBg, BadgeTipoText, BadgeTipoBorder)
        EstadoNuvem.SINCRONIZANDO -> Triple(Color(0xFFEFF6FF), Color(0xFF2563EB), Color(0xFFBFDBFE))
        EstadoNuvem.ERRO -> Triple(Color(0xFFFEF2F2), Color(0xFFDC2626), Color(0xFFFECACA))
    }
    BadgeBase(
        texto = estado.badge,
        corFundo = fundo,
        corTexto = texto,
        corBorda = borda,
        icone = {
            val iconeVector = when (estado) {
                EstadoNuvem.NUVEM_SUPABASE -> Icons.Rounded.Cloud
                EstadoNuvem.LOCAL -> Icons.Rounded.Folder
                EstadoNuvem.SINCRONIZANDO -> Icons.Rounded.Sync
                EstadoNuvem.ERRO -> Icons.Rounded.Cloud
            }
            Icon(
                imageVector = iconeVector,
                contentDescription = null,
                tint = texto,
                modifier = Modifier.size(11.dp)
            )
        },
        modifier = modifier
    )
}
