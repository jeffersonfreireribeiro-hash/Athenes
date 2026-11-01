// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const cssGlauxPath = 'D:\\1. PROJETOS\\REURB_APP\\web\\css\\relatorios_modelos.css';
let cssGlaux = fs.readFileSync(cssGlauxPath, 'utf8');

// Adiciona estilos específicos da folha A4 real do Athenes, blocos editáveis in-page e layout de 3 colunas
const cssAthenesAdicional = `

/* =========================================================================
   Athenes — Estilos da Folha Real (WYSIWYG na Página) e Blocos Compostos
   ========================================================================= */

.rm-conteudo {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--ath-bg, #EFF2F6);
}

.ath-topo-shell {
  height: 52px;
  background: #FFFFFF;
  border-bottom: 1.5px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  flex-shrink: 0;
  z-index: 50;
}

.ath-topo-esq, .ath-topo-dir {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ath-marca-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 16px;
  color: #1F2733;
  text-decoration: none;
  cursor: pointer;
}

.ath-marca-link svg {
  color: #FF6B2C;
}

.ath-doc-titulo-topo {
  font-size: 13.5px;
  font-weight: 700;
  border: 1px solid transparent;
  background: #F4F5F8;
  padding: 5px 12px;
  border-radius: 999px;
  color: #1F2733;
  min-width: 200px;
  max-width: 380px;
  transition: all 0.15s ease;
}

.ath-doc-titulo-topo:focus {
  background: #FFFFFF;
  border-color: #FF6B2C;
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 107, 44, 0.14);
}

/* Palco de Prévia e Folhas */
.rm-prev-palco {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 24px 16px 80px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  background: #E8ECF1;
  position: relative;
}

/* Folha A4 Real no Palco (Escala proporcional A4 210 x 297 mm) */
.ath-folha-a4 {
  position: relative;
  width: 794px; /* ~210mm a 96 DPI */
  min-height: 1123px; /* ~297mm a 96 DPI */
  background: #FFFFFF;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.06);
  border-radius: 2px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s ease;
  user-select: text;
}

.ath-folha-a4.paisagem {
  width: 1123px;
  min-height: 794px;
}

/* Área útil interna limitada pelas margens configuradas */
.ath-folha-area-util {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  z-index: 2;
}

/* Linha pontilhada indicativa das margens na folha */
.ath-folha-guia-margem {
  position: absolute;
  pointer-events: none;
  border: 1px dashed rgba(255, 107, 44, 0.28);
  border-radius: 1px;
  z-index: 1;
}

/* Sobreposição da grade de 12 colunas quando ativada */
.ath-folha-grade-12 {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 8px;
  pointer-events: none;
  z-index: 1;
  opacity: 0.22;
}

.ath-folha-grade-12 .ath-col-guia {
  background: #FF6B2C;
  border-radius: 2px;
  height: 100%;
}

/* Cabeçalho e Rodapé dentro da Folha */
.ath-folha-cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #E2E8F0;
  padding-bottom: 6px;
  margin-bottom: 14px;
  font-size: 11px;
  color: #6B7585;
}

.ath-folha-rodape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #E2E8F0;
  padding-top: 8px;
  margin-top: auto;
  font-size: 11px;
  color: #6B7585;
}

/* =========================================================================
   Blocos na Folha com Edição Direta (In-Page WYSIWYG)
   ========================================================================= */

.ath-bloco-folha {
  position: relative;
  margin-bottom: 12px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1.5px solid transparent;
  transition: border-color 0.12s ease, background 0.12s ease;
  cursor: text;
}

.ath-bloco-folha:hover {
  border-color: #CBD5E1;
  background: rgba(241, 245, 249, 0.5);
}

.ath-bloco-folha.sel {
  border-color: #FF6B2C;
  background: #FFFBF9;
  box-shadow: 0 0 0 3px rgba(255, 107, 44, 0.12);
}

.ath-bloco-folha [contenteditable="true"] {
  outline: none;
}

.ath-bloco-folha [contenteditable="true"]:focus {
  background: transparent;
}

/* Identificador flutuante do bloco selecionado */
.ath-bloco-cracha {
  position: absolute;
  top: -10px;
  left: 8px;
  background: #FF6B2C;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 7px;
  border-radius: 999px;
  pointer-events: none;
  display: none;
  z-index: 10;
}

.ath-bloco-folha.sel .ath-bloco-cracha {
  display: inline-block;
}

/* =========================================================================
   Blocos Compostos: Figura, Mapa, Tabela, Quadro, Fórmula
   ========================================================================= */

/* Bloco Figura Composta (Título acima, grid de imagens, legenda e fonte) */
.ath-composto-figura {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}

.ath-fig-titulo, .ath-mapa-titulo, .ath-tab-titulo, .ath-quadro-titulo {
  font-weight: 800;
  font-size: 13px;
  color: #1F2733;
}

.ath-fig-grid {
  display: grid;
  gap: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 8px;
}

.ath-fig-grid[data-layout="1"] { grid-template-columns: 1fr; }
.ath-fig-grid[data-layout="2_lado"] { grid-template-columns: 1fr 1fr; }
.ath-fig-grid[data-layout="2_empilhado"] { grid-template-columns: 1fr; }
.ath-fig-grid[data-layout="3_linha"] { grid-template-columns: 1fr 1fr 1fr; }
.ath-fig-grid[data-layout="3_misto"] { grid-template-columns: 2fr 1fr; }
.ath-fig-grid[data-layout="4_grade"] { grid-template-columns: 1fr 1fr; }
.ath-fig-grid[data-layout="6_grade"] { grid-template-columns: 1fr 1fr 1fr; }

.ath-fig-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ath-fig-item img {
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
  border-radius: 4px;
}

.ath-fig-sublegenda {
  font-size: 11px;
  color: #6B7585;
  font-style: italic;
}

.ath-fig-legenda-geral {
  font-size: 12px;
  color: #475569;
  line-height: 1.35;
}

.ath-bloco-fonte {
  font-size: 11px;
  color: #6B7585;
  font-style: italic;
}

/* Bloco Mapa */
.ath-composto-mapa {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}

.ath-mapa-canvas-box {
  position: relative;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  background: #F1F5F9;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.ath-mapa-norte {
  position: absolute;
  top: 10px;
  right: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #CBD5E1;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 12px;
  color: #FF6B2C;
}

.ath-mapa-escala-badge {
  position: absolute;
  bottom: 8px;
  left: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  color: #1F2733;
}

.ath-mapa-legenda-carto {
  font-size: 11px;
  color: #475569;
  background: #F8FAFC;
  border-left: 3px solid #FF6B2C;
  padding: 4px 8px;
  border-radius: 0 4px 4px 0;
}

/* Bloco Tabela (Padrão ABNT / IBGE: laterais verticais abertas) */
.ath-tabela-abnt {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin: 6px 0;
}

.ath-tabela-abnt th {
  border-top: 1.5px solid #1F2733;
  border-bottom: 1.5px solid #1F2733;
  padding: 6px 10px;
  text-align: left;
  font-weight: 800;
}

.ath-tabela-abnt td {
  border-bottom: 1px solid #E2E8F0;
  padding: 5px 10px;
}

.ath-tabela-abnt tr:last-child td {
  border-bottom: 1.5px solid #1F2733;
}

/* Bloco Quadro (Padrão ABNT: caixa fechada com todas as bordas) */
.ath-quadro-abnt {
  width: 100%;
  border-collapse: collapse;
  border: 1.5px solid #1F2733;
  font-size: 12px;
  margin: 6px 0;
}

.ath-quadro-abnt th {
  background: #F8FAFC;
  border: 1px solid #1F2733;
  padding: 6px 10px;
  text-align: left;
  font-weight: 800;
}

.ath-quadro-abnt td {
  border: 1px solid #1F2733;
  padding: 5px 10px;
}

/* Bloco Fórmula / Equação */
.ath-bloco-formula {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  margin: 8px 0;
}

.ath-formula-corpo {
  flex: 1;
  text-align: center;
  font-family: 'Cambria Math', 'Latin Modern Math', 'Times New Roman', serif;
  font-size: 16px;
  color: #1F2733;
}

.ath-formula-numero {
  font-weight: 700;
  font-size: 13px;
  color: #6B7585;
}

/* Tag de Referência Cruzada inline */
.ath-tag-ref {
  display: inline-flex;
  align-items: center;
  background: #FFF1EB;
  color: #D9531E;
  font-weight: 700;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid #FFD9C7;
  cursor: pointer;
}

.ath-tag-ref:hover {
  background: #FFE3D6;
}
`;

const cssCompleto = `/* SPDX-License-Identifier: GPL-3.0-or-later */\n` + cssGlaux + cssAthenesAdicional;
fs.writeFileSync('d:\\1. PROJETOS\\Athenes\\src\\css\\athenes_editor.css', cssCompleto, 'utf8');
console.log('athenes_editor.css gerado com sucesso! Bytes:', cssCompleto.length);
