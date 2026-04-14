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
import { FiArrowLeft, FiUser, FiActivity, FiTrendingUp, FiClock, FiFileText, FiCheckCircle } from 'react-icons/fi';
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

  const fetchDetails = useCallback(async () => {
    try {
      const response = await api.get(`/appointments/counsellor/student/${studentId}`);
      setDetails(response.data);
    } catch (err) {
      console.error(err.response?.data?.error || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

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
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="clinical-notes-card glass-card">
              <h3><FiFileText /> Quick Notes</h3>
              <p className="note-placeholder">Add clinical observations or summary of progress here in future updates.</p>
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CounsellorStudentDetail;
