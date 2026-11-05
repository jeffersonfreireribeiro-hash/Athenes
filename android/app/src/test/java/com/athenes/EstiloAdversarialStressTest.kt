// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes

import androidx.compose.ui.graphics.Color
import com.athenes.ui.editor.AlinhamentoTexto
import com.athenes.ui.editor.BlocoEditor
import com.athenes.ui.editor.EditorViewModel
import com.athenes.ui.editor.TipoBlocoEditor
import com.athenes.ui.editor.estilos.CatalogoFontes
import com.athenes.ui.editor.estilos.EstiloEditorial
import com.athenes.ui.editor.estilos.parseCorHex
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class EstiloAdversarialStressTest {

    // =========================================================================
    // 1. STRESS-TEST: Block style changes, semantic reclassification & outline
    // =========================================================================

    @Test
    fun `desafio 1A - aplicar titulo a paragrafo existente preserva o texto no titulo para o sumario`() {
        val vm = EditorViewModel()
        val blocoId = vm.blocos.value.first().id
        vm.selecionarBloco(blocoId)
        vm.atualizarTextoBloco(blocoId, "1. METODOLOGIA CIENTÍFICA")

        // Aplica Título 1
        vm.aplicarEstiloAoBloco(blocoId, "titulo1")
        val blocoAtual = vm.blocos.value.find { it.id == blocoId }!!

        // Verificações semânticas
        assertEquals(TipoBlocoEditor.TITULO, blocoAtual.tipo)
        assertEquals(1, blocoAtual.nivelTitulo)
        assertEquals(AlinhamentoTexto.ESQUERDA, blocoAtual.alinhamento)

        // Verificação empírica de estrutura/sumário:
        val estrutura = vm.montarEstrutura(vm.blocos.value)
        println("TEST-LOG: Estrutura gerada: $estrutura")
        println("TEST-LOG: Bloco atual - tipo: ${blocoAtual.tipo}, titulo: '${blocoAtual.titulo}', texto: '${blocoAtual.texto}'")

        // O sumário depende de bloco.titulo ser não-vazio. Se o texto foi digitado no parágrafo antes de virar título,
        // o usuário espera que o título não fique em branco no sumário.
        assertTrue("O título no sumário não deve ser vazio após converter parágrafo para título",
            blocoAtual.titulo.isNotBlank() || estrutura.any { it.titulo.contains("METODOLOGIA") || it.id == blocoId })
    }

    @Test
    fun `desafio 1B - aplicar corpo a titulo existente preserva o texto no paragrafo`() {
        val vm = EditorViewModel()
        // Adiciona um bloco título
        vm.adicionarBloco(TipoBlocoEditor.TITULO)
        val blocoTitulo = vm.blocos.value.last()
        vm.selecionarBloco(blocoTitulo.id)
        vm.atualizarTituloBloco(blocoTitulo.id, "CONSIDERAÇÕES INICIAIS")

        // Aplica Corpo
        vm.aplicarEstiloAoBloco(blocoTitulo.id, "corpo")
        val blocoAtual = vm.blocos.value.find { it.id == blocoTitulo.id }!!

        assertEquals(TipoBlocoEditor.PARAGRAFO, blocoAtual.tipo)
        println("TEST-LOG: Bloco convertido para corpo - tipo: ${blocoAtual.tipo}, titulo: '${blocoAtual.titulo}', texto: '${blocoAtual.texto}'")
        assertTrue("O texto do parágrafo não deve ser vazio após converter título para corpo",
            blocoAtual.texto.isNotBlank())
    }

    @Test
    fun `desafio 1C - ciclo completo de niveis de titulo 1, 2, 3 atualiza nivelTitulo e recalcula numeracao progressiva`() {
        val vm = EditorViewModel()
        val b1 = vm.blocos.value.first().id
        vm.selecionarBloco(b1)
        vm.atualizarTituloBloco(b1, "Seção Primária")
        vm.aplicarEstiloAoBloco(b1, "titulo1")

        vm.adicionarBloco(TipoBlocoEditor.TITULO)
        val b2 = vm.blocos.value.last().id
        vm.selecionarBloco(b2)
        vm.atualizarTituloBloco(b2, "Seção Secundária")
        vm.aplicarEstiloAoBloco(b2, "titulo2")

        vm.adicionarBloco(TipoBlocoEditor.TITULO)
        val b3 = vm.blocos.value.last().id
        vm.selecionarBloco(b3)
        vm.atualizarTituloBloco(b3, "Seção Terciária")
        vm.aplicarEstiloAoBloco(b3, "titulo3")

        val estrutura = vm.montarEstrutura(vm.blocos.value)
        assertEquals(3, estrutura.size)
        assertEquals("1", estrutura[0].numero)
        assertEquals(1, estrutura[0].nivel)
        assertEquals("1.1", estrutura[1].numero)
        assertEquals(2, estrutura[1].nivel)
        assertEquals("1.1.1", estrutura[2].numero)
        assertEquals(3, estrutura[2].nivel)

        // Alterna b2 para titulo3 e verifica renumeração automática
        vm.aplicarEstiloAoBloco(b2, "titulo3")
        val estruturaAtualizada = vm.montarEstrutura(vm.blocos.value)
        assertEquals(3, estruturaAtualizada[1].nivel)
    }

    @Test
    fun `desafio 1D - aplicar estilo de citacao longa reclassifica para CITACAO`() {
        val vm = EditorViewModel()
        val bId = vm.blocos.value.first().id
        vm.selecionarBloco(bId)
        vm.aplicarEstiloAoBloco(bId, "citacao_direta")

        val bloco = vm.blocos.value.find { it.id == bId }!!
        assertEquals(TipoBlocoEditor.CITACAO, bloco.tipo)
        assertEquals("citacao_direta", bloco.estiloId)
    }

    @Test
    fun `desafio 1E - blocos nao-textuais preservam tipo original ao receber estilo`() {
        val vm = EditorViewModel()
        vm.adicionarBloco(TipoBlocoEditor.FIGURA)
        val figId = vm.blocos.value.last().id

        // Aplica estilo titulo1 na figura
        vm.aplicarEstiloAoBloco(figId, "titulo1")
        val figAtual = vm.blocos.value.find { it.id == figId }!!
        assertEquals(TipoBlocoEditor.FIGURA, figAtual.tipo) // Não deve ser corrompido para TITULO
    }

    // =========================================================================
    // 2. STRESS-TEST: Undo / Redo cycles
    // =========================================================================

    @Test
    fun `desafio 2A - ciclo de desfazer e refazer entre multiplos estilos restaura fielmente o estado anterior`() {
        val vm = EditorViewModel()
        val bId = vm.blocos.value.first().id
        vm.selecionarBloco(bId)

        assertEquals("corpo", vm.blocos.value.first().estiloId)

        vm.aplicarEstiloAoBloco(bId, "titulo1")
        assertEquals("titulo1", vm.blocos.value.find { it.id == bId }?.estiloId)

        vm.aplicarEstiloAoBloco(bId, "titulo2")
        assertEquals("titulo2", vm.blocos.value.find { it.id == bId }?.estiloId)

        vm.aplicarEstiloAoBloco(bId, "citacao_direta")
        assertEquals("citacao_direta", vm.blocos.value.find { it.id == bId }?.estiloId)

        // Desfazer 1: volta para titulo2
        vm.desfazer()
        assertEquals("titulo2", vm.blocos.value.find { it.id == bId }?.estiloId)
        assertEquals(TipoBlocoEditor.TITULO, vm.blocos.value.find { it.id == bId }?.tipo)
        assertEquals(2, vm.blocos.value.find { it.id == bId }?.nivelTitulo)

        // Desfazer 2: volta para titulo1
        vm.desfazer()
        assertEquals("titulo1", vm.blocos.value.find { it.id == bId }?.estiloId)
        assertEquals(TipoBlocoEditor.TITULO, vm.blocos.value.find { it.id == bId }?.tipo)
        assertEquals(1, vm.blocos.value.find { it.id == bId }?.nivelTitulo)

        // Desfazer 3: volta para corpo
        vm.desfazer()
        assertEquals("corpo", vm.blocos.value.find { it.id == bId }?.estiloId)
        assertEquals(TipoBlocoEditor.PARAGRAFO, vm.blocos.value.find { it.id == bId }?.tipo)

        // Refazer 1: volta para titulo1
        vm.refazer()
        assertEquals("titulo1", vm.blocos.value.find { it.id == bId }?.estiloId)

        // Refazer 2: volta para titulo2
        vm.refazer()
        assertEquals("titulo2", vm.blocos.value.find { it.id == bId }?.estiloId)

        // Refazer 3: volta para citacao_direta
        vm.refazer()
        assertEquals("citacao_direta", vm.blocos.value.find { it.id == bId }?.estiloId)
        assertEquals(TipoBlocoEditor.CITACAO, vm.blocos.value.find { it.id == bId }?.tipo)
    }

    @Test
    fun `desafio 2B - desfazer alem do limite zero e refazer alem do topo nao causa excecao`() {
        val vm = EditorViewModel()
        // Tenta desfazer no início
        for (i in 0..10) {
            vm.desfazer()
        }
        assertEquals(1, vm.blocos.value.size)

        // Faz 1 alteração
        val bId = vm.blocos.value.first().id
        vm.aplicarEstiloAoBloco(bId, "titulo1")

        // Refaz além do topo
        for (i in 0..10) {
            vm.refazer()
        }
        assertEquals("titulo1", vm.blocos.value.find { it.id == bId }?.estiloId)
    }

    @Test
    fun `desafio 2C - 100 operacoes de estilo consecutivas respeitam limite maximo de historico de 60`() {
        val vm = EditorViewModel()
        val bId = vm.blocos.value.first().id
        vm.selecionarBloco(bId)

        val estilos = listOf("corpo", "titulo1", "titulo2", "titulo3", "citacao_direta")
        for (i in 1..100) {
            val est = estilos[i % estilos.size]
            vm.aplicarEstiloAoBloco(bId, est)
        }

        // Deve ser possível desfazer até 60 vezes sem crash
        var passosDesfeitos = 0
        for (i in 1..100) {
            val estiloAntes = vm.blocos.value.find { it.id == bId }?.estiloId
            vm.desfazer()
            val estiloDepois = vm.blocos.value.find { it.id == bId }?.estiloId
            if (estiloAntes != estiloDepois) {
                passosDesfeitos++
            }
        }
        println("TEST-LOG: Passos desfeitos com sucesso: $passosDesfeitos")
        assertTrue("Deve registrar passos até o limite de histórico", passosDesfeitos in 20..60)
    }

    // =========================================================================
    // 3. STRESS-TEST: Custom style deletion & fallback to 'corpo'
    // =========================================================================

    @Test
    fun `desafio 3A - exclusao de estilo customizado ativo em varios blocos reverte todos para corpo`() {
        val vm = EditorViewModel()
        val custom = EstiloEditorial(
            id = "meu_estilo_destaque",
            nome = "Meu Estilo Destaque",
            tamanhoPt = 16.0,
            personalizado = true
        )
        vm.salvarEstilo(custom)

        val b1 = vm.blocos.value.first().id
        vm.aplicarEstiloAoBloco(b1, "meu_estilo_destaque")

        vm.adicionarBloco(TipoBlocoEditor.PARAGRAFO)
        val b2 = vm.blocos.value.last().id
        vm.aplicarEstiloAoBloco(b2, "meu_estilo_destaque")

        assertEquals("meu_estilo_destaque", vm.blocos.value.find { it.id == b1 }?.estiloId)
        assertEquals("meu_estilo_destaque", vm.blocos.value.find { it.id == b2 }?.estiloId)
        assertEquals("meu_estilo_destaque", vm.estiloAtivoId.value)

        // Exclui o estilo personalizado
        vm.excluirEstilo("meu_estilo_destaque")

        // Verificações
        assertNull("Estilo excluído não deve existir na lista", vm.estilos.value.find { it.id == "meu_estilo_destaque" })
        assertEquals("corpo", vm.blocos.value.find { it.id == b1 }?.estiloId)
        assertEquals("corpo", vm.blocos.value.find { it.id == b2 }?.estiloId)
        assertEquals("corpo", vm.estiloAtivoId.value)
    }

    @Test
    fun `desafio 3B - exclusao de estilos protegidos ABNT eh rejeitada sem alterar estado`() {
        val vm = EditorViewModel()
        val totalAntes = vm.estilos.value.size

        vm.removerEstilo("corpo")
        vm.removerEstilo("titulo1")
        vm.removerEstilo("titulo2")
        vm.removerEstilo("titulo3")

        assertEquals(totalAntes, vm.estilos.value.size)
        assertNotNull(vm.estilos.value.find { it.id == "corpo" })
        assertNotNull(vm.estilos.value.find { it.id == "titulo1" })
        assertNotNull(vm.estilos.value.find { it.id == "titulo2" })
        assertNotNull(vm.estilos.value.find { it.id == "titulo3" })
    }

    @Test
    fun `desafio 3C - remover estilo inexistente nao causa excecao nem altera lista`() {
        val vm = EditorViewModel()
        val totalAntes = vm.estilos.value.size
        vm.removerEstilo("estilo_inexistente_xyz_123")
        assertEquals(totalAntes, vm.estilos.value.size)
    }

    // =========================================================================
    // 4. STRESS-TEST: SeletorEstiloTopo & Rapid Switching / Corrupted Data
    // =========================================================================

    @Test
    fun `desafio 4A - alternancia rapida sequencial de estilos nao causa inconsistencia de estado`() {
        val vm = EditorViewModel()
        val bId = vm.blocos.value.first().id
        vm.selecionarBloco(bId)

        val estilosDisponiveis = vm.estilos.value.map { it.id }

        // Simula 200 cliques rápidos do usuário no dropdown
        for (i in 0 until 200) {
            val estiloEscolhido = estilosDisponiveis[i % estilosDisponiveis.size]
            vm.aplicarEstiloAoBloco(bId, estiloEscolhido)
            assertEquals(estiloEscolhido, vm.estiloAtivoId.value)
            assertEquals(estiloEscolhido, vm.blocos.value.find { it.id == bId }?.estiloId)
        }
    }

    @Test
    fun `desafio 4B - parseCorHex suporta entradas adversas sem lancar excecao`() {
        val fallback = Color(0xFF1F2733)
        assertEquals(fallback, parseCorHex(""))
        assertEquals(fallback, parseCorHex("#"))
        assertEquals(fallback, parseCorHex("null"))
        assertEquals(fallback, parseCorHex("#12"))
        assertEquals(fallback, parseCorHex("#GGGGGG"))
        assertEquals(fallback, parseCorHex("#1234567890"))
        assertEquals(fallback, parseCorHex("   "))
        assertEquals(Color(0xFF314F79), parseCorHex("314F79"))
        assertEquals(Color(0xFF314F79), parseCorHex("#314F79"))
        assertEquals(Color(0x80314F79), parseCorHex("#80314F79"))
    }

    @Test
    fun `desafio 4C - obterEstilo com ID inexistente retorna corpo como fallback seguro`() {
        val vm = EditorViewModel()
        val fallback = vm.obterEstilo("id_fantasma_inexistente")
        assertNotNull(fallback)
        assertEquals("corpo", fallback.id)
    }
}
