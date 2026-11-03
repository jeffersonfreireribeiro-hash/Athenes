// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { sincronizarPastasComDrive, obterPastaRaizDrive } from '../src/core/athenes_drive_sync.js';
import { obterConfigGoogleDrive } from '../src/core/athenes_colaboracao.js';
import { criarDocumento, criarElementoMestra, repaginarDocumento } from '../src/core/athenes_documento.js';
import { exportarParaDocx } from '../src/core/athenes_export_docx.js';
import { gerarDocumentoHtmlPdf } from '../src/core/athenes_export_pdf.js';
import { abrirZip } from '../src/core/athenes_zip_leitor.js';

// Drive falso: busca por nome/pai, criação, leitura por id (404 se a conta não enxerga) e lixeira
function driveFalso({ status = null, prefixo = 'f' } = {}) {
  const itens = []; let n = 0;
  const json = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o) });
  const fetchImpl = async (url, op = {}) => {
    if (status) return json({ error: { message: 'erro' } }, status);
    const u = new URL(url), metodo = op.method || 'GET';
    const porId = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (porId && metodo === 'GET') {
      const it = itens.find(i => i.id === decodeURIComponent(porId[1]));
      return it ? json({ id: it.id, trashed: !!it.trashed }) : json({ error: { message: 'não encontrado' } }, 404);
    }
    if (u.pathname === '/drive/v3/files' && metodo === 'GET') {
      const q = u.searchParams.get('q');
      const nome = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\'/g, "'");
      const pai = /'([^']+)' in parents/.exec(q)?.[1];
      return json({ files: itens.filter(i => i.mime === 'pasta' && !i.trashed && i.name === nome && (!pai || i.parents.includes(pai))).map(i => ({ id: i.id, name: i.name })) });
    }
    if (u.pathname === '/drive/v3/files' && metodo === 'POST') {
      const b = JSON.parse(op.body);
      const it = { id: `${prefixo}${++n}_${itens.length}`, name: b.name, mime: 'pasta', parents: b.parents || [] }; itens.push(it); return json({ id: it.id });
    }
    return json({}, 400);
  };
  return { fetchImpl, itens };
}
const arvore = () => [{ id: 'pasta_rel_raiz', nome: 'Relatórios', origem: 'minhas', subpastas: [{ id: 'sub_1', nome: 'Tese', origem: 'minhas', subpastas: [] }] }];
const storageFalso = () => { const m = new Map(); globalThis.localStorage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('Drive: pasta raiz apagada (ou na lixeira) é recriada e os driveId das pastas locais são refeitos', async () => {
  storageFalso();
  const d = driveFalso(); const pastas = arvore();
  assert.equal((await sincronizarPastasComDrive('tokA', { fetchImpl: d.fetchImpl, pastas })).erros.length, 0);
  const raizAntiga = obterConfigGoogleDrive().pastaRaizId;
  const idsAntigos = [pastas[0].driveId, pastas[0].subpastas[0].driveId];
  d.itens.find(i => i.id === raizAntiga).trashed = true; // o usuário jogou a pasta "Athenes" na lixeira
  const r = await sincronizarPastasComDrive('tokB', { fetchImpl: d.fetchImpl, pastas }); // outro token = revalida
  assert.equal(r.erros.length, 0, JSON.stringify(r.erros));
  const raizNova = obterConfigGoogleDrive().pastaRaizId;
  assert.notEqual(raizNova, raizAntiga);
  assert.ok(pastas[0].driveId && pastas[0].driveId !== idsAntigos[0], 'a pasta local ganhou um driveId novo');
  assert.ok(pastas[0].subpastas[0].driveId !== idsAntigos[1]);
  const novaRaiz = d.itens.find(i => i.id === raizNova);
  assert.ok(d.itens.find(i => i.id === pastas[0].driveId).parents.includes(novaRaiz.id), 'as pastas locais ficam dentro da raiz nova');
});

test('Drive: raiz guardada de OUTRA conta (404 nesta conta) é substituída; erro de autorização não recria nada', async () => {
  storageFalso();
  const contaA = driveFalso({ prefixo: 'a' }), contaB = driveFalso({ prefixo: 'b' });
  await obterPastaRaizDrive('tokA', contaA.fetchImpl);
  const raizA = obterConfigGoogleDrive().pastaRaizId;
  const raizB = await obterPastaRaizDrive('tokConta2', contaB.fetchImpl);
  assert.notEqual(raizB, raizA);
  assert.equal(contaB.itens.length, 1, 'criou a raiz na conta nova');
  assert.equal(await obterPastaRaizDrive('tokConta2', contaB.fetchImpl), raizB, 'validada na sessão: não consulta de novo');

  const expirada = driveFalso({ status: 401 });
  await assert.rejects(obterPastaRaizDrive('tokNovo', expirada.fetchImpl), /expirou/);
  assert.equal(obterConfigGoogleDrive().pastaRaizId, raizB, '401 não apaga a raiz guardada');
});

test('DOCX: imagem do cabeçalho com "respeitar recuo" usa as margens e a largura útil, como o PDF', async () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const doc = criarDocumento({ titulo: 'T' });
  const corpo = doc.mestras.find(m => m.id === 'corpo');
  corpo.margens_mm = { t: 30, r: 20, b: 20, l: 25 };
  corpo.elementos_recorrentes = [
    criarElementoMestra('foto_capa', { url: PNG, x_mm: 5, y_mm: 3, largura_mm: 40, altura_mm: 20, sangria: false }),
    criarElementoMestra('foto_capa', { url: PNG, x_mm: 5, y_mm: 3, largura_mm: 40, altura_mm: 20, sangria: false })
  ];
  corpo.elementos_recorrentes[1].respeitar_recuo = true;
  repaginarDocumento(doc);
  const zip = abrirZip(await exportarParaDocx(doc));
  let anchors = [];
  for (const nome of zip.nomes.filter(x => /^word\/header\d+\.xml$/.test(x))) {
    const t = await zip.texto(nome);
    anchors = [...t.matchAll(/<wp:positionH[^>]*><wp:posOffset>(\d+)<\/wp:posOffset><\/wp:positionH><wp:positionV[^>]*><wp:posOffset>(\d+)<\/wp:posOffset><\/wp:positionV><wp:extent cx="(\d+)"/g)].map(m => m.slice(1).map(Number));
    if (anchors.length) break;
  }
  assert.equal(anchors.length, 2);
  assert.deepEqual(anchors[0], [5 * 36000, 3 * 36000, 40 * 36000], 'sem recuo: coordenadas da folha');
  assert.deepEqual(anchors[1], [(25 + 5) * 36000, (30 + 3) * 36000, (210 - 25 - 20) * 36000], 'com recuo: margens + largura útil');
});

test('PDF: rodapé multilinha só com texto central continua centralizado; com texto à esquerda usa a largura que sobra', () => {
  const montar = (zonas, comNumero = false) => {
    const doc = criarDocumento({ titulo: 'T' });
    const corpo = doc.mestras.find(m => m.id === 'corpo');
    corpo.rodape = { ativo: true, multilinha: true, zonas, distancia_borda_mm: 8 };
    corpo.numeracao_pagina = comNumero ? { ativo: true, local: 'rodape', horizontal: 'direita', formato: 'apenas_numero' } : { ativo: false }; // sem número automático: só as zonas do teste
    repaginarDocumento(doc);
    return gerarDocumentoHtmlPdf(doc);
  };
  const flexes = (html) => [...(/<footer[^>]*>([\s\S]*?)<\/footer>/.exec(html)?.[1] || '').matchAll(/<div style="flex:([^;]+);/g)].map(m => m[1]);
  assert.deepEqual(flexes(montar({ esquerda: '', centro: 'Texto centralizado', direita: '' })), ['0 0 0', '1 1 0', '0 0 0'], 'zonas vazias não ocupam espaço: o centro ocupa tudo e fica centralizado');
  assert.deepEqual(flexes(montar({ esquerda: '\nTexto institucional', centro: '', direita: '{pagina}' }, true)), ['1 1 0', '0 0 0', '0 0 auto'], 'esquerda com texto: ocupa o que sobra; número só o seu tamanho');
});
