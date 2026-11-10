// Run from this directory after the adjacent TypeScript project has npm dependencies.
import fs from 'node:fs';
const source = new URL('../../src/physics.ts', import.meta.url);
const sibling = new URL('../../sunset-pursuit-open-source/src/physics.ts', import.meta.url);
const { advance, predictSunset, solarMetrics } = await import(fs.existsSync(source) ? source.href : sibling.href);

const cases = [
  ['equator equinox sea level', '2026-03-20T18:00:00Z', 0, 0, 100, 0, 270, 0, 'rhumb', 3600],
  ['equator equinox FL350', '2026-03-20T18:00:00Z', 0, 0, 35000, 0, 270, 0, 'rhumb', 3600],
  ['equator west chase', '2026-03-20T18:00:00Z', 0, 0, 35000, 900, 270, 0, 'rhumb', 3600],
  ['north 85 spring', '2026-03-20T18:00:00Z', 85, 0, 10000, 120 / 1.852, 270, 0, 'rhumb', 3600],
  ['north 85 summer', '2026-06-21T12:00:00Z', 85, 0, 100, 0, 270, 0, 'rhumb', 3600],
  ['north 85 winter', '2026-12-21T12:00:00Z', 85, 0, 100, 0, 270, 0, 'rhumb', 3600],
  ['date line crossing', '2026-09-22T05:00:00Z', 40, 179.8, 59000, 1100, 90, 0, 'greatCircle', 3600],
  ['climb above clouds', '2026-09-22T17:00:00Z', 52, -4, 10000, 450, 270, 1800, 'rhumb', 600],
  ['polar great circle', '2026-03-20T12:00:00Z', 89.9, -120, 65000, 1800, 10, 0, 'greatCircle', 1200],
  ['polar west accelerated', '2026-03-20T18:00:00Z', 89.9, 30, 35000, 450, 270, 0, 'rhumb', 3600],
];

const rows = cases.map(([name, utc, latitude, longitude, altitudeFt, groundSpeedKt, headingDeg, verticalFpm, routeMode, stepSeconds]) => {
  const state = { timeMs: Date.parse(utc), lat: latitude, lon: longitude, altitudeFt, speedKt: groundSpeedKt, heading: headingDeg, verticalFpm, routeMode };
  const solar = solarMetrics(state), next = advance(state, stepSeconds);
  const sunset = predictSunset(state);
  return { name, utc, latitude, longitude, altitudeFt, groundSpeedKt, headingDeg, verticalFpm, routeMode,
    azimuth: solar.azimuth, apparentElevation: solar.apparentElevation, horizonDip: solar.horizonDip, verticalRate: solar.solarRate,
    stepSeconds, nextLatitude: next.lat, nextLongitude: next.lon, nextAltitudeFt: next.altitudeFt,
    sunsetUtc: sunset?.timeMs && ['equator equinox sea level', 'equator equinox FL350'].includes(name) ? new Date(sunset.timeMs).toISOString() : null };
});
fs.writeFileSync(new URL('./reference.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
