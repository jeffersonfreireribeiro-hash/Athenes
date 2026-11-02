package com.athenes.ui.editor

import androidx.lifecycle.ViewModel
import com.athenes.core.model.TipoDocumento
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
    ESQUERDA, CENTRO, DIREITA, JUSTIFICADO
}

data class SecaoEstrutura(
    val id: String,
    val numero: String,
    val titulo: String,
    val nivel: Int = 1,
    val subsecoes: List<SecaoEstrutura> = emptyList()
)

data class NotaEditor(
    val id: String,
    val texto: String,
    val corHex: String
)

class EditorViewModel : ViewModel() {

    private val _titulo = MutableStateFlow("Revisão da Literatura sobre Tecnologias Educacionais")
    val titulo: StateFlow<String> = _titulo.asStateFlow()

    private val _subtitulo = MutableStateFlow("Uma análise das principais abordagens e perspectivas atuais")
    val subtitulo: StateFlow<String> = _subtitulo.asStateFlow()

    private val _autores = MutableStateFlow("Maria Silva Santos¹, João Pereira Lima², Ana Souza Oliveira³")
    val autores: StateFlow<String> = _autores.asStateFlow()

    private val _tipoDocumento = MutableStateFlow(TipoDocumento.ARTIGO)
    val tipoDocumento: StateFlow<TipoDocumento> = _tipoDocumento.asStateFlow()

    private val _estiloAtivo = MutableStateFlow(EstiloTexto.TEXTO_NORMAL)
    val estiloAtivo: StateFlow<EstiloTexto> = _estiloAtivo.asStateFlow()

    private val _fonteAtiva = MutableStateFlow("Arial")
    val fonteAtiva: StateFlow<String> = _fonteAtiva.asStateFlow()

    private val _tamanhoFonte = MutableStateFlow(12)
    val tamanhoFonte: StateFlow<Int> = _tamanhoFonte.asStateFlow()

    private val _negrito = MutableStateFlow(false)
    val negrito: StateFlow<Boolean> = _negrito.asStateFlow()

    private val _italico = MutableStateFlow(false)
    val italico: StateFlow<Boolean> = _italico.asStateFlow()

    private val _sublinhado = MutableStateFlow(false)
    val sublinhado: StateFlow<Boolean> = _sublinhado.asStateFlow()

    private val _tachado = MutableStateFlow(false)
    val tachado: StateFlow<Boolean> = _tachado.asStateFlow()

    private val _alinhamento = MutableStateFlow(AlinhamentoTexto.ESQUERDA)
    val alinhamento: StateFlow<AlinhamentoTexto> = _alinhamento.asStateFlow()

    private val _paginaAtual = MutableStateFlow(1)
    val paginaAtual: StateFlow<Int> = _paginaAtual.asStateFlow()

    val totalPaginas: Int = 12

    private val _zoom = MutableStateFlow(100)
    val zoom: StateFlow<Int> = _zoom.asStateFlow()

    // Painéis Laterais: Em tablets verticais, iniciam recolhidos (overlay)
    private val _painelEstruturaAberto = MutableStateFlow(false)
    val painelEstruturaAberto: StateFlow<Boolean> = _painelEstruturaAberto.asStateFlow()

    private val _painelInspetorAberto = MutableStateFlow(false)
    val painelInspetorAberto: StateFlow<Boolean> = _painelInspetorAberto.asStateFlow()

    private val _secaoSelecionadaId = MutableStateFlow("intro")
    val secaoSelecionadaId: StateFlow<String> = _secaoSelecionadaId.asStateFlow()

    // Tags acadêmicas
    val tags = listOf("Educação", "Tecnologia", "Revisão")

    // Notas de produção do usuário
    val notas = listOf(
        NotaEditor("1", "Ponto importante sobre a personalização.", "#FDE047"),
        NotaEditor("2", "Verificar referências deste trecho.", "#D8B4FE")
    )

    // Árvore de Estrutura do Artigo Científico
    val estrutura = listOf(
        SecaoEstrutura("intro", "1.", "Introdução", 1),
        SecaoEstrutura(
            "fund", "2.", "Fundamentação Teórica", 1,
            subsecoes = listOf(
                SecaoEstrutura("fund_1", "2.1.", "Conceitos Básicos", 2),
                SecaoEstrutura("fund_2", "2.2.", "Trabalhos Relacionados", 2)
            )
        ),
        SecaoEstrutura("met", "3.", "Metodologia", 1),
        SecaoEstrutura("res", "4.", "Resultados", 1),
        SecaoEstrutura("disc", "5.", "Discussão", 1),
        SecaoEstrutura("conc", "6.", "Conclusão", 1)
    )

    fun alternarPainelEstrutura() {
        _painelEstruturaAberto.value = !_painelEstruturaAberto.value
    }

    fun alternarPainelInspetor() {
        _painelInspetorAberto.value = !_painelInspetorAberto.value
    }

    fun definirEstilo(estilo: EstiloTexto) {
        _estiloAtivo.value = estilo
        _tamanhoFonte.value = estilo.tamanhoPt
        _negrito.value = estilo.ehNegrito
        _italico.value = estilo.ehItalico
    }

    fun definirFonte(fonte: String) {
        _fonteAtiva.value = fonte
    }

    fun definirTamanho(tam: Int) {
        _tamanhoFonte.value = tam
    }

    fun alternarNegrito() {
        _negrito.value = !_negrito.value
    }

    fun alternarItalico() {
        _italico.value = !_italico.value
    }

    fun alternarSublinhado() {
        _sublinhado.value = !_sublinhado.value
    }

    fun alternarTachado() {
        _tachado.value = !_tachado.value
    }

    fun definirAlinhamento(al: AlinhamentoTexto) {
        _alinhamento.value = al
    }

    fun selecionarSecao(id: String) {
        _secaoSelecionadaId.value = id
    }

    fun proximaPagina() {
        if (_paginaAtual.value < totalPaginas) _paginaAtual.value += 1
    }

    fun paginaAnterior() {
        if (_paginaAtual.value > 1) _paginaAtual.value -= 1
    }

    fun zoomIn() {
        if (_zoom.value < 200) _zoom.value += 10
    }

    fun zoomOut() {
        if (_zoom.value > 50) _zoom.value -= 10
    }
}
