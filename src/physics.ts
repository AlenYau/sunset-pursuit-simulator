import * as Astronomy from 'astronomy-engine';
import geodesic from 'geographiclib-geodesic';

export const FT_TO_M = 0.3048;
export const KNOT_TO_MPS = 1852 / 3600;
export const SUN_RADIUS_DEG = 0.2666;
export const MAX_ALTITUDE_FT = 360000;
export const MAX_GROUND_SPEED_KT = 4000;
const RAD = Math.PI / 180;
const WGS84_E2 = 0.0066943799901413165;
const WGS84_E = Math.sqrt(WGS84_E2);
export type RouteMode = 'rhumb' | 'greatCircle';
export type Flight = { lat: number; lon: number; altitudeFt: number; speedKt: number; heading: number; verticalFpm: number; routeMode: RouteMode };
export type Sim = Flight & { timeMs: number };
export type Solar = { azimuth: number; geometricElevation: number; apparentElevation: number; refraction: number; horizonDip: number; relativeElevation: number; upperLimb: number; solarRate: number; status: string };
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const normalizeLon = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
export const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

// WGS84 meridional and prime-vertical radii; curvature in the viewing azimuth.
export function earthRadiusAt(lat: number, azimuth: number): number {
  const a = 6378137, e2 = 0.0066943799901413165, s = Math.sin(lat * RAD);
  const d = Math.sqrt(1 - e2 * s * s);
  const N = a / d, M = a * (1 - e2) / (d * d * d);
  const c = Math.cos(azimuth * RAD), q = Math.sin(azimuth * RAD);
  return 1 / (c * c / M + q * q / N);
}
export function horizonDip(lat: number, azimuth: number, altitudeM: number): number {
  const R = earthRadiusAt(lat, azimuth);
  return Math.acos(R / (R + Math.max(0, altitudeM))) / RAD;
}
// Bennett near-horizon refraction, scaled by a standard-atmosphere pressure approximation.
// This is a visual/forecast approximation, especially above the troposphere.
export function refractionDegrees(geometricElevation: number, altitudeM: number): number {
  if (geometricElevation < -4 || geometricElevation > 89) return 0;
  const e = Math.max(-1, geometricElevation);
  const sea = 1.02 / Math.tan((e + 10.3 / (e + 5.11)) * RAD) / 60;
  const pressure = Math.exp(-Math.max(0, altitudeM) / 8400);
  const tempC = Math.max(-56.5, 15 - 0.0065 * altitudeM);
  const taper = clamp((geometricElevation + 4) / 2.5, 0, 1);
  const smoothTaper = taper * taper * (3 - 2 * taper);
  return sea * pressure * (283 / (273 + tempC)) * smoothTaper;
}
export function solarAt(state: Sim): Omit<Solar, 'solarRate' | 'status'> {
  const h = state.altitudeFt * FT_TO_M;
  const time = new Date(state.timeMs);
  const observer = new Astronomy.Observer(state.lat, state.lon, h);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec);
  const azimuth = hor.azimuth;
  const geometricElevation = hor.altitude;
  const refraction = refractionDegrees(geometricElevation, h);
  const apparentElevation = geometricElevation + refraction;
  const dip = horizonDip(state.lat, azimuth, h);
  const relativeElevation = apparentElevation + dip;
  return { azimuth, geometricElevation, apparentElevation, refraction, horizonDip: dip, relativeElevation, upperLimb: relativeElevation + SUN_RADIUS_DEG };
}
export function advance(state: Sim, seconds: number): Sim {
  if (seconds === 0) return state;
  const distance = state.speedKt * KNOT_TO_MPS * seconds;
  let lat = state.lat, lon = state.lon, heading = state.heading, routeMode = state.routeMode;
  if (distance !== 0) {
    const bearing = heading * RAD;
    if (routeMode === 'rhumb') {
      const northDistance = distance * Math.cos(bearing);
      const towardPole = northDistance * lat >= 0;
      const poleDistance = towardPole ? geodesic.Geodesic.WGS84.Inverse(lat, lon, Math.sign(lat || northDistance) * 90, lon).s12! : Infinity;
      if (Math.abs(northDistance) >= poleDistance - 0.001) {
        // A non-meridional rhumb has no defined longitude at the pole.
        // Continue as a great circle so the aircraft never sticks there.
        routeMode = 'greatCircle';
      } else {
        const meridian = Math.abs(northDistance) > 1e-7
          ? geodesic.Geodesic.WGS84.Direct(lat, lon, northDistance > 0 ? 0 : 180, Math.abs(northDistance))
          : null;
        const lat2 = meridian ? meridian.lat2! : lat;
        const phi1 = lat * RAD, phi2 = lat2 * RAD;
        if (Math.abs(northDistance) < 1e-7) {
          // Due east/west follows the WGS84 parallel exactly, regardless of step size.
          const n = 6378137 / Math.sqrt(1 - WGS84_E2 * Math.sin(phi1) ** 2);
          lon = normalizeLon(lon + distance * Math.sin(bearing) / (n * Math.cos(phi1) * RAD));
        } else {
          const psi = (phi: number) => Math.asinh(Math.tan(phi)) - WGS84_E * Math.atanh(WGS84_E * Math.sin(phi));
          const deltaPhi = phi2 - phi1;
          const mid = (phi1 + phi2) / 2;
          const deltaPsi = Math.abs(deltaPhi) < 1e-7
            ? deltaPhi * (1 - WGS84_E2) / (Math.cos(mid) * (1 - WGS84_E2 * Math.sin(mid) ** 2))
            : psi(phi2) - psi(phi1);
          lon = normalizeLon(lon + Math.tan(bearing) * deltaPsi / RAD);
        }
        lat = lat2;
      }
    }
    if (routeMode === 'greatCircle') {
      const p = geodesic.Geodesic.WGS84.Direct(lat, lon, heading, distance);
      lat = p.lat2!;
      lon = normalizeLon(p.lon2!);
      heading = normalizeHeading(p.azi2!);
    }
  }
  return { ...state, lat, lon, heading, routeMode, altitudeFt: clamp(state.altitudeFt + state.verticalFpm * seconds / 60, 0, MAX_ALTITUDE_FT), timeMs: state.timeMs + seconds * 1000 };
}
export function solarMetrics(state: Sim): Solar {
  const now = solarAt(state);
  const before = solarAt(advance(state, -30));
  const after = solarAt(advance(state, 30));
  const solarRate = after.relativeElevation - before.relativeElevation;
  const status = now.upperLimb > 0.01 ? (solarRate > 0.005 ? '太陽升高' : Math.abs(solarRate) < 0.005 ? '近乎停留' : '日落進行中') : '太陽已沒入地平線';
  return { ...now, solarRate, status };
}
export type Prediction = { timeMs: number; minutes: number } | null;
export function predictSunset(state: Sim, windowHours = 36): Prediction {
  let previous = solarAt(state).upperLimb;
  let cursor = state;
  const stepSeconds = 300;
  for (let sec = stepSeconds; sec <= windowHours * 3600; sec += stepSeconds) {
    const next = advance(cursor, stepSeconds);
    const value = solarAt(next).upperLimb;
    if (previous > 0 && value <= 0) {
      let lo = 0, hi = stepSeconds;
      for (let n = 0; n < 22; n++) {
        const mid = (lo + hi) / 2;
        if (solarAt(advance(cursor, mid)).upperLimb > 0) lo = mid; else hi = mid;
      }
      return { timeMs: state.timeMs + (sec - stepSeconds + hi) * 1000, minutes: (sec - stepSeconds + hi) / 60 };
    }
    previous = value;
    cursor = next;
  }
  return null;
}
export function findNearbySunset(state: Sim): Sim {
  const start = { ...state, speedKt: 0, verticalFpm: 0 };
  const result = predictSunset(start, 72);
  return result ? { ...state, timeMs: result.timeMs - 15 * 60_000 } : state;
}
export function longitudeLocalTime(timeMs: number, lon: number): string {
  const offsetMinutes = Math.round(lon * 4);
  const date = new Date(timeMs + offsetMinutes * 60_000);
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} (UTC${offsetMinutes >= 0 ? '+' : ''}${(offsetMinutes / 60).toFixed(1)} 太陽時)`;
}
