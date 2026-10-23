const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require("electron");
const path = require("path");

let mainWindow = null;
let tray = null;

// ─── Tray icon helpers ────────────────────────────────────────────────────────

/**
 * Build a simple fallback tray icon programmatically using nativeImage.
 * Replace this with a real .png (16×16 or 22×22) at src/assets/tray-icon.png
 * and swap the createTrayIcon() call below to use that file instead.
 */
function createFallbackIcon() {
  // 16×16 solid circle — visible on both light and dark system trays
  const size = 16;
  const img = nativeImage.createEmpty();
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const inCircle = Math.sqrt(cx * cx + cy * cy) < size / 2 - 1;
      const i = (y * size + x) * 4;
      canvas[i] = 220;       // R
      canvas[i + 1] = 80;    // G
      canvas[i + 2] = 60;    // B
      canvas[i + 3] = inCircle ? 255 : 0; // A
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function getTrayIcon() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "tray-icon.png")
    : path.join(__dirname, "../src/assets/tray-icon.png");

  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) return icon;
  } catch (_) {}

  return createFallbackIcon();
}

// ─── Tray setup ───────────────────────────────────────────────────────────────

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip("Cute Pomodoro");

  updateTrayMenu("idle", 0);

  // Single click → show/hide window
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * Rebuild the context menu whenever timer state changes.
 * @param {"idle"|"work"|"break"} status
 * @param {number} secondsLeft
 */
function updateTrayMenu(status, secondsLeft) {
  if (!tray) return;

  const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const s = (secondsLeft % 60).toString().padStart(2, "0");

  const statusLabel =
    status === "work"  ? `🍅  Work — ${m}:${s} remaining` :
    status === "break" ? `☕  Break — ${m}:${s} remaining` :
                         "⏸  Timer idle";

  const contextMenu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: "separator" },
    {
      label: "Show window",
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      }
    },
    {
      label: "Quit",
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Also update tooltip with live time so it's readable without right-clicking
  if (status !== "idle") {
    tray.setToolTip(`Cute Pomodoro — ${statusLabel.replace(/^[^ ]+ /, "")}`);
  } else {
    tray.setToolTip("Cute Pomodoro");
  }
}

// ─── Main window ─────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "WorkFaster",
    width: 400,
    height: 400,
    frame: false,
    titleBarStyle: "hidden",
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  if (mainWindow.setWindowButtonVisibility) {
    mainWindow.setWindowButtonVisibility(false);
  }

  // ── Minimize to tray instead of closing ──────────────────────────────────
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();   // intercept the close
      mainWindow.hide();         // hide instead
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

// Close button → hide to tray (same as clicking X)
ipcMain.on("close-app", () => {
  if (mainWindow) mainWindow.hide();
});

// Minimize button → hide to tray
ipcMain.on("minimize-app", () => {
  if (mainWindow) mainWindow.hide();
});

// Quit completely (tray menu → Quit)
ipcMain.on("quit-app", () => {
  app.isQuitting = true;
  app.quit();
});

// React sends timer state updates so the tray tooltip stays in sync
ipcMain.on("timer-update", (_, { status, secondsLeft }) => {
  updateTrayMenu(status, secondsLeft);
});

// ── Notifications ─────────────────────────────────────────────────────────────

function getNotificationIcon() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "tray-icon.png")
    : path.join(__dirname, "../src/assets/tray-icon.png");
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  } catch (_) {}
  return undefined;
}

/**
 * Show a native desktop notification.
 * Clicking it brings the app window to front — works even when minimised to tray.
 */
function showNotification({ title, body }) {
  if (!Notification.isSupported()) return;

  const icon = getNotificationIcon();
  const notif = new Notification({
    title,
    body,
    ...(icon ? { icon } : {}),
    timeoutType: "default",
    urgency: "normal",
  });

  notif.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notif.show();
}

// React triggers this when the timer hits 0
ipcMain.on("notify", (_, { title, body }) => {
  showNotification({ title, body });
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  // macOS requires explicit permission to show notifications.
  // Electron handles the permission dialog automatically when the app is
  // properly signed; in dev mode it works via Electron's own bundle identity.
  if (process.platform === "darwin" && Notification.isSupported()) {
    app.requestSingleInstanceLock(); // ensures app identity is registered
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Prevent default quit — we handle it ourselves via app.isQuitting
app.on("window-all-closed", () => {
  // Do NOT quit here; the window is hidden, not destroyed
  if (process.platform !== "darwin" && app.isQuitting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
});