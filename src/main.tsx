import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUp, Compass, Eye, EyeOff, Pause, Play, RotateCcw, Sun, Target } from 'lucide-react';
import { SkyView, type Quality, type CloudCover, type ViewMode } from './SkyView';
import { advance, clamp, findNearbySunset, longitudeLocalTime, normalizeHeading, predictSunset, solarAt, solarMetrics, SUN_RADIUS_DEG, MAX_ALTITUDE_FT, MAX_GROUND_SPEED_KT, type Sim } from './physics';
import { aircraftProfiles, nearbyAircraft, type AircraftProfile } from './aircraftProfiles';
import { lookupLocation, type Geography } from './geography';
import { sampleFlightPlan, type FlightPlan } from './flightPlan';
import { RoutePanel } from './RoutePanel';
import { FlightInstruments } from './FlightInstruments';
import { formatEte } from './instrumentMath';
import './style.css';

const initial: Sim = findNearbySunset({ timeMs: Date.UTC(2026,2,20,9), lat: 40, lon: 0, altitudeFt: 35000, speedKt: 450, heading: 270, verticalFpm: 0, routeMode: 'rhumb' });
const rates = [0.1,1,5,10,60,300,1800,3600];
const n = (x:number,d=1)=>x.toFixed(d);
function App(){
 const [sim,setSim]=useState<Sim>(initial), simRef=useRef(initial);
 const [playing,setPlaying]=useState(false),[direction,setDirection]=useState(1),[rate,setRate]=useState(1);
 const [cameraAz,setCameraAz]=useState(270),[cameraEl,setCameraEl]=useState(0),[track,setTrack]=useState(false),[quality,setQuality]=useState<Quality>('medium');
 const [followAircraft,setFollowAircraft]=useState(false);
 const [clouds,setClouds]=useState<CloudCover>('scattered'),[viewMode,setViewMode]=useState<ViewMode>('eye'),[exposure,setExposure]=useState(1),[fov,setFov]=useState(65);
 const [immersive,setImmersive]=useState(false);
 const [showChart,setShowChart]=useState(false);
 const [showInstruments,setShowInstruments]=useState(false);
 const [geography,setGeography]=useState<Geography|null|false>(null);
 const [tab,setTab]=useState<'flight'|'experiments'|'route'>('flight');
 const [selectedAircraft,setSelectedAircraft]=useState<AircraftProfile>(aircraftProfiles[0]);
 const [flightPlan,setFlightPlan]=useState<FlightPlan|null>(null),[autopilot,setAutopilot]=useState(false);
 const [prediction,setPrediction]=useState<ReturnType<typeof predictSunset>>(null),[offsetHours,setOffsetHours]=useState(0);
 const [dragging,setDragging]=useState(false), drag=useRef({x:0,y:0}), scrubBase=useRef<Sim | null>(null);
 const update=(patch:Partial<Sim>)=>setSim(old=>{const next={...old,...patch};simRef.current=next;return next;});
 const manualUpdate=(patch:Partial<Sim>)=>{setAutopilot(false);update(patch);};
 const seekTime=(timeMs:number,base=simRef.current)=>{const seconds=(timeMs-base.timeMs)/1000;const next=autopilot&&flightPlan?sampleFlightPlan(flightPlan,timeMs).state:Math.abs(seconds)<=86400?advance(base,seconds):{...base,timeMs};simRef.current=next;setSim(next);};
 useEffect(()=>{let last=performance.now(),handle=0;const tick=(now:number)=>{if(playing&&now-last>=33){const dt=(now-last)/1000;last=now;const timeMs=simRef.current.timeMs+dt*rate*direction*1000;const next=autopilot&&flightPlan?sampleFlightPlan(flightPlan,timeMs).state:advance(simRef.current,dt*rate*direction);simRef.current=next;setSim(next);if(autopilot&&flightPlan&&timeMs>=flightPlan.startTimeMs+flightPlan.durationSeconds*1000&&direction>0)setPlaying(false);}else if(!playing)last=now;handle=requestAnimationFrame(tick);};handle=requestAnimationFrame(tick);return()=>cancelAnimationFrame(handle);},[playing,rate,direction,autopilot,flightPlan]);
 const solar=useMemo(()=>solarMetrics(sim),[sim]);
 useEffect(()=>{const id=setInterval(()=>setPrediction(predictSunset(simRef.current)),1000);return()=>clearInterval(id);},[]);
 useEffect(()=>{if(!playing)setPrediction(predictSunset(sim));},[sim,playing]);
 useEffect(()=>{if(track){setCameraAz(solar.azimuth);setCameraEl(clamp(solar.apparentElevation,-35,70));}},[track,solar.azimuth,solar.apparentElevation]);
 useEffect(()=>{if(followAircraft&&autopilot&&!track)setCameraAz(sim.heading);},[followAircraft,autopilot,track,sim.heading]);
 useEffect(()=>{let active=true;fetch(`${import.meta.env.BASE_URL}geography.json`).then(response=>{if(!response.ok)throw new Error('Geography data unavailable');return response.json() as Promise<Geography>}).then(data=>{if(active)setGeography(data)}).catch(()=>{if(active)setGeography(false)});return()=>{active=false}},[]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.altKey||event.ctrlKey||event.metaKey||['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement)?.tagName))return;if(event.key.toLowerCase()==='f'){event.preventDefault();setImmersive(v=>!v);}else if(event.key==='Escape'){setImmersive(false);}else if(event.code==='Space'){event.preventDefault();setPlaying(v=>!v);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
 const utc=new Date(sim.timeMs).toISOString();
 const dateValue=utc.slice(0,10),timeValue=utc.slice(11,19);
 const setUtc=(date:string,time:string)=>{const t=Date.parse(`${date}T${time}Z`);if(Number.isFinite(t))seekTime(t);};
 const setLocal=(value:string)=>{const offset=offsetHours*3600000;const t=Date.parse(`${value}Z`);if(Number.isFinite(t))seekTime(t-offset);};
 const localInput=new Date(sim.timeMs+offsetHours*3600000).toISOString().slice(0,16);
 const applyPreset=(key:string)=>{
  setAutopilot(false);setFlightPlan(null);
  let p:Partial<Sim>={verticalFpm:0,routeMode:'rhumb',heading:270};
  if(key==='A')p={...p,lat:0,lon:0,altitudeFt:100,speedKt:0,timeMs:Date.UTC(2026,2,20,9)};
  if(key==='B')p={...p,lat:40,lon:0,altitudeFt:35000,speedKt:450,timeMs:Date.UTC(2026,2,20,9)};
  if(key==='C')p={...p,lat:85,lon:0,altitudeFt:10000,speedKt:120/1.852,timeMs:Date.UTC(2026,2,20,9)};
  if(key==='D')p={...p,lat:40,lon:0,altitudeFt:100,speedKt:0,timeMs:Date.UTC(2026,2,20,9)};
  if(key==='E')p={...p,lat:45,lon:0,altitudeFt:59000,speedKt:1100,timeMs:Date.UTC(2026,2,20,9)};
  if(key==='F')p={...p,lat:85,lon:0,altitudeFt:100,speedKt:0,timeMs:Date.UTC(2026,5,21,12)};
  const result=findNearbySunset({...sim,...p});update(result);setCameraAz(270);setCameraEl(0);setFollowAircraft(false);setPlaying(false);
 };
 const createPlan=(plan:FlightPlan)=>{const start=sampleFlightPlan(plan,plan.startTimeMs).state;simRef.current=start;setSim(start);setFlightPlan(plan);setAutopilot(true);setFollowAircraft(true);setTrack(false);setPlaying(false);setDirection(1);setCameraAz(start.heading);setCameraEl(0);};
 const restartPlan=()=>{if(!flightPlan)return;const start=sampleFlightPlan(flightPlan,flightPlan.startTimeMs).state;simRef.current=start;setSim(start);setAutopilot(true);setFollowAircraft(true);setTrack(false);setPlaying(false);setDirection(1);setCameraAz(start.heading);setCameraEl(0);};
 const dayStartMs=Date.parse(`${utc.slice(0,10)}T00:00:00Z`);
 const chartBucket=Math.floor(sim.timeMs/900000),chartLat=Math.round(sim.lat*10)/10,chartLon=Math.round(sim.lon*10)/10;
 const points=useMemo(()=>{if(!showChart)return [];const arr=[];let cursor=autopilot&&flightPlan?sim:advance(sim,(dayStartMs-sim.timeMs)/1000);for(let m=0;m<=1440;m+=30){if(autopilot&&flightPlan)cursor=sampleFlightPlan(flightPlan,dayStartMs+m*60000).state;else if(m>0)cursor=advance(cursor,1800);arr.push({m,y:solarAt(cursor).relativeElevation+SUN_RADIUS_DEG});}return arr;},[showChart,dayStartMs,chartBucket,chartLat,chartLon,sim.speedKt,sim.heading,sim.altitudeFt,sim.routeMode,flightPlan,autopilot]);
 const yMin=Math.min(-2,...points.map(p=>p.y)),yMax=Math.max(2,...points.map(p=>p.y));
 const path=points.map((p,i)=>`${i?'L':'M'} ${(p.m/1440*1000).toFixed(2)} ${((yMax-p.y)/(yMax-yMin)*150).toFixed(2)}`).join(' ');
 const zeroY=(yMax/(yMax-yMin))*150;
 const nowX=clamp((sim.timeMs-dayStartMs)/86400000,0,1)*1000;
 const sunsetText=prediction?`${new Date(prediction.timeMs).toISOString().slice(0,16).replace('T',' ')} UTC · ${n(prediction.minutes,0)} 分鐘後`:'未在 36 小時預測窗內發生日落';
 const relativeHeading=((sim.heading-cameraAz+540)%360)-180;
 const nearby=nearbyAircraft(sim.altitudeFt,sim.speedKt);
 const planStatus=flightPlan?sampleFlightPlan(flightPlan,sim.timeMs):null;
 const runway=flightPlan&&autopilot&&flightPlan.mode==='procedural'?(()=>{
  const nearby=(position:[number,number])=>{const dLat=(sim.lat-position[0])*60;const dLon=(((sim.lon-position[1]+540)%360)-180)*60*Math.cos(sim.lat*Math.PI/180);return Math.hypot(dLat,dLon)<12;};
  return flightPlan.departureRunway&&nearby(flightPlan.departureRunway.p)?flightPlan.departureRunway:flightPlan.arrivalRunway&&nearby(flightPlan.arrivalRunway.p)?flightPlan.arrivalRunway:undefined;
 })():undefined;
 const locationName=useMemo(()=>geography?lookupLocation(geography,sim.lat,sim.lon):geography===false?'位置名稱無法載入':'載入地理資料中…',[geography,sim.lat,sim.lon]);
 const compassTicks=Array.from({length:9},(_,i)=>{const offset=(i-4)*10;const bearing=normalizeHeading(Math.round(cameraAz/10)*10+offset);return {bearing,offset:((bearing-cameraAz+540)%360)-180};});
 return <main className={`${immersive?'immersive ':''}${showChart?'chart-expanded':'chart-collapsed'}${showInstruments?' instrument-open':''}`}>
  <div className="view" onPointerDown={e=>{if((e.target as HTMLElement).closest('button,input,select,.panel,.timeline'))return;setDragging(true);drag.current={x:e.clientX,y:e.clientY};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!dragging)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current={x:e.clientX,y:e.clientY};setTrack(false);setFollowAircraft(false);setCameraAz(v=>normalizeHeading(v-dx*.16));setCameraEl(v=>clamp(v+dy*.14,-85,85));}} onPointerUp={()=>setDragging(false)}>
   <SkyView state={sim} solar={solar} cameraAz={cameraAz} cameraEl={cameraEl} quality={quality} clouds={clouds} mode={viewMode} exposure={exposure} fov={fov} runway={runway}/>
   <div className="vignette"/>
   <div className="crosshair"><span/><i/><span/></div>
   <div className="horizon-label">可視地平線 {n(-solar.horizonDip,2)}°</div>
   <div className="flight-frame" aria-label="飛行器參考座標儀表"><div className="flight-frame-title">AIRCRAFT FRAME <span>GS {n(sim.speedKt,0)} KT · FL{n(sim.altitudeFt/100,0).padStart(3,'0')}</span></div><div className="heading-tape">{compassTicks.map(t=><span key={t.bearing} style={{left:`${50+t.offset*1.05}%`}}>{t.bearing===0?'N':t.bearing===90?'E':t.bearing===180?'S':t.bearing===270?'W':t.bearing.toString().padStart(3,'0')}</span>)}{Math.abs(relativeHeading)<=45&&<b className="aircraft-marker" style={{left:`${50+relativeHeading*1.05}%`}}>▲<small>HDG</small></b>}<i className="view-marker">▼</i></div><div className="flight-frame-foot"><span>機首 {n(sim.heading,0)}°</span><span>視線 {n(cameraAz,0)}° / {cameraEl>=0?'+':''}{n(cameraEl,0)}°</span></div></div>
  </div>
  <button className="immersive-toggle" onClick={()=>setImmersive(v=>!v)} aria-label={immersive?'顯示介面':'隱藏介面，只看畫面'} title={immersive?'顯示介面 · F / Esc':'沉浸模式 · F'}>{immersive?<><Eye size={16}/> 顯示介面</>:<><EyeOff size={16}/> 純畫面</>}</button>
  <header className="topbar"><div className="brand"><span className="brand-icon"><Sun size={19}/></span><div><strong>SUNSET PURSUIT</strong><small>真實天文 · 飛行追日模擬器</small></div></div><div className="top-actions"><span className="live"><b/> LIVE PHYSICS</span><button className={`instrument-toggle ${showInstruments?'active':''}`} onClick={()=>setShowInstruments(value=>!value)} aria-label={showInstruments?'隱藏飛行儀表':'顯示飛行儀表'} aria-pressed={showInstruments}><span className="instrument-label-full">{showInstruments?'隱藏儀表':'飛行儀表'}</span><span className="instrument-label-short">PFD</span></button><select value={quality} onChange={e=>setQuality(e.target.value as Quality)} aria-label="畫質"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></div></header>
  <section className="telemetry">
   <div className="telemetry-title">FLIGHT TELEMETRY <span>● SIMULATION</span></div>
   <div className="stats"><div><label>ALT</label><strong>{Math.round(sim.altitudeFt).toLocaleString()} <em>ft</em></strong></div><div><label>GS</label><strong>{n(sim.speedKt,0)} <em>kt</em></strong></div><div><label>LAT / LON</label><strong>{n(sim.lat,3)}° / {n(sim.lon,3)}°</strong><small className="geo-label">{locationName}</small></div><div><label>HDG</label><strong>{n(sim.heading,0)}°</strong></div><div><label>UTC</label><strong>{utc.slice(11,19)}</strong></div></div>
   <div className="divider"/>
   <div className="stats solar-stats"><div><label>SOLAR AZIMUTH</label><strong>{n(solar.azimuth,2)}°</strong></div><div><label>APPARENT ELEVATION</label><strong>{n(solar.apparentElevation,3)}°</strong></div><div><label>RELATIVE VERTICAL RATE</label><strong className={solar.solarRate>0?'up':'down'}>{solar.solarRate>0?'+':''}{n(solar.solarRate,4)} <em>°/min</em></strong></div><div><label>HORIZON DIP</label><strong>{n(solar.horizonDip,3)}°</strong></div></div>
   <div className="status"><span>{solar.status}</span><small>{sunsetText}</small></div>
   {flightPlan&&planStatus&&<div className="ap-telemetry">{autopilot?'AP ON':'AP OFF'} · {flightPlan.from.c||flightPlan.from.i} → {flightPlan.to.c||flightPlan.to.i}<small>ETA {new Date(planStatus.etaMs).toISOString().slice(11,16)} UTC · ETE TO DEST {autopilot?formatEte((planStatus.etaMs-sim.timeMs)/1000):'—'}</small></div>}
  </section>
  {showInstruments&&<FlightInstruments state={sim} plan={flightPlan} autopilot={autopilot} onClose={()=>setShowInstruments(false)}/>}
  <div className="camera-actions"><button onClick={()=>{setTrack(false);setFollowAircraft(false);setCameraAz(270);setCameraEl(0)}}><Compass size={16}/> 正西視角</button>{flightPlan&&<button className={followAircraft?'selected':''} onClick={()=>{setTrack(false);setFollowAircraft(true);setCameraAz(sim.heading);setCameraEl(0)}}><Compass size={16}/> 機首視角</button>}<button className={track?'selected':''} onClick={()=>{setFollowAircraft(false);setTrack(!track)}}><Target size={16}/> {track?'追蹤中':'追蹤太陽'}</button></div>
  <aside className="panel"><div className="panel-tabs"><button className={tab==='flight'?'active':''} onClick={()=>setTab('flight')}>飛行控制</button><button className={tab==='route'?'active':''} onClick={()=>setTab('route')}>航線 / AP</button><button className={tab==='experiments'?'active':''} onClick={()=>setTab('experiments')}>追日實驗</button></div>
   {tab==='flight'?<div className="panel-scroll">
    <AltitudeControl value={sim.altitudeFt} onChange={v=>manualUpdate({altitudeFt:v})}/><div className="subvalue">{n(sim.altitudeFt*.3048,0)} m <span>FL{n(sim.altitudeFt/100,0).padStart(3,'0')}（幾何高度近似）</span></div>
    <Control label="地速 GROUND SPEED" value={sim.speedKt} min={0} max={MAX_GROUND_SPEED_KT} step={1} suffix="kt" onChange={v=>manualUpdate({speedKt:v})}/><div className="subvalue">{n(sim.speedKt*1.852,0)} km/h {sim.speedKt>=3500?<span className="warn">X-15 紀錄速度範圍 · 非巡航</span>:sim.speedKt>1900?<span className="warn">高於 SR-71 零風參考</span>:sim.speedKt>1200?<span className="warn">高於協和式零風參考</span>:null}</div>
    <div className="aircraft-reference"><div className="reference-head">AIRCRAFT REFERENCES <span>一鍵套用高度 + 地速</span></div><div className="aircraft-grid">{aircraftProfiles.map(profile=><button key={profile.name} className={nearby===profile?'matched':''} onClick={()=>{setSelectedAircraft(profile);manualUpdate({altitudeFt:profile.altitudeFt,speedKt:profile.speedKt,verticalFpm:0})}} title={`${profile.name} · ${profile.note}`}><strong>{profile.shortName}</strong><span>FL{profile.altitudeFt/100} · {profile.speedKt} kt</span></button>)}</div><small>{nearby?`接近 ${nearby.name} 參考設定。`:'選擇機型套用代表性設定。'} {nearby?.note} 地速採零風近似，不模擬風。{nearby&&<> <a href={nearby.source} target="_blank" rel="noreferrer">資料來源 ↗</a></>}</small></div>
    <Control label="緯度 LATITUDE" value={sim.lat} min={-89.9} max={89.9} step={.1} suffix="°" onChange={v=>manualUpdate({lat:v})}/>
    <Control label="經度 LONGITUDE" value={sim.lon} min={-180} max={180} step={.1} suffix="°" onChange={v=>manualUpdate({lon:v})}/>
    <div className="position-name"><span>目前位置</span><strong>{locationName}</strong></div>
    <Control label="航向 HEADING" value={sim.heading} min={0} max={359} step={1} suffix="°" onChange={v=>manualUpdate({heading:v})}/>
    <div className="field"><label>航線模式</label><select value={sim.routeMode} onChange={e=>manualUpdate({routeMode:e.target.value as Sim['routeMode']})}><option value="rhumb">恆定航向（正西 270°）</option><option value="greatCircle">大圓航線（初始航向）</option></select></div>
    <Control label="垂直速度 VERTICAL SPEED" value={sim.verticalFpm} min={-6000} max={6000} step={100} suffix="ft/min" onChange={v=>manualUpdate({verticalFpm:v})}/><div className="quick"><button onClick={()=>manualUpdate({verticalFpm:1500})}><ArrowUp size={13}/> 爬升</button><button onClick={()=>manualUpdate({verticalFpm:0})}>平飛</button><button onClick={()=>manualUpdate({verticalFpm:-1500})}><ArrowDown size={13}/> 下降</button></div>
    <div className="visual-controls"><div className="visual-title">VISUAL ENVIRONMENT</div><div className="field"><label>雲量</label><select value={clouds} onChange={e=>setClouds(e.target.value as CloudCover)}><option value="clear">Clear Sky</option><option value="few">Few Clouds</option><option value="scattered">Scattered Clouds</option><option value="broken">Broken Clouds</option><option value="overcast">Overcast</option></select></div><div className="field"><label>觀察模式</label><select value={viewMode} onChange={e=>setViewMode(e.target.value as ViewMode)}><option value="eye">Human Eye</option><option value="camera">Camera</option></select></div><Control label="視野角 FIELD OF VIEW" value={fov} min={35} max={95} step={1} suffix="°" onChange={setFov}/>{viewMode==='camera'&&<Control label="曝光 EXPOSURE" value={exposure} min={.25} max={2.5} step={.05} suffix="×" onChange={setExposure}/>}</div><div className="field date-field"><label>UTC 日期與時間</label><div><input type="date" value={dateValue} onChange={e=>setUtc(e.target.value,timeValue)}/><input type="time" step="1" value={timeValue} onChange={e=>setUtc(dateValue,e.target.value)}/></div></div>
    <div className="field"><label>當地時間 · UTC 偏移</label><div className="local-time-row"><input type="datetime-local" value={localInput} onChange={e=>setLocal(e.target.value)}/><input type="number" min={-12} max={14} step={0.5} value={offsetHours} aria-label="當地 UTC 偏移小時" onChange={e=>setOffsetHours(clamp(Number(e.target.value),-12,14))}/></div><small>UTC{offsetHours>=0?'+':''}{offsetHours} · 平均太陽時 {longitudeLocalTime(sim.timeMs,sim.lon)}</small></div>
    <div className="quick"><button onClick={()=>update(findNearbySunset({...sim,speedKt:0,verticalFpm:0}))}><RotateCcw size={13}/> 跳到日落前 15 分鐘</button></div>
   </div>:tab==='route'?<RoutePanel currentTimeMs={sim.timeMs} plan={flightPlan} aircraft={selectedAircraft} engaged={autopilot} onAircraft={profile=>{setSelectedAircraft(profile);setAutopilot(false);setFlightPlan(null)}} onCreate={createPlan} onEngage={enabled=>{setAutopilot(enabled);if(enabled&&flightPlan){const next=sampleFlightPlan(flightPlan,simRef.current.timeMs).state;simRef.current=next;setSim(next)}}} onRestart={restartPlan}/>:<div className="panel-scroll experiments"><p>所有預設共用同一套天文與航跡模型。選取後可繼續調整參數。</p>{[['A','赤道日落','春分 · 靜止與向西高速'],['B','北緯 40°','比較不同地速與追日門檻'],['C','極高緯度追日','85°N · 120 / 193 km/h'],['D','高度改變日落','100 ft → FL650 · 地速 0'],['E','協和式飛行','FL590 · 高速向西'],['F','極晝與極夜','85°N · 夏至 / 冬至']].map(([key,title,desc])=><button className="experiment" key={key} onClick={()=>applyPreset(key)}><b>{key}</b><span><strong>{title}</strong><small>{desc}</small></span><span>↗</span></button>)}<div className="experiment-note">理論赤道追日地速約 900 kt，實際效果請以右上角相對垂直角速度與下方曲線為準。極地實驗可切換日期觀察極晝、極夜。</div></div>}
  </aside>
  <footer className={`timeline ${showChart?'chart-open':'chart-closed'}`}>
   <div className="timeline-main"><div className="time-controls"><button onClick={()=>{setDirection(-1);setPlaying(true)}} title="倒放">◀◀</button><button className="play" onClick={()=>{setDirection(1);setPlaying(!playing)}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><button onClick={()=>{setPlaying(false);seekTime(sim.timeMs+60000)}} title="前進一分鐘">▸│</button><select value={rate} onChange={e=>setRate(Number(e.target.value))}>{rates.map(v=><option key={v} value={v}>{v}×</option>)}</select><button className="chart-toggle" onClick={()=>setShowChart(value=>!value)} aria-expanded={showChart} aria-controls="solar-trajectory">{showChart?'收起太陽軌跡':'顯示太陽軌跡'}</button></div><div className="timeline-date"><strong>{utc.slice(0,10)} <span>{utc.slice(11,19)} UTC</span></strong><small>1× = 真實時間 · 24 小時 UTC 時間軸</small></div></div>
   {showChart&&<div id="solar-trajectory"><div className="chart-head"><span>太陽上緣相對可視地平線</span><span>00:00 — 24:00 UTC</span></div>
   <svg className="chart" viewBox="0 0 1000 150" preserveAspectRatio="none" role="img" aria-label="24 小時太陽相對地平線高度時間曲線"><line x1="0" x2="1000" y1={zeroY} y2={zeroY} stroke="#ffffff66" strokeDasharray="5 5"/><line x1={nowX} x2={nowX} y1="0" y2="150" stroke="#ffffff77" strokeDasharray="4 4"/><path d={path} fill="none" stroke="#ffb164" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg></div>}
   <input className="time-scrub" type="range" min={0} max={1439} step={1} value={Math.floor((sim.timeMs-dayStartMs)/60000)} onPointerDown={()=>{scrubBase.current=simRef.current;setPlaying(false)}} onPointerUp={()=>{scrubBase.current=null}} onChange={e=>{const base=scrubBase.current??simRef.current;const day=Date.parse(`${new Date(base.timeMs).toISOString().slice(0,10)}T00:00:00Z`);seekTime(day+Number(e.target.value)*60000,base)}} aria-label="24 小時 UTC 時間軸拖動"/>
   <div className="chart-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
  </footer>
 </main>;
}
function Control({label,value,min,max,step,suffix,onChange}:{label:string;value:number;min:number;max:number;step:number;suffix:string;onChange:(value:number)=>void}){return <div className="control"><div className="control-head"><label>{label}</label><div><input type="number" value={Number(value.toFixed(2))} min={min} max={max} step={step} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))onChange(clamp(v,min,max));}}/><span>{suffix}</span></div></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></div>}
function AltitudeControl({value,onChange}:{value:number;onChange:(value:number)=>void}){
 const slider=value<=90000?value/90000*800:800+(value-90000)/(MAX_ALTITUDE_FT-90000)*200;
 const fromSlider=(position:number)=>position<=800?position/800*90000:90000+(position-800)/200*(MAX_ALTITUDE_FT-90000);
 return <div className="control"><div className="control-head"><label>高度 ALTITUDE</label><div><input type="number" value={Math.round(value)} min={0} max={MAX_ALTITUDE_FT} step={100} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))onChange(clamp(v,0,MAX_ALTITUDE_FT));}}/><span>ft</span></div></div><input type="range" min={0} max={1000} step={1} value={slider} onChange={e=>onChange(Math.round(fromSlider(Number(e.target.value))/100)*100)} aria-label="高度滑桿，90,000 英尺以上為延伸區間"/></div>;
}
const root = (import.meta.hot?.data.root as ReturnType<typeof createRoot> | undefined) ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<React.StrictMode><App/></React.StrictMode>);
