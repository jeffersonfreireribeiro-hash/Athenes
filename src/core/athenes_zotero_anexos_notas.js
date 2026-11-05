// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Anexos PDF, notas e anotações de PDF do Zotero (itens filhos).
 * Funções puras: organizam os itens filhos devolvidos pela API e os aplicam ao artigo do estúdio
 * sem duplicar a cada sincronização e sem sobrescrever o que o usuário escreveu no Athenes.
 */

/** Quais anexos têm arquivo guardado no Zotero (baixável) — linked_file/linked_url são só um caminho no computador do usuário. */
export function anexoPdfBaixavel(data) {
  return data?.linkMode === 'imported_file' || data?.linkMode === 'imported_url';
}

export function codificarMetadadosNotaZotero(obj) {
  try {
    const json = JSON.stringify(obj);
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
    if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64');
  } catch (_) {}
  return '';
}

export function decodificarMetadadosNotaZotero(html) {
  try {
    const m = /<!--ATHENES_FICHAMENTO_B64:([A-Za-z0-9+/=]+)-->/.exec(String(html || ''));
    if (!m?.[1]) return null;
    let json = '';
    if (typeof atob === 'function') json = decodeURIComponent(escape(atob(m[1])));
    else if (typeof Buffer !== 'undefined') json = Buffer.from(m[1], 'base64').toString('utf8');
    return json ? JSON.parse(json) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Recebe os itens brutos (anexos, notas, anotações) e devolve, por item pai:
 *  - anexos: Map<chavePai, { chave, nomeArquivo, baixavel, linkMode }> (o melhor PDF: importado antes de vinculado)
 *  - notas: Map<chavePai, [{ chave, html, data }]>
 *  - anotacoes: Map<chavePai, [{ chave, texto, comentario, cor, pagina, rotuloPagina, data }]>
 */
export function organizarFilhosZotero(itensBrutos) {
  const anexos = new Map();
  const notas = new Map();
  const anotacoes = new Map();
  const paiDoAnexo = new Map(); // chave do anexo PDF -> chave do pai (para ligar as anotações)
  const lista = Array.isArray(itensBrutos) ? itensBrutos : [];

  for (const it of lista) {
    const d = it?.data;
    if (!d || d.itemType !== 'attachment' || !d.parentItem) continue;
    if (!/pdf/i.test(String(d.contentType || ''))) continue;
    const chave = it.key || d.key;
    paiDoAnexo.set(chave, d.parentItem);
    const novo = { chave, nomeArquivo: d.filename || d.title || `${chave}.pdf`, baixavel: anexoPdfBaixavel(d), linkMode: d.linkMode || '', caminho: String(d.path || '') };
    const atual = anexos.get(d.parentItem);
    if (!atual || (novo.baixavel && !atual.baixavel)) anexos.set(d.parentItem, novo);
  }

  for (const it of lista) {
    const d = it?.data;
    if (!d || !d.parentItem) continue;
    const chave = it.key || d.key;
    if (d.itemType === 'note') {
      const arr = notas.get(d.parentItem) || [];
      arr.push({ chave, html: String(d.note || ''), data: d.dateModified || d.dateAdded || '' });
      notas.set(d.parentItem, arr);
    } else if (d.itemType === 'annotation') {
      const pai = paiDoAnexo.get(d.parentItem);
      if (!pai) continue; // anotação de anexo que não é PDF conhecido / de outro item
      const rotulo = String(d.annotationPageLabel || '').trim();
      const arr = anotacoes.get(pai) || [];
      arr.push({
        chave, texto: String(d.annotationText || '').trim(), comentario: String(d.annotationComment || '').trim(),
        cor: d.annotationColor || '', pagina: parseInt(rotulo, 10) || 1, rotuloPagina: rotulo, data: d.dateModified || d.dateAdded || ''
      });
      anotacoes.set(pai, arr);
    }
  }
  return { anexos, notas, anotacoes };
}

/**
 * Onde está o PDF vinculado (arquivo só no computador do usuário). A API do Zotero entrega o caminho gravado no anexo:
 * absoluto ("C:\Users\...\arq.pdf", "/home/...") ou relativo ao diretório-base dos anexos vinculados ("attachments:pasta/arq.pdf"),
 * cujo local só o Zotero Desktop conhece. Devolve { pasta, arquivo, completo, relativo } ou null quando não há caminho.
 */
export function localDoPdfVinculado(anexo) {
  const bruto = String(anexo?.caminho || '').trim();
  if (!bruto) return null;
  const relativo = /^attachments:/i.test(bruto);
  const completo = bruto.replace(/^(attachments|storage):/i, '');
  const corte = Math.max(completo.lastIndexOf('/'), completo.lastIndexOf('\\'));
  const pasta = corte >= 0 ? completo.slice(0, corte) : '';
  const arquivo = corte >= 0 ? completo.slice(corte + 1) : completo;
  return { pasta, arquivo, completo, relativo };
}

/** Texto simples de uma nota HTML (para a cópia e para decidir se está vazia). */
export function textoDeNotaHtml(html) {
  return String(html || '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function mapaDeListasTemItens(m) {
  return Boolean(m && typeof m === 'object' && Object.values(m).some(arr => Array.isArray(arr) && arr.length > 0));
}

/**
 * Aplica ao artigo: selo do PDF, notas do Zotero (somente leitura, substituídas a cada sincronização) e anotações
 * de PDF com texto como citações marcadas (id estável `zot_ann_<chave>`; as já existentes não são tocadas).
 * Também restaura o fichamento salvo na nota espelho "Fichamento Athenes" caso o artigo local ainda esteja vazio.
 * Devolve quantas citações novas entraram.
 */
export function aplicarFilhosZoteroAoArtigo(art, chavePai, { anexos, notas, anotacoes }) {
  if (!art || !chavePai) return 0;
  art.anexoPdfZotero = anexos.get(chavePai) || null;
  const f = art.fichamento || (art.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {}, grifosPorPagina: {} });
  if (!Array.isArray(f.citacoesMarcadas)) f.citacoesMarcadas = [];
  if (!f.notasPagina || typeof f.notasPagina !== 'object') f.notasPagina = {};
  if (!f.tracosPorPagina || typeof f.tracosPorPagina !== 'object') f.tracosPorPagina = {};
  if (!f.grifosPorPagina || typeof f.grifosPorPagina !== 'object') f.grifosPorPagina = {};

  const notasBrutas = notas.get(chavePai) || [];
  const notasExternas = [];
  for (const n of notasBrutas) {
    const html = String(n.html || '');
    const ehNotaAthenes = /<h2>\s*Fichamento Athenes/i.test(html) || /<!--ATHENES_FICHAMENTO_B64:/.test(html);
    if (ehNotaAthenes) {
      if (!art.notaZoteroKey) art.notaZoteroKey = n.chave;
      const meta = decodificarMetadadosNotaZotero(html);
      if (meta && typeof meta === 'object') {
        if ((!art.driveFileId || /^drive_pdf_/.test(String(art.driveFileId))) && meta.driveFileId && !/^drive_pdf_/.test(String(meta.driveFileId))) {
          art.driveFileId = meta.driveFileId;
          if (meta.driveFileName) art.driveFileName = meta.driveFileName;
          art.driveStatus = 'PDF no Google Drive';
        }
        if (!art.docCompartilhadoId && meta.docCompartilhadoId) art.docCompartilhadoId = meta.docCompartilhadoId;
        const mf = meta.fichamento;
        if (mf && typeof mf === 'object') {
          const remotoMaisNovo = (mf.atualizadoEm || '') > (f.atualizadoEm || '');
          if (!f.resumoPessoal && mf.resumoPessoal) f.resumoPessoal = mf.resumoPessoal;
          if (!f.metodologiaNotas && mf.metodologiaNotas) f.metodologiaNotas = mf.metodologiaNotas;
          if (Array.isArray(mf.citacoesMarcadas) && mf.citacoesMarcadas.length > 0) {
            const idsAtuais = new Set(f.citacoesMarcadas.map(c => c.id));
            for (const c of mf.citacoesMarcadas) {
              if (c?.id && !idsAtuais.has(c.id)) { f.citacoesMarcadas.push(c); idsAtuais.add(c.id); }
            }
          }
          if ((!mapaDeListasTemItens(f.tracosPorPagina) || remotoMaisNovo) && mapaDeListasTemItens(mf.tracosPorPagina)) {
            f.tracosPorPagina = mf.tracosPorPagina;
          }
          if ((!mapaDeListasTemItens(f.notasPagina) || remotoMaisNovo) && mapaDeListasTemItens(mf.notasPagina)) {
            f.notasPagina = mf.notasPagina;
          }
          if ((!mapaDeListasTemItens(f.grifosPorPagina) || remotoMaisNovo) && mapaDeListasTemItens(mf.grifosPorPagina)) {
            f.grifosPorPagina = mf.grifosPorPagina;
          }
          if (remotoMaisNovo && mf.atualizadoEm) f.atualizadoEm = mf.atualizadoEm;
        }
      }
      continue;
    }
    if (textoDeNotaHtml(html)) {
      notasExternas.push({ id: `zot_nota_${n.chave}`, chave: n.chave, html, data: n.data, origem: 'zotero' });
    }
  }
  art.notasZotero = notasExternas;

  const ids = new Set(f.citacoesMarcadas.map(c => c.id));
  let novas = 0;
  for (const an of anotacoes.get(chavePai) || []) {
    if (!an.texto) {
      if (an.comentario) { // anotação só com comentário: vira nota do Zotero (somente leitura)
        const id = `zot_nota_${an.chave}`;
        if (!art.notasZotero.some(n => n.id === id)) art.notasZotero.push({ id, chave: an.chave, html: `<p>${an.comentario.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>`, data: an.data, origem: 'zotero' });
      }
      continue;
    }
    const id = `zot_ann_${an.chave}`;
    if (ids.has(id)) continue;
    f.citacoesMarcadas.push({
      id, pagina: an.pagina, paginaCitacao: an.rotuloPagina || String(an.pagina), texto: an.texto, comentario: an.comentario,
      cor: an.cor || '#FFD400', origem: 'zotero'
    });
    ids.add(id);
    novas++;
  }
  return novas;
}
