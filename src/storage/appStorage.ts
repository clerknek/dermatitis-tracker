import { BODY_AREAS, MEDICATION_KEYS, STORAGE_VERSION, SYMPTOM_KEYS, WARNING_KEYS } from '../types/record';
import type { AppData, AppSettings, BodyArea, CareLog, DermatitisRecord, HumiraLog, LifestyleLog, MedicationUsage, SymptomScores, WarningSigns } from '../types/record';

const STORAGE_KEY = 'dermatitis-tracker:data';

export const defaultSettings: AppSettings = {
  humiraIntervalDays: 21,
};

export function createEmptyScores(): SymptomScores {
  return Object.fromEntries(SYMPTOM_KEYS.map((key) => [key, 0])) as SymptomScores;
}

export function createEmptyWarnings(): WarningSigns {
  return Object.fromEntries(WARNING_KEYS.map((key) => [key, false])) as WarningSigns;
}

export function createEmptyMedications(): MedicationUsage {
  return Object.fromEntries(MEDICATION_KEYS.map((key) => [key, false])) as MedicationUsage;
}

export function createEmptyLifestyle(): LifestyleLog {
  return {
    previousNightSleepHours: 7,
    sleepSatisfaction: 5,
    fatigue: 5,
    stress: 5,
    longScreenTime: false,
    exercised: false,
    sweatedMuch: false,
    hotWaterWash: false,
    alcohol: false,
    lateSnack: false,
    longOutdoorTime: false,
    dryIndoorAir: false,
    seasonalChange: false,
    rubbedOrScratched: false,
  };
}

export function createEmptyCare(): CareLog {
  return {
    washedHair: false,
    shampooName: '',
    cleanserName: '',
    newProductUsed: false,
    moisturizerUsed: false,
    whitePetrolatumUsed: false,
  };
}

export function createEmptyHumira(): HumiraLog {
  return {
    used: false,
    actualInjectionDate: '',
    daysSinceLastInjection: null,
    nextExpectedInjectionDate: '',
  };
}

export function createEmptyData(): AppData {
  return {
    storageVersion: STORAGE_VERSION,
    settings: defaultSettings,
    records: [],
  };
}

export function saveAppData(data: AppData, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAppData(storage: Storage = localStorage): AppData {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyData();
  try {
    const parsed: unknown = JSON.parse(raw);
    const validation = validateAppData(parsed);
    return validation.ok ? validation.data : createEmptyData();
  } catch {
    return createEmptyData();
  }
}

export function replaceRecords(records: DermatitisRecord[], storage: Storage = localStorage): AppData {
  const data = { ...loadAppData(storage), records };
  saveAppData(data, storage);
  return data;
}

export function validateAppData(value: unknown): { ok: true; data: AppData } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: 'JSON 최상위 구조가 올바르지 않습니다.' };
  if (value.storageVersion !== STORAGE_VERSION) return { ok: false, error: '지원하지 않는 저장소 버전입니다.' };
  if (!isObject(value.settings) || typeof value.settings.humiraIntervalDays !== 'number') {
    return { ok: false, error: 'settings 구조가 올바르지 않습니다.' };
  }
  if (!Array.isArray(value.records)) return { ok: false, error: 'records는 배열이어야 합니다.' };
  for (const record of value.records) {
    const result = validateRecord(record);
    if (!result.ok) return result;
  }
  return { ok: true, data: value as unknown as AppData };
}

export function validateRecord(value: unknown): { ok: true } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: '기록 항목 구조가 올바르지 않습니다.' };
  const strings = ['id', 'date', 'time', 'memo', 'createdAt', 'updatedAt'];
  if (!strings.every((key) => typeof value[key] === 'string')) return { ok: false, error: '기록의 기본 문자열 필드가 올바르지 않습니다.' };
  if (!Array.isArray(value.areas) || !value.areas.every((area) => BODY_AREAS.includes(area as BodyArea))) {
    return { ok: false, error: '증상 부위 값이 올바르지 않습니다.' };
  }
  if (!hasNumberMap(value.symptomScores, [...SYMPTOM_KEYS], 0, 10)) return { ok: false, error: '증상 점수 구조가 올바르지 않습니다.' };
  if (!hasBooleanMap(value.warnings, [...WARNING_KEYS])) return { ok: false, error: '주의 증상 구조가 올바르지 않습니다.' };
  if (!hasBooleanMap(value.medications, [...MEDICATION_KEYS])) return { ok: false, error: '약 사용 구조가 올바르지 않습니다.' };
  if (!isObject(value.lifestyle) || typeof value.lifestyle.previousNightSleepHours !== 'number') return { ok: false, error: '생활 패턴 구조가 올바르지 않습니다.' };
  if (!isObject(value.care) || typeof value.care.shampooName !== 'string' || typeof value.care.cleanserName !== 'string') return { ok: false, error: '관리 항목 구조가 올바르지 않습니다.' };
  if (!isObject(value.humira) || typeof value.humira.used !== 'boolean' || typeof value.humira.actualInjectionDate !== 'string') return { ok: false, error: '휴미라 기록 구조가 올바르지 않습니다.' };
  return { ok: true };
}

function hasNumberMap(value: unknown, keys: string[], min: number, max: number): boolean {
  return isObject(value) && keys.every((key) => typeof value[key] === 'number' && value[key] >= min && value[key] <= max);
}

function hasBooleanMap(value: unknown, keys: string[]): boolean {
  return isObject(value) && keys.every((key) => typeof value[key] === 'boolean');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

