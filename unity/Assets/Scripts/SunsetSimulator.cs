using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace SunsetPursuit
{
    [RequireComponent(typeof(Camera))]
    public sealed class SunsetSimulator : MonoBehaviour
    {
        private FlightState state;
        private SolarState solar;
        private Camera viewCamera;
        private Material atmosphere;
        private Texture2D earth, land, cloudVolume;
        private bool playing, immersive, trackSun, showChart, showInstruments;
        private double rate = 1.0, direction = 1.0, cameraAzimuth = 270.0, cameraElevation;
        private double exposure = 1.0, fov = 65.0;
        private int quality = 1, cloudIndex = 2, aircraftIndex;
        private bool cameraMode;
        private Airport[] airports;
        private GeographyData geography;
        private string locationName = "位置未知";
        private double locationLat = double.NaN, locationLon = double.NaN;
        private FlightPlan plan;
        private bool autopilot, proceduralRoute = true;
        private string fromCode = "JFK", toCode = "LHR", routeError = "";
        private float scrollY;
        private string utcEdit = "", controlFocus = "";
        private readonly Dictionary<string,string> numberText = new Dictionary<string,string>();
        private DateTime? sunset;
        private float predictionAge;
        private Vector2 cloudAnchor;
        private static readonly string[] QualityNames = { "Low", "Medium", "High", "Ultra" };
        private static readonly string[] CloudNames = { "Clear", "Few", "Scattered", "Broken", "Overcast" };
        private static readonly double[] CoverValues = { 0.0, 0.32, 0.82, 0.93, 0.98 };
        private static readonly double[] TimeRates = { 0.1, 1, 5, 10, 60, 300, 1800, 3600 };
        private readonly string[] aircraftNames = { "737 MAX", "787", "A350", "A330neo", "777-300ER", "747-8I", "A380", "Concorde", "ER-2", "XB-70", "SR-71", "YF-12", "X-15" };
        private readonly double[] aircraftAltitudes = { 35000,39000,41000,37000,37000,35000,38000,59000,65000,70000,85000,75000,102000 };
        private readonly double[] aircraftSpeeds = { 450,488,488,471,483,492,488,1165,410,1740,1850,1835,3928 };

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (FindFirstObjectByType<SunsetSimulator>() != null) return;
            var go = new GameObject("Sunset Pursuit Simulator");
            var camera = go.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.02f,0.06f,0.11f);
            camera.allowHDR = true;
            go.AddComponent<SunsetSimulator>();
            DontDestroyOnLoad(go);
        }

        private void Awake()
        {
            viewCamera = GetComponent<Camera>();
            var shader = Shader.Find("SunsetPursuit/AtmosphereOcean");
            if (shader == null) Debug.LogError("AtmosphereOcean shader is missing. Check Assets/Shaders.");
            else atmosphere = new Material(shader) { hideFlags = HideFlags.DontSave };
            earth = Resources.Load<Texture2D>("earth-color");
            land = Resources.Load<Texture2D>("landmask");
            cloudVolume = Resources.Load<Texture2D>("cloud-volume");
            var airportAsset = Resources.Load<TextAsset>("airports");
            if (airportAsset != null) airports = JsonUtility.FromJson<AirportList>(airportAsset.text).items;
            var geographyAsset = Resources.Load<TextAsset>("geography");
            if (geographyAsset != null) geography = JsonUtility.FromJson<GeographyData>(geographyAsset.text);
            state = new FlightState {
                Latitude = 40, Longitude = 0, AltitudeFt = 35000,
                GroundSpeedKt = 450, HeadingDeg = 270, RouteMode = RouteMode.ConstantHeading,
                Utc = new DateTime(2026,3,20,9,0,0,DateTimeKind.Utc)
            };
            state = SimulationCore.NearbySunset(state);
            utcEdit = state.Utc.ToString("yyyy-MM-dd HH:mm:ss",CultureInfo.InvariantCulture);
            UpdateModel(true);
        }

        private void OnDestroy() { if (atmosphere != null) Destroy(atmosphere); }

        private void Update()
        {
            bool changed = false;
            if (playing)
            {
                double seconds = Time.unscaledDeltaTime * rate * direction;
                FlightState next = autopilot && plan != null
                    ? FlightPlanner.Sample(plan,state.Utc.AddSeconds(seconds),out _,out _)
                    : SimulationCore.Advance(state,seconds);
                MoveCloudAnchor(state,next);
                state = next;
                changed = true;
                if (autopilot && plan != null && direction > 0 && state.Utc >= plan.Eta) playing = false;
            }
            if (Input.GetKeyDown(KeyCode.Space)) playing = !playing;
            if (Input.GetKeyDown(KeyCode.F)) immersive = !immersive;
            if (Input.GetKeyDown(KeyCode.Escape)) immersive = false;
            if (Input.GetMouseButton(0) && Input.mousePosition.x > 380 && Input.mousePosition.x < Screen.width-380 && Input.mousePosition.y > 125)
            {
                cameraAzimuth = SimulationCore.NormalizeHeading(cameraAzimuth + Input.GetAxis("Mouse X") * 2.2);
                cameraElevation = SimulationCore.Clamp(cameraElevation - Input.GetAxis("Mouse Y") * 2.0,-85,85);
                trackSun = false;
            }
            if (changed || predictionAge > 10.0f) UpdateModel(false);
            predictionAge += Time.unscaledDeltaTime;
            if (trackSun)
            {
                cameraAzimuth = solar.Azimuth;
                cameraElevation = SimulationCore.Clamp(solar.ApparentElevation,-35,70);
            }
            viewCamera.fieldOfView = (float)fov;
            viewCamera.transform.rotation = Quaternion.Euler((float)-cameraElevation,(float)cameraAzimuth,0);
        }

        private void UpdateModel(bool forcePrediction)
        {
            solar = SimulationCore.SolarMetrics(state);
            if (forcePrediction || Math.Abs(state.Latitude-locationLat) > .01 || Math.Abs(state.Longitude-locationLon) > .01 || double.IsNaN(locationLat))
            {
                locationName = Geography.Lookup(geography,state.Latitude,state.Longitude);
                locationLat=state.Latitude;locationLon=state.Longitude;
            }
            if (forcePrediction || predictionAge > 10.0f)
            {
                sunset = SimulationCore.PredictSunset(state);
                predictionAge = 0;
            }
        }

        private void SetState(FlightState next)
        {
            MoveCloudAnchor(state,next);
            state = autopilot && plan != null
                ? FlightPlanner.Sample(plan,next.Utc,out _,out _)
                : next;
            UpdateModel(true);
        }

        private void MoveCloudAnchor(FlightState oldState, FlightState newState)
        {
            double lat = (oldState.Latitude+newState.Latitude)*0.5*Math.PI/180.0;
            double dLon = SimulationCore.NormalizeLongitude(newState.Longitude-oldState.Longitude);
            double dLat = newState.Latitude-oldState.Latitude;
            cloudAnchor.x += (float)(dLon*Math.Cos(lat)*111320.0);
            cloudAnchor.y += (float)(dLat*111320.0);
        }

        private void OnRenderImage(RenderTexture source, RenderTexture destination)
        {
            if (atmosphere == null) { Graphics.Blit(source,destination); return; }
            int[] skySteps = { 5,8,12,16 }, cloudSteps = { 5,9,15,22 };
            float[] scale = { .65f,.82f,1.0f,1.0f };
            double az = solar.Azimuth*Math.PI/180.0, el = solar.ApparentElevation*Math.PI/180.0;
            Vector3 sun = new Vector3((float)(Math.Sin(az)*Math.Cos(el)),(float)Math.Sin(el),(float)(Math.Cos(az)*Math.Cos(el)));
            double lat = state.Latitude*Math.PI/180.0, lon = state.Longitude*Math.PI/180.0;
            double s = Math.Sin(lat), c = Math.Cos(lat), sl = Math.Sin(lon), cl = Math.Cos(lon);
            float radius = (float)SimulationCore.EarthRadiusAt(state.Latitude,solar.Azimuth);
            atmosphere.SetMatrix("_CameraToWorld",viewCamera.cameraToWorldMatrix);
            atmosphere.SetVector("_East",new Vector4((float)-sl,(float)cl,0,0));
            atmosphere.SetVector("_North",new Vector4((float)(-s*cl),(float)(-s*sl),(float)c,0));
            atmosphere.SetVector("_Up",new Vector4((float)(c*cl),(float)(c*sl),(float)s,0));
            atmosphere.SetVector("_SunDir",sun);
            atmosphere.SetFloat("_Radius",radius);
            atmosphere.SetFloat("_Altitude",(float)(state.AltitudeFt*SimulationCore.FeetToMeters));
            atmosphere.SetFloat("_Fov",(float)fov);
            atmosphere.SetFloat("_Aspect",(float)viewCamera.aspect);
            atmosphere.SetFloat("_Exposure",(float)exposure);
            atmosphere.SetFloat("_CloudCover",(float)CoverValues[cloudIndex]);
            atmosphere.SetFloat("_UtcSeconds",(float)(state.Utc-TimestampEpoch).TotalSeconds);
            atmosphere.SetFloat("_CameraMode",cameraMode?1:0);
            atmosphere.SetVector("_CloudAnchor",new Vector4(cloudAnchor.x,cloudAnchor.y,0,0));
            atmosphere.SetInt("_SkySteps",skySteps[quality]);
            atmosphere.SetInt("_CloudSteps",cloudSteps[quality]);
            if (earth != null) atmosphere.SetTexture("_EarthColor",earth);
            if (land != null) atmosphere.SetTexture("_LandMask",land);
            if (cloudVolume != null) atmosphere.SetTexture("_CloudVolume",cloudVolume);
            int width = Mathf.Max(1,Mathf.RoundToInt(source.width*scale[quality]));
            int height = Mathf.Max(1,Mathf.RoundToInt(source.height*scale[quality]));
            var temp = RenderTexture.GetTemporary(width,height,0,RenderTextureFormat.ARGBHalf);
            Graphics.Blit(source,temp,atmosphere);
            Graphics.Blit(temp,destination);
            RenderTexture.ReleaseTemporary(temp);
        }

        private static readonly DateTime TimestampEpoch = new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc);

        private void OnGUI()
        {
            GUI.skin.label.normal.textColor = new Color(.91f,.95f,1f);
            GUI.skin.button.normal.textColor = Color.white;
            GUI.skin.button.normal.background = Texture2D.whiteTexture;
            GUI.backgroundColor = new Color(.09f,.16f,.23f);
            if (GUI.Button(new Rect(Screen.width-115,12,103,31),immersive?"顯示 UI":"純畫面")) immersive = !immersive;
            if (immersive) return;
            Panel(new Rect(12,12,340,showInstruments?405:328));
            GUILayout.BeginArea(new Rect(24,22,318,showInstruments?385:310));
            GUILayout.Label("SUNSET PURSUIT  ·  UNITY PORT");
            GUILayout.Label($"ALT {state.AltitudeFt:F0} ft   GS {state.GroundSpeedKt:F0} kt");
            GUILayout.Label($"LAT {state.Latitude:F3}°  LON {state.Longitude:F3}°  HDG {state.HeadingDeg:F0}°");
            GUILayout.Label(locationName);
            GUILayout.Label($"UTC {state.Utc:yyyy-MM-dd HH:mm:ss}");
            GUILayout.Space(8);
            GUILayout.Label($"SUN AZ {solar.Azimuth:F2}°   EL {solar.ApparentElevation:F3}°");
            GUILayout.Label($"HORIZON DIP {solar.HorizonDip:F3}°");
            GUILayout.Label($"RELATIVE RATE {solar.VerticalRate:+0.0000;-0.0000;0} °/min");
            GUILayout.Label(solar.Status);
            GUILayout.Label(sunset.HasValue ? $"SUNSET {sunset.Value:yyyy-MM-dd HH:mm} UTC" : "36 h 內無日落");
            if (plan != null)
            {
                FlightPlanner.Sample(plan,state.Utc,out int fix,out double remaining);
                GUILayout.Label($"{(autopilot?"AP ON":"AP OFF")}  {plan.From.Code} → {plan.To.Code}");
                GUILayout.Label($"ETA {plan.Eta:HH:mm} UTC   ETE {TimeSpan.FromSeconds(remaining):hh\\:mm}");
            }
            if (showInstruments)
            {
                GUILayout.Space(6);
                GUILayout.Label($"PFD   HDG {state.HeadingDeg:000}  FL{state.AltitudeFt/100:F0}  VS {state.VerticalFpm:+0;-0;0}");
                GUILayout.Label($"CAM {cameraAzimuth:F0}° / {cameraElevation:+0;-0;0}°");
                GUILayout.Label("GS 地速，FL 為幾何高度的近似顯示");
            }
            GUILayout.EndArea();

            float panelWidth = 356;
            Panel(new Rect(Screen.width-panelWidth-12,52,panelWidth,Screen.height-182));
            GUILayout.BeginArea(new Rect(Screen.width-panelWidth,62,panelWidth-24,Screen.height-202));
            scrollY = GUILayout.BeginScrollView(new Vector2(0,scrollY)).y;
            GUILayout.Label("FLIGHT CONTROL");
            NumberSlider("Altitude ft",ref state.AltitudeFt,100,SimulationCore.MaxAltitudeFt,100);
            NumberSlider("Ground speed kt",ref state.GroundSpeedKt,0,SimulationCore.MaxGroundSpeedKt,1);
            NumberSlider("Latitude",ref state.Latitude,-89.9,89.9,.1);
            NumberSlider("Longitude",ref state.Longitude,-180,180,.1);
            NumberSlider("Heading",ref state.HeadingDeg,0,359,1);
            NumberSlider("Vertical ft/min",ref state.VerticalFpm,-6000,6000,100);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("爬升")) ChangeVertical(1500);
            if (GUILayout.Button("平飛")) ChangeVertical(0);
            if (GUILayout.Button("下降")) ChangeVertical(-1500);
            GUILayout.EndHorizontal();
            if (GUILayout.Button(state.RouteMode==RouteMode.ConstantHeading?"航線：恆定航向":"航線：大圓")) { state.RouteMode=state.RouteMode==RouteMode.ConstantHeading?RouteMode.GreatCircle:RouteMode.ConstantHeading; UpdateModel(true); }
            GUILayout.Space(9);
            GUILayout.Label("AIRCRAFT REFERENCES");
            for (int i=0;i<aircraftNames.Length;i+=2)
            {
                GUILayout.BeginHorizontal();
                AircraftButton(i);
                if (i+1<aircraftNames.Length) AircraftButton(i+1);
                GUILayout.EndHorizontal();
            }
            GUILayout.Space(9);
            GUILayout.Label("ENVIRONMENT");
            if (GUILayout.Button("Clouds: "+CloudNames[cloudIndex])) cloudIndex=(cloudIndex+1)%CloudNames.Length;
            if (GUILayout.Button("Quality: "+QualityNames[quality])) quality=(quality+1)%QualityNames.Length;
            if (GUILayout.Button(cameraMode?"Camera mode":"Human eye mode")) cameraMode=!cameraMode;
            NumberSlider("FOV",ref fov,35,95,1);
            if (cameraMode) NumberSlider("Exposure",ref exposure,.25,2.5,.05);
            GUILayout.Space(9);
            GUILayout.Label("UTC DATE / TIME");
            utcEdit = GUILayout.TextField(utcEdit);
            if (GUILayout.Button("套用 UTC (yyyy-MM-dd HH:mm:ss)")) ApplyUtc();
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("正西視角")) { trackSun=false; cameraAzimuth=270; cameraElevation=0; }
            if (GUILayout.Button(trackSun?"停止追蹤":"追蹤太陽")) trackSun=!trackSun;
            GUILayout.EndHorizontal();
            if (GUILayout.Button(showInstruments?"隱藏儀表":"顯示儀表")) showInstruments=!showInstruments;
            if (GUILayout.Button(showChart?"收起太陽軌跡":"顯示太陽軌跡")) showChart=!showChart;
            GUILayout.Space(9);
            GUILayout.Label("SUNSET EXPERIMENTS");
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("A 赤道")) Preset('A');
            if (GUILayout.Button("B 40°N")) Preset('B');
            if (GUILayout.Button("C 85°N")) Preset('C');
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("D 高度")) Preset('D');
            if (GUILayout.Button("E 協和")) Preset('E');
            if (GUILayout.Button("F 極晝")) Preset('F');
            GUILayout.EndHorizontal();
            GUILayout.Space(10);
            GUILayout.Label("FLIGHT PLAN / AUTOPILOT");
            GUILayout.BeginHorizontal();
            GUILayout.Label("From",GUILayout.Width(40));fromCode=GUILayout.TextField(fromCode,GUILayout.Width(75));
            GUILayout.Label("To",GUILayout.Width(26));toCode=GUILayout.TextField(toCode,GUILayout.Width(75));
            GUILayout.EndHorizontal();
            var from=FlightPlanner.FindAirport(airports,fromCode);
            var to=FlightPlanner.FindAirport(airports,toCode);
            GUILayout.Label(from!=null?"起點 "+from.n:"找不到起點機場");
            GUILayout.Label(to!=null?"終點 "+to.n:"找不到終點機場");
            if (GUILayout.Button(proceduralRoute?"起飛／進場程序模擬":"機場間直飛")) proceduralRoute=!proceduralRoute;
            if (GUILayout.Button("建立航線 + AP")) CreateRoute(from,to);
            if (!string.IsNullOrEmpty(routeError)) GUILayout.Label(routeError);
            if (plan != null)
            {
                GUILayout.Label($"{plan.DistanceNm:F0} NM  FL{plan.CruiseAltitudeFt/100:F0}  ETA {plan.Eta:yyyy-MM-dd HH:mm} UTC");
                if (GUILayout.Button(autopilot?"解除 AP":"接通 AP")) autopilot=!autopilot;
                if (GUILayout.Button("從起點重飛"))
                {
                    autopilot=true;playing=false;
                    SetState(FlightPlanner.Sample(plan,plan.StartUtc,out _,out _));
                }
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();

            float timelineHeight = showChart?160:102;
            Panel(new Rect(12,Screen.height-timelineHeight-12,Screen.width-24,timelineHeight));
            GUILayout.BeginArea(new Rect(24,Screen.height-timelineHeight,Screen.width-48,timelineHeight-20));
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("◀ 倒放",GUILayout.Width(70))) { direction=-1;playing=true; }
            if (GUILayout.Button(playing?"暫停":"▶ 播放",GUILayout.Width(72))) { direction=1;playing=!playing; }
            if (GUILayout.Button("+1 min",GUILayout.Width(68))) { playing=false; SetState(SimulationCore.Advance(state,60)); }
            if (GUILayout.Button(rate+"×",GUILayout.Width(80))) rate=TimeRates[(Array.IndexOf(TimeRates,rate)+1)%TimeRates.Length];
            GUILayout.Label($"{state.Utc:yyyy-MM-dd HH:mm:ss} UTC   1× = real time");
            GUILayout.EndHorizontal();
            double minute=state.Utc.TimeOfDay.TotalMinutes;
            float nextMinute=GUILayout.HorizontalSlider((float)minute,0,1439);
            if (Math.Abs(nextMinute-minute)>1)
            {
                var next=state; next.Utc=state.Utc.Date.AddMinutes(nextMinute);
                SetState(next); playing=false;
            }
            GUILayout.Label("00:00                     06:00                     12:00                     18:00                     24:00 UTC");
            if (showChart) DrawChart(new Rect(0,78,Screen.width-48,56));
            GUILayout.EndArea();
        }

        private void NumberSlider(string label,ref double value,double min,double max,double step)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label(label,GUILayout.Width(168));
            string key = label;
            if (!numberText.ContainsKey(key) || GUI.GetNameOfFocusedControl()!=key)
                numberText[key]=value.ToString("F2",CultureInfo.InvariantCulture);
            GUI.SetNextControlName(key);
            string entered=GUILayout.TextField(numberText[key],GUILayout.Width(100));
            if (entered!=numberText[key]) numberText[key]=entered;
            if (GUILayout.Button("✓",GUILayout.Width(24)) && double.TryParse(entered,NumberStyles.Float,CultureInfo.InvariantCulture,out double parsed))
            {
                value=SimulationCore.Clamp(parsed,min,max);
                numberText[key]=value.ToString("F2",CultureInfo.InvariantCulture);
                if (label!="FOV" && label!="Exposure") autopilot=false;
                UpdateModel(true);
            }
            GUILayout.EndHorizontal();
            float slider=GUILayout.HorizontalSlider((float)value,(float)min,(float)max);
            double stepped=Math.Round(slider/step)*step;
            if (Math.Abs(stepped-value)>step*0.25)
            {
                value=SimulationCore.Clamp(stepped,min,max);
                numberText[key]=value.ToString("F2",CultureInfo.InvariantCulture);
                if (label!="FOV" && label!="Exposure") autopilot=false;
                UpdateModel(true);
            }
        }

        private void ChangeVertical(double fpm) { autopilot=false;state.VerticalFpm=fpm; numberText["Vertical ft/min"]=fpm.ToString("F2",CultureInfo.InvariantCulture); UpdateModel(true); }

        private void AircraftButton(int i)
        {
            if (GUILayout.Button($"{aircraftNames[i]}  FL{aircraftAltitudes[i]/100:F0}",GUILayout.Width(157)))
            {
                aircraftIndex=i;
                autopilot=false;
                state.AltitudeFt=aircraftAltitudes[i]; state.GroundSpeedKt=aircraftSpeeds[i]; state.VerticalFpm=0;
                numberText.Clear(); UpdateModel(true);
            }
        }

        private void ApplyUtc()
        {
            if (DateTime.TryParseExact(utcEdit,"yyyy-MM-dd HH:mm:ss",CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out var parsed))
            { var next=state;next.Utc=parsed;SetState(next); }
        }

        private void Preset(char key)
        {
            autopilot=false;plan=null;
            var next=state;
            next.Longitude=0;next.HeadingDeg=270;next.VerticalFpm=0;next.RouteMode=RouteMode.ConstantHeading;
            next.Utc=new DateTime(2026,3,20,9,0,0,DateTimeKind.Utc);
            switch (key)
            {
                case 'A': next.Latitude=0;next.AltitudeFt=100;next.GroundSpeedKt=0;break;
                case 'B': next.Latitude=40;next.AltitudeFt=35000;next.GroundSpeedKt=450;break;
                case 'C': next.Latitude=85;next.AltitudeFt=10000;next.GroundSpeedKt=120/1.852;break;
                case 'D': next.Latitude=40;next.AltitudeFt=100;next.GroundSpeedKt=0;break;
                case 'E': next.Latitude=45;next.AltitudeFt=59000;next.GroundSpeedKt=1100;break;
                case 'F': next.Latitude=85;next.AltitudeFt=100;next.GroundSpeedKt=0;next.Utc=new DateTime(2026,6,21,12,0,0,DateTimeKind.Utc);break;
            }
            next=SimulationCore.NearbySunset(next);
            SetState(next); playing=false;trackSun=false;cameraAzimuth=270;cameraElevation=0;
            utcEdit=state.Utc.ToString("yyyy-MM-dd HH:mm:ss",CultureInfo.InvariantCulture);
            numberText.Clear();
        }

        private void CreateRoute(Airport from,Airport to)
        {
            try
            {
                plan=FlightPlanner.Create(from,to,aircraftNames[aircraftIndex],aircraftAltitudes[aircraftIndex],aircraftSpeeds[aircraftIndex],proceduralRoute,state.Utc);
                autopilot=true;playing=false;trackSun=false;
                state=FlightPlanner.Sample(plan,plan.StartUtc,out _,out _);
                cameraAzimuth=state.HeadingDeg;cameraElevation=0;
                routeError="";UpdateModel(true);
            }
            catch (Exception error) { routeError=error.Message; }
        }

        private void DrawChart(Rect rect)
        {
            var baseState=state;
            baseState.Utc=state.Utc.Date;
            double[] y=new double[49]; double min=-2,max=2;
            for (int i=0;i<49;i++)
            {
                var point=SimulationCore.Advance(baseState,i*1800);
                y[i]=SimulationCore.SolarAt(point).UpperLimb;
                min=Math.Min(min,y[i]);max=Math.Max(max,y[i]);
            }
            var old=GUI.color; GUI.color=new Color(1,.70f,.43f);
            var line=Texture2D.whiteTexture;
            for (int i=1;i<49;i++)
            {
                var a=new Vector2(rect.x+(i-1)/48f*rect.width,rect.y+(float)((max-y[i-1])/(max-min))*rect.height);
                var b=new Vector2(rect.x+i/48f*rect.width,rect.y+(float)((max-y[i])/(max-min))*rect.height);
                DrawLine(a,b,line);
            }
            GUI.color=old;
        }

        private static void DrawLine(Vector2 a,Vector2 b,Texture2D texture)
        {
            var delta=b-a; var angle=Mathf.Atan2(delta.y,delta.x)*Mathf.Rad2Deg;
            var saved=GUI.matrix;
            GUIUtility.RotateAroundPivot(angle,a);
            GUI.DrawTexture(new Rect(a.x,a.y,delta.magnitude,2),texture);
            GUI.matrix=saved;
        }

        private static void Panel(Rect rect)
        {
            var old=GUI.color;
            GUI.color=new Color(.025f,.055f,.095f,.86f);
            GUI.DrawTexture(rect,Texture2D.whiteTexture);
            GUI.color=old;
        }
    }
}
