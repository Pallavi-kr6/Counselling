import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiUser, FiArrowRight, FiHeart } from 'react-icons/fi';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isStudent, setIsStudent] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    teacherId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOtpWarning, setShowOtpWarning] = useState(true);

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: supabaseError } =
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

      if (supabaseError) {
        setError(supabaseError.message);
        setLoading(false);
        return;
      }

      await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });

      login(data.session.access_token, {
        id: data.user.id,
        email: data.user.email,
        userType: 'student'
      });

      const profileResponse = await api.get(
        '/profiles/student/' + data.user.id,
        {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        }
      );

      if (!profileResponse.data.profile) {
        navigate('/signup');
      } else {
        navigate('/dashboard');
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCounsellorLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/counsellor/login', {
        teacherId: formData.teacherId
      });

      login(response.data.token, {
        id: response.data.user.id,
        email: response.data.user.email,
        userType: 'counsellor',
        teacherId: response.data.user.teacherId,
        name: response.data.user.name
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your Teacher ID.');
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, scale: 0.95 }
  };

  return (
    <div className="login-container">
      {/* OTP Spam Warning Modal */}
      <AnimatePresence>
        {showOtpWarning && (
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
                background: 'rgba(255, 255, 255, 0.1)',
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
                onClick={() => setShowOtpWarning(false)}
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

      <motion.div 
        className="login-card glass-card"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <div className="login-brand">
          <motion.div 
            className="brand-icon-wrapper"
            whileHover={{ scale: 1.1, rotate: 10 }}
          >
            <FiHeart className="brand-heart" />
          </motion.div>
          <h2>Mindful Space</h2>
        </div>

        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>We're glad to see you again 💙</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab ${isStudent ? 'active' : ''}`}
            onClick={() => setIsStudent(true)}
          >
            Student
            {isStudent && <motion.div layoutId="tab-active" className="active-pill" />}
          </button>
          <button
            className={`tab ${!isStudent ? 'active' : ''}`}
            onClick={() => setIsStudent(false)}
          >
            Counsellor
            {!isStudent && <motion.div layoutId="tab-active" className="active-pill" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isStudent ? 'student' : 'counsellor'}
            initial={{ x: 10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -10, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error && <div className="alert-error">{error}</div>}

            {isStudent ? (
              <form onSubmit={handleStudentLogin} className="login-form">
                <div className="form-group-modern">
                  <FiMail className="input-icon" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="College Email"
                    required
                  />
                </div>
                <div className="form-group-modern">
                  <FiLock className="input-icon" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                  {loading ? 'Entering...' : 'Entrance'} <FiArrowRight />
                </button>
                <div className="form-footer">
                  <Link to="/forgot-password">Forgot password?</Link>
                  <p>Don't have an account? <Link to="/signup" className="text-primary">Join us</Link></p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCounsellorLogin} className="login-form">
                <div className="form-group-modern">
                  <FiUser className="input-icon" />
                  <input
                    type="text"
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    placeholder="Teacher Identification"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                  {loading ? 'Verifying...' : 'Portal Entrance'} <FiArrowRight />
                </button>
                <div className="form-footer" style={{ marginTop: '1.25rem' }}>
                  <p style={{ marginBottom: '0.5rem' }}>Access reserved for verified campus counsellors.</p>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, teacherId: 'TRIAL001' })}
                    style={{
                      background: 'rgba(20, 184, 166, 0.1)',
                      color: '#14b8a6',
                      border: '1px solid rgba(20, 184, 166, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(20, 184, 166, 0.18)';
                      e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.35)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(20, 184, 166, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.2)';
                    }}
                  >
                 
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Login;
