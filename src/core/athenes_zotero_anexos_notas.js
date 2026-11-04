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
    const novo = { chave, nomeArquivo: d.filename || d.title || `${chave}.pdf`, baixavel: anexoPdfBaixavel(d), linkMode: d.linkMode || '' };
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

/** Texto simples de uma nota HTML (para a cópia e para decidir se está vazia). */
export function textoDeNotaHtml(html) {
  return String(html || '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

/**
 * Aplica ao artigo: selo do PDF, notas do Zotero (somente leitura, substituídas a cada sincronização) e anotações
 * de PDF com texto como citações marcadas (id estável `zot_ann_<chave>`; as já existentes não são tocadas).
 * Devolve quantas citações novas entraram.
 */
export function aplicarFilhosZoteroAoArtigo(art, chavePai, { anexos, notas, anotacoes }) {
  if (!art || !chavePai) return 0;
  art.anexoPdfZotero = anexos.get(chavePai) || null;
  art.notasZotero = (notas.get(chavePai) || []).filter(n => textoDeNotaHtml(n.html)).map(n => ({ id: `zot_nota_${n.chave}`, chave: n.chave, html: n.html, data: n.data, origem: 'zotero' }));

  const f = art.fichamento || (art.fichamento = { resumoPessoal: '', metodologiaNotas: '', citacoesMarcadas: [], notasPagina: {}, tracosPorPagina: {} });
  if (!Array.isArray(f.citacoesMarcadas)) f.citacoesMarcadas = [];
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
