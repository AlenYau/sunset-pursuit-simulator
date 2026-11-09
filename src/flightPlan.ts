import geodesic from 'geographiclib-geodesic';
import { advance, clamp, normalizeHeading, type Sim } from './physics';
import type { AircraftProfile } from './aircraftProfiles';

const NM_TO_M = 1852;
const EARTH = geodesic.Geodesic.WGS84;
export type Airport = { c: string; i: string; n: string; p: [number, number]; e: number; t: string; r: RunwayEnd[] };
export type RunwayEnd = { n: string; p: [number, number]; h: number; l: number; s: string };
export type PlanMode = 'direct' | 'procedural';
export type PlanPhase = 'takeoff' | 'departure' | 'climb' | 'cruise' | 'descent' | 'arrival' | 'base' | 'final' | 'landed';
export type PlanFix = { name: string; p: [number, number]; phase: PlanPhase; altitudeFt: number; speedKt: number; radiusNm: number };
export type PlanSample = { seconds: number; state: Sim; fixIndex: number };
export type FlightPlan = { mode: PlanMode; from: Airport; to: Airport; aircraft: AircraftProfile; departureRunway?: RunwayEnd; arrivalRunway?: RunwayEnd; cruiseAltitudeFt: number; fixes: PlanFix[]; distanceNm: number; startTimeMs: number; samples: PlanSample[]; durationSeconds: number };

const distanceNm = (a: [number, number], b: [number, number]) => EARTH.Inverse(a[0], a[1], b[0], b[1]).s12! / NM_TO_M;
const bearing = (a: [number, number], b: [number, number]) => normalizeHeading(EARTH.Inverse(a[0], a[1], b[0], b[1]).azi1!);
const pointAt = (a: [number, number], heading: number, nm: number): [number, number] => {
  const point = EARTH.Direct(a[0], a[1], heading, nm * NM_TO_M);
  return [point.lat2!, point.lon2!];
};
const angleDifference = (from: number, to: number) => ((to - from + 540) % 360) - 180;

export function findAirport(airports: Airport[], code: string): Airport | undefined {
  const key = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(key)) return;
  const matches = airports.filter(airport => airport.c === key || airport.i === key);
  return matches.sort((a, b) => (b.t === 'l' ? 2 : b.t === 'm' ? 1 : 0) - (a.t === 'l' ? 2 : a.t === 'm' ? 1 : 0))[0];
}

export function aircraftPerformance(aircraft: AircraftProfile) {
  const name = aircraft.shortName;
  if (name === 'YF-12') return { runwayFt: 8500, rotationKt: 205, approachKt: 180, climbFpm: 4300, descentFpm: 3200, acceleration: 1.65, bankDeg: 18 };
  if (name === '協和式') return { runwayFt: 9000, rotationKt: 195, approachKt: 175, climbFpm: 3000, descentFpm: 2800, acceleration: 1.55, bankDeg: 22 };
  if (name === 'SR-71') return { runwayFt: 8500, rotationKt: 210, approachKt: 180, climbFpm: 4500, descentFpm: 3500, acceleration: 1.75, bankDeg: 18 };
  if (name === 'XB-70') return { runwayFt: 9000, rotationKt: 190, approachKt: 170, climbFpm: 4000, descentFpm: 3200, acceleration: 1.7, bankDeg: 18 };
  if (name === 'ER-2') return { runwayFt: 6000, rotationKt: 95, approachKt: 90, climbFpm: 1300, descentFpm: 1100, acceleration: .75, bankDeg: 20 };
  if (name === 'A380' || name === '747-8I') return { runwayFt: 8000, rotationKt: 165, approachKt: 150, climbFpm: 1800, descentFpm: 1700, acceleration: 1.1, bankDeg: 23 };
  if (name === '787' || name === 'A350' || name === '777-300ER') return { runwayFt: 7000, rotationKt: 155, approachKt: 145, climbFpm: 2100, descentFpm: 1900, acceleration: 1.25, bankDeg: 23 };
  return { runwayFt: 6000, rotationKt: 145, approachKt: 140, climbFpm: 2300, descentFpm: 1900, acceleration: 1.35, bankDeg: 25 };
}

function selectRunway(airport: Airport, desiredHeading: number, minLengthFt: number): RunwayEnd | undefined {
  return airport.r.filter(runway => runway.l >= minLengthFt).sort((a, b) => {
    const score = (r: RunwayEnd) => Math.abs(angleDifference(r.h, desiredHeading)) + (r.s.match(/ASP|CON|PEM|BIT|TAR/i) ? 0 : 25) - Math.min(r.l, 12000) / 2000;
    return score(a) - score(b);
  })[0];
}

function makeFix(name: string, p: [number, number], phase: PlanPhase, altitudeFt: number, speedKt: number, radiusNm: number): PlanFix {
  return { name, p, phase, altitudeFt, speedKt, radiusNm };
}

export function makeFlightPlan(from: Airport, to: Airport, aircraft: AircraftProfile, mode: PlanMode, startTimeMs: number): FlightPlan {
  if (aircraft.shortName === 'X-15' && mode === 'procedural') throw new Error('X-15 由 B-52 在空中投放並於乾湖床滑降，不能套用機場跑道起飛／進場流程。請改用直飛運動學實驗。');
  const distance = distanceNm(from.p, to.p);
  if (distance < 10) throw new Error('起點與終點太近，請選擇不同機場。');
  const course = bearing(from.p, to.p);
  const inbound = normalizeHeading(EARTH.Inverse(from.p[0], from.p[1], to.p[0], to.p[1]).azi2!);
  const performance = aircraftPerformance(aircraft);
  const cruiseAltitudeFt = mode === 'direct' ? aircraft.altitudeFt : Math.min(aircraft.altitudeFt, Math.floor((Math.max(from.e, to.e) + distance * 120) / 1000) * 1000);
  let departureRunway: RunwayEnd | undefined, arrivalRunway: RunwayEnd | undefined;
  let fixes: PlanFix[];
  let initial: Sim;

  if (mode === 'direct') {
    initial = { timeMs: startTimeMs, lat: from.p[0], lon: from.p[1], altitudeFt: cruiseAltitudeFt, speedKt: aircraft.speedKt, heading: course, verticalFpm: 0, routeMode: 'rhumb' };
    fixes = [makeFix(to.c || to.i, to.p, 'cruise', cruiseAltitudeFt, aircraft.speedKt, 2)];
  } else {
    if (distance < 40) throw new Error('程序模擬至少需要相距 40 海里的機場；較短航段可選直飛。');
    departureRunway = selectRunway(from, course, performance.runwayFt);
    arrivalRunway = selectRunway(to, inbound, performance.runwayFt);
    if (!departureRunway || !arrivalRunway) throw new Error(`${!departureRunway ? from.n : to.n} 缺少符合 ${aircraft.shortName} 示範性能的跑道資料；可改選機場或使用直飛。`);
    const departureNm = Math.min(25, distance * .18);
    const arrivalNm = Math.min(45, distance * .22);
    const descentNm = Math.max(arrivalNm + 15, Math.max(0, cruiseAltitudeFt - to.e - 10000) / 260 + 20);
    const todNm = Math.max(departureNm + 10, distance - descentNm);
    const finalFix = pointAt(arrivalRunway.p, normalizeHeading(arrivalRunway.h + 180), Math.min(10, distance * .08));
    const baseFix = pointAt(finalFix, normalizeHeading(arrivalRunway.h + 90), Math.min(8, distance * .08));
    fixes = [
      makeFix(`RWY ${departureRunway.n} 離地`, pointAt(departureRunway.p, departureRunway.h, Math.min(6, distance * .07)), 'takeoff', from.e + 3000, Math.max(180, performance.rotationKt + 25), 1.5),
      makeFix('離場轉彎', pointAt(from.p, course, departureNm), 'departure', Math.min(cruiseAltitudeFt, from.e + 10000), 250, 3)
    ];
    for (let nm = departureNm + 220, index = 1; nm < todNm - 80; nm += 240, index++) {
      fixes.push(makeFix(`航路 ${index}`, pointAt(from.p, course, nm), 'cruise', cruiseAltitudeFt, aircraft.speedKt, 12));
    }
    if (todNm > departureNm + 20) fixes.push(makeFix('下降頂點 TOD', pointAt(from.p, course, todNm), 'cruise', cruiseAltitudeFt, aircraft.speedKt, 10));
    fixes.push(makeFix('進場門', pointAt(to.p, normalizeHeading(inbound + 180), arrivalNm), 'descent', Math.min(cruiseAltitudeFt, to.e + 10000), Math.min(aircraft.speedKt, 250), 5));
    fixes.push(makeFix('轉向基線', baseFix, 'arrival', to.e + 4500, Math.min(220, aircraft.speedKt), 2));
    fixes.push(makeFix('最後進場定位', finalFix, 'base', to.e + 3000, Math.min(190, aircraft.speedKt), 1.4));
    fixes.push(makeFix(`RWY ${arrivalRunway.n} 落地`, arrivalRunway.p, 'final', to.e + 8, performance.approachKt, .35));
    initial = { timeMs: startTimeMs, lat: departureRunway.p[0], lon: departureRunway.p[1], altitudeFt: Math.max(8, from.e + 8), speedKt: 0, heading: departureRunway.h, verticalFpm: 0, routeMode: 'rhumb' };
  }
  const plan: FlightPlan = { mode, from, to, aircraft, departureRunway, arrivalRunway, cruiseAltitudeFt, fixes, distanceNm: distance, startTimeMs, samples: [], durationSeconds: 0 };
  plan.samples = generateTrajectory(plan, initial);
  plan.durationSeconds = plan.samples.at(-1)!.seconds;
  return plan;
}

function guidedStep(state: Sim, fix: PlanFix, plan: FlightPlan, seconds: number): Sim {
  const performance = aircraftPerformance(plan.aircraft);
  const position: [number, number] = [state.lat, state.lon];
  const desired = fix.phase === 'takeoff' && plan.departureRunway ? plan.departureRunway.h : bearing(position, fix.p);
  const speed = Math.max(1, state.speedKt);
  const turnRate = Math.min(3, 1091 * Math.tan(performance.bankDeg * Math.PI / 180) / speed);
  const heading = normalizeHeading(state.heading + clamp(angleDifference(state.heading, desired), -turnRate * seconds, turnRate * seconds));
  let targetSpeed = fix.speedKt;
  if (plan.mode === 'procedural' && state.altitudeFt - plan.from.e < 10000 && fix.phase !== 'final') targetSpeed = Math.min(targetSpeed, 250);
  if (fix.phase === 'climb' && state.altitudeFt < plan.cruiseAltitudeFt - 500) targetSpeed = Math.min(targetSpeed, 350);
  const acceleration = targetSpeed > state.speedKt ? performance.acceleration : performance.acceleration * 1.5;
  const speedKt = state.speedKt + clamp(targetSpeed - state.speedKt, -acceleration * seconds, acceleration * seconds);
  const difference = fix.altitudeFt - state.altitudeFt;
  let verticalFpm = Math.abs(difference) < 30 ? 0 : clamp(difference * 3, -performance.descentFpm, performance.climbFpm);
  if (fix.phase === 'takeoff' && speedKt < performance.rotationKt) verticalFpm = 0;
  const next = advance({ ...state, heading, speedKt, verticalFpm, routeMode: 'rhumb' }, seconds);
  return { ...next, altitudeFt: Math.max(plan.mode === 'procedural' ? Math.min(plan.from.e, plan.to.e) + 8 : 0, next.altitudeFt) };
}

function generateTrajectory(plan: FlightPlan, initial: Sim): PlanSample[] {
  const samples: PlanSample[] = [{ seconds: 0, state: initial, fixIndex: 0 }];
  let state = initial, fixIndex = 0;
  const stepSeconds = 10;
  for (let seconds = stepSeconds; seconds <= 48 * 3600; seconds += stepSeconds) {
    const fix = plan.fixes[fixIndex];
    if (!fix) break;
    const before = distanceNm([state.lat, state.lon], fix.p);
    state = guidedStep(state, fix, plan, stepSeconds);
    const after = distanceNm([state.lat, state.lon], fix.p);
    const acceptance = Math.max(fix.radiusNm, state.speedKt * stepSeconds / 3600 * 1.2);
    if (after <= acceptance || (after > before && before < Math.max(fix.radiusNm * 2, state.speedKt / 80))) {
      fixIndex++;
      if (fixIndex >= plan.fixes.length) {
        const endpoint = plan.arrivalRunway?.p ?? plan.to.p;
        state = { ...state, lat: endpoint[0], lon: endpoint[1], altitudeFt: plan.mode === 'procedural' ? Math.max(8, plan.to.e + 8) : plan.cruiseAltitudeFt, speedKt: 0, verticalFpm: 0 };
        samples.push({ seconds, state, fixIndex });
        return samples;
      }
    }
    samples.push({ seconds, state, fixIndex });
  }
  throw new Error('航線超出 48 小時模擬範圍，請改選較近的機場。');
}

export function sampleFlightPlan(plan: FlightPlan, timeMs: number): { state: Sim; fixIndex: number; phase: PlanPhase; remainingSeconds: number; etaMs: number } {
  const elapsed = clamp((timeMs - plan.startTimeMs) / 1000, 0, plan.durationSeconds);
  const index = clamp(Math.floor(elapsed / 10), 0, plan.samples.length - 1);
  const a = plan.samples[index], b = plan.samples[Math.min(index + 1, plan.samples.length - 1)];
  const f = b.seconds === a.seconds ? 0 : (elapsed - a.seconds) / (b.seconds - a.seconds);
  const lonDelta = angleDifference(a.state.lon, b.state.lon);
  const state: Sim = {
    ...a.state, timeMs,
    lat: a.state.lat + (b.state.lat - a.state.lat) * f,
    lon: ((a.state.lon + lonDelta * f + 540) % 360) - 180,
    altitudeFt: a.state.altitudeFt + (b.state.altitudeFt - a.state.altitudeFt) * f,
    speedKt: a.state.speedKt + (b.state.speedKt - a.state.speedKt) * f,
    heading: normalizeHeading(a.state.heading + angleDifference(a.state.heading, b.state.heading) * f),
    verticalFpm: a.state.verticalFpm + (b.state.verticalFpm - a.state.verticalFpm) * f
  };
  const fixIndex = f < .5 ? a.fixIndex : b.fixIndex;
  return { state, fixIndex, phase: fixIndex >= plan.fixes.length ? 'landed' : plan.fixes[fixIndex].phase, remainingSeconds: Math.max(0, plan.durationSeconds - elapsed), etaMs: plan.startTimeMs + plan.durationSeconds * 1000 };
}
