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

const bodyAreas = ['눈 주위', '왼쪽 눈', '오른쪽 눈', '양쪽 눈', '뒤통수', '목 뒤', '두피', '기타'];
const symptomKeys = ['itching', 'redness', 'dryness', 'scaling', 'peeling', 'painStinging', 'swelling'];
const warningKeys = ['oozing', 'yellowCrust', 'pus', 'heat', 'eyePain', 'photophobia', 'blurredVision'];
const medicationKeys = ['elidel', 'maxidex', 'whitePetrolatum', 'occipitalLiquid', 'otherMedication'];
const lifestyleNumberKeys = ['sleepSatisfaction', 'fatigue', 'stress'];
const lifestyleBooleanKeys = ['longScreenTime', 'exercised', 'sweatedMuch', 'hotWaterWash', 'alcohol', 'lateSnack', 'longOutdoorTime', 'dryIndoorAir', 'seasonalChange', 'rubbedOrScratched'];
const careBooleanKeys = ['washedHair', 'newProductUsed', 'moisturizerUsed', 'whitePetrolatumUsed'];
const maxPhotosPerRecord = 6;
const maxPhotoDataUrlLength = 2_500_000;
const maxJsonBodyLength = 16_000_000;

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

    if (url.pathname.startsWith('/api/records/')) {
      await handleRecordApi(request, response, decodeURIComponent(url.pathname.slice('/api/records/'.length)));
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
    const result = loadDataResult();
    sendJson(response, 200, result.data, { 'X-App-State-Exists': String(result.exists) });
    return;
  }

  if (request.method === 'PUT') {
    const data = await readJsonBody(request);
    if (!isValidAppData(data)) {
      sendJson(response, 400, { error: 'Invalid app data' });
      return;
    }
    const normalizedData = normalizeAppData(data);
    saveState.run(JSON.stringify(normalizedData));
    sendJson(response, 200, normalizedData);
    return;
  }

  response.writeHead(405, { Allow: 'GET, PUT' });
  response.end();
}

async function handleRecordApi(request, response, id) {
  if (!id) {
    sendJson(response, 400, { error: 'Missing record id' });
    return;
  }

  if (request.method === 'PUT') {
    const record = await readJsonBody(request);
    if (!isValidRecord(record) || record.id !== id) {
      sendJson(response, 400, { error: 'Invalid record data' });
      return;
    }

    const normalizedRecord = normalizeRecord(record);
    const currentData = loadData();
    const exists = currentData.records.some((item) => item.id === id);
    const nextData = {
      ...currentData,
      records: exists ? currentData.records.map((item) => (item.id === id ? normalizedRecord : item)) : [...currentData.records, normalizedRecord],
    };
    saveState.run(JSON.stringify(nextData));
    sendJson(response, 200, nextData);
    return;
  }

  if (request.method === 'DELETE') {
    const currentData = loadData();
    const nextData = {
      ...currentData,
      records: currentData.records.filter((record) => record.id !== id),
    };
    saveState.run(JSON.stringify(nextData));
    sendJson(response, 200, nextData);
    return;
  }

  response.writeHead(405, { Allow: 'PUT, DELETE' });
  response.end();
}

function loadData() {
  return loadDataResult().data;
}

function loadDataResult() {
  const row = getState.get();
  if (!row) return { data: defaultData, exists: false };

  try {
    const parsed = JSON.parse(row.data);
    return { data: isValidAppData(parsed) ? normalizeAppData(parsed) : defaultData, exists: true };
  } catch {
    return { data: defaultData, exists: true };
  }
}

function isValidAppData(value) {
  return (
    value &&
    typeof value === 'object' &&
    value.storageVersion === 1 &&
    value.settings &&
    typeof value.settings.humiraIntervalDays === 'number' &&
    Array.isArray(value.records) &&
    value.records.every(isValidRecord)
  );
}

function isValidRecord(value) {
  return (
    value &&
    typeof value === 'object' &&
    ['id', 'date', 'time', 'memo', 'createdAt', 'updatedAt'].every((key) => typeof value[key] === 'string') &&
    Array.isArray(value.areas) &&
    value.areas.every((area) => bodyAreas.includes(area)) &&
    hasNumberMap(value.symptomScores, symptomKeys, 0, 10) &&
    hasBooleanMap(value.warnings, warningKeys) &&
    hasBooleanMap(value.medications, medicationKeys) &&
    value.lifestyle &&
    typeof value.lifestyle.previousNightSleepHours === 'number' &&
    value.lifestyle.previousNightSleepHours >= 0 &&
    value.lifestyle.previousNightSleepHours <= 24 &&
    hasNumberMap(value.lifestyle, lifestyleNumberKeys, 0, 10) &&
    hasBooleanMap(value.lifestyle, lifestyleBooleanKeys) &&
    value.care &&
    typeof value.care.shampooName === 'string' &&
    typeof value.care.cleanserName === 'string' &&
    hasBooleanMap(value.care, careBooleanKeys) &&
    value.humira &&
    typeof value.humira.used === 'boolean' &&
    typeof value.humira.actualInjectionDate === 'string' &&
    (typeof value.humira.daysSinceLastInjection === 'number' || value.humira.daysSinceLastInjection === null) &&
    typeof value.humira.nextExpectedInjectionDate === 'string' &&
    (value.photos === undefined || hasValidPhotos(value.photos))
  );
}

function normalizeAppData(value) {
  return {
    ...value,
    records: value.records.map(normalizeRecord),
  };
}

function normalizeRecord(value) {
  return {
    ...value,
    photos: Array.isArray(value.photos) ? value.photos : [],
  };
}

function hasValidPhotos(value) {
  return (
    Array.isArray(value) &&
    value.length <= maxPhotosPerRecord &&
    value.every((photo) =>
      photo &&
      typeof photo === 'object' &&
      typeof photo.id === 'string' &&
      typeof photo.dataUrl === 'string' &&
      /^data:image\/(jpeg|png|webp);base64,/.test(photo.dataUrl) &&
      photo.dataUrl.length <= maxPhotoDataUrlLength &&
      typeof photo.mimeType === 'string' &&
      ['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType) &&
      typeof photo.name === 'string' &&
      typeof photo.caption === 'string' &&
      typeof photo.createdAt === 'string'
    )
  );
}

function hasNumberMap(value, keys, min, max) {
  return value && typeof value === 'object' && keys.every((key) => typeof value[key] === 'number' && value[key] >= min && value[key] <= max);
}

function hasBooleanMap(value, keys) {
  return value && typeof value === 'object' && keys.every((key) => typeof value[key] === 'boolean');
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxJsonBodyLength) {
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

function sendJson(response, statusCode, data, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...headers,
  });
  response.end(JSON.stringify(data));
}
