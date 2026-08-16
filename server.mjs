import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import personasHandler from './api/personas.js';
import chatHandler from './api/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? path.join(ROOT, 'index.html') : path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (!path.extname(filePath)) filePath += '.html';
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      return res.end('Not Found');
    }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/api/personas') return personasHandler(req, res);
  if (pathname === '/api/chat') return chatHandler(req, res);
  return serveStatic(req, res, pathname);
}

loadEnv();
const port = Number(process.env.PORT || 3000);
http.createServer(handle).listen(port, () => {
  console.log(`persona-hub 本地服务器已启动：http://localhost:${port}`);
});
