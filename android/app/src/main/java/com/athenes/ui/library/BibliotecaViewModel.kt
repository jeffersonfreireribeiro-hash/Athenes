package com.athenes.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athenes.core.data.ArtigoEstudoRepository
import com.athenes.core.data.DocumentoRepository
import com.athenes.core.model.ArtigoEstudoDetalhado
import com.athenes.core.model.Documento
import com.athenes.core.model.TipoDocumento
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

class BibliotecaViewModel(
    private val repository: DocumentoRepository,
    private val artigoRepository: ArtigoEstudoRepository = ArtigoEstudoRepository.compartilhado
) : ViewModel() {

    // Tab 1: Escrita & Documentos
    private val _textoBusca = MutableStateFlow("")
    val textoBusca: StateFlow<String> = _textoBusca.asStateFlow()

    private val _tipoFiltro = MutableStateFlow<TipoDocumento?>(null)
    val tipoFiltro: StateFlow<TipoDocumento?> = _tipoFiltro.asStateFlow()

    val documentosFiltrados: StateFlow<List<Documento>> = combine(
        repository.documentos,
        _textoBusca,
        _tipoFiltro
    ) { lista, busca, filtroTipo ->
        lista.filter { doc ->
            val bateBusca = busca.isBlank() ||
                    doc.titulo.contains(busca, ignoreCase = true) ||
                    doc.subtitulo.contains(busca, ignoreCase = true) ||
                    doc.autor.contains(busca, ignoreCase = true)

            val bateTipo = filtroTipo == null || doc.tipo == filtroTipo

            bateBusca && bateTipo
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = repository.documentos.value
    )

    // Tab 2: Leitura de Artigos, PDF & Zotero
    private val _textoBuscaArtigos = MutableStateFlow("")
    val textoBuscaArtigos: StateFlow<String> = _textoBuscaArtigos.asStateFlow()

    val artigos: StateFlow<List<ArtigoEstudoDetalhado>> = artigoRepository.artigos
    val pastas = repository.pastas

    fun criarPasta(nome: String, pastaPaiId: String? = null) = repository.criarPasta(nome, pastaPaiId)
    fun moverDocumento(id: String, pastaId: String?) = repository.moverDocumento(id, pastaId)
    fun renomearPasta(id: String, nome: String) = repository.renomearPasta(id, nome)
    fun excluirPasta(id: String) = repository.excluirPasta(id)

    val artigosFiltrados: StateFlow<List<ArtigoEstudoDetalhado>> = combine(
        artigoRepository.artigos,
        _textoBuscaArtigos
    ) { lista, busca ->
        if (busca.isBlank()) lista
        else lista.filter {
            it.titulo.contains(busca, ignoreCase = true) ||
                    it.autores.contains(busca, ignoreCase = true) ||
                    it.chaveZotero.contains(busca, ignoreCase = true)
        }
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
