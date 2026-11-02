// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modal Central de Estilos & Identidade Visual
 * Gerencia a exportação, importação e geração por IA de temas completos:
 * - Estilos tipográficos (Títulos, Subtítulos, Corpo, Citações)
 * - Páginas Mestras (Margens mm, Cabeçalhos, Rodapés, Grade)
 * - Molduras de Figuras, Tabelas, Quadros e Fórmulas
 * - Prompt mestre com 1 clique para extração via IA (ChatGPT / Claude / Gemini)
 */

import { importarArquivoDeFonte, excluirFonteImportada } from './athenes_fontes_ui.js';
import { listarFontesImportadas, nomeSugerido } from '../core/athenes_fontes.js';
import { FONTES_SISTEMA as FONTES } from '../core/athenes_estilos.js';
import { comprimirImagensDoPacote } from './athenes_imagem_util.js';
import { svgIcone } from './athenes_icones.js';
import {
  exportarPacoteEstilo,
  validarPacoteEstilo,
  aplicarPacoteEstilo,
  obterPromptIaParaExtracaoDeLayout
} from '../core/athenes_pacote_estilo.js';

export class ModalCentralEstilos {
  constructor(documento, editorView, opcoes = {}) {
    this.doc = documento;
    this.editor = editorView;
    this.onSucesso = opcoes.onSucesso || (() => {});
    this.onFechar = opcoes.onFechar || (() => {});

    this.abaAtiva = opcoes.abaInicial || 'exportar'; // 'exportar' | 'importar' | 'ia'
    this.jsonImportarTexto = '';
    this.pacoteValidado = null;
    this.backdrop = null;

    this.montar();
  }

  montar() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ath-modal-backdrop';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'ath-modal';
    modal.style.maxWidth = '880px';
    modal.style.width = '95%';
    modal.style.height = '85vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 24px 48px -12px rgba(15, 23, 42, 0.25)';
    modal.style.overflow = 'hidden';

    modal.innerHTML = `
      <!-- Cabeçalho do Modal -->
      <div class="ath-modal-head" style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid #E2E8F0; background:#FFFFFF; flex:none;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:38px; height:38px; border-radius:10px; background:var(--ath-primary-soft, #EEF4FA); color:var(--ath-primary, #314F79); display:grid; place-items:center;">
            ${svgIcone('paleta', 20)}
          </div>
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:#1E293B;">Central de Estilos & Identidade Visual</h3>
            <span style="font-size:12px; color:#64748B;">Importe, exporte e replique o estilo visual completo (tipografia, mestras e molduras)</span>
          </div>
        </div>
        <button type="button" class="rm-ic" id="athModalEstilosFechar" title="Fechar Janela" style="width:32px; height:32px; border-radius:8px;">
          ${svgIcone('fechar', 14)}
        </button>
      </div>

      <!-- Abas de Navegação -->
      <div style="display:flex; gap:8px; padding:8px 24px 0; background:#F8FAFC; border-bottom:1px solid #E2E8F0; flex:none;">
        <button type="button" class="ath-tab-btn ${this.abaAtiva === 'exportar' ? 'ativo' : ''}" data-aba="exportar" style="display:flex; align-items:center; gap:6px; padding:10px 16px; border:none; background:transparent; font-size:12.5px; font-weight:750; color:${this.abaAtiva === 'exportar' ? '#314F79' : '#64748B'}; border-bottom:2px solid ${this.abaAtiva === 'exportar' ? '#314F79' : 'transparent'}; cursor:pointer;">
          ${svgIcone('exportar', 14)} Exportar Estilo Atual
        </button>
        <button type="button" class="ath-tab-btn ${this.abaAtiva === 'importar' ? 'ativo' : ''}" data-aba="importar" style="display:flex; align-items:center; gap:6px; padding:10px 16px; border:none; background:transparent; font-size:12.5px; font-weight:750; color:${this.abaAtiva === 'importar' ? '#314F79' : '#64748B'}; border-bottom:2px solid ${this.abaAtiva === 'importar' ? '#314F79' : 'transparent'}; cursor:pointer;">
          ${svgIcone('pasta', 14)} Importar Pacote (.json)
        </button>
        <button type="button" class="ath-tab-btn ${this.abaAtiva === 'ia' ? 'ativo' : ''}" data-aba="ia" style="display:flex; align-items:center; gap:6px; padding:10px 16px; border:none; background:transparent; font-size:12.5px; font-weight:750; color:${this.abaAtiva === 'ia' ? '#314F79' : '#64748B'}; border-bottom:2px solid ${this.abaAtiva === 'ia' ? '#314F79' : 'transparent'}; cursor:pointer;">
          ${svgIcone('lapis', 14)} <span>Extrair de Doc com IA</span> <span style="background:#E0E7FF; color:#4338CA; font-size:10px; font-weight:800; padding:1px 6px; border-radius:999px;">Prompt Pronto</span>
        </button>
        <button type="button" class="ath-tab-btn ${this.abaAtiva === 'fontes' ? 'ativo' : ''}" data-aba="fontes" style="display:flex; align-items:center; gap:6px; padding:10px 16px; border:none; background:transparent; font-size:12.5px; font-weight:750; color:${this.abaAtiva === 'fontes' ? '#314F79' : '#64748B'}; border-bottom:2px solid ${this.abaAtiva === 'fontes' ? '#314F79' : 'transparent'}; cursor:pointer;">
          ${svgIcone('titulo', 14)} Fontes
        </button>
      </div>

      <!-- Conteúdo da Aba -->
      <div id="athModalEstilosCorpo" style="flex:1; min-height:0; overflow-y:auto; padding:20px 24px; background:#F8FAFC;">
        <!-- Renderizado dinamicamente -->
      </div>
    `;

    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    const fechar = () => {
      this.backdrop.remove();
      this.onFechar();
    };

    modal.querySelector('#athModalEstilosFechar').addEventListener('click', fechar);
    this.backdrop.addEventListener('click', e => {
      if (e.target === this.backdrop) fechar();
    });

    modal.querySelectorAll('[data-aba]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.abaAtiva = btn.dataset.aba;
        modal.querySelectorAll('[data-aba]').forEach(b => {
          const ativo = b.dataset.aba === this.abaAtiva;
          b.style.color = ativo ? '#314F79' : '#64748B';
          b.style.borderBottomColor = ativo ? '#314F79' : 'transparent';
        });
        this.renderizarConteudoAba();
      });
    });

    this.renderizarConteudoAba();
  }

  renderizarConteudoAba() {
    const corpo = this.backdrop.querySelector('#athModalEstilosCorpo');
    if (!corpo) return;

    if (this.abaAtiva === 'exportar') {
      this.renderizarAbaExportar(corpo);
    } else if (this.abaAtiva === 'importar') {
      this.renderizarAbaImportar(corpo);
    } else if (this.abaAtiva === 'fontes') {
      this.renderizarAbaFontes(corpo);
    } else {
      this.renderizarAbaIa(corpo);
    }
  }

  /* ==========================================================================
     ABA 1: EXPORTAR ESTILO ATUAL
     ========================================================================== */
  renderizarAbaExportar(corpo) {
    const pacote = exportarPacoteEstilo(this.doc);
    const qtdEstilos = pacote.estilos.length;
    const qtdMestras = pacote.mestras.length;
    const jsonString = JSON.stringify(pacote, null, 2);

    corpo.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Card Informativo -->
        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:800; color:#1E293B;">
            Pacote de Estilo Editorial deste Relatório
          </h4>
          <p style="margin:0 0 12px 0; font-size:12px; color:#64748B; line-height:1.5;">
            Este arquivo contém o conjunto integral de design deste documento: todas as fontes, tamanhos pt, cores, recuos, margens, mestras (Capa, Corpo, IEEE), e o tipo de moldura e linhas de figuras. Você pode importá-lo em qualquer outro artigo ou relatório para manter identidade visual idêntica.
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:14px;">
            <div style="background:#F1F5F9; border-radius:8px; padding:10px 12px;">
              <span style="font-size:11px; color:#64748B; text-transform:uppercase; font-weight:800;">Estilos de Texto</span>
              <strong style="display:block; font-size:16px; color:#1E293B; margin-top:2px;">${qtdEstilos} estilos</strong>
            </div>
            <div style="background:#F1F5F9; border-radius:8px; padding:10px 12px;">
              <span style="font-size:11px; color:#64748B; text-transform:uppercase; font-weight:800;">Páginas Mestras</span>
              <strong style="display:block; font-size:16px; color:#1E293B; margin-top:2px;">${qtdMestras} mestras</strong>
            </div>
            <div style="background:#F1F5F9; border-radius:8px; padding:10px 12px;">
              <span style="font-size:11px; color:#64748B; text-transform:uppercase; font-weight:800;">Molduras de Figuras</span>
              <strong style="display:block; font-size:16px; color:#1E293B; margin-top:2px;">${pacote.layout_padrao_figuras?.figura?.moldura_tipo || 'Limpo'}</strong>
            </div>
            <div style="background:#F1F5F9; border-radius:8px; padding:10px 12px;">
              <span style="font-size:11px; color:#64748B; text-transform:uppercase; font-weight:800;">Perfil Base</span>
              <strong style="display:block; font-size:16px; color:#1E293B; margin-top:2px; text-transform:uppercase;">${pacote.configuracaoGlobal?.perfil || 'ABNT'}</strong>
            </div>
          </div>

          <!-- Campos de Metadados -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div>
              <label style="display:block; font-size:11.5px; font-weight:700; color:#475569; margin-bottom:4px;">Nome do Tema / Estilo</label>
              <input type="text" id="athExportNome" value="${escapeHtml(this.doc.titulo || 'Estilo Editorial')}" class="glx-input" style="height:34px; font-size:12px; width:100%; box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block; font-size:11.5px; font-weight:700; color:#475569; margin-bottom:4px;">Autor / Instituição</label>
              <input type="text" id="athExportAutor" value="${escapeHtml(this.doc.metadados?.autores?.[0]?.nome || 'Athenes')}" class="glx-input" style="height:34px; font-size:12px; width:100%; box-sizing:border-box;">
            </div>
          </div>

          <!-- Botões de Ação -->
          <div style="display:flex; gap:10px; align-items:center;">
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnBaixarTemaJson" style="height:36px; padding:0 16px; font-size:12.5px; font-weight:750; display:inline-flex; align-items:center; gap:6px;">
              ${svgIcone('exportar', 14)} Baixar Arquivo .athenes-tema.json
            </button>
            <button type="button" class="glx-btn glx-btn-soft" id="athBtnCopiarTemaJson" style="height:36px; padding:0 16px; font-size:12.5px; font-weight:750; display:inline-flex; align-items:center; gap:6px;">
              ${svgIcone('copiar', 14)} <span id="athLblCopiarJson">Copiar JSON</span>
            </button>
          </div>
        </div>

        <!-- Prévia do JSON (Recolhível) -->
        <details style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:12px 16px;">
          <summary style="font-size:12.5px; font-weight:750; color:#314F79; cursor:pointer;">
            Visualizar código JSON gerado (${(jsonString.length / 1024).toFixed(1)} KB)
          </summary>
          <pre style="margin:10px 0 0 0; padding:12px; background:#0F172A; color:#E2E8F0; border-radius:8px; font-size:11px; max-height:220px; overflow-y:auto; font-family:Consolas, monospace;">${escapeHtml(jsonString)}</pre>
        </details>
      </div>
    `;

    const getPacoteAtualizado = () => {
      const nome = corpo.querySelector('#athExportNome')?.value?.trim();
      const autor = corpo.querySelector('#athExportAutor')?.value?.trim();
      return exportarPacoteEstilo(this.doc, { nome, autor });
    };

    // Baixar arquivo
    corpo.querySelector('#athBtnBaixarTemaJson')?.addEventListener('click', () => {
      const pkg = getPacoteAtualizado();
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const nomeSlug = (pkg.metadados.nome || 'tema').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.href = url;
      a.download = `${nomeSlug}.athenes-tema.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Copiar JSON
    corpo.querySelector('#athBtnCopiarTemaJson')?.addEventListener('click', async () => {
      const pkg = getPacoteAtualizado();
      try {
        await navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
        const lbl = corpo.querySelector('#athLblCopiarJson');
        if (lbl) {
          lbl.textContent = '✓ Copiado com Sucesso!';
          setTimeout(() => { lbl.textContent = 'Copiar JSON'; }, 2500);
        }
      } catch (err) {
        alert('Não foi possível copiar automaticamente para a área de transferência: ' + err.message);
      }
    });
  }

  /* ==========================================================================
     ABA 2: IMPORTAR PACOTE (.json)
     ========================================================================== */
  renderizarAbaImportar(corpo) {
    corpo.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:800; color:#1E293B;">
            Carregar Pacote de Estilo Externo
          </h4>
          <p style="margin:0 0 14px 0; font-size:12px; color:#64748B; line-height:1.5;">
            Selecione um arquivo <code>.athenes-tema.json</code> ou cole o código JSON gerado por outro documento Athenes ou pela IA para substituir os estilos e molduras deste relatório.
          </p>

          <!-- Zona de Drag and Drop de Arquivo -->
          <div id="athDropAreaTema" style="border:2px dashed #CBD5E1; border-radius:10px; padding:20px; text-align:center; background:#F8FAFC; cursor:pointer; margin-bottom:14px; transition:border-color 0.2s;">
            <div style="display:grid; place-items:center; margin-bottom:8px; color:#314F79;">
              ${svgIcone('pasta', 28)}
            </div>
            <strong style="display:block; font-size:13px; color:#1E293B; margin-bottom:2px;">Arraste um arquivo .json de estilo aqui</strong>
            <span style="font-size:11.5px; color:#64748B;">ou clique para selecionar do computador</span>
            <input type="file" id="athInputFileTema" accept=".json" style="display:none;">
          </div>

          <!-- Ou Colar JSON diretamente -->
          <div>
            <label style="display:block; font-size:11.5px; font-weight:700; color:#475569; margin-bottom:4px;">
              Ou Cole o JSON do Tema Diretamente:
            </label>
            <textarea id="athTxtImportarTemaJson" placeholder="Cole aqui o conteúdo JSON do tema..." style="width:100%; height:130px; font-family:Consolas, monospace; font-size:11.5px; padding:10px; border:1px solid #CBD5E1; border-radius:8px; box-sizing:border-box; resize:vertical; background:#FFFFFF;">${escapeHtml(this.jsonImportarTexto)}</textarea>
          </div>

          <!-- Mensagem de Validação / Prévia -->
          <div id="athMsgValidacaoTema" style="margin-top:10px; display:none;"></div>

          <!-- Botão de Aplicação -->
          <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#475569; cursor:pointer;">
              <input type="checkbox" id="athChkPropagarBlocos" checked>
              <span>Aplicar molduras padrão também nas figuras e tabelas já existentes</span>
            </label>
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnConfirmarImportar" style="height:38px; padding:0 20px; font-size:13px; font-weight:750; display:inline-flex; align-items:center; gap:6px;">
              ${svgIcone('check', 14)} Aplicar Estilo ao Relatório
            </button>
          </div>
        </div>
      </div>
    `;

    const dropArea = corpo.querySelector('#athDropAreaTema');
    const fileInput = corpo.querySelector('#athInputFileTema');
    const txtArea = corpo.querySelector('#athTxtImportarTemaJson');
    const msgArea = corpo.querySelector('#athMsgValidacaoTema');
    const btnConfirmar = corpo.querySelector('#athBtnConfirmarImportar');

    const validarEAtualizarPrevia = () => {
      const texto = txtArea.value.trim();
      this.jsonImportarTexto = texto;
      if (!texto) {
        msgArea.style.display = 'none';
        this.pacoteValidado = null;
        return;
      }

      const res = validarPacoteEstilo(texto);
      msgArea.style.display = 'block';
      if (!res.valido) {
        msgArea.innerHTML = `
          <div style="padding:10px 14px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px; color:#991B1B; font-size:12px;">
            <strong>Erro na validação do tema:</strong> ${escapeHtml(res.erro)}
          </div>
        `;
        this.pacoteValidado = null;
      } else {
        this.pacoteValidado = res.pacote;
        const p = res.pacote;
        msgArea.innerHTML = `
          <div style="padding:10px 14px; background:#ECFDF5; border:1px solid #6EE7B7; border-radius:8px; color:#065F46; font-size:12px;">
            <strong>✓ Tema Válido: "${escapeHtml(p.metadados.nome)}"</strong><br>
            <span style="font-size:11px; color:#047857;">Contém ${p.estilos.length} estilos tipográficos, ${p.mestras.length} páginas mestras e molduras de ilustrações prontas para aplicação.</span>
          </div>
        `;
      }
    };

    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        txtArea.value = evt.target.result;
        validarEAtualizarPrevia();
      };
      reader.readAsText(file);
    });

    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.style.borderColor = '#314F79';
      dropArea.style.background = '#EEF4FA';
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.style.borderColor = '#CBD5E1';
      dropArea.style.background = '#F8FAFC';
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.style.borderColor = '#CBD5E1';
      dropArea.style.background = '#F8FAFC';
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        txtArea.value = evt.target.result;
        validarEAtualizarPrevia();
      };
      reader.readAsText(file);
    });

    txtArea.addEventListener('input', validarEAtualizarPrevia);

    btnConfirmar.addEventListener('click', async () => {
      validarEAtualizarPrevia();
      if (!this.pacoteValidado) {
        alert('Por favor, carregue ou cole um JSON de tema válido antes de aplicar.');
        return;
      }

      const propagar = corpo.querySelector('#athChkPropagarBlocos')?.checked !== false;

      try {
        // banners e logos do tema entram reduzidos: a imagem original de um tema lotava o armazenamento local
        await comprimirImagensDoPacote(this.pacoteValidado);
        const resultado = aplicarPacoteEstilo(this.doc, this.pacoteValidado, { aplicarNosBlocosExistentes: propagar });
        this.editor?.notificarMudanca?.();
        this.editor?.renderizar?.();
        this.onSucesso(resultado);

        alert(`✓ Estilo "${resultado.temaNome}" aplicado com sucesso!\n${resultado.estilosQtd} estilos de texto e ${resultado.mestrasQtd} páginas mestras atualizados.`);
        this.backdrop.remove();
      } catch (err) {
        alert('Falha ao aplicar estilo: ' + err.message);
      }
    });
  }

  /* ==========================================================================
     ABA: FONTES (importar arquivos de fonte, ex.: Aptos)
     ========================================================================== */
  renderizarAbaFontes(corpo) {
    const importadas = listarFontesImportadas();
    const sistema = Object.values(FONTES).filter(f => !f.importada);
    corpo.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 4px; font-size:14px; font-weight:800; color:#1E293B;">Importar fonte</h4>
          <p style="margin:0 0 12px; font-size:12px; color:#64748B; line-height:1.5;">
            Escolha o arquivo da fonte (.ttf, .otf, .woff ou .woff2). Ela fica guardada neste navegador, aparece em todas as listas de fonte e vai embutida no PDF exportado.
            <br><strong>Aptos:</strong> a fonte padrão do Word atual. Quem tem o Microsoft 365 encontra o arquivo em
            <code style="background:#F1F5F9; padding:1px 5px; border-radius:5px;">%LOCALAPPDATA%\\Microsoft\\FontCache\\4\\CloudFonts\\Aptos</code>.
            O Athenes já traz "Aptos (Microsoft 365)" na lista e usa a instalada no seu computador; importe o arquivo para ela aparecer igual em qualquer máquina. Respeite a licença de cada fonte.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:end;">
            <label style="font:700 11.5px var(--glx-font); color:#475569; display:flex; flex-direction:column; gap:4px;">Arquivo da fonte
              <input type="file" id="athFonteArq" accept=".ttf,.otf,.woff,.woff2" style="font-size:12px;">
            </label>
            <label style="font:700 11.5px var(--glx-font); color:#475569; display:flex; flex-direction:column; gap:4px;">Nome da família
              <input type="text" id="athFonteNome" class="glx-input" placeholder="Ex.: Aptos" style="height:32px;">
            </label>
          </div>
          <div style="display:flex; align-items:center; gap:14px; margin-top:12px;">
            <label class="rm-chk" style="font-size:12px;"><input type="checkbox" id="athFonteSerif"> Fonte com serifa (reserva: Georgia)</label>
            <span style="flex:1"></span>
            <span id="athFonteMsg" style="font-size:12px; color:#64748B;"></span>
            <button type="button" class="glx-btn glx-btn-primary" id="athFonteImportar" disabled>Importar</button>
          </div>
        </div>
        <div style="background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 10px; font-size:14px; font-weight:800; color:#1E293B;">Fontes importadas (${importadas.length})</h4>
          ${importadas.length ? importadas.map(f => `
            <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #F1F5F9;">
              <span style="font-family:${FONTES[f.id]?.familia || 'inherit'}; font-size:16px; flex:1;">${escapeHtml(f.nome)} — Aa Bb Cc 123</span>
              <small style="color:#94A3B8;">.${f.formato}</small>
              <button type="button" class="glx-btn glx-btn-soft glx-btn-xs" data-excluir-fonte="${escapeHtml(f.id)}">Remover</button>
            </div>`).join('') : '<p style="margin:0; font-size:12px; color:#94A3B8;">Nenhuma fonte importada ainda.</p>'}
        </div>
        <div style="font-size:11.5px; color:#64748B;">Fontes do sistema disponíveis: ${sistema.map(f => escapeHtml(f.rotulo)).join(' · ')}</div>
      </div>`;
    const arq = corpo.querySelector('#athFonteArq'); const nome = corpo.querySelector('#athFonteNome');
    const msg = corpo.querySelector('#athFonteMsg'); const btn = corpo.querySelector('#athFonteImportar');
    arq.addEventListener('change', () => {
      const f = arq.files[0];
      if (f && !nome.value) nome.value = nomeSugerido(f.name);
      btn.disabled = !f; msg.textContent = '';
    });
    btn.addEventListener('click', async () => {
      btn.disabled = true; msg.style.color = '#64748B'; msg.textContent = 'Importando…';
      try {
        const entrada = await importarArquivoDeFonte(arq.files[0], { nome: nome.value, serif: corpo.querySelector('#athFonteSerif').checked });
        this.editor?.renderizar?.();
        this.renderizarAbaFontes(corpo);
        corpo.querySelector('#athFonteMsg').textContent = `"${entrada.rotulo}" pronta para usar nos estilos.`;
      } catch (e) { msg.style.color = '#B42318'; msg.textContent = e.message; btn.disabled = false; }
    });
    corpo.querySelectorAll('[data-excluir-fonte]').forEach(b => b.addEventListener('click', async () => {
      await excluirFonteImportada(b.dataset.excluirFonte);
      this.editor?.renderizar?.();
      this.renderizarAbaFontes(corpo);
    }));
  }

  /* ==========================================================================
     ABA 3: EXTRAIR DE DOCUMENTO COM IA (PROMPT PRONTO)
     ========================================================================== */
  renderizarAbaIa(corpo) {
    const promptTexto = obterPromptIaParaExtracaoDeLayout();

    corpo.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px;">
            <div>
              <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:800; color:#1E293B;">
                Prompt de Engenharia para Extração de Layout por IA
              </h4>
              <p style="margin:0; font-size:12px; color:#64748B; line-height:1.5;">
                Copie este prompt e cole no <strong>ChatGPT</strong>, <strong>Claude</strong> ou <strong>Google Gemini</strong> junto com o arquivo (PDF, imagem ou DOCX) cujo visual você deseja clonar para o Athenes.
              </p>
            </div>
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnCopiarPromptIaTopo" style="height:36px; padding:0 16px; font-size:12px; font-weight:750; display:inline-flex; align-items:center; gap:6px; flex-shrink:0;">
              ${svgIcone('copiar', 14)} <span id="athLblCopiarPromptTopo">Copiar Prompt</span>
            </button>
          </div>

          <!-- Passos recomendados -->
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:14px;">
            <div style="background:#EEF4FA; border-radius:8px; padding:10px 12px; border:1px solid #C8D7E6;">
              <span style="font-size:11px; font-weight:800; color:#314F79;">1. COPIE O PROMPT</span>
              <p style="margin:2px 0 0 0; font-size:11.5px; color:#334155;">Clique no botão "Copiar Prompt" para levar as regras exatas para o clipboard.</p>
            </div>
            <div style="background:#EEF4FA; border-radius:8px; padding:10px 12px; border:1px solid #C8D7E6;">
              <span style="font-size:11px; font-weight:800; color:#314F79;">2. ANEXE SEU PDF NA IA</span>
              <p style="margin:2px 0 0 0; font-size:11.5px; color:#334155;">Envie para o ChatGPT, Claude ou Gemini o seu arquivo modelo e o prompt.</p>
            </div>
            <div style="background:#EEF4FA; border-radius:8px; padding:10px 12px; border:1px solid #C8D7E6;">
              <span style="font-size:11px; font-weight:800; color:#314F79;">3. COLE NA ABA IMPORTAR</span>
              <p style="margin:2px 0 0 0; font-size:11.5px; color:#334155;">Copie o bloco JSON retornado pela IA e cole na aba <strong>Importar Pacote</strong>.</p>
            </div>
          </div>

          <!-- Caixa de Código do Prompt -->
          <div style="position:relative;">
            <textarea id="athTxtPromptIa" readonly style="width:100%; height:240px; font-family:Consolas, monospace; font-size:11.5px; padding:12px; border:1px solid #CBD5E1; border-radius:8px; box-sizing:border-box; background:#0F172A; color:#E2E8F0; resize:vertical; line-height:1.45;">${escapeHtml(promptTexto)}</textarea>
          </div>

          <!-- Rodapé com Botão Extra de Copiar -->
          <div style="margin-top:12px; display:flex; justify-content:flex-end;">
            <button type="button" class="glx-btn glx-btn-primary" id="athBtnCopiarPromptIaRodape" style="height:36px; padding:0 20px; font-size:12.5px; font-weight:750; display:inline-flex; align-items:center; gap:6px;">
              ${svgIcone('copiar', 14)} <span id="athLblCopiarPromptRodape">Copiar Prompt Completo para Área de Transferência</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const copiarAcao = async (btnTopo, btnRodape) => {
      try {
        await navigator.clipboard.writeText(promptTexto);
        const lblTopo = corpo.querySelector('#athLblCopiarPromptTopo');
        const lblRodape = corpo.querySelector('#athLblCopiarPromptRodape');
        if (lblTopo) lblTopo.textContent = '✓ Copiado!';
        if (lblRodape) lblRodape.textContent = '✓ Prompt Copiado com Sucesso!';
        setTimeout(() => {
          if (lblTopo) lblTopo.textContent = 'Copiar Prompt';
          if (lblRodape) lblRodape.textContent = 'Copiar Prompt Completo para Área de Transferência';
        }, 2500);
      } catch (err) {
        alert('Não foi possível copiar automaticamente para o clipboard: ' + err.message);
      }
    };

    corpo.querySelector('#athBtnCopiarPromptIaTopo')?.addEventListener('click', () => copiarAcao(true, false));
    corpo.querySelector('#athBtnCopiarPromptIaRodape')?.addEventListener('click', () => copiarAcao(false, true));
  }
}

/**
 * Função utilitária para escapar caracteres HTML
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
