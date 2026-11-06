// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Cliente de Integração com Zotero Web API v3 e Biblioteca de Leitura.
 * Gerencia coleções sincronizadas, metadados, busca em tempo real, notas filhas e fichamento pessoal.
 */

import { parseBibTeX } from './athenes_bibliografia.js';
import { organizarFilhosZotero } from './athenes_zotero_anexos_notas.js';
import { blobEhPdf } from './athenes_pdf_identificadores.js';

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
      const dados = [];
      for (let pg = 0; pg < 20; pg++) { // 100 por vez
        const res = await fetch(`${this.getBaseUrl()}/collections?limit=100&start=${dados.length}`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error(`Erro ao listar coleções (${res.status})`);
        const parte = await res.json();
        if (!Array.isArray(parte) || !parte.length) break;
        dados.push(...parte);
        if (parte.length < 100) break;
      }

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
   * Citação no texto já formatada pelo Zotero (CSL) para um item da biblioteca, ex.: "(Silva, 2020)".
   * Devolve '' quando não há conexão ou o item não existe, para quem chama usar o formato local.
   */
  async obterCitacaoFormatada(chaveItem, estiloCsl = 'apa', { fetchImpl = globalThis.fetch } = {}) {
    if (!chaveItem || !this.apiKey) return '';
    try {
      await this.garantirUserId();
      if (!this.userId) return '';
      const params = new URLSearchParams({ include: 'citation', style: estiloCsl, linkwrap: '0' });
      const res = await fetchImpl(`${this.getBaseUrl()}/items/${encodeURIComponent(chaveItem)}?${params}`, { headers: this.getHeaders() });
      if (!res.ok) return '';
      const dados = await res.json();
      const html = String(dados?.citation || '');
      return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    } catch (_) {
      return '';
    }
  }

  /**
   * Busca itens na biblioteca (com filtro por texto e/ou coleção)
   */
  async buscarItens({ termo = '', colecaoKey = '', limite = 2000 } = {}) {
    await this.garantirUserId();
    if (!this.userId) return [];

    try {
      let endpoint = colecaoKey
        ? `${this.getBaseUrl()}/collections/${encodeURIComponent(colecaoKey)}/items/top`
        : `${this.getBaseUrl()}/items/top`;

      const params = new URLSearchParams({
        limit: String(Math.min(100, limite)), // a API do Zotero entrega no máximo 100 por vez: o resto vem em páginas (start)
        sort: 'dateModified',
        direction: 'desc'
      });

      if (termo) params.set('q', termo);

      let endpointUsado = endpoint;
      let res = await fetch(`${endpoint}?${params.toString()}`, { headers: this.getHeaders() });
      if (!res.ok) {
        // Fallback para /items caso /items/top não esteja disponível em mock/ambiente de teste
        const fallbackEndpoint = colecaoKey
          ? `${this.getBaseUrl()}/collections/${encodeURIComponent(colecaoKey)}/items`
          : `${this.getBaseUrl()}/items`;
        endpointUsado = fallbackEndpoint;
        res = await fetch(`${fallbackEndpoint}?${params.toString()}`, { headers: this.getHeaders() });
      }
      if (!res.ok) throw new Error(`Erro ao buscar itens (${res.status})`);

      const primeira = await res.json();
      let dados = primeira;
      // biblioteca com mais de 100 itens: busca as páginas seguintes até o total (ou o limite pedido)
      if (Array.isArray(primeira)) {
        const total = Number(res.headers?.get?.('Total-Results')) || 0;
        const alvo = Math.min(limite, total || limite);
        const lista = [...primeira];
        let ultima = primeira;
        for (let pg = 0; pg < 60 && lista.length < alvo && ultima.length >= Math.min(100, limite); pg++) {
          const p2 = new URLSearchParams(params); p2.set('start', String(lista.length)); p2.set('limit', String(Math.min(100, alvo - lista.length)));
          const r = await fetch(`${endpointUsado}?${p2.toString()}`, { headers: this.getHeaders() });
          if (!r.ok) break;
          ultima = await r.json();
          if (!Array.isArray(ultima) || !ultima.length) break;
          lista.push(...ultima);
        }
        dados = lista;
      }
      const filtrarENormalizar = (listaBruta) => (Array.isArray(listaBruta) ? listaBruta : [])
        .filter(d => {
          const t = d?.data?.itemType;
          if (t === 'note' || t === 'annotation') return false;
          if (t === 'attachment' && d?.data?.parentItem) return false;
          return true;
        })
        .map(d => this.normalizarItemZotero(d))
        .filter(Boolean);

      let itensNormalizados = filtrarENormalizar(dados);

      // Se /items/top veio vazio, tenta /items (inclui referências e anexos independentes) e grupos do usuário
      if (itensNormalizados.length === 0 && !colecaoKey) {
        try {
          const resAll = await fetch(`${this.getBaseUrl()}/items?${params.toString()}`, { headers: this.getHeaders() });
          if (resAll.ok) {
            const dadosAll = await resAll.json();
            itensNormalizados = filtrarENormalizar(dadosAll);
          }
        } catch (_) {}

        try {
          const resGroups = await fetch(`${ZOTERO_API_BASE}/users/${encodeURIComponent(this.userId)}/groups`, { headers: this.getHeaders() });
          if (resGroups.ok) {
            const grupos = await resGroups.json();
            for (const g of (Array.isArray(grupos) ? grupos.slice(0, 5) : [])) {
              if (!g?.id) continue;
              const resG = await fetch(`${ZOTERO_API_BASE}/groups/${encodeURIComponent(g.id)}/items/top?${params.toString()}`, { headers: this.getHeaders() });
              if (resG.ok) {
                const dadosG = await resG.json();
                itensNormalizados.push(...filtrarENormalizar(dadosG));
              }
            }
          }
        } catch (_) {}
      }

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
   * Lista os itens filhos da biblioteca do usuário (anexos, notas e anotações de PDF do Zotero 7), em páginas de 100,
   * e os organiza por item pai. Não baixa nenhum arquivo. Falha de rede/permissão devolve estruturas vazias.
   */
  async listarFilhos({ fetchImpl = globalThis.fetch } = {}) {
    await this.garantirUserId();
    const vazio = organizarFilhosZotero([]);
    if (!this.userId || !this.apiKey || this.isGroup) return vazio;
    const brutos = [];
    try {
      for (const tipo of ['attachment', 'note', 'annotation']) {
        for (let pg = 0; pg < 100; pg++) {
          const res = await fetchImpl(`${this.getBaseUrl()}/items?${new URLSearchParams({ itemType: tipo, limit: '100', start: String(pg * 100) })}`, { headers: this.getHeaders() });
          if (!res.ok) break; // sem permissão para este tipo: ignora sem erro
          const parte = await res.json();
          if (!Array.isArray(parte) || !parte.length) break;
          brutos.push(...parte);
          if (parte.length < 100) break;
        }
      }
    } catch (err) {
      console.warn('Athenes Zotero — anexos e notas indisponíveis agora:', err);
    }
    return organizarFilhosZotero(brutos);
  }

  /**
   * Baixa o PDF guardado no Zotero (anexo importado). Devolve um Blob; em caso de falha lança Error com `.codigo`:
   * 'sem_arquivo' (404: o arquivo não está no armazenamento do Zotero), 'sem_permissao' (403), 'rede_ou_cors'
   * (o navegador bloqueou o redirecionamento do arquivo ou não há rede) ou 'http'.
   */
  async baixarAnexoPdf(chaveAnexo, { fetchImpl = globalThis.fetch } = {}) {
    await this.garantirUserId();
    const erro = (codigo, msg) => Object.assign(new Error(msg), { codigo });
    if (!this.userId || !this.apiKey) throw erro('sem_permissao', 'Configure a chave de API do Zotero para baixar o PDF.');
    const url = `${this.getBaseUrl()}/items/${encodeURIComponent(chaveAnexo)}/file`;
    let res;
    try {
      res = await fetchImpl(url, { headers: this.getHeaders({ Accept: '*/*' }) });
    } catch (_) {
      try { // sem cabeçalhos personalizados não há pré-verificação (preflight) no armazenamento para onde o Zotero redireciona
        res = await fetchImpl(`${url}?${new URLSearchParams({ key: this.apiKey })}`);
      } catch (e2) {
        throw erro('rede_ou_cors', 'O navegador não conseguiu baixar o arquivo do Zotero (rede ou bloqueio CORS no armazenamento de arquivos).');
      }
    }
    if (res.status === 404) throw erro('sem_arquivo', 'Este PDF não está no armazenamento de arquivos do Zotero (arquivo só no computador ou sem sincronizar).');
    if (res.status === 403) throw erro('sem_permissao', 'A chave do Zotero não tem permissão para baixar arquivos.');
    if (!res.ok) throw erro('http', `O Zotero respondeu ${res.status} ao baixar o PDF.`);
    const blob = await res.blob();
    if (!blob || !blob.size) throw erro('sem_arquivo', 'O Zotero devolveu um arquivo vazio.');
    if (!await blobEhPdf(blob)) throw erro('sem_arquivo', 'O Zotero devolveu conteúdo que não é um PDF.');
    return blob;
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
      // todos os campos do item como estão no Zotero (para o painel "Informações"; o resumo, as tags e as coleções têm campo próprio)
      camposZotero: Object.fromEntries(Object.entries(d).filter(([k, v]) => !['creators', 'tags', 'collections', 'relations', 'abstractNote'].includes(k) && (v === null || typeof v !== 'object'))),
      criadores: (d.creators || []).map(c => ({ creatorType: c.creatorType || 'author', lastName: c.lastName || '', firstName: c.firstName || '', name: c.name || '' })),
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
      isbn: d.ISBN || '',
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
