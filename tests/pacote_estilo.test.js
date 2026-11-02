// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { criarDocumento, criarNovoBloco } from '../src/core/athenes_documento.js';
import {
  exportarPacoteEstilo,
  validarPacoteEstilo,
  aplicarPacoteEstilo,
  obterPromptIaParaExtracaoDeLayout,
  VERSAO_SCHEMA_TEMA
} from '../src/core/athenes_pacote_estilo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Athenes — Sistema de Pacotes de Estilo Editorial e Temas (athenes-tema-v1)', async (t) => {
  await t.test('1. Exportar pacote de estilo gera objeto completo com estilos, mestras e molduras', () => {
    const doc = criarDocumento({ titulo: 'Pesquisa Acústica Avançada' });
    const blocoFig = criarNovoBloco('figura', {
      moldura_tipo: 'linha_lateral',
      linha_estilo: 'dupla',
      linha_cor: '#1D4ED8',
      padding_pt: 12
    });
    doc.secoes[0].blocos.push(blocoFig);

    const pacote = exportarPacoteEstilo(doc, {
      nome: 'Tema Artigo Acústica',
      autor: 'Laboratório de Áudio'
    });

    assert.equal(pacote.formato, VERSAO_SCHEMA_TEMA);
    assert.equal(pacote.metadados.nome, 'Tema Artigo Acústica');
    assert.equal(pacote.metadados.autor, 'Laboratório de Áudio');
    assert.ok(Array.isArray(pacote.estilos), 'Deve conter a lista de estilos de texto');
    assert.ok(pacote.estilos.length >= 7, 'Deve conter pelo menos os 7 estilos essenciais');
    assert.ok(Array.isArray(pacote.mestras), 'Deve conter a lista de páginas mestras');
    assert.ok(pacote.mestras.length >= 2, 'Deve conter mestras de Capa e Corpo');
    assert.ok(pacote.layout_padrao_figuras, 'Deve conter configurações padrão de moldura');
    assert.equal(pacote.layout_padrao_figuras.figura.moldura_tipo, 'linha_lateral');
    assert.equal(pacote.layout_padrao_figuras.figura.linha_estilo, 'dupla');
  });

  await t.test('2. Validação de pacote JSON detecta estruturas inválidas ou válidas', () => {
    // Inválido por não ser JSON
    const resInvalidoJson = validarPacoteEstilo('{ json quebrado }');
    assert.equal(resInvalidoJson.valido, false);

    // Inválido por falta de estilos
    const resSemEstilos = validarPacoteEstilo({ formato: VERSAO_SCHEMA_TEMA, estilos: [] });
    assert.equal(resSemEstilos.valido, false);

    // Válido
    const doc = criarDocumento();
    const pacote = exportarPacoteEstilo(doc);
    const resValido = validarPacoteEstilo(JSON.stringify(pacote));
    assert.equal(resValido.valido, true);
    assert.ok(resValido.pacote.estilos.length > 0);
  });

  await t.test('3. Aplicar pacote de estilo atualiza documento ativo e propaga para blocos', () => {
    const docDestino = criarDocumento({ titulo: 'Relatório Técnico em Branco' });
    const blocoFig = criarNovoBloco('figura', { moldura_tipo: 'limpo' });
    docDestino.secoes[0].blocos.push(blocoFig);

    // Cria pacote customizado com cores e estilos diferentes
    const docOrigem = criarDocumento();
    const estTitulo1 = docOrigem.estilos.find(e => e.id === 'titulo1');
    if (estTitulo1) {
      estTitulo1.cor = '#E11D48';
      estTitulo1.tamanho_pt = 18;
    }

    const pacote = exportarPacoteEstilo(docOrigem, { nome: 'Tema Rosa Editorial' });
    pacote.layout_padrao_figuras.figura = {
      moldura_tipo: 'esquadro',
      linha_estilo: 'tracejada',
      linha_cor: '#E11D48'
    };

    const resultado = aplicarPacoteEstilo(docDestino, pacote, { aplicarNosBlocosExistentes: true });
    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.temaNome, 'Tema Rosa Editorial');

    // Confere se o estilo do documento de destino foi alterado
    const titulo1Destino = docDestino.estilos.find(e => e.id === 'titulo1');
    assert.equal(titulo1Destino.cor, '#E11D48');
    assert.equal(titulo1Destino.tamanho_pt, 18);

    // Confere se o bloco de figura foi atualizado com a nova moldura
    assert.equal(blocoFig.moldura_tipo, 'esquadro');
    assert.equal(blocoFig.linha_estilo, 'tracejada');
  });

  await t.test('4. Idempotência: Exportar -> Importar preserva os mesmos atributos', () => {
    const docA = criarDocumento({ titulo: 'Documento Alfa' });
    const pacoteA = exportarPacoteEstilo(docA);

    const docB = criarDocumento({ titulo: 'Documento Beta' });
    aplicarPacoteEstilo(docB, pacoteA);
    const pacoteB = exportarPacoteEstilo(docB);

    assert.equal(pacoteA.estilos.length, pacoteB.estilos.length);
    assert.equal(pacoteA.mestras.length, pacoteB.mestras.length);
    assert.deepEqual(pacoteA.estilos[0], pacoteB.estilos[0]);
  });

  await t.test('5. Prompt de IA para extração de layout contém instruções do formato athenes-tema-v1', () => {
    const prompt = obterPromptIaParaExtracaoDeLayout();
    assert.match(prompt, /athenes-tema-v1/);
    assert.match(prompt, /titulo1/);
    assert.match(prompt, /citacao_longa/);
    assert.match(prompt, /moldura_tipo/);
    assert.match(prompt, /linha_estilo/);
    assert.match(prompt, /grade/);
    assert.match(prompt, /margens_mm/);
  });

  await t.test('6. Regra permanente em AGENTS.md e Skill athenes-estilos existem', () => {
    const agentsPath = join(__dirname, '../AGENTS.md');
    assert.ok(existsSync(agentsPath), 'AGENTS.md deve existir na raiz do repositório');
    const agentsConteudo = readFileSync(agentsPath, 'utf-8');
    assert.match(agentsConteudo, /athenes_pacote_estilo\.js/, 'AGENTS.md deve referenciar athenes_pacote_estilo.js');
    assert.match(agentsConteudo, /athenes-tema-v1/, 'AGENTS.md deve referenciar o formato athenes-tema-v1');

    const skillPath = join(__dirname, '../.agents/skills/athenes-estilos/SKILL.md');
    assert.ok(existsSync(skillPath), 'Skill athenes-estilos deve existir em .agents/skills/athenes-estilos/SKILL.md');
    const skillConteudo = readFileSync(skillPath, 'utf-8');
    assert.match(skillConteudo, /athenes-estilos/, 'A skill deve ter o nome correto');
  });
});
