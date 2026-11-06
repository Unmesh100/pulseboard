import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InvalidFilterError, filterServices, loadServices, summarize } from './lib/services.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const DATA_FILE = process.env.PULSEBOARD_DATA ?? join(root, 'data', 'services.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createApp({ dataFile = DATA_FILE } = {}) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    try {
      if (req.method !== 'GET') {
        return sendJson(res, 405, { error: 'method not allowed' });
      }

      if (url.pathname === '/api/services') {
        const services = await loadServices(dataFile);
        const filtered = filterServices(services, {
          status: url.searchParams.get('status') ?? undefined,
          q: url.searchParams.get('q') ?? undefined,
        });
        return sendJson(res, 200, { services: filtered });
      }

      if (url.pathname === '/api/summary') {
        const services = await loadServices(dataFile);
        return sendJson(res, 200, summarize(services));
      }

      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!MIME[extname(file)] || file.includes('..')) {
        return sendJson(res, 404, { error: 'not found' });
      }
      const body = await readFile(join(root, 'public', file));
      res.writeHead(200, { 'content-type': MIME[extname(file)] });
      return res.end(body);
    } catch (err) {
      if (err instanceof InvalidFilterError) return sendJson(res, 400, { error: err.message });
      if (err.code === 'ENOENT') return sendJson(res, 404, { error: 'not found' });
      console.error(err);
      return sendJson(res, 500, { error: 'internal error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  createApp().listen(port, () => {
    console.log(`pulseboard running at http://localhost:${port}`);
  });
}
