import { cloudLayers } from './cloudModel';

export const screenVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
export const compositeFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSky;
uniform sampler2D uLandMask;
uniform sampler2D uEarthColor;
uniform sampler2D uCloudVolume;
uniform mat4 uInvProjection;
uniform mat4 uCameraWorld;
uniform vec3 uEcef;
uniform vec3 uEast;
uniform vec3 uUp;
uniform vec3 uSouth;
uniform vec3 uSun;
uniform vec3 uRunwayOrigin;
uniform vec3 uRunwayForward;
uniform vec3 uRunwaySide;
uniform float uRunwayLength;
uniform float uAltitude;
uniform float uRadius;
uniform float uTime;
uniform float uCoverage;
uniform float uExposure;
uniform float uEye;
uniform float uHorizonUV;
uniform vec2 uResolution;
uniform int uCloudStepBudget;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
vec3 linearToSRGB(vec3 c){return mix(12.92*c,1.055*pow(max(c,0.0),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+1.0),f.x),f.y);}
float fbm(vec2 p){return .55*noise2(p)+.28*noise2(p*2.13+13.1)+.17*noise2(p*4.31-9.4);}
float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+31.32);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=mix(hash13(i),hash13(i+vec3(1,0,0)),f.x);float b=mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x);float c=mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x);float d=mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x);return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);}
vec3 earthPoint(vec3 p){return uEcef+uEast*p.x+uUp*p.y+uSouth*p.z;}
vec2 earthPattern(vec3 p){return vec2(p.x+.37*p.z,p.y-.29*p.z);}
float cloudNoise(vec3 p,float scale){
 vec3 w=pow(abs(normalize(p)),vec3(4.0));w/=max(w.x+w.y+w.z,.0001);
 return w.x*noise2(p.yz*scale)+w.y*noise2(p.xz*scale)+w.z*noise2(p.xy*scale);
}
vec2 volumeUV(vec2 xy,float slice){
 vec2 tile=vec2(mod(slice,16.0),floor(slice/16.0));
 return (tile*130.0+vec2(1.5)+xy*128.0)/vec2(2080.0,1040.0);
}
float cloudVolume(vec3 p){
 vec3 v=fract(p);
 float z=v.z*128.0,z0=floor(z),z1=mod(z0+1.0,128.0);
 return mix(texture2D(uCloudVolume,volumeUV(v.xy,z0)).r,texture2D(uCloudVolume,volumeUV(v.xy,z1)).r,fract(z));
}
vec2 cumulusSample(vec3 earth,float h,float seed,float cellSize,vec3 lightDirection){
 vec2 grid=earthPattern(earth)/cellSize;
 vec2 base=floor(grid-.5);
 float mass=0.0;
 float lighting=.45;
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 cell=base+vec2(float(x),float(y));
  float random=hash12(cell+seed*17.0);
  float present=1.0-step(uCoverage,random);
  if(present<.5)continue;
  vec2 jitter=fract(vec2(random*17.17,random*37.43))-.5;
  vec2 center=cell+.5+jitter*.34;
  float radius=.30+.09*fract(random*11.73);
  vec2 horizontal=(grid-center)/radius;
  // Most middle-layer towers end well below FL350; a few grow into the
  // upper troposphere. The cloud envelope itself stays at realistic heights.
  float localH=h;
  if(seed>7.0&&seed<10.0){float reach=mix(.43,.99,pow(hash12(cell+seed*83.0),2.2));localH=h/reach;}
  float lowVertical=(localH-.34)/.39;
  float lower=dot(horizontal,horizontal)+lowVertical*lowVertical;
  vec2 upperOffset=jitter*.14+vec2(.13,.10);
  vec2 crown=(grid-center-upperOffset)/max(.18,radius*.70);
  float upperVertical=(localH-(.66+.08*fract(random*53.11)))/.29;
  float upper=dot(crown,crown)+upperVertical*upperVertical;
  vec2 satelliteOffset=vec2(-.15,.07)+jitter*.11;
  vec2 satellite=(grid-center-satelliteOffset)/max(.15,radius*.52);
  float satelliteVertical=(localH-(.53+.10*fract(random*71.37)))/.22;
  float satellitePuff=.88*(1.0-smoothstep(.34,1.08,dot(satellite,satellite)+satelliteVertical*satelliteVertical));
  float lowerPuff=1.0-smoothstep(.38,1.14,lower);
  float upperPuff=.94*(1.0-smoothstep(.34,1.08,upper));
  float puff=max(max(lowerPuff,upperPuff),satellitePuff);
  puff*=smoothstep(-.03,.13,localH);
  if(puff>mass){
   mass=puff;
   vec3 normal=lowerPuff>upperPuff&&lowerPuff>satellitePuff?vec3(horizontal,lowVertical):upperPuff>satellitePuff?vec3(crown,upperVertical):vec3(satellite,satelliteVertical);
   lighting=.20+1.35*max(dot(normalize(normal),lightDirection),0.0);
  }
 }
 float sculpt=cloudVolume((earth+vec3(seed*13217.0,seed*4811.0,seed*9761.0))/9500.0);
 if(uCloudStepBudget>6)sculpt=mix(sculpt,cloudVolume((earth+vec3(seed*913.0,seed*7411.0,seed*2473.0))/2800.0),.38);
 return vec2(smoothstep(.08,.68,mass*(.32+1.42*sculpt)),lighting*(.70+.62*sculpt));
}


float firstSphere(vec3 d,float radius){float r=uRadius+uAltitude;float b=r*d.y;float c=r*r-radius*radius;float disc=b*b-c;if(disc<0.0)return -1.0;float s=sqrt(disc);float t=-b-s;if(t>0.0)return t;t=-b+s;return t>0.0?t:-1.0;}
vec4 cloudLayer(vec3 d,float bottom,float top,float scale,float seed,float extinction,float groundDistance,bool wispy){
 if(uCoverage<.01)return vec4(0.0);
 float start,end;
 if(uAltitude<bottom){start=firstSphere(d,uRadius+bottom);end=firstSphere(d,uRadius+top);}
 else if(uAltitude>top){start=firstSphere(d,uRadius+top);end=firstSphere(d,uRadius+bottom);}
 else {start=0.0;float a=firstSphere(d,uRadius+bottom),b=firstSphere(d,uRadius+top);end=a>0.0&&b>0.0?min(a,b):max(a,b);}
 if(start<0.0)return vec4(0.0);
 if(end<=start)end=start+(top-bottom)/max(.08,abs(d.y));
 if(groundDistance>0.0){if(start>=groundDistance)return vec4(0.0);end=min(end,groundDistance);}
 float travel=min(end-start,wispy?38000.0:32000.0);
 if(travel<=0.0)return vec4(0.0);
 if(wispy){
  vec3 p=earthPoint(d*(start+min(travel*.25,3000.0)))+vec3(seed*13217.0,seed*4811.0,seed*9761.0);
  float shape=.72*cloudNoise(p,scale*.45)+.28*cloudNoise(p+7431.0,scale*1.2);
  float density=smoothstep(mix(.68,.31,uCoverage),mix(.81,.45,uCoverage),shape);
  float alpha=density*(1.0-exp(-travel/26000.0))*.16*exp(-start/100000.0);
  float day=smoothstep(-.16,.06,asin(clamp(uSun.y,-1.0,1.0)));
  return vec4(mix(vec3(.006,.008,.015),vec3(.24,.28,.32),day)*alpha,alpha);
 }
 float steps=float(uCloudStepBudget);
 vec3 sunHorizontal=uEast*uSun.x+uSouth*uSun.z;
 vec3 lightDirection=normalize(vec3(earthPattern(sunHorizontal),uSun.y*1.5));
 float transmittance=1.0;
 float litDensity=0.0;
 float edgeAmount=0.0;
 for(int i=0;i<CLOUD_STEPS;i++){
  if(i>=uCloudStepBudget)break;
  float u0=float(i)/steps,u1=(float(i)+1.0)/steps;
  float t0=start+travel*u0*u0,t1=start+travel*u1*u1;
  float t=(t0+t1)*.5,stepLength=t1-t0;
  vec3 earth=earthPoint(d*t);
  float h=(length(d*t+vec3(0.0,uRadius+uAltitude,0.0))-uRadius-bottom)/(top-bottom);
  vec2 sampleCloud=cumulusSample(earth,h,seed,bottom<2000.0?3900.0:5800.0,lightDirection);
  float density=sampleCloud.x;
  float stepAlpha=1.0-exp(-density*stepLength/extinction);
  float weight=transmittance*stepAlpha;
  litDensity+=weight*sampleCloud.y;
  edgeAmount+=weight*(1.0-smoothstep(.4,.9,density));
  transmittance*=1.0-stepAlpha;
 }
 float alpha=(1.0-transmittance)*exp(-start/105000.0);
 float sunEl=asin(clamp(uSun.y,-1.0,1.0));
 float day=smoothstep(-.16,.06,sunEl);
 float warm=exp(-abs(sunEl)*7.0)*day;
 float fromAbove=smoothstep(bottom,top+800.0,uAltitude);
 float sunFacing=pow(max(dot(d,uSun),0.0),5.0);
 vec3 shade=mix(vec3(.003,.006,.012),vec3(.18,.21,.24),day);
 shade*=mix(.68,1.14,fromAbove)*(.46+.96*litDensity/max(1.0-transmittance,.001));
 shade+=vec3(.25,.13,.048)*warm*mix(.45,1.0,fromAbove)*(.4+.6*sunFacing);
 shade+=vec3(.17,.10,.04)*warm*sunFacing*edgeAmount;
 return vec4(shade*alpha,alpha);
}
vec3 rayDirection(){vec4 q=uInvProjection*vec4(vUv*2.0-1.0,1.0,1.0);return normalize((uCameraWorld*vec4(normalize(q.xyz/q.w),0.0)).xyz);}
vec3 ocean(vec3 sky,vec3 d,float t){
 vec2 p=earthPattern(earthPoint(d*t));
 float fade=exp(-t/165000.0);
 float w1=sin(p.x*.0017+uTime*.22)*cos(p.y*.0012-uTime*.17);
 float w2=sin(p.x*.0031-p.y*.0007-uTime*.31);
 vec2 wobble=vec2(w1,w2)*.006*fade;
 vec2 reflectedUv=vec2(clamp(vUv.x+wobble.x,0.0,1.0),clamp(2.0*uHorizonUV-vUv.y+wobble.y,0.0,1.0));
 vec3 reflected=texture2D(uSky,reflectedUv).rgb;
 float fresnel=pow(1.0-max(0.0,-d.y),5.0);
 vec3 deep=vec3(.00045,.0045,.0095);
 vec3 water=mix(deep,reflected*.18+deep*.4,clamp(.18+.65*fresnel,0.0,1.0));
 vec3 n=normalize(vec3(.025*w1,1.0,.03*w2));
 vec3 reflectedSun=reflect(-uSun,n);
 float glint=pow(max(dot(reflectedSun,-d),0.0),85.0);
 glint+=.16*pow(max(dot(reflectedSun,-d),0.0),16.0);
 float sunAbove=smoothstep(-.025,.01,uSun.y);
 water+=vec3(.28,.17,.065)*glint*sunAbove;
 return mix(sky,water,fade*.95);
}
vec3 landscape(vec3 sky,vec3 d,float t){
 vec3 earth=earthPoint(d*t);
 float lon=atan(earth.y,earth.x);
 float lat=atan(earth.z,length(earth.xy)*.99330562);
 vec2 uv=vec2(fract(lon/6.28318530718+.5),clamp(lat/3.14159265359+.5,0.0,1.0));
 float land=texture2D(uLandMask,uv).r;
 vec3 satellite=texture2D(uEarthColor,uv).rgb;
 vec2 q=earthPattern(earth);
 float broad=fbm(q*.000028);
 float fine=fbm(q*.00026);
 float ridges=abs(fbm(q*.000095)-.5)*2.0;
 float dry=smoothstep(.30,.75,broad+.20*abs(sin(lat*2.6)));
 vec3 green=vec3(.022,.066,.037),ochre=vec3(.125,.104,.054);
 vec3 soil=mix(green,ochre,dry);
 soil*=mix(.58,1.34,fine);
 soil=mix(soil,vec3(.23,.22,.18),smoothstep(.52,.83,ridges)*.22);
 float polar=smoothstep(1.12,1.35,abs(lat));
 soil=mix(soil,vec3(.44,.48,.48),polar*.75);
 soil=mix(soil,satellite,.86);
 float localRelief=fbm(q*.00115+vec2(71.0,19.0));
 float landUse=noise2(q*.0031+vec2(11.0,47.0));
 vec2 parcelCell=floor(q/850.0);
 float parcel=hash12(parcelCell+floor(q/9200.0)*7.0);
 float cultivated=smoothstep(.04,.18,satellite.g-satellite.r*.50)*smoothstep(.25,.8,abs(lat));
 soil*=mix(.68,1.35,localRelief)*mix(.76,1.23,landUse)*mix(1.0,mix(.72,1.34,parcel),cultivated*.58);
 float nearDetail=1.0-smoothstep(1800.0,26000.0,t);
 float vegetation=fbm(q*.012+vec2(17.0,63.0));
 float fineCover=noise2(q*.055+vec2(49.0,11.0));
 soil*=mix(1.0,mix(.62,1.36,vegetation)*mix(.88,1.12,fineCover),nearDetail*.63);
 vec3 normal=normalize(d*t+vec3(0.0,uRadius+uAltitude,0.0));
 float light=smoothstep(-.15,.22,dot(normal,uSun));
 soil*=.13+.87*light;
 if(uCoverage>.01&&uSun.y>.18&&t<50000.0){
  vec3 sunEcef=uEast*uSun.x+uUp*uSun.y+uSouth*uSun.z;
  vec3 shadowPoint=earth+sunEcef*(${cloudLayers.cumulus.baseM + .4 * (cloudLayers.cumulus.topM - cloudLayers.cumulus.baseM)}.0/uSun.y);
  vec2 shadowCloud=cumulusSample(shadowPoint,.40,5.1,3900.0,vec3(0.0,0.0,1.0));
  soil*=1.0-.22*shadowCloud.x*smoothstep(.18,.38,uSun.y);
 }
 soil+=vec3(.12,.063,.025)*pow(max(dot(normal,uSun),0.0),3.0)*smoothstep(-.025,.08,uSun.y);
 // Airport runway is fixed in Earth coordinates, so its markings move with the terrain.
 float runwayOverlay=0.0;
 if(uRunwayLength>0.0&&t<22000.0){
  vec3 runwayDelta=earth-uRunwayOrigin;
  float along=dot(runwayDelta,uRunwayForward);
  float across=dot(runwayDelta,uRunwaySide);
  float runway=1.0-smoothstep(30.0,37.0,abs(across));
  runway*=smoothstep(-12.0,2.0,along)*(1.0-smoothstep(uRunwayLength-2.0,uRunwayLength+12.0,along));
  runwayOverlay=runway;
  float edge=(1.0-smoothstep(1.1,2.8,abs(abs(across)-26.0)));
  float center=(1.0-smoothstep(.45,1.25,abs(across)))*step(fract(along/45.0),.48);
  float threshold=(1.0-smoothstep(1.0,3.0,abs(along-28.0)))*(1.0-smoothstep(18.0,21.0,abs(across)));
  vec3 asphalt=vec3(.034,.037,.039)*(0.84+.16*noise2(q*.09));
  asphalt=mix(asphalt,vec3(.63,.65,.61),max(max(edge,center),threshold)*.72);
  soil=mix(soil,asphalt*mix(.22,1.0,light),runway);
 }
 float distanceFade=exp(-t/190000.0);
 vec3 terrain=mix(ocean(sky,d,t),mix(sky,soil,distanceFade*.95),smoothstep(.35,.65,land));
 return mix(terrain,soil,runwayOverlay);
}
void main(){
 vec3 d=rayDirection();
 vec3 linear=texture2D(uSky,vUv).rgb;
 float tGround=firstSphere(d,uRadius);
 // Reconstruct the resolved direct solar disc in camera-linear radiance.
 // Its angle is unchanged; this preserves the geometric Earth occultation.
 float sunAngle=acos(clamp(dot(d,uSun),-1.0,1.0));
 float aa=max(length(fwidth(d)),.00025);
 float disc=1.0-smoothstep(.004653-aa,.004653+aa,sunAngle);
 float lowSun=1.0-smoothstep(.025,.11,uSun.y);
 if(tGround<0.0&&disc>0.0&&lowSun>0.0){
  float airMass=1.0/max(.025,uSun.y+.035);
  vec3 extinction=exp(-vec3(.055,.09,.15)*airMass);
  vec3 chroma=extinction/max(extinction.r,.0001);
  vec3 ambient=texture2D(uSky,vec2(vUv.x,clamp(vUv.y+.018,0.0,1.0))).rgb;
  vec3 direct=chroma*(3.0*exp(-.03*airMass));
  linear=mix(linear,ambient+direct,disc*lowSun);
 }
 if(tGround>0.0)linear=landscape(linear,d,tGround);
 if(uCoverage>.01){
  vec4 low=cloudLayer(d,${cloudLayers.cumulus.baseM}.0,${cloudLayers.cumulus.topM}.0,.00042,5.1,1800.0,tGround,false);
  vec4 mid=cloudLayer(d,${cloudLayers.toweringCumulus.baseM}.0,${cloudLayers.toweringCumulus.topM}.0,.00025,8.3,3000.0,tGround,false);
  vec4 high=cloudLayer(d,${cloudLayers.cirrus.baseM}.0,${cloudLayers.cirrus.topM}.0,.00017,53.2,24000.0,tGround,true);
  if(uAltitude<4800.0){linear=mix(linear,high.rgb/max(high.a,.001),high.a);linear=mix(linear,mid.rgb/max(mid.a,.001),mid.a);linear=mix(linear,low.rgb/max(low.a,.001),low.a);}
  else {linear=mix(linear,low.rgb/max(low.a,.001),low.a);linear=mix(linear,mid.rgb/max(mid.a,.001),mid.a);linear=mix(linear,high.rgb/max(high.a,.001),high.a);}
 }
 float sunHeight=asin(clamp(uSun.y,-1.0,1.0));
 // Human-eye adaptation has a narrow, smooth range; camera exposure stays fixed.
 float adaptation=mix(1.0,mix(1.0,2.6,smoothstep(.03,-.19,sunHeight)),uEye);
 linear*=1.6*uExposure*adaptation;
 // Small optical glare, driven by the same direction as the astronomical disc.
 float angle=acos(clamp(dot(d,uSun),-1.0,1.0));
 float glare=exp(-angle*75.0)*.035+exp(-angle*18.0)*.007;
 linear+=vec3(1.0,.72,.42)*glare*smoothstep(-.08,.0,sunHeight);
 vec3 color=linearToSRGB(aces(max(linear,0.0)));
 float grain=(hash12(gl_FragCoord.xy+fract(uTime)*vec2(41.7,23.9))-.5)/255.0;
 gl_FragColor=vec4(clamp(color+grain,0.0,1.0),1.0);
}`;
