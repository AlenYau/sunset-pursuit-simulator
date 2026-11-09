using System;
using System.Collections.Generic;

namespace SunsetPursuit
{
    [Serializable] public sealed class AirportList { public Airport[] items; }
    [Serializable] public sealed class Airport
    {
        public string c,i,n,t;
        public double[] p;
        public double e;
        public RunwayEnd[] r;
        public string Code => string.IsNullOrEmpty(c)?i:c;
    }
    [Serializable] public sealed class RunwayEnd
    {
        public string n,s;
        public double[] p;
        public double h,l;
    }
    public enum FlightPhase { Takeoff, Departure, Climb, Cruise, Descent, Arrival, Base, Final, Landed }
    public sealed class PlanFix
    {
        public string Name;
        public double Latitude,Longitude,AltitudeFt,SpeedKt,RadiusNm;
        public FlightPhase Phase;
        public PlanFix(string name,double lat,double lon,FlightPhase phase,double altitude,double speed,double radius)
        { Name=name;Latitude=lat;Longitude=lon;Phase=phase;AltitudeFt=altitude;SpeedKt=speed;RadiusNm=radius; }
    }
    public sealed class PlanSample
    {
        public double Seconds; public FlightState State; public int FixIndex;
        public PlanSample(double seconds,FlightState state,int index) { Seconds=seconds;State=state;FixIndex=index; }
    }
    public sealed class FlightPlan
    {
        public bool Procedural;
        public Airport From,To;
        public RunwayEnd DepartureRunway,ArrivalRunway;
        public string Aircraft;
        public double CruiseAltitudeFt,DistanceNm,DurationSeconds;
        public DateTime StartUtc;
        public readonly List<PlanFix> Fixes=new List<PlanFix>();
        public readonly List<PlanSample> Samples=new List<PlanSample>();
        public DateTime Eta => StartUtc.AddSeconds(DurationSeconds);
    }

    public static class FlightPlanner
    {
        private const double Rad=Math.PI/180.0, A=6378137.0, F=1.0/298.257223563;
        private static double Difference(double a,double b) => ((b-a+540)%360)-180;
        public static Airport FindAirport(Airport[] airports,string code)
        {
            if (airports==null || string.IsNullOrEmpty(code)) return null;
            code=code.Trim().ToUpperInvariant();
            Airport best=null;int score=-1;
            foreach (var a in airports)
            {
                if (a.c!=code && a.i!=code) continue;
                int next=a.t=="l"?2:a.t=="m"?1:0;
                if (next>score) { best=a;score=next; }
            }
            return best;
        }

        // WGS84 inverse geodesic; spherical fallback handles nearly antipodal
        // pairs where Vincenty's inverse iteration can fail to converge.
        public static void Inverse(double lat1,double lon1,double lat2,double lon2,out double distanceM,out double bearing1,out double bearing2)
        {
            double b=A*(1-F),phi1=lat1*Rad,phi2=lat2*Rad;
            double u1=Math.Atan((1-F)*Math.Tan(phi1)),u2=Math.Atan((1-F)*Math.Tan(phi2));
            double s1=Math.Sin(u1),c1=Math.Cos(u1),s2=Math.Sin(u2),c2=Math.Cos(u2);
            double L=SimulationCore.NormalizeLongitude(lon2-lon1)*Rad,lambda=L,previous;
            double ss=0,cs=0,sigma=0,sinAlpha=0,cos2Alpha=0,cos2SigmaM=0;
            bool converged=false;
            for (int i=0;i<100;i++)
            {
                double sl=Math.Sin(lambda),cl=Math.Cos(lambda);
                ss=Math.Sqrt(Math.Pow(c2*sl,2)+Math.Pow(c1*s2-s1*c2*cl,2));
                if (ss<1e-15) { distanceM=0;bearing1=bearing2=0;return; }
                cs=s1*s2+c1*c2*cl; sigma=Math.Atan2(ss,cs);
                sinAlpha=c1*c2*sl/ss;cos2Alpha=1-sinAlpha*sinAlpha;
                cos2SigmaM=cos2Alpha<1e-15?0:cs-2*s1*s2/cos2Alpha;
                double C=F/16*cos2Alpha*(4+F*(4-3*cos2Alpha));
                previous=lambda;
                lambda=L+(1-C)*F*sinAlpha*(sigma+C*ss*(cos2SigmaM+C*cs*(-1+2*cos2SigmaM*cos2SigmaM)));
                if (Math.Abs(lambda-previous)<1e-12) { converged=true;break; }
            }
            if (!converged)
            {
                double dl=L;
                double c=Math.Sin(phi1)*Math.Sin(phi2)+Math.Cos(phi1)*Math.Cos(phi2)*Math.Cos(dl);
                distanceM=6371008.8*Math.Acos(SimulationCore.Clamp(c,-1,1));
                bearing1=SimulationCore.NormalizeHeading(Math.Atan2(Math.Sin(dl)*Math.Cos(phi2),Math.Cos(phi1)*Math.Sin(phi2)-Math.Sin(phi1)*Math.Cos(phi2)*Math.Cos(dl))/Rad);
                bearing2=bearing1;
                return;
            }
            double uSq=cos2Alpha*(A*A-b*b)/(b*b);
            double aa=1+uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
            double bb=uSq/1024*(256+uSq*(-128+uSq*(74-47*uSq)));
            double delta=bb*ss*(cos2SigmaM+bb/4*(cs*(-1+2*cos2SigmaM*cos2SigmaM)
                -bb/6*cos2SigmaM*(-3+4*ss*ss)*(-3+4*cos2SigmaM*cos2SigmaM)));
            distanceM=b*aa*(sigma-delta);
            bearing1=SimulationCore.NormalizeHeading(Math.Atan2(c2*Math.Sin(lambda),c1*s2-s1*c2*Math.Cos(lambda))/Rad);
            bearing2=SimulationCore.NormalizeHeading(Math.Atan2(c1*Math.Sin(lambda),-s1*c2+c1*s2*Math.Cos(lambda))/Rad);
        }

        private static double Distance(Airport a,Airport b)
        { Inverse(a.p[0],a.p[1],b.p[0],b.p[1],out double d,out _,out _);return d/1852; }
        private static double Distance(FlightState a,PlanFix b)
        { Inverse(a.Latitude,a.Longitude,b.Latitude,b.Longitude,out double d,out _,out _);return d/1852; }
        private static double Bearing(double lat1,double lon1,double lat2,double lon2)
        { Inverse(lat1,lon1,lat2,lon2,out _,out double az,out _);return az; }
        private static void Point(double lat,double lon,double az,double nm,out double lat2,out double lon2)
        { SimulationCore.DirectGeodesic(lat,lon,az,nm*1852,out lat2,out lon2,out _); }
        private static PlanFix Fix(string name,double lat,double lon,FlightPhase phase,double alt,double speed,double radius)
            => new PlanFix(name,lat,lon,phase,alt,speed,radius);

        private static RunwayEnd SelectRunway(Airport airport,double desired,double minLength)
        {
            RunwayEnd best=null;double bestScore=double.PositiveInfinity;
            foreach (var r in airport.r ?? Array.Empty<RunwayEnd>())
            {
                if (r.l<minLength) continue;
                double score=Math.Abs(Difference(r.h,desired))+(r.s.Contains("ASP")||r.s.Contains("CON")?0:25)-Math.Min(r.l,12000)/2000;
                if(score<bestScore) {bestScore=score;best=r;}
            }
            return best;
        }

        private static (double runway,double rotation,double approach,double climb,double descent,double accel,double bank) Performance(string name)
        {
            switch(name)
            {
                case "YF-12":return (8500,205,180,4300,3200,1.65,18);
                case "Concorde":return (9000,195,175,3000,2800,1.55,22);
                case "SR-71":return (8500,210,180,4500,3500,1.75,18);
                case "XB-70":return (9000,190,170,4000,3200,1.7,18);
                case "ER-2":return (6000,95,90,1300,1100,.75,20);
                case "A380":case "747-8I":return (8000,165,150,1800,1700,1.1,23);
                case "787":case "A350":case "777-300ER":return (7000,155,145,2100,1900,1.25,23);
                default:return (6000,145,140,2300,1900,1.35,25);
            }
        }

        public static FlightPlan Create(Airport from,Airport to,string aircraft,double aircraftAlt,double aircraftSpeed,bool procedural,DateTime utc)
        {
            if(from==null||to==null)throw new ArgumentException("找不到機場 ICAO／IATA 代碼");
            if(aircraft=="X-15"&&procedural)throw new ArgumentException("X-15 為空投火箭機，不能套用跑道起飛流程");
            double distance=Distance(from,to);
            if(distance<10)throw new ArgumentException("機場距離過近");
            double course=Bearing(from.p[0],from.p[1],to.p[0],to.p[1]);
            Inverse(from.p[0],from.p[1],to.p[0],to.p[1],out _,out _,out double inbound);
            var perf=Performance(aircraft);
            double cruise=procedural?Math.Min(aircraftAlt,Math.Floor((Math.Max(from.e,to.e)+distance*120)/1000)*1000):aircraftAlt;
            var plan=new FlightPlan { From=from,To=to,Aircraft=aircraft,Procedural=procedural,
                CruiseAltitudeFt=cruise,DistanceNm=distance,StartUtc=utc };
            var initial=new FlightState { Utc=utc,Latitude=from.p[0],Longitude=from.p[1],AltitudeFt=cruise,
                GroundSpeedKt=aircraftSpeed,HeadingDeg=course,RouteMode=RouteMode.ConstantHeading };
            if (!procedural)
                plan.Fixes.Add(Fix(to.Code,to.p[0],to.p[1],FlightPhase.Cruise,cruise,aircraftSpeed,2));
            else
            {
                if(distance<40)throw new ArgumentException("程序模擬需相距至少 40 NM");
                plan.DepartureRunway=SelectRunway(from,course,perf.runway);
                plan.ArrivalRunway=SelectRunway(to,inbound,perf.runway);
                if(plan.DepartureRunway==null||plan.ArrivalRunway==null)throw new ArgumentException("機場沒有符合此機型的跑道資料");
                double departure=Math.Min(25,distance*.18),arrival=Math.Min(45,distance*.22);
                double descent=Math.Max(arrival+15,Math.Max(0,cruise-to.e-10000)/260+20);
                double tod=Math.Max(departure+10,distance-descent);
                var dr=plan.DepartureRunway;var ar=plan.ArrivalRunway;
                Point(dr.p[0],dr.p[1],dr.h,Math.Min(6,distance*.07),out double lat,out double lon);
                plan.Fixes.Add(Fix("RWY "+dr.n+" 離地",lat,lon,FlightPhase.Takeoff,from.e+3000,Math.Max(180,perf.rotation+25),1.5));
                Point(from.p[0],from.p[1],course,departure,out lat,out lon);
                plan.Fixes.Add(Fix("離場轉彎",lat,lon,FlightPhase.Departure,Math.Min(cruise,from.e+10000),250,3));
                for(double nm=departure+220;nm<tod-80;nm+=240)
                { Point(from.p[0],from.p[1],course,nm,out lat,out lon);plan.Fixes.Add(Fix("航路",lat,lon,FlightPhase.Cruise,cruise,aircraftSpeed,12)); }
                if(tod>departure+20)
                { Point(from.p[0],from.p[1],course,tod,out lat,out lon);plan.Fixes.Add(Fix("TOD",lat,lon,FlightPhase.Cruise,cruise,aircraftSpeed,10)); }
                Point(to.p[0],to.p[1],SimulationCore.NormalizeHeading(inbound+180),arrival,out lat,out lon);
                plan.Fixes.Add(Fix("進場門",lat,lon,FlightPhase.Descent,Math.Min(cruise,to.e+10000),Math.Min(aircraftSpeed,250),5));
                Point(ar.p[0],ar.p[1],SimulationCore.NormalizeHeading(ar.h+180),Math.Min(10,distance*.08),out double fLat,out double fLon);
                Point(fLat,fLon,SimulationCore.NormalizeHeading(ar.h+90),Math.Min(8,distance*.08),out lat,out lon);
                plan.Fixes.Add(Fix("轉向基線",lat,lon,FlightPhase.Arrival,to.e+4500,Math.Min(220,aircraftSpeed),2));
                plan.Fixes.Add(Fix("最後進場定位",fLat,fLon,FlightPhase.Base,to.e+3000,Math.Min(190,aircraftSpeed),1.4));
                plan.Fixes.Add(Fix("RWY "+ar.n+" 落地",ar.p[0],ar.p[1],FlightPhase.Final,to.e+8,perf.approach,.35));
                initial.Latitude=dr.p[0];initial.Longitude=dr.p[1];initial.AltitudeFt=Math.Max(8,from.e+8);
                initial.GroundSpeedKt=0;initial.HeadingDeg=dr.h;
            }
            Generate(plan,initial,perf);
            plan.DurationSeconds=plan.Samples[plan.Samples.Count-1].Seconds;
            return plan;
        }

        private static void Generate(FlightPlan plan,FlightState state,(double runway,double rotation,double approach,double climb,double descent,double accel,double bank) perf)
        {
            plan.Samples.Add(new PlanSample(0,state,0));int fixIndex=0;
            for(int seconds=10;seconds<=48*3600;seconds+=10)
            {
                var fix=plan.Fixes[fixIndex];double before=Distance(state,fix);
                double desired=fix.Phase==FlightPhase.Takeoff&&plan.DepartureRunway!=null?plan.DepartureRunway.h:Bearing(state.Latitude,state.Longitude,fix.Latitude,fix.Longitude);
                double turnRate=Math.Min(3,1091*Math.Tan(perf.bank*Rad)/Math.Max(1,state.GroundSpeedKt));
                state.HeadingDeg=SimulationCore.NormalizeHeading(state.HeadingDeg+SimulationCore.Clamp(Difference(state.HeadingDeg,desired),-turnRate*10,turnRate*10));
                double target=fix.SpeedKt;
                if(plan.Procedural&&state.AltitudeFt-plan.From.e<10000&&fix.Phase!=FlightPhase.Final)target=Math.Min(target,250);
                double accel=target>state.GroundSpeedKt?perf.accel:perf.accel*1.5;
                state.GroundSpeedKt+=SimulationCore.Clamp(target-state.GroundSpeedKt,-accel*10,accel*10);
                double diff=fix.AltitudeFt-state.AltitudeFt;
                state.VerticalFpm=Math.Abs(diff)<30?0:SimulationCore.Clamp(diff*3,-perf.descent,perf.climb);
                if(fix.Phase==FlightPhase.Takeoff&&state.GroundSpeedKt<perf.rotation)state.VerticalFpm=0;
                state=SimulationCore.Advance(state,10);
                state.AltitudeFt=Math.Max(plan.Procedural?Math.Min(plan.From.e,plan.To.e)+8:0,state.AltitudeFt);
                double after=Distance(state,fix);
                double acceptance=Math.Max(fix.RadiusNm,state.GroundSpeedKt*10/3600*1.2);
                if(after<=acceptance||(after>before&&before<Math.Max(fix.RadiusNm*2,state.GroundSpeedKt/80)))
                {
                    fixIndex++;
                    if(fixIndex>=plan.Fixes.Count)
                    {
                        var end=plan.ArrivalRunway?.p??plan.To.p;
                        state.Latitude=end[0];state.Longitude=end[1];state.AltitudeFt=plan.Procedural?Math.Max(8,plan.To.e+8):plan.CruiseAltitudeFt;
                        state.GroundSpeedKt=0;state.VerticalFpm=0;
                        plan.Samples.Add(new PlanSample(seconds,state,fixIndex));return;
                    }
                }
                plan.Samples.Add(new PlanSample(seconds,state,fixIndex));
            }
            throw new ArgumentException("航線超出 48 小時模擬範圍");
        }

        public static FlightState Sample(FlightPlan plan,DateTime utc,out int fixIndex,out double remaining)
        {
            double elapsed=SimulationCore.Clamp((utc-plan.StartUtc).TotalSeconds,0,plan.DurationSeconds);
            int index=(int)SimulationCore.Clamp(Math.Floor(elapsed/10),0,plan.Samples.Count-1);
            var a=plan.Samples[index];var b=plan.Samples[Math.Min(index+1,plan.Samples.Count-1)];
            double f=b.Seconds==a.Seconds?0:(elapsed-a.Seconds)/(b.Seconds-a.Seconds);
            var state=a.State;state.Utc=utc;
            state.Latitude+=f*(b.State.Latitude-state.Latitude);
            state.Longitude=SimulationCore.NormalizeLongitude(state.Longitude+f*Difference(state.Longitude,b.State.Longitude));
            state.AltitudeFt+=f*(b.State.AltitudeFt-state.AltitudeFt);
            state.GroundSpeedKt+=f*(b.State.GroundSpeedKt-state.GroundSpeedKt);
            state.HeadingDeg=SimulationCore.NormalizeHeading(state.HeadingDeg+f*Difference(state.HeadingDeg,b.State.HeadingDeg));
            state.VerticalFpm+=f*(b.State.VerticalFpm-state.VerticalFpm);
            fixIndex=f<.5?a.FixIndex:b.FixIndex;
            remaining=Math.Max(0,plan.DurationSeconds-elapsed);
            return state;
        }
    }
}
