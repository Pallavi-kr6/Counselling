import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiWind, FiX, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useWellness } from '../context/WellnessContext';
import './ReminderBanner.css';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/professionals'];

const ReminderBanner = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const {
    moodReminderDue,
    breathingReminderDue,
    moodLoggedToday,
    dismissMoodReminder,
    dismissBreathingReminder,
  } = useWellness();
  const navigate = useNavigate();

  const isStudent = !loading && user?.userType === 'student';
  const onStudentPage = isStudent && !PUBLIC_PATHS.includes(location.pathname);

  if (!onStudentPage) return null;

  const showMood = moodReminderDue && !moodLoggedToday;
  const showBreathing = !showMood && breathingReminderDue;

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
            <button className="reminder-action" onClick={handleMoodClick}>
              Log mood <FiArrowRight size={14} />
            </button>
            <button className="reminder-dismiss" onClick={dismissMoodReminder} aria-label="Dismiss">
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
            <button className="reminder-action" onClick={handleBreathingClick}>
              Let's breathe <FiArrowRight size={14} />
            </button>
            <button className="reminder-dismiss" onClick={dismissBreathingReminder} aria-label="Dismiss">
              <FiX size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReminderBanner;
