import { useEffect, useState } from 'react';
import { aircraftProfiles, type AircraftProfile } from './aircraftProfiles';
import { findAirport, makeFlightPlan, sampleFlightPlan, type Airport, type FlightPlan, type PlanMode, type PlanPhase } from './flightPlan';
import { formatEte } from './instrumentMath';

let airportPromise: Promise<Airport[]> | undefined;
function loadAirports() {
  airportPromise ??= fetch(`${import.meta.env.BASE_URL}airports.json`).then(response => {
    if (!response.ok) throw new Error('機場資料載入失敗');
    return response.json() as Promise<Airport[]>;
  });
  return airportPromise;
}

const phaseName: Record<PlanPhase, string> = {
  takeoff: '起飛', departure: '離場轉彎', climb: '爬升', cruise: '巡航',
  descent: '下降', arrival: '進場', base: '基線轉彎', final: '最後進場', landed: '已抵達'
};
const utc = (timeMs: number) => new Date(timeMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export function RoutePanel({ currentTimeMs, plan, aircraft, engaged, onAircraft, onCreate, onEngage, onRestart }: {
  currentTimeMs: number;
  plan: FlightPlan | null;
  aircraft: AircraftProfile;
  engaged: boolean;
  onAircraft: (profile: AircraftProfile) => void;
  onCreate: (plan: FlightPlan) => void;
  onEngage: (enabled: boolean) => void;
  onRestart: () => void;
}) {
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fromCode, setFromCode] = useState('JFK');
  const [toCode, setToCode] = useState('LHR');
  const [mode, setMode] = useState<PlanMode>('procedural');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadAirports().then(data => { if (active) setAirports(data); }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  const from = airports && findAirport(airports, fromCode);
  const to = airports && findAirport(airports, toCode);
  const status = plan ? sampleFlightPlan(plan, currentTimeMs) : null;
  const ready = Boolean(from && to && from !== to);
  const create = () => {
    if (!from || !to) { setError('請輸入有效且不同的 ICAO 或 IATA 機場代碼。'); return; }
    try {
      const next = makeFlightPlan(from, to, aircraft, mode, currentTimeMs);
      setError('');
      onCreate(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '航線無法建立。');
    }
  };

  return <div className="panel-scroll route-panel">
    <div className="route-title">FLIGHT PLAN <span>ICAO / IATA</span></div>
    <p className="route-intro">輸入機場代碼，選擇機型與航線模式。起飛後自動駕駛會沿計畫航跡更新航向、地速與高度。</p>
    <div className="route-airports">
      <label>起點機場<input aria-label="起點機場代碼" maxLength={4} value={fromCode} onChange={event => setFromCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ICAO / IATA"/><small>{from ? `${from.n} · ${from.c || from.i}` : airports ? '找不到機場' : '載入機場資料中…'}</small></label>
      <span className="route-arrow">→</span>
      <label>終點機場<input aria-label="終點機場代碼" maxLength={4} value={toCode} onChange={event => setToCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ICAO / IATA"/><small>{to ? `${to.n} · ${to.c || to.i}` : airports ? '找不到機場' : '載入機場資料中…'}</small></label>
    </div>
    {loadError && <div className="route-error">機場資料載入失敗，請重新整理頁面。</div>}
    <div className="field"><label>飛機機型</label><select aria-label="航線飛機機型" value={aircraft.shortName} onChange={event => onAircraft(aircraftProfiles.find(profile => profile.shortName === event.target.value)!)}>{aircraftProfiles.map(profile => <option key={profile.shortName} value={profile.shortName}>{profile.name}</option>)}</select></div>
    {aircraft.shortName === 'X-15' && <p className="route-note">X-15 由 B-52 空投，火箭推力只維持約 80–120 秒，之後滑翔至乾湖床；此處直飛僅供瞬時速度與太陽相對運動實驗，沒有模擬真實 X-15 任務軌跡。</p>}
    <div className="field"><label>航線模式</label><select aria-label="航線模式" value={mode} onChange={event => setMode(event.target.value as PlanMode)}><option value="procedural">起飛／進場流程 · 程序模擬</option><option value="direct">機場間直飛 · 即刻巡航</option></select></div>
    <button className="route-create" disabled={!ready} onClick={create}>建立航線與自動駕駛</button>
    {error && <div className="route-error" role="alert">{error}</div>}
    <p className="route-note">程序模擬使用實際跑道方向、WGS84 大圓航跡與機型化爬升／下降設定；未載入當期航圖、SID／STAR、ATC 放行或風場，不可當成已發布的實際飛航程序。</p>
    {plan && status && <div className="route-result">
      <div className="route-result-head"><strong>{plan.from.c || plan.from.i} → {plan.to.c || plan.to.i}</strong><span>{engaged ? 'AP ON' : 'AP OFF'}</span></div>
      <div className="route-metrics"><div><small>距離</small><b>{Math.round(plan.distanceNm).toLocaleString()} NM</b></div><div><small>巡航</small><b>FL{Math.round(plan.cruiseAltitudeFt / 100)}</b></div><div><small>階段</small><b>{phaseName[status.phase]}</b></div></div>
      <div className="route-eta"><small>預計抵達 ETA</small><strong>{utc(status.etaMs)}</strong><div className="route-ete"><small>ETE TO DEST · 預計剩餘飛行時間</small><b>{engaged ? formatEte((status.etaMs - currentTimeMs) / 1000) : '—'}</b></div><span>{engaged ? '依目前自動駕駛計畫' : 'AP 已解除，ETE 暫停估算'}</span></div>
      {plan.mode === 'procedural' && <div className="route-runways">起飛 RWY {plan.departureRunway?.n} · 降落 RWY {plan.arrivalRunway?.n}</div>}
      <div className="route-progress"><i style={{ width: `${100 * (1 - status.remainingSeconds / plan.durationSeconds)}%` }}/></div>
      <div className="route-actions"><button onClick={() => onEngage(!engaged)}>{engaged ? '解除自動駕駛' : '接通自動駕駛'}</button><button onClick={onRestart}>從起點重飛</button></div>
      <div className="route-fixes">{plan.fixes.map((fix, index) => <div key={index} className={index === status.fixIndex ? 'active' : index < status.fixIndex ? 'passed' : ''}><span>{String(index + 1).padStart(2, '0')}</span><strong>{fix.name}</strong><small>{phaseName[fix.phase]} · {Math.round(fix.altitudeFt).toLocaleString()} ft</small></div>)}</div>
    </div>}
  </div>;
}
