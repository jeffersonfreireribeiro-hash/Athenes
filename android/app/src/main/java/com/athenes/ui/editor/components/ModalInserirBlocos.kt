// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.athenes.ui.editor.TipoBlocoEditor
import com.athenes.ui.theme.AthenesPrimary
import com.athenes.ui.theme.AthenesPrimarySoft
import com.athenes.ui.theme.AthenesTextDark
import com.athenes.ui.theme.AthenesTextMuted

data class ItemMenuBloco(
    val tipo: TipoBlocoEditor,
    val rotulo: String,
    val descricao: String,
    val icone: ImageVector,
    val subtipo: String = "",
    val nivelTitulo: Int = 1
)

enum class CategoriaBlocos(val rotulo: String) {
    TEXTO("Texto"),
    ILUSTRACOES("Ilustrações"),
    TABELAS("Tabelas & Dados"),
    FORMULAS("Fórmulas"),
    ESTRUTURA("Estruturais")
}

@Composable
fun ModalInserirBlocos(
    onDismiss: () -> Unit,
    onInserir: (TipoBlocoEditor, String, Int) -> Unit
) {
    var categoriaAtiva by remember { mutableStateOf(CategoriaBlocos.TEXTO) }

    val itensPorCategoria = remember {
        mapOf(
            CategoriaBlocos.TEXTO to listOf(
                ItemMenuBloco(TipoBlocoEditor.TITULO, "Título Nível 1", "Seção primária numerada (1 INTRODUÇÃO)", Icons.Rounded.Title, "", 1),
                ItemMenuBloco(TipoBlocoEditor.TITULO, "Título Nível 2", "Seção secundária numerada (1.1 Contexto)", Icons.Rounded.Title, "", 2),
                ItemMenuBloco(TipoBlocoEditor.TITULO, "Título Nível 3", "Seção terciária numerada (1.1.1 Detalhe)", Icons.Rounded.Title, "", 3),
                ItemMenuBloco(TipoBlocoEditor.PARAGRAFO, "Parágrafo", "Texto corrido com recuo de 1,25 cm da primeira linha", Icons.Rounded.Notes),
                ItemMenuBloco(TipoBlocoEditor.CITACAO, "Citação Direta Longa", "Trecho com mais de 3 linhas, recuo 4 cm e fonte menor (ABNT)", Icons.Rounded.FormatQuote),
                ItemMenuBloco(TipoBlocoEditor.LISTA, "Lista com Marcadores", "Itens listados com marcadores ou numerados", Icons.Rounded.FormatListBulleted)
            ),
            CategoriaBlocos.ILUSTRACOES to listOf(
                ItemMenuBloco(TipoBlocoEditor.FIGURA, "Figura", "Imagem, esquema ou ilustração com numeração contínua e fonte", Icons.Rounded.Image, "Figura"),
                ItemMenuBloco(TipoBlocoEditor.FIGURA, "Gráfico", "Gráfico estatístico com numeração própria e legenda analítica", Icons.Rounded.BarChart, "Gráfico"),
                ItemMenuBloco(TipoBlocoEditor.FIGURA, "Fotografia", "Registro fotográfico ou imagem de campo com crédito autoral", Icons.Rounded.PhotoCamera, "Fotografia"),
                ItemMenuBloco(TipoBlocoEditor.FIGURA, "Diagrama", "Representação estrutural ou conceitual de relações", Icons.Rounded.AccountTree, "Diagrama"),
                ItemMenuBloco(TipoBlocoEditor.FIGURA, "Fluxograma", "Sequência lógica de etapas e processos de decisão", Icons.Rounded.Timeline, "Fluxograma"),
                ItemMenuBloco(TipoBlocoEditor.FIGURA, "Esquema / Desenho", "Esquema gráfico ou croqui técnico", Icons.Rounded.Brush, "Esquema")
            ),
            CategoriaBlocos.TABELAS to listOf(
                ItemMenuBloco(TipoBlocoEditor.TABELA, "Tabela ABNT / IBGE", "Dados quantitativos em linhas e colunas, aberta nas laterais", Icons.Rounded.TableChart, "Tabela"),
                ItemMenuBloco(TipoBlocoEditor.QUADRO, "Quadro Conceitual", "Informações qualitativas ou textuais em moldura fechada", Icons.Rounded.ViewModule, "Quadro"),
                ItemMenuBloco(TipoBlocoEditor.CAMPOS, "Campos (Chave e Valor)", "Pares de rótulo e valor dispostos em colunas de metadados", Icons.Rounded.ViewColumn, "Campos")
            ),
            CategoriaBlocos.FORMULAS to listOf(
                ItemMenuBloco(TipoBlocoEditor.FORMULA, "Fórmula Matemática", "Expressão matemática em LaTeX, centralizada e numerada à direita", Icons.Rounded.Functions, "Fórmula")
            ),
            CategoriaBlocos.ESTRUTURA to listOf(
                ItemMenuBloco(TipoBlocoEditor.SUMARIO, "Sumário Automático", "Lista dinâmica de títulos e seções numeradas do trabalho", Icons.AutoMirrored.Rounded.MenuBook),
                ItemMenuBloco(TipoBlocoEditor.LISTA_ILUSTRACOES, "Lista de Ilustrações", "Índice de figuras, gráficos e quadros com paginação", Icons.Rounded.Collections),
                ItemMenuBloco(TipoBlocoEditor.REFERENCIAS, "Referências Bibliográficas", "Lista automática de obras citadas em ABNT/APA via Zotero", Icons.Rounded.FormatListNumbered),
                ItemMenuBloco(TipoBlocoEditor.QUEBRA_PAGINA, "Quebra de Página", "Divisa de folha contínua A4 com cabeçalho e rodapé mestres", Icons.Rounded.InsertPageBreak),
                ItemMenuBloco(TipoBlocoEditor.ESPACO, "Espaçamento Vertical", "Espaço em branco configurável em pontos tipográficos", Icons.Rounded.Height),
                ItemMenuBloco(TipoBlocoEditor.DIVISOR, "Divisor de Seção", "Linha horizontal suave para delimitar tópicos", Icons.Rounded.HorizontalRule)
            )
        )
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            border = BorderStroke(1.dp, Color(0xFFC8D7E6)),
            shadowElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                // Topo do Modal
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = AthenesPrimarySoft,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.AddBox, contentDescription = null, tint = AthenesPrimary, modifier = Modifier.size(18.dp))
                            }
                        }
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "INSERIR BLOCO",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = AthenesPrimary,
                                    fontSize = 12.sp,
                                    letterSpacing = 0.5.sp
                                )
                            )
                            Text(
                                text = "Escolha o tipo e formato editorial do bloco",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 11.sp,
                                    color = AthenesTextMuted
                                )
                            )
                        }
                    }

                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = AthenesTextMuted, modifier = Modifier.size(18.dp))
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Abas de Categorias
                ScrollableTabRow(
                    selectedTabIndex = categoriaAtiva.ordinal,
                    edgePadding = 0.dp,
                    containerColor = Color.Transparent,
                    contentColor = AthenesPrimary,
                    divider = { HorizontalDivider(color = Color(0xFFE2E8F0)) }
                ) {
                    CategoriaBlocos.values().forEach { cat ->
                        val selecionada = categoriaAtiva == cat
                        Tab(
                            selected = selecionada,
                            onClick = { categoriaAtiva = cat },
                            text = {
                                Text(
                                    text = cat.rotulo,
                                    fontSize = 11.5.sp,
                                    fontWeight = if (selecionada) FontWeight.Bold else FontWeight.Medium,
                                    color = if (selecionada) AthenesPrimary else AthenesTextMuted
                                )
                            }
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                // Lista de Itens da Categoria Ativa
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 380.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val itens = itensPorCategoria[categoriaAtiva].orEmpty()
                    items(itens) { item ->
                        Surface(
                            onClick = {
                                onInserir(item.tipo, item.subtipo, item.nivelTitulo)
                                onDismiss()
                            },
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFF8FAFC),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color.White,
                                    border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(item.icone, contentDescription = null, tint = AthenesPrimary, modifier = Modifier.size(20.dp))
                                    }
                                }

                                Spacer(Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = item.rotulo,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = AthenesTextDark
                                        )
                                    )
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        text = item.descricao,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 11.sp,
                                            color = AthenesTextMuted,
                                            lineHeight = 15.sp
                                        )
                                    )
                                }

                                Icon(
                                    Icons.Rounded.ChevronRight,
                                    contentDescription = null,
                                    tint = Color(0xFF94A3B8),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
