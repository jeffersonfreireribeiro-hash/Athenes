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
  SessaoColaborativaRealtime,
  obterInfoUsuarioGoogle,
  obterOuCriarEstruturaPastasAthenes,
  salvarNotaZoteroNoGoogleDrive,
  salvarRelatorioPdfNoGoogleDrive,
  obterPastasDriveLocais,
  salvarPastasDriveLocais,
  adicionarSubpastaDriveLocal,
  adicionarPastaCompartilhadaDriveLocal,
  removerPastaDriveLocal,
  listarSubpastasDoGoogleDrive,
  criarSubpastaNoGoogleDrive,
  listarItensDaPastaDrive
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
  it('6. Login Google e sincronização da pasta Hub Athenes (Documentos, Zotero e Relatórios)', async () => {
    // 6.1 Consulta de perfil do usuário Gmail
    const mockUserInfoFetch = async (url, init) => {
      assert.equal(url, 'https://www.googleapis.com/oauth2/v3/userinfo');
      assert.equal(init.headers.Authorization, 'Bearer token_google_valido');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sub: '10987654321',
          name: 'Pesquisador Acadêmico',
          email: 'pesquisador@gmail.com',
          picture: 'https://lh3.googleusercontent.com/avatar_exemplo.png'
        })
      };
    };
    const perfilGoogle = await obterInfoUsuarioGoogle('token_google_valido', mockUserInfoFetch);
    assert.equal(perfilGoogle.name, 'Pesquisador Acadêmico');
    assert.equal(perfilGoogle.email, 'pesquisador@gmail.com');

    // 6.2 Criação e resolução da estrutura de pastas Athenes no Drive
    const pastasCriadas = [];
    const mockPastasFetch = async (url, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        pastasCriadas.push(body.name);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'pasta_' + body.name, name: body.name })
        };
      }
      // Busca de pasta existente (retorna vazio para forçar criação ordenada)
      return {
        ok: true,
        status: 200,
        json: async () => ({ files: [] })
      };
    };

    const estrutura = await obterOuCriarEstruturaPastasAthenes('token_google_valido', null, mockPastasFetch);
    assert.ok(estrutura.pastaRaizId);
    assert.ok(estrutura.pastaDocumentosId);
    assert.ok(estrutura.pastaZoteroId);
    assert.ok(estrutura.pastaRelatoriosId);
    assert.deepEqual(pastasCriadas, ['Athenes', 'Documentos', 'Zotero_Notas', 'Relatorios_PDF']);

    // 6.3 Salvar nota do Zotero na pasta Zotero_Notas
    let uploadZoteroChamado = false;
    const mockUploadZotero = async (url, init) => {
      uploadZoteroChamado = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'file_zotero_123', name: 'Zotero_Sintese_Acustica.json' })
      };
    };
    const resNota = await salvarNotaZoteroNoGoogleDrive({
      chaveOuId: 'ABC1234',
      titulo: 'Sintese_Acustica',
      conteudo: { resumo: 'Estudo sobre conforto acústico', autor: 'Silva' },
      accessToken: 'token_google_valido',
      pastaZoteroId: estrutura.pastaZoteroId
    }, mockUploadZotero);
    assert.equal(resNota.id, 'file_zotero_123');
    assert.ok(uploadZoteroChamado);
  });

  it('7. Árvore de Pastas do Drive: 2 raízes padrão (Bibliografia e Relatórios), subpastas e compartilhadas', async () => {
    // 7.1 Raízes padrão locais
    const pastas = obterPastasDriveLocais();
    assert.equal(pastas.length, 2);
    assert.equal(pastas[0].tipo, 'bibliografia');
    assert.equal(pastas[1].tipo, 'relatorios');

    // 7.2 Adicionar subpasta na árvore hierárquica
    const sub1 = adicionarSubpastaDriveLocal({
      parentId: pastas[1].id,
      nome: 'Artigo SBPC 2026',
      tipo: 'relatorios'
    });
    assert.ok(sub1.id);
    assert.equal(sub1.nome, 'Artigo SBPC 2026');
    assert.equal(sub1.parentId, pastas[1].id);

    const pastasComSub = obterPastasDriveLocais();
    const relAtual = pastasComSub.find(p => p.id === pastas[1].id);
    assert.equal(relAtual.subpastas.length, 1);
    assert.equal(relAtual.subpastas[0].nome, 'Artigo SBPC 2026');

    // 7.3 Adicionar e remover pasta compartilhada
    const comp = adicionarPastaCompartilhadaDriveLocal({
      url: 'https://drive.google.com/drive/folders/1CompartilhadaXYZ999',
      nome: 'Laboratório de Urbanismo - Orientação',
      dono: 'Prof. Orientador'
    });
    assert.equal(comp.id, '1CompartilhadaXYZ999');
    assert.equal(comp.origem, 'compartilhada');

    let pastasComComp = obterPastasDriveLocais();
    assert.equal(pastasComComp.length, 3);

    removerPastaDriveLocal('1CompartilhadaXYZ999');
    let pastasAposRemover = obterPastasDriveLocais();
    assert.equal(pastasAposRemover.length, 2);

    // 7.4 Chamada API mock de subpastas e arquivos isolados por pasta
    let chamadaSubpastasUrl = '';
    const mockFetchDrive = async (url, init) => {
      chamadaSubpastasUrl = decodeURIComponent(url);
      if (chamadaSubpastasUrl.includes("mimeType = 'application/vnd.google-apps.folder'")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              { id: 'sub_gdrive_1', name: 'Capítulo 1' }
            ]
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            { id: 'file_1', name: 'Documento_SBPC.athenes', mimeType: 'application/json' },
            { id: 'file_2', name: 'Grafico.pdf', mimeType: 'application/pdf' }
          ]
        })
      };
    };

    const subsRemotas = await listarSubpastasDoGoogleDrive('token_fake', 'pasta_pai_123', mockFetchDrive);
    assert.equal(subsRemotas.length, 1);
    assert.ok(chamadaSubpastasUrl.includes("'pasta_pai_123' in parents"));

    const itensRemotos = await listarItensDaPastaDrive('token_fake', 'pasta_alvo_456', mockFetchDrive);
    assert.equal(itensRemotos.length, 2);
    assert.ok(chamadaSubpastasUrl.includes("'pasta_alvo_456' in parents"));
  });
});
