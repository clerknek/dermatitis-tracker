import { MEDICATION_KEYS, SYMPTOM_KEYS } from '../types/record';
import type { CareLog, DermatitisRecord, LifestyleLog, MedicationKey, WarningKey } from '../types/record';

export const SYMPTOM_LABELS: Record<(typeof SYMPTOM_KEYS)[number], string> = {
  itching: '가려움',
  redness: '붉어짐',
  dryness: '건조함',
  scaling: '각질',
  peeling: '피부 벗겨짐',
  painStinging: '통증 또는 따가움',
  swelling: '부기',
};

export const WARNING_LABELS: Record<WarningKey, string> = {
  oozing: '진물',
  yellowCrust: '노란 딱지',
  pus: '고름',
  heat: '열감',
  eyePain: '눈 통증',
  photophobia: '눈부심',
  blurredVision: '시야 흐림',
};

export const MEDICATION_LABELS: Record<MedicationKey, string> = {
  elidel: '엘리델',
  maxidex: '멕시덱스',
  whitePetrolatum: '백색 바세린',
  occipitalLiquid: '뒤통수 액체약',
  otherMedication: '기타 약',
};

export const LIFESTYLE_BOOLEAN_LABELS: Record<BooleanKeys<LifestyleLog>, string> = {
  longScreenTime: '화면 오래 봄',
  exercised: '운동',
  sweatedMuch: '땀 많이 흘림',
  hotWaterWash: '뜨거운 물 세안/샤워',
  alcohol: '음주',
  lateSnack: '야식',
  longOutdoorTime: '긴 외출',
  dryIndoorAir: '건조한 실내',
  seasonalChange: '환절기',
  rubbedOrScratched: '비비거나 긁음',
};

export const CARE_BOOLEAN_LABELS: Record<BooleanKeys<CareLog>, string> = {
  washedHair: '머리 감음',
  newProductUsed: '새 제품 사용',
  moisturizerUsed: '보습제 사용',
  whitePetrolatumUsed: '백색 바세린 사용',
};

export function getUsedMedicationLabels(record: DermatitisRecord): string[] {
  return MEDICATION_KEYS.filter((key) => record.medications[key]).map((key) => MEDICATION_LABELS[key]);
}

export function getActiveLabels<T extends object>(values: T, labels: Record<BooleanKeys<T>, string>): string[] {
  return (Object.entries(labels) as Array<[keyof T, string]>).filter(([key]) => Boolean(values[key])).map(([, label]) => label);
}

export function hasMedicalNoticeWarning(record: Pick<DermatitisRecord, 'warnings'>): boolean {
  return record.warnings.oozing || record.warnings.pus || record.warnings.eyePain || record.warnings.photophobia || record.warnings.blurredVision;
}

type BooleanKeys<T> = { [Key in keyof T]: T[Key] extends boolean ? Key : never }[keyof T];
