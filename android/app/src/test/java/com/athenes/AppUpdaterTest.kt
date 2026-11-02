// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes

import com.athenes.core.updater.AppUpdater
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AppUpdaterTest {

    @Test
    fun testVersionComparison() {
        // Versões mais recentes
        assertTrue("1.0.1 deve ser mais recente que 1.0.0", AppUpdater.isVersionNewer("1.0.1", "1.0.0"))
        assertTrue("1.1.0 deve ser mais recente que 1.0.9", AppUpdater.isVersionNewer("1.1.0", "1.0.9"))
        assertTrue("2.0.0 deve ser mais recente que 1.99.99", AppUpdater.isVersionNewer("2.0.0", "1.99.99"))
        assertTrue("Prefixo 'v' deve ser suportado: v1.0.2 > 1.0.1", AppUpdater.isVersionNewer("v1.0.2", "1.0.1"))
        assertTrue("Sufixos como -beta devem ser comparados pelo núcleo numérico", AppUpdater.isVersionNewer("1.0.5-beta", "1.0.4"))

        // Versões iguais ou mais antigas
        assertFalse("1.0.0 não é mais recente que 1.0.0", AppUpdater.isVersionNewer("1.0.0", "1.0.0"))
        assertFalse("0.9.8 não é mais recente que 1.0.0", AppUpdater.isVersionNewer("0.9.8", "1.0.0"))
        assertFalse("1.0.0 não é mais recente que 1.0.1", AppUpdater.isVersionNewer("1.0.0", "1.0.1"))
    }

    @Test
    fun testParseInfoComNovaVersaoDisponivel() {
        val jsonString = """
            {
                "disponivel": true,
                "versao": "1.0.5",
                "nome": "athenes.apk",
                "tamanhoBytes": 10959328,
                "tamanhoFormatado": "10.5 MB",
                "atualizadoEm": "2026-11-02T12:00:00Z",
                "downloadUrl": "/athenes.apk",
                "notas": "Atualização do motor gráfico e rejeição de palma S-Pen."
            }
        """.trimIndent()

        val json = JSONObject(jsonString)
        val info = AppUpdater.parseInfo(json, currentVersion = "1.0.0")

        assertTrue("Deve constar como disponível", info.disponivel)
        assertEquals("1.0.5", info.versao)
        assertEquals("athenes.apk", info.nome)
        assertEquals(10959328L, info.tamanhoBytes)
        assertEquals("10.5 MB", info.tamanhoFormatado)
        assertEquals("/athenes.apk", info.downloadUrl)
        assertTrue("Deve detectar nova versão para cliente 1.0.0", info.temNovaVersao)
        assertTrue(info.notas.contains("S-Pen"))
        assertNull(info.mensagemErro)
    }

    @Test
    fun testParseInfoQuandoJaEstaNaVersaoMaisRecente() {
        val jsonString = """
            {
                "disponivel": true,
                "versao": "1.0.0",
                "nome": "athenes.apk",
                "tamanhoBytes": 10959328,
                "tamanhoFormatado": "10.5 MB",
                "downloadUrl": "/athenes.apk"
            }
        """.trimIndent()

        val json = JSONObject(jsonString)
        val info = AppUpdater.parseInfo(json, currentVersion = "1.0.0")

        assertTrue(info.disponivel)
        assertFalse("Não deve alertar nova versão se cliente já possui a mesma versão", info.temNovaVersao)
    }

    @Test
    fun testParseInfoIndisponivel() {
        val jsonString = """
            {
                "disponivel": false,
                "mensagem": "Servidor em manutenção."
            }
        """.trimIndent()

        val json = JSONObject(jsonString)
        val info = AppUpdater.parseInfo(json, currentVersion = "1.0.0")

        assertFalse(info.disponivel)
        assertFalse(info.temNovaVersao)
        assertEquals("Servidor em manutenção.", info.mensagemErro)
    }
}
