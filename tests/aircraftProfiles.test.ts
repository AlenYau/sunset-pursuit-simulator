import { describe, expect, it } from 'vitest';
import { aircraftProfiles, nearbyAircraft } from '../src/aircraftProfiles';
import { MAX_ALTITUDE_FT, MAX_GROUND_SPEED_KT } from '../src/physics';

describe('aircraft reference presets', () => {
  it('keeps every selectable aircraft distinguishable and within simulator limits', () => {
    const pairs = aircraftProfiles.map(p => `${p.altitudeFt}/${p.speedKt}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const profile of aircraftProfiles) {
      expect(profile.altitudeFt).toBeGreaterThanOrEqual(100);
      expect(profile.altitudeFt).toBeLessThanOrEqual(MAX_ALTITUDE_FT);
      expect(profile.speedKt).toBeLessThanOrEqual(MAX_GROUND_SPEED_KT);
      expect(nearbyAircraft(profile.altitudeFt, profile.speedKt)?.name).toBe(profile.name);
    }
    expect(aircraftProfiles.find(p => p.shortName === 'X-15')).toMatchObject({ altitudeFt: 102000, speedKt: 3928 });
    expect(aircraftProfiles.find(p => p.shortName === 'YF-12')).toMatchObject({ altitudeFt: 75000, speedKt: 1835 });
  });
});
