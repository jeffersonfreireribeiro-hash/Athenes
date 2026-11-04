// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Navegar por TODAS as pastas do Google Drive para escolher um PDF e COPIÁ-LO para a pasta do Athenes.
 * O acesso normal do app (`drive.file`) só enxerga o que o próprio Athenes criou; para navegar pelo resto é preciso o escopo de
 * leitura (`drive.readonly`), pedido só quando a pessoa abre este seletor. A cópia é feita baixando o PDF (leitura) e enviando
 * como arquivo novo do Athenes (`drive.file`): o original fica onde está, intacto.
 */
import { GOOGLE_AUTH_ESCOPOS, salvarArquivoNoGoogleDrive } from './athenes_colaboracao.js';
import { obterPastaRaizDrive, buscarOuCriarPasta } from './athenes_drive_sync.js';

export const ESCOPO_LEITURA_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';
export const ESCOPOS_COM_LEITURA = `${GOOGLE_AUTH_ESCOPOS} ${ESCOPO_LEITURA_DRIVE}`;
export const MIME_PASTA_DRIVE = 'application/vnd.google-apps.folder';

const aspas = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const SO_PASTAS_E_PDFS = `(mimeType = '${MIME_PASTA_DRIVE}' or mimeType = 'application/pdf' or name contains '.pdf')`;

/** Monta a consulta da API do Drive: conteúdo de uma pasta, busca por nome em todo o Drive ou itens compartilhados comigo. */
export function consultaDoDrive({ pastaId = 'root', busca = '', compartilhados = false } = {}) {
  if (busca.trim()) return `trashed = false and name contains '${aspas(busca.trim())}' and ${SO_PASTAS_E_PDFS}`;
  if (compartilhados) return `trashed = false and sharedWithMe = true and ${SO_PASTAS_E_PDFS}`;
  return `trashed = false and '${aspas(pastaId || 'root')}' in parents and ${SO_PASTAS_E_PDFS}`;
}

/**
 * Lista pastas e PDFs. Devolve { pastas[], pdfs[], proximo }. Em falha lança Error com `.status` (403 = falta o escopo de leitura,
 * 401 = token vencido) e `.semPermissao` para a tela oferecer "Permitir acesso de leitura".
 */
export async function listarConteudoDoDrive(token, opcoes = {}, fetchImpl = globalThis.fetch) {
  if (!token) throw Object.assign(new Error('Conecte o Google Drive.'), { status: 401, semPermissao: true });
  const params = new URLSearchParams({
    q: consultaDoDrive(opcoes), pageSize: '100', orderBy: 'folder,name_natural', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)'
  });
  if (opcoes.pageToken) params.set('pageToken', opcoes.pageToken);
  const resp = await fetchImpl(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const e = new Error(resp.status === 403 || resp.status === 401 ? 'O Athenes ainda não tem permissão para ler as pastas do seu Drive.' : `O Google Drive respondeu ${resp.status}.`);
    e.status = resp.status; e.semPermissao = resp.status === 403 || resp.status === 401;
    throw e;
  }
  const dados = await resp.json();
  const arquivos = dados.files || [];
  return {
    pastas: arquivos.filter(a => a.mimeType === MIME_PASTA_DRIVE),
    pdfs: arquivos.filter(a => a.mimeType !== MIME_PASTA_DRIVE),
    proximo: dados.nextPageToken || ''
  };
}

/** Baixa o conteúdo de um arquivo como Blob (a função geral do app devolve JSON, serve para configuração e não para PDF). */
export async function baixarBlobDoDrive(fileId, token, fetchImpl = globalThis.fetch) {
  const resp = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(resp.status === 403 || resp.status === 404 ? 'O Drive não deixou ler este arquivo (sem permissão ou ele foi movido).' : `Erro ao baixar o PDF do Drive (${resp.status}).`);
  const blob = await resp.blob();
  if (!blob.size) throw new Error('O arquivo veio vazio.');
  return blob;
}

/**
 * Copia o PDF escolhido para a pasta do Athenes no Drive (Athenes/<pastaNome>). Se um arquivo de mesmo nome e tamanho já estiver
 * lá (cópia anterior), reaproveita em vez de duplicar. Devolve { id, name, blob, jaExistia }.
 */
export async function copiarPdfDoDriveParaAthenes(token, arquivo, { pastaNome = 'Bibliografia_PDFs', fetchImpl = globalThis.fetch } = {}) {
  if (!arquivo?.id) throw new Error('Escolha um PDF.');
  const blob = await baixarBlobDoDrive(arquivo.id, token, fetchImpl);
  const raizId = await obterPastaRaizDrive(token, fetchImpl);
  const { id: pastaId } = await buscarOuCriarPasta(token, pastaNome, raizId, fetchImpl);
  const nome = /\.pdf$/i.test(arquivo.name || '') ? arquivo.name : `${arquivo.name || 'arquivo'}.pdf`;
  const q = `trashed = false and name = '${aspas(nome)}' and '${aspas(pastaId)}' in parents`;
  const existente = await fetchImpl(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: 'files(id,name,size)', pageSize: '5' })}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => (r.ok ? r.json() : { files: [] })).then(d => (d.files || []).find(f => !f.size || Number(f.size) === blob.size)).catch(() => null);
  if (existente) return { id: existente.id, name: existente.name, blob, jaExistia: true };
  const salvo = await salvarArquivoNoGoogleDrive({ nomeArquivo: nome, conteudoBlobOuTexto: blob, mimeType: 'application/pdf', accessToken: token, pastaId }, fetchImpl);
  return { id: salvo.id, name: salvo.name || nome, blob, jaExistia: false };
}
