# Sunset Pursuit Simulator — Unity port

This is the Unity 6 port of the browser simulator. It keeps the same astronomical source and flight clock while moving the atmosphere, curved Earth, ocean, and clouds into a Unity full-screen shader. It is a **work in progress**, kept beside the verified Three.js site so that the live site remains available.

這是瀏覽器版的 Unity 6 移植專案。太陽星曆、飛行位移與時間共用同一個 C# 模型；大氣、地球曲率、海洋與雲改由 Unity Shader 繪製。目前仍屬**開發中的移植版**，原有網站照常可用。

## Open and run · 開啟與執行

1. Install Unity 6.3 LTS Editor **6000.3.28f1**, Apple silicon build, with macOS Build Support. Add Web Build Support if a browser build is needed. / 安裝 Apple Silicon 版 Unity 6.3 LTS Editor **6000.3.28f1**，以及 macOS Build Support；如需網頁版，另安裝 Web Build Support。
2. Add this directory as an existing project in Unity Hub. / 在 Unity Hub 將此資料夾加入既有專案。
3. Allow initial asset import. The editor setup creates `Assets/Scenes/SunsetPursuit.unity` automatically and adds it to Build Settings. / 等待首次匯入，編輯器會自動建立場景並加入建置清單。
4. Press Play. The bootstrap creates the camera and simulator. / 按下 Play；啟動程式會建立相機與模擬器。
5. Use **Sunset Pursuit → Build macOS** or **Build Web** in the Editor menu. / 透過編輯器選單 **Sunset Pursuit → Build macOS / Build Web** 建置。

The only external source included is Astronomy Engine C# under its MIT license. The project has no Asset Store packages or cloud API. / 唯一納入的外部程式碼是採 MIT 授權的 Astronomy Engine C#；不依賴 Asset Store 套件或雲端 API。

## Controls · 操作

- Drag the central view to look around; use the west view or sun tracking controls to recenter. / 拖曳畫面中央旋轉視角；可一鍵返回正西或追蹤太陽。
- Right panel: altitude 100–360,000 ft, ground speed 0–4,000 kt, latitude, longitude, heading, vertical speed, 13 aircraft references, five cloud-cover levels, four quality levels, FOV, exposure, UTC, experiments, ICAO/IATA airport route and autopilot. / 右側面板提供飛行、環境、時間、機型與機場航線設定。
- Bottom: play, reverse, step, speed multiplier, and a 24-hour UTC slider. / 底部可播放、倒放、單步、調整倍率及拖曳 24 小時 UTC 時間軸。
- `Space`: play/pause. `F`: immersive view. `Esc`: restore UI. / `Space` 暫停／播放；`F` 沉浸模式；`Esc` 顯示介面。

## Clouds · 雲層

The 2080×1040 atlas stores 128 slices of generated three-dimensional noise. The shader reconstructs 3D density, sculpts multiple lobes per cumulus cell, and raymarches low cumulus (900–3,200 m), taller middle clouds (2,800–12,000 m), and thin high cirrus. Lighting follows the astronomical sun direction. Geographic movement shifts the cloud field opposite the aircraft; pausing the simulation also stops cloud movement. Quality presets change raymarch steps and render scale.

2080×1040 的貼圖包含 128 層三維程序化噪聲。Shader 重建三維密度，將數個雲團組成大塊積雲，再對低空積雲（900–3,200 m）、較高的中層雲（2,800–12,000 m）及薄卷雲進行取樣。光照取自天文模型的太陽方向；地理位置改變時雲場相對機身後移，暫停則停止。四檔畫質調整採樣步數與渲染比例。

## Numerical checks · 數值驗證

With .NET 10 installed, run:

```sh
dotnet run --project Tests/CoreParity.csproj
```

The harness compares the C# core against reference values generated from the original TypeScript implementation: 65 astronomy and movement assertions across 9 scenarios, plus direct and procedural JFK–LHR route checks. Cases include equinox, altitude changes, westbound pursuit, 85°N summer/winter, crossing the date line, polar travel, climbing, and sunset prediction. The fixture can be regenerated with `node Tests/generate-reference.mjs` when the adjacent browser checkout has `npm ci` dependencies installed.

已以原版 TypeScript 產生的基準值核對 C# 核心：9 組情境、65 項天文與位移檢查，以及 JFK–LHR 直飛與程序模擬航線檢查。

## Current verification and limits · 目前驗證範圍與限制

- C# core and route tests pass. Unity Editor could not be downloaded on this Mac: the official regional download endpoint returned HTTP 404. **Unity scene rendering, shader compilation, macOS build, Web build, frame rate, and screenshots have not yet been verified.** / C# 核心與航線測試已通過；此 Mac 的 Unity Editor 官方下載端點回傳 HTTP 404，因此**尚未驗證 Unity 畫面、Shader 編譯、macOS／網頁建置、幀率與截圖**。
- The shader is a performance-aware single-scattering approximation with 3D density clouds. It does not claim to be a full Bruneton multiple-scattering or meteorological forecast model. Cloud heights are representative envelopes, not live weather. / Shader 使用性能可控的單次散射與三維密度雲近似；不是完整 Bruneton 多重散射或即時氣象模型。
- Geodesic flight uses WGS84 Vincenty direct/inverse methods; the inverse has a spherical fallback for nearly antipodal pairs. Current airport procedures are demonstrative path geometry, not published SID/STAR, ATC clearance, or wind-aware flight plans. / 航跡採 WGS84 Vincenty 算法；近對跖點逆算有球面備援。機場流程為示範幾何，並非正式航圖程序或 ATC 放行。
- The C# solar model uses Astronomy Engine without built-in refraction, then adds one height-scaled Bennett approximation. The horizon uses directional WGS84 curvature. / 天文計算不套用函式庫內建折射，僅加入一次高度修正的 Bennett 近似；地平線使用 WGS84 方向曲率。
- The current UI is functional Unity IMGUI. A final production UI and visual tuning require running the Unity Editor and reviewing captures on the target M1 Mac. / 現階段 UI 為可操作的 Unity IMGUI；正式介面與畫質調整仍需在 M1 的 Unity Editor 內截圖檢查。

See [third-party credits](THIRD_PARTY_ASSETS.md) and [MIT license](LICENSE). / 素材與程式碼授權見連結文件。
