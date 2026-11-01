// SPDX-License-Identifier: GPL-3.0-or-later
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

const PORT = 4198;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(process.cwd(), reqPath.replace(/^\//, ''));

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (filePath.endsWith('index.html')) {
    let html = fs.readFileSync(filePath, 'utf8');
    const autoScript = `
      <script>
        window.addEventListener('load', () => {
          function poll() {
            if (window.athenesApp && window.athenesApp.editorView && window.athenesApp.painelProps) {
              const ed = window.athenesApp.editorView;
              const props = window.athenesApp.painelProps;
              const params = new URLSearchParams(window.location.search);
              const modo = params.get('cenario');

              // Bloco de parágrafo da Seção de Introdução (seção 1)
              let pBloco = null;
              for (const s of ed.doc.secoes) {
                pBloco = (s.blocos || []).find(b => b.tipo === 'paragrafo');
                if (pBloco) break;
              }

              if (modo === 'props_distancias') {
                if (pBloco) {
                  ed.selecionarBloco(pBloco);
                  props.renderizarBloco(pBloco);
                  setTimeout(() => {
                    const colDir = document.querySelector('.rm-col-dir');
                    if (colDir) colDir.scrollTop = 450;
                  }, 150);
                }
              } else if (modo === 'props_formula') {
                let fBloco = null;
                for (const s of ed.doc.secoes) {
                  fBloco = (s.blocos || []).find(b => b.tipo === 'formula');
                  if (fBloco) break;
                }
                if (!fBloco) {
                  fBloco = {
                    id: 'bloco_formula_demo',
                    tipo: 'formula',
                    latex: '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
                    numero_equacao: '(1)',
                    rotulo: 'Equação de Gauss'
                  };
                  ed.doc.secoes[0].blocos.push(fBloco);
                }
                ed.selecionarBloco(fBloco);
                props.renderizarBloco(fBloco);
              } else if (modo === 'modal_layout') {
                // Importa dinamicamente e abre o modal
                import('./src/ui/athenes_editor_layout_bloco.js').then(({ ModalLayoutBloco }) => {
                  const figBloco = {
                    id: 'bloco_fig_demo',
                    tipo: 'figura',
                    subtipo: 'figura',
                    titulo: 'Figura 1 — Arquitetura de Camadas Neurais',
                    layout: '2_lado',
                    subgrade_colunas: 2,
                    subgrade_linhas: 2,
                    moldura_tipo: 'linha_lateral',
                    linha_estilo: 'pontilhada',
                    borda_cor: '#314F79',
                    borda_largura_px: 3,
                    legenda_geral: 'Diagrama esquemático demonstrando os slots da subgrade com legenda ao lado.',
                    fonte: 'Fonte: Autores (2026).'
                  };
                  new ModalLayoutBloco(ed.doc, figBloco, { onSalvar: () => {} });
                });
              } else if (modo === 'contextual') {
                if (pBloco) {
                  ed.selecionarBloco(pBloco);
                  setTimeout(() => {
                    const elTexto = document.querySelector('.ath-texto-editable');
                    if (elTexto) {
                      const range = document.createRange();
                      range.selectNodeContents(elTexto.firstChild || elTexto);
                      const sel = window.getSelection();
                      sel.removeAllRanges();
                      sel.addRange(range);
                      document.dispatchEvent(new Event('selectionchange'));
                    }
                  }, 150);
                }
              }
            } else {
              setTimeout(poll, 100);
            }
          }
          poll();
        });
      </script>
    `;
    html = html.replace('</body>', `${autoScript}</body>`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', async () => {
  const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = 'C:\\Users\\jeffe\\.gemini\\antigravity\\brain\\f29036f0-2e77-49fc-a2cc-41686233d4a8';

  const capturar = (cenario, arquivo, esperaMs = 2500) => {
    return new Promise(resolve => {
      const outPath = path.join(outDir, arquivo);
      const args = [
        '--headless=new',
        `--screenshot=${outPath}`,
        '--window-size=1440,900',
        `http://127.0.0.1:${PORT}/index.html?tela=editor&cenario=${cenario}`
      ];
      setTimeout(() => {
        execFile(edgeExe, args, () => {
          console.log(`Captura salva: ${arquivo}`);
          resolve();
        });
      }, esperaMs);
    });
  };

  try {
    await capturar('editor', 'captura_barra_icones_chevrons.png', 2000);
    await capturar('props_distancias', 'captura_painel_distancias_espacamentos.png', 2000);
    await capturar('props_formula', 'captura_painel_formula_paleta.png', 2000);
    await capturar('modal_layout', 'captura_modal_subgrade_layout.png', 2000);
    await capturar('contextual', 'captura_barra_contextual_marcadores.png', 2000);
  } finally {
    server.close();
    process.exit(0);
  }
});
