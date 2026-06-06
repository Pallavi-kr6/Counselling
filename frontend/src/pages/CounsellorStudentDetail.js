import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { FiArrowLeft, FiUser, FiActivity, FiTrendingUp, FiClock, FiCheckCircle, FiCpu, FiFileText, FiAlertTriangle, FiChevronDown, FiChevronUp, FiMail, FiPhone, FiInfo, FiCalendar, FiXCircle } from 'react-icons/fi';
import { PHQ9_QUESTIONS, PHQ9_OPTION_LABELS, phq9Severity } from '../constants/phq9Questions';
import './Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const formatSessionDate = (dateStr, timeStr) => {
  if (!dateStr) return 'Session';
  const d = new Date(dateStr);
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (timeStr) {
    const t = String(timeStr).substring(0, 5);
    return `${label} at ${t}`;
  }
  return label;
};

const CounsellorStudentDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [phq9SectionOpen, setPhq9SectionOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [sessionHistoryOpen, setSessionHistoryOpen] = useState(true);

  const fetchDetails = useCallback(async () => {
    try {
      const response = await api.get(`/appointments/counsellor/student/${studentId}`);
      setDetails(response.data);

      const phqResponse = await api.get(`/appointments/student-phq9/${studentId}`);
      setQuestionnaires(phqResponse.data.scores || []);
    } catch (err) {
      console.error(err.response?.data?.error || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const fetchBrief = async () => {
    setBriefLoading(true);
    try {
      const response = await api.get(`/appointments/pre-session-brief/student/${studentId}`);
      setBrief(response.data);
    } catch (err) {
      console.error('Failed to load AI brief', err);
    } finally {
      setBriefLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.userType !== 'counsellor') {
      navigate('/');
      return;
    }
    fetchDetails();
  }, [user, navigate, fetchDetails]);

  const latestQuestionnaire = questionnaires[0] || null;

  const chartData = details?.moodEntries?.length > 0 ? {
    labels: details.moodEntries
      .slice(0, 7)
      .reverse()
      .map(entry => new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Mood',
        data: details.moodEntries.slice(0, 7).reverse().map(entry => entry.mood),
        borderColor: '#2ec4b6',
        backgroundColor: 'rgba(46, 196, 182, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Stress',
        data: details.moodEntries.slice(0, 7).reverse().map(entry => entry.stress_level),
        borderColor: '#ff9f1c',
        backgroundColor: 'rgba(255, 159, 28, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', weight: '600' } } },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#94a3b8' }
    },
    scales: {
      y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
    }
  };

  if (loading) return <div className="loading-screen">Analyzing student records...</div>;

  return (
    <div className="dashboard student-detail-view">
      <div className="container">
        <motion.header
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="dashboard-header-modern"
        >
          <div className="header-content">
            <button onClick={() => navigate(-1)} className="btn-back-minimal">
              <FiArrowLeft /> Back to Students
            </button>
            <h1>Clinical Overview</h1>
            <p className="welcome-subtitle">Detailed wellbeing and engagement analysis for {details?.student?.name}</p>
          </div>
        </motion.header>

        <div className="dashboard-grid">
          <div className="main-stats-panel">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="student-profile-hero glass-card">
              <div className="hero-top">
                <div className="avatar-circle"><FiUser /></div>
                <div className="hero-text">
                  <h2>{details?.student?.name}</h2>
                  <p>{details?.student?.department} • {details?.student?.course} • Year {details?.student?.year}</p>
                </div>
              </div>

              {/* Contact & Profile Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', margin: '14px 0', padding: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {details?.student?.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiMail size={14} style={{ color: '#2ec4b6', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Email</p>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, wordBreak: 'break-all' }}>{details.student.email}</p>
                    </div>
                  </div>
                )}
                {details?.student?.contact_info && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiPhone size={14} style={{ color: '#2ec4b6', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Phone</p>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600 }}>{details.student.contact_info}</p>
                    </div>
                  </div>
                )}
                {details?.student?.gender && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiInfo size={14} style={{ color: '#2ec4b6', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Gender</p>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, textTransform: 'capitalize' }}>{details.student.gender}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="hero-stats">
                <div className="hero-stat-pill">
                  <FiCheckCircle className="text-success" />
                  <span>{details?.sessions?.completed} Completed Sessions</span>
                </div>
                <div className="hero-stat-pill">
                  <FiClock className="text-warning" />
                  <span>{details?.sessions?.scheduled} Scheduled</span>
                </div>
                {details?.sessions?.cancelled > 0 && (
                  <div className="hero-stat-pill">
                    <FiXCircle style={{ color: '#ef4444' }} />
                    <span>{details.sessions.cancelled} Cancelled</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Session History ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="glass-card"
              style={{ padding: '0', marginBottom: '1rem', overflow: 'hidden', borderRadius: '12px' }}
            >
              <button
                type="button"
                onClick={() => setSessionHistoryOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: sessionHistoryOpen ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}
              >
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                  <FiCalendar style={{ color: '#2ec4b6' }} /> Session History
                  <span style={{ background: 'rgba(46,196,182,0.15)', color: '#2ec4b6', borderRadius: '20px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {details?.sessionHistory?.length || 0}
                  </span>
                </h2>
                {sessionHistoryOpen ? <FiChevronUp style={{ color: '#94a3b8' }} /> : <FiChevronDown style={{ color: '#94a3b8' }} />}
              </button>

              {sessionHistoryOpen && (
                <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px 14px' }}>
                  {details?.sessionHistory?.length > 0 ? details.sessionHistory.map((s, i) => {
                    const statusColors = {
                      completed: { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
                      cancelled: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
                      pending: { bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
                    };
                    const sc = statusColors[s.status] || statusColors.pending;
                    return (
                      <div key={s.id || i} style={{
                        padding: '10px 12px', marginBottom: '8px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>
                              {s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                            </span>
                            {s.start_time && (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</span>
                            )}
                          </div>
                          {s.notes && (
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.5 }}>"{ s.notes}"</p>
                          )}
                        </div>
                        <span style={{
                          flexShrink: 0, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                          borderRadius: '20px', padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize'
                        }}>{s.status}</span>
                      </div>
                    );
                  }) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No sessions recorded yet.
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`phq9-overview-card glass-card ${phq9SectionOpen ? 'phq9-overview-card--open' : 'phq9-overview-card--collapsed'}`}
            >
              <button
                type="button"
                className="phq9-section-toggle"
                onClick={() => setPhq9SectionOpen((open) => !open)}
                aria-expanded={phq9SectionOpen}
              >
                <div className="phq9-section-toggle-left">
                  <h2><FiFileText /> Pre-Session Questionnaire (PHQ-9)</h2>
                  {!phq9SectionOpen && (
                    <span className="phq9-section-summary">
                      {questionnaires.length === 0
                        ? 'No submission yet'
                        : `${questionnaires.length} submission${questionnaires.length !== 1 ? 's' : ''}`}
                      {latestQuestionnaire && (
                        <>
                          {' · '}
                          Latest: {latestQuestionnaire.total_score}/27 ({phq9Severity(latestQuestionnaire.total_score).label})
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="phq9-section-toggle-right">
                  {latestQuestionnaire && (
                    <span className={`phq9-severity-badge severity-${phq9Severity(latestQuestionnaire.total_score).level}`}>
                      {latestQuestionnaire.total_score}/27
                    </span>
                  )}
                  <span className="phq9-chevron" aria-hidden>
                    {phq9SectionOpen ? <FiChevronUp /> : <FiChevronDown />}
                  </span>
                </div>
              </button>

              {phq9SectionOpen && (
                <div className="phq9-section-body">
                  {questionnaires.length === 0 ? (
                    <p className="phq9-empty-note">
                      No questionnaire submitted yet. The student completes PHQ-9 right after booking a session with you.
                    </p>
                  ) : (
                    <div className="phq9-submissions-list">
                      {questionnaires.map((entry) => {
                        const severity = phq9Severity(entry.total_score);
                        const isExpanded = expandedId === entry.id;
                        const responses = entry.responses || [];

                        return (
                          <div key={entry.id} className={`phq9-submission-block ${isExpanded ? 'phq9-submission-block--open' : ''}`}>
                            <button
                              type="button"
                              className="phq9-submission-header"
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                              aria-expanded={isExpanded}
                            >
                              <div>
                                <strong>{formatSessionDate(entry.appointment_date, entry.appointment_start_time)}</strong>
                                <span className="phq9-submitted-at">
                                  Submitted {new Date(entry.created_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <div className="phq9-submission-header-end">
                                <span className={`phq9-score-pill severity-${severity.level}`}>
                                  {entry.total_score}/27 — {severity.label}
                                </span>
                                <span className="phq9-chevron phq9-chevron--sm" aria-hidden>
                                  {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                                </span>
                              </div>
                            </button>

                            {isExpanded && (
                              <ul className="phq9-answers-list">
                                {PHQ9_QUESTIONS.map((question, idx) => {
                                  const score = responses[idx];
                                  const answerLabel =
                                    score != null && PHQ9_OPTION_LABELS[score]
                                      ? PHQ9_OPTION_LABELS[score]
                                      : 'Not answered';
                                  const isHighRisk = idx === 8 && score >= 2;

                                  return (
                                    <li key={idx} className={isHighRisk ? 'phq9-answer-high-risk' : ''}>
                                      <span className="phq9-q-num">Q{idx + 1}</span>
                                      <div className="phq9-answer-body">
                                        <p className="phq9-question-text">{question}</p>
                                        <p className="phq9-answer-text">
                                          {answerLabel}
                                          {score != null && (
                                            <span className="phq9-answer-score"> ({score})</span>
                                          )}
                                        </p>
                                        {isHighRisk && (
                                          <p className="phq9-risk-flag">
                                            <FiAlertTriangle /> Item 9 flagged — review safety during session
                                          </p>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="chart-section glass-card">
              <div className="card-header">
                <h2><FiTrendingUp /> Wellbeing Trends</h2>
                <div className="legend-pills">
                  <span className="pill mood">Mood</span>
                  <span className="pill stress">Stress</span>
                </div>
              </div>
              <div className="chart-viewport" style={{ height: '350px' }}>
                {chartData ? <Line data={chartData} options={chartOptions} /> : <div className="empty-state">No trend data available</div>}
              </div>
            </motion.div>
          </div>

          <aside className="activity-sidebar">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="checkin-history-card glass-card">
              <div className="card-header">
                <h2><FiActivity /> Recent Activity</h2>
              </div>
              <div className="history-scroll-list">
                {details?.moodEntries?.length > 0 ? details.moodEntries.map((m, idx) => (
                  <div key={idx} className="history-item-compact glass-morphism">
                    <div className="item-top">
                      <span className="item-date">{new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="item-emoji">{m.emoji || '🍃'}</span>
                    </div>
                    <div className="item-main">
                      <div className="score-row">
                        <span>Mood: <strong>{m.mood}/10</strong></span>
                        <span>Stress: <strong>{m.stress_level || '-'}/10</strong></span>
                      </div>
                      {m.notes && <p className="item-notes">"{m.notes}"</p>}
                    </div>
                  </div>
                )) : <div className="empty-state">No recent check-ins</div>}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="clinical-notes-card glass-card ai-brief-card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3><FiCpu /> Pre-Session Brief</h3>
                {!brief && (
                  <button
                    className="btn-outline-mini"
                    onClick={fetchBrief}
                    disabled={briefLoading}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer', background: 'rgba(46, 196, 182, 0.1)', color: '#2ec4b6', border: '1px solid #2ec4b6' }}
                  >
                    {briefLoading ? 'Analyzing...' : 'Generate AI Brief'}
                  </button>
                )}
              </div>

              {brief ? (
                <div className="brief-content" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #667eea' }}>
                  {latestQuestionnaire && (
                    <div style={{ marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Latest PHQ-9 Score:</span>
                      <span className={`phq9-score-pill severity-${phq9Severity(latestQuestionnaire.total_score).level}`} style={{ marginLeft: '0.5rem' }}>
                        {latestQuestionnaire.total_score} / 27
                      </span>
                    </div>
                  )}
                  <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e2e8f0', marginBottom: '0.5rem' }}>{brief.brief}</p>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <span>Analyzed from: {brief.messageCount} messages</span>
                  </div>
                </div>
              ) : (
                <p className="note-placeholder" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                  Click to generate an AI summary of the student&apos;s recent bot interactions and view check-ins before your session.
                </p>
              )}
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CounsellorStudentDetail;
