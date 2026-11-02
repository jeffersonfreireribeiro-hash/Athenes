package com.athenes.ui.reader.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athenes.core.model.*
import com.athenes.ui.theme.*

@Composable
fun PainelDireitoInspetor(
    artigo: ArtigoEstudoDetalhado,
    abaAtiva: AbaInspetorDireito,
    onSelecionarAba: (AbaInspetorDireito) -> Unit,
    onNovaCitacaoClick: () -> Unit,
    onRemoverCitacao: (String) -> Unit,
    onNovaNotaClick: () -> Unit,
    onRemoverNota: (String) -> Unit,
    onSalvarConfigZoteroDrive: (ZoteroVinculoConfig) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Surface(
        color = Color(0xFFF8FAFC),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = modifier
            .width(350.dp)
            .fillMaxHeight()
    ) {
        Column(modifier = Modifier.fillMaxSize()) {

            // Abas Superiores do Inspetor: [Resumo & Notas] [Citações (N)] [Zotero & Drive]
            Surface(
                color = Color.White,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    ItemAbaInspetor(
                        titulo = "Resumo & Notas",
                        icone = Icons.AutoMirrored.Rounded.Article,
                        selecionada = abaAtiva == AbaInspetorDireito.RESUMO_NOTAS,
                        onClick = { onSelecionarAba(AbaInspetorDireito.RESUMO_NOTAS) },
                        modifier = Modifier.weight(1f)
                    )

                    ItemAbaInspetor(
                        titulo = "Citações (${artigo.citacoes.size})",
                        icone = Icons.Rounded.FormatQuote,
                        selecionada = abaAtiva == AbaInspetorDireito.CITACOES,
                        onClick = { onSelecionarAba(AbaInspetorDireito.CITACOES) },
                        modifier = Modifier.weight(1f)
                    )

                    ItemAbaInspetor(
                        titulo = "Zotero & Drive",
                        icone = Icons.Rounded.CloudSync,
                        selecionada = abaAtiva == AbaInspetorDireito.ZOTERO_DRIVE,
                        onClick = { onSelecionarAba(AbaInspetorDireito.ZOTERO_DRIVE) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Conteúdo da Aba Selecionada
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(12.dp)
            ) {
                when (abaAtiva) {
                    AbaInspetorDireito.RESUMO_NOTAS -> ConteudoAbaResumoNotas(
                        artigo = artigo,
                        onNovaNotaClick = onNovaNotaClick,
                        onRemoverNota = onRemoverNota
                    )
                    AbaInspetorDireito.CITACOES -> ConteudoAbaCitacoes(
                        citacoes = artigo.citacoes,
                        onNovaCitacaoClick = onNovaCitacaoClick,
                        onRemoverCitacao = onRemoverCitacao,
                        context = context
                    )
                    AbaInspetorDireito.ZOTERO_DRIVE -> ConteudoAbaZoteroDrive(
                        config = artigo.zoteroConfig,
                        onSalvarConfig = onSalvarConfigZoteroDrive,
                        context = context
                    )
                }
            }
        }
    }
}

@Composable
private fun ItemAbaInspetor(
    titulo: String,
    icone: androidx.compose.ui.graphics.vector.ImageVector,
    selecionada: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        color = if (selecionada) AthenesPrimary else Color.Transparent,
        shape = RoundedCornerShape(6.dp),
        modifier = modifier.padding(horizontal = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(vertical = 8.dp, horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icone,
                contentDescription = null,
                tint = if (selecionada) Color.White else AthenesTextDark,
                modifier = Modifier.size(15.dp)
            )
            Spacer(modifier = Modifier.width(5.dp))
            Text(
                text = titulo,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = if (selecionada) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (selecionada) Color.White else AthenesTextDark,
                    fontSize = 11.5.sp
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ========================================================
// ABA 1: RESUMO & NOTAS
// ========================================================
@Composable
private fun ConteudoAbaResumoNotas(
    artigo: ArtigoEstudoDetalhado,
    onNovaNotaClick: () -> Unit,
    onRemoverNota: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Resumo Oficial do Artigo
        item {
            CardSecaoInspetor(titulo = "Resumo Oficial do Artigo") {
                Text(
                    text = if (artigo.resumoOficial.isNotBlank()) artigo.resumoOficial else "Nenhum resumo oficial carregado para este item.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 11.sp,
                        color = AthenesTextDark,
                        lineHeight = 16.sp
                    )
                )
            }
        }

        // Meu Resumo e Síntese Crítica
        item {
            CardSecaoInspetor(titulo = "Meu Resumo & Síntese Crítica") {
                Text(
                    text = if (artigo.meuResumo.isNotBlank()) artigo.meuResumo else "Clique para redigir sua síntese crítica do artigo.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 11.sp,
                        color = AthenesPrimary,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.Medium
                    )
                )
            }
        }

        // Análise Metodológica
        item {
            CardSecaoInspetor(titulo = "Análise Metodológica") {
                Text(
                    text = if (artigo.analiseMetodologica.isNotBlank()) artigo.analiseMetodologica else "Sem notas metodológicas.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 11.sp,
                        color = AthenesTextDark,
                        lineHeight = 16.sp
                    )
                )
            }
        }

        // Minhas Notas
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "MINHAS NOTAS (${artigo.notas.size})",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark,
                        fontSize = 11.sp
                    )
                )

                Button(
                    onClick = onNovaNotaClick,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                    modifier = Modifier.height(24.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AthenesPrimary,
                        contentColor = Color.White
                    )
                ) {
                    Text(text = "+ Nova Nota", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (artigo.notas.isEmpty()) {
            item {
                Text(
                    text = "Nenhuma nota adesiva criada ainda.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 11.sp,
                        color = AthenesTextMuted
                    ),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
        } else {
            items(artigo.notas, key = { it.id }) { nota ->
                CardNotaAdesiva(nota = nota, onRemover = { onRemoverNota(nota.id) })
            }
        }

        // Tags e Palavras-chave
        item {
            CardSecaoInspetor(titulo = "Tags e Palavras-chave") {
                FlowRowTags(tags = artigo.tags)
            }
        }
    }
}

@Composable
private fun CardNotaAdesiva(
    nota: NotaAdesiva,
    onRemover: () -> Unit
) {
    val corBorda = parseHexColor(nota.corHex)
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.5.dp, corBorda),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(corBorda, RoundedCornerShape(2.dp))
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Pág. ${nota.pagina} — ${nota.titulo}",
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesTextDark,
                            fontSize = 11.sp
                        )
                    )
                }

                IconButton(
                    onClick = onRemover,
                    modifier = Modifier.size(20.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Close,
                        contentDescription = "Remover Nota",
                        tint = AthenesTextMuted,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = nota.texto,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 11.sp,
                    color = AthenesTextDark,
                    lineHeight = 15.sp
                )
            )
        }
    }
}

// ========================================================
// ABA 2: CITAÇÕES
// ========================================================
@Composable
private fun ConteudoAbaCitacoes(
    citacoes: List<CitacaoMarcada>,
    onNovaCitacaoClick: () -> Unit,
    onRemoverCitacao: (String) -> Unit,
    context: Context
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "CITAÇÕES MARCADAS (${citacoes.size})",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = AthenesTextDark,
                        fontSize = 11.sp,
                        letterSpacing = 0.5.sp
                    )
                )

                Button(
                    onClick = onNovaCitacaoClick,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                    modifier = Modifier.height(24.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AthenesPrimary,
                        contentColor = Color.White
                    )
                ) {
                    Text(text = "+ Nova Citação", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (citacoes.isEmpty()) {
            item {
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Nenhuma citação marcada ainda. Selecione um trecho no PDF para criar uma citação automática.",
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontSize = 11.sp,
                            color = AthenesTextMuted
                        ),
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
        } else {
            items(citacoes, key = { it.id }) { cit ->
                CardCitacaoItem(
                    citacao = cit,
                    onCopiarAbnt = {
                        val textoAbnt = "\"${cit.texto}\" ${cit.referenciaAbnt}"
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Citação ABNT", textoAbnt)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "Citação ABNT copiada!", Toast.LENGTH_SHORT).show()
                    },
                    onRemover = { onRemoverCitacao(cit.id) }
                )
            }
        }
    }
}

@Composable
private fun CardCitacaoItem(
    citacao: CitacaoMarcada,
    onCopiarAbnt: () -> Unit,
    onRemover: () -> Unit
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            // Linha do Topo do Card de Citação
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Surface(
                    color = Color(0xFFEFF6FF),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = "Pág. ${citacao.pagina}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = AthenesPrimary,
                            fontSize = 10.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    OutlinedButton(
                        onClick = onCopiarAbnt,
                        shape = RoundedCornerShape(4.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                        modifier = Modifier.height(22.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = AthenesPrimary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(10.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(text = "Copiar ABNT", fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }

                    IconButton(
                        onClick = onRemover,
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Remover Citação",
                            tint = AthenesTextMuted,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Trecho Citado
            Text(
                text = "\"${citacao.texto}\"",
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 11.sp,
                    color = AthenesTextDark,
                    lineHeight = 16.sp
                )
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Referência Formatada
            Text(
                text = citacao.referenciaAbnt,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    color = AthenesPrimary
                )
            )

            if (citacao.comentario.isNotBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = citacao.comentario,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 10.sp,
                        color = AthenesTextMuted
                    )
                )
            }
        }
    }
}

// ========================================================
// ABA 3: ZOTERO & DRIVE (Fiel à Imagem 3 do Usuário!)
// ========================================================
@Composable
private fun ConteudoAbaZoteroDrive(
    config: ZoteroVinculoConfig,
    onSalvarConfig: (ZoteroVinculoConfig) -> Unit,
    context: Context
) {
    var apiKey by remember(config) { mutableStateOf(config.apiKey) }
    var userId by remember(config) { mutableStateOf(config.userId) }
    var itemKey by remember(config) { mutableStateOf(config.itemKey) }
    var doi by remember(config) { mutableStateOf(config.doi) }
    var driveFileName by remember(config) { mutableStateOf(config.driveFileName) }
    var driveLink by remember(config) { mutableStateOf(config.driveFileId) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Bloco 1: VÍNCULO DE METADADOS COM O ZOTERO
        item {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.Link,
                            contentDescription = null,
                            tint = AthenesPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "VÍNCULO DE METADADOS COM O ZOTERO",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                letterSpacing = 0.5.sp,
                                color = AthenesTextDark
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    CampoFormulario(
                        rotulo = "Sua Zotero API Key",
                        valor = apiKey,
                        onValorAlterado = { apiKey = it }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    CampoFormulario(
                        rotulo = "Seu Zotero User ID (ex.: 18806479)",
                        valor = userId,
                        onValorAlterado = { userId = it }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    CampoFormulario(
                        rotulo = "Chave deste Item no Zotero (Item Key)",
                        valor = itemKey,
                        onValorAlterado = { itemKey = it }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    CampoFormulario(
                        rotulo = "DOI / Identificador Permanente",
                        valor = doi,
                        onValorAlterado = { doi = it }
                    )
                }
            }
        }

        // Bloco 2: SELECIONAR & VINCULAR PDF (GOOGLE DRIVE / LOCAL)
        item {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.CloudDownload,
                            contentDescription = null,
                            tint = AthenesPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "SELECIONAR & VINCULAR PDF (DRIVE / LOCAL)",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                letterSpacing = 0.5.sp,
                                color = AthenesTextDark
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Botão Selecionar PDF
                    Button(
                        onClick = {
                            Toast.makeText(context, "Seletor de PDF ativado", Toast.LENGTH_SHORT).show()
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AthenesPrimary,
                            contentColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth().height(36.dp)
                    ) {
                        Icon(imageVector = Icons.Rounded.UploadFile, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Selecionar Arquivo PDF", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Status Drive OK
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Rounded.CloudDone, contentDescription = null, tint = AthenesPrimary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Google Drive", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AthenesTextDark)
                        }

                        Surface(
                            color = Color(0xFFECFDF5),
                            shape = RoundedCornerShape(4.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0))
                        ) {
                            Text(
                                text = "Drive OK ✓",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF047857),
                                    fontSize = 10.sp
                                ),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    CampoFormulario(
                        rotulo = "Arquivo PDF Selecionado",
                        valor = driveFileName,
                        onValorAlterado = { driveFileName = it }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    CampoFormulario(
                        rotulo = "ID / Link do PDF no Google Drive",
                        valor = driveLink,
                        onValorAlterado = { driveLink = it }
                    )
                }
            }
        }

        // Botão Final: Sincronizar Agora (Zotero + Drive + Supabase)
        item {
            Button(
                onClick = {
                    val novaCfg = config.copy(
                        apiKey = apiKey,
                        userId = userId,
                        itemKey = itemKey,
                        doi = doi,
                        driveFileName = driveFileName,
                        driveFileId = driveLink
                    )
                    onSalvarConfig(novaCfg)
                    Toast.makeText(context, "Sincronizado com Zotero e Google Drive com sucesso!", Toast.LENGTH_SHORT).show()
                },
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AthenesPrimary,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(42.dp)
            ) {
                Icon(imageVector = Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Sincronizar Agora (Zotero + Drive + Supabase)",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun CampoFormulario(
    rotulo: String,
    valor: String,
    onValorAlterado: (String) -> Unit
) {
    Column {
        Text(
            text = rotulo,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = AthenesTextDark
            )
        )
        Spacer(modifier = Modifier.height(3.dp))
        OutlinedTextField(
            value = valor,
            onValueChange = onValorAlterado,
            singleLine = true,
            textStyle = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
            shape = RoundedCornerShape(6.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedBorderColor = AthenesPrimary,
                unfocusedBorderColor = Color(0xFFCBD5E1)
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun CardSecaoInspetor(
    titulo: String,
    content: @Composable () -> Unit
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = titulo,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = AthenesTextDark,
                    fontSize = 11.sp
                )
            )
            Spacer(modifier = Modifier.height(6.dp))
            content()
        }
    }
}

@Composable
private fun FlowRowTags(tags: List<String>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        tags.forEach { tag ->
            Surface(
                color = Color(0xFFEFF6FF),
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = tag,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 9.sp,
                        color = AthenesPrimary,
                        fontWeight = FontWeight.SemiBold
                    ),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}
