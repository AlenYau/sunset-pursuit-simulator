import type { Sim } from './physics';
import type { FlightPlan } from './flightPlan';
import { flightPathAttitude, formatEte } from './instrumentMath';

export function FlightInstruments({ state, plan, autopilot, onClose }: { state: Sim; plan: FlightPlan | null; autopilot: boolean; onClose: () => void }) {
  const { pitchDeg, bankDeg } = flightPathAttitude(state, plan, autopilot);
  const ete = plan && autopilot ? formatEte((plan.startTimeMs + plan.durationSeconds * 1000 - state.timeMs) / 1000) : '—';
  const ticks = [-20, -10, 0, 10, 20];
  return <section className="pfd" aria-label="飛行儀表">
    <div className="pfd-head"><span>PFD <b>FLIGHT DISPLAY</b></span><button onClick={onClose} aria-label="隱藏飛行儀表">×</button></div>
    <svg className="pfd-screen" viewBox="0 0 420 274" role="img" aria-label={`航跡估計俯仰 ${pitchDeg.toFixed(1)} 度，轉彎傾角 ${bankDeg.toFixed(1)} 度；地速 ${Math.round(state.speedKt)} 節；高度 ${Math.round(state.altitudeFt)} 英尺`}>
      <defs><clipPath id="pfd-attitude-clip"><rect x="79" y="20" width="262" height="181" rx="2"/></clipPath></defs>
      <rect x="0" y="0" width="420" height="274" fill="#07121e"/>
      <g clipPath="url(#pfd-attitude-clip)">
        <g transform={`translate(210 110) rotate(${-bankDeg}) translate(0 ${pitchDeg * 4})`}>
          <rect x="-360" y="-440" width="720" height="440" fill="#397aa3"/>
          <rect x="-360" y="0" width="720" height="440" fill="#8a654d"/>
          <line x1="-360" x2="360" y1="0" y2="0" stroke="#f2eee2" strokeWidth="2.5"/>
          {ticks.filter(t => t !== 0).map(t => <g key={t} transform={`translate(0 ${-t * 4})`}><line x1="-28" x2="28" y1="0" y2="0" stroke="#eaf4f8" strokeWidth="1.4"/><text x="-43" y="4" fill="#eaf4f8" fontSize="11" textAnchor="end">{Math.abs(t)}</text><text x="43" y="4" fill="#eaf4f8" fontSize="11">{Math.abs(t)}</text></g>)}
        </g>
      </g>
      <rect x="79" y="20" width="262" height="181" fill="none" stroke="#5b7888" strokeWidth="1"/>
      <path d="M 163 107 L 191 107 L 200 116 L 220 116 L 229 107 L 257 107" fill="none" stroke="#ffe7aa" strokeWidth="3"/>
      <circle cx="210" cy="110" r="3" fill="#ffe7aa"/>
      <path d="M 167 24 L 177 33 M 210 20 L 210 31 M 253 24 L 243 33" stroke="#fff" strokeWidth="2"/>
      <path d="M 210 17 L 205 9 L 215 9 Z" fill="#f7d879"/>
      <rect x="8" y="20" width="67" height="181" fill="#0d2030" stroke="#355062"/>
      <rect x="345" y="20" width="67" height="181" fill="#0d2030" stroke="#355062"/>
      <text x="41" y="37" fill="#8faab8" fontSize="10" textAnchor="middle">GS KT</text>
      <text x="378" y="37" fill="#8faab8" fontSize="10" textAnchor="middle">ALT FT</text>
      {[-2,-1,1,2].map(i => <g key={i} opacity=".73"><line x1="56" x2="74" y1={110+i*33} y2={110+i*33} stroke="#a6c6d1"/><text x="51" y={114+i*33} fill="#a6c6d1" fontSize="10" textAnchor="end">{Math.max(0,Math.round(state.speedKt-i*20))}</text><line x1="345" x2="363" y1={110+i*33} y2={110+i*33} stroke="#a6c6d1"/><text x="368" y={114+i*33} fill="#a6c6d1" fontSize="9">{Math.max(0,Math.round((state.altitudeFt-i*1000)/100)*100).toLocaleString()}</text></g>)}
      <rect x="12" y="91" width="59" height="38" fill="#142e3e" stroke="#d5e6ed"/>
      <rect x="349" y="91" width="59" height="38" fill="#142e3e" stroke="#d5e6ed"/>
      <text x="41" y="117" fill="#fff" fontSize="21" fontWeight="700" textAnchor="middle">{Math.round(state.speedKt)}</text>
      <text x="378" y="116" fill="#fff" fontSize={state.altitudeFt>=100000?13:17} fontWeight="700" textAnchor="middle">{Math.round(state.altitudeFt).toLocaleString()}</text>
      <path d="M 75 110 L 82 104 L 82 116 Z M 345 104 L 338 110 L 345 116 Z" fill="#f7d879"/>
      <rect x="78" y="208" width="264" height="58" fill="#102333" stroke="#355062"/>
      <text x="210" y="225" fill="#8faab8" fontSize="10" textAnchor="middle">HEADING / TRACK</text>
      <text x="210" y="251" fill="#fff" fontSize="25" fontWeight="700" textAnchor="middle">{String(Math.round(state.heading) % 360).padStart(3, '0')}°</text>
      <text x="11" y="223" fill="#8faab8" fontSize="10">VS FPM</text>
      <text x="11" y="247" fill={state.verticalFpm < 0 ? '#ffbc99' : '#b2e8d9'} fontSize="17" fontWeight="700">{state.verticalFpm > 0 ? '+' : ''}{Math.round(state.verticalFpm)}</text>
      <text x="348" y="223" fill="#8faab8" fontSize="10">ETE DEST</text>
      <text x="348" y="247" fill="#ffd19d" fontSize="18" fontWeight="700">{ete}</text>
    </svg>
    <div className="pfd-note">姿態為航跡估計 · GS 為地速 · ETE 僅在 AP 航線啟用時顯示</div>
  </section>;
}
