import React, { useState, useEffect } from 'react';
import { Settings, LIMITS, DEFAULTS } from './hooks/useSettings';

interface SettingsPanelProps {
  isOpen: boolean;
  settings: Settings;
  onSave:  (patch: Partial<Settings>) => void;
  onReset: () => void;
  onClose: () => void;
}

// ─── Sub-component: a labelled number stepper ─────────────────────────────────

interface StepperProps {
  label:    string;
  subLabel: string;
  value:    number;
  min:      number;
  max:      number;
  onChange: (v: number) => void;
}

function Stepper({ label, subLabel, value, min, max, onChange }: StepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
  };

  return (
    <div className="sp-row">
      <div className="sp-label-group">
        <span className="sp-label">{label}</span>
        <span className="sp-sublabel">{subLabel}</span>
      </div>
      <div className="sp-stepper" role="group" aria-label={label}>
        <button
          className="sp-step-btn"
          onClick={dec}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >−</button>
        <input
          className="sp-step-input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={handleInput}
          aria-label={`${label} in minutes`}
        />
        <button
          className="sp-step-btn"
          onClick={inc}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >+</button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SettingsPanel({
  isOpen, settings, onSave, onReset, onClose,
}: SettingsPanelProps) {

  // Local draft — only committed to the hook on Save
  const [draft, setDraft] = useState<Settings>(settings);

  // Sync draft whenever panel opens (pick up any external changes)
  useEffect(() => {
    if (isOpen) setDraft(settings);
  }, [isOpen, settings]);

  const patch = (field: keyof Settings) => (v: number) =>
    setDraft(prev => ({ ...prev, [field]: v }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft({ ...DEFAULTS });
    onReset();
  };

  const isDirty =
    draft.workMins   !== settings.workMins  ||
    draft.breakMins  !== settings.breakMins ||
    draft.autoSwitch !== settings.autoSwitch;

  return (
    <>
      {/* Backdrop — click outside to cancel */}
      <div
        className={`sp-backdrop ${isOpen ? 'sp-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`sp-panel ${isOpen ? 'sp-panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Timer settings"
      >
        <div className="sp-header">
          <span className="sp-title">settings</span>
          <button className="sp-close-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="sp-body">
          <Stepper
            label="Work"
            subLabel={`${draft.workMins} min`}
            value={draft.workMins}
            min={LIMITS.workMins.min}
            max={LIMITS.workMins.max}
            onChange={patch('workMins')}
          />

          <Stepper
            label="Break"
            subLabel={`${draft.breakMins} min`}
            value={draft.breakMins}
            min={LIMITS.breakMins.min}
            max={LIMITS.breakMins.max}
            onChange={patch('breakMins')}
          />

          {/* ── Auto-switch toggle ── */}
          <div className="sp-row">
            <div className="sp-label-group">
              <span className="sp-label">Auto-switch</span>
              <span className="sp-sublabel">start next session automatically</span>
            </div>
            <button
              className={`sp-toggle ${draft.autoSwitch ? 'sp-toggle--on' : ''}`}
              onClick={() => setDraft(prev => ({ ...prev, autoSwitch: !prev.autoSwitch }))}
              role="switch"
              aria-checked={draft.autoSwitch}
              aria-label="Auto-switch sessions"
            >
              <span className="sp-toggle-thumb" />
            </button>
          </div>
        </div>

        <div className="sp-footer">
          <button className="sp-btn sp-btn--ghost" onClick={handleReset}>
            reset
          </button>
          <button
            className={`sp-btn sp-btn--primary ${isDirty ? 'sp-btn--dirty' : ''}`}
            onClick={handleSave}
          >
            save
          </button>
        </div>
      </div>
    </>
  );
}