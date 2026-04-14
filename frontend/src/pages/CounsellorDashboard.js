import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCalendar, 
  FiCheckCircle, 
  FiActivity,
  FiClock,
  FiClipboard,
  FiExternalLink,
  FiSettings,
  FiPower
} from 'react-icons/fi';
import './Dashboard.css';

const CounsellorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counsellorAppointments, setCounsellorAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [counsellorAvailability, setCounsellorAvailability] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [completingId, setCompletingId] = useState(null);

  const fetchCounsellorDashboard = useCallback(async () => {
    try {
      const apptResponse = await api.get('/appointments/counsellor/' + user.id);
      const allAppointments = apptResponse.data.appointments || [];
      setCounsellorAppointments(allAppointments);
      setUpcomingAppointments(allAppointments
        .filter(apt => apt.status !== 'completed' && apt.status !== 'cancelled')
        .sort((a, b) => new Date(a.date + 'T' + a.start_time) - new Date(b.date + 'T' + b.start_time)));

      const availResponse = await api.get('/profiles/counsellor/availability/' + user.id);
      const availability = availResponse.data.availability || [];
      setCounsellorAvailability(availability);
      setIsAvailable(availability.some(slot => slot.is_available));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (user?.id) fetchCounsellorDashboard();
  }, [user, fetchCounsellorDashboard]);

  const toggleAvailability = async () => {
    try {
      const newStatus = !isAvailable;
      await api.put(`/profiles/counsellor/availability/${user.id}/toggle`, { isAvailable: newStatus });
      setIsAvailable(newStatus);
    } catch (err) {
      console.error('Availability toggle error:', err);
    }
  };

  const completeSession = async (id) => {
    if (completingId) return;
    setCompletingId(id);
    try {
      await api.put(`/appointments/complete/${id}`);
      setUpcomingAppointments(prev => prev.filter(apt => apt.id !== id));
    } catch (err) {
      console.error('Completion error:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (loading) return <div className="loading-screen">Opening your professional space...</div>;

  return (
    <motion.div className="dashboard counsellor-view" variants={containerVariants} initial="hidden" animate="visible">
      <div className="container">
        <header className="dashboard-header-modern">
          <div className="header-greeting">
            <h1>Expert Portal</h1>
            <p>Welcome back, {user.name || 'Professional'}. Your sessions today are waiting.</p>
          </div>
          <div className={`status-pill ${isAvailable ? 'online' : 'offline'}`} onClick={toggleAvailability}>
            <FiPower /> <span>{isAvailable ? 'Accepting Sessions' : 'Session Break'}</span>
          </div>
        </header>

        <div className="stats-row">
          {[
            { label: 'Upcoming', value: upcomingAppointments.length, icon: <FiCalendar />, color: '#2EC4B6' },
            { label: 'Completed', value: counsellorAppointments.filter(a => a.status === 'completed').length, icon: <FiCheckCircle />, color: '#10B981' },
            { label: 'Resources', value: '12', icon: <FiClipboard />, color: '#9067C6' }
          ].map((stat, i) => (
            <motion.div key={i} className="stat-card-mini glass-card" variants={cardVariants}>
              <div className="stat-icon-wrapper" style={{ color: stat.color }}>{stat.icon}</div>
              <div className="stat-text">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="dashboard-layout">
          <section className="main-content">
            <motion.div className="dashboard-card-modern glass-card" variants={cardVariants}>
              <div className="card-header-modern">
                <h2><FiCalendar /> Management: Scheduled Sessions</h2>
              </div>
              <div className="session-list">
                <AnimatePresence mode="popLayout">
                  {upcomingAppointments.length > 0 ? (
                    upcomingAppointments.map((apt) => (
                      <motion.div key={apt.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="session-item glass-card">
                        <div className="session-date">
                          <span className="day">{new Date(apt.date).getDate()}</span>
                          <span className="month">{new Date(apt.date).toLocaleString('en-US', { month: 'short' })}</span>
                        </div>
                        <div className="session-info">
                          <h4>{apt.student?.name || 'Private Session'}</h4>
                          <span className="time-range"><FiClock /> {apt.start_time} - {apt.end_time}</span>
                        </div>
                        <div className="session-actions">
                          <button className="btn-complete" onClick={() => completeSession(apt.id)} disabled={completingId === apt.id}>
                            {completingId === apt.id ? 'Checking...' : 'Complete'}
                          </button>
                          <button className="btn-link" onClick={() => navigate(`/session/${apt.id}`)}>
                            <FiExternalLink />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="empty-sessions-vignette">
                      <FiCheckCircle className="vignette-icon" />
                      <p>Your schedule is perfectly clear.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </section>

          <aside className="sidebar-content">
            <motion.div className="dashboard-card-modern glass-card sidebar-action-card" variants={cardVariants}>
              <div className="card-header-modern"><h2>Quick Tools</h2></div>
              <div className="tools-grid-mini">
                <button className="tool-btn-mini" onClick={() => navigate('/profiles/counsellor/edit')}>
                  <FiSettings /> <span>Update Profile</span>
                </button>
                <button className="tool-btn-mini" onClick={() => navigate('/progress-reports')}>
                  <FiActivity /> <span>Insight Reports</span>
                </button>
              </div>
            </motion.div>

            <motion.div className="dashboard-card-modern glass-card availability-summary-card" variants={cardVariants}>
              <div className="card-header-modern"><h2>Availability Status</h2></div>
              <div className="availability-list-mini">
                {counsellorAvailability.map((slot, i) => (
                  <div key={i} className="availability-row-mini">
                    <span className="day-name">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.day_order_id] || 'Day'}</span>
                    <span className="time-label">{slot.start_time} - {slot.end_time}</span>
                    <div className={`status-indicator ${slot.is_available ? 'active' : 'inactive'}`} />
                  </div>
                ))}
              </div>
            </motion.div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
};

export default CounsellorDashboard;
