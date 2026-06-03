import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWellness } from '../context/WellnessContext';
import {
  FiX, FiHeart, FiMoon, FiSun, FiShield, FiBell,
  FiWind, FiEye, FiType, FiCheck, FiLock,
  FiMessageCircle, FiActivity
} from 'react-icons/fi';
import './PersonalizationPanel.css';

/* ── Reusable toggle switch ─────────────────────────────────── */
const WellnessToggle = ({ checked, onChange, id }) => (
  <button
    id={id}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`wellness-toggle ${checked ? 'on' : 'off'}`}
    type="button"
  >
    <span className="wellness-toggle-thumb" />
  </button>
);

/* ── Main panel ─────────────────────────────────────────────── */
const PersonalizationPanel = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { prefs, updatePref } = useWellness();

  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    updatePref(key, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'you';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="panel-overlay"
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="personalization-panel glass-card"
          >
            {/* ── Header ────────────────────────────────────────── */}
            <div className="panel-header">
              <div className="panel-header-left">
                <div className="panel-header-icon">
                  <FiHeart size={18} />
                </div>
                <div>
                  <h2>Your Wellness Space</h2>
                  <p className="panel-header-sub">Personalised for {firstName}</p>
                </div>
              </div>
              <button onClick={onClose} className="close-btn" aria-label="Close panel" type="button">
                <FiX />
              </button>
            </div>

            {/* ── Scrollable body ────────────────────────────────── */}
            <div className="panel-scroll">

              {/* ─ APPEARANCE ─────────────────────────────────────── */}
              <div className="panel-section">
                <h3 className="section-label">
                  <FiSun size={13} /> Appearance
                </h3>

                {/* Dark / Light mode */}
                <div className="pref-row">
                  <div className="pref-info">
                    {theme === 'dark'
                      ? <FiMoon size={16} className="pref-icon calm" />
                      : <FiSun size={16} className="pref-icon warm" />
                    }
                    <div>
                      <span className="pref-title">
                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </span>
                      <span className="pref-desc">
                        {theme === 'dark' ? 'Easier on the eyes at night' : 'Bright and clear interface'}
                      </span>
                    </div>
                  </div>
                  <WellnessToggle
                    id="toggle-dark-mode"
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                  />
                </div>

                {/* High contrast */}
                <div className="pref-row">
                  <div className="pref-info">
                    <FiEye size={16} className="pref-icon focus" />
                    <div>
                      <span className="pref-title">High Contrast</span>
                      <span className="pref-desc">Sharper text for better readability</span>
                    </div>
                  </div>
                  <WellnessToggle
                    id="toggle-high-contrast"
                    checked={prefs.highContrast}
                    onChange={v => update('highContrast', v)}
                  />
                </div>
              </div>

              {/* ─ READING COMFORT ────────────────────────────────── */}
              <div className="panel-section">
                <h3 className="section-label">
                  <FiType size={13} /> Reading Comfort
                </h3>

                {/* Text size */}
                <div className="pref-col">
                  <div className="pref-info" style={{ marginBottom: '0.75rem' }}>
                    <FiActivity size={16} className="pref-icon calm" />
                    <div>
                      <span className="pref-title">Text Size</span>
                      <span className="pref-desc">Choose what feels comfortable to read</span>
                    </div>
                  </div>
                  <div className="size-options">
                    {[
                      { id: 'small', label: 'A', desc: 'Compact', fs: '0.8rem' },
                      { id: 'medium', label: 'A', desc: 'Default', fs: '1rem' },
                      { id: 'large', label: 'A', desc: 'Larger', fs: '1.2rem' },
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className={`size-option ${prefs.fontSize === s.id ? 'active' : ''}`}
                        onClick={() => update('fontSize', s.id)}
                      >
                        <span className="size-letter" style={{ fontSize: s.fs }}>{s.label}</span>
                        <span className="size-desc">{s.desc}</span>
                        {prefs.fontSize === s.id && <FiCheck className="size-check" size={10} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font type */}
                <div className="pref-col" style={{ marginTop: '1rem' }}>
                  <div className="font-options">
                    {[
                      { id: 'inter', name: 'Inter', desc: 'Clean & Default', family: 'Inter, sans-serif' },
                      { id: 'poppins', name: 'Poppins', desc: 'Soft & Gentle', family: 'Poppins, sans-serif' },
                      { id: 'opendyslexic', name: 'OpenDyslexic', desc: 'Dyslexia-friendly', family: 'OpenDyslexic, sans-serif' },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className={`font-option ${prefs.font === f.id ? 'active' : ''}`}
                        onClick={() => update('font', f.id)}
                      >
                        <span
                          className="font-preview"
                          style={{ fontFamily: f.family }}
                        >
                          Aa
                        </span>
                        <div className="font-info">
                          <span className="font-name">{f.name}</span>
                          <span className="font-desc">{f.desc}</span>
                        </div>
                        {prefs.font === f.id && <FiCheck className="check-icon" size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─ PRIVACY & SAFETY ──────────────────────────────── */}
              <div className="panel-section">
                <h3 className="section-label">
                  <FiShield size={13} /> Privacy & Safety
                </h3>

                {/* Anonymous mode */}
                <div className="pref-row">
                  <div className="pref-info">
                    <FiShield size={16} className="pref-icon purple" />
                    <div>
                      <span className="pref-title">Default Anonymous Chat</span>
                      <span className="pref-desc">Start AI sessions without saving your identity</span>
                    </div>
                  </div>
                  <WellnessToggle
                    id="toggle-anonymous"
                    checked={prefs.anonymousMode}
                    onChange={v => update('anonymousMode', v)}
                  />
                </div>

                {/* Crisis alerts – always on, non-negotiable */}
                <div className="crisis-locked-notice">
                  <div className="crisis-locked-left">
                    <FiLock size={14} className="crisis-locked-icon" />
                    <div>
                      <span className="pref-title">Crisis Alert Notifications</span>
                      <span className="pref-desc">Counsellors are always alerted for crisis or high-risk messages — this cannot be turned off for your safety.</span>
                    </div>
                  </div>
                  <span className="crisis-always-on">Always On</span>
                </div>
              </div>

              {/* ─ REMINDERS & CHECK-INS ─────────────────────────── */}
              <div className="panel-section">
                <h3 className="section-label">
                  <FiBell size={13} /> Reminders & Check-ins
                </h3>

                {/* Daily mood reminder */}
                <div className="pref-row">
                  <div className="pref-info">
                    <FiHeart size={16} className="pref-icon warm" />
                    <div>
                      <span className="pref-title">Daily Mood Reminder</span>
                      <span className="pref-desc">A gentle nudge to log how you're feeling</span>
                    </div>
                  </div>
                  <WellnessToggle
                    id="toggle-mood-reminder"
                    checked={prefs.moodReminder}
                    onChange={v => update('moodReminder', v)}
                  />
                </div>

                {prefs.moodReminder && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pref-sub-row"
                  >
                    <label htmlFor="mood-time" className="pref-sub-label">Remind me at</label>
                    <input
                      id="mood-time"
                      type="time"
                      value={prefs.moodReminderTime}
                      onChange={e => update('moodReminderTime', e.target.value)}
                      className="time-input"
                    />
                  </motion.div>
                )}

                {/* Breathing reminder */}
                <div className="pref-row">
                  <div className="pref-info">
                    <FiWind size={16} className="pref-icon calm" />
                    <div>
                      <span className="pref-title">Breathing Break Reminder</span>
                      <span className="pref-desc">Prompted every 2 hours to take a 5-min reset</span>
                    </div>
                  </div>
                  <WellnessToggle
                    id="toggle-breathing"
                    checked={prefs.breathingReminder}
                    onChange={v => update('breathingReminder', v)}
                  />
                </div>

                {/* Session notes */}
                <div className="pref-row">
                  <div className="pref-info">
                    <FiMessageCircle size={16} className="pref-icon focus" />
                    <div>
                      <span className="pref-title">Save Session History</span>
                      <span className="pref-desc">Keep a local record of your AI chat history</span>
                    </div>
                  </div>
                  <WellnessToggle
                    id="toggle-session-notes"
                    checked={prefs.sessionNotes}
                    onChange={v => update('sessionNotes', v)}
                  />
                </div>
              </div>

            </div>{/* end panel-scroll */}

            {/* ── Footer ────────────────────────────────────────── */}
            <div className="panel-footer">
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="saved-toast"
                  >
                    <FiCheck size={14} /> Preferences saved
                  </motion.div>
                ) : (
                  <motion.p
                    key="auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="footer-note"
                  >
                    Changes apply instantly &amp; save to your device.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PersonalizationPanel;
