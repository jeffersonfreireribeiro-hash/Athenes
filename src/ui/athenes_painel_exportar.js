// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Diálogo Modal de Exportação Dupla (PDF e DOCX) com Relatório Pré-Voo.
 */

import { analisarCompatibilidadeDocx } from '../core/athenes_compatibilidade.js';
import { exportarParaDocx } from '../core/athenes_export_docx.js';
import { rasterizarFiguraParaPng } from './athenes_figura_codigo_ui.js';
import { gerarDocumentoHtmlPdf } from '../core/athenes_export_pdf.js';
import { prepararFontesParaPdf, sincronizarDeclaracaoDeFontes } from './athenes_fontes_ui.js';
import { svgIcone } from './athenes_icones.js';

export class PainelExportarModal {
  constructor(documento) {
    this.doc = documento;
    this.relatorio = analisarCompatibilidadeDocx(documento);
    this.modalEl = null;

    this.abrir();
  }

  abrir() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'ath-modal-backdrop';

    const r = this.relatorio;

    this.modalEl.innerHTML = `
      <div class="ath-modal" style="max-width: 680px;">
        <div class="ath-modal-head">
          <h2>Exportar Documento</h2>
          <button type="button" class="ath-btn ath-btn-icon" id="athModalExpFechar">${svgIcone('fechar', 16)}</button>
        </div>

        <div class="ath-modal-corpo">
          <!-- Relatório Pré-Voo de Compatibilidade -->
          <div style="background:var(--ath-surface-elevated); border:1px solid var(--ath-line); border-radius:var(--ath-radius); padding:16px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="ath-badge ${r.score >= 90 ? 'ath-badge-ok' : 'ath-badge-warn'}">
                  Índice de Compatibilidade DOCX: ${r.score}%
                </span>
              </div>
              <span style="font-size:12px; color:var(--ath-muted); font-weight:700;">${r.totalBlocos} blocos auditados</span>
            </div>
            <p style="margin:0; font-size:12.5px; color:var(--ath-text-secondary); line-height:1.4;">
              ${r.resumoStatus}
            </p>
          </div>

          <!-- Lista de Itens Auditados -->
          <strong style="display:block; font-size:12px; text-transform:uppercase; color:var(--ath-muted); letter-spacing:.05em; margin-bottom:10px;">
            Diagnóstico de Compatibilidade Preventiva (${r.itens.length} observações)
          </strong>

          <div style="max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin-bottom:20px; padding-right:4px;">
            ${r.itens.length === 0 ? `
              <div style="font-size:12px; color:var(--ath-muted); font-style:italic;">Todos os blocos possuem correspondência semântica 1:1 com Word e Google Docs.</div>
            ` : r.itens.map(it => `
              <div style="background:#FFFFFF; border:1px solid var(--ath-line); border-left:3px solid ${it.nivel === 'aviso' ? 'var(--ath-warn)' : 'var(--ath-primary)'}; border-radius:4px; padding:8px 12px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                  <strong style="color:var(--ath-text);">${it.titulo}</strong>
                  <span style="font-size:10.5px; color:var(--ath-muted);">Página ${it.pagina}</span>
                </div>
                <div style="color:var(--ath-text-secondary); margin-bottom:4px;">${it.mensagem}</div>
                <div style="color:var(--ath-primary-ink); font-weight:600; font-size:11px;">Alternativa segura: ${it.alternativa}</div>
              </div>
            `).join('')}
          </div>

          <!-- Opções de Exportação -->
          <div class="ath-linha2" style="gap:14px;">
            <div style="border:1.5px solid var(--ath-line); border-radius:var(--ath-radius); padding:16px; background:#FFFFFF; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <div style="color:var(--ath-primary);">${svgIcone('docx', 22)}</div>
                  <strong style="font-size:15px;">Documento Editável (.docx)</strong>
                </div>
                <p style="font-size:12px; color:var(--ath-muted); margin:0 0 14px 0;">
                  Compatível com Microsoft Word e Google Docs. Preserva estilos, títulos, cabeçalhos, rodapés, tabelas e notas.
                </p>
              </div>
              <button type="button" class="ath-btn ath-btn-primary" id="athBtnExportarDocx" style="width:100%;">
                ${svgIcone('exportar', 14)} Baixar DOCX Editável
              </button>
            </div>

            <div style="border:1.5px solid var(--ath-line); border-radius:var(--ath-radius); padding:16px; background:#FFFFFF; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <div style="color:#DC2626;">${svgIcone('pdf', 22)}</div>
                  <strong style="font-size:15px;">Documento PDF Fiel</strong>
                </div>
                <p style="font-size:12px; color:var(--ath-muted); margin:0 0 14px 0;">
                  Renderização em W3C Paged Media com quebras de página exatas, margens milimétricas e fontes incorporadas.
                </p>
              </div>
              <button type="button" class="ath-btn" id="athBtnExportarPdf" style="width:100%;">
                ${svgIcone('imprimir', 14)} Visualizar / Salvar em PDF
              </button>
            </div>
          </div>
        </div>

        <div class="ath-modal-foot">
          <button type="button" class="ath-btn" id="athBtnBaixarJson">Salvar Pacote Athenes (.json)</button>
          <button type="button" class="ath-btn" id="athBtnFecharModal">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Eventos
    const fechar = () => this.modalEl.remove();
    this.modalEl.querySelector('#athModalExpFechar').addEventListener('click', fechar);
    this.modalEl.querySelector('#athBtnFecharModal').addEventListener('click', fechar);
    this.modalEl.addEventListener('click', e => { if (e.target === this.modalEl) fechar(); });

    // Download DOCX
    this.modalEl.querySelector('#athBtnExportarDocx').addEventListener('click', async () => {
      const btn = this.modalEl.querySelector('#athBtnExportarDocx');
      btn.textContent = 'Gerando pacote DOCX...';
      btn.disabled = true;

      try {
        const buffer = await exportarParaDocx(this.doc, { rasterizar: rasterizarFiguraParaPng }); // figuras por código → PNG + SVG vetorial
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nomeLimpo = (this.doc.titulo || 'documento').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${nomeLimpo}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Erro ao exportar DOCX: ${err.message}`);
      } finally {
        btn.textContent = 'Baixar DOCX Editável';
        btn.disabled = false;
      }
    });

    // Visualizar e Imprimir PDF
    this.modalEl.querySelector('#athBtnExportarPdf').addEventListener('click', async () => {
      // a janela abre já (clique do usuário) e o PDF só é gerado quando TODAS as fontes dos estilos estão carregadas
      const win = window.open('', '_blank');
      if (win) win.document.write('<p style="font:600 14px system-ui;padding:24px;color:#314F79">Preparando as fontes do documento…</p>');
      const { ok, falhas } = await prepararFontesParaPdf(this.doc);
      if (!ok && !confirm(`Estas fontes não puderam ser carregadas: ${falhas.join(', ')}.

O PDF sairia com uma fonte reserva (quebras de linha diferentes da tela). Gerar mesmo assim?`)) { win?.close(); return; }
      sincronizarDeclaracaoDeFontes(this.doc);
      const htmlPdf = gerarDocumentoHtmlPdf(this.doc);
      if (win) {
        win.document.open();
        win.document.write(htmlPdf);
        win.document.close();
        try { await win.document.fonts.ready; } catch (_) { /* segue */ }
        setTimeout(() => win.print(), 200);
      } else {
        alert('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups para visualizar o PDF.');
      }
    });

    // Baixar pacote JSON (.athenes)
    this.modalEl.querySelector('#athBtnBaixarJson').addEventListener('click', () => {
      sincronizarDeclaracaoDeFontes(this.doc);
      const str = JSON.stringify(this.doc, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nomeLimpo = (this.doc.titulo || 'documento').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${nomeLimpo}.athenes.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
}
