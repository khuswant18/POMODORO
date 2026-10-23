const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  closeApp:    () => ipcRenderer.send("close-app"),
  minimizeApp: () => ipcRenderer.send("minimize-app"),
  quitApp:     () => ipcRenderer.send("quit-app"),

  // Timer state → tray tooltip sync
  // status: "idle" | "work" | "break"
  updateTimer: (status, secondsLeft) =>
    ipcRenderer.send("timer-update", { status, secondsLeft }),

  // Native desktop notification
  // title: string, body: string
  notify: (title, body) =>
    ipcRenderer.send("notify", { title, body }),
});