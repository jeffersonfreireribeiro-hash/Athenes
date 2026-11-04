package com.athenes

import com.athenes.ui.library.ConfiguracaoPaineisDocumento
import com.athenes.ui.library.configurarPaineisDocumento
import org.junit.Assert.assertEquals
import org.junit.Test

class PaineisDocumentoTest {
    @Test fun `celular mostra apenas lista`() {
        assertEquals(ConfiguracaoPaineisDocumento(false, false, 1), configurarPaineisDocumento(400, false))
    }

    @Test fun `tablet medio mostra lista e detalhe`() {
        assertEquals(ConfiguracaoPaineisDocumento(false, true, 1), configurarPaineisDocumento(800, false))
    }

    @Test fun `janela larga mostra pastas lista e detalhe`() {
        assertEquals(ConfiguracaoPaineisDocumento(true, true, 2), configurarPaineisDocumento(1200, false))
    }

    @Test fun `lixeira usa espaco da tela para a lista`() {
        assertEquals(ConfiguracaoPaineisDocumento(false, false, 2), configurarPaineisDocumento(800, true))
    }
}
