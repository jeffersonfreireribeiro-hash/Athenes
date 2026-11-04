// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Artigos: inspetor da direita (resumo, citações, Zotero e Drive).
 * Métodos do EstudoArtigosView (usam `this`); são acrescentados ao prototype em athenes_estudo_artigos.js.
 */
import { obterTokenOuConectar, obterTokenDrive } from '../core/athenes_drive_sync.js';
import { obterConfigGoogleDrive, autenticarGoogleDrive, salvarArquivoNoGoogleDrive } from '../core/athenes_colaboracao.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { obterPdfLocal, registrarPdfLocalNoArtigo, garantirPdfDoArtigo, salvarArtigosEstudo, salvarArtigosEstudoDebounced, formatarCitacaoAbntDoArtigo } from './athenes_estudo_artigos_dados.js';

export const metodosEstudoPainelDireito = {
  renderizarPainelDireitoEstudio(box, art) {
    if (!box) return;
    box.innerHTML = '';

    const f = art.fichamento;

    // Coleta todas as notas adesivas fixadas em todas as páginas do PDF
    const todasNotasPdf = [];
    const notasPagObj = f.notasPagina || {};
    Object.keys(notasPagObj).sort((a, b) => Number(a) - Number(b)).forEach(pgKey => {
      const numPag = parseInt(pgKey, 10) || 1;
      (notasPagObj[pgKey] || []).forEach((pin, idx) => {
        todasNotasPdf.push({ numPag, idx: idx + 1, pin });
      });
    });

    if (this.abaDireita === 'resumo') {
      box.innerHTML = `
        <div class="ath-fichamento-bloco">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong class="ath-fichamento-rotulo" style="margin-bottom:0;">Notas Fixadas no PDF (${todasNotasPdf.length})</strong>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnNovaNotaLateral" style="height:24px; padding:0 9px; font-size:11px;">+ Nova Nota</button>
          </div>

          <div class="ath-lista-citacoes-pdf" style="margin-bottom:14px;">
            ${todasNotasPdf.length === 0 ? `
              <div style="padding:12px; text-align:center; color:#64748B; font-size:11.5px; background:#F8FAFC; border-radius:10px; border:1px dashed #CBD5E1;">
                Nenhuma nota fixada nas páginas ainda. Clique em <b>+ Nova Nota</b> ou use a ferramenta <b>Nota</b> na barra superior.
              </div>
            ` : todasNotasPdf.map(({ numPag, idx, pin }) => `
              <div class="ath-citacao-pdf-card" style="border-left: 4px solid ${escapeHtml(pin.cor || '#F59E0B')}; padding:8px 10px;">
                <div class="ath-citacao-pdf-topo" style="margin-bottom:4px;">
                  <span class="ath-citacao-pag-badge" data-ir-nota-pag="${numPag}" data-ir-nota-id="${escapeHtml(pin.id)}" title="Ir até esta nota na Página ${numPag}" style="display:inline-flex; align-items:center; gap:4px;">
                    ${svgIcone('nota', 11)} Pág. ${numPag} · #${idx} ${escapeHtml(pin.titulo || 'Nota')}
                  </span>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="ath-pin-ic-acao ath-pin-ic-neutro" data-min-nota-lat="${escapeHtml(pin.id)}" data-min-nota-pag="${numPag}" title="${pin.minimizado ? 'Expandir nota na folha' : 'Minimizar nota na folha'}" style="width:22px; height:22px;">
                      ${svgIcone(pin.minimizado ? 'mais' : 'minimizar', 11)}
                    </button>
                    <button type="button" class="ath-pin-ic-acao ath-pin-ic-neutro" data-edit-nota-lat="${escapeHtml(pin.id)}" data-edit-nota-pag="${numPag}" title="Editar esta nota" style="width:22px; height:22px;">
                      ${svgIcone('lapis', 11)}
                    </button>
                    <button type="button" class="ath-pin-ic-acao ath-pin-ic-perigo" data-del-nota-lat="${escapeHtml(pin.id)}" data-del-nota-pag="${numPag}" title="Excluir nota" style="width:22px; height:22px;">
                      ${svgIcone('lixeira', 11)}
                    </button>
                  </div>
                </div>
                <div style="font-size:11.5px; color:#1E293B; line-height:1.38; cursor:pointer;" data-edit-nota-lat="${escapeHtml(pin.id)}" data-edit-nota-pag="${numPag}">
                  ${escapeHtml(pin.texto || 'Sem texto (clique para editar)')}
                </div>
              </div>
            `).join('')}
          </div>

          <label class="ath-fichamento-rotulo">Resumo Oficial do Artigo (Zotero)</label>
          <div class="ath-fichamento-resumo-orig">${escapeHtml(art.resumoOriginal || 'Sem resumo cadastrado no Zotero.')}</div>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Meu Resumo & Síntese Crítica</label>
          <textarea id="athEstudoResumoPessoal" class="ath-input" rows="5" placeholder="Escreva aqui o seu resumo do artigo, principais teses do autor e como ele dialoga com sua pesquisa...">${escapeHtml(f.resumoPessoal || '')}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Análise Metodológica & Anotações Livres</label>
          <textarea id="athEstudoMetodoNotas" class="ath-input" rows="4" placeholder="Anote parâmetros, equações, dados estatísticos ou críticas metodológicas...">${escapeHtml(f.metodologiaNotas || '')}</textarea>

          <label class="ath-fichamento-rotulo" style="margin-top:10px;">Tags / Palavras-Chave (Zotero)</label>
          <input type="text" id="athEstudoTagsInput" class="ath-input" value="${escapeHtml((art.palavrasChave || []).join(', '))}" placeholder="Ex.: REURB, Morfologia, SIG">
        </div>
      `;

      box.querySelector('#athBtnNovaNotaLateral').addEventListener('click', () => {
        const pg = this.paginaAtual || 1;
        this.rolarParaPagina(pg, this.container);
        this.criarNotaAdesivaNaPagina(art, pg, 52, 24, '', this.container);
      });

      box.querySelectorAll('[data-ir-nota-pag]').forEach(el => {
        el.addEventListener('click', () => {
          const pg = parseInt(el.dataset.irNotaPag, 10) || 1;
          this.rolarParaPagina(pg, this.container);
        });
      });

      box.querySelectorAll('[data-edit-nota-lat]').forEach(el => {
        el.addEventListener('click', () => {
          const pg = parseInt(el.dataset.editNotaPag, 10) || 1;
          const pinId = el.dataset.editNotaLat;
          const lista = art.fichamento.notasPagina?.[pg] || [];
          const alvo = lista.find(p => p.id === pinId);
          if (alvo) alvo.minimizado = false;
          this.pinEditandoId = pinId;
          this.rolarParaPagina(pg, this.container);
          const layer = this.container?.querySelector(`[data-pins-pag="${pg}"]`);
          this.renderizarPinsDaPagina(layer, art, pg, this.container);
        });
      });

      box.querySelectorAll('[data-min-nota-lat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pg = parseInt(btn.dataset.minNotaPag, 10) || 1;
          const pinId = btn.dataset.minNotaLat;
          const lista = art.fichamento.notasPagina?.[pg] || [];
          const alvo = lista.find(p => p.id === pinId);
          if (alvo) {
            alvo.minimizado = !alvo.minimizado;
            if (alvo.minimizado && this.pinEditandoId === pinId) this.pinEditandoId = null;
            salvarArtigosEstudo(this.artigos);
            const layer = this.container?.querySelector(`[data-pins-pag="${pg}"]`);
            this.renderizarPinsDaPagina(layer, art, pg, this.container);
            this.atualizarPaineisLateraisDeNotas(this.container, art);
          }
        });
      });

      box.querySelectorAll('[data-del-nota-lat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pg = parseInt(btn.dataset.delNotaPag, 10) || 1;
          const pinId = btn.dataset.delNotaLat;
          if (art.fichamento.notasPagina?.[pg]) {
            art.fichamento.notasPagina[pg] = art.fichamento.notasPagina[pg].filter(p => p.id !== pinId);
            if (this.pinEditandoId === pinId) this.pinEditandoId = null;
            salvarArtigosEstudo(this.artigos);
            const layer = this.container?.querySelector(`[data-pins-pag="${pg}"]`);
            this.renderizarPinsDaPagina(layer, art, pg, this.container);
            this.atualizarPaineisLateraisDeNotas(this.container, art);
          }
        });
      });

      box.querySelector('#athEstudoResumoPessoal').addEventListener('input', e => {
        f.resumoPessoal = e.target.value;
        salvarArtigosEstudoDebounced(this.artigos);
      });

      box.querySelector('#athEstudoMetodoNotas').addEventListener('input', e => {
        f.metodologiaNotas = e.target.value;
        salvarArtigosEstudoDebounced(this.artigos);
      });

      box.querySelector('#athEstudoTagsInput').addEventListener('change', e => {
        art.palavrasChave = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        salvarArtigosEstudo(this.artigos);
      });
      return;
    }

    if (this.abaDireita === 'citacoes') {
      const citacoes = f.citacoesMarcadas || [];
      box.innerHTML = `
        <div class="ath-fichamento-bloco">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:11.5px; color:#314F79; text-transform:uppercase;">Citações Marcadas (${citacoes.length})</strong>
            <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnNovaCitacaoPainel">+ Nova Citação</button>
          </div>

          <div style="font-size:10.5px; color:#64748B; margin:-2px 0 8px;">Para usar no texto: no editor, abra <b>Zotero</b>, escolha a obra e clique em <b>Longa</b>. Estes destaques aparecem lá, prontos para inserir como citação direta longa.</div>
          <div class="ath-lista-citacoes-pdf">
            ${citacoes.length === 0 ? `
              <div style="padding:20px 12px; text-align:center; color:#64748B; font-size:12px; background:#F8FAFC; border-radius:10px; border:1px dashed #CBD5E1;">
                Selecione qualquer frase no PDF ao lado para abrir o menu flutuante e clique em <b>+ Citação Zotero</b>.
              </div>
            ` : citacoes.map(c => `
              <div class="ath-citacao-pdf-card" style="border-left: 4px solid ${escapeHtml(c.cor || '#314F79')};">
                <div class="ath-citacao-pdf-topo">
                  <span class="ath-citacao-pag-badge" data-ir-pag="${escapeHtml(c.pagina)}" title="Rolar até a página ${escapeHtml(c.pagina)} do PDF">
                    Pág. PDF ${escapeHtml(c.pagina)}${c.paginaCitacao && String(c.paginaCitacao) !== String(c.pagina) ? ` · p. ${escapeHtml(c.paginaCitacao)}` : ''}
                  </span>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="ath-btn ath-btn-sm" data-edit-cit="${escapeHtml(c.id)}" title="Editar esta citação" style="height:22px; padding:0 7px; font-size:10.5px;">✎ Editar</button>
                    <button type="button" class="ath-btn ath-btn-sm" data-copiar-cit="${escapeHtml(c.id)}" style="height:22px; padding:0 7px; font-size:10.5px;">Copiar ABNT</button>
                    <button type="button" class="ath-btn ath-btn-sm" data-del-cit="${escapeHtml(c.id)}" style="height:22px; padding:0 6px; font-size:10.5px; color:#B42318;">✕</button>
                  </div>
                </div>
                <blockquote class="ath-citacao-pdf-texto">"${escapeHtml(c.texto)}"</blockquote>
                <div class="ath-citacao-pdf-ref">${escapeHtml(formatarCitacaoAbntDoArtigo(art, c.paginaCitacao || c.pagina))}</div>
                ${c.comentario ? `<div class="ath-citacao-pdf-nota">💡 ${escapeHtml(c.comentario)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;

      box.querySelector('#athBtnNovaCitacaoPainel').addEventListener('click', () => {
        this.abrirModalCitacaoPdf(art, { pagina: this.paginaAtual });
      });

      box.querySelectorAll('[data-ir-pag]').forEach(el => {
        el.addEventListener('click', () => {
          const pg = parseInt(el.dataset.irPag, 10) || 1;
          this.rolarParaPagina(pg, this.container);
        });
      });

      box.querySelectorAll('[data-edit-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = citacoes.find(x => x.id === btn.dataset.editCit);
          if (c) this.abrirModalCitacaoPdf(art, c);
        });
      });

      box.querySelectorAll('[data-copiar-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = citacoes.find(x => x.id === btn.dataset.copiarCit);
          if (!c) return;
          const formatada = `"${c.texto}" ${formatarCitacaoAbntDoArtigo(art, c.paginaCitacao || c.pagina)}`;
          navigator.clipboard?.writeText(formatada);
          btn.textContent = 'Copiado ✓';
          setTimeout(() => { btn.textContent = 'Copiar ABNT'; }, 1400);
        });
      });

      box.querySelectorAll('[data-del-cit]').forEach(btn => {
        btn.addEventListener('click', () => {
          f.citacoesMarcadas = citacoes.filter(x => x.id !== btn.dataset.delCit);
          salvarArtigosEstudo(this.artigos);
          this.atualizarAbaCitacoesEContadores(art);
        });
      });
      return;
    }

    // Aba 3: Vínculo Zotero & Google Drive
    const cfgDrivePainel = obterConfigGoogleDrive();
    const driveConectadoPainel = Boolean(cfgDrivePainel.accessToken);
    box.innerHTML = `
      <div class="ath-fichamento-bloco">
        <!-- Vínculo de Metadados com o Zotero -->
        <div style="padding:10px 12px; border-radius:12px; background:#F8FAFC; border:1px solid #CBD5E1; margin-bottom:10px;">
          <strong style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#1F2733; text-transform:uppercase; margin-bottom:8px;">
            ${svgIcone('zotero', 13)} Vínculo de Metadados com o Zotero
          </strong>
          <button type="button" class="ath-btn ath-btn-primary ath-btn-sm" id="athBtnVincularRefExistenteZotero" style="width:100%; justify-content:center; margin-bottom:8px; white-space:normal; height:auto; padding:6px 10px; line-height:1.2; text-align:center;">
            ${svgIcone('zotero', 13)} Vincular com Referência do Zotero
          </button>
          <div class="ath-card-grade-campos" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <label>API Key
              <input type="text" class="ath-input" id="athDirZoteroApiKey" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Chave Zotero" style="margin-top:2px; height:28px; font-size:11px;">
            </label>
            <label>User ID
              <input type="text" class="ath-input" id="athDirZoteroUserId" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="ID Zotero" style="margin-top:2px; height:28px; font-size:11px;">
            </label>
            <label>Item Key
              <input type="text" class="ath-input" id="athZoteroKeyArtigo" value="${escapeHtml(art.chaveZotero || '')}" placeholder="Ex.: JKCLFWH6" style="margin-top:2px; height:28px; font-size:11px;">
            </label>
            <label>DOI
              <input type="text" class="ath-input" id="athDoiArtigo" value="${escapeHtml(art.doi || '')}" placeholder="Identificador" style="margin-top:2px; height:28px; font-size:11px;">
            </label>
          </div>
        </div>

        <!-- Selecionar & Vincular PDF (Google Drive / Local) -->
        <div style="padding:10px 12px; border-radius:12px; background:#EEF4FA; border:1px solid #C8D7E6; margin-bottom:10px;">
          <strong style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#314F79; text-transform:uppercase; margin-bottom:8px;">
            ${svgIcone('drive', 13)} Selecionar & Vincular PDF (Drive / Local)
          </strong>
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
            <label class="ath-btn ath-btn-primary ath-btn-sm ath-btn-selecionar-pdf-painel" style="width:100%; justify-content:center; cursor:pointer; color:#FFFFFF !important; white-space:normal; height:auto; padding:7px 10px; line-height:1.2; text-align:center;">
              ${svgIcone('upload', 13)} <span style="color:#FFFFFF !important; font-weight:700;">Selecionar Arquivo PDF (Computador / Pasta)</span>
              <input type="file" accept=".pdf,application/pdf" id="athPainelInputArquivoPdf" style="display:none;">
            </label>
            <div style="display:grid; grid-template-columns: 1fr auto; gap:6px;">
              <button type="button" class="ath-btn ath-btn-sm" id="athBtnPainelEscolherPdfDrive" style="justify-content:center; white-space:nowrap; padding:0 8px; font-size:11px;">
                ${svgIcone('drive', 13)} Buscar no Drive
              </button>
              <button type="button" class="ath-btn ${driveConectadoPainel ? 'ath-btn-zotero-ok' : ''} ath-btn-sm" id="athBtnPainelConectarDrive" title="Conectar ou autorizar Google Drive" style="white-space:nowrap; padding:0 8px; font-size:11px;">
                ${driveConectadoPainel ? 'Drive OK ✓' : 'Conectar'}
              </button>
            </div>
            <button type="button" class="ath-btn ath-btn-sm" id="athBtnSalvarPdfNoDriveDireto" style="width:100%; justify-content:center; background:#F0FDF4; border-color:#86EFAC; color:#15803D; font-weight:700; font-size:11.5px; height:28px; white-space:nowrap;" title="Salvar este arquivo PDF diretamente na pasta do Google Drive">
              ${svgIcone('drive', 13)} Salvar PDF na Pasta do Drive ↗
            </button>
          </div>
          <div class="ath-card-grade-campos" style="display:grid; grid-template-columns:1fr; gap:6px;">
            <label>Nome do Arquivo PDF
              <input type="text" class="ath-input" id="athDriveNomeArqArtigo" value="${escapeHtml(art.driveFileName || '')}" placeholder="Ex.: Silva_2026.pdf" style="margin-top:2px; height:28px; font-size:11px;">
            </label>
            <label>ID / Link do PDF no Google Drive
              <input type="text" class="ath-input" id="athDriveIdArqArtigo" value="${escapeHtml(art.driveFileId || '')}" placeholder="ID do arquivo no Google Drive" style="margin-top:2px; height:28px; font-size:11px;">
            </label>
          </div>
        </div>

        <button type="button" class="ath-btn ath-btn-primary" id="athBtnSyncCompletoPainel" style="width:100%; justify-content:center; color:#FFFFFF !important; font-weight:700;">
          ${svgIcone('salvar', 14)} <span style="color:#FFFFFF !important;">Sincronizar Agora (Zotero + Drive + Supabase)</span>
        </button>
        <div id="athStatusSyncArtigo" style="font-size:11.5px; margin-top:8px; color:#15803D; font-weight:700;"></div>
      </div>
    `;

    box.querySelector('#athBtnVincularRefExistenteZotero').addEventListener('click', () => {
      this.abrirModalEscolherReferenciaZotero(art);
    });

    box.querySelector('#athPainelInputArquivoPdf')?.addEventListener('change', async e => {
      const fPdf = e.target.files?.[0];
      if (!fPdf) return;
      registrarPdfLocalNoArtigo(art, fPdf);
      salvarArtigosEstudo(this.artigos);
      const statusEl = box.querySelector('#athStatusSyncArtigo');
      if (statusEl) {
        statusEl.style.color = '#15803D';
        statusEl.textContent = `PDF "${fPdf.name}" carregado na folha!`;
      }
      const tokenPainel = await obterTokenDrive();
      if (tokenPainel) {
        try {
          const salvo = await salvarArquivoNoGoogleDrive({
            nomeArquivo: fPdf.name,
            conteudoBlobOuTexto: fPdf,
            mimeType: 'application/pdf',
            accessToken: tokenPainel,
            pastaId: cfgDrivePainel.pastaId || null,
            driveFileId: art.driveFileId || null
          });
          if (salvo?.id) {
            art.driveFileId = salvo.id;
            art.driveFileName = salvo.name || fPdf.name;
            salvarArtigosEstudo(this.artigos);
          }
        } catch (_) {}
      }
      this.renderizar();
    });

    box.querySelector('#athBtnSalvarPdfNoDriveDireto')?.addEventListener('click', async () => {
      const statusEl = box.querySelector('#athStatusSyncArtigo');
      if (statusEl) {
        statusEl.style.color = '#314F79';
        statusEl.textContent = 'Enviando PDF para a pasta do Google Drive...';
      }
      try {
        const cfgDrive = obterConfigGoogleDrive();
        const token = await obterTokenOuConectar(cfgDrive);
        const pdfBlob = await obterPdfLocal(art.id) || art.pdfBlob;
        if (!pdfBlob) {
          if (statusEl) {
            statusEl.style.color = '#B42318';
            statusEl.textContent = 'Selecione ou carregue o PDF primeiro antes de enviar.';
          }
          return;
        }
        const nomeArquivo = art.driveFileName || `${(art.titulo || 'artigo').slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        const salvo = await salvarArquivoNoGoogleDrive({
          nomeArquivo,
          conteudoBlobOuTexto: pdfBlob,
          mimeType: 'application/pdf',
          accessToken: token,
          pastaId: cfgDrive.pastaId || null,
          driveFileId: art.driveFileId || null
        });
        if (salvo?.id) {
          art.driveFileId = salvo.id;
          art.driveFileName = salvo.name || nomeArquivo;
          salvarArtigosEstudo(this.artigos);
          if (statusEl) {
            statusEl.style.color = '#15803D';
            statusEl.textContent = '✓ PDF salvo com sucesso na sua pasta do Google Drive!';
          }
          this.renderizar();
        }
      } catch (err) {
        if (statusEl) {
          statusEl.style.color = '#B42318';
          statusEl.textContent = `Atenção: ${err.message || err}`;
        }
      }
    });

    box.querySelector('#athBtnPainelEscolherPdfDrive')?.addEventListener('click', () => {
      this.abrirModalEscolherPdfDoGoogleDrive((arqDrive) => {
        art.driveFileName = arqDrive.name;
        art.driveFileId = arqDrive.id;
        art.pdfBlobUrl = null;
        salvarArtigosEstudo(this.artigos);
        this.renderizar();
        garantirPdfDoArtigo(art).then(ok => { if (ok) this.renderizar(); });
      });
    });

    box.querySelector('#athBtnPainelConectarDrive').addEventListener('click', async () => {
      const statusEl = box.querySelector('#athStatusSyncArtigo');
      statusEl.style.color = '#314F79';
      statusEl.textContent = 'Abrindo janela de autorização do Google Drive...';
      try {
        await autenticarGoogleDrive(cfgDrivePainel.clientId);
        statusEl.style.color = '#15803D';
        statusEl.textContent = 'Google Drive conectado com sucesso! ✓';
        this.renderizar();
      } catch (err) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = `Atenção: ${err.message || 'Verifique se https://athenes.vercel.app está em Origens JavaScript autorizadas.'}`;
      }
    });

    box.querySelector('#athDirZoteroApiKey').addEventListener('change', e => {
      this.salvarConfigZotero({ apiKey: e.target.value.trim() });
    });
    box.querySelector('#athDirZoteroUserId').addEventListener('change', e => {
      this.salvarConfigZotero({ userId: e.target.value.trim() });
    });
    box.querySelector('#athDriveNomeArqArtigo').addEventListener('change', e => {
      art.driveFileName = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athDriveIdArqArtigo').addEventListener('change', e => {
      art.driveFileId = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athZoteroKeyArtigo').addEventListener('change', e => {
      art.chaveZotero = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athDoiArtigo').addEventListener('change', e => {
      art.doi = e.target.value.trim();
      salvarArtigosEstudo(this.artigos);
    });
    box.querySelector('#athBtnSyncCompletoPainel').addEventListener('click', () => {
      const apiKeyIn = box.querySelector('#athDirZoteroApiKey')?.value.trim();
      const userIdIn = box.querySelector('#athDirZoteroUserId')?.value.trim();
      if (apiKeyIn !== undefined) this.salvarConfigZotero({ apiKey: apiKeyIn, userId: userIdIn });
      this.sincronizarArtigoComDriveEZotero(art, box.querySelector('#athBtnSyncCompletoPainel'), box.querySelector('#athStatusSyncArtigo'));
    });
  }
};
