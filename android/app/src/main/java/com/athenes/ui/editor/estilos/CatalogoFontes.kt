// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes.ui.editor.estilos

import android.content.Context
import android.graphics.Typeface
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.ui.text.font.FontFamily
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Categoria visual da família tipográfica.
 */
enum class CategoriaFonte(val rotulo: String) {
    SANS_SERIF("Sem serifa"),
    SERIF("Com serifa"),
    MONOSPACE("Monoespaçada"),
    DISPLAY("Display / Título")
}

/**
 * Representação de uma família tipográfica disponível no editor.
 */
data class FamiliaFonte(
    val id: String,
    val rotulo: String,
    val familiaCss: String,
    val categoria: CategoriaFonte,
    val ehSerif: Boolean,
    val ehImportada: Boolean = false,
    val arquivoCaminho: String? = null,
    val fontFamily: FontFamily = FontFamily.SansSerif
)

/**
 * Catálogo central de fontes do Athenes Android.
 * Gerencia as 9 famílias canônicas e a persistência/carga de fontes importadas em context.filesDir/fonts/.
 */
object CatalogoFontes {

    private const val ARQUIVO_INDICE_FONTES = "fontes_instaladas.json"
    private const val PASTA_FONTES = "fonts"

    // Famílias Canônicas do Athenes Web (src/core/athenes_estilos.js:10-75)
    val FONTES_SISTEMA: List<FamiliaFonte> = listOf(
        FamiliaFonte(
            id = "nunito",
            rotulo = "Nunito (Glaux/Athenes)",
            familiaCss = "'Nunito', system-ui, sans-serif",
            categoria = CategoriaFonte.SANS_SERIF,
            ehSerif = false,
            fontFamily = FontFamily.SansSerif
        ),
        FamiliaFonte(
            id = "times",
            rotulo = "Times New Roman",
            familiaCss = "'Times New Roman', Times, serif",
            categoria = CategoriaFonte.SERIF,
            ehSerif = true,
            fontFamily = FontFamily.Serif
        ),
        FamiliaFonte(
            id = "arial",
            rotulo = "Arial",
            familiaCss = "Arial, Helvetica, sans-serif",
            categoria = CategoriaFonte.SANS_SERIF,
            ehSerif = false,
            fontFamily = FontFamily.SansSerif
        ),
        FamiliaFonte(
            id = "georgia",
            rotulo = "Georgia",
            familiaCss = "Georgia, serif",
            categoria = CategoriaFonte.SERIF,
            ehSerif = true,
            fontFamily = FontFamily.Serif
        ),
        FamiliaFonte(
            id = "garamond",
            rotulo = "Garamond",
            familiaCss = "Garamond, 'Times New Roman', serif",
            categoria = CategoriaFonte.SERIF,
            ehSerif = true,
            fontFamily = FontFamily.Serif
        ),
        FamiliaFonte(
            id = "cambria",
            rotulo = "Cambria",
            familiaCss = "Cambria, 'Times New Roman', serif",
            categoria = CategoriaFonte.SERIF,
            ehSerif = true,
            fontFamily = FontFamily.Serif
        ),
        FamiliaFonte(
            id = "calibri",
            rotulo = "Calibri",
            familiaCss = "Calibri, Carlito, sans-serif",
            categoria = CategoriaFonte.SANS_SERIF,
            ehSerif = false,
            fontFamily = FontFamily.SansSerif
        ),
        FamiliaFonte(
            id = "aptos",
            rotulo = "Aptos (Microsoft 365)",
            familiaCss = "Aptos, Calibri, sans-serif",
            categoria = CategoriaFonte.SANS_SERIF,
            ehSerif = false,
            fontFamily = FontFamily.SansSerif
        ),
        FamiliaFonte(
            id = "consolas",
            rotulo = "Consolas (Mono)",
            familiaCss = "Consolas, 'Courier New', monospace",
            categoria = CategoriaFonte.MONOSPACE,
            ehSerif = false,
            fontFamily = FontFamily.Monospace
        )
    )

    private val cacheFontesImportadas = mutableMapOf<String, FontFamily>()

    /**
     * Lista completa de fontes (canônicas + importadas pelo usuário).
     */
    fun listarTodas(context: Context): List<FamiliaFonte> {
        val importadas = listarImportadas(context)
        return FONTES_SISTEMA + importadas
    }

    /**
     * Obtém o FontFamily do Compose pelo ID da família, com fallback seguro para SansSerif.
     */
    fun obterFontFamily(context: Context, fonteId: String): FontFamily {
        val canonica = FONTES_SISTEMA.find { it.id == fonteId }
        if (canonica != null) return canonica.fontFamily

        cacheFontesImportadas[fonteId]?.let { return it }

        val importadas = listarImportadas(context)
        val encontrada = importadas.find { it.id == fonteId }
        if (encontrada?.arquivoCaminho != null) {
            val file = File(encontrada.arquivoCaminho)
            if (file.exists()) {
                val ff = criarFontFamilyDeArquivo(file)
                cacheFontesImportadas[fonteId] = ff
                return ff
            }
        }
        return FontFamily.SansSerif
    }

    /**
     * Constrói com segurança uma FontFamily Compose a partir de arquivo TTF/OTF.
     */
    fun criarFontFamilyDeArquivo(file: File): FontFamily {
        return try {
            val tf = Typeface.createFromFile(file)
            FontFamily(tf)
        } catch (_: Throwable) {
            FontFamily.Default
        }
    }

    /**
     * Importa um arquivo de fonte TTF/OTF via Content URI do SAF.
     */
    fun importarFonte(context: Context, uri: Uri, nomeSugerido: String? = null): FamiliaFonte {
        val pasta = File(context.filesDir, PASTA_FONTES).apply { if (!exists()) mkdirs() }
        val nomeReal = nomeSugerido ?: resolverNomeArquivo(context, uri) ?: "fonte_${System.currentTimeMillis()}.ttf"
        val slug = normalizarSlug(nomeReal.substringBeforeLast("."))
        val ext = nomeReal.substringAfterLast(".", "ttf").lowercase()
        val arquivoDestino = File(pasta, "$slug.$ext")

        context.contentResolver.openInputStream(uri)?.use { input ->
            arquivoDestino.outputStream().use { output ->
                input.copyTo(output)
            }
        } ?: error("Não foi possível ler o arquivo de fonte selecionado.")

        // Valida se o arquivo é um TTF/OTF parseável
        val tf = try {
            Typeface.createFromFile(arquivoDestino)
        } catch (e: Throwable) {
            arquivoDestino.delete()
            throw IllegalArgumentException("Arquivo de fonte inválido ou corrompido: ${e.message}")
        }

        val rotuloFormatado = formatarRotulo(nomeReal.substringBeforeLast("."))
        val id = "fonte_$slug"
        val ff = try { FontFamily(tf) } catch (_: Throwable) { FontFamily.Default }
        cacheFontesImportadas[id] = ff

        val novaFonte = FamiliaFonte(
            id = id,
            rotulo = "$rotuloFormatado (importada)",
            familiaCss = "'$rotuloFormatado', sans-serif",
            categoria = CategoriaFonte.SANS_SERIF,
            ehSerif = false,
            ehImportada = true,
            arquivoCaminho = arquivoDestino.absolutePath,
            fontFamily = ff
        )

        salvarIndiceImportadas(context, listarImportadas(context) + novaFonte)
        return novaFonte
    }

    /**
     * Exclui uma fonte importada pelo usuário.
     */
    fun excluirFonteImportada(context: Context, id: String): Boolean {
        val atuais = listarImportadas(context)
        val alvo = atuais.find { it.id == id } ?: return false
        if (alvo.arquivoCaminho != null) {
            File(alvo.arquivoCaminho).delete()
        }
        cacheFontesImportadas.remove(id)
        salvarIndiceImportadas(context, atuais.filter { it.id != id })
        return true
    }

    private fun listarImportadas(context: Context): List<FamiliaFonte> {
        val arquivo = File(context.filesDir, ARQUIVO_INDICE_FONTES)
        if (!arquivo.exists()) return emptyList()
        return try {
            val json = JSONObject(arquivo.readText())
            val array = json.optJSONArray("fontes") ?: JSONArray()
            val lista = mutableListOf<FamiliaFonte>()
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                val id = item.getString("id")
                val rotulo = item.getString("rotulo")
                val caminho = item.optString("arquivoCaminho").takeIf { it.isNotBlank() }
                val file = caminho?.let { File(it) }
                val ff = if (file != null && file.exists()) {
                    cacheFontesImportadas.getOrPut(id) { criarFontFamilyDeArquivo(file) }
                } else FontFamily.SansSerif

                lista.add(
                    FamiliaFonte(
                        id = id,
                        rotulo = rotulo,
                        familiaCss = item.optString("familiaCss", "'$rotulo', sans-serif"),
                        categoria = runCatching { CategoriaFonte.valueOf(item.optString("categoria", "SANS_SERIF")) }.getOrDefault(CategoriaFonte.SANS_SERIF),
                        ehSerif = item.optBoolean("ehSerif", false),
                        ehImportada = true,
                        arquivoCaminho = caminho,
                        fontFamily = ff
                    )
                )
            }
            lista
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun salvarIndiceImportadas(context: Context, fontes: List<FamiliaFonte>) {
        val arquivo = File(context.filesDir, ARQUIVO_INDICE_FONTES)
        val json = JSONObject()
        val array = JSONArray()
        fontes.forEach { f ->
            val obj = JSONObject().apply {
                put("id", f.id)
                put("rotulo", f.rotulo)
                put("familiaCss", f.familiaCss)
                put("categoria", f.categoria.name)
                put("ehSerif", f.ehSerif)
                put("arquivoCaminho", f.arquivoCaminho)
            }
            array.put(obj)
        }
        json.put("fontes", array)
        arquivo.writeText(json.toString(2))
    }

    private fun resolverNomeArquivo(context: Context, uri: Uri): String? {
        if (uri.scheme == "content") {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) return cursor.getString(idx)
                }
            }
        }
        return uri.path?.substringAfterLast('/')
    }

    private fun normalizarSlug(texto: String): String {
        return texto.lowercase()
            .replace(Regex("[^a-z0-9_]+"), "_")
            .trim('_')
            .ifBlank { "fonte_${System.currentTimeMillis()}" }
    }

    private fun formatarRotulo(nomeBase: String): String {
        return nomeBase.replace(Regex("[-_]+"), " ")
            .split(" ")
            .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
    }
}
