// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Sincronização com o Google Drive: pastas da página inicial e documentos (relatórios, artigos…).
 *
 * - Cada pasta local "minha" ganha `driveId` ao ser criada no Drive (sob a pasta raiz do Athenes,
 *   respeitando a hierarquia local: subpasta → pasta-mãe).
 * - Cada documento guarda `driveFileId` / `driveFolderId` / `driveSincronizadoEm` e vai para a pasta
 *   do Drive que corresponde ao seu `pastaId` (muda de pasta no Drive quando muda localmente).
 * Tudo recebe `fetchImpl` e `armazenamento` por parâmetro (testável sem rede nem navegador).
 * Falhas NUNCA são silenciosas: voltam em `erros` ou lançam, e `sessaoExpirada` indica token vencido.
 */
import {
  obterConfigGoogleDrive, salvarConfigGoogleDrive, obterPastasDriveLocais, salvarPastasDriveLocais,
  salvarArquivoNoGoogleDrive, obterOuCriarEstruturaPastasAthenes
} from './athenes_colaboracao.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const NOME_RAIZ = 'Athenes';
const aspas = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export class ErroDrive extends Error {
  constructor(msg, status = 0) { super(msg); this.name = 'ErroDrive'; this.status = status; this.sessaoExpirada = status === 401; }
}

async function chamar(fetchImpl, url, opcoes, token) {
  const resp = await fetchImpl(url, { ...opcoes, headers: { Authorization: `Bearer ${token}`, ...(opcoes?.headers || {}) } });
  if (!resp.ok) {
    let det = '';
    try { det = (await resp.json())?.error?.message || ''; } catch { /* sem corpo */ }
    throw new ErroDrive(resp.status === 401 ? 'A sessão do Google Drive expirou. Reconecte o Drive.' : `Google Drive (${resp.status}): ${det || 'falha na requisição'}`, resp.status);
  }
  return resp.json();
}

export const driveConectado = () => Boolean(obterConfigGoogleDrive().accessToken);

/** O token guardado ainda vale (com a margem de segurança gravada na autenticação)? Sem data de validade (token antigo), vale. */
export function tokenDriveValido(cfg = obterConfigGoogleDrive(), agora = Date.now()) {
  return Boolean(cfg.accessToken) && (!cfg.accessTokenExpiraEm || cfg.accessTokenExpiraEm > agora);
}

let renovacaoEmCurso = null;

/**
 * Token do Drive utilizável agora: o guardado, se ainda vale; senão tenta renová-lo em silêncio (sem janela, sem consentimento).
 * Devolve null quando não dá (o usuário precisa reconectar). `renovar` é injetável para teste.
 */
/** Token válido agora ou, sem ele, abre a conexão com o Google (janela do usuário). Substitui `cfg.accessToken || await autenticarGoogleDrive(...)`. */
export async function obterTokenOuConectar(cfg = obterConfigGoogleDrive()) {
  return (await obterTokenDrive({ cfg })) || (await import('./athenes_colaboracao.js')).autenticarGoogleDrive(cfg.clientId);
}

export async function obterTokenDrive({ renovar = null, cfg = obterConfigGoogleDrive(), agora = Date.now() } = {}) {
  if (tokenDriveValido(cfg, agora)) return cfg.accessToken;
  if (!cfg.accessToken && !cfg.accessTokenExpiraEm) return null; // nunca conectou
  const tentar = renovar || (async () => (await import('./athenes_colaboracao.js')).autenticarGoogleDrive(cfg.clientId, undefined, { silencioso: true }));
  renovacaoEmCurso = renovacaoEmCurso || Promise.resolve().then(tentar).catch(() => null).finally(() => { renovacaoEmCurso = null; });
  return renovacaoEmCurso;
}

/** Procura a pasta pelo nome dentro do pai; cria quando não existe. */
export async function buscarOuCriarPasta(token, nome, paiId, fetchImpl = globalThis.fetch) {
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${aspas(nome)}'${paiId ? ` and '${aspas(paiId)}' in parents` : ''}`;
  const achou = await chamar(fetchImpl, `${API}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`, {}, token);
  if (achou.files?.[0]?.id) return { id: achou.files[0].id, criada: false };
  const nova = await chamar(fetchImpl, API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', ...(paiId ? { parents: [paiId] } : {}) })
  }, token);
  return { id: nova.id, criada: true };
}

const raizValidada = new Set(); // "idDaPasta|token": já conferida nesta sessão (evita uma consulta por envio)

/** A pasta existe, não está na lixeira e esta conta enxerga? (apagada ou conta diferente → false) */
async function pastaDriveExiste(token, id, fetchImpl) {
  try {
    const r = await chamar(fetchImpl, `${API}/${encodeURIComponent(id)}?fields=id,trashed`, {}, token);
    return !!r?.id && !r.trashed;
  } catch (e) {
    if (e.status === 404 || e.status === 403) return false;
    throw e; // 401 e falhas de rede não significam "pasta sumiu"
  }
}

const limparDriveIds = (lista) => { for (const p of lista || []) { delete p.driveId; limparDriveIds(p.subpastas); } };

/**
 * Pasta raiz "Athenes" no Drive (guardada na configuração). Se a guardada não existe mais ou é de outra conta,
 * recria a raiz e esquece os `driveId` das pastas locais (eles apontavam para dentro da raiz antiga).
 */
export async function obterPastaRaizDrive(token, fetchImpl = globalThis.fetch, pastas = null) {
  const cfg = obterConfigGoogleDrive();
  if (cfg.pastaRaizId) {
    const chave = `${cfg.pastaRaizId}|${token}`;
    if (raizValidada.has(chave)) return cfg.pastaRaizId;
    if (await pastaDriveExiste(token, cfg.pastaRaizId, fetchImpl)) { raizValidada.add(chave); return cfg.pastaRaizId; }
    salvarConfigGoogleDrive({ ...cfg, pastaRaizId: '', pastaDocumentosId: '', pastaZoteroId: '', pastaRelatoriosId: '' });
    const locais = obterPastasDriveLocais();
    limparDriveIds(locais); salvarPastasDriveLocais(locais);
    if (pastas) limparDriveIds(pastas); // a árvore em uso por quem chamou
  }
  const { id } = await buscarOuCriarPasta(token, NOME_RAIZ, null, fetchImpl);
  salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), accessToken: token, pastaRaizId: id });
  raizValidada.add(`${id}|${token}`);
  return id;
}

/**
 * Garante `driveId` em toda pasta própria da árvore local (pais antes dos filhos).
 * Devolve { criadas, existentes, erros: [{ pasta, erro }], sessaoExpirada }.
 */
export async function sincronizarPastasComDrive(token, { fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais() } = {}) {
  const r = { criadas: 0, existentes: 0, erros: [], sessaoExpirada: false };
  let raizId;
  try { raizId = await obterPastaRaizDrive(token, fetchImpl, pastas); } catch (e) { r.erros.push({ pasta: NOME_RAIZ, erro: e.message }); r.sessaoExpirada = !!e.sessaoExpirada; return r; }

  const visitar = async (lista, paiDriveId) => {
    for (const p of lista || []) {
      if (p.origem === 'compartilhada' || p.tipo === 'compartilhada') { continue; }
      let driveId = p.driveId;
      if (!driveId) {
        try {
          const res = await buscarOuCriarPasta(token, p.nome, paiDriveId, fetchImpl);
          driveId = p.driveId = res.id;
          res.criada ? r.criadas++ : r.existentes++;
        } catch (e) {
          r.erros.push({ pasta: p.nome, erro: e.message });
          if (e.sessaoExpirada) { r.sessaoExpirada = true; return; }
          continue; // sem o pai no Drive não dá para criar os filhos
        }
      } else r.existentes++;
      await visitar(p.subpastas, driveId);
      if (r.sessaoExpirada) return;
    }
  };
  await visitar(pastas, raizId);
  salvarPastasDriveLocais(pastas);
  return r;
}

function acharPasta(pastas, id) {
  for (const p of pastas || []) { if (p.id === id) return p; const f = acharPasta(p.subpastas, id); if (f) return f; }
  return null;
}

export const nomeArquivoDoDocumento = (doc) => `${String(doc?.titulo || 'Documento').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 120) || 'Documento'}.athenes`;

/**
 * Envia (ou atualiza) o documento na pasta do Drive que corresponde ao seu `pastaId`.
 * Muda o arquivo de pasta no Drive quando o documento foi movido localmente.
 * Muta `doc` com driveFileId/driveFolderId/driveSincronizadoEm.
 */
const emVoo = new Map(); // um envio por documento por vez (evita criar o arquivo duas vezes)

export function enviarDocumentoAoDrive(doc, token, opcoes = {}) {
  if (!doc || doc.precisaCarregarConteudo) return Promise.resolve(null);
  const chave = String(doc.id);
  if (emVoo.has(chave)) return emVoo.get(chave).then(() => enviarDocumentoAoDrive(doc, token, opcoes));
  const p = enviarDocumentoAoDriveInterno(doc, token, opcoes).finally(() => emVoo.delete(chave));
  emVoo.set(chave, p.catch(() => {}));
  return p;
}

async function enviarDocumentoAoDriveInterno(doc, token, { fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais() } = {}) {
  const sync = await sincronizarPastasComDrive(token, { fetchImpl, pastas });
  if (sync.sessaoExpirada) throw new ErroDrive('A sessão do Google Drive expirou. Reconecte o Drive.', 401);
  const pasta = acharPasta(pastas, doc.pastaId);
  const alvo = pasta?.driveId || pasta?.driveFolderId || await obterPastaRaizDrive(token, fetchImpl, pastas);
  const conteudo = JSON.stringify(doc, (k, v) => (k === 'paginas' ? undefined : v));

  let id = doc.driveFileId || null;
  if (id && doc.driveFolderId && doc.driveFolderId !== alvo) {
    try {
      await chamar(fetchImpl, `${API}/${encodeURIComponent(id)}?addParents=${encodeURIComponent(alvo)}&removeParents=${encodeURIComponent(doc.driveFolderId)}&fields=id`, { method: 'PATCH' }, token);
    } catch (e) { if (e.status === 404) id = null; else throw e; }
  }
  const enviar = (fileId) => salvarArquivoNoGoogleDrive({
    nomeArquivo: nomeArquivoDoDocumento(doc), conteudoBlobOuTexto: conteudo, mimeType: 'application/json', accessToken: token, driveFileId: fileId, pastaId: alvo
  }, fetchImpl);
  let salvo;
  try { salvo = await enviar(id); } catch (e) {
    if (id && /\(404\)/.test(e.message)) salvo = await enviar(null); // arquivo apagado no Drive: recria
    else throw /\(401\)/.test(e.message) ? new ErroDrive('A sessão do Google Drive expirou. Reconecte o Drive.', 401) : e;
  }
  doc.driveFileId = salvo.id;
  doc.driveFolderId = alvo;
  doc.driveSincronizadoEm = new Date().toISOString();
  return salvo;
}

/** Documento precisa subir? (nunca enviado, alterado depois do último envio ou movido de pasta). */
export function precisaEnviarAoDrive(doc, pastas = obterPastasDriveLocais()) {
  if (!doc || doc.precisaCarregarConteudo || doc.proprietarioExterno) return false;
  if (!doc.driveFileId || !doc.driveSincronizadoEm) return true;
  if ((doc.dataModificacao || '') > doc.driveSincronizadoEm) return true;
  const pasta = acharPasta(pastas, doc.pastaId);
  return !!pasta?.driveId && pasta.driveId !== doc.driveFolderId;
}

/** Envia todos os documentos pendentes. Devolve { enviados, erros, sessaoExpirada }. */
export async function sincronizarDocumentosComDrive(documentos, token, { fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais(), aoProgresso } = {}) {
  const r = { enviados: 0, erros: [], sessaoExpirada: false };
  const pendentes = (documentos || []).filter(d => precisaEnviarAoDrive(d, pastas));
  for (let i = 0; i < pendentes.length; i++) {
    try {
      await enviarDocumentoAoDrive(pendentes[i], token, { fetchImpl, pastas });
      r.enviados++;
    } catch (e) {
      r.erros.push({ documento: pendentes[i].titulo, erro: e.message });
      if (e.sessaoExpirada) { r.sessaoExpirada = true; break; }
    }
    aoProgresso?.(i + 1, pendentes.length);
  }
  return r;
}

/** Limpa o token vencido para a interface pedir reconexão em vez de falhar de novo. */
export function marcarSessaoDriveExpirada() {
  const cfg = obterConfigGoogleDrive();
  salvarConfigGoogleDrive({ ...cfg, accessToken: '' });
}
