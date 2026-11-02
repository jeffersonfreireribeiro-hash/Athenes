// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  caminhoDaPasta, permissaoNaPasta, papelNoDocumento, validarMovimento, moverDocumento, desfazerMovimento, planejarMovimentoEmLote,
  arvoreDeDestinos, tituloDaCopia, clonarComNovosIds, duplicarDocumento, duplicarEmLote, RAIZ_PADRAO
} from '../src/core/athenes_arquivos.js';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';

const eu = { id: 'usr_eu', nome: 'Eu' };
const colega = { id: 'usr_colega', nome: 'Colega' };

const pastas = () => [
  { id: 'pasta_bib_raiz', nome: 'Bibliografia', tipo: 'bibliografia', origem: 'minhas', subpastas: [] },
  { id: 'pasta_rel_raiz', nome: 'Relatórios & Artigos', tipo: 'relatorios', origem: 'minhas', subpastas: [
    { id: 'sub_a', nome: 'Tese', tipo: 'relatorios', origem: 'minhas', subpastas: [{ id: 'sub_a1', nome: 'Capítulos', tipo: 'relatorios', origem: 'minhas', subpastas: [] }] },
    { id: 'sub_b', nome: 'Artigos', tipo: 'relatorios', origem: 'minhas', subpastas: [] }
  ] },
  { id: 'comp_leitura', nome: 'Do Prof.', tipo: 'compartilhada', origem: 'compartilhada', permissao: 'leitura', subpastas: [{ id: 'comp_sub', nome: 'Rascunhos', tipo: 'compartilhada', origem: 'compartilhada', subpastas: [] }] },
  { id: 'comp_edicao', nome: 'Grupo', tipo: 'compartilhada', origem: 'compartilhada', permissao: 'edicao', subpastas: [] }
];
const ctx = (extra = {}) => ({ perfil: eu, pastas: pastas(), ...extra });

function novoDoc(titulo, extra = {}) {
  const d = criarDocumento({ titulo });
  Object.assign(d, { proprietario: { id: eu.id, nome: eu.nome }, pastaId: 'sub_a' }, extra);
  return d;
}

test('árvore de pastas e permissões efetivas', () => {
  const p = pastas();
  assert.deepEqual(caminhoDaPasta(p, 'sub_a1').map(x => x.nome), ['Relatórios & Artigos', 'Tese', 'Capítulos']);
  assert.deepEqual(caminhoDaPasta(p, 'nao_existe'), []);
  assert.equal(permissaoNaPasta(p, 'sub_a1'), 'admin');
  assert.equal(permissaoNaPasta(p, 'comp_leitura'), 'leitura');
  assert.equal(permissaoNaPasta(p, 'comp_sub'), 'leitura', 'subpasta herda a permissão da compartilhada');
  assert.equal(permissaoNaPasta(p, 'comp_edicao'), 'edicao');
});

test('propriedade: dono, compartilhado com permissão e documentos legados', () => {
  const p = pastas();
  assert.equal(papelNoDocumento(novoDoc('A'), eu, p), 'proprietario');
  assert.equal(papelNoDocumento({ proprietario: { id: colega.id }, permissao: 'comentario' }, eu, p), 'comentario');
  assert.equal(papelNoDocumento({ id: 'x', titulo: 'legado', tipoDoc: 'artigo' }, eu, p), 'proprietario', 'sem dono gravado = do usuário');
  assert.equal(papelNoDocumento({ id: 'y', pastaId: 'comp_leitura', tipoDoc: 'artigo' }, eu, p), 'leitura', 'sem dono, em pasta de outra pessoa');
});

test('mover: dono move entre pastas próprias e para a raiz', () => {
  const d = novoDoc('A');
  assert.deepEqual(validarMovimento(d, 'sub_b', ctx()), { ok: true });
  const r = moverDocumento(d, 'sub_b', ctx());
  assert.equal(r.ok, true); assert.equal(d.pastaId, 'sub_b');
  desfazerMovimento(d, r.anterior);
  assert.equal(d.pastaId, 'sub_a', 'rollback devolve a pasta de origem');
  assert.equal(moverDocumento(d, null, ctx()).ok, true);
  assert.equal(d.pastaId, RAIZ_PADRAO, 'null = raiz "Meus Arquivos"');
  const legado = { id: 'l', tipoDoc: 'artigo' };
  const m = moverDocumento(legado, 'sub_b', ctx());
  desfazerMovimento(legado, m.anterior);
  assert.equal('pastaId' in legado, false);
});

test('mover: recusas claras (mesma pasta, inexistente, bibliografia, somente leitura)', () => {
  const d = novoDoc('A');
  assert.equal(validarMovimento(d, 'sub_a', ctx()).codigo, 'mesma_pasta');
  assert.equal(validarMovimento(d, 'fantasma', ctx()).codigo, 'destino_inexistente');
  assert.equal(validarMovimento(d, 'pasta_bib_raiz', ctx()).codigo, 'destino_incompativel');
  assert.equal(validarMovimento(d, 'comp_leitura', ctx()).codigo, 'destino_somente_leitura');
  assert.equal(validarMovimento(d, 'comp_sub', ctx()).codigo, 'destino_somente_leitura');
  assert.equal(validarMovimento(d, 'comp_edicao', ctx()).ok, true, 'pasta compartilhada com edição aceita');
  const naLeitura = novoDoc('B', { pastaId: 'comp_leitura' });
  assert.equal(validarMovimento(naLeitura, 'sub_b', ctx()).codigo, 'origem_somente_leitura');
});

test('mover arquivo compartilhado comigo: bloqueia e oferece cópia; edição/admin pode mover o original', () => {
  const compart = novoDoc('De outro', { proprietario: { id: colega.id, nome: 'Colega' }, permissao: 'leitura', pastaId: 'comp_edicao' });
  const v = validarMovimento(compart, 'sub_b', ctx());
  assert.equal(v.ok, false); assert.equal(v.codigo, 'compartilhado'); assert.equal(v.oferecerCopia, true);
  assert.match(v.motivo, /Compartilhados comigo/);
  assert.equal(moverDocumento(compart, 'sub_b', ctx()).ok, false);
  assert.equal(compart.pastaId, 'comp_edicao', 'nada mudou');
  const comentario = { ...compart, permissao: 'comentario' };
  assert.equal(validarMovimento(comentario, 'sub_b', ctx()).codigo, 'compartilhado');
  const editor = { ...compart, permissao: 'edicao' };
  assert.equal(validarMovimento(editor, 'sub_b', ctx()).ok, true);
});

test('mover em lote separa o que pode do que não pode', () => {
  const a = novoDoc('A'); const b = novoDoc('B', { pastaId: 'sub_b' }); const c = novoDoc('C', { proprietario: { id: colega.id }, permissao: 'leitura' });
  const plano = planejarMovimentoEmLote([a, b, c], 'sub_b', ctx());
  assert.deepEqual(plano.moviveis.map(d => d.titulo), ['A']);
  assert.deepEqual(plano.bloqueados.map(x => [x.doc.titulo, x.codigo]), [['B', 'mesma_pasta'], ['C', 'compartilhado']]);
});

test('árvore de destinos marca pastas indisponíveis e some com a bibliografia', () => {
  const t = arvoreDeDestinos(pastas(), novoDoc('A'), ctx());
  const achar = (lista, id) => lista.flatMap(function f(n) { return [n, ...n.subpastas.flatMap(f)]; }).find(n => n.id === id);
  assert.equal(achar(t, 'pasta_bib_raiz'), undefined);
  assert.equal(achar(t, 'sub_b').habilitada, true);
  assert.equal(achar(t, 'comp_leitura').habilitada, false);
  assert.match(achar(t, 'comp_leitura').motivo, /leitura|permissão/i);
  assert.equal(achar(t, 'comp_edicao').habilitada, true);
});

test('título da cópia: "Cópia de", numerada quando já existe', () => {
  assert.equal(tituloDaCopia('Tese'), 'Cópia de Tese');
  assert.equal(tituloDaCopia('Cópia de Tese'), 'Cópia de Tese', 'não empilha "Cópia de Cópia de"');
  assert.equal(tituloDaCopia('Tese', ['cópia de tese']), 'Cópia de Tese (2)');
  assert.equal(tituloDaCopia('Tese', ['Cópia de Tese', 'Cópia de Tese (2)']), 'Cópia de Tese (3)');
});

test('cópia profunda: ids novos em tudo e referências reescritas, sem tocar no original', () => {
  const d = novoDoc('Original');
  const sec = d.secoes.find(s => s.mestraId === 'corpo');
  const alvo = criarNovoBloco('titulo', { id: 'bloco_alvo_1', texto: 'Intro' });
  const outro = criarNovoBloco('paragrafo', { id: 'bloco_alvo_10', texto: `Veja <a data-ref-id="bloco_alvo_1">a seção</a> e <sup data-nota="nota_x1">1</sup>.` });
  sec.blocos = [alvo, outro];
  d.notasRodape = [{ id: 'nota_x1', html: 'Nota' }];
  d.sugestoes = [{ id: 'sug_1', blocoId: 'bloco_alvo_10' }];
  const antes = JSON.stringify(d);
  const { doc: c, mapaIds } = clonarComNovosIds(d);
  assert.equal(JSON.stringify(d), antes, 'original intacto');
  assert.notEqual(c.id, d.id);
  const cb = c.secoes.find(s => s.mestraId === 'corpo').blocos;
  assert.notEqual(cb[0].id, 'bloco_alvo_1'); assert.notEqual(cb[1].id, 'bloco_alvo_10');
  assert.ok(cb[1].texto.includes(`data-ref-id="${cb[0].id}"`), 'referência cruzada aponta para o novo bloco');
  assert.ok(cb[1].texto.includes(`data-nota="${c.notasRodape[0].id}"`) && c.notasRodape[0].id !== 'nota_x1');
  assert.equal(c.sugestoes[0].blocoId, cb[1].id);
  assert.ok(!JSON.stringify(c).includes('bloco_alvo_1"'), 'nenhum id antigo sobra (o prefixo bloco_alvo_1 não vaza em bloco_alvo_10)');
  assert.equal(mapaIds.size >= 6, true);
});

test('duplicar o próprio documento: mesma pasta, dono = usuário, desconectado', () => {
  const d = novoDoc('Tese', { salvoNuvem: true, estado: 'finalizado', colaboradores: [colega] });
  repaginarDocumento(d);
  const { doc: c, compartilhado, pastaDestinoId } = duplicarDocumento(d, ctx({ documentos: [d] }));
  assert.equal(compartilhado, false);
  assert.equal(pastaDestinoId, 'sub_a'); assert.equal(c.pastaId, 'sub_a');
  assert.equal(c.titulo, 'Cópia de Tese');
  assert.deepEqual(c.proprietario, { id: eu.id, nome: eu.nome });
  assert.equal(c.salvoNuvem, false); assert.equal(c.estado, 'rascunho');
  assert.equal(c.colaboradores, undefined);
  assert.equal(c.copiadoDe.id, d.id);
  assert.equal(c.paginas, undefined, 'páginas são recalculadas');
  assert.equal(c.secoes.length, d.secoes.length);
  // mexer na cópia não afeta o original
  c.secoes[0].blocos[0].texto = 'ALTERADO';
  assert.notEqual(d.secoes[0].blocos[0].texto, 'ALTERADO');
  assert.equal(d.pastaId, 'sub_a');
});

test('duplicar compartilhado: vira meu, vai para a pasta ativa ou para "Meus Arquivos"', () => {
  const comp = novoDoc('Do colega', { proprietario: { id: colega.id, nome: 'Colega' }, permissao: 'comentario', pastaId: 'comp_leitura', salvoNuvem: true });
  let r = duplicarDocumento(comp, ctx({ documentos: [comp], pastaAtivaId: 'sub_b' }));
  assert.equal(r.compartilhado, true);
  assert.equal(r.doc.pastaId, 'sub_b', 'pasta ativa própria');
  assert.equal(r.doc.proprietario.id, eu.id);
  assert.equal(r.doc.permissao, undefined);
  r = duplicarDocumento(comp, ctx({ documentos: [comp], pastaAtivaId: 'comp_leitura' }));
  assert.equal(r.doc.pastaId, RAIZ_PADRAO, 'pasta ativa somente leitura: cai na raiz');
  r = duplicarDocumento(comp, ctx({ documentos: [comp] }));
  assert.equal(r.doc.pastaId, RAIZ_PADRAO);
  assert.equal(papelNoDocumento(r.doc, eu, pastas()), 'proprietario');
  assert.throws(() => duplicarDocumento({ ...comp, precisaCarregarConteudo: true }, ctx()), /nuvem/);
});

test('duplicar em lote gera títulos distintos', () => {
  const a = novoDoc('Tese'); const b = novoDoc('Tese');
  const r = duplicarEmLote([a, b], ctx({ documentos: [a, b] }));
  assert.deepEqual(r.map(x => x.doc.titulo), ['Cópia de Tese', 'Cópia de Tese (2)']);
  assert.equal(new Set(r.map(x => x.doc.id)).size, 2);
});
