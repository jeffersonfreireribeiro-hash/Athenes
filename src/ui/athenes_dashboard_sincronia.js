// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Dashboard: sincronização com o servidor (perfil, documentos) e o Drive.
 * Métodos da classe DashboardView (usam `this`); são acrescentados ao prototype em athenes_dashboard.js.
 */
import { lerConta, gravarConta, obterContaAtiva } from '../core/athenes_conta.js';
import { obterConfigGoogleDrive, salvarConfigGoogleDrive, nuvemAutenticada, obterOuCriarEstruturaPastasAthenes, obterPastasDriveLocais, salvarPastasDriveLocais } from '../core/athenes_colaboracao.js';
import {remapearSelecaoPastas} from './athenes_estudo_artigos_pastas.js';
import {remapearPastasDosArtigos} from '../core/athenes_zotero_pastas.js';
import { sincronizarBiblioteca, obterArtigos, definirArtigos } from '../core/athenes_biblioteca_artigos.js';
import { sincronizarTemplatesUsuario } from '../core/athenes_templates.js';
import { sincronizarPerfil } from '../core/athenes_perfil_servidor.js';
import { montarEstadoLocal, chaveDoZotero } from '../core/athenes_perfil_local.js';
import { driveConectado, obterTokenDrive, processarPastasExcluidas, docsRemovidosDoDrive, processarExclusoesPendentes, obterPastaRaizDrive, repararPastaDosDocumentos, sincronizarZoteroComDrive, importarPastasDoDrive, listarBibliotecaDoDrive, mesclarBibliotecaDrive } from '../core/athenes_drive_sync.js';

export const metodosDashboardSincronia = {
  async sincronizarComSupabase(silencioso = false) {
    await this.sincronizarCompartilhados();
    const perfilSrv = await this.sincronizarPerfilServidor(); // o que vale vem do servidor; o Drive entrega os arquivos
    const permitidos = perfilSrv && !perfilSrv.criado ? new Set(perfilSrv.indice.documentos.map(e => e.driveFileId).filter(Boolean)) : null;
    const btn = this.container?.querySelector('#athBtnSincronizarNuvem');
    if (!driveConectado()) {
      if (!silencioso) alert('Conecte o Google Drive (engrenagem → Nuvem & Drive) para ver seus documentos na nuvem. Cada conta enxerga só o próprio Drive.');
      return;
    }
    if (btn && !silencioso) {
      btn.classList.add('ath-girando');
      btn.disabled = true;
      btn.title = 'Sincronizando…';
    }
    try {
      const token = await obterTokenDrive();
      if (!token) { if (!silencioso) alert('A sessão do Google Drive expirou. Reconecte o Drive.'); return; }
      try { await obterPastaRaizDrive(token); } catch (e) { console.warn('[Athenes] Raiz do Drive:', e.message); } // adota a pasta Athenes mais antiga (a de todos os computadores)
      // outro computador: sem a estrutura gravada, descobre/cria as pastas do Athenes e fixa a pasta de documentos desta conta
      try { const c = obterConfigGoogleDrive(); if (!c.pastaDocumentosId || !c.pastaRaizId) await obterOuCriarEstruturaPastasAthenes(token); } catch (e) { console.warn('[Athenes] Estrutura do Drive:', e.message); }
      try { await processarExclusoesPendentes(token); } catch (e) { console.warn('[Athenes] Lixeira do Drive:', e.message); }
      // Zotero conectado em outro computador desta conta aparece aqui (e o daqui vai para os outros)
      let zotero = 'nada';
      // com o servidor, o Zotero já foi sincronizado por ele; o arquivo no Drive é só o reserva
      try { if (!perfilSrv) zotero = await sincronizarZoteroComDrive(token); } catch (e) { console.warn('[Athenes] Zotero pelo Drive:', e.message); }
      // 1) a estrutura de pastas do Drive (outro computador começa só com as padrão); 2) os documentos, já nas pastas certas
      let pastasNovas = { importadas: 0, vinculadas: 0, mapa: {} };
      // só no começo: depois a árvore de pastas vem do servidor (e pasta excluída não renasce)
      try { if (!permitidos) pastasNovas = await importarPastasDoDrive(token); } catch (e) { console.warn('[Athenes] Pastas do Drive não importadas:', e.message); }
      if (pastasNovas.importadas || pastasNovas.vinculadas) this.pastasDrive = obterPastasDriveLocais();
      const arquivos = await listarBibliotecaDoDrive(token);
      // excluído em outro computador: o arquivo já está na lixeira do Drive, então sai da lista daqui também
      let excluidosFora = 0;
      if (arquivos.length < 1000) { // listagem completa (com 1000 ou mais pode haver arquivos fora dela)
        try {
          const sumiram = new Set((await docsRemovidosDoDrive(this.documentos, arquivos, token)).map(String));
          if (sumiram.size) {
            this.documentos = this.documentos.filter(d => !sumiram.has(String(d.id)));
            excluidosFora = sumiram.size;
            this.salvarDocumentosLocais(); this.atualizarGrid(); this.renderizarPastasLateral();
          }
        } catch (e) { console.warn('[Athenes] Exclusões feitas em outro computador:', e.message); }
      }
      const r = mesclarBibliotecaDrive(this.documentos, arquivos, pastasNovas.mapa, obterPastasDriveLocais(), undefined, permitidos);
      const religados = repararPastaDosDocumentos(this.documentos, obterPastasDriveLocais()); // documentos trazidos de outro PC voltam para a pasta certa
      if (religados) r.atualizados += religados;
      if (pastasNovas.importadas || religados) {
        this.pastasDrive = obterPastasDriveLocais();
        this.salvarDocumentosLocais();
        this.renderizarPastasLateral();
        this.renderizarBannerPasta();
        if (this.abaAtiva === 'escrita') this.atualizarGrid();
      }
      else if (r.novos || r.atualizados) {
        this.salvarDocumentosLocais();
        this.atualizarGrid();
      }
      // por fim, o caminho de volta: cria no Drive (dentro da raiz Athenes) as pastas que só existem aqui e envia/move os documentos,
      // para a estrutura ficar guardada no Drive e igual nos outros computadores
      let envio = null;
      try { envio = await this.sincronizarComDrive({ aviso: false }); await processarPastasExcluidas(token); this.limparCopiaDoNavegador(); } catch (e) { console.warn('[Athenes] Envio ao Drive:', e.message); }
      if (envio?.rp?.criadas || envio?.rd?.enviados) { this.atualizarGrid(); }
      if (!silencioso) {
        alert(r.novos || r.atualizados || excluidosFora
          ? `${excluidosFora ? `${excluidosFora} documento(s) excluído(s) em outro computador saíram da lista. ` : ''}${zotero === 'baixou' ? 'Zotero conectado trazido do seu Drive. ' : ''}${r.novos} documento(s) novo(s) e ${r.atualizados} atualizado(s)${pastasNovas.importadas ? `, ${pastasNovas.importadas} pasta(s) trazida(s)` : ''} vindos do seu Google Drive.`
          : `${zotero === 'baixou' ? 'Zotero conectado trazido do seu Drive. ' : ''}Seus documentos já estão atualizados com o seu Google Drive.`);
      }
    } catch (err) {
      if (!silencioso) alert(`Não foi possível sincronizar com o Drive: ${err.message}`);
    } finally {
      if (btn && !silencioso) {
        btn.classList.remove('ath-girando');
        btn.disabled = false;
        btn.title = 'Sincronizar: traz do servidor e do Drive o que mudou em outros computadores e envia o que mudou aqui';
      }
    }
  },

  /**
   * O SERVIDOR diz o que vale para este perfil: documentos (título, pasta, arquivo no Drive, o que foi excluído e o que mudou),
   * árvore de pastas, ids das pastas do Drive e a conexão do Zotero. Aqui só se aplica o que ele manda e se envia o que mudou
   * neste computador. Sem a nuvem protegida confirmada, cai no comportamento antigo (local + Drive). Devolve o resultado ou null.
   */
  async sincronizarPerfilServidor() {
    if (!nuvemAutenticada() || this._perfilEmCurso) return null;
    const conta = obterContaAtiva();
    this._perfilEmCurso = true;
    try {
      const pastasAntes = obterPastasDriveLocais();
      const r = await sincronizarPerfil(montarEstadoLocal(this.documentos));
      if (obterContaAtiva() !== conta) return null;
      sincronizarTemplatesUsuario().catch(e => console.warn('[Athenes] Modelos no servidor:', e.message));
      sincronizarBiblioteca().then(res => { if (res?.mudou) { this.renderizarPastasLateral(); this.renderizarBannerPasta(); } }).catch(e => console.warn('[Athenes] Biblioteca no servidor:', e.message));
      this._aplicandoPerfil = true;
      let mudou = false;

      if (r.aplicarDrive) { salvarConfigGoogleDrive({ ...obterConfigGoogleDrive(), ...r.aplicarDrive, raizFixa: true }); mudou = true; }
      if (r.aplicarZotero) {
        let atual = {}; try { atual = JSON.parse(lerConta('athenes_zotero_cfg') || '{}') || {}; } catch (_) {}
        gravarConta('athenes_zotero_cfg', JSON.stringify({ ...atual, ...r.aplicarZotero }));
      }
      const cz = r.indice.zotero?.cfg;
      if (cz) gravarConta('athenes_zotero_sync', JSON.stringify({ hash: chaveDoZotero(cz), em: new Date().toISOString() }));

      if (r.remover.length) { const rm = new Set(r.remover); this.documentos = this.documentos.filter(x => !rm.has(String(x.id))); mudou = true; }
      for (const e of r.adicionar) {
        if (!e.driveFileId && !e.salvoNuvem) continue; // ainda sem conteúdo em lugar nenhum: aparece quando o computador de origem enviar
        this.documentos.unshift({ id: e.id, titulo: e.titulo, subtitulo: e.subtitulo || (e.driveFileId ? 'Do seu Google Drive' : 'Da sua nuvem'), tipoDoc: e.tipoDoc, perfilId: e.perfilId, pastaId: e.pastaId || undefined, driveFileId: e.driveFileId || undefined, driveFolderId: e.driveFolderId || undefined, dataModificacao: e.atualizadoEm, driveSincronizadoEm: e.driveFileId ? (e.conteudoEm || e.atualizadoEm) : undefined, origemDrive: Boolean(e.driveFileId), salvoNuvem: Boolean(e.salvoNuvem), precisaCarregarConteudo: true });
        mudou = true;
      }
      for (const { local, entrada: e } of r.atualizar) {
        const doc = this.documentos.find(x => String(x.id) === local);
        if (!doc) continue;
        Object.assign(doc, { id: e.id, titulo: e.titulo, subtitulo: e.subtitulo || doc.subtitulo, pastaId: e.pastaId || undefined, driveFileId: e.driveFileId || doc.driveFileId, driveFolderId: e.driveFolderId || doc.driveFolderId, dataModificacao: e.atualizadoEm });
        mudou = true;
      }
      for (const id of r.recarregar) {
        const doc = this.documentos.find(x => String(x.id) === id);
        if (doc?.driveFileId) { doc.origemDrive = true; doc.precisaCarregarConteudo = true; mudou = true; }
      }
      // pasta duplicada que foi unificada ou pasta excluída em outro computador: os documentos seguem para a pasta que ficou
      for (const doc of this.documentos) {
        if (r.mapaIds[doc.pastaId]) { doc.pastaId = r.mapaIds[doc.pastaId]; mudou = true; }
        else if (doc.pastaId && r.pastasExcluidas[doc.pastaId]) { doc.pastaId = undefined; mudou = true; }
      }
      if(Object.keys(r.mapaIds).length){
      remapearSelecaoPastas(r.mapaIds);
      const artigos=structuredClone(obterArtigos());
      if(remapearPastasDosArtigos(artigos,r.mapaIds)){definirArtigos(artigos);mudou=true;}
      if(this.estudoView)remapearPastasDosArtigos(this.estudoView.artigos,r.mapaIds);
      if(r.mapaIds[this.pastaAtivaId])this.pastaAtivaId=r.mapaIds[this.pastaAtivaId];
      if(this.estudoView&&r.mapaIds[this.estudoView.pastaFiltroId])this.estudoView.pastaFiltroId=r.mapaIds[this.estudoView.pastaFiltroId];
      }
      const arvoreMudou = JSON.stringify(r.pastas) !== JSON.stringify(pastasAntes);
      if (arvoreMudou) { salvarPastasDriveLocais(r.pastas); this.pastasDrive = obterPastasDriveLocais(); mudou = true; }
      if (mudou) { this.salvarDocumentosLocais(); this.atualizarGrid(); this.renderizarPastasLateral(); }
      this._aplicandoPerfil = false;
      return r;
    } catch (e) {
      console.warn('[Athenes] Índice do perfil no servidor:', e.message);
      return null;
    } finally {
      this._aplicandoPerfil = false;
      this._perfilEmCurso = false;
    }
  }
};
