package com.athenes.ui.editor

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * PDF pelo serviço de impressão do sistema ("Salvar como PDF"): o HTML paginado usa @page A4 com
 * margens ABNT. O PrintManager só aceita uma Activity; o WebView fica referenciado até o diálogo
 * de impressão assumir o conteúdo.
 */
object ExportarPdf {

    private var webViewAtivo: WebView? = null

    /** Desembrulha o Context do Compose até a Activity. */
    fun activityDe(context: Context): Activity? {
        var atual: Context? = context
        while (atual is ContextWrapper) {
            if (atual is Activity) return atual
            atual = atual.baseContext
        }
        return null
    }

    fun imprimir(activity: Activity, html: String, nomeDocumento: String) {
        val webView = WebView(activity)
        webViewAtivo = webView
        webView.settings.javaScriptEnabled = false
        var impresso = false
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                if (impresso) return
                impresso = true
                val gerenciador = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
                val atributos = PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build()
                gerenciador.print(nomeDocumento, view.createPrintDocumentAdapter(nomeDocumento), atributos)
            }
        }
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }
}
