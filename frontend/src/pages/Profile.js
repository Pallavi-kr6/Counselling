import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMail, FiBookOpen, FiClock, FiSmartphone, FiHash, FiCheckCircle, FiEdit3 } from 'react-icons/fi';
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
  const [success, setSuccess] = useState('');

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
                    disabled={saving}
                  >
                    {saving ? 'Updating...' : 'Save Changes'}
                  </motion.button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
