# Sunset Pursuit Simulator

本機執行的三維航空日落追逐模擬器。需要 Apple Silicon Mac、Node.js 20.19+ 或 22.12+、支援 WebGL2 的桌面瀏覽器。已在 Node 24、Vite 8 下建置與測試。

## 啟動

在 Terminal 執行：

```bash
git clone https://github.com/AlenYau/sunset-pursuit-simulator.git
cd sunset-pursuit-simulator
npm ci
npm run dev
```

開啟 `http://127.0.0.1:5173/`。亦可雙擊 `start.command`。離線使用時先完成一次 `npm install`；之後不需要雲端服務。`npm test` 執行物理測試，`npm run build` 建置到 `dist/`，`npm run preview` 預覽正式版本。

## 專案結構

```text
src/physics.ts       天文、地平線、WGS84 航跡與日落預測
src/SkyView.tsx       Bruneton 大氣 LUT、WGS84 方向與渲染流程
src/renderShaders.ts  海面、地表、分層雲與曝光合成 shader
src/cloudModel.ts    代表性雲層幾何高度（公尺）
src/aircraftProfiles.ts 機型巡航參考設定與來源
src/flightPlan.ts    ICAO／IATA 解析、跑道選擇、航線與自動駕駛軌跡／ETA
src/RoutePanel.tsx   航線建立、階段與抵達時間介面
src/FlightInstruments.tsx 可開關方形飛行儀表
src/instrumentMath.ts 航跡姿態估計與 ETE 格式
src/geography.ts      離線國家／海域判定與方位標籤
public/geography.json  精簡國家及 IHO 海域邊界
public/airports.json   OurAirports 機場及跑道資料精簡包
public/landmask.png   Natural Earth 海陸遮罩
public/earth-color.jpg NASA Blue Marble 全球真彩色底圖
public/cloud-volume.png 無縫三維雲密度圖集
scripts/generate_landmask.py  海陸遮罩重建工具
scripts/generate_cloud_volume.py  雲密度圖集重建工具
src/main.tsx          控制面板、儀表、預設與時間軸
src/style.css         介面樣式
tests/physics.test.ts 數值回歸測試
tests/aircraftProfiles.test.ts 機型預設與界限測試
tests/geography.test.ts 國家方位、海域與日期變更線測試
tests/flightPlan.test.ts 航線、機場代碼、ETA 與抵達測試
tests/instrumentMath.test.ts 儀表角度與 ETE 測試
dist/                 已建置網頁
start.command         macOS 雙擊啟動
```

## 操作

- 視野中拖曳可轉動相機；「正西視角」與「追蹤太陽」不改變飛機航向。
- 右上角「純畫面」隱藏儀表、側欄及時間軸；按 F 切換、Esc 顯示介面，空白鍵可在沒有編輯輸入欄時播放／暫停。
- 右側調整幾何高度、地速、座標、航向、垂直速度及 UTC。FL 顯示是高度的數值換算，**不是**經氣壓修正的真正壓力高度。
- 高度可到 360,000 ft，地速可到 4,000 kt；高度滑桿在 90,000 ft 以上設有延伸區間，數字欄可精確輸入。13 個機型快捷鍵可一併設定高度與地速，包含 YF-12 與 X-15。地速以零風情境近似公布的 Mach／真空速，不能當成真實機型性能包線。XB-70 的 FL700／M3 為設計條件示例，不表示持續巡航實測值。
- 頂端「飛行儀表」可顯示／隱藏方形 PFD：航跡姿態、地速、高度、航向、垂直速度與 ETE。模擬器未建置獨立的機體俯仰、滾轉動力學，因此藍／棕姿態球顯示**飛行路徑角估計**；自動駕駛轉彎時的傾角按航向變化與地速估算，不是可用於導航的真實姿態儀。
- 視野上方的 AIRCRAFT FRAME 儀表分別顯示機首航向與相機視線方位。雲及地表固定於地球座標，飛機移動時會在視野中向後移動。
- 「恆定航向」在短 WGS84 測地線段上重設航向；「大圓航線」沿測地線前進，顯示航向會逐步變化。
- 當地時間使用可編輯 UTC 偏移；海洋上沒有唯一的民用時區。旁邊另列依經度計算的平均太陽時。
- 時間軸、倒放與 0.1×–3600× 皆使用同一模擬時鐘。暫停時位置、天空與太陽停止更新。
- 底部時間軸可拖動當天 00:00–23:59 UTC，太陽相對地平線的 24 小時曲線預設收起，按「顯示太陽軌跡」展開；拖動會同步更新飛機位置、天空、太陽和航線 ETA。日期可在右側控制面板另行切換。
- 「航線 / AP」接受 ICAO 四字或 IATA 三字機場代碼，會顯示機場名稱。直飛模式從起點機場座標立即以選定機型巡航；程序模擬從跑道起飛，依示範性能加速、轉彎、爬升、巡航、下降及進場。航線面板顯示階段、航點與 UTC ETA。解除 AP 後可用原有控制手動飛行，重接 AP 會回到計畫軌跡。
- ETE TO DEST 是按模擬時鐘和預先計算航線 ETA 得到的剩餘時間（HH:MM），顯示於航線面板、左側儀表及可選 PFD。手動控制解除 AP 後停止顯示 ETE，避免把舊計畫當成目前飛行的預報。
- 實驗 F 在夏至預設極晝；將日期改成 12 月 21 日可看極夜。實驗 C 可把速度改成 193 km/h（約 104.2 kt）比較。

## 計算與驗證

- `src/physics.ts`：Astronomy Engine 計算視位置與真太陽方位／幾何高度；WGS84 測地線計算飛行地理位移。每次太陽高度使用當時飛機位置與 UTC 重新求值。
- 視地平線俯角使用 WGS84 當地方位曲率半徑與幾何高度。日落定義為太陽**上緣**穿越視地平線；視半徑取 0.2666°。
- 折射只在物理層加入一次：近地平線 Bennett 公式乘上隨高度衰減的標準大氣壓力近似。Astronomy Engine 的 `Horizon` 呼叫未啟用其內建折射。
- 相對垂直角速度用前後各 30 模擬秒的相對高度差求得，單位 °/min。日落預測在 36 小時窗口內逐段搜索並二分求交；找不到交點時不顯示倒數。
- `npm test`：22 項通過，涵蓋原有天文及航跡驗證、X-15 高度與速度範圍、YF-12／X-15 預設、X-15 空投限制、航線 ETA、ETE 格式、姿態估計，以及雲層高度區間與 shader 參數一致性。

### 數值抽樣（2026-03-20，0°N 0°E）

| 條件 | 模型結果 |
| --- | --- |
| 100 ft，靜止，太陽上緣日落 | 18:11:39 UTC |
| FL350（以 35,000 ft 幾何高度近似），靜止 | 18:21:43 UTC，延後約 10.1 分鐘 |
| 日落前，靜止相對垂直角速度 | −0.2376°/min |
| 同一時刻，向西 1,300 kt | +0.1049°/min |
| 85°N 夏至正午太陽上緣相對地平線 | +28.91° |
| 85°N 冬至正午太陽上緣相對地平線 | −18.00° |

這些數字是本程式的可重現計算結果；赤道春分附近約 18:00 UTC 日落、極地季節性日照等趨勢與 NOAA／美國海軍天文台公開說明一致。折射與高度模型的誤差界限沒有經實地氣象資料校準。

## 視覺模型與精度界限

- 大氣採用 `@takram/three-atmosphere` 的 Eric Bruneton 預計算散射 LUT，包含 Rayleigh、Mie、多次散射與臭氧吸收。LUT 在本機 WebGL2 GPU 啟動時生成，無須下載雲端貼圖。太陽圓盤角半徑為 0.2666°，太陽方向直接取自 `physics.ts`。在極低仰角，顯示合成另用簡化 RGB Beer–Lambert 消光重建圓盤暖色；這是相機色彩近似，並非完整光譜輻射計算。在 65° 視角及一般桌面尺寸下，真實角直徑只佔幾個像素；Camera Mode 可縮小視野角看清圓盤，物理角度本身不放大。
- 球形大氣模型以 WGS84 觀測者 ECEF 位置及當地切平面對齊；海面命中測試沿用物理層的當地方位曲率半徑。海面採解析球面與程序波法線、Fresnel／方向性太陽反光、螢幕空間天空反射。近距離海面不是完整多重散射水體 PBR。
- 雲層代表性幾何高度依 [WMO 國際雲圖的雲層分類](https://cloudatlas.wmo.int/en/some-useful-concepts-levels.html) 調整：一般積雲包絡約 0.9–3.2 km（雲底屬低層，雲頂可伸入中層）、較高的積雲塔約 2.8–12 km（多數雲頂低於 FL350，少數延伸至更高處）、薄卷雲約 6.5–13 km（溫帶高雲範圍）。10,000 ft 現在可進入低雲頂與積雲塔底交疊的區域，不再被固定在上下雲層間的空白帶。低層與積雲塔採地球座標錨定的隨機雲團、多個錯位三維密度團、128³ 無縫紋理雕刻及沿視線的多步透射率積分；雲頂、側面與雲底的亮度依太陽方向與觀測高度變化。日間陸地雲影使用同一雲場的近似取樣。外觀參考 RFS 的雲團與雲海觀感，沒有使用其素材。高度為代表性天氣場，不是實時氣象觀測；實際雲底、雲頂隨濕度、穩定度、季節及氣團改變。這仍是效能導向的近似體積雲，沒有真實天氣場、完整多次散射或精確雲影。
- 地表海陸分布取自公有領域 Natural Earth 1:50m 陸地邊界，真彩色底圖取自 NASA Blue Marble Next Generation，再加入地球座標錨定的近景地貌與農地色塊。它不是高解析度地形高程或即時衛星影像；全球 4096×2048 底圖在低空／近距離仍會偏柔和。雲紋理同樣錨定地球座標；雲自身的風場與移動目前未模擬。
- Half Float HDR 中間緩衝、ACES 擬合曲線、手動相機曝光、人眼近似暗適應、sRGB 轉換與逐像素細微抖動用於最後合成。眩光為保守的角度衰減近似。
- Low／Medium／High／Ultra 調整像素比與雲層取樣數。預設 Medium 為 0.80 像素比、9 個低／中層採樣步；當連續偵測到低於 28 FPS 時，會降低像素比及雲取樣數。較厚的體積雲比舊雲片耗費更多 GPU 時間；在 1280×720 的瀏覽器檢查中，更新後的高空密雲俯視約 31 FPS，預設日落約 33 FPS，場景和機器不同會有變動。尚未在目標 M1 8GB／16GB 的各種解析度實測，實際效能需以使用者機器為準。
- 折射採標準大氣近似，缺少即時氣溫、氣壓、濕度；高空日落時間不應用於導航或專業觀測。未模擬地形遮擋、海浪高度、雲對太陽位置的天文修正。

## 航線資料與精度界限

- 機場、ICAO／IATA 代碼、座標、標高與跑道端點來自 [OurAirports 公有領域資料](https://ourairports.com/data/)；本地精簡包含 11,260 個有代碼機場，其中 6,588 個具可用跑道資料。小型機場或特殊跑道可能缺資料。資料為匯出時的快照，並非即時 NOTAM。
- 程序模擬使用跑道端點、WGS84 測地線、轉彎率、機型化代表性加減速及垂直速度，再以固定 10 秒間隔預先計算完整航跡。ETA 是此**零風、無 ATC 延誤**模型的抵達時刻，隨起始 UTC 和航線設定計算。倒放或拖動時間軸會重取同一航跡，不會另跑一套太陽動畫。
- **本專案沒有當期 AIRAC 航路資料、正式 SID／STAR、進場圖、航路限制、空域、風場、航機重量、油量或 ATC 放行**。航點是程序流程示範，不能稱為真實營運航班 flight plan，也不能用於導航。[FAA CIFP](https://www.faa.gov/air_traffic/flight_info/aeronav/productcatalog/digitalproducts/cifp/) 等正式程序資料有更新週期與適用範圍，不能憑機場連線自動推測全球合法航路。
- 跑道視覺標線依實際端點與方向固定在地球座標上，但地表尚無機場高程 DEM、滑行道、航站樓或本地跑道寬度資料。高海拔機場的地面畫面及最後落地幾何仍屬示意。
- YF-12 預設為 75,000 ft、約 Mach 3.2 在標準大氣及零風下的 1,835 kt 運動學示例。官方 1965 年速度紀錄 2,070.101 mph、另一高度紀錄 80,257.65 ft 是**獨立紀錄**，不可當成同一時刻的速度／高度配對。[美國空軍國家博物館資料](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/195777/lockheed-yf-12a/)。
- X-15 預設展示 1967 年速度紀錄飛行的約 4,520 mph（3,928 kt）與該次飛行約 102,000 ft 的最高高度；兩個峰值並非同一瞬間。1963 年另一飛行的 354,200 ft 高度紀錄可在高度欄手動輸入，**不會自動同時套上速度紀錄**。[NASA X-15 研究資料](https://ntrs.nasa.gov/api/citations/20040058111/downloads/20040058111.pdf?attachment=true)。X-15 由 B-52 約 45,000 ft 空投，火箭推力約 80–120 秒，隨後滑翔降落；因此機場起降程序模式禁止選用，直飛模式只用於太陽相對運動的瞬時假設，並未模擬真實火箭飛行、熱防護或彈道。[NASA 飛行計畫說明](https://www.nasa.gov/reference/x-15/)。
- 大氣渲染在 X-15 的 354,200 ft 紀錄高度可展示太空邊緣視覺，但它仍採用原有球形大氣 LUT 與近似地表 shader，沒有對近太空光學、機體姿態或再入動力學做科學級驗證。為避免某些 Mac 的 WebGL 合成器產生灰色模糊矩形，本版關閉了 UI 的背景模糊，保留半透明面板。

## 目前位置名稱

儀表中的經緯度下方及右側飛行控制面板會顯示約略位置，並隨飛行座標同步更新。陸地先以 [Natural Earth 1:50m Admin 0 Countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries/) 多邊形判定國家，再按所在主要陸塊的外接範圍標示東、南、西、北或組合方位；海域使用 [Flanders Marine Institute 的 IHO Sea Areas v3](https://www.marineregions.org/sources.php) 多邊形及繁體中文譯名。後者依 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 提供，資料引用：Flanders Marine Institute (2018), IHO Sea Areas, version 3, DOI: 10.14284/323。兩份邊界已放入本機檔案，瀏覽時無須呼叫地理編碼服務。方位屬幾何近似，海岸、島嶼、爭議邊界及海域劃分可能與其他地圖不同；名稱不用作導航或主權判斷。

## 視覺驗收檢查

已在瀏覽器逐一檢查 100 ft 海平面日落、FL350 觸地平線、FL590 太陽消失、FL650 地平線下方、85°N 低角度太陽與日落後暮光。檢查中發現高緯曲線在折射截止處出現跳階，已改為平滑衰減並新增測試；亦依截圖收窄海面金色反光並降低遠距離雲的密度。太陽圓盤、地平線遮擋與儀表使用同一個天文狀態。

本輪另以瀏覽器檢查 10,000 ft 歐洲陸地上空的雲底、雲頂、地面與純畫面模式。450 kt、1× 播放約 15 模擬秒後，經度由 8.000° 移至 7.950°，前後截圖顯示近雲與地面紋理產生視差。移動來自 WGS84 航跡與地球座標固定的雲／地表，而非額外的視覺滾動速度。

追加的高空俯視檢查顯示雲量不足，已提高 Scattered／Broken 雲團出現率、縮小雲團水平間距並增加錯位雲頂；重新檢查 FL350 的雲海與預設日落畫面。雲團仍有程序化重複感，不能等同真實天氣場或商業飛行模擬器的完整體積雲。

依賴用途：`astronomy-engine`（太陽星曆）、`geographiclib-geodesic`（WGS84 測地線）、`@takram/three-atmosphere`（Bruneton 大氣）、`three`（WebGL2 場景與 shader）、`react`／`react-dom`（互動 UI）、`lucide-react`（圖示）、Vite／TypeScript／Vitest（建置、型別、測試）。`postprocessing` 是大氣套件的 peer dependency，目前合成流程使用本專案 shader。沒有付費 API。

參考：[Astronomy Engine](https://github.com/cosinekitty/astronomy)、[Takram Bruneton 大氣實作](https://github.com/takram-design-engineering/three-geospatial/blob/main/packages/atmosphere/README.md)、[NOAA 日落計算說明](https://gml.noaa.gov/grad/solcalc/calcdetails.html)、[Three.js 色彩管理](https://threejs.org/manual/pages/color-management.html)。

機型參考：[Boeing 737 MAX 高度資料](https://businessjets.boeing.com/government-transport/)、[Boeing 787 巡航 Mach](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_Rev_P.pdf)、[Airbus A350](https://www.aircraft.airbus.com/en/aircraft/a350/a350-900)、[Airbus A330-900](https://www.aircraft.airbus.com/en/aircraft/a330/a330-900)、[Boeing 777](https://www.boeing.com/commercial/777/design-highlights)、[Boeing 747-8](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/747-8_Rev_E.pdf)、[Airbus A380](https://www.airbus.com/sites/g/files/jlcbta136/files/2021-12/EN-Airbus-A380-Facts-and-Figures-December-2021_0.pdf)、[British Airways 協和式](https://hotline.britishairways.com/content/information/about-ba/history-and-heritage/celebrating-concorde)、[NASA ER-2](https://www.nasa.gov/centers-and-facilities/armstrong/er-2-aircraft/)、[NASA XB-70](https://www.nasa.gov/aeronautics/xb-70-valkyrie/)、[NASA SR-71](https://www.nasa.gov/image-article/sr-71-2/)。地表來源：[Natural Earth](https://www.naturalearthdata.com/about/)、[NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/)。
