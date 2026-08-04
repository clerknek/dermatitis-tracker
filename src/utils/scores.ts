import { SYMPTOM_KEYS } from '../types/record';
import type { DermatitisRecord, SymptomScores } from '../types/record';

export function calculateSymptomAverage(scores: SymptomScores): number {
  const total = SYMPTOM_KEYS.reduce((sum, key) => sum + scores[key], 0);
  return roundToOneDecimal(total / SYMPTOM_KEYS.length);
}

export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getSeverityLabel(score: number): { label: string; className: 'low' | 'medium' | 'high' } {
  if (score >= 7) return { label: '심한 상태', className: 'high' };
  if (score >= 4) return { label: '중간 상태', className: 'medium' };
  return { label: '안정적인 상태', className: 'low' };
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function getWorstSymptomDate(records: DermatitisRecord[]): string {
  if (records.length === 0) return '-';
  const worst = records.reduce((current, record) =>
    calculateSymptomAverage(record.symptomScores) > calculateSymptomAverage(current.symptomScores) ? record : current,
  );
  return `${worst.date} (${calculateSymptomAverage(worst.symptomScores)}점)`;
}
