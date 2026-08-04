import { useMemo, useState } from 'react';
import { BODY_AREAS } from '../types/record';
import type { BodyArea, DateRangeFilter, DermatitisRecord } from '../types/record';
import { isRecordInDateRange } from '../utils/dates';
import { MEDICATION_LABELS, getUsedMedicationLabels } from '../utils/labels';
import { calculateSymptomAverage } from '../utils/scores';

interface ListPageProps {
  records: DermatitisRecord[];
  onEdit: (record: DermatitisRecord) => void;
  onDelete: (id: string) => void;
}

const emptyFilter: DateRangeFilter = { startDate: '', endDate: '', area: '' };

export function ListPage({ records, onEdit, onDelete }: ListPageProps) {
  const [filter, setFilter] = useState<DateRangeFilter>(emptyFilter);
  const [openId, setOpenId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => records.filter((record) => isRecordInDateRange(record, filter)), [records, filter]);

  function confirmDelete(record: DermatitisRecord) {
    const ok = window.confirm(`${record.date} ${record.time} 기록을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.`);
    if (ok) onDelete(record.id);
  }

  return (
    <section className="page-grid" aria-labelledby="list-heading">
      <div className="section-card hero-card">
        <div>
          <p className="eyebrow">기록 목록</p>
          <h2 id="list-heading">최신 기록순으로 확인</h2>
        </div>
        <span className="count-pill">{filteredRecords.length}개</span>
      </div>

      <div className="section-card form-grid">
        <label>시작일<input type="date" value={filter.startDate} onChange={(event) => setFilter((current) => ({ ...current, startDate: event.target.value }))} /></label>
        <label>종료일<input type="date" value={filter.endDate} onChange={(event) => setFilter((current) => ({ ...current, endDate: event.target.value }))} /></label>
        <label>증상 부위<select value={filter.area} onChange={(event) => setFilter((current) => ({ ...current, area: event.target.value as BodyArea | '' }))}>
          <option value="">전체</option>
          {BODY_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
        </select></label>
        <button type="button" className="secondary-button align-end" onClick={() => setFilter(emptyFilter)}>필터 초기화</button>
      </div>

      {filteredRecords.length === 0 && <p className="empty-state">아직 표시할 기록이 없습니다. 오늘 기록 화면에서 첫 기록을 저장해 보세요.</p>}

      <div className="record-list">
        {filteredRecords.map((record) => {
          const average = calculateSymptomAverage(record.symptomScores);
          const medications = getUsedMedicationLabels(record);
          const isOpen = openId === record.id;
          return (
            <article className="section-card record-card" key={record.id}>
              <header className="record-header">
                <div>
                  <h3>{record.date} {record.time}</h3>
                  <p>{record.areas.join(', ')}</p>
                </div>
                <div className="score-stack">
                  <span>가려움 {record.symptomScores.itching}점</span>
                  <strong>평균 {average}점</strong>
                </div>
              </header>
              <dl className="summary-grid">
                <div><dt>사용한 약</dt><dd>{medications.length > 0 ? medications.join(', ') : '없음'}</dd></div>
                <div><dt>휴미라</dt><dd>{record.humira.used ? `투여 (${record.humira.actualInjectionDate || '날짜 미입력'})` : '투여 안 함'}</dd></div>
              </dl>
              {isOpen && (
                <div className="detail-box">
                  <p><strong>메모</strong> {record.memo || '없음'}</p>
                  <p><strong>샴푸</strong> {record.care.shampooName || '-'} · <strong>세안제</strong> {record.care.cleanserName || '-'}</p>
                  <p><strong>수면</strong> {record.lifestyle.previousNightSleepHours}시간 · <strong>피로</strong> {record.lifestyle.fatigue}점 · <strong>스트레스</strong> {record.lifestyle.stress}점</p>
                  <p><strong>다음 휴미라 예상일</strong> {record.humira.nextExpectedInjectionDate || '-'}</p>
                  <p><strong>약 항목</strong> {Object.entries(record.medications).filter(([, used]) => used).map(([key]) => MEDICATION_LABELS[key as keyof typeof MEDICATION_LABELS]).join(', ') || '없음'}</p>
                </div>
              )}
              <div className="inline-actions right">
                <button type="button" className="secondary-button" onClick={() => setOpenId(isOpen ? null : record.id)}>{isOpen ? '상세 닫기' : '상세 보기'}</button>
                <button type="button" className="secondary-button" onClick={() => onEdit(record)}>수정</button>
                <button type="button" className="danger-button" onClick={() => confirmDelete(record)}>삭제</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
