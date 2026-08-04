import { useMemo, useState } from 'react';
import type { DermatitisRecord } from '../types/record';
import { getUsedMedicationLabels } from '../utils/labels';
import { average, calculateSymptomAverage, getWorstSymptomDate } from '../utils/scores';

type Period = 7 | 30;

export function StatsPage({ records }: { records: DermatitisRecord[] }) {
  const [period, setPeriod] = useState<Period>(7);
  const filtered = useMemo(() => filterRecentRecords(records, period), [records, period]);
  const trend = useMemo(() => buildDailyTrend(filtered), [filtered]);
  const avgItching = average(filtered.map((record) => record.symptomScores.itching));
  const avgSymptom = average(filtered.map((record) => calculateSymptomAverage(record.symptomScores)));
  const avgSleep = average(filtered.map((record) => record.lifestyle.previousNightSleepHours));
  const avgFatigue = average(filtered.map((record) => record.lifestyle.fatigue));
  const avgStress = average(filtered.map((record) => record.lifestyle.stress));
  const humiraDates = filtered.filter((record) => record.humira.used).map((record) => record.humira.actualInjectionDate || record.date);
  const medicationDates = filtered.filter((record) => getUsedMedicationLabels(record).length > 0).map((record) => record.date);
  const pattern = filtered.length >= 5 ? buildPatternText(filtered) : '';

  return (
    <section className="page-grid" aria-labelledby="stats-heading">
      <div className="section-card hero-card">
        <div>
          <p className="eyebrow">통계</p>
          <h2 id="stats-heading">최근 기록 요약</h2>
        </div>
        <div className="segmented" role="group" aria-label="기간 선택">
          <button type="button" className={period === 7 ? 'active' : ''} onClick={() => setPeriod(7)}>7일</button>
          <button type="button" className={period === 30 ? 'active' : ''} onClick={() => setPeriod(30)}>30일</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="기록 수" value={`${filtered.length}개`} />
        <StatCard label="평균 가려움" value={formatScore(avgItching)} />
        <StatCard label="전체 평균 증상" value={formatScore(avgSymptom)} />
        <StatCard label="평균 수면시간" value={avgSleep === null ? '-' : `${avgSleep}시간`} />
        <StatCard label="평균 피로도" value={formatScore(avgFatigue)} />
        <StatCard label="평균 스트레스" value={formatScore(avgStress)} />
      </div>

      <div className="section-card">
        <h3>핵심 날짜</h3>
        <p><strong>증상이 가장 심했던 날짜</strong> {getWorstSymptomDate(filtered)}</p>
        <p><strong>휴미라 투여 날짜</strong> {unique(humiraDates).join(', ') || '-'}</p>
        <p><strong>약을 사용한 날짜</strong> {unique(medicationDates).join(', ') || '-'}</p>
      </div>

      <div className="section-card">
        <h3>날짜별 점수 추이</h3>
        {trend.length === 0 ? <p className="empty-state compact-empty">통계를 표시할 기록이 없습니다.</p> : <TrendChart trend={trend} />}
      </div>

      {pattern && <p className="pattern-note">{pattern}</p>}
    </section>
  );
}

function filterRecentRecords(records: DermatitisRecord[], period: Period): DermatitisRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period + 1);
  const cutoffText = cutoff.toISOString().slice(0, 10);
  return records.filter((record) => record.date >= cutoffText);
}

function buildDailyTrend(records: DermatitisRecord[]): Array<{ date: string; itching: number; averageScore: number }> {
  const grouped = new Map<string, DermatitisRecord[]>();
  for (const record of records) grouped.set(record.date, [...(grouped.get(record.date) ?? []), record]);
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dayRecords]) => ({
    date,
    itching: average(dayRecords.map((record) => record.symptomScores.itching)) ?? 0,
    averageScore: average(dayRecords.map((record) => calculateSymptomAverage(record.symptomScores))) ?? 0,
  }));
}

function TrendChart({ trend }: { trend: Array<{ date: string; itching: number; averageScore: number }> }) {
  const width = 320;
  const height = 160;
  const points = trend.map((item, index) => {
    const x = trend.length === 1 ? width / 2 : (index / (trend.length - 1)) * width;
    return { x, itchY: height - (item.itching / 10) * height, avgY: height - (item.averageScore / 10) * height, item };
  });
  const itchLine = points.map((point) => `${point.x},${point.itchY}`).join(' ');
  const avgLine = points.map((point) => `${point.x},${point.avgY}`).join(' ');
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="날짜별 가려움 및 평균 증상 점수 추이">
        <polyline points={itchLine} fill="none" stroke="#d65d3a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={avgLine} fill="none" stroke="#2f8f68" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => <circle key={`${point.item.date}-itch`} cx={point.x} cy={point.itchY} r="4" fill="#d65d3a" />)}
        {points.map((point) => <circle key={`${point.item.date}-avg`} cx={point.x} cy={point.avgY} r="4" fill="#2f8f68" />)}
      </svg>
      <div className="chart-legend"><span className="itch-dot">가려움</span><span className="avg-dot">전체 평균</span></div>
      <div className="mini-trend-list">{trend.map((item) => <span key={item.date}>{item.date.slice(5)} · 가려움 {item.itching} / 평균 {item.averageScore}</span>)}</div>
    </div>
  );
}

function buildPatternText(records: DermatitisRecord[]): string {
  const lowSleep = records.filter((record) => record.lifestyle.previousNightSleepHours < 6);
  const enoughSleep = records.filter((record) => record.lifestyle.previousNightSleepHours >= 6);
  const lowSleepAverage = average(lowSleep.map((record) => calculateSymptomAverage(record.symptomScores)));
  const enoughSleepAverage = average(enoughSleep.map((record) => calculateSymptomAverage(record.symptomScores)));
  if (lowSleepAverage !== null && enoughSleepAverage !== null && lowSleepAverage > enoughSleepAverage) {
    return '기록된 데이터에서는 수면시간이 짧은 날에 증상 점수가 높게 나타났습니다. 기록 수가 적으면 우연일 수 있습니다.';
  }
  const highStress = records.filter((record) => record.lifestyle.stress >= 7);
  const lowerStress = records.filter((record) => record.lifestyle.stress < 7);
  const highStressAverage = average(highStress.map((record) => calculateSymptomAverage(record.symptomScores)));
  const lowerStressAverage = average(lowerStress.map((record) => calculateSymptomAverage(record.symptomScores)));
  if (highStressAverage !== null && lowerStressAverage !== null && highStressAverage > lowerStressAverage) {
    return '기록된 데이터에서는 스트레스가 높은 날에 증상 점수가 높게 나타났습니다. 기록 수가 적으면 우연일 수 있습니다.';
  }
  return '기록된 데이터에서 뚜렷한 생활 패턴 차이는 보이지 않습니다. 기록 수가 적으면 우연일 수 있습니다.';
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="section-card stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function formatScore(value: number | null): string {
  return value === null ? '-' : `${value}점`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
