import type { Sim } from './physics';
import { sampleFlightPlan, type FlightPlan } from './flightPlan';

const RAD = Math.PI / 180;
const toSignedHeading = (a: number, b: number) => ((b - a + 540) % 360) - 180;

/** Estimated flight-path display. The simulation has no independent pitch or roll state. */
export function flightPathAttitude(state: Sim, plan: FlightPlan | null, autopilot: boolean) {
  const horizontalMs = state.speedKt * 0.514444;
  const verticalMs = state.verticalFpm * 0.00508;
  const pitchDeg = Math.atan2(verticalMs, Math.max(horizontalMs, 5)) / RAD;
  let bankDeg = 0;
  if (plan && autopilot && horizontalMs > 10) {
    const before = sampleFlightPlan(plan, state.timeMs - 1000).state.heading;
    const after = sampleFlightPlan(plan, state.timeMs + 1000).state.heading;
    const turnRateRad = toSignedHeading(before, after) * RAD / 2;
    bankDeg = Math.atan(horizontalMs * turnRateRad / 9.80665) / RAD;
  }
  return { pitchDeg: Math.max(-25, Math.min(25, pitchDeg)), bankDeg: Math.max(-35, Math.min(35, bankDeg)) };
}

export function formatEte(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
