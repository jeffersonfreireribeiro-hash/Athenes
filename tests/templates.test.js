// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import {
  criarDocumentoEmBranco, criarDocumentoDeTemplate, extrairEsqueleto, listarTemplatesNativos,
  salvarComoTemplate, listarTemplatesUsuario, removerTemplateUsuario, templateDeArquivoJson, miniaturaSvg
} from '../src/core/athenes_templates.js';

const memoria = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('documento em branco é limpo: 1 mestra, estilos essenciais, 1 seção, sem texto', () => {
  const d = criarDocumentoEmBranco({ titulo: 'X' });
  repaginarDocumento(d);
  assert.equal(d.mestras.length, 1);
  assert.deepEqual(d.estilos.map(e => e.id).sort(), ['corpo', 'titulo1', 'titulo2', 'titulo3']);
  assert.equal(d.secoes.length, 1);
  assert.equal(d.secoes[0].blocos.length, 1);
  assert.equal(d.secoes[0].blocos[0].texto, '');
  assert.equal(d.paginas.length, 1);
});

test('galeria nativa: artigo ABNT, relatório e IEEE em 2 colunas', () => {
  const n = listarTemplatesNativos();
  assert.equal(n.length, 3);
  const ieee = n.find(t => t.id === 'nativo_paper_ieee');
  assert.ok(ieee.config.mestras.some(m => m.grade.colunas === 2));
  const rel = n.find(t => t.categoria === 'report');
  assert.ok(rel.config.numeracao_secoes?.ativa);
  n.forEach(t => assert.match(miniaturaSvg(t), /^<svg/));
});

test('hidratar: placeholder mantém exemplos, vazio limpa textos; sem sobras e ids novos', () => {
  const t = listarTemplatesNativos().find(x => x.id === 'nativo_paper_ieee');
  const a = criarDocumentoDeTemplate(t, { titulo: 'Meu paper', modoConteudo: 'placeholder' });
  const v = criarDocumentoDeTemplate(t, { titulo: 'Meu paper', modoConteudo: 'vazio' });
  assert.equal(a.titulo, 'Meu paper');
  assert.ok(a.secoes.flatMap(s => s.blocos).some(b => (b.texto || '').length > 10));
  assert.ok(v.secoes.flatMap(s => s.blocos).every(b => !(b.texto || '').trim()));
  assert.equal(v.secoes.length, t.secoes.length);
  const idsT = new Set(t.secoes.flatMap(s => s.blocos.map(b => b.id)));
  assert.ok(a.secoes.flatMap(s => s.blocos).every(b => !idsT.has(b.id)), 'ids novos');
  const ids = a.mestras.map(m => m.id);
  assert.ok(a.secoes.every(s => ids.includes(s.mestraId)));
  repaginarDocumento(a); repaginarDocumento(v);
  assert.ok(a.paginas.length >= 1 && v.paginas.length >= 1);
});

test('esqueleto: sem texto, só mestras usadas e estilos', () => {
  const d = criarDocumento({ titulo: 'Fonte' });
  const e = extrairEsqueleto(d, { incluirConteudo: false });
  assert.ok(e.secoes.every(s => s.blocos.length === 0));
  assert.ok(e.config.mestras.every(m => d.secoes.some(s => s.mestraId === m.id)), 'sem mestras sobrando');
  assert.equal(e.config.estilos.length, d.estilos.length);
  assert.doesNotMatch(JSON.stringify(e), /Escreva diretamente/);
});

test('Meus Templates: salvar, listar, remover e importar de arquivo', () => {
  const st = memoria();
  const d = criarDocumento({ titulo: 'Base' });
  d.secoes[1].blocos.push(criarNovoBloco('paragrafo', { texto: 'segredo do autor' }));
  assert.throws(() => salvarComoTemplate(d, { nome: ' ' }, st));
  const solo = salvarComoTemplate(d, { nome: 'Layout', categoria: 'report' }, st);
  const comEx = salvarComoTemplate(d, { nome: 'Com exemplo', incluirConteudo: true }, st);
  assert.equal(listarTemplatesUsuario(st).length, 2);
  assert.doesNotMatch(JSON.stringify(solo), /segredo do autor/);
  assert.match(JSON.stringify(comEx), /segredo do autor/);
  assert.equal(solo.categoria, 'report');
  removerTemplateUsuario(solo.id, st);
  assert.deepEqual(listarTemplatesUsuario(st).map(t => t.id), [comEx.id]);
  const arq = templateDeArquivoJson(JSON.parse(JSON.stringify(d)), 'base.json');
  assert.doesNotMatch(JSON.stringify(arq), /segredo do autor/);
  assert.throws(() => templateDeArquivoJson({ a: 1 }));
});

test('tema: Meus templates viajam no pacote athenes-tema-v1 e voltam saneados', async () => {
  const { exportarPacoteEstilo, validarPacoteEstilo, aplicarPacoteEstilo } = await import('../src/core/athenes_pacote_estilo.js');
  const { importarTemplatesDoPacote } = await import('../src/core/athenes_templates.js');
  const st = memoria();
  const d = criarDocumento({ titulo: 'Base' });
  d.estilos.find(e => e.id === 'corpo').avancado = { capitular: { ativa: true, linhas: 99 } };
  const t = salvarComoTemplate(d, { nome: 'Do tema', categoria: 'academic' }, st);
  const pacote = exportarPacoteEstilo(d, { templates: listarTemplatesUsuario(st) });
  assert.equal(pacote.templates.length, 1);
  assert.equal(exportarPacoteEstilo(d).templates, undefined, 'sem templates, o campo não aparece');
  const json = JSON.parse(JSON.stringify(pacote));
  json.templates.push({ titulo: 'quebrado' }, { titulo: 'x', config: { estilos: [], mestras: [] } });
  const v = validarPacoteEstilo(json);
  assert.ok(v.valido, v.erro);
  assert.equal(v.pacote.templates.length, 1, 'inválidos são descartados');
  assert.equal(v.pacote.templates[0].config.estilos.find(e => e.id === 'corpo').avancado.capitular.linhas, 6, 'estilo avançado saneado');
  const destino = memoria();
  const r = aplicarPacoteEstilo(criarDocumento({ titulo: 'Outro' }), v.pacote, { storage: destino });
  assert.equal(r.templatesImportados, 1);
  assert.equal(listarTemplatesUsuario(destino)[0].titulo, 'Do tema');
  assert.equal(importarTemplatesDoPacote(v.pacote.templates, destino), 0, 'importar de novo não duplica');
  assert.equal(aplicarPacoteEstilo(criarDocumento({ titulo: 'Sem storage' }), v.pacote).templatesImportados, 0);
  void t;
});
