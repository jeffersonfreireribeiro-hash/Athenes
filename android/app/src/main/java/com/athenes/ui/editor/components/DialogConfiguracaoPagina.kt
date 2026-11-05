package com.athenes.ui.editor.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.athenes.core.model.ConfiguracaoPagina
import com.athenes.core.model.FormatoPagina

@Composable
fun DialogConfiguracaoPagina(
    atual: ConfiguracaoPagina,
    onSalvar: (ConfiguracaoPagina) -> Unit,
    onFechar: () -> Unit
) {
    var formato by remember(atual) { mutableStateOf(atual.formato) }
    var paisagem by remember(atual) { mutableStateOf(atual.paisagem) }
    var largura by remember(atual) { mutableStateOf(atual.larguraPersonalizadaMm.toString()) }
    var altura by remember(atual) { mutableStateOf(atual.alturaPersonalizadaMm.toString()) }
    var superior by remember(atual) { mutableStateOf(atual.margemSuperiorMm.toString()) }
    var direita by remember(atual) { mutableStateOf(atual.margemDireitaMm.toString()) }
    var inferior by remember(atual) { mutableStateOf(atual.margemInferiorMm.toString()) }
    var esquerda by remember(atual) { mutableStateOf(atual.margemEsquerdaMm.toString()) }
    fun numero(texto: String): Double? = texto.replace(',', '.').toDoubleOrNull()
    val candidata = listOf(largura, altura, superior, direita, inferior, esquerda).map(::numero).let { n ->
        if (n.any { it == null }) null else ConfiguracaoPagina(
            formato = formato, paisagem = paisagem,
            larguraPersonalizadaMm = n[0]!!, alturaPersonalizadaMm = n[1]!!,
            margemSuperiorMm = n[2]!!, margemDireitaMm = n[3]!!,
            margemInferiorMm = n[4]!!, margemEsquerdaMm = n[5]!!
        )
    }
    AlertDialog(
        onDismissRequest = onFechar,
        title = { Text("Configurar página") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Formato do papel")
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FormatoPagina.entries.forEach { opcao ->
                        com.athenes.ui.components.AthenesPillFiltro(
                            rotulo = opcao.rotulo,
                            ativo = formato == opcao,
                            onClick = { formato = opcao },
                            altura = 32.dp
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    com.athenes.ui.components.AthenesPillFiltro(
                        rotulo = "Retrato",
                        ativo = !paisagem,
                        onClick = { paisagem = false },
                        altura = 32.dp
                    )
                    com.athenes.ui.components.AthenesPillFiltro(
                        rotulo = "Paisagem",
                        ativo = paisagem,
                        onClick = { paisagem = true },
                        altura = 32.dp
                    )
                }
                if (formato == FormatoPagina.PERSONALIZADO) {
                    NumeroPagina("Largura (mm)", largura) { largura = it }
                    NumeroPagina("Altura (mm)", altura) { altura = it }
                }
                Text("Margens em milímetros")
                NumeroPagina("Superior", superior) { superior = it }
                NumeroPagina("Direita", direita) { direita = it }
                NumeroPagina("Inferior", inferior) { inferior = it }
                NumeroPagina("Esquerda", esquerda) { esquerda = it }
                if (candidata != null && !candidata.validar()) {
                    Text("Confira as dimensões e margens: o corpo da página precisa ter pelo menos 30 mm.", color = MaterialTheme.colorScheme.error)
                }
                candidata?.takeIf(ConfiguracaoPagina::validar)?.let {
                    Text("Folha: ${it.larguraMm} × ${it.alturaMm} mm")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { candidata?.let(onSalvar) }, enabled = candidata?.validar() == true) { Text("Aplicar") }
        },
        dismissButton = { TextButton(onClick = onFechar) { Text("Cancelar") } }
    )
}

@Composable
private fun NumeroPagina(rotulo: String, valor: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = valor, onValueChange = onChange,
        label = { Text(rotulo) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        singleLine = true,
        modifier = Modifier.fillMaxWidth()
    )
}
