import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { DataPage } from './pages/DataPage';
import { ListPage } from './pages/ListPage';
import { StatsPage } from './pages/StatsPage';
import { TodayPage } from './pages/TodayPage';
import { deletePersistedRecord, loadAppData, loadPersistedAppData, replacePersistedAppData, upsertPersistedRecord } from './storage/appStorage';
import type { AppData, DermatitisRecord } from './types/record';

type TabKey = 'today' | 'list' | 'stats' | 'data';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: '오늘 기록' },
  { key: 'list', label: '기록 목록' },
  { key: 'stats', label: '통계' },
  { key: 'data', label: '데이터 관리' },
];

function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [isServerBacked, setIsServerBacked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [editingRecord, setEditingRecord] = useState<DermatitisRecord | null>(null);

  useEffect(() => {
    let isActive = true;
    void loadPersistedAppData().then((loaded) => {
      if (!isActive) return;
      setData(loaded.data);
      setIsServerBacked(loaded.serverBacked);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const sortedRecords = useMemo(
    () => [...data.records].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)),
    [data.records],
  );

  async function upsertRecord(record: DermatitisRecord): Promise<{ serverBacked: boolean }> {
    setData((current) => {
      const exists = current.records.some((item) => item.id === record.id);
      return {
        ...current,
        records: exists ? current.records.map((item) => (item.id === record.id ? record : item)) : [...current.records, record],
      };
    });
    setEditingRecord(null);
    const result = await upsertPersistedRecord(record);
    setIsServerBacked(result.serverBacked);
    if (result.serverBacked) setData(result.data);
    return { serverBacked: result.serverBacked };
  }

  function deleteRecord(id: string) {
    setData((current) => ({ ...current, records: current.records.filter((record) => record.id !== id) }));
    void deletePersistedRecord(id).then((result) => {
      setIsServerBacked(result.serverBacked);
      if (result.serverBacked) setData(result.data);
    });
  }

  function startEdit(record: DermatitisRecord) {
    setEditingRecord(record);
    setActiveTab('today');
  }

  function replaceData(nextData: AppData) {
    setData(nextData);
    setEditingRecord(null);
    void replacePersistedAppData(nextData).then((result) => {
      setIsServerBacked(result.serverBacked);
      if (result.serverBacked) setData(result.data);
    });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">개인용 기록 도구</p>
          <h1>피부염 증상 기록</h1>
        </div>
        <p className="privacy-pill">{isServerBacked ? 'SQLite 저장' : '로컬 백업'}</p>
      </header>

      <nav className="tab-bar" aria-label="화면 이동">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.key ? 'tab-button active' : 'tab-button'}
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'today' && (
          <TodayPage
            editingRecord={editingRecord}
            onCancelEdit={() => setEditingRecord(null)}
            onSave={upsertRecord}
            settings={data.settings}
          />
        )}
        {activeTab === 'list' && <ListPage records={sortedRecords} onDelete={deleteRecord} onEdit={startEdit} />}
        {activeTab === 'stats' && <StatsPage records={data.records} />}
        {activeTab === 'data' && <DataPage data={data} onReplaceData={replaceData} />}
      </main>

      <footer className="app-footer">
        <p>이 앱은 개인 증상 기록을 위한 도구이며 의학적 진단이나 치료를 제공하지 않습니다. 약은 처방받은 방법에 따라 사용하고, 증상이 악화되거나 눈 통증, 시야 변화, 진물, 고름, 발열 등이 나타나면 의료진에게 문의하세요.</p>
        <p>Docker 실행 환경에서는 입력 데이터가 SQLite 데이터베이스에 저장되며, 브라우저에는 백업 사본이 남습니다.</p>
      </footer>
    </div>
  );
}

export default App;
