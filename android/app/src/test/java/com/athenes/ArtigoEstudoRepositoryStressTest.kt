// SPDX-License-Identifier: GPL-3.0-or-later
package com.athenes

import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.model.CitacaoMarcada
import com.athenes.core.model.NotaAdesiva
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Adversarial Verification & Empirical Stress-Test Suite for ArtigoEstudoRepository.
 * Challenger: teamwork_challenger_m2_2.
 */
class ArtigoEstudoRepositoryStressTest {

    private lateinit var repository: ArtigoEstudoRepository

    @Before
    fun setup() {
        repository = ArtigoEstudoRepository()
    }

    // =========================================================================
    // 1. STRESS-TEST: selecionarArtigo() resolution
    // =========================================================================

    @Test
    fun testSelecionarArtigoInternalIds() {
        // Inicialmente o ativo deve ser art_radino_2020
        assertEquals("art_radino_2020", repository.artigoAtivoId.value)
        assertEquals("art_radino_2020", repository.obterArtigoAtivo().id)

        // Selecionar art_reurb_2025 por ID interno
        repository.selecionarArtigo("art_reurb_2025")
        assertEquals("art_reurb_2025", repository.artigoAtivoId.value)
        assertEquals("art_reurb_2025", repository.obterArtigoAtivo().id)
        assertTrue(repository.obterArtigoAtivo().titulo.contains("Regularização Fundiária"))

        // Selecionar art_sustentabilidade_2026 por ID interno
        repository.selecionarArtigo("art_sustentabilidade_2026")
        assertEquals("art_sustentabilidade_2026", repository.artigoAtivoId.value)
        assertEquals("art_sustentabilidade_2026", repository.obterArtigoAtivo().id)
        assertTrue(repository.obterArtigoAtivo().titulo.contains("Sistemas Colaborativos CRDT"))

        // Selecionar art_radino_2020 por ID interno
        repository.selecionarArtigo("art_radino_2020")
        assertEquals("art_radino_2020", repository.artigoAtivoId.value)
        assertEquals("art_radino_2020", repository.obterArtigoAtivo().id)
        assertTrue(repository.obterArtigoAtivo().titulo.contains("Acoustic Performance-Based Design"))
    }

    @Test
    fun testSelecionarArtigoZoteroKeyZOT8K2M9() {
        // Inicialmente em art_radino_2020
        repository.selecionarArtigo("art_radino_2020")
        assertEquals("art_radino_2020", repository.artigoAtivoId.value)

        // Resolver chave Zotero ZOT8K2M9 -> art_reurb_2025
        repository.selecionarArtigo("ZOT8K2M9")
        assertEquals("ZOT8K2M9 deve resolver para art_reurb_2025", "art_reurb_2025", repository.artigoAtivoId.value)
        assertEquals("ZOT8K2M9", repository.obterArtigoAtivo().chaveZotero)
    }

    @Test
    fun testSelecionarArtigoZoteroKeyZOT4P9L2() {
        // Inicialmente em art_radino_2020
        repository.selecionarArtigo("art_radino_2020")
        assertEquals("art_radino_2020", repository.artigoAtivoId.value)

        // Resolver chave Zotero ZOT4P9L2 -> art_sustentabilidade_2026
        repository.selecionarArtigo("ZOT4P9L2")
        assertEquals("ZOT4P9L2 deve resolver para art_sustentabilidade_2026", "art_sustentabilidade_2026", repository.artigoAtivoId.value)
        assertEquals("ZOT4P9L2", repository.obterArtigoAtivo().chaveZotero)
    }

    @Test
    fun testSelecionarArtigoZoteroKeyZOT9R3X7_AdversarialChallenge() {
        // No Athenes Web, ZOT9R3X7 é a chave canônica do artigo de demonstração 3 (zot_art_03).
        // No Athenes Web (src/ui/athenes_estudo_artigos_dados.js), ZOT9R3X7 é a chave canônica do artigo 3 (zot_art_03).
        // No Android, Worker 2 mapeou zot_art_03 para art_sustentabilidade_2026, mas OMITIU o mapeamento da chave Zotero ZOT9R3X7.
        // Como nenhum artigo possui chaveZotero == "ZOT9R3X7", a chamada falha silenciosamente e não resolve o artigo.
        repository.selecionarArtigo("art_reurb_2025")
        assertEquals("art_reurb_2025", repository.artigoAtivoId.value)

        repository.selecionarArtigo("ZOT9R3X7")
        val ativoAposZot9 = repository.artigoAtivoId.value
        // Empiricamente demonstrado: ativo permanece art_reurb_2025 porque ZOT9R3X7 não foi resolvido
        assertEquals("ZOT9R3X7 não resolve nenhum artigo e mantém o ativo anterior", "art_reurb_2025", ativoAposZot9)
        println("[ADVERSARIAL_FINDING_1] selecionarArtigo('ZOT9R3X7') NÃO resolve nenhum artigo. Ficou em: $ativoAposZot9")
    }

    @Test
    fun testSelecionarArtigoWebDemoAliases() {
        // Teste alias zot_art_01 -> art_reurb_2025
        repository.selecionarArtigo("art_radino_2020")
        repository.selecionarArtigo("zot_art_01")
        assertEquals("zot_art_01 deve mapear para art_reurb_2025", "art_reurb_2025", repository.artigoAtivoId.value)

        // Teste alias zot_art_02 -> art_sustentabilidade_2026
        repository.selecionarArtigo("art_radino_2020")
        repository.selecionarArtigo("zot_art_02")
        assertEquals("zot_art_02 deve mapear para art_sustentabilidade_2026", "art_sustentabilidade_2026", repository.artigoAtivoId.value)

        // Teste alias zot_art_03 -> art_sustentabilidade_2026
        repository.selecionarArtigo("art_radino_2020")
        repository.selecionarArtigo("zot_art_03")
        assertEquals("zot_art_03 deve mapear para art_sustentabilidade_2026", "art_sustentabilidade_2026", repository.artigoAtivoId.value)
    }

    @Test
    fun testSelecionarArtigoNonExistentIds() {
        // Garantir que estava em art_reurb_2025
        repository.selecionarArtigo("art_reurb_2025")
        assertEquals("art_reurb_2025", repository.artigoAtivoId.value)

        // ID aleatório inexistente não deve alterar o artigo ativo nem disparar exceção
        repository.selecionarArtigo("artigo_inexistente_9999")
        assertEquals("ID inexistente deve manter o artigo ativo inalterado", "art_reurb_2025", repository.artigoAtivoId.value)

        // Null-string literal
        repository.selecionarArtigo("null")
        assertEquals("Literal 'null' inexistente deve manter o artigo ativo inalterado", "art_reurb_2025", repository.artigoAtivoId.value)

        // Chave Zotero desconhecida
        repository.selecionarArtigo("ZOT000000")
        assertEquals("Chave Zotero desconhecida deve manter o artigo ativo inalterado", "art_reurb_2025", repository.artigoAtivoId.value)

        // Obter artigo ativo deve continuar retornando o artigo atual válido
        val ativo = repository.obterArtigoAtivo()
        assertNotNull("Artigo ativo não pode ser nulo", ativo)
        assertEquals("art_reurb_2025", ativo.id)
    }

    @Test
    fun testDesafioAdversarialStringVaziaSelecionaRadinoInadvertidamente() {
        // Garantir que estava em art_reurb_2025
        repository.selecionarArtigo("art_reurb_2025")
        assertEquals("art_reurb_2025", repository.artigoAtivoId.value)

        // VULNERABILIDADE / COMPORTAMENTO INESPERADO:
        // art_radino_2020 possui chaveZotero = "".
        // Ao chamar selecionarArtigo(""), a cláusula `art.chaveZotero == id` avalia `"" == ""`,
        // fazendo com que uma string vazia selecione art_radino_2020 em vez de ser ignorada!
        repository.selecionarArtigo("")
        val ativoAposVazio = repository.artigoAtivoId.value
        assertEquals("art_radino_2020", ativoAposVazio)
        println("[ADVERSARIAL_FINDING_2] selecionarArtigo('') selecionou '$ativoAposVazio' porque art_radino_2020.chaveZotero == ''")
    }

    // =========================================================================
    // 2. STRESS-TEST: Integridade dos Artigos Canônicos
    // =========================================================================

    @Test
    fun testIntegridadeArtigoRadino2020() {
        val artigos = repository.artigos.value
        val radino = artigos.firstOrNull { it.id == "art_radino_2020" }
        assertNotNull("art_radino_2020 deve existir", radino)
        radino!!

        // Verificação de 33 páginas
        assertEquals("art_radino_2020 deve ter totalPaginas == 33", 33, radino.totalPaginas)
        assertEquals("art_radino_2020 deve conter 33 objetos PaginaPdfInfo", 33, radino.paginas.size)

        // Metadados bibliográficos
        assertEquals("RADINO", radino.autores)
        assertEquals(2020, radino.ano)
        assertTrue(radino.titulo.contains("Acoustic Performance-Based Design"))
        assertEquals("10.3390/buildings10020036", radino.zoteroConfig.doi)

        // Páginas com parágrafos reais
        val p1 = radino.paginas[0]
        assertEquals(1, p1.numero)
        assertTrue("Folha 1 deve ter parágrafos", p1.paragrafos.isNotEmpty())
        assertTrue("Folha 1 deve conter PBD", p1.paragrafos.any { it.contains("performance-based design") || it.contains("Performance-based Design") })

        val p2 = radino.paginas[1]
        assertEquals(2, p2.numero)
        assertTrue("Folha 2 deve conter generative models", p2.paragrafos.any { it.contains("generative models") })

        val p3 = radino.paginas[2]
        assertEquals(3, p3.numero)
        assertTrue("Folha 3 deve conter Ray-Tracing", p3.paragrafos.any { it.contains("Ray-Tracing") })

        // Todas as 33 páginas devem ter parágrafos não-vazios
        radino.paginas.forEachIndexed { i, pag ->
            assertEquals(i + 1, pag.numero)
            assertTrue("Página ${i + 1} deve ter título", pag.titulo.isNotBlank())
            assertTrue("Página ${i + 1} deve ter parágrafos não-vazios", pag.paragrafos.isNotEmpty())
        }

        // Sem citações ou notas inventadas por padrão (requisito histórico)
        assertTrue("art_radino_2020 não deve ter citações pré-existentes", radino.citacoes.isEmpty())
        assertTrue("art_radino_2020 não deve ter notas pré-existentes", radino.notas.isEmpty())
    }

    @Test
    fun testIntegridadeArtigoReurb2025() {
        val artigos = repository.artigos.value
        val reurb = artigos.firstOrNull { it.id == "art_reurb_2025" }
        assertNotNull("art_reurb_2025 deve existir", reurb)
        reurb!!

        // Verificação de páginas
        assertEquals("art_reurb_2025 deve ter totalPaginas == 24", 24, reurb.totalPaginas)
        assertEquals("art_reurb_2025 deve conter 24 objetos PaginaPdfInfo", 24, reurb.paginas.size)

        // Metadados bibliográficos
        assertEquals("SANTOS & RIBEIRO, 2025", reurb.autores)
        assertEquals(2025, reurb.ano)
        assertEquals("ZOT8K2M9", reurb.chaveZotero)
        assertEquals("10.22296/2317-1529.rbeur.2025v27n2p114", reurb.zoteroConfig.doi)
        assertEquals("drive_pdf_reurb_2025", reurb.zoteroConfig.driveFileId)

        // Parágrafos reais nas folhas 1, 2 e 3
        val p1 = reurb.paginas[0]
        assertTrue("Folha 1 deve conter texto sobre cadastro territorial",
            p1.paragrafos.any { it.contains("segurança jurídica da posse") || it.contains("rastreabilidade social") })

        val p2 = reurb.paginas[1]
        assertTrue("Folha 2 deve conter texto sobre notas devolutivas",
            p2.paragrafos.any { it.contains("notas devolutivas no registro de imóveis") })

        val p3 = reurb.paginas[2]
        assertTrue("Folha 3 deve conter diretrizes para políticas públicas",
            p3.paragrafos.any { it.contains("diretrizes para políticas públicas") || it.contains("ambientes colaborativos") })

        // Citações canônicas cit_1 e cit_2
        assertEquals("Deve conter exatamente 2 citações canônicas", 2, reurb.citacoes.size)
        val cit1 = reurb.citacoes.firstOrNull { it.id == "cit_1" }
        assertNotNull("cit_1 deve existir", cit1)
        cit1!!
        assertEquals(1, cit1.pagina)
        assertEquals("(SANTOS; RIBEIRO, 2025, p. 1)", cit1.referenciaAbnt)
        assertTrue(cit1.texto.contains("segurança jurídica da posse"))
        assertEquals("#FACC15", cit1.corHex)

        val cit2 = reurb.citacoes.firstOrNull { it.id == "cit_2" }
        assertNotNull("cit_2 deve existir", cit2)
        cit2!!
        assertEquals(2, cit2.pagina)
        assertEquals("(SANTOS; RIBEIRO, 2025, p. 2)", cit2.referenciaAbnt)
        assertTrue(cit2.texto.contains("dissociação entre a planta de parcelamento"))
        assertEquals("#059669", cit2.corHex)

        // Nota adesiva pin_1
        assertEquals("Deve conter exatamente 1 nota adesiva", 1, reurb.notas.size)
        val nota = reurb.notas.first()
        assertEquals("pin_1", nota.id)
        assertEquals(1, nota.pagina)
        assertEquals("Destaque do Orientador", nota.titulo)
        assertEquals(62f, nota.xPct, 0.01f)
        assertEquals(30f, nota.yPct, 0.01f)
        assertEquals("#D97706", nota.corHex)
    }

    @Test
    fun testIntegridadeArtigoSustentabilidade2026() {
        val artigos = repository.artigos.value
        val sust = artigos.firstOrNull { it.id == "art_sustentabilidade_2026" }
        assertNotNull("art_sustentabilidade_2026 deve existir", sust)
        sust!!

        // Verificação de páginas
        assertEquals("art_sustentabilidade_2026 deve ter totalPaginas == 18", 18, sust.totalPaginas)
        assertEquals("art_sustentabilidade_2026 deve conter 18 objetos PaginaPdfInfo", 18, sust.paginas.size)

        // Metadados bibliográficos
        assertEquals("KLEPPMANN & ALMEIDA, 2024", sust.autores)
        assertEquals(2024, sust.ano)
        assertEquals("ZOT4P9L2", sust.chaveZotero)
        assertEquals("10.1145/3612345.3612399", sust.zoteroConfig.doi)
        assertEquals("drive_pdf_crdt_2024", sust.zoteroConfig.driveFileId)

        // Parágrafos reais sobre CRDT nas folhas 1 e 2
        val p1 = sust.paginas[0]
        assertTrue("Folha 1 deve conter texto sobre escrita colaborativa e CRDT",
            p1.paragrafos.any { it.contains("escrita científica contemporânea") || it.contains("colaborativa") })

        val p2 = sust.paginas[1]
        assertTrue("Folha 2 deve conter texto sobre anotação de PDF e Zotero",
            p2.paragrafos.any { it.contains("Zotero") || it.contains("leitura e o grifo") })

        val p3 = sust.paginas[2]
        assertTrue("Folha 3 deve conter estruturas CRDT",
            p3.paragrafos.any { it.contains("CRDT") || it.contains("Conflict-free Replicated Data Types") })

        // Citação canônica cit_201
        assertEquals("Deve conter exatamente 1 citação canônica", 1, sust.citacoes.size)
        val cit201 = sust.citacoes.firstOrNull { it.id == "cit_201" }
        assertNotNull("cit_201 deve existir", cit201)
        cit201!!
        assertEquals(1, cit201.pagina)
        assertEquals("(KLEPPMANN; ALMEIDA, 2024, p. 1)", cit201.referenciaAbnt)
        assertTrue(cit201.texto.contains("presença síncrona com sugestões granulares"))
        assertEquals("#314F79", cit201.corHex)
    }

    // =========================================================================
    // 3. STRESS-TEST: Mutação Dinâmica de Citações e Notas e Sobrevivência
    // =========================================================================

    @Test
    fun testMutacaoDinamicaDeCitacoesENotasEmTodosArtigos() {
        val artigosIds = listOf("art_radino_2020", "art_reurb_2025", "art_sustentabilidade_2026")

        artigosIds.forEach { artId ->
            repository.selecionarArtigo(artId)
            val inicial = repository.obterArtigoAtivo()
            val qtdCitacoesAntes = inicial.citacoes.size
            val qtdNotasAntes = inicial.notas.size

            // Adicionar citação dinâmica
            val novaCit = CitacaoMarcada(
                id = "cit_dinamica_$artId",
                pagina = 5,
                texto = "Trecho extraído durante estresse adversarial para $artId",
                comentario = "Nota de auditoria",
                referenciaAbnt = "(TESTE, 2026, p. 5)",
                corHex = "#10B981"
            )
            repository.adicionarCitacao(artId, novaCit)
            val aposCit = repository.obterArtigoAtivo()
            assertEquals("Deve ter adicionado uma citação em $artId", qtdCitacoesAntes + 1, aposCit.citacoes.size)
            assertNotNull(aposCit.citacoes.find { it.id == "cit_dinamica_$artId" })

            // Adicionar nota dinâmica
            val novaNota = NotaAdesiva(
                id = "nota_dinamica_$artId",
                pagina = 5,
                xPct = 45f,
                yPct = 70f,
                titulo = "Nota de Estresse",
                texto = "Conteúdo de nota para $artId",
                corHex = "#F59E0B"
            )
            repository.adicionarNota(artId, novaNota)
            val aposNota = repository.obterArtigoAtivo()
            assertEquals("Deve ter adicionado uma nota em $artId", qtdNotasAntes + 1, aposNota.notas.size)
            assertNotNull(aposNota.notas.find { it.id == "nota_dinamica_$artId" })

            // Remover citação dinâmica
            repository.removerCitacao(artId, "cit_dinamica_$artId")
            val aposRemocaoCit = repository.obterArtigoAtivo()
            assertEquals("Deve voltar à quantidade anterior de citações em $artId", qtdCitacoesAntes, aposRemocaoCit.citacoes.size)
            assertNull(aposRemocaoCit.citacoes.find { it.id == "cit_dinamica_$artId" })

            // Remover nota dinâmica
            repository.removerNota(artId, "nota_dinamica_$artId")
            val aposRemocaoNota = repository.obterArtigoAtivo()
            assertEquals("Deve voltar à quantidade anterior de notas em $artId", qtdNotasAntes, aposRemocaoNota.notas.size)
            assertNull(aposRemocaoNota.notas.find { it.id == "nota_dinamica_$artId" })
        }
    }
}
