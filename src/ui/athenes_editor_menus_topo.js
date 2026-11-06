// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Editor: menus do topo (Arquivo & Margens, Cabeçalho & Rodapé, Estilos de Texto, Configurações).
 * Métodos do EditorView (usam `this`); são acrescentados ao prototype em athenes_editor.js.
 */
import { obterTokenOuConectar } from '../core/athenes_drive_sync.js';
import { estiloParaCss, FONTES_SISTEMA } from '../core/athenes_estilos.js';
import { svgIcone } from './athenes_icones.js';
import { ModalCompartilhar } from './athenes_compartilhar_modal.js';
import { ModalConfigPagina } from './athenes_config_pagina_modal.js';
import { abrirSalvarTemplateModal } from './athenes_novo_documento_modal.js';
import { salvarPerfilColaborador, garantirEstruturaSugestoes, aceitarSugestaoNoDocumento, rejeitarSugestaoNoDocumento, salvarDocumentoNoSupabase, listarDocumentosDoSupabase, carregarDocumentoDoSupabase, obterConfigGoogleDrive, autenticarGoogleDrive, salvarArquivoNoGoogleDrive, listarArquivosDoGoogleDrive, baixarArquivoDoGoogleDrive, obterInfoUsuarioGoogle, obterOuCriarEstruturaPastasAthenes } from '../core/athenes_colaboracao.js';

import { alinhamentoCss } from './athenes_editor_comum.js';

export const metodosMenusTopo = {
  montarMenusTopo(root) {
    const mestra = this.obterMestraAtiva();
    const margens = mestra.margens_mm || { t: 25, r: 20, b: 20, l: 25 };
    const estilos = this.doc.estilos || [];

    const popArquivo = root.querySelector('#athPopoverArquivo');
    const popEstilos = root.querySelector('#athPopoverEstilos');
    const popNuvem = root.querySelector('#athPopoverNuvem');
    const popConfig = root.querySelector('#athPopoverConfig');
    const popSemantica = root.querySelector('#athPopoverSemantica');

    const btnArquivo = root.querySelector('#athBtnMenuArquivo');
    const btnCabRod = root.querySelector('#athBtnMenuCabRod');
    const btnEstilos = root.querySelector('#athBtnMenuEstilos');
    const btnConfig = root.querySelector('#athBtnMenuConfig'); // a engrenagem abre o menu e também "acende" quando a Nuvem está aberta
    const btnSemantica = root.querySelector('#athBtnMenuSemantica, #athBtnSemanticaTopo');

    const popovers = { arquivo: popArquivo, estilos: popEstilos, config: popConfig, nuvem: popNuvem, semantica: popSemantica };
    const botoes = { arquivo: btnArquivo, estilos: btnEstilos, config: btnConfig, nuvem: btnConfig, semantica: btnSemantica };

    const fecharTodos = () => {
      Object.values(popovers).forEach(p => { if (p) p.hidden = true; });
      Object.values(botoes).forEach(b => {
        if (b) {
          b.setAttribute('aria-expanded', 'false');
          b.classList.remove('ativo');
        }
      });
      this.menuTopoAberto = null;
    };

    const togglePopover = (chave) => {
      const p = popovers[chave];
      const b = botoes[chave];
      if (!p || !b) return;
      const estavaAberto = !p.hidden;
      fecharTodos();
      if (!estavaAberto) {
        p.hidden = false;
        b.setAttribute('aria-expanded', 'true');
        b.classList.add('ativo');
        this.menuTopoAberto = chave;
        if (chave === 'arquivo') {
          this.pintarDiagramaMargens();
        } else if (chave === 'semantica' && p) {
          this.semanticaUI?.renderizarConteudoPopover(p);
        }
      }
    };

    btnArquivo.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('arquivo');
    });

    // cabeçalho, rodapé, paginação e notas ficam só na janela "Configuração de Página" (sem um segundo painel com os mesmos campos)
    btnCabRod.addEventListener('click', (e) => {
      e.stopPropagation();
      fecharTodos();
      new ModalConfigPagina(this.doc, this.obterMestraAtiva(), {
        onSalvar: () => {
          this.menuTopoAberto = null;
          this.notificarMudanca();
          this.renderizar();
        }
      });
    });

    btnEstilos.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('estilos');
    });

    btnSemantica?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('semantica');
    });

    btnConfig?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('config');
    });

    popConfig?.querySelectorAll('[data-cfg]').forEach(item => item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.dataset.cfg === 'tema') { fecharTodos(); this.abrirModalCentralEstilos(); }
      else togglePopover('nuvem'); // fecha o menu e abre o painel de Nuvem & Drive no mesmo lugar
    }));

    // 1. Popover Arquivo & Margens
    popArquivo.innerHTML = `
      <div class="rm-popover-topo-head">
        <strong>Arquivo & Margens</strong>
        <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
      </div>
      <label>Nome
        <input type="text" id="rmNome" value="${this.doc.titulo || ''}">
      </label>
      <label>Descrição
        <input type="text" id="rmDescricao" value="${this.doc.subtitulo || ''}" placeholder="Subtítulo ou resumo breve">
      </label>
      <div class="rm-linha2">
        <label>Um documento por
          <select id="rmEscopo" class="glx-select">
            <option value="artigo" ${this.doc.tipoDoc === 'artigo' ? 'selected' : ''}>Artigo Científico</option>
            <option value="relatorio" ${this.doc.tipoDoc === 'relatorio' ? 'selected' : ''}>Relatório Técnico</option>
            <option value="monografia" ${this.doc.tipoDoc === 'monografia' ? 'selected' : ''}>Monografia / TCC</option>
            <option value="ensaio" ${this.doc.tipoDoc === 'ensaio' ? 'selected' : ''}>Ensaio / Paper</option>
          </select>
        </label>
        <label>Página
          <select id="rmOrientacao" class="glx-select">
            <option value="retrato" ${mestra.orientacao === 'retrato' ? 'selected' : ''}>A4 retrato</option>
            <option value="paisagem" ${mestra.orientacao === 'paisagem' ? 'selected' : ''}>A4 paisagem</option>
          </select>
        </label>
      </div>

      <span class="rm-rot" style="margin-top:4px;">Margens da folha</span>
      <div class="rm-margens">
        <div class="rm-folha-mini" aria-hidden="true"><i id="rmMDiag"></i></div>
        <div class="rm-margens-campos">
          <label class="rm-mm rm-mm-t"><span>Topo</span><div class="rm-mm-in"><input type="number" id="rmMT" min="5" max="50" step="1" value="${margens.t}"><em>mm</em></div></label>
          <label class="rm-mm rm-mm-b"><span>Base</span><div class="rm-mm-in"><input type="number" id="rmMB" min="5" max="50" step="1" value="${margens.b}"><em>mm</em></div></label>
          <label class="rm-mm rm-mm-l"><span>Esquerda</span><div class="rm-mm-in"><input type="number" id="rmML" min="5" max="50" step="1" value="${margens.l}"><em>mm</em></div></label>
          <label class="rm-mm rm-mm-r"><span>Direita</span><div class="rm-mm-in"><input type="number" id="rmMR" min="5" max="50" step="1" value="${margens.r}"><em>mm</em></div></label>
        </div>
        <button type="button" class="rm-ic-bt rm-ic-elo ${this.margemElo ? 'on' : ''}" id="rmMElo" aria-pressed="${this.margemElo}" title="Margens iguais: alterar uma muda as quatro">
          ${svgIcone('elo', 16)}
        </button>
      </div>
      <span class="rm-dica">Dentro das margens a folha tem 12 colunas: cada bloco escolhe onde começa e quantas ocupa.</span>
      <button type="button" class="glx-btn" id="rmSalvarTemplate" style="margin-top:8px;width:100%;">Salvar como Template…</button>
    `;

    popArquivo.querySelector('#rmSalvarTemplate').addEventListener('click', () => {
      popArquivo.querySelector('[data-fechar-popover]')?.click();
      abrirSalvarTemplateModal(this.doc);
    });

    popArquivo.querySelector('#rmNome').addEventListener('input', e => {
      this.doc.titulo = e.target.value;
      const tInput = this.container.querySelector('#athInputTituloDoc');
      if (tInput) tInput.value = e.target.value;
      this.notificarMudanca();
    });

    popArquivo.querySelector('#rmDescricao').addEventListener('input', e => {
      this.doc.subtitulo = e.target.value;
      this.notificarMudanca();
    });

    popArquivo.querySelector('#rmEscopo').addEventListener('change', e => {
      this.doc.tipoDoc = e.target.value;
      this.notificarMudanca();
    });

    popArquivo.querySelector('#rmOrientacao').addEventListener('change', e => {
      mestra.orientacao = e.target.value;
      this.pintarDiagramaMargens();
      this.renderizarFolhasPaginas();
      this.notificarMudanca();
    });

    const ligarMargem = (id, chave) => {
      popArquivo.querySelector(id).addEventListener('input', e => {
        const val = parseInt(e.target.value, 10) || 10;
        if (this.margemElo) {
          mestra.margens_mm.t = val;
          mestra.margens_mm.r = val;
          mestra.margens_mm.b = val;
          mestra.margens_mm.l = val;
          for (const campoId of ['#rmMT', '#rmMB', '#rmML', '#rmMR']) {
            const el = popArquivo.querySelector(campoId);
            if (el) el.value = val;
          }
        } else {
          mestra.margens_mm[chave] = val;
        }
        this.pintarDiagramaMargens();
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      });
    };

    ligarMargem('#rmMT', 't');
    ligarMargem('#rmMB', 'b');
    ligarMargem('#rmML', 'l');
    ligarMargem('#rmMR', 'r');

    popArquivo.querySelector('#rmMElo').addEventListener('click', () => {
      this.margemElo = !this.margemElo;
      const eloBtn = popArquivo.querySelector('#rmMElo');
      eloBtn.setAttribute('aria-pressed', String(this.margemElo));
      eloBtn.classList.toggle('on', this.margemElo);
      if (this.margemElo) {
        const tVal = mestra.margens_mm.t;
        mestra.margens_mm.r = tVal;
        mestra.margens_mm.b = tVal;
        mestra.margens_mm.l = tVal;
        popArquivo.querySelector('#rmMR').value = tVal;
        popArquivo.querySelector('#rmMB').value = tVal;
        popArquivo.querySelector('#rmML').value = tVal;
        this.pintarDiagramaMargens();
        this.renderizarFolhasPaginas();
        this.notificarMudanca();
      }
    });

    // 3. Popover Estilos de Texto
    const estiloAtivo = estilos.find(e => e.id === this.estiloSelecionadoId) || estilos[0];
    const fonteRotulo = id => (FONTES_SISTEMA[id]?.rotulo || id || '').replace(/ \(.*\)$/, '');

    popEstilos.innerHTML = `
      <div class="rm-popover-topo-head">
        <strong>Estilos de Texto <span class="rm-contagem">(${estilos.length})</span></strong>
        <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
      </div>
      <div style="display:flex; gap:6px; margin-top:6px; margin-bottom:8px;">
        <button type="button" class="glx-btn glx-btn-primary glx-btn-xs" id="rmBtnCentralEstilosTopo" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; height:28px; font-weight:750;">
          ${svgIcone('paleta', 13)} Central de Estilos & IA
        </button>
      </div>
      <ul class="rm-lista-estilos" id="rmListaEstilosTopo" style="max-height:220px; overflow-y:auto; margin-top:4px; margin-bottom:4px; padding:2px;"></ul>
      <div class="rm-estilo-previa" id="rmEstiloPreviaTopo" style="margin-top:6px; margin-bottom:6px;">Aa — Texto de exemplo do estilo</div>
      <button type="button" class="glx-btn glx-btn-soft glx-btn-sm" id="rmBtnNovoEstiloTopo" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
        ${svgIcone('mais', 12)} Novo Estilo
      </button>
    `;

    popEstilos.querySelector('#rmBtnCentralEstilosTopo')?.addEventListener('click', () => {
      fecharTodos();
      this.abrirModalCentralEstilos();
    });

    const previaTopo = popEstilos.querySelector('#rmEstiloPreviaTopo');
    const atualizarPreviaTopo = (est) => {
      if (!est || !previaTopo) return;
      previaTopo.style.cssText = `${estiloParaCss(est)} margin-top:6px; margin-bottom:6px; max-height:70px; overflow:hidden; text-align:${alinhamentoCss(est.alinhamento, 'left')}; text-align-last:auto;`;
    };
    if (estiloAtivo) atualizarPreviaTopo(estiloAtivo);

    const listaEstilosTopo = popEstilos.querySelector('#rmListaEstilosTopo');
    estilos.forEach(est => {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.style.margin = '0 0 4px 0';
      const ehSel = (est.id === this.estiloSelecionadoId);
      li.innerHTML = `
        <div class="rm-estilo-item ${ehSel ? 'on' : ''}" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; cursor:pointer; padding:6px 10px; border-radius:10px; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span class="rm-estilo-amostra" style="color:${est.cor || '#1F2733'}; font-weight:${est.peso || 400}; flex:none;">Aa</span>
            <span class="rm-estilo-nome" style="flex:1; min-width:0;">
              <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${est.nome}</strong>
              <small style="color:var(--glx-muted, #6B7585);">${fonteRotulo(est.fonte)} · ${est.tamanho_pt || 12} pt · ${est.peso || 400}</small>
            </span>
            ${est.personalizado ? '<em class="rm-estilo-tag" style="flex:none;">seu</em>' : ''}
          </div>
          <button type="button" class="rm-ic" data-acao="editar-estilo" title="Editar estilo (${est.nome})" style="width:auto; height:26px; padding:0 10px; gap:5px; display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; font:700 11px var(--glx-font); flex:none; border-radius:8px; border:1px solid #CBD5E1; background:#fff; color:#314F79;">
            ${svgIcone('lapis', 13)} Editar
          </button>
          ${est.id === 'corpo' ? '' : `<button type="button" class="rm-ic" data-acao="excluir-estilo" title="Excluir estilo (${est.nome})" style="width:26px; height:26px; flex:none; border-radius:6px; color:#DC2626;">${svgIcone('lixeira', 13)}</button>`}
        </div>
      `;

      const itemCard = li.querySelector('.rm-estilo-item');
      const btnEditar = li.querySelector('[data-acao="editar-estilo"]');
      li.querySelector('[data-acao="excluir-estilo"]')?.addEventListener('click', (e) => { e.stopPropagation(); this.excluirEstiloComConfirmacao(est);  });

      const selecionarEAplicar = () => {
        this.estiloSelecionadoId = est.id;
        popEstilos.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPreviaTopo(est);
        if (this.blocoSelecionado) {
          this.blocoSelecionado.estiloId = est.id;
          this.notificarMudanca();
          this.renderizar();
          this.onSelecionarBloco(this.blocoSelecionado, null);
        }
        fecharTodos();
        this.onEditarEstilo(est);
      };

      itemCard.addEventListener('click', (e) => {
        if (e.target.closest('[data-acao]')) return;
        selecionarEAplicar();
      });

      btnEditar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.estiloSelecionadoId = est.id;
        popEstilos.querySelectorAll('.rm-estilo-item').forEach(b => b.classList.remove('on'));
        itemCard.classList.add('on');
        atualizarPreviaTopo(est);
        fecharTodos();
        this.onEditarEstilo(est);
      });

      listaEstilosTopo.appendChild(li);
    });

    popEstilos.querySelector('#rmBtnNovoEstiloTopo').addEventListener('click', () => {
      const novo = {
        id: 'est_' + Date.now().toString(36),
        nome: 'Novo Estilo',
        fonte: 'nunito',
        tamanho_pt: 12,
        peso: 400,
        alinhamento: 'esquerda',
        entrelinha: 1.5,
        espaco_depois_pt: 8,
        espaco_paragrafos_pt: 6,
        cor: '#1F2733',
        personalizado: true
      };
      this.doc.estilos.push(novo);
      this.estiloSelecionadoId = novo.id;
      this.notificarMudanca();
      fecharTodos();
      this.renderizar();
      this.onEditarEstilo(novo);
    });

    // 4. Popover Nuvem (Supabase), Google Drive & Revisões Colaborativas
    if (popNuvem) {
      const sugestoesPendentes = garantirEstruturaSugestoes(this.doc);
      const driveCfg = obterConfigGoogleDrive();
      const perfilColab = this.perfilColaborador;

      popNuvem.innerHTML = `
        <div class="rm-popover-topo-head">
          <strong>Nuvem, Drive & Revisão</strong>
          <button type="button" class="rm-ic" data-fechar-popover title="Fechar">${svgIcone('fechar', 13)}</button>
        </div>

        <!-- Identificação do Colaborador com Login Google / Gmail -->
        <div style="padding:8px 10px; border-radius:10px; background:#F8FAFC; border:1px solid #E2E8F0; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font:800 10.5px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase;">Identificação / Conta Google</span>
            ${perfilColab.autenticadoGoogle ? '<span style="font-size:9.5px; color:#15803D; font-weight:800; background:#DCFCE7; padding:1px 6px; border-radius:999px;">Conectado</span>' : ''}
          </div>

          ${perfilColab.autenticadoGoogle ? `
            <div class="ath-google-user-badge">
              <img src="${perfilColab.foto || 'https://lh3.googleusercontent.com/avatar_exemplo.png'}" class="ath-google-user-avatar" alt="Avatar">
              <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <span style="font-size:11.5px; font-weight:700; color:#1F2733; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${perfilColab.nome}</span>
                <span style="font-size:10px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${perfilColab.email}</span>
              </div>
              <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnDesconectarGoogle" style="font-size:10px; height:22px; padding:0 6px;" title="Sair da conta Google">Sair</button>
            </div>
          ` : `
            <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnLoginGmail" style="height:32px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;">
              ${svgIcone('google', 14)} Entrar com o Google / Gmail
            </button>
          `}

          <div style="display:grid; grid-template-columns:1fr 115px; gap:6px; align-items:end; margin-top:2px;">
            <label style="font-size:11px;">Nome no cursor/sugestões
              <input type="text" id="athColabNome" value="${perfilColab.nome || 'Autor'}" style="height:28px; font-size:11.5px; padding:3px 8px;">
            </label>
            <label style="font-size:11px;">Papel
              <select id="athColabPapel" class="glx-select" style="height:28px; font-size:11.5px; padding:0 6px;">
                <option value="autor" ${perfilColab.papel === 'autor' ? 'selected' : ''}>Autor</option>
                <option value="orientador" ${perfilColab.papel === 'orientador' ? 'selected' : ''}>Prof. Orientador</option>
                <option value="revisor" ${perfilColab.papel === 'revisor' ? 'selected' : ''}>Coautor / Revisor</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Passo 1 & 3: Supabase Cloud + Realtime -->
        <div style="padding:8px 10px; border-radius:10px; background:#EEF4FA; border:1px solid var(--ath-primary-line, #C8D7E6); display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="font:800 11px var(--glx-font); color:var(--ath-primary, #314F79); text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
              ${svgIcone('nuvem_ok', 14)} Nuvem Supabase (Athenes)
            </strong>
            <span id="athBadgeStatusSupabase" style="font:700 10px var(--glx-font); color:#15803D; background:#DCFCE7; padding:2px 7px; border-radius:999px;">Ativo · Realtime</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-primary" id="athBtnSalvarSupabase" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700;">
              ${svgIcone('salvar', 13)} Salvar na Nuvem
            </button>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAbrirSupabase" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700; background:#fff;">
              ${svgIcone('documento', 13)} Abrir da Nuvem
            </button>
          </div>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnCopiarLinkColab" title="Escolha quem pode ler, comentar ou editar este documento e copie o link" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700; background:#fff;">
            ${svgIcone('usuarios', 13)} Compartilhar…
          </button>
          <div id="athListaArquivosSupabase" hidden style="max-height:130px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; margin-top:4px;"></div>
        </div>

        <!-- Passo 4: Google Drive Pessoal (escopo seguro drive.file) -->
        <div style="padding:8px 10px; border-radius:10px; background:#FFFFFF; border:1px solid #CBD5E1; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="font:800 11px var(--glx-font); color:#1F2733; text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
              ${svgIcone('drive', 14)} Google Drive (drive.file)
            </strong>
            <span style="font-size:10px; color:#64748B;">Privacidade segura</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnSalvarDrive" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700;">
              ${svgIcone('salvar', 13)} Salvar no Drive
            </button>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnAbrirDrive" style="height:30px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700;">
              ${svgIcone('drive', 13)} Abrir do Drive
            </button>
          </div>
          <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnSincronizarHubDrive" style="height:28px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:700; background:#fff;" title="Garante a estrutura sincronizada da pasta Athenes no Drive (Documentos, Zotero e Relatórios)">
            ${svgIcone('pasta', 13)} Sincronizar Pasta Hub (Athenes)
          </button>
          <div id="athListaArquivosDrive" hidden style="max-height:120px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>
        </div>

        <!-- Passo 2: Lista de Sugestões de Revisão (Aceitar ✓ / Rejeitar ✗) -->
        <div style="display:flex; flex-direction:column; gap:6px; border-top:1px solid #E2E8F0; padding-top:8px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="font:800 11px var(--glx-font); color:#065F46; text-transform:uppercase;">
              Sugestões de Revisão (${sugestoesPendentes.length})
            </strong>
            <button type="button" class="glx-btn glx-btn-xs glx-btn-soft" id="athBtnNovaSugestaoDemo" style="font-size:10.5px; height:22px; padding:0 8px;" title="Registrar sugestão no bloco selecionado">
              + Sugerir no bloco
            </button>
          </div>
          <div id="athListaSugestoesPopover" style="max-height:170px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
            ${sugestoesPendentes.length === 0
              ? `<span style="font-size:11.5px; color:#64748B;">Nenhuma sugestão pendente. Ative o modo <b>Sugestão</b> no topo para revisar com marcações verdes/vermelhas.</span>`
              : sugestoesPendentes.map(s => `
                <div class="ath-balao-sugestao" data-sug-card="${s.id}">
                  <div class="ath-balao-sugestao-topo">
                    <span class="ath-balao-sugestao-autor">Sugestão de ${s.autor}</span>
                    <div class="ath-balao-sugestao-acoes">
                      <button type="button" class="ath-btn-sug-aceitar" data-aceitar-sug="${s.id}" title="Aceitar sugestão (✓)">✓ Aceitar</button>
                      <button type="button" class="ath-btn-sug-rejeitar" data-rejeitar-sug="${s.id}" title="Rejeitar sugestão (✗)">✗</button>
                    </div>
                  </div>
                  <div style="font-size:11.5px; color:#1F2733; line-height:1.35;">
                    ${s.textoOriginal ? `<del class="ath-sug-del">${s.textoOriginal}</del> ` : ''}
                    ${s.textoNovo ? `<ins class="ath-sug-ins">${s.textoNovo}</ins>` : ''}
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      `;

      popNuvem.querySelector('#athColabNome')?.addEventListener('change', e => {
        this.perfilColaborador.nome = e.target.value.trim() || 'Autor';
        salvarPerfilColaborador(this.perfilColaborador);
        this.sessaoRealtime?.atualizarPresencaLocal();
        this.atualizarAvataresPresenca();
      });

      popNuvem.querySelector('#athColabPapel')?.addEventListener('change', e => {
        this.perfilColaborador.papel = e.target.value;
        if (e.target.value === 'orientador' && this.perfilColaborador.nome === 'Autor Principal') {
          this.perfilColaborador.nome = 'Prof. Orientador';
          popNuvem.querySelector('#athColabNome').value = 'Prof. Orientador';
        }
        salvarPerfilColaborador(this.perfilColaborador);
        this.sessaoRealtime?.atualizarPresencaLocal();
        this.atualizarAvataresPresenca();
      });

      popNuvem.querySelector('#athBtnSalvarSupabase')?.addEventListener('click', async () => {
        const badge = popNuvem.querySelector('#athBadgeStatusSupabase');
        try {
          if (badge) { badge.textContent = 'Salvando...'; badge.style.background = '#FEF3C7'; badge.style.color = '#92400E'; }
          await salvarDocumentoNoSupabase(this.doc, this.perfilColaborador);
          this.sessaoRealtime?.transmitirDocumento(this.doc);
          if (badge) { badge.textContent = 'Salvo na Nuvem ✓'; badge.style.background = '#DCFCE7'; badge.style.color = '#15803D'; }
        } catch (err) {
          if (badge) { badge.textContent = 'Erro ao salvar'; badge.style.background = '#FEE2E2'; badge.style.color = '#991B1B'; }
          alert(err.message);
        }
      });

      popNuvem.querySelector('#athBtnCopiarLinkColab')?.addEventListener('click', () => {
        if (this.doc.compartilhadoComigo && this.doc.permissao !== 'edicao') { alert('Só o dono do documento (ou quem tem permissão de edição) abre o compartilhamento.'); }
        new ModalCompartilhar(this.doc, this.perfilColaborador, { aoSalvar: () => this.sessaoRealtime?.transmitirDocumento(this.doc) });
      });

      popNuvem.querySelector('#athBtnAbrirSupabase')?.addEventListener('click', async () => {
        const boxLista = popNuvem.querySelector('#athListaArquivosSupabase');
        if (!boxLista) return;
        boxLista.hidden = false;
        boxLista.innerHTML = '<span style="font-size:11px; color:#64748B;">Buscando documentos no Supabase...</span>';
        try {
          const docs = await listarDocumentosDoSupabase();
          if (!docs.length) {
            boxLista.innerHTML = '<span style="font-size:11px; color:#64748B;">Nenhum documento salvo na nuvem ainda.</span>';
            return;
          }
          boxLista.innerHTML = docs.map(d => `
            <button type="button" class="ath-ctx-menu-item" data-abrir-supa-id="${d.id}" style="background:#fff; border:1px solid #CBD5E1;">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.titulo}</span>
              <small style="color:#64748B; flex:none;">${d.atualizado_por || ''}</small>
            </button>
          `).join('');
          boxLista.querySelectorAll('[data-abrir-supa-id]').forEach(bt => {
            bt.addEventListener('click', async () => {
              const docCarregado = await carregarDocumentoDoSupabase(bt.dataset.abrirSupaId);
              if (docCarregado) {
                this.setDocumento(docCarregado);
                this.iniciarSessaoColaborativa();
                this.onAlterado(this.doc);
                fecharTodos();
              }
            });
          });
        } catch (err) {
          boxLista.innerHTML = `<span style="font-size:11px; color:#B42318;">${err.message}</span>`;
        }
      });

      // Eventos Google Drive
      // Eventos de Autenticação Google e Pasta Hub
      popNuvem.querySelector('#athBtnLoginGmail')?.addEventListener('click', async () => {
        try {
          const cfg = obterConfigGoogleDrive();
          const token = await autenticarGoogleDrive(cfg.clientId);
          if (token) {
            const info = await obterInfoUsuarioGoogle(token).catch(() => null);
            if (info) {
              this.perfilColaborador.nome = info.name || this.perfilColaborador.nome;
              this.perfilColaborador.email = info.email;
              this.perfilColaborador.foto = info.picture;
              this.perfilColaborador.autenticadoGoogle = true;
              salvarPerfilColaborador(this.perfilColaborador);
            }
            // Cria ou localiza a pasta raiz 'Athenes' e subpastas no Drive
            await obterOuCriarEstruturaPastasAthenes(token);
            this.renderizar();
          }
        } catch (err) {
          alert('Erro na autenticação Google: ' + err.message);
        }
      });

      popNuvem.querySelector('#athBtnDesconectarGoogle')?.addEventListener('click', () => {
        fecharTodos();
        encerrarSessao();
        this.onLogout();
      });

      popNuvem.querySelector('#athBtnSincronizarHubDrive')?.addEventListener('click', async () => {
        try {
          const cfg = obterConfigGoogleDrive();
          const token = await obterTokenOuConectar(cfg);
          const est = await obterOuCriarEstruturaPastasAthenes(token);
          alert('Pasta Hub Athenes pronta no Google Drive!\n- Documentos: ' + est.pastaDocumentosId + '\n- Zotero: ' + est.pastaZoteroId + '\n- Relatórios: ' + est.pastaRelatoriosId);
        } catch (err) {
          alert('Erro ao sincronizar pasta Hub: ' + err.message);
        }
      });

      popNuvem.querySelector('#athBtnSalvarDrive')?.addEventListener('click', async () => {
        const cfg = obterConfigGoogleDrive();
        const nomeArq = `${(this.doc.titulo || 'Documento_Athenes').replace(/[^\w\d_-]+/g, '_')}.athenes`;
        if (!cfg.clientId && !cfg.accessToken) {
          // Quando ainda não há Client ID OAuth configurado, permite salvar direto na pasta sincronizada do Google Drive Desktop (.athenes) ou informar Client ID
          const blob = new Blob([JSON.stringify(this.doc, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nomeArq;
          a.click();
          URL.revokeObjectURL(a.href);
          return;
        }
        try {
          const token = await obterTokenOuConectar(cfg);
          const salvo = await salvarArquivoNoGoogleDrive({
            nomeArquivo: nomeArq,
            conteudoBlobOuTexto: this.doc,
            accessToken: token,
            driveFileId: this.doc.driveFileId || null
          });
          if (salvo?.id) this.doc.driveFileId = salvo.id;
          alert(`Documento salvo com sucesso no Google Drive (${salvo.name || nomeArq})!`);
        } catch (err) {
          alert(err.message);
        }
      });

      popNuvem.querySelector('#athBtnAbrirDrive')?.addEventListener('click', async () => {
        const cfg = obterConfigGoogleDrive();
        if (!cfg.clientId && !cfg.accessToken) {
          // Seletor rápido de arquivo .athenes/.json (compatível com pasta do Google Drive no computador)
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = '.athenes,.json,application/json';
          inp.onchange = async () => {
            const f = inp.files?.[0];
            if (!f) return;
            const txt = await f.text();
            const parsed = JSON.parse(txt);
            if (parsed && parsed.secoes) {
              this.setDocumento(parsed);
              this.onAlterado(this.doc);
              fecharTodos();
            }
          };
          inp.click();
          return;
        }
        const boxDrive = popNuvem.querySelector('#athListaArquivosDrive');
        if (!boxDrive) return;
        boxDrive.hidden = false;
        boxDrive.innerHTML = '<span style="font-size:11px; color:#64748B;">Consultando Google Drive...</span>';
        try {
          const token = await obterTokenOuConectar(cfg);
          const arqs = await listarArquivosDoGoogleDrive(token);
          if (!arqs.length) {
            boxDrive.innerHTML = '<span style="font-size:11px; color:#64748B;">Nenhum arquivo .athenes encontrado no seu Drive.</span>';
            return;
          }
          boxDrive.innerHTML = arqs.map(f => `
            <button type="button" class="ath-ctx-menu-item" data-drive-file="${f.id}">
              <span>${f.name}</span>
            </button>
          `).join('');
          boxDrive.querySelectorAll('[data-drive-file]').forEach(bt => {
            bt.addEventListener('click', async () => {
              const docDrive = await baixarArquivoDoGoogleDrive(bt.dataset.driveFile, token);
              if (docDrive && docDrive.secoes) {
                this.setDocumento(docDrive);
                this.onAlterado(this.doc);
                fecharTodos();
              }
            });
          });
        } catch (err) {
          boxDrive.innerHTML = `<span style="font-size:11px; color:#B42318;">${err.message}</span>`;
        }
      });

      // Eventos de Aceitar / Rejeitar Sugestões
      popNuvem.querySelectorAll('[data-aceitar-sug]').forEach(bt => {
        bt.addEventListener('click', () => {
          aceitarSugestaoNoDocumento(this.doc, bt.dataset.aceitarSug);
          this.notificarMudanca();
          this.renderizar();
        });
      });

      popNuvem.querySelectorAll('[data-rejeitar-sug]').forEach(bt => {
        bt.addEventListener('click', () => {
          rejeitarSugestaoNoDocumento(this.doc, bt.dataset.rejeitarSug);
          this.notificarMudanca();
          this.renderizar();
        });
      });

      popNuvem.querySelector('#athBtnNovaSugestaoDemo')?.addEventListener('click', () => {
        this.criarSugestaoInterativaNoBloco();
      });
    }

    // Fechar ao clicar nos botões 'X'
    root.querySelectorAll('[data-fechar-popover]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        fecharTodos();
      });
    });

    // Fechar ao clicar fora dos itens de menu topo
    if (!this._menusTopoRegistrados) {
      this._menusTopoRegistrados = true;
      document.addEventListener('click', (ev) => {
        if (!ev.target.closest('.rm-menu-topo-item')) {
          fecharTodos();
        }
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') fecharTodos();
      });
    }

    if (this.menuTopoAberto && popovers[this.menuTopoAberto]) {
      popovers[this.menuTopoAberto].hidden = false;
      botoes[this.menuTopoAberto]?.setAttribute('aria-expanded', 'true');
      botoes[this.menuTopoAberto]?.classList.add('ativo');
    }
  }
};
