// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Cliente de Integração com Zotero Web API v3 e Biblioteca de Leitura.
 * Gerencia coleções sincronizadas, metadados, busca em tempo real, notas filhas e fichamento pessoal.
 */

import { parseBibTeX } from './athenes_bibliografia.js';

const ZOTERO_API_BASE = 'https://api.zotero.org';

export class ZoteroClient {
  constructor(config = {}) {
    this.userId = config.userId ? String(config.userId).trim() : '';
    this.apiKey = config.apiKey ? String(config.apiKey).trim() : '';
    this.username = config.username || '';
    this.isGroup = Boolean(config.isGroup);
    this.colecoesSincronizadas = config.colecoesSincronizadas || [];
    this.cacheItens = new Map();
    this.ultimoSync = null;
  }

  /**
   * Cabeçalhos HTTP padrão para chamadas à API do Zotero
   */
  getHeaders(extra = {}) {
    const headers = {
      'Zotero-API-Version': '3',
      'Accept': 'application/json',
      ...extra
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
   * Se o usuário informou apenas a API Key, descobre automaticamente o userID via endpoint /keys/{key}
   */
  async garantirUserId() {
    if (this.userId) return this.userId;
    if (!this.apiKey) return '';
    const info = await this.testarConexao();
    if (info.ok && info.usuarioId) {
      this.userId = String(info.usuarioId);
      this.username = info.nomeUsuario || '';
      return this.userId;
    }
    return '';
  }

  /**
   * Testa a validade das credenciais e retorna os privilégios da chave (descobrindo o userID automaticamente)
   */
  async testarConexao() {
    if (!this.apiKey) {
      return { ok: false, mensagem: 'Informe a Chave de API (API Key) do Zotero.' };
    }

    try {
      const url = `${ZOTERO_API_BASE}/keys/${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) {
        return { ok: false, status: res.status, mensagem: `Falha na autenticação (${res.status}). Verifique a chave.` };
      }
      const dados = await res.json();
      if (dados.userID) {
        this.userId = String(dados.userID);
      }
      if (dados.username) {
        this.username = dados.username;
      }
      return {
        ok: true,
        usuarioId: dados.userID ? String(dados.userID) : this.userId,
        nomeUsuario: dados.displayName || dados.username || `Usuário #${dados.userID || this.userId}`,
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
    await this.garantirUserId();
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
    await this.garantirUserId();
    if (!this.userId) return [];

    try {
      let endpoint = colecaoKey
        ? `${this.getBaseUrl()}/collections/${encodeURIComponent(colecaoKey)}/items/top`
        : `${this.getBaseUrl()}/items/top`;

      const params = new URLSearchParams({
        limit: String(limite),
        sort: 'dateModified',
        direction: 'desc'
      });

      if (termo) params.set('q', termo);

      let res = await fetch(`${endpoint}?${params.toString()}`, { headers: this.getHeaders() });
      if (!res.ok) {
        // Fallback para /items caso /items/top não esteja disponível em mock/ambiente de teste
        const fallbackEndpoint = colecaoKey
          ? `${this.getBaseUrl()}/collections/${encodeURIComponent(colecaoKey)}/items`
          : `${this.getBaseUrl()}/items`;
        res = await fetch(`${fallbackEndpoint}?${params.toString()}`, { headers: this.getHeaders() });
      }
      if (!res.ok) throw new Error(`Erro ao buscar itens (${res.status})`);

      const dados = await res.json();
      const itensNormalizados = dados
        .filter(d => {
          const t = d?.data?.itemType;
          return t !== 'attachment' && t !== 'note' && t !== 'annotation';
        })
        .map(d => this.normalizarItemZotero(d))
        .filter(Boolean);

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
   * Sincroniza (cria ou atualiza) uma Nota Filha (itemType: 'note') vinculada ao artigo no Zotero
   * contendo o resumo, as citações marcadas no PDF e o link do PDF no Google Drive
   * (sem enviar o arquivo binário do PDF para o armazenamento do Zotero).
   */
  async sincronizarNotaFilhaNoZotero({ parentItemKey, noteKey = null, htmlNota, tags = ['Athenes', 'Fichamento PDF'], artigoMetadados = null } = {}) {
    await this.garantirUserId();
    if (!this.userId || !this.apiKey) {
      return {
        ok: false,
        modo: 'local',
        mensagem: 'Credenciais Zotero não configuradas; fichamento salvo localmente e na nuvem Athenes.'
      };
    }

    try {
      let chavePaiValida = parentItemKey && !String(parentItemKey).startsWith('ZOT') ? parentItemKey : undefined;

      // Se o artigo ainda for apenas local (ex.: chave ZOT8K2M9) e tivermos metadados, cria o item bibliográfico no Zotero primeiro
      if (!chavePaiValida && artigoMetadados && artigoMetadados.titulo) {
        const novoItemPai = {
          itemType: 'journalArticle',
          title: artigoMetadados.titulo,
          abstractNote: artigoMetadados.resumoOriginal || '',
          publicationTitle: artigoMetadados.publicacao || '',
          volume: artigoMetadados.volume || '',
          issue: artigoMetadados.numero || '',
          pages: artigoMetadados.paginas || '',
          date: artigoMetadados.ano || '',
          DOI: artigoMetadados.doi || '',
          creators: (artigoMetadados.autores || []).map(a => ({
            creatorType: 'author',
            firstName: a.prenome || '',
            lastName: a.sobrenome || 'Autor'
          })),
          tags: (artigoMetadados.palavrasChave || []).map(t => ({ tag: String(t) }))
        };
        const resPai = await fetch(`${this.getBaseUrl()}/items`, {
          method: 'POST',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify([novoItemPai])
        });
        if (resPai.ok) {
          const jsonPai = await resPai.json().catch(() => ({}));
          const k = jsonPai?.successful?.['0']?.key;
          if (k) chavePaiValida = k;
        }
      }

      const payloadItem = {
        itemType: 'note',
        parentItem: chavePaiValida || undefined,
        note: String(htmlNota || '<p>Fichamento Athenes</p>'),
        tags: (tags || []).map(t => ({ tag: String(t) }))
      };
      if (noteKey) {
        payloadItem.key = noteKey;
      }

      let res = await fetch(`${this.getBaseUrl()}/items`, {
        method: 'POST',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify([payloadItem])
      });

      // Se parentItem não existir na biblioteca remota, salva como nota independente para nunca perder o fichamento
      if (!res.ok && payloadItem.parentItem) {
        delete payloadItem.parentItem;
        res = await fetch(`${this.getBaseUrl()}/items`, {
          method: 'POST',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify([payloadItem])
        });
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { ok: false, status: res.status, mensagem: `Zotero respondeu ${res.status}: ${txt.slice(0, 120)}` };
      }

      const resultado = await res.json().catch(() => ({}));
      const criadoKey = resultado?.successful?.['0']?.key || noteKey || null;
      return {
        ok: true,
        modo: 'zotero_api',
        parentKey: chavePaiValida || parentItemKey || null,
        noteKey: criadoKey,
        mensagem: 'Fichamento e citações sincronizados diretamente no Zotero!'
      };
    } catch (err) {
      return {
        ok: false,
        modo: 'offline',
        mensagem: `Não foi possível contatar a API do Zotero agora (${err.message}). Dados salvos no Athenes.`
      };
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
