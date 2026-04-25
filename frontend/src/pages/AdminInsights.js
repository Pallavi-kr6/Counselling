import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer,
  BarChart, Bar, Tooltip as BarTooltip, Cell,
} from 'recharts';
import { FiUsers, FiCalendar, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import DepartmentHeatmap from '../components/DepartmentHeatmap';
import './Dashboard.css';

const AdminInsights = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState({
    weeklyActiveUsers: 0,
    topConcerns:       [],
    noShowRate:        0,
    moodScoreTrend:    [],
  });

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await api.get('/admin/insights');
        setInsights(res.data);
      } catch (err) {
        console.error('Failed to load admin insights:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '80vh' }}>
        <p>Loading Insights Database…</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="dashboard"
      style={{ padding: '2rem' }}
    >
      <div className="container" style={{ maxWidth: '1280px' }}>

        {/* ── Page header ─────────────────────────────────────── */}
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Administrative Insights
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Aggregate overview of user engagement, appointment metrics, mood trends, and
            department wellness — all data anonymised.
          </p>
        </header>

        {/* ── Top KPI cards ────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap:                 '1.5rem',
          marginBottom:        '2rem',
        }}>
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(46,196,182,0.1)', borderRadius: '50%', color: '#2ec4b6' }}>
              <FiUsers size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)' }}>
                {insights.weeklyActiveUsers}
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Weekly Active Users</p>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(231,76,60,0.1)', borderRadius: '50%', color: '#e74c3c' }}>
              <FiCalendar size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)' }}>
                {insights.noShowRate}%
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Appointment No-Show Rate</p>
            </div>
          </div>
        </div>

        {/* ── Charts row ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

          {/* Avg Mood Trend */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiTrendingUp color="#3498db" /> AI Mood Score Trend (Past Week)
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              {insights.moodScoreTrend.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={insights.moodScoreTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[1, 10]} ticks={[1, 3, 6, 10]} />
                    <LineTooltip />
                    <Line type="monotone" dataKey="averageScore" stroke="#3498db" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-center" style={{ height: '100%', color: '#94a3b8' }}>
                  Not enough emotion data recorded recently.
                </div>
              )}
            </div>
          </div>

          {/* Top Concerns */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiAlertTriangle color="#f1c40f" /> Top AI Conversation Topics
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              {insights.topConcerns.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={insights.topConcerns} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} />
                    <BarTooltip />
                    <Bar dataKey="value" fill="#f1c40f" radius={[0, 4, 4, 0]}>
                      {insights.topConcerns.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-center" style={{ height: '100%', color: '#94a3b8' }}>
                  No topic data available.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Department Wellness Heatmap ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{ marginBottom: '2rem' }}
        >
          <DepartmentHeatmap />
        </motion.div>

      </div>
    </motion.div>
  );
};

export default AdminInsights;
