import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCheckCircle, FiUser, FiMail, FiPhone, FiArrowLeft,
  FiAlertOctagon, FiExternalLink, FiRefreshCw
} from 'react-icons/fi';
import './Dashboard.css';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const ResolvedCases = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/resolved-cases');
      setCases(res.data.cases || []);
    } catch (err) {
      console.error('Resolved cases fetch error:', err);
      setError('Unable to load resolved cases. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user || (user.userType !== 'counsellor' && user.userType !== 'admin')) {
      navigate('/dashboard');
      return;
    }
    fetchCases();
  }, [user, navigate, fetchCases]);

  if (loading) {
    return (
      <div className="loading-screen">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
          Loading resolved cases...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="dashboard counsellor-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="container">
        {/* Header */}
        <header className="dashboard-header-modern">
          <div className="header-greeting">
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px',
                padding: 0
              }}
            >
              <FiArrowLeft size={14} /> Back to Dashboard
            </button>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiCheckCircle style={{ color: '#10b981' }} />
              Resolved Cases
            </h1>
            <p>Follow-up tracker for students whose crisis cases have been resolved.</p>
          </div>
          <button
            onClick={() => fetchCases(true)}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(46,196,182,0.1)', border: '1px solid rgba(46,196,182,0.3)',
              color: '#2ec4b6', borderRadius: '8px', padding: '8px 14px',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            <FiRefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        {/* Stats Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem',
          padding: '12px 18px', background: 'rgba(16,185,129,0.07)',
          border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px'
        }}>
          <FiCheckCircle size={20} style={{ color: '#10b981' }} />
          <span style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>{cases.length}</span>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
            resolved {cases.length === 1 ? 'case' : 'cases'} — keep checking in on these students periodically.
          </span>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px',
            padding: '14px 18px', marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Cases List */}
        {cases.length === 0 && !error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ padding: '48px 24px', textAlign: 'center' }}
          >
            <FiCheckCircle size={48} style={{ color: '#10b981', opacity: 0.4, marginBottom: '16px' }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>No resolved cases yet</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              When you mark a crisis alert as resolved from the dashboard, it will appear here for follow-up tracking.
            </p>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gap: '14px' }}>
            <AnimatePresence>
              {cases.map((c, i) => (
                <motion.div
                  key={c.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: i * 0.04 }}
                  className="glass-card"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #10b981',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Left: Student info & message */}
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    {/* Student name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0
                      }}>
                        <FiUser size={13} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {c.student_name || (c.student_id ? 'Registered Student' : 'Anonymous')}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {c.student_email && (
                            <a
                              href={`mailto:${c.student_email}`}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#2ec4b6', textDecoration: 'none' }}
                            >
                              <FiMail size={11} /> {c.student_email}
                            </a>
                          )}
                          {c.student_phone && (
                            <a
                              href={`tel:${c.student_phone}`}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#2ec4b6', textDecoration: 'none' }}
                            >
                              <FiPhone size={11} /> {c.student_phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Crisis message snippet */}
                    {c.message_snippet && (
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '6px',
                        background: 'rgba(239,68,68,0.06)', borderRadius: '6px',
                        padding: '8px 10px', marginBottom: '8px'
                      }}>
                        <FiAlertOctagon size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{c.message_snippet}"
                        </p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <FiAlertOctagon size={11} style={{ color: '#ef4444' }} />
                        Alert: {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {c.resolved_at && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#10b981' }}>
                          <FiCheckCircle size={11} />
                          Resolved: {new Date(c.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <span style={{
                      background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac',
                      borderRadius: '20px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700
                    }}>
                      ✓ Resolved
                    </span>
                    {c.severity === 'HIGH' && (
                      <span style={{
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
                        borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600
                      }}>
                        🚨 Was High Severity
                      </span>
                    )}
                    {c.student_id && (
                      <button
                        onClick={() => navigate(`/counsellor/student/${c.student_id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 12px', fontSize: '0.78rem', fontWeight: 600,
                          background: 'rgba(46,196,182,0.1)', border: '1px solid rgba(46,196,182,0.3)',
                          borderRadius: '7px', color: '#2ec4b6', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(46,196,182,0.2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(46,196,182,0.1)'; }}
                      >
                        <FiExternalLink size={13} /> View Student
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Spinning animation for refresh icon */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
};

export default ResolvedCases;
