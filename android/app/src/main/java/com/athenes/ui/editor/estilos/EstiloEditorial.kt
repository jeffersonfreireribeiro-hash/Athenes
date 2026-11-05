// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.estilos

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.athenes.ui.editor.AlinhamentoTexto
import org.json.JSONObject
import java.util.UUID

/**
 * Modelo canônico de Estilo Editorial do Athenes, 100% interoperável com o schema
 * "athenes-tema-v1" (src/core/athenes_pacote_estilo.js e athenes_estilos.js).
 */
data class EstiloEditorial(
    val id: String,
    val nome: String,
    val fonteId: String = "nunito",
    val tamanhoPt: Double = 12.0,
    val peso: Int = 400,
    val italico: Boolean = false,
    val sublinhado: Boolean = false,
    val caixaAlta: Boolean = false,
    val alinhamento: AlinhamentoTexto = AlinhamentoTexto.JUSTIFICADO,
    val entrelinha: Double = 1.5,
    val espacoAntesPt: Double = 0.0,
    val espacoDepoisPt: Double = 0.0,
    val recuoPrimeiraLinhaMm: Double = 0.0,
    val recuoEsquerdoMm: Double = 0.0,
    val corHex: String = "#1F2733",
    val personalizado: Boolean = false,
    val recuoDeslocadoMm: Double = 0.0,
    val recuoDireitoMm: Double = 0.0,
    val hifenizacao: Boolean = false,
    val manterComProximo: Boolean = false
) {

    fun corCompose(): Color = parseCorHex(corHex)

    fun paraFontWeight(): FontWeight = when (peso) {
        in 100..349 -> FontWeight.Light
        in 350..499 -> FontWeight.Normal
        in 500..649 -> FontWeight.SemiBold
        in 650..749 -> FontWeight.Bold
        in 750..849 -> FontWeight.ExtraBold
        in 850..999 -> FontWeight.Black
        else -> FontWeight.Normal
    }

    fun paraTextAlign(): TextAlign = when (alinhamento) {
        AlinhamentoTexto.ESQUERDA -> TextAlign.Left
        AlinhamentoTexto.CENTRO -> TextAlign.Center
        AlinhamentoTexto.DIREITA -> TextAlign.Right
        AlinhamentoTexto.JUSTIFICADO,
        AlinhamentoTexto.JUSTIFICADO_ESQUERDA,
        AlinhamentoTexto.JUSTIFICADO_CENTRO,
        AlinhamentoTexto.JUSTIFICADO_DIREITA -> TextAlign.Justify
    }

    fun paraTextStyle(fontFamily: FontFamily? = null): TextStyle {
        val lh = tamanhoPt * entrelinha
        val lineHeightSegura = when {
            tamanhoPt > 0.0 && entrelinha > 0.0 -> lh.sp
            tamanhoPt == 0.0 || entrelinha == 0.0 -> 0.sp
            else -> TextUnit.Unspecified
        }
        return TextStyle(
            fontFamily = fontFamily ?: FontFamily.SansSerif,
            fontSize = tamanhoPt.sp,
            lineHeight = lineHeightSegura,
            fontWeight = paraFontWeight(),
            fontStyle = if (italico) FontStyle.Italic else FontStyle.Normal,
            textDecoration = if (sublinhado) TextDecoration.Underline else TextDecoration.None,
            color = corCompose(),
            textAlign = paraTextAlign()
        )
    }

    fun rotuloResumo(): String {
        val rotuloFonte = when (fonteId.lowercase()) {
            "nunito" -> "Nunito"
            "times" -> "Times"
            "arial" -> "Arial"
            "georgia" -> "Georgia"
            "garamond" -> "Garamond"
            "cambria" -> "Cambria"
            "calibri" -> "Calibri"
            "aptos" -> "Aptos"
            "consolas" -> "Consolas"
            else -> fonteId.replaceFirstChar { it.uppercase() }
        }
        val ptFormatado = if (tamanhoPt % 1.0 == 0.0) "${tamanhoPt.toInt()} pt" else "$tamanhoPt pt"
        return "$rotuloFonte · $ptFormatado · $peso"
    }

    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("nome", nome)
        json.put("fonte", fonteId) // chave canônica athenes-tema-v1
        json.put("fonteId", fonteId) // retrocompatibilidade
        json.put("tamanho_pt", tamanhoPt)
        json.put("tamanhoPt", tamanhoPt)
        json.put("peso", peso)
        json.put("italico", italico)
        json.put("sublinhado", sublinhado)
        json.put("caixa_alta", caixaAlta)
        json.put("caixaAlta", caixaAlta)
        json.put("alinhamento", alinhamento.name.lowercase())
        json.put("entrelinha", entrelinha)
        json.put("espaco_antes_pt", espacoAntesPt)
        json.put("espacoAntesPt", espacoAntesPt)
        json.put("espaco_depois_pt", espacoDepoisPt)
        json.put("espacoDepoisPt", espacoDepoisPt)
        json.put("recuo_primeira_linha_mm", recuoPrimeiraLinhaMm)
        json.put("recuoPrimeiraLinhaMm", recuoPrimeiraLinhaMm)
        json.put("recuo_esquerdo_mm", recuoEsquerdoMm)
        json.put("recuoEsquerdoMm", recuoEsquerdoMm)
        json.put("cor", corHex)
        json.put("corHex", corHex)
        json.put("personalizado", personalizado)
        json.put("recuo_deslocado_mm", recuoDeslocadoMm)
        json.put("recuo_direito_mm", recuoDireitoMm)
        json.put("hifenizacao", hifenizacao)
        json.put("manter_com_proximo", manterComProximo)
        return json
    }

    companion object {
        fun fromJson(json: JSONObject): EstiloEditorial {
            val id = json.optString("id", UUID.randomUUID().toString())
            val nome = json.optString("nome", "Estilo")
            val fonteId = json.optString("fonte", json.optString("fonteId", "nunito"))
            val tamanhoPt = json.optDouble("tamanho_pt", json.optDouble("tamanhoPt", 12.0))
            val peso = json.optInt("peso", 400)
            val italico = json.optBoolean("italico", false)
            val sublinhado = json.optBoolean("sublinhado", false)
            val caixaAlta = json.optBoolean("caixa_alta", json.optBoolean("caixaAlta", false))
            val alinhamentoStr = json.optString("alinhamento", "justificado").uppercase()
            val alinhamento = runCatching { AlinhamentoTexto.valueOf(alinhamentoStr) }
                .getOrDefault(AlinhamentoTexto.JUSTIFICADO)
            val entrelinha = json.optDouble("entrelinha", 1.5)
            val espacoAntesPt = json.optDouble("espaco_antes_pt", json.optDouble("espacoAntesPt", 0.0))
            val espacoDepoisPt = json.optDouble("espaco_depois_pt", json.optDouble("espacoDepoisPt", 0.0))
            val recuoPrimeiraLinhaMm = json.optDouble("recuo_primeira_linha_mm", json.optDouble("recuoPrimeiraLinhaMm", 0.0))
            val recuoEsquerdoMm = json.optDouble("recuo_esquerdo_mm", json.optDouble("recuoEsquerdoMm", 0.0))
            val corHex = json.optString("cor", json.optString("corHex", "#1F2733"))
            val personalizado = json.optBoolean("personalizado", false)
            val recuoDeslocadoMm = json.optDouble("recuo_deslocado_mm", 0.0)
            val recuoDireitoMm = json.optDouble("recuo_direito_mm", 0.0)
            val hifenizacao = json.optBoolean("hifenizacao", false)
            val manterComProximo = json.optBoolean("manter_com_proximo", false)

            return EstiloEditorial(
                id = id,
                nome = nome,
                fonteId = fonteId,
                tamanhoPt = tamanhoPt,
                peso = peso,
                italico = italico,
                sublinhado = sublinhado,
                caixaAlta = caixaAlta,
                alinhamento = alinhamento,
                entrelinha = entrelinha,
                espacoAntesPt = espacoAntesPt,
                espacoDepoisPt = espacoDepoisPt,
                recuoPrimeiraLinhaMm = recuoPrimeiraLinhaMm,
                recuoEsquerdoMm = recuoEsquerdoMm,
                corHex = corHex,
                personalizado = personalizado,
                recuoDeslocadoMm = recuoDeslocadoMm,
                recuoDireitoMm = recuoDireitoMm,
                hifenizacao = hifenizacao,
                manterComProximo = manterComProximo
            )
        }

        fun novoPersonalizado(id: String = UUID.randomUUID().toString(), nome: String = "Novo Estilo"): EstiloEditorial {
            return EstiloEditorial(
                id = id,
                nome = nome,
                fonteId = "nunito",
                tamanhoPt = 12.0,
                peso = 400,
                italico = false,
                sublinhado = false,
                caixaAlta = false,
                alinhamento = AlinhamentoTexto.JUSTIFICADO,
                entrelinha = 1.5,
                espacoAntesPt = 0.0,
                espacoDepoisPt = 6.0,
                recuoPrimeiraLinhaMm = 0.0,
                recuoEsquerdoMm = 0.0,
                corHex = "#1F2733",
                personalizado = true
            )
        }

        /**
         * Catálogo padrão de estilos de texto com paridade estrita ao Athenes Web
         * (src/core/athenes_estilos.js:criarEstilosPadrao('abnt')).
         */
        fun obterEstilosPadrao(): List<EstiloEditorial> {
            return listOf(
                EstiloEditorial(
                    id = "corpo",
                    nome = "Corpo de Texto (Normal)",
                    fonteId = "nunito",
                    tamanhoPt = 12.0,
                    peso = 400,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.JUSTIFICADO,
                    entrelinha = 1.5,
                    espacoAntesPt = 0.0,
                    espacoDepoisPt = 0.0, // ABNT usa recuo de 1ª linha sem espaço entre parágrafos
                    recuoPrimeiraLinhaMm = 12.5,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#1F2733",
                    personalizado = false,
                    hifenizacao = true
                ),
                EstiloEditorial(
                    id = "titulo1",
                    nome = "Título 1 (Seção Primária)",
                    fonteId = "nunito",
                    tamanhoPt = 14.0,
                    peso = 800,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = true, // ABNT exige caixa alta para seções primárias
                    alinhamento = AlinhamentoTexto.ESQUERDA,
                    entrelinha = 1.2,
                    espacoAntesPt = 18.0,
                    espacoDepoisPt = 8.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#1F2733",
                    personalizado = false,
                    manterComProximo = true
                ),
                EstiloEditorial(
                    id = "titulo2",
                    nome = "Título 2 (Seção Secundária)",
                    fonteId = "nunito",
                    tamanhoPt = 12.0,
                    peso = 700,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.ESQUERDA,
                    entrelinha = 1.25,
                    espacoAntesPt = 14.0,
                    espacoDepoisPt = 6.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#1F2733",
                    personalizado = false,
                    manterComProximo = true
                ),
                EstiloEditorial(
                    id = "titulo3",
                    nome = "Título 3 (Seção Terciária)",
                    fonteId = "nunito",
                    tamanhoPt = 12.0,
                    peso = 600,
                    italico = true, // ABNT admite itálico na terceira seção
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.ESQUERDA,
                    entrelinha = 1.3,
                    espacoAntesPt = 10.0,
                    espacoDepoisPt = 4.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#334155",
                    personalizado = false,
                    manterComProximo = true
                ),
                EstiloEditorial(
                    id = "subtitulo",
                    nome = "Subtítulo do Documento",
                    fonteId = "nunito",
                    tamanhoPt = 13.0,
                    peso = 600,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.CENTRO,
                    entrelinha = 1.35,
                    espacoAntesPt = 6.0,
                    espacoDepoisPt = 14.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#64748B",
                    personalizado = false,
                    manterComProximo = true
                ),
                EstiloEditorial(
                    id = "citacao_direta",
                    nome = "Citação Direta Longa",
                    fonteId = "nunito",
                    tamanhoPt = 10.0,
                    peso = 400,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.JUSTIFICADO,
                    entrelinha = 1.0, // Simples
                    espacoAntesPt = 8.0,
                    espacoDepoisPt = 8.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 40.0, // 4 cm ABNT
                    corHex = "#334155",
                    personalizado = false,
                    hifenizacao = true
                ),
                EstiloEditorial(
                    id = "legenda",
                    nome = "Legenda de Ilustração / Tabela",
                    fonteId = "nunito",
                    tamanhoPt = 10.0,
                    peso = 600,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.CENTRO,
                    entrelinha = 1.25,
                    espacoAntesPt = 6.0,
                    espacoDepoisPt = 2.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#475569",
                    personalizado = false,
                    manterComProximo = true
                ),
                EstiloEditorial(
                    id = "fonte_citada",
                    nome = "Fonte da Ilustração / Tabela",
                    fonteId = "nunito",
                    tamanhoPt = 9.0,
                    peso = 400,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.CENTRO,
                    entrelinha = 1.2,
                    espacoAntesPt = 2.0,
                    espacoDepoisPt = 8.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#64748B",
                    personalizado = false
                ),
                EstiloEditorial(
                    id = "nota_rodape",
                    nome = "Nota de Rodapé",
                    fonteId = "nunito",
                    tamanhoPt = 9.0,
                    peso = 400,
                    italico = false,
                    sublinhado = false,
                    caixaAlta = false,
                    alinhamento = AlinhamentoTexto.JUSTIFICADO,
                    entrelinha = 1.15,
                    espacoAntesPt = 2.0,
                    espacoDepoisPt = 2.0,
                    recuoPrimeiraLinhaMm = 0.0,
                    recuoEsquerdoMm = 0.0,
                    corHex = "#475569",
                    personalizado = false,
                    hifenizacao = true
                )
            )
        }
    }
}

/**
 * Converte com segurança códigos hexadecimais para androidx.compose.ui.graphics.Color
 * sem depender de android.graphics.Color.parseColor (compatível com JVM local / testes unitários).
 */
fun parseCorHex(hex: String, padrao: Color = Color(0xFF1F2733)): Color {
    val limpo = hex.trim().removePrefix("#")
    return try {
        when (limpo.length) {
            6 -> Color(0xFF000000L or limpo.toLong(16))
            8 -> Color(limpo.toLong(16))
            else -> padrao
        }
    } catch (_: Exception) {
        padrao
    }
}
