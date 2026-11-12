// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarIdiomaLeitura, dividirTextoTraducao, traduzirTextoAcademico } from '../src/core/athenes_traducao.js';
import { resolverTraducaoReferencia } from '../src/server/athenes_traducao.js';

test('detecta idiomas comuns no texto acadêmico', () => {
  assert.equal(detectarIdiomaLeitura('The findings are consistent with the observed results and the model.'), 'en');
  assert.equal(detectarIdiomaLeitura('Los resultados de la investigación son relevantes para el estudio.'), 'es');
  assert.equal(detectarIdiomaLeitura('Os resultados da pesquisa são importantes para o estudo.'), 'pt');
});

test('divide textos grandes em trechos aceitos pelo servidor', () => {
  const partes = dividirTextoTraducao('Acústica e arquitetura. '.repeat(800));
  assert.ok(partes.length > 1);
  assert.ok(partes.every(parte => parte.length <= 6000 && new TextEncoder().encode(parte).length <= 24000));
});

test('cliente usa a API local, preserva termo técnico e reutiliza cache', async () => {
  let chamadas = 0;
  const fetchImpl = async (url, opcoes) => {
    chamadas++;
    assert.equal(url, '/api/traduzir-referencia');
    assert.equal(opcoes.method, 'POST');
    assert.deepEqual(JSON.parse(opcoes.body), { texto: 'The scattering coefficient is high.', origem: 'en', destino: 'pt' });
    return { ok: true, json: async () => ({ traducao: 'O coeficiente de dispersão é alto.' }) };
  };
  const texto = 'The scattering coefficient is high.';
  assert.equal(await traduzirTextoAcademico(texto, { origem: 'en', fetchImpl }), 'O coeficiente de espalhamento é alto.');
  assert.equal(await traduzirTextoAcademico(texto, { origem: 'en', fetchImpl }), 'O coeficiente de espalhamento é alto.');
  assert.equal(chamadas, 1);
});

test('prefere tradução local quando o navegador oferece o idioma', async () => {
  let destruido = false;
  const motores = [];
  const resultado = await traduzirTextoAcademico('The unique acoustic result is clear.', {
    origem: 'en',
    TranslatorImpl: {
      availability: async () => 'available',
      create: async () => ({
        translate: async () => 'O resultado acústico é claro.',
        destroy: () => { destruido = true; }
      })
    },
    fetchImpl: () => { throw new Error('Não deveria chamar a rede.'); },
    aoMotor: motor => motores.push(motor)
  });
  assert.equal(resultado, 'O resultado acústico é claro.');
  assert.deepEqual(motores, ['local']);
  assert.equal(destruido, true);
});

test('falha do tradutor local volta para a tradução de rede', async () => {
  const motores = [];
  const resultado = await traduzirTextoAcademico('The fallback acoustic example is clear.', {
    origem: 'en',
    TranslatorImpl: {
      availability: async () => 'available',
      create: async () => ({ translate: async () => { throw new Error('Pacote local falhou'); } })
    },
    fetchImpl: async url => {
      assert.equal(url, '/api/traduzir-referencia');
      return { ok: true, json: async () => ({ traducao: 'O exemplo acústico está claro.' }) };
    },
    aoMotor: motor => motores.push(motor)
  });
  assert.equal(resultado, 'O exemplo acústico está claro.');
  assert.deepEqual(motores, ['local', 'gemini']);
});

test('sem créditos Gemini, usa o serviço gratuito e informa seu limite', async () => {
  const motores = [];
  const resultado = await traduzirTextoAcademico('The unique findings are relevant.', {
    origem: 'en', TranslatorImpl: null,
    fetchImpl: async url => url === '/api/traduzir-referencia'
      ? { ok: false, status: 503, json: async () => ({ erro: 'Sem créditos.', codigoProvedor: 402 }) }
      : { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Os resultados são relevantes.' } }) },
    aoMotor: motor => motores.push(motor)
  });
  assert.equal(resultado, 'Os resultados são relevantes.');
  assert.deepEqual(motores, ['gemini', 'basico']);
});

test('falha do serviço gratuito é mostrada sem inventar tradução', async () => {
  await assert.rejects(traduzirTextoAcademico('The special results are clear.', {
    TranslatorImpl: null,
    fetchImpl: async url => url === '/api/traduzir-referencia'
      ? { ok: false, status: 503, json: async () => ({ erro: 'Sem créditos.' }) }
      : { ok: true, json: async () => ({ responseStatus: 403 }) }
  }), /limite de uso/);
});

test('página longa preserva parágrafos e informa progresso', async () => {
  const texto = `${'The results are consistent with the model. '.repeat(300)}\n\nThe method was validated.`;
  let chamadas = 0;
  const progresso = [];
  const traduzido = await traduzirTextoAcademico(texto, {
    fetchImpl: async (_url, opcoes) => {
      chamadas++;
      return { ok: true, json: async () => ({ traducao: `PT:${JSON.parse(opcoes.body).texto}` }) };
    },
    aoProgresso: (feitos, total) => progresso.push([feitos, total])
  });
  assert.ok(chamadas > 2);
  assert.match(traduzido, /\n\nPT:The method was validated\./);
  assert.equal(progresso.at(-1)[0], progresso.at(-1)[1]);
});

test('retomada de página longa reutiliza os trechos já traduzidos', async () => {
  const texto = 'Unique acoustic paragraph '.repeat(400);
  let chamadas = 0;
  await assert.rejects(traduzirTextoAcademico(texto, {
    fetchImpl: async () => {
      chamadas++;
      return chamadas === 1
        ? { ok: true, json: async () => ({ traducao: 'Primeira parte' }) }
        : { ok: false, status: 400, json: async () => ({ erro: 'Falha temporária' }) };
    }
  }), /Falha temporária/);
  const chamadasAntes = chamadas;
  const resultado = await traduzirTextoAcademico(texto, {
    fetchImpl: async () => {
      chamadas++;
      return { ok: true, json: async () => ({ traducao: 'Parte seguinte' }) };
    }
  });
  assert.ok(resultado.startsWith('Primeira parte Parte seguinte'));
  assert.equal(chamadas - chamadasAntes, dividirTextoTraducao(texto).length - 1);
});

test('servidor exige chave e valida tamanho sem chamar serviço externo', async () => {
  let chamadas = 0;
  const opcoes = { apiKey: '', fetchImpl: () => { chamadas++; } };
  assert.equal((await resolverTraducaoReferencia({ texto: 'Test', destino: 'pt' }, opcoes)).status, 503);
  assert.equal((await resolverTraducaoReferencia({ texto: 'x'.repeat(6001), destino: 'pt' }, opcoes)).status, 400);
  assert.equal(chamadas, 0);
});

test('servidor usa Gemini com instrução acadêmica e não expõe a chave na resposta', async () => {
  const resposta = await resolverTraducaoReferencia({ texto: 'The scattering coefficient is high.', origem: 'en', destino: 'pt' }, {
    apiKey: 'chave-falsa', modelo: 'gemini-3.8-flash',
    fetchImpl: async (url, opcoes) => {
      assert.match(url, /gemini-3\.8-flash:generateContent$/);
      assert.equal(opcoes.headers['x-goog-api-key'], 'chave-falsa');
      const corpo = JSON.parse(opcoes.body);
      assert.match(corpo.systemInstruction.parts[0].text, /coeficiente de espalhamento/);
      assert.match(corpo.contents[0].parts[0].text, /scattering coefficient/);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'O coeficiente de espalhamento é alto.' }] }, finishReason: 'STOP' }] }) };
    }
  });
  assert.deepEqual(resposta, { status: 200, traducao: 'O coeficiente de espalhamento é alto.' });
});

test('servidor informa cota temporária e resposta incompleta', async () => {
  const dados = { texto: 'Academic text', destino: 'pt' };
  assert.deepEqual(await resolverTraducaoReferencia(dados, { apiKey: 'chave-falsa', fetchImpl: async () => ({ ok: false, status: 402 }) }), {
    status: 503, erro: 'A conta Google da tradução está sem créditos. Verifique o faturamento no Google AI Studio.', codigoProvedor: 402
  });
  assert.equal((await resolverTraducaoReferencia(dados, { apiKey: 'chave-falsa', fetchImpl: async () => ({ ok: false, status: 429 }) })).status, 429);
  assert.equal((await resolverTraducaoReferencia(dados, { apiKey: 'chave-falsa', fetchImpl: async () => ({
    ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Parcial' }] }, finishReason: 'MAX_TOKENS' }] })
  }) })).status, 502);
});
