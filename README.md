# Pomodoro Desktop
 
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-36-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![electron-builder](https://img.shields.io/badge/electron--builder-26-brightgreen)](https://electron.build)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-active%20development-blue)]()
 
> A cross-platform Pomodoro timer that lives in your system tray — built with React, TypeScript, and Electron.
 
---
 
## About The Project
 
Pomodoro Desktop is a focused productivity timer built as a native cross-platform desktop application using **React** for the UI layer and **Electron** as the desktop runtime. It packages into distributable installers for Windows (NSIS), macOS (DMG), and Linux (AppImage) via `electron-builder`.
 
The project explores the Electron IPC model — using `contextBridge` and typed IPC channels to safely bridge the renderer process (React) with the main process (Node.js), enabling features like system tray synchronization and native OS notifications without exposing Node.js APIs directly to the renderer.
 
This is a learning-oriented project built to understand the architecture of cross-platform desktop applications — but it is structured with production conventions in mind: `contextIsolation: true`, `nodeIntegration: false`, a `preload.js` security boundary, and automated cross-platform builds.
 
---
 
## Project Type
 
Cross-Platform Desktop Application — React + Electron
 
---
 
## Project Status
 
**Active Development** — Core functionality complete. UI polish and test coverage are in progress.
 
---
 
## Why I Built This
 
The goal was to go beyond browser-based React apps and understand how desktop application development works — specifically:
 
- How Electron separates the renderer and main process, and why that boundary exists
- How IPC messaging works in a secure Electron setup (`contextBridge`, `contextIsolation`)
- How `electron-builder` handles cross-platform packaging and OS-specific installer targets
- What it takes to build something that behaves like a real native app (tray, notifications, close-to-tray behavior)
The Pomodoro timer domain was deliberately chosen for its simplicity — the focus was on the infrastructure, not the feature complexity.
 
---
 
## Features
 
### Core Features
- 25-minute focus sessions with visual countdown
- Frameless, resizable-locked window (400×400) for minimal desktop footprint
- Close and minimize to system tray — app stays running without a visible window
### Electron / Native Features
- **System tray icon** with live countdown tooltip (updates as timer ticks)
- **Tray context menu** showing current session status and remaining time
- **Native OS desktop notifications** when a session ends (fires via `Notification` API in main process)
- Clicking the notification brings the app window back to focus
- Programmatic fallback tray icon if the asset file is missing (no crash on cold setup)
- Single-click tray icon toggles window visibility
### Security Architecture
- `contextIsolation: true` — renderer has no direct Node.js access
- `nodeIntegration: false` — standard Electron security posture
- `preload.js` exposes a typed API surface (`window.electronAPI`) via `contextBridge`
- IPC channels are one-directional (renderer → main) for timer and window control
### Build & Distribution
- Cross-platform packaging: Windows NSIS installer, macOS DMG, Linux AppImage
- `asar` archive packing for production builds
- Desktop shortcut and Start Menu entry created on Windows install

---
 
## Tech Stack
 
| Layer | Technology | Reason |
|---|---|---|
| **UI Framework** | React 19 + TypeScript | Component model for timer state; TypeScript for safety |
| **Desktop Runtime** | Electron 36 | Cross-platform desktop packaging with native OS API access |
| **IPC Security** | contextBridge + preload.js | Isolates renderer from Node.js; Electron-recommended security pattern |
| **Packaging** | electron-builder 26 | Handles NSIS (Windows), DMG (macOS), AppImage (Linux) in one config |
| **Styling** | CSS (React) | Scoped styles; no external UI library for this scope |
| **Testing** | @testing-library/react | Component-level unit testing |
| **Build** | react-scripts (CRA) | Established toolchain; focus was Electron architecture, not bundler config |
 
---
 
## Architecture
 
```
┌─────────────────────────────────────────────┐
│              Electron Main Process          │
│  (Node.js)                                  │
│                                             │
│  ┌───────────┐   ┌──────────┐   ┌────────┐  │
│  │ BrowserWin│   │   Tray   │   │  IPC   │  │
│  │   (UI)    │   │ (icon +  │   │ Handler│  │
│  │           │   │  menu)   │   │        │  │
│  └─────┬─────┘   └────┬─────┘   └───┬────┘  │
│        │              │             │       │
└────────┼──────────────┼─────────────┼───────┘
         │  preload.js  │             │
         │  (bridge)    │             │
┌────────▼──────────────▼─────────────▼───────┐
│           Renderer Process (React)          │
│                                             │
│  window.electronAPI.updateTimer(status, s)  │
│  window.electronAPI.notify(title, body)     │
│  window.electronAPI.closeApp()              │
│  window.electronAPI.minimizeApp()           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         Timer Component             │    │
│  │  - countdown state                  │    │
│  │  - session type (work / break)      │    │
│  │  - sends IPC on tick + completion   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘

```
 
**Request lifecycle (timer tick):**
1. React timer ticks in renderer process
2. Renderer calls `window.electronAPI.updateTimer(status, secondsLeft)`
3. `preload.js` forwards as `ipcRenderer.send("timer-update", payload)` 
4. Main process `ipcMain.on("timer-update")` handler rebuilds tray context menu
5. Tray tooltip updates with formatted `MM:SS` remaining
**Session completion:**
1. Renderer calls `window.electronAPI.notify(title, body)`
2. Main process creates a `new Notification(...)` with `notif.show()`
3. Click handler on the notification calls `mainWindow.show()` + `.focus()`
   
---
 
## Folder Structure
 
```
cute-pomodoro/
├── public/
│   ├── electron.js        # Electron main process entry point
│   ├── preload.js         # contextBridge IPC surface (security boundary)
│   ├── index.html         # React app HTML shell
│   ├── manifest.json
│   └── robots.txt
├── src/
│   ├── assets/
│   │   ├── icon.ico       # Windows build icon
│   │   ├── icon.icns      # macOS build icon
│   │   └── tray-icon.png  # System tray icon (16×16 or 22×22)
│   ├── App.tsx            # Root React component
│   ├── index.tsx          # React entry point
│   └── ...                # Timer components, styles
├── package.json           # electron-builder config + scripts
└── tsconfig.json
```
 
---
 
## Installation
 
### Prerequisites
 
- Node.js 18+ (with npm)
- Git
### Steps
 
```bash
git clone https://github.com/khuswant18/POMODORO.git
cd POMODORO
 
npm install
 
npm run start          
npm run electron       
```
 
> Note: You need to start the React dev server before launching Electron in development mode, as `electron.js` loads `http://localhost:3000` when `app.isPackaged` is false.
 
### Build for Distribution
 
```bash
npm run dist
```
 
This runs `react-scripts build` then `electron-builder`, outputting platform-specific installers to `dist/`.
 
---
 
## Usage
 
1. Launch the app — a 400×400 frameless window appears
2. Start a focus session from the timer UI
3. The system tray icon tooltip updates every second with remaining time
4. Right-click the tray icon to see session status or quit
5. When the session ends, a native OS notification fires
6. Clicking the notification restores the window from tray
7. Closing the window hides it to tray — the timer keeps running
8. To fully quit, use "Quit" from the tray context menu
   
---
 
## Tradeoffs & Limitations
 
- **CRA (create-react-app):** The project uses `react-scripts` for the React layer. CRA is no longer actively maintained by Meta. For a new project today, Vite would be the better choice — faster dev server, smaller output, more flexible config. CRA was used here to keep the tutorial setup accessible.
- **Tray rebuild on every tick:** `Menu.buildFromTemplate()` is called every second. In practice this is fine for this window size, but it is not efficient.
- **No auto-start on login:** The app does not register itself to start on system login, which is a standard expectation for tray-resident apps.
- **No timer persistence:** If the app crashes or is force-quit, the current session is lost.
- **Single-window only:** There is no multi-window or multi-session architecture.
  
---
 
## Challenges Faced
 
- **Security model for Electron IPC:** Understanding why `nodeIntegration: false` + `contextBridge` is the correct pattern (versus the older, insecure approach of exposing Node APIs directly) required reading through the Electron security documentation carefully.
- **Close-to-tray vs quit behavior:** Intercepting the `close` event and suppressing it required handling `app.isQuitting` state across the `before-quit`, `window-all-closed`, and `close` event lifecycle — the interaction between these events is non-obvious.
- **Tray icon on all platforms:** The tray icon path differs between packaged and unpackaged builds (`process.resourcesPath` vs `__dirname`). The fallback programmatic icon handles cases where the asset doesn't exist, preventing a startup crash during development.
- **macOS notification permissions:** Notifications on macOS require the app to be code-signed or running under Electron's own identity in development. This is invisible in most docs and surfaces only at runtime.
  
---
 
## What I Learned
 
- The Electron process model: renderer (Chromium, sandboxed) vs. main (Node.js, full OS access) and why the bridge exists
- `contextBridge.exposeInMainWorld()` as the secure way to expose typed APIs from the main process to React
- Electron app lifecycle events and how `before-quit`, `window-all-closed`, and `close` interact
- `electron-builder` configuration for multi-platform targets, ASAR packaging, and icon asset requirements per OS
- The practical difference between hiding a window and destroying it, and why tray-resident apps need to manage this explicitly
- How `nativeImage` can programmatically generate icons as a zero-dependency fallback
  
---
 
## Contribution Guidelines
 
This is primarily a personal learning project. If you find a bug or have a suggestion, feel free to open an issue. Pull requests that address items in the Known Issues or Technical Debt sections are welcome.
 
1. Fork the repository
2. Create a feature branch (`git checkout -b fix/tray-menu-performance`)
3. Commit your changes
4. Open a pull request with a clear description of the change
   
## Author

**Khuswant Rajpurohit**
- GitHub: [@khuswant18](https://github.com/khuswant18)

---

## License

This project is licensed under the [MIT License](./LICENSE).
---
