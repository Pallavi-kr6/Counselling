import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const WellnessContext = createContext();

export const useWellness = () => useContext(WellnessContext);

const DEFAULT_PREFS = {
  anonymousMode: false,
  moodReminder: true,
  moodReminderTime: '20:00',
  breathingReminder: false,
  sessionNotes: true,
  fontSize: 'medium',
  highContrast: false,
  font: 'inter',
};

const FONT_SIZES = { small: '14px', medium: '16px', large: '19px' };

function moodDateKey(userId) {
  return userId ? `lastMoodDate_${userId}` : null;
}

function hasMoodLoggedToday(userId) {
  const key = moodDateKey(userId);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === new Date().toDateString();
  } catch {
    return false;
  }
}

function markMoodLoggedToday(userId) {
  const key = moodDateKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, new Date().toDateString());
  } catch { /* ignore */ }
}

async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

function msUntil(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

export const WellnessProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
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
  const [moodReminderDue, setMoodReminderDue] = useState(false);
  const [breathingReminderDue, setBreathingReminderDue] = useState(false);
  const [moodLoggedToday, setMoodLoggedToday] = useState(false);

  const moodTimerRef = useRef(null);
  const breathingTimerRef = useRef(null);

  const isStudent = !authLoading && !!user && user.userType === 'student';

  useEffect(() => {
    setPrefs(load());
  }, [load]);

  // Sync today's mood status from API when student logs in
  useEffect(() => {
    if (!isStudent || !user?.id) {
      setMoodLoggedToday(false);
      setMoodReminderDue(false);
      return;
    }

    if (hasMoodLoggedToday(user.id)) {
      setMoodLoggedToday(true);
      setMoodReminderDue(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/mood/streak-dates');
        const today = new Date().toISOString().split('T')[0];
        const logged = (res.data.dates || []).includes(today);
        if (cancelled) return;
        if (logged) {
          markMoodLoggedToday(user.id);
          setMoodLoggedToday(true);
          setMoodReminderDue(false);
        } else {
          setMoodLoggedToday(false);
        }
      } catch {
        if (!cancelled) setMoodLoggedToday(hasMoodLoggedToday(user.id));
      }
    })();

    return () => { cancelled = true; };
  }, [isStudent, user?.id]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', prefs.font);
    localStorage.setItem('font', prefs.font);
  }, [prefs.font]);

  useEffect(() => {
    const sz = FONT_SIZES[prefs.fontSize] || '16px';
    document.documentElement.style.fontSize = sz;
    document.body.style.fontSize = sz;
  }, [prefs.fontSize]);

  useEffect(() => {
    if (prefs.highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, [prefs.highContrast]);

  // Mood reminder — logged-in students only, skip if already checked in today
  useEffect(() => {
    clearTimeout(moodTimerRef.current);
    setMoodReminderDue(false);

    if (!isStudent || !user?.id || !prefs.moodReminder || moodLoggedToday) return;

    const fire = async () => {
      if (hasMoodLoggedToday(user.id)) {
        setMoodLoggedToday(true);
        return;
      }
      const granted = await ensureNotificationPermission();
      if (granted) {
        showNotification('MindSpace – Daily Check-in 💙', 'How are you feeling today? Take a moment to log your mood.');
      }
      if (!hasMoodLoggedToday(user.id)) {
        setMoodReminderDue(true);
      }
    };

    const [h, m] = prefs.moodReminderTime.split(':').map(Number);
    const now = new Date();
    const passedToday = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
    if (passedToday) {
      fire();
    }

    moodTimerRef.current = setTimeout(fire, msUntil(prefs.moodReminderTime));

    return () => clearTimeout(moodTimerRef.current);
  }, [isStudent, user?.id, prefs.moodReminder, prefs.moodReminderTime, moodLoggedToday]);

  useEffect(() => {
    clearInterval(breathingTimerRef.current);
    setBreathingReminderDue(false);

    if (!isStudent || !prefs.breathingReminder) return;

    const fire = async () => {
      const granted = await ensureNotificationPermission();
      if (granted) {
        showNotification('MindSpace – Breathing Break 🌬️', 'Take 5 minutes to reset. A quick breathing exercise can help.');
      }
      setBreathingReminderDue(true);
    };

    breathingTimerRef.current = setInterval(fire, 2 * 60 * 60 * 1000);

    return () => clearInterval(breathingTimerRef.current);
  }, [isStudent, prefs.breathingReminder]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const dismissMoodReminder = useCallback(() => setMoodReminderDue(false), []);
  const dismissBreathingReminder = useCallback(() => setBreathingReminderDue(false), []);

  const notifyMoodCheckedIn = useCallback(() => {
    if (user?.id) markMoodLoggedToday(user.id);
    setMoodLoggedToday(true);
    setMoodReminderDue(false);
  }, [user?.id]);

  return (
    <WellnessContext.Provider value={{
      prefs,
      updatePref,
      moodReminderDue,
      breathingReminderDue,
      moodLoggedToday,
      dismissMoodReminder,
      dismissBreathingReminder,
      notifyMoodCheckedIn,
    }}>
      {children}
    </WellnessContext.Provider>
  );
};
