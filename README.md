# Sunset Pursuit Simulator · 日落追逐模擬器

An interactive, browser-based aviation sunset simulator with astronomical solar positions, WGS84 flight movement, a rendered atmosphere, Earth, ocean, and procedural clouds.

以真實太陽星曆與 WGS84 飛行位移驅動的瀏覽器航空日落模擬器，包含大氣、地球、海洋與程序化雲層。

**Live site／線上版本:** [Open the simulator／開啟模擬器](https://sunset-pursuit-simulator-3d.alenyau.chatgpt.site/)

**Unity port／Unity 移植版:** [Source and current verification status／原始碼與目前驗證狀態](unity/README.md). This is an experimental project; the live site still runs the verified Three.js build.／此版本仍在開發，線上網站繼續使用已驗證的 Three.js 版本。

## English

### Requirements

- Node.js 20.19+ or 22.12+ and npm.
- A desktop browser with WebGL 2. Apple Silicon Macs are the primary target; other compatible desktop systems may work.
- Internet access is needed for the initial dependency install, but the local app does not call a paid API.

### Install and run

```bash
git clone https://github.com/AlenYau/sunset-pursuit-simulator.git
cd sunset-pursuit-simulator
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. On macOS, you can also double-click `start.command` after installing dependencies.

### Configuration and controls

The app needs no API key or environment file. Use the right-hand panel to set geometric altitude, ground speed, latitude, longitude, aircraft heading, vertical speed, UTC date/time, cloud coverage, camera mode, and graphics quality. The bottom timeline spans the current UTC day. Playback from 0.1× to 3600× uses one simulation clock; **1× is real time**. Drag the view to look around; the West and Sun buttons change camera direction without changing aircraft heading. The **F** key toggles the immersive view, **Esc** restores the controls, and **Space** plays or pauses when no input is focused.

The flight plan panel accepts ICAO or IATA airport codes and offers direct or procedural demonstration routes with ETA and ETE. Aircraft presets set representative altitude and speed values. Preset speeds use a no-wind ground-speed approximation; they are not complete aircraft performance models. The displayed FL is a numeric conversion of geometric altitude, not a pressure-altitude calculation. Procedural routes do **not** include current AIRAC, official SID/STAR procedures, ATC clearance, winds, or terrain elevation. Do not use this simulator for navigation.

### Build and test

```bash
npm test
npm run build
npm run preview
```

`npm run build` creates `dist/`. `npm run preview` serves that production build locally. The physics and route modules are separate from the rendering shaders. See [technical notes](docs/TECHNICAL.zh-TW.md) for numerical examples, approximations, data provenance, and performance limits.

## 繁體中文

### 系統需求

- Node.js 20.19+ 或 22.12+，以及 npm。
- 支援 WebGL 2 的桌面瀏覽器。主要以 Apple Silicon Mac 為目標；其他相容的桌面系統亦可嘗試。
- 首次安裝套件需要網路；本機執行不需要付費 API。

### 安裝與啟動

```bash
git clone https://github.com/AlenYau/sunset-pursuit-simulator.git
cd sunset-pursuit-simulator
npm ci
npm run dev
```

開啟 **http://127.0.0.1:5173/**。Mac 安裝依賴後也可雙擊 `start.command` 啟動。

### 設定與操作

無需 API 金鑰或環境設定檔。右側面板可調整幾何高度、地速、緯度、經度、飛機航向、垂直速度、UTC 日期時間、雲量、相機模式及畫質。底部時間軸涵蓋當天的 UTC 24 小時。0.1× 至 3600× 倍速共用同一模擬時鐘；**1× 對應真實時間**。拖曳畫面可自由觀看；正西視角與追蹤太陽只改變相機方向，不改變航向。按 **F** 切換純畫面、**Esc** 顯示控制介面，沒有編輯輸入欄時按 **Space** 可播放或暫停。

航線面板接受 ICAO 四字或 IATA 三字機場代碼，提供直飛與程序示範模式，並顯示 ETA／ETE。機型預設會套用代表性的高度與地速。地速以零風條件近似，並非完整機型性能模型。畫面中的 FL 是幾何高度的數值換算，不是真正氣壓高度。程序航線**不含**當期 AIRAC、正式 SID／STAR、ATC 放行、風場或地形高程；請勿用於導航。

### 建置與測試

```bash
npm test
npm run build
npm run preview
```

`npm run build` 產生 `dist/`；`npm run preview` 在本機預覽正式建置。天文／航跡模組與畫面 shader 分離。數值範例、近似條件、資料來源與效能限制請參閱[技術說明](docs/TECHNICAL.zh-TW.md)。

## Source, assets, and license／程式、素材與授權

The original application code is released under the [MIT License](LICENSE). The bundled third-party datasets and imagery keep their respective terms; the MIT license does not relicense them. See [asset attributions](THIRD_PARTY_ASSETS.md). Dependencies are installed from npm and keep their own licenses.

原創應用程式碼採用 [MIT License](LICENSE)。隨附的第三方資料及影像仍依各自授權使用，並不因程式碼採 MIT 授權而改變；詳見[素材來源與標示](THIRD_PARTY_ASSETS.md)。npm 依賴套件亦保留各自授權。
