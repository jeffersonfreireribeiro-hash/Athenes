// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.core.updater

data class AppUpdateInfo(
    val disponivel: Boolean,
    val versao: String,
    val nome: String,
    val tamanhoBytes: Long,
    val tamanhoFormatado: String,
    val atualizadoEm: String,
    val downloadUrl: String,
    val downloadUrlFallback: String? = null,
    val notas: String = "",
    val temNovaVersao: Boolean = false,
    val mensagemErro: String? = null
)
