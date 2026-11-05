/*
 * Athenes — Processador Editorial e Acadêmico
 * Copyright (C) 2026 Athenes Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

package com.athenes.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.ui.theme.AthenesPrimary

/**
 * Pílula de filtro editorial Soft UI padrão do Athenes com alto contraste.
 * Altura compacta (30-32dp), cantos 999dp.
 * Ativo: fundo preenchido AthenesPrimary (#314F79) e texto Color.White.
 * Inativo: fundo Color.White com borda #CBD5E1 e texto #334155.
 */
@Composable
fun AthenesPillFiltro(
    rotulo: String,
    ativo: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icone: ImageVector? = null,
    contador: Int? = null,
    altura: Dp = 32.dp,
    tamanhoFonte: TextUnit = 12.sp
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        color = if (ativo) AthenesPrimary else Color.White,
        border = BorderStroke(
            width = 1.dp,
            color = if (ativo) AthenesPrimary else Color(0xFFCBD5E1)
        ),
        modifier = modifier.height(altura)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 12.dp)
        ) {
            if (icone != null) {
                Icon(
                    imageVector = icone,
                    contentDescription = null,
                    tint = if (ativo) Color.White else Color(0xFF64748B),
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(5.dp))
            }
            Text(
                text = rotulo,
                style = TextStyle(
                    fontSize = tamanhoFonte,
                    fontWeight = if (ativo) FontWeight.Bold else FontWeight.Medium,
                    color = if (ativo) Color.White else Color(0xFF334155),
                    letterSpacing = 0.sp
                )
            )
            if (contador != null) {
                Spacer(Modifier.width(5.dp))
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = if (ativo) Color.White.copy(alpha = 0.25f) else Color(0xFFF1F5F9)
                ) {
                    Text(
                        text = contador.toString(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (ativo) Color.White else Color(0xFF64748B),
                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                    )
                }
            }
        }
    }
}
