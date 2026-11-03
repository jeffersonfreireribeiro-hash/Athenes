// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Dados por conta: cada conta (Google ou identificação acadêmica) tem o próprio espaço no armazenamento do navegador.
 * Antes, documentos, pastas, templates, artigos, Zotero e o token do Drive eram globais do navegador, e qualquer conta via os mesmos arquivos.
 *
 * - `contaDoPerfil(perfil)`: identificador estável — e-mail Google, e-mail informado ou, sem e-mail, o nome normalizado.
 * - `lerConta/gravarConta/removerConta(base)`: leem/gravam a chave `base::conta` (sem conta ativa, a chave pura: modo anônimo/testes).
 * - Migração: os dados antigos (sem conta) passam, uma única vez, para a PRIMEIRA conta que entrar depois desta atualização.
 */

/** Chaves cujo conteúdo pertence à conta. (Perfil e sessão ficam fora: dizem QUEM está conectado.) */
export const CHAVES_POR_CONTA = Object.freeze([
  'athenes_docs_indice', 'athenes_pastas_drive_v1', 'athenes_templates_usuario', 'athenes_artigos_estudo',
  'athenes_estudo_artigos', 'athenes_estudo_artigos_v1', 'athenes_zotero_cfg', 'athenes_gdrive_config'
]);

const CHAVE_CONTA_ATIVA = 'athenes_conta_ativa';
const CHAVE_CONTAS = 'athenes_contas';
const CHAVE_LEGADO = 'athenes_legado_reivindicado';

const armazenamento = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Identificador da conta do perfil (vazio quando o perfil não tem como ser identificado). */
export function contaDoPerfil(p) {
  if (!p || typeof p !== 'object') return '';
  const email = String(p.email || '').trim().toLowerCase();
  if (email) return `${p.autenticadoGoogle ? 'g' : 'e'}:${email}`;
  const nome = semAcento(p.nome);
  return nome ? `n:${nome}` : '';
}

let contaAtiva = null; // null = ainda não resolvida (lê do armazenamento)

export function obterContaAtiva() {
  if (contaAtiva !== null) return contaAtiva;
  try { return armazenamento()?.getItem(CHAVE_CONTA_ATIVA) || ''; } catch { return ''; }
}

export const chaveConta = (base) => { const c = obterContaAtiva(); return c ? `${base}::${c}` : base; };

export function lerConta(base) { try { return armazenamento()?.getItem(chaveConta(base)) ?? null; } catch { return null; } }
export function gravarConta(base, valor) { armazenamento()?.setItem(chaveConta(base), valor); }
export function removerConta(base) { try { armazenamento()?.removeItem(chaveConta(base)); } catch { /* sem armazenamento */ } }

const lerLista = (st) => { try { const v = JSON.parse(st.getItem(CHAVE_CONTAS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** A conta ativa é a primeira que usou este navegador? (só ela recebe os documentos de exemplo) */
export function contaEhPrimeira() {
  const st = armazenamento(); const c = obterContaAtiva();
  return !!st && !!c && lerLista(st)[0] === c;
}

/**
 * Passa a conta do perfil a ser a ativa. Registra a conta e, na primeira vez após a atualização, reivindica os dados antigos.
 * Devolve o identificador (vazio = sem conta identificável: usa o espaço comum).
 */
export function definirContaAtiva(perfil) {
  // a conta fica gravada no perfil: editar o nome depois não leva os documentos embora (o login zera `perfil.conta` para recalcular)
  const nova = perfil?.conta || contaDoPerfil(perfil);
  if (perfil && typeof perfil === 'object') perfil.conta = nova;
  contaAtiva = nova;
  const st = armazenamento();
  if (!st) return nova;
  try {
    if (nova) {
      st.setItem(CHAVE_CONTA_ATIVA, nova);
      const lista = lerLista(st);
      if (!lista.includes(nova)) st.setItem(CHAVE_CONTAS, JSON.stringify([...lista, nova]));
      reivindicarLegado(st, nova);
    } else st.removeItem(CHAVE_CONTA_ATIVA);
  } catch { /* cota cheia ou armazenamento bloqueado: segue sem registrar */ }
  return nova;
}

/** Ao sair: volta ao espaço comum (a tela de login não mostra dados de ninguém). */
export function limparContaAtiva() {
  contaAtiva = '';
  try { armazenamento()?.removeItem(CHAVE_CONTA_ATIVA); } catch { /* ignora */ }
}

/** Move os dados antigos (chaves sem conta) para a primeira conta que entrar; as demais começam vazias. */
function reivindicarLegado(st, conta) {
  if (st.getItem(CHAVE_LEGADO)) return;
  for (const base of CHAVES_POR_CONTA) {
    const antigo = st.getItem(base);
    if (antigo === null) continue;
    const destino = `${base}::${conta}`;
    if (st.getItem(destino) === null) st.setItem(destino, antigo);
    st.removeItem(base); // não duplica no armazenamento (os dados chegam a vários MB)
  }
  st.setItem(CHAVE_LEGADO, conta);
}

/** Só para testes: esquece a conta em memória. */
export function _reiniciarContaEmMemoria() { contaAtiva = null; }
