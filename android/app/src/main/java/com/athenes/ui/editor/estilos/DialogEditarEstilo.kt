// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.estilos

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.FormatAlignLeft
import androidx.compose.material.icons.automirrored.rounded.FormatAlignRight
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.athenes.ui.editor.AlinhamentoTexto
import com.athenes.ui.theme.*

/**
 * Diálogo editorial para criação e edição de estilos tipográficos no Athenes Android.
 * Réplica fiel do modal canônico da versão Web (src/ui/athenes_editor_estilo_modal.js).
 */
@Composable
fun DialogEditarEstilo(
    estiloOriginal: EstiloEditorial,
    fontesDisponiveis: List<FamiliaFonte>,
    onSalvar: (EstiloEditorial) -> Unit,
    onDismiss: () -> Unit,
    onExcluir: ((String) -> Unit)? = null,
    onImportarFonteClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var rascunho by remember { mutableStateOf(estiloOriginal.copy()) }
    var menuFontesAberto by remember { mutableStateOf(false) }
    var menuPesosAberto by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            shadowElevation = 16.dp,
            modifier = modifier
                .widthIn(max = 660.dp)
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.92f)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // 1. Cabeçalho do Diálogo
                Surface(
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Rounded.Edit, contentDescription = null, tint = AthenesPrimary, modifier = Modifier.size(20.dp))
                            Text(
                                text = if (rascunho.personalizado && rascunho.nome == "Novo Estilo") "Criar Novo Estilo" else "Editar Estilo: ${rascunho.nome.ifBlank { "Estilo" }}",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = AthenesTextDark)
                            )
                        }
                        IconButton(onClick = onDismiss, modifier = Modifier.size(36.dp)) {
                            Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = AthenesTextMuted)
                        }
                    }
                }

                // 2. Corpo com Rolagem
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // 2.1 Amostra Tipográfica em Tempo Real
                    PreviaEstiloAoVivo(rascunho = rascunho, context = context)

                    // 2.2 Nome do Estilo
                    OutlinedTextField(
                        value = rascunho.nome,
                        onValueChange = { rascunho = rascunho.copy(nome = it) },
                        label = { Text("Nome do Estilo") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    // 2.3 Família Tipográfica & Peso da Fonte
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Família
                        Box(modifier = Modifier.weight(1f)) {
                            val fonteAtual = fontesDisponiveis.find { it.id == rascunho.fonteId }
                                ?: fontesDisponiveis.firstOrNull()
                            OutlinedCard(
                                onClick = { menuFontesAberto = true },
                                modifier = Modifier.fillMaxWidth().height(56.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)
                                ) {
                                    Column {
                                        Text("Família Tipográfica", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = AthenesTextMuted))
                                        Text(
                                            text = fonteAtual?.rotulo ?: "Nunito",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold, color = AthenesTextDark),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = AthenesTextMuted)
                                }
                            }
                            DropdownMenu(
                                expanded = menuFontesAberto,
                                onDismissRequest = { menuFontesAberto = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("+ Importar fonte (.ttf/.otf)…", fontWeight = FontWeight.Bold, color = AthenesPrimary) },
                                    leadingIcon = { Icon(Icons.Rounded.FileUpload, contentDescription = null, tint = AthenesPrimary) },
                                    onClick = {
                                        menuFontesAberto = false
                                        onImportarFonteClick()
                                    }
                                )
                                HorizontalDivider()
                                fontesDisponiveis.forEach { fonte ->
                                    DropdownMenuItem(
                                        text = {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                                Text(fonte.rotulo, fontWeight = if (fonte.id == rascunho.fonteId) FontWeight.Bold else FontWeight.Normal)
                                                if (fonte.ehImportada) {
                                                    Text("importada", style = MaterialTheme.typography.labelSmall.copy(color = AthenesPrimary))
                                                }
                                            }
                                        },
                                        onClick = {
                                            rascunho = rascunho.copy(fonteId = fonte.id)
                                            menuFontesAberto = false
                                        }
                                    )
                                }
                            }
                        }

                        // Peso
                        Box(modifier = Modifier.weight(1f)) {
                            val pesos = listOf(
                                300 to "300 — Light",
                                400 to "400 — Regular",
                                600 to "600 — SemiBold",
                                700 to "700 — Bold",
                                800 to "800 — ExtraBold",
                                900 to "900 — Black"
                            )
                            val rotuloPeso = pesos.find { it.first == rascunho.peso }?.second ?: "${rascunho.peso}"
                            OutlinedCard(
                                onClick = { menuPesosAberto = true },
                                modifier = Modifier.fillMaxWidth().height(56.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)
                                ) {
                                    Column {
                                        Text("Peso da Fonte", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = AthenesTextMuted))
                                        Text(text = rotuloPeso, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold, color = AthenesTextDark))
                                    }
                                    Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = AthenesTextMuted)
                                }
                            }
                            DropdownMenu(expanded = menuPesosAberto, onDismissRequest = { menuPesosAberto = false }) {
                                pesos.forEach { (valor, rot) ->
                                    DropdownMenuItem(
                                        text = { Text(rot, fontWeight = if (valor == rascunho.peso) FontWeight.Bold else FontWeight.Normal) },
                                        onClick = {
                                            rascunho = rascunho.copy(peso = valor)
                                            menuPesosAberto = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // 2.4 Tamanho (pt) com Stepper
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Tamanho (pt):",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = AthenesTextDark),
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = { rascunho = rascunho.copy(tamanhoPt = (rascunho.tamanhoPt - 1.0).coerceAtLeast(6.0)) },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(Icons.Rounded.Remove, contentDescription = "Diminuir tamanho")
                        }
                        Text(
                            text = "${if (rascunho.tamanhoPt % 1.0 == 0.0) rascunho.tamanhoPt.toInt() else rascunho.tamanhoPt} pt",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = AthenesPrimary)
                        )
                        IconButton(
                            onClick = { rascunho = rascunho.copy(tamanhoPt = (rascunho.tamanhoPt + 1.0).coerceAtMost(72.0)) },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = "Aumentar tamanho")
                        }
                    }

                    // 2.5 7 Modos de Alinhamento Editorial
                    Text(
                        text = "ALINHAMENTO (7 MODOS EDITORIAIS)",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.ExtraBold, color = AthenesTextMuted, letterSpacing = 0.5.sp)
                    )
                    SeletorAlinhamento7Modos(
                        alinhamentoAtivo = rascunho.alinhamento,
                        onSelecionar = { rascunho = rascunho.copy(alinhamento = it) }
                    )

                    // 2.6 Cor do Texto e Modificadores Rápidos
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        SeletorCorHex(
                            corHex = rascunho.corHex,
                            onCorAlterada = { rascunho = rascunho.copy(corHex = it) }
                        )

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = rascunho.italico, onCheckedChange = { rascunho = rascunho.copy(italico = it) })
                            Text("Itálico", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold))
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = rascunho.sublinhado, onCheckedChange = { rascunho = rascunho.copy(sublinhado = it) })
                            Text("Sublinhado", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold))
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = rascunho.caixaAlta, onCheckedChange = { rascunho = rascunho.copy(caixaAlta = it) })
                            Text("Caixa Alta", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold))
                        }
                    }

                    HorizontalDivider()

                    // 2.7 Seção Parágrafo (Recuo e Espaçamento)
                    SecaoParagrafoWord(
                        rascunho = rascunho,
                        onRascunhoAlterado = { rascunho = it }
                    )
                }

                // 3. Rodapé de Ações
                Surface(
                    color = Color(0xFFF8FAFC),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (rascunho.personalizado && onExcluir != null && rascunho.id != "corpo") {
                            TextButton(
                                onClick = { onExcluir(rascunho.id) },
                                colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFDC2626))
                            ) {
                                Icon(Icons.Rounded.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Excluir Estilo")
                            }
                        } else {
                            Spacer(Modifier.width(1.dp))
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedButton(onClick = onDismiss) {
                                Text("Cancelar")
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Button(
                                onClick = { onSalvar(rascunho) },
                                enabled = rascunho.nome.isNotBlank(),
                                colors = ButtonDefaults.buttonColors(containerColor = AthenesPrimary)
                            ) {
                                Icon(Icons.Rounded.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Salvar Estilo", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Caixa de prévia tipográfica ao vivo refletindo fontes, pesos, tamanhos, entrelinhas e recuos em tempo real.
 */
@Composable
private fun PreviaEstiloAoVivo(rascunho: EstiloEditorial, context: android.content.Context) {
    val ff = CatalogoFontes.obterFontFamily(context, rascunho.fonteId)
    val corTexto = parseCorHex(rascunho.corHex, AthenesTextDark)
    val textAlign = when (rascunho.alinhamento) {
        AlinhamentoTexto.ESQUERDA -> TextAlign.Start
        AlinhamentoTexto.CENTRO -> TextAlign.Center
        AlinhamentoTexto.DIREITA -> TextAlign.End
        AlinhamentoTexto.JUSTIFICADO,
        AlinhamentoTexto.JUSTIFICADO_ESQUERDA,
        AlinhamentoTexto.JUSTIFICADO_CENTRO,
        AlinhamentoTexto.JUSTIFICADO_DIREITA -> TextAlign.Justify
    }

    Surface(
        color = Color(0xFFF8FAFC),
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = "PRÉVIA DO TEXTO",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = AthenesTextMuted,
                    letterSpacing = 0.5.sp
                )
            )
            Spacer(modifier = Modifier.height(6.dp))
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth().heightIn(min = 60.dp, max = 120.dp)
            ) {
                Box(modifier = Modifier.padding(12.dp)) {
                    val textoBase = "Aa — Este é um exemplo de parágrafo formatado com o estilo ${rascunho.nome.ifBlank { "Estilo" }}. O texto reflete a tipografia, entrelinha, espaçamento e alinhamento em tempo real."
                    val textoFormatado = if (rascunho.caixaAlta) textoBase.uppercase() else textoBase
                    Text(
                        text = textoFormatado,
                        fontFamily = ff,
                        fontSize = rascunho.tamanhoPt.coerceIn(8.0, 36.0).sp,
                        fontWeight = FontWeight(rascunho.peso.coerceIn(100, 900)),
                        fontStyle = if (rascunho.italico) FontStyle.Italic else FontStyle.Normal,
                        textDecoration = if (rascunho.sublinhado) TextDecoration.Underline else TextDecoration.None,
                        color = corTexto,
                        textAlign = textAlign,
                        lineHeight = (rascunho.tamanhoPt.coerceIn(8.0, 36.0) * rascunho.entrelinha).sp,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

/**
 * Seletor segmentado com os 7 alinhamentos normativos editoriais do Athenes.
 */
@Composable
private fun SeletorAlinhamento7Modos(
    alinhamentoAtivo: AlinhamentoTexto,
    onSelecionar: (AlinhamentoTexto) -> Unit
) {
    val modos = listOf(
        AlinhamentoTexto.ESQUERDA to Icons.AutoMirrored.Rounded.FormatAlignLeft,
        AlinhamentoTexto.CENTRO to Icons.Rounded.FormatAlignCenter,
        AlinhamentoTexto.DIREITA to Icons.AutoMirrored.Rounded.FormatAlignRight,
        AlinhamentoTexto.JUSTIFICADO to Icons.Rounded.FormatAlignJustify,
        AlinhamentoTexto.JUSTIFICADO_ESQUERDA to Icons.Rounded.FormatAlignJustify,
        AlinhamentoTexto.JUSTIFICADO_CENTRO to Icons.Rounded.FormatAlignCenter,
        AlinhamentoTexto.JUSTIFICADO_DIREITA to Icons.AutoMirrored.Rounded.FormatAlignRight
    )

    Surface(
        color = Color(0xFFF1F5F9),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(3.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            modos.forEach { (modo, icone) ->
                val selecionado = modo == alinhamentoAtivo
                Surface(
                    onClick = { onSelecionar(modo) },
                    shape = RoundedCornerShape(6.dp),
                    color = if (selecionado) AthenesPrimary else Color.Transparent,
                    modifier = Modifier.size(38.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = icone,
                            contentDescription = modo.name,
                            tint = if (selecionado) Color.White else Color(0xFF475569),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Seletor de cor por chip e campo hex.
 */
@Composable
private fun SeletorCorHex(
    corHex: String,
    onCorAlterada: (String) -> Unit
) {
    val corParsed = parseCorHex(corHex, AthenesTextDark)
    var textoHex by remember(corHex) { mutableStateOf(corHex) }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(corParsed)
                .border(1.5.dp, Color(0xFFCBD5E1), CircleShape)
        )
        OutlinedTextField(
            value = textoHex,
            onValueChange = {
                textoHex = it
                if (it.matches(Regex("^#?[0-9a-fA-F]{6}$")) || it.matches(Regex("^#?[0-9a-fA-F]{8}$"))) {
                    val full = if (it.startsWith("#")) it else "#$it"
                    onCorAlterada(full)
                }
            },
            label = { Text("Cor Hex") },
            singleLine = true,
            modifier = Modifier.width(115.dp)
        )
    }
}

/**
 * Seção de recuo e espaçamento idêntica à caixa Parágrafo do Word e Athenes Web.
 */
@Composable
private fun SecaoParagrafoWord(
    rascunho: EstiloEditorial,
    onRascunhoAlterado: (EstiloEditorial) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = "PARÁGRAFO (RECUOS E ESPAÇAMENTOS)",
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.ExtraBold, color = AthenesTextMuted, letterSpacing = 0.5.sp)
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = "${rascunho.recuoEsquerdoMm}",
                onValueChange = { onRascunhoAlterado(rascunho.copy(recuoEsquerdoMm = it.toDoubleOrNull() ?: 0.0)) },
                label = { Text("Recuo Esq. (mm)") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = "${rascunho.recuoPrimeiraLinhaMm}",
                onValueChange = { onRascunhoAlterado(rascunho.copy(recuoPrimeiraLinhaMm = it.toDoubleOrNull() ?: 0.0)) },
                label = { Text("1ª Linha (mm)") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = "${rascunho.espacoAntesPt}",
                onValueChange = { onRascunhoAlterado(rascunho.copy(espacoAntesPt = it.toDoubleOrNull() ?: 0.0)) },
                label = { Text("Antes (pt)") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = "${rascunho.espacoDepoisPt}",
                onValueChange = { onRascunhoAlterado(rascunho.copy(espacoDepoisPt = it.toDoubleOrNull() ?: 0.0)) },
                label = { Text("Depois (pt)") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = "${rascunho.entrelinha}",
                onValueChange = { onRascunhoAlterado(rascunho.copy(entrelinha = (it.toDoubleOrNull() ?: 1.5).coerceIn(0.5, 4.0))) },
                label = { Text("Entrelinha") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }
    }
}
