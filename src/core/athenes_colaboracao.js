// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Motor de Nuvem (Supabase), Colaboração Síncrona (Realtime + Presença/Cursores),
 * Modos de Trabalho estilo Google Docs (Edição, Sugestão e Visualização) e Google Drive API.
 */

export const SUPABASE_CONFIG_PADRAO = Object.freeze({
  url: 'https://xizxdtaxgvouopkqdbie.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpenhkdGF4Z3ZvdW9wa3FkYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjEyNjMsImV4cCI6MjEwOTEzNzI2M30.QRzjuLjDWiRHVI0cZsDXUc2E-RgVxeJTqRc4Ji38_Cg',
  publishableKey: 'sb_publishable_VyN5VEAI9JAeOGmOxe5iPg_Ah4HdQRh',
  tabela: 'documentos_athenes'
});

export const MODOS_TRABALHO = Object.freeze({
  EDICAO: 'edicao',         // Edita diretamente o documento
  SUGESTAO: 'sugestao',     // Registra adições em verde e exclusões tachadas em vermelho com Aceitar/Rejeitar
  VISUALIZACAO: 'leitura'   // Somente leitura (readonly)
});

export const CORES_COLABORADORES = Object.freeze([
  '#314F79', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'
]);

/**
 * Obtém ou inicializa o perfil local do usuário/revisor (ex: Autor ou Prof. Orientador).
 */
export function obterPerfilColaborador() {
  try {
    if (typeof localStorage !== 'undefined') {
      const salvo = localStorage.getItem('athenes_perfil_colaborador');
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (parsed && parsed.nome) return parsed;
      }
    }
  } catch (_) {}

  const corSorteada = CORES_COLABORADORES[Math.floor(Math.random() * CORES_COLABORADORES.length)];
  const padrao = {
    id: 'usr_' + Math.random().toString(36).slice(2, 10),
    nome: 'Autor Principal',
    papel: 'autor', // 'autor' | 'orientador' | 'revisor'
    cor: corSorteada
  };

  salvarPerfilColaborador(padrao);
  return padrao;
}

export function salvarPerfilColaborador(perfil) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('athenes_perfil_colaborador', JSON.stringify(perfil));
    }
  } catch (_) {}
  return perfil;
}

/* ==========================================================================
   PASSO 2: MOTOR DE SUGESTÕES E REVISÃO (ESTILO GOOGLE DOCS)
   ========================================================================== */

/**
 * Garante que o documento possua a estrutura de sugestões.
 */
export function garantirEstruturaSugestoes(doc) {
  if (!doc) return [];
  if (!Array.isArray(doc.sugestoes)) {
    doc.sugestoes = [];
  }
  return doc.sugestoes;
}

/**
 * Cria um registro de sugestão (inserção ou exclusão) no documento e retorna o objeto criado.
 */
export function registrarSugestao(doc, {
  blocoId,
  tipo = 'insercao', // 'insercao' | 'exclusao' | 'substituicao'
  textoOriginal = '',
  textoNovo = '',
  autor = 'Prof. Revisor',
  corAutor = '#10B981',
  comentario = ''
} = {}) {
  const lista = garantirEstruturaSugestoes(doc);
  const id = 'sug_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const item = {
    id,
    blocoId: blocoId || null,
    tipo,
    textoOriginal: String(textoOriginal || ''),
    textoNovo: String(textoNovo || ''),
    autor: String(autor || 'Revisor'),
    corAutor: corAutor || '#10B981',
    comentario: String(comentario || ''),
    status: 'pendente', // 'pendente' | 'aceita' | 'rejeitada'
    criadoEm: new Date().toISOString()
  };
  lista.push(item);
  return item;
}

/**
 * Gera a marcação HTML inline para exibir uma sugestão dentro do bloco de texto:
 * - Inserção: sublinhado em verde (<ins class="ath-sug-ins">)
 * - Exclusão: tachado em vermelho (<del class="ath-sug-del">)
 */
export function gerarHtmlMarcacaoSugestao(sugestao) {
  if (!sugestao) return '';
  const id = sugestao.id;
  const autor = escaparAtributo(sugestao.autor || 'Revisor');
  const Partes = [];

  if (sugestao.textoOriginal) {
    Partes.push(
      `<del class="ath-sug-mark ath-sug-del" data-sugestao-id="${id}" data-autor="${autor}" title="Exclusão sugerida por ${autor}">${sugestao.textoOriginal}</del>`
    );
  }
  if (sugestao.textoNovo) {
    Partes.push(
      `<ins class="ath-sug-mark ath-sug-ins" data-sugestao-id="${id}" data-autor="${autor}" title="Adição sugerida por ${autor}">${sugestao.textoNovo}</ins>`
    );
  }
  return Partes.join(' ');
}

function escaparAtributo(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Aceita uma sugestão:
 * - Mantém o conteúdo de `<ins data-sugestao-id="...">` (removendo apenas a tag de marcação)
 * - Remove definitivamente o conteúdo de `<del data-sugestao-id="...">`
 */
export function aceitarSugestaoNoDocumento(doc, sugestaoId) {
  const lista = garantirEstruturaSugestoes(doc);
  const sug = lista.find(s => s.id === sugestaoId);
  if (!sug) return false;

  sug.status = 'aceita';
  sug.resolvidoEm = new Date().toISOString();

  // Atualiza o HTML nos blocos do documento
  percorrerBlocosDeTexto(doc, (bloco) => {
    if (!bloco.texto || !bloco.texto.includes(sugestaoId)) return;
    bloco.texto = processarResolucaoHtmlSugestao(bloco.texto, sugestaoId, 'aceitar');
  });

  // Remove da lista de pendentes
  doc.sugestoes = lista.filter(s => s.id !== sugestaoId);
  return true;
}

/**
 * Rejeita uma sugestão:
 * - Remove o conteúdo adicionado em `<ins data-sugestao-id="...">`
 * - Restaura o texto original de `<del data-sugestao-id="...">` (removendo a tag `<del>`)
 */
export function rejeitarSugestaoNoDocumento(doc, sugestaoId) {
  const lista = garantirEstruturaSugestoes(doc);
  const sug = lista.find(s => s.id === sugestaoId);
  if (!sug) return false;

  sug.status = 'rejeitada';
  sug.resolvidoEm = new Date().toISOString();

  percorrerBlocosDeTexto(doc, (bloco) => {
    if (!bloco.texto || !bloco.texto.includes(sugestaoId)) return;
    bloco.texto = processarResolucaoHtmlSugestao(bloco.texto, sugestaoId, 'rejeitar');
  });

  doc.sugestoes = lista.filter(s => s.id !== sugestaoId);
  return true;
}

/**
 * Processa o HTML de um bloco resolvendo as tags `<ins>` e `<del>` de uma sugestão específica.
 * Funciona tanto no navegador quanto em ambiente Node.js puro (testes).
 */
export function processarResolucaoHtmlSugestao(html, sugestaoId, acao = 'aceitar') {
  if (!html || !sugestaoId) return html;

  const escId = sugestaoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regIns = new RegExp(`<ins[^>]*data-sugestao-id=["']${escId}["'][^>]*>([\\s\\S]*?)<\\/ins>`, 'gi');
  const regDel = new RegExp(`<del[^>]*data-sugestao-id=["']${escId}["'][^>]*>([\\s\\S]*?)<\\/del>`, 'gi');

  let resultado = String(html);
  if (acao === 'aceitar') {
    // Aceitar: mantém o texto inserido (<ins>texto</ins> -> texto) e apaga o texto deletado (<del>...</del> -> '')
    resultado = resultado.replace(regIns, '$1');
    resultado = resultado.replace(regDel, '');
  } else {
    // Rejeitar: remove o texto inserido (<ins>...</ins> -> '') e restaura o texto deletado (<del>texto</del> -> texto)
    resultado = resultado.replace(regIns, '');
    resultado = resultado.replace(regDel, '$1');
  }
  return resultado;
}

function percorrerBlocosDeTexto(doc, callback) {
  if (!doc || !Array.isArray(doc.secoes)) return;
  for (const sec of doc.secoes) {
    for (const b of sec.blocos || []) {
      callback(b);
    }
  }
}

/* ==========================================================================
   PASSO 1: PERSISTÊNCIA NA NUVEM COM SUPABASE REST API
   ========================================================================== */

export function obterConfigSupabase() {
  try {
    if (typeof localStorage !== 'undefined') {
      const custom = localStorage.getItem('athenes_supabase_config');
      if (custom) {
        const parsed = JSON.parse(custom);
        if (parsed.url && parsed.anonKey) return { ...SUPABASE_CONFIG_PADRAO, ...parsed };
      }
    }
  } catch (_) {}
  return SUPABASE_CONFIG_PADRAO;
}

/**
 * Salva (Upsert) o documento completo na tabela `documentos_athenes` do projeto Supabase.
 */
export async function salvarDocumentoNoSupabase(doc, perfil = null, fetchImpl = globalThis.fetch) {
  if (!doc || !doc.id) throw new Error('Documento inválido para salvamento na nuvem.');
  if (typeof fetchImpl !== 'function') throw new Error('API fetch indisponível neste ambiente.');

  const cfg = obterConfigSupabase();
  const colab = perfil || obterPerfilColaborador();
  const agora = new Date().toISOString();
  doc.dataModificacao = agora;

  const payload = {
    id: String(doc.id),
    titulo: String(doc.titulo || 'Documento sem título'),
    autor: String(doc.autor || colab.nome || ''),
    norma: String(doc.norma || 'abnt'),
    conteudo_json: doc,
    sugestoes_json: garantirEstruturaSugestoes(doc),
    atualizado_em: agora,
    atualizado_por: colab.nome || 'Autor'
  };

  const endpoint = `${cfg.url}/rest/v1/${cfg.tabela}?on_conflict=id`;
  const resp = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': cfg.anonKey,
      'Authorization': `Bearer ${cfg.anonKey}`,
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const erroTxt = await resp.text().catch(() => '');
    throw new Error(`Falha ao salvar no Supabase (${resp.status}): ${erroTxt}`);
  }

  const dados = await resp.json().catch(() => [payload]);
  return Array.isArray(dados) ? dados[0] : dados;
}

/**
 * Lista os documentos salvos na nuvem Supabase.
 */
export async function listarDocumentosDoSupabase(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return [];
  const cfg = obterConfigSupabase();
  const endpoint = `${cfg.url}/rest/v1/${cfg.tabela}?select=id,titulo,autor,norma,atualizado_em,atualizado_por&order=atualizado_em.desc&limit=50`;

  const resp = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      'apikey': cfg.anonKey,
      'Authorization': `Bearer ${cfg.anonKey}`
    }
  });

  if (!resp.ok) {
    throw new Error(`Falha ao listar documentos do Supabase (${resp.status}).`);
  }
  return await resp.json();
}

/**
 * Carrega um documento completo pelo ID diretamente do Supabase.
 */
export async function carregarDocumentoDoSupabase(docId, fetchImpl = globalThis.fetch) {
  if (!docId || typeof fetchImpl !== 'function') return null;
  const cfg = obterConfigSupabase();
  const endpoint = `${cfg.url}/rest/v1/${cfg.tabela}?id=eq.${encodeURIComponent(docId)}&select=*&limit=1`;

  const resp = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      'apikey': cfg.anonKey,
      'Authorization': `Bearer ${cfg.anonKey}`
    }
  });

  if (!resp.ok) {
    throw new Error(`Falha ao abrir documento do Supabase (${resp.status}).`);
  }
  const rows = await resp.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0];
  const doc = row.conteudo_json || {};
  if (Array.isArray(row.sugestoes_json) && (!doc.sugestoes || doc.sugestoes.length === 0)) {
    doc.sugestoes = row.sugestoes_json;
  }
  return doc;
}

/* ==========================================================================
   PASSO 3: COLABORAÇÃO EM TEMPO REAL (SUPABASE REALTIME + BROADCASTCHANNEL)
   ========================================================================== */

/**
 * Gerenciador de sessão colaborativa em tempo real:
 * - Sincroniza presença (avatares online no topo), posição de cursor por bloco e alterações de texto/sugestões.
 * - Opera simultaneamente via BroadcastChannel (instantâneo entre abas locais) e Supabase Realtime WebSocket / Polling.
 */
export class SessaoColaborativaRealtime {
  constructor(doc, opcoes = {}) {
    this.doc = doc;
    this.opcoes = opcoes;
    this.perfil = opcoes.perfil || obterPerfilColaborador();
    this.presencaMap = new Map(); // id -> { id, nome, papel, cor, blocoId, vistoEm }
    this.bc = null;
    this.supabaseClient = null;
    this.supabaseChannel = null;
    this.timerHeartbeat = null;
    this.conectadoNuvem = false;

    // Registra o próprio usuário na presença
    this.atualizarPresencaLocal();
  }

  atualizarPresencaLocal(blocoId = null) {
    this.presencaMap.set(this.perfil.id, {
      ...this.perfil,
      blocoId: blocoId ?? this.blocoFocadoId ?? null,
      vistoEm: Date.now(),
      local: true
    });
  }

  iniciar() {
    if (!this.doc?.id) return;
    const canalNome = `athenes_doc_${this.doc.id}`;

    // 1. Canal local instantâneo (BroadcastChannel) para múltiplas janelas no mesmo navegador
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bc = new BroadcastChannel(canalNome);
        this.bc.onmessage = (ev) => this.processarMensagemRemota(ev.data);
      } catch (_) {}
    }

    // 2. Canal Supabase Realtime (se executado no navegador)
    this.iniciarSupabaseRealtime(canalNome);

    // 3. Anuncia entrada e mantém heartbeat de presença
    this.enviarEvento('presenca', { blocoId: null });
    this.timerHeartbeat = setInterval(() => {
      this.limparPresencasExpiradas();
      this.enviarEvento('presenca', { blocoId: this.blocoFocadoId || null });
    }, 8000);
  }

  async iniciarSupabaseRealtime(canalNome) {
    if (typeof window === 'undefined') return;
    try {
      const cfg = obterConfigSupabase();
      // Carrega o SDK ESM do Supabase de forma assíncrona se ainda não estiver carregado
      if (!window.__athenesSupabaseCreateClient) {
        const mod = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
        window.__athenesSupabaseCreateClient = mod.createClient;
      }
      if (window.__athenesSupabaseCreateClient) {
        this.supabaseClient = window.__athenesSupabaseCreateClient(cfg.url, cfg.anonKey, {
          realtime: { params: { eventsPerSecond: 10 } }
        });
        this.supabaseChannel = this.supabaseClient.channel(canalNome, {
          config: { broadcast: { self: false }, presence: { key: this.perfil.id } }
        });

        this.supabaseChannel
          .on('broadcast', { event: 'athenes_sync' }, ({ payload }) => {
            this.processarMensagemRemota(payload);
          })
          .on('presence', { event: 'sync' }, () => {
            const state = this.supabaseChannel.presenceState();
            for (const key of Object.keys(state)) {
              const presList = state[key];
              if (Array.isArray(presList) && presList[0]) {
                const p = presList[0];
                if (p.id && p.id !== this.perfil.id) {
                  this.presencaMap.set(p.id, { ...p, vistoEm: Date.now(), local: false });
                }
              }
            }
            this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              this.conectadoNuvem = true;
              await this.supabaseChannel.track({
                id: this.perfil.id,
                nome: this.perfil.nome,
                papel: this.perfil.papel,
                cor: this.perfil.cor,
                blocoId: this.blocoFocadoId || null
              });
              this.opcoes.onStatusConexao?.(true);
            }
          });
      }
    } catch (_) {
      // Fallback silencioso para modo local / REST caso offline
      this.conectadoNuvem = false;
    }
  }

  enviarEvento(tipo, dados = {}) {
    const pacote = {
      tipo,
      remetente: this.perfil,
      docId: this.doc?.id,
      timestamp: Date.now(),
      ...dados
    };

    if (this.bc) {
      try { this.bc.postMessage(pacote); } catch (_) {}
    }

    if (this.supabaseChannel && this.conectadoNuvem) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'athenes_sync',
          payload: pacote
        });
      } catch (_) {}
    }
  }

  informarCursorBloco(blocoId) {
    this.blocoFocadoId = blocoId;
    this.atualizarPresencaLocal(blocoId);
    this.enviarEvento('cursor', { blocoId });
    if (this.supabaseChannel && this.conectadoNuvem) {
      try {
        this.supabaseChannel.track({
          id: this.perfil.id,
          nome: this.perfil.nome,
          papel: this.perfil.papel,
          cor: this.perfil.cor,
          blocoId
        });
      } catch (_) {}
    }
    this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
  }

  transmitirAtualizacaoBloco(bloco) {
    if (!bloco) return;
    this.enviarEvento('bloco_editado', {
      blocoId: bloco.id,
      blocoSnapshot: JSON.parse(JSON.stringify(bloco)),
      sugestoes: garantirEstruturaSugestoes(this.doc)
    });
  }

  transmitirDocumento(doc) {
    this.doc = doc;
    this.enviarEvento('doc_sincronizado', {
      docSnapshot: JSON.parse(JSON.stringify(doc))
    });
  }

  processarMensagemRemota(msg) {
    if (!msg || !msg.remetente || msg.remetente.id === this.perfil.id) return;

    // Atualiza presença do colaborador remoto
    this.presencaMap.set(msg.remetente.id, {
      ...msg.remetente,
      blocoId: msg.blocoId ?? this.presencaMap.get(msg.remetente.id)?.blocoId ?? null,
      vistoEm: Date.now(),
      local: false
    });

    if (msg.tipo === 'presenca' || msg.tipo === 'cursor') {
      this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
      this.opcoes.onCursorRemoto?.(msg.remetente, msg.blocoId);
      return;
    }

    if (msg.tipo === 'bloco_editado' && msg.blocoSnapshot) {
      this.opcoes.onBlocoRemotoAlterado?.(msg.blocoSnapshot, msg.sugestoes, msg.remetente);
      this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
      return;
    }

    if (msg.tipo === 'doc_sincronizado' && msg.docSnapshot) {
      this.opcoes.onDocumentoRemotoAlterado?.(msg.docSnapshot, msg.remetente);
      this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
    }
  }

  limparPresencasExpiradas() {
    const agora = Date.now();
    let mudou = false;
    for (const [id, info] of this.presencaMap.entries()) {
      if (!info.local && agora - info.vistoEm > 25000) {
        this.presencaMap.delete(id);
        mudou = true;
      }
    }
    if (mudou) {
      this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
    }
  }

  obterColaboradoresAtivos() {
    return Array.from(this.presencaMap.values());
  }

  encerrar() {
    if (this.timerHeartbeat) clearInterval(this.timerHeartbeat);
    if (this.bc) {
      try { this.bc.close(); } catch (_) {}
    }
    if (this.supabaseChannel && this.supabaseClient) {
      try { this.supabaseClient.removeChannel(this.supabaseChannel); } catch (_) {}
    }
  }
}

/* ==========================================================================
   PASSO 4: INTEGRAÇÃO COM GOOGLE DRIVE (ESCOPO SEGURO drive.file)
   ========================================================================== */

export const GOOGLE_DRIVE_ESCOPO = 'https://www.googleapis.com/auth/drive.file';

export function obterConfigGoogleDrive() {
  try {
    if (typeof localStorage !== 'undefined') {
      const salvo = localStorage.getItem('athenes_gdrive_config');
      if (salvo) return JSON.parse(salvo);
    }
  } catch (_) {}
  return { clientId: '', apiKey: '', accessToken: '' };
}

export function salvarConfigGoogleDrive(cfg) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('athenes_gdrive_config', JSON.stringify(cfg));
    }
  } catch (_) {}
  return cfg;
}

/**
 * Solicita autenticação OAuth2 do Google Identity Services com escopo restrito `drive.file`.
 */
export async function autenticarGoogleDrive(clientId) {
  if (typeof window === 'undefined') throw new Error('Autenticação Google requer navegador.');
  if (!clientId) throw new Error('Informe o Google Client ID para conectar ao Google Drive.');

  // Carrega script oficial do Google Identity Services se necessário
  if (!window.google?.accounts?.oauth2) {
    await carregarScriptExterno('https://accounts.google.com/gsi/client');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_ESCOPO,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          const cfgAtual = obterConfigGoogleDrive();
          salvarConfigGoogleDrive({ ...cfgAtual, clientId, accessToken: resp.access_token });
          resolve(resp.access_token);
        }
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Envia o documento Athenes (.athenes JSON ou .docx Blob) direto para o Google Drive do usuário
 * usando upload multipart oficial da API Google Drive v3 (`drive.file`).
 */
export async function salvarArquivoNoGoogleDrive({
  nomeArquivo,
  conteudoBlobOuTexto,
  mimeType = 'application/json',
  accessToken,
  driveFileId = null
}, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso do Google Drive ausente.');
  if (typeof fetchImpl !== 'function') throw new Error('API fetch indisponível.');

  const metadados = {
    name: nomeArquivo || 'Documento_Athenes.athenes',
    mimeType
  };

  const boundary = '-------AthenesDriveBoundary' + Date.now().toString(16);
  const delimitador = `\r\n--${boundary}\r\n`;
  const fechamento = `\r\n--${boundary}--`;

  const textoCorpo = typeof conteudoBlobOuTexto === 'string'
    ? conteudoBlobOuTexto
    : JSON.stringify(conteudoBlobOuTexto, null, 2);

  const corpoMultipart =
    delimitador +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadados) +
    delimitador +
    `Content-Type: ${mimeType}\r\n\r\n` +
    textoCorpo +
    fechamento;

  const url = driveFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(driveFileId)}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const metodo = driveFileId ? 'PATCH' : 'POST';

  const resp = await fetchImpl(url, {
    method: metodo,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: corpoMultipart
  });

  if (!resp.ok) {
    const det = await resp.text().catch(() => '');
    throw new Error(`Erro ao salvar no Google Drive (${resp.status}): ${det}`);
  }
  return await resp.json();
}

/**
 * Lista arquivos `.athenes` / `.json` criados pelo aplicativo no Google Drive do usuário (`drive.file`).
 */
export async function listarArquivosDoGoogleDrive(accessToken, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso do Google Drive ausente.');
  const q = encodeURIComponent("trashed = false and (name contains '.athenes' or mimeType = 'application/json')");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=30`;

  const resp = await fetchImpl(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    throw new Error(`Erro ao listar arquivos do Google Drive (${resp.status}).`);
  }
  const data = await resp.json();
  return data.files || [];
}

/**
 * Baixa o conteúdo de um arquivo do Google Drive pelo seu fileId.
 */
export async function baixarArquivoDoGoogleDrive(fileId, accessToken, fetchImpl = globalThis.fetch) {
  if (!fileId || !accessToken) throw new Error('ID do arquivo e token são obrigatórios.');
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const resp = await fetchImpl(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    throw new Error(`Erro ao baixar arquivo do Google Drive (${resp.status}).`);
  }
  return await resp.json();
}

function carregarScriptExterno(src) {
  return new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${src}"]`);
    if (existente) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha ao carregar script: ${src}`));
    document.head.appendChild(s);
  });
}
