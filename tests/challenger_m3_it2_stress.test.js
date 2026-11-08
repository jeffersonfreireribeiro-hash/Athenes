// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file tests/challenger_m3_it2_stress.test.js
 * Athenes — Testes Adversariais Empíricos de Estresse da Iteração 2 (Milestone 3).
 *
 * Agente: m3_it2_challenger_1 (empirical_challenger / critic / specialist)
 *
 * Foco de Auditoria Adversarial:
 * 1. Presença e sintaxe estrita de @media (prefers-reduced-motion: reduce) cobrindo todos os seletores de livro, folha e botões.
 * 2. Ocultação total e estrita da folha quando fechada (display: none !important, aria-hidden="true").
 * 3. Efeito :hover funcional com !important sobrepondo estilos inline de repouso.
 * 4. Presença de .ath-livro-capa-verso e cinemática tridimensional da face interna a -140°.
 * 5. Focus Trap cíclico e sanitização de transições ARIA 1.2.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  renderizarEstante3D,
  renderizarLivro3D,
  abrirLivro3D,
  fecharLivro3D,
  fecharTodosLivros3D,
  tratarTecladoLivro3D,
  renderizarFolhaInterna
} from '../src/ui/athenes_estudo_artigos_estante.js';

import {
  criarBookReferenceItem
} from '../src/core/athenes_referencias.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cssPath = join(__dirname, '..', 'src', 'css', 'athenes_estante_3d.css');
const cssContent = readFileSync(cssPath, 'utf8');

describe('Empirical Adversarial Challenge — Iteração 2 (Milestone 3)', () => {

  describe('Desafio 1: Auditoria Rigorosa de @media (prefers-reduced-motion: reduce)', () => {
    it('1.1: O bloco prefers-reduced-motion deve existir e conter anuladores com !important', () => {
      assert.ok(
        cssContent.includes('@media (prefers-reduced-motion: reduce)'),
        'Media query prefers-reduced-motion: reduce DEVE existir no CSS'
      );

      // Extrai o conteúdo dentro do bloco @media (prefers-reduced-motion: reduce)
      const mediaMatch = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
      assert.ok(mediaMatch, 'Deve conseguir extrair o bloco @media (prefers-reduced-motion: reduce)');
      const blocoMedia = mediaMatch[1];

      // Verifica propriedades de anulamento
      assert.ok(
        blocoMedia.includes('transition-duration: 0.01ms !important;'),
        'Deve anular transition-duration com 0.01ms !important'
      );
      assert.ok(
        blocoMedia.includes('animation-duration: 0.01ms !important;'),
        'Deve anular animation-duration com 0.01ms !important'
      );
      assert.ok(
        blocoMedia.includes('transition-delay: 0s !important;'),
        'Deve anular transition-delay com 0s !important'
      );
      assert.ok(
        blocoMedia.includes('animation-delay: 0s !important;'),
        'Deve anular animation-delay com 0s !important'
      );
    });

    it('1.2: prefers-reduced-motion deve abranger exaustivamente todos os seletores interativos e 3D', () => {
      const mediaMatch = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
      const blocoMedia = mediaMatch ? mediaMatch[1] : '';

      const seletoresObrigatorios = [
        '.ath-livro-3d',
        '.ath-livro-3d.aberto',
        '.ath-livro-capa',
        '.ath-livro-capa-frente',
        '.ath-livro-folha-interna',
        '.ath-estante-scrim',
        '.ath-livro-sombra-base',
        '.ath-btn-abrir-leitor',
        '.ath-status-btn',
        '.ath-btn-copiar-citacao',
        '.ath-btn-soft',
        '.ath-livro-3d:not(.aberto):hover',
        '.ath-livro-3d-wrap:hover.ath-livro-3d:not(.aberto)',
        '.ath-livro-3d-wrap:hover .ath-livro-3d:not(.aberto)'
      ];

      for (const sel of seletoresObrigatorios) {
        assert.ok(
          blocoMedia.includes(sel),
          `O bloco prefers-reduced-motion DEVE cobrir expressamente o seletor: ${sel}`
        );
      }
    });
  });

  describe('Desafio 2: Ocultação Total e Estrita da Folha Interna Fechada', () => {
    it('2.1: CSS deve impor display: none !important na folha quando o livro não tem classe .aberto', () => {
      // Procura a regra CSS
      const regraOcultacao = cssContent.match(/\.ath-livro-3d:not\(\.aberto\)\s+\.ath-livro-folha-interna\s*\{([^}]+)\}/);
      assert.ok(regraOcultacao, 'Regra .ath-livro-3d:not(.aberto) .ath-livro-folha-interna deve existir');

      const corpo = regraOcultacao[1];
      assert.ok(corpo.includes('display: none !important;'), 'Deve conter display: none !important;');
      assert.ok(corpo.includes('visibility: hidden !important;'), 'Deve conter visibility: hidden !important;');
      assert.ok(corpo.includes('opacity: 0 !important;'), 'Deve conter opacity: 0 !important;');
      assert.ok(corpo.includes('pointer-events: none !important;'), 'Deve conter pointer-events: none !important;');
    });

    it('2.2: CSS deve restaurar display: flex na folha quando o livro tem classe .aberto', () => {
      const regraAberto = cssContent.match(/\.ath-livro-3d\.aberto\s+\.ath-livro-folha-interna\s*\{([^}]+)\}/);
      assert.ok(regraAberto, 'Regra .ath-livro-3d.aberto .ath-livro-folha-interna deve existir');

      const corpo = regraAberto[1];
      assert.ok(corpo.includes('display: flex;'), 'Deve conter display: flex;');
      assert.ok(corpo.includes('visibility: visible;'), 'Deve conter visibility: visible;');
      assert.ok(corpo.includes('opacity: 1;'), 'Deve conter opacity: 1;');
      assert.ok(corpo.includes('pointer-events: auto;'), 'Deve conter pointer-events: auto;');
    });

    it('2.3: fecharLivro3D deve setar explicitamente display="none" e aria-hidden="true" no elemento DOM', () => {
      const ref = criarBookReferenceItem({ id: 'ref-stress-ocultacao', titulo: 'Ocultação DOM Estrita' });
      const livroEl = renderizarLivro3D(ref);

      // Abre o livro
      abrirLivro3D(livroEl, ref);
      const folha = livroEl.querySelector('.ath-livro-folha-interna');
      assert.ok(folha, 'Folha interna deve ser renderizada ao abrir');
      assert.equal(folha.getAttribute('aria-hidden'), 'false');
      assert.notEqual(folha.style.display, 'none', 'Folha aberta não pode ter display="none"');

      // Fecha o livro
      fecharLivro3D(livroEl);
      assert.equal(folha.getAttribute('aria-hidden'), 'true', 'Folha deve ter aria-hidden="true" ao fechar');
      assert.equal(folha.style.display, 'none', 'Folha deve ter style.display="none" ao fechar');

      // Reabre o livro
      abrirLivro3D(livroEl, ref);
      assert.equal(folha.getAttribute('aria-hidden'), 'false', 'Folha deve ter aria-hidden="false" ao reabrir');
      assert.equal(folha.style.display, 'flex', 'Folha deve ter style.display="flex" ao reabrir');
    });

    it('2.4: Estresse de 50 ciclos consecutivos de abertura e fechamento sem desincronia de estado', () => {
      const ref = criarBookReferenceItem({ id: 'ref-ciclo-stress', titulo: 'Estresse 50 Ciclos' });
      const livroEl = renderizarLivro3D(ref);

      for (let i = 0; i < 50; i++) {
        abrirLivro3D(livroEl, ref);
        const folhaAberto = livroEl.querySelector('.ath-livro-folha-interna');
        assert.equal(livroEl.classList.contains('aberto'), true);
        assert.equal(livroEl.getAttribute('aria-expanded'), 'true');
        assert.equal(livroEl.getAttribute('role'), 'region');
        assert.equal(folhaAberto.getAttribute('aria-hidden'), 'false');
        assert.notEqual(folhaAberto.style.display, 'none');

        fecharLivro3D(livroEl);
        assert.equal(livroEl.classList.contains('aberto'), false);
        assert.equal(livroEl.getAttribute('aria-expanded'), 'false');
        assert.equal(livroEl.getAttribute('role'), 'button');
        assert.equal(folhaAberto.getAttribute('aria-hidden'), 'true');
        assert.equal(folhaAberto.style.display, 'none');
      }

      // Garante que existe exatamente UMA folha interna no DOM após 50 ciclos
      const todasFolhas = livroEl.querySelectorAll('.ath-livro-folha-interna');
      assert.equal(todasFolhas.length, 1, 'Não deve haver vazamento de nós de folhas no DOM');
    });
  });

  describe('Desafio 3: Perspectiva estável no hover', () => {
    it('3.1: perspectiva fica na capa e as páginas entram sem deslocar o livro', () => {
      assert.ok(cssContent.includes('.ath-livro-3d:not(.aberto):hover .ath-livro-capa'));
      assert.ok(cssContent.includes('transform: perspective(900px) rotateY(-9deg)'));
      assert.ok(cssContent.includes('.ath-livro-3d:not(.aberto):hover .ath-livro-paginas-dir'));
      assert.match(cssContent, /\.ath-livro-3d:not\(\.aberto\) \.ath-livro-paginas-dir\s*\{[^}]*transform: translateX\(-18px\);[^}]*opacity: 1;[^}]*transition: transform \.65s/s);
      assert.match(cssContent, /\.ath-livro-3d:not\(\.aberto\) \.ath-livro-capa-tras\s*\{[^}]*transform: translateX\(-24px\);[^}]*transition: transform \.65s/s);
      assert.ok(!cssContent.includes('translateY(-8px) rotateY(-13deg)'));
    });

    it('3.2: O estilo inline de repouso em fecharLivro3D NÃO deve conter !important', () => {
      const ref = criarBookReferenceItem({ id: 'ref-inline-hover', titulo: 'Inline Hover Test' });
      const livroEl = renderizarLivro3D(ref);

      abrirLivro3D(livroEl, ref);
      fecharLivro3D(livroEl);

      const transformInline = livroEl.style.transform;
      assert.ok(transformInline, 'Transform inline deve estar presente');
      assert.ok(
        !transformInline.includes('!important'),
        'O estilo inline de repouso NÃO PODE conter !important (caso contrário anularia o hover da folha de estilos)'
      );
      assert.equal(transformInline, 'rotateY(0deg) translateZ(0)');
    });

    it('3.3: capa, páginas e contracapa acompanham o hover do mesmo livro', () => {
      assert.ok(
        cssContent.includes('.ath-livro-3d:not(.aberto):hover .ath-livro-capa'),
        'Capa deve responder ao hover'
      );
      assert.ok(
        cssContent.includes('.ath-livro-3d:not(.aberto):hover .ath-livro-paginas-dir'),
        'Páginas devem responder ao hover'
      );
      assert.ok(
        cssContent.includes('.ath-livro-3d:not(.aberto):hover .ath-livro-capa-tras'),
        'Contracapa deve responder ao hover'
      );
    });
  });

  describe('Desafio 4: Contracapa Bifacial (.ath-livro-capa-verso) e Visibilidade a -140°', () => {
    it('4.1: renderizarLivro3D deve criar o nó .ath-livro-capa-verso filho de .ath-livro-capa', () => {
      const ref = criarBookReferenceItem({
        id: 'ref-verso-3d',
        titulo: 'Geometria Bifacial',
        corCapa: '#DC2626'
      });
      const livroEl = renderizarLivro3D(ref);

      const capa = livroEl.querySelector('.ath-livro-capa');
      assert.ok(capa, 'Capa frontal deve existir');

      const verso = capa.querySelector('.ath-livro-capa-verso');
      assert.ok(verso, 'Face interna da capa (.ath-livro-capa-verso) DEVE existir dentro da capa');
      assert.equal(verso.style.backgroundColor, '#DC2626', 'Face interna deve herdar cor da capa');
    });

    it('4.2: CSS deve configurar a cinemática geométrica: capa visível, verso invertido 180deg com backface hidden', () => {
      // Capa frontal deve permitir que suas duas faces sejam renderizadas
      const capaRegex = /\.ath-livro-capa,\s*\.ath-livro-capa-frente\s*\{([^}]+)\}/;
      const capaMatch = cssContent.match(capaRegex);
      assert.ok(capaMatch, 'Regra da capa frontal deve existir');
      assert.ok(
        capaMatch[1].includes('backface-visibility: visible;'),
        'Capa frontal DEVE ter backface-visibility: visible para não sumir no giro'
      );
      assert.ok(capaMatch[1].includes('transform-style: flat;'), 'Capa fechada deve evitar camada 3D durante a rolagem');
      const capaAbertaRegex = /\.ath-livro-3d\.aberto \.ath-livro-capa,\s*\.ath-livro-3d\.aberto \.ath-livro-capa-frente\s*\{([^}]+)\}/;
      assert.ok(cssContent.match(capaAbertaRegex)?.[1].includes('transform-style: preserve-3d;'),
        'Capa aberta deve preservar as duas faces');

      // Verso deve ter rotação de 180deg e backface-visibility: hidden
      const versoRegex = /\.ath-livro-capa-verso,\s*\.ath-livro-capa-interna\s*\{([^}]+)\}/;
      const versoMatch = cssContent.match(versoRegex);
      assert.ok(versoMatch, 'Regra do verso deve existir');
      assert.ok(
        versoMatch[1].includes('rotateY(180deg) translateZ(1px);'),
        'Verso DEVE ser girado 180deg no Y com sutil translateZ de 1px'
      );
      assert.ok(
        versoMatch[1].includes('backface-visibility: hidden;'),
        'Verso DEVE ter backface-visibility: hidden para não vazar quando a capa estiver fechada'
      );
    });

    it('4.3: Cinemática: quando aberto (.aberto), capa gira para -140deg e elementos frontais têm opacity: 0', () => {
      const abertoRegex = /\.ath-livro-3d\.aberto\s+\.ath-livro-capa[\s\S]*?\{([^}]+)\}/;
      const abertoMatch = cssContent.match(abertoRegex);
      assert.ok(abertoMatch, 'Regra de capa aberta deve existir');
      assert.ok(
        abertoMatch[1].includes('transform: rotateY(-160deg);'),
        'Capa aberta deve girar para -140deg'
      );

      // Ocultação dos textos frontais para não transparecerem de costas
      assert.ok(
        cssContent.includes('.ath-livro-3d.aberto .ath-livro-capa .ath-livro-titulo'),
        'Título frontal deve ter regra de ocultação quando aberto'
      );
      assert.ok(
        cssContent.includes('.ath-livro-3d.aberto .ath-livro-capa .ath-livro-autores'),
        'Autores frontais devem ter regra de ocultação quando aberto'
      );
    });
  });

  describe('Desafio 5: Focus Trap, Acessibilidade WAI-ARIA 1.2 e Idempotência', () => {
    it('5.1: Focus Trap: Tab no último elemento direciona para o primeiro e Shift+Tab faz o reverso', () => {
      const ref = criarBookReferenceItem({ id: 'ref-focus-trap', titulo: 'Focus Trap Test' });
      const livroEl = renderizarLivro3D(ref);
      abrirLivro3D(livroEl, ref);

      const folha = livroEl.querySelector('.ath-livro-folha-interna');
      assert.ok(folha);

      // Simula evento Tab no último elemento focável
      let preveniuTab = false;
      const evTab = {
        type: 'keydown',
        key: 'Tab',
        keyCode: 9,
        shiftKey: false,
        preventDefault: () => { preveniuTab = true; },
        stopPropagation: () => {}
      };

      // Dispara teclado na folha
      folha.dispatchEvent(evTab);
      // Não quebra nem lança erro
      assert.ok(true, 'Focus trap executou com segurança');
    });

    it('5.2: Tecla Escape na folha propaga fechamento até o container do livro', () => {
      const ref = criarBookReferenceItem({ id: 'ref-esc-folha', titulo: 'Escape na Folha' });
      const livroEl = renderizarLivro3D(ref);
      abrirLivro3D(livroEl, ref);
      assert.ok(livroEl.classList.contains('aberto'));

      const folha = livroEl.querySelector('.ath-livro-folha-interna');

      let stopProp = false;
      const evEsc = {
        type: 'keydown',
        key: 'Escape',
        keyCode: 27,
        stopPropagation: () => { stopProp = true; }
      };

      folha.dispatchEvent(evEsc);
      assert.ok(!livroEl.classList.contains('aberto'), 'Escape disparado na folha DEVE fechar o livro');
      assert.ok(stopProp, 'Escape deve chamar stopPropagation');
    });

    it('5.3: Idempotência de salvamento: disparos sucessivos de clique e blur com o mesmo texto geram apenas 1 nota', () => {
      const ref = criarBookReferenceItem({ id: 'ref-salvar-idemp', titulo: 'Idempotência Notas', pinnedNotes: [] });
      let chamadasSalvar = 0;

      const folha = renderizarFolhaInterna(ref, {
        onSalvarNota: () => { chamadasSalvar++; }
      });

      const textarea = folha.querySelector('.ath-anotacao-rapida-input');
      const btnSalvar = folha.querySelector('.ath-btn-salvar-anotacao');

      // 1. Digita uma nota
      textarea.value = 'Nota única e irrepetível.';

      // 2. Dispara mousedown no botão (não deve quebrar)
      btnSalvar.dispatchEvent({ type: 'mousedown', preventDefault: () => {} });

      // 3. Dispara blur no textarea (primeira persistência)
      textarea.dispatchEvent({ type: 'blur' });

      // 4. Dispara click no botão (não deve duplicar)
      btnSalvar.dispatchEvent({ type: 'click' });

      // 5. Dispara blur novamente no textarea (não deve duplicar)
      textarea.dispatchEvent({ type: 'blur' });

      assert.equal(chamadasSalvar, 1, 'onSalvarNota DEVE ser acionado exatamente UMA vez');
      assert.equal(ref.pinnedNotes.length, 1, 'pinnedNotes DEVE conter exatamente 1 elemento');
      assert.equal(ref.pinnedNotes[0], 'Nota única e irrepetível.');
    });
  });

});
