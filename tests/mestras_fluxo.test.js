// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  criarDocumento,
  criarNovoBloco,
  adicionarSecao,
  removerSecao,
  moverSecao,
  trocarMestraDaSecao,
  duplicarMestra,
  removerMestra,
  repaginarDocumento,
  MODOS_APLICACAO_MESTRA
} from '../src/core/athenes_documento.js';

describe('Athenes — Sistema de Páginas Mestras e Fluxo Contínuo', () => {
  it('inicializa catálogo de mestras com modos fixa e progressiva', () => {
    const doc = criarDocumento();
    assert.ok(Array.isArray(doc.mestras));
    assert.ok(doc.mestras.length >= 5);

    const mestraCapa = doc.mestras.find(m => m.id === 'capa');
    const mestraCorpo = doc.mestras.find(m => m.id === 'corpo');
    const mestraSumario = doc.mestras.find(m => m.id === 'sumario');
    const mestraRefs = doc.mestras.find(m => m.id === 'referencias');

    assert.equal(mestraCapa.modo_aplicacao, MODOS_APLICACAO_MESTRA.FIXA);
    assert.equal(mestraCorpo.modo_aplicacao, MODOS_APLICACAO_MESTRA.PROGRESSIVA);
    assert.equal(mestraSumario.modo_aplicacao, MODOS_APLICACAO_MESTRA.PROGRESSIVA);
    assert.equal(mestraRefs.modo_aplicacao, MODOS_APLICACAO_MESTRA.PROGRESSIVA);
  });

  it('permite duplicar e customizar uma página mestra', () => {
    const doc = criarDocumento();
    const novaMestra = duplicarMestra(doc, 'corpo', 'Corpo Especial 2 Colunas');

    assert.ok(novaMestra);
    assert.equal(novaMestra.nome, 'Corpo Especial 2 Colunas');
    assert.notEqual(novaMestra.id, 'corpo');
    assert.equal(novaMestra.modo_aplicacao, MODOS_APLICACAO_MESTRA.PROGRESSIVA);
    assert.ok(doc.mestras.includes(novaMestra));
  });

  it('cria páginas automaticamente em seção progressiva quando o conteúdo cresce', () => {
    const doc = criarDocumento();
    const secCorpo = doc.secoes.find(s => s.mestraId === 'corpo');
    assert.ok(secCorpo);

    // Inicialmente a seção corpo tem 1 página física gerada
    let pagsCorpo = doc.paginas.filter(p => p.secaoId === secCorpo.id);
    assert.equal(pagsCorpo.length, 1);

    // Adiciona múltiplos parágrafos longos na seção progressiva
    for (let i = 0; i < 15; i++) {
      secCorpo.blocos.push(criarNovoBloco('paragrafo', {
        texto: `Parágrafo extenso de desenvolvimento experimental número ${i + 1}. A dinâmica dos fluidos e a análise morfológica demonstram conformidade rigorosa com os parâmetros de regularização fundiária urbana descritos na Lei Federal 13.465/2017.`
      }));
    }

    // Repagina automaticamente
    repaginarDocumento(doc);

    pagsCorpo = doc.paginas.filter(p => p.secaoId === secCorpo.id);
    // Deve ter gerado pelo menos 2 páginas automaticamente
    assert.ok(pagsCorpo.length >= 2, `Esperava pelo menos 2 páginas para o corpo longo, obteve ${pagsCorpo.length}`);

    // As páginas adicionais devem estar marcadas como fluxo automático e manter a mesma mestra
    assert.equal(pagsCorpo[0].origemFluxo, 'progressiva_raiz');
    assert.equal(pagsCorpo[1].origemFluxo, 'fluxo_automatico');
    assert.equal(pagsCorpo[0].mestraId, 'corpo');
    assert.equal(pagsCorpo[1].mestraId, 'corpo');
  });

  it('seção fixa não gera páginas extras mesmo com conteúdo longo (a menos que haja quebra forçada)', () => {
    const doc = criarDocumento();
    const secCapa = doc.secoes.find(s => s.mestraId === 'capa');
    assert.ok(secCapa);

    // Adiciona blocos na capa
    for (let i = 0; i < 8; i++) {
      secCapa.blocos.push(criarNovoBloco('paragrafo', { texto: `Nota adicional da capa ${i}` }));
    }

    repaginarDocumento(doc);
    const pagsCapa = doc.paginas.filter(p => p.secaoId === secCapa.id);
    assert.equal(pagsCapa.length, 1);
    assert.equal(pagsCapa[0].origemFluxo, 'fixa');
  });

  it('permite montar a sequência completa de seções: Capa fixa -> Sumário -> Corpo -> Referências -> Segunda Capa fixa', () => {
    const doc = criarDocumento();

    // Insere Sumário entre a Capa e o Corpo
    adicionarSecao(doc, 'Sumário', 'sumario', 1, [
      criarNovoBloco('titulo', { nivel: 1, texto: 'SUMÁRIO' }),
      criarNovoBloco('sumario', {})
    ]);

    // Insere Anexos após Referências
    adicionarSecao(doc, 'Anexos', 'anexos', null, [
      criarNovoBloco('titulo', { nivel: 1, texto: 'ANEXO 1 — PLANTA CADASTRAL' }),
      criarNovoBloco('anexo', { titulo: 'Planta Georreferenciada' })
    ]);

    // Insere Segunda Capa fixa (Contracapa) no final
    adicionarSecao(doc, 'Contracapa Final', 'capa', null, [
      criarNovoBloco('titulo', { nivel: 1, texto: 'CONSIDERAÇÕES FINAIS', alinhamento: 'centro' })
    ]);

    assert.equal(doc.secoes.length, 6);
    assert.equal(doc.secoes[0].mestraId, 'capa');
    assert.equal(doc.secoes[1].mestraId, 'sumario');
    assert.equal(doc.secoes[2].mestraId, 'corpo');
    assert.equal(doc.secoes[3].mestraId, 'referencias');
    assert.equal(doc.secoes[4].mestraId, 'anexos');
    assert.equal(doc.secoes[5].mestraId, 'capa');

    // Verifica que a última página é fixa com a mestra capa
    const ultimaPagina = doc.paginas[doc.paginas.length - 1];
    assert.equal(ultimaPagina.mestraId, 'capa');
    assert.equal(ultimaPagina.origemFluxo, 'fixa');
  });

  it('permite reordenar seções e trocar mestras dinamicamente', () => {
    const doc = criarDocumento();
    const idSecCorpo = doc.secoes[1].id;

    // Troca mestra do corpo para ieee_colunas
    trocarMestraDaSecao(doc, idSecCorpo, 'ieee_colunas');
    assert.equal(doc.secoes[1].mestraId, 'ieee_colunas');
    assert.equal(doc.paginas[1].mestraId, 'ieee_colunas');

    // Move seção para cima
    moverSecao(doc, idSecCorpo, -1);
    assert.equal(doc.secoes[0].id, idSecCorpo);

    // Remove seção
    const totalSecoesAntes = doc.secoes.length;
    removerSecao(doc, idSecCorpo);
    assert.equal(doc.secoes.length, totalSecoesAntes - 1);
  });

  it('regrada editorial manterComProximo evita título órfão no final da página', () => {
    const doc = criarDocumento();
    const secCorpo = doc.secoes.find(s => s.mestraId === 'corpo');
    secCorpo.blocos = [];

    // Preenche a página 1 até perto do limite inferior (~600 pt de 700 pt: cabeçalho e rodapé ficam na margem,
    // então o corpo útil é 297 − 30 − 20 mm). O título cabe (646 pt), mas não com o próximo bloco (+60 pt).
    for (let i = 0; i < 17; i++) { // ~34 pt por parágrafo (estimativa por estilo e largura da coluna)
      secCorpo.blocos.push(criarNovoBloco('paragrafo', {
        texto: 'Texto de preenchimento substancial da folha para atingir o limite útil da margem inferior e demonstrar a repaginação automática.'
      }));
    }

    // Insere título com manterComProximo = true
    secCorpo.blocos.push(criarNovoBloco('titulo', {
      nivel: 1,
      texto: '3. NOVO TÓPICO COM PRÓXIMO',
      manterComProximo: true
    }));

    // Insere o parágrafo subsequente
    secCorpo.blocos.push(criarNovoBloco('paragrafo', {
      texto: 'Primeiro parágrafo do novo tópico que deve acompanhar o título.'
    }));

    repaginarDocumento(doc);

    const pagsCorpo = doc.paginas.filter(p => p.secaoId === secCorpo.id);
    assert.ok(pagsCorpo.length >= 2);

    // O título não deve ter ficado sozinho no rodapé da página 1: deve estar na página 2
    const pag2 = pagsCorpo[1];
    const temTituloNaPag2 = pag2.blocos.some(b => b.texto === '3. NOVO TÓPICO COM PRÓXIMO');
    assert.ok(temTituloNaPag2, 'O título com manterComProximo deve ser transferido para a página 2');
  });

  it('permite excluir páginas mestras do catálogo e migra seções vinculadas', () => {
    const doc = criarDocumento();
    const totalMestrasAntes = doc.mestras.length;

    // Cria uma mestra personalizada
    const nova = duplicarMestra(doc, 'corpo', 'Mestra Temporária');
    assert.equal(doc.mestras.length, totalMestrasAntes + 1);

    // Cria uma seção usando a nova mestra
    const sec = adicionarSecao(doc, 'Seção Teste', nova.id);
    assert.equal(sec.mestraId, nova.id);

    // Remove a mestra
    const sucesso = removerMestra(doc, nova.id);
    assert.equal(sucesso, true);
    assert.equal(doc.mestras.length, totalMestrasAntes);
    assert.ok(!doc.mestras.some(m => m.id === nova.id));

    // A seção que a usava deve ter sido migrada para a primeira mestra disponível
    assert.equal(sec.mestraId, doc.mestras[0].id);

    // Não deve permitir excluir quando resta apenas 1 mestra
    while (doc.mestras.length > 1) {
      doc.mestras.pop();
    }
    assert.equal(removerMestra(doc, doc.mestras[0].id), false);
    assert.equal(doc.mestras.length, 1);
  });
});
