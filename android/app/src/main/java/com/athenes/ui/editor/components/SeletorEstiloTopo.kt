// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.ui.editor.AlinhamentoTexto
import com.athenes.ui.editor.estilos.CatalogoFontes
import com.athenes.ui.editor.estilos.EstiloEditorial
import com.athenes.ui.editor.estilos.parseCorHex
import com.athenes.ui.theme.*

/**
 * Seletor de estilo editorial integrado à barra superior (TopBar).
 * Exibe amostra visual "Aa", nome do estilo do bloco ativo e dropdown com prévia ao vivo.
 */
@Composable
fun SeletorEstiloTopo(
    estilos: List<EstiloEditorial>,
    estiloAtivoId: String,
    onSelecionarEstilo: (String) -> Unit,
    onCriarNovoEstilo: () -> Unit,
    onEditarEstilo: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var menuAberto by remember { mutableStateOf(false) }

    val estiloAtivo = remember(estilos, estiloAtivoId) {
        estilos.find { it.id == estiloAtivoId }
            ?: estilos.firstOrNull()
            ?: EstiloEditorial(id = "corpo", nome = "Corpo de Texto")
    }

    val rotacaoSeta by animateFloatAsState(
        targetValue = if (menuAberto) 180f else 0f,
        label = "rotacaoSetaEstilo"
    )

    Box(modifier = modifier) {
        // Botão Gatilho (Pill)
        Surface(
            onClick = { menuAberto = !menuAberto },
            shape = RoundedCornerShape(8.dp),
            color = if (menuAberto) AthenesPrimarySoft else Color(0xFFF8FAFC),
            border = BorderStroke(
                width = 1.dp,
                color = if (menuAberto) AthenesPrimary.copy(alpha = 0.5f) else Color(0xFFCBD5E1)
            ),
            modifier = Modifier
                .height(36.dp)
                .semantics { contentDescription = "Estilo atual: ${estiloAtivo.nome}. Toque para abrir menu de estilos." }
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Amostra visual compacta "Aa"
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = if (menuAberto) Color.White else Color(0xFFEEF4FA),
                    border = BorderStroke(0.8.dp, AthenesPrimary.copy(alpha = 0.25f)),
                    modifier = Modifier.size(24.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = "Aa",
                            style = TextStyle(
                                fontFamily = CatalogoFontes.obterFontFamily(LocalContext.current, estiloAtivo.fonteId),
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight(estiloAtivo.peso.coerceIn(100, 900)),
                                fontStyle = if (estiloAtivo.italico) FontStyle.Italic else FontStyle.Normal,
                                textDecoration = if (estiloAtivo.sublinhado) TextDecoration.Underline else TextDecoration.None,
                                color = parseCorHex(estiloAtivo.corHex)
                            )
                        )
                    }
                }

                Spacer(Modifier.width(6.dp))

                // Nome do Estilo Ativo
                Text(
                    text = estiloAtivo.nome,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontWeight = FontWeight.SemiBold,
                        color = AthenesTextDark,
                        fontSize = 12.sp
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 135.dp)
                )

                Spacer(Modifier.width(4.dp))

                // Indicador de seta animada
                Icon(
                    imageVector = Icons.Rounded.KeyboardArrowDown,
                    contentDescription = null,
                    tint = if (menuAberto) AthenesPrimary else AthenesTextMuted,
                    modifier = Modifier
                        .size(18.dp)
                        .graphicsLayer(rotationZ = rotacaoSeta)
                )
            }
        }

        // Dropdown Menu Popover
        DropdownMenu(
            expanded = menuAberto,
            onDismissRequest = { menuAberto = false },
            modifier = Modifier
                .widthIn(min = 300.dp, max = 340.dp)
                .background(Color.White)
        ) {
            CabecalhoMenuEstilos(quantidade = estilos.size)
            HorizontalDivider(color = Color(0xFFE2E8F0))

            // Lista rolável de estilos
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 240.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = 4.dp)
            ) {
                estilos.forEach { est ->
                    ItemEstiloDropdown(
                        estilo = est,
                        selecionado = est.id == estiloAtivo.id,
                        onSelecionar = {
                            onSelecionarEstilo(est.id)
                            menuAberto = false
                        },
                        onEditar = {
                            onEditarEstilo(est.id)
                            menuAberto = false
                        }
                    )
                }
            }

            HorizontalDivider(color = Color(0xFFE2E8F0))

            // Prévia Tipográfica ao Vivo
            PreviaTipograficaEstilo(estilo = estiloAtivo)

            Spacer(Modifier.height(4.dp))

            // Botão "+ Criar novo estilo…"
            BotaoNovoEstilo(onClick = {
                onCriarNovoEstilo()
                menuAberto = false
            })

            Spacer(Modifier.height(4.dp))
        }
    }
}

@Composable
private fun ItemEstiloDropdown(
    estilo: EstiloEditorial,
    selecionado: Boolean,
    onSelecionar: () -> Unit,
    onEditar: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onSelecionar,
        shape = RoundedCornerShape(8.dp),
        color = if (selecionado) AthenesPrimarySoft else Color.Transparent,
        border = if (selecionado) BorderStroke(1.dp, AthenesPrimary.copy(alpha = 0.35f)) else null,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Amostra "Aa" estilizada
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = if (selecionado) Color.White else Color(0xFFF1F5F9),
                border = BorderStroke(0.8.dp, Color(0xFFCBD5E1).copy(alpha = 0.6f)),
                modifier = Modifier.size(32.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "Aa",
                        style = TextStyle(
                            fontFamily = CatalogoFontes.obterFontFamily(LocalContext.current, estilo.fonteId),
                            fontSize = 13.sp,
                            fontWeight = FontWeight(estilo.peso.coerceIn(100, 900)),
                            fontStyle = if (estilo.italico) FontStyle.Italic else FontStyle.Normal,
                            textDecoration = if (estilo.sublinhado) TextDecoration.Underline else TextDecoration.None,
                            color = parseCorHex(estilo.corHex)
                        )
                    )
                }
            }

            Spacer(Modifier.width(8.dp))

            // Descrição e metadados
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = estilo.nome,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = if (selecionado) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (selecionado) AthenesPrimary else AthenesTextDark,
                            fontSize = 12.5.sp
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (estilo.personalizado) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0xFFFEF3C7),
                            border = BorderStroke(0.5.dp, Color(0xFFF59E0B).copy(alpha = 0.5f)),
                            modifier = Modifier.padding(start = 6.dp)
                        ) {
                            Text(
                                text = "seu",
                                style = TextStyle(
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF92400E)
                                ),
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                    }
                }

                Text(
                    text = "${estilo.fonteId.replaceFirstChar { it.uppercase() }} · ${estilo.tamanhoPt.toInt()} pt · ${rotuloAlinhamento(estilo.alinhamento)}",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 10.5.sp,
                        color = AthenesTextMuted
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(Modifier.width(4.dp))

            // Botão Editar estilo
            IconButton(
                onClick = onEditar,
                modifier = Modifier.size(28.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Edit,
                    contentDescription = "Editar estilo ${estilo.nome}",
                    tint = if (selecionado) AthenesPrimary else Color(0xFF94A3B8),
                    modifier = Modifier.size(15.dp)
                )
            }
        }
    }
}

@Composable
private fun PreviaTipograficaEstilo(
    estilo: EstiloEditorial,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color(0xFFF8FAFC),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Column(modifier = Modifier.padding(8.dp)) {
            Text(
                text = "PRÉVIA DO ESTILO",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = AthenesTextMuted,
                    letterSpacing = 0.5.sp
                )
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (estilo.caixaAlta) {
                    "AA — O RÁPIDO LEOPARDO SALTA SOBRE O CÃO PREGUIÇOSO."
                } else {
                    "Aa — O rápido leopardo salta sobre o cão preguiçoso."
                },
                style = TextStyle(
                    fontFamily = CatalogoFontes.obterFontFamily(LocalContext.current, estilo.fonteId),
                    fontSize = estilo.tamanhoPt.coerceIn(10.0, 16.0).sp,
                    fontWeight = FontWeight(estilo.peso.coerceIn(100, 900)),
                    fontStyle = if (estilo.italico) FontStyle.Italic else FontStyle.Normal,
                    textDecoration = if (estilo.sublinhado) TextDecoration.Underline else TextDecoration.None,
                    color = parseCorHex(estilo.corHex),
                    textAlign = when (estilo.alinhamento) {
                        AlinhamentoTexto.ESQUERDA -> TextAlign.Left
                        AlinhamentoTexto.CENTRO -> TextAlign.Center
                        AlinhamentoTexto.DIREITA -> TextAlign.Right
                        else -> TextAlign.Justify
                    }
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun CabecalhoMenuEstilos(
    quantidade: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "ESTILOS DE TEXTO",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = AthenesTextDark,
                    letterSpacing = 0.5.sp
                )
            )
            Spacer(Modifier.width(6.dp))
            Surface(
                shape = CircleShape,
                color = AthenesPrimarySoft
            ) {
                Text(
                    text = quantidade.toString(),
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = AthenesPrimary
                    ),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                )
            }
        }
    }
}

@Composable
private fun BotaoNovoEstilo(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = AthenesPrimarySoft,
        border = BorderStroke(1.dp, AthenesPrimary.copy(alpha = 0.25f)),
        modifier = modifier
            .fillMaxWidth()
            .height(38.dp)
            .padding(horizontal = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Rounded.Add,
                contentDescription = null,
                tint = AthenesPrimary,
                modifier = Modifier.size(16.dp)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = "Criar novo estilo…",
                style = TextStyle(
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = AthenesPrimary
                )
            )
        }
    }
}

fun rotuloAlinhamento(alinhamento: AlinhamentoTexto): String = when (alinhamento) {
    AlinhamentoTexto.ESQUERDA -> "À esquerda"
    AlinhamentoTexto.CENTRO -> "Centralizado"
    AlinhamentoTexto.DIREITA -> "À direita"
    AlinhamentoTexto.JUSTIFICADO,
    AlinhamentoTexto.JUSTIFICADO_ESQUERDA,
    AlinhamentoTexto.JUSTIFICADO_CENTRO,
    AlinhamentoTexto.JUSTIFICADO_DIREITA -> "Justificado"
}
