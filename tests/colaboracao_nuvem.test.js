// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarDocumento } from '../src/core/athenes_documento.js';
import {
  MODOS_TRABALHO,
  SUPABASE_CONFIG_PADRAO,
  GOOGLE_DRIVE_ESCOPO,
  garantirEstruturaSugestoes,
  registrarSugestao,
  gerarHtmlMarcacaoSugestao,
  aceitarSugestaoNoDocumento,
  rejeitarSugestaoNoDocumento,
  salvarDocumentoNoSupabase,
  listarDocumentosDoSupabase,
  carregarDocumentoDoSupabase,
  salvarArquivoNoGoogleDrive,
  listarArquivosDoGoogleDrive,
  SessaoColaborativaRealtime
} from '../src/core/athenes_colaboracao.js';

describe('Athenes — Colaboração, Modos Google Docs, Supabase e Google Drive', () => {
  it('1. Registra sugestões de revisão (adição verde e exclusão vermelha) e resolve Aceitar (✓) / Rejeitar (✗)', () => {
    const doc = criarDocumento({ titulo: 'Artigo em Revisão' });
    const secao = doc.secoes[0];
    const bloco = secao.blocos.find(b => b.tipo === 'paragrafo') || secao.blocos[0];
    bloco.texto = 'Este método apresenta resultados preliminares importantes.';

    // Professor sugere trocar "preliminares" por "conclusivos e estatisticamente significativos"
    const sug = registrarSugestao(doc, {
      blocoId: bloco.id,
      tipo: 'substituicao',
      textoOriginal: 'preliminares',
      textoNovo: 'conclusivos e estatisticamente significativos',
      autor: 'Prof. Orientador'
    });

    assert.equal(garantirEstruturaSugestoes(doc).length, 1);
    const htmlMark = gerarHtmlMarcacaoSugestao(sug);
    assert.ok(htmlMark.includes('<del class="ath-sug-mark ath-sug-del"'));
    assert.ok(htmlMark.includes('<ins class="ath-sug-mark ath-sug-ins"'));

    bloco.texto = bloco.texto.replace('preliminares', htmlMark);

    // Autor aceita a sugestão (✓): mantém o <ins> e remove o <del>
    const ok = aceitarSugestaoNoDocumento(doc, sug.id);
    assert.equal(ok, true);
    assert.equal(doc.sugestoes.length, 0);
    assert.ok(bloco.texto.includes('conclusivos e estatisticamente significativos'));
    assert.ok(!bloco.texto.includes('preliminares'));
    assert.ok(!bloco.texto.includes('<ins'));
    assert.ok(!bloco.texto.includes('<del'));
  });

  it('2. Rejeitar sugestão (✗) restaura o texto original e descarta a adição sugerida', () => {
    const doc = criarDocumento({ titulo: 'Artigo Rejeição' });
    const bloco = doc.secoes[0].blocos[0];
    bloco.texto = 'A amostra contou com 120 participantes.';

    const sug = registrarSugestao(doc, {
      blocoId: bloco.id,
      tipo: 'substituicao',
      textoOriginal: '120',
      textoNovo: '150',
      autor: 'Prof. Fulano'
    });

    bloco.texto = bloco.texto.replace('120', gerarHtmlMarcacaoSugestao(sug));
    const ok = rejeitarSugestaoNoDocumento(doc, sug.id);
    assert.equal(ok, true);
    assert.equal(doc.sugestoes.length, 0);
    assert.ok(bloco.texto.includes('120'));
    assert.ok(!bloco.texto.includes('150'));
  });

  it('3. Persistência no Supabase REST (salvar, listar e carregar documento)', async () => {
    const doc = criarDocumento({ titulo: 'Paper Colaborativo Supabase' });
    let chamadas = [];

    const mockFetch = async (url, init) => {
      chamadas.push({ url, init });
      if (init.method === 'POST') {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          status: 201,
          json: async () => [body]
        };
      }
      if (url.includes('id=eq.')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: doc.id, titulo: doc.titulo, conteudo_json: doc, sugestoes_json: [] }]
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: doc.id, titulo: doc.titulo, atualizado_por: 'Prof. Orientador' }]
      };
    };

    const salvo = await salvarDocumentoNoSupabase(doc, { nome: 'Prof. Orientador' }, mockFetch);
    assert.equal(salvo.id, doc.id);
    assert.equal(salvo.atualizado_por, 'Prof. Orientador');
    assert.ok(chamadas[0].url.startsWith(SUPABASE_CONFIG_PADRAO.url));

    const lista = await listarDocumentosDoSupabase(mockFetch);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].titulo, 'Paper Colaborativo Supabase');

    const carregado = await carregarDocumentoDoSupabase(doc.id, mockFetch);
    assert.equal(carregado.id, doc.id);
    assert.equal(carregado.titulo, 'Paper Colaborativo Supabase');
  });

  it('4. Integração Google Drive usa escopo restrito drive.file e formato multipart v3', async () => {
    assert.equal(GOOGLE_DRIVE_ESCOPO, 'https://www.googleapis.com/auth/drive.file');
    assert.equal(MODOS_TRABALHO.EDICAO, 'edicao');
    assert.equal(MODOS_TRABALHO.SUGESTAO, 'sugestao');
    assert.equal(MODOS_TRABALHO.VISUALIZACAO, 'leitura');

    let reqCapturada = null;
    const mockDriveFetch = async (url, init) => {
      reqCapturada = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'drive_file_123', name: 'Artigo.athenes', files: [{ id: 'drive_file_123', name: 'Artigo.athenes' }] })
      };
    };

    const resUpload = await salvarArquivoNoGoogleDrive({
      nomeArquivo: 'Artigo.athenes',
      conteudoBlobOuTexto: { id: 'doc_1', titulo: 'Artigo' },
      accessToken: 'token_teste_oauth'
    }, mockDriveFetch);

    assert.equal(resUpload.id, 'drive_file_123');
    assert.ok(reqCapturada.url.includes('googleapis.com/upload/drive/v3/files'));
    assert.equal(reqCapturada.init.headers.Authorization, 'Bearer token_teste_oauth');

    const arqs = await listarArquivosDoGoogleDrive('token_teste_oauth', mockDriveFetch);
    assert.equal(arqs.length, 1);
    assert.equal(arqs[0].name, 'Artigo.athenes');
  });

  it('5. SessaoColaborativaRealtime sincroniza presença e cursor entre colaboradores', () => {
    const doc = criarDocumento({ titulo: 'Realtime Sync' });
    let presencasNotificadas = [];
    let blocoRemotoRecebido = null;

    const sessao = new SessaoColaborativaRealtime(doc, {
      perfil: { id: 'usr_autor', nome: 'Autor', papel: 'autor', cor: '#314F79' },
      onPresencaAlterada: (lista) => { presencasNotificadas = lista; },
      onBlocoRemotoAlterado: (blocoSnap) => { blocoRemotoRecebido = blocoSnap; }
    });

    sessao.processarMensagemRemota({
      tipo: 'cursor',
      remetente: { id: 'usr_prof', nome: 'Prof. Orientador', papel: 'orientador', cor: '#10B981' },
      blocoId: 'bloco_123'
    });

    assert.equal(presencasNotificadas.length, 2);
    const prof = presencasNotificadas.find(p => p.id === 'usr_prof');
    assert.equal(prof.nome, 'Prof. Orientador');
    assert.equal(prof.blocoId, 'bloco_123');

    sessao.processarMensagemRemota({
      tipo: 'bloco_editado',
      remetente: { id: 'usr_prof', nome: 'Prof. Orientador', papel: 'orientador', cor: '#10B981' },
      blocoId: 'bloco_123',
      blocoSnapshot: { id: 'bloco_123', texto: 'Parágrafo atualizado síncrono' },
      sugestoes: []
    });

    assert.equal(blocoRemotoRecebido.texto, 'Parágrafo atualizado síncrono');
    sessao.encerrar();
  });
});
