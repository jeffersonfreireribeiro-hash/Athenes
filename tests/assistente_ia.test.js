// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Testes Unitários e de Integração do Assistente de IA de Escrita Científica.
 *
 * Cobre:
 *  - Prompts mestres e estruturação de contexto bibliográfico da estante.
 *  - Sanitização e governança de TextStyles (herança de styleId sem poluição HTML).
 *  - Execução síncrona e streaming progressivo (typewriter).
 *  - Motor de texto fantasma (GhostTextEngine / Smart Compose) com aceitação via Tab e descarte via Esc.
 *  - Painel flutuante e geração de sugestões não-destrutivas (Track Changes com <ins>/<del>).
 *  - Resolução de sugestões e isolamento estrito contra vazamento em exportações PDF/DOCX.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACOES_IA,
  PROMPTS_IA,
  construirContextoBibliografia,
  construirPromptMestre,
  sanearTextoIa,
  limparSpansFantasma,
  gerarSugestaoSimulada,
  executarCompletudeIa
} from '../src/core/athenes_assistente_ia.js';
import {
  resolverSugestoesEmHtml,
  temMarcasSugestao,
  documentoComSugestoesResolvidas
} from '../src/core/athenes_diff.js';
import {
  registrarSugestao,
  aceitarSugestaoNoDocumento,
  rejeitarSugestaoNoDocumento
} from '../src/core/athenes_colaboracao.js';
import { GhostTextEngine } from '../src/ui/athenes_assistente_ia_ui.js';

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1: Prompts Mestres e Contexto Bibliográfico
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 1: Prompts Mestres e Contexto Bibliográfico', () => {
  it('1.1: construirContextoBibliografia formata metadados, autores, resumo e notas', () => {
    const artigos = [
      {
        id: 'art_1',
        titulo: 'Acoustics in Classrooms',
        autores: [{ sobrenome: 'Nilsson', prenome: 'Erling' }, { sobrenome: 'Hagberg', prenome: 'Karl' }],
        ano: '2020',
        resumo: 'Several room acoustic parameters are evaluated.',
        pinnedNotes: ['Medição feita com fonte omnidirecional']
      }
    ];

    const ctx = construirContextoBibliografia(artigos);
    assert.ok(ctx.includes('Acoustics in Classrooms'), 'Deve conter o título da obra');
    assert.ok(ctx.includes('Nilsson, Hagberg (2020)'), 'Deve conter autores e ano');
    assert.ok(ctx.includes('(NILSSON, 2020)'), 'Deve conter chave de citação');
    assert.ok(ctx.includes('Several room acoustic'), 'Deve conter trecho do resumo');
    assert.ok(ctx.includes('fonte omnidirecional'), 'Deve conter notas fixadas');
  });

  it('1.2: construirContextoBibliografia lida com lista vazia ou nula com segurança', () => {
    assert.equal(construirContextoBibliografia([]), '');
    assert.equal(construirContextoBibliografia(null), '');
    assert.equal(construirContextoBibliografia(undefined), '');
  });

  it('1.3: construirPromptMestre compõe diretrizes de estilo, seção e documento', () => {
    const prompt = construirPromptMestre({
      acao: ACOES_IA.EXPANDIR_BIBLIOGRAFIA,
      trechoSelecionado: 'O tempo de reverberação foi medido.',
      contextoPrecedente: 'Iniciou-se a avaliação experimental.',
      secaoTitulo: 'Metodologia',
      docTitulo: 'Relatório Técnico de Acústica',
      artigos: [{ titulo: 'Obra Teste', autores: [{ sobrenome: 'Silva' }], ano: '2024' }]
    });

    assert.ok(prompt.includes('Relatório Técnico de Acústica'));
    assert.ok(prompt.includes('Metodologia'));
    assert.ok(prompt.includes('O tempo de reverberação foi medido.'));
    assert.ok(prompt.includes('Silva (2024)'));
    assert.ok(prompt.includes('Jamais injete tags HTML'));
  });

  it('1.4: construirPromptMestre aceita prompt livre do usuário', () => {
    const prompt = construirPromptMestre({
      acao: ACOES_IA.LIVRE,
      promptLivre: 'Reescreva em tópicos numerados focando em custos',
      trechoSelecionado: 'O projeto custará 100 reais.'
    });
    assert.ok(prompt.includes('Reescreva em tópicos numerados focando em custos'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2: Higienização de Texto e Isolamento de Estilos
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 2: Higienização de Texto e Isolamento de Estilos', () => {
  it('2.1: sanearTextoIa remove cercas de código ```markdown e ```text', () => {
    const sujo = '```text\nEste é o parágrafo científico sugerido.\n```';
    assert.equal(sanearTextoIa(sujo), 'Este é o parágrafo científico sugerido.');
  });

  it('2.2: sanearTextoIa remove tags span/font ilegais com styles arbitrários', () => {
    const comEstilo = 'Texto com <span style="font-family: Arial; font-size: 20pt;">estilo avulso</span> que deve ser limpo.';
    assert.equal(sanearTextoIa(comEstilo), 'Texto com estilo avulso que deve ser limpo.');
  });

  it('2.3: limparSpansFantasma remove rigorosamente tags .ath-ghost-text', () => {
    const html = 'Parágrafo do artigo <span class="ath-ghost-text" contenteditable="false">continuação sugerida</span> texto final.';
    assert.equal(limparSpansFantasma(html), 'Parágrafo do artigo  texto final.');
  });

  it('2.4: resolverSugestoesEmHtml elimina spans fantasma durante resolução de sugestões', () => {
    const html = 'Texto base <span class="ath-ghost-text">sugestao fantasma</span> <ins class="ath-sug-mark">texto novo</ins>';
    const resolvido = resolverSugestoesEmHtml(html, 'aceitar');
    assert.ok(!resolvido.includes('ath-ghost-text'), 'Não deve conter marcas fantasma');
    assert.ok(resolvido.includes('texto novo'), 'Deve conter texto aceito');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3: Completude, Geração e Streaming
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 3: Completude, Geração e Streaming', () => {
  it('3.1: gerarSugestaoSimulada para bibliografia cita autores cadastrados', () => {
    const sugestao = gerarSugestaoSimulada({
      acao: ACOES_IA.EXPANDIR_BIBLIOGRAFIA,
      trecho: 'A atenuação sonora foi verificada.',
      artigos: [{ autores: [{ sobrenome: 'Ribeiro' }], ano: '2026' }]
    });
    assert.ok(sugestao.includes('Ribeiro et al. (2026)'));
    assert.ok(sugestao.includes('A atenuação sonora foi verificada.'));
  });

  it('3.2: gerarSugestaoSimulada para acadêmico substitui termos coloquiais', () => {
    const sugestao = gerarSugestaoSimulada({
      acao: ACOES_IA.ACADEMICO,
      trecho: 'O ensaio foi muito bom e legal.'
    });
    assert.ok(sugestao.includes('significativamente profícuo e metodologicamente consistente'));
  });

  it('3.3: gerarSugestaoSimulada para encurtar reduz o número de palavras', () => {
    const longo = 'Este é um parágrafo excessivamente detalhado e longo com muitas palavras desnecessárias que podem ser eliminadas facilmente.';
    const curto = gerarSugestaoSimulada({
      acao: ACOES_IA.ENCURTAR,
      trecho: longo
    });
    assert.ok(curto.split(' ').length < longo.split(' ').length);
  });

  it('3.4: gerarSugestaoSimulada para tradução gera inglês formal', () => {
    const traducao = gerarSugestaoSimulada({
      acao: ACOES_IA.TRADUZIR_INGLES,
      trecho: 'Os dados confirmam a hipótese'
    });
    assert.ok(traducao.includes('empirical results indicate that'));
  });

  it('3.5: executarCompletudeIa em modo síncrono retorna resultado imediato', () => {
    let concluido = false;
    let textoRes = '';
    executarCompletudeIa({
      acao: ACOES_IA.ACADEMICO,
      trechoSelecionado: 'Texto teste',
      streaming: false,
      onConcluido: (res) => {
        concluido = true;
        textoRes = res;
      }
    });
    assert.ok(concluido, 'Deve disparar onConcluido síncrono');
    assert.ok(textoRes.length > 0, 'Deve retornar texto');
  });

  it('3.6: executarCompletudeIa suporta cancelamento durante streaming', async () => {
    let chunks = 0;
    const req = executarCompletudeIa({
      acao: ACOES_IA.ACADEMICO,
      trechoSelecionado: 'Texto longo para simular streaming progressivo',
      streaming: true,
      chunkDelayMs: 5,
      onChunk: () => { chunks++; }
    });

    await new Promise(r => setTimeout(r, 12));
    req.cancelar();
    const chunksAposCancel = chunks;
    await new Promise(r => setTimeout(r, 20));
    assert.equal(chunks, chunksAposCancel, 'Cancelamento deve interromper novos chunks');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4: Sugestões Não-Destrutivas (Track Changes / Diff Inline)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 4: Sugestões Não-Destrutivas (Track Changes / Diff Inline)', () => {
  it('4.1: registrarSugestao cria estrutura completa com autor de IA', () => {
    const doc = { secoes: [{ blocos: [{ id: 'b1', texto: 'Texto original do parágrafo.' }] }] };
    const sug = registrarSugestao(doc, {
      blocoId: 'b1',
      tipo: 'substituicao',
      textoOriginal: 'original',
      textoNovo: 'aprimorado pela IA',
      autor: 'Assistente IA',
      autorId: 'ai_athenes',
      corAutor: '#8B5CF6'
    });

    assert.ok(sug.id, 'Deve possuir ID único');
    assert.equal(sug.autor, 'Assistente IA');
    assert.equal(sug.corAutor, '#8B5CF6');
    assert.ok(Array.isArray(doc.sugestoes));
    assert.equal(doc.sugestoes[0].id, sug.id);
  });

  it('4.2: aceitarSugestaoNoDocumento consolida a alteração da IA', () => {
    const doc = {
      sugestoes: [],
      secoes: [{
        blocos: [{
          id: 'b1',
          texto: 'Texto <del class="ath-sug-mark" data-sugestao-id="s1">original</del><ins class="ath-sug-mark" data-sugestao-id="s1">revisado</ins> final.'
        }]
      }]
    };
    doc.sugestoes.push({ id: 's1', blocoId: 'b1', tipo: 'substituicao', textoOriginal: 'original', textoNovo: 'revisado' });

    const ok = aceitarSugestaoNoDocumento(doc, 's1');
    assert.ok(ok);
    assert.equal(doc.secoes[0].blocos[0].texto, 'Texto revisado final.');
    assert.equal(doc.sugestoes.length, 0);
  });

  it('4.3: rejeitarSugestaoNoDocumento restaura o texto original intacto', () => {
    const doc = {
      sugestoes: [],
      secoes: [{
        blocos: [{
          id: 'b1',
          texto: 'Texto <del class="ath-sug-mark" data-sugestao-id="s1">original</del><ins class="ath-sug-mark" data-sugestao-id="s1">revisado</ins> final.'
        }]
      }]
    };
    doc.sugestoes.push({ id: 's1', blocoId: 'b1', tipo: 'substituicao', textoOriginal: 'original', textoNovo: 'revisado' });

    const ok = rejeitarSugestaoNoDocumento(doc, 's1');
    assert.ok(ok);
    assert.equal(doc.secoes[0].blocos[0].texto, 'Texto original final.');
    assert.equal(doc.sugestoes.length, 0);
  });

  it('4.4: documentoComSugestoesResolvidas isola exportações PDF e DOCX', () => {
    const doc = {
      secoes: [{
        blocos: [
          { id: 'b1', texto: 'Com efeito, <del class="ath-sug-mark">velho</del><ins class="ath-sug-mark">novo</ins> texto <span class="ath-ghost-text">fantasma</span>.' }
        ]
      }]
    };

    const docExportacao = documentoComSugestoesResolvidas(doc, 'aceitar');
    const textoLimpo = docExportacao.secoes[0].blocos[0].texto;
    assert.ok(!textoLimpo.includes('ath-sug-mark'), 'Não deve conter tags de sugestão');
    assert.ok(!textoLimpo.includes('ath-ghost-text'), 'Não deve conter span fantasma');
    assert.ok(!textoLimpo.includes('velho'), 'Texto deletado não deve aparecer no PDF/DOCX');
    assert.ok(textoLimpo.includes('novo'), 'Texto novo aceito deve constar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5: Motor de Texto Fantasma (GhostTextEngine / Smart Compose)
// ─────────────────────────────────────────────────────────────────────────────

describe('Grupo 5: Motor de Texto Fantasma (GhostTextEngine / Smart Compose)', () => {
  it('5.1: GhostTextEngine pode ser instanciado e destruído sem erros', () => {
    const mockEditor = { doc: { titulo: 'Teste' }, buscarBlocoPorId: () => ({ id: 'b1', tipo: 'paragrafo' }) };
    const engine = new GhostTextEngine(mockEditor, { debounceMs: 100 });
    assert.ok(engine);
    assert.doesNotThrow(() => engine.destruir());
  });

  it('5.2: aceitar() converte span fantasma em nó de texto e dispara evento input', () => {
    const mockEditor = { doc: { titulo: 'Doc Teste' } };
    const engine = new GhostTextEngine(mockEditor);

    // Mock simples de elemento DOM
    let inputDisparado = false;
    const parent = {
      childNodes: [],
      replaceChild: (novo, velho) => {
        parent.childNodes = [novo];
      },
      dispatchEvent: (e) => {
        if (e.type === 'input') inputDisparado = true;
      }
    };
    const spanMock = {
      parentNode: parent,
      remove: () => {}
    };

    engine.spanAtivo = spanMock;
    engine.sugestaoAtual = ' continuação do parágrafo sugerida';
    engine.aceitar();

    assert.equal(engine.spanAtivo, null, 'Span ativo deve ser limpo');
    assert.equal(engine.sugestaoAtual, '', 'Sugestão atual deve ser limpa');
    assert.ok(inputDisparado, 'Deve disparar evento input para persistir no modelo');
  });

  it('5.3: descartar() remove span e cancela requisições pendentes', () => {
    const mockEditor = { doc: { titulo: 'Doc Teste' } };
    const engine = new GhostTextEngine(mockEditor);

    let removido = false;
    engine.spanAtivo = { remove: () => { removido = true; } };
    engine.sugestaoAtual = 'texto';

    engine.descartar();
    assert.ok(removido, 'Deve remover o span do DOM');
    assert.equal(engine.spanAtivo, null);
    assert.equal(engine.sugestaoAtual, '');
  });

  it('5.4: definirAtivo() e alternarAtivo() controlam estado e descartam sugestões ativas', () => {
    const mockEditor = { doc: { titulo: 'Doc Teste' } };
    const engine = new GhostTextEngine(mockEditor);

    assert.equal(engine.estaAtivo(), true);

    let removido = false;
    engine.spanAtivo = { remove: () => { removido = true; } };
    engine.sugestaoAtual = 'sugestão ativa';

    engine.definirAtivo(false);
    assert.equal(engine.estaAtivo(), false);
    assert.ok(removido, 'Desativar deve descartar span ativo');
    assert.equal(engine.spanAtivo, null);

    const novo = engine.alternarAtivo();
    assert.equal(novo, true);
    assert.equal(engine.estaAtivo(), true);

    engine.destruir();
  });
});
