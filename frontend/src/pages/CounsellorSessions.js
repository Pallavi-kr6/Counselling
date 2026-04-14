import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { FiArrowRight, FiUser, FiBookOpen, FiHash, FiCheckCircle, FiSearch } from 'react-icons/fi';
import './Dashboard.css';

const CounsellorSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/appointments/counsellor/session-stats');
      setStudents(response.data.stats || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.userType !== 'counsellor') {
      navigate('/');
      return;
    }
    fetchStats();
  }, [user, navigate, fetchStats]);

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading-screen">Preparing student directory...</div>;

  return (
    <div className="dashboard counsellor-students-view">
      <div className="container">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="dashboard-header-modern"
        >
          <div className="header-content">
            <h1>Student Directory</h1>
            <p className="welcome-subtitle">Manage and monitor {students.length} students assigned to your clinical care.</p>
          </div>
          <div className="header-actions">
            <div className="search-pill glass-card">
              <FiSearch />
              <input 
                type="text" 
                placeholder="Find a student..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </motion.header>

        {error && <div className="alert-error">{error}</div>}

        <motion.div 
          className="students-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          <AnimatePresence>
            {filteredStudents.length === 0 ? (
              <motion.div className="empty-state-full glass-card">
                <FiUser className="empty-icon" />
                <p>No student records match your search criteria.</p>
              </motion.div>
            ) : (
              filteredStudents.map((s) => (
                <motion.div
                  key={s.studentId}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="student-card-premium glass-card"
                  onClick={() => navigate(`/counsellor/student/${s.studentId}`)}
                  whileHover={{ y: -5, background: 'rgba(255,255,255,0.12)' }}
                >
                  <div className="card-top">
                    <div className="avatar-mini"><FiUser /></div>
                    <div className="student-basic">
                      <h3>{s.name}</h3>
                      <p><FiHash /> {s.studentId?.slice(-6)}</p>
                    </div>
                    <div className="session-count-pill">
                      <FiCheckCircle /> {s.sessionsCompleted}
                    </div>
                  </div>
                  
                  <div className="card-details">
                    <div className="detail-row">
                      <FiBookOpen /> <span>{s.course || 'N/A'} • {s.year || 'N/A'}</span>
                    </div>
                    <p className="department-label">{s.department || 'General Care'}</p>
                  </div>

                  <div className="card-footer">
                    <span>Clinical Profile</span>
                    <FiArrowRight />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default CounsellorSessions;

