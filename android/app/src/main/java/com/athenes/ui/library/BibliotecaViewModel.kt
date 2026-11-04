package com.athenes.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.data.DocumentoRepository
import com.athenes.core.data.OrdemDocumentos
import com.athenes.core.data.OrdenacaoDocumentos
import com.athenes.core.data.ZoteroApiClient
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.Documento
import com.athenes.core.model.TipoDocumento
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.async

class BibliotecaViewModel(
    private val repository: DocumentoRepository,
    private val artigoRepository: ArtigoEstudoRepository = ArtigoEstudoRepository.compartilhado,
    private val zoteroClient: ZoteroApiClient = ZoteroApiClient()
) : ViewModel() {

    // Tab 1: Escrita & Documentos
    private val _textoBusca = MutableStateFlow("")
    val textoBusca: StateFlow<String> = _textoBusca.asStateFlow()

    private val _tipoFiltro = MutableStateFlow<TipoDocumento?>(null)
    val tipoFiltro: StateFlow<TipoDocumento?> = _tipoFiltro.asStateFlow()
    private val _ordemDocumentos = MutableStateFlow(OrdemDocumentos.RECENTES)
    val ordemDocumentos: StateFlow<OrdemDocumentos> = _ordemDocumentos.asStateFlow()

    val documentosFiltrados: StateFlow<List<Documento>> = combine(
        repository.documentos,
        _textoBusca,
        _tipoFiltro,
        _ordemDocumentos
    ) { lista, busca, filtroTipo, ordem ->
        OrdenacaoDocumentos.ordenar(lista.filter { doc ->
            val bateBusca = busca.isBlank() ||
                    doc.titulo.contains(busca, ignoreCase = true) ||
                    doc.subtitulo.contains(busca, ignoreCase = true) ||
                    doc.autor.contains(busca, ignoreCase = true)

            val bateTipo = filtroTipo == null || doc.tipo == filtroTipo

            bateBusca && bateTipo
        }, ordem)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = repository.documentos.value
    )

    // Tab 2: Leitura de Artigos, PDF & Zotero
    private val _textoBuscaArtigos = MutableStateFlow("")
    val textoBuscaArtigos: StateFlow<String> = _textoBuscaArtigos.asStateFlow()

    val artigos: StateFlow<List<ArtigoEstudoDetalhado>> = artigoRepository.artigos
    val colecoesZotero = artigoRepository.colecoesZotero
    private val _estadoZotero = MutableStateFlow("")
    val estadoZotero: StateFlow<String> = _estadoZotero.asStateFlow()
    private val _sincronizandoZotero = MutableStateFlow(false)
    val sincronizandoZotero: StateFlow<Boolean> = _sincronizandoZotero.asStateFlow()
    private val _conectadoZotero = MutableStateFlow(artigoRepository.artigos.value.any { it.chaveZotero.isNotBlank() && !it.id.startsWith("local_") })
    val conectadoZotero: StateFlow<Boolean> = _conectadoZotero.asStateFlow()
    private val _tipoZoteroFiltro = MutableStateFlow<String?>(null)
    val tipoZoteroFiltro = _tipoZoteroFiltro.asStateFlow()
    private val _colecaoZoteroFiltro = MutableStateFlow<String?>(null)
    val colecaoZoteroFiltro = _colecaoZoteroFiltro.asStateFlow()
    private val _anoMinimo = MutableStateFlow<Int?>(null)
    val anoMinimo = _anoMinimo.asStateFlow()
    private val _ordemZotero = MutableStateFlow("recentes")
    val ordemZotero = _ordemZotero.asStateFlow()

    fun filtrarTipoZotero(tipo: String?) { _tipoZoteroFiltro.value = tipo }
    fun filtrarColecaoZotero(colecao: String?) { _colecaoZoteroFiltro.value = colecao }
    fun filtrarAnoMinimo(ano: Int?) { _anoMinimo.value = ano }
    fun ordenarZotero(ordem: String) { _ordemZotero.value = ordem }

    fun sincronizarZotero(chave: String, usuarioId: String) {
        if (chave.isBlank() || _sincronizandoZotero.value) return
        viewModelScope.launch {
            _sincronizandoZotero.value = true
            _estadoZotero.value = "Buscando biblioteca do Zotero…"
            try {
                val id = usuarioId.trim().ifBlank { zoteroClient.descobrirUsuario(chave.trim()) }
                val itens = async { zoteroClient.listarItens(id, chave.trim()) }
                val colecoes = async { zoteroClient.listarColecoes(id, chave.trim()) }
                val lista = itens.await()
                if (lista.isEmpty()) {
                    colecoes.cancel()
                    _estadoZotero.value = "Nenhum item encontrado no Zotero."
                } else {
                    artigoRepository.aplicarBibliotecaZotero(lista, colecoes.await())
                    _conectadoZotero.value = true
                    _estadoZotero.value = "${lista.size} itens carregados do Zotero."
                }
            } catch (erro: Exception) {
                val detalhe = erro.message?.takeIf { it.startsWith("Zotero respondeu ") }
                _estadoZotero.value = detalhe ?: "Falha ao sincronizar. Verifique a chave e a conexão."
            } finally {
                _sincronizandoZotero.value = false
            }
        }
    }
    val pastas = repository.pastas
    val lixeira = repository.lixeira

    fun restaurarDocumento(id: String) = repository.restaurarDocumento(id)
    fun excluirDefinitivamente(id: String) = repository.excluirDefinitivamente(id)
    fun importarDocumentoJson(conteudo: String) = repository.importarDocumentoJson(conteudo)
    fun importarBib(conteudo: String) = artigoRepository.importarBib(conteudo)
    fun criarArtigoLocal(titulo: String, autores: String, ano: Int, publicacao: String, resumo: String) =
        artigoRepository.adicionarArtigoLocal(titulo, autores, ano, publicacao, resumo)

    fun criarPasta(nome: String, pastaPaiId: String? = null) = repository.criarPasta(nome, pastaPaiId)
    fun moverDocumento(id: String, pastaId: String?) = repository.moverDocumento(id, pastaId)
    fun renomearPasta(id: String, nome: String) = repository.renomearPasta(id, nome)
    fun excluirPasta(id: String) = repository.excluirPasta(id)

    private val artigosFiltradosBase = combine(
        artigoRepository.artigos,
        _textoBuscaArtigos
    ) { lista, busca ->
        lista.filter {
            busca.isBlank() ||
            it.titulo.contains(busca, ignoreCase = true) ||
                    it.autores.contains(busca, ignoreCase = true) ||
                    it.chaveZotero.contains(busca, ignoreCase = true)
        }
    }

    val artigosFiltrados: StateFlow<List<ArtigoEstudoDetalhado>> = combine(
        artigosFiltradosBase, _tipoZoteroFiltro, _colecaoZoteroFiltro, _anoMinimo, _ordemZotero
    ) { lista, tipo, colecao, ano, ordem ->
        val filtrados = lista.filter { artigo ->
            (tipo == null || when (tipo) {
                "fichados" -> artigo.notas.isNotEmpty() || artigo.citacoes.isNotEmpty() || artigo.meuResumo.isNotBlank()
                else -> artigo.tipoZotero == tipo
            }) && (colecao == null || colecao in artigo.colecoesZotero) && (ano == null || artigo.ano >= ano)
        }
        if (ordem == "titulo") filtrados.sortedBy { it.titulo.lowercase() }
        else filtrados.sortedWith(compareByDescending<ArtigoEstudoDetalhado> { it.ano }.thenBy { it.titulo })
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = artigoRepository.artigos.value
    )

    // Estados de Diálogos
    private val _dialogNovoAberto = MutableStateFlow(false)
    val dialogNovoAberto: StateFlow<Boolean> = _dialogNovoAberto.asStateFlow()

    private val _docParaExcluir = MutableStateFlow<Documento?>(null)
    val docParaExcluir: StateFlow<Documento?> = _docParaExcluir.asStateFlow()

    private val _docParaRenomear = MutableStateFlow<Documento?>(null)
    val docParaRenomear: StateFlow<Documento?> = _docParaRenomear.asStateFlow()

    fun setTextoBusca(query: String) {
        _textoBusca.value = query
    }

    fun setTipoFiltro(tipo: TipoDocumento?) {
        _tipoFiltro.value = tipo
    }

    fun setOrdemDocumentos(ordem: OrdemDocumentos) { _ordemDocumentos.value = ordem }

    fun setTextoBuscaArtigos(query: String) {
        _textoBuscaArtigos.value = query
    }

    fun abrirDialogNovo() {
        _dialogNovoAberto.value = true
    }

    fun fecharDialogNovo() {
        _dialogNovoAberto.value = false
    }

    fun criarNovoDocumento(titulo: String, subtitulo: String, tipo: TipoDocumento, autor: String): Documento {
        val novo = repository.adicionarDocumento(
            titulo = titulo,
            subtitulo = subtitulo,
            tipo = tipo,
            autor = autor
        )
        fecharDialogNovo()
        return novo
    }

    fun duplicarDocumento(id: String) {
        repository.duplicarDocumento(id)
    }

    fun solicitarExclusao(doc: Documento) {
        _docParaExcluir.value = doc
    }

    fun fecharDialogExclusao() {
        _docParaExcluir.value = null
    }

    fun confirmarExclusao() {
        _docParaExcluir.value?.let { repository.excluirDocumento(it.id) }
        fecharDialogExclusao()
    }

    fun solicitarRenomear(doc: Documento) {
        _docParaRenomear.value = doc
    }

    fun fecharDialogRenomear() {
        _docParaRenomear.value = null
    }

    fun confirmarRenomear(novoTitulo: String) {
        _docParaRenomear.value?.let { repository.renomearDocumento(it.id, novoTitulo) }
        fecharDialogRenomear()
    }
}
