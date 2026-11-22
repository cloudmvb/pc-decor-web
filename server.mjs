import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './scripts/server/env.mjs';
import { initDatabase } from './scripts/server/db.mjs';
import { handleApiRequest } from './scripts/server/api-router.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = CONFIG.PORT;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.unityweb': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.gz': 'application/octet-stream',
  '.br': 'application/octet-stream'
};

const ALLOWED_EXTS = new Set(Object.keys(MIME));

function resolveContentHeaders(filePath, ext) {
  let contentEncoding = null;
  let innerExt = ext;
  if (ext === '.br') {
    contentEncoding = 'br';
    innerExt = path.extname(filePath.slice(0, -3)).toLowerCase();
  } else if (ext === '.gz') {
    contentEncoding = 'gzip';
    innerExt = path.extname(filePath.slice(0, -3)).toLowerCase();
  }
  const contentType = MIME[innerExt] || 'application/octet-stream';
  return { contentType, contentEncoding };
}

await initDatabase();

http.createServer(async (req, res) => {
  const rawUrl = req.url || '/';

  // Dispatch REST API requests
  if (rawUrl === '/api' || rawUrl.startsWith('/api/') || rawUrl.startsWith('/api?')) {
    await handleApiRequest(req, res);
    return;
  }

  // Static files
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(rawUrl.split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end('Invalid URL');
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.resolve(ROOT, '.' + urlPath);
  const relative = path.relative(ROOT, filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Protect internal database/env files and restrict to allowed web asset extensions
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.startsWith('database') ||
    relative.startsWith('.env') ||
    !ALLOWED_EXTS.has(ext)
  ) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
    const { contentType, contentEncoding } = resolveContentHeaders(filePath, ext);
    const headers = {
      'Content-Type': contentType,
      ...(contentEncoding ? { 'Content-Encoding': contentEncoding } : {}),
      'Cache-Control': 'no-cache',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff'
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`SKYCRUMB 3D & ERP Server running at http://localhost:${PORT}`);
});
