import { describe, expect, it } from 'vitest';
import airportsJson from '../public/airports.json';
import { aircraftProfiles } from '../src/aircraftProfiles';
import { findAirport, makeFlightPlan, sampleFlightPlan, type Airport } from '../src/flightPlan';

const airports = airportsJson as Airport[];
const from = findAirport(airports, 'JFK')!;
const to = findAirport(airports, 'EGLL')!;
const aircraft = aircraftProfiles[0];
const start = Date.UTC(2026, 2, 20, 12);

describe('airport route and autopilot', () => {
  it('accepts ICAO and IATA codes and resolves airport names', () => {
    expect(findAirport(airports, 'KJFK')?.n).toContain('Kennedy');
    expect(findAirport(airports, 'jfk')?.c).toBe('KJFK');
    expect(findAirport(airports, 'LHR')?.c).toBe('EGLL');
    expect(findAirport(airports, 'ZZZZ')).toBeUndefined();
  });

  it('starts direct mode at cruise height at the departure airport', () => {
    const plan = makeFlightPlan(from, to, aircraft, 'direct', start);
    const initial = sampleFlightPlan(plan, start);
    expect(initial.state.lat).toBeCloseTo(from.p[0], 3);
    expect(initial.state.altitudeFt).toBe(aircraft.altitudeFt);
    expect(initial.state.speedKt).toBe(aircraft.speedKt);
    expect(plan.fixes).toHaveLength(1);
    expect(plan.durationSeconds).toBeGreaterThan(5 * 3600);
  });

  it('uses surveyed runway ends and phases in procedural mode, with an ETA', () => {
    const plan = makeFlightPlan(from, to, aircraft, 'procedural', start);
    expect(plan.departureRunway?.l).toBeGreaterThan(6000);
    expect(plan.arrivalRunway?.l).toBeGreaterThan(6000);
    expect(plan.fixes.some(fix => fix.phase === 'departure')).toBe(true);
    expect(plan.fixes.some(fix => fix.phase === 'descent')).toBe(true);
    expect(plan.fixes.some(fix => fix.phase === 'final')).toBe(true);
    const beginning = sampleFlightPlan(plan, start);
    const midway = sampleFlightPlan(plan, start + plan.durationSeconds * 500);
    const end = sampleFlightPlan(plan, start + plan.durationSeconds * 1000);
    expect(beginning.state.speedKt).toBe(0);
    expect(beginning.state.altitudeFt).toBeLessThan(100);
    expect(midway.remainingSeconds).toBeLessThan(beginning.remainingSeconds);
    expect(end.phase).toBe('landed');
    expect(end.state.lat).toBeCloseTo(plan.arrivalRunway!.p[0], 3);
    expect(end.state.lon).toBeCloseTo(plan.arrivalRunway!.p[1], 3);
    expect(end.etaMs).toBe(start + plan.durationSeconds * 1000);
  });

  it('builds both short and long routes for different aircraft profiles', () => {
    for (const [origin, destination, profile] of [
      ['LAX', 'SFO', '737 MAX'],
      ['LHR', 'CDG', '787'],
      ['JFK', 'LAX', 'SR-71']
    ]) {
      const plan = makeFlightPlan(findAirport(airports, origin)!, findAirport(airports, destination)!, aircraftProfiles.find(a => a.shortName === profile)!, 'procedural', start);
      expect(plan.durationSeconds).toBeGreaterThan(20 * 60);
      expect(sampleFlightPlan(plan, start + plan.durationSeconds * 1000).phase).toBe('landed');
    }
  });
  it('does not invent a runway departure for the air-launched X-15', () => {
    const x15 = aircraftProfiles.find(a => a.shortName === 'X-15')!;
    expect(() => makeFlightPlan(from, to, x15, 'procedural', start)).toThrow(/B-52/);
  });
});
