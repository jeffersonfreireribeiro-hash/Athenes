// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes

import androidx.compose.ui.graphics.Color
import com.athenes.ui.editor.AlinhamentoTexto
import com.athenes.ui.editor.EditorViewModel
import com.athenes.ui.editor.TipoBlocoEditor
import com.athenes.ui.editor.estilos.CatalogoFontes
import com.athenes.ui.editor.estilos.EstiloEditorial
import com.athenes.ui.editor.estilos.parseCorHex
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EstiloEditorialTest {

    @Test
    fun `obterEstilosPadrao deve conter os 9 estilos canonicos com propriedades ABNT corretas`() {
        val estilos = EstiloEditorial.obterEstilosPadrao()
        assertEquals(9, estilos.size)

        val ids = estilos.map { it.id }.toSet()
        val idsEsperados = setOf(
            "corpo", "titulo1", "titulo2", "titulo3", "subtitulo",
            "citacao_direta", "legenda", "fonte_citada", "nota_rodape"
        )
        assertEquals(idsEsperados, ids)

        val corpo = estilos.find { it.id == "corpo" }
        assertNotNull(corpo)
        assertEquals("Corpo de Texto (Normal)", corpo!!.nome)
        assertEquals(12.0, corpo.tamanhoPt, 0.001)
        assertEquals(400, corpo.peso)
        assertEquals(AlinhamentoTexto.JUSTIFICADO, corpo.alinhamento)
        assertEquals(1.5, corpo.entrelinha, 0.001)
        assertEquals(12.5, corpo.recuoPrimeiraLinhaMm, 0.001)
        assertFalse(corpo.personalizado)

        val titulo1 = estilos.find { it.id == "titulo1" }
        assertNotNull(titulo1)
        assertEquals(14.0, titulo1!!.tamanhoPt, 0.001)
        assertEquals(800, titulo1.peso)
        assertTrue(titulo1.caixaAlta) // Obrigatório ABNT
        assertEquals(AlinhamentoTexto.ESQUERDA, titulo1.alinhamento)
        assertEquals(18.0, titulo1.espacoAntesPt, 0.001)
        assertTrue(titulo1.manterComProximo)

        val citacao = estilos.find { it.id == "citacao_direta" }
        assertNotNull(citacao)
        assertEquals(10.0, citacao!!.tamanhoPt, 0.001)
        assertEquals(1.0, citacao.entrelinha, 0.001)
        assertEquals(40.0, citacao.recuoEsquerdoMm, 0.001) // 4 cm ABNT
    }

    @Test
    fun `serializacao e desserializacao JSON preserva conformidade com schema athenes-tema-v1`() {
        val original = EstiloEditorial(
            id = "estilo_custom_1",
            nome = "Destaque Científico",
            fonteId = "times",
            tamanhoPt = 15.5,
            peso = 700,
            italico = true,
            sublinhado = true,
            caixaAlta = false,
            alinhamento = AlinhamentoTexto.CENTRO,
            entrelinha = 1.25,
            espacoAntesPt = 12.0,
            espacoDepoisPt = 8.0,
            recuoPrimeiraLinhaMm = 5.0,
            recuoEsquerdoMm = 10.0,
            corHex = "#059669",
            personalizado = true
        )

        val json = original.toJson()
        assertEquals("times", json.getString("fonte"))
        assertEquals(15.5, json.getDouble("tamanho_pt"), 0.001)
        assertEquals(700, json.getInt("peso"))
        assertTrue(json.getBoolean("italico"))
        assertEquals("centro", json.getString("alinhamento"))
        assertEquals("#059669", json.getString("cor"))
        assertTrue(json.getBoolean("personalizado"))

        val restaurado = EstiloEditorial.fromJson(json)
        assertEquals(original.id, restaurado.id)
        assertEquals(original.nome, restaurado.nome)
        assertEquals(original.fonteId, restaurado.fonteId)
        assertEquals(original.tamanhoPt, restaurado.tamanhoPt, 0.001)
        assertEquals(original.peso, restaurado.peso)
        assertEquals(original.italico, restaurado.italico)
        assertEquals(original.sublinhado, restaurado.sublinhado)
        assertEquals(original.caixaAlta, restaurado.caixaAlta)
        assertEquals(original.alinhamento, restaurado.alinhamento)
        assertEquals(original.entrelinha, restaurado.entrelinha, 0.001)
        assertEquals(original.espacoAntesPt, restaurado.espacoAntesPt, 0.001)
        assertEquals(original.espacoDepoisPt, restaurado.espacoDepoisPt, 0.001)
        assertEquals(original.recuoPrimeiraLinhaMm, restaurado.recuoPrimeiraLinhaMm, 0.001)
        assertEquals(original.recuoEsquerdoMm, restaurado.recuoEsquerdoMm, 0.001)
        assertEquals(original.corHex, restaurado.corHex)
        assertTrue(restaurado.personalizado)
    }

    @Test
    fun `desserializacao tolerante suporta tanto snake_case quanto camelCase`() {
        // Exemplo puro em snake_case canônico Web
        val jsonWeb = JSONObject().apply {
            put("id", "estilo_web")
            put("nome", "Estilo Web Puro")
            put("fonte", "georgia")
            put("tamanho_pt", 13.0)
            put("peso", 600)
            put("caixa_alta", true)
            put("alinhamento", "esquerda")
            put("espaco_antes_pt", 10.0)
            put("espaco_depois_pt", 4.0)
            put("recuo_primeira_linha_mm", 12.5)
            put("cor", "#314F79")
        }

        val estiloWeb = EstiloEditorial.fromJson(jsonWeb)
        assertEquals("estilo_web", estiloWeb.id)
        assertEquals("georgia", estiloWeb.fonteId)
        assertEquals(13.0, estiloWeb.tamanhoPt, 0.001)
        assertTrue(estiloWeb.caixaAlta)
        assertEquals(AlinhamentoTexto.ESQUERDA, estiloWeb.alinhamento)
        assertEquals("#314F79", estiloWeb.corHex)

        // Exemplo camelCase
        val jsonCamel = JSONObject().apply {
            put("id", "estilo_camel")
            put("nome", "Estilo CamelCase")
            put("fonteId", "aptos")
            put("tamanhoPt", 11.0)
            put("caixaAlta", false)
            put("corHex", "#475569")
        }

        val estiloCamel = EstiloEditorial.fromJson(jsonCamel)
        assertEquals("estilo_camel", estiloCamel.id)
        assertEquals("aptos", estiloCamel.fonteId)
        assertEquals(11.0, estiloCamel.tamanhoPt, 0.001)
        assertFalse(estiloCamel.caixaAlta)
        assertEquals("#475569", estiloCamel.corHex)
    }

    @Test
    fun `aplicarEstiloAoBloco atualiza tipo do bloco, nivel do titulo e alinhamento`() {
        val vm = EditorViewModel()
        val blocoId = vm.blocos.value.first().id
        vm.selecionarBloco(blocoId)

        // Aplica Título 1: deve virar TITULO com nivel 1 e alinhamento ESQUERDA
        vm.aplicarEstiloAoBloco(blocoId, "titulo1")
        var blocoAtual = vm.blocos.value.find { it.id == blocoId }!!
        assertEquals("titulo1", blocoAtual.estiloId)
        assertEquals(TipoBlocoEditor.TITULO, blocoAtual.tipo)
        assertEquals(1, blocoAtual.nivelTitulo)
        assertEquals(AlinhamentoTexto.ESQUERDA, blocoAtual.alinhamento)

        // Aplica Título 2: deve virar TITULO com nivel 2
        vm.aplicarEstiloAoBloco(blocoId, "titulo2")
        blocoAtual = vm.blocos.value.find { it.id == blocoId }!!
        assertEquals("titulo2", blocoAtual.estiloId)
        assertEquals(TipoBlocoEditor.TITULO, blocoAtual.tipo)
        assertEquals(2, blocoAtual.nivelTitulo)

        // Aplica Citação Direta: deve virar CITACAO
        vm.aplicarEstiloAoBloco(blocoId, "citacao_direta")
        blocoAtual = vm.blocos.value.find { it.id == blocoId }!!
        assertEquals("citacao_direta", blocoAtual.estiloId)
        assertEquals(TipoBlocoEditor.CITACAO, blocoAtual.tipo)
        assertEquals(AlinhamentoTexto.JUSTIFICADO, blocoAtual.alinhamento)

        // Aplica Corpo: deve virar PARAGRAFO
        vm.aplicarEstiloAoBloco(blocoId, "corpo")
        blocoAtual = vm.blocos.value.find { it.id == blocoId }!!
        assertEquals("corpo", blocoAtual.estiloId)
        assertEquals(TipoBlocoEditor.PARAGRAFO, blocoAtual.tipo)
    }

    @Test
    fun `salvarEstilo adiciona estilo customizado e removerEstilo reverte blocos afetados`() {
        val vm = EditorViewModel()
        val custom = EstiloEditorial(
            id = "estilo_novo_teste",
            nome = "Meu Estilo Especial",
            personalizado = true
        )
        vm.salvarEstilo(custom)
        assertNotNull(vm.estilos.value.find { it.id == "estilo_novo_teste" })

        val blocoId = vm.blocos.value.first().id
        vm.aplicarEstiloAoBloco(blocoId, "estilo_novo_teste")
        assertEquals("estilo_novo_teste", vm.blocos.value.find { it.id == blocoId }?.estiloId)

        // Exclusão de estilo personalizado reverte bloco para 'corpo'
        vm.removerEstilo("estilo_novo_teste")
        assertNull(vm.estilos.value.find { it.id == "estilo_novo_teste" })
        assertEquals("corpo", vm.blocos.value.find { it.id == blocoId }?.estiloId)

        // Exclusão de estilo nativo 'corpo' é bloqueada
        vm.removerEstilo("corpo")
        assertNotNull(vm.estilos.value.find { it.id == "corpo" })
    }

    @Test
    fun `historico de desfazer e refazer preserva aplicacao e estados de estilos`() {
        val vm = EditorViewModel()
        val blocoId = vm.blocos.value.first().id
        vm.selecionarBloco(blocoId)

        vm.aplicarEstiloAoBloco(blocoId, "titulo1")
        assertEquals("titulo1", vm.blocos.value.find { it.id == blocoId }?.estiloId)

        vm.aplicarEstiloAoBloco(blocoId, "citacao_direta")
        assertEquals("citacao_direta", vm.blocos.value.find { it.id == blocoId }?.estiloId)

        vm.desfazer()
        assertEquals("titulo1", vm.blocos.value.find { it.id == blocoId }?.estiloId)

        vm.refazer()
        assertEquals("citacao_direta", vm.blocos.value.find { it.id == blocoId }?.estiloId)
    }

    @Test
    fun `parseCorHex lida com formatos hex de 6 e 8 digitos e entradas invalidas`() {
        val cor6 = parseCorHex("#1F2733")
        assertEquals(Color(0xFF1F2733), cor6)

        val corSemHash = parseCorHex("314F79")
        assertEquals(Color(0xFF314F79), corSemHash)

        val corInvalida = parseCorHex("invalido", Color(0xFF123456))
        assertEquals(Color(0xFF123456), corInvalida)
    }

    @Test
    fun `CatalogoFontes possui as 9 familias canonicas do Athenes Web`() {
        val fontes = CatalogoFontes.FONTES_SISTEMA
        assertEquals(9, fontes.size)
        val ids = fontes.map { it.id }.toSet()
        val esperados = setOf("nunito", "times", "arial", "georgia", "garamond", "cambria", "calibri", "aptos", "consolas")
        assertEquals(esperados, ids)
    }
}
