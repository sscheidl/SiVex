// Minimaler statischer Webserver ohne Abhängigkeiten (nur für Entwicklung und Tests).
// Aufruf: node scripts/serve.mjs [verzeichnis] [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '..'));
const port = Number(process.argv[3] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

export function serve(dir = root, p = port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = path.normalize(path.join(dir, decodeURIComponent(url.pathname)));
    if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Nicht gefunden'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(p, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serve().then(() => console.log(`Halbtitrationslabor läuft auf http://localhost:${port}/  (Verzeichnis: ${root})`));
}
