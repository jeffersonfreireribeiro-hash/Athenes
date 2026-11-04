// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Leva a conexão do Zotero (chave e User ID) para a CONTA: o servidor do perfil e o arquivo de configuração no Drive.
 * Chamada sempre que a chave muda (evento `athenes:zotero-alterado`, disparado por `gravarConfigZotero`), para os outros
 * computadores e o tablet receberem a mais recente. Vale a configuração mais recente (ver athenes_zotero_config.js).
 * Resultado: { servidor: 'enviou'|'igual'|'aplicou'|'sem_nuvem'|'erro', drive: 'enviou'|'baixou'|'igual'|'nada'|'sem_drive'|'erro', erros[] }.
 */
import { nuvemAutenticada } from './athenes_colaboracao.js';
import { sincronizarPerfil } from './athenes_perfil_servidor.js';
import { montarEstadoLocal } from './athenes_perfil_local.js';
import { listar as listarDocumentos } from './athenes_repositorio.js';
import { obterTokenDrive, sincronizarZoteroComDrive } from './athenes_drive_sync.js';
import { lerConfigZotero, gravarConfigZotero } from './athenes_zotero_config.js';

const padrao = { nuvemAutenticada, sincronizarPerfil, montarEstadoLocal, listarDocumentos, obterTokenDrive, sincronizarZoteroComDrive, lerConfigZotero, gravarConfigZotero };

export async function enviarConexaoZoteroParaConta(deps = {}) {
  const d = { ...padrao, ...deps };
  const r = { servidor: 'sem_nuvem', drive: 'sem_drive', erros: [] };
  if (d.nuvemAutenticada()) {
    try {
      const res = await d.sincronizarPerfil(d.montarEstadoLocal(d.listarDocumentos()));
      if (res?.aplicarZotero) { d.gravarConfigZotero(res.aplicarZotero); r.servidor = 'aplicou'; } // outro computador tinha uma chave mais nova
      else r.servidor = res?.gravou ? 'enviou' : 'igual';
    } catch (e) { r.servidor = 'erro'; r.erros.push(`Servidor: ${e.message}`); }
  }
  try {
    const token = await d.obterTokenDrive();
    if (token) r.drive = await d.sincronizarZoteroComDrive(token);
  } catch (e) { r.drive = 'erro'; r.erros.push(`Drive: ${e.message}`); }
  return r;
}

/** Texto curto para mostrar ao usuário onde a chave ficou guardada. */
export function resumoContaZotero(r) {
  const partes = [];
  partes.push({ enviou: 'conta: guardada ✓', igual: 'conta: já estava igual ✓', aplicou: 'conta: havia uma chave mais nova, aplicada aqui', sem_nuvem: 'conta: entre com o Google para guardar na conta', erro: 'conta: não foi possível enviar' }[r.servidor] || '');
  partes.push({ enviou: 'Drive: guardada ✓', baixou: 'Drive: trouxe a mais nova', igual: 'Drive: já estava igual ✓', nada: 'Drive: nada a enviar', sem_drive: 'Drive: não conectado', erro: 'Drive: não foi possível enviar' }[r.drive] || '');
  return partes.filter(Boolean).join(' · ');
}

let ativo = false; let tempo = null;
/** Liga uma vez: ao mudar a chave, envia para a conta e avisa a tela com `athenes:zotero-conta` (detail = resultado). */
export function ativarEnvioDaConexaoZotero({ janela = globalThis.window, atrasoMs = 800 } = {}) {
  if (ativo || !janela?.addEventListener) return;
  ativo = true;
  janela.addEventListener('athenes:zotero-alterado', () => {
    clearTimeout(tempo);
    tempo = setTimeout(async () => {
      const r = await enviarConexaoZoteroParaConta();
      try { janela.dispatchEvent(new CustomEvent('athenes:zotero-conta', { detail: r })); } catch (_) {}
      if (r.erros.length) console.warn('[Athenes] Conexão do Zotero na conta:', r.erros.join(' | '));
    }, atrasoMs);
  });
}
