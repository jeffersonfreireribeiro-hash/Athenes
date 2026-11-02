// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.core.updater

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.athenes.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object AppUpdater {

    // Endpoints padrão para checar atualização:
    // 1. Servidor local do Athenes (10.0.2.2 no emulador ou 127.0.0.1)
    // 2. Repositório oficial GitHub (para quando o app estiver rodando fora da rede de desenvolvimento)
    val DEFAULT_ENDPOINTS = listOf(
        "http://10.0.2.2:3300/api/v1/app/info",
        "http://127.0.0.1:3300/api/v1/app/info",
        "https://raw.githubusercontent.com/jeffersonfreireribeiro-hash/Athenes/main/version.json"
    )

    /**
     * Compara duas versões semânticas (ex.: "1.0.1" vs "1.0.0").
     * Retorna true se remoteVersion for estritamente mais recente que currentVersion.
     */
    fun isVersionNewer(remoteVersion: String, currentVersion: String): Boolean {
        val rParts = remoteVersion.trim().removePrefix("v").split('-').first().split('.').mapNotNull { it.toIntOrNull() }
        val cParts = currentVersion.trim().removePrefix("v").split('-').first().split('.').mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(rParts.size, cParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val c = cParts.getOrElse(i) { 0 }
            if (r > c) return true
            if (r < c) return false
        }
        return false
    }

    fun parseInfo(json: JSONObject, currentVersion: String = BuildConfig.VERSION_NAME): AppUpdateInfo {
        val disponivel = json.optBoolean("disponivel", false)
        if (!disponivel) {
            return AppUpdateInfo(
                disponivel = false,
                versao = "",
                nome = "",
                tamanhoBytes = 0L,
                tamanhoFormatado = "",
                atualizadoEm = "",
                downloadUrl = "",
                temNovaVersao = false,
                mensagemErro = json.optString("mensagem", "Nenhum instalador disponível no servidor.")
            )
        }
        val versao = json.optString("versao", "")
        val nome = json.optString("nome", "athenes.apk")
        val tamanhoBytes = json.optLong("tamanhoBytes", 0L)
        val tamanhoFormatado = json.optString("tamanhoFormatado", "")
        val atualizadoEm = json.optString("atualizadoEm", "")
        val downloadUrl = json.optString("downloadUrl", "/athenes.apk")
        val downloadUrlFallback = json.optString("downloadUrlFallback", "").takeIf { it.isNotBlank() }
        val notas = json.optString("notas", "")
        val temNovaVersao = isVersionNewer(versao, currentVersion)

        return AppUpdateInfo(
            disponivel = true,
            versao = versao,
            nome = nome,
            tamanhoBytes = tamanhoBytes,
            tamanhoFormatado = tamanhoFormatado,
            atualizadoEm = atualizadoEm,
            downloadUrl = downloadUrl,
            downloadUrlFallback = downloadUrlFallback,
            notas = notas,
            temNovaVersao = temNovaVersao
        )
    }

    suspend fun checkUpdate(
        endpoints: List<String> = DEFAULT_ENDPOINTS,
        currentVersion: String = BuildConfig.VERSION_NAME
    ): AppUpdateInfo = withContext(Dispatchers.IO) {
        var ultimoErro: String? = null

        for (endpoint in endpoints) {
            try {
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 4_000
                    readTimeout = 6_000
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    val code = conn.responseCode
                    if (code in 200..299) {
                        val text = conn.inputStream.bufferedReader().use { it.readText() }
                        val json = JSONObject(text)
                        val info = parseInfo(json, currentVersion)
                        // Se o downloadUrl for relativo e o endpoint for HTTP, prefixar com a base do endpoint
                        val urlAjustada = if (info.downloadUrl.startsWith("/") && endpoint.startsWith("http")) {
                            val uri = Uri.parse(endpoint)
                            "${uri.scheme}://${uri.authority}${info.downloadUrl}"
                        } else {
                            info.downloadUrl
                        }
                        return@withContext info.copy(downloadUrl = urlAjustada)
                    } else {
                        ultimoErro = "Servidor respondeu com código $code em $endpoint"
                    }
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                ultimoErro = e.localizedMessage ?: "falha de conexão"
            }
        }

        AppUpdateInfo(
            disponivel = false,
            versao = "",
            nome = "",
            tamanhoBytes = 0L,
            tamanhoFormatado = "",
            atualizadoEm = "",
            downloadUrl = "",
            mensagemErro = "Não foi possível verificar atualizações: ${ultimoErro ?: "sem conexão"}"
        )
    }

    suspend fun downloadApk(
        context: Context,
        downloadUrl: String,
        fallbackUrl: String? = null,
        expectedBytes: Long = 0L,
        onProgress: (bytesDownloaded: Long, totalBytes: Long, progress: Float) -> Unit
    ): File = withContext(Dispatchers.IO) {
        val urlsToTry = mutableListOf(downloadUrl)
        if (!fallbackUrl.isNullOrBlank() && fallbackUrl != downloadUrl) {
            urlsToTry.add(fallbackUrl)
        }

        var ultimoErro: Exception? = null

        for (targetUrl in urlsToTry) {
            try {
                val conn = (URL(targetUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 15_000
                    readTimeout = 60_000
                    instanceFollowRedirects = true
                    setRequestProperty("Accept", "application/vnd.android.package-archive, */*")
                }

                try {
                    val code = conn.responseCode
                    if (code !in 200..299) {
                        throw IOException("HTTP $code ao acessar $targetUrl")
                    }

                    val totalBytes = conn.contentLengthLong.takeIf { it > 0 } ?: expectedBytes
                    val destDir = File(context.cacheDir, "apk_updates")
                    destDir.mkdirs()
                    destDir.listFiles()?.forEach { runCatching { it.delete() } }

                    val targetFile = File(destDir, "athenes_update.apk")
                    val partFile = File(destDir, "athenes_update.apk.part")

                    var downloaded = 0L
                    conn.inputStream.use { input ->
                        FileOutputStream(partFile).use { output ->
                            val buffer = ByteArray(32 * 1024)
                            var read: Int
                            var lastNotify = 0L
                            while (input.read(buffer).also { read = it } != -1) {
                                output.write(buffer, 0, read)
                                downloaded += read
                                val now = System.currentTimeMillis()
                                if (now - lastNotify > 100 || downloaded == totalBytes) {
                                    lastNotify = now
                                    val progress = if (totalBytes > 0) (downloaded.toFloat() / totalBytes).coerceIn(0f, 1f) else 0f
                                    withContext(Dispatchers.Main) {
                                        onProgress(downloaded, totalBytes, progress)
                                    }
                                }
                            }
                            output.flush()
                        }
                    }

                    if (targetFile.exists()) targetFile.delete()
                    if (!partFile.renameTo(targetFile)) {
                        partFile.copyTo(targetFile, overwrite = true)
                        partFile.delete()
                    }

                    withContext(Dispatchers.Main) {
                        onProgress(downloaded, totalBytes, 1f)
                    }

                    return@withContext targetFile
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                ultimoErro = e
            }
        }

        throw ultimoErro ?: IOException("Falha no download da atualização.")
    }

    fun canRequestInstalls(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    fun openInstallPermissionSettings(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun installApk(context: Context, apkFile: File) {
        require(apkFile.exists()) { "Instalador APK não encontrado em ${apkFile.absolutePath}" }

        val apkUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.files",
            apkFile
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
