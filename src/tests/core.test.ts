import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyCare, createEmptyData, createEmptyHumira, createEmptyLifestyle, createEmptyMedications, createEmptyWarnings, loadAppData, saveAppData, validateAppData } from '../storage/appStorage';
import type { AppData, DermatitisRecord } from '../types/record';
import { daysBetween, getNextHumiraDate, isRecordInDateRange } from '../utils/dates';
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

  it('saves and loads data through localStorage', () => {
    const data: AppData = { ...createEmptyData(), records: [makeRecord({ id: 'saved-record' })] };
    saveAppData(data);
    expect(loadAppData().records).toHaveLength(1);
    expect(loadAppData().records[0]?.id).toBe('saved-record');
  });
});

beforeEach(() => {
  localStorage.clear();
});
