// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Motor de Nuvem (Supabase), Colaboração Síncrona (Realtime + Presença/Cursores),
 * Modos de Trabalho estilo Google Docs (Edição, Sugestão e Visualização) e Google Drive API.
 */

import { cabecalhosSupabase, limparSessaoSupabase, temSessaoSupabase, trocarIdTokenPorSessao, decodificarJwt, lerSessaoSupabase } from './athenes_supabase_auth.js';
import { sanearBlocoDeTexto, sanearDocumentoEstilos } from './athenes_estilo_exclusivo.js';
import { lerConta, gravarConta, definirContaAtiva, limparContaAtiva, obterContaAtiva } from './athenes_conta.js';
export const SUPABASE_CONFIG_PADRAO = Object.freeze({
  url: 'https://xizxdtaxgvouopkqdbie.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpenhkdGF4Z3ZvdW9wa3FkYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjEyNjMsImV4cCI6MjEwOTEzNzI2M30.QRzjuLjDWiRHVI0cZsDXUc2E-RgVxeJTqRc4Ji38_Cg',
  publishableKey: 'sb_publishable_VyN5VEAI9JAeOGmOxe5iPg_Ah4HdQRh',
  tabela: 'documentos_athenes'
});

export const MODOS_TRABALHO = Object.freeze({
  EDICAO: 'edicao',         // Edita diretamente o documento
  SUGESTAO: 'sugestao',     // Registra adições em verde e exclusões tachadas em vermelho com Aceitar/Rejeitar
  COMPARAR: 'comparar',     // Original × proposta lado a lado, com diff e rolagem sincronizada (somente leitura)
  VISUALIZACAO: 'leitura'   // Leitura fiel: réplica exata da exportação/impressão (somente leitura estrita)
});

/** Modos em que o documento não pode ser editado (leitura fiel e comparação). */
export function modoSomenteLeitura(modo) {
  return modo === MODOS_TRABALHO.VISUALIZACAO || modo === MODOS_TRABALHO.COMPARAR;
}

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
  if (perfil?.conectado) definirContaAtiva(perfil); // dados do navegador passam a ser os desta conta
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('athenes_perfil_colaborador', JSON.stringify(perfil));
    }
  } catch (_) {}
  return perfil;
}

/**
 * Verifica se o usuário possui sessão ativa conectada no Athenes
 * (seja por 'continuar conectado' em localStorage ou sessão temporária em sessionStorage)
 */
export function estaSessaoAtiva() {
  try {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('athenes_sessao_ativa') === 'conectado') return true;
      const s = localStorage.getItem('athenes_sb_sessao');
      if (s && s !== 'null') return true;
    }
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem('athenes_sessao_ativa') === 'conectado') return true;
    }
    const p = obterPerfilColaborador();
    if (p && p.conectado) return true;
  } catch (_) {}
  return false;
}

/**
 * Ativa a sessão do usuário no Athenes
 * @param {boolean} continuarConectado Se true, persiste em localStorage; se false, apenas na sessão atual
 */
export function ativarSessao(continuarConectado = true) {
  try {
    if (continuarConectado) {
      if (typeof localStorage !== 'undefined') localStorage.setItem('athenes_sessao_ativa', 'conectado');
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('athenes_sessao_ativa');
    } else {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('athenes_sessao_ativa', 'conectado');
      if (typeof localStorage !== 'undefined') localStorage.removeItem('athenes_sessao_ativa');
    }
    const p = obterPerfilColaborador();
    p.conectado = true;
    p.continuarConectado = !!continuarConectado;
    salvarPerfilColaborador(p);
  } catch (_) {}
}

/**
 * Encerra a sessão do usuário (Logout completo)
 */
export function encerrarSessao() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('athenes_sessao_ativa');
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('athenes_sessao_ativa');
    const p = obterPerfilColaborador();
    p.conectado = false;
    p.continuarConectado = false;
    p.autenticadoGoogle = false;
    delete p.foto;
    delete p.email;
    p.conta = '';
    salvarPerfilColaborador(p);

    const cfg = obterConfigGoogleDrive(); // ainda na conta que está saindo: apaga o token dela
    salvarConfigGoogleDrive({ ...cfg, accessToken: '', accessTokenExpiraEm: 0 });
    limparSessaoSupabase(); // a sessão da nuvem também sai com a conta
    limparContaAtiva();
  } catch (_) {}
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
  autorId = '',
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
    autorId: String(autorId || ''),
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
  const id = escaparAtributo(sugestao.id);
  const autor = escaparAtributo(sugestao.autor || 'Revisor');
  const autorId = escaparAtributo(sugestao.autorId || '');
  const quando = escaparAtributo(sugestao.criadoEm || '');
  const cor = /^#[0-9a-f]{3,8}$/i.test(sugestao.corAutor || '') ? sugestao.corAutor : '#10B981';
  const attrs = `data-sugestao-id="${id}" data-autor="${autor}" data-autor-id="${autorId}" data-criado="${quando}" style="--ath-sug-cor:${cor}"`;
  const Partes = [];

  // O conteúdo é texto puro (vem de seleção/digitação): escapa para não injetar HTML
  if (sugestao.textoOriginal) {
    Partes.push(
      `<del class="ath-sug-mark ath-sug-del" ${attrs} title="Exclusão sugerida por ${autor}">${escaparTexto(sugestao.textoOriginal)}</del>`
    );
  }
  if (sugestao.textoNovo) {
    Partes.push(
      `<ins class="ath-sug-mark ath-sug-ins" ${attrs} title="Adição sugerida por ${autor}">${escaparTexto(sugestao.textoNovo)}</ins>`
    );
  }
  return Partes.join('');
}

function escaparTexto(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Serializa as sugestões no formato de intercâmbio `{ id, author_id, author_name, timestamp, type, content }`.
 * `type` é 'insertion' ou 'deletion'; uma substituição vira duas entradas (deletion + insertion) ligadas por
 * `group_id` (a decisão de aceitar/rejeitar continua atômica: ambas compartilham o mesmo `id` de origem).
 */
export function serializarSugestoesPadrao(lista) {
  const out = [];
  for (const s of Array.isArray(lista) ? lista : []) {
    const base = {
      author_id: s.autorId || '',
      author_name: s.autor || '',
      timestamp: s.criadoEm || '',
      block_id: s.blocoId || null,
      status: s.status || 'pendente',
      group_id: s.id
    };
    if (s.textoOriginal) out.push({ id: s.id + (s.textoNovo ? ':del' : ''), type: 'deletion', content: s.textoOriginal, ...base });
    if (s.textoNovo) out.push({ id: s.id + (s.textoOriginal ? ':ins' : ''), type: 'insertion', content: s.textoNovo, ...base });
  }
  return out;
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
function sanitizarDocParaNuvem(doc) {
  if (!doc) return doc;
  const copia = { ...doc };
  delete copia.pdfDataUrl;
  delete copia.pdfBlob;
  delete copia.pdfBlobUrl;
  if (copia.artigoEstudo) {
    copia.artigoEstudo = { ...copia.artigoEstudo };
    delete copia.artigoEstudo.pdfDataUrl;
    delete copia.artigoEstudo.pdfBlob;
    delete copia.artigoEstudo.pdfBlobUrl;
  }
  return copia;
}

export async function salvarDocumentoNoSupabase(doc, perfil = null, fetchImpl = globalThis.fetch, { preservarData = false } = {}) {
  if (!doc || !doc.id) throw new Error('Documento inválido para salvamento na nuvem.');
  if (typeof fetchImpl !== 'function') throw new Error('API fetch indisponível neste ambiente.');

  const cfg = obterConfigSupabase();
  const colab = perfil || obterPerfilColaborador();
  // documento compartilhado comigo: só quem tem papel de comentário/edição grava (o banco confere); leitura nunca grava
  const deOutro = Boolean(doc.compartilhadoComigo || doc.proprietarioExterno);
  if (deOutro && doc.permissao === 'leitura') return null;
  const agora = new Date().toISOString();
  if (!preservarData) doc.dataModificacao = agora;

  // a nuvem guarda de quem é o documento: a listagem só devolve os da conta que está conectada
  const conta = obterContaAtiva();
  if (conta && !deOutro) doc.proprietario = { ...(doc.proprietario || {}), conta };
  const sessao = lerSessaoSupabase();
  const payload = {
    id: String(doc.id),
    titulo: String(doc.titulo || 'Documento sem título'),
    autor: String(doc.autor || colab.nome || ''),
    norma: String(doc.norma || 'abnt'),
    conteudo_json: sanitizarDocParaNuvem(doc),
    sugestoes_json: garantirEstruturaSugestoes(doc),
    atualizado_em: agora,
    atualizado_por: colab.nome || 'Autor'
  };
  if (sessao?.user_id && !deOutro) {
    payload.user_id = sessao.user_id;
  }
  if (sessao?.email && !deOutro) {
    payload.proprietario_email = sessao.email;
  }

  const endpoint = `${cfg.url}/rest/v1/${cfg.tabela}?on_conflict=id`;
  const resp = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await cabecalhosSupabase(cfg, { fetchImpl })), // JWT do usuário (as regras do banco só aceitam o dono)
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    if ((resp.status === 401 || resp.status === 403) && !temSessaoSupabase()) { console.warn('[Athenes] Nuvem protegida não confirmada: documento salvo só aqui e no Drive.'); return null; }
    const erroTxt = await resp.text().catch(() => '');
    throw new Error(`Falha ao salvar no Supabase (${resp.status}): ${erroTxt}`);
  }

  const dados = await resp.json().catch(() => [payload]);
  return Array.isArray(dados) ? dados[0] : dados;
}

/** Endereço (autorizado no Google Cloud) para onde o Google devolve o login; a página só repassa o resultado ao app. */
export const uriCallbackGoogle = () => `${globalThis.location?.origin || ''}/oauth_callback.html`;

const hex = (buf) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = () => hex(globalThis.crypto.getRandomValues(new Uint8Array(24)));

/**
 * UM ÚNICO login do Google que entrega tudo: o token de acesso (Drive) e o ID token (conta da nuvem protegida).
 * A janela é aberta de imediato (precisa estar dentro do clique, senão o navegador bloqueia). Devolve
 * { accessToken, idToken, expiresIn, nonce, claims }. Falhas voltam com a explicação (inclusive URI não autorizada).
 */
export function loginGoogleCompleto(clientId = DEFAULT_GOOGLE_CLIENT_ID, { hint = '', forcarEscolha = false, janela = globalThis.window } = {}) {
  const state = aleatorio(); const nonce = aleatorio();
  const redirect = uriCallbackGoogle();
  const popup = janela?.open?.('about:blank', 'athenes_google', 'width=500,height=680');
  if (!popup) return Promise.reject(new Error('O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente de novo.'));
  return (async () => {
    const nonceHash = hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)));
    const q = new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: 'token id_token', scope: GOOGLE_AUTH_ESCOPOS,
      state, nonce: nonceHash, include_granted_scopes: 'true'
    });
    if (hint) q.set('login_hint', hint);
    if (forcarEscolha || !hint) q.set('prompt', 'select_account');
    popup.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    return new Promise((resolve, reject) => {
      let fim = false; let vigia = null;
      const encerrar = (fn, v) => { if (fim) return; fim = true; clearInterval(vigia); janela.removeEventListener('message', ouvir); try { popup.close(); } catch (_) {} fn(v); };
      const ouvir = (ev) => {
        if (ev.origin !== globalThis.location.origin || typeof ev.data?.athenesOAuth !== 'string') return;
        const r = new URLSearchParams(ev.data.athenesOAuth);
        if (r.get('error')) return encerrar(reject, new Error(`Login do Google recusado: ${r.get('error_description') || r.get('error')}`));
        if (r.get('state') !== state) return encerrar(reject, new Error('Resposta do Google inválida (state diferente). Tente de novo.'));
        const idToken = r.get('id_token'); const claims = decodificarJwt(idToken);
        if (!r.get('access_token') || !idToken || !claims) return encerrar(reject, new Error('O Google não devolveu os tokens esperados.'));
        if (claims.nonce !== nonceHash) return encerrar(reject, new Error('Resposta do Google inválida (nonce diferente). Tente de novo.'));
        encerrar(resolve, { accessToken: r.get('access_token'), idToken, expiresIn: Number(r.get('expires_in')) || 3600, nonce, claims });
      };
      janela.addEventListener('message', ouvir);
      vigia = setInterval(() => {
        if (popup.closed) encerrar(reject, new Error(`Login do Google cancelado. Se a janela mostrou "redirect_uri_mismatch", autorize ${redirect} em Google Cloud → Credenciais → URIs de redirecionamento autorizados.`));
      }, 500);
    });
  })();
}

/** Guarda o token do Drive (na conta ativa) com a validade, como fazia o fluxo anterior. */
export function guardarTokenDrive(accessToken, expiresIn, clientId = DEFAULT_GOOGLE_CLIENT_ID) {
  const expiraEm = Date.now() + Math.max(60, Number(expiresIn) || 3600) * 1000 - 120000;
  salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), clientId, accessToken, accessTokenExpiraEm: expiraEm });
}

/** Troca o ID token do login por uma sessão da nuvem protegida (Supabase). */
export const abrirSessaoDaNuvem = (login) => trocarIdTokenPorSessao(login.idToken, obterConfigSupabase(), globalThis.fetch, login.nonce);

/**
 * Confirmação avulsa para quem já estava conectado antes: um login do Google que renova o Drive e abre a sessão da nuvem.
 * Deve ser chamada direto de um clique.
 */
export async function entrarNaNuvemComGoogle() {
  const cid = obterConfigGoogleDrive().clientId || DEFAULT_GOOGLE_CLIENT_ID;
  const login = await loginGoogleCompleto(cid, { hint: obterPerfilColaborador().email || '' });
  guardarTokenDrive(login.accessToken, login.expiresIn, cid);
  return abrirSessaoDaNuvem(login);
}
export const nuvemAutenticada = temSessaoSupabase;

/** Apaga da nuvem a linha do documento (o banco só deixa o dono). Silencioso: a exclusão local já aconteceu. */
export async function excluirDocumentoDoSupabase(docId, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigSupabase();
  if (!docId || !temSessaoSupabase()) return false;
  try {
    const resp = await fetchImpl(`${cfg.url}/rest/v1/${cfg.tabela}?id=eq.${encodeURIComponent(docId)}`, { method: 'DELETE', headers: await cabecalhosSupabase(cfg, { fetchImpl }) });
    return resp.ok;
  } catch (_) { return false; }
}

/**
 * Lista os documentos salvos na nuvem Supabase.
 */
export async function listarDocumentosDoSupabase(fetchImpl = globalThis.fetch, { conta = obterContaAtiva() } = {}) {
  if (typeof fetchImpl !== 'function') return [];
  const cfg = obterConfigSupabase();
  // só os documentos da conta conectada (antes vinham os 50 mais recentes de TODOS); sem conta identificada, sem filtro (testes/anônimo)
  const filtroDono = conta ? `&${encodeURIComponent('conteudo_json->proprietario->>conta')}=eq.${encodeURIComponent(conta)}` : '';
  const endpoint = `${cfg.url}/rest/v1/${cfg.tabela}?select=id,titulo,autor,norma,atualizado_em,atualizado_por${filtroDono}&order=atualizado_em.desc&limit=50`;

  const resp = await fetchImpl(endpoint, {
    method: 'GET',
    headers: await cabecalhosSupabase(cfg, { fetchImpl })
  });

  if (!resp.ok) {
    if ((resp.status === 401 || resp.status === 403) && !temSessaoSupabase()) return [];
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
    headers: await cabecalhosSupabase(cfg, { fetchImpl })
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
      sanearBlocoDeTexto(msg.blocoSnapshot, this.doc?.estilos); // cliente antigo: bloco de texto remoto também chega só com estilo
      this.opcoes.onBlocoRemotoAlterado?.(msg.blocoSnapshot, msg.sugestoes, msg.remetente);
      this.opcoes.onPresencaAlterada?.(this.obterColaboradoresAtivos());
      return;
    }

    if (msg.tipo === 'doc_sincronizado' && msg.docSnapshot) {
      sanearDocumentoEstilos(msg.docSnapshot);
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
export const GOOGLE_AUTH_ESCOPOS = 'openid email profile https://www.googleapis.com/auth/drive.file';
export const DEFAULT_GOOGLE_CLIENT_ID = '948015162542-j898e50a80pf0a9fo69belsar291fh41.apps.googleusercontent.com';

/**
 * Traduz as falhas conhecidas da API do Google Drive em instruções para o usuário (null = sem tradução).
 * O erro "API has not been used in project N before or it is disabled" acontece quando a Drive API não foi ativada no projeto Google do app.
 */
export function explicarErroDrive(status, detalhe = '') {
  const t = String(detalhe || '');
  if (Number(status) === 403 && /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(t)) {
    const projeto = /project[=\s]+(\d{6,})/i.exec(t)?.[1] || '';
    const link = /https:\/\/console\.developers\.google\.com\/apis\/api\/drive\.googleapis\.com\/overview\?project=\d+/.exec(t)?.[0]
      || (projeto ? `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projeto}` : 'https://console.cloud.google.com/apis/library/drive.googleapis.com');
    return `A API do Google Drive ainda não está ativada no projeto Google do Athenes${projeto ? ` (nº ${projeto})` : ''}. Ative-a em ${link} e tente de novo depois de 2 a 5 minutos.`;
  }
  if (Number(status) === 403 && /insufficient|scope|permission/i.test(t)) return 'O Google não concedeu permissão suficiente ao Athenes. Reconecte o Drive e aceite o acesso aos arquivos criados pelo app.';
  return null;
}

export function extrairIdPastaDrive(urlOuId) {
  if (!urlOuId) return '';
  const str = String(urlOuId).trim();
  const match = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) return str;
  return str;
}

/** Ids da estrutura criada no Drive (antes eram descartados ao salvar a configuração e a estrutura se perdia). */
function idsEstruturaDrive(o) {
  const r = {};
  for (const k of ['pastaRaizId', 'raizFixa', 'pastaDocumentosId', 'pastaZoteroId', 'pastaRelatoriosId', 'accessTokenExpiraEm', 'ultimaSincronizacao', 'emailConectado']) if (o?.[k]) r[k] = o[k];
  return r;
}

/** ID da pasta que ficava como padrão no código (de uma única conta): nunca vale como pasta de ninguém. */
const PASTA_LEGADA_ID = '1N2Yi8PhbANCG5wDw_7lmscrrk0jwWGpv';
const eLegada = (v) => String(v || '').includes(PASTA_LEGADA_ID);
const linkDaPasta = (id) => (id ? `https://drive.google.com/drive/folders/${id}` : '');

export function obterConfigGoogleDrive() {
  // sem pasta padrão: o ID que ficava aqui era de UMA conta e apontava para fora do Drive de qualquer outra pessoa
  const pastaUrlPadrao = '';
  const pastaIdPadrao = '';
  try {
    if (typeof localStorage !== 'undefined') {
      const salvo = lerConta('athenes_gdrive_config');
      if (salvo) {
        const parsed = JSON.parse(salvo);
        const urlSalva = eLegada(parsed.pastaUrl) ? '' : (parsed.pastaUrl || '');
        const idSalvo = eLegada(parsed.pastaId) ? '' : (parsed.pastaId || '');
        // a pasta do Athenes no Drive é UMA por conta, a mesma em todos os computadores: a raiz "Athenes" (não é escolha do usuário)
        const pastaId = parsed.pastaRaizId || idSalvo || extrairIdPastaDrive(urlSalva) || pastaIdPadrao;
        const pastaUrl = parsed.pastaRaizId ? linkDaPasta(parsed.pastaRaizId) : (urlSalva || linkDaPasta(pastaId) || pastaUrlPadrao); // o link mostrado é sempre o da pasta realmente usada
        return {
          clientId: parsed.clientId || DEFAULT_GOOGLE_CLIENT_ID,
          apiKey: parsed.apiKey || '',
          accessToken: parsed.accessToken || '',
          pastaUrl,
          pastaId,
          ...idsEstruturaDrive(parsed)
        };
      }
    }
  } catch (_) {}
  return {
    clientId: DEFAULT_GOOGLE_CLIENT_ID,
    apiKey: '',
    accessToken: '',
    pastaUrl: pastaUrlPadrao,
    pastaId: pastaIdPadrao
  };
}

export function salvarConfigGoogleDrive(cfg) {
  const urlInformada = eLegada(cfg?.pastaUrl) ? '' : (cfg?.pastaUrl || '').trim();
  const pastaId = cfg?.pastaRaizId || (eLegada(cfg?.pastaId) ? '' : (cfg?.pastaId || extrairIdPastaDrive(urlInformada)));
  const pastaUrl = cfg?.pastaRaizId ? linkDaPasta(cfg.pastaRaizId) : urlInformada; // com a raiz conhecida, o destino é ela (fixo)
  const normalizado = {
    clientId: (cfg?.clientId || DEFAULT_GOOGLE_CLIENT_ID).trim(),
    apiKey: cfg?.apiKey || '',
    accessToken: cfg?.accessToken || '',
    pastaUrl: pastaUrl || linkDaPasta(pastaId),
    pastaId,
    ...idsEstruturaDrive(cfg)
  };
  try {
    if (typeof localStorage !== 'undefined') {
      gravarConta('athenes_gdrive_config', JSON.stringify(normalizado));
    }
  } catch (_) {}
  return normalizado;
}

/**
 * Solicita autenticação OAuth2 do Google Identity Services com escopo restrito `drive.file`.
 */
export async function autenticarGoogleDrive(clientId = DEFAULT_GOOGLE_CLIENT_ID, scope = GOOGLE_AUTH_ESCOPOS, { silencioso = false } = {}) {
  if (typeof window === 'undefined') throw new Error('Autenticação Google requer navegador.');
  const cid = (clientId || obterConfigGoogleDrive().clientId || DEFAULT_GOOGLE_CLIENT_ID).trim();
  if (!cid) throw new Error('Informe o Google Client ID para conectar ao Google Drive.');

  // Carrega script oficial do Google Identity Services se necessário
  if (!window.google?.accounts?.oauth2) {
    await carregarScriptExterno('https://accounts.google.com/gsi/client');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: scope || GOOGLE_AUTH_ESCOPOS,
        hint: obterPerfilColaborador().email || undefined, // reconectar/renovar entra direto na conta, sem a tela de escolha
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          const cfgAtual = obterConfigGoogleDrive();
          // o token do Google dura ~1 h: guardar quando vence permite renová-lo antes de falhar (margem de 2 min)
          const expiraEm = Date.now() + Math.max(60, Number(resp.expires_in) || 3600) * 1000 - 120000;
          salvarConfigGoogleDrive({ ...cfgAtual, clientId: cid, accessToken: resp.access_token, accessTokenExpiraEm: expiraEm });
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(err?.message || err?.type || 'Autorização do Google cancelada ou bloqueada.'))
      });
      // '' = o Google só mostra a tela de consentimento na primeira vez (antes aparecia a cada conexão); na renovação silenciosa não abre nada
      tokenClient.requestAccessToken({ prompt: '' });
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
  driveFileId = null,
  pastaId = null
}, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso do Google Drive ausente.');
  if (typeof fetchImpl !== 'function') throw new Error('API fetch indisponível.');

  const metadados = {
    name: nomeArquivo || 'Documento_Athenes.athenes',
    mimeType
  };

  // Se uma pasta do Google Drive foi indicada e é um novo upload, define a pasta de destino
  const idDestinoPasta = (pastaId || obterConfigGoogleDrive().pastaId || '').trim();
  if (idDestinoPasta && !driveFileId) {
    metadados.parents = [idDestinoPasta];
  }

  const boundary = '-------AthenesDriveBoundary' + Date.now().toString(16);
  const delimitador = `\r\n--${boundary}\r\n`;
  const fechamento = `\r\n--${boundary}--`;

  let corpoMultipart;
  const ehBlobOuArquivo = (typeof Blob !== 'undefined' && conteudoBlobOuTexto instanceof Blob) ||
    (typeof File !== 'undefined' && conteudoBlobOuTexto instanceof File) ||
    (conteudoBlobOuTexto && typeof conteudoBlobOuTexto === 'object' && typeof conteudoBlobOuTexto.arrayBuffer === 'function');

  if (ehBlobOuArquivo && typeof Blob !== 'undefined') {
    const parteMetadados = delimitador +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadados) +
      delimitador +
      `Content-Type: ${mimeType}\r\n\r\n`;
    corpoMultipart = new Blob([parteMetadados, conteudoBlobOuTexto, fechamento], {
      type: `multipart/related; boundary=${boundary}`
    });
  } else {
    const textoCorpo = typeof conteudoBlobOuTexto === 'string'
      ? conteudoBlobOuTexto
      : JSON.stringify(conteudoBlobOuTexto, null, 2);

    corpoMultipart =
      delimitador +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadados) +
      delimitador +
      `Content-Type: ${mimeType}\r\n\r\n` +
      textoCorpo +
      fechamento;
  }

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
    throw new Error(explicarErroDrive(resp.status, det) || `Erro ao salvar no Google Drive (${resp.status}): ${det}`);
  }
  return await resp.json();
}

/**
 * Lista arquivos `.athenes` / `.json` criados pelo aplicativo no Google Drive do usuário (`drive.file`).
 */
export async function listarArquivosDoGoogleDrive(accessToken, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso do Google Drive ausente.');
  const q = encodeURIComponent("trashed = false and (name contains '.athenes' or mimeType = 'application/json')");
  const todos = [];
  let pagina = '';
  for (let i = 0; i < 10; i++) { // até 1000 arquivos, 100 por página
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,modifiedTime,size,parents)&orderBy=modifiedTime desc&pageSize=100${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`;
    const resp = await fetchImpl(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!resp.ok) {
      throw new Error(`Erro ao listar arquivos do Google Drive (${resp.status}).`);
    }
    const data = await resp.json();
    todos.push(...(data.files || []));
    pagina = data.nextPageToken || '';
    if (!pagina) break;
  }
  return todos;
}

/**
 * Lista arquivos PDF disponíveis no Google Drive do usuário.
 */
export async function listarPdfsDoGoogleDrive(accessToken, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso do Google Drive ausente.');
  const q = encodeURIComponent("trashed = false and (mimeType = 'application/pdf' or name contains '.pdf')");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc&pageSize=40`;

  const resp = await fetchImpl(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    throw new Error(`Erro ao listar PDFs do Google Drive (${resp.status}).`);
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

/**
 * Consulta informacoes do perfil do usuario autenticado no Google (Gmail, Nome, Foto)
 */
export async function obterInfoUsuarioGoogle(accessToken, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso obrigatorio.');
  const resp = await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    throw new Error(`Erro ao consultar perfil Google (${resp.status}).`);
  }
  return await resp.json();
}

/**
 * Localiza ou cria a pasta raiz 'Athenes' e subpastas ('Documentos', 'Zotero_Notas', 'Relatorios_PDF')
 * no Google Drive do usuario para sincronizacao entre Web e App.
 */
export async function obterOuCriarEstruturaPastasAthenes(accessToken, pastaRaizId = null, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso obrigatorio.');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const buscarPasta = async (nome, parentId = null) => {
    let q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${nome}'`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const resp = await fetchImpl(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime`, { headers }); // a mais antiga: igual em todos os computadores
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.files?.[0]?.id || null;
  };

  const criarPasta = async (nome, parentId = null) => {
    try {
      const body = {
        name: nome,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {})
      };
      const resp = await fetchImpl('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        let detalhe = '';
        try { const errJson = await resp.json(); detalhe = errJson.error?.message || ''; } catch (_) {}
        console.warn(`[Athenes Drive] Aviso ao criar pasta ${nome} (${resp.status}): ${detalhe}`);
        return null;
      }
      const data = await resp.json();
      return data.id;
    } catch (err) {
      console.warn(`[Athenes Drive] Erro de rede ao criar pasta ${nome}:`, err);
      return null;
    }
  };

  let raizId = pastaRaizId;
  if (!raizId) {
    raizId = await buscarPasta('Athenes') || await criarPasta('Athenes');
  }

  const documentosId = await buscarPasta('Documentos', raizId) || await criarPasta('Documentos', raizId);
  const zoteroId = await buscarPasta('Zotero_Notas', raizId) || await criarPasta('Zotero_Notas', raizId);
  const relatoriosId = await buscarPasta('Relatorios_PDF', raizId) || await criarPasta('Relatorios_PDF', raizId);

  const estrutura = {
    pastaRaizId: raizId,
    pastaDocumentosId: documentosId,
    pastaZoteroId: zoteroId,
    pastaRelatoriosId: relatoriosId,
    sucesso: Boolean(raizId)
  };

  const cfgAtual = obterConfigGoogleDrive();
  salvarConfigGoogleDrive({ ...cfgAtual, ...estrutura, pastaId: raizId, pastaUrl: raizId ? linkDaPasta(raizId) : cfgAtual.pastaUrl });

  return estrutura;
}

/**
 * Salva notas de fichamento e sinteses do Zotero na pasta dedicada do Google Drive.
 */
export async function salvarNotaZoteroNoGoogleDrive({
  chaveOuId,
  titulo,
  conteudo,
  accessToken,
  pastaZoteroId = null
}, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigGoogleDrive();
  const destino = pastaZoteroId || cfg.pastaZoteroId || cfg.pastaId;
  const nome = `Zotero_${(titulo || chaveOuId || 'Nota').replace(/[^\w\d_-]+/g, '_')}.json`;
  return await salvarArquivoNoGoogleDrive({
    nomeArquivo: nome,
    conteudoBlobOuTexto: typeof conteudo === 'object' ? JSON.stringify(conteudo, null, 2) : String(conteudo),
    mimeType: 'application/json',
    accessToken,
    pastaId: destino
  }, fetchImpl);
}

/**
 * Salva relatorios exportados em PDF na pasta 'Relatorios_PDF' do Google Drive.
 */
export async function salvarRelatorioPdfNoGoogleDrive({
  nomeArquivo,
  blobPdf,
  accessToken,
  pastaRelatoriosId = null
}, fetchImpl = globalThis.fetch) {
  const cfg = obterConfigGoogleDrive();
  const destino = pastaRelatoriosId || cfg.pastaRelatoriosId || cfg.pastaId;
  const nome = (nomeArquivo || 'Relatorio_Athenes.pdf').replace(/[^\w\d_.-]+/g, '_');
  return await salvarArquivoNoGoogleDrive({
    nomeArquivo: nome,
    conteudoBlobOuTexto: blobPdf,
    mimeType: 'application/pdf',
    accessToken,
    pastaId: destino
  }, fetchImpl);
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

export const STORAGE_KEY_PASTAS_DRIVE = 'athenes_pastas_drive_v1';
let _memoriaPastasDrive = null;

export function obterPastasDriveLocais() {
  const padrao = [
    {
      id: 'pasta_bib_raiz',
      nome: 'Bibliografia & Leituras',
      tipo: 'bibliografia',
      origem: 'minhas',
      icone: 'livro',
      subpastas: []
    },
    {
      id: 'pasta_rel_raiz',
      nome: 'Relatórios & Artigos',
      tipo: 'relatorios',
      origem: 'minhas',
      icone: 'documento',
      subpastas: []
    }
  ];

  try {
    if (typeof localStorage !== 'undefined') {
      const salvo = lerConta(STORAGE_KEY_PASTAS_DRIVE);
      if (salvo) {
        let parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          try {
            const excluidasRaw = JSON.parse(lerConta('athenes_pastas_excluidas') || '[]');
            if (Array.isArray(excluidasRaw) && excluidasRaw.length > 0) {
              const mapaExcl = new Set();
              for (const ex of excluidasRaw) {
                if (ex.id) mapaExcl.add(ex.id);
                if (ex.driveId) mapaExcl.add(ex.driveId);
                if (ex.nome) mapaExcl.add(String(ex.nome).trim().toLowerCase());
              }
              const filtrarExcluidas = (lista) => lista.filter(item => {
                if (mapaExcl.has(item.id) || (item.driveId && mapaExcl.has(item.driveId)) || (item.nome && mapaExcl.has(String(item.nome).trim().toLowerCase()))) {
                  return false;
                }
                if (item.subpastas && item.subpastas.length > 0) {
                  item.subpastas = filtrarExcluidas(item.subpastas);
                }
                return true;
              });
              const filtrado = filtrarExcluidas(parsed);
              if (filtrado.length !== parsed.length) {
                gravarConta(STORAGE_KEY_PASTAS_DRIVE, JSON.stringify(filtrado));
                parsed = filtrado;
              }
            }
          } catch (_) {}
          return parsed;
        }
      }
    } else if (_memoriaPastasDrive) {
      return JSON.parse(JSON.stringify(_memoriaPastasDrive));
    }
  } catch (_) {}
  return padrao;
}

export function salvarPastasDriveLocais(pastas) {
  _memoriaPastasDrive = JSON.parse(JSON.stringify(pastas));
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('athenes:pastas-alteradas')); } catch (_) {} // o painel envia a árvore ao servidor
  try {
    if (typeof localStorage !== 'undefined') {
      gravarConta(STORAGE_KEY_PASTAS_DRIVE, JSON.stringify(pastas));
    }
  } catch (_) {}
}

export function buscarPastaNaArvore(pastas, id) {
  if (!Array.isArray(pastas) || !id) return null;
  for (const item of pastas) {
    if (item.id === id) return item;
    if (item.subpastas && item.subpastas.length > 0) {
      const achou = buscarPastaNaArvore(item.subpastas, id);
      if (achou) return achou;
    }
  }
  return null;
}

export function adicionarSubpastaDriveLocal({ parentId, id, nome, tipo = 'relatorios' }) {
  const pastas = obterPastasDriveLocais();
  const novaSub = {
    id: id || ('sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
    nome: nome || 'Nova Subpasta',
    tipo,
    origem: 'minhas',
    parentId,
    subpastas: []
  };

  function inserirRec(lista) {
    for (const item of lista) {
      if (item.id === parentId) {
        if (!item.subpastas) item.subpastas = [];
        item.subpastas.push(novaSub);
        return true;
      }
      if (item.subpastas && item.subpastas.length > 0) {
        if (inserirRec(item.subpastas)) return true;
      }
    }
    return false;
  }

  const inserido = inserirRec(pastas);
  if (!inserido) {
    const raiz = pastas.find(p => p.id === parentId || p.tipo === tipo || p.id === 'pasta_rel_raiz') || pastas[0];
    if (raiz) {
      if (!raiz.subpastas) raiz.subpastas = [];
      raiz.subpastas.push(novaSub);
    }
  }

  salvarPastasDriveLocais(pastas);
  return novaSub;
}

export function adicionarPastaCompartilhadaDriveLocal({ id, nome, url, dono = 'Colega / Orientador', tipo = 'compartilhada', permissao = 'leitura' }) {
  const pastas = obterPastasDriveLocais();
  const pastaId = id || extrairIdPastaDrive(url);
  if (!pastaId) throw new Error('ID ou link da pasta inválido.');

  // Se o pastaId existia em athenes_pastas_excluidas, removê-lo para permitir re-vinculação limpa
  try {
    const raw = lerConta('athenes_pastas_excluidas');
    if (raw) {
      const excluidas = JSON.parse(raw);
      if (Array.isArray(excluidas)) {
        const filtradas = excluidas.filter(x => x && x.id !== pastaId && x.driveId !== pastaId);
        if (filtradas.length !== excluidas.length) {
          gravarConta('athenes_pastas_excluidas', JSON.stringify(filtradas));
        }
      }
    }
  } catch (_) {}

  const existente = buscarPastaNaArvore(pastas, pastaId);
  if (existente) return existente;

  const novaCompartilhada = {
    id: pastaId,
    nome: nome || 'Pasta Compartilhada',
    url: url || ('https://drive.google.com/drive/folders/' + pastaId),
    dono,
    tipo: tipo || 'compartilhada',
    origem: 'compartilhada',
    permissao: ['leitura', 'comentario', 'edicao', 'admin'].includes(permissao) ? permissao : 'leitura', // define se dá para mover/criar arquivos nela
    subpastas: []
  };

  pastas.push(novaCompartilhada);
  salvarPastasDriveLocais(pastas);
  return novaCompartilhada;
}

export function removerPastaDriveLocal(id) {
  let pastas = obterPastasDriveLocais();
  function removerRec(lista) {
    return lista.filter(item => {
      if (item.id === id) return false;
      if (item.subpastas && item.subpastas.length > 0) {
        item.subpastas = removerRec(item.subpastas);
      }
      return true;
    });
  }
  pastas = removerRec(pastas);
  salvarPastasDriveLocais(pastas);
  return pastas;
}

export async function listarSubpastasDoGoogleDrive(accessToken, parentFolderId, fetchImpl = globalThis.fetch) {
  if (!accessToken || !parentFolderId) return [];
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents`;
  const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,modifiedTime)&orderBy=name';
  const resp = await fetchImpl(url, {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.files || [];
}

export async function criarSubpastaNoGoogleDrive({ accessToken, nome, parentFolderId }, fetchImpl = globalThis.fetch) {
  if (!accessToken) throw new Error('Token de acesso do Google Drive ausente.');
  const body = {
    name: nome,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId ? { parents: [parentFolderId] } : {})
  };
  const resp = await fetchImpl('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    let errDet = '';
    try { const ej = await resp.json(); errDet = ej.error?.message || ''; } catch (_) {}
    throw new Error(explicarErroDrive(resp.status, errDet) || `Erro ao criar subpasta no Drive (${resp.status}): ${errDet}`);
  }
  return await resp.json();
}

export async function listarItensDaPastaDrive(accessToken, folderId, fetchImpl = globalThis.fetch) {
  if (!accessToken || !folderId) return [];
  const q = `trashed = false and '${folderId}' in parents`;
  const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc&pageSize=100';
  const resp = await fetchImpl(url, {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.files || [];
}
