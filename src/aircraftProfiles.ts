// Representative still-air ground speeds for comparing simulated flight paths.
// Published Mach/TAS figures are not ground speed; actual wind is not modeled.
export type AircraftProfile = {
  name: string;
  shortName: string;
  altitudeFt: number;
  speedKt: number;
  note: string;
  source: string;
};

export const aircraftProfiles: AircraftProfile[] = [
  { name: 'Boeing 737 MAX', shortName: '737 MAX', altitudeFt: 35000, speedKt: 450, note: '民航巡航示例 · FL350', source: 'https://businessjets.boeing.com/government-transport/' },
  { name: 'Boeing 787', shortName: '787', altitudeFt: 39000, speedKt: 488, note: 'M0.85 零風近似 · FL390', source: 'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_Rev_P.pdf' },
  { name: 'Airbus A350', shortName: 'A350', altitudeFt: 41000, speedKt: 488, note: 'M0.85 零風近似 · FL410', source: 'https://www.aircraft.airbus.com/en/aircraft/a350/a350-900' },
  { name: 'Airbus A330-900', shortName: 'A330neo', altitudeFt: 37000, speedKt: 471, note: 'M0.82 零風近似 · FL370', source: 'https://www.aircraft.airbus.com/en/aircraft/a330/a330-900' },
  { name: 'Boeing 777-300ER', shortName: '777-300ER', altitudeFt: 37000, speedKt: 483, note: 'M0.84 零風近似 · FL370', source: 'https://www.boeing.com/commercial/777/design-highlights' },
  { name: 'Boeing 747-8 Intercontinental', shortName: '747-8I', altitudeFt: 35000, speedKt: 492, note: 'M0.855 零風近似 · FL350', source: 'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/747-8_Rev_E.pdf' },
  { name: 'Airbus A380', shortName: 'A380', altitudeFt: 38000, speedKt: 488, note: 'M0.85 零風近似 · FL380', source: 'https://www.airbus.com/sites/g/files/jlcbta136/files/2021-12/EN-Airbus-A380-Facts-and-Figures-December-2021_0.pdf' },
  { name: 'Concorde', shortName: '協和式', altitudeFt: 59000, speedKt: 1165, note: '約 M2 · FL590', source: 'https://hotline.britishairways.com/content/information/about-ba/history-and-heritage/celebrating-concorde' },
  { name: 'NASA ER-2', shortName: 'ER-2', altitudeFt: 65000, speedKt: 410, note: '高空研究機 · FL650', source: 'https://www.nasa.gov/centers-and-facilities/armstrong/er-2-aircraft/' },
  { name: 'XB-70 Valkyrie', shortName: 'XB-70', altitudeFt: 70000, speedKt: 1740, note: 'M3 設計條件 · FL700', source: 'https://www.nasa.gov/aeronautics/xb-70-valkyrie/' },
  { name: 'SR-71 Blackbird', shortName: 'SR-71', altitudeFt: 85000, speedKt: 1850, note: '約 M3.2 · FL850', source: 'https://www.nasa.gov/image-article/sr-71-2/' },
  { name: 'Lockheed YF-12A', shortName: 'YF-12', altitudeFt: 75000, speedKt: 1835, note: 'M3.2、75,000 ft 示範條件；地速採零風標準大氣換算。官方獨立紀錄：2,070.101 mph 與 80,257.65 ft', source: 'https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/195777/lockheed-yf-12a/' },
  { name: 'North American X-15A-2', shortName: 'X-15', altitudeFt: 102000, speedKt: 3928, note: '1967 速度紀錄飛行：4,520 mph ≈ 3,928 kt；該次飛行最高約 102,000 ft，速度峰值與高度峰值並非同一瞬間。1963 另創 354,200 ft 高度紀錄。空投火箭機，非持續巡航', source: 'https://ntrs.nasa.gov/api/citations/20040058111/downloads/20040058111.pdf?attachment=true' },
];

export function nearbyAircraft(altitudeFt: number, speedKt: number): AircraftProfile | undefined {
  return aircraftProfiles
    .filter(profile => Math.abs(profile.altitudeFt - altitudeFt) <= 2500 && Math.abs(profile.speedKt - speedKt) <= 70)
    .sort((a, b) =>
      (Math.abs(a.altitudeFt-altitudeFt)/2500 + Math.abs(a.speedKt-speedKt)/70) -
      (Math.abs(b.altitudeFt-altitudeFt)/2500 + Math.abs(b.speedKt-speedKt)/70)
    )[0];
}
