import { describe, expect, it } from 'vitest';
import { flightPathAttitude, formatEte } from '../src/instrumentMath';
import type { Sim } from '../src/physics';

const state: Sim = { timeMs: Date.UTC(2026, 2, 20), lat: 0, lon: 0, altitudeFt: 35000, speedKt: 450, heading: 270, verticalFpm: 1500, routeMode: 'rhumb' };
describe('optional flight display', () => {
  it('formats ETE with minute rollover and clamps completed flights', () => {
    expect(formatEte(3599)).toBe('01:00');
    expect(formatEte(3601)).toBe('01:01');
    expect(formatEte(-10)).toBe('00:00');
  });
  it('labels climb through a finite flight-path angle without inventing bank in free flight', () => {
    const attitude = flightPathAttitude(state, null, false);
    expect(attitude.pitchDeg).toBeGreaterThan(1);
    expect(attitude.pitchDeg).toBeLessThan(5);
    expect(attitude.bankDeg).toBe(0);
  });
});
