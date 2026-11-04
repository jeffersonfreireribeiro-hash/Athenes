// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Conexão do Zotero guardada na conta (chave, User ID). Toda gravação passa por aqui: quando a chave ou o ID mudam,
 * a configuração leva a hora da mudança (`alteradoEm`). O Drive e o servidor do perfil guardam cópias dessa conexão e, na
 * sincronização, VALE A MAIS RECENTE — antes um marcador compartilhado entre os dois fazia a cópia antiga voltar por cima da
 * chave nova.
 */
import { lerConta, gravarConta } from './athenes_conta.js';

export const CHAVE_CONFIG_ZOTERO = 'athenes_zotero_cfg';

export function lerConfigZotero() {
  try { return JSON.parse(lerConta(CHAVE_CONFIG_ZOTERO) || '{}') || {}; } catch (_) { return {}; }
}

/** Grava a conexão (mescla com a atual). Se a chave ou o ID mudaram, marca a hora. Devolve a configuração gravada. */
export function gravarConfigZotero(parcial = {}, agora = () => new Date().toISOString()) {
  const atual = lerConfigZotero();
  const novo = { ...atual };
  for (const [k, v] of Object.entries(parcial)) if (v !== undefined) novo[k] = typeof v === 'string' ? v.trim() : v;
  if (parcial.alteradoEm === undefined && ((novo.apiKey || '') !== (atual.apiKey || '') || (novo.userId || '') !== (atual.userId || ''))) novo.alteradoEm = agora(); // cópia vinda da conta já traz a hora dela
  try { gravarConta(CHAVE_CONFIG_ZOTERO, JSON.stringify(novo)); } catch (_) {}
  // chave ou ID mudaram: a conta (servidor e Drive) precisa saber já, para os outros computadores e o tablet receberem
  if (novo.alteradoEm !== atual.alteradoEm) { try { globalThis.window?.dispatchEvent?.(new Event('athenes:zotero-alterado')); } catch (_) {} }
  return novo;
}

/**
 * Quem vence entre a cópia local e a remota? 'local' | 'remoto' | 'igual'. A hora de mudança decide; sem hora de um dos lados
 * (cópias antigas), vale o aviso de "mudou neste computador desde a última sincronização" (`localMudou`).
 */
export function decidirConfigZotero(local, remoto, { localMudou = false, remotoEm = '' } = {}) {
  const chave = (c) => `${c?.userId || ''}|${c?.apiKey || ''}`;
  if (chave(local) === chave(remoto)) return 'igual';
  const l = local?.alteradoEm || ''; const r = remotoEm || remoto?.alteradoEm || '';
  if (l && r) return l >= r ? 'local' : 'remoto';
  if (l && !r) return 'local';
  return localMudou ? 'local' : 'remoto';
}
