// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  criarDocumento,
  criarNovoBloco,
  dividirBlocoTexto
} from '../src/core/athenes_documento.js';
import { svgLogo, svgIcone, ICONES } from '../src/ui/athenes_icones.js';

describe('Athenes — Divisão de Bloco de Texto e Novo Logo Coruja-Lápis', () => {
  it('contém o novo logo da coruja-lápis em SVG tanto em 24x24 como em 512x512', () => {
    assert.ok(ICONES.logo, 'ICONES.logo deve estar definido');
    assert.ok(ICONES.coruja, 'ICONES.coruja deve estar definido');

    const logoHtml24 = svgIcone('logo', 24);
    assert.ok(logoHtml24.includes('viewBox="0 0 24 24"'));
    assert.ok(logoHtml24.includes('fill="currentColor"'));

    const logoHtml512 = svgLogo(32);
    assert.ok(logoHtml512.includes('viewBox="0 0 512 512"'));
    assert.ok(logoHtml512.includes('ath-logo-svg'));
    assert.ok(logoHtml512.includes('Athenes Logo'));
  });

  it('divide um bloco de parágrafo no índice numérico fornecido', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[0];
    const bloco = criarNovoBloco('paragrafo', {
      texto: 'Primeira parte do texto do artigo. Segunda parte que vai para o novo bloco.',
      estiloId: 'corpo'
    });
    sec.blocos.push(bloco);

    const indiceCorte = 'Primeira parte do texto do artigo.'.length;
    const res = dividirBlocoTexto(doc, bloco.id, indiceCorte);

    assert.ok(res, 'Deve retornar o resultado da divisão');
    assert.strictEqual(res.blocoOriginal.texto, 'Primeira parte do texto do artigo.');
    assert.strictEqual(res.novoBloco.texto, ' Segunda parte que vai para o novo bloco.');
    assert.strictEqual(res.novoBloco.estiloId, 'corpo');
    assert.strictEqual(res.novoBloco.alinhamento, undefined, 'o alinhamento é do estilo, não do bloco');

    // O novo bloco deve estar imediatamente após o original
    const idxOrig = sec.blocos.indexOf(res.blocoOriginal);
    const idxNovo = sec.blocos.indexOf(res.novoBloco);
    assert.strictEqual(idxNovo, idxOrig + 1);
  });

  it('divide um bloco de parágrafo com objeto de texto antes e depois (DOM Range HTML)', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[0];
    const bloco = criarNovoBloco('paragrafo', {
      texto: 'Texto com <strong>negrito inicial</strong> e texto final.',
      estiloId: 'corpo'
    });
    sec.blocos.push(bloco);

    const res = dividirBlocoTexto(doc, bloco.id, {
      textoAntes: 'Texto com <strong>negrito inicial</strong>',
      textoDepois: ' e texto final.'
    });

    assert.ok(res);
    assert.strictEqual(res.blocoOriginal.texto, 'Texto com <strong>negrito inicial</strong>');
    assert.strictEqual(res.novoBloco.texto, ' e texto final.');
  });

  it('divide um bloco de título/subtítulo preservando nível e estilo', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[0];
    const titulo = criarNovoBloco('titulo', {
      texto: '1. Introdução Teórica e Metodológica',
      nivel: 1
    });
    sec.blocos.push(titulo);

    const res = dividirBlocoTexto(doc, titulo.id, 15);
    assert.ok(res);
    assert.strictEqual(res.blocoOriginal.tipo, 'titulo');
    assert.strictEqual(res.novoBloco.tipo, 'titulo');
    assert.strictEqual(res.novoBloco.nivel, 1);
  });

  it('divide no ponto central caso nenhum corte seja informado', () => {
    const doc = criarDocumento();
    const sec = doc.secoes[0];
    const bloco = criarNovoBloco('paragrafo', {
      texto: 'PalavraUm PalavraDois PalavraTres PalavraQuatro'
    });
    sec.blocos.push(bloco);

    const res = dividirBlocoTexto(doc, bloco.id);
    assert.ok(res);
    assert.ok(res.blocoOriginal.texto.length > 0);
    assert.ok(res.novoBloco.texto.length > 0);
    assert.strictEqual(
      res.blocoOriginal.texto + ' ' + res.novoBloco.texto,
      'PalavraUm PalavraDois PalavraTres PalavraQuatro'
    );
  });
});
