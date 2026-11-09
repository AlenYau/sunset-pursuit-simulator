using System.Text.Json;
using SunsetPursuit;

var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "reference.json"));
var cases = JsonSerializer.Deserialize<ReferenceCase[]>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
int assertions = 0;
foreach (var item in cases)
{
    var state = new FlightState {
        Utc = DateTime.Parse(item.Utc, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal),
        Latitude = item.Latitude, Longitude = item.Longitude, AltitudeFt = item.AltitudeFt,
        GroundSpeedKt = item.GroundSpeedKt, HeadingDeg = item.HeadingDeg,
        VerticalFpm = item.VerticalFpm,
        RouteMode = item.RouteMode == "greatCircle" ? RouteMode.GreatCircle : RouteMode.ConstantHeading
    };
    var solar = SimulationCore.SolarMetrics(state);
    Check(item.Name + " azimuth", solar.Azimuth, item.Azimuth, 0.0002);
    Check(item.Name + " apparent elevation", solar.ApparentElevation, item.ApparentElevation, 0.0002);
    Check(item.Name + " horizon dip", solar.HorizonDip, item.HorizonDip, 0.00001);
    Check(item.Name + " solar rate", solar.VerticalRate, item.VerticalRate, 0.00003);
    var next = SimulationCore.Advance(state, item.StepSeconds);
    Check(item.Name + " latitude", next.Latitude, item.NextLatitude, 0.00002);
    double lonError = SimulationCore.NormalizeLongitude(next.Longitude - item.NextLongitude);
    Check(item.Name + " longitude", lonError, 0, 0.00002);
    Check(item.Name + " altitude", next.AltitudeFt, item.NextAltitudeFt, 0.0001);
    if (item.SunsetUtc is not null)
    {
        var sunset = SimulationCore.PredictSunset(state);
        if (!sunset.HasValue) throw new Exception(item.Name + " sunset missing");
        var expected = DateTime.Parse(item.SunsetUtc, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);
        Check(item.Name + " sunset seconds", (sunset.Value - expected).TotalSeconds, 0, 1.0);
    }
}
Console.WriteLine($"PASS {assertions} parity assertions across {cases.Length} scenarios");

var airportData = JsonSerializer.Deserialize<AirportList>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"airports.json")),
    new JsonSerializerOptions { IncludeFields = true })!;
var jfk = FlightPlanner.FindAirport(airportData.items,"JFK");
var lhr = FlightPlanner.FindAirport(airportData.items,"EGLL");
if (!jfk.n.Contains("Kennedy") || lhr.c != "EGLL") throw new Exception("Airport lookup failed");
foreach (bool procedural in new[] { false,true })
{
    var plan=FlightPlanner.Create(jfk,lhr,"737 MAX",35000,450,procedural,new DateTime(2026,3,20,12,0,0,DateTimeKind.Utc));
    if (plan.DurationSeconds < 5*3600) throw new Exception("Route duration too short");
    var start=FlightPlanner.Sample(plan,plan.StartUtc,out _,out _);
    var end=FlightPlanner.Sample(plan,plan.Eta,out int fix,out double remaining);
    if (procedural && (start.GroundSpeedKt!=0 || plan.DepartureRunway==null || plan.ArrivalRunway==null)) throw new Exception("Runway departure failed");
    if (fix!=plan.Fixes.Count || remaining!=0) throw new Exception("Route arrival failed");
    Check("route destination latitude",end.Latitude,plan.ArrivalRunway?.p[0]??lhr.p[0],0.001);
    Check("route destination longitude",end.Longitude,plan.ArrivalRunway?.p[1]??lhr.p[1],0.001);
}
Console.WriteLine("PASS direct and procedural JFK-LHR route checks");

var geo=JsonSerializer.Deserialize<GeographyData>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"geography.json")),
    new JsonSerializerOptions { IncludeFields=true })!;
foreach(var (lat,lon,expected) in new (double,double,string)[] {
    (42.5,-73,"美國東北部"), (51.2,-2.5,"英國南部"), (48.5,-4.5,"法國西北部"),
    (43.5,9,"利古里亞海"), (56,3,"北海"), (15,114,"南海") })
{
    string actual=Geography.Lookup(geo,lat,lon);
    if(actual!=expected)throw new Exception($"Geography {lat},{lon}: {actual} != {expected}");
}
Console.WriteLine("PASS 6 country and sea labels");

void Check(string name, double actual, double expected, double tolerance)
{
    if (double.IsNaN(actual) || Math.Abs(actual - expected) > tolerance)
        throw new Exception($"{name}: actual {actual:R}, expected {expected:R}, tolerance {tolerance}");
    assertions++;
}

record ReferenceCase(string Name, string Utc, double Latitude, double Longitude, double AltitudeFt,
    double GroundSpeedKt, double HeadingDeg, double VerticalFpm, string RouteMode,
    double Azimuth, double ApparentElevation, double HorizonDip, double VerticalRate,
    double StepSeconds, double NextLatitude, double NextLongitude, double NextAltitudeFt, string? SunsetUtc);
