import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCare, createEmptyData, createEmptyHumira, createEmptyLifestyle, createEmptyMedications, createEmptyWarnings, loadAppData, loadPersistedAppData, saveAppData, validateAppData } from '../storage/appStorage';
import type { AppData, DermatitisRecord } from '../types/record';
import { daysBetween, getNextHumiraDate, isRecordInDateRange } from '../utils/dates';
import { createId } from '../utils/id';
import { calculateSymptomAverage } from '../utils/scores';

function makeRecord(overrides: Partial<DermatitisRecord> = {}): DermatitisRecord {
  const base: DermatitisRecord = {
    id: 'record-1',
    date: '2026-07-20',
    time: '09:30',
    areas: ['눈 주위'],
    symptomScores: {
      itching: 7,
      redness: 5,
      dryness: 4,
      scaling: 2,
      peeling: 1,
      painStinging: 3,
      swelling: 6,
    },
    warnings: createEmptyWarnings(),
    lifestyle: createEmptyLifestyle(),
    care: createEmptyCare(),
    medications: createEmptyMedications(),
    humira: createEmptyHumira(),
    photos: [],
    memo: '',
    createdAt: '2026-07-20T00:30:00.000Z',
    updatedAt: '2026-07-20T00:30:00.000Z',
  };
  return { ...base, ...overrides };
}

describe('symptom score utilities', () => {
  it('calculates the overall symptom average from seven scores', () => {
    expect(calculateSymptomAverage(makeRecord().symptomScores)).toBe(4);
  });
});

describe('date utilities', () => {
  it('filters records by date range and area', () => {
    const record = makeRecord({ date: '2026-07-20', areas: ['두피', '목 뒤'] });
    expect(isRecordInDateRange(record, { startDate: '2026-07-01', endDate: '2026-07-31', area: '두피' })).toBe(true);
    expect(isRecordInDateRange(record, { startDate: '2026-07-21', endDate: '2026-07-31', area: '' })).toBe(false);
    expect(isRecordInDateRange(record, { startDate: '', endDate: '', area: '왼쪽 눈' })).toBe(false);
  });

  it('calculates the next expected Humira injection date', () => {
    expect(getNextHumiraDate('2026-07-01')).toBe('2026-07-22');
    expect(daysBetween('2026-07-01', '2026-07-22')).toBe(21);
  });
});

describe('storage validation', () => {
  it('validates the stored app data structure', () => {
    const data: AppData = { ...createEmptyData(), records: [makeRecord()] };
    expect(validateAppData(data).ok).toBe(true);
    expect(validateAppData({ ...data, records: [{ id: 1 }] }).ok).toBe(false);
  });

  it('rejects records with missing lifestyle fields', () => {
    const record = makeRecord();
    const data: AppData = { ...createEmptyData(), records: [{ ...record, lifestyle: { previousNightSleepHours: 7 } } as DermatitisRecord] };
    expect(validateAppData(data).ok).toBe(false);
  });

  it('normalizes old records without photos', () => {
    const { photos: _photos, ...recordWithoutPhotos } = makeRecord();
    const data = { ...createEmptyData(), records: [recordWithoutPhotos] };
    const result = validateAppData(data);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.records[0]?.photos).toEqual([]);
  });

  it('validates wound photos on records', () => {
    const data: AppData = {
      ...createEmptyData(),
      records: [
        makeRecord({
          photos: [{
            id: 'photo-1',
            dataUrl: 'data:image/jpeg;base64,AAAA',
            mimeType: 'image/jpeg',
            name: 'wound.jpg',
            caption: 'left eye',
            createdAt: '2026-07-20T00:30:00.000Z',
          }],
        }),
      ],
    };

    expect(validateAppData(data).ok).toBe(true);
    expect(validateAppData({ ...data, records: [makeRecord({ photos: [{ id: 'photo-2', dataUrl: '/api/photos/photo-2.jpg', mimeType: 'image/jpeg', name: 'wound.jpg', caption: 'left eye', createdAt: '2026-07-20T00:30:00.000Z' }] })] }).ok).toBe(true);
    expect(validateAppData({ ...data, records: [makeRecord({ photos: [{ id: 'bad', dataUrl: 'not-image', mimeType: 'text/plain', name: '', caption: '', createdAt: '' }] })] }).ok).toBe(false);
  });

  it('saves and loads data through localStorage', () => {
    const data: AppData = { ...createEmptyData(), records: [makeRecord({ id: 'saved-record' })] };
    saveAppData(data);
    expect(loadAppData().records).toHaveLength(1);
    expect(loadAppData().records[0]?.id).toBe('saved-record');
  });

  it('migrates local records when the server store is empty', async () => {
    const data: AppData = { ...createEmptyData(), records: [makeRecord({ id: 'local-record' })] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(createEmptyData()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(data), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    saveAppData(data);

    const loaded = await loadPersistedAppData();

    expect(loaded.serverBacked).toBe(true);
    expect(loaded.data.records[0]?.id).toBe('local-record');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/data',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
  });
});

describe('id utilities', () => {
  it('creates a record id', () => {
    expect(createId()).toMatch(/\S+/);
  });
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});
