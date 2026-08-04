import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'dist');
const dbPath = process.env.DB_PATH ?? '/data/dermatitis-tracker.sqlite';
const port = Number(process.env.PORT ?? 80);

const defaultData = {
  storageVersion: 1,
  settings: {
    humiraIntervalDays: 21,
  },
  records: [],
};

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const getState = db.prepare('SELECT data FROM app_state WHERE id = 1');
const saveState = db.prepare(`
  INSERT INTO app_state (id, data, updated_at)
  VALUES (1, ?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 400, { error: 'Bad request' });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

    if (url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/data') {
      await handleDataApi(request, response);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`dermatitis-tracker listening on port ${port}`);
  console.log(`sqlite database: ${dbPath}`);
});

async function handleDataApi(request, response) {
  if (request.method === 'GET') {
    sendJson(response, 200, loadData());
    return;
  }

  if (request.method === 'PUT') {
    const data = await readJsonBody(request);
    if (!isValidAppData(data)) {
      sendJson(response, 400, { error: 'Invalid app data' });
      return;
    }
    saveState.run(JSON.stringify(data));
    sendJson(response, 200, data);
    return;
  }

  response.writeHead(405, { Allow: 'GET, PUT' });
  response.end();
}

function loadData() {
  const row = getState.get();
  if (!row) return defaultData;

  try {
    const parsed = JSON.parse(row.data);
    return isValidAppData(parsed) ? parsed : defaultData;
  } catch {
    return defaultData;
  }
}

function isValidAppData(value) {
  return (
    value &&
    typeof value === 'object' &&
    value.storageVersion === 1 &&
    value.settings &&
    typeof value.settings.humiraIntervalDays === 'number' &&
    Array.isArray(value.records)
  );
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function serveStatic(pathname, response) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const requestedPath = normalize(join(publicDir, relativePath));
  const isInsidePublic = requestedPath === publicDir || requestedPath.startsWith(`${publicDir}\\`) || requestedPath.startsWith(`${publicDir}/`);
  const filePath = isInsidePublic && existsSync(requestedPath) ? requestedPath : join(publicDir, 'index.html');
  const extension = extname(filePath);
  const contentType = mimeTypes[extension] ?? 'application/octet-stream';
  const cacheControl = filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable';
  const content = await readFile(filePath);

  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  });
  response.end(content);
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  response.end(JSON.stringify(data));
}

