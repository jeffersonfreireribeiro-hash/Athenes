package com.athenes.ui.editor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athenes.core.export.AlinhamentoExport
import com.athenes.core.export.BlocoExport
import com.athenes.core.export.DocumentoExport
import com.athenes.core.export.TipoBlocoExport
import com.athenes.core.citacao.Bibliografia
import com.athenes.core.citacao.BibliografiaCodec
import com.athenes.core.citacao.CitacaoInline
import com.athenes.core.citacao.CitacoesInline
import com.athenes.core.citacao.EstiloBibliografico
import com.athenes.core.citacao.ReferenciaAcademica
import com.athenes.core.citacao.TextoComCitacoes
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.CitacaoMarcada
import com.athenes.core.model.Documento
import com.athenes.core.model.ConfiguracaoPagina
import com.athenes.core.model.ConfiguracaoPaginaCodec
import com.athenes.core.model.NumeracaoSecoes
import com.athenes.core.model.TipoDocumento
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

enum class EstiloTexto(val rotulo: String, val tamanhoPt: Int, val ehNegrito: Boolean = false, val ehItalico: Boolean = false) {
    TEXTO_NORMAL("Texto normal", 12),
    TITULO_1("Título 1", 24, ehNegrito = true),
    TITULO_2("Título 2", 18, ehNegrito = true),
    TITULO_3("Título 3", 14, ehNegrito = true),
    SUBTITULO("Subtítulo", 14, ehItalico = true),
    CITACAO_DIRETA("Citação Direta", 10, ehItalico = true),
    LEGENDA("Legenda", 9),
    CODIGO("Código / Bloco", 11)
}

enum class AlinhamentoTexto {
    ESQUERDA, CENTRO, DIREITA, JUSTIFICADO,
    JUSTIFICADO_ESQUERDA, JUSTIFICADO_CENTRO, JUSTIFICADO_DIREITA
}

enum class TipoBlocoEditor(val rotulo: String, val desc: String) {
    TITULO("Título", "Título de seção numerada"),
    PARAGRAFO("Texto", "Parágrafo com recuo ABNT"),
    CITACAO("Citação", "Citação direta longa recuada"),
    FIGURA("Figura", "Ilustração numerada com legenda e fonte"),
    TABELA("Tabela", "Tabela de dados norma IBGE"),
    QUADRO("Quadro", "Conteúdo conceitual em células"),
    FORMULA("Fórmula", "Expressão matemática numerada"),
    LISTA("Lista", "Itens em lista"),
    SUMARIO("Sumário", "Títulos gerados automaticamente"),
    LISTA_ILUSTRACOES("Lista de ilustrações", "Legendas geradas automaticamente"),
    REFERENCIAS("Referências", "Obras citadas no estilo do documento"),
    CAMPOS("Campos", "Pares de rótulo e valor em colunas"),
    QUEBRA_PAGINA("Quebra de página", "Inicia uma nova página na exportação"),
    ESPACO("Espaço", "Altura vertical configurável em pontos"),
    DIVISOR("Divisor", "Linha divisória ou espaçamento")
}

data class BlocoEditor(
    val id: String = UUID.randomUUID().toString(),
    val tipo: TipoBlocoEditor,
    val titulo: String = "",
    val texto: String = "",
    val legenda: String = "",
    val fonte: String = "",
    val formulaLatex: String = "",
    val imagem: String = "", // nome do arquivo em filesDir/imagens (figuras)
    val colunas: Int = 12,
    val alinhamento: AlinhamentoTexto = AlinhamentoTexto.JUSTIFICADO,
    val estiloId: String = "texto",
    val tabelaLinhas: List<List<String>> = emptyList(),
    val listaNumerada: Boolean = false,
    val nivelTitulo: Int = 1,
    val citacoes: List<CitacaoInline> = emptyList(),
    val alturaPt: Double = 24.0,
    val camposColunas: Int = 2
)

data class SecaoEstrutura(
    val id: String,
    val numero: String,
    val titulo: String,
    val nivel: Int = 1,
    val subsecoes: List<SecaoEstrutura> = emptyList()
)

class EditorViewModel : ViewModel() {

    private val _documento = MutableStateFlow<Documento?>(null)
    val documento: StateFlow<Documento?> = _documento.asStateFlow()

    private val _titulo = MutableStateFlow("")
    val titulo: StateFlow<String> = _titulo.asStateFlow()

    private val _subtitulo = MutableStateFlow("")
    val subtitulo: StateFlow<String> = _subtitulo.asStateFlow()

    private val _autores = MutableStateFlow("")
    val autores: StateFlow<String> = _autores.asStateFlow()

    private val _resumo = MutableStateFlow("")
    val resumo: StateFlow<String> = _resumo.asStateFlow()

    private val _tipoDocumento = MutableStateFlow(TipoDocumento.ARTIGO)
    val tipoDocumento: StateFlow<TipoDocumento> = _tipoDocumento.asStateFlow()
    private val _configuracaoPagina = MutableStateFlow(ConfiguracaoPagina())
    val configuracaoPagina: StateFlow<ConfiguracaoPagina> = _configuracaoPagina.asStateFlow()
    private val _estiloBibliografico = MutableStateFlow(EstiloBibliografico.ABNT)
    val estiloBibliografico: StateFlow<EstiloBibliografico> = _estiloBibliografico.asStateFlow()
    private val _referencias = MutableStateFlow<List<ReferenciaAcademica>>(emptyList())
    val referencias: StateFlow<List<ReferenciaAcademica>> = _referencias.asStateFlow()

    private val _modoRevisao = MutableStateFlow("edicao") // "edicao" | "sugestao" | "leitura"
    val modoRevisao: StateFlow<String> = _modoRevisao.asStateFlow()

    // true = tudo gravado em disco; false = alteração pendente de autosave
    private val _salvo = MutableStateFlow(true)
    val salvo: StateFlow<Boolean> = _salvo.asStateFlow()

    // Painéis Laterais: Em tablets, operam como sobreposição (overlay)
    private val _painelEstruturaAberto = MutableStateFlow(false)
    val painelEstruturaAberto: StateFlow<Boolean> = _painelEstruturaAberto.asStateFlow()

    private val _abaEsquerdaAtiva = MutableStateFlow(0) // 0 = Seções, 1 = Margens ABNT, 2 = Estilos
    val abaEsquerdaAtiva: StateFlow<Int> = _abaEsquerdaAtiva.asStateFlow()

    private val _painelInspetorAberto = MutableStateFlow(false)
    val painelInspetorAberto: StateFlow<Boolean> = _painelInspetorAberto.asStateFlow()

    private val _painelCitacaoAberto = MutableStateFlow(false)
    val painelCitacaoAberto: StateFlow<Boolean> = _painelCitacaoAberto.asStateFlow()

    // Bloco Selecionado Atualmente no Palco
    private val _blocoSelecionadoId = MutableStateFlow<String?>(null)
    val blocoSelecionadoId: StateFlow<String?> = _blocoSelecionadoId.asStateFlow()
    private var cursorTexto: Pair<String, Int>? = null

    // Lista de Blocos na Folha
    private val _blocos = MutableStateFlow<List<BlocoEditor>>(listOf(blocoParagrafoVazio()))
    val blocos: StateFlow<List<BlocoEditor>> = _blocos.asStateFlow()

    // O texto das citações depende do estilo e da ordem das obras: restaurar apenas blocos
    // produziria marcas antigas com uma bibliografia nova após Desfazer.
    private data class EstadoHistorico(
        val blocos: List<BlocoEditor>,
        val estiloBibliografico: EstiloBibliografico,
        val referencias: List<ReferenciaAcademica>
    )
    private val historico = mutableListOf<EstadoHistorico>()
    private var indiceHistorico = -1

    private var pastaArmazenamento: File? = null
    private var jobAutosave: Job? = null
    private var documentoCarregadoId: String? = null

    init {
        salvarNoHistorico()
    }

    /**
     * Carrega o conteúdo gravado do documento (ou um esqueleto limpo) e zera histórico/painéis.
     * Idempotente por id: recomposições e rotações não descartam edições em andamento.
     */
    fun carregarDocumento(doc: Documento, pasta: File?) {
        if (documentoCarregadoId == doc.id) return
        documentoCarregadoId = doc.id
        pastaArmazenamento = pasta

        _documento.value = doc
        _titulo.value = doc.titulo
        _subtitulo.value = doc.subtitulo
        _autores.value = doc.autor
        _resumo.value = doc.resumo
        _tipoDocumento.value = doc.tipo
        _configuracaoPagina.value = ConfiguracaoPagina()
        _estiloBibliografico.value = EstiloBibliografico.ABNT
        _referencias.value = emptyList()
        _painelEstruturaAberto.value = false
        _painelInspetorAberto.value = false
        _painelCitacaoAberto.value = false

        val lido = lerDoDisco(doc.id)
        if (lido != null) {
            _titulo.value = lido.titulo
            _subtitulo.value = lido.subtitulo
            _autores.value = lido.autores
            _resumo.value = lido.resumo
            _blocos.value = lido.blocos.ifEmpty { listOf(blocoParagrafoVazio()) }
            _configuracaoPagina.value = lido.pagina
            _estiloBibliografico.value = lido.estiloBibliografico
            _referencias.value = lido.referencias
        } else {
            _blocos.value = if (doc.id == ID_DOCUMENTO_EXEMPLO) obterBlocosIniciais() else listOf(blocoParagrafoVazio())
            if (doc.id == ID_DOCUMENTO_EXEMPLO && _resumo.value.isBlank()) _resumo.value = RESUMO_EXEMPLO
        }
        _blocoSelecionadoId.value = null
        cursorTexto = null
        historico.clear()
        indiceHistorico = -1
        salvarNoHistorico()
        _salvo.value = true
    }

    fun definirTitulo(novo: String) { _titulo.value = novo; marcarAlterado() }
    fun definirSubtitulo(novo: String) { _subtitulo.value = novo; marcarAlterado() }
    fun definirResumo(novo: String) { _resumo.value = novo; marcarAlterado() }
    fun definirTipoDocumento(tipo: TipoDocumento) { _tipoDocumento.value = tipo; marcarAlterado() }
    fun definirConfiguracaoPagina(config: ConfiguracaoPagina) {
        require(config.validar()) { "Configuração de página inválida." }
        _configuracaoPagina.value = config
        marcarAlterado()
    }
    fun definirModoRevisao(modo: String) { _modoRevisao.value = modo }

    fun definirEstiloBibliografico(estilo: EstiloBibliografico) {
        if (_estiloBibliografico.value == estilo) return
        salvarNoHistorico()
        _estiloBibliografico.value = estilo
        _blocos.value = _blocos.value.map { bloco ->
            if (bloco.citacoes.isEmpty()) bloco else {
                val novo = CitacoesInline.reformatar(TextoComCitacoes(bloco.texto, bloco.citacoes), _referencias.value, estilo)
                bloco.copy(texto = novo.texto, citacoes = novo.citacoes)
            }
        }
        salvarNoHistorico()
        marcarAlterado()
    }

    fun alternarPainelEstrutura() {
        _painelEstruturaAberto.value = !_painelEstruturaAberto.value
        if (_painelEstruturaAberto.value) _painelInspetorAberto.value = false
    }

    fun fecharPainelEstrutura() { _painelEstruturaAberto.value = false }
    fun definirAbaEsquerda(aba: Int) { _abaEsquerdaAtiva.value = aba }

    fun alternarPainelInspetor() {
        _painelInspetorAberto.value = !_painelInspetorAberto.value
        if (_painelInspetorAberto.value) _painelEstruturaAberto.value = false
    }

    fun fecharPainelInspetor() { _painelInspetorAberto.value = false }
    fun abrirPainelCitacao() { _painelCitacaoAberto.value = true }
    fun fecharPainelCitacao() { _painelCitacaoAberto.value = false }

    fun selecionarBloco(id: String) {
        if (_blocoSelecionadoId.value != id) cursorTexto = null
        _blocoSelecionadoId.value = id
    }

    fun posicionarCursorTexto(id: String, posicao: Int) {
        if (_blocoSelecionadoId.value == id) cursorTexto = id to posicao
    }

    /** Seções numeradas derivadas dos blocos de título (fonte única: o próprio documento). */
    fun montarEstrutura(blocos: List<BlocoEditor>): List<SecaoEstrutura> {
        val titulos = blocos.filter { it.tipo == TipoBlocoEditor.TITULO && it.titulo.isNotBlank() }
        val numeros = NumeracaoSecoes.calcular(titulos.map { it.nivelTitulo })
        return titulos.mapIndexed { indice, b ->
            SecaoEstrutura(id = b.id, numero = numeros[indice], titulo = b.titulo, nivel = b.nivelTitulo)
        }
    }

    private fun atualizarBloco(id: String, transforma: (BlocoEditor) -> BlocoEditor) {
        _blocos.value = _blocos.value.map { if (it.id == id) transforma(it) else it }
        marcarAlterado()
    }

    fun atualizarTextoBloco(id: String, novo: String) = atualizarBloco(id) {
        it.copy(texto = novo, citacoes = CitacoesInline.atualizarDepoisDaEdicao(it.texto, novo, it.citacoes))
    }
    fun atualizarTituloBloco(id: String, novo: String) = atualizarBloco(id) { it.copy(titulo = novo) }
    fun atualizarLegendaBloco(id: String, novo: String) = atualizarBloco(id) { it.copy(legenda = novo) }
    fun atualizarFonteBloco(id: String, novo: String) = atualizarBloco(id) { it.copy(fonte = novo) }
    fun atualizarFormulaBloco(id: String, novo: String) = atualizarBloco(id) { it.copy(formulaLatex = novo) }

    fun definirImagemBloco(id: String, nomeArquivo: String) {
        salvarNoHistorico()
        atualizarBloco(id) { it.copy(imagem = nomeArquivo) }
    }

    fun atualizarCelulaTabela(id: String, linha: Int, coluna: Int, novo: String) = atualizarBloco(id) { b ->
        b.copy(tabelaLinhas = b.tabelaLinhas.mapIndexed { i, l ->
            if (i == linha) l.mapIndexed { j, c -> if (j == coluna) novo else c } else l
        })
    }

    fun adicionarLinhaTabela(id: String) {
        salvarNoHistorico()
        atualizarBloco(id) { b ->
            val colunas = b.tabelaLinhas.firstOrNull()?.size ?: 2
            b.copy(tabelaLinhas = b.tabelaLinhas + listOf(List(colunas) { "" }))
        }
    }

    fun adicionarCampo(id: String) {
        salvarNoHistorico()
        atualizarBloco(id) { if (it.tipo == TipoBlocoEditor.CAMPOS) it.copy(tabelaLinhas = it.tabelaLinhas + listOf(listOf("", ""))) else it }
        salvarNoHistorico()
    }

    fun removerCampo(id: String, indice: Int) {
        val bloco = _blocos.value.find { it.id == id && it.tipo == TipoBlocoEditor.CAMPOS } ?: return
        if (indice !in bloco.tabelaLinhas.indices) return
        salvarNoHistorico()
        atualizarBloco(id) { it.copy(tabelaLinhas = it.tabelaLinhas.filterIndexed { i, _ -> i != indice }) }
        salvarNoHistorico()
    }

    fun definirColunasCampos(id: String, colunas: Int) {
        val novo = colunas.coerceIn(1, 4)
        if (_blocos.value.none { it.id == id && it.tipo == TipoBlocoEditor.CAMPOS && it.camposColunas != novo }) return
        salvarNoHistorico()
        atualizarBloco(id) { it.copy(camposColunas = novo) }
        salvarNoHistorico()
    }

    fun definirAlinhamentoBloco(id: String, alinhamento: AlinhamentoTexto) {
        salvarNoHistorico()
        atualizarBloco(id) { it.copy(alinhamento = alinhamento) }
    }

    fun definirColunasBloco(id: String, colunas: Int) {
        salvarNoHistorico()
        atualizarBloco(id) { it.copy(colunas = colunas.coerceIn(1, 12)) }
    }
    fun definirAlturaEspacoBloco(id: String, alturaPt: Double) {
        require(alturaPt.isFinite() && alturaPt in 1.0..720.0) { "Altura deve ficar entre 1 e 720 pt." }
        if (_blocos.value.none { it.id == id && it.tipo == TipoBlocoEditor.ESPACO && it.alturaPt != alturaPt }) return
        salvarNoHistorico()
        atualizarBloco(id) { if (it.tipo == TipoBlocoEditor.ESPACO) it.copy(alturaPt = alturaPt) else it }
        salvarNoHistorico()
    }

    fun definirListaNumerada(id: String, numerada: Boolean) = atualizarBloco(id) { it.copy(listaNumerada = numerada) }
    fun definirNivelTitulo(id: String, nivel: Int) = atualizarBloco(id) { it.copy(nivelTitulo = nivel.coerceIn(1, 9)) }

    fun adicionarBloco(tipo: TipoBlocoEditor) {
        if (tipo == TipoBlocoEditor.REFERENCIAS) {
            _blocos.value.firstOrNull { it.tipo == tipo }?.let { selecionarBloco(it.id); return }
        }
        salvarNoHistorico()
        val novo = when (tipo) {
            TipoBlocoEditor.TITULO -> BlocoEditor(tipo = tipo, alinhamento = AlinhamentoTexto.ESQUERDA)
            TipoBlocoEditor.PARAGRAFO -> blocoParagrafoVazio()
            TipoBlocoEditor.CITACAO -> BlocoEditor(tipo = tipo)
            TipoBlocoEditor.FIGURA -> BlocoEditor(
                tipo = tipo,
                legenda = "Figura — legenda",
                fonte = "Fonte: elaborado pelos autores (${java.time.Year.now().value})",
                alinhamento = AlinhamentoTexto.CENTRO
            )
            TipoBlocoEditor.TABELA -> BlocoEditor(
                tipo = tipo,
                legenda = "Tabela — legenda",
                fonte = "Fonte: elaborado pelos autores (${java.time.Year.now().value})",
                alinhamento = AlinhamentoTexto.CENTRO,
                tabelaLinhas = listOf(listOf("Coluna 1", "Coluna 2", "Coluna 3"), listOf("", "", ""))
            )
            TipoBlocoEditor.QUADRO -> BlocoEditor(
                tipo = tipo, legenda = "Quadro — título", fonte = "Fonte: elaboração própria",
                alinhamento = AlinhamentoTexto.ESQUERDA,
                tabelaLinhas = listOf(listOf("Categoria", "Definição"), listOf("", ""))
            )
            TipoBlocoEditor.FORMULA -> BlocoEditor(tipo = tipo, formulaLatex = "x = y", alinhamento = AlinhamentoTexto.CENTRO)
            TipoBlocoEditor.LISTA -> BlocoEditor(tipo = tipo, texto = "Primeiro item\nSegundo item", alinhamento = AlinhamentoTexto.ESQUERDA)
            TipoBlocoEditor.SUMARIO -> BlocoEditor(tipo = tipo, alinhamento = AlinhamentoTexto.ESQUERDA)
            TipoBlocoEditor.LISTA_ILUSTRACOES -> BlocoEditor(tipo = tipo, alinhamento = AlinhamentoTexto.ESQUERDA)
            TipoBlocoEditor.REFERENCIAS -> BlocoEditor(tipo = tipo, alinhamento = AlinhamentoTexto.ESQUERDA)
            TipoBlocoEditor.CAMPOS -> BlocoEditor(tipo = tipo, titulo = "Identificação e parâmetros",
                tabelaLinhas = listOf(listOf("", "")), alinhamento = AlinhamentoTexto.ESQUERDA)
            TipoBlocoEditor.QUEBRA_PAGINA -> BlocoEditor(tipo = tipo)
            TipoBlocoEditor.ESPACO -> BlocoEditor(tipo = tipo)
            TipoBlocoEditor.DIVISOR -> BlocoEditor(tipo = tipo)
        }
        inserirAposSelecionado(novo)
    }

    /** Insere uma citação estruturada no cursor e mantém a obra na lista do documento. */
    fun inserirCitacao(artigo: ArtigoEstudoDetalhado, pagina: String = "", narrativa: Boolean = false) {
        val referencia = ReferenciaAcademica.doArtigo(artigo)
        val paginaValidada = Bibliografia.validarPagina(pagina, referencia.paginas, artigo.totalPaginas)
        require(paginaValidada.valida) { paginaValidada.mensagem }
        salvarNoHistorico()
        if (_referencias.value.none { it.id == referencia.id }) _referencias.value = _referencias.value + referencia
        val indice = _referencias.value.indexOfFirst { it.id == referencia.id } + 1
        val marca = Bibliografia.citacao(referencia, _estiloBibliografico.value, indice, paginaValidada.valor, narrativa)
        val alvo = _blocos.value.find { it.id == _blocoSelecionadoId.value }
        if (alvo != null && (alvo.tipo == TipoBlocoEditor.PARAGRAFO || alvo.tipo == TipoBlocoEditor.CITACAO)) {
            val posicao = cursorTexto?.takeIf { it.first == alvo.id }?.second?.coerceIn(0, alvo.texto.length) ?: alvo.texto.length
            val novo = CitacoesInline.inserir(TextoComCitacoes(alvo.texto, alvo.citacoes), posicao, referencia.id, marca, paginaValidada.valor, narrativa)
            atualizarBloco(alvo.id) { it.copy(texto = novo.texto, citacoes = novo.citacoes) }
            val prefixo = if (posicao > 0 && !alvo.texto[posicao - 1].isWhitespace()) 1 else 0
            cursorTexto = alvo.id to (posicao + prefixo + marca.length)
        } else {
            inserirAposSelecionado(BlocoEditor(tipo = TipoBlocoEditor.PARAGRAFO, texto = marca,
                citacoes = listOf(CitacaoInline(referencia.id, 0, marca.length, paginaValidada.valor, narrativa))))
        }
        if (_blocos.value.none { it.tipo == TipoBlocoEditor.REFERENCIAS }) {
            _blocos.value = _blocos.value + BlocoEditor(tipo = TipoBlocoEditor.REFERENCIAS)
        }
        salvarNoHistorico()
        _painelCitacaoAberto.value = false
    }

    /** Transfere um destaque do leitor para um bloco de citação longa com referência vinculada. */
    fun inserirCitacaoLonga(artigo: ArtigoEstudoDetalhado, destaque: CitacaoMarcada) {
        val referencia = ReferenciaAcademica.doArtigo(artigo)
        val indice = _referencias.value.indexOfFirst { it.id == referencia.id }.takeIf { it >= 0 }?.plus(1)
            ?: (_referencias.value.size + 1)
        val citacaoLonga = CitacoesInline.deDestaque(destaque.texto, destaque.pagina, referencia, _estiloBibliografico.value, indice)
        salvarNoHistorico()
        if (_referencias.value.none { it.id == referencia.id }) _referencias.value = _referencias.value + referencia
        inserirAposSelecionado(BlocoEditor(tipo = TipoBlocoEditor.CITACAO, texto = citacaoLonga.texto,
            citacoes = citacaoLonga.citacoes))
        if (_blocos.value.none { it.tipo == TipoBlocoEditor.REFERENCIAS })
            _blocos.value = _blocos.value + BlocoEditor(tipo = TipoBlocoEditor.REFERENCIAS)
        salvarNoHistorico()
        marcarAlterado()
    }

    private fun inserirAposSelecionado(novo: BlocoEditor) {
        val lista = _blocos.value.toMutableList()
        val idx = lista.indexOfFirst { it.id == _blocoSelecionadoId.value }
        if (idx >= 0) lista.add(idx + 1, novo) else lista.add(novo)
        _blocos.value = lista
        _blocoSelecionadoId.value = novo.id
        marcarAlterado()
    }

    fun removerBloco(id: String) {
        salvarNoHistorico()
        _blocos.value = _blocos.value.filterNot { it.id == id }.ifEmpty { listOf(blocoParagrafoVazio()) }
        if (_blocoSelecionadoId.value == id) _blocoSelecionadoId.value = _blocos.value.firstOrNull()?.id
        marcarAlterado()
    }

    fun duplicarBloco(id: String) {
        salvarNoHistorico()
        val original = _blocos.value.find { it.id == id } ?: return
        val copia = original.copy(id = UUID.randomUUID().toString())
        val lista = _blocos.value.toMutableList()
        val idx = lista.indexOfFirst { it.id == id }
        if (idx >= 0) lista.add(idx + 1, copia) else lista.add(copia)
        _blocos.value = lista
        _blocoSelecionadoId.value = copia.id
        marcarAlterado()
    }

    /** Divide um parágrafo ou citação na posição do cursor, preservando o estilo dos dois blocos. */
    fun dividirBloco(id: String, posicao: Int): Boolean {
        val lista = _blocos.value.toMutableList()
        val indice = lista.indexOfFirst { it.id == id }
        if (indice < 0) return false
        val original = lista[indice]
        if (original.tipo !in setOf(TipoBlocoEditor.PARAGRAFO, TipoBlocoEditor.CITACAO) ||
            posicao <= 0 || posicao >= original.texto.length) return false
        salvarNoHistorico()
        lista[indice] = original.copy(texto = original.texto.substring(0, posicao))
        lista[indice] = lista[indice].copy(citacoes = original.citacoes.filter { it.fim <= posicao })
        val novo = original.copy(id = UUID.randomUUID().toString(), texto = original.texto.substring(posicao),
            citacoes = original.citacoes.filter { it.inicio >= posicao }.map { it.copy(inicio = it.inicio - posicao, fim = it.fim - posicao) })
        lista.add(indice + 1, novo)
        _blocos.value = lista
        _blocoSelecionadoId.value = novo.id
        cursorTexto = null
        salvarNoHistorico()
        marcarAlterado()
        return true
    }

    fun desfazer() {
        if (indiceHistorico > 0) {
            indiceHistorico--
            restaurarHistorico(historico[indiceHistorico])
            marcarAlterado()
        }
    }

    fun refazer() {
        if (indiceHistorico < historico.size - 1) {
            indiceHistorico++
            restaurarHistorico(historico[indiceHistorico])
            marcarAlterado()
        }
    }

    private fun salvarNoHistorico() {
        while (historico.size > indiceHistorico + 1) historico.removeAt(historico.size - 1)
        val estado = EstadoHistorico(_blocos.value, _estiloBibliografico.value, _referencias.value)
        if (historico.lastOrNull() == estado) return
        historico.add(estado)
        if (historico.size > LIMITE_HISTORICO) historico.removeAt(0)
        indiceHistorico = historico.size - 1
    }

    private fun restaurarHistorico(estado: EstadoHistorico) {
        _blocos.value = estado.blocos
        _estiloBibliografico.value = estado.estiloBibliografico
        _referencias.value = estado.referencias
        if (_blocos.value.none { it.id == _blocoSelecionadoId.value }) _blocoSelecionadoId.value = null
        cursorTexto = null
    }

    /** Instantâneo neutro (sem Android) do documento atual para os exportadores. */
    fun paraExportacao(): DocumentoExport = DocumentoExport(
        titulo = _titulo.value,
        subtitulo = _subtitulo.value,
        autores = _autores.value,
        resumo = _resumo.value,
        pagina = _configuracaoPagina.value,
        estiloBibliografico = _estiloBibliografico.value,
        referencias = _referencias.value,
        blocos = _blocos.value.map { b ->
            BlocoExport(
                tipo = TipoBlocoExport.valueOf(b.tipo.name),
                titulo = b.titulo, texto = b.texto, legenda = b.legenda, fonte = b.fonte,
                formula = b.formulaLatex, imagem = b.imagem,
                alinhamento = AlinhamentoExport.valueOf(b.alinhamento.name),
                tabela = b.tabelaLinhas, listaNumerada = b.listaNumerada, nivelTitulo = b.nivelTitulo,
                citacoes = b.citacoes, alturaPt = b.alturaPt, camposColunas = b.camposColunas
            )
        }
    )

    /** Nome de arquivo seguro a partir do título, sem acentos ("Análise" -> "analise"). */
    fun nomeBaseArquivo(): String =
        java.text.Normalizer.normalize(_titulo.value.lowercase(), java.text.Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .replace(Regex("[^a-z0-9]+"), "_").trim('_').take(48).trim('_')
            .ifEmpty { "documento" }

    fun exportarJson(): String {
        require(_blocos.value.none { it.imagem.isNotBlank() }) {
            "Este documento contém imagens. A exportação JSON simples não as incorpora."
        }
        return serializar()
    }

    // ------------------------------------------------------------------
    // Persistência: um arquivo JSON por documento em filesDir
    // ------------------------------------------------------------------

    private fun marcarAlterado() {
        _salvo.value = false
        jobAutosave?.cancel()
        jobAutosave = viewModelScope.launch {
            delay(AUTOSAVE_MS)
            gravarNoDisco()
        }
    }

    /** Salvamento imediato (botão Salvar e saída da tela). */
    fun salvarDocumento() {
        jobAutosave?.cancel()
        viewModelScope.launch { gravarNoDisco() }
    }

    private suspend fun gravarNoDisco() {
        val doc = _documento.value ?: return
        val arquivo = arquivoDe(doc.id) ?: run { _salvo.value = true; return }
        val json = serializar()
        withContext(Dispatchers.IO) {
            try {
                arquivo.writeText(json)
            } catch (_: Exception) {
            }
        }
        _salvo.value = true
    }

    override fun onCleared() {
        // Última gravação síncrona: o escopo do ViewModel já foi cancelado neste ponto.
        val doc = _documento.value
        if (doc != null && !_salvo.value) {
            try { arquivoDe(doc.id)?.writeText(serializar()) } catch (_: Exception) {}
        }
        super.onCleared()
    }

    private fun arquivoDe(id: String): File? = pastaArmazenamento?.let { File(it, "editor_$id.json") }

    private fun serializar(): String {
        val raiz = JSONObject()
        raiz.put("titulo", _titulo.value)
        raiz.put("subtitulo", _subtitulo.value)
        raiz.put("autores", _autores.value)
        raiz.put("resumo", _resumo.value)
        raiz.put("pagina", ConfiguracaoPaginaCodec.escrever(_configuracaoPagina.value))
        raiz.put("estiloBibliografico", _estiloBibliografico.value.id)
        raiz.put("referencias", BibliografiaCodec.escrever(_referencias.value))
        val arr = JSONArray()
        _blocos.value.forEach { b ->
            arr.put(JSONObject().apply {
                put("id", b.id); put("tipo", b.tipo.name); put("titulo", b.titulo); put("texto", b.texto)
                put("legenda", b.legenda); put("fonte", b.fonte); put("formulaLatex", b.formulaLatex); put("imagem", b.imagem)
                put("colunas", b.colunas); put("alinhamento", b.alinhamento.name); put("estiloId", b.estiloId)
                put("tabela", JSONArray(b.tabelaLinhas.map { JSONArray(it) }))
                put("listaNumerada", b.listaNumerada)
                put("nivelTitulo", b.nivelTitulo)
                put("alturaPt", b.alturaPt)
                put("camposColunas", b.camposColunas)
                put("citacoes", BibliografiaCodec.escreverCitacoes(b.citacoes))
            })
        }
        raiz.put("blocos", arr)
        return raiz.toString()
    }

    private class ConteudoLido(
        val titulo: String, val subtitulo: String, val autores: String, val resumo: String,
        val blocos: List<BlocoEditor>, val pagina: ConfiguracaoPagina,
        val estiloBibliografico: EstiloBibliografico, val referencias: List<ReferenciaAcademica>
    )

    private fun lerDoDisco(id: String): ConteudoLido? {
        val arquivo = arquivoDe(id)?.takeIf { it.exists() } ?: return null
        return try {
            val raiz = JSONObject(arquivo.readText())
            val arr = raiz.getJSONArray("blocos")
            val blocos = (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                val tab = o.optJSONArray("tabela")
                BlocoEditor(
                    id = o.optString("id", UUID.randomUUID().toString()),
                    tipo = runCatching { TipoBlocoEditor.valueOf(o.optString("tipo")) }.getOrDefault(TipoBlocoEditor.PARAGRAFO),
                    titulo = o.optString("titulo"), texto = o.optString("texto"),
                    legenda = o.optString("legenda"), fonte = o.optString("fonte"),
                    formulaLatex = o.optString("formulaLatex"), imagem = o.optString("imagem"), colunas = o.optInt("colunas", 12),
                    alinhamento = runCatching { AlinhamentoTexto.valueOf(o.optString("alinhamento")) }.getOrDefault(AlinhamentoTexto.JUSTIFICADO),
                    estiloId = o.optString("estiloId", "texto"), listaNumerada = o.optBoolean("listaNumerada"),
                    nivelTitulo = o.optInt("nivelTitulo", 1).coerceIn(1, 9),
                    alturaPt = o.optDouble("alturaPt", 24.0).takeIf { it.isFinite() && it in 1.0..720.0 } ?: 24.0,
                    camposColunas = o.optInt("camposColunas", 2).coerceIn(1, 4),
                    citacoes = BibliografiaCodec.lerCitacoes(o.optJSONArray("citacoes"), o.optString("texto")),
                    tabelaLinhas = if (tab == null) emptyList() else (0 until tab.length()).map { r ->
                        val l = tab.getJSONArray(r)
                        (0 until l.length()).map { c -> l.getString(c) }
                    }
                )
            }
            ConteudoLido(
                raiz.optString("titulo"), raiz.optString("subtitulo"),
                raiz.optString("autores"), raiz.optString("resumo"), blocos,
                ConfiguracaoPaginaCodec.ler(raiz.optJSONObject("pagina")),
                EstiloBibliografico.deId(raiz.optString("estiloBibliografico")),
                BibliografiaCodec.ler(raiz.optJSONArray("referencias"))
            )
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val ID_DOCUMENTO_EXEMPLO = "doc_reurb_sustentavel"
        private const val AUTOSAVE_MS = 900L
        private const val LIMITE_HISTORICO = 60
        private const val RESUMO_EXEMPLO =
            "Este artigo apresenta metodologia integrada para modelagem e diagramação acadêmica de peças técnicas e artigos com rigor ABNT e APA."

        fun blocoParagrafoVazio() = BlocoEditor(tipo = TipoBlocoEditor.PARAGRAFO)

        fun obterBlocosIniciais(): List<BlocoEditor> {
            return listOf(
                BlocoEditor(
                    id = "bloco_sec_1",
                    tipo = TipoBlocoEditor.TITULO,
                    titulo = "INTRODUÇÃO E DELIMITAÇÃO DO TEMA",
                    alinhamento = AlinhamentoTexto.ESQUERDA
                ),
                BlocoEditor(
                    id = "bloco_par_1",
                    tipo = TipoBlocoEditor.PARAGRAFO,
                    texto = "A elaboração de relatórios técnicos e artigos científicos com conformidade normativa requer rigor metodológico na estruturação de seções, parágrafos e citações bibliográficas. No modelo editorial em blocos do Athenes, cada componente preserva suas propriedades geométricas e tipográficas em milímetros e pontos, garantindo diagramação contínua de alta precisão."
                ),
                BlocoEditor(
                    id = "bloco_par_2",
                    tipo = TipoBlocoEditor.PARAGRAFO,
                    texto = "Historicamente, a dissociação entre editores de texto convencionais e gerenciadores de referências bibliográficas acarretou retrabalho na atualização de citações e na formatação de notas de rodapé. A integração adotada nesta plataforma possibilita a inserção imediata de dados sincronizados do acervo Zotero."
                ),
                BlocoEditor(
                    id = "bloco_cit_1",
                    tipo = TipoBlocoEditor.CITACAO,
                    texto = "A segurança jurídica da posse depende diretamente da precisão geométrica e da rastreabilidade social do cadastro territorial, constituindo o elo permanente entre o levantamento técnico e a titulação no registro de imóveis (SANTOS; RIBEIRO, 2025, p. 114)."
                ),
                BlocoEditor(
                    id = "bloco_fig_1",
                    tipo = TipoBlocoEditor.FIGURA,
                    legenda = "Figura 1 — Esquema metodológico de integração territorial e diagramação paramétrica",
                    fonte = "Fonte: Elaborado pelos autores (2026)",
                    alinhamento = AlinhamentoTexto.CENTRO
                ),
                BlocoEditor(
                    id = "bloco_tab_1",
                    tipo = TipoBlocoEditor.TABELA,
                    legenda = "Tabela 1 — Indicadores quantitativos de consolidação urbana",
                    fonte = "Fonte: Banco territorial SIRGAS 2000 (2026)",
                    alinhamento = AlinhamentoTexto.CENTRO,
                    tabelaLinhas = listOf(
                        listOf("Núcleo Urbano", "Lotes", "Área Total (m²)", "Status"),
                        listOf("Núcleo Central", "142", "45.820,00", "Validado"),
                        listOf("Comunidade Esperança", "86", "28.340,50", "Conforme"),
                        listOf("Setor Bela Vista", "119", "39.110,20", "Validado")
                    )
                ),
                BlocoEditor(
                    id = "bloco_form_1",
                    tipo = TipoBlocoEditor.FORMULA,
                    formulaLatex = "Iv = (Σ Lv / Agleba) × 100",
                    alinhamento = AlinhamentoTexto.CENTRO
                )
            )
        }
    }
}
