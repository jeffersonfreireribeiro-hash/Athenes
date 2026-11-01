// SPDX-License-Identifier: GPL-3.0-or-later
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

const PORT = 4192;
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
        function esperarApp(cb) {
          if (window.athenesApp && window.athenesApp.editorView) cb();
          else setTimeout(() => esperarApp(cb), 100);
        }
        esperarApp(() => {
          const ed = window.athenesApp.editorView;
          // Abre a seção de estilos
          const detailsList = document.querySelectorAll('.rm-sec');
          detailsList.forEach(d => {
            if (d.textContent.includes('Estilos de texto')) {
              d.open = true;
            }
          });
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
  const outPath = path.join(outDir, 'captura_estilos_afastamento.png');

  const args = [
    '--headless=new',
    `--screenshot=${outPath}`,
    '--window-size=1440,900',
    `http://127.0.0.1:${PORT}/index.html?tela=editor`
  ];

  execFile(edgeExe, args, (err) => {
    if (err) console.error(err);
    else console.log('Sucesso captura_estilos_afastamento:', outPath);
    server.close();
  });
});
