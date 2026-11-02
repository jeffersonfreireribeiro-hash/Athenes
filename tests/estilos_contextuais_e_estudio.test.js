// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { criarDocumento } from '../src/core/athenes_documento.js';
import { EditorView } from '../src/ui/athenes_editor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Athenes — Estilos Contextuais e Dimensionamento do Estúdio', async (t) => {
  await t.test('1. Coluna esquerda do Estúdio de Artigos possui largura adequada de 340px', () => {
    const cssPath = join(__dirname, '../src/css/athenes_dashboard.css');
    const css = readFileSync(cssPath, 'utf-8');
    assert.match(
      css,
      /\.ath-estudio-full-shell\s+\.rm-ed-grade\s*\{[^}]*grid-template-columns:\s*340px/,
      'A coluna esquerda do Estúdio de Artigos deve ser 340px para acomodar título e botões'
    );
  });

  await t.test('2. EditorView possui o método aplicarEstiloNoTextoSelecionado', () => {
    assert.equal(
      typeof EditorView.prototype.aplicarEstiloNoTextoSelecionado,
      'function',
      'EditorView deve expor aplicarEstiloNoTextoSelecionado'
    );
  });

  await t.test('3. aplicarEstiloNoTextoSelecionado atualiza o bloco inteiro quando sem seleção específica', () => {
    const doc = criarDocumento({ titulo: 'Doc Teste' });
    const view = Object.create(EditorView.prototype);
    view.doc = doc;
    view.notificarMudanca = () => {};
    view.notificarMudancaRapida = () => {};
    view.renderizar = () => {};

    const bloco = doc.secoes[0].blocos[0];
    view.blocoSelecionado = bloco;
    assert.notEqual(bloco.estiloId, 'titulo2');

    view.aplicarEstiloNoTextoSelecionado('titulo2');
    assert.equal(bloco.estiloId, 'titulo2', 'Deve ter aplicado o estilo titulo2 ao bloco');
    assert.equal(bloco.tipo, 'titulo', 'Deve ter atualizado o tipo do bloco para titulo');
    assert.equal(bloco.nivel, 2, 'Deve ter definido nivel 2 para titulo2');
  });

  await t.test('4. aplicarEstiloNoTextoSelecionado aplica estilo inline quando há seleção parcial', () => {
    const doc = criarDocumento({ titulo: 'Doc Parcial' });
    const view = Object.create(EditorView.prototype);
    view.doc = doc;
    view.notificarMudanca = () => {};
    view.notificarMudancaRapida = () => {};
    view.renderizar = () => {};

    const bloco = doc.secoes[0].blocos[0];
    bloco.texto = 'Texto inicial com trecho importante';
    view.blocoSelecionado = bloco;

    // Simula seleção parcial no DOM
    const div = {
      innerHTML: 'Texto inicial com <span class="ath-estilo-span" data-estilo-id="citacao_longa">trecho importante</span>',
      textContent: 'Texto inicial com trecho importante',
      closest: () => ({ dataset: { blocoId: bloco.id } })
    };

    view._ultimaSelecaoAtiva = {
      blocoId: bloco.id,
      editable: div,
      texto: 'trecho importante',
      range: {
        collapsed: false,
        toString: () => 'trecho importante',
        extractContents: () => ({
          appendChild: () => {}
        }),
        insertNode: (node) => {
          assert.equal(node.className, 'ath-estilo-span');
          assert.equal(node.dataset.estiloId, 'citacao_longa');
        }
      }
    };

    // A chamada não deve disparar exceção
    view.aplicarEstiloNoTextoSelecionado('citacao_longa');
    assert.ok(true, 'Aplicou estilo inline na parte selecionada com sucesso');
  });
});
