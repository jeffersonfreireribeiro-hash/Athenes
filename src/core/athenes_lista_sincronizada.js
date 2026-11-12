// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Lista sincronizada com o servidor (fábrica).
 *
 * Uma lista de itens com `id` que vive na MEMÓRIA da sessão e tem o servidor como fonte da verdade (registro protegido do
 * perfil). Usada pela biblioteca de artigos e pelos modelos (templates) do usuário. Nada vai para o armazenamento do navegador:
 * o que versões antigas deixaram lá é lido uma vez, enviado ao servidor e só então apagado daqui.
 * Mesclagem por item: o mais recente (`atualizadoEm`) vence; exclusão vale em todos, salvo se houve edição depois dela.
 */
import { lerConta, removerConta, obterContaAtiva } from './athenes_conta.js';
import { nuvemAutenticada } from './athenes_colaboracao.js';
import { sincronizarDado } from './athenes_dados_servidor.js';

const canon = (o) => JSON.stringify(o, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)); // o banco reordena as chaves

function fichamentoTemDados(f) {
  if (!f || typeof f !== 'object') return false;
  if (String(f.resumoPessoal || '').trim() || String(f.metodologiaNotas || '').trim()) return true;
  if (Array.isArray(f.citacoesMarcadas) && f.citacoesMarcadas.length > 0) return true;
  for (const k of ['tracosPorPagina', 'notasPagina', 'grifosPorPagina']) {
    const mapa = f[k];
    if (mapa && typeof mapa === 'object' && Object.values(mapa).some(arr => Array.isArray(arr) && arr.length > 0)) return true;
  }
  return false;
}

function enriquecerItemMesclado(vencedor, outro) {
  if (!vencedor || !outro) return vencedor;
  const fVenc = vencedor.fichamento;
  const fOut = outro.fichamento;
  let copia = vencedor;
  const clonar = () => { if (copia === vencedor) copia = { ...vencedor }; return copia; };
  if ((outro.ultimoAcessoEm || '') > (vencedor.ultimoAcessoEm || '')) clonar().ultimoAcessoEm = outro.ultimoAcessoEm;
  if (!fichamentoTemDados(fVenc) && fichamentoTemDados(fOut) && !fVenc?.atualizadoEm) {
    clonar().fichamento = fOut;
  } else if (fVenc && fOut && (fOut.atualizadoEm || '') > (fVenc.atualizadoEm || '')) {
    clonar().fichamento = fOut;
  }
  if ((!copia.driveFileId || /^drive_pdf_/.test(String(copia.driveFileId))) && outro.driveFileId && !/^drive_pdf_/.test(String(outro.driveFileId))) {
    clonar().driveFileId = outro.driveFileId;
    if (outro.driveFileName) clonar().driveFileName = outro.driveFileName;
    if (outro.driveStatus) clonar().driveStatus = outro.driveStatus;
  }
  if (!copia.notaZoteroKey && outro.notaZoteroKey) clonar().notaZoteroKey = outro.notaZoteroKey;
  if (!copia.docCompartilhadoId && outro.docCompartilhadoId) clonar().docCompartilhadoId = outro.docCompartilhadoId;
  return copia;
}

/**
 * Junta o servidor com o local. Cada lado: { itens[], excluidos{ id: quando } }.
 */
export function mesclarLista(servidor, local) {
  const srv = servidor ? { ...servidor, itens: servidor.itens || servidor.artigos || [] } : { itens: [], excluidos: {} }; // aceita o formato { artigos } da primeira versão
  const excluidos = { ...(srv.excluidos || {}), ...(local.excluidos || {}) };
  const porId = new Map();
  for (const a of [...(srv.itens || []), ...(local.itens || [])]) {
    if (!a?.id) continue;
    const idStr = String(a.id);
    const atual = porId.get(idStr);
    if (!atual) {
      porId.set(idStr, a);
    } else if ((a.atualizadoEm || '') > (atual.atualizadoEm || '')) {
      porId.set(idStr, enriquecerItemMesclado(a, atual));
    } else {
      porId.set(idStr, enriquecerItemMesclado(atual, a));
    }
  }
  for (const [id, a] of [...porId]) {
    const quando = excluidos[id];
    if (!quando) continue;
    if ((a.atualizadoEm || '') > quando) delete excluidos[id]; // editado depois de excluído: a edição vence
    else porId.delete(id);
  }
  const itens = [...porId.values()];
  const resumo = (x) => canon({ a: [...(x.itens || [])].sort((m, n) => String(m.id).localeCompare(String(n.id))), e: x.excluidos || {} });
  const valor = { itens, excluidos };
  return { valor, mudouServidor: !servidor || resumo(servidor) !== resumo(valor) };
}

/**
 * Cria uma lista sincronizada.
 *  - chave: nome do dado no servidor
 *  - legados: chaves de armazenamento do navegador (por conta) de versões antigas, lidas uma vez e apagadas depois de enviadas
 *  - efemeros: campos só desta sessão (não vão ao servidor)
 *  - filtroLegado(item): true para itens antigos que NÃO devem subir (ex.: exemplos fictícios)
 *  - atrasoEnvioMs: espera depois da última alteração antes de enviar
 */
export function criarListaSincronizada({ chave, legados = [], efemeros = [], filtroLegado = () => false, atrasoEnvioMs = 1500 }) {
  const memoria = { conta: undefined, itens: [], excluidos: {}, assin: new Map(), legadoLido: false, ouvintes: new Set(), emCurso: false, promessaEmCurso: null, temporizador: null };
  let filtro = filtroLegado;

  const semEfemeros = (a) => { const r = { ...a }; efemeros.forEach(k => delete r[k]); return r; };
  const assinatura = (a) => { const r = semEfemeros(a); delete r.atualizadoEm; return JSON.stringify(r); };

  function garantirConta() {
    const conta = obterContaAtiva?.() || '';
    if (memoria.conta !== conta) { clearTimeout(memoria.temporizador); Object.assign(memoria, { conta, itens: [], excluidos: {}, assin: new Map(), legadoLido: false, temporizador: null, promessaEmCurso: null }); }
  }

  function lerLegado() {
    for (const k of legados) {
      try { const v = JSON.parse(lerConta(k) || 'null'); if (Array.isArray(v) && v.length) return v; } catch (_) {}
    }
    return [];
  }

  function obter() {
    garantirConta();
    if (!memoria.legadoLido) {
      memoria.legadoLido = true;
      const antigos = lerLegado();
      if (antigos.length && !memoria.itens.length) {
        for (const a of antigos) { if (a && !filtro(a)) { efemeros.forEach(k => { a[k] = null; }); memoria.itens.push(a); memoria.assin.set(String(a.id), assinatura(a)); } }
      }
    }
    return memoria.itens;
  }

  function definir(lista) {
    garantirConta();
    if (!Array.isArray(lista)) return lista;
    const agora = new Date().toISOString();
    const ids = new Set();
    for (const a of lista) {
      if (!a?.id) continue;
      ids.add(String(a.id));
      const sig = assinatura(a);
      if (memoria.assin.get(String(a.id)) !== sig) { a.atualizadoEm = agora; memoria.assin.set(String(a.id), sig); }
    }
    for (const id of [...memoria.assin.keys()]) if (!ids.has(id)) { memoria.excluidos[id] = agora; memoria.assin.delete(id); }
    if (memoria.itens !== lista) { memoria.itens.length = 0; memoria.itens.push(...lista); }
    agendarEnvio();
    return lista;
  }

  function agendarEnvio() {
    clearTimeout(memoria.temporizador);
    memoria.temporizador = setTimeout(() => { memoria.temporizador = null; sincronizar().catch(e => console.warn(`[Athenes] "${chave}" no servidor:`, e.message)); }, atrasoEnvioMs);
  }

  /** Sincroniza com o servidor. Devolve { mudou } ou null sem a nuvem confirmada (nesse caso nada é apagado do navegador). */
  async function sincronizar({ fetchImpl = globalThis.fetch } = {}) {
    garantirConta();
    const contaDaOperacao = memoria.conta;
    obter();
    if (!nuvemAutenticada()) return null;
    if (memoria.promessaEmCurso) {
      try { await memoria.promessaEmCurso; } catch (_) {}
      if (!nuvemAutenticada()) return null;
    }
    clearTimeout(memoria.temporizador);
    memoria.temporizador = null;
    memoria.emCurso = true;
    const executar = async () => {
      try {
        const local = { itens: memoria.itens.map(semEfemeros), excluidos: { ...memoria.excluidos } };
        const sigEnviada = new Map(memoria.itens.map(a => [String(a.id), assinatura(a)]));
        const r = await sincronizarDado(chave, local, mesclarLista, { fetchImpl });
        if (obterContaAtiva() !== contaDaOperacao) return null;
        let mudou = false;
        let mudouDuranteEnvio = false;
        const atuais = new Map(memoria.itens.map(a => [String(a.id), a]));
        const resultado = [];
        for (const n of r.valor.itens) {
          const idStr = String(n.id);
          const atual = atuais.get(idStr);
          if (atual && sigEnviada.has(idStr) && assinatura(atual) !== sigEnviada.get(idStr)) {
            atual.atualizadoEm = new Date().toISOString();
            resultado.push(atual);
            mudouDuranteEnvio = true;
            continue;
          }
          if (atual && assinatura(atual) === assinatura(n) && (atual.atualizadoEm || '') >= (n.atualizadoEm || '')) { resultado.push(atual); continue; } // igual: mantém o objeto (e o que é só desta sessão)
          mudou = true;
          const extras = Object.fromEntries(efemeros.map(k => [k, atual?.[k] ?? null]));
          if (atual) {
            for (const k of Object.keys(atual)) { if (!efemeros.includes(k)) delete atual[k]; }
            Object.assign(atual, n, extras);
            resultado.push(atual);
          } else {
            resultado.push({ ...n, ...extras });
          }
        }
        for (const [idStr, atual] of atuais) {
          if (!sigEnviada.has(idStr) && !resultado.some(x => String(x.id) === idStr)) {
            atual.atualizadoEm = new Date().toISOString();
            resultado.push(atual);
            mudouDuranteEnvio = true;
          }
        }
        if (resultado.length !== memoria.itens.length) mudou = true;
        memoria.itens.splice(0, memoria.itens.length, ...resultado);
        memoria.excluidos = r.valor.excluidos || {};
        memoria.assin = new Map(resultado.map(a => [String(a.id), assinatura(a)]));
        legados.forEach(k => removerConta(k)); // a cópia antiga do navegador sai: o servidor já tem tudo
        if (mudou) memoria.ouvintes.forEach(cb => { try { cb(memoria.itens); } catch (_) {} });
        if (mudouDuranteEnvio) agendarEnvio();
        return { mudou };
      } finally {
        memoria.emCurso = false;
        memoria.promessaEmCurso = null;
      }
    };
    memoria.promessaEmCurso = executar();
    return memoria.promessaEmCurso;
  }

  return {
    obter, definir, sincronizar,
    aoMudar(cb) { memoria.ouvintes.add(cb); return () => memoria.ouvintes.delete(cb); },
    definirFiltroLegado(fn) { filtro = fn; },
    legadoPendente: () => lerLegado().length > 0,
    temEnvioPendente: () => Boolean(memoria.temporizador) || memoria.emCurso,
    reiniciar() { clearTimeout(memoria.temporizador); Object.assign(memoria, { conta: undefined, itens: [], excluidos: {}, assin: new Map(), legadoLido: false, temporizador: null, emCurso: false, promessaEmCurso: null }); }
  };
}
