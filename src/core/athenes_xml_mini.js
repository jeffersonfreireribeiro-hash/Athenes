// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Parser XML mínimo (sem DOM, sem dependências) para ler OOXML no navegador e no Node.
 * Nó: { n: 'w:p', a: { 'w:val': '1' }, c: [nós | string] }. Não executa nada nem resolve entidades externas (sem DTD/XXE).
 */
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENTIDADES[e] ?? m;
});

const MAX_NOS = 2_000_000;

export function parseXml(texto) {
  const raiz = { n: '#raiz', a: {}, c: [] };
  const pilha = [raiz];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m, nos = 0;
  while ((m = re.exec(texto))) {
    if (++nos > MAX_NOS) throw new Error('XML grande demais.');
    const topo = pilha[pilha.length - 1];
    if (m[1] !== undefined) { topo.c.push(m[1]); continue; }
    if (m[6] !== undefined) { if (m[6].trim() !== '' || topo.n === 'w:t') topo.c.push(decodificar(m[6])); continue; }
    if (m[3] === undefined) continue; // comentário, PI, doctype
    if (m[2] === '/') { if (pilha.length > 1) pilha.pop(); continue; }
    const a = {};
    m[4].replace(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, k, v1, v2) => { a[k] = decodificar(v1 ?? v2 ?? ''); return ''; });
    const no = { n: m[3], a, c: [] };
    topo.c.push(no);
    if (m[5] !== '/') pilha.push(no);
  }
  return raiz.c.find(x => typeof x === 'object') || raiz;
}

/** Filhos-elemento (opcionalmente só os de um nome). */
export const filhos = (no, nome) => (no?.c || []).filter(x => typeof x === 'object' && (!nome || x.n === nome));
export const primeiro = (no, nome) => (no?.c || []).find(x => typeof x === 'object' && x.n === nome) || null;
export const attr = (no, nome) => (no ? no.a[nome] : undefined);
/** Texto concatenado de todos os descendentes. */
export function textoDe(no) {
  if (typeof no === 'string') return no;
  return (no?.c || []).map(textoDe).join('');
}
/** Todos os descendentes com o nome (busca em profundidade). */
export function descendentes(no, nome, saida = []) {
  for (const x of no?.c || []) { if (typeof x === 'object') { if (x.n === nome) saida.push(x); descendentes(x, nome, saida); } }
  return saida;
}
