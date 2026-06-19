import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMail, 
  FiLock, 
  FiUser, 
  FiArrowRight, 
  FiHeart, 
  FiBookOpen, 
  FiCalendar, 
  FiUsers, 
  FiPhone 
} from 'react-icons/fi';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    year: '',
    course: '',
    gender: '',
    contactInfo: '',
    department: '',
    regNumber: '',
    section: ''
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(1); // 1 = form, 2 = OTP verification
  const [showSpamWarning, setShowSpamWarning] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/student/send-signup-otp', {
        ...formData
      });

      if (response.data.success) {
        setStep(2);
        setShowSpamWarning(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/student/verify-otp', {
        email: formData.email,
        otp: otp,
        isSignup: true
      });

      if (response.data.success) {
        login(response.data.token, response.data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/student/send-signup-otp', { ...formData });
      setMessage('OTP code has been resent to your email.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError('Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  return (
    <div className="signup-container">
      <motion.div 
        className="signup-card glass-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="login-brand">
          <motion.div className="brand-icon-wrapper" whileHover={{ scale: 1.1, rotate: 10 }}>
            <FiHeart className="brand-heart" />
          </motion.div>
          <h2>Mindful Space</h2>
        </div>

        <div className="signup-header">
          <h1>{step === 1 ? 'Start Your Journey' : 'Verify Identity'}</h1>
          <p>{step === 1 ? 'A safe space for your mental well-being' : `We sent a code to ${formData.email}`}</p>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {message && <div className="alert-success">{message}</div>}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form 
              key="step1"
              variants={containerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onSubmit={handleSendOTP} 
              className="signup-form"
            >
              <div className="form-grid">
                <div className="form-group-modern">
                  <FiMail className="input-icon" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="College Email *"
                    required
                  />
                </div>
                <div className="form-group-modern">
                  <FiUser className="input-icon" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Full Name"
                  />
                </div>
                <div className="form-group-modern">
                  <FiLock className="input-icon" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password *"
                    required
                  />
                </div>
                <div className="form-group-modern">
                  <FiLock className="input-icon" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm Password *"
                    required
                  />
                </div>
                <div className="form-group-modern">
                  <FiCalendar className="input-icon" />
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  >
                    <option value="">Year of Study</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div className="form-group-modern">
                  <FiBookOpen className="input-icon" />
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    placeholder="Course"
                  />
                </div>
                <div className="form-group-modern">
                  <FiUser className="input-icon" />
                  <input
                    type="text"
                    value={formData.regNumber}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                    placeholder="Registration Number *"
                    required
                  />
                </div>
                <div className="form-group-modern">
                  <FiBookOpen className="input-icon" />
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="Section (e.g. A, B, C) *"
                    required
                  />
                </div>
                <div className="form-group-modern">
  <FiBookOpen className="input-icon" />
  <input
    type="text"
    value={formData.department}
    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
    placeholder="Department"
  />
</div>
                <div className="form-group-modern">
                  <FiUsers className="input-icon" />
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Gender Identity</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="N/A">Prefer not to say</option>
                  </select>
                </div>
                <div className="form-group-modern">
                  <FiPhone className="input-icon" />
                  <input
                    type="text"
                    value={formData.contactInfo}
                    onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                    placeholder="Contact Info"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Sending Code...' : 'Get Started'} <FiArrowRight />
              </button>

              <div className="form-footer">
                <p>Already have an account? <Link to="/login" className="text-primary">Login</Link></p>
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="step2"
              variants={containerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onSubmit={handleVerifyOTP} 
              className="signup-form"
            >
              <div className="form-group-modern otp-group">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="otp-input"
                  maxLength="6"
                  required
                />
              </div>

              {/* Spam notice box */}
              <div 
                className="spam-notice-box" 
                style={{
                  background: 'rgba(46, 196, 182, 0.1)',
                  border: '1px solid rgba(46, 196, 182, 0.2)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  color: '#2ec4b6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '1.25rem'
                }}
              >
                <span>Please check your spam folder for the OTP.</span>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Account'} <FiArrowRight />
              </button>

              <div className="form-footer">
                <button type="button" onClick={handleResendOTP} className="btn-link">Resend Code</button>
                <button type="button" onClick={() => setStep(1)} className="btn-link">Change Details</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* OTP Spam Warning Modal */}
      <AnimatePresence>
        {showSpamWarning && (
          <motion.div 
            className="otp-warning-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem'
            }}
          >
            <motion.div 
              className="otp-warning-modal glass-card"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              style={{
                maxWidth: '420px',
                width: '100%',
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '24px',
                padding: '2.5rem',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(20px)'
              }}
            >
              <div 
                style={{
                  width: '64px',
                  height: '64px',
                  background: 'rgba(46, 196, 182, 0.15)',
                  color: 'rgb(46, 196, 182)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 0 20px rgba(46, 196, 182, 0.2)'
                }}
              >
                <FiMail />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem', fontFamily: "'Poppins', sans-serif" }}>Verify Your Email</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                Please check your spam section for the OTP code.
              </p>
              <button 
                onClick={() => setShowSpamWarning(false)}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2ec4b6 0%, #0d9488 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(46, 196, 182, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Signup;
