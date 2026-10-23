import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionRecord {
  date: string;  // "YYYY-MM-DD"
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pomodoro_sessions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function loadRecord(): SessionRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };

    const parsed: SessionRecord = JSON.parse(raw);

    // If the stored date is in the past, reset — new day, new slate
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), count: 0 };
    }

    return parsed;
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function saveRecord(record: SessionRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage quota exceeded or private browsing — fail silently
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSessionCounterReturn {
  /** Number of completed work sessions today */
  sessionCount: number;
  /** Whether the count just incremented (true for ~800 ms — use to trigger CSS animation) */
  justCompleted: boolean;
  /** Call this when a work session (not a break) finishes */
  incrementSession: () => void;
  /** Reset today's count to zero (useful for a reset button) */
  resetSessions: () => void;
}

export function useSessionCounter(): UseSessionCounterReturn {
  const [record, setRecord] = useState<SessionRecord>(() => loadRecord());
  const [justCompleted, setJustCompleted] = useState(false);

  const incrementSession = useCallback(() => {
    setRecord(prev => {
      // Guard against stale state from a previous day surviving until midnight
      const base = prev.date === todayKey() ? prev : { date: todayKey(), count: 0 };
      const next: SessionRecord = { date: base.date, count: base.count + 1 };
      saveRecord(next);
      return next;
    });

    // Flash the "just completed" state for 800 ms to drive the CSS pulse
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 800);
  }, []);

  const resetSessions = useCallback(() => {
    const fresh: SessionRecord = { date: todayKey(), count: 0 };
    saveRecord(fresh);
    setRecord(fresh);
  }, []);

  return {
    sessionCount: record.count,
    justCompleted,
    incrementSession,
    resetSessions,
  };
}