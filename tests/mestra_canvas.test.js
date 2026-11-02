// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  converterUnidade, criarElementoLivre, redimensionar, calcularSnap, alvosDeSnap, alinharElementos, distribuirElementos,
  mudarOrdemZ, ordemDeEmpilhamento, resolverMestraDaPagina, normalizarRegrasMestra,
  elementosEfetivosDaPagina, sobrescreverElemento, restaurarElemento, margensEfetivasMm, caixaEnvolvente, travarAngulo,
  anguloPeloPonteiro, posicionarPorAncora, pontoDeAncora, resolverVariaveisTexto, espelharElemento, normalizarMestraCanvas,
  paraReferencia, deReferencia, linhasDeGrade, normalizarGradeGuia
} from '../src/core/athenes_mestra_canvas.js';
import { elementosMestraHtml } from '../src/core/athenes_mestra_render.js';
import { geometriaCorpoMm } from '../src/core/athenes_paginacao.js';
import { criarDocumento, repaginarDocumento } from '../src/core/athenes_documento.js';
import { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo } from '../src/core/athenes_pacote_estilo.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';

const el = (o = {}) => ({ id: 'a', x_mm: 10, y_mm: 10, largura_mm: 40, altura_mm: 20, rotacao_graus: 0, ...o });

test('unidades: mm, cm, pt, px', () => {
  assert.equal(converterUnidade(1, 'cm', 'mm'), 10);
  assert.equal(converterUnidade(72, 'pt', 'mm'), 25.4);
  assert.equal(converterUnidade(96, 'px', 'mm'), 25.4);
  assert.equal(converterUnidade(25.4, 'mm', 'pt'), 72);
  assert.throws(() => converterUnidade(1, 'km', 'mm'));
});

test('redimensionar: alças, proporção, centro e mínimo', () => {
  const r = redimensionar(el(), 'se', 10, 5);
  assert.deepEqual([r.largura_mm, r.altura_mm, r.x_mm, r.y_mm], [50, 25, 10, 10]);
  const o = redimensionar(el(), 'nw', 5, 5);
  assert.deepEqual([o.x_mm, o.y_mm, o.largura_mm, o.altura_mm], [15, 15, 35, 15]);
  const p = redimensionar(el(), 'e', 20, 0, { proporcional: true });
  assert.equal(p.largura_mm / p.altura_mm, 2);
  const c = redimensionar(el(), 'e', 5, 0, { centro: true });
  assert.deepEqual([c.x_mm, c.largura_mm], [5, 50]);
  assert.equal(redimensionar(el(), 'e', -100, 0).largura_mm, 2);
});

test('redimensionar com rotação 90° leva o arraste ao referencial local', () => {
  const r = redimensionar(el({ rotacao_graus: 90 }), 'e', 0, 10);
  assert.equal(r.largura_mm, 50);
  assert.equal(r.altura_mm, 20);
});

test('caixa envolvente e ângulos', () => {
  const b = caixaEnvolvente(el({ rotacao_graus: 90 }));
  assert.deepEqual([b.w, b.h], [20, 40]);
  assert.equal(travarAngulo(80), 90);
  assert.equal(travarAngulo(350), 0);
  assert.equal(travarAngulo(-100), 270);
  assert.equal(anguloPeloPonteiro(el(), 30, -50), 0);
});

test('âncora de 9 pontos e referência folha/margem', () => {
  const e = el();
  assert.deepEqual(pontoDeAncora(e, 'c'), { x: 30, y: 20 });
  assert.deepEqual(pontoDeAncora(e, 'se'), { x: 50, y: 30 });
  posicionarPorAncora(e, 'c', 105, 148.5);
  assert.deepEqual([e.x_mm, e.y_mm], [85, 138.5]);
  const rel = paraReferencia(el(), 'margem', { l: 25, t: 20 });
  assert.deepEqual(rel, { x: -15, y: -10 });
  assert.deepEqual(deReferencia(rel.x, rel.y, 'margem', { l: 25, t: 20 }), { x: 10, y: 10 });
});

test('snapping: centro da página, margens e outros elementos', () => {
  const alvos = alvosDeSnap({ larguraMm: 210, alturaMm: 297, margens: { t: 25, r: 20, b: 20, l: 25 }, elementos: [el({ id: 'o', x_mm: 100, y_mm: 200 })], ignorarId: 'x' });
  const s = calcularSnap({ x: 84, y: 50, w: 40, h: 10 }, alvos, 1.5);
  assert.equal(s.dx, 1);
  assert.deepEqual(s.guias.find(g => g.eixo === 'v'), { eixo: 'v', pos_mm: 105 });
  const m = calcularSnap({ x: 24.2, y: 100, w: 10, h: 10 }, alvos, 1.5);
  assert.equal(m.dx, 0.8);
  assert.deepEqual(calcularSnap({ x: 60, y: 120, w: 5, h: 5 }, alvos, 1), { dx: 0, dy: 0, guias: [] });
});

test('alinhar e distribuir', () => {
  const l = [el({ id: '1', x_mm: 10 }), el({ id: '2', x_mm: 60, largura_mm: 20 }), el({ id: '3', x_mm: 200, largura_mm: 10 })];
  alinharElementos(l, 'esquerda');
  assert.deepEqual(l.map(e => e.x_mm), [10, 10, 10]);
  const d = [el({ id: '1', x_mm: 0, largura_mm: 10 }), el({ id: '2', x_mm: 20, largura_mm: 10 }), el({ id: '3', x_mm: 100, largura_mm: 10 })];
  distribuirElementos(d, 'h');
  assert.deepEqual(d.map(e => e.x_mm), [0, 50, 100]);
  const u = [el({ x_mm: 0 })];
  alinharElementos(u, 'centro', { x: 0, y: 0, w: 210, h: 297 });
  assert.equal(u[0].x_mm, 85);
  const trav = [el({ x_mm: 5, bloqueado: true }), el({ id: 'b', x_mm: 50 })];
  alinharElementos(trav, 'esquerda');
  assert.equal(trav[0].x_mm, 5);
});

test('camadas: frente, trás, avançar, recuar; fundo sempre abaixo', () => {
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'f', camada: 'fundo' }];
  mudarOrdemZ(l, 'a', 'frente');
  assert.deepEqual(ordemDeEmpilhamento(l).map(e => e.id), ['f', 'b', 'c', 'a']);
  mudarOrdemZ(l, 'a', 'recuar');
  assert.deepEqual(ordemDeEmpilhamento(l).map(e => e.id), ['f', 'b', 'a', 'c']);
  mudarOrdemZ(l, 'c', 'tras');
  assert.deepEqual(ordemDeEmpilhamento(l).map(e => e.id), ['f', 'c', 'b', 'a']);
  mudarOrdemZ(l, 'c', 'avancar');
  assert.deepEqual(ordemDeEmpilhamento(l).map(e => e.id), ['f', 'b', 'c', 'a']);
});

test('atribuição por intervalo: o mais específico vence', () => {
  const regras = normalizarRegrasMestra([
    { mestraId: 'A', de: 1, ate: 3 }, { mestraId: 'B', de: 4 }, { mestraId: 'C', de: 12, ate: 12 }, { mestraId: 'X', de: 5, ate: 2 }
  ]);
  assert.equal(regras.length, 3);
  assert.equal(resolverMestraDaPagina(regras, 2), 'A');
  assert.equal(resolverMestraDaPagina(regras, 4), 'B');
  assert.equal(resolverMestraDaPagina(regras, 12), 'C');
  assert.equal(resolverMestraDaPagina(regras, 13), 'B');
  assert.equal(resolverMestraDaPagina([], 1), null);
  assert.deepEqual(normalizarRegrasMestra([{ mestraId: 'Z', de: 1 }], ['A']), []);
});

test('regras de atribuição trocam a mestra das páginas na repaginação', () => {
  const doc = criarDocumento('Teste', 'abnt');
  repaginarDocumento(doc);
  const alvo = doc.mestras.find(m => m.id !== doc.paginas[0].mestraId) || doc.mestras[0];
  doc.atribuicoes_mestra = [{ mestraId: alvo.id, de: 1, ate: 1 }];
  repaginarDocumento(doc);
  assert.equal(doc.paginas[0].mestraId, alvo.id);
});

test('overrides: herdado, sobrescrito, oculto e restauração', () => {
  const mestra = { elementos_recorrentes: [el({ id: 'a' }), el({ id: 'b', x_mm: 90 })] };
  const pag = {};
  assert.equal(elementosEfetivosDaPagina(mestra, pag).length, 2);
  sobrescreverElemento(pag, mestra.elementos_recorrentes[0], { x_mm: 77 });
  const ef = elementosEfetivosDaPagina(mestra, pag).find(e => e.id === 'a');
  assert.equal(ef.x_mm, 77);
  assert.equal(ef.sobrescrito, true);
  assert.equal(mestra.elementos_recorrentes[0].x_mm, 10);
  sobrescreverElemento(pag, mestra.elementos_recorrentes[1], { oculto: true });
  assert.equal(elementosEfetivosDaPagina(mestra, pag).length, 1);
  restaurarElemento(pag, 'b');
  assert.equal(elementosEfetivosDaPagina(mestra, pag).length, 2);
});

test('quadro de texto primário define as margens e a geometria do corpo', () => {
  const q = criarElementoLivre('quadro_texto', { x_mm: 30, y_mm: 40, largura_mm: 150, altura_mm: 200 });
  const mestra = { formato: 'A4', orientacao: 'retrato', margens_mm: { t: 25, r: 20, b: 20, l: 25 }, elementos_recorrentes: [q] };
  assert.deepEqual(margensEfetivasMm(mestra, 210, 297), { t: 40, l: 30, r: 30, b: 57 });
  const g = geometriaCorpoMm(mestra);
  assert.equal(g.topoMm, 40);
  assert.equal(g.baseMm, 57);
  assert.equal(g.margemEsq, 30);
  assert.deepEqual(margensEfetivasMm({ margens_mm: { t: 1, r: 2, b: 3, l: 4 } }, 210, 297), { t: 1, r: 2, b: 3, l: 4 });
});

test('variáveis dinâmicas e espelhamento', () => {
  assert.equal(resolverVariaveisTexto('Pág. {pagina}/{total} — {secao}', { pagina: 3, total: 10, secao: 'Intro' }), 'Pág. 3/10 — Intro');
  assert.equal(resolverVariaveisTexto('{{documento.titulo}}', { documento: { titulo: 'X' } }), 'X');
  assert.equal(resolverVariaveisTexto('{desconhecida}', {}), '{desconhecida}');
  const e = espelharElemento(el({ rotacao_graus: 30 }), 210);
  assert.deepEqual([e.x_mm, e.rotacao_graus], [160, 330]);
});

test('renderização: rotação, variáveis, camada, espelho e quadro só no editor', () => {
  const geo = { larguraMm: 210, alturaMm: 297, margens: { l: 25, r: 20, t: 25, b: 20 } };
  const t = criarElementoLivre('texto', { x_mm: 10, y_mm: 10, texto: 'p. {pagina}', rotacao_graus: 45 });
  const f = criarElementoLivre('forma', { forma: 'elipse', camada: 'fundo' });
  const q = criarElementoLivre('quadro_texto');
  const mestra = { espelhada: true, elementos_recorrentes: [t, f, q] };
  const html = elementosMestraHtml(mestra, { numero: 3 }, geo, { pagina: 3 });
  assert.match(html, /rotate\(45deg\)/);
  assert.match(html, /p\. 3/);
  assert.match(html, /border-radius:50%/);
  assert.doesNotMatch(html, /Quadro de texto principal/);
  assert.match(elementosMestraHtml(mestra, { numero: 3 }, geo, {}, { editor: true }), /Quadro de texto principal/);
  const par = elementosMestraHtml(mestra, { numero: 2 }, geo, { pagina: 2 });
  assert.match(par, /rotate\(315deg\)/);
});

test('normalizarMestraCanvas: ids únicos, transformação completa, quadro inválido removido', () => {
  const m = normalizarMestraCanvas({ quadro_texto_id: 'nao_existe', guias: [{ eixo: 'v', pos_mm: 10 }, { eixo: 'x', pos_mm: 1 }], elementos_recorrentes: [{ id: 'k', tipo: 'forma' }, { id: 'k', tipo: 'forma' }] });
  assert.notEqual(m.elementos_recorrentes[0].id, m.elementos_recorrentes[1].id);
  assert.equal(m.elementos_recorrentes[0].rotacao_graus, 0);
  assert.equal(m.quadro_texto_id, undefined);
  assert.equal(m.guias.length, 1);
});

test('pacote de estilo: elementos livres, guias e atribuições viajam no tema', () => {
  const doc = criarDocumento('T', 'abnt');
  const corpo = doc.mestras[1] || doc.mestras[0];
  corpo.elementos_recorrentes = [criarElementoLivre('forma', { rotacao_graus: 15 }), criarElementoLivre('quadro_texto')];
  corpo.guias = [{ eixo: 'v', pos_mm: 105 }];
  corpo.espelhada = true;
  doc.atribuicoes_mestra = [{ mestraId: corpo.id, de: 2 }];
  const pacote = exportarPacoteEstilo(doc);
  assert.deepEqual(pacote.configuracaoGlobal.atribuicoes_mestra, [{ mestraId: corpo.id, de: 2, ate: null }]);
  const v = validarPacoteEstilo(JSON.parse(JSON.stringify(pacote)));
  assert.ok(v.valido);
  const alvo = criarDocumento('Outro', 'abnt');
  aplicarPacoteEstilo(alvo, pacote);
  const m = alvo.mestras.find(x => x.id === corpo.id);
  assert.equal(m.elementos_recorrentes[0].rotacao_graus, 15);
  assert.equal(m.espelhada, true);
  assert.equal(m.guias[0].pos_mm, 105);
  assert.equal(alvo.atribuicoes_mestra.length, 1);
});

test('exportação PDF desenha elementos livres da mestra com rotação', () => {
  const doc = criarDocumento('T', 'abnt');
  repaginarDocumento(doc);
  const m = doc.mestras.find(x => x.id === doc.paginas[0].mestraId);
  m.elementos_recorrentes = [criarElementoLivre('texto', { texto: 'Rascunho {pagina}', rotacao_graus: 30 })];
  const html = gerarDocumentoHtmlPdf(doc);
  assert.match(html, /rotate\(30deg\)/);
  assert.match(html, /Rascunho 1/);
});

test('grade guia: malha, colunas com calha e ímã', () => {
  const g = normalizarGradeGuia({ visivel: true, passo_mm: 50, colunas: 2, calha_mm: 10 });
  const l = linhasDeGrade(g, 210, 297, { t: 20, r: 20, b: 20, l: 20 });
  assert.ok(l.v.includes(50) && l.v.includes(200));
  assert.ok(l.v.includes(20) && l.v.includes(100) && l.v.includes(110) && l.v.includes(190)); // 2 colunas de 80 mm, calha 10
  assert.deepEqual(normalizarGradeGuia({ passo_mm: 999, colunas: -3 }).passo_mm, 100);
  const alvos = alvosDeSnap({ larguraMm: 210, alturaMm: 297, grade: g });
  assert.ok(alvos.v.includes(50));
  assert.ok(!alvosDeSnap({ larguraMm: 210, alturaMm: 297, grade: { ...g, snap: false } }).v.includes(50));
  assert.equal(normalizarMestraCanvas({ grade_guia: { passo_mm: 5 } }).grade_guia.passo_mm, 5);
});
