// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Estúdio de Artigos: inspetor da direita (resumo, citações, Zotero e Drive).
 * Métodos do EstudoArtigosView (usam `this`); são acrescentados ao prototype em athenes_estudo_artigos.js.
 */
import { obterTokenOuConectar, obterTokenDrive } from '../core/athenes_drive_sync.js';
import { obterConfigGoogleDrive, autenticarGoogleDrive, salvarArquivoNoGoogleDrive } from '../core/athenes_colaboracao.js';
import { escapeHtml, sanitizarHtmlEditorial } from '../core/athenes_seguranca.js';
import { linhasInformacoesZotero, informacoesDoArtigo } from '../core/athenes_zotero_campos.js';
import { svgIcone, svgGoogleDrive } from './athenes_icones.js';
import { obterPdfLocal, registrarPdfLocalNoArtigo, garantirPdfDoArtigo, salvarArtigosEstudo, salvarArtigosEstudoDebounced, formatarCitacaoAbntDoArtigo, artigoTemPdf, ehArtigoExemploFicticio } from './athenes_estudo_artigos_dados.js';

export const metodosEstudoPainelDireito = {
  /** "Informações" do item no Zotero (tipo, campos do tipo, autores com função, datas), só os preenchidos. */
  htmlInformacoesZotero(art) {
    const linhas = linhasInformacoesZotero(informacoesDoArtigo(art));
    if (!linhas.length) return '';
    return `<details class="ath-zot-info" open>
      <summary class="ath-fichamento-rotulo" style="cursor:pointer; margin-top:14px;">Informações do Zotero</summary>
      <dl class="ath-zot-info-lista">${linhas.map(l => `<dt>${escapeHtml(l.rotulo)}</dt><dd>${l.valor.startsWith('http://') || l.valor.startsWith('https://') ? `<a href="${escapeHtml(l.valor)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.valor)}</a>` : escapeHtml(l.valor)}</dd>`).join('')}</dl>
    </details>`;
  },

  /** Notas e anotações do Zotero: somente leitura, HTML sanitizado, com a data da última alteração. */
  htmlNotasDoZotero(art) {
    const notas = Array.isArray(art.notasZotero) ? art.notasZotero : [];
    if (!notas.length) return '';
    const data = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR'); };
    return `<label class="ath-fichamento-rotulo" style="margin-top:10px;">Notas do Zotero (${notas.length})</label>
      <div class="ath-zot-notas">${notas.map(n => `
        <div class="ath-citacao-pdf-card" style="border-left:4px solid #314F79; padding:8px 10px; margin-bottom:6px;">
          <div style="font-size:10px; color:#64748B; margin-bottom:3px;">Zotero${data(n.data) ? ` · ${escapeHtml(data(n.data))}` : ''} · somente leitura</div>
          <div style="font-size:11.5px; color:#1E293B; line-height:1.38;">${sanitizarHtmlEditorial(n.html)}</div>
        </div>`).join('')}</div>`;
  },

  htmlQuemTemAcesso(art) {
    const ehCompartilhadoComigo = Boolean(art.compartilhadoComigo || art.proprietarioExterno);
    const donoNome = art.proprietario?.nome || art.proprietario?.conta || art.proprietario_email || (ehCompartilhadoComigo ? 'Outro autor' : 'Você');
    const donoEmail = art.proprietario?.email || art.proprietario_email || '';
    const meuPapel = art.permissao || (ehCompartilhadoComigo ? 'leitura' : 'dono');
    
    const pessoasMap = art.compartilhamento?.pessoas || art.permissoes || {};
    const listaPessoas = Object.entries(pessoasMap).filter(([em]) => em && em.includes('@'));
    const linkPublico = Boolean(art.compartilhamento?.publico || art.publico_leitura);

    const rotuloPapel = (p) => {
      if (p === 'edicao') return 'Editor';
      if (p === 'comentario') return 'Comentador';
      return 'Leitor';
    };

    return `
      <section class="ath-zd-sec ath-zd-colab-sec" style="border-top:1px solid #E2E8F0; padding-top:14px; margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:12.5px; font-weight:800; color:#314F79; display:flex; align-items:center; gap:6px;">
            ${svgIcone('usuarios', 13)} Quem tem acesso ao documento
          </h4>
          <button type="button" class="ath-btn ath-btn-sm" id="athBtnCompartilharPainelZd" title="Gerenciar permissões ou convidar pessoas" style="height:26px; padding:0 8px; font-size:11px; display:inline-flex; align-items:center; gap:4px;">
            ${svgIcone('usuarios', 11)} Compartilhar...
          </button>
        </div>

        ${ehCompartilhadoComigo ? `
          <div style="background:#EEF4FA; border:1px solid #CBD5E1; border-radius:10px; padding:10px 12px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:6px; font-weight:800; font-size:11.5px; color:#314F79; margin-bottom:3px;">
              ${svgIcone('usuarios', 12)} Documento compartilhado com você
            </div>
            <div style="font-size:11px; color:#334155; line-height:1.4;">
              Proprietário: <strong>${escapeHtml(donoNome)}</strong>${donoEmail ? ` (${escapeHtml(donoEmail)})` : ''}
            </div>
            <div style="margin-top:5px; font-size:11px; font-weight:700; color:#0369A1;">
              Sua permissão: <span class="ath-badge ath-badge-info" style="font-size:10px; text-transform:uppercase;">${rotuloPapel(meuPapel)}</span>
            </div>
          </div>
        ` : `
          <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:8px 12px; margin-bottom:10px; font-size:11.5px; color:#166534; display:flex; align-items:center; gap:6px;">
            ${svgIcone('verificado', 13)} <span>Você é o <strong>proprietário</strong> deste artigo</span>
          </div>
        `}

        <div style="font-size:11px; font-weight:700; color:#64748B; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em;">
          Pessoas com acesso direto (${listaPessoas.length + 1})
        </div>

        <ul style="list-style:none; padding:0; margin:0 0 10px 0; display:flex; flex-direction:column; gap:5px;">
          <!-- Proprietário -->
          <li style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; font-size:11px;">
            <div style="display:flex; flex-direction:column; min-width:0;">
              <strong style="color:#1E293B; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(donoNome)}</strong>
              ${donoEmail ? `<small style="color:#64748B; font-size:10px;">${escapeHtml(donoEmail)}</small>` : ''}
            </div>
            <span class="ath-badge ath-badge-primary" style="font-size:9.5px; text-transform:uppercase;">Proprietário</span>
          </li>

          <!-- Convidados -->
          ${listaPessoas.map(([email, papel]) => `
            <li style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; font-size:11px;">
              <span style="color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${escapeHtml(email)}</span>
              <span class="ath-badge ath-badge-info" style="font-size:9.5px; text-transform:uppercase;">${rotuloPapel(papel)}</span>
            </li>
          `).join('')}
        </ul>

        <div style="padding:7px 10px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; font-size:11px; color:#475569; display:flex; align-items:center; gap:6px;">
          ${linkPublico 
            ? `<span style="color:#059669; font-weight:700; display:inline-flex; align-items:center; gap:6px;">${svgIcone('globo', 13)} Link Público: Qualquer pessoa com o link pode ler</span>` 
            : `<span style="color:#64748B; display:inline-flex; align-items:center; gap:6px;">${svgIcone('cadeado', 13)} Acesso restrito apenas a pessoas convidadas</span>`}
        </div>
      </section>
    `;
  },

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

          ${this.htmlNotasDoZotero(art)}

          ${this.htmlInformacoesZotero(art)}
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
                ${c.comentario ? `<div class="ath-citacao-pdf-nota">${svgIcone('lampada', 13)} ${escapeHtml(c.comentario)}</div>` : ''}
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

    // Aba 3: Vínculo Zotero & Google Drive (Redesenhada no padrão Soft UI)
    const cfgDrivePainel = obterConfigGoogleDrive();
    const driveConectadoPainel = Boolean(cfgDrivePainel.accessToken);
    const temPdfPainel = artigoTemPdf(art);
    const zoteroOk = this.temZoteroConectado();
    const idDriveReal = String(art.driveFileId || '').trim() && !/^drive_pdf_/.test(String(art.driveFileId));
    const anexoZ = art.anexoPdfZotero;
    const situacaoPdfTexto = art.pdfBlobUrl
      ? (idDriveReal ? 'Sincronizado no Google Drive' : 'Aberto na sessão local')
      : idDriveReal ? 'Guardado no Google Drive'
      : anexoZ?.baixavel ? 'Disponível no Zotero'
      : anexoZ ? 'Arquivo no computador local'
      : 'Nenhum PDF vinculado';
    const situacaoPdfOk = Boolean(art.pdfBlobUrl || idDriveReal);

    box.innerHTML = `
      <div class="ath-zd">
        <!-- 1. Status Moderno de Conexão (Zotero & Google Drive) -->
        <div class="ath-zd-status-topo">
          <!-- Card Zotero -->
          <div class="ath-zd-status-card">
            <div class="ath-zd-status-card-head">
              <span style="display:inline-flex; align-items:center; gap:5px;">
                ${svgIcone('zotero', 13)} Zotero
              </span>
              <span class="ath-zd-dot ${zoteroOk ? 'ok' : 'aviso'}" title="${zoteroOk ? 'Conta conectada' : 'Sem chave de API'}"></span>
            </div>
            <span class="ath-zd-status-card-sub" title="${art.chaveZotero ? 'Item ' + art.chaveZotero : 'Item não vinculado'}">
              ${art.chaveZotero ? 'Obra ' + escapeHtml(art.chaveZotero) : (zoteroOk ? 'Conectado' : 'Desconectado')}
            </span>
          </div>

          <!-- Card Google Drive com ícone oficial 2026 -->
          <div class="ath-zd-status-card">
            <div class="ath-zd-status-card-head">
              <span style="display:inline-flex; align-items:center; gap:5px;">
                ${svgGoogleDrive(14)} Drive
              </span>
              <span class="ath-zd-dot ${driveConectadoPainel ? 'ok' : 'aviso'}" title="${driveConectadoPainel ? 'Google Drive conectado' : 'Drive não conectado'}"></span>
            </div>
            <span class="ath-zd-status-card-sub" title="${driveConectadoPainel ? 'Google Drive Ativo' : 'Clique para conectar'}">
              ${driveConectadoPainel ? 'Conectado' : 'Não conectado'}
            </span>
          </div>
        </div>

        <!-- 2. PDF do artigo com design limpo e Soft UI -->
        <section class="ath-zd-sec">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4>${svgIcone('pdf', 14)} PDF do Artigo</h4>
            <span class="ath-badge ${situacaoPdfOk ? 'ath-badge-sucesso' : 'ath-badge-info'}" style="font-size:9.5px; text-transform:uppercase;">
              ${situacaoPdfOk ? 'Vinculado' : 'Pendente'}
            </span>
          </div>

          <!-- Card do arquivo -->
          <div class="ath-zd-arquivo-card">
            <div class="ath-zd-arquivo-icone">
              ${svgIcone('pdf', 18)}
            </div>
            <div class="ath-zd-arquivo-info">
              <div class="ath-zd-arquivo-nome" title="${escapeHtml(art.driveFileName || art.titulo || '')}">
                ${art.driveFileName && temPdfPainel ? escapeHtml(art.driveFileName) : '<em>Nenhum PDF selecionado</em>'}
              </div>
              <div class="ath-zd-arquivo-status">
                <span class="ath-zd-dot ${situacaoPdfOk ? 'ok' : 'aviso'}"></span>
                <span>${situacaoPdfTexto}</span>
              </div>
            </div>
          </div>

          <!-- Ações do PDF com padrão Soft UI -->
          <div class="ath-zd-acoes-pdf">
            <label class="ath-btn ath-btn-sm ath-zd-btn-pdf principal" title="Trocar ou selecionar PDF a partir do computador">
              ${svgIcone('upload', 13)} <span>${temPdfPainel ? 'Trocar PDF' : 'Selecionar PDF'}</span>
              <input type="file" accept=".pdf,application/pdf" id="athPainelInputArquivoPdf" style="display:none;">
            </label>
            <button type="button" class="ath-btn ath-btn-sm ath-zd-btn-pdf drive" id="athBtnPainelEscolherPdfDrive" title="Buscar PDF salvo na pasta do Google Drive">
              ${svgGoogleDrive(14)} <span>Buscar no Drive</span>
            </button>
          </div>

          <!-- Ações secundárias discretas -->
          <div class="ath-zd-acoes-secundarias">
            ${temPdfPainel && !ehArtigoExemploFicticio(art) ? `
              <button type="button" class="ath-zd-btn-sub desvincular" id="athBtnDesvincularPdf" title="Desvincula este PDF da referência (não exclui do computador)">
                ${svgIcone('lixeira', 12)} Desvincular
              </button>
            ` : '<span></span>'}

            ${art.pdfBlobUrl && (!idDriveReal) ? `
              <button type="button" class="ath-zd-btn-sub guardar" id="athBtnSalvarPdfNoDriveDireto" title="Salvar este arquivo na pasta Bibliografia_PDFs do seu Drive">
                ${svgGoogleDrive(13)} Guardar no Drive
              </button>
            ` : ''}

            ${!driveConectadoPainel ? `
              <button type="button" class="ath-zd-btn-sub" id="athBtnPainelConectarDrive" style="color:#0369A1;" title="Autorizar Google Drive">
                ${svgGoogleDrive(12)} Conectar Drive
              </button>
            ` : ''}
          </div>

          <!-- Detalhes do arquivo em acordeão limpo -->
          <details class="ath-zd-det">
            <summary>Detalhes técnicos do arquivo</summary>
            <label>Nome do arquivo
              <input type="text" class="ath-input" id="athDriveNomeArqArtigo" value="${escapeHtml(art.driveFileName || '')}" placeholder="Ex.: Silva_2026.pdf">
            </label>
            <label>ID ou link no Google Drive
              <input type="text" class="ath-input" id="athDriveIdArqArtigo" value="${escapeHtml(art.driveFileId || '')}" placeholder="ID do arquivo no Google Drive">
            </label>
          </details>
        </section>

        <!-- Compartilhamento & Quem tem Acesso a este Documento (Sem emojis) -->
        ${this.htmlQuemTemAcesso(art)}

        <!-- 3. Obra no Zotero -->
        <section class="ath-zd-sec">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4>${svgIcone('zotero', 14)} Obra no Zotero</h4>
          </div>
          <button type="button" class="ath-btn ath-btn-sm ath-zd-principal-suave" id="athBtnVincularRefExistenteZotero" style="width:100%; height:32px; font-weight:750; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
            ${svgIcone('zotero', 13)} ${art.chaveZotero ? 'Trocar a referência vinculada' : 'Vincular com uma referência do Zotero'}
          </button>
          <div class="ath-zd-grade">
            <label>Chave do item
              <input type="text" class="ath-input" id="athZoteroKeyArtigo" value="${escapeHtml(art.chaveZotero || '')}" placeholder="Ex.: JKCLFWH6">
            </label>
            <label>DOI
              <input type="text" class="ath-input" id="athDoiArtigo" value="${escapeHtml(art.doi || '')}" placeholder="10.xxxx/xxxxx">
            </label>
          </div>
        </section>

        <!-- 4. Conexão com a conta Zotero -->
        <details class="ath-zd-sec ath-zd-det-sec" ${zoteroOk ? '' : 'open'}>
          <summary><h4>${svgIcone('zotero', 13)} Configurar Conta Zotero</h4></summary>
          <div class="ath-zd-grade">
            <label>Chave de API
              <span class="ath-zd-segredo">
                <input type="password" class="ath-input" id="athDirZoteroApiKey" value="${escapeHtml(this.zoteroClient.apiKey || '')}" placeholder="Cole a chave" autocomplete="off" spellcheck="false">
                <button type="button" class="ath-btn ath-btn-sm" id="athBtnVerChaveZotero" aria-label="Mostrar ou ocultar a chave" aria-pressed="false">Mostrar</button>
              </span>
            </label>
            <label>User ID
              <input type="text" class="ath-input" id="athDirZoteroUserId" value="${escapeHtml(this.zoteroClient.userId || '')}" placeholder="Preenchido pela chave" inputmode="numeric">
            </label>
          </div>
          <small class="ath-zd-dica">A chave é gerada em zotero.org/settings/keys e armazenada de forma segura.</small>
        </details>

        <!-- 5. Rodapé: Sincronização geral -->
        <div class="ath-zd-rodape">
          <button type="button" class="ath-btn ath-btn-primary ath-zd-sync" id="athBtnSyncCompletoPainel">
            ${svgIcone('salvar', 14)} <span>Sincronizar agora</span>
          </button>
          <div id="athStatusSyncArtigo" class="ath-zd-status" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    box.querySelector('#athBtnCompartilharPainelZd')?.addEventListener('click', () => {
      this.abrirModalCompartilharArtigo(art);
    });

    box.querySelector('#athBtnDesvincularPdf')?.addEventListener('click', () => this.desvincularPdfDoArtigo(art));

    box.querySelector('#athBtnVerChaveZotero')?.addEventListener('click', (e) => {
      const campo = box.querySelector('#athDirZoteroApiKey');
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      e.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
      e.currentTarget.setAttribute('aria-pressed', String(mostrar));
    });

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
      this.escolherPdfNoDrive(art); // navega por todo o Drive e copia o PDF escolhido para a pasta do Athenes
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
