const http = require('node:http');
const { createHmac, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs');
const { realpath, stat } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json' };
const denied = new Set(['backend', 'node_modules', 'scripts', 'tests', 'uploads', 'storage', 'logs']);
const port = Number(process.env.PENCMI_FRONTEND_PORT || process.env.PORT || 3001);
const host = process.env.PENCMI_FRONTEND_HOST || '127.0.0.1';
const loopback = host === '127.0.0.1' || host === '::1';
const preview = process.env.PENCMI_PREVIEW_API_ORIGIN;
const accessKey = process.env.PENCMI_PREVIEW_ACCESS_KEY;
const accessPath = '/__preview/access';
const cookieName = 'pencmi_preview';
let upstream;
if (preview) {
  upstream = new URL(preview);
  if (upstream.protocol !== 'http:' || upstream.pathname !== '/' || upstream.search || upstream.hash
    || upstream.username || upstream.password || !upstream.port
    || !(upstream.hostname === '127.0.0.1' || upstream.hostname === '[::1]' || /^[a-z0-9-]+\.railway\.internal$/.test(upstream.hostname))) {
    throw new Error('Origine API de recette invalide : hôte privé et port explicites requis.');
  }
  if ((!loopback || accessKey) && (!accessKey || Buffer.byteLength(accessKey) < 32)) {
    throw new Error('Une clé d’accès de recette forte est requise.');
  }
}

const accessForm = '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Recette Péncmi</title><main><h1>Recette Péncmi</h1><form method="post" action="/__preview/access"><label>Clé d’accès <input name="key" type="password" required maxlength="256" autocomplete="off"></label> <button>Accéder</button></form></main></html>';
const signature = (value) => createHmac('sha256', accessKey).update(value).digest('hex');
function matches(left, right) {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function hasAccess(req) {
  if (!accessKey) return true;
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  const [expires, proof] = (cookie?.slice(cookieName.length + 1) || '').split('.');
  return /^\d{13}$/.test(expires) && Number(expires) > Date.now()
    && typeof proof === 'string' && matches(proof, signature(`session:${expires}`));
}
async function enter(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 1024) { res.writeHead(413); res.end(); return; }
  }
  const key = new URLSearchParams(body).get('key') || '';
  if (!matches(signature(`access:${key}`), signature(`access:${accessKey}`))) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(accessForm.replace('<form ', '<p role="alert">Clé incorrecte.</p><form '));
    return;
  }
  const ttl = 8 * 60 * 60;
  const expires = Date.now() + ttl * 1000;
  res.writeHead(303, { Location: '/', 'Set-Cookie': `${cookieName}=${expires}.${signature(`session:${expires}`)}; Path=/; Max-Age=${ttl}; HttpOnly; SameSite=Strict${loopback ? '' : '; Secure'}` });
  res.end();
}

function proxyApi(req, res, url) {
  const headers = {};
  for (const name of ['authorization', 'content-type', 'content-length', 'accept']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  const request = http.request(upstream, { path: url.pathname + url.search, method: req.method, headers, timeout: 60000 }, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400) {
      response.resume(); res.writeHead(502); res.end(); return;
    }
    for (const name of ['content-type', 'content-length', 'content-disposition', 'retry-after']) {
      if (response.headers[name]) res.setHeader(name, response.headers[name]);
    }
    res.writeHead(response.statusCode);
    response.on('error', () => res.destroy());
    response.pipe(res);
  });
  request.on('timeout', () => request.destroy());
  request.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { message: 'API de recette indisponible.' } }));
  });
  res.on('close', () => { if (!res.writableEnded) request.destroy(); });
  req.pipe(request);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (preview) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (accessKey && url.pathname === accessPath && req.method === 'POST') return await enter(req, res);
      if (!hasAccess(req)) {
        if (url.pathname.startsWith('/api/')) { res.writeHead(401); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : accessForm);
      }
      if (url.pathname.startsWith('/api/v1/')) return proxyApi(req, res, url);
      if (url.pathname === '/config/runtime-config.js' && ['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : 'window.PencmiRuntimeConfig = Object.freeze({ apiBaseUrl: location.origin + "/api/v1", backendUrl: location.origin });\nwindow.PencmiApiBaseUrl = window.PencmiRuntimeConfig.apiBaseUrl;');
      }
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(url.pathname);
    const parts = pathname.split(/[\\/]/).filter(Boolean);
    if (parts.some(part => part.startsWith('.') || denied.has(part.toLowerCase()))) throw new Error();
    let target = await realpath(path.resolve(root, `.${pathname}`));
    if (!target.startsWith(`${root}${path.sep}`) && target !== root) throw new Error();
    if ((await stat(target)).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(302, { Location: `${pathname}/${new URL(req.url, 'http://localhost').search}` }); return res.end(); }
      target = await realpath(path.join(target, 'index.html'));
    }
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error();
    const relative = path.relative(root, target).split(path.sep);
    if (relative.some(part => part.startsWith('.') || denied.has(part.toLowerCase()))) throw new Error();
    const type = types[path.extname(target).toLowerCase()];
    if (!type || !(await stat(target)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': `${type}${/^(text\/)/.test(type) ? '; charset=utf-8' : ''}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Introuvable'); }
});
server.on('error', () => { console.error('Le serveur frontend ne peut pas démarrer sur ce port.'); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Frontend Péncmi : http://${host}:${port}`));
