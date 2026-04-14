import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiArrowRight, FiHeart, FiShield } from 'react-icons/fi';
import api from '../utils/api';
import './Login.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.post('/auth/student/forgot-password', { email });
      setMessage('Recovery protocol initiated. If an account exists for this email, you will receive a reset link shortly.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to reach the recovery service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <motion.div 
        className="login-card glass-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="login-brand">
          <motion.div className="brand-icon-wrapper" whileHover={{ scale: 1.1, rotate: 10 }}>
            <FiHeart className="brand-heart" />
          </motion.div>
          <h2>Mindful Space</h2>
        </div>

        <div className="login-header">
          <h1>Account Recovery</h1>
          <p>We'll help you find your way back 💙</p>
        </div>

        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert-error">{error}</motion.div>}
          {message && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert-success">{message}</motion.div>}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group-modern">
            <FiMail className="input-icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="College Email"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Initiating...' : 'Send Recovery Link'} <FiArrowRight />
          </button>
          
          <div className="form-footer">
            <p>Remembered your way? <Link to="/login" className="text-primary">Login</Link></p>
          </div>
        </form>

        <div className="recovery-hints glass-morphism">
          <FiShield />
          <p>Password reset links expire in 1 hour for your security.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
