import { useRef, useState } from 'react';
import { MEDICATION_KEYS, SYMPTOM_KEYS, WARNING_KEYS } from '../types/record';
import type { AppData, CareLog, DermatitisRecord, LifestyleLog } from '../types/record';
import { validateAppData, createEmptyData } from '../storage/appStorage';
import { calculateSymptomAverage } from '../utils/scores';

export function DataPage({ data, onReplaceData }: { data: AppData; onReplaceData: (data: AppData) => void }) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function exportJson() {
    try {
      const response = await fetch('/api/data?photos=inline', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Failed to export server data');
      const serverData: unknown = await response.json();
      const validation = validateAppData(serverData);
      if (!validation.ok) throw new Error(validation.error);
      downloadFile(`dermatitis-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(validation.data, null, 2), 'application/json');
    } catch {
      downloadFile(`dermatitis-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    }
    setMessage({ type: 'success', text: 'JSON 백업 파일을 내보냈습니다.' });
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validation = validateAppData(parsed);
      if (!validation.ok) {
        setMessage({ type: 'error', text: validation.error });
        return;
      }
      onReplaceData(validation.data);
      setMessage({ type: 'success', text: 'JSON 백업을 가져왔습니다.' });
    } catch {
      setMessage({ type: 'error', text: 'JSON 파일을 읽을 수 없습니다. 기존 데이터는 변경하지 않았습니다.' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function exportCsv() {
    const csv = buildCsv(data.records);
    downloadFile(`dermatitis-tracker-records-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
    setMessage({ type: 'success', text: 'CSV 파일을 내보냈습니다.' });
  }

  function deleteAll() {
    if (deleteText !== 'DELETE') {
      setMessage({ type: 'error', text: '전체 삭제를 하려면 DELETE를 정확히 입력해 주세요.' });
      return;
    }
    onReplaceData(createEmptyData());
    setDeleteText('');
    setMessage({ type: 'success', text: '전체 데이터를 삭제했습니다.' });
  }

  return (
    <section className="page-grid" aria-labelledby="data-heading">
      <div className="section-card hero-card">
        <div>
          <p className="eyebrow">데이터 관리</p>
          <h2 id="data-heading">백업, 복원, 삭제</h2>
        </div>
        <span className="count-pill">{data.records.length}개 기록</span>
      </div>

      {message && <p className={`status-message ${message.type}`}>{message.text}</p>}

      <div className="section-card action-card">
        <h3>내보내기</h3>
        <button type="button" className="primary-button" onClick={() => void exportJson()}>전체 데이터를 JSON 파일로 내보내기</button>
        <button type="button" className="secondary-button" onClick={exportCsv}>전체 기록을 CSV 파일로 내보내기</button>
      </div>

      <div className="section-card action-card">
        <h3>가져오기</h3>
        <p className="help-text">가져오기 전 저장 데이터 구조를 검증합니다. 잘못된 파일이면 기존 데이터를 변경하지 않습니다.</p>
        <label className="file-label">JSON 백업 파일 선택<input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0])} /></label>
      </div>

      <div className="section-card danger-zone">
        <h3>전체 데이터 삭제</h3>
        <p>삭제하려면 아래 입력칸에 DELETE를 직접 입력해 주세요.</p>
        <label>삭제 확인 문구<input type="text" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} /></label>
        <button type="button" className="danger-button" onClick={deleteAll}>전체 데이터 삭제</button>
      </div>

      <div className="section-card notice-card">
        <p>이 앱은 개인 증상 기록을 위한 도구이며 의학적 진단이나 치료를 제공하지 않습니다. 약은 처방받은 방법에 따라 사용하고, 증상이 악화되거나 눈 통증, 시야 변화, 진물, 고름, 발열 등이 나타나면 의료진에게 문의하세요.</p>
        <p>Docker 실행 환경에서는 입력 데이터가 SQLite 데이터베이스에 저장되며, 브라우저에는 백업 사본이 남습니다.</p>
      </div>
    </section>
  );
}

function buildCsv(records: DermatitisRecord[]): string {
  const lifestyleKeys: Array<keyof LifestyleLog> = [
    'previousNightSleepHours',
    'sleepSatisfaction',
    'fatigue',
    'stress',
    'longScreenTime',
    'exercised',
    'sweatedMuch',
    'hotWaterWash',
    'alcohol',
    'lateSnack',
    'longOutdoorTime',
    'dryIndoorAir',
    'seasonalChange',
    'rubbedOrScratched',
  ];
  const careKeys: Array<keyof CareLog> = ['washedHair', 'shampooName', 'cleanserName', 'newProductUsed', 'moisturizerUsed', 'whitePetrolatumUsed'];
  const header = [
    'id',
    'date',
    'time',
    'areas',
    ...SYMPTOM_KEYS,
    'symptomAverage',
    ...WARNING_KEYS.map((key) => `warning_${key}`),
    ...lifestyleKeys.map((key) => `lifestyle_${key}`),
    ...careKeys.map((key) => `care_${key}`),
    ...MEDICATION_KEYS.map((key) => `medication_${key}`),
    'humiraUsed',
    'humiraDate',
    'humiraDaysSinceLastInjection',
    'humiraNextExpectedInjectionDate',
    'weatherStatus',
    'weatherCapturedAt',
    'weatherSource',
    'weatherTemperatureC',
    'weatherApparentTemperatureC',
    'weatherHumidityPercent',
    'weatherPrecipitationMm',
    'weatherPressureHpa',
    'weatherWindSpeedMps',
    'weatherCode',
    'photoCount',
    'photoCaptions',
    'memo',
    'createdAt',
    'updatedAt',
  ];
  const rows = records.map((record) => [
    record.id,
    record.date,
    record.time,
    record.areas.join('|'),
    ...SYMPTOM_KEYS.map((key) => String(record.symptomScores[key])),
    String(calculateSymptomAverage(record.symptomScores)),
    ...WARNING_KEYS.map((key) => String(record.warnings[key])),
    ...lifestyleKeys.map((key) => String(record.lifestyle[key])),
    ...careKeys.map((key) => String(record.care[key])),
    ...MEDICATION_KEYS.map((key) => String(record.medications[key])),
    record.humira.used ? 'yes' : 'no',
    record.humira.actualInjectionDate,
    record.humira.daysSinceLastInjection === null ? '' : String(record.humira.daysSinceLastInjection),
    record.humira.nextExpectedInjectionDate,
    record.weather?.status ?? '',
    record.weather?.capturedAt ?? '',
    record.weather?.source ?? '',
    nullableCsv(record.weather?.temperatureC),
    nullableCsv(record.weather?.apparentTemperatureC),
    nullableCsv(record.weather?.humidityPercent),
    nullableCsv(record.weather?.precipitationMm),
    nullableCsv(record.weather?.pressureHpa),
    nullableCsv(record.weather?.windSpeedMps),
    nullableCsv(record.weather?.weatherCode),
    String(record.photos?.length ?? 0),
    (record.photos ?? []).map((photo) => photo.caption || photo.name).join('|'),
    record.memo,
    record.createdAt,
    record.updatedAt,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function nullableCsv(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
