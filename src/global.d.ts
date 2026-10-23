export {};

declare global {
  interface Window {
    electronAPI?: {
      closeApp:    () => void;
      minimizeApp: () => void;
      quitApp:     () => void;
      updateTimer: (status: "idle" | "work" | "break", secondsLeft: number) => void;
      notify:      (title: string, body: string) => void;
    };
  }
}