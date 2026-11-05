// server.js
// PHAN RIENG: Chi phuc vu ban web, khong chua logic canvas.
// Chay: node server.js  ->  mo http://localhost:5173
// Chi dung thu vien chuan cua Node, khong can cai them goi nao.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'renderer');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  // Chi cho phep doc file trong renderer/, chan doc file ngoai thu muc nay.
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(ROOT, path.normalize(urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
    res.end(data);
  });
});

server.listen(5173, () => console.log('QuetVideo web: http://localhost:5173'));
