import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiArrowRight, FiHeart } from 'react-icons/fi';
import api from '../utils/api';
import './Login.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) setError('Security token is missing. Please request a new reset link.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || password.length < 6) return setError('For your security, passwords must be at least 6 characters.');
    if (password !== confirm) return setError('The passwords do not match. Please try again.');

    setLoading(true);
    try {
      await api.post('/auth/student/reset-password', { token, password });
      setMessage('Your security credentials have been updated. Redirecting you to the portal...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update password. The link may have expired.');
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
          <h1>Security Update</h1>
          <p>Create a strong new password for your sanctuary 🔒</p>
        </div>

        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert-error">{error}</motion.div>}
          {message && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert-success">{message}</motion.div>}
        </AnimatePresence>

        {!message && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group-modern">
              <FiLock className="input-icon" />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="New Secure Password"
                required 
              />
            </div>
            <div className="form-group-modern">
              <FiLock className="input-icon" />
              <input 
                type="password" 
                value={confirm} 
                onChange={(e) => setConfirm(e.target.value)} 
                placeholder="Confirm New Password"
                required 
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'} <FiArrowRight />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
