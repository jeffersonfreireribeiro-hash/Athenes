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
  salvarArquivoNoGoogleDrive, obterOuCriarEstruturaPastasAthenes, explicarErroDrive,
  listarArquivosDoGoogleDrive, baixarArquivoDoGoogleDrive
} from './athenes_colaboracao.js';
import { lerConta, gravarConta } from './athenes_conta.js';
import { decidirConfigZotero } from './athenes_zotero_config.js';

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
    throw new ErroDrive(resp.status === 401 ? 'A sessão do Google Drive expirou. Reconecte o Drive.' : (explicarErroDrive(resp.status, det) || `Google Drive (${resp.status}): ${det || 'falha na requisição'}`), resp.status);
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
  const tentar = renovar || (async () => Promise.race([(await import('./athenes_colaboracao.js')).autenticarGoogleDrive(cfg.clientId, undefined, { silencioso: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500))]));
  renovacaoEmCurso = renovacaoEmCurso || Promise.resolve().then(tentar).catch(() => null).finally(() => { renovacaoEmCurso = null; });
  return renovacaoEmCurso;
}

/** Procura a pasta pelo nome dentro do pai; cria quando não existe. */
export async function buscarOuCriarPasta(token, nome, paiId, fetchImpl = globalThis.fetch) {
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${aspas(nome)}'${paiId ? ` and '${aspas(paiId)}' in parents` : ''}`;
  // a mais antiga: em dois computadores, o primeiro cria a pasta e o segundo (que não a enxergava) pode ter criado outra; todos passam a usar a mesma
  const achou = await chamar(fetchImpl, `${API}?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime&pageSize=10`, {}, token);
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
    if (cfg.raizFixa && await pastaDriveExiste(token, cfg.pastaRaizId, fetchImpl)) { raizValidada.add(chave); return cfg.pastaRaizId; } // a pasta raiz definida pelo servidor vale para todos os computadores
    if (await pastaDriveExiste(token, cfg.pastaRaizId, fetchImpl)) {
      // existe, mas pode haver outra "Athenes" mais antiga criada por outro computador: a mais antiga é a de todos
      const mais = (await chamar(fetchImpl, `${API}?q=${encodeURIComponent(`trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${aspas(NOME_RAIZ)}'`)}&fields=files(id)&orderBy=createdTime&pageSize=1`, {}, token).catch(() => null))?.files?.[0]?.id;
      if (!mais || mais === cfg.pastaRaizId) { raizValidada.add(chave); return cfg.pastaRaizId; }
      salvarConfigGoogleDrive({ ...cfg, pastaRaizId: mais, pastaDocumentosId: '', pastaZoteroId: '', pastaRelatoriosId: '', pastaId: '', pastaUrl: '' });
      const locais2 = obterPastasDriveLocais();
      limparDriveIds(locais2); salvarPastasDriveLocais(locais2);
      if (pastas) limparDriveIds(pastas);
      raizValidada.add(`${mais}|${token}`);
      return mais;
    }
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
  if (id) {
    // confere ONDE o arquivo está de verdade no Drive (o registro local podia dizer "na pasta X" sem o arquivo ter sido movido) e leva para a pasta certa
    try {
      const atual = await chamar(fetchImpl, `${API}/${encodeURIComponent(id)}?fields=parents,trashed`, {}, token);
      if (atual.trashed) id = null;
      else if (!(atual.parents || []).includes(alvo)) {
        const remover = (atual.parents || []).length ? `&removeParents=${encodeURIComponent(atual.parents.join(','))}` : '';
        await chamar(fetchImpl, `${API}/${encodeURIComponent(id)}?addParents=${encodeURIComponent(alvo)}${remover}&fields=id`, { method: 'PATCH' }, token);
      }
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

/**
 * Move um arquivo no Google Drive alterando seus pais (parents).
 * Executa PATCH /files/{fileId}?addParents={novaPasta}&removeParents={paisAtuais}
 */
export async function moverArquivoNoDrive(fileId, novaPastaDriveId, token, { fetchImpl = globalThis.fetch } = {}) {
  if (!fileId || !novaPastaDriveId || !token) return null;
  const idStr = String(fileId).trim();
  if (idStr.startsWith('drive_pdf_')) return null;
  try {
    const atual = await chamar(fetchImpl, `${API}/${encodeURIComponent(idStr)}?fields=id,parents,trashed`, {}, token);
    if (!atual || atual.trashed) return null;
    const paisAtuais = atual.parents || [];
    if (paisAtuais.includes(novaPastaDriveId)) {
      return { ...atual, jaEstavaNaPasta: true }; // Já está na pasta destino
    }
    const remover = paisAtuais.length ? `&removeParents=${encodeURIComponent(paisAtuais.join(','))}` : '';
    const movido = await chamar(
      fetchImpl,
      `${API}/${encodeURIComponent(idStr)}?addParents=${encodeURIComponent(novaPastaDriveId)}${remover}&fields=id,parents`,
      { method: 'PATCH' },
      token
    );
    return { ...movido, jaEstavaNaPasta: false };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

/**
 * Obtém ou cria a pasta correspondente a uma coleção/categoria de bibliografia no Google Drive.
 * Se o artigo pertence a uma pasta específica (ou coleção do Zotero), localiza sua pasta correspondente
 * dentro da árvore "Bibliografia & Leituras" (pasta_bib_raiz).
 * Retorna o driveId da pasta destino no Google Drive.
 */
export async function obterOuCriarPastaDoArtigoNoDrive(pastaId, token, { fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais() } = {}) {
  if (!token) return null;
  // Sincroniza a árvore de pastas no Drive para garantir que as pastas e subpastas tenham driveId
  await sincronizarPastasComDrive(token, { fetchImpl, pastas });

  const pId = String(pastaId || '').trim();
  if (pId && pId !== 'todas' && pId !== 'pasta_bib_raiz') {
    const pastaEspecifica = acharPasta(pastas, pId);
    if (pastaEspecifica?.driveId) {
      return pastaEspecifica.driveId;
    }
  }

  // Raiz de bibliografia
  const bibRaiz = (pastas || []).find(p => p.id === 'pasta_bib_raiz' || p.tipo === 'bibliografia');
  if (bibRaiz?.driveId) {
    return bibRaiz.driveId;
  }

  // Fallback: raiz Athenes
  return await obterPastaRaizDrive(token, fetchImpl, pastas);
}

/**
 * Move todos os arquivos vinculados a um artigo (PDF e fichamento .athenes-pdf.json)
 * para a pasta correspondente no Google Drive.
 */
export async function moverArquivosDoArtigoNoDrive(art, pastaDestinoId, { token = null, fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais() } = {}) {
  if (!art) return { movidos: 0, erros: [] };
  const r = { movidos: 0, erros: [] };
  const tokenFinal = token || (await obterTokenDrive());
  if (!tokenFinal) return r;

  try {
    const novaPastaDriveId = await obterOuCriarPastaDoArtigoNoDrive(pastaDestinoId, tokenFinal, { fetchImpl, pastas });
    if (!novaPastaDriveId) return r;

    // 1. Move o arquivo PDF
    const idPdf = String(art.driveFileId || '').trim();
    if (idPdf && !idPdf.startsWith('drive_pdf_')) {
      try {
        await moverArquivoNoDrive(idPdf, novaPastaDriveId, tokenFinal, { fetchImpl });
        r.movidos++;
      } catch (e) {
        r.erros.push({ arquivo: 'pdf', erro: e.message });
      }
    }

    // 2. Move o arquivo de anotações/fichamento JSON
    const idAnotacao = String(art.driveAnnotationFileId || '').trim();
    if (idAnotacao && !idAnotacao.startsWith('drive_pdf_')) {
      try {
        await moverArquivoNoDrive(idAnotacao, novaPastaDriveId, tokenFinal, { fetchImpl });
        r.movidos++;
      } catch (e) {
        r.erros.push({ arquivo: 'anotacoes', erro: e.message });
      }
    }

    art.driveFolderId = novaPastaDriveId;
  } catch (e) {
    r.erros.push({ geral: e.message });
  }

  return r;
}

/**
 * Reconcilia e reorganiza no Google Drive todos os arquivos de artigos e referências
 * que foram salvos antes dessa atualização (ou que estejam na pasta errada/raiz/Bibliografia_PDFs).
 * Move os arquivos PDF e anotações JSON para a pasta correspondente à sua coleção/categoria.
 *
 * @param {Array<object>} artigos - Lista de artigos
 * @param {string} token - Token de acesso do Google Drive
 * @param {object} [opcoes]
 * @returns {Promise<{ total: number, movidos: number, erros: Array }>}
 */
export async function reconciliarArtigosComDrive(artigos, token, { fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais(), aoProgresso = null } = {}) {
  const r = { total: 0, movidos: 0, erros: [] };
  if (!token || !Array.isArray(artigos) || artigos.length === 0) return r;

  await sincronizarPastasComDrive(token, { fetchImpl, pastas });

  const lista = artigos.filter(a => Boolean(a?.driveFileId || a?.driveAnnotationFileId));
  r.total = lista.length;

  for (let i = 0; i < lista.length; i++) {
    const art = lista[i];
    try {
      const pastaDestinoId = await obterOuCriarPastaDoArtigoNoDrive(art.pastaId, token, { fetchImpl, pastas });
      if (pastaDestinoId) {
        let moveuAlgum = false;

        const idPdf = String(art.driveFileId || '').trim();
        if (idPdf && !idPdf.startsWith('drive_pdf_')) {
          const resPdf = await moverArquivoNoDrive(idPdf, pastaDestinoId, token, { fetchImpl });
          if (resPdf && !resPdf.jaEstavaNaPasta) moveuAlgum = true;
        }

        const idAnot = String(art.driveAnnotationFileId || '').trim();
        if (idAnot && !idAnot.startsWith('drive_pdf_')) {
          const resAnot = await moverArquivoNoDrive(idAnot, pastaDestinoId, token, { fetchImpl });
          if (resAnot && !resAnot.jaEstavaNaPasta) moveuAlgum = true;
        }

        if (moveuAlgum) {
          r.movidos++;
          art.driveFolderId = pastaDestinoId;
        }
      }
    } catch (e) {
      r.erros.push({ artigo: art.titulo || art.id, erro: e.message });
    }
    if (typeof aoProgresso === 'function') {
      aoProgresso(i + 1, lista.length);
    }
  }

  return r;
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

// ───────────────────────────── Biblioteca pelo Drive (cada conta enxerga só o próprio Drive) ─────────────────────────────

const semExtensao = (nome) => String(nome || 'Documento').replace(/\.athenes$/i, '').replace(/\.json$/i, '') || 'Documento';

/**
 * Documentos `.athenes` que o app criou no Drive de quem está conectado (escopo drive.file: nunca de outra conta).
 * Só o índice (nome, data, id do arquivo): o conteúdo é baixado quando o documento é aberto e depois descartado/atualizado.
 */
export async function listarBibliotecaDoDrive(token, { fetchImpl = globalThis.fetch } = {}) {
  const arquivos = await listarArquivosDoGoogleDrive(token, fetchImpl);
  return arquivos
    .filter(f => /\.athenes$/i.test(f.name || ''))
    .map(f => ({ driveFileId: f.id, titulo: semExtensao(f.name), modificadoEm: f.modifiedTime || '', driveFolderId: f.parents?.[0] || '' }));
}

/**
 * Acrescenta ao índice local os documentos do Drive que ainda não existem aqui (como "só no Drive": conteúdo baixado ao abrir)
 * e marca os que já existem para baixar de novo quando o do Drive é mais novo. Devolve { novos, atualizados }.
 */
export function mesclarBibliotecaDrive(documentos, arquivos, mapaPastas = {}, pastas = null, excluidos = excluidosDoDrive(), permitidos = null) {
  const r = { novos: 0, atualizados: 0 };
  for (const f of arquivos || []) {
    if (excluidos.has(f.driveFileId)) continue; // o usuário excluiu este documento: não volta na sincronização
    const local = documentos.find(d => d.driveFileId === f.driveFileId);
    if (!local) {
      if (permitidos && !permitidos.has(f.driveFileId)) continue; // o servidor diz o que vale: arquivo do Drive que ele não lista não aparece
      documentos.unshift({
        id: `drive_${f.driveFileId}`, titulo: f.titulo, subtitulo: 'Do seu Google Drive', tipoDoc: 'artigo', perfilId: 'abnt',
        dataModificacao: f.modificadoEm, driveFileId: f.driveFileId, driveSincronizadoEm: f.modificadoEm, origemDrive: true, precisaCarregarConteudo: true,
        ...(f.driveFolderId ? { driveFolderId: f.driveFolderId } : {}), ...(mapaPastas[f.driveFolderId] ? { pastaId: mapaPastas[f.driveFolderId] } : {})
      });
      r.novos++;
    } else if (f.driveFolderId && mapaPastas[f.driveFolderId] && f.driveFolderId !== local.driveFolderId
      && (!local.pastaId || local.pastaId === mapaPastas[local.driveFolderId] || !mapaPastas[local.driveFolderId])) {
      // o arquivo está noutra pasta do Drive (foi movido em outro computador) e aqui não há mudança de pasta pendente: segue o Drive
      local.pastaId = mapaPastas[f.driveFolderId];
      local.driveFolderId = f.driveFolderId;
      r.atualizados++;
    } else if (!local.pastaId && mapaPastas[f.driveFolderId]) {
      local.pastaId = mapaPastas[f.driveFolderId]; // documento já importado antes, agora na pasta certa
      r.atualizados++;
    } else if (pastas && f.driveFolderId && local.pastaId && !local.precisaCarregarConteudo
      && acharPasta(pastas, local.pastaId)?.driveId && acharPasta(pastas, local.pastaId).driveId !== f.driveFolderId && !mapaPastas[f.driveFolderId]) {
      // o Drive mostra o arquivo FORA da pasta dele (ex.: solto na raiz) embora o registro diga que está lá: registra o lugar real; o envio o leva para a pasta certa
      local.driveFolderId = f.driveFolderId;
      r.corrigidos = (r.corrigidos || 0) + 1;
    } else if (f.modificadoEm && local.driveSincronizadoEm && f.modificadoEm > local.driveSincronizadoEm && !local.precisaCarregarConteudo && (local.dataModificacao || '') <= local.driveSincronizadoEm) {
      local.precisaCarregarConteudo = true; // o do Drive é mais novo e não há edição local pendente
      local.origemDrive = true;
      r.atualizados++;
    }
  }
  return r;
}

/** Baixa o conteúdo de um documento do Drive, mantendo os vínculos com o arquivo e a pasta. */
export async function baixarDocumentoDoDrive(doc, token, { fetchImpl = globalThis.fetch } = {}) {
  const conteudo = await baixarArquivoDoGoogleDrive(doc.driveFileId, token, fetchImpl);
  if (!conteudo || typeof conteudo !== 'object') throw new ErroDrive('O arquivo do Drive não é um documento Athenes válido.');
  const agora = new Date().toISOString();
  return { ...conteudo, id: doc.id.startsWith('drive_') ? (conteudo.id || doc.id) : doc.id, driveFileId: doc.driveFileId, driveSincronizadoEm: agora, dataModificacao: conteudo.dataModificacao || agora, precisaCarregarConteudo: false, origemDrive: false };
}

// ───────────────────────────── Estrutura de pastas vinda do Drive (outro computador, mesmo Google) ─────────────────────────────

const PASTAS_DE_SISTEMA = new Set(['Documentos', 'Zotero_Notas', 'Relatorios_PDF']); // criadas pelo app dentro da raiz; seus arquivos ficam em "todas"

async function listarSubpastasDoDrive(token, paiId, fetchImpl) {
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and '${aspas(paiId)}' in parents`;
  const r = await chamar(fetchImpl, `${API}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=100&orderBy=name`, {}, token);
  return r.files || [];
}

/**
 * Traz para a árvore local as pastas que já existem sob a raiz "Athenes" do Drive: vincula as de mesmo nome (e nível) às locais
 * e cria as que faltam. Em outro computador a árvore local começa só com as pastas padrão; sem isto a estrutura do Drive se perdia.
 * Devolve { importadas, vinculadas, mapa } (mapa: id da pasta no Drive → id da pasta local).
 */
export async function importarPastasDoDrive(token, { fetchImpl = globalThis.fetch, pastas = obterPastasDriveLocais() } = {}) {
  const r = { importadas: 0, vinculadas: 0, mapa: {} };
  const raizId = await obterPastaRaizDrive(token, fetchImpl, pastas);
  const excluidas = new Set();
  for (const x of lerPastasExcluidas()) {
    if (x.id) excluidas.add(x.id);
    if (x.driveId) { excluidas.add(x.driveId); excluidas.add('drive_' + x.driveId); }
  }
  let total = 0;
  const visitar = async (lista, paiDriveId, paiLocal, nivel) => {
    if (nivel > 6 || total > 300) return;
    for (const f of await listarSubpastasDoDrive(token, paiDriveId, fetchImpl)) {
      if (nivel === 0 && PASTAS_DE_SISTEMA.has(f.name)) continue;
      if (excluidas.has(f.id) || excluidas.has('drive_' + f.id)) continue;
      total++;
      let local = lista.find(p => p.driveId === f.id) || lista.find(p => !p.driveId && p.nome === f.name && p.origem !== 'compartilhada');
      if (local) {
        if (!local.driveId) { local.driveId = f.id; r.vinculadas++; }
      } else {
        local = { id: `drive_${f.id}`, nome: f.name, tipo: paiLocal?.tipo || 'relatorios', origem: 'minhas', ...(paiLocal ? { parentId: paiLocal.id } : {}), driveId: f.id, subpastas: [] };
        lista.push(local);
        r.importadas++;
      }
      r.mapa[f.id] = local.id;
      if (!Array.isArray(local.subpastas)) local.subpastas = [];
      await visitar(local.subpastas, f.id, local, nivel + 1);
    }
  };
  await visitar(pastas, raizId, null, 0);
  salvarPastasDriveLocais(pastas);
  return r;
}

// ───────────────────────────── Zotero conectado em um computador vale nos outros (pelo Drive da própria conta) ─────────────────────────────

const NOME_CONFIG_DRIVE = 'athenes_config.json';
const CHAVE_ZOTERO = 'athenes_zotero_cfg';
const CHAVE_ZOTERO_MARCA = 'athenes_zotero_sync';
const chaveZotero = (c) => `${c?.userId || ''}|${c?.apiKey || ''}|${c?.username || ''}|${c?.isGroup ? 1 : 0}`;
const lerJson = (k) => { try { return JSON.parse(lerConta(k) || '{}') || {}; } catch { return {}; } };
const zoteroCompleto = (c) => Boolean(c?.apiKey && c?.userId);

/**
 * Mantém a chave e o ID do Zotero iguais em todos os computadores da mesma conta Google, guardados num arquivo do app no
 * Drive da própria pessoa (`athenes_config.json`, na pasta Athenes). Regras:
 *  - só neste computador → envia; só no Drive → traz (aparece conectado sem digitar nada);
 *  - nos dois e diferentes → vale o lado que mudou desde a última sincronização (sem histórico, vale o do Drive).
 * Devolve 'enviou' | 'baixou' | 'igual' | 'nada'.
 */
export async function sincronizarZoteroComDrive(token, { fetchImpl = globalThis.fetch } = {}) {
  const local = lerJson(CHAVE_ZOTERO);
  const marca = lerJson(CHAVE_ZOTERO_MARCA);
  const raizId = await obterPastaRaizDrive(token, fetchImpl);
  const q = `trashed = false and name = '${aspas(NOME_CONFIG_DRIVE)}' and '${aspas(raizId)}' in parents`;
  const achou = await chamar(fetchImpl, `${API}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {}, token);
  const arquivo = achou.files?.[0] || null;
  let remoto = null; let remotoEm = '';
  if (arquivo) {
    const conteudo = await baixarArquivoDoGoogleDrive(arquivo.id, token, fetchImpl).catch(() => null);
    remoto = conteudo?.zotero || null; remotoEm = conteudo?.atualizadoEm || '';
  }
  const marcar = (cfg, em) => gravarConta(CHAVE_ZOTERO_MARCA, JSON.stringify({ hash: chaveZotero(cfg), em: em || new Date().toISOString() }));
  const enviar = async () => {
    const em = new Date().toISOString();
    await salvarArquivoNoGoogleDrive({ nomeArquivo: NOME_CONFIG_DRIVE, conteudoBlobOuTexto: JSON.stringify({ zotero: local, atualizadoEm: local.alteradoEm || em }), mimeType: 'application/json', accessToken: token, driveFileId: arquivo?.id || null, pastaId: raizId }, fetchImpl);
    marcar(local, em);
    return 'enviou';
  };
  const baixar = () => { gravarConta(CHAVE_ZOTERO, JSON.stringify({ ...local, ...remoto, ...(remotoEm ? { alteradoEm: remotoEm } : {}) })); marcar(remoto, remotoEm); return 'baixou'; };

  const temLocal = zoteroCompleto(local); const temRemoto = zoteroCompleto(remoto);
  if (!temLocal && temRemoto) return baixar();
  if (temLocal && !temRemoto) return enviar();
  if (!temLocal && !temRemoto) return 'nada';
  if (chaveZotero(local) === chaveZotero(remoto)) { marcar(local, remotoEm); return 'igual'; }
  const localMudou = Boolean(marca.hash) && chaveZotero(local) !== marca.hash;
  return decidirConfigZotero(local, remoto, { localMudou, remotoEm }) === 'local' ? enviar() : baixar(); // vale a mudança mais recente
}

/**
 * O `pastaId` de um documento é um id LOCAL da árvore de pastas daquele computador; em outro computador as pastas importadas
 * têm outros ids. Quando o do documento não existe aqui, usa o vínculo com o Drive (`driveFolderId` = `driveId` da pasta).
 * Devolve quantos documentos foram religados.
 */
export function repararPastaDosDocumentos(documentos, pastas) {
  const todas = [];
  const coletar = (l) => { for (const p of l || []) { todas.push(p); coletar(p.subpastas); } };
  coletar(pastas);
  const ids = new Set(todas.map(p => p.id));
  let n = 0;
  for (const d of documentos || []) {
    if (d.pastaId && ids.has(d.pastaId)) continue;
    const alvo = d.driveFolderId && todas.find(p => p.driveId === d.driveFolderId);
    if (alvo && d.pastaId !== alvo.id) { d.pastaId = alvo.id; n++; }
  }
  return n;
}

// ───────────────────────────── Exclusão: o que foi excluído não volta ─────────────────────────────

const CHAVE_EXCLUIDOS = 'athenes_docs_excluidos';
const lerExcluidos = () => { try { const v = JSON.parse(lerConta(CHAVE_EXCLUIDOS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** Exclusões registradas neste computador: [{ id, driveFileId, em, … }]. */
export const exclusoesRegistradas = () => lerExcluidos();

/** driveFileIds de documentos excluídos neste computador (a sincronização os ignora). */
export const excluidosDoDrive = () => new Set(lerExcluidos().map(x => x.driveFileId).filter(Boolean));
/** ids de documentos excluídos (inclusive os compartilhados comigo, que só somem da lista). */
export const idsExcluidos = () => new Set(lerExcluidos().map(x => String(x.id)));

/** Registra a exclusão: o documento não é mais importado, e o arquivo vai para a lixeira do Drive assim que possível. */
export function registrarExclusoes(docs) {
  const lista = lerExcluidos();
  for (const d of docs || []) {
    if (!d?.id || lista.some(x => String(x.id) === String(d.id))) continue;
    lista.push({ id: String(d.id), driveFileId: d.driveFileId || '', lixeira: !d.driveFileId || Boolean(d.proprietarioExterno), nuvem: !(d.salvoNuvem && !d.proprietarioExterno), em: new Date().toISOString() });
  }
  gravarConta(CHAVE_EXCLUIDOS, JSON.stringify(lista.slice(-500)));
  return lista;
}

/**
 * Leva para a lixeira do Drive (recuperável por 30 dias) os arquivos dos documentos excluídos que ainda estão lá; tenta de novo
 * na próxima sincronização se falhar. Documentos de outras pessoas nunca são mexidos. Devolve quantos foram para a lixeira.
 */
export async function processarExclusoesPendentes(token, { fetchImpl = globalThis.fetch } = {}) {
  const lista = lerExcluidos();
  let n = 0;
  for (const x of lista) {
    if (x.lixeira || !x.driveFileId) continue;
    try {
      await chamar(fetchImpl, `${API}/${encodeURIComponent(x.driveFileId)}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }, token);
      x.lixeira = true; n++;
    } catch (e) {
      if (e.status === 404) x.lixeira = true; // já não existe
      else if (e.sessaoExpirada) break;
    }
  }
  gravarConta(CHAVE_EXCLUIDOS, JSON.stringify(lista));
  return n;
}

/**
 * Documentos que já foram sincronizados com o Drive e deixaram de existir lá (excluídos em OUTRO computador: foram para a
 * lixeira ou apagados). Só entram aqui os documentos do próprio usuário SEM alteração pendente, e cada um é confirmado no
 * Drive (lixeira/404) antes de sair da lista — sumir da listagem sozinho não basta (o arquivo pode ter sido renomeado).
 * Devolve os ids a remover.
 */
export async function docsRemovidosDoDrive(documentos, arquivos, token, { fetchImpl = globalThis.fetch, limite = 25 } = {}) {
  const noDrive = new Set((arquivos || []).map(a => a.driveFileId));
  const candidatos = (documentos || []).filter(d => d.driveFileId && !noDrive.has(d.driveFileId)
    && !d.proprietarioExterno && !d.compartilhadoComigo && d.driveSincronizadoEm && (d.dataModificacao || '') <= d.driveSincronizadoEm).slice(0, limite);
  const removidos = [];
  for (const d of candidatos) {
    try {
      const r = await chamar(fetchImpl, `${API}/${encodeURIComponent(d.driveFileId)}?fields=id,trashed`, {}, token);
      if (r.trashed) removidos.push(d.id);
    } catch (e) {
      if (e.status === 404) removidos.push(d.id);
      else if (e.sessaoExpirada) break; // outro erro: não remove nada por dúvida
    }
  }
  return removidos;
}

// ───────────────────────────── Pastas excluídas ─────────────────────────────

const CHAVE_PASTAS_EXCLUIDAS = 'athenes_pastas_excluidas';
const lerPastasExcluidas = () => { try { const v = JSON.parse(lerConta(CHAVE_PASTAS_EXCLUIDAS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** { idDaPasta: quando } das pastas excluídas neste computador (vai para o servidor, para valer em todos). */
export const pastasExcluidasRegistradas = () => Object.fromEntries(lerPastasExcluidas().filter(x => x && x.id).map(x => [x.id, x.em || new Date().toISOString()]));

/** Registra a exclusão de pastas (a do Drive vai para a lixeira quando estiver vazia; pastas compartilhadas têm lixeira: true e não tocam no Drive). */
export function registrarPastasExcluidas(pastas) {
  const lista = lerPastasExcluidas();
  for (const p of pastas || []) {
    if (!p) continue;
    if (!lista.some(x => (p.id && x.id === p.id) || (p.driveId && x.driveId && x.driveId === p.driveId))) {
      const lixeiraVal = p.lixeira !== undefined ? Boolean(p.lixeira) : !p.driveId;
      lista.push({ id: p.id || '', driveId: p.driveId || '', nome: p.nome || '', lixeira: lixeiraVal, em: new Date().toISOString() });
    }
  }
  gravarConta(CHAVE_PASTAS_EXCLUIDAS, JSON.stringify(lista.slice(-300)));
}

/** Remove uma pasta da lista de excluídas (ex: ao revincular uma pasta compartilhada previamente removida). */
export function removerPastaExcluida(idOuDriveId) {
  if (!idOuDriveId) return;
  const lista = lerPastasExcluidas();
  const filtrada = lista.filter(x => x && x.id !== idOuDriveId && x.driveId !== idOuDriveId);
  if (filtrada.length !== lista.length) {
    gravarConta(CHAVE_PASTAS_EXCLUIDAS, JSON.stringify(filtrada));
  }
}

/**
 * Leva para a lixeira do Drive as pastas excluídas que já estão VAZIAS (os documentos de dentro foram movidos para outra pasta
 * antes). Pasta com arquivo dentro espera a próxima sincronização: nada é perdido. Devolve quantas foram para a lixeira.
 */
export async function processarPastasExcluidas(token, { fetchImpl = globalThis.fetch } = {}) {
  const lista = lerPastasExcluidas();
  let n = 0;
  for (const x of lista) {
    if (x.lixeira || !x.driveId) continue;
    try {
      const q = `trashed = false and '${aspas(x.driveId)}' in parents`;
      const dentro = await chamar(fetchImpl, `${API}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {}, token);
      if (dentro.files?.length) continue; // ainda tem coisa dentro: espera
      await chamar(fetchImpl, `${API}/${encodeURIComponent(x.driveId)}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }, token);
      x.lixeira = true; n++;
    } catch (e) {
      if (e.status === 404) x.lixeira = true;
      else if (e.sessaoExpirada) break;
    }
  }
  gravarConta(CHAVE_PASTAS_EXCLUIDAS, JSON.stringify(lista));
  return n;
}
