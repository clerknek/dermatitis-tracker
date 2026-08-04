import { useEffect, useState } from 'react';
import { BODY_AREAS, MEDICATION_KEYS, SYMPTOM_KEYS, WARNING_KEYS } from '../types/record';
import type { AppSettings, BodyArea, CareLog, DermatitisRecord, LifestyleLog, MedicationKey, SymptomKey, WarningKey } from '../types/record';
import { getSeoulDateTimeParts, getNextHumiraDate, daysBetween } from '../utils/dates';
import { createId } from '../utils/id';
import { MEDICATION_LABELS, SYMPTOM_LABELS, WARNING_LABELS, hasMedicalNoticeWarning } from '../utils/labels';
import { calculateSymptomAverage, getSeverityLabel } from '../utils/scores';
import { createEmptyCare, createEmptyHumira, createEmptyLifestyle, createEmptyMedications, createEmptyScores, createEmptyWarnings } from '../storage/appStorage';

interface TodayPageProps {
  editingRecord: DermatitisRecord | null;
  settings: AppSettings;
  onSave: (record: DermatitisRecord) => void;
  onCancelEdit: () => void;
}

function createDraft(editingRecord: DermatitisRecord | null): DermatitisRecord {
  if (editingRecord) return structuredClone(editingRecord);
  const now = getSeoulDateTimeParts();
  return {
    id: createId(),
    date: now.date,
    time: now.time,
    areas: [],
    symptomScores: createEmptyScores(),
    warnings: createEmptyWarnings(),
    lifestyle: createEmptyLifestyle(),
    care: createEmptyCare(),
    medications: createEmptyMedications(),
    humira: createEmptyHumira(),
    memo: '',
    createdAt: now.iso,
    updatedAt: now.iso,
  } satisfies DermatitisRecord;
}

export function TodayPage({ editingRecord, settings, onSave, onCancelEdit }: TodayPageProps) {
  const [draft, setDraft] = useState<DermatitisRecord>(() => createDraft(editingRecord));
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDraft(createDraft(editingRecord));
    setStatus(null);
    setShowMore(Boolean(editingRecord));
  }, [editingRecord, settings]);

  const symptomAverage = calculateSymptomAverage(draft.symptomScores);
  const severity = getSeverityLabel(symptomAverage);
  const showNotice = hasMedicalNoticeWarning(draft);

  function updateScore(key: SymptomKey, value: number) {
    setDraft((current) => ({ ...current, symptomScores: { ...current.symptomScores, [key]: value } }));
  }

  function updateWarning(key: WarningKey, value: boolean) {
    setDraft((current) => ({ ...current, warnings: { ...current.warnings, [key]: value } }));
  }

  function updateMedication(key: MedicationKey, value: boolean) {
    setDraft((current) => ({ ...current, medications: { ...current.medications, [key]: value } }));
  }

  function updateLifestyle<Key extends keyof LifestyleLog>(key: Key, value: LifestyleLog[Key]) {
    setDraft((current) => ({ ...current, lifestyle: { ...current.lifestyle, [key]: value } }));
  }

  function updateCare<Key extends keyof CareLog>(key: Key, value: CareLog[Key]) {
    setDraft((current) => ({ ...current, care: { ...current.care, [key]: value } }));
  }

  function updateLifestyleBoolean(key: BooleanKeys<LifestyleLog>, value: boolean) {
    setDraft((current) => ({ ...current, lifestyle: { ...current.lifestyle, [key]: value } }));
  }

  function updateCareBoolean(key: BooleanKeys<CareLog>, value: boolean) {
    setDraft((current) => ({ ...current, care: { ...current.care, [key]: value } }));
  }

  function toggleArea(area: BodyArea) {
    setDraft((current) => ({
      ...current,
      areas: current.areas.includes(area) ? current.areas.filter((item) => item !== area) : [...current.areas, area],
    }));
  }

  function updateHumiraDate(actualInjectionDate: string) {
    setDraft((current) => ({
      ...current,
      humira: {
        ...current.humira,
        actualInjectionDate,
        daysSinceLastInjection: daysBetween(actualInjectionDate, current.date),
        nextExpectedInjectionDate: getNextHumiraDate(actualInjectionDate, settings.humiraIntervalDays),
      },
    }));
  }

  function handleSave() {
    if (!draft.date || !draft.time) {
      setStatus({ type: 'error', text: '기록 날짜와 시간을 입력해 주세요.' });
      return;
    }
    if (draft.areas.length === 0) {
      setStatus({ type: 'error', text: '증상 발생 부위를 하나 이상 선택해 주세요.' });
      return;
    }
    const now = getSeoulDateTimeParts();
    const record: DermatitisRecord = {
      ...draft,
      humira: {
        ...draft.humira,
        daysSinceLastInjection: daysBetween(draft.humira.actualInjectionDate, draft.date),
        nextExpectedInjectionDate: getNextHumiraDate(draft.humira.actualInjectionDate, settings.humiraIntervalDays),
      },
      updatedAt: now.iso,
    };
    onSave(record);
    setDraft(createDraft(null));
    setStatus({ type: 'success', text: editingRecord ? '기록을 수정했습니다.' : '기록을 저장했습니다.' });
    setShowMore(false);
  }

  return (
    <section className="page-grid" aria-labelledby="today-heading">
      <div className="section-card hero-card">
        <div>
          <p className="eyebrow">오늘 기록</p>
          <h2 id="today-heading">증상과 생활 패턴을 남겨두세요</h2>
        </div>
        <span className={`severity-badge ${severity.className}`}>{severity.label} · 평균 {symptomAverage}점</span>
      </div>

      {status && <p className={`status-message ${status.type}`}>{status.text}</p>}
      {editingRecord && (
        <div className="inline-actions">
          <span>기존 기록을 수정 중입니다.</span>
          <button type="button" className="secondary-button" onClick={onCancelEdit}>수정 취소</button>
        </div>
      )}

      <div className="section-card form-grid">
        <label>
          기록 날짜
          <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
        </label>
        <label>
          기록 시간
          <input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} />
        </label>
      </div>

      <fieldset className="section-card">
        <legend>증상 발생 부위</legend>
        <div className="chip-grid">
          {BODY_AREAS.map((area) => (
            <label className="check-chip" key={area}>
              <input type="checkbox" checked={draft.areas.includes(area)} onChange={() => toggleArea(area)} />
              {area}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="section-card">
        <legend>증상 점수</legend>
        <div className="slider-list">
          {SYMPTOM_KEYS.map((key) => (
            <label className="slider-row" key={key}>
              <span>{SYMPTOM_LABELS[key]}</span>
              <input type="range" min="0" max="10" value={draft.symptomScores[key]} onChange={(event) => updateScore(key, Number(event.target.value))} />
              <strong>{draft.symptomScores[key]}점</strong>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="section-card">
        <legend>주의 증상</legend>
        <div className="chip-grid">
          {WARNING_KEYS.map((key) => (
            <label className="check-chip" key={key}>
              <input type="checkbox" checked={draft.warnings[key]} onChange={(event) => updateWarning(key, event.target.checked)} />
              {WARNING_LABELS[key]}
            </label>
          ))}
        </div>
        {showNotice && <p className="medical-notice">감염 또는 안과 질환 가능성이 있으므로 휴미라 사용 사실을 알리고 의료진에게 문의하세요.</p>}
      </fieldset>

      <button type="button" className="wide-button" onClick={() => setShowMore((value) => !value)}>
        {showMore ? '추가 항목 닫기' : '추가 항목 보기'}
      </button>

      {showMore && (
        <>
          <fieldset className="section-card">
            <legend>생활 패턴</legend>
            <div className="form-grid">
              <label>전날 수면시간<input type="number" min="0" max="24" step="0.5" value={draft.lifestyle.previousNightSleepHours} onChange={(event) => updateLifestyle('previousNightSleepHours', Number(event.target.value))} /></label>
              <ScoreInput label="수면 만족도" value={draft.lifestyle.sleepSatisfaction} onChange={(value) => updateLifestyle('sleepSatisfaction', value)} />
              <ScoreInput label="피로도" value={draft.lifestyle.fatigue} onChange={(value) => updateLifestyle('fatigue', value)} />
              <ScoreInput label="스트레스" value={draft.lifestyle.stress} onChange={(value) => updateLifestyle('stress', value)} />
            </div>
            <BooleanGrid items={[
              ['longScreenTime', '화면을 오래 봤는지'], ['exercised', '운동 여부'], ['sweatedMuch', '땀을 많이 흘렸는지'], ['hotWaterWash', '뜨거운 물로 씻었는지'], ['alcohol', '음주 여부'], ['lateSnack', '야식 여부'], ['longOutdoorTime', '외출 시간이 길었는지'], ['dryIndoorAir', '실내가 건조했는지'], ['seasonalChange', '환절기라고 느끼는지'], ['rubbedOrScratched', '눈이나 피부를 비비거나 긁었는지'],
            ] as Array<[BooleanKeys<LifestyleLog>, string]>} values={draft.lifestyle} onChange={updateLifestyleBoolean} />
          </fieldset>

          <fieldset className="section-card">
            <legend>피부 및 두피 관리</legend>
            <div className="form-grid">
              <label>사용한 샴푸 이름<input type="text" value={draft.care.shampooName} onChange={(event) => updateCare('shampooName', event.target.value)} /></label>
              <label>세안제 이름<input type="text" value={draft.care.cleanserName} onChange={(event) => updateCare('cleanserName', event.target.value)} /></label>
            </div>
            <BooleanGrid items={[
              ['washedHair', '머리를 감았는지'], ['newProductUsed', '새로운 샴푸, 세제 또는 생활용품 사용'], ['moisturizerUsed', '보습제 사용 여부'], ['whitePetrolatumUsed', '백색 바세린 사용 여부'],
            ] as Array<[BooleanKeys<CareLog>, string]>} values={draft.care} onChange={updateCareBoolean} />
          </fieldset>

          <fieldset className="section-card">
            <legend>약 사용 기록</legend>
            <p className="help-text">약은 처방받은 방법에 따라 사용하고, 이 앱에서는 사용 여부만 기록합니다.</p>
            <div className="chip-grid">
              {MEDICATION_KEYS.map((key) => (
                <label className="check-chip" key={key}>
                  <input type="checkbox" checked={draft.medications[key]} onChange={(event) => updateMedication(key, event.target.checked)} />
                  {MEDICATION_LABELS[key]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="section-card">
            <legend>휴미라 기록</legend>
            <label className="check-chip single"><input type="checkbox" checked={draft.humira.used} onChange={(event) => setDraft((current) => ({ ...current, humira: { ...current.humira, used: event.target.checked } }))} />휴미라 투여 여부</label>
            <div className="form-grid">
              <label>실제 투여 날짜<input type="date" value={draft.humira.actualInjectionDate} onChange={(event) => updateHumiraDate(event.target.value)} /></label>
              <label>마지막 투여일로부터 경과 일수<input type="text" readOnly value={draft.humira.daysSinceLastInjection === null ? '-' : `${draft.humira.daysSinceLastInjection}일`} /></label>
              <label>다음 예상 투여일<input type="text" readOnly value={draft.humira.nextExpectedInjectionDate || '-'} /></label>
            </div>
          </fieldset>

          <label className="section-card memo-field">자유 메모<textarea value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} rows={5} /></label>
        </>
      )}

      <button type="button" className="primary-button" onClick={handleSave}>{editingRecord ? '수정 저장' : '기록 저장'}</button>
    </section>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="slider-row compact">
      <span>{label}</span>
      <input type="range" min="0" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{value}점</strong>
    </label>
  );
}

type BooleanKeys<T> = { [Key in keyof T]: T[Key] extends boolean ? Key : never }[keyof T];

function BooleanGrid<T extends object>({ items, values, onChange }: { items: Array<[BooleanKeys<T>, string]>; values: T; onChange: (key: BooleanKeys<T>, value: boolean) => void }) {
  return (
    <div className="chip-grid">
      {items.map(([key, label]) => (
        <label className="check-chip" key={String(key)}>
          <input type="checkbox" checked={Boolean(values[key])} onChange={(event) => onChange(key, event.target.checked)} />
          {label}
        </label>
      ))}
    </div>
  );
}



