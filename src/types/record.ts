export const STORAGE_VERSION = 1;

export const BODY_AREAS = [
  '눈 주위',
  '왼쪽 눈',
  '오른쪽 눈',
  '양쪽 눈',
  '뒤통수',
  '목 뒤',
  '두피',
  '기타',
] as const;

export const SYMPTOM_KEYS = [
  'itching',
  'redness',
  'dryness',
  'scaling',
  'peeling',
  'painStinging',
  'swelling',
] as const;

export const WARNING_KEYS = [
  'oozing',
  'yellowCrust',
  'pus',
  'heat',
  'eyePain',
  'photophobia',
  'blurredVision',
] as const;

export const MEDICATION_KEYS = [
  'elidel',
  'maxidex',
  'whitePetrolatum',
  'occipitalLiquid',
  'otherMedication',
] as const;

export type BodyArea = (typeof BODY_AREAS)[number];
export type SymptomKey = (typeof SYMPTOM_KEYS)[number];
export type WarningKey = (typeof WARNING_KEYS)[number];
export type MedicationKey = (typeof MEDICATION_KEYS)[number];

export type SymptomScores = Record<SymptomKey, number>;
export type WarningSigns = Record<WarningKey, boolean>;
export type MedicationUsage = Record<MedicationKey, boolean>;

export interface LifestyleLog {
  previousNightSleepHours: number;
  sleepSatisfaction: number;
  fatigue: number;
  stress: number;
  longScreenTime: boolean;
  exercised: boolean;
  sweatedMuch: boolean;
  hotWaterWash: boolean;
  alcohol: boolean;
  lateSnack: boolean;
  longOutdoorTime: boolean;
  dryIndoorAir: boolean;
  seasonalChange: boolean;
  rubbedOrScratched: boolean;
}

export interface CareLog {
  washedHair: boolean;
  shampooName: string;
  cleanserName: string;
  newProductUsed: boolean;
  moisturizerUsed: boolean;
  whitePetrolatumUsed: boolean;
}

export interface HumiraLog {
  used: boolean;
  actualInjectionDate: string;
  daysSinceLastInjection: number | null;
  nextExpectedInjectionDate: string;
}

export interface DermatitisRecord {
  id: string;
  date: string;
  time: string;
  areas: BodyArea[];
  symptomScores: SymptomScores;
  warnings: WarningSigns;
  lifestyle: LifestyleLog;
  care: CareLog;
  medications: MedicationUsage;
  humira: HumiraLog;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  humiraIntervalDays: number;
}

export interface AppData {
  storageVersion: number;
  settings: AppSettings;
  records: DermatitisRecord[];
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
  area: BodyArea | '';
}
