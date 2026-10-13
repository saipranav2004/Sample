/* Serve dist/ the way nginx does in production (clean URLs: /company -> company.html,
   unknown paths -> 404.html with status 404). For local preview and the e2e tests.
     node scripts/serve.mjs [port]            (default 4173) */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = +(process.argv[2] || process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json', '.ico': 'image/x-icon' };

async function file(p) {
  try { const s = await stat(p); return s.isFile() ? p : null; } catch { return null; }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (path === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  const base = join(root, safe);
  const hit = (path.endsWith('/') ? await file(join(base, 'index.html')) : null) || await file(base) || await file(base + '.html');
  const target = hit || join(root, '404.html');
  try {
    const body = await readFile(target);
    res.writeHead(hit ? 200 : 404, { 'Content-Type': TYPES[extname(target)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500); res.end('error');
  }
}).listen(port, '127.0.0.1', () => console.log('serving dist on http://127.0.0.1:' + port));
