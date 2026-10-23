import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Settings {
  workMins:   number;   // 1–60
  breakMins:  number;   // 1–30
  autoSwitch: boolean;  // auto-start next session when timer ends
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pomodoro_settings';

export const DEFAULTS: Settings = {
  workMins:   25,
  breakMins:  5,
  autoSwitch: true,
};

export const LIMITS = {
  workMins:  { min: 1, max: 60 },
  breakMins: { min: 1, max: 30 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };

    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      workMins:   clamp(Number(parsed.workMins)  || DEFAULTS.workMins,  LIMITS.workMins.min,  LIMITS.workMins.max),
      breakMins:  clamp(Number(parsed.breakMins) || DEFAULTS.breakMins, LIMITS.breakMins.min, LIMITS.breakMins.max),
      autoSwitch: parsed.autoSwitch !== undefined ? Boolean(parsed.autoSwitch) : DEFAULTS.autoSwitch,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota / private browsing — fail silently
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSettingsReturn {
  settings: Settings;
  /** Persist a partial update; invalid/out-of-range values are clamped */
  updateSettings: (patch: Partial<Settings>) => void;
  /** Restore factory defaults and persist */
  resetSettings: () => void;
  /** Convenience: work duration in seconds */
  workSecs: number;
  /** Convenience: break duration in seconds */
  breakSecs: number;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next: Settings = {
        workMins:   clamp(
          Math.round(patch.workMins  ?? prev.workMins),
          LIMITS.workMins.min, LIMITS.workMins.max
        ),
        breakMins:  clamp(
          Math.round(patch.breakMins ?? prev.breakMins),
          LIMITS.breakMins.min, LIMITS.breakMins.max
        ),
        autoSwitch: patch.autoSwitch !== undefined ? patch.autoSwitch : prev.autoSwitch,
      };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const fresh = { ...DEFAULTS };
    saveSettings(fresh);
    setSettings(fresh);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    workSecs:  settings.workMins  * 60,
    breakSecs: settings.breakMins * 60,
  };
}