using System;
using CosineKitty;

namespace SunsetPursuit
{
    public enum RouteMode { ConstantHeading, GreatCircle }

    [Serializable]
    public struct FlightState
    {
        public double Latitude, Longitude, AltitudeFt, GroundSpeedKt, HeadingDeg, VerticalFpm;
        public DateTime Utc;
        public RouteMode RouteMode;
    }

    public struct SolarState
    {
        public double Azimuth, GeometricElevation, ApparentElevation, Refraction;
        public double HorizonDip, RelativeElevation, UpperLimb, VerticalRate;
        public string Status;
    }

    // The camera, terrain and UI all consume this single model. Astronomy Engine is
    // called without built-in refraction; our height-dependent approximation is added once.
    public static class SimulationCore
    {
        public const double FeetToMeters = 0.3048;
        public const double KnotToMetersPerSecond = 1852.0 / 3600.0;
        public const double SunRadiusDeg = 0.2666;
        public const double MaxAltitudeFt = 360000;
        public const double MaxGroundSpeedKt = 4000;
        private const double Rad = Math.PI / 180.0;
        private const double A = 6378137.0;
        private const double F = 1.0 / 298.257223563;
        private const double E2 = F * (2.0 - F);
        private static readonly double E = Math.Sqrt(E2);

        public static double Clamp(double value, double lo, double hi) => Math.Min(hi, Math.Max(lo, value));
        public static double NormalizeLongitude(double value) => ((value + 180.0) % 360.0 + 360.0) % 360.0 - 180.0;
        public static double NormalizeHeading(double value) => ((value % 360.0) + 360.0) % 360.0;

        public static double EarthRadiusAt(double latitude, double azimuth)
        {
            double s = Math.Sin(latitude * Rad), d = Math.Sqrt(1.0 - E2 * s * s);
            double n = A / d, m = A * (1.0 - E2) / (d * d * d);
            double c = Math.Cos(azimuth * Rad), q = Math.Sin(azimuth * Rad);
            return 1.0 / (c * c / m + q * q / n);
        }

        public static double HorizonDip(double latitude, double azimuth, double altitudeM)
        {
            double r = EarthRadiusAt(latitude, azimuth);
            return Math.Acos(r / (r + Math.Max(0.0, altitudeM))) / Rad;
        }

        // Bennett near-horizon correction, scaled by an ISA-like pressure profile.
        // This is approximate above the troposphere and is not a radiosonde model.
        public static double RefractionDegrees(double geometricElevation, double altitudeM)
        {
            if (geometricElevation < -4.0 || geometricElevation > 89.0) return 0.0;
            double e = Math.Max(-1.0, geometricElevation);
            double sea = 1.02 / Math.Tan((e + 10.3 / (e + 5.11)) * Rad) / 60.0;
            double pressure = Math.Exp(-Math.Max(0.0, altitudeM) / 8400.0);
            double tempC = Math.Max(-56.5, 15.0 - 0.0065 * altitudeM);
            double t = Clamp((geometricElevation + 4.0) / 2.5, 0.0, 1.0);
            return sea * pressure * (283.0 / (273.0 + tempC)) * t * t * (3.0 - 2.0 * t);
        }

        public static SolarState SolarAt(FlightState state)
        {
            double heightM = state.AltitudeFt * FeetToMeters;
            var time = new AstroTime(DateTime.SpecifyKind(state.Utc, DateTimeKind.Utc));
            var observer = new Observer(state.Latitude, state.Longitude, heightM);
            var eq = Astronomy.Equator(Body.Sun, time, observer, EquatorEpoch.OfDate, Aberration.Corrected);
            var horizontal = Astronomy.Horizon(time, observer, eq.ra, eq.dec, Refraction.None);
            double geometric = horizontal.altitude;
            double refraction = RefractionDegrees(geometric, heightM);
            double apparent = geometric + refraction;
            double dip = HorizonDip(state.Latitude, horizontal.azimuth, heightM);
            double relative = apparent + dip;
            return new SolarState {
                Azimuth = horizontal.azimuth, GeometricElevation = geometric,
                ApparentElevation = apparent, Refraction = refraction,
                HorizonDip = dip, RelativeElevation = relative,
                UpperLimb = relative + SunRadiusDeg
            };
        }

        public static SolarState SolarMetrics(FlightState state)
        {
            SolarState now = SolarAt(state);
            SolarState before = SolarAt(Advance(state, -30.0));
            SolarState after = SolarAt(Advance(state, 30.0));
            now.VerticalRate = after.RelativeElevation - before.RelativeElevation; // degrees/minute
            now.Status = now.UpperLimb > 0.01
                ? now.VerticalRate > 0.005 ? "太陽升高" : Math.Abs(now.VerticalRate) < 0.005 ? "近乎停留" : "日落進行中"
                : "太陽已沒入地平線";
            return now;
        }

        public static FlightState Advance(FlightState state, double seconds)
        {
            if (seconds == 0.0) return state;
            double distance = state.GroundSpeedKt * KnotToMetersPerSecond * seconds;
            if (distance != 0.0 && state.RouteMode == RouteMode.ConstantHeading)
            {
                double bearing = state.HeadingDeg * Rad;
                double northDistance = distance * Math.Cos(bearing);
                double phi1 = state.Latitude * Rad;
                double poleDistance = (northDistance * state.Latitude >= 0.0)
                    ? MeridianArc(Math.PI / 2.0) - Math.Abs(MeridianArc(phi1)) : double.PositiveInfinity;
                if (Math.Abs(northDistance) >= poleDistance - 0.001)
                    state.RouteMode = RouteMode.GreatCircle;
                else
                {
                    double phi2 = phi1;
                    if (Math.Abs(northDistance) > 1e-7)
                    {
                        double target = MeridianArc(phi1) + northDistance;
                        phi2 = phi1 + northDistance / EarthRadiusAt(state.Latitude, 0.0);
                        for (int i = 0; i < 6; ++i)
                        {
                            double sin = Math.Sin(phi2);
                            double d = Math.Sqrt(1.0 - E2 * sin * sin);
                            double meridianRadius = A * (1.0 - E2) / (d * d * d);
                            phi2 -= (MeridianArc(phi2) - target) / meridianRadius;
                        }
                    }
                    double deltaLon;
                    if (Math.Abs(northDistance) < 1e-7)
                    {
                        double sin = Math.Sin(phi1);
                        double parallelRadius = A * Math.Cos(phi1) / Math.Sqrt(1.0 - E2 * sin * sin);
                        deltaLon = distance * Math.Sin(bearing) / parallelRadius;
                    }
                    else
                    {
                        double deltaPhi = phi2 - phi1, mid = (phi1 + phi2) / 2.0;
                        double sin = Math.Sin(mid);
                        double deltaPsi = Math.Abs(deltaPhi) < 1e-7
                            ? deltaPhi * (1.0 - E2) / (Math.Cos(mid) * (1.0 - E2 * sin * sin))
                            : IsometricLatitude(phi2) - IsometricLatitude(phi1);
                        deltaLon = Math.Tan(bearing) * deltaPsi;
                    }
                    state.Latitude = phi2 / Rad;
                    state.Longitude = NormalizeLongitude(state.Longitude + deltaLon / Rad);
                }
            }
            if (distance != 0.0 && state.RouteMode == RouteMode.GreatCircle)
            {
                DirectGeodesic(state.Latitude, state.Longitude, state.HeadingDeg, distance,
                    out double lat, out double lon, out double finalBearing);
                state.Latitude = lat;
                state.Longitude = NormalizeLongitude(lon);
                state.HeadingDeg = NormalizeHeading(finalBearing);
            }
            state.AltitudeFt = Clamp(state.AltitudeFt + state.VerticalFpm * seconds / 60.0, 0.0, MaxAltitudeFt);
            state.Utc = state.Utc.AddSeconds(seconds);
            return state;
        }

        private static double IsometricLatitude(double phi)
        {
            double s = E * Math.Sin(phi);
            return Math.Log(Math.Tan(Math.PI / 4.0 + phi / 2.0)) - E * Math.Log((1.0 + s) / (1.0 - s)) / 2.0;
        }

        private static double MeridianArc(double phi)
        {
            double e4 = E2 * E2, e6 = e4 * E2, e8 = e4 * e4;
            return A * ((1.0 - E2 / 4.0 - 3.0 * e4 / 64.0 - 5.0 * e6 / 256.0 - 175.0 * e8 / 16384.0) * phi
                - (3.0 * E2 / 8.0 + 3.0 * e4 / 32.0 + 45.0 * e6 / 1024.0 + 105.0 * e8 / 4096.0) * Math.Sin(2.0 * phi)
                + (15.0 * e4 / 256.0 + 45.0 * e6 / 1024.0 + 525.0 * e8 / 16384.0) * Math.Sin(4.0 * phi)
                - (35.0 * e6 / 3072.0 + 175.0 * e8 / 12288.0) * Math.Sin(6.0 * phi)
                + 315.0 * e8 / 131072.0 * Math.Sin(8.0 * phi));
        }

        // Vincenty's WGS84 direct solution. The direct problem converges reliably
        // at these latitudes and works across both poles and the date line.
        public static void DirectGeodesic(double latitude, double longitude, double bearing, double distanceM,
            out double latitude2, out double longitude2, out double finalBearing)
        {
            if (distanceM < 0.0) { bearing += 180.0; distanceM = -distanceM; }
            double alpha1 = bearing * Rad, phi1 = latitude * Rad;
            double tanU1 = (1.0 - F) * Math.Tan(phi1);
            double cosU1 = 1.0 / Math.Sqrt(1.0 + tanU1 * tanU1), sinU1 = tanU1 * cosU1;
            double sinAlpha1 = Math.Sin(alpha1), cosAlpha1 = Math.Cos(alpha1);
            double sigma1 = Math.Atan2(tanU1, cosAlpha1);
            double sinAlpha = cosU1 * sinAlpha1, cos2Alpha = 1.0 - sinAlpha * sinAlpha;
            double b = A * (1.0 - F), u2 = cos2Alpha * (A * A - b * b) / (b * b);
            double aa = 1.0 + u2 / 16384.0 * (4096.0 + u2 * (-768.0 + u2 * (320.0 - 175.0 * u2)));
            double bb = u2 / 1024.0 * (256.0 + u2 * (-128.0 + u2 * (74.0 - 47.0 * u2)));
            double sigma = distanceM / (b * aa), sigmaP;
            double sinSigma = 0, cosSigma = 1, cos2SigmaM = 0;
            int iterations = 0;
            do {
                sigmaP = sigma;
                cos2SigmaM = Math.Cos(2.0 * sigma1 + sigma);
                sinSigma = Math.Sin(sigma); cosSigma = Math.Cos(sigma);
                double delta = bb * sinSigma * (cos2SigmaM + bb / 4.0 * (cosSigma * (-1.0 + 2.0 * cos2SigmaM * cos2SigmaM)
                    - bb / 6.0 * cos2SigmaM * (-3.0 + 4.0 * sinSigma * sinSigma) * (-3.0 + 4.0 * cos2SigmaM * cos2SigmaM)));
                sigma = distanceM / (b * aa) + delta;
            } while (Math.Abs(sigma - sigmaP) > 1e-12 && ++iterations < 100);
            double tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
            double phi2 = Math.Atan2(sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
                (1.0 - F) * Math.Sqrt(sinAlpha * sinAlpha + tmp * tmp));
            double lambda = Math.Atan2(sinSigma * sinAlpha1,
                cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
            double c = F / 16.0 * cos2Alpha * (4.0 + F * (4.0 - 3.0 * cos2Alpha));
            double l = lambda - (1.0 - c) * F * sinAlpha * (sigma + c * sinSigma * (cos2SigmaM + c * cosSigma * (-1.0 + 2.0 * cos2SigmaM * cos2SigmaM)));
            latitude2 = phi2 / Rad;
            longitude2 = NormalizeLongitude(longitude + l / Rad);
            finalBearing = NormalizeHeading(Math.Atan2(sinAlpha, -tmp) / Rad);
        }

        public static DateTime? PredictSunset(FlightState state, double windowHours = 36.0)
        {
            double previous = SolarAt(state).UpperLimb;
            FlightState cursor = state;
            for (double elapsed = 300.0; elapsed <= windowHours * 3600.0; elapsed += 300.0)
            {
                FlightState next = Advance(cursor, 300.0);
                double value = SolarAt(next).UpperLimb;
                if (previous > 0.0 && value <= 0.0)
                {
                    double lo = 0.0, hi = 300.0;
                    for (int i = 0; i < 22; i++)
                    {
                        double mid = (lo + hi) * 0.5;
                        if (SolarAt(Advance(cursor, mid)).UpperLimb > 0.0) lo = mid; else hi = mid;
                    }
                    return state.Utc.AddSeconds(elapsed - 300.0 + hi);
                }
                previous = value;
                cursor = next;
            }
            return null;
        }

        public static FlightState NearbySunset(FlightState state)
        {
            FlightState stationary = state;
            stationary.GroundSpeedKt = stationary.VerticalFpm = 0.0;
            DateTime? sunset = PredictSunset(stationary, 72.0);
            if (sunset.HasValue) state.Utc = sunset.Value.AddMinutes(-15.0);
            return state;
        }
    }
}
