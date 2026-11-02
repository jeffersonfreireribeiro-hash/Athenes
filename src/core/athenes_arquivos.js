// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gestão de arquivos da página inicial: duplicação (deep copy com novos ids e autoria do
 * usuário atual) e movimentação entre pastas, com as regras de permissão. Módulo puro (sem DOM nem
 * rede): o dashboard aplica o resultado de forma otimista e persiste; um servidor pode reutilizar as
 * mesmas funções nos endpoints POST /documents/:id/duplicate e PATCH /documents/:id/move.
 *
 * Modelo: doc.pastaId (pasta), doc.proprietario = { id, nome } (ausente = documento do usuário local),
 * doc.permissao ('leitura' | 'comentario' | 'edicao' | 'admin') quando o documento foi compartilhado.
 * Pastas: { id, nome, tipo, origem: 'minhas' | 'compartilhada', permissao?, subpastas[] }.
 */

export const RAIZ_PADRAO = 'pasta_rel_raiz'; // "Meus Arquivos" da aba de documentos
export const PERMISSOES_ESCRITA = ['edicao', 'admin'];

const novoId = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ───────────────────────────── Árvore de pastas ─────────────────────────────

/** Caminho da raiz até a pasta (lista de pastas) ou [] se não existir. */
export function caminhoDaPasta(pastas, id) {
  const rec = (lista, trilha) => {
    for (const p of lista || []) {
      const t = [...trilha, p];
      if (p.id === id) return t;
      const r = rec(p.subpastas, t);
      if (r) return r;
    }
    return null;
  };
  return rec(pastas, []) || [];
}

export const buscarPasta = (pastas, id) => caminhoDaPasta(pastas, id).at(-1) || null;

/** Pasta onde o documento está (padrão por tipo quando ainda não tem pasta). */
export function pastaIdDoDocumento(doc) {
  return doc?.pastaId || (doc?.tipoDoc === 'artigo' || doc?.tipoDoc === 'relatorio' ? RAIZ_PADRAO : 'pasta_bib_raiz');
}

/** A pasta (ou alguma pasta acima dela) é de origem compartilhada? */
export function pastaCompartilhada(pastas, id) {
  return caminhoDaPasta(pastas, id).some(p => p.origem === 'compartilhada');
}

/** Permissão efetiva do usuário numa pasta: própria = admin; compartilhada = a mais específica definida (padrão leitura). */
export function permissaoNaPasta(pastas, id) {
  const caminho = caminhoDaPasta(pastas, id);
  if (!caminho.length) return null;
  if (!caminho.some(p => p.origem === 'compartilhada')) return 'admin';
  const definida = [...caminho].reverse().find(p => p.permissao);
  return definida?.permissao || 'leitura';
}

export const podeEscreverNaPasta = (pastas, id) => PERMISSOES_ESCRITA.includes(permissaoNaPasta(pastas, id));

/** Pastas onde um documento pode ser guardado (relatórios e pastas gerais; bibliografia fica de fora). */
export function pastaAceitaDocumentos(pasta) {
  return !!pasta && pasta.tipo !== 'bibliografia' && pasta.id !== 'pasta_bib_raiz';
}

// ───────────────────────────── Propriedade e permissão ─────────────────────────────

/** 'proprietario' | 'admin' | 'edicao' | 'comentario' | 'leitura' */
export function papelNoDocumento(doc, perfil, pastas = []) {
  if (!doc) return 'leitura';
  if (doc.proprietario?.id) return doc.proprietario.id === perfil?.id ? 'proprietario' : (doc.permissao || permissaoNaPasta(pastas, pastaIdDoDocumento(doc)) || 'leitura');
  // sem proprietário gravado: é do usuário, a menos que esteja numa pasta que outra pessoa compartilhou
  return pastaCompartilhada(pastas, pastaIdDoDocumento(doc)) && doc.compartilhadoComigo !== false ? (doc.permissao || permissaoNaPasta(pastas, pastaIdDoDocumento(doc)) || 'leitura') : 'proprietario';
}

export const ehProprietario = (doc, perfil, pastas) => papelNoDocumento(doc, perfil, pastas) === 'proprietario';

// ───────────────────────────── Mover ─────────────────────────────

/**
 * Pode mover `doc` para `destinoId` (null = raiz "Meus Arquivos")? Retorna
 * { ok, codigo, motivo, oferecerCopia }. Códigos: compartilhado | destino_inexistente | destino_somente_leitura |
 * destino_incompativel | mesma_pasta.
 */
export function validarMovimento(doc, destinoId, { perfil, pastas }) {
  const destino = destinoId || RAIZ_PADRAO;
  const papel = papelNoDocumento(doc, perfil, pastas);
  // dono, ou quem recebeu permissão de edição/administração, pode mover o original; leitura/comentário não
  if (papel !== 'proprietario' && !PERMISSOES_ESCRITA.includes(papel)) {
    return {
      ok: false, codigo: 'compartilhado', oferecerCopia: true,
      motivo: 'Este arquivo foi compartilhado com você e fica em "Compartilhados comigo". Você pode fazer uma cópia dele para organizar nas suas pastas.'
    };
  }
  const pasta = buscarPasta(pastas, destino);
  if (!pasta) return { ok: false, codigo: 'destino_inexistente', motivo: 'A pasta de destino não existe mais.' };
  if (!pastaAceitaDocumentos(pasta)) return { ok: false, codigo: 'destino_incompativel', motivo: 'Pastas de bibliografia não recebem relatórios ou artigos.' };
  if (!podeEscreverNaPasta(pastas, destino)) return { ok: false, codigo: 'destino_somente_leitura', motivo: 'Você não tem permissão de edição nessa pasta compartilhada.' };
  // permissão de escrita também na pasta de origem (ex.: tirar o arquivo de uma pasta compartilhada)
  const origem = pastaIdDoDocumento(doc);
  if (buscarPasta(pastas, origem) && !podeEscreverNaPasta(pastas, origem)) {
    return { ok: false, codigo: 'origem_somente_leitura', motivo: 'Você não tem permissão para retirar arquivos da pasta de origem.' };
  }
  if (origem === destino) return { ok: false, codigo: 'mesma_pasta', motivo: 'O arquivo já está nessa pasta.' };
  return { ok: true };
}

/** Move (muta o documento) e devolve o estado anterior para o rollback. */
export function moverDocumento(doc, destinoId, ctx) {
  const v = validarMovimento(doc, destinoId, ctx);
  if (!v.ok) return { ...v, anterior: null };
  const anterior = { pastaId: doc.pastaId };
  doc.pastaId = destinoId || RAIZ_PADRAO;
  return { ok: true, anterior };
}

/** Desfaz um movimento a partir do `anterior` devolvido por moverDocumento. */
export function desfazerMovimento(doc, anterior) {
  if (!anterior) return;
  if (anterior.pastaId === undefined) delete doc.pastaId; else doc.pastaId = anterior.pastaId;
}

/** Valida vários de uma vez: { movíveis, bloqueados:[{doc, codigo, motivo, oferecerCopia}] }. */
export function planejarMovimentoEmLote(docs, destinoId, ctx) {
  const moviveis = []; const bloqueados = [];
  for (const d of docs) {
    const v = validarMovimento(d, destinoId, ctx);
    if (v.ok) moviveis.push(d); else bloqueados.push({ doc: d, ...v });
  }
  return { moviveis, bloqueados };
}

/** Pastas que podem receber o documento, com o motivo quando não podem (para a árvore do "Mover para…"). */
export function arvoreDeDestinos(pastas, docs, ctx) {
  const lista = (Array.isArray(docs) ? docs : [docs]);
  const rec = (ps) => ps.filter(p => pastaAceitaDocumentos(p) || (p.subpastas || []).length).map(p => {
    const motivos = lista.map(d => validarMovimento(d, p.id, ctx)).filter(v => !v.ok && v.codigo !== 'mesma_pasta');
    return {
      id: p.id, nome: p.nome, origem: p.origem,
      habilitada: pastaAceitaDocumentos(p) && podeEscreverNaPasta(pastas, p.id) && !motivos.length,
      motivo: motivos[0]?.motivo || (!podeEscreverNaPasta(pastas, p.id) ? 'Somente leitura' : ''),
      subpastas: rec(p.subpastas || [])
    };
  });
  return rec(pastas);
}

// ───────────────────────────── Duplicar ─────────────────────────────

/** "Cópia de X", "Cópia de X (2)"… sem repetir um título já usado na pasta de destino. */
export function tituloDaCopia(titulo, existentes = []) {
  const base = `Cópia de ${String(titulo || 'Documento sem título').replace(/^Cópia de\s+/i, '')}`;
  const usados = new Set(existentes.map(t => String(t).trim().toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) if (!usados.has(`${base} (${n})`.toLowerCase())) return `${base} (${n})`;
  return `${base} (${Date.now()})`;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cópia profunda com identificadores novos: seções, blocos, notas e sugestões ganham ids novos e todas as
 * referências (marcadores de nota, referências cruzadas, sugestões) são reescritas — a cópia nunca colide
 * com o original. Retorna { doc, mapaIds }.
 */
export function clonarComNovosIds(doc) {
  const mapa = new Map();
  const marca = (obj, prefixo) => { if (obj?.id !== undefined && obj.id !== null && !mapa.has(String(obj.id))) mapa.set(String(obj.id), novoId(prefixo)); };
  marca(doc, 'doc');
  (doc.secoes || []).forEach(s => { marca(s, 'sec'); (s.blocos || []).forEach(b => marca(b, 'bloco')); });
  (doc.notasRodape || []).forEach(n => marca(n, 'nota'));
  (doc.sugestoes || []).forEach(x => marca(x, 'sug'));
  let json = JSON.stringify(doc);
  // do maior para o menor: um id nunca é prefixo do outro na substituição
  for (const antigo of [...mapa.keys()].sort((a, b) => b.length - a.length)) {
    json = json.replace(new RegExp(`(?<![A-Za-z0-9_])${escRe(antigo)}(?![A-Za-z0-9_])`, 'g'), mapa.get(antigo));
  }
  return { doc: JSON.parse(json), mapaIds: mapa };
}

/**
 * Duplica um documento (próprio ou compartilhado). A cópia pertence ao usuário atual e fica
 * desconectada do original (sem nuvem, sem colaboradores, sem permissão herdada).
 * ctx: { perfil, pastas, documentos (para evitar títulos repetidos), pastaAtivaId, agora }
 */
export function duplicarDocumento(doc, ctx) {
  if (!doc) throw new Error('Documento inválido para duplicação.');
  if (doc.precisaCarregarConteudo) throw new Error('O conteúdo do documento ainda não foi baixado da nuvem.');
  const { perfil, pastas = [], documentos = [], pastaAtivaId = null } = ctx;
  const papel = papelNoDocumento(doc, perfil, pastas);
  const compartilhado = papel !== 'proprietario';

  // destino: própria → mesma pasta; compartilhada → pasta ativa (se puder escrever) ou "Meus Arquivos"
  const candidatos = compartilhado ? [pastaAtivaId, RAIZ_PADRAO] : [pastaIdDoDocumento(doc), RAIZ_PADRAO];
  const pastaDestinoId = candidatos.find(id => id && pastaAceitaDocumentos(buscarPasta(pastas, id)) && podeEscreverNaPasta(pastas, id)) || RAIZ_PADRAO;

  const { doc: copia, mapaIds } = clonarComNovosIds(doc);
  const agora = ctx.agora || new Date().toISOString();
  const irmaos = documentos.filter(d => pastaIdDoDocumento(d) === pastaDestinoId).map(d => d.titulo);
  copia.titulo = tituloDaCopia(doc.titulo, irmaos);
  copia.pastaId = pastaDestinoId;
  copia.proprietario = { id: perfil?.id, nome: perfil?.nome };
  copia.dataCriacao = agora; copia.dataModificacao = agora;
  copia.estado = 'rascunho';
  copia.copiadoDe = { id: doc.id, titulo: doc.titulo, em: agora }; // só memória: não há vínculo de sincronização
  // desconexão do original e de qualquer compartilhamento
  for (const k of ['permissao', 'compartilhadoComigo', 'compartilhadoCom', 'colaboradores', 'linkCompartilhamento', 'precisaCarregarConteudo', 'salvoNuvem', 'paginas']) delete copia[k];
  copia.salvoNuvem = false;
  return { doc: copia, mapaIds, compartilhado, pastaDestinoId };
}

/** Duplica vários, garantindo títulos distintos entre si. */
export function duplicarEmLote(docs, ctx) {
  const resultado = []; const documentos = [...(ctx.documentos || [])];
  for (const d of docs) {
    const r = duplicarDocumento(d, { ...ctx, documentos });
    documentos.push(r.doc);
    resultado.push(r);
  }
  return resultado;
}

export const copiaProfunda = clone;
