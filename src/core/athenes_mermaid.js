// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Subconjunto de Mermaid → SVG vetorial (renderer próprio; sem Mermaid.js, 100% offline).
 *
 * Diagramas suportados (o suficiente para figuras acadêmicas):
 *   • flowchart / graph  (TB, TD, BT, LR, RL)
 *       nós:   A[retângulo]  A(arredondado)  A([pílula])  A((círculo))  A{losango}  A{{hexágono}}  A[[sub-rotina]]
 *              A[(banco de dados)]  A[/paralelogramo/]  A>assimétrico]   rótulos entre aspas e <br/> para quebrar linha
 *       ligações: -->  ---  -.->  -.-  ==>  ===  <-->  --o  --x   com texto:  -->|texto|   ou   -- texto -->
 *       cadeias (A --> B --> C), múltiplos (A & B --> C), subgraph…end (moldura), classDef / class / style / ::: (fill, stroke, color)
 *   • sequenceDiagram  (participant/actor [as], mensagens ->> --> ->  -->> -x --x -) --), Note over/left of/right of,
 *       activate/deactivate e +/-, autonumber, blocos loop/alt/else/opt/par/and/critical/break/rect … end)
 *   • gantt  (title, dateFormat YYYY-MM-DD, section, tarefas "nome :done|active|crit|milestone, id, início|after id, duração Nd|Nw|Nh")
 *   • pie    (pie [showData] [title …], "rótulo" : valor)
 * Fora do subconjunto (erro claro, sem quebrar o documento): classDiagram, stateDiagram, erDiagram, journey, gitGraph, mindmap, timeline…
 * Herda do documento: tipografia, cor primária e paleta (ver `criarTemaVisual`).
 */

import { escTexto } from './athenes_marcacao_segura.js';
import { criarTemaVisual, medirTexto, renderizarGraficoJson } from './athenes_grafico_json.js';

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Mistura `cor` com branco (t = 0 → cor; 1 → branco). */
export function clarearCor(cor, t = 0.85) {
  if (!HEX.test(cor)) return '#EEF4FA';
  let h = cor.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return '#' + v.map(c => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')).join('');
}

const TIPOS_NAO_SUPORTADOS = ['classDiagram', 'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'journey', 'gitGraph', 'mindmap', 'timeline', 'quadrantChart', 'requirementDiagram', 'C4Context', 'sankey-beta', 'xychart-beta', 'block-beta'];

// ───────────────────────────── Pré-processamento ─────────────────────────────

/** Linhas úteis [{n, t}] (sem comentários, front matter e diretivas). */
function linhasUteis(codigo) {
  const brutas = String(codigo ?? '').replace(/\r/g, '').split('\n');
  const out = [];
  let emFront = false;
  brutas.forEach((l, i) => {
    const t = l.trim();
    if (i === 0 || emFront) {
      if (t === '---') { emFront = !emFront || (i === 0); if (i !== 0) emFront = false; return; }
      if (emFront) return;
    }
    if (!t || t.startsWith('%%')) return;
    out.push({ n: i + 1, t });
  });
  return out;
}

export function detectarTipoMermaid(codigo) {
  const l = linhasUteis(codigo)[0]?.t || '';
  if (/^(flowchart|graph)\b/i.test(l)) return 'flowchart';
  if (/^sequenceDiagram\b/.test(l)) return 'sequence';
  if (/^gantt\b/.test(l)) return 'gantt';
  if (/^pie\b/.test(l)) return 'pie';
  const nome = l.split(/\s/)[0];
  if (TIPOS_NAO_SUPORTADOS.includes(nome)) return 'nao_suportado:' + nome;
  return '';
}

const textoMultilinha = (s) => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/^"(.*)"$/s, '$1').replace(/#quot;/g, '"').split('\n').map(x => x.trim());

// ───────────────────────────── Flowchart: parser ─────────────────────────────

const ABRE = [
  ['(((', ')))', 'circulo'], ['((', '))', 'circulo'], ['([', '])', 'pilula'], ['[[', ']]', 'subrotina'], ['[(', ')]', 'banco'],
  ['{{', '}}', 'hexagono'], ['[/', ['/]', '\\]'], 'paralelogramo'], ['[\\', ['\\]', '/]'], 'paralelogramo'],
  ['[', ']', 'retangulo'], ['(', ')', 'arredondado'], ['{', '}', 'losango'], ['>', ']', 'assimetrico']
];

function acharFecha(s, ini, fechas) {
  const lista = Array.isArray(fechas) ? fechas : [fechas];
  let aspas = false;
  for (let i = ini; i < s.length; i++) {
    if (s[i] === '"') aspas = !aspas;
    if (aspas) continue;
    for (const f of lista) if (s.startsWith(f, i)) return { i, f };
  }
  return null;
}

/** Lê um nó em `s` a partir de `p`: { id, forma?, rotulo?, classe?, fim } ou null. */
function lerNo(s, p) {
  const m = /^[A-Za-z0-9_À-ɏ][\wÀ-ɏ.-]*/.exec(s.slice(p));
  if (!m) return null;
  // ids não terminam em "-" ou "." imediatamente antes de um operador de ligação
  let id = m[0];
  while (/[.-]$/.test(id)) id = id.slice(0, -1);
  if (!id) return null;
  let q = p + id.length;
  let forma = null, rotulo = null;
  for (const [ab, fe, f] of ABRE) {
    if (s.startsWith(ab, q)) {
      const r = acharFecha(s, q + ab.length, fe);
      if (!r) return { erro: `Delimitador "${ab}" sem fechamento.` };
      forma = f; rotulo = s.slice(q + ab.length, r.i).trim();
      q = r.i + r.f.length;
      break;
    }
  }
  let classe = null;
  const mc = /^:::([\w-]+)/.exec(s.slice(q));
  if (mc) { classe = mc[1]; q += mc[0].length; }
  return { id, forma, rotulo, classe, fim: q };
}

const RE_LIGA_TEXTO = /^(<)?(--|==|-\.)\s+(.+?)\s+(-{2,}>|-{3,}|={2,}>|={3,}|\.-+>|\.-|--[ox])/;
const RE_LIGA = /^(<)?(-{2,}[>ox]?|={2,}>?|-\.+-?>?|~~~)/;

function lerLigacao(s, p) {
  const resto = s.slice(p);
  let m = RE_LIGA_TEXTO.exec(resto);
  if (m) {
    const op = m[4];
    return { ...descreverOp(op, !!m[1]), texto: m[3].trim(), fim: p + m[0].length };
  }
  m = RE_LIGA.exec(resto);
  if (!m) return null;
  const op = m[2];
  let fim = p + m[0].length;
  let texto = '';
  const rest2 = s.slice(fim);
  const mt = /^\s*\|([^|]*)\|/.exec(rest2);
  if (mt) { texto = mt[1].trim(); fim += mt[0].length; }
  return { ...descreverOp(op, !!m[1]), texto, fim };
}

function descreverOp(op, comecoSeta) {
  const tracejado = op.startsWith('-.') || op.startsWith('.-');
  const grosso = op.startsWith('=');
  const fimSeta = op.endsWith('>') ? 'seta' : op.endsWith('o') && op.length > 2 ? 'bola' : op.endsWith('x') && op.length > 2 ? 'x' : 'nenhum';
  return { estilo: tracejado ? 'tracejado' : grosso ? 'grosso' : op.startsWith('~') ? 'invisivel' : 'solido', fimSeta, comecoSeta };
}

function parseEstiloCss(txt) {
  const o = {};
  String(txt).split(',').forEach(par => {
    const [k, v] = par.split(':').map(x => x.trim());
    if (!k || !v) return;
    if (/^(fill|stroke|color|stroke-width|stroke-dasharray)$/.test(k) && !/[<>"';{}()]/.test(v.replace(/^rgb\([^)]*\)$/, ''))) o[k] = v;
  });
  return o;
}

function parseFlowchart(linhas) {
  const dirTxt = /^(?:flowchart|graph)\s*(TB|TD|BT|RL|LR)?/i.exec(linhas[0].t);
  const direcao = (dirTxt?.[1] || 'TB').toUpperCase().replace('TD', 'TB');
  const nos = new Map();
  const ligs = [];
  const erros = [], avisos = [];
  const classes = new Map();
  const grupos = [];
  const pilhaGrupos = [];
  const garantir = (id) => {
    if (!nos.has(id)) nos.set(id, { id, rotulo: id, forma: 'retangulo', estilo: {}, classe: null, grupo: pilhaGrupos.length ? pilhaGrupos[pilhaGrupos.length - 1] : null });
    return nos.get(id);
  };
  const aplicarNo = (d) => {
    const n = garantir(d.id);
    if (d.forma) { n.forma = d.forma; n.rotulo = d.rotulo; n.explicito = true; }
    if (d.classe) n.classe = d.classe;
    if (pilhaGrupos.length && !n.grupoDefinido) { n.grupo = pilhaGrupos[pilhaGrupos.length - 1]; n.grupoDefinido = true; }
    return n;
  };

  for (const { n: nl, t: bruto } of linhas.slice(1)) {
    for (const t of bruto.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x => x.trim()).filter(Boolean)) {
      let m;
      if ((m = /^subgraph\s+(.+)$/i.exec(t))) {
        const txt = m[1].trim();
        const mm = /^([\w-]+)\s*\[(.*)\]$/.exec(txt);
        const g = { id: mm ? mm[1] : txt.replace(/\W+/g, '_'), titulo: textoMultilinha(mm ? mm[2] : txt).join(' '), pai: pilhaGrupos.length ? pilhaGrupos[pilhaGrupos.length - 1] : null };
        grupos.push(g); pilhaGrupos.push(g.id);
        continue;
      }
      if (/^end$/i.test(t)) { if (!pilhaGrupos.pop()) erros.push({ linha: nl, mensagem: '"end" sem "subgraph" correspondente.' }); continue; }
      if (/^direction\s+/i.test(t)) continue;
      if (/^(linkStyle|click|accTitle|accDescr)\b/i.test(t)) { avisos.push(`Instrução "${t.split(/\s/)[0]}" ignorada (linha ${nl}).`); continue; }
      if ((m = /^classDef\s+(\S+)\s+(.+)$/i.exec(t))) { m[1].split(',').forEach(c => classes.set(c, parseEstiloCss(m[2]))); continue; }
      if ((m = /^class\s+(\S+)\s+([\w-]+)$/i.exec(t))) { m[1].split(',').forEach(id => { garantir(id).classe = m[2]; }); continue; }
      if ((m = /^style\s+(\S+)\s+(.+)$/i.exec(t))) { Object.assign(garantir(m[1]).estilo, parseEstiloCss(m[2])); continue; }

      // cadeia de nós e ligações
      let p = 0;
      const lerGrupo = () => {
        const lista = [];
        for (;;) {
          while (t[p] === ' ') p++;
          const d = lerNo(t, p);
          if (!d) return null;
          if (d.erro) { erros.push({ linha: nl, mensagem: d.erro }); return null; }
          lista.push(aplicarNo(d)); p = d.fim;
          while (t[p] === ' ') p++;
          if (t[p] === '&') { p++; continue; }
          return lista;
        }
      };
      let anteriores = lerGrupo();
      if (!anteriores) { if (!erros.some(e => e.linha === nl)) erros.push({ linha: nl, mensagem: `Não foi possível entender: "${t.slice(0, 40)}".` }); continue; }
      while (p < t.length) {
        while (t[p] === ' ') p++;
        if (p >= t.length) break;
        const lig = lerLigacao(t, p);
        if (!lig) { erros.push({ linha: nl, mensagem: `Ligação inválida perto de "${t.slice(p, p + 14)}".` }); break; }
        p = lig.fim;
        const seguintes = lerGrupo();
        if (!seguintes) { if (!erros.some(e => e.linha === nl)) erros.push({ linha: nl, mensagem: 'Faltou o nó de destino da ligação.' }); break; }
        for (const a of anteriores) for (const b of seguintes) ligs.push({ de: a.id, para: b.id, ...lig, linha: nl });
        anteriores = seguintes;
      }
    }
  }
  if (pilhaGrupos.length) erros.push({ linha: linhas[linhas.length - 1].n, mensagem: `subgraph "${pilhaGrupos[pilhaGrupos.length - 1]}" não foi fechado com "end".` });
  if (!nos.size) erros.push({ linha: linhas[0].n, mensagem: 'O fluxograma não tem nenhum nó.' });
  if (nos.size > 150) erros.push({ linha: 1, mensagem: 'Limite de 150 nós por diagrama excedido.' });
  return { tipo: 'flowchart', direcao, nos, ligs, classes, grupos, erros, avisos };
}

// ───────────────────────────── Flowchart: layout ─────────────────────────────

const FONTE = 13;
const LINHA = 17;

function dimensionarNo(n) {
  const linhas = textoMultilinha(n.rotulo);
  const tw = Math.max(...linhas.map(l => medirTexto(l, FONTE)), 8);
  const th = linhas.length * LINHA;
  n.linhas = linhas;
  switch (n.forma) {
    case 'circulo': { const d = Math.max(tw, th) + 26; n.w = d; n.h = d; n.geo = 'elipse'; break; }
    case 'losango': n.w = tw * 1.55 + 28; n.h = th * 1.7 + 22; n.geo = 'losango'; break;
    case 'hexagono': n.w = tw + 46; n.h = th + 24; n.geo = 'retangulo'; break;
    case 'pilula': n.w = tw + 38; n.h = th + 20; n.geo = 'retangulo'; break;
    case 'banco': n.w = tw + 28; n.h = th + 34; n.geo = 'retangulo'; break;
    case 'paralelogramo': n.w = tw + 44; n.h = th + 20; n.geo = 'retangulo'; break;
    case 'assimetrico': n.w = tw + 38; n.h = th + 20; n.geo = 'retangulo'; break;
    default: n.w = tw + 30; n.h = th + 20; n.geo = 'retangulo';
  }
  n.w = Math.max(n.w, 44); n.h = Math.max(n.h, 34);
}

/** Atribui camadas (posto) por maior caminho, ignorando arestas de retorno (ciclos). */
function atribuirPostos(ids, arestas) {
  const adj = new Map(ids.map(i => [i, []]));
  arestas.forEach(a => { if (a.de !== a.para) adj.get(a.de).push(a.para); });
  const estado = new Map(); // 0 = novo, 1 = visitando, 2 = pronto
  const retorno = new Set();
  const dfs = (raiz) => {
    const pilha = [[raiz, 0]];
    estado.set(raiz, 1);
    while (pilha.length) {
      const topo = pilha[pilha.length - 1];
      const [v, k] = topo;
      const viz = adj.get(v);
      if (k < viz.length) {
        topo[1]++;
        const w = viz[k];
        if (!estado.get(w)) { estado.set(w, 1); pilha.push([w, 0]); }
        else if (estado.get(w) === 1) retorno.add(`${v}>${w}`);
      } else { estado.set(v, 2); pilha.pop(); }
    }
  };
  const grau = new Map(ids.map(i => [i, 0]));
  arestas.forEach(a => { if (a.de !== a.para) grau.set(a.para, grau.get(a.para) + 1); });
  ids.filter(i => grau.get(i) === 0).forEach(i => { if (!estado.get(i)) dfs(i); });
  ids.forEach(i => { if (!estado.get(i)) dfs(i); });
  const dag = arestas.filter(a => a.de !== a.para && !retorno.has(`${a.de}>${a.para}`));
  const posto = new Map(ids.map(i => [i, 0]));
  // relaxamento por ordem topológica
  const entrada = new Map(ids.map(i => [i, 0]));
  dag.forEach(a => entrada.set(a.para, entrada.get(a.para) + 1));
  const fila = ids.filter(i => entrada.get(i) === 0);
  const saidas = new Map(ids.map(i => [i, []]));
  dag.forEach(a => saidas.get(a.de).push(a.para));
  while (fila.length) {
    const v = fila.shift();
    for (const w of saidas.get(v)) {
      posto.set(w, Math.max(posto.get(w), posto.get(v) + 1));
      entrada.set(w, entrada.get(w) - 1);
      if (entrada.get(w) === 0) fila.push(w);
    }
  }
  return { posto, retorno };
}

function pontoNaBorda(n, alvo) {
  const dx = alvo.x - n.x, dy = alvo.y - n.y;
  if (!dx && !dy) return { x: n.x, y: n.y };
  const a = n.w / 2, b = n.h / 2;
  let t;
  if (n.geo === 'elipse') t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
  else if (n.geo === 'losango') t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
  else t = Math.min(a / (Math.abs(dx) || 1e-9), b / (Math.abs(dy) || 1e-9));
  return { x: n.x + dx * t, y: n.y + dy * t };
}

function layoutFlowchart(g) {
  const horizontal = g.direcao === 'LR' || g.direcao === 'RL';
  const ids = [...g.nos.keys()];
  g.nos.forEach(dimensionarNo);
  const arestasValidas = g.ligs.filter(l => g.nos.has(l.de) && g.nos.has(l.para));
  const { posto, retorno } = atribuirPostos(ids, arestasValidas);

  // nós fictícios para arestas que atravessam várias camadas
  const todos = new Map();
  ids.forEach(i => { const n = g.nos.get(i); todos.set(i, { id: i, posto: posto.get(i), across: horizontal ? n.h : n.w, along: horizontal ? n.w : n.h, real: true }); });
  const segmentos = [];
  arestasValidas.forEach((l, k) => {
    if (l.de === l.para) { l.caminho = [l.de, l.para]; return; }
    const inv = retorno.has(`${l.de}>${l.para}`);
    const a = inv ? l.para : l.de, b = inv ? l.de : l.para;
    let ant = a;
    const cadeia = [a];
    for (let r = posto.get(a) + 1; r < posto.get(b); r++) {
      const id = `__d${k}_${r}`;
      todos.set(id, { id, posto: r, across: 8, along: 0, real: false });
      segmentos.push([ant, id]); ant = id; cadeia.push(id);
    }
    segmentos.push([ant, b]); cadeia.push(b);
    l.caminho = inv ? cadeia.reverse() : cadeia;
    l.inverso = inv;
  });
  const maxPosto = Math.max(...[...todos.values()].map(n => n.posto), 0);
  const camadas = Array.from({ length: maxPosto + 1 }, () => []);
  [...todos.values()].forEach(n => camadas[n.posto].push(n));

  // ordenação por baricentro
  const viz = new Map([...todos.keys()].map(i => [i, { cima: [], baixo: [] }]));
  segmentos.forEach(([a, b]) => { viz.get(a).baixo.push(b); viz.get(b).cima.push(a); });
  arestasValidas.forEach(l => { if (l.caminho.length === 2 && l.de !== l.para) { const a = posto.get(l.de) <= posto.get(l.para) ? l.de : l.para; const b = a === l.de ? l.para : l.de; if (!viz.get(a).baixo.includes(b)) { viz.get(a).baixo.push(b); viz.get(b).cima.push(a); } } });
  const indice = new Map();
  const reindexar = () => camadas.forEach(c => c.forEach((n, i) => indice.set(n.id, i)));
  reindexar();
  for (let it = 0; it < 6; it++) {
    const desc = it % 2 === 0;
    const ordem = desc ? camadas.map((_, i) => i) : camadas.map((_, i) => camadas.length - 1 - i);
    for (const r of ordem) {
      const ref = desc ? 'cima' : 'baixo';
      camadas[r].forEach(n => {
        const vs = viz.get(n.id)[ref];
        n.bar = vs.length ? vs.reduce((s, v) => s + indice.get(v), 0) / vs.length : indice.get(n.id);
      });
      camadas[r].sort((a, b) => a.bar - b.bar || indice.get(a.id) - indice.get(b.id));
      camadas[r].forEach((n, i) => indice.set(n.id, i));
    }
  }

  // coordenadas: eixo "across" (dentro da camada) e "along" (entre camadas)
  const FOLGA = 36, ENTRE = horizontal ? 70 : 54;
  camadas.forEach(c => { let x = 0; c.forEach(n => { n.a = x + n.across / 2; x += n.across + (n.real ? FOLGA : 12); }); const total = x - (c.length ? (c[c.length - 1].real ? FOLGA : 12) : 0); c.total = total; });
  const larguraMax = Math.max(...camadas.map(c => c.total || 0), 0);
  camadas.forEach(c => { const off = (larguraMax - (c.total || 0)) / 2; c.forEach(n => { n.a += off; }); });
  for (let it = 0; it < 8; it++) {
    const ordem = it % 2 === 0 ? camadas.map((_, i) => i) : camadas.map((_, i) => camadas.length - 1 - i);
    for (const r of ordem) {
      const c = camadas[r];
      c.forEach(n => {
        const vs = [...viz.get(n.id).cima, ...viz.get(n.id).baixo].map(id => todos.get(id));
        if (vs.length) n.alvo = vs.reduce((s, v) => s + v.a, 0) / vs.length; else n.alvo = n.a;
      });
      // aproxima do alvo respeitando a ordem e o espaçamento mínimo
      for (let i = 0; i < c.length; i++) c[i].a = c[i].a * 0.35 + c[i].alvo * 0.65;
      for (let i = 1; i < c.length; i++) { const min = c[i - 1].a + c[i - 1].across / 2 + c[i].across / 2 + (c[i].real && c[i - 1].real ? FOLGA : 12); if (c[i].a < min) c[i].a = min; }
      for (let i = c.length - 2; i >= 0; i--) { const max = c[i + 1].a - c[i + 1].across / 2 - c[i].across / 2 - (c[i].real && c[i + 1].real ? FOLGA : 12); if (c[i].a > max && c[i].a - max < 1e-6) c[i].a = max; }
    }
  }
  // normaliza para começar em 0
  const minA = Math.min(...[...todos.values()].map(n => n.a - n.across / 2));
  todos.forEach(n => { n.a -= minA; });

  let ao = 0;
  camadas.forEach(c => {
    const altura = Math.max(...c.map(n => n.along), 0);
    c.forEach(n => { n.l = ao + altura / 2; });
    ao += altura + ENTRE;
  });
  const totalAlong = ao - ENTRE;
  const totalAcross = Math.max(...[...todos.values()].map(n => n.a + n.across / 2), 0);

  const aplicar = (n) => {
    let along = n.l, across = n.a;
    if (g.direcao === 'BT' || g.direcao === 'RL') along = totalAlong - along;
    return horizontal ? { x: along, y: across } : { x: across, y: along };
  };
  todos.forEach(n => { const p = aplicar(n); n.x = p.x; n.y = p.y; });
  g.nos.forEach(n => { const t = todos.get(n.id); n.x = t.x; n.y = t.y; });
  g.todos = todos;
  g.dim = horizontal ? { w: totalAlong, h: totalAcross } : { w: totalAcross, h: totalAlong };
  return g;
}

function caminhoLigacao(g, l) {
  const a = g.nos.get(l.de), b = g.nos.get(l.para);
  if (l.de === l.para) {
    const x = a.x + a.w / 2, y = a.y;
    return { d: `M${fmt(x)} ${fmt(y - 8)} C${fmt(x + 40)} ${fmt(y - 26)} ${fmt(x + 40)} ${fmt(y + 26)} ${fmt(x)} ${fmt(y + 8)}`, meio: { x: x + 34, y }, pontaAng: Math.PI, pontaPos: { x, y: y + 8 }, inicio: { x, y: y - 8 } };
  }
  const meios = l.caminho.slice(1, -1).map(id => g.todos.get(id));
  const alvoA = meios.length ? meios[0] : b;
  const alvoB = meios.length ? meios[meios.length - 1] : a;
  const p0 = pontoNaBorda(a, alvoA);
  const p1 = pontoNaBorda(b, alvoB);
  const pts = [p0, ...meios.map(m => ({ x: m.x, y: m.y })), p1];
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  let mid = null;
  const duplo = g.ligs.some(o => o !== l && o.de === l.para && o.para === l.de);
  if (pts.length === 2 && (l.inverso || duplo)) {
    // aresta de retorno / par de sentidos opostos: curva lateral para não sobrepor a ligação direta
    const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y, len = Math.hypot(dx, dy) || 1;
    const off = (l.inverso ? 1 : -1) * (duplo ? 22 : 40);
    const cx = (pts[0].x + pts[1].x) / 2 - (dy / len) * off, cy = (pts[0].y + pts[1].y) / 2 + (dx / len) * off;
    d += ` Q${fmt(cx)} ${fmt(cy)} ${fmt(pts[1].x)} ${fmt(pts[1].y)}`;
    pts.splice(1, 0, { x: cx, y: cy });
    mid = { x: (pts[0].x + 2 * cx + pts[2].x) / 4, y: (pts[0].y + 2 * cy + pts[2].y) / 4 };
  } else if (pts.length === 2) d += ` L${fmt(pts[1].x)} ${fmt(pts[1].y)}`;
  else {
    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[Math.max(i - 1, 0)], pB = pts[i], pC = pts[i + 1], pD = pts[Math.min(i + 2, pts.length - 1)];
      const c1 = { x: pB.x + (pC.x - pA.x) / 6, y: pB.y + (pC.y - pA.y) / 6 };
      const c2 = { x: pC.x - (pD.x - pB.x) / 6, y: pC.y - (pD.y - pB.y) / 6 };
      d += ` C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(pC.x)} ${fmt(pC.y)}`;
    }
  }
  if (!mid) mid = pts.length === 2 ? { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 } : pts[Math.floor(pts.length / 2)];
  const ult = pts[pts.length - 1], pen = pts[pts.length - 2];
  return { d, meio: mid, pontaAng: Math.atan2(ult.y - pen.y, ult.x - pen.x), pontaPos: ult, inicio: pts[0], inicioAng: Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x) };
}

function formaSvg(n, cor, tema, estilo) {
  const x = n.x - n.w / 2, y = n.y - n.h / 2, w = n.w, h = n.h;
  const attrs = `fill="${estilo.fill}" stroke="${estilo.stroke}" stroke-width="${estilo['stroke-width'] || 1.6}"${estilo['stroke-dasharray'] ? ` stroke-dasharray="${estilo['stroke-dasharray']}"` : ''}`;
  switch (n.forma) {
    case 'arredondado': return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="10" ${attrs}/>`;
    case 'pilula': return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h / 2)}" ${attrs}/>`;
    case 'circulo': return `<circle cx="${fmt(n.x)}" cy="${fmt(n.y)}" r="${fmt(w / 2)}" ${attrs}/>`;
    case 'losango': return `<path d="M${fmt(n.x)} ${fmt(y)} L${fmt(x + w)} ${fmt(n.y)} L${fmt(n.x)} ${fmt(y + h)} L${fmt(x)} ${fmt(n.y)} Z" ${attrs}/>`;
    case 'hexagono': return `<path d="M${fmt(x + 16)} ${fmt(y)} H${fmt(x + w - 16)} L${fmt(x + w)} ${fmt(n.y)} L${fmt(x + w - 16)} ${fmt(y + h)} H${fmt(x + 16)} L${fmt(x)} ${fmt(n.y)} Z" ${attrs}/>`;
    case 'subrotina': return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs}/><path d="M${fmt(x + 8)} ${fmt(y)} V${fmt(y + h)} M${fmt(x + w - 8)} ${fmt(y)} V${fmt(y + h)}" stroke="${estilo.stroke}" stroke-width="1.4" fill="none"/>`;
    case 'banco': return `<path d="M${fmt(x)} ${fmt(y + 9)} V${fmt(y + h - 9)} A${fmt(w / 2)} 9 0 0 0 ${fmt(x + w)} ${fmt(y + h - 9)} V${fmt(y + 9)} A${fmt(w / 2)} 9 0 0 0 ${fmt(x)} ${fmt(y + 9)} Z" ${attrs}/><path d="M${fmt(x)} ${fmt(y + 9)} A${fmt(w / 2)} 9 0 0 0 ${fmt(x + w)} ${fmt(y + 9)}" fill="none" stroke="${estilo.stroke}" stroke-width="1.4"/>`;
    case 'paralelogramo': return `<path d="M${fmt(x + 14)} ${fmt(y)} H${fmt(x + w)} L${fmt(x + w - 14)} ${fmt(y + h)} H${fmt(x)} Z" ${attrs}/>`;
    case 'assimetrico': return `<path d="M${fmt(x)} ${fmt(y)} H${fmt(x + w)} V${fmt(y + h)} H${fmt(x)} L${fmt(x + 14)} ${fmt(n.y)} Z" ${attrs}/>`;
    default: return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="3" ${attrs}/>`;
  }
  void cor; void tema;
}

function renderFlowchart(g, tema) {
  layoutFlowchart(g);
  const fundoNo = clarearCor(tema.cor, 0.88);
  let corpo = '';
  const margem = 16;
  const ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const cobrir = (x0, y0, x1, y1) => { ext.x0 = Math.min(ext.x0, x0); ext.y0 = Math.min(ext.y0, y0); ext.x1 = Math.max(ext.x1, x1); ext.y1 = Math.max(ext.y1, y1); };

  // molduras de subgraph
  const molduras = [];
  const membros = (gid) => [...g.nos.values()].filter(n => { let k = n.grupo; while (k) { if (k === gid) return true; k = g.grupos.find(x => x.id === k)?.pai || null; } return false; });
  const ordemGr = [...g.grupos].sort((a, b) => (a.pai ? 1 : 0) - (b.pai ? 1 : 0));
  ordemGr.forEach(gr => {
    const ms = membros(gr.id);
    if (!ms.length) return;
    const pad = 18 + (gr.pai ? 0 : 6);
    const x0 = Math.min(...ms.map(n => n.x - n.w / 2)) - pad, x1 = Math.max(...ms.map(n => n.x + n.w / 2)) + pad;
    const y0 = Math.min(...ms.map(n => n.y - n.h / 2)) - pad - 14, y1 = Math.max(...ms.map(n => n.y + n.h / 2)) + pad;
    molduras.push(`<rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(x1 - x0)}" height="${fmt(y1 - y0)}" rx="6" fill="${clarearCor(tema.cor, 0.95)}" stroke="${tema.eixo}" stroke-width="1.2" stroke-dasharray="5 3"/>${`<text x="${fmt(x0 + 10)}" y="${fmt(y0 + 16)}" font-size="12" font-weight="700" fill="${tema.suave}">${escTexto(gr.titulo)}</text>`}`);
    cobrir(x0, y0, x1, y1);
  });
  corpo += molduras.join('');

  // ligações
  let rotulos = '';
  g.ligs.filter(l => g.nos.has(l.de) && g.nos.has(l.para)).forEach(l => {
    if (l.estilo === 'invisivel') return;
    const c = caminhoLigacao(g, l);
    const larg = l.estilo === 'grosso' ? 3 : 1.7;
    const tr = l.estilo === 'tracejado' ? ' stroke-dasharray="6 4"' : '';
    let fim = '';
    const aponta = (pos, ang, tipo) => {
      if (tipo === 'nenhum') return '';
      const rot = (ang * 180) / Math.PI;
      if (tipo === 'seta') return `<path d="M0 0 L-9 -4.5 L-9 4.5 Z" transform="translate(${fmt(pos.x)} ${fmt(pos.y)}) rotate(${fmt(rot)})" fill="${tema.eixo === '#94A3B8' ? '#475569' : tema.eixo}"/>`;
      if (tipo === 'bola') return `<circle cx="${fmt(pos.x - Math.cos(ang) * 4)}" cy="${fmt(pos.y - Math.sin(ang) * 4)}" r="4" fill="#fff" stroke="#475569" stroke-width="1.4"/>`;
      return `<path d="M-4 -4 L4 4 M4 -4 L-4 4" transform="translate(${fmt(pos.x - Math.cos(ang) * 4)} ${fmt(pos.y - Math.sin(ang) * 4)})" stroke="#475569" stroke-width="2"/>`;
    };
    fim += aponta(c.pontaPos, c.pontaAng, l.fimSeta);
    if (l.comecoSeta) fim += aponta(c.inicio, c.inicioAng ?? 0, 'seta');
    corpo += `<path d="${c.d}" fill="none" stroke="#475569" stroke-width="${larg}"${tr}/>${fim}`;
    if (l.texto) {
      const linhas = textoMultilinha(l.texto);
      const w = Math.max(...linhas.map(x => medirTexto(x, 12))) + 10, h = linhas.length * 15 + 4;
      rotulos += `<rect x="${fmt(c.meio.x - w / 2)}" y="${fmt(c.meio.y - h / 2)}" width="${fmt(w)}" height="${fmt(h)}" rx="3" fill="#fff" fill-opacity="0.95"/>`;
      linhas.forEach((ln, i) => { rotulos += `<text x="${fmt(c.meio.x)}" y="${fmt(c.meio.y - h / 2 + 14 + i * 15)}" font-size="12" text-anchor="middle" fill="${tema.texto}">${escTexto(ln)}</text>`; });
      cobrir(c.meio.x - w / 2, c.meio.y - h / 2, c.meio.x + w / 2, c.meio.y + h / 2);
    }
    [c.inicio, c.pontaPos, c.meio].forEach(p => cobrir(p.x - 4, p.y - 4, p.x + 4, p.y + 4));
  });

  // nós
  g.nos.forEach(n => {
    const cls = n.classe && g.classes.get(n.classe) ? g.classes.get(n.classe) : {};
    const est = { fill: fundoNo, stroke: tema.cor, ...cls, ...n.estilo };
    corpo += formaSvg(n, tema.cor, tema, est);
    const cor = est.color || tema.texto;
    const y0 = n.y - (n.linhas.length * LINHA) / 2 + 12.5;
    n.linhas.forEach((ln, i) => { corpo += `<text x="${fmt(n.x)}" y="${fmt(y0 + i * LINHA)}" font-size="${FONTE}" text-anchor="middle" fill="${cor}">${escTexto(ln)}</text>`; });
    cobrir(n.x - n.w / 2, n.y - n.h / 2, n.x + n.w / 2, n.y + n.h / 2);
  });
  corpo += rotulos;
  const x0 = ext.x0 - margem, y0 = ext.y0 - margem, W = ext.x1 - ext.x0 + margem * 2, H = ext.y1 - ext.y0 + margem * 2;
  return { corpo, vb: [x0, y0, W, H] };
}

// ───────────────────────────── Sequence ─────────────────────────────

const RE_MSG = /^(.+?)\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-])?\s*(.+?)\s*:\s*(.*)$/;

function parseSequence(linhas) {
  const part = new Map();
  const ordem = [];
  const eventos = [];
  const erros = [], avisos = [];
  const pilha = [];
  let auto = false;
  const garantir = (id, rotulo, ator = false) => {
    if (!part.has(id)) { part.set(id, { id, rotulo: rotulo || id, ator }); ordem.push(id); }
    else if (rotulo) { part.get(id).rotulo = rotulo; if (ator) part.get(id).ator = true; }
    return part.get(id);
  };
  for (const { n: nl, t } of linhas.slice(1)) {
    let m;
    if ((m = /^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i.exec(t))) { garantir(m[2], m[3] ? textoMultilinha(m[3]).join(' ') : m[2], m[1].toLowerCase() === 'actor'); continue; }
    if (/^autonumber\b/i.test(t)) { auto = true; continue; }
    if (/^(title|accTitle|accDescr)\b/i.test(t)) { if (/^title\s+/i.test(t)) eventos.push({ tipo: 'titulo', texto: t.replace(/^title\s*:?\s*/i, ''), linha: nl }); continue; }
    if ((m = /^(activate|deactivate)\s+(\S+)$/i.exec(t))) { garantir(m[2]); eventos.push({ tipo: m[1].toLowerCase(), id: m[2], linha: nl }); continue; }
    if ((m = /^Note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i.exec(t))) {
      const ids = m[2].split(',').map(x => x.trim());
      ids.forEach(i => garantir(i));
      eventos.push({ tipo: 'nota', pos: m[1].toLowerCase(), ids, texto: textoMultilinha(m[3]), linha: nl });
      continue;
    }
    if ((m = /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/i.exec(t))) { pilha.push(m[1].toLowerCase()); eventos.push({ tipo: 'bloco_ini', nome: m[1].toLowerCase(), rotulo: m[2], linha: nl }); continue; }
    if ((m = /^(else|and|option)\b\s*(.*)$/i.exec(t))) { if (!pilha.length) erros.push({ linha: nl, mensagem: `"${m[1]}" fora de um bloco.` }); eventos.push({ tipo: 'bloco_sep', rotulo: m[2], linha: nl }); continue; }
    if (/^end$/i.test(t)) { if (!pilha.pop()) erros.push({ linha: nl, mensagem: '"end" sem bloco aberto.' }); else eventos.push({ tipo: 'bloco_fim', linha: nl }); continue; }
    if ((m = RE_MSG.exec(t))) {
      garantir(m[1].trim()); garantir(m[4].trim());
      eventos.push({ tipo: 'msg', de: m[1].trim(), para: m[4].trim(), seta: m[2], mod: m[3] || '', texto: textoMultilinha(m[5]), linha: nl });
      continue;
    }
    erros.push({ linha: nl, mensagem: `Instrução não reconhecida no diagrama de sequência: "${t.slice(0, 40)}".` });
  }
  if (pilha.length) erros.push({ linha: linhas[linhas.length - 1].n, mensagem: `Bloco "${pilha[pilha.length - 1]}" sem "end".` });
  if (!ordem.length) erros.push({ linha: linhas[0].n, mensagem: 'Nenhum participante ou mensagem encontrado.' });
  return { tipo: 'sequence', part, ordem, eventos, auto, erros, avisos };
}

function renderSequence(s, tema) {
  const ids = s.ordem;
  const boxW = ids.map(i => Math.max(medirTexto(s.part.get(i).rotulo, 13, true) + 28, 90));
  const gaps = ids.slice(1).map((_, k) => Math.max((boxW[k] + boxW[k + 1]) / 2 + 20, 60));
  const idx = new Map(ids.map((i, k) => [i, k]));
  // espaçamento mínimo por rótulo das mensagens
  s.eventos.filter(e => e.tipo === 'msg' && e.de !== e.para).forEach(e => {
    const a = Math.min(idx.get(e.de), idx.get(e.para)), b = Math.max(idx.get(e.de), idx.get(e.para));
    const w = Math.max(...e.texto.map(x => medirTexto(x, 12))) + 36;
    for (let k = a; k < b; k++) gaps[k] = Math.max(gaps[k], w / (b - a));
  });
  s.eventos.filter(e => e.tipo === 'nota').forEach(e => {
    const w = Math.max(...e.texto.map(x => medirTexto(x, 12))) + 24;
    if (e.pos === 'over' && e.ids.length > 1) { const a = Math.min(...e.ids.map(i => idx.get(i))), b = Math.max(...e.ids.map(i => idx.get(i))); for (let k = a; k < b; k++) gaps[k] = Math.max(gaps[k], w / (b - a)); }
  });
  const xs = []; let x = 20 + boxW[0] / 2;
  ids.forEach((_, k) => { xs.push(x); if (k < gaps.length) x += gaps[k]; });
  const X = (id) => xs[idx.get(id)];
  const largura = xs[xs.length - 1] + boxW[boxW.length - 1] / 2 + 20;
  let y = 16;
  let titulo = '';
  const tEv = s.eventos.find(e => e.tipo === 'titulo');
  if (tEv) { titulo = `<text x="${fmt(largura / 2)}" y="${fmt(y + 12)}" font-size="15" font-weight="700" text-anchor="middle" fill="${tema.texto}">${escTexto(tEv.texto)}</text>`; y += 30; }
  const topo = y;
  const altBox = 34;
  y += altBox + 16;
  let corpo = '', blocos = '', ativ = '';
  const pilhaBlocos = [];
  const ativas = new Map(ids.map(i => [i, []]));
  let numero = 0;
  const seta = (x1, x2, yy, tipo) => {
    const dir = x2 >= x1 ? 1 : -1;
    const pt = tipo.includes('>>') ? `<path d="M${fmt(x2)} ${fmt(yy)} l${-9 * dir} -4 v8 z" fill="#334155"/>` : tipo.endsWith('x') ? `<path d="M${fmt(x2 - 4)} ${fmt(yy - 4)} l8 8 M${fmt(x2 + 4)} ${fmt(yy - 4)} l-8 8" stroke="#334155" stroke-width="1.8"/>` : tipo.endsWith(')') ? `<path d="M${fmt(x2 - 8 * dir)} ${fmt(yy - 4)} L${fmt(x2)} ${fmt(yy)} L${fmt(x2 - 8 * dir)} ${fmt(yy + 4)}" fill="none" stroke="#334155" stroke-width="1.5"/>` : `<path d="M${fmt(x2 - 8 * dir)} ${fmt(yy - 4)} L${fmt(x2)} ${fmt(yy)} L${fmt(x2 - 8 * dir)} ${fmt(yy + 4)}" fill="none" stroke="#334155" stroke-width="1.5"/>`;
    return pt;
  };
  for (const e of s.eventos) {
    if (e.tipo === 'msg') {
      numero++;
      const rotulo = (s.auto ? `${numero}. ` : '') + e.texto.join(' ');
      const tracej = e.seta.startsWith('--');
      if (e.mod === '+') ativas.get(e.para).push({ y0: y + 4 });
      if (e.de === e.para) {
        const x0 = X(e.de) + 4;
        corpo += `<path d="M${fmt(x0)} ${fmt(y)} h28 v22 h-28" fill="none" stroke="#334155" stroke-width="1.5"${tracej ? ' stroke-dasharray="6 4"' : ''}/>${seta(x0 + 28, x0, y + 22, e.seta)}`;
        corpo += `<text x="${fmt(x0 + 34)}" y="${fmt(y + 4)}" font-size="12" fill="${tema.texto}">${escTexto(rotulo)}</text>`;
        y += 40;
      } else {
        const x1 = X(e.de), x2 = X(e.para);
        const ajuste = (id, toward) => { const a = ativas.get(id); return a.length ? 4 * Math.sign(toward - X(id)) : 0; };
        const xa = x1 + ajuste(e.de, x2), xb = x2 - ajuste(e.para, x1) * -1 * 0 + (ativas.get(e.para).length ? -4 * Math.sign(x2 - x1) : 0);
        corpo += `<line x1="${fmt(xa)}" y1="${fmt(y + 14)}" x2="${fmt(xb)}" y2="${fmt(y + 14)}" stroke="#334155" stroke-width="1.5"${tracej ? ' stroke-dasharray="6 4"' : ''}/>${seta(xa, xb, y + 14, e.seta)}`;
        corpo += `<text x="${fmt((xa + xb) / 2)}" y="${fmt(y + 8)}" font-size="12" text-anchor="middle" fill="${tema.texto}">${escTexto(rotulo)}</text>`;
        y += 34;
      }
      if (e.mod === '-') { const a = ativas.get(e.de); const b = a.pop(); if (b) ativ += `<rect x="${fmt(X(e.de) - 4)}" y="${fmt(b.y0)}" width="8" height="${fmt(y - 14 - b.y0)}" fill="${clarearCor(tema.cor, 0.75)}" stroke="${tema.cor}" stroke-width="1"/>`; }
    } else if (e.tipo === 'activate') ativas.get(e.id).push({ y0: y });
    else if (e.tipo === 'deactivate') { const b = ativas.get(e.id).pop(); if (b) ativ += `<rect x="${fmt(X(e.id) - 4)}" y="${fmt(b.y0)}" width="8" height="${fmt(Math.max(y - b.y0 - 10, 6))}" fill="${clarearCor(tema.cor, 0.75)}" stroke="${tema.cor}" stroke-width="1"/>`; }
    else if (e.tipo === 'nota') {
      const w = Math.max(...e.texto.map(x => medirTexto(x, 12))) + 20, h = e.texto.length * 15 + 12;
      let nx;
      if (e.pos === 'over') { const a = Math.min(...e.ids.map(X)), b = Math.max(...e.ids.map(X)); const ww = Math.max(w, b - a + 24); nx = (a + b) / 2 - ww / 2; corpo += nota(nx, y, ww, h, e.texto, tema); }
      else { nx = e.pos === 'left of' ? X(e.ids[0]) - w - 12 : X(e.ids[0]) + 12; corpo += nota(nx, y, w, h, e.texto, tema); }
      y += h + 12;
    } else if (e.tipo === 'bloco_ini') { pilhaBlocos.push({ nome: e.nome, rotulo: e.rotulo, y0: y, seps: [] }); y += 24; }
    else if (e.tipo === 'bloco_sep') { const b = pilhaBlocos[pilhaBlocos.length - 1]; if (b) { b.seps.push({ y, rotulo: e.rotulo }); y += 22; } }
    else if (e.tipo === 'bloco_fim') {
      const b = pilhaBlocos.pop();
      if (b) {
        const bx0 = xs[0] - boxW[0] / 2 + 6 - pilhaBlocos.length * 6, bx1 = xs[xs.length - 1] + boxW[boxW.length - 1] / 2 - 6 + pilhaBlocos.length * 6;
        const tag = b.nome === 'rect' ? '' : b.nome;
        blocos += `<rect x="${fmt(bx0)}" y="${fmt(b.y0)}" width="${fmt(bx1 - bx0)}" height="${fmt(y - b.y0)}" fill="${b.nome === 'rect' ? clarearCor(tema.cor, 0.93) : 'none'}" stroke="${tema.eixo}" stroke-width="1.2"/>`;
        if (tag) blocos += `<path d="M${fmt(bx0)} ${fmt(b.y0)} h${fmt(medirTexto(tag, 11, true) + 18)} v14 l-6 6 h${fmt(-(medirTexto(tag, 11, true) + 12))} z" fill="${clarearCor(tema.cor, 0.8)}" stroke="${tema.eixo}" stroke-width="1"/><text x="${fmt(bx0 + 6)}" y="${fmt(b.y0 + 14)}" font-size="11" font-weight="700" fill="${tema.texto}">${escTexto(tag)}</text>`;
        if (b.rotulo) blocos += `<text x="${fmt(bx0 + medirTexto(tag, 11, true) + 30)}" y="${fmt(b.y0 + 15)}" font-size="11" fill="${tema.suave}">[${escTexto(b.rotulo)}]</text>`;
        b.seps.forEach(sp => { blocos += `<line x1="${fmt(bx0)}" y1="${fmt(sp.y + 6)}" x2="${fmt(bx1)}" y2="${fmt(sp.y + 6)}" stroke="${tema.eixo}" stroke-dasharray="6 4"/>`; if (sp.rotulo) blocos += `<text x="${fmt(bx0 + 8)}" y="${fmt(sp.y + 20)}" font-size="11" fill="${tema.suave}">[${escTexto(sp.rotulo)}]</text>`; });
        y += 10;
      }
    }
  }
  const fimLinha = y + 6;
  let cab = '', rod = '', vidas = '';
  ids.forEach((id, k) => {
    const p = s.part.get(id);
    const box = (yy) => p.ator
      ? `<g><circle cx="${fmt(xs[k])}" cy="${fmt(yy + 7)}" r="6" fill="#fff" stroke="${tema.cor}" stroke-width="1.6"/><path d="M${fmt(xs[k])} ${fmt(yy + 13)} v10 M${fmt(xs[k] - 8)} ${fmt(yy + 17)} h16 M${fmt(xs[k])} ${fmt(yy + 23)} l-6 8 M${fmt(xs[k])} ${fmt(yy + 23)} l6 8" stroke="${tema.cor}" stroke-width="1.6" fill="none"/><text x="${fmt(xs[k])}" y="${fmt(yy + 44)}" font-size="12" font-weight="700" text-anchor="middle" fill="${tema.texto}">${escTexto(p.rotulo)}</text></g>`
      : `<rect x="${fmt(xs[k] - boxW[k] / 2)}" y="${fmt(yy)}" width="${fmt(boxW[k])}" height="${altBox}" rx="4" fill="${clarearCor(tema.cor, 0.88)}" stroke="${tema.cor}" stroke-width="1.6"/><text x="${fmt(xs[k])}" y="${fmt(yy + 21.5)}" font-size="13" font-weight="700" text-anchor="middle" fill="${tema.texto}">${escTexto(p.rotulo)}</text>`;
    cab += box(topo);
    rod += box(fimLinha);
    vidas += `<line x1="${fmt(xs[k])}" y1="${fmt(topo + (p.ator ? 34 : altBox))}" x2="${fmt(xs[k])}" y2="${fmt(fimLinha)}" stroke="${tema.eixo}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  });
  const altura = fimLinha + altBox + 20;
  return { corpo: `${titulo}${vidas}${blocos}${ativ}${corpo}${cab}${rod}`, vb: [0, 0, largura, altura] };
}

function nota(x, y, w, h, linhas, tema) {
  let t = `<path d="M${fmt(x)} ${fmt(y)} h${fmt(w - 10)} l10 10 v${fmt(h - 10)} h${fmt(-w)} z" fill="#FFF8DC" stroke="#C9B458" stroke-width="1.2"/>`;
  linhas.forEach((ln, i) => { t += `<text x="${fmt(x + 8)}" y="${fmt(y + 16 + i * 15)}" font-size="12" fill="${tema.texto}">${escTexto(ln)}</text>`; });
  return t;
}

// ───────────────────────────── Gantt ─────────────────────────────

const DIA = 86400000;
function parseData(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCMonth() === +m[2] - 1 ? t : null;
}
function parseDuracao(s) {
  const m = /^(\d+(?:\.\d+)?)\s*(d|w|h)$/.exec(String(s).trim());
  if (!m) return null;
  return parseFloat(m[1]) * (m[2] === 'w' ? 7 : m[2] === 'h' ? 1 / 24 : 1) * DIA;
}

function parseGantt(linhas) {
  const erros = [], avisos = [];
  let titulo = '';
  const secoes = [{ nome: '', tarefas: [] }];
  const porId = new Map();
  let ultimoFim = null;
  for (const { n: nl, t } of linhas.slice(1)) {
    let m;
    if ((m = /^title\s+(.+)$/i.exec(t))) { titulo = m[1]; continue; }
    if ((m = /^dateFormat\s+(.+)$/i.exec(t))) { if (m[1].trim() !== 'YYYY-MM-DD') avisos.push(`dateFormat "${m[1].trim()}" não suportado; usando YYYY-MM-DD.`); continue; }
    if (/^(axisFormat|tickInterval|excludes|includes|todayMarker|weekday|weekend|accTitle|accDescr)\b/i.test(t)) continue;
    if ((m = /^section\s+(.+)$/i.exec(t))) { secoes.push({ nome: m[1], tarefas: [] }); continue; }
    const k = t.lastIndexOf(':');
    if (k < 1) { erros.push({ linha: nl, mensagem: `Tarefa sem ":" — use "Nome :início, duração".` }); continue; }
    const nome = t.slice(0, k).trim();
    const partes = t.slice(k + 1).split(',').map(x => x.trim()).filter(Boolean);
    const tags = [];
    while (partes.length && /^(done|active|crit|milestone)$/i.test(partes[0])) tags.push(partes.shift().toLowerCase());
    let id = null, inicio = null, fim = null;
    if (partes.length >= 3 || (partes.length === 2 && !parseData(partes[0]) && !/^after\s/i.test(partes[0]) && !parseDuracao(partes[0]))) id = partes.shift();
    let ref = partes.shift();
    let dur = partes.shift();
    if (ref && /^after\s+/i.test(ref)) {
      const ids = ref.replace(/^after\s+/i, '').split(/\s+/);
      const fins = ids.map(i => porId.get(i)?.fim);
      if (fins.some(f => f == null)) { erros.push({ linha: nl, mensagem: `"after ${ids.join(' ')}": tarefa de referência não encontrada (defina-a antes).` }); continue; }
      inicio = Math.max(...fins);
    } else if (ref && parseData(ref)) inicio = parseData(ref);
    else if (ref && parseDuracao(ref) && !dur) { dur = ref; ref = null; inicio = ultimoFim; }
    else if (ref) { erros.push({ linha: nl, mensagem: `Início inválido "${ref}" (use AAAA-MM-DD ou "after id").` }); continue; }
    if (inicio == null) inicio = ultimoFim;
    if (inicio == null) { erros.push({ linha: nl, mensagem: 'Defina a data de início da primeira tarefa (AAAA-MM-DD).' }); continue; }
    if (dur && parseData(dur)) fim = parseData(dur) + (tags.includes('milestone') ? 0 : 0);
    else if (dur && parseDuracao(dur) != null) fim = inicio + parseDuracao(dur);
    else { erros.push({ linha: nl, mensagem: `Duração inválida "${dur ?? ''}" (use 5d, 2w ou 12h).` }); continue; }
    if (fim < inicio) { erros.push({ linha: nl, mensagem: 'O fim da tarefa é anterior ao início.' }); continue; }
    const tarefa = { nome, id, tags, inicio, fim };
    secoes[secoes.length - 1].tarefas.push(tarefa);
    if (id) porId.set(id, tarefa);
    ultimoFim = fim;
  }
  if (!secoes.some(s => s.tarefas.length) && !erros.length) erros.push({ linha: linhas[0].n, mensagem: 'O Gantt não tem tarefas.' });
  return { tipo: 'gantt', titulo, secoes, erros, avisos };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloData = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')} ${MESES[d.getUTCMonth()]}`; };

function renderGantt(gt, tema) {
  const tarefas = gt.secoes.flatMap(s => s.tarefas);
  const t0 = Math.min(...tarefas.map(t => t.inicio)), t1 = Math.max(...tarefas.map(t => t.fim), t0 + DIA);
  const nomeW = Math.min(240, Math.max(...tarefas.map(t => medirTexto(t.nome, 12)), ...gt.secoes.map(s => medirTexto(s.nome, 12, true))) + 20);
  const W = 720, graf0 = nomeW + 20, graf1 = W - 20;
  const esc = (t) => graf0 + (t - t0) / (t1 - t0) * (graf1 - graf0);
  let y = 16, corpo = '';
  if (gt.titulo) { corpo += `<text x="${fmt(W / 2)}" y="${fmt(y + 12)}" font-size="15" font-weight="700" text-anchor="middle" fill="${tema.texto}">${escTexto(gt.titulo)}</text>`; y += 30; }
  const eixoY = y + 12;
  const dias = (t1 - t0) / DIA;
  const passo = dias <= 14 ? 1 : dias <= 45 ? 7 : dias <= 120 ? 14 : dias <= 400 ? 30 : 90;
  y += 22;
  const topoGrade = y;
  const linhaH = 26;
  const nLinhas = tarefas.length + gt.secoes.filter(s => s.nome).length;
  let grade = '';
  const total = nLinhas * linhaH;
  for (let t = t0; t <= t1 + 1; t += passo * DIA) {
    grade += `<line x1="${fmt(esc(t))}" y1="${fmt(topoGrade)}" x2="${fmt(esc(t))}" y2="${fmt(topoGrade + total)}" stroke="${tema.grade}"/><text x="${fmt(esc(t))}" y="${fmt(eixoY)}" font-size="10.5" text-anchor="middle" fill="${tema.suave}">${rotuloData(t)}</text>`;
  }
  corpo += grade;
  let ci = 0;
  gt.secoes.forEach(sec => {
    const cor = tema.paleta[ci % tema.paleta.length];
    if (sec.nome) {
      corpo += `<rect x="10" y="${fmt(y)}" width="${W - 20}" height="${linhaH}" fill="${clarearCor(cor, 0.92)}"/><text x="16" y="${fmt(y + 17)}" font-size="12" font-weight="700" fill="${tema.texto}">${escTexto(sec.nome)}</text>`;
      y += linhaH;
    }
    sec.tarefas.forEach(t => {
      const x0 = esc(t.inicio), w = Math.max(esc(t.fim) - x0, 3);
      corpo += `<text x="${fmt(nomeW)}" y="${fmt(y + 17)}" font-size="12" text-anchor="end" fill="${tema.texto}">${escTexto(t.nome)}</text>`;
      if (t.tags.includes('milestone')) corpo += `<path d="M${fmt(x0)} ${fmt(y + 4)} l9 9 l-9 9 l-9 -9 z" fill="${tema.cor}"/>`;
      else {
        const crit = t.tags.includes('crit'), done = t.tags.includes('done'), ativo = t.tags.includes('active');
        const fill = crit ? '#FECACA' : done ? '#E2E8F0' : ativo ? clarearCor(cor, 0.55) : clarearCor(cor, 0.35);
        const stroke = crit ? '#B91C1C' : done ? '#94A3B8' : cor;
        corpo += `<rect x="${fmt(x0)}" y="${fmt(y + 4)}" width="${fmt(w)}" height="${linhaH - 8}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${crit ? 2 : 1.2}"/>`;
        if (done) corpo += `<path d="M${fmt(x0 + 5)} ${fmt(y + 13)} l3 3 l6 -6" stroke="#64748B" stroke-width="1.6" fill="none"/>`;
      }
      y += linhaH;
    });
    ci++;
  });
  return { corpo, vb: [0, 0, W, y + 14] };
}

// ───────────────────────────── API pública ─────────────────────────────

function parsePie(linhas, tema) {
  const erros = [], avisos = [];
  const cab = /^pie\b\s*(showData)?\s*(?:title\s+(.+))?$/i.exec(linhas[0].t);
  const dados = [];
  let titulo = cab?.[2] || '';
  for (const { n: nl, t } of linhas.slice(1)) {
    let m;
    if ((m = /^title\s+(.+)$/i.exec(t))) { titulo = m[1]; continue; }
    if ((m = /^"([^"]+)"\s*:\s*(-?\d+(?:[.,]\d+)?)$/.exec(t))) { const v = parseFloat(m[2].replace(',', '.')); if (v < 0) erros.push({ linha: nl, mensagem: 'Valor negativo na pizza.' }); else dados.push({ rotulo: m[1], valor: v }); continue; }
    erros.push({ linha: nl, mensagem: 'Use: "Rótulo" : valor' });
  }
  if (!dados.length && !erros.length) erros.push({ linha: linhas[0].n, mensagem: 'A pizza não tem fatias.' });
  void tema;
  return { tipo: 'pie', titulo, dados, erros, avisos };
}

/** Valida a sintaxe do Mermaid (subconjunto). { ok, tipo, erros:[{linha,mensagem}], avisos } */
export function validarMermaid(codigo) {
  const linhas = linhasUteis(codigo);
  const res = { ok: false, tipo: '', erros: [], avisos: [] };
  if (!linhas.length) { res.erros.push({ linha: 1, mensagem: 'O código Mermaid está vazio.' }); return res; }
  const tipo = detectarTipoMermaid(codigo);
  if (!tipo) { res.erros.push({ linha: linhas[0].n, mensagem: 'Tipo de diagrama não reconhecido. Comece com "flowchart TD", "sequenceDiagram", "gantt" ou "pie".' }); return res; }
  if (tipo.startsWith('nao_suportado:')) { res.erros.push({ linha: linhas[0].n, mensagem: `O diagrama "${tipo.split(':')[1]}" não é suportado pelo renderizador offline do Athenes (suportados: flowchart, sequenceDiagram, gantt, pie).` }); return res; }
  res.tipo = tipo;
  const p = analisar(codigo, linhas, tipo);
  res.erros = p.erros; res.avisos = p.avisos;
  res.ok = p.erros.length === 0;
  return res;
}

function analisar(codigo, linhas, tipo) {
  if (tipo === 'flowchart') return parseFlowchart(linhas);
  if (tipo === 'sequence') return parseSequence(linhas);
  if (tipo === 'gantt') return parseGantt(linhas);
  return parsePie(linhas);
}

/**
 * Renderiza Mermaid (subconjunto) em SVG vetorial herdando o tema do documento.
 * @returns {{ok:boolean, svg:string, largura:number, altura:number, tipo:string, erros:object[], avisos:string[]}}
 */
export function renderizarMermaid(codigo, tema) {
  const t = tema || criarTemaVisual();
  const v = validarMermaid(codigo);
  if (!v.ok) return { ok: false, svg: '', largura: 0, altura: 0, tipo: v.tipo, erros: v.erros, avisos: v.avisos };
  const linhas = linhasUteis(codigo);
  const parsed = analisar(codigo, linhas, v.tipo);
  let r;
  if (v.tipo === 'pie') {
    const g = renderizarGraficoJson({ tipo: 'pizza', titulo: parsed.titulo, dados: parsed.dados, largura: 640, altura: 380 }, t);
    return { ...g, tipo: 'pie', avisos: v.avisos };
  }
  if (v.tipo === 'flowchart') r = renderFlowchart(parsed, t);
  else if (v.tipo === 'sequence') r = renderSequence(parsed, t);
  else r = renderGantt(parsed, t);
  const [x0, y0, W, H] = r.vb.map(n => +n.toFixed(2));
  const fundo = t.fundo ? `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${t.fundo}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="${t.fonte}" role="img" aria-label="Diagrama ${v.tipo}">${fundo}${r.corpo}</svg>`;
  return { ok: true, svg, largura: W, altura: H, tipo: v.tipo, erros: [], avisos: v.avisos };
}

/** Normaliza a indentação (4 espaços dentro de blocos; 2 em subgraph/loop/alt…). */
export function formatarMermaid(codigo) {
  const linhas = String(codigo ?? '').replace(/\r/g, '').split('\n');
  const out = [];
  let nivel = 0;
  linhas.forEach((l, i) => {
    const t = l.trim();
    if (!t) { if (out.length && out[out.length - 1] !== '') out.push(''); return; }
    if (i === 0 || /^(flowchart|graph|sequenceDiagram|gantt|pie)\b/i.test(t)) { out.push(t); return; }
    if (/^(end)$/i.test(t)) nivel = Math.max(0, nivel - 1);
    const sep = /^(else|and|option)\b/i.test(t);
    out.push('  '.repeat(Math.max(0, (sep ? nivel - 1 : nivel) + 1)) + t);
    if (/^(subgraph|loop|alt|opt|par|critical|break|rect)\b/i.test(t)) nivel++;
  });
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

export const EXEMPLOS_MERMAID = Object.freeze({
  flowchart: 'flowchart TD\n  A([Início]) --> B[Coletar dados]\n  B --> C{Dados válidos?}\n  C -->|Sim| D[Analisar]\n  C -->|Não| B\n  D --> E[(Banco de dados)]\n  D --> F([Fim])',
  sequence: 'sequenceDiagram\n  autonumber\n  participant U as Usuário\n  participant S as Servidor\n  U->>S: Solicita relatório\n  activate S\n  S-->>U: Retorna PDF\n  deactivate S\n  Note over U,S: Processo concluído',
  gantt: 'gantt\n  title Cronograma da pesquisa\n  dateFormat YYYY-MM-DD\n  section Planejamento\n  Revisão da literatura :done, rev, 2026-01-05, 30d\n  Projeto :active, proj, after rev, 15d\n  section Execução\n  Coleta de dados :crit, col, after proj, 45d\n  Análise : ana, after col, 20d',
  pie: 'pie title Fontes de financiamento\n  "Pública" : 52\n  "Privada" : 31\n  "Mista" : 17'
});
