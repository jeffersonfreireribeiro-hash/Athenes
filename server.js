// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Servidor HTTP Local Estático (Zero Dependências).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverPdfAberto } from './src/server/athenes_pdf_aberto.js';
import { resolverTraducaoReferencia } from './src/server/athenes_traducao.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3300;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  if (reqPath === '/api/traduzir-referencia') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ erro: 'Método não permitido.' })); return; }
    const host = req.headers.host;
    try {
      if (req.headers.origin && host && new URL(req.headers.origin).host !== host) {
        res.writeHead(403); res.end(JSON.stringify({ erro: 'Origem não permitida.' })); return;
      }
    } catch { res.writeHead(403); res.end(JSON.stringify({ erro: 'Origem não permitida.' })); return; }
    const partes = [];
    let bytes = 0;
    req.on('data', parte => {
      bytes += parte.length;
      if (bytes > 30000) { res.writeHead(413); res.end(JSON.stringify({ erro: 'Trecho grande demais.' })); req.destroy(); return; }
      partes.push(parte);
    });
    req.on('end', async () => {
      if (bytes > 30000) return;
      let dados;
      try { dados = JSON.parse(Buffer.concat(partes).toString('utf8')); }
      catch { res.writeHead(400); res.end(JSON.stringify({ erro: 'Solicitação inválida.' })); return; }
      const resultado = await resolverTraducaoReferencia(dados);
      res.writeHead(resultado.status);
      res.end(JSON.stringify(resultado.status === 200 ? { traducao: resultado.traducao } : { erro: resultado.erro }));
    });
    return;
  }

  if (reqPath === '/api/pdf-aberto') {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const consulta = new URL(req.url, 'http://localhost').searchParams;
    resolverPdfAberto({ doi: consulta.get('doi'), isbn: consulta.get('isbn') }).then(resultado => {
      res.writeHead(resultado.status, resultado.status === 200
        ? { 'Content-Type': 'application/pdf', 'X-Athenes-Fonte': resultado.fonte, 'Cache-Control': 'no-store' }
        : { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(resultado.status === 200 ? resultado.pdf : JSON.stringify({ erro: resultado.mensagem }));
    }).catch(() => { res.writeHead(502); res.end(JSON.stringify({ erro: 'Falha ao consultar PDF público.' })); });
    return;
  }

  // Rotas de API para atualização automática do aplicativo Android (padrão Glaux GIS)
  if (reqPath === '/api/v1/app/info') {
    const versionFilePath = path.join(__dirname, 'version.json');
    const apkFilePath = path.join(__dirname, 'athenes.apk');
    let info = {
      disponivel: true,
      versao: '1.0.1',
      nome: 'athenes.apk',
      tamanhoBytes: 10959328,
      tamanhoFormatado: '10.5 MB',
      atualizadoEm: new Date().toISOString(),
      downloadUrl: '/athenes.apk',
      downloadUrlFallback: 'https://raw.githubusercontent.com/jeffersonfreireribeiro-hash/Athenes/main/athenes.apk',
      notas: 'Detecção de caneta S-Pen e rejeição de palma alocada nas Configurações, barra superior compacta com ícones SVG expressivos e layout de leitura limpo.'
    };

    if (fs.existsSync(versionFilePath)) {
      try {
        info = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
      } catch (_) {}
    }

    if (fs.existsSync(apkFilePath)) {
      const stats = fs.statSync(apkFilePath);
      info.tamanhoBytes = stats.size;
      info.tamanhoFormatado = `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
      info.atualizadoEm = stats.mtime.toISOString();
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(info));
    return;
  }

  if (reqPath === '/api/v1/app/download' || reqPath === '/baixar-app') {
    reqPath = '/athenes.apk';
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);

  // Segurança: impede path traversal fora da raiz
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Acesso negado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 — Arquivo não encontrado: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    };

    if (ext === '.apk') {
      headers['Content-Disposition'] = 'attachment; filename="athenes.apk"';
    } else if (reqPath === '/sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (reqPath === '/manifest.json') {
      headers['Content-Type'] = 'application/manifest+json; charset=utf-8';
    }

    res.writeHead(200, headers);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Athenes disponível localmente em: http://127.0.0.1:${PORT}`);
});
