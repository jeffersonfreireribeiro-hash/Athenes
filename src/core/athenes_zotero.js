// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Cliente de Integração com Zotero Web API v3 e Biblioteca de Leitura.
 * Gerencia coleções sincronizadas, metadados, busca em tempo real e fichamento pessoal.
 */

import { parseBibTeX } from './athenes_bibliografia.js';

const ZOTERO_API_BASE = 'https://api.zotero.org';

export class ZoteroClient {
  constructor(config = {}) {
    this.userId = config.userId || '';
    this.apiKey = config.apiKey || '';
    this.isGroup = Boolean(config.isGroup);
    this.colecoesSincronizadas = config.colecoesSincronizadas || [];
    this.cacheItens = new Map();
    this.ultimoSync = null;
  }

  /**
   * Cabeçalhos HTTP padrão para chamadas à API do Zotero
   */
  getHeaders() {
    const headers = {
      'Zotero-API-Version': '3',
      'Accept': 'application/json'
    };
    if (this.apiKey) {
      headers['Zotero-API-Key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * URL base do usuário ou grupo
   */
  getBaseUrl() {
    const tipo = this.isGroup ? 'groups' : 'users';
    return `${ZOTERO_API_BASE}/${tipo}/${encodeURIComponent(this.userId)}`;
  }

  /**
   * Testa a validade das credenciais e retorna os privilégios da chave
   */
  async testarConexao() {
    if (!this.userId || !this.apiKey) {
      return { ok: false, mensagem: 'Informe o ID de usuário e a Chave de API do Zotero.' };
    }

    try {
      const url = `${ZOTERO_API_BASE}/keys/${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) {
        return { ok: false, status: res.status, mensagem: `Falha na autenticação (${res.status}). Verifique a chave.` };
      }
      const dados = await res.json();
      return {
        ok: true,
        usuarioId: dados.userID,
        nomeUsuario: dados.username || `Usuário #${dados.userID}`,
        acesso: dados.access || {}
      };
    } catch (err) {
      return { ok: false, mensagem: `Erro de rede ao conectar com Zotero: ${err.message}` };
    }
  }

  /**
   * Lista as coleções (pastas) disponíveis na biblioteca
   */
  async listarColecoes() {
    if (!this.userId) return [];

    try {
      const url = `${this.getBaseUrl()}/collections?limit=100`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) throw new Error(`Erro ao listar coleções (${res.status})`);
      const dados = await res.json();

      return dados.map(item => ({
        key: item.key,
        nome: item.data?.name || 'Coleção sem nome',
        parentCollection: item.data?.parentCollection || false,
        totalItens: item.meta?.numItems || 0
      }));
    } catch (err) {
      console.warn('Athenes Zotero — aviso ao listar coleções:', err);
      return [];
    }
  }

  /**
   * Busca itens na biblioteca (com filtro por texto e/ou coleção)
   */
  async buscarItens({ termo = '', colecaoKey = '', limite = 50 } = {}) {
    if (!this.userId) return [];

    try {
      let endpoint = colecaoKey
        ? `${this.getBaseUrl()}/collections/${encodeURIComponent(colecaoKey)}/items`
        : `${this.getBaseUrl()}/items`;

      const params = new URLSearchParams({
        limit: String(limite),
        sort: 'dateModified',
        direction: 'desc',
        itemType: '-attachment || -note' // exclui notas soltas e anexos brutos
      });

      if (termo) params.set('q', termo);

      const res = await fetch(`${endpoint}?${params.toString()}`, { headers: this.getHeaders() });
      if (!res.ok) throw new Error(`Erro ao buscar itens (${res.status})`);

      const dados = await res.json();
      const itensNormalizados = dados.map(d => this.normalizarItemZotero(d)).filter(Boolean);

      // Atualiza o cache local
      for (const item of itensNormalizados) {
        this.cacheItens.set(item.id, item);
      }
      this.ultimoSync = new Date();

      return itensNormalizados;
    } catch (err) {
      console.warn('Athenes Zotero — busca com falha ou offline:', err);
      return Array.from(this.cacheItens.values());
    }
  }

  /**
   * Normaliza um item retornado da Zotero API para o esquema unificado do Athenes
   */
  normalizarItemZotero(itemApi) {
    if (!itemApi || !itemApi.data) return null;
    const d = itemApi.data;

    const autores = (d.creators || []).map(c => {
      if (c.name) {
        const p = c.name.split(',').map(s => s.trim());
        return p.length >= 2 ? { sobrenome: p[0], prenome: p[1] } : { sobrenome: c.name, prenome: '' };
      }
      return { sobrenome: c.lastName || '', prenome: c.firstName || '' };
    });

    let tipo = 'artigo_periodico';
    if (d.itemType === 'book') tipo = 'livro';
    else if (d.itemType === 'bookSection') tipo = 'capitulo_livro';
    else if (d.itemType === 'conferencePaper') tipo = 'trabalho_conferencia';
    else if (d.itemType === 'thesis') tipo = 'tese_dissertacao';
    else if (d.itemType === 'report') tipo = 'relatorio_tecnico';
    else if (d.itemType === 'webpage') tipo = 'website';

    const chave = itemApi.key || d.key || '';
    const ano = (d.date || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';

    return {
      id: chave,
      chave,
      tipo,
      itemTypeZotero: d.itemType,
      titulo: d.title || 'Sem título',
      autores: autores.length ? autores : [{ sobrenome: 'ANÔNIMO', prenome: '' }],
      ano,
      publicacao: d.publicationTitle || d.proceedingsTitle || d.bookTitle || '',
      editora: d.publisher || '',
      local: d.place || '',
      volume: d.volume || '',
      numero: d.issue || '',
      paginas: d.pages || '',
      doi: d.DOI || '',
      url: d.url || '',
      resumo: d.abstractNote || '',
      palavrasChave: (d.tags || []).map(t => t.tag).filter(Boolean),
      colecoes: d.collections || [],
      versaoZotero: itemApi.version
    };
  }

  /**
   * Importa entradas a partir de texto BibTeX offline
   */
  importarBibTeX(conteudoBib) {
    const itens = parseBibTeX(conteudoBib);
    for (const item of itens) {
      this.cacheItens.set(item.id, item);
    }
    return itens;
  }
}
