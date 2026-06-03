import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const WellnessContext = createContext();

export const useWellness = () => useContext(WellnessContext);

const DEFAULT_PREFS = {
  anonymousMode: false,
  // crisisAlerts is intentionally NOT a user preference — it always fires
  moodReminder: true,
  moodReminderTime: '20:00',
  breathingReminder: false,
  sessionNotes: true,
  fontSize: 'medium',
  highContrast: false,
  font: 'inter',
};

const FONT_SIZES = { small: '14px', medium: '16px', large: '19px' };

// ── Ask for notification permission (non-blocking) ────────────────────────────
async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ── Show a notification safely ────────────────────────────────────────────────
function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

// ── Compute ms until next HH:MM today (or tomorrow if already past) ───────────
function msUntil(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

// ── Has the user already logged mood today? ───────────────────────────────────
function hasMoodLoggedToday() {
  try {
    const key = 'lastMoodDate';
    return localStorage.getItem(key) === new Date().toDateString();
  } catch {
    return false;
  }
}

export const WellnessProvider = ({ children }) => {
  const { user } = useAuth();
  const storageKey = user?.id ? `wellnessPrefs_${user.id}` : 'wellnessPrefs_guest';

  const load = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : { ...DEFAULT_PREFS };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }, [storageKey]);

  const [prefs, setPrefs] = useState(load);

  // Track in-app reminder state so UI can show a banner
  const [moodReminderDue, setMoodReminderDue] = useState(false);
  const [breathingReminderDue, setBreathingReminderDue] = useState(false);

  const moodTimerRef      = useRef(null);
  const breathingTimerRef = useRef(null);

  // Reload prefs when user changes (login / logout)
  useEffect(() => {
    setPrefs(load());
  }, [load]);

  // ── Apply font family ──────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-font', prefs.font);
    localStorage.setItem('font', prefs.font);
  }, [prefs.font]);

  // ── Apply font size ────────────────────────────────────────────────────────
  useEffect(() => {
    const sz = FONT_SIZES[prefs.fontSize] || '16px';
    document.documentElement.style.fontSize = sz;
    document.body.style.fontSize = sz;
  }, [prefs.fontSize]);

  // ── Apply high contrast ────────────────────────────────────────────────────
  useEffect(() => {
    if (prefs.highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, [prefs.highContrast]);

  // ── Mood reminder ─────────────────────────────────────────────────────────
  // Strategy:
  //   1. On mount: if mood reminder is on AND reminder time has already passed
  //      today AND mood hasn't been logged → show immediately.
  //   2. Schedule a setTimeout to fire at the next occurrence of the reminder time.
  //   3. Also show an in-app banner (moodReminderDue) when either fires.
  useEffect(() => {
    clearTimeout(moodTimerRef.current);
    setMoodReminderDue(false);

    if (!prefs.moodReminder) return;

    const fire = async () => {
      if (hasMoodLoggedToday()) return; // already logged — skip
      const granted = await ensureNotificationPermission();
      if (granted) {
        showNotification('MindSpace – Daily Check-in 💙', "How are you feeling today? Take a moment to log your mood.");
      }
      setMoodReminderDue(true); // always show in-app banner regardless of browser permission
    };

    // Check on mount: if the reminder time already passed today
    const [h, m] = prefs.moodReminderTime.split(':').map(Number);
    const now = new Date();
    const passedToday = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
    if (passedToday && !hasMoodLoggedToday()) {
      fire();
    }

    // Schedule the next firing
    const delay = msUntil(prefs.moodReminderTime);
    moodTimerRef.current = setTimeout(fire, delay);

    return () => clearTimeout(moodTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.moodReminder, prefs.moodReminderTime]);

  // ── Breathing reminder ─────────────────────────────────────────────────────
  // Fires every 2 hours while the page is open. Also shows an in-app banner.
  useEffect(() => {
    clearInterval(breathingTimerRef.current);
    setBreathingReminderDue(false);

    if (!prefs.breathingReminder) return;

    const fire = async () => {
      const granted = await ensureNotificationPermission();
      if (granted) {
        showNotification('MindSpace – Breathing Break 🌬️', "Take 5 minutes to reset. A quick breathing exercise can help.");
      }
      setBreathingReminderDue(true);
    };

    // Fire once after 2 hours, then every 2 hours
    breathingTimerRef.current = setInterval(fire, 2 * 60 * 60 * 1000);

    return () => clearInterval(breathingTimerRef.current);
  }, [prefs.breathingReminder]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  // Dismiss helpers (called by reminder banner components)
  const dismissMoodReminder      = useCallback(() => setMoodReminderDue(false), []);
  const dismissBreathingReminder = useCallback(() => setBreathingReminderDue(false), []);

  return (
    <WellnessContext.Provider value={{
      prefs,
      updatePref,
      moodReminderDue,
      breathingReminderDue,
      dismissMoodReminder,
      dismissBreathingReminder,
    }}>
      {children}
    </WellnessContext.Provider>
  );
};
