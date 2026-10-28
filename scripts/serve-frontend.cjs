const http = require('node:http');
const fs = require('node:fs');
const { realpath, stat } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const denied = new Set(['backend', 'node_modules', 'scripts', 'tests', 'uploads', 'storage', 'logs']);
const port = Number(process.env.PENCMI_FRONTEND_PORT || 3001);
const host = process.env.PENCMI_FRONTEND_HOST || '127.0.0.1';
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const parts = pathname.split(/[\\/]/).filter(Boolean);
    if (parts.some(part => part.startsWith('.') || denied.has(part))) throw new Error();
    let target = await realpath(path.resolve(root, `.${pathname}`));
    if (!target.startsWith(`${root}${path.sep}`) && target !== root) throw new Error();
    if ((await stat(target)).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(302, { Location: `${pathname}/${new URL(req.url, 'http://localhost').search}` }); return res.end(); }
      target = await realpath(path.join(target, 'index.html'));
    }
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error();
    const relative = path.relative(root, target).split(path.sep);
    if (relative.some(part => part.startsWith('.') || denied.has(part))) throw new Error();
    const type = types[path.extname(target).toLowerCase()];
    if (!type || !(await stat(target)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': `${type}${/^(text\/)/.test(type) ? '; charset=utf-8' : ''}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Introuvable'); }
});
server.on('error', () => { console.error('Le serveur frontend ne peut pas démarrer sur ce port.'); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Frontend Péncmi : http://${host}:${port}`));
