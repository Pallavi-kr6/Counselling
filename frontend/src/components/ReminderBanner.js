import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiWind, FiX, FiArrowRight } from 'react-icons/fi';
import { useWellness } from '../context/WellnessContext';
import './ReminderBanner.css';

/**
 * ReminderBanner
 * Shows an animated top-of-screen banner when a mood or breathing reminder is due.
 * Rendered once at app level (inside App.js).
 */
const ReminderBanner = () => {
  const {
    moodReminderDue,
    breathingReminderDue,
    dismissMoodReminder,
    dismissBreathingReminder,
  } = useWellness();
  const navigate = useNavigate();

  // Mood banner takes priority over breathing
  const showMood      = moodReminderDue;
  const showBreathing = !moodReminderDue && breathingReminderDue;

  const handleMoodClick = () => {
    dismissMoodReminder();
    navigate('/mood');
  };

  const handleBreathingClick = () => {
    dismissBreathingReminder();
    navigate('/breathe');
  };

  return (
    <AnimatePresence>
      {showMood && (
        <motion.div
          key="mood-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="reminder-banner mood-banner"
          role="alert"
          aria-live="polite"
        >
          <div className="reminder-banner-inner">
            <div className="reminder-icon">
              <FiHeart size={18} />
            </div>
            <div className="reminder-text">
              <strong>Daily Mood Check-in</strong>
              <span>How are you feeling right now? It only takes a moment. 💙</span>
            </div>
            <button
              className="reminder-action"
              onClick={handleMoodClick}
            >
              Log mood <FiArrowRight size={14} />
            </button>
            <button
              className="reminder-dismiss"
              onClick={dismissMoodReminder}
              aria-label="Dismiss"
            >
              <FiX size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {showBreathing && (
        <motion.div
          key="breathing-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="reminder-banner breathing-banner"
          role="alert"
          aria-live="polite"
        >
          <div className="reminder-banner-inner">
            <div className="reminder-icon">
              <FiWind size={18} />
            </div>
            <div className="reminder-text">
              <strong>Breathing Break</strong>
              <span>You've been at it a while. Take 5 minutes to breathe and reset. 🌬️</span>
            </div>
            <button
              className="reminder-action"
              onClick={handleBreathingClick}
            >
              Let's breathe <FiArrowRight size={14} />
            </button>
            <button
              className="reminder-dismiss"
              onClick={dismissBreathingReminder}
              aria-label="Dismiss"
            >
              <FiX size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReminderBanner;
