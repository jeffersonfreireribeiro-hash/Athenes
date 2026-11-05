// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.athenes.ui.editor.AlinhamentoTexto
import com.athenes.ui.editor.estilos.CatalogoFontes
import com.athenes.ui.editor.estilos.EstiloEditorial
import com.athenes.ui.editor.estilos.parseCorHex
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class EstiloEditorialStressTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    // ------------------------------------------------------------------------
    // 1. Athenes Web JSON Roundtrip & Schema Conformance
    // ------------------------------------------------------------------------

    @Test
    fun `deve desserializar todos os 14 estilos canonicos gerados pelo Athenes Web`() {
        val jsonWebStr = """
        [
          {"id":"titulo1","nome":"Título 1 (Seção Primária)","tipo":"paragrafo","fonte":"nunito","tamanho_pt":14,"peso":800,"cor":"#1F2733","italico":false,"sublinhado":false,"caixa_alta":true,"alinhamento":"esquerda","entrelinha":1.2,"espaco_antes_pt":18,"espaco_depois_pt":8,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"titulo2","nome":"Título 2 (Seção Secundária)","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":700,"cor":"#1F2733","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1.25,"espaco_antes_pt":14,"espaco_depois_pt":6,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"titulo3","nome":"Título 3 (Seção Terciária)","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":600,"cor":"#334155","italico":true,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1.3,"espaco_antes_pt":10,"espaco_depois_pt":4,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"titulo4","nome":"Título 4 (Seção Quaternária)","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":600,"cor":"#334155","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1.3,"espaco_antes_pt":8,"espaco_depois_pt":4,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"titulo5","nome":"Título 5 (Seção Quinária)","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":400,"cor":"#334155","italico":true,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1.3,"espaco_antes_pt":6,"espaco_depois_pt":3,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"titulo6","nome":"Título 6 (Seção Senária)","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":400,"cor":"#475569","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1.3,"espaco_antes_pt":6,"espaco_depois_pt":3,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"subtitulo","nome":"Subtítulo do Documento","tipo":"paragrafo","fonte":"nunito","tamanho_pt":13,"peso":600,"cor":"#64748B","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"centro","entrelinha":1.35,"espaco_antes_pt":6,"espaco_depois_pt":14,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"corpo","nome":"Corpo de Texto","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":400,"cor":"#1F2733","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"justificado","entrelinha":1.5,"espaco_antes_pt":0,"espaco_depois_pt":0,"recuo_primeira_linha_mm":12.5,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":true,"manter_com_proximo":false},
          {"id":"citacao_direta","nome":"Citação Direta Longa","tipo":"paragrafo","fonte":"nunito","tamanho_pt":10,"peso":400,"cor":"#334155","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"justificado","entrelinha":1,"espaco_antes_pt":8,"espaco_depois_pt":8,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":40,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":true,"manter_com_proximo":false},
          {"id":"legenda","nome":"Legenda de Figura / Tabela","tipo":"paragrafo","fonte":"nunito","tamanho_pt":10,"peso":600,"cor":"#475569","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"centro","entrelinha":1.25,"espaco_antes_pt":6,"espaco_depois_pt":2,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":true},
          {"id":"fonte_citada","nome":"Fonte da Ilustração / Tabela","tipo":"paragrafo","fonte":"nunito","tamanho_pt":9,"peso":400,"cor":"#64748B","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"centro","entrelinha":1.2,"espaco_antes_pt":2,"espaco_depois_pt":8,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":false},
          {"id":"nota_rodape","nome":"Nota de Rodapé","tipo":"paragrafo","fonte":"nunito","tamanho_pt":9,"peso":400,"cor":"#475569","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"justificado","entrelinha":1.15,"espaco_antes_pt":2,"espaco_depois_pt":2,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":true,"manter_com_proximo":false},
          {"id":"referencias","nome":"Item de Referência Bibliográfica","tipo":"paragrafo","fonte":"nunito","tamanho_pt":12,"peso":400,"cor":"#1F2733","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1,"espaco_antes_pt":0,"espaco_depois_pt":6,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":0,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":false},
          {"id":"codigo","nome":"Código / Algoritmo","tipo":"paragrafo","fonte":"nunito","tamanho_pt":9.5,"peso":400,"cor":"#0F172A","italico":false,"sublinhado":false,"caixa_alta":false,"alinhamento":"esquerda","entrelinha":1.35,"espaco_antes_pt":6,"espaco_depois_pt":6,"recuo_primeira_linha_mm":0,"recuo_esquerdo_mm":6,"recuo_deslocado_mm":0,"espacamento_letras_em":0,"hifenizacao":false,"manter_com_proximo":false}
        ]
        """.trimIndent()

        val jsonArray = JSONArray(jsonWebStr)
        assertEquals(14, jsonArray.length())

        val estilos = mutableListOf<EstiloEditorial>()
        for (i in 0 until jsonArray.length()) {
            val obj = jsonArray.getJSONObject(i)
            val estilo = EstiloEditorial.fromJson(obj)
            estilos.add(estilo)

            // Validações fundamentais
            assertNotNull(estilo.id)
            assertNotNull(estilo.nome)
            assertEquals("nunito", estilo.fonteId)

            // Roundtrip de volta para JSON deve manter chaves canônicas do tema v1
            val reexportado = estilo.toJson()
            assertEquals(estilo.fonteId, reexportado.getString("fonte"))
            assertEquals(estilo.tamanhoPt, reexportado.getDouble("tamanho_pt"), 0.001)
            assertEquals(estilo.corHex, reexportado.getString("cor"))
        }

        // Verifica estilos específicos
        val t1 = estilos.find { it.id == "titulo1" }!!
        assertTrue(t1.caixaAlta)
        assertEquals(AlinhamentoTexto.ESQUERDA, t1.alinhamento)
        assertEquals(14.0, t1.tamanhoPt, 0.001)

        val corpo = estilos.find { it.id == "corpo" }!!
        assertEquals(12.5, corpo.recuoPrimeiraLinhaMm, 0.001)
        assertEquals(AlinhamentoTexto.JUSTIFICADO, corpo.alinhamento)

        val citacao = estilos.find { it.id == "citacao_direta" }!!
        assertEquals(40.0, citacao.recuoEsquerdoMm, 0.001)
        assertEquals(1.0, citacao.entrelinha, 0.001)

        val codigo = estilos.find { it.id == "codigo" }!!
        assertEquals(9.5, codigo.tamanhoPt, 0.001)
        assertEquals(6.0, codigo.recuoEsquerdoMm, 0.001)
    }

    // ------------------------------------------------------------------------
    // 2. Missing Fields and Null Tolerance
    // ------------------------------------------------------------------------

    @Test
    fun `deve tolerar objeto JSON completamente vazio sem lancar excecao`() {
        val vazio = JSONObject("{}")
        val estilo = EstiloEditorial.fromJson(vazio)

        assertNotNull(estilo.id)
        assertEquals("Estilo", estilo.nome)
        assertEquals("nunito", estilo.fonteId)
        assertEquals(12.0, estilo.tamanhoPt, 0.001)
        assertEquals(400, estilo.peso)
        assertFalse(estilo.italico)
        assertFalse(estilo.sublinhado)
        assertFalse(estilo.caixaAlta)
        assertEquals(AlinhamentoTexto.JUSTIFICADO, estilo.alinhamento)
        assertEquals(1.5, estilo.entrelinha, 0.001)
        assertEquals("#1F2733", estilo.corHex)
        assertFalse(estilo.personalizado)
    }

    @Test
    fun `deve tolerar campos com valores explicitamente nulos sem travar`() {
        val jsonComNulos = JSONObject().apply {
            put("id", JSONObject.NULL)
            put("nome", JSONObject.NULL)
            put("fonte", JSONObject.NULL)
            put("tamanho_pt", JSONObject.NULL)
            put("peso", JSONObject.NULL)
            put("italico", JSONObject.NULL)
            put("alinhamento", JSONObject.NULL)
            put("cor", JSONObject.NULL)
            put("entrelinha", JSONObject.NULL)
        }

        val estilo = EstiloEditorial.fromJson(jsonComNulos)
        assertNotNull(estilo)
        // Quando JSONObject.NULL é passado, optString/optDouble devem recorrer aos defaults ou valores seguros
        assertNotNull(estilo.id)
        assertNotNull(estilo.nome)
        assertNotNull(estilo.alinhamento)
        // Verifica que corCompose() opera com segurança mesmo com cor nula/invalida
        val cor = estilo.corCompose()
        assertNotNull(cor)
    }

    @Test
    fun `deve suportar matriz mista snake_case e camelCase`() {
        val jsonMisto = JSONObject().apply {
            put("id", "estilo_misto")
            put("nome", "Misto Test")
            put("fonteId", "times")
            put("tamanho_pt", 14.5)
            put("caixaAlta", true)
            put("espaco_antes_pt", 16.0)
            put("espacoDepoisPt", 8.0)
            put("recuo_primeira_linha_mm", 10.0)
            put("recuoEsquerdoMm", 20.0)
            put("cor", "#10B981")
        }

        val estilo = EstiloEditorial.fromJson(jsonMisto)
        assertEquals("times", estilo.fonteId)
        assertEquals(14.5, estilo.tamanhoPt, 0.001)
        assertTrue(estilo.caixaAlta)
        assertEquals(16.0, estilo.espacoAntesPt, 0.001)
        assertEquals(8.0, estilo.espacoDepoisPt, 0.001)
        assertEquals(10.0, estilo.recuoPrimeiraLinhaMm, 0.001)
        assertEquals(20.0, estilo.recuoEsquerdoMm, 0.001)
        assertEquals("#10B981", estilo.corHex)
    }

    // ------------------------------------------------------------------------
    // 3. Boundary Inputs: Extreme Font Sizes, Colors, Line Heights, Empty Strings
    // ------------------------------------------------------------------------

    @Test
    fun `deve tratar tamanhos extremos de fonte (0 pt, 500 pt, negativos) sem lancar excecao`() {
        // Zero pt
        val zero = EstiloEditorial(id = "zero", nome = "Zero", tamanhoPt = 0.0)
        assertEquals("0 pt", zero.rotuloResumo().split(" · ")[1])
        val styleZero = zero.paraTextStyle()
        assertEquals(0.sp, styleZero.fontSize)

        // 500 pt
        val enorme = EstiloEditorial(id = "enorme", nome = "Enorme", tamanhoPt = 500.0)
        assertEquals("500 pt", enorme.rotuloResumo().split(" · ")[1])
        val styleEnorme = enorme.paraTextStyle()
        assertEquals(500.sp, styleEnorme.fontSize)

        // Negativo
        val negativo = EstiloEditorial(id = "negativo", nome = "Negativo", tamanhoPt = -10.0)
        val styleNegativo = negativo.paraTextStyle()
        assertEquals((-10).sp, styleNegativo.fontSize)
    }

    @Test
    fun `deve tratar cores hexadecimais invalidas com fallback seguro`() {
        val padrao = Color(0xFF1F2733)

        // Vazia
        assertEquals(padrao, parseCorHex(""))
        assertEquals(padrao, parseCorHex("   "))

        // Inválida #XYZ
        assertEquals(padrao, parseCorHex("#XYZ"))
        assertEquals(padrao, parseCorHex("XYZ"))

        // Inválida com 6 caracteres não hexadecimais
        assertEquals(padrao, parseCorHex("#GGGGGG"))
        assertEquals(padrao, parseCorHex("ZZZZZZ"))

        // 3 dígitos (não é formato canônico de 6 ou 8 dígitos do tema v1, deve retornar fallback com segurança)
        val cor3 = parseCorHex("#FFF")
        assertEquals(padrao, cor3)

        // 8 dígitos válido ARGB
        val cor8 = parseCorHex("#801F2733")
        assertNotNull(cor8)
        assertEquals(Color(0x801F2733L), cor8)

        // 6 dígitos válido
        val cor6 = parseCorHex("#314F79")
        assertEquals(Color(0xFF314F79), cor6)
    }

    @Test
    fun `deve tratar entrelinhas extremas e negativas sem quebrar`() {
        // Negativa
        val estiloNeg = EstiloEditorial(id = "neg_line", nome = "Neg", tamanhoPt = 12.0, entrelinha = -1.5)
        val styleNeg = estiloNeg.paraTextStyle()
        assertEquals(TextUnit.Unspecified, styleNeg.lineHeight)

        // Zero
        val estiloZero = EstiloEditorial(id = "zero_line", nome = "Zero", tamanhoPt = 12.0, entrelinha = 0.0)
        val styleZero = estiloZero.paraTextStyle()
        assertEquals(0.sp, styleZero.lineHeight)

        // Grande
        val estiloGrande = EstiloEditorial(id = "grande_line", nome = "Grande", tamanhoPt = 10.0, entrelinha = 10.0)
        val styleGrande = estiloGrande.paraTextStyle()
        assertEquals(100.sp, styleGrande.lineHeight)
    }

    @Test
    fun `deve suportar strings vazias em campos de identificacao e fonte`() {
        val estiloVazio = EstiloEditorial(
            id = "",
            nome = "",
            fonteId = "",
            corHex = ""
        )

        // Não deve estourar IndexOutOfBoundsException nem NullPointerException
        val resumo = estiloVazio.rotuloResumo()
        assertNotNull(resumo)

        val textStyle = estiloVazio.paraTextStyle()
        assertNotNull(textStyle)
        assertEquals(Color(0xFF1F2733), textStyle.color)
    }

    // ------------------------------------------------------------------------
    // 4. CatalogoFontes: Fallback, Non-existent and Corrupted TTF Files
    // ------------------------------------------------------------------------

    @Test
    fun `criarFontFamilyDeArquivo deve retornar FontFamily Default para arquivo inexistente sem travar`() {
        val arquivoInexistente = File(tempFolder.root, "fonte_que_nao_existe_12345.ttf")
        assertFalse(arquivoInexistente.exists())

        val ff = CatalogoFontes.criarFontFamilyDeArquivo(arquivoInexistente)
        assertNotNull(ff)
        assertEquals(FontFamily.Default, ff)
    }

    @Test
    fun `criarFontFamilyDeArquivo deve retornar FontFamily Default para arquivo TTF corrompido ou vazio`() {
        // Arquivo vazio (0 bytes)
        val arquivoVazio = tempFolder.newFile("corrompido_zero.ttf")
        assertTrue(arquivoVazio.exists())
        assertEquals(0L, arquivoVazio.length())

        val ffVazio = CatalogoFontes.criarFontFamilyDeArquivo(arquivoVazio)
        assertNotNull(ffVazio)
        assertEquals(FontFamily.Default, ffVazio)

        // Arquivo com lixo / não-TTF
        val arquivoLixo = tempFolder.newFile("corrompido_lixo.ttf")
        arquivoLixo.writeText("ISTO_NAO_E_UM_ARQUIVO_DE_FONTE_TTF_VALIDO_HEADER_CORROMPIDO")
        val ffLixo = CatalogoFontes.criarFontFamilyDeArquivo(arquivoLixo)
        assertNotNull(ffLixo)
        assertEquals(FontFamily.Default, ffLixo)
    }

    @Test
    fun `CatalogoFontes FONTES_SISTEMA deve cobrir todas as 9 familias com fontes Compose validas`() {
        val fontes = CatalogoFontes.FONTES_SISTEMA
        assertEquals(9, fontes.size)

        for (f in fontes) {
            assertNotNull(f.id)
            assertNotNull(f.rotulo)
            assertNotNull(f.fontFamily)
            assertTrue(f.familiaCss.isNotBlank())
        }

        // Times e Georgia devem ter serifa
        assertTrue(fontes.first { it.id == "times" }.ehSerif)
        assertTrue(fontes.first { it.id == "georgia" }.ehSerif)

        // Nunito e Arial não devem ter serifa
        assertFalse(fontes.first { it.id == "nunito" }.ehSerif)
        assertFalse(fontes.first { it.id == "arial" }.ehSerif)

        // Consolas deve ser monospace
        assertEquals(FontFamily.Monospace, fontes.first { it.id == "consolas" }.fontFamily)
    }
}
