import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMail, FiBookOpen, FiClock, FiSmartphone, FiHash, FiCheckCircle, FiEdit3, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer } from 'recharts';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    year: '',
    course: '',
    gender: '',
    contactInfo: '',
    department: 'Computer Science' // Defaulting for visual polish if empty
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState('');
  const [phq9Trend, setPhq9Trend] = useState([]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get(`/profiles/student/${user.id}`);
      if (response.data.profile) {
        setFormData({
          name: response.data.profile.name || '',
          year: response.data.profile.year || '',
          course: response.data.profile.course || '',
          gender: response.data.profile.gender || '',
          contactInfo: response.data.profile.contact_info || '',
          department: response.data.profile.department || ''
        });
      }
      
      try {
        const phqResponse = await api.get(`/appointments/student-phq9/${user.id}`);
        if (phqResponse.data.scores) {
          const formatted = phqResponse.data.scores.map(s => ({
            date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: s.total_score
          }));
          setPhq9Trend(formatted);
        }
      } catch (e) {
        console.error('No PHQ9 data', e);
      }
      
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');

    try {
      await api.post('/profiles/student', formData);
      setSuccess('Your profile has been updated beautifully.');
      setTimeout(() => setSuccess(''), 5000);
      fetchProfile();
    } catch (error) {
      console.error('Profile update error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleWithdrawConsent = async () => {
    if (!window.confirm("Are you sure you want to withdraw consent? This will permanently anonymise your profile and delete your chat history. This action cannot be undone.")) {
      return;
    }
    
    setWithdrawing(true);
    setSuccess('');
    
    try {
      await api.post('/profiles/student/withdraw-consent');
      setSuccess('Consent withdrawn. Your historical data has been anonymised.');
      setTimeout(() => setSuccess(''), 5000);
      fetchProfile(); // reload to show anonymised info
    } catch (error) {
      console.error('Withdraw consent error:', error);
      alert('Failed to withdraw consent. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  if (loading) return <div className="loading-screen">Preparing your space...</div>;

  return (
    <div className="profile-page">
      <div className="container">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="profile-wrapper"
        >
          <header className="page-header">
            <div className="header-content">
              <h1>Personal Space</h1>
              <p className="subtitle">Update your information and how we connect with you.</p>
            </div>
            <AnimatePresence>
              {success && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  className="success-pill"
                >
                  <FiCheckCircle /> <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          <div className="profile-grid">
            <div className="profile-sidebar">
              <div className="avatar-card glass-card">
                <div className="avatar-large">
                  <FiUser />
                  <button className="edit-avatar-btn"><FiEdit3 /></button>
                </div>
                <h2>{formData.name || 'Anonymous User'}</h2>
                <p>{user.email}</p>
                <div className="user-type-tag">{user.userType}</div>
              </div>
              
              <div className="stats-mini glass-card">
                <div className="stat-item">
                  <span className="label">Member Since</span>
                  <span className="value">March 2026</span>
                </div>
              </div>

              {phq9Trend.length > 0 && (
                <div className="stats-mini glass-card" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FiTrendingUp color="#3498db" /> Clinical Assessment Trend
                  </h3>
                  <div style={{ width: '100%', height: '180px' }}>
                    <ResponsiveContainer>
                      <LineChart data={phq9Trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 27]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <LineTooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        <Line type="monotone" dataKey="score" stroke="#3498db" strokeWidth={3} dot={{ r: 4, fill: '#3498db' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem' }}>PHQ-9 Total Score</p>
                </div>
              )}
            </div>

            <div className="profile-main">
              <form onSubmit={handleSubmit} className="profile-form glass-card">
                <div className="form-section">
                  <h3>Basic Information</h3>
                  <div className="form-grid">
                    <div className="input-group-modern">
                      <label><FiUser /> Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="How should we call you?"
                      />
                    </div>
                    <div className="input-group-modern">
                      <label><FiMail /> Email Address</label>
                      <input type="email" value={user.email} disabled className="disabled" />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Academic Details</h3>
                  <div className="form-grid">
                    <div className="input-group-modern">
                      <label><FiClock /> Current Year</label>
                      <select
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      >
                        <option value="">Select Academic Year</option>
                        <option value="1st Year">First Year</option>
                        <option value="2nd Year">Second Year</option>
                        <option value="3rd Year">Third Year</option>
                        <option value="4th Year">Fourth Year</option>
                      </select>
                    </div>
                    <div className="input-group-modern">
                      <label><FiBookOpen /> Degree/Course</label>
                      <input
                        type="text"
                        value={formData.course}
                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        placeholder="e.g. B.Tech Computer Science"
                      />
                    </div>
                    <div className="input-group-modern">
                      <label><FiHash /> Department</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="e.g. Engineering"
                      />
                    </div>
                    <div className="input-group-modern">
                      <label><FiUser /> Gender (Optional)</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Non-binary / Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Connectivity</h3>
                  <div className="input-group-modern">
                    <label><FiSmartphone /> Contact Information</label>
                    <input
                      type="text"
                      value={formData.contactInfo}
                      onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                      placeholder="Phone or alternate contact method"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="btn btn-save-profile" 
                    disabled={saving || withdrawing}
                  >
                    {saving ? 'Updating...' : 'Save Changes'}
                  </motion.button>
                </div>
              </form>

              {user.userType === 'student' && (
                <div className="glass-card" style={{ marginTop: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(254, 242, 242, 0.4)' }}>
                  <h3 style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FiAlertTriangle /> Data Privacy & Consent
                  </h3>
                  <p style={{ color: '#7f1d1d', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                    You have the right to withdraw your consent for data processing at any time. Withdrawing consent will permanently anonymise your profile information and delete your chat history.
                  </p>
                  <button 
                    onClick={handleWithdrawConsent}
                    disabled={withdrawing}
                    style={{ 
                      background: 'none', border: '1px solid #ef4444', color: '#ef4444', 
                      padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: withdrawing ? 'not-allowed' : 'pointer',
                      fontWeight: 600, transition: 'all 0.2s', opacity: withdrawing ? 0.7 : 1
                    }}
                    onMouseOver={e => !withdrawing && (e.currentTarget.style.background = '#fef2f2')}
                    onMouseOut={e => !withdrawing && (e.currentTarget.style.background = 'none')}
                  >
                    {withdrawing ? 'Anonymising Data...' : 'Withdraw Consent & Anonymise Data'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
