import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCalendar, 
  FiCheckCircle, 
  FiActivity,
  FiClock,
  FiClipboard,
  FiExternalLink,
  FiSettings,
  FiPower,
  FiAlertTriangle,
  FiAlertOctagon,
  FiEye,
  FiCheck,
  FiTrendingDown,
  FiUser,
  FiX,
} from 'react-icons/fi';
import './Dashboard.css';
import CancelSessionModal from '../components/CancelSessionModal';
import NotificationCenter from '../components/NotificationCenter';

// ── Tag badge helper ──────────────────────────────────────────
const TAG_CONFIG = {
  watch:   { color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', label: '👁 Watch',   icon: FiEye },
  urgent:  { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: '🚨 Urgent',  icon: FiAlertOctagon },
  resolved:{ color: '#16a34a', bg: '#f0fdf4', border: '#86efac', label: '✓ Resolved', icon: FiCheck },
};

function TagBadge({ tag }) {
  const cfg = TAG_CONFIG[tag] || TAG_CONFIG.watch;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: '20px', padding: '3px 10px',
      fontSize: '0.75rem', fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
}

// ── Watch flag card ───────────────────────────────────────────
function WatchFlagCard({ flag, onAcknowledge, onResolve }) {
  const [busy, setBusy] = useState(false);

  const handleAck = async () => {
    setBusy(true);
    await onAcknowledge(flag.id);
    setBusy(false);
  };

  const handleResolve = async () => {
    setBusy(true);
    await onResolve(flag.id);
    setBusy(false);
  };

  const windowLabel = flag.mood_window_start && flag.mood_window_end
    ? `${flag.mood_window_start} → ${flag.mood_window_end}`
    : 'N/A';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: '#fff',
        border: `1px solid ${flag.tag === 'urgent' ? '#fca5a5' : '#e5e7eb'}`,
        borderLeft: `4px solid ${flag.tag === 'urgent' ? '#dc2626' : '#f59e0b'}`,
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '10px',
        boxShadow: flag.tag === 'urgent' ? '0 2px 12px rgba(220,38,38,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Student info row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
          }}>
            <FiUser size={14} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>
              {flag.student_name}
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
              {flag.student_email || flag.student_id?.slice(0, 8)} 
              {flag.student_year && ` · Year ${flag.student_year}`}
              {flag.student_course && ` · ${flag.student_course}`}
            </p>
          </div>
        </div>
        <TagBadge tag={flag.tag} />
      </div>

      {/* Mood stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
        background: '#f9fafb', borderRadius: '8px', padding: '10px',
        marginBottom: '10px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: flag.tag === 'urgent' ? '#dc2626' : '#f59e0b' }}>
            {flag.avg_mood_score ?? '—'}<span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>/10</span>
          </p>
          <p style={{ margin: 0, fontSize: '0.71rem', color: '#6b7280' }}>Avg Mood</p>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#374151' }}>
            {flag.consecutive_days ?? '—'}
          </p>
          <p style={{ margin: 0, fontSize: '0.71rem', color: '#6b7280' }}>Days Low</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0', fontSize: '0.72rem', fontWeight: 600, color: '#374151', lineHeight: 1.4 }}>
            {windowLabel}
          </p>
          <p style={{ margin: 0, fontSize: '0.71rem', color: '#6b7280' }}>Window</p>
        </div>
      </div>

      {/* Reason */}
      <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.5 }}>
        <FiTrendingDown size={11} style={{ marginRight: 4, verticalAlign: 'middle', color: '#dc2626' }} />
        {flag.reason}
      </p>

      {/* Actions */}
      {!flag.resolved && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {!flag.acknowledged && (
            <button
              onClick={handleAck}
              disabled={busy}
              style={{
                flex: 1, padding: '7px', background: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: '7px', color: '#92400e', fontWeight: 600, fontSize: '0.78rem',
                cursor: busy ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              }}
            >
              <FiEye size={12} style={{ marginRight: 4 }} />
              {busy ? 'Saving…' : 'Acknowledge'}
            </button>
          )}
          <button
            onClick={handleResolve}
            disabled={busy}
            style={{
              flex: 1, padding: '7px', background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: '7px', color: '#15803d', fontWeight: 600, fontSize: '0.78rem',
              cursor: busy ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            }}
          >
            <FiCheck size={12} style={{ marginRight: 4 }} />
            {busy ? 'Saving…' : 'Mark Resolved'}
          </button>
        </div>
      )}

      {flag.acknowledged && !flag.resolved && (
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#6b7280', textAlign: 'right' }}>
          ✓ Acknowledged {flag.acknowledged_at ? new Date(flag.acknowledged_at).toLocaleDateString() : ''}
        </p>
      )}
    </motion.div>
  );
}

// ── Main dashboard ────────────────────────────────────────────
const CounsellorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counsellorAppointments, setCounsellorAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [counsellorAvailability, setCounsellorAvailability] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [sessionToCancel, setSessionToCancel] = useState(null);

  // Session Notes state
  const [notesModalSessionId, setNotesModalSessionId] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [riskLevel, setRiskLevel] = useState('low');
  const [nextAction, setNextAction] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Watch flags state
  const [watchFlags, setWatchFlags] = useState([]);
  const [watchLoading, setWatchLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  // Live Alerts state (Real-time Supabase)
  const [liveAlerts, setLiveAlerts] = useState([]);

  const fetchCounsellorDashboard = useCallback(async () => {
    try {
      const apptResponse = await api.get('/appointments/counsellor/' + user.id);
      const allAppointments = apptResponse.data.appointments || [];
      setCounsellorAppointments(allAppointments);
      setUpcomingAppointments(allAppointments
        .filter(apt => !['completed', 'cancelled', 'pending_reassign'].includes(apt.status))
        .sort((a, b) => new Date(a.date + 'T' + a.start_time) - new Date(b.date + 'T' + b.start_time)));

      const availResponse = await api.get('/profiles/counsellor/availability/' + user.id);
      const availability = availResponse.data.availability || [];
      setCounsellorAvailability(availability);

      const profileResponse = await api.get('/profiles/counsellor/' + user.id);
      setIsAvailable(profileResponse.data.profile?.is_online || false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  const fetchWatchFlags = useCallback(async () => {
    setWatchLoading(true);
    try {
      const res = await api.get(`/admin/watch-flags?resolved=${showResolved}`);
      setWatchFlags(res.data.watchFlags || []);
    } catch (err) {
      console.error('Watch flags fetch error:', err);
      setWatchFlags([]);
    } finally {
      setWatchLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    if (user?.id) fetchCounsellorDashboard();
  }, [user, fetchCounsellorDashboard]);

  useEffect(() => {
    fetchWatchFlags();
  }, [fetchWatchFlags]);

  // Live Alerts Subscription
  useEffect(() => {
    // Initial fetch
    api.get('/admin/live-alerts')
      .then(res => setLiveAlerts(res.data.alerts || []))
      .catch(err => console.error('Live alerts initial fetch error:', err));

    // Real-time subscription
    const channel = supabase
      .channel('crisis-alerts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crisis_alerts' }, payload => {
        setLiveAlerts(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crisis_alerts' }, payload => {
        setLiveAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleAvailability = async () => {
    try {
      const newStatus = !isAvailable;
      const res = await api.put(`/profiles/counsellor/status/${user.id}/toggle`, { isAvailable: newStatus, availableHours: 8 });
      setIsAvailable(res.data.isAvailable !== undefined ? res.data.isAvailable : res.data.isOnline);
    } catch (err) {
      console.error('Availability toggle error:', err);
      alert(err.response?.data?.error || 'Failed to update availability status. Please check your connection or contact admin.');
    }
  };

  const completeSession = async (id) => {
    if (completingId) return;
    setCompletingId(id);
    try {
      await api.put(`/appointments/complete/${id}`);
      setUpcomingAppointments(prev => prev.filter(apt => apt.id !== id));
      
      // Auto-open session notes modal on session completion
      setNotesModalSessionId(id);
      setNotesText('');
      setRiskLevel('low');
      setNextAction('');
    } catch (err) {
      console.error('Completion error:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleCancelSuccess = () => {
    setSessionToCancel(null);
    fetchCounsellorDashboard();
  };

  const submitSessionNotes = async () => {
    if (!notesText.trim()) return;
    setSavingNotes(true);
    try {
      await api.post(`/appointments/${notesModalSessionId}/notes`, {
        notes_text: notesText,
        risk_level: riskLevel,
        next_action: nextAction
      });
      setNotesModalSessionId(null);
    } catch (err) {
      console.error('Save notes error:', err);
      alert('Failed to save session notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const acknowledgeFlag = async (flagId) => {
    try {
      await api.patch(`/admin/watch-flags/${flagId}`, { acknowledged: true });
      setWatchFlags(prev => prev.map(f => f.id === flagId ? { ...f, acknowledged: true } : f));
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  };

  const resolveFlag = async (flagId) => {
    try {
      await api.patch(`/admin/watch-flags/${flagId}`, { resolved: true });
      // Remove from list (since we're showing unresolved by default)
      if (!showResolved) {
        setWatchFlags(prev => prev.filter(f => f.id !== flagId));
      } else {
        setWatchFlags(prev => prev.map(f => f.id === flagId ? { ...f, resolved: true } : f));
      }
    } catch (err) {
      console.error('Resolve error:', err);
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

  const urgentCount = watchFlags.filter(f => f.tag === 'urgent').length;
  const watchCount  = watchFlags.filter(f => f.tag === 'watch').length;

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
            <FiPower /> <span>{isAvailable ? "I'm available" : 'Unavailable'}</span>
          </div>
        </header>

       <div className="stats-row">
  {[
    { 
      label: 'Upcoming',  
      value: upcomingAppointments.length,                                      
      icon: <FiCalendar />,      
      color: '#2EC4B6' 
    },
    { 
      label: 'Completed', 
      value: counsellorAppointments.filter(a => a.status === 'completed').length, 
      icon: <FiCheckCircle />,   
      color: '#10B981' 
    },
    {
      label: urgentCount > 0 ? `${urgentCount} Urgent` : `${watchCount} Watch`,
      value: watchFlags.length,
      icon: urgentCount > 0 ? <FiAlertOctagon /> : <FiAlertTriangle />,
      color: urgentCount > 0 ? '#dc2626' : '#f59e0b',
    },
  ].map((stat, i) => (
    <motion.div key={i} className="stat-card-mini glass-card" variants={cardVariants}>
      <div className="stat-icon-wrapper" style={{ color: stat.color }}>
        {stat.icon}
      </div>
      <div className="stat-text">
        <span className="stat-value">{stat.value}</span>
        <span className="stat-label">{stat.label}</span>
      </div>
    </motion.div>
  ))}
</div>

        <div className="dashboard-layout">
          <section className="main-content">

            {/* ── Live Crisis Alerts (Real-Time) ── */}
            <motion.div className="dashboard-card-modern glass-card" variants={cardVariants} style={{ marginBottom: '1.5rem', borderLeft: '4px solid #ef4444' }}>
              <div className="card-header-modern" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                  <FiAlertOctagon />
                  Live Crisis Alerts
                  {liveAlerts.length > 0 && (
                    <span style={{
                      background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                      borderRadius: '20px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      {liveAlerts.length}
                    </span>
                  )}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                  <span className="live-indicator" style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%', display: 'inline-block' }}></span>
                  Real-time Feed
                </div>
              </div>

              <div style={{ padding: '0 4px', maxHeight: '300px', overflowY: 'auto' }}>
                <AnimatePresence mode="popLayout">
                  {liveAlerts.length > 0 ? liveAlerts.map(alert => (
                    <motion.div key={alert.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      style={{
                        padding: '12px', marginBottom: '8px', borderRadius: '8px',
                        background: alert.severity === 'HIGH' ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${alert.severity === 'HIGH' ? '#fecaca' : '#e2e8f0'}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                            {alert.student_id ? 'Authenticated Student' : 'Anonymous Student'}
                          </span>
                          {alert.severity === 'HIGH' && <TagBadge tag="urgent" />}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', fontStyle: 'italic' }}>"{alert.message_snippet}"</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button 
                        onClick={() => navigate(alert.session_id ? `/session/${alert.session_id}` : '#')}
                        disabled={!alert.session_id}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: alert.session_id ? 'pointer' : 'not-allowed', opacity: alert.session_id ? 1 : 0.5 }}>
                        View transcript
                      </button>
                    </motion.div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                      <FiCheckCircle size={24} style={{ marginBottom: 8, color: '#10b981', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>No active crisis signals.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* ── At-Risk Students Panel ── */}
            <motion.div className="dashboard-card-modern glass-card" variants={cardVariants} style={{ marginBottom: '1.5rem' }}>
              <div className="card-header-modern" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiTrendingDown color="#f59e0b" />
                  At-Risk Students
                  {watchFlags.length > 0 && (
                    <span style={{
                      background: urgentCount > 0 ? '#fee2e2' : '#fffbeb',
                      color: urgentCount > 0 ? '#dc2626' : '#92400e',
                      border: `1px solid ${urgentCount > 0 ? '#fca5a5' : '#fcd34d'}`,
                      borderRadius: '20px', padding: '2px 8px',
                      fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      {watchFlags.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowResolved(v => !v)}
                  style={{
                    background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px',
                    padding: '5px 10px', fontSize: '0.78rem', color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  {showResolved ? 'Show Active' : 'Show Resolved'}
                </button>
              </div>

              <div style={{ padding: '0 4px' }}>
                {watchLoading ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
                    Loading watch flags…
                  </p>
                ) : watchFlags.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280' }}>
                    <FiCheckCircle size={28} style={{ marginBottom: 8, color: '#10b981' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                      {showResolved ? 'No resolved flags.' : 'No at-risk students flagged. All looking good! 🎉'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                      The system scans mood check-ins daily at 02:00 IST.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {watchFlags.map(flag => (
                      <WatchFlagCard
                        key={flag.id}
                        flag={flag}
                        onAcknowledge={acknowledgeFlag}
                        onResolve={resolveFlag}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>

            {/* ── Scheduled Sessions ── */}
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
                          <button
                            type="button"
                            className="btn-complete"
                            style={{ background: '#fee2e2', color: '#991b1b' }}
                            onClick={() => setSessionToCancel(apt)}
                          >
                            Cancel
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
                   <div
  className={`status-indicator ${
    isAvailable && slot.is_available ? 'active' : 'inactive'
  }`}
/>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div className="dashboard-card-modern glass-card" variants={cardVariants}>
              <div className="card-header-modern"><h2>Reassignment Requests</h2></div>
              <NotificationCenter />
            </motion.div>
          </aside>
        </div>
      </div>

      <CancelSessionModal
        isOpen={Boolean(sessionToCancel)}
        session={sessionToCancel}
        onClose={() => setSessionToCancel(null)}
        onSuccess={handleCancelSuccess}
      />

      {/* ── Session Notes Modal ── */}
      <AnimatePresence>
        {notesModalSessionId && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div className="modal-content glass-card" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ background: '#fff', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Add Session Notes</h3>
                <FiX onClick={() => setNotesModalSessionId(null)} style={{ cursor: 'pointer', color: '#64748b' }} size={24} />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Observations & Notes *</label>
                <textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  style={{ width: '100%', minHeight: '120px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', resize: 'vertical' }}
                  placeholder="Record your clinical observations here..."
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Identified Risk Level</label>
                <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', backgroundColor: '#fff' }}>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Next Action Steps</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={e => setNextAction(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  placeholder="e.g., Follow-up in 2 weeks"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setNotesModalSessionId(null)} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Skip for now</button>
                <button onClick={submitSessionNotes} disabled={savingNotes || !notesText.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: (savingNotes || !notesText.trim()) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {savingNotes ? 'Saving...' : 'Save Notes Securely'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default CounsellorDashboard;
