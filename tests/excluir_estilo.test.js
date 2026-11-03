// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento, criarNovoBloco, repaginarDocumento } from '../src/core/athenes_documento.js';
import { contarUsoDoEstilo, excluirEstilo, ESTILOS_PROTEGIDOS } from '../src/core/athenes_estilos.js';

function docComUso() {
  const doc = criarDocumento({ titulo: 'T' });
  doc.estilos.push({ id: 'meu', nome: 'Meu estilo', fonte: 'nunito', tamanho_pt: 12, peso: 400, entrelinha: 1.5, alinhamento: 'esquerda', cor: '#1F2733' });
  const corpo = doc.secoes.find(s => s.mestraId === 'corpo');
  corpo.blocos = [
    criarNovoBloco('paragrafo', { id: 'p1', texto: 'a', estiloId: 'meu' }),
    criarNovoBloco('paragrafo', { id: 'p2', texto: 'b', estiloId: 'meu' }),
    criarNovoBloco('paragrafo', { id: 'p3', texto: 'c', estiloId: 'corpo' }),
    criarNovoBloco('titulo', { id: 't1', nivel: 2, texto: 'T', estiloId: 'titulo2' }),
    Object.assign(criarNovoBloco('tabela', { id: 'tab', titulo: 'Tabela', linhas: [['1']], colunas: ['A'] }), { legenda_estilo_id: 'meu', titulo_estilo_id: 'corpo' })
  ];
  return { doc, corpo };
}

test('contar o uso inclui estilos auxiliares (legenda, título, fonte, numeração, dados)', () => {
  const { doc } = docComUso();
  assert.equal(contarUsoDoEstilo(doc, 'meu'), 3);
  assert.equal(contarUsoDoEstilo(doc, 'inexistente'), 0);
});

test('excluir qualquer estilo (não só os "seus"): blocos vão para o Corpo e as referências auxiliares são removidas', () => {
  const { doc, corpo } = docComUso();
  const r = excluirEstilo(doc, 'meu');
  assert.deepEqual([r.ok, r.reatribuidos, r.substituto], [true, 3, 'corpo']);
  assert.ok(!doc.estilos.some(e => e.id === 'meu'));
  assert.deepEqual(corpo.blocos.filter(b => b.tipo === 'paragrafo').map(b => b.estiloId), ['corpo', 'corpo', 'corpo']);
  const tab = corpo.blocos.find(b => b.id === 'tab');
  assert.equal('legenda_estilo_id' in tab, false, 'volta ao padrão do bloco');
  assert.equal(tab.titulo_estilo_id, 'corpo', 'outras referências intactas');
  assert.equal(contarUsoDoEstilo(doc, 'meu'), 0);
  repaginarDocumento(doc); // o documento continua válido
  assert.ok(doc.paginas.length >= 1);
});

test('estilos que vieram do modelo/Word (sem a marca "personalizado") também podem ser excluídos', () => {
  const doc = criarDocumento({ titulo: 'T' });
  const alvo = doc.estilos.find(e => e.id === 'subtitulo') || doc.estilos.find(e => e.id !== 'corpo' && !e.id.startsWith('titulo'));
  assert.ok(!alvo.personalizado);
  assert.equal(excluirEstilo(doc, alvo.id).ok, true);
  assert.ok(!doc.estilos.some(e => e.id === alvo.id));
});

test('título excluído cai no título do mesmo nível; o Corpo é protegido', () => {
  const { doc, corpo } = docComUso();
  const t = corpo.blocos.find(b => b.id === 't1');
  t.estiloId = 'titulo2';
  doc.estilos.push({ ...doc.estilos.find(e => e.id === 'titulo2'), id: 'titulo2_alt' });
  t.estiloId = 'titulo2_alt';
  assert.equal(excluirEstilo(doc, 'titulo2_alt').ok, true);
  assert.equal(t.estiloId, 'titulo2');
  assert.deepEqual(ESTILOS_PROTEGIDOS, ['corpo']);
  const r = excluirEstilo(doc, 'corpo');
  assert.deepEqual([r.ok, r.motivo], [false, 'protegido']);
  assert.ok(doc.estilos.some(e => e.id === 'corpo'));
  assert.equal(excluirEstilo(doc, 'nao_existe').motivo, 'inexistente');
});

test('Título 4–6 excluídos não voltam sozinhos ao normalizar o documento', async () => {
  const { garantirEstilosDeTitulos } = await import('../src/core/athenes_estilos.js');
  const doc = criarDocumento({ titulo: 'T' });
  garantirEstilosDeTitulos(doc);
  assert.ok(doc.estilos.some(e => e.id === 'titulo4'));
  assert.equal(excluirEstilo(doc, 'titulo4').ok, true);
  garantirEstilosDeTitulos(doc);
  assert.ok(!doc.estilos.some(e => e.id === 'titulo4'));
});
