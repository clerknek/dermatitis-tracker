import type { BodyArea, DateRangeFilter, DermatitisRecord } from '../types/record';

const SEOUL_TIME_ZONE = 'Asia/Seoul';

export function getSeoulDateTimeParts(date = new Date()): { date: string; time: string; iso: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`,
    iso: date.toISOString(),
  };
}

export function todayInSeoul(): string {
  return getSeoulDateTimeParts().date;
}

export function addDays(dateString: string, days: number): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startDate: string, endDate = todayInSeoul()): number | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.floor((end - start) / 86_400_000);
}

export function getNextHumiraDate(actualInjectionDate: string, intervalDays = 21): string {
  return actualInjectionDate ? addDays(actualInjectionDate, intervalDays) : '';
}

export function isRecordInDateRange(record: DermatitisRecord, filter: DateRangeFilter): boolean {
  if (filter.startDate && record.date < filter.startDate) return false;
  if (filter.endDate && record.date > filter.endDate) return false;
  if (filter.area && !record.areas.includes(filter.area as BodyArea)) return false;
  return true;
}

export function sortRecordsNewestFirst(records: DermatitisRecord[]): DermatitisRecord[] {
  return [...records].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}
