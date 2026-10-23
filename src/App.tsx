import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { useSessionCounter } from './hooks/useSessionCounter';
import { useSettings } from './hooks/useSettings';
import SettingsPanel from './SettingsPanel';

import playImg from "./assets/play.png";
import resetImg from "./assets/reset.png";
import workBtnClicked from "./assets/work-clicked.png";
import workBtn from "./assets/work.png";
import breakBtnClicked from "./assets/break-clicked.png";
import breakBtn from "./assets/break.png";
import idleGif from "./assets/idle.gif";
import workGif from "./assets/work.gif";
import breakGif from "./assets/break.gif";
import meowSound from "./assets/meow.mp3";
import closeBtn from "./assets/close.png";
import minimizeBtn from "./assets/minimize.png"; // ← add a small minimize icon to assets

// ─── Message arrays at module scope (avoids stale closure in useEffect) ───────
const CHEER_MESSAGES = [
  "You Can Do It!",
  "I believe in you!",
  "You're amazing!",
  "Keep going!",
  "Stay focused!"
];

const BREAK_MESSAGES = [
  "Stay hydrated!",
  "Snacks, maybe?",
  "Text me!",
  "I love you <3",
  "Stretch your legs!"
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ─── ElectronAPI type ─────────────────────────────────────────────────────────
// (keeps global.d.ts in sync — update that file too)
type TimerStatus = "idle" | "work" | "break";

// ─── Component ────────────────────────────────────────────────────────────────
function App() {
  const [timeLeft, setTimeLeft]           = useState(() => {
    // Read persisted settings directly on first render so the displayed
    // time matches the user's saved preference before any effect fires.
    try {
      const raw = localStorage.getItem('pomodoro_settings');
      if (raw) {
        const { workMins } = JSON.parse(raw);
        const mins = Math.min(60, Math.max(1, Number(workMins) || 25));
        return mins * 60;
      }
    } catch { /* fall through */ }
    return 25 * 60;
  });
  const [isRunning, setIsRunning]         = useState(false);
  const [isBreak, setIsBreak]             = useState(false);
  const [encouragement, setEncouragement] = useState("");
  const [image, setImage]                 = useState(playImg);
  const [gifImage, setGifImage]           = useState(idleGif);
  const [workButtonImage, setWorkButtonImage]   = useState(workBtnClicked);
  const [breakButtonImage, setBreakButtonImage] = useState(breakBtn);

  // ── Audio as a ref — created once, never on re-render ───────────────────
  const meowRef = useRef<HTMLAudioElement>(new Audio(meowSound));

  // ── Ref for the auto-switch timeout so it can be cancelled on manual reset ─
  const autoSwitchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Daily session counter (localStorage-backed) ──────────────────────────
  const { sessionCount, justCompleted, incrementSession } = useSessionCounter();

  // ── Custom durations (localStorage-backed) ───────────────────────────────
  const { settings, updateSettings, resetSettings, workSecs, breakSecs } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Countdown hint shown during the 3-second auto-switch pause ──────────
  const [switchCountdown, setSwitchCountdown] = useState<number | null>(null);

  // ── Sync timer state to tray tooltip ────────────────────────────────────
  const syncTray = useCallback((status: TimerStatus, seconds: number) => {
    window.electronAPI?.updateTimer?.(status, seconds);
  }, []);

  // ── Encouragement cycling ────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      setEncouragement("");
      return;
    }
    const messages = isBreak ? BREAK_MESSAGES : CHEER_MESSAGES;
    setEncouragement(messages[0]);
    let index = 1;
    const id = setInterval(() => {
      setEncouragement(messages[index]);
      index = (index + 1) % messages.length;
    }, 4000);
    return () => clearInterval(id);
  }, [isRunning, isBreak]);

  // ── Countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, timeLeft]);

  // ── Tray tooltip sync (every second while running) ───────────────────────
  useEffect(() => {
    if (isRunning) {
      syncTray(isBreak ? "break" : "work", timeLeft);
    }
  }, [timeLeft, isRunning, isBreak, syncTray]);

  // ── Timer end ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft !== 0 || !isRunning) return;

    // 1. Meow sound
    meowRef.current.play().catch(err => console.error("Audio play failed:", err));

    // 2. Count completed work sessions (breaks don't count)
    if (!isBreak) incrementSession();

    // 3. Native desktop notification
    if (isBreak) {
      window.electronAPI?.notify?.("☕ Break's over!", "Time to get back to work. You've got this! 🍅");
    } else {
      window.electronAPI?.notify?.("🍅 Pomodoro complete!", "Nice work! Take a 5-minute break — you've earned it.");
    }

    // 4. Reset UI to idle state
    setIsRunning(false);
    setImage(playImg);
    setGifImage(idleGif);
    const nextIsBreak = !isBreak;
    const nextDuration = nextIsBreak ? breakSecs : workSecs;
    setTimeLeft(nextDuration);
    syncTray("idle", nextDuration);

    // 5. Auto-switch: flip mode and restart after a 3-second pause
    if (settings.autoSwitch) {
      // Tick down 3 → 2 → 1 → go
      setSwitchCountdown(3);
      let count = 3;

      const tick = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setSwitchCountdown(count);
        } else {
          clearInterval(tick);
          setSwitchCountdown(null);
          // Flip mode visuals
          setIsBreak(nextIsBreak);
          setBreakButtonImage(nextIsBreak ? breakBtnClicked : breakBtn);
          setWorkButtonImage(nextIsBreak  ? workBtn : workBtnClicked);
          // Start the next timer
          setTimeLeft(nextDuration);
          setGifImage(nextIsBreak ? breakGif : workGif);
          setImage(resetImg);
          setIsRunning(true);
          syncTray(nextIsBreak ? "break" : "work", nextDuration);
        }
      }, 1000);

      autoSwitchTimerRef.current = tick;
    } else {
      // Manual mode: just flip the mode visuals, leave paused
      setIsBreak(nextIsBreak);
      setBreakButtonImage(nextIsBreak ? breakBtnClicked : breakBtn);
      setWorkButtonImage(nextIsBreak  ? workBtn : workBtnClicked);
    }
  }, [timeLeft, isRunning, isBreak, syncTray, incrementSession, workSecs, breakSecs, settings.autoSwitch]);

  // ── Initial mode setup ───────────────────────────────────────────────────
  useEffect(() => {
    switchMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const switchMode = (breakMode: boolean) => {
    setIsBreak(breakMode);
    setIsRunning(false);
    setBreakButtonImage(breakMode ? breakBtnClicked : breakBtn);
    setWorkButtonImage(breakMode ? workBtn : workBtnClicked);
    setTimeLeft(breakMode ? breakSecs : workSecs);
    setGifImage(idleGif);
    setImage(playImg);
    syncTray("idle", breakMode ? breakSecs : workSecs);
  };

  const handleClick = () => {
    if (!isRunning) {
      // Cancel any pending auto-switch countdown first
      if (autoSwitchTimerRef.current) {
        clearInterval(autoSwitchTimerRef.current);
        autoSwitchTimerRef.current = null;
        setSwitchCountdown(null);
      }
      setIsRunning(true);
      setGifImage(isBreak ? breakGif : workGif);
      setImage(resetImg);
      syncTray(isBreak ? "break" : "work", timeLeft);
    } else {
      const resetTime = isBreak ? breakSecs : workSecs;
      setIsRunning(false);
      setTimeLeft(resetTime);
      setGifImage(idleGif);
      setImage(playImg);
      syncTray("idle", resetTime);
    }
  };

  const handleMinimizeClick = () => {
    window.electronAPI?.minimizeApp?.();
  };

  const handleCloseClick = () => {
    // Hides to tray (electron.js intercepts the close event)
    window.electronAPI?.closeApp?.();
  };

  // When settings are saved mid-idle, snap the displayed time to the new duration
  const handleSaveSettings = (patch: Partial<typeof settings>) => {
    updateSettings(patch);
    if (!isRunning) {
      // Compute the new duration immediately (don't wait for re-render)
      const newWorkSecs  = (patch.workMins  ?? settings.workMins)  * 60;
      const newBreakSecs = (patch.breakMins ?? settings.breakMins) * 60;
      setTimeLeft(isBreak ? newBreakSecs : newWorkSecs);
      syncTray("idle", isBreak ? newBreakSecs : newWorkSecs);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const containerClass = `home-container ${isRunning ? "background-green" : ""}`;

  return (
    <div className={containerClass} style={{ position: 'relative' }}>

      {/* ── Settings panel overlay ── */}
      <SettingsPanel
        isOpen={settingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        onReset={resetSettings}
        onClose={() => setSettingsOpen(false)}
      />

      {/* ── Gear button (top-left) ── */}
      <button
        className="gear-button"
        onClick={() => setSettingsOpen(o => !o)}
        title="Settings"
        aria-label="Open settings"
        disabled={isRunning}
      >
        ⚙
      </button>

      {/* ── Window chrome buttons (top-right) ── */}
      <div className="window-controls">
        <button
          className="window-button"
          onClick={handleMinimizeClick}
          title="Minimize to tray"
          aria-label="Minimize to tray"
        >
          <img src={minimizeBtn} alt="Minimize" />
        </button>
        <button
          className="window-button"
          onClick={handleCloseClick}
          title="Hide to tray"
          aria-label="Hide to tray"
        >
          <img src={closeBtn} alt="Close" />
        </button>
      </div>

      <div className="home-content">
        <div className="home-controls">
          <button className="image-button" onClick={() => switchMode(false)}>
            <img src={workButtonImage} alt="Work" />
          </button>
          <button className="image-button" onClick={() => switchMode(true)}>
            <img src={breakButtonImage} alt="Break" />
          </button>
        </div>

        {/* ── Daily session counter ── */}
        <div
          className={`session-counter ${justCompleted ? 'session-counter--pop' : ''}`}
          title={`${sessionCount} pomodoro${sessionCount !== 1 ? 's' : ''} completed today`}
          aria-label={`${sessionCount} sessions completed today`}
        >
          {'🍅'.repeat(Math.min(sessionCount, 8))}
          {sessionCount > 8 && <span className="session-overflow">+{sessionCount - 8}</span>}
          {sessionCount === 0 && <span className="session-empty">🍅</span>}
        </div>

        <p className={`encouragement-text ${(!isRunning && switchCountdown === null) ? "hidden" : ""}`}>
          {switchCountdown !== null
            ? `${!isBreak ? "break" : "work"} starts in ${switchCountdown}…`
            : encouragement}
        </p>

        <h1 className="home-timer">{formatTime(timeLeft)}</h1>
        <img src={gifImage} alt="Timer Status" className="gif-image" />

        <button className="home-button" onClick={handleClick}>
          <img src={image} alt="Play / Reset" />
        </button>
      </div>
    </div>
  );
}

export default App;