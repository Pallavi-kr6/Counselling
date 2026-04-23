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
    department: ''
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(1); // 1 = form, 2 = OTP verification

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
    </div>
  );
};

export default Signup;
