// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarIdiomaLeitura, dividirTextoTraducao, traduzirTextoAcademico } from '../src/core/athenes_traducao.js';

test('detecta idiomas comuns no texto acadêmico', () => {
  assert.equal(detectarIdiomaLeitura('The findings are consistent with the observed results and the model.'), 'en');
  assert.equal(detectarIdiomaLeitura('Los resultados de la investigación son relevantes para el estudio.'), 'es');
  assert.equal(detectarIdiomaLeitura('Os resultados da pesquisa são importantes para o estudo.'), 'pt');
});

test('divide páginas dentro do limite de 500 bytes da API', () => {
  const partes = dividirTextoTraducao('Acústica e arquitetura. '.repeat(80));
  assert.ok(partes.length > 1);
  assert.ok(partes.every(parte => new TextEncoder().encode(parte).length <= 450));
});

test('traduz de fato, preserva termo técnico e reutiliza resultado em cache', async () => {
  let chamadas = 0;
  const fetchImpl = async url => {
    chamadas++;
    assert.match(url, /langpair=en%7Cpt/);
    return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'O coeficiente de dispersão é alto.' } }) };
  };
  const texto = 'The scattering coefficient is high.';
  assert.equal(await traduzirTextoAcademico(texto, { fetchImpl }), 'O coeficiente de espalhamento é alto.');
  assert.equal(await traduzirTextoAcademico(texto, { fetchImpl }), 'O coeficiente de espalhamento é alto.');
  assert.equal(chamadas, 1);
});

test('falha sem inventar tradução quando o serviço responde com erro', async () => {
  await assert.rejects(
    traduzirTextoAcademico('The results are clear.', { fetchImpl: async () => ({ ok: false }) }),
    /indisponível/
  );
});

test('traduz página longa em partes e mantém a separação entre parágrafos', async () => {
  const texto = `${'The results are consistent with the model. '.repeat(30)}\n\nThe method was validated.`;
  let chamadas = 0;
  const traduzido = await traduzirTextoAcademico(texto, {
    fetchImpl: async url => {
      chamadas++;
      const trecho = new URL(url).searchParams.get('q');
      return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: `PT:${trecho}` } }) };
    }
  });
  assert.ok(chamadas > 2);
  assert.match(traduzido, /\n\nPT:The method was validated\./);
  assert.ok(traduzido.includes('PT:The results'));
});
