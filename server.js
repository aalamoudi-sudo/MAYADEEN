const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const APPS_SCRIPT_URL = (process.env.API_URL || process.env.APPS_SCRIPT_URL || process.env.SCRIPT_URL || '').trim();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  if (!APPS_SCRIPT_URL) {
    return send(res, 500, JSON.stringify({ ok: false, error: 'Missing API_URL environment variable' }));
  }
  try {
    const body = req.method === 'GET' ? JSON.stringify({ action: 'data_sync' }) : await readBody(req);
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body || '{}',
      redirect: 'follow'
    });
    const text = await upstream.text();
    send(res, upstream.ok ? 200 : upstream.status, text || '{}', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  } catch (err) {
    send(res, 502, JSON.stringify({ ok: false, error: 'Proxy failed: ' + err.message }));
  }
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
        send(res, 200, fallback, 'text/html; charset=utf-8');
      });
      return;
    }
    send(res, 200, data, mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) return handleApi(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Mayadeen proxy server running on port ${PORT}`);
});
