package com.athenes

import com.athenes.core.data.FichamentoResumoCodec
import com.athenes.core.data.ResumoFichamento
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FichamentoResumoTest {
    @Test fun `resumo e analise mantem caracteres academicos apos persistencia`() {
        val original = ResumoFichamento("Síntese: α = 0,05\nSegunda linha", "Método misto; amostra n=140")
        assertEquals(original, FichamentoResumoCodec.ler(FichamentoResumoCodec.escrever(original)))
    }

    @Test fun `fichamento corrompido nao impede abrir biblioteca`() {
        assertNull(FichamentoResumoCodec.ler("{incompleto"))
        assertNull(FichamentoResumoCodec.ler(null))
    }
}
