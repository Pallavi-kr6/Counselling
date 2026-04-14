import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiStar, FiCheckCircle, FiSkipForward, FiSend, FiMessageCircle } from 'react-icons/fi';
import api from '../utils/api';
import './Feedback.css';

const Feedback = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/feedback', { appointmentId, rating, comment, isAnonymous });
      setSubmitted(true);
      setTimeout(() => navigate('/appointments'), 3000);
    } catch (error) {
      console.error('Feedback error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const ratingLabels = ['Need Improvement', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="feedback-page">
      <div className="container mini-container">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div 
              key="form"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95 }}
              className="feedback-card glass-card"
            >
              <div className="feedback-header">
                <div className="header-icon"><FiMessageCircle /></div>
                <h1>How was your session?</h1>
                <p>Your honest experience helps us create a more supportive space.</p>
              </div>

              <form onSubmit={handleSubmit} className="feedback-form-modern">
                <div className="rating-section">
                  <span className="section-label">Your Experience</span>
                  <div className="stars-container">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        type="button"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className={`star-btn ${rating >= star ? 'active' : ''}`}
                        onClick={() => setRating(star)}
                      >
                        <FiStar fill={rating >= star ? "currentColor" : "none"} />
                      </motion.button>
                    ))}
                  </div>
                  <motion.p key={rating} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rating-label">
                    {ratingLabels[rating - 1]}
                  </motion.p>
                </div>

                <div className="comment-section">
                  <span className="section-label">Additional Thoughts (Optional)</span>
                  <textarea
                    className="glass-textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what felt right or what we could do better..."
                    rows="4"
                  />
                </div>

                <div className="anonymous-toggle">
                  <label className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                    />
                    <span className="checkmark" />
                    <span className="label-text">Submit anonymously</span>
                  </label>
                </div>

                <div className="feedback-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => navigate('/appointments')}>
                    <FiSkipForward /> Skip
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Sending...' : <>Send Feedback <FiSend /></>}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="success-state glass-card"
            >
              <div className="success-icon-wrapper">
                <motion.div 
                  initial={{ rotate: -45, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                >
                  <FiCheckCircle />
                </motion.div>
              </div>
              <h2>Thank you so much!</h2>
              <p>Your feedback is a gift that helps us grow. We're grateful for your trust.</p>
              <div className="redirect-pill">Returning to your dashboard...</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Feedback;
