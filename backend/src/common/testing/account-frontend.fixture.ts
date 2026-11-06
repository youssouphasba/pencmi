import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, resolve, sep } from 'path';

export async function startAccountFrontend(api: string) {
  const root = resolve(__dirname, '../../../..');
  let origin: string;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://localhost');
      if (url.pathname.startsWith('/api/v1/')) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const response = await fetch(api + url.pathname + url.search, {
          method: req.method,
          headers: {
            ...(req.headers.authorization
              ? { Authorization: req.headers.authorization }
              : {}),
            ...(req.headers['content-type']
              ? { 'Content-Type': req.headers['content-type'] }
              : {}),
          },
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        });
        res.writeHead(response.status, {
          'Content-Type':
            response.headers.get('content-type') || 'application/json',
        });
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (url.pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(
          `window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}};`,
        );
      }
      if (!extname(url.pathname) && !url.pathname.endsWith('/')) {
        res.writeHead(302, { Location: url.pathname + '/' + url.search });
        return res.end();
      }
      const file = resolve(
        root,
        '.' +
          decodeURIComponent(
            url.pathname.endsWith('/')
              ? url.pathname + 'index.html'
              : url.pathname,
          ),
      );
      if (
        !file.startsWith(root + sep) ||
        /[\\/](backend|node_modules|\.git|\.codex-attachments)[\\/]/.test(
          file,
        ) ||
        !/\.(html|css|m?js|json|png|jpe?g|svg|woff2?)$/i.test(file)
      ) {
        res.statusCode = 404;
        return res.end();
      }
      const types: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      };
      res.setHeader(
        'Content-Type',
        types[extname(file)] || 'application/octet-stream',
      );
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return {
    origin,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
