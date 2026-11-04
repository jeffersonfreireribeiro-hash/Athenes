package com.athenes.core.model

import org.json.JSONObject

object ConfiguracaoPaginaCodec {
    fun escrever(config: ConfiguracaoPagina): JSONObject = JSONObject().apply {
        put("formato", config.formato.name)
        put("paisagem", config.paisagem)
        put("larguraPersonalizadaMm", config.larguraPersonalizadaMm)
        put("alturaPersonalizadaMm", config.alturaPersonalizadaMm)
        put("margemSuperiorMm", config.margemSuperiorMm)
        put("margemDireitaMm", config.margemDireitaMm)
        put("margemInferiorMm", config.margemInferiorMm)
        put("margemEsquerdaMm", config.margemEsquerdaMm)
    }

    fun ler(json: JSONObject?): ConfiguracaoPagina {
        if (json == null) return ConfiguracaoPagina()
        val padrao = ConfiguracaoPagina()
        val formato = runCatching { FormatoPagina.valueOf(json.optString("formato")) }.getOrDefault(FormatoPagina.A4)
        val config = ConfiguracaoPagina(
            formato = formato,
            paisagem = json.optBoolean("paisagem"),
            larguraPersonalizadaMm = json.optDouble("larguraPersonalizadaMm", padrao.larguraPersonalizadaMm),
            alturaPersonalizadaMm = json.optDouble("alturaPersonalizadaMm", padrao.alturaPersonalizadaMm),
            margemSuperiorMm = json.optDouble("margemSuperiorMm", padrao.margemSuperiorMm),
            margemDireitaMm = json.optDouble("margemDireitaMm", padrao.margemDireitaMm),
            margemInferiorMm = json.optDouble("margemInferiorMm", padrao.margemInferiorMm),
            margemEsquerdaMm = json.optDouble("margemEsquerdaMm", padrao.margemEsquerdaMm)
        )
        return config.takeIf(ConfiguracaoPagina::validar) ?: padrao
    }
}
