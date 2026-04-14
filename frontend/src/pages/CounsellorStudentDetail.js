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
import { FiArrowLeft, FiUser, FiActivity, FiTrendingUp, FiClock, FiFileText, FiCheckCircle, FiCpu } from 'react-icons/fi';
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

const CounsellorStudentDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [phq9Data, setPhq9Data] = useState(null);

  const fetchDetails = useCallback(async () => {
    try {
      const response = await api.get(`/appointments/counsellor/student/${studentId}`);
      setDetails(response.data);
      
      const phqResponse = await api.get(`/appointments/student-phq9/${studentId}`);
      if (phqResponse.data.scores?.length > 0) {
        setPhq9Data(phqResponse.data.scores[phqResponse.data.scores.length - 1]); // latest
      }
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
                  <p>{details?.student?.department} • {details?.student?.course} • {details?.student?.year}</p>
                </div>
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
              </div>
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
                  {phq9Data && (
                    <div style={{ marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Latest PHQ-9 Score:</span>
                      <span style={{ marginLeft: '0.5rem', background: phq9Data.total_score >= 10 ? '#e74c3c' : '#f1c40f', color: '#000', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {phq9Data.total_score} / 27
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
                  Click to generate an AI summary of the student's recent bot interactions and view check-ins before your session.
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
