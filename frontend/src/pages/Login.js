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
        navigate('/');
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

      navigate('/');
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
                <div className="form-footer">
                  <p>Access reserved for verified campus counsellors.</p>
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
