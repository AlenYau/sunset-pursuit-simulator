type Point = [number, number];
type Piece = { b: [number, number, number, number]; r: Point[][] };
type Country = { n: string; e: string; iso: string; p: Piece[] };
type Sea = { e: string; a: number; p: Piece[] };
export type Geography = { countries: Country[]; seas: Sea[] };

const seaNames: Record<string, string> = {
  'Adriatic Sea':'亞得里亞海', 'Aegean Sea':'愛琴海', 'Alboran Sea':'阿爾沃蘭海',
  'Andaman or Burma Sea':'安達曼海', 'Arabian Sea':'阿拉伯海', 'Arafura Sea':'阿拉弗拉海',
  'Arctic Ocean':'北冰洋', 'Baffin Bay':'巴芬灣', 'Balearic (Iberian Sea)':'巴利阿里海',
  'Bali Sea':'峇里海', 'Baltic Sea':'波羅的海', 'Banda Sea':'班達海',
  'Barentsz Sea':'巴倫支海', 'Bass Strait':'巴斯海峽', 'Bay of Bengal':'孟加拉灣',
  'Bay of Biscay':'比斯開灣', 'Bay of Fundy':'芬迪灣', 'Beaufort Sea':'波弗特海',
  'Bering Sea':'白令海', 'Bismarck Sea':'俾斯麥海', 'Black Sea':'黑海',
  'Bristol Channel':'布里斯托海峽', 'Caribbean Sea':'加勒比海', 'Celebes Sea':'蘇拉威西海',
  'Celtic Sea':'凱爾特海', 'Ceram Sea':'塞蘭海', 'Chukchi Sea':'楚科奇海',
  'Coral Sea':'珊瑚海', 'Davis Strait':'戴維斯海峽', 'East Siberian Sea':'東西伯利亞海',
  'Eastern China Sea':'東海', 'English Channel':'英吉利海峽', 'Flores Sea':'弗洛勒斯海',
  'Great Australian Bight':'大澳洲灣', 'Greenland Sea':'格陵蘭海', 'Gulf of Aden':'亞丁灣',
  'Gulf of Alaska':'阿拉斯加灣', 'Gulf of Aqaba':'亞喀巴灣', 'Gulf of Boni':'波尼灣',
  'Gulf of Bothnia':'波的尼亞灣', 'Gulf of California':'加利福尼亞灣',
  'Gulf of Finland':'芬蘭灣', 'Gulf of Guinea':'幾內亞灣', 'Gulf of Mexico':'墨西哥灣',
  'Gulf of Oman':'阿曼灣', 'Gulf of Riga':'里加灣', 'Gulf of St. Lawrence':'聖羅倫斯灣',
  'Gulf of Suez':'蘇伊士灣', 'Gulf of Thailand':'泰國灣', 'Gulf of Tomini':'托米尼灣',
  'Halmahera Sea':'哈馬黑拉海', 'Hudson Bay':'哈德遜灣', 'Hudson Strait':'哈德遜海峽',
  'Indian Ocean':'印度洋', 'Inner Seas off the West Coast of Scotland':'蘇格蘭西岸內海',
  'Ionian Sea':'愛奧尼亞海', 'Irish Sea and St. George\'s Channel':'愛爾蘭海',
  'Japan Sea':'日本海', 'Java Sea':'爪哇海', 'Kara Sea':'喀拉海', 'Kattegat':'卡特加特海峽',
  'Labrador Sea':'拉布拉多海', 'Laccadive Sea':'拉克沙群島海', 'Laptev Sea':'拉普捷夫海',
  'Ligurian Sea':'利古里亞海', 'Lincoln Sea':'林肯海', 'Makassar Strait':'望加錫海峽',
  'Malacca Strait':'麻六甲海峽', 'Mediterranean Sea - Eastern Basin':'地中海東部',
  'Mediterranean Sea - Western Basin':'地中海西部', 'Molukka Sea':'摩鹿加海',
  'Mozambique Channel':'莫三比克海峽', 'North Atlantic Ocean':'北大西洋',
  'North Pacific Ocean':'北太平洋', 'North Sea':'北海', 'Norwegian Sea':'挪威海',
  'Persian Gulf':'波斯灣', 'Philippine Sea':'菲律賓海', 'Red Sea':'紅海',
  'Rio de La Plata':'拉普拉塔河口', 'Savu Sea':'薩武海', 'Sea of Azov':'亞速海',
  'Sea of Marmara':'馬爾馬拉海', 'Sea of Okhotsk':'鄂霍次克海',
  'Seto Naikai or Inland Sea':'瀨戶內海', 'Singapore Strait':'新加坡海峽',
  'Skagerrak':'斯卡格拉克海峽', 'Solomon Sea':'所羅門海',
  'South Atlantic Ocean':'南大西洋', 'South China Sea':'南海',
  'South Pacific Ocean':'南太平洋', 'Southern Ocean':'南冰洋',
  'Strait of Gibraltar':'直布羅陀海峽', 'Sulu Sea':'蘇祿海', 'Tasman Sea':'塔斯曼海',
  'The Coastal Waters of Southeast Alaska and British Columbia':'阿拉斯加東南與卑詩沿岸海域',
  'The Northwestern Passages':'西北航道', 'Timor Sea':'帝汶海',
  'Tyrrhenian Sea':'第勒尼安海', 'White Sea':'白海', 'Yellow Sea':'黃海'
};

function inRing(lon: number, lat: number, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > lat) !== (b[1] > lat) && lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function containingPiece(lon: number, lat: number, pieces: Piece[]): Piece | undefined {
  for (const piece of pieces) {
    const [west, south, east, north] = piece.b;
    if (lat < south || lat > north) continue;
    for (const x of [lon, lon - 360, lon + 360]) {
      if (x < west || x > east || !inRing(x, lat, piece.r[0])) continue;
      if (piece.r.slice(1).some(hole => inRing(x, lat, hole))) continue;
      return piece;
    }
  }
}

function countryArea(country: Country, piece: Piece, lon: number, lat: number): string {
  if (country.iso === 'US' && lat > 50 && lon < -130) return '美國阿拉斯加';
  if (country.iso === 'US' && lat < 25 && lon < -150) return '美國夏威夷';
  const [west, south, east, north] = piece.b;
  if (east - west < 1.5 || north - south < 1.5) return country.n;
  const x = (lon + 360 * Math.round(((west + east) / 2 - lon) / 360) - west) / (east - west);
  const y = (lat - south) / (north - south);
  const vertical = y > .60 ? '北' : y < .36 ? '南' : '';
  const horizontal = x > .68 ? '東' : x < .32 ? '西' : '';
  const direction = horizontal + vertical;
  return `${country.n}${direction ? direction + '部' : '中部'}`;
}

export function lookupLocation(geography: Geography, lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '位置未知';
  const wrappedLon = ((lon + 180) % 360 + 360) % 360 - 180;
  for (const country of geography.countries) {
    const piece = containingPiece(wrappedLon, lat, country.p);
    if (piece) return countryArea(country, piece, wrappedLon, lat);
  }
  let nearest: Sea | undefined;
  for (const sea of geography.seas) {
    if (containingPiece(wrappedLon, lat, sea.p) && (!nearest || sea.a < nearest.a)) nearest = sea;
  }
  return nearest ? (seaNames[nearest.e] ?? nearest.e) : '未命名海域';
}
