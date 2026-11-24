// Serves the static export in out/ the way docker/nginx.conf does: /app -> app.html, /learn -> learn.html.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../out/', import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2'
};

async function find(p) {
  for (const c of [p, p + '.html', join(p, 'index.html')]) {
    try {
      if ((await stat(c)).isFile()) return c;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  const file = await find(path);
  if (!file) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, () => console.log('serving out/ on ' + port));
