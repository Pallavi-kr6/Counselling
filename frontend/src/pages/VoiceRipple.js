import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiStar, FiSend, FiHeart } from 'react-icons/fi';
import api from '../utils/api';
import '../components/PlatformReviewModal.css';
import './VoiceRipple.css';

const RATING_LABELS = ['Needs love', 'Getting there', 'Pretty good', 'Really helpful', 'Absolutely love it!'];

const VoiceRipple = () => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const displayRating = hoverRating || rating;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/platform-reviews', { rating, suggestion: suggestion.trim() || null });
      setSubmitted(true);
    } catch (err) {
      console.error('Voice ripple error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="voice-ripple-page">
      <div className="container">
        <motion.div
          className="voice-ripple-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="pr-floating-stars" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <span key={i} className={`pr-spark pr-spark-${i + 1}`}>✦</span>
            ))}
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit}>
              <div className="pr-header">
                <div className="pr-icon-ring">
                  <FiHeart />
                </div>
                <h1>Voice Ripple</h1>
                <p>Drop a star, leave a whisper — your words ripple outward and help MindSpace grow kinder.</p>
              </div>

              <div className="pr-stars-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    className={`pr-star ${displayRating >= star ? 'lit' : ''}`}
                    whileHover={{ scale: 1.18, rotate: -8 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <FiStar />
                  </motion.button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {displayRating > 0 && (
                  <motion.p
                    key={displayRating}
                    className="pr-rating-label"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {RATING_LABELS[displayRating - 1]}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="pr-suggestion">
                <label htmlFor="voice-suggestion">Your whisper (optional)</label>
                <textarea
                  id="voice-suggestion"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="What made you smile? What could we do better?"
                  rows={4}
                  maxLength={500}
                />
              </div>

              <button type="submit" className="pr-submit" disabled={rating === 0 || submitting}>
                <FiSend size={15} />
                {submitting ? 'Sending ripple…' : 'Send your ripple'}
              </button>
            </form>
          ) : (
            <motion.div
              className="pr-thanks"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="pr-thanks-emoji">🌊</span>
              <h2>Your ripple reached us!</h2>
              <p>Thank you for helping MindSpace grow kinder every day.</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default VoiceRipple;
