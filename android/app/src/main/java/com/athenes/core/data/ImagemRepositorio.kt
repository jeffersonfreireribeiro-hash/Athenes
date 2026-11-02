package com.athenes.core.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.athenes.core.export.ImagemExport
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Imagens das figuras: copiadas (e reduzidas) para filesDir/imagens, de modo que o documento
 * não dependa do URI do seletor. Só o nome do arquivo é gravado no bloco.
 */
object ImagemRepositorio {

    private const val LADO_MAXIMO_GRAVADO = 1600

    fun pasta(context: Context): File = File(context.filesDir, "imagens").apply { mkdirs() }

    fun arquivo(context: Context, nome: String): File = File(pasta(context), nome)

    /** Importa a imagem escolhida; devolve o nome do arquivo gravado ou null se não for decodificável. */
    fun importar(context: Context, uri: Uri): String? {
        return try {
            val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, limites) }
            if (limites.outWidth <= 0 || limites.outHeight <= 0) return null

            var amostra = 1
            while (maxOf(limites.outWidth, limites.outHeight) / amostra > LADO_MAXIMO_GRAVADO) amostra *= 2

            val opcoes = BitmapFactory.Options().apply { inSampleSize = amostra }
            val bitmap = context.contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, opcoes)
            } ?: return null

            val comAlfa = bitmap.hasAlpha()
            val nome = "img_${UUID.randomUUID()}.${if (comAlfa) "png" else "jpg"}"
            FileOutputStream(arquivo(context, nome)).use { saida ->
                bitmap.compress(if (comAlfa) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG, 88, saida)
            }
            bitmap.recycle()
            nome
        } catch (_: Exception) {
            null
        }
    }

    /** Bytes + dimensões gravadas, para DOCX/HTML. */
    fun paraExportacao(context: Context, nome: String): ImagemExport? {
        val arq = arquivo(context, nome).takeIf { it.exists() } ?: return null
        return try {
            val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(arq.path, limites)
            if (limites.outWidth <= 0) return null
            val ext = if (arq.extension.lowercase() == "png") "png" else "jpg"
            ImagemExport(arq.readBytes(), ext, limites.outWidth, limites.outHeight)
        } catch (_: Exception) {
            null
        }
    }

    /** Decodifica já reduzida para a largura de exibição (evita carregar a imagem inteira na memória). */
    fun carregar(context: Context, nome: String, larguraMaxPx: Int = 1400): ImageBitmap? {
        val arq = arquivo(context, nome).takeIf { it.exists() } ?: return null
        return try {
            val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(arq.path, limites)
            var amostra = 1
            while (limites.outWidth / (amostra * 2) >= larguraMaxPx) amostra *= 2
            BitmapFactory.decodeFile(arq.path, BitmapFactory.Options().apply { inSampleSize = amostra })?.asImageBitmap()
        } catch (_: Exception) {
            null
        }
    }
}
