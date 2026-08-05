import { createServer } from 'node:http';
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'dist');
const dbPath = process.env.DB_PATH ?? '/data/dermatitis-tracker.sqlite';
const photosDir = process.env.PHOTOS_DIR ?? '/data/photos';
const port = Number(process.env.PORT ?? 80);
const appPin = process.env.APP_PIN ?? '';
const weatherLatitude = Number(process.env.WEATHER_LAT ?? 37.5665);
const weatherLongitude = Number(process.env.WEATHER_LON ?? 126.978);
const weatherTimezone = process.env.WEATHER_TIMEZONE ?? 'Asia/Seoul';
const weatherEnabled = process.env.WEATHER_ENABLED !== 'false' && Number.isFinite(weatherLatitude) && Number.isFinite(weatherLongitude);

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
const weatherSource = 'open-meteo';

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(photosDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const getLegacyState = db.prepare('SELECT data FROM app_state WHERE id = 1');
const getSettings = db.prepare('SELECT data FROM app_settings WHERE id = 1');
const countSettings = db.prepare('SELECT COUNT(*) AS count FROM app_settings');
const countRecords = db.prepare('SELECT COUNT(*) AS count FROM records');
const listRecords = db.prepare('SELECT data FROM records ORDER BY date DESC, time DESC, updated_at DESC');
const saveSettings = db.prepare(`
  INSERT INTO app_settings (id, data, updated_at)
  VALUES (1, ?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`);
const saveRecord = db.prepare(`
  INSERT INTO records (id, date, time, data, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    date = excluded.date,
    time = excluded.time,
    data = excluded.data,
    updated_at = excluded.updated_at
`);
const deleteRecordById = db.prepare('DELETE FROM records WHERE id = ?');
const deleteAllRecords = db.prepare('DELETE FROM records');

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

    if (appPin && !isAuthorized(request)) {
      sendAuthChallenge(response);
      return;
    }

    if (url.pathname === '/api/data') {
      await handleDataApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/photos/')) {
      await handlePhotoApi(request, response, decodeURIComponent(url.pathname.slice('/api/photos/'.length)));
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

await migrateLegacyState();

server.listen(port, '0.0.0.0', () => {
  console.log(`dermatitis-tracker listening on port ${port}`);
  console.log(`sqlite database: ${dbPath}`);
});

async function handleDataApi(request, response, url) {
  if (request.method === 'GET') {
    const result = loadDataResult();
    if (url.searchParams.get('photos') === 'inline') {
      sendJson(response, 200, await inlinePhotoData(result.data), { 'X-App-State-Exists': String(result.exists) });
      return;
    }
    sendJson(response, 200, result.data, { 'X-App-State-Exists': String(result.exists) });
    return;
  }

  if (request.method === 'PUT') {
    const data = await readJsonBody(request);
    if (!isValidAppData(data)) {
      sendJson(response, 400, { error: 'Invalid app data' });
      return;
    }
    const normalizedData = await persistPhotoFiles(normalizeAppData(data));
    saveAllData(normalizedData);
    await pruneUnusedPhotos(normalizedData);
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

    const recordWithWeather = await attachWeatherSnapshot(normalizeRecord(record));
    const normalizedRecord = (await persistPhotoFiles({ ...defaultData, records: [recordWithWeather] })).records[0];
    const currentData = loadData();
    const exists = currentData.records.some((item) => item.id === id);
    const nextData = {
      ...currentData,
      records: exists ? currentData.records.map((item) => (item.id === id ? normalizedRecord : item)) : [...currentData.records, normalizedRecord],
    };
    saveOneRecord(normalizedRecord);
    await pruneUnusedPhotos(nextData);
    sendJson(response, 200, nextData);
    return;
  }

  if (request.method === 'DELETE') {
    const currentData = loadData();
    const nextData = {
      ...currentData,
      records: currentData.records.filter((record) => record.id !== id),
    };
    deleteRecordById.run(id);
    await pruneUnusedPhotos(nextData);
    sendJson(response, 200, nextData);
    return;
  }

  response.writeHead(405, { Allow: 'PUT, DELETE' });
  response.end();
}

async function handlePhotoApi(request, response, filename) {
  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET' });
    response.end();
    return;
  }

  const safeFilename = basename(filename);
  if (!safeFilename || safeFilename !== filename) {
    sendJson(response, 400, { error: 'Invalid photo path' });
    return;
  }

  const filePath = join(photosDir, safeFilename);
  if (!existsSync(filePath)) {
    sendJson(response, 404, { error: 'Photo not found' });
    return;
  }

  const extension = extname(filePath);
  const contentType = mimeTypes[extension] ?? 'application/octet-stream';
  const content = await readFile(filePath);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  response.end(content);
}

function loadData() {
  return loadDataResult().data;
}

function loadDataResult() {
  const settingsRow = getSettings.get();
  const recordRows = listRecords.all();
  const exists = Boolean(settingsRow) || recordRows.length > 0;
  if (!exists) return { data: defaultData, exists: false };

  try {
    const settings = settingsRow ? JSON.parse(settingsRow.data) : defaultData.settings;
    const records = recordRows.map((row) => JSON.parse(row.data));
    const parsed = {
      storageVersion: defaultData.storageVersion,
      settings,
      records,
    };
    return { data: isValidAppData(parsed) ? normalizeAppData(parsed) : defaultData, exists: true };
  } catch {
    return { data: defaultData, exists: true };
  }
}

async function migrateLegacyState() {
  const alreadyMigrated = Number(countSettings.get().count) > 0 || Number(countRecords.get().count) > 0;
  if (alreadyMigrated) return;

  const row = getLegacyState.get();
  if (!row) return;

  try {
    const parsed = JSON.parse(row.data);
    if (!isValidAppData(parsed)) return;
    const normalizedData = await persistPhotoFiles(normalizeAppData(parsed));
    saveAllData(normalizedData);
  } catch (error) {
    console.error('legacy state migration failed', error);
  }
}

function saveAllData(data) {
  db.exec('BEGIN IMMEDIATE');
  try {
    saveSettings.run(JSON.stringify(data.settings));
    deleteAllRecords.run();
    for (const record of data.records) saveOneRecord(record);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function saveOneRecord(record) {
  saveRecord.run(record.id, record.date, record.time, JSON.stringify(record), record.updatedAt);
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
    (value.photos === undefined || hasValidPhotos(value.photos)) &&
    (value.weather === undefined || value.weather === null || hasValidWeather(value.weather))
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
    weather: value.weather ?? null,
  };
}

async function attachWeatherSnapshot(record) {
  if (record.weather?.status === 'captured') return record;
  return {
    ...record,
    weather: await fetchWeatherSnapshot(),
  };
}

async function fetchWeatherSnapshot() {
  const capturedAt = new Date().toISOString();

  if (!weatherEnabled) {
    return createUnavailableWeather(capturedAt);
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(weatherLatitude));
  url.searchParams.set('longitude', String(weatherLongitude));
  url.searchParams.set('timezone', weatherTimezone);
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('current', [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'precipitation',
    'pressure_msl',
    'wind_speed_10m',
    'weather_code',
  ].join(','));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
    const data = await response.json();
    const current = data?.current ?? {};
    return {
      status: 'captured',
      capturedAt,
      source: weatherSource,
      latitude: weatherLatitude,
      longitude: weatherLongitude,
      timezone: weatherTimezone,
      temperatureC: numberOrNull(current.temperature_2m),
      apparentTemperatureC: numberOrNull(current.apparent_temperature),
      humidityPercent: numberOrNull(current.relative_humidity_2m),
      precipitationMm: numberOrNull(current.precipitation),
      pressureHpa: numberOrNull(current.pressure_msl),
      windSpeedMps: numberOrNull(current.wind_speed_10m),
      weatherCode: numberOrNull(current.weather_code),
    };
  } catch (error) {
    console.error('weather capture failed', error);
    return createUnavailableWeather(capturedAt);
  }
}

function createUnavailableWeather(capturedAt) {
  return {
    status: 'unavailable',
    capturedAt,
    source: weatherSource,
    latitude: weatherLatitude,
    longitude: weatherLongitude,
    timezone: weatherTimezone,
    temperatureC: null,
    apparentTemperatureC: null,
    humidityPercent: null,
    precipitationMm: null,
    pressureHpa: null,
    windSpeedMps: null,
    weatherCode: null,
  };
}

async function persistPhotoFiles(data) {
  return {
    ...data,
    records: await Promise.all(data.records.map(async (record) => ({
      ...record,
      photos: await Promise.all((record.photos ?? []).map(savePhotoFile)),
    }))),
  };
}

async function savePhotoFile(photo) {
  if (photo.dataUrl.startsWith('/api/photos/')) return photo;

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo.dataUrl);
  if (!match) return photo;

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `${sanitizePhotoId(photo.id)}.${extension}`;
  await writeFile(join(photosDir, filename), Buffer.from(match[2], 'base64'));
  return {
    ...photo,
    dataUrl: `/api/photos/${encodeURIComponent(filename)}`,
  };
}

async function inlinePhotoData(data) {
  return {
    ...data,
    records: await Promise.all(data.records.map(async (record) => ({
      ...record,
      photos: await Promise.all((record.photos ?? []).map(inlinePhoto)),
    }))),
  };
}

async function inlinePhoto(photo) {
  if (!photo.dataUrl.startsWith('/api/photos/')) return photo;

  const filename = basename(decodeURIComponent(photo.dataUrl.slice('/api/photos/'.length)));
  const filePath = join(photosDir, filename);
  if (!existsSync(filePath)) return photo;

  const content = await readFile(filePath);
  return {
    ...photo,
    dataUrl: `data:${photo.mimeType};base64,${content.toString('base64')}`,
  };
}

async function pruneUnusedPhotos(data) {
  const used = new Set(
    data.records
      .flatMap((record) => record.photos ?? [])
      .map((photo) => photo.dataUrl.startsWith('/api/photos/') ? basename(decodeURIComponent(photo.dataUrl.slice('/api/photos/'.length))) : '')
      .filter(Boolean)
  );

  for (const filename of await readdir(photosDir)) {
    if (!used.has(filename)) await unlink(join(photosDir, filename));
  }
}

function sanitizePhotoId(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || `photo-${Date.now()}`;
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
      (/^data:image\/(jpeg|png|webp);base64,/.test(photo.dataUrl) || /^\/api\/photos\/[a-zA-Z0-9._~%-]+\.(jpg|jpeg|png|webp)$/.test(photo.dataUrl)) &&
      photo.dataUrl.length <= maxPhotoDataUrlLength &&
      typeof photo.mimeType === 'string' &&
      ['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType) &&
      typeof photo.name === 'string' &&
      typeof photo.caption === 'string' &&
      typeof photo.createdAt === 'string'
    )
  );
}

function hasValidWeather(value) {
  return (
    value &&
    typeof value === 'object' &&
    ['captured', 'unavailable'].includes(value.status) &&
    typeof value.capturedAt === 'string' &&
    typeof value.source === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.timezone === 'string' &&
    isNullableNumber(value.temperatureC) &&
    isNullableNumber(value.apparentTemperatureC) &&
    isNullableNumber(value.humidityPercent) &&
    isNullableNumber(value.precipitationMm) &&
    isNullableNumber(value.pressureHpa) &&
    isNullableNumber(value.windSpeedMps) &&
    isNullableNumber(value.weatherCode)
  );
}

function hasNumberMap(value, keys, min, max) {
  return value && typeof value === 'object' && keys.every((key) => typeof value[key] === 'number' && value[key] >= min && value[key] <= max);
}

function hasBooleanMap(value, keys) {
  return value && typeof value === 'object' && keys.every((key) => typeof value[key] === 'boolean');
}

function numberOrNull(value) {
  return typeof value === 'number' ? value : null;
}

function isNullableNumber(value) {
  return typeof value === 'number' || value === null;
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

function isAuthorized(request) {
  const header = request.headers.authorization ?? '';
  if (!header.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return false;
    return decoded.slice(separatorIndex + 1) === appPin;
  } catch {
    return false;
  }
}

function sendAuthChallenge(response) {
  response.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Dermatitis Tracker"',
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  response.end('Authentication required');
}
