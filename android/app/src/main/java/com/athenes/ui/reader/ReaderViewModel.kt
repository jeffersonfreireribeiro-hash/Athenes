package com.athenes.ui.reader

import androidx.lifecycle.ViewModel
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

data class TextoSelecionadoPopup(
    val texto: String,
    val pagina: Int,
    val xOffset: Float = 0f,
    val yOffset: Float = 0f
)

class ReaderViewModel(
    private val repository: ArtigoEstudoRepository = ArtigoEstudoRepository()
) : ViewModel() {

    val artigos = repository.artigos

    private val _artigoAtivoId = MutableStateFlow(repository.artigoAtivoId.value)
    val artigoAtivoId: StateFlow<String> = _artigoAtivoId.asStateFlow()

    private val _paginaAtiva = MutableStateFlow(1)
    val paginaAtiva: StateFlow<Int> = _paginaAtiva.asStateFlow()

    private val _zoom = MutableStateFlow(1.0f)
    val zoom: StateFlow<Float> = _zoom.asStateFlow()

    private val _ferramentaAtiva = MutableStateFlow(FerramentaLeitura.SELECAO)
    val ferramentaAtiva: StateFlow<FerramentaLeitura> = _ferramentaAtiva.asStateFlow()

    // 6 Cores Exatas da Barra de Ferramentas Web do Athenes (athenes_estudo_artigos.js linha 972)
    val coresDisponiveis = listOf(
        "#314F79", // Azul Marinho Athenes (Padrão Ativo)
        "#DC2626", // Vermelho
        "#059669", // Verde
        "#D97706", // Laranja
        "#7C3AED", // Roxo
        "#FACC15"  // Amarelo
    )

    private val _corAtiva = MutableStateFlow("#314F79")
    val corAtiva: StateFlow<String> = _corAtiva.asStateFlow()

    private val _modoLinhaReta = MutableStateFlow(false)
    val modoLinhaReta: StateFlow<Boolean> = _modoLinhaReta.asStateFlow()

    private val _modoRolagem = MutableStateFlow(ModoRolagemPdf.CONTINUA)
    val modoRolagem: StateFlow<ModoRolagemPdf> = _modoRolagem.asStateFlow()

    private val _modoAmbiente = MutableStateFlow(ModoAmbienteLeitura.LEITURA)
    val modoAmbiente: StateFlow<ModoAmbienteLeitura> = _modoAmbiente.asStateFlow()

    private val _marcadores = MutableStateFlow<Set<Int>>(setOf(1, 17))
    val marcadores: StateFlow<Set<Int>> = _marcadores.asStateFlow()

    private val _painelEsquerdoAberto = MutableStateFlow(false)
    val painelEsquerdoAberto: StateFlow<Boolean> = _painelEsquerdoAberto.asStateFlow()

    private val _painelDireitoAberto = MutableStateFlow(false)
    val painelDireitoAberto: StateFlow<Boolean> = _painelDireitoAberto.asStateFlow()

    private val _abaDireitaAtiva = MutableStateFlow(AbaInspetorDireito.RESUMO_NOTAS)
    val abaDireitaAtiva: StateFlow<AbaInspetorDireito> = _abaDireitaAtiva.asStateFlow()

    private val _textoSelecionado = MutableStateFlow<TextoSelecionadoPopup?>(null)
    val textoSelecionado: StateFlow<TextoSelecionadoPopup?> = _textoSelecionado.asStateFlow()

    private val _filtroArtigos = MutableStateFlow("")
    val filtroArtigos: StateFlow<String> = _filtroArtigos.asStateFlow()

    private val _mostrarDialogNovaCitacao = MutableStateFlow(false)
    val mostrarDialogNovaCitacao: StateFlow<Boolean> = _mostrarDialogNovaCitacao.asStateFlow()

    private val _mostrarDialogNovaNota = MutableStateFlow(false)
    val mostrarDialogNovaNota: StateFlow<Boolean> = _mostrarDialogNovaNota.asStateFlow()

    private val _mostrarDialogZoteroDrive = MutableStateFlow(false)
    val mostrarDialogZoteroDrive: StateFlow<Boolean> = _mostrarDialogZoteroDrive.asStateFlow()

    fun obterArtigoAtivo(): ArtigoEstudoDetalhado {
        return repository.artigos.value.find { it.id == _artigoAtivoId.value }
            ?: repository.artigos.value.first()
    }

    fun selecionarArtigo(id: String) {
        _artigoAtivoId.value = id
        _paginaAtiva.value = 1
        repository.selecionarArtigo(id)
    }

    fun navegarParaPagina(num: Int) {
        val total = obterArtigoAtivo().totalPaginas
        if (num in 1..total) {
            _paginaAtiva.value = num
        }
    }

    fun paginaAnterior() {
        if (_paginaAtiva.value > 1) {
            _paginaAtiva.value -= 1
        }
    }

    fun proximaPagina() {
        val total = obterArtigoAtivo().totalPaginas
        if (_paginaAtiva.value < total) {
            _paginaAtiva.value += 1
        }
    }

    fun definirFerramenta(ferramenta: FerramentaLeitura) {
        _ferramentaAtiva.value = ferramenta
    }

    fun definirCor(corHex: String) {
        _corAtiva.value = corHex
    }

    fun alternarPainelEsquerdo() {
        _painelEsquerdoAberto.value = !_painelEsquerdoAberto.value
    }

    fun alternarPainelDireito() {
        _painelDireitoAberto.value = !_painelDireitoAberto.value
    }

    fun selecionarAbaDireita(aba: AbaInspetorDireito) {
        _abaDireitaAtiva.value = aba
    }

    fun selecionarTexto(texto: String, pagina: Int, x: Float = 0f, y: Float = 0f) {
        _textoSelecionado.value = TextoSelecionadoPopup(texto, pagina, x, y)
    }

    fun fecharPopupSelecao() {
        _textoSelecionado.value = null
    }

    fun definirFiltroArtigos(filtro: String) {
        _filtroArtigos.value = filtro
    }

    fun grifarTextoSelecionado() {
        val sel = _textoSelecionado.value ?: return
        val art = obterArtigoAtivo()
        val novoTraco = TracoDesenho(
            pagina = sel.pagina,
            corHex = _corAtiva.value,
            espessura = 14f,
            pontos = listOf(PontoTraco(100f, 200f), PontoTraco(600f, 200f)),
            ehLinhaReta = true,
            ehMarcaTexto = true
        )
        repository.adicionarTraco(art.id, novoTraco)
        _textoSelecionado.value = null
    }

    fun abrirCriacaoCitacao() {
        _mostrarDialogNovaCitacao.value = true
    }

    fun fecharDialogNovaCitacao() {
        _mostrarDialogNovaCitacao.value = false
    }

    fun salvarCitacao(texto: String, comentario: String, pagina: Int) {
        val art = obterArtigoAtivo()
        val autorLimpo = art.autores.replace(", ${art.ano}", "").trim()
        val cit = CitacaoMarcada(
            pagina = pagina,
            texto = texto,
            comentario = comentario,
            referenciaAbnt = "($autorLimpo, ${art.ano}, p. $pagina)",
            corHex = _corAtiva.value
        )
        repository.adicionarCitacao(art.id, cit)
        _mostrarDialogNovaCitacao.value = false
        _textoSelecionado.value = null
        _abaDireitaAtiva.value = AbaInspetorDireito.CITACOES
    }

    fun removerCitacao(citacaoId: String) {
        val art = obterArtigoAtivo()
        repository.removerCitacao(art.id, citacaoId)
    }

    fun abrirCriacaoNota() {
        _mostrarDialogNovaNota.value = true
    }

    fun fecharDialogNovaNota() {
        _mostrarDialogNovaNota.value = false
    }

    fun salvarNota(titulo: String, texto: String, pagina: Int) {
        val art = obterArtigoAtivo()
        val nota = NotaAdesiva(
            pagina = pagina,
            titulo = titulo,
            texto = texto,
            corHex = _corAtiva.value
        )
        repository.adicionarNota(art.id, nota)
        _mostrarDialogNovaNota.value = false
        _textoSelecionado.value = null
        _abaDireitaAtiva.value = AbaInspetorDireito.RESUMO_NOTAS
    }

    fun removerNota(notaId: String) {
        val art = obterArtigoAtivo()
        repository.removerNota(art.id, notaId)
    }

    fun abrirModalZoteroDrive() {
        _mostrarDialogZoteroDrive.value = true
    }

    fun fecharModalZoteroDrive() {
        _mostrarDialogZoteroDrive.value = false
    }

    fun salvarConfigZoteroDrive(config: ZoteroVinculoConfig) {
        val art = obterArtigoAtivo()
        repository.atualizarConfigZotero(art.id, config)
        _mostrarDialogZoteroDrive.value = false
    }

    fun desfazerTraco() {
        val art = obterArtigoAtivo()
        repository.desfazerUltimoTraco(art.id, _paginaAtiva.value)
    }

    fun limparPagina() {
        val art = obterArtigoAtivo()
        repository.limparTracosPagina(art.id, _paginaAtiva.value)
    }

    fun adicionarTracoLivre(pontos: List<PontoTraco>) {
        val art = obterArtigoAtivo()
        val traco = TracoDesenho(
            pagina = _paginaAtiva.value,
            corHex = _corAtiva.value,
            espessura = if (_ferramentaAtiva.value == FerramentaLeitura.MARCADOR) 18f else 3f,
            pontos = pontos,
            ehLinhaReta = false,
            ehMarcaTexto = (_ferramentaAtiva.value == FerramentaLeitura.MARCADOR)
        )
        repository.adicionarTraco(art.id, traco)
    }
}
