// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estado deste computador que o índice do perfil no servidor precisa conhecer (documentos, pastas, exclusões,
 * ids das pastas do Drive e conexão do Zotero). Usado pelo painel inicial e pelo editor (que envia logo depois de gravar no Drive).
 */
import { lerConta } from './athenes_conta.js';
import { obterConfigGoogleDrive, obterPastasDriveLocais } from './athenes_colaboracao.js';
import { exclusoesRegistradas, pastasExcluidasRegistradas } from './athenes_drive_sync.js';

const chaveZotero = (c) => `${c?.userId || ''}|${c?.apiKey || ''}|${c?.username || ''}|${c?.isGroup ? 1 : 0}`;
const lerJson = (k) => { try { return JSON.parse(lerConta(k) || '{}') || {}; } catch { return {}; } };

/** Conexão do Zotero deste computador e se mudou desde a última sincronização com o servidor. */
export function zoteroLocalParaPerfil() {
  const cfg = lerJson('athenes_zotero_cfg');
  const marca = lerJson('athenes_zotero_sync');
  return { cfg, mudou: !marca.hash || chaveZotero(cfg) !== marca.hash };
}

export const chaveDoZotero = chaveZotero;

/** Tudo o que `sincronizarPerfil` precisa deste computador. */
export function montarEstadoLocal(documentos) {
  const d = obterConfigGoogleDrive();
  const excluidos = {};
  for (const x of exclusoesRegistradas()) excluidos[x.driveFileId ? `f:${x.driveFileId}` : `i:${x.id}`] = x.em;
  return {
    pastas: obterPastasDriveLocais(), documentos, excluidos, pastasExcluidas: pastasExcluidasRegistradas(),
    drive: { pastaRaizId: d.pastaRaizId || '', pastaDocumentosId: d.pastaDocumentosId || '', pastaZoteroId: d.pastaZoteroId || '', pastaRelatoriosId: d.pastaRelatoriosId || '' },
    zotero: zoteroLocalParaPerfil()
  };
}
